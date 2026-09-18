import { db, SYDNEY_MONTH_START, type Customer, type PaymentPlan, type ServiceCentre, type Sql } from "@/lib/db";
import type { DebitRunSummary } from "@/lib/jobs";

// Read-only queries across every workshop, for Halfshaft admins only. Callers must have
// passed requireAdmin().

export type PlatformOverview = {
  workshops: number;
  readyWorkshops: number;
  suspendedWorkshops: number;
  activePlans: number;
  pausedPlans: number;
  collectedThisMonthCents: number;
  paymentsRetrying: number;
  paymentsProcessing: number;
  emailsFailed: number;
  emailsSkipped: number;
  textsFailed: number;
  textsSkipped: number;
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const row = await db.one<PlatformOverview>(
    `SELECT
       (SELECT COUNT(*) FROM service_centres) AS "workshops",
       (SELECT COUNT(*) FROM service_centres WHERE charges_enabled AND becs_capability = 'active') AS "readyWorkshops",
       (SELECT COUNT(*) FROM service_centres WHERE suspended_at IS NOT NULL) AS "suspendedWorkshops",
       (SELECT COUNT(*) FROM payment_plans WHERE status = 'active') AS "activePlans",
       (SELECT COUNT(*) FROM payment_plans WHERE status = 'failed') AS "pausedPlans",
       (SELECT COALESCE(SUM(amount_cents), 0) FROM instalments
         WHERE status = 'paid' AND paid_at >= ${SYDNEY_MONTH_START}) AS "collectedThisMonthCents",
       (SELECT COUNT(*) FROM instalments WHERE status = 'failed') AS "paymentsRetrying",
       (SELECT COUNT(*) FROM instalments WHERE status = 'processing') AS "paymentsProcessing",
       (SELECT COUNT(*) FROM email_outbox WHERE status = 'failed') AS "emailsFailed",
       (SELECT COUNT(*) FROM email_outbox WHERE status = 'skipped') AS "emailsSkipped",
       (SELECT COUNT(*) FROM sms_outbox WHERE status = 'failed') AS "textsFailed",
       (SELECT COUNT(*) FROM sms_outbox WHERE status = 'skipped') AS "textsSkipped"`,
  );
  return row!;
}

export type WorkshopListItem = Pick<
  ServiceCentre,
  | "id"
  | "name"
  | "email"
  | "stripe_account_id"
  | "details_submitted"
  | "charges_enabled"
  | "payouts_enabled"
  | "becs_capability"
  | "suspended_at"
  | "created_at"
> & {
  owner_name: string | null;
  owner_email: string | null;
  active_plans: number;
  paused_plans: number;
  retrying: number;
  collected_this_month_cents: number;
};

export async function listWorkshops(): Promise<WorkshopListItem[]> {
  return db.query<WorkshopListItem>(
    `SELECT sc.id, sc.name, sc.email, sc.stripe_account_id, sc.details_submitted, sc.charges_enabled,
            sc.payouts_enabled, sc.becs_capability, sc.suspended_at, sc.created_at,
            owner.name AS owner_name, owner.email AS owner_email,
            plans.active_plans, plans.paused_plans, debits.retrying, debits.collected_this_month_cents
       FROM service_centres sc
       LEFT JOIN LATERAL (
         SELECT u.name, u.email FROM memberships m JOIN users u ON u.id = m.user_id
          WHERE m.service_centre_id = sc.id AND m.role = 'owner'
          ORDER BY m.created_at LIMIT 1
       ) owner ON true
       CROSS JOIN LATERAL (
         SELECT COUNT(*) FILTER (WHERE status = 'active') AS active_plans,
                COUNT(*) FILTER (WHERE status = 'failed') AS paused_plans
           FROM payment_plans WHERE service_centre_id = sc.id
       ) plans
       CROSS JOIN LATERAL (
         SELECT COUNT(*) FILTER (WHERE i.status = 'failed') AS retrying,
                COALESCE(SUM(i.amount_cents) FILTER (WHERE i.status = 'paid' AND i.paid_at >= ${SYDNEY_MONTH_START}), 0)
                  AS collected_this_month_cents
           FROM instalments i JOIN payment_plans p ON p.id = i.payment_plan_id
          WHERE p.service_centre_id = sc.id
       ) debits
      ORDER BY sc.suspended_at IS NOT NULL, lower(sc.name), sc.id`,
  );
}

export async function getWorkshop(centreId: number): Promise<ServiceCentre | undefined> {
  if (!Number.isInteger(centreId)) return undefined;
  return db.one<ServiceCentre>("SELECT * FROM service_centres WHERE id = $1", [centreId]);
}

export type WorkshopMember = {
  id: number;
  name: string;
  email: string;
  role: "owner" | "staff";
  last_login_at: string | null;
};

export async function listWorkshopMembers(centreId: number): Promise<WorkshopMember[]> {
  return db.query<WorkshopMember>(
    `SELECT u.id, u.name, u.email, m.role,
            (SELECT MAX(s.created_at) FROM user_sessions s WHERE s.user_id = u.id) AS last_login_at
       FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.service_centre_id = $1
      ORDER BY m.role = 'owner' DESC, m.created_at`,
    [centreId],
  );
}

export type RetryingPayment = {
  id: number;
  sequence: number;
  amount_cents: number;
  due_date: string;
  failure_reason: string | null;
  failure_code: string | null;
  attempt_count: number;
  next_retry_on: string | null;
  plan_id: number;
  description: string;
  instalment_count: number;
  plan_status: PaymentPlan["status"];
  customer_name: string;
};

export async function listFailedPayments(centreId: number): Promise<RetryingPayment[]> {
  return db.query<RetryingPayment>(
    `SELECT i.id, i.sequence, i.amount_cents, i.due_date, i.failure_reason, i.failure_code, i.attempt_count,
            i.next_retry_on, p.id AS plan_id, p.description, p.instalment_count, p.status AS plan_status,
            c.full_name AS customer_name
       FROM instalments i
       JOIN payment_plans p ON p.id = i.payment_plan_id
       JOIN customers c ON c.id = p.customer_id
      WHERE p.service_centre_id = $1 AND i.status = 'failed'
      ORDER BY i.due_date, i.id`,
    [centreId],
  );
}

export type OutboxEmail = {
  id: number;
  audience: "workshop" | "customer";
  recipient: string;
  subject: string;
  status: "pending" | "sent" | "failed" | "skipped";
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
};

export async function listWorkshopEmails(centreId: number, limit = 25): Promise<OutboxEmail[]> {
  return db.query<OutboxEmail>(
    `SELECT id, audience, recipient, subject, status, attempts, last_error, sent_at, created_at
       FROM email_outbox WHERE service_centre_id = $1
      ORDER BY id DESC LIMIT $2`,
    [centreId, limit],
  );
}

export type OutboxText = {
  id: number;
  recipient: string;
  body: string;
  status: "pending" | "sending" | "sent" | "failed" | "skipped";
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
};

export async function listWorkshopTexts(centreId: number, limit = 25): Promise<OutboxText[]> {
  return db.query<OutboxText>(
    `SELECT id, recipient, body, status, attempts, last_error, sent_at, created_at
       FROM sms_outbox WHERE service_centre_id = $1
      ORDER BY id DESC LIMIT $2`,
    [centreId, limit],
  );
}

export type AuditEntry = {
  id: number;
  admin_name: string | null;
  action: string;
  service_centre_id: number | null;
  centre_name: string | null;
  payment_plan_id: number | null;
  detail: string | null;
  created_at: string;
};

export async function listAuditLog(options: { centreId?: number; limit?: number } = {}): Promise<AuditEntry[]> {
  return db.query<AuditEntry>(
    `SELECT l.id, a.name AS admin_name, l.action, l.service_centre_id, sc.name AS centre_name,
            l.payment_plan_id, l.detail, l.created_at
       FROM admin_audit_log l
       LEFT JOIN admins a ON a.id = l.admin_id
       LEFT JOIN service_centres sc ON sc.id = l.service_centre_id
      WHERE $1::int IS NULL OR l.service_centre_id = $1
      ORDER BY l.id DESC
      LIMIT $2`,
    [options.centreId ?? null, options.limit ?? 20],
  );
}

export async function recordAudit(
  adminId: number,
  action: string,
  target: { centreId?: number | null; planId?: number | null; detail?: string | null },
  sql: Sql = db,
) {
  await sql.run(
    "INSERT INTO admin_audit_log (admin_id, action, service_centre_id, payment_plan_id, detail) VALUES ($1, $2, $3, $4, $5)",
    [adminId, action, target.centreId ?? null, target.planId ?? null, target.detail ?? null],
  );
}

export type JobRun = {
  id: number;
  trigger: "scheduler" | "admin";
  as_of: string | null;
  started_at: string;
  finished_at: string | null;
  // Runs recorded before reminders and texts existed have fewer fields.
  result: Partial<DebitRunSummary> | null;
  error: string | null;
};

export async function listDebitJobRuns(limit = 5): Promise<JobRun[]> {
  return db.query<JobRun>(
    `SELECT id, trigger, as_of, started_at, finished_at, result, error
       FROM job_runs WHERE job = 'debits'
      ORDER BY started_at DESC LIMIT $1`,
    [limit],
  );
}

export type AdminPlan = {
  plan: PaymentPlan;
  customer: Customer;
  centre: Pick<ServiceCentre, "id" | "name">;
};

export async function getPlanForAdmin(planId: number): Promise<AdminPlan | null> {
  if (!Number.isInteger(planId)) return null;
  const plan = await db.one<PaymentPlan>("SELECT * FROM payment_plans WHERE id = $1", [planId]);
  if (!plan) return null;
  const [customer, centre] = await Promise.all([
    db.one<Customer>("SELECT * FROM customers WHERE id = $1", [plan.customer_id]),
    db.one<AdminPlan["centre"]>("SELECT id, name FROM service_centres WHERE id = $1", [plan.service_centre_id]),
  ]);
  return { plan, customer: customer!, centre: centre! };
}

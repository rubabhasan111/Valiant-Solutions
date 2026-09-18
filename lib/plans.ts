import { randomBytes } from "node:crypto";
import { db, transaction, type Customer, type Instalment, type PaymentPlan, type ServiceCentre, type Sql } from "@/lib/db";
import { buildSchedule, todayInSydney, type Frequency } from "@/lib/schedule";

// Every function that takes a centreId filters by it, so one workshop can never read
// or change another workshop's customers or plans.

export type CustomerListItem = Customer & { plan_count: number };

export async function listCustomers(centreId: number): Promise<CustomerListItem[]> {
  return db.query<CustomerListItem>(
    `SELECT c.*, COUNT(p.id) AS plan_count
       FROM customers c
       LEFT JOIN payment_plans p ON p.customer_id = c.id
      WHERE c.service_centre_id = $1
      GROUP BY c.id
      ORDER BY lower(c.full_name), c.id`,
    [centreId],
  );
}

export async function getCustomer(centreId: number, customerId: number): Promise<Customer | undefined> {
  if (!Number.isInteger(customerId)) return undefined;
  return db.one<Customer>("SELECT * FROM customers WHERE id = $1 AND service_centre_id = $2", [customerId, centreId]);
}

export async function customerEmailExists(centreId: number, email: string): Promise<boolean> {
  return Boolean(await db.one("SELECT 1 FROM customers WHERE service_centre_id = $1 AND email = $2", [centreId, email]));
}

export type NewCustomer = {
  fullName: string;
  email: string;
  phone: string | null;
  vehicleRego: string | null;
};

export async function insertCustomer(centreId: number, customer: NewCustomer, sql: Sql = db): Promise<number> {
  const row = await sql.one<{ id: number }>(
    `INSERT INTO customers (service_centre_id, full_name, email, phone, vehicle_rego)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [centreId, customer.fullName, customer.email, customer.phone, customer.vehicleRego],
  );
  return row!.id;
}

export type PlanListItem = PaymentPlan & {
  customer_name: string;
  vehicle_rego: string | null;
  paid_cents: number;
  next_due_date: string | null;
};

export async function listPlans(centreId: number, limit = 200): Promise<PlanListItem[]> {
  return db.query<PlanListItem>(
    `SELECT p.*, c.full_name AS customer_name, c.vehicle_rego,
            COALESCE(SUM(i.amount_cents) FILTER (WHERE i.status = 'paid'), 0) AS paid_cents,
            MIN(CASE WHEN i.status = 'scheduled' THEN i.due_date
                     WHEN i.status = 'failed' THEN i.next_retry_on END) AS next_due_date
       FROM payment_plans p
       JOIN customers c ON c.id = p.customer_id
       LEFT JOIN instalments i ON i.payment_plan_id = p.id
      WHERE p.service_centre_id = $1
      GROUP BY p.id, c.id
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $2`,
    [centreId, limit],
  );
}

export type NewPlan = {
  description: string;
  totalCents: number;
  instalmentCount: number;
  frequency: Frequency;
  startDate: string;
};

// Creates the plan, its full instalment schedule and (optionally) a new customer in
// one transaction, so a failure never leaves a plan without instalments.
export async function createPlan(centreId: number, customer: { id: number } | NewCustomer, plan: NewPlan): Promise<number> {
  const schedule = buildSchedule(plan.totalCents, plan.instalmentCount, plan.frequency, plan.startDate);

  return transaction(async (tx) => {
    const customerId = "id" in customer ? customer.id : await insertCustomer(centreId, customer, tx);

    const created = await tx.one<{ id: number }>(
      `INSERT INTO payment_plans
         (service_centre_id, customer_id, description, total_amount_cents, instalment_count, frequency, start_date, setup_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        centreId,
        customerId,
        plan.description,
        plan.totalCents,
        plan.instalmentCount,
        plan.frequency,
        plan.startDate,
        randomBytes(24).toString("base64url"),
      ],
    );
    const planId = created!.id;

    await tx.run(
      `INSERT INTO instalments (payment_plan_id, sequence, amount_cents, due_date)
       SELECT $1, s.sequence, s.amount_cents, s.due_date
         FROM unnest($2::int[], $3::int[], $4::date[]) AS s(sequence, amount_cents, due_date)`,
      [
        planId,
        schedule.map((item) => item.sequence),
        schedule.map((item) => item.amountCents),
        schedule.map((item) => item.dueDate),
      ],
    );

    return planId;
  });
}

export type PlanDetail = {
  plan: PaymentPlan;
  customer: Customer;
  instalments: Instalment[];
};

async function loadPlanParts(plan: PaymentPlan | undefined): Promise<PlanDetail | null> {
  if (!plan) return null;
  const [customer, instalments] = await Promise.all([
    db.one<Customer>("SELECT * FROM customers WHERE id = $1", [plan.customer_id]),
    db.query<Instalment>("SELECT * FROM instalments WHERE payment_plan_id = $1 ORDER BY sequence", [plan.id]),
  ]);
  return { plan, customer: customer!, instalments };
}

export async function getPlanDetail(centreId: number, planId: number): Promise<PlanDetail | null> {
  if (!Number.isInteger(planId)) return null;
  const plan = await db.one<PaymentPlan>("SELECT * FROM payment_plans WHERE id = $1 AND service_centre_id = $2", [
    planId,
    centreId,
  ]);
  return loadPlanParts(plan);
}

export type PublicPlan = PlanDetail & {
  centre: Pick<ServiceCentre, "id" | "name" | "phone" | "stripe_account_id" | "charges_enabled" | "becs_capability">;
};

// Looks up a plan by the token in the customer's setup link. The token is the only
// credential on that page, so it's long, random and never guessable from the plan ID.
export async function getPlanByToken(token: string): Promise<PublicPlan | null> {
  if (!/^[\w-]{32}$/.test(token)) return null;
  const detail = await loadPlanParts(
    await db.one<PaymentPlan>("SELECT * FROM payment_plans WHERE setup_token = $1", [token]),
  );
  if (!detail) return null;

  const centre = await db.one<PublicPlan["centre"]>(
    "SELECT id, name, phone, stripe_account_id, charges_enabled, becs_capability FROM service_centres WHERE id = $1",
    [detail.plan.service_centre_id],
  );
  return { ...detail, centre: centre! };
}

export async function saveStripeCustomerId(customerId: number, stripeCustomerId: string) {
  await db.run("UPDATE customers SET stripe_customer_id = $1 WHERE id = $2", [stripeCustomerId, customerId]);
}

export async function saveCheckoutSession(planId: number, sessionId: string) {
  await db.run("UPDATE payment_plans SET checkout_session_id = $1 WHERE id = $2", [sessionId, planId]);
}

// Activates a new plan, or resumes a paused one once the customer has added bank details
// that can be debited. Returns null if the plan was neither waiting nor paused.
export async function activatePlan(
  planId: number,
  paymentMethodId: string,
  mandateId: string | null,
): Promise<"activated" | "resumed" | null> {
  return transaction(async (tx) => {
    // The row lock makes the Checkout redirect and the webhook take turns.
    const plan = await tx.one<{ status: PaymentPlan["status"] }>(
      "SELECT status FROM payment_plans WHERE id = $1 FOR UPDATE",
      [planId],
    );
    if (!plan || (plan.status !== "draft" && plan.status !== "failed")) return null;

    await tx.run(
      `UPDATE payment_plans
          SET status = 'active', stripe_payment_method_id = $1, stripe_mandate_id = $2, failure_reason = NULL,
              activated_at = COALESCE(activated_at, now())
        WHERE id = $3`,
      [paymentMethodId, mandateId, planId],
    );

    if (plan.status === "draft") return "activated";

    // Collect every failed payment on the next run using the new bank details.
    await tx.run("UPDATE instalments SET next_retry_on = $1 WHERE payment_plan_id = $2 AND status = 'failed'", [
      todayInSydney(),
      planId,
    ]);
    return "resumed";
  });
}

import { db, type Instalment, type PaymentPlan } from "@/lib/db";

// Everything a signed-in customer can see. Every query filters on their email address, so
// one customer can never read another's plans, and workshops' own data stays out of reach.

export type CustomerPlan = Pick<
  PaymentPlan,
  "id" | "description" | "total_amount_cents" | "instalment_count" | "frequency" | "status" | "setup_token"
> & {
  centre_name: string;
  centre_phone: string | null;
  paid_cents: number;
  next_due_date: string | null;
  next_amount_cents: number | null;
};

export async function listCustomerPlans(email: string): Promise<CustomerPlan[]> {
  return db.query<CustomerPlan>(
    `SELECT p.id, p.description, p.total_amount_cents, p.instalment_count, p.frequency, p.status, p.setup_token,
            sc.name AS centre_name, sc.phone AS centre_phone,
            COALESCE(SUM(i.amount_cents) FILTER (WHERE i.status = 'paid'), 0) AS paid_cents,
            MIN(i.due_date) FILTER (WHERE i.status IN ('scheduled', 'failed')) AS next_due_date,
            (SELECT amount_cents FROM instalments
              WHERE payment_plan_id = p.id AND status IN ('scheduled', 'failed')
              ORDER BY due_date, sequence LIMIT 1) AS next_amount_cents
       FROM payment_plans p
       JOIN customers c ON c.id = p.customer_id
       JOIN service_centres sc ON sc.id = p.service_centre_id
       LEFT JOIN instalments i ON i.payment_plan_id = p.id
      WHERE c.email = $1
      GROUP BY p.id, sc.id
      ORDER BY
        CASE p.status WHEN 'failed' THEN 0 WHEN 'draft' THEN 1 WHEN 'active' THEN 2 ELSE 3 END,
        p.created_at DESC`,
    [email],
  );
}

export type CustomerPlanDetail = {
  plan: CustomerPlan & { failure_reason: string | null };
  instalments: Instalment[];
};

export async function getCustomerPlan(email: string, planId: number): Promise<CustomerPlanDetail | null> {
  if (!Number.isInteger(planId)) return null;

  const plan = await db.one<CustomerPlan & { failure_reason: string | null }>(
    `SELECT p.id, p.description, p.total_amount_cents, p.instalment_count, p.frequency, p.status, p.setup_token,
            p.failure_reason, sc.name AS centre_name, sc.phone AS centre_phone,
            COALESCE(SUM(i.amount_cents) FILTER (WHERE i.status = 'paid'), 0) AS paid_cents,
            MIN(i.due_date) FILTER (WHERE i.status IN ('scheduled', 'failed')) AS next_due_date,
            (SELECT amount_cents FROM instalments
              WHERE payment_plan_id = p.id AND status IN ('scheduled', 'failed')
              ORDER BY due_date, sequence LIMIT 1) AS next_amount_cents
       FROM payment_plans p
       JOIN customers c ON c.id = p.customer_id
       JOIN service_centres sc ON sc.id = p.service_centre_id
       LEFT JOIN instalments i ON i.payment_plan_id = p.id
      WHERE p.id = $1 AND c.email = $2
      GROUP BY p.id, sc.id`,
    [planId, email],
  );
  if (!plan) return null;

  const instalments = await db.query<Instalment>(
    "SELECT * FROM instalments WHERE payment_plan_id = $1 ORDER BY sequence",
    [plan.id],
  );
  return { plan, instalments };
}

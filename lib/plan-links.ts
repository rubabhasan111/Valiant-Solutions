import { randomUUID } from "node:crypto";
import { db, type PaymentPlan } from "@/lib/db";
import { queueCustomerEmail, queueCustomerSms } from "@/lib/notifications";
import { normaliseAuMobile } from "@/lib/phone";
import { planLinkMessages } from "@/lib/plan-messages";
import type { Frequency } from "@/lib/schedule";
import { appUrl } from "@/lib/stripe";

export type PlanLinkResult = { emailKey: string; smsKey: string | null };

// Sends the customer their private plan link, by email and, if they have a mobile, by text.
// Only for plans waiting on bank details: new plans, and plans paused because the bank
// account couldn't be debited. Returns null for any other plan.
export async function queuePlanLink(planId: number, reason: "created" | "resent"): Promise<PlanLinkResult | null> {
  const plan = await db.one<{
    status: PaymentPlan["status"];
    description: string;
    total_amount_cents: number;
    instalment_count: number;
    frequency: Frequency;
    setup_token: string;
    full_name: string;
    email: string;
    phone: string | null;
    centre_id: number;
    centre_name: string;
    centre_phone: string | null;
    first_due: string;
    first_amount: number;
  }>(
    `SELECT p.status, p.description, p.total_amount_cents, p.instalment_count, p.frequency, p.setup_token,
            c.full_name, c.email, c.phone,
            sc.id AS centre_id, sc.name AS centre_name, sc.phone AS centre_phone,
            first.due_date AS first_due, first.amount_cents AS first_amount
       FROM payment_plans p
       JOIN customers c ON c.id = p.customer_id
       JOIN service_centres sc ON sc.id = p.service_centre_id
       JOIN LATERAL (
         SELECT due_date, amount_cents FROM instalments
          WHERE payment_plan_id = p.id ORDER BY sequence LIMIT 1
       ) first ON true
      WHERE p.id = $1`,
    [planId],
  );
  if (!plan || (plan.status !== "draft" && plan.status !== "failed")) return null;

  const mobile = plan.phone ? normaliseAuMobile(plan.phone) : null;
  const messages = planLinkMessages({
    centreName: plan.centre_name,
    centrePhone: plan.centre_phone,
    customerName: plan.full_name,
    description: plan.description,
    link: `${appUrl()}/pay/${plan.setup_token}`,
    totalCents: plan.total_amount_cents,
    instalmentCount: plan.instalment_count,
    frequency: plan.frequency,
    firstDueDate: plan.first_due,
    firstAmountCents: plan.first_amount,
    paused: plan.status === "failed",
    hasMobile: Boolean(mobile),
  });

  // A plan's first link is sent once; each resend is its own message.
  const key = `plan_link:${planId}:${reason === "created" ? "created" : `resent:${randomUUID()}`}`;
  await queueCustomerEmail(plan.centre_id, { to: plan.email, ...messages.email }, `${key}:email`);
  const texted = mobile ? await queueCustomerSms(plan.centre_id, { to: mobile, body: messages.sms }, `${key}:sms`) : false;
  return { emailKey: `${key}:email`, smsKey: texted ? `${key}:sms` : null };
}

export type PlanLinkDelivery = {
  channel: "email" | "sms";
  recipient: string;
  status: "pending" | "sending" | "sent" | "failed" | "skipped";
  created_at: string;
};

// The latest plan-link email and text for a plan, shown on the plan page.
export async function latestPlanLinkDeliveries(planId: number): Promise<PlanLinkDelivery[]> {
  const pattern = `plan_link:${planId}:%`;
  return db.query<PlanLinkDelivery>(
    `(SELECT 'email' AS channel, recipient, status, created_at FROM email_outbox
       WHERE dedupe_key LIKE $1 ORDER BY id DESC LIMIT 1)
     UNION ALL
     (SELECT 'sms' AS channel, recipient, status, created_at FROM sms_outbox
       WHERE dedupe_key LIKE $1 ORDER BY id DESC LIMIT 1)`,
    [pattern],
  );
}

// Stops a double-click, or an impatient workshop, from sending the same link repeatedly.
export async function planLinkSentWithin(planId: number, seconds: number): Promise<boolean> {
  const row = await db.one(
    "SELECT 1 FROM email_outbox WHERE dedupe_key LIKE $1 AND created_at > now() - make_interval(secs => $2)",
    [`plan_link:${planId}:%`, seconds],
  );
  return Boolean(row);
}

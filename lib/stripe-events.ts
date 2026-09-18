import type Stripe from "stripe";
import { completeBankSetup } from "@/lib/bank-setup";
import { db } from "@/lib/db";
import { applyPaymentIntent } from "@/lib/debits";
import { notify } from "@/lib/notifications";
import { directDebitCancelledSms } from "@/lib/plan-messages";
import { getPlanByToken } from "@/lib/plans";
import { appUrl, getStripe } from "@/lib/stripe";

// Returns false when the event was already recorded, so redeliveries are skipped.
export async function recordEvent(event: Stripe.Event): Promise<boolean> {
  const inserted = await db.run(
    "INSERT INTO stripe_events (id, type, account) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
    [event.id, event.type, event.account ?? null],
  );
  return inserted === 1;
}

// Called when handling throws, so Stripe's automatic retry processes the event again.
export async function forgetEvent(eventId: string) {
  await db.run("DELETE FROM stripe_events WHERE id = $1", [eventId]);
}

// A customer cancelled their direct debit (usually through their bank). Pause the plan
// and ask them to set up a new one, without the workshop having to step in.
async function applyMandate(mandate: Stripe.Mandate, accountId: string) {
  if (mandate.status !== "inactive") return;

  const plans = await db.query<{
    id: number;
    description: string;
    setup_token: string;
    centre_id: number;
    centre_name: string;
    centre_phone: string | null;
    full_name: string;
    email: string;
    phone: string | null;
  }>(
    `SELECT p.id, p.description, p.setup_token, sc.id AS centre_id, sc.name AS centre_name, sc.phone AS centre_phone,
            c.full_name, c.email, c.phone
       FROM payment_plans p
       JOIN service_centres sc ON sc.id = p.service_centre_id
       JOIN customers c ON c.id = p.customer_id
      WHERE p.stripe_mandate_id = $1 AND p.status = 'active' AND sc.stripe_account_id = $2`,
    [mandate.id, accountId],
  );

  for (const plan of plans) {
    const name = plan.full_name.split(" ")[0];
    await db.run("UPDATE payment_plans SET status = 'failed', failure_reason = $1 WHERE id = $2 AND status = 'active'", [
      "The customer cancelled their direct debit authority.",
      plan.id,
    ]);
    await notify({
      centreId: plan.centre_id,
      planId: plan.id,
      kind: "bank_details_needed",
      title: `${plan.full_name} cancelled their direct debit`,
      body: `Debits on ${plan.description} are paused, and ${name} has been emailed a link to set up a new direct debit. Missed payments are collected automatically once they do.`,
      dedupeKey: `mandate_inactive:${plan.id}:${mandate.id}`,
      emailWorkshop: true,
      customerEmail: {
        to: plan.email,
        subject: `Your direct debit with ${plan.centre_name} was cancelled`,
        text: `Hi ${name},\n\nYour direct debit authority for ${plan.description} has been cancelled, so ${plan.centre_name} can't collect your remaining payments.\n\nIf that wasn't intended, you can set up a new direct debit here:\n${appUrl()}/pay/${plan.setup_token}\n\n${plan.centre_name}`,
      },
      customerSms: {
        to: plan.phone,
        body: directDebitCancelledSms({
          centreName: plan.centre_name,
          centrePhone: plan.centre_phone,
          customerName: plan.full_name,
          description: plan.description,
          link: `${appUrl()}/pay/${plan.setup_token}`,
        }),
      },
    });
  }
}

async function applyAccountUpdate(account: Stripe.Account) {
  await db.run(
    `UPDATE service_centres
        SET details_submitted = $1, charges_enabled = $2, payouts_enabled = $3, becs_capability = $4,
            updated_at = now()
      WHERE stripe_account_id = $5`,
    [
      Boolean(account.details_submitted),
      Boolean(account.charges_enabled),
      Boolean(account.payouts_enabled),
      account.capabilities?.au_becs_debit_payments ?? null,
      account.id,
    ],
  );
}

// Backup for the Checkout redirect: activates or resumes the plan even if the customer
// closes the browser before Stripe sends them back.
async function activateFromCheckout(session: Stripe.Checkout.Session, accountId: string) {
  const planId = Number(session.metadata?.halfshaft_plan_id);
  if (session.mode !== "setup" || !Number.isInteger(planId)) return;

  const row = await db.one<{ setup_token: string }>(
    `SELECT p.setup_token
       FROM payment_plans p
       JOIN service_centres sc ON sc.id = p.service_centre_id
      WHERE p.id = $1 AND p.status IN ('draft', 'failed') AND sc.stripe_account_id = $2`,
    [planId, accountId],
  );
  const plan = row && (await getPlanByToken(row.setup_token));
  if (plan) await completeBankSetup(plan, session.id);
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  // Plans, mandates and debits all live on connected accounts; platform-level events
  // for those objects aren't ours.
  const accountId = event.account;

  switch (event.type) {
    case "payment_intent.processing":
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      if (!accountId) return;
      // Re-read the PaymentIntent so a late or out-of-order event can't roll a debit back.
      const pi = await getStripe().paymentIntents.retrieve(event.data.object.id, {}, { stripeAccount: accountId });
      await applyPaymentIntent(pi, accountId);
      return;
    }
    case "mandate.updated":
      if (accountId) await applyMandate(event.data.object, accountId);
      return;
    case "checkout.session.completed":
      if (accountId) await activateFromCheckout(event.data.object, accountId);
      return;
    case "account.updated":
      await applyAccountUpdate(event.data.object);
      return;
    default:
      return;
  }
}

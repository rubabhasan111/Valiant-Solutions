import type Stripe from "stripe";
import { formatAud } from "@/lib/money";
import { notify } from "@/lib/notifications";
import { activatePlan, saveCheckoutSession, saveStripeCustomerId, type PublicPlan } from "@/lib/plans";
import { FREQUENCY_LABEL, formatDate } from "@/lib/schedule";
import { appUrl, getStripe } from "@/lib/stripe";

// Plans use direct charges: the Stripe customer, the BECS mandate and every debit live
// on the workshop's connected account, so the workshop is the merchant of record.

export async function createBankSetupSession({ plan, customer, centre }: PublicPlan): Promise<string> {
  if (!centre.stripe_account_id) throw new Error(`Centre ${centre.id} has no Stripe account`);
  const stripe = getStripe();
  const stripeAccount = centre.stripe_account_id;

  let stripeCustomerId = customer.stripe_customer_id;
  if (!stripeCustomerId) {
    const created = await stripe.customers.create(
      {
        name: customer.full_name,
        email: customer.email,
        phone: customer.phone ?? undefined,
        metadata: { halfshaft_customer_id: String(customer.id) },
      },
      // A double-click must not create two Stripe customers for the same person.
      { stripeAccount, idempotencyKey: `halfshaft-customer-${customer.id}` },
    );
    stripeCustomerId = created.id;
    await saveStripeCustomerId(customer.id, stripeCustomerId);
  }

  const setupLink = `${appUrl()}/pay/${plan.setup_token}`;
  const session = await stripe.checkout.sessions.create(
    {
      mode: "setup",
      currency: "aud",
      customer: stripeCustomerId,
      payment_method_types: ["au_becs_debit"],
      success_url: `${setupLink}/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${setupLink}?setup=cancelled`,
      metadata: { halfshaft_plan_id: String(plan.id) },
      setup_intent_data: {
        description: `${centre.name}: ${plan.description}`,
        metadata: { halfshaft_plan_id: String(plan.id) },
      },
    },
    { stripeAccount },
  );

  await saveCheckoutSession(plan.id, session.id);
  if (!session.url) throw new Error(`Checkout Session ${session.id} has no URL`);
  return session.url;
}

// Called when Stripe sends the customer back (or from the checkout.session.completed
// webhook). The session ID is only a pointer: the session is re-read from Stripe and
// must belong to this plan and be finished before the plan is activated or resumed.
export async function completeBankSetup(data: PublicPlan, sessionId: string): Promise<boolean> {
  const { plan, customer, centre, instalments } = data;
  if (!centre.stripe_account_id || !/^cs_(test|live)_\w+$/.test(sessionId)) return false;

  const session = await getStripe().checkout.sessions.retrieve(
    sessionId,
    { expand: ["setup_intent"] },
    { stripeAccount: centre.stripe_account_id },
  );
  const setupIntent = session.setup_intent as Stripe.SetupIntent | null;

  if (
    session.metadata?.halfshaft_plan_id !== String(plan.id) ||
    session.status !== "complete" ||
    setupIntent?.status !== "succeeded"
  ) {
    return false;
  }

  const paymentMethodId =
    typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : setupIntent.payment_method?.id;
  const mandateId = typeof setupIntent.mandate === "string" ? setupIntent.mandate : setupIntent.mandate?.id;
  if (!paymentMethodId) return false;

  const outcome = await activatePlan(plan.id, paymentMethodId, mandateId ?? null);

  if (outcome === "activated") {
    await notify({
      centreId: centre.id,
      planId: plan.id,
      kind: "plan_activated",
      title: `${customer.full_name} set up their direct debit`,
      body: `${plan.description}: ${plan.instalment_count} ${FREQUENCY_LABEL[plan.frequency].toLowerCase()} payments of about ${formatAud(instalments[instalments.length - 1].amount_cents)}, starting ${formatDate(instalments[0].due_date)}.`,
      dedupeKey: `plan_activated:${plan.id}`,
    });
  } else if (outcome === "resumed") {
    await notify({
      centreId: centre.id,
      planId: plan.id,
      kind: "bank_details_updated",
      title: `${customer.full_name} updated their bank details`,
      body: `Debits on ${plan.description} have resumed. Any failed payments will be collected on the next run.`,
      dedupeKey: `bank_details_updated:${plan.id}:${paymentMethodId}`,
      emailWorkshop: true,
    });
  }

  return true;
}

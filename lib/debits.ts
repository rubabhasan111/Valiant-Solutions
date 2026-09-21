import Stripe from "stripe";
import { db, transaction, type InstalmentStatus, type PlanStatus } from "@/lib/db";
import { formatAud } from "@/lib/money";
import { notify, queueCustomerEmail } from "@/lib/notifications";
import { bankDetailsNeededSms, paidOffEmail, paymentFailedSms, receiptEmail } from "@/lib/plan-messages";
import { NEEDS_NEW_BANK_DETAILS, RETRY_DELAY_DAYS } from "@/lib/retry-policy";
import { addDays, formatRetryDay, todayInSydney } from "@/lib/schedule";
import { appUrl, getStripe } from "@/lib/stripe";

// The debit engine. Each due instalment becomes one BECS PaymentIntent on the workshop's own
// Stripe account, using the customer's saved payment method and mandate, so money goes
// straight from the customer's bank account to the workshop. Halfshaft takes no fee, and
// Stripe charges its own fees to the workshop. Failed debits are retried automatically
// until they're paid.

type InstalmentContext = {
  instalment_id: number;
  sequence: number;
  amount_cents: number;
  status: InstalmentStatus;
  attempt_count: number;
  next_retry_on: string | null;
  stripe_payment_intent_id: string | null;
  plan_id: number;
  plan_status: PlanStatus;
  description: string;
  instalment_count: number;
  total_amount_cents: number;
  setup_token: string;
  stripe_payment_method_id: string | null;
  stripe_mandate_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  stripe_customer_id: string | null;
  centre_id: number;
  centre_name: string;
  centre_phone: string | null;
  stripe_account_id: string | null;
};

const CONTEXT_SELECT = `
  SELECT i.id AS instalment_id, i.sequence, i.amount_cents, i.status, i.attempt_count,
         i.next_retry_on, i.stripe_payment_intent_id,
         p.id AS plan_id, p.status AS plan_status, p.description, p.instalment_count, p.total_amount_cents, p.setup_token,
         p.stripe_payment_method_id, p.stripe_mandate_id,
         c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, c.stripe_customer_id,
         sc.id AS centre_id, sc.name AS centre_name, sc.phone AS centre_phone, sc.stripe_account_id
    FROM instalments i
    JOIN payment_plans p ON p.id = i.payment_plan_id
    JOIN customers c ON c.id = p.customer_id
    JOIN service_centres sc ON sc.id = p.service_centre_id`;

export type DebitResult = "processing" | "paid" | "failed" | "retry_later" | "skipped";

export type DebitOutcome = {
  instalmentId: number;
  planId: number;
  result: DebitResult;
  paymentIntentId?: string;
  message?: string;
};

function loadContext(instalmentId: number): Promise<InstalmentContext | undefined> {
  return db.one<InstalmentContext>(`${CONTEXT_SELECT} WHERE i.id = $1`, [instalmentId]);
}

const firstName = (fullName: string) => fullName.split(" ")[0];
const asSentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);
const paymentLabel = (ctx: InstalmentContext) =>
  `Payment ${ctx.sequence} of ${ctx.instalment_count} (${formatAud(ctx.amount_cents)})`;
const planLink = (ctx: InstalmentContext) => `${appUrl()}/pay/${ctx.setup_token}`;
// What every customer message needs to know about who is asking and what for.
const sender = (ctx: InstalmentContext) => ({
  centreName: ctx.centre_name,
  centrePhone: ctx.centre_phone,
  customerName: ctx.customer_name,
  description: ctx.description,
  link: planLink(ctx),
});

function failureMessage(pi: Stripe.PaymentIntent): string {
  if (pi.last_payment_error?.message) return pi.last_payment_error.message;
  return pi.status === "canceled" ? "The debit was cancelled." : "The bank didn't accept the debit.";
}

async function markProcessing(ctx: InstalmentContext, paymentIntentId: string) {
  await db.run("UPDATE instalments SET status = 'processing', stripe_payment_intent_id = $1 WHERE id = $2", [
    paymentIntentId,
    ctx.instalment_id,
  ]);

  // The workshop hears about an instalment's first attempt; automatic retries stay quiet.
  if (ctx.attempt_count > 1) return;
  await notify({
    centreId: ctx.centre_id,
    planId: ctx.plan_id,
    instalmentId: ctx.instalment_id,
    kind: "debit_processing",
    title: `Debit processing for ${ctx.customer_name}`,
    body: `${paymentLabel(ctx)} for ${ctx.description} is being collected. BECS payments take a few business days to clear.`,
    dedupeKey: `debit_processing:${ctx.instalment_id}`,
  });
}

async function markPaid(ctx: InstalmentContext, paymentIntentId: string) {
  await db.run(
    `UPDATE instalments
        SET status = 'paid', stripe_payment_intent_id = $1, paid_at = now(),
            failure_reason = NULL, failure_code = NULL, next_retry_on = NULL
      WHERE id = $2`,
    [paymentIntentId, ctx.instalment_id],
  );

  // Completed first: a plan that has just been paid off gets the "paid off" email rather
  // than a receipt for the last payment. A plan on hold can still finish this way, when a
  // debit started before the hold clears.
  const completed = await db.run(
    `UPDATE payment_plans SET status = 'completed'
      WHERE id = $1 AND status IN ('active', 'paused', 'failed')
        AND NOT EXISTS (SELECT 1 FROM instalments WHERE payment_plan_id = $1 AND status != 'paid')`,
    [ctx.plan_id],
  );

  const [progress, next] = await Promise.all([
    db.one<{ paid_cents: number }>(
      "SELECT COALESCE(SUM(amount_cents), 0) AS paid_cents FROM instalments WHERE payment_plan_id = $1 AND status = 'paid'",
      [ctx.plan_id],
    ),
    completed
      ? Promise.resolve(undefined)
      : db.one<{ amount_cents: number; due_date: string }>(
          `SELECT amount_cents, due_date FROM instalments
            WHERE payment_plan_id = $1 AND status IN ('scheduled', 'failed')
            ORDER BY due_date, sequence
            LIMIT 1`,
          [ctx.plan_id],
        ),
  ]);

  await notify({
    centreId: ctx.centre_id,
    planId: ctx.plan_id,
    instalmentId: ctx.instalment_id,
    kind: "debit_paid",
    title: `Payment received from ${ctx.customer_name}`,
    body: `${paymentLabel(ctx)} for ${ctx.description} has cleared into your Stripe account.`,
    dedupeKey: `debit_paid:${ctx.instalment_id}`,
    customerEmail: completed
      ? undefined
      : {
          to: ctx.customer_email,
          ...receiptEmail({
            ...sender(ctx),
            sequence: ctx.sequence,
            instalmentCount: ctx.instalment_count,
            amountCents: ctx.amount_cents,
            paidCents: progress?.paid_cents ?? ctx.amount_cents,
            totalCents: ctx.total_amount_cents,
            next: next ? { amountCents: next.amount_cents, dueDate: next.due_date } : null,
          }),
        },
  });

  if (completed) {
    await notify({
      centreId: ctx.centre_id,
      planId: ctx.plan_id,
      kind: "plan_completed",
      title: `${ctx.customer_name}'s plan is paid off`,
      body: `All ${ctx.instalment_count} payments (${formatAud(ctx.total_amount_cents)}) for ${ctx.description} have been collected.`,
      dedupeKey: `plan_completed:${ctx.plan_id}`,
      emailWorkshop: true,
      customerEmail: {
        to: ctx.customer_email,
        ...paidOffEmail({
          ...sender(ctx),
          instalmentCount: ctx.instalment_count,
          totalCents: ctx.total_amount_cents,
          final: "Your final payment has cleared.",
        }),
      },
    });
  }
}

type Failure = { paymentIntentId: string | null; message: string; code: string | null };

const RECORD_FAILURE = `
  UPDATE instalments
     SET status = 'failed', stripe_payment_intent_id = COALESCE($1, stripe_payment_intent_id),
         failure_reason = $2, failure_code = $3, next_retry_on = $4
   WHERE id = $5`;

// After a failed debit, either pause the plan and ask the customer for new bank details,
// or retry on the next run. Retries have no limit, so nobody has to chase the payment.
async function markFailed(ctx: InstalmentContext, failure: Failure) {
  const reason = asSentence(failure.message);
  const name = firstName(ctx.customer_name);

  // A debit that started before the plan was put on hold or cancelled. Nothing is retried:
  // a held plan collects it when it resumes, and a cancelled plan never does.
  if (ctx.plan_status === "paused" || ctx.plan_status === "cancelled") {
    await db.run(RECORD_FAILURE, [failure.paymentIntentId, reason, failure.code, null, ctx.instalment_id]);
    await notify({
      centreId: ctx.centre_id,
      planId: ctx.plan_id,
      instalmentId: ctx.instalment_id,
      kind: "debit_failed",
      title: `Debit failed for ${ctx.customer_name}`,
      body: `${paymentLabel(ctx)} failed. ${reason} ${
        ctx.plan_status === "paused"
          ? "The plan is on hold, so it will be collected again when you resume it."
          : "The plan is cancelled, so it won't be collected again."
      }`,
      dedupeKey: `debit_failed:${ctx.instalment_id}:${ctx.attempt_count}`,
    });
    return;
  }

  if (failure.code && NEEDS_NEW_BANK_DETAILS.has(failure.code)) {
    await transaction(async (tx) => {
      await tx.run(RECORD_FAILURE, [failure.paymentIntentId, reason, failure.code, null, ctx.instalment_id]);
      await tx.run("UPDATE payment_plans SET status = 'failed', failure_reason = $1 WHERE id = $2 AND status = 'active'", [
        `The customer's bank account can't be debited. ${reason}`,
        ctx.plan_id,
      ]);
    });

    await notify({
      centreId: ctx.centre_id,
      planId: ctx.plan_id,
      instalmentId: ctx.instalment_id,
      kind: "bank_details_needed",
      title: `${ctx.customer_name} needs to update their bank details`,
      body: `${paymentLabel(ctx)} couldn't be debited. ${reason} Debits are paused until ${name} adds new bank details, and they've been emailed a link. Missed payments are collected automatically once they do.`,
      dedupeKey: `debit_failure:${ctx.instalment_id}:${ctx.attempt_count}`,
      emailWorkshop: true,
      customerEmail: {
        to: ctx.customer_email,
        subject: `Please update your bank details for ${ctx.centre_name}`,
        text: `Hi ${name},\n\n${paymentLabel(ctx)} for ${ctx.description} couldn't be taken from your bank account. ${reason}\n\nYour payments are paused until you add bank details that can be debited. It only takes a minute:\n${planLink(ctx)}\n\nAny missed payment will be collected once your new details are set up.\n\n${ctx.centre_name}`,
      },
      customerSms: {
        to: ctx.customer_phone,
        body: bankDetailsNeededSms({ ...sender(ctx), amountCents: ctx.amount_cents }),
      },
    });
    return;
  }

  const retryOn = addDays(todayInSydney(), RETRY_DELAY_DAYS);
  await db.run(RECORD_FAILURE, [failure.paymentIntentId, reason, failure.code, retryOn, ctx.instalment_id]);

  const customerEmail = {
    to: ctx.customer_email,
    subject: `Your payment to ${ctx.centre_name} didn't go through`,
    text: `Hi ${name},\n\n${paymentLabel(ctx)} for ${ctx.description} couldn't be taken from your bank account. ${reason}\n\nWe'll try again automatically ${formatRetryDay(retryOn)}, so please make sure the funds are in your account as soon as possible.\n\nView your plan: ${planLink(ctx)}\n\n${ctx.centre_name}`,
  };

  // The workshop is told once per instalment; every failed attempt still emails the customer.
  const toldWorkshop = await notify({
    centreId: ctx.centre_id,
    planId: ctx.plan_id,
    instalmentId: ctx.instalment_id,
    kind: "debit_failed",
    title: `Debit failed for ${ctx.customer_name}`,
    body: `${paymentLabel(ctx)} failed. ${reason} It's retried automatically until it's paid, starting ${formatRetryDay(retryOn)}, and ${name} has been emailed. You'll get an update when it clears.`,
    dedupeKey: `debit_failed:${ctx.instalment_id}`,
    emailWorkshop: true,
    customerEmail,
    // Only the first failure is texted; later retries email the customer instead.
    customerSms: {
      to: ctx.customer_phone,
      body: paymentFailedSms({ ...sender(ctx), amountCents: ctx.amount_cents, retryText: formatRetryDay(retryOn) }),
    },
  });
  if (!toldWorkshop) {
    await queueCustomerEmail(ctx.centre_id, customerEmail, `debit_failure:${ctx.instalment_id}:${ctx.attempt_count}:customer`);
  }
}

// Applies a PaymentIntent's current state to its instalment. Shared by the webhook and
// the reconciliation pass. Callers pass a PaymentIntent freshly read from Stripe, so a
// late or out-of-order event can't roll a debit backwards, and each transition only
// happens once, so notifications aren't doubled.
export async function applyPaymentIntent(
  pi: Stripe.PaymentIntent,
  stripeAccountId: string | null,
): Promise<InstalmentStatus | null> {
  const instalmentId = Number(pi.metadata?.halfshaft_instalment_id);
  const attempt = Number(pi.metadata?.halfshaft_attempt);
  if (!Number.isInteger(instalmentId) || !stripeAccountId) return null;

  const ctx = await loadContext(instalmentId);
  if (!ctx || ctx.stripe_account_id !== stripeAccountId) return null;
  // A retry creates a new PaymentIntent; ignore anything from an earlier attempt.
  if (attempt !== ctx.attempt_count) return null;
  if (ctx.stripe_payment_intent_id && ctx.stripe_payment_intent_id !== pi.id) return null;
  if (ctx.status === "paid") return "paid";

  switch (pi.status) {
    case "succeeded":
      await markPaid(ctx, pi.id);
      return "paid";
    case "processing":
      // A failed attempt never goes back to processing; a retry is a new attempt.
      if (ctx.status === "failed") return "failed";
      if (ctx.status !== "processing" || !ctx.stripe_payment_intent_id) await markProcessing(ctx, pi.id);
      return "processing";
    case "requires_payment_method":
    case "canceled":
      if (ctx.status !== "failed") {
        await markFailed(ctx, {
          paymentIntentId: pi.id,
          message: failureMessage(pi),
          code: pi.last_payment_error?.decline_code ?? pi.last_payment_error?.code ?? null,
        });
      }
      return "failed";
    default:
      return ctx.status;
  }
}

async function chargeInstalment(ctx: InstalmentContext): Promise<DebitOutcome> {
  const base = { instalmentId: ctx.instalment_id, planId: ctx.plan_id };
  const attempt = ctx.attempt_count + 1;

  // Claim the instalment before calling Stripe so overlapping runs can't debit it twice.
  const claimed = await db.run(
    `UPDATE instalments
        SET status = 'processing', attempt_count = $1, last_attempt_at = now(),
            stripe_payment_intent_id = NULL, next_retry_on = NULL
      WHERE id = $2 AND status IN ('scheduled', 'failed')`,
    [attempt, ctx.instalment_id],
  );
  if (claimed === 0) return { ...base, result: "skipped" };
  const claimedCtx: InstalmentContext = { ...ctx, status: "processing", attempt_count: attempt, stripe_payment_intent_id: null };

  if (!ctx.stripe_account_id || !ctx.stripe_customer_id || !ctx.stripe_payment_method_id) {
    await markFailed(claimedCtx, { paymentIntentId: null, message: "This plan has no bank details on file.", code: "no_payment_method" });
    return { ...base, result: "failed" };
  }

  try {
    const pi = await getStripe().paymentIntents.create(
      {
        amount: ctx.amount_cents,
        currency: "aud",
        customer: ctx.stripe_customer_id,
        payment_method: ctx.stripe_payment_method_id,
        mandate: ctx.stripe_mandate_id ?? undefined,
        payment_method_types: ["au_becs_debit"],
        confirm: true,
        off_session: true,
        description: `${ctx.centre_name}: ${ctx.description} (payment ${ctx.sequence} of ${ctx.instalment_count})`,
        metadata: {
          halfshaft_plan_id: String(ctx.plan_id),
          halfshaft_instalment_id: String(ctx.instalment_id),
          halfshaft_attempt: String(attempt),
        },
      },
      { stripeAccount: ctx.stripe_account_id, idempotencyKey: `halfshaft-instalment-${ctx.instalment_id}-attempt-${attempt}` },
    );
    const status = await applyPaymentIntent(pi, ctx.stripe_account_id);
    return { ...base, result: status === "paid" || status === "failed" ? status : "processing", paymentIntentId: pi.id };
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError && err.payment_intent) {
      // Stripe created the PaymentIntent but it failed straight away.
      const status = await applyPaymentIntent(err.payment_intent, ctx.stripe_account_id);
      return {
        ...base,
        result: status === "failed" ? "failed" : "processing",
        paymentIntentId: err.payment_intent.id,
        message: err.message,
      };
    }

    if (
      err instanceof Stripe.errors.StripeConnectionError ||
      err instanceof Stripe.errors.StripeAPIError ||
      err instanceof Stripe.errors.StripeRateLimitError
    ) {
      // It's unclear whether Stripe received the request. Restore the previous state
      // with the same attempt number: the next run reuses the idempotency key, so Stripe
      // returns the original PaymentIntent instead of debiting again. Idempotency keys
      // last 24 hours, so the job must run more often than that.
      await db.run("UPDATE instalments SET status = $1, attempt_count = $2, next_retry_on = $3 WHERE id = $4", [
        ctx.status,
        ctx.attempt_count,
        ctx.next_retry_on,
        ctx.instalment_id,
      ]);
      return { ...base, result: "retry_later", message: err.message };
    }

    await markFailed(claimedCtx, {
      paymentIntentId: null,
      message: err instanceof Error ? err.message : "Unexpected error",
      code: err instanceof Stripe.errors.StripeError ? (err.code ?? null) : null,
    });
    return { ...base, result: "failed" };
  }
}

// If the process stopped between claiming an instalment and reaching Stripe, the claim
// is left in 'processing' with no PaymentIntent. Release it with the same attempt
// number so the next charge reuses the idempotency key.
function releaseStuckClaims(): Promise<number> {
  return db.run(
    `UPDATE instalments SET status = 'scheduled', attempt_count = attempt_count - 1
      WHERE status = 'processing' AND stripe_payment_intent_id IS NULL
        AND last_attempt_at <= now() - interval '1 hour'`,
  );
}

// Checks debits still processing directly with Stripe. Webhooks normally keep these up
// to date; this pass catches anything a missed or delayed webhook left behind.
export async function reconcileProcessing(limit = 100): Promise<number> {
  const rows = await db.query<{ paymentIntentId: string; accountId: string }>(
    `SELECT i.stripe_payment_intent_id AS "paymentIntentId", sc.stripe_account_id AS "accountId"
       FROM instalments i
       JOIN payment_plans p ON p.id = i.payment_plan_id
       JOIN service_centres sc ON sc.id = p.service_centre_id
      WHERE i.status = 'processing' AND i.stripe_payment_intent_id IS NOT NULL AND sc.stripe_account_id IS NOT NULL
      LIMIT $1`,
    [limit],
  );

  let settled = 0;
  for (const { paymentIntentId, accountId } of rows) {
    try {
      const pi = await getStripe().paymentIntents.retrieve(paymentIntentId, {}, { stripeAccount: accountId });
      const status = await applyPaymentIntent(pi, accountId);
      if (status === "paid" || status === "failed") settled++;
    } catch (err) {
      console.error(`Reconciling ${paymentIntentId} failed:`, err);
    }
  }
  return settled;
}

export type DebitJobResult = {
  asOf: string;
  releasedClaims: number;
  settledFromStripe: number;
  outcomes: DebitOutcome[];
};

// One run of the scheduled job, in order: release stuck claims, settle processing debits
// with Stripe, then charge every instalment that's due or waiting on a retry.
export async function runDebitJob(asOf: string, limit = 200): Promise<DebitJobResult> {
  const releasedClaims = await releaseStuckClaims();
  const settledFromStripe = await reconcileProcessing();

  const due = await db.query<InstalmentContext>(
    `${CONTEXT_SELECT}
      WHERE p.status = 'active' AND sc.charges_enabled
        AND ((i.status = 'scheduled' AND i.due_date <= $1)
          OR (i.status = 'failed' AND i.next_retry_on IS NOT NULL AND i.next_retry_on <= $1))
      ORDER BY i.due_date, i.id
      LIMIT $2`,
    [asOf, limit],
  );

  const outcomes: DebitOutcome[] = [];
  // One at a time keeps well inside Stripe's rate limits.
  for (const ctx of due) outcomes.push(await chargeInstalment(ctx));

  return { asOf, releasedClaims, settledFromStripe, outcomes };
}

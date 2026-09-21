import { db, transaction, type PlanStatus } from "@/lib/db";
import { formatAud } from "@/lib/money";
import { notify } from "@/lib/notifications";
import {
  paidOffEmail,
  planCancelledMessages,
  planHoldEndedMessages,
  planOnHoldMessages,
  receiptEmail,
} from "@/lib/plan-messages";
import { addDays, daysBetween, formatDate, todayInSydney } from "@/lib/schedule";
import { appUrl } from "@/lib/stripe";

// What a workshop can do to a plan after it's created: put it on hold, start it again,
// cancel it, or record payments the customer made some other way (cash, card at the
// counter). Every action is scoped to the workshop that owns the plan.

// Errors are codes, so the plan page can say what went wrong without showing text from its URL.
export const PLAN_ACTION_ERRORS = {
  "not-found": "That plan couldn't be found.",
  "not-active": "Only an active plan can be put on hold.",
  "resume-date": "Choose a date after today to start payments again.",
  "not-on-hold": "This plan isn't on hold.",
  "cant-cancel": "This plan can't be cancelled now.",
  "cant-record": "Payments can't be recorded on this plan.",
  "payment-not-found": "That payment couldn't be found.",
  "payment-taken": "That payment has already been paid or is being collected right now.",
  "nothing-left": "There's nothing left to record on this plan.",
  "already-paid-off": "This plan is already paid off.",
  "already-cancelled": "This plan is already cancelled.",
} as const;
export type PlanActionError = keyof typeof PLAN_ACTION_ERRORS;
export type PlanActionResult = { ok: true } | { ok: false; error: PlanActionError };

type PlanContext = {
  id: number;
  status: PlanStatus;
  description: string;
  instalment_count: number;
  total_amount_cents: number;
  setup_token: string;
  paused_at: string | null;
  resume_on: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  centre_id: number;
  centre_name: string;
  centre_phone: string | null;
};

const PLAN_SELECT = `
  SELECT p.id, p.status, p.description, p.instalment_count, p.total_amount_cents, p.setup_token,
         p.paused_at, p.resume_on,
         c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
         sc.id AS centre_id, sc.name AS centre_name, sc.phone AS centre_phone
    FROM payment_plans p
    JOIN customers c ON c.id = p.customer_id
    JOIN service_centres sc ON sc.id = p.service_centre_id`;

// Longest free-text reason or note kept with a plan.
export const MAX_NOTE_LENGTH = 300;

function loadPlan(centreId: number, planId: number): Promise<PlanContext | undefined> {
  if (!Number.isInteger(planId)) return Promise.resolve(undefined);
  return db.one<PlanContext>(`${PLAN_SELECT} WHERE p.id = $1 AND p.service_centre_id = $2`, [planId, centreId]);
}

const sender = (plan: PlanContext) => ({
  centreName: plan.centre_name,
  centrePhone: plan.centre_phone,
  customerName: plan.customer_name,
  description: plan.description,
  link: `${appUrl()}/pay/${plan.setup_token}`,
});

const tidy = (text: string | null | undefined) => {
  const trimmed = (text ?? "").trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, MAX_NOTE_LENGTH) : null;
};

// For a reason or note quoted in the middle of an Activity entry.
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

// Each action can happen more than once on the same plan (put on hold twice, say), so its
// Activity entry is keyed by the moment it happened.
const eventKey = (kind: string, planId: number) => `${kind}:${planId}:${Date.now()}`;

function nextPayment(planId: number) {
  return db.one<{ amount_cents: number; due_date: string }>(
    `SELECT amount_cents, due_date FROM instalments
      WHERE payment_plan_id = $1 AND status IN ('scheduled', 'failed')
      ORDER BY due_date, sequence
      LIMIT 1`,
    [planId],
  );
}

// Stops debits until the workshop resumes the plan, or until `resumeOn` if given. Only an
// active plan can be put on hold: a plan waiting on bank details isn't being debited anyway.
export async function pausePlan(
  centreId: number,
  planId: number,
  input: { reason?: string | null; resumeOn?: string | null },
): Promise<PlanActionResult> {
  const plan = await loadPlan(centreId, planId);
  if (!plan) return { ok: false, error: "not-found" };
  if (plan.status !== "active") return { ok: false, error: "not-active" };

  const today = todayInSydney();
  const resumeOn = input.resumeOn || null;
  if (resumeOn && resumeOn <= today) return { ok: false, error: "resume-date" };

  const reason = tidy(input.reason);
  const changed = await db.run(
    `UPDATE payment_plans SET status = 'paused', paused_at = $1, resume_on = $2, hold_reason = $3
      WHERE id = $4 AND status = 'active'`,
    [today, resumeOn, reason, planId],
  );
  if (!changed) return { ok: false, error: "not-active" };

  const messages = planOnHoldMessages({ ...sender(plan), resumeOn });
  await notify({
    centreId,
    planId,
    kind: "plan_paused",
    title: `${plan.customer_name}'s plan is on hold`,
    body: `No payments for ${plan.description} will be debited ${resumeOn ? `until ${formatDate(resumeOn)}` : "until you resume the plan"}.${reason ? ` Reason: ${sentence(reason)}` : ""} ${plan.customer_name.split(" ")[0]} has been told.`,
    dedupeKey: eventKey("plan_paused", planId),
    customerEmail: { to: plan.customer_email, ...messages.email },
    customerSms: { to: plan.customer_phone, body: messages.sms },
  });
  return { ok: true };
}

// Starts debits again. Every payment still to come moves back by the number of days the
// plan was on hold, so the customer gets the break they were given, and any payment that
// failed before the hold is collected on the next run.
export async function resumePlan(centreId: number, planId: number, asOf = todayInSydney()): Promise<PlanActionResult> {
  const plan = await loadPlan(centreId, planId);
  if (!plan) return { ok: false, error: "not-found" };
  if (plan.status !== "paused") return { ok: false, error: "not-on-hold" };

  const shift = plan.paused_at ? Math.max(0, daysBetween(plan.paused_at, asOf)) : 0;
  const resumed = await transaction(async (tx) => {
    const changed = await tx.run(
      `UPDATE payment_plans SET status = 'active', paused_at = NULL, resume_on = NULL, hold_reason = NULL
        WHERE id = $1 AND status = 'paused'`,
      [planId],
    );
    if (!changed) return false;
    if (shift > 0) {
      await tx.run(
        "UPDATE instalments SET due_date = due_date + $1::int WHERE payment_plan_id = $2 AND status = 'scheduled'",
        [shift, planId],
      );
    }
    await tx.run("UPDATE instalments SET next_retry_on = $1 WHERE payment_plan_id = $2 AND status = 'failed'", [
      asOf,
      planId,
    ]);
    return true;
  });
  if (!resumed) return { ok: false, error: "not-on-hold" };

  const next = await nextPayment(planId);
  const messages = planHoldEndedMessages({
    ...sender(plan),
    next: next ? { amountCents: next.amount_cents, dueDate: next.due_date } : null,
  });
  await notify({
    centreId,
    planId,
    kind: "plan_resumed",
    title: `${plan.customer_name}'s plan has resumed`,
    body: `Payments for ${plan.description} are being debited again.${shift > 0 ? ` Remaining due dates moved back ${shift} ${shift === 1 ? "day" : "days"} to cover the hold.` : ""}${next ? ` Next payment: ${formatAud(next.amount_cents)} on ${formatDate(next.due_date)}.` : ""}`,
    dedupeKey: eventKey("plan_resumed", planId),
    customerEmail: { to: plan.customer_email, ...messages.email },
    customerSms: { to: plan.customer_phone, body: messages.sms },
  });
  return { ok: true };
}

// Plans on hold with a resume date that has arrived. Run before the day's debits, so the
// first resumed payment can be collected in the same run.
export async function autoResumeDuePlans(asOf: string): Promise<number> {
  const due = await db.query<{ id: number; service_centre_id: number }>(
    "SELECT id, service_centre_id FROM payment_plans WHERE status = 'paused' AND resume_on IS NOT NULL AND resume_on <= $1",
    [asOf],
  );
  let resumed = 0;
  for (const plan of due) {
    const result = await resumePlan(plan.service_centre_id, plan.id, asOf);
    if (result.ok) resumed++;
  }
  return resumed;
}

// Stops the plan for good. Payments still to come are marked as never to be collected; a
// debit already on its way through the banks can't be recalled and is left to finish.
export async function cancelPlan(centreId: number, planId: number, reason?: string | null): Promise<PlanActionResult> {
  const plan = await loadPlan(centreId, planId);
  if (!plan) return { ok: false, error: "not-found" };
  if (plan.status === "completed" || plan.status === "cancelled") {
    return { ok: false, error: plan.status === "completed" ? "already-paid-off" : "already-cancelled" };
  }

  const note = tidy(reason);
  const outcome = await transaction(async (tx) => {
    const changed = await tx.run(
      `UPDATE payment_plans
          SET status = 'cancelled', cancelled_at = now(), cancel_reason = $1,
              paused_at = NULL, resume_on = NULL, hold_reason = NULL
        WHERE id = $2 AND status IN ('draft', 'active', 'paused', 'failed')`,
      [note, planId],
    );
    if (!changed) return null;
    const stopped = await tx.query<{ amount_cents: number }>(
      `UPDATE instalments SET status = 'cancelled', next_retry_on = NULL
        WHERE payment_plan_id = $1 AND status IN ('scheduled', 'failed')
        RETURNING amount_cents`,
      [planId],
    );
    const inFlight = await tx.one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM instalments WHERE payment_plan_id = $1 AND status = 'processing'",
      [planId],
    );
    return { stoppedCents: stopped.reduce((sum, row) => sum + row.amount_cents, 0), inFlight: Number(inFlight?.n ?? 0) };
  });
  if (!outcome) return { ok: false, error: "cant-cancel" };

  // A plan that never started has nothing to tell the customer about beyond the link going dead.
  const wasDraft = plan.status === "draft";
  const messages = planCancelledMessages(sender(plan));
  await notify({
    centreId,
    planId,
    kind: "plan_cancelled",
    title: `${plan.customer_name}'s plan was cancelled`,
    body: [
      `${plan.description}: ${formatAud(outcome.stoppedCents)} still to come won't be collected.`,
      outcome.inFlight > 0
        ? `A payment already being processed can't be stopped and will still clear if the bank accepts it.`
        : "",
      note ? `Reason: ${sentence(note)}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    dedupeKey: `plan_cancelled:${planId}`,
    customerEmail: { to: plan.customer_email, ...messages.email },
    customerSms: wasDraft ? undefined : { to: plan.customer_phone, body: messages.sms },
  });
  return { ok: true };
}

type RecordedPayment = { id: number; sequence: number; amount_cents: number };

// Marks payments as paid outside Stripe, then completes the plan if nothing is left. Shared
// by recording a single payment and recording that the whole balance was paid.
async function recordPayments(
  plan: PlanContext,
  instalmentId: number | null,
  note: string | null,
): Promise<{ recorded: RecordedPayment[]; completed: boolean }> {
  return transaction(async (tx) => {
    const recorded = await tx.query<RecordedPayment>(
      `UPDATE instalments
          SET status = 'paid', paid_at = now(), paid_outside_stripe = true, payment_note = $1,
              next_retry_on = NULL, failure_reason = NULL, failure_code = NULL
        WHERE payment_plan_id = $2 AND status IN ('scheduled', 'failed') AND ($3::bigint IS NULL OR id = $3)
        RETURNING id, sequence, amount_cents`,
      [note, plan.id, instalmentId],
    );
    if (recorded.length === 0) return { recorded, completed: false };

    const completed = await tx.run(
      `UPDATE payment_plans SET status = 'completed', paused_at = NULL, resume_on = NULL, hold_reason = NULL
        WHERE id = $1 AND status IN ('active', 'paused', 'failed')
          AND NOT EXISTS (SELECT 1 FROM instalments WHERE payment_plan_id = $1 AND status != 'paid')`,
      [plan.id],
    );
    return { recorded, completed: completed > 0 };
  });
}

const RECORDABLE: PlanStatus[] = ["active", "paused", "failed"];

// A payment the customer made another way. It's taken off the schedule so it's never debited.
export async function recordManualPayment(
  centreId: number,
  planId: number,
  instalmentId: number,
  note?: string | null,
): Promise<PlanActionResult> {
  const plan = await loadPlan(centreId, planId);
  if (!plan) return { ok: false, error: "not-found" };
  if (!RECORDABLE.includes(plan.status)) return { ok: false, error: "cant-record" };
  if (!Number.isInteger(instalmentId)) return { ok: false, error: "payment-not-found" };

  const { recorded, completed } = await recordPayments(plan, instalmentId, tidy(note));
  if (recorded.length === 0) {
    return { ok: false, error: "payment-taken" };
  }
  await tellPaymentsRecorded(plan, recorded, completed, tidy(note));
  return { ok: true };
}

// The customer paid off everything still owing in one go.
export async function recordPaidInFull(centreId: number, planId: number, note?: string | null): Promise<PlanActionResult> {
  const plan = await loadPlan(centreId, planId);
  if (!plan) return { ok: false, error: "not-found" };
  if (!RECORDABLE.includes(plan.status)) return { ok: false, error: "cant-record" };

  const { recorded, completed } = await recordPayments(plan, null, tidy(note));
  if (recorded.length === 0) return { ok: false, error: "nothing-left" };
  await tellPaymentsRecorded(plan, recorded, completed, tidy(note));
  return { ok: true };
}

async function tellPaymentsRecorded(plan: PlanContext, recorded: RecordedPayment[], completed: boolean, note: string | null) {
  const amount = recorded.reduce((sum, row) => sum + row.amount_cents, 0);
  const label =
    recorded.length === 1
      ? `Payment ${recorded[0].sequence} of ${plan.instalment_count} (${formatAud(amount)})`
      : `${recorded.length} payments (${formatAud(amount)})`;
  const [progress, next] = await Promise.all([
    db.one<{ paid_cents: number }>(
      "SELECT COALESCE(SUM(amount_cents), 0) AS paid_cents FROM instalments WHERE payment_plan_id = $1 AND status = 'paid'",
      [plan.id],
    ),
    completed ? Promise.resolve(undefined) : nextPayment(plan.id),
  ]);

  await notify({
    centreId: plan.centre_id,
    planId: plan.id,
    instalmentId: recorded.length === 1 ? recorded[0].id : null,
    kind: "payment_recorded",
    title: `Payment recorded for ${plan.customer_name}`,
    body: `${label} for ${plan.description} marked as paid outside Halfshaft, so ${recorded.length === 1 ? "it" : "they"} won't be debited.${note ? ` Note: ${sentence(note)}` : ""}`,
    dedupeKey: `payment_recorded:${recorded.map((row) => row.id).join(",")}`,
    // A receipt covers one payment; several at once only happens when the balance is paid
    // off, and the plan's paid-off email follows when the last payment clears.
    customerEmail:
      completed || recorded.length !== 1
      ? undefined
      : {
          to: plan.customer_email,
          ...receiptEmail({
            ...sender(plan),
            sequence: recorded[0].sequence,
            instalmentCount: plan.instalment_count,
            amountCents: amount,
            paidCents: progress?.paid_cents ?? amount,
            totalCents: plan.total_amount_cents,
            next: next ? { amountCents: next.amount_cents, dueDate: next.due_date } : null,
          }),
        },
  });

  if (completed) {
    await notify({
      centreId: plan.centre_id,
      planId: plan.id,
      kind: "plan_completed",
      title: `${plan.customer_name}'s plan is paid off`,
      body: `All ${plan.instalment_count} payments (${formatAud(plan.total_amount_cents)}) for ${plan.description} have been paid.`,
      dedupeKey: `plan_completed:${plan.id}`,
      customerEmail: {
        to: plan.customer_email,
        ...paidOffEmail({
          ...sender(plan),
          instalmentCount: plan.instalment_count,
          totalCents: plan.total_amount_cents,
          final: "Thanks for your payment.",
        }),
      },
    });
  }
}

// Earliest date a hold can end, for the form.
export const earliestResumeDate = () => addDays(todayInSydney(), 1);

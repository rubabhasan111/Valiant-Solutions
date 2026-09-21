import { purgeOldAuthAttempts } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import { runDebitJob, type DebitJobResult } from "@/lib/debits";
import { deliverPendingMessages, type MessageDeliveryResult } from "@/lib/messaging";
import { autoResumeDuePlans } from "@/lib/plan-actions";
import { sendPaymentReminders, type ReminderResult } from "@/lib/reminders";

export type JobTrigger = "scheduler" | "admin";

export type DebitRunSummary = {
  charged: number;
  paid: number;
  failed: number;
  retryLater: number;
  skipped: number;
  settledFromStripe: number;
  releasedClaims: number;
  resumedPlans: number;
  reminders: ReminderResult;
  emails: MessageDeliveryResult["emails"];
  texts: MessageDeliveryResult["texts"];
};

export function summariseDebitRun(
  debits: DebitJobResult,
  reminders: ReminderResult,
  messages: MessageDeliveryResult,
  resumedPlans = 0,
): DebitRunSummary {
  const count = (result: string) => debits.outcomes.filter((o) => o.result === result).length;
  return {
    charged: count("processing") + count("paid"),
    paid: count("paid"),
    failed: count("failed"),
    retryLater: count("retry_later"),
    skipped: count("skipped"),
    settledFromStripe: debits.settledFromStripe,
    releasedClaims: debits.releasedClaims,
    resumedPlans,
    reminders,
    emails: messages.emails,
    texts: messages.texts,
  };
}

// One run of the scheduled job: collect what's due, remind customers about what's coming,
// then send every queued email and text. Recorded in job_runs.
export async function runDebitsAndEmails(asOf: string, trigger: JobTrigger, options: { ignoreQuietHours?: boolean } = {}) {
  const run = await db.one<{ id: number }>(
    "INSERT INTO job_runs (job, trigger, as_of) VALUES ('debits', $1, $2) RETURNING id",
    [trigger, asOf],
  );

  try {
    // Holds that end today first, so their first payment can be collected in this run.
    const resumedPlans = await autoResumeDuePlans(asOf);
    const debits = await runDebitJob(asOf);
    const reminders = await sendPaymentReminders(asOf, { ignoreQuietHours: options.ignoreQuietHours });
    await purgeOldAuthAttempts();
    const messages = await deliverPendingMessages();
    const summary = summariseDebitRun(debits, reminders, messages, resumedPlans);
    await db.run("UPDATE job_runs SET finished_at = now(), result = $1 WHERE id = $2", [JSON.stringify(summary), run!.id]);
    return { debits, reminders, messages, summary };
  } catch (err) {
    await db
      .run("UPDATE job_runs SET finished_at = now(), error = $1 WHERE id = $2", [
        err instanceof Error ? err.message : String(err),
        run!.id,
      ])
      .catch(() => {});
    throw err;
  }
}

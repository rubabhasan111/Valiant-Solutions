import { db } from "@/lib/db";
import { runDebitJob, type DebitJobResult } from "@/lib/debits";
import { deliverPendingEmails, type EmailDeliveryResult } from "@/lib/email";

export type JobTrigger = "scheduler" | "admin";

export type DebitRunSummary = {
  charged: number;
  paid: number;
  failed: number;
  retryLater: number;
  skipped: number;
  settledFromStripe: number;
  releasedClaims: number;
  emails: EmailDeliveryResult;
};

export function summariseDebitRun(debits: DebitJobResult, emails: EmailDeliveryResult): DebitRunSummary {
  const count = (result: string) => debits.outcomes.filter((o) => o.result === result).length;
  return {
    charged: count("processing") + count("paid"),
    paid: count("paid"),
    failed: count("failed"),
    retryLater: count("retry_later"),
    skipped: count("skipped"),
    settledFromStripe: debits.settledFromStripe,
    releasedClaims: debits.releasedClaims,
    emails,
  };
}

// One run of the debit job followed by email delivery, recorded in job_runs.
export async function runDebitsAndEmails(asOf: string, trigger: JobTrigger) {
  const run = await db.one<{ id: number }>(
    "INSERT INTO job_runs (job, trigger, as_of) VALUES ('debits', $1, $2) RETURNING id",
    [trigger, asOf],
  );

  try {
    const debits = await runDebitJob(asOf);
    const emails = await deliverPendingEmails();
    const summary = summariseDebitRun(debits, emails);
    await db.run("UPDATE job_runs SET finished_at = now(), result = $1 WHERE id = $2", [JSON.stringify(summary), run!.id]);
    return { debits, emails, summary };
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

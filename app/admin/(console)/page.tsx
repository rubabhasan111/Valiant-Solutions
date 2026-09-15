import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, Play, WarningCircle } from "@phosphor-icons/react/ssr";
import { requireAdmin } from "@/lib/admin/dal";
import { getPlatformOverview, listAuditLog, listDebitJobRuns, listWorkshops, type JobRun } from "@/lib/admin/data";
import { formatAud } from "@/lib/money";
import { formatDate, formatTimestamp } from "@/lib/schedule";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { WorkshopStatusChips } from "@/components/admin/StripeStatusChip";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { runDebitsNow } from "./actions";

export const metadata: Metadata = { title: "Workshops" };

// Server Actions on this page include running the debit job, which can take a while.
export const maxDuration = 300;

// The scheduler should call the debit job every 15 minutes.
const STALE_AFTER_MINUTES = 30;

const AUDIT_LABEL: Record<string, string> = {
  workshop_suspended: "Suspended access",
  workshop_restored: "Restored access",
  bank_link_resent: "Resent a bank details link",
  debit_job_run: "Ran the debit job",
};

function minutesSince(iso: string): number {
  return (Date.now() - Date.parse(iso)) / 60_000;
}

function describeRun(run: JobRun): string {
  if (run.error) return `Failed: ${run.error}`;
  if (!run.result) return "Still running";
  const { charged, failed, settledFromStripe, emails } = run.result;
  return `${charged} charged, ${failed} failed, ${settledFromStripe} settled with Stripe, ${emails.sent} emails sent`;
}

export default async function AdminOverviewPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const { ran } = await searchParams;

  const [overview, workshops, runs, audit] = await Promise.all([
    getPlatformOverview(),
    listWorkshops(),
    listDebitJobRuns(5),
    listAuditLog({ limit: 10 }),
  ]);

  const lastRun = runs[0];
  const schedulerStale = !lastRun || minutesSince(lastRun.started_at) > STALE_AFTER_MINUTES;

  const tiles = [
    { label: "Workshops", value: String(overview.workshops), note: `${overview.readyWorkshops} taking payments` },
    { label: "Active plans", value: String(overview.activePlans), note: `${overview.pausedPlans} paused` },
    {
      label: "Collected this month",
      value: formatAud(overview.collectedThisMonthCents),
      note: "Paid straight to workshops",
    },
    {
      label: "Payments retrying",
      value: String(overview.paymentsRetrying),
      note: `${overview.paymentsProcessing} processing`,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <PageHeader title="Workshops" description="Every workshop on Halfshaft and how their payments are going." />

      {ran === "done" && (
        <p role="status" className="mt-6 rounded-2xl bg-accent-pale px-5 py-3 text-sm font-semibold text-accent-ink">
          The debit job ran. {lastRun && describeRun(lastRun)}.
        </p>
      )}
      {ran === "error" && (
        <p role="status" className="mt-6 rounded-2xl bg-danger-pale px-5 py-3 text-sm font-semibold text-danger">
          The debit job stopped with an error. The latest run below shows what happened.
        </p>
      )}

      <section aria-label="Summary" className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, note }) => (
          <div key={label} className="rounded-3xl border border-edge bg-surface p-5">
            <p className="text-sm text-mute">{label}</p>
            <p className="tabular mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">{value}</p>
            <p className="mt-1 text-xs text-mute">{note}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-6 rounded-3xl border border-edge bg-surface p-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:p-8">
        <div>
          <div className="flex items-start gap-3">
            {schedulerStale ? (
              <WarningCircle size={26} weight="fill" className="mt-0.5 shrink-0 text-pending" />
            ) : (
              <CheckCircle size={26} weight="fill" className="mt-0.5 shrink-0 text-accent-ink" />
            )}
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Debit job</h2>
              <p className="mt-1 leading-relaxed text-body">
                {lastRun
                  ? `Last run ${formatTimestamp(lastRun.started_at)}${lastRun.trigger === "admin" ? " (run by an admin)" : ""}: ${describeRun(lastRun)}.`
                  : "The debit job hasn't run yet."}
              </p>
              {schedulerStale && (
                <p className="mt-2 text-sm font-semibold text-pending">
                  The scheduler hasn&apos;t run it in the last {STALE_AFTER_MINUTES} minutes. Check the cron job.
                </p>
              )}
            </div>
          </div>
          {runs.length > 1 && (
            <ul className="mt-5 grid gap-1.5 border-t border-edge pt-4 text-sm text-body">
              {runs.slice(1).map((run) => (
                <li key={run.id} className="flex flex-wrap gap-x-3">
                  <span className="tabular font-semibold text-ink">{formatTimestamp(run.started_at)}</span>
                  <span>{describeRun(run)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form action={runDebitsNow} className="self-center md:justify-self-end">
          <ConfirmButton
            className="btn btn-primary"
            pendingLabel="Running"
            confirmMessage="Run the debit job now? It charges every instalment due today and retries failed payments, exactly like the scheduler."
          >
            <Play size={18} weight="fill" />
            Run debit job now
          </ConfirmButton>
          <p className="mt-2 max-w-[26ch] text-xs text-mute">Safe to run any time: nothing is ever charged twice.</p>
        </form>
      </section>

      {(overview.emailsFailed > 0 || overview.emailsSkipped > 0) && (
        <p className="mt-6 rounded-2xl bg-pending-pale px-5 py-3 text-sm font-semibold text-pending">
          {overview.emailsFailed > 0 && `${overview.emailsFailed} emails failed to send. `}
          {overview.emailsSkipped > 0 && `${overview.emailsSkipped} emails were skipped because email delivery isn't set up.`}
        </p>
      )}

      <section className="mt-6 rounded-3xl border border-edge bg-surface">
        <h2 className="px-5 pt-5 text-lg font-bold">All workshops</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="text-xs text-mute">
                <th scope="col" className="px-5 py-3 font-semibold">Workshop</th>
                <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                <th scope="col" className="px-5 py-3 font-semibold">Active plans</th>
                <th scope="col" className="px-5 py-3 font-semibold">Retrying</th>
                <th scope="col" className="px-5 py-3 font-semibold">Paused</th>
                <th scope="col" className="px-5 py-3 font-semibold">Collected this month</th>
                <th scope="col" className="px-5 py-3 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge border-t border-edge">
              {workshops.map((workshop) => (
                <tr key={workshop.id} className="transition-colors hover:bg-edge/30">
                  <td className="px-5 py-4">
                    <Link href={`/admin/workshops/${workshop.id}`} className="font-semibold underline-offset-2 hover:underline">
                      {workshop.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-mute">{workshop.owner_email ?? workshop.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <WorkshopStatusChips centre={workshop} />
                  </td>
                  <td className="tabular px-5 py-4">{workshop.active_plans}</td>
                  <td className={`tabular px-5 py-4 ${workshop.retrying > 0 ? "font-bold text-danger" : ""}`}>{workshop.retrying}</td>
                  <td className={`tabular px-5 py-4 ${workshop.paused_plans > 0 ? "font-bold text-danger" : ""}`}>
                    {workshop.paused_plans}
                  </td>
                  <td className="tabular px-5 py-4">{formatAud(workshop.collected_this_month_cents)}</td>
                  <td className="tabular px-5 py-4 text-body">{formatDate(workshop.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-edge bg-surface p-5">
        <h2 className="text-lg font-bold">Recent admin actions</h2>
        {audit.length === 0 ? (
          <p className="mt-2 text-sm text-body">No admin actions yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-edge text-sm">
            {audit.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                <span className="tabular w-32 shrink-0 text-mute">{formatTimestamp(entry.created_at)}</span>
                <span className="font-semibold">{AUDIT_LABEL[entry.action] ?? entry.action}</span>
                {entry.centre_name && entry.service_centre_id && (
                  <Link href={`/admin/workshops/${entry.service_centre_id}`} className="text-accent-ink underline-offset-2 hover:underline">
                    {entry.centre_name}
                  </Link>
                )}
                {entry.detail && <span className="text-body">{entry.detail}</span>}
                <span className="ml-auto text-xs text-mute">{entry.admin_name ?? "Removed admin"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

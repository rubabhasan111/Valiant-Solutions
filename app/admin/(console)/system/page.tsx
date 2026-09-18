import type { Metadata } from "next";
import { CheckCircle, Warning, XCircle } from "@phosphor-icons/react/ssr";
import { requireAdmin } from "@/lib/admin/dal";
import { listDebitJobRuns } from "@/lib/admin/data";
import {
  configChecks,
  databaseInfo,
  deploymentInfo,
  queueInfo,
  stripeInfo,
  stuckWork,
  type Check,
} from "@/lib/admin/system";
import { formatTimestamp } from "@/lib/schedule";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const metadata: Metadata = { title: "System" };

// Always current: this page exists to show the live state of the deployment.
export const dynamic = "force-dynamic";

const STATE_ICON = {
  ok: { Icon: CheckCircle, className: "text-accent-ink" },
  warn: { Icon: Warning, className: "text-pending" },
  bad: { Icon: XCircle, className: "text-danger" },
} as const;

function CheckRow({ check }: { check: Check }) {
  const { Icon, className } = STATE_ICON[check.state];
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon size={20} weight="fill" className={`mt-0.5 shrink-0 ${className}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{check.label}</p>
        <p className="mt-0.5 break-words text-sm text-body">{check.detail}</p>
      </div>
    </li>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-edge bg-surface p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-mute">{label}</dt>
          <dd className="break-words font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const minutesSince = (iso: string) => Math.round((Date.now() - Date.parse(iso)) / 60_000);

export default async function SystemPage() {
  await requireAdmin();

  const deployment = deploymentInfo();
  const [database, queues, stuck, stripe, runs] = await Promise.all([
    databaseInfo(),
    queueInfo(),
    stuckWork(),
    stripeInfo(),
    listDebitJobRuns(8),
  ]);

  const lastRun = runs[0];
  const schedulerStale = !lastRun || minutesSince(lastRun.started_at) > 30;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <PageHeader title="System" description="What's running, what it's wired to, and what's stuck. For you, not for workshops." />

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Panel title="Deployment">
          <Rows
            rows={[
              ["Environment", deployment.environment],
              ["Commit", deployment.commit ? `${deployment.commit}${deployment.branch ? ` on ${deployment.branch}` : ""}` : "local"],
              ["Change", deployment.commitMessage ?? "—"],
              ["Region", deployment.region ?? "—"],
              ["Public address", deployment.appUrl],
              ["Node", deployment.nodeVersion],
            ]}
          />
        </Panel>

        <Panel title="Database">
          <Rows
            rows={[
              ["Host", database.host],
              ["Database", database.name],
              ["Schema version", `v${database.migration}`],
              ["Round trip", `${database.latencyMs} ms`],
              ["Size", database.sizeMb === null ? "—" : `${database.sizeMb} MB`],
            ]}
          />
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-edge pt-3 text-sm sm:grid-cols-3">
            {database.tables.map((table) => (
              <li key={table.name} className="flex justify-between gap-2">
                <span className="truncate text-mute">{table.name}</span>
                <span className="tabular font-semibold">{table.rows}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Configuration">
          <ul className="mt-2 divide-y divide-edge">
            {configChecks().map((check) => (
              <CheckRow key={check.label} check={check} />
            ))}
          </ul>
        </Panel>

        <Panel title="Stripe">
          {stripe.reachable ? (
            <>
              <Rows
                rows={[
                  ["Connected accounts", String(stripe.connectedAccounts)],
                  ["Webhook", stripe.webhook ? `${stripe.webhook.status} for this address` : "None pointing here"],
                  ["Other endpoints", String(stripe.otherWebhooks)],
                ]}
              />
              {stripe.webhook?.missingEvents.length ? (
                <p className="mt-3 rounded-2xl bg-pending-pale px-4 py-3 text-sm font-semibold text-pending">
                  Missing events: {stripe.webhook.missingEvents.join(", ")}
                </p>
              ) : null}
              {!stripe.webhook && (
                <p className="mt-3 rounded-2xl bg-pending-pale px-4 py-3 text-sm font-semibold text-pending">
                  No webhook points at this deployment, so payment updates arrive only when the job re-checks Stripe.
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 rounded-2xl bg-danger-pale px-4 py-3 text-sm font-semibold text-danger">
              Stripe couldn&apos;t be reached: {stripe.error}
            </p>
          )}
        </Panel>

        <Panel title="Scheduled job">
          {lastRun ? (
            <Rows
              rows={[
                ["Last run", `${formatTimestamp(lastRun.started_at)} (${minutesSince(lastRun.started_at)} min ago)`],
                ["Triggered by", lastRun.trigger],
                ["Finished", lastRun.finished_at ? "yes" : "still running"],
                ["Last error", lastRun.error ?? "none"],
              ]}
            />
          ) : (
            <p className="mt-3 text-sm text-body">The job hasn&apos;t run yet.</p>
          )}
          {schedulerStale && (
            <p className="mt-3 rounded-2xl bg-pending-pale px-4 py-3 text-sm font-semibold text-pending">
              No run in the last 30 minutes. Check the GitHub Actions schedule.
            </p>
          )}
          <ul className="mt-4 grid gap-1 border-t border-edge pt-3 text-sm text-body">
            {runs.slice(1).map((run) => (
              <li key={run.id} className="flex flex-wrap gap-x-3">
                <span className="tabular font-semibold text-ink">{formatTimestamp(run.started_at)}</span>
                <span>
                  {run.error
                    ? `error: ${run.error}`
                    : `${run.result?.charged ?? 0} charged, ${run.result?.reminders ? run.result.reminders.texted + run.result.reminders.emailed : 0} reminders`}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Message queues">
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-mute">
                <th scope="col" className="py-2 font-semibold">Channel</th>
                <th scope="col" className="py-2 font-semibold">Waiting</th>
                <th scope="col" className="py-2 font-semibold">Sent</th>
                <th scope="col" className="py-2 font-semibold">Failed</th>
                <th scope="col" className="py-2 font-semibold">Skipped</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-edge border-t border-edge">
              {queues.map((queue) => (
                <tr key={queue.channel}>
                  <td className="py-2 capitalize">{queue.channel}</td>
                  <td className={`py-2 ${queue.pending > 0 ? "font-bold text-pending" : ""}`}>{queue.pending}</td>
                  <td className="py-2">{queue.sent}</td>
                  <td className={`py-2 ${queue.failed > 0 ? "font-bold text-danger" : ""}`}>{queue.failed}</td>
                  <td className="py-2">{queue.skipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {queues.some((queue) => queue.oldestPendingAt) && (
            <p className="mt-3 text-xs text-mute">
              Oldest waiting message:{" "}
              {formatTimestamp(queues.map((q) => q.oldestPendingAt).filter(Boolean).sort()[0] as string)}
            </p>
          )}
        </Panel>
      </div>

      <section className="mt-4 rounded-3xl border border-edge bg-surface p-5">
        <h2 className="text-lg font-bold">Needs a look</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Payments stuck over a day", value: stuck.processingOverADay, bad: stuck.processingOverADay > 0 },
            { label: "Failed payments retrying", value: stuck.failedInstalments, bad: false },
            { label: "Plans paused", value: stuck.pausedPlans, bad: false },
            { label: "Plans unstarted over a week", value: stuck.draftPlansOverAWeek, bad: false },
          ].map((item) => (
            <div key={item.label}>
              <p className={`tabular text-2xl font-extrabold tracking-tight ${item.bad ? "text-danger" : ""}`}>{item.value}</p>
              <p className="mt-1 text-xs text-mute">{item.label}</p>
            </div>
          ))}
        </div>

        {stuck.failedMessages.length > 0 && (
          <ul className="mt-5 divide-y divide-edge border-t border-edge text-sm">
            {stuck.failedMessages.map((message, index) => (
              <li key={`${message.channel}-${index}`} className="py-2.5">
                <p className="font-semibold">
                  {message.channel} to {message.recipient}
                  <span className="ml-2 text-xs font-normal text-mute">{formatTimestamp(message.created_at)}</span>
                </p>
                <p className="mt-0.5 text-xs text-danger">{message.error ?? "No reason recorded"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

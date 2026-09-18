import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowSquareOut, LockKey, LockKeyOpen } from "@phosphor-icons/react/ssr";
import { requireAdmin } from "@/lib/admin/dal";
import {
  getWorkshop,
  listAuditLog,
  listFailedPayments,
  listWorkshopEmails,
  listWorkshopMembers,
  listWorkshopTexts,
  type OutboxText,
} from "@/lib/admin/data";
import { formatAud } from "@/lib/money";
import { formatAuMobile } from "@/lib/phone";
import { listPlans } from "@/lib/plans";
import { formatDate, formatRetryDay, formatTimestamp } from "@/lib/schedule";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { WorkshopStatusChips } from "@/components/admin/StripeStatusChip";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PlanStatusChip } from "@/components/dashboard/StatusChip";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { resendBankLink, restoreWorkshop, suspendWorkshop } from "../../actions";

export const metadata: Metadata = { title: "Workshop" };

const NOTICES = {
  suspended: ["bg-danger-pale text-danger", "Access suspended. Staff have been signed out and can't log in."],
  restored: ["bg-accent-pale text-accent-ink", "Access restored. Staff can log in again."],
  unchanged: ["bg-edge/60 text-body", "Nothing changed: the workshop was already in that state."],
  "link-sent": ["bg-accent-pale text-accent-ink", "The customer has been emailed their plan link."],
  "link-queued": ["bg-pending-pale text-pending", "The email is queued and will be retried on the next debit job run."],
  "link-not-configured": [
    "bg-pending-pale text-pending",
    "Email delivery isn't set up yet (RESEND_API_KEY and EMAIL_FROM), so the email was recorded but not sent.",
  ],
  "link-not-needed": ["bg-edge/60 text-body", "That plan isn't waiting on bank details any more."],
} as const;

const MESSAGE_STATUS: Record<OutboxText["status"], string> = {
  sent: "bg-accent-pale text-accent-ink",
  pending: "bg-pending-pale text-pending",
  sending: "bg-pending-pale text-pending",
  skipped: "bg-edge/60 text-body",
  failed: "bg-danger-pale text-danger",
};

function YesNo({ value }: { value: boolean }) {
  return <span className={`font-semibold ${value ? "text-accent-ink" : "text-pending"}`}>{value ? "Yes" : "Not yet"}</span>;
}

export default async function AdminWorkshopPage({ params, searchParams }: PageProps<"/admin/workshops/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { notice } = await searchParams;

  const centre = await getWorkshop(Number(id));
  if (!centre) notFound();

  const [members, plans, failedPayments, emails, texts, audit] = await Promise.all([
    listWorkshopMembers(centre.id),
    listPlans(centre.id),
    listFailedPayments(centre.id),
    listWorkshopEmails(centre.id),
    listWorkshopTexts(centre.id),
    listAuditLog({ centreId: centre.id, limit: 10 }),
  ]);

  const shownNotice = typeof notice === "string" && notice in NOTICES ? NOTICES[notice as keyof typeof NOTICES] : null;
  const stripeDashboardUrl = centre.stripe_account_id
    ? `https://dashboard.stripe.com/${process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ? "test/" : ""}connect/accounts/${centre.stripe_account_id}`
    : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        title={centre.name}
        back={{ href: "/admin", label: "All workshops" }}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>{centre.email}</span>
            <WorkshopStatusChips centre={centre} />
          </span>
        }
      />

      {shownNotice && (
        <p role="status" className={`mt-6 rounded-2xl px-5 py-3 text-sm font-semibold ${shownNotice[0]}`}>
          {shownNotice[1]}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-edge bg-surface p-6">
          <div className="flex items-start gap-3">
            {centre.suspended_at ? (
              <LockKey size={24} weight="fill" className="mt-0.5 shrink-0 text-danger" />
            ) : (
              <LockKeyOpen size={24} weight="duotone" className="mt-0.5 shrink-0 text-accent-ink" />
            )}
            <div>
              <h2 className="text-lg font-bold">Halfshaft access</h2>
              <p className="mt-1 text-sm leading-relaxed text-body">
                {centre.suspended_at
                  ? `Suspended ${formatTimestamp(centre.suspended_at)}. Staff can't log in. Debits on existing plans keep running into the workshop's Stripe account, and customers can still use their plan links.`
                  : "Suspending signs out every staff member and blocks their logins. Debits on existing plans keep running and customers aren't affected."}
              </p>
            </div>
          </div>
          {centre.suspended_at ? (
            <form action={restoreWorkshop.bind(null, centre.id)} className="mt-5">
              <ConfirmButton pendingLabel="Restoring" confirmMessage={`Restore Halfshaft access for ${centre.name}?`}>
                Restore access
              </ConfirmButton>
            </form>
          ) : (
            <form action={suspendWorkshop.bind(null, centre.id)} className="mt-5">
              <ConfirmButton
                className="btn bg-danger text-canvas hover:opacity-90"
                pendingLabel="Suspending"
                confirmMessage={`Suspend Halfshaft access for ${centre.name}? Their staff are signed out straight away.`}
              >
                Suspend access
              </ConfirmButton>
            </form>
          )}
        </section>

        <section className="rounded-3xl border border-edge bg-surface p-6">
          <h2 className="text-lg font-bold">Stripe account</h2>
          {centre.stripe_account_id ? (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-mute">Account</dt>
                <dd className="break-all font-mono text-xs">{centre.stripe_account_id}</dd>
                <dt className="text-mute">Details submitted</dt>
                <dd><YesNo value={centre.details_submitted} /></dd>
                <dt className="text-mute">Charges enabled</dt>
                <dd><YesNo value={centre.charges_enabled} /></dd>
                <dt className="text-mute">Payouts enabled</dt>
                <dd><YesNo value={centre.payouts_enabled} /></dd>
                <dt className="text-mute">BECS Direct Debit</dt>
                <dd className="font-semibold">{centre.becs_capability ?? "Not requested"}</dd>
              </dl>
              {stripeDashboardUrl && (
                <a
                  href={stripeDashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-ink underline-offset-2 hover:underline"
                >
                  View in Stripe
                  <ArrowSquareOut size={16} weight="bold" />
                </a>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-body">The owner hasn&apos;t started Stripe onboarding.</p>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-3xl border border-edge bg-surface">
        <h2 className="px-5 pt-5 text-lg font-bold">Staff</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="text-xs text-mute">
                <th scope="col" className="px-5 py-3 font-semibold">Name</th>
                <th scope="col" className="px-5 py-3 font-semibold">Role</th>
                <th scope="col" className="px-5 py-3 font-semibold">Last login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge border-t border-edge">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-5 py-3">
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-xs text-mute">{member.email}</p>
                  </td>
                  <td className="px-5 py-3 text-body">{member.role === "owner" ? "Owner" : "Staff"}</td>
                  <td className="tabular px-5 py-3 text-body">
                    {member.last_login_at ? formatTimestamp(member.last_login_at) : "No active session"}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-body">No staff logins.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {failedPayments.length > 0 && (
        <section className="mt-6 rounded-3xl border border-edge bg-surface">
          <h2 className="px-5 pt-5 text-lg font-bold">Failed payments</h2>
          <ul className="mt-3 divide-y divide-edge border-t border-edge">
            {failedPayments.map((payment) => (
              <li key={payment.id} className="px-5 py-3 text-sm">
                <p className="font-semibold">
                  {payment.customer_name}: payment {payment.sequence} of {payment.instalment_count} (
                  {formatAud(payment.amount_cents)}) for {payment.description}
                </p>
                <p className="mt-0.5 text-danger">{payment.failure_reason ?? "The debit failed."}</p>
                <p className="mt-0.5 text-xs text-mute">
                  {payment.attempt_count} {payment.attempt_count === 1 ? "attempt" : "attempts"}.{" "}
                  {payment.plan_status === "failed"
                    ? "Paused until the customer adds new bank details."
                    : payment.next_retry_on
                      ? `Retrying ${formatRetryDay(payment.next_retry_on)}.`
                      : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-edge bg-surface">
        <h2 className="px-5 pt-5 text-lg font-bold">Payment plans</h2>
        {plans.length === 0 ? (
          <p className="px-5 pb-5 pt-2 text-sm text-body">No plans yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="text-xs text-mute">
                  <th scope="col" className="px-5 py-3 font-semibold">Customer</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Work</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Amount</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Next debit</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge border-t border-edge">
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="px-5 py-3 font-semibold">{plan.customer_name}</td>
                    <td className="max-w-[14rem] truncate px-5 py-3 text-body">{plan.description}</td>
                    <td className="tabular px-5 py-3">
                      {formatAud(plan.total_amount_cents)}
                      <p className="text-xs text-mute">{formatAud(plan.paid_cents)} paid</p>
                    </td>
                    <td className="tabular px-5 py-3 text-body">{plan.next_due_date ? formatDate(plan.next_due_date) : "None"}</td>
                    <td className="px-5 py-3">
                      <PlanStatusChip status={plan.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {(plan.status === "draft" || plan.status === "failed") && (
                        <form action={resendBankLink.bind(null, plan.id)}>
                          <SubmitButton pendingLabel="Sending" className="text-sm font-semibold text-accent-ink underline-offset-2 hover:underline">
                            Resend bank details link
                          </SubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-edge bg-surface">
        <h2 className="px-5 pt-5 text-lg font-bold">Recent emails</h2>
        {emails.length === 0 ? (
          <p className="px-5 pb-5 pt-2 text-sm text-body">No emails yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="text-xs text-mute">
                  <th scope="col" className="px-5 py-3 font-semibold">Queued</th>
                  <th scope="col" className="px-5 py-3 font-semibold">To</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Subject</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge border-t border-edge">
                {emails.map((email) => (
                  <tr key={email.id} className="align-top">
                    <td className="tabular whitespace-nowrap px-5 py-3 text-body">{formatTimestamp(email.created_at)}</td>
                    <td className="px-5 py-3">
                      <p className="break-all">{email.recipient}</p>
                      <p className="text-xs text-mute">{email.audience === "workshop" ? "Workshop" : "Customer"}</p>
                    </td>
                    <td className="px-5 py-3 text-body">{email.subject}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${MESSAGE_STATUS[email.status]}`}>
                        {email.status}
                      </span>
                      {email.status === "failed" && email.last_error && (
                        <p className="mt-1 max-w-[18rem] text-xs text-danger">{email.last_error}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-edge bg-surface">
        <h2 className="px-5 pt-5 text-lg font-bold">Recent texts</h2>
        {texts.length === 0 ? (
          <p className="px-5 pb-5 pt-2 text-sm text-body">No texts yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="text-xs text-mute">
                  <th scope="col" className="px-5 py-3 font-semibold">Queued</th>
                  <th scope="col" className="px-5 py-3 font-semibold">To</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Message</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge border-t border-edge">
                {texts.map((text) => (
                  <tr key={text.id} className="align-top">
                    <td className="tabular whitespace-nowrap px-5 py-3 text-body">{formatTimestamp(text.created_at)}</td>
                    <td className="tabular whitespace-nowrap px-5 py-3">{formatAuMobile(text.recipient)}</td>
                    <td className="max-w-[26rem] px-5 py-3 text-body">{text.body}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${MESSAGE_STATUS[text.status]}`}>
                        {text.status}
                      </span>
                      {text.status === "failed" && text.last_error && (
                        <p className="mt-1 max-w-[18rem] text-xs text-danger">{text.last_error}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {audit.length > 0 && (
        <section className="mt-6 rounded-3xl border border-edge bg-surface p-5">
          <h2 className="text-lg font-bold">Admin actions on this workshop</h2>
          <ul className="mt-3 divide-y divide-edge text-sm">
            {audit.map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-x-3 py-2.5">
                <span className="tabular w-32 shrink-0 text-mute">{formatTimestamp(entry.created_at)}</span>
                <span className="font-semibold">{entry.action.replaceAll("_", " ")}</span>
                {entry.detail && <span className="text-body">{entry.detail}</span>}
                <span className="ml-auto text-xs text-mute">{entry.admin_name ?? "Removed admin"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

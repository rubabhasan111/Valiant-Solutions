import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  EnvelopeSimple,
  PaperPlaneTilt,
  PauseCircle,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react/ssr";
import type { Instalment, PlanStatus } from "@/lib/db";
import { requireWorkshop } from "@/lib/auth/dal";
import { formatAud } from "@/lib/money";
import { formatAuMobile } from "@/lib/phone";
import { latestPlanLinkDeliveries, type PlanLinkDelivery } from "@/lib/plan-links";
import { getPlanDetail } from "@/lib/plans";
import { MAX_NOTE_LENGTH, PLAN_ACTION_ERRORS, earliestResumeDate } from "@/lib/plan-actions";
import { FREQUENCY_LABEL, formatDate, formatTimestamp } from "@/lib/schedule";
import { appUrl } from "@/lib/stripe";
import { CopyField } from "@/components/dashboard/CopyField";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { InstalmentStatusChip, PlanStatusChip } from "@/components/dashboard/StatusChip";
import { ConfirmButton } from "@/components/forms/ConfirmButton";
import { SubmitButton } from "@/components/forms/SubmitButton";
import {
  cancelPlanAction,
  pausePlanAction,
  recordPaidInFullAction,
  recordPaymentAction,
  resendPlanLink,
  resumePlanAction,
} from "./actions";

export const metadata: Metadata = { title: "Payment plan" };

const SENT_NOTICES = {
  both: "Sent again by email and text.",
  email: "Sent again by email. The customer has no mobile on file, so no text was sent.",
  recent: "That link went out less than a minute ago, so it wasn't sent again.",
  "not-needed": "This plan isn't waiting on bank details.",
} as const;

const DONE_NOTICES = {
  paused: "Plan put on hold. The customer has been told, and nothing will be debited until it resumes.",
  resumed: "Plan resumed. The customer has been told, and payments are debited on their due dates again.",
  cancelled: "Plan cancelled. The customer has been told, and nothing more will be debited.",
  recorded: "Payment recorded. It won't be debited, and the customer has been sent a receipt.",
  "paid-in-full": "Balance recorded as paid. Nothing more will be debited.",
} as const;

const DELIVERY_LABEL: Record<PlanLinkDelivery["status"], string> = {
  sent: "Sent",
  pending: "Sending",
  sending: "Sending",
  skipped: "Not sent yet",
  failed: "Couldn't be sent",
};

export default async function PlanDetailPage({ params, searchParams }: PageProps<"/dashboard/plans/[id]">) {
  const { centre } = await requireWorkshop();
  const { id } = await params;
  const { created, sent, done, problem } = await searchParams;

  const detail = await getPlanDetail(centre.id, Number(id));
  if (!detail) notFound();
  const { plan, customer, instalments } = detail;
  const deliveries = await latestPlanLinkDeliveries(plan.id);

  const collectedCents = instalments.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount_cents, 0);
  const setupLink = `${appUrl()}/pay/${plan.setup_token}`;
  const firstName = customer.full_name.split(" ")[0];
  const sentNotice = typeof sent === "string" && sent in SENT_NOTICES ? SENT_NOTICES[sent as keyof typeof SENT_NOTICES] : null;
  const doneNotice = typeof done === "string" && done in DONE_NOTICES ? DONE_NOTICES[done as keyof typeof DONE_NOTICES] : null;
  const problemNotice =
    typeof problem === "string" && problem in PLAN_ACTION_ERRORS
      ? PLAN_ACTION_ERRORS[problem as keyof typeof PLAN_ACTION_ERRORS]
      : null;
  const open = plan.status === "draft" || plan.status === "active" || plan.status === "paused" || plan.status === "failed";
  // Payments can be marked as paid another way once the plan is running.
  const canRecord = plan.status === "active" || plan.status === "paused" || plan.status === "failed";
  const owingCents = instalments
    .filter((i) => i.status === "scheduled" || i.status === "failed")
    .reduce((sum, i) => sum + i.amount_cents, 0);

  const tiles = [
    { label: "Total", value: formatAud(plan.total_amount_cents) },
    { label: "Collected", value: formatAud(collectedCents) },
    // A cancelled plan's uncollected payments aren't coming, so they're not counted here.
    {
      label: "Still to come",
      value: formatAud(
        instalments.filter((i) => i.status !== "paid" && i.status !== "cancelled").reduce((sum, i) => sum + i.amount_cents, 0),
      ),
    },
    {
      label: "Schedule",
      value: `${plan.instalment_count} ${FREQUENCY_LABEL[plan.frequency].toLowerCase()}`,
    },
  ];

  const linkPanel = (
    <>
      <div className="mt-6">
        <CopyField value={setupLink} label="Customer plan link" />
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="text-sm">
          {deliveries.length === 0 ? (
            <p className="text-mute">This link hasn&apos;t been sent yet.</p>
          ) : (
            <ul className="grid gap-1">
              {deliveries.map((delivery) => (
                <li key={delivery.channel} className="flex flex-wrap items-center gap-x-2 text-body">
                  <span className="font-semibold text-ink">
                    {delivery.channel === "email" ? "Emailed" : "Texted"}{" "}
                    {delivery.channel === "email" ? delivery.recipient : formatAuMobile(delivery.recipient)}
                  </span>
                  <span>{DELIVERY_LABEL[delivery.status]}</span>
                  <span className="text-mute">{formatTimestamp(delivery.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form action={resendPlanLink.bind(null, plan.id)}>
          <SubmitButton pendingLabel="Sending" className="btn btn-secondary">
            <PaperPlaneTilt size={18} weight="bold" />
            Resend to {firstName}
          </SubmitButton>
        </form>
      </div>
    </>
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        title={plan.description}
        back={{ href: "/dashboard/plans", label: "Payment plans" }}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-semibold text-ink">{customer.full_name}</span>
            {customer.vehicle_rego && <span>{customer.vehicle_rego}</span>}
            <PlanStatusChip status={plan.status} />
          </span>
        }
      />

      {created === "1" && (
        <p role="status" className="mt-6 rounded-2xl bg-accent-pale px-5 py-3 text-sm font-semibold text-accent-ink">
          Plan created. {firstName} has been sent their link to add bank details.
        </p>
      )}
      {doneNotice && (
        <p role="status" className="mt-6 rounded-2xl bg-accent-pale px-5 py-3 text-sm font-semibold text-accent-ink">
          {doneNotice}
        </p>
      )}
      {problemNotice && (
        <p role="alert" className="mt-6 rounded-2xl bg-danger-pale px-5 py-3 text-sm font-semibold text-danger">
          {problemNotice}
        </p>
      )}
      {sentNotice && (
        <p role="status" className="mt-6 rounded-2xl bg-accent-pale px-5 py-3 text-sm font-semibold text-accent-ink">
          {sentNotice}
        </p>
      )}

      {plan.status === "draft" && (
        <section className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-pale text-accent-ink">
              <EnvelopeSimple size={22} weight="duotone" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold tracking-tight">Waiting on {firstName}&apos;s bank details</h2>
              <p className="mt-2 max-w-[62ch] leading-relaxed text-body">
                They&apos;ve been sent this link by email and text. It shows the schedule, then takes them to
                Stripe&apos;s secure page to add their bank details. The plan starts collecting as soon as they finish.
              </p>
            </div>
          </div>
          {linkPanel}
          <a
            href={setupLink}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-ink underline-offset-2 hover:underline"
          >
            Preview what {firstName} sees
            <ArrowSquareOut size={16} weight="bold" />
          </a>
        </section>
      )}

      {plan.status === "active" && (
        <section className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-3xl bg-accent-pale px-6 py-5">
          <CheckCircle size={26} weight="fill" className="text-accent-ink" />
          <h2 className="font-bold text-accent-ink">Collecting automatically</h2>
          <p className="text-sm text-body">
            Each payment is debited from {firstName}&apos;s bank account into your Stripe account on its due date, and
            they get a reminder two days before. Failed payments are retried until they&apos;re paid.
          </p>
        </section>
      )}

      {plan.status === "completed" && (
        <section className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-3xl bg-accent-pale px-6 py-5">
          <CheckCircle size={26} weight="fill" className="text-accent-ink" />
          <h2 className="font-bold text-accent-ink">Paid off</h2>
          <p className="text-sm text-body">Every instalment on this plan has been collected.</p>
        </section>
      )}

      {plan.status === "paused" && (
        <section className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
          <div className="flex flex-wrap items-start gap-4">
            <PauseCircle size={28} weight="fill" className="mt-0.5 shrink-0 text-pending" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold tracking-tight">On hold</h2>
              <p className="mt-2 max-w-[62ch] leading-relaxed text-body">
                Nothing is being debited
                {plan.resume_on
                  ? ` until ${formatDate(plan.resume_on)}, when payments start again by themselves.`
                  : " until you resume the plan."}{" "}
                When it resumes, the remaining due dates move back by the time it was on hold.
              </p>
              {plan.hold_reason && <p className="mt-2 text-sm text-mute">Reason: {plan.hold_reason}</p>}
            </div>
            <form action={resumePlanAction.bind(null, plan.id)} className="shrink-0">
              <SubmitButton pendingLabel="Resuming" className="btn btn-primary">
                Resume now
              </SubmitButton>
            </form>
          </div>
        </section>
      )}

      {plan.status === "cancelled" && (
        <section className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-3xl bg-edge/40 px-6 py-5">
          <XCircle size={26} weight="fill" className="text-mute" />
          <h2 className="font-bold">Cancelled{plan.cancelled_at ? ` ${formatTimestamp(plan.cancelled_at)}` : ""}</h2>
          <p className="text-sm text-body">
            No more payments will be debited.{plan.cancel_reason ? ` Reason: ${plan.cancel_reason}` : ""}
          </p>
        </section>
      )}

      {plan.status === "failed" && (
        <section className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
          <div className="flex items-start gap-4">
            <WarningCircle size={28} weight="fill" className="mt-0.5 shrink-0 text-pending" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold tracking-tight">Waiting on new bank details</h2>
              <p className="mt-2 max-w-[62ch] leading-relaxed text-body">
                {plan.failure_reason ?? "This plan can't be debited right now."} {firstName} has been sent a link to add
                new bank details. The plan resumes by itself once they do, and missed payments are collected
                automatically.
              </p>
            </div>
          </div>
          {linkPanel}
        </section>
      )}

      <section aria-label="Plan totals" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value }) => (
          <div key={label} className="rounded-3xl border border-edge bg-surface p-5">
            <p className="text-sm text-mute">{label}</p>
            <p className="tabular mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-3xl border border-edge bg-surface">
          <h2 className="px-5 pt-5 text-lg font-bold">Instalments</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-xs text-mute">
                  <th scope="col" className="px-5 py-3 font-semibold">#</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Due</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Amount</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  {canRecord && (
                    <th scope="col" className="px-5 py-3 font-semibold">
                      <span className="sr-only">Record a payment</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-edge border-t border-edge">
                {instalments.map((instalment) => (
                  <tr key={instalment.id} className="align-top">
                    <td className="px-5 py-3 text-mute">{instalment.sequence}</td>
                    <td className="px-5 py-3">{formatDate(instalment.due_date)}</td>
                    <td className="px-5 py-3 font-semibold">{formatAud(instalment.amount_cents)}</td>
                    <td className="px-5 py-3">
                      <InstalmentStatus instalment={instalment} firstName={firstName} planStatus={plan.status} />
                    </td>
                    {canRecord && (
                      <td className="px-5 py-3 text-right">
                        {(instalment.status === "scheduled" || instalment.status === "failed") && (
                          <details className="inline-block text-left">
                            <summary className="cursor-pointer list-none text-xs font-semibold text-accent-ink underline-offset-2 hover:underline">
                              Paid another way?
                            </summary>
                            <form
                              action={recordPaymentAction.bind(null, plan.id, instalment.id)}
                              className="mt-2 grid w-56 gap-2"
                            >
                              <label htmlFor={`note-${instalment.id}`} className="text-xs text-mute">
                                How was it paid? (optional)
                              </label>
                              <input
                                id={`note-${instalment.id}`}
                                name="note"
                                maxLength={MAX_NOTE_LENGTH}
                                placeholder="Cash at the counter"
                                className="field text-sm"
                              />
                              <ConfirmButton
                                pendingLabel="Recording"
                                className="btn btn-secondary text-sm"
                                confirmMessage={`Mark payment ${instalment.sequence} (${formatAud(instalment.amount_cents)}) as paid? It won't be debited.`}
                              >
                                Mark as paid
                              </ConfirmButton>
                            </form>
                          </details>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="self-start rounded-3xl border border-edge bg-surface p-5">
          <h2 className="text-lg font-bold">Customer</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-mute">Name</dt>
              <dd className="font-semibold">{customer.full_name}</dd>
            </div>
            <div>
              <dt className="text-mute">Email</dt>
              <dd className="break-all font-semibold">{customer.email}</dd>
            </div>
            <div>
              <dt className="text-mute">Mobile</dt>
              <dd className="font-semibold">
                {customer.phone ? formatAuMobile(customer.phone) : "Not recorded, so reminders go by email"}
              </dd>
            </div>
            <div>
              <dt className="text-mute">Vehicle rego</dt>
              <dd className="font-semibold">{customer.vehicle_rego ?? "Not recorded"}</dd>
            </div>
          </dl>
          {(plan.status === "active" || plan.status === "paused") && (
            <p className="mt-4 text-xs leading-relaxed text-mute">
              Reminders are sent two days before each payment, and {firstName} gets a receipt each time one clears.
            </p>
          )}
        </section>
      </div>

      {open && (
        <section className="mt-6 rounded-3xl border border-edge bg-surface p-5 md:p-6">
          <h2 className="text-lg font-bold">Manage this plan</h2>
          <p className="mt-1 max-w-[62ch] text-sm text-body">
            {firstName} gets {customer.phone ? "a text and an email" : "an email"} whenever you put the plan on hold, resume it or cancel it.
          </p>
          <div className="mt-4 grid gap-3">
            {plan.status === "active" && (
              <ManageOption title="Put on hold" hint="For hardship, a dispute, or while they change banks.">
                <form action={pausePlanAction.bind(null, plan.id)} className="grid gap-3 sm:max-w-md">
                  <NoteField id="hold-reason" name="reason" label="Reason (only you see this)" placeholder="Customer asked for a month off" />
                  <div className="grid gap-2">
                    <label htmlFor="resumeOn" className="text-sm font-semibold">
                      Start payments again on <span className="font-normal text-mute">(optional)</span>
                    </label>
                    <input id="resumeOn" name="resumeOn" type="date" min={earliestResumeDate()} className="field" />
                    <p className="text-xs text-mute">Leave empty to resume it yourself.</p>
                  </div>
                  <SubmitButton pendingLabel="Putting on hold" className="btn btn-secondary justify-self-start">
                    Put on hold
                  </SubmitButton>
                </form>
              </ManageOption>
            )}

            {canRecord && owingCents > 0 && (
              <ManageOption
                title="Paid off in full"
                hint={`${firstName} paid the remaining ${formatAud(owingCents)} another way, so nothing more should be debited.`}
              >
                <form action={recordPaidInFullAction.bind(null, plan.id)} className="grid gap-3 sm:max-w-md">
                  <NoteField id="full-note" name="note" label="How was it paid? (optional)" placeholder="Bank transfer" />
                  <ConfirmButton
                    pendingLabel="Recording"
                    className="btn btn-secondary justify-self-start"
                    confirmMessage={`Record the remaining ${formatAud(owingCents)} as paid? Nothing more will be debited.`}
                  >
                    Record as paid in full
                  </ConfirmButton>
                </form>
              </ManageOption>
            )}

            <ManageOption title="Cancel plan" hint="Stops every payment still to come. This can't be undone." danger>
              <form action={cancelPlanAction.bind(null, plan.id)} className="grid gap-3 sm:max-w-md">
                <NoteField id="cancel-reason" name="reason" label="Reason (only you see this)" placeholder="Created by mistake" />
                <ConfirmButton
                  pendingLabel="Cancelling"
                  className="btn btn-secondary justify-self-start text-danger"
                  confirmMessage={`Cancel ${customer.full_name}'s plan? No more payments will be debited, and this can't be undone.`}
                >
                  Cancel plan
                </ConfirmButton>
              </form>
            </ManageOption>
          </div>
        </section>
      )}
    </main>
  );
}

function ManageOption({
  title,
  hint,
  danger,
  children,
}: {
  title: string;
  hint: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="rounded-2xl border border-edge px-4 py-3">
      <summary className="cursor-pointer list-none">
        <span className={`font-semibold ${danger ? "text-danger" : "text-ink"}`}>{title}</span>
        <span className="mt-0.5 block text-sm text-mute">{hint}</span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function NoteField({ id, name, label, placeholder }: { id: string; name: string; label: string; placeholder: string }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input id={id} name={name} maxLength={MAX_NOTE_LENGTH} placeholder={placeholder} className="field" />
    </div>
  );
}

function InstalmentStatus({
  instalment,
  firstName,
  planStatus,
}: {
  instalment: Instalment;
  firstName: string;
  planStatus: PlanStatus;
}) {
  const planPaused = planStatus === "failed";
  const note = (text: string) => <p className="mt-1 max-w-[24rem] text-xs text-mute">{text}</p>;

  return (
    <>
      <InstalmentStatusChip status={instalment.status} />
      {instalment.status === "paid" &&
        instalment.paid_at &&
        note(
          instalment.paid_outside_stripe
            ? `Paid another way, recorded ${formatDate(instalment.paid_at)}${instalment.payment_note ? `: ${instalment.payment_note}` : ""}`
            : `Cleared ${formatDate(instalment.paid_at)}`,
        )}
      {instalment.status === "failed" && planStatus === "paused" && note("Collected again when the plan resumes.")}
      {instalment.status === "failed" && planStatus !== "paused" && (
        <>
          <p className="mt-1 max-w-[24rem] text-xs text-danger">{instalment.failure_reason ?? "The debit failed."}</p>
          {note(
            planPaused
              ? `Waiting for ${firstName}'s new bank details.`
              : `Retrying automatically until it's paid. ${firstName} has been told.`,
          )}
        </>
      )}
    </>
  );
}

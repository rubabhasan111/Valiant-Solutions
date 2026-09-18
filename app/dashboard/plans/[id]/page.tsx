import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowSquareOut, CheckCircle, EnvelopeSimple, PaperPlaneTilt, WarningCircle } from "@phosphor-icons/react/ssr";
import type { Instalment } from "@/lib/db";
import { requireWorkshop } from "@/lib/auth/dal";
import { formatAud } from "@/lib/money";
import { formatAuMobile } from "@/lib/phone";
import { latestPlanLinkDeliveries, type PlanLinkDelivery } from "@/lib/plan-links";
import { getPlanDetail } from "@/lib/plans";
import { FREQUENCY_LABEL, formatDate, formatTimestamp } from "@/lib/schedule";
import { appUrl } from "@/lib/stripe";
import { CopyField } from "@/components/dashboard/CopyField";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { InstalmentStatusChip, PlanStatusChip } from "@/components/dashboard/StatusChip";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { resendPlanLink } from "./actions";

export const metadata: Metadata = { title: "Payment plan" };

const SENT_NOTICES = {
  both: "Sent again by email and text.",
  email: "Sent again by email. The customer has no mobile on file, so no text was sent.",
  recent: "That link went out less than a minute ago, so it wasn't sent again.",
  "not-needed": "This plan isn't waiting on bank details.",
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
  const { created, sent } = await searchParams;

  const detail = await getPlanDetail(centre.id, Number(id));
  if (!detail) notFound();
  const { plan, customer, instalments } = detail;
  const deliveries = await latestPlanLinkDeliveries(plan.id);

  const collectedCents = instalments.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount_cents, 0);
  const setupLink = `${appUrl()}/pay/${plan.setup_token}`;
  const firstName = customer.full_name.split(" ")[0];
  const sentNotice = typeof sent === "string" && sent in SENT_NOTICES ? SENT_NOTICES[sent as keyof typeof SENT_NOTICES] : null;
  const waitingOnBankDetails = plan.status === "draft" || plan.status === "failed";

  const tiles = [
    { label: "Total", value: formatAud(plan.total_amount_cents) },
    { label: "Collected", value: formatAud(collectedCents) },
    { label: "Still to come", value: formatAud(plan.total_amount_cents - collectedCents) },
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
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-edge border-t border-edge">
                {instalments.map((instalment) => (
                  <tr key={instalment.id} className="align-top">
                    <td className="px-5 py-3 text-mute">{instalment.sequence}</td>
                    <td className="px-5 py-3">{formatDate(instalment.due_date)}</td>
                    <td className="px-5 py-3 font-semibold">{formatAud(instalment.amount_cents)}</td>
                    <td className="px-5 py-3">
                      <InstalmentStatus instalment={instalment} firstName={firstName} planPaused={plan.status === "failed"} />
                    </td>
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
          {!waitingOnBankDetails && (
            <p className="mt-4 text-xs leading-relaxed text-mute">
              Reminders are sent two days before each payment, and {firstName} gets a receipt each time one clears.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function InstalmentStatus({
  instalment,
  firstName,
  planPaused,
}: {
  instalment: Instalment;
  firstName: string;
  planPaused: boolean;
}) {
  const note = (text: string) => <p className="mt-1 max-w-[24rem] text-xs text-mute">{text}</p>;

  return (
    <>
      <InstalmentStatusChip status={instalment.status} />
      {instalment.status === "paid" && instalment.paid_at && note(`Cleared ${formatDate(instalment.paid_at)}`)}
      {instalment.status === "failed" && (
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

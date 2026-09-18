import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, WarningCircle } from "@phosphor-icons/react/ssr";
import { getCustomerPlan } from "@/lib/customer/data";
import { requireCustomer } from "@/lib/customer/session";
import { formatAud } from "@/lib/money";
import { FREQUENCY_LABEL, formatDate, formatRetryDay } from "@/lib/schedule";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { InstalmentStatusChip, PlanStatusChip } from "@/components/dashboard/StatusChip";

export const metadata: Metadata = { title: "Your plan" };

export default async function CustomerPlanPage({ params }: PageProps<"/account/plans/[id]">) {
  const email = await requireCustomer();
  const { id } = await params;

  const detail = await getCustomerPlan(email, Number(id));
  if (!detail) notFound();
  const { plan, instalments } = detail;
  const needsBankDetails = plan.status === "draft" || plan.status === "failed";

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12">
      <PageHeader
        title={plan.description}
        back={{ href: "/account", label: "Your payments" }}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-semibold text-ink">{plan.centre_name}</span>
            <span>
              {plan.instalment_count} {FREQUENCY_LABEL[plan.frequency].toLowerCase()} payments
            </span>
            <PlanStatusChip status={plan.status} />
          </span>
        }
      />

      {needsBankDetails && (
        <section className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
          <div className="flex items-start gap-4">
            <WarningCircle size={28} weight="fill" className="mt-0.5 shrink-0 text-pending" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold tracking-tight">
                {plan.status === "failed" ? "Your payments are paused" : "Add your bank details to start"}
              </h2>
              <p className="mt-2 max-w-[62ch] leading-relaxed text-body">
                {plan.status === "failed"
                  ? `${plan.failure_reason ?? "Your bank account couldn't be debited."} Add bank details that can be debited and your plan picks up again. Any missed payment is collected automatically.`
                  : "It takes about two minutes on Stripe's secure page. Your bank details are never stored by the workshop or Halfshaft."}
              </p>
              <a href={`/pay/${plan.setup_token}`} className="btn btn-primary mt-6">
                {plan.status === "failed" ? "Update bank details" : "Add bank details"}
                <ArrowRight size={18} weight="bold" />
              </a>
            </div>
          </div>
        </section>
      )}

      <section aria-label="Totals" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total", value: formatAud(plan.total_amount_cents) },
          { label: "Paid so far", value: formatAud(plan.paid_cents) },
          { label: "Still to pay", value: formatAud(plan.total_amount_cents - plan.paid_cents) },
          {
            label: "Next payment",
            value: plan.next_due_date ? formatDate(plan.next_due_date) : "None",
          },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-3xl border border-edge bg-surface p-5">
            <p className="text-sm text-mute">{label}</p>
            <p className="tabular mt-2 text-xl font-extrabold tracking-tight md:text-2xl">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-3xl border border-edge bg-surface">
        <h2 className="px-5 pt-5 text-lg font-bold">Every payment</h2>
        <ol className="tabular mt-3 divide-y divide-edge border-t border-edge">
          {instalments.map((instalment) => (
            <li key={instalment.id} className="px-5 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="w-6 text-mute">{instalment.sequence}</span>
                <span className="flex-1">{formatDate(instalment.due_date)}</span>
                <span className="font-semibold">{formatAud(instalment.amount_cents)}</span>
                <InstalmentStatusChip status={instalment.status} />
              </div>
              {instalment.status === "failed" && plan.status === "active" && instalment.next_retry_on && (
                <p className="mt-1 pl-10 text-xs text-mute">
                  We&apos;ll try again {formatRetryDay(instalment.next_retry_on)}. Please make sure the funds are in
                  your account.
                </p>
              )}
              {instalment.status === "processing" && (
                <p className="mt-1 pl-10 text-xs text-mute">
                  On its way. Direct debits take a few business days to show on your statement.
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-6 text-sm leading-relaxed text-mute">
        Questions about this plan? Contact {plan.centre_name}
        {plan.centre_phone ? ` on ${plan.centre_phone}` : ""}. Payments are collected by direct debit and processed by
        Stripe.
      </p>
    </main>
  );
}

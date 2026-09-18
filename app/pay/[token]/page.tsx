import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Bank, CheckCircle, ShieldCheck, Signature, WarningCircle } from "@phosphor-icons/react/ssr";
import { formatAud } from "@/lib/money";
import { getPlanByToken } from "@/lib/plans";
import { FREQUENCY_LABEL, formatDate, formatRetryDay } from "@/lib/schedule";
import { InstalmentStatusChip } from "@/components/dashboard/StatusChip";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { startBankSetup } from "./actions";

export const metadata: Metadata = { title: "Your repayment plan" };

const NOTICES = {
  done: { className: "bg-accent-pale text-accent-ink", text: "Your bank details are saved and your plan is active." },
  cancelled: { className: "bg-pending-pale text-pending", text: "You left Stripe before finishing. Your bank details weren't saved." },
  error: { className: "bg-danger-pale text-danger", text: "We couldn't confirm your bank details. Please try again." },
} as const;

export default async function CustomerPlanPage({ params, searchParams }: PageProps<"/pay/[token]">) {
  const { token } = await params;
  const { setup } = await searchParams;

  const data = await getPlanByToken(token);
  if (!data) notFound();
  const { plan, customer, centre, instalments } = data;

  const notice = typeof setup === "string" && setup in NOTICES ? NOTICES[setup as keyof typeof NOTICES] : null;
  const firstName = customer.full_name.split(" ")[0];
  const frequency = FREQUENCY_LABEL[plan.frequency].toLowerCase();
  const centreCanDebit = Boolean(centre.charges_enabled && centre.becs_capability === "active");
  const paidCents = instalments.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount_cents, 0);

  const heading = {
    draft: `Hi ${firstName}, here's your repayment plan`,
    active: "Your repayment plan is active",
    failed: "Your plan needs new bank details",
    completed: "Your plan is paid off",
    cancelled: "This plan is no longer active",
  }[plan.status];

  const summary = [
    { label: "Total", value: formatAud(plan.total_amount_cents) },
    { label: "Payments", value: `${plan.instalment_count}, ${frequency}` },
    { label: "First debit", value: formatDate(instalments[0].due_date) },
    plan.status === "draft"
      ? { label: "Vehicle", value: customer.vehicle_rego ?? "Not recorded" }
      : { label: "Paid so far", value: formatAud(paidCents) },
  ];

  const setupForm = centreCanDebit ? (
    <form action={startBankSetup.bind(null, token)} className="mt-7">
      <SubmitButton pendingLabel="Opening Stripe" className="btn btn-primary w-full sm:w-auto">
        {plan.status === "failed" ? "Add new bank details" : "Add bank details"}
      </SubmitButton>
    </form>
  ) : (
    <p className="mt-7 rounded-2xl bg-pending-pale px-5 py-3 text-sm font-semibold text-pending">
      {centre.name} can&apos;t take direct debits right now. Please contact them about your plan.
    </p>
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 md:py-16">
      {notice && (
        <p role="status" className={`mb-6 rounded-2xl px-5 py-3 text-sm font-semibold ${notice.className}`}>
          {notice.text}
        </p>
      )}

      <p className="text-sm font-semibold text-mute">{centre.name}</p>
      <h1 className="mt-2 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">{heading}</h1>
      <p className="mt-4 max-w-[56ch] text-lg leading-relaxed text-body">
        {centre.name} has split <span className="font-semibold text-ink">{plan.description}</span> into{" "}
        {plan.instalment_count} {frequency} payments, taken by direct debit from your bank account.
      </p>

      <section aria-label="Plan summary" className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {summary.map(({ label, value }) => (
          <div key={label} className="rounded-3xl border border-edge bg-surface p-4">
            <p className="text-xs text-mute">{label}</p>
            <p className="tabular mt-1.5 text-lg font-extrabold tracking-tight">{value}</p>
          </div>
        ))}
      </section>

      {plan.status === "draft" && (
        <section className="mt-6 rounded-3xl border border-edge bg-surface p-6 md:p-8">
          <h2 className="text-xl font-extrabold tracking-tight">Set up your direct debit</h2>
          <ul className="mt-5 grid gap-4">
            <li className="flex gap-3">
              <Bank size={22} weight="duotone" className="mt-0.5 shrink-0 text-accent-ink" />
              <p className="leading-relaxed text-body">Enter your BSB and account number on Stripe&apos;s secure page.</p>
            </li>
            <li className="flex gap-3">
              <Signature size={22} weight="duotone" className="mt-0.5 shrink-0 text-accent-ink" />
              <p className="leading-relaxed text-body">
                Accept the Direct Debit Request so {centre.name} can collect each payment on its due date.
              </p>
            </li>
            <li className="flex gap-3">
              <ShieldCheck size={22} weight="duotone" className="mt-0.5 shrink-0 text-accent-ink" />
              <p className="leading-relaxed text-body">
                Payments are processed by Stripe. Your bank details are never stored by {centre.name} or Halfshaft.
              </p>
            </li>
          </ul>
          {setupForm}
        </section>
      )}

      {plan.status === "failed" && (
        <section className="mt-6 rounded-3xl border border-edge bg-surface p-6 md:p-8">
          <div className="flex items-start gap-3">
            <WarningCircle size={24} weight="fill" className="mt-0.5 shrink-0 text-danger" />
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Your payments are paused</h2>
              <p className="mt-2 leading-relaxed text-body">
                {plan.failure_reason ?? "Your bank account couldn't be debited."} Add bank details that can be debited
                and your plan picks up again. Any missed payment is collected automatically.
              </p>
            </div>
          </div>
          {setupForm}
        </section>
      )}

      {plan.status === "active" && (
        <section className="mt-6 flex items-start gap-3 rounded-3xl bg-accent-pale px-6 py-5">
          <CheckCircle size={24} weight="fill" className="mt-0.5 shrink-0 text-accent-ink" />
          <p className="leading-relaxed text-ink">
            Your direct debit is set up. Each payment is taken on its due date, and BECS payments can take a few
            business days to show in your account.
          </p>
        </section>
      )}

      <section className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-3xl border border-edge bg-surface px-6 py-5">
        <p className="text-sm leading-relaxed text-body">
          Paying more than one workshop, or want this plan on your phone? Sign in with your email address.
        </p>
        <a href="/account/login" className="text-sm font-semibold text-accent-ink underline-offset-2 hover:underline">
          See all your payments
        </a>
      </section>

      <section className="mt-6 rounded-3xl border border-edge bg-surface">
        <h2 className="px-5 pt-5 text-lg font-bold">Payment schedule</h2>
        <ol className="tabular mt-3 divide-y divide-edge border-t border-edge">
          {instalments.map((instalment) => (
            <li key={instalment.id} className="px-5 py-3 text-sm">
              <div className="flex items-center gap-4">
                <span className="w-6 text-mute">{instalment.sequence}</span>
                <span className="flex-1">{formatDate(instalment.due_date)}</span>
                <span className="font-semibold">{formatAud(instalment.amount_cents)}</span>
                {plan.status !== "draft" && <InstalmentStatusChip status={instalment.status} />}
              </div>
              {instalment.status === "failed" && instalment.next_retry_on && plan.status === "active" && (
                <p className="mt-1 pl-10 text-xs text-mute">We&apos;ll try again {formatRetryDay(instalment.next_retry_on)}.</p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

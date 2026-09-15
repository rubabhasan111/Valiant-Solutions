import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle, Plus, Receipt, WarningCircle } from "@phosphor-icons/react/ssr";
import { requireWorkshop } from "@/lib/auth/dal";
import { getCentreStats, getOnboardingStatus, type OnboardingStatus } from "@/lib/centres";
import { formatAud } from "@/lib/money";
import { listWaitingOnCustomers } from "@/lib/notifications";
import { listPlans } from "@/lib/plans";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { PlanTable } from "@/components/dashboard/PlanTable";
import { StripePanel } from "@/components/dashboard/StripePanel";

export const metadata: Metadata = { title: "Overview" };

const NOTICES = {
  returned: { className: "bg-accent-pale text-accent-ink", text: "Welcome back from Stripe. The status below is freshly checked." },
  "owner-only": { className: "bg-pending-pale text-pending", text: "Only the workshop owner can complete Stripe onboarding." },
  error: { className: "bg-danger-pale text-danger", text: "Stripe onboarding couldn't be started. Try again in a moment." },
} as const;

function onboardingSummary(status: OnboardingStatus): string {
  if (!status.hasAccount) return "Stripe verifies your business and bank account before you can offer repayment plans.";
  if (status.outstanding > 0) {
    return `Stripe still needs ${status.outstanding} ${status.outstanding === 1 ? "detail" : "details"} before it can switch on BECS Direct Debit.`;
  }
  return "Stripe is reviewing your details. This page checks the latest status each time you open it.";
}

export default async function DashboardOverviewPage({ searchParams }: PageProps<"/dashboard">) {
  const { user, centre, role } = await requireWorkshop();
  const { onboarding } = await searchParams;
  const notice = typeof onboarding === "string" && onboarding in NOTICES ? NOTICES[onboarding as keyof typeof NOTICES] : null;

  const [status, stats, recentPlans, waiting] = await Promise.all([
    getOnboardingStatus(centre),
    getCentreStats(centre.id),
    listPlans(centre.id, 5),
    listWaitingOnCustomers(centre.id),
  ]);
  const tiles = [
    { label: "Customers", value: String(stats.customers) },
    { label: "Active plans", value: String(stats.activePlans) },
    { label: "Collected this month", value: formatAud(stats.receivedThisMonthCents) },
    { label: "Payments retrying", value: String(stats.paymentsRetrying) },
  ];

  const newPlanButton = (
    <Link href="/dashboard/plans/new" className="btn btn-primary">
      <Plus size={18} weight="bold" />
      New plan
    </Link>
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-mute">Welcome back, {user.name.split(" ")[0]}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">Overview</h1>
        </div>
        {status.ready && newPlanButton}
      </header>

      {notice && (
        <p role="status" className={`mt-6 rounded-2xl px-5 py-3 text-sm font-semibold ${notice.className}`}>
          {notice.text}
        </p>
      )}

      {/* Stripe's own alerts, e.g. a verification step that would otherwise pause payouts. */}
      {centre.stripe_account_id && (
        <StripePanel panel="alerts" publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY} />
      )}

      {status.ready ? (
        <section className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-3xl bg-accent-pale px-6 py-5">
          <CheckCircle size={26} weight="fill" className="text-accent-ink" />
          <h2 className="font-bold text-accent-ink">Payments are switched on</h2>
          <p className="text-sm text-body">BECS Direct Debit is active on your Stripe account.</p>
        </section>
      ) : (
        <section className="mt-8 grid gap-8 rounded-3xl border border-edge bg-surface p-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:p-8">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              {status.hasAccount ? "Finish setting up payments" : "Connect your Stripe account"}
            </h2>
            <p className="mt-3 leading-relaxed text-body">{onboardingSummary(status)}</p>
            {status.syncFailed && (
              <p className="mt-3 text-sm font-semibold text-pending">
                Stripe couldn&apos;t be reached just now, so this may be out of date.
              </p>
            )}
            {role === "owner" ? (
              <a href="/dashboard/onboarding/start" className="btn btn-primary mt-6">
                {status.hasAccount ? "Continue with Stripe" : "Start Stripe onboarding"}
                <ArrowRight size={18} weight="bold" />
              </a>
            ) : (
              <p className="mt-6 text-sm font-semibold text-mute">Ask your workshop owner to finish Stripe onboarding.</p>
            )}
          </div>
          <OnboardingChecklist status={status} />
        </section>
      )}

      {waiting.length > 0 && (
        <section className="mt-6 rounded-3xl border border-edge bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold">Waiting on customers</h2>
              <p className="text-sm text-body">These are retried automatically, and you&apos;ll get an update as each one clears.</p>
            </div>
            <Link href="/dashboard/activity" className="text-sm font-semibold text-accent-ink underline-offset-2 hover:underline">
              View activity
            </Link>
          </div>
          <ul className="divide-y divide-edge border-t border-edge">
            {waiting.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-4">
                <WarningCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-pending" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-body">{item.body}</p>
                </div>
                {item.payment_plan_id && (
                  <Link
                    href={`/dashboard/plans/${item.payment_plan_id}`}
                    className="shrink-0 text-sm font-semibold text-accent-ink underline-offset-2 hover:underline"
                  >
                    View plan
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Summary" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value }) => (
          <div key={label} className="rounded-3xl border border-edge bg-surface p-5">
            <p className="text-sm text-mute">{label}</p>
            <p className="tabular mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">{value}</p>
          </div>
        ))}
      </section>

      <div className="mt-6">
        {recentPlans.length > 0 ? (
          <section className="rounded-3xl border border-edge bg-surface">
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <h2 className="text-lg font-bold">Recent plans</h2>
              <Link href="/dashboard/plans" className="text-sm font-semibold text-accent-ink underline-offset-2 hover:underline">
                View all
              </Link>
            </div>
            <PlanTable plans={recentPlans} />
          </section>
        ) : (
          <EmptyState
            icon={<Receipt size={24} weight="duotone" />}
            title="No payment plans yet"
            body={
              status.ready
                ? "Set up a plan at the counter, then send the customer their link to add bank details."
                : "Once Stripe switches on BECS Direct Debit, you can start offering customers repayment plans."
            }
            action={status.ready ? newPlanButton : undefined}
          />
        )}
      </div>
    </main>
  );
}

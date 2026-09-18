import Link from "next/link";
import { ArrowRight, CheckCircle, WarningCircle } from "@phosphor-icons/react/ssr";
import { listCustomerPlans } from "@/lib/customer/data";
import { requireCustomer } from "@/lib/customer/session";
import { formatAud } from "@/lib/money";
import { FREQUENCY_LABEL, formatDate } from "@/lib/schedule";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PlanStatusChip } from "@/components/dashboard/StatusChip";

export default async function CustomerPlansPage() {
  const email = await requireCustomer();
  const plans = await listCustomerPlans(email);

  const owing = plans.filter((plan) => plan.status === "active" || plan.status === "failed" || plan.status === "draft");
  const stillToPay = owing.reduce((sum, plan) => sum + plan.total_amount_cents - plan.paid_cents, 0);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Your payments</h1>
        <p className="mt-2 text-body">
          {plans.length === 0
            ? "Nothing here yet."
            : `${formatAud(stillToPay)} left to pay across ${owing.length} ${owing.length === 1 ? "plan" : "plans"}.`}
        </p>
      </header>

      <div className="mt-8 grid gap-4">
        {plans.length === 0 && (
          <EmptyState
            icon={<CheckCircle size={24} weight="duotone" />}
            title="No repayment plans"
            body="When a workshop sets up a plan for you, it appears here. Use the same email address they have on file."
          />
        )}

        {plans.map((plan) => {
          const remaining = plan.total_amount_cents - plan.paid_cents;
          const percentPaid = Math.round((plan.paid_cents / plan.total_amount_cents) * 100);
          const needsBankDetails = plan.status === "draft" || plan.status === "failed";

          return (
            <article key={plan.id} className="rounded-3xl border border-edge bg-surface p-6 md:p-7">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-mute">{plan.centre_name}</p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-tight">{plan.description}</h2>
                </div>
                <PlanStatusChip status={plan.status} />
              </div>

              <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-y border-edge py-4">
                <div>
                  <p className="text-sm text-mute">Paid so far</p>
                  <p className="tabular mt-1 text-3xl font-extrabold tracking-tight">{formatAud(plan.paid_cents)}</p>
                </div>
                <p className="tabular pb-1 text-right text-sm text-body">
                  of {formatAud(plan.total_amount_cents)}
                  <br />
                  <span className="text-mute">{formatAud(remaining)} to go</span>
                </p>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-edge">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, percentPaid)}%` }} />
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-body">
                  {plan.status === "completed" ? (
                    "Paid off. Nothing more to pay."
                  ) : needsBankDetails ? (
                    <span className="inline-flex items-center gap-2 font-semibold text-danger">
                      <WarningCircle size={18} weight="fill" />
                      Needs your bank details
                    </span>
                  ) : plan.next_due_date ? (
                    <>
                      Next payment{" "}
                      <span className="font-semibold text-ink">
                        {formatAud(plan.next_amount_cents ?? 0)} on {formatDate(plan.next_due_date)}
                      </span>
                      , {FREQUENCY_LABEL[plan.frequency].toLowerCase()}
                    </>
                  ) : (
                    "No payments scheduled."
                  )}
                </p>

                <div className="flex flex-wrap gap-3">
                  {needsBankDetails && (
                    <a href={`/pay/${plan.setup_token}`} className="btn btn-primary">
                      {plan.status === "failed" ? "Update bank details" : "Add bank details"}
                      <ArrowRight size={18} weight="bold" />
                    </a>
                  )}
                  <Link href={`/account/plans/${plan.id}`} className="btn btn-secondary">
                    View payments
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

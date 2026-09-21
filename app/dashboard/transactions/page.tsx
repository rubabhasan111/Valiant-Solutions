import type { Metadata } from "next";
import Link from "next/link";
import { DownloadSimple } from "@phosphor-icons/react/ssr";
import { requireWorkshop } from "@/lib/auth/dal";
import { addDays, addMonths, todayInSydney } from "@/lib/schedule";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StripePanel } from "@/components/dashboard/StripePanel";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const { centre, role } = await requireWorkshop();
  const connected = Boolean(centre.stripe_account_id && centre.details_submitted);
  // Defaults to last calendar month, the usual request from an accountant.
  const today = todayInSydney();
  const thisMonthStart = `${today.slice(0, 8)}01`;
  const lastMonthStart = addMonths(thisMonthStart, -1);
  const lastMonthEnd = addDays(thisMonthStart, -1);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        title="Transactions"
        description="Every direct debit from your customers' bank accounts into your Stripe account."
      />

      <p className="mt-6 rounded-2xl bg-accent-pale px-5 py-4 text-sm leading-relaxed text-ink">
        Stripe deducts its standard processing fee from each payment in your own Stripe account. Halfshaft doesn&apos;t
        take any part of your payments.
      </p>

      {role === "owner" && (
        <section className="mt-6 rounded-3xl border border-edge bg-surface p-5 md:p-6">
          <h2 className="text-lg font-bold">Download for your accountant</h2>
          <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-body">
            A spreadsheet (CSV) of your plan payments, including ones you recorded as paid another way. Opens in Excel,
            Numbers or Google Sheets. Stripe&apos;s fees are listed in your Stripe account.
          </p>
          {/* A plain GET form: the browser downloads the file, no JavaScript needed. */}
          <form action="/dashboard/export" method="get" className="mt-5 flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <label htmlFor="kind" className="text-sm font-semibold">
                What to include
              </label>
              <select id="kind" name="kind" defaultValue="received" className="field">
                <option value="received">Payments received, by date paid</option>
                <option value="schedule">Every payment due, by due date</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="from" className="text-sm font-semibold">
                From
              </label>
              <input id="from" name="from" type="date" required defaultValue={lastMonthStart} className="field" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="to" className="text-sm font-semibold">
                To
              </label>
              <input id="to" name="to" type="date" required defaultValue={lastMonthEnd} className="field" />
            </div>
            <button type="submit" className="btn btn-primary">
              <DownloadSimple size={18} weight="bold" />
              Download CSV
            </button>
          </form>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-edge bg-surface p-4 md:p-6">
        {connected ? (
          <StripePanel panel="payments" publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY} />
        ) : (
          <div className="px-2 py-8 text-center">
            <h2 className="text-lg font-bold">No transactions yet</h2>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-body">
              Customer payments show here once Stripe has verified your workshop and plans start collecting.
            </p>
            <Link href="/dashboard" className="btn btn-primary mt-6">
              Check onboarding status
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

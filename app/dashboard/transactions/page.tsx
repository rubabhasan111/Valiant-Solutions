import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkshop } from "@/lib/auth/dal";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StripePanel } from "@/components/dashboard/StripePanel";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const { centre } = await requireWorkshop();
  const connected = Boolean(centre.stripe_account_id && centre.details_submitted);

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

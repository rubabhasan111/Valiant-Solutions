import type { Metadata } from "next";
import Link from "next/link";
import { ArrowSquareOut, ArrowsClockwise, Bank, CalendarCheck } from "@phosphor-icons/react/ssr";
import { requireWorkshop } from "@/lib/auth/dal";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StripePanel } from "@/components/dashboard/StripePanel";

export const metadata: Metadata = { title: "Payouts" };

const HOW_MONEY_ARRIVES = [
  {
    Icon: CalendarCheck,
    title: "Customers pay on schedule",
    body: "Each direct debit takes a few business days to clear, then joins your Stripe balance, less Stripe's fee.",
  },
  {
    Icon: ArrowsClockwise,
    title: "Failed payments are retried",
    body: "If a payment fails, it's retried automatically until your customer's bank account pays it.",
  },
  {
    Icon: Bank,
    title: "Stripe pays your bank",
    body: "Your balance is paid out to your business bank account on your payout schedule.",
  },
];

export default async function PayoutsPage({ searchParams }: PageProps<"/dashboard/payouts">) {
  const { centre, role } = await requireWorkshop();
  const { stripe } = await searchParams;
  const connected = Boolean(centre.stripe_account_id && centre.details_submitted);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        title="Payouts"
        description="Your Stripe balance and the payouts sent to your bank account."
        action={
          connected && role === "owner" ? (
            <a href="/dashboard/stripe" className="btn btn-secondary">
              Stripe dashboard
              <ArrowSquareOut size={18} weight="bold" />
            </a>
          ) : undefined
        }
      />

      {stripe === "unavailable" && (
        <p role="status" className="mt-6 rounded-2xl bg-danger-pale px-5 py-3 text-sm font-semibold text-danger">
          The Stripe dashboard couldn&apos;t be opened just now. Try again in a moment.
        </p>
      )}

      <ol className="mt-8 grid gap-3 md:grid-cols-3">
        {HOW_MONEY_ARRIVES.map(({ Icon, title, body }) => (
          <li key={title} className="flex gap-3 rounded-3xl border border-edge bg-surface p-5">
            <Icon size={24} weight="duotone" className="mt-0.5 shrink-0 text-accent-ink" />
            <div>
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-body">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-6 rounded-3xl border border-edge bg-surface p-4 md:p-6">
        {connected ? (
          <StripePanel panel="payouts" publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY} />
        ) : (
          <div className="px-2 py-8 text-center">
            <h2 className="text-lg font-bold">Payouts start once Stripe has verified your workshop</h2>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-body">
              Finish Stripe onboarding so collected payments can be paid out to your bank account.
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

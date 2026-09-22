import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowsClockwise,
  Bank,
  CalendarCheck,
  ChatCircleText,
  CheckCircle,
  CreditCard,
  GearSix,
  ShieldCheck,
} from "@phosphor-icons/react/ssr";

export const metadata: Metadata = {
  title: "Halfshaft for workshops",
  description:
    "Let customers pay off a repair over weeks by direct debit, while the money lands in your own Stripe account automatically.",
};

// What you charge a workshop. Leave `subscription` as null until you've settled on a price,
// and the page says you'll quote it instead of inventing a number.
const PRICING: { setupFee: string | null; subscription: string | null } = {
  setupFee: null,
  subscription: null,
};

const STEPS = [
  {
    Icon: GearSix,
    title: "Set up once",
    body: "Sign up, and Stripe verifies your ABN, your identity and your bank account. About 15 minutes, and nothing to install.",
  },
  {
    Icon: CalendarCheck,
    title: "Offer a plan at the counter",
    body: "Enter the invoice total, pick weekly, fortnightly or monthly, and the customer gets a link by text and email.",
  },
  {
    Icon: ShieldCheck,
    title: "The customer sets up the direct debit",
    body: "They enter their bank details on Stripe's secure page and sign the direct debit request. You never handle their bank details.",
  },
  {
    Icon: Bank,
    title: "Get paid automatically",
    body: "Each instalment is debited on its due date and paid into your own Stripe account, then out to your bank.",
  },
];

const HANDLED = [
  { Icon: ChatCircleText, title: "Customers are reminded", body: "A text two days before every payment, so the money is there." },
  { Icon: ArrowsClockwise, title: "Failed payments retry themselves", body: "Automatically, until they clear. The customer is told; you're told once." },
  { Icon: CreditCard, title: "Bank details fixed without you", body: "If an account closes, the customer is sent a link to update it and the plan resumes on its own." },
  { Icon: CheckCircle, title: "You see everything", body: "Every plan, payment and message in one dashboard, plus your full Stripe account." },
];

export default function ForWorkshopsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 md:py-16">
      <header className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-accent text-on-accent">
          <GearSix size={22} weight="bold" />
        </span>
        <div>
          <p className="text-lg font-extrabold tracking-tight">Halfshaft</p>
          <p className="text-sm text-mute">by Valiant Solutions</p>
        </div>
      </header>

      <h1 className="mt-10 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
        Let customers pay off the repair. Get paid like it was upfront.
      </h1>
      <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-body">
        Halfshaft splits a repair bill into regular direct debits from the customer&apos;s bank account, straight into
        your Stripe account. No chasing, no payment plans written on the back of an invoice, and no credit checks to run.
      </p>

      <section className="mt-12">
        <h2 className="text-2xl font-extrabold tracking-tight">How it works</h2>
        <ol className="mt-5 grid gap-4">
          {STEPS.map(({ Icon, title, body }, index) => (
            <li key={title} className="flex gap-4 rounded-3xl border border-edge bg-surface p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-pale text-accent-ink">
                <Icon size={20} weight="duotone" />
              </span>
              <div>
                <h3 className="font-bold">
                  {index + 1}. {title}
                </h3>
                <p className="mt-1 leading-relaxed text-body">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-extrabold tracking-tight">What it costs you</h2>
        <dl className="mt-5 grid gap-3">
          <div className="rounded-3xl border border-edge bg-surface p-5">
            <dt className="font-bold">Stripe&apos;s processing fee</dt>
            <dd className="mt-1 leading-relaxed text-body">
              1% + 30c per direct debit, capped at $3.50, GST included. Charged to your Stripe account, so a $300
              payment costs $3.30 and $296.70 reaches you.
            </dd>
          </div>
          <div className="rounded-3xl border border-edge bg-surface p-5">
            <dt className="font-bold">Halfshaft</dt>
            <dd className="mt-1 leading-relaxed text-body">
              {PRICING.setupFee && PRICING.subscription
                ? `${PRICING.setupFee} to set up, then ${PRICING.subscription}. No cut of your payments, ever.`
                : "A one-off setup fee and a monthly subscription, quoted before you start. No cut of your payments, ever."}
            </dd>
          </div>
          <div className="rounded-3xl bg-accent-pale p-5">
            <dt className="font-bold text-accent-ink">Your money stays yours</dt>
            <dd className="mt-1 leading-relaxed text-body">
              Customers pay into your own Stripe account, not ours. Halfshaft never holds your money and never takes a
              percentage of it.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-extrabold tracking-tight">What you don&apos;t have to do</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {HANDLED.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-3xl border border-edge bg-surface p-5">
              <Icon size={24} weight="duotone" className="text-accent-ink" />
              <h3 className="mt-3 font-bold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-body">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-extrabold tracking-tight">Worth knowing</h2>
        <dl className="mt-5 grid gap-4 text-body">
          <div>
            <dt className="font-bold text-ink">Who does the customer deal with?</dt>
            <dd className="mt-1 leading-relaxed">
              You. Reminders and receipts go out in your workshop&apos;s name, and replies come to your inbox.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-ink">What if a customer stops paying?</dt>
            <dd className="mt-1 leading-relaxed">
              Payments retry automatically until they clear, and you can see it happening. The agreement is between you
              and your customer, the same as any invoice.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-ink">When does the money arrive?</dt>
            <dd className="mt-1 leading-relaxed">
              Direct debits clear in a few business days, then Stripe pays out to your bank on your normal schedule.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-ink">What do I need to sign up?</dt>
            <dd className="mt-1 leading-relaxed">
              Your ABN, a business bank account, and ID for an owner or director. Stripe checks these, not us.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-12 rounded-3xl bg-accent p-6 text-on-accent md:p-8">
        <h2 className="text-2xl font-extrabold tracking-tight">Want to see it?</h2>
        <p className="mt-2 max-w-[48ch] leading-relaxed">
          A walk-through takes about ten minutes, using test payments so nothing real moves. You&apos;ll see exactly
          what your customers see.
        </p>
      </section>

      <footer className="mt-10 border-t border-edge pt-6 text-sm text-mute">
        <p>Halfshaft is a product of Valiant Solutions. Payments are processed by Stripe.</p>
        <p className="mt-1">Direct debits are taken under a Direct Debit Request signed by your customer.</p>
        <p className="mt-3 flex gap-4">
          <Link href="/guide" className="underline-offset-2 hover:text-ink hover:underline">
            Setup guide
          </Link>
          <Link href="/terms" className="underline-offset-2 hover:text-ink hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="underline-offset-2 hover:text-ink hover:underline">
              Privacy
            </Link>
        </p>
      </footer>
    </main>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  Bank,
  CalendarBlank,
  CheckCircle,
  Clock,
  HandCoins,
  ListChecks,
  Storefront,
  Wrench,
} from "@phosphor-icons/react/ssr";
import { EngineBackdrop } from "@/components/EngineBackdrop";
import { HomeMotion } from "@/components/HomeMotion";
import { formatAud } from "@/lib/money";

const STEPS = [
  {
    Icon: Storefront,
    title: "Connect your workshop",
    body: "Set up your own Stripe account from this site. Stripe verifies your ABN, your identity and your bank account.",
  },
  {
    Icon: Wrench,
    title: "Set up a plan at the counter",
    body: "Enter the invoice total, choose weekly, fortnightly or monthly, and have the customer sign a BECS Direct Debit mandate.",
  },
  {
    Icon: HandCoins,
    title: "Let the debits run",
    body: "Each instalment is debited from the customer's bank account on its due date and paid out to yours.",
  },
];

const STATUS = {
  paid: { label: "Paid", Icon: CheckCircle, icon: "text-accent-ink", chip: "bg-accent-pale text-accent-ink" },
  processing: { label: "Processing", Icon: Clock, icon: "text-pending", chip: "bg-pending-pale text-pending" },
  scheduled: { label: "Scheduled", Icon: CalendarBlank, icon: "text-mute", chip: "bg-edge/60 text-body" },
} as const;

// Illustrative plan for the landing page, not live data.
const EXAMPLE: {
  customer: string;
  vehicle: string;
  job: string;
  instalments: { due: string; cents: number; status: keyof typeof STATUS }[];
} = {
  customer: "Priya Raman",
  vehicle: "2019 Mazda CX-5",
  job: "Major service and front brake pads",
  instalments: [
    { due: "21 Sept", cents: 21410, status: "paid" },
    { due: "5 Oct", cents: 21410, status: "paid" },
    { due: "19 Oct", cents: 21410, status: "processing" },
    { due: "2 Nov", cents: 21410, status: "scheduled" },
    { due: "16 Nov", cents: 21410, status: "scheduled" },
    { due: "30 Nov", cents: 21410, status: "scheduled" },
  ],
};

export default function Home() {
  const total = EXAMPLE.instalments.reduce((sum, item) => sum + item.cents, 0);
  const paid = EXAMPLE.instalments.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.cents, 0);

  return (
    <main className="flex-1">
      <EngineBackdrop />

      <HomeMotion>
        <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col justify-center px-5 pb-20 pt-16 md:px-8 md:pt-24">
          <h1 className="text-[2.6rem] font-extrabold leading-[1.04] tracking-tight sm:text-6xl">
            <span data-hero className="block">
              Service today.
            </span>
            <span data-hero className="block">
              Pay it off in instalments.
            </span>
          </h1>
          <p data-hero className="mt-6 max-w-[46ch] text-lg leading-relaxed text-body md:text-xl">
            Halfshaft lets Australian workshops offer customers direct debit repayment plans, with every instalment
            paid out through Stripe.
          </p>
          <div data-hero className="mt-10 flex flex-wrap gap-3">
            <Link href="/shop/signup" className="btn btn-primary">
              Sign up your workshop
              <ArrowRight size={18} weight="bold" />
            </Link>
            <a href="#how" className="btn btn-secondary">
              See how it works
            </a>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 md:px-8 md:py-32">
          <div data-reveal className="grid gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-20">
            <div className="md:sticky md:top-28 md:self-start">
              <h2 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
                From the service counter to cleared funds
              </h2>
              <p className="mt-5 max-w-[42ch] text-lg leading-relaxed text-body">
                Customers drive away with the work done and repay it over the following weeks, straight from their
                bank account.
              </p>
            </div>
            <ol className="grid gap-4">
              {STEPS.map(({ Icon, title, body }) => (
                <li
                  key={title}
                  className="flex gap-5 rounded-3xl border border-edge bg-surface/90 p-6 backdrop-blur-sm md:p-8"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-on-accent">
                    <Icon size={24} weight="bold" />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold">{title}</h3>
                    <p className="mt-2 leading-relaxed text-body">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
          <div data-reveal className="grid items-center gap-12 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:gap-20">
            <div
              data-plan
              className="rounded-3xl border border-edge bg-surface p-6 shadow-[0_30px_70px_-40px_rgb(14_15_12/0.45)] md:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-mute">Example plan</p>
                  <h3 className="mt-1 text-xl font-bold">{EXAMPLE.job}</h3>
                  <p className="mt-1 text-sm text-body">
                    {EXAMPLE.customer}, {EXAMPLE.vehicle}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-accent-pale px-3 py-1 text-xs font-bold text-accent-ink">
                  Fortnightly
                </span>
              </div>

              <div className="mt-6 flex items-end justify-between gap-4 border-y border-edge py-5">
                <div>
                  <p className="text-sm text-mute">Paid so far</p>
                  <p data-paid-total={paid} className="tabular mt-1 text-4xl font-extrabold tracking-tight">
                    {formatAud(paid)}
                  </p>
                </div>
                <p className="tabular pb-1 text-right text-sm text-body">of {formatAud(total)}</p>
              </div>

              <ul className="mt-2">
                {EXAMPLE.instalments.map((item) => {
                  const { label, Icon, icon, chip } = STATUS[item.status];
                  return (
                    <li key={item.due} data-instalment className="flex items-center gap-4 py-3">
                      <Icon size={22} weight={item.status === "paid" ? "fill" : "regular"} className={`shrink-0 ${icon}`} />
                      <span className="w-16 text-sm font-semibold">{item.due}</span>
                      <span className="tabular flex-1 text-sm text-body">{formatAud(item.cents)}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${chip}`}>{label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h2 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
                Customers always know what&apos;s left to pay
              </h2>
              <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-body">
                Each debit moves from scheduled to processing to paid. BECS payments take a few business days to
                clear, and the plan shows exactly where each one is.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
          <h2 data-reveal className="max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            Payments your workshop doesn&apos;t have to build
          </h2>
          <div data-reveal className="mt-12 grid gap-4 md:grid-cols-3 md:grid-rows-2">
            <article className="flex flex-col justify-between gap-12 rounded-3xl bg-accent p-8 text-on-accent md:col-span-2 md:row-span-2 md:p-10">
              <Bank size={44} weight="duotone" />
              <div>
                <h3 className="text-3xl font-extrabold tracking-tight md:text-4xl">Paid straight to you</h3>
                <p className="mt-3 max-w-[48ch] text-lg leading-relaxed">
                  Every workshop gets its own Stripe account. Customers pay into it directly, Stripe runs the
                  identity checks, and collected instalments are paid out to your bank.
                </p>
              </div>
            </article>
            <article className="rounded-3xl bg-accent-pale p-8">
              <CalendarBlank size={32} weight="duotone" className="text-accent-ink" />
              <h3 className="mt-6 text-xl font-bold">BECS Direct Debit</h3>
              <p className="mt-2 leading-relaxed text-body">
                Instalments come straight from the customer&apos;s Australian bank account under a signed mandate. No
                card needed.
              </p>
            </article>
            <article className="rounded-3xl border border-edge bg-surface p-8">
              <ListChecks size={32} weight="duotone" className="text-accent-ink" />
              <h3 className="mt-6 text-xl font-bold">Every instalment tracked</h3>
              <p className="mt-2 leading-relaxed text-body">
                Follow each debit from scheduled through to paid, and see a failed payment as soon as it happens.
              </p>
            </article>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-28 pt-8 md:px-8 md:pb-36">
          <div
            data-reveal
            className="flex flex-col items-start gap-8 border-t border-edge pt-16 md:flex-row md:items-end md:justify-between"
          >
            <div>
              <h2 className="max-w-[18ch] text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
                Ready to offer repayment plans?
              </h2>
              <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-body">
                Signing up takes you straight to Stripe&apos;s hosted onboarding. This build runs in Stripe test mode.
              </p>
            </div>
            <Link href="/shop/signup" className="btn btn-primary">
              Sign up your workshop
              <ArrowRight size={18} weight="bold" />
            </Link>
          </div>
        </section>
      </HomeMotion>

    </main>
  );
}

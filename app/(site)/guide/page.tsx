import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { appUrl } from "@/lib/stripe";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = {
  title: "Setup guide for workshops",
  description: "How to set up Halfshaft, verify with Stripe, and offer your first customer a repayment plan.",
};

// A guide to hand to a new workshop, on screen or printed. Every step matches what the
// signup, Stripe onboarding and plan pages actually show; keep them in step.

function Step({ n, title, time, children }: { n: number; title: string; time?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="break-inside-avoid border-t border-edge pt-8">
      <div className="flex items-baseline gap-4">
        <span className="tabular grid size-10 shrink-0 place-items-center rounded-2xl bg-accent text-lg font-extrabold text-on-accent print:border print:border-ink print:bg-transparent print:text-ink">
          {n}
        </span>
        <div>
          <h2 id={`step-${n}`} className="text-2xl font-extrabold tracking-tight">
            {title}
          </h2>
          {time && <p className="mt-0.5 text-sm font-semibold text-mute">{time}</p>}
        </div>
      </div>
      <div className="mt-4 grid gap-3 leading-relaxed text-body md:pl-14 [&_li]:ml-5 [&_ol>li]:list-decimal [&_ol]:grid [&_ol]:gap-2 [&_ul>li]:list-disc [&_ul]:grid [&_ul]:gap-1.5">
        {children}
      </div>
    </section>
  );
}

const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-ink">{children}</strong>;

function Tip({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-accent-pale px-4 py-3 text-sm text-ink print:border print:border-edge print:bg-transparent">
      {children}
    </p>
  );
}

export default function GuidePage() {
  // Printed copies can't be clicked, so the address is written out, without the https://.
  const site = appUrl().replace(/^https?:\/\//, "");
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 md:py-16 print:max-w-none print:px-0 print:py-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-mute">Halfshaft for workshops</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">Setup guide</h1>
        </div>
        <PrintButton />
      </div>
      <p className="mt-5 text-lg leading-relaxed text-body">
        From signing up to your first customer paying off a repair by direct debit. Setting up takes about 20 minutes,
        plus however long Stripe takes to check your business (usually minutes, sometimes a business day or two).
      </p>

      <section className="mt-8 break-inside-avoid rounded-3xl border border-edge bg-surface p-5 md:p-6 print:rounded-none">
        <h2 className="text-lg font-bold">Have these ready</h2>
        <ul className="mt-3 grid gap-1.5 text-body [&_li]:ml-5 [&_li]:list-disc">
          <li>Your <B>ABN</B> and business name exactly as registered.</li>
          <li>
            <B>Photo ID</B> (driver licence or passport) for the owner or a director, and their home address and date of
            birth. Stripe is required to check who runs the business.
          </li>
          <li>
            The <B>BSB and account number</B> of the business bank account your customers&apos; payments should be paid into.
          </li>
          <li>A <B>mobile phone</B> for Stripe&apos;s security code, and an email address you check.</li>
        </ul>
      </section>

      <div className="mt-10 grid gap-10">
        <Step n={1} title="Create your Halfshaft account" time="2 minutes">
          <ol>
            <li>
              Go to <B>{site}/shop/signup</B>
              <span className="print:hidden">
                {" "}
                (
                <Link href="/shop/signup" className="font-semibold text-accent-ink underline underline-offset-2">
                  open it
                </Link>
                )
              </span>
              .
            </li>
            <li>
              Enter your <B>business name</B> (as it appears on your ABN), <B>your name</B>, your <B>work email</B> (you log
              in with this), your <B>phone</B>, and choose a <B>password</B> of at least 10 characters.
            </li>
            <li>
              Press <B>Create account</B>. You&apos;re taken straight to Stripe for the next step.
            </li>
          </ol>
        </Step>

        <Step n={2} title="Verify your business with Stripe" time="10 to 15 minutes">
          <p>
            Stripe is the payment company that takes your customers&apos; direct debits and pays the money into your bank.
            Halfshaft never holds your money. Stripe&apos;s page asks for:
          </p>
          <ul>
            <li>your ABN and business details;</li>
            <li>the owner or director&apos;s name, address, date of birth and photo ID;</li>
            <li>the business bank account for payouts;</li>
            <li>
              a <B>statement descriptor</B>: the short name customers see on their bank statement. Use the name they know
              you by, for example <B>HARBOUR AUTO</B>, so the debit isn&apos;t a surprise.
            </li>
          </ul>
          <p>
            When you finish, you&apos;re brought back to your Halfshaft <B>Overview</B>. It shows a checklist: Business
            details, BECS Direct Debit, Card payments and Payouts. You can create plans once <B>BECS Direct Debit</B> says{" "}
            <B>Active</B>. If anything says <B>In review</B>, Stripe is still checking; there&apos;s nothing to do but wait,
            and Stripe emails you if it needs more.
          </p>
          <Tip>
            Closed the Stripe page halfway? Log in to Halfshaft and press <B>Continue with Stripe</B> on the Overview to
            carry on where you left off.
          </Tip>
        </Step>

        <Step n={3} title="Set up your workshop's details" time="2 minutes">
          <ol>
            <li>
              Open <B>Settings</B> in the menu.
            </li>
            <li>
              Check your <B>business name</B>: it starts every text your customers get. Add the <B>phone number</B>{" "}
              customers should call with questions; it&apos;s included in reminder and failed-payment texts.
            </li>
            <li>
              Under <B>Team</B>, add your front-desk staff. You get a link to send each person, and they choose their own
              password. Staff can create plans and record payments, but can&apos;t change settings, download the payments
              file, or change where Stripe pays you.
            </li>
          </ol>
        </Step>

        <Step n={4} title="Offer a customer a repayment plan" time="1 minute per customer">
          <ol>
            <li>
              Go to <B>Payment plans</B> and press <B>New plan</B>.
            </li>
            <li>
              Choose an existing customer or <B>New customer</B>, and enter their <B>full name</B>, <B>email</B>,{" "}
              <B>mobile</B> (reminders are texted to it) and, if you like, their <B>vehicle rego</B>.
            </li>
            <li>
              Describe the <B>work being paid off</B> (the customer sees this, for example &ldquo;Major service and front
              brake pads&rdquo;), the <B>total amount</B>, the <B>number of payments</B> (2 to 52), <B>how often</B>{" "}
              (weekly, fortnightly or monthly) and the <B>first debit date</B>.
            </li>
            <li>
              Check the schedule preview, then press <B>Create plan</B>. The customer is texted and emailed a link
              straight away.
            </li>
          </ol>
          <Tip>
            At the counter, something like: &ldquo;You can pay this off in four fortnightly payments of $300, taken
            straight from your bank account. We&apos;ll text you a link now; it takes two minutes to set up.&rdquo;
          </Tip>
        </Step>

        <Step n={5} title="The customer sets up their direct debit" time="about 2 minutes, on their phone">
          <ol>
            <li>They open the link and see the work, the total, and every payment date and amount.</li>
            <li>
              They enter their <B>BSB and account number</B> on Stripe&apos;s secure page and accept the{" "}
              <B>Direct Debit Request</B>. You never see or handle their bank details.
            </li>
            <li>
              The plan changes to <B>Active</B> and you see it in <B>Activity</B>. If they haven&apos;t done it yet, open
              the plan and press <B>Resend</B> to send the link again.
            </li>
          </ol>
        </Step>

        <Step n={6} title="Then it runs itself">
          <ul>
            <li>Customers get a <B>reminder text two days before</B> each payment.</li>
            <li>
              Each payment is <B>debited on its due date</B>. Direct debits take a few business days to clear, then Stripe
              pays them into your bank account on its payout schedule (shown under <B>Payouts</B>).
            </li>
            <li>
              A payment that fails is <B>retried automatically</B> until it&apos;s paid, and the customer is told each
              time. If their bank account can&apos;t be debited at all (closed, for example), they&apos;re sent a link to
              add new details, and the plan picks up again by itself.
            </li>
            <li>
              Stripe&apos;s standard fee comes out of each payment in your Stripe account. Halfshaft takes no cut.
            </li>
          </ul>
        </Step>

        <Step n={7} title="Everyday tasks">
          <ul>
            <li>
              <B>Customer paid cash or by card for one payment?</B> On the plan, next to that payment, press{" "}
              <B>Paid another way?</B> so it isn&apos;t debited too.
            </li>
            <li>
              <B>Customer paid off the rest?</B> Open the plan, then <B>Manage this plan</B> &rarr; <B>Paid off in full</B>.
            </li>
            <li>
              <B>Customer going through a hard time, or disputing the work?</B> <B>Put on hold</B>, with a date to start
              again if you like. The remaining dates move back by the time it was on hold.
            </li>
            <li>
              <B>Plan made by mistake, or no longer needed?</B> <B>Cancel plan</B>. Nothing more is debited.
            </li>
            <li>
              <B>End of month for your accountant?</B> <B>Transactions</B> &rarr; <B>Download CSV</B>. It opens in Excel.
            </li>
          </ul>
        </Step>
      </div>

      <section className="mt-12 break-inside-avoid rounded-3xl border border-edge bg-surface p-5 md:p-6 print:rounded-none">
        <h2 className="text-lg font-bold">Need a hand?</h2>
        <p className="mt-2 leading-relaxed text-body">
          {LEGAL.contactEmail ? (
            <>
              Email <B>{LEGAL.contactEmail}</B> and we&apos;ll help you get set up.
            </>
          ) : (
            "Contact whoever set up Halfshaft for you and they'll help you get set up."
          )}{" "}
          Locked out? Use <B>Forgot password</B> on the login page, or ask us for a reset link.
        </p>
      </section>
    </main>
  );
}

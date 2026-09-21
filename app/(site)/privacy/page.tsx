import type { Metadata } from "next";
import { Clause, ContactLine, LegalPage } from "@/components/LegalPage";
import { operatorLine } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What personal information Halfshaft collects, why, who it's shared with, and your choices.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={
        <p>
          Halfshaft is run by {operatorLine()}. It lets car workshops offer their customers repayment plans paid by
          direct debit. This policy explains what personal information Halfshaft handles, why, and who it&apos;s shared
          with. We follow the Australian Privacy Principles in the <em>Privacy Act 1988</em> (Cth).
        </p>
      }
    >
      <Clause n={1} title="Who is responsible for what">
        <p>
          When a workshop sets up a repayment plan for you, the workshop decides to collect your details and uses them
          for its own business: the workshop is responsible for that. Halfshaft stores and uses those details on the
          workshop&apos;s behalf to run the plan, and for the purposes in this policy.
        </p>
        <p>
          Your bank details are entered on Stripe&apos;s secure page and held by Stripe. Halfshaft and the workshop
          never see or store your full bank account number.
        </p>
      </Clause>

      <Clause n={2} title="What we collect">
        <p>
          <strong className="text-ink">About customers of a workshop:</strong>
        </p>
        <ul>
          <li>your name, email address and mobile number, and your vehicle registration if the workshop records it;</li>
          <li>the plan: what it&apos;s for, the amounts, the schedule, and whether each payment succeeded or failed;</li>
          <li>references Stripe gives us to your saved bank account and direct debit request (not the account itself);</li>
          <li>the texts and emails sent to you about your plan, and whether they were delivered.</li>
        </ul>
        <p>
          <strong className="text-ink">About workshops and their staff:</strong> names, email addresses, phone numbers,
          business details, the link to the workshop&apos;s Stripe account, and a scrambled (hashed) copy of each
          password. Stripe collects the identity and business details it needs to verify a workshop; we receive only
          whether that verification is complete.
        </p>
        <p>
          <strong className="text-ink">When you use the website:</strong> sign-in records, including the IP address of
          sign-in attempts (used to block password guessing and deleted after a day).
        </p>
      </Clause>

      <Clause n={3} title="How we use it">
        <ul>
          <li>to take each payment on its due date and retry payments that fail;</li>
          <li>to send you your plan link, reminders before each payment, receipts, and notices when a payment fails or your plan changes;</li>
          <li>to show the workshop the state of its plans and payments;</li>
          <li>to let you sign in and see your plans, using a one-time code sent to your email or mobile;</li>
          <li>to keep Halfshaft secure, fix problems, and meet our legal obligations.</li>
        </ul>
        <p>
          We don&apos;t sell personal information, use it for advertising, or send marketing messages. The texts and
          emails we send are about your plan only.
        </p>
      </Clause>

      <Clause n={4} title="Who we share it with">
        <p>Only with the services Halfshaft needs to work, and only what each one needs:</p>
        <ul>
          <li>
            <strong className="text-ink">The workshop</strong> that set up your plan. Workshops can&apos;t see plans
            belonging to other workshops.
          </li>
          <li>
            <strong className="text-ink">Stripe</strong>, which processes the direct debits and holds bank details.
          </li>
          <li>
            <strong className="text-ink">ClickSend</strong>, an Australian company that sends our text messages.
          </li>
          <li>
            <strong className="text-ink">Resend</strong>, which sends our emails (once email sending is switched on).
          </li>
          <li>
            <strong className="text-ink">Vercel</strong>, which runs the website, and{" "}
            <strong className="text-ink">Neon</strong>, which hosts our database in Sydney.
          </li>
        </ul>
        <p>
          Some of these services process information outside Australia, including in the United States. We choose
          providers that protect personal information to a standard comparable to Australian law. We also disclose
          information when the law requires it.
        </p>
      </Clause>

      <Clause n={5} title="How we keep it safe">
        <p>
          Information is sent over encrypted connections and stored in an access-controlled database. Passwords are
          stored only in hashed form, sign-in attempts are limited, and each workshop can only see its own customers.
          No system is perfectly secure; if a data breach is likely to cause you serious harm, we&apos;ll tell you and
          the Office of the Australian Information Commissioner as the law requires.
        </p>
      </Clause>

      <Clause n={6} title="How long we keep it">
        <p>
          We keep plan and payment records while the workshop uses Halfshaft, and afterwards for as long as they&apos;re
          needed for legal, tax and accounting purposes (generally up to seven years). Then we delete or de-identify
          them. Sign-in codes and records of sign-in attempts are deleted after a day.
        </p>
      </Clause>

      <Clause n={7} title="Cookies">
        <p>
          Halfshaft uses cookies only to keep you signed in. There are no advertising or tracking cookies. Stripe sets
          its own cookies on its secure pages and in the parts of the workshop dashboard it provides, for security and
          fraud prevention.
        </p>
      </Clause>

      <Clause n={8} title="Seeing or correcting your information">
        <p>
          You can see your plans and payments any time by signing in at the &ldquo;See all your payments&rdquo; link.
          To correct your details, change how you&apos;re contacted, or ask for a copy of what we hold, contact the
          workshop that set up your plan, or contact us at <ContactLine />. We&apos;ll respond within 30 days.
        </p>
      </Clause>

      <Clause n={9} title="Complaints">
        <p>
          If you&apos;re unhappy with how we&apos;ve handled your information, contact us at <ContactLine /> and
          we&apos;ll try to resolve it within 30 days. If you&apos;re still not satisfied, you can complain to the
          Office of the Australian Information Commissioner at oaic.gov.au.
        </p>
      </Clause>

      <Clause n={10} title="Changes to this policy">
        <p>
          We&apos;ll update this page when our practices change, and change the date at the top. Significant changes
          will be shown on this page before they take effect.
        </p>
      </Clause>
    </LegalPage>
  );
}

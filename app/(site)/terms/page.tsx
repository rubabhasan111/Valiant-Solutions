import type { Metadata } from "next";
import Link from "next/link";
import { Clause, ContactLine, LegalPage } from "@/components/LegalPage";
import { LEGAL, operatorLine } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for workshops using Halfshaft, and for customers paying a repayment plan through it.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      intro={
        <>
          <p>
            Halfshaft is software run by {operatorLine()} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). Car workshops use it to
            offer their customers repayment plans, paid by direct debit straight into the workshop&apos;s own Stripe
            account.
          </p>
          <p className="mt-4">
            Clauses 1 to 4 apply to everyone. Clauses 5 to 9 apply to workshops. Clause 10 applies to customers paying a
            plan. By using Halfshaft you agree to these terms and to our{" "}
            <Link href="/privacy" className="font-semibold text-ink underline underline-offset-2">
              privacy policy
            </Link>
            .
          </p>
        </>
      }
    >
      <Clause n={1} title="What Halfshaft is, and isn't">
        <p>
          Halfshaft is a tool for scheduling and collecting payments. We are not a party to the arrangement between a
          workshop and its customer, we don&apos;t lend money or provide credit, and we never receive, hold or pay out
          the money collected. Each payment goes from the customer&apos;s bank account to the workshop&apos;s Stripe
          account.
        </p>
      </Clause>

      <Clause n={2} title="Payments are processed by Stripe">
        <p>
          Direct debits are processed by Stripe under the Direct Debit Request and service agreement the customer
          accepts when adding their bank details. Workshops also agree to Stripe&apos;s own terms when they connect
          their account. Stripe&apos;s fees are charged to the workshop by Stripe.
        </p>
      </Clause>

      <Clause n={3} title="Using Halfshaft properly">
        <ul>
          <li>Keep your sign-in details private, and tell us if you think someone else has used your account.</li>
          <li>Give accurate information, and don&apos;t use Halfshaft for anything unlawful, deceptive or unfair.</li>
          <li>Don&apos;t try to access information that isn&apos;t yours, or interfere with how Halfshaft runs.</li>
        </ul>
        <p>We can suspend access that breaks these terms or puts customers or other users at risk.</p>
      </Clause>

      <Clause n={4} title="Our responsibility">
        <p>
          We work to keep Halfshaft accurate and available, but it may occasionally be unavailable or have faults. Nothing
          in these terms excludes rights you have under the Australian Consumer Law that can&apos;t be excluded. Where the
          law allows, our liability for a failure is limited to supplying the service again or paying the cost of having
          it supplied again, and we aren&apos;t liable for indirect losses such as lost profits.
        </p>
      </Clause>

      <Clause n={5} title="Workshops: your account">
        <p>
          To use Halfshaft a workshop must be an Australian business with an ABN, and must connect and keep a Stripe
          account in good standing. The person who signs up confirms they&apos;re authorised to act for the business.
        </p>
      </Clause>

      <Clause n={6} title="Workshops: your arrangements with customers">
        <ul>
          <li>
            Each repayment plan is an arrangement between you and your customer. You decide whether to offer one, and
            its amounts and schedule.
          </li>
          <li>
            You are responsible for the plan complying with the laws that apply to you, including consumer and credit
            laws, and for the accuracy of what you enter.
          </li>
          <li>
            You collect your customers&apos; details for your own business, and must have their permission to give
            them to Halfshaft so plan texts and emails can be sent to them.
          </li>
          <li>Disputes about the work, the invoice, or a payment are between you and your customer.</li>
          <li>
            Use the plan page to put a plan on hold, cancel it, or record a payment made another way, so customers
            aren&apos;t debited for money they don&apos;t owe.
          </li>
        </ul>
      </Clause>

      <Clause n={7} title="Workshops: fees">
        <p>
          Any setup fee or subscription for Halfshaft is agreed with you separately, in writing, before you&apos;re
          charged. Halfshaft never takes a cut of the payments you collect.
        </p>
      </Clause>

      <Clause n={8} title="Workshops: ending">
        <p>
          You can stop using Halfshaft at any time; cancel any plans you don&apos;t want collected first. We can end or
          suspend access with reasonable notice, or straight away for a serious breach of these terms. Plans already
          running keep being collected unless you cancel them.
        </p>
      </Clause>

      <Clause n={9} title="Workshops: your information">
        <p>
          We handle your customers&apos; information as described in the privacy policy, and only to provide Halfshaft.
          We won&apos;t contact your customers except about their plans.
        </p>
      </Clause>

      <Clause n={10} title="Customers paying a plan">
        <ul>
          <li>
            Your repayment plan is an agreement between you and the workshop. For questions about the work, the amount,
            or the schedule, contact the workshop.
          </li>
          <li>
            Payments are taken from your bank account on their due dates, under the Direct Debit Request you accepted
            on Stripe&apos;s page. You&apos;ll be reminded before each one.
          </li>
          <li>
            If a payment fails, it&apos;s retried automatically, and your bank may charge you a dishonour fee. If you
            can&apos;t pay, talk to the workshop: they can put your plan on hold.
          </li>
          <li>
            To stop or query a direct debit you can contact the workshop, or your own bank, as set out in the Direct
            Debit Request.
          </li>
        </ul>
      </Clause>

      <Clause n={11} title="Changes, law and contact">
        <p>
          We may update these terms and will change the date at the top when we do. Significant changes will be given to
          workshops before they take effect. These terms are governed by the laws of New South Wales, Australia.
        </p>
        <p>
          Questions: contact {LEGAL.operator} at <ContactLine />.
        </p>
      </Clause>
    </LegalPage>
  );
}

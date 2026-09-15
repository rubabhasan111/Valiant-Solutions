import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bank, Buildings, IdentificationCard } from "@phosphor-icons/react/ssr";
import { getWorkshopUser } from "@/lib/auth/dal";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Sign up your workshop" };

const NEEDS = [
  {
    Icon: Buildings,
    title: "Your ABN and business details",
    body: "Legal name and address as registered with the Australian Business Register.",
  },
  {
    Icon: IdentificationCard,
    title: "ID for an owner or director",
    body: "Stripe verifies the people behind the business. In test mode, Stripe's test values work.",
  },
  {
    Icon: Bank,
    title: "A business bank account",
    body: "The BSB and account number where collected instalments are paid out.",
  },
];

export default async function ShopSignupPage() {
  if (await getWorkshopUser()) redirect("/dashboard");

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-12 px-5 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,460px)] md:gap-16 md:px-8 md:py-20">
      <section className="max-w-xl">
        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">Sign up your workshop</h1>
        <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-body">
          Create your Halfshaft login, then set up your own Stripe account through Stripe&apos;s secure form. Once
          Stripe approves it you can start offering repayment plans.
        </p>

        <h2 className="mt-12 text-base font-bold">What you&apos;ll need</h2>
        <ul className="mt-5 grid gap-6">
          {NEEDS.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-pale text-accent-ink">
                <Icon size={22} weight="duotone" />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-body">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-10 max-w-[52ch] rounded-2xl border border-edge px-5 py-4 text-sm leading-relaxed text-body">
          <span className="font-semibold text-ink">Your money stays with you:</span> customers pay straight into
          your own Stripe account, and Stripe charges its standard processing fees there. Halfshaft never handles
          your payments or takes a cut.
        </p>
      </section>

      <section className="self-start md:sticky md:top-24">
        <div className="rounded-3xl border border-edge bg-surface p-6 md:p-8">
          <SignupForm />
        </div>
        <p className="mt-5 text-center text-sm text-body">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-ink underline underline-offset-2">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}

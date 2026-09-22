import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomerEmail } from "@/lib/customer/session";
import { EMAIL } from "@/lib/validation";
import { VerifyCodeForm } from "./VerifyCodeForm";

export const metadata: Metadata = { title: "Enter your code", robots: { index: false, follow: false } };

export default async function VerifyCodePage({ searchParams }: PageProps<"/account/verify">) {
  if (await getCustomerEmail()) redirect("/account");

  const { email } = await searchParams;
  const address = typeof email === "string" ? email.toLowerCase() : "";
  if (!EMAIL.test(address)) redirect("/account/login");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight">Enter your code</h1>
      <p className="mt-4 text-lg leading-relaxed text-body">
        If <span className="font-semibold text-ink">{address}</span> has a repayment plan, a six-digit code is on its
        way by text and email. It expires in 10 minutes.
      </p>

      <div className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
        <VerifyCodeForm email={address} />
      </div>

      <p className="mt-6 text-center text-sm text-body">
        Wrong address?{" "}
        <Link href="/account/login" className="font-semibold text-ink underline underline-offset-2">
          Start again
        </Link>
      </p>
    </main>
  );
}

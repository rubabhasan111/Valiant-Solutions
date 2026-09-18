import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerEmail } from "@/lib/customer/session";
import { RequestCodeForm } from "./RequestCodeForm";

export const metadata: Metadata = { title: "Your payments" };

export default async function CustomerLoginPage() {
  if (await getCustomerEmail()) redirect("/account");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight">Your repayment plans</h1>
      <p className="mt-4 text-lg leading-relaxed text-body">
        See what you&apos;ve paid, what&apos;s coming up, and update your bank details. No password needed: we&apos;ll
        text and email you a code.
      </p>

      <div className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
        <RequestCodeForm />
      </div>

      <p className="mt-6 text-sm leading-relaxed text-mute">
        Use the email address your workshop has on file. If you can&apos;t get in, contact the workshop and they can
        send your plan link again.
      </p>
    </main>
  );
}

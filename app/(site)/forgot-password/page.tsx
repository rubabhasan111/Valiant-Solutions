import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight">Reset your password</h1>
      <p className="mt-4 text-lg leading-relaxed text-body">
        We&apos;ll email you a link to choose a new one.
      </p>

      <div className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
        <ForgotPasswordForm />
      </div>

      <p className="mt-6 text-center text-sm text-body">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-2">
          Log in
        </Link>
      </p>
    </main>
  );
}

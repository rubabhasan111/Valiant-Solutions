import type { Metadata } from "next";
import Link from "next/link";
import { resetTokenIsValid } from "@/lib/auth/password-reset";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  const { token } = await params;
  const valid = await resetTokenIsValid(token);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight">
        {valid ? "Choose a new password" : "That link doesn't work"}
      </h1>

      {valid ? (
        <>
          <p className="mt-4 text-lg leading-relaxed text-body">You&apos;ll be logged in as soon as you save it.</p>
          <div className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
            <ResetPasswordForm token={token} />
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 text-lg leading-relaxed text-body">
            Reset links work once and expire after an hour. Ask for a new one and it&apos;ll be emailed straight away.
          </p>
          <Link href="/forgot-password" className="btn btn-primary mt-8">
            Send a new link
          </Link>
        </>
      )}
    </main>
  );
}

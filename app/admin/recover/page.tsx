import type { Metadata } from "next";
import Link from "next/link";
import { ShieldWarning } from "@phosphor-icons/react/ssr";
import { RecoverForm } from "./RecoverForm";

export const metadata: Metadata = {
  title: "Recover admin access",
  robots: { index: false, follow: false },
};

export default function AdminRecoverPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <span className="grid size-11 place-items-center rounded-2xl bg-ink text-canvas">
        <ShieldWarning size={24} weight="bold" />
      </span>
      <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight">Recover admin access</h1>
      <p className="mt-4 text-lg leading-relaxed text-body">
        For Halfshaft staff who are locked out. You&apos;ll need the setup key from the deployment&apos;s environment
        variables, which is why this page is safe to leave open.
      </p>

      <div className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
        <RecoverForm />
      </div>

      <p className="mt-6 text-center text-sm text-body">
        Remembered it?{" "}
        <Link href="/admin/login" className="font-semibold text-ink underline underline-offset-2">
          Admin sign in
        </Link>
      </p>
    </main>
  );
}

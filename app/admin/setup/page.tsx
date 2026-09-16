import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/db";
import { SetupForm } from "./SetupForm";

export const metadata: Metadata = {
  title: "Set up admin",
  robots: { index: false, follow: false },
};

// One-time page for creating the first Halfshaft admin on a new deployment, so nobody has
// to run a script against the production database. It closes itself once an admin exists.
export default async function AdminSetupPage() {
  const alreadySetUp = Boolean(await db.one("SELECT 1 FROM admins LIMIT 1"));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <span className="grid size-11 place-items-center rounded-2xl bg-ink text-canvas">
        <ShieldCheck size={24} weight="bold" />
      </span>
      <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight">
        {alreadySetUp ? "Admin already set up" : "Create your admin account"}
      </h1>

      {alreadySetUp ? (
        <>
          <p className="mt-4 text-lg leading-relaxed text-body">
            This deployment already has an admin, so this page is closed.
          </p>
          <Link href="/admin/login" className="btn btn-primary mt-8">
            Go to admin sign in
          </Link>
        </>
      ) : (
        <>
          <p className="mt-4 text-lg leading-relaxed text-body">
            This runs once, for Halfshaft staff. It needs the setup key from this deployment.
          </p>
          <div className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
            <SetupForm />
          </div>
        </>
      )}
    </main>
  );
}

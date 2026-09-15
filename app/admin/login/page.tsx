import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "@phosphor-icons/react/ssr";
import { getAdmin } from "@/lib/admin/dal";
import { AdminLoginForm } from "./AdminLoginForm";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect("/admin");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <span className="grid size-11 place-items-center rounded-2xl bg-ink text-canvas">
        <ShieldCheck size={24} weight="bold" />
      </span>
      <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight">Halfshaft admin</h1>
      <p className="mt-4 text-lg leading-relaxed text-body">For Halfshaft staff only.</p>

      <div className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
        <AdminLoginForm />
      </div>

      <p className="mt-6 text-center text-sm text-body">
        Running a workshop?{" "}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-2">
          Log in here
        </Link>
      </p>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkshopUser } from "@/lib/auth/dal";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getWorkshopUser()) redirect("/dashboard");
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight">Log in to your workshop</h1>
      <p className="mt-4 text-lg leading-relaxed text-body">Manage payment plans and check your Stripe status.</p>

      <div className="mt-8 rounded-3xl border border-edge bg-surface p-6 md:p-8">
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>

      <p className="mt-6 text-center text-sm text-body">
        New to Halfshaft?{" "}
        <Link href="/shop/signup" className="font-semibold text-ink underline underline-offset-2">
          Sign up your workshop
        </Link>
      </p>
    </main>
  );
}

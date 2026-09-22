import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { GearSix, SignOut } from "@phosphor-icons/react/ssr";
import { requireCustomer } from "@/lib/customer/session";
import { SiteFooter } from "@/components/SiteFooter";
import { customerLogout } from "./actions";

export const metadata: Metadata = {
  title: { default: "Your payments", template: "%s | Halfshaft" },
  robots: { index: false, follow: false },
};

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const email = await requireCustomer();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-edge bg-surface">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <Link href="/account" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
            <span className="grid size-8 place-items-center rounded-xl bg-accent text-on-accent">
              <GearSix size={18} weight="bold" />
            </span>
            Halfshaft
          </Link>
          <div className="flex items-center gap-5">
            <p className="hidden truncate text-sm text-body sm:block">{email}</p>
            <form action={customerLogout}>
              <button
                type="submit"
                className="flex items-center gap-2 text-sm font-semibold text-body transition-colors hover:text-ink"
              >
                <SignOut size={18} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

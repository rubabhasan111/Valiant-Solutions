import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, SignOut } from "@phosphor-icons/react/ssr";
import { requireAdmin } from "@/lib/admin/dal";
import { adminLogout } from "./actions";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Halfshaft admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-edge bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-10">
          <Link href="/admin" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
            <span className="grid size-8 place-items-center rounded-xl bg-ink text-canvas">
              <ShieldCheck size={18} weight="bold" />
            </span>
            Halfshaft admin
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/admin/team" className="text-sm font-semibold text-body transition-colors hover:text-ink">
              Team
            </Link>
            <p className="hidden truncate text-sm text-body sm:block">{admin.name}</p>
            <form action={adminLogout}>
              <button
                type="submit"
                className="flex items-center gap-2 text-sm font-semibold text-body transition-colors hover:text-ink"
              >
                <SignOut size={18} />
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}

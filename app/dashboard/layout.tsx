import type { ReactNode } from "react";
import Link from "next/link";
import { GearSix, SignOut } from "@phosphor-icons/react/ssr";
import { logout } from "@/lib/auth/actions";
import { requireWorkshop } from "@/lib/auth/dal";
import { unreadNotificationCount } from "@/lib/notifications";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Pages repeat this check themselves; the layout only reads it to fill the shell.
  const { user, centre, role } = await requireWorkshop();
  const unread = await unreadNotificationCount(centre.id);

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-edge bg-surface md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-4 px-5 py-4 md:flex-col md:items-stretch md:px-6 md:py-6">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
            <span className="grid size-8 place-items-center rounded-xl bg-accent text-on-accent">
              <GearSix size={18} weight="bold" />
            </span>
            Halfshaft
          </Link>
          <div className="flex min-w-0 items-center gap-3 md:mt-6 md:block">
            <div className="min-w-0 text-right md:text-left">
              <p className="hidden text-xs font-semibold text-mute md:block">Workshop</p>
              <p className="truncate text-sm font-bold md:mt-0.5 md:text-base">{centre.name}</p>
            </div>
            <form action={logout} className="md:hidden">
              <button type="submit" aria-label="Log out" className="grid size-9 place-items-center rounded-xl text-body hover:bg-edge/50">
                <SignOut size={20} />
              </button>
            </form>
          </div>
        </div>

        <DashboardNav unread={unread} />

        <div className="hidden border-t border-edge px-6 py-5 md:mt-auto md:block">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-mute">
            {role === "owner" ? "Owner" : "Staff"}, {user.email}
          </p>
          <Link href="/guide" className="mt-3 block text-sm font-semibold text-body transition-colors hover:text-ink">
            Setup guide
          </Link>
          <form action={logout} className="mt-3">
            <button type="submit" className="flex items-center gap-2 text-sm font-semibold text-body transition-colors hover:text-ink">
              <SignOut size={18} />
              Log out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

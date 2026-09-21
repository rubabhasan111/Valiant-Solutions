"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowsLeftRight, Bank, Bell, GearSix, Receipt, SquaresFour, UsersThree, type Icon } from "@phosphor-icons/react";

type NavItem = { label: string; Icon: Icon; href: string; badge?: number };

export function DashboardNav({ unread }: { unread: number }) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { label: "Overview", href: "/dashboard", Icon: SquaresFour },
    { label: "Payment plans", href: "/dashboard/plans", Icon: Receipt },
    { label: "Customers", href: "/dashboard/customers", Icon: UsersThree },
    { label: "Payouts", href: "/dashboard/payouts", Icon: Bank },
    { label: "Transactions", href: "/dashboard/transactions", Icon: ArrowsLeftRight },
    { label: "Activity", href: "/dashboard/activity", Icon: Bell, badge: unread },
    { label: "Settings", href: "/dashboard/settings", Icon: GearSix },
  ];

  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
      {items.map(({ label, href, Icon, badge }) => {
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              active ? "bg-accent text-on-accent" : "text-body hover:bg-edge/50 hover:text-ink"
            }`}
          >
            <Icon size={20} weight={active ? "bold" : "regular"} />
            {label}
            {badge ? (
              <span className="tabular ml-auto rounded-full bg-ink px-2 py-0.5 text-[0.7rem] font-bold text-canvas">
                {badge > 99 ? "99+" : badge}
                <span className="sr-only"> unread</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

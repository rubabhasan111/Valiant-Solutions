import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GearSix, LockSimple } from "@phosphor-icons/react/ssr";

// Customer-facing plan pages. The URL token is the customer's only credential, so keep
// these pages out of search results and don't leak the URL to other sites.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PayLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-edge">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-5">
          <span className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
            <span className="grid size-8 place-items-center rounded-xl bg-accent text-on-accent">
              <GearSix size={18} weight="bold" />
            </span>
            Halfshaft
          </span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-mute">
            <LockSimple size={16} weight="bold" />
            Secure plan setup
          </span>
        </div>
      </header>
      {children}
    </>
  );
}

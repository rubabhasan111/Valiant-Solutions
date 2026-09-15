import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";

// Public marketing, signup and login pages. The workshop dashboard has its own shell.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}

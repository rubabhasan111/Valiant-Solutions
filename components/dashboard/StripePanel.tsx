"use client";

import dynamic from "next/dynamic";
import type { StripePanelKind } from "./StripePanelInner";

// Stripe's Connect.js only runs in the browser, so the panels skip server rendering.
const StripePanelInner = dynamic(() => import("./StripePanelInner"), { ssr: false });

export function StripePanel({ panel, publishableKey }: { panel: StripePanelKind; publishableKey: string | undefined }) {
  // The server only accepts test-mode secret keys, so the publishable key must be a test key
  // from the same Stripe sandbox or Stripe rejects every panel session.
  if (!publishableKey?.startsWith("pk_test_")) {
    if (panel === "alerts") return null;
    return (
      <div className="px-2 py-8 text-center">
        <h2 className="text-lg font-bold">Stripe panels aren&apos;t set up yet</h2>
        <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-relaxed text-body">
          Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env.local to the pk_test_ key from the same Stripe sandbox as
          STRIPE_SECRET_KEY, then reload this page.
        </p>
      </div>
    );
  }

  return <StripePanelInner panel={panel} publishableKey={publishableKey} />;
}

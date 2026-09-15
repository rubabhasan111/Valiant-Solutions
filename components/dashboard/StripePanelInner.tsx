"use client";

import { useEffect, useState } from "react";
import { loadConnectAndInitialize } from "@stripe/connect-js/pure";
import {
  ConnectComponentsProvider,
  ConnectNotificationBanner,
  ConnectPayments,
  ConnectPayouts,
} from "@stripe/react-connect-js";

export type StripePanelKind = "payouts" | "payments" | "alerts";

const MANROPE_CSS = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap";

// Stripe's components render inside iframes, so Halfshaft's colour tokens are read at
// runtime and passed through as appearance variables. Re-reading them on a theme change
// keeps the panels in step with light and dark mode.
function readAppearance() {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  return {
    overlays: "dialog" as const,
    variables: {
      fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif",
      borderRadius: "12px",
      buttonBorderRadius: "24px",
      colorPrimary: token("--accent-ink"),
      colorBackground: token("--surface"),
      colorText: token("--ink"),
      colorSecondaryText: token("--body"),
      colorBorder: token("--edge"),
      colorDanger: token("--danger"),
      buttonPrimaryColorBackground: token("--accent"),
      buttonPrimaryColorBorder: token("--accent"),
      buttonPrimaryColorText: token("--on-accent"),
      actionPrimaryColorText: token("--accent-ink"),
      offsetBackgroundColor: token("--canvas"),
      formBackgroundColor: token("--canvas"),
    },
  };
}

async function fetchClientSecret(): Promise<string> {
  const response = await fetch("/api/stripe/account-session", { method: "POST" });
  const data = (await response.json()) as { clientSecret?: string; error?: string };
  if (!response.ok || !data.clientSecret) throw new Error(data.error ?? "Stripe couldn't be reached.");
  return data.clientSecret;
}

function PanelSkeleton() {
  return (
    <div className="grid gap-3" aria-busy="true">
      <span className="sr-only">Loading from Stripe</span>
      <div className="h-8 w-48 rounded-xl bg-edge/60 motion-safe:animate-pulse" />
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="h-12 rounded-xl bg-edge/40 motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

// Only ever rendered in the browser (see StripePanel), so the Connect instance can be
// created during the first render.
export default function StripePanelInner({ panel, publishableKey }: { panel: StripePanelKind; publishableKey: string }) {
  const [connect] = useState(() =>
    loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret,
      appearance: readAppearance(),
      locale: "en-AU",
      fonts: [{ cssSrc: MANROPE_CSS }],
    }),
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hasAlerts, setHasAlerts] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onThemeChange = () => connect.update({ appearance: readAppearance() });
    media.addEventListener("change", onThemeChange);
    return () => media.removeEventListener("change", onThemeChange);
  }, [connect]);

  const callbacks = {
    onLoaderStart: () => setStatus("ready"),
    onLoadError: () => setStatus("error"),
  };

  // The alerts banner stays out of the way: no placeholder, no error, no space when empty.
  if (panel === "alerts") {
    if (status === "error") return null;
    return (
      <ConnectComponentsProvider connectInstance={connect}>
        <div className={hasAlerts ? "mt-6" : "h-0 overflow-hidden"}>
          <ConnectNotificationBanner
            {...callbacks}
            onNotificationsChange={({ total }) => setHasAlerts(total > 0)}
          />
        </div>
      </ConnectComponentsProvider>
    );
  }

  if (status === "error") {
    return (
      <div className="px-2 py-8 text-center">
        <h2 className="text-lg font-bold">Stripe couldn&apos;t load this right now</h2>
        <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-body">
          Your money is safe and payouts carry on as normal. Refresh the page to try again.
        </p>
      </div>
    );
  }

  return (
    <ConnectComponentsProvider connectInstance={connect}>
      {status === "loading" && <PanelSkeleton />}
      {panel === "payouts" ? <ConnectPayouts {...callbacks} /> : <ConnectPayments {...callbacks} />}
    </ConnectComponentsProvider>
  );
}

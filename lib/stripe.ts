import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripe) return stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add your Stripe test secret key (sk_test_...) to .env.local",
    );
  }
  if (!key.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY must be a test-mode key (sk_test_...). This app runs in test mode only.");
  }

  // Network retries reuse the same idempotency key, so a retried debit is never charged twice.
  stripe = new Stripe(key, { maxNetworkRetries: 2 });
  return stripe;
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// Account Links are single-use and expire after a few minutes, so a fresh one is
// minted every time a workshop starts or resumes onboarding. Both URLs sit behind
// the workshop login, which decides whose account is being onboarded.
export function createOnboardingLink(accountId: string) {
  return getStripe().v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["merchant"],
        refresh_url: `${appUrl()}/dashboard/onboarding/start`,
        return_url: `${appUrl()}/dashboard/onboarding/return`,
      },
    },
  });
}

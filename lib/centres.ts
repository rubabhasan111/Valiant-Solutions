import { db, SYDNEY_MONTH_START, type ServiceCentre } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export type CapabilityState = "active" | "pending" | "inactive";

export type OnboardingStatus = {
  hasAccount: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  becs: CapabilityState;
  cards: CapabilityState;
  outstanding: number;
  ready: boolean;
  syncFailed: boolean;
};

function toCapability(value: string | null | undefined): CapabilityState {
  return value === "active" || value === "pending" ? value : "inactive";
}

function statusFromRow(centre: ServiceCentre, syncFailed = false): OnboardingStatus {
  const becs = toCapability(centre.becs_capability);
  const ready = centre.details_submitted && centre.charges_enabled && becs === "active";
  return {
    hasAccount: Boolean(centre.stripe_account_id),
    detailsSubmitted: centre.details_submitted,
    chargesEnabled: centre.charges_enabled,
    payoutsEnabled: centre.payouts_enabled,
    becs,
    // Card payments are switched on together with BECS, so the stored BECS state stands in for both.
    cards: becs,
    outstanding: 0,
    ready,
    syncFailed,
  };
}

// Creates the centre's own Stripe account the first time it's needed.
export async function ensureConnectedAccount(centre: ServiceCentre): Promise<string> {
  if (centre.stripe_account_id) return centre.stripe_account_id;

  // Created through Accounts v2 (v1 is disabled on this sandbox). Stripe charges its fees
  // to the workshop and carries any losses, so no money ever moves through Halfshaft:
  // customers pay workshops directly. Stripe only supports that with the full Stripe
  // Dashboard, not the Express Dashboard.
  // BECS Direct Debit can only be requested alongside card_payments.
  const account = await getStripe().v2.core.accounts.create({
    display_name: centre.name,
    contact_email: centre.email,
    dashboard: "full",
    identity: {
      country: "au",
      business_details: { registered_name: centre.name },
    },
    defaults: {
      currency: "aud",
      locales: ["en-AU"],
      responsibilities: {
        fees_collector: "stripe",
        losses_collector: "stripe",
      },
    },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { requested: true },
          au_becs_debit_payments: { requested: true },
        },
      },
    },
    include: ["configuration.merchant", "identity", "requirements"],
  });

  await db.run("UPDATE service_centres SET stripe_account_id = $1, updated_at = now() WHERE id = $2", [account.id, centre.id]);
  return account.id;
}

// Reads the account from Stripe and stores the result. Account v2 IDs are readable
// through the v1 Accounts API, which exposes capabilities and requirements.
export async function syncOnboardingStatus(centre: ServiceCentre): Promise<OnboardingStatus> {
  if (!centre.stripe_account_id) return statusFromRow(centre);

  try {
    const account = await getStripe().accounts.retrieve(centre.stripe_account_id);
    const becs = toCapability(account.capabilities?.au_becs_debit_payments);

    await db.run(
      `UPDATE service_centres
          SET details_submitted = $1, charges_enabled = $2, payouts_enabled = $3, becs_capability = $4,
              updated_at = now()
        WHERE id = $5`,
      [Boolean(account.details_submitted), Boolean(account.charges_enabled), Boolean(account.payouts_enabled), becs, centre.id],
    );

    return {
      hasAccount: true,
      detailsSubmitted: Boolean(account.details_submitted),
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      becs,
      cards: toCapability(account.capabilities?.card_payments),
      outstanding: account.requirements?.currently_due?.length ?? 0,
      ready: Boolean(account.details_submitted && account.charges_enabled && becs === "active"),
      syncFailed: false,
    };
  } catch (err) {
    console.error(`Stripe sync failed for centre ${centre.id}:`, err);
    return statusFromRow(centre, true);
  }
}

// Fully active centres are served from the database; anything still onboarding is
// re-checked with Stripe so the dashboard reflects progress straight away.
export async function getOnboardingStatus(centre: ServiceCentre): Promise<OnboardingStatus> {
  const stored = statusFromRow(centre);
  return stored.ready && centre.payouts_enabled ? stored : syncOnboardingStatus(centre);
}

export type CentreStats = {
  customers: number;
  activePlans: number;
  // Debits cleared this month (Sydney time). Stripe deducts its own fees in the workshop's Stripe account.
  receivedThisMonthCents: number;
  // Failed payments that are being retried automatically.
  paymentsRetrying: number;
};

export async function getCentreStats(centreId: number): Promise<CentreStats> {
  const row = await db.one<CentreStats>(
    `SELECT
       (SELECT COUNT(*) FROM customers WHERE service_centre_id = $1) AS "customers",
       (SELECT COUNT(*) FROM payment_plans WHERE service_centre_id = $1 AND status = 'active') AS "activePlans",
       (SELECT COALESCE(SUM(i.amount_cents), 0)
          FROM instalments i
          JOIN payment_plans p ON p.id = i.payment_plan_id
         WHERE p.service_centre_id = $1 AND i.status = 'paid' AND i.paid_at >= ${SYDNEY_MONTH_START}) AS "receivedThisMonthCents",
       (SELECT COUNT(*)
          FROM instalments i
          JOIN payment_plans p ON p.id = i.payment_plan_id
         WHERE p.service_centre_id = $1 AND i.status = 'failed') AS "paymentsRetrying"`,
    [centreId],
  );
  return row!;
}

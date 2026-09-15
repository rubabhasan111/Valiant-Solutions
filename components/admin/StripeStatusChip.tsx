import type { ServiceCentre } from "@/lib/db";

type Centre = Pick<ServiceCentre, "stripe_account_id" | "charges_enabled" | "becs_capability" | "suspended_at">;

const CHIP = "inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold";

// Where a workshop is up to: suspended by Halfshaft, taking payments, or still onboarding with Stripe.
export function WorkshopStatusChips({ centre }: { centre: Centre }) {
  const taking = centre.charges_enabled && centre.becs_capability === "active";
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {centre.suspended_at && <span className={`${CHIP} bg-danger-pale text-danger`}>Suspended</span>}
      {taking ? (
        <span className={`${CHIP} bg-accent-pale text-accent-ink`}>Taking payments</span>
      ) : centre.stripe_account_id ? (
        <span className={`${CHIP} bg-pending-pale text-pending`}>Onboarding</span>
      ) : (
        <span className={`${CHIP} bg-edge/60 text-body`}>No Stripe account</span>
      )}
    </span>
  );
}

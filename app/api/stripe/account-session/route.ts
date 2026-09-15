import { getWorkshopContext } from "@/lib/auth/dal";
import { getStripe } from "@/lib/stripe";

// Creates a short-lived Stripe Account Session so the dashboard can show Stripe's
// embedded payouts, payments and account alerts for the logged-in workshop only.
export async function POST(request: Request) {
  // Browsers send Origin on POST requests; refuse anything started from another site.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const context = await getWorkshopContext();
  if (!context) return Response.json({ error: "Log in to continue." }, { status: 401 });
  if (!context.centre.stripe_account_id) {
    return Response.json({ error: "This workshop hasn't connected Stripe yet." }, { status: 409 });
  }

  // Only owners can change where and when money is paid out.
  const owner = context.role === "owner";

  try {
    const session = await getStripe().accountSessions.create({
      account: context.centre.stripe_account_id,
      components: {
        // Read-only. Debits are collected automatically, and a refund on a plan payment would
        // put it out of step with the plan's schedule, so refunds and disputes stay with support.
        payments: {
          enabled: true,
          features: { refund_management: false, dispute_management: false, capture_payments: false },
        },
        payouts: {
          enabled: true,
          features: {
            standard_payouts: owner,
            edit_payout_schedule: owner,
            external_account_collection: owner,
            instant_payouts: false,
          },
        },
        notification_banner: {
          enabled: true,
          features: { external_account_collection: owner },
        },
      },
    });
    return Response.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error(`Account Session failed for centre ${context.centre.id}:`, err);
    return Response.json({ error: "Stripe couldn't be reached." }, { status: 502 });
  }
}

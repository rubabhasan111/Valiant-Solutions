import { redirect } from "next/navigation";
import { requireWorkshop } from "@/lib/auth/dal";
import { getStripe } from "@/lib/stripe";

// Opens the workshop's own Stripe dashboard. Workshops have a full Stripe account and sign
// in at dashboard.stripe.com with their own Stripe login. Older test accounts on the
// Express Dashboard get a one-time login link instead.
export async function GET() {
  const { centre, role } = await requireWorkshop();
  if (role !== "owner" || !centre.stripe_account_id) redirect("/dashboard/payouts");

  let url = "https://dashboard.stripe.com/";
  try {
    const account = await getStripe().accounts.retrieve(centre.stripe_account_id);
    if (account.controller?.stripe_dashboard?.type === "express") {
      url = (await getStripe().accounts.createLoginLink(centre.stripe_account_id)).url;
    }
  } catch (err) {
    console.error(`Opening the Stripe dashboard failed for centre ${centre.id}:`, err);
    redirect("/dashboard/payouts?stripe=unavailable");
  }

  redirect(url);
}

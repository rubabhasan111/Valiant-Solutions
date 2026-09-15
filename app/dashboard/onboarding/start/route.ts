import { redirect } from "next/navigation";
import { requireWorkshop } from "@/lib/auth/dal";
import { ensureConnectedAccount } from "@/lib/centres";
import { createOnboardingLink } from "@/lib/stripe";

// Starts or resumes Stripe onboarding for the logged-in workshop. Stripe's refresh_url
// also points here, so an expired onboarding link mints a fresh one.
export async function GET() {
  const { centre, role } = await requireWorkshop();
  if (role !== "owner") redirect("/dashboard?onboarding=owner-only");

  let url: string;
  try {
    const accountId = await ensureConnectedAccount(centre);
    url = (await createOnboardingLink(accountId)).url;
  } catch (err) {
    console.error(`Starting onboarding failed for centre ${centre.id}:`, err);
    redirect("/dashboard?onboarding=error");
  }

  redirect(url);
}

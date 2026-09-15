import { redirect } from "next/navigation";
import { requireWorkshop } from "@/lib/auth/dal";

// Stripe's return_url. Stripe doesn't say whether onboarding finished, so the
// overview re-reads the account and shows the real status.
export async function GET() {
  await requireWorkshop();
  redirect("/dashboard?onboarding=returned");
}

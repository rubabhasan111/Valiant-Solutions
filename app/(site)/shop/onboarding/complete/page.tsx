import { redirect } from "next/navigation";

// Onboarding links issued before workshop logins existed return here.
export default function LegacyOnboardingReturn() {
  redirect("/dashboard/onboarding/return");
}

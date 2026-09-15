import { redirect } from "next/navigation";

// Onboarding links issued before workshop logins existed use this refresh_url.
// Access is now decided by the logged-in workshop, not the ID in the path.
export function GET() {
  redirect("/dashboard/onboarding/start");
}

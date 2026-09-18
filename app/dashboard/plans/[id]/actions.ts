"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireWorkshop } from "@/lib/auth/dal";
import { deliverPendingMessages } from "@/lib/messaging";
import { planLinkSentWithin, queuePlanLink } from "@/lib/plan-links";
import { getPlanDetail } from "@/lib/plans";

// Sends the customer their plan link again, by email and text.
export async function resendPlanLink(planId: number) {
  const { centre } = await requireWorkshop();
  // Scoped to the logged-in workshop, so nobody can send links for another workshop's plan.
  if (!(await getPlanDetail(centre.id, planId))) redirect("/dashboard/plans");

  const page = `/dashboard/plans/${planId}`;
  if (await planLinkSentWithin(planId, 60)) redirect(`${page}?sent=recent`);

  const result = await queuePlanLink(planId, "resent");
  if (!result) redirect(`${page}?sent=not-needed`);

  after(() => deliverPendingMessages());
  redirect(`${page}?sent=${result.smsKey ? "both" : "email"}`);
}

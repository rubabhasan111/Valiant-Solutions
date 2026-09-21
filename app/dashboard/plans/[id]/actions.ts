"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireWorkshop } from "@/lib/auth/dal";
import { deliverPendingMessages } from "@/lib/messaging";
import {
  cancelPlan,
  pausePlan,
  recordManualPayment,
  recordPaidInFull,
  resumePlan,
  type PlanActionResult,
} from "@/lib/plan-actions";
import { planLinkSentWithin, queuePlanLink } from "@/lib/plan-links";
import { getPlanDetail } from "@/lib/plans";
import { isIsoDate } from "@/lib/schedule";

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

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
};

// Every plan action ends the same way: send any messages it queued, then back to the plan
// with a notice saying what happened (or why it didn't).
function finish(planId: number, result: PlanActionResult, done: string): never {
  const page = `/dashboard/plans/${planId}`;
  if (!result.ok) redirect(`${page}?problem=${result.error}`);
  after(() => deliverPendingMessages());
  redirect(`${page}?done=${done}`);
}

export async function pausePlanAction(planId: number, formData: FormData) {
  const { centre } = await requireWorkshop();
  const resumeOn = text(formData, "resumeOn") || null;
  if (resumeOn && !isIsoDate(resumeOn)) finish(planId, { ok: false, error: "resume-date" }, "paused");
  finish(planId, await pausePlan(centre.id, planId, { reason: text(formData, "reason"), resumeOn }), "paused");
}

export async function resumePlanAction(planId: number) {
  const { centre } = await requireWorkshop();
  finish(planId, await resumePlan(centre.id, planId), "resumed");
}

export async function cancelPlanAction(planId: number, formData: FormData) {
  const { centre } = await requireWorkshop();
  finish(planId, await cancelPlan(centre.id, planId, text(formData, "reason")), "cancelled");
}

export async function recordPaymentAction(planId: number, instalmentId: number, formData: FormData) {
  const { centre } = await requireWorkshop();
  finish(planId, await recordManualPayment(centre.id, planId, instalmentId, text(formData, "note")), "recorded");
}

export async function recordPaidInFullAction(planId: number, formData: FormData) {
  const { centre } = await requireWorkshop();
  finish(planId, await recordPaidInFull(centre.id, planId, text(formData, "note")), "paid-in-full");
}

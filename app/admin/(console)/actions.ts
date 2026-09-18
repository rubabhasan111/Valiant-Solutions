"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import { getPlanForAdmin, recordAudit } from "@/lib/admin/data";
import { destroyAdminSession } from "@/lib/admin/session";
import { db, transaction } from "@/lib/db";
import { runDebitsAndEmails } from "@/lib/jobs";
import { deliverPendingMessages } from "@/lib/messaging";
import { queuePlanLink } from "@/lib/plan-links";
import { todayInSydney } from "@/lib/schedule";

// Admin actions never move money: they change Halfshaft access, send reminders, or run
// the same debit job the scheduler runs.

export async function suspendWorkshop(centreId: number) {
  const admin = await requireAdmin();
  if (!Number.isInteger(centreId)) redirect("/admin");

  const changed = await transaction(async (tx) => {
    const updated = await tx.run(
      "UPDATE service_centres SET suspended_at = now(), updated_at = now() WHERE id = $1 AND suspended_at IS NULL",
      [centreId],
    );
    if (!updated) return false;

    // Sign every staff member out now rather than when their session expires.
    const signedOut = await tx.run(
      "DELETE FROM user_sessions WHERE user_id IN (SELECT user_id FROM memberships WHERE service_centre_id = $1)",
      [centreId],
    );
    await recordAudit(
      admin.id,
      "workshop_suspended",
      { centreId, detail: `Signed out ${signedOut} active ${signedOut === 1 ? "session" : "sessions"}.` },
      tx,
    );
    return true;
  });

  redirect(`/admin/workshops/${centreId}?notice=${changed ? "suspended" : "unchanged"}`);
}

export async function restoreWorkshop(centreId: number) {
  const admin = await requireAdmin();
  if (!Number.isInteger(centreId)) redirect("/admin");

  const changed = await transaction(async (tx) => {
    const updated = await tx.run(
      "UPDATE service_centres SET suspended_at = NULL, updated_at = now() WHERE id = $1 AND suspended_at IS NOT NULL",
      [centreId],
    );
    if (updated) await recordAudit(admin.id, "workshop_restored", { centreId }, tx);
    return updated > 0;
  });

  redirect(`/admin/workshops/${centreId}?notice=${changed ? "restored" : "unchanged"}`);
}

// Sends the customer their plan link again, for a plan waiting on bank details.
export async function resendBankLink(planId: number) {
  const admin = await requireAdmin();
  const data = await getPlanForAdmin(planId);
  if (!data) redirect("/admin");

  const { plan, customer, centre } = data;
  const back = `/admin/workshops/${centre.id}`;
  const queued = await queuePlanLink(plan.id, "resent");
  if (!queued) redirect(`${back}?notice=link-not-needed`);

  await deliverPendingMessages();
  await recordAudit(admin.id, "bank_link_resent", {
    centreId: centre.id,
    planId: plan.id,
    detail: `Emailed ${customer.email}${queued.smsKey ? " and texted their mobile" : ""}`,
  });

  const sent = await db.one<{ status: string }>("SELECT status FROM email_outbox WHERE dedupe_key = $1", [queued.emailKey]);
  const notice = sent?.status === "sent" ? "link-sent" : sent?.status === "skipped" ? "link-not-configured" : "link-queued";
  redirect(`${back}?notice=${notice}`);
}

export async function runDebitsNow() {
  const admin = await requireAdmin();

  let outcome = "done";
  try {
    const { summary } = await runDebitsAndEmails(todayInSydney(), "admin");
    await recordAudit(admin.id, "debit_job_run", {
      detail: `${summary.charged} charged, ${summary.failed} failed, ${summary.settledFromStripe} settled with Stripe.`,
    });
  } catch (err) {
    console.error("Admin debit run failed:", err);
    outcome = "error";
  }

  redirect(`/admin?ran=${outcome}`);
}

export async function adminLogout() {
  await destroyAdminSession();
  redirect("/admin/login");
}

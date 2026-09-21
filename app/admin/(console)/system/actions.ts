"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/dal";
import { recordAudit } from "@/lib/admin/data";
import { queueAlert } from "@/lib/alerts";
import { db } from "@/lib/db";
import { deliverPendingMessages } from "@/lib/messaging";
import { formatAuMobile, normaliseAuMobile } from "@/lib/phone";

// Each admin chooses their own alert mobile; nobody can set someone else's.
export async function saveAlertPhone(formData: FormData) {
  const admin = await requireAdmin();
  const raw = String(formData.get("alertPhone") ?? "").trim();
  const mobile = raw ? normaliseAuMobile(raw) : null;
  if (raw && !mobile) redirect("/admin/system?alerts=invalid");

  await db.run("UPDATE admins SET alert_phone = $1 WHERE id = $2", [mobile, admin.id]);
  await recordAudit(admin.id, "alert_phone_changed", {
    detail: mobile ? `Alerts now texted to ${formatAuMobile(mobile)}.` : "Stopped text alerts.",
  });
  redirect(`/admin/system?alerts=${mobile ? "saved" : "removed"}`);
}

// Sends a test alert to every admin, so each can see alerts actually reach them.
export async function sendTestAlert() {
  const admin = await requireAdmin();
  const queued = await queueAlert(
    `test:${Date.now()}`,
    "Halfshaft test alert",
    `${admin.name} sent this from the system page. Real alerts look like this.`,
  );
  await deliverPendingMessages();
  await recordAudit(admin.id, "alert_test_sent", { detail: `Texted ${queued} ${queued === 1 ? "admin" : "admins"}.` });
  redirect(`/admin/system?alerts=${queued > 0 ? "tested" : "no-phones"}`);
}

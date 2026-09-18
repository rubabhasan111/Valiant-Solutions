"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/admin/data";
import { createAdminSession } from "@/lib/admin/session";
import { callerAddress } from "@/lib/auth/caller";
import { hashPassword } from "@/lib/auth/password";
import { checkRateLimit, clearAttempts, recordFailedAttempt, tooManyAttemptsMessage } from "@/lib/auth/rate-limit";
import { transaction } from "@/lib/db";
import { EMAIL, formText } from "@/lib/validation";

// Break-glass for a locked-out admin, guarded by the deployment's CRON_SECRET. Halfshaft
// staff can't be emailed a reset link while email delivery is off, and an admin who can't
// sign in can't be invited back in by anyone else.

export type RecoverState = { error?: string; email?: string } | undefined;

const MIN_PASSWORD_LENGTH = 10;

function matchesSetupKey(key: string): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function recoverAdminAccount(_prev: RecoverState, formData: FormData): Promise<RecoverState> {
  const email = formText(formData, "email").toLowerCase();
  const key = formText(formData, "key");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? "");

  if (!EMAIL.test(email)) return { error: "Enter the email address on the admin account.", email };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.`, email };
  if (password !== confirmation) return { error: "Both passwords need to match.", email };

  const address = await callerAddress();
  const limit = await checkRateLimit("admin_login", email, address);
  if (!limit.allowed) return { error: tooManyAttemptsMessage(limit.retryAfterMinutes), email };

  if (!matchesSetupKey(key)) {
    await recordFailedAttempt("admin_login", email, address);
    return { error: "That setup key doesn't match this deployment.", email };
  }

  const passwordHash = await hashPassword(password);
  const adminId = await transaction(async (tx) => {
    const admin = await tx.one<{ id: number }>("SELECT id FROM admins WHERE email = $1", [email]);
    if (!admin) return null;
    await tx.run("UPDATE admins SET password_hash = $1 WHERE id = $2", [passwordHash, admin.id]);
    // Anyone holding an old session for this account is signed out.
    await tx.run("DELETE FROM admin_sessions WHERE admin_id = $1", [admin.id]);
    return admin.id;
  });

  if (!adminId) {
    await recordFailedAttempt("admin_login", email, address);
    return { error: "No admin account uses that email address.", email };
  }

  await clearAttempts("admin_login", email);
  await recordAudit(adminId, "admin_password_recovered", { detail: `Reset with the setup key from ${address}` });
  await createAdminSession(adminId);
  redirect("/admin");
}

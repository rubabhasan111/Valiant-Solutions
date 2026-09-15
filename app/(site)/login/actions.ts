"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { createWorkshopSession } from "@/lib/auth/session";

export type LoginState = { error?: string; email?: string } | undefined;

// Only ever send people back into the dashboard, so a crafted ?next= can't redirect off-site.
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return /^\/dashboard(\/[\w\-/]*)?$/.test(next) ? next : "/dashboard";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password.", email };

  const user = await db.one<{ id: number; password_hash: string; suspended: boolean }>(
    `SELECT u.id, u.password_hash,
            EXISTS (
              SELECT 1 FROM memberships m
                JOIN service_centres sc ON sc.id = m.service_centre_id
               WHERE m.user_id = u.id AND sc.suspended_at IS NOT NULL
            ) AS suspended
       FROM users u
      WHERE u.email = $1`,
    [email],
  );

  const valid = await verifyPassword(password, user?.password_hash ?? (await getDummyHash()));
  if (!user || !valid) return { error: "That email and password don't match an account.", email };
  // Only revealed after a correct password, so it doesn't confirm which emails have accounts.
  if (user.suspended) {
    return { error: "Halfshaft access for this workshop is paused. Contact Halfshaft to restore it.", email };
  }

  await createWorkshopSession(user.id);
  redirect(safeNext(formData.get("next")));
}

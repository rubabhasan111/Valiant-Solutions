"use server";

import { redirect } from "next/navigation";
import { createAdminSession } from "@/lib/admin/session";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

export type AdminLoginState = { error?: string; email?: string } | undefined;

export async function adminLogin(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const admin = await db.one<{ id: number; password_hash: string }>("SELECT id, password_hash FROM admins WHERE email = $1", [
    email,
  ]);
  const valid = await verifyPassword(password, admin?.password_hash ?? (await getDummyHash()));
  if (!admin || !valid) return { error: "That email and password don't match an admin account.", email };

  await createAdminSession(admin.id);
  redirect("/admin");
}

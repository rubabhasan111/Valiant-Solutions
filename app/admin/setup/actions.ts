"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminSession } from "@/lib/admin/session";
import { hashPassword } from "@/lib/auth/password";
import { db, isUniqueViolation, transaction } from "@/lib/db";

// Creates the very first Halfshaft admin, once. It needs the deployment's CRON_SECRET,
// and it refuses as soon as any admin exists, so it can't be used to add accounts later.

type Field = "token" | "name" | "email" | "password";

export type SetupState =
  | { error?: string; fieldErrors?: Partial<Record<Field, string>>; values?: { name: string; email: string } }
  | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 10;

function matchesSetupToken(token: string): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createFirstAdmin(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const values = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
  };
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (await db.one("SELECT 1 FROM admins LIMIT 1")) {
    return { error: "An admin account already exists. Use the sign-in page." };
  }

  const fieldErrors: Partial<Record<Field, string>> = {};
  if (!values.name) fieldErrors.name = "Enter your name.";
  if (!EMAIL.test(values.email)) fieldErrors.email = "Enter a valid email address.";
  if (password.length < MIN_PASSWORD_LENGTH) fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!matchesSetupToken(token)) fieldErrors.token = "That setup key doesn't match this deployment.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  const passwordHash = await hashPassword(password);

  let adminId: number;
  try {
    adminId = await transaction(async (tx) => {
      // Re-check inside the transaction so two people can't both create the first admin.
      if (await tx.one("SELECT 1 FROM admins LIMIT 1")) throw new Error("already-set-up");
      const admin = await tx.one<{ id: number }>(
        "INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
        [values.name, values.email, passwordHash],
      );
      return admin!.id;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "already-set-up") {
      return { error: "An admin account already exists. Use the sign-in page." };
    }
    if (isUniqueViolation(err)) return { error: "An admin with this email already exists.", values };
    throw err;
  }

  await createAdminSession(adminId);
  redirect("/admin");
}

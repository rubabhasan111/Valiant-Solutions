import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db, isUniqueViolation } from "@/lib/db";
import { EMAIL } from "@/lib/validation";

// Changes a workshop makes to its own details. The business name and phone number appear
// in every text and email its customers get, so they're checked before saving.

export const MIN_PASSWORD_LENGTH = 10;

export type SettingsResult = { ok: true } | { ok: false; error: string };

// Australian landlines (02, 03, 07, 08), mobiles (04), and 13/1300/1800 numbers, with or
// without +61, spaces, brackets or dashes.
export function isAustralianPhone(input: string): boolean {
  const digits = input.replace(/[\s()-]/g, "").replace(/^\+61/, "0").replace(/^61(?=[2-478]\d{8}$)/, "0");
  return /^0[2-478]\d{8}$/.test(digits) || /^1[38]00\d{6}$/.test(digits) || /^13\d{4}$/.test(digits);
}

export async function updateBusinessDetails(
  centreId: number,
  input: { name: string; phone: string; email: string },
): Promise<SettingsResult> {
  const name = input.name.trim().replace(/\s+/g, " ");
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) return { ok: false, error: "Enter the workshop's business name." };
  if (name.length > 80) return { ok: false, error: "Keep the business name under 80 characters." };
  if (phone && !isAustralianPhone(phone)) return { ok: false, error: "Enter an Australian phone number, like 02 9999 1234." };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };

  try {
    await db.run("UPDATE service_centres SET name = $1, phone = $2, email = $3, updated_at = now() WHERE id = $4", [
      name,
      phone || null,
      email,
      centreId,
    ]);
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "Another workshop already uses that email address." };
    throw err;
  }
}

export async function updateProfile(userId: number, input: { name: string; email: string }): Promise<SettingsResult> {
  const name = input.name.trim().replace(/\s+/g, " ");
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Enter your name." };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };

  try {
    await db.run("UPDATE users SET name = $1, email = $2 WHERE id = $3", [name, email, userId]);
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "That email already has a Halfshaft login." };
    throw err;
  }
}

// Needs the current password, and signs out every other session, in case the reason for
// changing it is that someone else knows it.
export async function changePassword(
  userId: number,
  currentSessionHash: string | null,
  input: { current: string; next: string; confirm: string },
): Promise<SettingsResult> {
  if (input.next.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters for the new password.` };
  }
  if (input.next !== input.confirm) return { ok: false, error: "The new passwords don't match." };

  const user = await db.one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [userId]);
  if (!user || !(await verifyPassword(input.current, user.password_hash))) {
    return { ok: false, error: "Your current password isn't right." };
  }

  await db.run("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(input.next), userId]);
  await db.run("DELETE FROM user_sessions WHERE user_id = $1 AND token_hash IS DISTINCT FROM $2", [
    userId,
    currentSessionHash,
  ]);
  return { ok: true };
}

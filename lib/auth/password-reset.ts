import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import { hashSessionToken } from "@/lib/auth/tokens";
import { db, transaction } from "@/lib/db";
import { appUrl } from "@/lib/stripe";

const LINK_VALID_MINUTES = 60;
// Stops the form being used to send someone a stream of emails.
const MAX_LINKS_PER_HOUR = 3;

// Tokens are 32 random bytes in base64url.
const TOKEN = /^[\w-]{43}$/;

// Emails a one-time reset link if the address belongs to a workshop login. Does nothing,
// silently, if it doesn't: the page must not reveal who has an account.
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await db.one<{ id: number; name: string; email: string }>(
    "SELECT id, name, email FROM users WHERE email = $1",
    [email],
  );
  if (!user) return;

  const recent = await db.one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM password_resets WHERE user_id = $1 AND created_at > now() - interval '1 hour'",
    [user.id],
  );
  if ((recent?.n ?? 0) >= MAX_LINKS_PER_HOUR) return;

  await issueResetLink(user, LINK_VALID_MINUTES, "Someone asked to reset the password for your Halfshaft login.");
}

// For a workshop that's locked out and can't receive email: a Halfshaft admin creates the
// link and passes it on. It lasts a day rather than an hour, since it goes through a person.
export const ADMIN_LINK_VALID_HOURS = 24;

export async function createAdminResetLink(
  centreId: number,
  userId: number,
): Promise<{ link: string; name: string; email: string } | null> {
  if (!Number.isInteger(userId)) return null;
  const user = await db.one<{ id: number; name: string; email: string }>(
    `SELECT u.id, u.name, u.email FROM users u
       JOIN memberships m ON m.user_id = u.id
      WHERE u.id = $1 AND m.service_centre_id = $2`,
    [userId, centreId],
  );
  if (!user) return null;
  const link = await issueResetLink(
    user,
    ADMIN_LINK_VALID_HOURS * 60,
    "Halfshaft support made you a link to reset the password for your Halfshaft login.",
  );
  return { link, name: user.name, email: user.email };
}

// Stores the link's hash, emails the link, and returns it.
async function issueResetLink(
  user: { id: number; name: string; email: string },
  validMinutes: number,
  opening: string,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const link = `${appUrl()}/reset-password/${token}`;
  await db.run(
    "INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))",
    [tokenHash, user.id, validMinutes],
  );

  const name = user.name.trim().split(/\s+/)[0];
  const lasts = validMinutes >= 120 ? `${Math.round(validMinutes / 60)} hours` : `${validMinutes} minutes`;
  await db.run(
    `INSERT INTO email_outbox (service_centre_id, notification_id, audience, recipient, subject, text_body, dedupe_key)
     VALUES (NULL, NULL, 'workshop', $1, $2, $3, $4)`,
    [
      user.email,
      "Reset your Halfshaft password",
      `Hi ${name},\n\n${opening} Choose a new one here:\n${link}\n\nThe link works once and expires in ${lasts}. If this wasn't you, ignore this email and your password stays as it is.\n\nHalfshaft`,
      `password_reset:${tokenHash.slice(0, 24)}`,
    ],
  );
  return link;
}

export async function resetTokenIsValid(token: string): Promise<boolean> {
  if (!TOKEN.test(token)) return false;
  const row = await db.one(
    "SELECT 1 FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()",
    [hashSessionToken(token)],
  );
  return Boolean(row);
}

// Sets the new password and signs the user out everywhere, in case someone else had the
// old one. Returns the user's ID, or null if the link was expired or already used.
export async function completePasswordReset(token: string, password: string): Promise<number | null> {
  if (!TOKEN.test(token)) return null;
  const tokenHash = hashSessionToken(token);
  const passwordHash = await hashPassword(password);

  return transaction(async (tx) => {
    const reset = await tx.one<{ user_id: number }>(
      `UPDATE password_resets SET used_at = now()
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
        RETURNING user_id`,
      [tokenHash],
    );
    if (!reset) return null;

    await tx.run("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, reset.user_id]);
    await tx.run("DELETE FROM user_sessions WHERE user_id = $1", [reset.user_id]);
    // Any other link that was sent is now useless too.
    await tx.run("UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", [reset.user_id]);
    return reset.user_id;
  });
}

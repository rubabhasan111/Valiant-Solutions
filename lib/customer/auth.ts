import { randomInt } from "node:crypto";
import { hashSessionToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db";
import { queueCustomerEmail, queueCustomerSms } from "@/lib/notifications";
import { signInCodeMessages } from "@/lib/plan-messages";

// Customers never set a password. They ask for a six-digit code, which is texted and
// emailed to the details their workshop already has on file.

const CODE_VALID_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
// A customer can ask for a few codes in a row (lost text, mistyped address) but not endlessly.
const MAX_CODES_PER_HOUR = 5;

// Emails and texts a sign-in code, if that address belongs to a customer. Does nothing,
// silently, if it doesn't: the page must not reveal who has a plan.
export async function requestCustomerCode(email: string): Promise<void> {
  const address = email.trim().toLowerCase();

  // The same person can be a customer of several workshops; any of their records will do,
  // and the newest has the most current mobile number.
  const customer = await db.one<{ full_name: string; phone: string | null; centre_id: number }>(
    `SELECT c.full_name, c.phone, c.service_centre_id AS centre_id
       FROM customers c
      WHERE c.email = $1
      ORDER BY c.id DESC
      LIMIT 1`,
    [address],
  );
  if (!customer) return;

  const recent = await db.one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM customer_login_codes WHERE email = $1 AND created_at > now() - interval '1 hour'",
    [address],
  );
  if ((recent?.n ?? 0) >= MAX_CODES_PER_HOUR) return;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { id } = (await db.one<{ id: number }>(
    `INSERT INTO customer_login_codes (email, code_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3)) RETURNING id`,
    [address, hashSessionToken(code), CODE_VALID_MINUTES],
  ))!;

  const messages = signInCodeMessages({ code, minutes: CODE_VALID_MINUTES, customerName: customer.full_name });
  // Sent as Halfshaft rather than in a workshop's name: the code covers every workshop.
  await queueCustomerEmail(null, { to: address, ...messages.email }, `signin_code:${id}:email`);
  await queueCustomerSms(null, { to: customer.phone, body: messages.sms }, `signin_code:${id}:sms`);
}

// Checks a code and returns the email address it belongs to, or null.
export async function verifyCustomerCode(email: string, code: string): Promise<string | null> {
  const address = email.trim().toLowerCase();
  const digits = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return null;

  const pending = await db.one<{ id: number; code_hash: string; attempts: number }>(
    `SELECT id, code_hash, attempts FROM customer_login_codes
      WHERE email = $1 AND used_at IS NULL AND expires_at > now()
      ORDER BY id DESC LIMIT 1`,
    [address],
  );
  if (!pending || pending.attempts >= MAX_CODE_ATTEMPTS) return null;

  if (pending.code_hash !== hashSessionToken(digits)) {
    await db.run("UPDATE customer_login_codes SET attempts = attempts + 1 WHERE id = $1", [pending.id]);
    return null;
  }

  // The code works once, and any older ones stop working as well.
  await db.run("UPDATE customer_login_codes SET used_at = now() WHERE email = $1 AND used_at IS NULL", [address]);
  return address;
}

import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hashSessionToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db";

// Customers sign in with their email address, so one session covers every workshop they're
// paying. proxy.ts checks for this cookie name too; keep them in sync.
export const CUSTOMER_SESSION_COOKIE = "hs_customer_session";
const SESSION_DAYS = 30;

export async function createCustomerSession(email: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");

  await db.run("DELETE FROM customer_sessions WHERE expires_at <= now()");
  await db.run(
    "INSERT INTO customer_sessions (token_hash, email, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))",
    [hashSessionToken(token), email.toLowerCase(), SESSION_DAYS],
  );

  (await cookies()).set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroyCustomerSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (token) await db.run("DELETE FROM customer_sessions WHERE token_hash = $1", [hashSessionToken(token)]);
  store.delete(CUSTOMER_SESSION_COOKIE);
}

export const getCustomerEmail = cache(async (): Promise<string | null> => {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.one<{ email: string }>(
    "SELECT email FROM customer_sessions WHERE token_hash = $1 AND expires_at > now()",
    [hashSessionToken(token)],
  );
  return session?.email ?? null;
});

// Every page under /account goes through this, and only ever reads rows belonging to the
// signed-in email address.
export const requireCustomer = cache(async (): Promise<string> => {
  const email = await getCustomerEmail();
  if (!email) redirect("/account/login");
  return email;
});

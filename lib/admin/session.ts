import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { hashSessionToken } from "@/lib/auth/session";
import { db } from "@/lib/db";

// proxy.ts checks for this cookie name too; keep them in sync.
export const ADMIN_SESSION_COOKIE = "hs_admin_session";
// Admins can suspend workshops, so their sessions are short and never leave /admin.
const SESSION_HOURS = 12;

export async function createAdminSession(adminId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");

  await db.run("DELETE FROM admin_sessions WHERE expires_at <= now()");
  await db.run(
    "INSERT INTO admin_sessions (token_hash, admin_id, expires_at) VALUES ($1, $2, now() + make_interval(hours => $3))",
    [hashSessionToken(token), adminId, SESSION_HOURS],
  );

  (await cookies()).set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (token) await db.run("DELETE FROM admin_sessions WHERE token_hash = $1", [hashSessionToken(token)]);
  store.delete({ name: ADMIN_SESSION_COOKIE, path: "/admin" });
}

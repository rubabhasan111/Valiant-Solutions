import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

// proxy.ts checks for this cookie name too; keep them in sync.
export const WORKSHOP_SESSION_COOKIE = "hs_workshop_session";
const SESSION_DAYS = 30;

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createWorkshopSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");

  await db.run("DELETE FROM user_sessions WHERE expires_at <= now()");
  await db.run(
    "INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))",
    [hashSessionToken(token), userId, SESSION_DAYS],
  );

  (await cookies()).set(WORKSHOP_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroyWorkshopSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(WORKSHOP_SESSION_COOKIE)?.value;
  if (token) {
    await db.run("DELETE FROM user_sessions WHERE token_hash = $1", [hashSessionToken(token)]);
  }
  store.delete(WORKSHOP_SESSION_COOKIE);
}

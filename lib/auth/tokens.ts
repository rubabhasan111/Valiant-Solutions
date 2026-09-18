import { createHash } from "node:crypto";

// Session cookies and password reset links carry a random token; only its SHA-256 hash is
// stored, so a copy of the database can't be used to log in or reset anyone's password.
// Kept apart from the session helpers, which reach for request cookies.
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

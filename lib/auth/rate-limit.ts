import { db } from "@/lib/db";

// Slows down anyone guessing passwords or sign-in codes. Attempts are counted in the
// database rather than in memory, because each request can run on a different server.

export type RateLimitScope = "workshop_login" | "admin_login" | "password_reset" | "customer_code";

type Rule = { maxAttempts: number; windowMinutes: number };

const RULES: Record<RateLimitScope, Rule> = {
  workshop_login: { maxAttempts: 5, windowMinutes: 15 },
  admin_login: { maxAttempts: 5, windowMinutes: 15 },
  password_reset: { maxAttempts: 5, windowMinutes: 60 },
  customer_code: { maxAttempts: 5, windowMinutes: 15 },
};

// One address being tried from many connections, or many addresses from one connection,
// both run into this.
const PER_ADDRESS: Rule = { maxAttempts: 30, windowMinutes: 15 };

export type RateLimitResult = { allowed: boolean; retryAfterMinutes: number };

async function attemptsWithin(scope: string, identifier: string, windowMinutes: number) {
  const row = await db.one<{ n: number; oldest: string | null }>(
    `SELECT COUNT(*) AS n, MIN(created_at) AS oldest
       FROM auth_attempts
      WHERE scope = $1 AND identifier = $2 AND created_at > now() - make_interval(mins => $3)`,
    [scope, identifier, windowMinutes],
  );
  return { count: row?.n ?? 0, oldest: row?.oldest ?? null };
}

function minutesUntilFree(oldest: string | null, windowMinutes: number): number {
  if (!oldest) return windowMinutes;
  const freeAt = Date.parse(oldest) + windowMinutes * 60_000;
  return Math.max(1, Math.ceil((freeAt - Date.now()) / 60_000));
}

export async function checkRateLimit(scope: RateLimitScope, identifier: string, address: string): Promise<RateLimitResult> {
  const rule = RULES[scope];
  const [byIdentifier, byAddress] = await Promise.all([
    attemptsWithin(scope, identifier.toLowerCase(), rule.windowMinutes),
    attemptsWithin(scope, `ip:${address}`, PER_ADDRESS.windowMinutes),
  ]);

  if (byIdentifier.count >= rule.maxAttempts) {
    return { allowed: false, retryAfterMinutes: minutesUntilFree(byIdentifier.oldest, rule.windowMinutes) };
  }
  if (byAddress.count >= PER_ADDRESS.maxAttempts) {
    return { allowed: false, retryAfterMinutes: minutesUntilFree(byAddress.oldest, PER_ADDRESS.windowMinutes) };
  }
  return { allowed: true, retryAfterMinutes: 0 };
}

export async function recordFailedAttempt(scope: RateLimitScope, identifier: string, address: string) {
  await db.run("INSERT INTO auth_attempts (scope, identifier) VALUES ($1, $2), ($1, $3)", [
    scope,
    identifier.toLowerCase(),
    `ip:${address}`,
  ]);
}

// A correct sign-in clears the count, so a forgetful person isn't locked out afterwards.
export async function clearAttempts(scope: RateLimitScope, identifier: string) {
  await db.run("DELETE FROM auth_attempts WHERE scope = $1 AND identifier = $2", [scope, identifier.toLowerCase()]);
}

export function tooManyAttemptsMessage(retryAfterMinutes: number): string {
  const wait = retryAfterMinutes === 1 ? "a minute" : `${retryAfterMinutes} minutes`;
  return `Too many attempts. Try again in ${wait}.`;
}

// Keeps the table small; old rows are past every window.
export async function purgeOldAuthAttempts(): Promise<number> {
  return db.run("DELETE FROM auth_attempts WHERE created_at < now() - interval '1 day'");
}

import { headers } from "next/headers";

// Vercel puts the visitor's address in x-forwarded-for; the first entry is the client.
// Kept apart from the rate limiter itself, which is plain database code.
export async function callerAddress(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

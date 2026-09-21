import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { raiseAlerts } from "@/lib/jobs";

// A daily check from Vercel Cron, separate from the GitHub schedule that runs the debit job.
// If that schedule stops, the debit job can't notice by itself; this can, and texts the
// admins. Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" automatically.

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return Response.json({ error: "Unauthorised." }, { status: 401 });
  const alerts = await raiseAlerts();
  if (!alerts) return Response.json({ error: "Alerts couldn't be checked." }, { status: 500 });
  return Response.json(alerts);
}

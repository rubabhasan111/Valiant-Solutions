import type { NextRequest } from "next/server";
import { getWorkshopContext } from "@/lib/auth/dal";
import { buildPaymentsCsv, type ExportKind } from "@/lib/export";
import { isIsoDate } from "@/lib/schedule";

// Downloads the workshop's payments as a CSV file. Owner only: it lists every customer's
// contact details and payments.
export async function GET(request: NextRequest) {
  const context = await getWorkshopContext();
  if (!context) return new Response("Log in to continue.", { status: 401 });
  if (context.role !== "owner") return new Response("Only the workshop's owner can export payments.", { status: 403 });

  const params = request.nextUrl.searchParams;
  const kind: ExportKind = params.get("kind") === "schedule" ? "schedule" : "received";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    return new Response("Choose a valid date range, with the start before the end.", { status: 400 });
  }

  const { csv } = await buildPaymentsCsv(context.centre.id, kind, from, to);
  const name = `halfshaft-${kind === "received" ? "payments-received" : "payment-schedule"}-${from}-to-${to}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

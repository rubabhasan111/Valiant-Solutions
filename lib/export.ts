import { db } from "@/lib/db";

// CSV downloads of a workshop's payments, for its bookkeeping. Opens in Excel, Numbers and
// Google Sheets; amounts are plain numbers so they can be added up.

export type ExportKind = "received" | "schedule";

type Row = {
  paid_on: string | null;
  due_date: string;
  customer: string;
  email: string;
  phone: string | null;
  vehicle_rego: string | null;
  plan: string;
  plan_id: number;
  plan_status: string;
  sequence: number;
  instalment_count: number;
  amount_cents: number;
  status: string;
  paid_outside_stripe: boolean;
  payment_note: string | null;
  stripe_payment_intent_id: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  processing: "Processing",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Not collected",
};

// Quotes every field, and stops a cell that starts with = + - or @ from being run as a
// spreadsheet formula (a customer's name is typed by a person).
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function buildPaymentsCsv(
  centreId: number,
  kind: ExportKind,
  from: string,
  to: string,
): Promise<{ csv: string; rows: number }> {
  // "received": money that arrived in the range, by the date it cleared (Sydney time).
  // "schedule": every payment due in the range, whatever its state.
  const where =
    kind === "received"
      ? "i.status = 'paid' AND (i.paid_at AT TIME ZONE 'Australia/Sydney')::date BETWEEN $2 AND $3"
      : "i.due_date BETWEEN $2 AND $3";
  const order = kind === "received" ? "i.paid_at, i.id" : "i.due_date, i.id";

  const rows = await db.query<Row>(
    `SELECT to_char(i.paid_at AT TIME ZONE 'Australia/Sydney', 'YYYY-MM-DD') AS paid_on,
            to_char(i.due_date, 'YYYY-MM-DD') AS due_date,
            c.full_name AS customer, c.email, c.phone, c.vehicle_rego,
            p.description AS plan, p.id AS plan_id, p.status AS plan_status,
            i.sequence, p.instalment_count, i.amount_cents, i.status,
            i.paid_outside_stripe, i.payment_note, i.stripe_payment_intent_id
       FROM instalments i
       JOIN payment_plans p ON p.id = i.payment_plan_id
       JOIN customers c ON c.id = p.customer_id
      WHERE p.service_centre_id = $1 AND ${where}
      ORDER BY ${order}`,
    [centreId, from, to],
  );

  const header = [
    "Date paid",
    "Due date",
    "Customer",
    "Email",
    "Mobile",
    "Vehicle rego",
    "Plan",
    "Plan ID",
    "Payment",
    "Amount (AUD)",
    "Status",
    "Paid by",
    "Note",
    "Stripe payment ID",
  ];
  const lines = rows.map((row) =>
    [
      csvCell(row.paid_on),
      csvCell(row.due_date),
      csvCell(row.customer),
      csvCell(row.email),
      csvCell(row.phone),
      csvCell(row.vehicle_rego),
      csvCell(row.plan),
      csvCell(row.plan_id),
      csvCell(`${row.sequence} of ${row.instalment_count}`),
      csvCell((row.amount_cents / 100).toFixed(2)),
      csvCell(STATUS_LABEL[row.status] ?? row.status),
      csvCell(row.status !== "paid" ? null : row.paid_outside_stripe ? "Recorded by workshop" : "Direct debit"),
      csvCell(row.payment_note),
      csvCell(row.stripe_payment_intent_id),
    ].join(","),
  );

  // The byte order mark tells Excel the file is UTF-8, so names with accents survive.
  return { csv: `﻿${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`, rows: rows.length };
}

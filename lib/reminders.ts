import { db } from "@/lib/db";
import { queueCustomerEmail, queueCustomerSms } from "@/lib/notifications";
import { reminderMessages } from "@/lib/plan-messages";
import { hourInSydney } from "@/lib/schedule";
import { appUrl } from "@/lib/stripe";

// Customers are reminded before each debit so they can make sure the money is there, which
// is the cheapest way to avoid a failed payment. Texts go to anyone with a mobile on file,
// email to everyone else.
export const REMINDER_DAYS_BEFORE = 2;
// Sydney hours when it's reasonable to send a text.
const EARLIEST_HOUR = 9;
const LATEST_HOUR = 19;

export type ReminderResult = { texted: number; emailed: number; heldForQuietHours: boolean };

type DueReminder = {
  id: number;
  sequence: number;
  amount_cents: number;
  due_date: string;
  description: string;
  instalment_count: number;
  setup_token: string;
  full_name: string;
  email: string;
  phone: string | null;
  centre_id: number;
  centre_name: string;
  centre_phone: string | null;
};

export async function sendPaymentReminders(
  asOf: string,
  options: { ignoreQuietHours?: boolean; limit?: number } = {},
): Promise<ReminderResult> {
  const hour = hourInSydney();
  if (!options.ignoreQuietHours && (hour < EARLIEST_HOUR || hour >= LATEST_HOUR)) {
    return { texted: 0, emailed: 0, heldForQuietHours: true };
  }

  // Everything due in the next couple of days that hasn't been reminded yet. The dedupe key
  // carries the due date, so each payment is only ever reminded once.
  const due = await db.query<DueReminder>(
    `SELECT i.id, i.sequence, i.amount_cents, to_char(i.due_date, 'YYYY-MM-DD') AS due_date,
            p.description, p.instalment_count, p.setup_token,
            c.full_name, c.email, c.phone,
            sc.id AS centre_id, sc.name AS centre_name, sc.phone AS centre_phone
       FROM instalments i
       JOIN payment_plans p ON p.id = i.payment_plan_id
       JOIN customers c ON c.id = p.customer_id
       JOIN service_centres sc ON sc.id = p.service_centre_id
      WHERE p.status = 'active' AND i.status = 'scheduled'
        AND i.due_date > $1::date AND i.due_date <= $1::date + $2::int
      ORDER BY i.due_date, i.id
      LIMIT $3`,
    [asOf, REMINDER_DAYS_BEFORE, options.limit ?? 200],
  );

  const result: ReminderResult = { texted: 0, emailed: 0, heldForQuietHours: false };

  for (const row of due) {
    const messages = reminderMessages({
      centreName: row.centre_name,
      centrePhone: row.centre_phone,
      customerName: row.full_name,
      description: row.description,
      link: `${appUrl()}/pay/${row.setup_token}`,
      amountCents: row.amount_cents,
      dueDate: row.due_date,
      sequence: row.sequence,
      instalmentCount: row.instalment_count,
    });

    const key = `reminder:${row.id}:${row.due_date}`;
    const texted = await queueCustomerSms(row.centre_id, { to: row.phone, body: messages.sms }, `${key}:sms`);
    if (texted > 0) {
      result.texted++;
      continue;
    }
    // No mobile on file (or the text was already queued): fall back to email.
    if (!row.phone) {
      result.emailed += await queueCustomerEmail(row.centre_id, { to: row.email, ...messages.email }, `${key}:email`);
    }
  }

  return result;
}

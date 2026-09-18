import { db, transaction, type Notification, type NotificationKind, type Sql } from "@/lib/db";
import { normaliseAuMobile } from "@/lib/phone";
import { appUrl } from "@/lib/stripe";

type EmailInput = { to: string; subject: string; text: string };
// `to` is whatever phone number is on file; texts are only queued for valid Australian mobiles.
type SmsInput = { to: string | null; body: string };

type NotifyInput = {
  centreId: number;
  planId?: number | null;
  instalmentId?: number | null;
  kind: NotificationKind;
  title: string;
  body: string;
  // Identifies the underlying event, e.g. one failed attempt of one instalment.
  dedupeKey: string;
  emailWorkshop?: boolean;
  customerEmail?: EmailInput;
  customerSms?: SmsInput;
};

const QUEUE_EMAIL = `
  INSERT INTO email_outbox (service_centre_id, notification_id, audience, recipient, subject, text_body, dedupe_key)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (dedupe_key) DO NOTHING`;

const QUEUE_SMS = `
  INSERT INTO sms_outbox (service_centre_id, notification_id, recipient, body, dedupe_key)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (dedupe_key) DO NOTHING`;

// Queues an email with no Activity entry, for messages only the customer needs. Returns how
// many were queued: 0 when this message has already been queued under the same key.
// centreId is null for messages that aren't about one workshop, such as a sign-in code.
export async function queueCustomerEmail(
  centreId: number | null,
  email: EmailInput,
  dedupeKey: string,
  sql: Sql = db,
): Promise<number> {
  return sql.run(QUEUE_EMAIL, [centreId, null, "customer", email.to, email.subject, email.text, dedupeKey]);
}

// Queues a text with no Activity entry. Returns 0 when the number isn't an Australian mobile
// (so the caller can fall back to email) or the text was already queued.
export async function queueCustomerSms(
  centreId: number | null,
  sms: SmsInput,
  dedupeKey: string,
  sql: Sql = db,
): Promise<number> {
  const mobile = sms.to ? normaliseAuMobile(sms.to) : null;
  if (!mobile) return 0;
  return sql.run(QUEUE_SMS, [centreId, null, mobile, sms.body, dedupeKey]);
}

// Records an update in the workshop's Activity feed and queues any emails and texts. Safe
// to call more than once for the same event: repeats with the same dedupe key do nothing.
export async function notify(input: NotifyInput): Promise<boolean> {
  return transaction(async (tx) => {
    const inserted = await tx.one<{ id: number }>(
      `INSERT INTO notifications (service_centre_id, payment_plan_id, instalment_id, kind, title, body, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [input.centreId, input.planId ?? null, input.instalmentId ?? null, input.kind, input.title, input.body, input.dedupeKey],
    );
    if (!inserted) return false;

    if (input.emailWorkshop) {
      const centre = await tx.one<{ email: string }>("SELECT email FROM service_centres WHERE id = $1", [input.centreId]);
      if (centre) {
        const link = `${appUrl()}/dashboard${input.planId ? `/plans/${input.planId}` : "/activity"}`;
        await tx.run(QUEUE_EMAIL, [
          input.centreId,
          inserted.id,
          "workshop",
          centre.email,
          input.title,
          `${input.body}\n\nView it in Halfshaft: ${link}`,
          `${input.dedupeKey}:workshop`,
        ]);
      }
    }

    if (input.customerEmail) {
      await tx.run(QUEUE_EMAIL, [
        input.centreId,
        inserted.id,
        "customer",
        input.customerEmail.to,
        input.customerEmail.subject,
        input.customerEmail.text,
        `${input.dedupeKey}:customer`,
      ]);
    }

    const mobile = input.customerSms?.to ? normaliseAuMobile(input.customerSms.to) : null;
    if (input.customerSms && mobile) {
      await tx.run(QUEUE_SMS, [input.centreId, inserted.id, mobile, input.customerSms.body, `${input.dedupeKey}:sms`]);
    }

    return true;
  });
}

export async function listNotifications(centreId: number, limit = 100): Promise<Notification[]> {
  return db.query<Notification>(
    "SELECT * FROM notifications WHERE service_centre_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2",
    [centreId, limit],
  );
}

export async function unreadNotificationCount(centreId: number): Promise<number> {
  const row = await db.one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM notifications WHERE service_centre_id = $1 AND read_at IS NULL",
    [centreId],
  );
  return row?.n ?? 0;
}

// Payments still being retried and plans paused for new bank details, for the overview.
// Each one drops off by itself once the payment clears or the plan resumes.
export async function listWaitingOnCustomers(centreId: number, limit = 5): Promise<Notification[]> {
  return db.query<Notification>(
    `SELECT n.* FROM notifications n
       JOIN payment_plans p ON p.id = n.payment_plan_id
       LEFT JOIN instalments i ON i.id = n.instalment_id
      WHERE n.service_centre_id = $1
        AND ((n.kind = 'debit_failed' AND i.status = 'failed' AND p.status = 'active')
          OR (n.kind = 'bank_details_needed' AND p.status = 'failed'))
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT $2`,
    [centreId, limit],
  );
}

export async function markAllNotificationsRead(centreId: number) {
  await db.run("UPDATE notifications SET read_at = now() WHERE service_centre_id = $1 AND read_at IS NULL", [centreId]);
}

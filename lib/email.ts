import { db } from "@/lib/db";

const MAX_SEND_ATTEMPTS = 5;

export type EmailDeliveryResult = { sent: number; skipped: number; failed: number };

type Audience = "workshop" | "customer";

// Customer emails go out in the workshop's name from Halfshaft's own address, and replies
// go straight to the workshop. Emails to workshops are sent as Halfshaft.
export function emailSender(
  emailFrom: string,
  audience: Audience,
  centre: { name: string; email: string } | null,
): { from: string; replyTo?: string } {
  if (audience !== "customer" || !centre) return { from: emailFrom };
  const address = emailFrom.match(/<([^>]+)>/)?.[1]?.trim() ?? emailFrom.trim();
  // Quotes, angle brackets and line breaks would break the From header.
  const name = centre.name.replace(/["\\<>\r\n]/g, "").trim();
  return { from: name ? `"${name}" <${address}>` : address, replyTo: centre.email };
}

// Sends queued emails through Resend's HTTP API. Without RESEND_API_KEY and EMAIL_FROM
// (for example in local development) queued emails are marked as skipped, not sent.
export async function deliverPendingEmails(limit = 50): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const result: EmailDeliveryResult = { sent: 0, skipped: 0, failed: 0 };

  const rows = await db.query<{
    id: number;
    recipient: string;
    subject: string;
    text_body: string;
    attempts: number;
    audience: Audience;
    centre_name: string | null;
    centre_email: string | null;
  }>(
    `SELECT e.id, e.recipient, e.subject, e.text_body, e.attempts, e.audience,
            sc.name AS centre_name, sc.email AS centre_email
       FROM email_outbox e
       LEFT JOIN service_centres sc ON sc.id = e.service_centre_id
      WHERE e.status = 'pending'
      ORDER BY e.id
      LIMIT $1`,
    [limit],
  );

  for (const row of rows) {
    if (!apiKey || !from) {
      await db.run("UPDATE email_outbox SET status = 'skipped', last_error = $1 WHERE id = $2 AND status = 'pending'", [
        "Email delivery isn't configured (set RESEND_API_KEY and EMAIL_FROM).",
        row.id,
      ]);
      result.skipped++;
      continue;
    }

    const centre = row.centre_name && row.centre_email ? { name: row.centre_name, email: row.centre_email } : null;
    const sender = emailSender(from, row.audience, centre);

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          // Stops a retried request sending the same email twice.
          "Idempotency-Key": `halfshaft-email-${row.id}`,
        },
        body: JSON.stringify({
          from: sender.from,
          to: [row.recipient],
          subject: row.subject,
          text: row.text_body,
          ...(sender.replyTo ? { reply_to: sender.replyTo } : {}),
        }),
      });
      if (!response.ok) throw new Error(`Resend responded ${response.status}: ${(await response.text()).slice(0, 300)}`);

      await db.run(
        "UPDATE email_outbox SET status = 'sent', sent_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1",
        [row.id],
      );
      result.sent++;
    } catch (err) {
      const attempts = row.attempts + 1;
      await db.run("UPDATE email_outbox SET attempts = $1, last_error = $2, status = $3 WHERE id = $4", [
        attempts,
        err instanceof Error ? err.message : String(err),
        attempts >= MAX_SEND_ATTEMPTS ? "failed" : "pending",
        row.id,
      ]);
      result.failed++;
    }
  }

  return result;
}

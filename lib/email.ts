import { db } from "@/lib/db";

const MAX_SEND_ATTEMPTS = 5;

export type EmailDeliveryResult = { sent: number; skipped: number; failed: number };

// Sends queued emails through Resend's HTTP API. Without RESEND_API_KEY and EMAIL_FROM
// (for example in local development) queued emails are marked as skipped, not sent.
export async function deliverPendingEmails(limit = 50): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const result: EmailDeliveryResult = { sent: 0, skipped: 0, failed: 0 };

  const rows = await db.query<{ id: number; recipient: string; subject: string; text_body: string; attempts: number }>(
    "SELECT id, recipient, subject, text_body, attempts FROM email_outbox WHERE status = 'pending' ORDER BY id LIMIT $1",
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

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          // Stops a retried request sending the same email twice.
          "Idempotency-Key": `halfshaft-email-${row.id}`,
        },
        body: JSON.stringify({ from, to: [row.recipient], subject: row.subject, text: row.text_body }),
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

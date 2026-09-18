import { db } from "@/lib/db";

const MAX_SEND_ATTEMPTS = 5;
// A text claimed for sending but never finished (the process stopped) is tried again after this.
const STUCK_AFTER_MINUTES = 15;
// ClickSend statuses where sending the same message again can't succeed.
const PERMANENT_FAILURES = new Set([
  "INVALID_RECIPIENT",
  "INVALID_SENDER_ID",
  "COUNTRY_NOT_ENABLED",
  "EMPTY_MESSAGE",
  "BAD_KEYWORD_SMS",
]);

export type SmsDeliveryResult = { sent: number; skipped: number; failed: number };

type ClickSendResponse = {
  response_code?: string;
  response_msg?: string;
  data?: { messages?: { status?: string; message_id?: string }[] };
};

// Sends queued texts through ClickSend's REST API. Without CLICKSEND_USERNAME and
// CLICKSEND_API_KEY (for example in local development) they're marked as skipped, not sent.
// ClickSend has no idempotency keys, so a timeout after it accepted a text can send that
// text twice; a rare duplicate reminder is much less harmful than a missing one.
export async function deliverPendingSms(limit = 50): Promise<SmsDeliveryResult> {
  const username = process.env.CLICKSEND_USERNAME;
  const apiKey = process.env.CLICKSEND_API_KEY;
  // Optional alphanumeric sender name (up to 11 characters); ClickSend's shared number otherwise.
  const sender = process.env.SMS_SENDER?.trim() || undefined;
  const result: SmsDeliveryResult = { sent: 0, skipped: 0, failed: 0 };

  await db.run(
    `UPDATE sms_outbox SET status = 'pending'
      WHERE status = 'sending' AND last_attempt_at < now() - make_interval(mins => $1)`,
    [STUCK_AFTER_MINUTES],
  );

  const rows = await db.query<{ id: number; recipient: string; body: string; attempts: number }>(
    "SELECT id, recipient, body, attempts FROM sms_outbox WHERE status = 'pending' ORDER BY id LIMIT $1",
    [limit],
  );

  for (const row of rows) {
    if (!username || !apiKey) {
      await db.run("UPDATE sms_outbox SET status = 'skipped', last_error = $1 WHERE id = $2 AND status = 'pending'", [
        "Text messages aren't configured (set CLICKSEND_USERNAME and CLICKSEND_API_KEY).",
        row.id,
      ]);
      result.skipped++;
      continue;
    }

    // Claim the text first so an overlapping run doesn't send it as well.
    const claimed = await db.run(
      "UPDATE sms_outbox SET status = 'sending', attempts = attempts + 1, last_attempt_at = now() WHERE id = $1 AND status = 'pending'",
      [row.id],
    );
    if (!claimed) continue;
    const attempts = row.attempts + 1;

    try {
      const response = await fetch("https://rest.clicksend.com/v3/sms/send", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { source: "halfshaft", to: row.recipient, body: row.body, from: sender, custom_string: `halfshaft-sms-${row.id}` },
          ],
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ClickSendResponse;
      const message = payload.data?.messages?.[0];

      if (response.ok && message?.status === "SUCCESS") {
        await db.run(
          "UPDATE sms_outbox SET status = 'sent', sent_at = now(), provider_message_id = $1, last_error = NULL WHERE id = $2",
          [message.message_id ?? null, row.id],
        );
        result.sent++;
        continue;
      }

      const code = message?.status ?? payload.response_code ?? `HTTP_${response.status}`;
      const giveUp = PERMANENT_FAILURES.has(code) || attempts >= MAX_SEND_ATTEMPTS;
      await db.run("UPDATE sms_outbox SET status = $1, last_error = $2 WHERE id = $3", [
        giveUp ? "failed" : "pending",
        `${code}${payload.response_msg ? `: ${payload.response_msg}` : ""}`.slice(0, 300),
        row.id,
      ]);
      result.failed++;
    } catch (err) {
      await db.run("UPDATE sms_outbox SET status = $1, last_error = $2 WHERE id = $3", [
        attempts >= MAX_SEND_ATTEMPTS ? "failed" : "pending",
        err instanceof Error ? err.message : String(err),
        row.id,
      ]);
      result.failed++;
    }
  }

  return result;
}

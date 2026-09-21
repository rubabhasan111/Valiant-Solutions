import { db, transaction } from "@/lib/db";
import { formatAud } from "@/lib/money";
import { normaliseAuMobile } from "@/lib/phone";
import { appUrl } from "@/lib/stripe";

// Tells Halfshaft's own admins, by text and email, when something needs a person to look
// at it. Workshops and customers never see these. Each problem alerts once when it starts,
// again once a day while it lasts, and once more when it clears.

export type AlertCondition = { key: string; title: string; detail: string };

// The scheduler runs every 15 minutes; allow for GitHub delaying a run or two.
export const SCHEDULER_STALE_MINUTES = 45;
// BECS debits normally settle within four business days.
const STUCK_PROCESSING_DAYS = 7;
// ClickSend charges about 5-10c a text, so this is roughly 50 texts.
export const SMS_CREDIT_WARNING = 5;
const REMIND_EVERY_HOURS = 24;

export async function smsCreditBalance(): Promise<number | null> {
  const username = process.env.CLICKSEND_USERNAME;
  const apiKey = process.env.CLICKSEND_API_KEY;
  if (!username || !apiKey) return null;
  try {
    const response = await fetch("https://rest.clicksend.com/v3/account", {
      headers: { Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: { balance?: string | number } };
    const balance = Number(payload.data?.balance);
    return Number.isFinite(balance) ? balance : null;
  } catch {
    return null;
  }
}

// Everything that's wrong right now. `smsBalance` is passed in so tests don't call ClickSend.
export async function currentConditions(options: { smsBalance?: number | null } = {}): Promise<AlertCondition[]> {
  const conditions: AlertCondition[] = [];

  const [lastRun, lastFinished, stuck, failedMessages, blockedCentres] = await Promise.all([
    db.one<{ started_at: string; finished_at: string | null; minutes: number }>(
      `SELECT started_at, finished_at, EXTRACT(EPOCH FROM now() - started_at) / 60 AS minutes
         FROM job_runs WHERE job = 'debits' ORDER BY id DESC LIMIT 1`,
    ),
    db.one<{ error: string | null }>(
      "SELECT error FROM job_runs WHERE job = 'debits' AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 1",
    ),
    db.one<{ n: number; cents: number }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(amount_cents), 0) AS cents FROM instalments
        WHERE status = 'processing' AND last_attempt_at < now() - make_interval(days => $1)`,
      [STUCK_PROCESSING_DAYS],
    ),
    db.one<{ texts: number; emails: number; last_error: string | null }>(
      `SELECT (SELECT COUNT(*) FROM sms_outbox WHERE status = 'failed' AND created_at > now() - interval '1 day') AS texts,
              (SELECT COUNT(*) FROM email_outbox WHERE status = 'failed' AND created_at > now() - interval '1 day') AS emails,
              (SELECT last_error FROM sms_outbox WHERE status = 'failed' AND created_at > now() - interval '1 day'
                ORDER BY id DESC LIMIT 1) AS last_error`,
    ),
    db.query<{ name: string }>(
      `SELECT sc.name FROM service_centres sc
        WHERE sc.suspended_at IS NULL
          AND (NOT sc.charges_enabled OR sc.becs_capability IS DISTINCT FROM 'active')
          AND EXISTS (SELECT 1 FROM payment_plans p WHERE p.service_centre_id = sc.id AND p.status IN ('active', 'paused'))
        ORDER BY sc.name`,
    ),
  ]);

  if (!lastRun || Number(lastRun.minutes) > SCHEDULER_STALE_MINUTES) {
    conditions.push({
      key: "scheduler_stale",
      title: "The debit job isn't running",
      detail: lastRun
        ? `It last ran ${Math.round(Number(lastRun.minutes))} minutes ago, so payments aren't being collected. Check the GitHub Actions schedule.`
        : "It has never run. Check the GitHub Actions schedule.",
    });
  } else if (!lastRun.finished_at && Number(lastRun.minutes) > 15) {
    conditions.push({
      key: "job_stuck",
      title: "The debit job didn't finish",
      detail: "A run started over 15 minutes ago and never finished. Check the Vercel logs.",
    });
  }

  if (lastFinished?.error) {
    conditions.push({
      key: "job_failed",
      title: "The debit job is failing",
      detail: `Last error: ${lastFinished.error.slice(0, 160)}`,
    });
  }

  if (Number(stuck?.n) > 0) {
    const n = Number(stuck!.n);
    conditions.push({
      key: "payments_stuck",
      title: `${n} ${n === 1 ? "payment has" : "payments have"} been processing over ${STUCK_PROCESSING_DAYS} days`,
      detail: `${formatAud(Number(stuck!.cents))} hasn't settled. Check these payments in Stripe.`,
    });
  }

  const failedTexts = Number(failedMessages?.texts ?? 0);
  const failedEmails = Number(failedMessages?.emails ?? 0);
  if (failedTexts + failedEmails > 0) {
    const parts = [
      failedTexts ? `${failedTexts} ${failedTexts === 1 ? "text" : "texts"}` : null,
      failedEmails ? `${failedEmails} ${failedEmails === 1 ? "email" : "emails"}` : null,
    ].filter(Boolean);
    conditions.push({
      key: "messages_failing",
      title: "Customer messages are failing",
      detail: `${parts.join(" and ")} couldn't be sent in the last day.${failedMessages?.last_error ? ` Latest: ${failedMessages.last_error.slice(0, 120)}` : ""}`,
    });
  }

  if (options.smsBalance !== undefined && options.smsBalance !== null && options.smsBalance < SMS_CREDIT_WARNING) {
    conditions.push({
      key: "sms_credit_low",
      title: "SMS credit is running low",
      detail: `ClickSend has $${options.smsBalance.toFixed(2)} left. Top it up, or reminders and plan links will stop sending.`,
    });
  }

  if (blockedCentres.length > 0) {
    conditions.push({
      key: "workshops_cant_debit",
      title: `${blockedCentres.length === 1 ? "A workshop" : `${blockedCentres.length} workshops`} can't take debits`,
      detail: `Stripe has stopped debits for ${blockedCentres.map((c) => c.name).join(", ")}, so their customers' payments aren't being collected. They need to finish Stripe's checks.`,
    });
  }

  return conditions;
}

type AlertRow = { key: string; title: string; occurrence: number; resolved_at: string | null; last_notified_at: string };

export type AlertCheckResult = { opened: string[]; reminded: string[]; resolved: string[] };

// Compares what's wrong now with the alerts already open, and queues texts and emails for
// the changes. The caller sends them (deliverPendingMessages).
export async function checkAlerts(options: { smsBalance?: number | null } = {}): Promise<AlertCheckResult> {
  const conditions = await currentConditions(options);
  const result: AlertCheckResult = { opened: [], reminded: [], resolved: [] };

  const rows = await db.query<AlertRow>("SELECT key, title, occurrence, resolved_at, last_notified_at FROM system_alerts");
  const existing = new Map(rows.map((row) => [row.key, row]));
  const now = Date.now();

  for (const condition of conditions) {
    const row = existing.get(condition.key);
    if (!row || row.resolved_at) {
      const opened = await db.one<{ occurrence: number }>(
        `INSERT INTO system_alerts (key, title, detail) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE
           SET title = EXCLUDED.title, detail = EXCLUDED.detail, occurrence = system_alerts.occurrence + 1,
               opened_at = now(), last_notified_at = now(), resolved_at = NULL
           WHERE system_alerts.resolved_at IS NOT NULL
         RETURNING occurrence`,
        [condition.key, condition.title, condition.detail],
      );
      // Another run opened it at the same moment; that run sends the alert.
      if (!opened) continue;
      await queueAlert(`${condition.key}:${opened.occurrence}:opened`, `Halfshaft alert: ${condition.title}`, condition.detail);
      result.opened.push(condition.key);
      continue;
    }

    // Keep the wording current (counts change), and remind once a day while it lasts. The
    // time check is in the WHERE clause so two overlapping runs can't both remind.
    await db.run("UPDATE system_alerts SET title = $2, detail = $3 WHERE key = $1", [
      condition.key,
      condition.title,
      condition.detail,
    ]);
    if (now - Date.parse(row.last_notified_at) < REMIND_EVERY_HOURS * 3_600_000) continue;
    const due = await db.run(
      `UPDATE system_alerts SET last_notified_at = now()
        WHERE key = $1 AND resolved_at IS NULL AND last_notified_at < now() - make_interval(hours => $2)`,
      [condition.key, REMIND_EVERY_HOURS],
    );
    if (!due) continue;
    await queueAlert(
      `${condition.key}:${row.occurrence}:reminder:${Math.floor(now / 3_600_000)}`,
      `Halfshaft alert (still happening): ${condition.title}`,
      condition.detail,
    );
    result.reminded.push(condition.key);
  }

  const current = new Set(conditions.map((c) => c.key));
  for (const row of rows) {
    if (row.resolved_at || current.has(row.key)) continue;
    const closed = await db.run("UPDATE system_alerts SET resolved_at = now() WHERE key = $1 AND resolved_at IS NULL", [
      row.key,
    ]);
    if (!closed) continue;
    await queueAlert(`${row.key}:${row.occurrence}:resolved`, `Halfshaft resolved: ${row.title}`, "This has cleared by itself. Nothing more to do.");
    result.resolved.push(row.key);
  }

  return result;
}

// One text and one email per admin. Admins without a mobile get the email only (which is
// recorded but not sent until email is set up).
export async function queueAlert(key: string, headline: string, detail: string): Promise<number> {
  const admins = await db.query<{ id: number; email: string; alert_phone: string | null }>(
    "SELECT id, email, alert_phone FROM admins ORDER BY id",
  );
  const link = `${appUrl()}/admin/system`;
  let queued = 0;

  await transaction(async (tx) => {
    for (const admin of admins) {
      const mobile = admin.alert_phone ? normaliseAuMobile(admin.alert_phone) : null;
      if (mobile) {
        queued += await tx.run(
          `INSERT INTO sms_outbox (service_centre_id, notification_id, recipient, body, dedupe_key)
           VALUES (NULL, NULL, $1, $2, $3) ON CONFLICT (dedupe_key) DO NOTHING`,
          [mobile, `${headline}. ${detail}`.slice(0, 320), `alert:${key}:sms:${admin.id}`],
        );
      }
      await tx.run(
        `INSERT INTO email_outbox (service_centre_id, notification_id, audience, recipient, subject, text_body, dedupe_key)
         VALUES (NULL, NULL, 'workshop', $1, $2, $3, $4) ON CONFLICT (dedupe_key) DO NOTHING`,
        [admin.email, headline, `${detail}\n\nSee the system page: ${link}`, `alert:${key}:email:${admin.id}`],
      );
    }
  });
  return queued;
}

export type OpenAlert = { key: string; title: string; detail: string; opened_at: string };

export function listOpenAlerts(): Promise<OpenAlert[]> {
  return db.query<OpenAlert>(
    "SELECT key, title, detail, opened_at FROM system_alerts WHERE resolved_at IS NULL ORDER BY opened_at DESC",
  );
}

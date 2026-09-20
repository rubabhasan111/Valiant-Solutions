import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { appUrl } from "@/lib/stripe";

// A developer's view of the deployment itself: what's running, what it's connected to, and
// what's stuck. Nothing here is about a particular workshop.

export type CheckState = "ok" | "warn" | "bad";
export type Check = { label: string; state: CheckState; detail: string };

export type Deployment = {
  environment: string;
  commit: string | null;
  commitMessage: string | null;
  branch: string | null;
  region: string | null;
  url: string | null;
  appUrl: string;
  nodeVersion: string;
};

export function deploymentInfo(): Deployment {
  return {
    environment: process.env.VERCEL_ENV ?? "local",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    region: process.env.VERCEL_REGION ?? null,
    url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    appUrl: appUrl(),
    nodeVersion: process.version,
  };
}

// Names and shapes only: no secret value is ever read out of the environment.
export function configChecks(): Check[] {
  const has = (name: string) => Boolean(process.env[name]?.trim());
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  // Stripe keys carry their account in the characters after the prefix, so a mismatched
  // pair can be spotted without revealing either key.
  const accountOf = (key: string) => key.replace(/^(sk|pk)_(test|live)_/, "").slice(0, 14);
  const keysMatch = Boolean(secret && publishable && accountOf(secret) === accountOf(publishable));

  return [
    {
      label: "Stripe secret key",
      state: secret.startsWith("sk_test_") ? "ok" : secret.startsWith("sk_live_") ? "warn" : "bad",
      detail: secret.startsWith("sk_test_")
        ? "Test mode"
        : secret.startsWith("sk_live_")
          ? "LIVE mode: real money moves"
          : "Not set",
    },
    {
      label: "Stripe publishable key",
      state: !publishable ? "bad" : keysMatch ? "ok" : "bad",
      detail: !publishable
        ? "Not set"
        : keysMatch
          ? "Matches the secret key's account"
          : "Belongs to a different Stripe account, so the embedded panels won't load",
    },
    {
      label: "Stripe webhook secret",
      state: has("STRIPE_WEBHOOK_SECRET") ? "ok" : "warn",
      detail: has("STRIPE_WEBHOOK_SECRET") ? "Set" : "Not set: payment updates rely on the job instead",
    },
    {
      label: "Scheduler secret",
      state: has("CRON_SECRET") ? "ok" : "bad",
      detail: has("CRON_SECRET") ? "Set" : "Not set: the debit job can't be called",
    },
    {
      label: "Email sending",
      state: has("RESEND_API_KEY") && has("EMAIL_FROM") ? "ok" : "warn",
      detail: has("RESEND_API_KEY") && has("EMAIL_FROM") ? `From ${process.env.EMAIL_FROM}` : "Off: emails are recorded, not sent",
    },
    {
      label: "Text messages",
      state: has("CLICKSEND_USERNAME") && has("CLICKSEND_API_KEY") ? "ok" : "warn",
      detail: has("CLICKSEND_USERNAME") && has("CLICKSEND_API_KEY")
        ? `Sender ${process.env.SMS_SENDER?.trim() || "(ClickSend shared number)"}`
        : "Off: texts are recorded, not sent",
    },
    {
      label: "Public address",
      state: has("NEXT_PUBLIC_APP_URL") ? "ok" : "warn",
      detail: appUrl(),
    },
  ];
}

export type DatabaseInfo = {
  host: string;
  name: string;
  migration: number;
  latencyMs: number;
  sizeMb: number | null;
  tables: { name: string; rows: number }[];
};

export async function databaseInfo(): Promise<DatabaseInfo> {
  const started = Date.now();
  const meta = await db.one<{ name: string; version: number; size: number | null }>(
    `SELECT current_database() AS name,
            (SELECT COALESCE(MAX(version), 0) FROM schema_migrations) AS version,
            pg_database_size(current_database()) / 1024 / 1024 AS size`,
  );
  const latencyMs = Date.now() - started;

  const counted = ["service_centres", "users", "customers", "payment_plans", "instalments", "notifications", "email_outbox", "sms_outbox", "job_runs"];
  const counts = await db.one<Record<string, number>>(
    `SELECT ${counted.map((table) => `(SELECT COUNT(*) FROM ${table}) AS "${table}"`).join(", ")}`,
  );

  // Same order as lib/db.ts, and an empty variable counts as unset there too.
  const connectionString = [
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_POSTGRES_URL,
    process.env.POSTGRES_URL,
  ].find((value) => value && value.trim().length > 0);

  let host = "unknown";
  try {
    host = new URL(connectionString ?? "postgres://unknown").host;
  } catch {
    // An unparsable connection string still shouldn't break the page.
  }

  return {
    host,
    name: meta?.name ?? "unknown",
    migration: meta?.version ?? 0,
    latencyMs,
    sizeMb: meta?.size ?? null,
    tables: counted.map((name) => ({ name, rows: Number(counts?.[name] ?? 0) })),
  };
}

export type QueueInfo = {
  channel: "email" | "text";
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
  oldestPendingAt: string | null;
};

export async function queueInfo(): Promise<QueueInfo[]> {
  const shape = (table: string) => `
    SELECT COUNT(*) FILTER (WHERE status IN ('pending', 'sending')) AS pending,
           COUNT(*) FILTER (WHERE status = 'sent') AS sent,
           COUNT(*) FILTER (WHERE status = 'failed') AS failed,
           COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
           MIN(created_at) FILTER (WHERE status IN ('pending', 'sending')) AS "oldestPendingAt"
      FROM ${table}`;

  const [emails, texts] = await Promise.all([
    db.one<Omit<QueueInfo, "channel">>(shape("email_outbox")),
    db.one<Omit<QueueInfo, "channel">>(shape("sms_outbox")),
  ]);
  return [
    { channel: "email", ...emails! },
    { channel: "text", ...texts! },
  ];
}

export type StuckWork = {
  processingOverADay: number;
  failedInstalments: number;
  pausedPlans: number;
  draftPlansOverAWeek: number;
  failedMessages: { channel: string; recipient: string; error: string | null; created_at: string }[];
};

export async function stuckWork(): Promise<StuckWork> {
  const [counts, failedEmails, failedTexts] = await Promise.all([
    db.one<{ processing: number; failed: number; paused: number; stale_drafts: number }>(
      `SELECT
         (SELECT COUNT(*) FROM instalments WHERE status = 'processing' AND last_attempt_at < now() - interval '1 day') AS processing,
         (SELECT COUNT(*) FROM instalments WHERE status = 'failed') AS failed,
         (SELECT COUNT(*) FROM payment_plans WHERE status = 'failed') AS paused,
         (SELECT COUNT(*) FROM payment_plans WHERE status = 'draft' AND created_at < now() - interval '7 days') AS stale_drafts`,
    ),
    db.query<{ recipient: string; last_error: string | null; created_at: string }>(
      "SELECT recipient, last_error, created_at FROM email_outbox WHERE status = 'failed' ORDER BY id DESC LIMIT 5",
    ),
    db.query<{ recipient: string; last_error: string | null; created_at: string }>(
      "SELECT recipient, last_error, created_at FROM sms_outbox WHERE status = 'failed' ORDER BY id DESC LIMIT 5",
    ),
  ]);

  return {
    processingOverADay: counts?.processing ?? 0,
    failedInstalments: counts?.failed ?? 0,
    pausedPlans: counts?.paused ?? 0,
    draftPlansOverAWeek: counts?.stale_drafts ?? 0,
    failedMessages: [
      ...failedEmails.map((row) => ({ channel: "email", recipient: row.recipient, error: row.last_error, created_at: row.created_at })),
      ...failedTexts.map((row) => ({ channel: "text", recipient: row.recipient, error: row.last_error, created_at: row.created_at })),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}

// The events the app relies on. A live endpoint missing any of these means updates arrive
// only when the debit job next re-reads Stripe.
const REQUIRED_EVENTS = [
  "payment_intent.processing",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "mandate.updated",
  "checkout.session.completed",
  "account.updated",
];

export type StripeInfo = {
  reachable: boolean;
  error: string | null;
  connectedAccounts: number | null;
  webhook: { url: string; status: string; missingEvents: string[] } | null;
  otherWebhooks: number;
};

export async function stripeInfo(): Promise<StripeInfo> {
  try {
    const stripe = getStripe();
    const [accounts, endpoints] = await Promise.all([
      stripe.accounts.list({ limit: 100 }),
      stripe.webhookEndpoints.list({ limit: 100 }),
    ]);

    const ours = endpoints.data.find((endpoint) => endpoint.url === `${appUrl()}/api/webhooks/stripe`);
    return {
      reachable: true,
      error: null,
      connectedAccounts: accounts.data.length,
      webhook: ours
        ? {
            url: ours.url,
            status: ours.status,
            missingEvents: REQUIRED_EVENTS.filter((event) => !ours.enabled_events.includes(event) && !ours.enabled_events.includes("*")),
          }
        : null,
      otherWebhooks: endpoints.data.length - (ours ? 1 : 0),
    };
  } catch (err) {
    return {
      reachable: false,
      error: err instanceof Error ? err.message : String(err),
      connectedAccounts: null,
      webhook: null,
      otherWebhooks: 0,
    };
  }
}

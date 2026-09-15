// One-off: copies the data from the old SQLite database (data/app.db) into Postgres,
// keeping IDs, so existing workshops, logins, plans and customer links keep working.
// Refuses to run if Postgres already has workshops in it.
//
// Usage (from the project root, with the database running):
//   node scripts/import-sqlite.mjs [path/to/app.db]
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { closeDb, db, transaction } from "../lib/db.ts";

process.loadEnvFile(".env.local");

const sqlitePath = process.argv[2] ?? "data/app.db";
const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });

// SQLite stored "YYYY-MM-DD HH:MM:SS" in UTC.
const timestamp = (value) => (value ? `${value.replace(" ", "T")}Z` : null);
const flag = (value) => Boolean(value);
const same = (value) => value;

// Tables in foreign-key order, with how each column converts.
const TABLES = [
  ["service_centres", { id: same, name: same, email: same, phone: same, stripe_account_id: same, details_submitted: flag, charges_enabled: flag, payouts_enabled: flag, becs_capability: same, created_at: timestamp, updated_at: timestamp }],
  ["users", { id: same, name: same, email: same, password_hash: same, created_at: timestamp }],
  ["memberships", { user_id: same, service_centre_id: same, role: same, created_at: timestamp }],
  ["user_sessions", { token_hash: same, user_id: same, expires_at: timestamp, created_at: timestamp }],
  ["customers", { id: same, service_centre_id: same, full_name: same, email: same, phone: same, vehicle_rego: same, stripe_customer_id: same, created_at: timestamp }],
  ["payment_plans", { id: same, service_centre_id: same, customer_id: same, description: same, total_amount_cents: same, currency: same, instalment_count: same, frequency: same, start_date: same, status: same, stripe_payment_method_id: same, stripe_mandate_id: same, setup_token: (v) => v ?? randomBytes(24).toString("base64url"), checkout_session_id: same, activated_at: timestamp, failure_reason: same, created_at: timestamp }],
  ["instalments", { id: same, payment_plan_id: same, sequence: same, amount_cents: same, due_date: same, status: same, stripe_payment_intent_id: same, paid_at: timestamp, failure_reason: same, failure_code: same, attempt_count: same, last_attempt_at: timestamp, next_retry_on: same, created_at: timestamp }],
  ["stripe_events", { id: same, type: same, account: same, received_at: timestamp }],
  ["notifications", { id: same, service_centre_id: same, payment_plan_id: same, instalment_id: same, kind: same, title: same, body: same, dedupe_key: same, read_at: timestamp, created_at: timestamp }],
  ["email_outbox", { id: same, notification_id: same, audience: same, recipient: same, subject: same, text_body: same, status: same, attempts: same, last_error: same, sent_at: timestamp, dedupe_key: same, created_at: timestamp }],
];

const existing = await db.one("SELECT COUNT(*) AS n FROM service_centres");
if (existing.n > 0) {
  console.error("Postgres already has workshops in it, so nothing was imported.");
  await closeDb();
  process.exit(1);
}

const counts = {};
await transaction(async (tx) => {
  for (const [table, converters] of TABLES) {
    const sqliteColumns = new Set(sqlite.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    if (sqliteColumns.size === 0) continue;
    // Older databases may be missing columns added later; those take their defaults.
    const columns = Object.keys(converters).filter((c) => sqliteColumns.has(c) || c === "setup_token");
    const selectable = columns.filter((c) => sqliteColumns.has(c));

    const rows = sqlite.prepare(`SELECT ${selectable.join(", ")} FROM ${table}`).all();
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    for (const row of rows) {
      await tx.run(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
        columns.map((c) => converters[c](row[c] ?? null)),
      );
    }
    counts[table] = rows.length;

    if (Object.hasOwn(converters, "id") && table !== "stripe_events") {
      // New rows continue after the imported IDs.
      await tx.one(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`);
    }
  }

  await tx.run(
    `UPDATE email_outbox e SET service_centre_id = n.service_centre_id
       FROM notifications n
      WHERE n.id = e.notification_id AND e.service_centre_id IS NULL`,
  );
});
await closeDb();

for (const [table, count] of Object.entries(counts)) console.log(`${table}: ${count}`);
console.log("Imported. The SQLite file was left untouched.");

// Creates a Halfshaft admin login, or resets an existing admin's password. Prints a new
// random password once. Run it yourself against production (DATABASE_URL pointing at
// Neon) so the password only ever appears in your own terminal.
//
// Usage (from the project root):
//   node scripts/create-admin.mjs email=you@example.com name="Your Name"
import { randomBytes } from "node:crypto";
import { closeDb, transaction } from "../lib/db.ts";
import { hashPassword } from "../lib/auth/password.ts";

// A DATABASE_URL set in the shell (for example Neon's) wins over the local one in .env.local.
const shellDatabaseUrl = process.env.DATABASE_URL;
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local; DATABASE_URL must come from the shell.
}
if (shellDatabaseUrl) process.env.DATABASE_URL = shellDatabaseUrl;
console.log(`Database: ${new URL(process.env.DATABASE_URL).host}`);

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const i = arg.indexOf("=");
    return [arg.slice(0, i), arg.slice(i + 1)];
  }),
);
const email = args.email?.trim().toLowerCase();
const name = args.name?.trim();
if (!email || !name) {
  console.error('Usage: node scripts/create-admin.mjs email=you@example.com name="Your Name"');
  process.exit(1);
}

const password = randomBytes(15).toString("base64url");
const passwordHash = await hashPassword(password);

await transaction(async (tx) => {
  const admin = await tx.one(
    `INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [name, email, passwordHash],
  );
  // A password reset signs the admin out everywhere.
  await tx.run("DELETE FROM admin_sessions WHERE admin_id = $1", [admin.id]);
});
await closeDb();

console.log(`Admin login for ${name}: ${email}`);
console.log(`Password: ${password}`);
console.log("Sign in at /admin/login. This password isn't stored anywhere else.");

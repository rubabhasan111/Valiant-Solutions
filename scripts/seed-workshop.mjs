// Links an existing Stripe connected account to a service centre and gives it an
// owner login. Local test data only.
//
// Usage (from the project root):
//   node scripts/seed-workshop.mjs name="Smithfield Auto Care" account=acct_... \
//     email=owner@example.com owner="Sam Taylor" [password=...]
//
// Node strips the TypeScript types from the imported lib files at runtime.
import { randomBytes } from "node:crypto";
import { closeDb, transaction } from "../lib/db.ts";
import { hashPassword } from "../lib/auth/password.ts";

process.loadEnvFile(".env.local");

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const i = arg.indexOf("=");
    return [arg.slice(0, i), arg.slice(i + 1)];
  }),
);

const { name, account, owner } = args;
const email = args.email?.toLowerCase();
if (!name || !account || !email || !owner) {
  console.error('Usage: node scripts/seed-workshop.mjs name="..." account=acct_... email=... owner="..." [password=...]');
  process.exit(1);
}

const password = args.password ?? randomBytes(9).toString("base64url");
const passwordHash = await hashPassword(password);

await transaction(async (tx) => {
  let centre = await tx.one("SELECT id FROM service_centres WHERE stripe_account_id = $1", [account]);
  centre ??= await tx.one("INSERT INTO service_centres (name, email, stripe_account_id) VALUES ($1, $2, $3) RETURNING id", [
    name,
    email,
    account,
  ]);

  const user = await tx.one(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [owner, email, passwordHash],
  );

  await tx.run(
    "INSERT INTO memberships (user_id, service_centre_id, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING",
    [user.id, centre.id],
  );
});
await closeDb();

console.log(`${name} (${account})`);
console.log(`Owner login: ${email} / ${password}`);

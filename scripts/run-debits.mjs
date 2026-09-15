// Triggers one run of the scheduled debit job on a running server, the same way a
// production scheduler would.
//
// Usage (from the project root):
//   node scripts/run-debits.mjs               charge everything due today (Sydney time)
//   node scripts/run-debits.mjs as_of=2026-09-21   test mode: run as if it were that date
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);

if (!env.CRON_SECRET) {
  console.error("CRON_SECRET is missing from .env.local");
  process.exit(1);
}

const url = new URL("/api/cron/debits", env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
const asOf = process.argv.slice(2).find((arg) => arg.startsWith("as_of="));
if (asOf) url.searchParams.set("as_of", asOf.slice("as_of=".length));

const response = await fetch(url, {
  method: "POST",
  headers: { authorization: `Bearer ${env.CRON_SECRET}` },
});
console.log(response.status, JSON.stringify(await response.json(), null, 2));

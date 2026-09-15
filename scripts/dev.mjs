// `npm run dev`: starts the local Postgres database (unless DATABASE_URL points somewhere
// else, such as a Neon branch), then the Next.js dev server. Stopping one stops both.
import { spawn } from "node:child_process";
import { LOCAL_PORT, startLocalPostgres } from "./local-postgres.mjs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local; Next.js reports any missing variables itself.
}

const url = process.env.DATABASE_URL;
const usesLocalDatabase = url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname) && new URL(url).port === String(LOCAL_PORT);
if (!url) console.warn("DATABASE_URL isn't set in .env.local, so the app can't reach a database.");

const database = usesLocalDatabase ? await startLocalPostgres() : null;
if (database) console.log(`Local Postgres started on port ${LOCAL_PORT}.`);

const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
});

let stopping = false;
async function shutdown(code) {
  if (stopping) return;
  stopping = true;
  if (database) await database.stop().catch(() => {});
  process.exit(code);
}

next.on("exit", (code) => shutdown(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    next.kill(signal);
    shutdown(0);
  });
}

// A real Postgres server for local development, stored in data/postgres (gitignored).
// Production uses Neon; nothing here runs on Vercel.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

export const LOCAL_PORT = 54320;
const PASSWORD = "halfshaft-local";
export const LOCAL_DATABASE_URL = `postgres://postgres:${PASSWORD}@localhost:${LOCAL_PORT}/halfshaft`;

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

// Starts the server and creates the "halfshaft" database if needed. Returns null when a
// server is already listening on the port (for example, one started by `npm run db`).
export async function startLocalPostgres() {
  if (await portInUse(LOCAL_PORT)) return null;

  const databaseDir = path.join(process.cwd(), "data", "postgres");
  const server = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: PASSWORD,
    port: LOCAL_PORT,
    persistent: true,
    // Postgres logs everything to stderr; failures still surface as thrown errors.
    onLog: () => {},
    onError: () => {},
  });

  if (!fs.existsSync(path.join(databaseDir, "PG_VERSION"))) await server.initialise();

  try {
    await server.start();
  } catch (err) {
    // Nothing is listening on the port, so a leftover lock file is from a server that was
    // killed without shutting down. Remove it and try once more.
    const lockFile = path.join(databaseDir, "postmaster.pid");
    if (!fs.existsSync(lockFile)) throw err;
    fs.rmSync(lockFile);
    await server.start();
  }

  const client = server.getPgClient();
  await client.connect();
  const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = 'halfshaft'");
  if (!rowCount) await client.query("CREATE DATABASE halfshaft");
  await client.end();

  return server;
}

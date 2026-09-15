// Runs the local development database on its own, for scripts that need it while the
// dev server is stopped. `npm run dev` starts it automatically.
import { LOCAL_DATABASE_URL, LOCAL_PORT, startLocalPostgres } from "./local-postgres.mjs";

const server = await startLocalPostgres();
if (!server) {
  console.log(`Local Postgres is already running on port ${LOCAL_PORT}.`);
  process.exit(0);
}

console.log(`Local Postgres is running: ${LOCAL_DATABASE_URL}`);
console.log("Press Ctrl+C to stop it.");

const stop = async () => {
  await server.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

// Runs a real Postgres server locally (no Docker or install needed) for development.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';

const dataDir = new URL('../.local-pg', import.meta.url).pathname;
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: 5433, persistent: true });

if (!existsSync(dataDir)) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase('streakpot');
} catch {
  // already exists
}
try {
  await pg.createDatabase('streakpot_test');
} catch {
  // already exists
}
console.log('Postgres running on postgres://postgres:postgres@localhost:5433/streakpot (Ctrl+C to stop)');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

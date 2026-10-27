import { client, db, initializeDatabase } from './db.js';
import { createApp } from './app.js';
import { formatDatabaseError } from './db-error.js';
import { initializeWithRetry } from './database-startup.js';

let ready = false;
const shutdown = new AbortController();
const app = createApp(db, { isReady: () => ready });
const server = app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || '127.0.0.1',
  () => {
    console.log(
      `Workout API listening on http://${process.env.HOST || '127.0.0.1'}:${
        process.env.PORT || 3001
      }`
    );
  }
);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    shutdown.abort();
    ready = false;
    server.close(() => client.close().then(() => process.exit(0)));
  });
}
try {
  await initializeWithRetry(initializeDatabase, {
    signal: shutdown.signal,
    onRetry: (error, delay) => {
      console.error(
        `MongoDB unavailable; retrying startup in ${delay / 1000}s.`,
        formatDatabaseError(error)
      );
    },
  });
  if (!shutdown.signal.aborted) {
    ready = true;
    console.log('MongoDB connected; API ready.');
  }
} catch (error) {
  console.error(
    'Could not initialize MongoDB. Check MONGODB_URI / MONGODB_DB in api/.env and run npm run db:check.'
  );
  console.error(formatDatabaseError(error));
  server.close();
  await client.close();
  process.exitCode = 1;
}

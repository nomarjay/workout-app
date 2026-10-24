import { client, db, initializeDatabase } from './db.js';
import { createApp } from './app.js';
import { formatDatabaseError } from './db-error.js';

try {
  await initializeDatabase();
  const app = createApp(db);
  const server = app.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => {
    console.log(`Workout API listening on http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3001}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => client.close().then(() => process.exit(0))));
  }
} catch (error) {
  console.error('Could not initialize MongoDB. Check MONGODB_URI / MONGODB_DB in api/.env and run npm run db:check.');
  console.error(formatDatabaseError(error));
  await client.close();
  process.exitCode = 1;
}

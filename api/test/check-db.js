import { client, db, initializeDatabase } from '../src/db.js';
import { formatDatabaseError } from '../src/db-error.js';

try {
  await initializeDatabase();
  console.log(`Connected to MongoDB; database: ${db.databaseName}`);
  for (const name of ['catalog_exercises', 'catalog_equipment', 'workouts']) {
    console.log(`${name}: ${await db.collection(name).countDocuments()} records`);
  }
} catch (error) {
  console.error('Database initialization failed. Check MongoDB connectivity and collection indexes.');
  console.error(formatDatabaseError(error));
  process.exitCode = 1;
} finally {
  await client.close();
}



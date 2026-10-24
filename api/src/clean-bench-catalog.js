import { client, db } from './db.js';
import { formatDatabaseError } from './db-error.js';

try {
  const collection = db.collection('chestExercises');
  const records = await collection.find({}).toArray();
  let excluded = 0;
  for (const record of records) {
    const blank = !String(record.name ?? '').trim();
    if (blank) {
      await collection.updateOne({ _id: record._id }, { $set: {
        catalogExcluded: true, catalogExclusionReason: 'Unnamed exercise',
      } });
      excluded++;
    }
  }
  console.log(`Excluded ${excluded} unnamed records from the catalog. Original documents retained.`);
} catch (error) {
  console.error(formatDatabaseError(error));
  process.exitCode = 1;
} finally {
  await client.close();
}

import { mkdir, writeFile } from 'node:fs/promises';
import { client, db, initializeDatabase } from './db.js';
import { formatDatabaseError } from './db-error.js';

try {
  const names = ['equipment', 'attachments', 'muscle_groups'];
  const existing = (
    await db.listCollections({}, { nameOnly: true }).toArray()
  ).map((item) => item.name);
  const backup = {};
  for (const name of names.filter((name) => existing.includes(name))) {
    backup[name] = await db.collection(name).find({}).toArray();
  }
  // Write the backup before changing references or retiring collections.
  const directory = new URL('../backups/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const backupFile = new URL(`references-${Date.now()}.json`, directory);
  await writeFile(backupFile, JSON.stringify(backup, null, 2));
  await initializeDatabase();
  const documents = await db.collection('exercises').find({}).toArray();
  if (
    documents.some(
      (document) =>
        document.referenceSchemaVersion !== 1 ||
        document.equipmentOptions.some(
          (option) =>
            Object.hasOwn(option, 'equipment') ||
            Object.hasOwn(option, 'attachment')
        )
    )
  ) {
    throw new Error(
      'Reference migration validation failed; collections retained.'
    );
  }
  for (const name of names.filter((name) => existing.includes(name)))
    await db.collection(name).drop();
  console.log(
    `Migrated ${documents.length} exercises to code references; retired equipment, attachments, and muscle_groups collections.`
  );
  console.log(`Backup: ${backupFile.pathname}`);
} catch (error) {
  console.error(formatDatabaseError(error));
  process.exitCode = 1;
} finally {
  await client.close();
}

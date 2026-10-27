import assert from 'node:assert/strict';
import { client, db, initializeDatabase } from './db.js';
import { createApp } from './app.js';
import { formatDatabaseError } from './db-error.js';
let server;
try {
  await initializeDatabase();
  const before = await db.collection('exercises').countDocuments();
  await initializeDatabase();
  assert.equal(await db.collection('exercises').countDocuments(), before);
  server = createApp(db).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/catalog`
  );
  assert.equal(response.status, 200);
  const catalog = await response.json();
  const benches = catalog.exerciseDefinitions.filter(
    (item) => item.name === 'Bench Press'
  );
  assert.equal(benches.length, 1);
  assert.deepEqual(
    benches[0].equipmentOptions.map((option) => option.equipmentId),
    [5]
  );
  assert.ok(
    benches[0].equipmentOptions.every(
      (option) => !Object.hasOwn(option, 'equipment')
    )
  );
  const collections = (
    await db.listCollections({}, { nameOnly: true }).toArray()
  ).map((item) => item.name);
  assert.ok(
    !['equipment', 'attachments', 'muscle_groups'].some((name) =>
      collections.includes(name)
    )
  );
  assert.ok(
    !catalog.exercises.some((item) =>
      ['Bodyweight', 'Unknown equipment'].includes(item.equipment)
    )
  );
  assert.ok(catalog.equipment.every((item) => !item.exercises));
  console.log(
    `Verified ${catalog.exerciseDefinitions.length} movements, ${catalog.exercises.length} equipment options, ${catalog.equipment.length} equipment categories.`
  );
  console.log(
    'Bench Press options verified; repeated startup adds no duplicate documents.'
  );
} catch (error) {
  console.error(formatDatabaseError(error));
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await client.close();
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { memoryDb } from './helpers/memory-db.js';

test('bulk deletion removes only selected unused exercises and reports protected and missing records', async () => {
  const db = memoryDb();
  for (const id of ['unused-a', 'unused-b', 'protected', 'leave-alone'])
    db.records.catalog_exercises.push({
      _id: id,
      name: id,
      muscleGroupId: 1,
      equipmentOptions: [
        {
          key: 'smith',
          equipmentId: 5,
          primaryMuscles: ['Chest'],
          secondaryMuscles: [],
          attachmentId: null,
          isIsolation: false,
        },
      ],
    });
  const workout = {
    name: 'Keep my saved workout',
    exercises: [{ exerciseId: 'protected', equipmentId: 5 }],
  };
  await db.collection('workouts').insertOne(workout);
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const remove = (body) =>
    fetch(`${base}/exercises/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    const response = await remove({
      ids: ['unused-a', 'unused-b', 'protected', 'already-gone', 'unused-a'],
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(result.deletedIds.sort(), ['unused-a', 'unused-b']);
    assert.deepEqual(result.blocked, [
      {
        id: 'protected',
        name: 'protected',
        reason: 'Used in a saved workout.',
      },
    ]);
    assert.deepEqual(result.missingIds, ['already-gone']);
    assert.ok(
      db.records.catalog_exercises.some((item) => item._id === 'protected')
    );
    assert.ok(
      db.records.catalog_exercises.some((item) => item._id === 'leave-alone')
    );
    assert.equal(db.records.workouts.length, 1);
    assert.equal(db.records.workouts[0].exercises[0].exerciseId, 'protected');
    const catalog = await (await fetch(`${base}/catalog`)).json();
    assert.ok(
      !catalog.exerciseDefinitions.some((item) =>
        result.deletedIds.includes(item.id)
      )
    );
    const again = await (
      await remove({ ids: ['unused-a', 'protected'] })
    ).json();
    assert.deepEqual(again.deletedIds, []);
    assert.equal(again.blocked.length, 1);
    assert.deepEqual(again.missingIds, ['unused-a']);
    const single = await (await remove({ ids: ['leave-alone'] })).json();
    assert.deepEqual(single.deletedIds, ['leave-alone']);
    const remaining = db.records.catalog_exercises.length;
    for (const body of [
      {},
      { ids: [] },
      { ids: 'protected' },
      { ids: [null] },
      { ids: [''] },
      { ids: Array(501).fill('protected') },
    ]) {
      assert.equal((await remove(body)).status, 400);
    }
    assert.equal(db.records.catalog_exercises.length, remaining);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

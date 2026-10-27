import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { createApp } from '../src/app.js';
import { memoryDb } from './helpers/memory-db.js';

test('editing preserves identity and metadata while validating and replacing selections', async () => {
  const id = new ObjectId();
  let record = {
    _id: id,
    name: 'Original',
    exercises: [],
    createdAt: '2020-01-01',
    templateKey: 'starter',
  };
  const db = memoryDb();
  db.records.workouts.push(record);
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const catalog = await (await fetch(`${base}/api/catalog`)).json();
    const bench = catalog.exerciseDefinitions.find(
      (item) => item.name === 'Seated Chest Press'
    );
    const selections = ['1', '3', '1'].map((equipmentOptionKey) => ({
      exerciseId: bench.id,
      equipmentOptionKey,
      attachment: null,
    }));
    const put = (target, body) =>
      fetch(`${base}/api/workouts/${target}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await put('invalid', { name: 'Edited', selections })).status,
      400
    );
    assert.equal((await put(id, { name: ' ', selections })).status, 400);
    assert.equal(
      (await put(id, { name: 'Edited', selections: [] })).status,
      400
    );
    assert.equal(
      (
        await put(id, {
          name: 'Edited',
          selections: [{ exerciseId: bench.id, equipmentOptionKey: 'missing' }],
        })
      ).status,
      400
    );
    assert.equal(
      (
        await put(id, {
          name: 'Edited',
          selections: [
            {
              exerciseId: bench.id,
              equipmentOptionKey: '3',
              attachment: 'Dual Rope',
            },
          ],
        })
      ).status,
      400
    );
    assert.equal(record.name, 'Original');
    assert.equal(
      (await put(new ObjectId(), { name: 'Edited', selections })).status,
      404
    );
    const response = await put(id, { name: ' Edited ', selections });
    assert.equal(response.status, 200);
    const edited = await response.json();
    assert.equal(edited.id, String(id));
    assert.equal(edited.name, 'Edited');
    assert.equal(edited.createdAt, '2020-01-01');
    assert.equal(edited.templateKey, 'starter');
    assert.ok(edited.updatedAt);
    assert.deepEqual(
      edited.exercises.map((item) => item.equipmentOptionKey),
      ['1', '3', '1']
    );
    assert.deepEqual(
      edited.exercises.map((item) => item.attachment),
      [null, null, null]
    );
    assert.deepEqual(
      db.records.workouts[0].exercises.map((item) => item.equipmentId),
      [1, 3, 1]
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExerciseDocuments, exerciseCollections, toReferenceDocument } from '../data/catalog.js';
import { createApp } from '../src/app.js';
import { memoryDb } from './helpers/memory-db.js';

test('one movement holds equipment options without merging incline or seated presses', () => {
  const docs = buildExerciseDocuments(Object.values(exerciseCollections).flat());
  const bench = docs.find(item => item.name === 'Bench Press');
  assert.deepEqual(bench.equipmentOptions.map(item => item.equipment), ['Smith Machine']);
  assert.ok(docs.some(item => item.name === 'Incline Bench Press'));
  assert.ok(docs.some(item => item.name === 'Seated Chest Press'));
  assert.equal(new Set(docs.map(item => item.slug)).size, docs.length);
  assert.ok(!docs.some(item => item.equipmentOptions.some(option => option.equipment === 'Bodyweight')));
});

test('API validates the equipment option and saves its snapshot', async () => {
  const db = memoryDb();
  const saved = db.records.workouts;
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const catalog = await (await fetch(`${url}/api/catalog`)).json();
    const bench = catalog.exerciseDefinitions.find(item => item.name === 'Bench Press');
    const post = option => fetch(`${url}/api/workouts`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bench day', selections: [{ exerciseId: bench.id, equipmentOptionKey: option }] }) });
    assert.equal((await post('not-an-option')).status, 400);
    assert.equal((await post('5')).status, 201);
    assert.equal(saved[0].exercises[0].equipmentId, 5);
    assert.equal(saved[0].exercises[0].equipment, undefined);
    assert.equal(saved[0].exercises[0].exerciseId, bench.id);
    assert.equal(saved[0].exercises[0].equipmentOptions, undefined);
    bench.equipmentOptions[0].equipment = 'Changed';
    assert.equal(saved[0].exercises[0].equipmentId, 5);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('references store IDs and reject missing equipment and attachments', () => {
  const document = toReferenceDocument(buildExerciseDocuments(Object.values(exerciseCollections).flat())[0]);
  for (const option of document.equipmentOptions) {
    assert.equal(typeof option.equipmentId, 'number');
    assert.equal(Object.hasOwn(option, 'equipment'), false);
    assert.equal(Object.hasOwn(option, 'attachment'), false);
  }
  assert.throws(() => toReferenceDocument({ name: 'Custom', muscleGroupId: 1,
    equipmentOptions: [{ equipment: 'Missing machine' }] }), /reference list/);
  assert.throws(() => toReferenceDocument({ name: 'Custom', muscleGroupId: 1,
    equipmentOptions: [{ equipmentId: 1, attachment: 'Missing attachment' }] }), /Unknown attachment/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { createApp } from '../src/app.js';
import { exerciseCollections, equipment, normalizeExercise, buildExerciseDocuments, expandExerciseDocuments } from '../data/catalog.js';
import { muscleGroups } from '../data/muscle-groups.js';
import { memoryDb } from './helpers/memory-db.js';

test('equipment types replace machine names', () => {
  for (const machine of equipment) {
    assert.equal(Object.hasOwn(machine, 'name'), false);
    assert.equal(machine.category, 'Machines');
  }
  assert.equal(normalizeExercise({ name: 'Seated Row', 'equipment-type': 'Pin Cable Machine' }).equipmentId, 4);
});

test('catalog links equipment and all contributing muscle groups; pin attachments are null', () => {
  for (const exercise of Object.values(exerciseCollections).flat()) {
    assert.ok(equipment.some(item => item.id === exercise.equipmentId));
    assert.ok(exercise.muscleGroupIds.includes(exercise.muscleGroupId));
    assert.ok(exercise.muscleGroupIds.every(id => muscleGroups.some(group => group.id === id)));
    assert.ok(exercise.primaryMuscles.length);
    assert.equal(exercise['equipment-type'], equipment.find(item => item.id === exercise.equipmentId)['equipment-type']);
    if (exercise.equipmentId === 4) assert.equal(exercise.attachment, null);
  }
  const bench = normalizeExercise({ name: 'Smith Machine Bench Press', equipment: 'Smith Machine ', muscleGroupId: 1 });
  assert.deepEqual(bench.muscleGroupIds, [1, 3, 6]);
});

test('workout API validates selections and persists their order and repeated exercises', async () => {
  const db = memoryDb();
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/workouts`;
    const post = body => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post({ name: '  ', exerciseIds: [] })).status, 400);
    assert.equal((await post({ name: 'Push', exerciseIds: ['missing'] })).status, 400);
    const catalog = await (await fetch(url.replace('/workouts', '/catalog'))).json();
    const ids = [catalog.exercises.find(item => item.muscleGroupId === 1 && item.equipmentId === 5),
      catalog.exercises.find(item => item.muscleGroupId === 1 && item.equipmentId === 1)].map(item => item.id);
    const response = await post({ name: ' Push day ', exerciseIds: [ids[1], ids[0], ids[1]] });
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.equal(saved.name, 'Push day');
    assert.equal(saved.exercises[0]['equipment-type'], 'Selectorized Cable Machine');
    assert.deepEqual(saved.exercises.map(item => item.id), [ids[1], ids[0], ids[1]]);
    assert.equal((await (await fetch(url)).json()).length, 1);
    assert.equal((await post({ name: 'Invalid attachment', selections: [{ exerciseId: ids[1], attachment: 'Not real' }] })).status, 400);
    assert.equal((await post({ name: 'Wrong equipment', selections: [{ exerciseId: ids[0], attachment: 'Dual Rope' }] })).status, 400);
    const attachmentResponse = await post({ name: 'Cable workout', selections: [{ exerciseId: ids[1], attachment: 'Dual Rope' }, { exerciseId: ids[1], attachment: null }] });
    assert.equal(attachmentResponse.status, 201);
    const attached = await attachmentResponse.json();
    assert.deepEqual(attached.exercises.map(item => item.attachment), ['Dual Rope', null]);
    const persisted = await (await fetch(url)).json();
    assert.equal(persisted.find(item => item.id === attached.id).exercises[0].attachment, 'Dual Rope');
    assert.equal((await fetch(`${url}/invalid`, { method: 'DELETE' })).status, 400);
    assert.equal((await fetch(`${url}/${saved.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(`${url}/${saved.id}`, { method: 'DELETE' })).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('selectorized isolation is an exercise flag and legacy equipment resolves safely', () => {
  assert.equal(equipment.some(item => item.id === 2), false);
  for (const reference of [
    { equipmentId: '1' }, { equipmentId: 2 },
    { equipment: '  SELECTORIZED   CABLE MACHINE ' },
    { equipment: 'Selectorized Isolation Cable Machine' },
    { equipment: { id: '1', name: 'Selectorized' } },
    { equipment: 'Selectorized Machines' },
  ]) {
    const curl = normalizeExercise({ ...reference, name: 'Seated Preacher Curl' });
    assert.equal(curl.equipmentId, 1);
    assert.equal(curl.isIsolation, true);
    assert.deepEqual(curl.primaryMuscles, ['Biceps']);
  }
  assert.equal(normalizeExercise({ name: 'Seated Lat Pulldown', equipmentId: '2' }).isIsolation, false);
  assert.equal(normalizeExercise({ name: 'Seated Preacher Curl', equipmentId: 1, isIsolation: false }).isIsolation, false);
  const unknown = normalizeExercise({ name: 'Custom curl', equipment: 'Custom Machine' });
  assert.equal(unknown.equipment, 'Custom Machine');
  assert.equal(unknown.equipmentResolved, false);
  assert.equal(unknown.equipmentId, null);
  for (const records of Object.values(exerciseCollections)) {
    const identities = records.map(record => `${record.name}:${record.equipmentId}`);
    assert.equal(new Set(identities).size, identities.length);
  }
});




import { groupExerciseVariants } from '../../ui/src/utils/exerciseVariants.js';
test('exercise grouping combines equipment qualifiers and preserves distinct movements', () => {
  const groups = groupExerciseVariants([
    { id: '1', name: 'Seated Preacher Curl' },
    { id: '2', name: 'Plate Loaded Preacher Curl' },
    { id: '3', name: 'Selectorized Isolation Preacher Curl' },
    { id: '4', name: 'Incline Chest Press' },
    { id: '5', name: 'Chest Press' },
  ]);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].name, 'Preacher Curl');
  assert.deepEqual(groups[0].variants.map(item => item.id), ['1', '2', '3']);
});


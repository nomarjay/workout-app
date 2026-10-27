import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { memoryDb } from './helpers/memory-db.js';
import { belongsToPrimaryGroup, primaryGroupIds } from '../../ui/src/utils/muscleGroups.js';
import { muscleGroups } from '../data/muscle-groups.js';

test('exactly one primary muscle is required and determines the group instead of a submitted dropdown value', async () => {
  const db = memoryDb();
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (path, method = 'GET', body) => fetch(`${base}/${path}`, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const option = { key: 'smith', equipmentId: '5', attachmentId: null, primaryMuscles: ['Upper Chest'], secondaryMuscles: ['Biceps', 'Front Delts'], isIsolation: false };
  const body = { name: 'Primary-driven incline press', equipmentOptions: [option] };
  try {
    for (const primaryMuscles of [[], ['Chest', 'Upper Chest'], ['Unrecognized muscle'], null, [' ']]) {
      const response = await request('exercises', 'POST', { ...body, muscleGroupId: 1, equipmentOptions: [{ ...option, primaryMuscles }] });
      assert.equal(response.status, 400, JSON.stringify(primaryMuscles));
    }
    const created = await request('exercises', 'POST', { ...body, muscleGroupId: 999 });
    assert.equal(created.status, 201);
    const exercise = await created.json();
    assert.equal(exercise.muscleGroupId, 1);
    assert.deepEqual(exercise.primaryMuscleGroupIds, [1]);
    assert.deepEqual(exercise.muscleGroupIds, [1]);
    assert.deepEqual(exercise.equipmentOptions[0].primaryMuscles, ['Upper Chest']);
    let catalog = await (await request('catalog')).json();
    let expanded = catalog.exercises.find(item => item.exerciseId === exercise.id);
    assert.equal(belongsToPrimaryGroup(expanded, 1), true);
    assert.equal(belongsToPrimaryGroup(expanded, 3), false, 'Secondary biceps do not classify this exercise as Arms');
    assert.equal(belongsToPrimaryGroup(expanded, 6), false, 'Secondary delts do not classify it as Shoulders');
    db.records.catalog_exercises.find(item => item._id === exercise.id).muscleGroupId = 3;
    catalog = await (await request('catalog')).json();
    expanded = catalog.exercises.find(item => item.exerciseId === exercise.id);
    assert.equal(expanded.muscleGroupId, 1, 'Legacy group values do not override the primary muscle');
    const updated = await request(`exercises/${exercise.id}`, 'PUT', { ...body, equipmentOptions: [{ ...option, primaryMuscles: ['Biceps'] }] });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).muscleGroupId, 3);
    const wholeChest = await request(`exercises/${exercise.id}`, 'PUT', { ...body, equipmentOptions: [{ ...option, primaryMuscles: ['Chest'] }] });
    assert.equal(wholeChest.status, 200);
    assert.equal((await wholeChest.json()).muscleGroupId, 1);
    const missingOnOtherEquipment = await request('exercises', 'POST', { ...body, equipmentOptions: [option, { ...option, key: 'plate', equipmentId: '3', primaryMuscles: [] }] });
    assert.equal(missingOnOtherEquipment.status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('primary subdivisions and existing anatomical labels resolve to their parent group', () => {
  for (const [name, id] of [['Chest', 1], ['Upper Chest', 1], ['Lower Chest', 1], ['Pectoralis Major', 1], ['Latissimus Dorsi', 2], ['Biceps', 3], ['Quads', 4], ['Upper Abs', 5], ['Front Delts', 6]]) assert.deepEqual(primaryGroupIds([name], muscleGroups), [id], name);
});

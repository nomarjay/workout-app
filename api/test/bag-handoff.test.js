import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { memoryDb } from './helpers/memory-db.js';
import { persistRoutine, routineSaveDestination } from '../../ui/src/utils/routineSave.js';

test('saving the exercise bag persists its name, ordering, repeated movements, equipment and attachments', async () => {
  const db = memoryDb();
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, options) => {
    const response = await fetch(base + path, options);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    return body;
  };
  try {
    const catalog = await request('/api/catalog');
    const cable = { ...catalog.exercises.find(item => Number(item.equipmentId) === 4), attachment: 'Dual Rope' };
    const smith = { ...catalog.exercises.find(item => Number(item.equipmentId) === 5), attachment: null };
    const draft = [cable, smith, { ...cable }];
    const before = JSON.stringify(draft);
    const saved = await persistRoutine(request, { name: '  My exercise bag  ', draft });
    assert.equal(saved.name, 'My exercise bag');
    assert.deepEqual(saved.exercises.map(item => Number(item.equipmentId)), [4, 5, 4]);
    assert.deepEqual(saved.exercises.map(item => item.attachment), ['Dual Rope', null, 'Dual Rope']);
    assert.equal(JSON.stringify(draft), before);
    const stored = (await request('/api/workouts')).find(item => item.id === saved.id);
    assert.equal(stored.exercises.length, 3);
    const updated = await persistRoutine(request, { name: 'Edited routine', draft: [smith, cable], editingId: saved.id });
    assert.equal(updated.id, saved.id);
    assert.equal((await request('/api/workouts')).length, 1, 'Continuing an edit updates rather than duplicates the routine');
    await assert.rejects(persistRoutine(request, { name: 'Missing exercise', draft: [{ exerciseId: 'missing', equipmentOptionKey: '4' }] }));
    assert.equal(JSON.stringify(draft), before, 'Failed saves do not clear or mutate the bag');
    await assert.rejects(persistRoutine(request, { name: ' ', draft }), /workout name/);
    await assert.rejects(persistRoutine(request, { name: 'Empty', draft: [] }), /1–100/);
    assert.equal(routineSaveDestination({ fromExercises: true, returnToPlanner: true }), 'workouts', 'Direct bag saving always opens Workouts for additional details');
    assert.equal(routineSaveDestination({ fromExercises: true, isEditing: true }), 'workouts');
    assert.equal(routineSaveDestination({ returnToPlanner: true }), 'dashboard', 'The existing planner flow remains available');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

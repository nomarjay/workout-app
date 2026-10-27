import test from 'node:test';
import assert from 'node:assert/strict';
import { updateDraftExercise, removeDraftSelections, deleteWorkoutBatch } from '../../ui/src/utils/workoutEditing.js';
import { persistRoutine } from '../../ui/src/utils/routineSave.js';
import { createApp } from '../src/app.js';
import { memoryDb } from './helpers/memory-db.js';

test('routine edits preserve occurrence identity, validate equipment and clear incompatible attachments', () => {
  const cable = { id: 'row:4', exerciseId: 'row', name: 'Row', equipmentId: 4, equipment: 'Multifunctional Cable Machine', attachmentIds: [12], attachment: null };
  const plate = { ...cable, id: 'row:3', equipmentId: 3, equipment: 'Plate Loaded Machine', attachmentIds: [] };
  const curl = { ...plate, id: 'curl:3', exerciseId: 'curl', name: 'Curl' };
  const catalog = { exercises: [cable, plate, curl], attachments: [{ id: 12, name: 'Dual Rope' }] };
  const draft = [{ ...cable, selectionId: 'first', attachment: 'Dual Rope' }, { ...cable, selectionId: 'repeat', attachment: 'Dual Rope' }];
  const switched = updateDraftExercise(draft, 'first', { variantId: plate.id }, catalog);
  assert.equal(switched[0].selectionId, 'first');
  assert.equal(switched[0].equipmentId, 3);
  assert.equal(switched[0].attachment, null);
  assert.equal(switched[1], draft[1]);
  assert.equal(draft[0].equipmentId, 4, 'Edits do not mutate the saved snapshot or shared exercise');
  const replaced = updateDraftExercise(switched, 'first', { exerciseId: 'curl' }, catalog);
  assert.equal(replaced[0].name, 'Curl');
  assert.equal(replaced[0].selectionId, 'first');
  const attached = updateDraftExercise(draft, 'repeat', { attachment: 'Dual Rope' }, catalog);
  assert.equal(attached[1].attachment, 'Dual Rope');
  assert.throws(() => updateDraftExercise(switched, 'first', { attachment: 'Dual Rope' }, catalog), /supported/);
  assert.throws(() => updateDraftExercise(draft, 'first', { variantId: curl.id }, catalog), /available/);
  const removed = removeDraftSelections(draft, ['first']);
  assert.deepEqual(removed.map(item => item.selectionId), ['repeat'], 'Bulk row removal targets occurrences, not every instance of a movement');
  assert.deepEqual(removeDraftSelections(draft, ['first', 'repeat']), []);
});

test('edited routine saves under the same ID and bulk routine deletion uses the normal cleanup path', async () => {
  const db = memoryDb();
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, options) => {
    const response = await fetch(base + path, options);
    const body = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(body.error);
    return body;
  };
  try {
    const catalog = await request('/api/catalog');
    const row = catalog.exercises.find(item => item.name === 'Seated Row' && Number(item.equipmentId) === 4);
    const plate = catalog.exercises.find(item => item.exerciseId === row.exerciseId && Number(item.equipmentId) === 3);
    let draft = [{ ...row, selectionId: 'one', attachment: 'Dual Rope' }, { ...row, selectionId: 'two', attachment: null }];
    const saved = await persistRoutine(request, { name: 'Before edit', draft });
    draft = updateDraftExercise(draft, 'one', { variantId: plate.id }, catalog);
    draft = removeDraftSelections(draft, ['two']);
    const updated = await persistRoutine(request, { name: 'After edit', draft, editingId: saved.id });
    assert.equal(updated.id, saved.id);
    assert.equal(updated.createdAt, saved.createdAt);
    assert.equal(updated.name, 'After edit');
    assert.equal(updated.exercises.length, 1);
    assert.equal(Number(updated.exercises[0].equipmentId), 3);
    assert.equal(updated.exercises[0].attachment, null);
    const another = await persistRoutine(request, { name: 'Other routine', draft });
    await db.collection('workout_schedule').insertOne({ workoutId: saved.id, date: '2026-10-25' });
    await db.collection('trainer_mode').insertOne({ _id: saved.id, note: 'Training details' });
    const removed = await deleteWorkoutBatch([saved.id, another.id], id => request(`/api/workouts/${id}`, { method: 'DELETE' }));
    assert.equal(removed.deletedIds.length, 2);
    assert.deepEqual(removed.failed, []);
    assert.equal(db.records.workouts.length, 0);
    assert.equal(db.records.workout_schedule.length, 0);
    assert.equal(db.records.trainer_mode.length, 0);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('bulk routine deletion reports individual failures and continues with remaining routines', async () => {
  const calls = [];
  const result = await deleteWorkoutBatch(['one', 'bad', 'two', 'one'], async id => { calls.push(id); if (id === 'bad') throw new Error('Could not delete'); });
  assert.deepEqual(calls, ['one', 'bad', 'two']);
  assert.deepEqual(result.deletedIds, ['one', 'two']);
  assert.deepEqual(result.failed, [{ id: 'bad', reason: 'Could not delete' }]);
});

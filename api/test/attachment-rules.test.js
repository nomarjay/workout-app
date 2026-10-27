import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { memoryDb } from './helpers/memory-db.js';
import {
  supportsAttachments,
  attachmentIdsFor,
} from '../../ui/src/utils/equipment.js';

test('only Multifunctional Cable Machines offer attachments across catalog, workouts, and completion', async () => {
  const db = memoryDb();
  // Simulate records created under the old, incorrect selectorized attachment rule.
  db.records.catalog_equipment.find((item) => item._id === '1').attachmentIds =
    [12];
  const fixedDefinition = db.records.catalog_exercises.find((item) =>
    item.equipmentOptions.some((option) => Number(option.equipmentId) === 1)
  );
  fixedDefinition.equipmentOptions.find(
    (option) => Number(option.equipmentId) === 1
  ).attachmentId = 12;
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (path, method = 'GET', body) =>
    fetch(`${base}/${path}`, {
      method,
      ...(body
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
    });
  try {
    const catalog = await (await request('catalog')).json();
    assert.equal(catalog.machineTypes, undefined);
    const fixed = catalog.equipment.find((item) => item.id === '1');
    const multi = catalog.equipment.find((item) => item.id === '4');
    assert.deepEqual(fixed.attachmentIds, []);
    assert.ok(multi.attachmentIds.includes(12));
    for (const item of catalog.equipment.filter((item) => item.id !== '4'))
      assert.deepEqual(item.attachmentIds, []);
    const fixedExercise = catalog.exercises.find(
      (item) =>
        item.exerciseId === fixedDefinition._id &&
        Number(item.equipmentId) === 1
    );
    const multiExercise = catalog.exercises.find(
      (item) => Number(item.equipmentId) === 4
    );
    assert.equal(fixedExercise.attachmentId, null);
    assert.equal(fixedExercise.attachment, null);
    const fixedOption = catalog.exerciseDefinitions
      .find((item) => item.id === fixedDefinition._id)
      .equipmentOptions.find((item) => Number(item.equipmentId) === 1);
    assert.equal(fixedOption.attachmentId, null);
    const choice = (exercise) => ({
      exerciseId: exercise.exerciseId,
      equipmentOptionKey: exercise.equipmentOptionKey,
      attachment: 'Dual Rope',
    });
    assert.equal(
      (
        await request('workouts', 'POST', {
          name: 'Invalid fixed attachment',
          selections: [choice(fixedExercise)],
        })
      ).status,
      400
    );
    const savedResponse = await request('workouts', 'POST', {
      name: 'Cable workout',
      selections: [choice(multiExercise)],
    });
    assert.equal(savedResponse.status, 201);
    const saved = await savedResponse.json();
    assert.equal(saved.exercises[0].attachment, 'Dual Rope');
    const completion = {
      workoutId: saved.id,
      scheduledDate: '2026-10-25',
      selections: [choice(fixedExercise)],
    };
    assert.equal(
      (await request('workout-logs', 'POST', completion)).status,
      400
    );
    assert.equal(
      (
        await request('workout-logs', 'POST', {
          ...completion,
          selections: [choice(multiExercise)],
        })
      ).status,
      201
    );
    const equipment = {
      'equipment-type': 'Selectorized Cable Machine',
      category: 'Machines',
      attachmentIds: [12],
    };
    assert.equal((await request('equipment', 'POST', equipment)).status, 400);
    assert.equal(
      (
        await request('equipment', 'POST', {
          ...equipment,
          'equipment-type': 'Multifunctional Cable Machine',
        })
      ).status,
      201
    );
    const definition = {
      name: 'Unsupported attachment',
      muscleGroupId: 1,
      equipmentOptions: [
        {
          key: 'fixed',
          equipmentId: '1',
          attachmentId: 12,
          primaryMuscles: ['Chest'],
          secondaryMuscles: [],
          isIsolation: false,
        },
      ],
    };
    assert.equal((await request('exercises', 'POST', definition)).status, 400);
    const raw = db.records.workouts.find(
      (item) => String(item._id) === saved.id
    );
    raw.exercises[0] = {
      ...raw.exercises[0],
      equipmentId: 1,
      attachmentId: 12,
    };
    const historical = (await (await request('workouts')).json()).find(
      (item) => item.id === saved.id
    );
    assert.equal(historical.exercises[0].attachment, null);
    assert.equal(historical.exercises[0].attachmentId, null);
    assert.equal(
      raw.exercises[0].attachmentId,
      12,
      'Reading old workouts does not rewrite their stored history'
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('attachment capability uses existing equipment IDs and labels rather than a machineType field', () => {
  for (const equipment of [
    { equipmentId: 4 },
    { id: 'custom', 'equipment-type': 'Multi functional cable machine' },
    { equipment: 'Multifunctional Cable Machine' },
    { equipment: 'Pin Cable Machine' },
  ])
    assert.equal(supportsAttachments(equipment), true);
  for (const equipment of [
    { equipmentId: 1 },
    { equipment: 'Selectorized Cable Machine', attachmentIds: [12] },
    { equipment: 'Plate Loaded Machine' },
    { equipment: 'Smith Machine' },
    {
      equipment: 'Generic cable',
      machineType: 'Multifunctional Cable Machine',
    },
  ]) {
    assert.equal(supportsAttachments(equipment), false);
    assert.deepEqual(attachmentIdsFor(equipment), []);
  }
});

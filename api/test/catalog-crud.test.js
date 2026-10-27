import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { initializeDatabase } from '../src/db.js';
import { memoryDb } from './helpers/memory-db.js';

test('catalog CRUD persists changes, validates references, and protects saved workouts', async () => {
  const db = memoryDb();
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
    const equipmentBody = {
      'equipment-type': ' Custom Multifunctional Cable Machine ',
      category: 'Machines',
      attachmentIds: [12],
    };
    assert.equal(
      (
        await request('equipment', 'POST', {
          ...equipmentBody,
          attachmentIds: [999],
        })
      ).status,
      400
    );
    assert.equal(
      (
        await request('equipment', 'POST', {
          ...equipmentBody,
          'equipment-type': '',
        })
      ).status,
      400
    );
    assert.equal(
      (
        await request('equipment', 'POST', {
          ...equipmentBody,
          image: 'javascript:alert(1)',
        })
      ).status,
      400
    );
    const createEquipment = await request('equipment', 'POST', equipmentBody);
    assert.equal(createEquipment.status, 201);
    const machine = await createEquipment.json();
    assert.equal(
      machine['equipment-type'],
      'Custom Multifunctional Cable Machine'
    );
    assert.equal(
      (await (await request(`equipment/${machine.id}`)).json()).id,
      machine.id
    );
    const exerciseBody = {
      name: 'Custom pull',
      muscleGroupId: 2,
      equipmentOptions: [
        {
          key: 'cable',
          equipmentId: machine.id,
          attachmentId: 12,
          primaryMuscles: ['Latissimus Dorsi'],
          secondaryMuscles: ['Biceps'],
          isIsolation: false,
        },
      ],
    };
    assert.equal(
      (
        await request('exercises', 'POST', {
          ...exerciseBody,
          equipmentOptions: [{ ...exerciseBody.equipmentOptions[0], primaryMuscles: [] }],
        })
      ).status,
      400
    );
    assert.equal(
      (
        await request('exercises', 'POST', {
          ...exerciseBody,
          equipmentOptions: [
            { ...exerciseBody.equipmentOptions[0], equipmentId: 'missing' },
          ],
        })
      ).status,
      400
    );
    assert.equal(
      (
        await request('exercises', 'POST', {
          ...exerciseBody,
          equipmentOptions: [
            { ...exerciseBody.equipmentOptions[0], attachmentId: 1 },
          ],
        })
      ).status,
      400
    );
    assert.equal(
      (
        await request('exercises', 'POST', {
          ...exerciseBody,
          equipmentOptions: [
            exerciseBody.equipmentOptions[0],
            exerciseBody.equipmentOptions[0],
          ],
        })
      ).status,
      400
    );
    const createExercise = await request('exercises', 'POST', exerciseBody);
    assert.equal(createExercise.status, 201);
    const exercise = await createExercise.json();
    assert.equal(
      (await (await request(`exercises/${exercise.id}`)).json()).name,
      'Custom pull'
    );
    const catalog = await (await request('catalog')).json();
    const variant = catalog.exercises.find(
      (item) => item.exerciseId === exercise.id
    );
    assert.equal(variant.equipment, 'Custom Multifunctional Cable Machine');
    assert.equal(variant.attachment, 'Dual Rope');
    assert.ok(variant.muscleGroupIds.includes(2));
    assert.deepEqual(variant.attachmentIds, [12]);
    assert.equal(
      (await request(`equipment/${machine.id}`, 'DELETE')).status,
      409
    );
    assert.equal(
      (
        await request(`equipment/${machine.id}`, 'PUT', {
          ...equipmentBody,
          attachmentIds: [],
        })
      ).status,
      409
    );
    assert.equal(
      (
        await request(`equipment/${machine.id}`, 'PUT', {
          ...equipmentBody,
          'equipment-type': 'Renamed Multifunctional Cable Machine',
        })
      ).status,
      200
    );
    assert.equal(
      (
        await request(`exercises/${exercise.id}`, 'PUT', {
          ...exerciseBody,
          name: 'Renamed pull',
        })
      ).status,
      200
    );
    const workoutResponse = await request('workouts', 'POST', {
      name: 'Custom workout',
      selections: [
        {
          exerciseId: exercise.id,
          equipmentOptionKey: 'cable',
          attachment: 'Dual Rope',
        },
      ],
    });
    assert.equal(workoutResponse.status, 201);
    const workout = await workoutResponse.json();
    assert.equal(
      workout.exercises[0].equipment,
      'Renamed Multifunctional Cable Machine'
    );
    assert.equal(workout.exercises[0].name, 'Renamed pull');
    assert.equal(
      (await request(`exercises/${exercise.id}`, 'DELETE')).status,
      409
    );
    assert.equal(
      (
        await request(`exercises/${exercise.id}`, 'PUT', {
          ...exerciseBody,
          equipmentOptions: [
            { ...exerciseBody.equipmentOptions[0], key: 'replacement' },
          ],
        })
      ).status,
      409
    );
    assert.equal(
      (
        await request(`exercises/${exercise.id}`, 'PUT', {
          ...exerciseBody,
          equipmentOptions: [
            { ...exerciseBody.equipmentOptions[0], attachmentId: null },
          ],
        })
      ).status,
      200
    );
    assert.equal(
      (
        await request(`equipment/${machine.id}`, 'PUT', {
          ...equipmentBody,
          attachmentIds: [],
        })
      ).status,
      409
    );
    assert.equal(
      (await request(`workouts/${workout.id}`, 'DELETE')).status,
      204
    );
    assert.equal(
      (await request(`exercises/${exercise.id}`, 'DELETE')).status,
      204
    );
    assert.equal(
      (await request(`equipment/${machine.id}`, 'DELETE')).status,
      204
    );
    assert.equal((await request(`equipment/${machine.id}`)).status, 404);
    assert.equal(
      (await request(`exercises/${exercise.id}`, 'PUT', exerciseBody)).status,
      404
    );
    assert.equal((await request('exercises/missing', 'DELETE')).status, 404);
    assert.ok(
      !(await (await request('catalog')).json()).exercises.some(
        (item) => item.exerciseId === exercise.id
      )
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('initialization seeds stable catalog IDs once and does not resurrect deletions or overwrite edits', async () => {
  const db = memoryDb({ seed: false });
  db.records.legacy_equipment = [{ _id: 'old', name: 'Legacy record' }];
  await initializeDatabase(db);
  assert.ok(db.records.catalog_exercises.length);
  assert.ok(db.records.catalog_equipment.length);
  assert.equal(
    db.records.catalog_equipment.find((item) => item._id === '5')[
      'equipment-type'
    ],
    'Smith Machine'
  );
  const exerciseId = db.records.catalog_exercises[0]._id;
  await db.collection('catalog_exercises').deleteOne({ _id: exerciseId });
  await db
    .collection('catalog_equipment')
    .updateOne(
      { _id: '5' },
      { $set: { 'equipment-type': 'Edited Smith Machine' } }
    );
  const count = db.records.catalog_exercises.length;
  await initializeDatabase(db);
  assert.equal(db.records.catalog_exercises.length, count);
  assert.equal(
    await db.collection('catalog_exercises').findOne({ _id: exerciseId }),
    null
  );
  assert.equal(
    db.records.catalog_equipment.find((item) => item._id === '5')[
      'equipment-type'
    ],
    'Edited Smith Machine'
  );
  assert.equal(db.records.legacy_equipment[0].name, 'Legacy record');
  assert.equal(db.records.workouts.length, 2);
  await db.collection('workouts').deleteOne({ templateKey: 'chest-default' });
  await initializeDatabase(db);
  assert.equal(db.records.workouts.length, 1);
});

test('seeded numeric equipment references are protected when removing supported attachments', async () => {
  const db = memoryDb();
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    db.records.catalog_exercises[0].equipmentOptions = [
      { key: '1', equipmentId: 4, attachmentId: 12 },
    ];
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/equipment/4`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'equipment-type': 'Multifunctional Cable Machine',
          category: 'Machines',
          attachmentIds: [],
        }),
      }
    );
    assert.equal(response.status, 409);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

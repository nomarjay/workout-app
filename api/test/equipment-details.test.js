import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { memoryDb } from './helpers/memory-db.js';

test('equipment muscle information persists through create, edit, and catalog reload', async () => {
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
    const catalog = await (await request('catalog')).json();
    const template = catalog.equipment.find((item) => item.id === '1');
    assert.deepEqual(
      template.primaryMuscles,
      [],
      'Equipment muscles are never inferred from exercise options'
    );
    const body = {
      'equipment-type': 'My chest station',
      category: 'Machines',
      primaryMuscles: ['Chest', ' Upper Chest ', 'Chest'],
      secondaryMuscles: ['Triceps', 'Front Delts'],
      attachmentIds: [],
      image: 'https://example.com/machine.jpg',
    };
    db.records.catalog_media.push({
      _id: 'equipment:1',
      image: body.image,
      imageAttribution: {
        name: 'Original photographer',
        url: 'https://example.com/source',
      },
    });
    const created = await request('equipment', 'POST', body);
    assert.equal(created.status, 201);
    const equipment = await created.json();
    assert.deepEqual(equipment.primaryMuscles, ['Chest', 'Upper Chest']);
    assert.deepEqual(equipment.secondaryMuscles, ['Triceps', 'Front Delts']);
    const saved = await (await request(`equipment/${equipment.id}`)).json();
    assert.deepEqual(saved.primaryMuscles, equipment.primaryMuscles);
    assert.deepEqual(
      db.records.catalog_equipment.find((item) => item._id === equipment.id)
        .secondaryMuscles,
      body.secondaryMuscles
    );
    const reloaded = (await (await request('catalog')).json()).equipment.find(
      (item) => item.id === equipment.id
    );
    assert.deepEqual(reloaded.muscleGroupIds, [1, 3, 6]);
    assert.equal(reloaded.image, body.image);
    assert.equal(
      reloaded.imageAttribution.name,
      'Original photographer',
      'Copied image URLs keep their source credit'
    );
    const exercise = await request('exercises', 'POST', {
      name: 'Custom press',
      muscleGroupId: 1,
      equipmentOptions: [
        {
          key: 'press',
          equipmentId: equipment.id,
          attachmentId: null,
          primaryMuscles: ['Upper Chest'],
          secondaryMuscles: ['Triceps'],
          isIsolation: false,
        },
      ],
    });
    assert.equal(exercise.status, 201);
    const variant = (await (await request('catalog')).json()).exercises.find(
      (item) => item.equipmentId === equipment.id
    );
    assert.deepEqual(
      variant.primaryMuscles,
      ['Upper Chest'],
      'Movement muscles remain specific to the exercise'
    );
    assert.equal(
      (
        await request(`equipment/${equipment.id}`, 'PUT', {
          ...body,
          primaryMuscles: [],
          secondaryMuscles: [],
        })
      ).status,
      200
    );
    const cleared = (await (await request('catalog')).json()).equipment.find(
      (item) => item.id === equipment.id
    );
    assert.deepEqual(
      cleared.primaryMuscles,
      [],
      'Explicit empty selections are preserved instead of inferred again'
    );
    assert.deepEqual(cleared.secondaryMuscles, []);
    assert.equal(
      (
        await request(`equipment/${equipment.id}`, 'PUT', {
          ...body,
          primaryMuscles: ['Lats'],
          secondaryMuscles: ['Biceps'],
        })
      ).status,
      200
    );
    const legacyBody = {
      'equipment-type': 'Renamed station',
      category: 'Machines',
      attachmentIds: [],
    };
    assert.equal(
      (await request(`equipment/${equipment.id}`, 'PUT', legacyBody)).status,
      200
    );
    const preserved = await (await request(`equipment/${equipment.id}`)).json();
    assert.deepEqual(preserved.primaryMuscles, ['Lats']);
    for (const fields of [
      { primaryMuscles: 'Chest' },
      { secondaryMuscles: [42] },
      { primaryMuscles: [''] },
      { primaryMuscles: Array(31).fill('Chest') },
    ]) {
      assert.equal(
        (await request('equipment', 'POST', { ...body, ...fields })).status,
        400,
        JSON.stringify(fields)
      );
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

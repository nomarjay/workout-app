import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { createApp } from '../src/app.js';
import {
  trainerPrescription,
  calculateTrainerWorkout,
} from '../src/trainer-mode.js';
import { memoryDb } from './helpers/memory-db.js';

const settings = (exerciseIndex) => ({
  exerciseIndex,
  minWeight: 10,
  maxWeight: 50,
  workingWeight: 25.5,
  reps: 10,
  sets: 3,
  tempo: 'slow-and-controlled',
});
const body = () => ({
  weightUnit: 'kg',
  exercises: [settings(0), settings(1)],
});
const exercises = [
  { exerciseId: 'row', equipmentId: 4 },
  { exerciseId: 'row', equipmentId: 4 },
];

test('trainer handler validates bounds, occurrences, numeric inputs, and tempo', () => {
  const workout = { exercises };
  const prescription = trainerPrescription(body(), workout);
  const result = calculateTrainerWorkout(prescription);
  assert.deepEqual(result.totals, { sets: 6, reps: 60, volume: 1530 });
  assert.equal(result.exercises[0].volume, 765);
  assert.equal(prescription.exercises[0].totalReps, undefined);
  for (const change of [
    { minWeight: 30 },
    { maxWeight: 20 },
    { workingWeight: -1 },
    { workingWeight: '25' },
    { reps: 0 },
    { sets: 1.5 },
    { tempo: 'anything' },
    { workingWeight: Infinity },
    { exerciseIndex: 1 },
    { exerciseIndex: 2 },
    { minWeight: null },
    { sets: Number.MAX_SAFE_INTEGER, reps: 10 },
    { maxWeight: Number.MAX_VALUE, workingWeight: Number.MAX_VALUE },
  ]) {
    const invalid = body();
    Object.assign(invalid.exercises[0], change);
    assert.throws(() => trainerPrescription(invalid, workout));
  }
  assert.throws(() =>
    trainerPrescription({ ...body(), weightUnit: 'stones' }, workout)
  );
  assert.throws(() =>
    trainerPrescription({ ...body(), exercises: [settings(0)] }, workout)
  );
  const zero = body();
  zero.exercises[0] = { ...settings(0), minWeight: 0, workingWeight: 0 };
  assert.equal(
    calculateTrainerWorkout(trainerPrescription(zero, workout)).exercises[0]
      .volume,
    0
  );
});

test('Trainer Mode persists separately, detects changed workouts, and cleans up on deletion', async () => {
  const db = memoryDb();
  const id = new ObjectId();
  const workout = {
    _id: id,
    name: 'Rows',
    exercises: structuredClone(exercises),
  };
  db.records.workouts.push(workout);
  const before = JSON.stringify(workout);
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (path, method = 'GET', data) =>
    fetch(`${base}/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  const path = `trainer-mode/${id}`;
  try {
    assert.equal((await request('trainer-mode')).status, 200);
    assert.equal((await request('trainer-mode/invalid')).status, 400);
    assert.equal((await request(`trainer-mode/${new ObjectId()}`)).status, 404);
    assert.equal((await request(path)).status, 404);
    assert.equal((await request(`${path}/calculate`, 'POST')).status, 404);
    assert.equal((await request(path, 'PUT', {})).status, 400);
    assert.equal((await request(path, 'PUT', body())).status, 200);
    assert.equal(JSON.stringify(workout), before);
    const plan = await (await request(path)).json();
    assert.equal(plan.needsReview, false);
    assert.equal(plan.workoutId, String(id));
    assert.equal(db.records.trainer_mode.length, 1);
    const calculated = await (
      await request(`${path}/calculate`, 'POST')
    ).json();
    assert.deepEqual(calculated.totals, { sets: 6, reps: 60, volume: 1530 });
    workout.name = 'Renamed';
    assert.equal((await request(`${path}/calculate`, 'POST')).status, 200);
    workout.exercises[0].equipmentId = 7;
    assert.equal((await (await request(path)).json()).needsReview, true);
    assert.equal((await request(`${path}/calculate`, 'POST')).status, 409);
    const updated = body();
    updated.exercises[1].workingWeight = 40;
    assert.equal((await request(path, 'PUT', updated)).status, 200);
    const revised = await (await request(path)).json();
    assert.equal(revised.createdAt, plan.createdAt);
    assert.equal(revised.needsReview, false);
    assert.equal(db.records.trainer_mode.length, 1);
    assert.equal((await request(path, 'DELETE')).status, 204);
    assert.equal((await request(path)).status, 404);
    await request(path, 'PUT', body());
    assert.equal((await request(`workouts/${id}`, 'DELETE')).status, 204);
    assert.equal(db.records.trainer_mode.length, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

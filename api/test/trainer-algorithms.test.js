import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { createApp } from '../src/app.js';
import { memoryDb } from './helpers/memory-db.js';
import { defaultTrainerAlgorithm, validateAlgorithm, algorithmSetPlan } from '../../ui/src/utils/trainerAlgorithms.js';
import { trainerPrescription, calculateTrainerWorkout } from '../src/trainer-mode.js';

test('default algorithm keeps the requested percentages, warm-up, and rep ranges', () => {
  const plan = algorithmSetPlan(defaultTrainerAlgorithm, 100, 0.5);
  assert.deepEqual(plan.map(set => [set.weightMin, set.weightMax, set.repsMin, set.repsMax, set.warmup]), [[35, 35, 12, 15, true], [50, 50, 10, 10, false], [75, 75, 8, 8, false], [90, 95, 6, 6, false]]);
  assert.deepEqual(algorithmSetPlan(defaultTrainerAlgorithm, 280, 5).map(set => [set.weightMin, set.weightMax]), [[95, 95], [140, 140], [210, 210], [250, 265]]);
  assert.deepEqual(algorithmSetPlan(defaultTrainerAlgorithm, 0, 5), []);
  for (const set of [{ percentMin: 101 }, { percentMax: 1 }, { repsMin: 0 }, { repsMax: 1 }, { warmup: 'yes' }]) {
    assert.throws(() => validateAlgorithm({ ...defaultTrainerAlgorithm, sets: [{ ...defaultTrainerAlgorithm.sets[0], ...set }] }));
  }
  assert.throws(() => validateAlgorithm({ ...defaultTrainerAlgorithm, sets: [] }));
});

test('template prescriptions apply to every exercise and calculate range totals', () => {
  const prescription = trainerPrescription({ weightUnit: 'kg', algorithm: defaultTrainerAlgorithm, exercises: [0, 1].map(exerciseIndex => ({ exerciseIndex, referenceMaxWeight: 100, weightIncrement: 0.5, tempo: 'controlled' })) }, { exercises: [{}, {}] });
  const result = calculateTrainerWorkout(prescription);
  assert.equal(result.exercises[0].setPlan.length, 4);
  assert.equal(result.totals.sets, 8);
  assert.equal(result.totals.reps, 72);
  assert.equal(result.totals.repsMax, 78);
  assert.equal(result.totals.volume, 4120);
  assert.equal(result.totals.volumeMax, 4390);
});

test('algorithm library saves custom copies and Trainer Mode retains the chosen snapshot', async () => {
  const db = memoryDb();
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = (path, method = 'GET', body) => fetch(`${base}/${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    const defaults = await (await call('trainer-algorithms')).json();
    assert.equal(defaults[0].id, defaultTrainerAlgorithm.id);
    assert.equal((await call('trainer-algorithms/default-four-set', 'PUT', defaultTrainerAlgorithm)).status, 400);
    const response = await call('trainer-algorithms', 'POST', { ...defaultTrainerAlgorithm, name: 'Custom test' });
    assert.equal(response.status, 201);
    const custom = await response.json();
    const workoutId = new ObjectId();
    db.records.workouts.push({ _id: workoutId, name: 'Test', exercises: [{ id: 'exercise' }] });
    assert.equal((await call(`trainer-mode/${workoutId}`, 'PUT', { weightUnit: 'kg', algorithm: custom, exercises: [{ exerciseIndex: 0, referenceMaxWeight: 100, weightIncrement: 0.5, tempo: 'controlled' }] })).status, 200);
    const changed = { ...custom, name: 'Changed', sets: [custom.sets[0]] };
    assert.equal((await call(`trainer-algorithms/${custom.id}`, 'PUT', changed)).status, 200);
    const saved = await (await call(`trainer-mode/${workoutId}`)).json();
    assert.equal(saved.algorithm.name, 'Custom test');
    assert.equal(saved.algorithm.sets.length, 4);
    const result = await (await call(`trainer-mode/${workoutId}/calculate`, 'POST')).json();
    assert.equal(result.exercises[0].setPlan[3].weightMax, 95);
    assert.equal(result.exercises[0].setPlan[0].warmup, true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});


test('original Trainer Mode settings coexist with the workout algorithm without equipment-step rounding', () => {
  const exercise = { exerciseIndex: 0, oneRepMax: 280, minWeight: 98, maxWeight: 266, workingWeight: 210, reps: 8, sets: 4, tempo: 'controlled', repsInReserve: 2 };
  const saved = trainerPrescription({ weightUnit: 'lb', algorithm: defaultTrainerAlgorithm, exercises: [exercise] }, { exercises: [{}] });
  assert.equal(saved.exercises[0].oneRepMax, 280);
  assert.equal(saved.exercises[0].workingWeight, 210);
  assert.equal(saved.exercises[0].reps, 8);
  const result = calculateTrainerWorkout(saved);
  assert.equal(result.exercises[0].setPlan[0].weightMin, 98);
  assert.equal(result.exercises[0].setPlan[3].weightMax, 266);
  const manual = trainerPrescription({ weightUnit: 'lb', algorithm: defaultTrainerAlgorithm, exercises: [{ ...exercise, useAlgorithm: false, minWeight: 0, maxWeight: 280, loadMode: 'fixed', sets: 3 }] }, { exercises: [{}] });
  assert.equal(calculateTrainerWorkout(manual).totals.volume, 5040);
  assert.equal(manual.exercises[0].sets, 3);
});


test('Smith machine bar is added once, supports unloaded sets, and stays out of non-Smith exercises', () => {
  const make = (weight, equipmentId, unit = 'lb') => trainerPrescription({ weightUnit: unit, algorithm: defaultTrainerAlgorithm, exercises: [{ exerciseIndex: 0, oneRepMax: weight, weightIncrement: 0.01, tempo: 'controlled' }] }, { exercises: [{ equipmentId }] });
  const smith = make(100, 5);
  const first = calculateTrainerWorkout(smith);
  const reloaded = calculateTrainerWorkout(structuredClone(smith));
  assert.equal(smith.exercises[0].oneRepMax, 100);
  assert.equal(first.exercises[0].setPlan[0].weightMin, 39.2);
  assert.equal(first.exercises[0].setPlan[2].weightMin, 84);
  assert.deepEqual(first, reloaded);
  assert.ok(calculateTrainerWorkout(make(0, 5)).exercises[0].setPlan.every(set => set.weightMin === 12 && set.weightMax === 12));
  assert.equal(calculateTrainerWorkout(make(100, 6)).exercises[0].setPlan[0].weightMin, 35);
  const kg = calculateTrainerWorkout(make(0, 5, 'kg')).exercises[0].setPlan;
  assert.ok(kg.every(set => Math.abs(set.weightMin - 5.44) < 0.01));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  suggestedLoad,
  loadMetrics,
  suggestedSetWeight,
} from '../../ui/src/utils/training.js';
import {
  trainerPrescription,
  calculateTrainerWorkout,
} from '../src/trainer-mode.js';

test('1RM normalizes to 100%, loads decrease with reps, and reserve is explicit', () => {
  assert.equal(suggestedLoad(100, 1, 0), 100);
  assert.equal(suggestedLoad(100, 10, 0), 75);
  assert.ok(suggestedLoad(100, 5, 2) < suggestedLoad(100, 5, 0));
  assert.equal(suggestedLoad(100, 10, 2), null);
  assert.equal(suggestedLoad(0, 5), null);
  assert.equal(suggestedLoad(100, 1.5), null);
  const item = { oneRepMax: 100, workingWeight: 75, reps: 8 };
  assert.equal(loadMetrics(item).intensityPercent, 75);
  assert.equal(
    loadMetrics(item, 'kg', { weightKg: 80 }).relativeStrength,
    1.25
  );
  assert.ok(
    Math.abs(
      loadMetrics({ ...item, oneRepMax: 100 / 0.45359237 }, 'lb', {
        weightKg: 80,
      }).relativeStrength - 1.25
    ) < 1e-10
  );
  assert.equal(loadMetrics({}).intensityPercent, null);
});

test('prescriptions reject invalid 1RM and reserve while supporting older plans', () => {
  const item = {
    exerciseIndex: 0,
    minWeight: 0,
    maxWeight: 200,
    workingWeight: 75,
    reps: 8,
    sets: 3,
    tempo: 'controlled',
  };
  const workout = { exercises: [{}] };
  const parse = (changes) =>
    trainerPrescription(
      { weightUnit: 'kg', exercises: [{ ...item, ...changes }] },
      workout
    );
  assert.equal(parse({}).exercises[0].oneRepMax, null);
  assert.equal(parse({ oneRepMax: 100 }).exercises[0].oneRepMax, 100);
  for (const changes of [
    { oneRepMax: 0 },
    { oneRepMax: -1 },
    { oneRepMax: 50 },
    { oneRepMax: '100' },
    { repsInReserve: 6 },
    { repsInReserve: 1.5 },
  ])
    assert.throws(() => parse(changes));
});

test('adaptive set weights respond to reps, sets, strength and equipment increments', () => {
  const item = {
    oneRepMax: 100,
    reps: 8,
    repsInReserve: 2,
    sets: 3,
    weightIncrement: 2.5,
  };
  assert.deepEqual(
    [1, 2, 3].map((set) => suggestedSetWeight(item, set)),
    [75, 75, 75]
  );
  assert.equal(suggestedSetWeight({ ...item, sets: 1 }, 2), null);
  assert.ok(
    suggestedSetWeight({ ...item, reps: 12 }, 1) < suggestedSetWeight(item, 1)
  );
  assert.ok(
    suggestedSetWeight({ ...item, oneRepMax: 120 }, 1) >
      suggestedSetWeight(item, 1)
  );
  assert.equal(
    suggestedSetWeight({ ...item, weightIncrement: 5 }, 2, 'lb'),
    75
  );
  assert.equal(
    suggestedSetWeight({ ...item, oneRepMax: null, workingWeight: 60 }, 2),
    60
  );
  assert.equal(suggestedSetWeight({ ...item, reps: 0 }, 1), null);
  assert.equal(suggestedSetWeight({ ...item, reps: 31 }, 1), null);
  assert.equal(suggestedSetWeight({ ...item, weightIncrement: -1 }, 1), null);
  assert.equal(suggestedSetWeight({ ...item, sets: 100 }, 100), 75);
});

test('saved adaptive prescriptions calculate volume using each set weight', () => {
  const item = {
    exerciseIndex: 0,
    oneRepMax: 100,
    reps: 8,
    sets: 3,
    repsInReserve: 2,
    loadMode: 'adaptive',
    weightIncrement: 2.5,
    workingWeight: 75,
    minWeight: 0,
    maxWeight: 100,
    tempo: 'controlled',
  };
  const plan = trainerPrescription(
    { weightUnit: 'kg', exercises: [item] },
    { exercises: [{}] }
  );
  const calculated = calculateTrainerWorkout(plan);
  assert.deepEqual(
    calculated.exercises[0].setPlan.map((set) => set.weight),
    [75, 75, 75]
  );
  assert.equal(calculated.totals.volume, 1800);
  assert.throws(() =>
    trainerPrescription(
      { weightUnit: 'kg', exercises: [{ ...item, weightIncrement: 0 }] },
      { exercises: [{}] }
    )
  );
});

test('280 lb cable-press max yields equal 210 lb working sets until performance changes', () => {
  const item = {
    oneRepMax: 280,
    reps: 8,
    repsInReserve: 2,
    sets: 3,
    weightIncrement: 5,
    maxWeight: 280,
  };
  assert.deepEqual(
    [1, 2, 3].map((set) => suggestedSetWeight(item, set, 'lb')),
    [210, 210, 210]
  );
  assert.equal(
    suggestedSetWeight({ ...item, setFeedback: { 1: 'target' } }, 2, 'lb'),
    210
  );
  assert.equal(
    suggestedSetWeight({ ...item, setFeedback: { 1: 'hard' } }, 2, 'lb'),
    205
  );
  assert.equal(
    suggestedSetWeight({ ...item, setFeedback: { 1: 'missed' } }, 2, 'lb'),
    200
  );
  assert.equal(
    suggestedSetWeight({ ...item, setFeedback: { 1: 'easy' } }, 2, 'lb'),
    215
  );
  assert.equal(
    suggestedSetWeight(
      { ...item, setFeedback: { 1: 'hard', 2: 'missed' } },
      3,
      'lb'
    ),
    195
  );
  assert.equal(
    suggestedSetWeight(
      { ...item, maxWeight: 210, setFeedback: { 1: 'easy' } },
      2,
      'lb'
    ),
    210
  );
  assert.equal(
    suggestedSetWeight({ ...item, setFeedback: { 1: 'hard' } }, 1, 'lb'),
    210
  );
});

test('manual and adaptive Smith loads include the bar without changing entered plate weights', () => {
  const item = {
    equipmentId: 5,
    oneRepMax: 100,
    workingWeight: 72,
    maxWeight: 100,
    reps: 8,
    repsInReserve: 2,
    sets: 3,
    weightIncrement: 0.01,
  };
  assert.equal(suggestedSetWeight(item, 1, 'lb'), 84);
  assert.equal(
    suggestedSetWeight({ ...item, oneRepMax: null, workingWeight: 0 }, 1, 'lb'),
    12
  );
  assert.equal(loadMetrics(item, 'lb').intensityPercent, 75);
  const workout = { exercises: [{ equipmentId: 5 }] };
  const plan = trainerPrescription(
    {
      weightUnit: 'lb',
      exercises: [
        {
          ...item,
          exerciseIndex: 0,
          minWeight: 0,
          loadMode: 'fixed',
          tempo: 'controlled',
        },
      ],
    },
    workout
  );
  assert.equal(calculateTrainerWorkout(plan).totals.volume, 2016);
  assert.equal(plan.exercises[0].workingWeight, 72);
});

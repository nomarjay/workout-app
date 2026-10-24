import { isSmithMachine, barResistance, totalLoad } from '../../ui/src/utils/equipment.js';
import { validateAlgorithm, algorithmSetPlan } from '../../ui/src/utils/trainerAlgorithms.js';
import { createHash } from 'node:crypto';
import { loadMetrics, suggestedSetWeight } from '../../ui/src/utils/training.js';

export const trainerTempos = ['controlled', 'slow-and-controlled', 'explosive'];

// Bind prescriptions to ordered occurrences, including repeated movements.
export function workoutSignature(workout) {
  return createHash('sha256').update(JSON.stringify(workout.exercises.map(item => [
    item.exerciseId ?? item.id, item.equipmentOptionKey ?? null,
    item.equipmentId ?? null, item.attachmentId ?? null,
  ]))).digest('hex');
}

function number(value, label, { integer = false, positive = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) ||
      (positive ? value <= 0 : value < 0) || (integer && !Number.isSafeInteger(value))) {
    throw new Error(`${label} must be a ${positive ? 'positive' : 'nonnegative'} ${integer ? 'integer' : 'number'}.`);
  }
  return value;
}

export function trainerPrescription(body, workout) {
  if (!body || !['kg', 'lb'].includes(body.weightUnit)) throw new Error('Choose kg or lb for weightUnit.');
  if (!Array.isArray(body.exercises) || body.exercises.length !== workout.exercises.length || !body.exercises.length) {
    throw new Error('Assign Trainer Mode settings to every workout exercise.');
  }
  const algorithm = body.algorithm == null ? null : validateAlgorithm(body.algorithm);
  const seen = new Set();
  const exercises = body.exercises.map(item => {
    if (!item || !Number.isInteger(item.exerciseIndex) || item.exerciseIndex < 0 ||
        item.exerciseIndex >= workout.exercises.length || seen.has(item.exerciseIndex)) {
      throw new Error('Each exerciseIndex must identify a unique position in the workout.');
    }
    seen.add(item.exerciseIndex);
    const equipment = workout.exercises[item.exerciseIndex];
    const equipmentId = equipment.equipmentId ?? (isSmithMachine(equipment) ? 5 : null);
    const smith = isSmithMachine(equipment);
    if (algorithm && item.useAlgorithm !== false) {
      const referenceMaxWeight = number(item.oneRepMax ?? item.referenceMaxWeight, 'Template maximum weight', { positive: !smith });
      const weightIncrement = item.weightIncrement == null || item.weightIncrement === '' ? 0.01 : number(item.weightIncrement, 'Weight increment', { positive: true });
      if (!trainerTempos.includes(item.tempo)) throw new Error('Choose a valid tempo.');
      const optionalWeight = (value, label) => value == null || value === '' ? null : number(value, label);
      const minWeight = optionalWeight(item.minWeight, 'Minimum weight');
      const maxWeight = optionalWeight(item.maxWeight, 'Maximum weight');
      const workingWeight = optionalWeight(item.workingWeight, 'Working weight');
      if (minWeight !== null && maxWeight !== null && minWeight > maxWeight) throw new Error('Minimum weight cannot exceed maximum weight.');
      const reps = item.reps == null || item.reps === '' ? (algorithm.sets.find(set => !set.warmup && set.repsMin === 8) || algorithm.sets.find(set => !set.warmup) || algorithm.sets[0]).repsMin : number(item.reps, 'Reps', { positive: true, integer: true });
      const repsInReserve = item.repsInReserve ?? 2;
      number(repsInReserve, 'Reps in reserve', { integer: true });
      if (repsInReserve > 5) throw new Error('Reps in reserve must be between 0 and 5.');
      return { equipmentId, useAlgorithm: true, oneRepMax: referenceMaxWeight, minWeight, maxWeight, workingWeight, reps, repsInReserve, exerciseIndex: item.exerciseIndex, referenceMaxWeight, weightIncrement, tempo: item.tempo, sets: algorithm.sets.length, loadMode: 'template' };
    }
    const minWeight = number(item.minWeight, 'Minimum weight');
    const maxWeight = number(item.maxWeight, 'Maximum weight');
    const workingWeight = number(item.workingWeight, 'Working weight');
    if (minWeight > maxWeight || workingWeight < minWeight || workingWeight > maxWeight) {
      throw new Error('Working weight must be between minimum and maximum weight.');
    }
    const reps = number(item.reps, 'Reps', { integer: true, positive: true });
    const sets = number(item.sets, 'Sets', { integer: true, positive: true });
    const oneRepMax = item.oneRepMax == null || item.oneRepMax === '' ? null : number(item.oneRepMax, 'One-rep max', { positive: !smith });
    const repsInReserve = item.repsInReserve ?? 2;
    number(repsInReserve, 'Reps in reserve', { integer: true });
    if (repsInReserve > 5) throw new Error('Reps in reserve must be between 0 and 5.');
    if (oneRepMax !== null && workingWeight > oneRepMax) throw new Error('Working weight cannot exceed the one-rep max.');
    if (!trainerTempos.includes(item.tempo)) throw new Error(`Choose a tempo: ${trainerTempos.join(', ')}.`);
    const loadMode = item.loadMode ?? 'fixed';
    if (!['fixed', 'adaptive'].includes(loadMode)) throw new Error('Choose a valid load mode.');
    const weightIncrement = item.weightIncrement == null || item.weightIncrement === '' ? (body.weightUnit === 'lb' ? 5 : 2.5) : number(item.weightIncrement, 'Weight increment', { positive: true });
    if (loadMode === 'adaptive' && reps > 30) throw new Error('Adaptive load plans support 1–30 reps per set.');
    return { equipmentId, useAlgorithm: false, loadMode, weightIncrement, exerciseIndex: item.exerciseIndex, minWeight, maxWeight, workingWeight, reps, sets, tempo: item.tempo, oneRepMax, repsInReserve };
  }).sort((a, b) => a.exerciseIndex - b.exerciseIndex);
  const prescription = { weightUnit: body.weightUnit, exercises, ...(algorithm ? { algorithm } : {}) };
  calculateTrainerWorkout(prescription); // Reject arithmetic overflow before persistence.
  return prescription;
}

// Pure calculation handler: no database access or mutation of workout definitions.
export function calculateTrainerWorkout(prescription, profile = null) {
  const exercises = prescription.exercises.map(item => {
    if (prescription.algorithm && item.useAlgorithm !== false) {
      const setPlan = algorithmSetPlan(prescription.algorithm, totalLoad(item.referenceMaxWeight, item, prescription.weightUnit), item.weightIncrement, barResistance(item, prescription.weightUnit));
      const sum = (weightKey, repsKey) => setPlan.reduce((total, set) => total + set[weightKey] * set[repsKey], 0);
      return { ...item, setPlan, totalReps: setPlan.reduce((total, set) => total + set.repsMin, 0), totalRepsMax: setPlan.reduce((total, set) => total + set.repsMax, 0), volume: sum('weightMin', 'repsMin'), volumeMax: sum('weightMax', 'repsMax') };
    }
    if (item.loadMode !== 'adaptive') return { ...item, ...loadMetrics(item, prescription.weightUnit, profile), totalReps: item.reps * item.sets, volume: totalLoad(item.workingWeight, item, prescription.weightUnit) * item.reps * item.sets };
    const setPlan = Array.from({ length: Math.min(item.sets, 100) }, (_, index) => ({ set: index + 1, reps: item.reps, weight: suggestedSetWeight(item, index + 1, prescription.weightUnit) }));
    if (setPlan.some(set => set.weight === null)) throw new Error('Enter valid values for the adaptive set plan.');
    // Saved prescriptions contain targets, not live performance feedback.
    const volume = suggestedSetWeight(item, 1, prescription.weightUnit) * item.reps * item.sets;
    return { ...item, ...loadMetrics(item, prescription.weightUnit, profile), setPlan, totalReps: item.reps * item.sets, volume };
  });
  const totals = exercises.reduce((result, item) => ({
    sets: result.sets + item.sets, reps: result.reps + item.totalReps, volume: result.volume + item.volume,
  }), { sets: 0, reps: 0, volume: 0 });
  if (prescription.algorithm) {
    totals.repsMax = exercises.reduce((total, item) => total + (item.totalRepsMax ?? item.totalReps), 0);
    totals.volumeMax = exercises.reduce((total, item) => total + (item.volumeMax ?? item.volume), 0);
    if (!Number.isSafeInteger(totals.repsMax) || !Number.isFinite(totals.volumeMax)) throw new Error('Template totals exceed the supported numeric range.');
  }
  if (!Number.isSafeInteger(totals.sets) || !Number.isSafeInteger(totals.reps) || !Number.isFinite(totals.volume)) {
    throw new Error('Trainer Mode totals exceed the supported numeric range.');
  }
  return { weightUnit: prescription.weightUnit, exercises, totals };
}

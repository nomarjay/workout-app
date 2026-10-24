import { barResistance, totalLoad } from './equipment.js';
// Inverse Epley approximation. RIR is an explicit planning assumption,
// not a validated prediction of an individual's remaining repetitions.
export function suggestedLoad(oneRepMax, reps, repsInReserve = 2) {
  if (!Number.isFinite(oneRepMax) || oneRepMax <= 0 || !Number.isInteger(reps) || reps < 1 ||
      !Number.isInteger(repsInReserve) || repsInReserve < 0 || repsInReserve > 5 || reps + repsInReserve > 10) return null;
  const capacity = reps + repsInReserve;
  return capacity === 1 ? oneRepMax : oneRepMax / (1 + capacity / 30);
}

export function loadMetrics(item, weightUnit = 'kg', profile = null) {
  const max = totalLoad(item.oneRepMax, item, weightUnit);
  if (!Number.isFinite(max) || max <= 0) return { intensityPercent: null, relativeStrength: null };
  const kg = max * (weightUnit === 'lb' ? 0.45359237 : 1);
  return {
    intensityPercent: totalLoad(item.workingWeight, item, weightUnit) / max * 100,
    relativeStrength: profile?.weightKg > 0 ? kg / profile.weightKg : null,
    suggestedWeight: suggestedLoad(max, item.reps, item.repsInReserve ?? 2),
  };
}

// Equal working sets retain their load unless prior set feedback calls for a change.
export function suggestedSetWeight(item, set, weightUnit = 'kg') {
  if (!Number.isSafeInteger(item.sets) || item.sets < 1 || !Number.isInteger(item.reps) || item.reps < 1 || item.reps > 30 ||
      !Number.isSafeInteger(set) || set < 1 || set > item.sets) return null;
  const reserve = item.repsInReserve ?? 2;
  if (!Number.isInteger(reserve) || reserve < 0 || reserve > 5) return null;
  const resistance = barResistance(item, weightUnit);
  const maximum = totalLoad(item.oneRepMax, item, weightUnit);
  const hasMax = maximum !== null && maximum > 0;
  const capacity = item.reps + reserve;
  const baseline = hasMax ? (capacity === 1 ? maximum : maximum / (1 + capacity / 30)) : totalLoad(item.workingWeight, item, weightUnit);
  if (!Number.isFinite(baseline) || baseline < 0) return null;
  const increment = item.weightIncrement == null || item.weightIncrement === '' ? (weightUnit === 'lb' ? 5 : 2.5) : item.weightIncrement;
  if (!Number.isFinite(increment) || increment <= 0) return null;
  const ceiling = Number.isFinite(item.maxWeight) && item.maxWeight >= 0 ? Math.min(baseline, item.maxWeight + resistance) : baseline;
  const roundDown = value => Math.round(Math.floor((value + 1e-9) / increment) * increment * 1e6) / 1e6;
  const upperLimit = Math.min(
    Number.isFinite(item.maxWeight) && item.maxWeight >= 0 ? item.maxWeight + resistance : Infinity,
    hasMax ? maximum : Infinity,
  );
  let weight = Math.max(Math.round(resistance * 100) / 100, roundDown(ceiling));
  // Feedback changes one available equipment increment at a time, never a
  // fractional percentage of the stack. A missed target calls for two steps.
  const feedback = Object.entries(item.setFeedback || {}).filter(([key]) => Number.isSafeInteger(Number(key)) && Number(key) >= 1 && Number(key) < set).sort((a, b) => Number(a[0]) - Number(b[0]));
  for (const [, result] of feedback) {
    const steps = { easy: 1, target: 0, hard: -1, missed: -2 }[result] ?? 0;
    weight = Math.max(Math.round(resistance * 100) / 100, roundDown(Math.max(resistance, Math.min(upperLimit, weight + steps * increment))));
  }
  return weight;
}

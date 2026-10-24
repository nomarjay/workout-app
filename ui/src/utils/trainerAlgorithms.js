export const defaultTrainerAlgorithm = {
  id: 'default-four-set', name: 'Default · Four-set progression',
  sets: [
    { label: 'Warm-up', warmup: true, percentMin: 35, percentMax: 35, repsMin: 12, repsMax: 15 },
    { label: 'Set 2', warmup: false, percentMin: 50, percentMax: 50, repsMin: 10, repsMax: 10 },
    { label: 'Set 3', warmup: false, percentMin: 75, percentMax: 75, repsMin: 8, repsMax: 8 },
    { label: 'Set 4', warmup: false, percentMin: 90, percentMax: 95, repsMin: 6, repsMax: 6 },
  ],
};
export function validateAlgorithm(value) {
  if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 100 || !Array.isArray(value.sets) || !value.sets.length || value.sets.length > 20) throw new Error('Name the algorithm and add 1–20 sets.');
  const sets = value.sets.map(set => {
    if (!set || typeof set.label !== 'string' || !set.label.trim() || set.label.length > 60 || typeof set.warmup !== 'boolean') throw new Error('Each set needs a label and warm-up setting.');
    if (![set.percentMin, set.percentMax].every(n => Number.isFinite(n) && n > 0 && n <= 100) || set.percentMin > set.percentMax) throw new Error('Weight percentages must be between 0 and 100, with minimum no greater than maximum.');
    if (![set.repsMin, set.repsMax].every(n => Number.isInteger(n) && n >= 1 && n <= 100) || set.repsMin > set.repsMax) throw new Error('Rep ranges must be 1–100, with minimum no greater than maximum.');
    return { label: set.label.trim(), warmup: set.warmup, percentMin: set.percentMin, percentMax: set.percentMax, repsMin: set.repsMin, repsMax: set.repsMax };
  });
  return { ...(typeof value.id === 'string' ? { id: value.id } : {}), name: value.name.trim(), sets };
}
export function algorithmSetPlan(algorithm, maximumWeight, increment, minimumLoad = 0) {
  if (!Number.isFinite(maximumWeight) || maximumWeight <= 0 || !Number.isFinite(increment) || increment <= 0) return [];
  const round = n => Math.round(Math.floor((n + 1e-9) / increment) * increment * 1e6) / 1e6;
  return algorithm.sets.map((set, index) => ({ ...set, set: index + 1,
    weightMin: Math.max(Math.round(minimumLoad * 100) / 100, round(maximumWeight * set.percentMin / 100)),
    weightMax: Math.max(Math.round(minimumLoad * 100) / 100, round(maximumWeight * set.percentMax / 100)),
  }));
}

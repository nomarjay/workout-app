export const equipmentType = exercise => exercise['equipment-type'] || exercise.equipment || 'Unknown equipment';
export const equipmentLabel = equipmentType;
export const exerciseLabel = exercise => `${equipmentType(exercise)} · ${exercise.name}`;
export function compareEquipment(a, b) {
  return equipmentType(a).localeCompare(equipmentType(b)) || (a.name || '').localeCompare(b.name || '');
}
export function workoutEquipmentKey(workout) {
  return [...new Set((workout.exercises || []).map(equipmentType))].sort().join(' / ');
}

export function isSmithMachine(exercise) {
  return String(exercise?.equipmentId) === '5' || /\bsmith(?:[ -]machine)?\b/i.test(String(exercise?.['equipment-type'] || exercise?.equipment || exercise?.name || ''));
}
export function barResistance(exercise, unit = 'lb') {
  return isSmithMachine(exercise) ? (unit === 'kg' ? 12 * 0.45359237 : 12) : 0;
}
export function totalLoad(plates, exercise, unit = 'lb') {
  return typeof plates === 'number' && Number.isFinite(plates) && plates >= 0 ? plates + barResistance(exercise, unit) : null;
}

export const equipmentType = (exercise) =>
  exercise['equipment-type'] || exercise.equipment || 'Unknown equipment';
export const equipmentLabel = equipmentType;
export const exerciseLabel = (exercise) =>
  `${equipmentType(exercise)} · ${exercise.name}`;
export function compareEquipment(a, b) {
  return (
    equipmentType(a).localeCompare(equipmentType(b)) ||
    (a.name || '').localeCompare(b.name || '')
  );
}
export function workoutEquipmentKey(workout) {
  return [...new Set((workout.exercises || []).map(equipmentType))]
    .sort()
    .join(' / ');
}

export function isSmithMachine(exercise) {
  return (
    String(exercise?.equipmentId) === '5' ||
    /\bsmith(?:[ -]machine)?\b/i.test(
      String(
        exercise?.['equipment-type'] ||
          exercise?.equipment ||
          exercise?.name ||
          ''
      )
    )
  );
}
export function barResistance(exercise, unit = 'lb') {
  return isSmithMachine(exercise) ? (unit === 'kg' ? 12 * 0.45359237 : 12) : 0;
}
export function totalLoad(plates, exercise, unit = 'lb') {
  return typeof plates === 'number' && Number.isFinite(plates) && plates >= 0
    ? plates + barResistance(exercise, unit)
    : null;
}

// Attachment capability follows the existing equipment reference, not a new machine-type field.
export function supportsAttachments(machine) {
  if (!machine) return false;
  const id = machine.equipmentId ?? machine.id ?? machine._id;
  const name = String(
    machine['equipment-type'] || machine.equipment || machine.name || ''
  ).trim();
  if (/selectorized|plate[ -]loaded|smith/i.test(name)) return false;
  return (
    String(id) === '4' ||
    /\b(?:multi[ -]?functional[ -]*cable|pin[ -]+cable)\b/i.test(name)
  );
}
export function attachmentIdsFor(machine) {
  return supportsAttachments(machine) ? machine.attachmentIds || [] : [];
}

const normalized = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const aliases = {
  'pectoralis major': 'Chest', 'pectoralis minor': 'Chest', 'pectorals': 'Chest',
  'latissimus dorsi': 'Back', 'middle back': 'Back', 'lower back': 'Back', 'trapezius': 'Back', 'erector spinae': 'Back',
  'biceps brachii': 'Arms', 'triceps brachii': 'Arms', 'brachialis': 'Arms',
  'quadriceps': 'Legs', 'quadriceps femoris': 'Legs', 'gluteus maximus': 'Legs', 'gastrocnemius': 'Legs', 'soleus': 'Legs',
  'abdominals': 'Core', 'abs': 'Core', 'rectus abdominis': 'Core',
  'anterior deltoids': 'Shoulders', 'anterior deltoid': 'Shoulders', 'posterior deltoids': 'Shoulders', 'posterior deltoid': 'Shoulders', 'lateral deltoids': 'Shoulders', 'deltoids': 'Shoulders',
};
// Parent groups are determined from primary muscles only; secondary muscles never classify a movement.
export function primaryGroupIds(muscles, groups) {
  const selected = new Set((muscles || []).map(normalized));
  return groups.filter(group => [group.name, ...(group.muscles || [])].some(name => selected.has(normalized(name))) ||
    [...selected].some(name => normalized(aliases[name]) === normalized(group.name))).map(group => group.id);
}
export function belongsToPrimaryGroup(exercise, groupId) {
  if (Array.isArray(exercise.primaryMuscleGroupIds)) return exercise.primaryMuscleGroupIds.some(id => String(id) === String(groupId));
  return exercise.muscleGroupId != null && String(exercise.muscleGroupId) === String(groupId);
}

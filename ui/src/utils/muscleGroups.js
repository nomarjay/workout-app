// The declared group owns the movement. Secondary muscles are descriptive only.
export function belongsToPrimaryGroup(exercise, groupId) {
  return exercise.muscleGroupId != null && String(exercise.muscleGroupId) === String(groupId);
}

export function validateWorkout(body) {
  if (!body || typeof body !== 'object') return 'A workout is required.';
  const { name, date, durationMinutes, notes = '', muscleGroupIds } = body;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100)
    return 'Workout name must be between 1 and 100 characters.';
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return 'Enter a valid workout date.';
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date || Number(date.slice(0, 4)) < 1000)
    return 'Enter a valid workout date.';
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440)
    return 'Duration must be a whole number between 1 and 1440 minutes.';
  if (typeof notes !== 'string' || notes.length > 2000)
    return 'Notes must be at most 2000 characters.';
  if (!Array.isArray(muscleGroupIds) || muscleGroupIds.length < 1 || muscleGroupIds.length > 50 ||
      muscleGroupIds.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(muscleGroupIds).size !== muscleGroupIds.length)
    return 'Select one or more unique muscle groups.';
  return null;
}

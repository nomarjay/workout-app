export async function persistRoutine(request, { name, draft, editingId = '' }) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new Error('Enter a workout name (up to 100 characters).');
  if (!Array.isArray(draft) || !draft.length || draft.length > 100) throw new Error('Add 1–100 exercises to your workout bag.');
  return request(editingId ? `/api/workouts/${encodeURIComponent(editingId)}` : '/api/workouts', {
    method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), selections: draft.map(exercise => ({ exerciseId: exercise.exerciseId || exercise.id, equipmentOptionKey: exercise.equipmentOptionKey, attachment: exercise.attachment ?? null })) }),
  });
}
export function routineSaveDestination({ fromExercises = false, returnToPlanner = false, isEditing = false } = {}) {
  return !fromExercises && returnToPlanner && !isEditing ? 'dashboard' : 'workouts';
}

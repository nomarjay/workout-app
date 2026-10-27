import { persistRoutine } from './routineSave.js';

// Retain the saved ID if plan saving fails so retrying updates the same routine.
export function createDraftTrainerSaver(request, onRoutineSaved = () => {}) {
  let savedId = '';
  return async ({ name, draft, editingId = '', plan }) => {
    const workout = await persistRoutine(request, { name, draft, editingId: savedId || editingId });
    savedId = workout.id;
    onRoutineSaved(workout);
    await request(`/api/trainer-mode/${encodeURIComponent(workout.id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plan),
    });
    return workout;
  };
}

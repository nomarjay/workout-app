// Run with API_BASE_URL pointing at the running app, e.g. http://localhost:5173.
const base = (process.env.API_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
async function request(path, method = 'GET', body) {
  const response = await fetch(`${base}/api/${path}`, {
    method, signal: AbortSignal.timeout(15000),
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`${method} /api/${path} failed (${response.status}): ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
try {
  const [schedules, workouts, profile, logs] = await Promise.all([
    request('schedule'), request('workouts'), request('profile'), request('workout-logs'),
  ]);
  const sessions = ['2026-10-14', '2026-10-16'].map(date => {
    const schedule = schedules.find(item => item.date === date);
    const workout = workouts.find(item => item.id === schedule?.workoutId);
    if (!workout?.exercises?.length) throw new Error(`No available scheduled workout for ${date}.`);
    return { date, workout };
  });
  for (const { date, workout } of sessions) {
    if (logs.some(item => item.scheduledDate === date && item.workoutId === workout.id)) {
      console.log(`${date}: already logged; skipped.`);
      continue;
    }
    const log = await request('workout-logs', 'POST', {
      workoutId: workout.id, scheduledDate: date, completedDate: date,
      selections: workout.exercises.map(item => ({ exerciseId: item.exerciseId, equipmentOptionKey: item.equipmentOptionKey, attachment: item.attachment ?? null })),
    });
    if (log.completedAt !== date) throw new Error('The API needs restarting to support historical completion dates. A log was created; check it before retrying.');
    console.log(`${date}: logged ${workout.name}.`);
  }
  if (profile) {
    await request('profile', 'PUT', profile);
    console.log('Saved existing client profile.');
  }
  const saved = await request('workout-logs');
  for (const { date, workout } of sessions) {
    if (!saved.some(item => item.scheduledDate === date && item.workoutId === workout.id)) throw new Error(`Could not verify log for ${date}.`);
  }
  console.log('Both historical workout logs verified in the API.');
} catch (error) {
  console.error(`Import failed: ${error.message}`);
  process.exitCode = 1;
}

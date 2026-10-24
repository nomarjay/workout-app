import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { createApp } from '../src/app.js';
import { memoryDb } from './helpers/memory-db.js';
import { validDate } from '../src/dashboard-routes.js';
import { ageOnDate, calendarDays, dateFromKey, estimatedMinutes, localDate, weekBounds, primaryMusclesFor } from '../../ui/src/utils/dashboard.js';

async function withApi(run) {
  const db = memoryDb();
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (path, method = 'GET', body) => fetch(`${base}/${path}`, {
    method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  try { await run(request, db); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
const profileBody = { name: ' Taylor Client ', email: 'taylor@example.com', birthDate: '1994-10-15', gender: '',
  heightCm: 175, weightKg: 72.5, goal: 'Build strength', experience: 'Intermediate', activityLevel: 'Moderately active', weeklyTarget: 3 };

test('profile CRUD validates client information and preserves unrelated workouts and schedules', async () => {
  await withApi(async (request, db) => {
    assert.equal(await (await request('profile')).json(), null);
    assert.equal((await request('profile', 'PUT', profileBody)).status, 404);
    assert.equal((await request('profile', 'DELETE')).status, 404);
    for (const invalid of [{ name: ' ' }, { email: 'not-an-email' }, { birthDate: '2025-02-29' }, { birthDate: '2999-01-01' }, { birthDate: 123 }, { birthDate: false },
      { heightCm: 20 }, { weightKg: -1 }, { weightKg: '72' }, { weeklyTarget: 8 }, { weeklyTarget: 2.5 }, { goal: 'unknown' }, { experience: 'unknown' }, { activityLevel: 'unknown' }]) {
      assert.equal((await request('profile', 'POST', { ...profileBody, ...invalid })).status, 400, JSON.stringify(invalid));
    }
    const response = await request('profile', 'POST', { ...profileBody, id: 'injected', createdAt: 'injected' });
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.id, 'primary');
    assert.equal(created.name, 'Taylor Client');
    assert.notEqual(created.createdAt, 'injected');
    assert.equal((await request('profile', 'POST', profileBody)).status, 409);
    const update = await request('profile', 'PUT', { ...profileBody, name: 'Updated Client', email: '', birthDate: null, heightCm: null, weightKg: null, weeklyTarget: 4 });
    assert.equal(update.status, 200);
    const edited = await update.json();
    assert.equal(edited.createdAt, created.createdAt);
    assert.ok(edited.updatedAt);
    assert.equal(edited.weightKg, null);
    assert.equal(edited.email, '');
    assert.equal((await (await request('profile')).json()).weeklyTarget, 4);
    db.records.workouts.push({ _id: new ObjectId(), name: 'Keep this workout', exercises: [] });
    db.records.workout_schedule.push({ _id: '2026-10-14', workoutId: String(db.records.workouts[0]._id) });
    assert.equal((await request('profile', 'DELETE')).status, 204);
    assert.equal(await (await request('profile')).json(), null);
    assert.equal(db.records.workouts.length, 1);
    assert.equal(db.records.workout_schedule.length, 1);
    assert.equal((await request('profile', 'POST', profileBody)).status, 201);
  });
});

test('calendar schedule persists one saved workout per date, supports duration edits, and cleans deleted workout references', async () => {
  await withApi(async (request, db) => {
    const id = new ObjectId();
    const anotherId = new ObjectId();
    db.records.workouts.push({ _id: id, name: 'Push day', exercises: [] }, { _id: anotherId, name: 'Pull day', exercises: [] });
    const body = { workoutId: String(id), durationMinutes: null };
    assert.deepEqual(await (await request('schedule')).json(), []);
    assert.equal((await request('schedule/2026-02-30', 'PUT', body)).status, 400);
    assert.equal((await request('schedule/not-a-date', 'DELETE')).status, 400);
    assert.equal((await request('schedule/2026-10-14', 'PUT', { workoutId: 'missing' })).status, 400);
    assert.equal((await request('schedule/2026-10-14', 'PUT', { workoutId: String(new ObjectId()) })).status, 404);
    for (const durationMinutes of [0, 301, 30.5, '30']) assert.equal((await request('schedule/2026-10-14', 'PUT', { ...body, durationMinutes })).status, 400);
    const response = await request('schedule/2026-10-14', 'PUT', body);
    assert.equal(response.status, 200);
    const scheduled = await response.json();
    assert.equal(scheduled.date, '2026-10-14');
    assert.equal(scheduled.durationMinutes, null);
    assert.equal(scheduled.intensity, null);
    assert.equal(scheduled.workoutId, String(id));
    const createdAt = db.records.workout_schedule[0].createdAt;
    assert.equal((await request('schedule/2026-10-14', 'PUT', { workoutId: String(anotherId), durationMinutes: 45, intensity: 'Moderate' })).status, 200);
    const list = await (await request('schedule')).json();
    assert.equal(list.length, 1);
    assert.equal(list[0].durationMinutes, 45);
    assert.equal(list[0].intensity, 'Moderate');
    assert.equal((await request('schedule/2026-10-14', 'PUT', { ...body, intensity: 'Extreme' })).status, 400);
    assert.equal(list[0].workoutId, String(anotherId));
    assert.equal(list[0].createdAt, createdAt);
    await request('schedule/2026-10-15', 'PUT', { workoutId: String(anotherId) });
    await request('schedule/2026-10-16', 'PUT', body);
    assert.equal((await request(`workouts/${anotherId}`, 'DELETE')).status, 204);
    assert.deepEqual((await (await request('schedule')).json()).map(item => item.date), ['2026-10-16']);
    assert.equal((await request('schedule/2026-10-16', 'DELETE')).status, 204);
    assert.equal((await request('schedule/2026-10-16', 'DELETE')).status, 404);
  });
});

test('agenda primary muscles combine the saved selections without including secondary muscles', () => {
  assert.deepEqual(primaryMusclesFor({ exercises: [
    { primaryMuscles: [' Pectoralis Major ', 'Anterior  Deltoids'], secondaryMuscles: ['Triceps'] },
    { primaryMuscles: ['pectoralis major', 'Biceps'] },
    { secondaryMuscles: ['Forearms'] },
  ] }), ['Pectoralis Major', 'Anterior Deltoids', 'Biceps']);
  assert.deepEqual(primaryMusclesFor(null), []);
});

test('dashboard dates handle leap years, month boundaries, birthdays, and local calendar days', () => {
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2026-13-01'), false);
  assert.equal(validDate('2026-1-1'), false);
  const february = calendarDays(2024, 1);
  assert.equal(february.length, 42);
  assert.equal(february[0].date, '2024-01-28');
  assert.equal(february.filter(day => day.inMonth).length, 29);
  assert.equal(february.find(day => day.date === '2024-02-29').day, 29);
  assert.equal(new Set(february.map(day => day.date)).size, 42);
  assert.equal(localDate(new Date(2026, 9, 14, 23, 59)), '2026-10-14');
  assert.equal(localDate(dateFromKey('2026-10-14')), '2026-10-14');
  assert.equal(ageOnDate('1994-10-15', '2026-10-14'), 31);
  assert.equal(ageOnDate('1994-10-15', '2026-10-15'), 32);
  assert.equal(ageOnDate(null, '2026-10-14'), null);
  assert.deepEqual(weekBounds('2026-01-01'), { start: '2025-12-29', end: '2026-01-04' });
  assert.equal(estimatedMinutes({ exercises: [{}, {}, {}, {}, {}] }), 40);
});


test('repeating schedules clamp monthly dates and reject conflicts before writing', async () => {
  await withApi(async (request, db) => {
    const id = new ObjectId();
    db.records.workouts.push({ _id: id, name: 'Repeat', exercises: [] });
    const body = { workoutId: String(id), frequency: 'monthly', until: '2027-03-31' };
    assert.equal((await request('schedule/2027-01-31', 'PUT', body)).status, 200);
    assert.deepEqual((await (await request('schedule')).json()).map(item => item.date), ['2027-01-31', '2027-02-28', '2027-03-31']);
    assert.equal((await request('schedule/2027-01-30', 'PUT', { ...body, frequency: 'daily' })).status, 409);
    assert.equal(db.records.workout_schedule.length, 3);
    assert.equal((await request('schedule/2027-01-01', 'PUT', { ...body, until: '2029-01-01' })).status, 400);
    for (const [frequency, count] of [['daily', 29], ['weekly', 5], ['biweekly', 3]]) {
      db.records.workout_schedule.length = 0;
      assert.equal((await request('schedule/2027-01-01', 'PUT', { ...body, frequency, until: '2027-01-29' })).status, 200);
      assert.equal(db.records.workout_schedule.length, count);
    }
  });
});

test('completed sessions snapshot actual equipment and survive routine deletion', async () => {
  await withApi(async (request, db) => {
    const catalog = await (await request('catalog')).json();
    const exercise = catalog.exercises[0];
    const id = new ObjectId();
    db.records.workouts.push({ _id: id, name: 'Completed routine', exercises: [] });
    const body = { workoutId: String(id), scheduledDate: '2026-10-18', selections: [{ exerciseId: exercise.exerciseId, equipmentOptionKey: exercise.equipmentOptionKey, attachment: null }] };
    assert.equal((await request('workout-logs', 'POST', { ...body, selections: [{ ...body.selections[0], attachment: 'Invalid attachment' }] })).status, 400);
    assert.equal((await request('workout-logs', 'POST', { ...body, completedDate: '2026-02-30' })).status, 400);
    const response = await request('workout-logs', 'POST', { ...body, completedDate: '2026-10-14' });
    assert.equal(response.status, 201);
    const log = await response.json();
    assert.equal(log.completedAt, '2026-10-14');
    assert.equal(log.exercises[0].equipmentOptionKey, exercise.equipmentOptionKey);
    assert.equal(log.exercises[0].attachment, null);
    assert.equal(db.records.workouts[0].exercises.length, 0);
    await request(`workouts/${id}`, 'DELETE');
    const history = await (await request('workout-logs')).json();
    assert.equal(history[0].name, 'Completed routine');
    assert.equal(history[0].exercises[0].name, exercise.name);
  });
});


test('deleting a workout log preserves other history, routines, schedules, and profile', async () => {
  await withApi(async (request, db) => {
    const first = new ObjectId();
    const second = new ObjectId();

    await db.collection('workout_logs').insertOne({ _id: first, name: 'Delete this', completedAt: '2026-10-14T16:00:00Z' });
    await db.collection('workout_logs').insertOne({ _id: second, name: 'Keep this', completedAt: '2026-10-16T16:00:00Z' });
    db.records.workouts.push({ _id: new ObjectId(), name: 'Routine' });
    db.records.workout_schedule.push({ _id: '2026-10-14' });
    db.records.profiles.push({ _id: 'primary', name: 'Saved profile' });
    assert.equal((await request('workout-logs/invalid', 'DELETE')).status, 400);
    assert.equal((await request(`workout-logs/${first}`, 'DELETE')).status, 204);
    assert.equal((await request(`workout-logs/${first}`, 'DELETE')).status, 404);
    const logs = await (await request('workout-logs')).json();
    assert.deepEqual(logs.map(item => item.id), [String(second)]);
    assert.equal(db.records.workouts.length, 1);
    assert.equal(db.records.workout_schedule.length, 1);
    assert.equal(db.records.profiles[0].name, 'Saved profile');
  });
});



test('frequency edits replace following series dates and preserve earlier dates and conflicts', async () => {
  await withApi(async (request, db) => {
    const id = new ObjectId();
    db.records.workouts.push({ _id: id, name: 'Series', exercises: [] });
    const body = { workoutId: String(id), frequency: 'weekly', until: '2026-11-30' };
    assert.equal((await request('schedule/2026-11-02', 'PUT', body)).status, 200);
    const first = await (await request('schedule')).json();
    assert.equal(new Set(first.map(item => item.seriesId)).size, 1);
    assert.equal((await request('schedule/2026-11-09', 'PUT', { ...body, frequency: 'biweekly', scope: 'future' })).status, 200);
    let dates = await (await request('schedule')).json();
    assert.deepEqual(dates.map(item => item.date).sort(), ['2026-11-02', '2026-11-09', '2026-11-23']);
    assert.equal(dates.find(item => item.date === '2026-11-09').frequency, 'biweekly');
    await request('schedule/2026-11-16', 'PUT', { workoutId: String(id) });
    assert.equal((await request('schedule/2026-11-09', 'PUT', { ...body, scope: 'future' })).status, 409);
    dates = await (await request('schedule')).json();
    assert.equal(dates.find(item => item.date === '2026-11-09').frequency, 'biweekly');
    assert.equal((await request('schedule/2026-11-09?scope=future', 'DELETE')).status, 204);
    assert.deepEqual((await (await request('schedule')).json()).map(item => item.date).sort(), ['2026-11-02', '2026-11-16']);
    await request('schedule/2026-11-02', 'PUT', { ...body, scope: 'future', frequency: 'none' });
    assert.equal((await (await request('schedule')).json()).find(item => item.date === '2026-11-02').seriesId, null);
  });
});

test('multiple profiles keep calendars and logs separate while preserving legacy primary records', async () => {
  const db = memoryDb();
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = (path, profile = 'primary', method = 'GET', body) => fetch(`${base}/${path}`, { method, headers: { 'Content-Type': 'application/json', 'X-Profile-Id': profile }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    await call('profile', 'primary', 'POST', profileBody);
    const response = await call('profiles', 'primary', 'POST', { ...profileBody, name: 'Second user' });
    assert.equal(response.status, 201);
    const second = await response.json();
    assert.equal((await (await call('profiles')).json()).length, 2);
    assert.equal((await (await call('profile', second.id)).json()).name, 'Second user');
    const id = new ObjectId();
    db.records.workouts.push({ _id: id, name: 'Shared routine', exercises: [] });
    db.records.workout_schedule.push({ _id: '2026-10-14', workoutId: String(id) });
    assert.deepEqual(await (await call('schedule', second.id)).json(), []);
    await call('schedule/2026-10-14', second.id, 'PUT', { workoutId: String(id) });
    assert.equal((await (await call('schedule')).json()).length, 1);
    assert.equal((await (await call('schedule', second.id)).json()).length, 1);
    await call('schedule/2026-10-14', second.id, 'DELETE');
    assert.equal((await (await call('schedule')).json()).length, 1);
    const catalog = await (await call('catalog')).json();
    const exercise = catalog.exercises[0];
    const logBody = { workoutId: String(id), scheduledDate: '2026-10-14', selections: [{ exerciseId: exercise.exerciseId, equipmentOptionKey: exercise.equipmentOptionKey, attachment: null }] };
    const log = await (await call('workout-logs', second.id, 'POST', logBody)).json();
    assert.equal((await (await call('workout-logs')).json()).length, 0);
    assert.equal((await (await call('workout-logs', second.id)).json()).length, 1);
    assert.equal((await call(`workout-logs/${log.id}`, 'primary', 'DELETE')).status, 404);
    await call('profile', second.id, 'PUT', { ...profileBody, name: 'Updated second user' });
    assert.equal((await (await call('profile')).json()).name, 'Taylor Client');
    await call('profile', second.id, 'DELETE');
    assert.equal((await (await call('profiles')).json()).length, 1);
    assert.equal((await (await call('profile')).json()).name, 'Taylor Client');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

import { ObjectId } from 'mongodb';
import { readCatalog } from './catalog-store.js';

const goals = ['General fitness', 'Build strength', 'Build muscle', 'Improve endurance', 'Weight management', 'Mobility'];
const levels = ['Beginner', 'Intermediate', 'Advanced'];
const activityLevels = ['Mostly sedentary', 'Lightly active', 'Moderately active', 'Very active'];
const genders = ['', 'Female', 'Male', 'Nonbinary', 'Prefer not to say'];
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function profileRecord(body) {
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) throw new Error('Enter a name up to 100 characters.');
  const email = body.email ?? '';
  if (typeof email !== 'string' || email.length > 254 || (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) throw new Error('Enter a valid email address or leave it blank.');
  const birthDate = body.birthDate == null || body.birthDate === '' ? null : body.birthDate;
  if (birthDate !== null && (!validDate(birthDate) || birthDate < '1900-01-01' || birthDate > new Date().toISOString().slice(0, 10))) throw new Error('Enter a valid date of birth that is not in the future.');
  const measurement = (value, min, max, label) => {
    if (value == null || value === '') return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Enter ${label} between ${min} and ${max}, or leave it blank.`);
    return value;
  };
  if (!goals.includes(body.goal) || !levels.includes(body.experience) || !activityLevels.includes(body.activityLevel) || !genders.includes(body.gender ?? '')) throw new Error('Choose a valid goal, experience, activity level, and gender.');
  if (!Number.isInteger(body.weeklyTarget) || body.weeklyTarget < 1 || body.weeklyTarget > 7) throw new Error('Choose a weekly target from 1 to 7 workouts.');
  return { name: body.name.trim(), email: email.trim(), birthDate, gender: body.gender || '',
    heightCm: measurement(body.heightCm, 50, 250, 'height in cm'), weightKg: measurement(body.weightKg, 10, 500, 'weight in kg'),
    goal: body.goal, experience: body.experience, activityLevel: body.activityLevel, weeklyTarget: body.weeklyTarget };
}

export function registerDashboardRoutes(app, db) {
  const profiles = db.collection('profiles');
  const schedules = db.collection('workout_schedule');
  const profileId = req => req.get('X-Profile-Id') || 'primary';
  const owns = (record, req) => (record.profileId || 'primary') === profileId(req);
  const scheduleKey = (req, date) => profileId(req) === 'primary' ? date : `${profileId(req)}:${date}`;
  app.get('/api/profiles', async (_req, res) => {
    const records = await profiles.find({}).sort({ name: 1 }).toArray();
    res.json(records.map(({ _id, name }) => ({ id: String(_id), name })));
  });
  app.post('/api/profiles', async (req, res) => {
    let record;
    try { record = profileRecord(req.body || {}); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const profile = { ...record, _id: String(new ObjectId()), createdAt: new Date().toISOString() };
    await profiles.insertOne(profile);
    res.status(201).json(publicProfile(profile));
  });
  const publicProfile = ({ _id, ...record }) => ({ ...record, id: String(_id) });
  const logs = db.collection('workout_logs');
  app.get('/api/workout-logs', async (req, res) => {
    const records = await logs.find({}).sort({ completedAt: -1 }).toArray();
    res.json(records.filter(record => owns(record, req)).map(({ _id, ...record }) => ({ ...record, id: String(_id) })));
  });
  app.delete('/api/workout-logs/:id', async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid log ID.' });
    const existing = await logs.findOne({ _id: new ObjectId(req.params.id) });
    if (!existing || !owns(existing, req)) return res.status(404).json({ error: 'Logged workout not found.' });
    const result = await logs.deleteOne({ _id: existing._id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Logged workout not found.' });
    res.sendStatus(204);
  });
  app.post('/api/workout-logs', async (req, res) => {
    const { workoutId, scheduledDate, selections, completedDate = null } = req.body || {};
    if (completedDate !== null && !validDate(completedDate)) return res.status(400).json({ error: 'Choose a valid completion date.' });
    if (typeof workoutId !== 'string' || !/^[a-f\d]{24}$/i.test(workoutId) || !validDate(scheduledDate) || !Array.isArray(selections) || !selections.length || selections.length > 100) return res.status(400).json({ error: 'Choose a workout, date, and 1–100 exercises.' });
    const workout = await db.collection('workouts').findOne({ _id: new ObjectId(workoutId) });
    if (!workout) return res.status(404).json({ error: 'Workout not found.' });
    const catalog = await readCatalog(db);
    const exercises = [];
    for (const choice of selections) {
      const exercise = choice && catalog.exercises.find(item => item.exerciseId === choice.exerciseId && item.equipmentOptionKey === choice.equipmentOptionKey);
      if (!exercise) return res.status(400).json({ error: 'Choose an available exercise and equipment option.' });
      const attachment = choice.attachment ?? null;
      const allowed = catalog.equipment.find(item => String(item.id) === String(exercise.equipmentId))?.attachmentIds || [];
      if (attachment !== null && !catalog.attachments.some(item => item.name === attachment && allowed.some(id => String(id) === String(item.id)))) return res.status(400).json({ error: 'Choose an attachment supported by this equipment.' });
      exercises.push({ ...exercise, attachment });
    }
    const record = { profileId: profileId(req), workoutId, scheduledDate, name: workout.name, exercises, completedAt: completedDate ?? new Date().toISOString() };
    const result = await logs.insertOne(record);
    res.status(201).json({ ...record, id: String(result.insertedId) });
  });
  app.get('/api/profile', async (req, res) => {
    const profile = await profiles.findOne({ _id: profileId(req) });
    res.json(profile ? publicProfile(profile) : null);
  });
  const saveProfile = async (req, res) => {
    let record;
    try { record = profileRecord(req.body || {}); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const previous = await profiles.findOne({ _id: profileId(req) });
    if (req.method === 'POST') {
      if (previous) return res.status(409).json({ error: 'A profile already exists. Edit the existing profile.' });
      const profile = { ...record, _id: profileId(req), createdAt: new Date().toISOString() };
      try { await profiles.insertOne(profile); }
      catch (error) { if (error.code === 11000) return res.status(409).json({ error: 'A profile already exists. Refresh to load it.' }); throw error; }
      return res.status(201).json(publicProfile(profile));
    }
    if (!previous) return res.status(404).json({ error: 'Profile not found. Create a profile first.' });
    const updated = await profiles.findOneAndUpdate({ _id: profileId(req) }, { $set: { ...record, updatedAt: new Date().toISOString() } }, { returnDocument: 'after' });
    if (!updated) return res.status(404).json({ error: 'Profile not found.' });
    res.json(publicProfile(updated));
  };
  app.post('/api/profile', saveProfile);
  app.put('/api/profile', saveProfile);
  app.delete('/api/profile', async (req, res) => {
    const result = await profiles.deleteOne({ _id: profileId(req) });
    if (!result.deletedCount) return res.status(404).json({ error: 'Profile not found.' });
    res.sendStatus(204);
  });
  app.get('/api/schedule', async (req, res) => {
    const records = await schedules.find({}).sort({ _id: 1 }).toArray();
    res.json(records.filter(record => owns(record, req)).map(({ _id, ...record }) => ({ ...record, date: record.date || String(_id) })));
  });
  app.put('/api/schedule/:date', async (req, res) => {
    const date = req.params.date;
    if (!validDate(date)) return res.status(400).json({ error: 'Choose a valid calendar date.' });
    const { workoutId, durationMinutes = null, intensity = null, frequency = 'none', until = null, scope = 'single' } = req.body || {};
    if (intensity !== null && !['Low', 'Moderate', 'High'].includes(intensity)) return res.status(400).json({ error: 'Choose Low, Moderate, or High intensity, or leave it unset.' });
    if (typeof workoutId !== 'string' || !/^[a-f\d]{24}$/i.test(workoutId)) return res.status(400).json({ error: 'Choose a saved workout.' });
    if (durationMinutes != null && (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 300)) return res.status(400).json({ error: 'Enter a planned duration from 5 to 300 minutes, or use the automatic estimate.' });
    if (!await db.collection('workouts').findOne({ _id: new ObjectId(workoutId) })) return res.status(404).json({ error: 'Workout not found. Refresh your library.' });
    if (!['none', 'daily', 'weekly', 'biweekly', 'monthly'].includes(frequency)) return res.status(400).json({ error: 'Choose a valid repeat frequency.' });
    if (frequency !== 'none' && (!validDate(until) || until < date || Number(new Date(until)) - Number(new Date(date)) > 366 * 86400000)) return res.status(400).json({ error: 'Choose a repeat end date within one year of the first session.' });
    if (!['single', 'future'].includes(scope)) return res.status(400).json({ error: 'Choose this session or this and following sessions.' });
    const previous = await schedules.findOne({ _id: scheduleKey(req, date) });
    const existing = (await schedules.find({}).sort({ _id: 1 }).toArray()).filter(item => owns(item, req));
    const replaced = scope === 'future' && previous?.seriesId
      ? existing.filter(item => item.seriesId === previous.seriesId && (item.date || String(item._id)) >= date) : [];
    const dates = [date];
    if (frequency !== 'none') {
      const start = new Date(`${date}T12:00:00Z`);
      for (let index = 1; ; index++) {
        const next = new Date(start);
        if (frequency === 'monthly') {
          next.setUTCDate(1);
          next.setUTCMonth(start.getUTCMonth() + index);
          const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
          next.setUTCDate(Math.min(start.getUTCDate(), last));
        } else next.setUTCDate(start.getUTCDate() + index * ({ daily: 1, weekly: 7, biweekly: 14 }[frequency]));
        const key = next.toISOString().slice(0, 10);
        if (key > until) break;
        dates.push(key);
      }
      if (existing.some(item => dates.slice(1).includes(item.date || String(item._id)) && !replaced.some(old => String(old._id) === String(item._id)))) return res.status(409).json({ error: 'A repeating date already has a workout. Choose a different range or remove that session first.' });
    }
    const record = { profileId: profileId(req), seriesId: frequency === 'none' ? null : String(new ObjectId()), frequency, until: frequency === 'none' ? null : until, workoutId: String(new ObjectId(workoutId)), durationMinutes, intensity, updatedAt: new Date().toISOString() };
    await schedules.bulkWrite(dates.map(day => ({ updateOne: { filter: { _id: scheduleKey(req, day) }, update: { $set: { ...record, date: day }, $setOnInsert: { createdAt: record.updatedAt } }, upsert: true } })));
    for (const old of replaced) {
      if (!dates.includes(old.date || String(old._id))) await schedules.deleteOne({ _id: old._id });
    }
    res.json({ ...record, date });
  });
  app.delete('/api/schedule/:date', async (req, res) => {
    if (!validDate(req.params.date)) return res.status(400).json({ error: 'Choose a valid calendar date.' });
    if (req.query.scope && !['single', 'future'].includes(req.query.scope)) return res.status(400).json({ error: 'Invalid deletion scope.' });
    const current = await schedules.findOne({ _id: scheduleKey(req, req.params.date) });
    if (current?.seriesId && req.query.scope === 'future') {
      const records = await schedules.find({}).sort({ _id: 1 }).toArray();
      for (const item of records.filter(item => owns(item, req) && item.seriesId === current.seriesId && (item.date || String(item._id)) >= req.params.date)) await schedules.deleteOne({ _id: item._id });
      return res.sendStatus(204);
    }
    const result = await schedules.deleteOne({ _id: scheduleKey(req, req.params.date) });
    if (!result.deletedCount) return res.status(404).json({ error: 'No workout is scheduled for this date.' });
    res.sendStatus(204);
  });
}

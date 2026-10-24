import express from 'express';
import { ObjectId } from 'mongodb';
import { fileURLToPath } from 'node:url';
import { referenceLists, hydrateReferences } from '../data/catalog.js';
import { readCatalog, registerCatalogRoutes } from './catalog-store.js';
import { registerDashboardRoutes } from './dashboard-routes.js';
import { registerTrainerModeRoutes } from './trainer-mode-routes.js';

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', async (_req, res) => {
    await db.command({ ping: 1 });
    res.json({ status: 'ok' });
  });
  app.get('/api/muscle-groups', (_req, res) => res.json(referenceLists.groups));
  app.get('/api/catalog', async (_req, res) => res.json(await readCatalog(db)));
  registerCatalogRoutes(app, db);
  registerDashboardRoutes(app, db);
  registerTrainerModeRoutes(app, db);
  app.get('/api/workouts', async (_req, res) => {
    const records = await db.collection('workouts').find({}).sort({ createdAt: -1 }).toArray();
    const catalog = await readCatalog(db);
    res.json(records.map(({ _id, ...record }) => ({ ...record, exercises: record.exercises?.map(item => hydrateReferences(item, catalog)), id: String(_id) })));
  });
  const saveWorkout = async (req, res) => {
    if (req.params.id && !/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid workout ID.' });
    const { name, exerciseIds, selections } = req.body || {};
    const choices = selections ?? (Array.isArray(exerciseIds) ? exerciseIds.map(exerciseId => ({ exerciseId })) : null);
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
      !Array.isArray(choices) || !choices.length || choices.length > 100 ||
      choices.some(item => !item || typeof item.exerciseId !== 'string' ||
        (item.equipmentOptionKey != null && typeof item.equipmentOptionKey !== 'string') ||
        (item.attachment != null && typeof item.attachment !== 'string'))) {
      return res.status(400).json({ error: 'Enter a name (up to 100 characters) and select 1–100 exercises with valid attachments.' });
    }
    const references = await readCatalog(db);
    const catalog = references.exercises;
    const attachments = references.attachments;
    const selected = [];
    for (const choice of choices) {
      const exercise = catalog.find(item => choice.equipmentOptionKey != null
        ? item.exerciseId === choice.exerciseId && item.equipmentOptionKey === choice.equipmentOptionKey
        : item.id === choice.exerciseId);
      if (!exercise) return res.status(400).json({ error: 'An exercise no longer exists. Refresh the catalog.' });
      const attachment = Object.hasOwn(choice, 'attachment') ? choice.attachment : exercise.attachment;
      const attachmentRecord = attachments.find(item => item.name === attachment);
      const allowed = references.equipment.find(item => String(item.id) === String(exercise.equipmentId))?.attachmentIds || [];
      if (attachment != null && (!attachmentRecord || !allowed.includes(attachmentRecord.id))) {
        return res.status(400).json({ error: 'Select an attachment supported by the selected equipment.' });
      }
      const { equipmentOptions, equipment, 'equipment-type': equipmentType, attachment: defaultAttachment, ...snapshot } = exercise;
      selected.push({ ...snapshot, attachmentId: attachment == null ? null : attachments.find(item => item.name === attachment).id });
    }
    if (req.params.id) {
      const workout = await db.collection('workouts').findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: { name: name.trim(), exercises: selected, updatedAt: new Date().toISOString() } },
        { returnDocument: 'after' },
      );
      if (!workout) return res.status(404).json({ error: 'Workout not found.' });
      const { _id, ...record } = workout;
      return res.json({ ...record, exercises: selected.map(item => hydrateReferences(item, references)), id: String(_id) });
    }
    const workout = { name: name.trim(), exercises: selected, createdAt: new Date().toISOString() };
    const result = await db.collection('workouts').insertOne(workout);
    res.status(201).json({ ...workout, exercises: selected.map(item => hydrateReferences(item, references)), id: String(result.insertedId) });
  };
  app.post('/api/workouts', saveWorkout);
  app.put('/api/workouts/:id', saveWorkout);
  app.delete('/api/workouts/:id', async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid workout ID.' });
    const result = await db.collection('workouts').deleteOne({ _id: new ObjectId(req.params.id) });
    if (!result.deletedCount) return res.status(404).json({ error: 'Workout not found.' });
    await db.collection('workout_schedule').deleteMany({ workoutId: String(new ObjectId(req.params.id)) });
    await db.collection('trainer_mode').deleteOne({ _id: String(new ObjectId(req.params.id)) });
    res.sendStatus(204);
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use(express.static(fileURLToPath(new URL('../../ui/dist', import.meta.url))));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    console.error(error);
    res.status(500).json({ error: 'The request failed. Check that MongoDB is running and configured.' });
  });
  return app;
}





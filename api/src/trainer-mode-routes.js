import { defaultTrainerAlgorithm, validateAlgorithm } from '../../ui/src/utils/trainerAlgorithms.js';
import { ObjectId } from 'mongodb';
import { calculateTrainerWorkout, trainerPrescription, trainerTempos, workoutSignature } from './trainer-mode.js';

export function registerTrainerModeRoutes(app, db) {
  const plans = db.collection('trainer_mode');
  app.get('/api/trainer-mode', (_req, res) => res.json({ weightUnits: ['kg', 'lb'], tempos: trainerTempos }));

  const algorithms = db.collection('trainer_algorithms');
  app.get('/api/trainer-algorithms', async (_req, res) => {
    const saved = await algorithms.find({}).sort({ name: 1 }).toArray();
    res.json([defaultTrainerAlgorithm, ...saved.map(({ _id, ...record }) => ({ ...record, id: String(_id) }))]);
  });
  const saveAlgorithm = async (req, res) => {
    if (req.params.id && !/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'The built-in default cannot be changed. Save a copy instead.' });
    let algorithm;
    try { algorithm = validateAlgorithm(req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const { id, ...record } = algorithm;
    if (req.params.id) {
      const updated = await algorithms.findOneAndUpdate({ _id: new ObjectId(req.params.id) }, { $set: record }, { returnDocument: 'after' });
      if (!updated) return res.status(404).json({ error: 'Algorithm not found.' });
      return res.json({ ...record, id: req.params.id });
    }
    const result = await algorithms.insertOne(record);
    res.status(201).json({ ...record, id: String(result.insertedId) });
  };
  app.post('/api/trainer-algorithms', saveAlgorithm);
  app.put('/api/trainer-algorithms/:id', saveAlgorithm);
  const path = '/api/trainer-mode/:workoutId';
  app.use(path, async (req, res, next) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.workoutId)) return res.status(400).json({ error: 'Invalid workout ID.' });
    const workout = await db.collection('workouts').findOne({ _id: new ObjectId(req.params.workoutId) });
    if (!workout) return res.status(404).json({ error: 'Workout not found.' });
    res.locals.workout = workout;
    res.locals.workoutId = String(workout._id);
    next();
  });
  const publicPlan = (plan, workout) => {
    const { _id, ...record } = plan;
    return { ...record, workoutId: String(_id), needsReview: record.workoutSignature !== workoutSignature(workout) };
  };
  app.get(path, async (_req, res) => {
    const plan = await plans.findOne({ _id: res.locals.workoutId });
    if (!plan) return res.status(404).json({ error: 'Trainer Mode has not been assigned to this workout.' });
    res.json(publicPlan(plan, res.locals.workout));
  });
  app.put(path, async (req, res) => {
    let prescription;
    try { prescription = trainerPrescription(req.body, res.locals.workout); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const updatedAt = new Date().toISOString();
    await plans.updateOne({ _id: res.locals.workoutId }, {
      $set: { ...prescription, workoutSignature: workoutSignature(res.locals.workout), updatedAt },
      $setOnInsert: { createdAt: updatedAt },
    }, { upsert: true });
    res.json(publicPlan(await plans.findOne({ _id: res.locals.workoutId }), res.locals.workout));
  });
  app.post(`${path}/calculate`, async (req, res) => {
    const plan = await plans.findOne({ _id: res.locals.workoutId });
    if (!plan) return res.status(404).json({ error: 'Trainer Mode has not been assigned to this workout.' });
    if (plan.workoutSignature !== workoutSignature(res.locals.workout)) {
      return res.status(409).json({ error: 'Workout exercises changed. Review and reassign Trainer Mode before calculating.' });
    }
    const profile = await db.collection('profiles').findOne({ _id: req.get('X-Profile-Id') || 'primary' });
    res.json({ workoutId: res.locals.workoutId, ...calculateTrainerWorkout({ ...plan, exercises: plan.exercises.map(item => ({ ...item, equipmentId: res.locals.workout.exercises[item.exerciseIndex].equipmentId ?? item.equipmentId })) }, profile) });
  });
  app.delete(path, async (_req, res) => {
    const result = await plans.deleteOne({ _id: res.locals.workoutId });
    if (!result.deletedCount) return res.status(404).json({ error: 'Trainer Mode has not been assigned to this workout.' });
    res.sendStatus(204);
  });
}

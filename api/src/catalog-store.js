import { randomUUID } from 'node:crypto';
import { referenceLists, expandExerciseDocuments } from '../data/catalog.js';

export async function readCatalog(db) {
  const read = async name => (await db.collection(name).find({}).sort({ name: 1 }).toArray())
    .map(({ _id, ...record }) => ({ ...record, id: String(_id) }));
  const [storedEquipment, storedExercises] = await Promise.all([read('catalog_equipment'), read('catalog_exercises')]);
  const equipment = storedEquipment.filter(item => item.category === 'Machines');
  const exerciseDefinitions = storedExercises.map(item => ({ ...item, equipmentOptions:
    (item.equipmentOptions || []).filter(option => equipment.some(machine => String(machine.id) === String(option.equipmentId)))
  })).filter(item => item.equipmentOptions.length);
  const references = { ...referenceLists, equipment };
  return { ...references, exerciseDefinitions, exercises: expandExerciseDocuments(exerciseDefinitions, references) };
}

const text = (value, max = 100) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const sameId = (a, b) => String(a) === String(b);
const equipmentIds = id => ({ $in: [id, ...(Number.isFinite(Number(id)) ? [Number(id)] : [])] });
const list = value => Array.isArray(value) && value.length <= 30 && value.every(item => text(item));
const validImage = value => value == null || value === '' || (typeof value === 'string' && value.length <= 2000 && /^https?:\/\/\S+$/i.test(value));

function equipmentRecord(body) {
  if (!text(body['equipment-type']) || body.category !== 'Machines' ||
    !Array.isArray(body.attachmentIds) || body.attachmentIds.length > referenceLists.attachments.length ||
    !body.attachmentIds.every(id => referenceLists.attachments.some(item => sameId(item.id, id))) || !validImage(body.image)) {
    throw new Error('Enter an equipment name (up to 100 characters), category, and valid attachments. Images must use an http or https URL.');
  }
  return { 'equipment-type': body['equipment-type'].trim(), category: body.category,
    attachmentIds: [...new Set(body.attachmentIds.map(Number))], image: body.image || null };
}

function exerciseRecord(body, catalog) {
  if (!text(body.name) || !catalog.groups.some(item => sameId(item.id, body.muscleGroupId)) ||
    !Array.isArray(body.equipmentOptions) || !body.equipmentOptions.length || body.equipmentOptions.length > 30) {
    throw new Error('Enter an exercise name (up to 100 characters), muscle group, and 1–30 equipment options.');
  }
  const keys = new Set();
  const variants = new Set();
  const equipmentOptions = body.equipmentOptions.map(option => {
    if (!option || !text(option.key) || keys.has(option.key)) throw new Error('Equipment options must have unique, nonempty keys.');
    keys.add(option.key);
    const machine = catalog.equipment.find(item => sameId(item.id, option.equipmentId));
    if (!machine || !list(option.primaryMuscles) || !list(option.secondaryMuscles) || typeof option.isIsolation !== 'boolean' || !validImage(option.image)) {
      throw new Error('Choose existing equipment and valid muscle names for each option. Images must use an http or https URL.');
    }
    const variant = `${machine.id}:${option.isIsolation}`;
    if (variants.has(variant)) throw new Error('Use each equipment type once for standard movement and once for isolation movement.');
    variants.add(variant);
    if (option.attachmentId != null && !machine.attachmentIds.some(id => sameId(id, option.attachmentId))) {
      throw new Error('Choose an attachment supported by the selected equipment.');
    }
    return { key: option.key, equipmentId: machine.id, attachmentId: option.attachmentId == null ? null : Number(option.attachmentId),
      primaryMuscles: option.primaryMuscles.map(item => item.trim()), secondaryMuscles: option.secondaryMuscles.map(item => item.trim()),
      isIsolation: option.isIsolation, image: option.image || null };
  });
  const muscleGroupId = Number(body.muscleGroupId);
  const muscles = equipmentOptions.flatMap(option => [...option.primaryMuscles, ...option.secondaryMuscles]);
  const muscleGroupIds = [...new Set([muscleGroupId, ...catalog.groups.filter(group => muscles.some(muscle =>
    group.name === muscle || group.muscles.includes(muscle))).map(group => group.id)])];
  return { name: body.name.trim(), muscleGroupId, muscleGroupIds, equipmentOptions, referenceSchemaVersion: 1 };
}

export function registerCatalogRoutes(app, db) {
  for (const kind of ['equipment', 'exercises']) {
    const collection = db.collection(`catalog_${kind}`);
    const save = async (req, res) => {
      const catalog = await readCatalog(db);
      const id = req.params.id;
      const previous = id ? await collection.findOne({ _id: id }) : null;
      if (id && !previous) return res.status(404).json({ error: 'Catalog item not found.' });
      let record;
      try { record = kind === 'equipment' ? equipmentRecord(req.body || {}) : exerciseRecord(req.body || {}, catalog); }
      catch (error) { return res.status(400).json({ error: error.message }); }
      if (previous) {
        if (kind === 'equipment') {
          const removed = (previous.attachmentIds || []).filter(value => !record.attachmentIds.includes(Number(value)));
          if (removed.length && (await db.collection('catalog_exercises').findOne({ equipmentOptions: { $elemMatch: { equipmentId: equipmentIds(id), attachmentId: { $in: removed } } } }) ||
            await db.collection('workouts').findOne({ exercises: { $elemMatch: { equipmentId: equipmentIds(id), attachmentId: { $in: removed } } } }))) {
            return res.status(409).json({ error: 'An attachment is used by an exercise or saved workout. Remove those references first.' });
          }
        } else {
          const changed = previous.equipmentOptions.filter(option => !record.equipmentOptions.some(next => next.key === option.key && sameId(next.equipmentId, option.equipmentId))).map(option => option.key);
          if (changed.length && await db.collection('workouts').findOne({ exercises: { $elemMatch: { exerciseId: id, equipmentOptionKey: { $in: changed } } } })) {
            return res.status(409).json({ error: 'An equipment option is used by a saved workout. Remove it from those workouts before changing or removing it.' });
          }
        }
        await collection.updateOne({ _id: id }, { $set: record });
        return res.json({ ...previous, ...record, _id: undefined, id });
      }
      const newId = randomUUID();
      await collection.insertOne({ ...record, _id: newId });
      res.status(201).json({ ...record, id: newId });
    };
    app.get(`/api/${kind}`, async (_req, res) => {
      const catalog = await readCatalog(db);
      res.json(kind === 'equipment' ? catalog.equipment : catalog.exerciseDefinitions);
    });
    app.get(`/api/${kind}/:id`, async (req, res) => {
      const record = await collection.findOne({ _id: req.params.id });
      if (!record) return res.status(404).json({ error: 'Catalog item not found.' });
      const { _id, ...item } = record;
      res.json({ ...item, id: String(_id) });
    });
    app.post(`/api/${kind}`, save);
    app.put(`/api/${kind}/:id`, save);
    app.delete(`/api/${kind}/:id`, async (req, res) => {
      const id = req.params.id;
      if (!await collection.findOne({ _id: id })) return res.status(404).json({ error: 'Catalog item not found.' });
      const used = kind === 'equipment'
        ? await db.collection('catalog_exercises').findOne({ 'equipmentOptions.equipmentId': equipmentIds(id) }) || await db.collection('workouts').findOne({ 'exercises.equipmentId': equipmentIds(id) })
        : await db.collection('workouts').findOne({ 'exercises.exerciseId': id });
      if (used) return res.status(409).json({ error: kind === 'equipment'
        ? 'This equipment is used by exercises or saved workouts. Remove those references before deleting it.'
        : 'This exercise is used by saved workouts. Remove it from those workouts before deleting it.' });
      await collection.deleteOne({ _id: id });
      res.sendStatus(204);
    });
  }
}

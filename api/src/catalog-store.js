import { primaryGroupIds } from '../../ui/src/utils/muscleGroups.js';
import {
  supportsAttachments,
  attachmentIdsFor,
} from '../../ui/src/utils/equipment.js';
import { randomUUID } from 'node:crypto';
import { referenceLists, expandExerciseDocuments } from '../data/catalog.js';

function withPrimaryGroups(document, groups) {
  const equipmentOptions = document.equipmentOptions.map(option => {
    const ids = primaryGroupIds(option.primaryMuscles, groups);
    return { ...option, primaryMuscleGroupIds: ids, muscleGroupId: ids[0] ?? document.muscleGroupId, muscleGroupIds: ids };
  });
  const ids = [...new Set(equipmentOptions.flatMap(option => option.primaryMuscleGroupIds))];
  return { ...document, equipmentOptions, primaryMuscleGroupIds: ids, muscleGroupId: ids[0] ?? document.muscleGroupId, muscleGroupIds: ids };
}
export async function readCatalog(db) {
  const read = async (name) =>
    (await db.collection(name).find({}).sort({ name: 1 }).toArray()).map(
      ({ _id, ...record }) => ({ ...record, id: String(_id) })
    );
  const [storedEquipment, storedExercises] = await Promise.all([
    read('catalog_equipment'),
    read('catalog_exercises'),
  ]);
  const equipment = storedEquipment
    .filter((item) => item.category === 'Machines')
    .map((item) => {
      const primaryMuscles = item.primaryMuscles ?? [];
      const secondaryMuscles = item.secondaryMuscles ?? [];
      return {
        ...item,
        attachmentIds: attachmentIdsFor(item),
        primaryMuscles,
        secondaryMuscles,
        muscleGroupIds: referenceLists.groups
          .filter((group) =>
            [...primaryMuscles, ...secondaryMuscles].some(
              (muscle) =>
                muscle === group.name || group.muscles.includes(muscle)
            )
          )
          .map((group) => group.id),
      };
    });
  const exerciseDefinitions = storedExercises
    .map((item) => ({
      ...item,
      equipmentOptions: (item.equipmentOptions || [])
        .filter((option) =>
          equipment.some(
            (machine) => String(machine.id) === String(option.equipmentId)
          )
        )
        .map((option) => ({
          ...option,
          attachmentId: attachmentIdsFor(
            equipment.find(
              (machine) => String(machine.id) === String(option.equipmentId)
            )
          ).some((id) => String(id) === String(option.attachmentId))
            ? option.attachmentId
            : null,
        })),
    }))
    .filter((item) => item.equipmentOptions.length)
    .map(item => withPrimaryGroups(item, referenceLists.groups));
  const media = await read('catalog_media');
  const decorate = (record, key) => {
    const entry =
      media.find(
        (item) =>
          item.id === key && (!record.image || item.image === record.image)
      ) || media.find((item) => record.image && item.image === record.image);
    return entry && (!record.image || record.image === entry.image)
      ? {
          ...record,
          image: record.image || entry.image,
          imageViews: entry.imageViews,
          imageAttribution: entry.imageAttribution,
          imageCaption: entry.imageCaption,
        }
      : record;
  };
  const groups = referenceLists.groups.map((group) =>
    decorate(group, `group:${group.id}`)
  );
  const decoratedEquipment = equipment.map((item) =>
    decorate(item, `equipment:${item.id}`)
  );
  const decoratedExercises = exerciseDefinitions.map((item) => ({
    ...item,
    equipmentOptions: item.equipmentOptions.map((option) =>
      decorate(option, `exercise:${item.id}:${option.key}`)
    ),
  }));
  const references = {
    ...referenceLists,
    groups,
    equipment: decoratedEquipment,
  };
  return {
    ...references,
    exerciseDefinitions: decoratedExercises,
    exercises: expandExerciseDocuments(decoratedExercises, references),
  };
}

const text = (value, max = 100) =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.trim().length <= max;
const sameId = (a, b) => String(a) === String(b);
const equipmentIds = (id) => ({
  $in: [id, ...(Number.isFinite(Number(id)) ? [Number(id)] : [])],
});
const list = (value) =>
  Array.isArray(value) &&
  value.length <= 30 &&
  value.every((item) => text(item));
const validImage = (value) =>
  value == null ||
  value === '' ||
  (typeof value === 'string' &&
    value.length <= 2000 &&
    /^https?:\/\/\S+$/i.test(value));

function equipmentRecord(body, id) {
  for (const field of ['primaryMuscles', 'secondaryMuscles']) {
    if (body[field] !== undefined && !list(body[field]))
      throw new Error(
        'Select up to 30 valid primary and secondary muscle names.'
      );
  }
  if (
    !text(body['equipment-type']) ||
    body.category !== 'Machines' ||
    !Array.isArray(body.attachmentIds) ||
    body.attachmentIds.length > referenceLists.attachments.length ||
    !body.attachmentIds.every((id) =>
      referenceLists.attachments.some((item) => sameId(item.id, id))
    ) ||
    !validImage(body.image)
  ) {
    throw new Error(
      'Enter an equipment name (up to 100 characters), category, and valid attachments. Images must use an http or https URL.'
    );
  }
  if (body.attachmentIds.length && !supportsAttachments({ ...body, id }))
    throw new Error('Only Multifunctional Cable Machines support attachments.');
  return {
    'equipment-type': body['equipment-type'].trim(),
    category: body.category,
    attachmentIds: [...new Set(body.attachmentIds.map(Number))],
    image: body.image || null,
    ...Object.fromEntries(
      ['primaryMuscles', 'secondaryMuscles']
        .filter((field) => body[field] !== undefined)
        .map((field) => [
          field,
          [...new Set(body[field].map((item) => item.trim()))],
        ])
    ),
  };
}

function exerciseRecord(body, catalog) {
  if (
    !text(body.name) ||
    !Array.isArray(body.equipmentOptions) ||
    !body.equipmentOptions.length ||
    body.equipmentOptions.length > 30
  ) {
    throw new Error(
      'Enter an exercise name (up to 100 characters) and 1–30 equipment options.'
    );
  }
  const keys = new Set();
  const variants = new Set();
  const equipmentOptions = body.equipmentOptions.map((option) => {
    if (!option || !text(option.key) || keys.has(option.key))
      throw new Error('Equipment options must have unique, nonempty keys.');
    keys.add(option.key);
    const machine = catalog.equipment.find((item) =>
      sameId(item.id, option.equipmentId)
    );
    if (
      !machine ||
      !list(option.primaryMuscles) ||
      !list(option.secondaryMuscles) ||
      typeof option.isIsolation !== 'boolean' ||
      !validImage(option.image)
    ) {
      throw new Error(
        'Choose existing equipment and valid muscle names for each option. Images must use an http or https URL.'
      );
    }
    if (option.primaryMuscles.length !== 1) throw new Error('Select exactly one primary muscle for each equipment option.');
    if (!primaryGroupIds(option.primaryMuscles, catalog.groups).length) throw new Error('Choose a primary muscle that belongs to a recognized muscle group.');
    const variant = `${machine.id}:${option.isIsolation}`;
    if (variants.has(variant))
      throw new Error(
        'Use each equipment type once for standard movement and once for isolation movement.'
      );
    variants.add(variant);
    if (
      option.attachmentId != null &&
      !attachmentIdsFor(machine).some((id) => sameId(id, option.attachmentId))
    ) {
      throw new Error(
        'Choose an attachment supported by the selected equipment.'
      );
    }
    return {
      key: option.key,
      equipmentId: machine.id,
      attachmentId:
        option.attachmentId == null ? null : Number(option.attachmentId),
      primaryMuscles: option.primaryMuscles.map((item) => item.trim()),
      secondaryMuscles: option.secondaryMuscles.map((item) => item.trim()),
      isIsolation: option.isIsolation,
      image: option.image || null,
    };
  });
  const muscleGroupIds = primaryGroupIds(equipmentOptions.flatMap(option => option.primaryMuscles), catalog.groups);
  const muscleGroupId = muscleGroupIds[0];
  return {
    name: body.name.trim(),
    primaryMuscleGroupIds: muscleGroupIds,
    muscleGroupId,
    muscleGroupIds,
    equipmentOptions,
    referenceSchemaVersion: 1,
  };
}

export function registerCatalogRoutes(app, db) {
  app.post('/api/exercises/bulk-delete', async (req, res) => {
    const requested = req.body?.ids;
    if (
      !Array.isArray(requested) ||
      !requested.length ||
      requested.length > 500 ||
      !requested.every((id) => text(id))
    ) {
      return res
        .status(400)
        .json({ error: 'Select 1–500 valid exercise IDs.' });
    }
    const ids = [...new Set(requested)];
    const collection = db.collection('catalog_exercises');
    const records = await collection
      .find({ _id: { $in: ids } })
      .sort({ name: 1 })
      .toArray();
    const blocked = [];
    const deletedIds = [];
    for (const record of records) {
      if (
        await db
          .collection('workouts')
          .findOne({ 'exercises.exerciseId': record._id })
      ) {
        blocked.push({
          id: String(record._id),
          name: record.name,
          reason: 'Used in a saved workout.',
        });
      } else deletedIds.push(String(record._id));
    }
    if (deletedIds.length)
      await collection.deleteMany({ _id: { $in: deletedIds } });
    const found = new Set(records.map((record) => String(record._id)));
    res.json({
      deletedIds,
      blocked,
      missingIds: ids.filter((id) => !found.has(id)),
    });
  });
  for (const kind of ['equipment', 'exercises']) {
    const collection = db.collection(`catalog_${kind}`);
    const save = async (req, res) => {
      const catalog = await readCatalog(db);
      const id = req.params.id;
      const previous = id ? await collection.findOne({ _id: id }) : null;
      if (id && !previous)
        return res.status(404).json({ error: 'Catalog item not found.' });
      let record;
      try {
        record =
          kind === 'equipment'
            ? equipmentRecord(req.body || {}, id)
            : exerciseRecord(req.body || {}, catalog);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
      record.updatedAt = new Date().toISOString();
      if (!previous) record.createdAt = record.updatedAt;
      if (previous) {
        if (kind === 'equipment') {
          const removed = (previous.attachmentIds || []).filter(
            (value) => !record.attachmentIds.includes(Number(value))
          );
          if (
            supportsAttachments(previous) &&
            removed.length &&
            ((await db
              .collection('catalog_exercises')
              .findOne({
                equipmentOptions: {
                  $elemMatch: {
                    equipmentId: equipmentIds(id),
                    attachmentId: { $in: removed },
                  },
                },
              })) ||
              (await db
                .collection('workouts')
                .findOne({
                  exercises: {
                    $elemMatch: {
                      equipmentId: equipmentIds(id),
                      attachmentId: { $in: removed },
                    },
                  },
                })))
          ) {
            return res
              .status(409)
              .json({
                error:
                  'An attachment is used by an exercise or saved workout. Remove those references first.',
              });
          }
        } else {
          const changed = previous.equipmentOptions
            .filter(
              (option) =>
                !record.equipmentOptions.some(
                  (next) =>
                    next.key === option.key &&
                    sameId(next.equipmentId, option.equipmentId)
                )
            )
            .map((option) => option.key);
          if (
            changed.length &&
            (await db
              .collection('workouts')
              .findOne({
                exercises: {
                  $elemMatch: {
                    exerciseId: id,
                    equipmentOptionKey: { $in: changed },
                  },
                },
              }))
          ) {
            return res
              .status(409)
              .json({
                error:
                  'An equipment option is used by a saved workout. Remove it from those workouts before changing or removing it.',
              });
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
      res.json(
        kind === 'equipment' ? catalog.equipment : catalog.exerciseDefinitions
      );
    });
    app.get(`/api/${kind}/:id`, async (req, res) => {
      const record = await collection.findOne({ _id: req.params.id });
      if (!record)
        return res.status(404).json({ error: 'Catalog item not found.' });
      const { _id, ...item } = record;
      res.json({ ...item, id: String(_id) });
    });
    app.post(`/api/${kind}`, save);
    app.put(`/api/${kind}/:id`, save);
    app.delete(`/api/${kind}/:id`, async (req, res) => {
      const id = req.params.id;
      if (!(await collection.findOne({ _id: id })))
        return res.status(404).json({ error: 'Catalog item not found.' });
      const used =
        kind === 'equipment'
          ? (await db
              .collection('catalog_exercises')
              .findOne({ 'equipmentOptions.equipmentId': equipmentIds(id) })) ||
            (await db
              .collection('workouts')
              .findOne({ 'exercises.equipmentId': equipmentIds(id) }))
          : await db
              .collection('workouts')
              .findOne({ 'exercises.exerciseId': id });
      if (used)
        return res
          .status(409)
          .json({
            error:
              kind === 'equipment'
                ? 'This equipment is used by exercises or saved workouts. Remove those references before deleting it.'
                : 'This exercise is used by saved workouts. Remove it from those workouts before deleting it.',
          });
      await collection.deleteOne({ _id: id });
      res.sendStatus(204);
    });
  }
}

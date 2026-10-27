import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'node:url';
import {
  catalogDocuments,
  expandExerciseDocuments,
  referenceLists,
} from '../data/catalog.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
export const client = new MongoClient(
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  {
    serverSelectionTimeoutMS: 15000,
  }
);
export const db = client.db(process.env.MONGODB_DB || 'workout_app');

export function starterWorkouts() {
  const catalog = expandExerciseDocuments(catalogDocuments);
  const select = (name, equipmentId) => {
    const exercise = catalog.find(
      (item) => item.name === name && item.equipmentId === equipmentId
    );
    if (!exercise) throw new Error('Missing starter exercise: ' + name);
    const {
      equipmentOptions,
      equipment,
      'equipment-type': label,
      attachment,
      ...snapshot
    } = exercise;
    return { ...snapshot, attachmentId: null };
  };
  return [
    {
      templateKey: 'chest-default',
      name: 'chesat default',
      isTemplate: true,
      exercises: [
        select('Bench Press', 5),
        select('Seated Incline Chest Press', 3),
        select('Seated Pec Fly', 1),
      ],
    },
    {
      templateKey: 'back-default',
      name: 'back default',
      isTemplate: true,
      exercises: [select('Seated Lat Pulldown', 4), select('Seated Row', 3)],
    },
  ];
}

export async function initializeDatabase(database = db) {
  await database.command({ ping: 1 });
  const workouts = database.collection('workouts');
  await workouts.createIndex(
    { templateKey: 1 },
    {
      unique: true,
      partialFilterExpression: { templateKey: { $type: 'string' } },
    }
  );
  // Separate managed collections leave legacy catalog collections untouched.
  // The marker prevents deleted catalog entries being reseeded on restart.
  const state = database.collection('catalog_state');
  if (!(await state.findOne({ _id: 'managed-catalog-v1' }))) {
    for (const [name, records] of [
      ['catalog_equipment', referenceLists.equipment],
      ['catalog_exercises', catalogDocuments],
    ]) {
      await database.collection(name).bulkWrite(
        records.map(({ id, ...record }) => ({
          updateOne: {
            filter: { _id: String(id) },
            update: { $setOnInsert: record },
            upsert: true,
          },
        }))
      );
    }
    await workouts.bulkWrite(
      starterWorkouts().map((workout) => ({
        updateOne: {
          filter: { templateKey: workout.templateKey },
          update: {
            $setOnInsert: { ...workout, createdAt: new Date().toISOString() },
          },
          upsert: true,
        },
      }))
    );
    await state.updateOne(
      { _id: 'managed-catalog-v1' },
      { $set: { initializedAt: new Date().toISOString() } },
      { upsert: true }
    );
  }
}

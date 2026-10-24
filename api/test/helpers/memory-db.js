import { ObjectId } from 'mongodb';
import { catalogDocuments, referenceLists } from '../../data/catalog.js';

function values(record, path) {
  if (!path.length) return [record];
  if (Array.isArray(record)) return record.flatMap(item => values(item, path));
  return values(record?.[path[0]], path.slice(1));
}
function equal(a, b) { return a instanceof ObjectId && b instanceof ObjectId ? a.equals(b) : a === b; }
function matches(record, query) {
  return Object.entries(query).every(([path, expected]) => values(record, path.split('.')).some(value => {
    if (expected && typeof expected === 'object' && !(expected instanceof ObjectId)) {
      if ('$in' in expected) return expected.$in.some(item => equal(value, item));
      if ('$elemMatch' in expected) return Array.isArray(value) && value.some(item => matches(item, expected.$elemMatch));
    }
    return equal(value, expected);
  }));
}
export function memoryDb({ seed = true } = {}) {
  const records = {
    catalog_exercises: seed ? catalogDocuments.map(({ id, ...item }) => ({ ...item, _id: String(id) })) : [],
    catalog_equipment: seed ? referenceLists.equipment.map(({ id, ...item }) => ({ ...item, _id: String(id) })) : [],
    workouts: [], catalog_state: [],
  };
  return { records, command: async () => ({ ok: 1 }), collection(name) {
    const items = records[name] ||= [];
    const update = async (query, change, options = {}) => {
      const index = items.findIndex(item => matches(item, query));
      if (index < 0) {
        if (!options.upsert) return { matchedCount: 0 };
        items.push({ ...query, ...change.$setOnInsert, ...change.$set });
      } else items[index] = { ...items[index], ...change.$set };
      return { matchedCount: 1 };
    };
    return {
      find: query => ({ sort: () => ({ toArray: async () => items.filter(item => matches(item, query)) }) }),
      findOne: async query => items.find(item => matches(item, query)) || null,
      insertOne: async item => { const _id = item._id ?? new ObjectId(); items.push({ ...item, _id }); return { insertedId: _id }; },
      updateOne: update,
      findOneAndUpdate: async (query, change) => { await update(query, change); return items.find(item => matches(item, query)) || null; },
      deleteOne: async query => { const index = items.findIndex(item => matches(item, query)); if (index < 0) return { deletedCount: 0 }; items.splice(index, 1); return { deletedCount: 1 }; },
      deleteMany: async query => { let deletedCount = 0; for (let index = items.length - 1; index >= 0; index--) { if (matches(items[index], query)) { items.splice(index, 1); deletedCount++; } } return { deletedCount }; },
      createIndex: async () => {},
      bulkWrite: async operations => { for (const { updateOne } of operations) await update(updateOne.filter, updateOne.update, updateOne); },
    };
  } };
}

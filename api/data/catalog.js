import { primaryGroupIds } from '../../ui/src/utils/muscleGroups.js';
import { supportsAttachments, attachmentIdsFor } from '../../ui/src/utils/equipment.js';
import { muscleGroups } from './muscle-groups.js';
import { attachments } from './attachments.js';
import savedLibrary from './exercise-library.json' with { type: 'json' };
import { chestExercises } from './exercises/chestExercises.js';
import { backExercises } from './exercises/backExercises.js';
import { shoulderExercises } from './exercises/shoulderExercises.js';
import { bicepExercises } from './exercises/bicepExercises.js';
import { tricepExercises } from './exercises/tricepExercises.js';
import { smithMachine } from './equipment/smith-machine.js';
import { multifunctionalCableMachine } from './equipment/multifunctional-cable-machine.js';
import { plateLoadedMachine } from './equipment/plate-loaded-machine.js';
import { selectorizedCableMachine } from './equipment/selectorized-cable-machine.js';

export const equipment = [
  selectorizedCableMachine,
  plateLoadedMachine,
  multifunctionalCableMachine,
  smithMachine,
].map((item) => ({ ...item, category: 'Machines' }));
const key = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
const equipmentAliases = new Map([
  ['pin cable machine', 4],
  ['multifunctionalcable machine', 4],
  ['selectorized isolation cable machine', 1],
  ['isolation selectorized machines', 1],
  ['selectorized machine', 1],
  ['selectorized machines', 1],
  ['selectorized', 1],
  ['selectorized cable machines', 1],
  ['selectorize cable machine', 1],
]);
export function resolveEquipment(record) {
  const value = record.equipment ?? record['equipment-type'];
  const id =
    record.equipmentId ??
    (typeof value === 'object'
      ? (value?.id ?? value?._id)
      : /^\d+$/.test(String(value ?? ''))
        ? value
        : undefined);
  const name =
    typeof value === 'object'
      ? (value?.['equipment-type'] ?? value?.name)
      : value;
  // ID 2 belonged to the retired isolation equipment category.
  const canonicalId = String(id) === '2' ? 1 : id;
  if (name && !/^\d+$/.test(String(name))) {
    return equipment.find(
      (item) =>
        key(item['equipment-type']) === key(name) ||
        item.id === equipmentAliases.get(key(name)),
    );
  }
  return equipment.find((item) => String(item.id) === String(canonicalId));
}

export function normalizeExercise(record) {
  const machine = resolveEquipment(record);
  const details =
    machine?.exercises.find((item) => key(item.name) === key(record.name)) ||
    {};
  const primaryMuscles = record.primaryMuscles ?? details.primaryMuscles ?? [];
  const secondaryMuscles =
    record.secondaryMuscles ?? details.secondaryMuscles ?? [];
  const primaryMuscleGroupIds = primaryGroupIds(primaryMuscles, muscleGroups);
  const muscleGroupId = primaryMuscleGroupIds[0] ?? record.muscleGroupId ?? details.muscleGroupId;
  const muscleGroupIds = [
    ...new Set([
      muscleGroupId,
      ...muscleGroups
        .filter((group) =>
          [...primaryMuscles, ...secondaryMuscles].some(
            (muscle) => group.name === muscle || group.muscles.includes(muscle),
          ),
        )
        .map((group) => group.id),
    ]),
  ].filter((id) => id != null);
  const equipmentName =
    machine?.['equipment-type'] ||
    String(
      (typeof record.equipment === 'object'
        ? (record.equipment?.['equipment-type'] ?? record.equipment?.name)
        : (record.equipment ?? record['equipment-type'])) ?? '',
    ).trim() ||
    'Unknown equipment';
  const name = String(record.name ?? '').trim();
  return {
    ...record,
    name,
    equipment: equipmentName,
    equipmentId: machine?.id ?? null,
    'equipment-type': equipmentName,
    equipmentResolved: Boolean(machine),
    primaryMuscleGroupIds,
    muscleGroupId,
    muscleGroupIds,
    primaryMuscles,
    secondaryMuscles,
    isIsolation: record.isIsolation ?? details.isIsolation ?? false,
    attachment:
      supportsAttachments(machine) ? (record.attachment ?? details.attachment ?? null) : null,
  };
}

export const exerciseDefinitions = Object.values({
  chestExercises,
  backExercises,
  shoulderExercises,
  bicepExercises,
  tricepExercises,
}).flat();

export const exerciseCollections = Object.fromEntries(
  Object.entries({
    chestExercises,
    backExercises,
    shoulderExercises,
    bicepExercises,
    tricepExercises,
  }).map(([name, records]) => [
    name,
    records.flatMap(({ equipmentOptions, ...record }) =>
      equipmentOptions.map((equipment) =>
        normalizeExercise({ ...record, equipment }),
      ),
    ),
  ]),
);

export function canonicalMovementName(name) {
  const value = String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (/^(?:smith(?: machine)? )?bench press$/i.test(value))
    return 'Bench Press';
  if (/^seated lateral raise press$/i.test(value))
    return 'Seated Lateral Raise';
  if (/^selectorized tricep extension$/i.test(value)) return 'Tricep Extension';
  return value;
}

export function buildExerciseDocuments(records) {
  const movements = new Map();
  for (const raw of records) {
    if (raw.catalogExcluded || !String(raw.name ?? '').trim()) continue;
    const name = canonicalMovementName(raw.name);
    const normalized = normalizeExercise({ ...raw, name });
    if (!normalized.equipmentResolved) continue;
    const identity = `${normalized.muscleGroupId}:${name.toLowerCase()}`;
    if (!movements.has(identity))
      movements.set(identity, {
        slug: identity,
        name,
        muscleGroupId: normalized.muscleGroupId,
        equipmentOptions: [],
      });
    const document = movements.get(identity);
    const optionKey = String(normalized.equipmentId ?? normalized.equipment);
    if (!document.equipmentOptions.some((option) => option.key === optionKey)) {
      document.equipmentOptions.push({
        key: optionKey,
        equipmentId: normalized.equipmentId,
        equipment: normalized.equipment,
        primaryMuscles: normalized.primaryMuscles,
        secondaryMuscles: normalized.secondaryMuscles,
        muscleGroupIds: normalized.muscleGroupIds,
        isIsolation: normalized.isIsolation,
        attachment: normalized.attachment,
      });
    }
  }
  return [...movements.values()];
}

export function expandExerciseDocuments(
  documents,
  references = referenceLists,
) {
  return documents.flatMap((document) =>
    (document.equipmentOptions || []).map((rawOption) => {
      const option = hydrateReferences(rawOption, references);
      return {
        ...document,
        ...option,
        exerciseId: document.id,
        equipmentOptionKey: option.key,
        attachmentIds:
          references.equipment.find(
            (item) => String(item.id) === String(option.equipmentId),
          )?.attachmentIds || [],
        id: `${document.id}:${option.key}`,
        'equipment-type': option.equipment,
      };
    }),
  );
}

export const referenceLists = {
  groups: muscleGroups,
  attachments,
  equipment: equipment.map(({ exercises, ...item }) => ({
    ...item,
    attachmentIds:
      supportsAttachments(item) ? attachments.map((attachment) => attachment.id) : [],
  })),
};

export function hydrateReferences(record, references = referenceLists) {
  const machine =
    record.equipmentId != null
      ? references.equipment.find(
          (item) => String(item.id) === String(record.equipmentId),
        )
      : resolveEquipment(record);
  const selectedAttachment =
    record.attachmentId != null
      ? (references.attachments.find(
          (item) => String(item.id) === String(record.attachmentId),
        )?.name ?? null)
      : (record.attachment ?? null);
  const attachmentRecord = references.attachments.find(item => item.name === selectedAttachment);
  const attachment = attachmentRecord && attachmentIdsFor(machine).some(id => String(id) === String(attachmentRecord.id)) ? selectedAttachment : null;
  return {
    ...record,
    equipment:
      machine?.['equipment-type'] ?? record.equipment ?? 'Unknown equipment',
    'equipment-type':
      machine?.['equipment-type'] ??
      record['equipment-type'] ??
      record.equipment ??
      'Unknown equipment',
    attachment,
    attachmentId: attachment == null ? null : attachmentRecord.id,
    primaryMuscleGroupIds: primaryGroupIds(record.primaryMuscles, references.groups),
  };
}

export function toReferenceDocument(document) {
  if (
    !muscleGroups.some((group) => group.id === Number(document.muscleGroupId))
  ) {
    throw new Error(`Unknown muscle group for ${document.name}`);
  }
  const equipmentOptions = (document.equipmentOptions || []).map((option) => {
    const machine =
      resolveEquipment(option) ||
      (option.equipment === 'Cable Machine with V-Bar'
        ? equipment.find((item) => item.id === 4)
        : null);
    if (!machine)
      throw new Error(
        `Add equipment to the reference list before migrating ${document.name}: ${option.equipment}`,
      );
    const attachmentId =
      option.attachmentId ??
      (option.attachment == null
        ? null
        : attachments.find((item) => item.name === option.attachment)?.id);
    if (
      attachmentId === undefined ||
      (attachmentId != null &&
        !attachments.some((item) => item.id === Number(attachmentId)))
    ) {
      throw new Error(`Unknown attachment for ${document.name}`);
    }
    const {
      equipment: label,
      attachment,
      'equipment-type': type,
      ...metadata
    } = option;
    return { ...metadata, equipmentId: machine.id, attachmentId: supportsAttachments(machine) ? attachmentId : null };
  });
  return { ...document, equipmentOptions, referenceSchemaVersion: 1 };
}

export const catalogDocuments = savedLibrary.length
  ? savedLibrary
  : buildExerciseDocuments(Object.values(exerciseCollections).flat()).map(
      (document) => ({
        ...toReferenceDocument(document),
        id: document.slug,
      }),
    );

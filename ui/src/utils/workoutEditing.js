import { attachmentIdsFor } from './equipment.js';
export function variantsForExercise(exercise, catalog) {
  return (catalog.exercises || []).filter(item => exercise.exerciseId ? item.exerciseId === exercise.exerciseId : item.name === exercise.name);
}
export function updateDraftExercise(draft, selectionId, change, catalog) {
  const index = draft.findIndex(item => item.selectionId === selectionId);
  if (index < 0) return draft;
  const previous = draft[index];
  const changingExercise = Boolean(change.exerciseId && change.exerciseId !== previous.exerciseId);
  const options = change.exerciseId ? (catalog.exercises || []).filter(item => item.exerciseId === change.exerciseId) : variantsForExercise(previous, catalog);
  const variant = change.variantId ? options.find(item => item.id === change.variantId) : changingExercise
    ? options.find(item => String(item.equipmentId) === String(previous.equipmentId)) || options[0]
    : options.find(item => item.id === previous.id) || previous;
  if (!variant) throw new Error('Choose an available exercise and equipment version.');
  const requestedAttachment = Object.hasOwn(change, 'attachment') ? change.attachment : changingExercise ? variant.attachment : previous.attachment;
  const allowed = attachmentIdsFor(variant);
  const valid = requestedAttachment != null && (catalog.attachments || []).some(item => item.name === requestedAttachment && allowed.some(id => String(id) === String(item.id)));
  if (Object.hasOwn(change, 'attachment') && requestedAttachment != null && !valid) throw new Error('Choose an attachment supported by this equipment.');
  const updated = [...draft];
  updated[index] = { ...variant, selectionId: previous.selectionId, attachment: valid ? requestedAttachment : null };
  return updated;
}
export function removeDraftSelections(draft, ids) {
  const selected = new Set(ids);
  return draft.filter(item => !selected.has(item.selectionId));
}
export async function deleteWorkoutBatch(ids, remove) {
  const deletedIds = [], failed = [];
  for (const id of new Set(ids)) {
    try { await remove(id); deletedIds.push(id); }
    catch (cause) { failed.push({ id, reason: cause.message }); }
  }
  return { deletedIds, failed };
}

import { attachmentIdsFor } from './equipment.js';
export function selectedWorkoutExercises(ids, configured, catalog, currentCount = 0) {
  const selected = [...new Set(ids)];
  const remaining = Math.max(0, 100 - currentCount);
  if (selected.length > remaining) throw new Error(`Only ${remaining} ${remaining === 1 ? 'space remains' : 'spaces remain'} in the workout bag. Select fewer exercises.`);
  return selected.map(id => {
    const choice = configured.get(id);
    const variants = catalog.exercises.filter(item => String(item.exerciseId || item.id) === String(id));
    const variant = variants.find(item => item.id === choice?.id) || variants[0];
    if (!variant) throw new Error('A selected exercise is no longer available. Refresh the collection and try again.');
    const allowed = attachmentIdsFor(variant);
    const attachment = choice?.id === variant.id ? choice.attachment : variant.attachment;
    const valid = attachment && catalog.attachments.some(item => item.name === attachment && allowed.some(id => String(id) === String(item.id)));
    return { ...variant, attachment: valid ? attachment : null };
  });
}

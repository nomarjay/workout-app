// Strip equipment qualifiers while preserving movement differences such as incline.
export function exerciseFamilyName(name) {
  if (/^smith(?:\s+machine)?\s+bench press$/i.test(String(name).trim()))
    return 'Smith Machine Bench Press';
  return String(name)
    .replace(
      /\b(selectorized|selectorize|plate[ -]loaded|multifunctional[ -]cable|pin[ -]cable|smith[ -]machine|isolation|isolated|machine|cable|seated)\b/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
}
export function groupExerciseVariants(exercises) {
  const groups = new Map();
  for (const exercise of exercises) {
    if (!String(exercise.name ?? '').trim()) continue;
    const name = exercise.exerciseId
      ? exercise.name
      : exerciseFamilyName(exercise.name) || exercise.name;
    const id = exercise.exerciseId || name.toLowerCase();
    if (!groups.has(id)) groups.set(id, { id, name, createdAt: exercise.createdAt, variants: [] });
    const variants = groups.get(id).variants;
    if (
      !variants.some(
        (item) =>
          (item.equipmentId ?? item.equipment ?? item.id) ===
            (exercise.equipmentId ?? exercise.equipment ?? exercise.id) &&
          Boolean(item.isIsolation) === Boolean(exercise.isIsolation)
      )
    )
      variants.push(exercise);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    'equipment-type': [
      ...new Set(
        group.variants.map(
          (item) =>
            item['equipment-type'] || item.equipment || 'Unknown equipment'
        )
      ),
    ]
      .sort()
      .join(' / '),
  }));
}

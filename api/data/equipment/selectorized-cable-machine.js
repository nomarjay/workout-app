// Selectorized Cable Machine. Primary and secondary muscle names match muscle-groups.js.
export const selectorizedCableMachine = {
  id: 1,
  'equipment-type': 'Selectorized Cable Machine',
  exercises: [
    {
      name: 'Seated Chest Press',
      isIsolation: false,
      muscleGroupId: 1, // Chest
      primaryMuscles: ['Chest'],
      secondaryMuscles: ['Front Delts', 'Triceps'],
    },
    {
      name: 'Seated Incline Chest Press',
      isIsolation: false,
      muscleGroupId: 1, // Chest
      primaryMuscles: ['Chest'],
      secondaryMuscles: ['Front Delts', 'Triceps'],
    },
    {
      name: 'Seated Pec Fly',
      isIsolation: true,
      muscleGroupId: 1, // Chest
      primaryMuscles: ['Chest'],
      secondaryMuscles: ['Front Delts'],
    },
    {
      name: 'Seated Row',
      isIsolation: false,
      muscleGroupId: 2, // Back
      primaryMuscles: ['Lats'],
      secondaryMuscles: ['Rear Delts', 'Biceps'],
    },
    {
      name: 'Seated Lat Pulldown',
      isIsolation: false,
      muscleGroupId: 2, // Back
      primaryMuscles: ['Lats'],
      secondaryMuscles: ['Biceps', 'Forearms'],
    },
    {
      name: 'Seated Shoulder Press',
      isIsolation: false,
      muscleGroupId: 6, // Shoulders
      primaryMuscles: ['Front Delts'],
      secondaryMuscles: ['Triceps'],
    },
    {
      name: 'Seated Lateral Raise Press',
      isIsolation: true,
      muscleGroupId: 6, // Shoulders
      primaryMuscles: ['Side Delts'],
      secondaryMuscles: ['Traps'],
    },
    {
      name: 'Seated Preacher Curl',
      isIsolation: true,
      muscleGroupId: 3, // Arms (Biceps)
      primaryMuscles: ['Biceps'],
      secondaryMuscles: ['Forearms', 'Brachioradialis'],
    },
    {
      name: 'Selectorized Tricep Extension',
      isIsolation: true,
      muscleGroupId: 3, // Arms (Triceps)
      primaryMuscles: ['Triceps'],
      secondaryMuscles: [],
    },
  ],
};

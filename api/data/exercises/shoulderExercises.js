// One movement, with explicitly supported equipment choices.
export const shoulderExercises = [
  {
    name: 'Seated Shoulder Press',
    muscleGroupId: 6,
    equipmentOptions: ['Selectorized Cable Machine', 'Plate Loaded Machine'],
    primaryMuscles: ['Front Delts'],
    secondaryMuscles: ['Triceps'],
  },
  {
    name: 'Seated Lateral Raise',
    muscleGroupId: 6,
    equipmentOptions: ['Selectorized Cable Machine'],
    primaryMuscles: ['Side Delts'],
    secondaryMuscles: ['Traps'],
    isIsolation: true,
  },
];

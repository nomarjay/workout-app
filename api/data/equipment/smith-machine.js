// Smith Machine. Primary and secondary muscle names match muscle-groups.js.
export const smithMachine = {
  id: 5,
  'equipment-type': 'Smith Machine',
  exercises: [
    {
      name: 'Smith Machine Bench Press',
      muscleGroupId: 1, // Chest
      primaryMuscles: ['Chest'],
      secondaryMuscles: ['Front Delts', 'Triceps'],
    },
  ],
};

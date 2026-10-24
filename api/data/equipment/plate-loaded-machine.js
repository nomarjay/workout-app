// Plate Loaded Machine. Primary and secondary muscle names match muscle-groups.js.
export const plateLoadedMachine = {
    id: 3,
    'equipment-type': 'Plate Loaded Machine',
    exercises: [
        {
            name: 'Seated Incline Chest Press',
            muscleGroupId: 1, // Chest
            primaryMuscles: ['Chest'],
            secondaryMuscles: ['Triceps', 'Front Delts'],
        },
        {
            name: 'Seated Chest Press',
            muscleGroupId: 1, // Chest
            primaryMuscles: ['Chest'],
            secondaryMuscles: ['Triceps', 'Front Delts'],
        },
        {
            name: 'Seated Row',
            muscleGroupId: 2, // Back
            primaryMuscles: ['Mid Back'],
            secondaryMuscles: ['Biceps'],
        },
        {
            name: 'Seated Lat Pulldown',
            muscleGroupId: 2, // Back
            primaryMuscles: ['Lats'],
            secondaryMuscles: ['Biceps'],
        },
        {
            name: 'Seated Shoulder Press',
            muscleGroupId: 6, // Shoulders
            primaryMuscles: ['Side Delts'],
            secondaryMuscles: ['Triceps'],
        },
        {
            name: 'Seated Preacher Curl',
            muscleGroupId: 3, // Arms (Biceps)
            primaryMuscles: ['Biceps'],
            secondaryMuscles: ['Forearms'],
        },
    ],
};





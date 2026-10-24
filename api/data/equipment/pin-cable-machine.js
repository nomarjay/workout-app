// Pin Cable Machine. Primary and secondary muscle names match muscle-groups.js.
export const pinCableMachine = {
    id: 4,
    'equipment-type': 'Pin Cable Machine',
    exercises: [
        {
            name: 'Seated Row',
            muscleGroupId: 2, // Back
            attachment: null,
            primaryMuscles: ['Mid Back',],
            secondaryMuscles: ['Biceps',],
        },
        {
            name: 'Seated Lat Pulldown',
            muscleGroupId: 2, // Back
            attachment: null,
            primaryMuscles: ['Lats'],
            secondaryMuscles: ['Biceps',],
        },
        {
            name: 'Tricep Pulldown',
            muscleGroupId: 3, // Arms (Triceps)
            attachment: null,
            primaryMuscles: ['Triceps'],
            secondaryMuscles: [],
        },
    ],
};





import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { defaultTrainerAlgorithm } from '../../ui/src/utils/trainerAlgorithms.js';
import { renderToString } from '@vue/server-renderer';

test('workout builder offers an optional trainer step without blocking ordinary workout creation', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../../ui', import.meta.url)),
    server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Workout } = await server.ssrLoadModule('/src/views/WorkoutView.vue');
    const workout = { id: 'sample', name: 'Push day', exercises: [{ name: 'Seated Chest Press', equipment: 'Plate Loaded Machine' }] };
    const props = { workouts: [workout], draft: [], workoutName: '', saving: false, deleting: '', editingId: '' };
    const builder = await renderToString(createSSRApp(Workout, props));
    assert.ok(builder.includes('2 · Trainer Mode (optional)'));
    assert.ok(builder.includes('Save workout'));
    assert.ok(builder.includes('>Trainer Mode</button>'));
    const step = await renderToString(createSSRApp(Workout, { ...props, trainerWorkout: workout }));
    assert.ok(step.includes('Trainer Mode · Push day'));
    assert.ok(step.includes('Weight by set'));
    assert.ok(step.includes('Selected algorithm:'));
    assert.ok(step.includes('Default · Four-set progression'));
    const { default: SetGuide } = await server.ssrLoadModule('/src/components/TrainerSetGuide.vue');
    const templateGuide = await renderToString(createSSRApp(SetGuide, { workout, algorithm: defaultTrainerAlgorithm, weightUnit: 'kg', loading: false, assignments: [{ exerciseIndex: 0, referenceMaxWeight: 100, weightIncrement: 0.5 }] }));
    for (const text of ['Warm-up', '35 kg', '12–15', '90–95 kg', '90–95%', '>6</td>']) assert.ok(templateGuide.includes(text), text);
    const { default: Maker } = await server.ssrLoadModule('/src/components/TrainerAlgorithmMaker.vue');
    const maker = await renderToString(createSSRApp(Maker, { modelValue: defaultTrainerAlgorithm }));
    for (const text of ['Selected algorithm', 'Algorithm maker', 'Save as new algorithm', 'Restore default']) assert.ok(maker.includes(text), text);
    const smithGuide = await renderToString(createSSRApp(SetGuide, { workout: { ...workout, exercises: [{ name: 'Smith Bench Press', equipmentId: 5, equipment: 'Smith Machine' }] }, algorithm: defaultTrainerAlgorithm, weightUnit: 'lb', loading: false, assignments: [{ exerciseIndex: 0, oneRepMax: 100 }] }));
    assert.ok(smithGuide.includes('39.2 lb'));
    assert.ok(smithGuide.includes('starting resistance set by Smith machine'));
    assert.ok(!templateGuide.includes('starting resistance set by Smith machine'));
    const guideProps = { workout, weightUnit: 'kg', loading: false, assignments: [{ exerciseIndex: 0, workingWeight: 37.5, sets: 3, reps: 8 }] };
    const guide = await renderToString(createSSRApp(SetGuide, guideProps));
    for (const text of ['Set 1', 'Set 2', 'Set 3', '37.5 kg', '>8</td>']) assert.ok(guide.includes(text), text);
    assert.ok(!guide.includes('Set 4'));
    const changed = await renderToString(createSSRApp(SetGuide, { ...guideProps, weightUnit: 'lb', assignments: [{ exerciseIndex: 0, workingWeight: 0, sets: 1, reps: 12 }] }));
    assert.ok(changed.includes('0 lb'));
    assert.ok(changed.includes('>12</td>'));
    assert.ok(!changed.includes('Set 2'));
    const blank = await renderToString(createSSRApp(SetGuide, { ...guideProps, assignments: [{ exerciseIndex: 0, workingWeight: '', sets: '', reps: '' }] }));
    assert.ok(blank.includes('Enter a one-rep max'));
    assert.ok(!blank.includes('<table'));

    assert.ok(step.includes('Your workout is saved.'));
    assert.ok(step.includes('Configure Trainer Mode'));
    assert.ok(step.includes('Skip for now'));
    assert.ok(!step.includes('Save workout'));
    assert.ok(!step.includes('Delete workout'));
  } finally { await server.close(); }
});

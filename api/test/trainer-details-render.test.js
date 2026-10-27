import test from 'node:test';
import assert from 'node:assert/strict';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { defaultTrainerAlgorithm } from '../../ui/src/utils/trainerAlgorithms.js';

test('trainer details follow the selected occurrence; the full preview includes every set plan', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../../ui', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Details } = await server.ssrLoadModule('/src/components/TrainerWorkoutDetails.vue');
    const { default: Preview } = await server.ssrLoadModule('/src/components/WorkoutPreviewDialog.vue');
    const { default: Step } = await server.ssrLoadModule('/src/components/TrainerModeStep.vue');
    const workout = { id: 'repeat', name: 'Upper body', exercises: [
      { name: 'Chest Press', equipment: 'Plate Loaded Machine', primaryMuscles: ['Chest'], secondaryMuscles: ['Triceps'] },
      { name: 'Chest Press', equipment: 'Selectorized Cable Machine', primaryMuscles: ['Chest'], secondaryMuscles: ['Shoulders'] },
    ] };
    const assignments = [
      { exerciseIndex: 0, useAlgorithm: false, workingWeight: 20, sets: 2, reps: 8 },
      { exerciseIndex: 1, useAlgorithm: false, workingWeight: 40, sets: 3, reps: 12 },
    ];
    const props = { workout, assignments, algorithm: defaultTrainerAlgorithm, weightUnit: 'kg', loading: false };
    const render = (component, extra = {}) => renderToString(createSSRApp(component, { ...props, ...extra }));
    const first = await render(Details, { exerciseIndex: 0 });
    assert.ok(first.includes('Plate Loaded Machine'));
    assert.ok(!first.includes('Selectorized Cable Machine'));
    assert.ok(first.includes('20 kg'));
    assert.ok(!first.includes('40 kg'));
    assert.ok(first.includes('Set 2'));
    assert.ok(!first.includes('Set 3'));
    const second = await render(Details, { exerciseIndex: 1 });
    assert.ok(second.includes('40 kg'));
    assert.ok(!second.includes('20 kg'));
    assert.ok(second.includes('Set 3'));
    assert.ok(second.includes('Secondary muscles: Shoulders'));
    const full = await render(Preview, { open: true });
    assert.ok(full.includes('<dialog'));
    assert.ok(full.includes('Full workout details'));
    assert.ok(full.includes('20 kg') && full.includes('40 kg'));
    assert.equal((full.match(/<table/g) || []).length, 2);
    assert.ok(full.includes('Close preview'));
    assert.ok(!full.includes('<select'), 'Preview is read-only');
    const closed = await render(Preview, { open: false });
    assert.ok(!closed.includes('<table'), 'Full details render only when requested');
    const initial = await render(Step);
    assert.ok(initial.includes('Selected exercise details'));
    assert.ok(initial.includes('Preview full workout'));
    assert.ok(!initial.includes('Full workout details'), 'Selected details are the default view');
    const ids = [...full.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size);
    const calculated = await render(Details, { exerciseIndex: 1, assignments: [{ exerciseIndex: 1, oneRepMax: 100, useAlgorithm: true }] });
    assert.ok(calculated.includes('35 kg'));
    assert.ok(calculated.includes('90–95 kg'));
    const empty = await render(Details, { exerciseIndex: 0, assignments: [{ exerciseIndex: 0, useAlgorithm: false, workingWeight: '', sets: 3, reps: 8 }] });
    assert.ok(empty.includes('Enter a working weight'));
    assert.ok(!empty.includes('<table'));
  } finally { await server.close(); }
});

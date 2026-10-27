import test from 'node:test';
import assert from 'node:assert/strict';
import { computed, createSSRApp, h, ref } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { useManagementSelection } from '../../ui/src/composables/useManagementSelection.js';

test('shared management state supports controlled selection and the same keep-or-clear behavior', () => {
  const open = ref(true), selected = ref(['one', 'two']);
  const controlled = {
    managing: computed({ get: () => open.value, set: value => { open.value = value; } }),
    selectedIds: computed({ get: () => selected.value, set: value => { selected.value = value; } }),
  };
  const state = useManagementSelection(() => false, controlled);
  state.toggleManagement();
  assert.equal(state.closePrompt.value, true);
  state.resolveClose(false);
  assert.equal(open.value, false);
  assert.deepEqual(selected.value, ['one', 'two']);
  state.toggleManagement();
  state.toggleManagement();
  state.resolveClose(true);
  assert.equal(open.value, false);
  assert.deepEqual(selected.value, []);
});

test('one shared panel names each collection and the compact checkbox label is just Select', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../../ui', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Panel } = await server.ssrLoadModule('/src/components/CollectionPanel.vue');
    const { default: Select } = await server.ssrLoadModule('/src/components/CollectionSelect.vue');
    for (const collection of ['exercise', 'workout', 'equipment']) {
      const closed = await renderToString(createSSRApp(Panel, { collection, modelValue: false }));
      assert.ok(closed.includes(`Manage ${collection} collection`));
      assert.ok(!/<details[^>]*\sopen(?:[\s>])/.test(closed));
      const opened = await renderToString(createSSRApp(Panel, { collection, modelValue: true }));
      assert.match(opened, /<details[^>]*\sopen(?:[\s>])/);
    }
    const select = await renderToString(createSSRApp(Select, { modelValue: true, label: 'Select Morning routine for management' }));
    assert.match(select, /<span[^>]*>Select<\/span>/);
    assert.ok(!select.includes('>Select routine<'));
    assert.match(select, /input[^>]*checked/);
    const panels = await renderToString(createSSRApp({ render: () => h('div', ['exercise', 'workout', 'equipment'].map(collection => h(Panel, { collection }))) }));
    const labels = [...panels.matchAll(/aria-labelledby="([^"]+)"/g)].map(match => match[1]);
    assert.equal(labels.length, 3);
    assert.equal(new Set(labels).size, 3, 'Each modal has its own accessible title');
  } finally { await server.close(); }
});

test('workouts and equipment retain management panels and hidden selectors alongside individual action icons', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../../ui', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Equipment } = await server.ssrLoadModule('/src/views/EquipmentView.vue');
    const { default: Workout } = await server.ssrLoadModule('/src/views/WorkoutView.vue');
    const catalog = { equipment: [{ id: '4', 'equipment-type': 'Multifunctional Cable Machine', primaryMuscles: [], secondaryMuscles: [], attachmentIds: [12] }], exercises: [], exerciseDefinitions: [], attachments: [], groups: [] };
    const equipment = await renderToString(createSSRApp(Equipment, { catalog }));
    assert.ok(equipment.includes('Manage equipment collection'));
    assert.ok(!equipment.includes('collection-card-select'));
    assert.ok(equipment.includes('aria-label="Edit Multifunctional Cable Machine"'));
    assert.ok(equipment.includes('aria-label="Delete Multifunctional Cable Machine"'));
    const workouts = await renderToString(createSSRApp(Workout, { catalog, draft: [], workouts: [{ id: 'saved', name: 'Morning routine', exercises: [] }], workoutName: '', saving: false }));
    assert.ok(workouts.includes('Manage workout collection'));
    assert.ok(!workouts.includes('collection-card-select'));
    assert.ok(workouts.includes('aria-label="Edit Morning routine"'));
    assert.ok(workouts.includes('aria-label="Delete Morning routine"'));
  } finally { await server.close(); }
});

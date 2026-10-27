import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedWorkoutExercises } from '../../ui/src/utils/bulkWorkoutSelection.js';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';

test('bulk add uses the chosen equipment and attachment for each selected exercise card', () => {
  const cable = { id: 'row:4', exerciseId: 'row', name: 'Row', equipmentId: 4, equipment: 'Multifunctional Cable Machine', attachmentIds: [12] };
  const plate = { ...cable, id: 'row:3', equipmentId: 3, equipment: 'Plate Loaded Machine', attachmentIds: [] };
  const curl = { ...cable, id: 'curl:4', exerciseId: 'curl', name: 'Curl' };
  const catalog = { exercises: [cable, plate, curl], attachments: [{ id: 12, name: 'Dual Rope' }] };
  const configured = new Map([['row', { ...plate, attachment: 'Dual Rope' }], ['curl', { ...curl, attachment: 'Dual Rope' }]]);
  const result = selectedWorkoutExercises(['row', 'curl'], configured, catalog, 98);
  assert.deepEqual(result.map(item => item.id), ['row:3', 'curl:4']);
  assert.deepEqual(result.map(item => item.attachment), [null, 'Dual Rope']);
  assert.equal(configured.get('row').attachment, 'Dual Rope', 'Selection resolution does not mutate card settings');
  assert.throws(() => selectedWorkoutExercises(['row', 'curl'], configured, catalog, 99), /Only 1 space remains/);
  assert.throws(() => selectedWorkoutExercises(['gone'], configured, catalog), /no longer available/);
  assert.equal(selectedWorkoutExercises(['row', 'row'], configured, catalog).length, 1);
  assert.equal(selectedWorkoutExercises(['row'], new Map(), catalog)[0].id, cable.id);
  const stale = new Map([['row', { ...cable, id: 'old-variant', attachment: 'Dual Rope' }]]);
  assert.equal(selectedWorkoutExercises(['row'], stale, catalog)[0].attachment, null);
});

test('management offers bulk add and disables it for empty selection, busy state, and insufficient bag capacity', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../../ui', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Manager } = await server.ssrLoadModule('/src/components/ExerciseManager.vue');
    const catalog = { exerciseDefinitions: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }], equipment: [], groups: [], exercises: [], attachments: [] };
    const render = props => renderToString(createSSRApp(Manager, { catalog, ...props }));
    const empty = await render({});
    assert.match(empty, /button[^>]*disabled[^>]*>\s*Add selected to workout \(0\)/);
    const ready = await render({ selectedIds: ['one', 'two'], bagCount: 98 });
    assert.ok(ready.includes('Add selected to workout (2)'));
    assert.ok(!/button[^>]*disabled[^>]*>\s*Add selected to workout/.test(ready));
    const full = await render({ selectedIds: ['one', 'two'], bagCount: 99 });
    assert.match(full, /button[^>]*disabled[^>]*>\s*Add selected to workout/);
    assert.ok(full.includes('Only 1 space remains'));
    const busy = await render({ selectedIds: ['one'], disabled: true });
    assert.match(busy, /button[^>]*disabled[^>]*>\s*Add selected to workout/);
  } finally { await server.close(); }
});

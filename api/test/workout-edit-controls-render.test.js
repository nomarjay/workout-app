import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';

test('routine editor exposes movement, equipment, attachment, ordering and separate bulk selection controls', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../../ui', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Workout } = await server.ssrLoadModule('/src/views/WorkoutView.vue');
    const cable = { id: 'row:4', exerciseId: 'row', selectionId: 'first', name: 'Seated Row', equipmentId: 4, equipment: 'Multifunctional Cable Machine', attachmentIds: [12], attachment: 'Dual Rope' };
    const plate = { ...cable, id: 'row:3', equipmentId: 3, equipment: 'Plate Loaded Machine', attachmentIds: [], attachment: null };
    const catalog = { exercises: [cable, plate], attachments: [{ id: 12, name: 'Dual Rope' }] };
    const saved = { id: 'saved', name: 'Saved routine', exercises: [cable] };
    const props = { catalog, workouts: [saved], draft: [cable, { ...cable, selectionId: 'repeat' }], workoutName: 'My edited routine', saving: false, deleting: '', editingId: 'saved' };
    const html = await renderToString(createSSRApp(Workout, props));
    for (const text of ['Manage workout collection', 'Save changes', 'Cancel editing']) assert.ok(html.includes(text), text);
    for (const text of ['Equipment / movement', 'Select exercise 1: Seated Row', 'Select Saved routine for management']) assert.ok(html.includes(text), text);
    for (const text of ['Select routine Saved routine', 'Edit workout', 'Delete workout']) assert.ok(!html.includes(text), text);
    assert.ok(/class="collection-management" open/.test(html), 'Starting an edit opens the controls immediately');
    assert.ok(html.includes('id="workout-editor"'), 'Editing has a stable scroll destination');
    const browsing = await renderToString(createSSRApp(Workout, { ...props, editingId: '' }));
    assert.ok(!/class="collection-management" open/.test(browsing), 'Management stays closed during ordinary browsing');
    assert.ok(!browsing.includes('Select exercise 1: Seated Row'));
    assert.ok(!browsing.includes('Select Saved routine for management'));
    assert.equal((html.match(/class="collection-management"/g) || []).length, 1, 'Only the master workout panel is rendered, even with an active draft');
    assert.ok(!html.includes('Manage workout exercises'), 'There is no second editing panel to open');
    assert.ok(html.indexOf('Manage workout collection') < html.indexOf('class="workout-checkout"'), 'The master panel is at the top of the workout view');
  } finally { await server.close(); }
});

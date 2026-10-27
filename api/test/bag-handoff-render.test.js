import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';

test('management checkboxes are opt-in and the bag provides a direct save and details handoff', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../../ui', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Card } = await server.ssrLoadModule('/src/components/ExerciseVariantCard.vue');
    const { default: Bag } = await server.ssrLoadModule('/src/components/SelectionReference.vue');
    const { default: Dialog } = await server.ssrLoadModule('/src/components/SelectionCloseDialog.vue');
    const render = (component, props) => renderToString(createSSRApp(component, props));
    const exercise = { id: 'row:4', selectionId: 'choice', name: 'Seated Row', equipmentId: 4, equipment: 'Multifunctional Cable Machine', primaryMuscles: ['Lats'], secondaryMuscles: [], attachmentIds: [] };
    const common = { family: { id: 'row', name: exercise.name, variants: [exercise] }, attachments: [], draft: [] };
    const closed = await render(Card, { ...common, managementSelected: true });
    assert.ok(!closed.includes('card-management-select'));
    assert.ok(!closed.includes('management-selected'));
    const opened = await render(Card, { ...common, managementSelectable: true, managementSelected: true });
    assert.ok(opened.includes('Select Seated Row for management'));
    assert.match(opened, /input[^>]*type="checkbox"[^>]*checked/);
    const bag = await render(Bag, { draft: [exercise], name: 'Back day' });
    for (const text of ['Workout name', 'value="Back day"', 'Save &amp; continue', 'Configure sets, reps, and weights now', 'Move Seated Row up in workout bag']) assert.ok(bag.includes(text), text);
    assert.ok(!/button[^>]*type="submit"[^>]*disabled/.test(bag));
    const unnamed = await render(Bag, { draft: [exercise], name: '' });
    assert.match(unnamed, /button[^>]*type="submit"[^>]*disabled/);
    const busy = await render(Bag, { draft: [exercise], name: 'Back day', disabled: true });
    assert.match(busy, /button[^>]*type="submit"[^>]*disabled/);
    const dialog = await render(Dialog, { count: 3, open: false });
    for (const text of ['3 exercises selected', 'Keep selections', 'Clear selections', 'It does not delete exercises', 'Stay in management']) assert.ok(dialog.includes(text), text);
  } finally { await server.close(); }
});

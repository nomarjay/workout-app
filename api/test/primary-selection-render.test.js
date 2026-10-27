import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp, h } from 'vue';
import { renderToString } from '@vue/server-renderer';

test('primary picker is a required radio group while secondary muscles remain independent checkboxes', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../../ui', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Picker } = await server.ssrLoadModule('/src/components/MusclePicker.vue');
    const groups = [{ id: 1, name: 'Chest', muscles: ['Upper Chest', 'Lower Chest'] }, { id: 3, name: 'Arms', muscles: ['Biceps', 'Triceps'] }];
    const render = props => renderToString(createSSRApp(Picker, { groups, ...props }));
    const primary = await render({ modelValue: ['Upper Chest'], label: 'Primary muscle', single: true, required: true });
    assert.ok(primary.includes('Required'));
    const inputs = primary.match(/<input[^>]*>/g);
    assert.ok(inputs.every(input => input.includes('type="radio"') && input.includes('required')));
    assert.equal(inputs.filter(input => input.includes('checked')).length, 1);
    assert.equal(new Set(inputs.map(input => input.match(/name="([^"]+)"/)[1])).size, 1, 'All parent groups share one radio selection');
    const empty = await render({ modelValue: [], label: 'Primary muscle', single: true, required: true });
    assert.ok(empty.includes('Select exactly one primary muscle.'));
    const secondary = await render({ modelValue: ['Biceps', 'Triceps'], label: 'Secondary muscles' });
    assert.ok((secondary.match(/<input[^>]*>/g)).every(input => input.includes('type="checkbox"') && !input.includes('required')));
    assert.equal((secondary.match(/<input[^>]*checked[^>]*>/g)).length, 2);
    const both = await renderToString(createSSRApp({ render: () => h('form', [h(Picker, { groups, single: true, required: true, label: 'First option' }), h(Picker, { groups, single: true, required: true, label: 'Second option' })]) }));
    assert.equal(new Set([...both.matchAll(/name="([^"]+)"/g)].map(match => match[1])).size, 2, 'Equipment options have independent radio groups');
  } finally { await server.close(); }
});

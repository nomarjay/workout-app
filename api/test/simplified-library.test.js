import test from 'node:test';
import assert from 'node:assert/strict';
import { computed, createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { useCatalogBrowser } from '../../ui/src/composables/useCatalogBrowser.js';
import { groupExerciseVariants } from '../../ui/src/utils/exerciseVariants.js';
import { muscleGroups } from '../data/muscle-groups.js';

test('equipment sorting orders compatible machine labels and breaks ties by movement name', () => {
  const families = groupExerciseVariants([
    { exerciseId: 'row', name: 'Row', equipment: 'Selectorized Cable Machine' },
    { exerciseId: 'curl', name: 'Curl', equipment: 'Multifunctional Cable Machine' },
    { exerciseId: 'chest', name: 'Chest Press', equipment: 'Multifunctional Cable Machine' },
    { exerciseId: 'chest', name: 'Chest Press', equipment: 'Plate Loaded Machine' },
  ]);
  const browser = useCatalogBrowser(computed(() => families));
  browser.sort.value = 'equipment';
  assert.deepEqual(browser.visible.value.map(item => item.id), ['curl', 'chest', 'row']);
  browser.search.value = 'chest';
  assert.deepEqual(browser.visible.value.map(item => item.id), ['chest']);
  assert.equal(families.length, 3, 'Equipment sorting preserves grouped exercise cards');
});

test('navigation has one Equipment destination and muscle groups render as a sourced illustrated guide', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../../ui', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: App } = await server.ssrLoadModule('/src/App.vue');
    const { default: Guide } = await server.ssrLoadModule('/src/views/MuscleGroupView.vue');
    const { default: Equipment } = await server.ssrLoadModule('/src/views/ExerciseView.vue');
    const shell = await renderToString(createSSRApp(App));
    const nav = shell.match(/<nav[^>]*aria-label="Data views"[^>]*>([\s\S]*?)<\/nav>/)[1];
    assert.equal((nav.match(/<button/g) || []).length, 4);
    assert.equal((nav.match(/Equipment/g) || []).length, 1);
    assert.ok(!nav.includes('Exercises'));
    const catalog = { groups: muscleGroups.map(group => ({ ...group, image: `https://example.com/${group.id}.png`, imageAttribution: { name: 'Image reference', url: 'https://example.com/credit' } })), exercises: [
      { exerciseId: 'press', name: 'Chest Press', muscleGroupId: 1, equipmentId: 3 },
      { exerciseId: 'press', name: 'Chest Press', muscleGroupId: 1, equipmentId: 4 },
    ], equipment: [], exerciseDefinitions: [], attachments: [] };
    const guide = await renderToString(createSSRApp(Guide, { catalog }));
    assert.equal((guide.match(/<article\b/g) || []).length, 1, 'Only the current group is rendered');
    assert.ok(!guide.includes('data-card'));
    assert.ok(!guide.includes('Display mode'));
    assert.ok(guide.includes('reader-position'));
    const contents = guide.match(/<nav[^>]*aria-label="Muscle guide contents"[^>]*>([\s\S]*?)<\/nav>/)[1];
    assert.equal((contents.match(/<a /g) || []).length, 6);
    assert.ok(contents.includes('aria-current="location"'));
    assert.ok(!guide.includes('type="search"'));
    for (const group of muscleGroups) assert.ok(contents.includes(`href="#muscle-${group.id}"`));
    assert.ok(guide.includes('pectoralis major'));
    assert.ok(!guide.includes('transversus abdominis'), 'Other groups are not shown alongside Chest');
    assert.ok(guide.includes('aria-label="Muscle group reader"'));
    assert.ok(guide.includes('Next group'));
    assert.ok(guide.includes('1 movement uses'));
    assert.ok(guide.includes('OpenStax Anatomy and Physiology'));
    assert.ok(guide.includes('Image reference'));
    assert.ok(guide.includes('loading="lazy"'));
    assert.ok(guide.includes('id="muscle-1"'));
    assert.ok(!guide.includes('id="muscle-2"'));
    const equipment = await renderToString(createSSRApp(Equipment, { catalog, draft: [] }));
    assert.ok(equipment.includes('THE EQUIPMENT COLLECTION'));
    assert.ok(equipment.includes('Equipment type</button>'));
    assert.ok(equipment.includes('Manage exercise collection'));
    assert.ok(equipment.includes('Your workout bag'));
  } finally { await server.close(); }
});

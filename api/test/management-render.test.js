import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';

test('exercise administration is centralized with checkboxes, bulk actions, and a prominent management panel', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../../ui', import.meta.url)),
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });
  try {
    const { default: Manager } = await server.ssrLoadModule(
      '/src/components/ExerciseManager.vue'
    );
    const { default: View } = await server.ssrLoadModule(
      '/src/views/ExerciseView.vue'
    );
    const { default: Card } = await server.ssrLoadModule(
      '/src/components/ExerciseVariantCard.vue'
    );
    const variant = {
      id: 'row:4',
      exerciseId: 'row',
      name: 'Seated Row',
      equipmentId: 4,
      equipment: 'Multifunctional Cable Machine',
      muscleGroupId: 2,
      primaryMuscles: ['Lats'],
      secondaryMuscles: ['Biceps'],
      attachmentIds: [],
    };
    const catalog = {
      groups: [{ id: 2, name: 'Back', muscles: ['Lats'] }],
      equipment: [{ id: '4', 'equipment-type': variant.equipment }],
      attachments: [],
      exercises: [variant],
      exerciseDefinitions: [
        {
          id: 'row',
          name: 'Seated Row',
          muscleGroupId: 2,
          equipmentOptions: [{ key: '4', equipmentId: 4 }],
        },
      ],
    };
    const render = (component, props) =>
      renderToString(createSSRApp(component, props));
    const manager = await render(Manager, { catalog, disabled: false });
    for (const text of [
      'Create new exercise',
      'Edit selected',
      'Delete selected (0)',
      'Select all (1)',
      'type="checkbox"',
    ])
      assert.ok(manager.includes(text) || manager.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').includes(text), text);
    assert.match(manager, /button[^>]*disabled[^>]*>\s*Edit selected/);
    assert.match(manager, /button[^>]*disabled[^>]*>\s*Delete selected/);
    assert.ok(
      !manager.includes('+ New exercise'),
      'Only one create action is presented'
    );
    const card = await render(Card, {
      family: { name: variant.name, variants: [variant] },
      attachments: [],
      draft: [],
    });
    assert.ok(
      card.includes('aria-label="Edit Seated Row"') && card.includes('aria-label="Delete Seated Row"')
    );
    assert.ok(card.includes('Add to workout'));
    assert.ok(!card.includes('Select Seated Row for management'), 'Management selections are hidden by default');
    const checked = await render(Card, {
      family: { id: 'row', name: variant.name, variants: [variant] },
      attachments: [],
      draft: [],
      managementSelected: true,
      managementSelectable: true,
    });
    assert.match(checked, /input[^>]*type="checkbox"[^>]*checked/);
    assert.ok(checked.includes('management-selected'));
    const selectedManager = await render(Manager, {
      catalog,
      selectedIds: ['row'],
      visibleIds: [],
    });
    assert.ok(selectedManager.includes('Delete selected (1)'));
    assert.ok(!/button[^>]*disabled[^>]*>\s*Edit selected/.test(selectedManager));
    assert.ok(selectedManager.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').includes('Select all (0)'));
    assert.ok(!selectedManager.includes('management-list'));
    assert.ok(!selectedManager.includes('Find exercises to manage'));
    const view = await render(View, { catalog, draft: [], saving: false });
    assert.ok(view.includes('class="collection-management"'));
    assert.ok(view.includes('Manage exercise collection'));
    assert.ok(
      view.includes(
        'Create new exercises, edit your selection, or delete in bulk.'
      )
    );
    const empty = await render(Manager, {
      catalog: { ...catalog, exerciseDefinitions: [] },
    });
    assert.ok(empty.includes('No exercise cards match the current filters.'));
    assert.match(empty, /input[^>]*type="checkbox"[^>]*disabled/);
  } finally {
    await server.close();
  }
});

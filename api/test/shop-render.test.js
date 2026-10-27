import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';

test('collection, workout bag, and checkout render selected equipment and preserve save limits', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../../ui', import.meta.url)),
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });
  try {
    const { default: Card } = await server.ssrLoadModule(
      '/src/components/ExerciseVariantCard.vue'
    );
    const { default: Bag } = await server.ssrLoadModule(
      '/src/components/SelectionReference.vue'
    );
    const { default: Workout } = await server.ssrLoadModule(
      '/src/views/WorkoutView.vue'
    );
    const { default: Shop } = await server.ssrLoadModule(
      '/src/views/ExerciseView.vue'
    );
    const cable = {
      id: 'row:4',
      exerciseId: 'row',
      name: 'Seated Row',
      equipmentId: 4,
      equipment: 'Multifunctional Cable Machine',
      image: 'https://example.com/cable-row.jpg',
      primaryMuscles: ['Lats'],
      secondaryMuscles: ['Biceps'],
      attachmentIds: [],
      muscleGroupId: 2,
    };
    const plate = {
      ...cable,
      id: 'row:3',
      equipmentId: 3,
      equipment: 'Plate Loaded Machine',
      image: 'https://example.com/plate-row.jpg',
    };
    const selected = { ...cable, selectionId: 'selection-1' };
    const family = {
      id: 'row',
      name: 'Seated Row',
      primaryGroupName: 'Back',
      variants: [cable, plate],
    };
    const render = (component, props) =>
      renderToString(createSSRApp(component, props));
    const card = await render(Card, {
      family,
      attachments: [],
      draft: [selected],
    });
    for (const text of [
      'IN YOUR BAG · 1',
      'Add another',
      'Choose equipment',
      'cable-row.jpg',
      'Movement details',
    ])
      assert.ok(card.includes(text), text);
    const other = await render(Card, {
      family: { ...family, variants: [plate, cable] },
      attachments: [],
      draft: [],
    });
    assert.ok(other.includes('src="https://example.com/plate-row.jpg"'));
    const bag = await render(Bag, { draft: [selected], name: 'Back day' });
    for (const text of [
      'Workout bag',
      'Back day',
      'Seated Row',
      'Multifunctional Cable Machine',
      'Review workout',
    ])
      assert.ok(bag.includes(text), text);
    const emptyBag = await render(Bag, { draft: [] });
    assert.match(emptyBag, /button[^>]*disabled[^>]*>\s*Review workout/);
    const props = {
      workouts: [],
      draft: [selected],
      workoutName: 'Back day',
      saving: false,
      deleting: '',
      editingId: '',
    };
    const checkout = await render(Workout, props);
    for (const text of [
      'Workout summary',
      'Save workout',
      'Continue browsing',
    ])
      assert.ok(checkout.includes(text), text);
    assert.ok(!checkout.includes('Select exercise 1: Seated Row'));

    const unnamed = await render(Workout, { ...props, workoutName: '' });
    assert.match(unnamed, /button[^>]*disabled[^>]*>\s*Save workout/);
    const busy = await render(Workout, { ...props, saving: true });
    assert.match(busy, /button[^>]*disabled[^>]*>\s*Saving…/);
    const editing = await render(Workout, { ...props, editingId: 'saved-1' });
    assert.ok(
      editing.includes('Save changes') && editing.includes('Cancel editing')
    );
    const catalog = {
      exercises: [cable, plate],
      exerciseDefinitions: [{ id: 'row', name: 'Seated Row' }],
      equipment: [
        { id: 4, 'equipment-type': cable.equipment },
        { id: 3, 'equipment-type': plate.equipment },
      ],
      groups: [{ id: 2, name: 'Back' }],
      attachments: [],
    };
    const full = await render(Shop, {
      catalog,
      draft: [selected],
      saving: false,
      workoutName: 'Back day',
    });
    for (const text of [
      'Find your next movement.',
      'Train by muscle group',
      'Workout bag',
      'Seated Row',
    ])
      assert.ok(full.includes(text), text);
    const fullBag = await render(Shop, {
      catalog,
      draft: Array.from({ length: 100 }, (_, index) => ({
        ...selected,
        selectionId: String(index),
      })),
      saving: false,
    });
    assert.match(
      fullBag,
      /button[^>]*class="primary shop-button add-button"[^>]*disabled/
    );
  } finally {
    await server.close();
  }
});

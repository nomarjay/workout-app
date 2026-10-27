import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';

test('exercise cards show attachment choices only for Multifunctional Cable Machines', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../../ui', import.meta.url)),
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });
  try {
    const { default: Card } = await server.ssrLoadModule(
      '/src/components/ExerciseVariantCard.vue'
    );
    const base = {
      id: 'exercise',
      name: 'Seated Row',
      primaryMuscles: ['Lats'],
      secondaryMuscles: [],
      attachmentIds: [12],
    };
    const render = (variant) =>
      renderToString(
        createSSRApp(Card, {
          family: { id: 'row', name: 'Seated Row', variants: [variant] },
          attachments: [{ id: 12, name: 'Dual Rope' }],
          draft: [],
        })
      );
    for (const [equipmentId, equipment] of [
      [1, 'Selectorized Cable Machine'],
      [3, 'Plate Loaded Machine'],
      [5, 'Smith Machine'],
    ]) {
      const html = await render({ ...base, equipmentId, equipment });
      assert.ok(!html.includes('Choose attachment'));
    }
    const html = await render({
      ...base,
      equipmentId: 4,
      equipment: 'Multifunctional Cable Machine',
    });
    assert.ok(html.includes('Choose attachment') && html.includes('Dual Rope'));
  } finally {
    await server.close();
  }
});

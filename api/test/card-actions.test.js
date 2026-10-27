import test from 'node:test';
import assert from 'node:assert/strict';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

test('card actions have accessible icon buttons and independently respect disabled states', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../../ui', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Actions } = await server.ssrLoadModule('/src/components/CardActions.vue');
    const render = props => renderToString(createSSRApp(Actions, { label: 'Seated Row', ...props }));
    const html = await render({});
    assert.equal((html.match(/<button\b/g) || []).length, 2);
    assert.equal((html.match(/<svg\b/g) || []).length, 2);
    assert.ok(html.includes('aria-label="Edit Seated Row"'));
    assert.ok(html.includes('aria-label="Delete Seated Row"'));
    assert.ok(html.includes('title="Edit Seated Row"'));
    assert.ok(html.includes('title="Delete Seated Row"'));
    assert.equal((html.match(/type="button"/g) || []).length, 2);
    assert.ok(!html.includes('disabled'));
    const editBlocked = await render({ editDisabled: true });
    assert.equal((editBlocked.match(/<button\b[^>]*\sdisabled(?:[\s=>])/g) || []).length, 1);
    const blocked = await render({ disabled: true });
    assert.equal((blocked.match(/<button\b[^>]*\sdisabled(?:[\s=>])/g) || []).length, 2);
  } finally { await server.close(); }
});

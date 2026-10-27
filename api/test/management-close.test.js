import test from 'node:test';
import assert from 'node:assert/strict';
import { useManagementSelection } from '../../ui/src/composables/useManagementSelection.js';

test('minimizing management prompts for active selections and keeps or clears only the selection state', () => {
  const state = useManagementSelection();
  state.toggleManagement();
  assert.equal(state.managing.value, true);
  state.selectedIds.value = ['first', 'second'];
  state.toggleManagement();
  assert.equal(state.closePrompt.value, true);
  assert.equal(state.managing.value, true, 'Management stays open until a choice is made');
  state.cancelClose();
  assert.equal(state.closePrompt.value, false);
  assert.equal(state.managing.value, true);
  assert.deepEqual(state.selectedIds.value, ['first', 'second']);
  state.toggleManagement();
  state.resolveClose(false);
  assert.equal(state.managing.value, false);
  assert.equal(state.closePrompt.value, false);
  assert.deepEqual(state.selectedIds.value, ['first', 'second']);
  state.toggleManagement();
  assert.deepEqual(state.selectedIds.value, ['first', 'second'], 'Reopening restores kept selections');
  state.toggleManagement();
  state.resolveClose(true);
  assert.deepEqual(state.selectedIds.value, []);
  assert.equal(state.managing.value, false);
  state.toggleManagement();
  state.toggleManagement();
  assert.equal(state.managing.value, false);
  assert.equal(state.closePrompt.value, false, 'No prompt is needed with no selection');
});

test('management cannot be minimized while a catalog operation is running', () => {
  let busy = false;
  const state = useManagementSelection(() => busy);
  state.toggleManagement();
  state.selectedIds.value = ['first'];
  busy = true;
  state.toggleManagement();
  assert.equal(state.managing.value, true);
  assert.equal(state.closePrompt.value, false);
});

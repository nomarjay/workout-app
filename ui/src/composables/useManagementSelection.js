import { ref } from 'vue';
export function useManagementSelection(isBusy = () => false, controlled = {}) {
  const managing = controlled.managing || ref(false);
  const selectedIds = controlled.selectedIds || ref([]);
  const closePrompt = ref(false);
  function toggleManagement() {
    if (isBusy()) return;
    if (managing.value && selectedIds.value.length) { closePrompt.value = true; return; }
    managing.value = !managing.value;
  }
  function resolveClose(clear = false) {
    if (clear) selectedIds.value = [];
    managing.value = false;
    closePrompt.value = false;
  }
  function cancelClose() { closePrompt.value = false; }
  return { managing, selectedIds, closePrompt, toggleManagement, resolveClose, cancelClose };
}

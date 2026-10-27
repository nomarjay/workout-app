<script setup>
import { nextTick, onActivated, onDeactivated, onMounted, ref, useId, watch } from 'vue';
const props = defineProps({ open: Boolean, count: Number, itemLabel: { type: String, default: 'exercise' } });
const emit = defineEmits(['keep', 'clear', 'cancel']);
const dialog = ref(null);
const instanceId = useId();
const titleId = `${instanceId}-selection-title`;
const descriptionId = `${instanceId}-selection-description`;
async function sync() {
  await nextTick();
  if (!dialog.value) return;
  if (props.open && !dialog.value.open) dialog.value.showModal();
  else if (!props.open && dialog.value.open) dialog.value.close();
}
watch(() => props.open, sync);
onMounted(sync);
onActivated(sync);
onDeactivated(() => dialog.value?.close());
</script>
<template>
  <dialog ref="dialog" class="selection-close-dialog" :aria-labelledby="titleId" :aria-describedby="descriptionId" @cancel.prevent="emit('cancel')">
    <p class="shop-kicker">ACTIVE SELECTIONS</p><h2 :id="titleId">Keep your selections?</h2><p :id="descriptionId">You have {{ count }} {{ count === 1 ? itemLabel : `${itemLabel}s` }} selected for management. Keep these selections for later, or clear them before minimizing.</p><p class="hint">Clearing selections only unchecks the cards. It does not delete {{ itemLabel }}s or change saved data.</p><div class="row-actions"><button type="button" class="primary" autofocus @click="emit('keep')">Keep selections</button><button type="button" @click="emit('clear')">Clear selections</button><button type="button" class="text-action" @click="emit('cancel')">Stay in management</button></div>
  </dialog>
</template>

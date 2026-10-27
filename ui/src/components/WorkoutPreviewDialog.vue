<script setup>
import { nextTick, onActivated, onDeactivated, onMounted, ref, useId, watch } from 'vue';
import TrainerWorkoutDetails from './TrainerWorkoutDetails.vue';
const props = defineProps({ open: Boolean, workout: Object, assignments: Array, algorithm: Object, weightUnit: String, loading: Boolean });
const emit = defineEmits(['close']);
const dialog = ref(null);
const headingId = `${useId()}-workout-preview`;
async function sync() {
  await nextTick();
  if (!dialog.value) return;
  if (props.open && !dialog.value.open) dialog.value.showModal();
  else if (!props.open && dialog.value.open) dialog.value.close();
}
watch(() => props.open, sync);
onMounted(sync);
onActivated(sync);
onDeactivated(() => { dialog.value?.close(); emit('close'); });
</script>
<template>
  <dialog ref="dialog" class="workout-preview-dialog" :aria-labelledby="headingId" @cancel.prevent="emit('close')" @close="open && emit('close')" @click="($event.target === dialog) && emit('close')">
    <header class="preview-heading"><div><p class="shop-kicker">FULL WORKOUT PREVIEW</p><h2 :id="headingId">{{ workout.name }}</h2></div><button type="button" autofocus @click="emit('close')">Close preview</button></header>
    <TrainerWorkoutDetails v-if="open" :workout="workout" :assignments="assignments" :algorithm="algorithm" :weight-unit="weightUnit" :loading="loading" />
  </dialog>
</template>
<style scoped>
.workout-preview-dialog { width: min(960px, calc(100vw - 32px)); max-height: calc(100dvh - 48px); padding: clamp(16px, 4vw, 32px); border: 1px solid var(--color-border-button); border-radius: 16px; background: var(--color-surface); color: var(--color-text); box-shadow: 0 24px 90px #0008; overflow-y: auto; overscroll-behavior: contain; }
.workout-preview-dialog::backdrop { background: #000b; backdrop-filter: blur(4px); }
.preview-heading { display: flex; align-items: start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
.preview-heading h2 { margin: 0; }
.preview-heading button { flex-shrink: 0; }
@media (prefers-reduced-motion: no-preference) { .workout-preview-dialog[open] { animation: view-arrive 180ms ease-out; } }
</style>

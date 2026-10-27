<script setup>
import { computed, ref, watch } from 'vue';
import CatalogEditor from './CatalogEditor.vue';
const props = defineProps({
  catalog: Object,
  bagCount: { type: Number, default: 0 },
  addStatus: String,
  disabled: Boolean,
  selectedIds: { type: Array, default: () => [] },
  visibleIds: { type: Array, default: null },
});
const emit = defineEmits(['changed', 'busy', 'update:selectedIds', 'add-selected']);
const editor = ref(null);
const selected = computed({
  get: () => props.selectedIds,
  set: (value) => emit('update:selectedIds', value),
});
const deleting = ref(false);
const editing = ref(false);
const error = ref('');
const result = ref(null);
const unavailable = computed(
  () => props.disabled || deleting.value || editing.value
);
const exercises = computed(() =>
  [...(props.catalog.exerciseDefinitions || [])].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
);
const visible = computed(() =>
  exercises.value.filter(
    (item) => props.visibleIds == null || props.visibleIds.includes(item.id)
  )
);
const allShown = computed(
  () =>
    visible.value.length > 0 &&
    visible.value.every((item) => selected.value.includes(item.id))
);
const someShown = computed(
  () =>
    visible.value.some((item) => selected.value.includes(item.id)) &&
    !allShown.value
);
const single = computed(() =>
  selected.value.length === 1
    ? exercises.value.find((item) => item.id === selected.value[0])
    : null
);
watch([deleting, editing], () => emit('busy', deleting.value || editing.value));
function selectShown(checked) {
  const ids = visible.value.map((item) => item.id);
  selected.value = checked
    ? [...new Set([...selected.value, ...ids])]
    : selected.value.filter((id) => !ids.includes(id));
}
async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      data.error || 'Could not update the collection. Please try again.'
    );
  return data;
}
async function removeSelected() {
  if (
    unavailable.value ||
    !selected.value.length ||
    selected.value.length > 500
  )
    return;
  deleting.value = true;
  error.value = '';
  result.value = null;
  let committed = false;
  try {
    const outcome = await request('/api/exercises/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected.value] }),
    });
    committed = true;
    result.value = outcome;
    selected.value = selected.value.filter(
      (id) =>
        !outcome.deletedIds.includes(id) && !outcome.missingIds.includes(id)
    );
    const catalog = await request('/api/catalog');
    const count = outcome.deletedIds.length;
    emit(
      'changed',
      catalog,
      `${count} ${count === 1 ? 'exercise' : 'exercises'} deleted.${
        outcome.blocked.length
          ? ` ${outcome.blocked.length} kept because they are used in saved workouts.`
          : ''
      }`
    );
  } catch (cause) {
    error.value = committed
      ? `The deletion finished, but the collection could not refresh. Use Refresh data. ${cause.message}`
      : cause.message;
  } finally {
    deleting.value = false;
  }
}
function editRecord(record) { if (!unavailable.value && record) editor.value.start(record); }
function removeRecord(record) { if (!unavailable.value && record) editor.value.remove(record); }
defineExpose({ edit: editRecord, remove: removeRecord });
</script>
<template>
  <section class="exercise-manager" aria-label="Exercise management">
    <div class="management-actions">
      <button class="primary" :disabled="unavailable" @click="editor.start()">
        ＋ Create new exercise
      </button>
      <div class="row-actions">
        <button class="primary" :disabled="!selected.length || selected.length > 100 - bagCount || unavailable" @click="emit('add-selected')">Add selected to workout ({{ selected.length }})</button>
        <button
          :disabled="!single || unavailable"
          @click="editor.start(single)"
        >
          Edit selected</button
        ><button
          class="delete"
          :disabled="!selected.length || selected.length > 500 || unavailable"
          @click="removeSelected"
        >
          {{ deleting ? 'Deleting…' : `Delete selected (${selected.length})` }}
        </button>
      </div>
    </div>
    <p class="hint">
      Use the checkboxes on exercise cards below. Select one to edit, or several
      to delete together. Exercises used in saved workouts will be kept.
    </p>
    <p v-if="addStatus" class="hint" role="status">{{ addStatus }}</p>
    <p v-if="selected.length > 100 - bagCount" class="hint">Only {{ Math.max(0, 100 - bagCount) }} {{ 100 - bagCount === 1 ? 'space remains' : 'spaces remain' }} in your workout bag. Select fewer exercises to add them together.</p>
    <p v-if="selected.length > 500" class="message error" role="alert">
      Select up to 500 exercises per deletion.
    </p>
    <CatalogEditor
      ref="editor"
      kind="exercises"
      :catalog="catalog"
      :disabled="disabled || deleting"
      :show-create="false"
      @busy="editing = $event"
      @changed="(data, message) => emit('changed', data, message)"
    />
    <p v-if="error" class="message error" role="alert">{{ error }}</p>
    <div v-if="result" class="management-result" role="status">
      <p>
        {{ result.deletedIds.length }} deleted<span
          v-if="result.missingIds.length"
        >
          · {{ result.missingIds.length }} already removed</span
        ><span v-if="result.blocked.length">
          · {{ result.blocked.length }} kept</span
        >
      </p>
      <ul v-if="result.blocked.length">
        <li v-for="item in result.blocked" :key="item.id">
          {{ item.name }} — {{ item.reason }}
        </li>
      </ul>
    </div>
    <div class="management-selection">
      <label class="checkbox-label"
        ><input
          type="checkbox"
          :checked="allShown"
          :indeterminate="someShown"
          :disabled="!visible.length || unavailable"
          @change="selectShown($event.target.checked)"
        > Select all </label> ({{ visible.length }})
        <span aria-live="polite">{{ selected.length }} selected</span
      ><button
        class="text-action"
        :disabled="!selected.length || unavailable"
        @click="selected = []"
      >
        Clear selection
      </button>
    </div>
    <p v-if="!visible.length" class="hint">
      No exercise cards match the current filters.
    </p>
  </section>
</template>

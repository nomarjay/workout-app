<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue';
import MusclePicker from './MusclePicker.vue';
import { primaryGroupIds } from '../utils/muscleGroups.js';
import { supportsAttachments, attachmentIdsFor } from '../utils/equipment.js';
const props = defineProps({
  kind: String,
  catalog: Object,
  disabled: Boolean,
  showCreate: { type: Boolean, default: true },
});
const emit = defineEmits(['changed', 'busy']);
const open = ref(false);
const id = ref('');
const busy = ref(false);
const error = ref('');
const pendingDelete = ref(null);
const nameInput = ref(null);
const deleteButton = ref(null);
const form = reactive({
  primaryMuscles: [],
  secondaryMuscles: [],
  name: '',
  category: 'Machines',
  attachmentIds: [],
  equipmentOptions: [],
  image: '',
});
const isExercise = computed(() => props.kind === 'exercises');
const label = computed(() => (isExercise.value ? 'exercise' : 'equipment'));
const unavailable = computed(() => busy.value || props.disabled);
const equipmentHasAttachments = computed(() =>
  supportsAttachments({ id: id.value, 'equipment-type': form.name })
);
const catalogMuscles = computed(() => [
  ...new Set([
    ...(props.catalog.exercises || []).flatMap((item) => [
      ...(item.primaryMuscles || []),
      ...(item.secondaryMuscles || []),
    ]),
    ...(props.catalog.equipment || []).flatMap((item) => [
      ...(item.primaryMuscles || []),
      ...(item.secondaryMuscles || []),
    ]),
  ]),
]);
const equipmentTypes = computed(() =>
  [
    ...new Set(
      [
        ...(props.catalog.equipment || []).map(
          (item) => item['equipment-type']
        ),
        form.name,
      ].filter(Boolean)
    ),
  ].sort()
);
watch(busy, (value) => emit('busy', value));
function newOption() {
  return {
    key: crypto.randomUUID(),
    equipmentId: String(props.catalog.equipment[0]?.id || ''),
    attachmentId: '',
    primaryMuscles: [],
    secondaryMuscles: [],
    isIsolation: false,
    image: '',
  };
}
async function start(record = null) {
  if (unavailable.value) return;
  id.value = record?.id || '';
  form.name = record?.name || record?.['equipment-type'] || '';
  form.category = record?.category || 'Machines';
  form.primaryMuscles = [...(record?.primaryMuscles || [])];
  form.secondaryMuscles = [...(record?.secondaryMuscles || [])];
  form.image = record?.image || '';
  form.attachmentIds = attachmentIdsFor(record).map(String);
  form.equipmentOptions = record?.equipmentOptions?.map((option) => ({
    ...option,
    equipmentId: String(option.equipmentId),
    attachmentId:
      option.attachmentId == null ? '' : String(option.attachmentId),
    primaryMuscles: [...(option.primaryMuscles || [])],
    secondaryMuscles: [...(option.secondaryMuscles || [])],
    isIsolation: Boolean(option.isIsolation),
    image: option.image || '',
  })) || [newOption()];
  open.value = true;
  pendingDelete.value = null;
  error.value = '';
  await nextTick();
  nameInput.value?.focus();
}
function close() {
  if (!unavailable.value) {
    open.value = false;
    pendingDelete.value = null;
    error.value = '';
  }
}
function attachmentsFor(option) {
  const ids = attachmentIdsFor(
    props.catalog.equipment.find(
      (item) => String(item.id) === option.equipmentId
    )
  );
  return props.catalog.attachments.filter((item) =>
    ids.some((id) => String(id) === String(item.id))
  );
}
async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.error || 'Could not save the catalog change. Please try again.'
    );
  }
  return response.status === 204 ? null : response.json();
}
async function mutate(method, target, body) {
  if (unavailable.value) return;
  busy.value = true;
  error.value = '';
  let committed = false;
  try {
    await request(
      `/api/${props.kind}${target ? `/${encodeURIComponent(target)}` : ''}`,
      {
        method,
        ...(body
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }
          : {}),
      }
    );
    committed = true;
    open.value = false;
    pendingDelete.value = null;
    const catalog = await request('/api/catalog');
    emit(
      'changed',
      catalog,
      `${label.value[0].toUpperCase()}${label.value.slice(1)} ${
        method === 'DELETE' ? 'deleted' : target ? 'updated' : 'created'
      }.`
    );
  } catch (cause) {
    error.value = committed
      ? `The change was saved, but the catalog could not refresh. Use Refresh data to reload it. ${cause.message}`
      : cause.message;
  } finally {
    busy.value = false;
  }
}
const missingPrimary = computed(() => isExercise.value && form.equipmentOptions.some(option => option.primaryMuscles.length !== 1));
function groupNameFor(option) {
  const ids = primaryGroupIds(option.primaryMuscles, props.catalog.groups);
  return props.catalog.groups.filter(group => ids.includes(group.id)).map(group => group.name).join(', ');
}
function save() {
  if (missingPrimary.value) { error.value = 'Select exactly one primary muscle for each equipment option.'; return; }
  const body = isExercise.value
    ? {
        name: form.name,
        equipmentOptions: form.equipmentOptions.map((option) => ({
          ...option,
          attachmentId: attachmentsFor(option).length
            ? option.attachmentId || null
            : null,
          primaryMuscles: [...option.primaryMuscles],
          secondaryMuscles: [...option.secondaryMuscles],
        })),
      }
    : {
        'equipment-type': form.name,
        category: form.category,
        primaryMuscles: [...form.primaryMuscles],
        secondaryMuscles: [...form.secondaryMuscles],
        attachmentIds: equipmentHasAttachments.value ? form.attachmentIds : [],
        image: form.image,
      };
  return mutate(id.value ? 'PUT' : 'POST', id.value, body);
}
async function remove(record) {
  if (unavailable.value) return;
  pendingDelete.value = record;
  open.value = false;
  error.value = '';
  await nextTick();
  deleteButton.value?.focus();
}
defineExpose({ start, remove });
</script>
<template>
  <section class="catalog-editor" :aria-label="`Manage ${kind}`">
    <div v-if="showCreate" class="row-actions">
      <button class="primary" :disabled="unavailable" @click="start()">
        + New {{ label }}</button
      ><span v-if="busy" role="status" class="hint">Saving catalog…</span>
    </div>
    <p v-if="error" class="message error" role="alert">{{ error }}</p>
    <div v-if="pendingDelete" class="panel delete-confirm">
      <p>Delete {{ pendingDelete.name || pendingDelete['equipment-type'] }}?</p>
      <p class="hint">
        Items used by exercises or saved workouts must have those references
        removed first.
      </p>
      <div class="row-actions">
        <button
          ref="deleteButton"
          class="delete"
          :disabled="unavailable"
          @click="mutate('DELETE', pendingDelete.id)"
        >
          Delete {{ label }}</button
        ><button :disabled="unavailable" @click="close">Cancel</button>
      </div>
    </div>
    <form v-if="open" class="panel catalog-form" @submit.prevent="save">
      <h2>{{ id ? 'Edit' : 'New' }} {{ label }}</h2>
      <fieldset :disabled="unavailable">
        <label v-if="isExercise"
          >Exercise name<input
            ref="nameInput"
            v-model="form.name"
            required
            maxlength="100"
        /></label>
        <template v-if="isExercise">
          <h3>Equipment options</h3>
          <p v-if="!catalog.equipment.length" class="hint">
            Create equipment on the Equipment tab before adding an exercise.
          </p>
          <fieldset
            v-for="(option, index) in form.equipmentOptions"
            :key="option.key"
            class="option-editor"
          >
            <legend>Option {{ index + 1 }}</legend>
            <label
              >Equipment<select
                v-model="option.equipmentId"
                required
                @change="option.attachmentId = ''"
              >
                <option value="" disabled>Choose equipment</option>
                <option
                  v-for="machine in catalog.equipment"
                  :key="machine.id"
                  :value="String(machine.id)"
                >
                  {{ machine['equipment-type'] }}
                </option>
              </select></label
            >
            <label v-if="attachmentsFor(option).length"
              >Default attachment<select v-model="option.attachmentId">
                <option value="">None</option>
                <option
                  v-for="item in attachmentsFor(option)"
                  :key="item.id"
                  :value="String(item.id)"
                >
                  {{ item.name }}
                </option>
              </select></label
            >
            <MusclePicker
              v-model="option.primaryMuscles"
              label="Primary muscle"
              single
              required
              :groups="catalog.groups"
              :extra-muscles="catalogMuscles"
            />
            <p v-if="groupNameFor(option)" class="hint derived-muscle-group">Muscle group: <strong>{{ groupNameFor(option) }}</strong></p>
            <MusclePicker
              v-model="option.secondaryMuscles"
              label="Secondary muscles"
              :groups="catalog.groups"
              :extra-muscles="catalogMuscles"
            />
            <label class="checkbox-label"
              ><input v-model="option.isIsolation" type="checkbox" /> Isolation
              movement</label
            >
            <label
              >Image URL (optional)<input
                v-model="option.image"
                type="url"
                maxlength="2000"
                placeholder="https://…"
            /></label>
            <button
              type="button"
              :disabled="form.equipmentOptions.length === 1"
              @click="form.equipmentOptions.splice(index, 1)"
            >
              Remove option {{ index + 1 }}
            </button>
          </fieldset>
          <button
            type="button"
            :disabled="
              form.equipmentOptions.length >= 30 || !catalog.equipment.length
            "
            @click="form.equipmentOptions.push(newOption())"
          >
            + Add equipment option
          </button>
        </template>
        <template v-else>
          <div class="equipment-form-section">
            <h3>Machine details</h3>
            <label
              >Equipment type<select
                ref="nameInput"
                v-model="form.name"
                required
              >
                <option value="" disabled>Choose equipment type</option>
                <option
                  v-for="type in equipmentTypes"
                  :key="type"
                  :value="type"
                >
                  {{ type }}
                </option>
              </select></label
            >
            <label
              >Image URL (optional)<input
                v-model="form.image"
                type="url"
                maxlength="2000"
                placeholder="https://…"
            /></label>
          </div>
          <div class="equipment-form-section">
            <h3>Muscles this machine can target</h3>
            <p class="hint">
              Select its primary and secondary muscles. Each exercise can have
              its own muscle selections.
            </p>
            <MusclePicker
              v-model="form.primaryMuscles"
              label="Primary muscles"
              :groups="catalog.groups"
              :extra-muscles="catalogMuscles"
            />
            <MusclePicker
              v-model="form.secondaryMuscles"
              label="Secondary muscles"
              :groups="catalog.groups"
              :extra-muscles="catalogMuscles"
            />
          </div>
          <fieldset
            v-if="equipmentHasAttachments"
            class="equipment-form-section attachment-selection"
          >
            <legend>Supported attachments</legend>
            <p class="hint">
              Choose the attachments available on this Multifunctional Cable
              Machine.
            </p>
            <div class="attachment-choices">
              <label
                v-for="attachment in catalog.attachments"
                :key="attachment.id"
                class="checkbox-label"
                ><input
                  v-model="form.attachmentIds"
                  type="checkbox"
                  :value="String(attachment.id)"
                />{{ attachment.name }}</label
              >
            </div>
          </fieldset>
        </template>
        <div class="row-actions">
          <button
            class="primary"
            :disabled="isExercise && (!catalog.equipment.length || missingPrimary)"
          >
            {{
              busy ? 'Saving…' : id ? 'Save changes' : `Create ${label}`
            }}</button
          ><button type="button" @click="close">Cancel</button>
        </div>
      </fieldset>
    </form>
  </section>
</template>

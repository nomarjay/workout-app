<script setup>
import { computed, nextTick, reactive, ref } from 'vue';
const props = defineProps({ kind: String, catalog: Object, disabled: Boolean });
const emit = defineEmits(['changed']);
const open = ref(false);
const id = ref('');
const busy = ref(false);
const error = ref('');
const pendingDelete = ref(null);
const nameInput = ref(null);
const deleteButton = ref(null);
const form = reactive({ name: '', category: 'Machines', attachmentIds: [], muscleGroupId: '', equipmentOptions: [], image: '' });
const isExercise = computed(() => props.kind === 'exercises');
const label = computed(() => isExercise.value ? 'exercise' : 'equipment');
const unavailable = computed(() => busy.value || props.disabled);
const muscleList = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);
function newOption() {
  return { key: crypto.randomUUID(), equipmentId: String(props.catalog.equipment[0]?.id || ''), attachmentId: '', primaryMuscles: '', secondaryMuscles: '', isIsolation: false, image: '' };
}
async function start(record = null) {
  if (unavailable.value) return;
  id.value = record?.id || '';
  form.name = record?.name || record?.['equipment-type'] || '';
  form.category = record?.category || 'Machines';
  form.image = record?.image || '';
  form.attachmentIds = (record?.attachmentIds || []).map(String);
  form.muscleGroupId = String(record?.muscleGroupId || props.catalog.groups[0]?.id || '');
  form.equipmentOptions = record?.equipmentOptions?.map(option => ({ ...option,
    equipmentId: String(option.equipmentId), attachmentId: option.attachmentId == null ? '' : String(option.attachmentId),
    primaryMuscles: (option.primaryMuscles || []).join(', '), secondaryMuscles: (option.secondaryMuscles || []).join(', '),
    isIsolation: Boolean(option.isIsolation), image: option.image || '',
  })) || [newOption()];
  open.value = true;
  pendingDelete.value = null;
  error.value = '';
  await nextTick();
  nameInput.value?.focus();
}
function close() { if (!unavailable.value) { open.value = false; pendingDelete.value = null; error.value = ''; } }
function attachmentsFor(option) {
  const ids = props.catalog.equipment.find(item => String(item.id) === option.equipmentId)?.attachmentIds || [];
  return props.catalog.attachments.filter(item => ids.some(id => String(id) === String(item.id)));
}
async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not save the catalog change. Please try again.');
  }
  return response.status === 204 ? null : response.json();
}
async function mutate(method, target, body) {
  if (unavailable.value) return;
  busy.value = true;
  error.value = '';
  let committed = false;
  try {
    await request(`/api/${props.kind}${target ? `/${encodeURIComponent(target)}` : ''}`, {
      method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    committed = true;
    open.value = false;
    pendingDelete.value = null;
    const catalog = await request('/api/catalog');
    emit('changed', catalog, `${label.value[0].toUpperCase()}${label.value.slice(1)} ${method === 'DELETE' ? 'deleted' : target ? 'updated' : 'created'}.`);
  } catch (cause) {
    error.value = committed ? `The change was saved, but the catalog could not refresh. Use Refresh data to reload it. ${cause.message}` : cause.message;
  } finally { busy.value = false; }
}
function save() {
  const body = isExercise.value ? { name: form.name, muscleGroupId: form.muscleGroupId,
    equipmentOptions: form.equipmentOptions.map(option => ({ ...option,
      attachmentId: option.attachmentId || null, primaryMuscles: muscleList(option.primaryMuscles), secondaryMuscles: muscleList(option.secondaryMuscles),
    })) } : { 'equipment-type': form.name, category: form.category, attachmentIds: form.attachmentIds, image: form.image };
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
    <div class="row-actions"><button class="primary" :disabled="unavailable" @click="start()">+ New {{ label }}</button><span v-if="busy" role="status" class="hint">Saving catalog…</span></div>
    <p v-if="error" class="message error" role="alert">{{ error }}</p>
    <div v-if="pendingDelete" class="panel delete-confirm">
      <p>Delete {{ pendingDelete.name || pendingDelete['equipment-type'] }}?</p>
      <p class="hint">Items used by exercises or saved workouts must have those references removed first.</p>
      <div class="row-actions"><button ref="deleteButton" class="delete" :disabled="unavailable" @click="mutate('DELETE', pendingDelete.id)">Delete {{ label }}</button><button :disabled="unavailable" @click="close">Cancel</button></div>
    </div>
    <form v-if="open" class="panel catalog-form" @submit.prevent="save">
      <h2>{{ id ? 'Edit' : 'New' }} {{ label }}</h2>
      <fieldset :disabled="unavailable">
        <label>{{ isExercise ? 'Exercise name' : 'Equipment type' }}<input ref="nameInput" v-model="form.name" required maxlength="100"></label>
        <template v-if="isExercise">
          <label>Muscle group<select v-model="form.muscleGroupId" required><option v-for="group in catalog.groups" :key="group.id" :value="String(group.id)">{{ group.name }}</option></select></label>
          <h3>Equipment options</h3>
          <p v-if="!catalog.equipment.length" class="hint">Create equipment on the Equipment tab before adding an exercise.</p>
          <fieldset v-for="(option, index) in form.equipmentOptions" :key="option.key" class="option-editor">
            <legend>Option {{ index + 1 }}</legend>
            <label>Equipment<select v-model="option.equipmentId" required @change="option.attachmentId = ''"><option value="" disabled>Choose equipment</option><option v-for="machine in catalog.equipment" :key="machine.id" :value="String(machine.id)">{{ machine['equipment-type'] }}</option></select></label>
            <label>Default attachment<select v-model="option.attachmentId"><option value="">None</option><option v-for="item in attachmentsFor(option)" :key="item.id" :value="String(item.id)">{{ item.name }}</option></select></label>
            <label>Primary muscles (comma separated)<input v-model="option.primaryMuscles" placeholder="e.g. Pectoralis Major"></label>
            <label>Secondary muscles (comma separated)<input v-model="option.secondaryMuscles" placeholder="e.g. Triceps, Anterior Deltoids"></label>
            <label class="checkbox-label"><input v-model="option.isIsolation" type="checkbox"> Isolation movement</label>
            <label>Image URL (optional)<input v-model="option.image" type="url" maxlength="2000" placeholder="https://…"></label>
            <button type="button" :disabled="form.equipmentOptions.length === 1" @click="form.equipmentOptions.splice(index, 1)">Remove option {{ index + 1 }}</button>
          </fieldset>
          <button type="button" :disabled="form.equipmentOptions.length >= 30 || !catalog.equipment.length" @click="form.equipmentOptions.push(newOption())">+ Add equipment option</button>
        </template>
        <template v-else>
          <label>Category<select v-model="form.category"><option>Machines</option></select></label>
          <label>Image URL (optional)<input v-model="form.image" type="url" maxlength="2000" placeholder="https://…"></label>
          <fieldset><legend>Supported attachments</legend><label v-for="attachment in catalog.attachments" :key="attachment.id" class="checkbox-label"><input v-model="form.attachmentIds" type="checkbox" :value="String(attachment.id)"> {{ attachment.name }}</label></fieldset>
        </template>
        <div class="row-actions"><button class="primary" :disabled="isExercise && !catalog.equipment.length">{{ busy ? 'Saving…' : id ? 'Save changes' : `Create ${label}` }}</button><button type="button" @click="close">Cancel</button></div>
      </fieldset>
    </form>
  </section>
</template>

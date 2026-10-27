<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import CatalogEditor from '../components/CatalogEditor.vue';
import CatalogToolbar from '../components/CatalogToolbar.vue';
import CollectionPanel from '../components/CollectionPanel.vue';
import CollectionSelect from '../components/CollectionSelect.vue';
import DataCard from '../components/DataCard.vue';
import CardActions from '../components/CardActions.vue';
import { equipmentLabel } from '../utils/equipment.js';
import { useCatalogBrowser } from '../composables/useCatalogBrowser.js';
const props = defineProps({ catalog: Object, saving: Boolean });
const emit = defineEmits(['catalogChanged']);
const editor = ref(null);
const managing = ref(false);
async function manageCard(equipment, action) {
  if (busy.value) return;
  managing.value = true;
  await nextTick();
  editor.value[action === 'edit' ? 'start' : 'remove'](equipment);
}
const selected = ref([]);
const deleting = ref(false);
const editorBusy = ref(false);
const error = ref('');
const busy = computed(() => props.saving || deleting.value || editorBusy.value);
const { search, sort, layout, visible } = useCatalogBrowser(computed(() => props.catalog.equipment));
const single = computed(() => selected.value.length === 1 ? props.catalog.equipment.find(item => item.id === selected.value[0]) : null);
const allShown = computed(() => visible.value.length > 0 && visible.value.every(item => selected.value.includes(item.id)));
watch(() => props.catalog.equipment, () => { selected.value = selected.value.filter(id => props.catalog.equipment.some(item => item.id === id)); });
function toggle(id, checked) { selected.value = checked ? [...new Set([...selected.value, id])] : selected.value.filter(value => value !== id); }
function selectShown(checked) { const ids = visible.value.map(item => item.id); selected.value = checked ? [...new Set([...selected.value, ...ids])] : selected.value.filter(id => !ids.includes(id)); }
async function removeSelected() {
  if (busy.value || !selected.value.length) return;
  deleting.value = true;
  error.value = '';
  const failed = [];
  let removed = 0;
  try {
    for (const id of [...selected.value]) {
      const response = await fetch(`/api/equipment/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (response.ok) { removed++; selected.value = selected.value.filter(value => value !== id); }
      else { const body = await response.json().catch(() => ({})); failed.push(`${props.catalog.equipment.find(item => item.id === id)?.['equipment-type'] || id}: ${body.error || 'Could not delete.'}`); }
    }
    const response = await fetch('/api/catalog');
    if (!response.ok) throw new Error('Could not refresh the collection. Use Refresh data.');
    emit('catalogChanged', await response.json(), `${removed} equipment items deleted.`);
    error.value = failed.join(' ');
  } catch (cause) { error.value = cause.message; }
  finally { deleting.value = false; }
}
</script>
<template>
  <CollectionPanel v-model="managing" v-model:selected-ids="selected" collection="equipment" :disabled="busy" description="Create equipment, edit a selected item, or delete selected items."><section class="exercise-manager"><div class="management-actions"><button class="primary" :disabled="busy" @click="editor.start()">＋ Create new equipment</button><div class="row-actions"><button :disabled="!single || busy" @click="editor.start(single)">Edit selected</button><button class="delete" :disabled="!selected.length || busy" @click="removeSelected">{{ deleting ? 'Deleting…' : `Delete selected (${selected.length})` }}</button></div></div><p class="hint">Equipment used by exercises or saved workouts will be kept.</p><CatalogEditor ref="editor" kind="equipment" :catalog="catalog" :disabled="saving || deleting" :show-create="false" @busy="editorBusy = $event" @changed="(data, message) => emit('catalogChanged', data, message)" /><p v-if="error" class="message error" role="alert">{{ error }}</p><div class="management-selection"><label class="checkbox-label"><input type="checkbox" :checked="allShown" :indeterminate="visible.some(item => selected.includes(item.id)) && !allShown" :disabled="busy || !visible.length" @change="selectShown($event.target.checked)">Select all shown ({{ visible.length }})</label><span>{{ selected.length }} selected</span><button class="text-action" :disabled="!selected.length || busy" @click="selected = []">Clear selection</button></div></section></CollectionPanel>
  <CatalogToolbar v-model:search="search" v-model:sort="sort" v-model:layout="layout" :count="visible.length" />
  <div class="catalog" :class="layout"><DataCard v-for="equipment in visible" :key="equipment.id" :class="{ 'collection-selected': managing && selected.includes(equipment.id) }" :title="equipmentLabel(equipment)" :image="equipment.image" :image-attribution="equipment.imageAttribution" kind="Equipment"><template #media-overlay><CollectionSelect v-if="managing" :model-value="selected.includes(equipment.id)" :disabled="busy" :label="`Select ${equipmentLabel(equipment)} for management`" @update:model-value="toggle(equipment.id, $event)" /></template><div class="equipment-facts"><p v-if="equipment.primaryMuscles?.length"><strong>Primary:</strong> {{ equipment.primaryMuscles.join(', ') }}</p><p v-if="equipment.secondaryMuscles?.length"><strong>Secondary:</strong> {{ equipment.secondaryMuscles.join(', ') }}</p></div><CardActions :label="equipmentLabel(equipment)" :disabled="busy" @edit="manageCard(equipment, 'edit')" @delete="manageCard(equipment, 'delete')" /></DataCard></div><p v-if="!visible.length" class="empty">No equipment matches your search.</p>
</template>

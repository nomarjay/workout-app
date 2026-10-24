<script setup>
import { computed, ref } from 'vue';
import CatalogEditor from '../components/CatalogEditor.vue';
import CatalogToolbar from '../components/CatalogToolbar.vue';
import DataCard from '../components/DataCard.vue';
import { equipmentLabel, exerciseLabel } from '../utils/equipment.js';
import { useCatalogBrowser } from '../composables/useCatalogBrowser.js';
const props = defineProps({ catalog: Object, saving: Boolean });
defineEmits(['catalogChanged']);
const editor = ref(null);
const { search, sort, layout, visible } = useCatalogBrowser(computed(() => props.catalog.equipment));
const exercisesFor = equipment => props.catalog.exercises.filter(e => String(e.equipmentId) === String(equipment.id));
</script>
<template>
  <CatalogEditor ref="editor" kind="equipment" :catalog="catalog" :disabled="saving" @changed="(data, message) => $emit('catalogChanged', data, message)" />
  <CatalogToolbar v-model:search="search" v-model:sort="sort" v-model:layout="layout" :count="visible.length" equipment-sort />
  <div class="catalog" :class="layout"><DataCard v-for="equipment in visible" :key="equipment.id" :title="equipmentLabel(equipment)" :image="equipment.image" kind="Equipment">
    <p class="hint">{{ exercisesFor(equipment).length }} associated exercises</p><ul><li v-for="exercise in exercisesFor(equipment)" :key="exercise.id">{{ exerciseLabel(exercise) }} <span v-if="Number(equipment.id) === 1 && exercise.isIsolation" class="isolation-marker">Isolation</span></li></ul>
    <div class="row-actions"><button :disabled="saving" @click="editor.start(equipment)">Edit equipment</button><button class="delete" :disabled="saving" @click="editor.remove(equipment)">Delete equipment</button></div>
  </DataCard></div><p v-if="!visible.length" class="empty">No equipment matches your search.</p>
</template>




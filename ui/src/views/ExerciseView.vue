<script setup>
import { computed, ref } from 'vue';
import CatalogToolbar from '../components/CatalogToolbar.vue';
import ExerciseVariantCard from '../components/ExerciseVariantCard.vue';
import SelectionReference from '../components/SelectionReference.vue';
import FilterPills from '../components/FilterPills.vue';
import { groupExerciseVariants } from '../utils/exerciseVariants.js';
import { useCatalogBrowser } from '../composables/useCatalogBrowser.js';
import CatalogEditor from '../components/CatalogEditor.vue';
import { belongsToPrimaryGroup } from '../utils/muscleGroups.js';
const props = defineProps({ catalog: Object, draft: Array, saving: Boolean, workoutName: String });
defineEmits(['add', 'review', 'undo', 'remove', 'catalogChanged']);
const editor = ref(null);
const definition = family => props.catalog.exerciseDefinitions.find(item => item.id === family.id);
const group = ref('');
const equipment = ref('');
const families = computed(() => groupExerciseVariants(props.catalog.exercises.filter(item =>
  (!group.value || belongsToPrimaryGroup(item, group.value)) &&
  (!equipment.value || String(item.equipmentId) === equipment.value))).map(family => ({
    ...family,
    primaryGroupName: props.catalog.groups.find(item => belongsToPrimaryGroup(family.variants[0], item.id))?.name || 'Other',
  })));
const { search, sort, layout, visible } = useCatalogBrowser(families);
sort.value = 'muscle';
</script>
<template>
  <CatalogEditor ref="editor" kind="exercises" :catalog="catalog" :disabled="saving" @changed="(data, message) => $emit('catalogChanged', data, message)" />
  <div class="selection-bar"><div><strong>Choose your exercises</strong><p class="hint" aria-live="polite">{{ draft.length }} selected · Choose equipment before adding.</p></div><div class="row-actions"><button :disabled="!draft.length || saving" @click="$emit('undo')">Undo last add</button><button class="primary" @click="$emit('review')">Review workout ({{ draft.length }}) →</button></div></div>
  <div class="picker-workspace"><section>
    <CatalogToolbar v-model:search="search" v-model:sort="sort" v-model:layout="layout" :count="visible.length" equipment-sort muscle-sort>
      <FilterPills v-model="group" label="Primary muscle group" :options="catalog.groups" all-label="All groups" />
      <FilterPills v-model="equipment" label="Equipment" :options="catalog.equipment.map(item => ({ id: item.id, name: item['equipment-type'] }))" all-label="All equipment" />
    </CatalogToolbar>
    <TransitionGroup name="selection" tag="div" class="catalog" :class="layout"><ExerciseVariantCard v-for="family in visible" :key="family.id" :family="family" :attachments="catalog.attachments" :draft="draft" :disabled="saving || draft.length >= 100" :managing-disabled="saving" @add="$emit('add', $event)" @edit="editor.start(definition(family))" @delete="editor.remove(definition(family))" /></TransitionGroup>
    <p v-if="!visible.length" class="empty">No exercises match your search and filters.</p>
  </section><SelectionReference :draft="draft" :name="workoutName" :disabled="saving" @remove="$emit('remove', $event)" /></div>
</template>


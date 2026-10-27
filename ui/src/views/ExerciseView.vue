<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import CatalogToolbar from '../components/CatalogToolbar.vue';
import ExerciseVariantCard from '../components/ExerciseVariantCard.vue';
import SelectionReference from '../components/SelectionReference.vue';
import FilterPills from '../components/FilterPills.vue';
import { groupExerciseVariants } from '../utils/exerciseVariants.js';
import { useCatalogBrowser } from '../composables/useCatalogBrowser.js';
import ExerciseManager from '../components/ExerciseManager.vue';
import CollectionPanel from '../components/CollectionPanel.vue';
import { selectedWorkoutExercises } from '../utils/bulkWorkoutSelection.js';
import { belongsToPrimaryGroup } from '../utils/muscleGroups.js';
const props = defineProps({
  catalog: Object,
  draft: Array,
  saving: Boolean,
  workoutName: String,
  editingId: String,
});
const emit = defineEmits(['add', 'review', 'undo', 'remove', 'move', 'save', 'update:workoutName', 'catalogChanged']);
const managementBusy = ref(false);
const manager = ref(null);
async function manageCard(family, action) {
  if (props.saving || managementBusy.value) return;
  const record = props.catalog.exerciseDefinitions.find(item => item.id === family.id);
  if (!record) return;
  managing.value = true;
  await nextTick();
  manager.value[action](record);
  manager.value.$el?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}
const configurations = new Map();
const batchStatus = ref('');
function addSelectedToWorkout() {
  if (!managing.value || props.saving || managementBusy.value || !selectedIds.value.length) return;
  try {
    const exercises = selectedWorkoutExercises(selectedIds.value, configurations, props.catalog, props.draft.length);
    for (const exercise of exercises) emit('add', exercise);
    batchStatus.value = `Added ${exercises.length} ${exercises.length === 1 ? 'exercise' : 'exercises'} to your workout bag.`;
  } catch (cause) { batchStatus.value = cause.message; }
}
const managing = ref(false);
const selectedIds = ref([]);
watch(
  () => props.catalog.exerciseDefinitions,
  () => {
    const ids = new Set(
      (props.catalog.exerciseDefinitions || []).map((item) => item.id)
    );
    selectedIds.value = selectedIds.value.filter((id) => ids.has(id));
  }
);
function selectCard(id, checked) {
  if (!managing.value || props.saving || managementBusy.value) return;
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, id])]
    : selectedIds.value.filter((value) => value !== id);
}
const group = ref('');
const equipment = ref('');
const filtersOpen = ref(false);
const families = computed(() =>
  groupExerciseVariants(
    props.catalog.exercises.filter(
      (item) =>
        (!group.value || belongsToPrimaryGroup(item, group.value)) &&
        (!equipment.value || String(item.equipmentId) === equipment.value)
    )
  ).map((family) => ({
    ...family,
    primaryGroupName:
      props.catalog.groups.find((item) =>
        belongsToPrimaryGroup(family.variants[0], item.id)
      )?.name || 'Other',
  }))
);
const { search, sort, layout, visible } = useCatalogBrowser(families);
sort.value = 'muscle';
function clearFilters() {
  group.value = '';
  equipment.value = '';
  search.value = '';
}
</script>
<template>
  <div class="exercise-shop">
    <header class="shop-heading">
      <div>
        <p class="shop-kicker">THE EXERCISE COLLECTION</p>
        <h2>Find your next movement.</h2>
        <p>Pick your focus. Choose your equipment. Make it your workout.</p>
      </div>
      <button class="shop-bag-link" :disabled="saving" @click="$emit('review')">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 7h14l2 14H3L5 7Z" />
          <path d="M9 8V5a3 3 0 0 1 6 0v3" /></svg
        >Your workout <span>{{ draft.length }}</span>
      </button>
    </header>
    <div class="shop-steps" aria-label="Workout building steps">
      <span class="current"><b>01</b> Explore exercises</span
      ><span><b>02</b> Review your workout</span
      ><span><b>03</b> Make it a routine</span>
    </div>
    <div class="shop-category-strip">
      <FilterPills
        v-model="group"
        label="Train by muscle group"
        :options="catalog.groups"
        all-label="All movements"
      />
    </div>
    <div class="shop-utility">
      <div>
        <button
          class="shop-filter-toggle"
          :aria-expanded="filtersOpen"
          @click="filtersOpen = !filtersOpen"
        >
          {{ filtersOpen ? 'Hide equipment filters' : 'Filter by equipment' }}
          <span aria-hidden="true">{{ filtersOpen ? '−' : '+' }}</span></button
        ><button
          v-if="equipment || group || search"
          class="text-action"
          @click="clearFilters"
        >
          Clear filters
        </button>
      </div>
      <button
        class="text-action"
        :disabled="!draft.length || saving"
        @click="$emit('undo')"
      >
        Undo last add
      </button>
    </div>
    <div v-if="filtersOpen" class="shop-equipment-filters">
      <FilterPills
        v-model="equipment"
        label="Equipment"
        :options="
          catalog.equipment.map((item) => ({
            id: item.id,
            name: item['equipment-type'],
          }))
        "
        all-label="All equipment"
      />
    </div>
    <CollectionPanel v-model="managing" v-model:selected-ids="selectedIds" collection="exercise" :disabled="saving || managementBusy" description="Create new exercises, edit your selection, or delete in bulk.">
      <ExerciseManager
        ref="manager"
        :bag-count="draft.length"
        :add-status="batchStatus"
        @add-selected="addSelectedToWorkout"
        v-model:selected-ids="selectedIds"
        :visible-ids="visible.map((item) => item.id)"
        :catalog="catalog"
        :disabled="saving"
        @busy="managementBusy = $event"
        @changed="(data, message) => $emit('catalogChanged', data, message)"
      />
    </CollectionPanel>
    <div class="shop-workspace">
      <section class="shop-results" aria-label="Exercise collection">
        <CatalogToolbar
          v-model:search="search"
          v-model:sort="sort"
          v-model:layout="layout"
          :count="visible.length"
          muscle-sort
        />
        <TransitionGroup
          name="selection"
          tag="div"
          class="catalog shop-products"
          :class="layout"
          ><ExerciseVariantCard
            v-for="family in visible"
            :key="family.id"
            :family="family"
            :actions-disabled="saving || managementBusy"
            @edit="manageCard(family, 'edit')"
            @delete="manageCard(family, 'remove')"
            @configure="configurations.set(family.id, $event)"
            :management-selectable="managing"
            :management-selected="selectedIds.includes(family.id)"
            :selection-disabled="saving || managementBusy"
            @select="selectCard(family.id, $event)"
            :attachments="catalog.attachments"
            :draft="draft"
            :disabled="saving || managementBusy || draft.length >= 100"
            @add="$emit('add', $event)"
        /></TransitionGroup>
        <div v-if="!visible.length" class="shop-no-results">
          <h3>No movements found.</h3>
          <p>Try another name, muscle group, or equipment type.</p>
          <button @click="clearFilters">Reset search &amp; filters</button>
        </div>
      </section>
      <SelectionReference
        :draft="draft"
        :name="workoutName"
        :editing-id="editingId"
        @update:name="$emit('update:workoutName', $event)"
        @save="$emit('save', $event)"
        @move="(index, direction) => $emit('move', index, direction)"
        :disabled="saving || managementBusy"
        @remove="$emit('remove', $event)"
        @review="$emit('review')"
      />
    </div>
  </div>
</template>

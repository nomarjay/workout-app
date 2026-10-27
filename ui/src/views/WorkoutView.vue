<script setup>
import { computed, ref, watch } from 'vue';
import CatalogToolbar from '../components/CatalogToolbar.vue';
import DataCard from '../components/DataCard.vue';
import CardActions from '../components/CardActions.vue';
import CollectionPanel from '../components/CollectionPanel.vue';
import CollectionSelect from '../components/CollectionSelect.vue';
import TrainerModeStep from '../components/TrainerModeStep.vue';
import { useCatalogBrowser } from '../composables/useCatalogBrowser.js';
import { variantsForExercise } from '../utils/workoutEditing.js';
import { equipmentType, exerciseLabel, attachmentIdsFor } from '../utils/equipment.js';
const props = defineProps({
  catalog: { type: Object, default: () => ({ exercises: [], attachments: [] }) },
  workouts: Array,
  draft: Array,
  workoutName: String,
  saving: Boolean,
  deleting: String,
  editingId: String,
  trainerWorkout: Object,
});
const emit = defineEmits([
  'save',
  'update-exercise',
  'remove-many',
  'delete-many',
  'edit',
  'cancel',
  'remove',
  'move',
  'delete',
  'browse',
  'arrange',
  'update:workoutName',
  'trainer',
  'finishTrainer',
]);
const name = computed({
  get: () => props.workoutName || '',
  set: (value) => emit('update:workoutName', value),
});
const expanded = ref(true);
const selectedExercises = ref([]);
const selectedRoutines = ref([]);
const manageRoutines = ref(false);
function editCard(workout) {
  if (props.saving || props.deleting || props.editingId === workout.id) return;
  manageRoutines.value = true;
  emit('edit', workout);
}
const managementSelections = computed({
  get: () => [...selectedRoutines.value.map(id => `workout:${id}`), ...selectedExercises.value.map(id => `exercise:${id}`)],
  set: ids => {
    selectedRoutines.value = ids.filter(id => id.startsWith('workout:')).map(id => id.slice(8));
    selectedExercises.value = ids.filter(id => id.startsWith('exercise:')).map(id => id.slice(9));
  },
});
const singleRoutine = computed(() => selectedRoutines.value.length === 1 ? props.workouts.find(item => item.id === selectedRoutines.value[0]) : null);
function selectRoutine(id, checked) { selectedRoutines.value = checked ? [...new Set([...selectedRoutines.value, id])] : selectedRoutines.value.filter(value => value !== id); }
const blocked = computed(() => props.saving || Boolean(props.deleting));
watch(() => props.draft.map(item => item.selectionId), ids => { selectedExercises.value = selectedExercises.value.filter(id => ids.includes(id)); });
watch(() => props.editingId, () => { selectedExercises.value = []; expanded.value = true; });
watch([() => props.workouts, () => props.editingId], () => {
  selectedRoutines.value = selectedRoutines.value.filter(id => props.workouts.some(item => item.id === id) && id !== props.editingId);
});
const exerciseChoices = computed(() => [...new Map((props.catalog.exercises || []).map(item => [item.exerciseId, { id: item.exerciseId, name: item.name }])).values()].sort((a, b) => a.name.localeCompare(b.name)));
const variantsFor = exercise => variantsForExercise(exercise, props.catalog);
const attachmentsFor = exercise => { const current = (props.catalog.equipment || []).find(item => String(item.id) === String(exercise.equipmentId)) || variantsFor(exercise).find(item => item.id === exercise.id) || exercise; return (props.catalog.attachments || []).filter(item => attachmentIdsFor(current).some(id => String(id) === String(item.id))); };
const allExercises = computed(() => props.draft.length > 0 && props.draft.every(item => selectedExercises.value.includes(item.selectionId)));
function selectAllExercises(checked) { selectedExercises.value = checked ? props.draft.map(item => item.selectionId) : []; }
function removeSelectedExercises() { emit('remove-many', [...selectedExercises.value]); selectedExercises.value = []; }
const types = computed(() => [...new Set(props.draft.map(equipmentType))]);
const ready = computed(
  () =>
    name.value.trim() && props.draft.length && !props.saving && !props.deleting
);
const { search, sort, layout, visible } = useCatalogBrowser(
  computed(() => props.workouts)
);
const selectableRoutines = computed(() => visible.value.filter(item => item.id !== props.editingId));
const allRoutines = computed(() => selectableRoutines.value.length > 0 && selectableRoutines.value.every(item => selectedRoutines.value.includes(item.id)));
function selectAllRoutines(checked) {
  const ids = selectableRoutines.value.map(item => item.id);
  selectedRoutines.value = checked ? [...new Set([...selectedRoutines.value, ...ids])] : selectedRoutines.value.filter(id => !ids.includes(id));
}
</script>

<template>
  <header class="shop-heading">
    <div>
      <p class="shop-kicker">
        {{ editingId ? 'REFINE YOUR ROUTINE' : 'YOUR WORKOUT BAG' }}
      </p>
      <h2>
        {{
          editingId
            ? 'Make it work for you.'
            : 'Good choices. Great workout.'
        }}
      </h2>
      <p>
        Review your movements, put them in order, and save your routine.
      </p>
    </div>
    <button class="text-action" :disabled="saving" @click="emit('browse')">
      ← Continue browsing
    </button>
  </header>
  <TrainerModeStep
    v-if="trainerWorkout"
    :key="`${trainerWorkout.id}:${
      trainerWorkout.updatedAt || trainerWorkout.createdAt
    }`"
    :workout="trainerWorkout"
    @done="emit('finishTrainer', $event)"
  />
  <template v-else>
    <CollectionPanel v-model="manageRoutines" v-model:selected-ids="managementSelections" collection="workout" item-label="item" :disabled="blocked" description="Select workouts to edit or delete. All routine editing controls are enabled here."><section class="exercise-manager"><div class="management-actions"><button type="button" class="primary" :disabled="blocked || Boolean(editingId)" @click="emit('browse')">＋ Create new workout</button><div class="row-actions"><button type="button" :disabled="!singleRoutine || blocked" @click="emit('edit', singleRoutine)">Edit selected</button><button type="button" class="delete" :disabled="!selectedRoutines.length || blocked" @click="emit('delete-many', [...selectedRoutines])">{{ deleting === 'bulk' ? 'Deleting…' : `Delete selected (${selectedRoutines.length})` }}</button></div></div><p class="hint">Use the Select checkboxes on workout cards. Finish or cancel editing before deleting that routine.</p><div class="management-selection"><label class="checkbox-label"><input type="checkbox" :checked="allRoutines" :indeterminate="selectableRoutines.some(item => selectedRoutines.includes(item.id)) && !allRoutines" :disabled="!selectableRoutines.length || blocked" @change="selectAllRoutines($event.target.checked)">Select all shown ({{ selectableRoutines.length }})</label><span>{{ selectedRoutines.length }} selected</span><button type="button" class="text-action" :disabled="!selectedRoutines.length || blocked" @click="selectedRoutines = []">Clear selection</button></div></section></CollectionPanel>
    <section class="workout-checkout" aria-label="Workout builder">

      <div class="shop-steps">
        <span class="current"><b>01</b> Review &amp; save workout</span
        ><span>2 · Trainer Mode (optional)</span>
      </div>
      <form class="checkout-layout" @submit.prevent="emit('save', name)">
        <section class="checkout-cart" aria-label="Selected exercises">
          <div class="cart-section-heading">
            <h3>
              Your exercises <span>{{ draft.length }}</span>
            </h3>
            <div class="row-actions">
              <button
                type="button"
                class="text-action"
                :disabled="draft.length < 2 || saving"
                v-if="manageRoutines" @click="emit('arrange')"
              >
                Group by equipment</button
              ><button
                v-if="draft.length"
                type="button"
                class="text-action"
                :aria-expanded="expanded"
                @click="expanded = !expanded"
              >
                {{ expanded ? 'Collapse' : 'Expand' }}
              </button>
            </div>
          </div>
<div v-if="manageRoutines && draft.length" class="workout-bulk-controls"><label class="checkbox-label"><input type="checkbox" :checked="allExercises" :indeterminate="selectedExercises.length > 0 && !allExercises" :disabled="blocked" @change="selectAllExercises($event.target.checked)">Select all exercises ({{ draft.length }})</label><span>{{ selectedExercises.length }} selected</span><button type="button" class="delete" :disabled="!selectedExercises.length || blocked" @click="removeSelectedExercises">Remove selected exercises</button><button type="button" class="text-action" :disabled="!selectedExercises.length || blocked" @click="selectedExercises = []">Clear selection</button></div>
          <Transition name="reveal"
            ><div v-if="expanded">
              <TransitionGroup name="selection" tag="ol" class="checkout-items"
                ><li
                  v-for="(exercise, index) in draft"
                  :key="exercise.selectionId"
                  class="checkout-item"
                  :class="{ 'row-selected': manageRoutines && selectedExercises.includes(exercise.selectionId) }"
                >
                  <label v-if="manageRoutines" class="workout-row-select"><input v-model="selectedExercises" type="checkbox" :value="exercise.selectionId" :disabled="blocked" :aria-label="`Select exercise ${index + 1}: ${exercise.name}`"><span class="cart-position">{{ String(index + 1).padStart(2, '0') }}</span></label><span v-else class="cart-position">{{ String(index + 1).padStart(2, '0') }}</span>
                  <div class="cart-photo">
                    <img
                      v-if="exercise.image"
                      :src="exercise.image"
                      alt=""
                      loading="lazy"
                      @error="$event.target.style.visibility = 'hidden'"
                    /><span v-else aria-hidden="true">◇</span>
                  </div>
                  <div class="cart-item-info">
                    <p class="shop-kicker">
                      {{
                        exercise.isIsolation
                          ? 'ISOLATION MOVEMENT'
                          : 'YOUR MOVEMENT'
                      }}
                    </p>
                    <h4>{{ exercise.name }}</h4>
                    <p>{{ equipmentType(exercise) }}</p>
                    <div v-if="manageRoutines && exerciseChoices.length" class="workout-row-controls">
                      <label>Exercise<select :value="exercise.exerciseId" :disabled="saving || Boolean(deleting)" @change="emit('update-exercise', { selectionId: exercise.selectionId, exerciseId: $event.target.value })"><option v-if="!exerciseChoices.some(item => item.id === exercise.exerciseId)" :value="exercise.exerciseId">{{ exercise.name }} (saved version)</option><option v-for="choice in exerciseChoices" :key="choice.id" :value="choice.id">{{ choice.name }}</option></select></label>
                      <label v-if="variantsFor(exercise).length">Equipment / movement<select :value="exercise.id" :disabled="saving || Boolean(deleting)" @change="emit('update-exercise', { selectionId: exercise.selectionId, variantId: $event.target.value })"><option v-if="!variantsFor(exercise).some(item => item.id === exercise.id)" :value="exercise.id">{{ equipmentType(exercise) }} (saved version)</option><option v-for="variant in variantsFor(exercise)" :key="variant.id" :value="variant.id">{{ equipmentType(variant) }} · {{ variant.isIsolation ? 'Isolation' : 'Standard' }}</option></select></label>
                      <label v-if="attachmentsFor(exercise).length">Attachment<select :value="exercise.attachment || ''" :disabled="saving || Boolean(deleting)" @change="emit('update-exercise', { selectionId: exercise.selectionId, attachment: $event.target.value || null })"><option value="">None</option><option v-for="attachment in attachmentsFor(exercise)" :key="attachment.id" :value="attachment.name">{{ attachment.name }}</option></select></label>
                    </div>
                    <small
                      >Attachment: {{ exercise.attachment || 'None' }}</small
                    ><button
                      v-if="manageRoutines"
                      class="text-action remove-item"
                      type="button"
                      :disabled="saving"
                      :aria-label="`Remove ${exercise.name}`"
                      @click="emit('remove', index)"
                    >
                      Remove
                    </button>
                  </div>
                  <div
                    v-if="manageRoutines"
                    class="cart-order"
                    role="group"
                    :aria-label="`Order ${exercise.name}`"
                  >
                    <button
                      type="button"
                      :disabled="index === 0 || saving"
                      :aria-label="`Move ${exercise.name} up`"
                      @click="emit('move', index, -1)"
                    >
                      ↑</button
                    ><span>{{ index + 1 }}</span
                    ><button
                      type="button"
                      :disabled="index === draft.length - 1 || saving"
                      :aria-label="`Move ${exercise.name} down`"
                      @click="emit('move', index, 1)"
                    >
                      ↓
                    </button>
                  </div>
                </li></TransitionGroup
              >
            </div></Transition
          >
          <div v-if="!draft.length" class="checkout-empty">
            <span aria-hidden="true">＋</span>
            <h3>Your next routine is waiting.</h3>
            <p>
              Explore the collection and add a few movements to get started.
            </p>
            <button
              type="button"
              class="primary shop-button"
              :disabled="saving"
              @click="emit('browse')"
            >
              Explore exercises →
            </button>
          </div>
          <button
            v-if="draft.length"
            type="button"
            class="cart-add-more"
            :disabled="saving || draft.length >= 100"
            @click="emit('browse')"
          >
            ＋ Add another exercise
          </button>
        </section>
        <aside class="checkout-summary" aria-label="Workout summary">
          <p class="shop-kicker">ONE STEP CLOSER</p>
          <h3>Make it a routine.</h3>
          <label
            >Workout name<input
              v-model="name"
              :disabled="saving"
              required
              maxlength="100"
              placeholder="e.g. Upper body day"
          /></label>
          <dl class="checkout-totals">
            <div>
              <dt>Exercises</dt>
              <dd>{{ draft.length }} <small>/ 100</small></dd>
            </div>
            <div>
              <dt>Equipment types</dt>
              <dd>{{ types.length }}</dd>
            </div>
          </dl>
          <div v-if="types.length" class="cart-equipment">
            <span v-for="type in types" :key="type">{{ type }}</span>
          </div>
          <button class="primary shop-button" :disabled="!ready">
            {{
              saving ? 'Saving…' : editingId ? 'Save changes' : 'Save workout'
            }}
            <span aria-hidden="true">→</span>
          </button>
          <p class="summary-note">
            Save your routine, then optionally configure sets, reps, and weights
            in Trainer Mode.
          </p>
          <button
            v-if="editingId"
            type="button"
            class="text-action"
            :disabled="saving"
            @click="emit('cancel')"
          >
            Cancel editing
          </button>
        </aside>
      </form>
    </section>
    <section class="saved-collection">
      <header class="collection-heading">
        <div>
          <p class="shop-kicker">READY WHEN YOU ARE</p>
          <h2>Your saved routines</h2>
        </div>
        <span>{{ workouts.length }} routines</span>
      </header>
      <CatalogToolbar
        v-model:search="search"
        v-model:sort="sort"
        v-model:layout="layout"
        :count="visible.length"
      />

      <TransitionGroup
        name="selection"
        tag="div"
        class="catalog saved-products"
        :class="layout"
        ><DataCard
          v-for="workout in visible"
          :key="workout.id"
          :class="{ 'routine-selected': manageRoutines && selectedRoutines.includes(workout.id) }"
          :title="workout.name"
          :image="workout.exercises?.find((item) => item.image)?.image"
          kind="Workout"
          ><template #media-fallback
            ><div class="routine-art">
              <span>{{
                String(workout.exercises?.length || 0).padStart(2, '0')
              }}</span
              ><small>MOVEMENTS. ONE ROUTINE.</small>
            </div></template
          ><template #media-overlay><CollectionSelect v-if="manageRoutines" :model-value="selectedRoutines.includes(workout.id)" :disabled="blocked || editingId === workout.id" :label="`Select ${workout.name} for management`" @update:model-value="selectRoutine(workout.id, $event)" /></template><template #eyebrow
            ><p class="product-category">YOUR COLLECTION</p></template
          >
          <p class="product-description">
            {{ workout.exercises?.length || 0 }} exercises ·
            {{
              new Set((workout.exercises || []).map(equipmentType)).size
            }}
            equipment types
          </p>
          <details class="product-details">
            <summary>See the movements</summary>
            <ol>
              <li v-for="(exercise, index) in workout.exercises" :key="index">
                {{ exerciseLabel(exercise)
                }}<small>Attachment: {{ exercise.attachment || 'None' }}</small>
              </li>
            </ol>
          </details>
          <button
            class="primary shop-button"
            :disabled="saving || Boolean(deleting) || Boolean(editingId)"
            @click="emit('trainer', workout)"
          >
            Trainer Mode
          </button>
<CardActions :label="workout.name" :disabled="blocked" :edit-disabled="editingId === workout.id" :delete-disabled="editingId === workout.id" @edit="editCard(workout)" @delete="emit('delete', workout.id)" />
</DataCard
        ></TransitionGroup
      >
      <p v-if="!visible.length" class="empty">
        No saved workouts match. Save your first routine from the workout bag.
      </p>
    </section>
  </template>
</template>

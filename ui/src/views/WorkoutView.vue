<script setup>
import { computed, ref } from 'vue';
import CatalogToolbar from '../components/CatalogToolbar.vue';
import DataCard from '../components/DataCard.vue';
import TrainerModeStep from '../components/TrainerModeStep.vue';
import { useCatalogBrowser } from '../composables/useCatalogBrowser.js';
import { equipmentLabel, equipmentType, exerciseLabel } from '../utils/equipment.js';
const props = defineProps({ workouts: Array, draft: Array, workoutName: String, saving: Boolean, deleting: String, editingId: String, trainerWorkout: Object });
const emit = defineEmits(['save', 'edit', 'cancel', 'remove', 'move', 'delete', 'browse', 'arrange', 'update:workoutName', 'trainer', 'finishTrainer']);
const name = computed({ get: () => props.workoutName || '', set: value => emit('update:workoutName', value) });
const expanded = ref(true);
const types = computed(() => [...new Set(props.draft.map(equipmentType))]);
const ready = computed(() => name.value.trim() && props.draft.length && !props.saving && !props.deleting);
const { search, sort, layout, visible } = useCatalogBrowser(computed(() => props.workouts));
</script>
<template>
  <TrainerModeStep v-if="trainerWorkout" :key="`${trainerWorkout.id}:${trainerWorkout.updatedAt || trainerWorkout.createdAt}`" :workout="trainerWorkout" @done="emit('finishTrainer', $event)" />
  <section v-else class="builder panel">
    <div class="builder-heading"><div><p class="eyebrow">{{ editingId ? 'EDIT WORKOUT' : 'YOUR ROUTINE' }}</p><h2>{{ name.trim() || 'Build a workout' }}</h2></div><span class="count-badge" aria-live="polite">{{ draft.length }}/100 exercises</span></div>
    <div class="builder-progress"><span :class="{ complete: ready }">1 · Build and save workout</span><span>2 · Trainer Mode (optional)</span></div>
    <form @submit.prevent="emit('save', name)">
      <label>Workout name<input v-model="name" :disabled="saving" required maxlength="100" placeholder="e.g. Upper body day"></label>
      <div class="row-actions"><button type="button" class="primary" :disabled="saving || draft.length >= 100" @click="emit('browse')">+ Choose exercises</button><button type="button" :disabled="draft.length < 2 || saving" @click="emit('arrange')">Arrange by equipment type</button><button v-if="draft.length" type="button" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? 'Collapse' : 'Expand' }} selection</button></div>
      <div class="tags"><span v-for="type in types" :key="type">{{ type }}</span></div>
      <Transition name="reveal"><div v-if="expanded">
        <TransitionGroup name="selection" tag="ol" class="draft-list"><li v-for="(exercise, index) in draft" :key="exercise.selectionId"><div><strong>{{ exerciseLabel(exercise) }}</strong><small>Attachment: {{ exercise.attachment || 'None' }}</small></div><div class="row-actions">
          <button type="button" :disabled="index === 0 || saving" :aria-label="`Move ${exercise.name} up`" @click="emit('move', index, -1)">↑</button>
          <button type="button" :disabled="index === draft.length - 1 || saving" :aria-label="`Move ${exercise.name} down`" @click="emit('move', index, 1)">↓</button>
          <button type="button" :disabled="saving" :aria-label="`Remove ${exercise.name}`" @click="emit('remove', index)">Remove</button></div></li></TransitionGroup>
      </div></Transition>
      <p v-if="!draft.length" class="empty">Choose exercises to build your routine. Your selection appears here.</p>
      <div class="save-bar"><p class="hint">{{ draft.length ? `${draft.length} exercises · ${types.length} equipment types` : 'Start by choosing an exercise.' }}</p><div class="row-actions"><button v-if="editingId" type="button" :disabled="saving" @click="emit('cancel')">Cancel editing</button><button class="primary" :disabled="!ready">{{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Save workout' }}</button></div></div>
    </form>
  </section>
  <template v-if="!trainerWorkout">
  <h2 class="saved-heading">Saved workouts</h2>
  <CatalogToolbar v-model:search="search" v-model:sort="sort" v-model:layout="layout" :count="visible.length" equipment-sort />
  <TransitionGroup name="selection" tag="div" class="catalog" :class="layout"><DataCard v-for="workout in visible" :key="workout.id" :title="workout.name" kind="Workout">
    <p class="hint">{{ workout.exercises?.length || 0 }} exercises</p><ol><li v-for="(exercise, index) in workout.exercises" :key="index">{{ exerciseLabel(exercise) }}<small>Attachment: {{ exercise.attachment || 'None' }}</small></li></ol>
    <button :disabled="saving || Boolean(deleting) || Boolean(editingId)" @click="emit('trainer', workout)">Trainer Mode</button>
    <div class="row-actions"><button :disabled="saving || Boolean(deleting) || editingId === workout.id" @click="emit('edit', workout)">{{ editingId === workout.id ? 'Editing' : 'Edit workout' }}</button><button class="delete" :disabled="saving || Boolean(deleting) || editingId === workout.id" @click="emit('delete', workout.id)">{{ deleting === workout.id ? 'Deleting…' : 'Delete workout' }}</button></div>
  </DataCard></TransitionGroup><p v-if="!visible.length" class="empty">No saved workouts match. Create your first workout above.</p>
  </template>
</template>



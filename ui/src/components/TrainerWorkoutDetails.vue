<script setup>
import { computed, useId } from 'vue';
import TrainerSetGuide from './TrainerSetGuide.vue';
import { exerciseLabel } from '../utils/equipment.js';
const props = defineProps({
  workout: { type: Object, required: true },
  assignments: { type: Array, default: () => [] },
  algorithm: Object,
  weightUnit: String,
  loading: Boolean,
  exerciseIndex: { type: Number, default: null },
});
const headingId = `${useId()}-workout-details`;
const exercises = computed(() => props.workout.exercises.map((exercise, index) => ({ exercise, index })).filter(({ index }) => props.exerciseIndex === null || index === props.exerciseIndex));
const plans = computed(() => props.assignments.filter(item => props.exerciseIndex === null || item.exerciseIndex === props.exerciseIndex));
</script>
<template>
  <section class="trainer-workout-details" :aria-labelledby="headingId">
    <h2 :id="headingId">{{ exerciseIndex === null ? 'Full workout details' : 'Workout details' }}</h2>
    <p class="hint">{{ workout.name }} · {{ workout.exercises.length }} exercises · {{ weightUnit }}</p>
    <p v-if="exerciseIndex !== null" class="eyebrow">SELECTED EXERCISE · {{ exerciseIndex + 1 }} OF {{ workout.exercises.length }}</p>
    <ol class="m-0 list-none p-0" aria-label="Workout exercise details">
      <li v-for="{ exercise, index } in exercises" :key="index" class="py-2">
        <h3 class="mt-0">{{ index + 1 }}. {{ exerciseLabel(exercise) }}</h3>
        <p class="hint my-1">Attachment: {{ exercise.attachment || 'None' }}</p>
        <p v-if="exercise.primaryMuscles?.length" class="hint my-1">Primary muscles: {{ exercise.primaryMuscles.join(', ') }}</p>
        <p v-if="exercise.secondaryMuscles?.length" class="hint my-1">Secondary muscles: {{ exercise.secondaryMuscles.join(', ') }}</p>
      </li>
    </ol>
    <TrainerSetGuide :workout="workout" :assignments="plans" :algorithm="algorithm" :weight-unit="weightUnit" :loading="loading" detailed class="static! mt-5 max-h-none! border-0! p-0! shadow-none!" />
  </section>
</template>

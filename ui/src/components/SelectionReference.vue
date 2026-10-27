<script setup>
import { computed } from 'vue';
import { equipmentType } from '../utils/equipment.js';
const props = defineProps({ draft: Array, name: String, disabled: Boolean, editingId: String });
const emit = defineEmits(['remove', 'review', 'move', 'save', 'update:name']);
const workoutName = computed({ get: () => props.name || '', set: value => emit('update:name', value) });
const ready = computed(() => props.draft.length > 0 && props.draft.length <= 100 && workoutName.value.trim() && !props.disabled);
</script>
<template>
  <aside class="workout-bag" aria-label="Your workout bag"><form @submit.prevent="ready && emit('save', workoutName)">
    <div class="bag-heading"><div><p class="shop-kicker">YOUR SELECTION</p><h2>Workout bag</h2></div><span class="bag-count" aria-live="polite">{{ draft.length }}</span></div>
    <label class="bag-name-field">Workout name<input v-model="workoutName" required maxlength="100" placeholder="e.g. Upper body day" :disabled="disabled"></label>
    <div v-if="!draft.length" class="bag-empty"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M12 16h24l3 26H9l3-26Z"/><path d="M18 18V12a6 6 0 0 1 12 0v6"/></svg><h3>Find your first exercise.</h3><p>Choose your equipment and add the movements you want to train.</p></div>
    <TransitionGroup v-else name="selection" tag="ol" class="bag-items"><li v-for="(exercise, index) in draft" :key="exercise.selectionId" class="bag-item"><div class="bag-thumb"><img v-if="exercise.image" :src="exercise.image" alt="" loading="lazy" @error="$event.target.style.visibility = 'hidden'"><span v-else aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span></div><div class="bag-item-copy"><strong>{{ exercise.name }}</strong><small>{{ equipmentType(exercise) }}</small><small v-if="exercise.attachment">{{ exercise.attachment }}</small></div><div class="bag-item-controls"><div class="bag-reorder"><button type="button" :disabled="disabled || index === 0" :aria-label="`Move ${exercise.name} up in workout bag`" @click="emit('move', index, -1)">↑</button><button type="button" :disabled="disabled || index === draft.length - 1" :aria-label="`Move ${exercise.name} down in workout bag`" @click="emit('move', index, 1)">↓</button></div><button type="button" class="bag-remove" :disabled="disabled" :aria-label="`Remove ${exercise.name}`" @click="emit('remove', index)">×</button></div></li></TransitionGroup>
    <div class="bag-summary"><div><span>Exercises</span><strong>{{ draft.length }}<small> / 100</small></strong></div><p>Your selection stays here while you browse.</p><button type="submit" class="primary shop-button" :disabled="!ready">{{ disabled ? 'Please wait…' : editingId ? 'Save changes & continue' : 'Save & continue' }}<span aria-hidden="true">→</span></button><p class="bag-save-note">Save your routine, then complete sets, reps, and weights in Workouts.</p><button type="button" class="text-action bag-review" :disabled="!draft.length || disabled" @click="emit('review')">Review workout</button></div>
  </form></aside>
</template>

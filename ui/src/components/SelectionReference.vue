<script setup>
import { exerciseLabel } from '../utils/equipment.js';
defineProps({ draft: Array, name: String, disabled: Boolean });
defineEmits(['remove']);
</script>
<template>
  <aside class="quick-reference panel" aria-label="Selected exercises quick reference"><h2>{{ name?.trim() || 'Current workout' }}</h2><p class="hint" aria-live="polite">{{ draft.length }} selected exercises</p><p v-if="!draft.length" class="hint">Your chosen exercises will appear here.</p>
    <TransitionGroup name="selection" tag="ol"><li v-for="(exercise, index) in draft" :key="exercise.selectionId"><div><strong>{{ exerciseLabel(exercise) }}</strong><small>{{ exercise.isIsolation ? 'Isolation · ' : '' }}Attachment: {{ exercise.attachment || 'None' }}</small></div><button :disabled="disabled" :aria-label="`Remove ${exercise.name}`" @click="$emit('remove', index)">×</button></li></TransitionGroup>
  </aside>
</template>

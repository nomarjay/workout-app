<script setup>
import { isSmithMachine } from '../utils/equipment.js';
defineProps({ exercise: Object });
</script>
<template>
  <span
    v-if="isSmithMachine(exercise)"
    class="weight-info"
    tabindex="0"
    role="note"
    aria-label="starting resistance set by Smith machine"
    title="starting resistance set by Smith machine"
    >ⓘ<span class="weight-info-tooltip" role="tooltip"
      >starting resistance set by Smith machine</span
    ></span
  >
</template>

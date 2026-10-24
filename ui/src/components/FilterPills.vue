<script setup>
defineProps({ modelValue: { type: String, default: '' }, label: String, options: Array, allLabel: { type: String, default: 'All' } });
defineEmits(['update:modelValue']);
</script>
<template>
  <div class="filter-group" role="group" :aria-label="label">
    <span class="control-label">{{ label }}</span>
    <div class="pills">
      <button type="button" class="pill" :aria-pressed="modelValue === ''" @click="$emit('update:modelValue', '')">{{ allLabel }}</button>
      <button v-for="option in options" :key="option.id" type="button" class="pill" :aria-pressed="modelValue === String(option.id)" @click="$emit('update:modelValue', String(option.id))">{{ option.name }}</button>
    </div>
  </div>
</template>

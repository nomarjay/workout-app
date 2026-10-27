<script setup>
defineProps({ modelValue: Boolean, disabled: Boolean, label: String });
defineEmits(['update:modelValue']);
</script>
<template><label class="collection-card-select" :class="{ checked: modelValue }" @click.stop><input type="checkbox" :checked="modelValue" :disabled="disabled" :aria-label="label" @change="$emit('update:modelValue', $event.target.checked)"><span>Select</span></label></template>
<style scoped>
.collection-card-select { position: absolute; top: 12px; right: 12px; display: inline-flex; align-items: center; gap: 5px; margin: 0; padding: 5px 7px; border: 1px solid transparent; border-radius: 5px; background: #14201b; color: #f2f8ef; font-size: 10px; font-weight: 500; line-height: 1; cursor: pointer; }
.collection-card-select span { font-size: 10px; line-height: 1; letter-spacing: 0; }
.collection-card-select input { width: 14px; height: 14px; min-height: 0; margin: 0; padding: 0; accent-color: #64f5ef; }
.collection-card-select.checked { border-color: #64f5ef; }
.collection-card-select:focus-within { outline: 3px solid var(--color-focus); outline-offset: 3px; }
</style>

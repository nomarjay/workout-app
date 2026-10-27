<script setup>
import { computed } from 'vue';
import SelectionCloseDialog from './SelectionCloseDialog.vue';
import { useManagementSelection } from '../composables/useManagementSelection.js';
const props = defineProps({ modelValue: Boolean, selectedIds: { type: Array, default: () => [] }, disabled: Boolean, collection: { type: String, default: 'exercise' }, title: String, itemLabel: String, description: { type: String, default: 'Create, edit selected items, or delete in bulk.' } });
const emit = defineEmits(['update:modelValue', 'update:selectedIds']);
const managing = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) });
const selectedIds = computed({ get: () => props.selectedIds, set: value => emit('update:selectedIds', value) });
const { closePrompt, toggleManagement, resolveClose, cancelClose } = useManagementSelection(() => props.disabled, { managing, selectedIds });
</script>
<template>
  <details class="collection-management" :open="modelValue"><summary @click.prevent="toggleManagement" :aria-expanded="modelValue" :aria-disabled="disabled"><span><strong>{{ title || `Manage ${collection} collection` }} <span v-if="!modelValue && selectedIds.length">({{ selectedIds.length }} kept)</span></strong><small>{{ description }}</small></span><span aria-hidden="true">{{ modelValue ? '−' : '+' }}</span></summary><slot /></details>
  <SelectionCloseDialog :open="closePrompt" :count="selectedIds.length" :item-label="itemLabel || (collection === 'equipment' ? 'equipment item' : collection)" @keep="resolveClose(false)" @clear="resolveClose(true)" @cancel="cancelClose" />
</template>

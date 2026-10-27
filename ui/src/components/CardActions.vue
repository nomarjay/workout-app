<script setup>
import { Pencil, Trash2 } from '@lucide/vue';
defineProps({ label: String, disabled: Boolean, editDisabled: Boolean, deleteDisabled: Boolean });
defineEmits(['edit', 'delete']);
</script>
<template>
  <div class="card-inline-actions" role="group" :aria-label="`Actions for ${label}`"><button type="button" :disabled="disabled || editDisabled" :title="`Edit ${label}`" :aria-label="`Edit ${label}`" @click.stop="$emit('edit')"><Pencil :size="14" :stroke-width="1.75" aria-hidden="true" focusable="false" /></button><button type="button" class="delete-action" :disabled="disabled || deleteDisabled" :title="`Delete ${label}`" :aria-label="`Delete ${label}`" @click.stop="$emit('delete')"><Trash2 :size="14" :stroke-width="1.75" aria-hidden="true" focusable="false" /></button></div>
</template>
<style scoped>
.card-inline-actions { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 8px; }
.card-inline-actions button { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; min-height: 28px; margin: 0; padding: 6px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--color-text-muted); box-shadow: none; }
.card-inline-actions button:hover:not(:disabled), .card-inline-actions button:focus-visible { color: var(--color-text); border-color: var(--color-border-subtle); }
.card-inline-actions .delete-action:hover:not(:disabled), .card-inline-actions .delete-action:focus-visible { color: var(--color-danger); }
.card-inline-actions svg { display: block; flex: none; }
</style>

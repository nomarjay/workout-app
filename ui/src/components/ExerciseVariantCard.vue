<script setup>
import { computed, ref, watch } from 'vue';
import DataCard from './DataCard.vue';
import { equipmentType } from '../utils/equipment.js';
const props = defineProps({ family: Object, attachments: Array, draft: Array, disabled: Boolean, managingDisabled: Boolean });
const emit = defineEmits(['add', 'edit', 'delete']);
const variantId = ref('');
const attachment = ref('');
const variant = computed(() => props.family.variants.find(item => item.id === variantId.value) || props.family.variants[0]);
const supportedAttachments = computed(() => props.attachments.filter(item => variant.value.attachmentIds?.some(id => String(id) === String(item.id))));
const machines = computed(() => [...new Map(props.family.variants.map(item => [String(item.equipmentId ?? item.equipment), { id: String(item.equipmentId ?? item.equipment), name: equipmentType(item) }])).values()]);
const machineKey = item => String(item.equipmentId ?? item.equipment);
const movements = computed(() => props.family.variants.filter(item => machineKey(item) === machineKey(variant.value)));
const count = computed(() => props.draft.filter(item => props.family.variants.some(v => v.id === item.id)).length);
function chooseMachine(event) {
  variantId.value = props.family.variants.find(item => machineKey(item) === event.target.value).id;
}
watch(() => variant.value?.id, () => { attachment.value = variant.value?.attachment || ''; }, { immediate: true });
function add() { emit('add', { ...variant.value, attachment: supportedAttachments.value.length ? attachment.value || null : variant.value.attachment }); }
</script>
<template>
  <DataCard :title="family.name" :image="variant.image" :class="{ selected: count }">
    <label>Equipment type<select :value="machineKey(variant)" :disabled="disabled" @change="chooseMachine"><option v-for="machine in machines" :key="machine.id" :value="machine.id">{{ machine.name }}</option></select></label>
    <label v-if="movements.length > 1">Movement version<select :value="variant.id" :disabled="disabled" @change="variantId = $event.target.value"><option v-for="item in movements" :key="item.id" :value="item.id">{{ item.isIsolation ? 'Isolation' : 'Standard' }} · {{ item.name }}</option></select></label>
    <p v-else-if="variant.isIsolation" class="isolation-marker">Isolation movement</p>
    <label v-if="supportedAttachments.length">Attachment<select v-model="attachment" :disabled="disabled"><option value="">None</option><option v-for="item in supportedAttachments" :key="item.id" :value="item.name">{{ item.name }}</option></select></label>
    <p v-else class="notes">Attachment: {{ variant.attachment || 'None' }}</p>
    <p v-if="variant.primaryMuscles.length" class="notes">Primary: {{ variant.primaryMuscles.join(', ') }}</p>
    <p v-if="variant.secondaryMuscles.length" class="notes">Secondary: {{ variant.secondaryMuscles.join(', ') }}</p>
    <button class="primary add-button" :disabled="disabled" @click="add">{{ count ? `✓ ${count} selected · Add variant` : '+ Add to workout' }}</button>
    <div class="row-actions catalog-card-actions"><button :disabled="managingDisabled" @click="emit('edit')">Edit exercise</button><button class="delete" :disabled="managingDisabled" @click="emit('delete')">Delete exercise</button></div>
  </DataCard>
</template>

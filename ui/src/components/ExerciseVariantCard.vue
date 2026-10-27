<script setup>
import { computed, ref, watch } from 'vue';
import DataCard from './DataCard.vue';
import CardActions from './CardActions.vue';
import CollectionSelect from './CollectionSelect.vue';
import { equipmentType, attachmentIdsFor } from '../utils/equipment.js';
const props = defineProps({
  family: Object,
  attachments: Array,
  draft: Array,
  disabled: Boolean,
  actionsDisabled: Boolean,
  managementSelected: Boolean,
  managementSelectable: Boolean,
  selectionDisabled: Boolean,
});
const emit = defineEmits(['add', 'select', 'configure', 'edit', 'delete']);
const variantId = ref('');
const attachment = ref('');
const variant = computed(
  () =>
    props.family.variants.find((item) => item.id === variantId.value) ||
    props.family.variants[0]
);
const supportedAttachments = computed(() =>
  props.attachments.filter((item) =>
    attachmentIdsFor(variant.value).some((id) => String(id) === String(item.id))
  )
);
const machines = computed(() => [
  ...new Map(
    props.family.variants.map((item) => [
      String(item.equipmentId ?? item.equipment),
      {
        id: String(item.equipmentId ?? item.equipment),
        name: equipmentType(item),
      },
    ])
  ).values(),
]);
const machineKey = (item) => String(item.equipmentId ?? item.equipment);
const movements = computed(() =>
  props.family.variants.filter(
    (item) => machineKey(item) === machineKey(variant.value)
  )
);
const count = computed(
  () =>
    props.draft.filter((item) =>
      props.family.variants.some((v) => v.id === item.id)
    ).length
);
function chooseMachine(event) {
  variantId.value = props.family.variants.find(
    (item) => machineKey(item) === event.target.value
  ).id;
}
watch(
  () => variant.value?.id,
  () => {
    attachment.value = variant.value?.attachment || '';
  },
  { immediate: true }
);
function configuredExercise() {
  return { ...variant.value, attachment: supportedAttachments.value.length ? attachment.value || null : null };
}
watch([variant, attachment], () => emit('configure', configuredExercise()), { immediate: true });
function add() { emit('add', configuredExercise()); }
</script>
<template>
  <DataCard
    class="exercise-product"
    :title="family.name"
    :image="variant.image"
    :image-attribution="variant.imageAttribution"
    :image-caption="variant.imageCaption"
    :class="{ selected: count, 'management-selected': managementSelectable && managementSelected }"
  >
    <template #media-overlay
      ><span class="product-media-tag" :class="{ 'in-bag': count }">{{
        count
          ? `IN YOUR BAG · ${count}`
          : variant.isIsolation
          ? 'ISOLATION'
          : 'COMPOUND'
      }}</span
      ><CollectionSelect v-if="managementSelectable" :model-value="managementSelected" :disabled="selectionDisabled" :label="`Select ${family.name} for management`" @update:model-value="emit('select', $event)" /></template
    >
    <template #eyebrow
      ><p class="product-category">
        {{ family.primaryGroupName || 'Exercise collection' }}
      </p></template
    >
    <p class="product-description">
      {{ machines.length }} equipment
      {{ machines.length === 1 ? 'option' : 'options' }} ·
      {{ variant.isIsolation ? 'Isolation movement' : 'Strength training' }}
    </p>
    <div class="product-tags">
      <span
        v-for="muscle in (variant.primaryMuscles || []).slice(0, 2)"
        :key="muscle"
        >{{ muscle }}</span
      >
    </div>
    <div class="product-config">
      <label
        >Choose equipment<select
          :value="machineKey(variant)"
          :disabled="disabled"
          @change="chooseMachine"
        >
          <option
            v-for="machine in machines"
            :key="machine.id"
            :value="machine.id"
          >
            {{ machine.name }}
          </option>
        </select></label
      >
      <label v-if="movements.length > 1"
        >Movement version<select
          :value="variant.id"
          :disabled="disabled"
          @change="variantId = $event.target.value"
        >
          <option v-for="item in movements" :key="item.id" :value="item.id">
            {{ item.isIsolation ? 'Isolation' : 'Standard' }} · {{ item.name }}
          </option>
        </select></label
      >
      <label v-if="supportedAttachments.length"
        >Choose attachment<select v-model="attachment" :disabled="disabled">
          <option value="">None</option>
          <option
            v-for="item in supportedAttachments"
            :key="item.id"
            :value="item.name"
          >
            {{ item.name }}
          </option>
        </select></label
      >
      <button
        class="primary shop-button add-button"
        :disabled="disabled"
        @click="add"
      >
        {{ count ? 'Add another' : 'Add to workout'
        }}<span aria-hidden="true">＋</span>
      </button>
    </div>
    <details class="product-details">
      <summary>Movement details</summary>
      <p v-if="variant.primaryMuscles?.length">
        Primary: {{ variant.primaryMuscles.join(', ') }}
      </p>
      <p v-if="variant.secondaryMuscles?.length">
        Secondary: {{ variant.secondaryMuscles.join(', ') }}
      </p>
      <p>Attachment: {{ variant.attachment || 'None' }}</p>
      <p v-if="variant.imageCaption">{{ variant.imageCaption }}</p>
    </details>
    <CardActions :label="family.name" :disabled="actionsDisabled" @edit="emit('edit')" @delete="emit('delete')" />
  </DataCard>
</template>

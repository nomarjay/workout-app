<script setup>
import { computed, nextTick, ref, useId } from 'vue';
const props = defineProps({ modelValue: { type: Array, default: () => [] }, groups: { type: Array, default: () => [] }, extraMuscles: { type: Array, default: () => [] }, label: String, single: Boolean, required: Boolean });
const emit = defineEmits(['update:modelValue']);
const radioName = useId();
const expanded = ref(false);
const options = computed(() => {
  const groups = props.groups.map(group => ({ name: group.name, muscles: [...new Set([group.name, ...(group.muscles || [])])] }));
  const known = new Set(groups.flatMap(group => group.muscles));
  const extra = [...new Set([...props.extraMuscles, ...props.modelValue])].filter(name => name && !known.has(name));
  if (extra.length) groups.push({ name: 'Other catalog muscles', muscles: extra });
  return groups;
});
function toggle(muscle, checked) {
  emit('update:modelValue', props.single ? (checked ? [muscle] : []) : checked ? [...new Set([...props.modelValue, muscle])] : props.modelValue.filter(item => item !== muscle));
}
async function showRequired(event) {
  event.preventDefault();
  expanded.value = true;
  await nextTick();
  event.target.focus();
}
</script>
<template>
  <div class="muscle-select-field">
    <details class="muscle-select" :open="expanded" @toggle="expanded = $event.target.open">
      <summary>{{ label }}<small v-if="required" class="muscle-required-label">Required</small><span>{{ single ? modelValue.length === 1 ? modelValue[0] : 'Choose one muscle' : modelValue.length ? `${modelValue.length} selected` : 'Choose muscles' }}</span></summary>
      <div class="muscle-select-options"><fieldset v-for="group in options" :key="group.name"><legend>{{ group.name }}</legend><label v-for="muscle in group.muscles" :key="muscle" class="checkbox-label"><input :type="single ? 'radio' : 'checkbox'" :name="single ? radioName : undefined" :required="required && single" :checked="modelValue.includes(muscle)" @invalid="showRequired" @change="toggle(muscle, $event.target.checked)">{{ muscle === group.name ? `${muscle} (general)` : muscle }}</label></fieldset></div>
    </details>
    <p v-if="required && modelValue.length !== 1" class="hint muscle-required-hint">Select exactly one primary muscle.</p>
    <div v-if="modelValue.length" class="selected-muscles"><button v-for="muscle in modelValue" :key="muscle" type="button" :aria-label="`Remove ${muscle} from ${label.toLowerCase()}`" @click="toggle(muscle, false)">{{ muscle }} <span aria-hidden="true">×</span></button></div>
  </div>
</template>

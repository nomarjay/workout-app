<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { defaultTrainerAlgorithm, validateAlgorithm } from '../utils/trainerAlgorithms.js';
const props = defineProps({ modelValue: Object, disabled: Boolean });
const emit = defineEmits(['update:modelValue']);
const saved = ref([structuredClone(defaultTrainerAlgorithm)]);
const draft = ref(null);
const busy = ref(false);
const error = ref('');
const choices = computed(() => saved.value.some(item => item.id === props.modelValue?.id) ? saved.value : [...saved.value, props.modelValue].filter(Boolean));
watch(() => props.modelValue, value => { draft.value = JSON.parse(JSON.stringify(value)); }, { immediate: true });
function select(id) { const item = choices.value.find(item => item.id === id); if (item) emit('update:modelValue', JSON.parse(JSON.stringify(item))); }
function apply() {
  try { error.value = ''; emit('update:modelValue', { ...validateAlgorithm(draft.value), id: 'custom-draft' }); }
  catch (cause) { error.value = cause.message; }
}
async function save(update = false) {
  error.value = '';
  try {
    const body = validateAlgorithm(draft.value);
    busy.value = true;
    const response = await fetch(update ? `/api/trainer-algorithms/${props.modelValue.id}` : '/api/trainer-algorithms', { method: update ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save algorithm.');
    saved.value = [...saved.value.filter(item => item.id !== result.id), result];
    emit('update:modelValue', result);
  } catch (cause) { error.value = cause.message; }
  finally { busy.value = false; }
}
onMounted(async () => {
  try {
    const response = await fetch('/api/trainer-algorithms');
    if (!response.ok) throw new Error('Could not load saved algorithms. The built-in default is available.');
    saved.value = await response.json();
  } catch (cause) { error.value = cause.message; }
});
</script>
<template>
  <section class="algorithm-maker" aria-labelledby="algorithm-heading">
    <h3 id="algorithm-heading">Workout algorithm</h3>
    <label>Selected algorithm<select :value="modelValue.id" :disabled="disabled || busy" @change="select($event.target.value)"><option v-for="item in choices" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
    <p class="hint">{{ modelValue.sets.length }} sets per exercise. Percentages use that exercise’s template maximum weight. Weight and rep ranges remain ranges in your set plan.</p>
    <details><summary>Algorithm maker</summary>
      <fieldset :disabled="disabled || busy">
        <label>Algorithm name<input v-model="draft.name" maxlength="100"></label>
        <div v-for="(set, index) in draft.sets" :key="index" class="algorithm-set">
          <h4>Set {{ index + 1 }}</h4>
          <div class="trainer-inputs">
            <label>Set label<input v-model="set.label" maxlength="60"></label>
            <label>Minimum weight %<input v-model.number="set.percentMin" type="number" min="0.01" max="100" step="any"></label>
            <label>Maximum weight %<input v-model.number="set.percentMax" type="number" min="0.01" max="100" step="any"></label>
            <label>Minimum reps<input v-model.number="set.repsMin" type="number" min="1" max="100" step="1"></label>
            <label>Maximum reps<input v-model.number="set.repsMax" type="number" min="1" max="100" step="1"></label>
          </div>
          <label class="algorithm-warmup"><input v-model="set.warmup" type="checkbox"> Warm-up set</label>
          <button type="button" :disabled="draft.sets.length === 1" @click="draft.sets.splice(index, 1)">Remove set {{ index + 1 }}</button>
        </div>
        <div class="row-actions">
          <button type="button" :disabled="draft.sets.length >= 20" @click="draft.sets.push({ label: 'Working set', warmup: false, percentMin: 75, percentMax: 75, repsMin: 8, repsMax: 8 })">+ Add set</button>
          <button type="button" @click="apply">Use edited template</button>
          <button type="button" @click="save(false)">{{ busy ? 'Saving…' : 'Save as new algorithm' }}</button>
          <button v-if="/^[a-f\d]{24}$/i.test(modelValue.id)" type="button" @click="save(true)">Update saved algorithm</button>
          <button type="button" @click="select('default-four-set')">Restore default</button>
        </div>
      </fieldset>
    </details>
    <p v-if="error" class="message error" role="alert">{{ error }}</p>
  </section>
</template>

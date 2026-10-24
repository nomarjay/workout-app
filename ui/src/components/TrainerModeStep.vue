<script setup>
import { onMounted, ref } from 'vue';
import SmithWeightInfo from './SmithWeightInfo.vue';
import TrainerAlgorithmMaker from './TrainerAlgorithmMaker.vue';
import { defaultTrainerAlgorithm, algorithmSetPlan } from '../utils/trainerAlgorithms.js';
import TrainerSetGuide from './TrainerSetGuide.vue';
import { suggestedLoad } from '../utils/training.js';
import { barResistance, isSmithMachine, totalLoad, exerciseLabel } from '../utils/equipment.js';
const props = defineProps({ workout: { type: Object, required: true } });
const emit = defineEmits(['done']);
const configuring = ref(false);
const algorithm = ref(structuredClone(defaultTrainerAlgorithm));
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const needsReview = ref(false);
const weightUnit = ref('kg');
const assignments = ref([]);
const profile = ref(null);
const options = ref({ weightUnits: [], tempos: [] });
const tempoLabels = { controlled: 'Controlled', 'slow-and-controlled': 'Slow and controlled', explosive: 'Explosive' };
const path = `/api/trainer-mode/${encodeURIComponent(props.workout.id)}`;
const blank = exerciseIndex => ({ exerciseIndex, oneRepMax: '', repsInReserve: 2, minWeight: '', maxWeight: '', workingWeight: '', reps: 8, sets: 3, referenceMaxWeight: '', useAlgorithm: true, loadMode: 'adaptive', tempo: 'controlled' });
async function read(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Could not load Trainer Mode.');
  return body;
}
async function load() {
  loading.value = true;
  error.value = '';
  try {
    options.value = await read(await fetch('/api/trainer-mode'));
    profile.value = await read(await fetch('/api/profile', { headers: { 'X-Profile-Id': typeof window === 'undefined' ? 'primary' : window.localStorage.getItem('form-profile-id') || 'primary' } }));
    const response = await fetch(path);
    const data = await response.json();
    if (!response.ok && !(response.status === 404 && data.error === 'Trainer Mode has not been assigned to this workout.')) {
      throw new Error(data.error || 'Could not load Trainer Mode.');
    }
    const plan = response.ok ? data : null;
    algorithm.value = plan?.algorithm || structuredClone(defaultTrainerAlgorithm);
    needsReview.value = Boolean(plan?.needsReview);
    weightUnit.value = plan?.weightUnit || 'kg';
    // Changed occurrences cannot safely inherit prescriptions by array position.
    assignments.value = props.workout.exercises.map((_, index) => {
      const saved = !plan?.needsReview && plan?.exercises.find(item => item.exerciseIndex === index);
      if (!saved) return blank(index);
      const maximum = saved.oneRepMax ?? saved.referenceMaxWeight ?? saved.maxWeight ?? '';
      return { ...blank(index), ...saved, oneRepMax: maximum, referenceMaxWeight: maximum, useAlgorithm: saved.useAlgorithm ?? true };
    });
  } catch (cause) { error.value = cause.message; }
  finally { loading.value = false; }
}
function applyLoad(item) {
  const exercise = props.workout.exercises[item.exerciseIndex];
  const resistance = barResistance(exercise, weightUnit.value);
  const maximum = totalLoad(item.oneRepMax, exercise, weightUnit.value);
  if (maximum === null || maximum <= 0) return;
  item.referenceMaxWeight = item.oneRepMax;
  if (item.useAlgorithm) {
    const plan = algorithmSetPlan(algorithm.value, maximum, 0.01, resistance);
    const working = plan.find(set => !set.warmup && set.repsMin === 8) || plan.find(set => !set.warmup) || plan[0];
    Object.assign(item, { minWeight: Math.max(0, Math.round((Math.min(...plan.map(set => set.weightMin)) - resistance) * 100) / 100), maxWeight: Math.max(0, Math.round((Math.max(...plan.map(set => set.weightMax)) - resistance) * 100) / 100), workingWeight: Math.max(0, Math.round((working.weightMin - resistance) * 100) / 100), reps: working.repsMin, sets: plan.length });
  } else {
    if (!Number.isInteger(item.reps) || item.reps < 1) item.reps = 8;
    if (!Number.isSafeInteger(item.sets) || item.sets < 1) item.sets = 3;
    const load = suggestedLoad(maximum, item.reps, item.repsInReserve ?? 2);
    if (load === null) return;
    Object.assign(item, { workingWeight: Math.max(0, Math.round((load - resistance) * 100) / 100), minWeight: 0, maxWeight: item.oneRepMax });
  }
}
async function save() {
  busy.value = true;
  error.value = '';
  try {
    await read(await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weightUnit: weightUnit.value, algorithm: algorithm.value, exercises: assignments.value.map(item => ({ ...item, referenceMaxWeight: item.oneRepMax, weightIncrement: 0.01, loadMode: 'adaptive' })) }) }));
    emit('done', true);
  } catch (cause) { error.value = cause.message; }
  finally { busy.value = false; }
}
onMounted(load);
</script>
<template>
  <div class="trainer-layout">
  <section class="panel trainer-step" aria-labelledby="trainer-heading">
    <p class="eyebrow">STEP 2 · OPTIONAL</p>
    <h2 id="trainer-heading">Trainer Mode · {{ workout.name }}</h2>
    <p class="hint">Your workout is saved. Enter a one-rep maximum and choose a tempo for each exercise, then click Calculate based on one rep Max. The selected workout algorithm supplies the set-by-set plan.</p>
    <p class="hint">Selected algorithm: <strong>{{ algorithm.name }}</strong></p>
    <p v-if="loading" role="status">Loading Trainer Mode…</p>
    <p v-if="error" class="message error" role="alert">{{ error }} <button type="button" v-if="!assignments.length" @click="load" :disabled="loading">Retry</button></p>
    <p v-if="needsReview" class="message error" role="status">The workout exercises changed. Assign settings again for the current exercise order.</p>
    <form v-if="configuring && assignments.length" @submit.prevent="save">
      <fieldset :disabled="busy || loading" class="trainer-fields">
        <TrainerAlgorithmMaker v-model="algorithm" :disabled="busy || loading" />
        <label>Weight unit<select v-model="weightUnit"><option v-for="unit in options.weightUnits" :key="unit" :value="unit">{{ unit }}</option></select></label>
        <p class="hint">Weights use the selected unit. Changing units does not convert entered values.</p>
        <fieldset v-for="(item, index) in assignments" :key="index" class="trainer-exercise">
          <legend>{{ index + 1 }}. {{ exerciseLabel(workout.exercises[index]) }}</legend>
          <p class="hint">Attachment: {{ workout.exercises[index].attachment || 'None' }}</p>
          <div class="trainer-inputs">
            <label>One-rep max · maximum weight ({{ weightUnit }})<SmithWeightInfo :exercise="workout.exercises[index]" /><input v-model.number="item.oneRepMax" type="number" :min="isSmithMachine(workout.exercises[index]) ? 0 : 0.01" step="any" required></label>

            <label>Tempo<select v-model="item.tempo"><option v-for="tempo in options.tempos" :key="tempo" :value="tempo">{{ tempoLabels[tempo] || tempo }}</option></select></label>
          </div>
          <label class="algorithm-warmup"><input v-model="item.useAlgorithm" type="checkbox"> Use the selected workout algorithm for this exercise</label>
          <div class="row-actions"><button type="button" :disabled="!Number.isFinite(item.oneRepMax) || (item.oneRepMax < 0 || (item.oneRepMax === 0 && !isSmithMachine(workout.exercises[index])))" @click="applyLoad(item)">Calculate based on one rep Max</button></div>
          <p class="hint">Calculate fills the exercise settings below. The set plan uses your maximum and the selected algorithm. Turn off the algorithm for this exercise to use the manual sets and reps instead.</p>
          <div class="trainer-inputs">
            <label>Planned reps in reserve<input v-model.number="item.repsInReserve" type="number" min="0" max="5" step="1"></label>
            <label>Minimum weight ({{ weightUnit }})<SmithWeightInfo :exercise="workout.exercises[index]" /><input v-model.number="item.minWeight" type="number" min="0" step="any" :required="!item.useAlgorithm"></label>
            <label>Maximum weight ({{ weightUnit }})<SmithWeightInfo :exercise="workout.exercises[index]" /><input v-model.number="item.maxWeight" type="number" :min="item.minWeight || 0" step="any" :required="!item.useAlgorithm"></label>
            <label>Working weight ({{ weightUnit }})<SmithWeightInfo :exercise="workout.exercises[index]" /><input v-model.number="item.workingWeight" type="number" :min="item.minWeight || 0" :max="item.maxWeight === '' ? undefined : item.maxWeight" step="any" :required="!item.useAlgorithm"></label>
            <label>Reps per set<input v-model.number="item.reps" type="number" min="1" step="1" :readonly="item.useAlgorithm" :required="!item.useAlgorithm"></label>
            <label>Sets<input v-model.number="item.sets" type="number" min="1" step="1" :readonly="item.useAlgorithm" :required="!item.useAlgorithm"></label>
          </div>
          <p class="hint">{{ algorithm.sets.length }} sets · {{ algorithm.name }}. Enter the reference maximum for this exercise using the same machine and load convention.</p>
        </fieldset>
        <section aria-label="Template calculation context">
          <h3>Template percentages</h3>
          <p class="hint">Maximum weight is the reference value you choose for this exercise. Rep targets come from the selected algorithm; they are not a prediction of how many reps you can perform at that load. Keep the same machine and total-load or per-hand convention when entering the reference weight.</p>
        </section>
      </fieldset>
      <div class="row-actions"><button class="primary" :disabled="busy || loading">{{ busy ? 'Saving…' : 'Save Trainer Mode' }}</button><button type="button" :disabled="busy" @click="emit('done', false)">Cancel</button></div>
    </form>
    <div v-else class="row-actions"><button class="primary" :disabled="loading || !assignments.length" @click="configuring = true">Configure Trainer Mode</button><button @click="emit('done', false)">Skip for now</button></div>
  </section>
  <TrainerSetGuide :workout="workout" :assignments="assignments" :algorithm="algorithm" :weight-unit="weightUnit" :loading="loading" />
  </div>
</template>

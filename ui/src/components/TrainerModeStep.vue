<script setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { useTrainerProgress } from '../composables/useTrainerProgress.js';
import SmithWeightInfo from './SmithWeightInfo.vue';
import TrainerAlgorithmMaker from './TrainerAlgorithmMaker.vue';
import {
  defaultTrainerAlgorithm,
  algorithmSetPlan,
} from '../utils/trainerAlgorithms.js';
import TrainerWorkoutDetails from './TrainerWorkoutDetails.vue';
import WorkoutPreviewDialog from './WorkoutPreviewDialog.vue';
import { suggestedLoad } from '../utils/training.js';
import {
  barResistance,
  isSmithMachine,
  totalLoad,
  exerciseLabel,
} from '../utils/equipment.js';
const props = defineProps({ workout: { type: Object, required: true }, saveDraft: Function });
const draftName = ref(props.workout.name);
const emit = defineEmits(['done']);
const assignments = ref([]);
const { activeIndex, completed, markDirty, completeExercise, resetProgress } =
  useTrainerProgress(assignments);
const editor = ref(null);
const previewOpen = ref(false);
const selectedIndex = ref(0);
watch(activeIndex, index => { if (Number.isInteger(index)) selectedIndex.value = index; }, { flush: 'sync' });
async function selectExercise(index) {
  activeIndex.value = index;
  await nextTick();
  const heading = editor.value?.querySelector('[data-active-heading]');
  heading?.focus({ preventScroll: true });
  heading?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth',
    block: 'nearest',
  });
}
async function continueExercise(item) {
  if (item.useAlgorithm) applyLoad(item);
  const fields = editor.value?.querySelector(
    `[data-exercise-index="${item.exerciseIndex}"]`
  );
  const invalid = [...(fields?.querySelectorAll('input, select') || [])].find(
    (input) => !input.checkValidity()
  );
  if (invalid) {
    const disclosure = invalid.closest('details');
    if (disclosure) disclosure.open = true;
    await nextTick();
    invalid.reportValidity();
    return;
  }
  completeExercise(item.exerciseIndex);
  await selectExercise(activeIndex.value);
}
const algorithm = ref(structuredClone(defaultTrainerAlgorithm));
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const needsReview = ref(false);
const weightUnit = ref('kg');
watch(
  [algorithm, weightUnit],
  () => {
    resetProgress();
  },
  { deep: true }
);

const profile = ref(null);
const options = ref({ weightUnits: [], tempos: [] });
const tempoLabels = {
  controlled: 'Controlled',
  'slow-and-controlled': 'Slow and controlled',
  explosive: 'Explosive',
};
const path = `/api/trainer-mode/${encodeURIComponent(props.workout.id)}`;
const blank = (exerciseIndex) => ({
  exerciseIndex,
  oneRepMax: '',
  repsInReserve: 2,
  minWeight: '',
  maxWeight: '',
  workingWeight: '',
  reps: 8,
  sets: 3,
  referenceMaxWeight: '',
  useAlgorithm: true,
  loadMode: 'adaptive',
  tempo: 'controlled',
});
async function read(response) {
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error || 'Could not load Trainer Mode.');
  return body;
}
async function load() {
  loading.value = true;
  error.value = '';
  try {
    options.value = await read(await fetch('/api/trainer-mode'));
    profile.value = await read(
      await fetch('/api/profile', {
        headers: {
          'X-Profile-Id':
            typeof window === 'undefined'
              ? 'primary'
              : window.localStorage.getItem('form-profile-id') || 'primary',
        },
      })
    );
    const response = props.workout.isDraft ? null : await fetch(path);
    const data = response ? await response.json() : null;
    if (
      response && !response.ok &&
      !(
        response.status === 404 &&
        data.error === 'Trainer Mode has not been assigned to this workout.'
      )
    ) {
      throw new Error(data.error || 'Could not load Trainer Mode.');
    }
    const plan = response?.ok ? data : null;
    algorithm.value =
      plan?.algorithm || structuredClone(defaultTrainerAlgorithm);
    needsReview.value = Boolean(plan?.needsReview);
    weightUnit.value = plan?.weightUnit || 'kg';
    // Changed occurrences cannot safely inherit prescriptions by array position.
    assignments.value = props.workout.exercises.map((_, index) => {
      const saved =
        !plan?.needsReview &&
        plan?.exercises.find((item) => item.exerciseIndex === index);
      if (!saved) return blank(index);
      const maximum =
        saved.oneRepMax ?? saved.referenceMaxWeight ?? saved.maxWeight ?? '';
      return {
        ...blank(index),
        ...saved,
        oneRepMax: maximum,
        referenceMaxWeight: maximum,
        useAlgorithm: saved.useAlgorithm ?? true,
      };
    });
  } catch (cause) {
    error.value = cause.message;
  } finally {
    loading.value = false;
  }
}
function applyLoad(item) {
  const exercise = props.workout.exercises[item.exerciseIndex];
  const resistance = barResistance(exercise, weightUnit.value);
  const maximum = totalLoad(item.oneRepMax, exercise, weightUnit.value);
  if (maximum === null || maximum <= 0) return;
  item.referenceMaxWeight = item.oneRepMax;
  if (item.useAlgorithm) {
    const plan = algorithmSetPlan(algorithm.value, maximum, 0.01, resistance);
    const working =
      plan.find((set) => !set.warmup && set.repsMin === 8) ||
      plan.find((set) => !set.warmup) ||
      plan[0];
    Object.assign(item, {
      minWeight: Math.max(
        0,
        Math.round(
          (Math.min(...plan.map((set) => set.weightMin)) - resistance) * 100
        ) / 100
      ),
      maxWeight: Math.max(
        0,
        Math.round(
          (Math.max(...plan.map((set) => set.weightMax)) - resistance) * 100
        ) / 100
      ),
      workingWeight: Math.max(
        0,
        Math.round((working.weightMin - resistance) * 100) / 100
      ),
      reps: working.repsMin,
      sets: plan.length,
    });
  } else {
    if (!Number.isInteger(item.reps) || item.reps < 1) item.reps = 8;
    if (!Number.isSafeInteger(item.sets) || item.sets < 1) item.sets = 3;
    const load = suggestedLoad(maximum, item.reps, item.repsInReserve ?? 2);
    if (load === null) return;
    Object.assign(item, {
      workingWeight: Math.max(0, Math.round((load - resistance) * 100) / 100),
      minWeight: 0,
      maxWeight: item.oneRepMax,
    });
  }
}
async function save() {
  const pending = assignments.value.findIndex(
    (item) => !completed.value.includes(item.exerciseIndex)
  );
  if (pending >= 0) {
    await selectExercise(pending);
    error.value = 'Complete this exercise before saving your plan.';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    const body = {
      weightUnit: weightUnit.value,
      algorithm: algorithm.value,
      exercises: assignments.value.map(item => ({ ...item, referenceMaxWeight: item.oneRepMax, weightIncrement: 0.01, loadMode: 'adaptive' })),
    };
    if (props.workout.isDraft) {
      if (!props.saveDraft) throw new Error('Could not save this draft workout.');
      await props.saveDraft({ name: draftName.value, plan: body });
    } else await read(
      await fetch(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    );
    emit('done', true);
  } catch (cause) {
    error.value = cause.message;
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div
    class="grid items-start gap-6 min-[1400px]:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]"
  >
    <section
      class="panel trainer-step max-w-none!"
      aria-labelledby="trainer-heading"
    >
      <header class="mb-6">
        <p class="eyebrow">TRAINER MODE</p>
        <h2 id="trainer-heading">{{ workout.name }}</h2>
        <p class="hint">
          Set up one exercise at a time. {{ workout.isDraft ? 'Save the routine and plan together when ready.' : 'Your workout is already saved.' }}
        </p>
      </header>
      <label v-if="workout.isDraft">Workout name<input v-model="draftName" :disabled="busy" maxlength="100" required /></label>
      <p v-if="loading" role="status">Loading Trainer Mode…</p>
      <p v-if="error" class="message error" role="alert">
        {{ error }}
        <button
          v-if="!assignments.length"
          type="button"
          @click="load"
          :disabled="loading"
        >
          Retry
        </button>
      </p>
      <p v-if="needsReview" class="message error" role="status">
        The exercises changed. Review the settings for each exercise.
      </p>
      <div
        v-if="assignments.length"
        class="grid items-start gap-6 min-[900px]:grid-cols-[200px_minmax(0,1fr)]"
      >
        <nav
          aria-label="Exercise setup"
          class="min-w-0 min-[900px]:sticky min-[900px]:top-5"
        >
          <p class="mt-0 text-sm text-(--color-text-muted)" aria-live="polite">
            {{ completed.length }} of {{ assignments.length }} ready
          </p>
          <ol
            class="m-0 flex list-none gap-2 overflow-x-auto p-0 min-[900px]:flex-col"
          >
            <li
              v-for="(exercise, index) in workout.exercises"
              :key="index"
              class="shrink-0 min-[900px]:shrink"
            >
              <button
                type="button"
                class="flex min-h-11 w-full items-center gap-2 text-left text-sm"
                :class="
                  activeIndex === index
                    ? 'border-(--color-primary)! bg-(--color-selection-background)!'
                    : 'border-transparent!'
                "
                :aria-current="activeIndex === index ? 'step' : undefined"
                :disabled="busy || loading"
                @click="selectExercise(index)"
              >
                <span aria-hidden="true" class="shrink-0">{{
                  completed.includes(index) ? '✓' : index + 1
                }}</span>
                <span class="min-w-0 wrap-anywhere"
                  >{{ exerciseLabel(exercise)
                  }}<span v-if="completed.includes(index)" class="sr-only">
                    — ready</span
                  ></span
                >
              </button>
            </li>
          </ol>
        </nav>
        <form ref="editor" class="min-w-0" novalidate @submit.prevent="save">
          <fieldset :disabled="busy || loading" class="trainer-fields">
            <details
              class="mb-6 rounded-xl border border-(--color-border-subtle) p-4"
            >
              <summary class="cursor-pointer font-semibold">
                Plan settings
                <span class="hint"
                  >· {{ weightUnit }} · {{ algorithm.name }}</span
                >
              </summary>
              <div class="mt-4">
                <TrainerAlgorithmMaker
                  v-model="algorithm"
                  :disabled="busy || loading"
                />
              </div>
              <label
                >Weight unit<select v-model="weightUnit">
                  <option
                    v-for="unit in options.weightUnits"
                    :key="unit"
                    :value="unit"
                  >
                    {{ unit }}
                  </option>
                </select></label
              >
              <p class="hint">
                Changing units does not convert entered weights. Changing these
                settings requires reviewing each exercise again.
              </p>
            </details>
            <fieldset
              v-for="(item, index) in assignments"
              v-show="activeIndex === index"
              :key="index"
              :data-exercise-index="index"
              class="m-0 min-w-0 border-0 p-0"
              @input="markDirty(index)"
              @change="markDirty(index)"
            >
              <legend class="mb-4 w-full text-xl font-semibold">
                <span
                  v-if="activeIndex === index"
                  data-active-heading
                  tabindex="-1"
                  class="block rounded focus-visible:outline-2 focus-visible:outline-(--color-focus)"
                  >{{ index + 1 }}.
                  {{ exerciseLabel(workout.exercises[index]) }}</span
                >
              </legend>
              <p v-if="workout.exercises[index].attachment" class="hint">
                Attachment: {{ workout.exercises[index].attachment }}
              </p>
              <div class="grid gap-4 min-[601px]:grid-cols-2">
                <label
                  >One-rep max ({{ weightUnit }})<SmithWeightInfo
                    :exercise="workout.exercises[index]" /><input
                    v-model.number="item.oneRepMax"
                    type="number"
                    :min="isSmithMachine(workout.exercises[index]) ? 0 : 0.01"
                    step="any"
                    required
                /></label>
                <label
                  >Tempo<select v-model="item.tempo" required>
                    <option
                      v-for="tempo in options.tempos"
                      :key="tempo"
                      :value="tempo"
                    >
                      {{ tempoLabels[tempo] || tempo }}
                    </option>
                  </select></label
                >
              </div>
              <details
                class="my-5 border-t border-(--color-border-subtle) pt-4"
                :open="!item.useAlgorithm"
              >
                <summary class="cursor-pointer font-semibold">
                  More options
                </summary>
                <label class="algorithm-warmup"
                  ><input v-model="item.useAlgorithm" type="checkbox" /> Use
                  {{ algorithm.name }}</label
                >
                <label
                  >Reps in reserve<input
                    v-model.number="item.repsInReserve"
                    type="number"
                    min="0"
                    max="5"
                    step="1"
                    required
                /></label>
                <div
                  v-if="!item.useAlgorithm"
                  class="mt-4 grid gap-4 min-[601px]:grid-cols-2"
                >
                  <label
                    >Minimum weight ({{ weightUnit }})<input
                      v-model.number="item.minWeight"
                      type="number"
                      min="0"
                      :max="item.oneRepMax"
                      step="any"
                      required
                  /></label>
                  <label
                    >Maximum weight ({{ weightUnit }})<input
                      v-model.number="item.maxWeight"
                      type="number"
                      :min="item.minWeight || 0"
                      :max="item.oneRepMax"
                      step="any"
                      required
                  /></label>
                  <label
                    >Working weight ({{ weightUnit }})<SmithWeightInfo
                      :exercise="workout.exercises[index]" /><input
                      v-model.number="item.workingWeight"
                      type="number"
                      :min="item.minWeight || 0"
                      :max="item.maxWeight === '' ? undefined : item.maxWeight"
                      step="any"
                      required
                  /></label>
                  <label
                    >Reps per set<input
                      v-model.number="item.reps"
                      type="number"
                      min="1"
                      max="30"
                      step="1"
                      required
                  /></label>
                  <label
                    >Sets<input
                      v-model.number="item.sets"
                      type="number"
                      min="1"
                      step="1"
                      required
                  /></label>
                </div>
                <p class="hint">
                  Use the same equipment and load convention for your maximum
                  and working weights.
                </p>
              </details>
              <div class="row-actions my-5">
                <button
                  type="button"
                  class="primary"
                  :disabled="busy || loading"
                  @click="continueExercise(item)"
                >
                  {{
                    item.useAlgorithm
                      ? 'Calculate & continue'
                      : 'Done & continue'
                  }}
                </button>
                <button
                  v-if="!item.useAlgorithm"
                  type="button"
                  @click="applyLoad(item)"
                >
                  Calculate weights
                </button>
              </div>
            </fieldset>
            <section
              v-if="activeIndex === null"
              aria-labelledby="trainer-ready-heading"
              class="rounded-xl bg-(--color-success-background) p-6"
            >
              <h3
                id="trainer-ready-heading"
                data-active-heading
                tabindex="-1"
                class="mt-0 text-xl"
              >
                Your plan is ready
              </h3>
              <p>
                All {{ assignments.length }} exercises are set up. Save your
                plan, or choose an exercise to make changes.
              </p>
            </section>
          </fieldset>
          <footer
            class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border-subtle) pt-5"
          >
            <span class="hint"
              >Changes are saved when you save the whole plan.</span
            >
            <div class="row-actions">
              <button
                class="primary"
                :disabled="
                  busy || loading || completed.length !== assignments.length
                "
              >
                {{ busy ? 'Saving…' : workout.isDraft ? 'Save workout & Trainer Mode' : 'Save Trainer Mode' }}</button
              ><button
                type="button"
                :disabled="busy"
                @click="emit('done', false)"
              >
                Cancel
              </button>
            </div>
          </footer>
        </form>
      </div>
      <div v-else class="row-actions"><button type="button" @click="emit('done', false)">Back to workout</button></div>
    </section>
    <aside class="panel min-w-0 trainer-current-details" aria-label="Selected exercise details">
      <TrainerWorkoutDetails :workout="workout" :exercise-index="selectedIndex" :assignments="assignments" :algorithm="algorithm" :weight-unit="weightUnit" :loading="loading" />
      <button type="button" class="mt-5 w-full" aria-haspopup="dialog" :disabled="loading || !assignments.length" @click="previewOpen = true">Preview full workout</button>
    </aside>
    <WorkoutPreviewDialog :open="previewOpen" :workout="workout" :assignments="assignments" :algorithm="algorithm" :weight-unit="weightUnit" :loading="loading" @close="previewOpen = false" />
  </div>
</template>

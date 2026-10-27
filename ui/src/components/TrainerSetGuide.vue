<script setup>
import SmithWeightInfo from './SmithWeightInfo.vue';
import { computed, ref, watch } from 'vue';
import { algorithmSetPlan } from '../utils/trainerAlgorithms.js';
import { suggestedSetWeight } from '../utils/training.js';
import { barResistance, totalLoad, exerciseLabel } from '../utils/equipment.js';
const props = defineProps({
  workout: Object,
  assignments: Array,
  weightUnit: String,
  loading: Boolean,
  algorithm: Object,
  detailed: Boolean,
});
const templatePlans = computed(() =>
  props.assignments.map((item) => ({
    item,
    sets:
      props.algorithm && item.useAlgorithm !== false
        ? algorithmSetPlan(
            props.algorithm,
            totalLoad(
              item.oneRepMax ?? item.referenceMaxWeight,
              props.workout.exercises[item.exerciseIndex],
              props.weightUnit
            ),
            0.01,
            barResistance(
              props.workout.exercises[item.exerciseIndex],
              props.weightUnit
            )
          )
        : [],
  }))
);
function range(min, max) {
  return min === max ? String(min) : `${min}–${max}`;
}
const feedback = ref({});
watch(
  () =>
    props.assignments.map((item) => [
      item.exerciseIndex,
      item.oneRepMax,
      item.workingWeight,
      item.reps,
      item.sets,
      item.repsInReserve,
      item.weightIncrement,
      item.maxWeight,
    ]),
  () => {
    feedback.value = {};
  },
  { deep: true }
);
function weight(item, set) {
  return suggestedSetWeight(
    {
      ...item,
      equipmentId: props.workout.exercises[item.exerciseIndex].equipmentId,
      equipment: props.workout.exercises[item.exerciseIndex].equipment,
      name: props.workout.exercises[item.exerciseIndex].name,
      setFeedback: feedback.value[item.exerciseIndex],
    },
    set,
    props.weightUnit
  );
}
function report(item, set, result) {
  const previous = feedback.value[item.exerciseIndex] || {};
  // Changing an earlier result invalidates later feedback at different loads.
  feedback.value[item.exerciseIndex] = {
    ...Object.fromEntries(
      Object.entries(previous).filter(([key]) => Number(key) < set)
    ),
    [set]: result,
  };
}
function setCount(item) {
  return Number.isSafeInteger(item.sets) && item.sets > 0 ? item.sets : 0;
}
</script>
<template>
  <aside class="panel trainer-set-guide" aria-labelledby="set-guide-heading">
    <p class="eyebrow">YOUR SET PLAN</p>
    <h2 id="set-guide-heading">Weight by set</h2>
    <p v-if="!algorithm" class="hint">
      The starting load uses your one-rep max, target reps, and reserve reps.
      Equal working sets keep the same weight. Without a one-rep max, working
      weight is the starting load.
    </p>
    <p v-if="loading" class="hint" role="status">Loading your set plan…</p>
    <p v-else-if="!assignments.length" class="hint">
      Configure Trainer Mode to see the weight for each set.
    </p>
    <template v-if="algorithm">
      <p class="hint">
        {{ algorithm.name }} · {{ algorithm.sets.length }} sets per exercise.
        Weights are percentages of your entered maximum, displayed to two
        decimal places.
      </p>
      <section
        v-for="({ item, sets }, index) in templatePlans"
        :key="item.exerciseIndex"
        class="set-guide-exercise"
      >
        <h3>
          {{ item.exerciseIndex + 1 }}.
          {{ exerciseLabel(workout.exercises[item.exerciseIndex]) }}
        </h3>
        <p class="hint">
          Attachment:
          {{ workout.exercises[item.exerciseIndex].attachment || 'None' }}
        </p>
        <p v-if="detailed" class="hint">
          Maximum:
          {{
            item.oneRepMax === '' || item.oneRepMax == null
              ? 'Not entered'
              : `${item.oneRepMax} ${weightUnit}`
          }}
          · Tempo: {{ (item.tempo || 'controlled').replaceAll('-', ' ') }} ·
          Reps in reserve: {{ item.repsInReserve ?? 2 }}
        </p>
        <p v-if="detailed && item.useAlgorithm === false" class="hint">
          Weight range: {{ item.minWeight }}–{{ item.maxWeight }}
          {{ weightUnit }}
        </p>
        <p v-if="item.useAlgorithm === false" class="hint">
          Manual plan · {{ item.sets }} sets × {{ item.reps }} reps at
          {{
            totalLoad(
              item.workingWeight,
              workout.exercises[item.exerciseIndex],
              weightUnit
            )
          }}
          {{ weightUnit
          }}<SmithWeightInfo
            :exercise="workout.exercises[item.exerciseIndex]"
          />
        </p>
        <p v-else-if="!sets.length" class="hint">
          Enter a maximum weight to see all {{ algorithm.sets.length }} sets.
        </p>
        <table v-else>
          <caption class="sr-only">
            Template set plan for
            {{
              workout.exercises[item.exerciseIndex].name
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Set</th>
              <th scope="col">% max</th>
              <th scope="col">Weight</th>
              <th scope="col">Reps</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="set in sets" :key="set.set">
              <th scope="row">
                {{ set.set }}. {{ set.label
                }}<span v-if="set.warmup" class="subtle-badge">Warm-up</span>
              </th>
              <td>{{ range(set.percentMin, set.percentMax) }}%</td>
              <td>
                {{ range(set.weightMin, set.weightMax) }} {{ weightUnit
                }}<SmithWeightInfo
                  :exercise="workout.exercises[item.exerciseIndex]"
                />
              </td>
              <td>{{ range(set.repsMin, set.repsMax) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
    <template v-else>
      <section
        v-for="(item, index) in assignments"
        :key="item.exerciseIndex"
        class="set-guide-exercise"
      >
        <h3>
          {{ item.exerciseIndex + 1 }}.
          {{ exerciseLabel(workout.exercises[item.exerciseIndex]) }}
        </h3>
        <p class="hint">
          Attachment:
          {{ workout.exercises[item.exerciseIndex].attachment || 'None' }}
        </p>
        <p v-if="!setCount(item) || weight(item, 1) === null" class="hint">
          Enter a one-rep max (or working weight), 1–30 reps, and number of sets
          to see your plan.
        </p>
        <template v-else>
          <p
            v-if="
              item.reps + (item.repsInReserve ?? 2) > 10 && item.oneRepMax > 0
            "
            class="hint"
          >
            Higher-rep estimates are less certain. Adjust to your performance.
          </p>
          <p v-if="weight(item, 1) === 0" class="hint">
            The suggested load rounds to zero. Use a smaller weight increment if
            your equipment supports it.
          </p>
          <table>
            <caption class="sr-only">
              Set plan for
              {{
                workout.exercises[item.exerciseIndex].name
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">Set</th>
                <th scope="col">Weight</th>
                <th scope="col">Reps</th>
                <th scope="col">Set result</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="set in Math.min(setCount(item), 100)" :key="set">
                <th scope="row">Set {{ set }}</th>
                <td>
                  {{ weight(item, set) }} {{ weightUnit
                  }}<SmithWeightInfo
                    :exercise="workout.exercises[item.exerciseIndex]"
                  />
                </td>
                <td>
                  {{
                    Number.isInteger(item.reps) && item.reps > 0
                      ? item.reps
                      : '—'
                  }}
                </td>
                <td>
                  <select
                    :aria-label="`Result for ${
                      workout.exercises[item.exerciseIndex].name
                    }, set ${set}`"
                    :value="feedback[item.exerciseIndex]?.[set] || ''"
                    @change="report(item, set, $event.target.value)"
                  >
                    <option value="">Not completed</option>
                    <option value="target">
                      Target met · effort on target
                    </option>
                    <option value="hard">Target met · too hard</option>
                    <option value="missed">Missed target reps</option>
                    <option value="easy">Target met · too easy</option>
                  </select>
                </td>
              </tr>
              <tr v-if="setCount(item) > 100">
                <th scope="row">Sets 101–{{ setCount(item) }}</th>
                <td>
                  {{ weight(item, 101) }} {{ weightUnit
                  }}<SmithWeightInfo
                    :exercise="workout.exercises[item.exerciseIndex]"
                  />
                </td>
                <td>
                  {{
                    Number.isInteger(item.reps) && item.reps > 0
                      ? item.reps
                      : '—'
                  }}
                </td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </template>
      </section>
      <p v-if="assignments.length" class="hint">
        Set feedback changes the next suggested load: too hard lowers it one
        equipment increment; missed reps lower it two; too easy raises it one,
        capped by your maximum weight and one-rep max. Otherwise the weight
        stays unchanged. These are adjustable starting suggestions. Feedback
        affects this preview only and resets when the prescription changes.
      </p>
    </template>
  </aside>
</template>

<script setup>
import {
  computed,
  nextTick,
  onActivated,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue';
import WorkoutCalendar from '../components/WorkoutCalendar.vue';
import { equipmentType, attachmentIdsFor } from '../utils/equipment.js';
import {
  estimatedMinutes,
  formatDate,
  localDate,
  weekBounds,
  primaryMusclesFor,
} from '../utils/dashboard.js';
const props = defineProps({
  profile: Object,
  profiles: { type: Array, default: () => [] },
  profileId: String,
  signedOut: Boolean,
  workouts: Array,
  schedules: Array,
  logs: { type: Array, default: () => [] },
  catalog: Object,
  busy: Boolean,
  loading: Boolean,
});
const emit = defineEmits([
  'saveProfile',
  'deleteProfile',
  'chooseProfile',
  'saveSchedule',
  'removeSchedule',
  'browseWorkouts',
  'createWorkout',
  'editWorkout',
  'completeWorkout',
]);
const today = ref(localDate());
const selected = ref(today.value);
const planning = ref(false);
const confirming = ref(false);
const workoutChoice = ref('');
const creatingWorkout = ref(false);
watch(
  () => props.workouts,
  (workouts, previous) => {
    if (!creatingWorkout.value) return;
    const added = workouts.find(
      (item) => !previous.some((old) => old.id === item.id)
    );
    if (added) {
      workoutChoice.value = added.id;
      planning.value = true;
      creatingWorkout.value = false;
    }
  }
);
const duration = ref('');
const intensity = ref('');
const frequency = ref('none');
const until = ref('');
const planDate = ref(today.value);
const editingRepeat = ref(false);
const repeating = computed(() => props.profile?.repeatingSchedule);
const scope = ref('single');
const session = ref(null);
watch(
  () => props.logs,
  (logs, previous) => {
    if (logs.length > previous.length) session.value = null;
  }
);
function startWorkout() {
  if (!workout.value || completedWorkout.value || session.value) return;
  session.value = {
    workoutId: workout.value.id,
    scheduledDate: selected.value,
    name: workout.value.name,
    exercises: workout.value.exercises.map((item) => ({ ...item })),
  };
}
function options(exercise) {
  return props.catalog.exercises.filter(
    (item) => item.exerciseId === exercise.exerciseId
  );
}
function attachments(exercise) {
  const allowed = attachmentIdsFor(
    props.catalog.equipment.find(
      (item) => String(item.id) === String(exercise.equipmentId)
    )
  );
  return props.catalog.attachments.filter((item) =>
    allowed.some((id) => String(id) === String(item.id))
  );
}
function changeEquipment(index, key) {
  const exercise = options(session.value.exercises[index]).find(
    (item) => item.equipmentOptionKey === key
  );
  if (exercise)
    session.value.exercises[index] = {
      ...exercise,
      attachment: exercise.attachment ?? null,
    };
}
function finishWorkout() {
  emit('completeWorkout', {
    workoutId: session.value.workoutId,
    scheduledDate: session.value.scheduledDate,
    selections: session.value.exercises.map((item) => ({
      exerciseId: item.exerciseId,
      equipmentOptionKey: item.equipmentOptionKey,
      attachment: item.attachment ?? null,
    })),
  });
}
let timer;
function updateDate() {
  const date = localDate();
  if (date !== today.value && selected.value === today.value)
    selected.value = date;
  today.value = date;
}
onMounted(() => {
  timer = setInterval(updateDate, 30000);
});
onActivated(updateDate);
onUnmounted(() => clearInterval(timer));
const schedule = computed(() =>
  props.schedules.find((item) => item.date === selected.value)
);
const workout = computed(() =>
  props.workouts.find((item) => item.id === schedule.value?.workoutId)
);
const completedWorkout = computed(() =>
  props.logs.find(
    (log) =>
      log.scheduledDate === selected.value &&
      (!workout.value || log.workoutId === workout.value.id)
  )
);
const chosenWorkout = computed(() =>
  props.workouts.find((item) => item.id === workoutChoice.value)
);
const minutes = computed(
  () => schedule.value?.durationMinutes ?? estimatedMinutes(workout.value)
);
const primaryMuscles = computed(() => primaryMusclesFor(workout.value));
const weekCount = computed(() => {
  const { start, end } = weekBounds(today.value);
  return props.schedules.filter(
    (item) => item.date >= start && item.date <= end
  ).length;
});

const completedThisWeek = computed(() => {
  const { start, end } = weekBounds(today.value);
  return props.logs.filter((log) => {
    if (typeof log.completedAt !== 'string') return false;
    const date =
      log.completedAt.length === 10
        ? log.completedAt
        : localDate(new Date(log.completedAt));
    return date >= start && date <= end;
  }).length;
});

const sortedWorkouts = computed(() =>
  [...props.workouts].sort((a, b) => a.name.localeCompare(b.name))
);
watch([selected, () => props.schedules], () => {
  planning.value = false;
  confirming.value = false;
});
function plan(source = schedule.value) {
  editingRepeat.value = !!source?.profileRepeat;
  if (editingRepeat.value) source = repeating.value;
  planDate.value = source?.date || selected.value;
  scope.value = source?.seriesId ? 'future' : 'single';
  frequency.value = source?.frequency || 'none';
  until.value = source?.until || '';
  workoutChoice.value = source?.workoutId || '';
  duration.value = source?.durationMinutes ?? '';
  intensity.value = source?.intensity || '';
  planning.value = true;
  confirming.value = false;
}
function saveSchedule() {
  emit('saveSchedule', {
    date: planDate.value,
    workoutId: workoutChoice.value,
    durationMinutes: duration.value === '' ? null : Number(duration.value),
    intensity: intensity.value || null,
    scope: scope.value,
    frequency: frequency.value,
    until: frequency.value === 'none' ? null : until.value || null,
    profileRepeat: editingRepeat.value,
  });
}
async function calendarAction({ date, action }) {
  selected.value = date;
  await nextTick();
  if (['create', 'schedule', 'frequency'].includes(action)) plan();
  if (action === 'edit' && workout.value) emit('editWorkout', workout.value);
  if (action === 'start' && workout.value && !session.value) startWorkout();
  if (action === 'delete' && workout.value) {
    scope.value = schedule.value?.seriesId ? 'future' : 'single';
    confirming.value = true;
    planning.value = false;
  }
  await nextTick();
  document
    .getElementById('daily-heading')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
watch(
  () => props.profileId,
  () => {
    session.value = null;
    selected.value = today.value;
    planning.value = false;
    confirming.value = false;
  }
);
</script>
<template>
  <div
    class="dashboard leading-[1.6] [&_label]:text-[15px] [&_button]:min-h-11 [&_button]:text-base [&_button]:px-[18px] [&_button]:py-[11px] [&_input]:min-h-11 [&_input]:text-base [&_select]:min-h-11 [&_select]:text-base [&_summary]:cursor-pointer [&_summary]:py-2.5 [&_summary]:text-[15px] [&_summary]:font-semibold [&_summary:focus-visible]:outline-3 [&_summary:focus-visible]:outline-(--color-focus) [&_summary:focus-visible]:outline-offset-4"
  >
    <section
      class="dashboard-welcome flex flex-col items-start justify-between gap-5 rounded-[18px] border border-(--color-border-subtle) bg-(--color-surface) px-5 py-6 text-(--color-welcome-text) min-[801px]:flex-row min-[801px]:items-center min-[801px]:gap-6 min-[801px]:px-8 min-[801px]:py-7 [&_h1]:m-0 [&_h1]:text-[clamp(26px,3vw,38px)] [&_h1]:leading-[1.2] [&_h1]:tracking-[-.6px] [&_p:last-child]:mb-0 [&_p:last-child]:text-[17px] [&_p:last-child]:text-(--color-welcome-text-muted)"
      aria-labelledby="dashboard-title"
    >
      <div>
        <p
          class="eyebrow text-xs font-bold tracking-[.08em] text-(--color-text-subtle)"
        >
          YOUR WORKOUT SPACE
        </p>
        <h1 id="dashboard-title">
          {{
            profile
              ? `Welcome back, ${profile.name.split(' ')[0]}.`
              : 'Your training, at a glance.'
          }}
        </h1>
        <p>One day at a time. Let’s make time for you.</p>
      </div>
      <div
        class="dashboard-date flex shrink-0 items-center gap-3 rounded-xl border border-(--color-welcome-date-border) bg-(--color-welcome-date-background) px-3.5 py-2.5 min-[801px]:grid min-[801px]:gap-2 min-[801px]:px-[22px] min-[801px]:py-[18px] [&_span]:text-xs [&_span]:tracking-[.08em] [&_span]:text-(--color-welcome-accent) [&_time]:text-sm [&_time]:font-semibold min-[601px]:[&_time]:text-[17px]"
      >
        <span>TODAY</span
        ><time :datetime="today">{{
          formatDate(today, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })
        }}</time>
      </div>
    </section>
    <section
      v-if="!signedOut"
      class="weekly-checkin my-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-(--color-today-background) p-5 min-[601px]:gap-5 min-[601px]:px-7 [&_h2]:mt-0 [&_h2]:mb-1 [&_h2]:text-lg [&_p]:my-1"
      aria-label="Your week"
    >
      <div>
        <h2>Your week</h2>
        <p aria-live="polite">
          <strong
            >{{ completedThisWeek }}
            {{ completedThisWeek === 1 ? 'workout' : 'workouts' }}
            completed</strong
          ><span v-if="profile">
            · Your goal is {{ profile.weeklyTarget }}</span
          >
        </p>
        <p class="hint text-[15px] leading-[1.6] text-(--color-text-muted)">
          {{ weekCount }}
          {{ weekCount === 1 ? 'workout planned' : 'workouts planned' }}
          this week · Monday – Sunday
        </p>
      </div>
      <div
        v-if="profile"
        class="weekly-checkin-progress min-w-0 basis-full min-[601px]:flex-[0_1_340px]"
      >
        <progress
          class="weekly-progress mb-2.5 block h-2.5 w-full overflow-hidden rounded border-0 bg-(--color-progress-track) accent-(--color-accent-strong) [&::-webkit-progress-bar]:rounded [&::-webkit-progress-bar]:bg-(--color-progress-track) [&::-webkit-progress-value]:rounded [&::-webkit-progress-value]:bg-(--color-accent-strong) [&::-moz-progress-bar]:rounded [&::-moz-progress-bar]:bg-(--color-accent-strong)"
          :value="Math.min(completedThisWeek, profile.weeklyTarget)"
          :max="profile.weeklyTarget"
          :aria-label="`${completedThisWeek} of ${profile.weeklyTarget} workouts completed this week`"
        ></progress
        ><span class="hint text-[15px] leading-[1.6] text-(--color-text-muted)"
          >Every workout counts. Go at your own pace.</span
        >
      </div>
    </section>
    <div
      class="dashboard-grid flex flex-col items-start gap-4 min-[801px]:grid min-[801px]:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)] min-[1051px]:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] min-[1051px]:gap-6"
    >
      <aside
        class="dashboard-sidebar grid w-full min-w-0 gap-5 min-[801px]:col-start-2 min-[801px]:row-start-1"
      >
        <WorkoutCalendar
          v-if="!signedOut"
          :today="today"
          :selected="selected"
          :schedules="schedules"
          :workouts="workouts"
          :disabled="busy || loading"
          @select="selected = $event"
          @action="calendarAction"
        />
      </aside>
      <div
        v-if="signedOut"
        class="dashboard-main grid w-full min-w-0 gap-5 min-[801px]:col-start-1 min-[801px]:row-start-1"
      >
        <section
          class="panel rounded-[18px] border border-(--color-border) bg-(--color-surface) p-5 shadow-none min-[601px]:p-[22px] min-[1051px]:p-7"
        >
          <h2>Choose your profile</h2>
          <p>
            Use the profile button in the top navigation to choose your name or
            create a profile.
          </p>
        </section>
      </div>
      <div
        v-else
        class="dashboard-main grid w-full min-w-0 gap-5 min-[801px]:col-start-1 min-[801px]:row-start-1"
      >
        <section
          class="panel rounded-[18px] border border-(--color-border) bg-(--color-surface) p-5 shadow-none min-[601px]:p-[22px] min-[1051px]:p-7 daily-workout"
          aria-labelledby="daily-heading"
        >
          <div
            class="dashboard-section-heading mb-5 flex flex-wrap items-center justify-between gap-3 [&_h2]:text-2xl [&_h2]:tracking-[-.5px] [&_.hint]:mb-0"
          >
            <div>
              <p
                class="eyebrow text-xs font-bold tracking-[.08em] text-(--color-text-subtle)"
              >
                {{ selected === today ? 'LET’S GET MOVING' : 'YOUR PLAN' }}
              </p>
              <h2 id="daily-heading">
                {{
                  selected === today ? "Today's workout" : 'Scheduled workout'
                }}
              </h2>
              <p
                class="hint text-[15px] leading-[1.6] text-(--color-text-muted)"
              >
                <time :datetime="selected">{{ formatDate(selected) }}</time>
              </p>
            </div>
            <span
              class="subtle-badge inline-block whitespace-nowrap rounded-full bg-(--color-tag-background) px-2.5 py-1.5 text-[13px] text-(--color-tag-text)"
              >{{
                completedWorkout
                  ? 'Completed'
                  : workout
                  ? 'Scheduled'
                  : 'Open day'
              }}</span
            >
          </div>
          <p
            v-if="loading && !workout"
            class="hint text-[15px] leading-[1.6] text-(--color-text-muted)"
            role="status"
          >
            Loading your schedule…
          </p>
          <div
            v-else-if="completedWorkout"
            class="rounded-2xl bg-(--color-success-background) p-6"
            role="status"
            aria-live="polite"
          >
            <span
              class="mb-3 grid size-12 place-items-center rounded-full bg-(--color-primary) text-2xl text-(--color-on-primary)"
              aria-hidden="true"
              >✓</span
            >
            <h3 class="mt-0 mb-2 text-2xl">Workout logged successfully!</h3>
            <p class="my-2">
              <strong>{{ completedWorkout.name }}</strong> is saved to your
              workout history.
            </p>
            <p class="mb-0 text-(--color-text-muted)">
              All done for this session. Great work!
            </p>
          </div>
          <template v-else-if="workout">
            <div
              class="workout-feature my-6 flex items-start justify-between gap-3 min-[601px]:items-center min-[601px]:gap-5 max-[380px]:flex-wrap [&>div:first-child]:min-w-0 [&_h3]:mt-2 [&_h3]:mb-4 [&_h3]:text-2xl [&_h3]:tracking-[-1px] [&_h3]:wrap-anywhere min-[601px]:[&_h3]:text-[clamp(25px,3vw,34px)]"
            >
              <div>
                <p
                  class="eyebrow text-xs font-bold tracking-[.08em] text-(--color-text-subtle)"
                >
                  YOUR SESSION
                </p>
                <h3>{{ workout.name }}</h3>
              </div>
              <div
                class="duration-badge grid min-w-[94px] shrink-0 justify-items-center gap-1.5 rounded-[14px] bg-(--color-tag-background) px-2.5 py-3.5 min-[601px]:min-w-[125px] min-[601px]:p-[18px] [&_svg]:size-[23px] [&_svg]:text-(--color-duration-icon) [&_strong]:text-[25px] [&_strong]:tracking-[-1px] min-[601px]:[&_strong]:text-[29px] [&_small]:inline [&_small]:text-[13px] [&_small]:font-normal [&>span]:text-[13px] [&>span]:text-(--color-text-muted)"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" /></svg
                ><strong>{{ minutes }}<small> min</small></strong
                ><span>{{
                  schedule.durationMinutes == null
                    ? 'Estimated time'
                    : 'Planned time'
                }}</span>
              </div>
            </div>
            <div
              class="row-actions workout-primary-actions my-6 gap-3 max-[600px]:flex-col max-[600px]:items-stretch [&_.primary]:min-h-[52px] [&_.primary]:flex-1 [&_.primary]:font-bold flex flex-wrap"
            >
              <button
                class="primary border-(--color-primary) bg-(--color-primary) text-(--color-on-primary) font-bold shadow-(--neon-glow)"
                :disabled="busy || loading || !!session"
                @click="startWorkout"
              >
                {{ session ? 'Workout in progress' : 'Start workout' }}</button
              ><button :disabled="busy || loading" @click="plan()">
                Change schedule
              </button>
            </div>
            <section aria-label="Workout details">
              <div
                class="session-summary my-5 grid grid-cols-1 gap-4 border-y border-(--color-border-divider) py-5 min-[601px]:grid-cols-3 min-[601px]:gap-0 [&>div]:grid [&>div]:min-w-0 [&>div]:content-start [&>div]:gap-1.5 min-[601px]:[&>div]:border-l min-[601px]:[&>div]:border-(--color-border-divider) min-[601px]:[&>div]:pl-5 [&>div:first-child]:border-l-0 [&>div:first-child]:pl-0 [&_strong]:text-2xl [&_span]:text-sm [&_span]:text-(--color-text-muted)"
              >
                <div>
                  <strong>{{ workout.exercises.length }}</strong
                  ><span>Exercises</span>
                </div>
                <div
                  class="primary-muscles-summary [&_.tags]:mt-1 [&_.tags_span]:max-w-full [&_.tags_span]:wrap-anywhere [&_.hint]:mt-1 [&_.hint]:mb-0"
                >
                  <strong>{{ primaryMuscles.length }}</strong
                  ><span>Primary muscles worked</span>
                  <div
                    v-if="primaryMuscles.length"
                    class="tags flex flex-wrap gap-1.5 [&_span]:rounded-[5px] [&_span]:bg-(--color-tag-background) [&_span]:px-[9px] [&_span]:py-[5px] [&_span]:text-(--color-tag-text)"
                  >
                    <span v-for="muscle in primaryMuscles" :key="muscle">{{
                      muscle
                    }}</span>
                  </div>
                  <p
                    v-else
                    class="hint text-[15px] leading-[1.6] text-(--color-text-muted)"
                  >
                    Primary muscles haven’t been added to these exercises yet.
                  </p>
                </div>
                <div>
                  <strong
                    class="intensity-value text-[clamp(16px,2vw,22px)]! wrap-anywhere"
                    >{{ schedule.intensity || 'Not set' }}</strong
                  ><span>Overall intensity · planned</span>
                </div>
              </div>
              <p
                v-if="!schedule.intensity"
                class="hint text-[15px] leading-[1.6] text-(--color-text-muted)"
              >
                Set your planned intensity using Change schedule.
              </p>
              <p
                class="hint text-[15px] leading-[1.6] text-(--color-text-muted) duration-note mb-[18px] max-w-[540px]"
              >
                {{
                  schedule.durationMinutes == null
                    ? 'Estimate includes 5 minutes to warm up, about 6 minutes per exercise for sets and rest, and 5 minutes to cool down. Adjust the planned time to suit your routine.'
                    : 'Duration set by you for this session.'
                }}
              </p>
              <div class="row-actions flex flex-wrap gap-2">
                <button
                  :disabled="busy || loading"
                  @click="emit('editWorkout', workout)"
                >
                  Edit workout</button
                ><button
                  class="delete text-(--color-danger)"
                  :disabled="busy || loading"
                  @click="
                    scope = schedule?.seriesId ? 'future' : 'single';
                    confirming = true;
                    planning = false;
                  "
                >
                  Remove schedule
                </button>
              </div>
            </section>
            <details
              class="daily-exercises mt-6 border-t border-(--color-border-subtle) pt-2"
              aria-labelledby="exercises-heading"
            >
              <summary id="exercises-heading">
                Your exercises
                <span
                  class="hint text-[15px] leading-[1.6] text-(--color-text-muted)"
                  >({{ workout.exercises.length }})</span
                >
              </summary>
              <ol
                class="daily-exercise-list m-0 list-decimal pl-[26px] [&_li]:border-b [&_li]:border-(--color-border-subtle) [&_li]:py-3 [&_li]:pl-1.5 [&_li:last-child]:border-b-0 [&_li::marker]:text-(--color-text-muted) [&_strong]:text-base [&_strong]:font-semibold [&_strong]:wrap-anywhere [&_p]:mt-[3px] [&_p]:mb-0 [&_p]:text-sm [&_p]:text-(--color-text-muted) [&_p]:wrap-anywhere"
              >
                <li v-for="(exercise, index) in workout.exercises" :key="index">
                  <div>
                    <strong>{{ exercise.name }}</strong>
                    <p>
                      {{ equipmentType(exercise)
                      }}<span v-if="exercise.attachment">
                        ·
                        {{ exercise.attachment }}</span
                      >
                    </p>
                  </div>
                </li>
              </ol>
            </details>
            <div
              v-if="confirming"
              class="schedule-confirm mt-4 rounded-lg bg-(--color-confirmation-background) p-4 text-[13px]"
            >
              <p>
                Remove {{ workout.name }} from
                {{
                  formatDate(selected, {
                    month: 'short',
                    day: 'numeric',
                  })
                }}?
              </p>
              <p
                class="hint text-[15px] leading-[1.6] text-(--color-text-muted)"
              >
                {{
                  schedule.profileRepeat
                    ? 'This stops your repeating schedule. Completed workouts stay saved.'
                    : 'The workout stays in your library.'
                }}
              </p>
              <label v-if="schedule.seriesId"
                >Remove<select v-model="scope">
                  <option value="single">This session only</option>
                  <option value="future">This and following sessions</option>
                </select></label
              >
              <div class="row-actions flex flex-wrap gap-2">
                <button
                  class="delete text-(--color-danger)"
                  :disabled="busy"
                  @click="
                    emit('removeSchedule', {
                      date: selected,
                      scope,
                      profileRepeat: !!schedule.profileRepeat,
                    })
                  "
                >
                  {{ busy ? 'Removing…' : 'Confirm removal' }}</button
                ><button :disabled="busy" @click="confirming = false">
                  Cancel
                </button>
              </div>
            </div>
          </template>
          <div
            v-else-if="!loading"
            class="schedule-empty max-w-[480px] px-2.5 pt-[22px] pb-[26px] [&_h3]:mt-5 [&_h3]:mb-2.5 [&_h3]:text-[25px] [&_h3]:tracking-[-.6px] [&_.hint]:mb-5 [&_.hint]:text-base"
          >
            <div
              class="rest-day-symbol grid size-[50px] place-items-center rounded-[14px] bg-(--color-rest-day-background) text-[28px] text-(--color-accent-strong)"
              aria-hidden="true"
            >
              ☀
            </div>
            <h3>Your day, your pace.</h3>
            <p class="hint text-[15px] leading-[1.6] text-(--color-text-muted)">
              You don’t have a workout planned for
              {{ selected === today ? 'today' : 'this date' }}. Plan a workout,
              or enjoy a rest day.
            </p>
            <button
              v-if="workouts.length"
              class="primary border-(--color-primary) bg-(--color-primary) text-(--color-on-primary) font-bold shadow-(--neon-glow)"
              :disabled="busy"
              @click="plan()"
            >
              Plan a workout</button
            ><button
              v-else
              :disabled="busy"
              class="primary border-(--color-primary) bg-(--color-primary) text-(--color-on-primary) font-bold shadow-(--neon-glow)"
              @click="emit('browseWorkouts')"
            >
              Build your first workout →
            </button>
          </div>
          <form
            v-if="planning"
            class="schedule-form mt-[22px] border-t border-(--color-border-divider) pt-5 [&_h3]:mt-0 [&_h3]:mb-4 [&_h3]:text-[17px] [&_label]:mb-3.5 [&_label]:block [&_fieldset]:m-0 [&_fieldset]:min-w-0 [&_fieldset]:border-0 [&_fieldset]:p-0"
            @submit.prevent="saveSchedule"
          >
            <h3>
              {{ schedule ? 'Update your session' : 'Plan a session' }}
            </h3>
            <fieldset :disabled="busy || loading">
              <label
                >Start date<input v-model="planDate" type="date" required
              /></label>
              <label
                >Workout<select v-model="workoutChoice" required>
                  <option value="" disabled>Choose a saved workout</option>
                  <option
                    v-for="item in sortedWorkouts"
                    :key="item.id"
                    :value="item.id"
                  >
                    {{ item.name }} · {{ item.exercises.length }} exercises
                  </option>
                </select></label
              >
              <button
                type="button"
                class="small-button px-2.5 py-[7px]"
                :disabled="busy || loading"
                @click="
                  creatingWorkout = true;
                  emit('createWorkout');
                "
              >
                + Create a new workout
              </button>
              <label
                >Planned duration in minutes (optional)<input
                  v-model="duration"
                  type="number"
                  min="5"
                  max="300"
                  step="1"
                  :placeholder="
                    chosenWorkout
                      ? `${estimatedMinutes(chosenWorkout)} min estimated`
                      : 'Use automatic estimate'
                  "
              /></label>
              <label v-if="schedule?.seriesId"
                >Apply changes to<select v-model="scope">
                  <option value="single">This session only</option>
                  <option value="future">This and following sessions</option>
                </select></label
              >
              <label
                >Repeat<select v-model="frequency">
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Monthly</option>
                </select></label
              >
              <label v-if="frequency !== 'none'"
                >End date (optional)<input
                  v-model="until"
                  type="date"
                  :min="planDate"
              /></label>
              <p
                v-if="frequency !== 'none'"
                class="hint text-[15px] leading-[1.6] text-(--color-text-muted)"
              >
                Saved to your profile. This replaces your current repeat
                schedule. Leave the end date blank to keep repeating. Monthly
                workouts use the last day of shorter months. Workouts already
                planned for a date take priority.
              </p>
              <label
                >Overall intensity (planned)<select v-model="intensity">
                  <option value="">Not set</option>
                  <option>Low</option>
                  <option>Moderate</option>
                  <option>High</option>
                </select></label
              >
              <p
                class="hint text-[15px] leading-[1.6] text-(--color-text-muted)"
              >
                Choose the effort you intend for this session. Intensity depends
                on your weights, reps, and rest periods.
              </p>
              <p
                class="hint text-[15px] leading-[1.6] text-(--color-text-muted)"
              >
                Leave duration blank to use the automatic estimate. One workout
                can be scheduled per day.
              </p>
              <div class="row-actions flex flex-wrap gap-2">
                <button
                  class="primary border-(--color-primary) bg-(--color-primary) text-(--color-on-primary) font-bold shadow-(--neon-glow)"
                  :disabled="!workoutChoice"
                >
                  {{ busy ? 'Saving…' : 'Save schedule' }}</button
                ><button type="button" @click="planning = false">Cancel</button>
              </div>
            </fieldset>
          </form>
        </section>
        <section
          v-if="session"
          class="panel rounded-[18px] border border-(--color-border) bg-(--color-surface) p-5 shadow-none min-[601px]:p-[22px] min-[1051px]:p-7"
          aria-labelledby="session-heading"
        >
          <h2 id="session-heading">Performing {{ session.name }}</h2>
          <p class="hint text-[15px] leading-[1.6] text-(--color-text-muted)">
            {{ formatDate(session.scheduledDate) }} · Choose the equipment and
            attachments you use for this session.
          </p>
          <form @submit.prevent="finishWorkout">
            <fieldset :disabled="busy || loading">
              <div
                v-for="(exercise, index) in session.exercises"
                :key="index"
                class="schedule-form mt-[22px] border-t border-(--color-border-divider) pt-5 [&_h3]:mt-0 [&_h3]:mb-4 [&_h3]:text-[17px] [&_label]:mb-3.5 [&_label]:block [&_fieldset]:m-0 [&_fieldset]:min-w-0 [&_fieldset]:border-0 [&_fieldset]:p-0"
              >
                <h3>{{ index + 1 }}. {{ exercise.name }}</h3>
                <label
                  >Equipment<select
                    :value="exercise.equipmentOptionKey"
                    @change="changeEquipment(index, $event.target.value)"
                  >
                    <option
                      v-for="option in options(exercise)"
                      :key="option.equipmentOptionKey"
                      :value="option.equipmentOptionKey"
                    >
                      {{ equipmentType(option) }}
                    </option>
                  </select></label
                >
                <label
                  >Attachment<select v-model="exercise.attachment">
                    <option :value="null">No attachment</option>
                    <option
                      v-for="item in attachments(exercise)"
                      :key="item.id"
                      :value="item.name"
                    >
                      {{ item.name }}
                    </option>
                  </select></label
                >
              </div>
              <div class="row-actions flex flex-wrap gap-2">
                <button
                  class="primary border-(--color-primary) bg-(--color-primary) text-(--color-on-primary) font-bold shadow-(--neon-glow)"
                >
                  {{ busy ? 'Saving…' : 'Finish & log workout' }}</button
                ><button type="button" @click="session = null">
                  Cancel session
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      </div>
    </div>
  </div>
</template>

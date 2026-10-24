<script setup>
import { computed, nextTick, onActivated, onMounted, onUnmounted, ref, watch } from 'vue';
import ProfileCard from '../components/ProfileCard.vue';
import WorkoutCalendar from '../components/WorkoutCalendar.vue';
import { equipmentType } from '../utils/equipment.js';
import { estimatedMinutes, formatDate, localDate, weekBounds, primaryMusclesFor } from '../utils/dashboard.js';
const props = defineProps({ profile: Object, profiles: { type: Array, default: () => [] }, profileId: String, signedOut: Boolean, workouts: Array, schedules: Array, logs: { type: Array, default: () => [] }, catalog: Object, busy: Boolean, loading: Boolean });
const emit = defineEmits(['saveProfile', 'deleteProfile', 'chooseProfile', 'saveSchedule', 'removeSchedule', 'browseWorkouts', 'createWorkout', 'editWorkout', 'completeWorkout', 'deleteLog']);
const today = ref(localDate());
const selected = ref(today.value);
const planning = ref(false);
const confirming = ref(false);
const workoutChoice = ref('');
const creatingWorkout = ref(false);
watch(() => props.workouts, (workouts, previous) => {
  if (!creatingWorkout.value) return;
  const added = workouts.find(item => !previous.some(old => old.id === item.id));
  if (added) {
    workoutChoice.value = added.id;
    planning.value = true;
    creatingWorkout.value = false;
  }
});
const duration = ref('');
const intensity = ref('');
const frequency = ref('none');
const until = ref('');
const scope = ref('single');
const session = ref(null);
const deletingLog = ref(null);
watch(() => props.logs, (logs, previous) => {
  if (logs.length > previous.length) session.value = null;
  deletingLog.value = null;
});
function startWorkout() {
  session.value = { workoutId: workout.value.id, scheduledDate: selected.value, name: workout.value.name, exercises: workout.value.exercises.map(item => ({ ...item })) };
}
function options(exercise) { return props.catalog.exercises.filter(item => item.exerciseId === exercise.exerciseId); }
function attachments(exercise) {
  const allowed = props.catalog.equipment.find(item => String(item.id) === String(exercise.equipmentId))?.attachmentIds || [];
  return props.catalog.attachments.filter(item => allowed.some(id => String(id) === String(item.id)));
}
function changeEquipment(index, key) {
  const exercise = options(session.value.exercises[index]).find(item => item.equipmentOptionKey === key);
  if (exercise) session.value.exercises[index] = { ...exercise, attachment: exercise.attachment ?? null };
}
function finishWorkout() {
  emit('completeWorkout', { workoutId: session.value.workoutId, scheduledDate: session.value.scheduledDate, selections: session.value.exercises.map(item => ({ exerciseId: item.exerciseId, equipmentOptionKey: item.equipmentOptionKey, attachment: item.attachment ?? null })) });
}
let timer;
function updateDate() {
  const date = localDate();
  if (date !== today.value && selected.value === today.value) selected.value = date;
  today.value = date;
}
onMounted(() => { timer = setInterval(updateDate, 30000); });
onActivated(updateDate);
onUnmounted(() => clearInterval(timer));
const schedule = computed(() => props.schedules.find(item => item.date === selected.value));
const workout = computed(() => props.workouts.find(item => item.id === schedule.value?.workoutId));
const chosenWorkout = computed(() => props.workouts.find(item => item.id === workoutChoice.value));
const minutes = computed(() => schedule.value?.durationMinutes ?? estimatedMinutes(workout.value));
const equipment = computed(() => [...new Set((workout.value?.exercises || []).map(equipmentType))]);
const primaryMuscles = computed(() => primaryMusclesFor(workout.value));
const weekCount = computed(() => {
  const { start, end } = weekBounds(today.value);
  return props.schedules.filter(item => item.date >= start && item.date <= end).length;
});

const completedThisWeek = computed(() => {
  const { start, end } = weekBounds(today.value);
  return props.logs.filter(log => {
    if (typeof log.completedAt !== 'string') return false;
    const date = log.completedAt.length === 10 ? log.completedAt : localDate(new Date(log.completedAt));
    return date >= start && date <= end;
  }).length;
});

const sortedWorkouts = computed(() => [...props.workouts].sort((a, b) => a.name.localeCompare(b.name)));
watch([selected, () => props.schedules], () => { planning.value = false; confirming.value = false; });
function plan() { scope.value = schedule.value?.seriesId ? 'future' : 'single'; frequency.value = schedule.value?.frequency || 'none'; until.value = schedule.value?.until || selected.value.slice(0, 4) + '-12-31'; workoutChoice.value = schedule.value?.workoutId || ''; duration.value = schedule.value?.durationMinutes ?? ''; intensity.value = schedule.value?.intensity || ''; planning.value = true; confirming.value = false; }
function saveSchedule() { emit('saveSchedule', { date: selected.value, workoutId: workoutChoice.value, durationMinutes: duration.value === '' ? null : Number(duration.value), intensity: intensity.value || null, scope: scope.value, frequency: scope.value === 'single' && schedule.value?.seriesId ? 'none' : frequency.value, until: frequency.value === 'none' ? null : until.value }); }
async function calendarAction({ date, action }) {
  selected.value = date;
  await nextTick();
  if (action === 'create' || action === 'schedule' || action === 'frequency') plan();
  if (action === 'edit' && workout.value) emit('editWorkout', workout.value);
  if (action === 'start' && workout.value && !session.value) startWorkout();
  if (action === 'delete') { scope.value = 'single'; confirming.value = true; planning.value = false; }
  await nextTick();
  document.getElementById('daily-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>
<template>
  <div class="dashboard">
    <section class="dashboard-welcome" aria-labelledby="dashboard-title">
      <div><p class="eyebrow">A LITTLE STRUCTURE. A STRONGER YOU.</p><h1 id="dashboard-title">{{ profile ? `Welcome back, ${profile.name.split(' ')[0]}.` : 'Your training, at a glance.' }}</h1><p>Your next session, your goals, and a little space to plan.</p></div>
      <div class="dashboard-date"><span>TODAY</span><time :datetime="today">{{ formatDate(today, { weekday: 'long', month: 'short', day: 'numeric' }) }}</time></div>
    </section>
    <div class="dashboard-stats" aria-label="Training overview">
      <div><span class="eyebrow">PLANNED THIS WEEK</span><strong>{{ weekCount }} <small v-if="profile">/ {{ profile.weeklyTarget }} target</small></strong><p>Monday – Sunday · scheduled sessions</p></div>
      <div aria-label="Weekly progress"><span class="eyebrow">WEEKLY PROGRESS</span><strong aria-live="polite">{{ completedThisWeek }} <small>{{ completedThisWeek === 1 ? 'workout completed' : 'workouts completed' }}</small></strong><p>Monday – Sunday<span v-if="profile"> · {{ completedThisWeek }} / {{ profile.weeklyTarget }} weekly target</span></p><progress v-if="profile" class="weekly-progress" :value="Math.min(completedThisWeek, profile.weeklyTarget)" :max="profile.weeklyTarget" :aria-label="`${completedThisWeek} of ${profile.weeklyTarget} workouts completed this week`"></progress></div>
      <div><span class="eyebrow">YOUR FOCUS</span><strong class="stat-goal">{{ profile?.goal || 'Set your goal' }}</strong><p>{{ profile ? `${profile.experience} · ${profile.activityLevel}` : 'Create your profile to get started' }}</p></div>
    </div>
    <div class="dashboard-grid">
      <aside class="dashboard-sidebar">
        <ProfileCard :profile="profile" :profiles="profiles" :profile-id="profileId" :today="today" :busy="busy" :loading="loading" @save="emit('saveProfile', $event)" @delete="emit('deleteProfile')" @choose="emit('chooseProfile', $event)" />
        <WorkoutCalendar v-if="!signedOut" :today="today" :selected="selected" :schedules="schedules" :workouts="workouts" :disabled="busy" @select="selected = $event" @action="calendarAction" />
      </aside>
      <div v-if="signedOut" class="dashboard-main"><section class="panel"><h2>Choose your profile</h2><p>Open Profile settings in the client profile card to choose a user, or create a new profile.</p></section></div>
      <div v-else class="dashboard-main">
        <section class="panel daily-workout" aria-labelledby="daily-heading">
          <div class="dashboard-section-heading"><div><p class="eyebrow">{{ selected === today ? 'ON YOUR AGENDA' : 'PLAN YOUR DAY' }}</p><h2 id="daily-heading">{{ selected === today ? "Today's workout" : 'Scheduled workout' }}</h2><p class="hint"><time :datetime="selected">{{ formatDate(selected) }}</time></p></div><span class="subtle-badge">{{ workout ? 'Scheduled' : 'Open day' }}</span></div>
          <p v-if="loading && !workout" class="hint" role="status">Loading your schedule…</p>
          <template v-else-if="workout">
            <div class="workout-feature"><div><p class="eyebrow">YOUR SESSION</p><h3>{{ workout.name }}</h3></div><div class="duration-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><strong>{{ minutes }}<small> min</small></strong><span>{{ schedule.durationMinutes == null ? 'Estimated time' : 'Planned time' }}</span></div></div>
            <div class="session-summary"><div><strong>{{ workout.exercises.length }}</strong><span>Exercises</span></div><div class="primary-muscles-summary"><strong>{{ primaryMuscles.length }}</strong><span>Primary muscles worked</span><div v-if="primaryMuscles.length" class="tags"><span v-for="muscle in primaryMuscles" :key="muscle">{{ muscle }}</span></div><p v-else class="hint">Primary muscles haven’t been added to these exercises yet.</p></div><div><strong class="intensity-value">{{ schedule.intensity || 'Not set' }}</strong><span>Overall intensity · planned</span></div></div>
            <p v-if="!schedule.intensity" class="hint">Set your planned intensity using Edit schedule.</p>
            <p class="hint duration-note">{{ schedule.durationMinutes == null ? 'Estimate includes 5 minutes to warm up, about 6 minutes per exercise for sets and rest, and 5 minutes to cool down. Adjust the planned time to suit your routine.' : 'Duration set by you for this session.' }}</p>
            <div class="row-actions"><button class="primary" :disabled="busy || loading || !!session" @click="startWorkout">Start workout</button><button :disabled="busy || loading" @click="plan">Edit schedule</button><button :disabled="busy || loading" @click="emit('editWorkout', workout)">Edit workout</button><button class="delete" :disabled="busy || loading" @click="scope = 'single'; confirming = true; planning = false">Remove from calendar</button></div>
            <div v-if="confirming" class="schedule-confirm"><p>Remove {{ workout.name }} from {{ formatDate(selected, { month: 'short', day: 'numeric' }) }}?</p><p class="hint">The workout stays in your library.</p><label v-if="schedule.seriesId">Remove<select v-model="scope"><option value="single">This session only</option><option value="future">This and following sessions</option></select></label><div class="row-actions"><button class="delete" :disabled="busy" @click="emit('removeSchedule', { date: selected, scope })">{{ busy ? 'Removing…' : 'Confirm removal' }}</button><button :disabled="busy" @click="confirming = false">Cancel</button></div></div>
          </template>
          <div v-else-if="!loading" class="schedule-empty"><div class="rest-day-symbol" aria-hidden="true">☀</div><h3>A little room in your day.</h3><p class="hint">No workout is scheduled for {{ selected === today ? 'today' : 'this date' }}. Choose a saved routine when you’re ready to plan a session.</p><button v-if="workouts.length" class="primary" :disabled="busy" @click="plan">+ Schedule a workout</button><button v-else :disabled="busy" class="primary" @click="emit('browseWorkouts')">Build your first workout →</button></div>
          <form v-if="planning" class="schedule-form" @submit.prevent="saveSchedule"><h3>{{ schedule ? 'Update your session' : 'Plan a session' }}</h3><fieldset :disabled="busy || loading">
            <label>Workout<select v-model="workoutChoice" required><option value="" disabled>Choose a saved workout</option><option v-for="item in sortedWorkouts" :key="item.id" :value="item.id">{{ item.name }} · {{ item.exercises.length }} exercises</option></select></label>
            <button type="button" class="small-button" :disabled="busy || loading" @click="creatingWorkout = true; emit('createWorkout')">+ Create a new workout</button>
            <label>Planned duration in minutes (optional)<input v-model="duration" type="number" min="5" max="300" step="1" :placeholder="chosenWorkout ? `${estimatedMinutes(chosenWorkout)} min estimated` : 'Use automatic estimate'"></label>
            <label v-if="schedule?.seriesId">Apply changes to<select v-model="scope"><option value="single">This session only</option><option value="future">This and following sessions</option></select></label>
            <label v-if="!schedule?.seriesId || scope === 'future'">Repeat<select v-model="frequency"><option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="biweekly">Every two weeks</option><option value="monthly">Every month</option></select></label>
            <label v-if="frequency !== 'none' && (!schedule?.seriesId || scope === 'future')">Repeat until<input v-model="until" type="date" :min="selected" required></label>
            <p v-if="frequency !== 'none' && (!schedule?.seriesId || scope === 'future')" class="hint">Choose an end date within one year. Updating a series replaces its following sessions. Other scheduled workouts will not be overwritten. Monthly repeats use the last day when needed.</p>
            <label>Overall intensity (planned)<select v-model="intensity"><option value="">Not set</option><option>Low</option><option>Moderate</option><option>High</option></select></label>
            <p class="hint">Choose the effort you intend for this session. Intensity depends on your weights, reps, and rest periods.</p>
            <p class="hint">Leave duration blank to use the automatic estimate. One workout can be scheduled per day.</p><div class="row-actions"><button class="primary" :disabled="!workoutChoice">{{ busy ? 'Saving…' : 'Save schedule' }}</button><button type="button" @click="planning = false">Cancel</button></div>
          </fieldset></form>
        </section>
        <section v-if="session" class="panel" aria-labelledby="session-heading">
          <h2 id="session-heading">Performing {{ session.name }}</h2><p class="hint">{{ formatDate(session.scheduledDate) }} · Choose the equipment and attachments you use for this session.</p>
          <form @submit.prevent="finishWorkout"><fieldset :disabled="busy || loading">
            <div v-for="(exercise, index) in session.exercises" :key="index" class="schedule-form">
              <h3>{{ index + 1 }}. {{ exercise.name }}</h3>
              <label>Equipment<select :value="exercise.equipmentOptionKey" @change="changeEquipment(index, $event.target.value)"><option v-for="option in options(exercise)" :key="option.equipmentOptionKey" :value="option.equipmentOptionKey">{{ equipmentType(option) }}</option></select></label>
              <label>Attachment<select v-model="exercise.attachment"><option :value="null">No attachment</option><option v-for="item in attachments(exercise)" :key="item.id" :value="item.name">{{ item.name }}</option></select></label>
            </div>
            <div class="row-actions"><button class="primary">{{ busy ? 'Saving…' : 'Finish & log workout' }}</button><button type="button" @click="session = null">Cancel session</button></div>
          </fieldset></form>
        </section>
        <section v-if="workout" class="panel workout-overview" aria-labelledby="overview-heading">
          <div class="dashboard-section-heading"><div><p class="eyebrow">THE SESSION PLAN</p><h2 id="overview-heading">Workout overview</h2></div><span class="hint">In your saved order</span></div>
          <div class="equipment-summary"><span class="hint">Equipment you’ll need</span><div class="tags"><span v-for="type in equipment" :key="type">{{ type }}</span></div></div>
          <ol class="overview-exercises"><li v-for="(exercise, index) in workout.exercises" :key="index"><span class="exercise-order" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span><div><strong>{{ exercise.name }}</strong><p>{{ equipmentType(exercise) }}<span v-if="exercise.attachment"> · {{ exercise.attachment }}</span></p><small v-if="exercise.primaryMuscles?.length">Primary: {{ exercise.primaryMuscles.join(', ') }}</small></div><span v-if="exercise.isIsolation" class="subtle-badge">Isolation</span></li></ol>
        </section>
        <section class="panel upcoming-workouts" aria-labelledby="history-heading">
          <div class="dashboard-section-heading"><div><p class="eyebrow">YOUR TRAINING RECORD</p><h2 id="history-heading">Workout log</h2></div></div>
          <p v-if="!logs.length" class="hint">Your completed workouts will appear here. Start a scheduled workout and finish it to save a log.</p>
          <details v-for="item in logs" :key="item.id" class="schedule-form">
            <summary><strong>{{ item.name }}</strong> · {{ item.completedAt.length === 10 ? formatDate(item.completedAt) : new Date(item.completedAt).toLocaleString() }} · {{ item.exercises.length }} exercises</summary>
            <p class="hint">Scheduled for {{ formatDate(item.scheduledDate) }}</p>
            <ol class="overview-exercises"><li v-for="(exercise, index) in item.exercises" :key="index"><div><strong>{{ exercise.name }}</strong><p>{{ equipmentType(exercise) }} · {{ exercise.attachment || 'No attachment' }}</p></div></li></ol>
            <div v-if="deletingLog === item.id" class="schedule-confirm"><p>Delete this logged workout?</p><div class="row-actions"><button class="delete" :disabled="busy || loading" @click="emit('deleteLog', item.id)">{{ busy ? 'Deleting…' : 'Confirm delete' }}</button><button :disabled="busy" @click="deletingLog = null">Cancel</button></div></div>
            <button v-else class="delete" :disabled="busy || loading" @click="deletingLog = item.id">Delete logged workout</button>
          </details>
        </section>
      </div>
    </div>
  </div>
</template>

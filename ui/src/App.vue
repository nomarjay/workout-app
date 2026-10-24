<script setup>
import { computed, onMounted, ref } from 'vue';
import ExerciseView from './views/ExerciseView.vue';
import EquipmentView from './views/EquipmentView.vue';
import MuscleGroupView from './views/MuscleGroupView.vue';
import WorkoutView from './views/WorkoutView.vue';
import DashboardView from './views/DashboardView.vue';
import { compareEquipment } from './utils/equipment.js';
const catalog = ref({ groups: [], equipment: [], attachments: [], exercises: [], exerciseDefinitions: [] });
const workouts = ref([]);
const profile = ref(null);
const profiles = ref([]);
const profileId = ref(typeof window === 'undefined' ? 'primary' : window.localStorage.getItem('form-profile-id') ?? 'primary');
const schedules = ref([]);
const logs = ref([]);
const dashboardBusy = ref(false);
const draft = ref([]);
const workoutName = ref('');
const editingId = ref('');
const trainerWorkout = ref(null);
let previousDraft = null;
let returnToPlanner = false;
const active = ref('dashboard');
const loading = ref(false);
const saving = ref(false);
const deleting = ref('');
const error = ref('');
const notice = ref('');
const tabs = [{ id: 'dashboard', name: 'Dashboard' }, { id: 'workouts', name: 'Workouts' }, { id: 'exercises', name: 'Exercises' }, { id: 'equipment', name: 'Equipment' }, { id: 'groups', name: 'Muscle groups' }];
const views = { dashboard: DashboardView, workouts: WorkoutView, exercises: ExerciseView, equipment: EquipmentView, groups: MuscleGroupView };
const activeProps = computed(() => active.value === 'dashboard'
  ? { profile: profile.value, profiles: profiles.value, profileId: profileId.value, signedOut: !profileId.value, workouts: workouts.value, schedules: schedules.value, logs: logs.value, catalog: catalog.value, busy: dashboardBusy.value, loading: loading.value }
  : active.value === 'workouts'
  ? { workouts: workouts.value, draft: draft.value, workoutName: workoutName.value, saving: saving.value, deleting: deleting.value, editingId: editingId.value, trainerWorkout: trainerWorkout.value }
  : active.value === 'exercises' ? { catalog: catalog.value, draft: draft.value, workoutName: workoutName.value, saving: saving.value } : { catalog: catalog.value, saving: saving.value });
const activeEvents = computed(() => active.value === 'dashboard'
  ? { saveProfile, deleteProfile, chooseProfile, saveSchedule, completeWorkout, deleteLog, removeSchedule, createWorkout: () => { if (editingId.value) cancelEdit(); returnToPlanner = true; trainerWorkout.value = null; active.value = 'exercises'; }, browseWorkouts: () => { active.value = 'workouts'; }, editWorkout: workout => { editWorkout(workout); active.value = 'workouts'; } }
  : active.value === 'workouts'
  ? { save, trainer: workout => { trainerWorkout.value = workout; }, finishTrainer: saved => { trainerWorkout.value = null; if (saved) notice.value = 'Trainer Mode saved.'; }, edit: editWorkout, cancel: cancelEdit, 'update:workoutName': value => { workoutName.value = value; }, remove: index => draft.value.splice(index, 1), move, delete: removeWorkout, arrange: () => { draft.value = [...draft.value].sort(compareEquipment); }, browse: () => { active.value = 'exercises'; } }
  : active.value === 'exercises' ? { catalogChanged, add, remove: index => draft.value.splice(index, 1), review: () => { active.value = 'workouts'; }, undo: () => { draft.value.pop(); } } : active.value === 'equipment' ? { catalogChanged } : {});
function catalogChanged(data, message) {
  catalog.value = data;
  const reconcile = selections => selections.flatMap(selection => {
    const exercise = data.exercises.find(item => item.exerciseId === selection.exerciseId && item.equipmentOptionKey === selection.equipmentOptionKey);
    if (!exercise) return [];
    const allowed = data.equipment.find(item => String(item.id) === String(exercise.equipmentId))?.attachmentIds || [];
    const attachment = selection.attachment == null || data.attachments.some(item => item.name === selection.attachment && allowed.some(id => String(id) === String(item.id))) ? selection.attachment : null;
    return [{ ...exercise, selectionId: selection.selectionId, attachment }];
  });
  const count = draft.value.length;
  draft.value = reconcile(draft.value);
  if (previousDraft) previousDraft.exercises = reconcile(previousDraft.exercises);
  workouts.value = workouts.value.map(workout => ({ ...workout, exercises: workout.exercises.map(exercise => {
    const machine = data.equipment.find(item => String(item.id) === String(exercise.equipmentId));
    return machine ? { ...exercise, equipment: machine['equipment-type'], 'equipment-type': machine['equipment-type'] } : exercise;
  }) }));
  error.value = '';
  notice.value = `${message}${draft.value.length < count ? ' Deleted options were removed from your current selection.' : ''}`;
}
async function request(url, options) {
  const response = await fetch(url, { ...options, headers: { ...options?.headers, 'X-Profile-Id': profileId.value || 'primary' } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not connect to the API. Please try again.');
  }
  return response.status === 204 ? null : response.json();
}
async function load() {
  if (loading.value || dashboardBusy.value) return;
  loading.value = true;
  error.value = '';
  try {
    const [data, saved, client, calendar, history, people] = await Promise.all([request('/api/catalog'), request('/api/workouts'), profileId.value ? request('/api/profile') : null, profileId.value ? request('/api/schedule') : [], profileId.value ? request('/api/workout-logs') : [], request('/api/profiles')]);
    catalogChanged(data, '');
    workouts.value = saved;
    profile.value = client;
    profiles.value = people;
    schedules.value = calendar;
    logs.value = history;
  } catch (cause) { error.value = cause.message; }
  finally { loading.value = false; }
}
async function changeDashboard(action, message) {
  if (dashboardBusy.value || loading.value) return;
  dashboardBusy.value = true;
  error.value = '';
  notice.value = '';
  try { await action(); notice.value = message; }
  catch (cause) { error.value = cause.message; }
  finally { dashboardBusy.value = false; }
}
function saveProfile(body) {
  return changeDashboard(async () => {
    profile.value = await request(profileId.value ? '/api/profile' : '/api/profiles', { method: profile.value ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    profileId.value = profile.value.id;
    localStorage.setItem('form-profile-id', profileId.value);
    profiles.value = await request('/api/profiles');
  }, 'Profile saved.');
}
function deleteProfile() {
  return changeDashboard(async () => { await request('/api/profile', { method: 'DELETE' }); profile.value = null; profileId.value = ''; localStorage.setItem('form-profile-id', ''); schedules.value = []; logs.value = []; profiles.value = await request('/api/profiles'); }, 'Profile deleted.');
}
function saveSchedule({ date, workoutId, durationMinutes, intensity, frequency, until, scope }) {
  if (!profileId.value) return;
  return changeDashboard(async () => {
    await request(`/api/schedule/${encodeURIComponent(date)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workoutId, durationMinutes, intensity, frequency, until, scope }) });
    schedules.value = await request('/api/schedule');
  }, 'Workout scheduled.');
}
function deleteLog(id) {
  return changeDashboard(async () => {
    await request(`/api/workout-logs/${encodeURIComponent(id)}`, { method: 'DELETE' });
    logs.value = logs.value.filter(item => item.id !== id);
  }, 'Logged workout deleted.');
}
function completeWorkout(body) {
  if (!profileId.value) return;
  return changeDashboard(async () => {
    const log = await request('/api/workout-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    logs.value = [log, ...logs.value];
  }, 'Workout completed and logged.');
}
function removeSchedule(value) {
  const { date, scope = 'single' } = typeof value === 'string' ? { date: value } : value;
  return changeDashboard(async () => { await request(`/api/schedule/${encodeURIComponent(date)}?scope=${scope}`, { method: 'DELETE' }); schedules.value = await request('/api/schedule'); }, 'Workout removed from the calendar.');
}
function add(exercise) {
  if (saving.value || draft.value.length >= 100) return;
  draft.value.push({ ...exercise, selectionId: crypto.randomUUID() });
  notice.value = `${exercise.name} added. Open Workouts to arrange and save your selection.`;
}
function move(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= draft.value.length) return;
  const [exercise] = draft.value.splice(index, 1);
  draft.value.splice(target, 0, exercise);
}
function editWorkout(workout) {
  if (saving.value || deleting.value) return;
  if (!editingId.value) previousDraft = { name: workoutName.value, exercises: draft.value };
  editingId.value = workout.id;
  workoutName.value = workout.name;
  draft.value = workout.exercises.map(exercise => ({ ...exercise, selectionId: crypto.randomUUID() }));
  error.value = '';
  notice.value = `Editing ${workout.name}.`;
}
function cancelEdit() {
  if (saving.value) return;
  editingId.value = '';
  workoutName.value = previousDraft?.name || '';
  draft.value = previousDraft?.exercises || [];
  previousDraft = null;
  error.value = '';
  notice.value = '';
}
async function save(name) {
  if (saving.value || deleting.value) return;
  saving.value = true;
  error.value = '';
  notice.value = '';
  try {
    const isEditing = Boolean(editingId.value);
    const workout = await request(isEditing ? `/api/workouts/${editingId.value}` : '/api/workouts', { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, selections: draft.value.map(e => ({ exerciseId: e.exerciseId || e.id, equipmentOptionKey: e.equipmentOptionKey, attachment: e.attachment ?? null })) }) });
    if (isEditing) workouts.value = workouts.value.map(item => item.id === workout.id ? workout : item);
    else workouts.value.unshift(workout);
    draft.value = [];
    workoutName.value = '';
    if (isEditing) {
      editingId.value = '';
      workoutName.value = previousDraft?.name || '';
      draft.value = previousDraft?.exercises || [];
      previousDraft = null;
    }
    notice.value = `${isEditing ? 'Updated' : 'Saved'} ${workout.name}.`;
    if (returnToPlanner && !isEditing) {
      returnToPlanner = false;
      trainerWorkout.value = null;
      active.value = 'dashboard';
    } else trainerWorkout.value = workout;

  } catch (cause) { error.value = cause.message; }
  finally { saving.value = false; }
}
async function removeWorkout(id) {
  if (saving.value || deleting.value || editingId.value === id) return;
  deleting.value = id;
  error.value = '';
  try {
    await request(`/api/workouts/${id}`, { method: 'DELETE' });
    workouts.value = workouts.value.filter(w => w.id !== id);
    schedules.value = schedules.value.filter(item => item.workoutId !== id);
    notice.value = 'Workout deleted.';
  } catch (cause) { error.value = cause.message; }
  finally { deleting.value = ''; }
}
async function chooseProfile(id) {
  if (loading.value || dashboardBusy.value || saving.value || deleting.value) return;
  returnToPlanner = false;
  profileId.value = id;
  localStorage.setItem('form-profile-id', id);
  profile.value = null;
  schedules.value = [];
  logs.value = [];
  trainerWorkout.value = null;
  draft.value = [];
  editingId.value = '';
  workoutName.value = '';
  previousDraft = null;
  active.value = 'dashboard';
  await load();
}
onMounted(load);
</script>
<template>
  <div class="shell">
    <header class="topbar"><a class="brand" href="#" @click.prevent="active = 'dashboard'" aria-label="Form dashboard home">form<span>●</span></a><div class="topbar-actions"><button v-if="active === 'dashboard'" @click="load" :disabled="loading || dashboardBusy">{{ loading ? 'Loading…' : 'Refresh data' }}</button></div></header>
    <main><section v-if="active !== 'dashboard'" class="intro"><div><p class="eyebrow">PLAN WITH PURPOSE</p><h1>Your next workout starts here.</h1><p>Explore your equipment, find your focus, and build a routine.</p></div><button @click="load" :disabled="loading || dashboardBusy">{{ loading ? 'Loading…' : 'Refresh data' }}</button></section>
      <nav class="tabs" aria-label="Data views"><button v-for="tab in tabs" :key="tab.id" :aria-pressed="active === tab.id" @click="active = tab.id">{{ tab.name }}<span v-if="tab.id === 'workouts' && draft.length"> ({{ draft.length }})</span></button></nav>
      <p v-if="error" class="message error" role="alert">{{ error }} <button @click="load" :disabled="loading || dashboardBusy">Reload data</button></p>
      <p v-if="notice" class="message success" role="status">{{ notice }}</p>
      <p v-if="loading" role="status">Loading your library…</p>
      <section class="active-view" :aria-label="tabs.find(tab => tab.id === active)?.name"><KeepAlive :key="profileId"><component :key="active" :is="views[active]" v-bind="activeProps" v-on="activeEvents" /></KeepAlive></section>
    </main><footer>Form · Build your training, one exercise at a time.</footer>
  </div>
</template>




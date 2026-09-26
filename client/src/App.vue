<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
const workouts = ref([]);
const groups = ref([]);
const loading = ref(true);
const saving = ref(false);
const deleting = ref(null);
const error = ref('');
const notice = ref('');
const filter = ref('');
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const defaults = () => ({ name: '', date: today(), durationMinutes: 45, notes: '', muscleGroupIds: [] });
const form = reactive(defaults());
const visible = computed(() => workouts.value.filter(w => !filter.value || w.muscleGroups.some(g => g.id === Number(filter.value))));
const totalMinutes = computed(() => workouts.value.reduce((sum, w) => sum + w.durationMinutes, 0));
const trainedGroups = computed(() => new Set(workouts.value.flatMap(w => w.muscleGroups.map(g => g.id))).size);
async function api(path, options) {
  const response = await fetch(`/api${path}`, options);
  if (response.status === 204) return;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
async function load() {
  error.value = '';
  loading.value = true;
  try { [groups.value, workouts.value] = await Promise.all([api('/muscle-groups'), api('/workouts')]); }
  catch (e) { error.value = e.message; }
  finally { loading.value = false; }
}
async function save() {
  error.value = ''; notice.value = ''; saving.value = true;
  try {
    await api('/workouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    Object.assign(form, defaults());
    notice.value = 'Workout saved.';
    workouts.value = await api('/workouts');
  } catch (e) { error.value = e.message; }
  finally { saving.value = false; }
}
async function remove(workout) {
  if (!window.confirm(`Delete “${workout.name}”?`)) return;
  deleting.value = workout.id; error.value = ''; notice.value = '';
  try {
    await api(`/workouts/${workout.id}`, { method: 'DELETE' });
    workouts.value = workouts.value.filter(w => w.id !== workout.id);
    notice.value = 'Workout deleted.';
  } catch (e) { error.value = e.message; }
  finally { deleting.value = null; }
}
const formatDate = date => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
onMounted(load);
</script>

<template>
  <div class="shell">
    <header class="topbar"><a class="brand" href="/">form<span>●</span></a><span class="eyebrow">YOUR PERSONAL TRAINING LOG</span></header>
    <main>
      <section class="intro"><div><p class="eyebrow">BUILD YOUR MOMENTUM</p><h1>Every session counts.</h1><p>Track your training. Know what you’re working.</p></div><span class="intro-mark" aria-hidden="true">↗</span></section>
      <div v-if="error" class="message error" role="alert">{{ error }} <button type="button" @click="load" :disabled="loading">Retry loading</button></div>
      <p v-if="notice" class="message success" role="status">{{ notice }}</p>
      <section class="stats" aria-label="All-time training summary">
        <div><span class="eyebrow">WORKOUTS LOGGED</span><strong>{{ workouts.length }}</strong></div>
        <div><span class="eyebrow">MINUTES TRAINED</span><strong>{{ totalMinutes }}<small>min</small></strong></div>
        <div><span class="eyebrow">MUSCLE GROUPS HIT</span><strong>{{ trainedGroups }}<small>/ {{ groups.length }}</small></strong></div>
      </section>
      <div class="workspace">
        <section class="panel log-panel">
          <div class="section-heading"><div><p class="eyebrow">MAKE IT A HABIT</p><h2>Log a workout</h2></div><span aria-hidden="true">＋</span></div>
          <form @submit.prevent="save">
            <label>Workout name<input v-model="form.name" required maxlength="100" placeholder="e.g. Upper body strength" /></label>
            <div class="form-row"><label>Date<input v-model="form.date" type="date" required /></label><label>Duration (minutes)<input v-model.number="form.durationMinutes" type="number" min="1" max="1440" step="1" required /></label></div>
            <fieldset><legend>Targeted muscle groups</legend><p class="hint">Select all the groups you trained.</p><div class="group-options"><label v-for="group in groups" :key="group.id" class="group-option"><input v-model="form.muscleGroupIds" type="checkbox" :value="group.id" /><span>{{ group.name }}</span></label></div></fieldset>
            <label>Notes <span class="optional">optional</span><textarea v-model="form.notes" maxlength="2000" rows="3" placeholder="Exercises, sets, reps, or how it felt…"></textarea></label>
            <button class="primary" :disabled="saving || loading || !groups.length || !form.muscleGroupIds.length">{{ saving ? 'Saving…' : 'Save workout' }} <span aria-hidden="true">↗</span></button>
          </form>
        </section>
        <section class="history">
          <div class="history-heading"><div><p class="eyebrow">PUTTING IN THE WORK</p><h2>Workout history</h2></div><label class="filter"><span class="sr-only">Filter by muscle group</span><select v-model="filter"><option value="">All muscle groups</option><option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option></select></label></div>
          <p v-if="loading" class="empty" role="status">Loading your workouts…</p>
          <div v-else-if="!visible.length" class="empty"><span aria-hidden="true">↗</span><h3>{{ filter ? 'No matching workouts yet.' : 'Your next chapter starts here.' }}</h3><p>{{ filter ? 'Try another muscle group or log a new session.' : 'Log your first workout and build a record of your progress.' }}</p></div>
          <div v-else class="workout-list"><article v-for="workout in visible" :key="workout.id" class="workout-card"><div class="card-heading"><span class="date">{{ formatDate(workout.date) }}</span><span class="duration">{{ workout.durationMinutes }} min</span></div><h3>{{ workout.name }}</h3><div class="tags"><span v-for="group in workout.muscleGroups" :key="group.id">{{ group.name }}</span></div><p v-if="workout.notes" class="notes">{{ workout.notes }}</p><button class="delete" :disabled="deleting !== null" :aria-label="`Delete ${workout.name}`" @click="remove(workout)">{{ deleting === workout.id ? 'Deleting…' : 'Delete workout' }}</button></article></div>
        </section>
      </div>
    </main>
    <footer>A little stronger, one session at a time.</footer>
  </div>
</template>

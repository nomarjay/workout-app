<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { ageOnDate } from '../utils/dashboard.js';
const props = defineProps({ profile: Object, profiles: { type: Array, default: () => [] }, profileId: { type: String, default: '' }, today: String, busy: Boolean, loading: Boolean });
const emit = defineEmits(['save', 'delete', 'choose']);
const editing = ref(false);
const confirming = ref(false);
const form = reactive({});
const goals = ['General fitness', 'Build strength', 'Build muscle', 'Improve endurance', 'Weight management', 'Mobility'];
const experience = ['Beginner', 'Intermediate', 'Advanced'];
const activities = ['Mostly sedentary', 'Lightly active', 'Moderately active', 'Very active'];
const initials = computed(() => props.profile?.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'YOU');
const age = computed(() => ageOnDate(props.profile?.birthDate, props.today));
watch(() => props.profile, () => { editing.value = false; confirming.value = false; });
function edit() {
  Object.assign(form, { name: '', email: '', birthDate: '', gender: '', heightCm: '', weightKg: '',
    goal: 'General fitness', experience: 'Beginner', activityLevel: 'Moderately active', weeklyTarget: 3 }, props.profile || {});
  form.birthDate ||= '';
  form.heightCm ??= '';
  form.weightKg ??= '';
  editing.value = true;
  confirming.value = false;
}
function save() {
  emit('save', { ...form, birthDate: form.birthDate || null,
    heightCm: form.heightCm === '' ? null : Number(form.heightCm), weightKg: form.weightKg === '' ? null : Number(form.weightKg), weeklyTarget: Number(form.weeklyTarget) });
}
</script>
<template>
  <section class="panel profile-card" aria-labelledby="profile-heading">
    <div class="dashboard-section-heading"><div><p class="eyebrow">YOUR STARTING POINT</p><h2 id="profile-heading">Client profile</h2></div><span class="subtle-badge">{{ profile ? 'Your fitness plan' : 'Get started' }}</span></div>
    <p v-if="loading && !profile" class="hint" role="status">Loading your profile…</p>
    <template v-else>
      <template v-if="profile">
        <div class="profile-identity"><div class="profile-avatar" aria-hidden="true">{{ initials }}</div><div><h3>{{ profile.name }}</h3><p class="hint">{{ profile.experience }} · {{ profile.goal }}</p><p v-if="profile.email" class="profile-email">{{ profile.email }}</p></div></div>
        <dl class="profile-facts">
          <div><dt>Age</dt><dd>{{ age == null ? 'Not added' : `${age} years` }}</dd></div>
          <div><dt>Gender</dt><dd>{{ profile.gender || 'Not added' }}</dd></div>
          <div><dt>Height</dt><dd>{{ profile.heightCm == null ? 'Not added' : `${profile.heightCm} cm` }}</dd></div>
          <div><dt>Weight</dt><dd>{{ profile.weightKg == null ? 'Not added' : `${profile.weightKg} kg` }}</dd></div>
          <div><dt>Activity level</dt><dd>{{ profile.activityLevel }}</dd></div>
          <div><dt>Weekly target</dt><dd>{{ profile.weeklyTarget }} workouts</dd></div>
        </dl>

      </template>
      <div v-else class="profile-empty"><div class="profile-avatar" aria-hidden="true">YOU</div><h3>Make this space yours.</h3><p class="hint">Add your basic information, training goal, and weekly workout target.</p><button v-if="!editing" class="primary" :disabled="busy || loading" @click="edit">+ Create profile</button></div>
    </template>
    <details class="profile-settings" :open="!profile || editing">
      <summary>Profile settings</summary>
      <div class="profile-settings-content">
        <label class="profile-switcher">Choose a user<select :value="profileId" :disabled="busy || loading" @change="emit('choose', $event.target.value)"><option value="">Choose a user / create profile</option><option v-for="person in profiles" :key="person.id" :value="person.id">{{ person.name }}</option></select></label>
        <template v-if="profile && !editing">
        <div v-if="confirming" class="profile-confirm" role="group" aria-label="Confirm profile deletion"><p>Delete your profile information?</p><p class="hint">Your workout library and calendar will be kept.</p><div class="row-actions"><button class="delete" :disabled="busy" @click="emit('delete')">{{ busy ? 'Deleting…' : 'Confirm delete' }}</button><button :disabled="busy" @click="confirming = false">Cancel</button></div></div>
        <div v-else class="row-actions"><button :disabled="busy || loading" @click="edit">Edit profile</button><button class="delete" :disabled="busy || loading" @click="confirming = true">Delete profile</button></div>
        </template>
        <button v-if="profile" :disabled="busy || loading" @click="emit('choose', '')">Log out</button>
    <form v-if="editing" class="profile-form" @submit.prevent="save">
      <p class="hint">Name, training goal, and preferences are required. Personal measurements are optional.</p>
      <fieldset :disabled="busy || loading"><div class="profile-form-grid">
        <label>Full name<input v-model="form.name" required maxlength="100" autocomplete="name"></label>
        <label>Email (optional)<input v-model="form.email" type="email" maxlength="254" autocomplete="email"></label>
        <label>Date of birth (optional)<input v-model="form.birthDate" type="date" min="1900-01-01" :max="today" autocomplete="bday"></label>
        <label>Gender (optional)<select v-model="form.gender"><option value="">Not specified</option><option>Female</option><option>Male</option><option>Nonbinary</option><option>Prefer not to say</option></select></label>
        <label>Height in cm (optional)<input v-model="form.heightCm" type="number" min="50" max="250" step="0.1" placeholder="e.g. 175"></label>
        <label>Weight in kg (optional)<input v-model="form.weightKg" type="number" min="10" max="500" step="0.1" placeholder="e.g. 75"></label>
        <label>Training goal<select v-model="form.goal"><option v-for="goal in goals" :key="goal">{{ goal }}</option></select></label>
        <label>Experience<select v-model="form.experience"><option v-for="level in experience" :key="level">{{ level }}</option></select></label>
        <label>Activity level<select v-model="form.activityLevel"><option v-for="level in activities" :key="level">{{ level }}</option></select></label>
        <label>Workouts per week<select v-model="form.weeklyTarget"><option v-for="count in 7" :key="count" :value="count">{{ count }} {{ count === 1 ? 'workout' : 'workouts' }}</option></select></label>
      </div><div class="row-actions"><button class="primary">{{ busy ? 'Saving…' : profile ? 'Save changes' : 'Create profile' }}</button><button type="button" @click="editing = false">Cancel</button></div></fieldset>
    </form>
      </div>
    </details>
  </section>
</template>

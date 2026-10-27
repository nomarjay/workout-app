<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { ageOnDate } from '../utils/dashboard.js';
const props = defineProps({
  profile: Object,
  profiles: { type: Array, default: () => [] },
  profileId: { type: String, default: '' },
  today: String,
  busy: Boolean,
  loading: Boolean,
});
const emit = defineEmits(['save', 'delete', 'choose']);
const editing = ref(false);
const confirming = ref(false);
const form = reactive({});
const goals = [
  'General fitness',
  'Build strength',
  'Build muscle',
  'Improve endurance',
  'Weight management',
  'Mobility',
];
const experience = ['Beginner', 'Intermediate', 'Advanced'];
const activities = [
  'Mostly sedentary',
  'Lightly active',
  'Moderately active',
  'Very active',
];
const initials = computed(
  () =>
    props.profile?.name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || 'YOU'
);
const age = computed(() => ageOnDate(props.profile?.birthDate, props.today));
watch(
  () => props.profile,
  () => {
    editing.value = false;
    confirming.value = false;
  }
);
function edit() {
  Object.assign(
    form,
    {
      name: '',
      email: '',
      birthDate: '',
      gender: '',
      heightCm: '',
      weightKg: '',
      goal: 'General fitness',
      experience: 'Beginner',
      activityLevel: 'Moderately active',
      weeklyTarget: 3,
    },
    props.profile || {}
  );
  form.birthDate ||= '';
  form.heightCm ??= '';
  form.weightKg ??= '';
  editing.value = true;
  confirming.value = false;
}
function save() {
  emit('save', {
    ...form,
    birthDate: form.birthDate || null,
    heightCm: form.heightCm === '' ? null : Number(form.heightCm),
    weightKg: form.weightKg === '' ? null : Number(form.weightKg),
    weeklyTarget: Number(form.weeklyTarget),
  });
}
defineExpose({ edit });
</script>
<template>
  <section
    class="panel rounded-[18px] border border-(--color-border) bg-(--color-surface) p-5 shadow-none min-[601px]:p-[22px] min-[1051px]:p-7 profile-card"
    aria-labelledby="profile-heading"
  >
    <div
      class="dashboard-section-heading mb-5 flex flex-wrap items-center justify-between gap-3 [&_h2]:text-2xl [&_h2]:tracking-[-.5px] [&_.hint]:mb-0"
    >
      <div>
        <p
          class="eyebrow text-xs font-bold tracking-[.08em] text-(--color-text-subtle)"
        >
          A PLAN THAT FITS YOU
        </p>
        <h2 id="profile-heading">Your profile</h2>
      </div>
      <span
        class="subtle-badge inline-block whitespace-nowrap rounded-full bg-(--color-tag-background) px-2.5 py-1.5 text-[13px] text-(--color-tag-text)"
        >{{ profile ? 'Your fitness plan' : 'Get started' }}</span
      >
    </div>
    <p
      v-if="loading && !profile"
      class="hint text-[15px] leading-[1.6] text-(--color-text-muted)"
      role="status"
    >
      Loading your profile…
    </p>
    <template v-else>
      <template v-if="profile">
        <div
          class="profile-identity my-4 flex items-center gap-3.5 [&>div:last-child]:min-w-0 [&_h3]:m-0 [&_h3]:text-xl [&_h3]:wrap-anywhere [&_.hint]:my-[5px]"
        >
          <div
            class="profile-avatar grid size-[58px] shrink-0 place-items-center rounded-full bg-(--color-success-background) text-xl font-semibold text-(--color-avatar-text)"
            aria-hidden="true"
          >
            {{ initials }}
          </div>
          <div>
            <h3>{{ profile.name }}</h3>
            <p class="hint text-[15px] leading-[1.6] text-(--color-text-muted)">
              {{ profile.experience }} · {{ profile.goal }}
            </p>
            <p
              v-if="profile.email"
              class="profile-email mt-[5px] mb-0 text-sm text-(--color-text-muted) wrap-anywhere"
            >
              {{ profile.email }}
            </p>
          </div>
        </div>
        <details class="profile-personal-details">
          <summary>About you</summary>
          <dl
            class="profile-facts mt-0 mb-[22px] grid grid-cols-2 gap-x-[18px] [&>div]:border-b [&>div]:border-(--color-border-subtle) [&>div]:py-3 [&_dt]:mb-1.5 [&_dt]:text-[15px] [&_dt]:text-(--color-text-subtle) [&_dd]:m-0 [&_dd]:text-[15px] [&_dd]:leading-[1.4] [&_dd]:font-semibold"
          >
            <div>
              <dt>Age</dt>
              <dd>{{ age == null ? 'Not added' : `${age} years` }}</dd>
            </div>
            <div>
              <dt>Gender</dt>
              <dd>{{ profile.gender || 'Not added' }}</dd>
            </div>
            <div>
              <dt>Height</dt>
              <dd>
                {{
                  profile.heightCm == null
                    ? 'Not added'
                    : `${profile.heightCm} cm`
                }}
              </dd>
            </div>
            <div>
              <dt>Weight</dt>
              <dd>
                {{
                  profile.weightKg == null
                    ? 'Not added'
                    : `${profile.weightKg} kg`
                }}
              </dd>
            </div>
            <div>
              <dt>Activity level</dt>
              <dd>{{ profile.activityLevel }}</dd>
            </div>
            <div>
              <dt>Weekly target</dt>
              <dd>{{ profile.weeklyTarget }} workouts</dd>
            </div>
          </dl>
        </details>
      </template>
      <div
        v-else
        class="profile-empty py-1.5 [&_h3]:mt-[18px] [&_h3]:mb-2.5 [&_h3]:text-[21px]"
      >
        <div
          class="profile-avatar grid size-[58px] shrink-0 place-items-center rounded-full bg-(--color-success-background) text-xl font-semibold text-(--color-avatar-text)"
          aria-hidden="true"
        >
          YOU
        </div>
        <h3>Make this space yours.</h3>
        <p class="hint text-[15px] leading-[1.6] text-(--color-text-muted)">
          Add your basic information, training goal, and weekly workout target.
        </p>
        <button
          v-if="!editing"
          class="primary border-(--color-primary) bg-(--color-primary) text-(--color-on-primary) font-bold shadow-(--neon-glow)"
          :disabled="busy || loading"
          @click="edit"
        >
          + Create profile
        </button>
      </div>
    </template>
    <details
      class="profile-settings mt-3 border-t border-(--color-border-table) pt-4 [&>summary]:text-(--color-primary)"
      :open="!profile || editing"
    >
      <summary>Profile settings</summary>
      <div
        class="profile-settings-content grid gap-4 pt-4 [&>button]:justify-self-start"
      >
        <label
          class="profile-switcher grid gap-2 [&_select]:w-full [&_select]:max-w-none"
          >Choose a user<select
            :value="profileId"
            :disabled="busy || loading"
            @change="emit('choose', $event.target.value)"
          >
            <option value="">Choose a user / create profile</option>
            <option
              v-for="person in profiles"
              :key="person.id"
              :value="person.id"
            >
              {{ person.name }}
            </option>
          </select></label
        >
        <template v-if="profile && !editing">
          <div
            v-if="confirming"
            class="profile-confirm mt-4 rounded-lg bg-(--color-confirmation-background) p-4 text-[13px]"
            role="group"
            aria-label="Confirm profile deletion"
          >
            <p>Delete your profile information?</p>
            <p class="hint text-[15px] leading-[1.6] text-(--color-text-muted)">
              Your workout library and calendar will be kept.
            </p>
            <div class="row-actions flex flex-wrap gap-2">
              <button
                class="delete text-(--color-danger)"
                :disabled="busy"
                @click="emit('delete')"
              >
                {{ busy ? 'Deleting…' : 'Confirm delete' }}</button
              ><button :disabled="busy" @click="confirming = false">
                Cancel
              </button>
            </div>
          </div>
          <div v-else class="row-actions flex flex-wrap gap-2">
            <button :disabled="busy || loading" @click="edit">
              Edit profile</button
            ><button
              class="delete text-(--color-danger)"
              :disabled="busy || loading"
              @click="confirming = true"
            >
              Delete profile
            </button>
          </div>
        </template>
        <button
          v-if="profile"
          :disabled="busy || loading"
          @click="emit('choose', '')"
        >
          Log out
        </button>
        <form
          v-if="editing"
          class="profile-form [&_fieldset]:m-0 [&_fieldset]:min-w-0 [&_fieldset]:border-0 [&_fieldset]:p-0"
          @submit.prevent="save"
        >
          <p class="hint text-[15px] leading-[1.6] text-(--color-text-muted)">
            Name, training goal, and preferences are required. Personal
            measurements are optional.
          </p>
          <fieldset :disabled="busy || loading">
            <div
              class="profile-form-grid my-5 grid grid-cols-1 gap-x-3 gap-y-3.5 min-[1051px]:grid-cols-2"
            >
              <label
                >Full name<input
                  v-model="form.name"
                  required
                  maxlength="100"
                  autocomplete="name"
              /></label>
              <label
                >Email (optional)<input
                  v-model="form.email"
                  type="email"
                  maxlength="254"
                  autocomplete="email"
              /></label>
              <label
                >Date of birth (optional)<input
                  v-model="form.birthDate"
                  type="date"
                  min="1900-01-01"
                  :max="today"
                  autocomplete="bday"
              /></label>
              <label
                >Gender (optional)<select v-model="form.gender">
                  <option value="">Not specified</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Nonbinary</option>
                  <option>Prefer not to say</option>
                </select></label
              >
              <label
                >Height in cm (optional)<input
                  v-model="form.heightCm"
                  type="number"
                  min="50"
                  max="250"
                  step="0.1"
                  placeholder="e.g. 175"
              /></label>
              <label
                >Weight in kg (optional)<input
                  v-model="form.weightKg"
                  type="number"
                  min="10"
                  max="500"
                  step="0.1"
                  placeholder="e.g. 75"
              /></label>
              <label
                >Training goal<select v-model="form.goal">
                  <option v-for="goal in goals" :key="goal">{{ goal }}</option>
                </select></label
              >
              <label
                >Experience<select v-model="form.experience">
                  <option v-for="level in experience" :key="level">
                    {{ level }}
                  </option>
                </select></label
              >
              <label
                >Activity level<select v-model="form.activityLevel">
                  <option v-for="level in activities" :key="level">
                    {{ level }}
                  </option>
                </select></label
              >
              <label
                >Workouts per week<select v-model="form.weeklyTarget">
                  <option v-for="count in 7" :key="count" :value="count">
                    {{ count }} {{ count === 1 ? 'workout' : 'workouts' }}
                  </option>
                </select></label
              >
            </div>
            <div class="row-actions flex flex-wrap gap-2">
              <button
                class="primary border-(--color-primary) bg-(--color-primary) text-(--color-on-primary) font-bold shadow-(--neon-glow)"
              >
                {{
                  busy ? 'Saving…' : profile ? 'Save changes' : 'Create profile'
                }}</button
              ><button type="button" @click="editing = false">Cancel</button>
            </div>
          </fieldset>
        </form>
      </div>
    </details>
  </section>
</template>

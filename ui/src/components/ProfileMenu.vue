<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import ProfileCard from './ProfileCard.vue';
import { localDate } from '../utils/dashboard.js';
const props = defineProps({
  profile: Object,
  profiles: { type: Array, default: () => [] },
  profileId: String,
  error: String,
  busy: Boolean,
  loading: Boolean,
});
const emit = defineEmits(['save', 'delete', 'choose']);
const open = ref(false);
const root = ref(null);
const trigger = ref(null);
const dialog = ref(null);
const card = ref(null);
const editorOpen = ref(false);
const initials = computed(() =>
  props.profile?.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
);
function closeMenu(restoreFocus = false) {
  open.value = false;
  if (restoreFocus) trigger.value?.focus();
}
function outside(event) {
  if (!root.value?.contains(event.target)) closeMenu();
}
function choose(id) {
  closeMenu();
  emit('choose', id);
}
async function editProfile(create = false) {
  closeMenu();
  if (create && props.profile) emit('choose', '');
  editorOpen.value = true;
  await nextTick();
  dialog.value.showModal();
  if (create || props.profile) {
    card.value?.edit();
    await nextTick();
  }
  (
    dialog.value.querySelector('.profile-form input') ||
    dialog.value.querySelector('button')
  )?.focus();
}
function closeEditor() {
  dialog.value?.close();
  editorOpen.value = false;
  trigger.value?.focus();
}
watch(
  () => props.profile,
  (value, previous) => {
    if (value && value !== previous && editorOpen.value) closeEditor();
  }
);
onMounted(() => document.addEventListener('pointerdown', outside));
onUnmounted(() => document.removeEventListener('pointerdown', outside));
</script>
<template>
  <div
    ref="root"
    class="relative"
    @keydown.esc.stop.prevent="closeMenu(true)"
    @focusout="
      (event) => {
        if (event.relatedTarget && !root.contains(event.relatedTarget))
          closeMenu();
      }
    "
  >
    <button
      ref="trigger"
      type="button"
      class="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full! border-(--color-primary) bg-(--color-success-background) p-0! font-semibold text-(--color-avatar-text)"
      :aria-label="
        profile ? `Profile options for ${profile.name}` : 'Profile options'
      "
      :aria-expanded="open"
      aria-controls="profile-dropdown"
      :disabled="busy || loading"
      @click="open = !open"
    >
      <span v-if="initials" aria-hidden="true">{{ initials }}</span>
      <svg
        v-else
        class="size-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </svg>
    </button>
    <div
      v-if="open"
      id="profile-dropdown"
      class="absolute right-0 top-full z-50 mt-3 w-72 max-w-[calc(100vw-32px)] rounded-2xl border border-(--color-border) bg-(--color-surface) p-3 shadow-xl"
      aria-label="Profile options"
    >
      <div class="mb-2 border-b border-(--color-border-subtle) px-2 pb-3">
        <p class="m-0 font-semibold wrap-anywhere">
          {{ profile?.name || 'Your profile' }}
        </p>
        <p class="mt-1 mb-0 text-sm text-(--color-text-muted)">
          {{ profile?.goal || 'Choose or create a profile to get started.' }}
        </p>
      </div>
      <button
        v-if="profile"
        type="button"
        class="mb-2 min-h-11 w-full border-0 text-left"
        @click="editProfile()"
      >
        Edit profile
      </button>
      <label v-if="profiles.length" class="block px-2 pb-3 text-sm"
        >Switch profile<select
          :value="profileId || ''"
          :disabled="busy || loading"
          @change="choose($event.target.value)"
        >
          <option value="" disabled>Choose your name</option>
          <option
            v-for="person in profiles"
            :key="person.id"
            :value="person.id"
          >
            {{ person.name }}
          </option>
        </select></label
      >
      <button
        type="button"
        class="min-h-11 w-full border-0 text-left"
        @click="editProfile(true)"
      >
        Create profile
      </button>
      <button
        v-if="profile"
        type="button"
        class="mt-2 min-h-11 w-full border-0 border-t! border-(--color-border-subtle) text-left"
        @click="choose('')"
      >
        Log out
      </button>
    </div>
  </div>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="m-auto max-h-[90vh] w-[min(640px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-(--color-border) bg-(--color-surface) p-0 text-(--color-text) backdrop:bg-black/60 [&_label]:text-sm [&_input]:min-h-11 [&_select]:min-h-11"
      aria-label="Profile settings"
      @cancel.prevent="closeEditor"
    >
      <div class="flex justify-end px-4 pt-3">
        <button
          type="button"
          aria-label="Close profile settings"
          :disabled="busy"
          @click="closeEditor"
        >
          Close
        </button>
      </div>
      <p v-if="error" class="message error mx-4" role="alert">{{ error }}</p>
      <ProfileCard
        v-if="editorOpen"
        ref="card"
        :profile="profile"
        :profiles="profiles"
        :profile-id="profileId"
        :today="localDate()"
        :busy="busy"
        :loading="loading"
        class="border-0!"
        @save="emit('save', $event)"
        @delete="
          emit('delete');
          closeEditor();
        "
        @choose="
          choose($event);
          closeEditor();
        "
      />
    </dialog>
  </Teleport>
</template>

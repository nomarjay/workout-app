<script setup>
import ProfileMenu from './ProfileMenu.vue';
defineProps({ profile: Object, profiles: Array, profileId: String, error: String, busy: Boolean, loading: Boolean, menuOpen: Boolean });
defineEmits(['home', 'toggle-menu', 'save-profile', 'delete-profile', 'choose-profile']);
</script>
<template>
  <header class="header">
    <div class="header-brand">
      <button class="menu-toggle" type="button" aria-controls="app-navigation" :aria-expanded="menuOpen" :aria-label="menuOpen ? 'Close navigation' : 'Open navigation'" @click="$emit('toggle-menu')">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path v-if="menuOpen" d="m6 6 12 12M6 18 18 6"/><path v-else d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>
      <a class="brand" href="#dashboard" aria-label="Form dashboard home" @click.prevent="$emit('home')">GIT FIT<span aria-hidden="true">●</span></a>
    </div>
    <ProfileMenu :error="error" :profile="profile" :profiles="profiles" :profile-id="profileId" :busy="busy" :loading="loading" @save="$emit('save-profile', $event)" @delete="$emit('delete-profile')" @choose="$emit('choose-profile', $event)" />
  </header>
</template>
<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; min-height: 88px; gap: 16px; border-bottom: 1px solid var(--color-border-header); }
.header-brand { display: flex; align-items: center; gap: 12px; }
.menu-toggle { display: none; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; padding: 8px; }
@media (max-width: 760px) {
  .header { min-height: 72px; gap: 10px; }
  .menu-toggle { display: inline-flex; }
  .brand { font-size: 28px; white-space: nowrap; }
}
</style>

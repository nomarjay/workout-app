<script setup>
import { ref, watch } from 'vue';
import AppHeader from './AppHeader.vue';
import AppSidebar from './AppSidebar.vue';
import AppFooter from './AppFooter.vue';
const props = defineProps({
  navigation: Array,
  active: String,
  draftCount: Number,
  profile: Object,
  profiles: Array,
  profileId: String,
  error: String,
  busy: Boolean,
  loading: Boolean,
});
const emit = defineEmits([
  'navigate',
  'save-profile',
  'delete-profile',
  'choose-profile',
]);
const menuOpen = ref(false);
const layout = ref(null);
function closeMenu(restoreFocus = false) {
  menuOpen.value = false;
  if (restoreFocus) layout.value?.querySelector('.menu-toggle')?.focus();
}
function navigate(id) {
  closeMenu();
  emit('navigate', id);
}
watch(
  () => props.active,
  () => closeMenu(),
);
</script>
<template>
  <div ref="layout" class="app-layout" @keydown.esc="closeMenu(true)">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <AppHeader
      :profile="profile"
      :profiles="profiles"
      :profile-id="profileId"
      :error="error"
      :busy="busy"
      :loading="loading"
      :menu-open="menuOpen"
      @toggle-menu="menuOpen = !menuOpen"
      @home="navigate('dashboard')"
      @save-profile="$emit('save-profile', $event)"
      @delete-profile="$emit('delete-profile')"
      @choose-profile="
        closeMenu();
        $emit('choose-profile', $event);
      "
    />
    <div class="app-body">
      <AppSidebar
        :items="navigation"
        :active="active"
        :draft-count="draftCount"
        :open="menuOpen"
        @navigate="navigate"
      />
      <main id="main-content" class="main-content" tabindex="-1"><slot /></main>
    </div>
    <AppFooter />
  </div>
</template>
<style scoped>
.app-layout {
  width: 100%;
  max-width: 1800px;
  margin: auto;
  padding-inline: 32px;
}
.app-body {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 32px;
  align-items: start;
}
.main-content {
  min-width: 0;
  padding-top: 24px;
}
.skip-link {
  position: fixed;
  top: 8px;
  left: 16px;
  transform: translateY(-150%);
  z-index: 100;
  padding: 12px;
  background: var(--color-primary);
  color: var(--color-on-primary);
}
.skip-link:focus {
  transform: translateY(0);
}
@media (max-width: 1100px) {
  .app-layout {
    padding-inline: 20px;
  }
  .app-body {
    grid-template-columns: 172px minmax(0, 1fr);
    gap: 20px;
  }
}
@media (max-width: 760px) {
  .app-layout {
    padding-inline: 12px;
  }
  .app-body {
    display: block;
  }
  .main-content {
    padding-top: 16px;
  }
}
</style>

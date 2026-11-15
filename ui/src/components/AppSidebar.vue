<script setup>
defineProps({
  items: Array,
  active: String,
  draftCount: Number,
  open: Boolean,
});
defineEmits(['navigate']);
</script>
<template>
  <nav
    id="app-navigation"
    class="sidebar"
    :class="{ 'is-open': open }"
    aria-label="Main navigation"
  >
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      :aria-current="active === item.id ? 'page' : undefined"
      @click="$emit('navigate', item.id)"
    >
      <span>{{ item.name }}</span
      ><span
        v-if="item.id === 'workouts' && draftCount"
        class="draft-count"
        :aria-label="`${draftCount} exercises in your workout bag`"
        >{{ draftCount }}</span
      >
    </button>
  </nav>
</template>
<style scoped>
.sidebar {
  position: sticky;
  top: 24px;
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: 8px;
  padding: 24px 0px
}
.sidebar button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  text-align: left;
  border: transparent !important;
  background-color: transparent;
}
.sidebar button[aria-current='page'] {
  color: var(--color-primary);
  font-weight: 700;
  cursor: default; /* Optional: indicates it's already selected */
}
.sidebar button:not([aria-current='page']):hover {
  color: var(--color-primary);
  font-weight: 500;
  opacity: 75%;
}
.draft-count {
  border: 1px solid currentColor;
  border-radius: 20px;
  padding: 1px 7px;
  font-size: 12px;
}
@media (max-width: 760px) {
  .sidebar {
    display: none;
    position: static;
    padding: 16px 0;
    border-right: 0;
    border-bottom: 1px solid var(--color-border-divider);
  }
  .sidebar.is-open {
    display: flex;
  }
}
</style>

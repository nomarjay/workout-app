<script setup>
defineProps({
  search: String,
  sort: String,
  layout: String,
  count: Number,
  muscleSort: Boolean,
});
defineEmits(['update:search', 'update:sort', 'update:layout']);
</script>
<template>
  <div class="toolbar">
    <div class="toolbar-main">
      <label class="search"
        >Search<input
          type="search"
          :value="search"
          placeholder="Search by name…"
          @input="$emit('update:search', $event.target.value)"
      /></label>
      <div class="sort-control" role="group" aria-label="Sort by name">
        <span class="control-label">Sort</span>
        <div class="pills">
          <button
            type="button"
            class="pill"
            :aria-pressed="sort === 'asc'"
            @click="$emit('update:sort', 'asc')"
          >
            A–Z
          </button>
        </div>
      </div>
      <div class="view-toggle" role="group" aria-label="Display mode">
        <button
          type="button"
          class="pill"
          :aria-pressed="layout === 'grid'"
          @click="$emit('update:layout', 'grid')"
        >
          ▦ Grid</button
        ><button
          type="button"
          class="pill"
          :aria-pressed="layout === 'list'"
          @click="$emit('update:layout', 'list')"
        >
          ☰ List
        </button>
      </div>
    </div>
    <div v-if="muscleSort" class="pills">
      <button
        type="button"
        class="pill"
        :aria-pressed="sort === 'muscle'"
        @click="$emit('update:sort', 'muscle')"
      >
        Primary muscle group
      </button>
    </div>
    <slot />
  </div>
  <p class="hint" aria-live="polite">{{ count }} results</p>
</template>

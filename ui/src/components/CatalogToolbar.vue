<script setup>
defineProps({
  search: String,
  sort: String,
  layout: String,
  count: Number,
  equipmentSort: Boolean,
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
      <div class="sort-control" role="group" aria-label="Sort collection">
        <span class="control-label">Sort</span>
        <div class="pills">
          <button
            type="button"
            class="pill"
            :aria-pressed="sort === 'asc'"
            @click="$emit('update:sort', 'asc')"
          >
            A–Z
          </button><button type="button" class="pill" :aria-pressed="sort === 'recent'" @click="$emit('update:sort', 'recent')">Recently added</button><button v-if="equipmentSort" type="button" class="pill" :aria-pressed="sort === 'equipment'" @click="$emit('update:sort', 'equipment')">Equipment type</button>
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
    <slot />
  </div>
  <p class="hint" aria-live="polite">{{ count }} results</p>
</template>

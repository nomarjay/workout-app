<script setup>
import { computed } from 'vue';
import CatalogToolbar from '../components/CatalogToolbar.vue';
import DataCard from '../components/DataCard.vue';
import { useCatalogBrowser } from '../composables/useCatalogBrowser.js';
import { belongsToPrimaryGroup } from '../utils/muscleGroups.js';
const props = defineProps({ catalog: Object });
const { search, sort, layout, visible } = useCatalogBrowser(computed(() => props.catalog.groups));
const count = group => props.catalog.exercises.filter(e => belongsToPrimaryGroup(e, group.id)).length;
</script>
<template>
  <CatalogToolbar v-model:search="search" v-model:sort="sort" v-model:layout="layout" :count="visible.length" />
  <div class="catalog" :class="layout"><DataCard v-for="group in visible" :key="group.id" :title="group.name" kind="Muscle group">
    <div class="tags"><span v-for="muscle in group.muscles" :key="muscle">{{ muscle }}</span></div><p class="hint">{{ count(group) }} exercises targeting this primary muscle group</p>
  </DataCard></div><p v-if="!visible.length" class="empty">No muscle groups match your search.</p>
</template>

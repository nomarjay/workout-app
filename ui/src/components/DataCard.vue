<script setup>
defineProps({ title: String, image: String, kind: { type: String, default: 'Exercise' } });
</script>
<template>
  <article class="data-card">
    <div class="image-placeholder"><img v-if="image" :src="image" :alt="title"><template v-else><span aria-hidden="true">◇</span><small>{{ kind }} image placeholder</small></template></div>
    <div class="card-content"><h3>{{ title }}</h3><slot /></div>
  </article>
</template>

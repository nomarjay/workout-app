<script setup>
defineProps({ error: String, notice: String, loading: Boolean });
</script>
<template>
  <p v-if="error" class="message error" role="alert">{{ error }}</p>
  <p v-if="notice" class="message success" role="status">{{ notice }}</p>
  <p v-if="loading" role="status">Loading your library…</p>
</template>

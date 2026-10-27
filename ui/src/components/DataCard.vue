<script setup>
import { vImageReveal } from '../directives/imageReveal.js';
import { computed, ref, watch } from 'vue';
const props = defineProps({
  title: String,
  image: String,
  imageViews: Array,
  imageAttribution: Object,
  imageCaption: String,
  kind: { type: String, default: 'Exercise' },
});
const failed = ref(false);
const diagrams = computed(() => props.imageViews || []);
watch(
  () => [props.image, props.imageViews],
  () => {
    failed.value = false;
  }
);
</script>
<template>
  <article class="data-card">
    <div
      class="image-placeholder"
      :class="{
        'reference-diagrams': diagrams.length && !failed,
        'reference-photo': image && !diagrams.length && !failed,
      }"
    >
      <template v-if="diagrams.length && !failed"
        ><div
          v-for="(view, index) in diagrams"
          :key="view.image"
          class="muscle-reference-view"
          role="img"
          :aria-label="
            title +
            ' highlighted muscles, ' +
            (index ? 'back view' : 'front or back view')
          "
        >
          <img v-image-reveal="view.image"
            :src="view.image"
            alt=""
            loading="lazy"
            decoding="async"
            @error="failed = true"
          /><img v-image-reveal="layer"
            v-for="layer in view.overlays"
            :key="layer"
            :src="layer"
            alt=""
            loading="lazy"
            decoding="async"
            class="muscle-reference-layer"
            @error="failed = true"
          /></div
      ></template>
      <img v-image-reveal="image"
        v-else-if="image && !failed"
        :key="image"
        :src="image"
        :alt="imageCaption || title"
        loading="lazy"
        decoding="async"
        @error="failed = true"
      />
      <template v-else
        ><slot name="media-fallback"
          ><span aria-hidden="true">◇</span
          ><small
            >{{ kind }}
            {{ failed ? 'image unavailable' : 'image placeholder' }}</small
          ></slot
        ></template
      >
      <slot name="media-overlay" />
    </div>
    <div
      v-if="image && !failed && imageAttribution"
      class="image-credit"
      :title="imageCaption"
    >
      <span>Reference · </span
      ><a
        :href="imageAttribution.url"
        target="_blank"
        rel="noopener noreferrer"
        >{{ imageAttribution.name }}</a
      ><template v-if="imageAttribution.license">
        ·
        <a
          :href="imageAttribution.licenseUrl"
          target="_blank"
          rel="noopener noreferrer"
          >{{ imageAttribution.license }}</a
        ></template
      >
    </div>
    <div class="card-content">
      <slot name="eyebrow" />
      <h3>{{ title }}</h3>
      <slot />
    </div>
  </article>
</template>
<style scoped>
.reference-photo {
  background: #fff;
}
.reference-photo > img {
  object-fit: var(--product-image-fit, cover);
  height: var(--product-image-height, 210px);
  padding: var(--product-image-padding, 0);
}
.reference-diagrams {
  flex-direction: row;
  gap: 12px;
  padding: 14px;
  background: #fff;
  height: 240px;
}
.muscle-reference-view {
  position: relative;
  height: 100%;
  aspect-ratio: 200 / 362;
}
.muscle-reference-view img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.muscle-reference-layer {
  position: absolute;
  inset: 0;
}
.image-credit {
  padding: 8px 12px;
  font-size: 10px;
  line-height: 1.5;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  overflow-wrap: anywhere;
}
.image-credit a {
  color: inherit;
  text-decoration: underline;
}
:global(.list) .data-card {
  grid-template-columns: 180px minmax(0, 1fr);
}
:global(.list) .image-placeholder {
  grid-column: 1;
  grid-row: 1 / span 2;
}
:global(.list) .image-credit,
:global(.list) .card-content {
  grid-column: 2;
}
:global(.list) .reference-diagrams {
  height: 100%;
  min-height: 210px;
  gap: 4px;
}
:global(.list) .muscle-reference-view {
  max-width: 50%;
  height: 180px;
}
:global(.list) .muscle-reference-view:only-child {
  max-width: 100%;
}
</style>

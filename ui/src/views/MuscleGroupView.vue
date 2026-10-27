<script setup>
import { computed, ref } from 'vue';
import { useMuscleReader } from '../composables/useMuscleReader.js';
import { vImageReveal } from '../directives/imageReveal.js';
import { belongsToPrimaryGroup } from '../utils/muscleGroups.js';
import { muscleDescription } from '../data/muscleGuide.js';
const props = defineProps({ catalog: Object });
const failedArtwork = ref(new Set());
const articles = computed(() =>
  (props.catalog.groups || []).map((group) => {
    const matching = (props.catalog.exercises || []).filter((item) =>
      belongsToPrimaryGroup(item, group.id),
    );
    const exercises = [
      ...new Map(
        matching.map((item) => [item.exerciseId || item.id || item.name, item]),
      ).values(),
    ];
    return { ...group, ...muscleDescription(group), exercises };
  }),
);
const reader = ref(null);
const {
  activeId,
  position,
  hasPrevious,
  hasNext,
  select,
  move,
  wheel,
  keydown,
  touchstart,
  touchend,
} = useMuscleReader(reader, () =>
  articles.value.map((group) => String(group.id)),
);
const currentArticles = computed(() =>
  articles.value.filter((group) => String(group.id) === activeId.value),
);
</script>
<template>
  <div class="muscle-journal">
    <header class="shop-heading journal-heading">
      <div>
        <p class="shop-kicker">THE MUSCLE GUIDE</p>
        <h1>Know the muscles behind the movement.</h1>
        <p>
          A closer look at the muscle groups in your collection: where they are,
          what they do, and the movements that use them.
        </p>
      </div>
    </header>
    <div class="journal-layout">
      <aside class="journal-index">
        <nav aria-label="Muscle guide contents">
          <p class="shop-kicker">IN THIS GUIDE</p>
          <a
            v-for="group in articles"
            :key="group.id"
            :href="`#muscle-${group.id}`"
            @click.prevent="select(String(group.id))"
            aria-controls="muscle-reader"
            :aria-current="
              activeId === String(group.id) ? 'location' : undefined
            "
            >{{ group.name }}</a
          >
        </nav>
        <p class="hint" aria-live="polite">
          {{ articles.length }} muscle groups
        </p>
      </aside>
      <div class="journal-reading-area">
        <p class="reader-position" aria-live="polite">
          {{ articles.length ? position + 1 : 0 }} of {{ articles.length }} ·
          {{ currentArticles[0]?.name || 'No matching groups' }}
        </p>
        <div
          id="muscle-reader"
          ref="reader"
          class="journal-articles"
          role="region"
          aria-label="Muscle group reader"
          tabindex="0"
          @wheel="wheel"
          @keydown="keydown"
          @touchstart.passive="touchstart"
          @touchend.passive="touchend"
          @touchcancel="touchend"
        >
          <article
            v-for="group in currentArticles"
            :id="`muscle-${group.id}`"
            :key="group.id"
            class="muscle-article"
            :data-muscle-section="String(group.id)"
            tabindex="-1"
            :aria-labelledby="`muscle-title-${group.id}`"
          >
            <header>
              <p class="shop-kicker">MUSCLE GROUP</p>
              <h2 :id="`muscle-title-${group.id}`">{{ group.name }}</h2>
              <p class="article-deck">{{ group.subtitle }}</p>
            </header>
            <figure
              v-if="
                (group.image || group.imageViews?.length) &&
                !failedArtwork.has(group.id)
              "
              class="muscle-figure"
            >
              <div v-if="group.imageViews?.length" class="article-diagrams">
                <div
                  v-for="(view, index) in group.imageViews"
                  :key="view.image"
                  class="article-diagram"
                  role="img"
                  :aria-label="`${group.name} muscle reference, view ${index + 1}`"
                >
                  <img
                    v-image-reveal="view.image"
                    :src="view.image"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    @error="failedArtwork.add(group.id)"
                  />
                  <img
                    v-for="layer in view.overlays"
                    :key="layer"
                    v-image-reveal="layer"
                    :src="layer"
                    alt=""
                    class="article-muscle-layer"
                    loading="lazy"
                    decoding="async"
                    @error="failedArtwork.add(group.id)"
                  />
                </div>
              </div>
              <img
                v-else
                v-image-reveal="group.image"
                :src="group.image"
                :alt="`${group.name} muscle reference`"
                loading="lazy"
                decoding="async"
                @error="failedArtwork.add(group.id)"
              />
              <figcaption v-if="group.imageAttribution">
                <a
                  :href="group.imageAttribution.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ group.imageAttribution.name }}</a
                ><template v-if="group.imageAttribution.license">
                  ·
                  <a
                    :href="group.imageAttribution.licenseUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ group.imageAttribution.license }}</a
                  ></template
                >
              </figcaption>
            </figure>
            <div class="article-prose">
              <p v-for="paragraph in group.paragraphs" :key="paragraph">
                {{ paragraph }}
              </p>
              <h3>Focus areas in this collection</h3>
              <p>{{ (group.muscles || []).join(' · ') || group.name }}</p>
              <h3>In your equipment collection</h3>
              <p v-if="group.exercises.length">
                {{ group.exercises.length }}
                {{
                  group.exercises.length === 1
                    ? 'movement uses'
                    : 'movements use'
                }}
                this as a primary muscle group.
                <template v-if="group.exercises.length"
                  >Examples include
                  {{
                    group.exercises
                      .slice(0, 3)
                      .map((item) => item.name)
                      .join(', ')
                  }}.</template
                >
              </p>
              <p v-else>
                There are no movements with this primary muscle group in your
                collection yet.
              </p>
              <p v-if="group.source" class="anatomy-source">
                Anatomy reference:
                <a
                  :href="group.source"
                  target="_blank"
                  rel="noopener noreferrer"
                  >OpenStax Anatomy and Physiology</a
                ><template v-if="group.extraSource">
                  ·
                  <a
                    :href="group.extraSource"
                    target="_blank"
                    rel="noopener noreferrer"
                    >Trunk muscles</a
                  ></template
                >
              </p>
            </div>
          </article>
          <p v-if="!articles.length" class="empty">
            No muscle groups are available yet.
          </p>
        </div>
        <footer class="reader-controls">
          <button type="button" :disabled="!hasPrevious" @click="move(-1)">
            ← Previous group</button
          ><span class="hint">Scroll past the end to continue.</span
          ><button type="button" :disabled="!hasNext" @click="move(1)">
            Next group →
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>
<style scoped>
.journal-heading {
  max-width: 850px;
}
.journal-heading h1 {
  margin: 0;
  max-width: 750px;
  font-size: clamp(32px, 4.6vw, 56px);
  line-height: 1.12;
  letter-spacing: -0.045em;
  font-weight: 650;
}
.journal-heading > div > p:last-child {
  max-width: 68ch;
  line-height: 1.8;
}
.journal-layout {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: clamp(32px, 5vw, 80px);
  border-top: 1px solid var(--color-border-subtle);
  padding-top: 32px;
  justify-content: space-between;
}
.journal-index {
  position: sticky;
  top: 24px;
  align-self: start;
}
.journal-index label {
  font-size: 12px;
}
.journal-index nav {
  margin-top: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.journal-index nav a {
  color: var(--color-text-muted);
  text-decoration: none;
  width: fit-content;
}
.journal-index nav a:hover {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 4px;
}
.journal-articles {
  min-width: 0;
  max-width: 850px;
}
.muscle-article {
  padding: 8px 0 48px;
  margin-bottom: 40px;
  border-bottom: 1px solid var(--color-border-subtle);
  scroll-margin-top: 0;
}
.muscle-article h2 {
  margin: 0;
  font-size: clamp(28px, 3vw, 38px);
  letter-spacing: -0.035em;
  font-weight: 650;
}
.article-deck {
  font-size: 18px;
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin: 12px 0 24px;
}
.article-prose {
  max-width: 70ch;
  font-size: 15px;
  line-height: 1.9;
  color: var(--color-text-muted);
}
.article-prose h3 {
  font-size: 16px;
  color: var(--color-text);
  margin: 28px 0 8px;
}
.article-prose p {
  margin: 0 0 18px;
}
.muscle-figure {
  margin: 0 0 28px;
}
.muscle-figure > img {
  display: block;
  width: 100%;
  max-height: 360px;
  object-fit: contain;
  background: #fff;
}
.article-diagrams {
  display: flex;
  justify-content: center;
  gap: 32px;
  background: #fff;
  padding: 24px;
}
.article-diagram {
  position: relative;
  height: clamp(220px, 28vw, 320px);
  aspect-ratio: 200 / 362;
}
.article-diagram img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.article-muscle-layer {
  position: absolute;
  inset: 0;
}
figcaption,
.article-prose .anatomy-source {
  font-size: 11px;
  line-height: 1.7;
  color: var(--color-text-subtle);
}
figcaption {
  padding-top: 8px;
}
figcaption a,
.anatomy-source a {
  color: inherit;
  text-underline-offset: 3px;
}
@media (max-width: 760px) {
  .journal-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
  .journal-index {
    position: sticky;
    top: 0;
    z-index: 3;
    padding-block: 12px;
    background: var(--color-background);
    border-bottom: 1px solid var(--color-border-subtle);
  }
  .journal-index nav {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 12px 20px;
    margin-top: 20px;
  }
  .journal-index nav p {
    width: 100%;
    margin: 0;
  }
  .article-diagrams {
    gap: 12px;
    padding: 16px;
  }
}

.journal-index nav a {
  border-inline-start: 2px solid transparent;
  padding-inline-start: 12px;
}
.journal-index nav a[aria-current='location'] {
  color: var(--color-primary);
  border-color: var(--color-primary);
  font-weight: 650;
}

.journal-reading-area {
  min-width: 0;
  max-width: 850px;
}
.reader-position {
  margin: 0 0 12px;
  color: var(--color-text-subtle);
  font-size: 12px;
}
.journal-articles {
  height: clamp(300px, 65dvh, 760px);
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;
  padding: 8px 20px 0 4px;
}
.muscle-article {
  margin: 0;
  padding-bottom: 16px;
  border-bottom: 0;
}
.reader-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-subtle);
}
.reader-controls button {
  font-size: 12px;
}
.reader-controls .hint {
  font-size: 11px;
}
@media (prefers-reduced-motion: no-preference) {
  .muscle-article {
    animation: view-arrive 180ms ease-out;
  }
  .journal-index nav a {
    transition:
      color 160ms ease,
      border-color 160ms ease;
  }
}
@media (max-width: 760px) {
  .journal-index {
    position: static;
  }
  .journal-articles {
    height: 60dvh;
    padding-right: 12px;
  }
  .reader-controls .hint {
    order: 3;
    width: 100%;
    text-align: center;
  }
}
.journal-layout:not(:has(.journal-index)) {
  grid-template-columns: minmax(0, 1fr);
}
.journal-reading-area {
  width: 100%;
  margin-inline: auto;
}
</style>

<script setup lang="ts">
import type { SlideRoute } from '@slidev/types'
import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'
import { useNav } from '../composables/useNav'

/**
 * A compact 2D map of the whole talk for the presenter view: one column per
 * topic, one cell per row inside it, the current cell marked. It is the same
 * shape as the `esc` overview but stripped to blocks, so it can sit permanently
 * above the presenter panes instead of covering them.
 *
 * Clicking a cell navigates, through the same `nav.go(no)` the overview uses.
 */
const { slides, currentSlideNo, go, gridColumns } = useNav()

const expanded = useLocalStorage('slidev-presenter-minimap', true, { listenToStorageChanges: false })

const maxRows = computed(() => gridColumns.value.reduce((m, c) => Math.max(m, c.length), 1))

/**
 * Cells shrink as the deck gets deeper so the strip stays around 90px however
 * long the longest column is; below 4px they stop shrinking and the strip
 * scrolls instead. Sizing-to-fit without a scrollbar is what made the overview
 * unusable at 1600px, so it is deliberately not done here.
 */
const cellHeight = computed(() => Math.min(9, Math.max(4, Math.floor(92 / maxRows.value) - 2)))

function slideTitle(route: SlideRoute) {
  return route.meta.slide?.title || `Slide ${route.no}`
}

function columnTitle(col: SlideRoute[], index: number) {
  for (const route of col) {
    const title = route.meta.slide?.title
    if (title)
      return title
  }
  return `Column ${index + 1}`
}

const columns = computed(() => gridColumns.value.map((col, index) => ({
  index,
  title: columnTitle(col, index),
  isCurrent: col.some(r => r.no === currentSlideNo.value),
  rows: col,
})))

/**
 * Slidev disables every keyboard shortcut while a `<button>` or `<a>` holds
 * focus (`isOnFocus` in `state/storage.ts` gates `registerShortcuts`). A click
 * on a map cell would therefore silently kill space, the arrows, `o` and `?`
 * until you clicked somewhere else. Hand focus back to the document after
 * navigating; the cells stay tabbable and Enter still activates them.
 */
function goTo(no: number, event: MouseEvent) {
  (event.currentTarget as HTMLElement | null)?.blur()
  return go(no)
}

const readout = computed(() => {
  const route = slides.value[currentSlideNo.value - 1]
  const col = (route?.meta.slide?.gridCol ?? 0) + 1
  const row = (route?.meta.slide?.gridRow ?? 0) + 1
  return `${col}.${row}`
})
</script>

<template>
  <div class="deck-minimap border-b border-main">
    <div class="deck-minimap-bar">
      <button
        class="deck-minimap-toggle"
        :title="expanded ? 'Hide the deck map' : 'Show the deck map'"
        @click="expanded = !expanded"
      >
        <div :class="expanded ? 'i-carbon:chevron-up' : 'i-carbon:chevron-down'" />
        <span>Map</span>
      </button>
      <div class="deck-minimap-readout">
        {{ readout }}
        <span class="op50">· slide {{ currentSlideNo }} / {{ slides.length }}</span>
      </div>
    </div>
    <div v-if="expanded" class="deck-minimap-scroll">
      <div class="deck-minimap-cols">
        <div
          v-for="col of columns"
          :key="col.index"
          class="deck-minimap-col"
          :class="col.isCurrent ? 'is-current' : ''"
        >
          <div class="deck-minimap-head" :title="col.title">
            <span class="deck-minimap-index">{{ col.index + 1 }}</span>
            <span class="deck-minimap-title">{{ col.title }}</span>
          </div>
          <div class="deck-minimap-cells">
            <button
              v-for="(route, row) of col.rows"
              :key="route.no"
              class="deck-minimap-cell"
              :class="[
                route.no === currentSlideNo ? 'is-current' : '',
                route.no < currentSlideNo ? 'is-done' : '',
              ]"
              :style="{ height: `${cellHeight}px` }"
              :title="`${col.index + 1}.${row + 1} — ${slideTitle(route)} (slide ${route.no})`"
              @click="goTo(route.no, $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.deck-minimap {
  /* Same palette hooks as DeckProgressBar: the theme's accent, and a track
     mixed out of the current text colour so no palette token is needed. */
  --deck-map-accent: var(--slidev-theme-primary, #4d9bf5);
  --deck-map-track: color-mix(in srgb, currentcolor 32%, transparent);

  user-select: none;
}

.deck-minimap-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 8px;
  font-size: 11px;
  line-height: 1.4;
}

.deck-minimap-toggle {
  display: flex;
  align-items: center;
  gap: 3px;
  opacity: 0.6;
  cursor: pointer;
}

.deck-minimap-toggle:hover {
  opacity: 1;
}

.deck-minimap-readout {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}

/* Overflow rather than squash: at a narrow presenter width the map scrolls
   sideways, it never shrinks columns into unreadable slivers. */
.deck-minimap-scroll {
  max-height: 34vh;
  overflow: auto;
  padding: 0 8px 6px;
}

.deck-minimap-cols {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.deck-minimap-col {
  flex: 1 1 0;
  min-width: 84px;
  border-top: 2px solid var(--deck-map-track);
  padding-top: 3px;
}

.deck-minimap-col.is-current {
  border-top-color: var(--deck-map-accent);
}

.deck-minimap-head {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 10px;
  line-height: 1.3;
  margin-bottom: 3px;
  opacity: 0.55;
}

.deck-minimap-col.is-current .deck-minimap-head {
  opacity: 1;
}

.deck-minimap-index {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.deck-minimap-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deck-minimap-cells {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.deck-minimap-cell {
  width: 100%;
  border-radius: 1px;
  background: var(--deck-map-track);
  cursor: pointer;
  transition:
    background-color 120ms ease-out,
    box-shadow 120ms ease-out;
}

/* Visited rows are a dimmed accent rather than a second shade of grey: two
   greys 16 percentage points apart were indistinguishable on screen. */
.deck-minimap-cell.is-done {
  background: var(--deck-map-accent);
  background: color-mix(in srgb, var(--deck-map-accent) 55%, transparent);
}

.deck-minimap-cell.is-current {
  background: var(--deck-map-accent);
  box-shadow: 0 0 0 2px var(--deck-map-accent);
}

.deck-minimap-cell:hover {
  box-shadow: 0 0 0 2px var(--deck-map-accent);
}
</style>

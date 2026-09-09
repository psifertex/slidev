<script setup lang="ts">
import type { ClicksContext } from '@slidev/types'
import { computed } from 'vue'
import { useNav } from '../composables/useNav'

/**
 * Column-proportional progress bar.
 *
 * One segment per grid column (topic), each sized in proportion to the number
 * of slides in that column. That keeps the *rate* constant: every slide moves
 * the bar by the same amount, wherever you are, while the gaps between
 * segments still show where each topic starts and ends. Equal-width-per-column
 * was rejected because a deck's columns can hold anything from 1 to 9 slides,
 * so equal segments would put the bar at the halfway mark with two thirds of
 * the slides still to come.
 *
 * Only the *current* column is broken into its individual slides. Drawing all
 * 50-odd cells of a long deck turns the bar into a hairline lattice at
 * projector distance, which is the failure mode of the stock
 * `CurrentProgressBar`; drawing one column keeps "row 3 of 8" readable without
 * the noise.
 *
 * A deck with no `--` separators has one slide per column, so this degrades to
 * a plain per-slide progress bar with no special case.
 */
const props = withDefaults(
  defineProps<{
    /** Overrides the live clicks context; used by the notes viewer. */
    clicksContext?: ClicksContext
    /** Overrides the live slide number; used by the notes viewer. */
    current?: number
    /** Thickness of an inactive segment, in px. */
    height?: number
  }>(),
  { height: 6 },
)

const nav = useNav()
const clicksContext = computed(() => props.clicksContext ?? nav.clicksContext.value)
const current = computed(() => props.current ?? nav.currentSlideNo.value)
const { gridColumns, total } = nav

/** The current column stands proud of the rest so the live topic reads at a glance. */
const activeHeight = computed(() => Math.max(props.height + 2, Math.round(props.height * 1.7)))

/**
 * Progress measured in slides, so the bar moves at one unit per slide no
 * matter which column it is in. The fractional part is the click progress
 * within the current slide, which keeps the motion smooth through a build.
 */
const progress = computed(() => {
  const ctx = clicksContext.value
  const clickFraction = ctx && ctx.total > 0 ? ctx.current / (ctx.total + 1) : 0
  return (current.value - 1) + clickFraction
})

const segments = computed(() => {
  let start = 0
  return gridColumns.value.map((col, index) => {
    const size = col.length
    const offset = start
    const isCurrent = current.value > start && current.value <= start + size
    start += size
    return {
      index,
      size,
      isCurrent,
      /** Whole-segment fill, used for every column but the live one. */
      fill: Math.min(Math.max((progress.value - offset) / size, 0), 1),
      /** Per-slide fill inside the live column. */
      cells: isCurrent
        ? col.map((_, row) => Math.min(Math.max(progress.value - offset - row, 0), 1))
        : [],
    }
  })
})
</script>

<template>
  <div
    class="deck-progress-bar"
    :style="{ height: `${activeHeight}px` }"
    role="progressbar"
    :aria-valuemin="1"
    :aria-valuemax="total"
    :aria-valuenow="current"
  >
    <div
      v-for="seg of segments"
      :key="seg.index"
      class="deck-progress-seg"
      :class="seg.isCurrent ? 'is-current' : ''"
      :style="{
        flexGrow: seg.size,
        height: `${seg.isCurrent ? activeHeight : height}px`,
      }"
      :title="`Column ${seg.index + 1} — ${seg.size} slide${seg.size === 1 ? '' : 's'}`"
    >
      <!-- The live column is real sub-cells with a gap, not a gradient overlay:
           the gap then shows whatever is behind the bar, so nothing here has to
           know the background colour. -->
      <template v-if="seg.isCurrent && seg.size > 1">
        <div v-for="(cellFill, row) of seg.cells" :key="row" class="deck-progress-cell">
          <div class="deck-progress-fill" :style="{ width: `${cellFill * 100}%` }" />
        </div>
      </template>
      <div v-else class="deck-progress-fill" :style="{ width: `${seg.fill * 100}%` }" />
    </div>
  </div>
</template>

<style scoped>
.deck-progress-bar {
  /* Inherit the deck's colours rather than hardcoding any. `--slidev-theme-primary`
     is what a theme sets as its accent - brand red in this deck's theme, which
     is a mark/rule colour and is never used here for text. The track is drawn
     from the text colour so it works in both schemes without a palette. */
  color: var(--slidev-controls-foreground, currentcolor);

  --deck-progress-accent: var(--slidev-theme-primary, #4d9bf5);
  /* The empty track has to survive a washed-out projector, so it is a good deal
     stronger than a hairline border. */
  --deck-progress-track: color-mix(in srgb, currentcolor 32%, transparent);
  --deck-progress-track-current: color-mix(in srgb, currentcolor 46%, transparent);

  display: flex;
  align-items: flex-end;
  gap: 3px;
  width: 100%;
  user-select: none;
}

.deck-progress-seg {
  display: flex;
  gap: 2px;
  flex-basis: 0;
  min-width: 0;
  overflow: hidden;
  background: var(--deck-progress-track);
  transition:
    height 150ms ease-out,
    background-color 150ms ease-out;
}

.deck-progress-seg.is-current {
  background: transparent;
}

.deck-progress-cell {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  background: var(--deck-progress-track-current);
}

.deck-progress-fill {
  height: 100%;
  background: var(--deck-progress-accent);
  /* Completed topics recede a little; the live one is at full strength. Not
     further than this - a dimmed accent on a dark ground disappears across a
     big room. */
  opacity: 0.62;
  transition:
    width 150ms ease-out,
    opacity 150ms ease-out;
}

.is-current .deck-progress-fill {
  opacity: 1;
}
</style>

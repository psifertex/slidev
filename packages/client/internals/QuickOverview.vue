<script setup lang="ts">
import type { SlideRoute } from '@slidev/types'
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import { createFixedClicks } from '../composables/useClicks'
import { useNav } from '../composables/useNav'
import { CLICKS_MAX } from '../constants'
import { pathPrefix } from '../env'
import { currentOverviewPage, overviewRowCount } from '../logic/overview'
import { isScreenshotSupported } from '../logic/screenshot'
import { snapshotManager } from '../logic/snapshot'
import { breakpoints, showOverview, windowSize } from '../state'
import DrawingPreview from './DrawingPreview.vue'
import IconButton from './IconButton.vue'
import SlideContainer from './SlideContainer.vue'
import SlideWrapper from './SlideWrapper.vue'

const nav = useNav()
const { currentSlideNo, go: goSlide, slides, hasGrid } = nav

const numCols = computed(() => {
  if (!hasGrid.value)
    return 1
  return (slides.value[slides.value.length - 1]?.meta.slide?.gridCol ?? 0) + 1
})

/** Number of rows in the tallest column, for the reveal.js-style `h.v` label. */
const rowsPerCol = computed(() => {
  const counts = new Map<number, number>()
  for (const route of slides.value) {
    const col = route.meta.slide?.gridCol ?? 0
    counts.set(col, (counts.get(col) ?? 0) + 1)
  }
  return counts
})

/**
 * reveal.js' slide number: 1-based `h.v`, with the `.v` dropped for a column
 * that is not a stack (`slidenumber.js`, SLIDE_NUMBER_FORMAT_HORIZONTAL_DOT_VERTICAL).
 */
function gridLabel(route: SlideRoute) {
  const col = route.meta.slide?.gridCol ?? 0
  const row = route.meta.slide?.gridRow ?? 0
  return (rowsPerCol.value.get(col) ?? 1) > 1 ? `${col + 1}.${row + 1}` : `${col + 1}`
}

function close() {
  showOverview.value = false
}

function go(page: number) {
  goSlide(page)
  close()
}

function focus(page: number) {
  if (page === currentOverviewPage.value)
    return true
  return false
}

const xs = breakpoints.smaller('xs')
const sm = breakpoints.smaller('sm')

const padding = 4 * 16 * 2
const gap = 2 * 16
// Cards keep their full, readable size in grid mode too. reveal.js' overview
// (`js/controllers/overview.js` `layout()`) lays the grid out at a fixed scale
// and translates the *viewport* to the current cell - it never shrinks to fit.
// A ten-column deck is wider than the window and that is the point: you scroll
// around a large map. Scaling to fit would only get worse as columns are added.
const cardWidth = computed(() => {
  if (xs.value)
    return windowSize.width.value - padding
  else if (sm.value)
    return (windowSize.width.value - padding - gap) / 2
  return 300
})

const rowCount = computed(() => {
  return Math.floor((windowSize.width.value - padding) / (cardWidth.value + gap))
})

// Keep the current card in view while the arrow keys drive the deck. reveal.js
// centres the current cell rather than doing the minimum scroll; the browser
// clamps to the scroll range at the edges, so the first and last column/row sit
// flush instead of leaving dead space.
const scroller = ref<HTMLElement | null>(null)
function revealCurrentCard(smooth = true) {
  nextTick(() => {
    scroller.value
      ?.querySelector('[data-current="true"]')
      ?.scrollIntoView({ block: 'center', inline: 'center', behavior: smooth ? 'smooth' : 'auto' })
  })
}
watch(showOverview, (open) => {
  // Jump straight to the current card when opening; animating from 0,0 while
  // the overlay is still fading in just looks like a glitch.
  if (open)
    revealCurrentCard(false)
})
watch(currentSlideNo, () => {
  if (showOverview.value)
    revealCurrentCard(true)
})
// A resize re-lays out the grid, which would otherwise leave the current card
// wherever the old scroll offset happened to point.
watch(() => [windowSize.width.value, windowSize.height.value], () => {
  if (showOverview.value)
    revealCurrentCard(false)
})

const keyboardBuffer = ref<string>('')

async function captureSlidesOverview() {
  showOverview.value = false
  await snapshotManager.startCapturing(nav)
  showOverview.value = true
}

useEventListener('keypress', (e) => {
  if (!showOverview.value) {
    keyboardBuffer.value = ''
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    if (keyboardBuffer.value) {
      go(+keyboardBuffer.value)
      keyboardBuffer.value = ''
    }
    else {
      go(currentOverviewPage.value)
    }
    return
  }
  const num = Number.parseInt(e.key.replace(/\D/g, ''))
  if (Number.isNaN(num)) {
    keyboardBuffer.value = ''
    return
  }
  if (!keyboardBuffer.value && num === 0)
    return

  keyboardBuffer.value += String(num)

  // beyond the number of slides, reset
  if (+keyboardBuffer.value > slides.value.length) {
    keyboardBuffer.value = ''
    return
  }

  const extactMatch = slides.value.findIndex(i => `/${i.no}` === keyboardBuffer.value)
  if (extactMatch !== -1)
    currentOverviewPage.value = extactMatch + 1

  // When the input number is the largest at the number of digits, we go to that page directly.
  if (+keyboardBuffer.value * 10 > slides.value.length) {
    go(+keyboardBuffer.value)
    keyboardBuffer.value = ''
  }
})

watchEffect(() => {
  // Watch currentPage, make sure every time we open overview,
  // we focus on the right page.
  currentOverviewPage.value = currentSlideNo.value
  // Watch rowCount, make sure up and down shortcut work correctly.
  overviewRowCount.value = rowCount.value
})
</script>

<template>
  <Transition
    enter-active-class="duration-150 ease-out"
    enter-from-class="opacity-0 scale-102 !backdrop-blur-0px"
    leave-active-class="duration-200 ease-in"
    leave-to-class="opacity-0 scale-102 !backdrop-blur-0px"
  >
    <div
      v-if="showOverview"
      ref="scroller"
      class="fixed left-0 right-0 top-0 h-[calc(var(--vh,1vh)*100)] z-modal bg-main !bg-opacity-75 backdrop-blur-5px select-none"
      :class="hasGrid ? 'p-8 py-10 overflow-auto' : 'p-16 py-20 overflow-y-auto'"
      @click="close"
    >
      <div
        class="grid"
        :class="hasGrid ? 'gap-y-6 gap-x-4 items-start' : 'gap-y-4 gap-x-8 w-full'"
        :style="hasGrid
          ? `grid-template-columns: repeat(${numCols}, ${cardWidth}px)`
          : `grid-template-columns: repeat(auto-fit,minmax(${cardWidth}px,1fr))`"
      >
        <div
          v-for="(route, idx) of slides"
          :key="route.no"
          class="relative"
          :style="hasGrid ? { gridColumn: (route.meta.slide?.gridCol ?? 0) + 1, gridRow: (route.meta.slide?.gridRow ?? 0) + 1 } : undefined"
        >
          <div
            class="inline-block border rounded overflow-hidden bg-main hover:border-primary transition"
            :class="(focus(idx + 1) || currentOverviewPage === idx + 1) ? 'border-primary ring-2 ring-primary' : 'border-main'"
            :data-current="hasGrid && route.no === currentSlideNo ? 'true' : undefined"
            @click="go(route.no)"
          >
            <SlideContainer
              :key="route.no"
              :no="route.no"
              :use-snapshot="true"
              :width="cardWidth"
              class="pointer-events-none"
            >
              <SlideWrapper
                :clicks-context="createFixedClicks(route, CLICKS_MAX)"
                :route="route"
                render-context="overview"
              />
              <DrawingPreview :page="route.no" />
            </SlideContainer>
          </div>
          <!-- In grid mode the number goes *under* the card: an absolutely
               positioned label at `cardWidth + 5px` would sit on top of the
               next column. -->
          <div
            v-if="hasGrid"
            class="flex justify-between text-xs leading-none mt-1 tabular-nums"
          >
            <span class="opacity-60 font-bold">{{ gridLabel(route) }}</span>
            <template v-if="keyboardBuffer && String(idx + 1).startsWith(keyboardBuffer)">
              <span><span class="text-green font-bold">{{ keyboardBuffer }}</span><span class="opacity-50">{{ String(idx + 1).slice(keyboardBuffer.length) }}</span></span>
            </template>
            <span v-else class="opacity-40">{{ idx + 1 }}</span>
          </div>
          <div
            v-else
            class="absolute top-0"
            :style="`left: ${cardWidth + 5}px`"
          >
            <template v-if="keyboardBuffer && String(idx + 1).startsWith(keyboardBuffer)">
              <span class="text-green font-bold">{{ keyboardBuffer }}</span>
              <span class="opacity-50">{{ String(idx + 1).slice(keyboardBuffer.length) }}</span>
            </template>
            <span v-else class="opacity-50">
              {{ idx + 1 }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </Transition>
  <div
    v-show="showOverview"
    class="fixed top-4 right-4 z-modal text-gray-400 flex flex-col items-center gap-2"
  >
    <IconButton title="Close" class="text-2xl" @click="close">
      <div class="i-carbon:close" />
    </IconButton>
    <IconButton
      v-if="__SLIDEV_FEATURE_PRESENTER__"
      as="a"
      title="Slides Overview"
      target="_blank"
      :href="`${pathPrefix}overview`"
      tab-index="-1"
      class="text-2xl"
    >
      <div class="i-carbon:list-boxes" />
    </IconButton>
    <IconButton
      v-if="__DEV__ && isScreenshotSupported"
      title="Capture slides as images"
      class="text-2xl"
      @click="captureSlidesOverview"
    >
      <div class="i-carbon:drop-photo" />
    </IconButton>
  </div>
</template>

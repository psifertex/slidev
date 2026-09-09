import type { ClicksContext, SlideRoute, TocItem } from '@slidev/types'
import type { ComputedRef, Ref, TransitionGroupProps, WritableComputedRef } from 'vue'
import type { RouteLocationNormalized, Router } from 'vue-router'
import { clamp } from '@antfu/utils'
import { parseRangeString } from '@slidev/parser/utils'
import { createSharedComposable, injectLocal } from '@vueuse/core'
import { computed, hasInjectionContext, ref, toRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { slides } from '#slidev/slides'
import { CLICKS_MAX, injectionSlidevContext } from '../constants'
import { configs } from '../env'
import { useRouteQuery } from '../logic/route'
import { getSlide, getSlidePath } from '../logic/slides'
import { getCurrentTransition } from '../logic/transition'
import { hmrSkipTransition, showOverview } from '../state'
import { createClicksContextBase } from './useClicks'
import { useTocTree } from './useTocTree'

export interface SlidevContextNav {
  slides: Ref<SlideRoute[]>
  total: ComputedRef<number>

  currentPath: ComputedRef<string>
  currentPage: ComputedRef<number>
  currentSlideNo: ComputedRef<number>
  currentSlideRoute: ComputedRef<SlideRoute>
  currentTransition: ComputedRef<TransitionGroupProps | undefined>
  currentLayout: ComputedRef<string>
  currentFrontmatter: ComputedRef<Record<string, any>>

  nextRoute: ComputedRef<SlideRoute>
  prevRoute: ComputedRef<SlideRoute>
  hasNext: ComputedRef<boolean>
  hasPrev: ComputedRef<boolean>

  clicksContext: ComputedRef<ClicksContext>
  clicks: ComputedRef<number>
  clicksStart: ComputedRef<number>
  clicksTotal: ComputedRef<number>

  /** Whether the presentation uses a 2D grid layout (any slide has `nested: true`) */
  hasGrid: ComputedRef<boolean>
  /** Current column index in the 2D grid (0-indexed) */
  currentGridCol: ComputedRef<number>
  /** Current row index in the 2D grid (0-indexed) */
  currentGridRow: ComputedRef<number>
  /**
   * The deck grouped by grid column, each inner array ordered by row.
   * Without any `--` separator every slide is its own single-row column, so
   * consumers get a flat list rather than an empty one.
   */
  gridColumns: ComputedRef<SlideRoute[][]>

  /** The table of content tree */
  tocTree: ComputedRef<TocItem[]>
  /** The direction of the navigation, 1 for forward, -1 for backward */
  navDirection: Ref<number>
  /** The direction of the clicks, 1 for forward, -1 for backward */
  clicksDirection: Ref<number>
  /** Utility function for open file in editor, only avaible in dev mode  */
  openInEditor: (url?: string) => Promise<boolean>

  /** Go to next click */
  next: () => Promise<void>
  /** Go to previous click */
  prev: () => Promise<void>
  /** Go to next slide */
  nextSlide: (lastClicks?: boolean) => Promise<void>
  /** Go to previous slide */
  prevSlide: (lastClicks?: boolean) => Promise<void>
  /** Go to slide */
  go: (no: number | string, clicks?: number, force?: boolean) => Promise<void>
  /** Go to the first slide */
  goFirst: () => Promise<void>
  /** Go to the last slide */
  goLast: () => Promise<void>
  /** Grid: the next slide in the reveal.js `navigateNext` order (clicks, then down, then over) */
  gridNext: () => Promise<void>
  /** Grid: the reverse of `gridNext` (clicks, then up, then the bottom of the previous column) */
  gridPrev: () => Promise<void>
  /** Grid: the very first slide, clearing every column's remembered row */
  goGridFirst: () => Promise<void>
  /** Grid: the last column, at its remembered row */
  goGridLast: () => Promise<void>
  /** Go to the previous column in the 2D grid (no-op when not in grid mode) */
  goLeft: () => Promise<void>
  /** Go to the next column in the 2D grid (no-op when not in grid mode) */
  goRight: () => Promise<void>
  /** Go to the previous row in the current column (no-op when not in grid mode) */
  goUp: () => Promise<void>
  /** Go to the next row in the current column (no-op when not in grid mode) */
  goDown: () => Promise<void>

  /** Enter presenter mode */
  enterPresenter: () => void
  /** Exit presenter mode */
  exitPresenter: () => void
}

export interface SlidevContextNavState {
  router: Router
  currentRoute: ComputedRef<RouteLocationNormalized>
  isPrintMode: ComputedRef<boolean>
  isPrintWithClicks: Ref<boolean>
  isEmbedded: ComputedRef<boolean>
  isPlaying: ComputedRef<boolean>
  isPresenter: ComputedRef<boolean>
  isNotesViewer: ComputedRef<boolean>
  isPresenterAvailable: ComputedRef<boolean>
  hasPrimarySlide: ComputedRef<boolean>
  currentSlideNo: ComputedRef<number>
  currentSlideRoute: ComputedRef<SlideRoute>
  clicksContext: ComputedRef<ClicksContext>
  queryClicksRaw: Ref<string>
  queryClicks: WritableComputedRef<number>
  printRange: Ref<number[]>
  getPrimaryClicks: (route: SlideRoute) => ClicksContext
}

export interface SlidevContextNavFull extends SlidevContextNav, SlidevContextNavState { }

/**
 * Per-column memory of the row we were last on - reveal.js' `data-previous-indexv`.
 * Module-scoped so the main view and the presenter view agree.
 */
const rememberedGridRow = new Map<number, number>()

export function useNavBase(
  currentSlideRoute: ComputedRef<SlideRoute>,
  clicksContext: ComputedRef<ClicksContext>,
  queryClicks: Ref<number> = ref(0),
  isPresenter: Ref<boolean>,
  isPrint: Ref<boolean>,
  router?: Router,
): SlidevContextNav {
  const total = computed(() => slides.value.length)

  const navDirection = ref(0)
  const clicksDirection = ref(0)

  const currentPath = computed(() => getSlidePath(currentSlideRoute.value, isPresenter.value))
  const currentSlideNo = computed(() => currentSlideRoute.value.no)
  const currentLayout = computed(() => currentSlideRoute.value.meta?.layout || (currentSlideNo.value === 1 ? 'cover' : 'default'))
  const currentFrontmatter = computed(() => currentSlideRoute.value.meta.slide.frontmatter)

  const hasGrid = computed(() => slides.value.some(s => (s.meta.slide?.gridRow ?? 0) > 0))
  const currentGridCol = computed(() => currentSlideRoute.value.meta.slide?.gridCol ?? 0)
  const currentGridRow = computed(() => currentSlideRoute.value.meta.slide?.gridRow ?? 0)

  // Slides grouped by grid column, each inner array ordered by row.
  const gridColumns = computed<SlideRoute[][]>(() => {
    const cols: SlideRoute[][] = []
    for (const route of slides.value) {
      const col = route.meta.slide?.gridCol ?? 0
      ;(cols[col] ??= []).push(route)
    }
    return cols
  })

  function gridRowCount(col: number) {
    return gridColumns.value[col]?.length ?? 0
  }

  function gridAt(col: number, row: number) {
    return gridColumns.value[col]?.[row]
  }

  /**
   * reveal.js' `data-previous-indexv`: the row we were last on in each column.
   * `slide()` writes it when leaving a stack and reads it back when a
   * horizontal move passes an `undefined` vertical index, which is what makes
   * left/right return you to where you were rather than to the top.
   * Landing on the very first slide clears it, as reveal.js does at 0/0.
   */
  function gridEntryRow(col: number) {
    const n = gridRowCount(col)
    if (n === 0)
      return 0
    return Math.min(Math.max(rememberedGridRow.get(col) ?? 0, 0), n - 1)
  }

  watch([currentGridCol, currentGridRow], ([col, row], [prevCol, prevRow]) => {
    if (prevCol !== undefined && prevCol !== col)
      rememberedGridRow.set(prevCol, prevRow)
    if (col === 0 && row === 0)
      rememberedGridRow.clear()
  })

  const clicks = computed(() => clicksContext.value.current)
  const clicksStart = computed(() => clicksContext.value.clicksStart)
  const clicksTotal = computed(() => clicksContext.value.total)
  const nextRoute = computed(() => slides.value[Math.min(slides.value.length, currentSlideNo.value + 1) - 1])
  const prevRoute = computed(() => slides.value[Math.max(1, currentSlideNo.value - 1) - 1])
  const hasNext = computed(() => currentSlideNo.value < slides.value.length || clicks.value < clicksTotal.value)
  const hasPrev = computed(() => currentSlideNo.value > 1 || clicks.value > 0)

  const currentTransition = computed(() => isPrint.value ? undefined : getCurrentTransition(navDirection.value, currentSlideRoute.value, prevRoute.value))

  watch(currentSlideRoute, (next, prev) => {
    navDirection.value = next.no - prev.no
  })

  async function openInEditor(url?: string) {
    if (!__DEV__)
      return false
    if (url == null) {
      const slide = currentSlideRoute.value?.meta?.slide
      if (!slide)
        return false
      url = `${slide.filepath}:${slide.start}`
    }
    await fetch(`/__open-in-editor?file=${encodeURIComponent(url)}`)
    return true
  }

  const tocTree = useTocTree(
    slides,
    currentSlideNo,
    currentSlideRoute,
  )

  async function next() {
    clicksDirection.value = 1
    if (clicksTotal.value <= queryClicks.value)
      await nextSlide()
    else
      queryClicks.value += 1
  }

  async function prev() {
    clicksDirection.value = -1
    if (queryClicks.value <= clicksStart.value)
      await prevSlide(true)
    else
      queryClicks.value -= 1
  }

  async function nextSlide(lastClicks = false) {
    clicksDirection.value = 1
    if (currentSlideNo.value < slides.value.length) {
      await go(
        currentSlideNo.value + 1,
        lastClicks && !isPrint.value ? CLICKS_MAX : undefined,
      )
    }
  }

  async function prevSlide(lastClicks = false) {
    clicksDirection.value = -1
    if (currentSlideNo.value > 1) {
      await go(
        currentSlideNo.value - 1,
        lastClicks && !isPrint.value ? CLICKS_MAX : undefined,
      )
    }
  }

  function goFirst() {
    return go(1)
  }

  function goLast() {
    return go(total.value)
  }

  async function goToGrid(col: number, row: number, backwards = false) {
    if (col < 0 || row < 0)
      return
    const target = gridAt(col, row)
    if (target)
      await go(target.no, backwards && !isPrint.value ? CLICKS_MAX : 0)
  }

  const hasNextClick = () => clicks.value < clicksTotal.value
  const hasPrevClick = () => clicks.value > clicksStart.value

  /** reveal.js `navigateLeft`: clicks first, then the previous column at its remembered row. */
  async function goLeft() {
    if (!hasGrid.value)
      return
    if (!showOverview.value && hasPrevClick())
      return prev()
    const col = currentGridCol.value - 1
    if (col < 0)
      return
    // While the overview is open reveal.js skips the remembered-index restore
    // and keeps the current row, clamped into the target column.
    const row = showOverview.value
      ? Math.min(currentGridRow.value, Math.max(gridRowCount(col) - 1, 0))
      : gridEntryRow(col)
    await goToGrid(col, row, true)
  }

  /** reveal.js `navigateRight`: clicks first, then the next column at its remembered row. */
  async function goRight() {
    if (!hasGrid.value)
      return
    if (!showOverview.value && hasNextClick())
      return next()
    const col = currentGridCol.value + 1
    if (col >= gridColumns.value.length)
      return
    const row = showOverview.value
      ? Math.min(currentGridRow.value, Math.max(gridRowCount(col) - 1, 0))
      : gridEntryRow(col)
    await goToGrid(col, row)
  }

  /** reveal.js `navigateUp`: clicks first, then one row up. Hard no-op at the top. */
  async function goUp() {
    if (!hasGrid.value)
      return
    if (!showOverview.value && hasPrevClick())
      return prev()
    await goToGrid(currentGridCol.value, currentGridRow.value - 1, true)
  }

  /** reveal.js `navigateDown`: clicks first, then one row down. Hard no-op at the bottom. */
  async function goDown() {
    if (!hasGrid.value)
      return
    if (!showOverview.value && hasNextClick())
      return next()
    await goToGrid(currentGridCol.value, currentGridRow.value + 1)
  }

  /** reveal.js `navigateNext`: clicks, then down the column, then over to the next one. */
  async function gridNext() {
    if (!hasGrid.value)
      return next()
    if (hasNextClick())
      return next()
    const col = currentGridCol.value
    const row = currentGridRow.value
    if (row + 1 < gridRowCount(col))
      return goToGrid(col, row + 1)
    const nextCol = col + 1
    if (nextCol >= gridColumns.value.length)
      return
    await goToGrid(nextCol, gridEntryRow(nextCol))
  }

  /**
   * reveal.js `navigatePrev`: clicks, then up, then the *bottom* of the
   * previous column. Deliberately not the mirror of `goLeft` - this is what
   * makes space / shift-space a reversible linear walk.
   */
  async function gridPrev() {
    if (!hasGrid.value)
      return prev()
    if (hasPrevClick())
      return prev()
    const col = currentGridCol.value
    const row = currentGridRow.value
    if (row > 0)
      return goToGrid(col, row - 1, true)
    const prevCol = col - 1
    if (prevCol < 0)
      return
    await goToGrid(prevCol, gridRowCount(prevCol) - 1, true)
  }

  /** reveal.js Shift+Left: the very first slide (which also clears the row memory). */
  async function goGridFirst() {
    await goToGrid(0, 0)
  }

  /** reveal.js Shift+Right: the last column, at its remembered row. */
  async function goGridLast() {
    const col = gridColumns.value.length - 1
    await goToGrid(col, gridEntryRow(col))
  }

  async function go(no: number | string, clicks: number = 0, force = false) {
    hmrSkipTransition.value = false
    const pageChanged = currentSlideNo.value !== no
    const clicksChanged = clicks !== queryClicks.value
    const meta = getSlide(no)?.meta
    const clicksStart = meta?.slide?.frontmatter.clicksStart ?? 0
    clicks = clamp(clicks, clicksStart, meta?.__clicksContext?.total ?? CLICKS_MAX)
    if (force || pageChanged || clicksChanged) {
      await router?.push({
        path: getSlidePath(no, isPresenter.value, router.currentRoute.value.name === 'export'),
        query: {
          ...router.currentRoute.value.query,
          clicks: clicks === 0 ? undefined : clicks.toString(),
          embedded: location.search.includes('embedded') ? 'true' : undefined,
        },
      })
    }
  }

  function enterPresenter() {
    router?.push({
      path: getSlidePath(currentSlideNo.value, true),
      query: { ...router.currentRoute.value.query },
    })
  }
  function exitPresenter() {
    router?.push({
      path: getSlidePath(currentSlideNo.value, false),
      query: { ...router.currentRoute.value.query },
    })
  }

  return {
    slides,
    total,
    currentPath,
    currentSlideNo,
    currentPage: currentSlideNo,
    currentSlideRoute,
    currentLayout,
    currentFrontmatter,
    currentTransition,
    clicksDirection,
    nextRoute,
    prevRoute,
    clicksContext,
    clicks,
    clicksStart,
    clicksTotal,
    hasNext,
    hasPrev,
    hasGrid,
    currentGridCol,
    currentGridRow,
    gridColumns,
    tocTree,
    navDirection,
    openInEditor,
    next,
    prev,
    go,
    goLast,
    goFirst,
    gridNext,
    gridPrev,
    goGridFirst,
    goGridLast,
    goLeft,
    goRight,
    goUp,
    goDown,
    nextSlide,
    prevSlide,
    enterPresenter,
    exitPresenter,
  }
}

export function useFixedNav(
  currentSlideRoute: SlideRoute,
  clicksContext: ClicksContext,
): SlidevContextNav {
  const noop = async () => { }
  return {
    ...useNavBase(
      computed(() => currentSlideRoute),
      computed(() => clicksContext),
      ref(CLICKS_MAX),
      ref(false),
      ref(false),
    ),
    next: noop,
    prev: noop,
    nextSlide: noop,
    prevSlide: noop,
    goFirst: noop,
    goLast: noop,
    go: noop,
    gridNext: noop,
    gridPrev: noop,
    goGridFirst: noop,
    goGridLast: noop,
    goLeft: noop,
    goRight: noop,
    goUp: noop,
    goDown: noop,
  }
}

const useNavState = createSharedComposable((): SlidevContextNavState => {
  const router = useRouter()
  const currentRoute = useRoute()

  const query = computed(() => {
    // eslint-disable-next-line ts/no-unused-expressions
    router?.currentRoute?.value?.query
    return new URLSearchParams(location.search)
  })
  const isPrintMode = computed(() => query.value.has('print') || currentRoute.name === 'export')
  const isPrintWithClicks = ref(query.value.get('print') === 'clicks')
  const isEmbedded = computed(() => query.value.has('embedded'))
  const isPlaying = computed(() => currentRoute.name === 'play')
  const isPresenter = computed(() => currentRoute.name === 'presenter')
  const isNotesViewer = computed(() => currentRoute.name === 'notes')
  const isPresenterAvailable = computed(() => !isPresenter.value && (!configs.remote || query.value.get('password') === configs.remote))
  const hasPrimarySlide = computed(() => !!currentRoute.params.no)
  const currentSlideNo = computed(() => hasPrimarySlide.value ? getSlide(currentRoute.params.no as string)?.no ?? 1 : 1)
  const currentSlideRoute = computed(() => slides.value[currentSlideNo.value - 1])
  const printRange = ref(parseRangeString(slides.value.length, currentRoute?.query?.range as string | undefined))

  const queryClicksRaw = useRouteQuery<string>('clicks', '0')

  const clicksContext = computed(() => getPrimaryClicks(currentSlideRoute.value))

  const queryClicks = computed({
    get() {
      let v = +(queryClicksRaw.value || 0)
      if (Number.isNaN(v))
        v = 0
      return v
    },
    set(v) {
      hmrSkipTransition.value = false
      queryClicksRaw.value = v.toString()
    },
  })

  function getPrimaryClicks(
    route: SlideRoute,
  ): ClicksContext {
    if (route?.meta?.__clicksContext)
      return route.meta.__clicksContext

    const thisNo = route.no
    const context = createClicksContextBase(
      computed({
        get() {
          if (currentSlideNo.value === thisNo)
            return Math.max(+(queryClicksRaw.value ?? 0), context.clicksStart)
          else if (currentSlideNo.value > thisNo)
            return CLICKS_MAX
          else
            return context.clicksStart
        },
        set(v) {
          if (currentSlideNo.value === thisNo)
            queryClicksRaw.value = v.toString()
        },
      }),
      route?.meta.slide?.frontmatter.clicksStart ?? 0,
      route?.meta.clicks,
    )

    if (route?.meta)
      route.meta.__clicksContext = context

    return context
  }

  return {
    router,
    currentRoute: computed(() => currentRoute),
    isPrintMode,
    isPrintWithClicks,
    isEmbedded,
    isPlaying,
    isPresenter,
    isNotesViewer,
    isPresenterAvailable,
    hasPrimarySlide,
    currentSlideNo,
    currentSlideRoute,
    clicksContext,
    queryClicksRaw,
    queryClicks,
    printRange,
    getPrimaryClicks,
  }
})

const useSharedNav = createSharedComposable((): SlidevContextNavFull => {
  const state = useNavState()
  const router = useRouter()

  const nav = useNavBase(
    state.currentSlideRoute,
    state.clicksContext,
    state.queryClicks,
    state.isPresenter,
    state.isPrintMode,
    router,
  )

  watch(
    [nav.total, state.currentRoute],
    async () => {
      const no = state.currentRoute.value.params.no as string
      if (state.hasPrimarySlide.value && !getSlide(no)) {
        if (no && no !== 'index.html') {
          // The current slide may has been removed. Redirect to the last slide.
          await nav.go(nav.total.value, 0, true)
        }
        else {
          // Redirect to the first slide
          await nav.go(1, 0, true)
        }
      }
    },
    { flush: 'pre', immediate: true },
  )

  return {
    ...nav,
    ...state,
  }
})

export function useNav(): SlidevContextNavFull {
  const nav = useSharedNav()
  // `useNav()` is also called outside of `setup()`, most notably from the
  // `mounted`/`created` hooks of the `v-motion` and `v-mark` directives.
  // `injectLocal` throws there, and there is no slide-local context to read
  // anyway, so fall back to the shared nav.
  const context = hasInjectionContext()
    ? injectLocal(injectionSlidevContext, undefined)
    : undefined
  if (!context)
    return nav

  const localNav = toRaw(context).nav as unknown as SlidevContextNav
  return {
    ...nav,
    ...localNav,
  }
}

import type { NavOperations, ShortcutOptions } from '@slidev/types'
import { and, not, or } from '@vueuse/math'
import setups from '#slidev/setups/shortcuts'
import { useDrawings } from '../composables/useDrawings'
import { useNav } from '../composables/useNav'
import { toggleDark } from '../logic/dark'
import { activeDragElement, magicKeys, showGotoDialog, showOverview, toggleOverview } from '../state'
import { downloadPDF } from '../utils'
import { currentOverviewPage, downOverviewPage, nextOverviewPage, prevOverviewPage, upOverviewPage } from './../logic/overview'

export default function setupShortcuts() {
  const { go, goFirst, goLast, next, nextSlide, prev, prevSlide, goLeft, goRight, goUp, goDown, gridNext, gridPrev, goGridFirst, goGridLast, hasGrid } = useNav()
  const { drawingEnabled } = useDrawings()
  const { escape, space, shift, left, right, up, down, enter, d, g, o, '`': backtick } = magicKeys

  const context: NavOperations = {
    next,
    prev,
    nextSlide,
    prevSlide,
    go,
    goFirst,
    goLast,
    goLeft,
    goRight,
    goUp,
    goDown,
    downloadPDF,
    toggleDark,
    toggleOverview,
    toggleDrawing: () => drawingEnabled.value = !drawingEnabled.value,
    escapeOverview: () => showOverview.value = false,
    showGotoDialog: () => showGotoDialog.value = !showGotoDialog.value,
  }

  // reveal.js' overview is a zoomed-out view of the deck, not a separate
  // cursor: the arrow keys keep navigating for real while it is open. So in
  // grid mode the arrow bindings stay live and the overview-only bindings go.

  // reveal.js binds escape to *toggle* the overview, where stock Slidev binds
  // it to hide-only - so on a normal slide it does nothing at all. Follow
  // reveal.js for a grid deck and leave a flat deck's behaviour alone.
  function onEscape() {
    if (hasGrid.value)
      toggleOverview()
    else
      showOverview.value = false
  }

  const navViaArrowKeys = and(or(hasGrid, not(showOverview)), not(activeDragElement))
  const overviewOnly = and(showOverview, not(hasGrid))

  // Grid decks follow reveal.js exactly (reveal.js 5.1.0 `js/reveal.js`):
  //   space / pagedown -> navigateNext : clicks, then down the column, then over
  //   shift-space / pageup -> navigatePrev : clicks, then up, then the *bottom*
  //                                          of the previous column
  //   right / left -> navigateRight / navigateLeft : clicks, then the next or
  //                   previous column at the row you last left it on
  //   down / up    -> navigateDown / navigateUp : one row, never crossing a column
  //   shift-right / shift-left -> last column / very first slide
  // A deck with no `--` at all keeps stock Slidev behaviour on every key.
  let shortcuts: ShortcutOptions[] = [
    { name: 'next_space', key: and(space, not(shift)), fn: () => hasGrid.value ? (showOverview.value = false, gridNext()) : next(), autoRepeat: true },
    { name: 'prev_space', key: and(space, shift), fn: () => hasGrid.value ? (showOverview.value = false, gridPrev()) : prev(), autoRepeat: true },
    { name: 'next_right', key: and(right, not(shift), navViaArrowKeys), fn: () => hasGrid.value ? goRight() : next(), autoRepeat: true },
    { name: 'prev_left', key: and(left, not(shift), navViaArrowKeys), fn: () => hasGrid.value ? goLeft() : prev(), autoRepeat: true },
    { name: 'next_page_key', key: 'pageDown', fn: () => hasGrid.value ? gridNext() : next(), autoRepeat: true },
    { name: 'prev_page_key', key: 'pageUp', fn: () => hasGrid.value ? gridPrev() : prev(), autoRepeat: true },
    { name: 'next_down', key: and(down, navViaArrowKeys), fn: () => hasGrid.value ? goDown() : nextSlide(), autoRepeat: true },
    { name: 'prev_up', key: and(up, navViaArrowKeys), fn: () => hasGrid.value ? goUp() : prevSlide(), autoRepeat: true },
    { name: 'next_shift', key: and(right, shift), fn: () => hasGrid.value ? goGridLast() : nextSlide(), autoRepeat: true },
    { name: 'prev_shift', key: and(left, shift), fn: () => hasGrid.value ? goGridFirst() : prevSlide(), autoRepeat: true },
    { name: 'toggle_dark', key: and(d, not(drawingEnabled)), fn: toggleDark },
    { name: 'toggle_overview', key: and(or(o, backtick), not(drawingEnabled)), fn: toggleOverview },
    { name: 'hide_overview', key: and(escape, not(drawingEnabled)), fn: onEscape },
    { name: 'goto', key: and(g, not(drawingEnabled)), fn: () => showGotoDialog.value = !showGotoDialog.value },
    { name: 'next_overview', key: and(right, overviewOnly), fn: nextOverviewPage },
    { name: 'prev_overview', key: and(left, overviewOnly), fn: prevOverviewPage },
    { name: 'up_overview', key: and(up, overviewOnly), fn: upOverviewPage },
    { name: 'down_overview', key: and(down, overviewOnly), fn: downOverviewPage },
    {
      name: 'goto_from_overview',
      key: and(enter, showOverview),
      fn: () => {
        // In grid mode the highlight *is* the current slide, so enter only closes.
        if (!hasGrid.value)
          go(currentOverviewPage.value)
        showOverview.value = false
      },
    },
  ]

  const baseShortcutNames = new Set(shortcuts.map(s => s.name))

  for (const setup of setups) {
    shortcuts = setup(context, shortcuts)
  }

  const remainingBaseShortcutNames = shortcuts.filter(s => s.name && baseShortcutNames.has(s.name))
  if (remainingBaseShortcutNames.length === 0) {
    const message = [
      '========== WARNING ==========',
      'defineShortcutsSetup did not return any of the base shortcuts.',
      'See https://sli.dev/custom/config-shortcuts.html for migration.',
      'If it is intentional, return at least one shortcut with one of the base names (e.g. name:"goto").',
    ].join('\n\n')
    // eslint-disable-next-line no-alert
    alert(message)

    console.warn(message)
  }

  return shortcuts
}

import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { useNav } from '../composables/useNav'
import { configs } from '../env'

/**
 * Should the presentation (not the presenter) carry the progress bar right now?
 *
 * Headmatter:
 *   progressBar: true | false | 'auto'   (default 'auto' - on iff the deck has a 2D grid)
 *   progressBarHideLayouts: [ ... ]      (layouts that own the whole canvas)
 *
 * Per-slide frontmatter:
 *   progressBar: false                   hide it here
 *   progressBar: true                    show it here even on a hidden layout
 *
 * The default hide-list follows the precedent a theme's `slide-bottom.vue`
 * already sets: a full-bleed cover, statement or image slide takes no footer,
 * and it should take no bar either. A theme with its own full-bleed layouts
 * adds them to `progressBarHideLayouts` in the deck's headmatter.
 */
export function useDeckProgressBarVisible(): ComputedRef<boolean> {
  const { hasGrid, currentLayout, currentFrontmatter, isPrintMode } = useNav()

  const enabled = computed(() => {
    const setting = configs.progressBar
    return setting === 'auto' || setting == null ? hasGrid.value : !!setting
  })

  const hideLayouts = computed(() => new Set(configs.progressBarHideLayouts ?? []))

  return computed(() => {
    if (!enabled.value || isPrintMode.value)
      return false
    const override = currentFrontmatter.value?.progressBar
    if (typeof override === 'boolean')
      return override
    return !hideLayouts.value.has(String(currentLayout.value ?? ''))
  })
}

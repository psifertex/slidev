import { ref } from 'vue'

/**
 * Names of the shortcuts that are actually registered, in registration order.
 * `registerShortcuts()` fills this in from the live table (after addon setups
 * have had their turn), so the `?` help overlay can never list a binding that
 * no longer exists.
 */
export const activeShortcutNames = ref<string[]>([])

export interface ShortcutHelpRow {
  /** Key caps to render, in order. */
  keys: string[]
  /** What the binding does. */
  description: string
  /**
   * What it does in a deck that uses the 2D grid (`--` nested slides), when
   * that differs from `description`. See `composables/useNav.ts`.
   */
  grid?: string
}

/**
 * Descriptions for the shortcut names defined in `setup/shortcuts.ts`. Only
 * names present in `activeShortcutNames` are rendered, so this map may safely
 * describe more than a given build registers - but it can never invent a row.
 */
export const shortcutHelp: Record<string, ShortcutHelpRow> = {
  next_space: { keys: ['space'], description: 'Next build, then next slide', grid: 'Next build, then down the column, then on to the next column' },
  prev_space: { keys: ['shift', 'space'], description: 'Previous build, then previous slide', grid: 'The exact reverse: up the column, then the bottom of the previous one' },
  next_page_key: { keys: ['page down'], description: 'Same as space' },
  prev_page_key: { keys: ['page up'], description: 'Same as shift + space' },
  next_right: { keys: ['→'], description: 'Next build, then next slide', grid: 'Next column (topic), at the row you last left it on' },
  prev_left: { keys: ['←'], description: 'Previous build, then previous slide', grid: 'Previous column, at the row you last left it on' },
  next_down: { keys: ['↓'], description: 'Next slide', grid: 'Next row in this column. Stops at the bottom' },
  prev_up: { keys: ['↑'], description: 'Previous slide', grid: 'Previous row in this column. Stops at the top' },
  next_shift: { keys: ['shift', '→'], description: 'Next slide, skipping builds', grid: 'Jump to the last column' },
  prev_shift: { keys: ['shift', '←'], description: 'Previous slide, skipping builds', grid: 'Jump to the first slide (clears the remembered rows)' },
  toggle_overview: { keys: ['o', '`'], description: 'Toggle the quick overview', grid: 'Toggle the 2D overview' },
  hide_overview: { keys: ['esc'], description: 'Close the overview', grid: 'Toggle the 2D overview (closes this help first)' },
  goto_from_overview: { keys: ['enter'], description: 'In the overview: go to the highlighted slide' },
  goto: { keys: ['g'], description: 'Go to slide by number' },
  toggle_dark: { keys: ['d'], description: 'Toggle dark mode' },
  toggle_drawing: { keys: ['shift', 'd'], description: 'Toggle drawing mode' },
  toggle_help: { keys: ['?'], description: 'Show or hide this help' },
}

/** Registered outside the shortcut table, in `logic/shortcuts.ts`. */
export const extraShortcutHelp: ShortcutHelpRow[] = [
  { keys: ['f'], description: 'Fullscreen' },
]

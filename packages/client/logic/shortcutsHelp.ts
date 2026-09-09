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
}

/**
 * Descriptions for the shortcut names defined in `setup/shortcuts.ts`. Only
 * names present in `activeShortcutNames` are rendered, so this map may safely
 * describe more than a given build registers - but it can never invent a row.
 */
export const shortcutHelp: Record<string, ShortcutHelpRow> = {
  next_space: { keys: ['space'], description: 'Next build, then next slide' },
  prev_space: { keys: ['shift', 'space'], description: 'Previous build, then previous slide' },
  next_page_key: { keys: ['page down'], description: 'Same as space' },
  prev_page_key: { keys: ['page up'], description: 'Same as shift + space' },
  next_right: { keys: ['→'], description: 'Next build, then next slide' },
  prev_left: { keys: ['←'], description: 'Previous build, then previous slide' },
  next_down: { keys: ['↓'], description: 'Next slide' },
  prev_up: { keys: ['↑'], description: 'Previous slide' },
  next_shift: { keys: ['shift', '→'], description: 'Next slide, skipping builds' },
  prev_shift: { keys: ['shift', '←'], description: 'Previous slide, skipping builds' },
  toggle_overview: { keys: ['o', '`'], description: 'Toggle the quick overview' },
  hide_overview: { keys: ['esc'], description: 'Close the overview' },
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

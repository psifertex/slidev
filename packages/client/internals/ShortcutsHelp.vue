<!--
  `?` (or `shift` + `/`) keyboard help.

  Slidev's bindings are configurable per deck, and a speaker who has just been
  handed the clicker has nowhere on screen to look them up. This overlay is
  that place.

  The *set* of rows comes from `activeShortcutNames`, which `registerShortcuts()`
  fills in from the live shortcut table after addon setups have run. Removing a
  binding therefore removes its help row, and a binding a deck adds without a
  description is simply not listed; only the wording lives here.

  Styling is deliberately theme-neutral: this is a speaker aid drawn on top of
  whatever slide happens to be showing, not a themed part of the deck.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { activeShortcutNames, extraShortcutHelp, shortcutHelp } from '../logic/shortcutsHelp'
import { showShortcutsHelp } from '../state'

const rows = computed(() => {
  const seen = new Set<string>()
  const out: { keys: string[], description: string }[] = []
  for (const name of activeShortcutNames.value) {
    const row = shortcutHelp[name]
    if (!row || seen.has(name))
      continue
    seen.add(name)
    out.push({ keys: row.keys, description: row.description })
  }
  for (const row of extraShortcutHelp)
    out.push({ keys: row.keys, description: row.description })
  return out
})

const MODIFIERS = new Set(['shift', 'ctrl', 'alt', 'cmd', 'meta'])

/** `shift + →` is a chord; `o / \`` are alternatives for the same action. */
function separator(keys: string[]) {
  return MODIFIERS.has(keys[0]) ? '+' : '/'
}

function close() {
  showShortcutsHelp.value = false
}
</script>

<template>
  <Transition name="shortcuts-help-fade">
    <div v-if="showShortcutsHelp" class="shortcuts-help" @click.self="close">
      <div class="shortcuts-help-panel">
        <div class="shortcuts-help-head">
          <span>Keyboard shortcuts</span>
          <button class="shortcuts-help-close" title="Close" @click="close">
            &#10005;
          </button>
        </div>
        <table class="shortcuts-help-table">
          <tbody>
            <tr v-for="(row, i) of rows" :key="i">
              <td class="shortcuts-help-keys">
                <template v-for="(key, k) of row.keys" :key="k">
                  <span v-if="k" class="shortcuts-help-sep">{{ separator(row.keys) }}</span>
                  <kbd>{{ key }}</kbd>
                </template>
              </td>
              <td class="shortcuts-help-desc">
                {{ row.description }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="shortcuts-help-foot">
          <kbd>?</kbd> or <kbd>esc</kbd> to close
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.shortcuts-help {
  position: fixed;
  inset: 0;
  z-index: 2100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
}

.shortcuts-help-panel {
  max-height: 100%;
  overflow: auto;
  padding: 1.25rem 1.5rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: #17181c;
  color: #e6e6e6;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    'Segoe UI',
    sans-serif;
  font-size: 0.85rem;
  line-height: 1.35;
}

.shortcuts-help-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
}

.shortcuts-help-close {
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.5;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}

.shortcuts-help-close:hover {
  opacity: 1;
}

.shortcuts-help-table {
  border-collapse: collapse;
}

.shortcuts-help-table td {
  padding: 0.2rem 0 0.2rem 0;
  vertical-align: baseline;
}

.shortcuts-help-keys {
  white-space: nowrap;
  padding-right: 1rem !important;
  text-align: right;
}

.shortcuts-help-sep {
  opacity: 0.35;
  padding: 0 0.15rem;
}

.shortcuts-help-desc {
  opacity: 0.85;
}

kbd {
  display: inline-block;
  min-width: 1.1em;
  padding: 0.1em 0.4em;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.07);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  text-align: center;
}

.shortcuts-help-foot {
  margin: 0.9rem 0 0;
  opacity: 0.4;
  font-size: 0.75rem;
}

.shortcuts-help-fade-enter-active,
.shortcuts-help-fade-leave-active {
  transition: opacity 0.12s ease;
}

.shortcuts-help-fade-enter-from,
.shortcuts-help-fade-leave-to {
  opacity: 0;
}
</style>

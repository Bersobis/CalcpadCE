<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MATH_PALETTE, rankPalette, wrapIndex } from 'calcpad-frontend'
import type { PaletteAction } from 'calcpad-frontend'

/**
 * The insertion control, as a menu you open where you are typing.
 *
 * The button grid it replaces is a good reference and a poor control: 84 buttons
 * to scan, positioned away from the caret, mouse-first. This opens over the
 * editing surface, filters as you type, and inserts on Enter — so choosing a
 * function never costs a look away from the expression or a trip to the mouse.
 *
 * It inserts through the same dispatch as the grid (`pick` carries a
 * `PaletteAction`), so there is one insertion path and the two controls cannot
 * drift apart.
 */

const props = defineProps<{
  /** Most recently used action ids, newest first — what the empty query opens on. */
  recent?: string[]
}>()

const emit = defineEmits<{
  pick: [action: PaletteAction]
  close: []
}>()

/** How many entries the menu shows at once; the rest are a keystroke away. */
const MAX_VISIBLE = 12

const query = ref('')
const index = ref(0)
const queryEl = ref<HTMLInputElement | null>(null)
const rootEl = ref<HTMLElement | null>(null)

const matches = computed(() => rankPalette(MATH_PALETTE, query.value, props.recent ?? []))
const visible = computed(() => matches.value.slice(0, MAX_VISIBLE))

// A new query re-ranks, so the highlight has to start at the top again.
watch(query, () => { index.value = 0 })

/**
 * Close when the click lands outside the menu.
 *
 * The menu covers the surface it was opened from, so without this it stays up
 * after the user has moved on — and the next keystroke would filter a menu they
 * had forgotten about. `mousedown` rather than `click`, so the menu is gone
 * before the surface places its own caret.
 */
function onDocumentMouseDown(event: MouseEvent): void {
  const target = event.target as Node | null
  if (target && rootEl.value?.contains(target)) return
  emit('close')
}

onMounted(() => {
  void nextTick(() => queryEl.value?.focus())
  document.addEventListener('mousedown', onDocumentMouseDown)
})

onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentMouseDown))

function move(delta: number): void {
  index.value = wrapIndex(index.value, delta, visible.value.length)
}

function choose(action: PaletteAction | undefined): void {
  if (!action) return
  emit('pick', action)
}

function onKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown': event.preventDefault(); move(1); break
    case 'ArrowUp': event.preventDefault(); move(-1); break
    case 'Home': event.preventDefault(); index.value = 0; break
    case 'End': event.preventDefault(); index.value = Math.max(0, visible.value.length - 1); break
    case 'Enter': case 'Tab':
      event.preventDefault()
      choose(visible.value[index.value])
      break
    case 'Escape':
      event.preventDefault()
      emit('close')
      break
    default:
      break
  }
}
</script>

<template>
  <div ref="rootEl" class="command-menu" role="dialog" aria-label="Insert a function or structure" @mousedown.prevent>
    <input
      ref="queryEl"
      v-model="query"
      class="command-input"
      type="text"
      placeholder="Insert a function or structure…"
      aria-label="Search the palette"
      @keydown="onKeydown"
    />
    <ul v-if="visible.length" class="command-list" role="listbox">
      <li
        v-for="(action, i) in visible"
        :key="action.id"
        class="command-item"
        :class="{ active: i === index }"
        role="option"
        :aria-selected="i === index"
        :title="action.title + ' — ' + action.syntax"
        @mousedown.prevent
        @mousemove="index = i"
        @click="choose(action)"
      >
        <span class="command-label">{{ action.label }}</span>
        <span class="command-title">{{ action.title }}</span>
        <code class="command-syntax">{{ action.syntax }}</code>
      </li>
    </ul>
    <div v-else class="command-empty">Nothing matches “{{ query }}”.</div>
    <div class="command-foot">
      <span>↑↓ choose</span><span>Enter insert</span><span>Esc close</span>
      <span v-if="matches.length > MAX_VISIBLE" class="command-more">
        {{ matches.length - MAX_VISIBLE }} more
      </span>
    </div>
  </div>
</template>

<style scoped>
.command-menu {
  position: absolute;
  z-index: 20;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 2px;
  display: flex;
  flex-direction: column;
  max-height: 260px;
  border: 1px solid var(--vscode-focusBorder, #007acc);
  border-radius: 3px;
  background: var(--vscode-editorWidget-background, #252526);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}
.command-input {
  padding: 4px 7px;
  border: none;
  border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
  background: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #ccc);
  font-size: var(--calcpad-font-size-sm, 13px);
}
.command-input:focus { outline: none; }
.command-list {
  margin: 0;
  padding: 2px 0;
  list-style: none;
  overflow-y: auto;
}
.command-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 8px;
  cursor: pointer;
}
.command-item.active {
  background: var(--vscode-list-activeSelectionBackground, #094771);
  color: var(--vscode-list-activeSelectionForeground, #fff);
}
.command-label {
  min-width: 26px;
  font-size: var(--calcpad-font-size-sm, 13px);
}
.command-title {
  flex: 1;
  color: var(--vscode-descriptionForeground, #9a9a9a);
  font-size: var(--calcpad-font-size-xs, 11px);
}
.command-item.active .command-title {
  color: inherit;
  opacity: 0.85;
}
.command-syntax {
  color: var(--vscode-descriptionForeground, #9a9a9a);
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--calcpad-font-size-xs, 11px);
}
.command-empty {
  padding: 6px 8px;
  color: var(--vscode-descriptionForeground, #9a9a9a);
  font-size: var(--calcpad-font-size-xs, 11px);
}
.command-foot {
  display: flex;
  gap: 10px;
  padding: 3px 8px;
  border-top: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
  color: var(--vscode-descriptionForeground, #9a9a9a);
  font-size: var(--calcpad-font-size-xs, 11px);
}
.command-more { margin-left: auto; }
</style>

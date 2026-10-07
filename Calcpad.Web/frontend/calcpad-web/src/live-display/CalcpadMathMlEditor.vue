<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  anchorIndex,
  applyCharacterToSelection,
  buildStructure,
  checkGraphicallyEditable,
  deleteBackwardInSelection,
  deleteForwardInSelection,
  hasEmptySlot,
  hasSelection,
  insertCall,
  insertPair,
  insertText,
  lastAnchor,
  mathMlToCalcpadLine,
  moveHorizontal,
  moveToEndOfLine,
  moveToStartOfLine,
  moveVertical,
  orderedSelection,
  parsePathKey,
  pathKey,
  serializeWithPaths,
} from 'calcpad-frontend'
import type { Anchor, EditResult, EditorSelection, MathMlElement, PaletteAction, StructureKind } from 'calcpad-frontend'

/**
 * The graphical equation editor: a MathML-native editing surface.
 *
 * The tree is the model. Rendering serializes it to MathML and the browser
 * typesets it natively — there is no LaTeX anywhere, and no math library. Input
 * is handled by the caret model in `calcpad-frontend/src/mathml`, so every
 * keystroke is a pure tree operation and this component stays a thin layer of
 * rendering, event wiring and caret positioning.
 *
 * It is deliberately opt-in: the live display mounts it only when the user turns
 * graphical editing on, and only for a line the Calcpad bridge can round-trip.
 */

const props = defineProps<{
  /** The Calcpad text of the line. */
  modelValue: string
  /** Diagnostics for this line, from the server linter. */
  diagnostics?: { message: string; severity: string }[]
  dark?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [text: string]
  /** True while the expression still has an empty slot and must not be committed. */
  'update:incomplete': [value: boolean]
  /** Enter, or focus leaving the surface: keep the edit. */
  finish: []
  /** Escape: put the line back the way it was. */
  cancel: []
}>()

const surfaceEl = ref<HTMLElement | null>(null)
const root = ref<MathMlElement | null>(null)
/** Replaced as soon as a line loads; the initial value only has to be well-formed. */
const selection = ref<EditorSelection>({ anchor: { kind: 'gap', path: [0], index: 0 }, focus: { kind: 'gap', path: [0], index: 0 } })
const caret = ref<{ left: number; top: number; height: number } | null>(null)
const loadError = ref<string | null>(null)

/** The text this editor last wrote out, so an echo from the parent is not re-loaded. */
let lastEmitted = ''
/** True once the surface has been focused at least once — the caret is only drawn then. */
const focused = ref(false)

// ---- loading ----------------------------------------------------------------

function load(source: string): void {
  const check = checkGraphicallyEditable(source)
  if (!check.root) {
    loadError.value = check.reason ?? 'this line cannot be edited graphically'
    root.value = null
    return
  }
  loadError.value = null
  root.value = check.root
  selection.value = { anchor: lastAnchor(check.root), focus: lastAnchor(check.root) }
  // Seed from the *serialized* text, not the raw line: opening a line and moving
  // the caret must not rewrite `a=5` to `a = 5`. Only a real edit writes out.
  lastEmitted = mathMlToCalcpadLine(check.root) ?? source
  render()
  publish()
}

watch(() => props.modelValue, value => {
  // Only reload when the change came from outside: our own edits echo back and
  // reloading them would throw the caret to the end on every keystroke.
  if (value === lastEmitted) return
  load(value)
})

// ---- rendering --------------------------------------------------------------

const rendered = computed(() => (root.value ? serializeWithPaths(root.value) : ''))
const incomplete = computed(() => (root.value ? hasEmptySlot(root.value) : false))

const caretStyle = computed(() => caret.value
  ? { left: caret.value.left + 'px', top: caret.value.top + 'px', height: caret.value.height + 'px' }
  : { display: 'none' })

/** The DOM node carrying `data-path` for an anchor's element. */
function nodeFor(path: number[]): HTMLElement | null {
  return surfaceEl.value?.querySelector<HTMLElement>(`[data-path="${pathKey(path)}"]`) ?? null
}

/**
 * A DOM Range for an anchor, so the caret overlay and the browser's own
 * selection highlight can both be placed from the same mapping.
 */
function domRange(anchor: Anchor): Range | null {
  const el = nodeFor(anchor.path)
  if (!el) return null
  const range = document.createRange()
  if (anchor.kind === 'char') {
    const textNode = el.firstChild
    if (!textNode) {
      range.selectNodeContents(el)
      range.collapse(true)
      return range
    }
    range.setStart(textNode, Math.min(anchor.offset, (textNode.nodeValue ?? '').length))
    range.collapse(true)
    return range
  }
  const children = el.children
  if (anchor.index < children.length) range.setStartBefore(children[anchor.index])
  else if (children.length > 0) range.setStartAfter(children[children.length - 1])
  else {
    range.selectNodeContents(el)
    range.collapse(true)
  }
  return range
}

/** Position an already-created range at one end of an anchor. */
function placeRange(range: Range, end: 'start' | 'end', anchor: Anchor): void {
  const el = nodeFor(anchor.path)
  if (!el) return
  const set = end === 'start' ? range.setStart.bind(range) : range.setEnd.bind(range)
  const before = end === 'start' ? range.setStartBefore.bind(range) : range.setEndAfter.bind(range)
  if (anchor.kind === 'char') {
    const textNode = el.firstChild
    if (!textNode) return
    set(textNode, Math.min(anchor.offset, (textNode.nodeValue ?? '').length))
    return
  }
  const children = el.children
  if (anchor.index < children.length) before(children[anchor.index])
  else if (children.length > 0) {
    const last = children[children.length - 1]
    if (end === 'start') range.setStartAfter(last)
    else range.setEndAfter(last)
  }
}

function updateCaret(): void {
  const surface = surfaceEl.value
  if (!surface || !root.value) {
    caret.value = null
    return
  }
  const range = domRange(selection.value.focus)
  if (!range) {
    caret.value = null
    return
  }
  const surfaceRect = surface.getBoundingClientRect()
  let rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    const fallback = range.startContainer.parentElement?.getBoundingClientRect()
    if (fallback) rect = fallback
  }
  caret.value = {
    left: rect.left - surfaceRect.left + surface.scrollLeft,
    top: rect.top - surfaceRect.top + surface.scrollTop,
    height: rect.height || 18,
  }
}

/**
 * Hand the selection to the browser as well, so its own highlight is drawn for a
 * range. The caret is drawn by this component because a non-editable surface
 * gets no blinking caret of its own.
 */
function updateNativeSelection(): void {
  if (!focused.value || !root.value || !hasSelection(root.value, selection.value)) {
    if (focused.value) window.getSelection()?.removeAllRanges()
    return
  }
  const [from, to] = orderedSelection(root.value, selection.value)
  const range = document.createRange()
  placeRange(range, 'start', from)
  placeRange(range, 'end', to)
  if (range.collapsed) return
  const native = window.getSelection()
  native?.removeAllRanges()
  native?.addRange(range)
}

function render(): void {
  void nextTick(() => {
    updateCaret()
    updateNativeSelection()
  })
}

// ---- emitting ---------------------------------------------------------------

function publish(): void {
  if (!root.value) return
  const text = mathMlToCalcpadLine(root.value)
  emit('update:incomplete', incomplete.value)
  if (text === null || text === lastEmitted) return
  lastEmitted = text
  emit('update:modelValue', text)
}

// ---- editing ----------------------------------------------------------------

function apply(result: EditResult): void {
  root.value = result.root
  selection.value = { anchor: result.anchor, focus: result.anchor }
  render()
  publish()
}

function setCaret(anchor: Anchor, extend: boolean): void {
  selection.value = extend
    ? { anchor: selection.value.anchor, focus: anchor }
    : { anchor, focus: anchor }
  render()
  publish()
}

function move(direction: -1 | 1, extend: boolean): void {
  if (!root.value) return
  setCaret(moveHorizontal(root.value, selection.value.focus, direction), extend)
}

function moveVertically(direction: -1 | 1, extend: boolean): void {
  if (!root.value) return
  setCaret(moveVertical(root.value, selection.value.focus, direction), extend)
}

const PRINTABLE = /^[\p{L}\p{N}_.+\-*/\^_()=<>≤≥≠≡∧∨⊕∠!°\\⦼%,;|]$/u

function onKeydown(event: KeyboardEvent): void {
  if (!root.value) return
  if (event.ctrlKey || event.metaKey || event.altKey) return

  const shift = event.shiftKey
  let handled = true
  switch (event.key) {
    case 'ArrowLeft': move(-1, shift); break
    case 'ArrowRight': move(1, shift); break
    case 'ArrowUp': moveVertically(-1, shift); break
    case 'ArrowDown': moveVertically(1, shift); break
    case 'Home': setCaret(moveToStartOfLine(root.value), shift); break
    case 'End': setCaret(moveToEndOfLine(root.value), shift); break
    case 'Backspace': apply(deleteBackwardInSelection(root.value, selection.value)); break
    case 'Delete': apply(deleteForwardInSelection(root.value, selection.value)); break
    case 'Escape': event.preventDefault(); emit('cancel'); return
    case 'Enter': event.preventDefault(); emit('finish'); return
    case ' ': handled = true; break
    default:
      handled = event.key.length === 1 && PRINTABLE.test(event.key)
      if (handled) apply(applyCharacterToSelection(root.value, selection.value, event.key))
  }
  if (handled) {
    event.preventDefault()
    event.stopPropagation()
  }
}

/**
 * Map a pointer position to a caret anchor. `caretRangeFromPoint` resolves to the
 * text position under the pointer, and the `data-path` on the nearest tagged
 * ancestor turns that back into a tree path.
 */
function anchorFromPoint(x: number, y: number): Anchor | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  const range = doc.caretRangeFromPoint?.(x, y)
    ?? (() => {
      const position = doc.caretPositionFromPoint?.(x, y)
      if (!position) return null
      const fallback = document.createRange()
      fallback.setStart(position.offsetNode, position.offset)
      fallback.collapse(true)
      return fallback
    })()
  if (!range) return null

  const node = range.startContainer
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element | null
  const tagged = element?.closest?.('[data-path]') ?? null
  const path = tagged ? parsePathKey(tagged.getAttribute('data-path') ?? '') : null
  if (!path) return null
  return node.nodeType === Node.TEXT_NODE
    ? { kind: 'char', path, offset: range.startOffset }
    : { kind: 'gap', path, index: range.startOffset }
}

function onPointerDown(event: MouseEvent): void {
  if (!root.value) return
  event.preventDefault()
  const anchor = anchorFromPoint(event.clientX, event.clientY)
  surfaceEl.value?.focus()
  if (anchor) setCaret(anchor, event.shiftKey)
}

function onFocus(): void {
  focused.value = true
  render()
}

function onBlur(): void {
  focused.value = false
  window.getSelection()?.removeAllRanges()
}

// ---- palette ----------------------------------------------------------------

/** Palette buttons that map straight onto a MathML structure. */
const STRUCTURE_BY_ID: Record<string, StructureKind> = {
  sqrt: 'sqrt',
  cbrt: 'root',
  nroot: 'root',
  power: 'power',
  subscript: 'subscript',
  fraction: 'fraction',
}

/** Palette buttons that become a `name(...)` call rather than a structure. */
const CALL_BY_ID: Record<string, string> = {
  abs: 'abs',
  floor: 'floor',
  ceil: 'ceil',
  sum: 'sum',
  product: 'product',
}

/**
 * Apply a palette button to the expression at the caret.
 *
 * The palette is text-oriented, so the mapping to tree operations is by button
 * identity: a structure button builds a structure, a function button writes a
 * call, and a symbol button inserts its glyph. Buttons with no Calcpad spelling
 * the bridge models (the `[ ]` literals) do nothing here rather than insert
 * something the line cannot round-trip.
 */
function applyPalette(action: PaletteAction): void {
  if (!root.value) return
  const caretAnchor = selection.value.focus

  const structure = STRUCTURE_BY_ID[action.id]
  if (structure) {
    apply(buildStructure(root.value, caretAnchor, structure))
    return
  }
  if (action.id === 'brackets') {
    apply(insertPair(root.value, caretAnchor, '(', ')'))
    return
  }
  const call = CALL_BY_ID[action.id] ?? (action.group === 'Functions' ? action.label : null)
  if (call) {
    apply(insertCall(root.value, caretAnchor, call))
    return
  }
  if (action.group === 'Structures') return
  apply(insertText(root.value, caretAnchor, action.label))
}

/** Focus the surface so the caret is drawn and the keyboard is live. */
function focus(): void {
  surfaceEl.value?.focus()
}

defineExpose({ applyPalette, focus })

// ---- status -----------------------------------------------------------------

const statusText = computed(() => {
  if (loadError.value) return `Graphical editing is unavailable: ${loadError.value}.`
  if (!root.value) return ''
  const text = mathMlToCalcpadLine(root.value) ?? ''
  const position = anchorIndex(root.value, selection.value.focus) + 1
  const total = anchorIndex(root.value, lastAnchor(root.value)) + 1
  const errors = (props.diagnostics ?? []).filter(d => d.severity === 'error').length
  const parts = [`Calcpad: ${text || '(empty)'}`, `position ${position} of ${total}`]
  if (incomplete.value) parts.push('incomplete — fill the empty slot')
  if (errors > 0) parts.push(`${errors} error${errors === 1 ? '' : 's'}`)
  return parts.join(', ')
})

const problems = computed(() => props.diagnostics ?? [])

// ---- lifecycle --------------------------------------------------------------

onMounted(() => load(props.modelValue))

onBeforeUnmount(() => {
  window.getSelection()?.removeAllRanges()
})
</script>

<template>
  <div class="mathml-editor" :class="{ 'dark-theme': dark, incomplete }">
    <div v-if="loadError" class="mathml-unavailable">
      This line cannot be edited graphically ({{ loadError }}). Use the source field.
    </div>
    <template v-else>
      <div
        ref="surfaceEl"
        class="mathml-surface"
        role="textbox"
        aria-multiline="false"
        aria-label="Math expression editor"
        :aria-describedby="'mathml-status'"
        tabindex="0"
        @keydown="onKeydown"
        @mousedown="onPointerDown"
        @focus="onFocus"
        @blur="onBlur"
      >
        <!-- MathML, typeset natively by the browser. No LaTeX, no math library. -->
        <!-- eslint-disable-next-line vue/no-v-html — serialized from the editor's own tree -->
        <div class="mathml-render" v-html="rendered"></div>
        <div v-show="focused" class="mathml-caret" :style="caretStyle" aria-hidden="true"></div>
      </div>

      <p id="mathml-status" class="mathml-status" aria-live="polite">{{ statusText }}</p>

      <ul v-if="problems.length > 0" class="mathml-problems">
        <li v-for="(problem, i) in problems" :key="i" :class="problem.severity">
          {{ problem.message }}
        </li>
      </ul>

      <p class="mathml-help">
        <kbd>/</kbd> fraction · <kbd>^</kbd> power · <kbd>_</kbd> subscript · <kbd>(</kbd> brackets ·
        <kbd>←</kbd><kbd>→</kbd> move · <kbd>↑</kbd><kbd>↓</kbd> between slots · <kbd>Esc</kbd> cancel
      </p>
    </template>
  </div>
</template>

<style scoped>
.mathml-editor {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mathml-unavailable {
  padding: 4px 6px;
  color: var(--vscode-descriptionForeground, #808080);
  font-size: var(--calcpad-font-size-xs, 11px);
}
.mathml-surface {
  position: relative;
  min-height: 2.4em;
  padding: 6px 8px;
  overflow-x: auto;
  background: var(--vscode-input-background, #3c3c3c);
  border: 1px solid var(--vscode-input-border, #3c3c3c);
  border-radius: 3px;
  cursor: text;
}
.mathml-surface:focus {
  outline: none;
  border-color: var(--vscode-focusBorder, #007acc);
}
.mathml-render {
  display: inline-block;
  min-width: 1em;
  font-size: 17px;
  line-height: 1.5;
  color: var(--vscode-editor-foreground, #ccc);
}
/* The caret is drawn here because a non-editable surface gets none of its own. */
.mathml-caret {
  position: absolute;
  width: 2px;
  margin-left: -1px;
  background: var(--vscode-editorCursor-foreground, #aeafad);
  animation: mathml-blink 1.06s steps(2, start) infinite;
  pointer-events: none;
}
@keyframes mathml-blink {
  to { visibility: hidden; }
}
.mathml-status {
  margin: 0;
  color: var(--vscode-descriptionForeground, #808080);
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--calcpad-font-size-xs, 11px);
}
.mathml-problems {
  margin: 0;
  padding-left: 16px;
  font-size: var(--calcpad-font-size-xs, 11px);
}
.mathml-problems .error {
  color: var(--vscode-errorForeground, #f48771);
}
.mathml-problems .warning {
  color: var(--vscode-editorWarning-foreground, #cca700);
}
.mathml-help {
  margin: 0;
  color: var(--vscode-descriptionForeground, #808080);
  font-size: var(--calcpad-font-size-xs, 11px);
}
.mathml-help kbd {
  padding: 0 3px;
  border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
  border-radius: 2px;
  font-family: var(--vscode-editor-font-family, monospace);
}
.mathml-editor.incomplete .mathml-surface {
  border-color: var(--vscode-editorWarning-foreground, #cca700);
}
</style>

<template>
  <!-- Teleported to <body> so the keypad spans the window's editing area regardless of
       which pane the sidebar sits in. `--live-keyboard-inset` is published by the shell
       when the Results pane is open, so the preview beside it stays visible. -->
  <Teleport to="body">
    <div
      v-if="visible"
      ref="keyboardEl"
      class="math-keyboard"
      role="toolbar"
      aria-label="Math keyboard"
      @contextmenu.prevent
      @mousedown.stop
    >
      <div class="mk-bar">
        <div class="mk-pages" role="tablist" aria-label="Keyboard pages">
          <button
            v-for="p in pages"
            :key="p.id"
            class="mk-page"
            :class="{ active: page === p.id }"
            role="tab"
            :aria-selected="page === p.id"
            @click="page = p.id"
          >{{ p.label }}</button>
        </div>
        <span class="mk-bar-spacer"></span>
        <button class="mk-action" title="Undo" aria-label="Undo" @click="undo">
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2.5 5.5h7a3.5 3.5 0 0 1 0 7H6" />
            <polyline points="5,2.5 2.5 5.5 5,8.5" />
          </svg>
        </button>
        <button class="mk-action" title="Redo" aria-label="Redo" @click="redo">
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13.5 5.5h-7a3.5 3.5 0 0 0 0 7H10" />
            <polyline points="11,2.5 13.5 5.5 11,8.5" />
          </svg>
        </button>
        <button class="mk-action" title="Copy the active field" aria-label="Copy" @click="copy">
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.2" />
            <path d="M10.5 5.5v-2a1.2 1.2 0 0 0-1.2-1.2H4.7A1.2 1.2 0 0 0 3.5 3.5v6.3A1.2 1.2 0 0 0 4.7 11h1.8" />
          </svg>
        </button>
      </div>

      <div class="mk-grid">
        <button
          v-for="slot in laidOut"
          :key="slot.row + '-' + slot.column"
          class="mk-key"
          :class="{ accent: slot.key.accent, arrow: slot.key.action === 'left' || slot.key.action === 'right', on: slot.key.action === 'shift' && shift }"
          :style="{ gridColumn: `${slot.column} / span ${slot.span}` }"
          :title="slot.key.title ?? undefined"
          type="button"
          @click="press(slot.key)"
        >
          <span v-if="slot.key.sup" class="mk-sup">{{ slot.key.sup }}</span>
          <span class="mk-label">{{ shiftLabel(slot.key) }}</span>
          <span v-if="slot.key.sub" class="mk-sub">{{ slot.key.sub }}</span>
          <span v-if="slot.key.suffix" class="mk-suffix">{{ slot.key.suffix }}</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ visible?: boolean }>()

/** A keypad key: what it shows, and what it writes. */
interface Key {
    label: string
    /** Small mark above the label — the second function of a two-function key. */
    sup?: string
    /** Small mark below the label. */
    sub?: string
    /** Trailing text shown after the label. */
    suffix?: string
    /** Text written into the focused field. Defaults to the (shifted) label. */
    insert?: string
    /** Text written instead when shift is on. */
    shiftInsert?: string
    /** Grid columns the key spans. */
    span?: number
    /** Keys that act on the field rather than writing into it. */
    action?: 'shift' | 'backspace' | 'left' | 'right'
    /** Drawn with the accent fill. */
    accent?: boolean
    title?: string
}

const pages = [
    { id: '123', label: '123' },
    { id: 'symbols', label: '∞≠∈' },
    { id: 'abc', label: 'abc' },
    { id: 'greek', label: 'αβγ' },
]

/**
 * The number page, laid out as in the reference: ten columns, with the wide keys —
 * shift, the integral and backspace — spanning several of them.
 *
 * Keys write what Calcpad reads. A few of the glyphs a keypad shows are output-only in
 * Calcpad (`×`, `−`, `√`, `π`), so those keys write the source form instead — `*`, `-`,
 * `sqrt(` and `pi` — while keys with no source equivalent keep their glyph, since `÷`,
 * `≤`, `≥`, `≠` and the rest are accepted input operators.
 */
const NUMBERS_PAGE: (Key | null)[][] = [
    [
        { label: 'x', insert: 'x' },
        { label: 'y', insert: 'y' },
        { label: 'n', sup: 'a', insert: 'n', shiftInsert: 'a' },
        { label: '<', insert: '<' },
        { label: '>', insert: '>' },
        { label: '(', insert: '(' },
        { label: ')', insert: ')' },
        { label: '⇧', span: 3, action: 'shift', accent: true, title: 'Second function of the key below' },
    ],
    [
        { label: '7' },
        { label: '8' },
        { label: '9' },
        { label: '÷', insert: '/', title: 'Division' },
        { label: 'e', sup: 'ln', insert: 'e', shiftInsert: 'ln' },
        { label: 'i', insert: 'i' },
        { label: 'π', sup: 'sin', insert: 'pi', shiftInsert: 'sin' },
        { label: '■', sup: '2', insert: '^2', title: 'Square' },
        { label: '□', sub: '■', insert: '_', title: 'Subscript' },
        { label: '√', insert: 'sqrt(', title: 'Square root' },
    ],
    [
        { label: '4' },
        { label: '5' },
        { label: '6' },
        { label: '×', insert: '*', title: 'Multiplication' },
        { label: '∫', sub: '0', sup: '∞', suffix: 'dx', span: 2, insert: '$Integral ', title: 'Numerical integral' },
        { label: '∀', span: 2, insert: '$For ', title: 'For loop' },
        { label: '⌫', span: 2, action: 'backspace', accent: true, title: 'Delete left' },
    ],
    [
        { label: '1' },
        { label: '2' },
        { label: '3' },
        { label: '−', insert: '-', title: 'Minus' },
        null, null, null, null,
        { label: '+', span: 2 },
    ],
    [
        { label: '0' },
        { label: '.' },
        { label: '=' },
        null, null, null, null,
        { label: '<', action: 'left', title: 'Cursor left' },
        { label: '>', action: 'right', title: 'Cursor right' },
        { label: '←', action: 'left', title: 'Cursor left' },
    ],
]

/** Operators and punctuation, every one of them valid in a Calcpad expression. */
const SYMBOLS_PAGE: (Key | null)[][] = [
    [
        { label: '≡' }, { label: '≠' }, { label: '≤' }, { label: '≥' },
        { label: '∧' }, { label: '∨' }, { label: '⊕' }, { label: '⦼' },
        { label: '←' }, { label: '∠' },
    ],
    [
        { label: '(' }, { label: ')' }, { label: '[' }, { label: ']' },
        { label: '{' }, { label: '}' }, { label: '|' }, { label: ';' },
        { label: ',' }, { label: '_' },
    ],
    [
        { label: '+' }, { label: '-' }, { label: '*' }, { label: '/' },
        { label: '=' }, { label: '^' }, { label: '%' }, { label: '!' },
        { label: '.' }, { label: "'" },
    ],
    [
        { label: '#val' }, { label: '#equ' }, { label: '#hide' }, { label: '#pre' },
        { label: '#post' }, { label: '#round' }, { label: '#repeat' }, { label: '#include' },
        { label: '#local' }, { label: '#end' },
    ],
    [
        { label: '$Root ' }, { label: '$Find ' }, { label: '$Sup ' }, { label: '$Inf ' },
        { label: '$Area ' }, { label: '$Integral ' }, { label: '$Slope ' }, { label: '$Sum ' },
        { label: '$Product ' }, { label: '$While ' },
    ],
]

const letters = (from: string, to: string): Key[] => {
    const out: Key[] = []
    for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); ++c) {
        const ch = String.fromCharCode(c)
        out.push({ label: ch, insert: ch, shiftInsert: ch.toUpperCase() })
    }
    return out
}

const ABC_PAGE: (Key | null)[][] = [
    letters('a', 'i'),
    letters('j', 'r'),
    [...letters('s', 'z'), { label: '_', insert: '_' }, { label: 'Space', insert: ' ', span: 2 }],
]

const GREEK = 'αβγδεζηθικλμνξοπρστυφχψω'
const GREEK_PAGE: (Key | null)[][] = [
    greekRow(0, 8),
    greekRow(9, 17),
    [
        ...greekRow(18, 23),
        { label: 'Ω', insert: 'Ω' },
        { label: 'μ', insert: 'μ' },
        { label: '°', insert: '°' },
    ],
]

function greekRow(from: number, to: number): Key[] {
    const out: Key[] = []
    for (let i = from; i <= to && i < GREEK.length; ++i) {
        const ch = GREEK[i]
        out.push({ label: ch, insert: ch, shiftInsert: greekUpper(ch) })
    }
    return out
}

function greekUpper(ch: string): string {
    const index = GREEK.indexOf(ch)
    return index >= 0 ? GREEK_UPPER[index] ?? ch : ch.toUpperCase()
}

/** Capitals in the same order as GREEK; the three without one keep their own marker. */
const GREEK_UPPER = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ'

const page = ref('123')
const shift = ref(false)
const visible = computed(() => props.visible !== false)

const currentPage = computed<(Key | null)[][]>(() => {
    switch (page.value) {
        case 'symbols': return SYMBOLS_PAGE
        case 'abc': return ABC_PAGE
        case 'greek': return GREEK_PAGE
        default: return NUMBERS_PAGE
    }
})

interface Slot { key: Key; row: number; column: number; span: number }

/** Resolves each row into grid columns, so a gap needs no element of its own. */
const laidOut = computed<Slot[]>(() => {
    const slots: Slot[] = []
    currentPage.value.forEach((row, rowIndex) => {
        let column = 0
        for (const key of row) {
            if (key == null) {
                ++column
                continue
            }
            const span = key.span ?? 1
            slots.push({ key, row: rowIndex, column: column + 1, span })
            column += span
        }
    })
    return slots
})

const shiftLabel = (key: Key): string => {
    if (key.action) return key.label
    if (shift.value && key.shiftInsert != null && key.label.length === 1) {
        return key.shiftInsert
    }
    return key.label
}

/**
 * The field the keypad writes into. Tracked on focus rather than read at press time:
 * the keypad itself steals focus otherwise, and it has to reach fields owned by the
 * other Vue app in the window — the live editor's line and matrix cells.
 */
const trackedField = ref<HTMLInputElement | null>(null)
const onFocusIn = (event: FocusEvent) => {
    const target = event.target
    if (target instanceof HTMLInputElement) trackedField.value = target
}
onMounted(() => document.addEventListener('focusin', onFocusIn))
onBeforeUnmount(() => document.removeEventListener('focusin', onFocusIn))

/**
 * The keypad is fixed to the bottom of the window, so it covers whatever sits at the
 * bottom of the sidebar's live-editor tab — the matrix grid. Its measured height is
 * published as a custom property, which the tab spends as padding so the grid, its
 * controls and the insert button all stay above the keypad instead of behind it.
 */
const keyboardEl = ref<HTMLElement | null>(null)

function publishKeyboardHeight(): void {
    const height = props.visible ? keyboardEl.value?.offsetHeight ?? 0 : 0
    document.documentElement.style.setProperty('--live-keyboard-h', `${height}px`)
}

watch(() => props.visible, () => nextTick(publishKeyboardHeight))
onMounted(() => {
    window.addEventListener('resize', publishKeyboardHeight)
    nextTick(publishKeyboardHeight)
})
onBeforeUnmount(() => {
    window.removeEventListener('resize', publishKeyboardHeight)
    document.documentElement.style.setProperty('--live-keyboard-h', '0px')
})

function currentField(): HTMLInputElement | null {
    const active = document.activeElement
    if (active instanceof HTMLInputElement && active.isConnected) return active
    const tracked = trackedField.value
    return tracked != null && tracked.isConnected ? tracked : null
}

/** Writes `text` at the field's caret, notifying Vue so `v-model` follows. */
function write(text: string): void {
    const field = currentField()
    if (field == null) return
    const start = field.selectionStart ?? field.value.length
    const end = field.selectionEnd ?? start
    field.value = field.value.slice(0, start) + text + field.value.slice(end)
    const caret = start + text.length
    field.setSelectionRange(caret, caret)
    field.dispatchEvent(new Event('input', { bubbles: true }))
}

function replaceRange(start: number, end: number): void {
    const field = currentField()
    if (field == null) return
    field.value = field.value.slice(0, start) + field.value.slice(end)
    field.setSelectionRange(start, start)
    field.dispatchEvent(new Event('input', { bubbles: true }))
}

function moveCaret(delta: number): void {
    const field = currentField()
    if (field == null) return
    const caret = (field.selectionStart ?? field.value.length) + delta
    const next = Math.max(0, Math.min(field.value.length, caret))
    field.setSelectionRange(next, next)
}

function press(key: Key): void {
    if (key.action === 'shift') {
        shift.value = !shift.value
        return
    }
    if (key.action === 'backspace') {
        const field = currentField()
        if (field == null) return
        const start = field.selectionStart ?? 0
        const end = field.selectionEnd ?? start
        if (start !== end) replaceRange(start, end)
        else if (start > 0) replaceRange(start - 1, start)
        return
    }
    if (key.action === 'left' || key.action === 'right') {
        moveCaret(key.action === 'left' ? -1 : 1)
        return
    }
    if (shift.value) {
        shift.value = false
        write(key.shiftInsert ?? key.insert ?? key.label)
        return
    }
    write(key.insert ?? key.label)
}

function undo(): void {
    document.execCommand?.('undo')
}

function redo(): void {
    document.execCommand?.('redo')
}

async function copy(): Promise<void> {
    const field = currentField()
    const text = field?.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? undefined) || field?.value
    if (!text) return
    try {
        await navigator.clipboard.writeText(text)
    } catch {
        // Clipboard permission denied — nothing to fall back to that does not need one.
    }
}
</script>

<style scoped>
.math-keyboard {
  position: fixed;
  left: 0;
  /* The shell publishes the Results pane's share of the window here, so the keypad
     stops short of the preview instead of covering it. */
  right: var(--live-keyboard-inset, 0px);
  bottom: 0;
  z-index: 1000;
  padding: 6px 8px 8px;
  background: var(--vscode-editorWidget-background, var(--vscode-panel-background, #1e1e1e));
  border-top: 1px solid var(--vscode-panel-border, #474747);
  box-shadow: 0 -6px 18px rgb(0 0 0 / 28%);
  user-select: none;
}

.mk-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}

.mk-pages {
  display: flex;
  gap: 2px;
}

.mk-page {
  padding: 3px 10px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--vscode-descriptionForeground, #888);
  font: inherit;
  font-size: var(--calcpad-font-size-sm, 12px);
  cursor: pointer;
}

.mk-page:hover {
  color: var(--vscode-foreground, #ccc);
  background: var(--vscode-list-hoverBackground, #2a2d2e);
}

.mk-page.active {
  color: var(--vscode-textLink-foreground, #3794ff);
  box-shadow: inset 0 -2px 0 var(--vscode-textLink-foreground, #3794ff);
}

.mk-bar-spacer {
  flex: 1;
}

.mk-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 24px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--vscode-descriptionForeground, #888);
  cursor: pointer;
}

.mk-action:hover {
  color: var(--vscode-foreground, #ccc);
  background: var(--vscode-list-hoverBackground, #2a2d2e);
}

.mk-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  grid-auto-rows: 38px;
  gap: 5px;
}

.mk-key {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vscode-input-border, #767676);
  border-radius: 4px;
  background: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #ccc);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  overflow: hidden;
}

.mk-key:hover {
  background: var(--vscode-list-hoverBackground, #2a2d2e);
}

.mk-key:active {
  background: var(--vscode-list-activeSelectionBackground, #094771);
}

.mk-key.accent,
.mk-key.on {
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  border-color: var(--vscode-button-border, transparent);
}

.mk-key.arrow {
  font-size: 16px;
}

.mk-sup,
.mk-sub {
  position: absolute;
  font-size: 9px;
  line-height: 1;
  color: var(--vscode-descriptionForeground, #888);
  pointer-events: none;
}

.mk-sup {
  top: 3px;
  right: 4px;
}

.mk-sub {
  bottom: 2px;
  right: 4px;
}

.mk-suffix {
  font-size: 10px;
  margin-left: 3px;
  color: var(--vscode-descriptionForeground, #888);
}
</style>

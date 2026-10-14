<template>
  <!--
    A matrix insertion wizard: size, then values, then where it goes. It replaces the
    inline grid-and-insert button pair, whose cells were inert unless the target line
    already held a literal — filling the grid produced no effect and no feedback.
  -->
  <Teleport to="body">
    <div v-if="open" class="mw-backdrop" @click.self="cancel">
      <div
        class="mw"
        :class="{ shift: keyboardLift }"
        role="dialog"
        aria-modal="true"
        aria-label="Insert a matrix"
        @keydown.esc.stop.prevent="cancel"
      >
        <header class="mw-head">
          <h2 class="mw-title">Insert a matrix</h2>
          <ol class="mw-steps">
            <li v-for="(label, i) in steps" :key="label" :class="{ on: step === i, done: step > i }">
              <span class="mw-step-no">{{ i + 1 }}</span>{{ label }}
            </li>
          </ol>
          <button class="mw-close" title="Close" aria-label="Close" @click="cancel">×</button>
        </header>

        <!-- 1 — size -->
        <section v-show="step === 0" class="mw-body">
          <div class="mw-row">
            <span class="mw-label">Rows</span>
            <button class="mw-step" :disabled="rows <= 1" title="Remove a row" @click="setRows(rows - 1)">−</button>
            <b class="mw-num">{{ rows }}</b>
            <button class="mw-step" title="Add a row" @click="setRows(rows + 1)">+</button>
            <span class="mw-gap"></span>
            <span class="mw-label">Cols</span>
            <button class="mw-step" :disabled="cols <= 1" title="Remove a column" @click="setCols(cols - 1)">−</button>
            <b class="mw-num">{{ cols }}</b>
            <button class="mw-step" title="Add a column" @click="setCols(cols + 1)">+</button>
          </div>
          <div class="mw-preview" :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }">
            <span v-for="n in rows * cols" :key="n" class="mw-preview-cell"></span>
          </div>
          <p class="mw-hint">The result reads <code>[{{ rows }}×{{ cols }}]</code> in Calcpad: rows separated by <code>|</code>, cells by <code>;</code>.</p>
        </section>

        <!-- 2 — values -->
        <section v-show="step === 1" class="mw-body">
          <div class="mw-grid" :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }">
            <template v-for="(row, r) in values" :key="r">
              <input
                v-for="(cell, c) in row"
                :key="c"
                :ref="(el) => setCellRef(r, c, el as HTMLInputElement | null)"
                v-model="values[r][c]"
                class="mw-cell"
                type="text"
                spellcheck="false"
                autocomplete="off"
                :aria-label="`Row ${r + 1}, column ${c + 1}`"
                @keydown="onCellKey(r, c, $event)"
              />
            </template>
          </div>
          <p class="mw-hint">Arrow keys move between cells. The math keyboard writes into whichever cell has focus.</p>
        </section>

        <!-- 3 — target -->
        <section v-show="step === 2" class="mw-body">
          <label class="mw-field">
            <span class="mw-label">Line</span>
            <select v-model="targetLine" class="mw-select">
              <option v-for="l in targets" :key="l.number" :value="l.number">
                {{ l.number }} — {{ previewLine(l) }}
              </option>
            </select>
          </label>
          <label class="mw-field">
            <span class="mw-label">Name</span>
            <input v-model="name" class="mw-input" placeholder="optional, e.g. A" spellcheck="false" autocomplete="off" @keydown.enter.prevent="insert" />
          </label>
          <div class="mw-source-wrap">
            <span class="mw-label">Line as it will be written</span>
            <pre class="mw-source">{{ composedText }}</pre>
          </div>
        </section>

        <footer class="mw-foot">
          <button class="mw-btn" :disabled="step === 0" @click="step -= 1">Back</button>
          <span class="mw-spacer"></span>
          <template v-if="step < 2">
            <button class="mw-btn mw-primary" @click="step += 1">Next</button>
          </template>
          <button v-else class="mw-btn mw-primary" @click="insert">Insert</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { buildMatrixLiteral, matrixLiteralRange } from '../../services/live-document'
import type { LiveLine } from '../../services/live-document'

const props = defineProps<{
  open: boolean
  lines: LiveLine[]
  activeLine: number | null
}>()

const emit = defineEmits<{
  close: []
  insert: [{ line: number; text: string }]
}>()

const steps = ['Size', 'Values', 'Insert']
const step = ref(0)
const rows = ref(3)
const cols = ref(3)
const values = ref<string[][]>(emptyGrid(3, 3))
const name = ref('')
const targetLine = ref<number | null>(null)
const cellRefs = ref<Array<HTMLInputElement[]>>([])

function emptyGrid(rowCount: number, colCount: number): string[][] {
    return Array.from({ length: rowCount }, () => Array.from({ length: colCount }, () => ''))
}

function setCellRef(r: number, c: number, el: HTMLInputElement | null): void {
    if (cellRefs.value[r] == null) cellRefs.value[r] = []
    cellRefs.value[r][c] = el as HTMLInputElement
}

/** The lines the matrix can land on: the editable ones, newest first is wrong — keep
 *  document order, since that is how the user reads the gutter. */
const targets = computed<LiveLine[]>(() => props.lines.filter(l => l.editable))

function previewLine(line: LiveLine): string {
    const text = line.text.trim()
    return text.length === 0 ? '(empty)' : text.length > 28 ? `${text.slice(0, 28)}…` : text
}

/** The full line as it will be written: an existing literal on it is replaced in
 *  place, a blank line takes the assignment whole, anything else gets it appended. */
const composedText = computed<string>(() => {
    const target = props.lines.find(l => l.number === targetLine.value)
    const lineText = target?.text ?? ''
    const literal = buildMatrixLiteral(values.value)
    const assignment = name.value.trim().length > 0 ? `${name.value.trim()} = ${literal}` : literal
    const range = matrixLiteralRange(lineText)
    if (range != null) return lineText.slice(0, range.start) + literal + lineText.slice(range.end)
    if (lineText.trim().length === 0) return assignment
    return `${lineText.replace(/\s+$/, '')} ${assignment}`
})

function setRows(next: number): void {
    rows.value = Math.max(1, Math.min(12, next))
    resize()
}

function setCols(next: number): void {
    cols.value = Math.max(1, Math.min(12, next))
    resize()
}

function resize(): void {
    values.value = Array.from({ length: rows.value }, (_, r) =>
        Array.from({ length: cols.value }, (_, c) => values.value[r]?.[c] ?? '')
    )
    cellRefs.value = []
}

/** Arrow keys walk the grid, so the cells can be filled without reaching for a mouse. */
function onCellKey(r: number, c: number, event: KeyboardEvent): void {
    const deltas: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
    }
    const delta = deltas[event.key]
    if (delta == null) return
    event.preventDefault()
    const nr = Math.min(Math.max(r + delta[0], 0), rows.value - 1)
    const nc = Math.min(Math.max(c + delta[1], 0), cols.value - 1)
    const field = cellRefs.value[nr]?.[nc]
    if (field != null) {
        field.focus()
        field.select()
    }
}

function insert(): void {
    if (targetLine.value == null) return
    emit('insert', { line: targetLine.value, text: composedText.value })
}

function cancel(): void {
    emit('close')
}

/**
 * Escape closes from anywhere. The dialog's own `keydown.esc` only sees the key when
 * the focus is already inside it, which is not true right after it opens or after the
 * keypad has taken the focus, so the listener sits on the window while it is open.
 */
function onWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
        event.stopPropagation()
        cancel()
    }
}

watch(() => props.open, (open) => {
    if (open) {
        window.addEventListener('keydown', onWindowKeydown, true)
        return
    }
    window.removeEventListener('keydown', onWindowKeydown, true)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onWindowKeydown, true))

/** Opening starts a fresh matrix: the size is kept, the cells and the target are not. */
watch(() => props.open, (open) => {
    if (!open) return
    step.value = 0
    name.value = ''
    values.value = emptyGrid(rows.value, cols.value)
    cellRefs.value = []
    const editable = props.lines.filter(l => l.editable)
    const preferred = props.activeLine != null && editable.some(l => l.number === props.activeLine)
        ? props.activeLine
        : editable.length > 0 ? editable[editable.length - 1].number : null
    targetLine.value = preferred
})

/** The lift keeps the dialog clear of the math keypad, which covers the bottom of
 *  the window while it is open. */
const keyboardLift = computed(() => {
    if (typeof window === 'undefined') return false
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--live-keyboard-h')
    return raw.trim().length > 0 && raw.trim() !== '0px'
})
</script>

<style scoped>
.mw-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 45%);
}

.mw {
  width: min(420px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vscode-widget-border, #474747);
  border-radius: 6px;
  background: var(--vscode-editorWidget-background, #252526);
  box-shadow: 0 10px 32px rgb(0 0 0 / 45%);
  font-family: var(--vscode-font-family, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-foreground, #ccc);
}

.mw.shift {
  transform: translateY(calc(var(--live-keyboard-h, 0px) / -2));
}

.mw-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--vscode-panel-border, #474747);
}

.mw-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.mw-steps {
  display: flex;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  flex: 1;
  min-width: 0;
  font-size: var(--calcpad-font-size-xs, 11px);
  color: var(--vscode-descriptionForeground, #888);
}

.mw-steps li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.mw-step-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--vscode-badge-background, #4d4d4d);
  color: var(--vscode-badge-foreground, #ccc);
  font-size: 10px;
}

.mw-steps li.on {
  color: var(--vscode-foreground, #ccc);
  font-weight: 600;
}

.mw-steps li.on .mw-step-no {
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #fff);
}

.mw-steps li.done .mw-step-no {
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #fff);
}

.mw-close {
  flex: none;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--vscode-descriptionForeground, #888);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.mw-close:hover {
  background: var(--vscode-list-hoverBackground, #2a2d2e);
  color: var(--vscode-foreground, #ccc);
}

.mw-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 12px;
  min-height: 168px;
}

.mw-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mw-label {
  font-size: var(--calcpad-font-size-sm, 12px);
  color: var(--vscode-descriptionForeground, #888);
}

.mw-gap {
  width: 18px;
}

.mw-step {
  width: 22px;
  height: 22px;
  border: 1px solid var(--vscode-input-border, #767676);
  border-radius: 3px;
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  color: var(--vscode-button-secondaryForeground, #ccc);
  font: inherit;
  line-height: 1;
  cursor: pointer;
}

.mw-step:hover:not(:disabled) {
  background: var(--vscode-button-secondaryHoverBackground, #45494e);
}

.mw-step:disabled {
  opacity: 0.45;
  cursor: default;
}

.mw-num {
  min-width: 18px;
  text-align: center;
  font-size: var(--calcpad-font-size-sm, 12px);
}

.mw-preview {
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px dashed var(--vscode-panel-border, #474747);
  border-radius: 4px;
}

.mw-preview-cell {
  height: 26px;
  border: 1px solid var(--vscode-input-border, #767676);
  border-radius: 3px;
  background: var(--vscode-input-background, #3c3c3c);
}

.mw-grid {
  display: grid;
  gap: 4px;
}

.mw-cell {
  width: 100%;
  min-width: 0;
  padding: 5px 2px;
  border: 1px solid var(--vscode-input-border, #767676);
  border-radius: 3px;
  background: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #ccc);
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--calcpad-font-size-sm, 12px);
  text-align: center;
  outline: none;
}

.mw-cell:focus {
  border-color: var(--vscode-focusBorder, #0090f1);
}

.mw-hint {
  margin: 0;
  font-size: var(--calcpad-font-size-xs, 11px);
  color: var(--vscode-descriptionForeground, #888);
}

.mw-hint code {
  font-family: var(--vscode-editor-font-family, monospace);
}

.mw-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mw-field .mw-label {
  width: 38px;
  flex: none;
}

.mw-select,
.mw-input {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid var(--vscode-input-border, #767676);
  border-radius: 3px;
  background: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #ccc);
  font: inherit;
  font-size: var(--calcpad-font-size-sm, 12px);
  outline: none;
}

.mw-select:focus,
.mw-input:focus {
  border-color: var(--vscode-focusBorder, #0090f1);
}

.mw-source-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mw-source {
  margin: 0;
  padding: 8px;
  border: 1px solid var(--vscode-panel-border, #474747);
  border-radius: 3px;
  background: var(--vscode-editor-background, #1e1e1e);
  color: var(--vscode-editor-foreground, #ccc);
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--calcpad-font-size-sm, 12px);
  white-space: pre-wrap;
  word-break: break-all;
}

.mw-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--vscode-panel-border, #474747);
}

.mw-spacer {
  flex: 1;
}

.mw-btn {
  padding: 4px 14px;
  border: 1px solid var(--vscode-input-border, #767676);
  border-radius: 3px;
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  color: var(--vscode-button-secondaryForeground, #ccc);
  font: inherit;
  font-size: var(--calcpad-font-size-sm, 12px);
  cursor: pointer;
}

.mw-btn:hover:not(:disabled) {
  background: var(--vscode-button-secondaryHoverBackground, #45494e);
}

.mw-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.mw-btn.mw-primary {
  border-color: transparent;
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #fff);
}

.mw-btn.mw-primary:hover {
  background: var(--vscode-button-hoverBackground, #1177bb);
}
</style>

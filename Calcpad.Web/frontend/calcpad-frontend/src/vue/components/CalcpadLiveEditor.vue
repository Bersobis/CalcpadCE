<template>
  <div class="live-editor">
    <div class="live-head">
      <label class="live-toggle">
        <input
          type="checkbox"
          :checked="active"
          @change="onToggle"
        />
        <span>Whole document</span>
      </label>
      <span class="live-count">{{ summary }}</span>
    </div>

    <!-- One toolbar for the whole canvas, above the content: at sidebar width 21 inline
         buttons per line wrapped into a single column beside each equation. It rides on
         the mode (`active`), not a field, so Insert works before any equation is clicked. -->
    <CalcpadMathToolbar
      v-if="active"
      :handle="handle"
    />

    <div class="live-body">
      <p v-if="!active" class="section-desc">
        Turn this on to see the whole worksheet as typeset maths. Every equation
        becomes editable in place and writes straight back to its line; comments,
        directives and anything the round-trip cannot carry stay as source.
      </p>
      <p v-else-if="!lines.length" class="section-desc">Nothing to preview.</p>

      <template v-else>
        <p v-if="note" :class="['live-note', note.kind]">{{ note.text }}</p>

        <div
          v-for="region in regions"
          :key="region.key"
          class="live-region"
          :class="[region.kind, { 'is-cursor': region.line === cursorLine }]"
          :data-line="region.line"
        >
          <span class="live-gutter">{{ region.line + 1 }}</span>

          <div class="live-content">
            <CalcpadMathField
              v-if="region.kind === 'equation'"
              :model-value="region.text.trim()"
              @commit="(next) => handleApply(region.line, next)"
              @invalid="(_value, error) => handleInvalid(error)"
              @hint="handleHint"
              @active="onActive"
            />
            <pre v-else-if="region.kind !== 'blank'" class="live-raw">{{ region.text }}</pre>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The whole worksheet as typeset maths, each equation editable where it stands.
 *
 * The document text stays the only source of truth: this is a view over it. Each region
 * is classified with `classifyLineEdit`, so a line whose round-trip is not exact renders
 * as source and is never rewritten. Writes go back one line at a time through the same
 * `applyEquation` path the single-line tab uses.
 */
import { computed, ref, shallowRef, watch } from 'vue'
import CalcpadMathField from './CalcpadMathField.vue'
import CalcpadMathToolbar from './CalcpadMathToolbar.vue'
import { classifyLineEdit } from '../../math/roundTrip'
import type { LineEditKind } from '../../math/roundTrip'
import type { MathFieldHandle } from '../../math/mathFieldTools'

type RegionKind = LineEditKind

interface Region {
  key: string
  line: number
  text: string
  kind: RegionKind
}

const props = defineProps<{
  active: boolean
  /** Every line of the active document, in order. */
  lines: string[]
  /** 0-based line the cursor is on, highlighted in the canvas. */
  cursorLine: number
}>()

const emit = defineEmits<{
  'update:active': [active: boolean]
  /** Ask the host to replace `line` with `text`. */
  apply: [line: number, text: string]
}>()

const note = ref<{ kind: 'ok' | 'hint' | 'error'; text: string } | null>(null)
let pending: { line: number; text: string } | null = null

/**
 * The field the toolbar acts on. `shallowRef` on purpose: a plain `ref` wraps an object in
 * a reactive Proxy, so the identity check in `onActive` would compare that Proxy against
 * the field's own handle and never match, leaving the toolbar up after the field let go.
 * The handle is a command surface, not reactive state -- `size` is a getter, so the
 * toolbar's computed still tracks a resize without the ref being deep.
 */
const handle = shallowRef<MathFieldHandle | null>(null)

/**
 * Only the field that currently holds the toolbar can release it. Moving the caret from
 * one equation to the next fires the old field's release *after* the new field's claim,
 * and a naive assignment would let that stale release cancel the toolbar entirely.
 */
function onActive(next: MathFieldHandle, active: boolean): void {
  if (active) handle.value = next
  else if (handle.value === next) handle.value = null
}

/**
 * Consecutive non-equation lines collapse into one region, so a run of comments reads
 * as the block the author wrote rather than as a stack of separate boxes.
 */
const regions = computed<Region[]>(() => {
  const out: Region[] = []
  for (const [line, text] of props.lines.entries()) {
    const kind = classifyLineEdit(text)
    const last = out[out.length - 1]
    // Blanks break a run rather than joining it, so paragraph spacing survives; a run of
    // them then collapses to nothing.
    const joins = last !== undefined && kind !== 'equation' && kind !== 'blank'
      && last.kind !== 'equation' && last.kind !== 'blank'
    if (joins) last.text += `\n${text}`
    else out.push({ key: `${line}:${kind}`, line, text, kind })
  }
  return out.filter((r) => r.kind !== 'blank')
})

const summary = computed(() => {
  if (!props.active) return ''
  const equations = regions.value.filter((r) => r.kind === 'equation').length
  return `${equations} of ${props.lines.length} lines editable`
})

function onToggle(event: Event): void {
  const next = (event.target as HTMLInputElement).checked
  note.value = null
  pending = null
  handle.value = null
  emit('update:active', next)
}

function handleApply(line: number, next: string): void {
  const region = regions.value.find((r) => r.line === line)
  if (!region || region.kind !== 'equation') return
  pending = { line, text: next }
  emit('apply', line, next)
}

function handleInvalid(error: string): void {
  note.value = { kind: 'error', text: `Nothing written — ${error}.` }
}

function handleHint(text: string): void {
  note.value = { kind: 'hint', text }
}

// The host echoes the document after every write, so the echo is what confirms it.
watch(() => props.lines, () => {
  if (!pending) return
  const sent = pending
  pending = null
  note.value = props.lines[sent.line]?.trim() === sent.text
    ? { kind: 'ok', text: `Written to line ${sent.line + 1}.` }
    : { kind: 'error', text: 'The editor refused the change — this document is read-only.' }
})
</script>

<style scoped>
.live-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.live-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vscode-widget-border);
}

.live-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: var(--calcpad-font-size-md);
}

.live-count {
  font-size: var(--calcpad-font-size-sm);
  color: var(--vscode-descriptionForeground);
}

.live-body {
  overflow-y: auto;
  flex: 1;
  padding: 8px 0;
}

.live-region {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 3px 12px;
  font-size: var(--calcpad-font-size-lg);
}

.live-region.equation:hover {
  background: var(--vscode-list-hoverBackground);
}

.live-gutter {
  flex: 0 0 auto;
  min-width: 2em;
  text-align: right;
  font-size: var(--calcpad-font-size-sm);
  color: var(--vscode-editorLineNumber-foreground);
  user-select: none;
}

.live-content {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}

/* Where the text cursor is, so the canvas and the editor can be read together. */
.live-region.is-cursor .live-gutter {
  color: var(--vscode-editorLineNumber-activeForeground, var(--vscode-foreground));
  font-weight: 600;
}

.live-raw {
  margin: 0;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--calcpad-font-size-md);
  color: var(--vscode-descriptionForeground);
  white-space: pre-wrap;
  word-break: break-word;
}

.live-note {
  margin: 0 12px 8px;
  font-size: var(--calcpad-font-size-sm);
}

.live-note.ok {
  color: var(--vscode-charts-green, var(--vscode-foreground));
}

.live-note.hint {
  color: var(--vscode-descriptionForeground);
}

.live-note.error {
  color: var(--vscode-errorForeground, var(--vscode-foreground));
}
</style>
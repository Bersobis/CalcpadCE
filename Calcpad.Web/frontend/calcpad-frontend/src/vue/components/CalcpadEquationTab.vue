<template>
  <div class="equation-tab">
    <CalcpadLiveEditor
      :active="live"
      :lines="lines"
      :cursor-line="line"
      @update:active="emit('update:live', $event)"
      @apply="(l, t) => emit('apply', l, t)"
    />

    <div v-if="!live" class="equation-container p-3">
      <template v-if="kind === 'pending'">
        <h3 class="section-title">Equation</h3>
        <p class="section-desc">
          Put the cursor on a line in the editor and it appears here as maths.
        </p>
      </template>

      <template v-else>
        <div class="equation-head">
          <h3 class="section-title">Line {{ line + 1 }}</h3>
          <span class="equation-kind">{{ kindLabel }}</span>
        </div>

        <div v-if="kind === 'equation'" class="equation-canvas">
          <CalcpadMathField
            :model-value="trimmed"
            @commit="handleApply"
            @invalid="handleInvalid"
            @hint="handleHint"
            @active="onActive"
          />
        </div>
        <CalcpadMathToolbar
          v-if="kind === 'equation' && handle"
          :handle="handle"
        />
        <pre v-else class="equation-raw">{{ text }}</pre>

        <p v-if="kind === 'notMath'" class="section-desc">
          This is a comment, label or directive, not an equation — it passes through
          the canvas untouched, so edit it in the text editor.
        </p>
        <p v-else-if="kind === 'lossy'" class="section-desc">
          The visual round-trip is not exact for this line, so it is shown as source
          rather than rewritten. Edit it in the text editor.
        </p>
        <p v-else-if="kind !== 'blank'" class="section-desc">
          Click the equation to edit it. <code>Esc</code> reverts without writing.
        </p>

        <div class="equation-source">
          <span class="equation-source__label">Calcpad source</span>
          <code>{{ text }}</code>
        </div>

        <p v-if="note" :class="['equation-note', note.kind]">{{ note.text }}</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The line under the cursor, typeset, edited in place, written back to that line.
 * A line is only handed to the field when the round-trip reproduces it, so a construct
 * the printer cannot carry is shown as source rather than silently rewritten.
 */
import { computed, ref, shallowRef, watch } from 'vue'
import CalcpadMathField from './CalcpadMathField.vue'
import CalcpadMathToolbar from './CalcpadMathToolbar.vue'
import CalcpadLiveEditor from './CalcpadLiveEditor.vue'
import { classifyLineEdit } from '../../math/roundTrip'
import type { LineEditKind } from '../../math/roundTrip'
import type { MathFieldHandle } from '../../math/mathFieldTools'

type LineKind = 'pending' | LineEditKind

const props = defineProps<{
  /** 0-based line number in the active document, or -1 when there is none. */
  line: number
  /** Raw text of that line, exactly as the editor holds it. */
  text: string
  /** Whole document, for the live canvas. */
  lines: string[]
  /** Whether the live canvas is on screen instead of the single line. */
  live: boolean
}>()

const emit = defineEmits<{
  /** Ask the host to replace `line` with `text` in the editor. */
  apply: [line: number, text: string]
  'update:live': [live: boolean]
}>()

const trimmed = computed(() => props.text.trim())

const kind = computed<LineKind>(() =>
  props.line < 0 ? 'pending' : classifyLineEdit(props.text)
)

const KIND_LABEL: Record<Exclude<LineKind, 'pending'>, string> = {
  blank: 'Empty line',
  notMath: 'Not an equation',
  lossy: 'Unsafe to edit visually',
  equation: 'Equation',
}
const kindLabel = computed(() => (kind.value === 'pending' ? '' : KIND_LABEL[kind.value]))

const note = ref<{ kind: 'ok' | 'hint' | 'error'; text: string } | null>(null)
// The host echoes the line back after every write, so the echo is what confirms it.
let pending: string | null = null

/**
 * The field the toolbar acts on. `shallowRef` on purpose: a plain `ref` wraps an object in
 * a reactive Proxy, so the identity check in `onActive` would compare that Proxy against
 * the field's own handle and never match, leaving the toolbar up after the field let go.
 */
const handle = shallowRef<MathFieldHandle | null>(null)

/**
 * Only the field that currently holds the toolbar can release it, so a stale release
 * arriving after a new claim cannot cancel the toolbar the user is looking at.
 */
function onActive(next: MathFieldHandle, active: boolean): void {
  if (active) handle.value = next
  else if (handle.value === next) handle.value = null
}

function handleApply(next: string): void {
  if (kind.value !== 'equation') return
  pending = next
  emit('apply', props.line, next)
}

function handleInvalid(_value: string, error: string): void {
  note.value = { kind: 'error', text: `Nothing written — ${error}.` }
}

function handleHint(text: string): void {
  note.value = { kind: 'hint', text }
}

watch(() => props.text, (current) => {
  if (pending === null) return
  const sent = pending
  pending = null
  note.value = current.trim() === sent
    ? { kind: 'ok', text: `Written to line ${props.line + 1}.` }
    : { kind: 'error', text: 'The editor refused the change — this document is read-only.' }
})

watch(() => props.line, () => {
  pending = null
  note.value = null
  handle.value = null
})
</script>

<style scoped>
.equation-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.equation-container {
  overflow-y: auto;
  flex: 1;
  padding: 12px;
}

.equation-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.equation-kind {
  font-size: var(--calcpad-font-size-sm);
  color: var(--vscode-descriptionForeground);
}

/* The typeset expression, on its own so it reads as the subject of the tab. */
.equation-canvas {
  margin: 4px 0 12px;
  font-size: var(--calcpad-font-size-lg);
  overflow-x: auto;
}

.equation-raw {
  margin: 4px 0 12px;
  padding: 12px;
  background: var(--vscode-textCodeBlock-background, var(--vscode-editor-background));
  border: 1px solid var(--vscode-widget-border);
  border-radius: 3px;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--calcpad-font-size-md);
  white-space: pre-wrap;
  word-break: break-word;
}

.equation-source {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--vscode-widget-border);
  font-size: var(--calcpad-font-size-sm);
}

.equation-source__label {
  color: var(--vscode-descriptionForeground);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.equation-source code {
  background: var(--vscode-textCodeBlock-background);
  padding: 4px 6px;
  border-radius: 2px;
  font-family: var(--vscode-editor-font-family, monospace);
  white-space: pre-wrap;
  word-break: break-word;
}

.equation-note {
  margin: 8px 0 0;
  font-size: var(--calcpad-font-size-sm);
  line-height: 1.5;
}

.equation-note.ok {
  color: var(--vscode-charts-green, var(--vscode-foreground));
}

.equation-note.hint {
  color: var(--vscode-descriptionForeground);
}

.equation-note.error {
  color: var(--vscode-errorForeground, var(--vscode-foreground));
}
</style>

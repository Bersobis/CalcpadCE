<template>
  <div class="live-editor-tab">
    <!-- Toolbar -->
    <div class="le-toolbar">
      <label class="le-toggle">
        <input v-model="editor.wholeDocument.value" type="checkbox" />
        <span>Whole document</span>
      </label>
      <span class="le-count">{{ editor.editableCount.value }} of {{ editor.totalLines.value }} lines editable</span>
      <span
        v-if="editor.errorCount.value > 0"
        class="le-error-count"
        :title="`${editor.errorCount.value} line${editor.errorCount.value === 1 ? '' : 's'} cannot be calculated`"
      >{{ editor.errorCount.value }} {{ editor.errorCount.value === 1 ? 'error' : 'errors' }}</span>
      <button
        class="le-icon-btn"
        title="Reveal the active line in the editor"
        aria-label="Reveal the active line in the editor"
        @click="revealActiveLine"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
          <circle cx="7" cy="7" r="4.2" />
          <line x1="10.2" y1="10.2" x2="14" y2="14" />
        </svg>
      </button>
      <button
        class="le-icon-btn"
        :class="{ on: keyboardOpen }"
        title="Math keyboard"
        aria-label="Math keyboard"
        @click="keyboardOpen = !keyboardOpen"
      >
        <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round">
          <rect x="1.4" y="3.4" width="13.2" height="9.2" rx="1.2" />
          <line x1="4.2" y1="6.4" x2="4.2" y2="6.4" stroke-linecap="round" />
          <line x1="6.9" y1="6.4" x2="6.9" y2="6.4" stroke-linecap="round" />
          <line x1="9.6" y1="6.4" x2="9.6" y2="6.4" stroke-linecap="round" />
          <line x1="12.3" y1="6.4" x2="12.3" y2="6.4" stroke-linecap="round" />
          <line x1="4.2" y1="9.6" x2="11.8" y2="9.6" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <button class="le-insert" title="Open the matrix insertion wizard" @click="wizardOpen = true">
      <span class="le-insert-arrow">↓</span> Insert
    </button>
    <p class="le-status" :class="{ error: editor.statusIsError.value }">{{ editor.status.value }}</p>

    <!-- Document lines -->
    <div class="le-lines">
      <div
        v-for="line in editor.visibleLines.value"
        :key="line.number"
        class="le-line"
        :class="{
          active: line.number === editor.activeLine.value,
          editable: line.editable,
          muted: !line.editable
        }"
        :title="line.editable
          ? 'Click a symbol to change it here, or the line to edit its source.'
          : 'Comments and spacing are not calculated, so there is nothing to edit live.'"
        @click="onLineClick(line, $event)"
      >
        <button
          class="le-line-no"
          :class="writeStatus.resolveState(line)"
          type="button"
          :title="writeStateTitle(writeStatus.resolveState(line))"
          @click.stop="editor.revealLine(line.number)"
        >{{ line.number }}</button>
        <div
          :ref="(el) => setLineBody(line.number, el as HTMLElement | null)"
          class="le-line-body"
        >
          <span v-if="!line.editable" class="le-rendered le-text" v-html="renderedFor(line)"></span>
          <template v-else>
            <span
              v-if="editor.hasBackdrop(line)"
              class="le-rendered le-backdrop"
              v-html="slotHtmlFor(line)"
            ></span>
            <input
              v-if="!editor.hasBackdrop(line) || editingLine === line.number"
              :ref="(el) => setLineInput(line.number, el as HTMLInputElement | null)"
              v-model="editor.drafts.value[line.number]"
              class="le-input"
              :class="{ strip: editor.hasBackdrop(line) }"
              :title="editor.hasBackdrop(line) ? 'Source of the equation above — it stays rendered as you type.' : undefined"
              :placeholder="placeholderFor(line)"
              type="text"
              spellcheck="false"
              autocomplete="off"
              @input="editor.onDraftInput(line.number)"
              @focus="editor.onLineFocus(line.number)"
              @blur="editor.onLineBlur(line.number)"
              @keydown.enter.prevent="editor.commitDraft(line.number)"
            />
            <input
              v-if="editor.slotEdit.value != null && editor.slotEdit.value.line === line.number"
              :ref="(el) => setSlotInput(el as HTMLInputElement | null)"
              class="le-slot-input"
              :style="editor.slotStyle.value"
              :value="editor.slotEdit.value.value"
              :aria-label="`Edit ${editor.slotEdit.value.value} in line ${line.number}`"
              :title="'Tab for the next piece, Escape to leave it as it was'"
              spellcheck="false"
              autocomplete="off"
              @input="onSlotInput"
              @blur="onSlotBlur"
              @keydown.esc.prevent="editor.cancelSlotEdit()"
              @keydown.enter.prevent="moveSlotEdit(1)"
              @keydown.tab.prevent="moveSlotEdit($event.shiftKey ? -1 : 1)"
            />
          </template>
        </div>
      </div>
      <p v-if="editor.visibleLines.value.length === 0" class="le-empty">No editable lines in this document yet.</p>
    </div>

    <CalcpadMatrixWizard
      :open="wizardOpen"
      :lines="editor.lines.value"
      :active-line="editor.activeLine.value"
      @close="wizardOpen = false"
      @insert="onWizardInsert"
    />

    <CalcpadMathKeyboard :visible="keyboardOpen" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CalcpadMathKeyboard from './CalcpadMathKeyboard.vue'
import CalcpadMatrixWizard from './CalcpadMatrixWizard.vue'
import { useLiveEditor } from '../composables/useLiveEditor'
import { useWriteStatus } from '../composables/useWriteStatus'
import type { LiveLine } from '../../services/live-document'
import { isLiveDocumentMessage, isLiveLineWrittenMessage } from '../types/live-editor-messages'

// ---- Composables -----------------------------------------------------------

const editor = useLiveEditor({ debounceMs: 350, savedTickMs: 1400 })
const writeStatus = useWriteStatus({ savedTickMs: 1400 })

// ---- UI state (local to the component) -------------------------------------

const keyboardOpen = ref(false)
const wizardOpen = ref(false)

// ---- DOM refs --------------------------------------------------------------

const lineInputs = new Map<number, HTMLInputElement>()
function setLineInput(line: number, el: HTMLInputElement | null): void {
    if (el == null) lineInputs.delete(line)
    else lineInputs.set(line, el)
}

const lineBodies = new Map<number, HTMLElement>()
function setLineBody(line: number, el: HTMLElement | null): void {
    if (el == null) lineBodies.delete(line)
    else lineBodies.set(line, el)
}

const slotInputEl = ref<HTMLInputElement | null>(null)
function setSlotInput(el: HTMLInputElement | null): void {
    slotInputEl.value = el
}

/** Debounce timer for slot input commits. */
let slotWriteTimer: ReturnType<typeof setTimeout> | null = null
const SLOT_DEBOUNCE_MS = 350

// ---- Click handling --------------------------------------------------------

function onLineClick(line: LiveLine, event: MouseEvent): void {
    if (!line.editable) return
    editor.setActive(line.number)

    const target = event.target as Element | null
    const piece = target != null && typeof target.closest === 'function'
        ? target.closest('[data-ms-slot]') as HTMLElement | null
        : null
    if (piece != null && editor.hasBackdrop(line)) {
        const body = lineBodies.get(line.number)
        if (body != null) editor.openSlotEdit(line, piece, body)
        return
    }

    editor.editingLine.value = line.number
    editor.closeSlotEdit()
    nextTick(() => {
        const field = lineInputs.get(line.number)
        field?.focus()
        field?.setSelectionRange(field.value.length, field.value.length)
    })
}

// ---- Slot editing ----------------------------------------------------------

function onSlotInput(event: Event): void {
    const edit = editor.slotEdit.value
    if (edit == null) return
    edit.value = (event.target as HTMLInputElement).value
    writeStatus.setState(edit.line, 'pending')
    if (slotWriteTimer != null) clearTimeout(slotWriteTimer)
    slotWriteTimer = setTimeout(() => {
        slotWriteTimer = null
        editor.commitSlotEdit()
    }, SLOT_DEBOUNCE_MS)
}

function onSlotBlur(event: FocusEvent): void {
    const field = event.target as HTMLInputElement | null
    if (field != null && field !== slotInputEl.value) return
    editor.closeSlotEdit()
}

function moveSlotEdit(direction: 1 | -1): void {
    const edit = editor.slotEdit.value
    if (edit == null) return
    editor.closeSlotEdit()
    const line = editor.lines.value.find(l => l.number === edit.line)
    if (line == null) return

    const here = slotMapFor(line)?.slots ?? []
    const next = edit.slotIndex + direction
    if (next >= 0 && next < here.length) {
        openSlotAt(line, next)
        return
    }

    const walkable = editor.visibleLines.value.filter(
        l => l.editable && (slotMapFor(l)?.slots.length ?? 0) > 0
    )
    const at = walkable.findIndex(l => l.number === line.number)
    const target = at < 0 ? undefined : walkable[at + direction]
    if (target != null) {
        const targetSlots = slotMapFor(target)?.slots ?? []
        openSlotAt(target, direction > 0 ? 0 : targetSlots.length - 1)
        return
    }

    const editable = editor.visibleLines.value.filter(l => l.editable)
    const lineAt = editable.findIndex(l => l.number === line.number)
    const nextLine = lineAt < 0 ? undefined : editable[lineAt + direction]
    if (nextLine == null) return
    editor.setActive(nextLine.number)
    editor.editingLine.value = nextLine.number
    nextTick(() => {
        const field = lineInputs.get(nextLine.number)
        field?.focus()
        field?.setSelectionRange(field.value.length, field.value.length)
    })
}

function openSlotAt(line: LiveLine, index: number): void {
    const piece = lineBodies.get(line.number)?.querySelector(`[data-ms-slot="${index}"]`) as HTMLElement | null
    if (piece == null) {
        editor.closeSlotEdit()
        return
    }
    const body = lineBodies.get(line.number)
    if (body == null) return
    editor.setActive(line.number)
    editor.openSlotEdit(line, piece, body)
}

// ---- Rendering helpers -----------------------------------------------------

function renderedFor(line: LiveLine): string {
    const raw = line.rendered
    if (raw == null) return escapeHtml(line.text)
    return editor.cache.getSanitized(raw)
}

function slotHtmlFor(line: LiveLine): string {
    return slotMapFor(line)?.html ?? renderedFor(line)
}

function slotMapFor(line: LiveLine) {
    const raw = line.rendered
    if (raw == null || line.error === true) return null
    return editor.cache.getSlotMap(renderedFor(line), line.text)
}

function placeholderFor(line: LiveLine): string | undefined {
    if (editor.drafts.value[line.number] != null && editor.drafts.value[line.number].length > 0) return undefined
    if (line.number === editor.totalLines.value && line.editable) return 'Type a calculation, or build a matrix below'
    return undefined
}

// ---- Write status UI -------------------------------------------------------

const WRITE_STATE_TITLES: Record<NonNullable<ReturnType<typeof writeStatus.resolveState>>, string> = {
    pending: 'Writing this line…',
    saved: 'Line written',
    error: 'This line does not calculate — check the expression',
}

function writeStateTitle(state: ReturnType<typeof writeStatus.resolveState>): string {
    if (state == null) return ''
    return WRITE_STATE_TITLES[state] ?? ''
}

// ---- Wizard ----------------------------------------------------------------

function onWizardInsert(payload: { line: number; text: string }): void {
    editor.onWizardInsert(payload)
    wizardOpen.value = false
    nextTick(scrollActiveLineIntoView)
}

// ---- Navigation ------------------------------------------------------------

function revealActiveLine(): void {
    if (editor.activeLine.value == null) return
    editor.revealLine(editor.activeLine.value)
}

function scrollActiveLineIntoView(): void {
    if (editor.activeLine.value == null) return
    const body = lineBodies.get(editor.activeLine.value)
    body?.closest('.le-line')?.scrollIntoView({ block: 'nearest' })
}

// ---- Message handling ------------------------------------------------------

const onMessage = (event: MessageEvent) => {
    const message = event.data
    if (message == null || typeof message !== 'object') return
    if (isLiveDocumentMessage(message)) editor.applyLiveDocument(message)
    else if (isLiveLineWrittenMessage(message)) editor.onLineWritten(message)
}

onMounted(() => {
    window.addEventListener('message', onMessage)
    editor.requestDocument()
})

onBeforeUnmount(() => {
    window.removeEventListener('message', onMessage)
    editor.dispose()
})

// ---- Keyboard watch --------------------------------------------------------

watch(keyboardOpen, () => setTimeout(scrollActiveLineIntoView, 160))

// ---- Utilities -------------------------------------------------------------

function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, c =>
        c === '&' ? '&amp;'
            : c === '<' ? '&lt;'
                : c === '>' ? '&gt;'
                    : c === '"' ? '&quot;'
                        : '&#39;'
    )
}
</script>

<style scoped>
/* ---- Keep all existing styles below this line ---- */
.live-editor-tab {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  padding: 10px;
  padding-bottom: calc(10px + var(--live-keyboard-h, 0px));
  box-sizing: border-box;
  transition: padding-bottom 120ms ease;
}

.le-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.le-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--calcpad-font-size-sm, 12px);
  color: var(--vscode-foreground, #ccc);
  cursor: pointer;
  white-space: nowrap;
}

.le-toggle input {
  margin: 0;
  accent-color: var(--vscode-button-background, #0e639c);
}

.le-count {
  flex: 1;
  min-width: 0;
  font-size: var(--calcpad-font-size-xs, 11px);
  color: var(--vscode-descriptionForeground, #888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.le-error-count {
  flex: none;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--vscode-errorForeground, #f48771);
  color: #1e1e1e;
  font-size: var(--calcpad-font-size-xxs, 9px);
  font-weight: 600;
  white-space: nowrap;
}

.le-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 22px;
  flex: none;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--vscode-descriptionForeground, #888);
  cursor: pointer;
}

.le-icon-btn:hover {
  background: var(--vscode-list-hoverBackground, #2a2d2e);
  color: var(--vscode-foreground, #ccc);
}

.le-icon-btn.on {
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #fff);
}

.le-insert {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--vscode-button-background, #0e639c);
  border-radius: 4px;
  background: transparent;
  color: var(--vscode-button-background, #0e639c);
  font-size: var(--calcpad-font-size-sm, 12px);
  cursor: pointer;
  align-self: flex-start;
}

.le-insert:hover {
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #fff);
}

.le-insert-arrow {
  font-size: 10px;
}

.le-status {
  margin: 0;
  font-size: var(--calcpad-font-size-xs, 11px);
  color: var(--vscode-descriptionForeground, #888);
  min-height: 14px;
}

.le-status.error {
  color: var(--vscode-errorForeground, #f48771);
}

.le-lines {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.le-line {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 3px 4px;
  border-radius: 4px;
  transition: background 80ms;
}

.le-line:hover {
  background: var(--vscode-list-hoverBackground, #2a2d2e);
}

.le-line.active {
  background: var(--vscode-list-activeSelectionBackground, #094771);
}

.le-line.muted {
  opacity: 0.65;
}

.le-line-no {
  flex: none;
  width: 28px;
  padding: 2px 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--vscode-descriptionForeground, #888);
  font-size: var(--calcpad-font-size-xs, 11px);
  font-family: var(--vscode-editor-font-family, monospace);
  text-align: right;
  cursor: pointer;
}

.le-line-no:hover {
  color: var(--vscode-foreground, #ccc);
  background: var(--vscode-list-hoverBackground, #2a2d2e);
}

.le-line-no.pending {
  color: var(--vscode-textLink-foreground, #3794ff);
  animation: le-pulse 1s ease-in-out infinite;
}

.le-line-no.saved {
  color: var(--vscode-testing-iconPassed, #89d185);
}

.le-line-no.error {
  color: var(--vscode-errorForeground, #f48771);
  font-weight: 600;
}

@keyframes le-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.le-line-body {
  flex: 1;
  min-width: 0;
  position: relative;
}

.le-rendered {
  display: inline;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--vscode-editor-font-size, 14px);
}

.le-rendered.le-text {
  color: var(--vscode-foreground, #ccc);
  white-space: pre-wrap;
  word-break: break-word;
}

.le-rendered.le-backdrop {
  cursor: text;
  user-select: none;
}

.le-rendered.le-backdrop :deep([data-ms-slot]) {
  cursor: pointer;
  border-bottom: 1px dotted var(--vscode-textLink-foreground, #3794ff);
}

.le-rendered.le-backdrop :deep([data-ms-slot]:hover) {
  background: var(--vscode-editor-selectionBackground, #264f78);
}

.le-input {
  width: 100%;
  padding: 2px 6px;
  border: 1px solid var(--vscode-input-border, #5a5a5a);
  border-radius: 3px;
  background: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #ccc);
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--vscode-editor-font-size, 14px);
  box-sizing: border-box;
}

.le-input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder, #007fd4);
}

.le-input.strip {
  margin-top: 4px;
}

.le-slot-input {
  position: absolute;
  padding: 0 2px;
  border: 1px solid var(--vscode-focusBorder, #007fd4);
  border-radius: 2px;
  background: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #ccc);
  font-family: var(--vscode-editor-font-family, monospace);
  box-sizing: border-box;
  z-index: 10;
}

.le-slot-input:focus {
  outline: none;
}

.le-empty {
  margin: 0;
  padding: 12px;
  text-align: center;
  color: var(--vscode-descriptionForeground, #888);
  font-size: var(--calcpad-font-size-sm, 12px);
}
</style>

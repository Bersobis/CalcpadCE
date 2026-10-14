/**
 * Orchestrates the live editor's state, editing, and host communication.
 *
 * This composable wires together document sync, line editing, slot editing,
 * write status tracking, and render caching into a single cohesive interface
 * for the `CalcpadLiveEditorTab` component.
 */

import { ref, nextTick, watch } from 'vue'
import { postMessage } from '../services/messaging'
import type { LiveLine } from '../../services/live-document'
import type { LiveDocumentMessage, LiveLineWrittenMessage } from '../types/live-editor-messages'
import { useLiveDocument } from './useLiveDocument'
import { useLineEditing } from './useLineEditing'
import { useSlotEditing } from './useSlotEditing'
import { useWriteStatus } from './useWriteStatus'
import { useRenderCache } from './useRenderCache'

export interface UseLiveEditorOptions {
    /** How long typing sits still before it is written to the document. */
    debounceMs?: number
    /** How long the "saved" tick stays visible. */
    savedTickMs?: number
}

export function useLiveEditor(options: UseLiveEditorOptions = {}) {
    const status = ref('')
    const statusIsError = ref(false)
    const editingLine = ref<number | null>(null)

    const cache = useRenderCache()
    const writeStatus = useWriteStatus({ savedTickMs: options.savedTickMs })
    const lineEditing = useLineEditing({
        debounceMs: options.debounceMs,
        onStateChange: (line, state) => writeStatus.setState(line, state),
    })
    const slotEditing = useSlotEditing({
        onCommit: (line, nextText) => {
            lineEditing.drafts.value[line] = nextText
            lineEditing.writeLine(line, nextText)
        },
    })
    const liveDoc = useLiveDocument({
        onUpdate: (incoming) => {
            lineEditing.syncDrafts(incoming, lineEditing.focusedLine.value)
        },
    })

    // ---- Document sync -------------------------------------------------------

    function requestDocument(): void {
        postMessage({ type: 'getLiveDocument' })
    }

    function applyLiveDocument(msg: LiveDocumentMessage): void {
        // Commit any open slot edit before the document changes underneath it
        if (slotEditing.slotEdit.value != null) {
            const line = slotEditing.slotEdit.value.line
            const text = lineEditing.drafts.value[line] ?? ''
            slotEditing.close((n) => lineEditing.drafts.value[n] ?? text)
        }
        liveDoc.applyMessage(msg)
        nextTick(() => {
            if (slotEditing.slotEdit.value != null) {
                // Re-position the slot edit after re-render
                const line = liveDoc.lines.value.find(
                    l => l.number === slotEditing.slotEdit.value!.line
                )
                if (line != null) {
                    // Position will be refreshed by the component via refs
                }
            }
        })
    }

    function onLineWritten(msg: LiveLineWrittenMessage): void {
        const line = msg.line
        if (!msg.ok) {
            writeStatus.setState(line, 'error')
            setStatus(String(msg.error ?? 'That line could not be written.'), true)
            return
        }
        writeStatus.setState(line, 'saved')
    }

    // ---- Status --------------------------------------------------------------

    function setStatus(text: string, isError: boolean): void {
        status.value = text
        statusIsError.value = isError
    }

    // ---- Line editing --------------------------------------------------------

    function onLineFocus(line: number): void {
        lineEditing.setFocus(line)
        liveDoc.setActive(line)
        editingLine.value = line
    }

    function onLineBlur(line: number): void {
        if (lineEditing.focusedLine.value === line) {
            lineEditing.setFocus(null)
        }
        lineEditing.flushLine(line)
    }

    /** Called on every keystroke in a line input — starts the write debounce. */
    function onDraftInput(line: number): void {
        lineEditing.onInput(line)
    }

    function commitDraft(line: number): void {
        lineEditing.commit(line)
        setStatus(`Written to line ${line}.`, false)
    }

    // ---- Slot editing --------------------------------------------------------

    function openSlotEdit(line: LiveLine, piece: HTMLElement, body: HTMLElement): void {
        const index = Number(piece.getAttribute('data-ms-slot'))
        const map = cache.getSlotMap(renderedFor(line), line.text)
        const slot = map?.slots[index]
        if (slot == null) return
        editingLine.value = null
        slotEditing.open(line, piece, slot, body)
    }

    function moveSlotEdit(direction: 1 | -1): void {
        const edit = slotEditing.slotEdit.value
        if (edit == null) return
        slotEditing.commit((n) => lineEditing.drafts.value[n] ?? '')
        // Navigation logic handled by the component which has DOM access
    }

    function cancelSlotEdit(): void {
        const edit = slotEditing.slotEdit.value
        if (edit == null) return
        lineEditing.cancelTimer(edit.line)
        slotEditing.cancel((n) => lineEditing.drafts.value[n] ?? '')
        slotEditing.dispose()
    }

    function closeSlotEdit(): void {
        slotEditing.close((n) => lineEditing.drafts.value[n] ?? '')
    }

    /** Commits the current slot edit value back to the source. */
    function commitSlotEdit(): void {
        slotEditing.commit((n) => lineEditing.drafts.value[n] ?? '')
    }

    // ---- Rendering helpers ---------------------------------------------------

    /** What a line shows: rendered maths when available, escaped source otherwise. */
    function renderedFor(line: LiveLine): string {
        const raw = line.rendered
        if (raw == null) return escapeHtml(line.text)
        return cache.getSanitized(raw)
    }

    /** Slot-wrapped HTML for a line, or the rendered form if no slots. */
    function slotHtmlFor(line: LiveLine): string {
        const raw = line.rendered
        if (raw == null || line.error === true) return renderedFor(line)
        const map = cache.getSlotMap(renderedFor(line), line.text)
        return map?.html ?? renderedFor(line)
    }

    /** Whether the line has rendered maths to show as a backdrop. */
    function hasBackdrop(line: LiveLine): boolean {
        return line.rendered != null && !line.text.trim().startsWith("'")
    }

    // ---- Wizard --------------------------------------------------------------

    function onWizardInsert(payload: { line: number; text: string }): void {
        closeSlotEdit()
        lineEditing.writeImmediate(payload.line, payload.text)
        liveDoc.setActive(payload.line)
    }

    // ---- Navigation ----------------------------------------------------------

    function revealLine(line: number): void {
        postMessage({ type: 'goToLine', line })
    }

    // ---- Lifecycle -----------------------------------------------------------

    function dispose(): void {
        closeSlotEdit()
        lineEditing.flushAll()
        lineEditing.dispose()
        writeStatus.dispose()
        cache.clear()
    }

    // Watch whole-document toggle to reset editing state
    watch(liveDoc.wholeDocument, (on) => {
        closeSlotEdit()
        editingLine.value = null
        if (!on && liveDoc.activeLine.value == null) {
            const target = liveDoc.lines.value.find(l => l.editable)
            if (target) {
                liveDoc.setActive(target.number)
                lineEditing.lastSent.value[target.number] = target.text
            }
        }
    })

    return {
        // Document
        ...liveDoc,
        // Editing
        drafts: lineEditing.drafts,
        focusedLine: lineEditing.focusedLine,
        editingLine,
        // Slot editing
        slotEdit: slotEditing.slotEdit,
        slotBox: slotEditing.slotBox,
        slotStyle: slotEditing.slotStyle,
        // Status
        status,
        statusIsError,
        writeStatus,
        // Cache
        cache,
        // Actions
        requestDocument,
        applyLiveDocument,
        onLineWritten,
        onLineFocus,
        onLineBlur,
        onDraftInput,
        commitDraft,
        openSlotEdit,
        moveSlotEdit,
        cancelSlotEdit,
        closeSlotEdit,
        commitSlotEdit,
        renderedFor,
        slotHtmlFor,
        hasBackdrop,
        onWizardInsert,
        revealLine,
        setStatus,
        dispose,
    }
}

function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, c =>
        c === '&' ? '&amp;'
            : c === '<' ? '&lt;'
                : c === '>' ? '&gt;'
                    : c === '"' ? '&quot;'
                        : '&#39;'
    )
}

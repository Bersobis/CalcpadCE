/**
 * Draft text editing with debounced writes back to the host.
 *
 * Each editable line has a draft — the text currently in its input field. Drafts
 * are written back to the host after a debounce, or immediately on Enter or blur.
 * The last-sent text is remembered so a refresh that only echoes our own write
 * back does not mark the line dirty.
 */

import { ref, computed } from 'vue'
import { postMessage } from '../services/messaging'
import type { LiveLine } from '../../services/live-document'

export interface UseLineEditingOptions {
    /** How long typing sits still before it is written to the document. */
    debounceMs?: number
    /** Called whenever a line's write state changes. */
    onStateChange?: (line: number, state: 'pending' | 'saved' | 'error') => void
}

export function useLineEditing(options: UseLineEditingOptions = {}) {
    const debounceMs = options.debounceMs ?? 350

    /** What each line's input holds, keyed by line number. */
    const drafts = ref<Record<number, string>>({})
    /** What was last written per line. */
    const lastSent = ref<Record<number, string>>({})
    /** One debounce timer per line. */
    const writeTimers = new Map<number, ReturnType<typeof setTimeout>>()
    /** Which line currently holds the caret. */
    const focusedLine = ref<number | null>(null)

    /**
     * Rebuilds the draft store from incoming document lines. The focused line
     * keeps its current draft so the caret is not disrupted by a refresh.
     */
    function syncDrafts(lines: LiveLine[], preserveLine: number | null): void {
        const next: Record<number, string> = {}
        for (const line of lines) {
            if (line.number === preserveLine) {
                next[line.number] = drafts.value[line.number] ?? line.text
            } else {
                next[line.number] = line.text
            }
        }
        drafts.value = next
    }

    /**
     * Called on every keystroke in a line input. Starts or restarts the debounce.
     */
    function onInput(line: number): void {
        options.onStateChange?.(line, 'pending')
        const pending = writeTimers.get(line)
        if (pending != null) clearTimeout(pending)
        writeTimers.set(line, setTimeout(() => flushLine(line), debounceMs))
    }

    /** Writes a single line to the host immediately, bypassing the debounce. */
    function flushLine(line: number): void {
        const pending = writeTimers.get(line)
        if (pending != null) {
            clearTimeout(pending)
            writeTimers.delete(line)
        }
        const text = drafts.value[line] ?? ''
        if (lastSent.value[line] === text) return
        writeLine(line, text)
    }

    /** Flushes all pending writes. */
    function flushAll(): void {
        for (const line of [...writeTimers.keys()]) flushLine(line)
    }

    /** Commits a line immediately and reports it. */
    function commit(line: number, announce: boolean = false): void {
        flushLine(line)
        if (announce) {
            // Status reporting is handled by the consumer
        }
    }

    /** Sends a line to the host. */
    function writeLine(line: number, text: string): void {
        lastSent.value[line] = text
        options.onStateChange?.(line, 'pending')
        postMessage({ type: 'liveEditLine', line, text })
    }

    /** Writes a line in a single step, with no debounce (used by the wizard). */
    function writeImmediate(line: number, text: string): void {
        drafts.value[line] = text
        writeLine(line, text)
    }

    /** Sets which line is focused. */
    function setFocus(line: number | null): void {
        focusedLine.value = line
        if (line != null) flushAll()
    }

    /** Clears a line's draft back to its original text. */
    function resetDraft(line: number, originalText: string): void {
        drafts.value[line] = originalText
    }

    /** Cancels the pending write timer for a line, if any. */
    function cancelTimer(line: number): void {
        const pending = writeTimers.get(line)
        if (pending != null) {
            clearTimeout(pending)
            writeTimers.delete(line)
        }
    }

    /** Disposes all timers. */
    function dispose(): void {
        for (const timer of writeTimers.values()) clearTimeout(timer)
        writeTimers.clear()
    }

    return {
        drafts,
        lastSent,
        focusedLine,
        syncDrafts,
        onInput,
        flushLine,
        flushAll,
        commit,
        writeLine,
        writeImmediate,
        setFocus,
        resetDraft,
        cancelTimer,
        dispose,
    }
}

/**
 * Synchronises the live editor panel with the host's document state.
 *
 * Handles incoming `liveDocument` messages, maintains line visibility,
 * and tracks the active line for keyboard and wizard interactions.
 */

import { ref, computed } from 'vue'
import type { LiveLine } from '../../services/live-document'
import type { LiveDocumentMessage } from '../types/live-editor-messages'

export interface UseLiveDocumentOptions {
    /** Called when the document is updated. */
    onUpdate?: (lines: LiveLine[]) => void
}

export function useLiveDocument(options: UseLiveDocumentOptions = {}) {
    const lines = ref<LiveLine[]>([])
    const totalLines = ref(0)
    const editableCount = ref(0)

    /** The line the matrix and reveal buttons act on. */
    const activeLine = ref<number | null>(null)
    const wholeDocument = ref(true)

    /**
     * Lines shown in the list. Blank lines are spacing rather than content,
     * so they are shown only at the end of the document where the next
     * expression goes.
     */
    const visibleLines = computed<LiveLine[]>(() => {
        const content = lines.value.filter(
            l => l.text.trim().length > 0 || l.number === totalLines.value
        )
        if (wholeDocument.value) return content
        const active = lines.value.find(l => l.number === activeLine.value)
        if (active) return [active]
        return content.filter(l => l.editable).slice(0, 1)
    })

    /** Editable lines in document order, for the wizard target list. */
    const editableLines = computed<LiveLine[]>(() =>
        lines.value.filter(l => l.editable)
    )

    /** Lines that have rendered maths and are not comments. */
    function hasRenderedMaths(line: LiveLine): boolean {
        return line.rendered != null && !line.text.trim().startsWith("'")
    }

    /**
     * Applies a `liveDocument` message from the host. Preserves the active line
     * when possible, or resets it to the last editable line.
     */
    function applyMessage(msg: LiveDocumentMessage): void {
        const incoming = msg.lines
        lines.value = incoming
        totalLines.value = msg.totalLines
        editableCount.value = msg.editableCount

        const current = incoming.find(l => l.number === activeLine.value)
        if (activeLine.value != null && (current == null || !current.editable)) {
            activeLine.value = null
        }
        if (activeLine.value == null) {
            const target = [...incoming].reverse().find(l => l.editable)
            if (target) activeLine.value = target.number
        }

        options.onUpdate?.(incoming)
    }

    /** Sets the active line. */
    function setActive(line: number | null): void {
        activeLine.value = line
    }

    /** Scrolls the active line into view. */
    function scrollActiveIntoView(scrollFn: (line: number) => void): void {
        if (activeLine.value != null) scrollFn(activeLine.value)
    }

    /** Error count across all lines. */
    const errorCount = computed(() => lines.value.filter(l => l.error === true).length)

    return {
        lines,
        totalLines,
        editableCount,
        activeLine,
        wholeDocument,
        visibleLines,
        editableLines,
        errorCount,
        hasRenderedMaths,
        applyMessage,
        setActive,
        scrollActiveIntoView,
    }
}

/**
 * In-place editing of individual symbols within a rendered equation.
 *
 * When the user clicks a symbol in the typeset maths, a small input field is
 * placed exactly over that symbol. The source range behind the symbol is edited
 * directly, so the expression stays set as maths while one piece changes.
 */

import { ref, nextTick, computed } from 'vue'
import type { LiveLine } from '../../services/live-document'
import type { SlotMap, RenderSlot } from '../services/math-slots'

/** The state of an active slot edit. */
export interface SlotEditState {
    line: number
    slotIndex: number
    start: number
    end: number
    value: string
    /** What the piece read when it was opened, so Escape can put it back. */
    original: string
}

/** Measured geometry for positioning the slot input field. */
export interface SlotBox {
    left: number
    top: number
    minWidth: number
    height: number
    fontFamily: string
    fontSize: string
    fontWeight: string
    fontStyle: string
    color: string
}

export interface UseSlotEditingOptions {
    /** Called when a slot value changes and should be written. */
    onCommit?: (line: number, nextText: string) => void
    /** Called when the slot edit is cancelled. */
    onCancel?: (line: number) => void
}

export function useSlotEditing(options: UseSlotEditingOptions = {}) {
    const slotEdit = ref<SlotEditState | null>(null)
    const slotBox = ref<SlotBox | null>(null)
    let blankedPiece: HTMLElement | null = null

    const slotStyle = computed(() => {
        const box = slotBox.value
        const edit = slotEdit.value
        if (box == null) return undefined
        const grow = edit == null ? 1 : Math.max(1, edit.value.length + 1)
        return {
            left: `${box.left}px`,
            top: `${box.top}px`,
            width: `max(${box.minWidth}px, ${grow}ch)`,
            height: `${box.height}px`,
            fontFamily: box.fontFamily,
            fontSize: box.fontSize,
            fontWeight: box.fontWeight,
            fontStyle: box.fontStyle,
            color: box.color,
        }
    })

    /** Opens a slot edit for the given piece element. */
    function open(
        line: LiveLine,
        piece: HTMLElement,
        slot: RenderSlot,
        body: HTMLElement
    ): void {
        const text = line.text // use the document's current text
        const value = text.slice(slot.start, slot.end)
        slotEdit.value = {
            line: line.number,
            slotIndex: slot.token,
            start: slot.start,
            end: slot.end,
            value,
            original: value,
        }
        nextTick(() => position(piece, body))
    }

    /** Measures the piece and parks the field exactly over it. */
    function position(piece: HTMLElement | null, body: HTMLElement | null): void {
        if (slotEdit.value == null) {
            slotBox.value = null
            return
        }
        if (piece == null || body == null) {
            slotBox.value = null
            return
        }
        const bodyRect = body.getBoundingClientRect()
        const pieceRect = piece.getBoundingClientRect()
        const glyph = piece.firstElementChild instanceof HTMLElement ? piece.firstElementChild : piece
        const style = getComputedStyle(glyph)
        slotBox.value = {
            left: pieceRect.left - bodyRect.left,
            top: pieceRect.top - bodyRect.top,
            minWidth: Math.max(pieceRect.width, 14),
            height: Math.max(pieceRect.height, 18),
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle,
            color: style.color,
        }
        blankPiece(piece)
    }

    /** Updates the edited value from input events. */
    function setValue(value: string): void {
        if (slotEdit.value == null) return
        slotEdit.value.value = value
    }

    /** Commits the current value back into the source text. */
    function commit(getText: (line: number) => string): string | null {
        const edit = slotEdit.value
        if (edit == null) return null
        const text = getText(edit.line)
        if (text.slice(edit.start, edit.end) === edit.value) return null
        const next = text.slice(0, edit.start) + edit.value + text.slice(edit.end)
        edit.end = edit.start + edit.value.length
        options.onCommit?.(edit.line, next)
        return next
    }

    /** Cancels the edit and restores the original value. */
    function cancel(getText: (line: number) => string): string | null {
        const edit = slotEdit.value
        if (edit == null) return null
        if (edit.value !== edit.original) {
            const text = getText(edit.line)
            const next = text.slice(0, edit.start) + edit.original + text.slice(edit.end)
            options.onCommit?.(edit.line, next)
            return next
        }
        return null
    }

    /** Closes the slot edit, committing if there are changes. */
    function close(getText: (line: number) => string): void {
        commit(getText)
        blankPiece(null)
        slotEdit.value = null
        slotBox.value = null
    }

    /** Hides the original piece so the input field appears in its place. */
    function blankPiece(el: HTMLElement | null): void {
        if (blankedPiece != null && blankedPiece !== el) {
            blankedPiece.style.visibility = ''
        }
        blankedPiece = el
        if (el != null) el.style.visibility = 'hidden'
    }

    /** Disposes the slot edit and restores visibility. */
    function dispose(): void {
        blankPiece(null)
        slotEdit.value = null
        slotBox.value = null
    }

    return {
        slotEdit,
        slotBox,
        slotStyle,
        open,
        position,
        setValue,
        commit,
        cancel,
        close,
        blankPiece,
        dispose,
    }
}

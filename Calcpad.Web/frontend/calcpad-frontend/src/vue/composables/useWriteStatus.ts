/**
 * Tracks the write status of individual lines: pending, saved, or error.
 *
 * Each line can be in one of three states:
 * - `pending`: a write is in flight
 * - `saved`: the host confirmed the write
 * - `error`: the host rejected the write or the line itself does not calculate
 *
 * The "saved" state is automatically cleared after a short delay so the UI
 * returns to neutral.
 */

import { ref } from 'vue'

export type LineWriteState = 'pending' | 'saved' | 'error'

export interface UseWriteStatusOptions {
    /** How long the "saved" tick stays visible before clearing. */
    savedTickMs?: number
}

export function useWriteStatus(options: UseWriteStatusOptions = {}) {
    const savedTickMs = options.savedTickMs ?? 1400

    const lineStates = ref<Record<number, LineWriteState>>({})
    const savedTimers = new Map<number, ReturnType<typeof setTimeout>>()

    /**
     * Sets the state of a line. If the state is `saved`, a timer is started
     * that will clear it after `savedTickMs`.
     */
    function setState(line: number, state: LineWriteState): void {
        const timer = savedTimers.get(line)
        if (timer != null) {
            clearTimeout(timer)
            savedTimers.delete(line)
        }
        lineStates.value[line] = state
        if (state !== 'saved') return
        savedTimers.set(
            line,
            setTimeout(() => {
                savedTimers.delete(line)
                if (lineStates.value[line] === 'saved') {
                    delete lineStates.value[line]
                }
            }, savedTickMs)
        )
    }

    /** Reads the current state of a line. */
    function getState(line: number): LineWriteState | null {
        return lineStates.value[line] ?? null
    }

    /** Resolves the effective state, treating a line with `error: true` as `error`. */
    function resolveState(line: { number: number; error?: boolean }): LineWriteState | null {
        if (line.error === true) return 'error'
        return getState(line.number)
    }

    /** Clears all state and timers. */
    function clear(): void {
        for (const timer of savedTimers.values()) clearTimeout(timer)
        savedTimers.clear()
        lineStates.value = {}
    }

    /** Disposes all resources. Should be called on unmount. */
    function dispose(): void {
        clear()
    }

    return {
        lineStates,
        setState,
        getState,
        resolveState,
        clear,
        dispose,
    }
}

import type { UiPauseState } from '../types/api';

/** `pauseAfter` that runs past every `#pause`. */
export const PAUSE_AT_END = 'end';

/** Whether a stepped render found any `#pause` to step through. */
export function hasPauseSteps(state: UiPauseState | null | undefined): boolean {
    return !!state && (state.previous !== null || state.next !== null);
}

/**
 * Where each document's `#UI` form is in its `#pause` steps, held as the `pauseAfter` the
 * next render sends. The server works out the position from that key on every render, so
 * inputs that change loop counts or branches don't move the user to a different step.
 */
export class UiPauseStore {
    private readonly pauseAfterByDocument = new Map<string, string | null>();
    private readonly stateByDocument = new Map<string, UiPauseState>();

    pauseAfter(docKey: string): string | null {
        return this.pauseAfterByDocument.get(docKey) ?? null;
    }

    state(docKey: string): UiPauseState | undefined {
        return this.stateByDocument.get(docKey);
    }

    /** Records a render's result. Reaching the end sticks, so a finished form stays whole. */
    update(docKey: string, state: UiPauseState | undefined): void {
        if (!state) {
            this.stateByDocument.delete(docKey);
            return;
        }
        this.stateByDocument.set(docKey, state);
        if (state.next === null)
            this.pauseAfterByDocument.set(docKey, PAUSE_AT_END);
    }

    /** Moves one step. Returns false when there is no step that way. */
    step(docKey: string, direction: 'next' | 'previous'): boolean {
        const state = this.stateByDocument.get(docKey);
        if (!state) return false;
        if (direction === 'next') {
            if (state.next === null) return false;
            this.pauseAfterByDocument.set(docKey, state.next);
        } else {
            if (state.previous === null) return false;
            this.pauseAfterByDocument.set(docKey, state.previous);
        }
        return true;
    }

    clear(docKey: string): void {
        this.pauseAfterByDocument.delete(docKey);
        this.stateByDocument.delete(docKey);
    }
}

// Undo/redo for the uncommitted edit.
//
// Two layers exist: a *committed* edit becomes a Monaco model edit and is covered by Monaco's
// own stack, but while the math surface has focus Monaco does not, so `Ctrl+Z` would do
// nothing. This widget-level history is scoped to the edit in progress and never touches
// Monaco's stack. Consecutive operations sharing a tag coalesce, so a run of typing is one
// undo step rather than one per keystroke.

export interface Snapshot<T> {
    readonly state: T;
    readonly tag: string;
}

/** Tag used to end a coalescing run; never matches a real operation tag. */
const COALESCING_BREAK = '\u0000break';

export class History<T> {
    private stack: Snapshot<T>[] = [];
    private index = -1;

    constructor(private readonly limit = 200) {}

    reset(state: T): void {
        this.stack = [{ state, tag: 'init' }];
        this.index = 0;
    }

    /** Record a new state. Same tag as the previous step coalesces into it. */
    push(state: T, tag: string): void {
        if (this.index >= 0 && this.stack[this.index].tag === tag) {
            this.stack[this.index] = { state, tag };
            this.stack.length = this.index + 1;
            return;
        }
        this.stack.length = this.index + 1;
        this.stack.push({ state, tag });
        if (this.stack.length > this.limit) this.stack.shift();
        this.index = this.stack.length - 1;
    }

    /**
     * End the current coalescing run without recording a step, so the next `push` starts a new
     * one. Moving the caret calls this: "type `a`, move, type `b`" is two undo steps, but a
     * caret move on its own is not an edit and must not become one.
     */
    breakCoalescing(): void {
        if (this.index < 0) return;
        this.stack[this.index] = { ...this.stack[this.index], tag: COALESCING_BREAK };
    }

    undo(): T | null {
        if (this.index <= 0) return null;
        this.index--;
        return this.stack[this.index].state;
    }

    redo(): T | null {
        if (this.index >= this.stack.length - 1) return null;
        this.index++;
        return this.stack[this.index].state;
    }

    get canUndo(): boolean {
        return this.index > 0;
    }

    get canRedo(): boolean {
        return this.index < this.stack.length - 1;
    }

    get current(): T | null {
        return this.index >= 0 ? this.stack[this.index].state : null;
    }
}

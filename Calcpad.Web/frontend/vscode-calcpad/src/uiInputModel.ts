/**
 * In-memory model for UI input field values.
 * Stores user-entered override values and provides them
 * for re-submission to the convert-ui endpoint.
 */
export interface UiInputEntry {
    variableName: string;
    currentValue: string;
    sourceLine: number;
}

export class UiInputModel {
    private entries: Map<string, UiInputEntry> = new Map();

    /** Update or add a value from a user input change */
    setValue(varName: string, value: string, sourceLine: number): void {
        this.entries.set(varName, {
            variableName: varName,
            currentValue: value,
            sourceLine
        });
    }

    /** Get all override values to send to convert-ui endpoint */
    getOverrides(): Record<string, string> {
        const overrides: Record<string, string> = {};
        for (const [varName, entry] of this.entries) {
            overrides[varName] = entry.currentValue;
        }
        return overrides;
    }

    /** Check if there are any overrides */
    hasOverrides(): boolean {
        return this.entries.size > 0;
    }

    /** Clear all entries (e.g., when source file changes) */
    clear(): void {
        this.entries.clear();
    }
}

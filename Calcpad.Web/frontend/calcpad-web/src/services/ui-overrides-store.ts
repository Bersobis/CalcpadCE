import { reactive, computed } from 'vue';
import { UiOverrideStore, type UiControl, type UiOverrides } from 'calcpad-frontend';

export interface UiOverridesState {
    dirty: boolean;
    controls: UiControl[] | null;
    metadataDirty: boolean;
}

export class ReactiveUiOverridesStore {
    private readonly inner = new UiOverrideStore();
    private readonly states = reactive(new Map<string, UiOverridesState>());
    private readonly seenPaths = new Set<string>();

    private stateFor(docKey: string): UiOverridesState {
        let s = this.states.get(docKey);
        if (!s) {
            s = { dirty: false, controls: null, metadataDirty: false };
            this.states.set(docKey, s);
        }
        return s;
    }

    public isDirty(docKey: string): boolean {
        return this.states.get(docKey)?.dirty ?? false;
    }

    public markDirty(docKey: string): void {
        this.stateFor(docKey).dirty = true;
    }

    public markClean(docKey: string): void {
        const s = this.states.get(docKey);
        if (s) s.dirty = false;
    }

    public getControls(docKey: string): UiControl[] | null {
        return this.states.get(docKey)?.controls ?? null;
    }

    public setControls(docKey: string, controls: UiControl[] | null): void {
        this.stateFor(docKey).controls = controls;
    }

    public invalidateControls(docKey: string): boolean {
        const s = this.states.get(docKey);
        if (!s?.controls) return false;
        s.controls = null;
        return true;
    }

    public isMetadataDirty(docKey: string): boolean {
        return this.states.get(docKey)?.metadataDirty ?? false;
    }

    public setMetadataDirty(docKey: string, dirty: boolean): void {
        this.stateFor(docKey).metadataDirty = dirty;
    }

    public hasSeenPath(path: string): boolean {
        return this.seenPaths.has(path);
    }

    public markPathSeen(path: string): void {
        this.seenPaths.add(path);
    }

    public set(docKey: string, key: string, value: string): boolean {
        return this.inner.set(docKey, key, value);
    }

    public get(docKey: string, key: string): string | undefined {
        return this.inner.get(docKey, key);
    }

    public toRecord(docKey: string): UiOverrides | undefined {
        return this.inner.toRecord(docKey);
    }

    public clear(docKey: string): void {
        this.inner.clear(docKey);
        this.states.delete(docKey);
    }

    public replace(docKey: string, overrides: UiOverrides): void {
        this.inner.replace(docKey, overrides);
    }

    public syncFromSource(docKey: string, source: string): boolean {
        return this.inner.syncFromSource(docKey, source);
    }

    public dirtyComputed(docKey: string) {
        return computed(() => this.isDirty(docKey));
    }
}

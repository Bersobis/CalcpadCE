import type { AppInstance } from '../editor/app-instance';
import type { EditorGroup } from '../editor/editor-group';
import type { EditorBridge } from '../editor/bridge';
import type { ReactiveUiOverridesStore } from '../services/ui-overrides-store';
import { writeUiOverrides } from 'calcpad-frontend';

export interface UiOverridesDependencies {
    appInstance: AppInstance;
    editorBridge: EditorBridge;
    store: ReactiveUiOverridesStore;
    getActiveGroup: () => EditorGroup;
    getActiveDocKey: () => string;
    refreshPreview: (group: EditorGroup) => Promise<void>;
    persistActiveTab: (() => Promise<boolean>) | null;
}

export class UiOverridesManager {
    constructor(private readonly deps: UiOverridesDependencies) {}

    async saveUiOverrides(): Promise<void> {
        const docKey = this.deps.getActiveDocKey();
        const overrides = this.deps.store.toRecord(docKey);
        if (!overrides) return;

        const model = this.deps.getActiveGroup().editor.getModel();
        if (!model) return;

        const updated = writeUiOverrides(model.getValue(), overrides);
        if (updated !== model.getValue()) {
            model.pushStackElement();
            model.pushEditOperations([], [{ range: model.getFullModelRange(), text: updated }], () => null);
            model.pushStackElement();
        }
        this.deps.store.markClean(docKey);
        await this.deps.persistActiveTab?.();
        this.deps.appInstance.appendOutput('info', `Saved ${Object.keys(overrides).length} #UI value(s) to the document.`);
    }

    async leaveUiDoc(): Promise<boolean> {
        const docKey = this.deps.getActiveDocKey();
        if (this.deps.store.isDirty(docKey)) {
            const choice = await this.deps.editorBridge.confirmThreeWay?.({
                title: 'Unsaved input values',
                message: 'Save the values entered in the input form before exiting? They are discarded otherwise.',
                yesLabel: 'Save',
                noLabel: "Don't Save",
            }) ?? 'cancel';
            if (choice === 'cancel') return false;
            if (choice === 'yes') await this.saveUiOverrides();
        }
        this.deps.store.clear(docKey);
        return true;
    }

    handleUiValueChange(docKey: string, varName: string, newValue: string): boolean {
        if (!this.deps.store.set(docKey, varName, newValue)) return false;
        this.deps.store.markDirty(docKey);
        const group = this.deps.getActiveGroup();
        void this.deps.refreshPreview(group);
        return true;
    }

    syncFromSource(group: EditorGroup, content: string): void {
        const docKey = group.id;
        if (!this.deps.store.syncFromSource(docKey, content)) return;
        this.deps.store.markClean(docKey);
    }
}

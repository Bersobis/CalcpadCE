import * as monaco from 'monaco-editor';
import type { AppInstance } from '../editor/app-instance';
import type { EditorBridge } from '../editor/bridge';
import type { PlatformBridge } from '../services/platform';
import type { ResultMode } from '../services/workspace-state';
import { EditorGroup } from '../editor/editor-group';
import { setupDiagnostics } from '../editor/diagnostics';
import { attachQuickTyper } from '../editor/quick-type';
import { attachOperatorReplacer } from '../editor/operator-replacer';
import { attachAutoIndenter } from '../editor/auto-indent';
import { registerFormattingCommands } from '../editor/formatting-commands';
import { isCompiledPath } from 'calcpad-frontend';

export interface EditorGroupsDependencies {
    appInstance: AppInstance;
    editorBridge: EditorBridge & {
        handleMessage(msg: Record<string, unknown>): void;
    };
    platform: PlatformBridge;
    getResultMode: () => ResultMode;
    isPreviewVisible: () => boolean;
    refreshPreview: (group: EditorGroup) => Promise<void>;
    refreshProblems: (group: EditorGroup) => void;
    refreshDefinitions: (group: EditorGroup) => Promise<void>;
    refreshHeadings: () => void;
    refreshWindowTitle: () => void;
    syncInputMode: () => void;
    shouldAutoEnterUiMode: (group: EditorGroup) => boolean;
    autoEnterUiMode: () => void;
    onGroupWire?: (group: EditorGroup) => void;
}

export class EditorGroupManager {
    private readonly groups = new Map<string, EditorGroup>();
    private activeGroup!: EditorGroup;
    private groupSeq = 0;

    constructor(private readonly deps: EditorGroupsDependencies) {}

    get active(): EditorGroup {
        return this.activeGroup;
    }

    get all(): IterableIterator<EditorGroup> {
        return this.groups.values();
    }

    get(id: string): EditorGroup | undefined {
        return this.groups.get(id);
    }

    get size(): number {
        return this.groups.size;
    }

    setActive(group: EditorGroup): void {
        this.activeGroup = group;
        this.deps.appInstance.setActiveGroup(group.id);
        this.deps.refreshProblems(group);
        this.deps.refreshHeadings();
        this.deps.syncInputMode();
        if (this.deps.isPreviewVisible()) void this.deps.refreshPreview(group);
        this.deps.refreshWindowTitle();
    }

    async createAndWire(id: string, seedContent = '', linkFrom?: EditorGroup): Promise<EditorGroup> {
        this.deps.appInstance.addGroup(id);
        const container = this.deps.appInstance.getEditorContainer(id);
        if (!container) throw new Error(`Editor container for group ${id} not found`);
        const group = new EditorGroup(id, container);
        this.groups.set(id, group);
        this.wireGroup(group);
        this.deps.onGroupWire?.(group);
        const linkModel = linkFrom?.tabs.activeId ? linkFrom.tabs.modelForTab(linkFrom.tabs.activeId) : null;
        if (linkModel) group.tabs.openLinked(linkModel);
        else group.tabs.newUntitled(seedContent);
        return group;
    }

    async splitEditor(): Promise<void> {
        if (this.groups.size >= 2) {
            this.activeGroup.editor.focus();
            return;
        }
        if (this.deps.getResultMode() === 'ui' && this.deps.isPreviewVisible()) {
            this.deps.appInstance.appendOutput('info', 'Exit input mode to split the editor.');
            return;
        }
        const source = this.activeGroup;
        const group = await this.createAndWire(`g${++this.groupSeq}`, '', source);
        this.setActive(group);
        group.editor.focus();
    }

    async closeGroup(groupId: string): Promise<void> {
        if (this.groups.size < 2) return;
        const group = this.groups.get(groupId);
        if (!group) return;
        const other = [...this.groups.values()].find(g => g !== group);
        if (this.activeGroup === group && other) this.setActive(other);
        this.groups.delete(groupId);
        group.dispose();
        this.deps.appInstance.removeGroup(groupId);
        other?.editor.focus();
    }

    private wireGroup(group: EditorGroup): void {
        const ed = group.editor;

        group.disposables.push(
            ed.onDidFocusEditorText(() => {
                if (this.activeGroup !== group) this.setActive(group);
            }),
        );

        ed.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyZ, () => {
            const current = ed.getOption(monaco.editor.EditorOption.wordWrap);
            const next: 'on' | 'off' = current === 'on' ? 'off' : 'on';
            for (const g of this.groups.values()) g.editor.updateOptions({ wordWrap: next });
        });
        ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
            ed.trigger('keyboard', 'editor.action.copyLinesDownAction', null);
        });

        attachQuickTyper(ed, this.deps.editorBridge);
        attachOperatorReplacer(ed);
        attachAutoIndenter(ed);
        registerFormattingCommands(ed, this.deps.editorBridge);

        group.diagnostics = setupDiagnostics(ed, this.deps.editorBridge.api, () => {
            const sev = this.deps.editorBridge.getExtraSetting('linterMinSeverity');
            return (sev === 'error' || sev === 'warning') ? sev : 'information';
        }, undefined, `lint:${group.id}`);

        group.disposables.push(
            ed.onDidChangeModelContent(() => {
                if (this.deps.isPreviewVisible() && this.deps.editorBridge.getExtraSetting('autoRun') !== 'false') {
                    group.trackTimer(setTimeout(() => {
                        void this.deps.refreshPreview(group);
                    }, 800));
                }
                if (group === this.activeGroup) {
                    group.trackTimer(setTimeout(() => this.deps.refreshHeadings(), 800));
                }
            }),
        );

        group.disposables.push(
            ed.onDidChangeCursorPosition(() => {
                if (group === this.activeGroup) {
                    group.trackTimer(setTimeout(() => {
                        this.deps.editorBridge.handleMessage({ type: 'getMetadataContext' });
                    }, 150));
                }
            }),
        );

        group.tabs.onTabsChanged((snapshots) => {
            this.deps.appInstance.setTabs(group.id, snapshots);
            if (group === this.activeGroup) this.deps.refreshWindowTitle();
        });

        group.tabs.onActiveModelChanged(() => {
            const enteringUi = this.deps.shouldAutoEnterUiMode(group);
            this.deps.refreshProblems(group);
            void group.diagnostics?.refresh();
            if (!enteringUi && this.deps.isPreviewVisible()) void this.deps.refreshPreview(group);
            if (group === this.activeGroup) this.deps.refreshHeadings();
            void this.deps.refreshDefinitions(group);
            if (enteringUi) this.deps.autoEnterUiMode();
        });
    }

    applyCompiledWorksheetMode(group: EditorGroup): void {
        const activeId = group.tabs.activeId;
        const path = activeId ? group.tabs.getFilePath(activeId) : null;
        const compiled = !!path && isCompiledPath(path);
        group.editor.updateOptions({ readOnly: compiled });
        if (group === this.activeGroup) {
            this.deps.syncInputMode();
        }
        if (compiled && this.deps.getResultMode() !== 'ui') {
            if (!this.deps.isPreviewVisible()) this.deps.appInstance.togglePreview();
            this.deps.appInstance.setResultMode('ui');
        }
    }
}

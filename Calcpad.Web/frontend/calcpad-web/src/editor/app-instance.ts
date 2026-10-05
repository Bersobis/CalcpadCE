import type { ResultMode, WorkspaceLayout } from '../services/workspace-state';
import type { DisplayLogLevel, CalcpadLogLevel } from 'calcpad-frontend';

export interface ProblemItem {
    severity: number;
    severityClass: string;
    icon: string;
    message: string;
    code: string;
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
}

export interface QuickPickOption {
    label: string;
    detail?: string;
}

export interface QuickPickResult {
    title: string;
    placeholder?: string;
    options: QuickPickOption[];
}

export interface ConfirmOptions {
    title: string;
    message: string;
    yesLabel: string;
    noLabel: string;
}

export interface TabSnapshot {
    id: string;
    title: string;
    filePath?: string | null;
    dirty: boolean;
    isActive: boolean;
}

export interface AppInstance {
    showQuickPick(opts: QuickPickResult): Promise<number | null>;
    showConfirm(opts: ConfirmOptions): Promise<'yes' | 'no' | 'cancel'>;
    showOpenLink(target: string, mode: 'file' | 'browser'): Promise<boolean>;

    setProblems(groupId: string, items: ProblemItem[]): void;
    setPreviewTheme(theme: 'light' | 'dark'): void;
    setPreviewLoading(groupId: string, loading: boolean): void;
    setPreviewHtml(groupId: string, html: string, scrollToLine?: number, docKey?: string): Promise<void>;
    setUiPrintHtml(groupId: string, html: string, docKey?: string): Promise<void>;
    setUiOverridesDirty(dirty: boolean): void;
    setActiveGroup(groupId: string): void;
    setTabs(groupId: string, snapshots: TabSnapshot[]): void;
    setResultMode(mode: ResultMode): void;
    setLayout(layout: WorkspaceLayout): void;
    setServerStatus(status: string): void;
    setMaxOutputLines(n: number): void;
    setMaxPreviewConsoleMessages(n: number): void;

    getResultMode(): ResultMode;
    isPreviewVisible(): boolean;
    isUiPrintVisible(): boolean;
    isPreviewFrameSource(source: unknown): boolean;
    resultModeAvailable(mode: ResultMode): boolean;

    togglePreview(): void;
    toggleSidebar(): void;
    showOutput(channel: string): void;
    scrollPreviewToSourceLine(groupId: string, line: number, force?: boolean): void;
    runFocusedPreviewClipboardAction(action: string): boolean;
    openFindInFocusedPreview(): boolean;

    appendOutput(level: DisplayLogLevel, message: string, channel?: string, groupId?: string): void;

    addGroup(id: string): void;
    removeGroup(groupId: string): void;
    getEditorContainer(id: string): HTMLElement | null;

    onSplitRequest: (() => void) | null;
    onCloseGroupRequest: ((groupId: string) => void) | null;
    onGroupFocusRequest: ((groupId: string) => void) | null;
    onGotoProblem: ((problem: ProblemItem) => void) | null;
    onTabActivate: ((groupId: string, id: string) => void) | null;
    onTabCloseRequest: ((groupId: string, id: string) => void) | null;
    onNewTabRequest: ((groupId: string) => void) | null;
    onOpenFullHtmlRequest: ((groupId: string, html: string) => void) | null;
    onTabCloseOthersRequest: ((groupId: string, id: string) => void) | null;
    onTabCloseAllRequest: ((groupId: string) => void) | null;
    onLayoutChanged: ((layout: WorkspaceLayout) => void) | null;
    onResultModeChanged: ((mode: ResultMode) => void) | null;
    onPrintReportRequest: (() => void) | null;
    onUiPrintToggled: (() => void) | null;
    onSaveUiOverridesRequest: (() => void) | null;
    onExitUiModeRequest: (() => Promise<boolean>) | null;
    onPreviewToggled: ((visible: boolean) => void) | null;
    onRunRequest: (() => void) | null;
    onCopyTextRequest: ((text: string) => void) | null;
    onClipboardReadRequest: (() => Promise<string>) | null;
    onTabCopyFullPathRequest: ((groupId: string, id: string) => void) | null;
    onTabCopyRelativePathRequest: ((groupId: string, id: string) => Promise<void>) | null;
    onTabOpenContainingFolderRequest: ((groupId: string, id: string) => void) | null;
}

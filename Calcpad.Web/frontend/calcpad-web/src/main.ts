import * as monaco from 'monaco-editor';
import { createApp, nextTick } from 'vue';
import App from './App.vue';
import CalcpadAppVue from 'calcpad-frontend/vue/components/CalcpadApp.vue';
import { initMessaging } from 'calcpad-frontend/vue/services/messaging';
import { discardMetadataDraft } from 'calcpad-frontend/vue/metadata-drafts';
import { MessageBridge } from './services/message-bridge';
import { WorkspaceStateStore, isResultMode, type ResultMode, type WorkspaceLayout } from './services/workspace-state';
import { buildApiSettings } from 'calcpad-frontend/types/settings';
import { ConnectionMonitor, setLogLevel, coerceLogLevel, stripCpdSnippetWrapper } from 'calcpad-frontend';
import {
    findMetadataCommentBlock,
    serializeMetadataComment,
    buildSourceDefinitionResolver,
    isCompiledPath,
    documentHasUiDirectives,
    writeUiOverrides,
    MIN_PREVIEW_SIZE_MB,
    MIN_CONSOLE_MESSAGES_PER_DOCUMENT,
} from 'calcpad-frontend';
import { registerCalcpadLanguage, registerCalcpadTheme, remeasureEditorFontsWhenReady, resolveEditorFontFamily } from './editor/setup';
import { setAppTheme, coerceAppTheme, getResolvedAppTheme, onAppThemeChanged } from './editor/app-theme';
import { registerSemanticTokensProvider } from './editor/semantic-tokens';
import { setupDiagnostics } from './editor/diagnostics';
import { registerCompletionProvider } from './editor/completions';
import { registerIncludeCompletionProvider } from './editor/include-completions';
import { registerHoverProvider } from './editor/hover';
import {
    registerDefinitionProvider,
    registerIncludeLinkProvider,
    registerReferenceProvider,
    registerRenameProvider,
    type IncludeFileOpener,
    type IncludeUriResolver,
} from './editor/references';
import { attachQuickTyper } from './editor/quick-type';
import { attachOperatorReplacer } from './editor/operator-replacer';
import { attachAutoIndenter } from './editor/auto-indent';
import { registerFormattingCommands, getParseMode } from './editor/formatting-commands';
import { registerFormatDocumentProvider } from './editor/format-document';
import { setActiveDocumentKeyResolver, getActiveDocumentKey, type EditorBridge } from './editor/bridge';
import { EditorGroup } from './editor/editor-group';
import type { TabManager } from './tabs/tab-manager';
import { toDisplayLogLevel } from 'calcpad-frontend';
import type { CalcpadLogLevel, DisplayLogLevel } from 'calcpad-frontend';
import './editor/vscode-variables.css';
import 'calcpad-frontend/vue/styles/base.css';
import './styles/app.css';
import './editor/workers';
import type { AppInstance } from './editor/app-instance';
import { ReactiveUiOverridesStore } from './services/ui-overrides-store';
import { detectPlatform, getServerUrl, type PlatformBridge } from './services/platform';
import { PreviewRenderer } from './bootstrap/preview';
import { UiOverridesManager } from './bootstrap/ui-overrides';
import { EditorGroupManager } from './bootstrap/editor-groups';
import { ServerManager } from './bootstrap/server';

const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';
const EXTERNAL_LINK_SCHEMES = /^(https?|file):/i;

function getEmptyPreviewHtml(theme: 'light' | 'dark'): string {
    const c = theme === 'light'
        ? { fg: '#6e6e6e', bg: '#ffffff', link: '#0066cc' }
        : { fg: '#858585', bg: '#1e1e1e', link: '#4FC1FF' };
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>CalcpadCE Preview</title>
    <style>
        body { color: ${c.fg}; background: ${c.bg}; padding: 20px; font-family: var(--vscode-font-family, system-ui, sans-serif); }
        h3 { text-align: center; }
        p { text-align: center; }
        table { margin: 1em auto; border-collapse: collapse; text-align: left; font-size: 0.9em; }
        th, td { padding: 4px 12px; }
        th { text-align: right; font-weight: normal; opacity: 0.7; }
        td { font-family: var(--vscode-editor-font-family, monospace); }
        h4 { text-align: center; margin-top: 1.5em; margin-bottom: 0.3em; }
        a { color: ${c.link}; }
    </style>
</head>
<body>
    <h3>Empty Document</h3>
    <p>Start typing CalcpadCE code to see the preview.</p>
    <h4>Formatting Hotkeys</h4>
    <table>
        <tr><th>Bold</th><td>Ctrl+B</td></tr>
        <tr><th>Italic</th><td>Ctrl+I</td></tr>
        <tr><th>Underline</th><td>Ctrl+U</td></tr>
        <tr><th>Subscript</th><td>Ctrl+=</td></tr>
        <tr><th>Superscript</th><td>Ctrl+Shift+=</td></tr>
        <tr><th>Heading 1-6</th><td>Ctrl+1 ... Ctrl+6</td></tr>
        <tr><th>Paragraph</th><td>Ctrl+L</td></tr>
        <tr><th>Line Break</th><td>Ctrl+R</td></tr>
        <tr><th>Bulleted List</th><td>Ctrl+Shift+L</td></tr>
        <tr><th>Numbered List</th><td>Ctrl+Shift+N</td></tr>
        <tr><th>Toggle Comment</th><td>Ctrl+Q</td></tr>
    </table>
    <h4>Resources</h4>
    <p><a href="https://github.com/imartincei/CalcpadCE">CalcpadCE on GitHub</a></p>
    <p><a href="https://calcpad-ce.org/">calcpad-ce.org</a></p>
    <p><a href="https://imartincei.github.io/CalcpadCE/">CalcpadCE Documentation</a></p>
</body>
</html>`;
}

function getSampleContent(): string {
    return `'CalcpadCE Web Editor
'Enter your calculations below

a = 3
b = 4
c = sqrt(a^2 + b^2)
`;
}

async function rgbaToPng(rgba: Uint8Array, width: number, height: number): Promise<Uint8Array | null> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
}

async function showServerBlockedDialog(details: string): Promise<void> {
    const { message: dialogMessage } = await import('@tauri-apps/plugin-dialog');
    const body =
        "CalcpadCE's calculation server started but never became ready.\n\n"
        + 'The editor still works, but preview, linting, and PDF/Word export '
        + 'need the server. Choose Server → Restart Server to try again.\n\n'
        + `Details: ${details}`;
    try {
        await dialogMessage(body, {
            title: 'CalcpadCE server unavailable',
            kind: 'warning',
            okLabel: 'OK',
        });
    } catch {
        // dialog can throw if the runtime is tearing down
    }
}

async function bootstrap(): Promise<void> {
    let serverUrl: string;
    let isPrimaryWindow = true;
    let windowLabel = 'main';
    // The build stamps the version in, which is what the web build reports. The Tauri
    // path below replaces it with the installed desktop app's own version, so this stays
    // `let`: upstream made it `const` only because nothing reassigned it there.
    let appVersion = import.meta.env.VITE_APP_VERSION;
    let bridge: MessageBridge | null = null;
    let tauriBridge: import('./services/tauri-bridge').TauriMessageBridge | null = null;
    let serverManager: import('./services/server-manager').TauriServerManager | null = null;
    const pendingServerLogs: { msg: string; level?: CalcpadLogLevel }[] = [];
    const pendingServerRawLogs: { line: string; stream: 'stdout' | 'stderr' }[] = [];

    const platform = detectPlatform();

    if (isTauri) {
        windowLabel = (await import('@tauri-apps/api/window')).getCurrentWindow().label;
        isPrimaryWindow = windowLabel === 'main';
        // Tauri desktop: the Rust layer owns the Calcpad.Server sidecar
        // (spawn, kill on exit, port discovery). This manager just tracks
        // its URL and surfaces crashes to the Output panel.
        // The installed desktop app carries its own version, which the stamped one
        // does not, so prefer what Tauri reports.
        try { appVersion = await (await import('@tauri-apps/api/app')).getVersion(); }
        catch { /* falls back to the version stamped at build time */ }
        const { TauriServerManager } = await import('./services/server-manager');
        serverManager = new TauriServerManager({
            appendLine: (msg: string, level?: CalcpadLogLevel) => pendingServerLogs.push({ msg, level }),
        }, isPrimaryWindow);
        serverManager.onServerLog = (line: string, stream: 'stdout' | 'stderr') => {
            pendingServerRawLogs.push({ line, stream });
        };
        serverManager.onStartupBlocked = (details: string) => {
            pendingServerLogs.push({ msg: `Server did not start — ${details}`, level: 'error' });
            void showServerBlockedDialog(details);
        };
        try {
            await serverManager.start();
        } catch (err) {
            const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
            pendingServerLogs.push({ msg: `[bootstrap] Server failed to start: ${msg}`, level: 'error' });
            console.error('[bootstrap] Server failed to start:', err);
        }
        serverUrl = serverManager.getBaseUrl() || '';
        const { TauriMessageBridge } = await import('./services/tauri-bridge');
        tauriBridge = new TauriMessageBridge(serverUrl);
        tauriBridge.api.setAuthToken(serverManager.getAuthToken());
        (window as any).calcpadBridge = tauriBridge;
    } else {
        serverUrl = getServerUrl();
        bridge = new MessageBridge(serverUrl);
        (window as any).calcpadBridge = bridge;
    }

    const activeBridge = tauriBridge ?? bridge!;
    const workspace = await WorkspaceStateStore.load(isTauri);
    initMessaging();
    (window as any).monaco = monaco;

    const app = createApp(App, { isDesktop: isTauri });
    const appInstance = app.mount('#app') as unknown as AppInstance;

    activeBridge.setQuickPick(async ({ title, placeholder, options }) => {
        const index = await appInstance.showQuickPick({
            title,
            placeholder,
            options: options.map((o: { label: string; detail?: string }) => ({ label: o.label, detail: o.detail })),
        });
        return index == null ? null : options[index].value;
    });

    await nextTick();
    registerCalcpadLanguage();
    registerCalcpadTheme();
    if (tauriBridge) await tauriBridge.ready;
    setAppTheme(coerceAppTheme(activeBridge.getStoredColorTheme()));
    setLogLevel(coerceLogLevel((activeBridge as unknown as EditorBridge).getExtraSetting('logLevel')));

    const WORD_WRAP_KEY = 'calcpad.wordWrap';
    const initialWordWrap: 'on' | 'off' =
        localStorage.getItem(WORD_WRAP_KEY) === 'off' ? 'off' : 'on';
    const initialEditorFontFamily = (activeBridge as unknown as EditorBridge).getExtraSetting('editorFontFamily') ?? 'JuliaMono';

    const editorBridge = activeBridge as unknown as EditorBridge;
    const uiOverridesStore = new ReactiveUiOverridesStore();

    const groups = new Map<string, EditorGroup>();
    let activeGroup!: EditorGroup;
    let editor!: monaco.editor.IStandaloneCodeEditor;
    let tabs!: TabManager;
    const groupWireHooks: ((g: EditorGroup) => void)[] = [];

    const editorGroupManager = new EditorGroupManager({
        appInstance,
        editorBridge: editorBridge as EditorBridge & {
            handleMessage(msg: Record<string, unknown>): void;
        },
        platform: null as unknown as PlatformBridge,
        getResultMode: () => appInstance.getResultMode(),
        isPreviewVisible: () => appInstance.isPreviewVisible(),
        refreshPreview: async (group) => { /* wired below */ },
        refreshProblems: (group) => { /* wired below */ },
        refreshDefinitions: async (group) => { /* wired below */ },
        refreshHeadings: () => { activeBridge.refreshHeadings(); },
        refreshWindowTitle: () => { /* wired below */ },
        syncInputMode: () => { /* wired below */ },
        shouldAutoEnterUiMode: () => false,
        autoEnterUiMode: () => { /* wired below */ },
    });

    function docKeyFor(group: EditorGroup): string {
        return `tab:${group.tabs.activeId ?? 'none'}`;
    }

    function activeDocumentKey(): string {
        return docKeyFor(activeGroup);
    }

    remeasureEditorFontsWhenReady(initialEditorFontFamily);

    window.addEventListener('message', (event) => {
        const msg = (event as MessageEvent).data;
        if (msg?.type !== 'editorFontFamilyChanged') return;
        const family = typeof msg.family === 'string' ? msg.family : '';
        const resolved = resolveEditorFontFamily(family);
        for (const g of groups.values()) g.editor.updateOptions({ fontFamily: resolved });
        remeasureEditorFontsWhenReady(family);
    });

    function markerToSeverityInfo(severity: monaco.MarkerSeverity) {
        switch (severity) {
            case monaco.MarkerSeverity.Error:
                return { severityClass: 'lintError', icon: '✕' };
            case monaco.MarkerSeverity.Warning:
                return { severityClass: 'warning', icon: '⚠' };
            default:
                return { severityClass: 'info', icon: 'ℹ' };
        }
    }

    function refreshProblemsFor(group: EditorGroup): void {
        const model = group.editor.getModel();
        if (!model) {
            appInstance.setProblems(group.id, []);
            return;
        }
        const markers = monaco.editor.getModelMarkers({ resource: model.uri });
        const items = markers.map(m => ({
            severity: m.severity,
            ...markerToSeverityInfo(m.severity),
            message: m.message,
            code: typeof m.code === 'string' ? m.code : m.code?.value ?? '',
            startLineNumber: m.startLineNumber,
            startColumn: m.startColumn,
            endLineNumber: m.endLineNumber,
            endColumn: m.endColumn,
        }));
        items.sort((a, b) => b.severity - a.severity);
        appInstance.setProblems(group.id, items);
    }

    async function refreshDefinitionsFor(group: EditorGroup): Promise<void> {
        const content = group.editor.getValue();
        editorBridge.definitions.refreshDefinitions(content, docKeyFor(group), undefined, `defs:${group.id}`);
    }

    function resolvePreviewTheme(): 'light' | 'dark' {
        const stored = editorBridge.getExtraSetting('previewTheme') ?? 'system';
        const resolved = stored === 'light' || stored === 'dark'
            ? stored
            : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        appInstance.setPreviewTheme(resolved);
        return resolved;
    }

    const pendingPreviewScrollLine = new Map<string, number>();

    function previewImageBudget(group: EditorGroup) {
        return {
            maxTotalBytes: 10 * 1024 * 1024,
            onExceeded: 'skip' as const,
            onSkip: (skipped: number) => appInstance.appendOutput('warn',
                `Image budget reached — ${skipped} image(s) left unembedded.`,
                'preview', group.id),
        };
    }

    function previewSizeLimit(): number {
        const stored = Number(editorBridge.getExtraSetting('maxPreviewSizeMB'));
        return 1024 * 1024 * (Number.isFinite(stored) && stored > 0 ? stored : 10);
    }

    function previewTooLarge(group: EditorGroup, html: string, uiPrint = false): boolean {
        const limit = previewSizeLimit();
        if (html.length <= limit) return false;
        appInstance.appendOutput('warn',
            `Preview blocked: ${html.length} chars over ${limit} limit.`,
            'preview', group.id);
        if (uiPrint) void appInstance.setUiPrintHtml(group.id, '', undefined);
        else void appInstance.setPreviewHtml(group.id, '', undefined, undefined);
        return true;
    }

    let invokeTauri: (<T>(cmd: string, args?: Record<string, unknown>) => Promise<T>) | null = null;

    function applyCompiledWorksheetMode(group: EditorGroup): void {
        const activeId = group.tabs.activeId;
        const path = activeId ? group.tabs.getFilePath(activeId) : null;
        const compiled = !!path && isCompiledPath(path);
        group.editor.updateOptions({ readOnly: compiled });
        if (group === activeGroup) {
            syncInputMode();
        }
        if (compiled && appInstance.getResultMode() !== 'ui') {
            if (!appInstance.isPreviewVisible()) appInstance.togglePreview();
            appInstance.setResultMode('ui');
        }
    }

    const autoUiSeenPaths = new Set<string>();
    let autoUiSwitchInFlight = false;

    function shouldAutoEnterUiMode(group: EditorGroup): boolean {
        if (!isTauri) return false;
        const activeId = group.tabs.activeId;
        if (!activeId) return false;
        const path = group.tabs.getFilePath(activeId);
        if (!path || isCompiledPath(path)) return false;
        if (autoUiSeenPaths.has(path)) return false;
        autoUiSeenPaths.add(path);
        if (group.tabs.isDirty(activeId)) return false;
        if (editorBridge.getExtraSetting('autoInputMode') === 'false') return false;
        if (appInstance.getResultMode() === 'ui' && appInstance.isPreviewVisible()) return false;
        return documentHasUiDirectives(group.editor.getValue());
    }

    function autoEnterUiMode(): void {
        autoUiSwitchInFlight = true;
        if (!appInstance.isPreviewVisible()) appInstance.togglePreview();
        void appInstance.setResultMode('ui');
        autoUiSwitchInFlight = false;
    }

    let sourceModeMenuShown = true;
    function syncSourceModeMenuItems(shown: boolean): void {
        if (shown === sourceModeMenuShown) return;
        sourceModeMenuShown = shown;
        void invokeTauri?.('set_source_result_modes_visible', { visible: shown });
    }

    function syncInputMode(): void {
        const activeId = activeGroup.tabs.activeId;
        const path = activeId ? activeGroup.tabs.getFilePath(activeId) : null;
        const compiled = !!path && isCompiledPath(path);
        const active = compiled
            || (appInstance.isPreviewVisible() && appInstance.getResultMode() === 'ui');
        window.dispatchEvent(new MessageEvent('message', {
            data: { type: 'inputModeChanged', active, compiled },
        }));
    }

    function uiDocKeyFor(group: EditorGroup): string {
        const activeId = group.tabs.activeId;
        return (activeId && group.tabs.getFilePath(activeId)) || docKeyFor(group);
    }

    function activeUiDocKey(): string {
        return uiDocKeyFor(activeGroup);
    }

    function refreshUiDirtyIndicator(): void {
        appInstance.setUiOverridesDirty(uiOverridesStore.isDirty(activeUiDocKey()));
    }

    activeBridge.setUiOverridesProvider(() => {
        const group = activeGroup;
        const content = group.editor.getValue();
        const docKey = uiDocKeyFor(group);
        if (uiOverridesStore.syncFromSource(docKey, content)) {
            uiOverridesStore.markClean(docKey);
        }
        return uiOverridesStore.toRecord(docKey);
    });
    activeBridge.setUiControlsProvider(() => uiOverridesStore.getControls(activeUiDocKey()));
    activeBridge.setUiControlsSink((controls) => uiOverridesStore.setControls(activeUiDocKey(), controls));
    activeBridge.setMetadataDirtySink((docKey, dirty) => {
        uiOverridesStore.setMetadataDirty(docKey, dirty);
    });

    activeBridge.setUiOverridesSink((overrides) => {
        const docKey = activeUiDocKey();
        uiOverridesStore.replace(docKey, overrides);
        uiOverridesStore.markClean(docKey);
        refreshUiDirtyIndicator();
        void refreshPreviewFor(activeGroup);
    });

    activeBridge.onGoToLine = (line: number) => {
        if (!appInstance.isPreviewVisible() || appInstance.getResultMode() !== 'ui') return false;
        appInstance.scrollPreviewToSourceLine(activeGroup.id, line, true);
        activeGroup.editor.revealLineInCenter(line);
        activeGroup.editor.setPosition({ lineNumber: line, column: 1 });
        return true;
    };

    function previewAppliesUiOverrides(): boolean {
        return editorBridge.getExtraSetting('previewUiOverrides') === 'true';
    }

    function syncUiOverrides(group: EditorGroup, content: string): void {
        const docKey = uiDocKeyFor(group);
        if (!uiOverridesStore.syncFromSource(docKey, content)) return;
        uiOverridesStore.markClean(docKey);
        refreshUiDirtyIndicator();
    }

    function invalidateUiControls(group: EditorGroup): void {
        if (!uiOverridesStore.invalidateControls(uiDocKeyFor(group))) return;
        if (group === activeGroup) activeBridge.refreshUiControls();
    }

    const previewRenderer = new PreviewRenderer({
        appInstance,
        editorBridge,
        platform: null as unknown as PlatformBridge,
        getActiveGroup: () => activeGroup,
        getResultMode: () => appInstance.getResultMode(),
        isPreviewVisible: () => appInstance.isPreviewVisible(),
        resolvePreviewTheme,
        getUiOverrides: (docKey) => uiOverridesStore.toRecord(docKey),
        syncUiOverrides,
        refreshUiPrint: async () => { /* wired below */ },
        onConvertErrors: (errors) => {
            window.dispatchEvent(new MessageEvent('message', {
                data: { type: 'updateConvertErrors', errors },
            }));
        },
    });

    async function refreshPreviewFor(group: EditorGroup): Promise<void> {
        if (!appInstance.isPreviewVisible()) return;
        if (appInstance.getResultMode() === 'ui' && group !== activeGroup) return;

        const content = group.editor.getValue();
        const settings = activeBridge.getSettings();
        const apiSettings = buildApiSettings(settings);
        const mode = appInstance.getResultMode() as ResultMode;
        const theme = resolvePreviewTheme();

        if (!content.trim()) {
            void appInstance.setPreviewHtml(group.id, getEmptyPreviewHtml(getResolvedAppTheme()));
            return;
        }

        const hideLoading = previewRenderer['loadingTracker'].begin(group.id);
        let result;
        try {
            const overrideMode = mode === 'ui' || mode === 'report'
                || (mode === 'preview' && previewAppliesUiOverrides());
            if (overrideMode) syncUiOverrides(group, content);
            const ui = overrideMode
                ? { enableUi: mode === 'ui', uiOverrides: uiOverridesStore.toRecord(uiDocKeyFor(group)) }
                : undefined;
            const write = activeBridge.mayWrite(mode === 'report', mode === 'ui');
            result = mode === 'unwrapped'
                ? await activeBridge.api.convertUnwrapped(content, apiSettings, undefined, theme, { key: `preview:${group.id}`, write })
                : await activeBridge.api.convert(
                    content, apiSettings, 'html', mode === 'report', undefined, theme, ui,
                    mode === 'report' ? true : undefined, { key: `preview:${group.id}`, write });
        } catch (err) {
            void hideLoading();
            throw err;
        }

        const scrollToLine = (mode === 'unwrapped' && pendingPreviewScrollLine.get(group.id) != null)
            ? pendingPreviewScrollLine.get(group.id)
            : undefined;
        pendingPreviewScrollLine.delete(group.id);

        if (result && !(result instanceof ArrayBuffer)) {
            if (previewTooLarge(group, result.html)) {
                await hideLoading();
                return;
            }
            const finalHtml = tauriBridge
                ? await tauriBridge.inlineDocumentImages(result.html, previewImageBudget(group))
                : result.html;
            const committed = appInstance.setPreviewHtml(group.id, finalHtml, scrollToLine, uiDocKeyFor(group));
            if (mode === 'ui') uiOverridesStore.setControls(uiDocKeyFor(group), []);
            window.dispatchEvent(new MessageEvent('message', {
                data: { type: 'updateConvertErrors', errors: result.errors },
            }));
            await committed;
        }
        await hideLoading();

        if (mode === 'ui' && appInstance.isUiPrintVisible())
            await refreshUiPrintFor(group, content, apiSettings, undefined, theme);
    }

    async function refreshUiPrintFor(
        group: EditorGroup,
        content: string,
        apiSettings: unknown,
        sourceFilePath: string | undefined,
        theme: 'light' | 'dark',
    ): Promise<void> {
        const result = await activeBridge.api.convert(
            content, apiSettings, 'html', true, sourceFilePath, theme,
            { uiOverrides: uiOverridesStore.toRecord(uiDocKeyFor(group)), hideErrorLines: true },
            true, { key: `preview:${group.id}`, write: activeBridge.mayWrite(true) });
        if (!result || result instanceof ArrayBuffer) return;
        if (previewTooLarge(group, result.html, true)) return;
        const html = tauriBridge
            ? await tauriBridge.inlineDocumentImages(result.html, previewImageBudget(group))
            : result.html;
        await appInstance.setUiPrintHtml(group.id, html, uiDocKeyFor(group));
    }

    onAppThemeChanged(() => refreshAllPreviews());

    function refreshAllPreviews(): void {
        if (appInstance.getResultMode() === 'ui') {
            void refreshPreviewFor(activeGroup);
            return;
        }
        for (const g of groups.values()) void refreshPreviewFor(g);
    }

    const syncPreviewToCursorFor = (group: EditorGroup, force: boolean): void => {
        const pos = group.editor.getPosition();
        if (!pos) return;
        if (!appInstance.isPreviewVisible()) {
            if (!force) return;
            appInstance.togglePreview();
            setTimeout(() => appInstance.scrollPreviewToSourceLine(group.id, pos.lineNumber), 600);
            return;
        }
        appInstance.scrollPreviewToSourceLine(group.id, pos.lineNumber);
    };

    function toggleWordWrap(): void {
        const current = editor.getOption(monaco.editor.EditorOption.wordWrap);
        const next: 'on' | 'off' = current === 'on' ? 'off' : 'on';
        for (const g of groups.values()) g.editor.updateOptions({ wordWrap: next });
        localStorage.setItem(WORD_WRAP_KEY, next);
    }

    function setActiveGroup(group: EditorGroup): void {
        activeGroup = group;
        editor = group.editor;
        tabs = group.tabs;
        (window as any).calcpadTabs = tabs;
        (window as any).calcpadActiveEditor = editor;
    appInstance.setActiveGroup(group.id);
    refreshProblemsFor(group);
    appInstance.setLiveDocumentText(group.editor.getValue());
    activeBridge.refreshHeadings();
        refreshUiDirtyIndicator();
        syncInputMode();
        if (appInstance.isPreviewVisible()) void refreshPreviewFor(group);
        refreshWindowTitle();
    }

    let setNativeTitle: ((title: string) => void) | null = null;

    function refreshWindowTitle(): void {
        const active = activeGroup?.tabs.activeTab;
        const suffix = isPrimaryWindow ? '' : ` (${windowLabel.slice('main-'.length)})`;
        const title = active?.title
            ? `${active.title} - CalcpadCE ${appVersion}${suffix}`
            : `CalcpadCE ${appVersion}${suffix}`;
        document.title = title;
        setNativeTitle?.(title);
    }

    function wireGroupCommon(group: EditorGroup): void {
        const ed = group.editor;

        group.disposables.push(
            ed.onDidFocusEditorText(() => {
                if (activeGroup !== group) setActiveGroup(group);
            }),
        );

        ed.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyZ, toggleWordWrap);
        ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
            ed.trigger('keyboard', 'editor.action.copyLinesDownAction', null);
        });

        attachQuickTyper(ed, editorBridge);
        attachOperatorReplacer(ed);
        attachAutoIndenter(ed);
        registerFormattingCommands(ed, editorBridge);

        group.diagnostics = setupDiagnostics(ed, activeBridge.api, () => {
            const sev = editorBridge.getExtraSetting('linterMinSeverity');
            return (sev === 'error' || sev === 'warning') ? sev : 'information';
        }, undefined, `lint:${group.id}`);

        ed.addAction({
            id: 'calcpad.focusPreviewToLine',
            label: 'Focus Preview to Line',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote],
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1.5,
            run: () => syncPreviewToCursorFor(group, true),
        });

        ed.addAction({
            id: 'calcpad.runPreview',
            label: 'Run Preview',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyX],
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1.4,
            run: () => { void runRefresh(); },
        });

        ed.addAction({
            id: 'calcpad.editMetadata',
            label: 'Edit Metadata Properties',
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1.6,
            run: (edEditor) => {
                const model = edEditor.getModel();
                const pos = edEditor.getPosition();
                if (!model || !pos) return;
                const curLine = pos.lineNumber;
                const curText = model.getLineContent(curLine);

                const focusMetadata = () => {
                    sidebarInstance.switchView?.('calcpad');
                    sidebarInstance.switchTab?.('metadata');
                };

                if (findMetadataCommentBlock([curText], 0)) {
                    focusMetadata();
                    return;
                }

                if (curLine > 1 && findMetadataCommentBlock([model.getLineContent(curLine - 1)], 0)) {
                    const above = curLine - 1;
                    edEditor.setPosition({ lineNumber: above, column: model.getLineMaxColumn(above) });
                    focusMetadata();
                    return;
                }

                const resolve = buildSourceDefinitionResolver(model.getValue().split(/\r?\n/));
                if (resolve(curLine - 1)) {
                    focusMetadata();
                    return;
                }

                const indent = curText.match(/^[ \t]*/)?.[0] ?? '';
                const newLineText = serializeMetadataComment({}, indent, '');
                edEditor.executeEdits('calcpad-metadata-seed', [{
                    range: new monaco.Range(curLine, 1, curLine, 1),
                    text: newLineText + '\n',
                }]);
                edEditor.setPosition({ lineNumber: curLine, column: model.getLineMaxColumn(curLine) });
                focusMetadata();
            },
        });

        let definitionsTimer: ReturnType<typeof setTimeout> | null = null;
        let previewTimer: ReturnType<typeof setTimeout> | null = null;
        let tocTimer: ReturnType<typeof setTimeout> | null = null;
        group.disposables.push(
            ed.onDidChangeModelContent(() => {
                if (group === activeGroup) appInstance.setLiveDocumentText(ed.getValue());
                if (definitionsTimer) clearTimeout(definitionsTimer);
                definitionsTimer = setTimeout(() => {
                    invalidateUiControls(group);
                    void refreshDefinitionsFor(group);
                }, 800);
                if (appInstance.isPreviewVisible() && editorBridge.getExtraSetting('autoRun') !== 'false') {
                    if (previewTimer) clearTimeout(previewTimer);
                    previewTimer = setTimeout(() => void refreshPreviewFor(group), 800);
                }
                if (group === activeGroup) {
                    if (tocTimer) clearTimeout(tocTimer);
                    tocTimer = setTimeout(() => activeBridge.refreshHeadings(), 800);
                }
            }),
        );

        let cursorSyncTimer: ReturnType<typeof setTimeout> | null = null;
        let metadataContextTimer: ReturnType<typeof setTimeout> | null = null;
        group.disposables.push(
            ed.onDidChangeCursorPosition(() => {
                if (group === activeGroup) {
                    if (metadataContextTimer) clearTimeout(metadataContextTimer);
                    metadataContextTimer = setTimeout(() => {
                        activeBridge.handleMessage({ type: 'getMetadataContext' });
                    }, 150);
                }
                if (editorBridge.getExtraSetting('previewCursorSync') !== 'true') return;
                if (!appInstance.isPreviewVisible()) return;
                if (cursorSyncTimer) clearTimeout(cursorSyncTimer);
                cursorSyncTimer = setTimeout(() => syncPreviewToCursorFor(group, false), 150);
            }),
        );

        group.tabs.onTabsChanged((snapshots) => {
            appInstance.setTabs(group.id, snapshots);
            if (group === activeGroup) refreshWindowTitle();
        });

        group.tabs.onActiveModelChanged(() => {
            applyCompiledWorksheetMode(group);
            const enteringUi = shouldAutoEnterUiMode(group);
            refreshProblemsFor(group);
            if (group === activeGroup) appInstance.setLiveDocumentText(group.editor.getValue());
            void group.diagnostics?.refresh();
            if (!enteringUi && appInstance.isPreviewVisible()) void refreshPreviewFor(group);
            if (group === activeGroup) activeBridge.refreshHeadings();
            void refreshDefinitionsFor(group);
            if (enteringUi) autoEnterUiMode();
        });

        setTimeout(() => void refreshDefinitionsFor(group), 500);
    }

    async function createAndWireGroup(id: string, seedContent = '', linkFrom?: EditorGroup): Promise<EditorGroup> {
        appInstance.addGroup(id);
        await nextTick();
        const container = appInstance.getEditorContainer(id) as HTMLElement | null;
        if (!container) throw new Error(`Editor container for group ${id} not found`);
        const group = new EditorGroup(id, container, { wordWrap: initialWordWrap, fontFamily: initialEditorFontFamily });
        groups.set(id, group);
        wireGroupCommon(group);
        for (const hook of groupWireHooks) hook(group);
        const linkModel = linkFrom?.tabs.activeId ? linkFrom.tabs.modelForTab(linkFrom.tabs.activeId) : null;
        if (linkModel) group.tabs.openLinked(linkModel);
        else group.tabs.newUntitled(seedContent);
        return group;
    }

    const g0Container = appInstance.getEditorContainer('g0') as HTMLElement | null;
    if (!g0Container) throw new Error('Primary editor container not found');
    const primaryGroup = new EditorGroup('g0', g0Container, { wordWrap: initialWordWrap, fontFamily: initialEditorFontFamily });
    groups.set('g0', primaryGroup);
    setActiveGroup(primaryGroup);
    wireGroupCommon(primaryGroup);

    setActiveDocumentKeyResolver(() => activeDocumentKey());
    primaryGroup.tabs.newUntitled(isTauri ? '' : getSampleContent());

    let confirmCloseGroup: (g: EditorGroup) => Promise<boolean> = async () => true;
    let groupSeq = 0;

    async function splitEditor(): Promise<void> {
        if (groups.size >= 2) {
            activeGroup.editor.focus();
            return;
        }
        if (appInstance.getResultMode() === 'ui' && appInstance.isPreviewVisible()) {
            appInstance.appendOutput('info', 'Exit input mode to split the editor.');
            return;
        }
        const source = activeGroup;
        const group = await createAndWireGroup(`g${++groupSeq}`, '', source);
        setActiveGroup(group);
        group.editor.focus();
    }

    async function closeGroup(groupId: string): Promise<void> {
        if (groups.size < 2) return;
        const group = groups.get(groupId);
        if (!group) return;
        const ok = await confirmCloseGroup(group);
        if (!ok) return;
        const other = [...groups.values()].find(g => g !== group);
        if (activeGroup === group && other) setActiveGroup(other);
        groups.delete(groupId);
        group.dispose();
        appInstance.removeGroup(groupId);
        other?.editor.focus();
    }

    let quitApplication: (() => Promise<void>) | null = null;

    function confirmThreeWay(opts: {
        title: string;
        message: string;
        yesLabel: string;
        noLabel: string;
    }): Promise<'yes' | 'no' | 'cancel'> {
        return editorBridge.confirmThreeWay?.(opts) ?? appInstance.showConfirm(opts);
    }

    async function handleEmptyGroup(group: EditorGroup): Promise<void> {
        if (group.tabs.count > 0) return;
        if (groups.size > 1) {
            await closeGroup(group.id);
            return;
        }
        if (quitApplication) await quitApplication();
        else group.tabs.newUntitled();
    }

    appInstance.onSplitRequest = () => { void splitEditor(); };
    appInstance.onCloseGroupRequest = (groupId: string) => { void closeGroup(groupId); };
    appInstance.onGroupFocusRequest = (groupId: string) => {
        const g = groups.get(groupId);
        if (g) setActiveGroup(g);
    };

    // The Live Display renders the whole document in one request, so every line is drawn
    // from the same pass as the lines it depends on. `key` scopes supersession: the pane's
    // document render and its per-line live preview cancel only their own predecessors.
    // The active file's path rides along so `#include` resolves, as it does in the preview.
    appInstance.onLiveConvertRequest = async (source: string, key: string) => {
        const settings = buildApiSettings(activeBridge.getSettings());
        const sourceFilePath = activeGroup.tabs.activeTab?.filePath ?? undefined;
        return await activeBridge.api.convertLines(source, settings, sourceFilePath, { key });
    };

    appInstance.onLiveNavigateRequest = (line: number) => {
        activeGroup.editor.revealLineInCenter(line);
        activeGroup.editor.setPosition({ lineNumber: line, column: 1 });
        activeGroup.editor.focus();
    };

    // Editing in the Live Display rewrites the source line through the editor model, so the
    // pane cannot drift from the document and the change lands in undo and the preview.
    appInstance.onLiveEditRequest = (line: number, text: string) => {
        const model = activeGroup.editor.getModel();
        if (!model || line < 1 || line > model.getLineCount()) return;
        const range = new monaco.Range(line, 1, line, model.getLineMaxColumn(line));
        activeGroup.editor.executeEdits('calcpad-live-edit', [{ range, text, forceMoveMarkers: true }]);
    };

    const openIncludeFile: IncludeFileOpener | undefined = tauriBridge
        ? async (rawFileName: string) => {
            try {
                const absPath = await tauriBridge.resolveIncludePath(rawFileName);
                let model = tabs.findModelByPath(absPath);
                if (!model) {
                    const content = await tauriBridge.readFile(absPath);
                    const tabId = tabs.openFile(absPath, content);
                    model = tabs.findModelByPath(absPath);
                    if (!model) {
                        console.warn(`[references] opened ${absPath} as ${tabId} but no model was registered`);
                        return null;
                    }
                }
                return model.uri;
            } catch (err) {
                console.warn(`[references] failed to open include ${rawFileName}: ${err instanceof Error ? err.message : String(err)}`);
                return null;
            }
        }
        : undefined;

    const includeUriToPath = new Map<string, string>();
    const resolveIncludeUri: IncludeUriResolver | undefined = tauriBridge
        ? async (rawFileName: string): Promise<monaco.Uri | null> => {
            try {
                const absPath = await tauriBridge.resolveIncludePath(rawFileName);
                const uri = monaco.Uri.parse(`calcpad-include:${encodeURIComponent(absPath)}`);
                includeUriToPath.set(uri.toString(), absPath);
                return uri;
            } catch {
                return null;
            }
        }
        : undefined;

    monaco.editor.registerLinkOpener({
        open(resource) {
            const url = resource.toString();
            if (!EXTERNAL_LINK_SCHEMES.test(url)) return false;
            return openExternalLink(url).then(() => true);
        },
    });

    if (tauriBridge) {
        const bridge = tauriBridge;
        const openIncludeAt = async (
            absPath: string,
            selectionOrPosition?: monaco.IRange | monaco.IPosition,
        ): Promise<void> => {
            try {
                const existing = tabs.findByPath(absPath);
                if (existing) {
                    tabs.activate(existing.id);
                } else {
                    tabs.openFile(absPath, await bridge.readFile(absPath));
                }
                if (selectionOrPosition) {
                    const pos = 'startLineNumber' in selectionOrPosition
                        ? { lineNumber: selectionOrPosition.startLineNumber, column: selectionOrPosition.startColumn }
                        : { lineNumber: selectionOrPosition.lineNumber, column: selectionOrPosition.column };
                    editor.setPosition(pos);
                    editor.revealPositionInCenter(pos);
                }
            } catch (err) {
                console.warn(`[references] failed to open include ${absPath}: ${err instanceof Error ? err.message : String(err)}`);
            }
        };

        monaco.editor.registerEditorOpener({
            openCodeEditor(_source, resource, selectionOrPosition) {
                const absPath = includeUriToPath.get(resource.toString());
                if (absPath === undefined) return false;
                return openIncludeAt(absPath, selectionOrPosition).then(() => true);
            },
        });

        monaco.editor.registerLinkOpener({
            open(resource) {
                const absPath = includeUriToPath.get(resource.toString());
                if (absPath === undefined) return false;
                return openIncludeAt(absPath).then(() => true);
            },
        });
    }

    registerSemanticTokensProvider(activeBridge.api, undefined);
    registerCompletionProvider(editorBridge);
    if (tauriBridge) {
        registerIncludeCompletionProvider({
            listDirectory: (p) => tauriBridge.listDirectory(p),
            getCurrentFilePath: () => tabs.activeTab?.filePath ?? null,
            getOpenedFolder: () => tauriBridge.getOpenedFolder(),
            expandEnvVars: (raw) => tauriBridge.expandEnvVars(raw),
            getHomeDir: () => tauriBridge.getHomeDir(),
            getServerPathRoots: () => editorBridge.definitions.getCachedPathRoots(getActiveDocumentKey()),
        });
    }
    registerHoverProvider(editorBridge);
    registerDefinitionProvider(editorBridge, undefined, resolveIncludeUri);
    registerIncludeLinkProvider(resolveIncludeUri);
    registerReferenceProvider(editorBridge, undefined, openIncludeFile);
    registerRenameProvider(editorBridge, undefined);
    registerFormatDocumentProvider(editorBridge);

    window.addEventListener('message', (e: MessageEvent) => {
        if (e.data?.type === 'linterMinSeverityChanged') {
            for (const g of groups.values()) void g.diagnostics?.refresh();
        }
        if (e.data?.type === 'maxOutputLinesChanged') {
            const n = Number(e.data.value);
            if (Number.isFinite(n)) appInstance.setMaxOutputLines(n);
        }
        if (e.data?.type === 'maxPreviewSizeChanged') {
            const n = Number(e.data.value);
            if (Number.isFinite(n) && n >= MIN_PREVIEW_SIZE_MB) refreshAllPreviews();
        }
        if (e.data?.type === 'maxPreviewConsoleMessagesChanged') {
            const n = Number(e.data.value);
            if (Number.isFinite(n) && n >= MIN_CONSOLE_MESSAGES_PER_DOCUMENT) {
                appInstance.setMaxPreviewConsoleMessages(n);
                refreshAllPreviews();
            }
        }
        if (e.data?.type === 'exportError') {
            appInstance.appendOutput('error', String(e.data.message ?? 'Export failed'));
        }
    });

    {
        const stored = Number(editorBridge.getExtraSetting('maxOutputLines'));
        if (Number.isFinite(stored) && stored >= 10) appInstance.setMaxOutputLines(stored);
        const messages = Number(editorBridge.getExtraSetting('maxPreviewConsoleMessages'));
        if (Number.isFinite(messages) && messages >= MIN_CONSOLE_MESSAGES_PER_DOCUMENT)
            appInstance.setMaxPreviewConsoleMessages(messages);
    }

    /**
     * Monaco's tab-stop contribution; not part of the public editor API types.
     * `dispose` is declared only to satisfy `IEditorContribution`, which
     * `getContribution` constrains its type argument to — the controller is never
     * disposed through this reference.
     */
    interface SnippetController { insert(snippet: string): void; dispose(): void }

    activeBridge.onInsertText = (text: string, snippet?: boolean) => {
        const selection = editor.getSelection();
        if (selection) {
            const insert = getParseMode(editor, activeBridge) === 'cpd'
                ? text
                : stripCpdSnippetWrapper(text);
            // A snippet has to go through Monaco's tab-stop controller, which owns the
            // selection and the undo step; a plain insert stays a single executeEdits.
            const controller = snippet
                ? editor.getContribution<SnippetController>('snippetController2')
                : null;
            if (controller) {
                editor.setPosition(selection.getStartPosition());
                controller.insert(insert);
            } else {
                editor.executeEdits('calcpad-insert', [{
                    range: selection,
                    text: insert,
                    forceMoveMarkers: true,
                }]);
            }
        }
        editor.focus();
    };

    function fmtConsoleArg(a: unknown): string {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return a.stack ?? a.message;
        try {
            return JSON.stringify(a);
        } catch {
            return String(a);
        }
    }
    const origLog = console.log;
    const origInfo = console.info;
    const origDebug = console.debug;
    const origWarn = console.warn;
    const origError = console.error;

    const wrap = (
        orig: (...args: any[]) => void,
        level: DisplayLogLevel,
    ) => (...args: any[]) => {
        orig.apply(console, args);
        if (typeof args[0] === 'string' && args[0].startsWith('%c')) return;
        appInstance.appendOutput(level, args.map(fmtConsoleArg).join(' '));
    };

    console.log = wrap(origLog, 'info');
    console.info = wrap(origInfo, 'info');
    console.debug = wrap(origDebug, 'debug');
    console.warn = wrap(origWarn, 'warn');
    console.error = wrap(origError, 'error');

    const isCancellation = (reason: unknown): boolean =>
        reason instanceof DOMException ? reason.name === 'AbortError'
            : reason instanceof Error && reason.name === 'Canceled' && reason.message === 'Canceled';

    const describeError = (reason: unknown): string =>
        reason instanceof Error ? (reason.stack ?? `${reason.name}: ${reason.message}`) : String(reason);

    window.addEventListener('error', (e) => {
        if (isCancellation(e.error)) return;
        appInstance.appendOutput('error', `Uncaught: ${e.message} (${e.filename}:${e.lineno})`);
    });
    window.addEventListener('unhandledrejection', (e) => {
        if (isCancellation(e.reason)) return;
        appInstance.appendOutput('error', `Unhandled rejection: ${describeError(e.reason)}`);
    });

    window.addEventListener('message', (e: MessageEvent) => {
        const data = e.data;
        if (!data) return;

        const fromHost = e.source === null;
        const fromPreview = appInstance.isPreviewFrameSource(e.source);
        if (!fromHost && !fromPreview) return;

        if (data.type === 'previewConsole') {
            if (!fromPreview) return;
            const level: DisplayLogLevel =
                data.level === 'warn' ? 'warn'
                : data.level === 'error' ? 'error'
                : data.level === 'debug' ? 'debug'
                : 'info';
            appInstance.appendOutput(level, String(data.message ?? ''), 'preview', data.groupId);
            return;
        }

        if (data.type === 'previewThemeChanged' || data.type === 'settingsChanged'
            || data.type === 'previewUiOverridesChanged') {
            if (!fromHost) return;
            refreshAllPreviews();
            return;
        }

        if (data.type === 'uiValueChange') {
            if (!fromPreview) return;
            const group = (data.groupId && groups.get(data.groupId)) || activeGroup;
            const docKey = uiDocKeyFor(group);
            if (!uiOverridesStore.set(docKey, String(data.varName), String(data.newValue))) return;
            uiOverridesStore.markDirty(docKey);
            refreshUiDirtyIndicator();
            void refreshPreviewFor(group);
            return;
        }

        if (data.type === 'navigateToLine') {
            if (!fromPreview) return;
            const line = Number(data.line);
            if (!Number.isFinite(line) || line < 1) return;
            const group = (data.groupId && groups.get(data.groupId)) || activeGroup;
            if (group !== activeGroup) setActiveGroup(group);
            const isOutputLine = data.lineType === 'output';
            const hasMacros = /^\s*#(def|include)\b/im.test(group.editor.getValue());
            const mode = appInstance.getResultMode() as ResultMode;
            if (isOutputLine && (mode === 'preview' || mode === 'report') && hasMacros
                && appInstance.resultModeAvailable('unwrapped')) {
                pendingPreviewScrollLine.set(group.id, line);
                appInstance.setResultMode('unwrapped');
            } else {
                group.editor.revealLineInCenter(line);
                group.editor.setPosition({ lineNumber: line, column: 1 });
                group.editor.focus();
            }
            return;
        }

        if (data.type === 'openExternal') {
            if (!fromPreview) return;
            void openExternalLink(String(data.url ?? ''));
            return;
        }
    });

    async function openExternalLink(url: string): Promise<void> {
        if (!EXTERNAL_LINK_SCHEMES.test(url)) return;
        const isFile = /^file:/i.test(url);
        if (isFile && !isTauri) return;
        try {
            const target = isFile ? fileUrlToPath(url) : url;
            if (!(await appInstance.showOpenLink(target, isFile ? 'file' : 'browser'))) return;
            if (isTauri) {
                const opener = await import('@tauri-apps/plugin-opener');
                if (isFile) await opener.openPath(target);
                else await opener.openUrl(url);
            } else {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        } catch (e) {
            appInstance.appendOutput('error', `Could not open ${url}: ${describeError(e)}`);
        }
    }

    function fileUrlToPath(url: string): string {
        const path = decodeURIComponent(new URL(url).pathname);
        return /^\/[A-Za-z]:/.test(path) ? path.slice(1) : path;
    }

    appInstance.appendOutput('info', `CalcpadCE Web started — server: ${serverUrl}`);

    for (const { msg, level } of pendingServerLogs) appInstance.appendOutput(toDisplayLogLevel(level), msg);
    pendingServerLogs.length = 0;
    for (const { line, stream } of pendingServerRawLogs) {
        appInstance.appendOutput(stream === 'stderr' ? 'error' : 'info', line, 'server');
    }
    pendingServerRawLogs.length = 0;

    const connectionMonitor = new ConnectionMonitor({
        probe: (timeoutMs: number) => activeBridge.api.checkHealth(timeoutMs),
        onStatusChanged: (status) => appInstance.setServerStatus(status),
        onRecovered: () => { void runRefresh('Server reconnected — refreshing…'); },
        log: (msg: string) => appInstance.appendOutput('info', `[Server] ${msg}`),
    });

    if (serverManager) {
        serverManager.setLogger({
            appendLine: (msg: string, level?: CalcpadLogLevel) => appInstance.appendOutput(toDisplayLogLevel(level), msg),
        });
        serverManager.onServerLog = (line: string, stream: 'stdout' | 'stderr') => {
            appInstance.appendOutput(stream === 'stderr' ? 'error' : 'info', line, 'server');
        };
        serverManager.onUrlChanged = (newUrl: string) => {
            activeBridge.api.setBaseUrl(newUrl);
            appInstance.appendOutput('info', `Server URL updated: ${newUrl}`);
        };
        serverManager.onCrashExhausted = (crashOutput: string) => {
            appInstance.appendOutput('error',
                'CalcpadCE server crashed repeatedly — auto-restart disabled. ' +
                'Use Server → Restart Server to try again.');
            if (crashOutput) appInstance.appendOutput('error', crashOutput);
        };
        serverManager.onStatusChanged = (state, detail) => connectionMonitor.applyLifecycle(state, detail);
    }

    if (serverManager && !serverManager.isRunning) {
        connectionMonitor.markStopped('server did not start');
    } else {
        connectionMonitor.start();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') connectionMonitor.probeSoon();
    });

    monaco.editor.onDidChangeMarkers((resources) => {
        for (const g of groups.values()) {
            const model = g.editor.getModel();
            if (!model) continue;
            for (const r of resources) {
                if (r.toString() === model.uri.toString()) {
                    refreshProblemsFor(g);
                }
            }
        }
    });

    appInstance.onGotoProblem = (problem: any) => {
        editor.revealLineInCenter(problem.startLineNumber);
        editor.setPosition({
            lineNumber: problem.startLineNumber,
            column: problem.startColumn,
        });
        editor.focus();
    };

    async function activateTab(groupId: string, id: string): Promise<void> {
        const g = groups.get(groupId);
        if (!g) return;
        if (g === activeGroup && g.tabs.activeId === id) return;
        if (!await confirmLeaveUiDoc()) return;
        if (activeGroup !== g) setActiveGroup(g);
        g.tabs.activate(id);
    }

    appInstance.onTabActivate = (groupId: string, id: string) => { void activateTab(groupId, id); };
    appInstance.onTabCloseRequest = (groupId: string, id: string) => {
        const g = groups.get(groupId);
        if (!g) return;
        g.tabs.close(id);
        void handleEmptyGroup(g);
    };
    appInstance.onNewTabRequest = (groupId: string) => {
        groups.get(groupId)?.tabs.newUntitled();
    };
    appInstance.onOpenFullHtmlRequest = (groupId: string, html: string) => {
        groups.get(groupId)?.tabs.newUntitled(html, 'HTML Preview Source.html');
    };
    appInstance.onTabCloseOthersRequest = (groupId: string, id: string) => {
        const g = groups.get(groupId);
        if (!g) return;
        for (const t of g.tabs.all) {
            if (t.id !== id) g.tabs.close(t.id);
        }
    };
    appInstance.onTabCloseAllRequest = (groupId: string) => {
        const g = groups.get(groupId);
        if (!g) return;
        for (const t of g.tabs.all) g.tabs.close(t.id);
        void handleEmptyGroup(g);
    };

    const versionConfig = {
        isVSCode: false,
        isWeb: !isTauri,
        isDesktop: isTauri,
        isWebOrDesktop: true,
    };
    const sidebarApp = createApp(CalcpadAppVue, { versionConfig, appVersion });
    const sidebarInstance = sidebarApp.mount('#vue-sidebar') as {
        switchTab?: (id: string) => void;
        switchView?: (id: string) => void;
    };

    const legacyMode = workspace.isFresh
        ? editorBridge.getExtraSetting('resultMode') ?? editorBridge.getExtraSetting('previewMode')
        : undefined;
    const restoredMode = legacyMode === 'wrapped' ? 'preview' : legacyMode;
    appInstance.setResultMode(isResultMode(restoredMode) ? restoredMode : workspace.get().resultMode);

    appInstance.setLayout(workspace.get().layout);
    if (appInstance.isPreviewVisible()) setTimeout(refreshAllPreviews, 50);
    if (isPrimaryWindow) {
        appInstance.onLayoutChanged = (layout: WorkspaceLayout) => { workspace.update({ layout }); };
    }

    syncInputMode();

    window.addEventListener('calcpad-toggle-sidebar', () => { appInstance.toggleSidebar(); });

    let refreshInFlight = false;
    let refreshQueued = false;
    async function runRefresh(reason: string = 'Refreshing…'): Promise<void> {
        if (refreshInFlight) {
            refreshQueued = true;
            return;
        }
        refreshInFlight = true;
        appInstance.appendOutput('info', reason);
        try {
            for (const g of groups.values()) {
                await g.diagnostics?.refresh();
                await refreshDefinitionsFor(g);
                if (appInstance.isPreviewVisible()) await refreshPreviewFor(g);
            }
            activeBridge.refreshHeadings();
            window.dispatchEvent(new MessageEvent('message', { data: { type: 'getPlots' } }));
        } finally {
            refreshInFlight = false;
        }
        if (refreshQueued) {
            refreshQueued = false;
            await runRefresh(reason);
        }
    }

    appInstance.onResultModeChanged = (mode: ResultMode) => {
        if (!autoUiSwitchInFlight) workspace.update({ resultMode: mode });
        refreshUiDirtyIndicator();
        syncInputMode();
        refreshAllPreviews();
    };

    appInstance.onPrintReportRequest = () => {
        activeBridge.handleMessage({ type: 'generatePdf' });
    };

    appInstance.onUiPrintToggled = () => {
        void nextTick(refreshAllPreviews);
    };

    let persistActiveTab: (() => Promise<boolean>) | null = null;

    async function saveUiOverrides(): Promise<void> {
        const docKey = activeUiDocKey();
        const overrides = uiOverridesStore.toRecord(docKey);
        if (!overrides) return;

        const model = activeGroup.editor.getModel();
        if (!model) return;

        const updated = writeUiOverrides(model.getValue(), overrides);
        if (updated !== model.getValue()) {
            model.pushStackElement();
            model.pushEditOperations([], [{ range: model.getFullModelRange(), text: updated }], () => null);
            model.pushStackElement();
        }
        uiOverridesStore.markClean(docKey);
        refreshUiDirtyIndicator();
        await persistActiveTab?.();
        appInstance.appendOutput('info', `Saved ${Object.keys(overrides).length} #UI value(s) to the document.`);
    }

    appInstance.onSaveUiOverridesRequest = () => { void saveUiOverrides(); };

    async function leaveUiDoc(): Promise<boolean> {
        const docKey = activeUiDocKey();
        if (uiOverridesStore.isDirty(docKey)) {
            const choice = await confirmThreeWay({
                title: 'Unsaved input values',
                message: 'Save the values entered in the input form before exiting? They are discarded otherwise.',
                yesLabel: 'Save',
                noLabel: "Don't Save",
            });
            if (choice === 'cancel') return false;
            if (choice === 'yes') await saveUiOverrides();
        }
        uiOverridesStore.clear(docKey);
        return true;
    }

    appInstance.onExitUiModeRequest = leaveUiDoc;

    async function confirmLeaveUiDoc(): Promise<boolean> {
        if (!appInstance.isPreviewVisible() || appInstance.getResultMode() !== 'ui') return true;
        return await leaveUiDoc();
    }

    function metadataDocKeyFor(group: EditorGroup, id: string): string {
        return group.tabs.getFilePath(id) || `tab:${id}`;
    }

    async function confirmDiscardMetadataDraft(docKey: string, title: string): Promise<boolean> {
        if (!uiOverridesStore.isMetadataDirty(docKey)) return true;
        const choice = await confirmThreeWay({
            title: 'Unsaved properties',
            message: `Discard the unapplied Properties changes to ${title}?`,
            yesLabel: 'Discard',
            noLabel: 'Keep Editing',
        });
        if (choice !== 'yes') return false;
        uiOverridesStore.setMetadataDirty(docKey, false);
        discardMetadataDraft(docKey);
        return true;
    }

    appInstance.onPreviewToggled = (visible: boolean) => {
        syncInputMode();
        if (visible) {
            setTimeout(refreshAllPreviews, 50);
        }
    };

    appInstance.onRunRequest = () => { void runRefresh(); };

    if (isTauri && tauriBridge) {
        const [
            { listen: tauriListen },
            { getCurrentWindow },
            tauriClipboard,
            { invoke: tauriInvoke },
            { exists: fileExists },
        ] = await Promise.all([
            import('@tauri-apps/api/event'),
            import('@tauri-apps/api/window'),
            import('@tauri-apps/plugin-clipboard-manager'),
            import('@tauri-apps/api/core'),
            import('@tauri-apps/plugin-fs'),
        ]);
        invokeTauri = tauriInvoke;
        const listenHere = <T>(event: string, handler: (e: { payload: T }) => void) =>
            tauriListen<T>(event, handler, { target: windowLabel });
        setNativeTitle = (title: string) => { void getCurrentWindow().setTitle(title); };
        refreshWindowTitle();
        editorBridge.readClipboardText = () => tauriClipboard.readText();
        const sourceModesShown = appInstance.resultModeAvailable('unwrapped');
        sourceModeMenuShown = !sourceModesShown;
        syncSourceModeMenuItems(sourceModesShown);

        const AUTOSAVE_DEBOUNCE_MS = 10_000;
        const draftTimers = new Map<string, ReturnType<typeof setTimeout>>();
        const draftIds = new Map<string, string>();

        function groupForTab(tabId: string): EditorGroup | null {
            for (const g of groups.values()) {
                if (g.tabs.all.some(t => t.id === tabId)) return g;
            }
            return null;
        }

        function draftIdFor(tabId: string): string {
            let id = draftIds.get(tabId);
            if (!id) {
                id = crypto.randomUUID();
                draftIds.set(tabId, id);
            }
            return id;
        }

        async function writeDraft(tabId: string): Promise<void> {
            const g = groupForTab(tabId);
            if (!g || !g.tabs.isDirty(tabId)) return;
            const content = g.tabs.getContent(tabId);
            if (content == null) return;
            const filePath = g.tabs.getFilePath(tabId);
            const title = g.tabs.getTitle(tabId) ?? 'Untitled';
            const filename = filePath ? title : `${title}.cpd`;
            try {
                await tauriInvoke('draft_write', {
                    id: draftIdFor(tabId),
                    filename,
                    filePath,
                    content,
                });
            } catch (err) {
                appInstance.appendOutput('warn',
                    `Autosave failed for ${title}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        async function deleteDraft(tabId: string): Promise<void> {
            const id = draftIds.get(tabId);
            if (!id) return;
            draftIds.delete(tabId);
            const timer = draftTimers.get(tabId);
            if (timer) {
                clearTimeout(timer);
                draftTimers.delete(tabId);
            }
            try {
                await tauriInvoke('draft_delete', { id });
            } catch { /* swallow */ }
        }

        interface DraftInfo {
            id: string;
            filename: string;
            filePath: string | null;
            savedAt: number;
            size: number;
        }
        interface DraftContent extends DraftInfo { content: string; }

        async function restoreDraft(info: DraftInfo): Promise<void> {
            try {
                const drafted = await tauriInvoke<DraftContent | null>('draft_read', { id: info.id });
                if (!drafted) return;
                const displayTitle = drafted.filePath
                    ? drafted.filename
                    : drafted.filename.replace(/\.cpd$/i, '');
                const newTabId = activeGroup.tabs.openDraft({
                    filePath: drafted.filePath,
                    title: displayTitle,
                    content: drafted.content,
                });
                draftIds.set(newTabId, drafted.id);
            } catch (err) {
                appInstance.appendOutput('warn',
                    `Draft recovery failed for ${info.filename}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        await listenHere<DraftInfo[]>('drafts-recovered', async (evt) => {
            const drafts = evt.payload;
            if (!drafts || drafts.length === 0) return;
            const summary = drafts
                .map(d => `• ${d.filename}${d.filePath ? ` (${d.filePath})` : ''}`)
                .join('\n');
            const choice = await confirmThreeWay({
                title: 'Recover unsaved changes?',
                message:
                    `CalcpadCE found ${drafts.length} unsaved draft${drafts.length === 1 ? '' : 's'} `
                    + `from a previous session:\n\n${summary}\n\n`
                    + `Restore them into new tabs? Choose "Don't Restore" to discard.`,
                yesLabel: 'Restore',
                noLabel: "Don't Restore",
            });
            if (choice === 'yes') {
                for (const d of drafts) await restoreDraft(d);
                appInstance.appendOutput('info', `Recovered ${drafts.length} draft(s).`);
            } else if (choice === 'no') {
                for (const d of drafts) {
                    try { await tauriInvoke('draft_delete', { id: d.id }); }
                    catch { /* ignored */ }
                }
                appInstance.appendOutput('info', `Discarded ${drafts.length} draft(s).`);
            }
        });

        async function loadFile(path: string): Promise<void> {
            const inActive = tabs.findByPath(path);
            if (inActive && inActive.id === tabs.activeId) return;
            if (!await confirmLeaveUiDoc()) return;
            if (inActive) {
                tabs.activate(inActive.id);
                return;
            }
            for (const g of groups.values()) {
                if (g === activeGroup) continue;
                const existing = g.tabs.findByPath(path);
                if (existing) {
                    const model = g.tabs.modelForTab(existing.id);
                    if (model) {
                        tabs.openLinked(model);
                        return;
                    }
                }
            }
            try {
                const content = await tauriBridge!.readFile(path);
                tabs.openFile(path, content);
                applyCompiledWorksheetMode(activeGroup);
                if (shouldAutoEnterUiMode(activeGroup)) autoEnterUiMode();
                await tauriBridge!.addRecentFile(path);
            } catch (err) {
                appInstance.appendOutput('error', 'Failed to open file: ' + (err instanceof Error ? err.message : String(err)));
            }
        }

        window.addEventListener('calcpad-open-file', (e: Event) => {
            const detail = (e as CustomEvent<{ path: string }>).detail;
            if (detail?.path) void loadFile(detail.path);
        });

        function captureSession(): void {
            const openFiles: string[] = [];
            for (const g of groups.values()) {
                for (const t of g.tabs.all) {
                    if (t.filePath && !openFiles.includes(t.filePath)) openFiles.push(t.filePath);
                }
            }
            workspace.update({ openFiles, activeFile: activeGroup.tabs.activeTab?.filePath ?? '' });
        }

        async function restoreSession(): Promise<void> {
            if (!isPrimaryWindow) return;
            for (const path of workspace.get().openFiles) {
                try {
                    if (!await fileExists(path)) continue;
                    tabs.openFile(path, await tauriBridge!.readFile(path));
                } catch (err) {
                    appInstance.appendOutput('debug', `Session restore skipped ${path}: ${err}`);
                }
            }
            const activePath = workspace.get().activeFile;
            const restored = activePath ? tabs.findByPath(activePath) : null;
            if (restored) tabs.activate(restored.id);
            applyCompiledWorksheetMode(activeGroup);
            if (shouldAutoEnterUiMode(activeGroup)) autoEnterUiMode();
        }

        await restoreSession();

        if (isTauri && isPrimaryWindow) {
            try {
                const pending = await tauriInvoke<string[]>('take_pending_launch_files');
                for (const path of pending) await loadFile(path);
            } catch {
                /* older desktop builds may not expose the command; ignore */
            }
        }

        async function saveActive(): Promise<boolean> {
            const active = tabs.activeTab;
            if (!active) return false;
            const content = tabs.activeModel?.getValue() ?? '';
            if (active.filePath) {
                await tauriBridge!.saveFile(active.filePath, content);
                tabs.markActiveSaved();
                await deleteDraft(active.id);
                return true;
            }
            const newPath = await tauriBridge!.saveFileAs(content);
            if (!newPath) return false;
            tabs.markActiveSaved({ filePath: newPath });
            applyCompiledWorksheetMode(activeGroup);
            await tauriBridge!.addRecentFile(newPath);
            await deleteDraft(active.id);
            return true;
        }

        persistActiveTab = saveActive;

        async function saveAsActive(): Promise<boolean> {
            const active = tabs.activeTab;
            const content = tabs.activeModel?.getValue() ?? '';
            const newPath = await tauriBridge!.saveFileAs(content);
            if (!newPath) return false;
            tabs.markActiveSaved({ filePath: newPath });
            applyCompiledWorksheetMode(activeGroup);
            await tauriBridge!.addRecentFile(newPath);
            if (active) await deleteDraft(active.id);
            return true;
        }

        async function tryCloseTab(group: EditorGroup, id: string): Promise<boolean> {
            const target = group.tabs.all.find(t => t.id === id);
            if (!target) return true;
            if (group === activeGroup && id === group.tabs.activeId && !await confirmLeaveUiDoc()) return false;
            if (!await confirmDiscardMetadataDraft(metadataDocKeyFor(group, id), target.title)) return false;
            if (activeGroup !== group) setActiveGroup(group);
            if (group.tabs.isDirty(id) && group.tabs.isLastReference(id)) {
                if (id !== group.tabs.activeId) group.tabs.activate(id);
                const choice = await confirmThreeWay({
                    title: 'Unsaved changes',
                    message: `Save changes to ${target.title} before closing?`,
                    yesLabel: 'Save',
                    noLabel: "Don't Save",
                });
                if (choice === 'cancel') return false;
                if (choice === 'yes') {
                    const saved = await saveActive();
                    if (!saved) return false;
                }
            }
            group.tabs.close(id);
            return true;
        }

        confirmCloseGroup = async (group: EditorGroup): Promise<boolean> => {
            const dirty = group.tabs.all.filter(t => t.dirty);
            for (const t of dirty) {
                const ok = await tryCloseTab(group, t.id);
                if (!ok) return false;
            }
            return true;
        };

        async function openNewWindow(): Promise<void> {
            try { await tauriInvoke('new_window'); }
            catch (err) { appInstance.appendOutput('error', `Could not open a new window: ${err}`); }
        }

        function wireGroupTauri(group: EditorGroup): void {
            const ed = group.editor;

            ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { void saveActive(); });
            ed.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS,
                () => { void saveAsActive(); },
            );
            ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO, async () => {
                const result = await tauriBridge!.openFile();
                if (result) await loadFile(result.path);
            });
            ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, () => {
                group.tabs.newUntitled();
            });
            ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyW, () => {
                void openNewWindow();
            });
            ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
                appInstance.togglePreview();
            });
            ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backslash, () => {
                void splitEditor();
            });
            ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Comma, () => {
                sidebarInstance.switchTab?.('settings');
            });
            ed.addCommand(monaco.KeyCode.F5, () => { void runRefresh(); });
            ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => { void runClipboardAction('copy'); });
            ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, () => { void runClipboardAction('cut'); });
            ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => { void runClipboardAction('paste'); });

            group.tabs.onTabContentChanged((tabId) => {
                const existing = draftTimers.get(tabId);
                if (existing) clearTimeout(existing);
                draftTimers.set(tabId, setTimeout(() => {
                    draftTimers.delete(tabId);
                    void writeDraft(tabId);
                }, AUTOSAVE_DEBOUNCE_MS));
            });
            group.tabs.onTabRemoved((tabId) => { void deleteDraft(tabId); });

            if (isPrimaryWindow) {
                group.tabs.onTabsChanged(() => { if (!isExiting) captureSession(); });
            }

            const dropTarget = appInstance.getEditorContainer(group.id) as HTMLElement | null;
            if (dropTarget) {
                dropTarget.addEventListener('dragover', e => {
                    e.preventDefault();
                    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                });
                dropTarget.addEventListener('drop', async e => {
                    e.preventDefault();
                    if (activeGroup !== group) setActiveGroup(group);
                    const files = e.dataTransfer?.files;
                    if (!files || files.length === 0) return;
                    for (const file of Array.from(files)) {
                        const dropped = file as File & { path?: string };
                        if (dropped.path) {
                            await loadFile(dropped.path);
                        } else {
                            const text = await dropped.text();
                            group.tabs.newUntitled(text);
                        }
                    }
                });
            }
        }

        wireGroupTauri(primaryGroup);
        groupWireHooks.push(wireGroupTauri);

        async function closeTabAndSettle(group: EditorGroup, id: string): Promise<void> {
            if (await tryCloseTab(group, id)) await handleEmptyGroup(group);
        }

        appInstance.onTabCloseRequest = (groupId: string, id: string) => {
            const g = groups.get(groupId);
            if (g) void closeTabAndSettle(g, id);
        };

        async function tryCloseTabsSequentially(group: EditorGroup, ids: string[]): Promise<void> {
            for (const id of ids) {
                const ok = await tryCloseTab(group, id);
                if (!ok) return;
            }
            await handleEmptyGroup(group);
        }

        appInstance.onTabCloseOthersRequest = (groupId: string, id: string) => {
            const g = groups.get(groupId);
            if (!g) return;
            const ids = g.tabs.all.filter(t => t.id !== id).map(t => t.id);
            void tryCloseTabsSequentially(g, ids);
        };
        appInstance.onTabCloseAllRequest = (groupId: string) => {
            const g = groups.get(groupId);
            if (!g) return;
            const ids = g.tabs.all.map(t => t.id);
            void tryCloseTabsSequentially(g, ids);
        };
        appInstance.onTabOpenContainingFolderRequest = (groupId: string, id: string) => {
            const g = groups.get(groupId);
            const t = g?.tabs.all.find(t => t.id === id);
            if (t?.filePath) {
                tauriBridge.handleMessage({ type: 'openContainingFolder', path: t.filePath });
            }
        };

        const writeClipboardText = async (text: string) => {
            try {
                await tauriClipboard.writeText(text);
            } catch (err) {
                appInstance.appendOutput('error', `Copy failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        };

        appInstance.onCopyTextRequest = (text: string) => { void writeClipboardText(text); };
        appInstance.onClipboardReadRequest = async () => {
            try {
                return await tauriClipboard.readText();
            } catch {
                return '';
            }
        };

        appInstance.onTabCopyFullPathRequest = (groupId: string, id: string) => {
            const g = groups.get(groupId);
            const t = g?.tabs.all.find(t => t.id === id);
            if (t?.filePath) void writeClipboardText(t.filePath);
        };
        appInstance.onTabCopyRelativePathRequest = async (groupId: string, id: string) => {
            const g = groups.get(groupId);
            const t = g?.tabs.all.find(t => t.id === id);
            if (!t?.filePath) return;
            const folder = await tauriBridge.getOpenedFolder();
            if (!folder) {
                void writeClipboardText(t.filePath);
                return;
            }
            const rootNorm = folder.replace(/[\\/]+$/, '');
            const sep = rootNorm.includes('\\') ? '\\' : '/';
            const rootWithSep = rootNorm + sep;
            const rel = t.filePath.startsWith(rootWithSep)
                ? t.filePath.substring(rootWithSep.length)
                : t.filePath;
            void writeClipboardText(rel);
        };

        async function tryPasteClipboardImage(): Promise<boolean> {
            let pngBytes: Uint8Array | null = null;
            try {
                const image = await tauriClipboard.readImage();
                const rgba = await image.rgba();
                const { width, height } = await image.size();
                if (!width || !height || rgba.length === 0) return false;
                pngBytes = await rgbaToPng(rgba, width, height);
            } catch {
                return false;
            }
            if (!pngBytes) return false;
            await tauriBridge!.insertImageData({
                data: pngBytes,
                mimeType: 'image/png',
                filename: 'pasted-image.png',
            });
            return true;
        }

        async function runClipboardAction(
            action: 'cut' | 'copy' | 'paste' | 'select-all' | 'undo' | 'redo' | 'find' | 'replace',
        ): Promise<void> {
            if (action === 'copy' && !editor.hasTextFocus()) {
                const domText = window.getSelection()?.toString() ?? '';
                if (domText) {
                    try { await tauriClipboard.writeText(domText); } catch { /* ignored */ }
                    return;
                }
            }
            const editorHasFocus = editor.hasTextFocus();
            if (editorHasFocus) {
                if (action === 'copy' || action === 'cut') {
                    const sel = editor.getSelection();
                    const model = editor.getModel();
                    if (!sel || !model) return;
                    if (sel.isEmpty()) {
                        const line = sel.startLineNumber;
                        const text = model.getLineContent(line) + '\n';
                        try { await tauriClipboard.writeText(text); } catch { /* ignored */ }
                        if (action === 'cut') {
                            const lineCount = model.getLineCount();
                            const range = line < lineCount
                                ? new monaco.Range(line, 1, line + 1, 1)
                                : new monaco.Range(line, 1, line, model.getLineMaxColumn(line));
                            editor.executeEdits('menu-cut', [{ range, text: '', forceMoveMarkers: true }]);
                        }
                    } else {
                        const text = model.getValueInRange(sel);
                        try { await tauriClipboard.writeText(text); } catch { /* ignored */ }
                        if (action === 'cut') {
                            editor.executeEdits('menu-cut', [{ range: sel, text: '', forceMoveMarkers: true }]);
                        }
                    }
                    return;
                }
                if (action === 'paste') {
                    let text = '';
                    try { text = await tauriClipboard.readText(); } catch { /* ignored */ }
                    if (text) {
                        const sel = editor.getSelection();
                        if (!sel) return;
                        editor.executeEdits('menu-paste', [{ range: sel, text, forceMoveMarkers: true }]);
                        editor.pushUndoStop();
                        return;
                    }
                    await tryPasteClipboardImage();
                    return;
                }
                const cmd = {
                    'select-all': 'editor.action.selectAll',
                    undo: 'undo',
                    redo: 'redo',
                    find: 'actions.find',
                    replace: 'editor.action.startFindReplaceAction',
                }[action];
                editor.focus();
                editor.trigger('menu', cmd, null);
                return;
            }
            if (action === 'cut' || action === 'copy' || action === 'paste') {
                if (appInstance.runFocusedPreviewClipboardAction(action)) return;
            }
            if (action === 'find' && appInstance.openFindInFocusedPreview()) return;
            const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
            if (action === 'paste') {
                let text = '';
                try { text = await tauriClipboard.readText(); } catch { /* ignored */ }
                if (!text) return;
                if (el && 'setRangeText' in el) {
                    const start = el.selectionStart ?? el.value.length;
                    const end = el.selectionEnd ?? start;
                    el.setRangeText(text, start, end, 'end');
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
                return;
            }
            if (action === 'copy' || action === 'cut') {
                if (el && 'selectionStart' in el) {
                    const start = el.selectionStart ?? 0;
                    const end = el.selectionEnd ?? start;
                    if (end > start) {
                        const text = el.value.substring(start, end);
                        try { await tauriClipboard.writeText(text); } catch { /* ignored */ }
                        if (action === 'cut') {
                            el.setRangeText('', start, end, 'end');
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }
                }
                return;
            }
            if (action === 'select-all') {
                if (el && 'select' in el && typeof el.select === 'function') el.select();
                return;
            }
            if (action === 'undo' || action === 'redo') {
                document.execCommand(action);
            }
        }

        await listenHere<{ id: string }>('menu-click', async (evt) => {
            const id: string = evt.payload.id;
            if (id.startsWith('result-mode:')) {
                const mode = id.split(':')[1] as ResultMode;
                appInstance.setResultMode(mode);
                return;
            }
            if (id.startsWith('open-recent:')) {
                await loadFile(id.slice('open-recent:'.length));
                return;
            }
            if (id.startsWith('export-')) {
                const [format, variant] = id.slice('export-'.length).split(':');
                const type = format === 'pdf' ? 'generatePdf'
                    : format === 'html' ? 'saveSourceHtml'
                    : format === 'docx' ? 'saveDocx'
                    : null;
                if (type) {
                    tauriBridge.handleMessage({ type, variant: variant ?? 'report' });
                    return;
                }
            }
            switch (id) {
                case 'new': tabs.newUntitled(); break;
                case 'new-window': await openNewWindow(); break;
                case 'close-tab': {
                    const activeId = tabs.activeId;
                    if (activeId) await closeTabAndSettle(activeGroup, activeId);
                    break;
                }
                case 'open': {
                    const result = await tauriBridge.openFile();
                    if (result) await loadFile(result.path);
                    break;
                }
                case 'clear-recent': await tauriBridge.clearRecentFiles(); break;
                case 'save': await saveActive(); break;
                case 'save-as': await saveAsActive(); break;
                case 'save-as-compiled': await tauriBridge.saveCompiled(); break;
                case 'save-as-portable': await tauriBridge.savePortable(); break;
                case 'toggle-sidebar': appInstance.toggleSidebar(); break;
                case 'toggle-preview': appInstance.togglePreview(); break;
                case 'toggle-word-wrap': toggleWordWrap(); break;
                case 'split-editor': await splitEditor(); break;
                case 'unsplit-editor': {
                    const all = [...groups.values()];
                    const bottom = all[all.length - 1];
                    if (all.length > 1 && bottom) await closeGroup(bottom.id);
                    break;
                }
                case 'quit': await tryExit(); break;
                case 'refresh': await runRefresh(); break;
                case 'show-server-log': appInstance.showOutput('server'); break;
                case 'stop-server':
                    if (serverManager) {
                        appInstance.appendOutput('info', 'Stopping server…');
                        try {
                            await serverManager.forceStop();
                            appInstance.appendOutput('info', 'Server stopped. Use Restart Server to start it again.');
                        } catch (err) {
                            appInstance.appendOutput('error', `Stop failed: ${err instanceof Error ? err.message : String(err)}`);
                        }
                    }
                    break;
                case 'restart-server':
                    if (serverManager) {
                        appInstance.appendOutput('info', 'Restarting server…');
                        try {
                            await serverManager.restart();
                            appInstance.appendOutput('info', `Server restarted at ${serverManager.getBaseUrl()}`);
                        } catch (err) {
                            appInstance.appendOutput('error', `Restart failed: ${err instanceof Error ? err.message : String(err)}`);
                        }
                    }
                    break;
                case 'undo': runClipboardAction('undo'); break;
                case 'redo': runClipboardAction('redo'); break;
                case 'cut': await runClipboardAction('cut'); break;
                case 'copy': await runClipboardAction('copy'); break;
                case 'paste': await runClipboardAction('paste'); break;
                case 'select-all': runClipboardAction('select-all'); break;
                case 'find': runClipboardAction('find'); break;
                case 'replace': runClipboardAction('replace'); break;
                case 'help-documentation': {
                    const { openUrl } = await import('@tauri-apps/plugin-opener');
                    await openUrl('https://imartincei.github.io/CalcpadCE/');
                    break;
                }
            }
        });

        window.addEventListener('message', (e) => {
            const data = (e as MessageEvent).data;
            if (!data || typeof data !== 'object') return;
            if (data.type === 'serverLogResponse') {
                if (data.error) {
                    appInstance.appendOutput('warn',
                        `Server log unavailable (${data.path || '<unknown>'}): ${data.error}`);
                    return;
                }
                const text = (data.content || '').trim();
                if (!text) {
                    appInstance.appendOutput('info', `Server log is empty: ${data.path}`);
                    return;
                }
                appInstance.appendOutput('info', `--- Server log (${data.path}) ---`);
                for (const line of text.split('\n')) {
                    if (!line.trim()) continue;
                    const level = /\[(INFO|WARN|WARNING|ERROR|CRASH)\]/i.exec(line)?.[1]?.toUpperCase();
                    const sev = level === 'ERROR' || level === 'CRASH' ? 'error'
                        : level === 'WARN' || level === 'WARNING' ? 'warn'
                        : level === 'INFO' ? 'info'
                        : 'error';
                    appInstance.appendOutput(sev, line);
                }
                appInstance.appendOutput('info', '--- end server log ---');
            } else if (data.type === 'pdfError') {
                appInstance.appendOutput('error', String(data.message || 'PDF export failed'));
            } else if (data.type === 'pdfInfo') {
                appInstance.appendOutput('info', String(data.message || ''));
            }
        });

        window.addEventListener('keydown', (e) => {
            if ((e.key === 'x' || e.key === 'X') && e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey) {
                e.preventDefault();
                void runRefresh();
                return;
            }
            if (!e.ctrlKey || e.metaKey) return;
            if ((e.key === 'w' || e.key === 'W') && e.altKey && !e.shiftKey) {
                e.preventDefault();
                void openNewWindow();
                return;
            }
            if ((e.key === 's' || e.key === 'S') && !e.altKey) {
                e.preventDefault();
                if (e.shiftKey) void saveAsActive(); else void saveActive();
                return;
            }
            if ((e.key === 'o' || e.key === 'O') && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                void (async () => {
                    const result = await tauriBridge.openFile();
                    if (result) await loadFile(result.path);
                })();
                return;
            }
            if ((e.key === 'n' || e.key === 'N') && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                tabs.newUntitled();
                return;
            }
            if ((e.key === 'p' || e.key === 'P') && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                appInstance.togglePreview();
                return;
            }
            if (e.key === '\\' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                void splitEditor();
                return;
            }
            if (e.key === ',' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                sidebarInstance.switchTab?.('settings');
                return;
            }
            if (e.shiftKey && (e.key === 'B' || e.key === 'b') && !e.altKey) {
                e.preventDefault();
                appInstance.toggleSidebar();
                return;
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) activeGroup.tabs.activatePrev(); else activeGroup.tabs.activateNext();
                return;
            }
            if (e.key === 't' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                activeGroup.tabs.newUntitled();
                return;
            }
            if (e.key === 'w' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                const id = activeGroup.tabs.activeId;
                if (id) void closeTabAndSettle(activeGroup, id);
                return;
            }
            if (e.key >= '1' && e.key <= '9' && !e.shiftKey && !e.altKey) {
                const n = parseInt(e.key, 10);
                const index = n === 9 ? activeGroup.tabs.count - 1 : n - 1;
                const target = activeGroup.tabs.all[index];
                if (target) void activateTab(activeGroup.id, target.id);
                e.preventDefault();
            }
        });

        let isExiting = false;
        let allowWindowClose = false;
        const CLOSE_WAIT_CAP_MS = 120_000;

        async function confirmWindowClose(): Promise<boolean> {
            if (!await confirmLeaveUiDoc()) return false;
            const dirty: { group: EditorGroup; id: string }[] = [];
            for (const g of groups.values()) {
                for (const t of g.tabs.all) {
                    if (t.dirty || uiOverridesStore.isMetadataDirty(metadataDocKeyFor(g, t.id))) dirty.push({ group: g, id: t.id });
                }
            }
            for (const { group, id } of dirty) {
                if (!await tryCloseTab(group, id)) return false;
            }
            return true;
        }

        async function ackWindowClose(ok: boolean): Promise<void> {
            try {
                const { emitTo } = await import('@tauri-apps/api/event');
                await emitTo('main', 'calcpad-close-window-ack', {
                    label: getCurrentWindow().label,
                    ok,
                });
            } catch {
                /* the main window is on its way out regardless */
            }
        }

        async function closeSecondaryWindows(): Promise<boolean> {
            const labels = (await tauriInvoke<string[]>('window_labels')).filter(l => l !== 'main');
            if (labels.length === 0) return true;
            let cancelled = false;
            const unlisten = await listenHere<{ ok: boolean }>('calcpad-close-window-ack', (evt) => {
                if (!evt.payload.ok) cancelled = true;
            });
            const { emitTo } = await import('@tauri-apps/api/event');
            for (const label of labels) await emitTo(label, 'calcpad-close-window');
            const deadline = Date.now() + CLOSE_WAIT_CAP_MS;
            while (!cancelled && await windowCount() > 1 && Date.now() < deadline) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            unlisten();
            return !cancelled && await windowCount() === 1;
        }

        async function shutdownProcess(): Promise<void> {
            connectionMonitor.stop();
            if (serverManager) {
                try { await serverManager.dispose(); }
                catch (e) { appInstance.appendOutput('debug', `serverManager.dispose() rejected: ${e}`); }
            }
            try { await workspace.flush(); }
            catch (e) { appInstance.appendOutput('debug', `workspace.flush() rejected: ${e}`); }
            appInstance.appendOutput('debug', 'Exit path: closing the final window');
            allowWindowClose = true;
            await getCurrentWindow().close();
        }

        async function windowCount(): Promise<number> {
            try { return (await tauriInvoke<string[]>('window_labels')).length; }
            catch { return 1; }
        }

        async function tryExit(fromMainClose = false): Promise<void> {
            if (isExiting) return;
            isExiting = true;
            if (isPrimaryWindow) captureSession();
            try {
                if (!await confirmWindowClose()) {
                    isExiting = false;
                    if (fromMainClose) await ackWindowClose(false);
                    return;
                }
                if (isPrimaryWindow && !await closeSecondaryWindows()) {
                    isExiting = false;
                    return;
                }
            } catch (e) {
                appInstance.appendOutput('debug', `Close prompts failed, closing anyway: ${e}`);
            }
            if (!isPrimaryWindow && await windowCount() > 1) {
                await getCurrentWindow().destroy();
                return;
            }
            await shutdownProcess();
        }

        quitApplication = tryExit;

        if (!isPrimaryWindow) {
            await listenHere('calcpad-close-window', () => { void tryExit(true); });
        }

        await getCurrentWindow().onCloseRequested(async (event) => {
            if (allowWindowClose) return;
            event.preventDefault();
            void tryExit();
        });
    }
}

bootstrap().catch((err) => {
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
    const panel = document.createElement('pre');
    panel.setAttribute('style', [
        'position:fixed', 'inset:0', 'margin:0', 'padding:24px',
        'background:#1e1e1e', 'color:#f48771',
        'font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
        'white-space:pre-wrap', 'overflow:auto', 'z-index:2147483647',
    ].join(';'));
    panel.textContent = `CalcpadCE failed to start.\n\n${detail}`;
    document.body.appendChild(panel);
});

import * as monaco from 'monaco-editor';
import { createApp, nextTick } from 'vue';
import App from './App.vue';
import CalcpadAppVue from 'calcpad-frontend/vue/components/CalcpadApp.vue';
import { initMessaging } from 'calcpad-frontend/vue/services/messaging';
import { MessageBridge } from './services/message-bridge';
import { buildApiSettings } from 'calcpad-frontend/types/settings';
import { registerCalcpadLanguage, registerCalcpadTheme, createCalcpadEditor } from './editor/setup';
import { registerSemanticTokensProvider } from './editor/semantic-tokens';
import { setupDiagnostics } from './editor/diagnostics';
import { registerCompletionProvider } from './editor/completions';
import './editor/vscode-variables.css';
import './styles/app.css';

// Monaco worker setup — must run before editor creation
import './editor/workers';

/** Runtime check: are we running inside a Neutralino window? */
const isNeutralino = typeof (window as any).NL_TOKEN !== 'undefined';

// Determine server URL:
// 1. ?server= query param
// 2. VITE_SERVER_URL env var
// 3. Default to same origin
function getServerUrl(): string {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('server');
    if (fromParam) return fromParam;

    if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;

    return window.location.origin;
}

function getSampleContent(): string {
    return `'CalcPad Web Editor
'Enter your calculations below

a = 3
b = 4
c = √(a² + b²)
`;
}

/**
 * Wait for the Neutralino server extension to broadcast its URL.
 * Falls back to the default URL after a timeout.
 */
async function waitForServerExtension(timeoutMs: number = 10000): Promise<string> {
    const { events, init } = await import('@neutralinojs/lib');
    init();

    return new Promise<string>((resolve) => {
        const timer = setTimeout(() => {
            // Extension didn't respond in time — use fallback
            resolve(getServerUrl());
        }, timeoutMs);

        events.on('serverReady', (evt: any) => {
            clearTimeout(timer);
            resolve(evt.detail?.url ?? getServerUrl());
        });
    });
}

/**
 * Set up the Neutralino native menu bar.
 * Menu click events are dispatched as custom window events.
 */
async function setupNeutralinoMenu(): Promise<void> {
    const { window: nWindow, events } = await import('@neutralinojs/lib');

    await nWindow.setMainMenu([
        {
            id: 'file',
            text: 'File',
            menuItems: [
                { id: 'new', text: 'New', shortcut: 'Ctrl+N' },
                { id: 'open', text: 'Open...', shortcut: 'Ctrl+O' },
                { id: '-' },
                { id: 'save', text: 'Save', shortcut: 'Ctrl+S' },
                { id: 'save-as', text: 'Save As...', shortcut: 'Ctrl+Shift+S' },
                { id: '-' },
                { id: 'export-pdf', text: 'Export PDF...' },
                { id: '-' },
                { id: 'quit', text: 'Quit', shortcut: 'Ctrl+Q' },
            ],
        },
        {
            id: 'view',
            text: 'View',
            menuItems: [
                { id: 'toggle-sidebar', text: 'Toggle Sidebar', shortcut: 'Ctrl+B' },
            ],
        },
    ]);

    events.on('mainMenuItemClicked', (evt: any) => {
        window.dispatchEvent(new CustomEvent('neu-menu', { detail: evt.detail.id }));
    });
}

async function bootstrap(): Promise<void> {
    let serverUrl: string;
    let bridge: MessageBridge | null = null;
    let neuBridge: any = null;

    if (isNeutralino) {
        // Neutralino desktop: wait for server extension and use native bridge
        serverUrl = await waitForServerExtension();
        const { NeutralinoMessageBridge } = await import('./services/neutralino-bridge');
        neuBridge = new NeutralinoMessageBridge(serverUrl);
        (window as any).calcpadBridge = neuBridge;
    } else {
        // Pure web: use in-process web bridge
        serverUrl = getServerUrl();
        bridge = new MessageBridge(serverUrl);
        (window as any).calcpadBridge = bridge;
    }

    const activeBridge = neuBridge ?? bridge!;

    // Initialize the platform messaging (reads VITE_PLATFORM='web')
    initMessaging();

    // Mount the main app layout
    const app = createApp(App, { isNeutralino });
    const appInstance = app.mount('#app') as any;

    // Wait for DOM to render, then set up Monaco editor
    await nextTick();

    const editorEl = document.querySelector('.editor-container') as HTMLElement;
    if (!editorEl) {
        throw new Error('Editor container not found');
    }

    registerCalcpadLanguage();
    registerCalcpadTheme();
    const editor = createCalcpadEditor(editorEl, {
        value: isNeutralino ? '' : getSampleContent(),
    });

    // Wire the bridge's insertText handler to Monaco
    activeBridge.onInsertText = (text: string) => {
        const selection = editor.getSelection();
        if (selection) {
            editor.executeEdits('calcpad-insert', [{
                range: selection,
                text,
                forceMoveMarkers: true,
            }]);
        }
        editor.focus();
    };

    // Wire Output panel: intercept console methods to pipe into the panel
    const origDebug = console.debug;
    const origWarn = console.warn;
    const origError = console.error;

    console.debug = (...args: any[]) => {
        origDebug.apply(console, args);
        const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
        appInstance.appendOutput('debug', msg);
    };
    console.warn = (...args: any[]) => {
        origWarn.apply(console, args);
        const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
        appInstance.appendOutput('warn', msg);
    };
    console.error = (...args: any[]) => {
        origError.apply(console, args);
        const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
        appInstance.appendOutput('error', msg);
    };

    // Also capture unhandled errors
    window.addEventListener('error', (e) => {
        appInstance.appendOutput('error', `Uncaught: ${e.message} (${e.filename}:${e.lineno})`);
    });
    window.addEventListener('unhandledrejection', (e) => {
        appInstance.appendOutput('error', `Unhandled rejection: ${e.reason}`);
    });

    appInstance.appendOutput('info', `CalcPad Web started — server: ${serverUrl}`);

    // Register Monaco providers
    registerSemanticTokensProvider(activeBridge.api);
    setupDiagnostics(editor, activeBridge.api);
    registerCompletionProvider(activeBridge.snippets);

    // Problems panel: listen for marker changes and feed into App
    function markerToSeverityInfo(severity: monaco.MarkerSeverity) {
        switch (severity) {
            case monaco.MarkerSeverity.Error:
                return { severityClass: 'error', icon: '✕' };
            case monaco.MarkerSeverity.Warning:
                return { severityClass: 'warning', icon: '⚠' };
            default:
                return { severityClass: 'info', icon: 'ℹ' };
        }
    }

    monaco.editor.onDidChangeMarkers(([resource]) => {
        const model = editor.getModel();
        if (!model || resource.toString() !== model.uri.toString()) return;

        const markers = monaco.editor.getModelMarkers({ resource });
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

        // Sort: errors first, then warnings, then info
        items.sort((a, b) => b.severity - a.severity);
        appInstance.setProblems(items);
    });

    // Handle click-to-navigate from problems panel
    appInstance.onGotoProblem = (problem: any) => {
        editor.revealLineInCenter(problem.startLineNumber);
        editor.setPosition({
            lineNumber: problem.startLineNumber,
            column: problem.startColumn,
        });
        editor.focus();
    };

    // Mount the CalcPad Vue sidebar
    const sidebarApp = createApp(CalcpadAppVue);
    sidebarApp.mount('#vue-sidebar');

    // HTML preview via convert endpoint (debounced)
    let previewTimer: ReturnType<typeof setTimeout> | null = null;
    // TOC headings refresh (debounced)
    let tocTimer: ReturnType<typeof setTimeout> | null = null;

    async function refreshPreview(): Promise<void> {
        if (!appInstance.isPreviewVisible()) return;

        const content = editor.getValue();
        const settings = activeBridge.getSettings();
        const apiSettings = buildApiSettings(settings);
        const html = await activeBridge.api.convert(content, apiSettings, 'html');

        if (typeof html === 'string') {
            appInstance.setPreviewHtml(html);
        }
    }

    editor.onDidChangeModelContent(() => {
        if (appInstance.isPreviewVisible()) {
            if (previewTimer) clearTimeout(previewTimer);
            previewTimer = setTimeout(refreshPreview, 800);
        }
        // Debounced TOC refresh
        if (tocTimer) clearTimeout(tocTimer);
        tocTimer = setTimeout(() => activeBridge.refreshHeadings(), 800);
    });

    // Refresh when preview is first opened
    appInstance.onPreviewToggled = (visible: boolean) => {
        if (visible) {
            setTimeout(refreshPreview, 50);
        }
    };

    // Neutralino-specific: native menu + file operations
    if (isNeutralino && neuBridge) {
        await setupNeutralinoMenu();

        let currentFilePath: string | null = null;

        window.addEventListener('neu-menu', async (e: Event) => {
            const action = (e as CustomEvent).detail;
            switch (action) {
                case 'new':
                    editor.setValue('');
                    currentFilePath = null;
                    appInstance.setFileName('');
                    appInstance.setDirty(false);
                    break;

                case 'open': {
                    const result = await neuBridge.openFile();
                    if (result) {
                        editor.setValue(result.content);
                        currentFilePath = result.path;
                        const name = result.path.split(/[\\/]/).pop() || result.path;
                        appInstance.setFileName(name);
                        appInstance.setDirty(false);
                    }
                    break;
                }

                case 'save': {
                    const content = editor.getValue();
                    if (currentFilePath) {
                        await neuBridge.saveFile(currentFilePath, content);
                        appInstance.setDirty(false);
                    } else {
                        const newPath = await neuBridge.saveFileAs(content);
                        if (newPath) {
                            currentFilePath = newPath;
                            const name = newPath.split(/[\\/]/).pop() || newPath;
                            appInstance.setFileName(name);
                            appInstance.setDirty(false);
                        }
                    }
                    break;
                }

                case 'save-as': {
                    const content = editor.getValue();
                    const newPath = await neuBridge.saveFileAs(content);
                    if (newPath) {
                        currentFilePath = newPath;
                        const name = newPath.split(/[\\/]/).pop() || newPath;
                        appInstance.setFileName(name);
                        appInstance.setDirty(false);
                    }
                    break;
                }

                case 'export-pdf':
                    neuBridge.handleMessage({ type: 'generatePdf' });
                    break;

                case 'toggle-sidebar':
                    appInstance.toggleSidebar();
                    break;

                case 'quit': {
                    const { app: nApp } = await import('@neutralinojs/lib');
                    nApp.exit();
                    break;
                }
            }
        });

        // Track dirty state
        editor.onDidChangeModelContent(() => {
            appInstance.setDirty(true);
        });
    }
}

bootstrap();

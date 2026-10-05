import type { MessageBridge } from './message-bridge';
import type { TauriMessageBridge } from './tauri-bridge';

export interface PlatformCapabilities {
    readonly isTauri: boolean;
    readonly isDesktop: boolean;
    readonly isWeb: boolean;
}

export interface PlatformBridge {
    readonly bridge: MessageBridge | TauriMessageBridge;
    readonly capabilities: PlatformCapabilities;

    inlineDocumentImages(html: string, budget: unknown): Promise<string>;
    resolveIncludePath(rawFileName: string): Promise<string>;
    readFile(path: string): Promise<string>;
    saveFile(path: string, content: string): Promise<void>;
    saveFileAs(content: string): Promise<string | null>;
    openFile(): Promise<{ path: string } | null>;
    listDirectory(path: string): Promise<string[]>;
    getOpenedFolder(): Promise<string | null>;
    expandEnvVars(raw: string): Promise<string>;
    getHomeDir(): Promise<string>;
    addRecentFile(path: string): Promise<void>;
    clearRecentFiles(): Promise<void>;
    insertImageData(data: { data: Uint8Array; mimeType: string; filename: string }): Promise<void>;
    saveCompiled(): Promise<void>;
    savePortable(): Promise<void>;
    handleMessage(msg: Record<string, unknown>): void;
}

export function getServerUrl(): string {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('server');
    if (fromParam) return fromParam;

    if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;

    return window.location.origin;
}

export function detectPlatform(): PlatformCapabilities {
    const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';
    return {
        isTauri,
        isDesktop: isTauri,
        isWeb: !isTauri,
    };
}

import type { AppInstance } from '../editor/app-instance';
import type { PlatformBridge } from '../services/platform';
import { ConnectionMonitor, setLogLevel, coerceLogLevel, toDisplayLogLevel } from 'calcpad-frontend';
import type { CalcpadLogLevel, ServerLifecycleState } from 'calcpad-frontend';

export interface ServerDependencies {
    appInstance: AppInstance;
    platform: PlatformBridge;
    editorBridge: { getExtraSetting(key: string): string | undefined };
    onServerLog: (line: string, stream: 'stdout' | 'stderr') => void;
    onUrlChanged: (newUrl: string) => void;
    onCrashExhausted: (crashOutput: string) => void;
    onStatusChanged: (state: ServerLifecycleState, detail: string) => void;
}

export class ServerManager {
    private connectionMonitor: ConnectionMonitor | null = null;

    constructor(private readonly deps: ServerDependencies) {}

    start(): void {
        this.connectionMonitor = new ConnectionMonitor({
            probe: (timeoutMs: number) => this.deps.platform.bridge.api.checkHealth(timeoutMs),
            onStatusChanged: (status) => this.deps.appInstance.setServerStatus(status),
            onRecovered: () => { /* handled by caller */ },
            log: (msg: string) => this.deps.appInstance.appendOutput('info', `[Server] ${msg}`),
        });
        this.connectionMonitor.start();
    }

    stop(): void {
        this.connectionMonitor?.stop();
    }

    applyLifecycle(state: ServerLifecycleState, detail: string): void {
        this.connectionMonitor?.applyLifecycle(state, detail);
    }

    flushLogs(pendingLogs: { msg: string; level?: CalcpadLogLevel }[]): void {
        for (const { msg, level } of pendingLogs) {
            this.deps.appInstance.appendOutput(toDisplayLogLevel(level), msg);
        }
        pendingLogs.length = 0;
    }

    flushRawLogs(pendingRawLogs: { line: string; stream: 'stdout' | 'stderr' }[]): void {
        for (const { line, stream } of pendingRawLogs) {
            this.deps.appInstance.appendOutput(stream === 'stderr' ? 'error' : 'info', line, 'server');
        }
        pendingRawLogs.length = 0;
    }

    setupLoggers(): void {
        setLogLevel(coerceLogLevel(this.deps.editorBridge.getExtraSetting('logLevel')));
    }
}

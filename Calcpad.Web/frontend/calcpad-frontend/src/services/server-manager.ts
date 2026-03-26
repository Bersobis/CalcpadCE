import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, execSync, ChildProcess } from 'child_process';
import type { ILogger } from '../types/interfaces';

/**
 * Manages the lifecycle of the bundled CalcPad server process.
 * Adapted from the VS Code extension's CalcpadServerManager with
 * vscode.OutputChannel replaced by ILogger interface.
 *
 * Uses a PID file to track the server process across extension restarts,
 * ensuring stale processes are cleaned up even after crashes or abrupt exits.
 */
export class CalcpadServerManager {
    private static readonly MAX_RESTARTS = 3;

    private serverProcess: ChildProcess | null = null;
    private port: number = 0;
    private logger: ILogger;
    private basePath: string;
    private dotnetPath: string;
    private _isRunning: boolean = false;
    private _disposed: boolean = false;
    private _restartCount: number = 0;
    private _lastCrashOutput: string[] = [];
    private pidFilePath: string;

    /** Called when auto-restart retries are exhausted. Receives the last stderr output. */
    public onCrashExhausted?: (crashOutput: string) => void;

    constructor(basePath: string, logger: ILogger, dotnetPath: string = 'dotnet') {
        this.basePath = basePath;
        this.logger = logger;
        this.dotnetPath = dotnetPath;
        this.pidFilePath = path.join(basePath, 'bin', '.calcpad-server.pid');
    }

    /**
     * Check if the bundled server DLL exists.
     */
    public static dllExists(basePath: string): boolean {
        const dllPath = path.join(basePath, 'bin', 'Calcpad.Server.dll');
        return fs.existsSync(dllPath);
    }

    /**
     * Kill any stale server process left over from a previous session.
     * Reads the PID from the PID file and kills it if still running.
     */
    public killStaleProcess(): void {
        try {
            if (!fs.existsSync(this.pidFilePath)) {
                return;
            }

            const stalePid = parseInt(fs.readFileSync(this.pidFilePath, 'utf-8').trim(), 10);
            if (isNaN(stalePid)) {
                this.removePidFile();
                return;
            }

            // Check if the process is still alive
            try {
                process.kill(stalePid, 0); // Signal 0 = existence check only
            } catch {
                this.log(`Stale PID ${stalePid} is no longer running`);
                this.removePidFile();
                return;
            }

            this.log(`Killing stale server process (PID ${stalePid})...`);
            if (process.platform === 'win32') {
                try {
                    execSync(`taskkill /F /T /PID ${stalePid}`, { timeout: 10000, stdio: 'ignore' });
                } catch {
                    // Process may have exited between check and kill
                }
            } else {
                try {
                    process.kill(stalePid, 'SIGKILL');
                } catch {
                    // Already dead
                }
            }
            this.log(`Stale process ${stalePid} cleaned up`);
            this.removePidFile();
        } catch (err) {
            this.log(`Error cleaning up stale process: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Start the bundled server. Cleans up any stale process, allocates a free port,
     * spawns the dotnet process, and waits for the server to become ready.
     */
    public async start(): Promise<void> {
        if (this._isRunning) {
            this.log('Server is already running');
            return;
        }

        // Clean up any orphaned server from a previous session
        this.killStaleProcess();

        const dllPath = path.join(this.basePath, 'bin', 'Calcpad.Server.dll');
        if (!fs.existsSync(dllPath)) {
            throw new Error(`Calcpad.Server.dll not found at ${dllPath}`);
        }

        this.port = await this.findFreePort();
        this.log(`Starting server on port ${this.port}...`);

        const serverUrl = `http://localhost:${this.port}`;

        this.serverProcess = spawn(this.dotnetPath, [dllPath, '--urls', serverUrl], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Write PID file so we can clean up orphaned processes on next startup
        if (this.serverProcess.pid) {
            this.writePidFile(this.serverProcess.pid);
        }

        this.serverProcess.stdout?.on('data', (data: Buffer) => {
            this.log(`[stdout] ${data.toString().trim()}`);
        });

        this.serverProcess.stderr?.on('data', (data: Buffer) => {
            const text = data.toString().trim();
            this.log(`[stderr] ${text}`);
            // Buffer recent stderr lines for crash reporting
            this._lastCrashOutput.push(text);
            if (this._lastCrashOutput.length > 20) {
                this._lastCrashOutput.shift();
            }
        });

        this.serverProcess.on('error', (err: Error) => {
            this.log(`[error] Failed to start server: ${err.message}`);
            this._isRunning = false;
        });

        this.serverProcess.on('exit', (code, signal) => {
            this.log(`[exit] Server process exited (code=${code}, signal=${signal})`);
            this._isRunning = false;
            this.serverProcess = null;
            this.removePidFile();

            // Auto-restart if not intentionally disposed
            if (!this._disposed && code !== 0) {
                this._restartCount++;
                if (this._restartCount < CalcpadServerManager.MAX_RESTARTS) {
                    this.log(`Unexpected exit — attempting restart ${this._restartCount}/${CalcpadServerManager.MAX_RESTARTS} in 2 seconds...`);
                    setTimeout(() => {
                        if (!this._disposed) {
                            this.start().catch(err => {
                                this.log(`Restart failed: ${err instanceof Error ? err.message : String(err)}`);
                            });
                        }
                    }, 2000);
                } else {
                    const crashOutput = this._lastCrashOutput.join('\n');
                    this.log(`Server crashed ${this._restartCount} times — auto-restart disabled. Use refresh to restart manually.`);
                    this.onCrashExhausted?.(crashOutput);
                }
            }
        });

        await this.waitForReady(serverUrl);
        this._isRunning = true;
        this._lastCrashOutput = [];
        this.log(`Server is ready at ${serverUrl}`);
    }

    /**
     * Stop the server process gracefully.
     */
    public async stop(): Promise<void> {
        this._disposed = true;

        if (!this.serverProcess) {
            return;
        }

        this.log('Stopping server...');

        const proc = this.serverProcess;
        const pid = proc.pid;
        this.serverProcess = null;
        this._isRunning = false;

        const isWindows = process.platform === 'win32';

        // On Windows, use taskkill /T to kill the entire process tree
        // (including child processes like chrome-headless-shell.exe).
        // Node's proc.kill() only kills the parent process on Windows.
        if (isWindows && pid) {
            try {
                execSync(`taskkill /F /T /PID ${pid}`, { timeout: 10000, stdio: 'ignore' });
                this.log('Server process tree killed');
            } catch {
                // Process may already be dead
                this.log('taskkill completed (process may have already exited)');
            }
        } else {
            proc.kill('SIGTERM');

            // Force kill after timeout
            await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                    try {
                        proc.kill('SIGKILL');
                    } catch {
                        // Process may already be dead
                    }
                    resolve();
                }, 5000);

                proc.on('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });
        }

        this.removePidFile();
        this.log('Server stopped');
    }

    /**
     * Get the base URL of the running server.
     */
    public getBaseUrl(): string {
        return `http://localhost:${this.port}`;
    }

    public get isRunning(): boolean {
        return this._isRunning;
    }

    /**
     * Stop and restart the server, resetting the retry counter.
     * Use this for manual restarts (e.g., refresh button).
     */
    public async restart(): Promise<void> {
        this._disposed = false;
        this._restartCount = 0;
        await this.stop();
        this._disposed = false; // stop() sets _disposed = true
        await this.start();
    }

    public getLastCrashOutput(): string {
        return this._lastCrashOutput.join('\n');
    }

    public dispose(): void {
        this.stop();
    }

    private writePidFile(pid: number): void {
        try {
            fs.writeFileSync(this.pidFilePath, String(pid), 'utf-8');
        } catch (err) {
            this.log(`Warning: Could not write PID file: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private removePidFile(): void {
        try {
            if (fs.existsSync(this.pidFilePath)) {
                fs.unlinkSync(this.pidFilePath);
            }
        } catch {
            // Ignore — best effort cleanup
        }
    }

    private async findFreePort(): Promise<number> {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.listen(0, '127.0.0.1', () => {
                const address = server.address();
                if (address && typeof address !== 'string') {
                    const port = address.port;
                    server.close(() => resolve(port));
                } else {
                    server.close(() => reject(new Error('Could not allocate port')));
                }
            });
            server.on('error', reject);
        });
    }

    private async waitForReady(serverUrl: string, maxAttempts: number = 60, intervalMs: number = 500): Promise<void> {
        const healthUrl = `${serverUrl}/api/calcpad/snippets`;

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await fetch(healthUrl);
                if (response.ok) {
                    return;
                }
            } catch {
                // Server not ready yet
            }
            await new Promise(r => setTimeout(r, intervalMs));
        }

        throw new Error(`Server did not become ready within ${maxAttempts * intervalMs / 1000} seconds`);
    }

    private log(message: string): void {
        this.logger.appendLine(`[ServerManager] ${message}`);
    }
}

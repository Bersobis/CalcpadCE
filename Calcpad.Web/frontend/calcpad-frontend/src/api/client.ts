import type { ILogger } from '../types/interfaces';
import type {
    LintRequest,
    LintResponse,
    HighlightRequest,
    HighlightResponse,
    HighlightToken,
    DefinitionsRequest,
    DefinitionsResponse,
    SymbolAtPositionRequest,
    SymbolAtPositionResponse,
    PrettifyRequest,
    PrettifyResponse,
    CalcpadError,
    ConvertResult,
    UiConvertOptions,
    CpdzDecodeResponse,
    CpdzEncodeResponse,
    PortableBundleResult,
    PortablePackageResult,
    GitHubStatus,
    GitHubFile,
    GitHubDirectoryEntry,
    GitHubIssue,
    GitHubCommitRequest,
    GitHubCommit,
} from '../types/api';
import type { SnippetsResponse } from '../types/snippets';

/** Request header carrying the server's per-launch token. Must match the backend's constant. */
export const API_TOKEN_HEADER = 'X-Calcpad-Token';

/**
 * How long a request waits for a base URL before giving up. Covers a cold start: the VS Code
 * extension has to resolve a .NET runtime, which may prompt, before the server binds a port.
 */
const BASE_URL_WAIT_MS = 30_000;

/** What the endpoints that report to the user directly say when no server ever arrived. */
const NO_SERVER_ERROR = 'No CalcpadCE server is available.';

/** Mirrors the backend's own loopback test (`Program.IsLoopbackHost`). */
function isLoopbackUrl(url: string): boolean {
    try {
        const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
        return host === 'localhost' || host === '::1' || /^127\./.test(host);
    } catch {
        return false;
    }
}

/**
 * Unified fetch-based API client for the CalcPad server, replacing scattered axios calls.
 * Works in Node.js 18+ and browsers.
 */
export class CalcpadApiClient {
    private baseUrl: string;
    private logger?: ILogger;
    private authToken: string | null = null;

    // Per-key "latest wins" bookkeeping: a caller passes `key` (e.g. an editor group id) to mean
    // "only the newest request for this key still matters", so an older request sharing it is
    // aborted once a newer one starts. Requests with no key run independently.
    private keySeq = new Map<string, number>();
    private keyAbort = new Map<string, AbortController>();

    // Resolves as soon as a base URL exists. The VS Code extension builds this client during
    // activation, well before the bundled server has bound a port, so requests can arrive while
    // `baseUrl` is still empty.
    private readonly baseUrlReady: Promise<void>;
    private signalBaseUrlReady?: () => void;
    // Set once the wait below has run out, so a host with no server at all fails the next
    // request straight away instead of parking every keystroke's lint for the full timeout.
    private baseUrlUnavailable = false;

    constructor(baseUrl: string, logger?: ILogger) {
        this.baseUrl = baseUrl;
        this.logger = logger;
        this.baseUrlReady = new Promise<void>((resolve) => { this.signalBaseUrlReady = resolve; });
        if (baseUrl) this.signalBaseUrlReady?.();
    }

    public setBaseUrl(url: string): void {
        this.baseUrl = url;
        if (url) {
            this.baseUrlUnavailable = false;
            this.signalBaseUrlReady?.();
        }
    }

    public getBaseUrl(): string {
        return this.baseUrl;
    }

    /**
     * Sets the per-launch token the local server requires on every `/api` route.
     * Pass `null` for a server that runs without one (a remote URL, or a
     * development launch that never had `CALCPAD_API_TOKEN` set).
     */
    public setAuthToken(token: string | null): void {
        this.authToken = token || null;
    }

    /**
     * Auth headers for a request this client doesn't make itself, to be spread into the
     * `headers` of any direct `fetch` against the same server. Withheld for a non-loopback
     * base URL: the token belongs to a server this machine launched, and a configured remote
     * host has no business seeing it.
     */
    public authHeaders(): Record<string, string> {
        if (!this.authToken || !isLoopbackUrl(this.baseUrl)) return {};
        return { [API_TOKEN_HEADER]: this.authToken };
    }

    private jsonHeaders(): Record<string, string> {
        return { 'Content-Type': 'application/json', ...this.authHeaders() };
    }

    /**
     * The full URL for `endpoint`, waiting for a base URL to arrive if the server is still
     * starting. Without this a request issued during activation fetches the relative
     * `/api/calcpad/lint`, which fails with "Failed to parse URL from ..." — a confusing way
     * to say the server is not up yet.
     *
     * Null means no server ever arrived, and the caller reports a failed request as usual. That
     * verdict then sticks until a URL does arrive, so a host with no server at all does not park
     * each keystroke's lint for the full timeout.
     */
    private async resolveUrl(endpoint: string, tag: string): Promise<string | null> {
        if (this.baseUrl) return this.baseUrl + endpoint;
        if (this.baseUrlUnavailable) return null;
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
            this.baseUrlReady,
            new Promise<void>((resolve) => { timer = setTimeout(resolve, BASE_URL_WAIT_MS); }),
        ]);
        clearTimeout(timer);
        if (this.baseUrl) return this.baseUrl + endpoint;
        // Everything waiting hits this together, so only the first one reports it.
        if (!this.baseUrlUnavailable) {
            this.baseUrlUnavailable = true;
            this.logger?.appendLine(`[${tag}] No server URL — request skipped`, 'warning');
        }
        return null;
    }

    /**
     * Runs `task` immediately; if `key` is given, a later call sharing that key aborts this
     * one's signal rather than letting it run on. A superseded call resolves to `null`, the
     * same outcome callers already handle for a failed response.
     */
    private withSupersession<T>(key: string | undefined, task: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
        if (!key) return task(new AbortController().signal);

        const mySeq = (this.keySeq.get(key) ?? 0) + 1;
        this.keySeq.set(key, mySeq);
        this.keyAbort.get(key)?.abort();
        const controller = new AbortController();
        this.keyAbort.set(key, controller);

        return (async (): Promise<T | null> => {
            try {
                return await task(controller.signal);
            } finally {
                if (this.keyAbort.get(key) === controller) this.keyAbort.delete(key);
            }
        })();
    }

    public async lint(content: string, sourceFilePath?: string, opts?: { key?: string }): Promise<LintResponse | null> {
        const request: LintRequest = { content, sourceFilePath };
        return this.post<LintResponse>('/api/calcpad/lint', request, 'Lint', opts?.key);
    }

    public async highlight(content: string, includeText: boolean = false, sourceFilePath?: string, opts?: { key?: string }): Promise<HighlightToken[] | null> {
        const request: HighlightRequest = { content, includeText, sourceFilePath };
        const response = await this.post<HighlightResponse>('/api/calcpad/highlight', request, 'Highlight', opts?.key);
        return response?.tokens ?? null;
    }

    public async definitions(content: string, sourceFilePath?: string, opts?: { key?: string }): Promise<DefinitionsResponse | null> {
        const request: DefinitionsRequest = { content, sourceFilePath };
        return this.post<DefinitionsResponse>('/api/calcpad/definitions', request, 'Definitions', opts?.key);
    }

    /**
     * Resolve a cursor position to the user-defined symbol at that point and
     * return every occurrence of it. Server-side replacement for the legacy
     * client-side overlap test that powers go-to-definition, find-all-references,
     * and rename across all editor integrations.
     */
    public async symbolAtPosition(
        content: string,
        line: number,
        column: number,
        sourceFilePath?: string,
        opts?: { key?: string },
    ): Promise<SymbolAtPositionResponse | null> {
        const request: SymbolAtPositionRequest = { content, line, column, sourceFilePath };
        return this.post<SymbolAtPositionResponse>('/api/calcpad/symbol-at-position', request, 'SymbolAtPosition', opts?.key);
    }

    /**
     * Decodes a compiled `.cpdz` worksheet to its source text. `composite` marks the
     * archive form that bundles images: its bytes must be handed back to
     * {@link encodeCpdz} on save or those images are lost.
     */
    public async decodeCpdz(data: Uint8Array): Promise<CpdzDecodeResponse | null> {
        return this.post<CpdzDecodeResponse>(
            '/api/calcpad/cpdz/decode', { data: toBase64(data) }, 'DecodeCpdz');
    }

    /**
     * Encodes source text as a `.cpdz` worksheet. Pass the bytes of the file being
     * overwritten as `original` so a composite archive keeps its other entries.
     */
    public async encodeCpdz(content: string, original?: Uint8Array): Promise<Uint8Array | null> {
        const result = await this.post<CpdzEncodeResponse>('/api/calcpad/cpdz/encode',
            { content, original: original ? toBase64(original) : undefined }, 'EncodeCpdz');
        return result ? fromBase64(result.data) : null;
    }

    /**
     * Rewrites a worksheet into the self-contained form a compiled `.cpdz` needs: macros and
     * `#include`d files expanded, `#read` data inlined, an included file's image paths made
     * absolute so the host can embed them. Reports what stands in the way instead of
     * returning a worksheet that would still read files beside it — which is why this has
     * its own request rather than going through {@link post}, whose errors are only logged.
     */
    public bundlePortable(
        content: string,
        sourceFilePath?: string,
    ): Promise<PortableBundleResult> {
        return (async () => {
            try {
                const url = await this.resolveUrl('/api/calcpad/portable/bundle', 'BundlePortable');
                if (url === null) return { errors: [NO_SERVER_ERROR] };
                const response = await fetch(url, {
                    method: 'POST',
                    headers: this.jsonHeaders(),
                    body: JSON.stringify({ content, sourceFilePath }),
                    signal: AbortSignal.timeout(30000),
                });
                const body = await response.json().catch(() => null);
                if (response.ok && typeof body?.content === 'string') return { content: body.content, errors: [] };

                this.logger?.appendLine(`[BundlePortable] Server returned ${response.status}`, 'warning');
                const messages: unknown = body?.messages;
                return {
                    errors: Array.isArray(messages) && messages.length
                        ? messages.map(String)
                        : [body?.message ?? body?.error ?? `The server returned ${response.status}`],
                };
            } catch (error) {
                this.logError('BundlePortable', error);
                return { errors: [error instanceof Error ? error.message : String(error)] };
            }
        })();
    }

    /**
     * Packs a worksheet and the files it references into a ZIP that stays text — the document
     * with its directives intact, and a folder beside it holding what they name. Reports what
     * stands in the way instead of writing a package that is missing a file, so like
     * {@link bundlePortable} it has its own request rather than going through {@link post}.
     */
    public packagePortable(
        content: string,
        sourceFilePath?: string,
    ): Promise<PortablePackageResult> {
        return (async () => {
            try {
                const url = await this.resolveUrl('/api/calcpad/portable/package', 'PackagePortable');
                if (url === null) return { bundled: [], errors: [NO_SERVER_ERROR] };
                const response = await fetch(url, {
                    method: 'POST',
                    headers: this.jsonHeaders(),
                    body: JSON.stringify({ content, sourceFilePath }),
                    signal: AbortSignal.timeout(60000),
                });
                const body = await response.json().catch(() => null);
                if (response.ok && typeof body?.data === 'string') return {
                    zip: fromBase64(body.data),
                    name: String(body.name ?? 'worksheet.zip'),
                    refsFolder: String(body.refsFolder ?? ''),
                    bundled: Array.isArray(body.bundled) ? body.bundled.map(String) : [],
                    errors: [],
                };

                this.logger?.appendLine(`[PackagePortable] Server returned ${response.status}`, 'warning');
                const messages: unknown = body?.messages;
                return {
                    bundled: [],
                    errors: Array.isArray(messages) && messages.length
                        ? messages.map(String)
                        : [body?.message ?? body?.error ?? `The server returned ${response.status}`],
                };
            } catch (error) {
                this.logError('PackagePortable', error);
                return { bundled: [], errors: [error instanceof Error ? error.message : String(error)] };
            }
        })();
    }

    public async snippets(): Promise<SnippetsResponse | null> {
        return this.get<SnippetsResponse>('/api/calcpad/snippets', 'Snippets');
    }

    /**
     * Server-side log verbosity. Applies to the running process immediately, so it is pushed
     * again whenever the panel mounts — the server may have restarted since it was last set.
     */
    public async setServerLogLevel(level: string): Promise<{ level: string } | null> {
        return this.post<{ level: string }>('/api/calcpad/log-level', { level }, 'LogLevel');
    }

    public async getServerLogLevel(): Promise<{ level: string; available: string[] } | null> {
        return this.get<{ level: string; available: string[] }>('/api/calcpad/log-level', 'LogLevel');
    }

    /** Whether the server has a `GITHUB_TOKEN` and can proxy GitHub requests. */
    public async githubStatus(): Promise<GitHubStatus | null> {
        return this.get<GitHubStatus>('/api/github/status', 'GitHubStatus');
    }

    /** A file's content from a repository, with the blob sha needed to commit an update. */
    public async githubFile(
        owner: string, repo: string, path: string, gitRef?: string,
    ): Promise<GitHubFile | null> {
        const endpoint = `/api/github/file?${githubQuery({ owner, repo, path, ref: gitRef })}`;
        return this.get<GitHubFile>(endpoint, 'GitHubFile');
    }

    /** Directory listing for browsing a repository from the Files tab. */
    public async githubContents(
        owner: string, repo: string, path: string, gitRef?: string,
    ): Promise<GitHubDirectoryEntry[] | null> {
        const endpoint = `/api/github/contents?${githubQuery({ owner, repo, path, ref: gitRef })}`;
        return this.get<GitHubDirectoryEntry[]>(endpoint, 'GitHubContents');
    }

    /** Open or closed issues for a repository, newest first. */
    public async githubIssues(
        owner: string, repo: string, state: 'open' | 'closed' = 'open',
    ): Promise<GitHubIssue[] | null> {
        const endpoint = `/api/github/issues?${githubQuery({ owner, repo, state })}`;
        return this.get<GitHubIssue[]>(endpoint, 'GitHubIssues');
    }

    /** Creates or updates a file through the server's GitHub proxy. */
    public async githubCommit(request: GitHubCommitRequest): Promise<GitHubCommit | null> {
        return this.post<GitHubCommit>('/api/github/commit', request, 'GitHubCommit');
    }

    public async prettify(
        content: string,
        indentUnit?: string,
        trimTrailingWhitespace?: boolean
    ): Promise<PrettifyResponse | null> {
        const request: PrettifyRequest = { content, indentUnit, trimTrailingWhitespace };
        return this.post<PrettifyResponse>('/api/calcpad/prettify', request, 'Prettify');
    }

    /**
     * @param ui Interactive `#UI` mode. `enableUi` renders `#UI` lines as controls and
     *   hides `#post` content; `uiOverrides` replaces the right hand side of annotated
     *   assignments and applies in both modes, so a report reflects entered values;
     *   `hideErrorLines` drops the "on line [N]" reference and defaults to `enableUi`.
     * @param includeLineAnchors Per-line anchors and error boxes for in-preview line links.
     *   Defaults server-side to `!forPrint`; pass it to break that pairing — `true` for the
     *   on-screen report, `false` for anything being written to a file.
     * @param opts `write` lets this render run `#write`/`#append`. Off unless asked for, so a
     *   preview refresh never rewrites the document's output.
     */
    public async convert(
        content: string,
        settings: unknown,
        outputFormat: string = 'html',
        forPrint: boolean = false,
        sourceFilePath?: string,
        theme?: 'light' | 'dark',
        ui?: UiConvertOptions,
        includeLineAnchors?: boolean,
        opts?: { key?: string; write?: boolean },
    ): Promise<ArrayBuffer | ConvertResult | null> {
        return this.withSupersession(opts?.key, async (signal) => {
            const url = await this.resolveUrl('/api/calcpad/convert', 'Convert');
            if (url === null) return null;
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: this.jsonHeaders(),
                    body: JSON.stringify({
                        content, settings, outputFormat, forPrint, sourceFilePath, theme,
                        enableUi: ui?.enableUi ?? false,
                        uiOverrides: ui?.uiOverrides,
                        includeLineAnchors,
                        hideErrorLines: ui?.hideErrorLines,
                        write: opts?.write ?? false,
                    }),
                    signal: combineSignals(AbortSignal.timeout(60000), signal),
                });
                if (!response.ok) return null;

                if (outputFormat === 'pdf') {
                    return response.arrayBuffer();
                }
                const html = await response.text();
                return { html, errors: parseConvertErrorHeader(response) };
            } catch (error) {
                this.logError('Convert', error);
                return null;
            }
        });
    }

    /**
     * Convert calcpad → DOCX (Word): the backend renders to HTML internally, then runs the
     * Calcpad.OpenXml writer over it. Returns the .docx bytes, or null on failure.
     *
     * @param opts `forPrint` defaults to true — a Word export is a report unless the caller
     *   asks for the preview layout. `uiOverrides` makes the report show entered `#UI` values.
     */
    public async convertDocx(
        content: string,
        settings: unknown,
        sourceFilePath?: string,
        opts?: { forPrint?: boolean; uiOverrides?: Record<string, string>; write?: boolean },
    ): Promise<ArrayBuffer | null> {
        return (async () => {
            const url = await this.resolveUrl('/api/calcpad/docx', 'Docx');
            if (url === null) return null;
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: this.jsonHeaders(),
                    body: JSON.stringify({
                        content,
                        settings,
                        sourceFilePath,
                        forPrint: opts?.forPrint ?? true,
                        uiOverrides: opts?.uiOverrides,
                        write: opts?.write ?? false,
                    }),
                    signal: AbortSignal.timeout(60000),
                });
                if (!response.ok) return null;
                return response.arrayBuffer();
            } catch (error) {
                this.logError('ConvertDocx', error);
                return null;
            }
        })();
    }

    /**
     * Convert calcpad to "unwrapped" HTML — server returns just the body markup
     * without the document chrome. Used for preview-pane rendering.
     */
    public async convertUnwrapped(
        content: string,
        settings: unknown,
        sourceFilePath?: string,
        theme?: 'light' | 'dark',
        opts?: { key?: string; write?: boolean },
    ): Promise<ConvertResult | null> {
        return this.withSupersession(opts?.key, async (signal) => {
            const url = await this.resolveUrl('/api/calcpad/convert?unwrap=true', 'ConvertUnwrapped');
            if (url === null) return null;
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: this.jsonHeaders(),
                    body: JSON.stringify({ content, settings, sourceFilePath, theme, write: opts?.write ?? false }),
                    signal: combineSignals(AbortSignal.timeout(60000), signal),
                });
                if (!response.ok) return null;
                const html = await response.text();
                return { html, errors: parseConvertErrorHeader(response) };
            } catch (error) {
                this.logError('ConvertUnwrapped', error);
                return null;
            }
        });
    }

    /**
     * Renders a whole worksheet once and splits the result into one entry per
     * source line, for the live display pane.
     *
     * The pane used to ask for one line at a time, sending the document prefix
     * up to that line on every request. That made the server re-parse a growing
     * prefix for each line — quadratic work — and it could only be trusted while
     * nothing earlier had changed. One request per document renders every line
     * from the same pass, so a line's output can never disagree with the lines it
     * depends on, and the whole pane costs a single round trip.
     *
     * Returns the rendered inner HTML per line (0-based, `null` where the line
     * produced no output) plus the engine's own errors, which the pane uses to
     * mark rows and to validate the line being edited. A `null` *result* means
     * the request failed.
     *
     * `opts.key` supersedes an older request for the same key, so a new keystroke
     * cancels the render it replaced.
     */
    public async convertLines(
        content: string,
        settings: unknown,
        sourceFilePath?: string,
        opts?: { key?: string },
    ): Promise<LiveRender | null> {
        const result = await this.convert(
            content, settings, 'html', false,
            sourceFilePath, undefined, undefined, true, opts,
        );
        if (!result || result instanceof ArrayBuffer) return null;
        return { lines: splitRenderedLines(result.html, content), errors: result.errors };
    }

    /**
     * Runs an arbitrary request with the same per-key supersession as the
     * built-in methods above, for a caller whose request body isn't shaped
     * like any of them (e.g. an endpoint-specific extra field none of the
     * typed methods carry). `task` gets an `AbortSignal` that fires when it's
     * superseded — pass it as the `fetch` call's `signal` (combined with any
     * timeout signal of the caller's own) so a superseded request actually
     * aborts instead of running to completion unseen.
     */
    public runWithSupersession<T>(task: (signal: AbortSignal) => Promise<T>, opts?: { key?: string }): Promise<T | null> {
        return this.withSupersession(opts?.key, task);
    }

    /** Liveness probe. Answered from inside the pipeline, so a bound-but-wedged server fails it. */
    public async checkHealth(timeoutMs: number = 5000): Promise<boolean> {
        // Never waits: this is the liveness probe, and no URL is already the answer.
        if (!this.baseUrl) return false;
        try {
            const response = await fetch(this.baseUrl + '/api/calcpad/health', {
                headers: this.authHeaders(),
                signal: AbortSignal.timeout(timeoutMs),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    private post<T>(endpoint: string, body: unknown, tag: string, key?: string): Promise<T | null> {
        return this.withSupersession(key, async (signal) => {
            const url = await this.resolveUrl(endpoint, tag);
            if (url === null) return null;
            try {
                this.logger?.appendLine(`[${tag}] Sending request to server...`, 'verbose');
                const response = await fetch(url, {
                    method: 'POST',
                    headers: this.jsonHeaders(),
                    body: JSON.stringify(body),
                    signal: combineSignals(AbortSignal.timeout(30000), signal),
                });
                if (!response.ok) {
                    this.logger?.appendLine(`[${tag}] Server returned ${response.status}`, 'warning');
                    return null;
                }
                const data: T = await response.json();
                return data;
            } catch (error) {
                this.logError(tag, error);
                return null;
            }
        });
    }

    private async get<T>(endpoint: string, tag: string): Promise<T | null> {
        const url = await this.resolveUrl(endpoint, tag);
        if (url === null) return null;
        try {
            this.logger?.appendLine(`[${tag}] Sending request to server...`, 'verbose');
            const response = await fetch(url, {
                headers: this.authHeaders(),
                signal: AbortSignal.timeout(30000),
            });
            if (!response.ok) {
                this.logger?.appendLine(`[${tag}] Server returned ${response.status}`, 'warning');
                return null;
            }
            const data: T = await response.json();
            return data;
        } catch (error) {
            this.logError(tag, error);
            return null;
        }
    }

    private logError(tag: string, error: unknown): void {
        if (!this.logger) return;
        // AbortError and TimeoutError are both DOMExceptions from an aborted signal, but they
        // mean opposite things: withSupersession raises the first on every keystroke when a newer
        // request replaces this one, while only the second is a server that never answered.
        if (error instanceof DOMException && error.name === 'AbortError') {
            this.logger.appendLine(`[${tag}] Superseded by a newer request`, 'verbose');
        } else if (error instanceof DOMException && error.name === 'TimeoutError') {
            this.logger.appendLine(`[${tag}] Request timed out`, 'warning');
        } else if (error instanceof TypeError && error.message.includes('fetch')) {
            // Routine while the server is restarting; the connection monitor reports the outage.
            this.logger.appendLine(`[${tag}] Server connection refused`, 'verbose');
        } else {
            this.logger.appendLine(`[${tag}] Error: ${error instanceof Error ? error.message : String(error)}`, 'warning');
        }
    }
}

/** Query string for the GitHub proxy routes; omits values the caller left undefined. */
function githubQuery(params: Record<string, string | undefined>): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) query.set(key, value);
    }
    return query.toString();
}

export function parseConvertErrorHeader(response: Response): CalcpadError[] {
    const raw = response.headers.get('X-Calcpad-Errors');
    if (!raw) return [];
    try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/** The id prefix the engine puts on each rendered line's element (`id="line-7"`). */
const LINE_ANCHOR_PREFIX = 'line-';

/** One whole-document render, split into the pieces the live display needs. */
export interface LiveRender {
    /** Rendered inner HTML per 0-based source line; `null` where nothing was rendered. */
    lines: (string | null)[];
    /** The engine's errors for the document, each tagged with its source line. */
    errors: CalcpadError[];
}

/**
 * Split a rendered worksheet into one entry per source line.
 *
 * The engine's debug mode tags every rendered line with `id="line-N"`, N being
 * the 1-based *output* line. For a document with no macros or includes the
 * output lines line up one-to-one with the source, so N is the source line. When
 * they diverge the extra output lines belong to a macro or loop body and are
 * folded back onto the source line that produced them by the caller's own
 * alignment, so only the first match for a given N is kept.
 *
 * Exported for the unit tests; the client's `convertLines` is the caller.
 */
export function splitRenderedLines(html: string, source: string): (string | null)[] {
    const lineCount = source.split('\n').length;
    const lines: (string | null)[] = new Array(lineCount).fill(null);
    if (typeof DOMParser === 'undefined') return lines;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Indexed rather than `for…of`: the shared tsconfig's `lib` omits DOM.Iterable.
    const anchors = doc.querySelectorAll<HTMLElement>(`[id^="${LINE_ANCHOR_PREFIX}"]`);
    for (let i = 0; i < anchors.length; i++) {
        const el = anchors[i];
        const n = Number(el.id.slice(LINE_ANCHOR_PREFIX.length));
        if (!Number.isInteger(n) || n < 1 || n > lineCount) continue;
        if (lines[n - 1] === null) lines[n - 1] = el.innerHTML;
    }
    return lines;
}

/**
 * Aborts when either input does. Hand-rolled instead of `AbortSignal.any()`
 * since that's Node 20+ only and this client's contract is Node 18+.
 */
export function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
    if (a.aborted) return a;
    if (b.aborted) return b;
    const controller = new AbortController();
    a.addEventListener('abort', () => controller.abort(a.reason), { once: true });
    b.addEventListener('abort', () => controller.abort(b.reason), { once: true });
    return controller.signal;
}

/**
 * Base64 helpers for the binary `.cpdz` endpoints. Chunked so a large worksheet
 * doesn't blow the argument limit of String.fromCharCode.
 */
function toBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

function fromBase64(data: string): Uint8Array {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

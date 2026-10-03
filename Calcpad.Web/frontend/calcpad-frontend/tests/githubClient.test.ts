/**
 * The GitHub proxy methods on `CalcpadApiClient`.
 *
 * There is no server in this suite: `fetch` is stubbed and the request each method builds is
 * inspected. That pins the contract the backend routes match on — path, query keys, body shape
 * — and that failures resolve to null like every other endpoint.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalcpadApiClient } from '../src/api/client';

interface CapturedRequest {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
}

let captured: CapturedRequest[] = [];

function stubFetch(responses: Array<{ status?: number; json?: unknown }>): void {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(init?.headers ?? {})) {
            headers[key.toLowerCase()] = String(value);
        }
        captured.push({
            url: String(input),
            method: init?.method ?? 'GET',
            headers,
            body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
        });
        const spec = responses[Math.min(call++, responses.length - 1)];
        const status = spec.status ?? 200;
        return new Response(JSON.stringify(spec.json ?? {}), {
            status,
            headers: { 'Content-Type': 'application/json' },
        });
    }));
}

afterEach(() => {
    vi.unstubAllGlobals();
    captured = [];
});

const client = () => new CalcpadApiClient('http://127.0.0.1:9420');

describe('githubStatus', () => {
    it('GETs /api/github/status and returns the configured flag', async () => {
        stubFetch([{ json: { configured: true } }]);
        const status = await client().githubStatus();
        expect(status).toEqual({ configured: true });
        expect(captured[0].url).toBe('http://127.0.0.1:9420/api/github/status');
        expect(captured[0].method).toBe('GET');
    });
});

describe('githubFile', () => {
    it('sends owner, repo, path and ref as query keys', async () => {
        stubFetch([{ json: { name: 'beam.cpd', path: 'x/beam.cpd', sha: 'abc', size: 5, content: 'a = 1' } }]);
        const file = await client().githubFile('imartincei', 'CalcpadCE', 'x/beam.cpd', 'main');
        expect(file?.content).toBe('a = 1');
        const url = new URL(captured[0].url);
        expect(url.pathname).toBe('/api/github/file');
        expect(url.searchParams.get('owner')).toBe('imartincei');
        expect(url.searchParams.get('repo')).toBe('CalcpadCE');
        expect(url.searchParams.get('path')).toBe('x/beam.cpd');
        expect(url.searchParams.get('ref')).toBe('main');
    });

    it('omits ref when the caller leaves it undefined', async () => {
        stubFetch([{ json: {} }]);
        await client().githubFile('o', 'r', 'p.cpd');
        expect(new URL(captured[0].url).searchParams.has('ref')).toBe(false);
    });
});

describe('githubContents', () => {
    it('GETs /api/github/contents with an empty path for the repository root', async () => {
        stubFetch([{ json: [{ name: 'Examples', path: 'Examples', type: 'dir', size: 0, sha: 'd1' }] }]);
        const entries = await client().githubContents('o', 'r', '');
        expect(entries).toHaveLength(1);
        expect(entries?.[0].type).toBe('dir');
        const url = new URL(captured[0].url);
        expect(url.pathname).toBe('/api/github/contents');
        expect(url.searchParams.get('path')).toBe('');
    });
});

describe('githubIssues', () => {
    it('defaults to open issues', async () => {
        stubFetch([{ json: [{ number: 7, title: 'Bug', state: 'open', htmlUrl: 'u', createdAt: '', updatedAt: '', labels: [] }] }]);
        const issues = await client().githubIssues('o', 'r');
        expect(issues?.[0].number).toBe(7);
        const url = new URL(captured[0].url);
        expect(url.pathname).toBe('/api/github/issues');
        expect(url.searchParams.get('state')).toBe('open');
    });

    it('passes an explicit state through', async () => {
        stubFetch([{ json: [] }]);
        await client().githubIssues('o', 'r', 'closed');
        expect(new URL(captured[0].url).searchParams.get('state')).toBe('closed');
    });
});

describe('githubCommit', () => {
    it('POSTs the commit request body verbatim', async () => {
        stubFetch([{ json: { contentSha: 'c1', commitSha: 'c2', htmlUrl: 'https://github.com/o/r/commit/c2' } }]);
        const request = {
            owner: 'o', repo: 'r', path: 'a/b.cpd', message: 'Update b',
            content: 'x = 2', sha: 'old-sha', branch: 'main',
        };
        const commit = await client().githubCommit(request);
        expect(commit?.commitSha).toBe('c2');
        expect(captured[0].method).toBe('POST');
        expect(captured[0].url).toBe('http://127.0.0.1:9420/api/github/commit');
        expect(captured[0].body).toEqual(request);
    });
});

describe('failure handling', () => {
    it('resolves to null on a non-2xx response, like every other endpoint', async () => {
        stubFetch([{ status: 503, json: { error: 'GITHUB_TOKEN is not set' } }]);
        expect(await client().githubFile('o', 'r', 'p.cpd')).toBeNull();
        expect(await client().githubIssues('o', 'r')).toBeNull();
    });

    it('resolves to null when the server is unreachable', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
        expect(await client().githubStatus()).toBeNull();
    });
});

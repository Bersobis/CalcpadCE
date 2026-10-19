// A themed control must pair its background token with the matching *foreground* token.
//
// The palette buttons set `background: var(--vscode-button-secondaryBackground)` and
// `color: inherit`. `inherit` resolves to the sidebar's `--vscode-foreground`, which in the light
// theme is #616161 on #5f6a79 — a contrast ratio of 1.13:1, so the labels were invisible. The dark
// theme inherited #d4d4d4 on #3a3d41 (7.36:1), so the bug only appeared in light and looked like a
// missing-glyph problem rather than a colour one.
//
// `scripts/check-contrast.mjs` verifies the token *pair*, but it cannot see which token a
// component actually used. This can.

import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const STYLES = join(process.cwd(), 'src', 'vue');

function styleFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) styleFiles(full, out);
        else if (entry.endsWith('.vue') || entry.endsWith('.css')) out.push(full);
    }
    return out;
}

/** Every `selector { declarations }` pair. These stylesheets do not nest. */
function rules(source: string): { selector: string; body: string }[] {
    return Array.from(source.matchAll(/([^{}]*)\{([^{}]*)\}/g), (m) => ({
        selector: m[1].trim(),
        body: m[2],
    }));
}

/** State rules override one property and inherit the rest from their base rule. */
const STATE = /:(hover|focus|focus-visible|focus-within|active|disabled|checked)\b/;

test('a themed button background is paired with its foreground', () => {
    let checked = 0;
    for (const file of styleFiles(STYLES)) {
        for (const rule of rules(readFileSync(file, 'utf8'))) {
            const background = /background:\s*var\((--vscode-button-[\w-]*?)Background/.exec(rule.body);
            if (!background || STATE.test(rule.selector)) continue;
            checked++;
            const token = background[1];
            assert.ok(
                new RegExp(`color:\\s*var\\(${token}Foreground`).test(rule.body),
                `${file}: ${rule.selector} uses ${token}Background without ${token}Foreground — the `
                + 'inherited colour is the sidebar\'s and can be invisible on it',
            );
        }
    }
    assert.ok(checked > 0, 'expected to find themed button rules to check');
});

test('no palette rule falls back to `inherit` for colour', () => {
    for (const file of styleFiles(STYLES)) {
        for (const rule of rules(readFileSync(file, 'utf8'))) {
            if (!/\.cp-math-key|\.cp-math-palette|\.cp-live-palette/.test(rule.selector)) continue;
            assert.ok(
                !/color:\s*inherit/.test(rule.body),
                `${file}: ${rule.selector} must not use \`color: inherit\``,
            );
        }
    }
});

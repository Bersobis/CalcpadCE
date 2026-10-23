// Guards for the template-ref trap that has now cost this feature twice.
//
// 1. `ref="name"` inside `v-for` — Vue collects it into an *array*. The array is truthy, so a
//    `if (ref.value)` guard passes, and the call site then throws "is not a function". That is
//    what made every palette button silently dead in the previous attempt.
// 2. `:ref="(x) => …"` — an inline arrow is a *new function* on every render, and Vue unsets a
//    changed ref before setting it. The unset calls the callback with `null`, which unregisters
//    the field on every re-render and leaves the shared toolbar pointing at nothing.
//
// Both are invisible to the type checker, so they are checked here instead.

import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const COMPONENTS = join(process.cwd(), 'src', 'vue', 'components');

function vueFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) vueFiles(full, out);
        else if (entry.endsWith('.vue')) out.push(full);
    }
    return out;
}

/** Every opening tag in a template, as raw text. */
function tagsOf(source: string): string[] {
    return source.match(/<[A-Za-z][^>]*>/g) ?? [];
}

test('no string ref is bound inside a v-for', () => {
    for (const file of vueFiles(COMPONENTS)) {
        for (const tag of tagsOf(readFileSync(file, 'utf8'))) {
            const hasLoop = /\bv-for\s*=/.test(tag);
            const stringRef = /(^|\s)ref\s*=\s*"/.test(tag);
            assert.ok(
                !(hasLoop && stringRef),
                `${file}: a string ref inside v-for is collected into an array — use a stable function ref`,
            );
        }
    }
});

test('no ref callback is written inline', () => {
    for (const file of vueFiles(COMPONENTS)) {
        const source = readFileSync(file, 'utf8');
        // `:ref="(x) => …"` or `:ref="x => …"`, i.e. an arrow bound directly in the template.
        const inlineArrow = /:ref\s*=\s*"\s*\(?[A-Za-z_$][\w$]*\)?\s*=>/;
        assert.ok(
            !inlineArrow.test(source),
            `${file}: an inline arrow ref is recreated every render — return a stable callback instead`,
        );
    }
});

test('every function ref used in a loop is memoised', () => {
    // The rule that matters: if the template calls `fieldRef(line)`, that helper must return the
    // same function for the same line. This asserts the shape rather than the behaviour, because
    // the behaviour needs a browser.
    const panel = readFileSync(join(COMPONENTS, 'CalcpadLiveMath.vue'), 'utf8');
    assert.ok(/:ref="fieldRef\(/.test(panel), 'the panel should bind its field refs through fieldRef()');
    assert.ok(
        /function fieldRef\([\s\S]*?fieldRefs\.get\([\s\S]*?fieldRefs\.set\(/.test(panel),
        'fieldRef must memoise the callback per line',
    );
});

test('live math equations are editable by clicking without a mode toggle', () => {
    const panel = readFileSync(join(COMPONENTS, 'CalcpadLiveMath.vue'), 'utf8');
    assert.doesNotMatch(panel, /Click to edit|clickToEdit/);
    assert.doesNotMatch(panel, /:click-to-edit=|:active=/);
});

import { describe, it, expect } from 'vitest';
import { baseParse, compile } from '@vue/compiler-dom';
import { parse as parseSfc } from '@vue/compiler-sfc';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { singleTemplateRef } from '../src/vue/template-ref';

describe('singleTemplateRef', () => {
    it('unwraps the array Vue gives a ref inside v-for', () => {
        const instance = { applyPalette: () => 'ok' };
        expect(singleTemplateRef(instance)).toBe(instance);
        expect(singleTemplateRef([instance])).toBe(instance);
    });

    it('reports nothing when the ref holds nothing', () => {
        expect(singleTemplateRef(null)).toBeNull();
        expect(singleTemplateRef(undefined)).toBeNull();
        expect(singleTemplateRef([])).toBeNull();
    });

    it('reads the shape the compiler actually produces for a ref in v-for', () => {
        // The premise the fix rests on, taken from the compiler rather than
        // assumed: a ref inside `v-for` is marked `ref_for`, and the runtime
        // collects it into an array — so the call site sees `[instance]`, which is
        // truthy and has none of the component's methods.
        const inFor = compile('<div v-for="i in 3" :key="i"><Child ref="probe" /></div>', { mode: 'module' });
        expect(inFor.code).toContain('ref_for: true');

        const outside = compile('<Child ref="probe" />', { mode: 'module' });
        expect(outside.code).not.toContain('ref_for');
    });
});

// ---- the guard ---------------------------------------------------------------

interface Offender {
    file: string;
    tag: string;
}

/** Every `.vue` file under `dir`, so the guard covers the whole workspace. */
function vueFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) vueFiles(full, out);
        else if (entry.endsWith('.vue')) out.push(full);
    }
    return out;
}

/**
 * Static `ref` bindings that sit inside a `v-for`.
 *
 * This is the bug that made every palette button do nothing in the graphical
 * editor. The ref read as a single instance in the source and in the types — a
 * `ref<T>` is declared `T | null` whatever Vue assigns — but was an array at
 * runtime, and the failure only appeared on a click. `vue-tsc` cannot see it, so
 * it is checked here: such a ref must be bound as a function (`:ref="setX"`) or
 * read through `singleTemplateRef`.
 */
function stringRefsInVFor(template: string, file: string): Offender[] {
    const found: Offender[] = [];
    let ast: unknown;
    try {
        ast = compile(template, { mode: 'module', onError: () => {} });
    } catch {
        return found;
    }
    // The compiled output is the only place the compiler records `ref_for`, so
    // read the marker straight out of it rather than re-deriving the rule.
    if (!/\bref_for: true/.test((ast as { code: string }).code)) return found;

    const walk = (node: any, inFor: boolean): void => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 1 /* ELEMENT */) {
            const props: any[] = node.props ?? [];
            const isFor = inFor || props.some(p => p.type === 7 && p.name === 'for');
            if (isFor) {
                for (const prop of props) {
                    // type 6 is a plain attribute; a bound `:ref` is a directive.
                    if (prop.type === 6 && prop.name === 'ref') found.push({ file, tag: node.tag });
                }
            }
            for (const child of node.children ?? []) walk(child, isFor);
            return;
        }
        for (const child of node.children ?? []) walk(child, inFor);
    };

    try {
        walk(baseParse(template), false);
    } catch {
        // A template the parser rejects cannot hold the shape this guards against.
    }
    return found;
}

describe('template refs', () => {
    it('catches a static ref inside v-for', () => {
        // The guard is only worth having if it fails on the shape that broke.
        const offenders = stringRefsInVFor(
            '<div v-for="row in rows" :key="row"><Surface ref="surface" /></div>',
            'probe.vue',
        );
        expect(offenders).toEqual([{ file: 'probe.vue', tag: 'Surface' }]);
    });

    it('accepts a function ref and a ref outside v-for', () => {
        expect(stringRefsInVFor('<div v-for="r in rows" :key="r"><Surface :ref="setSurface" /></div>', 'p.vue'))
            .toEqual([]);
        expect(stringRefsInVFor('<Surface ref="surface" />', 'p.vue')).toEqual([]);
    });

    it('finds none in the workspace', () => {
        const root = resolve(__dirname, '../..');
        const files = [
            ...vueFiles(join(root, 'calcpad-web/src')),
            ...vueFiles(join(root, 'calcpad-frontend/src')),
        ];
        expect(files.length).toBeGreaterThan(0);

        const offenders: Offender[] = [];
        let checked = 0;
        for (const file of files) {
            // The SFC parser, not a regex: a template that a regex mangles would
            // silently drop out of the guard.
            const { descriptor } = parseSfc(readFileSync(file, 'utf8'), { filename: file });
            const template = descriptor.template?.content;
            if (!template) continue;
            checked++;
            offenders.push(...stringRefsInVFor(template, file.slice(root.length + 1)));
        }
        expect(checked).toBeGreaterThan(0);
        expect(offenders).toEqual([]);
    });
});

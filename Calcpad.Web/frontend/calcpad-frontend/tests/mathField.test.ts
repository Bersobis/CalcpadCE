/**
 * Structural checks on `CalcpadMathField.vue`.
 *
 * There is no DOM in this suite, so the real SFC is compiled and its template inspected.
 * That pins the failure this file was written for: `<math-field>` must live *inside* the
 * element `field()` queries, or every call returns null and the component is inert.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import { baseParse } from '@vue/compiler-dom';
import type { ElementNode, Node } from '@vue/compiler-core';
import { createSSRApp, defineComponent, h, ref } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { calcpadToAst } from '../src/math/calcpad';
import { astToLatex, latexToCalcpad } from '../src/math/latex';
import { matrixOpDisabled } from '../src/math/mathFieldTools';
import { INSERT_TEMPLATES, insertGroups } from '../src/math/insertTemplates';

const file = fileURLToPath(new URL('../src/vue/components/CalcpadMathField.vue', import.meta.url));
const source = readFileSync(file, 'utf8');

/** Depth-first walk with the enclosing elements, since the parser sets no `parent`. */
function walk(node: Node, visit: (n: Node, ancestors: ElementNode[]) => void, ancestors: ElementNode[] = []): void {
    visit(node, ancestors);
    const next = node.type === 1 ? [...ancestors, node as ElementNode] : ancestors;
    for (const child of (node.children ?? [])) walk(child, visit, next);
}

function classOf(el: ElementNode): string {
    for (const prop of el.props) {
        if (prop.type === 6 && prop.name === 'class') {
            return prop.value.type === 2 ? prop.value.content : '';
        }
    }
    return '';
}

describe('CalcpadMathField.vue compiles', () => {
    it('parses as a single-file component', () => {
        const { descriptor, errors } = parse(source, { filename: file });
        expect(errors).toEqual([]);
        expect(descriptor.template).toBeDefined();
        expect(descriptor.scriptSetup).toBeDefined();
    });

    it('compiles the template without errors', () => {
        const { descriptor } = parse(source, { filename: file });
        const result = compileTemplate({
            id: 'calcpad-math-field',
            filename: file,
            source: descriptor.template!.content,
        });
        expect(result.errors).toEqual([]);
    });

    it('binds a model value and reports commits', () => {
        const { descriptor } = parse(source, { filename: file });
        const script = compileScript(descriptor, { id: 'calcpad-math-field' });
        expect(script.content).toContain('update:modelValue');
        expect(script.content).toContain('commit');
    });

    it('resolves every relative import from where the file actually lives', () => {
        // The component moved into src/vue/components/ without its specifiers following;
        // compiled alone they still look plausible, so only resolving them catches it.
        const { descriptor } = parse(source, { filename: file });
        const script = compileScript(descriptor, { id: 'calcpad-math-field' });
        const dir = dirname(file);
        const specs = [...script.content.matchAll(/from\s+['"]([^'"]+)['"]/g)]
            .map((m) => m[1])
            .filter((spec) => spec.startsWith('.'));
        expect(specs.length).toBeGreaterThan(0);
        for (const spec of specs) {
            const target = resolve(dir, spec);
            const candidates = [target, `${target}.ts`, `${target}.js`, `${target}.vue`, join(target, 'index.ts')];
            expect(candidates.some(existsSync), `${spec} does not resolve`).toBe(true);
        }
    });
});

describe('the field sits where the script looks for it', () => {
    it('nests <math-field> inside the element carrying the host ref', () => {
        const { descriptor } = parse(source, { filename: file });
        const ast = baseParse(descriptor.template!.content) as unknown as Node;

        let hostIsAncestor = false;
        let seen = 0;
        walk(ast, (n, ancestors) => {
            if (n.type !== 1 || (n as ElementNode).tag !== 'math-field') return;
            seen++;
            // `field()` is `host.querySelector('math-field')`, so the host must enclose it.
            if (ancestors.some((a) => classOf(a).includes('calcpad-math__host'))) hostIsAncestor = true;
        });
        expect(seen, 'no <math-field> in the template').toBe(1);
        expect(hostIsAncestor, '<math-field> is outside the host ref').toBe(true);
    });

    it('keeps the field mounted in read mode instead of hiding it', () => {
        const { descriptor } = parse(source, { filename: file });
        const ast = baseParse(descriptor.template!.content) as unknown as Node;

        let bound: string[] = [];
        walk(ast, (n) => {
            if (n.type !== 1 || (n as ElementNode).tag !== 'math-field') return;
            bound = (n as ElementNode).props
                .filter((p) => p.type === 7)
                .map((d) => {
                    const arg = (d as { arg?: { content?: string } }).arg;
                    return arg?.content ?? '';
                });
        });
        // A `v-show` would hide the typeset expression; only `readonly` changes per state.
        expect(bound).toContain('readonly');
        expect(bound).not.toContain('show');
    });
});

/**
 * A stand-in for the real template. It reproduces the structure the SSR render below is
 * asserted against without needing MathLive to have registered its custom element, which
 * it cannot do outside a browser.
 */
const Stand = defineComponent({
    props: { editing: { type: Boolean, required: true }, readonly: { type: Boolean, required: true } },
    setup(props) {
        const latex = ref('');
        return () => h('span', { class: 'calcpad-math' }, [
            h('span', { class: 'calcpad-math__host' }, [
                h('math-field', {
                    class: 'calcpad-math__field',
                    readonly: props.readonly || !props.editing ? '' : undefined,
                }),
            ]),
            props.editing ? null : h('code', { class: 'calcpad-math__latex' }, latex.value),
        ]);
    },
});

describe('rendered markup', () => {
    it('shows the field typeset and readonly when not editing', async () => {
        const html = await renderToString(createSSRApp(Stand, { editing: false, readonly: false }));
        expect(html).toContain('<math-field');
        expect(html).toContain('readonly');
        expect(html).toContain('calcpad-math__host');
    });

    it('drops readonly once editing starts', async () => {
        const html = await renderToString(createSSRApp(Stand, { editing: true, readonly: false }));
        expect(html).toContain('<math-field');
        expect(html).not.toContain('readonly');
    });

    it('stays readonly when the host is readonly', async () => {
        const html = await renderToString(createSSRApp(Stand, { editing: true, readonly: true }));
        expect(html).toContain('readonly');
    });
});

describe('the conversions the component performs', () => {
    it('typesets the Calcpad it is given', () => {
        // The space is the implicit multiplication MathLive needs between `0.01` and `m`.
        expect(astToLatex(calcpadToAst('A = 0.01m^2'))).toBe('A=0.01 \\text{m}^{2}');
    });

    it('reads an edited field back as Calcpad', () => {
        // What MathLive hands over on blur after the user types `x^2`.
        expect(latexToCalcpad('x^{2}')).toBe('x^2');
    });
});

const fieldFile = fileURLToPath(new URL('../src/vue/components/CalcpadMathField.vue', import.meta.url));
const fieldSource = readFileSync(fieldFile, 'utf8');

const toolsFile = fileURLToPath(new URL('../src/math/mathFieldTools.ts', import.meta.url));
const toolsSource = readFileSync(toolsFile, 'utf8');

const toolbarFile = fileURLToPath(new URL('../src/vue/components/CalcpadMathToolbar.vue', import.meta.url));
const toolbarSource = readFileSync(toolbarFile, 'utf8');

const liveFile = fileURLToPath(new URL('../src/vue/components/CalcpadLiveEditor.vue', import.meta.url));
const liveSource = readFileSync(liveFile, 'utf8');

const tabFile = fileURLToPath(new URL('../src/vue/components/CalcpadEquationTab.vue', import.meta.url));
const tabSource = readFileSync(tabFile, 'utf8');

describe('the matrix controls', () => {
    it('offers a plus and a minus for rows and for columns', () => {
        for (const label of ['+Row', '−Row', '+Col', '−Col']) {
            expect(toolsSource, label).toContain(label);
        }
    });

    it('disables a removal that would leave an empty matrix', () => {
        expect(toolsSource).toContain('size.rows <= 1');
        expect(toolsSource).toContain('size.cols <= 1');
        // And the toolbar is what applies it, rather than each field deciding for itself.
        expect(toolbarSource).toContain('matrixOpDisabled(b.op, size)');
    });
});

describe('CalcpadMathField hands its operations to the toolbar', () => {
    it('resizes through applyMatrixOp and the normal commit path', () => {
        expect(fieldSource).toContain('applyMatrixOp');
        // A resize is a write like any other: it emits commit, so the host rewrites the line.
        expect(fieldSource).toMatch(/reshape[\s\S]*emit\('commit', next\)/);
    });

    it('dispatches undo and redo to MathLive, which owns the history', () => {
        expect(fieldSource).toContain('executeCommand');
        expect(fieldSource).toMatch(/command[\s\S]*executeCommand\(name\)/);
    });

    it('refuses to commit an unfilled template', () => {
        // `sqrt(\placeholder{})` reads back as `sqrt(())`, which the engine rejects with
        // `Invalid syntax: "( )"`. Committing it would replace a good line with a broken one.
        expect(fieldSource).toContain('hasEmptyPlaceholder(el.value)');
    });

    it('does not offer a handle on a read-only field', () => {
        expect(fieldSource).toContain('const isTarget = computed(() => !props.readonly && editing.value)');
    });

    it('keeps the size a getter, so a resize updates the toolbar without a remount', () => {
        expect(fieldSource).toMatch(/get size\(\)[\s\S]*return size\.value/);
    });

    it('publishes the handle while it is editing and withdraws it on the way out', () => {
        expect(fieldSource).toMatch(/watch\(isTarget, \(on\) => emit\('active', handle, on\)\)/);
    });

    it('withdraws its handle when the region list replaces it', () => {
        // A region can be re-keyed, destroying this field while the toolbar still holds it.
        // Left pointing at a detached element, every button would silently do nothing.
        expect(fieldSource).toMatch(/onBeforeUnmount\(\(\) => \{[\s\S]*if \(isTarget\.value\) emit\('active', handle, false\);/);
    });

    it('reports an unfilled template as a hint, not as a failure', () => {
        // Nothing has gone wrong: the template is waiting for a value. Reporting it through
        // `invalid` made a neutral step read as "Nothing written — <error>".
        expect(fieldSource).toMatch(/emit\('hint', 'Inserted/);
        expect(fieldSource).not.toMatch(/emit\('invalid', props\.modelValue/);
    });

    it('identifies itself when withdrawing, so a stale release cannot cancel the toolbar', () => {
        // Watchers run in component-creation order: moving the caret from line 1 to line 2
        // fires line 1's release *after* line 2's claim. A bare null there would wipe the
        // toolbar the user is now looking at.
        expect(fieldSource).toContain("active: [handle: MathFieldHandle, active: boolean]");
        for (const host of [liveSource, tabSource]) {
            expect(host).toMatch(/if \(active\) handle\.value = next\n\s*else if \(handle\.value === next\) handle\.value = null/);
        }
    });

    it('holds the handle shallowly, so the identity check can succeed', () => {
        // The regression this pins: a plain `ref` wraps an object in a reactive Proxy, so
        // `handle.value === next` compared a Proxy against the field's own handle, never
        // matched, and the toolbar stayed up after the field stopped being edited.
        for (const host of [liveSource, tabSource]) {
            expect(host).toContain('shallowRef<MathFieldHandle | null>(null)');
            expect(host).not.toMatch(/ref<MathFieldHandle \| null>\(null\)/);
        }
    });
});

describe('the toolbar is docked once, not per line', () => {
    it('compiles as a component of its own', () => {
        const { descriptor, errors } = parse(toolbarSource, { filename: toolbarFile });
        expect(errors).toEqual([]);
        const result = compileTemplate({
            id: 'calcpad-math-toolbar',
            filename: toolbarFile,
            source: descriptor.template!.content,
        });
        expect(result.errors).toEqual([]);
    });

    it('renders no button at all until a field claims it', () => {
        // The whole reason it is docked: the canvas must stay quiet while it is read.
        expect(toolbarSource).toContain('handle: MathFieldHandle | null');
        for (const host of [fieldSource, toolbarSource]) {
            expect(host).not.toContain('calcpad-math__tbtn');
            expect(host).not.toContain('calcpad-math__mbtn');
        }
    });

    it('mounts once in the canvas and once in the single-line view, not inside a field', () => {
        for (const host of [liveSource, tabSource]) {
            expect(host).toContain('CalcpadMathToolbar');
            expect(host).not.toContain('INSERT_TEMPLATES');
        }
        // One mount each, outside the `v-for` over regions.
        expect(liveSource.match(/<CalcpadMathToolbar/g)).toHaveLength(1);
        expect(tabSource.match(/<CalcpadMathToolbar/g)).toHaveLength(1);
    });

    it('keeps the palette collapsed until it is asked for', () => {
        expect(toolbarSource).toContain('const paletteOpen = ref(false)');
        expect(toolbarSource).toContain('v-show="paletteOpen"');
    });

    it('gives every control a real button, not a role=button span nested in one', () => {
        // Undo/redo used to live inside the header <button> as role=button spans: nested
        // interactive content, unreachable in the tab order the way a button should be.
        expect(toolbarSource).not.toContain('role="button"');
        const { descriptor } = parse(toolbarSource, { filename: toolbarFile });
        const ast = baseParse(descriptor.template!.content) as unknown as Node;

        let nested = 0;
        walk(ast, (n, ancestors) => {
            if (n.type !== 1 || ancestors.length === 0) return;
            const tag = (n as ElementNode).tag;
            if (tag !== 'button' && tag !== 'input') return;
            if (ancestors.some((a) => a.tag === 'button')) nested++;
        });
        expect(nested, 'a button nested inside another button').toBe(0);
    });

    it('takes the templates from the shared list, so the palette cannot drift', () => {
        // Group headings are derived, never spelled out: a new template has to appear
        // in the palette by being added to the list, not by being listed here as well.
        expect(toolbarSource).toContain('INSERT_TEMPLATES');
        expect(toolbarSource).not.toMatch(/'Roots and powers'|'Common functions'/);
        // And every group the list declares is one the toolbar can render.
        expect(insertGroups().length).toBeGreaterThan(1);
        expect(new Set(INSERT_TEMPLATES.map((t) => t.group))).toEqual(new Set(insertGroups()));
    });
});

describe('CalcpadMathField still resolves its imports', () => {
    it('resolves every relative specifier from where the components live', () => {
        for (const sfc of [fieldFile, toolbarFile]) {
            const { descriptor } = parse(readFileSync(sfc, 'utf8'), { filename: sfc });
            const script = compileScript(descriptor, { id: sfc });
            const dir = dirname(sfc);
            for (const spec of [...script.content.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1])) {
                const target = resolve(dir, spec);
                const candidates = [target, `${target}.ts`, `${target}.vue`, join(target, 'index.ts')];
                expect(candidates.some(existsSync), `${spec} does not resolve from ${sfc}`).toBe(true);
            }
        }
    });
});

describe('matrixOpDisabled', () => {
    it('disables only the removals that would empty the matrix', () => {
        expect(matrixOpDisabled('removeRow', { rows: 1, cols: 3 })).toBe(true);
        expect(matrixOpDisabled('removeCol', { rows: 3, cols: 1 })).toBe(true);
        expect(matrixOpDisabled('addRow', { rows: 1, cols: 1 })).toBe(false);
        expect(matrixOpDisabled('removeRow', { rows: 2, cols: 3 })).toBe(false);
        expect(matrixOpDisabled('removeCol', { rows: 3, cols: 2 })).toBe(false);
    });
});

/**
 * Structural checks on `CalcpadMathField.vue`.
 *
 * There is no DOM in this suite, so the real SFC is compiled and its template inspected.
 * That pins the failure this file was written for: `<math-field>` must live *inside* the
 * element `field()` queries, or every call returns null and the component is inert.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import { baseParse } from '@vue/compiler-dom';
import type { ElementNode, Node } from '@vue/compiler-core';
import { createSSRApp, defineComponent, h, ref } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { calcpadToAst } from '../src/math/calcpad';
import { astToLatex, latexToCalcpad } from '../src/math/latex';

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
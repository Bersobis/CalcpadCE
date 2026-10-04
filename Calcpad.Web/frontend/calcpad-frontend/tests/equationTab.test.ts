/**
 * Structural checks on `CalcpadEquationTab.vue` plus the gate that decides which lines
 * it may edit. No DOM here, so the SFC is compiled rather than mounted; the
 * classification tests are what stops an unreproducible line being rewritten.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import { classifyLineEdit } from '../src/math/roundTrip';

const file = fileURLToPath(new URL('../src/vue/components/CalcpadEquationTab.vue', import.meta.url));
const source = readFileSync(file, 'utf8');
const liveFile = fileURLToPath(new URL('../src/vue/components/CalcpadLiveEditor.vue', import.meta.url));
const liveSource = readFileSync(liveFile, 'utf8');

describe('CalcpadEquationTab.vue compiles', () => {
    it('parses as a single-file component', () => {
        const { descriptor, errors } = parse(source, { filename: file });
        expect(errors).toEqual([]);
        expect(descriptor.template).toBeDefined();
        expect(descriptor.scriptSetup).toBeDefined();
    });

    it('compiles the template without errors', () => {
        const { descriptor } = parse(source, { filename: file });
        const result = compileTemplate({
            id: 'calcpad-equation-tab',
            filename: file,
            source: descriptor.template!.content,
        });
        expect(result.errors).toEqual([]);
    });

    it('renders the field, shows the source, and asks the host to apply a commit', () => {
        const { descriptor } = parse(source, { filename: file });
        const script = compileScript(descriptor, { id: 'calcpad-equation-tab' });
        expect(script.content).toContain('CalcpadMathField');
        expect(script.content).toContain("emit('apply'");
        expect(script.content).toContain('classifyLineEdit');
        expect(descriptor.template!.content).toContain('equation-source');
    });

    it('resolves every relative import from where the file actually lives', () => {
        const { descriptor } = parse(source, { filename: file });
        const script = compileScript(descriptor, { id: 'calcpad-equation-tab' });
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

describe('classifyLineEdit decides what the canvas may edit', () => {
    it('treats a blank line as nothing to show', () => {
        expect(classifyLineEdit('')).toBe('blank');
        expect(classifyLineEdit('   ')).toBe('blank');
    });

    it('keeps comments, labels and directives out of the field', () => {
        expect(classifyLineEdit("'a comment")).toBe('notMath');
        expect(classifyLineEdit('"A title"')).toBe('notMath');
        expect(classifyLineEdit('#deg')).toBe('notMath');
        expect(classifyLineEdit('$Plot{ x }')).toBe('notMath');
    });

    it('edits the equations real documents are made of', () => {
        expect(classifyLineEdit('x = 5')).toBe('equation');
        expect(classifyLineEdit('A = 0.01m^2')).toBe('equation');
        expect(classifyLineEdit('sqrt(x) = 4')).toBe('equation');
        // A value with a description: the quoted literal survives the round-trip.
        expect(classifyLineEdit("1' - horizontal radius")).toBe('equation');
    });

    it('edits matrix literals, which used to be misread as unit targets', () => {
        expect(classifyLineEdit('M_TEST=[3;4;5|5;6;7]')).toBe('equation');
        expect(classifyLineEdit('M=[1; 2 | 3; 4]')).toBe('equation');
        expect(classifyLineEdit('V=[1;2;3]')).toBe('equation');
    });

    it('refuses lines whose round-trip would rewrite them', () => {
        // The comma-separated subscript: `,` is both a subscript character and the
        // statement separator, and telling them apart needs the left operand's value.
        expect(classifyLineEdit('B_1,1.(3; j) = B_3(j; 1; 1)')).toBe('lossy');
        // The unit target: `|` outside brackets attaches units to the whole left side.
        expect(classifyLineEdit('c = b - a|μm:N1')).toBe('lossy');
        expect(classifyLineEdit('cbrt(x)')).toBe('lossy');
    });
});

describe('CalcpadLiveEditor.vue compiles and keeps the per-line gate', () => {
    it('parses and compiles as a single-file component', () => {
        const { descriptor, errors } = parse(liveSource, { filename: liveFile });
        expect(errors).toEqual([]);
        const result = compileTemplate({
            id: 'calcpad-live-editor',
            filename: liveFile,
            source: descriptor.template!.content,
        });
        expect(result.errors).toEqual([]);
    });

    it('gates every region through classifyLineEdit and writes back per line', () => {
        expect(liveSource).toContain('classifyLineEdit');
        // A region only becomes a field when its line classified as `equation`, so a
        // lossy line renders as source and is never rewritten.
        expect(liveSource).toMatch(/kind === 'equation'/);
        expect(liveSource).toContain("emit('apply', line, next)");
    });

    it('resolves every relative import from where the file actually lives', () => {
        const { descriptor } = parse(liveSource, { filename: liveFile });
        const script = compileScript(descriptor, { id: 'calcpad-live-editor' });
        const dir = dirname(liveFile);
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

describe('the bridge serves the document to the live canvas', () => {
    const bridge = readFileSync(
        fileURLToPath(new URL('../src/services/message-bridge/base.ts', import.meta.url)), 'utf8');

    it('answers getLiveContext and tracks whether the canvas is on screen', () => {
        expect(bridge).toContain("case 'getLiveContext'");
        expect(bridge).toContain("case 'setLiveEditor'");
        expect(bridge).toContain("postToVue({ type: 'liveContext'");
    });

    it('refreshes the canvas after a visual edit is written', () => {
        // The write is confirmed by the echo, which is also what refreshes the canvas.
        expect(bridge).toContain('refreshLiveContext(lineNumber - 1)');
    });
});

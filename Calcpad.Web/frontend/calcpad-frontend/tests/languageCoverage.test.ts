/**
 * Language coverage, pinned as a test.
 *
 * The construct list is transcribed from `docs/quick-reference.md` rather than from the
 * parser, so a construct the parser happens to accept does not silently count as support.
 * This audit found eight real bugs -- `!`, `\`, `⦼`, `÷`, `←`, `∠`, a Unicode subscript
 * digit and a trailing `_` -- every one of which passed the cheaper printer round trip and
 * only failed on the commit path. Keeping the taxonomy here means the next one is caught by
 * `npm test` rather than by re-deriving it.
 *
 * `EDIT` lines are typeset and editable. Everything else is *deliberately* source-only:
 * a directive, a `$Plot{...}` macro or a comment is not an equation, and the canvas shows
 * it verbatim so it can never be rewritten.
 */

import { describe, expect, it } from 'vitest';
import { isEquationLine, splitWorksheet } from '../src/math/calcpad';
import { classifyLineEdit } from '../src/math/roundTrip';

/** One representative line per construct, from the language reference. */
const CONSTRUCTS: [name: string, line: string, editable: boolean][] = [
    // Literals and names
    ['real number', 'a = 3.14', true],
    ['vector literal', 'v = [1; 2; 3]', true],
    ['matrix literal', 'M = [1; 2 | 3; 4]', true],
    ['unicode variable', 'σ_max = σ_N', true],
    ['prime variable', 'M′ = 3', true],
    ['degree superscript', 'x⁗ = 2', true],
    ['subscript', 'x_1 = 5', true],
    ['unicode subscript', 'x₁ = 5', true],
    ['trailing underscore name', 'V_Rd_c_ = 5', true],
    ['custom function', 'f(x; y) = x^2 + y^2', true],
    // Operators with no TeX spelling -- carried as `\text{...}`
    ['factorial', 'n = 5!', true],
    ['integer division', 'q = 7\\2', true],
    ['modulo', 'r = 7⦼2', true],
    ['inline division', 'q = 7÷2', true],
    ['outer assignment', 'a ← 5', true],
    ['phasor', 'z = 3∠45°', true],
    ['units target', 'σ = 5|MPa', true],
    // Calls
    ['conditional', 'b = if(x > 0; 1; -1)', true],
    ['switch', 'b = switch(x; 1; y; 2; 0)', true],
    ['hp matrix', 'A = hp([1; 2 | 3; 4])', true],
    ['determinant', 'd = det([1; 2 | 3; 4])', true],
    ['eigenvalues', 'L = eigenvals(A; 3)', true],

    // Not equations: shown as source so they can never be rewritten.
    ['double-quote comment', '"a title"', false],
    ['single-quote comment', "'a note", false],
    ['html passthrough', '<b>bold</b>', false],
    ['svg drawing', '<tspan fill="red">x</tspan>', false],
    ['plot', '$Plot{ f(x) @ x = 0 : 10 }', false],
    ['parametric plot', '$Plot{ x(t) | y(t) @ t = 0 : 6.28 }', false],
    ['color map', '$Map{ f(x; y) @ x = 0 : 1 & y = 0 : 1 }', false],
    ['root find', '$Root{ f(x) @ x = 0 : 10 }', false],
    ['integral', '$Integral{ f(x) @ x = 0 : 10 }', false],
    ['iterative sum', '$Sum{ f(k) @ k = 1 : 10 }', false],
    ['repeat block', '$Repeat{ f(k) @ k = 1 : 10 }', false],
    ['while block', '$While{ k < 10; k++ }', false],
    ['multiline block', '$Block{ a; b }', false],
    ['inline block', '$Inline{ a; b }', false],
    ['#if', '#if I_y ≡ I_1', false],
    ['#else', '#else', false],
    ['#else if', '#else if x > 0', false],
    ['#end if', '#end if', false],
    ['#repeat', '#repeat 10', false],
    ['#for', '#for i = 1 : n', false],
    ['#loop', '#loop', false],
    ['#while', '#while k < 10', false],
    ['#break', '#break', false],
    ['#continue', '#continue', false],
    ['#include', '#include module.cpd', false],
    ['#local', '#local', false],
    ['#global', '#global', false],
    ['macro definition', '#def m$(a$; b$) = a*b', false],
    ['multiline macro body', '#def name$', false],
    ['#end def', '#end def', false],
    ['#const readonly', '#const g = 9.81', false],
    ['#pause', '#pause', false],
    ['#input', '#input', false],
    ['#read csv', "#read M from data.txt@R1C1:R2C2 TYPE=R SEP=','", false],
    ['#read base64', '#read M from data:text/csv;base64,MSwzCjIsNAo=', false],
    ['#write', '#write M to data.txt@R1C1:R2C2 TYPE=N', false],
    ['#append', '#append M to data.txt@R1C1:R2C2', false],
    ['#hide', '#hide', false],
    ['#show', '#show', false],
    ['#pre', '#pre', false],
    ['#post', '#post', false],
    ['#val', '#val', false],
    ['#equ', '#equ', false],
    ['#noc', '#noc', false],
    ['#nosub', '#nosub', false],
    ['#novar', '#novar', false],
    ['#varsub', '#varsub', false],
    ['#round n', '#round 3', false],
    ['#round default', '#round default', false],
    ['#format', '#format FFFF', false],
    ['#format default', '#format default', false],
    ['#md on', '#md on', false],
    ['#phasor', '#phasor', false],
    ['#complex', '#complex', false],
    ['#deg', '#deg', false],
    ['#rad', '#rad', false],
    ['#gra', '#gra', false],
];

describe('every documented construct is accounted for', () => {
    it('is not edited by accident when it is not an equation', () => {
        for (const [name, line, editable] of CONSTRUCTS) {
            if (editable) continue;
            expect(`${name}:${classifyLineEdit(line)}`).toBe(`${name}:notMath`);
        }
    });

    it('is offered for editing exactly where the taxonomy says it should be', () => {
        for (const [name, line, editable] of CONSTRUCTS) {
            if (!editable) continue;
            expect(`${name}:${classifyLineEdit(line)}`).toBe(`${name}:equation`);
        }
    });

    it('splits every construct out of the worksheet or into it correctly', () => {
        for (const [name, line, editable] of CONSTRUCTS) {
            const { equations, other } = splitWorksheet(line);
            const shown = editable ? equations.map((e) => e.text) : other;
            expect(`${name}:${shown.length === 1}`).toBe(`${name}:true`);
        }
    });

    it('agrees with isEquationLine about what counts as maths', () => {
        for (const [name, line, editable] of CONSTRUCTS) {
            expect(`${name}:${isEquationLine(line)}`).toBe(`${name}:${editable}`);
        }
    });
});

describe('the coverage this test pins', () => {
    it('covers the constructs the reference lists', () => {
        // Guards against the taxonomy quietly shrinking.
        expect(CONSTRUCTS.length).toBeGreaterThanOrEqual(70);
    });

    it('documents how many constructs are typeset', () => {
        const editable = CONSTRUCTS.filter(([, , e]) => e).length;
        expect(editable).toBeGreaterThanOrEqual(20);
    });
});
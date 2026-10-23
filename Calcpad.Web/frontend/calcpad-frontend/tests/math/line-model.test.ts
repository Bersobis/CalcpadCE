// Document model — line classification and region grouping.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { LineModel, classifyLine, isEquationLine, lineRegions, splitWorksheet } from '../../src/math/line-model';

test('lines are classified by what they are, not by what they contain', () => {
    assert.equal(classifyLine('x = 5').kind, 'equation');
    assert.equal(classifyLine('a = 0.01m^2').kind, 'equation');
    assert.equal(classifyLine('#hide').kind, 'directive');
    assert.equal(classifyLine('#for i = 1 : 10').kind, 'directive');
    assert.equal(classifyLine('"Section 1"').kind, 'comment');
    assert.equal(classifyLine("'a comment").kind, 'comment');
    assert.equal(classifyLine('$Plot{ x @ x = 1 : 2 }').kind, 'solver');
    assert.equal(classifyLine('<b>bold</b>').kind, 'markup');
    assert.equal(classifyLine('   ').kind, 'blank');
});

test('an equation line carries its parsed tree', () => {
    const line = classifyLine('a = 0.01m^2');
    assert.equal(line.kind, 'equation');
    assert.ok(line.node);
    assert.equal(line.node!.name, 'mrow');
});

test('a line the bridge cannot carry is source, not a field', () => {
    // The comma-separated subscript needs the value of the left operand to disambiguate.
    assert.equal(classifyLine('x = 5').kind, 'equation');
    assert.equal(classifyLine('').kind, 'blank');
    assert.equal(isEquationLine('x = 5'), true);
    assert.equal(isEquationLine('#format F2'), false);
});

test('the worksheet splits on every line ending', () => {
    assert.equal(splitWorksheet('a = 1\r\nb = 2\nc = 3').length, 3);
});

test('consecutive non-equation lines collapse into one block', () => {
    const document = ['"Title"', 'x = 5', '', "'note", '#hide'].join('\n');
    const regions = lineRegions(document);
    assert.equal(regions.length, 3);
    assert.equal(regions[0].kind, 'block');
    assert.equal(regions[0].startLine, 0);
    assert.equal(regions[0].endLine, 0);
    assert.equal(regions[1].kind, 'equation');
    assert.equal(regions[1].startLine, 1);
    assert.equal(regions[2].kind, 'block');
    assert.equal(regions[2].startLine, 2);
    assert.equal(regions[2].endLine, 4);
});

test('the parse cache reuses the tree but keeps each line index', () => {
    const model = new LineModel();
    const first = model.classify('a/b', 0);
    const second = model.classify('a/b', 7);
    assert.equal(first.kind, 'equation');
    assert.equal(second.kind, 'equation');
    assert.equal(first.index, 0);
    // The cache is keyed on text alone, so returning the cached index would report the first
    // occurrence's position for every repeat of the same line.
    assert.equal(second.index, 7, 'a repeated line reports its own position');
    assert.equal(first.node, second.node, 'the parsed tree is shared, not re-parsed');
});

test('a document with repeated lines classifies every position correctly', () => {
    const model = new LineModel();
    const regions = model.regions('x = 1\n\nx = 1\ny = 2');
    assert.deepEqual(
        regions.map((r) => `${r.kind}@${r.startLine}-${r.endLine}`),
        ['equation@0-0', 'block@1-1', 'equation@2-2', 'equation@3-3'],
    );
});

test('blank lines between equations stay in blocks', () => {
    const regions = lineRegions('x = 1\n\ny = 2');
    assert.equal(regions.filter((r) => r.kind === 'equation').length, 2);
    assert.equal(regions.filter((r) => r.kind === 'block').length, 1);
});

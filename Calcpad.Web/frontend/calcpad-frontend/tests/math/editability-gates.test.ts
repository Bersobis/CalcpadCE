import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyEdit, isCommittableText } from '../../src/math/gate';

const EDITABLE = 'editable';
const NOT_MATH = 'notMath';
const LOSSY = 'lossy';

test('built-in good equations remain editable', () => {
  for (const src of ['a = 1', 'sin(x)', 'x^2 + 1', 'a + b', 'q_1', '[1; 2]', 'sqrt(x)']) {
    assert.equal(classifyEdit(src).kind, EDITABLE, src);
    assert.equal(isCommittableText(src), true, src);
  }
});

test('empty lines are committable', () => {
  assert.equal(isCommittableText('   '), true);
});

test('directives and non-expression lines are not editable', () => {
  assert.equal(classifyEdit('#hide').kind, NOT_MATH);
  assert.equal(classifyEdit('$Plot{}').kind, NOT_MATH);
  assert.equal(classifyEdit("'comment'").kind, NOT_MATH);
  assert.equal(classifyEdit('<b>x</b>').kind, NOT_MATH);
});

test('unparsable text is not editable', () => {
  assert.equal(classifyEdit('@@@').kind, NOT_MATH);
});

test('widow/orphan structural edges the tokenizer accepts are not editable in a field', () => {
  assert.equal(classifyEdit('[]').kind, NOT_MATH, '[]');
  assert.equal(classifyEdit('a,,b').kind, NOT_MATH, 'a,,b');
  assert.equal(classifyEdit('a__b').kind, NOT_MATH, 'a__b');
  assert.equal(classifyEdit('aaa__bbb').kind, NOT_MATH, 'aaa__bbb');
  assert.equal(classifyEdit('1..2').kind, NOT_MATH, '1..2');
  assert.equal(classifyEdit('1.2.3').kind, NOT_MATH, '1.2.3');
});

test('the structurally suspicious lines are not committable', () => {
  for (const src of ['[]', 'a,,b', 'a__b', 'aaa__bbb', '1..2', '1.2.3']) {
    assert.equal(isCommittableText(src), false, src);
  }
});

import { strict as assert } from 'node:assert';
import { parseCalcpad } from './src/math/parser.ts';
import { tokenize } from './src/math/tokenizer.ts';
import { printCalcpad } from './src/math/printer.ts';
import { classifyEdit, isCommittableText } from './src/math/gate.ts';

const bad = [
  'a = /2',
  'a = ( / 2 )',
  'a = ) 2 (',
  'a = [ ; ]',
  'a = [ 1 ; ]',
  'a = [ ; 2 ]',
  'a = ( )',
  'a +',
  'a + ',
  '+ a',
  '1..2',
  '1.2.3',
  '()',
  '[]',
  '[,]',
  'a,,b',
  'a__b',
  "$line(1,2$",
  "x$(1,2)",
  "x$(a,b)",
  "a = $",
];

console.log('=== tokenize + parse surface for careless inputs ===');
for (const source of bad) {
  const tokens = tokenize(source);
  const parsed = parseCalcpad(source);
  const gate = classifyEdit(source);
  const committable = isCommittableText(source);
  let printOk = null;
  if (parsed.ok) {
    printOk = printCalcpad(parsed.node);
    const reparsed = parseCalcpad(printOk);
    if (!reparsed.ok) printOk = 'PRINTS_UNPARSABLE:' + printOk;
  }

  console.log('--- ' + JSON.stringify(source));
  console.log('  tokenize: ' + (tokens.ok ? 'ok' : 'FAIL ' + tokens.error.message) + '  tokens=' + JSON.stringify(tokens.tokens.map(t => t.type + ':' + JSON.stringify(t.text))));
  console.log('  parse:    ' + (parsed.ok ? 'ok node=' + JSON.stringify(printOk) : 'FAIL ' + (parsed.error?.message ?? 'none')));
  console.log('  gate:     kind=' + gate.kind + '  reason=' + (gate.reason ?? 'none'));
  console.log('  committable=' + committable);
}

console.log('');
console.log('=== verify a couple of known-good round trips ===');
for (const good of ['a = 1', 'sin(x)', 'x^2 + 1', 'a + b', 'q_1', '[1; 2]', 'sqrt(x)']) {
  const parsed = parseCalcpad(good);
  assert.ok(parsed.ok, 'good input should parse: ' + good);
  const printed = printCalcpad(parsed.node);
  const reparsed = parseCalcpad(printed);
  assert.ok(reparsed.ok, 'printed form should re-parse: ' + printed);
  console.log('OK  ' + JSON.stringify(good) + '  ->  print=' + JSON.stringify(printed) + '  reparse=' + (reparsed.ok ? 'ok' : 'FAIL'));
}
console.log('');
console.log('PLAYTEST COMPLETE');

/**
 * Engine check for the insert palette: does the Calcpad each template produces actually
 * parse? A template that MathLive accepts but the engine rejects would write a broken line.
 *
 * Requires the backend on `CALCPAD_PORT` (default 9420):
 *   CALCPAD_PORT=9420 CALCPAD_DETACHED=1 dotnet run --project Calcpad.Web/backend
 *
 *   npx tsx scripts/report-templates.mts
 */
import { latexToCalcpad } from '../src/math/latex';
import { INSERT_TEMPLATES } from '../src/math/insertTemplates';

const API = `http://localhost:${process.env.CALCPAD_PORT ?? '9420'}/api/calcpad/convert`;

/** `#0`, `#1`, `#2` are the cursor slots; a filled template must be valid Calcpad. */
const filled = (latex: string): string =>
    latex.replace(/#0/g, '2').replace(/#1/g, '3').replace(/#2/g, '4');

async function errors(content: string): Promise<string[]> {
    const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        signal: AbortSignal.timeout(30000),
    });
    const h = r.headers.get('X-Calcpad-Errors') ?? '[]';
    return [...new Set((JSON.parse(decodeURIComponent(h)) as { message: string }[]).map((e) => e.message))];
}

let bad = 0;
for (const t of INSERT_TEMPLATES) {
    const calcpad = `zz = ${latexToCalcpad(filled(t.latex))}`;
    const e = await errors(calcpad + '\n');
    if (e.length) bad++;
    console.log((e.length ? 'REJECT' : 'ACCEPT').padEnd(7), t.label.padEnd(6), JSON.stringify(calcpad), e.slice(0, 1).join(''));
}

console.log(`\n${INSERT_TEMPLATES.length - bad}/${INSERT_TEMPLATES.length} accepted by the engine`);
if (bad) process.exitCode = 1;
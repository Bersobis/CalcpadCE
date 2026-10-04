/** Share of corpus equation lines the live editor can offer for editing. */
import { readFileSync, globSync } from 'node:fs';
import { splitWorksheet } from '../src/math/calcpad';
import { checkLine } from '../src/math/roundTrip';

let total = 0;
let editable = 0;
for (const f of globSync('../../../Examples/**/*.cpd')) {
    for (const { text } of splitWorksheet(readFileSync(f, 'utf8')).equations) {
        total++;
        const c = checkLine(text, 0);
        if (c.textStable && c.astStable && c.commitStable) editable++;
    }
}
console.log(`equation lines ${total}`);
console.log(`editable       ${editable} (${((editable / total) * 100).toFixed(1)}%)`);
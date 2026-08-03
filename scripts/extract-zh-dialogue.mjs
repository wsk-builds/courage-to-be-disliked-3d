/** Extract Chinese dialogue + titles for translation */
import { PART as P00 } from '../content/parts/part-00-prologue.js';
import { PART as P01 } from '../content/parts/part-01-night1-a.js';
import { PART as P02 } from '../content/parts/part-02-night1-b.js';
import { PART as P03 } from '../content/parts/part-03-night2-a.js';
import { PART as P04 } from '../content/parts/part-04-night2-b.js';
import { PART as P05 } from '../content/parts/part-05-night3-a.js';
import { PART as P06 } from '../content/parts/part-06-night3-b.js';
import { PART as P07 } from '../content/parts/part-07-night4-a.js';
import { PART as P08 } from '../content/parts/part-08-night4-b.js';
import { PART as P09 } from '../content/parts/part-09-night5-a.js';
import { PART as P10 } from '../content/parts/part-10-night5-b.js';
import fs from 'fs';

const parts = [P00, P01, P02, P03, P04, P05, P06, P07, P08, P09, P10];
const out = {};
for (const p of parts) {
  out[p.id] = {
    title: p.title,
    bookRef: p.bookRef,
    segments: Object.fromEntries((p.segments || []).map((s) => [s.id, s.name])),
    lines: Object.fromEntries((p.lines || []).map((l) => [l.id, { speaker: l.speaker, text: l.text }])),
  };
}
fs.mkdirSync(new URL('../content/i18n', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../content/i18n/zh-source.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
console.log('wrote zh-source.json parts', Object.keys(out).length);

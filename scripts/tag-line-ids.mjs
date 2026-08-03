import fs from 'fs';

const path = new URL('../story.js', import.meta.url);
let s = fs.readFileSync(path, 'utf8');

if (!s.includes('P00（序章')) {
  s = s.replace(
    '开篇精神改编的旁观剧情。',
    '开篇精神改编的旁观剧情。\n * 当前内容归属制作单元 P00（序章样板/全书预告）。\n * 全书划分见 docs/PRODUCTION.md 与 content/manifest.js。'
  );
}

if (!s.includes('id?: string')) {
  s = s.replace(' *   speaker: Speaker,', ' *   id?: string,\n *   speaker: Speaker,');
}

let n = 0;
if (!s.includes("id: 'P00-L")) {
  s = s.replace(/(\{\s*\n\s*)(speaker:)/g, (_, a, b) => {
    n += 1;
    const id = `P00-L${String(n).padStart(3, '0')}`;
    return `${a}id: '${id}',\n    ${b}`;
  });
}

if (!s.includes('export const CURRENT_PART')) {
  s = s.replace(
    'export const SPEAKER_LABELS',
    "export const CURRENT_PART = 'P00';\n\nexport const SPEAKER_LABELS"
  );
}

fs.writeFileSync(path, s);
console.log('tagged', n || 'already', 'lines');

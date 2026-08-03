/**
 * 全书制作单元清单（与 docs/PRODUCTION.md 同步）
 * status: planned | draft | ready | locked
 */

export const PARTS = [
  {
    id: 'P00',
    title: '序章 · 夜访',
    bookRef: '引言',
    nightPhase: 'prologue',
    status: 'ready',
    module: './parts/part-00-prologue.js',
    notes: '真序章：郊外→敲门→入座→立约反驳',
  },
  {
    id: 'P01',
    title: '第一夜 · 上：原因与目的',
    bookRef: '第一夜',
    nightPhase: 'night1',
    status: 'ready',
    module: './parts/part-01-night1-a.js',
    notes: '目的论 vs 原因论；创伤',
  },
  {
    id: 'P02',
    title: '第一夜 · 下：不幸的选择',
    bookRef: '第一夜',
    nightPhase: 'night1',
    status: 'ready',
    module: './parts/part-02-night1-b.js',
    notes: '不改变、从现在开始',
  },
  {
    id: 'P03',
    title: '第二夜 · 上：人际与自卑',
    bookRef: '第二夜',
    nightPhase: 'night2',
    status: 'ready',
    module: './parts/part-03-night2-a.js',
    notes: '人际烦恼；自卑感/情结',
  },
  {
    id: 'P04',
    title: '第二夜 · 下：竞争与课题',
    bookRef: '第二夜',
    nightPhase: 'night2',
    status: 'ready',
    module: './parts/part-04-night2-b.js',
    notes: '横向；权力斗争；三大课题',
  },
  {
    id: 'P05',
    title: '第三夜 · 上：课题分离',
    bookRef: '第三夜',
    nightPhase: 'night3',
    status: 'ready',
    module: './parts/part-05-night3-a.js',
    notes: '谁的课题；边界与干涉',
  },
  {
    id: 'P06',
    title: '第三夜 · 下：被讨厌的自由',
    bookRef: '第三夜',
    nightPhase: 'night3',
    status: 'ready',
    module: './parts/part-06-night3-b.js',
    notes: '认可欲求；自由＝被讨厌的勇气',
  },
  {
    id: 'P07',
    title: '第四夜 · 上：共同体感觉',
    bookRef: '第四夜',
    nightPhase: 'night4',
    status: 'ready',
    module: './parts/part-07-night4-a.js',
    notes: '共同体；横向归属',
  },
  {
    id: 'P08',
    title: '第四夜 · 下：他者贡献',
    bookRef: '第四夜',
    nightPhase: 'night4',
    status: 'ready',
    module: './parts/part-08-night4-b.js',
    notes: '他者贡献；我在这里就好',
  },
  {
    id: 'P09',
    title: '第五夜 · 上：此时此刻',
    bookRef: '第五夜',
    nightPhase: 'night5',
    status: 'ready',
    module: './parts/part-09-night5-a.js',
    notes: '人生是点的连续；当下',
  },
  {
    id: 'P10',
    title: '第五夜 · 下：踏雪而出',
    bookRef: '第五夜 · 终章',
    nightPhase: 'ending',
    status: 'ready',
    module: './parts/part-10-night5-b.js',
    notes: '幸福的勇气；雪夜第一步',
  },
];

export function getPartMeta(id) {
  return PARTS.find((p) => p.id === id) || null;
}

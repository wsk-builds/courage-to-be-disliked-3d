/**
 * 剧情入口：默认装配 P00 序章 + P01 第一夜·上。
 * 分 Part 源文件见 content/parts/，拼装逻辑见 content/assemble.js。
 * 全书划分见 docs/PRODUCTION.md。
 */

export {
  PARTS_LOADED,
  assembleStory,
  DEFAULT_STORY,
  LINES,
  CHAPTERS,
  SEGMENTS,
  PART_BOUNDARIES,
  SPEAKER_LABELS,
  getSegmentForLine,
  getPartForLine,
  findPartStart,
  findSegmentStart,
  findSegmentStartByKey,
} from './content/assemble.js';

// 兼容旧播放器命名
export { getSegmentForLine as getChapterForLine } from './content/assemble.js';

export const CURRENT_PARTS = [
  'P00', 'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10',
];

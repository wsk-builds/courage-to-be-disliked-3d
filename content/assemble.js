/**
 * 将 content/parts 中的 PART 模块拼成主播放器可用的扁平时间线。
 * 主程序可按 partId / segmentKey 跳转。
 */

import { PART as P00 } from './parts/part-00-prologue.js';
import { PART as P01 } from './parts/part-01-night1-a.js';
import { PART as P02 } from './parts/part-02-night1-b.js';
import { PART as P03 } from './parts/part-03-night2-a.js';
import { PART as P04 } from './parts/part-04-night2-b.js';
import { PART as P05 } from './parts/part-05-night3-a.js';
import { PART as P06 } from './parts/part-06-night3-b.js';
import { PART as P07 } from './parts/part-07-night4-a.js';
import { PART as P08 } from './parts/part-08-night4-b.js';
import { PART as P09 } from './parts/part-09-night5-a.js';
import { PART as P10 } from './parts/part-10-night5-b.js';

/** 已加载的制作单元（全书 P00–P10） */
export const PARTS_LOADED = [P00, P01, P02, P03, P04, P05, P06, P07, P08, P09, P10];

export const SPEAKER_LABELS = {
  narrator: '旁白',
  philosopher: '哲学家',
  youth: '青年',
};

/**
 * @param {string[]} [partIds]
 * @returns {{
 *   LINES: Array<Record<string, unknown>>,
 *   CHAPTERS: Array<{ id: number, name: string, start: number, partId: string, segmentId: number, key: string }>,
 *   PART_BOUNDARIES: Array<{ partId: string, title: string, start: number, end: number, nightPhase: string }>,
 *   SEGMENTS: Array<{ id: number, name: string, start: number, partId: string, segmentId: number, key: string }>,
 *   getSegmentForLine: (index: number) => number,
 *   getPartForLine: (index: number) => string | null,
 *   findPartStart: (partId: string) => number,
 *   findSegmentStart: (partId: string, segmentId: number) => number,
 *   findSegmentStartByKey: (key: string) => number,
 *   SPEAKER_LABELS: typeof SPEAKER_LABELS,
 * }}
 */
export function assembleStory(
  partIds = ['P00', 'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10'],
) {
  const byId = new Map(PARTS_LOADED.map((p) => [p.id, p]));
  const selected = partIds.map((id) => {
    const part = byId.get(id);
    if (!part) {
      throw new Error(`[assembleStory] unknown part id: ${id}`);
    }
    return part;
  });

  /** @type {Array<Record<string, unknown>>} */
  const LINES = [];
  /** @type {Array<{ id: number, name: string, start: number, partId: string, segmentId: number, key: string }>} */
  const CHAPTERS = [];
  /** @type {Array<{ partId: string, title: string, start: number, end: number, nightPhase: string }>} */
  const PART_BOUNDARIES = [];

  let lineOffset = 0;
  let chapterId = 0;

  for (const part of selected) {
    const partStart = lineOffset;
    const segs = Array.isArray(part.segments) ? part.segments : [{ id: 0, name: part.title, start: 0 }];

    for (const seg of segs) {
      const start = partStart + (typeof seg.start === 'number' ? seg.start : 0);
      const key = `${part.id}:${seg.id}`;
      const name = `${part.id} ${seg.name}`;
      CHAPTERS.push({
        id: chapterId,
        name,
        start,
        partId: part.id,
        segmentId: seg.id,
        key,
      });
      chapterId += 1;
    }

    const lines = Array.isArray(part.lines) ? part.lines : [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const segment = typeof line.segment === 'number' ? line.segment : 0;
      LINES.push({
        ...line,
        partId: part.id,
        segment,
        // 兼容旧播放器：chapter = 全局 rail 索引
        chapter: CHAPTERS.findIndex(
          (c) => c.partId === part.id && c.segmentId === segment,
        ),
        nightPhase: part.nightPhase,
      });
    }

    lineOffset += lines.length;
    PART_BOUNDARIES.push({
      partId: part.id,
      title: part.title,
      start: partStart,
      end: lineOffset - 1,
      nightPhase: part.nightPhase,
    });
  }

  // 修正 chapter：按行所属 segment 映射到 rail 项
  for (let i = 0; i < LINES.length; i++) {
    const line = LINES[i];
    let ch = 0;
    for (const c of CHAPTERS) {
      if (i >= c.start) ch = c.id;
    }
    // 优先用 partId+segment 精确匹配
    const exact = CHAPTERS.find(
      (c) => c.partId === line.partId && c.segmentId === line.segment,
    );
    line.chapter = exact ? exact.id : ch;
  }

  /** @param {number} index */
  function getSegmentForLine(index) {
    if (index < 0 || index >= LINES.length) return 0;
    let segRail = 0;
    for (const c of CHAPTERS) {
      if (index >= c.start) segRail = c.id;
    }
    return segRail;
  }

  /** @param {number} index */
  function getPartForLine(index) {
    if (index < 0 || index >= LINES.length) return null;
    return /** @type {string} */ (LINES[index].partId);
  }

  /** @param {string} partId */
  function findPartStart(partId) {
    const b = PART_BOUNDARIES.find((p) => p.partId === partId);
    return b ? b.start : 0;
  }

  /**
   * @param {string} partId
   * @param {number} segmentId
   */
  function findSegmentStart(partId, segmentId) {
    const c = CHAPTERS.find((x) => x.partId === partId && x.segmentId === segmentId);
    return c ? c.start : findPartStart(partId);
  }

  /** @param {string} key e.g. "P01:2" */
  function findSegmentStartByKey(key) {
    const c = CHAPTERS.find((x) => x.key === key);
    return c ? c.start : 0;
  }

  return {
    LINES,
    CHAPTERS,
    /** 与 CHAPTERS 同形，供章节轨 UI 使用 */
    SEGMENTS: CHAPTERS,
    PART_BOUNDARIES,
    getSegmentForLine,
    getPartForLine,
    findPartStart,
    findSegmentStart,
    findSegmentStartByKey,
    SPEAKER_LABELS,
  };
}

/** 默认装配：全书 P00–P10 */
export const DEFAULT_STORY = assembleStory([
  'P00', 'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10',
]);

export const LINES = DEFAULT_STORY.LINES;
export const CHAPTERS = DEFAULT_STORY.CHAPTERS;
export const SEGMENTS = DEFAULT_STORY.SEGMENTS;
export const PART_BOUNDARIES = DEFAULT_STORY.PART_BOUNDARIES;
export const getSegmentForLine = DEFAULT_STORY.getSegmentForLine;
export const getPartForLine = DEFAULT_STORY.getPartForLine;
export const findPartStart = DEFAULT_STORY.findPartStart;
export const findSegmentStart = DEFAULT_STORY.findSegmentStart;
export const findSegmentStartByKey = DEFAULT_STORY.findSegmentStartByKey;

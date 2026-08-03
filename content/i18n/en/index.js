/**
 * English dialogue + titles for all parts.
 * Line values may be plain strings or { speaker, text } — normalized here.
 */
import p0002 from './parts-00-02.js';
import p0304 from './parts-03-04.js';
import p0506 from './parts-05-06.js';
import p0710 from './parts-07-10.js';

function normLine(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v.text != null) return String(v.text);
  return String(v);
}

function normalizePart(part) {
  if (!part) return null;
  const lines = {};
  for (const [id, v] of Object.entries(part.lines || {})) {
    lines[id] = normLine(v);
  }
  const segments = {};
  for (const [k, name] of Object.entries(part.segments || {})) {
    segments[String(k)] = name;
  }
  return {
    title: part.title || '',
    bookRef: part.bookRef || '',
    segments,
    lines,
  };
}

const raw = { ...p0002, ...p0304, ...p0506, ...p0710 };

/** @type {Record<string, { title: string, bookRef: string, segments: Record<string,string>, lines: Record<string,string> }>} */
export const EN_PARTS = Object.fromEntries(
  Object.entries(raw).map(([id, p]) => [id, normalizePart(p)])
);

export function getEnLine(lineId) {
  for (const p of Object.values(EN_PARTS)) {
    if (p.lines[lineId]) return p.lines[lineId];
  }
  return null;
}

export function getEnPartTitle(partId) {
  return EN_PARTS[partId]?.title || null;
}

export function getEnSegmentName(partId, segmentId) {
  return EN_PARTS[partId]?.segments[String(segmentId)] || null;
}

export function validateAgainstZhSource(zhSource) {
  const missing = [];
  for (const [pid, part] of Object.entries(zhSource)) {
    const en = EN_PARTS[pid];
    if (!en) {
      missing.push(`${pid}:missing-part`);
      continue;
    }
    for (const lid of Object.keys(part.lines || {})) {
      if (!en.lines[lid]) missing.push(lid);
    }
  }
  return missing;
}

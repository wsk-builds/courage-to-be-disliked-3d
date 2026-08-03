/**
 * App locale: default English, switchable zh / en.
 */

export const LANGS = ['en', 'zh'];
export const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'courage-lang';

/** @type {'en'|'zh'} */
let currentLang = DEFAULT_LANG;

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'en' || saved === 'zh') currentLang = saved;
} catch (_) {
  /* ignore */
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (lang !== 'en' && lang !== 'zh') return currentLang;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (_) {
    /* ignore */
  }
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  return currentLang;
}

/** Resolve bilingual string or plain string */
export function t(value, lang = currentLang) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value[lang] || value.en || value.zh || '';
  }
  return String(value);
}

// Filled by app after loading EN pack (avoids circular imports at module init)
/** @type {null | ((id: string) => string|null)} */
let enLineLookup = null;
/** @type {null | ((partId: string) => string|null)} */
let enPartTitleLookup = null;
/** @type {null | ((partId: string, segId: number|string) => string|null)} */
let enSegLookup = null;

export function registerEnglishLookups({ getLine, getPartTitle, getSegmentName }) {
  enLineLookup = getLine || null;
  enPartTitleLookup = getPartTitle || null;
  enSegLookup = getSegmentName || null;
}

export function lineText(line, lang = currentLang) {
  if (!line) return '';
  if (line.text != null && typeof line.text === 'object' && (line.text.en || line.text.zh)) {
    return t(line.text, lang);
  }
  if (lang === 'en') {
    if (line.textEn) return line.textEn;
    if (line.id && enLineLookup) {
      const en = enLineLookup(line.id);
      if (en) return en;
    }
  }
  return line.text || line.textZh || '';
}

export function partTitle(partId, zhTitle, lang = currentLang) {
  if (lang === 'en' && enPartTitleLookup) {
    const en = enPartTitleLookup(partId);
    if (en) return en;
  }
  return zhTitle || partId;
}

export function segmentName(partId, segmentId, zhName, lang = currentLang) {
  if (lang === 'en' && enSegLookup) {
    const en = enSegLookup(partId, segmentId);
    if (en) return en;
  }
  return zhName || String(segmentId);
}

export const UI = {
  en: {
    docTitle: 'The Courage to Be Disliked · Spectator World',
    loadingTitle: 'The Courage to Be Disliked',
    loadingSubtitle: 'An interactive Adlerian world you can watch',
    loadingHint: 'Building the study and the night…',
    brandDefault: 'The Courage to Be Disliked',
    voice: 'Voice',
    voiceOn: '🔊 Voice',
    voiceOff: '🔇 Mute',
    cast: '🎙 Cast',
    castTitle: 'Voice casting',
    castStatus: 'Browser system voices · preview and save',
    castTip:
      'This uses your <strong>browser’s built-in TTS</strong>. Available voices depend on your OS language packs. Choices are saved; press <kbd>V</kbd> anytime.',
    castRefresh: 'Refresh voice list',
    castReset: 'Reset to auto',
    castPreview: '▶ Preview',
    castPitch: 'Pitch',
    castRate: 'Rate',
    castAuto: '(Auto match)',
    castManual: ' · manual',
    castAutoTag: ' · auto',
    castCloud: ' · cloud',
    navLabel: 'Menu',
    navTitle: 'Story menu',
    navParts: 'Chapters',
    navSegments: 'Scenes',
    navHint: '<kbd>C</kbd> menu · <kbd>[ ]</kbd> chapter · <kbd>1-9</kbd> scene',
    helpTitle: 'Controls',
    helpItems: [
      '<kbd>W A S D</kbd> free-fly (look direction) · <kbd>Shift</kbd> sprint',
      '<kbd>Q E</kbd> or <kbd>PgUp/PgDn</kbd> altitude · <kbd>Wheel</kbd> rise/lower',
      '<kbd>Click canvas</kbd> lock mouse look (free explore)',
      '<kbd>Space</kbd> play / pause',
      '<kbd>← →</kbd> prev / next line',
      '<kbd>C</kbd> open / close menu',
      '<kbd>[ ]</kbd> prev / next chapter',
      '<kbd>1-9</kbd> scene n in chapter',
      '<kbd>M</kbd> voice · <kbd>V</kbd> cast · <kbd>L</kbd> language',
      '<kbd>R</kbd> cinematic · <kbd>F</kbd> follow / free',
      '<kbd>H</kbd> or <kbd>?</kbd> close this panel',
    ],
    play: 'Play / pause',
    prev: 'Previous line',
    next: 'Next line',
    footer:
      'Adapted from the ideas of The Courage to Be Disliked · not a verbatim edition · P00–P10',
    minimap: {
      exterior: 'Ancient city · outskirts',
      door: 'Philosopher’s house · porch',
      study: 'Study · night talk',
      closeup: 'Study · close-up',
      snow: 'Outside · fresh snow',
    },
    speakers: {
      narrator: 'Narrator',
      philosopher: 'Philosopher',
      youth: 'Youth',
    },
    roles: {
      narrator: 'Narrator',
      philosopher: 'Philosopher',
      youth: 'Youth',
    },
    langEn: 'EN',
    langZh: '中文',
    bootFail: 'Startup failed',
    bootHint:
      '\n\nOpen via a local server (do not double-click the HTML):\npython serve.py 5173\nThen visit http://127.0.0.1:5173/',
  },
  zh: {
    docTitle: '被讨厌的勇气 · 旁观世界',
    loadingTitle: '被讨厌的勇气',
    loadingSubtitle: '一个可旁观的阿德勒哲学世界',
    loadingHint: '正在构筑书房与夜色…',
    brandDefault: '被讨厌的勇气',
    voice: '配音',
    voiceOn: '🔊 配音',
    voiceOff: '🔇 静音',
    cast: '🎙 选声',
    castTitle: '角色选声',
    castStatus: '使用浏览器系统语音 · 可试听后保存',
    castTip:
      '当前是<strong>浏览器自带 TTS</strong>。音色取决于本机语音包。选好后会记住；按 <kbd>V</kbd> 可随时打开。',
    castRefresh: '刷新音色列表',
    castReset: '恢复自动分配',
    castPreview: '▶ 试听',
    castPitch: '音高',
    castRate: '语速',
    castAuto: '（自动匹配）',
    castManual: ' · 已手选',
    castAutoTag: ' · 自动',
    castCloud: ' ·云',
    navLabel: '目录',
    navTitle: '故事目录',
    navParts: '章节',
    navSegments: '本段',
    navHint: '快捷键 <kbd>C</kbd> 开合目录 · <kbd>[ ]</kbd> 换章 · <kbd>1-9</kbd> 换段',
    helpTitle: '操作说明',
    helpItems: [
      '<kbd>W A S D</kbd> 自由飞行（沿视线）· <kbd>Shift</kbd> 加速',
      '<kbd>Q E</kbd> 或 <kbd>PgUp/PgDn</kbd> 升降 · <kbd>滚轮</kbd> 快速调高度',
      '<kbd>点击画面</kbd> 锁定鼠标环顾（自由探索）',
      '<kbd>空格</kbd> 播放 / 暂停',
      '<kbd>← →</kbd> 上一句 / 下一句',
      '<kbd>C</kbd> 打开 / 收起目录',
      '<kbd>[ ]</kbd> 上一章 / 下一章',
      '<kbd>1-9</kbd> 当前章内第 n 段',
      '<kbd>M</kbd> 配音 · <kbd>V</kbd> 选声 · <kbd>L</kbd> 语言',
      '<kbd>R</kbd> 电影镜头 · <kbd>F</kbd> 跟随/自由',
      '<kbd>H</kbd> 或 <kbd>?</kbd> 关闭本面板',
    ],
    play: '播放/暂停',
    prev: '上一句',
    next: '下一句',
    footer: '改编自《被讨厌的勇气》思想结构 · 非原文照搬 · 全书 P00–P10',
    minimap: {
      exterior: '千年古都 · 郊外',
      door: '哲学家居所 · 门廊',
      study: '哲学家书房 · 夜谈',
      closeup: '书房 · 对谈',
      snow: '门外 · 新雪',
    },
    speakers: {
      narrator: '旁白',
      philosopher: '哲学家',
      youth: '青年',
    },
    roles: {
      narrator: '旁白',
      philosopher: '哲学家',
      youth: '青年',
    },
    langEn: 'EN',
    langZh: '中文',
    bootFail: '启动失败',
    bootHint:
      '\n\n请用本地服务器打开（不要双击 HTML）：\npython serve.py 5173\n然后访问 http://127.0.0.1:5173/',
  },
};

export function ui(key, lang = currentLang) {
  const pack = UI[lang] || UI.en;
  const parts = key.split('.');
  let cur = pack;
  for (const p of parts) {
    if (cur == null) return key;
    cur = cur[p];
  }
  return cur != null ? cur : key;
}

// Apply default lang on load
if (typeof document !== 'undefined') {
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
}

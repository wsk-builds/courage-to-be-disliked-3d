/**
 * Multi-character Chinese TTS via Web Speech API.
 * Supports auto-assign + manual pick with localStorage persistence.
 */

/** @typedef {'narrator' | 'philosopher' | 'youth' | string} VoiceRole */

/**
 * @typedef {Object} VoiceProfile
 * @property {string} label
 * @property {number} pitch
 * @property {number} rate
 * @property {number} volume
 * @property {string[]} preferName
 * @property {string[]} avoidName
 * @property {'male'|'female'|'any'} gender
 * @property {string} styleNote
 */

const STORAGE_KEY = 'courage-voice-cast-v1';

/** @type {Record<string, VoiceProfile>} */
export const VOICE_PROFILES = {
  narrator: {
    label: '旁白',
    pitch: 0.95,
    rate: 0.92,
    volume: 0.88,
    preferName: ['huihui', 'yaoyao', 'xiaoxiao', 'xiaoyi', 'female', 'zira', 'susan'],
    avoidName: ['kangkang', 'zhiwei', 'david', 'mark'],
    gender: 'female',
    styleNote: '沉稳纪录片旁白，略柔、节奏从容',
  },
  philosopher: {
    label: '哲学家',
    pitch: 0.72,
    rate: 0.82,
    volume: 1.0,
    preferName: ['kangkang', 'zhiwei', 'yunjian', 'yunxi', 'yunye', 'male', 'david', 'mark', 'richard'],
    avoidName: ['yaoyao', 'huihui', 'zira'],
    gender: 'male',
    styleNote: '年长学者：低沉、缓慢、留白多',
  },
  youth: {
    label: '青年',
    pitch: 1.12,
    rate: 1.06,
    volume: 1.0,
    preferName: ['yunyang', 'yunfeng', 'xiaoshuang', 'male', 'guy', 'james'],
    avoidName: ['kangkang', 'zhiwei'],
    gender: 'male',
    styleNote: '年轻气盛：偏高、偏快，质问感',
  },
  guest: {
    label: '访客',
    pitch: 1.0,
    rate: 1.0,
    volume: 0.95,
    preferName: [],
    avoidName: [],
    gender: 'any',
    styleNote: '中性默认',
  },
};

/** Sample lines for audition */
export const PREVIEW_LINES = {
  narrator: '在这座有着千年历史的古城郊外，住着一位哲学家。',
  philosopher: '欢迎。请坐。所谓的自由，就是被别人讨厌的勇气。',
  youth: '我不是来请教的。我是来反驳你的。这根本站不住脚！',
};

export function cleanSpeechText(text) {
  if (!text) return '';
  return String(text)
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[—–]/g, '，')
    .replace(/…+/g, '。')
    .replace(/\s+/g, ' ')
    .trim();
}

export function estimateSpeechSeconds(text, rate = 1) {
  const t = cleanSpeechText(text);
  const chars = t.replace(/\s/g, '').length;
  return Math.max(1.2, (chars / 3.8) / Math.max(0.5, rate) + 0.45);
}

function scoreVoice(voice, profile, usedVoiceURIs) {
  const name = `${voice.name} ${voice.lang}`.toLowerCase();
  let score = 0;
  if (/^zh(-|_)/i.test(voice.lang) || /chinese|中文|中国/i.test(name)) score += 50;
  else if (/zh/i.test(voice.lang)) score += 40;
  else score -= 20;

  for (const p of profile.preferName || []) {
    if (name.includes(p.toLowerCase())) score += 25;
  }
  for (const a of profile.avoidName || []) {
    if (name.includes(a.toLowerCase())) score -= 15;
  }

  if (profile.gender === 'female') {
    if (/female|woman|huihui|yaoyao|xiaoxiao|xiaoyi|zira|susan|linda|ting/i.test(name)) score += 12;
    if (/male|man|kangkang|zhiwei|david|mark|guy/i.test(name)) score -= 8;
  }
  if (profile.gender === 'male') {
    if (/male|man|kangkang|zhiwei|yunjian|yunyang|david|mark|guy|richard/i.test(name)) score += 12;
    if (/female|woman|huihui|yaoyao|zira/i.test(name)) score -= 8;
  }

  if (usedVoiceURIs.has(voice.voiceURI)) score -= 10;
  if (voice.localService) score += 5;
  return score;
}

function loadSavedCast() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { uris: {}, pitch: {}, rate: {} };
    const data = JSON.parse(raw);
    return {
      uris: data.uris || data || {},
      pitch: data.pitch || {},
      rate: data.rate || {},
    };
  } catch (_) {
    return { uris: {}, pitch: {}, rate: {} };
  }
}

function saveCast(uris, pitch, rate) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ uris, pitch, rate }));
  } catch (_) {
    /* ignore */
  }
}

export function createVoiceDirector(options = {}) {
  const saved = loadSavedCast();
  const state = {
    enabled: options.enabled !== false,
    unlocked: false,
    volume: options.volume ?? 1,
    voices: [],
    /** @type {Record<string, SpeechSynthesisVoice|null>} */
    assigned: {},
    /** manual overrides by voiceURI string; null = use auto */
    /** @type {Record<string, string|null>} */
    manualUri: { ...saved.uris },
    /** @type {Record<string, number>} */
    manualPitch: { ...saved.pitch },
    /** @type {Record<string, number>} */
    manualRate: { ...saved.rate },
    current: null,
    speaking: false,
    onStart: options.onStart || null,
    onEnd: options.onEnd || null,
    onError: options.onError || null,
    onVoicesChanged: options.onVoicesChanged || null,
    ready: false,
  };

  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

  function persist() {
    saveCast(state.manualUri, state.manualPitch, state.manualRate);
  }

  function applyManualThenAuto() {
    const used = new Set();
    const roles = ['philosopher', 'youth', 'narrator'];

    // 1) Apply manual picks first
    for (const role of roles) {
      const uri = state.manualUri[role];
      if (uri) {
        const v = state.voices.find((x) => x.voiceURI === uri) || null;
        state.assigned[role] = v;
        if (v) used.add(v.voiceURI);
      } else {
        state.assigned[role] = null;
      }
    }

    // 2) Auto-fill remaining
    for (const role of roles) {
      if (state.assigned[role]) continue;
      const profile = VOICE_PROFILES[role] || VOICE_PROFILES.guest;
      const ranked = [...state.voices]
        .map((v) => ({ v, s: scoreVoice(v, profile, used) }))
        .sort((a, b) => b.s - a.s);
      const best = ranked[0]?.v || null;
      state.assigned[role] = best;
      if (best) used.add(best.voiceURI);
    }
  }

  function refreshVoices() {
    if (!synth) return;
    state.voices = synth.getVoices() || [];
    applyManualThenAuto();
    state.ready = state.voices.length > 0;
    if (state.onVoicesChanged) state.onVoicesChanged(getCastInfo());
  }

  function registerRole(role, profile) {
    VOICE_PROFILES[role] = { ...VOICE_PROFILES.guest, ...profile, label: profile.label || role };
    if (state.voices.length) applyManualThenAuto();
  }

  function unlock() {
    if (state.unlocked || !synth) return;
    state.unlocked = true;
    try {
      synth.cancel();
      const kick = new SpeechSynthesisUtterance(' ');
      kick.volume = 0.01;
      kick.rate = 2;
      synth.speak(kick);
      synth.cancel();
    } catch (_) {
      /* ignore */
    }
  }

  function stop() {
    if (!synth) return;
    try {
      synth.cancel();
    } catch (_) {
      /* ignore */
    }
    state.speaking = false;
    state.current = null;
  }

  function resolvePitchRate(role, emotion = 'calm') {
    const profile = VOICE_PROFILES[role] || VOICE_PROFILES.guest;
    let pitch =
      typeof state.manualPitch[role] === 'number' ? state.manualPitch[role] : profile.pitch;
    let rate = typeof state.manualRate[role] === 'number' ? state.manualRate[role] : profile.rate;

    switch (emotion) {
      case 'angry':
        pitch += 0.08;
        rate += 0.08;
        break;
      case 'tense':
        rate += 0.05;
        pitch += 0.04;
        break;
      case 'thoughtful':
        rate -= 0.06;
        pitch -= 0.03;
        break;
      case 'hopeful':
        pitch += 0.05;
        rate -= 0.02;
        break;
      default:
        break;
    }

    if (role === 'philosopher') {
      rate = Math.min(rate, 0.95);
    }
    if (role === 'youth' && (emotion === 'angry' || emotion === 'tense')) {
      rate = Math.min(1.25, rate + 0.04);
    }

    return {
      pitch: Math.max(0.1, Math.min(2, pitch)),
      rate: Math.max(0.5, Math.min(1.5, rate)),
      volume: Math.max(0, Math.min(1, profile.volume * state.volume)),
    };
  }

  function speak(role, text, emotion = 'calm') {
    const profile = VOICE_PROFILES[role] || VOICE_PROFILES.guest;
    const cleaned = cleanSpeechText(text);
    const { pitch, rate, volume } = resolvePitchRate(role, emotion);
    const estimated = estimateSpeechSeconds(cleaned, rate);

    if (!state.enabled || !synth || !cleaned) {
      return Promise.resolve({ ok: false, estimated });
    }

    unlock();
    stop();

    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(cleaned);
      u.lang = 'zh-CN';
      u.pitch = pitch;
      u.rate = rate;
      u.volume = volume;

      const v =
        state.assigned[role] ||
        state.assigned.narrator ||
        state.voices.find((x) => /zh/i.test(x.lang));
      if (v) u.voice = v;

      state.current = u;
      state.speaking = true;

      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        state.speaking = false;
        state.current = null;
        if (state.onEnd) state.onEnd(role, ok);
        resolve({ ok, estimated });
      };

      u.onstart = () => {
        if (state.onStart) state.onStart(role);
      };
      u.onend = () => done(true);
      u.onerror = (ev) => {
        if (state.onError) state.onError(ev);
        done(false);
      };

      try {
        if (synth.paused) synth.resume();
        synth.speak(u);
        window.setTimeout(() => {
          if (state.current === u) done(false);
        }, estimated * 1000 + 4000);
      } catch (err) {
        if (state.onError) state.onError(err);
        done(false);
      }
    });
  }

  /** Preview without affecting story timer much */
  function preview(role, text) {
    const sample = text || PREVIEW_LINES[role] || PREVIEW_LINES.narrator;
    unlock();
    return speak(role, sample, 'calm');
  }

  /**
   * Manually assign a system voice to a role.
   * @param {string} role
   * @param {string|null} voiceURI  null = back to auto
   */
  function setRoleVoice(role, voiceURI) {
    if (voiceURI) state.manualUri[role] = voiceURI;
    else delete state.manualUri[role];
    applyManualThenAuto();
    persist();
    if (state.onVoicesChanged) state.onVoicesChanged(getCastInfo());
  }

  function setRolePitch(role, pitch) {
    state.manualPitch[role] = Math.max(0.5, Math.min(1.5, Number(pitch)));
    persist();
  }

  function setRoleRate(role, rate) {
    state.manualRate[role] = Math.max(0.6, Math.min(1.4, Number(rate)));
    persist();
  }

  function resetCast() {
    state.manualUri = {};
    state.manualPitch = {};
    state.manualRate = {};
    applyManualThenAuto();
    persist();
    if (state.onVoicesChanged) state.onVoicesChanged(getCastInfo());
  }

  function listVoices({ chineseOnly = false } = {}) {
    let list = [...state.voices];
    if (chineseOnly) {
      list = list.filter(
        (v) => /zh/i.test(v.lang) || /chinese|中文|中国|hong kong|taiwan/i.test(v.name)
      );
      // If no Chinese, return all so user can still pick
      if (!list.length) list = [...state.voices];
    }
    return list
      .map((v) => ({
        name: v.name,
        lang: v.lang,
        voiceURI: v.voiceURI,
        localService: !!v.localService,
        default: !!v.default,
      }))
      .sort((a, b) => {
        const az = /zh/i.test(a.lang) ? 0 : 1;
        const bz = /zh/i.test(b.lang) ? 0 : 1;
        if (az !== bz) return az - bz;
        return a.name.localeCompare(b.name, 'zh');
      });
  }

  function getCastInfo() {
    const roles = ['philosopher', 'youth', 'narrator'];
    const cast = {};
    for (const role of roles) {
      const v = state.assigned[role];
      const profile = VOICE_PROFILES[role];
      cast[role] = {
        label: profile?.label || role,
        voiceURI: v?.voiceURI || null,
        voiceName: v?.name || null,
        lang: v?.lang || null,
        manual: !!state.manualUri[role],
        pitch:
          typeof state.manualPitch[role] === 'number'
            ? state.manualPitch[role]
            : profile?.pitch ?? 1,
        rate:
          typeof state.manualRate[role] === 'number' ? state.manualRate[role] : profile?.rate ?? 1,
        styleNote: profile?.styleNote || '',
      };
    }
    return {
      ready: state.ready,
      voiceCount: state.voices.length,
      chineseCount: listVoices({ chineseOnly: true }).length,
      cast,
    };
  }

  function setEnabled(on) {
    state.enabled = !!on;
    if (!on) stop();
  }

  function setVolume(v) {
    state.volume = Math.max(0, Math.min(1, v));
  }

  function getStatus() {
    return {
      enabled: state.enabled,
      unlocked: state.unlocked,
      ready: state.ready,
      speaking: state.speaking,
      volume: state.volume,
      voices: listVoices(),
      assigned: Object.fromEntries(
        Object.entries(state.assigned).map(([k, v]) => [k, v ? v.name : null])
      ),
      cast: getCastInfo().cast,
    };
  }

  if (synth) {
    refreshVoices();
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.onvoiceschanged = refreshVoices;
    }
    setTimeout(refreshVoices, 250);
    setTimeout(refreshVoices, 1000);
    setTimeout(refreshVoices, 2500);
  }

  return {
    speak,
    preview,
    stop,
    unlock,
    setEnabled,
    setVolume,
    setRoleVoice,
    setRolePitch,
    setRoleRate,
    resetCast,
    listVoices,
    getCastInfo,
    registerRole,
    getStatus,
    cleanSpeechText,
    estimateSpeechSeconds: (role, text) => {
      const { rate } = resolvePitchRate(role, 'calm');
      return estimateSpeechSeconds(text, rate);
    },
    profiles: VOICE_PROFILES,
    PREVIEW_LINES,
  };
}

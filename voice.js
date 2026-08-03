/**
 * Multi-character TTS via Web Speech API.
 * Language-strict casting + cancel/speak race fixes for Chrome/Edge/Windows.
 */

/** @typedef {'narrator' | 'philosopher' | 'youth' | string} VoiceRole */

const STORAGE_KEY = 'courage-voice-cast-v3';

/**
 * Safer pitch/rate ranges — extreme pitch (e.g. 0.72 / 1.14) is silent on many SAPI voices.
 */
const PROFILES_ZH = {
  narrator: {
    label: '旁白',
    pitch: 1.0,
    rate: 0.92,
    volume: 1.0,
    preferName: ['huihui', 'yaoyao', 'xiaoxiao', 'xiaoyi', 'xiaoyan', 'female'],
    avoidName: ['kangkang', 'zhiwei', 'yunyang'],
    gender: 'female',
    styleNote: '沉稳旁白',
  },
  philosopher: {
    label: '哲学家',
    pitch: 0.92,
    rate: 0.88,
    volume: 1.0,
    preferName: ['kangkang', 'zhiwei', 'yunjian', 'yunye', 'yunxi', 'male'],
    avoidName: ['huihui', 'yaoyao', 'xiaoxiao'],
    gender: 'male',
    styleNote: '年长、偏慢',
  },
  youth: {
    label: '青年',
    pitch: 1.05,
    rate: 1.05,
    volume: 1.0,
    // Prefer a *different* male from philosopher; do NOT exclude all common males
    preferName: ['yunyang', 'yunfeng', 'xiaoshuang', 'yunxia', 'male'],
    avoidName: ['huihui', 'yaoyao', 'xiaoxiao', 'female'],
    gender: 'male',
    styleNote: '年轻、略快',
  },
  guest: {
    label: '访客',
    pitch: 1.0,
    rate: 1.0,
    volume: 1.0,
    preferName: [],
    avoidName: [],
    gender: 'any',
    styleNote: '',
  },
};

const PROFILES_EN = {
  narrator: {
    label: 'Narrator',
    pitch: 1.0,
    rate: 0.95,
    volume: 1.0,
    preferName: ['zira', 'susan', 'jenny', 'aria', 'sara', 'samantha', 'female'],
    avoidName: ['david', 'mark', 'george'],
    gender: 'female',
    styleNote: 'Clear documentary narrator',
  },
  philosopher: {
    label: 'Philosopher',
    pitch: 0.95,
    rate: 0.9,
    volume: 1.0,
    preferName: ['david', 'james', 'george', 'daniel', 'richard', 'male'],
    avoidName: ['zira', 'susan', 'jenny', 'aria'],
    gender: 'male',
    styleNote: 'Older, measured male',
  },
  youth: {
    label: 'Youth',
    pitch: 1.06,
    rate: 1.06,
    volume: 1.0,
    preferName: ['mark', 'guy', 'justin', 'steffan', 'sam', 'male'],
    avoidName: ['zira', 'susan', 'jenny'],
    gender: 'male',
    styleNote: 'Younger, brighter male',
  },
  guest: {
    label: 'Guest',
    pitch: 1.0,
    rate: 1.0,
    volume: 1.0,
    preferName: [],
    avoidName: [],
    gender: 'any',
    styleNote: '',
  },
};

export let VOICE_PROFILES = { ...PROFILES_EN };

export const PREVIEW_LINES = {
  zh: {
    narrator: '在这座有着千年历史的古城郊外，住着一位哲学家。',
    philosopher: '欢迎。请坐。所谓的自由，就是被别人讨厌的勇气。',
    youth: '我不是来请教的。我是来反驳你的。这根本站不住脚！',
  },
  en: {
    narrator: 'On the outskirts of an ancient city lived a philosopher.',
    philosopher: 'Welcome. Please, sit. Freedom, in this sense, is the courage to be disliked.',
    youth: "I'm not here for lessons. I'm here to take you apart. That claim doesn't hold!",
  },
};

function speechLangCode(appLang) {
  return appLang === 'zh' ? 'zh-CN' : 'en-US';
}

export function matchesAppLang(voice, appLang) {
  if (!voice) return false;
  const lang = String(voice.lang || '');
  const name = String(voice.name || '');
  const blob = `${name} ${lang}`.toLowerCase();

  if (appLang === 'zh') {
    return (
      /^zh\b/i.test(lang) ||
      /zh[-_]/i.test(lang) ||
      /chinese|中文|中国|hong kong|taiwan|cantonese|mandarin/i.test(blob)
    );
  }

  // Exclude clearly non-English first
  if (
    /chinese|中文|日本|한국|deutsch|français|español|zh-|ja-|ko-|de-|fr-|es-/i.test(blob) &&
    !/english|en[-_]|en\b/i.test(blob)
  ) {
    return false;
  }
  return (
    /^en\b/i.test(lang) ||
    /en[-_]/i.test(lang) ||
    /english|united states|united kingdom|great britain|australia|ireland|canada|new zealand/i.test(
      blob
    )
  );
}

export function cleanSpeechText(text, lang = 'en') {
  if (!text) return '';
  return String(text)
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[—–]/g, lang === 'zh' ? '，' : ', ')
    .replace(/…+/g, lang === 'zh' ? '。' : '...')
    .replace(/\s+/g, ' ')
    .trim();
}

export function estimateSpeechSeconds(text, rate = 1, appLang = 'en') {
  const t = cleanSpeechText(text, appLang);
  if (!t) return 1.2;
  if (appLang === 'en') {
    const words = t.split(/\s+/).filter(Boolean).length;
    return Math.max(1.4, words / 2.5 / Math.max(0.5, rate) + 0.45);
  }
  const chars = t.replace(/\s/g, '').length;
  return Math.max(1.2, chars / 3.8 / Math.max(0.5, rate) + 0.45);
}

function scoreVoice(voice, profile, usedVoiceURIs, appLang) {
  if (!matchesAppLang(voice, appLang)) return -1000;
  const name = `${voice.name} ${voice.lang}`.toLowerCase();
  let score = 10;
  if (matchesAppLang(voice, appLang)) score += 40;

  for (const p of profile.preferName || []) {
    if (name.includes(String(p).toLowerCase())) score += 20;
  }
  for (const a of profile.avoidName || []) {
    if (name.includes(String(a).toLowerCase())) score -= 12;
  }
  if (profile.gender === 'female') {
    if (/female|woman|zira|susan|jenny|aria|huihui|yaoyao|xiaoxiao/i.test(name)) score += 10;
    if (/male|\bman\b|david|mark|kangkang|zhiwei/i.test(name)) score -= 6;
  }
  if (profile.gender === 'male') {
    if (/male|\bman\b|david|mark|james|george|kangkang|zhiwei|yunyang/i.test(name)) score += 10;
    if (/female|woman|zira|susan|huihui|yaoyao/i.test(name)) score -= 6;
  }
  // Soft penalty for reuse — never hard-block (one-voice systems must still speak)
  if (usedVoiceURIs.has(voice.voiceURI)) score -= 8;
  if (voice.localService) score += 4;
  return score;
}

function loadSavedCast() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (_) {
    return {};
  }
}

function saveCast(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    /* ignore */
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForSynthIdle(synth, maxMs = 1500) {
  const start = performance.now();
  while (synth.speaking || synth.pending) {
    if (performance.now() - start > maxMs) break;
    await wait(40);
  }
  // Extra beat — Chrome still drops speak() if called too soon after idle
  await wait(30);
}

export function createVoiceDirector(options = {}) {
  const saved = loadSavedCast();
  const state = {
    enabled: options.enabled !== false,
    unlocked: false,
    volume: options.volume ?? 1,
    appLang: options.appLang === 'zh' ? 'zh' : 'en',
    voices: [],
    /** @type {Record<string, SpeechSynthesisVoice|null>} */
    assigned: { narrator: null, philosopher: null, youth: null },
    manualUriByLang: saved.urisByLang || { en: {}, zh: {} },
    manualPitchByLang: saved.pitchByLang || { en: {}, zh: {} },
    manualRateByLang: saved.rateByLang || { en: {}, zh: {} },
    speaking: false,
    onStart: options.onStart || null,
    onEnd: options.onEnd || null,
    onError: options.onError || null,
    onVoicesChanged: options.onVoicesChanged || null,
    ready: false,
  };

  let jobId = 0;
  /** @type {null | { id: number, resolve: Function }} */
  let activeJob = null;

  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

  function profiles() {
    return state.appLang === 'zh' ? PROFILES_ZH : PROFILES_EN;
  }
  function manualUriMap() {
    if (!state.manualUriByLang[state.appLang]) state.manualUriByLang[state.appLang] = {};
    return state.manualUriByLang[state.appLang];
  }
  function manualPitchMap() {
    if (!state.manualPitchByLang[state.appLang]) state.manualPitchByLang[state.appLang] = {};
    return state.manualPitchByLang[state.appLang];
  }
  function manualRateMap() {
    if (!state.manualRateByLang[state.appLang]) state.manualRateByLang[state.appLang] = {};
    return state.manualRateByLang[state.appLang];
  }

  VOICE_PROFILES = { ...profiles() };

  function persist() {
    saveCast({
      urisByLang: state.manualUriByLang,
      pitchByLang: state.manualPitchByLang,
      rateByLang: state.manualRateByLang,
    });
  }

  function langPool() {
    return state.voices.filter((v) => matchesAppLang(v, state.appLang));
  }

  function applyManualThenAuto() {
    VOICE_PROFILES = { ...profiles() };
    const pack = profiles();
    const used = new Set();
    const roles = ['philosopher', 'youth', 'narrator'];
    const uris = manualUriMap();
    const pool = langPool();

    for (const role of roles) {
      state.assigned[role] = null;
      const uri = uris[role];
      if (!uri) continue;
      const v = state.voices.find((x) => x.voiceURI === uri);
      if (v && matchesAppLang(v, state.appLang)) {
        state.assigned[role] = v;
        used.add(v.voiceURI);
      }
    }

    for (const role of roles) {
      if (state.assigned[role]) continue;
      const profile = pack[role] || pack.guest;
      const ranked = pool
        .map((v) => ({ v, s: scoreVoice(v, profile, used, state.appLang) }))
        .sort((a, b) => b.s - a.s);
      const best = ranked[0]?.v || pool[0] || null;
      state.assigned[role] = best;
      if (best) used.add(best.voiceURI);
    }

    // Guarantee youth has *a* voice even if only one male exists
    if (!state.assigned.youth && pool.length) {
      state.assigned.youth =
        state.assigned.philosopher || state.assigned.narrator || pool[0];
    }
  }

  function refreshVoices() {
    if (!synth) return;
    state.voices = synth.getVoices() || [];
    applyManualThenAuto();
    state.ready = state.voices.length > 0;
    if (state.onVoicesChanged) {
      try {
        state.onVoicesChanged(getCastInfo());
      } catch (_) {
        /* ignore */
      }
    }
  }

  function setAppLang(lang) {
    state.appLang = lang === 'zh' ? 'zh' : 'en';
    if (synth) {
      try {
        synth.cancel();
      } catch (_) {
        /* ignore */
      }
      state.voices = synth.getVoices() || state.voices;
    }
    applyManualThenAuto();
    if (state.onVoicesChanged) {
      try {
        state.onVoicesChanged(getCastInfo());
      } catch (_) {
        /* ignore */
      }
    }
  }

  function stop() {
    jobId += 1; // cancel pending async speak
    activeJob = null;
    state.speaking = false;
    if (!synth) return;
    try {
      synth.cancel();
    } catch (_) {
      /* ignore */
    }
  }

  function resolvePitchRate(role, emotion = 'calm') {
    const profile = profiles()[role] || profiles().guest;
    const mp = manualPitchMap();
    const mr = manualRateMap();
    let pitch = typeof mp[role] === 'number' ? mp[role] : profile.pitch;
    let rate = typeof mr[role] === 'number' ? mr[role] : profile.rate;

    switch (emotion) {
      case 'angry':
        pitch += 0.04;
        rate += 0.05;
        break;
      case 'tense':
        rate += 0.03;
        pitch += 0.02;
        break;
      case 'thoughtful':
        rate -= 0.04;
        pitch -= 0.02;
        break;
      case 'hopeful':
        pitch += 0.02;
        break;
      default:
        break;
    }

    // Hard clamp — outside this range many engines go silent
    pitch = Math.max(0.85, Math.min(1.15, pitch));
    rate = Math.max(0.7, Math.min(1.25, rate));
    const volume = Math.max(0.2, Math.min(1, profile.volume * state.volume));
    return { pitch, rate, volume };
  }

  function pickVoice(role) {
    let v = state.assigned[role];
    if (v && matchesAppLang(v, state.appLang)) return v;
    const pool = langPool();
    if (!pool.length) return null;
    const profile = profiles()[role] || profiles().guest;
    const used = new Set();
    pool.sort(
      (a, b) =>
        scoreVoice(b, profile, used, state.appLang) - scoreVoice(a, profile, used, state.appLang)
    );
    return pool[0] || null;
  }

  /**
   * Speak one utterance; waits for engine idle after cancel (fixes Chrome EN silence).
   */
  async function speak(role, text, emotion = 'calm') {
    const cleaned = cleanSpeechText(text, state.appLang);
    const { pitch, rate, volume } = resolvePitchRate(role, emotion);
    const estimated = estimateSpeechSeconds(cleaned, rate, state.appLang);

    if (!state.enabled || !synth || !cleaned) {
      return { ok: false, estimated };
    }

    unlock();
    const myId = ++jobId;
    activeJob = { id: myId };

    // Cancel previous utterance. Only wait for idle when something is actually queued —
    // a long await on a cold start can drop Chrome's user-gesture activation for first speech.
    const busy = !!(synth.speaking || synth.pending);
    try {
      synth.cancel();
    } catch (_) {
      /* ignore */
    }
    if (busy) {
      await waitForSynthIdle(synth, 1200);
    } else {
      await wait(0);
    }
    if (myId !== jobId) return { ok: false, estimated };

    // Refresh voices if needed (EN list often empty until user gesture)
    if (!state.voices.length || !langPool().length) {
      state.voices = synth.getVoices() || [];
      applyManualThenAuto();
    }

    const runOnce = (useVoice, forceLang) =>
      new Promise((resolve) => {
        if (myId !== jobId) {
          resolve(false);
          return;
        }
        const u = new SpeechSynthesisUtterance(cleaned);
        u.pitch = pitch;
        u.rate = rate;
        u.volume = volume;

        if (useVoice) {
          u.voice = useVoice;
          u.lang = useVoice.lang || forceLang || speechLangCode(state.appLang);
        } else {
          u.lang = forceLang || speechLangCode(state.appLang);
        }

        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          if (myId === jobId) state.speaking = false;
          resolve(ok);
        };

        u.onstart = () => {
          if (myId === jobId) {
            state.speaking = true;
            if (state.onStart) state.onStart(role);
          }
        };
        u.onend = () => finish(true);
        u.onerror = (ev) => {
          // interrupted is normal when advancing lines
          if (ev && (ev.error === 'interrupted' || ev.error === 'canceled')) {
            finish(false);
            return;
          }
          if (state.onError) state.onError(ev);
          finish(false);
        };

        try {
          if (synth.paused) synth.resume();
          synth.speak(u);
          // If never starts within 800ms, treat as failure
          setTimeout(() => {
            if (!settled && myId === jobId && !synth.speaking && !synth.pending) {
              finish(false);
            }
          }, 800);
          // Absolute cap
          setTimeout(() => {
            if (!settled) finish(false);
          }, estimated * 1000 + 6000);
        } catch (err) {
          if (state.onError) state.onError(err);
          finish(false);
        }
      });

    // Attempt 1: preferred role voice
    let voice = pickVoice(role);
    let ok = await runOnce(voice, speechLangCode(state.appLang));
    if (myId !== jobId) return { ok: false, estimated };

    // Attempt 2: any same-language voice, pitch=1 (max compatibility)
    if (!ok) {
      await waitForSynthIdle(synth, 800);
      if (myId !== jobId) return { ok: false, estimated };
      const any = langPool()[0] || null;
      // temporarily neutralize pitch
      const prevPitch = pitch;
      ok = await new Promise(async (resolve) => {
        // inline simpler second try with pitch 1
        const u = new SpeechSynthesisUtterance(cleaned);
        u.pitch = 1;
        u.rate = Math.min(1.1, Math.max(0.85, rate));
        u.volume = volume;
        if (any) {
          u.voice = any;
          u.lang = any.lang || speechLangCode(state.appLang);
        } else {
          u.lang = speechLangCode(state.appLang);
        }
        let settled = false;
        const finish = (v) => {
          if (settled) return;
          settled = true;
          resolve(v);
        };
        u.onend = () => finish(true);
        u.onerror = () => finish(false);
        try {
          if (synth.paused) synth.resume();
          synth.speak(u);
          setTimeout(() => {
            if (!settled && !synth.speaking) finish(false);
          }, 1000);
          setTimeout(() => finish(false), estimated * 1000 + 5000);
        } catch (_) {
          finish(false);
        }
        void prevPitch;
      });
    }

    if (myId === jobId && state.onEnd) state.onEnd(role, ok);
    return { ok, estimated };
  }

  function preview(role, text) {
    const pack = PREVIEW_LINES[state.appLang] || PREVIEW_LINES.en;
    const sample = text || pack[role] || pack.narrator;
    unlock();
    return speak(role, sample, 'calm');
  }

  function setRoleVoice(role, voiceURI) {
    const uris = manualUriMap();
    if (voiceURI) uris[role] = voiceURI;
    else delete uris[role];
    applyManualThenAuto();
    persist();
    if (state.onVoicesChanged) state.onVoicesChanged(getCastInfo());
  }

  function setRolePitch(role, pitch) {
    // Clamp to safe range in UI too
    manualPitchMap()[role] = Math.max(0.85, Math.min(1.15, Number(pitch)));
    persist();
  }

  function setRoleRate(role, rate) {
    manualRateMap()[role] = Math.max(0.7, Math.min(1.25, Number(rate)));
    persist();
  }

  function resetCast() {
    state.manualUriByLang[state.appLang] = {};
    state.manualPitchByLang[state.appLang] = {};
    state.manualRateByLang[state.appLang] = {};
    applyManualThenAuto();
    persist();
    if (state.onVoicesChanged) state.onVoicesChanged(getCastInfo());
  }

  function listVoices({ langFilter = null } = {}) {
    const filter = langFilter || state.appLang;
    return state.voices
      .filter((v) => matchesAppLang(v, filter === 'zh' ? 'zh' : 'en'))
      .map((v) => ({
        name: v.name,
        lang: v.lang,
        voiceURI: v.voiceURI,
        localService: !!v.localService,
        default: !!v.default,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, filter === 'zh' ? 'zh' : 'en'));
  }

  function getCastInfo() {
    const roles = ['philosopher', 'youth', 'narrator'];
    const cast = {};
    const pack = profiles();
    const uris = manualUriMap();
    const mp = manualPitchMap();
    const mr = manualRateMap();
    for (const role of roles) {
      const v = state.assigned[role];
      const profile = pack[role];
      cast[role] = {
        label: profile?.label || role,
        voiceURI: v?.voiceURI || null,
        voiceName: v?.name || null,
        lang: v?.lang || null,
        manual: !!uris[role],
        pitch: typeof mp[role] === 'number' ? mp[role] : profile?.pitch ?? 1,
        rate: typeof mr[role] === 'number' ? mr[role] : profile?.rate ?? 1,
        styleNote: profile?.styleNote || '',
      };
    }
    return {
      ready: state.ready,
      appLang: state.appLang,
      voiceCount: state.voices.length,
      filteredCount: listVoices().length,
      chineseCount: listVoices({ langFilter: 'zh' }).length,
      englishCount: listVoices({ langFilter: 'en' }).length,
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
      appLang: state.appLang,
      voices: listVoices(),
      assigned: Object.fromEntries(
        Object.entries(state.assigned).map(([k, v]) => [k, v ? v.name : null])
      ),
      cast: getCastInfo().cast,
    };
  }

  /**
   * Call from a real user gesture (click / key / touch).
   * Browsers block TTS until then; also refreshes the voice list (often empty before gesture).
   */
  function unlock() {
    if (!synth) return;
    const first = !state.unlocked;
    state.unlocked = true;
    try {
      if (synth.paused) synth.resume();
      state.voices = synth.getVoices() || state.voices;
      applyManualThenAuto();
    } catch (_) {
      /* ignore */
    }
    return first;
  }

  function registerRole() {
    /* reserved */
  }

  if (synth) {
    refreshVoices();
    speechSynthesis.onvoiceschanged = refreshVoices;
    setTimeout(refreshVoices, 200);
    setTimeout(refreshVoices, 800);
    setTimeout(refreshVoices, 2000);
  }

  return {
    speak,
    preview,
    stop,
    unlock,
    setEnabled,
    setVolume,
    setAppLang,
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
      return estimateSpeechSeconds(text, rate, state.appLang);
    },
    get profiles() {
      return profiles();
    },
    PREVIEW_LINES,
  };
}

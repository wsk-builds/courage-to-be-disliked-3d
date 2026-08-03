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

const STORAGE_KEY = 'courage-voice-cast-v2';

/** Chinese system-voice casting heuristics */
const PROFILES_ZH = {
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

/**
 * English casting: distinct personas for native-like delivery.
 * Philosopher: older, measured (David/James/George/Male low pitch)
 * Youth: brighter, quicker (Guy/Mark/higher male — avoid same as philosopher)
 * Narrator: clear, documentary (female Zira/Susan/Jenny or calm male)
 */
const PROFILES_EN = {
  narrator: {
    label: 'Narrator',
    pitch: 0.98,
    rate: 0.94,
    volume: 0.9,
    preferName: ['zira', 'susan', 'jenny', 'aria', 'sara', 'female', 'samantha', 'moira', 'victoria'],
    avoidName: ['david', 'mark', 'george', 'ravi'],
    gender: 'female',
    styleNote: 'Calm documentary narrator — clear, unhurried',
  },
  philosopher: {
    label: 'Philosopher',
    pitch: 0.78,
    rate: 0.84,
    volume: 1.0,
    preferName: ['david', 'george', 'james', 'daniel', 'richard', 'male', 'alex', 'ryan'],
    avoidName: ['zira', 'susan', 'jenny', 'aria'],
    gender: 'male',
    styleNote: 'Older scholar — low, slow, deliberate pauses',
  },
  youth: {
    label: 'Youth',
    pitch: 1.14,
    rate: 1.08,
    volume: 1.0,
    preferName: ['mark', 'guy', 'justin', 'steffan', 'sam', 'male'],
    avoidName: ['david', 'george', 'zira', 'susan'],
    gender: 'male',
    styleNote: 'Restless young man — brighter, quicker, edged',
  },
  guest: {
    label: 'Guest',
    pitch: 1.0,
    rate: 1.0,
    volume: 0.95,
    preferName: [],
    avoidName: [],
    gender: 'any',
    styleNote: 'Neutral default',
  },
};

/** @type {Record<string, VoiceProfile>} */
export let VOICE_PROFILES = { ...PROFILES_EN };

/** Sample lines for audition */
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

/** True if this system voice should be used for the app language */
function matchesAppLang(voice, appLang) {
  if (!voice) return false;
  const blob = `${voice.name} ${voice.lang}`.toLowerCase();
  if (appLang === 'zh') {
    return (
      /^zh\b/i.test(voice.lang) ||
      /zh[-_]/i.test(voice.lang) ||
      /chinese|中文|中国|hong kong|taiwan|cantonese|mandarin/i.test(blob)
    );
  }
  // English: require clear English signal — never treat Chinese voices as EN
  if (/zh|chinese|中文|中国|hong kong|taiwan|japan|korea|deutsch|france|espa/i.test(blob) && !/en[-_]|english/i.test(blob)) {
    return false;
  }
  return (
    /^en\b/i.test(voice.lang) ||
    /en[-_]/i.test(voice.lang) ||
    /english|united states|united kingdom|great britain|australia|ireland|canada|new zealand|india/i.test(blob)
  );
}

export function cleanSpeechText(text, lang = 'en') {
  if (!text) return '';
  let s = String(text)
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[—–]/g, lang === 'zh' ? '，' : ', ')
    .replace(/…+/g, lang === 'zh' ? '。' : '...')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

export function estimateSpeechSeconds(text, rate = 1) {
  const t = cleanSpeechText(text);
  const chars = t.replace(/\s/g, '').length;
  return Math.max(1.2, (chars / 3.8) / Math.max(0.5, rate) + 0.45);
}

function scoreVoice(voice, profile, usedVoiceURIs, appLang = 'en') {
  const name = `${voice.name} ${voice.lang}`.toLowerCase();
  let score = 0;
  if (appLang === 'zh') {
    if (/^zh(-|_)/i.test(voice.lang) || /chinese|中文|中国/i.test(name)) score += 50;
    else if (/zh/i.test(voice.lang)) score += 40;
    else score -= 20;
  } else {
    if (/^en(-|_)/i.test(voice.lang) || /english|united states|united kingdom|australia|ireland|india/i.test(name))
      score += 50;
    else if (/en/i.test(voice.lang)) score += 40;
    else score -= 25;
  }

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

export function createVoiceDirector(options = {}) {
  const saved = loadSavedCast();
  const state = {
    enabled: options.enabled !== false,
    unlocked: false,
    volume: options.volume ?? 1,
    /** app content language drives TTS language + voice heuristics */
    appLang: options.appLang === 'zh' ? 'zh' : 'en',
    voices: [],
    /** @type {Record<string, SpeechSynthesisVoice|null>} */
    assigned: {},
    /** manual overrides per language: { en: { philosopher: uri }, zh: {...} } */
    /** @type {Record<string, Record<string, string>>} */
    manualUriByLang: saved.urisByLang || { en: { ...(saved.uris || {}) }, zh: {} },
    /** @type {Record<string, Record<string, number>>} */
    manualPitchByLang: saved.pitchByLang || { en: { ...(saved.pitch || {}) }, zh: {} },
    /** @type {Record<string, Record<string, number>>} */
    manualRateByLang: saved.rateByLang || { en: { ...(saved.rate || {}) }, zh: {} },
    current: null,
    speaking: false,
    onStart: options.onStart || null,
    onEnd: options.onEnd || null,
    onError: options.onError || null,
    onVoicesChanged: options.onVoicesChanged || null,
    ready: false,
  };

  function profiles() {
    return state.appLang === 'zh' ? PROFILES_ZH : PROFILES_EN;
  }
  function manualUri() {
    if (!state.manualUriByLang[state.appLang]) state.manualUriByLang[state.appLang] = {};
    return state.manualUriByLang[state.appLang];
  }
  function manualPitch() {
    if (!state.manualPitchByLang[state.appLang]) state.manualPitchByLang[state.appLang] = {};
    return state.manualPitchByLang[state.appLang];
  }
  function manualRate() {
    if (!state.manualRateByLang[state.appLang]) state.manualRateByLang[state.appLang] = {};
    return state.manualRateByLang[state.appLang];
  }

  VOICE_PROFILES = { ...profiles() };

  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

  function persist() {
    saveCast({
      urisByLang: state.manualUriByLang,
      pitchByLang: state.manualPitchByLang,
      rateByLang: state.manualRateByLang,
    });
  }

  function applyManualThenAuto() {
    VOICE_PROFILES = { ...profiles() };
    const used = new Set();
    const roles = ['philosopher', 'youth', 'narrator'];
    const uris = manualUri();
    const pool = state.voices.filter((v) => matchesAppLang(v, state.appLang));

    for (const role of roles) {
      const uri = uris[role];
      if (uri) {
        const v = state.voices.find((x) => x.voiceURI === uri) || null;
        // Drop manual pick if it doesn't match current language (avoids silent EN with ZH voice)
        if (v && matchesAppLang(v, state.appLang)) {
          state.assigned[role] = v;
          used.add(v.voiceURI);
        } else {
          state.assigned[role] = null;
        }
      } else {
        state.assigned[role] = null;
      }
    }

    for (const role of roles) {
      if (state.assigned[role]) continue;
      const profile = VOICE_PROFILES[role] || VOICE_PROFILES.guest;
      const ranked = [...pool]
        .map((v) => ({ v, s: scoreVoice(v, profile, used, state.appLang) }))
        .sort((a, b) => b.s - a.s);
      const best = ranked[0]?.v || null;
      // Only assign if score is not terrible (must be same language pool already)
      state.assigned[role] = best;
      if (best) used.add(best.voiceURI);
    }
  }

  function setAppLang(lang) {
    state.appLang = lang === 'zh' ? 'zh' : 'en';
    // Re-fetch voices (Chrome often populates late / after lang change)
    if (synth) state.voices = synth.getVoices() || state.voices;
    applyManualThenAuto();
    if (state.onVoicesChanged) state.onVoicesChanged(getCastInfo());
  }

  function refreshVoices() {
    if (!synth) return;
    state.voices = synth.getVoices() || [];
    applyManualThenAuto();
    state.ready = state.voices.length > 0;
    if (state.onVoicesChanged) state.onVoicesChanged(getCastInfo());
  }

  function registerRole(role, profile) {
    const pack = profiles();
    pack[role] = { ...pack.guest, ...profile, label: profile.label || role };
    VOICE_PROFILES = { ...pack };
    if (state.voices.length) applyManualThenAuto();
  }

  let speakGeneration = 0;

  function unlock() {
    if (state.unlocked || !synth) return;
    state.unlocked = true;
    // Do NOT cancel here — cancel+immediate speak is a known Chrome silent-fail.
    try {
      if (synth.paused) synth.resume();
    } catch (_) {
      /* ignore */
    }
  }

  function stop() {
    if (!synth) return;
    speakGeneration += 1; // invalidate in-flight delayed speaks
    try {
      synth.cancel();
    } catch (_) {
      /* ignore */
    }
    state.speaking = false;
    state.current = null;
  }

  function pickVoiceForRole(role) {
    let v = state.assigned[role] || null;
    if (v && !matchesAppLang(v, state.appLang)) v = null;
    if (!v) {
      const pool = state.voices.filter((x) => matchesAppLang(x, state.appLang));
      const profile = profiles()[role] || profiles().guest;
      const used = new Set(
        Object.values(state.assigned)
          .filter(Boolean)
          .map((x) => x.voiceURI)
      );
      pool.sort(
        (a, b) =>
          scoreVoice(b, profile, used, state.appLang) - scoreVoice(a, profile, used, state.appLang)
      );
      v = pool[0] || null;
    }
    // Absolute fallback: any voice matching language
    if (!v) {
      v = state.voices.find((x) => matchesAppLang(x, state.appLang)) || null;
    }
    return v;
  }

  function queueUtterance(cleaned, role, pitch, rate, volume, estimated, allowRetry) {
    const gen = speakGeneration;
    return new Promise((resolve) => {
      // Chrome: must wait after cancel() or speak() is dropped with no error
      window.setTimeout(() => {
        if (gen !== speakGeneration || !synth) {
          resolve({ ok: false, estimated });
          return;
        }

        // Refresh voice list if empty (common on first English speak)
        if (!state.voices.length) {
          state.voices = synth.getVoices() || [];
          applyManualThenAuto();
        }

        const u = new SpeechSynthesisUtterance(cleaned);
        const picked = pickVoiceForRole(role);
        // Prefer the voice's own BCP-47 tag so Windows SAPI actually speaks
        u.lang = (picked && picked.lang) || speechLangCode(state.appLang);
        u.pitch = pitch;
        u.rate = rate;
        u.volume = volume;
        if (picked) u.voice = picked;

        state.current = u;
        state.speaking = true;

        let settled = false;
        const done = (ok) => {
          if (settled) return;
          settled = true;
          if (state.current === u) {
            state.speaking = false;
            state.current = null;
          }
          if (state.onEnd) state.onEnd(role, ok);
          resolve({ ok, estimated });
        };

        u.onstart = () => {
          if (state.onStart) state.onStart(role);
        };
        u.onend = () => done(true);
        u.onerror = (ev) => {
          // Retry once without a bound voice (fixes bad cross-lang / dead voiceURI)
          if (allowRetry && gen === speakGeneration) {
            try {
              synth.cancel();
            } catch (_) {
              /* ignore */
            }
            window.setTimeout(() => {
              if (gen !== speakGeneration) {
                done(false);
                return;
              }
              const retry = new SpeechSynthesisUtterance(cleaned);
              retry.lang = speechLangCode(state.appLang);
              retry.pitch = pitch;
              retry.rate = rate;
              retry.volume = volume;
              // try any EN/ZH voice again by lang only
              const any = state.voices.find((x) => matchesAppLang(x, state.appLang));
              if (any) {
                retry.voice = any;
                if (any.lang) retry.lang = any.lang;
              }
              state.current = retry;
              retry.onend = () => done(true);
              retry.onerror = () => {
                if (state.onError) state.onError(ev);
                done(false);
              };
              try {
                if (synth.paused) synth.resume();
                synth.speak(retry);
              } catch (err) {
                if (state.onError) state.onError(err);
                done(false);
              }
            }, 80);
            return;
          }
          if (state.onError) state.onError(ev);
          done(false);
        };

        try {
          if (synth.paused) synth.resume();
          synth.speak(u);
          // Watchdog: if engine never starts (Chrome bug), force retry path
          window.setTimeout(() => {
            if (settled || gen !== speakGeneration) return;
            if (state.current === u && !synth.speaking && !synth.pending) {
              // never started — trigger error retry
              try {
                u.onerror?.({ error: 'not-started' });
              } catch (_) {
                done(false);
              }
            }
          }, 600);
          window.setTimeout(() => {
            if (state.current === u) done(false);
          }, estimated * 1000 + 5000);
        } catch (err) {
          if (state.onError) state.onError(err);
          done(false);
        }
      }, 70);
    });
  }

  function resolvePitchRate(role, emotion = 'calm') {
    const profile = profiles()[role] || profiles().guest;
    const mp = manualPitch();
    const mr = manualRate();
    let pitch = typeof mp[role] === 'number' ? mp[role] : profile.pitch;
    let rate = typeof mr[role] === 'number' ? mr[role] : profile.rate;

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
    const cleaned = cleanSpeechText(text, state.appLang);
    const { pitch, rate, volume } = resolvePitchRate(role, emotion);
    // English duration: count words roughly; Chinese uses chars
    const estimated =
      state.appLang === 'en'
        ? Math.max(1.2, (cleaned.split(/\s+/).filter(Boolean).length / 2.4) / Math.max(0.5, rate) + 0.4)
        : estimateSpeechSeconds(cleaned, rate);

    if (!state.enabled || !synth || !cleaned) {
      return Promise.resolve({ ok: false, estimated });
    }

    unlock();
    // stop() cancels; queueUtterance waits before speak (Chrome silent-fail fix)
    stop();
    return queueUtterance(cleaned, role, pitch, rate, volume, estimated, true);
  }

  /** Preview without affecting story timer much */
  function preview(role, text) {
    const pack = PREVIEW_LINES[state.appLang] || PREVIEW_LINES.en;
    const sample = text || pack[role] || pack.narrator;
    unlock();
    return speak(role, sample, 'calm');
  }

  /**
   * Manually assign a system voice to a role (for current app language).
   * @param {string} role
   * @param {string|null} voiceURI  null = back to auto
   */
  function setRoleVoice(role, voiceURI) {
    const uris = manualUri();
    if (voiceURI) uris[role] = voiceURI;
    else delete uris[role];
    applyManualThenAuto();
    persist();
    if (state.onVoicesChanged) state.onVoicesChanged(getCastInfo());
  }

  function setRolePitch(role, pitch) {
    manualPitch()[role] = Math.max(0.5, Math.min(1.5, Number(pitch)));
    persist();
  }

  function setRoleRate(role, rate) {
    manualRate()[role] = Math.max(0.6, Math.min(1.4, Number(rate)));
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
    let list = state.voices.filter((v) => matchesAppLang(v, filter === 'zh' ? 'zh' : 'en'));
    // Keep list language-pure for casting UI; if empty, show empty so user knows to install packs
    return list
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
    const uris = manualUri();
    const mp = manualPitch();
    const mr = manualRate();
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
    const filtered = listVoices();
    return {
      ready: state.ready,
      appLang: state.appLang,
      voiceCount: state.voices.length,
      filteredCount: filtered.length,
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
      return estimateSpeechSeconds(text, rate);
    },
    get profiles() {
      return profiles();
    },
    PREVIEW_LINES,
  };
}

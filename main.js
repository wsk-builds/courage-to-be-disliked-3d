import * as THREE from 'three';
import { createWorld } from './world.js';
import { createPhilosopher, createYouth } from './characters.js';
import {
  LINES,
  CHAPTERS,
  PART_BOUNDARIES,
  getSegmentForLine,
  getPartForLine,
  findPartStart,
} from './story.js';
import { createVoiceDirector } from './voice.js';
import {
  getLang,
  setLang,
  ui,
  lineText,
  partTitle,
  segmentName,
  registerEnglishLookups,
} from './i18n/locale.js';
import {
  getEnLine,
  getEnPartTitle,
  getEnSegmentName,
} from './content/i18n/en/index.js';

registerEnglishLookups({
  getLine: getEnLine,
  getPartTitle: getEnPartTitle,
  getSegmentName: getEnSegmentName,
});

// ——— DOM ———
const canvas = document.getElementById('c');
const loadingEl = document.getElementById('loading');
const loadingFill = document.getElementById('loading-fill');
const loadingHint = document.getElementById('loading-hint');
const loadingError = document.getElementById('loading-error');
const uiEl = document.getElementById('ui');
const speakerEl = document.getElementById('speaker');
const dialogueEl = document.getElementById('dialogue-text');
const progressFill = document.getElementById('dialogue-progress-fill');
const lineCounter = document.getElementById('line-counter');
const btnPlay = document.getElementById('btn-play');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnVoice = document.getElementById('btn-voice');
const btnCast = document.getElementById('btn-cast');
const castPanel = document.getElementById('cast-panel');
const castRows = document.getElementById('cast-rows');
const castStatus = document.getElementById('cast-status');
const castTitle = document.getElementById('cast-title');
const castTip = document.getElementById('cast-tip');
const castClose = document.getElementById('cast-close');
const castRefresh = document.getElementById('cast-refresh');
const castReset = document.getElementById('cast-reset');
const voiceVolume = document.getElementById('voice-volume');
const btnLangEn = document.getElementById('btn-lang-en');
const btnLangZh = document.getElementById('btn-lang-zh');
const loadingTitle = document.getElementById('loading-title');
const loadingSubtitle = document.getElementById('loading-subtitle');
const navToggleLabel = document.getElementById('nav-toggle-label');
const navTitleEl = document.getElementById('nav-title');
const navPartsLabel = document.getElementById('nav-parts-label');
const navSegsLabel = document.getElementById('nav-segs-label');
const navHintEl = document.getElementById('nav-hint');
const helpTitleEl = document.getElementById('help-title');
const helpListEl = document.getElementById('help-list');
const footerNote = document.getElementById('footer-note');
const chapterRail = document.getElementById('chapter-rail');
const partRail = document.getElementById('part-rail');
const brandPart = document.getElementById('brand-part');
const minimapLabel = document.getElementById('minimap-label');
const storyNav = document.getElementById('story-nav');
const navToggle = document.getElementById('nav-toggle');
const navCollapse = document.getElementById('nav-collapse');
const helpPanel = document.getElementById('help-panel');
const btnHelp = document.getElementById('btn-help');

function setLoad(p, hint) {
  if (loadingFill) loadingFill.style.width = `${Math.floor(p * 100)}%`;
  if (hint && loadingHint) loadingHint.textContent = hint;
}

function showBootError(err) {
  console.error(err);
  if (loadingHint) loadingHint.textContent = ui('bootFail');
  if (loadingError) {
    loadingError.hidden = false;
    loadingError.textContent =
      (err && (err.stack || err.message || String(err))) + ui('bootHint');
  }
}

window.addEventListener('unhandledrejection', (e) => showBootError(e.reason || e));
window.addEventListener('error', (e) => {
  if (e.error) showBootError(e.error);
});

// ——— Voice ———
const CAST_ROLES = ['philosopher', 'youth', 'narrator'];
const voice = createVoiceDirector({
  enabled: true,
  volume: 1,
  appLang: getLang(),
  onVoicesChanged: () => {
    if (castPanel && !castPanel.hidden) renderCastPanel();
  },
});
let voiceGeneration = 0;
let currentLineDuration = 6;

// Story state must be declared before applyLocale() (called early on boot)
let lineIndex = 0;
let lineTime = 0;
let playing = false;
let typewriterLen = 0;
let displayedText = '';
let youthEntered = false;
let youthSeated = false;
let lastNightPhase = null;

function unlockAudio() {
  voice.unlock();
}

function speakCurrentLine() {
  const line = LINES[lineIndex];
  if (!line) return;
  const gen = ++voiceGeneration;
  const text = lineText(line);
  const est = voice.estimateSpeechSeconds(line.speaker, text);
  const hold = typeof line.hold === 'number' ? line.hold : 0;
  currentLineDuration = Math.max(line.duration || 5, est) + hold;
  if (!playing) {
    voice.stop();
    return;
  }
  voice.speak(line.speaker, text, line.emotion || 'calm').then(() => {
    void gen;
  });
}

function updateVoiceButton() {
  if (!btnVoice) return;
  const on = voice.getStatus().enabled;
  btnVoice.textContent = on ? ui('voiceOn') : ui('voiceOff');
  btnVoice.classList.toggle('off', !on);
  btnVoice.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function applyLocale() {
  const lang = getLang();
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = ui('docTitle');
  if (loadingTitle) loadingTitle.textContent = ui('loadingTitle');
  if (loadingSubtitle) loadingSubtitle.textContent = ui('loadingSubtitle');
  if (loadingHint && !loadingEl?.classList.contains('fade-out')) {
    loadingHint.textContent = ui('loadingHint');
  }
  if (btnCast) btnCast.textContent = ui('cast');
  if (castTitle) castTitle.textContent = ui('castTitle');
  if (castTip) castTip.innerHTML = ui('castTip');
  if (castRefresh) castRefresh.textContent = ui('castRefresh');
  if (castReset) castReset.textContent = ui('castReset');
  if (navToggleLabel) navToggleLabel.textContent = ui('navLabel');
  if (navTitleEl) navTitleEl.textContent = ui('navTitle');
  if (navPartsLabel) navPartsLabel.textContent = ui('navParts');
  if (navSegsLabel) navSegsLabel.textContent = ui('navSegments');
  if (navHintEl) navHintEl.innerHTML = ui('navHint');
  if (helpTitleEl) helpTitleEl.textContent = ui('helpTitle');
  if (helpListEl) {
    const items = ui('helpItems') || [];
    helpListEl.innerHTML = items.map((html) => `<li>${html}</li>`).join('');
  }
  if (footerNote) footerNote.textContent = ui('footer');
  if (btnPrev) btnPrev.title = ui('prev');
  if (btnNext) btnNext.title = ui('next');
  if (btnPlay) btnPlay.title = ui('play');
  if (btnLangEn) btnLangEn.classList.toggle('active', lang === 'en');
  if (btnLangZh) btnLangZh.classList.toggle('active', lang === 'zh');

  voice.setAppLang(lang);
  updateVoiceButton();

  // Rails / dialogue only after story state exists and rails helpers are ready
  if (typeof buildPartRail === 'function') {
    buildPartRail();
    const partId = getPartForLine(lineIndex) || PART_BOUNDARIES[0]?.partId;
    if (partId && typeof buildSegmentRail === 'function') buildSegmentRail(partId);
    if (typeof refreshRailActive === 'function') refreshRailActive();
  }

  if (LINES[lineIndex]) {
    const line = LINES[lineIndex];
    if (speakerEl) {
      const labels = ui('speakers') || {};
      speakerEl.textContent = labels[line.speaker] || line.speaker;
    }
    if (dialogueEl) {
      const full = lineText(line);
      dialogueEl.textContent = full.slice(0, Math.floor(typewriterLen) || full.length);
    }
    if (typeof updateMinimap === 'function') updateMinimap(line);
  }
  if (castPanel && !castPanel.hidden) renderCastPanel();
}

function switchLanguage(lang) {
  if (lang !== 'en' && lang !== 'zh') return;
  if (lang === getLang()) return;
  unlockAudio();
  voice.stop();
  setLang(lang);
  applyLocale();
  // Let speechSynthesis settle after cancel + voice rebind (Chrome EN silent-fail)
  if (playing) {
    window.setTimeout(() => {
      if (playing) speakCurrentLine();
    }, 180);
  }
}

function toggleVoice() {
  unlockAudio();
  voice.setEnabled(!voice.getStatus().enabled);
  updateVoiceButton();
  if (voice.getStatus().enabled && playing) speakCurrentLine();
  else voice.stop();
}

function setCastOpen(open) {
  if (!castPanel || !btnCast) return;
  castPanel.hidden = !open;
  btnCast.classList.toggle('off', false);
  if (open) {
    unlockAudio();
    // pause story speech so audition is clear
    voice.stop();
    renderCastPanel();
  }
}

function toggleCast() {
  if (!castPanel) return;
  setCastOpen(castPanel.hidden);
}

function renderCastPanel() {
  if (!castRows) return;
  const info = voice.getCastInfo();
  const voices = voice.listVoices();
  if (castStatus) {
    if (!info.ready) {
      castStatus.textContent =
        getLang() === 'zh' ? '正在加载系统音色…' : 'Loading system voices…';
    } else if (voices.length === 0) {
      castStatus.textContent =
        getLang() === 'zh'
          ? `未找到${info.appLang === 'en' ? '英文' : '中文'}系统音色。请在 Windows「设置 → 时间和语言 → 语音」中安装语音包后点刷新。`
          : `No ${info.appLang === 'en' ? 'English' : 'Chinese'} system voices found. Install a speech pack (Windows: Settings → Time & language → Speech), then Refresh.`;
    } else {
      castStatus.textContent =
        getLang() === 'zh'
          ? `系统音色 ${info.voiceCount} 个 · 当前语言可用 ${voices.length} 个（${info.appLang}）`
          : `System voices: ${info.voiceCount} · ${voices.length} for ${info.appLang}`;
    }
  }

  castRows.innerHTML = '';
  for (const role of CAST_ROLES) {
    const c = info.cast[role];
    const row = document.createElement('div');
    row.className = 'cast-row';
    row.dataset.role = role;

    const head = document.createElement('div');
    head.className = 'cast-row-head';
    const tag = c.manual ? ui('castManual') : ui('castAutoTag');
    head.innerHTML = `<span class="cast-role">${c.label}</span><span class="cast-note">${c.styleNote || ''}${tag}</span>`;
    row.appendChild(head);

    const sel = document.createElement('select');
    sel.dataset.role = role;
    const autoOpt = document.createElement('option');
    autoOpt.value = '';
    autoOpt.textContent = ui('castAuto');
    sel.appendChild(autoOpt);

    for (const v of voices) {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.textContent = `${v.name}  [${v.lang}]${v.localService ? '' : ui('castCloud')}`;
      sel.appendChild(opt);
    }

    if (c.voiceURI && ![...sel.options].some((o) => o.value === c.voiceURI)) {
      const opt = document.createElement('option');
      opt.value = c.voiceURI;
      opt.textContent = `${c.voiceName || c.voiceURI}  [${c.lang || '?'}]`;
      sel.appendChild(opt);
    }
    if (c.voiceURI) sel.value = c.voiceURI;

    sel.addEventListener('change', () => {
      unlockAudio();
      if (sel.selectedIndex === 0) voice.setRoleVoice(role, null);
      else voice.setRoleVoice(role, sel.value);
      renderCastPanel();
    });
    row.appendChild(sel);

    const sliders = document.createElement('div');
    sliders.className = 'cast-sliders';

    const pitchLab = document.createElement('label');
    pitchLab.className = 'cast-slider-label';
    pitchLab.innerHTML = `<span>${ui('castPitch')} ${c.pitch.toFixed(2)}</span>`;
    const pitchIn = document.createElement('input');
    pitchIn.type = 'range';
    pitchIn.min = '0.85';
    pitchIn.max = '1.15';
    pitchIn.step = '0.01';
    pitchIn.value = String(c.pitch);
    pitchIn.addEventListener('input', () => {
      voice.setRolePitch(role, pitchIn.value);
      pitchLab.querySelector('span').textContent = `${ui('castPitch')} ${Number(pitchIn.value).toFixed(2)}`;
    });
    pitchLab.appendChild(pitchIn);

    const rateLab = document.createElement('label');
    rateLab.className = 'cast-slider-label';
    rateLab.innerHTML = `<span>${ui('castRate')} ${c.rate.toFixed(2)}</span>`;
    const rateIn = document.createElement('input');
    rateIn.type = 'range';
    rateIn.min = '0.7';
    rateIn.max = '1.25';
    rateIn.step = '0.01';
    rateIn.value = String(c.rate);
    rateIn.addEventListener('input', () => {
      voice.setRoleRate(role, rateIn.value);
      rateLab.querySelector('span').textContent = `${ui('castRate')} ${Number(rateIn.value).toFixed(2)}`;
    });
    rateLab.appendChild(rateIn);

    sliders.appendChild(pitchLab);
    sliders.appendChild(rateLab);
    row.appendChild(sliders);

    const actions = document.createElement('div');
    actions.className = 'cast-row-actions';
    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.textContent = ui('castPreview');
    previewBtn.addEventListener('click', () => {
      unlockAudio();
      voice.setEnabled(true);
      updateVoiceButton();
      voice.preview(role);
    });
    actions.appendChild(previewBtn);
    row.appendChild(actions);

    castRows.appendChild(row);
  }
}

// ——— Left directory + help ———
let railPartId = null;
const NAV_KEY = 'courage-nav-collapsed';

function shortPartTitle(title) {
  const s = String(title || '');
  if (getLang() === 'en') {
    return s
      .replace(/^Prologue\s*[·・]\s*/i, 'Prologue · ')
      .replace(/^Night One\s*[·・]\s*Part\s*1[:\s]*/i, 'N1 · ')
      .replace(/^Night One\s*[·・]\s*Part\s*2[:\s]*/i, 'N1b · ')
      .replace(/^Night Two\s*[·・]\s*Part\s*(One|1)[:\s]*/i, 'N2 · ')
      .replace(/^Night Two\s*[·・]\s*Part\s*(Two|2)[:\s]*/i, 'N2b · ')
      .replace(/^Night Three\s*[·・]\s*Part\s*(I|1)[:\s]*/i, 'N3 · ')
      .replace(/^Night Three\s*[·・]\s*Part\s*(II|2)[:\s]*/i, 'N3b · ')
      .replace(/^Night Four\s*[·・]\s*Part\s*1[:\s]*/i, 'N4 · ')
      .replace(/^Night Four\s*[·・]\s*Part\s*2[:\s]*/i, 'N4b · ')
      .replace(/^Night Five\s*[·・]\s*Part\s*1[:\s]*/i, 'N5 · ')
      .replace(/^Night Five\s*[·・]\s*Part\s*2[:\s]*/i, 'N5b · ');
  }
  return s
    .replace(/^序章\s*[·・]\s*/, '序章 · ')
    .replace(/第一夜\s*[·・]\s*上[：:]?\s*/, '一上 · ')
    .replace(/第一夜\s*[·・]\s*下[：:]?\s*/, '一下 · ')
    .replace(/第二夜\s*[·・]\s*上[：:]?\s*/, '二上 · ')
    .replace(/第二夜\s*[·・]\s*下[：:]?\s*/, '二下 · ')
    .replace(/第三夜\s*[·・]\s*上[：:]?\s*/, '三上 · ')
    .replace(/第三夜\s*[·・]\s*下[：:]?\s*/, '三下 · ')
    .replace(/第四夜\s*[·・]\s*上[：:]?\s*/, '四上 · ')
    .replace(/第四夜\s*[·・]\s*下[：:]?\s*/, '四下 · ')
    .replace(/第五夜\s*[·・]\s*上[：:]?\s*/, '五上 · ')
    .replace(/第五夜\s*[·・]\s*下[：:]?\s*/, '五下 · ');
}

function setNavCollapsed(collapsed) {
  if (!storyNav) return;
  storyNav.classList.toggle('collapsed', !!collapsed);
  try {
    localStorage.setItem(NAV_KEY, collapsed ? '1' : '0');
  } catch (_) {
    /* ignore */
  }
}

function toggleNav() {
  if (!storyNav) return;
  setNavCollapsed(!storyNav.classList.contains('collapsed'));
}

function setHelpOpen(open) {
  if (!helpPanel || !btnHelp) return;
  helpPanel.hidden = !open;
  btnHelp.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function toggleHelp() {
  if (!helpPanel) return;
  setHelpOpen(helpPanel.hidden);
}

function buildPartRail() {
  if (!partRail) return;
  partRail.innerHTML = '';
  for (const b of PART_BOUNDARIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'part-btn';
    btn.dataset.partId = b.partId;
    const full = partTitle(b.partId, b.title);
    btn.textContent = shortPartTitle(full);
    btn.title = full;
    btn.addEventListener('click', () => {
      unlockAudio();
      jumpToPart(b.partId);
    });
    partRail.appendChild(btn);
  }
}

function buildSegmentRail(partId) {
  if (!chapterRail) return;
  railPartId = partId;
  chapterRail.innerHTML = '';

  const segs = CHAPTERS.filter((c) => c.partId === partId);
  for (const c of segs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chapter';
    btn.dataset.chapter = String(c.id);
    btn.dataset.key = c.key;
    // c.name is "P0x ChineseName" from assemble — strip id, localize
    const zhSeg = String(c.name).replace(/^P0\d\s+/, '');
    const label = segmentName(partId, c.segmentId, zhSeg);
    btn.textContent = label;
    btn.title = label;
    btn.addEventListener('click', () => {
      unlockAudio();
      jumpToSegment(c.id);
    });
    chapterRail.appendChild(btn);
  }
}

function buildRails() {
  buildPartRail();
  const initialPart = getPartForLine(0) || PART_BOUNDARIES[0]?.partId || 'P00';
  buildSegmentRail(initialPart);

  // 默认收起目录，画面更干净；用户点「目录」或按 C 展开
  let collapsed = true;
  try {
    const saved = localStorage.getItem(NAV_KEY);
    if (saved === '0') collapsed = false;
    if (saved === '1') collapsed = true;
  } catch (_) {
    /* ignore */
  }
  setNavCollapsed(collapsed);

  if (navToggle) navToggle.addEventListener('click', toggleNav);
  if (navCollapse) navCollapse.addEventListener('click', () => setNavCollapsed(true));
  if (btnHelp) btnHelp.addEventListener('click', () => {
    unlockAudio();
    toggleHelp();
  });
}

function segmentsInCurrentPart() {
  const partId = getPartForLine(lineIndex);
  return CHAPTERS.filter((c) => c.partId === partId);
}

function refreshRailActive() {
  const seg = getSegmentForLine(lineIndex);
  const partId = getPartForLine(lineIndex);

  if (partId && partId !== railPartId) {
    buildSegmentRail(partId);
  }

  if (chapterRail) {
    chapterRail.querySelectorAll('.chapter').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.chapter) === seg);
    });
  }
  if (partRail) {
    partRail.querySelectorAll('.part-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.partId === partId);
    });
  }
  const boundary = PART_BOUNDARIES.find((p) => p.partId === partId);
  if (brandPart) {
    const base = ui('brandDefault');
    brandPart.textContent = boundary
      ? `${base} · ${partTitle(boundary.partId, boundary.title)}`
      : base;
  }
}

// ——— Renderer ———
setLoad(0.1, '初始化渲染器…');

let renderer;
let scene;
let camera;
let world;
let philosopher;
let youth;

try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(6, 2.8, 11);

  setLoad(0.35, '构筑古都郊外与书房…');
  world = createWorld(scene);

  setLoad(0.55, '请哲学家与青年入座…');
  philosopher = createPhilosopher();
  youth = createYouth();

  philosopher.root.position.set(
    world.anchors.philosopherSeat.x,
    0.15,
    world.anchors.philosopherSeat.z
  );
  philosopher.root.rotation.y = 0.55;
  philosopher.setSeated(true);
  philosopher.setEmotion('calm');
  scene.add(philosopher.root);

  youth.root.position.set(0.3, 0, 14);
  youth.root.rotation.y = Math.PI;
  youth.setSeated(false);
  youth.setEmotion('tense');
  scene.add(youth.root);
} catch (err) {
  showBootError(err);
  throw err;
}

buildRails();
applyLocale();

// ——— Controls ———
const keys = new Set();
const look = { yaw: 0.35, pitch: -0.12 };
let pointerLocked = false;
let followDialogue = true;
const wish = new THREE.Vector3();

const cameraMode = {
  targetPos: new THREE.Vector3(4, 2.2, 4),
  targetLook: new THREE.Vector3(0, 1.3, -1.2),
  lerp: 0.04,
};

/**
 * 镜头随辩论烈度与说话者变化，表达交锋程度与态度。
 * @param {string} cue
 * @param {{ intensity?: number, speaker?: string }} [opts]
 */
function setCameraCue(cue, opts = {}) {
  const intensity = Math.max(1, Math.min(5, opts.intensity || 2));
  const speaker = opts.speaker || 'narrator';
  // 烈度越高，机位越近、越稳跟说话者
  const push = (intensity - 1) * 0.22;

  switch (cue) {
    case 'exterior':
      cameraMode.targetPos.set(7.5 - push * 0.3, 3.2, 13 - push * 0.5);
      cameraMode.targetLook.set(0, 1.5, 2);
      cameraMode.lerp = 0.035;
      break;
    case 'door':
      cameraMode.targetPos.set(2.2, 1.9, 8.5 - push * 0.4);
      cameraMode.targetLook.set(0, 1.4, 3);
      cameraMode.lerp = 0.04;
      break;
    case 'study': {
      // 双人中景：烈度高时略推向正在说话的人
      let x = 3.2;
      let z = 2.2 - push * 0.35;
      let lookX = 0;
      if (speaker === 'youth') {
        x = 2.6 + push * 0.15;
        lookX = 0.55;
      } else if (speaker === 'philosopher') {
        x = 2.8;
        lookX = -0.55;
      }
      cameraMode.targetPos.set(x, 1.95 + (intensity >= 4 ? -0.05 : 0), z);
      cameraMode.targetLook.set(lookX, 1.28, -1.35);
      cameraMode.lerp = intensity >= 4 ? 0.055 : 0.04;
      break;
    }
    case 'closeup': {
      // 特写：对准说话者；击中/金句(intensity5)更近
      const near = 0.85 - push * 0.12;
      if (speaker === 'philosopher') {
        cameraMode.targetPos.set(-0.55, 1.48, near);
        cameraMode.targetLook.set(-1.05, 1.38, -1.55);
      } else if (speaker === 'youth') {
        cameraMode.targetPos.set(0.65, 1.48, near);
        cameraMode.targetLook.set(1.05, 1.38, -0.95);
      } else {
        cameraMode.targetPos.set(0.1, 1.55, 0.95 - push * 0.1);
        cameraMode.targetLook.set(0.15, 1.35, -1.2);
      }
      cameraMode.lerp = intensity >= 5 ? 0.07 : 0.05;
      break;
    }
    case 'snow':
      cameraMode.targetPos.set(3.8 - push * 0.2, 2.2, 10.5);
      cameraMode.targetLook.set(1.0, 1.15, 8.5);
      cameraMode.lerp = 0.03;
      break;
    case 'hold_empty':
      // 静默空镜：略抬，看烛火/房间
      cameraMode.targetPos.set(1.8, 2.1, 1.5);
      cameraMode.targetLook.set(0, 1.4, -1.3);
      cameraMode.lerp = 0.025;
      break;
    default:
      cameraMode.targetPos.set(3.2, 2.0, 2.2);
      cameraMode.targetLook.set(0, 1.25, -1.4);
      cameraMode.lerp = 0.04;
  }
}

/** 根据烈度调整角色身体语言（在 emotion/gesture 之上） */
function applyIntensityBody(line) {
  const intensity = line.intensity || 2;
  const speaker = line.speaker;
  // 青年：烈度高时更前倾攻击；哲人始终相对稳
  if (speaker === 'youth' && youthSeated) {
    if (intensity >= 4) {
      youth.setGesture(line.gesture || 'lean');
    } else if (intensity >= 3) {
      youth.setGesture(line.gesture || 'point');
    }
  }
  if (speaker === 'philosopher' && intensity >= 4) {
    // 施压时仍 open/think，不激动
    philosopher.setGesture(line.gesture || 'open');
  }
  // 听者反应：被逼问时青年可 tense
  if (speaker === 'philosopher' && intensity >= 4) {
    youth.setEmotion(line.emotion === 'hopeful' ? 'thoughtful' : 'tense');
  }
}

function updateMinimap(line) {
  if (!minimapLabel) return;
  const map = ui('minimap') || {};
  minimapLabel.textContent = map[line.camera] || map.exterior || '';
}

// ——— Story helpers ———
function seatYouthNow() {
  youth.stopWalk();
  youth.root.position.set(world.anchors.youthSeat.x, 0.15, world.anchors.youthSeat.z);
  youth.root.rotation.y = -0.7;
  youth.setSeated(true);
  youthSeated = true;
  youthEntered = true;
}

function resetYouthOutside() {
  youth.stopWalk();
  youth.setSeated(false);
  youth.root.position.set(0.3, 0, 14);
  youth.root.rotation.y = Math.PI;
  youthEntered = false;
  youthSeated = false;
}

function applyNightPhase(phase) {
  if (!phase || phase === lastNightPhase) return;
  lastNightPhase = phase;
  if (typeof world.setNightPhase === 'function') {
    world.setNightPhase(phase);
  } else if (phase === 'ending') {
    world.setSnowMode(true);
  } else {
    world.setSnowMode(false);
  }
}

function handleStageTriggers(line) {
  const stage = line.stage || '';
  const partId = line.partId;

  // Explicit stage cues
  if (stage === 'youth_approach') {
    youth.setSeated(false);
    youthSeated = false;
    youth.walkTo(0.2, 6.5);
  }
  if (stage === 'youth_enter') {
    youthEntered = true;
    youth.setSeated(false);
    youthSeated = false;
    youth.walkTo(world.anchors.youthSeat.x, world.anchors.youthSeat.z + 0.15);
  }
  if (stage === 'youth_seat' || stage === 'youth_seated' || stage === 'debate_ready') {
    seatYouthNow();
  }

  // Ending leave sequence (P10)
  if (stage === 'youth_rise') {
    youth.setSeated(false);
    youthSeated = false;
    youthEntered = true;
    youth.root.position.set(world.anchors.youthSeat.x, 0, world.anchors.youthSeat.z);
    youth.root.rotation.y = 0;
    youth.setGesture('open');
    youth.setEmotion(line.emotion || 'hopeful');
  }
  if (stage === 'youth_to_door') {
    youth.setSeated(false);
    youthSeated = false;
    youthEntered = true;
    youth.walkTo(0.15, 5.6);
    youth.setEmotion(line.emotion || 'hopeful');
  }
  if (stage === 'youth_snow') {
    youth.setSeated(false);
    youthSeated = false;
    youth.walkTo(1.2, 10.2);
    youth.setEmotion('hopeful');
    youth.setGesture('open');
  }

  // Part-level defaults: seated debate unless arrival/leave stages
  const leaveOrArrive =
    stage === 'youth_approach' ||
    stage === 'youth_enter' ||
    stage === 'youth_rise' ||
    stage === 'youth_to_door' ||
    stage === 'youth_snow';
  if (partId && partId !== 'P00' && !leaveOrArrive) {
    if (!youthSeated && line.camera !== 'exterior' && line.camera !== 'door' && line.camera !== 'snow') {
      seatYouthNow();
    }
  }

  // Camera-based fallbacks for prologue
  if (partId === 'P00') {
    if (line.camera === 'door' && !stage && !youthEntered) {
      youth.walkTo(0.2, 6.2);
    }
    if ((line.camera === 'study' || line.camera === 'closeup') && !youthSeated) {
      if (!youth.state.walking) seatYouthNow();
    }
  }
}

function showLine(index, resetTime = true) {
  lineIndex = Math.max(0, Math.min(LINES.length - 1, index));
  const line = LINES[lineIndex];
  if (resetTime) lineTime = 0;
  typewriterLen = 0;
  displayedText = '';
  dialogueEl.textContent = '';
  const labels = ui('speakers') || {};
  speakerEl.textContent = labels[line.speaker] || line.speaker;

  applyNightPhase(line.nightPhase || 'prologue');
  updateMinimap(line);

  philosopher.setSpeaking(false);
  youth.setSpeaking(false);

  if (line.speaker === 'philosopher') {
    philosopher.setSpeaking(true);
    philosopher.setEmotion(line.emotion || 'calm');
    philosopher.setGesture(line.gesture || 'open');
    youth.setEmotion(line.emotion === 'hopeful' ? 'thoughtful' : 'tense');
    youth.setGesture('idle');
  } else if (line.speaker === 'youth') {
    youth.setSpeaking(true);
    youth.setEmotion(line.emotion || 'tense');
    youth.setGesture(line.gesture || 'gesture');
    philosopher.setEmotion('calm');
    philosopher.setGesture(line.emotion === 'angry' ? 'think' : 'idle');
  } else {
    philosopher.setEmotion(line.emotion || 'calm');
    youth.setEmotion(line.emotion || 'tense');
    philosopher.setGesture('idle');
    youth.setGesture('idle');
  }

  applyIntensityBody(line);

  // 静默击中：无台词旁白可走空镜；有 hold 且 intensity>=4 时镜头略抬
  const cue = line.camera || 'study';
  if (line.speaker === 'narrator' && (line.hold || 0) >= 2 && (line.intensity || 0) >= 4) {
    setCameraCue('hold_empty', { intensity: line.intensity, speaker: 'narrator' });
  } else {
    setCameraCue(cue, { intensity: line.intensity || 2, speaker: line.speaker });
  }
  handleStageTriggers(line);

  progressFill.style.width = `${((lineIndex + 1) / LINES.length) * 100}%`;
  lineCounter.textContent = `${lineIndex + 1} / ${LINES.length}`;
  refreshRailActive();
  speakCurrentLine();
}

function nextLine() {
  if (lineIndex < LINES.length - 1) {
    showLine(lineIndex + 1);
  } else {
    playing = false;
    btnPlay.textContent = '▶';
    philosopher.setSpeaking(false);
    youth.setSpeaking(false);
    voice.stop();
  }
}

function prevLine() {
  showLine(Math.max(0, lineIndex - 1));
}

function prepareStagingForIndex(index) {
  const line = LINES[index];
  const partId = line?.partId;
  const stage = line?.stage || '';
  const cam = line?.camera || '';

  if (partId === 'P00') {
    const seg = line.segment ?? 0;
    if (
      seg >= 2 ||
      cam === 'study' ||
      cam === 'closeup' ||
      stage === 'youth_seated' ||
      stage === 'debate_ready' ||
      stage === 'youth_seat'
    ) {
      seatYouthNow();
    } else if (cam === 'door' || stage === 'youth_enter') {
      youthEntered = true;
      youth.setSeated(false);
      youthSeated = false;
      youth.root.position.set(0.2, 0, 5.5);
    } else {
      resetYouthOutside();
    }
  } else if (
    stage === 'youth_snow' ||
    cam === 'snow' ||
    (partId === 'P10' && (stage === 'youth_to_door' || stage === 'youth_rise'))
  ) {
    if (stage === 'youth_snow' || cam === 'snow') {
      youth.setSeated(false);
      youthSeated = false;
      youth.root.position.set(1.0, 0, 9.5);
      youth.root.rotation.y = 0;
    } else if (stage === 'youth_to_door') {
      youth.setSeated(false);
      youthSeated = false;
      youth.root.position.set(0.2, 0, 5.5);
    } else {
      youth.setSeated(false);
      youthSeated = false;
      youth.root.position.set(world.anchors.youthSeat.x, 0, world.anchors.youthSeat.z);
    }
  } else if (
    cam === 'exterior' ||
    cam === 'door' ||
    stage === 'youth_enter' ||
    stage === 'youth_approach'
  ) {
    // 各夜再访开头
    if (cam === 'exterior' || stage === 'youth_approach') {
      resetYouthOutside();
    } else {
      youthEntered = true;
      youth.setSeated(false);
      youthSeated = false;
      youth.root.position.set(0.2, 0, 5.5);
    }
  } else {
    seatYouthNow();
  }
  applyNightPhase(line?.nightPhase || 'prologue');
}

function jumpToSegment(chapterId) {
  const c = CHAPTERS.find((x) => x.id === chapterId);
  if (!c) return;
  prepareStagingForIndex(c.start);
  showLine(c.start);
}

function jumpToPart(partId) {
  const start = findPartStart(partId);
  prepareStagingForIndex(start);
  showLine(start);
}

function jumpPartDelta(delta) {
  const partId = getPartForLine(lineIndex);
  const idx = PART_BOUNDARIES.findIndex((p) => p.partId === partId);
  if (idx < 0) return;
  const next = PART_BOUNDARIES[idx + delta];
  if (next) jumpToPart(next.partId);
}

function togglePlay() {
  unlockAudio();
  playing = !playing;
  btnPlay.textContent = playing ? '❚❚' : '▶';
  if (!playing) {
    voice.stop();
    philosopher.setSpeaking(false);
    youth.setSpeaking(false);
    return;
  }
  if (lineIndex >= LINES.length - 1 && lineTime >= currentLineDuration) {
    resetYouthOutside();
    applyNightPhase('prologue');
    showLine(0);
  } else {
    const line = LINES[lineIndex];
    if (line.speaker === 'philosopher') philosopher.setSpeaking(true);
    if (line.speaker === 'youth') youth.setSpeaking(true);
    speakCurrentLine();
  }
}

// ——— Input ———
window.addEventListener('keydown', (e) => {
  unlockAudio();
  keys.add(e.code);
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
  }
  if (e.code === 'KeyM') {
    e.preventDefault();
    toggleVoice();
  }
  if (e.code === 'KeyV') {
    e.preventDefault();
    toggleCast();
  }
  if (e.code === 'KeyL') {
    e.preventDefault();
    switchLanguage(getLang() === 'en' ? 'zh' : 'en');
  }
  if (e.code === 'KeyC') {
    e.preventDefault();
    toggleNav();
  }
  if (e.code === 'KeyH' || e.key === '?' || e.key === '？') {
    e.preventDefault();
    toggleHelp();
  }
  if (e.code === 'Escape') {
    setHelpOpen(false);
    setCastOpen(false);
  }
  if (e.code === 'KeyR') {
    followDialogue = true;
    const ln = LINES[lineIndex];
    setCameraCue(ln?.camera || 'study', {
      intensity: ln?.intensity || 2,
      speaker: ln?.speaker,
    });
  }
  if (e.code === 'KeyF') {
    followDialogue = !followDialogue;
  }
  if (e.code === 'BracketLeft') {
    e.preventDefault();
    jumpPartDelta(-1);
  }
  if (e.code === 'BracketRight') {
    e.preventDefault();
    jumpPartDelta(1);
  }
  if (e.code >= 'Digit1' && e.code <= 'Digit9') {
    // 1–9：当前 Part 内的第 n 段（不再对应全书全部段落）
    const n = Number(e.code.replace('Digit', '')) - 1;
    const local = segmentsInCurrentPart();
    if (local[n]) jumpToSegment(local[n].id);
  }
  if (e.code === 'ArrowRight') nextLine();
  if (e.code === 'ArrowLeft') prevLine();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

['pointerdown', 'keydown', 'touchstart'].forEach((ev) => {
  window.addEventListener(ev, () => unlockAudio(), { once: true, capture: true });
});

canvas.addEventListener('click', () => {
  unlockAudio();
  canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (pointerLocked) followDialogue = false;
});

document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  look.yaw -= e.movementX * 0.0022;
  look.pitch -= e.movementY * 0.0022;
  look.pitch = Math.max(-1.45, Math.min(1.45, look.pitch));
});

// Mouse wheel: change altitude in free-explore mode (discoverable up/down)
canvas.addEventListener(
  'wheel',
  (e) => {
    if (followDialogue && !pointerLocked) return;
    e.preventDefault();
    // scroll up → rise, scroll down → lower
    camera.position.y += e.deltaY > 0 ? -0.55 : 0.55;
    clampFreeCameraY();
  },
  { passive: false },
);

btnPlay.addEventListener('click', togglePlay);
btnNext.addEventListener('click', () => {
  unlockAudio();
  nextLine();
});
btnPrev.addEventListener('click', () => {
  unlockAudio();
  prevLine();
});

if (btnVoice) {
  btnVoice.addEventListener('click', toggleVoice);
  updateVoiceButton();
}
if (btnLangEn) {
  btnLangEn.addEventListener('click', () => switchLanguage('en'));
}
if (btnLangZh) {
  btnLangZh.addEventListener('click', () => switchLanguage('zh'));
}
if (btnCast) {
  btnCast.addEventListener('click', () => {
    unlockAudio();
    toggleCast();
  });
}
if (castClose) {
  castClose.addEventListener('click', () => setCastOpen(false));
}
if (castRefresh) {
  castRefresh.addEventListener('click', () => {
    unlockAudio();
    // force voices reload
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
    // re-trigger via director
    voice.unlock();
    renderCastPanel();
  });
}
if (castReset) {
  castReset.addEventListener('click', () => {
    unlockAudio();
    voice.resetCast();
    renderCastPanel();
  });
}
if (voiceVolume) {
  voiceVolume.addEventListener('input', () => {
    unlockAudio();
    voice.setVolume(Number(voiceVolume.value) / 100);
  });
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ——— Camera loop helpers ———
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _lookTarget = new THREE.Vector3();
/** Free-explore altitude: wheel / QE can raise and lower the camera. */
const FREE_Y_MIN = 0.25;
const FREE_Y_MAX = 48;

function clampFreeCameraY() {
  camera.position.y = Math.max(FREE_Y_MIN, Math.min(FREE_Y_MAX, camera.position.y));
}

/**
 * Free-fly spectator cam (not stuck to a ground plane).
 * - W/S: along look direction (includes pitch → climb/dive by looking up/down)
 * - A/D: horizontal strafe
 * - Q/E, PageUp/PageDown, Ctrl: world up/down
 * - Mouse wheel: quick altitude change
 */
function updateFreeCamera(dt) {
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 8.5 : 4.0;
  wish.set(0, 0, 0);
  if (keys.has('KeyW')) wish.z -= 1;
  if (keys.has('KeyS')) wish.z += 1;
  if (keys.has('KeyA')) wish.x -= 1;
  if (keys.has('KeyD')) wish.x += 1;
  // World vertical: Q down, E up; also Ctrl down / C not used; PageDown/PageUp
  if (keys.has('KeyQ') || keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('PageDown')) {
    wish.y -= 1;
  }
  if (keys.has('KeyE') || keys.has('PageUp')) {
    wish.y += 1;
  }

  // Full look-forward (with pitch) so free explore is not locked to a flat plane
  const cosP = Math.cos(look.pitch);
  const sinP = Math.sin(look.pitch);
  _fwd.set(-Math.sin(look.yaw) * cosP, sinP, -Math.cos(look.yaw) * cosP);
  // Strafe stays level so A/D does not drift in altitude unexpectedly
  _right.set(Math.cos(look.yaw), 0, -Math.sin(look.yaw));

  const move = new THREE.Vector3();
  // wish.z: W is -1 → move along +_fwd (forward)
  if (wish.z) move.addScaledVector(_fwd, -wish.z);
  if (wish.x) move.addScaledVector(_right, wish.x);
  if (wish.y) move.addScaledVector(_worldUp, wish.y);
  if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);

  camera.position.add(move);
  clampFreeCameraY();

  const lx = camera.position.x - Math.sin(look.yaw) * Math.cos(look.pitch);
  const ly = camera.position.y + Math.sin(look.pitch);
  const lz = camera.position.z - Math.cos(look.yaw) * Math.cos(look.pitch);
  camera.lookAt(lx, ly, lz);
}

function updateCinematicCamera(dt) {
  camera.position.lerp(cameraMode.targetPos, 1 - Math.pow(1 - cameraMode.lerp, dt * 60));
  _lookTarget.lerp(cameraMode.targetLook, 1 - Math.pow(1 - cameraMode.lerp, dt * 60));
  camera.lookAt(_lookTarget);
  const dx = _lookTarget.x - camera.position.x;
  const dy = _lookTarget.y - camera.position.y;
  const dz = _lookTarget.z - camera.position.z;
  look.yaw = Math.atan2(-dx, -dz);
  look.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}

function updateTypewriter(dt) {
  const line = LINES[lineIndex];
  const full = lineText(line);
  const charsPerSec = Math.max(12, full.length / Math.max(2.5, currentLineDuration * 0.85));
  typewriterLen = Math.min(full.length, typewriterLen + dt * charsPerSec);
  const next = full.slice(0, Math.floor(typewriterLen));
  if (next !== displayedText) {
    displayedText = next;
    dialogueEl.textContent = displayedText;
  }
}

function updateYouthStaging() {
  const line = LINES[lineIndex];
  if (!line) return;
  const stage = line.stage || '';

  // Do not force-seat during leave sequence
  if (stage === 'youth_rise' || stage === 'youth_to_door' || stage === 'youth_snow') {
    return;
  }

  // Snap seat when walk finished into study
  if (youthEntered && !youthSeated && !youth.state.walking) {
    if (
      stage === 'youth_seat' ||
      stage === 'youth_seated' ||
      stage === 'debate_ready' ||
      line.camera === 'study' ||
      line.camera === 'closeup'
    ) {
      seatYouthNow();
    }
  }

  // Prologue / re-entry: if dialogue already in study but still walking, snap after delay
  if (
    youthEntered &&
    !youthSeated &&
    youth.state.walking &&
    (line.camera === 'study' || line.camera === 'closeup') &&
    lineTime > 3.2
  ) {
    seatYouthNow();
  }
}

// ——— Boot ———
setLoad(0.85, '点亮烛火与配音…');
const clock = new THREE.Clock();

setCameraCue('exterior');
camera.position.copy(cameraMode.targetPos);
_lookTarget.copy(cameraMode.targetLook);
camera.lookAt(_lookTarget);
applyNightPhase('prologue');

setLoad(1, '完成');
setTimeout(() => {
  loadingEl.classList.add('fade-out');
  uiEl.classList.remove('hidden');
  showLine(0);
  playing = true;
  btnPlay.textContent = '❚❚';
  try {
    console.info('[剧情]', {
      lines: LINES.length,
      segments: CHAPTERS.length,
      parts: PART_BOUNDARIES.map((p) => p.partId),
    });
    console.info('[配音角色分配]', voice.getStatus().assigned);
  } catch (_) {
    /* ignore */
  }
}, 500);

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = performance.now();

  if (playing) {
    lineTime += dt;
    if (lineTime >= currentLineDuration) nextLine();
  }
  updateTypewriter(dt);
  updateYouthStaging();

  if (youthSeated) {
    philosopher.root.rotation.y = 0.55;
    youth.root.rotation.y = -0.7;
  }

  philosopher.update(dt, t);
  youth.update(dt, t);
  world.update(dt, t);

  if (followDialogue && !pointerLocked) {
    updateCinematicCamera(dt);
  } else {
    updateFreeCamera(dt);
  }

  renderer.render(scene, camera);
}

frame();

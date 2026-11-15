/* 도형 디펜스: 화면과 조작 */
(function () {
'use strict';
const C = window.Core;
const $ = (s) => document.querySelector(s);
const cv = $('#field'), ctx = cv.getContext('2d'), wrap = $('#fieldWrap');
const elW = $('#weapons'), elB = $('#bottom'), elO = $('#overlay');
const fxLayer = document.createElement('div'); fxLayer.id = 'fxLayer'; $('#app').appendChild(fxLayer);
const toastEl = document.createElement('div'); toastEl.id = 'toast'; wrap.appendChild(toastEl);   // 알림은 전장 아래쪽에 잠깐 뜬다
const rewLayer = document.createElement('div'); rewLayer.id = 'rewLayer'; $('#app').appendChild(rewLayer);   // 보스 보상 연출 (거래 창 위에도 보인다, 입력을 막지 않는다)
const aimCv = document.createElement('canvas'); aimCv.id = 'aimLayer'; aimCv.hidden = true; $('#app').appendChild(aimCv);   // 전장 밖(무기 칸, 인벤토리 위)까지 이어지는 예고선 (입력을 막지 않는다)
const aimCtx = aimCv.getContext('2d');
const cerEl = document.createElement('div'); cerEl.id = 'evoCer'; wrap.appendChild(cerEl);   // 진화 연출 (입력을 막지 않는다)
let cerUntil = 0;
const bannerEl = document.createElement('div'); bannerEl.id = 'pactBanner'; wrap.appendChild(bannerEl);   // 거래 완료 배너 (입력을 막지 않는다)
const markEl = document.createElement('button'); markEl.id = 'pactMark'; markEl.type = 'button'; markEl.dataset.act = 'pactMark'; markEl.hidden = true; markEl.setAttribute('aria-label', '맺은 거래 보기');
markEl.innerHTML = '<svg viewBox="-1 0 26 20" width="18" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v15M7 17h10M3 5h18M3 5l-2.5 7M3 5l2.5 7M0.5 12q2.5 3 5 0M21 5l-2.5 7M21 5l2.5 7M18.5 12q2.5 3 5 0"/></svg><b></b>';
wrap.appendChild(markEl);
let markN = 0, markLow = null;
const GR = C.GRADES;
const GHEX = ['#aab6cc', '#5cb8ff', '#c48bff', '#ffa63d'];   // 등급 색 (테마를 바꾸면 값만 바뀐다)
const ECOL = { basic: '#ff6b6b', runner: '#ffa06b', swarm: '#ff7fb0', heavy: '#f0508c', giant: '#ff3d3d', split: '#ff3d3d',
  summon: '#ff5fd0', jammer: '#ff2e63', shield: '#ff6b8a', thief: '#ff4fa3', corrode: '#d04cff', scale: '#8f9bb5' };
const BEST_KEY = 'shape-defense-best';
const THEME_KEY = 'shape-defense-theme';
const TEST_KEY = 'shape-defense-test';     // 테스트 모드의 마지막 체크 설정

/* ---------- 테마 ---------- */
// v: :root의 CSS 변수, cv: 전장(canvas)에서 쓰는 색, wc: 무기 색 (없으면 원래 색)
const BLUE_V = {
  bg: '#1b3a72', panel: '#23498a', 'panel-2': '#2c569f', line: 'rgba(190, 215, 255, .28)', ink: '#e9f0ff', dim: '#b4c6e6',
  accent: '#ffd166', 'accent-ink': '#ffd166', 'on-accent': '#1c1503', danger: '#ff5d5d', ok: '#7af0c1',
  g0: '#aab6cc', g1: '#5cb8ff', g2: '#c48bff', g3: '#ffa63d', backdrop: '#132c5a',
  shade: 'rgba(0, 0, 0, .18)', overlay: 'rgba(10, 24, 54, .78)', toast: 'rgba(22, 48, 98, .92)', shadow: '#000',
  hatch: 'rgba(255, 255, 255, .07)', sheen: 'rgba(255, 244, 214, .55)', melt: '#ffb37a', 'melt-fill': '#ff9f5a', ember: '#ff3d2e',
};
const BLUE_CV = {
  grid: 'rgba(150,190,255,.10)', lane: 'rgba(150,190,255,.32)', base: 'rgba(122,240,193,.8)', turret: '#7af0c1',
  dmgStroke: '6,13,30', dmgBig: '255,209,102', dmg2: '255,160,90', dmg3: '255,224,130', dmgN: '233,240,255',
  bossTxt: '#ffd0d0', bossLine: 'rgba(255,255,255,.7)', hit: 'rgba(255,255,255,.8)', fence: 'rgba(255,230,120,.85)',
};
// 밝은 테마는 무기 색을 더 어둡게 (바탕과 겹쳐 보이지 않도록)
const LIGHT_WC = { blaster: '#0a9fc4', shotgun: '#d99400', laser: '#d8409f', pulse: '#12a579', mortar: '#e56a1f', tesla: '#7257e0', rail: '#4a5568', acid: '#5f9e12' };
const DARK_CV = (rgb, g, l) => Object.assign({}, BLUE_CV, { grid: `rgba(${rgb},${g})`, lane: `rgba(${rgb},${l})` });
const THEMES = [
  { id: 'paper', name: '밝은 종이', scheme: 'light',
    v: Object.assign({}, BLUE_V, { bg: '#eef1f5', panel: '#ffffff', 'panel-2': '#e3e8ef', line: 'rgba(30,50,90,.22)', ink: '#1c2740', dim: '#5b6a85',
      accent: '#e09a00', 'accent-ink': '#8a5600', 'on-accent': '#1c1503', ok: '#0f9d76', danger: '#e03a3a',
      g0: '#6b7688', g1: '#1f7fe0', g2: '#8a4be0', g3: '#e07a00', backdrop: '#d9dee6',
      shade: 'rgba(30, 50, 90, .07)', overlay: 'rgba(28, 39, 64, .55)', toast: 'rgba(255, 255, 255, .97)', shadow: '#fff',
      hatch: 'rgba(30, 50, 90, .07)', sheen: 'rgba(255, 255, 255, .95)', melt: '#b4540a', 'melt-fill': '#e5731a', ember: '#d4260f' }),
    cv: { grid: 'rgba(30,50,90,.09)', lane: 'rgba(30,50,90,.26)', base: 'rgba(15,157,118,.9)', turret: '#0f9d76',
      dmgStroke: '255,255,255', dmgBig: '184,100,0', dmg2: '196,70,10', dmg3: '154,106,0', dmgN: '28,39,64',
      bossTxt: '#a01c1c', bossLine: 'rgba(28,39,64,.7)', hit: 'rgba(255,190,60,.75)', fence: 'rgba(190,120,0,.95)' },
    wc: LIGHT_WC },
  { id: 'sand', name: '모래', scheme: 'light',
    v: Object.assign({}, BLUE_V, { bg: '#f3ecdd', panel: '#fffaf0', 'panel-2': '#e9dfc9', line: 'rgba(80,55,20,.24)', ink: '#3a2f1f', dim: '#76664d',
      accent: '#0e7a73', 'accent-ink': '#0a5f59', 'on-accent': '#fffaf0', ok: '#2a8a4a', danger: '#c93a2e',
      g0: '#77705f', g1: '#1f7fe0', g2: '#8a4be0', g3: '#d9740a', backdrop: '#e4d9c1',
      shade: 'rgba(80, 55, 20, .07)', overlay: 'rgba(58, 47, 31, .55)', toast: 'rgba(255, 250, 240, .97)', shadow: '#fffaf0',
      hatch: 'rgba(80, 55, 20, .07)', sheen: 'rgba(255, 255, 255, .95)', melt: '#a14a0c', 'melt-fill': '#d9731c', ember: '#d4260f' }),
    cv: { grid: 'rgba(80,55,20,.09)', lane: 'rgba(80,55,20,.26)', base: 'rgba(42,138,74,.9)', turret: '#2a8a4a',
      dmgStroke: '255,250,240', dmgBig: '184,100,0', dmg2: '196,70,10', dmg3: '154,106,0', dmgN: '58,47,31',
      bossTxt: '#a01c1c', bossLine: 'rgba(58,47,31,.7)', hit: 'rgba(255,190,60,.75)', fence: 'rgba(190,120,0,.95)' },
    wc: LIGHT_WC },
  { id: 'sky', name: '하늘', scheme: 'light',
    v: Object.assign({}, BLUE_V, { bg: '#e3effb', panel: '#ffffff', 'panel-2': '#d3e4f6', line: 'rgba(22,48,79,.22)', ink: '#16304f', dim: '#52708f',
      accent: '#c2255c', 'accent-ink': '#a01b49', 'on-accent': '#ffffff', ok: '#0f9d76', danger: '#e03a3a',
      g0: '#66768c', g1: '#1f7fe0', g2: '#8a4be0', g3: '#e07a00', backdrop: '#cfe1f3',
      shade: 'rgba(22, 48, 79, .07)', overlay: 'rgba(22, 48, 79, .55)', toast: 'rgba(255, 255, 255, .97)', shadow: '#fff',
      hatch: 'rgba(22, 48, 79, .07)', sheen: 'rgba(255, 255, 255, .95)', melt: '#b4540a', 'melt-fill': '#e5731a', ember: '#d4260f' }),
    cv: { grid: 'rgba(22,48,79,.09)', lane: 'rgba(22,48,79,.26)', base: 'rgba(15,157,118,.9)', turret: '#0f9d76',
      dmgStroke: '255,255,255', dmgBig: '184,100,0', dmg2: '196,70,10', dmg3: '154,106,0', dmgN: '22,48,79',
      bossTxt: '#a01c1c', bossLine: 'rgba(22,48,79,.7)', hit: 'rgba(255,190,60,.75)', fence: 'rgba(190,120,0,.95)' },
    wc: LIGHT_WC },
  { id: 'navy', name: '짙은 남색',
    v: Object.assign({}, BLUE_V, { bg: '#0e1c3a', panel: '#13264d', 'panel-2': '#1a3263', line: 'rgba(150,190,255,.18)', dim: '#93a8cf',
      backdrop: '#081226', overlay: 'rgba(4, 10, 26, .8)', toast: 'rgba(14, 28, 58, .94)' }),
    cv: BLUE_CV },
  { id: 'charcoal', name: '차콜',
    v: Object.assign({}, BLUE_V, { bg: '#222428', panel: '#2c2f35', 'panel-2': '#373b43', line: 'rgba(255,255,255,.16)', dim: '#a9afba',
      backdrop: '#17181b', overlay: 'rgba(8, 9, 11, .8)', toast: 'rgba(26, 28, 32, .94)' }),
    cv: DARK_CV('255,255,255', '.06', '.20') },
];
const DEF_THEME = THEMES.find(t => t.id === 'paper');   // 기본 테마
let theme = DEF_THEME;
let TC = Object.assign({ bg: DEF_THEME.v.bg }, DEF_THEME.cv);   // 지금 테마의 전장 색
const WC0 = {}; for (const t in C.WEAPONS) WC0[t] = C.WEAPONS[t].color;   // 무기 원래 색

let mode = 'start';            // start | play | pause | over
let sel = null;                // 고른 것: {from:'inv', i} 또는 {from:'slot', k}
let wmodal = -1, wpick = -1;   // 무기 창이 열린 칸, 그 안에서 파츠를 고르는 중인 칸
let bmodal = false;            // 기지 창
let evoK = -1;                 // 진화 창이 열린 칸
let skK = -1, skSel = null, skGot = null;   // 스킬 창: 칸, 고른 노드 {l, t}, 방금 찍은 노드 {l, t}
let meltMode = false, meltAllArm = false;   // 용해로 모드, 모두 분해 확인
const meltSet = new Set();   // 용해로 모드에서 고른 인벤토리 칸 (여러 개)
let augSel = -1, augRep = -1, augSkip = false, augIntro = false;   // 증강 비교 창: 고른 선택지, 교체할 칸, 건너뛰기 확인, 처음 뜨는 연출
let lastUp = null;             // 무기 창 안의 강화 결과 표시
let confirmDrop = false, dropArmI = -1, dropArmAt = 0, armWhat = 'drop';   // armWhat: 무장한 버튼 (drop | melt)
let downOnBtn = true;                       // 마지막 누름이 버튼 위에서 시작했는가 (아니면 그 뒤에 생긴 버튼이 받는 click은 무시한다)
const incoming = new WeakSet();             // 보스 보상이 날아오는 중인 물건: 도착할 때까지 칸 안을 숨긴다   // 버리기: 첫 번째 누름으로 무장하고 두 번째에 버린다. 3초가 지나면 풀린다
let upMode = false;            // 강화 모드: 무기 칸을 누를 때마다 한 번씩 강화
let eqFx = null;               // 장착 직후 보여 줄 효과 {k: 칸 번호 또는 'base', g: 등급}
let msg = '', msgWarn = false, msgUntil = 0, newCell = -1;
let wpickNew = -1, wpickAt = 0;  // 파츠 고르기 창에서 비교 중인 인벤토리 칸
let augOpenAt = 0, shownAug = null, lastRec = null, newRec = false;
let speed = 1;
let abKey = '';                  // 지금 떠 있는 보스 능력 예고 칩의 식별 값 (바뀔 때만 다시 만든다)
const RM = matchMedia('(prefers-reduced-motion: reduce)');   // 움직임 줄이기
let drag = null, suppressClick = 0, needRender = false;   // 끌어서 옮기기
let pauseView = '';              // 일시정지 화면의 하위 화면: '' | confirm
let testView = false, testMsg = '';   // 테스트 창 (열려 있는 동안 mode 는 pause), 방금 한 일
let helpFrom = '';               // 도움말을 연 화면: '' | start | pause (뒤로를 누르면 그 화면으로 돌아간다)
let pactView = false, pactResume = false, bannerUntil = 0;   // 맺은 거래 보기 창, 닫을 때 게임을 이어갈지, 완료 배너가 사라질 시각
const PACT_LINES = ['원하는 것을 주지. 대신 그만한 것을 내놓아라.', '저울은 한쪽으로만 기울지 않는다. 골라라.', '공짜는 없다. 무엇을 걸겠나?', '힘을 원하나? 값은 네가 치른다.'];   // 천칭이 건네는 말
let pactLine = PACT_LINES[0];
let pactSel = -1, pactSkip = false, pactOpenAt = 0, shownPact = null, pactIntro = false;   // 천칭의 거래 창: 고른 카드, 건너뛰기 확인, 열린 시각
let lastRes = null;              // 게임 오버 때 남기는 무기별 결과
let partSwap = null, pswapAt = 0;   // 가득 찬 무기에 파츠를 넣을 때: {i: 인벤토리 칸, k: 무기 칸, sel: 고른 교체 대상}
let best = loadBest();
let sc = 1, dpr = 1;

/* ---------- 소리 (파일 없이 합성) ---------- */
const MUTE_KEY = 'shape-defense-mute';
const Snd = (function () {
  let ac = null, master = null, noise = null, muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* 저장소를 못 쓰는 환경 */ }
  const lastAt = {};
  function ensure() {            // 브라우저 정책상 누르는 동작 안에서만 소리를 켤 수 있다
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
        const len = Math.floor(ac.sampleRate * 0.5); noise = ac.createBuffer(1, len, ac.sampleRate);
        const d = noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); }
    } catch (e) { ac = null; }
  }
  function tone(type, f0, f1, dur, vol, delay) {
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
  }
  function hiss(dur, vol, freq, q, type, delay) {
    const t = ac.currentTime + (delay || 0), src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise; f.type = type || 'lowpass'; f.frequency.value = freq; f.Q.value = q || 0.7;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur + 0.03);
  }
  const seq = (type, notes, dur, vol, gap) => notes.forEach((f, i) => tone(type, f, f, dur, vol, gap * i));
  // [최소 간격(ms), 재생 함수]
  const DEF = {
    blaster: [70, () => tone('square', 880, 420, 0.06, 0.045)],
    shotgun: [110, () => { hiss(0.09, 0.13, 1800); tone('sine', 160, 70, 0.08, 0.1); }],
    laser: [120, () => tone('sawtooth', 1400, 300, 0.16, 0.045)],
    pulse: [140, () => tone('sine', 260, 70, 0.2, 0.13)],
    mortar: [120, () => tone('sine', 140, 55, 0.14, 0.15)],
    tesla: [100, () => { hiss(0.07, 0.09, 3500, 3, 'bandpass'); tone('square', 1700, 900, 0.05, 0.025); }],
    rail: [150, () => tone('sine', 700, 1500, 0.2, 0.03)],                                                   // 조준: 낮게 차오르는 소리
    railfire: [150, () => { tone('sawtooth', 2600, 180, 0.12, 0.06); hiss(0.07, 0.1, 4500, 1, 'highpass'); }],   // 발사: 날카로운 소리
    acid: [170, () => { tone('sine', 380, 520, 0.08, 0.035); hiss(0.06, 0.04, 1500, 1.2, 'bandpass'); }],       // 던지는 소리
    splat: [90, () => { hiss(0.13, 0.06, 900, 1, 'lowpass'); tone('sine', 260, 120, 0.1, 0.035); }],          // 웅덩이에 철퍽
    boom: [90, () => { hiss(0.28, 0.2, 500, 0.6); tone('sine', 90, 40, 0.25, 0.17); }],
    kill: [70, () => tone('triangle', 520, 880, 0.05, 0.05)],
    bosskill: [300, () => { hiss(0.5, 0.28, 400, 0.6); seq('triangle', [392, 523, 659, 784], 0.16, 0.12, 0.08); }],
    bossdie: [300, () => {                                                                                                // 보스 처치: 묵직한 폭발, 깨지는 소리, 뒤따르는 하강음
      tone('sine', 150, 38, 0.7, 0.3); tone('sawtooth', 220, 50, 0.4, 0.1); hiss(0.6, 0.3, 700, 0.6);
      hiss(0.22, 0.16, 5200, 1, 'highpass', 0.03); tone('square', 1500, 300, 0.18, 0.05, 0.02);
      seq('triangle', [784, 659, 523, 392], 0.2, 0.09, 0.09); tone('sine', 98, 49, 0.9, 0.14, 0.12);
    }],
    leak: [150, () => { tone('square', 120, 60, 0.25, 0.13); hiss(0.2, 0.12, 300); }],
    warn: [500, () => { for (let i = 0; i < 3; i++) { tone('square', 440, 440, 0.14, 0.07, i * 0.32); tone('square', 330, 330, 0.14, 0.07, i * 0.32 + 0.16); } }],
    alert: [300, () => { for (let i = 0; i < 2; i++) { tone('square', 880, 880, 0.07, 0.08, i * 0.12); tone('square', 660, 660, 0.07, 0.08, i * 0.12 + 0.06); } }],   // 능력 예고: 짧고 높은 경보
    hitlock: [200, () => { tone('square', 140, 90, 0.12, 0.13); hiss(0.1, 0.16, 2500, 2, 'bandpass'); tone('triangle', 1200, 700, 0.1, 0.06, 0.05); }],   // 잠기는 철컹 소리
    hitsteal: [200, () => { tone('sawtooth', 900, 180, 0.28, 0.08); hiss(0.2, 0.12, 1200, 1, 'highpass'); }],                                         // 낚아채는 휙 소리
    hitcorr: [200, () => { hiss(0.35, 0.16, 900, 1.2, 'bandpass'); tone('sawtooth', 160, 60, 0.35, 0.09); }],                                         // 녹아내리는 지글 소리
    gen: [40, () => seq('triangle', [988, 1319], 0.1, 0.1, 0.07)],
    ok: [30, () => seq('triangle', [523, 659, 784], 0.1, 0.12, 0.06)],
    fail: [30, () => tone('sawtooth', 220, 110, 0.22, 0.07)],
    aug: [200, () => seq('sine', [523, 659, 784, 1047], 0.5, 0.08, 0.05)],
    legend: [300, () => { seq('triangle', [1047, 1319, 1568, 2093], 0.2, 0.09, 0.055); seq('sine', [2093, 2637], 0.3, 0.05, 0.14); }],
    pact: [600, () => { tone('sine', 98, 92, 1.1, 0.16); tone('sine', 196, 190, 0.9, 0.07, 0.03); tone('triangle', 294, 290, 0.7, 0.035, 0.05); hiss(0.45, 0.07, 260, 0.8, 'lowpass', 0.02); }],   // 거래 완료: 낮고 묵직한 울림
    pick: [40, () => seq('triangle', [784, 1175], 0.14, 0.1, 0.08)],
    equip: [40, () => tone('triangle', 330, 520, 0.07, 0.1)],
    tap: [30, () => tone('triangle', 660, 660, 0.03, 0.05)],
    drop: [40, () => tone('triangle', 300, 150, 0.1, 0.08)],
    melt: [40, () => { hiss(0.25, 0.11, 900, 1); tone('sawtooth', 300, 90, 0.25, 0.05); }],
    over: [500, () => seq('triangle', [392, 330, 262, 196], 0.3, 0.14, 0.22)],
    evolve: [400, () => {                                                                                                  // 진화 의식: 1초 넘게 차오르는 소리, 정점에서 낮은 울림과 화음
      tone('sawtooth', 90, 700, 1.1, 0.05); tone('sine', 180, 1500, 1.15, 0.09); tone('triangle', 270, 2100, 1.1, 0.04, 0.05); hiss(1.0, 0.1, 2600, 1.4, 'bandpass');
      tone('sine', 110, 40, 0.8, 0.26, 1.1); hiss(0.5, 0.16, 900, 0.7, 'lowpass', 1.1);
      [523, 659, 784, 1047, 1319].forEach((f, i) => { tone('triangle', f, f, 0.55, 0.08, 1.12 + i * 0.07); });
      tone('sine', 2093, 2093, 0.6, 0.04, 1.4);
    }],
    rewpop: [150, () => seq('triangle', [659, 988], 0.12, 0.08, 0.06)],   // 보스 보상이 떠오름
    rewland: [60, () => tone('triangle', 520, 780, 0.09, 0.09)],          // 인벤토리에 닿음
    skill: [60, () => seq('triangle', [659, 988], 0.12, 0.09, 0.06)],
  };
  function play(name) {
    if (!ac || muted || ac.state !== 'running') return;
    const d = DEF[name]; if (!d) return;
    const now = performance.now();
    if (lastAt[name] && now - lastAt[name] < d[0]) return;
    lastAt[name] = now;
    try { d[1](); } catch (e) { /* 소리 실패는 무시 */ }
  }
  return {
    ensure, play,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* 무시 */ }
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
  };
})();

/* ---------- 도우미 ---------- */
function loadBest() {
  try { const o = JSON.parse(localStorage.getItem(BEST_KEY) || 'null'); if (o && typeof o.t === 'number') return o; } catch (e) { /* 저장소를 못 쓰는 환경 */ }
  return null;
}
function saveBest(o) { best = o; try { localStorage.setItem(BEST_KEY, JSON.stringify(o)); } catch (e) { /* 무시 */ } }
function applyTheme(th, save) {
  theme = th;
  const rs = document.documentElement.style;
  for (const k in th.v) rs.setProperty('--' + k, th.v[k]);
  rs.colorScheme = th.scheme || 'dark';
  for (let g = 0; g < 4; g++) GHEX[g] = th.v['g' + g];
  TC = Object.assign({ bg: th.v.bg }, th.cv);
  const tm = document.querySelector('meta[name="theme-color"]'); if (tm) tm.setAttribute('content', th.v.bg);   // 주소창, 상태 표시줄 색
  for (const t in WC0) C.WEAPONS[t].color = (th.wc && th.wc[t]) || WC0[t];   // 무기 색이 바뀌면 캐시된 능력치를 버린다
  const S = C.S;
  if (S) { for (const w of S.slots) if (w) C.dirty(w); for (const it of S.inv) if (it && it.kind === 'w') C.dirty(it); }
  if (save) { try { localStorage.setItem(THEME_KEY, th.id); } catch (e) { /* 무시 */ } }
}
function loadTheme() {
  try { const id = localStorage.getItem(THEME_KEY); const t = THEMES.find(x => x.id === id); if (t) return t; } catch (e) { /* 저장소를 못 쓰는 환경 */ }
  return DEF_THEME;   // 저장된 것이 없거나 지금은 없는 테마면 기본으로
}
function fmtTime(t) { const s = Math.floor(t); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function fmt(n) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '만';
  if (n >= 100) return String(Math.round(n));
  return n.toFixed(1);
}
function fmtDmg(n) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e5) return Math.round(n / 1e4) + '만';
  return String(Math.max(1, Math.round(n)));   // 소수점 없이
}
function fmtInt(n) { if (n === Infinity) return '∞'; n = Math.floor(n); return n >= 1e5 ? fmt(n) : String(n); }   // ∞: 테스트 모드의 무한
const rgbaCache = {};
function rgba(hex, a) {
  a = Math.round(a * 32) / 32;   // 알파를 잘게 나눠 캐시가 끝없이 늘어나지 않게 한다
  const k = hex + a;
  if (rgbaCache[k]) return rgbaCache[k];
  const n = parseInt(hex.slice(1), 16);
  return (rgbaCache[k] = `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`);
}
function say(text, warn, ms) {
  msg = text; msgWarn = !!warn; msgUntil = performance.now() + (ms || 2400);
  toastEl.innerHTML = text; toastEl.classList.toggle('warn', !!warn); toastEl.classList.add('show');
}
function banner(name) {
  bannerEl.innerHTML = `<i class="pb-flash"></i><i class="pb-ring"></i><div class="pb-band"><b class="pb-t">거래 완료</b><i class="pb-line"></i><span class="pb-n">${name}</span></div>`;
  bannerEl.classList.remove('show'); void bannerEl.offsetWidth; bannerEl.classList.add('show');
  bannerUntil = performance.now() + 1800;
}
function updateMark() {
  const S = C.S, n = S && S.pacts ? S.pacts.length : 0;
  if (n !== markN) { markN = n; markEl.hidden = !n; markEl.querySelector('b').textContent = n; }
  const low = !!S && S.enemies.some(e => e.boss && !e.dead);   // 보스 체력 막대 아래로 내려 앉는다
  if (low !== markLow) { markLow = low; markEl.classList.toggle('low', low); }
}

function icon(type, size, evo) {
  const c = C.WEAPONS[type].color;
  const shape = (a) => {
    switch (type) {
      case 'blaster': return `<polygon points="12,3 21,21 3,21" ${a}/>`;
      case 'shotgun': return `<polygon points="3,5 21,5 15,21 9,21" ${a}/><path d="M8.5 5l1.8 16M15.5 5l-1.8 16" stroke="${c}" stroke-width="1.2"/>`;
      case 'laser': return `<rect x="9" y="2" width="6" height="20" rx="1" ${a}/><path d="M12 5.5v13" stroke="${c}" stroke-width="1.6"/>`;
      case 'pulse': return `<circle cx="12" cy="12" r="9.5" ${a}/><circle cx="12" cy="12" r="4" fill="${c}"/>`;
      case 'mortar': return `<polygon points="6.5,19.5 13.5,4 18,6 11,21" ${a}/><path d="M3 21.5h18M14.5 12l5 9.5" stroke="${c}" stroke-width="1.9" stroke-linecap="round"/><circle cx="17.5" cy="2.8" r="1.6" fill="${c}"/>`;
      case 'tesla': return `<polygon points="14,2 5,13.5 11,13.5 9,22 19,9.5 13,9.5" ${a}/>`;
      case 'rail': return `<polygon points="12,2 15.5,10 15.5,22 8.5,22 8.5,10" ${a}/><path d="M12 8v11M3.5 17l5-3.5M20.5 17l-5-3.5" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`;
      case 'acid': return `<path d="M12 2.5C16.5 8 19 11.5 19 15a7 7 0 0 1-14 0c0-3.5 2.5-7 7-12.5z" ${a}/><circle cx="9.5" cy="15.5" r="1.9" fill="${c}"/>`;
    }
    return '';
  };
  const a = `fill="${c}" fill-opacity=".22" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"`;
  let p = shape(a);
  // 진화한 무기: 바깥에 한 겹 더 굵은 윤곽과 빛무리
  if (evo) p = `<g opacity=".6">${shape(`fill="none" stroke="${c}" stroke-width="5.2" stroke-linejoin="round"`)}</g>` + p;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"${evo ? ` class="evoic" style="--wc:${c};overflow:visible"` : ''}>${p}</svg>`;
}
const lvTxt = (o) => (o.evo ? '★+' : '+') + o.lv;   // 진화한 무기는 ★+단계

/* ---------- 파츠 그림 ---------- */
const FILL = 'fill="currentColor" stroke="none"';
const PICON = {
  dmg: '<path d="M12 2c3 3 4 6.5 4 10v8H8v-8c0-3.5 1-7 4-10z"/><path d="M8 16h8"/>',
  rate: '<path d="M4 6l6 6-6 6M12 6l6 6-6 6"/>',
  crit: '<circle cx="12" cy="12" r="6.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  critd: '<path d="M12 2l5 13-5 7-5-7z"/><path d="M12 2v20"/>',
  range: '<path d="M2 12h20M2 12l4-4M2 12l4 4M22 12l-4-4M22 12l-4 4"/><path d="M12 5v14" stroke-dasharray="2 3"/>',
  boss: '<circle cx="10" cy="10" r="6.5"/><path d="M15 15l6 6M10 7v6M7 10h6"/>',
  gold: `<path d="M12 2l10 10-10 10L2 12z"/><path d="M12 8l4 4-4 4-4-4z" ${FILL}/>`,
  exec: '<path d="M5 5h14l-7 15z"/><path d="M3 5h18"/>',
  first: '<path d="M2 12h12M10 7l5 5-5 5"/><path d="M20 4v16"/>',
  dbl: '<path d="M7 3c2 2 2.5 4 2.5 7v10h-5V10c0-3 .5-5 2.5-7zM17 3c2 2 2.5 4 2.5 7v10h-5V10c0-3 .5-5 2.5-7z"/>',
  core: `<path d="M12 2l8.5 5v10L12 22l-8.5-5V7z"/><circle cx="12" cy="12" r="3.2" ${FILL}/>`,
  heavy: '<path d="M7 9h10l3 12H4z"/><path d="M9 9a3 3 0 0 1 6 0"/>',
  light: '<path d="M20 4C10 4 5 10 4 20c8-1 14-6 16-16z"/><path d="M4 20L15 9"/>',
  sniper: '<circle cx="12" cy="9" r="5"/><path d="M12 1v22M4 9h16"/>',
  chill: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/>',
  glass: '<path d="M12 2l8 10-8 10-8-10z"/><path d="M12 2l-2 7 4 4-3 9"/>',
  big: `<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="4" ${FILL}/>`,
  ember: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 2 2 3-6z"/>',
  gamble: `<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" ${FILL}/><circle cx="15.5" cy="15.5" r="1.5" ${FILL}/><circle cx="12" cy="12" r="1.5" ${FILL}/><circle cx="15.5" cy="8.5" r="1.5" ${FILL}/><circle cx="8.5" cy="15.5" r="1.5" ${FILL}/>`,
  ramp: '<path d="M3 17a9 9 0 0 1 18 0"/><path d="M12 17l5-7"/><path d="M3 21h18"/>',
  // 기지 파츠
  shield: '<path d="M12 3l7 3v5c0 4.500-3 7.500-7 9.500-4-2-7-5-7-9.500V6z"/>',
  armor: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>',
  drone: '<circle cx="12" cy="14" r="4.5"/><path d="M2 6h8M14 6h8M6 6l3.5 5M18 6l-3.5 5"/>',
  heal: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  wire: '<path d="M2 12h20M6 7l4 10M10 7L6 17M14 7l4 10M18 7l-4 10"/>',
  luck: '<circle cx="8" cy="8" r="3.5"/><circle cx="16" cy="8" r="3.5"/><circle cx="8" cy="16" r="3.5"/><circle cx="16" cy="16" r="3.5"/>',
  save: '<path d="M19.5 9A8 8 0 1 0 20 14"/><path d="M20 3v6h-6"/>',
  magnet: '<path d="M6 3v9a6 6 0 0 0 12 0V3h-4v9a2 2 0 0 1-4 0V3z"/><path d="M6 7h4M14 7h4"/>',
  depot: '<rect x="3" y="5" width="18" height="15" rx="1"/><path d="M3 10h18M9 5v15M15 5v15"/>',
  command: `<path d="M12 22V9M7 22h10"/><circle cx="12" cy="6" r="2.2" ${FILL}/><path d="M6 2a8 8 0 0 0 0 8M18 2a8 8 0 0 1 0 8"/>`,
  radar: `<path d="M4 20A16 16 0 0 1 20 4"/><path d="M4 20a9 9 0 0 1 9-9"/><path d="M4 20l9-9"/><circle cx="4" cy="20" r="1.8" ${FILL}/>`,
  barrier: '<path d="M3 21V9l9-6 9 6v12z"/><path d="M3 15h18M9 15v6M15 15v6M12 9v6"/>',
};
const SVG_ATTR = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
// 무기 파츠는 그림 그대로, 기지 파츠는 방패 모양 테두리 안에 그려 구분한다
function partIcon(id, size) {
  const body = PICON[id] || '';
  if (C.PARTS[id] && C.PARTS[id].base) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" ${SVG_ATTR}><path d="M12 1.2l9.6 3.4v6.6c0 5.700-4 9.700-9.600 11.600C6.400 20.900 2.400 16.900 2.400 11.200V4.600z" stroke-width="1.5" fill="currentColor" fill-opacity=".13"/><g transform="translate(12 11.200) scale(.54) translate(-12 -12)" stroke-width="2.800">${body}</g></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" ${SVG_ATTR}>${body}</svg>`;
}
const SHARD = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#ffc83d" fill-opacity=".85" stroke="#b07a00" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 2v20M3 7l18 10M21 7L3 17" stroke="#b07a00" stroke-opacity=".45" stroke-width="1"/></svg>`;
const FLAME = `<svg viewBox="0 0 24 24" width="16" height="16" ${SVG_ATTR}><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 2 2 3-6z"/></svg>`;
const BASEICON = (size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" ${SVG_ATTR}><path d="M3 21V10l4-3v4l5-4 5 4V7l4 3v11z"/><path d="M10 21v-5h4v5"/></svg>`;
const isBasePart = (it) => !!it && it.kind === 'p' && !!C.PARTS[it.id].base;
function partLine(p) { return `<b class="g${p.g}">[${GR[p.g]}] ${C.PARTS[p.id].name}</b> ${C.partDesc(p)}`; }
function picHtml(p) { return `<span class="pic g${p.g}${C.PARTS[p.id].base ? ' bp' : ''}">${partIcon(p.id, 26)}</span>`; }
function partRow(p, attr, selected) {
  return `<button type="button" class="prow g${p.g}${selected ? ' sel' : ''}" ${attr}>${picHtml(p)}<span class="chip g${p.g}">${GR[p.g]}</span><span class="nm">${C.PARTS[p.id].name}</span><span class="ds">${C.partDesc(p)}</span></button>`;
}

/* ---------- 무기 칸 ---------- */
function renderWeapons() {
  const S = C.S; if (!S) return;
  if (drag) { needRender = true; return; }
  const picked = sel && sel.from === 'inv' ? S.inv[sel.i] : null;
  const upmode = upMode && !picked;
  const target = !!picked && !isBasePart(picked);
  let h = '';
  for (let k = 0; k < C.LANES; k++) {
    const w = S.slots[k];
    const mine = sel && sel.from === 'slot' && sel.k === k;
    const lk = S.locks && S.locks[k], cr = S.corr && S.corr.k === k, closed = C.isClosed(k);
    const wl = lk && lk.w > 0, cls = 'slot' + (w ? '' : ' empty') + (w && w.evo ? ' evo' : '') + (closed ? ' closed' : '') + (mine ? ' sel' : '') + (!closed && target && (picked.kind === 'w' || w) ? ' tg' : '') +
      (lk ? (lk.l > 0 ? ' locked' : ' warn-lock') : '') + (cr ? ' warn-corr' : '');
    h += `<button type="button" class="${cls}" data-slot="${k}"${w && w.evo ? ` style="--wc:${C.WEAPONS[w.type].color}"` : ''} aria-label="무기 칸 ${k + 1}${closed ? ' 폐쇄됨' : ''}">`;
    if (closed) h += `<svg class="xmark" viewBox="0 0 24 24" width="30" height="30" ${SVG_ATTR}><path d="M5 5l14 14M19 5L5 19" stroke-width="2.6"/></svg><small class="cl">폐쇄</small>`;
    else if (w) {
      h += icon(w.type, 26, w.evo) + `<b class="lv">${lvTxt(w)}</b><span class="pips">` +
        w.parts.map(p => `<i class="pp"${p ? ` style="background:${GHEX[p.g]};border-color:${GHEX[p.g]}"` : ''}></i>`).join('') +
        '</span><span class="pips">' +
        w.augs.map(a => `<i class="pa"${a ? ` style="background:${GHEX[a.g]};border-color:${GHEX[a.g]}"` : ''}></i>`).join('') + '</span>' +
        (upmode ? '<span class="upcue"><i></i><i></i></span>' : '') + (w.evo && C.skillPoints(w).left > 0 ? '<i class="skdot" aria-label="남은 스킬 포인트"></i>' : '');
    } else h += '<span class="plus">+</span>';
    if (lk && lk.l > 0) h += `<span class="lockic">${LOCK_SVG(22)}</span>`;
    if (wl) h += `<span class="abic lk">${LOCK_SVG(18)}</span><i class="cd" style="${cdStyle(lk.w)}"></i>`;
    if (cr) h += `<span class="abic cr"><b>-5</b></span><i class="cd" style="${cdStyle(S.corr.t)}"></i>`;
    h += '</button>';
  }
  elW.innerHTML = h;
  elW.classList.toggle('upmode', upmode);     // 강화 모드인 상태를 눈으로 알 수 있게
}
// 보스 능력 예고: 칸 표시에 쓰는 도우미
const AB_COL = { lock: '#ff3d5a', steal: '#ff4fa3', corr: '#c04bff' };
const LOCK_SVG = (n) => `<svg viewBox="0 0 24 24" width="${n}" height="${n}" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`;
const HAND_SVG = (n) => `<svg viewBox="0 0 24 24" width="${n}" height="${n}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 11V6a1.5 1.5 0 0 1 3 0v4.500M10.500 10V4.500a1.500 1.500 0 0 1 3 0V10M13.500 10V5.500a1.500 1.500 0 0 1 3 0V12M16.500 12V8.500a1.500 1.500 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.700L4.500 14a1.600 1.600 0 0 1 2.600-1.800l.4.500"/></svg>`;
// 줄어드는 막대: 애니메이션 길이와 시작 위치를 남은 시간에 맞춘다. 화면을 다시 그려도 끊기지 않고 이어진다
function cdStyle(rem) {
  const T = C.WARN_T, r = Math.max(0, Math.min(T, rem)), sp = speed || 1;
  return `--d:${(T / sp).toFixed(2)}s;--l:-${((T - r) / sp).toFixed(2)}s`;
}
// 지금 예고 중인 보스 능력 목록
function abList() {
  const S = C.S, out = [];
  if (!S) return out;
  for (const j of Object.keys(S.locks || {})) { const lk = S.locks[j]; if (lk.w > 0) out.push({ kind: 'lock', i: +j, rem: lk.w, nm: C.ENEMIES.jammer.name, txt: `${+j + 1}번 칸 잠금 예고` }); }
  if (S.steal) out.push({ kind: 'steal', i: S.steal.i, rem: S.steal.t, nm: C.ENEMIES.thief.name, txt: `인벤토리 ${S.steal.i + 1}번 칸 약탈 예고` });
  if (S.corr) out.push({ kind: 'corr', i: S.corr.k, rem: S.corr.t, nm: C.ENEMIES.corrode.name, txt: `${S.corr.k + 1}번 칸 강화 -5 예고` });
  return out;
}
const chipsEl = document.createElement('div'); chipsEl.id = 'abChips'; wrap.insertBefore(chipsEl, toastEl);   // 보스 체력 막대 바로 아래
function updateChips() {
  const L = abList(), key = L.map(a => a.kind + a.i).join('|');
  if (key === abKey) return;
  abKey = key;
  chipsEl.innerHTML = L.map(a => `<div class="abchip ${a.kind}" role="status"><span class="aic">${a.kind === 'lock' ? LOCK_SVG(14) : a.kind === 'steal' ? HAND_SVG(14) : '<b>-5</b>'}</span><span class="atx"><b>${a.nm}</b>: ${a.txt}</span><i class="cd" style="${cdStyle(a.rem)}"></i></div>`).join('');
}
// 발동하는 순간: 칸 위에 번쩍임
function abHitFx(kind, i) {
  const el = kind === 'steal' ? elB.querySelector(`[data-inv="${i}"]`) : elW.querySelector(`[data-slot="${i}"]`);
  if (!el) return;
  const a = $('#app').getBoundingClientRect(), r = el.getBoundingClientRect(), d = document.createElement('div');
  d.className = 'abhit'; d.style.setProperty('--c', AB_COL[kind]);
  d.style.left = (r.left - a.left) + 'px'; d.style.top = (r.top - a.top) + 'px'; d.style.width = r.width + 'px'; d.style.height = r.height + 'px';
  d.innerHTML = `<i></i><span>${kind === 'lock' ? LOCK_SVG(22) : kind === 'steal' ? HAND_SVG(22) : '<b>-5</b>'}</span>`;
  while (fxLayer.children.length > 8) fxLayer.firstChild.remove();
  fxLayer.appendChild(d);
  setTimeout(() => d.remove(), 800);
}
// 강화 결과 연출: 글자 없이 효과 위주. 성공하면 빛과 고리, 불꽃, 그리고 위로 올라가는 강화 단계. 실패하면 붉게 흔들리며 X 표시
function burstAt(el, ok, lv, drop, evo) {
  if (!el) return;
  const app = $('#app'), r = el.getBoundingClientRect(), a = app.getBoundingClientRect();
  const d = document.createElement('div');
  const cx = r.left - a.left + r.width / 2;
  d.className = 'upfx ' + (ok ? 'ok' : 'no') + (cx < 60 ? ' edge-l' : cx > a.width - 60 ? ' edge-r' : '');
  d.style.left = (r.left - a.left) + 'px'; d.style.top = (r.top - a.top) + 'px';
  d.style.width = r.width + 'px'; d.style.height = r.height + 'px';
  let inner = '<i class="glow"></i>';
  if (ok) {
    inner += `<i class="ring"></i><b>${evo ? '★+' : '+'}${lv}</b>`;
    for (let i = 0; i < 10; i++) {
      const an = i / 10 * Math.PI * 2, dist = 34 + Math.random() * 22;
      inner += `<s style="--dx:${(Math.cos(an) * dist).toFixed(0)}px;--dy:${(Math.sin(an) * dist).toFixed(0)}px"></s>`;
    }
  } else inner += '<u></u>' + (drop ? '<b>-1</b>' : '');
  d.innerHTML = inner;
  while (fxLayer.children.length > 5) fxLayer.firstChild.remove();
  fxLayer.appendChild(d);
  setTimeout(() => d.remove(), 1000);
}

// 밀수 꽝: 생성 버튼이 붉게 흔들리고 '꽝' 글자가 올라간다
function missFx(el) {
  if (!el) return;
  const a = $('#app').getBoundingClientRect(), r = el.getBoundingClientRect(), d = document.createElement('div');
  d.className = 'upfx no';
  d.style.left = (r.left - a.left) + 'px'; d.style.top = (r.top - a.top) + 'px'; d.style.width = r.width + 'px'; d.style.height = r.height + 'px';
  d.innerHTML = '<i class="glow"></i><b>꽝</b>';
  while (fxLayer.children.length > 5) fxLayer.firstChild.remove();
  fxLayer.appendChild(d);
  setTimeout(() => d.remove(), 1000);
}
// 용해로 연출: 칸에서 주황빛이 번지고 불씨가 위로 오른다. 게이지 막대도 잠깐 번쩍인다
function meltFx(el, r0) {
  if (RM.matches) return;
  const app = $('#app'), a = app.getBoundingClientRect(), r = r0 || (el && el.getBoundingClientRect());
  if (!r) return;
  const d = document.createElement('div');
  d.className = 'meltfx';
  d.style.left = (r.left - a.left) + 'px'; d.style.top = (r.top - a.top) + 'px';
  d.style.width = r.width + 'px'; d.style.height = r.height + 'px';
  let inner = '<i class="glow"></i>';
  for (let i = 0; i < 6; i++) inner += `<s style="--dx:${((Math.random() - 0.5) * 30).toFixed(0)}px;--dy:${(-22 - Math.random() * 22).toFixed(0)}px;--dl:${(Math.random() * 0.15).toFixed(2)}s"></s>`;
  d.innerHTML = inner;
  while (fxLayer.children.length > 8) fxLayer.firstChild.remove();
  fxLayer.appendChild(d);
  setTimeout(() => d.remove(), 700);
}
// 장착 효과: 칸에 '딱' 맞물리는 짧은 연출. 등급 색의 얇은 사각 테두리가 칸으로 줄어들며 붙고, 네 모서리 표식과 흰 섬광선이 한 번 지나간다 (번짐 없음)
function snapFx(el, g, host) {
  if (RM.matches || !el) return;
  const h = host || $('#app'), a = h.getBoundingClientRect(), r = el.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = 'eqfx'; d.style.setProperty('--c', GHEX[g]);
  d.style.left = (r.left - a.left) + 'px'; d.style.top = (r.top - a.top) + 'px';
  d.style.width = r.width + 'px'; d.style.height = r.height + 'px';
  d.innerHTML = '<i class="fr"><u class="tl"></u><u class="tr"></u><u class="bl"></u><u class="br"></u></i><i class="fl"></i>';
  if (!host) while (fxLayer.children.length > 8) fxLayer.firstChild.remove();
  (host || fxLayer).appendChild(d);
  setTimeout(() => d.remove(), 480);
}
// 무기 칸 또는 기지 파츠 버튼 위에 나온다
function equipFx(k, g) {
  snapFx(k === 'base' ? elB.querySelector('[data-act="bopen"]') : elW.querySelector(`[data-slot="${k}"]`), g);
}
// 전설 파츠가 새로 생기면 그 칸에서 금빛이 터진다 (생성, 제조, 보스 보상)
const legSeen = new WeakSet();
function legendMark() { for (const it of C.S.inv) if (it && it.kind === 'p' && it.g === 3) legSeen.add(it); }
function legendScan() { C.S.inv.forEach((it, i) => { if (it && it.kind === 'p' && it.g === 3 && !legSeen.has(it)) { legSeen.add(it); legendFx(i); } }); }
function legendFx(i) {
  Snd.play('legend');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = elB.querySelector(`[data-inv="${i}"]`); if (!el) return;
  const a = $('#app').getBoundingClientRect(), r = el.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = 'lgfx';
  d.style.left = (r.left - a.left) + 'px'; d.style.top = (r.top - a.top) + 'px';
  d.style.width = r.width + 'px'; d.style.height = r.height + 'px';
  let inner = '<i class="glow"></i><i class="ring"></i><i class="ring r2"></i>';
  for (let k = 0; k < 12; k++) {
    const an = k / 12 * Math.PI * 2 + Math.random() * 0.4, dist = 30 + Math.random() * 26;
    inner += `<s style="--dx:${(Math.cos(an) * dist).toFixed(0)}px;--dy:${(Math.sin(an) * dist).toFixed(0)}px"></s>`;
  }
  d.innerHTML = inner;
  while (fxLayer.children.length > 8) fxLayer.firstChild.remove();
  fxLayer.appendChild(d);
  setTimeout(() => d.remove(), 1000);
}
// 무기 창, 기지 창 안에서는 파츠를 받은 칸이 번쩍인다
function flashNode(k, g) { snapFx(elO.querySelector(`[data-wpart="${k}"]`), g, elO); }
// 강화 조각을 얻으면 강화 버튼이 잠깐 반짝인다
function pulseUp() {
  const b = $('#upBtn'); if (!b) return;
  b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
  setTimeout(() => b.classList.remove('pulse'), 700);
}
function gaugeFlash() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const g = elB.querySelector('.gbar'); if (!g) return;
  g.classList.remove('flash'); void g.offsetWidth; g.classList.add('flash');
}

// 진화 연출: 칸에서 무기 색의 빛이 번지고, 고리 두 개가 퍼지며, 불꽃이 사방으로 튀고 별이 떠오른다
function evoFx(el, color) {
  if (!el) return;
  const a = $('#app').getBoundingClientRect(), r = el.getBoundingClientRect(), d = document.createElement('div');
  d.className = 'evofx'; d.style.setProperty('--c', color);
  d.style.left = (r.left - a.left) + 'px'; d.style.top = (r.top - a.top) + 'px'; d.style.width = r.width + 'px'; d.style.height = r.height + 'px';
  let inner = '<i class="glow"></i><i class="ring"></i><i class="ring r2"></i><b>★</b>';
  for (let i = 0; i < 16; i++) {
    const an = i / 16 * Math.PI * 2 + Math.random() * 0.3, dist = 40 + Math.random() * 40;
    inner += `<s style="--dx:${(Math.cos(an) * dist).toFixed(0)}px;--dy:${(Math.sin(an) * dist - 14).toFixed(0)}px"></s>`;
  }
  d.innerHTML = inner;
  while (fxLayer.children.length > 8) fxLayer.firstChild.remove();
  fxLayer.appendChild(d);
  setTimeout(() => d.remove(), 1300);
}
// 진화가 풀릴 때: 붉은 금이 가며 조각이 아래로 흩어진다
function devoFx(el) {
  if (!el) return;
  const a = $('#app').getBoundingClientRect(), r = el.getBoundingClientRect(), d = document.createElement('div');
  d.className = 'devofx';
  d.style.left = (r.left - a.left) + 'px'; d.style.top = (r.top - a.top) + 'px'; d.style.width = r.width + 'px'; d.style.height = r.height + 'px';
  let inner = '<i class="glow"></i><u></u>';
  for (let i = 0; i < 8; i++) inner += `<s style="--dx:${((i - 3.5) * 9).toFixed(0)}px;--dy:${(18 + Math.random() * 18).toFixed(0)}px"></s>`;
  d.innerHTML = inner;
  while (fxLayer.children.length > 8) fxLayer.firstChild.remove();
  fxLayer.appendChild(d);
  setTimeout(() => d.remove(), 1000);
}
// 진화 연출: 전장 한가운데에서 약 1.8초. 무기 아이콘이 크게 뜨고 무기 색 광선과 고리가 돌며, 번쩍임 뒤에 '진화' 글자가 나온다. 끝나면 칸에서 기존 효과
function evoCeremony(w, k) {
  const d = C.WEAPONS[w.type], c = d.color;
  Snd.play('evolve');
  cerEl.style.setProperty('--c', c);
  cerEl.innerHTML = `<i class="ec-dim"></i><i class="ec-flash"></i>
    <div class="ec-stage"><i class="ec-rays"></i><i class="ec-rays r2"></i><i class="ec-ring"></i><i class="ec-ring r2"></i><div class="ec-ic">${icon(w.type, 120, true)}</div></div><b class="ec-t">진화</b><span class="ec-n">${d.name}</span>`;
  cerEl.classList.remove('show'); void cerEl.offsetWidth; cerEl.classList.add('show');
  cerUntil = performance.now() + 1800;
  setTimeout(() => { if (performance.now() >= cerUntil - 20) cerEl.classList.remove('show'); }, 1850);
  setTimeout(() => {                         // 연출이 끝난 뒤 칸 효과 (그 사이 무기가 바뀌었으면 하지 않는다)
    const S = C.S; if (!S || S.slots[k] !== w || !w.evo || mode === 'over') return;
    evoFx(elW.querySelector(`[data-slot="${k}"]`), c);
  }, 1800);
}
// 보스 보상 연출: 죽은 자리에서 등급 색 아이콘이 떠올라 약 0.9초 머문 뒤 들어간 인벤토리 칸으로 날아간다. 칸이 없어 대기 중이면 위로 사라진다
function bossRewards(list) {
  const S = C.S, a = $('#app').getBoundingClientRect(), wr = wrap.getBoundingClientRect(), RMo = RM.matches;
  for (const r of list) {
    const it = r.item, inInv = S.inv.indexOf(it) >= 0;
    if (inInv) { incoming.add(it); if (it.kind === 'p' && it.g === 3) legSeen.add(it); }   // 전설 금빛은 도착할 때 낸다
    const col = it.kind === 'w' ? C.WEAPONS[it.type].color : GHEX[it.g];
    const off = (r.k - (r.n - 1) / 2) * 56;
    const x = Math.max(34, Math.min(a.width - 34, wr.left - a.left + r.x * sc + off)), y = Math.max(46, Math.min(wr.top - a.top + wr.height - 40, wr.top - a.top + r.y * sc));
    const d = document.createElement('div');
    d.className = 'rw'; d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.setProperty('--c', col);
    d.innerHTML = `<span class="rw-ic">${it.kind === 'w' ? icon(it.type, 34) : partIcon(it.id, 34)}</span><span class="rw-l">보스 보상</span>`;
    d._item = it; d.dataset.until = performance.now() + 2600;
    while (rewLayer.children.length > 6) { const f = rewLayer.firstChild; incoming.delete(f._item); f.remove(); }
    rewLayer.appendChild(d);
    Snd.play('rewpop');
    const finish = () => { incoming.delete(it); const i = C.S.inv.indexOf(it); const cell = i >= 0 && elB.querySelector(`[data-inv="${i}"]`); if (cell) cell.classList.remove('incoming'); return cell; };
    setTimeout(() => {                         // 머문 뒤: 날아가기
      if (!d.isConnected) return;
      const i = C.S === S ? S.inv.indexOf(it) : -1, cell = i >= 0 && elB.querySelector(`[data-inv="${i}"]`);
      d.classList.add('go');
      if (cell && !RMo) {
        const cr = cell.getBoundingClientRect();
        d.style.left = (cr.left - a.left + cr.width / 2) + 'px'; d.style.top = (cr.top - a.top + cr.height / 2) + 'px'; d.classList.add('fly');
        setTimeout(() => { const c2 = finish(); d.remove(); if (c2) { Snd.play('rewland'); c2.classList.remove('new'); void c2.offsetWidth; c2.classList.add('new'); if (it.kind === 'p' && it.g === 3) legendFx(+c2.dataset.inv); } }, 520);
      } else {
        d.classList.add('rise');               // 대기 중(칸이 가득 참): 위로 사라진다
        setTimeout(() => { finish(); d.remove(); }, 480);
      }
    }, 1150);
    setTimeout(() => { finish(); d.remove(); }, 2700);   // 어떤 경우에도 멈춰 남지 않게
  }
}
// 화면에 알릴 진화 사건 (진화가 풀림). quiet: 알림 글은 따로 알리므로 효과만
function drainEvq(quiet) {
  const S = C.S; if (!S || !S.evq || !S.evq.length) return;
  for (const e of S.evq.splice(0)) {
    if (e.k !== 'devo') continue;
    if (skK === e.slot) { skK = -1; skSel = null; }
    if (evoK === e.slot) evoK = -1;
    renderWeapons(); renderOverlay();
    Snd.play('hitcorr');
    devoFx(elW.querySelector(`[data-slot="${e.slot}"]`));
    if (!quiet) say(`<b>진화가 풀렸습니다</b> ${C.WEAPONS[e.type].name} +100`, true, 3200);
  }
}

/* ---------- 하단 인벤토리 ---------- */
function itemInfo(it) {
  if (it.kind === 'w') { const d = C.WEAPONS[it.type]; return `<b style="color:${d.color}">${d.name} ${lvTxt(it)}</b> ${d.desc}`; }
  if (it.kind === 'p') return (isBasePart(it) ? '<b class="btag">기지 파츠</b> ' : '') + partLine(it);
  return '';
}
// 제조 확률을 정수 %로 (합이 정확히 100이 되도록 가장 큰 나머지부터 올린다)
function oddsPct() {
  const raw = C.craftOdds(), fl = raw.map(Math.floor); let rest = 100 - fl.reduce((a, b) => a + b, 0);
  raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { fl[i]++; rest--; } });
  return fl;
}
function bupText(u) { return u.max ? '최대' : `필요 ${u.cost} · ${Math.round(u.rate * 100)}%`; }
// 설명 줄. 아무것도 고르지 않았을 때는 기지 파츠, 기지 강화 버튼이 들어간다
function infoHtml() {
  const S = C.S;
  if (meltMode) {
    const cc = C.craftCost(), pct = Math.min(100, C.meltCount() / cc * 100), od = oddsPct();
    return `<span class="ml1"><b class="mtag">용해로 켜짐</b><b>게이지 ${fmtInt(C.meltCount())} / ${fmtInt(cc)}</b><span class="gbar"><i style="width:${pct}%"></i></span></span>` +
      `<span class="odds"><span class="g1">희귀 ${od[1]}%</span> · <span class="g2">영웅 ${od[2]}%</span> · <span class="g3">전설 ${od[3]}%</span></span>`;
  }
  if (sel && sel.from === 'inv' && S.inv[sel.i]) return itemInfo(S.inv[sel.i]);
  if (sel && sel.from === 'slot' && S.slots[sel.k]) {
    const w = S.slots[sel.k], d = C.WEAPONS[w.type];
    return `<b style="color:${d.color}">${d.name} ${lvTxt(w)}</b> 한 번 더 누르면 무기 창이 열립니다. 자리를 옮기려면 끌어다 놓으세요.`;
  }
  const b = S.base, u = C.upgradeInfo(b), n = b.parts.filter(Boolean).length;
  return `<button type="button" class="bbtn" data-act="bopen">${BASEICON(16)} 기지 파츠 <b>${n}/${C.CFG.baseSlots}</b></button>` +
    `<button type="button" class="bbtn up${!u.max && u.have >= u.cost ? '' : ' off'}" id="bupBtn" data-act="bup">기지 강화 <b>+${b.lv}</b><small id="bupTxt">${bupText(u)}</small></button>`;
}
function updateInfo() {
  const el = elB.querySelector('.info'); if (!el) return;
  el.innerHTML = infoHtml();
  el.classList.toggle('bar', !meltMode && !sel);
}
function cellHtml(it, i) {
  let inner = '', cls = 'cell';
  if (!it) cls += ' empty';
  else if (it.kind === 'w') { inner = icon(it.type, 20, it.evo) + `<b>${lvTxt(it)}</b>`; cls += ' kw' + (it.evo ? ' evo' : ''); }
  else if (it.kind === 'p') { inner = partIcon(it.id, 26); cls += ' kp g' + it.g + (isBasePart(it) ? ' kb' : ''); }
  const meltable = meltMode && !!it && (it.kind === 'p' || it.kind === 'w');
  if (meltMode) cls += meltable ? ' meltable' : ' dim';
  if (meltable && meltSet.has(i)) { cls += ' msel'; inner += `<span class="mchk"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.500 4.500L19 7.500"/></svg></span>`; }
  else if (meltable) inner += '<span class="mcue"><i></i><i></i></span>';
  if (!meltMode && sel && sel.from === 'inv' && sel.i === i) cls += ' sel';
  if (i === newCell) cls += ' new';
  if (it && incoming.has(it)) cls += ' incoming';
  const st = C.S.steal && C.S.steal.i === i;
  if (st) { cls += ' warn-steal'; inner += `<span class="abic st">${HAND_SVG(13)}</span><i class="cd" style="${cdStyle(C.S.steal.t)}"></i>`; }
  return `<button type="button" class="${cls}" data-inv="${i}" aria-label="인벤토리 ${i + 1}번 칸${meltable && meltSet.has(i) ? ' 선택됨' : ''}">${inner}</button>`;
}
// 지금 가진 조각으로 강화할 수 있는 무기나 기지가 있는가
function canUp() {
  const S = C.S; if (!S) return false;
  for (const t of S.slots.concat([S.base])) { if (!t) continue; const u = C.upgradeInfo(t); if (!u.max && u.have >= u.cost) return true; }
  return false;
}
function invHtml() {
  const S = C.S;
  let acts, cols = '';
  if (meltMode) {
    cols = ' three';
    const cc = C.craftCost(), n = meltSet.size, v = n ? [...meltSet].reduce((a, i) => a + C.meltValue(S.inv[i]), 0) : C.meltAllValue().pts;
    const label = n ? `선택 분해 ${n}개` : meltAllArm ? '정말 모두 분해' : '모두 분해';
    acts = `<button type="button" class="btn primary${C.meltCount() >= cc ? '' : ' off'}" data-act="craft">제조 <small>게이지 ${cc}</small></button>
      <button type="button" class="btn ember stk${meltAllArm && !n ? ' danger' : ''}" data-act="meltBulk"><span>${label}</span><small>게이지 +${v}</small></button>
      <button type="button" class="btn" data-act="meltOff">닫기</button>`;
  } else if (!sel) {
    cols = ' three3';
    const canGen = C.goldCount() >= C.genCost() && C.freeSlot() >= 0;
    acts = `<button type="button" class="btn primary gen${canGen ? ' hint' : ' off'}" id="genBtn" data-act="gen"><span class="gc"><b id="genHave">◆ ${fmtInt(C.goldCount())}</b><small id="genCost">비용 ${C.genCost()}</small></span><span>생성</span></button>
      <button type="button" class="btn up${upMode ? ' on' : ''}${canUp() ? ' hint' : ''}" id="upBtn" data-act="upMode"><span class="gc"><b class="shb">${SHARD}<span id="upHave">${fmtInt(C.shardCount())}</span></b></span><span>강화</span></button>
      <button type="button" class="btn melt${C.meltCount() >= C.craftCost() ? ' ready' : ''}" data-act="meltOn"><span class="mlb">${FLAME}<span>용해로</span><b data-n="${String(fmtInt(C.meltCount())).length}">${fmtInt(C.meltCount())}</b></span></button>`;
  } else if (sel.from === 'inv') {
    const it = S.inv[sel.i];
    const armed = confirmDrop && dropArmI === sel.i && armWhat === 'drop', marm = confirmDrop && dropArmI === sel.i && armWhat === 'melt';
    const drop = `<button type="button" class="btn${armed ? ' armed' : ''}" data-act="drop">${armed ? '한 번 더 누르면 버림' : '버리기'}</button>`;
    const melt = it && (it.kind === 'p' || it.kind === 'w') ? `<button type="button" class="btn ember${marm ? ' armed' : ''}" data-act="meltOne">${marm ? '한 번 더 누르면 분해' : `분해 <small>+${C.meltValue(it)}</small>`}</button>` : '';
    if (it && isBasePart(it)) { cols = ' three2'; acts = '<button type="button" class="btn primary" data-act="bequip">기지에 장착</button>' + melt + drop; }
    else { cols = melt ? ' two2' : ''; acts = melt + drop; }
  } else {
    acts = '<button type="button" class="btn" data-act="wopen">무기 창 열기</button>';
  }
  return `<div class="info"></div>
    <div class="inv${meltMode ? ' melting' : ''}">${S.inv.map(cellHtml).join('')}</div>
    <div class="acts${cols}">${acts}</div>`;
}
function upText(t) {
  const u = C.upgradeInfo(t);
  return u.max ? '최대 강화' : `필요 ${u.cost} · 보유 ${fmtInt(u.have)} · 성공 ${Math.round(u.rate * 100)}%`;
}
function renderBottom() {
  const S = C.S; if (!S) return;
  if (drag) { needRender = true; return; }
  if (sel && sel.from === 'slot' && !S.slots[sel.k]) sel = null;
  if (sel && sel.from === 'inv' && !S.inv[sel.i]) sel = null;
  if (!sel) confirmDrop = false;
  for (const i of [...meltSet]) { const it = S.inv[i]; if (!meltMode || !it || (it.kind !== 'p' && it.kind !== 'w')) meltSet.delete(i); }
  elB.classList.toggle('melting', meltMode);     // 용해로 모드인 상태를 눈으로 알 수 있게 (강화 모드의 무기 칸 표시와 같은 방식)
  elB.innerHTML = invHtml();
  updateInfo();
}
function meltNow() { const m = C.meltCount(); return m === Infinity ? '∞' : m; }
function renderAll() { abKey = ''; syncTest(); renderWeapons(); renderBottom(); renderOverlay(); updateChips(); updateMark(); }
// 자주 바뀌는 숫자만 가볍게 갱신 (버튼을 새로 만들지 않아 누르는 도중에 끊기지 않는다)
function lightUpdate() {
  const S = C.S; if (!S) return;
  updateChips(); updateMark();
  for (let k = 0; k < C.LANES; k++) {       // 예열: 무기 칸이 붉게 빛난다
    const w = S.slots[k], cell = elW.children[k]; if (!cell) continue;
    const h = w && w.evo ? C.heatLevel(w) : 0;
    if (h > 0) { cell.classList.add('heat'); cell.style.setProperty('--heat', h.toFixed(2)); }
    else if (cell.classList.contains('heat')) { cell.classList.remove('heat'); cell.style.removeProperty('--heat'); }
  }
  if (bannerEl.classList.contains('show') && performance.now() > bannerUntil) bannerEl.classList.remove('show');
  if (cerEl.classList.contains('show') && performance.now() > cerUntil) cerEl.classList.remove('show');      // 진화 연출이 멈춰 남지 않게
  for (const d of rewLayer.children) if (performance.now() > +d.dataset.until) { incoming.delete(d._item); d.remove(); }
  if (confirmDrop && performance.now() - dropArmAt > 3000) {      // 3초가 지나면 버리기 무장 해제 (버튼을 새로 만들지 않고 그 자리에서 되돌린다)
    confirmDrop = false;
    const b = elB.querySelector('[data-act="drop"].armed'); if (b) { b.classList.remove('armed'); b.textContent = '버리기'; }
    const m = elB.querySelector('[data-act="meltOne"].armed'); const it = sel && sel.from === 'inv' ? C.S.inv[sel.i] : null;
    if (m && it) { m.classList.remove('armed'); m.innerHTML = `분해 <small>+${C.meltValue(it)}</small>`; }
  }
  if (toastEl.classList.contains('show') && performance.now() > msgUntil) {
    toastEl.classList.remove('show');
    if (msg) { msg = ''; updateWInfo(); }
  }
  const g = $('#genBtn');
  if (g) {
    const can = C.goldCount() >= C.genCost() && C.freeSlot() >= 0;
    g.classList.toggle('off', !can); g.classList.toggle('hint', can);
    const h = $('#genHave'), ht = '◆ ' + fmtInt(C.goldCount()); if (h.textContent !== ht) h.textContent = ht;
    const c = $('#genCost'), t = '비용 ' + C.genCost(); if (c.textContent !== t) c.textContent = t;
  }
  const ub = $('#upBtn');
  if (ub) { const h = $('#upHave'), t = fmtInt(C.shardCount()); if (h.textContent !== t) h.textContent = t; ub.classList.toggle('hint', canUp()); }
  const bu = $('#bupBtn');
  if (bu) {
    const u = C.upgradeInfo(S.base), t = bupText(u), el = $('#bupTxt');
    if (el.textContent !== t) el.textContent = t;
    bu.classList.toggle('off', u.max || u.have < u.cost);
  }
}

/* ---------- 무기 창과 기지 창 ---------- */
function wInfoHtml(text) {
  if (msg) return `<span class="${msgWarn ? 'warn' : ''}">${msg}</span>`;
  return `<span>${text}</span>`;
}
function modalInfoText() {
  const S = C.S;
  if (bmodal) return '기지 파츠 칸을 누르면 바꾸거나 새로 장착합니다. 기지 파츠의 효과는 모든 무기와 기지에 적용됩니다.';
  const w = S.slots[wmodal];
  return w ? C.WEAPONS[w.type].desc + '. 파츠 칸을 누르면 바꾸거나 새로 장착합니다.' : '';
}
function updateWInfo() {
  const el = $('#wmInfo');
  if (el && C.S && (wmodal >= 0 || bmodal)) el.innerHTML = wInfoHtml(modalInfoText());
}
function augRows(augs) {
  return augs.map(a => a
    ? `<div class="arow g${a.g}"><span class="chip g${a.g}">${GR[a.g]}</span><b>${C.AUGS[a.id].name}</b><span class="ds">${C.augDesc(a)}</span></div>`
    : '<div class="arow empty">증강</div>').join('');
}
function partNodes(parts, pre) {
  return parts.map((p, k) => p
    ? `<button type="button" class="pt ${pre}${k} g${p.g}" data-wpart="${k}">${partIcon(p.id, 22)}<small>${C.PARTS[p.id].name}</small></button>`
    : `<button type="button" class="pt ${pre}${k} empty" data-wpart="${k}">파츠</button>`).join('');
}
function coreCls() { return lastUp && performance.now() - lastUp.at < 900 ? (lastUp.ok ? ' up-ok' : ' up-no') : ''; }
function wmHtml(w) {
  const S = C.S, st = C.stats(w), d = C.WEAPONS[w.type], u = C.upgradeInfo(w);
  const dealt = w.dealt || 0, share = S.dealt > 0 ? Math.round(dealt / S.dealt * 100) : 0;
  return `<div class="modal wm">
    <div class="wm-head">
      <div><span class="nm" style="color:${d.color}">${d.name} ${lvTxt(w)}</span>
      <span class="st">공격력 ${fmt(st.dmg)} · 간격 ${st.cd.toFixed(2)}초 · 치명 ${Math.round(st.crit * 100)}%</span></div>
      <button type="button" class="x" data-act="wclose">닫기</button>
    </div>
    <div class="schem">
      <span class="lab">파츠</span>
      <svg class="wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M50 54L50 16M50 54L17 84M50 54L83 84" fill="none" stroke="${d.color}" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="core${coreCls()}${w.evo ? ' evo' : ''}" style="border-color:${d.color};--wc:${d.color}">${icon(w.type, 46, w.evo)}<b>${lvTxt(w)}</b></div>
      ${partNodes(w.parts, 'p')}
    </div>
    <div class="wm-info" id="wmInfo">${wInfoHtml(modalInfoText())}</div>
    <div class="wm-sec">증강</div>
    <div class="wm-augs">${augRows(w.augs)}</div>
    <div class="rec"><div><small>처치</small><b>${fmtInt(w.kills || 0)}</b></div><div><small>누적 피해</small><b>${fmt(dealt)}</b></div><div><small>전체 피해 중</small><b>${share}%</b></div></div>
    <div class="d-acts">
      <button type="button" class="btn primary${!u.max && u.have >= u.cost ? '' : ' off'}" data-act="wup">강화 <small>${upText(w)}</small></button>
      <button type="button" class="btn" data-act="wunequip">장착 해제</button>
    </div>${evoRow(w)}</div>`;
}
// 무기 창의 진화 / 스킬 버튼 줄
function evoRow(w) {
  if (w.evo) {
    const n = C.skillPoints(w).left;
    return `<div class="d-acts one"><button type="button" class="btn evob${n > 0 ? ' has' : ''}" data-act="skOpen" style="--wc:${C.WEAPONS[w.type].color}">★ 스킬 <small>${n > 0 ? `남은 포인트 <b>${n}</b>` : '남은 포인트 0'}</small></button></div>`;
  }
  if (w.lv >= C.CFG.maxLv) return `<div class="d-acts one"><button type="button" class="btn evob has" data-act="evoOpen" style="--wc:${C.WEAPONS[w.type].color}">★ 진화 <small>조각 ${C.CFG.evoCost}</small></button></div>`;
  return '';
}
function bmHtml() {
  const S = C.S, b = S.base, bs = C.bstats(), u = C.upgradeInfo(b);
  const extra = [];
  const red = 1 - (1 - bs.shield) * (1 - bs.dmgRed);   // 방패와 기지 증강의 피해 감소를 합친 값
  if (red > 0) extra.push(`받는 피해 -${Math.round(red * 100)}%`);
  if (bs.regenPct) extra.push(`초당 체력 ${+(bs.regenPct * 100).toFixed(2)}% 회복`);
  if (bs.luck) extra.push(`강화 성공 +${Math.round(bs.luck * 100)}%p`);
  return `<div class="modal wm bm">
    <div class="wm-head">
      <div><span class="nm bcol">기지 +${b.lv}</span>
      <span class="st">최대 체력 ${bs.maxHp}${extra.length ? ' · ' + extra.join(' · ') : ''}</span></div>
      <button type="button" class="x" data-act="wclose">닫기</button>
    </div>
    <div class="schem base">
      <svg class="wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M50 50L20 16M50 50L80 16M50 50L20 84M50 50L80 84" fill="none" stroke="#7af0c1" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="core bcore${coreCls()}">${BASEICON(44)}<b>+${b.lv}</b></div>
      ${partNodes(b.parts, 'b')}
    </div>
    <div class="wm-info" id="wmInfo">${wInfoHtml(modalInfoText())}</div>
    <div class="wm-sec">기지 증강</div>
    <div class="wm-augs">${augRows(b.augs)}</div>
    ${pactListHtml()}
    <div class="rec"><div><small>체력</small><b>${Math.ceil(S.hp)}/${S.maxHp}</b></div><div><small>기지가 처치</small><b>${fmtInt(b.kills || 0)}</b></div><div><small>기지가 준 피해</small><b>${fmt(b.dealt || 0)}</b></div></div>
    <div class="d-acts one">
      <button type="button" class="btn primary${!u.max && u.have >= u.cost ? '' : ' off'}" data-act="bup">강화 <small>${upText(b)} · 단계마다 체력 +${C.CFG.baseHpPerLv}</small></button>
    </div></div>`;
}
/* ---------- 진화 창과 스킬 창 ---------- */
function evoHtml() {
  const w = C.S.slots[evoK], d = C.WEAPONS[w.type], c = C.canEvolve(evoK), ok = c.ok;
  return `<div class="modal evom"><h2>진화</h2>
    <div class="evo-w" style="--wc:${d.color}"><span class="evo-ic">${icon(w.type, 40)}</span><span class="evo-arr">${ARROW}</span><span class="evo-ic on">${icon(w.type, 40, true)}</span>
      <div class="evo-nm"><b style="color:${d.color}">${d.name}</b><span>+100 → ★+0</span></div></div>
    <div class="evo-cost${c.reason === 'shards' ? ' short' : ''}">${SHARD}<b>조각 ${fmtInt(c.cost)}</b><span>보유 <b>${fmtInt(c.have)}</b></span></div>
    <ul class="evo-list"><li>0강으로 돌아가지만 능력은 유지</li><li>강화 비용 100 + 일반의 5배, 5강마다 스킬 포인트</li><li>0강 아래로 떨어지면 진화가 풀림</li></ul>
    ${c.reason === 'shards' ? `<p class="warn">조각이 ${fmtInt(c.cost - c.have)}개 모자랍니다.</p>` : ''}
    <div class="d-acts two"><button type="button" class="btn primary${ok ? '' : ' off'}" data-act="evoOk"${ok ? '' : ' disabled'}>진화한다</button><button type="button" class="btn" data-act="evoClose">닫기</button></div></div>`;
}
const SK_LOCK = `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>`;
const SK_KIND = { root: '기본', up: '강화', cap: '최종' };
function skFirst(w) {   // 열 때 고를 노드: 지금 찍을 수 있는 첫 노드 (없으면 첫 칸)
  for (let l = 0; l < 3; l++) for (let t = 0; t < 3; t++) if (C.skillInfo(w, l, t).can) return { l, t };
  return { l: 0, t: 0 };
}
function skillHtml() {
  const w = C.S.slots[skK], d = C.WEAPONS[w.type], P = C.skillPoints(w), tree = C.SKILLS[w.type];
  if (!skSel) skSel = skFirst(w);
  const cols = tree.map((line, l) => {
    const tiles = [2, 1, 0].map((t) => {
      const i = C.skillInfo(w, l, t), nm = i.name;
      const cls = 'skt ' + (t === 2 ? 'cap' : '') + (i.locked ? ' lock' : '') + (i.rank >= i.max ? ' full' : i.rank > 0 ? ' has' : '') + (i.can ? ' can' : '') +
        (skSel.l === l && skSel.t === t ? ' sel' : '') + (skGot && skGot.l === l && skGot.t === t ? ' got' : '');
      const conn = t > 0 ? `<i class="skc${C.skillInfo(w, l, t - 1).rank >= C.skillInfo(w, l, t - 1).max ? ' on' : ''}"></i>` : '';
      return `<button type="button" class="${cls}" data-sk="${l}:${t}" aria-label="${nm} ${i.rank}/${i.max}${i.locked ? ' 잠김' : ''}"><span class="skn">${nm}</span><b class="skr">${i.rank}/${i.max}</b>${i.locked ? `<span class="skl">${SK_LOCK}</span>` : ''}</button>${conn}`;
    });
    return `<div class="skcol"><div class="sktiles">${tiles.join('')}</div><b class="sklab">${line.name}</b></div>`;
  }).join('');
  const i = C.skillInfo(w, skSel.l, skSel.t), cur = C.skillText(w, skSel.l, skSel.t, i.rank), nxt = i.rank < i.max ? C.skillText(w, skSel.l, skSel.t, i.rank + 1) : '';
  const prev = skSel.t > 0 ? C.skillInfo(w, skSel.l, skSel.t - 1) : null;
  let body;
  if (i.locked) body = `<span class="skreq">${prev.name} ${prev.max}/${prev.max}을(를) 먼저 찍어야 합니다. (지금 ${prev.rank}/${prev.max})</span>` + (nxt ? `<span class="skfx dim">${nxt}</span>` : '');
  else if (i.rank >= i.max) body = `<span class="skfx">${cur}</span><span class="skreq">최대 랭크입니다.</span>`;
  else body = `<span class="skfx${i.rank ? '' : ' dim'}">${i.rank ? cur : '아직 찍지 않음'}</span><span class="skarr">▼</span><span class="skfx nx">${nxt}</span>`;
  const why = i.can ? '' : i.locked ? '' : i.rank >= i.max ? '' : '<span class="skreq">남은 포인트가 없습니다.</span>';
  return `<div class="modal skm" style="--wc:${d.color}"><div class="wm-head"><div><h2>스킬</h2><span class="st"><b style="color:${d.color}">${d.name} ${lvTxt(w)}</b></span></div>
      <span class="skpts${P.left > 0 ? ' has' : ''}">남은 포인트 <b>${P.left}</b></span></div>
    <div class="skgrid">${cols}</div>
    <div class="skdet"><div class="skhd"><b>${i.name}</b><span class="skk">${SK_KIND[i.node.t]}</span><span class="skrk">${i.rank}/${i.max}</span></div>${body}${why}</div>
    <div class="d-acts two"><button type="button" class="btn primary${i.can ? '' : ' off'}" data-act="skUp"${i.can ? '' : ' disabled'}>찍기</button><button type="button" class="btn" data-act="skClose">닫기</button></div></div>`;
}
// 비교 창: 왼쪽은 지금 장착한 것(바뀌는 것), 오른쪽은 새로 넣을 것. 글이 길면 줄바꿈한다
const partItem = (p) => ({ g: p.g, pic: picHtml(p), nm: C.PARTS[p.id].name, ds: C.partDesc(p) });
const augItem = (a) => ({ g: a.g, nm: C.AUGS[a.id].name, ds: C.augDesc(a) });
function cmpSide(lab, x) {
  const body = x.txt ? `<span class="ct">${x.txt}</span>`
    : `<span class="ch">${x.pic || ''}<span class="chip g${x.g}">${GR[x.g]}</span></span><b class="nm">${x.nm}</b><span class="ds">${x.ds}</span>`;
  return `<div class="cbox${x.txt ? ' none' : ' g' + x.g}"><small class="cl">${lab}</small>${body}</div>`;
}
const ARROW = '<span class="arr" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg></span>';
function cmpHtml(l, r) { return `<div class="cmp">${cmpSide(l.lab, l.x)}${ARROW}${cmpSide(r.lab, r.x)}</div>`; }
// 무기의 k번 파츠 칸을 np로 바꿨을 때의 능력치 변화. 복사본에 적용하므로 게임 상태는 바뀌지 않는다
function statDeltaHtml(w, k, np) {
  const cp = Object.assign({}, w, { parts: w.parts.slice() });
  cp.parts[k] = np;
  const a = C.stats(w), b = C.stats(cp);
  const line = (lab, x, y, f, lowGood) => {
    const better = lowGood ? y < x - 1e-9 : y > x + 1e-9, worse = lowGood ? y > x + 1e-9 : y < x - 1e-9;
    return `<span class="sd ${better ? 'up' : worse ? 'dn' : ''}">${lab} ${f(x)} → ${f(y)}</span>`;
  };
  return `<div class="sdelta">${line('공격력', a.dmg, b.dmg, fmt, false)}${line('공격 간격', a.cd, b.cd, v => v.toFixed(2) + '초', true)}</div>`;
}
// 파츠 고르기 창: 무기 창이나 기지 창에서 파츠 칸을 눌렀을 때
function wpickHtml(k) {
  const S = C.S, holder = bmodal ? S.base : S.slots[wmodal], cur = holder.parts[k];
  const name = bmodal ? `<b class="bcol">기지 +${holder.lv}</b>` : `<b style="color:${C.WEAPONS[holder.type].color}">${C.WEAPONS[holder.type].name} ${lvTxt(holder)}</b>`;
  if (cur && wpickNew >= 0 && S.inv[wpickNew]) {   // 이미 파츠가 있는 칸: 새것과 지금 것을 견주어 본다
    return `<div class="modal wm">
      <div class="wm-head"><div><span class="nm">파츠 교체</span><span class="st">${name}의 ${k + 1}번 파츠 칸</span></div></div>
      ${cmpHtml({ lab: '지금 장착한 파츠', x: partItem(cur) }, { lab: '새로 넣을 파츠', x: partItem(S.inv[wpickNew]) })}
      ${bmodal ? '' : statDeltaHtml(holder, k, S.inv[wpickNew])}
      <p class="cur">빠진 파츠는 인벤토리로 돌아갑니다.</p>
      <div class="d-acts two"><button type="button" class="btn primary" data-act="wputOk">교체</button><button type="button" class="btn" data-act="wputBack">뒤로</button></div></div>`;
  }
  const rows = S.inv.map((it, i) => it && it.kind === 'p' && isBasePart(it) === bmodal ? partRow(it, `data-wput="${i}"`) : '').join('');
  return `<div class="modal wm wpk">
    <div class="wm-head">
      <div><span class="nm">파츠 고르기</span><span class="st">${name}의 ${k + 1}번 파츠 칸</span></div>
      <button type="button" class="x" data-act="wpickBack">뒤로</button>
    </div>
    ${cur ? `<div class="wm-sec">지금 장착한 파츠</div>
      <div class="curpart g${cur.g}">${picHtml(cur)}<span class="tx">${partLine(cur)}</span><button type="button" class="btn sm" data-act="wdetach">해제</button></div>` : ''}
    ${msg ? `<p class="warn">${msg}</p>` : ''}
    <div class="wm-sec">인벤토리의 ${bmodal ? '기지 ' : ''}파츠 (누르면 ${cur ? '비교 후 교체' : '장착'})</div>
    <div class="plist">${rows || `<p>인벤토리에 ${bmodal ? '기지 ' : '무기 '}파츠가 없습니다.</p>`}</div></div>`;
}
// 파츠 교체 창: 인벤토리의 파츠를 가득 찬 무기나 기지에 넣을 때. 위에서 견주고 아래에서 바뀔 파츠를 고른다
function swapHtml() {
  const S = C.S, it = S.inv[partSwap.i], isBase = partSwap.k === 'base';
  const holder = isBase ? S.base : S.slots[partSwap.k];
  const name = isBase ? `<b class="bcol">기지 +${holder.lv}</b>` : `<b style="color:${C.WEAPONS[holder.type].color}">${C.WEAPONS[holder.type].name} ${lvTxt(holder)}</b>`;
  const cur = partSwap.sel >= 0 ? holder.parts[partSwap.sel] : null;
  return `<div class="modal wm">
    <div class="wm-head"><div><span class="nm">파츠 교체</span><span class="st">${name}의 파츠 칸이 가득 찼습니다</span></div></div>
    ${cmpHtml({ lab: '교체될 파츠', x: cur ? partItem(cur) : { txt: '아래에서 고르세요' } }, { lab: '새로 넣을 파츠', x: partItem(it) })}
    ${cur && !isBase ? statDeltaHtml(holder, partSwap.sel, it) : ''}
    <div class="wm-sec">교체될 파츠를 고르세요 (빠진 파츠는 인벤토리로)</div>
    <div class="plist">${holder.parts.map((p, k) => p ? partRow(p, `data-prep="${k}"`, k === partSwap.sel) : '').join('')}</div>
    <div class="d-acts two"><button type="button" class="btn primary${cur ? '' : ' off'}" data-act="pswapOk"${cur ? '' : ' disabled'}>교체</button><button type="button" class="btn" data-act="pswapCancel">취소</button></div></div>`;
}

/* ---------- 겹침 창 ---------- */
function recHtml(r) {
  return `<div class="rec"><div><small>생존 시간</small><b>${fmtTime(r.t)}</b></div><div><small>처치</small><b>${r.kills}</b></div>${r.boss != null ? `<div><small>보스 처치</small><b>${r.boss}</b></div>` : ''}</div>`;
}
/* ---------- 천칭의 거래 ---------- */
function pactLines(id) { const d = C.PACTS[id]; return `<span class="up">▲ ${d.up}</span><span class="dn">▼ ${d.dn}</span>`; }
// 천칭 그림: 저울대와 접시. 저울대는 기둥 꼭대기(가운데)를 축으로 돌고, 접시는 저울대 끝에서 항상 곧게 늘어진다.
// 왼쪽 카드를 고르면 -EMB_TILT도, 오른쪽 카드를 고르면 +EMB_TILT도. 아무것도 고르지 않으면 수평
const EMB_TILT = 8;
let embA = 0;   // 직전에 그린 기울기: 다시 그릴 때 이 값에서 새 값으로 부드럽게 넘어간다
function scaleEmblem(n, sel) {
  const gold = '#c9a55c', cx = 181, xs = n === 1 ? [181] : [88, 274];
  const a = n === 2 && sel >= 0 ? (sel === 0 ? -EMB_TILT : EMB_TILT) : 0, from = embA; embA = a;
  const rot = (deg) => `transform:rotate(${deg}deg)`;
  const pan = (x) => `<g class="pan" transform="translate(${x} 20)"><g data-to="${rot(-a)}" style="${rot(-from)}"><path d="M0 0L-28 52M0 0L28 52" /><path d="M-36 52Q0 62 36 52" stroke-width="1.6"/></g></g>`;
  const beam = n === 2 ? `<path d="M${xs[0]} 20H${xs[1]}"/><circle cx="${xs[0]}" cy="20" r="2.6" fill="${gold}"/><circle cx="${xs[1]}" cy="20" r="2.6" fill="${gold}"/>` : '';
  return `<svg class="pv-emb" viewBox="0 0 362 92" width="100%" height="86" fill="none" stroke="${gold}" stroke-width="1.2" stroke-linecap="round" aria-hidden="true">
    <path d="M${cx} 20V8M${cx - 8} 8h16" /><circle cx="${cx}" cy="5" r="3.2" fill="${gold}" stroke="none"/>
    <g class="beam" data-to="${rot(a)}" style="transform-origin:${cx}px 20px;${rot(from)}">${beam}${xs.map(pan).join('')}${n === 1 ? `<path d="M${cx - 16} 20h32"/>` : ''}</g></svg>`;
}
function pvRows(id) {
  const d = C.PACTS[id];
  return `<span class="pc-row gain"><small>얻는 것</small><span>${d.up}</span></span><span class="pc-row cost"><small>치르는 것</small><span>${d.dn}</span></span>`;
}
function pactCard(id, i, selected, dim) {
  const d = C.PACTS[id];
  return `<button type="button" class="pc${selected ? ' sel' : ''}${dim ? ' dim' : ''}" data-pact="${i}" style="--i:${i}" aria-pressed="${selected}"><span class="pc-nm">${d.name}</span>${d.instant ? '<span class="pc-tag">즉시 적용</span>' : ''}<i class="pc-hr"></i>${pvRows(id)}</button>`;
}
function pactHtml() {
  const pp = C.S.pendingPact, intro = pactIntro ? ' intro' : '';
  if (pactSkip) {
    return `<div class="pv${intro} ask"><div class="pv-box"><h2 class="pv-title">거절</h2><p class="pv-sub">이번 거래를 맺지 않고 지나갑니다.</p>
      <div class="pv-acts"><button type="button" class="pv-ok" data-act="pactSkipOk">거절한다</button><button type="button" class="pv-no" data-act="pactBack">돌아간다</button></div></div></div>`;
  }
  const ok = pactSel >= 0;
  return `<div class="pv${intro}"><div class="pv-top">${scaleEmblem(pp.length, pactSel)}</div>
    <h2 class="pv-title">천칭의 거래</h2><p class="pv-sub pv-quote">‘${pactLine}’</p>
    <div class="pv-cards n${pp.length}">${pp.map((id, i) => pactCard(id, i, i === pactSel, ok && i !== pactSel)).join('')}</div>
    <p class="pv-note">한번 맺은 거래는 게임이 끝날 때까지 이어진다</p>
    <div class="pv-acts"><button type="button" class="pv-ok${ok ? '' : ' off'}" data-act="pactOk"${ok ? '' : ' disabled'}>거래를 맺는다</button><button type="button" class="pv-no" data-act="pactSkip">거절한다</button></div></div>`;
}
// 맺은 거래 보기 (책갈피)
function pactViewHtml() {
  const L = C.S.pacts || [];
  return `<div class="pv"><div class="pv-box wide"><h2 class="pv-title">맺은 거래</h2><p class="pv-sub">게임이 끝날 때까지 이어집니다. (${L.length})</p>
    <div class="pv-list">${L.map(id => `<div class="pl"><span class="pc-nm">${C.PACTS[id].name}</span><i class="pc-hr"></i>${pvRows(id)}</div>`).join('')}</div>
    <div class="pv-acts"><button type="button" class="pv-ok" data-act="pactMarkClose">닫기</button></div></div></div>`;
}
function pactToast(r) {
  const d = C.PACTS[r.id];
  let t = `<b>${d.name}</b> 거래 성사`;
  if (r.id === 'relic') {
    const nm = C.PARTS[r.item.id].name;
    t = r.got === 'melt' ? `<b>유물 거래</b> 인벤토리가 가득 차 전설 파츠(${nm})를 게이지 +${r.pts}로 바꿨습니다.` : `<b>유물 거래</b> 전설 파츠 <b class="g3">${nm}</b> 획득.`;
    if (r.lost) t += ` ${C.WEAPONS[r.lost.type].name} ${r.lost.evo || r.devo ? `★+${r.lost.from - 100} → ${r.devo ? '진화가 풀려 +100' : '★+' + (r.lost.to - 100)}` : `+${r.lost.from} → +${r.lost.to}`}`;
  } else if (r.id === 'focus' && r.moved) {
    t += r.moved === 'melt' ? ` · 인벤토리가 가득 차 5번 칸 무기를 분해했습니다 (게이지 +${r.pts})` : ' · 5번 칸 무기를 인벤토리로 옮겼습니다';
  }
  return t;
}
// 받은 거래 목록 (기지 창)
function pactListHtml() {
  const S = C.S; if (!S.pacts || !S.pacts.length) return '';
  return `<div class="wm-sec">거래</div><div class="plist">${S.pacts.map(id => `<div class="pdone"><b>${C.PACTS[id].name}</b>${pactLines(id)}</div>`).join('')}</div>`;
}
function augCard(a, key, i, tag, selected) {
  const d = C.AUGS[a.id];
  return `<button type="button" class="aug g${a.g}${selected ? ' sel' : ''}" data-${key}="${i}" style="--i:${i}"><span class="chip g${a.g}">${GR[a.g]}</span><span class="nm">${d.name}</span><span class="ds">${C.augDesc(a)}</span>${tag ? `<span class="tag">${tag}</span>` : ''}</button>`;
}
function augHtml() {
  const S = C.S, pa = S.pendingAug, t = pa.base ? S.base : S.slots[pa.slot];
  const who = pa.base ? `<b class="bcol">기지 +${pa.lv}</b>` : `<b style="color:${C.WEAPONS[t.type].color}">${C.WEAPONS[t.type].name} +${pa.lv}</b>`;
  const full = t.augs.every(Boolean);
  if (augSkip) {
    return `<div class="modal"><h2>건너뛰기</h2><p>증강을 받지 않고 건너뜁니다</p>
      <div class="d-acts two"><button type="button" class="btn danger" data-act="skipOk">건너뛰기</button><button type="button" class="btn" data-act="augBack">뒤로</button></div></div>`;
  }
  if (augSel >= 0 && pa.options[augSel]) {
    const o = pa.options[augSel], same = t.augs.find(a => a && a.id === o.id), needRep = !same && full;
    const left = same ? { lab: '교체될 증강', x: augItem(same) }
      : !full ? { lab: '장착 위치', x: { txt: '빈 칸' } }
      : { lab: '교체될 증강', x: augRep >= 0 && t.augs[augRep] ? augItem(t.augs[augRep]) : { txt: '아래에서 고르세요' } };
    const ok = !needRep || (augRep >= 0 && !!t.augs[augRep]);
    return `<div class="modal"><h2>${needRep ? '증강 교체' : '증강 적용'}</h2>
      <p>${who} 달성</p>
      ${cmpHtml(left, { lab: '새 증강', x: augItem(o) })}
      ${needRep ? `<div class="wm-sec">교체할 증강을 고르세요</div>${t.augs.map((a, k) => augCard(a, 'rep', k, '', k === augRep)).join('')}` : ''}
      <div class="d-acts two"><button type="button" class="btn primary${ok ? '' : ' off'}" data-act="augOk"${ok ? '' : ' disabled'}>${needRep ? '교체' : '적용'}</button><button type="button" class="btn" data-act="augBack">뒤로</button></div></div>`;
  }
  const cur = t.augs.filter(Boolean).map(a => `<b class="g${a.g}">[${GR[a.g]}] ${C.AUGS[a.id].name}</b>`).join(', ');
  return `<div class="modal${augIntro ? ' intro' : ''}"><h2>${pa.base ? '기지 증강 선택' : '증강 선택'}</h2>
    <p>${who} 달성. 하나를 고르세요. 고르는 동안 게임은 멈춥니다.</p>
    ${pa.options.map((o, i) => {
      const same = t.augs.find(a => a && a.id === o.id);
      const tag = same ? `장착 중인 같은 증강([${GR[same.g]}])을 대체합니다` : full ? '칸이 가득 차서 기존 증강 하나와 교체합니다' : '';
      return augCard(o, 'aug', i, tag);
    }).join('')}
    <p class="cur">장착 중: ${cur || '없음'}</p>
    ${C.hasPact('sage') ? '<p class="cur">현자의 눈: 건너뛸 수 없습니다.</p>' : '<button type="button" class="btn" data-act="skipAug">건너뛰기</button>'}</div>`;
}
// 게임 오버: 무기별 결과표
function resultsHtml() {
  if (!lastRes) return '';
  const row = (ic, nm, k, d, pct) => `<div class="rrow"><span class="ri">${ic}</span><b class="rn">${nm}</b><span>${k}</span><span>${d}</span><span>${pct}</span></div>`;
  const rows = lastRes.ws.map(w => row(icon(w.type, 18), `<span style="color:${C.WEAPONS[w.type].color}">${C.WEAPONS[w.type].name}</span> ${lvTxt(w)}`,
    fmtInt(w.kills), fmt(w.dealt), (lastRes.total > 0 ? Math.round(w.dealt / lastRes.total * 100) : 0) + '%')).join('');
  const b = lastRes.base;
  return `<div class="wm-sec">무기별 결과</div><div class="res">
    <div class="rrow rh"><span class="ri"></span><span class="rn">무기</span><span>처치</span><span>누적 피해</span><span>전체 중</span></div>
    ${rows || '<p>장착한 무기가 없었습니다.</p>'}
    <div class="rrow rb"><span class="ri">${BASEICON(16)}</span><b class="rn bcol">기지</b><span>${fmtInt(b.kills)}</span><span>${fmt(b.dealt)}</span><span></span></div></div>`;
}
/* ---------- 테스트 모드 ---------- */
// 테스트 게임인지는 상태(C.S.cheat)로만 판단한다. 일반 게임에는 cheat 가 없다.
const isTest = () => !!(C.S && C.S.cheat);
const TEST_LABEL = { gold: '재화 무한', shards: '조각 무한', succ: '강화 100% 성공', god: '기지 무적', melt: '용해로 무한' };
const TCHECK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.500 4.500L19 7.500"/></svg>';
function loadTest() {
  try { const o = JSON.parse(localStorage.getItem(TEST_KEY) || 'null'); if (o && typeof o === 'object') return o; } catch (e) { /* 저장소를 못 쓰는 환경 */ }
  return {};
}
function saveTest() { if (isTest()) { try { localStorage.setItem(TEST_KEY, JSON.stringify(C.S.cheat)); } catch (e) { /* 무시 */ } } }
function syncTest() {              // 상단의 테스트 버튼은 테스트 게임에서만 보인다
  const t = isTest(), b = $('#testBtn');
  if (b && b.hidden === t) { b.hidden = !t; $('#app').classList.toggle('test', t); }
}
// 증강 뽑기의 대상: 고른 무기 칸, 없으면 첫 장착 무기 (-1 = 없음)
function testSlot() { const S = C.S; return sel && sel.from === 'slot' && S.slots[sel.k] ? sel.k : S.slots.findIndex(Boolean); }
function testHtml() {
  const S = C.S, ch = S.cheat, full = C.freeSlot() < 0, k = testSlot(), any = k >= 0, evo = S.slots.some(w => w && w.evo);
  const off = (x) => x ? ' off' : '';
  const chk = C.test.KEYS.map(key => `<button type="button" class="tchk${ch[key] ? ' on' : ''}" data-tc="${key}" aria-pressed="${!!ch[key]}"><i class="tbox">${ch[key] ? TCHECK : ''}</i><span>${TEST_LABEL[key]}</span></button>`).join('');
  const ws = C.WEAPON_IDS.map(id => `<button type="button" class="twb${off(full)}" data-tw="${id}">${icon(id, 22)}<small>${C.WEAPONS[id].name}</small></button>`).join('');
  const wn = any ? `<small style="color:${C.WEAPONS[S.slots[k].type].color}">${C.WEAPONS[S.slots[k].type].name}</small>` : '';
  return `<div class="modal testm">
    <div class="wm-head"><h2>테스트</h2><span class="tmsg">${testMsg}</span><button type="button" class="x" data-act="testExit">끝내기</button></div>
    <div class="tgrid">${chk}</div>
    <div class="wm-sec">무기 받기</div>
    <div class="twp">${ws}</div>
    <div class="wm-sec">장착한 무기</div>
    <div class="tgrid">
      <button type="button" class="btn${off(!any)}" data-act="testMax">모두 100강</button>
      <button type="button" class="btn${off(!any)}" data-act="testEvo">모두 진화</button>
      <button type="button" class="btn${off(!evo)}" data-act="testSkReset">스킬 초기화</button>
      <button type="button" class="btn${off(!any)}" data-act="testAug">증강 뽑기 ${wn}</button>
    </div>
    <div class="wm-sec">전장 <b class="tnow">${fmtTime(S.t)}</b></div>
    <div class="tgrid">
      <button type="button" class="btn" data-act="testT1">시간 +1분</button>
      <button type="button" class="btn" data-act="testT5">시간 +5분</button>
      <button type="button" class="btn${off(!!S.pendingBoss)}" data-act="testBoss">보스 부르기</button>
      <button type="button" class="btn" data-act="testClear">적 지우기</button>
    </div>
    <div class="d-acts one"><button type="button" class="btn primary" data-act="testClose">닫기</button></div></div>`;
}
function testClose() { testView = false; testMsg = ''; if (mode === 'pause') { mode = 'play'; last = 0; } }
// 테스트 창의 바로 실행 버튼 (Core.test 가 실제 일을 한다)
function testRun(name, arg) {
  const S = C.S, T = C.test;
  if (!testView || !isTest() || mode !== 'pause') return;
  let m = '', ok = true;
  switch (name) {
    case 'give': {
      const i = T.give(arg); if (i < 0) return;
      m = C.WEAPONS[arg].name + ' 받음';
      newCell = i; setTimeout(() => { if (newCell === i) newCell = -1; }, 500);
      break;
    }
    case 'testMax': ok = T.maxAll() > 0; m = '모두 100강'; break;
    case 'testEvo': ok = T.evolveAll() > 0; m = '모두 진화'; break;
    case 'testSkReset': ok = T.resetSkills() > 0; m = '스킬 초기화'; break;
    case 'testT1': case 'testT5': ok = T.addTime(name === 'testT1' ? 60 : 300); m = '시간 ' + fmtTime(S.t); break;
    case 'testBoss': ok = T.boss(); m = '보스 예고'; break;
    case 'testClear': T.clear(); m = '적 지움'; break;
    case 'testAug': {                        // 선택지 창은 기존 증강 흐름 그대로: 테스트 창을 닫고 띄운다
      const k = testSlot();
      if (k < 0 || !T.aug(k)) return;
      testClose(); augSel = -1; augRep = -1; augSkip = false; renderAll(); return;
    }
    default: return;
  }
  if (!ok) return;
  testMsg = m; Snd.play('pick');
  S.invDirty = false; S.slotDirty = false;   // 바로 아래에서 모두 다시 그린다
  renderAll();
}
// 소리, 도움말, 테마를 고르는 아이콘 한 줄 (시작 화면과 일시정지 화면)
const SPK = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/>';
const SND_ON = `<svg viewBox="0 0 24 24" width="22" height="22" ${SVG_ATTR}>${SPK}<path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg>`;
const SND_OFF = `<svg viewBox="0 0 24 24" width="22" height="22" ${SVG_ATTR}>${SPK}<path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/></svg>`;
function iconRow() {
  const tiles = THEMES.map(t => `<button type="button" class="tile${t === theme ? ' on' : ''}" data-theme="${t.id}" aria-label="테마 ${t.name}" aria-pressed="${t === theme}"><span class="mini" style="background:${t.v.bg}"><i class="mi-a" style="background:${t.v.accent}"></i><i class="mi-p" style="background:${t.v.panel};border-color:${t.v.line}"></i></span><small>${t.name}</small></button>`).join('');
  return `<div class="irow"><button type="button" class="ib${Snd.muted ? ' off' : ''}" data-act="mute" aria-label="${Snd.muted ? '소리 켜기' : '소리 끄기'}">${Snd.muted ? SND_OFF : SND_ON}</button>
    <button type="button" class="ib" data-act="help" aria-label="도움말"><b>?</b></button></div>
    <div class="pal" role="group" aria-label="테마">${tiles}</div>`;
}
/* ---------- 도움말 (그림 위주) ---------- */
// 무기마다 6~10자 역할 한 줄
const ROLE_LINE = { blaster: '정면 단일 연사', shotgun: '근거리 3레인 산탄', laser: '일직선 관통', pulse: '주변 전체 타격', mortar: '폭발탄 범위 공격', tesla: '적 사이 연쇄 번개', rail: '최강 적 저격', acid: '웅덩이 지속 약화' };
const HARR = `<svg class="harr" viewBox="0 0 24 24" width="18" height="18" ${SVG_ATTR}><path d="M4 12h15M14 7l5 5-5 5"/></svg>`;
const HSWAP = `<svg class="harr" viewBox="0 0 24 24" width="20" height="20" ${SVG_ATTR}><path d="M3 9h17M16 5l4 4-4 4M21 16H4M8 12l-4 4 4 4"/></svg>`;
const hbox = (inner, cls) => `<span class="hbox${cls ? ' ' + cls : ''}">${inner}</span>`;
const hnode = (vis, cap) => `<span class="hn"><span class="hv">${vis}</span><span class="hcap">${cap}</span></span>`;
function ngonPts(r, n, rot) { const a = []; for (let i = 0; i < n; i++) a.push((Math.cos(rot + i * 2 * Math.PI / n) * r).toFixed(1) + ',' + (Math.sin(rot + i * 2 * Math.PI / n) * r).toFixed(1)); return a.join(' '); }
// 상태 이상 표식: 게임 안에서 적 위에 그려지는 모양 그대로
function statusSvg(kind, L) {
  const col = ECOL.basic, x = 24, y = 38, r = 11;
  const snow = (cy) => `<g stroke="${L ? '#1c9cc9' : '#9fe8ff'}" stroke-width="2" stroke-linecap="round">${[0, 1, 2].map(i => { const a = i * Math.PI / 3; return `<line x1="${(x - Math.cos(a) * 7).toFixed(1)}" y1="${(cy - Math.sin(a) * 7).toFixed(1)}" x2="${(x + Math.cos(a) * 7).toFixed(1)}" y2="${(cy + Math.sin(a) * 7).toFixed(1)}"/>`; }).join('')}</g>`;
  let body = '', ek = col, fill = col, fo = 0.2;
  if (kind === 'slow') { ek = L ? '#2aa6d6' : '#8fe3ff'; }
  if (kind === 'stun') ek = L ? '#d9a400' : '#fff3a0';
  if (kind === 'ice') { fill = '#aaebff'; fo = 0.5; ek = L ? '#5fb8d8' : '#d6f6ff'; }
  const sq = `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" fill="${fill}" fill-opacity="${fo}" stroke="${ek}" stroke-width="2.5"/>`;
  if (kind === 'ice') { const q = r * 1.25; body += `<rect x="${x - q}" y="${y - q}" width="${q * 2}" height="${q * 2}" fill="rgba(170,235,255,.38)" stroke="${L ? '#5fb8d8' : '#e6fbff'}" stroke-width="2"/><path d="M${x - q} ${y - q * 0.3}L${x - q * 0.3} ${y - q}M${x + q * 0.2} ${y + q}L${x + q} ${y + q * 0.2}" stroke="${L ? '#5fb8d8' : '#e6fbff'}" stroke-width="2" fill="none"/>`; }
  body += sq;
  if (kind === 'slow') body += `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" fill="rgba(110,200,255,.42)"/>`;
  if (kind === 'burn') body += `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" fill="none" stroke="rgba(255,150,50,.95)" stroke-width="2.5" stroke-dasharray="5 4"/>`;
  const my = 11;
  if (kind === 'burn') body += `<path d="M${x} ${my - 9}Q${x + 8} ${my - 1} ${x + 5} ${my + 5}Q${x} ${my + 9} ${x - 5} ${my + 5}Q${x - 8} ${my - 1} ${x} ${my - 9}" fill="#ff8a2a"/><circle cx="${x}" cy="${my + 2}" r="3" fill="#ffe08a"/>`;
  else if (kind === 'slow' || kind === 'ice') body += snow(my);
  else if (kind === 'stun') body += [0, 1, 2].map(i => { const a = 0.6 + i * 2.094; return `<circle cx="${(x + Math.cos(a) * 7).toFixed(1)}" cy="${(my + Math.sin(a) * 3.5).toFixed(1)}" r="2.6" fill="${L ? '#d9a400' : '#ffe66b'}"/>`; }).join('');
  else if (kind === 'vuln') body += `<g stroke="#c070ff" stroke-width="2" fill="none"><circle cx="${x}" cy="${my}" r="5.5"/><path d="M${x - 9} ${my}h6M${x + 3} ${my}h6M${x} ${my - 9}v6M${x} ${my + 3}v6"/></g><circle cx="${x}" cy="${my}" r="1.6" fill="#c070ff"/>`;
  return `<svg viewBox="0 0 48 56" width="44" height="52" aria-hidden="true">${body}</svg>`;
}
// 보스 모양: 게임 안의 그림 그대로
function bossSvg(t) {
  const col = ECOL[t], r = 22, a = `fill="${col}" fill-opacity=".28" stroke="${col}" stroke-width="3" stroke-linejoin="round"`, b = `fill="none" stroke="${col}" stroke-width="2"`;
  let g = '';
  switch (t) {
    case 'giant': g = `<polygon points="${ngonPts(r, 8, Math.PI / 8)}" ${a}/><polygon points="${ngonPts(r * 0.55, 8, Math.PI / 8)}" ${b}/>`; break;
    case 'split': g = `<polygon points="${ngonPts(r, 6, 0)}" ${a}/>` + [0, 1, 2].map(k => { const an = -Math.PI / 2 + k * 2 * Math.PI / 3; return `<polygon transform="translate(${(Math.cos(an) * r * 0.45).toFixed(1)} ${(Math.sin(an) * r * 0.45).toFixed(1)})" points="${ngonPts(r * 0.26, 6, 0)}" ${b}/>`; }).join(''); break;
    case 'summon': g = `<polygon points="${ngonPts(r, 5, -Math.PI / 2)}" ${a}/>` + [-1, 0, 1].map(k => `<circle cx="${(k * r * 0.36).toFixed(1)}" cy="${(r * 0.12).toFixed(1)}" r="${(r * 0.13).toFixed(1)}" ${b}/>`).join(''); break;
    case 'jammer': { const c = r * 0.42; g = `<polygon points="${-c},${-r} ${c},${-r} ${c},${-c} ${r},${-c} ${r},${c} ${c},${c} ${c},${r} ${-c},${r} ${-c},${c} ${-r},${c} ${-r},${-c} ${-c},${-c}" ${a}/><rect x="${-r * 0.2}" y="${-r * 0.1}" width="${r * 0.4}" height="${r * 0.3}" ${b}/><path d="M${-r * 0.13} ${-r * 0.1}a${r * 0.13} ${r * 0.13} 0 0 1 ${r * 0.26} 0" ${b}/>`; break; }
    case 'shield': {
      const cx = 0, cy = r * 0.2, R = r * 1.35, a0 = Math.PI * 0.18, a1 = Math.PI * 0.82;
      g = `<polygon points="${-r},${-r * 0.8} ${r},${-r * 0.8} ${r},${r * 0.1} 0,${r} ${-r},${r * 0.1}" ${a}/><path d="M${(cx + Math.cos(a0) * R).toFixed(1)} ${(cy + Math.sin(a0) * R).toFixed(1)}A${R} ${R} 0 0 1 ${(cx + Math.cos(a1) * R).toFixed(1)} ${(cy + Math.sin(a1) * R).toFixed(1)}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`;
      break;
    }
    case 'thief': { const pts = []; for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.5 : r; pts.push((Math.cos(an) * q).toFixed(1) + ',' + (Math.sin(an) * q).toFixed(1)); } g = `<polygon points="${pts.join(' ')}" ${a}/><circle r="${r * 0.2}" ${b}/>`; break; }
    case 'corrode': { const pts = []; for (let i = 0; i < 16; i++) { const an = i * Math.PI / 8, q = (i >> 1) % 2 ? r * 0.78 : r; pts.push((Math.cos(an) * q).toFixed(1) + ',' + (Math.sin(an) * q).toFixed(1)); } g = `<polygon points="${pts.join(' ')}" ${a}/><circle r="${r * 0.4}" ${b}/>`; break; }
    case 'scale': { const hw = r * 0.82, ink = theme.v.ink; g = `<g transform="rotate(-11)"><polygon points="0,${-r} ${-hw},0 0,${r}" fill="${SC_HV}" fill-opacity=".95" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><polygon points="0,${-r} ${hw},0 0,${r}" fill="${SC_LT}" fill-opacity=".22" stroke="${SC_LT}" stroke-opacity=".6" stroke-width="2" stroke-linejoin="round"/></g>`; break; }
  }
  return `<svg viewBox="-36 -36 72 72" width="40" height="40" aria-hidden="true">${g}</svg>`;
}
const BOSS_HELP = {
  giant: ['체력이 아주 많고 크고 단단한 보스입니다.', '무기와 강화를 한곳에 몰아서 기지에 닿기 전에 쓰러뜨리세요.'],
  split: ['쓰러뜨리면 대형 적 셋으로 갈라집니다.', '갈라진 적이 한꺼번에 오니 범위 공격 무기를 준비하세요.'],
  summon: ['지나가는 동안 졸개를 계속 불러냅니다.', '졸개가 쌓이기 전에 범위 공격 무기로 쓸어내세요.'],
  jammer: ['무기 칸 하나를 잠가 한동안 쓰지 못하게 합니다. 어느 칸인지 미리 알려 줍니다.', '예고된 칸의 무기를 다른 칸으로 옮겨서 피하세요.'],
  shield: ['방패로 정면에서 오는 공격을 막습니다.', '옆 레인에 있는 무기로 공격하세요.'],
  thief: ['인벤토리의 물건 하나를 훔쳐 갑니다. 훔칠 칸을 미리 알려 줍니다.', '예고된 칸의 물건을 옮기거나 사용해서 비워 두세요.'],
  corrode: ['예고한 칸의 무기 강화 단계를 5 낮춥니다. 0 아래로 내려가면 무기가 사라집니다.', '예고된 칸의 무기를 다른 칸으로 옮겨서 피하세요.'],
  scale: ['4초마다 패턴이 바뀝니다. 밝게 빛나는 쪽에 따라 받는 피해와 속도가 달라집니다. 10번째 보스마다 나타나고, 쓰러뜨리면 거래를 제안합니다.', '오른쪽이 밝을 때 피해가 잘 들어갑니다. 그때 화력을 몰아 주세요. 왼쪽이 밝을 때는 느리게 움직이니 서두르지 않아도 됩니다.'],
};
function bossCard(t) {
  const d = C.ENEMIES[t], h = BOSS_HELP[t] || [d.hint, (d.tip || [])[1] || ''];
  return `<div class="hbc">${bossSvg(t)}<span class="hbn" style="color:${t === 'scale' ? 'var(--ink)' : ECOL[t] || 'var(--ink)'}">${d.name}</span>
    <span class="hbr"><i>특징</i><span>${h[0]}</span></span><span class="hbr"><i>공략</i><span>${h[1]}</span></span></div>`;
}
// 도움말: 시작 화면이나 일시정지 화면에서
function helpHtml() {
  const L = theme.scheme === 'light';
  const ids = Object.keys(C.PARTS), bp = ids.find(id => C.PARTS[id].base), wp = ids.find(id => !C.PARTS[id].base);
  const sec = (t, body) => `<section class="hs"><h3>${t}</h3>${body}</section>`;
  const slot = (t) => hbox(icon(t, 22), 'slot');
  const tap = `<span class="hbox slot tap">${icon('laser', 22)}<em class="x2">×2</em></span>`;
  const win = `<span class="hbox win"><svg viewBox="0 0 28 28" width="26" height="26" ${SVG_ATTR}><rect x="3" y="4" width="22" height="20" rx="2"/><path d="M3 9h22M8 14h12M8 18h8"/></svg></span>`;
  const ctl = `<div class="hgrid3">
    ${hnode(hbox(partIcon(wp, 22), 'g1') + HARR + slot('blaster'), '장착 · 강화')}
    ${hnode(slot('blaster') + HSWAP + slot('mortar'), '자리 바꾸기')}
    ${hnode(tap + HARR + win, '상세 보기')}</div><p class="hnote">무기 창(무기를 두 번 누르면 열리는 상세 화면)에서는 강화 단계, 파츠, 증강을 확인합니다. 버리기는 한 번 더 눌러야 실행됩니다.</p>`;
  const ctlIntro = `<p class="hnote">누르기와 끌기로 파츠를 장착하고, 무기 자리를 바꾸고, 무기와 기지의 상태를 살펴보는 방법입니다.</p>`;
  const wps = `<div class="hgrid2">${C.WEAPON_IDS.map(t => `<div class="hw">${icon(t, 26)}<span><b>${C.WEAPONS[t].name}</b><small>${ROLE_LINE[t] || C.WEAPONS[t].desc.split('.')[0].slice(0, 10)}</small></span></div>`).join('')}</div>`;
  const grades = `<div class="hchips">${GR.map((n, g) => `<span class="hchip g${g}">${n}</span>`).join('')}</div>`;
  const parts = `<div class="hgrid2"><div class="hpt"><span class="pic g1">${partIcon(wp, 28)}</span><span><b>무기 파츠</b><small>무기 하나에 장착</small></span></div>
    <div class="hpt"><span class="pic g1 bp">${partIcon(bp, 28)}</span><span><b>기지 파츠</b><small>기지에 장착, 전체 적용</small></span></div></div>`;
  const augs = `<span class="hmini">${[1, 2, 3].map(g => `<i class="g${g}"></i>`).join('')}</span>`;
  const up = `<div class="hflow">${hnode(SHARD.replace('width="15" height="15"', 'width="28" height="28"'), '강화 조각')}${HARR}${hnode(hbox(icon('blaster', 22) + '<em class="bdg">+5</em>', 'slot'), '강화')}${HARR}${hnode(augs, '5단계마다 증강')}</div>`;
  const melt = `<div class="hflow">${hnode(hbox(partIcon(wp, 20), 'g2') + hbox(icon('pulse', 20), 'slot'), '파츠 · 무기')}${HARR}${hnode(`<span class="hgauge"><i></i><b>100</b></span>`, '게이지 100')}${HARR}${hnode(`<span class="pic g3">${partIcon('crit', 26)}</span>`, '새 파츠')}</div>`;
  const meltNote = `<p class="hnote">쓰지 않는 파츠와 무기를 녹이면 게이지가 차오릅니다. 게이지가 가득 차면(100) 희귀 등급 이상의 새 파츠를 만듭니다. 제작할 때마다 게이지는 더 들지만 좋은 등급이 나올 확률이 높아집니다. 녹일 물건은 눌러서 고릅니다.</p>`;
  const scaleHelp = bossCard('scale') + `<p class="hnote">거래는 무언가를 주는 대신 무언가를 가져갑니다. 한 번 맺으면 게임이 끝날 때까지 이어지며, 맺지 않고 건너뛸 수도 있습니다. 받은 거래는 기지 창(기지를 누르면 열리는 화면)에서 볼 수 있습니다.</p>`;
  const evoNode = (w, cap) => hnode(hbox(icon('blaster', 22, w) + `<em class="bdg">${cap}</em>`, 'slot'), w ? '진화' : '100강');
  const evoH = `<div class="hflow">${evoNode(false, '+100')}${HARR}${evoNode(true, '★+0')}${HARR}${hnode(`<span class="hmini">${[1, 2, 3].map(g => `<i class="g${g}"></i>`).join('')}</span>`, '5강마다 스킬')}</div>
    <p class="hnote">100강 무기를 조각 5000으로 진화시킵니다. 0강으로 돌아가지만 능력은 그대로이고, 강화 비용은 100 + 일반 비용의 5배입니다. 5강마다 스킬 포인트 1개(모두 20개)를 받아 스킬 줄을 키웁니다. 부식체나 거래로 0강 아래까지 떨어지면 진화가 풀려 100강 무기가 되고, 스킬은 사라집니다.</p>`;
  const stat = `<div class="hstat">${[['burn', '화상'], ['slow', '둔화'], ['ice', '빙결'], ['stun', '기절'], ['vuln', '취약']].map(([k, n]) => `<span class="hn"><span class="hv">${statusSvg(k, L)}</span><span class="hcap">${n}</span></span>`).join('')}</div>`;
  const bosses = `<div class="hbl">${Object.keys(C.ENEMIES).filter(t => C.ENEMIES[t].boss).map(bossCard).join('')}</div>`;
  return `<div class="modal help"><h2>도움말</h2><div class="hscroll">
    ${sec('조작', ctlIntro + ctl)}${sec('무기', wps)}${sec('등급', grades)}${sec('파츠', parts)}${sec('강화와 증강', up)}${sec('진화', evoH)}${sec('용해로', melt + meltNote)}${sec('상태 이상', stat)}${sec('보스', bosses)}${sec('천칭과 거래', scaleHelp)}</div>
    <button type="button" class="btn primary" data-act="helpBack">뒤로</button></div>`;
}
function renderOverlay() {
  const S = C.S;
  let h = '';
  if (mode === 'pause' && testView && isTest()) {
    h = testHtml();
  } else if (mode === 'pause' && pactView && S && S.pacts && S.pacts.length) {
    h = pactViewHtml();
  } else if ((mode === 'start' || mode === 'pause') && helpFrom) {
    h = helpHtml();
  } else if (mode === 'start') {
    h = `<div class="modal start"><h1>도형 <span>디펜스</span></h1>
      ${best ? '<p class="bestl">최고 기록</p>' + recHtml(best) : '<p class="bestl">기록 없음</p>'}
      ${iconRow()}
      <button type="button" class="btn primary" data-act="start">시작</button>
      <button type="button" class="tlink" data-act="testStart">테스트 모드</button></div>`;
  } else if (mode === 'pause' && pauseView === 'confirm') {
    h = `<div class="modal"><h2>처음부터 다시</h2><p>지금까지의 진행이 모두 사라지고 새 게임이 시작됩니다. 다시 시작할까요?</p>
      <button type="button" class="btn danger" data-act="restartOk">다시 시작</button>
      <button type="button" class="btn" data-act="pauseBack">뒤로</button></div>`;
  } else if (mode === 'pause') {
    h = `<div class="modal pausem"><h2>일시정지</h2>${S ? recHtml({ t: S.t, kills: S.kills }) : ''}
      ${iconRow()}
      <button type="button" class="btn primary" data-act="resume">계속하기</button>
      <button type="button" class="btn" data-act="restart">처음부터 다시</button></div>`;
  } else if (mode === 'over' && shareShow) {
    h = `<div class="modal sharev"><h2>기록 이미지</h2><img class="shimg" src="${shareUrl}" alt="기록 이미지"><p>길게 눌러 저장하세요</p>
      <button type="button" class="btn primary" data-act="shareClose">닫기</button></div>`;
  } else if (mode === 'over') {
    h = `<div class="modal"><h2>기지가 무너졌습니다</h2>
      ${isTest() ? '<p class="testnote">테스트 게임 · 기록 저장 안 함</p>' : newRec ? '<p class="newrec">최고 기록을 새로 썼습니다.</p>' : '<p>이번 기록</p>'}${recHtml(lastRec)}
      ${best && !newRec && !isTest() ? '<p>최고 기록</p>' + recHtml(best) : ''}
      ${resultsHtml()}
      ${lastRes && lastRes.pacts.length ? `<div class="wm-sec">받은 거래</div><p class="pnames">${lastRes.pacts.join(', ')}</p>` : ''}
      <div class="d-acts one"><button type="button" class="btn primary" data-act="restart">다시 하기</button></div>
      ${isTest() ? '<div class="d-acts one"><button type="button" class="btn" data-act="home">처음으로</button></div>'
        : '<div class="d-acts two"><button type="button" class="btn" data-act="home">처음으로</button><button type="button" class="btn" data-act="share">기록 공유</button></div>'}</div>`;
  } else if (S && S.pendingAug) {
    if (!S.pendingAug.base && !S.slots[S.pendingAug.slot]) C.skipAug(true);
    else {
      if (shownAug !== S.pendingAug) {
        shownAug = S.pendingAug; augOpenAt = performance.now(); augSel = -1; augRep = -1; augSkip = false;
        Snd.play('aug'); if (S.pendingAug.options.some(o => o.g === 3)) Snd.play('legend');
        augIntro = true; setTimeout(() => { augIntro = false; }, 1000);   // 카드가 차례로 나타나는 연출
      }
      h = augHtml();
    }
  } else if (S && S.pendingPact) {
    if (shownPact !== S.pendingPact) {
      shownPact = S.pendingPact; pactOpenAt = performance.now(); pactSel = -1; pactSkip = false; embA = 0; pactLine = PACT_LINES[Math.floor(Math.random() * PACT_LINES.length)];
      Snd.play('aug'); pactIntro = true; setTimeout(() => { pactIntro = false; }, 1000);
    }
    h = pactHtml();
  }
  if (!h && mode === 'play' && S && partSwap) {
    const it = S.inv[partSwap.i], holder = partSwap.k === 'base' ? S.base : S.slots[partSwap.k];
    if (!it || it.kind !== 'p' || !holder) partSwap = null; else h = swapHtml();
  }
  if (!h && mode === 'play' && S && skK >= 0) {         // 스킬 창
    const w = S.slots[skK];
    if (!w || !w.evo) { skK = -1; skSel = null; } else h = skillHtml();
  }
  if (!h && mode === 'play' && S && evoK >= 0) {        // 진화 창
    const w = S.slots[evoK];
    if (!w || w.evo || w.lv < C.CFG.maxLv) evoK = -1; else h = evoHtml();
  }
  if (!h && mode === 'play' && S && (wmodal >= 0 || bmodal)) {
    if (!bmodal && !S.slots[wmodal]) { wmodal = -1; wpick = -1; }
    else {
      if (wpickNew >= 0 && (wpick < 0 || !S.inv[wpickNew] || S.inv[wpickNew].kind !== 'p')) wpickNew = -1;
      h = wpick >= 0 ? wpickHtml(wpick) : bmodal ? bmHtml() : wmHtml(S.slots[wmodal]);
    }
  }
  elO.classList.toggle('pactv', !!h && h.startsWith('<div class="pv'));
  if (skGot) { const g = skGot; skGot = null; setTimeout(() => { const t = elO.querySelector(`[data-sk="${g.l}:${g.t}"]`); if (t) t.classList.remove('got'); }, 600); }
  if (h) {
    elO.innerHTML = h; elO.hidden = false;
    const mv = elO.querySelectorAll('.pv-emb [data-to]');   // 천칭 그림: 이전 기울기에서 새 기울기로
    if (mv.length) { void elO.offsetWidth; for (const e of mv) e.style.transform = e.dataset.to.slice(10); }
  }
  else { elO.hidden = true; elO.innerHTML = ''; }
}

/* ---------- 조작 ---------- */
function resetUi() {
  sel = null; partSwap = null; wmodal = -1; bmodal = false; evoK = -1; skK = -1; skSel = null; skGot = null; wpick = -1; lastUp = null; confirmDrop = false; msg = '';
  augSel = -1; augRep = -1; augSkip = false; pactSel = -1; pactSkip = false; shownPact = null; pactView = false; bannerEl.classList.remove('show'); cerEl.classList.remove('show'); rewLayer.innerHTML = ''; wpickNew = -1; newCell = -1; meltMode = false; meltAllArm = false; meltSet.clear(); upMode = false; eqFx = null;
  toastEl.classList.remove('show'); pauseView = ''; helpFrom = ''; abKey = ''; testView = false; testMsg = '';
}
// test 가 참이면 테스트 게임 (마지막 체크 설정으로 시작)
function startGame(test) { shareReset(); if (test === true) C.test.newGame(loadTest()); else C.newGame(); resetUi(); mode = 'play'; acc = 0; renderAll(); }
function pause() { if (mode === 'play') { mode = 'pause'; pauseView = ''; helpFrom = ''; confirmDrop = false; renderOverlay(); } }
// 상태를 비우기 전에 무기별 결과와 받은 거래를 챙긴다. slots: 5칸 그대로 (무기, 빈 칸 null, 폐쇄 'closed')
function captureRes(S) {
  const one = (w) => ({ type: w.type, lv: w.lv, evo: !!w.evo, kills: w.kills || 0, dealt: w.dealt || 0 });
  return {
    total: S.dealt || 0, base: { kills: S.base.kills || 0, dealt: S.base.dealt || 0 },
    ws: S.slots.filter(Boolean).map(one).sort((a, b) => b.dealt - a.dealt),
    slots: S.slots.map((w, k) => C.isClosed(k) ? 'closed' : w ? one(w) : null),
    pacts: (S.pacts || []).map(id => C.PACTS[id].name),
  };
}
function gameOver() {
  const S = C.S;
  lastRec = { t: S.t, kills: S.kills, lv: S.maxLv, boss: S.bossKills || 0 };
  lastRes = captureRes(S);
  const test = isTest();              // 테스트 게임: 최고 기록을 저장하지 않고 공유 이미지도 만들지 않는다
  newRec = !test && (!best || lastRec.t > best.t);
  if (newRec) saveBest(lastRec);
  shareReset(); shareDate = new Date();
  mode = 'over'; resetUi(); renderAll(); Snd.play('over');
  if (!test) prepareShare();     // 버튼을 누르기 전에 이미지를 미리 만들어 둔다 (누르는 순간 바로 공유 창을 띄우기 위해)
}
// 처음으로: 앱을 켰을 때 처음 보이는 화면
function goHome() { shareReset(); C.newGame(); resetUi(); mode = 'start'; renderAll(); Snd.play('tap'); }

/* ---------- 기록 공유 ---------- */
const SHARE_NAME = '도형디펜스-기록.png';
let shareBlob = null, shareFile = null, shareP = null, shareUrl = '', shareShow = false, shareDate = new Date(), shareGen = 0;
function shareReset() {
  shareGen++; shareBlob = null; shareFile = null; shareP = null; shareShow = false;
  if (shareUrl) { try { URL.revokeObjectURL(shareUrl); } catch (e) { /* 무시 */ } shareUrl = ''; }
}
function shareData() {
  const S = C.S, over = mode === 'over' && lastRes && lastRec;
  const rec = over ? lastRec : { t: S.t, kills: S.kills, boss: S.bossKills || 0 }, res = over ? lastRes : captureRes(S);
  return { t: rec.t, kills: rec.kills, boss: rec.boss || 0, newRec: over ? newRec : false, slots: res.slots, pacts: res.pacts, date: over ? shareDate : new Date() };
}
const SHARE_FONT = '"Do Hyeon", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans CJK KR", sans-serif';
function loadSvgImg(svg) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  });
}
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// 1080x1350 PNG. 지금 테마의 색을 쓴다
async function buildShare() {
  const d = shareData(), V = theme.v, W = 1080, H = 1350;
  try { await Promise.race([document.fonts && document.fonts.ready, new Promise(r => setTimeout(r, 400))]); } catch (e) { /* 무시 */ }
  const imgs = await Promise.all(d.slots.map(w => w && w !== 'closed' ? loadSvgImg(icon(w.type, 48)) : null));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = V.bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = V.line; g.lineWidth = 1; g.beginPath();                 // 설계도 모눈
  for (let x = 54; x < W; x += 54) { g.moveTo(x, 0); g.lineTo(x, H); }
  for (let y = 54; y < H; y += 54) { g.moveTo(0, y); g.lineTo(W, y); }
  g.globalAlpha = 0.35; g.stroke(); g.globalAlpha = 1;
  g.lineWidth = 4; g.strokeStyle = V.line; rrect(g, 36, 36, W - 72, H - 72, 28); g.stroke();
  g.textBaseline = 'alphabetic'; g.textAlign = 'center';
  // 제목
  g.font = '92px ' + SHARE_FONT;
  const a = '도형 ', b = '디펜스', wa = g.measureText(a).width, wb = g.measureText(b).width, x0 = W / 2 - (wa + wb) / 2;
  g.textAlign = 'left'; g.fillStyle = V.ink; g.fillText(a, x0, 150); g.fillStyle = V['accent-ink']; g.fillText(b, x0 + wa, 150);
  g.textAlign = 'center';
  // 생존 시간 (가장 크게)
  g.fillStyle = V.dim; g.font = '40px ' + SHARE_FONT; g.fillText('생존 시간', W / 2, 262);
  g.fillStyle = V.ink; g.font = '250px ' + SHARE_FONT; g.fillText(fmtTime(d.t), W / 2, 486);
  if (d.newRec) {
    g.font = '40px ' + SHARE_FONT;
    const label = '최고 기록', tw = g.measureText(label).width + 70;
    g.fillStyle = V.accent; rrect(g, W / 2 - tw / 2, 520, tw, 66, 33); g.fill();
    g.fillStyle = V['on-accent']; g.fillText(label, W / 2, 566);
  }
  // 처치, 보스 처치
  [['처치', d.kills], ['보스 처치', d.boss]].forEach(([lab, v], i) => {
    const x = 70 + i * 480, w = 460;
    g.fillStyle = V.panel; rrect(g, x, 616, w, 128, 18); g.fill(); g.strokeStyle = V.line; g.lineWidth = 3; g.stroke();
    g.textAlign = 'left'; g.fillStyle = V.dim; g.font = '32px ' + SHARE_FONT; g.fillText(lab, x + 28, 664);
    g.textAlign = 'right'; g.fillStyle = V.ink; g.font = '68px ' + SHARE_FONT; g.fillText(String(v), x + w - 28, 716);
  });
  // 무기 5칸
  g.textAlign = 'left'; g.fillStyle = V.dim; g.font = '32px ' + SHARE_FONT; g.fillText('무기', 74, 800);
  d.slots.forEach((w, k) => {
    const y = 816 + k * 74, h = 64;
    g.fillStyle = w && w !== 'closed' ? V.panel : 'rgba(128,128,128,.08)'; rrect(g, 70, y, 940, h, 14); g.fill();
    g.strokeStyle = V.line; g.lineWidth = 2.5; if (!w || w === 'closed') g.setLineDash([10, 8]); g.stroke(); g.setLineDash([]);
    g.textBaseline = 'middle';
    g.fillStyle = V.dim; g.font = '28px ' + SHARE_FONT; g.textAlign = 'left'; g.fillText(String(k + 1), 92, y + h / 2 + 1);
    if (w === 'closed') { g.fillText('폐쇄된 칸', 190, y + h / 2 + 1); g.strokeStyle = V.dim; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(138, y + 20); g.lineTo(158, y + 44); g.moveTo(158, y + 20); g.lineTo(138, y + 44); g.stroke(); }
    else if (!w) g.fillText('빈 칸', 190, y + h / 2 + 1);
    else {
      const im = imgs[k];
      if (im) g.drawImage(im, 130, y + 8, 48, 48); else { g.fillStyle = C.WEAPONS[w.type].color; g.beginPath(); g.arc(154, y + h / 2, 18, 0, 7); g.fill(); }
      g.font = '36px ' + SHARE_FONT; g.fillStyle = C.WEAPONS[w.type].color; g.fillText(C.WEAPONS[w.type].name, 196, y + h / 2 + 1);
      g.fillStyle = V['accent-ink']; g.font = '38px ' + SHARE_FONT; g.fillText(lvTxt(w), 470, y + h / 2 + 1);
      g.textAlign = 'right'; g.font = '34px ' + SHARE_FONT;
      const dv = fmt(w.dealt), dw = g.measureText(dv).width;
      g.fillStyle = V.ink; g.fillText(dv, 984, y + h / 2 + 1);
      g.fillStyle = V.dim; g.font = '24px ' + SHARE_FONT; g.fillText('피해', 984 - dw - 12, y + h / 2 + 1);
    }
    g.textBaseline = 'alphabetic';
  });
  // 거래
  g.textAlign = 'left'; g.fillStyle = V.dim; g.font = '32px ' + SHARE_FONT; g.fillText('거래', 74, 1228);
  g.fillStyle = V.ink; g.font = '30px ' + SHARE_FONT;
  const txt = d.pacts.length ? d.pacts.join(' · ') : '없음', lines = []; let cur = '';
  for (const wd of txt.split(' ')) { if (cur && g.measureText(cur + ' ' + wd).width > 820) { lines.push(cur); cur = wd; } else cur = cur ? cur + ' ' + wd : wd; }
  lines.push(cur);
  lines.slice(0, 2).forEach((ln, i) => g.fillText(ln, 170, 1228 + i * 40));
  // 날짜
  const dt = d.date;
  g.textAlign = 'center'; g.fillStyle = V.dim; g.font = '30px ' + SHARE_FONT;
  g.fillText(dt.getFullYear() + '.' + String(dt.getMonth() + 1).padStart(2, '0') + '.' + String(dt.getDate()).padStart(2, '0'), W / 2, 1310);
  return new Promise((res, rej) => c.toBlob(bl => bl ? res(bl) : rej(new Error('toBlob')), 'image/png'));
}
function prepareShare() {
  const gen = shareGen;
  shareP = buildShare().then(bl => {
    if (gen !== shareGen) return null;
    shareBlob = bl;
    try { shareFile = new File([bl], SHARE_NAME, { type: 'image/png' }); } catch (e) { shareFile = null; }
    return bl;
  }).catch(() => null);
}
function shareDownload() {
  if (!shareBlob) return say('이미지를 만들지 못했습니다.', true);
  let framed = true;                 // 다른 페이지 안에 끼워진 화면(아티팩트 등)에서는 내려받기가 막히므로 이미지를 바로 보여 준다
  try { framed = window.self !== window.top; } catch (e) { framed = true; }
  if (framed) return shareView();
  try {
    const a = document.createElement('a');
    if (!('download' in a)) throw new Error('no download');
    if (!shareUrl) shareUrl = URL.createObjectURL(shareBlob);
    a.href = shareUrl; a.download = SHARE_NAME; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    say('이미지를 저장했습니다.');
  } catch (e) { shareView(); }
}
function shareView() {            // 마지막 방법: 이미지를 화면에 띄우고 길게 눌러 저장하게 한다
  if (!shareBlob) return say('이미지를 만들지 못했습니다.', true);
  if (!shareUrl) shareUrl = URL.createObjectURL(shareBlob);
  shareShow = true; renderOverlay();
}
// 누르는 순간 바로 navigator.share를 부른다 (미리 만들어 둔 파일 사용: 비동기 대기가 끼면 일부 브라우저가 공유를 막는다)
function doShare() {
  const f = shareFile;
  if (!f) { say(shareP ? '이미지를 만드는 중입니다. 잠시 뒤 다시 눌러 주세요.' : '이미지를 만들지 못했습니다.', true); return; }
  let can = false;
  try { can = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [f] })); } catch (e) { can = false; }
  if (!can) return shareDownload();
  let p;
  try { p = navigator.share({ files: [f], title: '도형 디펜스', text: `생존 ${fmtTime(lastRec ? lastRec.t : C.S.t)} · 처치 ${lastRec ? lastRec.kills : C.S.kills}` }); } catch (e) { return shareDownload(); }
  Promise.resolve(p).catch((e) => { if (e && e.name === 'AbortError') return; shareDownload(); });
}
function askPartSwap(i, k) { partSwap = { i, k, sel: -1 }; pswapAt = performance.now(); sel = null; upMode = false; msg = ''; renderAll(); }
function openW(k) { wmodal = k; bmodal = false; wpick = -1; wpickNew = -1; lastUp = null; msg = ''; sel = null; upMode = false; confirmDrop = false; meltMode = false; renderAll(); }
function openB() { bmodal = true; wmodal = -1; wpick = -1; wpickNew = -1; lastUp = null; msg = ''; sel = null; upMode = false; confirmDrop = false; meltMode = false; renderAll(); }
function closeW() { wmodal = -1; bmodal = false; wpick = -1; wpickNew = -1; msg = ''; last = 0; renderAll(); }
function upgradeFail(r, t) {   // t: 무기 또는 기지. 필요한 개수는 규칙 쪽 계산을 그대로 쓴다 (진화한 무기는 비용이 다르다)
  if (r.reason === 'shards') say(`강화 조각이 부족합니다. ${fmtInt(C.upgradeInfo(t).cost)}개가 필요합니다.`, true);
  else if (r.reason === 'max') say('이미 최대 강화입니다.', true);
  updateWInfo();
}
function doUpgrade(k) {
  const S = C.S, w = S.slots[k]; if (!w) return;
  const r = C.upgrade(k);
  if (!r.ok) return upgradeFail(r, w);
  Snd.play(r.success ? 'ok' : 'fail');
  msg = '';
  renderWeapons(); renderBottom();
  if (wmodal >= 0) lastUp = { ok: r.success, at: performance.now() };
  else {
    burstAt(elW.querySelector(`[data-slot="${k}"]`), r.success, r.lv, r.drop, r.evo);
  }
  if (S.pendingAug) { augSel = -1; augRep = -1; augSkip = false; }
  if (r.point) { skK = k; skSel = null; Snd.play('skill'); setTimeout(() => Snd.play('aug'), 90); }   // 진화한 무기가 포인트를 받으면 스킬 창이 열린다
  renderOverlay();
  if (r.drop && !r.devo) { say(`강화 실패. 도박사의 대가로 단계가 1 내려갔습니다. (${r.evo ? '★' : ''}+${r.lv})`, true); updateWInfo(); }
  drainEvq();
}
function doBaseUpgrade() {
  const S = C.S, b = S.base;
  const r = C.upgradeBase();
  if (!r.ok) return upgradeFail(r, b);
  Snd.play(r.success ? 'ok' : 'fail');
  msg = '';
  renderBottom();
  if (bmodal) lastUp = { ok: r.success, at: performance.now() };
  else {
    burstAt($('#bupBtn'), r.success, r.lv, r.drop);
  }
  if (S.pendingAug) { augSel = -1; augRep = -1; augSkip = false; }
  renderOverlay();
  if (r.drop) { say(`강화 실패. 도박사의 대가로 기지 단계가 1 내려갔습니다. (+${r.lv})`, true); updateWInfo(); }
}
const LOCKED = '잠긴 칸입니다. 잠금이 풀릴 때까지 옮길 수 없습니다.';
const CLOSED = '집중 거래로 폐쇄된 칸입니다. 무기를 넣을 수 없습니다.';
const NO_WEAPON = '무기가 없는 칸입니다. 무기가 있는 칸을 누르세요.';
const BASE_ONLY = '기지 파츠는 무기에 달 수 없습니다. <b>기지에 장착</b>을 누르세요.';
function equipBasePart(i) {
  const g = C.S.inv[i].g, r = C.basePut(i);
  if (r.ok) { sel = null; Snd.play('equip'); renderWeapons(); renderBottom(); equipFx('base', g); return true; }
  if (r.reason === 'full') askPartSwap(i, 'base');
  return false;
}
function tapInv(i) {                      // 누르면 고르기만 한다. 다른 것을 누르면 이전 선택은 풀린다
  const S = C.S, it = S.inv[i];
  confirmDrop = false; msg = ''; meltAllArm = false; upMode = false;
  if (meltMode) {                          // 용해로: 누르면 녹일 물건으로 고르거나 푼다 (몇 개든). 녹이기는 아래 버튼으로
    if (!it || (it.kind !== 'p' && it.kind !== 'w')) return say('용해로에는 파츠와 무기만 넣을 수 있습니다.', true);
    if (meltSet.has(i)) meltSet.delete(i); else meltSet.add(i);
    Snd.play('tap'); renderBottom(); return;
  }
  sel = !it || (sel && sel.from === 'inv' && sel.i === i) ? null : { from: 'inv', i };
  if (sel) Snd.play('tap');
  renderWeapons(); renderBottom();
}
function tapSlot(k) {
  const S = C.S, w = S.slots[k];
  confirmDrop = false; msg = '';
  if (meltMode) { meltMode = false; meltAllArm = false; meltSet.clear(); renderBottom(); }
  if (C.isClosed(k)) { sel = null; renderWeapons(); renderBottom(); return say(CLOSED, true); }
  if (upMode && !sel) {                    // 강화 모드: 무기 칸을 누를 때마다 한 번씩 강화
    if (!w) return say(NO_WEAPON, true);
    if (!w.evo && w.lv >= C.CFG.maxLv) { evoK = k; Snd.play('tap'); renderOverlay(); return; }   // 100강: 진화 창
    return doUpgrade(k);
  }
  upMode = false;
  const it = sel && sel.from === 'inv' ? S.inv[sel.i] : null;
  if (it) {                                // 인벤토리에서 고른 물건을 이 칸에 바로 적용
    if (it.kind === 'w') { if (C.isLocked(k)) return say(LOCKED, true); C.equipWeapon(sel.i, k); sel = null; Snd.play('equip'); }
    else if (isBasePart(it)) return say(BASE_ONLY, true);
    else if (!w) return say(NO_WEAPON, true);
    else if (it.kind === 'p') {
      const g = it.g;
      if (!C.attachPart(sel.i, k).ok) return askPartSwap(sel.i, k);
      sel = null; Snd.play('equip');
      renderWeapons(); renderBottom(); equipFx(k, g); return;
    }
    renderWeapons(); renderBottom(); return;
  }
  if (sel && sel.from === 'slot' && sel.k === k) return openW(k);
  if (!w) {
    sel = null; renderWeapons(); renderBottom();
    return say('빈 칸입니다. 인벤토리에서 무기를 고른 다음 이 칸을 누르세요.');
  }
  sel = { from: 'slot', k };               // 무기 칸끼리는 눌러서 옮기지 않는다 (끌기만)
  Snd.play('tap');
  renderWeapons(); renderBottom();
}

/* ---------- 끌어서 옮기기 ---------- */
function dragSource(el) {
  const b = el.closest && el.closest('[data-inv],[data-slot]'); if (!b) return null;
  const S = C.S;
  if (b.dataset.inv != null) { const i = +b.dataset.inv; return S.inv[i] ? { from: 'inv', i, el: b } : null; }
  const k = +b.dataset.slot; return S.slots[k] ? { from: 'slot', k, el: b } : null;
}
const DROP_NEAR = 0.35;                    // 칸 밖에 놓아도 받아 주는 거리: 칸 크기(가로, 세로의 기하 평균)의 35%
function dropTarget(x, y, src) {
  const el = document.elementFromPoint(x, y);
  let b = el && el.closest && el.closest('[data-inv],[data-slot],.bbtn');
  if (!b) {                                // 칸 밖: 가장 가까운 칸 하나만 보고, 그 칸의 테두리에서 가까우면 그 칸으로 친다
    const it = src && src.from === 'inv' ? C.S.inv[src.i] : null;
    let bd = Infinity, br = null;
    for (const c of document.querySelectorAll('#weapons [data-slot], #bottom [data-inv]' + (it && isBasePart(it) ? ', #bottom .bbtn' : ''))) {
      const r = c.getBoundingClientRect(); if (!r.width) continue;
      const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      if (d < bd) { bd = d; b = c; br = r; }
    }
    if (!b || bd > DROP_NEAR * Math.sqrt(br.width * br.height)) return null;
  }
  if (b.classList.contains('bbtn')) return { from: 'base', el: b };
  return b.dataset.inv != null ? { from: 'inv', i: +b.dataset.inv, el: b } : { from: 'slot', k: +b.dataset.slot, el: b };
}
function sameSpot(a, b) { return a && b && a.from === b.from && (a.from === 'inv' ? a.i === b.i : a.k === b.k); }
function applyDrop(src, t) {               // 반환값: 실제로 옮겼는지
  const S = C.S;
  if (src.from === 'inv') {
    const it = S.inv[src.i]; if (!it) return false;
    if (t.from === 'base') {                // 기지 버튼 위에 놓기
      if (isBasePart(it)) { const g = it.g, r = C.basePut(src.i); if (r.ok) { eqFx = { k: 'base', g }; return true; } if (r.reason === 'full') askPartSwap(src.i, 'base'); return false; }
      say('기지에는 기지 파츠만 달 수 있습니다.', true); return false;
    }
    if (t.from === 'inv') return C.moveInv(src.i, t.i);
    const w = S.slots[t.k];
    if (it.kind === 'w') { if (C.isClosed(t.k)) { say(CLOSED, true); return false; } if (C.isLocked(t.k)) { say(LOCKED, true); return false; } return C.equipWeapon(src.i, t.k); }
    if (C.isClosed(t.k)) { say(CLOSED, true); return false; }
    if (isBasePart(it)) { say(BASE_ONLY, true); return false; }
    if (!w) { say(NO_WEAPON, true); return false; }
    if (C.attachPart(src.i, t.k).ok) { eqFx = { k: t.k, g: it.g }; return true; }
    askPartSwap(src.i, t.k); return false;
  }
  if (!S.slots[src.k] || t.from === 'base') return false;
  if (C.isLocked(src.k) || (t.from === 'slot' && C.isLocked(t.k))) { say(LOCKED, true); return false; }   // 잠긴 칸에서는 꺼내지도, 넣지도 못한다
  if (t.from === 'slot') { if (C.isClosed(t.k)) { say(CLOSED, true); return false; } return C.swapSlots(src.k, t.k); }
  const it = S.inv[t.i];
  if (!it) return C.unequipWeapon(src.k, t.i);
  if (it.kind === 'w') return C.equipWeapon(t.i, src.k);
  if (C.unequipWeapon(src.k)) return true;
  say('인벤토리에 빈 칸이 없습니다.', true); return false;
}
function endDrag(apply, x, y) {
  const d = drag; drag = null;
  if (!d) return;
  if (d.ghost) d.ghost.remove();
  if (d.over) d.over.classList.remove('over');
  if (d.src.el) d.src.el.classList.remove('dragsrc');
  $('#app').classList.remove('dragging');
  if (d.active) {
    suppressClick = performance.now() + 400;
    const t = apply ? dropTarget(x, y, d.src) : null;
    if (t && !sameSpot(d.src, t) && applyDrop(d.src, t)) Snd.play('equip');
    needRender = false; renderWeapons(); renderBottom();
    if (eqFx) { const f = eqFx; eqFx = null; equipFx(f.k, f.g); }
  } else if (needRender) {                 // 누르는 사이에 밀린 화면 갱신
    setTimeout(() => { if (!drag && needRender) { needRender = false; renderWeapons(); renderBottom(); } }, 60);
  }
}
$('#app').addEventListener('pointerdown', (ev) => {
  downOnBtn = !!(ev.target.closest && ev.target.closest('button'));
  if (drag) endDrag(false);                // 이전 끌기가 비정상적으로 끝났다면 정리
  if (mode !== 'play' || !C.S || C.S.pendingAug || C.S.pendingPact || wmodal >= 0 || bmodal || partSwap || skK >= 0 || evoK >= 0) return;
  if ((sel || meltMode || upMode) && !ev.target.closest('button')) {   // 다른 곳(전장, 빈 공간)을 누르면 선택과 용해로 모드 취소
    sel = null; confirmDrop = false; msg = ''; meltMode = false; meltAllArm = false; meltSet.clear(); upMode = false;
    renderWeapons(); renderBottom(); return;
  }
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;
  const src = dragSource(ev.target); if (!src) return;
  drag = { src, id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, active: false, ghost: null, over: null, at: performance.now() };
});
window.addEventListener('pointermove', (ev) => {
  if (!drag || ev.pointerId !== drag.id) return;
  drag.at = performance.now();
  if (!drag.active) {
    if (Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) < 10) return;
    // 끄는 동안에는 화면 요소를 새로 만들지 않는다. 손가락이 닿은 요소가 사라지면
    // 일부 기기에서 이후 터치 신호가 끊겨 끌기가 멈추기 때문이다.
    sel = null; confirmDrop = false; msg = ''; meltMode = false; meltAllArm = false; meltSet.clear();
    if (upMode) { upMode = false; const ub = $('#upBtn'); if (ub) ub.classList.remove('on'); }
    document.querySelectorAll('#weapons .sel, #weapons .tg, #bottom .sel').forEach(e => e.classList.remove('sel', 'tg'));
    elW.classList.remove('upmode');
    const el = drag.src.el, r = el.getBoundingClientRect();
    const g = document.createElement('div');
    g.className = 'ghost' + (el.classList.contains('kp') ? ' ' + [...el.classList].filter(c => /^g\d$/.test(c)).join(' ') : '');
    g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    g.innerHTML = el.innerHTML; el.classList.add('dragsrc');
    $('#app').appendChild(g); $('#app').classList.add('dragging');
    drag.ghost = g; drag.active = true;
  }
  drag.ghost.style.left = ev.clientX + 'px'; drag.ghost.style.top = ev.clientY + 'px';
  const t = dropTarget(ev.clientX, ev.clientY, drag.src);
  const over = t && !sameSpot(drag.src, t) ? t.el : null;
  if (over !== drag.over) {
    if (drag.over) drag.over.classList.remove('over');
    if (over) over.classList.add('over');
    drag.over = over;
  }
  if (ev.cancelable) ev.preventDefault();
}, { passive: false });
window.addEventListener('pointerup', (ev) => { if (drag && ev.pointerId === drag.id) endDrag(true, ev.clientX, ev.clientY); });
window.addEventListener('pointercancel', (ev) => { if (drag && ev.pointerId === drag.id) endDrag(false); });
document.addEventListener('touchmove', (ev) => { if (drag && drag.active && ev.cancelable) ev.preventDefault(); }, { passive: false });

function doWput(i) {                        // 인벤토리의 i번 파츠를 지금 고른 파츠 칸에 넣는다 (차 있으면 맞바꾼다)
  const S = C.S, pg = S.inv[i].g, pk = wpick;
  const ok = bmodal ? C.basePut(i, pk).ok : C.putPart(i, wmodal, pk);
  if (ok) Snd.play('equip');
  wpick = -1; wpickNew = -1; renderAll(); if (ok) flashNode(pk, pg);
}
function act(name) {
  const S = C.S;
  switch (name) {
    case 'restart':
      if (mode === 'pause') { pauseView = 'confirm'; renderOverlay(); return; }   // 일시정지 중에는 한 번 더 묻는다
      startGame(isTest()); Snd.play('pick'); return;   // 테스트 게임에서 다시 하면 테스트 게임
    case 'restartOk': startGame(isTest()); Snd.play('pick'); return;
    case 'start': startGame(); Snd.play('pick'); return;
    case 'testStart': if (mode === 'start') { startGame(true); Snd.play('pick'); } return;
    case 'testOpen':
      if (mode !== 'play' || !isTest() || S.over || S.pendingAug || S.pendingPact) return;
      testView = true; testMsg = ''; mode = 'pause'; pauseView = ''; helpFrom = ''; Snd.play('tap'); renderOverlay(); return;
    case 'testClose': if (testView) { testClose(); Snd.play('tap'); renderAll(); } return;
    case 'testExit': if (testView) goHome(); return;
    case 'testMax': case 'testEvo': case 'testSkReset': case 'testAug': case 'testT1': case 'testT5': case 'testBoss': case 'testClear': testRun(name); return;
    case 'help': helpFrom = mode; renderOverlay(); return;
    case 'helpBack': helpFrom = ''; renderOverlay(); return;
    case 'pauseBack': pauseView = ''; renderOverlay(); return;
    case 'mute': Snd.toggle(); renderOverlay(); return;
    case 'resume': pauseView = ''; helpFrom = ''; mode = 'play'; last = 0; renderAll(); return;   // 칸 표시(예고 막대)를 지금 시간에 맞춰 다시 만든다
    case 'skipAug':                          // 건너뛰기: 작은 확인 창을 띄운다
      if (!S || !S.pendingAug || C.hasPact('sage') || performance.now() - augOpenAt < 400) return;
      augSkip = true; augSel = -1; augRep = -1; augOpenAt = performance.now(); renderOverlay(); return;
    case 'skipOk':
      if (!S || !S.pendingAug || performance.now() - augOpenAt < 400) return;
      C.skipAug(); augSel = -1; augRep = -1; augSkip = false; renderAll(); return;
    case 'augBack':
      if (!S || !S.pendingAug) return;
      if (augSkip) augSkip = false; else { augSel = -1; augRep = -1; }
      augOpenAt = performance.now(); renderOverlay(); return;
    case 'augOk': {
      if (!S || !S.pendingAug || performance.now() - augOpenAt < 400 || augSel < 0) return;
      const r = C.chooseAug(augSel, augRep);
      if (r.need) return;
      augSel = -1; augRep = -1; augSkip = false; Snd.play('pick'); renderAll(); return;
    }
    case 'pswapCancel': partSwap = null; renderAll(); return;
    case 'pactSkip':                         // 천칭의 거래 건너뛰기: 증강처럼 한 번 더 확인한다
      if (!S || !S.pendingPact || performance.now() - pactOpenAt < 400) return;
      pactSkip = true; pactSel = -1; pactOpenAt = performance.now(); renderOverlay(); return;
    case 'pactMark':
      if (mode !== 'play' || !S || !S.pacts || !S.pacts.length || S.pendingAug || S.pendingPact) return;
      pactResume = true; pactView = true; mode = 'pause'; Snd.play('tap'); renderOverlay(); return;
    case 'pactMarkClose':
      if (!pactView) return;
      pactView = false; Snd.play('tap');
      if (pactResume) { mode = 'play'; last = 0; } pactResume = false;
      renderAll(); return;
    case 'pactBack':
      if (!S || !S.pendingPact) return;
      pactSkip = false; pactOpenAt = performance.now(); renderOverlay(); return;
    case 'pactSkipOk':
      if (!S || !S.pendingPact || performance.now() - pactOpenAt < 400) return;
      C.skipPact(); pactSel = -1; pactSkip = false; Snd.play('tap'); renderAll(); say('거래를 받지 않았습니다.'); return;
    case 'pactOk': {
      if (!S || !S.pendingPact || pactSel < 0 || performance.now() - pactOpenAt < 400) return;
      legendMark();
      const r = C.choosePact(pactSel);
      if (!r.ok) return;
      pactSel = -1; pactSkip = false; pactIntro = false; Snd.play('pact');
      renderAll(); legendScan();
      banner(C.PACTS[r.id].name);
      if (r.id === 'relic' || (r.id === 'focus' && r.moved)) say(pactToast(r));
      drainEvq(r.devo);   // 부수 결과(인벤토리 변화)는 알림으로 따로 알린다
      return;
    }
    case 'home': goHome(); return;
    case 'share': if (!isTest()) doShare(); return;
    case 'shareClose': shareShow = false; renderOverlay(); return;
  }
  if (mode !== 'play' || S.pendingAug || S.pendingPact) return;
  if (name !== 'meltBulk') meltAllArm = false;
  if (name !== 'drop' && name !== 'meltOne') confirmDrop = false;
  switch (name) {
    case 'gen': {
      const pre = S.inv.slice();
      legendMark();
      const r = C.generate();
      if (!r.ok) {
        if (r.reason === 'busy') return;
        if (r.reason === 'gold') say(`재화가 부족합니다. ◆ ${C.genCost()}이 필요합니다.`, true);
        else if (r.reason === 'full') say('인벤토리가 가득 찼습니다. 장착하거나 버려서 칸을 비우세요.', true);
        return;
      }
      const it = r.item;
      if (r.miss) { Snd.play('fail'); renderBottom(); missFx($('#genBtn')); say('<b>꽝!</b> 아무것도 나오지 않았습니다.', true); return; }
      Snd.play('gen');
      newCell = S.inv.findIndex((x, i) => x !== pre[i]);
      const nc = newCell; setTimeout(() => { if (newCell === nc) newCell = -1; }, 500);
      renderBottom(); legendScan();
      if (it.kind === 'w') say(`획득: <b style="color:${C.WEAPONS[it.type].color}">${C.WEAPONS[it.type].name}</b> (무기)`);
      else if (it.kind === 'p') say('획득: ' + (isBasePart(it) ? '<b class="btag">기지 파츠</b> ' : '') + partLine(it));
      else { say(`획득: <b>강화 조각 ${it.n}개</b>`); pulseUp(); }
      return;
    }
    case 'upMode':
      upMode = !upMode; sel = null; meltMode = false; meltSet.clear(); msg = '';
      renderWeapons(); renderBottom();
      if (upMode) say('강화 모드: 무기 칸을 누르면 한 번씩 강화합니다.');
      return;
    case 'meltOn': upMode = false; meltMode = true; meltSet.clear(); sel = null; msg = ''; renderWeapons(); renderBottom(); return;
    case 'meltOff': meltMode = false; meltSet.clear(); msg = ''; renderBottom(); return;
    case 'meltBulk': {                       // 고른 것이 있으면 그것만, 없으면 '모두 분해' (영웅 이상 파츠, 강화한 무기 제외)
      const picked = [...meltSet].filter(i => { const x = S.inv[i]; return x && (x.kind === 'p' || x.kind === 'w'); });
      const ok = x => x && (x.kind === 'p' || x.kind === 'w') && !C.meltSafe(x);
      const idx = picked.length ? picked : S.inv.map((x, i) => ok(x) ? i : -1).filter(i => i >= 0);
      if (!idx.length) return say('분해할 수 있는 물건이 없습니다. (영웅 이상 파츠, 강화한 무기는 제외)', true);
      if (!picked.length && !meltAllArm) { meltAllArm = true; renderBottom(); return say(`${idx.length}개를 분해하려면 한 번 더 누르세요. 제외: 영웅 이상 파츠, 강화한 무기, 영웅 이상 파츠가 달린 무기`, true); }
      const rects = [];
      idx.forEach(i => { if (rects.length < 8) rects.push(elB.querySelector(`[data-inv="${i}"]`)?.getBoundingClientRect()); });
      const r = picked.length ? C.meltList(picked) : C.meltAll();
      meltAllArm = false; meltSet.clear(); Snd.play('melt');
      renderBottom(); rects.forEach(rc => rc && meltFx(null, rc)); gaugeFlash();
      return say(`<b>${r.n}개를 분해했습니다.</b> 게이지 +${r.pts} (현재 ${meltNow()})`);
    }
    case 'craft': {
      legendMark();
      const r = C.craftPart();
      if (!r.ok) {
        if (r.reason === 'gauge') say(`게이지가 부족합니다. ${C.craftCost()}이 필요하고 지금은 ${S.melt || 0}입니다.`, true);
        else say('인벤토리가 가득 찼습니다. 칸을 비운 뒤 제조하세요.', true);
        return;
      }
      Snd.play('gen');
      newCell = r.i; const nc = newCell; setTimeout(() => { if (newCell === nc) newCell = -1; }, 500);
      renderBottom(); legendScan();
      say('제조: ' + (isBasePart(r.item) ? '<b class="btag">기지 파츠</b> ' : '') + partLine(r.item));
      return;
    }
    case 'drop': {                           // 버리기: 첫 번째 누름은 무장만, 두 번째 누름에 버린다 (모든 종류의 물건)
      if (!sel || sel.from !== 'inv') return;
      const it = S.inv[sel.i]; if (!it) return;
      if (!(confirmDrop && dropArmI === sel.i && armWhat === 'drop')) { confirmDrop = true; armWhat = 'drop'; dropArmI = sel.i; dropArmAt = performance.now(); Snd.play('tap'); renderBottom(); return; }
      C.discard(sel.i); sel = null; confirmDrop = false; msg = ''; Snd.play('drop');
      renderWeapons(); renderBottom();
      say('버렸습니다.');
      return;
    }
    case 'meltOne': {                        // 분해: 고른 물건 하나를 녹인다 (등급과 강화 단계와 상관없이, 직접 골랐으므로). 버리기와 같은 두 번 누르기
      if (!sel || sel.from !== 'inv') return;
      const it = S.inv[sel.i]; if (!it || (it.kind !== 'p' && it.kind !== 'w')) return;
      if (!(confirmDrop && dropArmI === sel.i && armWhat === 'melt')) { confirmDrop = true; armWhat = 'melt'; dropArmI = sel.i; dropArmAt = performance.now(); Snd.play('tap'); renderBottom(); return; }
      const rc = elB.querySelector(`[data-inv="${sel.i}"]`)?.getBoundingClientRect();
      const pts = C.meltPart(sel.i); sel = null; confirmDrop = false; msg = ''; Snd.play('melt');
      renderWeapons(); renderBottom(); if (rc) meltFx(null, rc); gaugeFlash();
      return say(`<b>분해했습니다.</b> 게이지 +${pts} (현재 ${meltNow()})`);
    }
    case 'bequip': if (sel && sel.from === 'inv') equipBasePart(sel.i); return;
    case 'bopen': openB(); return;
    case 'evoOpen': if (wmodal >= 0) { evoK = wmodal; Snd.play('tap'); renderOverlay(); } return;
    case 'evoClose': evoK = -1; Snd.play('tap'); renderOverlay(); return;
    case 'evoOk': {
      if (evoK < 0) return;
      const k = evoK, w = S.slots[k], r = C.evolve(k);
      if (!r.ok) { if (r.reason === 'shards') say(`조각이 부족합니다. ${C.CFG.evoCost}개가 필요합니다.`, true); return; }
      evoK = -1; upMode = false;
      closeW();                                 // 무기 창에서 눌렀다면 닫고, 전장 가운데에서 진화 연출을 한 뒤 칸에서 효과를 보여 준다
      evoCeremony(w, k);
      return;
    }
    case 'skOpen': {
      const k = wmodal >= 0 ? wmodal : sel && sel.from === 'slot' ? sel.k : -1;
      if (k < 0 || !S.slots[k] || !S.slots[k].evo) return;
      skK = k; skSel = null; Snd.play('tap'); renderOverlay(); return;
    }
    case 'skClose': skK = -1; skSel = null; Snd.play('tap'); renderAll(); return;
    case 'skUp': {
      if (skK < 0 || !skSel) return;
      const r = C.skillUp(skK, skSel.l, skSel.t);
      if (!r.ok) return;
      skGot = { l: skSel.l, t: skSel.t }; Snd.play('skill');
      const ni = C.skillInfo(S.slots[skK], skSel.l, skSel.t);
      if (ni.rank >= ni.max && skSel.t < 2) skSel = { l: skSel.l, t: skSel.t + 1 };   // 다 찍으면 새로 열린 윗 노드로 이동
      renderWeapons(); renderOverlay(); return;
    }
    case 'bup': doBaseUpgrade(); return;
    case 'wopen': if (sel && sel.from === 'slot') openW(sel.k); return;
    case 'wclose': closeW(); return;
    case 'wup': if (wmodal >= 0) doUpgrade(wmodal); return;
    case 'wunequip': {
      if (wmodal < 0) return;
      if (C.isLocked(wmodal)) { say(LOCKED, true); updateWInfo(); return; }
      if (!C.unequipWeapon(wmodal)) { say('인벤토리에 빈 칸이 없습니다.', true); updateWInfo(); return; }
      closeW(); return;
    }
    case 'pswapOk': {
      if (!partSwap || partSwap.sel < 0 || performance.now() - pswapAt < 400) return;
      const pk = partSwap.k, pg = S.inv[partSwap.i].g;
      const ok = pk === 'base' ? C.basePut(partSwap.i, partSwap.sel).ok : C.replacePart(partSwap.i, pk, partSwap.sel);
      if (ok) Snd.play('equip');
      partSwap = null; renderAll(); if (ok) equipFx(pk, pg); return;
    }
    case 'wputBack': wpickNew = -1; renderOverlay(); return;
    case 'wputOk': {
      if (wpickNew < 0 || wpick < 0 || performance.now() - wpickAt < 400) return;
      doWput(wpickNew); return;
    }
    case 'wpickBack': if (wpickNew >= 0) wpickNew = -1; else { wpick = -1; msg = ''; } renderOverlay(); return;
    case 'wdetach': {
      if (wpick < 0 || (wmodal < 0 && !bmodal)) return;
      const ok = bmodal ? C.baseDetach(wpick) : C.detachPart(wmodal, wpick);
      if (!ok) { say('인벤토리에 빈 칸이 없어 해제할 수 없습니다.', true); renderOverlay(); return; }
      wpick = -1; wpickNew = -1; Snd.play('equip'); renderAll(); return;
    }
  }
}
$('#app').addEventListener('click', (ev) => {
  const S = C.S;
  // 무기 창이나 기지 창의 바깥 부분을 누르면 닫힌다
  if (ev.target === elO && mode === 'play' && S && evoK >= 0) { evoK = -1; renderOverlay(); return; }   // 진화 창은 바깥을 눌러도 닫힌다
  if (ev.target === elO && mode === 'play' && S && skK < 0 && !S.pendingAug && !partSwap && (wmodal >= 0 || bmodal)) { closeW(); return; }
  if (pactIntro && S && S.pendingPact && elO.contains(ev.target)) { pactIntro = false; renderOverlay(); return; }   // 등장 연출은 누르면 건너뛴다
  const b = ev.target.closest('button'); if (!b) return;
  if (!downOnBtn && ev.detail > 0) return;           // 버튼이 아닌 곳을 눌렀는데 그 때문에 화면이 바뀌어 같은 자리에 버튼이 새로 생겼다면, 그 버튼은 반응하지 않는다
  Snd.ensure();
  if (performance.now() < suppressClick) return;   // 끌기가 끝난 직후의 누름은 무시
  if (b.id === 'pauseBtn') { pause(); return; }
  if (b.id === 'speedBtn') { speed = speed === 1 ? 2 : 1; b.textContent = speed + '배'; b.classList.toggle('on', speed === 2); abKey = ''; renderWeapons(); renderBottom(); return; }   // 예고 막대는 속도에 맞춰 다시 만든다
  const ds = b.dataset;
  if (ds.sk != null) { if (skK < 0) return; const [l, t] = ds.sk.split(':').map(Number); skSel = { l, t }; Snd.play('tap'); renderOverlay(); return; }
  if (ds.theme) { const t = THEMES.find(x => x.id === ds.theme); if (t) { applyTheme(t, true); Snd.play('tap'); renderAll(); } return; }
  if (ds.tc) {                                       // 테스트 창의 체크 항목
    if (!testView || !isTest() || !C.test.set(ds.tc, !S.cheat[ds.tc])) return;
    saveTest(); Snd.play('tap'); renderAll(); return;
  }
  if (ds.tw) { testRun('give', ds.tw); return; }     // 테스트 창의 무기 받기
  if (ds.act) { act(ds.act); return; }
  if (ds.aug != null || ds.rep != null) {
    if (!S || !S.pendingAug || performance.now() - augOpenAt < 400) return; // 연타 중 잘못 누르는 것 방지
    if (ds.aug != null) { augSel = +ds.aug; augRep = -1; augOpenAt = performance.now(); } else augRep = +ds.rep;
    Snd.play('tap'); renderOverlay(); return;
  }
  if (ds.pact != null) {
    if (!S || !S.pendingPact || pactSkip || performance.now() - pactOpenAt < 400) return;
    pactSel = +ds.pact; Snd.play('tap'); renderOverlay(); return;
  }
  if (mode !== 'play' || !S || S.pendingAug || S.pendingPact) return;
  if (ds.prep != null) {
    if (!partSwap || performance.now() - pswapAt < 400) return;
    partSwap.sel = +ds.prep; Snd.play('tap'); renderOverlay(); return;
  }
  if (partSwap) return;
  const open = wmodal >= 0 || bmodal || skK >= 0 || evoK >= 0;
  if (ds.wpart != null && open) { wpick = +ds.wpart; wpickNew = -1; msg = ''; renderOverlay(); return; }
  if (ds.wput != null && open && wpick >= 0) {
    const holder = bmodal ? S.base : S.slots[wmodal];
    if (holder && holder.parts[wpick]) { wpickNew = +ds.wput; wpickAt = performance.now(); Snd.play('tap'); renderOverlay(); return; }   // 차 있는 칸: 비교 창
    doWput(+ds.wput); return;
  }
  if (open) return;
  if (ds.inv != null) return tapInv(+ds.inv);
  if (ds.slot != null) return tapSlot(+ds.slot);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

/* ---------- 전장 그리기 ---------- */
function resize() {
  const r = wrap.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  dpr = Math.min(2.5, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  sc = r.width / C.W;
  C.setH(r.height / sc);
}
function ngon(x, y, r, n, rot) {
  for (let i = 0; i < n; i++) {
    const a = rot + i * 2 * Math.PI / n;
    if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
function enemyPath(e) {
  const x = e.x, y = e.y, r = e.r;
  ctx.beginPath();
  switch (e.type) {
    case 'basic': ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7); break;
    case 'runner': ctx.moveTo(x, y + r); ctx.lineTo(x - r * 0.9, y - r * 0.8); ctx.lineTo(x + r * 0.9, y - r * 0.8); ctx.closePath(); break;
    case 'swarm': ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); break;
    case 'heavy': ngon(x, y, r, 6, 0); break;
    case 'giant': ngon(x, y, r, 8, Math.PI / 8); break;
    case 'summon': ngon(x, y, r, 5, -Math.PI / 2); break;                       // 오각형
    case 'jammer': {                                                           // 십자
      const a = r * 0.42;
      ctx.moveTo(x - a, y - r); ctx.lineTo(x + a, y - r); ctx.lineTo(x + a, y - a); ctx.lineTo(x + r, y - a); ctx.lineTo(x + r, y + a); ctx.lineTo(x + a, y + a);
      ctx.lineTo(x + a, y + r); ctx.lineTo(x - a, y + r); ctx.lineTo(x - a, y + a); ctx.lineTo(x - r, y + a); ctx.lineTo(x - r, y - a); ctx.lineTo(x - a, y - a); ctx.closePath();
      break;
    }
    case 'shield':                                                             // 아래가 뾰족한 방패
      ctx.moveTo(x - r, y - r * 0.8); ctx.lineTo(x + r, y - r * 0.8); ctx.lineTo(x + r, y + r * 0.1); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y + r * 0.1); ctx.closePath();
      break;
    case 'thief':                                                              // 별
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.5 : r;
        if (i) ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); else ctx.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
      }
      ctx.closePath();
      break;
    case 'scale':                                                              // 큰 마름모 (두 쪽)
      ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.82, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.82, y); ctx.closePath();
      break;
    case 'corrode':                                                            // 톱니
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8, q = (i >> 1) % 2 ? r * 0.78 : r;
        if (i) ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); else ctx.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
      }
      ctx.closePath();
      break;
    default: ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}
// 상태 이상을 눈에 띄게: 빙결은 얼음 덩어리, 둔화는 푸른 물듦, 화상은 주황 테두리, 그리고 머리 위 표식
function drawStatus(e, iced) {
  const now = performance.now(), burn = e.burnT > 0, slow = e.slowT > 0 && !iced, stun = e.stunT > 0 && !iced;
  if (iced) {
    const q = e.r * 1.25;
    ctx.fillStyle = 'rgba(170,235,255,.38)'; ctx.strokeStyle = '#e6fbff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(e.x - q, e.y - q, q * 2, q * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(e.x - q, e.y - q * 0.3); ctx.lineTo(e.x - q * 0.3, e.y - q); ctx.moveTo(e.x + q * 0.2, e.y + q); ctx.lineTo(e.x + q, e.y + q * 0.2); ctx.stroke();
  }
  if (slow) { enemyPath(e); ctx.fillStyle = 'rgba(110,200,255,.42)'; ctx.fill(); }
  if (burn) {
    enemyPath(e); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,150,50,.95)';
    ctx.setLineDash([5, 4]); ctx.lineDashOffset = -now / 40; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
  const icons = [];
  if (burn) icons.push('b'); if (slow || iced) icons.push('s'); if (stun) icons.push('z'); if (e.vulnT > 0) icons.push('v');
  if (!icons.length) return;
  let x = e.x - (icons.length - 1) * 9; const y = e.y - e.r - (e.hp < e.maxHp ? 24 : 15);
  for (const k of icons) {
    if (k === 'b') {                        // 불꽃
      const f = 1 + 0.18 * Math.sin(now / 70 + e.x);
      ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.moveTo(x, y - 9 * f);
      ctx.quadraticCurveTo(x + 8, y - 1, x + 5, y + 5); ctx.quadraticCurveTo(x, y + 9, x - 5, y + 5); ctx.quadraticCurveTo(x - 8, y - 1, x, y - 9 * f); ctx.fill();
      ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(x, y + 2, 3, 0, 7); ctx.fill();
    } else if (k === 's') {                 // 눈꽃
      ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.moveTo(x - Math.cos(a) * 7, y - Math.sin(a) * 7); ctx.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); }
      ctx.stroke();
    } else if (k === 'v') {                 // 취약: 보라색 조준선
      ctx.strokeStyle = '#c070ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.moveTo(x - 9, y); ctx.lineTo(x - 3, y); ctx.moveTo(x + 3, y); ctx.lineTo(x + 9, y);
      ctx.moveTo(x, y - 9); ctx.lineTo(x, y - 3); ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 9); ctx.stroke();
      ctx.fillStyle = '#c070ff'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill();
    } else {                                // 기절: 빙빙 도는 별
      ctx.fillStyle = '#ffe66b';
      for (let i = 0; i < 3; i++) { const a = now / 150 + i * 2.094; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 7, y + Math.sin(a) * 3.5, 2.6, 0, 7); ctx.fill(); }
    }
    x += 18;
  }
}
// 천칭: 마름모를 반으로 가른 두 쪽. 지금 상태인 쪽만 밝고 다른 쪽은 흐리며, 무거운 쪽(왼쪽)이 활성일 때 그쪽으로 기울어진다
const SC_HV = '#7f8ca8', SC_LT = '#f3e7bd';   // 무채색 두 가지: 슬레이트와 상아색 (등급 네 색과 겹치지 않는다)
function drawScale(e) {
  const heavy = !e.sc || e.sc.heavy, tgt = heavy ? -0.2 : 0.2;
  e.tl = e.tl == null ? tgt : e.tl + (tgt - e.tl) * 0.14;
  const R = e.r * 1.3 * (e.flash > 0 ? 1.06 : 1), hw = R * 0.88, ink = theme.v.ink;
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.tl);
  const half = (side, col, on, label) => {
    ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(side * hw, 0); ctx.lineTo(0, R); ctx.closePath();
    ctx.fillStyle = e.flash > 0 && on ? TC.hit : rgba(col, on ? 0.95 : 0.26); ctx.fill();
    if (on) { ctx.lineWidth = 11; ctx.strokeStyle = rgba(col, 0.28); ctx.stroke(); }
    ctx.lineWidth = on ? 4 : 2; ctx.strokeStyle = on ? ink : rgba(col, 0.6); ctx.lineJoin = 'round'; ctx.stroke();
    ctx.font = (on ? 19 : 14) + 'px "Do Hyeon", sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = on ? (col === SC_LT ? '#2b2a33' : '#fff') : rgba(col, 0.75);
    ctx.save(); ctx.rotate(-e.tl); ctx.fillText(label, side * hw * 0.5, 6); ctx.restore();
  };
  half(-1, SC_HV, heavy, '×0.5'); half(1, SC_LT, !heavy, '×1.5');
  ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(0, R); ctx.lineWidth = 2; ctx.strokeStyle = rgba(ink.length === 7 ? ink : '#ffffff', 0.7); ctx.stroke();
  ctx.restore();
  if (e.sc) {                                // 다음 교대까지 남은 시간
    ctx.beginPath(); ctx.arc(e.x, e.y, R + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, e.sc.t) / 4);
    ctx.lineWidth = 3; ctx.strokeStyle = rgba(heavy ? SC_HV : '#d9c47a', 0.9); ctx.stroke();
  }
}
function drawEnemy(e) {
  if (e.type === 'scale') {
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 18 + Math.sin(performance.now() / 160) * 4, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = rgba(ECOL.scale, 0.5); ctx.setLineDash([10, 8]); ctx.stroke(); ctx.setLineDash([]);
    drawScale(e); drawStatus(e, false);
    if (e.hp < e.maxHp) {
      const w = e.r * 1.8, h = 6, x = e.x - w / 2, y = e.y - e.r - 20;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = e.sc && !e.sc.heavy ? '#d9c47a' : SC_HV; ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), h);
    }
    return;
  }
  const col = ECOL[e.type], iced = e.stunT > 0 && e.ice;
  if (e.boss) {                             // 보스는 맥동하는 테두리로 눈에 띄게
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 9 + Math.sin(performance.now() / 160) * 4, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = rgba(col, 0.5); ctx.setLineDash([10, 8]); ctx.stroke(); ctx.setLineDash([]);
  }
  const r0 = e.r; if (e.flash > 0) e.r = r0 * 1.2;   // 맞는 순간 살짝 부풀어 타격감을 준다
  enemyPath(e); e.r = r0;
  ctx.fillStyle = e.flash > 0 ? TC.hit : iced ? 'rgba(160,230,255,.5)' : rgba(col, e.boss ? 0.28 : 0.2);
  ctx.fill();
  ctx.lineWidth = e.boss ? 4 : 2.5; ctx.strokeStyle = iced ? '#d6f6ff' : e.stunT > 0 ? '#fff3a0' : e.slowT > 0 ? '#8fe3ff' : col; ctx.stroke();
  if (e.type === 'giant') { ctx.beginPath(); ngon(e.x, e.y, e.r * 0.55, 8, Math.PI / 8); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke(); }
  if (e.type === 'split') {
    ctx.lineWidth = 2; ctx.strokeStyle = col;
    for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 3; ctx.beginPath(); ngon(e.x + Math.cos(a) * e.r * 0.45, e.y + Math.sin(a) * e.r * 0.45, e.r * 0.26, 6, 0); ctx.stroke(); }
  }
  if (e.type === 'summon') { ctx.lineWidth = 2; ctx.strokeStyle = col; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(e.x + (k - 1) * e.r * 0.36, e.y + e.r * 0.12, e.r * 0.13, 0, Math.PI * 2); ctx.stroke(); } }
  if (e.type === 'jammer') { ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.strokeRect(e.x - e.r * 0.2, e.y - e.r * 0.1, e.r * 0.4, e.r * 0.3); ctx.beginPath(); ctx.arc(e.x, e.y - e.r * 0.1, e.r * 0.13, Math.PI, 0); ctx.stroke(); }
  if (e.type === 'shield') {                // 정면(아래)을 막는 방패 호
    ctx.beginPath(); ctx.arc(e.x, e.y + e.r * 0.2, e.r * 1.35, Math.PI * 0.18, Math.PI * 0.82);
    ctx.lineWidth = 6; ctx.strokeStyle = rgba(col, 0.9); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
  if (e.type === 'thief') { ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.2, 0, Math.PI * 2); ctx.stroke(); }
  if (e.type === 'corrode') { ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.4, 0, Math.PI * 2); ctx.stroke(); }
  drawStatus(e, iced);
  if (e.hp < e.maxHp) {
    const w = e.r * 1.8, h = e.boss ? 6 : 4, x = e.x - w / 2, y = e.y - e.r - (e.boss ? 14 : 9);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), h);
  }
}
function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }   // 흔들림이 일정한 가짜 난수
// 보스 소환진: 예고 동안 등장 자리에서 이중 고리가 천천히 돌며 안쪽으로 좁혀든다
// 소환진 밖의 전장은 살짝 어두워지고(적과 탄은 이 뒤에 그려져 그대로 보인다), 고리는 천천히 맥동한다
function drawSummon(pb, H) {
  const u = 1 - Math.max(0, pb.t) / C.WARN_T, col = ECOL[pb.type] || '#ff3d3d', r = C.ENEMIES[pb.type].r, x = pb.x, y = pb.y * H;
  const al = Math.min(1, u * 5) * (u > 0.85 ? 0.75 + 0.25 * Math.sin(u * 90) : 1);
  const ro = r * 1.15 + 18 * (1 - u) + 4, ri = ro * 0.74, rot = RM.matches ? 0 : u * 2.2;
  const pu = RM.matches ? 0.5 : 0.5 - 0.5 * Math.cos(u * C.WARN_T * Math.PI * 2 / 1.2);   // 1.2초에 한 번 (게임 시간 기준: 멈추면 같이 멈춘다)
  const light = theme.scheme === 'light', dk = Math.min(1, u * 4) * Math.min(1, (1 - u) * 8) * (light ? 0.3 : 0.5);
  const sh = ctx.createRadialGradient(x, y, ro, x, y, ro + 70), dc = light ? '24,34,58' : '0,0,0';
  sh.addColorStop(0, `rgba(${dc},0)`); sh.addColorStop(1, `rgba(${dc},${dk})`);
  ctx.fillStyle = sh; ctx.fillRect(0, 0, C.W, H);
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.arc(0, 0, ro, 0, Math.PI * 2); ctx.fillStyle = rgba(col, 0.1 + 0.1 * u); ctx.fill();
  ctx.lineWidth = 7 + 5 * pu; ctx.strokeStyle = rgba(col, (0.16 + 0.2 * pu) * al); ctx.stroke();   // 맥동하는 빛무리
  const ring = (R, n, tk, dir, w) => {
    ctx.save(); ctx.rotate(rot * dir);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.lineWidth = w + 0.8 * pu; ctx.strokeStyle = rgba(col, al); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n, c = Math.cos(a), sn = Math.sin(a), l = i % 3 ? tk : tk * 1.7; ctx.moveTo(c * R, sn * R); ctx.lineTo(c * (R - l), sn * (R - l)); }
    ctx.lineWidth = 2.6; ctx.strokeStyle = rgba(col, 0.95 * al); ctx.stroke(); ctx.restore();
  };
  ring(ro, 24, 6, 1, 3.6); ring(ri, 16, 5, -1, 2.4);
  ctx.save(); ctx.rotate(-rot * 1.4);   // 안쪽 삼각형 두 개: 별 모양
  ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + k * Math.PI / 3, rr = ri * 0.86; k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.lineWidth = 1.9; ctx.strokeStyle = rgba(col, (0.6 + 0.2 * pu) * al); ctx.stroke(); ctx.restore();
  ctx.restore();
}
// 보스 처치 연출: 보스 모양이 하얗게 번쩍, 고리 둘, 조각들 (흔들림은 draw 에서)
function drawBossKill(f) {
  const T = f.d - Math.max(0, f.t), q = T / f.d, col = ECOL[f.type] || '#ff3d3d', x = f.x, y = f.y, r = f.r;
  if (T < 0.28) {
    const a = 1 - T / 0.28;
    ctx.save(); ctx.translate(x, y); ctx.scale(1 + 0.25 * (1 - a), 1 + 0.25 * (1 - a)); ctx.translate(-x, -y);
    enemyPath({ type: f.type, x, y, r }); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = rgba(col, a); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, r * (1.2 + 1.4 * (1 - a)), 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${0.35 * a})`; ctx.fill();
  }
  for (let k = 0; k < 2; k++) {              // 퍼지는 고리 둘
    const u = Math.max(0, (T - k * 0.12) / (f.d - 0.15)); if (u <= 0 || u >= 1) continue;
    const e = 1 - Math.pow(1 - u, 2.2);
    ctx.beginPath(); ctx.arc(x, y, r * (0.7 + (k ? 5.2 : 3.6) * e), 0, Math.PI * 2);
    ctx.lineWidth = (k ? 5 : 9) * (1 - u) + 1; ctx.strokeStyle = k ? `rgba(255,255,255,${0.85 * (1 - u)})` : rgba(col, 0.95 * (1 - u)); ctx.stroke();
  }
  for (let i = 0; i < 28; i++) {             // 보스 색 조각
    const a = hash(i * 3.3 + 1) * Math.PI * 2, v = 70 + hash(i * 7.1 + 2) * 230, sz = 4 + hash(i * 1.7 + 3) * 7;
    const d = v * (1 - Math.exp(-3 * T)) / 3, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d + 150 * T * T, al = Math.max(0, 1 - q * q * 1.1);
    const rot = hash(i + 5) * 6.3 + T * (hash(i + 9) - 0.5) * 16;
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.beginPath(); ctx.moveTo(-sz, sz * 0.6); ctx.lineTo(sz, 0); ctx.lineTo(-sz * 0.3, -sz * 0.8); ctx.closePath();
    ctx.fillStyle = rgba(col, al); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = `rgba(255,255,255,${0.7 * al})`; ctx.stroke(); ctx.restore();
  }
}
function drawFx(f, H) {
  const p = Math.max(0, f.t / f.d);
  switch (f.k) {
    case 'beam':
      ctx.fillStyle = rgba(f.c, 0.75 * p); ctx.fillRect(f.x - f.w * p / 2, f.y0, f.w * p, f.y1 - f.y0);
      ctx.fillStyle = `rgba(255,255,255,${0.8 * p})`; ctx.fillRect(f.x - 1.5, f.y0, 3, f.y1 - f.y0);
      if (f.g) {                            // 빔 끝에 맺히는 눈부심
        const q = 1 - p, gy = f.y0 + 2;
        ctx.fillStyle = rgba(f.c, 0.3 * p); ctx.beginPath(); ctx.arc(f.x, gy, 12 + 14 * q + f.w * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(f.c, 0.7 * p); ctx.beginPath(); ctx.arc(f.x, gy, 7 + 4 * q, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.9 * p})`; ctx.beginPath(); ctx.arc(f.x, gy, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rgba(f.c, 0.8 * p); ctx.lineWidth = 2; ctx.beginPath();
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; ctx.moveTo(f.x + Math.cos(a) * 9, gy + Math.sin(a) * 9); ctx.lineTo(f.x + Math.cos(a) * (16 + 10 * q), gy + Math.sin(a) * (16 + 10 * q)); }
        ctx.stroke();
      }
      break;
    case 'aim': {                           // 저격포 조준선: 가는 붉은 선과 표적 표시
      const q = 1 - p, al = 0.45 + 0.4 * Math.sin(q * 30), col = '255,70,90';
      ctx.lineCap = 'round'; ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(${col},${al})`;
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      const rr = 20 - 9 * q;
      ctx.lineWidth = 1.8; ctx.strokeStyle = `rgba(${col},0.9)`;
      ctx.beginPath(); ctx.arc(f.x1, f.y1, rr, 0, Math.PI * 2);
      ctx.moveTo(f.x1 - rr - 5, f.y1); ctx.lineTo(f.x1 - rr + 4, f.y1); ctx.moveTo(f.x1 + rr + 5, f.y1); ctx.lineTo(f.x1 + rr - 4, f.y1);
      ctx.moveTo(f.x1, f.y1 - rr - 5); ctx.lineTo(f.x1, f.y1 - rr + 4); ctx.moveTo(f.x1, f.y1 + rr + 5); ctx.lineTo(f.x1, f.y1 + rr - 4); ctx.stroke();
      break;
    }
    case 'rail':                            // 저격선: 굵고 밝은 선이 서서히 사라지고, 포구에 반동 표시
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1);
      ctx.lineWidth = 14 * p + 2; ctx.strokeStyle = rgba(f.c, 0.35 * p); ctx.stroke();
      ctx.lineWidth = 5 * p + 1; ctx.strokeStyle = rgba(f.c, 0.95 * p); ctx.stroke();
      ctx.lineWidth = 2 * p + 0.5; ctx.strokeStyle = `rgba(255,255,255,${p})`; ctx.stroke();
      if (f.rc) {
        const q = 1 - p;
        ctx.lineWidth = 3; ctx.strokeStyle = rgba(f.c, p); ctx.beginPath();
        ctx.moveTo(f.x0 - 10, f.y0 - 4); ctx.lineTo(f.x0, f.y0 - 14 - 8 * q); ctx.lineTo(f.x0 + 10, f.y0 - 4); ctx.stroke();
        ctx.beginPath(); ctx.arc(f.x0, f.y0 - 6, 6 + 10 * q, Math.PI, Math.PI * 2); ctx.lineWidth = 2; ctx.stroke();
      }
      break;
    case 'muz': {                           // 블래스터 총구 섬광 (개틀링: 짧고 가늘게 깜빡임)
      const q = 1 - p, len = f.g ? 9 + 5 * q + 4 * (Math.floor(performance.now() / 40) % 2) : 13 + 8 * q, ax = Math.sin(f.a), ay = -Math.cos(f.a), nx = -ay, ny = ax;
      ctx.fillStyle = rgba(f.c, 0.85 * p); ctx.beginPath();
      ctx.moveTo(f.x + nx * 5, f.y + ny * 5); ctx.lineTo(f.x + ax * len, f.y + ay * len); ctx.lineTo(f.x - nx * 5, f.y - ny * 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.9 * p})`; ctx.beginPath(); ctx.arc(f.x, f.y, 4.5 * p + 1, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'fcone': {                         // 화염 산탄: 불꽃 부채꼴
      const q = 1 - p, len = 46 + 52 * q, sp = f.sp, sx = Math.sin(sp) * len, cy = Math.cos(sp) * len;
      for (const [k, col, al] of [[1, '255,80,20', 0.4], [0.72, '255,160,40', 0.6], [0.4, '255,240,170', 0.8]]) {
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - sx * k, f.y - cy * k);
        ctx.quadraticCurveTo(f.x, f.y - len * 1.2 * k, f.x + sx * k, f.y - cy * k); ctx.closePath();
        ctx.fillStyle = `rgba(${col},${al * p})`; ctx.fill();
      }
      break;
    }
    case 'dbeam': {                         // 프리즘: 갈라진 빔. 무지개는 줄마다 다른 색
      const col = f.rb ? `hsl(${(f.rb * 47) % 360},95%,62%)` : f.c;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1);
      ctx.lineWidth = 11 * p + 2; ctx.strokeStyle = f.rb ? col.replace('hsl', 'hsla').replace(')', `,${0.4 * p})`) : rgba(col, 0.4 * p); ctx.stroke();
      ctx.lineWidth = 3.5 * p + 1; ctx.strokeStyle = col; ctx.stroke();
      ctx.lineWidth = 1.4; ctx.strokeStyle = `rgba(255,255,255,${p})`; ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.85 * p})`; ctx.beginPath(); ctx.arc(f.x0, f.y0, 5 * p + 1, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'vap': {                           // 증발: 하얀 섬광과 흩어지는 빛 알갱이
      const q = 1 - p;
      ctx.fillStyle = `rgba(255,255,255,${0.9 * p})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.7 + 1.1 * q), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${p})`; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + f.x, d1 = f.r * (0.8 + 1.8 * q); ctx.moveTo(f.x + Math.cos(a) * f.r * 0.6, f.y + Math.sin(a) * f.r * 0.6); ctx.lineTo(f.x + Math.cos(a) * d1, f.y + Math.sin(a) * d1); }
      ctx.stroke();
      break;
    }
    case 'cone': {                          // 산탄 폭발: 부채꼴
      const q = 1 - p, len = 30 + 34 * q, sp = f.sp, sx = Math.sin(sp) * len, cy = Math.cos(sp) * len;
      for (const [k, al] of [[1, 0.42], [0.62, 0.55]]) {
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - sx * k, f.y - cy * k);
        ctx.quadraticCurveTo(f.x, f.y - len * 1.15 * k, f.x + sx * k, f.y - cy * k); ctx.closePath();
        ctx.fillStyle = k === 1 ? rgba(f.c, al * p) : `rgba(255,255,255,${al * p})`; ctx.fill();
        if (k === 1) { ctx.lineWidth = 2; ctx.strokeStyle = rgba(f.c, 0.9 * p); ctx.stroke(); }
      }
      break;
    }
    case 'smoke': {                         // 번지며 떠오르는 연기
      const q = 1 - p, r = f.r * (0.6 + 0.9 * q), y = f.y - q * 24;
      ctx.fillStyle = `rgba(140,146,158,${0.36 * p})`;
      ctx.beginPath(); ctx.arc(f.x, y, r, 0, Math.PI * 2); ctx.arc(f.x - r * 0.7, y + r * 0.2, r * 0.7, 0, Math.PI * 2); ctx.arc(f.x + r * 0.7, y + r * 0.1, r * 0.65, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'pulse': {                         // 펄스: 번쩍임과 두 겹의 물결
      const q = 1 - p;
      ctx.fillStyle = rgba(f.c, 0.4 * p); ctx.beginPath(); ctx.arc(f.x, f.y, 34 + 22 * q, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.5 * p})`; ctx.beginPath(); ctx.arc(f.x, f.y, 16 + 8 * q, Math.PI, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 2; k++) {
        const u = Math.max(0, Math.min(1, (q - k * 0.2) / (1 - k * 0.2)));
        if (u <= 0 || u >= 1) continue;
        const e = 1 - (1 - u) * (1 - u);
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.12 + 0.88 * e), Math.PI, Math.PI * 2);
        ctx.lineWidth = 5 * (1 - u) + 1.2; ctx.strokeStyle = rgba(f.c, 0.9 * (1 - u)); ctx.stroke();
      }
      break;
    }
    case 'crater': {                        // 박격포 탄흔
      const r = f.r * (0.85 + 0.15 * (1 - p));
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fillStyle = `rgba(50,40,30,${0.2 * p})`; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = rgba(f.c, 0.85 * p); ctx.stroke();
      ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.55, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(f.c, 0.5 * p); ctx.stroke();
      break;
    }
    case 'splat': {                         // 산성액이 터지는 순간
      const q = 1 - p, r = f.r * (0.3 + 0.7 * Math.sqrt(q));
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fillStyle = rgba(f.c, 0.28 * p); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = rgba(f.c, 0.85 * p); ctx.stroke();
      ctx.fillStyle = rgba(f.c, 0.9 * p);
      for (let k = 0; k < 8; k++) {
        const a = k * 0.785 + f.x, d = f.r * 0.9 * Math.sqrt(q) * (0.7 + 0.3 * ((k * 0.618) % 1));
        ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d - Math.sin(q * Math.PI) * 14, 3.5 * p + 1, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'spray': {                         // 산성 분사: 부채꼴과 흩어지는 방울
      const q = 1 - p, ang = (f.a || 0) * 1.15, sx = f.x, sy = f.y;
      const ex = sx + Math.sin(ang) * f.len, ey = sy - Math.cos(ang) * f.len, hw = 14 + 22 * q;
      const nx = Math.cos(ang), ny = Math.sin(ang);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex - nx * hw, ey - ny * hw); ctx.lineTo(ex + nx * hw, ey + ny * hw); ctx.closePath();
      ctx.fillStyle = rgba(f.c, 0.2 * p); ctx.fill();
      for (let i = 0; i < 6; i++) {
        const u = (i * 0.618 + f.sd) % 1, a2 = ang + (u - 0.5) * 0.7, dd = f.len * (0.25 + 0.75 * ((u * 3.7) % 1)) * (0.45 + 0.55 * q);
        ctx.fillStyle = rgba(f.c, 0.85 * p); ctx.beginPath(); ctx.arc(sx + Math.sin(a2) * dd, sy - Math.cos(a2) * dd, 3.2 * p + 1, 0, 7); ctx.fill();
      }
      break;
    }
    case 'ring':
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - p * 0.65), f.full ? 0 : Math.PI, Math.PI * 2);
      ctx.lineWidth = (f.fat ? 12 : 5) * p + 1; ctx.strokeStyle = rgba(f.c, 0.9 * p); ctx.stroke();
      break;
    case 'boom':
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - p * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = rgba(f.c, 0.3 * p); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = rgba(f.c, 0.9 * p); ctx.stroke();
      break;
    case 'bolt': {                          // 번개: 꺾인 선, 곁가지, 맞은 적마다 불꽃
      const sd = f.pts[1][0] * 0.37 + Math.floor(performance.now() / 45), path = [f.pts[0]];
      let k = 0;
      for (let i = 1; i < f.pts.length; i++) {
        const o = f.pts[i - 1], q = f.pts[i], dx = q[0] - o[0], dy = q[1] - o[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
        const segs = Math.max(2, Math.round(len / 24)), amp = Math.min(24, len * 0.28);
        for (let j = 1; j <= segs; j++) {
          const u = j / segs, off = j === segs ? 0 : (hash(sd + k++) - 0.5) * 2 * amp;
          path.push([o[0] + dx * u + nx * off, o[1] + dy * u + ny * off]);
        }
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const trace = () => { ctx.beginPath(); path.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); };
      trace(); ctx.lineWidth = 8; ctx.strokeStyle = rgba(f.c, 0.22 * p); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = rgba(f.c, p); ctx.stroke();
      ctx.beginPath();                      // 곁가지
      for (let i = 1; i < path.length - 1; i++) {
        if (hash(sd * 1.7 + i) < 0.55) continue;
        const q = path[i], a = hash(sd + i * 3.1) * Math.PI * 2, l1 = 10 + hash(sd + i) * 14;
        const mx = q[0] + Math.cos(a) * l1, my = q[1] + Math.sin(a) * l1;
        ctx.moveTo(q[0], q[1]); ctx.lineTo(mx, my); ctx.lineTo(mx + Math.cos(a + 0.7) * l1 * 0.6, my + Math.sin(a + 0.7) * l1 * 0.6);
      }
      ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(f.c, 0.85 * p); ctx.stroke();
      trace(); ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(255,255,255,${p})`; ctx.stroke();
      for (let i = 1; i < f.pts.length; i++) {   // 맞은 적 위치의 불꽃
        const q = f.pts[i], r = 6 + 6 * (1 - p);
        ctx.fillStyle = `rgba(255,255,255,${0.9 * p})`; ctx.beginPath(); ctx.arc(q[0], q[1], 3 * p + 1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rgba(f.c, p); ctx.lineWidth = 2; ctx.beginPath();
        for (let k2 = 0; k2 < 4; k2++) { const a = k2 * Math.PI / 2 + sd; ctx.moveTo(q[0] + Math.cos(a) * 3, q[1] + Math.sin(a) * 3); ctx.lineTo(q[0] + Math.cos(a) * r, q[1] + Math.sin(a) * r); }
        ctx.stroke();
      }
      break;
    }
    case 'appear': {                        // 보스 등장 순간: 짧은 섬광
      const q = 1 - p;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.8 + 1.4 * q), 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${0.75 * p})`; ctx.fill();
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 + 1.8 * q), 0, Math.PI * 2); ctx.lineWidth = 5 * p + 1; ctx.strokeStyle = rgba(ECOL[f.type] || '#ff3d3d', 0.9 * p); ctx.stroke();
      break;
    }
    case 'bosskill': drawBossKill(f); break;
    case 'pop':
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.7 - p * 0.7), 0, Math.PI * 2);
      ctx.lineWidth = f.boss ? 5 : 2; ctx.strokeStyle = `rgba(255,150,150,${p})`; ctx.stroke();
      break;
    case 'spark': {                         // 피격 불꽃
      const r = 8 + (1 - p) * 16;
      ctx.fillStyle = rgba(f.c, p * 0.9); ctx.beginPath(); ctx.arc(f.x, f.y, 6 * p + 1, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${p * 0.8})`; ctx.beginPath(); ctx.arc(f.x, f.y, 3.5 * p + 0.5, 0, 7); ctx.fill();
      ctx.strokeStyle = rgba(f.c, p); ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + f.x; ctx.moveTo(f.x + Math.cos(a) * r * 0.4, f.y + Math.sin(a) * r * 0.4); ctx.lineTo(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r); }
      ctx.stroke();
      break;
    }
    case 'num': {                           // 피해 숫자
      const y = f.y - (1 - p) * 28, al = Math.min(1, p * 2.4), big = f.c === 1;
      const txt = (f.c === 3 ? '+' : '') + fmtDmg(f.v);
      ctx.font = (big ? 25 : f.c === 2 ? 15 : 19) + 'px "Do Hyeon", sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3.5; ctx.strokeStyle = `rgba(${TC.dmgStroke},${0.85 * al})`; ctx.strokeText(txt, f.x, y);
      ctx.fillStyle = `rgba(${big ? TC.dmgBig : f.c === 2 ? TC.dmg2 : f.c === 3 ? TC.dmg3 : TC.dmgN},${al})`;
      ctx.fillText(txt, f.x, y);
      break;
    }
    case 'flash':
      ctx.fillStyle = `rgba(255,255,255,${0.45 * p})`; ctx.fillRect(0, 0, C.W, H);
      break;
    case 'leak':
      ctx.fillStyle = `rgba(255,93,93,${p})`; ctx.font = '26px "Do Hyeon", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('-' + f.n, f.x, H - 12 - (1 - p) * 26);
      break;
    case 'warn': {                          // 보스 등장: 경고 띠, 붉은 테두리, 큰 글자
      const al = Math.min(1, (1 - p) * 8, p * 5), now = performance.now(), blink = 0.6 + 0.4 * Math.sin(now / 90);
      const W = C.W, y0 = H * 0.3, bh = f.hint ? 132 : 92;
      ctx.lineWidth = 18; ctx.strokeStyle = `rgba(255,50,50,${0.55 * al * blink})`; ctx.strokeRect(9, 9, W - 18, H - 18);
      ctx.fillStyle = `rgba(70,0,8,${0.8 * al})`; ctx.fillRect(0, y0, W, bh);
      ctx.fillStyle = `rgba(255,70,70,${0.9 * al})`;
      const off = (now / 14) % 36;
      for (let x = -40 + off; x < W + 40; x += 36) {
        for (const yy of [y0, y0 + bh - 10]) {
          ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + 18, yy); ctx.lineTo(x + 8, yy + 10); ctx.lineTo(x - 10, yy + 10); ctx.closePath(); ctx.fill();
        }
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,255,255,${al * blink})`; ctx.font = '44px "Do Hyeon", sans-serif';
      ctx.fillText('보스 접근', W / 2, y0 + (f.hint ? 44 : 50));
      ctx.fillStyle = `rgba(255,170,170,${al})`; ctx.font = (f.hint ? 24 : 20) + 'px "Do Hyeon", sans-serif';
      ctx.fillText(f.text, W / 2, y0 + (f.hint ? 72 : 74));
      if (f.hint) {                         // 능력 설명: 작은 글씨, 길면 두 줄
        ctx.fillStyle = `rgba(255,225,225,${al})`; ctx.font = '17px "Do Hyeon", sans-serif';
        const lines = []; let cur = '';
        for (const wd of f.hint.split(' ')) {
          if (cur && ctx.measureText(cur + ' ' + wd).width > W - 50) { lines.push(cur); cur = wd; } else cur = cur ? cur + ' ' + wd : wd;
        }
        lines.push(cur);
        lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y0 + 96 + i * 20));
      }
      break;
    }
  }
}
// 보조 포탑: 무기 옆에 떠 있는 작은 포탑 (조준한 쪽을 향하고, 쏠 때 반동)
function drawTurret(w, k, q, st, nowT) {
  const tp = C.turretPos(k, q), bob = RM.matches ? 0 : Math.sin(nowT / 260 + k + q * 2) * 2, x = tp[0], y = tp[1] + bob;
  const ang = (q ? w.g2 : w.g1) || 0, rc = S_t() - (q ? w.f2 : w.f1) < 0.1 ? 3 : 0, col = st.color;
  ctx.strokeStyle = rgba(col, 0.35); ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo((k + 0.5) * C.LW, C.H - 8); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = '#fff'; ctx.fillRect(-1.8, -14 + rc, 3.6, 10);           // 포신
  ctx.fillStyle = col; ctx.fillRect(-1, -13 + rc, 2, 8);
  ctx.restore();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
}
const S_t = () => C.S.t;
// 지뢰: 땅에 박힌 둥근 장치. 점멸하다가 사라질 때가 되면 빨라진다
function drawMine(m, nowT) {
  const col = C.WEAPONS.shotgun.color, sc = m.mini ? 0.66 : 1.15;
  const fast = m.t < 3 ? 110 : 300, on = RM.matches ? 1 : (Math.floor(nowT / fast + m.ph) % 2 === 0 ? 1 : 0);
  ctx.strokeStyle = rgba(col, on ? 0.5 : 0.22); ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(m.x, m.y, 17 * sc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(30,30,40,.5)'; ctx.beginPath(); ctx.ellipse(m.x, m.y + 3, 11 * sc, 5 * sc, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3b3f4d'; ctx.beginPath(); ctx.arc(m.x, m.y, 9 * sc, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2.4; ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = on ? '#ff4d4d' : '#7a2a2a'; ctx.beginPath(); ctx.arc(m.x, m.y, 3.8 * sc, 0, Math.PI * 2); ctx.fill();
  if (on) { ctx.fillStyle = 'rgba(255,80,80,.3)'; ctx.beginPath(); ctx.arc(m.x, m.y, 13 * sc, 0, Math.PI * 2); ctx.fill(); }
}
// 오래 남는 효과: 불길(불바다), 용융선, 잔광(빛의 고리)
function drawKindPool(p, nowT, H) {
  const al = Math.min(1, p.t / 0.5), mo = RM.matches ? 0 : 1;
  if (p.kind === 'fire') {
    ctx.fillStyle = `rgba(255,90,30,${0.2 * al})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) {           // 일렁이는 불꽃 혀
      const bx = p.x + (i - 2.5) * p.r * 0.32, ph = (nowT / 260 + i * 0.37 + p.sd * 5) % 1, h = p.r * (0.55 + 0.45 * Math.sin(ph * Math.PI)) * (mo ? 1 : 0.9 + 0.2 * hash(i + Math.floor(nowT / 90)));
      ctx.fillStyle = `rgba(255,120,30,${0.8 * al})`; ctx.beginPath(); ctx.moveTo(bx - 7, p.y + 6); ctx.quadraticCurveTo(bx - 2, p.y - h * 0.6, bx, p.y - h); ctx.quadraticCurveTo(bx + 3, p.y - h * 0.5, bx + 7, p.y + 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,230,140,${0.85 * al})`; ctx.beginPath(); ctx.moveTo(bx - 3, p.y + 5); ctx.quadraticCurveTo(bx - 1, p.y - h * 0.3, bx, p.y - h * 0.55); ctx.quadraticCurveTo(bx + 2, p.y - h * 0.25, bx + 3, p.y + 5); ctx.closePath(); ctx.fill();
    }
    ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(255,150,60,${0.6 * al})`; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  } else if (p.kind === 'melt') {          // 달궈진 선: 붉게 이글거리는 줄
    const wd = 10 + mo * 3 * Math.sin(nowT / 120 + p.sd * 9), len = H - p.y;
    ctx.fillStyle = `rgba(255,70,40,${0.22 * al})`; ctx.fillRect(p.x - wd * 1.5, p.y, wd * 3, len);
    ctx.fillStyle = `rgba(255,120,50,${0.7 * al})`; ctx.fillRect(p.x - wd / 2, p.y, wd, len);
    ctx.fillStyle = `rgba(255,240,200,${0.85 * al})`; ctx.fillRect(p.x - 1.8, p.y, 3.6, len);
  } else if (p.kind === 'halo') {           // 잔광: 빛의 고리
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, Math.PI, Math.PI * 2); ctx.fillStyle = rgba(p.c, 0.1 * al); ctx.fill();
    ctx.lineWidth = 8 * al + 2; ctx.strokeStyle = `rgba(255,255,255,${0.55 * al})`; ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = rgba(p.c, 0.9 * al); ctx.stroke();
  }
}
function drawRange(w, rk) {
  const H = C.H, W = C.W, st = C.stats(w), wx = (rk + 0.5) * C.LW;
  ctx.fillStyle = rgba(st.color, 0.08); ctx.strokeStyle = rgba(st.color, 0.55); ctx.lineWidth = 1.5;
  if (w.type === 'pulse') { ctx.beginPath(); ctx.arc(wx, H, st.radius, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  else {
    const x0 = Math.max(0, wx - (st.lanes + 0.5) * C.LW), x1 = Math.min(W, wx + (st.lanes + 0.5) * C.LW), y0 = H - st.range * H;
    ctx.fillRect(x0, y0, x1 - x0, H - y0); ctx.strokeRect(x0 + 1, y0 + 1, x1 - x0 - 2, H - y0 + 4);
  }
}
// 보스 능력 예고선: 보스에서 대상까지 굵은 점선 빔, 끝에 맥동하는 표시와 남은 시간
// out: 대상이 전장 밖(인벤토리 칸)이다. 표시는 칸 안의 그림을 가리지 않게 작게, 남은 시간은 전장 아래쪽 선 옆에 쓴다
function aimBeam(g, x0, y0, tx, ty, c, rem, nowW, out, H) {
  const pu = RM.matches ? 0.6 : 0.5 + 0.5 * Math.sin(nowW / 110), al = 0.7 + 0.3 * pu;
  g.lineCap = 'butt';
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(tx, ty);
  g.lineWidth = 12; g.strokeStyle = `rgba(${c},.2)`; g.stroke();
  g.setLineDash([14, 9]); g.lineDashOffset = RM.matches ? 0 : -nowW / 22;
  g.lineWidth = 7; g.strokeStyle = `rgba(${c},${al})`; g.stroke();
  g.lineWidth = 2; g.strokeStyle = `rgba(255,255,255,${0.55 + 0.4 * pu})`; g.stroke();
  g.setLineDash([]); g.lineDashOffset = 0;
  let nx = tx, ny = ty - 24;
  if (out) {
    g.beginPath(); g.arc(tx, ty, 11 + 8 * pu, 0, Math.PI * 2); g.lineWidth = 3.5; g.strokeStyle = `rgba(${c},${1 - 0.5 * pu})`; g.stroke();
    g.beginPath(); g.arc(tx, ty, 5, 0, Math.PI * 2); g.fillStyle = `rgba(${c},1)`; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke();
    const q = ty > y0 ? Math.min(1, Math.max(0, (H - 30 - y0) / (ty - y0))) : 1;   // 선이 전장 아래쪽을 지나는 자리
    nx = Math.min(C.W - 22, Math.max(22, x0 + (tx - x0) * q + 26)); ny = y0 + (ty - y0) * q;
  } else {
    g.beginPath(); g.arc(tx, ty, 12 + 12 * pu, 0, Math.PI * 2); g.lineWidth = 4; g.strokeStyle = `rgba(${c},${1 - 0.5 * pu})`; g.stroke();
    g.beginPath(); g.arc(tx, ty, 8, 0, Math.PI * 2); g.fillStyle = `rgba(${c},1)`; g.fill();
    g.lineWidth = 2; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(tx - 5, ty); g.lineTo(tx + 5, ty); g.moveTo(tx, ty - 5); g.lineTo(tx, ty + 5); g.stroke();
  }
  g.font = '17px "Do Hyeon", sans-serif'; g.textAlign = 'center'; g.lineWidth = 3.5; g.strokeStyle = 'rgba(0,0,0,.75)';
  const tt = Math.max(0, rem).toFixed(1); g.strokeText(tt, nx, ny); g.fillStyle = '#fff'; g.fillText(tt, nx, ny);
}
// 훔칠 인벤토리 칸의 가운데를 전장 좌표로 (전장 아래로 벗어난 값). 칸이 화면에 없으면 null
function stealAim(i) {
  const el = elB.querySelector(`[data-inv="${i}"]`); if (!el) return null;
  const r = el.getBoundingClientRect(), f = cv.getBoundingClientRect(); if (!r.width || !f.width) return null;
  return [(r.left + r.width / 2 - f.left) / sc, (r.top + r.height / 2 - f.top) / sc];
}
// 전장 canvas 밖으로 나간 예고선의 나머지를 화면 전체를 덮는 겹 canvas에 그린다 (같은 좌표계, 전장 아래만)
function drawAimOut(a, nowW, H) {
  if (!a) { if (!aimCv.hidden) aimCv.hidden = true; return; }
  const ar = $('#app').getBoundingClientRect(), f = cv.getBoundingClientRect();
  const w = Math.round(ar.width * dpr), h = Math.round(ar.height * dpr);
  if (aimCv.width !== w || aimCv.height !== h) { aimCv.width = w; aimCv.height = h; }
  if (aimCv.hidden) aimCv.hidden = false;
  const g = aimCtx;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
  g.setTransform(dpr * sc, 0, 0, dpr * sc, (f.left - ar.left) * dpr, (f.top - ar.top) * dpr);
  g.save(); g.beginPath(); g.rect(-C.W, H, C.W * 3, H * 3); g.clip();
  aimBeam(g, a[0], a[1], a[2], a[3], a[4], a[5], nowW, true, H);
  g.restore();
}
function draw() {
  const S = C.S, H = C.H, W = C.W;
  ctx.setTransform(dpr * sc, 0, 0, dpr * sc, 0, 0);
  ctx.fillStyle = TC.bg; ctx.fillRect(0, 0, W, H);
  if (S) for (const f of S.fx) {           // 보스 처치: 짧은 화면 흔들림 (게임 시간 기준이라 멈추면 같이 멈춘다)
    if (f.k !== 'bosskill' || RM.matches) continue;
    const T = f.d - f.t; if (T < 0.35) ctx.translate(Math.sin(T * 130) * 7 * (1 - T / 0.35), Math.cos(T * 110) * 5 * (1 - T / 0.35));
  }
  // 모눈
  ctx.strokeStyle = TC.grid; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 25; x < W; x += 25) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = H % 25; y < H; y += 25) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  // 레인 구분선
  ctx.strokeStyle = TC.lane; ctx.setLineDash([6, 8]); ctx.beginPath();
  for (let k = 1; k < C.LANES; k++) { ctx.moveTo(k * C.LW, 0); ctx.lineTo(k * C.LW, H); }
  ctx.stroke(); ctx.setLineDash([]);
  if (!S) return;

  // 고른 무기의 공격 범위. 끌고 있는 무기가 무기 칸 위에 있으면 그 칸에서의 범위를 미리 보여 준다
  const rk = sel && sel.from === 'slot' ? sel.k : -1;
  if (rk >= 0 && S.slots[rk]) drawRange(S.slots[rk], rk);
  else if (drag && drag.active && drag.over && drag.over.dataset.slot != null) {
    const sr = drag.src, dw = sr.from === 'slot' ? S.slots[sr.k] : S.inv[sr.i];
    if (dw && dw.kind === 'w') drawRange(dw, +drag.over.dataset.slot);
  }
  const bs = C.bstats(), nowT = performance.now();
  if (bs.nearSlow) {                         // 감속 철조망 구역
    ctx.fillStyle = 'rgba(110,200,255,.06)'; ctx.fillRect(0, H * 0.75, W, H * 0.25);
    ctx.strokeStyle = 'rgba(110,200,255,.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 7]); ctx.beginPath(); ctx.moveTo(0, H * 0.75); ctx.lineTo(W, H * 0.75); ctx.stroke(); ctx.setLineDash([]);
  }
  if (bs.fence) {                            // 전기 울타리
    ctx.strokeStyle = TC.fence; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x <= W; x += 20) { const y = H * 0.86 + ((x / 20 + Math.floor(nowT / 90)) % 2 ? -5 : 5); if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
  }
  for (const p of S.pools) {
    if (p.kind) { drawKindPool(p, nowT, H); continue; }
    if (p.acid) {                            // 산성 웅덩이: 일렁이는 초록 웅덩이와 부글거리는 거품
      const al = Math.min(1, p.t / 0.6), wob = RM.matches ? 0 : 1;
      ctx.beginPath();
      for (let k = 0; k <= 14; k++) {
        const a = k * Math.PI * 2 / 14, rr = p.r * (1 + wob * 0.05 * Math.sin(nowT / 320 + k * 1.9 + p.sd * 9));
        if (k) ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); else ctx.moveTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fillStyle = rgba(p.c, 0.26 * al); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = rgba(p.c, 0.75 * al); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.62, 0, Math.PI * 2); ctx.fillStyle = rgba(p.c, 0.14 * al); ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(p.c, 0.9 * al);
      for (let k = 0; k < 6; k++) {
        const ph = (nowT / 1100 + k * 0.17 + p.sd) % 1, a = hash(p.sd * 50 + k * 7.3) * Math.PI * 2, d = hash(p.sd * 30 + k * 2.9) * p.r * 0.75;
        const bx = p.x + Math.cos(a) * d, by = p.y + Math.sin(a) * d * 0.9 - ph * 5, br = 2 + 5 * ph;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = rgba(p.c, 0.5 * al * (1 - ph)); ctx.fill();
      }
      continue;
    }
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.c ? rgba(p.c, 0.1 + 0.12 * Math.min(1, p.t)) : `rgba(255,140,60,${0.1 + 0.12 * Math.min(1, p.t)})`; ctx.fill();
    ctx.strokeStyle = p.c ? rgba(p.c, 0.55) : 'rgba(255,160,80,.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
  }
  const nowW = performance.now();
  for (const m of S.mines) drawMine(m, nowW);
  if (S.pendingBoss) drawSummon(S.pendingBoss, H);
  let aimOut = null;                         // 전장 아래로 이어지는 예고선 (약탈: 훔칠 인벤토리 칸까지)
  for (const e of S.enemies) {              // 봉쇄, 약탈, 부식 예고: 보스에서 대상 칸까지 굵은 점선 빔과 맥동하는 표시
    if (e.dead || !e.boss || e.y <= 0) continue;
    let tx = -1, ty = H - 24, c = '', rem = 0, out = false;
    if (e.type === 'jammer') { for (const j of Object.keys(S.locks)) if (S.locks[j].w > 0) { tx = (+j + 0.5) * C.LW; c = '255,61,90'; rem = S.locks[j].w; break; } }
    else if (e.type === 'corrode' && S.corr) { tx = (S.corr.k + 0.5) * C.LW; c = '200,90,255'; rem = S.corr.t; }
    else if (e.type === 'thief' && S.steal) {
      c = '255,79,163'; rem = S.steal.t;
      const a = stealAim(S.steal.i);
      if (a) { tx = a[0]; ty = a[1]; out = true; } else tx = W / 2;
    }
    if (tx < 0) continue;
    aimBeam(ctx, e.x, e.y, tx, ty, c, rem, nowW, out, H);
    if (out) aimOut = [e.x, e.y, tx, ty, c, rem];
  }
  drawAimOut(aimOut, nowW, H);
  for (const e of S.enemies) {
    const age = e.boss && e.born != null ? S.t - e.born : 9;
    if (age < 0.3) {                         // 보스 등장: 작게 시작해 살짝 넘쳤다가 제 크기로 (보이는 효과만)
      const u = age / 0.3, k = Math.max(0.05, 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2));
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(k, k); ctx.translate(-e.x, -e.y); drawEnemy(e); ctx.restore();
    } else drawEnemy(e);
  }
  for (const b of S.beams) {                // 지속 빔
    const st = b.st, x = (b.k + 0.5) * C.LW, len = st.range * H, wd = 10 + Math.random() * 8;
    ctx.fillStyle = rgba(st.color, 0.55); ctx.fillRect(x - wd / 2, H - len, wd, len);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(x - 2, H - len, 4, len);
  }
  for (let k = 0; k < C.LANES; k++) {       // 진화 무기의 스킬 표시 (항상 켜진 것들)
    const w = S.slots[k]; if (!w || !w.evo) continue;
    const st = C.stats(w), x = (k + 0.5) * C.LW;
    if (w.type === 'laser' && st.always) {  // 상시 빔: 꺼지지 않는 빔
      const len = st.range * H, wd = 8 + (RM.matches ? 0 : 3 * Math.sin(nowT / 70 + k));
      ctx.fillStyle = rgba(st.color, 0.2); ctx.fillRect(x - wd * 1.6, H - len, wd * 3.2, len);
      ctx.fillStyle = rgba(st.color, 0.7); ctx.fillRect(x - wd / 2, H - len, wd, len);
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(x - 1.8, H - len, 3.6, len);
      ctx.fillStyle = rgba(st.color, 0.55); ctx.beginPath(); ctx.arc(x, H - len, 7 + (RM.matches ? 0 : 2 * Math.sin(nowT / 90)), 0, Math.PI * 2); ctx.fill();
    }
    if (w.type !== 'pulse') continue;
    if (st.fld) {                           // 역장: 항상 켜진 원
      const R = st.radius * 0.7, rot = RM.matches ? 0 : nowT / 1600;
      ctx.beginPath(); ctx.arc(x, H, R, Math.PI, Math.PI * 2); ctx.fillStyle = rgba(st.color, 0.1); ctx.fill();
      ctx.setLineDash([9, 7]); ctx.lineDashOffset = -rot * 40; ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(st.color, 0.75); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, H, R * 0.86, Math.PI, Math.PI * 2); ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(st.color, 0.35); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
    if (st.orbs) {
      const sz = st.orbSize || 1;
      if (st.orbChain && st.orbs > 1) {     // 전기 사슬: 구체 사이의 번개 줄
        for (let i = 0; i < st.orbs; i++) C.orbPos(k, st, i, S.t, OPOS[i]);
        const segs = st.orbs === 2 ? 1 : st.orbs, tick = Math.floor(nowT / 55);
        ctx.lineJoin = 'round';
        for (let q = 0; q < segs; q++) {
          const a = OPOS[q], b = OPOS[(q + 1) % st.orbs], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, n = Math.max(3, Math.round(len / 22));
          ctx.beginPath(); ctx.moveTo(a[0], a[1]);
          for (let j = 1; j < n; j++) { const u = j / n, off = (hash(tick * 3.1 + q * 17 + j) - 0.5) * 20; ctx.lineTo(a[0] + dx * u + nx * off, a[1] + dy * u + ny * off); }
          ctx.lineTo(b[0], b[1]);
          ctx.lineWidth = 6; ctx.strokeStyle = rgba(st.color, 0.25); ctx.stroke();
          ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        }
      }
      for (let i = 0; i < st.orbs; i++) {
        for (let j = 9; j >= 0; j--) {      // 작은 점과 지나온 궤적
          const q = C.orbPos(k, st, i, S.t - j * 0.035, OPOS[4]);
          ctx.beginPath(); ctx.arc(q[0], q[1], 7 * sz * (1 - j / 12), 0, Math.PI * 2);
          ctx.fillStyle = j ? rgba(st.color, 0.42 * (1 - j / 10)) : st.color; ctx.fill();
        }
      }
    }
  }
  ctx.lineCap = 'round';
  for (const b of S.bullets) {
    const ev = b.st && b.st.evo, k = ev ? 1.2 : 1;   // 진화한 무기의 탄은 20% 크고 더 밝다
    if (b.big) {                            // 거대탄, 슬러그탄
      if (b.r > 30) {                       // 블래스터 거대탄: 레인 폭의 빛덩이와 긴 꼬리
        const rw = b.r;
        ctx.fillStyle = rgba(b.c, 0.18); ctx.fillRect(b.x - rw * 0.8, b.y, rw * 1.6, 90);
        ctx.fillStyle = rgba(b.c, 0.3); ctx.beginPath(); ctx.ellipse(b.x, b.y, rw, rw * 1.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(b.c, 0.6); ctx.beginPath(); ctx.ellipse(b.x, b.y, rw * 0.68, rw * 0.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(b.x, b.y, rw * 0.34, rw * 0.46, 0, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.ellipse(b.x, b.y, rw, rw * 1.05, 0, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * k, 0, Math.PI * 2); ctx.fillStyle = rgba(b.c, ev ? 0.55 : 0.4); ctx.fill();
      ctx.lineWidth = 3 * k; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45 * k, 0, Math.PI * 2); ctx.fillStyle = b.c; ctx.fill();
      continue;
    }
    if (b.fl) {                             // 화염 산탄: 날아갈수록 커지는 불꽃 덩이
      const q = Math.min(1, (b.d0 - b.left) / 150), r = 5 + 9 * q;
      ctx.fillStyle = `rgba(255,90,30,${0.34 * (1 - 0.5 * q)})`; ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,150,40,${0.7 - 0.3 * q})`; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,236,150,${0.9 - 0.5 * q})`; ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.5, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    if (b.sm) {                             // 보조 포탑의 작은 탄
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022);
      ctx.lineWidth = 4; ctx.strokeStyle = rgba(b.c, 0.3); ctx.stroke();
      ctx.lineWidth = 1.8; ctx.strokeStyle = '#fff'; ctx.stroke();
      continue;
    }
    const ty = b.st && b.st.type;
    if (ty === 'blaster') {
      if (b.th) {                           // 개틀링: 가늘고 짧은 탄. 달아오르면 하얗고 붉은 빛이 번진다
        if (b.hl) { ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); ctx.lineWidth = 4.5; ctx.strokeStyle = `rgba(255,90,40,${0.12 + 0.05 * b.hl})`; ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
        ctx.lineWidth = 2.2; ctx.strokeStyle = b.c; ctx.stroke();
        continue;
      }
      if (b.bm) {                           // 광탄: 길쭉한 빛살
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.085 * k, b.y - b.vy * 0.085 * k);
        ctx.lineWidth = 9; ctx.strokeStyle = rgba(b.c, 0.22); ctx.stroke();
        ctx.lineWidth = 4; ctx.strokeStyle = rgba(b.c, 0.85); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.06 * k, b.y - b.vy * 0.06 * k);
        ctx.lineWidth = 1.8; ctx.strokeStyle = '#fff'; ctx.stroke();
        continue;
      }
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.05 * k, b.y - b.vy * 0.05 * k);   // 날카로운 탄과 짧게 빛나는 꼬리
      ctx.lineWidth = 7 * k; ctx.strokeStyle = rgba(b.c, ev ? 0.45 : 0.25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.03 * k, b.y - b.vy * 0.03 * k);
      ctx.lineWidth = 3 * k; ctx.strokeStyle = b.c; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x + b.vx * 0.006, b.y + b.vy * 0.006); ctx.lineTo(b.x - b.vx * 0.008 * k, b.y - b.vy * 0.008 * k);
      ctx.lineWidth = 2 * k; ctx.strokeStyle = '#fff'; ctx.stroke();
      continue;
    }
    if (ty === 'shotgun') {                 // 짧은 줄무늬 산탄
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.026 * k, b.y - b.vy * 0.026 * k);
      ctx.lineWidth = 4 * k; ctx.strokeStyle = rgba(b.c, ev ? 0.5 : 0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.013 * k, b.y - b.vy * 0.013 * k);
      ctx.lineWidth = 2.4 * k; ctx.strokeStyle = ev ? '#fff' : b.c; ctx.stroke();
      continue;
    }
    ctx.strokeStyle = b.c; ctx.lineWidth = (b.r < 5 ? 2.5 : 4) * k; ctx.beginPath();
    ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.018 * k, b.y - b.vy * 0.018 * k); ctx.stroke();
    if (ev) { ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.008, b.y - b.vy * 0.008); ctx.stroke(); }
  }
  ctx.lineCap = 'butt';
  for (const s of S.shells) {
    const x = s.x0 + (s.tx - s.x0) * s.p, gy = s.y0 + (s.ty - s.y0) * s.p, hgt = Math.sin(s.p * Math.PI);
    const y = gy - hgt * (s.acid ? 60 : 70);
    ctx.beginPath(); ctx.ellipse(x, gy, (s.nuke ? 14 : 9) - 3 * hgt, ((s.nuke ? 14 : 9) - 3 * hgt) * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(30,30,40,${0.16 + 0.12 * (1 - hgt)})`; ctx.fill();   // 땅 위를 따라가는 그림자
    if (s.acid) {                           // 산성 덩어리와 떨어질 자리
      const pr = 75 * (1 + s.st.aRange + s.st.areaPct);
      ctx.beginPath(); ctx.arc(s.tx, s.ty, pr * (0.5 + 0.5 * s.p), 0, Math.PI * 2); ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(s.st.color, 0.55); ctx.stroke(); ctx.setLineDash([]);
      const sk = s.st.evo ? 1.2 : 1;
      ctx.beginPath(); ctx.arc(x, y, 7 * sk, 0, Math.PI * 2); ctx.fillStyle = s.st.color; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(s.st.color, s.st.evo ? 0.8 : 0.5); ctx.beginPath(); ctx.arc(x, y, 10.5 * sk, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x - 2.2, y - 2.4, 2, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.beginPath(); ctx.arc(s.tx, s.ty, s.nuke ? 26 : 10, 0, Math.PI * 2); ctx.strokeStyle = s.nuke ? 'rgba(255,255,255,.8)' : rgba(s.st.color, 0.5); ctx.lineWidth = s.nuke ? 3 : 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, (s.nuke ? 13 : 7) * (s.st.evo ? 1.2 : 1), 0, Math.PI * 2); ctx.fillStyle = s.nuke ? '#fff' : s.st.color; ctx.fill();
    if (s.st.evo) { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.stroke(); }
  }
  for (const f of S.fx) drawFx(f, H);
  // 보스가 살아 있는 동안 위쪽에 체력 막대
  let boss = null;
  for (const e of S.enemies) if (e.boss && (!boss || e.y > boss.y)) boss = e;
  if (boss) {
    const bw = W - 24;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(12, 8, bw, 11);
    ctx.fillStyle = '#ff3d3d'; ctx.fillRect(12, 8, bw * Math.max(0, boss.hp / boss.maxHp), 11);
    ctx.lineWidth = 1.5; ctx.strokeStyle = TC.bossLine; ctx.strokeRect(12, 8, bw, 11);
    ctx.fillStyle = TC.bossTxt; ctx.font = '17px "Do Hyeon", sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('보스 · ' + C.ENEMIES[boss.type].name, 12, 38);
  }
  // 기지와 포구
  ctx.fillStyle = S.hitFlash > 0 ? '#ff5d5d' : TC.base;
  ctx.fillRect(0, H - 4, W, 4);
  if (bs.turret) { ctx.fillStyle = TC.turret; ctx.fillRect(W / 2 - 10, H - 17, 20, 13); ctx.fillRect(W / 2 - 3, H - 26, 6, 11); }
  for (let k = 0; k < C.LANES; k++) {
    const w = S.slots[k]; if (!w) continue;
    const x = (k + 0.5) * C.LW;
    if (w.type === 'laser' && w.cd > 0.05 && w.cd < 0.2) {   // 발사 직전 충전 빛 (막 쏘려는 순간에만)
      const q = 1 - (w.cd - 0.05) / 0.15, col = C.WEAPONS.laser.color;
      ctx.fillStyle = rgba(col, 0.18 + 0.3 * q); ctx.beginPath(); ctx.arc(x, H - 14, 8 + 16 * q, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(col, 0.9); ctx.beginPath(); ctx.arc(x, H - 14, 2 + 4 * q, 0, Math.PI * 2); ctx.fill();
    }
    const hl = w.evo ? C.heatLevel(w) : 0;
    if (hl > 0) {                           // 예열: 무기 둘레가 붉게 달아오른다
      ctx.fillStyle = `rgba(255,70,30,${0.5 * hl})`; ctx.beginPath(); ctx.arc(x, H - 8, 16 + 14 * hl, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,190,120,${0.7 * hl})`; ctx.beginPath(); ctx.arc(x, H - 8, 8 + 6 * hl, Math.PI, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = hl > 0 ? `rgb(255,${Math.round(110 + 100 * (1 - hl))},${Math.round(80 + 120 * (1 - hl))})` : C.WEAPONS[w.type].color; ctx.beginPath();
    ctx.moveTo(x, H - 13); ctx.lineTo(x + 9, H - 3); ctx.lineTo(x - 9, H - 3); ctx.closePath(); ctx.fill();
    if (w.evo && w.type === 'blaster') { const st = C.stats(w); if (st.tur) for (let q = 0; q < (st.turTwin ? 2 : 1); q++) drawTurret(w, k, q, st, nowT); }
  }
}

/* ---------- 상태 표시 ---------- */
const OPOS = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];   // 구체 위치 계산용 (매 프레임 새로 만들지 않는다)
const hudEl = { hp: $('#hpTxt'), fill: $('#hpFill'), t: $('#tTxt'), k: $('#kTxt') };
const hudPrev = {};
function setText(key, v) { if (hudPrev[key] !== v) { hudPrev[key] = v; hudEl[key].textContent = v; } }
function hud() {
  const S = C.S; if (!S) return;
  setText('hp', String(Math.ceil(S.hp)));
  setText('t', fmtTime(S.t)); setText('k', String(S.kills));
  const w = Math.max(0, S.hp / S.maxHp * 100).toFixed(0) + '%';
  if (hudPrev.w !== w) { hudPrev.w = w; hudEl.fill.style.width = w; hudEl.fill.classList.toggle('low', S.hp / S.maxHp < 0.3); }
}

/* ---------- 진행 ---------- */
let last = 0, acc = 0, lightAt = 0;
function frame(ts) {
  const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
  const S = C.S;
  if (mode === 'play' && S && !S.pendingAug && !S.pendingPact && wmodal < 0 && !bmodal && !partSwap && skK < 0 && evoK < 0) {
    legendMark();
    acc += dt * speed; let n = 0;
    while (acc >= 1 / 60 && n < 12) { C.step(1 / 60); acc -= 1 / 60; n++; }
    if (n === 12) acc = 0;
    if (S.snd && S.snd.length) { for (const n of S.snd) Snd.play(n); S.snd.length = 0; }
    if (S.rewq && S.rewq.length) bossRewards(S.rewq.splice(0));     // 인벤토리를 다시 그리기 전에: 날아오는 물건의 칸을 먼저 가린다
    if (S.invDirty) { S.invDirty = false; renderBottom(); }
    if (S.slotDirty) { S.slotDirty = false; renderWeapons(); }
    if (S.abfx && S.abfx.length) { for (const a of S.abfx.splice(0)) abHitFx(a.kind, a.i); }
    if (S.notes && S.notes.length) say(S.notes.splice(0).join('<br>'), true);
    if (S.evq && S.evq.length) drainEvq();
    if (S.revived) { S.revived = false; say('<b>비상 방벽</b>이 기지를 지켰습니다. 방벽 파츠는 사라졌습니다.'); }
    if (S.newDrop) { S.newDrop = false; legendScan(); }                 // 기다리던 보상이 늦게 들어올 때도 알림 글은 없다
    if (S.over) gameOver();
    else if (S.pendingPact) { renderAll(); }   // 천칭이 쓰러짐: 거래 제안 창을 연다
  }
  if (drag && performance.now() - drag.at > 6000) endDrag(false);   // 신호가 끊긴 끌기 정리
  draw(); hud(); updateChips();
  if (ts - lightAt > 120) { lightAt = ts; lightUpdate(); }
  requestAnimationFrame(frame);
}

function snapshot() {
  const S = C.S;
  if (!S || (mode !== 'play' && mode !== 'pause') || S.over) return {};
  const copy = Object.assign({}, S, {
    bullets: [], shells: [], pools: [], beams: [], mines: [], fx: [], snd: [], abfx: [], rewq: [], pendingAug: S.pendingAug,
    enemies: S.enemies.map(e => Object.assign({}, e, { burnSt: null, burnT: 0, burnDps: 0, lgSt: null, lgT: 0, fSt: null, fT: 0, fDps: 0, fcB: null })),
  });
  return { S: JSON.parse(JSON.stringify(copy)) };
}
function start(data) {
  applyTheme(loadTheme(), false);
  try {
    const s = data && data.S;
    if (s && s.v === 1 && Array.isArray(s.slots) && Array.isArray(s.inv) && !s.over) { C.setState(s); mode = 'pause'; }
  } catch (e) { /* 이어하기 실패 시 새로 시작 */ }
  if (!C.S) C.newGame();
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap); else window.addEventListener('resize', resize);
  renderAll();
  requestAnimationFrame(frame);
}
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) { try { hot.snapshot(snapshot); } catch (e) { /* 무시 */ } }
if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});

// 점검용
window.__game = { start: startGame, get mode() { return mode; } };
window.__shareBlob = () => buildShare();   // 점검용: 공유 이미지(PNG Blob)를 지금 상태로 만든다
})();

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
const bannerEl = document.createElement('div'); bannerEl.id = 'pactBanner'; wrap.appendChild(bannerEl);   // 거래 완료 배너 (입력을 막지 않는다)
const markEl = document.createElement('button'); markEl.id = 'pactMark'; markEl.type = 'button'; markEl.dataset.act = 'pactMark'; markEl.hidden = true; markEl.setAttribute('aria-label', '맺은 거래 보기');
markEl.innerHTML = '<svg viewBox="-1 0 26 20" width="18" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v15M7 17h10M3 5h18M3 5l-2.5 7M3 5l2.5 7M0.5 12q2.5 3 5 0M21 5l-2.5 7M21 5l2.5 7M18.5 12q2.5 3 5 0"/></svg><b></b>';
wrap.appendChild(markEl);
let markN = 0, markLow = null;
const GR = C.GRADES;
const GHEX = ['#aab6cc', '#5cb8ff', '#c48bff', '#ffa63d'];   // 등급 색 (테마를 바꾸면 값만 바뀐다)
const ECOL = { basic: '#ff6b6b', runner: '#ffa06b', swarm: '#ff7fb0', heavy: '#f0508c', giant: '#ff3d3d', split: '#ff3d3d',
  summon: '#ff5fd0', jammer: '#ff2e63', shield: '#ff6b8a', thief: '#ff4fa3', corrode: '#d04cff', scale: '#8f9bb5',
  charge: '#ff4d2e', clock: '#ff5c7a' };
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
const skMem = new WeakMap();                // 무기별로 마지막에 찍은 노드 {l, t}. 무기 객체에 묶여 칸을 옮겨도 따라가고, Core.S 에는 남지 않는다
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
  // 서서히 커지다 끝에서 끊기는 소리. 저역 필터가 함께 열린다. type 이 'noise' 면 걸러 낸 잡음
  function swell(type, f0, f1, dur, vol, lp0, lp1) {
    const t = ac.currentTime, f = ac.createBiquadFilter(), g = ac.createGain();
    let o;
    if (type === 'noise') { o = ac.createBufferSource(); o.buffer = noise; o.loop = true; }
    else { o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); }
    f.type = 'lowpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(lp0, t); f.frequency.exponentialRampToValueAtTime(lp1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.92); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.1);
  }
  // 진화: 낮은 울림이 T초 동안 차오르다 "쿵" (톱니파 배음이 있어 휴대폰 스피커에서도 들린다), 묵직한 여운
  const evoSnd = (T) => () => {
    swell('sawtooth', 52, 66, T, 0.08, 160, 560); swell('sine', 104, 132, T, 0.05, 2000, 2000); swell('noise', 0, 0, T, 0.09, 170, 650);
    tone('sine', 150, 40, 0.55, 0.34, T); tone('triangle', 96, 45, 0.35, 0.16, T);
    hiss(0.3, 0.22, 600, 0.7, 'lowpass', T); hiss(0.07, 0.05, 2400, 1, 'bandpass', T);
    tone('sine', 73.4, 73.4, 1.1, 0.09, T + 0.04); tone('sine', 110, 110, 0.9, 0.05, T + 0.04);
  };
  // [최소 간격(ms), 재생 함수]
  const DEF = {
    blaster: [70, () => tone('square', 880, 420, 0.06, 0.045)],
    spray: [45, () => { tone('square', 150, 62, 0.045, 0.05); hiss(0.035, 0.07, 1300, 0.9, 'lowpass'); }],                                   // 난사: 짧고 낮은 "두두두"
    rack: [200, () => { hiss(0.03, 0.13, 3200, 2.5, 'bandpass'); tone('square', 1900, 1100, 0.025, 0.03); hiss(0.045, 0.15, 2100, 2, 'bandpass', 0.085); tone('square', 1250, 680, 0.035, 0.04, 0.085); tone('triangle', 240, 140, 0.07, 0.07, 0.085); }],   // 재장전 끝: 철컥
    shotgun: [110, () => { hiss(0.09, 0.13, 1800); tone('sine', 160, 70, 0.08, 0.1); }],
    laser: [120, () => tone('sawtooth', 1400, 300, 0.16, 0.045)],
    pulse: [140, () => tone('sine', 260, 70, 0.2, 0.13)],
    mortar: [120, () => tone('sine', 140, 55, 0.14, 0.15)],
    tesla: [100, () => { hiss(0.07, 0.09, 3500, 3, 'bandpass'); tone('square', 1700, 900, 0.05, 0.025); }],
    rail: [150, () => tone('triangle', 2100, 1700, 0.025, 0.012)],                                            // 조준: 작게 딸깍
    railfire: [110, () => { hiss(0.03, 0.2, 5200, 0.7, 'highpass'); hiss(0.07, 0.24, 2300, 0.9, 'bandpass'); tone('sine', 165, 44, 0.22, 0.22); tone('triangle', 110, 46, 0.14, 0.09); hiss(0.18, 0.06, 1500, 0.7, 'lowpass', 0.1); hiss(0.24, 0.03, 900, 0.7, 'lowpass', 0.23); }],   // 저격: 짧고 날카로운 "탕" (잡음 터짐 + 낮은 쿵 + 짧은 메아리)
    cycle: [160, () => { hiss(0.025, 0.1, 3000, 2.5, 'bandpass', 0.06); tone('square', 1700, 1050, 0.02, 0.025, 0.06); hiss(0.035, 0.12, 1900, 2, 'bandpass', 0.15); tone('square', 1150, 620, 0.03, 0.035, 0.15); }],   // 연속 사냥: 노리쇠 "철컥" (탕 바로 뒤에)
    acid: [170, () => { tone('sine', 380, 520, 0.08, 0.035); hiss(0.06, 0.04, 1500, 1.2, 'bandpass'); }],       // 던지는 소리
    splat: [90, () => { hiss(0.13, 0.06, 900, 1, 'lowpass'); tone('sine', 260, 120, 0.1, 0.035); }],          // 웅덩이에 철퍽
    boom: [90, () => { hiss(0.28, 0.2, 500, 0.6); tone('sine', 90, 40, 0.25, 0.17); }],
    nuke: [160, () => { tone('sine', 120, 26, 0.95, 0.26); hiss(0.8, 0.24, 360, 0.5); tone('triangle', 64, 30, 0.7, 0.1, 0.04); hiss(0.12, 0.08, 2600, 1, 'highpass'); }],   // 핵탄두: 낮고 긴 굉음
    rain: [600, () => { hiss(1.4, 0.06, 5200, 0.6, 'highpass'); hiss(1.2, 0.05, 900, 0.8, 'bandpass', 0.1); }],                              // 산성비: 쏴아 하는 빗소리
    crack: [140, () => { hiss(0.02, 0.15, 4200, 1.2, 'highpass', 0.03); hiss(0.05, 0.12, 2600, 3, 'bandpass', 0.04); tone('triangle', 1500, 700, 0.05, 0.03, 0.04); }],   // 균열: 금 간 몸이 쩍 갈라지는 소리 (탕 바로 뒤)
    mkslide: [200, () => tone('sine', 880, 1480, 0.12, 0.025)],                                                    // 표식 이전: 레이저가 다음 표적으로 옮겨 가는 작은 소리
    thunder: [110, () => { hiss(0.06, 0.2, 3800, 0.8, 'highpass'); tone('square', 2200, 260, 0.07, 0.035); hiss(0.55, 0.13, 280, 0.6, 'lowpass', 0.025); tone('sine', 78, 38, 0.45, 0.11, 0.02); }],   // 낙뢰: 날카롭게 찢는 소리와 낮은 우르릉
    ball: [300, () => { tone('sawtooth', 120, 180, 0.35, 0.03); hiss(0.3, 0.05, 2600, 4, 'bandpass'); }],                                   // 구전: 낮게 웅웅거리는 소리
    zap: [150, () => { hiss(0.18, 0.18, 3000, 1.5, 'bandpass'); tone('square', 1400, 120, 0.2, 0.05); tone('sine', 110, 45, 0.3, 0.12); }],      // 쌍구전 폭발: 지지직 터지는 소리
    air: [400, () => { swell('noise', 0, 0, 0.95, 0.05, 160, 700); swell('sawtooth', 52, 64, 0.95, 0.018, 120, 380); tone('sine', 1500, 520, 0.5, 0.03, 0.85); tone('sine', 1180, 430, 0.5, 0.018, 0.9); }],   // 공습: 다가오는 폭격기 소리, 떨어지는 휘파람
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
    wave: [500, () => { seq('triangle', [523, 784], 0.16, 0.07, 0.09); hiss(0.25, 0.025, 1800, 0.7, 'lowpass'); }],                                  // 웨이브 시작: 가볍게 올라가는 두 음 (보스 경보보다 작게)
    tick: [300, () => { tone('square', 1760, 1760, 0.016, 0.022); tone('triangle', 880, 880, 0.035, 0.035); }],                                     // 다음 웨이브 초읽기: 작은 똑딱
    dash: [300, () => { hiss(0.34, 0.2, 700, 0.8); tone('sawtooth', 240, 70, 0.3, 0.07); tone('sine', 90, 45, 0.3, 0.12, 0.05); }],                   // 돌격체 돌진: 휙 하고 밀고 내려오는 소리
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
    evolve: [400, evoSnd(0.95)],                                                                            // 진화 (쿵: 1.5초 중 63%)
    evolveq: [400, evoSnd(0.38)],                                                                           // 진화, 움직임 줄이기 (0.6초)
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
  spread: `<path d="M12 22v-8M12 14L5.5 6.5M12 14V5M12 14l6.5-7.5"/><circle cx="5" cy="5.5" r="2" ${FILL}/><circle cx="12" cy="3.5" r="2" ${FILL}/><circle cx="19" cy="5.5" r="2" ${FILL}/>`,
  nolimit: '<path d="M12 12c-2-3-4-4.5-6-4.5a4.5 4.5 0 0 0 0 9c2 0 4-1.5 6-4.5zm0 0c2 3 4 4.5 6 4.5a4.5 4.5 0 0 0 0-9c-2 0-4 1.5-6 4.5z"/>',
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
  const now = performance.now();
  for (let k = 0; k < C.LANES; k++) {
    const w = S.slots[k];
    const mine = sel && sel.from === 'slot' && sel.k === k;
    const lk = S.locks && S.locks[k], cr = S.corr && S.corr.k === k, closed = C.isClosed(k);
    const ev = w && w.evo && !closed ? evoSlotHtml(w, now) : null;   // 진화하는 중
    const wl = lk && lk.w > 0, cls = 'slot' + (w ? '' : ' empty') + (w && w.evo ? ' evo' : '') + (ev ? ' evoing' : '') + (closed ? ' closed' : '') + (mine ? ' sel' : '') + (!closed && target && (picked.kind === 'w' || w) ? ' tg' : '') +
      (lk ? (lk.l > 0 ? ' locked' : ' warn-lock') : '') + (cr ? ' warn-corr' : '');
    // 남는 빛의 숨 위상: 진화가 끝난 때부터 (다시 그려도 이어진다)
    const st = w && w.evo ? `--wc:${C.WEAPONS[w.type].color};--eb:-${(((now - (evoBorn.get(w) || 0)) / 1000) % 8.8).toFixed(2)}s${ev ? ev.style : ''}` : '';
    h += `<button type="button" class="${cls}" data-slot="${k}"${st ? ` style="${st}"` : ''} aria-label="무기 칸 ${k + 1}${closed ? ' 폐쇄됨' : ''}">`;
    if (closed) h += `<svg class="xmark" viewBox="0 0 24 24" width="30" height="30" ${SVG_ATTR}><path d="M5 5l14 14M19 5L5 19" stroke-width="2.6"/></svg><small class="cl">폐쇄</small>`;
    else if (w) {
      h += (ev ? ev.html : icon(w.type, 26, w.evo) + `<b class="lv">${lvTxt(w)}</b>`) + '<span class="pips">' +
        w.parts.map(p => `<i class="pp"${p ? ` style="background:${GHEX[p.g]};border-color:${GHEX[p.g]}"` : ''}></i>`).join('') +
        '</span><span class="pips">' +
        w.augs.map(a => `<i class="pa"${a ? ` style="background:${GHEX[a.g]};border-color:${GHEX[a.g]}"` : ''}></i>`).join('') + '</span>' +
        (upmode ? '<span class="upcue"><i></i><i></i></span>' : '') + (w.evo && C.skillPoints(w).left > 0 ? '<i class="skdot" aria-label="남은 스킬 포인트"></i>' : '') + (ev ? ev.ring : '');
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
/* ---------- 진화하는 순간: 무기 칸에서 약 1.5초 (게임은 멈추지 않는다) ----------
   칸이 어두워지며 아이콘이 빨려 들고(낮은 울림) → 테두리를 따라 무기 색 빛이 한 바퀴 차오르고 → 쿵: 칸이 눌렸다 튀고,
   전장이 아주 약하게 흔들리고, 그 레인에 빛기둥이 솟고, ★ 가 찍힌다. 그 뒤로 칸 둘레에 은은한 빛이 남는다(.slot.evo::after).
   칸 안의 움직임은 CSS 이고 지난 시간(--ea)에서 이어지므로 칸을 다시 그려도 끊기지 않는다. 무기 객체를 따라가서 연출 중에 칸을 옮겨도 된다 */
const EVO_HIT = 0.63;                        // 쿵 하는 순간 (전체 길이에 대한 비율, style.css 의 63% 와 같다)
const evoRun = [];                           // 진행 중인 연출 {w, t0, D, P, path}. 빛기둥이 사라질 때까지 남는다
const evoBorn = new WeakMap();               // 무기별 연출이 끝난 시각: 남는 빛이 그때부터 숨 쉰다 (다시 그려도 위상이 이어진다)
function evoStart(w, k) {
  const el = elW.querySelector(`[data-slot="${k}"]`), D = RM.matches ? 0.6 : 1.5, P = RM.matches ? 0.45 : 0.75, t0 = performance.now();   // P: 빛기둥 길이
  // 테두리 빛이 지나갈 길: 칸 위쪽 가운데에서 시작해 시계 방향으로 한 바퀴 (전장 쪽에서 끝나 빛기둥으로 이어진다)
  const bw = el ? el.offsetWidth : 70, bh = el ? el.offsetHeight : 76, i = 0.75, R = 5.25, x1 = bw - i, y1 = bh - i, f = (v) => +v.toFixed(2);
  const path = `M${f(bw / 2)} ${i}H${f(x1 - R)}A${R} ${R} 0 0 1 ${f(x1)} ${i + R}V${f(y1 - R)}A${R} ${R} 0 0 1 ${f(x1 - R)} ${f(y1)}H${i + R}A${R} ${R} 0 0 1 ${i} ${f(y1 - R)}V${i + R}A${R} ${R} 0 0 1 ${i + R} ${i}Z`;
  for (let j = evoRun.length - 1; j >= 0; j--) if (evoRun[j].w === w) evoRun.splice(j, 1);
  evoRun.push({ w, t0, D, P, path });
  evoBorn.set(w, t0 + D * 1000);
  Snd.play(RM.matches ? 'evolveq' : 'evolve');
  renderWeapons();
  setTimeout(() => {                         // 빛기둥까지 끝나면 연출용 요소를 걷어 낸다 (칸 요소는 그때까지 마지막 모습으로 멈춰 있다. 끄는 중이면 renderWeapons 가 끝날 때까지 미룬다)
    const j = evoRun.findIndex(e => e.w === w && e.t0 === t0); if (j < 0) return;
    evoRun.splice(j, 1); renderWeapons();
  }, Math.max(D, D * EVO_HIT + P) * 1000 + 60);
}
// 무기 칸 안의 연출 요소 (진행 중이면). 어둠, 가운데에 모이는 빛, 빨려 드는 옛 아이콘과 튀어나오는 새 아이콘, 찍히는 ★, 테두리를 도는 빛
function evoSlotHtml(w, now) {
  const e = evoRun.find(o => o.w === w), u = e ? (now - e.t0) / 1000 : 0;
  if (!e || u >= e.D) return null;
  return { style: `;--ed:${e.D}s;--ea:-${u.toFixed(3)}s`,
    html: `<i class="evdk"></i><i class="evcg"></i><span class="evic"><span class="evo-a">${icon(w.type, 26)}</span>${icon(w.type, 26, true)}</span>` +
      `<b class="lv"><i class="evst">★</i>+${w.lv}</b>`,
    ring: `<svg class="evol" aria-hidden="true"><path class="l1" d="${e.path}" pathLength="100" fill="none"/><path class="l2" d="${e.path}" pathLength="100" fill="none"/><path class="l3" d="${e.path}" pathLength="100" fill="none"/></svg>` };
}
// 진화의 빛기둥: 쿵 하는 순간 그 레인의 밑에서 위까지 빠르게 솟고, 밑동부터 떨어져 위로 흩어지며 사라진다 (실제 시간 기준)
function drawEvoPillars(H) {
  const S = C.S, now = performance.now(), rm = RM.matches;
  for (const e of evoRun) {
    const k = S.slots.indexOf(e.w); if (k < 0) continue;
    const p = ((now - e.t0) / 1000 - e.D * EVO_HIT) / e.P;
    if (p < 0 || p >= 1) continue;
    const col = C.WEAPONS[e.w.type].color, hot = VX.hot(col), x = (k + 0.5) * C.LW, sd = e.t0 % 97;
    const len = H * 1.25, top = H - len * (rm ? 1 : VX.ease(p / 0.24, 3));                              // 0.18초 만에 위까지
    const bot = H + len * 0.25 - (rm ? 0 : H * 0.75 * Math.pow(Math.max(0, (p - 0.3) / 0.7), 1.6));   // 끝에는 밑동이 떨어져 위로
    const a = rm ? Math.sin(p * Math.PI) : p < 0.1 ? 0.6 + 4 * p : VX.fade((p - 0.1) / 0.9);
    const wb = Math.sin(now / 53 + sd) * 1.6, nar = 1 - 0.45 * p;
    VX.add();
    VX.pillar(x + wb, top, bot, C.LW * 0.56 * nar, col, (VX.light ? 0.5 : 0.42) * a);   // 넓은 겉빛 (살짝 흔들린다)
    VX.pillar(x - wb * 0.7, top + 14, bot, C.LW * 0.2 * nar, col, 0.85 * a);
    VX.pillar(x, top + 30, bot - 8, 4 * nar, '#ffffff', 0.9 * a);                         // 속빛 (밝은 테마에서도 흰색: 둘레의 색 속에서 빛나 보인다)
    VX.glow(x, H - 4, C.LW * (0.85 - 0.3 * p), col, 0.85 * a * (1 - p), 22);            // 기지 쪽 밑동
    if (!rm) {                               // 기둥을 타고 오르는 빛 알갱이: 옅은 꼬리를 끌며 저마다 다른 빠르기로 (상태 없이 시간으로 계산)
      const mc = VX.light ? '#ffffff' : hot;
      ctx.strokeStyle = VX.light ? col : hot; ctx.fillStyle = mc; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        for (let j = 0; j < 9; j++) {
          const h1 = hash(sd + j * 7.3), h2 = hash(sd * 3.1 + j * 1.7), q = p * (0.65 + 0.7 * h1) + 0.15 * h2;
          const y = H * (0.92 - q), sw = Math.sin(now / 170 + j * 2.1), xx = x + (h2 - 0.5) * C.LW * 0.6 + sw * 3, r = (1 + 1 * h1) * (1 - 0.5 * p);
          if (y < -10) continue;
          if (pass) { ctx.moveTo(xx + r, y); ctx.arc(xx, y, r, 0, TAU); } else { ctx.moveTo(xx, y); ctx.lineTo(xx - sw * 1.5, y + 8 + 18 * h1 * (1 - p)); }
        }
        ctx.globalAlpha = a * (pass ? 0.95 : 0.3); if (pass) ctx.fill(); else ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.lineCap = 'butt';
    }
    VX.norm();
  }
}
// 진화의 쿵: 전장이 아주 약하게 흔들린다 (0.24초)
function evoShake() {
  if (RM.matches) return;
  const now = performance.now();
  for (const e of evoRun) {
    const T = (now - e.t0) / 1000 - e.D * EVO_HIT;
    if (T >= 0 && T < 0.24) { const q = 1 - T / 0.24; ctx.translate(Math.sin(T * 120) * 2.4 * q, Math.cos(T * 97) * 1.6 * q); }
  }
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
      <span class="st">공격력 ${fmt(st.dmg)} · 간격 ${st.cd.toFixed(2)}초 · 치명 ${Math.round(st.crit * 100)}%${st.capOn ? ` · ${st.cap < C.CAP_NONE ? '최대 ' + st.cap + '명' : '제한 없음'}` : ''}</span></div>
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
/* ---------- 스킬 그림 ---------- */
// 파츠 그림과 같은 화풍(24x24, 선 굵기 1.8). 같은 줄의 세 노드는 같은 소재가 발전한다. 색은 CSS 가 정한다(currentColor)
const SOFT = 'fill="currentColor" fill-opacity=".22"';
const SKICON = {
  // 블래스터: 포신 / 빛살 / 포탑
  gatling: `<path d="M7 3v12M12 3v12M17 3v12M5 8.5h14"/><path d="M5 15h14v5.5H5z" ${SOFT}/>`,
  warm: `<path d="M7 14v3M12 14v3M17 14v3"/><path d="M5 17h14v4.5H5z" ${SOFT}/><path d="M7 10.5c-2-2 2-4.5 0-7.5M12 10.5c-2-2 2-4.5 0-7.5M17 10.5c-2-2 2-4.5 0-7.5"/>`,
  spray: `<path d="M5 17h14v4.5H5z" ${SOFT}/><path d="M7 14v3M12 14v3M17 14v3"/><path d="M6.9 11.4l-.5-2.6M12 11.4V8.7M17.1 11.4l.5-2.6M5.9 6.1l-.5-2.7M12 6V3.2M18.1 6.1l.5-2.7"/>`,
  lightb: `<path d="M12 1.5l2.4 10.5L12 22.5 9.6 12z" ${SOFT}/><path d="M5 5.5v5M19 13.5v5"/>`,
  accel: `<rect x="5.5" y="11" width="13" height="7" rx="1" ${SOFT}/><path d="M12 22.5V2.5M8 6.5l4-4 4 4"/>`,
  gigab: `<circle cx="12" cy="9.5" r="7.8" ${SOFT}/><path d="M7 20.5v2M12 20v2.5M17 20.5v2"/>`,
  turret: `<circle cx="12" cy="14" r="5.5" ${SOFT}/><path d="M12 8.5V2.5M5.5 22h13"/><circle cx="12" cy="14" r="1.6" ${FILL}/>`,
  turboost: `<circle cx="8" cy="14.5" r="4.8" ${SOFT}/><path d="M8 9.7V4M2.5 22h11"/><path d="M15.5 9.5l3-3 3 3M15.5 15.5l3-3 3 3"/>`,
  twinturr: `<circle cx="6.5" cy="14.5" r="4" ${SOFT}/><circle cx="17.5" cy="14.5" r="4" ${SOFT}/><path d="M6.5 10.5V4.5M17.5 10.5V4.5M2 22h20"/>`,
  // 산탄포: 큰 탄 / 불꽃 / 지뢰
  slugb: `<path d="M7 21.5V10a5 5 0 0 1 10 0v11.5z" ${SOFT}/><path d="M7 16.5h10"/>`,
  heavyb: `<path d="M8 22.5V16a4 4 0 0 1 8 0v6.5z" ${SOFT}/><ellipse cx="12" cy="7" rx="8.5" ry="2.6"/><path d="M5 2.5l.7 1.5 1.5.7-1.5.7L5 6.9l-.7-1.5-1.5-.7 1.5-.7zM18.5 1.5l.7 1.5 1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7z" ${FILL}/>`,
  twinslug: `<path d="M3.5 21.5V11a3.5 3.5 0 0 1 7 0v10.5zM13.5 21.5V11a3.5 3.5 0 0 1 7 0v10.5z" ${SOFT}/><path d="M3.5 17h7M13.5 17h7"/>`,
  flameb: `<path d="M12 22L4 10.5c0-2.5 2-3.5 2-6 1.5 1 2.5 2.5 3 4 .5-2 1.5-4 3-6.5 1.5 2.5 2.5 4.5 3 6.5 .5-1.5 1.5-3 3-4 0 2.5 2 3.5 2 6z" ${SOFT}/>`,
  sea: `<path d="M3 18.5c0-3.5 2.5-4 3-8 2 1.5 3 3.5 3 5.5 .5-3 1.5-5.5 3-8.5 1.5 3 2.5 5.5 3 8.5 0-2 1-4 3-5.5 .5 4 3 4.5 3 8z" ${SOFT}/><path d="M2 22h20"/>`,
  dragon: `<path d="M4.5 22.5c0-4.5 1-7.5 3-9.5L7 9.5 2.5 6l5.5 1.5 4-1.5 9-3.5-4.5 5.5-1.5 1 5 .5-5 3.5c-2 1.5-3.5 3.5-4 8" ${SOFT}/><circle cx="10.6" cy="8.9" r="1.1" ${FILL}/><path d="M18 10.6c1.8.4 3.2 1.4 4 2.6"/>`,
  mineb: `<path d="M5 19.5a7 7 0 0 1 14 0z" ${SOFT}/><path d="M2 19.5h20M12 12.5V8.5M9 8.5h6"/><circle cx="12" cy="16.2" r="1.5" ${FILL}/>`,
  quickm: `<path d="M2.5 21a4 4 0 0 1 8 0zM13.5 21a4 4 0 0 1 8 0zM8 10.5a4 4 0 0 1 8 0z" ${SOFT}/><path d="M6.5 17v-2.5M17.5 17v-2.5M12 6.5V4"/>`,
  chainm: `<path d="M6 21.5a6 6 0 0 1 12 0z" ${SOFT}/><path d="M2 21.5h20M9 13C8.5 9.5 7 8 5 7.5M15 13c.5-3.5 2-5 4-5.5"/><circle cx="3.5" cy="6.5" r="2" ${FILL}/><circle cx="20.5" cy="6.5" r="2" ${FILL}/>`,
  // 레이저: 빔 / 프리즘 / 달궈진 선
  holdb: `<rect x="9" y="2" width="6" height="15" rx="1" ${SOFT}/><path d="M7 22h10l-2-5H9z"/>`,
  focus: `<ellipse cx="12" cy="14.5" rx="7.5" ry="2.6" ${SOFT}/><path d="M4.5 14.5L12 3l7.5 11.5M9 17.5v5M15 17.5v5"/><circle cx="12" cy="3.2" r="1.9" ${FILL}/>`,
  always: `<path d="M12 1.5v21"/><path d="M12 12c-1.8-2.7-3.6-4-5.5-4a4 4 0 0 0 0 8c1.9 0 3.7-1.3 5.5-4zm0 0c1.8 2.7 3.6 4 5.5 4a4 4 0 0 0 0-8c-1.9 0-3.7 1.3-5.5 4z"/>`,
  prismb: `<path d="M12 9l6 9H6z" ${SOFT}/><path d="M12 22.5V18M9 13.5L3 4M15 13.5L21 4"/>`,
  spectrum: `<path d="M12 11l5 8H7z" ${SOFT}/><path d="M12 22.5V19M9.5 15L3 7M12 11V2M14.5 15L21 7"/>`,
  rainbow: `<path d="M12 16l3.5 6h-7z" ${FILL}/><path d="M12 16V2M12 16L5.5 3.5M12 16l6.5-12.5M12 16L1.5 9M12 16l10.5-7"/>`,
  meltb: `<rect x="2.5" y="15.5" width="19" height="4.5" rx="2.2" ${SOFT}/><path d="M6 11.5v-2M12 11.5v-4M18 11.5v-2"/>`,
  afterh: `<rect x="2.5" y="17.5" width="19" height="4.5" rx="2.2" ${SOFT}/><path d="M6 13.5c-2-2 2-4.5 0-7M12 13.5c-2-2.5 2-6 0-9.5M18 13.5c-2-2 2-4.5 0-7"/>`,
  vanish: `<path d="M11 5.5H4.5v13H11"/><path d="M13.5 7.5h2.5V10h-2.5zM13 14h3v3h-3zM18.5 4h2v2h-2zM18.5 11h2v2h-2zM18.5 18h2v2h-2z" ${FILL}/>`,
  // 펄스: 별 / 구체 / 역장
  novab: `<path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6z" ${SOFT}/><path d="M5 5l2 2M19 5l-2 2M5 19l2-2M19 19l-2-2"/>`,
  afterg: `<circle cx="12" cy="12" r="9.8" stroke-dasharray="4.2 3"/><path d="M12 6.5l1.6 3.9 3.9 1.6-3.9 1.6-1.6 3.9-1.6-3.9-3.9-1.6 3.9-1.6z" ${SOFT}/>`,
  twinstar: `<path d="M8.5 7.5l1.8 5.2 5.2 1.8-5.2 1.8-1.8 5.2-1.8-5.2-5.2-1.8 5.2-1.8zM18 2l1.2 3.3 3.3 1.2-3.3 1.2L18 11l-1.2-3.3-3.3-1.2 3.3-1.2z" ${SOFT}/>`,
  orbb: `<circle cx="12" cy="12" r="2.2" ${FILL}/><circle cx="12" cy="12" r="8.5" stroke-dasharray="2.5 3"/><circle cx="18" cy="6" r="3" ${FILL}/>`,
  orbit: `<circle cx="12" cy="12" r="2" ${FILL}/><circle cx="12" cy="12" r="5.2" stroke-dasharray="2 2.6"/><circle cx="12" cy="12" r="10"/><circle cx="19" cy="5" r="3.5" ${FILL}/>`,
  orbchain: `<circle cx="4.5" cy="18.5" r="3" ${FILL}/><circle cx="19.5" cy="5.5" r="3" ${FILL}/><path d="M7.5 16l5.5-1.5-3-5 6.5-2"/>`,
  fieldb: `<path d="M2 21.5a10 15 0 0 1 20 0z" ${SOFT}/><path d="M3.5 15h5M6.5 12.5L9 15l-2.5 2.5M20.5 15h-5M17.5 12.5L15 15l2.5 2.5"/><circle cx="12" cy="15" r="1.8" ${FILL}/>`,
  weaken: `<path d="M2 21.5a10 15 0 0 1 20 0z"/><path d="M7.5 12h9v9h-9z"/><path d="M12.5 12l-1 4-2.5 3.5M11.5 16l3.5 2.5"/>`,
  counter: `<path d="M12 1.5V8M9 5.5l3 3 3-3"/><path d="M6.5 21.5a5.5 5.5 0 0 1 11 0M2 21.5a10 10 0 0 1 20 0"/>`,
  // 박격포: 탄두와 버섯구름 / 줄지어 떨어지는 폭탄 / 미사일
  nukeb: `<path d="M12 1.8c3 2.3 4.4 5.6 4.4 9.6v5.3H7.6v-5.3c0-4 1.4-7.3 4.4-9.6z" ${SOFT}/><path d="M7.6 16.7L5 21.5h14l-2.6-4.8M12 7.5v4.5"/>`,
  shockw: `<path d="M5.5 10.5a6.5 5.2 0 0 1 13 0c0 1.7-1.3 2.7-3.1 2.7H8.6c-1.8 0-3.1-1-3.1-2.7z" ${SOFT}/><path d="M10.3 13.2v5M13.7 13.2v5M1.5 21.5c2.7-2 6-3.1 10.5-3.1s7.8 1.1 10.5 3.1"/>`,
  chainuke: `<path d="M1.8 13.3a4.4 3.8 0 0 1 8.8 0c0 1.2-.9 2-2.2 2H4c-1.3 0-2.2-.8-2.2-2zM11.6 8.8a5.6 4.7 0 0 1 11.2 0c0 1.5-1.1 2.4-2.7 2.4h-5.8c-1.6 0-2.7-.9-2.7-2.4z" ${SOFT}/><path d="M5.2 15.3v5.7M7.2 15.3v5.7M15.8 11.2v9.8M18.6 11.2v9.8M1 21.5h22"/>`,
  carpet: `<circle cx="12" cy="3.6" r="2" ${SOFT}/><circle cx="12" cy="10" r="2.3" ${SOFT}/><path d="M12 13.8l1.5 3.3 3.3 1-3.3 1L12 22.5l-1.5-3.4-3.3-1 3.3-1z" ${FILL}/>`,
  bombbay: `<path d="M3 2.5h18v4.5H3z" ${SOFT}/><path d="M6.5 7l-2 3.2M17.5 7l2 3.2"/><circle cx="9" cy="13.2" r="2" ${FILL}/><circle cx="15" cy="12.4" r="2" ${FILL}/><circle cx="11.8" cy="19.6" r="2.2" ${FILL}/>`,
  airstrike: `<path d="M12 1.8l1.4 4.6 7.6 2.7v2l-7.4-1.1-.6 3.2 2.4 1.5v1.4L12 15.3l-3.4.8v-1.4l2.4-1.5-.6-3.2L3 11.1v-2l7.6-2.7z" ${SOFT}/><circle cx="3.2" cy="20.6" r="1.6" ${FILL}/><circle cx="8" cy="21" r="1.6" ${FILL}/><circle cx="12.8" cy="20.4" r="1.6" ${FILL}/><circle cx="17.4" cy="21" r="1.6" ${FILL}/><circle cx="21.2" cy="20.5" r="1.4" ${FILL}/>`,
  missile: `<path d="M12 1.5l3 5.2v8.3H9V6.7z" ${SOFT}/><path d="M9 11.2L6 15v2.3l3-1.4M15 11.2l3 3.8v2.3l-3-1.4M12 15v2.2c0 2-1.4 3.3-3.6 4.8"/>`,
  mirv: `<path d="M9.8 22.5v-6.2L12 12l2.2 4.3v6.2z" ${SOFT}/><path d="M12 12L5.8 5.6M12 12l6.2-6.4M12 12V4.6"/><circle cx="5" cy="4.6" r="1.7" ${FILL}/><circle cx="19" cy="4.6" r="1.7" ${FILL}/><circle cx="12" cy="2.9" r="1.7" ${FILL}/>`,
  twinm: `<path d="M4 20.5v-9.8l2.6-5.5 2.6 5.5v9.8zM14.8 20.5v-9.8l2.6-5.5 2.6 5.5v9.8z" ${SOFT}/><path d="M4 16.5l-2 3.2M9.2 16.5l1.6 3M14.8 16.5l-1.6 3M20 16.5l2 3.2"/>`,
  // 전격기: 내려꽂히는 번개 / 적 사이의 줄 / 번개 구체
  thunderb: `<path d="M13.5 1.5L8 11h4.2l-2.7 8.5 7.5-10.7h-4.4l2.4-7.3z" ${SOFT}/><path d="M3 22h18M6 19.5l-1.8-1.6M18 19.5l1.8-1.6"/>`,
  efield: `<ellipse cx="12" cy="18.5" rx="9.5" ry="3.6" ${SOFT}/><path d="M7.5 17l1.7-3.5 1.6 2 1.7-4M13.5 17l1.6-3 1.4 1.6 1.6-3.2"/><path d="M12 1.5L9 7h3l-1.5 4"/>`,
  cloud: `<path d="M5.5 12.5a3.7 3.7 0 0 1 .6-7.3 5 5 0 0 1 9.4-.6 4 4 0 0 1 3 7.9z" ${SOFT}/><path d="M11 12.5l-2.4 4.5h3.2l-1.8 5M16.5 12.5l-1.2 2.6"/>`,
  arcb: `<circle cx="4.5" cy="17.5" r="2.6" ${FILL}/><circle cx="19.5" cy="6.5" r="2.6" ${FILL}/><path d="M7 15.6l3.6-.6-1.4-3.6 4.6-.4-1-3.4 4.4-.8"/>`,
  longarc: `<path d="M3.5 18.5l5-2-1.5-4 5.5-1-1.5-4 7.5-3" stroke-width="5.5" stroke-opacity=".22"/><path d="M3.5 18.5l5-2-1.5-4 5.5-1-1.5-4 7.5-3"/><circle cx="3.5" cy="18.5" r="2" ${FILL}/><circle cx="18.5" cy="4.5" r="2" ${FILL}/>`,
  hvarc: `<path d="M3 19l5.5-2.2-1.6-4.2 6-1.1-1.6-4.3L19 4.5" stroke-width="3.2"/><path d="M15.5 14.5l2.5 1M17 11.5l3.5-.5M12.5 17.5l.5 3M8 20.5l-1.5 2"/>`,
  ballb: `<circle cx="13.5" cy="10.5" r="7.5" ${SOFT}/><path d="M13.5 10.5l-3.5-3M13.5 10.5l4-2M13.5 10.5l1 4.5M2 18.5l4-2.5M4.5 22l3.5-3"/><circle cx="13.5" cy="10.5" r="2" ${FILL}/>`,
  bigball: `<circle cx="12" cy="12" r="10" ${SOFT}/><path d="M12 12l-4.5-4M12 12l5.5-2.5M12 12l1.5 6M12 12l-5.5 3"/><circle cx="12" cy="12" r="2.4" ${FILL}/>`,
  twinball: `<circle cx="5.5" cy="7" r="4" ${SOFT}/><circle cx="18.5" cy="7" r="4" ${SOFT}/><path d="M12 22.5l-4.5-11M12 22.5l4.5-11M18.5 1v2M22.5 7h-1.8M15.5 3.8L14.3 2.6M21.3 3.8l1.2-1.2"/>`,
  // 저격포: 넘어가는 탄 / 표식 / 점사 탄
  overkill: `<circle cx="6" cy="17" r="3.4" ${SOFT}/><path d="M2.5 13.5l7 7M9.5 13.5l-7 7"/><path d="M9.5 14L19 5.5M15 5h4.5v4.5"/>`,
  relay: `<path d="M3 20l5-5M9 14l5-5M15 8l5-5" stroke-width="1.8"/><path d="M8 15.5V20H3.5M14 9.5V14H9.5M20 3.5V8h-4.5"/>`,
  streak: `<circle cx="12" cy="8" r="5.2" ${SOFT}/><path d="M12 1v3.6M12 11.4V15M5 8h3.6M15.4 8H19"/><path d="M2.5 18.5l3 3M5.5 18.5l-3 3M10.5 18.5l3 3M13.5 18.5l-3 3M18.5 18.5l3 3M21.5 18.5l-3 3"/>`,
  laserm: `<circle cx="14" cy="9" r="6" stroke-dasharray="6.5 3"/><circle cx="14" cy="9" r="1.8" ${FILL}/><path d="M3 22l9.2-11.2"/>`,
  markxfer: `<path d="M2.5 16.5l4 4M6.5 16.5l-4 4"/><path d="M5.5 14C7 9.6 9.6 7.6 12.6 7.4" stroke-dasharray="2 2.2"/><circle cx="17.5" cy="7.5" r="4.4" stroke-dasharray="5.2 1.7"/><circle cx="17.5" cy="7.5" r="1.5" ${FILL}/>`,
  crack: `<circle cx="10.5" cy="13.5" r="8" ${SOFT}/><path d="M10.5 13.5L8 9.6l.8-3.4M10.5 13.5l4.2 1.2 1.2 3.6M10.5 13.5l-.8 4.4-3 1.8M8 9.6L4.6 9"/><path d="M18.6 3.2l3 1.1-1.9 2.2zM15.4 1.6l1.9.5-1.1 1.4z" ${FILL}/>`,
  burst: `<path d="M12 22.5v-6" stroke-width="2.6"/><path d="M10.2 14v-3.4l1.8-2.4 1.8 2.4V14z" ${SOFT}/><path d="M10.2 7v-3.4L12 1.2l1.8 2.4V7z" ${SOFT}/>`,
  recoil: `<path d="M12 22.5V9" stroke-width="2.6"/><path d="M5.5 21l3-1.5-3-1.5 3-1.5-3-1.5 3-1.5M18.5 21l-3-1.5 3-1.5-3-1.5 3-1.5-3-1.5"/><path d="M9.2 5.2L12 2.4l2.8 2.8"/>`,
  burst3: `<path d="M12 22.8v-2.6" stroke-width="2.6"/><path d="M10.3 18.2v-2.5l1.7-2.1 1.7 2.1v2.5zM10.3 11.8V9.3l1.7-2.1 1.7 2.1v2.5zM10.3 5.4V2.9L12 .8l1.7 2.1v2.5z" ${SOFT}/><path d="M7 21.8l2.2-1M17 21.8l-2.2-1"/>`,
  // 산성 분사기: 녹는 방울 / 비 / 자국
  dsvb: `<path d="M12 2.5c3 4 5 6.6 5 9.3a5 5 0 0 1-10 0c0-2.7 2-5.3 5-9.3z" ${SOFT}/><path d="M3 20.5c2.5-1.6 5.5-1.6 9 0s6.5 1.6 9 0"/>`,
  bigdsv: `<circle cx="12" cy="12" r="4.5" ${SOFT}/><path d="M12 1.5v3.5M12 19v3.5M1.5 12H5M19 12h3.5M4.6 4.6l2.4 2.4M17 17l2.4 2.4M4.6 19.4L7 17M17 7l2.4-2.4"/>`,
  chaindsv: `<ellipse cx="6" cy="18.5" rx="4.5" ry="2.2" ${SOFT}/><ellipse cx="18" cy="18.5" rx="4.5" ry="2.2" ${SOFT}/><path d="M6 14.5c0-3.5 2.5-6 6-6s6 2.5 6 6M12 8.5V3"/>`,
  rainb: `<path d="M6 10.5a3.5 3.5 0 0 1 .5-7 4.8 4.8 0 0 1 9-.5 3.8 3.8 0 0 1 2.5 7.5z" ${SOFT}/><path d="M7.5 14l-1 2.5M12 14l-1 2.5M16.5 14l-1 2.5M9.5 19l-1 2.5M14 19l-1 2.5"/>`,
  monsoon: `<path d="M6 8.5a3.5 3.5 0 0 1 .5-7 4.8 4.8 0 0 1 9-.5 3.8 3.8 0 0 1 2.5 7.5z" ${SOFT}/><path d="M7.5 11.5l-2 6M12 11.5l-2.5 8M16.5 11.5l-2 6"/><path d="M3 22.5h18"/>`,
  downpour: `<path d="M4.5 2.5v9M8.5 2.5v11M15.5 2.5v11M19.5 2.5v9"/><ellipse cx="6.5" cy="19" rx="4.5" ry="2" ${SOFT}/><ellipse cx="17.5" cy="19" rx="4.5" ry="2" ${SOFT}/>`,
  slimeb: `<path d="M8 19.5a2.6 2 0 1 0 0 .01zM13 13a2.4 1.8 0 1 0 0 .01zM17 6.5a2.2 1.7 0 1 0 0 .01z" ${SOFT}/><circle cx="20" cy="3" r="1.8" ${FILL}/>`,
  sticky: `<path d="M3 4.5h18" stroke-width="2.4"/><path d="M6 4.5v6M11 4.5v10M16 4.5v7.5"/><circle cx="6" cy="12" r="1.6" ${FILL}/><circle cx="11" cy="16.2" r="1.9" ${FILL}/><circle cx="16" cy="13.6" r="1.6" ${FILL}/>`,
  rot: `<ellipse cx="12" cy="19" rx="9" ry="3" ${SOFT}/><path d="M7.5 12.5a4.5 4.5 0 0 1 9 0v2.5h-9z"/><path d="M10 12.2h.01M14 12.2h.01" stroke-width="2.4"/>`,
};
const skIcon = (n) => `<svg viewBox="0 0 24 24" ${SVG_ATTR}>${SKICON[n.id] || ''}</svg>`;
const SK_LOCK = `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>`;
const SK_KIND = { root: '기본', up: '강화', cap: '최종' };
function skFirst(w) {   // 열 때 고를 노드: 지금 찍을 수 있는 첫 노드 (없으면 첫 칸)
  for (let l = 0; l < 3; l++) for (let t = 0; t < 3; t++) if (C.skillInfo(w, l, t).can) return { l, t };
  return { l: 0, t: 0 };
}
// 창을 열 때 고를 노드: 이 무기에서 마지막에 찍은 노드(다 찍어 넘어간 다음 단계 포함). 찍은 적이 없으면 찍을 수 있는 첫 노드
function skOpenSel(w) {
  const m = skMem.get(w);
  return m && C.skillPoints(w).spent > 0 ? { l: m.l, t: m.t } : skFirst(w);
}
function skillHtml() {
  const w = C.S.slots[skK], d = C.WEAPONS[w.type], P = C.skillPoints(w), tree = C.SKILLS[w.type];
  if (!skSel) skSel = skOpenSel(w);
  const cols = tree.map((line, l) => {
    const tiles = [2, 1, 0].map((t) => {
      const i = C.skillInfo(w, l, t), nm = i.name;
      const cls = 'skt ' + (t === 2 ? 'cap' : '') + (i.locked ? ' lock' : '') + (i.rank >= i.max ? ' full' : i.rank > 0 ? ' has' : '') + (i.can ? ' can' : '') +
        (skSel.l === l && skSel.t === t ? ' sel' : '') + (skGot && skGot.l === l && skGot.t === t ? ' got' : '');
      const conn = t > 0 ? `<i class="skc${C.skillInfo(w, l, t - 1).rank >= C.skillInfo(w, l, t - 1).max ? ' on' : ''}"></i>` : '';
      return `<button type="button" class="${cls}" data-sk="${l}:${t}" aria-label="${nm} ${i.rank}/${i.max}${i.locked ? ' 잠김' : ''}"><span class="skic">${skIcon(i.node)}</span><span class="skn">${nm}</span>${i.locked ? `<span class="skl">${SK_LOCK}</span>` : `<b class="skr">${i.rank}/${i.max}</b>`}</button>${conn}`;
    });
    return `<div class="skcol"><div class="sktiles">${tiles.join('')}</div><b class="sklab">${line.name}</b></div>`;
  }).join('');
  const i = C.skillInfo(w, skSel.l, skSel.t), cur = C.skillText(w, skSel.l, skSel.t, i.rank), nxt = i.rank < i.max ? C.skillText(w, skSel.l, skSel.t, i.rank + 1) : '';
  const prev = skSel.t > 0 ? C.skillInfo(w, skSel.l, skSel.t - 1) : null;
  let body;
  if (i.locked) body = `<span class="skreq">${prev.name} ${prev.max}/${prev.max}을(를) 먼저 찍어야 합니다. (지금 ${prev.rank}/${prev.max})</span>` + (nxt ? `<span class="skfx dim">${nxt}</span>` : '');
  else if (i.rank >= i.max) body = `<span class="skfx">${cur}</span><span class="skreq">최대 랭크입니다.</span>`;
  else body = `<span class="skfx${i.rank ? '' : ' dim'}">${i.rank ? cur : '아직 찍지 않음'}</span><span class="skarr">▼</span><span class="skfx nx">${nxt}</span>`;
  const noPt = !i.can && !i.locked && i.rank < i.max;   // 포인트가 없을 때는 버튼 글로 알린다 (설명 칸 높이를 고정해 두었으므로 줄을 늘리지 않는다)
  return `<div class="modal skm" style="--wc:${d.color}"><div class="wm-head"><div><h2>스킬</h2><span class="st"><b style="color:${d.color}">${d.name} ${lvTxt(w)}</b></span></div>
      <span class="skpts${P.left > 0 ? ' has' : ''}">남은 포인트 <b>${P.left}</b></span></div>
    <div class="skgrid">${cols}</div>
    <div class="skdet"><div class="skhd"><span class="skpic${i.locked ? ' lock' : i.rank > 0 ? ' on' : ''}">${skIcon(i.node)}</span><b>${i.name}</b><span class="skk">${SK_KIND[i.node.t]}</span><span class="skrk">${i.rank}/${i.max}</span></div>${body}</div>
    <div class="d-acts two"><button type="button" class="btn primary${i.can ? '' : ' off'}" data-act="skUp"${i.can ? '' : ' disabled'}>${noPt ? '포인트 없음' : '찍기'}</button><button type="button" class="btn" data-act="skClose">닫기</button></div></div>`;
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
    <div class="wm-sec">전장 <b class="tnow">${fmtTime(S.t)}${C.CFG.waves ? ' · 웨이브 ' + S.wn : ''}</b></div>
    <div class="tgrid">
      <button type="button" class="btn" data-act="testT1">시간 +1분</button>
      <button type="button" class="btn" data-act="testT5">시간 +5분</button>
      <button type="button" class="btn${off(!!S.pendingBoss)}" data-act="testBoss">보스 부르기</button>
      <button type="button" class="btn" data-act="testClear">적 지우기</button>
      <button type="button" class="btn${off(!C.CFG.waves)}" data-act="testWave">다음 웨이브</button>
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
    case 'testWave': ok = T.nextWave(); m = '다음 웨이브'; break;
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
const ROLE_LINE = { blaster: '정면 단일 연사', shotgun: '근거리 3레인 산탄', laser: '일직선 관통', pulse: '주변 범위 타격', mortar: '폭발탄 범위 공격', tesla: '적 사이 연쇄 번개', rail: '최강 적 저격', acid: '웅덩이 지속 약화' };
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
  if (kind === 'cor') { const ac = L ? LIGHT_WC.acid : C.WEAPONS.acid.color; body += `<path d="M${x - r} ${y + 1}q${r * 0.5} -2.5 ${r} 0t${r} 0V${y + r}H${x - r}z" fill="${ac}" fill-opacity=".55"/><path d="M${x - 4.5} ${y + r}h3l-.6 5a1.4 1.4 0 0 1 -1.8 0zM${x + 4} ${y + r}h2.6l-.5 3.4a1.2 1.2 0 0 1 -1.6 0z" fill="${ac}"/><circle cx="${x + 5.3}" cy="${y + r + 7}" r="1.1" fill="${ac}"/>`; }
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
    case 'charge': g = `<polygon points="${-r},${-r * 0.8} 0,${-r * 0.3} ${r},${-r * 0.8} 0,${r}" ${a}/><path d="M${-r * 0.36} ${-r * 0.12}L0 ${r * 0.16}L${r * 0.36} ${-r * 0.12}M${-r * 0.26} ${r * 0.24}L0 ${r * 0.46}L${r * 0.26} ${r * 0.24}" ${b}/>`; break;
    case 'clock': g = `<circle r="${r}" ${a}/>` + [0, 1, 2, 3].map(k => { const an = k * Math.PI / 2, c = Math.cos(an), s_ = Math.sin(an); return `<path d="M${(c * r * 0.72).toFixed(1)} ${(s_ * r * 0.72).toFixed(1)}L${(c * r * 0.9).toFixed(1)} ${(s_ * r * 0.9).toFixed(1)}" ${b}/>`; }).join('') + `<path d="M0 0L0 ${-r * 0.62}M0 0L${r * 0.4} ${r * 0.14}" ${b} stroke-linecap="round"/>`; break;
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
  charge: ['천천히 내려오다 멈춰서 다른 레인을 깜빡여 예고하고, 그 레인으로 옮겨 가며 빠르게 돌진합니다.', '예고된 레인으로 무기를 옮겨 모으세요.'],
  clock: ['살아 있는 동안 웨이브 시간이 빨리 흘러 다음 웨이브와 보스가 일찍 옵니다.', '가장 먼저 쓰러뜨리세요.'],
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
  const wps = `<div class="hgrid2">${C.WEAPON_IDS.map(t => `<div class="hw">${icon(t, 26)}<span><b>${C.WEAPONS[t].name}</b><small>${ROLE_LINE[t] || C.WEAPONS[t].desc.split('.')[0].slice(0, 10)}</small></span></div>`).join('')}</div>
    <p class="hnote">범위 공격은 한 번에 때리는 적 수에 한도가 있고, 기지에 가까운 적부터 맞습니다. 한도는 무기 창에 나옵니다.</p>`;
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
  const stat = `<div class="hstat">${[['burn', '화상'], ['slow', '둔화'], ['ice', '빙결'], ['stun', '기절'], ['vuln', '취약'], ['cor', '부식']].map(([k, n]) => `<span class="hn"><span class="hv">${statusSvg(k, L)}</span><span class="hcap">${n}</span></span>`).join('')}</div>`;
  const bosses = `<div class="hbl">${C.BOSS_IDS.map(bossCard).join('')}</div>`;
  const waves = `<p class="hnote">적은 ${C.CFG.waveT}초마다 웨이브로 몰려옵니다. 웨이브마다 구성이 다르고(${Object.keys(C.WAVES).filter(v => C.WAVES[v].name).map(v => C.WAVES[v].name).join(', ')}), ${C.CFG.bossWaves}웨이브마다 보스가 나옵니다. 다 못 잡아도 시간이 되면 다음 웨이브가 옵니다.</p>`;
  return `<div class="modal help"><h2>도움말</h2><div class="hscroll">
    ${sec('조작', ctlIntro + ctl)}${sec('무기', wps)}${sec('등급', grades)}${sec('파츠', parts)}${sec('강화와 증강', up)}${sec('진화', evoH)}${sec('용해로', melt + meltNote)}${sec('상태 이상', stat)}${sec('웨이브', waves)}${sec('보스', bosses)}${sec('천칭과 거래', scaleHelp)}</div>
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
  augSel = -1; augRep = -1; augSkip = false; pactSel = -1; pactSkip = false; shownPact = null; pactView = false; bannerEl.classList.remove('show'); evoRun.length = 0; rewLayer.innerHTML = ''; wpickNew = -1; newCell = -1; meltMode = false; meltAllArm = false; meltSet.clear(); upMode = false; eqFx = null;
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
    case 'testMax': case 'testEvo': case 'testSkReset': case 'testAug': case 'testT1': case 'testT5': case 'testBoss': case 'testClear': case 'testWave': testRun(name); return;
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
      closeW();                                 // 무기 창에서 눌렀다면 닫고, 그 무기 칸에서 진화 연출을 한다
      evoStart(w, k);
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
      skMem.set(S.slots[skK], { l: skSel.l, t: skSel.t });   // 다음에 이 무기의 창을 열면 여기부터
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
    case 'charge':                                                             // 아래를 향한 화살촉 (위가 파임)
      ctx.moveTo(x - r, y - r * 0.8); ctx.lineTo(x, y - r * 0.3); ctx.lineTo(x + r, y - r * 0.8); ctx.lineTo(x, y + r); ctx.closePath();
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
// 돌격체가 돌진을 예고하는 동안에는 몸이 떨린다 (예고가 끝나 갈수록 세게)
function drawEnemy(e) {
  if (e.type === 'charge' && e.ch && e.ch.ph === 1) {
    const k = 1 - Math.max(0, e.ch.t) / C.CHG_WARN;
    ctx.save(); ctx.translate(Math.sin(performance.now() / 23) * (0.8 + 2.6 * k), 0); drawEnemy0(e); ctx.restore(); return;
  }
  drawEnemy0(e);
}
// 정예: 같은 모양의 바깥 윤곽을 한 겹 더
function drawElite(e, col) { const r0 = e.r; e.r = r0 * 1.3; enemyPath(e); e.r = r0; ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(col, 0.6); ctx.stroke(); }
// 돌격체의 무늬: 안쪽에 아래를 향한 갈매기표 둘
function drawChargeMark(e, col) {
  const x = e.x, y = e.y, r = e.r;
  ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.beginPath();
  ctx.moveTo(x - r * 0.36, y - r * 0.12); ctx.lineTo(x, y + r * 0.16); ctx.lineTo(x + r * 0.36, y - r * 0.12);
  ctx.moveTo(x - r * 0.26, y + r * 0.24); ctx.lineTo(x, y + r * 0.46); ctx.lineTo(x + r * 0.26, y + r * 0.24); ctx.stroke();
}
// 시계체: 눈금과 두 바늘. 웨이브를 빠르게 하는 동안에는 바늘이 빨리 돌고, 둘레로 시간이 일그러지듯 호가 번져 나간다
function drawClockFace(e, col) {
  const x = e.x, y = e.y, r = e.r, now = performance.now(), on = C.S.clockOn;
  ctx.lineWidth = 2; ctx.strokeStyle = rgba(col, 0.85); ctx.beginPath();
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, q = i % 3 ? 0.8 : 0.68; ctx.moveTo(x + Math.cos(a) * r * q, y + Math.sin(a) * r * q); ctx.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9); }
  ctx.stroke();
  const am = now * (on ? 0.011 : 0.0011) + e.born * 3, ah = am / 12 + 1.3;
  ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.beginPath();
  ctx.lineWidth = 4; ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(ah) * r * 0.44, y - Math.cos(ah) * r * 0.44); ctx.stroke();
  ctx.beginPath(); ctx.lineWidth = 2.6; ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(am) * r * 0.7, y - Math.cos(am) * r * 0.7); ctx.stroke();
  ctx.lineCap = 'butt'; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
  if (on) for (let i = 0; i < 3; i++) {
    const u = (now / 1400 + i / 3) % 1, a0 = hash(e.born + i * 7 + Math.floor(now / 1400 + i / 3)) * 6.28 + u * 1.2;
    ctx.beginPath(); ctx.arc(x, y, r * (1.18 + 0.95 * u), a0, a0 + 1.1 + 1.6 * (1 - u));
    ctx.lineWidth = 0.6 + 2.2 * (1 - u); ctx.strokeStyle = rgba(col, 0.42 * (1 - u) * Math.min(1, u * 6)); ctx.stroke();
  }
}
// 돌격체: 예고하는 레인을 아래로 흐르는 갈매기표와 옅은 띠로 물들이고, 돌진할 때는 지나온 자리에 옅어지는 잔상을 남긴다 (화면용 기록은 적 객체에)
function drawCharge(e, H, now) {
  const c = e.ch, col = ECOL.charge;
  if (c && c.ph === 1) {
    const k = 1 - Math.max(0, c.t) / C.CHG_WARN, L = C.LW, x0 = c.to * L, y0 = Math.max(0, e.y - e.r * 0.4);
    const g = ctx.createLinearGradient(0, y0, 0, H);
    const a = (0.07 + 0.16 * k) * (0.75 + 0.25 * Math.sin(now / 70));
    g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.18, rgba(col, a)); g.addColorStop(1, rgba(col, a * 0.55));
    ctx.fillStyle = g; ctx.fillRect(x0 + 3, y0, L - 6, H - y0);
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; const cx = x0 + L / 2, span = H - y0;
    for (let i = 0; i < 5; i++) {
      const u = ((now / 900) + i / 5) % 1, yy = y0 + 30 + u * (span - 40), al = (0.2 + 0.55 * k) * Math.min(1, u * 5, (1 - u) * 4);
      ctx.strokeStyle = rgba(col, al); ctx.beginPath(); ctx.moveTo(cx - 13, yy - 7); ctx.lineTo(cx, yy + 5); ctx.lineTo(cx + 13, yy - 7); ctx.stroke();
    }
    ctx.setLineDash([6, 6]); ctx.lineDashOffset = -now / 30; ctx.lineWidth = 2; ctx.strokeStyle = rgba(col, 0.35 + 0.4 * k);
    ctx.beginPath(); ctx.moveTo(e.x, e.y + e.r * 0.6); ctx.quadraticCurveTo((e.x + cx) / 2, e.y + e.r * 1.6, cx, e.y + e.r * 2.2); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
  const tr = e._tr || (e._tr = []);
  if (c && c.ph === 2) tr.push({ x: e.x, y: e.y, t: now });
  while (tr.length && now - tr[0].t > 380) tr.shift();
  if (tr.length > 1) {
    for (let i = 0; i < tr.length - 1; i++) {
      const q = tr[i], u = 1 - (now - q.t) / 380, r = e.r * (0.82 + 0.18 * u);
      ctx.beginPath(); ctx.moveTo(q.x - r, q.y - r * 0.8); ctx.lineTo(q.x, q.y - r * 0.3); ctx.lineTo(q.x + r, q.y - r * 0.8); ctx.lineTo(q.x, q.y + r); ctx.closePath();
      ctx.fillStyle = rgba(col, 0.16 * u * u); ctx.fill();
    }
  }
}
function drawEnemy0(e) {
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
  if (drawCorr(e)) { if (e.flash > 0) e.r = r0 * 1.2; enemyPath(e); e.r = r0; }   // 부식 겹: 몸이 산 색으로 차오른다 (경로를 다시 잡고 테두리)
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
  if (e.type === 'charge') drawChargeMark(e, col);
  if (e.type === 'clock') drawClockFace(e, col);
  if (e.elite) drawElite(e, col);
  drawStatus(e, iced);
  if (e.hp < e.maxHp) {
    const w = e.r * 1.8, h = e.boss ? 6 : 4, x = e.x - w / 2, y = e.y - e.r - (e.boss ? 14 : 9);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), h);
  }
}
function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }   // 흔들림이 일정한 가짜 난수
// 부식 겹 (T10e): 산이 몸 아래에서부터 차오르듯 물든다 (높이 = 겹 / 최대 겹, 바뀌면 천천히 따라가고, 수면은 적마다 다르게 일렁인다).
// 겹수만큼 몸 밑에서 방울이 늘어지다 떨어지며 작아진다 (자리, 빠르기, 길이는 적마다 다르게). 다 차면 수면에서 작은 거품이 오른다.
// 그렸으면 true (지금 경로가 바뀌었으니 부르는 쪽이 테두리 경로를 다시 잡는다)
const CORR_WY = new Float32Array(7);   // 수면 높이 (점 7개)
function corrBot(e, dx) {   // 몸 아래쪽 가장자리의 높이 (방울이 매달리는 곳)
  const r = e.r, a = Math.abs(dx);
  switch (e.type) {
    case 'basic': return e.y + r * 0.85;
    case 'runner': return e.y + r - 2 * a;
    case 'swarm': return e.y + r - a;
    default: return e.y + r * 0.9 * Math.sqrt(Math.max(0, 1 - (a / r) * (a / r)));
  }
}
function drawCorr(e) {
  if (!(e.cor > 0) && !(e.cvis > 0)) return false;   // 부식이 없는 적 (대부분): 바로 끝
  const tgt = (e.cor || 0) / C.CORR_MAX;
  e.cvis = e.cvis == null ? tgt : e.cvis + (tgt - e.cvis) * Math.min(1, (VX.dt || 0.016) * 4);   // 화면용: 보이는 높이가 천천히 따라간다
  if (e.cvis < 0.02 && !(e.cor > 0)) { e.cvis = 0; return false; }
  const L = VX.light, col = L ? LIGHT_WC.acid : C.WEAPONS.acid.color, t = VX.t, sd = VX.ui(e).sd * 40, r = e.r, lv = e.cvis;
  const sy = e.y + r - 1.86 * r * lv, x0 = e.x - r - 3, x1 = e.x + r + 3, amp = r * (0.05 + 0.05 * lv), WY = CORR_WY;   // 가득 차도 위쪽에 물결이 조금 보이게 (0.93)
  for (let i = 0; i <= 6; i++) WY[i] = sy + Math.sin(t * (2.2 + hash(sd + i) * 1.6) + sd + i * 1.7) * amp * (0.5 + hash(sd + i * 2.3));
  ctx.save(); enemyPath(e); ctx.clip();
  ctx.beginPath(); ctx.moveTo(x0, e.y + r + 3);
  for (let i = 0; i <= 6; i++) ctx.lineTo(x0 + (x1 - x0) * i / 6, WY[i]);
  ctx.lineTo(x1, e.y + r + 3); ctx.closePath();
  ctx.fillStyle = rgba(col, (L ? 0.3 : 0.26) + 0.3 * lv); ctx.fill();
  ctx.beginPath(); for (let i = 0; i <= 6; i++) { const xx = x0 + (x1 - x0) * i / 6; if (i) ctx.lineTo(xx, WY[i]); else ctx.moveTo(xx, WY[i]); }   // 수면: 밝은 가는 선
  ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(L ? VX.mix(col, 0.35) : VX.mix(col, 0.45), 0.8); ctx.stroke();
  ctx.restore();
  // 늘어지다 떨어지는 방울 (겹수만큼)
  const n = Math.max(1, Math.round(lv * C.CORR_MAX)), sp = e.type === 'runner' || e.type === 'swarm' ? 0.35 : 1.25, w0 = Math.min(2.4, 1 + 0.06 * r), rd = Math.min(r, 22);   // 큰 적(보스)도 방울 크기는 비슷하게
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const h1 = hash(sd + i * 3.7), h2 = hash(sd + i * 5.3), dx = (h1 - 0.5) * r * sp, xx = e.x + dx, y0 = corrBot(e, dx) - 1.5;
    const ph = (t * (0.45 + 0.4 * h2) + hash(sd + i * 1.9)) % 1, L0 = rd * (0.18 + 0.22 * lv) * (0.7 + 0.6 * h2), w = w0 * (0.8 + 0.4 * h1);
    if (ph < 0.7) {                          // 늘어지는 방울
      const len = L0 * (0.25 + 0.75 * ph / 0.7);
      ctx.moveTo(xx - w, y0); ctx.lineTo(xx + w, y0); ctx.lineTo(xx + w * 0.5, y0 + len); ctx.arc(xx, y0 + len, w * 0.75, 0, Math.PI); ctx.closePath();
    } else {                                  // 떨어지며 작아지는 방울
      const q = (ph - 0.7) / 0.3, fy = y0 + L0 + q * rd * 0.7, fr = w * 0.75 * (1 - 0.7 * q);
      ctx.moveTo(xx + fr, fy); ctx.arc(xx, fy, fr, 0, TAU);
    }
  }
  ctx.fillStyle = rgba(L ? VX.mix(col, -0.15) : col, 0.85); ctx.fill();
  if (e.cor >= C.CORR_MAX && lv > 0.9) {    // 다 차면 수면의 작은 거품
    ctx.beginPath();
    for (let i = 0; i < 2; i++) { const ph = (t * (0.9 + 0.5 * hash(sd + i * 7.1)) + hash(sd + i * 4.4)) % 1, bx = e.x + (hash(sd + i * 6.2) - 0.5) * r * 0.9, by = e.y + r * (0.6 - 1.3 * ph), br = 0.8 + 1.6 * ph; ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, TAU); }
    ctx.lineWidth = 1; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.35) : VX.hot(col), 0.7); ctx.stroke();
  }
  return true;
}
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
// 큰 한 방에 쓰러진 적 (T10c, core.js 의 flingFx): 맞은 쪽에서 바깥으로 (탄이면 탄이 가는 쪽으로) 날려 가며 돌고, 작아지며 흐려진다.
// 지나온 길에 옅게 끌린 자국이 남고, 끝 무렵 몸이 조각 셋으로 부서져 흩어진다. 거리, 방향, 도는 빠르기는 적마다 조금씩 다르다 (자리의 해시).
// 용 머리는 그을려 검게 타며 불티가 튀고, 쌍구전은 테두리가 지직거린다. 산성비는 날리지 않고 녹아 가라앉는다 (drawRainMelt)
function drawFling(f, p) {
  const q = 1 - p, sd = f.x * 0.37 + f.y * 0.71, h1 = hash(sd), h2 = hash(sd + 3.1), h3 = hash(sd + 5.7), col = ECOL[f.ty] || ECOL.basic;
  if (f.b === 'rain') { drawRainMelt(f, q, col, h1, h2); return; }
  const ja = (h1 - 0.5) * 0.7, cj = Math.cos(ja), sj = Math.sin(ja), ax = f.ax * cj - f.ay * sj, ay = f.ax * sj + f.ay * cj, ang = Math.atan2(ay, ax);
  const far = (f.b === 'nuke' || f.b === 'air' ? 1.35 : 1) * (34 + f.r * 1.2) * (0.7 + 0.6 * h2), at = (u) => far * VX.ease(u, 3);
  const d = at(q), x = f.x + ax * d, y = f.y + ay * d, k = 1 - 0.4 * VX.ease(q, 2), al = Math.min(1, p * 1.8);
  const burn = f.b === 'dragon', bc = burn ? VX.lerp(col, VX.mix(col, VX.light ? -0.7 : -0.6), Math.min(1, q * 2.2)) : col;
  if (burn && VX.ui(f).n) for (let i = 0; i < 3; i++) {   // 처음 한 번: 불티
    const a = ang + (Math.random() - 0.5) * 1.6, s = 60 + 90 * Math.random();
    VX.spark(f.x, f.y, Math.cos(a) * s, Math.sin(a) * s - 30, 0.5 + 0.4 * Math.random(), 1.2 + Math.random(), i ? '#ffb347' : '#ff7a2e', -40, 3, 2);
  }
  const d0 = at(Math.max(0, q - 0.25));     // 끌린 자국: 지나온 길의 뒤쪽 (한 획)
  if (d - d0 > 2) {
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(f.x + ax * d0, f.y + ay * d0); ctx.lineTo(x - ax * f.r * 0.3 * k, y - ay * f.r * 0.3 * k);
    ctx.lineWidth = f.r * 0.9 * k; ctx.strokeStyle = rgba(burn ? '#ff7a2e' : bc, 0.16 * al); ctx.stroke(); ctx.lineCap = 'butt';
  }
  const spin = (h3 < 0.5 ? -1 : 1) * (1.4 + 2.4 * h3) * VX.ease(q, 2), brk = Math.max(0, (q - 0.45) / 0.55);
  if (brk < 1) {                             // 몸: 돌며 작아지고, 맞은 순간 잠깐 번쩍
    ctx.save(); ctx.translate(x, y); ctx.rotate(spin); ctx.scale(k, k);
    enemyPath({ type: f.ty, x: 0, y: 0, r: f.r }); ctx.globalAlpha = al * (1 - brk);
    ctx.fillStyle = q < 0.12 ? TC.hit : rgba(bc, 0.25); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = f.b === 'ball' && hash(sd + Math.floor(VX.t * 30)) > 0.55 ? (VX.light ? C.WEAPONS.tesla.color : '#ffffff') : bc; ctx.stroke();
    ctx.globalAlpha = 1; ctx.restore();
  }
  if (brk > 0) {                             // 조각 셋이 흩어진다
    ctx.fillStyle = rgba(bc, 0.85 * al); ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = ang + (i - 1) * 1.3 + (hash(sd + i * 7.7) - 0.5) * 0.8, s = f.r * (0.5 + 0.9 * brk) * (0.6 + 0.6 * hash(sd + i * 2.3)), z = f.r * 0.32 * (1 - 0.6 * brk);
      const cx = x + Math.cos(a) * s, cy = y + Math.sin(a) * s, r0 = spin * 1.7 + i * 2;
      ctx.moveTo(cx + Math.cos(r0) * z, cy + Math.sin(r0) * z); ctx.lineTo(cx + Math.cos(r0 + 2.3) * z * 0.8, cy + Math.sin(r0 + 2.3) * z * 0.8); ctx.lineTo(cx + Math.cos(r0 + 4.1) * z * 0.6, cy + Math.sin(r0 + 4.1) * z * 0.6); ctx.closePath();
    }
    ctx.fill();
  }
}
// 산성비에 쓰러진 적: 몸이 산 색으로 물들며 납작하게 퍼져 가라앉고, 방울 둘이 흘러내린다
function drawRainMelt(f, q, col, h1, h2) {
  const e = VX.ease(q, 2), ac = C.WEAPONS.acid.color, mc = VX.lerp(col, VX.light ? VX.mix(ac, -0.3) : ac, Math.min(1, q * 2)), al = Math.min(1, (1 - q) * 1.5);
  ctx.save(); ctx.translate(f.x, f.y + f.r * 0.45 * e); ctx.scale(1 + 0.4 * e, 1 - 0.72 * e);
  enemyPath({ type: f.ty, x: 0, y: 0, r: f.r }); ctx.globalAlpha = al;
  ctx.fillStyle = rgba(mc, 0.3 + 0.2 * e); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = mc; ctx.stroke();
  ctx.globalAlpha = 1; ctx.restore();
  ctx.fillStyle = rgba(mc, 0.8 * al); ctx.beginPath();
  for (let i = 0; i < 2; i++) {
    const dx = (i ? 0.45 - 0.2 * h2 : -0.35 + 0.2 * h1) * f.r, dy = f.r * (0.3 + 1.1 * VX.ease(Math.max(0, q - 0.1 - 0.15 * i), 2)) * (0.8 + 0.4 * (i ? h1 : h2)), rr = 2.6 * (1 - 0.5 * q);
    ctx.moveTo(f.x + dx + rr, f.y + dy); ctx.arc(f.x + dx, f.y + dy, rr, 0, TAU);
  }
  ctx.fill();
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
/* ---------- 효과 도구 (VX) ----------
   화면 전용이다. 게임 규칙과 무관해서 난수는 Math.random 을 쓰고 Core 상태는 건드리지 않는다.
   시간은 게임 시간(S.t)을 따라가므로 일시정지나 창이 열려 게임이 멈추면 입자와 잔상도 함께 멈춘다.
   - VX.glow(x, y, r, 색, 알파[, 세로 반지름])   빛 번짐 한 장. shadowBlur 대신 미리 그려 둔 스프라이트를 찍는다. VX.heat 는 가운데가 하얗게 달아오른 것
   - VX.wave(x, y, r, 색, 알파, 얇기 0~1[, 위쪽 반만])   안쪽은 비고 바깥 가장자리만 밝은 부드러운 충격파
   - VX.spark(x, y, vx, vy, 수명, 크기, 색[, 중력, 감속, 종류])   입자 하나 (종류 0 점, 1 빛줄기, 2 깜빡이는 불티). VX.rate(초당 개수) 는 이번 프레임에 낼 개수
   - VX.trail(x0, y0, x1, y1, 굵기, 색, 수명[, 알갱이])   탄과 빔이 지나간 자리의 잔상. 서서히 가늘어지며 사라진다
   - VX.add() / VX.norm()   어두운 테마에서만 더하기 합성을 켠다 / 원래대로. 밝은 테마에서는 하얗게 날아가므로 보통 합성 그대로 둔다
   - VX.hot(색)   가는 선과 불티에 쓰는 달아오른 색 (어두운 테마는 흰 쪽, 밝은 테마는 짙은 쪽). VX.mix(색, k) 는 흰색(+) 검은색(-) 쪽으로 섞기
   - VX.ease(u[, n])   빠르게 시작해 느려지는 곡선. VX.fade(u)   사라질 때 굵기와 투명도에 함께 곱하는 값
   - VX.column(x, 위 y, 아래 y, 반폭, 색, 알파)   세로로 선 빛기둥. 양옆이 부드럽게 옅어지고 위쪽 끝도 옅어진다 (빔, 달궈진 금)
   - VX.lerp(색1, 색2, u)   두 색 사이
   - VX.ui(물체)   fx, 탄, 웅덩이마다 한 번 만들어지는 화면용 기록 { sd: 난수, n: 처음 보는가 }. 처음 볼 때 입자를 뿌리는 데 쓴다
   - 색은 '#rrggbb' 만 받는다. 그리는 순서: draw() 가 VX.begin(S) → (웅덩이, 적, 탄) → VX.draw() (잔상과 입자) → S.fx */
const VX = (() => {
  const MAXP = 300, MAXT = 64;
  const P = [], FREE = [], T = [], SPR = {}, MIX = {}, UI = new WeakMap();
  // 미리 그린 스프라이트는 ImageBitmap 으로 바꿔 둔다: canvas 를 그대로 drawImage 하면 부를 때마다 원본을 복사해 느리다 (바뀌기 전까지는 canvas 를 쓴다)
  const bake = (key, s) => { SPR[key] = s; if (window.createImageBitmap) createImageBitmap(s).then((b) => { SPR[key] = b; }, () => {}); return s; };
  let lastT = -1, dt = 0, tw = 0;
  const v = { light: false, t: 0 };
  const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255); };
  v.mix = (hex, k) => {
    const key = hex + k; const o = MIX[key]; if (o) return o;
    const n = parseInt(hex.slice(1), 16), to = k > 0 ? 255 : 0, a = Math.abs(k), ch = (x) => Math.round(x + (to - x) * a).toString(16).padStart(2, '0');
    return (MIX[key] = '#' + ch(n >> 16) + ch((n >> 8) & 255) + ch(n & 255));
  };
  v.hot = (hex) => v.light ? v.mix(hex, -0.25) : v.mix(hex, 0.7);
  v.ease = (u, n) => 1 - Math.pow(1 - (u < 0 ? 0 : u > 1 ? 1 : u), n || 3);
  v.fade = (u) => { const k = 1 - (u < 0 ? 0 : u > 1 ? 1 : u); return k * Math.sqrt(k); };
  function sprite(key, n, stops) {
    const s = document.createElement('canvas'); s.width = s.height = n;
    const g = s.getContext('2d'), r = n / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
    for (const st of stops) gr.addColorStop(st[0], `rgba(${st[1]},${st[2]})`);
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
    return bake(key, s);
  }
  const WHITE = '255,255,255', WIN = [0.52, 0.72, 0.87];
  function glowSpr(col) { const c = rgbOf(col); return sprite('g' + col, 64, [[0, c, 1], [0.2, c, 0.66], [0.45, c, 0.27], [0.72, c, 0.07], [1, c, 0]]); }
  function heatSpr(col) { const c = rgbOf(col); return sprite('h' + col, 64, [[0, WHITE, 1], [0.2, WHITE, 0.95], [0.44, c, 0.85], [0.72, c, 0.28], [1, c, 0]]); }
  function waveSpr(col, k) { const c = rgbOf(col), a = WIN[k]; return sprite('w' + k + col, 256, [[0, c, 0], [a, c, 0], [a + (0.95 - a) * 0.62, c, 0.26], [0.95, c, 1], [0.975, c, 0.9], [1, c, 0]]); }
  const COL1 = [[0, 0], [0.16, 0.06], [0.34, 0.36], [0.5, 0.9], [0.66, 0.36], [0.84, 0.06], [1, 0]];
  // 지속 빔: 넓은 겉빛 x0.55 위에 폭 0.38배의 속빛 x0.95 를 겹친 단면 (기둥 두 장을 한 장으로 그려 래스터 비용을 줄인다)
  const COL2 = (() => { const f = (u) => { let i = 1; while (i < COL1.length - 1 && COL1[i][0] < u) i++; const a = COL1[i - 1], b = COL1[i]; return a[1] + (b[1] - a[1]) * (u - a[0]) / ((b[0] - a[0]) || 1); };
    const out = []; for (let i = 0; i <= 16; i++) { const u = i / 16, o = 0.55 * f(u), w = (u - 0.5) / 0.382 + 0.5, n = w > 0 && w < 1 ? 0.95 * f(w) : 0; out.push([u, Math.min(1, o + n * (1 - o))]); } return out; })();
  function colSpr(col, two) {
    const s = document.createElement('canvas'); s.width = two ? 64 : 32; s.height = 64;
    const g = s.getContext('2d'), c = rgbOf(col); let gr = g.createLinearGradient(0, 0, s.width, 0);
    for (const st of two ? COL2 : COL1) gr.addColorStop(st[0], `rgba(${c},${st[1]})`);
    g.fillStyle = gr; g.fillRect(0, 0, 32, 64);
    gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.1, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; g.fillRect(0, 0, s.width, 64);
    return bake((two ? 'C' : 'c') + col, s);
  }
  v.column = (x, y0, y1, hw, col, a) => {
    if (!(a > 0.012)) return;
    ctx.globalAlpha = a > 1 ? 1 : a; ctx.drawImage(SPR['c' + col] || colSpr(col), x - hw, y0, hw * 2, y1 - y0); ctx.globalAlpha = 1;
  };
  const PIL1 = [[0, 0], [0.12, 0.05], [0.28, 0.28], [0.42, 0.7], [0.5, 0.9], [0.58, 0.7], [0.72, 0.28], [0.88, 0.05], [1, 0]];
  function pilSpr(col) {                       // 진화 빛기둥: 단면이 기둥보다 넓게 번지고 위아래 끝이 흐려진다
    const s = document.createElement('canvas'); s.width = 32; s.height = 128;
    const g = s.getContext('2d'), c = rgbOf(col); let gr = g.createLinearGradient(0, 0, 32, 0);
    for (const st of PIL1) gr.addColorStop(st[0], `rgba(${c},${st[1]})`);
    g.fillStyle = gr; g.fillRect(0, 0, 32, 128);
    gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, 'rgba(0,0,0,1)'); gr.addColorStop(0.8, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; g.fillRect(0, 0, 32, 128);
    return bake('p' + col, s);
  }
  v.pillar = (x, y0, y1, hw, col, a) => {
    if (!(a > 0.012) || y1 <= y0) return;
    ctx.globalAlpha = a > 1 ? 1 : a; ctx.drawImage(SPR['p' + col] || pilSpr(col), x - hw, y0, hw * 2, y1 - y0); ctx.globalAlpha = 1;
  };
  v.column2 = (x, y0, y1, hw, col, a) => {          // 겉빛과 속빛을 겹친 기둥 한 장 (hw = 겉빛 반폭)
    if (!(a > 0.012)) return;
    ctx.globalAlpha = a > 1 ? 1 : a; ctx.drawImage(SPR['C' + col] || colSpr(col, 1), x - hw, y0, hw * 2, y1 - y0); ctx.globalAlpha = 1;
  };
  v.lerp = (c1, c2, u) => {
    const k = Math.round((u < 0 ? 0 : u > 1 ? 1 : u) * 16), key = c1 + c2 + k; const o = MIX[key]; if (o) return o;
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16), ch = (sh) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * k / 16).toString(16).padStart(2, '0');
    return (MIX[key] = '#' + ch(16) + ch(8) + ch(0));
  };
  v.add = () => { if (!v.light) ctx.globalCompositeOperation = 'lighter'; };
  v.norm = () => { ctx.globalCompositeOperation = 'source-over'; };
  v.glow = (x, y, r, col, a, ry) => {
    if (!(a > 0.012)) return;
    const h = ry || r; ctx.globalAlpha = a > 1 ? 1 : a; ctx.drawImage(SPR['g' + col] || glowSpr(col), x - r, y - h, r * 2, h * 2); ctx.globalAlpha = 1;
  };
  v.heat = (x, y, r, col, a, ry) => {
    if (!(a > 0.012)) return;
    const h = ry || r; ctx.globalAlpha = a > 1 ? 1 : a; ctx.drawImage(SPR['h' + col] || heatSpr(col), x - r, y - h, r * 2, h * 2); ctx.globalAlpha = 1;
  };
  function wave1(k, x, y, r, col, a, half) {
    if (!(a > 0.012)) return;
    const s = SPR['w' + k + col] || waveSpr(col, k); ctx.globalAlpha = a > 1 ? 1 : a;
    if (half) ctx.drawImage(s, 0, 0, 256, 128, x - r, y - r, r * 2, r); else ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  }
  v.wave = (x, y, r, col, a, thin, half) => {      // 얇기가 변해도 튀지 않게 두 장을 섞는다
    if (!(a > 0.012) || r < 1) return;
    const k = (thin < 0 ? 0 : thin > 1 ? 1 : thin) * 2, i = k >= 2 ? 1 : Math.floor(k), fr = k - i;
    wave1(i, x, y, r, col, a * (1 - fr), half); wave1(i + 1, x, y, r, col, a * fr, half); ctx.globalAlpha = 1;
  };
  v.spark = (x, y, vx, vy, life, size, col, g, dr, k) => {
    if (P.length >= MAXP || RM.matches) return;
    const o = FREE.pop() || {};
    o.x = x; o.y = y; o.vx = vx; o.vy = vy; o.t = o.d = life; o.r = size; o.c = col; o.g = g || 0; o.dr = dr || 0; o.k = k || 0; o.ph = Math.random() * 6.283;
    P.push(o);
  };
  v.rate = (perSec) => { const n = perSec * dt, f = Math.floor(n); return f + (Math.random() < n - f ? 1 : 0); };
  v.trail = (x0, y0, x1, y1, w, col, life, beads) => {
    let o;
    if (T.length < MAXT) T.push(o = {}); else o = T[tw++ % MAXT];   // 가득 차면 돌아가며 덮어쓴다
    o.x0 = x0; o.y0 = y0; o.x1 = x1; o.y1 = y1; o.w = w; o.c = col; o.t = o.d = life; o.sd = Math.random();
    o.b = beads ? Math.max(2, Math.min(9, Math.round(Math.hypot(x1 - x0, y1 - y0) / (w > 3 ? 50 : 80)))) : 0;
  };
  v.ui = (o) => { let u = UI.get(o); if (u) u.n = 0; else UI.set(o, u = { sd: Math.random(), n: 1 }); return u; };
  // 프레임마다 한 번: 게임 시간이 흐른 만큼만 움직인다 (새 게임이면 비운다)
  v.begin = (S) => {
    v.light = theme.scheme === 'light';
    const t = S ? S.t : 0; dt = t - lastT; lastT = t; v.t = RM.matches ? 0 : t;
    if (dt < 0) { P.length = 0; T.length = 0; dt = 0; v.reset = 1; } else if (dt > 0.1) dt = 0.1;
    v.dt = dt;
    if (!dt) return;
    for (let i = P.length - 1; i >= 0; i--) {
      const o = P[i]; o.t -= dt;
      if (o.t <= 0) { FREE.push(o); P[i] = P[P.length - 1]; P.pop(); continue; }
      if (o.dr) { const k = Math.max(0, 1 - o.dr * dt); o.vx *= k; o.vy *= k; }
      o.vy += o.g * dt; o.x += o.vx * dt; o.y += o.vy * dt;
    }
    for (let i = T.length - 1; i >= 0; i--) { const o = T[i]; if (o.t > 0) o.t -= dt; }
  };
  v.draw = () => {
    if (!P.length && !T.length) return;
    ctx.lineCap = 'round'; v.add();
    for (let i = 0, n = T.length; i < n; i++) {
      const o = T[i]; if (o.t <= 0) continue;
      const p = o.t / o.d, a = Math.min(1, p * 1.7), lw = o.w * p + 0.35, hc = v.hot(o.c);
      ctx.beginPath(); ctx.moveTo(o.x0, o.y0); ctx.lineTo(o.x1, o.y1);
      ctx.lineWidth = lw * 2.6; ctx.strokeStyle = rgba(o.c, (v.light ? 0.3 : 0.4) * a); ctx.stroke();
      ctx.lineWidth = lw; ctx.strokeStyle = rgba(v.light ? hc : o.c, 0.9 * a); ctx.stroke();
      if (!v.light && p > 0.35) { ctx.lineWidth = lw * 0.4; ctx.strokeStyle = `rgba(255,255,255,${(a * 0.9).toFixed(2)})`; ctx.stroke(); }
      if (!o.b) continue;
      const dx = o.x1 - o.x0, dy = o.y1 - o.y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, q = 1 - p;
      ctx.fillStyle = hc; ctx.beginPath();
      for (let j = 0; j < o.b; j++) {              // 빔 길을 따라 잠깐 떠 있는 빛 알갱이
        const s = (j + hash(o.sd * 71 + j * 5.3)) / o.b, side = hash(o.sd * 37 + j * 9.1) - 0.5, off = side * (7 + 20 * q), tk = 0.55 + 0.45 * Math.sin(v.t * 13 + j * 2.4 + o.sd * 40);
        const bx = o.x0 + dx * s + nx * off, by = o.y0 + dy * s + ny * off - q * 9 * (0.4 + hash(o.sd * 13 + j));
        v.glow(bx, by, 4 + 3 * tk, o.c, 0.75 * a * tk);
        ctx.moveTo(bx + 1.6, by); ctx.arc(bx, by, (0.7 + 0.9 * tk) * (0.5 + 0.5 * p), 0, 6.283);
      }
      ctx.globalAlpha = a; ctx.fill(); ctx.globalAlpha = 1;
    }
    let fc = '';
    for (let i = 0, n = P.length; i < n; i++) {
      const o = P[i], p = o.t / o.d; let a = p > 0.5 ? 1 : p * 2;
      if (o.k === 2) a *= 0.6 + 0.4 * Math.sin(o.ph + o.t * 22);
      ctx.globalAlpha = a;
      if (o.k === 1) { ctx.strokeStyle = o.c; ctx.lineWidth = o.r * (0.4 + 0.6 * p); ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x - o.vx * 0.035, o.y - o.vy * 0.035); ctx.stroke(); continue; }
      if (fc !== o.c) ctx.fillStyle = fc = o.c;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (0.4 + 0.6 * p), 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1; v.norm(); ctx.lineCap = 'butt';
  };
  return v;
})();
const TAU = Math.PI * 2;
// 불 색 (테마별): o 바깥 주황, y 안쪽 노랑, e 불티, s 그을음
const FIRE_D = { o: '#ff7326', y: '#ffe08a', e: '#ffc163', s: 'rgba(0,0,0,' }, FIRE_L = { o: '#f0601a', y: '#ffc12e', e: '#e2500c', s: 'rgba(72,36,14,' };
const fireCol = () => VX.light ? FIRE_L : FIRE_D;
// 불꽃 혀 하나를 지금 경로에 더한다. 밑(bx, by)은 둥글고 끝(tx, ty)은 가늘게 휜다. w 밑 반폭, bend 끝이 옆으로 휘는 정도
function flameTo(bx, by, tx, ty, w, bend) {
  const dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const mx = bx + dx * 0.42 + nx * bend * 0.35, my = by + dy * 0.42 + ny * bend * 0.35, ex = tx + nx * bend, ey = ty + ny * bend, k = w * 1.3;
  ctx.moveTo(bx - nx * w, by - ny * w);
  ctx.quadraticCurveTo(mx - nx * k, my - ny * k, ex, ey);
  ctx.quadraticCurveTo(mx + nx * k, my + ny * k, bx + nx * w, by + ny * w);
  ctx.quadraticCurveTo(bx - ux * w * 1.5, by - uy * w * 1.5, bx - nx * w, by - ny * w);
}
// 울퉁불퉁한 덩어리를 지금 경로에 더한다 (n 개의 굴곡, amp 굴곡의 깊이)
function blobTo(x, y, r, sd, n, amp) {
  let px = 0, py = 0, fx = 0, fy = 0;
  for (let i = 0; i <= n + 1; i++) {
    const j = i % n, a = j / n * TAU + sd * 9, rr = r * (1 - amp + 2 * amp * hash(sd * 53 + j * 7.3)), qx = x + Math.cos(a) * rr, qy = y + Math.sin(a) * rr;
    if (i === 1) { fx = (px + qx) / 2; fy = (py + qy) / 2; ctx.moveTo(fx, fy); }
    else if (i > 1) ctx.quadraticCurveTo(px, py, (px + qx) / 2, (py + qy) / 2);
    px = qx; py = qy;
  }
  ctx.closePath();
}
// 펄스의 기본 파동: 핵이 번쩍 → 가장자리만 밝은 물결이 빠르게 퍼지다 느려지며 얇아진다 → 옅은 두 번째 물결
function drawPulse(f, p) {
  const q = 1 - p, u = VX.ui(f), R = f.r, col = f.c === '#ffffff' && VX.light ? C.WEAPONS.pulse.color : f.c, hot = VX.hot(col);
  if (u.n) {
    const v0 = R * 0.9 * 3 / f.d;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.04 + 0.92 * (i + Math.random()) / 7), k = 0.85 + 0.25 * Math.random();
      VX.spark(f.x + Math.cos(a) * R * 0.1, f.y + Math.sin(a) * R * 0.1, Math.cos(a) * v0, Math.sin(a) * v0, f.d * (0.9 + 0.7 * Math.random()), 1 + Math.random(), hot, 0, 3 / (f.d * k), 2);
    }
  }
  const e = VX.ease(q), rr = R * (0.1 + 0.9 * e), fd = VX.fade(q);
  VX.add();
  VX.glow(f.x, f.y, 30 + 36 * e, col, 0.85 * p * p);
  VX.heat(f.x, f.y, 15 + 9 * q, col, p * p * p);
  VX.wave(f.x, f.y, rr, col, 0.8 * fd, q, true);
  ctx.beginPath(); ctx.arc(f.x, f.y, rr * 0.972, Math.PI, TAU); ctx.lineWidth = 1.8 * fd + 0.4; ctx.strokeStyle = rgba(VX.light ? col : hot, 0.9 * fd); ctx.stroke();
  const u2 = (q - 0.24) / 0.76;
  if (u2 > 0) {
    const f2 = VX.fade(u2);
    ctx.beginPath(); ctx.arc(f.x, f.y, R * (0.08 + 0.74 * VX.ease(u2, 2)), Math.PI, TAU); ctx.lineWidth = 1.5 * f2 + 0.4; ctx.strokeStyle = rgba(col, 0.55 * f2); ctx.stroke();
  }
  VX.norm();
}
// 초신성 (f.nova: 1 첫 폭발, 2 쌍성의 두 번째): 핵 섬광, 빠르게 퍼지다 느려지는 충격파, 파면을 따라가는 불티, 늦게 따라오는 옅은 물결
function drawNova(f, p) {
  const u = VX.ui(f), T = f.d * (1 - p), R = f.r, first = f.nova === 1, col = f.c, hot = VX.hot(col), D = 0.62;
  if (u.n) {
    const v0 = R * 0.92 * 4 / D, n = first ? 22 : 13;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (1.03 + 0.94 * (i + Math.random()) / n), k = 0.8 + 0.28 * Math.random();
      VX.spark(f.x + Math.cos(a) * R * 0.08, f.y + Math.sin(a) * R * 0.08, Math.cos(a) * v0, Math.sin(a) * v0, 0.5 + 0.55 * Math.random(), 1.2 + 1.4 * Math.random(), i % 3 ? hot : col, -14, 4 / (D * k), 2);
    }
    for (let i = first ? 9 : 5; i > 0; i--) {
      const a = Math.PI * (1.06 + 0.88 * Math.random()), s = 240 + 260 * Math.random();
      VX.spark(f.x, f.y - 2, Math.cos(a) * s, Math.sin(a) * s, 0.16 + 0.14 * Math.random(), 1.8, hot, 0, 5, 1);
    }
  }
  VX.add();
  const tc = T / 0.28;
  if (tc < 1) {                              // 핵: 무기 자리에서 번쩍
    const k = 1 - tc;
    VX.glow(f.x, f.y, (first ? 64 : 46) + 90 * VX.ease(tc), col, 0.9 * k);
    VX.heat(f.x, f.y, (first ? 36 : 26) + 30 * tc, col, k * k);
  }
  if (first && T < 0.22) VX.glow(f.x, f.y, R * (0.55 + 0.5 * T / 0.22), col, 0.3 * (1 - T / 0.22));   // 범위 안이 잠깐 밝아진다
  const um = T / D;
  if (um < 1) {                              // 충격파: 가장자리만 밝고, 퍼질수록 얇아지며 사라진다
    const rr = R * (0.08 + 0.92 * VX.ease(um, 4)), fd = VX.fade(um);
    VX.wave(f.x, f.y, rr, col, (first ? 0.95 : 0.78) * fd, um, true);
    ctx.beginPath(); ctx.arc(f.x, f.y, rr * 0.972, Math.PI, TAU); ctx.lineWidth = (first ? 2.2 : 1.8) * fd + 0.4; ctx.strokeStyle = rgba(VX.light ? col : hot, 0.9 * fd); ctx.stroke();
  }
  const u2 = (T - 0.12) / (f.d - 0.12);
  if (u2 > 0 && u2 < 1) {                    // 살짝 늦게 따라오는 옅은 물결
    const f2 = VX.fade(u2), r2 = R * (0.06 + 0.8 * VX.ease(u2, 2.4));
    VX.wave(f.x, f.y, r2, col, 0.42 * f2, 1, true);
    ctx.beginPath(); ctx.arc(f.x, f.y, r2 * 0.972, Math.PI, TAU); ctx.lineWidth = 1.3 * f2 + 0.3; ctx.strokeStyle = rgba(col, 0.5 * f2); ctx.stroke();
  }
  VX.norm();
}
// 화염 산탄의 총구 불꽃: 부채꼴로 뻗는 불꽃 혀 여러 가닥 (길이와 굵기가 저마다 다르다). 뻗었다가 움츠러들며 사라진다
function drawFcone(f, p) {
  const q = 1 - p, u = VX.ui(f), F = fireCol(), sp = f.sp, n = 4 + Math.round(sp * 2.5), e = VX.ease(q, 4), sd = u.sd * 97, grow = (0.25 + 0.75 * e) * (0.45 + 0.55 * p);
  if (u.n) {
    for (let i = 0; i < 9; i++) {
      const a = (Math.random() * 2 - 1) * sp, s = 150 + 200 * Math.random();
      VX.spark(f.x, f.y - 4, Math.sin(a) * s, -Math.cos(a) * s, 0.28 + 0.3 * Math.random(), 1 + 1.1 * Math.random(), i % 2 ? F.e : F.y, -50, 4, 2);
    }
  }
  VX.add(); VX.glow(f.x, f.y - 10, 42 + 30 * e, F.o, 0.65 * p); VX.norm();
  for (let pass = 0; pass < 2; pass++) {
    const ks = pass ? 0.58 : 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (-1 + (i + 0.5 + (hash(sd + i) - 0.5) * 0.6) * 2 / n) * sp * 0.92, len = (58 + 44 * hash(sd + i * 3.7)) * grow * ks, w = (9 + 5 * hash(sd + i * 5.1)) * (0.7 + 0.3 * p) * (pass ? 0.5 : 1);
      flameTo(f.x + Math.sin(a) * 2, f.y - Math.cos(a) * 2, f.x + Math.sin(a) * len, f.y - Math.cos(a) * len, w, (hash(sd + i * 9.3) - 0.5) * 22 * (0.3 + 0.7 * q));
    }
    ctx.fillStyle = rgba(pass ? F.y : F.o, (pass ? 0.95 : 0.85) * Math.min(1, p * 2.2)); ctx.fill();
  }
}
// 용 머리 (용의 숨결 궁극): 입을 벌린 불의 용 머리가 앞장서 레인 끝까지 날아가고, 헤엄치듯 일렁이는 몸통 불길이 뒤따른다.
// 탄마다 화면 기록(VX.ui)을 DRG 에 모아 두고, 탄이 화면 위로 빠져나간 뒤에도 몸통이 마저 빠져나가며 서서히 사그라들게 그린다
const DRG = [], DRG_LEN = 420, DRG_FADE = 1.1, DRG_SC = 1.3;   // T9a: 몸통을 길게, 머리가 빠져나간 뒤에도 몸통이 마저 지나가며 사그라든다
function dragonSeen(b) {
  const u = VX.ui(b);
  if (u.n) { u.x = b.x; u.t0 = C.S.t; u.m = u.sd < 0.5 ? 1 : -1; DRG.push(u); }
  u.hy = b.y; u.vy = b.vy; u.seen = C.S.t;
}
function drawDragons(H) {
  const now = C.S.t;
  for (let i = DRG.length - 1; i >= 0; i--) {
    const u = DRG[i], gone = now - u.seen;
    if (gone > DRG_FADE || now < u.t0) { DRG[i] = DRG[DRG.length - 1]; DRG.pop(); continue; }
    const al = gone > 1e-9 ? 1 - Math.pow(gone / DRG_FADE, 2.5) : 1;   // 한동안 진하게 남았다가 사그라든다
    drawDragon(u, H, al, u.hy + u.vy * gone);
  }
}
const DPX = new Float32Array(24), DPY = new Float32Array(24), DNX = new Float32Array(24), DW = new Float32Array(24);
function drawDragon(u, H, al, hy) {
  const F = fireCol(), L = VX.light, t = VX.t, sd = u.sd * 131, m = u.m, dor = -m, x0 = u.x, ph = sd * 3;
  const sway = (s) => 16 * Math.min(1, s / 70) * (1 - 0.3 * s / DRG_LEN) * Math.sin(s * 0.024 - t * 6.5 + ph);   // 몸통을 따라 뒤로 흐르는 물결
  const width = (s) => { const v = s / DRG_LEN; return 1.5 + 13 * Math.pow(1 - v, 0.7) * (1 + 0.3 * Math.sin(Math.PI * Math.min(1, v / 0.22))); };
  const s0 = 14, sEnd = Math.min(DRG_LEN, H - 10 - hy), N = 20;
  // 몸통
  if (sEnd > s0 + 6) {
    for (let i = 0; i < N; i++) { const s = s0 + (sEnd - s0) * i / (N - 1); DPX[i] = x0 + sway(s); DPY[i] = hy + s; DW[i] = width(s); }
    for (let i = 0; i < N; i++) { const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1), tx = DPX[b] - DPX[a], ty = DPY[b] - DPY[a], l = Math.hypot(tx, ty) || 1; DNX[i] = ty / l; }   // 법선의 x 성분 (몸통이 거의 세로라 y 성분은 작다)
    VX.add();
    for (const v of [0.12, 0.45, 0.8]) { const j = Math.round(v * (N - 1)); VX.glow(DPX[j], DPY[j], 26 + 14 * (1 - v), F.o, (L ? 0.3 : 0.42) * al, 34 + 30 * (1 - v)); }
    VX.norm();
    const g = ctx.createLinearGradient(0, hy, 0, hy + DRG_LEN);
    g.addColorStop(0, rgba(F.o, 0.92 * al)); g.addColorStop(0.55, rgba(F.o, 0.72 * al)); g.addColorStop(1, rgba(F.o, 0));
    let n = 0;
    for (let i = 0; i < N; i++) { const w = DW[i] * (1 + 0.14 * Math.sin(t * 21 + i * 1.9 + sd)); BP[n++] = DPX[i] - DNX[i] * w; BP[n++] = DPY[i]; }
    for (let i = N - 1; i >= 0; i--) { const w = DW[i] * (1 + 0.14 * Math.sin(t * 19 + i * 2.3 + sd * 1.7)); BP[n++] = DPX[i] + DNX[i] * w; BP[n++] = DPY[i]; }
    ctx.fillStyle = g; ctx.beginPath(); smoothPath(n / 2); ctx.fill();
    // 등지느러미처럼 뒤로 날리는 불꽃 혀 (자리와 길이가 저마다 다르다)
    ctx.beginPath();
    for (let j = 0; j < 12; j++) {
      const v = (j + 0.25 + 0.5 * hash(sd + j * 5.7)) / 12, s = 22 + (DRG_LEN - 40) * v; if (s > sEnd - 4) break;
      const w = width(s), bx = x0 + sway(s) + dor * w * 0.6, by = hy + s, len = (10 + 10 * hash(sd + j * 3.1)) * (1 - 0.55 * v) * (0.82 + 0.18 * Math.sin(t * 17 + j * 2.1));
      flameTo(bx, by, bx + dor * len * 0.62, by + len * 0.8, 4.6 * (1 - 0.5 * v), Math.sin(t * 13 + j * 1.3) * 4);
    }
    ctx.fillStyle = rgba(F.o, 0.85 * al); ctx.fill();
    // 배 쪽의 달아오른 속불 (머리 쪽에서 꼬리 쪽으로 옅어진다)
    const k1 = Math.round((N - 1) * 0.75), g2 = ctx.createLinearGradient(0, hy, 0, hy + DRG_LEN * 0.75);
    g2.addColorStop(0, rgba(F.y, 0.95 * al)); g2.addColorStop(1, rgba(F.y, 0));
    n = 0;
    for (let i = 0; i <= k1; i++) { const w = DW[i] * 0.4, c = DPX[i] - dor * DNX[i] * DW[i] * 0.22; BP[n++] = c - DNX[i] * w; BP[n++] = DPY[i]; }
    for (let i = k1; i >= 0; i--) { const w = DW[i] * 0.4, c = DPX[i] - dor * DNX[i] * DW[i] * 0.22; BP[n++] = c + DNX[i] * w; BP[n++] = DPY[i]; }
    ctx.fillStyle = g2; ctx.beginPath(); smoothPath(n / 2); ctx.fill();
    // 꼬리 끝: 다 빠져나오면 연기처럼 말리며 흩어지는 불꽃 두 가닥
    if (sEnd >= DRG_LEN - 1) {
      const tx = DPX[N - 1], ty = DPY[N - 1];
      ctx.beginPath();
      for (let j = 0; j < 2; j++) flameTo(tx, ty - 4, tx + (j ? -1 : 1) * (6 + 5 * Math.sin(t * 9 + j)), ty + 22 + 6 * Math.sin(t * 11 + j * 2), 2.6, (j ? 1 : -1) * 6 * Math.sin(t * 7 + j));
      ctx.fillStyle = rgba(F.o, 0.4 * al); ctx.fill();
    }
    // 몸통에서 떨어져 나가 그 자리에 남는 불티 (지나간 흔적)
    if (al > 0.3) for (let c = VX.rate(46); c > 0; c--) {
      const i = Math.floor(Math.random() * N), side = Math.random() < 0.5 ? -1 : 1, w = DW[i];
      VX.spark(DPX[i] + side * w * (0.4 + 0.5 * Math.random()), DPY[i], side * (25 + 55 * Math.random()), 10 + 30 * Math.random(), 0.35 + 0.5 * Math.random(), 0.9 + 1.2 * Math.random(), Math.random() < 0.5 ? F.e : F.y, -40, 2.2, 2);
    }
  }
  // 머리
  const hx = x0 + 2.5 * Math.sin(-t * 6.5 + ph + 0.5), rot = -Math.atan2(sway(34) - (hx - x0), 34) * 0.8, gp = 0.62 + 0.16 * Math.sin(t * 11 + ph);
  const cr = Math.cos(rot), sr = Math.sin(rot), W2 = (lx, ly) => [hx + (m * lx * cr - ly * sr) * DRG_SC, hy + (m * lx * sr + ly * cr) * DRG_SC];
  const mo = W2(4, -14), ey = W2(-10.5, -7.5);
  VX.add();
  VX.glow(hx, hy - 8, 46, F.o, (L ? 0.42 : 0.6) * al);
  VX.heat(mo[0], mo[1], 15, F.o, 0.8 * al);            // 벌린 입 안의 불빛
  VX.heat(ey[0], ey[1], 6, F.y, 0.95 * al);
  VX.norm();
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(rot); ctx.scale(m * DRG_SC, DRG_SC); ctx.globalAlpha = al;
  drawDragonHead(F, L, t, sd, gp);
  ctx.restore(); ctx.globalAlpha = 1;
}
// 머리 한 개 (앞쪽이 -y, 등 쪽이 -x). 윗턱과 아래턱은 경첩(4, 8)을 축으로 V 자로 벌어진다
function drawDragonHead(F, L, t, sd, gp) {
  const edge = L ? '#6a1c06' : '#ffe6b0', deep = L ? '#b8320c' : '#c8401a', tooth = L ? '#fff4d6' : '#fffbea', dark = L ? '#4a0e00' : '#6a1600';
  // 내뿜는 불길 (벌린 턱 사이로 앞쪽에)
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (let j = 0; j < 3; j++) { const fl = Math.sin(t * 23 + j * 2.1 + sd), len = (36 + 14 * hash(sd + j * 4.3) + 6 * fl) * (pass ? 0.6 : 1); flameTo(3, -12, 3 + (j - 1) * 9 + fl * 3, -12 - len, (pass ? 4 : 8) * (j === 1 ? 1 : 0.7), fl * 5); }
    ctx.fillStyle = rgba(pass ? F.y : F.o, pass ? 0.92 : 0.78); ctx.fill();
  }
  // 갈기: 뒤통수와 목덜미에서 뒤로 날리는 불꽃 혀
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (let j = 0; j < 6; j++) {
      const v = j / 5, bx = -18 + 26 * v, by = 2 + 14 * v, h = hash(sd + j * 6.1), fl = Math.sin(t * 15 + j * 1.7 + sd);
      const len = (pass ? 0.55 : 1) * (22 + 12 * h) * (1 - 0.3 * v);
      flameTo(bx, by, bx - 8 - 8 * h + fl * 3 + 10 * v, by + len, (pass ? 2.6 : 5.4) * (1 - 0.3 * v), fl * 5);
    }
    ctx.fillStyle = rgba(pass ? F.y : F.o, pass ? 0.85 : 0.86); ctx.fill();
  }
  // 뿔 두 개: 눈썹 뒤에서 뒤로 길게 휜다 (먼 쪽 뿔은 옅게)
  ctx.lineWidth = 0.9; ctx.strokeStyle = rgba(edge, 0.7);
  ctx.beginPath(); flameTo(-9, 0, -30, 26, 3, -5); ctx.fillStyle = rgba(L ? '#7a3414' : '#f2c88a', 0.85); ctx.fill(); ctx.stroke();
  ctx.beginPath(); flameTo(-14, -7, -42, 10, 3.8, -8); ctx.fillStyle = L ? '#5e220c' : '#fff0c8'; ctx.fill(); ctx.stroke();
  // 입 안
  const ua = -gp * 0.5, la = gp * 0.5, ut = rotAbout(1, -30, 4, 8, ua), lt = rotAbout(4, -22, 4, 8, la);
  ctx.beginPath(); ctx.moveTo(4, 9); ctx.lineTo(ut[0], ut[1]); ctx.quadraticCurveTo(4, -22, lt[0], lt[1]); ctx.closePath();
  ctx.fillStyle = rgba(F.y, 0.9); ctx.fill();
  const jg = ctx.createLinearGradient(0, -34, 0, 16); jg.addColorStop(0, F.y); jg.addColorStop(0.45, F.o); jg.addColorStop(1, deep);
  // 아래턱 (윗턱보다 가늘다)
  ctx.save(); ctx.translate(4, 8); ctx.rotate(la); ctx.translate(-4, -8);
  ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(4, -22); ctx.quadraticCurveTo(7, -24.5, 9, -20); ctx.quadraticCurveTo(10.5, -9, 12.5, 2); ctx.quadraticCurveTo(14, 12, 8, 16); ctx.quadraticCurveTo(4, 15, 4, 8); ctx.closePath();
  ctx.fillStyle = jg; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = rgba(edge, 0.85); ctx.stroke();
  teeth(4, 8, 4, -22, -1, [0.32, 0.52, 0.72, 0.9], tooth);
  ctx.beginPath(); ctx.moveTo(8, -18); ctx.quadraticCurveTo(18 + 3 * Math.sin(t * 8 + sd), -6, 15, 6); ctx.quadraticCurveTo(12 + 4 * Math.sin(t * 7 + 2), 18, 24, 28);   // 턱수염
  ctx.lineWidth = 1.4; ctx.strokeStyle = rgba(L ? deep : F.y, 0.85); ctx.stroke();
  ctx.restore();
  // 윗턱과 머리 (주둥이는 가늘고 뒤통수는 불룩하다)
  ctx.save(); ctx.translate(4, 8); ctx.rotate(ua); ctx.translate(-4, -8);
  ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(1, -30); ctx.quadraticCurveTo(-1, -34.5, -5, -33); ctx.quadraticCurveTo(-8.5, -31, -7.5, -26); ctx.quadraticCurveTo(-7, -21, -9, -16);
  ctx.quadraticCurveTo(-12, -12, -15, -9); ctx.quadraticCurveTo(-21, -5, -19.5, 3); ctx.quadraticCurveTo(-19, 12, -13, 15); ctx.quadraticCurveTo(-3, 18, 4, 8); ctx.closePath();
  ctx.fillStyle = jg; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = rgba(edge, 0.85); ctx.stroke();
  teeth(4, 8, 1, -30, 1, [0.3, 0.48, 0.64, 0.8, 0.93], tooth);
  ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-5, -29, 1.3, 0.8, -0.4, 0, TAU); ctx.fill();   // 콧구멍
  ctx.beginPath(); ctx.moveTo(-17, -5); ctx.quadraticCurveTo(-12, -13, -5, -11); ctx.lineWidth = 1.8; ctx.strokeStyle = rgba(L ? dark : edge, 0.9); ctx.stroke();   // 눈썹 뼈
  ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-10.5, -7.5, 4.6, 2.6, -0.45, 0, TAU); ctx.fill();   // 눈두덩
  ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.ellipse(-10.5, -7.5, 3.6, 1.8, -0.45, 0, TAU); ctx.fill();   // 눈
  ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-10.2, -7.6, 0.6, 1.6, -0.45, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-6, -26); ctx.quadraticCurveTo(-21 + 4 * Math.sin(t * 9 + sd), -18, -19, -1); ctx.quadraticCurveTo(-15 + 5 * Math.sin(t * 7 + 1), 14, -31, 28);   // 수염
  ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(L ? deep : F.y, 0.9); ctx.stroke();
  ctx.restore();
}
function rotAbout(x, y, cx, cy, a) { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; }
// 턱 안쪽 가장자리 (x0,y0)->(x1,y1) 를 따라 입 쪽(side: +1 은 +x 쪽)으로 난 이빨. 맨 앞은 송곳니
function teeth(x0, y0, x1, y1, side, at, col) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = -uy * side, ny = ux * side;
  ctx.beginPath();
  for (let i = 0; i < at.length; i++) {
    const s = at[i] * l, px = x0 + ux * s, py = y0 + uy * s, len = i === at.length - 1 ? 5.2 : 3.2, hw = i === at.length - 1 ? 1.7 : 1.3;
    ctx.moveTo(px - ux * hw, py - uy * hw); ctx.lineTo(px + nx * len + ux * 0.6, py + ny * len + uy * 0.6); ctx.lineTo(px + ux * hw, py + uy * hw);
  }
  ctx.fillStyle = col; ctx.fill();
}
// 용 머리가 튀어나오는 순간: 총구에서 위로 길게 터지는 불꽃 혀와 부드러운 충격파
function drawRoar(f, p) {
  const F = fireCol(), q = 1 - p;
  drawFcone(f, p);
  VX.add(); VX.wave(f.x, f.y, 18 + 46 * VX.ease(q), F.o, 0.55 * VX.fade(q), q, true); VX.norm();
}
// 슬러그탄을 쏘는 순간: 바닥으로 퍼지는 납작한 충격 고리와 짧은 섬광
function drawSlugFire(f, p) {
  const q = 1 - p, u = VX.ui(f), e = VX.ease(q), hot = VX.hot(f.c);
  if (u.n) for (let i = 0; i < 6; i++) { const sgn = i % 2 ? 1 : -1, s = 90 + 110 * Math.random(); VX.spark(f.x, f.y, sgn * s, -20 - 50 * Math.random(), 0.18 + 0.16 * Math.random(), 1.6, hot, 60, 6, 1); }
  VX.add(); VX.heat(f.x, f.y - 2, 16 + 14 * e, f.c, p * p); VX.norm();
  for (let k = 0; k < 2; k++) {
    const uu = k ? (q - 0.25) / 0.75 : q; if (uu <= 0) continue;
    const fd = VX.fade(uu), rx = (k ? 6 : 9) + (k ? 22 : 34) * VX.ease(uu);
    ctx.beginPath(); ctx.ellipse(f.x, f.y + 2, rx, rx * 0.4, 0, 0, TAU); ctx.lineWidth = (k ? 1.6 : 3) * fd + 0.4; ctx.strokeStyle = rgba(k ? f.c : hot, (k ? 0.6 : 0.9) * fd); ctx.stroke();
  }
}
// 블래스터 거대탄: 머리가 둥글고 뒤로 가늘어지는 한 덩어리. 하얗게 달아오른 길쭉한 핵, 무기 색 겉빛, 긴 꼬리, 앞쪽의 얇은 충격파 호, 떨어져 나가는 불티
function giantBody(rw, k, tl, w1, w2) {       // 물방울 꼴 (앞쪽이 -y)
  const a = rw * k;
  ctx.beginPath(); ctx.moveTo(0, -a * 0.86);
  ctx.bezierCurveTo(a * 0.66, -a * 0.84, a * 0.74, a * 0.2, a * 0.34 + w1, tl * 0.46);
  ctx.quadraticCurveTo(a * 0.1 + w1, tl * 0.8, w2, tl);
  ctx.quadraticCurveTo(-a * 0.1 + w1, tl * 0.8, -a * 0.34 + w1, tl * 0.46);
  ctx.bezierCurveTo(-a * 0.74, a * 0.2, -a * 0.66, -a * 0.84, 0, -a * 0.86);
}
function drawGiant(b) {
  const u = VX.ui(b), rw = b.r, sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, c = b.c, hot = VX.hot(c), t = VX.t, L = VX.light;
  for (let n = VX.rate(54); n > 0; n--) {
    const side = Math.random() < 0.5 ? -1 : 1, off = rw * (0.3 + 0.4 * Math.random()), back = rw * (0.1 + 1.2 * Math.random()), out = 30 + 60 * Math.random();
    VX.spark(b.x - uy * side * off - ux * back, b.y + ux * side * off - uy * back, -ux * sp * 0.1 - uy * side * out, -uy * sp * 0.1 + ux * side * out, 0.25 + 0.3 * Math.random(), 1.1 + 1.4 * Math.random(), Math.random() < 0.5 ? hot : c, 0, 2.2, 2);
  }
  const w1 = Math.sin(t * 31 + u.sd * 9) * rw * 0.07, w2 = Math.sin(t * 19 + u.sd * 5) * rw * 0.16, tl = rw * (3.5 + 0.25 * Math.sin(t * 23 + u.sd * 7));
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(ux, -uy));   // 여기부터 앞쪽이 -y
  VX.add();
  VX.glow(0, rw * 0.2, rw * 1.15, c, L ? 0.55 : 0.5, rw * 1.7);
  let g = ctx.createLinearGradient(0, -rw * 0.8, 0, tl);
  g.addColorStop(0, rgba(c, L ? 0.8 : 0.62)); g.addColorStop(0.28, rgba(c, L ? 0.55 : 0.42)); g.addColorStop(0.62, rgba(c, 0.2)); g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g; giantBody(rw, 0.8, tl, w1, w2); ctx.fill();
  const c2 = VX.mix(c, L ? 0.45 : 0.3);
  g = ctx.createLinearGradient(0, -rw * 0.6, 0, tl * 0.62);
  g.addColorStop(0, rgba(c2, 0.9)); g.addColorStop(0.4, rgba(c2, 0.55)); g.addColorStop(1, rgba(c2, 0));
  ctx.fillStyle = g; giantBody(rw, 0.52, tl * 0.62, w1 * 0.7, w2 * 0.5); ctx.fill();
  VX.heat(0, -rw * 0.05, rw * 0.5, c, 0.9, rw * 0.9);
  VX.norm();
  g = ctx.createLinearGradient(0, -rw * 0.5, 0, rw * 1.5);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, 'rgba(255,255,255,.92)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; giantBody(rw, 0.27, rw * 1.5, w1 * 0.5, w2 * 0.3); ctx.fill();
  const fl = 0.75 + 0.25 * Math.sin(t * 47 + u.sd * 20);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, rw * 0.22, rw * 1.02, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); ctx.lineWidth = 2; ctx.strokeStyle = rgba(L ? c : hot, 0.85 * fl); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, rw * 0.7, rw * 1.2, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); ctx.lineWidth = 1.1; ctx.strokeStyle = rgba(c, 0.45 * fl); ctx.stroke();
  ctx.restore();
}
// 산탄포 슬러그탄: 묵직한 금속 탄두와 짧은 잔상
function slugPath(hw, y) {
  ctx.moveTo(-hw, y + 9); ctx.lineTo(-hw, y - 4); ctx.quadraticCurveTo(-hw, y - 11, 0, y - 14.5); ctx.quadraticCurveTo(hw, y - 11, hw, y - 4); ctx.lineTo(hw, y + 9); ctx.closePath();
}
function drawSlug(b, k) {
  const sp = Math.hypot(b.vx, b.vy) || 1, L = VX.light, hw = 6.2 * k, body = L ? '#3d4454' : '#d5dbe6', edge = L ? '#1b2030' : '#ffffff', shade = L ? '#8b94a8' : '#8a93a6';
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vx / sp, -b.vy / sp)); ctx.scale(k, k);
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(b.c, 0.55); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-5.2, 10); ctx.lineTo(-4.2, 40); ctx.moveTo(5.2, 10); ctx.lineTo(4.2, 40); ctx.stroke();   // 속도선
  ctx.strokeStyle = rgba(b.c, 0.3); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, 30); ctx.stroke();
  ctx.fillStyle = rgba(body, 0.16); ctx.beginPath(); slugPath(6.2, 22); ctx.fill();   // 짧은 잔상 두 겹
  ctx.fillStyle = rgba(body, 0.34); ctx.beginPath(); slugPath(6.2, 11); ctx.fill();
  ctx.fillStyle = body; ctx.beginPath(); slugPath(6.2, 0); ctx.fill();               // 탄두
  ctx.lineWidth = 1.3; ctx.strokeStyle = edge; ctx.stroke();
  ctx.fillStyle = b.c; ctx.fillRect(-6.2, 2.5, 12.4, 3.2);                            // 무기 색 띠
  ctx.strokeStyle = shade; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2.6, -8); ctx.lineTo(-2.6, 1); ctx.moveTo(-2.6, 7); ctx.lineTo(-2.6, 8); ctx.stroke();   // 금속 광택
  ctx.strokeStyle = rgba(b.c, 0.75); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -6, 15, -Math.PI / 2 - 0.7, -Math.PI / 2 + 0.7); ctx.stroke();   // 앞머리의 압력 호
  ctx.restore();
}
// 화염 산탄: 머리가 둥글고 뒤로 가늘게 일렁이는 불덩이
function drawFlameShot(b) {
  const F = fireCol(), q = Math.min(1, (b.d0 - b.left) / 150), r = 4.5 + 6.5 * q, sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, ph = b.vx * 0.05 + b.vy * 0.031;
  const bend = Math.sin(VX.t * 26 + ph) * r * 0.55, tl = r * (2.6 + 0.5 * Math.sin(VX.t * 17 + ph * 1.7));
  if (VX.rate(7)) VX.spark(b.x - ux * r, b.y - uy * r, -ux * 30 + (Math.random() - 0.5) * 50, -uy * 30 + (Math.random() - 0.5) * 50, 0.25 + 0.2 * Math.random(), 1 + 0.9 * Math.random(), F.e, -40, 2, 2);
  VX.add(); VX.glow(b.x, b.y, r * 2.6, F.o, VX.light ? 0.42 : 0.5); VX.norm();
  ctx.fillStyle = F.o; ctx.globalAlpha = 0.88; ctx.beginPath(); flameTo(b.x + ux * r * 0.55, b.y + uy * r * 0.55, b.x - ux * tl, b.y - uy * tl, r * 0.72, bend); ctx.fill();
  ctx.fillStyle = F.y; ctx.globalAlpha = 0.95; ctx.beginPath(); flameTo(b.x + ux * r * 0.3, b.y + uy * r * 0.3, b.x - ux * tl * 0.5, b.y - uy * tl * 0.5, r * 0.38, bend * 0.4); ctx.fill();
  ctx.globalAlpha = 1;
}
// 닫힌 경로 도우미: BP 에 든 n개의 점을 둥글게 잇는다
const BP = new Float32Array(128);   // 용 몸통(20점 x 양쪽)까지
function smoothPath(n) {
  const lx = BP[n * 2 - 2], ly = BP[n * 2 - 1];
  ctx.moveTo((lx + BP[0]) / 2, (ly + BP[1]) / 2);
  for (let i = 0; i < n; i++) { const qx = BP[i * 2], qy = BP[i * 2 + 1], j = (i + 1) % n; ctx.quadraticCurveTo(qx, qy, (qx + BP[j * 2]) / 2, (qy + BP[j * 2 + 1]) / 2); }
  ctx.closePath();
}
// 선분 (x0,y0)+(dx,dy)·[a0..a1] 을 따라가는 울퉁불퉁한 띠 (반폭 hw, 굴곡 amp)
function bandTo(x0, y0, dx, dy, nx, ny, hw, sd, amp, a0, a1) {
  const K = 5; let n = 0;
  for (let i = 0; i <= K; i++) { const s = a0 + (a1 - a0) * i / K, w = hw * (1 - amp + 2 * amp * hash(sd + i * 3.7)) * (i === 0 || i === K ? 0.5 : 1); BP[n++] = x0 + dx * s + nx * w; BP[n++] = y0 + dy * s + ny * w; }
  for (let i = K; i >= 0; i--) { const s = a0 + (a1 - a0) * i / K, w = hw * (1 - amp + 2 * amp * hash(sd + 50 + i * 3.7)) * (i === 0 || i === K ? 0.5 : 1); BP[n++] = x0 + dx * s - nx * w; BP[n++] = y0 + dy * s - ny * w; }
  smoothPath(n / 2);
}
// 불바다 (T9a 다시 그림, "여드름 같다"는 평): 바닥에 깔린 이어진 불길 띠(바깥 주황, 가운데 달아오른 심) 위로
// 불꽃 혀가 저마다 다른 때 다른 자리에서 태어나 솟았다 사그라든다(같은 자리에서 혹처럼 솟지 않게). 혀는 붉은 겉불, 주황, 노란 속불 세 겹.
// 위로 흩어지는 불티. 꺼질 때는 혀가 낮아지고 그을음이 남는다
const FL_R = { d: '#e0461c', l: '#d2440f' };
function drawFireStrip(p) {
  const u = VX.ui(p), F = fireCol(), L = VX.light, sd = u.sd * 113, t = VX.t, age = (p.d || 2) - p.t, al = Math.min(1, p.t / 0.5);
  const dx = p.x1 - p.x0, dy = p.y1 - p.y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, hw = p.hw || 18;
  const head = Math.min(1, age / 0.18);     // 탄이 지나간 순서대로 붙는다
  const lit = (s) => { const k = (age - s * 0.18) / 0.22; return k <= 0 ? 0 : k >= 1 ? 1 : 1 - (1 - k) * (1 - k); };
  if (p.t > 0.35 && age > 0.1) for (let n = VX.rate(4); n > 0; n--) {
    const s = Math.random(), off = (Math.random() * 2 - 1) * hw * 0.6;
    VX.spark(p.x0 + dx * s + nx * off, p.y0 + dy * s + ny * off - 14, (Math.random() - 0.5) * 30, -40 - 45 * Math.random(), 0.5 + 0.5 * Math.random(), 0.8 + 0.9 * Math.random(), Math.random() < 0.5 ? F.e : F.y, -26, 0.6, 2);
  }
  ctx.beginPath(); bandTo(p.x0, p.y0, dx, dy, nx, ny, hw * 1.1, sd, 0.18, -0.07, 0.07 + head);   // 바닥의 불규칙한 그을음
  ctx.fillStyle = F.s + ((L ? 0.08 : 0.22) * (0.4 + 0.6 * Math.min(1, age / 0.5))).toFixed(3) + ')'; ctx.fill();
  VX.add();
  for (let i = 0; i < 2; i++) {              // 은은한 불빛 (두 장: 띠가 레인마다 셋까지 겹쳐 그려지므로 넓이를 아낀다)
    const s = 0.28 + 0.44 * i + (hash(sd + i * 11.3) - 0.5) * 0.12, fl = 0.8 + 0.2 * Math.sin(t * (7 + 3 * hash(sd + i)) + i * 2.2 + sd);
    VX.glow(p.x0 + dx * s, p.y0 + dy * s - 8, hw * 1.7 + len * 0.06, F.o, 0.45 * al * lit(s) * fl);
  }
  VX.norm();
  const wob = 0.9 + 0.1 * Math.sin(t * 7 + sd);
  ctx.beginPath(); bandTo(p.x0, p.y0, dx, dy, nx, ny, hw * 0.7 * wob, sd + 7, 0.14, -0.03, 0.03 + head);   // 불바닥
  ctx.fillStyle = rgba(F.o, (L ? 0.5 : 0.45) * al); ctx.fill();
  ctx.beginPath(); bandTo(p.x0, p.y0, dx, dy, nx, ny, hw * 0.3 * (1.1 - 0.1 * wob), sd + 13, 0.3, 0.01, head - 0.01);   // 가운데 달아오른 심 (이어진 한 줄)
  ctx.fillStyle = rgba(F.y, (L ? 0.7 : 0.62) * al); ctx.fill();
  const K = 7, gr = 0.35 + 0.65 * al, R = L ? FL_R.l : FL_R.d, wind = Math.sin(t * 1.3 + sd) * 4;   // 혀는 적고 크게, 바람에 함께 쏠린다
  for (let pass = 0; pass < 3; pass++) {     // 겉불(붉게, 크게) → 주황 → 노란 속불. 겹마다 한 번에 칠한다
    const ks = pass === 0 ? 1.18 : pass === 1 ? 0.92 : 0.5, kw = pass === 0 ? 1.25 : pass === 1 ? 1 : 0.5;
    ctx.beginPath();
    for (let i = 0; i < K; i++) {
      const h1 = hash(sd + i * 2.3), per = 0.48 + 0.4 * h1, tt = t / per + hash(sd + i * 4.9) * 7, cyc = Math.floor(tt), a = tt - cyc;
      if (pass === 2 && a > 0.62) continue;  // 사그라드는 혀는 속불이 먼저 꺼진다
      const r1 = hash(sd + i * 7.3 + cyc * 1.91), r2 = hash(sd + i * 3.1 + cyc * 2.77), r3 = hash(sd + i * 5.3 + cyc * 3.13);
      const s = (i + 0.5 + (r1 - 0.5) * 1.6) / K, k = lit(Math.min(1, Math.max(0, s))); if (k <= 0) continue;
      const env = Math.sin(Math.PI * Math.min(1, a * 1.12)); if (env < 0.06) continue;   // 솟았다 사그라든다
      const off = (r2 - 0.5) * 2 * hw * 0.42, bx = p.x0 + dx * s + nx * off, by = p.y0 + dy * s + ny * off + 4 - a * (6 + 8 * r3);
      const hgt = (26 + 26 * r3) * Math.pow(env, 0.6) * k * gr * (0.9 + 0.1 * Math.sin(t * 19 + i * 2.7)) * ks;
      const wid = (7 + 4 * r2) * (1 - 0.35 * a) * (0.6 + 0.4 * k) * kw, lean = wind + (r1 - 0.5) * 6 + Math.sin(t * (3 + 2 * h1) + i * 1.7) * 3;
      flameTo(bx, by, bx + lean * (pass === 2 ? 0.45 : 1), by - hgt, wid, lean * (pass === 2 ? 0.4 : 0.85));
    }
    ctx.fillStyle = pass === 0 ? rgba(R, (L ? 0.62 : 0.55) * al) : pass === 1 ? rgba(F.o, 0.88 * al) : rgba(F.y, 0.95 * al); ctx.fill();
  }
}
// 잔광: 숨 쉬듯 밝기가 변하는 부드러운 빛 띠와, 띠를 따라 천천히 도는 빛 알갱이
function drawHalo(p) {
  const u = VX.ui(p), t = VX.t; if (u.n) u.born = t;
  const al = Math.min(1, p.t / 0.5) * VX.ease((t - u.born - 0.1) / 0.4, 2);   // 충격파가 지나간 뒤에 떠오른다 (큰 고리가 갑자기 생기지 않게)
  if (al <= 0) return;
  const sd = (p.sd || 0) * 61, c = p.c, br = 0.7 + 0.3 * Math.sin(t * 4.4 + sd), hot = VX.hot(c);
  VX.add();
  VX.wave(p.x, p.y, p.r * 0.985, c, 0.13 * al, 0, true);
  VX.wave(p.x, p.y, p.r * 1.015, c, (VX.light ? 0.62 : 0.55) * al * br, 1, true);
  ctx.fillStyle = hot; ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const h1 = hash(sd + i * 3.3), h2 = hash(sd + i * 7.9), a = Math.PI + ((h1 * Math.PI + (i % 2 ? 1 : -1) * t * (0.1 + 0.2 * h2)) % Math.PI + Math.PI) % Math.PI;
    const edge = Math.min(1, Math.min(a - Math.PI, TAU - a) * 6), tk = (0.5 + 0.5 * Math.sin(t * (4 + 4 * h2) + i * 2.1)) * edge, rr = p.r * (0.955 + 0.06 * h2);
    const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr;
    VX.glow(x, y, 6 + 5 * tk, c, 0.9 * al * tk);
    ctx.moveTo(x + 2.2, y); ctx.arc(x, y, 0.9 + 1.3 * tk, 0, TAU);
  }
  ctx.globalAlpha = al; ctx.fill(); ctx.globalAlpha = 1;
  VX.norm();
}
const RBHEX = {};
function rainbowHex(rb) {                    // 무지개: 줄마다 다른 색 (밝은 테마에서는 짙게)
  const key = rb + (VX.light ? 'l' : 'd'); let v = RBHEX[key]; if (v) return v;
  const h = (rb * 47) % 360, s = 0.95, l = VX.light ? 0.46 : 0.62, a = s * Math.min(l, 1 - l);
  const ch = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); };
  return (RBHEX[key] = '#' + ch(0) + ch(8) + ch(4));
}
// 밝은 테마에서는 하얀 계열 효과가 종이에 묻히므로 짙게 바꾼다
function seenCol(c) {
  if (!VX.light) return c;
  const n = parseInt(c.slice(1), 16), lum = ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255;
  return lum > 0.86 ? VX.mix(c, -0.38) : c;
}
// 달아오른 점: 어두운 테마는 가운데가 하얀 빛, 밝은 테마는 하얀색이 종이에 묻히므로 가운데가 짙은 빛
function hotSpot(x, y, r, col, a) {
  if (!VX.light) { VX.heat(x, y, r, col, a); return; }
  VX.glow(x, y, r, col, a); VX.glow(x, y, r * 0.55, VX.mix(col, -0.3), a);
}
// 일반 폭발: 가운데가 번쩍하고, 가장자리만 밝은 충격파가 빠르게 퍼지다 느려지며 옅어진다. 지뢰(f.mine)는 파편과 불티가 더 튄다
function drawBoom(f, p) {
  const q = 1 - p, u = VX.ui(f), R = f.r, col = seenCol(f.c), e = VX.ease(q, 3), hot = VX.hot(col);
  if (u.n) {
    if (f.mine) {
      const F = fireCol(), n = f.mine === 1 ? 9 : 5;
      for (let i = 0; i < n; i++) {             // 파편: 빠르게 뻗는 빛줄기
        const a = (i + Math.random()) / n * TAU, s = R * (3.2 + 2.6 * Math.random());
        VX.spark(f.x + Math.cos(a) * 4, f.y + Math.sin(a) * 4, Math.cos(a) * s, Math.sin(a) * s, 0.16 + 0.14 * Math.random(), 1.7, hot, 0, 5, 1);
      }
      for (let i = 0; i < n; i++) {             // 불티: 튀어 올랐다가 떨어진다
        const a = Math.random() * TAU, s = R * (0.8 + 1.8 * Math.random());
        VX.spark(f.x, f.y, Math.cos(a) * s, Math.sin(a) * s - 60, 0.4 + 0.45 * Math.random(), 1.1 + 1.2 * Math.random(), i % 2 ? F.e : F.y, 220, 2.6, 2);
      }
    } else if (R >= 34) {
      const v0 = R * 0.9 * 3 / Math.max(0.15, f.d);
      for (let i = 0; i < 4; i++) {
        const a = (i + Math.random()) / 4 * TAU, k = 0.8 + 0.3 * Math.random();
        VX.spark(f.x + Math.cos(a) * R * 0.15, f.y + Math.sin(a) * R * 0.15, Math.cos(a) * v0, Math.sin(a) * v0, f.d * (0.9 + 0.8 * Math.random()), 1 + Math.random(), hot, 0, 3 / (f.d * k), 2);
      }
    }
  }
  VX.add();
  VX.glow(f.x, f.y, R * (0.5 + 0.45 * e), col, (VX.light ? 0.75 : 0.6) * p);
  if (!f.lt) hotSpot(f.x, f.y, R * (0.26 + 0.2 * e), col, p * p);   // lt: 작은 폭발 (박격포 융단 폭격, 분리 탄두)
  const fd = VX.fade(q), rr = R * (0.3 + 0.7 * e);
  VX.wave(f.x, f.y, rr / 0.95, col, 0.8 * fd, f.lt ? (q < 0.5 ? 0.5 : 1) : 0.35 + 0.65 * q);   // 작은 폭발은 얇기를 두 단계로 (빛 번짐 한 장)
  VX.norm();
  if (f.mine) {                               // 늦게 따라오는 옅은 물결
    const u2 = (q - 0.3) / 0.7;
    if (u2 > 0) { VX.add(); VX.wave(f.x, f.y, R * (0.2 + 0.62 * VX.ease(u2, 2)), col, 0.45 * VX.fade(u2), 1); VX.norm(); }
  }
}
/* ---------- 박격포: 포탄, 미사일, 떨어지는 폭탄, 연기, 핵탄두, 공습 예고선 ---------- */
// 연기 알갱이: 미사일 꼬리와 버섯구름. 화면 전용 (게임 시간 기준). 그릴 때는 투명도 네 단계로 묶어 경로 네 번만 채운다
const PUFF = [], PUFF_MAX = 130, PUFF_FREE = [];
let puffT = -1;
function puff(x, y, r, vx, vy, life, grow) {
  if (PUFF.length >= PUFF_MAX || RM.matches) return;
  const o = PUFF_FREE.pop() || {};
  o.x = x; o.y = y; o.r = r; o.vx = vx; o.vy = vy; o.t = o.d = life; o.g = grow;
  PUFF.push(o);
}
function stepPuffs() {
  const t = C.S.t;
  if (t < puffT) PUFF.length = 0;            // 새 게임
  const dt = puffT < 0 ? 0 : Math.min(0.1, Math.max(0, t - puffT)); puffT = t;
  if (!dt) return;
  for (let i = PUFF.length - 1; i >= 0; i--) {
    const o = PUFF[i]; o.t -= dt;
    if (o.t <= 0) { PUFF_FREE.push(o); PUFF[i] = PUFF[PUFF.length - 1]; PUFF.pop(); continue; }
    const k = Math.max(0, 1 - 2.2 * dt); o.vx *= k; o.vy *= k; o.x += o.vx * dt; o.y += o.vy * dt; o.r += o.g * dt;
  }
}
function drawPuffs() {
  if (!PUFF.length) return;
  const sm = VX.light ? '96,88,80' : '150,156,170', base = VX.light ? 0.05 : 0.045;
  for (let b = 0; b < 4; b++) {                // 오래될수록 옅다 (투명도 네 단계). 겉테(1.45배, 옅게)를 먼저 깔고 속을 겹쳐 가장자리가 흐리다
    for (const halo of [1, 0]) {
      ctx.beginPath(); let any = false;
      for (const o of PUFF) {
        const p = o.t / o.d, bb = p > 0.75 ? 3 : p > 0.5 ? 2 : p > 0.25 ? 1 : 0; if (bb !== b) continue;
        const r = halo ? o.r * 1.45 : o.r; ctx.moveTo(o.x + r, o.y); ctx.arc(o.x, o.y, r, 0, TAU); any = true;
      }
      if (any) { ctx.fillStyle = `rgba(${sm},${(base * (b + 1) * (halo ? 0.45 : 1)).toFixed(3)})`; ctx.fill(); }
    }
  }
}
const SHP = [0, 0], SHQ = [0, 0];
function drawShells() {
  const S = C.S, L = VX.light;
  stepPuffs(); drawPuffs();
  for (const s of S.shells) {
    if (s.wt > 0 || s.dead) continue;        // 아직 떨어지기 전인 폭탄
    if (s.ms) { drawMissile(s); continue; }
    if (s.drop) { drawDrop(s); continue; }
    const x = s.x0 + (s.tx - s.x0) * s.p, gy = s.y0 + (s.ty - s.y0) * s.p, hgt = Math.sin(s.p * Math.PI);
    const y = gy - hgt * (s.acid ? 60 : 70), big = s.nuke ? 1 : 0;
    ctx.beginPath(); ctx.ellipse(x, gy, (big ? 15 : 9) - 3 * hgt, ((big ? 15 : 9) - 3 * hgt) * 0.5, 0, 0, Math.PI * 2);
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
    const col = seenCol(s.st.color);
    if (big) { drawNukeShell(s, x, y, col); continue; }
    const sz = (s.cb ? 6 : 7) * (s.st.evo ? 1.2 : 1);
    ctx.beginPath(); ctx.arc(s.tx, s.ty, s.cb ? 8 : 10, 0, Math.PI * 2); ctx.strokeStyle = rgba(col, s.cb ? 0.35 : 0.5); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    if (s.st.evo) { ctx.lineWidth = 2; ctx.strokeStyle = L ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.8)'; ctx.stroke(); }
  }
}
// 핵탄두 포탄: 크고 하얗게 달아오른 탄. 지나간 자리에 옅은 열기와 연기, 떨어질 자리는 땅이 서서히 밝아진다 (선 없이)
function drawNukeShell(s, x, y, col) {
  const u = VX.ui(s), L = VX.light, R = s.R || s.st.blast, k = s.p;
  VX.add();
  VX.glow(s.tx, s.ty, R * (0.35 + 0.55 * k), col, (L ? 0.22 : 0.16) * k * k, R * (0.2 + 0.32 * k));   // 떨어질 자리 (납작하게)
  VX.glow(x, y, 26, col, L ? 0.55 : 0.7);
  VX.norm();
  if (u.lx != null && Math.random() < 0.8) puff(u.lx + (Math.random() - 0.5) * 4, u.ly, 2.2 + Math.random() * 1.6, (Math.random() - 0.5) * 14, -8, 0.4 + Math.random() * 0.25, 10);
  u.lx = x; u.ly = y;
  const r = 12.5 * (s.st.evo ? 1.1 : 1);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = L ? VX.mix(col, 0.82) : '#ffffff'; ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = L ? VX.mix(col, -0.2) : rgba(col, 0.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.34, r * 0.3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
}
// 미사일: 곡선을 따라 표적을 쫓는다. 몸통은 나아가는 쪽을 보고, 꽁무니에 불꽃이 깜빡이며 연기 꼬리를 남긴다
function drawMissile(s) {
  const u = VX.ui(s), L = VX.light, col = seenCol(s.st.color), F = fireCol(), mini = s.mini, nk = s.nuke;
  C.shellPos(s, s.p, SHP); C.shellPos(s, Math.max(0, s.p - 0.03), SHQ);
  let dx = SHP[0] - SHQ[0], dy = SHP[1] - SHQ[1]; const ln = Math.hypot(dx, dy) || 1; dx /= ln; dy /= ln;
  if (s.p < 0.02) { dx = s.side * 0.25; dy = -1; }
  const len = mini ? 9 : nk ? 21 : 15, wd = mini ? 2.6 : nk ? 6.5 : 4.4, x = SHP[0], y = SHP[1], nx = -dy, ny = dx;
  const bx = x - dx * len * 0.55, by = y - dy * len * 0.55;   // 꽁무니
  // 연기 꼬리: 지나온 거리만큼 알갱이를 떨군다 (흐트러진 크기와 퍼짐)
  if (u.lx != null) {
    const gap = mini ? 8 : 5, dist = Math.hypot(bx - u.lx, by - u.ly), n = Math.min(4, Math.floor((u.acc = (u.acc || 0) + dist) / gap));
    for (let i = 0; i < n; i++) {
      const v = (i + 1) / n, px = u.lx + (bx - u.lx) * v, py = u.ly + (by - u.ly) * v, sp = 10 + Math.random() * 14;
      puff(px + (Math.random() - 0.5) * 3, py + (Math.random() - 0.5) * 3, (mini ? 1.1 : nk ? 2.6 : 1.7) + Math.random() * 1.1, nx * sp * (Math.random() - 0.5) * 2, ny * sp * (Math.random() - 0.5) * 2 - 6, (mini ? 0.32 : 0.5) + Math.random() * 0.25, mini ? 7 : 10);
    }
    u.acc -= n * gap;
  }
  u.lx = bx; u.ly = by;
  // 꽁무니 불꽃
  const fl = (0.75 + 0.25 * Math.sin(VX.t * 60 + u.sd * 30)) * (mini ? 5 : nk ? 11 : 8);
  VX.add();
  if (!mini) VX.glow(bx, by, nk ? 22 : 14, F.o, L ? 0.45 : 0.6);
  ctx.beginPath(); ctx.moveTo(bx + nx * wd * 0.6, by + ny * wd * 0.6); ctx.lineTo(bx - dx * fl, by - dy * fl); ctx.lineTo(bx - nx * wd * 0.6, by - ny * wd * 0.6); ctx.closePath();
  ctx.fillStyle = rgba(F.y, 0.9); ctx.fill();
  VX.norm();
  // 몸통과 날개
  const tx = x + dx * len * 0.45, ty = y + dy * len * 0.45, body = nk ? (L ? VX.mix(col, 0.8) : '#ffffff') : L ? VX.mix(col, -0.15) : col;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(x + nx * wd * 0.5 + dx * len * 0.1, y + ny * wd * 0.5 + dy * len * 0.1);
  ctx.lineTo(bx + nx * wd * 0.5, by + ny * wd * 0.5);
  ctx.lineTo(bx + nx * wd * 1.15 - dx * 2, by + ny * wd * 1.15 - dy * 2);
  ctx.lineTo(bx - nx * wd * 1.15 - dx * 2, by - ny * wd * 1.15 - dy * 2);
  ctx.lineTo(bx - nx * wd * 0.5, by - ny * wd * 0.5);
  ctx.lineTo(x - nx * wd * 0.5 + dx * len * 0.1, y - ny * wd * 0.5 + dy * len * 0.1);
  ctx.closePath(); ctx.fillStyle = body; ctx.fill();
  ctx.lineWidth = mini ? 1 : 1.4; ctx.strokeStyle = L ? VX.mix(col, -0.45) : rgba('#ffffff', nk ? 0.95 : 0.7); ctx.stroke();
  if (!mini) { ctx.beginPath(); ctx.arc(tx - dx * 2, ty - dy * 2, nk ? 2.6 : 1.8, 0, TAU); ctx.fillStyle = L ? VX.mix(col, -0.4) : '#ffffff'; ctx.fill(); }   // 탄두 끝
  if (nk) { VX.add(); VX.glow(x, y, 24, col, L ? 0.4 : 0.55); VX.norm(); }
}
// 떨어지는 폭탄 (융단 폭격의 뒤따르는 폭탄, 공습): 위에서 빨라지며 떨어진다. 떨어질 자리의 그림자가 짙어진다. 공습 폭탄은 폭격기 높이에서 옆으로 누운 채 떨어지며 머리를 숙인다
function drawDrop(s) {
  const L = VX.light, col = seenCol(s.st.color), k = s.p * s.p, x = s.tx, y = s.y0 + (s.ty - s.y0) * k, F = fireCol();
  const r0 = s.air ? 12 : 8;
  ctx.beginPath(); ctx.ellipse(x, s.ty, r0 * (0.4 + 0.6 * s.p), r0 * 0.45 * (0.4 + 0.6 * s.p), 0, 0, TAU); ctx.fillStyle = `rgba(30,30,40,${0.08 + 0.22 * s.p})`; ctx.fill();
  const sl = (s.air ? 12 : 22) + 30 * s.p;    // 낙하 줄기 (속도가 붙을수록 길다)
  const g = ctx.createLinearGradient(0, y - sl, 0, y);
  g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(L ? VX.mix(col, -0.2) : col, L ? 0.55 : 0.45));
  ctx.fillStyle = g; ctx.fillRect(x - 1.6, y - sl, 3.2, sl);
  if (s.air) {
    const ang = Math.PI / 2 * Math.min(1, s.p * 1.5);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 4.4, 0, 0, TAU); ctx.fillStyle = L ? VX.mix(col, -0.3) : col; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-11, -5.5); ctx.lineTo(-11, 5.5); ctx.lineTo(-6, 2); ctx.fillStyle = L ? VX.mix(col, -0.5) : VX.hot(col); ctx.fill();
    if (!L) { ctx.beginPath(); ctx.arc(3, -1.3, 1.5, 0, TAU); ctx.fillStyle = rgba(F.y, 0.9); ctx.fill(); }
    ctx.restore();
    return;
  }
  const w = 3.8, h = 6.2;
  ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, TAU); ctx.fillStyle = L ? VX.mix(col, -0.25) : col; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - w * 1.1, y - h - 3); ctx.lineTo(x, y - h * 0.4); ctx.lineTo(x + w * 1.1, y - h - 3); ctx.lineWidth = 1.6; ctx.strokeStyle = L ? VX.mix(col, -0.45) : VX.hot(col); ctx.stroke();
  if (!L) { ctx.beginPath(); ctx.arc(x - 1.2, y + 1.5, 1.5, 0, TAU); ctx.fillStyle = rgba(F.y, 0.9); ctx.fill(); }
}
// 핵탄두 폭발: 하얀 섬광 → 불덩이가 부풀며 식고, 부드러운 폭풍이 퍼진다. 충격파(s2)는 한 박자 늦게 두 배 거리까지 얇게 번진다.
// 처음 볼 때 불티를 뿌린다. 버섯구름은 연기 기둥과 갓(가장자리가 흐린 번짐)이 피어올라 부풀며 옅어진다. 자리와 크기는 폭발마다 조금씩 다르다
function drawNuke(f) {
  const u = VX.ui(f), T = f.d - f.t, R = f.r, col = seenCol(f.c), L = VX.light, F = fireCol(), hot = VX.hot(col);
  if (u.n) {
    for (let i = 0; i < 18; i++) {          // 불티: 사방으로 튀었다가 떨어진다
      const a = Math.random() * TAU, sp = R * (1.4 + 2.2 * Math.random());
      VX.spark(f.x + Math.cos(a) * R * 0.15, f.y + Math.sin(a) * R * 0.15, Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - 40, 0.5 + 0.6 * Math.random(), 1.3 + 1.5 * Math.random(), i % 3 ? F.e : L ? F.o : hot, 160, 2.2, 2);
    }
    for (let i = 0; i < 7; i++) {            // 빠른 빛줄기
      const a = (i + Math.random()) / 7 * TAU, sp = R * (5 + 3 * Math.random());
      VX.spark(f.x, f.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.14 + 0.1 * Math.random(), 1.9, L ? F.o : hot, 0, 6, 1);
    }
    if (f.s2) for (let i = 0; i < 12; i++) {  // 충격파가 일으키는 먼지 고리
      const a = (i + Math.random() * 0.8) / 12 * TAU, sp = f.s2 * (1.8 + 0.6 * Math.random());
      puff(f.x + Math.cos(a) * R, f.y + Math.sin(a) * R * 0.8, 2.5 + 2 * Math.random(), Math.cos(a) * sp, Math.sin(a) * sp * 0.8, 0.5 + 0.3 * Math.random(), 14);
    }
  }
  // 빛 번짐 장 수를 아낀다 (겹치는 때에 많아야 7장): 섬광, 불덩이(밝은 테마는 두 장), 폭풍, 충격파, 구름 기둥, 갓
  VX.add();
  if (T < 0.3) { const k = 1 - T / 0.3; VX.heat(f.x, f.y, R * (0.5 + 0.4 * (1 - k)), L ? F.y : '#ffffff', Math.min(1, 1.4 * k)); }   // 섬광
  if (T < 1) {                                // 불덩이: 하얗게 달아오른 속이 부풀며 짙은 주황으로 식는다
    const k = 1 - T, rr = R * (0.55 + 0.6 * VX.ease(T / 0.55)), fy = f.y - R * 0.2 * T;
    if (L) { VX.glow(f.x, fy, rr, F.o, 0.95 * k * Math.sqrt(k)); VX.glow(f.x, fy, rr * 0.5, VX.mix(F.o, -0.2), 0.9 * k * k); }
    else VX.heat(f.x, fy, rr, F.o, 0.95 * k * Math.sqrt(k));
  }
  if (T < 0.55) { const u2 = T / 0.55; VX.wave(f.x, f.y, R * (0.25 + 0.9 * VX.ease(u2, 3)), L ? VX.mix(col, -0.15) : col, VX.fade(u2), u2 < 0.35 ? 0.5 : 1); }   // 폭풍 (얇기 두 단계: 큰 번짐은 한 장만)
  if (f.s2 && T > 0.06 && T < 0.75) { const u2 = (T - 0.06) / 0.69; VX.wave(f.x, f.y, f.s2 * (0.45 + 0.6 * VX.ease(u2, 2.4)), L ? VX.mix(col, -0.3) : hot, 0.85 * VX.fade(u2), 1); }   // 충격파 (얇은 한 장)
  VX.norm();
  if (T > 0.12) {                             // 버섯구름: 기둥이 솟고 갓이 부풀며 옆으로 번진다. 갓 밑은 한동안 불빛에 달아 있다. 자리와 크기는 폭발마다 조금씩 다르다
    const sd = u.sd * 17, j1 = (hash(sd) - 0.5) * R * 0.24, sk = 0.85 + 0.3 * hash(sd + 7.7);
    const k = VX.ease((T - 0.12) / 1.1, 2), a = Math.min(1, (T - 0.12) / 0.25) * Math.max(0, 1 - Math.max(0, T - 0.75) / 0.55), sm = L ? '#6e5c4f' : '#a8a2a4';
    const top = f.y - R * (0.45 + 1.0 * k) * sk, cx = f.x + j1 * k, cw = R * (0.42 + 0.42 * k) * sk, ch = R * (0.21 + 0.17 * k);
    VX.pillar(f.x + j1 * 0.5 * k, top - R * 0.05, f.y + R * 0.2, R * (0.2 + 0.12 * k), sm, (L ? 0.75 : 0.62) * a);
    const capW = cw * 2.3, capH = capW * CLOUD_H / CLOUD_W;   // 갓: 연기 색 구름 그림 (밑면이 기둥 끝에 걸린다)
    ctx.globalAlpha = (L ? 0.88 : 0.8) * a; ctx.drawImage(cloudSpr(Math.floor(u.sd * 3), L, 1), cx - capW / 2, top + ch * 0.45 - capH * CLOUD_B / CLOUD_H, capW, capH); ctx.globalAlpha = 1;
    if (T < 1.05) { VX.add(); VX.glow(cx, top + ch * 0.35, cw * 0.75, F.o, (L ? 0.5 : 0.55) * a * (1 - T / 1.05), ch * 0.6); VX.norm(); }
  }
}
// 공습 폭격기 (위에서 내려다본 모양, 오른쪽으로 난다): 몸통, 뒤로 젖힌 날개, 꼬리날개. sy: 세로 눌림 (원근)
const BOMBER = [[38, 0], [31, -3.6], [10, -4.8], [-9, -34], [-19, -34], [-9, -4.8], [-29, -3.6], [-34, -13], [-41, -13], [-39, -2.6], [-42, 0]];
function bomberPath(x, y, sy) {
  ctx.beginPath();
  for (let i = 0; i < BOMBER.length; i++) { const q = BOMBER[i]; if (i) ctx.lineTo(x + q[0], y + q[1] * sy); else ctx.moveTo(x + q[0], y + q[1] * sy); }
  for (let i = BOMBER.length - 2; i > 0; i--) { const q = BOMBER[i]; ctx.lineTo(x + q[0], y - q[1] * sy); }
  ctx.closePath();
}
// 공습 (T10a): 폭격기가 지날 길(땅 위, 표적들 위를 완만하게 휘어 감)이 왼쪽부터 번지며 깜빡이고, 표적마다 표시가 차례로 맺힌다 (0.8초).
// 폭격기가 왼쪽에서 날아와 길을 따라 기울며 지나가고, 표적 위를 지날 때 폭탄을 떨어뜨린다 (땅에는 그림자). 폭탄이 닿은 표적의 표시는 벌어지며 사라진다
function drawAirWarn(f) {
  if (!f.g || !f.pt) return;
  const u = VX.ui(f), T = f.d - f.t, Wd = C.W, LW = C.LW, g = f.g, pt = f.pt, col = seenCol(f.c), L = VX.light, w = f.w, sd = u.sd * 53, G = C.AIR_GAP;
  let end = 0; for (const q of pt) end = Math.max(end, q[2]);
  const sweep = Math.min(1, T / 0.3), out = T > end ? Math.max(0, 1 - (T - end) / 0.3) : 1, blink = 0.72 + 0.28 * Math.sin(T * 26);
  const a = Math.min(1, T / 0.12) * out * blink, lc = L ? VX.mix(col, -0.3) : VX.hot(col), gy = (x) => C.airTrack(g, x);
  VX.add();
  VX.glow(Wd * sweep / 2, gy(Wd * sweep / 2), Wd * sweep * 0.55 + 10, col, 0.36 * a, 10);
  VX.norm();
  ctx.lineCap = 'round'; ctx.lineWidth = 1.8; ctx.strokeStyle = rgba(lc, 0.8 * a);
  ctx.beginPath();
  for (let i = 0, n = 30; i <= n; i++) {     // 폭격기가 지날 길: 살짝 일렁이는 선
    const x = Wd * sweep * i / n, yy = gy(x) + Math.sin(i * 1.3 + T * 9 + sd) * 1.2;
    if (i) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
  }
  ctx.stroke();
  ctx.lineWidth = 1.7; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.3) : col, 0.9);
  for (let j = 0; j < pt.length; j++) {      // 표적 표시: 왼쪽부터 차례로 맺히고, 폭탄이 닿으면 벌어지며 사라진다. 크기가 조금씩 다르다
    const q = pt[j], tj = T - 0.08 - j * 0.09, hit = q[2]; if (tj <= 0 || T > hit + 0.08) continue;
    const k = Math.min(1, tj / 0.18), x = q[0], y = q[1], s0 = 7 + 3 * hash(sd + j * 1.9);
    const sz = s0 * (1.6 - 0.6 * VX.ease(k)) * (T > hit ? 1 + (T - hit) * 6 : 1), al = k * (T > hit ? 1 - (T - hit) / 0.08 : 0.75 + 0.25 * blink);
    if (al < 0.03) continue;
    ctx.globalAlpha = al; ctx.beginPath();
    ctx.moveTo(x - sz, y - sz * 0.9); ctx.lineTo(x, y - sz * 0.25); ctx.lineTo(x + sz, y - sz * 0.9);
    ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  const xb = 0.5 * LW + (T - w) * LW / G;     // 폭격기: x 가 표적 x 를 지나는 때가 그 폭탄을 떨어뜨리는 때 (core 의 airStrike 와 같은 식)
  if (xb < -60 || xb > Wd + 60) return;
  const y0 = gy(xb), ang = Math.atan2(gy(xb + 4) - gy(xb - 4), 8), yb = y0 - C.AIR_ALT, wob = Math.sin(T * 7 + sd) * 1.2;
  ctx.save(); ctx.translate(xb, y0 + 3); ctx.rotate(ang);
  bomberPath(0, 0, 0.42);                    // 땅의 그림자
  ctx.fillStyle = L ? 'rgba(30,34,46,.2)' : 'rgba(0,0,0,.34)'; ctx.fill();
  ctx.restore();
  const tl = Math.min(240, xb + 60);          // 날개 끝의 비행운: 지나온 길을 따라 뒤로 길게 옅어진다
  if (tl > 4) {
    const gr = ctx.createLinearGradient(xb - 14, 0, xb - 14 - tl, 0), tc = L ? '120,128,145' : '210,218,235';
    gr.addColorStop(0, `rgba(${tc},${L ? 0.55 : 0.45})`); gr.addColorStop(1, `rgba(${tc},0)`);
    ctx.strokeStyle = gr; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
    for (const sg of [-1, 1]) {
      for (let i = 0, n = 8; i <= n; i++) {
        const x = xb - 14 - tl * i / n, ey = gy(x) - C.AIR_ALT + wob + sg * (30 * 0.55 + 2 * i / n);
        if (i) ctx.lineTo(x, ey); else ctx.moveTo(x, ey);
      }
    }
    ctx.stroke(); ctx.lineCap = 'butt';
  }
  ctx.save(); ctx.translate(xb, yb + wob); ctx.rotate(ang);
  bomberPath(0, 0, 0.55);
  ctx.fillStyle = L ? '#596173' : '#a3abbf'; ctx.fill();
  ctx.lineWidth = 1.3; ctx.strokeStyle = L ? '#373d4b' : 'rgba(230,236,248,.85)'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(-34, 0); ctx.lineWidth = 2.2; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.2) : col, 0.9); ctx.stroke();   // 등줄기 (무기 색)
  ctx.restore();
  VX.add();
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (const sg of [-1, 1]) { const lx = -6, ly = sg * 17 * 0.55; VX.glow(xb + lx * ca - ly * sa, yb + wob + lx * sa + ly * ca, 7, fireCol().o, L ? 0.55 : 0.7); }   // 엔진 불빛
  VX.norm();
}
// 공습 폭발: 일반 포탄보다 크고, 속이 하얗게 달아오른 뒤 불기둥이 위로 솟았다가 사그라든다. 불티와 연기가 오른다
function drawAirBoom(f) {
  const u = VX.ui(f), T = f.d - f.t, R = f.r * 1.2, L = VX.light, F = fireCol(), col = seenCol(f.c), sd = u.sd * 29;
  if (u.n) {
    for (let i = 0; i < 9; i++) {             // 튀어 오르는 불티
      const a = Math.PI * (1.1 + 0.8 * Math.random()), sp = R * (1.5 + 2 * Math.random());
      VX.spark(f.x + (Math.random() - 0.5) * R * 0.4, f.y, Math.cos(a) * sp, Math.sin(a) * sp - 60, 0.5 + 0.5 * Math.random(), 1.2 + 1.4 * Math.random(), i % 2 ? F.e : F.y, 320, 1.5, 2);
    }
    for (let i = 0; i < 5; i++) { const a = (i + Math.random()) / 5 * TAU, sp = R * (5 + 2 * Math.random()); VX.spark(f.x, f.y, Math.cos(a) * sp, Math.sin(a) * sp * 0.7, 0.12 + 0.08 * Math.random(), 1.8, L ? F.o : '#ffffff', 0, 6, 1); }
    for (let i = 0; i < 2; i++) puff(f.x + (Math.random() - 0.5) * R * 0.4, f.y - R * (0.7 + 0.7 * i), 4 + 2 * Math.random(), (Math.random() - 0.5) * 16, -60 - 30 * Math.random(), 0.9 + 0.4 * Math.random(), 22);
  }
  VX.add();
  if (T < 0.32) { const k = 1 - T / 0.32; if (L) { VX.glow(f.x, f.y, R * (0.5 + 0.3 * (1 - k)), F.o, k); VX.glow(f.x, f.y, R * 0.3, F.y, k); } else VX.heat(f.x, f.y, R * (0.45 + 0.3 * (1 - k)), F.y, Math.min(1, 1.3 * k)); }   // 하얗게 달아오른 속
  if (T < 0.55) { const k = 1 - T / 0.55; VX.glow(f.x, f.y, R * (0.6 + 0.45 * VX.ease(T / 0.3)), F.o, (L ? 0.85 : 0.7) * k * k); }   // 불덩이
  if (T < 0.38) { const u2 = T / 0.38; VX.wave(f.x, f.y, R * (0.3 + 0.8 * VX.ease(u2, 3)), L ? VX.mix(col, -0.15) : col, 0.9 * VX.fade(u2), u2 < 0.4 ? 0.5 : 1); }   // 폭풍
  if (T > 0.02) {                             // 불기둥: 빠르게 솟았다가 가늘어지며 사그라든다 (높이와 기울기는 폭발마다 다르다)
    const v = (T - 0.02) / (f.d - 0.02), h = R * (1.3 + 0.8 * hash(sd)) * VX.ease(Math.min(1, v / 0.35), 3), hw = R * (0.3 - 0.12 * v), sx = (hash(sd + 3) - 0.5) * R * 0.3 * v;
    const pa = (1 - v) * Math.min(1, v * 12 + 0.3);
    VX.pillar(f.x + sx, f.y - h, f.y + R * 0.4, hw * 1.5, F.o, (L ? 0.9 : 0.85) * pa);
    VX.pillar(f.x + sx * 0.6, f.y - h * 0.7, f.y + R * 0.25, hw * 0.6, L ? VX.mix(F.o, -0.15) : F.y, (L ? 0.7 : 0.8) * pa * (1 - v));
  }
  VX.norm();
}
// 공습 그을음: 가로로 번진 검은 자국이 폭탄 줄을 따라 한동안 남는다 (이웃 자국과 이어진다). 처음에는 불씨가 남아 깜빡인다
function drawScorch(f, p) {
  const u = VX.ui(f), L = VX.light, R = f.r / 0.75, sd = u.sd * 31, a = Math.min(1, p / 0.4) * Math.min(1, (1 - p) * 14), age = f.d * (1 - p);
  ctx.beginPath(); ctx.ellipse(f.x, f.y, R * 0.75, R * 0.3, 0, 0, TAU);
  for (let i = 0; i < 4; i++) {
    const sg = i < 2 ? -1 : 1, ox = sg * R * (0.45 + 0.45 * hash(sd + i)), oy = (hash(sd + i * 3.1) - 0.5) * R * 0.18, rx = R * (0.3 + 0.22 * hash(sd + i * 7.7));
    ctx.moveTo(f.x + ox + rx, f.y + oy); ctx.ellipse(f.x + ox, f.y + oy, rx, rx * 0.34, 0, 0, TAU);
  }
  ctx.fillStyle = L ? `rgba(58,40,28,${(0.2 * a).toFixed(3)})` : `rgba(0,0,0,${(0.3 * a).toFixed(3)})`; ctx.fill();
  ctx.beginPath(); ctx.ellipse(f.x + (hash(sd + 9) - 0.5) * 6, f.y, R * 0.42, R * 0.16, 0, 0, TAU);
  ctx.fillStyle = L ? `rgba(50,32,22,${(0.22 * a).toFixed(3)})` : `rgba(0,0,0,${(0.3 * a).toFixed(3)})`; ctx.fill();
  if (age < 1.3) {                            // 불씨
    const F = fireCol(), k = 1 - age / 1.3; ctx.fillStyle = L ? F.o : F.e; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const ex = f.x + (hash(sd + i * 5.3) - 0.5) * R * 1.3, ey = f.y + (hash(sd + i * 2.9) - 0.5) * R * 0.4, tw = 0.5 + 0.5 * Math.sin(VX.t * 11 + i * 2.3); ctx.moveTo(ex + 1.6, ey); ctx.arc(ex, ey, 0.6 + 1.1 * tw * k, 0, TAU); }
    ctx.globalAlpha = 0.9 * k; ctx.fill(); ctx.globalAlpha = 1;
  }
}
// 고리: 가장자리만 밝은 물결이 퍼지며 얇아지고 옅어진다 (반만 그리는 것은 기지 쪽에서 올라오는 것)
function drawRing(f, p) {
  const q = 1 - p, col = seenCol(f.c), rr = f.r * (0.35 + 0.65 * q), fd = Math.sqrt(p) * Math.min(1, q * 8 + 0.35), half = !f.full;
  VX.add();
  VX.wave(f.x, f.y, rr / 0.95, col, (f.fat ? 0.95 : 0.9) * fd, f.fat ? q * 0.7 : 0.3 + 0.6 * q, half);
  VX.norm();
  ctx.beginPath(); ctx.arc(f.x, f.y, rr, half ? Math.PI : 0, TAU); ctx.lineWidth = (f.fat ? 2.2 : 1.3) * p + 0.3; ctx.strokeStyle = rgba(col, (f.fat ? 0.8 : 0.55) * fd); ctx.stroke();
}
// 달아오른 탄의 색 (예열 n = 0~10): 어두운 테마는 흰 쪽으로, 밝은 테마는 붉은 주황 쪽으로
function heatHex(col, n) {
  const u = Math.min(1, n / 10);
  return VX.light ? VX.lerp(VX.mix(col, -0.3), '#d93a08', u) : VX.lerp(col, '#fff4dc', u * 0.9);
}
// 블래스터 총구 섬광: 길이와 방향이 쏠 때마다 다른 불꽃 혀 몇 가닥. 개틀링(f.g)은 가늘고 짧게. 난사(f.sp)는 조금 더 크게 터지고 탄피가 튄다 (돌아가는 포신 자리는 core 가 정한다)
function drawMuz(f, p) {
  const u = VX.ui(f), q = 1 - p, sd = u.sd * 71, hl = f.hl || 0, h = hl / 10, F = fireCol(), L = VX.light;
  const base = C.WEAPONS.blaster.color, cb = L ? VX.mix(base, -0.3) : base, col = hl ? VX.lerp(cb, F.o, 0.35 + 0.65 * h) : cb, core = L ? VX.mix(base, 0.55) : '#ffffff';
  const big = f.sp ? 1.22 : 1;
  if (u.n) {
    const sx = Math.sin(f.a), sy = -Math.cos(f.a);
    if (f.sp) casingAdd(f.x, f.y + 3, f.a);
    for (let i = f.g ? 1 : 2; i > 0; i--) {     // 옆으로 튀는 짧은 빛줄기
      const sgn = Math.random() < 0.5 ? -1 : 1, s = 120 + 160 * Math.random(), fw = 0.2 + 0.5 * Math.random();
      VX.spark(f.x, f.y, (-sy * sgn + sx * fw) * s, (sx * sgn + sy * fw) * s, 0.08 + 0.08 * Math.random(), 1.3, hl ? F.e : VX.hot(base), 0, 6, 1);
    }
    if (h > 0.25 && Math.random() < h) VX.spark(f.x + (Math.random() - 0.5) * 8, f.y - 2, (Math.random() - 0.5) * 70, -50 - 70 * Math.random(), 0.35 + 0.4 * Math.random(), 0.9 + 0.9 * Math.random(), Math.random() < 0.5 ? F.e : F.y, -30, 1.6, 2);   // 달아오르면 불티
  }
  const grow = (0.55 + 0.45 * VX.ease(q, 2)) * (0.4 + 0.6 * p), al = Math.min(1, p * 2.4);
  VX.add(); hotSpot(f.x, f.y, ((f.g ? 8 : 11) + 4 * q + 3 * h) * big, hl ? F.o : base, 0.9 * p); VX.norm();
  for (let pass = 0; pass < 2; pass++) {
    const ks = pass ? 0.55 : 1;
    ctx.beginPath();
    const main = (f.g ? 13 + 10 * hash(sd) : 18 + 8 * hash(sd)) * grow * ks * big, mw = (f.g ? 2.6 : 3.8) * (pass ? 0.5 : 1) * big;
    let a = f.a + (hash(sd + 1) - 0.5) * (f.g ? 0.3 : 0.12);
    flameTo(f.x, f.y, f.x + Math.sin(a) * main, f.y - Math.cos(a) * main, mw, (hash(sd + 2) - 0.5) * 3);
    for (let i = 0; i < 2; i++) {               // 양옆의 짧은 가닥
      const side = i ? 1 : -1, len = (f.g ? 6 + 7 * hash(sd + 5 + i) : 8 + 7 * hash(sd + 5 + i)) * grow * ks;
      if (f.g && hash(sd + 9 + i) < 0.35) continue;
      a = f.a + side * (0.75 + 0.6 * hash(sd + 3 + i));
      flameTo(f.x, f.y, f.x + Math.sin(a) * len, f.y - Math.cos(a) * len, mw * 0.7, side * 2);
    }
    ctx.fillStyle = rgba(pass ? core : col, (pass ? 0.95 : 0.9) * al); ctx.fill();
  }
}
// 앞이 뾰족하고 뒤로 길게 가늘어지는 꼴을 지금 경로에 더한다 (front 앞으로 나온 길이, hw 반폭, tail 꼬리 길이)
function lanceTo(x, y, ux, uy, front, hw, tail) {
  const nx = -uy, ny = ux, bx = x - ux * hw * 1.4, by = y - uy * hw * 1.4;
  ctx.moveTo(x + ux * front, y + uy * front);
  ctx.quadraticCurveTo(x + ux * front * 0.3 + nx * hw, y + uy * front * 0.3 + ny * hw, bx + nx * hw, by + ny * hw);
  ctx.lineTo(x - ux * tail, y - uy * tail);
  ctx.lineTo(bx - nx * hw, by - ny * hw);
  ctx.quadraticCurveTo(x + ux * front * 0.3 - nx * hw, y + uy * front * 0.3 - ny * hw, x + ux * front, y + uy * front);
}
// 개틀링 탄: 가늘고 빠른 빛줄기와 짧은 잔상. 길이가 탄마다 조금씩 다르고, 달아오르면 불빛이 번지고 불티가 떨어진다
function drawGatShot(b) {
  const u = VX.ui(b), hl = b.hl || 0, h = hl / 10, L = VX.light, base = b.st.color, F = fireCol(), k = 0.8 + 0.5 * u.sd;
  const c = hl ? heatHex(base, hl) : (L ? VX.mix(base, -0.3) : base), sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, tl = Math.min(1, (b.d0 - b.left) / 60);
  if (h > 0.3 && VX.rate(2.5 * h)) VX.spark(b.x, b.y, (Math.random() - 0.5) * 50, 40 * Math.random(), 0.25 + 0.25 * Math.random(), 0.9 + 0.7 * Math.random(), F.e, 0, 2, 2);
  VX.add();
  ctx.beginPath(); lanceTo(b.x, b.y, ux, uy, 3, 2 + 0.9 * h, 62 * k * tl + 4);   // 뒤로 가늘어지는 잔상
  ctx.fillStyle = rgba(hl ? F.o : base, (L ? 0.45 : 0.36) + 0.16 * h); ctx.fill();
  VX.glow(b.x, b.y, 6 + 4 * h, hl ? F.o : base, 0.6 + 0.25 * h);
  VX.norm();
  ctx.beginPath(); lanceTo(b.x, b.y, ux, uy, 4, 1.15, 26 * k * tl + 3); ctx.fillStyle = c; ctx.fill();
}
// 보조 포탑의 작은 탄
function drawTurShot(b) {
  const L = VX.light, c = b.c, sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, tl = Math.min(1, (b.d0 - b.left) / 40);
  VX.add();
  ctx.beginPath(); lanceTo(b.x, b.y, ux, uy, 3, 2.2, 38 * tl + 3); ctx.fillStyle = rgba(c, L ? 0.45 : 0.36); ctx.fill();
  VX.glow(b.x, b.y, 5.5, c, 0.6);
  VX.norm();
  ctx.beginPath(); lanceTo(b.x, b.y, ux, uy, 3.5, 1.2, 17 * tl + 2); ctx.fillStyle = L ? VX.mix(c, -0.35) : '#ffffff'; ctx.fill();
}
// 광탄: 앞이 뾰족하고 뒤로 길게 가늘어지는 빛살. 하얀 심지, 무기 색 겉빛, 머리의 짧은 눈부심, 뒤에 남는 빛 알갱이
function drawLance(b, k) {
  const u = VX.ui(b), sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, c = b.st.color, L = VX.light, t = VX.t;
  const tl = Math.min(1, (b.d0 - b.left) / 90), fl = 0.9 + 0.1 * Math.sin(t * 43 + u.sd * 30), T = (64 + 26 * u.sd) * k * tl * fl;
  for (let n = VX.rate(16); n > 0; n--) {
    const s = Math.random() * T;
    VX.spark(b.x - ux * s + (Math.random() - 0.5) * 5, b.y - uy * s + (Math.random() - 0.5) * 5, ux * 30, uy * 30, 0.2 + 0.25 * Math.random(), 0.8 + 0.9 * Math.random(), L ? VX.hot(c) : VX.mix(c, 0.5), 0, 2, 2);
  }
  VX.add();
  VX.glow(b.x, b.y, 13 * k, c, L ? 0.6 : 0.55);
  ctx.beginPath(); lanceTo(b.x, b.y, ux, uy, 9 * k, 5 * k, T * 1.5); ctx.fillStyle = rgba(c, L ? 0.3 : 0.26); ctx.fill();
  VX.norm();
  ctx.beginPath(); lanceTo(b.x, b.y, ux, uy, 8 * k, 2.9 * k, T); ctx.fillStyle = rgba(L ? VX.mix(c, -0.25) : c, 0.92); ctx.fill();
  ctx.beginPath(); lanceTo(b.x, b.y, ux, uy, 5 * k, 1.2 * k, T * 0.6); ctx.fillStyle = L ? VX.mix(c, 0.3) : '#ffffff'; ctx.fill();
  const g = (L ? 4.6 : 6.5) * k * fl;           // 머리를 가로지르는 짧은 눈부심
  ctx.beginPath(); ctx.moveTo(b.x - uy * g, b.y + ux * g); ctx.lineTo(b.x + uy * g, b.y - ux * g);
  ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(L ? VX.mix(c, -0.25) : '#ffffff', L ? 0.55 : 0.8); ctx.stroke();
}
// 지금 경로에 번개 줄 하나를 더한다. 굴곡이 시간에 따라 이어지며 달라진다 (ph: 1 이 늘 때마다 새 모양으로 넘어가는 시계)
function boltTo(ax, ay, bx, by, sd, amp, ph) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, n = Math.max(3, Math.round(len / 13)), i0 = Math.floor(ph), fr = ph - i0;
  ctx.moveTo(ax, ay);
  for (let j = 1; j < n; j++) {
    const s = j / n, env = 0.3 + 0.7 * Math.sin(s * Math.PI), h0 = hash(sd + i0 * 7.3 + j * 3.1), h1 = hash(sd + (i0 + 1) * 7.3 + j * 3.1);
    const off = ((h0 + (h1 - h0) * fr) - 0.5) * 2 * amp * env + (hash(sd + j + ph * 31) - 0.5) * amp * 0.25;
    ctx.lineTo(ax + dx * s + nx * off, ay + dy * s + ny * off);
  }
  ctx.lineTo(bx, by);
}
// 유지되는 빔 (지속 빔, 상시 빔): 부드러운 빛기둥, 위로 흐르며 일렁이는 심지, 적에 닿는 자리의 불꽃. 초점이 쌓인 적일수록 닿는 자리가 밝고 커진다
function drawHoldBeam(k, st, owner, a, sd) {
  const S = C.S, H = C.H, x = (k + 0.5) * C.LW, stop = C.beamStop(k, st), y0 = stop != null ? Math.max(H - st.range * H, stop) : H - st.range * H, len = H - y0, col = st.color, t = VX.t, L = VX.light, hot = VX.hot(col);
  const br = 1 + 0.1 * Math.sin(t * 37 + sd) + 0.06 * Math.sin(t * 61 + sd * 3), hw = 7.5 * br * (0.35 + 0.65 * a);
  VX.add();
  VX.column2(x, y0, H, hw * 3.4, col, (L ? 1 : 0.82) * a);
  const ph = (t * 1.6 + sd * 0.37) % 1;         // 빔을 타고 올라가는 빛 덩이
  VX.glow(x, H - len * ph, hw * 2.2, col, 0.5 * a * Math.sin(Math.PI * ph), 34);
  VX.norm();
  const n = Math.max(6, Math.round(len / 24));
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();                              // 심지
  for (let i = 0; i <= n; i++) {
    const y = H - len * i / n, off = (Math.sin(y * 0.045 + t * 34 + sd) + 0.6 * Math.sin(y * 0.11 - t * 51 + sd * 2)) * 0.8;
    if (i) ctx.lineTo(x + off, y); else ctx.moveTo(x + off, y);
  }
  ctx.lineWidth = 6.4 * a * br + 0.8; ctx.strokeStyle = rgba(col, 0.9 * a); ctx.stroke();
  ctx.lineWidth = 2.5 * a * br + 0.5; ctx.strokeStyle = `rgba(255,255,255,${(0.95 * a).toFixed(2)})`; ctx.stroke();
  ctx.beginPath();                              // 겉을 감도는 가는 가닥
  for (let i = 0; i <= n; i++) {
    const y = H - len * i / n, off = Math.sin(y * 0.031 - t * 11 + sd * 5) * hw * 0.8 + Math.sin(y * 0.083 + t * 23) * 1.2;
    if (i) ctx.lineTo(x + off, y); else ctx.moveTo(x + off, y);
  }
  ctx.lineWidth = 1; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.12) : VX.mix(col, 0.5), 0.6 * a); ctx.stroke();
  VX.add(); hotSpot(x, H - 11, 12 + 2.5 * Math.sin(t * 29 + sd), col, a);
  if (stop != null) { const fl = 0.85 + 0.15 * Math.sin(t * 41 + sd); VX.glow(x, y0 - 2, hw * 2.6 * fl, col, 0.5 * a, hw * 1.8); hotSpot(x, y0, (5 + 2 * fl) * (0.6 + 0.4 * a), col, 0.85 * a); }   // 멈춘 끝: 빛이 적에게 빨려 든다
  VX.norm();
  const reach = (st.lanes + 0.5) * C.LW; let cnt = 0;
  for (const e of S.enemies) {                  // 닿는 자리
    if (e.dead || (stop != null ? e.y < y0 : e.y + e.r < y0) || e.y - e.r > H || Math.abs(e.x - x) > reach + e.r * 0.4) continue;   // 멈춘 빔은 멈춘 자리 아래의 적만
    if (++cnt > 6) break;
    const fc = st.focus && e.fcB === owner ? Math.min(1, (e.fcN || 0) / 20) : 0, d = e.x - x;
    const cx = x + (d < -5 ? -5 : d > 5 ? 5 : d), cy = e.y + Math.min(e.r * 0.55, 16), fl = 0.8 + 0.2 * Math.sin(t * 53 + e.x);
    for (let m = VX.rate((7 + 12 * fc) * a); m > 0; m--) {
      const an = Math.PI * (0.05 + 0.9 * Math.random()), s = 70 + 130 * Math.random() + 80 * fc;
      VX.spark(cx, cy, Math.cos(an) * s, Math.sin(an) * s * 0.8 - 20, 0.16 + 0.22 * Math.random(), 1 + 0.9 * Math.random() + 0.5 * fc, Math.random() < 0.5 ? hot : col, 160, 2.5, Math.random() < 0.4 ? 1 : 2);
    }
    VX.add();
    if (fc > 0) VX.glow(cx, cy, 16 + 22 * fc, col, (0.3 + 0.45 * fc) * a * fl);
    hotSpot(cx, cy, (8 + 9 * fc) * fl, col, (0.8 + 0.2 * fc) * a);
    VX.norm();
    if (fc > 0.15) {                            // 초점이 쌓이면 눈부신 빛살이 길어진다
      const rl = (5 + 17 * fc) * fl, ro = t * 1.4 + e.x;
      ctx.beginPath();
      for (let j = 0; j < 4; j++) { const an = ro + j * Math.PI / 2, r1 = j % 2 ? rl * 0.55 : rl; ctx.moveTo(cx + Math.cos(an) * 2.5, cy + Math.sin(an) * 2.5); ctx.lineTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); }
      ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.15) : '#ffffff', (0.45 + 0.5 * fc) * a); ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';
}
// 용융선: 바닥에 달궈진 금. 막 지나갔을 때는 심지가 노랗게 밝고, 식을수록 주황 → 검붉은 색으로 어두워진다. 위로 아지랑이와 불티
const MP = new Float32Array(140);
function drawMelt(p, H) {
  const t = VX.t, F = fireCol(), L = VX.light, sd = p.sd * 97, len = H - p.y, D = (p.st && p.st.meltT) || 2;
  const al = Math.min(1, p.t / 0.5), heat = Math.max(0, Math.min(1, (p.t - 0.2) / (D - 0.2))), fl = 0.88 + 0.12 * Math.sin(t * 7 + sd);
  const n = Math.min(68, Math.max(8, Math.round(len / 18)));
  for (let i = 0; i <= n; i++) {
    const s = i / n, tp = Math.min(1, (1 - s) * 6, s * 10 + 0.3);
    MP[i * 2] = p.x + ((hash(sd + i * 1.7) - 0.5) * 10 * (hash(sd + i * 3.9) < 0.42 ? 1 : 0.2) + Math.sin(i * 0.8 + sd) * 1.8) * tp; MP[i * 2 + 1] = H - len * s;
  }
  const line = () => { ctx.beginPath(); ctx.moveTo(MP[0], MP[1]); for (let i = 1; i <= n; i++) ctx.lineTo(MP[i * 2], MP[i * 2 + 1]); };
  for (let m = VX.rate(1.5 + 4 * heat); m > 0; m--) {
    const i = Math.floor(Math.random() * n);
    VX.spark(MP[i * 2] + (Math.random() - 0.5) * 6, MP[i * 2 + 1], (Math.random() - 0.5) * 20, -20 - 34 * Math.random(), 0.5 + 0.5 * Math.random(), 0.8 + 0.9 * Math.random(), Math.random() < 0.5 ? F.e : F.y, -18, 0.6, 2);
  }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  line(); ctx.lineWidth = 12; ctx.strokeStyle = F.s + ((L ? 0.1 : 0.26) * al).toFixed(3) + ')'; ctx.stroke();   // 그을음
  VX.add(); VX.column(p.x, p.y, H, 15 + 4 * fl, F.o, (L ? 0.5 : 0.42) * al * (0.3 + 0.7 * heat) * fl); VX.norm();
  line();
  for (let i = 2; i < n - 1; i += 3) {          // 옆으로 뻗은 잔금
    if (hash(sd + i * 4.9) < 0.4) continue;
    const side = hash(sd + i * 2.3) < 0.5 ? -1 : 1, l1 = 5 + 8 * hash(sd + i * 6.1);
    ctx.moveTo(MP[i * 2], MP[i * 2 + 1]); ctx.lineTo(MP[i * 2] + side * l1, MP[i * 2 + 1] - l1 * (0.3 + 0.8 * hash(sd + i)));
  }
  ctx.lineWidth = 3.6; ctx.strokeStyle = rgba(L ? '#8f1d0c' : '#b02a12', 0.9 * al); ctx.stroke();
  line();
  ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(F.o, al * Math.min(1, heat * 1.5) * fl); ctx.stroke();
  const hk = Math.max(0, Math.min(1, (heat - 0.3) / 0.5));
  if (hk > 0) { ctx.lineWidth = 1.3; ctx.strokeStyle = rgba(L ? F.y : '#fff1c9', al * hk); ctx.stroke(); }
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 5; i++) {                 // 아지랑이: 금 위로 피어오르는 가는 물결
    const tt = t * 0.55 + hash(sd + i * 3.1), cyc = Math.floor(tt), ph = tt - cyc;
    const xx = p.x + (hash(sd + i * 5.3 + cyc * 1.9) - 0.5) * 16, yy = p.y + len * (0.06 + 0.88 * hash(sd + i * 7.7 + cyc * 2.7)) - ph * 22, w = 2.2 + 1.6 * ph, a = Math.sin(Math.PI * ph) * (L ? 0.55 : 0.45) * al * (0.35 + 0.65 * heat);
    if (a < 0.02) continue;
    ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + w, yy - 4, xx, yy - 8); ctx.quadraticCurveTo(xx - w, yy - 12, xx, yy - 16);
    ctx.strokeStyle = rgba(F.o, a); ctx.stroke();
  }
  ctx.lineCap = 'butt';
}
// 증발: 짧은 섬광과 옅은 물결, 위로 흩어지며 깜빡이는 빛 알갱이
function drawVap(f, p) {
  const u = VX.ui(f), q = 1 - p, col = C.WEAPONS.laser.color, L = VX.light, hot = VX.hot(col), e = VX.ease(q);
  if (u.n) for (let i = 0; i < 12; i++) {
    const a = Math.random() * TAU, s = 25 + 95 * Math.random(), d = f.r * 0.6 * Math.random();
    VX.spark(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, Math.cos(a) * s, Math.sin(a) * s - 30, 0.45 + 0.55 * Math.random(), 1 + 1.4 * Math.random(), i % 3 ? (L ? hot : '#ffffff') : col, -70, 2.2, 2);
  }
  VX.add();
  VX.glow(f.x, f.y, f.r * (1.3 + 1.3 * e), col, 0.6 * p);
  hotSpot(f.x, f.y, f.r * (0.8 + 0.9 * e), col, p * p);
  VX.wave(f.x, f.y, f.r * (0.7 + 1.6 * e), col, 0.55 * VX.fade(q), q);
  VX.norm();
}
// 위성 구체: 속이 빛나는 구체, 뒤로 갈수록 가늘고 옅은 궤적, 떨어져 나가는 빛 알갱이
function drawOrb(k, st, i, o, sz) {
  const S = C.S, col = st.color, L = VX.light, t = VX.t, r0 = 7 * sz, fl = 0.9 + 0.1 * Math.sin(t * 9 + i * 2.1 + k), N = 6;
  if (VX.rate(5)) VX.spark(o[0] + (Math.random() - 0.5) * r0, o[1] + (Math.random() - 0.5) * r0, (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24, 0.3 + 0.3 * Math.random(), 0.8 + 0.9 * Math.random(), L ? VX.hot(col) : VX.mix(col, 0.5), 0, 1, 2);
  MP[0] = o[0]; MP[1] = o[1];
  for (let j = 1; j <= N; j++) { const q = C.orbPos(k, st, i, S.t - j * 0.035, OPOS[4]); MP[j * 2] = q[0]; MP[j * 2 + 1] = q[1]; }
  VX.add();
  for (let M = N; M >= 3; M -= 3) {             // 궤적: 뒤로 갈수록 가늘고 옅어지는 줄기 (긴 것 위에 짧은 것을 겹친다)
    ctx.beginPath();
    for (let pass = 0; pass < 2; pass++) for (let n = 0; n <= M; n++) {
      const j = pass ? M - n : n, a = j ? j - 1 : 0, b = j ? j : 1, dx = MP[b * 2] - MP[a * 2], dy = MP[b * 2 + 1] - MP[a * 2 + 1], len = Math.hypot(dx, dy) || 1, w = r0 * 0.75 * (1 - j / M) * (pass ? -1 : 1);
      const x = MP[j * 2] - dy / len * w, y = MP[j * 2 + 1] + dx / len * w;
      if (pass || n) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = rgba(col, L ? 0.26 : 0.2); ctx.fill();
  }
  VX.glow(o[0], o[1], r0 * 3.1 * fl, col, L ? 0.75 : 0.6);
  if (!L) VX.heat(o[0], o[1], r0 * 1.6, col, 1);
  VX.norm();
  if (L) {                                      // 밝은 테마: 유리구슬처럼
    ctx.beginPath(); ctx.arc(o[0], o[1], r0 * 0.86, 0, TAU); ctx.fillStyle = VX.mix(col, 0.2); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = VX.mix(col, -0.42); ctx.stroke();
    ctx.beginPath(); ctx.arc(o[0] - r0 * 0.2, o[1] - r0 * 0.22, r0 * 0.34, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill();
  }
}
// 전기 사슬: 구체 사이를 잇는 번개 줄. 굵은 줄 하나와 가끔 나타나는 가는 곁줄
function drawOrbChain(st, k, n) {
  const col = st.color, L = VX.light, t = VX.t, segs = n === 2 ? 1 : n, ph = t * 20;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let q = 0; q < segs; q++) { const a = OPOS[q], b = OPOS[(q + 1) % n]; boltTo(a[0], a[1], b[0], b[1], k * 13 + q * 29, 10, ph); }
  VX.add(); ctx.lineWidth = L ? 6 : 8; ctx.strokeStyle = rgba(col, L ? 0.34 : 0.26); ctx.stroke(); VX.norm();
  ctx.lineWidth = L ? 1.7 : 2.6; ctx.strokeStyle = L ? VX.mix(col, -0.3) : col; ctx.stroke();
  if (!L) { ctx.lineWidth = 1; ctx.strokeStyle = '#ffffff'; ctx.stroke(); }
  ctx.beginPath(); let any = 0;
  for (let q = 0; q < segs; q++) {
    if (hash(Math.floor(ph * 0.5) * 3.7 + q * 11 + k) < 0.45) continue;
    const a = OPOS[q], b = OPOS[(q + 1) % n]; boltTo(a[0], a[1], b[0], b[1], k * 17 + q * 31 + 5, 20, ph * 1.3); any = 1;
  }
  if (any) { ctx.lineWidth = 1.1; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.35) : VX.mix(col, 0.5), 0.7); ctx.stroke(); }
  ctx.lineCap = 'butt';
}
// 역장: 가운데에서 가장자리로 갈수록 옅어지는 막. 막 안에는 가장자리에서 가운데로 빨려 드는 빛줄기가 흐르고(자리와 길이가 저마다 다르다),
// 끌려가는 적 뒤에는 끌려온 쪽으로 옅은 꼬리가 남는다. 반격하는 순간 잠깐 밝아진다
function drawField(x, H, R, st, w, k) {
  const col = st.color, t = VX.t, L = VX.light, ctr = w.ct > 0 ? Math.pow(Math.min(1, w.ct / 0.5), 2) : 0, hot = VX.hot(col);
  VX.add();
  VX.glow(x, H, R * 1.04, col, (L ? 0.3 : 0.2) + 0.3 * ctr);
  VX.wave(x, H, R, col, (L ? 0.3 : 0.24) * (0.85 + 0.15 * Math.sin(t * 1.3 + k)) + 0.5 * ctr, 0.1, true);
  const u0 = (t * 0.22 + k * 0.13) % 1;      // 안쪽으로 조여드는 옅은 물결 하나
  VX.wave(x, H, R * (1 - 0.75 * u0), col, (L ? 0.16 : 0.13) * Math.sin(Math.PI * u0), 0, true);
  VX.norm();
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {             // 가운데로 빨려 드는 빛줄기
    const sp = 0.55 + 0.35 * hash(k * 7 + i * 3.1), tt = t * sp + hash(k * 5 + i * 1.7) * 4, cyc = Math.floor(tt), ph = tt - cyc, side = (i + cyc) % 2 ? 1 : -1;
    const hy = R * (0.12 + 0.62 * hash(cyc * 2.3 + i * 5.9 + k)), half = Math.sqrt(Math.max(0, R * R - hy * hy)), e = VX.ease(ph, 2);
    const xa = x + side * half * (0.92 - 0.82 * e), len = (20 + 18 * hash(cyc + i * 9.7)) * (1 - 0.5 * e), a = Math.sin(Math.PI * ph) * (L ? 0.6 : 0.5);
    if (a < 0.03 || len < 2) continue;
    const yy = H - hy - hy * 0.08 * e, c2 = L ? VX.mix(col, -0.2) : hot;
    ctx.beginPath(); ctx.moveTo(xa, yy); ctx.lineTo(xa + side * len, yy + 1.5 * e);
    ctx.lineWidth = 5 * (1 - 0.4 * e); ctx.strokeStyle = rgba(col, a * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(xa, yy); ctx.lineTo(xa + side * len * 0.6, yy + e);
    ctx.lineWidth = 1.8 * (1 - 0.4 * e); ctx.strokeStyle = rgba(c2, a); ctx.stroke();
  }
  const now = C.S.t, c3 = L ? VX.mix(col, -0.25) : hot;
  for (const e of C.S.enemies) {
    if (e.dead || Math.abs(e.x - x) > R + e.r) continue;
    if (st.fldDps && e.crT != null && now - e.crT < 0.05) {   // 짓눌리는 적: 바깥에서 몸 쪽으로 조여 드는 짧은 빛줄기 셋 (각도, 빠르기, 길이가 저마다 다르다)
      const sd = e.r * 1.7 + e.y * 0.013;
      for (let q = 0; q < 3; q++) {
        const tt = t * (1.6 + 0.7 * hash(sd + q * 4.1)) + hash(sd * 2.3 + q), cyc = Math.floor(tt), ph = tt - cyc;
        const an = q * 2.09 + (hash(cyc * 1.9 + q * 6.3 + sd) - 0.5) * 1.4, ca = Math.cos(an), sa = Math.sin(an);
        const r0 = e.r * (1.05 + 0.85 * (1 - VX.ease(ph, 2))), ln = (6 + 6 * hash(cyc + q * 2.7 + sd)) * (1 - 0.6 * ph), a = Math.sin(Math.PI * ph) * (L ? 0.7 : 0.6);
        if (a < 0.04) continue;
        ctx.beginPath(); ctx.moveTo(e.x + ca * (r0 + ln), e.y + sa * (r0 + ln)); ctx.lineTo(e.x + ca * r0, e.y + sa * r0);
        ctx.lineWidth = 1.7; ctx.strokeStyle = rgba(c3, a); ctx.stroke();
      }
    }
    // 끌려가는 적: 끌려온 쪽으로 남는 꼬리 세 가닥
    if (e.pullT == null || now - e.pullT > 0.05 || Math.abs(e.x - x) > R) continue;
    const d = e.pullD || 1, bx = e.x - d * e.r * 0.8;
    for (let q = -1; q <= 1; q++) {
      const yy = e.y + q * e.r * 0.45, ln = (12 + 8 * hash(e.r + q * 3.3 + Math.floor(t * 9))) * (q ? 0.7 : 1);
      ctx.beginPath(); ctx.moveTo(bx, yy); ctx.lineTo(bx - d * ln, yy);
      ctx.lineWidth = q ? 1.2 : 1.8; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.2) : hot, q ? 0.35 : 0.55); ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';
}
// 예열: 총구 둘레의 붉은 열기, 위로 피어오르는 아지랑이, 가끔 튀는 불티
function drawHeat(x, H, hl, k) {
  const F = fireCol(), t = VX.t, L = VX.light, fl = 0.86 + 0.14 * Math.sin(t * 23 + k * 2);
  for (let n = VX.rate(7 * hl * hl); n > 0; n--) VX.spark(x + (Math.random() - 0.5) * 16, H - 8, (Math.random() - 0.5) * 40, -40 - 60 * Math.random(), 0.4 + 0.45 * Math.random(), 0.9 + 0.9 * Math.random(), Math.random() < 0.5 ? F.e : F.y, -26, 1.2, 2);
  VX.add(); VX.glow(x, H - 7, 18 + 16 * hl, F.o, (L ? 0.7 : 0.6) * hl * fl); hotSpot(x, H - 8, 6 + 6 * hl, F.o, 0.7 * hl); VX.norm();
  ctx.lineWidth = 1.1; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const tt = t * 1.1 + i * 0.37 + k * 0.21, cyc = Math.floor(tt), ph = tt - cyc, a = Math.sin(Math.PI * ph) * (L ? 0.6 : 0.5) * hl;
    if (a < 0.03) continue;
    const xx = x + (hash(cyc * 3.3 + i * 7.1 + k) - 0.5) * 22, yy = H - 16 - ph * 30, w = 2 + 1.8 * ph;
    ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + w, yy - 4, xx, yy - 8); ctx.quadraticCurveTo(xx - w, yy - 12, xx, yy - 16);
    ctx.strokeStyle = rgba(F.o, a); ctx.stroke();
  }
  ctx.lineCap = 'butt';
}
// 난사의 탄피: 총구 오른쪽으로 튀어 돌며 떨어지고, 기지 선에 한 번 튄 뒤 잠깐 누워 있다 사라진다 (화면 전용)
const CAS = [];
let casW = 0;
function casingAdd(x, y, a, big) {   // big: 저격포 탄피 (길고 굵다, 조금 더 멀리 튄다)
  if (RM.matches) return;
  const o = CAS.length < 48 ? (CAS[CAS.length] = {}) : CAS[casW++ % 48];   // 가득 차면 오래된 것부터 덮어쓴다
  const s = (55 + 55 * Math.random()) * (big ? 1.25 : 1), up = 80 + 70 * Math.random();
  o.x = x; o.y = y; o.vx = Math.cos(a) * s + Math.sin(a) * 20; o.vy = Math.sin(a) * s - up; o.t = 0; o.d = (0.75 + 0.35 * Math.random()) * (big ? 1.3 : 1);
  o.r = Math.random() * TAU; o.w = (Math.random() < 0.5 ? -1 : 1) * (16 + 14 * Math.random()) * (big ? 0.7 : 1); o.b = 0; o.l = (3.8 + 1.4 * Math.random()) * (big ? 1.7 : 1); o.z = big ? 1.35 : 1;
}
function drawCasings(H) {
  if (VX.reset) { VX.reset = 0; CAS.length = 0; casW = 0; }
  if (!CAS.length) return;
  const dt = VX.dt || 0, gy = H - 5.5, L = VX.light, body = L ? '#9a6c1c' : '#d9a646', hi = L ? '#d9b25a' : '#fff0c2';
  ctx.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < CAS.length; i++) {
      const o = CAS[i];
      if (pass === 0 && dt) {
        o.t += dt;
        if (o.t < o.d) {
          o.vy += 720 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.r += o.w * dt;
          if (o.y > gy) { o.y = gy; if (o.b++ < 1) { o.vy *= -0.32; o.vx *= 0.55; o.w *= 0.5; } else { o.vy = 0; o.vx *= 0.6; o.w = 0; } }   // 한 번 튀고 눕는다
        }
      }
      if (o.t >= o.d) continue;
      const a = Math.min(1, (o.d - o.t) / 0.25), cx = Math.cos(o.r) * o.l * 0.5, cy = Math.sin(o.r) * o.l * 0.5;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(o.x - cx, o.y - cy); ctx.lineTo(o.x + cx, o.y + cy);
      if (pass === 0) { ctx.lineWidth = 2.1 * o.z; ctx.strokeStyle = body; } else { ctx.lineWidth = 0.8 * o.z; ctx.strokeStyle = hi; }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';
}
// 난사의 재장전: 총구가 달아올랐다 식으며 김이 오르고, 무기 아래의 가는 탄띠가 왼쪽부터 차올라 무기로 들어간다. 다 차면 철컥 하고 한 번 빛난다
// 쏘는 동안에는 남은 탄띠가 옅게 줄어든다
const sprayCool = (q) => Math.min(1, 0.45 + q * 9) * Math.pow(1 - q, 1.4);   // 재장전 중 포신의 달아오름 (막 멈춘 직후 가장 뜨겁다)
function drawSpray(x, H, ss, k, col) {
  const L = VX.light, F = fireCol(), t = VX.t, hw = C.LW * 0.36, by = H - 6.5, bc = L ? VX.mix(col, -0.3) : col;
  const q = ss.rl, belt = q >= 0 ? q : ss.b;
  ctx.fillStyle = L ? 'rgba(40,52,72,.16)' : 'rgba(255,255,255,.10)'; ctx.fillRect(x - hw, by - 1.2, hw * 2, 2.4);   // 탄띠 자리
  ctx.fillStyle = rgba(bc, q >= 0 ? 0.95 : 0.45); ctx.fillRect(x - hw, by - 1.2, hw * 2 * belt, 2.4);
  if (q >= 0) {
    const e = sprayCool(q), hx = x - hw + hw * 2 * q;
    VX.add(); VX.glow(hx, by, 6, bc, 0.9); hotSpot(x, H - 12, 4 + 6 * e, F.o, 0.85 * e); VX.norm();
    if (e > 0.25 && VX.rate(10 * e)) VX.spark(x + (Math.random() - 0.5) * 6, H - 13, (Math.random() - 0.5) * 30, -30 - 40 * Math.random(), 0.3 + 0.3 * Math.random(), 0.9 + 0.6 * Math.random(), F.e, -20, 1.5, 2);
    const st = Math.min(1, q * 5) * (0.4 + 0.6 * (1 - q)), sc = L ? '#7b8798' : '#d5dde6';   // 김: 식는 동안 피어올라 퍼지며 흩어진다
    for (let i = 0; i < 4; i++) {
      const tt = t * 1.1 + i / 4 + k * 0.29, cyc = Math.floor(tt), ph = tt - cyc, sd = hash(cyc * 5.1 + i * 3.7 + k);
      const a = Math.sin(Math.PI * Math.min(1, ph * 1.1)) * st * (L ? 0.5 : 0.36); if (a < 0.02) continue;
      const rr = 5 + 13 * ph + 3 * sd, yy = H - 15 - ph * (30 + 14 * sd), xx = x + (sd - 0.5) * 8 + Math.sin(ph * 4 + sd * 6) * (2 + 5 * ph) + (hash(sd * 9) - 0.5) * 18 * ph;
      VX.glow(xx, yy, rr, sc, a, rr * 0.8);
    }
  }
  if (ss.end < 0.3) {                             // 철컥: 탄띠가 한 번 빛나고 총구에 작은 불빛
    const a = 1 - ss.end / 0.3;
    VX.add(); VX.glow(x, by, hw * 1.1, bc, 0.6 * a, 6); hotSpot(x, H - 12, 3 + 5 * a, bc, 0.8 * a); VX.norm();
  }
}
// 보조 포탑: 무기 옆에 살짝 떠서 흔들리는 작은 포탑. 조준한 쪽으로 돌고, 쏠 때 포신이 밀렸다가 돌아온다
function drawTurret(w, k, q, st) {
  const tp = C.turretPos(k, q), t = VX.t, ph = k * 1.7 + q * 2.3, L = VX.light, col = st.color;
  const x = tp[0] + Math.sin(t * 1.7 + ph) * 1.5, y = tp[1] - 3 + Math.sin(t * 2.6 + ph * 2) * 2.2;
  const ft = q ? w.f2 : w.f1, age = ft == null ? 9 : C.S.t - ft, rc = age < 0.18 ? 5 * Math.pow(1 - age / 0.18, 2) : 0, ang = ((q ? w.g2 : w.g1) || 0) + Math.sin(t * 2.1 + ph) * 0.04;
  const edge = L ? VX.mix(col, -0.6) : '#ffffff', shell = L ? VX.mix(col, -0.14) : col, dark = L ? '#2f3644' : '#182033';
  VX.add(); VX.glow(x, tp[1] + 10, 11, col, (L ? 0.55 : 0.45) + 0.12 * Math.sin(t * 31 + ph), 4.5); VX.norm();   // 떠 있는 자리 아래의 옅은 빛
  ctx.save(); ctx.translate(x - Math.sin(ang) * rc * 0.35, y + Math.cos(ang) * rc * 0.35); ctx.rotate(ang);
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-2.6, -3 + rc); ctx.lineTo(-1.6, -15.5 + rc); ctx.lineTo(1.6, -15.5 + rc); ctx.lineTo(2.6, -3 + rc); ctx.closePath();   // 포신
  ctx.fillStyle = dark; ctx.fill();
  ctx.fillStyle = col; ctx.fillRect(-0.8, -14.5 + rc, 1.6, 9);
  ctx.beginPath(); ctx.moveTo(-4.5, -2.5); ctx.lineTo(-11.5, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.moveTo(4.5, -2.5); ctx.lineTo(11.5, 5); ctx.lineTo(4, 5); ctx.closePath();   // 양옆 날개
  ctx.fillStyle = dark; ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, -7.5); ctx.quadraticCurveTo(6.6, -6.4, 6.6, 0.4); ctx.quadraticCurveTo(6.2, 6.6, 0, 6.8); ctx.quadraticCurveTo(-6.2, 6.6, -6.6, 0.4); ctx.quadraticCurveTo(-6.6, -6.4, 0, -7.5); ctx.closePath();   // 몸통
  ctx.fillStyle = shell; ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = edge; ctx.stroke();
  ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, 0.2, 3.3, 0, TAU); ctx.fill();
  ctx.fillStyle = L ? VX.mix(col, 0.5) : '#ffffff'; ctx.beginPath(); ctx.arc(0, 0.2, 1.5 + (age < 0.18 ? 1.2 * (1 - age / 0.18) : 0), 0, TAU); ctx.fill();
  ctx.restore();
  if (age < 0.09) { const kk = 1 - age / 0.09; VX.add(); hotSpot(x + Math.sin(ang) * 16, y - Math.cos(ang) * 16, 4 + 6 * kk, col, kk); VX.norm(); }   // 쏘는 순간 포구의 빛
}
// 지뢰: 무기에서 던져져 내려앉는다(작은 지뢰는 터진 자리에서 흩어진다). 낮은 원판에 접촉 핀 넷, 가운데 불빛이 숨 쉬듯 깜빡이고 사라질 때가 되면 빨라진다
function mineBody(x, y, sc, rot, on, L, col) {   // T9a: 검은 몸이 벌레 같다는 평. 몸을 산탄포 색 계열로, 접촉 핀은 몸 색의 짧은 돌기로
  const rim = L ? VX.mix(col, -0.5) : VX.mix(col, -0.15), body = L ? VX.mix(col, -0.08) : VX.mix(col, -0.42), stud = L ? VX.mix(col, -0.32) : VX.mix(col, -0.05);
  ctx.lineCap = 'round'; ctx.lineWidth = 2.4 * sc; ctx.strokeStyle = stud;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2, cs = Math.cos(a), sn = Math.sin(a); ctx.moveTo(x + cs * 8.6 * sc, y + sn * 8.6 * sc); ctx.lineTo(x + cs * 10.4 * sc, y + sn * 10.4 * sc); }
  ctx.stroke(); ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.arc(x, y, 9 * sc, 0, TAU); ctx.fillStyle = body; ctx.fill();
  ctx.lineWidth = 1.8 * sc; ctx.strokeStyle = rim; ctx.stroke();
  ctx.beginPath(); ctx.arc(x - 1.6 * sc, y - 1.8 * sc, 6.2 * sc, Math.PI * 1.05, Math.PI * 1.6); ctx.lineWidth = 1.6 * sc; ctx.strokeStyle = L ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.3)'; ctx.stroke();   // 윗면의 반사광
  ctx.beginPath(); ctx.arc(x, y, 4 * sc, 0, TAU); ctx.fillStyle = L ? VX.mix(col, -0.55) : VX.mix(col, -0.7); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 2.9 * sc, 0, TAU); ctx.fillStyle = VX.lerp('#8a2a2a', '#ff4d4d', on); ctx.fill();
  if (on > 0.5) { ctx.beginPath(); ctx.arc(x - 0.8 * sc, y - 0.8 * sc, 1.1 * sc, 0, TAU); ctx.fillStyle = `rgba(255,255,255,${(0.8 * (on - 0.5) * 2).toFixed(2)})`; ctx.fill(); }
}
function drawMine(m) {
  const u = VX.ui(m), t = VX.t, L = VX.light, col = C.WEAPONS.shotgun.color, sc0 = m.mini ? 0.7 : 1.15, D = m.mini ? 0.3 : 0.36;
  if (u.n) {
    u.born = 12 - m.t > 0.25 || RM.matches ? -9 : t - (12 - m.t); u.land = u.born < 0 ? 1 : 0;
    if (m.ox != null) { u.ox = m.ox; u.oy = m.oy; } else { const k = C.S.slots.indexOf(m.wk); u.ox = k >= 0 ? (k + 0.5) * C.LW : m.x; u.oy = C.H - 8; }
  }
  const a = (t - u.born) / D, shadow = L ? 'rgba(40,44,60,' : 'rgba(0,0,0,';
  if (a < 1) {                                  // 날아오는 중: 포물선, 땅의 그림자, 빙글 도는 몸체
    const gx = u.ox + (m.x - u.ox) * a, gy = u.oy + (m.y - u.oy) * a, hgt = Math.sin(a * Math.PI) * (m.mini ? 26 : 46), k = sc0 * (0.75 + 0.3 * Math.sin(a * Math.PI));
    ctx.fillStyle = shadow + (0.12 + 0.2 * (1 - hgt / 46)).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(gx, gy + 3, 9 * sc0 * (1 - hgt / 120), 4 * sc0 * (1 - hgt / 120), 0, 0, TAU); ctx.fill();
    mineBody(gx, gy - hgt, k, m.ph + a * 8, 0, L, col);
    return;
  }
  const dust = L ? '#8d8676' : '#b9bfcc';
  if (!u.land) {                                // 내려앉는 순간: 옆으로 깔리는 먼지
    u.land = 1;
    for (let i = 0; i < (m.mini ? 4 : 7); i++) { const an = Math.random() * TAU, s = 50 + 70 * Math.random(); VX.spark(m.x + Math.cos(an) * 6, m.y + 3 + Math.sin(an) * 3, Math.cos(an) * s, Math.sin(an) * s * 0.45 - 12, 0.25 + 0.25 * Math.random(), 1.2 + 1.2 * Math.random(), dust, 30, 5, 0); }
  }
  const la = (t - u.born - D) / 0.32, out = Math.min(1, m.t / 0.25), sq = la < 1 ? Math.sin(la * Math.PI * 2) * 0.16 * (1 - la) : 0;
  if (la < 1) { const fd = VX.fade(la), d = (7 + 15 * VX.ease(la)) * sc0, rr = (8 + 7 * la) * sc0; VX.glow(m.x - d, m.y + 4, rr, dust, 0.7 * fd, rr * 0.55); VX.glow(m.x + d, m.y + 4, rr, dust, 0.7 * fd, rr * 0.55); }   // 양옆으로 깔리는 먼지
  const cyc = m.t < 3 ? 0.24 : 1.15, bp = ((t / cyc + m.ph) % 1 + 1) % 1, on = RM.matches ? 0.6 : bp < 0.34 ? Math.sin(bp / 0.34 * Math.PI) : 0, sc = sc0 * out;
  ctx.fillStyle = shadow + (0.3 * out).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(m.x, m.y + 3.5, 11.5 * sc, 5.5 * sc, 0, 0, TAU); ctx.fill();
  VX.add();
  if (bp < 0.8) VX.wave(m.x, m.y, (9 + 14 * VX.ease(bp / 0.8, 2)) * sc, col, (L ? 0.5 : 0.4) * (1 - bp / 0.8) * out, 1);   // 감지 범위로 퍼지는 옅은 물결
  VX.glow(m.x, m.y, (9 + 9 * on) * sc, '#ff4d4d', 0.7 * on);
  VX.norm();
  if (sq) { ctx.save(); ctx.translate(m.x, m.y); ctx.scale(1 + sq, 1 - sq); mineBody(0, 0, sc, m.ph, on, L, col); ctx.restore(); }
  else mineBody(m.x, m.y, sc, m.ph, on, L, col);
}
// 멈춘 빔의 끝: 처음 볼 때 둘레의 빛 알갱이가 끝점으로 모여들고, 끝의 빛 덩이는 오므라들며 옅어진다
function beamAbsorb(f, p, u) {
  const col = f.c === '#ffffff' ? C.WEAPONS.laser.color : f.c, x = f.x, y = f.y0, q = 1 - p;
  if (u.n) {
    for (let i = 0, n = 5 + Math.floor(Math.random() * 4); i < n; i++) {
      const an = Math.PI * (1.05 + 0.9 * Math.random()), d = 16 + 20 * Math.random(), life = 0.12 + 0.12 * Math.random();
      VX.spark(x + Math.cos(an) * d, y + Math.sin(an) * d * 0.8, -Math.cos(an) * d / life, -Math.sin(an) * d * 0.8 / life, life, 1 + Math.random(), Math.random() < 0.5 ? VX.hot(col) : col, 0, 1.6, 1);
    }
  }
  VX.add();
  VX.glow(x, y - 2, (9 + 16 * p) * (0.9 + 0.2 * u.sd), col, 0.55 * p, (7 + 10 * p));
  hotSpot(x, y, 4 + 6 * p - 2 * q, col, 0.9 * p);
  VX.norm();
}
/* ---------- 산성 분사기: 산성비, 점액 자국, 용해 ---------- */
// 산성비: 레인이 옅게 물들고, 비스듬한 빗줄기가 저마다 다른 빠르기로 떨어지며, 바닥에 작은 물방울 고리가 퍼졌다 사라진다
function drawRain(p) {
  const u = VX.ui(p), t = VX.t, L = VX.light, col = p.c, H = C.H, LW = C.LW, x0 = p.x - LW / 2, sd = u.sd * 53, age = p.d - p.t;
  const al = Math.min(1, age / 0.4, p.t / 0.5);
  VX.add(); VX.column(p.x, 0, H, LW * 0.55, col, (L ? 0.2 : 0.13) * al); VX.norm();
  ctx.lineCap = 'round'; ctx.lineWidth = 1.3; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.3) : VX.mix(col, 0.35), 0.7 * al); ctx.beginPath();
  for (let i = 0; i < 26; i++) {
    const h1 = hash(sd + i * 3.7), h2 = hash(sd + i * 7.1), sp = 420 + 260 * h2, len = 9 + 11 * h1;
    const y = ((t * sp + h2 * H * 3) % (H + 40)) - 20, x = x0 + 6 + (LW - 12) * h1 + (y / H) * 5;
    ctx.moveTo(x, y); ctx.lineTo(x + 2.5, y + len);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const tt = t * 3.4 + i * 0.37 + sd, cyc = Math.floor(tt), ph = tt - cyc, rr = 2 + 7 * ph;
    const x = x0 + 8 + (LW - 16) * hash(cyc * 1.3 + i), y = H * (0.15 + 0.8 * hash(cyc * 2.9 + i * 5));
    ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.4, 0, 0, TAU); ctx.strokeStyle = rgba(L ? VX.mix(col, -0.3) : col, 0.6 * al * (1 - ph)); ctx.stroke();
  }
  ctx.lineCap = 'butt';
}
// 점액 자국: 울퉁불퉁한 옅은 얼룩 두 겹. 생길 때 조금 번지고 서서히 옅어진다
function drawSlime(p) {
  const u = VX.ui(p), age = p.d - p.t, al = Math.min(1, age / 0.2, p.t / 0.6), L = VX.light, col = p.c;
  ctx.beginPath(); blobTo(p.x, p.y, p.r * (0.7 + 0.3 * Math.min(1, age / 0.3)), u.sd * 7, 7, 0.28);
  ctx.fillStyle = rgba(col, (L ? 0.24 : 0.2) * al); ctx.fill();
  ctx.beginPath(); blobTo(p.x + (hash(u.sd * 9) - 0.5) * 6, p.y + (hash(u.sd * 5) - 0.5) * 4, p.r * 0.42, u.sd * 13, 6, 0.3);
  ctx.fillStyle = rgba(L ? VX.mix(col, -0.2) : col, (L ? 0.3 : 0.26) * al); ctx.fill();
}
// 용해: 몸(적의 색)이 납작하게 녹아 가라앉고, 산 자국이 번지며 거품이 올라와 터진다
function drawDissolve(f, p) {
  const u = VX.ui(f), q = 1 - p, col = seenCol(f.c), L = VX.light, hot = L ? VX.mix(col, -0.3) : VX.hot(col), ec = ECOL[f.et] || col;
  if (u.n) for (let i = 0; i < 8; i++) VX.spark(f.x + (Math.random() - 0.5) * f.r, f.y + (Math.random() - 0.5) * f.r * 0.6, (Math.random() - 0.5) * 30, -30 - 50 * Math.random(), 0.4 + 0.4 * Math.random(), 1.5 + 1.5 * Math.random(), hot, -20, 1, 0);
  const e = VX.ease(Math.min(1, q / 0.6), 2), r = f.r, by = f.y + r;
  ctx.beginPath(); ctx.ellipse(f.x, by - 2, r * (1 + 0.9 * e), r * (0.32 + 0.22 * e), 0, 0, TAU); ctx.fillStyle = rgba(col, 0.45 * p); ctx.fill();   // 녹은 자국
  const h = r * 0.7 * (1 - e), w = r * (1.05 + 0.45 * e);
  if (h > 0.6) {                              // 몸: 반쯤 녹은 둥근 덩어리가 가라앉는다
    ctx.beginPath(); ctx.ellipse(f.x, by - 2, w, h, 0, Math.PI, TAU); ctx.closePath();
    ctx.fillStyle = rgba(ec, 0.3 * p); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = rgba(ec, 0.85 * p); ctx.stroke();
  }
  ctx.lineWidth = 1.3; ctx.strokeStyle = rgba(hot, 0.8 * p); ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const ph = (q * 1.6 + hash(u.sd * 31 + i)) % 1, bx = f.x + (hash(u.sd * 17 + i * 3) - 0.5) * w * 1.4, bY = by - 2 - ph * r * 1.4, br = 1.5 + 3 * ph;
    ctx.moveTo(bx + br, bY); ctx.arc(bx, bY, br, 0, TAU);
  }
  ctx.stroke();
}
// 용해 폭발: 산이 터지며 퍼지고, 산 방울이 포물선으로 튀어 떨어진 자리에 작은 얼룩을 남긴다. 큰 폭발 단계(lv)가 오를수록 방울이 많고 멀리 튄다
function drawDsvBurst(f) {
  const u = VX.ui(f), T = f.d - f.t, R = f.r, col = seenCol(f.c), L = VX.light, lv = f.lv || 0, sd = u.sd * 41, dc = L ? VX.mix(col, -0.25) : col;
  if (u.n) for (let i = 0; i < 5 + lv; i++) { const a = Math.random() * TAU, sp = R * (2 + 2 * Math.random()); VX.spark(f.x, f.y, Math.cos(a) * sp, Math.sin(a) * sp * 0.7, 0.14 + 0.1 * Math.random(), 1.6, L ? dc : VX.hot(col), 0, 6, 1); }
  if (T < 0.42) {
    const q = T / 0.42, e = VX.ease(q, 3);
    VX.add();
    VX.glow(f.x, f.y, R * (0.5 + 0.5 * e), col, (L ? 0.7 : 0.6) * (1 - q));
    hotSpot(f.x, f.y, R * (0.24 + 0.16 * e), col, (1 - q) * (1 - q));
    VX.wave(f.x, f.y, R * (0.3 + 0.75 * e) / 0.95, col, 0.85 * VX.fade(q), 0.35 + 0.65 * q);
    VX.norm();
  }
  const n = 4 + 3 * lv, fade = Math.min(1, f.t / 0.5);
  ctx.beginPath(); let st = false;
  for (let i = 0; i < n; i++) {               // 떨어진 방울의 얼룩
    const h1 = hash(sd + i * 1.3), h2 = hash(sd + i * 2.7), h3 = hash(sd + i * 4.1), tau = 0.3 + 0.26 * h3;
    if (T < tau) continue;
    const a = h1 * TAU, d = R * (0.55 + 0.7 * h2) * (1 + 0.08 * lv), lx = f.x + Math.cos(a) * d, ly = f.y + Math.sin(a) * d * 0.75, g = Math.min(1, (T - tau) / 0.1);
    const rx = (3.2 + 2.6 * h3 + 0.3 * lv) * (0.5 + 0.5 * g); ctx.moveTo(lx + rx, ly); ctx.ellipse(lx, ly, rx, rx * 0.55, 0, 0, TAU); st = true;
  }
  if (st) { ctx.fillStyle = rgba(dc, (L ? 0.5 : 0.42) * fade); ctx.fill(); }
  ctx.beginPath(); st = false;
  for (let i = 0; i < n; i++) {               // 날아가는 방울
    const h1 = hash(sd + i * 1.3), h2 = hash(sd + i * 2.7), h3 = hash(sd + i * 4.1), tau = 0.3 + 0.26 * h3, w = T / tau;
    if (w >= 1) continue;
    const a = h1 * TAU, d = R * (0.55 + 0.7 * h2) * (1 + 0.08 * lv), hh = 16 + 30 * h2 + 4 * lv, gx = f.x + Math.cos(a) * d * w, gy = f.y + Math.sin(a) * d * 0.75 * w - 4 * hh * w * (1 - w);
    const rr = 1.6 + 1.4 * h3 + 0.15 * lv; ctx.moveTo(gx + rr, gy); ctx.arc(gx, gy, rr, 0, TAU); st = true;
  }
  if (st) { ctx.fillStyle = rgba(dc, 0.95); ctx.fill(); }
}
// 용해 직전: 용해 무기의 웅덩이 안에서 체력이 문턱의 2배 아래로 내려온 적은 녹기 시작한다 (문턱에 가까울수록 많이 녹는다. 문턱이 크면 일찍부터). 0~1
let meltCol = '';
function meltOf(e, list) {
  const hp = e.hp / e.maxHp; let m = 0;
  for (const p of list) {
    const d = p.st.dsv; if (hp > 2 * d) continue;
    const dx = e.x - p.x, dy = e.y - p.y, rr = p.r + e.r * 0.5; if (dx * dx + dy * dy > rr * rr) continue;
    const v = Math.min(1, (2 * d - hp) / d); if (v > m) { m = v; meltCol = p.c; }
  }
  return m;
}
// 녹는 적: 몸이 바닥 쪽으로 처지고, 밑에서 산이 방울져 흘러내려 떨어지며, 몸에서 거품이 오른다
function drawMelting(e, m) {
  const by = e.y + e.r, sy = 1 - 0.3 * m, sx = 1 + 0.14 * m, col = seenCol(meltCol), L = VX.light, t = VX.t, sd = VX.ui(e).sd * 40, dc = L ? VX.mix(col, -0.2) : col;
  ctx.beginPath(); ctx.ellipse(e.x, by - 1, e.r * (0.6 + 0.7 * m), e.r * (0.2 + 0.18 * m), 0, 0, TAU); ctx.fillStyle = rgba(col, 0.12 + (L ? 0.32 : 0.26) * m); ctx.fill();
  ctx.save(); ctx.translate(e.x, by); ctx.scale(sx, sy); ctx.translate(-e.x, -by); drawEnemy(e); ctx.restore();
  const n = 2 + Math.round(2 * m), y0 = by - 3, w = 1.3 + 1.1 * m;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const h1 = hash(sd + i * 3.7), xx = e.x + (h1 - 0.5) * e.r * 1.1 * sx, ph = (t * (0.8 + 0.5 * h1) + hash(sd + i)) % 1, L0 = e.r * (0.25 + 0.4 * m);
    if (ph < 0.75) {                          // 늘어지는 방울
      const len = L0 * (0.3 + 0.7 * ph / 0.75);
      ctx.moveTo(xx - w, y0); ctx.lineTo(xx + w, y0); ctx.lineTo(xx + w * 0.45, y0 + len); ctx.arc(xx, y0 + len, w * 0.8, 0, Math.PI); ctx.closePath();
    } else {                                  // 떨어지는 방울
      const fy = y0 + L0 + (ph - 0.75) / 0.25 * e.r * 0.45; ctx.moveTo(xx + w * 0.75, fy); ctx.arc(xx, fy, w * 0.75, 0, TAU);
    }
  }
  ctx.fillStyle = rgba(dc, 0.9); ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.35) : VX.hot(col), 0.85); ctx.beginPath();
  for (let i = 0; i < 1 + Math.round(2 * m); i++) {
    const ph = (t * 1.5 + hash(sd + i * 5.1)) % 1, bx = e.x + (hash(sd + i * 2.3) - 0.5) * e.r * sx, bY = by - 4 - ph * e.r * 1.1 * sy, br = 1 + 2 * ph;
    ctx.moveTo(bx + br, bY); ctx.arc(bx, bY, br, 0, TAU);
  }
  ctx.stroke();
}
// 산성 웅덩이: 일렁이는 웅덩이와 거품. 용해를 찍은 무기의 웅덩이는 끓어오른다 (용해 단계에 비례해 거품이 많고 빠르고, 터지며 작은 고리를 남긴다).
// 연쇄 용해의 웅덩이(fl)는 폭발 자리에서 흘러나오듯 손가락처럼 뻗으며 번진다
const PPX = new Float32Array(14), PPY = new Float32Array(14);
function drawAcidPool(p, nowT) {
  const al = Math.min(1, p.t / 0.6), wob = RM.matches ? 0 : 1, b = p.st.dsv ? Math.min(1, p.st.dsv / 0.15) : 0, L = VX.light;
  let rs = 1, fl = 0;
  if (p.fl && p.d) { const g = VX.ease(Math.min(1, (p.d - p.t) / 0.5), 2); rs = 0.22 + 0.78 * g; fl = 1 - g; }
  const R = p.r * rs, ts = nowT / (320 - 140 * b), amp = 0.05 + 0.03 * b, n = 14;
  for (let k = 0; k < n; k++) {               // 가장자리 점들 (번지는 중에는 손가락처럼 고르지 않게)
    const a = k * TAU / n, rr = R * (1 + wob * amp * Math.sin(ts + k * 1.9 + p.sd * 9) + fl * 0.34 * (hash(p.sd * 40 + k * 1.7) - 0.4));
    PPX[k] = p.x + Math.cos(a) * rr; PPY[k] = p.y + Math.sin(a) * rr;
  }
  ctx.beginPath(); ctx.moveTo((PPX[n - 1] + PPX[0]) / 2, (PPY[n - 1] + PPY[0]) / 2);   // 이웃 점의 가운데를 잇는 곡선 (각지지 않게)
  for (let k = 0; k < n; k++) { const j = (k + 1) % n; ctx.quadraticCurveTo(PPX[k], PPY[k], (PPX[k] + PPX[j]) / 2, (PPY[k] + PPY[j]) / 2); }
  ctx.closePath(); ctx.fillStyle = rgba(p.c, (0.26 + 0.06 * b) * al); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = rgba(p.c, 0.75 * al); ctx.stroke();
  ctx.beginPath(); ctx.arc(p.x, p.y, R * 0.62, 0, TAU); ctx.fillStyle = rgba(L && b ? VX.mix(p.c, -0.15) : p.c, (0.14 + 0.12 * b) * al); ctx.fill();
  const nb = 6 + Math.round(10 * b); ctx.beginPath();
  let pop = null;
  for (let k = 0; k < nb; k++) {
    const boil = k >= 6, per = boil ? 480 + 260 * hash(p.sd * 20 + k) : 1100, ph = (nowT / per + k * 0.17 + p.sd) % 1;
    const a = hash(p.sd * 50 + k * 7.3) * TAU, d = Math.sqrt(hash(p.sd * 30 + k * 2.9)) * R * 0.8;
    const bx = p.x + Math.cos(a) * d, by = p.y + Math.sin(a) * d * 0.9 - ph * (boil ? 3 : 5), br = boil ? 1.2 + 3.6 * ph : 2 + 5 * ph;
    if (boil && ph > 0.86) { (pop || (pop = [])).push(bx, by, br * (1 + (ph - 0.86) * 9)); continue; }   // 터지는 거품
    ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, TAU);
  }
  ctx.fillStyle = rgba(p.c, 0.3 * al); ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(p.c, 0.9 * al); ctx.stroke();
  if (pop) {
    ctx.beginPath(); for (let i = 0; i < pop.length; i += 3) { ctx.moveTo(pop[i] + pop[i + 2], pop[i + 1]); ctx.arc(pop[i], pop[i + 1], pop[i + 2], 0, TAU); }
    ctx.lineWidth = 1; ctx.strokeStyle = rgba(L ? VX.mix(p.c, -0.25) : VX.hot(p.c), 0.6 * al); ctx.stroke();
  }
}
// 폭우의 고이는 웅덩이 (T10d): 같은 비의 덩이들을 따로 캔버스에 하나로 이어 그려 (겹친 곳에 테두리가 생기지 않고 번져 이어진다) 한 번에 옮긴다.
// 덩이마다 가장자리를 고르지 않게 흐트러뜨리고 (정해진 굴곡 + 천천히 일렁임), 비가 오는 동안에는 빗방울이 떨어져 물결이 번진다.
// 그친 뒤에는 줄어들며, 가장 컸던 자리에 옅은 젖은 자국이 남았다가 함께 사라진다. 판정 반경(p.r)과 그림의 반경이 같다
const PUD_K = 12, PUD_M = 48, PUD_F = new Float32Array(PUD_M * PUD_K), PUD_C = new Float32Array(PUD_M * PUD_K), PUD_S = new Float32Array(PUD_M * PUD_K), PUD_L = [], PUD_CV = [];
let pudFr = 0, pudN = 0;
function pudPath(g2, n, big, s, add) {
  g2.beginPath();
  for (let i = 0; i < n; i++) {
    const p = PUD_L[i], R = (big ? p.rm : p.r) * s, o = i * PUD_K; if (R + add < 0.6) continue;
    let px = 0, py = 0;
    for (let k = 0; k <= PUD_K + 1; k++) {   // 이웃 점의 가운데를 잇는 곡선 (각지지 않게)
      const j = o + k % PUD_K, rr = R * PUD_F[j] + add, qx = p.x + PUD_C[j] * rr, qy = p.y + PUD_S[j] * rr;
      if (k === 1) g2.moveTo((px + qx) / 2, (py + qy) / 2);
      else if (k > 1) g2.quadraticCurveTo(px, py, (px + qx) / 2, (py + qy) / 2);
      px = qx; py = qy;
    }
    g2.closePath();
  }
}
function drawPuddles(g, nowT) {
  const u = VX.ui(g); if (u.fr === pudFr) return; u.fr = pudFr;
  const L = PUD_L; L.length = 0;
  for (const p of C.S.pools) if (p.rp === g && L.length < PUD_M) L.push(p);
  const n = L.length; if (!n) return;
  const p0 = L[0], age = p0.d - p0.t, dry = age > g.gr ? Math.min(1, (age - g.gr) / C.PUD_DRY) : 0, col = p0.c, Lt = VX.light, wob = RM.matches ? 0 : 1, ts = nowT / 320;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) {
    const p = L[i], e = (dry ? p.rm : p.r) * 1.2 + 3, o = i * PUD_K;
    for (let k = 0; k < PUD_K; k++) {
      const a = k * TAU / PUD_K + p.sd * 9;
      PUD_C[o + k] = Math.cos(a); PUD_S[o + k] = Math.sin(a);
      PUD_F[o + k] = 1 + 0.3 * (hash(p.sd * 40 + k * 1.7) - 0.5) + wob * 0.045 * Math.sin(ts + k * 1.9 + p.sd * 9);
    }
    if (e < 4) continue;
    if (p.x - e < x0) x0 = p.x - e; if (p.x + e > x1) x1 = p.x + e; if (p.y - e < y0) y0 = p.y - e; if (p.y + e > y1) y1 = p.y + e;
  }
  if (x1 < x0) return;
  const k = dpr * sc, cw = Math.ceil((x1 - x0) * k), ch = Math.ceil((y1 - y0) * k);
  let cv2 = PUD_CV[pudN]; if (!cv2) { cv2 = PUD_CV[pudN] = document.createElement('canvas'); cv2.width = cv2.height = 1; cv2.g = cv2.getContext('2d'); }
  pudN++;
  if (cv2.width < cw || cv2.height < ch) { cv2.width = Math.max(cv2.width, cw); cv2.height = Math.max(cv2.height, ch); }
  const g2 = cv2.g;
  g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, cw, ch);
  g2.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  if (dry) { pudPath(g2, n, 1, 1, 0); g2.fillStyle = rgba(col, (Lt ? 0.16 : 0.12) * (1 - dry)); g2.fill(); }   // 젖은 자국 (가장 컸던 자리)
  pudPath(g2, n, 0, 1, 1.1); g2.fillStyle = rgba(col, 0.75); g2.fill();   // 가장자리 띠: 바깥 덩어리에서 안쪽 덩어리를 파낸다
  pudPath(g2, n, 0, 1, -1.1); g2.globalCompositeOperation = 'destination-out'; g2.fillStyle = '#000'; g2.fill();
  g2.globalCompositeOperation = 'source-over'; g2.fillStyle = rgba(col, 0.26); g2.fill();
  pudPath(g2, n, 0, 0.62, 0); g2.fillStyle = rgba(col, 0.14); g2.fill();
  ctx.drawImage(cv2, 0, 0, cw, ch, x0, y0, cw / k, ch / k);
  // 비가 오는 동안: 빗방울이 떨어진 자리에 물결 (덩이마다 하나씩 번갈아, 퍼지며 옅어진다). 거품은 늘
  const tS = VX.t, hot = Lt ? VX.mix(col, -0.3) : VX.hot(col);   // 물결은 게임 시간 (멈추면 같이 멈춘다)
  ctx.lineWidth = 1;
  if (!dry && !RM.matches) for (let i = 0; i < n; i++) {
    const p = L[i]; if (p.r < 7) continue;
    const per = 0.45 + 0.35 * hash(p.sd * 7), tt = tS / per + hash(p.sd * 3), cyc = Math.floor(tt), ph = tt - cyc;
    const a = hash(cyc * 1.7 + p.sd * 11) * TAU, d = Math.sqrt(hash(cyc * 2.3 + p.sd * 5)) * 0.6 * p.r, rr = 1.5 + (2.5 + 0.22 * p.r) * VX.ease(ph, 2);
    ctx.beginPath(); ctx.ellipse(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.8, rr, rr * 0.5, 0, 0, TAU);
    ctx.strokeStyle = rgba(hot, 0.65 * (1 - ph)); ctx.stroke();
  }
  ctx.beginPath(); let any = false;
  for (let i = 0; i < n; i++) {
    const p = L[i]; if (p.r < 9) continue;
    const ph = (nowT / 1100 + hash(p.sd * 13)) % 1, cyc = Math.floor(nowT / 1100 + hash(p.sd * 13)), a = hash(cyc + p.sd * 17) * TAU, d = Math.sqrt(hash(cyc * 1.3 + p.sd * 19)) * 0.55 * p.r;
    const bx = p.x + Math.cos(a) * d, by = p.y + Math.sin(a) * d * 0.8 - ph * 4, br = 1.3 + 3 * ph * Math.min(1, p.r / 25);
    ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, TAU); any = true;
  }
  if (any) { ctx.fillStyle = rgba(col, 0.3); ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = rgba(col, 0.9); ctx.stroke(); }
}
/* ---------- 저격포: 저격선, 넘어가는 피해, 점사, 연속 사냥, 조준 레이저 (고정, 표식 이전, 균열) ---------- */
// 저격선: 굵고 밝은 선이 서서히 사라지고 가는 흔적이 잠깐 남는다. 포구에 반동 표시. ri: 넘어가는 피해 (가늘고, 넘어간 자리에 불티)
// bu: 점사 무기의 발 (1, 2, 3번째). 발마다 총구 불꽃이 터지고 탄피가 튀고 화약 연기가 조금 오른다 (반동 표시 대신)
function drawRailFx(f, p) {
  const u = VX.ui(f), col = seenCol(f.c), k = f.ri ? 0.55 : 1, a = Math.atan2(f.x1 - f.x0, f.y0 - f.y1);
  if (u.n) {
    VX.trail(f.x0, f.y0, f.x1, f.y1, f.ri ? 1.8 : 3, col, 0.5, 1);
    if (f.ri) for (let i = 0; i < 5; i++) { const b = Math.random() * TAU, s = 80 + 160 * Math.random(); VX.spark(f.x0, f.y0, Math.cos(b) * s, Math.sin(b) * s, 0.15 + 0.15 * Math.random(), 1.3, VX.hot(col), 0, 4, 1); }
    if (f.bu) railMuzBurst(f, a, col);
  }
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1);
  ctx.lineWidth = (14 * p + 2) * k; ctx.strokeStyle = rgba(col, 0.35 * p); ctx.stroke();
  ctx.lineWidth = (5 * p + 1) * k; ctx.strokeStyle = rgba(col, 0.95 * p); ctx.stroke();
  ctx.lineWidth = (2 * p + 0.5) * k; ctx.strokeStyle = `rgba(255,255,255,${p})`; ctx.stroke();
  if (f.ri) { VX.add(); hotSpot(f.x0, f.y0, 9 + 8 * (1 - p), col, p); VX.norm(); }   // 넘어간 자리
  if (f.bu) drawRailMuz(f, p, a, u.sd);
  else if (f.rc) {
    const q = 1 - p;
    ctx.lineWidth = 3; ctx.strokeStyle = rgba(col, p); ctx.beginPath();
    ctx.moveTo(f.x0 - 10, f.y0 - 4); ctx.lineTo(f.x0, f.y0 - 14 - 8 * q); ctx.lineTo(f.x0 + 10, f.y0 - 4); ctx.stroke();
    ctx.beginPath(); ctx.arc(f.x0, f.y0 - 6, 6 + 10 * q, Math.PI, Math.PI * 2); ctx.lineWidth = 2; ctx.stroke();
  }
}
// 점사 한 발의 처음: 총구 앞으로 튀는 불티, 옆으로 튀는 큰 탄피
function railMuzBurst(f, a, col) {
  const sx = Math.sin(a), sy = -Math.cos(a), mx = f.x0 + sx * 11, my = f.y0 + sy * 11, F = fireCol();
  casingAdd(f.x0, f.y0 - 8, a, 1);
  for (let i = 0; i < 4; i++) {
    const b = a + (Math.random() - 0.5) * 0.7, s = 160 + 200 * Math.random();
    VX.spark(mx, my, Math.sin(b) * s, -Math.cos(b) * s, 0.07 + 0.08 * Math.random(), 1.2, i ? F.e : VX.hot(col), 0, 7, 1);
  }
}
// 점사의 총구 불꽃: 앞으로 뻗는 불꽃 혀와 양옆 제동기에서 옆으로 터지는 짧은 불꽃 (발마다 길이와 기울기가 다르다), 그 뒤 옅은 화약 연기가 흔들리며 오른다
function drawRailMuz(f, p, a, sd0) {
  const L = VX.light, F = fireCol(), q = 1 - p, sd = sd0 * 61 + (f.bu || 0) * 7.7, sx = Math.sin(a), sy = -Math.cos(a), nx = -sy, ny = sx;
  const mx = f.x0 + sx * 11, my = f.y0 + sy * 11;
  if (p > 0.45) {
    const e = (p - 0.45) / 0.55, g = 0.8 + 0.2 * VX.ease(Math.min(1, q * 4), 2);
    VX.add(); hotSpot(mx, my, (12 + 5 * hash(sd)) * (0.6 + 0.4 * e), F.o, 0.95 * e); VX.norm();
    for (let pass = 0; pass < 2; pass++) {
      const ks = pass ? 0.5 : 1;
      ctx.beginPath();
      const len = (27 + 13 * hash(sd + 1)) * g * ks, ab = a + (hash(sd + 2) - 0.5) * 0.16;
      flameTo(mx, my, mx + Math.sin(ab) * len, my - Math.cos(ab) * len, (pass ? 1.7 : 3.8), (hash(sd + 3) - 0.5) * 3);
      for (const sg of [-1, 1]) {               // 제동기 옆 불꽃
        const l2 = (11 + 8 * hash(sd + 4 + sg)) * g * ks, b = a + sg * (1.25 + 0.35 * hash(sd + 6 + sg));
        flameTo(mx - sx * 2, my - sy * 2, mx - sx * 2 + Math.sin(b) * l2, my - sy * 2 - Math.cos(b) * l2, pass ? 1.1 : 2.5, sg * 1.5);
      }
      ctx.fillStyle = pass ? (L ? rgba(F.o, 0.95 * e) : `rgba(255,250,230,${0.95 * e})`) : rgba(L ? F.e : F.o, 0.85 * e); ctx.fill();
    }
  }
  const sc = L ? '#7b8798' : '#c9d1db';         // 화약 연기: 퍼지며 옅어진다
  for (let i = 0; i < 3; i++) {
    const h = hash(sd + 11 + i), d = q * (10 + 14 * h), side = (h - 0.5) * 2;
    const x = mx + sx * d * 0.6 + nx * side * (4 + 10 * q) + Math.sin(q * 6 + i * 2) * 2, y = my + sy * d * 0.6 + ny * side * (4 + 10 * q) - q * (6 + 8 * h);
    VX.glow(x, y, 4 + 9 * q * (0.7 + 0.6 * h), sc, (L ? 0.32 : 0.2) * Math.sin(Math.PI * Math.min(1, q * 1.15)) * (0.6 + 0.4 * h));
  }
}
// 연속 사냥: 저격으로 처치한 자리에 작은 ✕ 자국. 두 획이 차례로 빠르게 그어지고 (기울기와 길이가 조금씩 다르다), 남았다가 옅어진다
function drawHuntX(f, p) {
  const u = VX.ui(f), q = 1 - p, sd = u.sd * 37, col = seenCol(f.c), L = VX.light, T = q * f.d;
  const s = 4.5 + Math.min(4, f.r * 0.22), rot = (hash(sd) - 0.5) * 0.5, al = Math.min(1, p / 0.55);
  if (u.n) for (let i = 0; i < 4; i++) { const b = Math.random() * TAU, v = 40 + 70 * Math.random(); VX.spark(f.x, f.y, Math.cos(b) * v, Math.sin(b) * v, 0.15 + 0.1 * Math.random(), 1, VX.hot(col), 0, 6, 1); }
  ctx.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      const g = Math.max(0, Math.min(1, (T - i * 0.06) / 0.07)); if (!g) continue;
      const ang = rot + (i ? -1 : 1) * (0.78 + (hash(sd + 1 + i) - 0.5) * 0.25), l = s * (0.9 + 0.25 * hash(sd + 3 + i));
      const cx = Math.cos(ang) * l, cy = Math.sin(ang) * l;
      ctx.moveTo(f.x - cx, f.y - cy); ctx.lineTo(f.x - cx + 2 * cx * VX.ease(g, 2), f.y - cy + 2 * cy * VX.ease(g, 2));
    }
    if (pass === 0) { ctx.lineWidth = 4.2; ctx.strokeStyle = L ? rgba('#ffffff', 0.55 * al) : rgba(col, 0.25 * al); }
    else { ctx.lineWidth = 1.9; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.15) : VX.hot(col), 0.95 * al); }
    ctx.stroke();
  }
}
// 연속 사냥의 연속 처치 눈금: 무기 왼쪽 기지 선 위에 다섯 획 묶음 (넷은 세로, 다섯째는 가로질러 긋는다)
// 새 획은 위에서 내려 그어지며 한 번 빛나고, 연속이 끊기거나 한동안 처치가 없으면 흩어지며 옅어진다
function drawStreak(x, H, w, col) {
  const t = C.S.t, live = w.hs > 0, n = Math.min(5, live ? w.hs : w.hsL || 0); if (!n) return;
  const age = t - (w.hsT == null ? -9 : w.hsT), end = live ? 0 : t - (w.hsE == null ? -9 : w.hsE);
  const al = live ? (age < 3.5 ? 1 : Math.max(0, 1 - (age - 3.5) / 0.6)) : Math.max(0, 1 - end / 0.55);
  if (al <= 0) return;
  const L = VX.light, c = L ? VX.mix(col, -0.2) : col, by = H - 6.5, x0 = x - 38, drop = live ? 0 : end * 10;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const fresh = live && i === n - 1 ? Math.min(1, age / 0.12) : 1, sd = hash(i * 3.1 + 0.7), dy = drop * (0.6 + sd);
    let ax, ay, bx, by2;
    if (i < 4) { ax = x0 + i * 5.6 + (sd - 0.5) * 1.2; ay = by - 10; bx = ax + 1.6 + (sd - 0.5); by2 = by; }
    else { ax = x0 - 3; ay = by - 2.5; bx = x0 + 20; by2 = by - 9; }
    const ex = ax + (bx - ax) * VX.ease(fresh, 2), ey = ay + (by2 - ay) * VX.ease(fresh, 2) + dy;
    ctx.beginPath(); ctx.moveTo(ax, ay + dy); ctx.lineTo(ex, ey);
    ctx.lineWidth = 4; ctx.strokeStyle = L ? rgba('#ffffff', 0.6 * al) : rgba(c, 0.22 * al); ctx.stroke();
    ctx.lineWidth = 1.9; ctx.strokeStyle = rgba(c, 0.95 * al); ctx.stroke();
    if (live && i === n - 1 && age < 0.3) { VX.add(); hotSpot(ex, ey, 5 + 4 * (1 - age / 0.3), c, 0.7 * (1 - age / 0.3)); VX.norm(); }
  }
}
// 조준 레이저 (T9e): 고정한 적까지 이어진 붉은 레이저와 겹수만큼 이어지는 표식 테두리 (다섯 조각, 천천히 돈다. 이어받은 겹의 끝수는 조각 일부).
//   새로 고정하면 테두리가 벌어졌다 조여 들고, 표식 이전이면 레이저 끝과 테두리가 죽은 자리에서 새 표적으로 미끄러진다 (지나온 자리에 옅은 자국).
//   균열: 겹마다 몸에 금이 하나씩 뻗고 (새 금은 가운데에서 자라 나온다), 겹이 다 차면 금 사이로 붉은 빛이 새어 나온다
const MARK_D = '#ff4660', MARK_L = '#d42a45', CRK = [];
function drawMark(k, w, st) {
  const e = w.mk; if (!e || e.dead || e.y + e.r <= 0) return;
  const u = VX.ui(w), now = C.S.t;
  if (u.lk !== e) { u.lk = e; u.lkT = now; u.cn = 0; }
  const x0 = (k + 0.5) * C.LW, y0 = C.H - 2, t = VX.t, L = VX.light, red = L ? MARK_L : MARK_D, n = Math.max(0, Math.min(5, w.mkN || 0));
  const mx = w.mkX, sl = mx ? Math.min(1, (now - mx.t) / 0.32) : 1, se = VX.ease(sl, 3);
  const tx = sl < 1 ? mx.x + (e.x - mx.x) * se : e.x, ty = sl < 1 ? mx.y + (e.y - mx.y) * se : e.y;
  ctx.lineCap = 'round';
  if (sl < 1) {                               // 미끄러진 자리: 옅어지는 가는 자국
    ctx.beginPath(); ctx.moveTo(mx.x, mx.y); ctx.lineTo(tx, ty);
    ctx.lineWidth = 2.5 * (1 - sl) + 0.5; ctx.strokeStyle = rgba(red, 0.4 * (1 - sl)); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(tx, ty);
  ctx.lineWidth = 3; ctx.strokeStyle = rgba(red, L ? 0.16 : 0.12); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = rgba(red, 0.5 + 0.15 * Math.sin(t * 9 + k)); ctx.stroke();
  const ql = mx ? 1 : Math.min(1, (now - u.lkT) / 0.28), R = e.r + 7 + 1.2 * Math.sin(t * 5 + k) + 15 * (1 - VX.ease(ql, 3)), a0 = t * 0.9 + k + 1.4 * (1 - ql);
  const nf = Math.floor(n + 1e-6), fr = n - nf;
  for (let i = 0; i < 5; i++) {
    const a = a0 + i * TAU / 5, on = i < nf, part = !on && i === nf && fr > 0.05, b = part ? TAU / 5 * 0.72 * fr : 0;
    if (part) {                               // 이어받은 겹의 끝수: 조각 일부만 밝게
      ctx.beginPath(); ctx.arc(tx, ty, R, a, a + b); ctx.lineWidth = 2; ctx.strokeStyle = rgba(red, 0.92); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(tx, ty, R + (on ? 0 : 1), a + b, a + TAU / 5 * (on ? 0.72 : 0.35));
    ctx.lineWidth = on ? 2 : 1; ctx.strokeStyle = rgba(red, on ? 0.92 * (0.4 + 0.6 * ql) : 0.3); ctx.stroke();
  }
  if (st.crk && sl >= 1) drawCracks(e, u, n, red, now);
  VX.add(); VX.glow(tx, ty, 10, red, 0.35 + 0.1 * n); VX.norm();
}
// 균열의 금: 적마다 정해진 무늬. 금마다 가장자리의 한 점에서 시작해 가운데를 비껴 안쪽으로 잘게 꺾이며 뻗고 (시작 쪽이 굵고 끝이 가늘다),
//   몇 개는 중간에서 짧은 잔가지가 갈라진다. 가운데 한 점에 모이지 않게 해서 거미 다리처럼 보이지 않게 한다. 몸 모양으로 잘라 그린다
const CRB = [];
function drawCracks(e, u, n, red, now) {
  const m = Math.min(5, Math.ceil(n - 1e-6)); if (m <= 0) return;
  if (m > u.cn) { u.cT = u.cn ? now : now - 1; u.cn = m; }   // 새 금이 생긴 때 (처음 볼 때 이미 있던 금은 다 자란 것으로)
  const sd = VX.ui(e).sd * 50, r = e.r, full = n >= 5 - 1e-6, L = VX.light, grow = Math.min(1, (now - u.cT) / 0.16);
  CRK.length = 0; CRB.length = 0;
  for (let i = 0; i < m; i++) {
    const g = i === m - 1 ? grow : 1, a0 = (i * 0.382 + hash(sd)) * TAU, sx = e.x + Math.cos(a0) * r * 1.05, sy = e.y + Math.sin(a0) * r * 1.05;
    const ad = a0 + Math.PI + (hash(sd + i * 2.3) - 0.5) * 1.3, dx = Math.cos(ad), dy = Math.sin(ad), len = r * (0.8 + 0.5 * hash(sd + i * 4.7)) * g;
    const seg = [sx, sy]; let j0 = 0;
    for (let k = 1; k <= 6; k++) {            // 잘게 꺾인 줄기: 옆으로 흔들리되 한쪽으로 멀리 가지 않는다
      j0 = j0 * 0.5 + (hash(sd + i * 9 + k) - 0.5) * r * 0.2;
      const d = len * k / 6; seg.push(sx + dx * d - dy * j0, sy + dy * d + dx * j0);
    }
    CRK.push(seg);
    if (g >= 1 && hash(sd + i * 11) > 0.3) {  // 잔가지: 줄기 중간에서 비스듬히
      const b = 4 + 2 * Math.floor(hash(sd + i * 19) * 2), bx = seg[b], by = seg[b + 1], ab = ad + (hash(sd + i * 13) > 0.5 ? 0.75 : -0.75), bl = r * (0.25 + 0.2 * hash(sd + i * 17));
      CRB.push([bx, by, bx + Math.cos(ab) * bl * 0.5 + Math.cos(ab + 1.6) * r * 0.05, by + Math.sin(ab) * bl * 0.5 + Math.sin(ab + 1.6) * r * 0.05, bx + Math.cos(ab - 0.2) * bl, by + Math.sin(ab - 0.2) * bl]);
    }
  }
  const trace = (list, upto) => { for (const c of list) { const nn = Math.min(c.length, upto); ctx.moveTo(c[0], c[1]); for (let j = 2; j < nn; j += 2) ctx.lineTo(c[j], c[j + 1]); } };
  const dark = L ? 'rgba(60,0,12,' : 'rgba(22,0,8,', pu = full ? 0.8 + 0.2 * Math.sin(now * 7 + sd) : 1;
  ctx.save(); enemyPath(e); ctx.clip();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (full) {                                 // 금 사이로 새는 붉은 빛
    ctx.beginPath(); trace(CRK, 99); trace(CRB, 99); ctx.lineWidth = 4.5; ctx.strokeStyle = rgba(red, (L ? 0.36 : 0.45) * pu); ctx.stroke();
  }
  ctx.beginPath(); trace(CRK, 8); ctx.lineWidth = full ? 2 : 1.7; ctx.strokeStyle = dark + (full ? 0.78 : 0.72) + ')'; ctx.stroke();   // 시작 쪽 (굵게)
  ctx.beginPath(); trace(CRK, 99); trace(CRB, 99); ctx.lineWidth = full ? 1.1 : 0.9; ctx.strokeStyle = dark + '0.7)'; ctx.stroke();      // 전체 (가늘게)
  if (full) { ctx.beginPath(); trace(CRK, 10); ctx.lineWidth = 0.8; ctx.strokeStyle = rgba(VX.hot(red), 0.95 * pu); ctx.stroke(); }    // 달아오른 심
  else if (!L) { ctx.beginPath(); trace(CRK, 10); ctx.lineWidth = 0.7; ctx.strokeStyle = rgba(VX.mix(red, 0.25), 0.8); ctx.stroke(); }   // 어두운 테마: 어두운 몸에 묻히지 않게 붉은 가는 선
  ctx.restore();
  if (full) { VX.add(); VX.glow(e.x, e.y, r * 1.1, red, (L ? 0.22 : 0.3) * pu); VX.norm(); }
}
// 균열 조각: 금이 간 몸에서 적 색 조각이 떨어져 나가 튀었다 떨어지고, 맞은 자리에 붉은 빛이 잠깐 번진다
function drawChip(f, p) {
  const u = VX.ui(f), T = f.d - Math.max(0, f.t), q = T / f.d, col = ECOL[f.et] || '#ff6b6b', L = VX.light, red = L ? MARK_L : MARK_D, sd = u.sd * 60, r = f.r;
  if (u.n) for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 40 + 60 * Math.random(); VX.spark(f.x + Math.cos(a) * r * 0.6, f.y + Math.sin(a) * r * 0.6, Math.cos(a) * v, Math.sin(a) * v, 0.25 + 0.2 * Math.random(), 1.2, VX.hot(red), 60, 3, 0); }
  if (T < 0.2) { VX.add(); hotSpot(f.x, f.y, r * (0.5 + 0.6 * T / 0.2), red, 0.7 * (1 - T / 0.2)); VX.norm(); }
  const nc = f.boss ? 7 : 4, al = Math.max(0, 1 - q * q);
  for (let i = 0; i < nc; i++) {               // 조각: 몸 가장자리에서 떨어져 나와 바깥 위로 튀고 돌며 떨어진다
    const a = (hash(sd + i * 3.3) - 0.5) * 3.4 - Math.PI / 2, v = 45 + hash(sd + i * 7.1) * 70, sz = (2.2 + hash(sd + i * 1.7) * 2.6) * (f.boss ? 1.4 : 1);
    const d = r * 0.75 + v * (1 - Math.exp(-4 * T)) / 4, px = f.x + Math.cos(a) * d, py = f.y + Math.sin(a) * d + 180 * T * T, rot = hash(sd + i + 5) * 6.3 + T * (hash(sd + i + 9) - 0.5) * 18;
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.beginPath(); ctx.moveTo(-sz, sz * 0.55); ctx.lineTo(sz, 0); ctx.lineTo(-sz * 0.25, -sz * 0.85); ctx.closePath();
    ctx.fillStyle = rgba(col, al); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = L ? `rgba(60,0,10,${0.6 * al})` : rgba(red, 0.7 * al); ctx.stroke(); ctx.restore();
  }
}
/* ---------- 전격기: 낙뢰, 전기장, 먹구름, 전기 줄, 구전 ---------- */
// 지그재그 경로 (낙뢰 줄기): 옆으로 흔들리며 내려가다 끝에서 표적에 모인다. 점은 out 에 [x0, y0, x1, y1, ...]
function jagPts(out, ax, ay, bx, by, amp, seg) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, n = Math.max(3, Math.round(len / seg));
  out.length = 0; out.push(ax, ay);
  let off = 0;
  for (let j = 1; j < n; j++) {
    const s = j / n; off = off * 0.6 + (Math.random() - 0.5) * 2 * amp;   // 꺾임이 이어지되 한쪽으로 멀리 달아나지 않는다
    const k = Math.min(1, (1 - s) * 4), sl = s + (Math.random() - 0.5) * 0.4 / n;   // 끝 쪽은 표적으로 모인다
    out.push(ax + dx * sl + nx * off * k, ay + dy * sl + ny * off * k);
  }
  out.push(bx, by);
  return out;
}
function tracePts(a, upto) {
  const n = a.length / 2, m = upto == null ? n : Math.max(1, Math.min(n, upto));
  ctx.moveTo(a[0], a[1]);
  for (let i = 1; i < Math.floor(m); i++) ctx.lineTo(a[i * 2], a[i * 2 + 1]);
  const i = Math.floor(m), fr = m - i;
  if (i < n && fr > 0) ctx.lineTo(a[i * 2 - 2] + (a[i * 2] - a[i * 2 - 2]) * fr, a[i * 2 - 1] + (a[i * 2 + 1] - a[i * 2 - 1]) * fr);
}
// 번개 선 세 겹: 넓은 빛, 몸통, 하얀 심지 (밝은 테마는 짙은 몸통). 경로는 미리 만들어 둔다
function boltStroke(col, a, w) {
  const L = VX.light;
  VX.add(); ctx.lineWidth = w * 3.2; ctx.strokeStyle = rgba(col, (L ? 0.3 : 0.24) * a); ctx.stroke(); VX.norm();
  ctx.lineWidth = w; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.4) : col, Math.min(1, a)); ctx.stroke();
  if (!L) { ctx.lineWidth = w * 0.45; ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, a).toFixed(3)})`; ctx.stroke(); }
}
// 낙뢰: 하늘(또는 먹구름)에서 갈라지며 내려꽂히는 줄기. 앞잡이가 빠르게 내려가고 → 번쩍 → 한 번 더 번쩍 → 가는 흔적이 잠깐 남는다
function drawThunder(f, p) {
  const u = VX.ui(f), T = f.d - f.t, L = VX.light, col = f.c, hot = VX.hot(col);
  if (u.n) {
    u.pts = jagPts([], f.x0, f.y0, f.x, f.y, 13, 20);
    u.br = [];
    const n = u.pts.length / 2;
    for (let i = 0, m = 2 + Math.floor(Math.random() * 2); i < m; i++) {   // 곁가지: 줄기 중간에서 비스듬히 아래로
      const j = Math.floor(n * (0.25 + 0.5 * Math.random())), side = Math.random() < 0.5 ? -1 : 1, a = Math.PI / 2 + side * (0.5 + 0.5 * Math.random()), l = 22 + 34 * Math.random();
      const x = u.pts[j * 2], y = u.pts[j * 2 + 1];
      u.br.push(jagPts([], x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 6, 9));
    }
    for (let i = 0; i < 9; i++) { const a = -Math.PI * Math.random(), s = 120 + 220 * Math.random(); VX.spark(f.x, f.y, Math.cos(a) * s, Math.sin(a) * s * 0.7, 0.18 + 0.2 * Math.random(), 1.5, i % 3 ? hot : col, 500, 3, 1); }
  }
  const lead = 0.05, n = u.pts.length / 2;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (T < lead) {                            // 앞잡이: 가늘고 흐린 줄기가 빠르게 내려간다
    ctx.beginPath(); tracePts(u.pts, 1 + (n - 1) * T / lead); boltStroke(col, 0.45, 1.3);
    return;
  }
  const s = (T - lead) / (f.d - lead), re = s > 0.28 && s < 0.42 ? 0.85 : 0;   // 한 번 더 번쩍 (같은 길로)
  const a = Math.max(re, VX.fade(s / 0.7)), trace = 0.22 * (1 - s);           // trace: 다 사라진 뒤에도 잠깐 남는 가는 흔적
  ctx.beginPath(); tracePts(u.pts);
  if (a > 0.02) boltStroke(col, a, 2.6); else boltStroke(col, trace, 1);
  if (a > 0.1) { ctx.beginPath(); for (const b of u.br) tracePts(b); boltStroke(col, a * 0.7, 1.3); }
  VX.add();
  const fl = Math.max(a, 0.15 * (1 - s));
  hotSpot(f.x, f.y, 12 + 10 * s, col, fl);                                   // 맞은 자리
  VX.glow(f.x, f.y, 34 + 26 * s, col, 0.5 * fl);
  if (a > 0.3) VX.glow(f.x0, f.y0 + 14, f.cl ? 40 : 46, col, (L ? 0.22 : 0.3) * a, f.cl ? 22 : 26);   // 하늘이 잠깐 밝아진다
  VX.norm();
  ctx.lineCap = 'butt';
}
// 전기장: 바닥에 옅게 번진 빛 위로 짧은 방전이 이리저리 튄다. 서서히 생기고 사라진다
function drawEField(p) {
  const u = VX.ui(p), t = VX.t, L = VX.light, col = p.c, hot = VX.hot(col), age = p.d - p.t, R = p.r, sd = u.sd * 97;
  const al = Math.min(1, age / 0.15) * Math.min(1, p.t / 0.6);
  VX.add(); VX.glow(p.x, p.y, R * (0.97 + 0.03 * Math.sin(t * 5 + sd)), col, (L ? 0.45 : 0.28) * al, R * 0.85); VX.norm();   // 빛 번짐 한 장 (전기장은 많이 깔려 그리기 비용을 아낀다)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  for (let i = 0; i < 2; i++) {             // 방전: 0.07초쯤마다 자리를 옮긴다 (줄마다 박자가 다르다)
    const cyc = Math.floor(t * (13 + 3 * i) + i * 0.37 + sd), h = (q) => hash(cyc * 3.1 + i * 17.3 + sd + q);
    if (h(9) < 0.25) continue;
    const a1 = h(1) * TAU, r1 = R * (0.15 + 0.7 * h(2)), a2 = a1 + (0.8 + 1.6 * h(3)) * (h(4) < 0.5 ? -1 : 1), r2 = R * (0.3 + 0.65 * h(5));
    boltTo(p.x + Math.cos(a1) * r1, p.y + Math.sin(a1) * r1 * 0.8, p.x + Math.cos(a2) * r2, p.y + Math.sin(a2) * r2 * 0.8, sd + i * 7, 5, t * 30);
  }
  ctx.lineWidth = L ? 1.5 : 1.3; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.35) : hot, 0.85 * al); ctx.stroke();
  if (al > 0.3 && VX.rate(5)) { const a = Math.random() * TAU, r = R * Math.sqrt(Math.random()) * 0.85; VX.spark(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.8, (Math.random() - 0.5) * 20, -18 - 26 * Math.random(), 0.3 + 0.3 * Math.random(), 1 + 0.8 * Math.random(), L ? VX.mix(col, -0.3) : hot, -10, 1, 2); }
  ctx.lineCap = 'butt';
}
// 전기 줄: 연쇄된 적 사이에서 굴곡이 계속 바뀌는 번개 줄. 닿는 폭만큼 빛이 넓다. 고압 방전이면 하얗고 굵다
function drawArc(p) {
  const u = VX.ui(p), t = VX.t, L = VX.light, col = p.c, sd = u.sd * 61, age = p.d - p.t;
  const al = Math.min(1, age / 0.06, p.t / 0.3), w = p.hw;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); boltTo(p.x0, p.y0, p.x1, p.y1, sd, 5 + w * 0.5, t * 16 + sd);
  VX.add(); ctx.lineWidth = w * 1.25; ctx.strokeStyle = rgba(col, (L ? 0.17 : 0.18) * al * (p.hv ? 1.3 : 1)); ctx.stroke(); VX.norm();   // 닿는 폭만큼의 옅은 빛
  if (p.hv) {                                // 고압: 짙은 테두리 안에 하얀 심지
    ctx.lineWidth = 3.8; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.35) : col, 0.95 * al); ctx.stroke();
    ctx.lineWidth = 1.8; ctx.strokeStyle = `rgba(255,255,255,${(0.95 * al).toFixed(3)})`; ctx.stroke();
  } else {
    ctx.lineWidth = L ? 1.6 : 1.8; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.35) : col, 0.9 * al); ctx.stroke();
    if (!L) { ctx.lineWidth = 0.8; ctx.strokeStyle = `rgba(255,255,255,${(0.8 * al).toFixed(3)})`; ctx.stroke(); }
  }
  if (hash(Math.floor(t * 9) * 1.7 + sd) > 0.55) {   // 가끔 곁줄 하나
    ctx.beginPath(); boltTo(p.x0, p.y0, p.x1, p.y1, sd + 13, 9 + w, t * 21);
    ctx.lineWidth = 1; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.3) : VX.mix(col, 0.5), 0.6 * al); ctx.stroke();
  }
  if (al > 0.5 && VX.rate(2.5)) { const s = Math.random(); VX.spark(p.x0 + (p.x1 - p.x0) * s, p.y0 + (p.y1 - p.y0) * s, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0.2 + 0.2 * Math.random(), 1.2, L ? VX.mix(col, -0.3) : VX.hot(col), 0, 2, 1); }
  ctx.lineCap = 'butt';
}
// 고압 방전: 줄이 사라지는 순간 줄을 따라 굵고 하얀 번개가 번쩍이고 불티가 흩어진다
function drawArcZap(f, p) {
  const u = VX.ui(f), L = VX.light, col = f.c, hot = VX.hot(col);
  if (u.n) for (let i = 0; i < 7; i++) { const s = Math.random(), a = Math.random() * TAU, v = 60 + 120 * Math.random(); VX.spark(f.x0 + (f.x1 - f.x0) * s, f.y0 + (f.y1 - f.y0) * s, Math.cos(a) * v, Math.sin(a) * v, 0.2 + 0.2 * Math.random(), 1.4, i % 2 ? hot : col, 0, 3, 1); }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); boltTo(f.x0, f.y0, f.x1, f.y1, u.sd * 40, 11, u.sd * 9 + (p < 0.6 ? 1 : 0));
  boltStroke(col, p * 1.2, 1.4 + 2.4 * p);
  VX.add(); hotSpot(f.x0, f.y0, 9 + 6 * p, col, p); hotSpot(f.x1, f.y1, 9 + 6 * p, col, p); VX.norm();
  ctx.lineCap = 'butt';
}
// 구전: 천천히 떠가는 번개 구체. 달아오른 속, 닿는 범위만큼 옅게 번진 빛, 바깥으로 뻗었다 사라지는 촉수, 닿은 적에게 뻗는 줄기, 뒤에 남는 불티
const BALLT = [];
function drawBall(p) {
  const u = VX.ui(p), t = VX.t, L = VX.light, col = p.c, hot = VX.hot(col), sd = u.sd * 83, age = p.d - p.t, R = p.r;
  const grow = VX.ease(age / 0.3, 2), endK = p.boom ? 0.35 : 0.45, end = p.t < endK ? 1 - p.t / endK : 0;
  const sw = p.boom ? 1 + 0.3 * end : 1 - 0.6 * end, al = Math.min(1, grow) * (p.boom ? 1 : 1 - end), fl = 0.9 + 0.1 * Math.sin(t * 23 + sd) + (p.boom ? 0.4 * end * (0.5 + 0.5 * Math.sin(t * 60)) : 0);
  const rc = R * 0.27 * grow * sw;
  if (VX.rate(16)) VX.spark(p.x + (Math.random() - 0.5) * rc * 1.4, p.y + (Math.random() - 0.5) * rc * 1.4, -p.vx * 0.2 + (Math.random() - 0.5) * 30, -p.vy * 0.2 + (Math.random() - 0.5) * 30, 0.35 + 0.4 * Math.random(), 0.9 + 1 * Math.random(), L ? VX.mix(col, -0.3) : hot, 0, 1.5, 2);   // 뒤에 남는 불티
  VX.add();
  VX.glow(p.x, p.y, R * 0.85 * sw, col, (L ? 0.36 : 0.3) * al * (0.9 + 0.1 * Math.sin(t * 7 + sd)));   // 닿는 범위 (빛 번짐은 적게: 구체가 여럿 떠 있다)
  if (!L) VX.heat(p.x, p.y, rc * 1.7 * fl, col, al);
  VX.norm();
  ctx.setLineDash([3, 6]); ctx.lineDashOffset = -t * 14 - sd;   // 닿는 범위: 가늘고 옅은 점선이 천천히 돈다 (빛 번짐보다 싸다)
  ctx.beginPath(); ctx.arc(p.x, p.y, R * sw * Math.min(1, grow), 0, TAU); ctx.lineWidth = 1; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.2) : col, (L ? 0.4 : 0.3) * al); ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  if (L) {                                  // 밝은 테마: 짙은 테두리의 빛 구슬
    ctx.beginPath(); ctx.arc(p.x, p.y, rc * 0.8, 0, TAU); ctx.fillStyle = rgba(VX.mix(col, 0.35), al); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(VX.mix(col, -0.42), al); ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x - rc * 0.2, p.y - rc * 0.22, rc * 0.3, 0, TAU); ctx.fillStyle = `rgba(255,255,255,${(0.9 * al).toFixed(3)})`; ctx.fill();
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  for (let i = 0; i < 4; i++) {             // 촉수: 속에서 바깥으로 뻗었다 바뀐다 (박자와 길이가 저마다 다르다)
    const cyc = Math.floor(t * (11 + 2 * i) + i * 0.41 + sd), h = (q) => hash(cyc * 2.7 + i * 13.1 + sd + q);
    if (h(7) < 0.2) continue;
    const a = h(1) * TAU, l = R * (0.3 + 0.38 * h(2)) * sw * grow;
    boltTo(p.x + Math.cos(a) * rc * 0.5, p.y + Math.sin(a) * rc * 0.5, p.x + Math.cos(a) * l, p.y + Math.sin(a) * l, sd + i * 5, 5 + 4 * h(3), t * 25);
  }
  let k = 0;                                 // 닿은 적에게 뻗는 줄기
  BALLT.length = 0;
  for (const e of C.S.enemies) { if (e.dead || e.y + e.r <= 0) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d <= R * sw + e.r * 0.5) BALLT.push(d, e); }
  for (let i = 0; i < BALLT.length && k < 3; i += 2, k++) { const e = BALLT[i + 1]; boltTo(p.x, p.y, e.x, e.y, sd + i * 3, 6, t * 28 + i); }   // 닿은 적 셋까지
  ctx.lineWidth = L ? 1.1 : 1.3; ctx.strokeStyle = rgba(L ? VX.mix(col, -0.12) : hot, (L ? 0.6 : 0.85) * al); ctx.stroke();
  ctx.lineCap = 'butt';
}
// 쌍구전 폭발: 속이 번쩍하고, 번개 가지가 사방으로 뻗었다 사라지며, 가장자리만 밝은 물결이 퍼진다
function drawBallBoom(f, p) {
  const u = VX.ui(f), q = 1 - p, R = f.r, col = f.c, hot = VX.hot(col), L = VX.light, e = VX.ease(q, 3), sd = u.sd * 71;
  if (u.n) for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, s = 160 + 260 * Math.random(); VX.spark(f.x, f.y, Math.cos(a) * s, Math.sin(a) * s, 0.25 + 0.3 * Math.random(), 1.6, i % 3 ? hot : col, 0, 4, 1); }
  VX.add();
  hotSpot(f.x, f.y, 22 + 22 * q, col, p * p);
  VX.glow(f.x, f.y, R * (0.45 + 0.6 * e), col, 0.45 * p);
  VX.wave(f.x, f.y, R * (0.12 + 0.88 * e), col, 0.75 * VX.fade(q), q);
  VX.norm();
  if (q < 0.6) {
    const a1 = 1 - q / 0.6, reach = Math.min(1, q / 0.12);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const an = (i + hash(sd + i * 3.3) * 0.8) / 8 * TAU, l = R * (0.55 + 0.45 * hash(sd + i * 5.1)) * reach;
      boltTo(f.x, f.y, f.x + Math.cos(an) * l, f.y + Math.sin(an) * l, sd + i * 7, 7, q < 0.25 ? 0 : 1);
    }
    boltStroke(col, a1, 1.7);
    ctx.lineCap = 'butt';
  }
}
// 먹구름 그림: 겹친 부드러운 덩어리 (덩어리마다 위는 밝고 밑은 어둡다), 납작하고 어두운 밑면, 작은 덩어리로 결이 진 가장자리.
// 처음 쓸 때 한 번 그려 둔다 (모양 세 가지 x 밝은/어두운 테마). 번개 빛 그림은 같은 모양을 안쪽부터 밝게 칠한 것
const CLOUD = {}, CLOUD_W = 320, CLOUD_H = 160, CLOUD_B = 118;   // 그림 크기, 밑면 높이
function cloudBake(key, s) { CLOUD[key] = s; if (window.createImageBitmap) createImageBitmap(s).then((b) => { CLOUD[key] = b; }, () => {}); return s; }
function cloudSpr(v, L, sm) {
  const key = (sm ? 's' : 'k') + v + (L ? 'L' : 'D'); if (CLOUD[key]) return CLOUD[key];
  const s = document.createElement('canvas'); s.width = CLOUD_W; s.height = CLOUD_H;
  const g = s.getContext('2d'), tmp = document.createElement('canvas'), tg = tmp.getContext('2d'), B = CLOUD_B;
  const pal = sm ? (L ? ['#b9a998', '#8c7868', '#5e4c40'] : ['#cbc3c0', '#99908f', '#5f5658']) : L ? ['#d4d7df', '#9399a8', '#5d6372'] : ['#bcc4da', '#7b83a0', '#454b64'];
  let sd = v * 17.3 + 1.1; const rn = () => hash(sd += 1.618);
  const lobes = [];
  for (let i = 0; i < 7; i++) {                 // 큰 덩어리: 가운데가 높은 둥근 지붕
    const u = (i + 0.5) / 7, dome = Math.sin(Math.PI * u), r = 22 + 22 * dome + 8 * rn();
    lobes.push([34 + 252 * u + (rn() - 0.5) * 16, B - r * 0.45 - 28 * dome + (rn() - 0.5) * 8, r]);
  }
  for (let i = 0; i < 4; i++) {                 // 위로 솟은 덩어리
    const u = 0.22 + 0.56 * rn(), dome = Math.sin(Math.PI * u), r = 16 + 14 * dome + 6 * rn();
    lobes.push([34 + 252 * u, B - 38 - 40 * dome - r * 0.25, r]);
  }
  for (let i = 0; i < 18; i++) {                // 가장자리의 작은 덩어리 (결)
    const u = 0.04 + 0.92 * rn(), dome = Math.sin(Math.PI * u), r = 6 + 8 * rn();
    lobes.push([30 + 260 * u, B - 6 - (dome * 76 + 4) * (0.8 + 0.25 * rn()) + r * 0.35, r]);
  }
  lobes.sort((a, b) => a[1] - b[1]);            // 위(뒤)부터 그린다: 아래 덩어리의 밝은 윗면이 위 덩어리의 어두운 밑면을 덮어 덩어리가 겹쳐 보인다
  for (const [x, y, r] of lobes) {
    const n = Math.ceil(r * 2 + 4), c = n / 2; tmp.width = tmp.height = n;
    let gr = tg.createLinearGradient(0, c - r, 0, c + r); gr.addColorStop(0, pal[0]); gr.addColorStop(0.55, pal[1]); gr.addColorStop(1, pal[2]);
    tg.fillStyle = gr; tg.fillRect(0, 0, n, n);
    gr = tg.createRadialGradient(c, c - r * 0.1, 0, c, c, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,.95)'); gr.addColorStop(0.8, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    tg.globalCompositeOperation = 'destination-in'; tg.fillStyle = gr; tg.fillRect(0, 0, n, n); tg.globalCompositeOperation = 'source-over';
    g.drawImage(tmp, x - c, y - c);
  }
  let gr = g.createLinearGradient(0, B - 4, 0, B + 8);   // 밑면을 납작하게 자른다
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = gr; g.fillRect(0, B - 4, CLOUD_W, CLOUD_H);
  gr = g.createLinearGradient(0, B - 96, 0, B + 2);       // 전체가 위는 밝고 밑으로 갈수록 어둡다 (덩어리 하나하나가 공처럼 보이지 않게)
  gr.addColorStop(0, sm ? 'rgba(255,240,225,.3)' : 'rgba(240,244,255,.32)'); gr.addColorStop(0.45, 'rgba(0,0,0,0)'); gr.addColorStop(1, L ? 'rgba(34,38,50,.5)' : 'rgba(12,14,26,.55)');
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, CLOUD_W, CLOUD_H);
  g.globalCompositeOperation = 'source-over';
  return cloudBake(key, s);
}
function cloudLit(v, L, col) {
  const key = 'l' + v + (L ? 'L' : 'D') + col; if (CLOUD[key]) return CLOUD[key];
  const s = document.createElement('canvas'); s.width = CLOUD_W; s.height = CLOUD_H;
  const g = s.getContext('2d'); g.drawImage(cloudSpr(v, L), 0, 0);
  const gr = g.createRadialGradient(CLOUD_W / 2, CLOUD_B - 26, 0, CLOUD_W / 2, CLOUD_B - 26, CLOUD_W * 0.5);
  gr.addColorStop(0, VX.mix(col, 0.85)); gr.addColorStop(0.35, rgba(VX.mix(col, 0.55), 0.85)); gr.addColorStop(1, rgba(col, 0.2));
  g.globalCompositeOperation = 'source-in'; g.fillStyle = gr; g.fillRect(0, 0, CLOUD_W, CLOUD_H);
  return cloudBake(key, s);
}
// 먹구름: 전장 위쪽을 천천히 흘러 다닌다. 뒤의 작은 덩어리가 따로 흘러 윤곽이 천천히 바뀐다. 속에서 가끔 번개 빛이 비치고,
// 낙뢰를 떨어뜨리는 순간 속이 크게 밝아진다. 낙뢰 뒤에는 밑으로 옅은 비 자락이 비스듬히 내리다 그친다
const CLP = [0, 0], CLR = [];               // 먹구름 자리, 무기 칸별 마지막 낙뢰 때
function drawCloud(k, st) {
  const S = C.S, t = VX.t, L = VX.light, col = st.color, c = C.cloudPos(k, S.t, CLP), x = c[0], y = c[1];
  let flash = 0;
  if (CLR[k] == null || CLR[k] > S.t) CLR[k] = -9;   // 새 게임
  for (const f of S.fx) if (f.k === 'thunder' && f.cl && Math.abs(f.x0 - x) < 2 && Math.abs(f.y0 - y) < 2) { flash = Math.max(flash, f.t / f.d); CLR[k] = Math.max(CLR[k], S.t - (f.d - f.t)); }
  const v = k % 3, dw = 176, dh = dw * CLOUD_H / CLOUD_W, top = y + 12 - dh * CLOUD_B / CLOUD_H;
  const ox = Math.sin(t * 0.21 + k * 2.1) * 18, oy = Math.sin(t * 0.33 + k) * 3;   // 뒤 덩어리 (다른 모양, 작게)
  ctx.globalAlpha = L ? 0.8 : 0.85; ctx.drawImage(cloudSpr((v + 1) % 3, L), x - dw * 0.36 + ox, top - 14 + oy, dw * 0.72, dh * 0.72);
  ctx.globalAlpha = L ? 0.9 : 0.94; ctx.drawImage(cloudSpr(v, L), x - dw / 2, top, dw, dh);
  ctx.globalAlpha = 1;
  const amb = hash(Math.floor(t * 5) * 1.3 + k * 7.7) > 0.82 ? 0.25 + 0.2 * hash(Math.floor(t * 5) + k) : 0, lit = Math.max(flash, amb);   // 가끔 속에서 번쩍
  if (lit > 0.02) {
    VX.add();
    ctx.globalAlpha = Math.min(1, lit * (L ? 0.95 : 0.8)); ctx.drawImage(cloudLit(v, L, col), x - dw / 2, top, dw, dh); ctx.globalAlpha = 1;
    if (flash > 0.3) VX.glow(x, y + 10, 46, col, (L ? 0.45 : 0.6) * flash, 22);   // 낙뢰가 나가는 자리
    VX.norm();
  }
  const ra = Math.max(0, 1 - (S.t - CLR[k]) / 1.6);   // 비 자락
  if (ra > 0.02) {
    const y0 = y + 12, len = 120, rc = L ? '74,84,104' : '176,188,216', gr = ctx.createLinearGradient(0, y0, 0, y0 + len);
    gr.addColorStop(0, `rgba(${rc},${(0.55 * ra).toFixed(3)})`); gr.addColorStop(1, `rgba(${rc},0)`);
    ctx.strokeStyle = gr; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const h1 = hash(k * 13 + i * 1.7), ph = (t * (1.2 + 0.5 * h1) + hash(i * 3.3 + k)) % 1, yy = y0 + ph * len, xx = x + (h1 - 0.5) * 130 - ph * len * 0.22;
      ctx.moveTo(xx, yy); ctx.lineTo(xx - 2.6, yy + 11);
    }
    ctx.stroke(); ctx.lineCap = 'butt';
  }
}
function drawFx(f, H) {
  const p = Math.max(0, f.t / f.d);
  switch (f.k) {
    case 'beam': {
      const u0 = VX.ui(f);
      if (u0.n && !f.h) VX.trail(f.x, f.y1, f.x, f.y0, f.g ? 4.2 : 2.6, f.c === '#ffffff' ? C.WEAPONS.laser.color : f.c, f.g ? 0.6 : 0.45, 1);   // 번쩍인 뒤 남는 가는 심지와 빛 알갱이
      ctx.fillStyle = rgba(f.c, 0.75 * p); ctx.fillRect(f.x - f.w * p / 2, f.y0, f.w * p, f.y1 - f.y0);
      ctx.fillStyle = `rgba(255,255,255,${0.8 * p})`; ctx.fillRect(f.x - 1.5, f.y0, 3, f.y1 - f.y0);
      if (f.ab) beamAbsorb(f, p, u0);       // 최대 타격 수에 걸려 멈춘 빔: 끝이 적에게 빨려 드는 빛
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
    }
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
    case 'rail': drawRailFx(f, p); break;   // 저격선 (넘어가는 피해, 점사 포함)
    case 'hkx': drawHuntX(f, p); break;     // 연속 사냥: 처치한 자리의 ✕ 자국
    case 'chip': drawChip(f, p); break;         // 균열: 떨어져 나가는 조각
    case 'dsv': drawDissolve(f, p); break;      // 용해: 녹아 가라앉는 몸과 거품
    case 'dsvb': drawDsvBurst(f); break;        // 용해 폭발: 산 방울과 얼룩
    case 'muz': drawMuz(f, p); break;       // 블래스터 총구 섬광
    case 'fcone': drawFcone(f, p); break;   // 화염 산탄: 부채꼴로 뻗는 불꽃 혀
    case 'slugf': drawSlugFire(f, p); break;
    case 'roar': drawRoar(f, p); break;      // 용 머리가 튀어나오는 총구 불꽃
    case 'dbeam': {                         // 프리즘 (T9a): 본줄기에서 비스듬히 뻗어 옆 레인을 따라 위로 꺾이는 가지. 무지개는 줄마다 다른 색. 번쩍인 뒤 가는 심지와 빛 알갱이가 남는다
      const col = f.rb ? rainbowHex(f.rb) : f.c, xb = f.xb == null ? f.x1 : f.xb, yb = f.yb == null ? f.y1 : f.yb;
      if (VX.ui(f).n) { VX.trail(f.x0, f.y0, xb, yb, 3.4, col, 0.6, 1); if (yb - f.y1 > 2) VX.trail(xb, yb, f.x1, f.y1, 3.4, col, 0.6, 1); }
      const path = () => { ctx.beginPath(); ctx.moveTo(f.x0, f.y0); if (yb - f.y1 > 2) { ctx.arcTo(xb, yb, f.x1, f.y1, Math.min(18, (yb - f.y1) * 0.5)); ctx.lineTo(f.x1, f.y1); } else ctx.lineTo(xb, yb); };
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      VX.add(); VX.glow(f.x0, f.y0, 12 + 10 * p, col, 0.8 * p);
      path(); ctx.lineWidth = 11 * p + 2; ctx.strokeStyle = rgba(col, 0.4 * p); ctx.stroke();
      if (f.ab) hotSpot(f.x1, f.y1, 4 + 5 * p, col, 0.85 * p);   // 최대 타격 수에 걸려 멈춘 가지 끝
      VX.norm();
      ctx.lineWidth = 3.5 * p + 1; ctx.strokeStyle = rgba(col, Math.min(1, p * 2.5)); ctx.stroke();
      ctx.lineWidth = 1.4; ctx.strokeStyle = `rgba(255,255,255,${p})`; ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.85 * p})`; ctx.beginPath(); ctx.arc(f.x0, f.y0, 5 * p + 1, 0, Math.PI * 2); ctx.fill();   // 갈라지는 마디
      ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      break;
    }
    case 'vap': drawVap(f, p); break;       // 증발
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
    case 'pulse': drawPulse(f, p); break;
    case 'airboom': drawAirBoom(f); break;  // 공습 폭발
    case 'crater': {                        // 박격포 탄흔 (공습은 가로로 번진 그을음)
      if (f.air) { drawScorch(f, p); break; }
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
      if (f.nova) drawNova(f, p); else drawRing(f, p);
      break;
    case 'nuke': drawNuke(f); break;
    case 'airwarn': drawAirWarn(f); break;
    case 'thunder': drawThunder(f, p); break;
    case 'arcz': drawArcZap(f, p); break;
    case 'ballboom': drawBallBoom(f, p); break;
    case 'boom':
      if (!f.mset && !f.nk) drawBoom(f, p);   // mset: 지뢰 설치 (지뢰가 내려앉는 모습은 drawMine 이 그린다), nk: 핵탄두 ('nuke' 가 그린다)
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
    case 'fling': drawFling(f, p); break;   // 큰 한 방에 쓰러진 적 (T10c)
    case 'pop':
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.7 - p * 0.7), 0, Math.PI * 2);
      ctx.lineWidth = f.boss ? 5 : 2; ctx.strokeStyle = `rgba(255,150,150,${p})`; ctx.stroke();
      break;
    case 'spark': {                         // 피격 불꽃: 작은 빛과, 길이와 방향이 저마다 다른 빛줄기가 튀어 나가며 짧아진다
      const q = 1 - p, sd = f.x * 0.37 + f.y * 0.11, col = seenCol(f.c), e = VX.ease(q, 2);
      VX.add(); VX.glow(f.x, f.y, 8 + 5 * q, col, 0.85 * p); VX.norm();
      ctx.lineCap = 'round'; ctx.strokeStyle = rgba(VX.light ? VX.hot(col) : col, Math.min(1, p * 1.6)); ctx.lineWidth = 1.5 * p + 0.5; ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i + hash(sd + i * 2.9)) * 1.5708, l = 5 + 13 * hash(sd + i * 5.3), r0 = 2.5 + l * 0.9 * e, cs = Math.cos(a), sn = Math.sin(a);
        ctx.moveTo(f.x + cs * r0, f.y + sn * r0); ctx.lineTo(f.x + cs * (r0 + l * p), f.y + sn * (r0 + l * p));
      }
      ctx.stroke(); ctx.lineCap = 'butt';
      if (!VX.light) { ctx.fillStyle = `rgba(255,255,255,${p * 0.85})`; ctx.beginPath(); ctx.arc(f.x, f.y, 2.6 * p + 0.4, 0, 7); ctx.fill(); }
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
    case 'wave': {                          // 웨이브 시작: 보스 예고보다 가볍게. 위에서 살짝 내려오며 나타나고, 양옆 가는 선이 퍼졌다 사라진다
      const u = 1 - p, al = Math.min(1, u * 9, p * 3.2), y = H * 0.22 - 10 * Math.pow(Math.max(0, 1 - u * 5), 2);
      const W = C.W, ink = theme.v.ink, t1 = '웨이브 ' + f.n, t2 = f.text ? ' · ' + f.text : '';
      ctx.font = '30px "Do Hyeon", sans-serif'; const w1 = ctx.measureText(t1).width;
      ctx.font = '26px "Do Hyeon", sans-serif'; const w2 = t2 ? ctx.measureText(t2).width : 0;
      const x0 = W / 2 - (w1 + w2) / 2, x1 = x0 + w1 + w2, ln = 70 * (1 - Math.pow(1 - Math.min(1, u * 2.5), 3)), gp = 12, ly = y - 10;
      ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (const [a, b] of [[x0 - gp, x0 - gp - ln], [x1 + gp, x1 + gp + ln]]) {
        const g = ctx.createLinearGradient(a, 0, b, 0); g.addColorStop(0, rgba(ink, 0.5 * al)); g.addColorStop(1, rgba(ink, 0));
        ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(a, ly); ctx.lineTo(b, ly); ctx.stroke();
      }
      ctx.lineCap = 'butt'; ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = rgba(TC.bg, 0.8 * al);
      ctx.font = '30px "Do Hyeon", sans-serif'; ctx.strokeText(t1, x0, y); ctx.fillStyle = rgba(ink, al); ctx.fillText(t1, x0, y);
      if (t2) { ctx.font = '26px "Do Hyeon", sans-serif'; ctx.strokeText(t2, x0 + w1, y); ctx.fillStyle = rgba(TC.bossTxt, al); ctx.fillText(t2, x0 + w1, y); }
      ctx.textAlign = 'center';
      break;
    }
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
// 오래 남는 효과: 불길(불바다), 용융선, 잔광(빛의 고리)
function drawKindPool(p, nowT, H) {
  if (p.kind === 'fire') drawFireStrip(p);
  else if (p.kind === 'melt') drawMelt(p, H);
  else if (p.kind === 'halo') drawHalo(p);
  else if (p.kind === 'efield') drawEField(p);   // 전기 줄과 구체, 산성비는 적 위에 따로 그린다
  else if (p.kind === 'slime') drawSlime(p);
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
  if (S && !RM.matches) for (let i = S.fx.length - 1; i >= 0; i--) {   // 연쇄 핵: 짧고 약한 흔들림 (가장 최근 것 하나만)
    const f = S.fx[i]; if (f.k !== 'quake') continue;
    const T = f.d - f.t, q = 1 - T / f.d; ctx.translate(Math.sin(T * 140) * 3 * q, Math.cos(T * 113) * 2.2 * q); break;
  }
  if (evoRun.length) evoShake();             // 진화의 쿵 (실제 시간 기준)
  // 모눈
  ctx.strokeStyle = TC.grid; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 25; x < W; x += 25) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = H % 25; y < H; y += 25) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  // 레인 구분선
  ctx.strokeStyle = TC.lane; ctx.setLineDash([6, 8]); ctx.beginPath();
  for (let k = 1; k < C.LANES; k++) { ctx.moveTo(k * C.LW, 0); ctx.lineTo(k * C.LW, H); }
  ctx.stroke(); ctx.setLineDash([]);
  VX.begin(S);
  if (!S) return;

  // 고른 무기의 공격 범위. 끌고 있는 무기가 무기 칸 위에 있으면 그 칸에서의 범위를 미리 보여 준다
  const rk = sel && sel.from === 'slot' ? sel.k : -1;
  if (rk >= 0 && S.slots[rk]) drawRange(S.slots[rk], rk);
  else if (drag && drag.active && drag.over && drag.over.dataset.slot != null) {
    const sr = drag.src, dw = sr.from === 'slot' ? S.slots[sr.k] : S.inv[sr.i];
    if (dw && dw.kind === 'w') drawRange(dw, +drag.over.dataset.slot);
  }
  const bs = C.bstats(), nowT = performance.now();
  pudFr++; pudN = 0;                         // 폭우 웅덩이: 이번 그림에서 그린 비 묶음, 쓴 따로 캔버스 수
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
    if (p.acid) { if (p.rp) drawPuddles(p.rp, nowT); else drawAcidPool(p, nowT); continue; }   // 산성 웅덩이 (폭우의 고이는 웅덩이는 같은 비끼리 한 번에)
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.c ? rgba(p.c, 0.1 + 0.12 * Math.min(1, p.t)) : `rgba(255,140,60,${0.1 + 0.12 * Math.min(1, p.t)})`; ctx.fill();
    ctx.strokeStyle = p.c ? rgba(p.c, 0.55) : 'rgba(255,160,80,.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
  }
  const nowW = performance.now();
  for (const m of S.mines) drawMine(m);
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
  for (const e of S.enemies) if (e.type === 'charge' && !e.dead) drawCharge(e, H, nowW);   // 돌격체: 예고 레인과 돌진 잔상 (몸 아래에)
  let dsvP = null;                           // 용해를 찍은 무기의 웅덩이 (녹기 시작하는 적)
  for (const p of S.pools) if (p.acid && p.st.dsv && p.r >= 1) (dsvP || (dsvP = [])).push(p);
  for (const e of S.enemies) {
    const age = e.boss && e.born != null ? S.t - e.born : 9, mt = dsvP && !e.boss && !e.dead ? meltOf(e, dsvP) : 0;
    if (age < 0.3) {                         // 보스 등장: 작게 시작해 살짝 넘쳤다가 제 크기로 (보이는 효과만)
      const u = age / 0.3, k = Math.max(0.05, 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2));
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(k, k); ctx.translate(-e.x, -e.y); drawEnemy(e); ctx.restore();
    } else if (mt > 0) drawMelting(e, mt);
    else drawEnemy(e);
  }
  for (const b of S.beams) {                // 지속 빔: 꺼질 때는 가늘어지며 사라진다
    const u = VX.ui(b); if (u.n) u.t0 = S.t;
    drawHoldBeam(b.k, b.st, b, Math.min(1, b.t / 0.12, 0.45 + (S.t - u.t0) / 0.08), u.sd * 40);
  }
  for (const p of S.pools) { if (p.kind === 'arc') drawArc(p); else if (p.kind === 'ball') drawBall(p); else if (p.kind === 'rain') drawRain(p); }   // 전격기: 전기 줄, 구전. 산성비 (적 위에)
  for (let k = 0; k < C.LANES; k++) {       // 진화 무기의 스킬 표시 (항상 켜진 것들)
    const w = S.slots[k]; if (!w || !w.evo) continue;
    const st = C.stats(w), x = (k + 0.5) * C.LW;
    if (w.type === 'laser' && st.always) drawHoldBeam(k, st, w, 1, k * 7.3 + 1);   // 상시 빔: 꺼지지 않는 빔
    if (w.type === 'tesla' && st.cloud) drawCloud(k, st);   // 먹구름
    if (w.type === 'rail' && st.mkD) drawMark(k, w, st);     // 조준 레이저: 고정 레이저, 표식, 균열
    if (w.type !== 'pulse') continue;
    if (st.fld) drawField(x, H, st.radius * C.FLD_R, st, w, k);   // 역장: 항상 켜진 막
    if (st.orbs) {
      const sz = st.orbSize || 1;
      for (let i = 0; i < st.orbs; i++) C.orbPos(k, st, i, S.t, OPOS[i]);
      if (st.orbChain && st.orbs > 1) drawOrbChain(st, k, st.orbs);   // 전기 사슬: 구체 사이의 번개 줄
      for (let i = 0; i < st.orbs; i++) drawOrb(k, st, i, OPOS[i], sz);
    }
  }
  ctx.lineCap = 'round';
  for (const b of S.bullets) {
    const ev = b.st && b.st.evo, k = ev ? 1.2 : 1;   // 진화한 무기의 탄은 20% 크고 더 밝다
    if (b.big) {                            // 거대탄, 슬러그탄
      if (b.r > 30) drawGiant(b); else drawSlug(b, k);
      ctx.lineCap = 'round';
      continue;
    }
    if (b.drg) { dragonSeen(b); continue; }    // 용 머리: 탄 루프 뒤에 몸통과 함께 그린다
    if (b.fl) { drawFlameShot(b); continue; }   // 화염 산탄: 날아갈수록 커지는 불덩이
    if (b.sm) { drawTurShot(b); continue; }     // 보조 포탑의 작은 탄
    const ty = b.st && b.st.type;
    if (ty === 'blaster') {
      if (b.th) { drawGatShot(b); continue; }   // 개틀링: 가늘고 빠른 빛줄기
      if (b.bm) { drawLance(b, k); continue; }   // 광탄: 길쭉한 빛살
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.092 * k, b.y - b.vy * 0.092 * k);   // 아주 짧은 잔상
      ctx.lineWidth = 2.6 * k; ctx.strokeStyle = rgba(b.c, 0.16); ctx.stroke();
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
  drawShells();                              // 포탄, 미사일, 떨어지는 폭탄, 산성 덩어리 (연기는 그 아래)
  drawDragons(H);                            // 용 머리와 몸통 불길
  VX.draw();                                 // 잔상과 입자 (피해 숫자보다 아래)
  if (evoRun.length) drawEvoPillars(H);     // 진화의 빛기둥
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
  drawCasings(H);                            // 난사와 점사의 탄피
  for (let k = 0; k < C.LANES; k++) {
    const w = S.slots[k]; if (!w) continue;
    const x = (k + 0.5) * C.LW;
    if (w.type === 'laser' && w.cd > 0.05 && w.cd < 0.2) {   // 발사 직전 충전 빛 (막 쏘려는 순간에만)
      const q = 1 - (w.cd - 0.05) / 0.15, col = C.WEAPONS.laser.color;
      ctx.fillStyle = rgba(col, 0.18 + 0.3 * q); ctx.beginPath(); ctx.arc(x, H - 14, 8 + 16 * q, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(col, 0.9); ctx.beginPath(); ctx.arc(x, H - 14, 2 + 4 * q, 0, Math.PI * 2); ctx.fill();
    }
    const bst = w.evo && w.type === 'blaster' ? C.stats(w) : null, ss = bst && bst.spray ? C.sprayState(w) : null;
    let hl = w.evo ? C.heatLevel(w) : 0;
    if (ss && ss.rl >= 0) hl *= 0.2 + 0.8 * sprayCool(ss.rl);   // 난사 재장전: 포신이 식는 모습 (예열 단계는 그대로 남는다)
    if (hl > 0) drawHeat(x, H, hl, k);      // 예열: 무기 둘레가 달아오른다
    if (ss) drawSpray(x, H, ss, k, bst.color);   // 난사: 재장전과 탄띠
    const rst = w.evo && w.type === 'rail' ? C.stats(w) : null, ka = rst && rst.bst && w.sT != null ? S.t - w.sT : 9;
    const kick = ka >= 0 && ka < 0.14 && !RM.matches;   // 점사: 쏠 때마다 무기가 살짝 뒤로 튀었다 돌아온다
    if (kick) { const e = Math.pow(1 - ka / 0.14, 2); ctx.save(); ctx.translate((hash(w.sT * 7.3) - 0.5) * 2.4 * e, 3.2 * e); }
    ctx.fillStyle = hl > 0 ? `rgb(255,${Math.round(110 + 100 * (1 - hl))},${Math.round(80 + 120 * (1 - hl))})` : C.WEAPONS[w.type].color; ctx.beginPath();
    ctx.moveTo(x, H - 13); ctx.lineTo(x + 9, H - 3); ctx.lineTo(x - 9, H - 3); ctx.closePath(); ctx.fill();
    if (bst && bst.tur) for (let q = 0; q < (bst.turTwin ? 2 : 1); q++) drawTurret(w, k, q, bst);
    if (kick) ctx.restore();
    if (rst && rst.stk) drawStreak(x, H, w, seenCol(rst.color));   // 연속 사냥: 연속 처치 눈금
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
    enemies: S.enemies.map(e => Object.assign({}, e, { burnSt: null, burnT: 0, burnDps: 0, fSt: null, fT: 0, fDps: 0, fcB: null, slT: 0 })),
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

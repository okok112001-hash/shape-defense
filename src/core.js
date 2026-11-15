/* 도형 디펜스: 게임 로직 (화면과 분리되어 있어 단독 실행 가능) */
(function (root) {
'use strict';

const LANES = 5, LW = 100, W = LANES * LW;
let H = 520;
const GRADES = ['일반', '희귀', '영웅', '전설'];
const CFG = {
  invSize: 15,        // 인벤토리 칸 수 (답답하면 여기만 바꾸면 됨)
  maxLv: 100,
  baseHp: 100,
  startGold: 80,
  bossEvery: 60,
  augEvery: 5,
  extraShotMul: 0.32,
  meltPts: [20, 50, 120, 300],   // 용해로: 등급별로 파츠를 녹여 얻는 게이지
  craftCost: 100,            // 제조 기본 게이지 (BAL.craftCost(k)의 기준)
  craftW: [0, 62, 30, 8],    // 제조한 파츠의 등급 비율 (희귀 이상만)
  baseSlots: 4,              // 기지 파츠 칸 수
  baseHpPerLv: 4,            // 기지 강화 1단계마다 최대 체력
  basePartShare: 0.25,       // 파츠가 나올 때 기지 파츠일 확률
  evoCost: 5000,             // 진화에 드는 조각 (100강 무기 하나)
  evoCostMul: 5,             // 진화한 무기의 강화 비용 배수
  evoCostAdd: 100,           // 진화한 무기의 강화 비용에 더하는 고정값: 100 + 5 x 일반 비용
};

// 난수는 세 갈래다. rndS는 '어떤 적이 어디에 나오는가'만, rndG는 '전리품과 성장'(생성, 파츠 굴림, 제조, 보스 보상, 증강 선택지, 강화 성공/절약)만 정하고,
// rnd는 그 밖의 모든 것(치명타, 효과 등 전투)에 쓴다. rndG는 한 번 굴릴 때마다 정확히 한 번만 뽑고(subG), 그 값으로 하위 난수열을 만들어 쓴다.
// 그래서 시드가 같으면 전투와 상관없이 k번째 생성/굴림 결과가 같다. 시드가 없으면 Math.random 그대로다.
let rnd = Math.random;
let rndS = Math.random;
let rndG = Math.random;
let rndH = Math.random;   // 수리 장치의 회복 확률 전용: 체력에 따라 뽑는 횟수가 달라져도 전투 난수열(rnd)이 밀리지 않게 따로 둔다
function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// n이 null이면 Math.random으로 되돌린다. 세 갈래는 서로 다른 파생 시드를 쓴다.
function seed(n) {
  if (n == null) { rnd = Math.random; rndS = Math.random; rndG = Math.random; rndH = Math.random; return; }
  rnd = mulberry32((n * 2654435761 + 0x1234567) | 0);
  rndS = mulberry32((n * 2246822519 + 0x7654321) ^ 0x5bd1e995);
  rndG = mulberry32((n * 3266489917 + 0x2545F491) ^ 0x3c6ef372);
  rndH = mulberry32((n * 2891336453 + 0x1b873593) ^ 0x85ebca6b);
}
// 전리품/성장 굴림 한 번당 rndG에서 값 하나만 뽑아, 그 굴림 안에서 쓸 하위 난수열을 만든다
function subG() { return mulberry32((rndG() * 4294967296) | 0); }
function pick(a, r) { return a[Math.floor((r || rnd)() * a.length)]; }
function wpick(ws, rr) {
  let t = 0; for (const w of ws) t += w;
  let r = (rr || rnd)() * t;
  for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r < 0) return i; }
  return ws.length - 1;
}

/* ---------- 밸런스 수치 ---------- */
const BAL = {
  // L강에 도전할 때의 성공률 (1강 100% → 100강 10%, 초반에 더 빨리 감소)
  success(L) {
    if (L <= 1) return 1;
    const x = (L - 1) / 99;
    return 0.10 + 0.90 * Math.pow(1 - x, 1.1);
  },
  lvMul(L) { return Math.pow(1.05, L); },
  evoMul(L) { return Math.pow(1.03, L); },   // 진화한 무기: lvMul(100) x evoMul(진화 단계)
  // 적 체력 배수: 끊김 없는 식 하나. 초반에는 거의 오르지 않고, 이후 꾸준히 오르며 끝없이 계속된다
  hpMul(t) { return Math.pow(1 + Math.pow(t / 321, 3.1), 0.9) * Math.exp(0.0012 * t); },
  bossHp: 1.3,      // 모든 보스의 체력 배수 (일반 적과 같은 hpMul 곡선에 곱한다)
  bossSpd: 0.85,    // 모든 보스의 이동 속도 배수
  bossY: 0.14,      // 보스가 나타나는 높이 (전장 높이의 비율). 예고 동안 이 자리에 고정된다
  spawnRate(t) { return 0.5 + 5.5 * (1 - Math.exp(-t / 340)); },
  // 적 종류별 등장 가중치 [basic, runner, swarm, heavy]. 해금 뒤 서서히 늘어난다
  spawnWeights(t) {
    const ramp = (t0, W, tau) => t > t0 ? W * (1 - Math.exp(-(t - t0) / (tau || 120))) : 0;
    return [5, ramp(60, 4, BAL.runnerTau), ramp(150, 1.4), ramp(300, 4)];
  },
  runnerTau: 300,   // 달리는 적(runner) 비중이 늘어나는 시간 상수(초)
  // 초반에는 넉넉하고(시작 +35%) 시간이 갈수록 완만하게 줄어든다
  goldMul(t) { return (1 + t / 80) * (0.63 + 0.72 * Math.exp(-t / 200)); },
  // 제조 비용: 이번 판에서 제조한 횟수 k(0부터)가 늘수록 오른다. 비용/100 = m 은 등급 굴림의 '뽑는 횟수'(craftOdds)
  craftCost(k) { return Math.round(CFG.craftCost * Math.pow(1 + 0.1 * k, 1.25)); },
  genCost(n) { return Math.round(10 * Math.pow(1 + 0.2 * n, 1.25)); },
  // 강화 조각 수는 낸 비용을 따라가되 비용보다 느리게 늘어난다 (비용이 10배면 조각은 약 8배)
  bundleExp: 0.9,
  bundle(cost, r) { return Math.max(3, Math.round((0.75 + (r || subG())() * 0.5) * 4.5 * Math.pow(cost / 10, BAL.bundleExp))); },
};

/* ---------- 무기 ---------- */
const WEAPONS = {
  blaster: { name: '블래스터', dmg: 13, cd: 0.45, range: 0.75, lanes: 0, color: '#6ee7ff',
    desc: '정면 1레인의 가장 가까운 적에게 탄환 발사' },
  shotgun: { name: '산탄포', dmg: 11, cd: 0.8, range: 0.5, lanes: 1, color: '#ffc857',
    desc: '정면과 양옆 3레인에 산탄 발사. 사거리가 짧음' },
  laser: { name: '레이저', dmg: 13, cd: 1.25, range: 0.9, lanes: 0, color: '#ff7ad9',
    desc: '정면 1레인의 모든 적을 한 번에 관통' },
  pulse: { name: '펄스', dmg: 7, cd: 0.9, range: 0, lanes: 0, radius: 140, color: '#7af0c1',
    desc: '무기 주변 원형 범위의 모든 적 타격' },
  mortar: { name: '박격포', dmg: 41, cd: 2.0, range: 1, lanes: 5, blast: 62, color: '#ff9f5a',
    desc: '모든 레인 대상. 기지에 가장 가까운 적에게 폭발탄' },
  tesla: { name: '전격기', dmg: 10.5, cd: 0.7, range: 0.55, lanes: 1, chain: 2, color: '#b9a2ff',
    desc: '3레인 안의 가까운 적을 공격하고 주변 2명에게 연쇄' },
  rail: { name: '저격포', dmg: 120, cd: 1.9, range: 1, lanes: 5, color: '#f2f2ff',
    desc: '모든 레인에서 체력이 가장 많은 적을 저격' },
  acid: { name: '산성 분사기', dmg: 3.5, cd: 1.6, range: 1, lanes: 5, color: '#a6e84a',
    desc: '전장 아무 곳에나 산성 웅덩이를 뿌립니다. 웅덩이 안의 적은 지속 피해를 받고 받는 피해가 늘어납니다' },
};
const WEAPON_IDS = Object.keys(WEAPONS);

/* ---------- 파츠 (어느 무기에나 장착, 수치 보정) ---------- */
const pct = (k) => (s, v) => { s[k] += v / 100; };
const add = (k) => (s, v) => { s[k] += v; };
const mx = (k) => (s, v) => { s[k] = Math.max(s[k], v / 100); };
const PARTS = {
  dmg:   { name: '강화 탄두',   abbr: '공격', min: 0, v: [5.8, 12, 23, 58],    ap: pct('dmgPct'),   d: v => `공격력 +${v}%` },
  rate:  { name: '가속 장치',   abbr: '속도', min: 0, v: [5.8, 12, 23, 46],    ap: pct('ratePct'),  d: v => `공격 속도 +${v}%` },
  crit:  { name: '조준경',      abbr: '치확', min: 0, v: [7.5, 15, 30, 75],    ap: pct('crit'),     d: v => `치명타 확률 +${v}%` },
  critd: { name: '예리한 날',   abbr: '치피', min: 0, v: [25, 50, 100, 250], w: [2.3, 4.5, 9, 23],  ap: (s, v, w) => { s.critDmg += v / 100; s.crit += w / 100; }, d: (v, w) => `치명타 피해 +${v}%, 치명타 확률 +${w}%` },
  range: { name: '확장 모듈',   abbr: '범위', min: 0, v: [9.3, 19, 37, 93],    ap: pct('rangePct'), d: v => `사거리와 공격 범위 +${v}%` },
  boss:  { name: '약점 분석기', abbr: '보스', min: 0, v: [14, 27, 54, 140],   ap: pct('bossPct'),  d: v => `보스와 대형 적(육각형)에게 주는 피해 +${v}%` },
  gold:  { name: '채굴 칩',     abbr: '재화', min: 0, v: [18, 35, 70, 180],    ap: pct('goldPct'),  d: v => `이 무기로 처치 시 재화 +${v}%` },
  exec:  { name: '처형 모듈',   abbr: '처형', min: 0, v: [20, 40, 80, 200],   ap: pct('execPct'),  d: v => `체력 50% 이하인 적에게 피해 +${v}%` },
  first: { name: '선제 타격기', abbr: '선제', min: 0, v: [19, 37, 74, 190],   ap: pct('firstPct'), d: v => `체력 70% 이상인 적에게 피해 +${v}%` },
  dbl:   { name: '이중 장전기', abbr: '연사', min: 2, v: [0, 0, 21, 42],      ap: pct('dbl'),      d: v => `공격 시 ${v}% 확률로 즉시 한 번 더 공격` },
  core:  { name: '코어 증폭기', abbr: '코어', min: 3, v: [0, 0, 0, 24],
    ap: (s, v) => { s.dmgPct += v / 100; s.ratePct += v / 200; }, d: v => `공격력 +${v}%, 공격 속도 +${v / 2}%` },
  // 여러 수치를 함께 바꾸거나 독특한 효과가 있는 파츠
  heavy:  { name: '중화기 개조',     min: 0, v: [12, 24, 48, 120], ap: (s, v) => { s.dmgPct += v / 100; s.ratePct -= 0.15; }, d: v => `공격력 +${v}%, 공격 속도 -15%` },
  light:  { name: '경량 프레임',     min: 0, v: [7.8, 16, 31, 62],  ap: (s, v) => { s.ratePct += v / 100; s.dmgPct -= 0.10; }, d: v => `공격 속도 +${v}%, 공격력 -10%` },
  sniper: { name: '저격 조준기',     min: 0, v: [18, 35, 70, 180], ap: pct('farPct'), d: v => `전장 위쪽 70%에 있는 적에게 피해 +${v}%` },
  chill:  { name: '냉각수 탱크',     min: 0, v: [9.8, 20, 39, 80],   ap: mx('slow'),    d: v => `적중한 적을 1.5초간 ${v}% 둔화` },
  glass:  { name: '유리 대포',       min: 1, v: [0, 17, 33, 83],  ap: (s, v) => { s.dmgPct += v / 100; s.rangePct -= 0.15; }, d: v => `공격력 +${v}%, 사거리와 범위 -15%` },
  big:    { name: '대구경 포신',     min: 1, v: [0, 12, 23, 46],   ap: (s, v) => { s.rangePct += v / 100; s.dmgPct += v / 200; }, d: v => `사거리와 범위 +${v}%, 공격력 +${v / 2}%` },
  ember:  { name: '발화 장치',       min: 1, v: [0, 13, 26, 65],   ap: mx('burn'),    d: v => `적중한 적에게 3초간 초당 공격력의 ${v}% 화상 피해` },
  gamble: { name: '도박사의 주사위', min: 1, v: [0, 180, 202, 280], ap: mx('gamble'), d: v => `공격할 때마다 피해가 50%~${v}% 사이에서 무작위로 결정` },
  ramp:   { name: '과열 엔진',       min: 2, v: [0, 0, 20, 50],    ap: mx('ramp'),    d: v => `쉬지 않고 공격하면 공격 속도가 점점 올라 최대 +${v}%` },
  // 기지 전용 파츠 (기지 파츠 칸에만 장착, 효과는 전체에 적용)
  shield:  { base: true, name: '방패 발생기', min: 0, v: [3, 6, 12, 30],     ap: pct('shield'),   d: v => `기지가 받는 피해 -${v}% (합산, 최대 60%)` },
  // 두 가지 능력을 가진 기지 항목: v = 첫째 수치, w = 둘째 수치 (등급별 배열). ap(s, v, w), d(v, w)
  armor:   { base: true, name: '장갑판',     min: 0, v: [5, 10, 20, 50], w: [1.1, 2.2, 4.4, 11], ap: (s, v, w) => { s.hpPct += v / 100; s.dmgAll += w / 100; }, d: (v, w) => `기지 최대 체력 +${v}% · 모든 무기의 공격력 +${w}%` },
  drone:   { base: true, name: '수리 드론',   min: 0, v: [0.063, 0.13, 0.25, 0.63], w: [0.7, 1.4, 2.8, 7], ap: (s, v, w) => { s.regenPct += v / 100; s.goldAll += w / 100; }, d: (v, w) => `1초마다 최대 체력의 ${v}% 회복 · 재화 획득 +${w}%` },
  heal:    { base: true, name: '수리 장치',   min: 0, v: [1, 2, 4, 10], w: [1.5, 3, 6, 15], ap: (s, v, w) => { s.heal += v / 100; s.bossHeal += w / 100; }, d: (v, w) => `적을 처치할 때 ${v}% 확률로 최대 체력의 1% 회복 · 보스를 처치하면 체력 ${w}% 회복` },
  wire:    { base: true, name: '감속 철조망', min: 0, v: [7.3, 15, 29, 73],    ap: mx('nearSlow'),  d: v => `기지 가까이 온 적(전장 아래 4분의 1)을 ${v}% 둔화` },
  luck:    { base: true, name: '행운 부적',   min: 0, v: [0.47, 0.95, 1.9, 4.8],       ap: pct('luck'),     d: v => `모든 강화의 성공률 +${v}%p` },
  save:    { base: true, name: '절약 회로',   min: 0, v: [1.4, 2.9, 5.7, 14],     ap: pct('save'),     d: v => `강화할 때 ${v}% 확률로 조각을 소모하지 않음` },
  magnet:  { base: true, name: '자석 코어',   min: 0, v: [0.42, 0.85, 1.7, 4.3],        ap: pct('magnet'),   d: v => `적을 처치할 때 ${v}% 확률로 강화 조각 획득` },
  depot:   { base: true, name: '보급 창고',   min: 0, v: [1.8, 3.5, 7, 18],     ap: pct('goldAll'),  d: v => `재화 획득 +${v}%` },
  command: { base: true, name: '지휘 통신기', min: 0, v: [3.5, 7, 14, 35],      ap: pct('dmgAll'),   d: v => `모든 무기의 공격력 +${v}%` },
  radar:   { base: true, name: '레이더',     min: 0, v: [2.8, 5.5, 11, 28],      ap: pct('rangeAll'), d: v => `모든 무기의 사거리와 범위 +${v}%` },
  barrier: { base: true, name: '비상 방벽',   min: 2, v: [0, 0, 30, 75],      ap: mx('revive'),    d: v => `기지가 파괴될 피해를 한 번 막고 체력을 ${v}% 회복. 발동하면 이 파츠는 사라짐` },
};
const BASE_PART_IDS = Object.keys(PARTS).filter(id => PARTS[id].base);
const WEAPON_PART_IDS = Object.keys(PARTS).filter(id => !PARTS[id].base);
const PART_IDS = Object.keys(PARTS);

/* ---------- 증강 (무기 고유, 5강마다 3택) ---------- */
const laneText = (n) => n >= 4 ? '모든 레인의 적을 조준' : `조준 범위가 양옆 ${n}레인으로 확대`;
const AUGS = {
  // 공용 수치형
  a_dmg:  { name: '고출력',   abbr: '출력', min: 0, for: 'all', v: [10, 21, 41, 100], ap: pct('dmgPct'),  d: v => `공격력 +${v}%` },
  a_rate: { name: '속사',     abbr: '속사', min: 0, for: 'all', v: [9, 18, 36, 72],  ap: pct('ratePct'), d: v => `공격 속도 +${v}%` },
  a_crit: { name: '정밀 타격', abbr: '정밀', min: 0, for: 'all', v: [12, 24, 48, 90],   ap: pct('crit'),    d: v => `치명타 확률 +${v}%` },
  // 블래스터
  b_pierce: { name: '관통탄', abbr: '관통', min: 0, for: 'blaster', v: [1, 2, 3, 4], ap: add('pierce'), d: v => `탄환이 적 ${v}명을 추가로 관통 (관통할 때마다 피해 -45%)` },
  b_multi:  { name: '연발',   abbr: '연발', min: 2, for: 'blaster', v: [0, 0, 1, 2], ap: add('shots'),  d: v => `탄환 ${v}발 추가 발사 (추가 탄 피해 ${Math.round(CFG.extraShotMul * 100)}%)` },
  b_boom:   { name: '폭발탄', abbr: '폭발', min: 2, for: 'blaster', v: [0, 0, 25, 63], ap: pct('splash'), d: v => `적중 시 주변 적에게 피해의 ${v}% 폭발` },
  b_seek:   { name: '유도탄', abbr: '유도', min: 2, for: 'blaster', v: [0, 0, 2, 4], w: [0, 0, 25, 63], ap: (s, v, w) => { s.lanes += v; s.dmgPct += w / 100; }, d: (v, w) => `${laneText(v)}, 공격력 +${w}%` },
  b_frost:  { name: '냉각탄', abbr: '냉각', min: 0, for: 'blaster', v: [17, 35, 69, 80], ap: mx('slow'), d: v => `적중한 적을 1.5초간 ${v}% 둔화` },
  // 산탄포
  s_wide:   { name: '광각 산탄', abbr: '광각', min: 2, for: 'shotgun', v: [0, 0, 1, 3], ap: add('lanes'), d: v => v >= 3 ? '모든 레인에 산탄 발사' : '양옆 2레인까지 산탄 발사' },
  s_pellet: { name: '추가 산탄', abbr: '산탄', min: 2, for: 'shotgun', v: [0, 0, 1, 2], ap: add('shots'), d: v => `레인마다 산탄 ${v}발 추가 (추가 탄 피해 ${Math.round(CFG.extraShotMul * 100)}%)` },
  s_knock:  { name: '충격탄',   abbr: '충격', min: 0, for: 'shotgun', v: [4.8, 9.5, 19, 48], ap: add('knock'), d: v => `적중한 적을 뒤로 밀어냄 (세기 ${v}, 보스 제외)` },
  s_close:  { name: '근접 사격', abbr: '근접', min: 0, for: 'shotgun', v: [12, 24, 48, 120], ap: pct('closePct'), d: v => `기지 가까이 온 적에게 피해 +${v}%` },
  s_pierce: { name: '철갑 산탄', abbr: '철갑', min: 1, for: 'shotgun', v: [0, 1, 2, 4], ap: add('pierce'), d: v => `산탄이 적 ${v}명을 추가로 관통 (관통할 때마다 피해 -45%)` },
  // 레이저
  l_burn:   { name: '잔열',     abbr: '잔열', min: 0, for: 'laser', v: [8.8, 18, 35, 88], ap: mx('burn'), d: v => `적중한 적에게 3초간 초당 공격력의 ${v}% 화상 피해` },
  l_wide:   { name: '광폭 빔',  abbr: '광폭', min: 2, for: 'laser', v: [0, 0, 12, 30], ap: pct('sideBeam'), d: v => `양옆 레인의 적에게도 ${v}% 피해` },
  l_charge: { name: '과충전',   abbr: '충전', min: 0, for: 'laser', v: [40, 80, 160, 400], ap: pct('third'), d: v => `3번째 발사마다 피해 +${v}%` },
  l_exec:   { name: '소멸 광선', abbr: '소멸', min: 2, for: 'laser', v: [0, 0, 12, 30], ap: mx('instakill'), d: v => `체력이 ${v}% 이하로 떨어진 일반 적을 즉시 처치` },
  // 펄스
  p_area:   { name: '범위 증폭', abbr: '증폭', min: 0, for: 'pulse', v: [11, 23, 45, 55], ap: pct('areaPct'), d: v => `파동 범위 +${v}%` },
  p_knock:  { name: '충격파',   abbr: '충격', min: 0, for: 'pulse', v: [2.5, 5, 10, 15], ap: add('knock'), d: v => `범위 안의 적을 뒤로 밀어냄 (세기 ${v}, 보스 제외)` },
  p_frost:  { name: '빙결장',   abbr: '빙결', min: 0, for: 'pulse', v: [8.8, 18, 35, 55], ap: mx('slow'), d: v => `범위 안의 적을 1.5초간 ${v}% 둔화` },
  p_echo:   { name: '이중 파동', abbr: '이중', min: 2, for: 'pulse', v: [0, 0, 55, 90], ap: pct('echo'), d: v => `${v}% 확률로 파동이 한 번 더 발생` },
  // 박격포
  m_big:     { name: '대형 포탄', abbr: '대형', min: 0, for: 'mortar', v: [14, 28, 55, 100], ap: pct('areaPct'), d: v => `폭발 범위 +${v}%` },
  m_cluster: { name: '집속탄',   abbr: '집속', min: 2, for: 'mortar', v: [0, 0, 2, 4], ap: add('cluster'), d: v => `폭발 후 주변에 소형 폭발 ${v}개 추가 (피해 80%)` },
  m_fire:    { name: '화염 지대', abbr: '화염', min: 2, for: 'mortar', v: [0, 0, 26, 65], ap: mx('pool'), d: v => `착탄 지점에 3초간 초당 공격력의 ${v}% 피해` },
  m_boss:    { name: '정밀 포격', abbr: '포격', min: 0, for: 'mortar', v: [53, 110, 211, 530], ap: pct('bossPct'), d: v => `보스와 대형 적(육각형)에게 주는 피해 +${v}%` },
  // 전격기
  t_chain: { name: '연쇄 증폭', abbr: '연쇄', min: 0, for: 'tesla', v: [1, 2, 3, 5], ap: add('chain'), d: v => `연쇄 횟수 +${v}` },
  t_stun:  { name: '감전',     abbr: '감전', min: 0, for: 'tesla', v: [11, 22, 44, 90], ap: mx('stun'), d: v => `적중 시 ${v}% 확률로 0.8초 기절 (보스 제외)` },
  t_grow:  { name: '과부하',   abbr: '과부', min: 2, for: 'tesla', v: [0, 0, 15, 38], ap: mx('chainGrow'), d: v => `연쇄할 때마다 피해가 줄지 않고 ${v}%씩 증가` },
  t_wide:  { name: '광역 방전', abbr: '광역', min: 2, for: 'tesla', v: [0, 0, 2, 4], w: [0, 0, 20, 20], ap: (s, v, w) => { s.lanes += v; s.chain += v / 2 + 1; s.dmgPct += w / 100; }, d: (v, w) => `${laneText(v + 1)}, 연쇄 +${v / 2 + 1}, 공격력 +${w}%` },
  // 눈에 보이는 변화가 큰 증강 (대부분 영웅 이상)
  a_boom:    { name: '연쇄 폭발', min: 2, for: 'all',     v: [0, 0, 15, 38],   ap: mx('deathBoom'), d: v => `이 무기로 처치한 적이 폭발해 주변에 공격력의 ${v}% 피해` },
  b_rico:    { name: '도탄',     min: 2, for: 'blaster', v: [0, 0, 1, 2],      ap: add('rico'),   d: v => `탄환이 적중 후 가까운 다른 적에게 ${v}번 튕김 (튕길 때마다 피해 -50%)` },
  b_split:   { name: '분열탄',   min: 2, for: 'blaster', v: [0, 0, 2, 3],      ap: add('split'),  d: v => `탄환이 적중하면 작은 탄 ${v}개로 갈라져 날아감 (피해 35%)` },
  s_double:  { name: '2연발',    min: 2, for: 'shotgun', v: [0, 0, 37, 80],  ap: mx('again'),   d: v => `발사 직후 한 번 더 발사 (피해 ${v}%)` },
  s_blast:   { name: '폭렬 산탄', min: 2, for: 'shotgun', v: [0, 0, 21, 53],    ap: pct('splash'), d: v => `산탄이 적중하면 폭발해 주변에 피해의 ${v}%` },
  l_freeze:  { name: '냉동 광선', min: 2, for: 'laser',   v: [0, 0, 0.2, 0.5], ap: (s, v) => { s.freeze = Math.max(s.freeze, v); }, d: v => `적중한 적을 ${v}초간 얼림 (보스는 둔화)` },
  l_orbit:   { name: '궤도 포격', min: 2, for: 'laser',   v: [0, 0, 23, 58],   ap: mx('orbit'),   d: v => `발사할 때마다 적이 있는 다른 레인 하나에 빔 낙하 (피해 ${v}%)` },
  p_stun:    { name: '충격 마비', min: 1, for: 'pulse',   v: [0, 18, 35, 70],   ap: mx('stun'),    d: v => `파동에 맞은 적이 ${v}% 확률로 0.8초 기절 (보스 제외)` },
  m_shrap:   { name: '파편탄',   min: 2, for: 'mortar',  v: [0, 0, 6, 8],      ap: add('shrap'),  d: v => `폭발할 때 파편 ${v}개가 사방으로 날아감 (피해 25%)` },
  m_barrage: { name: '연속 포격', min: 2, for: 'mortar',  v: [0, 0, 1, 2],      ap: add('barrage'), d: v => `다른 적을 노리는 포탄 ${v}발 추가 발사 (피해 33%)` },
  m_nuke:    { name: '핵탄두',   min: 3, for: 'mortar',  v: [0, 0, 0, 3],      ap: add('nuke'),   d: v => `4번째 포탄마다 핵탄두: 폭발 범위 2.5배, 피해 ${v}배` },
  t_slow:    { name: '정전기장', min: 1, for: 'tesla',   v: [0, 35, 70, 80],   ap: mx('slow'),    d: v => `감전된 적을 1.5초간 ${v}% 둔화` },
  t_multi:   { name: '다중 방전', min: 2, for: 'tesla',   v: [0, 0, 1, 2],      ap: add('multi'),  d: v => `처음 노리는 적이 ${v}명 늘어남 (각각 연쇄, 추가된 적의 연쇄는 피해 50%)` },
  t_storm:   { name: '번개 폭풍', min: 3, for: 'tesla',   v: [0, 0, 0, 5],      ap: add('storm'),  d: v => `3번째 공격마다 무작위 적 ${v}명에게 낙뢰 (피해 80%)` },
  // 저격포
  r_heavy:   { name: '철갑탄',   abbr: '철갑', min: 0, for: 'rail', v: [18, 35, 70, 180], ap: pct('bossPct'), d: v => `보스와 대형 적(육각형)에게 주는 피해 +${v}%` },
  r_mark:    { name: '표식',     abbr: '표식', min: 0, for: 'rail', v: [4.5, 9, 18, 45], ap: (s, v) => { s.vuln = Math.max(s.vuln, v / 100); s.vulnT = 4; }, d: v => `맞은 적이 4초간 받는 모든 피해 +${v}%` },
  r_through: { name: '관통 저격', min: 2, for: 'rail', v: [0, 0, 60, 150], ap: mx('through'), d: v => `탄이 표적 뒤 일직선상의 적도 관통 (피해 ${v}%)` },
  r_twin:    { name: '이중 저격', min: 2, for: 'rail', v: [0, 0, 60, 150], ap: mx('twin'),    d: v => `두 번째로 체력이 많은 적도 저격 (피해 ${v}%)` },
  r_carry:   { name: '과잉 살상', min: 3, for: 'rail', v: [0, 0, 0, 3],     ap: add('carry'),  d: v => `적을 처치하고 남은 피해가 다음으로 체력이 많은 적에게 넘어감 (최대 ${v}회)` },
  // 산성 분사기
  c_corrode: { name: '부식액',   abbr: '부식', min: 0, for: 'acid', v: [9.8, 20, 39, 98], ap: pct('aVuln'), d: v => `웅덩이의 취약 효과 +${v}%p` },
  c_range:   { name: '넓은 웅덩이', abbr: '넓이', min: 0, for: 'acid', v: [8.8, 18, 35, 88], ap: pct('aRange'), d: v => `웅덩이 범위 +${v}%` },
  c_pool:    { name: '끈적한 산', abbr: '끈적', min: 0, for: 'acid', v: [11, 21, 42, 80], ap: mx('aSlow'), d: v => `웅덩이 안의 적을 ${v}% 둔화` },
  c_wide:    { name: '다중 투척', min: 2, for: 'acid', v: [0, 0, 1, 2], ap: add('aMulti'), d: v => `웅덩이를 ${v}개 더 던짐` },
  c_melt:    { name: '용해',     min: 3, for: 'acid', v: [0, 0, 0, 15.8], ap: (s, v) => { s.aMelt = Math.max(s.aMelt, v / 100); s.deathBoom = Math.max(s.deathBoom, 1.0); }, d: v => `웅덩이 안에서 체력이 ${v}% 이하가 된 일반 적을 즉시 처치. 처치한 적은 산성 폭발` },
  // 기지 증강 (기지 강화 5단계마다)
  h_armor:  { name: '강화 장갑',   min: 0, for: 'base', v: [7.5, 15, 30, 75], w: [2, 4, 8, 20], ap: (s, v, w) => { s.hpPct += v / 100; s.dmgRed += w / 100; }, d: (v, w) => `기지 최대 체력 +${v}% · 기지가 받는 피해 -${w}%` },
  h_supply: { name: '보급선',     min: 0, for: 'base', v: [1.8, 3.5, 7, 18],   ap: pct('goldAll'), d: v => `재화 획득 +${v}%` },
  h_repair: { name: '정비반',     min: 0, for: 'base', v: [0.063, 0.13, 0.25, 0.63], w: [1.3, 2.5, 5, 13], ap: (s, v, w) => { s.regenPct += v / 100; s.bossHeal += w / 100; }, d: (v, w) => `1초마다 최대 체력의 ${v}% 회복 · 보스를 처치하면 체력 ${w}% 회복` },
  h_drill:  { name: '숙련 공병',   min: 0, for: 'base', v: [0.8, 1.6, 3.2, 8],      ap: pct('luck'),    d: v => `모든 강화의 성공률 +${v}%p` },
  h_turret: { name: '방어 포탑',   min: 2, for: 'base', v: [0, 0, 11, 28],    ap: mx('turret'),   d: v => `기지 중앙의 포탑이 가장 가까운 적을 자동 공격 (가장 강한 무기 화력의 ${v}%)` },
  h_shock:  { name: '충격 방벽',   min: 2, for: 'base', v: [0, 0, 8, 20],   ap: add('shock'),   d: v => `적이 기지에 닿으면 충격파가 퍼져 근처 적을 밀어내고 가장 강한 무기 화력의 ${v}% 피해` },
  h_fence:  { name: '전기 울타리', min: 2, for: 'base', v: [0, 0, 9, 23],    ap: mx('fence'),    d: v => `기지 바로 앞의 적에게 지속 피해 (가장 강한 무기 화력의 ${v}%)` },
  h_wave:   { name: '빙결 파동',   min: 2, for: 'base', v: [0, 0, 30, 12],    ap: (s, v) => { s.wave = s.wave ? Math.min(s.wave, v) : v; }, d: v => `${v}초마다 전장의 모든 적을 1.5초간 얼림 (보스는 둔화)` },
  h_bomb:   { name: '비상 폭격',   min: 3, for: 'base', v: [0, 0, 0, 35],     ap: add('bomb'),    d: v => `기지 체력이 ${v}% 아래로 떨어지면 전장 전체를 폭격 (60초마다 1회)` },
};
const AUG_POOL = {};
for (const wid of WEAPON_IDS) AUG_POOL[wid] = Object.keys(AUGS).filter(id => AUGS[id].for === 'all' || AUGS[id].for === wid);
AUG_POOL.base = Object.keys(AUGS).filter(id => AUGS[id].for === 'base');

// 항목의 g등급 수치: 둘째 수치(w)가 있는 항목은 둘 다 넘긴다
const val = (D, g) => [D.v[g], D.w ? D.w[g] : undefined];
function partDesc(p) { const D = PARTS[p.id], x = val(D, p.g); return D.d(x[0], x[1]); }
function augDesc(a) { const D = AUGS[a.id], x = val(D, a.g); return D.d(x[0], x[1]); }

/* ---------- 진화와 스킬 ---------- */
// 진화한 무기는 5강마다 스킬 포인트 1개를 받는다(모두 20개). 무기 종류마다 줄 3개, 줄마다 노드 3개(뿌리 5, 윗단 5, 마지막 1 = 11포인트).
// 노드는 증강 효과를 그대로 쓴다. 뿌리는 랭크당 영웅 수치의 20%, 윗단은 25%, 마지막 노드는 전설 수치 그대로. '+1/랭크'는 랭크당 1씩 더한다.
const SK = { root: 0.2, up: 0.25, max: { root: 5, up: 5, cap: 1 } };
const r1 = (n) => +(Math.round(n * 100) / 100);
const mkNode = (id, t, o) => Object.assign({ id, t, max: SK.max[t] }, o);
const SR = (id, o) => mkNode(id, 'root', o), SU = (id, o) => mkNode(id, 'up', o), SC = (id, o) => mkNode(id, 'cap', o);
// 새 노드: 이름, 설명 d(랭크, 배율), 효과 ap(s, 랭크, 배율). 배율(sc)은 줄마다 하나, 피해 같은 세기 수치에만 곱한다(메커니즘은 그대로)
const pc = (x) => r1(x * 100);   // 0.12 -> 12
const NEWSK = {
  // 블래스터 - 개틀링
  gatling:  { name: '개틀링 포신', d: (k, c) => `공격 속도 +${pc(0.15 * k * c)}%, 탄 피해 -${5 * k}%. 탄이 가늘고 빨라짐`, ap: (s, k, c) => { s.gat = k; s.ratePct += 0.15 * k * c; } },
  warm:     { name: '예열', d: (k, c) => `쉬지 않고 쏘면 발사마다 공격 속도 +${r1(0.6 * k * c)}% (최대 +${r1(6 * k * c)}%). 1.5초 쉬면 초기화`, ap: (s, k, c) => { s.warm = k; s.warmR = 0.006 * k * c; } },
  tri:      { name: '삼연장', d: (k, c) => `양옆 레인에도 동시에 발사 (옆 레인 탄 피해 ${pc(0.5 * c)}%)`, ap: (s, k, c) => { s.tri = 1; s.triD = 0.5 * c; } },
  lightb:   { name: '광탄', d: (k) => `탄이 빛살로 바뀌고 적 ${k}명을 추가로 관통 (관통할 때마다 피해 -45%)`, ap: (s, k) => { s.beam = k; s.pierce += k; } },
  accel:    { name: '가속 관통', d: (k) => `관통할 때 줄어드는 피해를 ${9 * k}%p 완화 (관통당 -${Math.max(0, 45 - 9 * k)}%)`, ap: (s, k) => { s.pk = Math.min(1, 0.55 + 0.09 * k); } },
  gigab:    { name: '거대탄', d: (k, c) => `4번째 발사마다 레인 폭 거대탄: 피해 ${r1(3 * c)}배, 모든 적 관통`, ap: (s, k, c) => { s.gnt = 1; s.gntM = 3 * c; } },
  turret:   { name: '보조 포탑', d: (k, c) => `옆에 작은 포탑이 떠서 옆 레인을 공격 (피해 공격력의 ${pc(0.12 * k * c)}%)`, ap: (s, k, c) => { s.tur = k; s.turD = 0.12 * k * c; } },
  turboost: { name: '포탑 과급', d: (k) => `포탑 공격 속도 +${10 * k}%`, ap: (s, k) => { s.turRate = 0.1 * k; } },
  twinturr: { name: '쌍포탑', d: () => '반대쪽에 포탑 하나 더. 포탑 탄이 맞으면 작은 폭발 (반경 45, 탄 피해 40%)', ap: (s) => { s.turTwin = 1; } },
  // 산탄포 - 슬러그
  slugb:    { name: '슬러그탄', d: (k, c) => `3번째 발사마다 정면에 대형 탄: 피해 공격력의 ${pc((0.4 + 0.2 * k) * c)}%, 모든 적 관통, 밀어냄 12`, ap: (s, k, c) => { s.slug = (0.4 + 0.2 * k) * c; s.slugKn += 12; s.slugEvery = 3; } },
  heavyb:   { name: '묵직한 탄', d: (k) => `슬러그 밀어내는 세기 +${4 * k}, 맞은 적을 1초간 ${10 * k}% 둔화`, ap: (s, k) => { s.slugKn += 4 * k; s.slugSlow = 0.1 * k; } },
  twinslug: { name: '쌍열', d: () => '2번째 발사마다 슬러그. 정면과 양옆 3레인 모두에 발사', ap: (s) => { s.slugTwin = 1; s.slugEvery = 2; } },
  // 산탄포 - 용의 숨결
  flameb:   { name: '화염 산탄', d: (k, c) => `산탄이 부채꼴 불꽃으로 바뀜. 맞은 적은 3초간 초당 공격력의 ${pc(0.08 * k * c)}% 화상`, ap: (s, k, c) => { s.flame = 0.08 * k * c; } },
  sea:      { name: '불바다', d: (k, c) => `사거리 끝에 2초간 불길이 남음. 불길 위의 적은 초당 공격력의 ${pc(0.06 * k * c)}% 피해`, ap: (s, k, c) => { s.sea = 0.06 * k * c; } },
  fireburst:{ name: '폭염', d: () => '화상 중인 적이 죽으면 폭발 (반경 70, 공격력의 100%). 주변 적에게 화상을 옮김', ap: (s) => { s.fb = 1; } },
  // 산탄포 - 지뢰
  mineb:    { name: '산탄 지뢰', d: (k, c) => `4초마다 사거리 안에 지뢰를 깜. 밟으면 폭발 (반경 60, 공격력의 ${pc(0.6 * k * c)}%). 최대 3개, 12초 유지`, ap: (s, k, c) => { s.mine = 0.6 * k * c; s.mineMax += 3; s.mineCd += 4; } },
  quickm:   { name: '빠른 매설', d: (k) => `설치 간격 -${r1(0.4 * k)}초 (${r1(4 - 0.4 * k)}초), 최대 ${3 + (k >= 3 ? 1 : 0) + (k >= 5 ? 1 : 0)}개`, ap: (s, k) => { s.mineCd -= 0.4 * k; s.mineMax += (k >= 3 ? 1 : 0) + (k >= 5 ? 1 : 0); } },
  chainm:   { name: '연쇄 지뢰', d: () => '지뢰가 터지면 적을 밀어내고 (세기 20) 작은 지뢰 2개가 흩어짐 (피해 40%)', ap: (s) => { s.mineChain = 1; } },
  // 레이저 - 지속 빔
  holdb:    { name: '지속 빔', d: (k, c) => `빔이 ${r1(0.2 + 0.1 * k)}초 유지되며 0.1초마다 공격력의 ${pc(0.2 * c)}% 피해`, ap: (s, k, c) => { s.holdT = 0.2 + 0.1 * k; s.holdD = 0.2 * c; } },
  focus:    { name: '초점', d: (k, c) => `빔이 같은 적을 맞히는 동안 틱마다 피해 +${r1(3 * k * c)}% 누적 (최대 20번)`, ap: (s, k, c) => { s.focus = 0.03 * k * c; } },
  always:   { name: '상시 빔', d: (k, c) => `빔이 꺼지지 않음. 0.1초마다 공격력 x${r1(3 * c)} ÷ 공격 간격의 10% 피해. 적중 효과는 0.5초에 한 번`, ap: (s, k, c) => { s.always = 1; s.alwaysM = 3 * c; } },
  // 레이저 - 프리즘
  prismb:   { name: '프리즘', d: (k, c) => `빔이 첫 적에게 닿으면 양옆으로 갈라져 옆 레인의 윗쪽 적을 타격 (공격력의 ${pc(0.12 * k * c)}%)`, ap: (s, k, c) => { s.prism = 0.12 * k * c; } },
  spectrum: { name: '분광', d: (k, c) => `갈라진 빔 피해 +${pc(0.08 * k * c)}%p`, ap: (s, k, c) => { s.prismUp = 0.08 * k * c; } },
  rainbow:  { name: '무지개', d: () => '갈라진 빔이 한 번 더 갈라져 모든 레인을 덮음 (바깥 레인은 60%). 빔이 무지개색', ap: (s) => { s.rainbow = 1; } },
  // 레이저 - 용융
  meltb:    { name: '용융선', d: (k, c) => `빔이 지나간 레인 바닥에 2초간 달궈진 선이 남음. 선 위의 적은 초당 공격력의 ${pc(0.08 * k * c)}% 피해`, ap: (s, k, c) => { s.melt = 0.08 * k * c; s.meltT += 2; } },
  afterh:   { name: '잔열', d: (k) => `용융선 유지 +${r1(0.4 * k)}초, 선 위의 적 ${5 * k}% 둔화`, ap: (s, k) => { s.meltT += 0.4 * k; s.meltSlow = 0.05 * k; } },
  vanish:   { name: '소멸', d: () => '이 무기의 빔이나 용융선으로 체력 15% 이하가 된 일반 적은 즉시 증발', ap: (s) => { s.vap = 0.15; } },
  // 펄스 - 초신성
  novab:    { name: '초신성', d: (k, c) => `5번째 파동마다 거대 파동: 범위 x${r1(1.4 + 0.16 * k)}, 피해 x${r1(1 + 0.2 * k * c)}`, ap: (s, k, c) => { s.nova = 1 + 0.2 * k * c; s.novaR = 1.4 + 0.16 * k; s.novaEvery = 5; } },
  afterg:   { name: '잔광', d: (k, c) => `초신성이 지나간 범위에 1.5초간 빛의 고리가 남아 초당 공격력의 ${pc(0.1 * k * c)}% 피해`, ap: (s, k, c) => { s.halo = 0.1 * k * c; } },
  twinstar: { name: '쌍성', d: () => '3번째 파동마다 초신성이 터지고, 곧바로 한 번 더 터짐 (두 번째 피해 70%)', ap: (s) => { s.twinStar = 1; s.novaEvery = 3; } },
  // 펄스 - 위성 구체
  orbb:     { name: '위성 구체', d: (k, c) => `구체 ${[1, 2, 2, 3, 3][k - 1]}개가 범위 가장자리를 돌며 닿는 적에게 초당 공격력의 ${pc((0.3 + 0.1 * k) * c)}% 피해`, ap: (s, k, c) => { s.orbs = [1, 2, 2, 3, 3][k - 1]; s.orbDps = (0.3 + 0.1 * k) * c; } },
  orbit:    { name: '궤도 확장', d: (k) => `궤도 반경 +${6 * k}%, 구체 크기 +${8 * k}%`, ap: (s, k) => { s.orbRad = 1 + 0.06 * k; s.orbSize = 1 + 0.08 * k; } },
  orbchain: { name: '전기 사슬', d: (k, c) => `구체끼리 번개 줄로 이어짐. 줄에 닿는 적도 피해 (구체 피해의 ${pc(0.6 * c)}%)와 0.3초 기절 (보스 제외, 적 하나당 2초에 한 번)`, ap: (s, k, c) => { s.orbChain = 1; s.orbChainD = 0.6 * c; } },
  // 펄스 - 역장
  fieldb:   { name: '역장', d: (k, c) => `무기 주변에 항상 켜진 역장 (파동 범위의 70%). 안의 적을 ${pc(0.06 * k * c)}% 둔화`, ap: (s, k, c) => { s.fld = 0.06 * k * c; } },
  weaken:   { name: '약화', d: (k, c) => `역장 안의 적이 받는 모든 피해 +${pc(0.03 * k * c)}%`, ap: (s, k, c) => { s.fldVuln = 0.03 * k * c; } },
  counter:  { name: '반격', d: () => '적이 기지에 닿을 때마다 즉시 파동 1회 (0.5초에 한 번)', ap: (s) => { s.counter = 1; } },
  // 2차분 무기(박격포, 전격기, 저격포, 산성 분사기)가 쓰는 노드
  overload: { name: '과전류', d: () => '기절하거나 둔화된 적이 이 무기에게 받는 피해 +40%', ap: (s) => { s.overload = 0.4; } },
  exec:     { name: '처형', d: () => '이 무기의 공격으로 체력이 20% 아래로 남은 일반 적은 즉시 처치', ap: (s) => { s.instakill = Math.max(s.instakill, 0.2); } },
  rapid:    { name: '속사 저격', d: () => '공격 속도 +60%', ap: (s) => { s.ratePct += 0.6; } },
  longacid: { name: '오래 남는 산', d: (k) => `웅덩이 지속 시간 +${r1(0.6 * k)}초`, ap: (s, k) => { s.aDur += 0.6 * k; } },
  linger:   { name: '잔류', d: () => '웅덩이를 벗어난 적이 3초 동안 취약 효과와 지속 피해를 유지', ap: (s) => { s.linger = 3; } },
};
const SNW = (id, t) => mkNode(id, t, { nw: NEWSK[id], sc: 1 });
// 줄: 이름, 노드 3개, 세기 배율(sc). 배율은 tools/balance_log.md 에 기록한다
const LINE = (name, nodes, sc) => { nodes.forEach((n) => { if (n.nw) n.sc = sc == null ? 1 : sc; }); return { name, nodes }; };
const SKILLS = {
  blaster: [LINE('개틀링', [SNW('gatling', 'root'), SNW('warm', 'up'), SNW('tri', 'cap')], 0.5),
            LINE('광탄', [SNW('lightb', 'root'), SNW('accel', 'up'), SNW('gigab', 'cap')]),
            LINE('보조 포탑', [SNW('turret', 'root'), SNW('turboost', 'up'), SNW('twinturr', 'cap')])],
  shotgun: [LINE('슬러그', [SNW('slugb', 'root'), SNW('heavyb', 'up'), SNW('twinslug', 'cap')]),
            LINE('용의 숨결', [SNW('flameb', 'root'), SNW('sea', 'up'), SNW('fireburst', 'cap')]),
            LINE('지뢰', [SNW('mineb', 'root'), SNW('quickm', 'up'), SNW('chainm', 'cap')])],
  laser:   [LINE('지속 빔', [SNW('holdb', 'root'), SNW('focus', 'up'), SNW('always', 'cap')]),
            LINE('프리즘', [SNW('prismb', 'root'), SNW('spectrum', 'up'), SNW('rainbow', 'cap')]),
            LINE('용융', [SNW('meltb', 'root'), SNW('afterh', 'up'), SNW('vanish', 'cap')])],
  pulse:   [LINE('초신성', [SNW('novab', 'root'), SNW('afterg', 'up'), SNW('twinstar', 'cap')]),
            LINE('위성 구체', [SNW('orbb', 'root'), SNW('orbit', 'up'), SNW('orbchain', 'cap')], 2),
            LINE('역장', [SNW('fieldb', 'root'), SNW('weaken', 'up'), SNW('counter', 'cap')])],
  // 2차분: 아직 예전 트리 (증강 효과를 그대로 쓴다)
  mortar:  [{ name: '대구경', nodes: [SR('m_big'), SU('a_dmg'), SC('m_nuke')] },
            { name: '화염', nodes: [SR('m_fire'), SU('a_boom'), SC('m_cluster')] },
            { name: '포격', nodes: [SR('a_rate'), SU('m_boss'), SC('m_barrage')] }],
  tesla:   [{ name: '연쇄', nodes: [SR('t_chain', { plus1: 1 }), SU('t_grow'), SC('t_storm')] },
            { name: '마비', nodes: [SR('t_stun'), SU('t_slow'), SNW('overload', 'cap')] },
            { name: '광역', nodes: [SR('a_rate'), SU('a_dmg'), SC('t_wide')] }],
  rail:    [{ name: '일격', nodes: [SR('a_dmg'), SU('a_crit'), SC('r_carry')] },
            { name: '사냥', nodes: [SR('r_heavy'), SU('r_mark'), SNW('exec', 'cap')] },
            { name: '다중', nodes: [SR('r_through'), SU('r_twin'), SNW('rapid', 'cap')] }],
  acid:    [{ name: '부식', nodes: [SR('c_corrode'), SU('a_dmg'), SC('c_melt')] },
            { name: '늪', nodes: [SR('c_range'), SU('c_pool'), SC('c_wide')] },
            { name: '맹독', nodes: [SR('a_rate'), SNW('longacid', 'up'), SNW('linger', 'cap')] }],
};
// 노드 하나가 합산에서 넘지 못하는 값 (기존 증강의 상한과 같다: 둔화 80%, 확률 90%)
const SK_CAP = { slow: 0.8, stun: 0.9, echo: 0.9, aSlow: 0.8 };
const SK_CAPV = { b_frost: 80, t_slow: 80, p_frost: 80, c_pool: 80, t_stun: 90, p_stun: 90, p_echo: 90 };   // 표시용: 노드 값의 상한(%)
const SK_MAXKEY = { vulnT: 1 };    // 더하지 않고 큰 값을 남기는 항목
function skName(n) { return n.nw ? n.nw.name : AUGS[n.id].name; }
// 랭크 k의 노드 수치 [v, w]
function skVals(n, k) {
  const A = AUGS[n.id];
  if (n.t === 'cap') return [A.v[3], A.w ? A.w[3] : undefined];
  if (n.plus1) return [k, undefined];
  const f = (n.t === 'root' ? SK.root : SK.up) * k;
  let v = r1(A.v[2] * f); if (SK_CAPV[n.id]) v = Math.min(SK_CAPV[n.id], v);
  return [v, A.w ? r1(A.w[2] * f) : undefined];
}
function skDesc(n, k) {
  if (n.nw) return n.nw.d(k, n.sc == null ? 1 : n.sc);
  const x = skVals(n, k); return AUGS[n.id].d(x[0], x[1]);
}
function skApply(s, n, k) {
  if (k <= 0) return;
  if (n.nw) { n.nw.ap(s, k, n.sc == null ? 1 : n.sc); return; }
  const base = blankStats(0, 0), t = blankStats(0, 0), x = skVals(n, k);
  AUGS[n.id].ap(t, x[0], x[1]);
  for (const key in t) {
    if (typeof t[key] !== 'number') continue;
    const dl = t[key] - base[key]; if (!dl) continue;
    if (SK_MAXKEY[key] || (n.id === 'c_melt' && key === 'deathBoom')) { s[key] = Math.max(s[key], t[key]); continue; }
    const nv = s[key] + dl;
    s[key] = SK_CAP[key] ? Math.max(s[key], Math.min(SK_CAP[key], nv)) : nv;   // 이미 상한 위에 있으면 그대로 둔다
  }
}
function applySkills(w, s) {
  const tree = SKILLS[w.type], rk = w.sk;
  if (!tree || !rk) return;
  for (let l = 0; l < 3; l++) for (let t = 0; t < 3; t++) skApply(s, tree[l].nodes[t], rk[l][t] || 0);
}
function effLv(w) { return w.evo ? CFG.maxLv + w.lv : w.lv; }   // 진화한 무기는 100 + 단계로 센다
function skillPoints(w) {
  let spent = 0; if (w.sk) for (const l of w.sk) for (const r of l) spent += r;
  const total = w.evo ? (w.skp || 0) : 0;
  return { total, spent, left: total - spent };
}
function skillRank(w, line, tier) { return w.evo && w.sk ? w.sk[line][tier] || 0 : 0; }
// 노드 상태: {node, rank, max, locked, can, reason}
function skillInfo(w, line, tier) {
  const n = SKILLS[w.type][line].nodes[tier], rank = skillRank(w, line, tier);
  const o = { node: n, name: skName(n), rank, max: n.max, locked: false, can: false, reason: '' };
  if (tier > 0 && skillRank(w, line, tier - 1) < SKILLS[w.type][line].nodes[tier - 1].max) { o.locked = true; o.reason = 'lock'; }
  else if (rank >= n.max) o.reason = 'max';
  else if (skillPoints(w).left <= 0) o.reason = 'points';
  else o.can = true;
  return o;
}
function skillText(w, line, tier, rank) { return rank <= 0 ? '' : skDesc(SKILLS[w.type][line].nodes[tier], rank); }
function skillUp(slot, line, tier) {
  const w = S.slots[slot];
  if (!w || !w.evo || S.over) return { ok: false, reason: 'none' };
  if (!(line >= 0 && line < 3 && tier >= 0 && tier < 3)) return { ok: false, reason: 'none' };
  const i = skillInfo(w, line, tier);
  if (!i.can) return { ok: false, reason: i.reason };
  w.sk[line][tier]++; dirty(w);
  return { ok: true, rank: w.sk[line][tier] };
}
function canEvolve(slot) {
  const w = S && S.slots[slot], cost = CFG.evoCost, have = shardCount();
  const o = { ok: false, reason: '', cost, have };
  if (!w) o.reason = 'none';
  else if (w.evo) o.reason = 'evo';
  else if (w.lv < CFG.maxLv) o.reason = 'lv';
  else if (S.over || S.pendingAug || S.pendingPact) o.reason = 'busy';
  else if (have < cost) o.reason = 'shards';
  else o.ok = true;
  return o;
}
function evolve(slot) {
  const c = canEvolve(slot); if (!c.ok) return c;
  const w = S.slots[slot];
  takeShards(CFG.evoCost);
  w.evo = true; w.lv = 0; w.hi = 0; w.skp = 0; w.sk = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  dirty(w); S.slotDirty = true;
  return { ok: true, cost: CFG.evoCost, have: shardCount() };
}
// 바깥 요인(부식, 도박사, 유물)으로 진화한 무기가 n단계를 잃는다. 0 아래로 내려가면 진화가 풀려 100강 일반 무기가 된다 (스킬과 포인트는 사라지고 조각은 돌려받지 못한다)
function evoLose(w, n, slot) {
  w.hi = Math.max(w.hi || 0, w.lv);
  if (w.lv - n >= 0) { w.lv -= n; dirty(w); return { devo: false }; }
  w.evo = false; w.lv = CFG.maxLv; w.hi = CFG.maxLv; w.skp = 0; delete w.sk; dirty(w);
  if (S.evq) S.evq.push({ k: 'devo', slot, type: w.type });
  S.slotDirty = true;
  return { devo: true };
}

/* ---------- 적 ---------- */
const ENEMIES = {
  basic:  { hp: 20,  speed: 0.068, r: 19, leak: 3,  gold: 2 },
  runner: { hp: 11,  speed: 0.128, r: 15, leak: 2,  gold: 2 },
  swarm:  { hp: 6,   speed: 0.088, r: 10, leak: 1,  gold: 1 },
  heavy:  { hp: 75,  speed: 0.04,  r: 27, leak: 6,  gold: 7 },
  giant:  { hp: 450, speed: 0.024, r: 60, leak: 25, gold: 60, boss: true, name: '거대체', hint: '크고 단단합니다', tip: ['크고 단단함', '화력 집중'] },
  split:  { hp: 300, speed: 0.029, r: 52, leak: 15, gold: 45, boss: true, name: '분열체', hint: '죽으면 셋으로 갈라집니다', tip: ['죽으면 셋 분열', '대형 적 셋 대비'] },
  summon: { hp: 320, speed: 0.026, r: 50, leak: 20, gold: 50, boss: true, name: '소환체', hint: '졸개를 계속 불러냅니다', tip: ['졸개를 계속 소환', '범위 공격 추천'] },
  jammer: { hp: 340, speed: 0.027, r: 52, leak: 22, gold: 55, boss: true, name: '봉쇄체', hint: '무기 칸을 잠급니다. 무기를 다른 칸으로 옮겨 피하세요', tip: ['무기 칸을 잠금', '무기를 옮기세요'] },
  shield: { hp: 300, speed: 0.027, r: 52, leak: 22, gold: 55, boss: true, name: '방패체', hint: '정면 공격을 막습니다. 옆 레인의 무기로 공격하세요', tip: ['정면 공격 막음', '옆 레인 무기로'] },
  thief:  { hp: 320, speed: 0.030, r: 48, leak: 15, gold: 55, boss: true, name: '약탈체', hint: '인벤토리의 물건을 훔쳐 갑니다. 예고된 칸의 물건을 옮기거나 써서 피하세요', tip: ['물건을 훔침', '예고 칸 비우기'] },
  corrode: { hp: 340, speed: 0.026, r: 52, leak: 22, gold: 60, boss: true, name: '부식체', hint: '예고한 칸의 무기 강화 단계를 5 낮춥니다. 0 아래로 내려가면 무기가 사라집니다. 무기를 옮겨 피하세요', tip: ['강화 단계 -5', '예고 칸 무기 이동'] },
};
const BOSS_ORDER = ['giant', 'split', 'summon', 'jammer', 'shield', 'thief', 'corrode'];
// 천칭: 10번째 보스마다 일반 선택 대신 나온다. 체력은 같은 시점 거대체의 2.2배, 속도는 거대체와 같다.
// 열거되지 않는 속성으로 둔다 (벤치가 ENEMIES 전체를 해시해 보정 캐시를 만들기 때문, 그리고 도움말의 일반 보스 목록에서 빼기 위해)
const SCALE_EVERY = 10, SCALE_HP = 2.2, SCALE_T = 4;
Object.defineProperty(ENEMIES, 'scale', { enumerable: false, value: { hp: ENEMIES.giant.hp * SCALE_HP, speed: ENEMIES.giant.speed, r: 56, leak: 25, gold: 60, boss: true, name: '천칭',
  hint: '천칭 등장 · 처치하면 거래를 제안합니다', tip: ['4초마다 단단함/연약함 교대', '연약할 때 집중 공격'] } });

/* ---------- 천칭의 거래 (한 판 동안 영구, 한 번씩만) ---------- */
const PACTS = {
  glass:    { name: '유리 대포',     up: '모든 무기 피해 +15%',               dn: '기지 최대 체력 -30%' },
  overheat: { name: '과열',          up: '모든 무기 공격 속도 +25%',           dn: '모든 강화 성공률 -8%p' },
  greed:    { name: '탐욕',          up: '재화 획득 +40%',                   dn: '적 체력 +15%' },
  rush:     { name: '속전속결',       up: '적 체력 -20%',                    dn: '적 이동 속도 +18%' },
  hunt:     { name: '사냥철',        up: '보스 처치 보상 2배',                dn: '보스가 45초마다 등장' },
  forge:    { name: '용광로의 축복',   up: '용해로 제작 비용 −40%',          dn: '생성에서 파츠가 나오지 않음' },
  focus:    { name: '집중',          up: '남은 무기 피해 +45%',               dn: '5번 무기 칸 영구 폐쇄' },
  gamble:   { name: '도박사',        up: '모든 강화 성공률 +15%p',            dn: '강화 실패 시 10% 확률로 1단계 하락' },
  relic:    { name: '유물 거래',      up: '전설 무기 파츠 1개 즉시 획득',        dn: '강화가 가장 높은 무기 -10강', instant: true },
  blood:    { name: '피의 계약',      up: '적 20마리 처치마다 기지 체력 최대치의 2% 회복', dn: '기지가 받는 피해 +50%' },
  sage:     { name: '현자의 눈',      up: '증강 선택지 등급 +1단계 (최대 전설)',   dn: '증강 선택지 2개, 건너뛸 수 없음' },
  smuggle:  { name: '밀수',          up: '생성 비용 -25%',                   dn: '생성의 8%는 아무것도 나오지 않음' },
};
const PACT_IDS = Object.keys(PACTS);
const PACT = {   // 수치는 한곳에
  glassDmg: 1.15, glassHp: 0.7, heatRate: 1.25, heatSucc: -0.08, minSucc: 0.03, greedGold: 0.4, greedHp: 1.15, rushHp: 0.8, rushSpd: 1.18,
  huntEvery: 45, forgeMul: 0.6, focusDmg: 1.45, focusSlot: 4, gambleSucc: 0.15, gambleDrop: 0.1, relicLoss: 10,
  bloodEvery: 20, bloodHeal: 0.02, bloodDmg: 1.5, smuggleCost: 0.75, smuggleMiss: 0.08,
};

/* ---------- 상태 ---------- */
let S = null;

function newBase() { return { lv: 0, parts: new Array(CFG.baseSlots).fill(null), augs: [null, null, null], kills: 0, dealt: 0, tt: 0, wv: 0, bc: 0, rg: 0 }; }
function newWeapon(type) {
  return { kind: 'w', type, lv: 0, parts: [null, null, null], augs: [null, null, null], cd: 0.3, n: 0, kills: 0, dealt: 0 };
}

function newGame(h) {
  if (h) H = h;
  S = {
    v: 1, t: 0, hp: CFG.baseHp, maxHp: CFG.baseHp, gold: CFG.startGold, kills: 0, dealt: 0, bossKills: 0, gen: 0,
    slots: [null, null, null, null, null],
    inv: new Array(CFG.invSize).fill(null),
    enemies: [], bullets: [], shells: [], pools: [], beams: [], mines: [], fx: [], snd: [], abfx: [], drops: [], rewq: [], crafts: 0, melt: 0,
    spawnAcc: 0, nextBoss: CFG.bossEvery, bossN: 0, pendingBoss: null,
    pendingAug: null, over: false, hitFlash: 0, maxLv: 0,
    shards: 0, locks: {}, steal: null, corr: null, notes: [], lastBoss: null,   // 보스 능력: 잠긴 칸, 약탈 예고, 부식 예고
    pacts: [], pendingPact: null, bloodN: 0,     // 천칭의 거래: 받은 것, 제안 중인 것, 피의 계약의 처치 수
    evq: [],                                      // 화면에 알릴 진화 사건 (진화가 풀림)
  };
  S.base = newBase();
  S.slots[2] = newWeapon('blaster');
  syncMaxHp(); S.hp = S.maxHp;
  return S;
}
function setState(s) { S = s; while (S.inv.length < CFG.invSize) S.inv.push(null); if (!S.snd) S.snd = []; if (!S.abfx) S.abfx = []; if (!S.beams) S.beams = []; if (!S.mines) S.mines = []; if (!S.melt) S.melt = 0; if (!S.rewq) S.rewq = []; if (!S.crafts) S.crafts = 0; if (!S.base) S.base = newBase();
  S.shards = S.shards || 0;   // 예전 저장의 강화 조각 아이템은 재화로 바꾼다
  for (let i = 0; i < S.inv.length; i++) if (S.inv[i] && S.inv[i].kind === 's') { S.shards += S.inv[i].n || 0; S.inv[i] = null; }
  if (!S.evq) S.evq = []; if (!S.pacts) S.pacts = []; if (S.pendingPact === undefined) S.pendingPact = null; if (!S.bloodN) S.bloodN = 0;
  if (!S.locks) S.locks = {}; if (!S.steal) S.steal = null; if (!S.corr) S.corr = null; if (!S.notes) S.notes = []; if (S.lastBoss === undefined) S.lastBoss = null; if (S.pendingBoss === undefined) S.pendingBoss = null;
  syncMaxHp(); }
function setH(h) {
  if (!h || h === H) return;
  if (S) { const k = h / H; for (const e of S.enemies) e.y *= k; }
  H = h;
}

/* ---------- 거래 도우미 ---------- */
function hasPact(id) { return !!S && !!S.pacts && S.pacts.indexOf(id) >= 0; }
function isClosed(k) { return k === PACT.focusSlot && hasPact('focus'); }   // 집중: 5번 무기 칸 폐쇄
function craftBase() { return BAL.craftCost((S && S.crafts) || 0); }   // 거래 할인 전 비용 (등급 굴림의 m은 이 값으로 정한다)
function craftCost() { const c = craftBase(); return hasPact('forge') ? Math.round(c * PACT.forgeMul) : c; }
// 제조 등급 확률(%): 기본 가중치의 누적분포 F에 대해 P(등급 <= g) = F(g)^m, m = 할인 전 비용 / 100 (m번 뽑아 가장 좋은 것)
function craftCum() { let t = 0; for (const w of CFG.craftW) t += w; let a = 0; return CFG.craftW.map(w => (a += w / t)); }
function craftOdds() {
  const m = craftBase() / CFG.craftCost, F = craftCum(); let prev = 0;
  return F.map(f => { const c = Math.pow(f, m), p = c - prev; prev = c; return p * 100; });
}
function bossInterval() { return hasPact('hunt') ? PACT.huntEvery : CFG.bossEvery; }

/* ---------- 능력치 계산 ---------- */
function blankStats(lanes, chain) {
  return {
    dmgPct: 0, ratePct: 0, crit: 0.10, critDmg: 0, rangePct: 0, areaPct: 0, bossPct: 0, goldPct: 0,
    execPct: 0, firstPct: 0, heal: 0, luck: 0, save: 0, dbl: 0,
    pierce: 0, shots: 0, splash: 0, slow: 0, burn: 0, knock: 0, stun: 0, lanes,
    chain, chainGrow: 0, closePct: 0, third: 0, instakill: 0, cluster: 0, pool: 0, echo: 0, sideBeam: 0,
    farPct: 0, gamble: 0, shield: 0, magnet: 0, ramp: 0, deathBoom: 0,
    rico: 0, split: 0, again: 0, slug: 0, freeze: 0, orbit: 0, orbs: 0, nova: 0,
    shrap: 0, barrage: 0, nuke: 0, multi: 0, storm: 0,
    vuln: 0, vulnT: 0, through: 0, twin: 0, carry: 0, poolAcid: 0,
    aVuln: 0, aRange: 0, aSlow: 0, aMulti: 0, aMelt: 0,   // 산성 웅덩이
    overload: 0, aDur: 0, linger: 0,   // 스킬 전용 효과 (2차분 무기)
    // 블래스터 스킬: 개틀링, 예열, 삼연장 / 광탄, 가속 관통, 거대탄 / 보조 포탑, 과급, 쌍포탑
    gat: 0, warm: 0, warmR: 0, tri: 0, triD: 0, beam: 0, pk: 0.55, gnt: 0, gntM: 0, tur: 0, turD: 0, turRate: 0, turTwin: 0,
    // 산탄포 스킬: 슬러그 / 용의 숨결 / 지뢰
    slugKn: 0, slugSlow: 0, slugTwin: 0, slugEvery: 0, flame: 0, sea: 0, fb: 0, mine: 0, mineMax: 0, mineCd: 0, mineChain: 0,
    // 레이저 스킬: 지속 빔 / 프리즘 / 용융
    holdT: 0, holdD: 0, focus: 0, always: 0, alwaysM: 0, prism: 0, prismUp: 0, rainbow: 0, melt: 0, meltT: 0, meltSlow: 0, vap: 0,
    // 펄스 스킬: 초신성 / 위성 구체 / 역장
    novaR: 0, novaEvery: 0, halo: 0, twinStar: 0, orbDps: 0, orbRad: 1, orbSize: 1, orbChain: 0, orbChainD: 0, fld: 0, fldVuln: 0, counter: 0,
    };
}
function stats(w) {
  if (w._s) return w._s;
  const d = WEAPONS[w.type];
  const s = blankStats(d.lanes, d.chain || 0);
  for (const p of w.parts) if (p) PARTS[p.id].ap(s, ...val(PARTS[p.id], p.g));
  for (const a of w.augs) if (a) AUGS[a.id].ap(s, ...val(AUGS[a.id], a.g));
  if (w.evo) applySkills(w, s);           // 진화한 무기: 스킬 노드 (증강 뒤에 더한다)
  const bs = bstats();                    // 기지 파츠의 전체 효과
  s.dmgPct += bs.dmgAll; s.rangePct += bs.rangeAll;
  const rg = Math.max(0.4, 1 + s.rangePct);
  s.dmg = d.dmg * (w.evo ? BAL.lvMul(CFG.maxLv) * BAL.evoMul(w.lv) : BAL.lvMul(w.lv)) * Math.max(0.2, 1 + s.dmgPct);
  s.cd = d.cd / Math.max(0.4, 1 + s.ratePct);
  if (hasPact('glass')) s.dmg *= PACT.glassDmg;
  if (hasPact('focus')) s.dmg *= PACT.focusDmg;
  if (hasPact('overheat')) s.cd /= PACT.heatRate;
  if (s.gat) s.dmg *= 1 - 0.05 * s.gat;   // 개틀링 포신: 탄 피해 -5%/랭크 (다른 효과를 모두 적용한 뒤)
  s.evo = !!w.evo;
  s.range = Math.min(1, d.range * rg);
  s.lanes = Math.min(5, s.lanes);
  s.radius = (d.radius || 0) * (rg + s.areaPct);
  s.blast = (d.blast || 0) * (rg + s.areaPct);
  s.jump = 140 * rg;
  s.crit = Math.min(1, s.crit);
  s.color = d.color;
  s.type = w.type;
  s.w = w;
  Object.defineProperty(w, '_s', { value: s, writable: true, configurable: true, enumerable: false });
  return s;
}
function dirty(w) { if (w) w._s = null; }
// 기지 능력치: 강화 단계, 기지 파츠, 기지 증강의 합
function bstats() {
  const b = S.base; if (b._s) return b._s;
  const s = { hpPct: 0, regenPct: 0, bossHeal: 0, dmgRed: 0, shield: 0, heal: 0, nearSlow: 0, luck: 0, save: 0, magnet: 0, goldAll: 0, dmgAll: 0, rangeAll: 0, revive: 0,
    turret: 0, shock: 0, fence: 0, wave: 0, bomb: 0 };
  for (const p of b.parts) if (p) PARTS[p.id].ap(s, ...val(PARTS[p.id], p.g));
  for (const a of b.augs) if (a) AUGS[a.id].ap(s, ...val(AUGS[a.id], a.g));
  s.shield = Math.min(0.6, s.shield);
  s.maxHp = Math.round((CFG.baseHp + b.lv * CFG.baseHpPerLv) * (1 + s.hpPct));
  if (hasPact('glass')) s.maxHp = Math.max(1, Math.round(s.maxHp * PACT.glassHp));
  if (hasPact('greed')) s.goldAll += PACT.greedGold;
  s.st = Object.assign(blankStats(0, 0), { color: '#7af0c1', type: 'base', w: b, dmg: 0, crit: 0 });   // 기지가 주는 피해의 기록용
  Object.defineProperty(b, '_s', { value: s, writable: true, configurable: true, enumerable: false });
  return s;
}
function syncMaxHp() {
  const m = bstats().maxHp, old = S.maxHp || m;
  if (m > old) S.hp += m - old;
  S.maxHp = m; if (S.hp > m) S.hp = m;
}
function bdirty() {
  S.base._s = null;
  for (const w of S.slots) dirty(w);
  for (const it of S.inv) if (it && it.kind === 'w') dirty(it);
  syncMaxHp();
}
function bestDps() { // 가장 강한 무기의 초당 화력 (기지 포탑 등의 기준)
  let d = 0;
  for (const w of S.slots) if (w) { const st = stats(w); d = Math.max(d, st.dmg / st.cd); }
  return d || 10;
}

/* ---------- 인벤토리 ---------- */
function freeSlot() { return S.inv.indexOf(null); }
function shardCount() { return S.cheat && S.cheat.shards ? Infinity : S.shards || 0; }   // 강화 조각은 인벤토리가 아니라 재화다 (테스트: 조각 무한)
function addShards(n) { S.shards = (S.shards || 0) + n; }
function takeShards(n) { if (S.cheat && S.cheat.shards) return; S.shards = Math.max(0, (S.shards || 0) - n); }
function goldCount() { return S.cheat && S.cheat.gold ? Infinity : S.gold; }            // 테스트: 재화 무한 (줄지 않는다)
function meltCount() { return S.cheat && S.cheat.melt ? Infinity : S.melt || 0; }       // 테스트: 용해로 무한 (게이지가 줄지 않는다)
function addItem(item) {
  const i = freeSlot(); if (i < 0) return -1;
  S.inv[i] = item; return i;
}
function weaponCount() {
  let n = 0;
  for (const w of S.slots) if (w) n++;
  for (const it of S.inv) if (it && it.kind === 'w') n++;
  return n;
}
function ownedTypes() {
  const o = {};
  for (const w of S.slots) if (w) o[w.type] = 1;
  for (const it of S.inv) if (it && it.kind === 'w') o[it.type] = 1;
  return o;
}

/* ---------- 생성 ---------- */
function genCost() { const c = BAL.genCost(S.gen); return hasPact('smuggle') ? Math.max(1, Math.round(c * PACT.smuggleCost)) : c; }
const PART_W = [66, 25, 7.5, 1.5];   // 파츠 등급 가중치 (일반, 희귀, 영웅, 전설)
function rollPartGrade(boost, r) {
  const ws = PART_W;   // 시간과 무관한 고정 확률
  let g = wpick(ws, r);
  if (boost) g = Math.max(1, g, wpick(ws, r), wpick(ws, r));   // 보스 보상: 세 번 굴려 가장 좋은 것, 최소 희귀
  return g;
}
function newPart(boost, r) {
  r = r || subG();
  const g = rollPartGrade(boost, r);
  const ids = (r() < CFG.basePartShare ? BASE_PART_IDS : WEAPON_PART_IDS).filter(id => PARTS[id].min <= g);
  return { kind: 'p', id: pick(ids, r), g };
}
function randomWeapon(preferNew, r) {
  let ids = WEAPON_IDS;
  if (preferNew) { const o = ownedTypes(); const f = ids.filter(id => !o[id]); if (f.length) ids = f; }
  return newWeapon(pick(ids, r || subG()));
}
function generate() {
  if (!S || S.over || S.pendingAug || S.pendingPact) return { ok: false, reason: 'busy' };
  const c = genCost();
  if (goldCount() < c) return { ok: false, reason: 'gold' };
  if (freeSlot() < 0) return { ok: false, reason: 'full' };
  if (!(S.cheat && S.cheat.gold)) S.gold -= c;
  S.gen++;
  const nW = weaponCount();
  const pw = nW < 1 ? 1 : 0.08 + 0.92 * Math.exp(-(nW - 1) / 1.8);  // 무기를 많이 가질수록 연속적으로 줄어든다
  const rg = subG(), r = rg();
  if (hasPact('smuggle') && rg() < PACT.smuggleMiss) return { ok: true, item: { kind: 'x' }, miss: true };   // 밀수: 비용만 나가고 꽝
  let item;
  if (r < pw) item = randomWeapon(nW < 4, rg);
  else if (r < pw + (1 - pw) * 0.18 && !hasPact('forge')) item = newPart(false, rg);   // 용광로의 축복: 파츠 대신 조각
  else { const n = BAL.bundle(c, rg); addShards(n); return { ok: true, item: { kind: 's', n } }; }
  addItem(item);
  return { ok: true, item };
}
function bossDrop() {
  const nW = weaponCount();
  const rg = subG();
  if (rg() < (nW < 5 ? 0.6 : 0.12)) return randomWeapon(true, rg);
  return newPart(true, rg);
}

/* ---------- 장착과 해제 ---------- */
function discard(i) { if (S.inv[i]) { S.inv[i] = null; return true; } return false; }
function moveInv(a, b) { // 인벤토리 안에서 자리 바꾸기
  if (a === b) return false;
  const x = S.inv[a], y = S.inv[b]; if (!x) return false;
  S.inv[a] = y; S.inv[b] = x; return true;
}
// 봉쇄체가 잠근 칸(잠금이 실제로 걸린 때만. 예고 중에는 아직 옮길 수 있다)
function isLocked(k) { const lk = S.locks && S.locks[k]; return !!lk && lk.l > 0; }
function equipWeapon(invIdx, slot) {
  const it = S.inv[invIdx];
  if (!it || it.kind !== 'w' || isLocked(slot) || isClosed(slot)) return false;
  const old = S.slots[slot];
  S.slots[slot] = it; it.cd = 0.2;
  S.inv[invIdx] = old || null;
  return true;
}
function unequipWeapon(slot, idx) {
  const w = S.slots[slot]; if (!w || isLocked(slot)) return false;
  const i = idx != null && S.inv[idx] === null ? idx : freeSlot(); if (i < 0) return false;
  S.inv[i] = w; S.slots[slot] = null; return true;
}
function swapSlots(a, b) {
  if (isLocked(a) || isLocked(b) || isClosed(a) || isClosed(b)) return false;
  const t = S.slots[a]; S.slots[a] = S.slots[b]; S.slots[b] = t;
  for (const w of [S.slots[a], S.slots[b]]) if (w) w.cd = Math.max(w.cd, 0.2);
  return true;
}
function attachPart(invIdx, slot) {
  const it = S.inv[invIdx], w = S.slots[slot];
  if (!it || it.kind !== 'p' || !w) return { ok: false, reason: 'none' };
  if (PARTS[it.id].base) return { ok: false, reason: 'base' };
  const k = w.parts.indexOf(null);
  if (k < 0) return { ok: false, reason: 'full' };
  w.parts[k] = { id: it.id, g: it.g }; S.inv[invIdx] = null; dirty(w);
  return { ok: true };
}
function replacePart(invIdx, slot, k) { // 가득 찬 무기의 파츠 하나와 맞바꾼다. 빠진 파츠는 인벤토리의 그 칸으로 간다
  const it = S.inv[invIdx], w = S.slots[slot];
  if (!it || it.kind !== 'p' || PARTS[it.id].base || !w || !w.parts[k]) return false;
  const old = w.parts[k];
  w.parts[k] = { id: it.id, g: it.g }; S.inv[invIdx] = { kind: 'p', id: old.id, g: old.g }; dirty(w);
  return true;
}
function putPart(invIdx, slot, k) { // 무기의 k번 파츠 칸에 넣는다. 차 있으면 맞바꾼다
  const it = S.inv[invIdx], w = S.slots[slot];
  if (!it || it.kind !== 'p' || PARTS[it.id].base || !w) return false;
  if (w.parts[k]) return replacePart(invIdx, slot, k);
  w.parts[k] = { id: it.id, g: it.g }; S.inv[invIdx] = null; dirty(w);
  return true;
}
// 기지 파츠: k를 주면 그 칸에(차 있으면 맞바꿈), 안 주면 빈 칸에 넣는다
function basePut(invIdx, k) {
  const it = S.inv[invIdx], b = S.base;
  if (!it || it.kind !== 'p' || !PARTS[it.id].base) return { ok: false, reason: 'none' };
  if (k == null) { k = b.parts.indexOf(null); if (k < 0) return { ok: false, reason: 'full' }; }
  const old = b.parts[k];
  b.parts[k] = { id: it.id, g: it.g };
  S.inv[invIdx] = old ? { kind: 'p', id: old.id, g: old.g } : null;
  bdirty();
  return { ok: true };
}
function baseDetach(k) {
  const b = S.base; if (!b.parts[k]) return false;
  const i = freeSlot(); if (i < 0) return false;
  S.inv[i] = { kind: 'p', id: b.parts[k].id, g: b.parts[k].g }; b.parts[k] = null; bdirty();
  return true;
}
function meltSafe(it) { // 모두 분해에서 제외: 영웅 이상 파츠, 강화된 무기, 영웅 이상 파츠가 달린 무기
  if (it.kind === 'p') return it.g >= 2;
  if (it.kind === 'w') return !!it.evo || (it.lv || 0) >= 1 || (it.parts || []).some(p => p && p.g >= 2);   // 진화한 무기는 늘 제외
  return true;
}
function meltAll() { // 인벤토리의 파츠와 무기를 전부 녹인다 (meltSafe 제외)
  let pts = 0, n = 0;
  for (let i = 0; i < S.inv.length; i++) { const it = S.inv[i]; if (it && (it.kind === 'p' || it.kind === 'w') && !meltSafe(it)) { pts += meltPart(i); n++; } }
  return { pts, n };
}
function meltValue(it) { // 녹였을 때 얻는 게이지: 파츠는 등급별, 무기는 강화 단계 + 달린 파츠
  if (!it) return 0;
  if (it.kind === 'p') return CFG.meltPts[it.g];
  if (it.kind !== 'w') return 0;
  const lv = effLv(it);   // 진화한 무기는 100 + 단계
  let v = Math.round(30 + 4 * lv + 0.04 * lv * lv);
  for (const p of it.parts || []) if (p) v += CFG.meltPts[p.g];
  return v;
}
function meltPart(i) { // 용해로: 인벤토리의 파츠 또는 무기를 녹여 게이지를 얻는다
  const it = S.inv[i]; if (!it || (it.kind !== 'p' && it.kind !== 'w')) return 0;
  const pts = meltValue(it);
  S.melt = (S.melt || 0) + pts; S.inv[i] = null;
  return pts;
}
function meltList(list) { // 고른 칸들을 녹인다 (영웅 이상도 포함: 직접 고른 것이므로). 반환: 얻은 게이지와 개수
  let pts = 0, n = 0;
  for (const i of list) { const it = S.inv[i]; if (it && (it.kind === 'p' || it.kind === 'w')) { pts += meltPart(i); n++; } }
  return { pts, n };
}
function meltAllValue() { // 모두 분해가 얻을 게이지와 개수 (미리 보기)
  let pts = 0, n = 0;
  for (const it of S.inv) if (it && (it.kind === 'p' || it.kind === 'w') && !meltSafe(it)) { pts += meltValue(it); n++; }
  return { pts, n };
}
function craftPart() { // 용해로: 게이지를 써서 희귀 이상 파츠를 만든다
  const cc = craftCost();
  if (meltCount() < cc) return { ok: false, reason: 'gauge' };
  const i = freeSlot(); if (i < 0) return { ok: false, reason: 'full' };
  if (!(S.cheat && S.cheat.melt)) S.melt -= cc;
  const m = craftBase() / CFG.craftCost, F = craftCum();
  const rg = subG();
  const c = Math.pow(rg(), 1 / m);          // 연속 최고값: u^(1/m)을 누적 값으로 쓴다. 굴림은 한 번
  let g = F.findIndex(f => c < f); if (g < 0) g = F.length - 1;
  S.crafts = (S.crafts || 0) + 1;
  const item = { kind: 'p', id: pick(PART_IDS.filter(id => PARTS[id].min <= g), rg), g };
  S.inv[i] = item;
  return { ok: true, item, i };
}
function detachPart(slot, k) {
  const w = S.slots[slot]; if (!w || !w.parts[k]) return false;
  const i = freeSlot(); if (i < 0) return false;
  S.inv[i] = { kind: 'p', id: w.parts[k].id, g: w.parts[k].g }; w.parts[k] = null; dirty(w);
  return true;
}

/* ---------- 강화와 증강 ---------- */
function pactSucc() { return (hasPact('overheat') ? PACT.heatSucc : 0) + (hasPact('gamble') ? PACT.gambleSucc : 0); }
function upgradeInfo(t) { // t: 무기 또는 기지
  const next = t.lv + 1;
  let rate = Math.max(PACT.minSucc, Math.min(1, BAL.success(next) + bstats().luck + pactSucc()));   // 하한 3% (기존 곡선은 10% 이상이라 거래 없이는 그대로)
  if (S.cheat && S.cheat.succ) rate = 1;   // 테스트: 강화 100% 성공
  return { cost: t.evo ? CFG.evoCostAdd + CFG.evoCostMul * next : next, rate, have: shardCount(), max: t.lv >= CFG.maxLv };   // 진화한 무기는 100 + 5 x 일반 비용, 성공률은 진화 단계 기준 그대로
}
function tryUpgrade(t) {
  const info = upgradeInfo(t);
  if (info.max) return { ok: false, reason: 'max' };
  if (info.have < info.cost) return { ok: false, reason: 'shards' };
  const bs = bstats();
  const u1 = rndG(), u2 = rndG();      // 절약 파츠가 있든 없든 항상 두 번 뽑아, 성공 굴림이 같은 순서에 놓이게 한다
  const saved = bs.save > 0 && u1 < bs.save;
  if (!saved) takeShards(info.cost);
  const success = (S.cheat && S.cheat.succ) || u2 < info.rate;   // 테스트: 뽑는 횟수는 그대로 두고 판정만 덮어쓴다
  let drop = false;
  let devo = false;
  if (!success && hasPact('gamble') && (t.lv > 0 || t.evo) && rndG() < PACT.gambleDrop) {   // 도박사: 실패하면 10%로 1단계 하락 (진화한 무기는 0강에서도: 0 아래면 진화가 풀림)
    if (t.evo) devo = evoLose(t, 1, S.slots.indexOf(t)).devo;
    else {
      t.hi = Math.max(t.hi || 0, t.lv);   // 이미 받은 증강은 다시 받지 못하게 기록
      t.lv--;
      if (t === S.base) bdirty(); else dirty(t);
    }
    drop = true;
  }
  return { ok: true, success, saved, drop, devo };
}
function upgrade(slot) {
  const w = S.slots[slot];
  if (!w || S.over || S.pendingAug || S.pendingPact) return { ok: false, reason: 'busy' };
  const r = tryUpgrade(w); if (!r.ok) return r;
  if (r.success) {
    w.lv++; dirty(w);
    if (effLv(w) > S.maxLv) S.maxLv = effLv(w);
    if (w.lv % CFG.augEvery === 0 && w.lv > (w.hi || 0)) {
      if (w.evo) { w.skp = (w.skp || 0) + 1; r.point = true; }   // 진화한 무기: 증강 대신 스킬 포인트
      else S.pendingAug = { slot, lv: w.lv, options: rollAugs(w.augs, AUG_POOL[w.type], w.lv) };
    }
  }
  r.lv = w.lv; r.evo = !!w.evo; return r;
}
function upgradeBase() {
  const b = S.base;
  if (S.over || S.pendingAug || S.pendingPact) return { ok: false, reason: 'busy' };
  const r = tryUpgrade(b); if (!r.ok) return r;
  if (r.success) {
    b.lv++; bdirty();
    if (b.lv % CFG.augEvery === 0 && b.lv > (b.hi || 0)) S.pendingAug = { base: true, slot: -1, lv: b.lv, options: rollAugs(b.augs, AUG_POOL.base, b.lv) };
  }
  r.lv = b.lv; return r;
}
function rollAugs(have, pool, lv) {
  const f = lv / CFG.maxLv;
  const ws = [72 - 32 * f, 23 + 7 * f, 4.5 + 17.5 * f, 0.5 + 7.5 * f];
  const out = [], r = subG(), sage = hasPact('sage'), nOpt = sage ? 2 : 3;
  for (let k = 0; k < nOpt; k++) {
    let g = wpick(ws, r), cand = [];
    if (sage) g = Math.min(3, g + 1);   // 현자의 눈: 등급 +1단계
    if (lv === CFG.maxLv) g = k === 0 ? 3 : 2 + wpick([ws[2], ws[3]], r);   // 100단계: 첫째는 전설, 나머지는 영웅 이상
    for (let tries = 0; tries < 4 && !cand.length; tries++) {
      cand = pool.filter(id => AUGS[id].min <= g && !out.some(o => o.id === id) &&
        !have.some(a => a && a.id === id && a.g >= g));
      if (!cand.length) g = Math.min(3, g + 1);
    }
    if (!cand.length) cand = pool.filter(id => !out.some(o => o.id === id));
    const id = pick(cand, r);
    out.push({ id, g: Math.max(g, AUGS[id].min) });
  }
  return out;
}
function augTarget(pa) { return pa.base ? S.base : S.slots[pa.slot]; }
// 반환: {ok} 또는 {ok:false, need:'replace'} (칸이 가득 차서 교체할 칸을 골라야 함)
function chooseAug(i, replaceIdx) {
  const pa = S.pendingAug; if (!pa) return { ok: false };
  const t = augTarget(pa), opt = pa.options[i];
  if (!t || !opt) { S.pendingAug = null; return { ok: false }; }
  let k = t.augs.findIndex(a => a && a.id === opt.id);
  if (k < 0) k = t.augs.indexOf(null);
  if (k < 0) {
    if (replaceIdx == null || replaceIdx < 0 || replaceIdx > 2) return { ok: false, need: 'replace' };
    k = replaceIdx;
  }
  t.augs[k] = { id: opt.id, g: opt.g };
  if (pa.base) bdirty(); else dirty(t);
  S.pendingAug = null;
  return { ok: true };
}
function skipAug(force) { if (!force && hasPact('sage')) return false; S.pendingAug = null; return true; }   // 현자의 눈: 건너뛸 수 없다 (force는 대상이 사라진 경우 정리용)

/* ---------- 천칭의 거래 ---------- */
// 천칭이 죽으면 아직 받지 않은 거래 중 둘을 rndG로 뽑아 제안한다 (남은 것이 하나면 하나, 없으면 제안 없음)
function offerPact() {
  const pool = PACT_IDS.filter(id => S.pacts.indexOf(id) < 0), r = subG(), out = [];
  while (out.length < 2 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  S.pendingPact = out.length ? out : null;
}
function pactDirty() { bdirty(); }   // 거래는 무기와 기지 능력치 모두에 닿는다
function choosePact(i) {
  const pp = S.pendingPact; if (!pp) return { ok: false };
  const id = pp[i]; if (!id || S.pacts.indexOf(id) >= 0) return { ok: false };
  const res = { ok: true, id };
  S.pacts.push(id); S.pendingPact = null;
  if (id === 'focus') {                       // 5번 칸의 무기는 인벤토리로, 가득 차면 녹인다
    const k = PACT.focusSlot, w = S.slots[k];
    if (w) {
      const f = freeSlot();
      if (f >= 0) { S.inv[f] = w; S.slots[k] = null; res.moved = 'inv'; }
      else { const pts = meltValue(w); S.melt = (S.melt || 0) + pts; S.slots[k] = null; res.moved = 'melt'; res.pts = pts; }
      if (S.locks) delete S.locks[k];
      if (S.corr && S.corr.k === k) S.corr = null;
      S.slotDirty = true; S.invDirty = true;
    }
  }
  if (id === 'relic') {                        // 전설 무기 파츠 1개 (가득 차면 게이지로), 강화가 가장 높은 무기 -10강
    const r = subG(), ids = WEAPON_PART_IDS.filter(pid => PARTS[pid].min <= 3);
    const item = { kind: 'p', id: pick(ids, r), g: 3 }, f = freeSlot();
    if (f >= 0) { S.inv[f] = item; res.got = 'inv'; } else { const pts = CFG.meltPts[3]; S.melt = (S.melt || 0) + pts; res.got = 'melt'; res.pts = pts; }
    res.item = item;
    let bk = -1;
    for (let k = 0; k < S.slots.length; k++) { const w = S.slots[k]; if (w && effLv(w) > 0 && (bk < 0 || effLv(w) > effLv(S.slots[bk]))) bk = k; }
    if (bk >= 0) {
      const w = S.slots[bk], from = effLv(w);
      if (w.evo) res.devo = evoLose(w, PACT.relicLoss, bk).devo;   // 진화한 무기: 모자라면 진화가 풀려 100강 일반 무기
      else { w.hi = Math.max(w.hi || 0, from); w.lv = Math.max(0, from - PACT.relicLoss); dirty(w); }
      res.lost = { slot: bk, type: w.type, from, to: effLv(w), evo: !!w.evo };
      S.slotDirty = true;
    }
    S.invDirty = true;
  }
  pactDirty();
  return res;
}
function skipPact() { S.pendingPact = null; }

/* ---------- 효과 표시용 ---------- */
const WARN_T = 3;   // 보스 능력 예고 시간(초)
function snd(name) { if (S.snd && S.snd.length < 24) S.snd.push(name); }
// 보스 능력이 발동한 순간을 화면에 알린다 (번쩍임용)
function abfx(kind, i) { if (S.abfx && S.abfx.length < 8) S.abfx.push({ kind, i }); }
function fx(o) { if (S.fx.length < 200) { o.t = o.d; S.fx.push(o); return o; } return null; }
// 피해 숫자. c: 0 일반, 1 치명타, 2 지속 피해, 3 강화 조각 획득
function fxNum(x, y, v, c) { if (S.fx.length < 270) S.fx.push({ k: 'num', d: 0.6, t: 0.6, x, y, v, c }); }
function flushNum(e) {
  if (e.nAcc > 0) { fxNum(e.x + (rnd() - 0.5) * e.r, e.y - e.r * 0.5, e.nAcc, e.nCrit ? 1 : 0); e.nAcc = 0; e.nCrit = false; e.nT = S.t; }
}
let boomDepth = 0;

/* ---------- 적 생성 ---------- */
function spawn(type, lane, x, y) {
  const d = ENEMIES[type];
  let m = BAL.hpMul(S.t) * (d.boss ? BAL.bossHp : 1);
  if (S.pacts.length) { if (hasPact('greed')) m *= PACT.greedHp; if (hasPact('rush')) m *= PACT.rushHp; }   // 이후 등장하는 적부터
  const cx = (lane + 0.5) * LW;
  const e = {
    type, lane, x: x != null ? x : cx + (d.boss ? 0 : (rndS() - 0.5) * 30), y: y != null ? y : -d.r,
    r: d.r, hp: d.hp * m, maxHp: d.hp * m, speed: d.speed * (d.boss ? BAL.bossSpd : 1) * (hasPact('rush') ? PACT.rushSpd : 1), leak: d.leak, gold: d.gold * BAL.goldMul(S.t),
    boss: !!d.boss, born: S.t, slowT: 0, slowPct: 0, vulnT: 0, vulnPct: 0, burnT: 0, burnDps: 0, burnSt: null, stunT: 0, dead: false, flash: 0,
    fT: 0, fDps: 0, fSt: null, fcB: null, fcN: 0, fcT: 0, chT: -9,   // 스킬: 화염 화상, 초점 누적, 전기 사슬 기절
  };
  e.x = Math.max(e.r * 0.7, Math.min(W - e.r * 0.7, e.x));
  S.enemies.push(e);
  return e;
}
function spawnWave() {
  const ws = BAL.spawnWeights(S.t);   // 순서: basic, runner, swarm, heavy
  const type = ['basic', 'runner', 'swarm', 'heavy'][wpick(ws, rndS)];
  const lane = Math.floor(rndS() * LANES);
  if (type === 'swarm') {
    for (let k = 0; k < 4; k++) spawn('swarm', lane, (lane + 0.5) * LW + (rndS() - 0.5) * 56, -10 - k * 24);
  } else spawn(type, lane);
}
function spawnBoss() {
  // 처음 일곱 번은 정해진 순서, 그 뒤로는 무작위 (같은 보스가 연달아 나오지 않음)
  const isScale = (S.bossN + 1) % SCALE_EVERY === 0;   // 10번째, 20번째... 보스는 천칭
  const type = isScale ? 'scale' : S.bossN < BOSS_ORDER.length ? BOSS_ORDER[S.bossN] : pick(BOSS_ORDER.filter(t => t !== S.lastBoss), rndS);
  if (!isScale) S.lastBoss = type;
  const lane = 1 + Math.floor(rndS() * 3);
  // 예고(WARN_T초) 동안 등장 자리가 고정된다. 예고가 끝나면 그 자리에 나타난다 (위에서 걸어 들어오지 않는다)
  S.pendingBoss = { type, lane, t: WARN_T, x: (lane + 0.5) * LW, y: BAL.bossY };
  S.bossN++;
  fx({ k: 'warn', d: 3.2, text: ENEMIES[type].name, hint: ENEMIES[type].hint });
  snd('warn');
}
function appearBoss() {
  const p = S.pendingBoss; S.pendingBoss = null;
  const e = spawn(p.type, p.lane, p.x, p.y * H);
  if (p.type === 'scale') { e.sc = { heavy: true, t: SCALE_T }; e.dmgMul = 0.5; e.spdMul = 0.6; }
  fx({ k: 'appear', d: 0.3, x: e.x, y: e.y, r: e.r, type: p.type });
  return e;
}

/* ---------- 피해 처리 ---------- */
function kill(e, st) {
  if (e.dead) return;
  e.dead = true; S.kills++;
  if (st && st.w) st.w.kills = (st.w.kills || 0) + 1;
  const bs = bstats();
  S.gold += e.gold * (1 + (st ? st.goldPct : 0) + bs.goldAll) * (e.boss && hasPact('hunt') ? 2 : 1);
  if (hasPact('blood') && ++S.bloodN >= PACT.bloodEvery) { S.bloodN = 0; S.hp = Math.min(S.maxHp, S.hp + S.maxHp * PACT.bloodHeal); }
  if (bs.heal && rndH() < bs.heal && S.hp < S.maxHp) S.hp = Math.min(S.maxHp, S.hp + S.maxHp * 0.01);   // 수리 장치: 최대 체력의 1%
  fx({ k: 'pop', d: 0.25, x: e.x, y: e.y, r: e.r, boss: e.boss });
  if (e.boss) fx({ k: 'bosskill', d: 1.1, x: e.x, y: e.y, r: e.r, type: e.type });   // 보스 처치 연출 (화면 흔들림 포함)
  snd(e.boss ? 'bossdie' : 'kill');
  if (bs.magnet && rnd() < bs.magnet) {
    const n = Math.max(1, Math.round(BAL.bundle(genCost(), rnd) * 0.06));
    addShards(n); fxNum(e.x, e.y, n, 3);
  }
  const fb = e.fT > 0 && e.fSt ? e.fSt : e.burnT > 0 && e.burnSt ? e.burnSt : null;
  if (fb && fb.fb && boomDepth < 2) {          // 폭염: 화상 중인 적이 죽으면 폭발, 주변 적에게 화상을 옮긴다 (맞은 적에게 화염 산탄의 화상이 붙는다)
    boomDepth++;
    const R = 70 * (1 + fb.areaPct);
    fx({ k: 'boom', d: 0.34, x: e.x, y: e.y, r: R, c: '#ff7a2e' });
    for (let i = 0, n = S.enemies.length; i < n; i++) {
      const o = S.enemies[i];
      if (o === e || o.dead || Math.hypot(o.x - e.x, o.y - e.y) > R + o.r * 0.5) continue;
      hit(o, fb.dmg, fb, true);
      if (!o.dead) { o.fT = 3; o.fDps = Math.max(o.fDps || 0, e.fDps || fb.dmg * fb.flame || 0); o.fSt = fb; }
    }
    boomDepth--;
  }
  if (st && st.deathBoom && boomDepth < 2) {
    boomDepth++;
    const R = 70 * (1 + st.areaPct);
    fx({ k: 'boom', d: 0.3, x: e.x, y: e.y, r: R, c: st.type === 'acid' ? st.color : '#ff8a5a' });
    for (let i = 0, n = S.enemies.length; i < n; i++) {
      const o = S.enemies[i];
      if (!o.dead && Math.hypot(o.x - e.x, o.y - e.y) <= R + o.r * 0.5) hit(o, st.dmg * st.deathBoom, st, true);
    }
    boomDepth--;
  }
  if (e.boss) {
    S.bossKills++;
    if (bs.bossHeal) S.hp = Math.min(S.maxHp, S.hp + S.maxHp * bs.bossHeal);   // 보스를 처치하면 체력 회복
    const rn = hasPact('hunt') ? 2 : 1;      // 사냥철: 보스 보상 2배
    for (let k = 0; k < rn; k++) { const d = bossDrop(); S.drops.push(d); S.rewq.push({ item: d, x: e.x, y: e.y, k, n: rn }); }   // rewq: 화면에 보여 줄 보상 사건
    if (e.type === 'scale') offerPact();
    if (e.type === 'split') for (let k = 0; k < 3; k++) spawn('heavy', e.lane, e.x + (k - 1) * 46, e.y - k * 14);
    if (e.type === 'thief') { S.steal = null; S.invDirty = true; }   // 훔친 물건은 돌아오지 않는다
    if (e.type === 'corrode') { S.corr = null; S.slotDirty = true; }
  }
}
function credit(st, amt, e) {
  const real = Math.max(0, Math.min(amt, e.hp));
  S.dealt = (S.dealt || 0) + real;
  if (st && st.w) st.w.dealt = (st.w.dealt || 0) + real;
}
function dot(e, amt, st, vap) {
  if (e.dead) return;
  if (e.vulnT > 0) amt *= 1 + e.vulnPct;        // 취약: 받는 피해 증가
  if (e.dmgMul) amt *= e.dmgMul;                // 천칭: 단단할 때 0.5배, 연약할 때 1.5배
  if (vap && st.vap && !e.boss && (e.hp - amt) / e.maxHp <= st.vap) { if (amt < e.hp) vaporize(e); amt = Math.max(amt, e.hp); }   // 소멸: 용융선으로 체력 15% 이하
  credit(st, amt, e); e.hp -= amt;
  e.dAcc = (e.dAcc || 0) + amt;
  if (S.t - (e.dT || -1) >= 0.4 || e.hp <= 0) { fxNum(e.x + (rnd() - 0.5) * e.r, e.y - e.r * 0.2, e.dAcc, 2); e.dAcc = 0; e.dT = S.t; }
  if (e.hp <= 0) kill(e, st);
}
function vaporize(e) { fx({ k: 'vap', d: 0.4, x: e.x, y: e.y, r: e.r }); }   // 하얀 섬광
let sparkCap = Infinity;   // 한 번에 낼 수 있는 피격 불꽃 수 (산성 분사기처럼 자주 때리는 무기용)
// fixed: 치명타와 각종 피해 보정을 건너뛴다 (넘겨받은 잔여 피해용)
function hit(e, amt, st, noSplash, fixed, noFx) {
  if (e.dead) return;
  let d = amt, crit = false;
  if (!fixed) {
  if (rnd() < st.crit) { d *= 2.0 + st.critDmg; crit = true; }
  if (st.gamble) d *= 0.5 + rnd() * (st.gamble - 0.5);
  if (st.farPct && e.y < H * 0.7) d *= 1 + st.farPct;
  if (e.boss || e.type === 'heavy') d *= 1 + st.bossPct;
  const f = e.hp / e.maxHp;
  if (st.execPct && f <= 0.5) d *= 1 + st.execPct;
  if (st.firstPct && f >= 0.7) d *= 1 + st.firstPct;
  if (st.closePct && e.y > H * 0.65) d *= 1 + st.closePct;
  }
  if (e.vulnT > 0) d *= 1 + e.vulnPct;        // 취약: 받는 피해 증가
  if (e.dmgMul) d *= e.dmgMul;                // 천칭
  if (!fixed) {
  if (st.overload && (e.stunT > 0 || e.slowT > 0)) d *= 1 + st.overload;   // 과전류: 기절하거나 둔화된 적
  if (st.instakill && !e.boss && (e.hp - d) / e.maxHp <= st.instakill) d = e.hp;
  if (st.vap && !e.boss && (e.hp - d) / e.maxHp <= st.vap) { if (d < e.hp) vaporize(e); d = Math.max(d, e.hp); }   // 소멸: 빔에 체력 15% 이하가 된 일반 적은 증발
  if (e.type === 'shield' && st.w) {         // 방패체: 같은 레인의 무기가 쏜 공격은 대부분 막힌다
    const sl = S.slots.indexOf(st.w);
    if (sl >= 0 && Math.abs((sl + 0.5) * LW - e.x) <= 50) d *= 0.2;
  }
  }
  credit(st, d, e);
  e.hp -= d; e.flash = 0.12;
  if (!noFx) {
  if (st.flame) { e.fT = 3; e.fDps = Math.max(e.fDps || 0, st.dmg * st.flame); e.fSt = st; }   // 화염 산탄: 3초간 화상 (증강 화상과 따로 더해진다)
  if (st.slow) { e.slowT = 1.5; e.slowPct = Math.max(e.slowPct, e.boss ? st.slow * 0.5 : st.slow); }
  if (st.burn) { e.burnT = 3; e.burnDps = Math.max(e.burnDps, amt * st.burn); e.burnSt = st; }
  if (st.knock && !e.boss) e.y = Math.max(-e.r, e.y - st.knock);
  if (st.stun && !e.boss && rnd() < st.stun) e.stunT = Math.max(e.stunT, 0.8);
  if (st.freeze) {
    if (e.boss) { e.slowT = Math.max(e.slowT, 1); e.slowPct = Math.max(e.slowPct, 0.4); }
    else { e.stunT = Math.max(e.stunT, st.freeze); e.ice = true; }
  }
  if (st.vuln) { e.vulnPct = Math.max(e.vulnT > 0 ? e.vulnPct || 0 : 0, st.vuln); e.vulnT = st.vulnT; }   // 가장 큰 값을 남기고 시간은 갱신
  if (sparkCap > 0 && S.fx.length < 150) { sparkCap--; S.fx.push({ k: 'spark', d: 0.22, t: 0.22, x: e.x + (rnd() - 0.5) * e.r, y: e.y + (rnd() - 0.5) * e.r, c: st.color }); }
  }
  e.nAcc = (e.nAcc || 0) + d; if (crit) e.nCrit = true;
  if (e.hp <= 0 || S.t - (e.nT || -1) >= 0.2) flushNum(e);
  const ex = e.x, ey = e.y;
  if (e.hp <= 0) kill(e, st);
  if (st.splash && !noSplash && !noFx) {
    const R = 62 * (1 + st.areaPct);
    fx({ k: 'boom', d: 0.22, x: ex, y: ey, r: R, c: st.color });
    for (let i = 0, n = S.enemies.length; i < n; i++) {
      const o = S.enemies[i];
      if (o !== e && !o.dead && Math.hypot(o.x - ex, o.y - ey) <= R + o.r * 0.5) hit(o, amt * st.splash, st, true);
    }
  }
}
function explode(x, y, R, dmg, st) {
  snd('boom');
  fx({ k: 'boom', d: 0.28, x, y, r: R, c: st.color });
  for (let i = 0, n = S.enemies.length; i < n; i++) {
    const o = S.enemies[i];
    if (!o.dead && Math.hypot(o.x - x, o.y - y) <= R + o.r * 0.5) hit(o, dmg, st, true);
  }
}

/* ---------- 무기 발사 ---------- */
function inReach(e, wx, st) {
  return !e.dead && e.y + e.r > 0 &&
    Math.abs(e.x - wx) <= (st.lanes + 0.5) * LW + e.r * 0.4 &&
    (H - e.y) <= st.range * H + e.r;
}
function nearest(wx, st) {
  let best = null;
  for (const e of S.enemies) if (inReach(e, wx, st) && (!best || e.y > best.y)) best = e;
  return best;
}
// 증강으로 조준 범위가 늘어난 무기는 기본 범위 안의 적을 먼저 노리고, 거기에 적이 없을 때만 늘어난 범위를 쓴다
function baseReach(st) { const bl = WEAPONS[st.type].lanes; return st.lanes > bl ? { lanes: bl, range: st.range } : null; }
function nearestPref(wx, st) {
  const b = baseReach(st);
  return (b && nearest(wx, b)) || nearest(wx, st);
}
function bullet(x, y, ang, dmg, st, dist, o) {
  const sp = (o && o.sp) || 900;
  const b = { x, y, vx: Math.sin(ang) * sp, vy: -Math.cos(ang) * sp, dmg, st, pierce: st.pierce, hit: [], left: dist, c: st.color,
    r: 5, rico: st.rico, split: st.split, kn: 0, pk: st.pk || 0.55, d0: dist };
  if (o) Object.assign(b, o);
  S.bullets.push(b);
  return b;
}
// 예열: 발사 횟수가 쌓인 정도(0~10). 1.5초 쉬면 0
const HEAT_MAX = 10, HEAT_IDLE = 1.5;
function heatOf(w, st) { return st.warm && w.ht > 0 && S.t - (w.lf || -9) <= HEAT_IDLE ? w.ht : 0; }
const HC = {};
function heatCol(c, n) {   // 달아오른 탄 색: 무기 색에서 하얀색으로
  const key = c + n; let v = HC[key]; if (v) return v;
  const u = Math.min(1, n / HEAT_MAX) * 0.92, ch = (i) => Math.round(parseInt(c.slice(1 + i * 2, 3 + i * 2), 16) * (1 - u) + 255 * u).toString(16).padStart(2, '0');
  return (HC[key] = '#' + ch(0) + ch(1) + ch(2));
}
function oneLane(st) { return st.one || (st.one = { lanes: 0, range: st.range }); }   // 한 레인만 보는 조준 범위 (캐시)
// 작은 폭발: 쌍포탑 (맞은 적은 이미 맞았으므로 빼고)
function miniBoom(x, y, R, dmg, st, skip) {
  fx({ k: 'boom', d: 0.18, x, y, r: R, c: st.color });
  for (let i = 0, n = S.enemies.length; i < n; i++) {
    const o = S.enemies[i];
    if (o !== skip && !o.dead && Math.hypot(o.x - x, o.y - y) <= R + o.r * 0.5) hit(o, dmg, st, true);
  }
}
// 한 곳에 오래 남는 효과(불길, 용융선, 잔광)는 무기와 키가 같으면 새로 만들지 않고 시간만 갱신한다 (개수가 늘지 않음)
function keepPool(kind, w, key, mk) {
  for (let i = 0, n = S.pools.length; i < n; i++) { const p = S.pools[i]; if (p.kind === kind && p.wk === w && p.key === key) { mk(p); return p; } }
  const p = { kind, wk: w, key, x: 0, y: 0, r: 0, t: 0, dps: 0, st: null, c: '#fff', sd: rnd() };
  mk(p); S.pools.push(p); return p;
}
function fire(w, slot, st) {
  const wx = (slot + 0.5) * LW, wy = H - 2;
  switch (w.type) {
    case 'blaster': {
      const t = nearestPref(wx, st); if (!t) return false;
      const ang = Math.atan2(t.x - wx, wy - t.y);
      const n = 1 + st.shots, dist = st.range * H + 50;
      w.n++;
      const hl = heatOf(w, st);
      const o = { c: hl ? heatCol(st.color, hl) : st.color };
      if (st.gat) { o.sp = 1250; o.th = 1; }      // 개틀링: 가늘고 빠른 탄
      if (st.beam) o.bm = 1;                       // 광탄: 빛살
      if (hl) o.hl = hl;
      fx({ k: 'muz', d: st.gat ? 0.07 : 0.1, x: wx, y: wy - 8, a: ang, c: o.c, g: st.gat ? 1 : 0 });   // 총구 섬광 (개틀링은 짧게 깜빡임)
      if (st.gnt && w.n % 4 === 0) {        // 거대탄: 레인 폭, 모든 적 관통
        bullet(wx, wy, ang, st.dmg * st.gntM, st, H + 120, { pierce: 99, r: 44, rico: 0, split: 0, big: 1, sp: 760, c: st.color });
      } else {
        for (let i = 0; i < n; i++) {
          const off = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.09;
          bullet(wx, wy, ang + off, st.dmg * (i === 0 ? 1 : CFG.extraShotMul), st, dist, o);
        }
      }
      if (st.tri) {                          // 삼연장: 양옆 레인에도 동시에 발사
        const one = oneLane(st);
        for (let d = -1; d <= 1; d += 2) {
          const j = slot + d; if (j < 0 || j >= LANES) continue;
          const cx = (j + 0.5) * LW, t2 = nearest(cx, one);
          const tx = t2 ? t2.x : cx, ty = t2 ? t2.y : H - st.range * H * 0.8;
          bullet(wx, wy, Math.atan2(tx - wx, wy - ty), st.dmg * st.triD, st, dist, o);
        }
      }
      return true;
    }
    case 'shotgun': {
      if (!nearest(wx, st)) return false;
      w.n++;
      if (st.flame) fx({ k: 'fcone', d: 0.28, x: wx, y: wy - 8, sp: Math.min(1.05, 0.46 + 0.2 * st.lanes), c: '#ff7a2e' });   // 화염 산탄: 부채꼴 불꽃
      else {
        fx({ k: 'cone', d: 0.18, x: wx, y: wy - 8, sp: Math.min(1.05, 0.42 + 0.2 * st.lanes), c: st.color });   // 부채꼴 폭발과 연기
        fx({ k: 'smoke', d: 0.55, x: wx, y: wy - 12, r: 16 });
      }
      const dist = st.range * H + 30, n = 1 + st.shots;
      const one = oneLane(st), po = st.flame ? { fl: 1, c: '#ff8a3a', r: 6 } : null;
      for (let j = Math.max(0, slot - st.lanes); j <= Math.min(LANES - 1, slot + st.lanes); j++) {
        const cx = (j + 0.5) * LW;
        const t = nearest(cx, one);
        const tx = t ? t.x : cx, ty = t ? t.y : H - st.range * H * 0.8;
        const ang = Math.atan2(tx - wx, wy - ty);
        for (let i = 0; i < n; i++) bullet(wx, wy, ang + (i === 0 ? 0 : (rnd() - 0.5) * 0.16), st.dmg * (i === 0 ? 1 : CFG.extraShotMul), st, dist, po);
        if (st.sea) keepPool('fire', w, j, (p) => { p.x = cx; p.y = Math.max(30, H - st.range * H + 14); p.r = 40; p.t = 2; p.dps = st.dmg * st.sea; p.st = st; p.c = '#ff7a2e'; });   // 불바다: 사거리 끝에 불길
      }
      if (st.slug && w.n % st.slugEvery === 0) {      // 슬러그탄 (쌍열: 양옆 레인에도)
        const sd = { pierce: 99, r: 12, kn: st.slugKn, sl: st.slugSlow, big: 1 };
        for (let j = st.slugTwin ? Math.max(0, slot - 1) : slot, je = st.slugTwin ? Math.min(LANES - 1, slot + 1) : slot; j <= je; j++)
          bullet((j + 0.5) * LW, wy, 0, st.dmg * st.slug, st, H + 120, sd);
      }
      return true;
    }
    case 'laser': {
      let any = false; const list = []; let first = null;
      for (const e of S.enemies) if (inReach(e, wx, st)) { list.push(e); any = true; if (!first || e.y > first.y) first = e; }
      if (!any) return false;
      w.n++;
      const m = st.third && w.n % 3 === 0 ? 1 + st.third : 1;
      for (const e of list) hit(e, st.dmg * m, st);
      fx({ k: 'beam', d: 0.16, x: wx, y0: H - st.range * H, y1: H, w: (st.lanes * 2 + 1) * (m > 1 ? 16 : 9) * (st.evo ? 1.2 : 1), c: st.color, g: 1 });
      if (st.sideBeam) {
        const reach = 1;
        const wide = { lanes: st.lanes + reach, range: st.range };
        for (const e of S.enemies) if (inReach(e, wx, wide) && list.indexOf(e) < 0) hit(e, st.dmg * m * st.sideBeam, st);
        for (let j = 1; j <= reach; j++) for (const sx of [wx - (st.lanes + j) * LW, wx + (st.lanes + j) * LW]) {
          if (sx > 0 && sx < W) fx({ k: 'beam', d: 0.16, x: sx, y0: H - st.range * H, y1: H, w: 5 * (st.evo ? 1.2 : 1), c: st.color });
        }
      }
      if (st.orbit) {                        // 궤도 포격: 적이 있는 다른 레인에 빔 낙하
        const lanes = [];
        for (let j = 0; j < LANES; j++) {
          if (Math.abs(j - slot) <= st.lanes) continue;
          const cx = (j + 0.5) * LW;
          if (S.enemies.some(e => !e.dead && e.y + e.r > 0 && Math.abs(e.x - cx) <= LW / 2 + e.r * 0.4)) lanes.push(j);
        }
        if (lanes.length) {
          const cx = (pick(lanes) + 0.5) * LW;
          for (const e of S.enemies) if (!e.dead && e.y + e.r > 0 && Math.abs(e.x - cx) <= LW / 2 + e.r * 0.4) hit(e, st.dmg * m * st.orbit, st);
          fx({ k: 'beam', d: 0.3, x: cx, y0: 0, y1: H, w: 16, c: '#ffffff' });
        }
      }
      if (st.prism && first) prismSplit(w, slot, st, first, m);
      if (st.melt) keepPool('melt', w, 0, (p) => { p.x = wx; p.y = H - st.range * H; p.r = 0; p.t = st.meltT; p.dps = st.dmg * st.melt; p.st = st; p.c = st.color; p.slow = st.meltSlow; });   // 용융선
      if (st.holdT && !st.always) S.beams.push({ k: slot, t: st.holdT, tick: 0.1, st });   // 지속 빔 (상시 빔이면 따로 켜져 있다)
      return true;
    }
    case 'pulse': {
      const R = st.radius; const list = [];
      for (const e of S.enemies) if (!e.dead && e.y + e.r > 0 && within(e.x - wx, e.y - H, R + e.r * 0.5)) list.push(e);
      if (!list.length) return false;
      w.n++;
      if (st.nova && w.n % st.novaEvery === 0) {      // 초신성 (쌍성: 3번째 파동마다, 곧바로 한 번 더)
        novaBlast(slot, st, 1, true);
        if (st.twinStar) w.nv = 0.25;
        return true;
      }
      const times = st.echo && rnd() < st.echo ? 2 : 1;
      for (let k = 0; k < times; k++) {
        for (const e of list) hit(e, st.dmg, st);
        fx({ k: 'pulse', d: 0.34 + k * 0.12, x: wx, y: H, r: R, c: st.color });   // 이중 물결과 번쩍임
      }
      return true;
    }
    case 'mortar': {
      let t = null;
      for (const e of S.enemies) if (!e.dead && e.y + e.r > 0 && (!t || e.y > t.y)) t = e;
      if (!t) return false;
      w.n++;
      const nuke = st.nuke && w.n % 4 === 0;
      fx({ k: 'smoke', d: 0.7, x: wx, y: wy - 14, r: 20 });   // 발사 연기
      const targets = [t];
      if (st.barrage) {
        const rest = S.enemies.filter(e => !e.dead && e !== t && e.y + e.r > 0).sort((a, b) => b.y - a.y);
        for (let k = 0; k < st.barrage; k++) targets.push(rest[k * 2] || rest[k] || t);
      }
      targets.forEach((e, k) => {
        const dur = 0.55 + k * 0.14, off = k && e === t ? (rnd() - 0.5) * 120 : 0;
        S.shells.push({ x0: wx, y0: wy, tx: Math.max(10, Math.min(W - 10, e.x + off)), ty: Math.min(H - 6, e.y + e.speed * H * dur), p: 0, dur, st,
          dmg: st.dmg * (k ? 0.33 : nuke ? st.nuke : 1), nuke: !k && nuke });
      });
      return true;
    }
    case 'tesla': {
      const first = nearestPref(wx, st); if (!first) return false;
      w.n++;
      const starts = [first];
      if (st.multi) {
        const bq = baseReach(st);
        let rest = bq ? S.enemies.filter(e => e !== first && inReach(e, wx, bq)) : [];
        if (!rest.length) rest = S.enemies.filter(e => e !== first && inReach(e, wx, st));
        rest.sort((a, b) => b.y - a.y);
        for (let k = 0; k < st.multi && k < rest.length; k++) starts.push(rest[k]);
      }
      const done = starts.slice();
      for (const s0 of starts) {
        let cur = s0, dmg = s0 === first ? st.dmg : st.dmg * 0.5, px = wx, py = wy;
        const pts = [[px, py]];
        for (let j = 0; j <= st.chain && cur; j++) {
          pts.push([cur.x, cur.y]);
          hit(cur, dmg, st);
          dmg *= st.chainGrow ? 1 + st.chainGrow : 0.8;
          px = cur.x; py = cur.y;
          let nx = null, bd = st.jump;
          for (const e of S.enemies) {
            if (e.dead || e.y + e.r <= 0 || done.indexOf(e) >= 0) continue;
            const dd = Math.hypot(e.x - px, e.y - py) - e.r * 0.5;
            if (dd <= bd) { bd = dd; nx = e; }
          }
          cur = nx; if (cur) done.push(cur);
        }
        fx({ k: 'bolt', d: 0.14, pts, c: st.color });
      }
      if (st.storm && w.n % 3 === 0) {        // 번개 폭풍
        const pool = S.enemies.filter(e => !e.dead && e.y + e.r > 0);
        for (let k = 0; k < st.storm && pool.length; k++) {
          const e = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
          fx({ k: 'bolt', d: 0.22, pts: [[e.x + (rnd() - 0.5) * 60, 0], [e.x, e.y]], c: '#ffffff' });
          hit(e, st.dmg * 0.8, st);
        }
      }
      return true;
    }
    case 'rail': {                             // 저격포: 체력이 가장 많은 적을 고르고, 0.25초 조준선을 보인 뒤 발사
      const pool = S.enemies.filter(e => !e.dead && e.y + e.r > 0).sort((a, b) => b.hp - a.hp);
      if (!pool.length) return false;
      w.n++;
      setAim(w, pool[0], wx, wy, st);
      return true;
    }
    case 'acid': {                             // 산성 분사기: 전장의 무작위 적 위치에 산성 웅덩이를 던진다
      const live = S.enemies.filter(e => !e.dead && e.y + e.r > 0);
      if (!live.length) return false;
      w.n++;
      for (let k = 0, n = 1 + st.aMulti; k < n && live.length; k++) {
        const e = live.splice(Math.floor(rnd() * live.length), 1)[0], dur = 0.5 + k * 0.08;
        S.shells.push({ acid: 1, x0: wx, y0: wy, tx: Math.max(10, Math.min(W - 10, e.x)), ty: Math.max(20, Math.min(H - 30, e.y + e.speed * H * dur)), p: 0, dur, st });
      }
      return true;
    }
  }
  return false;
}

// 프리즘: 빔이 첫 적에 닿는 자리에서 양옆으로 갈라져 옆 레인의 윗쪽 적을 맞힌다. 무지개: 한 번 더 갈라져 바깥 레인까지
function prismSplit(w, slot, st, first, m) {
  const one = oneLane(st), top = H - st.range * H, base = st.dmg * m * (st.prism + st.prismUp), reach = st.lanes + 1;
  for (let side = -1; side <= 1; side += 2) {
    const dmax = st.rainbow ? (side < 0 ? slot - st.lanes : LANES - 1 - slot - st.lanes) : 1;   // 이 쪽에 덮을 레인 수
    let px = first.x, py = first.y;
    for (let d = 1; d <= Math.max(1, dmax); d++) {
      const j = slot + side * (st.lanes + d); if (j < 0 || j >= LANES) break;
      const cx = (j + 0.5) * LW, y1 = first.y - (first.y - top) * d / Math.max(1, dmax), mul = d === 1 ? 1 : 0.6;
      for (const e of S.enemies) if (!e.dead && e.y < first.y && inReach(e, cx, one)) hit(e, base * mul, st);
      fx({ k: 'dbeam', d: 0.2, x0: px, y0: py, x1: cx, y1, c: st.color, rb: st.rainbow ? (side < 0 ? d : d + 4) : 0 });
      px = cx; py = y1;
    }
  }
}
// 초신성: 큰 범위에 큰 피해, 잔광(빛의 고리)이 남는다
function novaBlast(slot, st, mult, flash) {
  const wx = (slot + 0.5) * LW, R2 = st.radius * st.novaR;
  for (const e of S.enemies) if (!e.dead && e.y + e.r > 0 && within(e.x - wx, e.y - H, R2 + e.r * 0.5)) hit(e, st.dmg * st.nova * mult, st);
  fx({ k: 'ring', d: 0.55, x: wx, y: H, r: R2, c: mult < 1 ? st.color : '#ffffff', fat: 1 });
  if (flash) fx({ k: 'flash', d: 0.18 });
  if (st.halo) keepPool('halo', st.w, slot, (p) => { p.x = wx; p.y = H; p.r = R2; p.t = 1.5; p.dps = st.dmg * st.halo; p.st = st; p.c = st.color; });
}
// 반격: 적이 기지에 닿을 때 파동 1회
function counterPulse(slot, st) {
  const wx = (slot + 0.5) * LW;
  for (const e of S.enemies) if (!e.dead && e.y + e.r > 0 && within(e.x - wx, e.y - H, st.radius + e.r * 0.5)) hit(e, st.dmg, st);
  fx({ k: 'pulse', d: 0.4, x: wx, y: H, r: st.radius, c: '#ffffff' });
  snd('pulse');
}

// 저격포 조준: 표적과 시간은 무기에 저장한다 (표적은 저장 데이터에 들어가지 않게 숨김 속성으로)
const RAIL_AIM = 0.25;
function setAim(w, t, wx, wy, st) {
  w.aimT = RAIL_AIM;
  Object.defineProperty(w, 'aim', { value: t, writable: true, configurable: true, enumerable: false });
  const f = fx({ k: 'aim', d: RAIL_AIM, x0: wx, y0: wy, x1: t.x, y1: t.y, c: st.color });
  Object.defineProperty(w, 'aimFx', { value: f, writable: true, configurable: true, enumerable: false });
}
function railShoot(w, slot, st) {
  const wx = (slot + 0.5) * LW, wy = H - 2;
  const pool = S.enemies.filter(e => !e.dead && e.y + e.r > 0).sort((a, b) => b.hp - a.hp);
  if (!pool.length) return;
  const aim = w.aim;
  const first = aim && !aim.dead && aim.y + aim.r > 0 ? aim : pool[0];   // 표적이 죽었으면 다시 고른다
  w.aim = null; w.aimFx = null;
  const shots = [[first, 1, true]];
  if (st.twin && pool.length > 1) { const o = pool.find(e => e !== first); if (o) shots.push([o, st.twin / 100, false]); }
  for (const [t, mul, carry] of shots) {
    if (t.dead) continue;
    const tx = t.x, ty = t.y, dx = tx - wx, dy = ty - wy, len = Math.hypot(dx, dy) || 1;
    let ex = tx, ey = ty;
    if (st.through) {                      // 관통 저격: 표적 뒤 일직선상의 적도 맞힌다
      const ux = dx / len, uy = dy / len;
      for (const o of S.enemies) {
        if (o === t || o.dead || o.y + o.r <= 0) continue;
        const ox = o.x - wx, oy = o.y - wy, pr = ox * ux + oy * uy;
        if (pr > len && Math.abs(ox * uy - oy * ux) <= o.r + 4) hit(o, st.dmg * mul * st.through / 100, st);
      }
      ex = wx + ux * 1200; ey = wy + uy * 1200;
    }
    fx({ k: 'rail', d: 0.22, x0: wx, y0: wy, x1: ex, y1: ey, rc: carry ? 1 : 0, c: st.color });
    hit(t, st.dmg * mul, st);
    if (carry && st.carry && t.dead) {     // 과잉 살상: 남은 피해가 다음으로 체력이 많은 적에게 넘어간다
      let over = -t.hp, px = tx, py = ty, k = 0;
      for (let i = 0; i < pool.length && k < st.carry && over > 0.5; i++) {
        const o = pool[i];
        if (o.dead || o === t || o === (shots[1] && shots[1][0])) continue;
        fx({ k: 'rail', d: 0.22, x0: px, y0: py, x1: o.x, y1: o.y, c: st.color });
        hit(o, over, st, true, true);
        over = o.dead ? -o.hp : 0; px = o.x; py = o.y; k++;
      }
    }
  }
  snd('railfire');
}
// 산성 웅덩이
function acidPool(x, y, st) {
  const r = 75 * (1 + st.aRange + st.areaPct);
  S.pools.push({ acid: 1, x, y, r, dps: st.dmg, t: 4 + st.aDur, st, c: st.color, vuln: 0.10 + st.aVuln, slow: Math.max(st.aSlow, st.slow), sd: rnd() });
  fx({ k: 'splat', d: 0.35, x, y, r, c: st.color });
  snd('splat');
}
function acidTick(p, dt, seen) {
  const st = p.st, cm = 1 + st.crit * (1 + st.critDmg);   // 지속 피해에는 치명타 기댓값을 반영
  let got = seen.get(st.w); if (!got) seen.set(st.w, got = new Set());
  for (let i = 0, n = S.enemies.length; i < n; i++) {
    const e = S.enemies[i];
    if (e.dead || !within(e.x - p.x, e.y - p.y, p.r + e.r * 0.5)) continue;
    e.vulnPct = Math.max(e.vulnT > 0 ? e.vulnPct || 0 : 0, p.vuln); e.vulnT = Math.max(e.vulnT, st.linger || 1);   // 안에 있는 동안과 나간 뒤 1초 (잔류: 3초)
    if (p.slow) { e.slowT = Math.max(e.slowT, 0.25); e.slowPct = Math.max(e.slowPct, e.boss ? p.slow * 0.5 : p.slow); }
    if (!got.has(e)) {                     // 웅덩이가 겹쳐도 같은 무기의 지속 피해는 한 번만
      got.add(e);
      const dps = p.dps * cm * (e.boss || e.type === 'heavy' ? 1 + st.bossPct : 1);
      if (st.linger) { e.lgT = st.linger; e.lgDps = dps; e.lgSt = st; e.inT = S.t; }   // 잔류: 나간 뒤에도 같은 피해
      dot(e, dps * dt, st);
    }
    if (!e.dead && st.aMelt && !e.boss && e.hp / e.maxHp <= st.aMelt) { credit(st, e.hp, e); e.hp = 0; kill(e, st); }
  }
}

// 위성 구체의 위치 (화면 표시와 판정이 같은 식을 쓴다). 궤도 확장: 반경 배율 st.orbRad
function orbPos(slot, st, i, t, out) {
  const a = Math.PI * (0.5 + 0.46 * Math.sin(t * 1.5 + i * 2 * Math.PI / st.orbs));
  const R = st.radius * 0.85 * (st.orbRad || 1);
  out = out || [0, 0];
  out[0] = (slot + 0.5) * LW + R * Math.cos(a); out[1] = H - R * Math.sin(a);
  return out;
}
// 점 (px,py)에서 선분 (ax,ay)-(bx,by)까지의 거리
function within(dx, dy, R) { return dx * dx + dy * dy <= R * R; }
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let u = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
  return Math.hypot(px - (ax + dx * u), py - (ay + dy * u));
}
// 보조 포탑의 자리: [x, y, 겨냥하는 레인]. k = 0 첫째(왼쪽, 왼쪽이 없으면 오른쪽), 1 둘째(반대쪽)
function turretPos(slot, k) {
  const side = (slot > 0 ? -1 : 1) * (k ? -1 : 1), j = slot + side >= 0 && slot + side < LANES ? slot + side : slot - side;
  return [(slot + 0.5) * LW + side * 30, H - 22, j];
}
// 예열: 지금 단계(0~1). 화면 표시용
function heatLevel(w) { const st = w && stats(w); return st && st.warm ? heatOf(w, st) / HEAT_MAX : 0; }
// 초점: 같은 적에게 틱마다 쌓이는 횟수 (최대 20). owner = 지속 빔 또는 상시 빔의 무기
function focusN(e, owner) {
  if (e.fcB !== owner || !(S.t - e.fcT <= 0.35)) { e.fcB = owner; e.fcN = 0; }
  e.fcT = S.t; const n = e.fcN; if (n < 20) e.fcN = n + 1; return n;
}
const ORBP = [[0, 0], [0, 0], [0, 0], [0, 0]];
// 스킬이 있는 진화 무기가 매 스텝 하는 일
function skillStep(w, i, st, dt) {
  const wx = (i + 0.5) * LW;
  switch (w.type) {
    case 'blaster': {                        // 보조 포탑: 자기 간격으로 옆 레인을 쏜다
      if (!st.tur) break;
      const n = st.turTwin ? 2 : 1, tcd = st.cd / (1 + st.turRate), one = oneLane(st);
      for (let k = 0; k < n; k++) {
        const key = k ? 't2' : 't1';
        w[key] = (w[key] == null ? 0.2 : w[key]) - dt;
        if (w[key] > 0) continue;
        const tp = turretPos(i, k), t = nearest((tp[2] + 0.5) * LW, one);
        if (!t) { w[key] = 0.05; continue; }
        w[key] = tcd;
        const ang = Math.atan2(t.x - tp[0], tp[1] - t.y);
        w[k ? 'g2' : 'g1'] = ang; w[k ? 'f2' : 'f1'] = S.t;
        bullet(tp[0], tp[1], ang, st.dmg * st.turD, st, st.range * H + 50, { pierce: 0, rico: 0, split: 0, r: 4, sm: 1, tb: st.turTwin, sp: 1000 });
      }
      break;
    }
    case 'shotgun': {                        // 지뢰 설치
      if (!st.mine) break;
      w.mt = (w.mt == null ? 1 : w.mt) - dt;
      if (w.mt > 0) break;
      let cnt = 0; for (const m of S.mines) if (m.wk === w && !m.mini) cnt++;
      if (cnt >= st.mineMax) { w.mt = 0.25; break; }
      w.mt = Math.max(0.5, st.mineCd);
      const j = Math.max(0, Math.min(LANES - 1, i - st.lanes + Math.floor(rnd() * (2 * st.lanes + 1))));
      const x = (j + 0.5) * LW + (rnd() - 0.5) * 50, y = H - st.range * H * (0.3 + 0.6 * rnd());
      S.mines.push({ x, y, t: 12, tr: 16, R: 60 * (1 + st.areaPct), dmg: st.dmg * st.mine, st, wk: w, mini: 0, ph: rnd() * 6 });
      fx({ k: 'boom', d: 0.15, x, y, r: 16, c: st.color });
      break;
    }
    case 'laser': {                          // 상시 빔: 0.1초마다 피해, 5번에 한 번만 적중 효과
      if (!st.always) break;
      w.bt = (w.bt == null ? 0.1 : w.bt) - dt;
      if (w.bt > 1e-9) break;
      w.bt += 0.1; w.bk = (w.bk || 0) + 1;
      const full = w.bk % 5 === 0, mul = st.dmg * st.alwaysM * 0.1 / st.cd;
      for (let j = 0, n = S.enemies.length; j < n; j++) {
        const e = S.enemies[j];
        if (inReach(e, wx, st)) hit(e, mul * (st.focus ? 1 + st.focus * focusN(e, w) : 1), st, !full, false, !full);
      }
      break;
    }
    case 'pulse': {
      if (w.nv > 0) { w.nv -= dt; if (w.nv <= 0) { w.nv = 0; novaBlast(i, st, 0.7, false); } }   // 쌍성: 곧바로 한 번 더
      if (w.ct > 0) w.ct -= dt;
      if (st.fld) {                          // 역장: 항상 켜져 있다
        const R = st.radius * 0.7;
        for (let j = 0, n = S.enemies.length; j < n; j++) {
          const e = S.enemies[j];
          if (e.dead || e.y + e.r <= 0 || !within(e.x - wx, e.y - H, R + e.r * 0.5)) continue;
          e.slowT = Math.max(e.slowT, 0.25); e.slowPct = Math.max(e.slowPct, e.boss ? st.fld * 0.5 : st.fld);
          if (st.fldVuln) { e.vulnPct = Math.max(e.vulnT > 0 ? e.vulnPct || 0 : 0, st.fldVuln); e.vulnT = Math.max(e.vulnT, 0.3); }
        }
      }
      if (st.orbs) {                         // 위성 구체
        const cr = 18 * st.orbSize, dps = st.dmg * st.orbDps;
        let top = 1e9;
        for (let k = 0; k < st.orbs; k++) { orbPos(i, st, k, S.t, ORBP[k]); if (ORBP[k][1] < top) top = ORBP[k][1]; }
        top -= cr + 8;                       // 이보다 위에 있는 적은 구체와 줄에 닿을 수 없다
        const chain = st.orbChain && st.orbs > 1, segs = st.orbs === 2 ? 1 : st.orbs, cdps = dps * st.orbChainD;
        for (let j = 0, n = S.enemies.length; j < n; j++) {
          const e = S.enemies[j];
          if (e.dead || e.y + e.r * 0.6 < top) continue;
          for (let k = 0; k < st.orbs; k++) { const p = ORBP[k]; if (within(e.x - p[0], e.y - p[1], cr + e.r * 0.6)) dot(e, dps * dt, st); }
          if (!chain || e.dead) continue;
          for (let q = 0; q < segs; q++) {   // 전기 사슬: 구체 사이의 줄에 닿는 적
            const a = ORBP[q], b = ORBP[(q + 1) % st.orbs];
            if (segDist(e.x, e.y, a[0], a[1], b[0], b[1]) > e.r * 0.6 + 6) continue;
            dot(e, cdps * dt, st);
            if (!e.dead && !e.boss && S.t - (e.chT == null ? -9 : e.chT) >= 2) { e.stunT = Math.max(e.stunT, 0.3); e.chT = S.t; }
          }
        }
      }
      break;
    }
  }
}
// 오래 남는 효과 (불길, 용융선, 잔광)
function poolTick(p, dt) {
  const st = p.st;
  for (let i = 0, n = S.enemies.length; i < n; i++) {
    const e = S.enemies[i];
    if (e.dead || e.y + e.r <= 0) continue;
    if (p.kind === 'melt') {
      if (Math.abs(e.x - p.x) > 8 + e.r * 0.8 || e.y + e.r < p.y) continue;
      dot(e, p.dps * dt, st, true);
      if (p.slow && !e.dead) { e.slowT = Math.max(e.slowT, 0.25); e.slowPct = Math.max(e.slowPct, e.boss ? p.slow * 0.5 : p.slow); }
    } else if (within(e.x - p.x, e.y - p.y, p.r + e.r * 0.5)) dot(e, p.dps * dt, st);
  }
}
// 연쇄 지뢰: 밀어내고 작은 지뢰가 흩어진다
function mineBlast(m) {
  m.dead = true;
  const st = m.st;
  explode(m.x, m.y, m.R, m.dmg, st);
  if (!st.mineChain) return;
  for (let i = 0, n = S.enemies.length; i < n; i++) { const o = S.enemies[i]; if (!o.dead && !o.boss && within(o.x - m.x, o.y - m.y, m.R + o.r * 0.5)) o.y = Math.max(-o.r, o.y - 20); }
  if (m.mini || S.mines.length >= 60) return;
  for (let k = 0; k < 2; k++) {
    const a = (k + rnd() * 0.8) * Math.PI, d = 40 + rnd() * 30;
    S.mines.push({ x: Math.max(12, Math.min(W - 12, m.x + Math.cos(a) * d)), y: Math.max(20, Math.min(H - 12, m.y + Math.sin(a) * d)), t: 12, tr: 12, R: 40, dmg: m.dmg * 0.4, st, wk: m.wk, mini: 1, ph: rnd() * 6 });
  }
}

/* ---------- 보스 능력 ---------- */
function note(text) { if (S.notes.length < 6) S.notes.push(text); }
function itemName(it) {
  if (it.kind === 'w') return WEAPONS[it.type].name + (it.evo ? ' ★+' : ' +') + it.lv;
  if (it.kind === 'p') return PARTS[it.id].name;
  return '강화 조각 ' + it.n + '개';
}
function bossStep(dt) {
  const alive = {};
  for (let i = 0, n = S.enemies.length; i < n; i++) {
    const e = S.enemies[i];
    if (!e.boss || e.dead) continue;
    alive[e.type] = e;
    if (e.y <= 0) continue;                  // 화면에 들어온 뒤에만 능력을 쓴다
    switch (e.type) {
      case 'summon':
        e.abT = (e.abT == null ? 4 : e.abT) - dt;
        if (e.abT <= 0) {
          e.abT += 4;
          if (S.enemies.length < 150) for (let k = 0; k < 3; k++) spawn('swarm', e.lane, e.x + (k - 1) * 26 + (rndS() - 0.5) * 10, e.y - e.r * 0.4 - k * 6);
          fx({ k: 'ring', d: 0.4, x: e.x, y: e.y, r: e.r * 1.5, c: '#ff5fd0', full: 1 });
        }
        break;
      case 'jammer': {
        e.abT = (e.abT == null ? 7 : e.abT) - dt;
        if (e.abT <= 0) {
          e.abT += 7;
          const c = []; for (let k = 0; k < LANES; k++) if (S.slots[k] && !S.locks[k]) c.push(k);
          if (c.length) { S.locks[pick(c, rndS)] = { w: WARN_T, l: 0 }; S.slotDirty = true; snd('alert'); }
        }
        break;
      }
      case 'thief':
        e.abT = (e.abT == null ? 9 : e.abT) - dt;
        if (e.abT <= 0) {
          e.abT += 9;
          if (!S.steal) {
            const c = []; for (let k = 0; k < S.inv.length; k++) if (S.inv[k]) c.push(k);
            if (c.length) { S.steal = { i: pick(c, rndS), t: WARN_T }; S.invDirty = true; snd('alert'); }
          }
        }
        break;
      case 'scale':                          // 4초마다 단단함(피해 x0.5, 속도 x0.6) <-> 연약함(피해 x1.5, 속도 x1.3)
        e.sc.t -= dt;
        if (e.sc.t <= 0) {
          e.sc.t += SCALE_T; e.sc.heavy = !e.sc.heavy;
          e.dmgMul = e.sc.heavy ? 0.5 : 1.5; e.spdMul = e.sc.heavy ? 0.6 : 1.3;
          fx({ k: 'ring', d: 0.5, x: e.x, y: e.y, r: e.r * 1.7, c: e.sc.heavy ? '#8d99b3' : '#fff2c4', full: 1 });
          snd('alert');
        }
        break;
      case 'corrode':
        e.abT = (e.abT == null ? 12 : e.abT) - dt;
        if (e.abT <= 0) {
          e.abT += 12;
          if (!S.corr) {
            let c = []; for (let k = 0; k < LANES; k++) if (S.slots[k] && effLv(S.slots[k]) > 0) c.push(k);
            if (!c.length) for (let k = 0; k < LANES; k++) if (S.slots[k]) c.push(k);
            if (c.length) { S.corr = { k: pick(c, rndS), t: WARN_T }; S.slotDirty = true; snd('alert'); }
          }
        }
        break;
    }
  }
  // 봉쇄: 경고 3초, 잠금 5초. 봉쇄체가 없으면 모두 풀린다
  if (!alive.jammer) { if (Object.keys(S.locks).length) { S.locks = {}; S.slotDirty = true; } }
  else for (const k of Object.keys(S.locks)) {
    const lk = S.locks[k];
    if (lk.w > 0) { lk.w -= dt; if (lk.w <= 0) { lk.w = 0; lk.l = 5; S.slotDirty = true; abfx('lock', +k); snd('hitlock'); } }
    else { lk.l -= dt; if (lk.l <= 0) { delete S.locks[k]; S.slotDirty = true; } }
  }
  // 약탈: 예고한 칸에 그때 있는 물건을 가져간다
  if (S.steal) {
    const th = alive.thief;
    if (!th) { S.steal = null; S.invDirty = true; }
    else {
      S.steal.t -= dt;
      if (S.steal.t <= 0) {
        const it = S.inv[S.steal.i];
        abfx('steal', S.steal.i);
        if (it) { S.inv[S.steal.i] = null; note('<b>약탈체</b>가 <b>' + itemName(it) + '</b>을(를) 훔쳐 갔습니다.'); snd('hitsteal'); }
        S.steal = null; S.invDirty = true;
      }
    }
  }
  // 부식: 예고한 칸의 무기 강화 단계를 5 낮춘다. 0 아래로 내려가면 무기가 파괴된다
  if (S.corr) {
    if (!alive.corrode) { S.corr = null; S.slotDirty = true; }
    else {
      S.corr.t -= dt;
      if (S.corr.t <= 0) {
        const w = S.slots[S.corr.k];
        abfx('corr', S.corr.k);
        if (w && w.evo) {                    // 진화한 무기: 단계만 낮아지고, 0 아래면 진화가 풀린다 (무기는 사라지지 않는다)
          const k0 = S.corr.k;
          if (!evoLose(w, 5, k0).devo)       // 진화가 풀린 경우의 알림은 evq가 맡는다
            note('<b>부식체</b>가 <b>' + WEAPONS[w.type].name + '</b>의 강화 단계를 낮췄습니다. (★+' + w.lv + ')');
          snd('hitcorr');
        } else if (w) {
          if (w.lv - 5 < 0) {
            S.slots[S.corr.k] = null;
            note('부식: ' + WEAPONS[w.type].name + ' 파괴됨');
          } else {
            w.hi = Math.max(w.hi || 0, w.lv);   // 이미 받은 증강은 다시 받지 못하게 기록
            w.lv -= 5; dirty(w);
            note('<b>부식체</b>가 <b>' + WEAPONS[w.type].name + '</b>의 강화 단계를 낮췄습니다. (+' + w.lv + ')');
          }
          snd('hitcorr');
        }
        S.corr = null; S.slotDirty = true;
      }
    }
  }
}

/* ---------- 한 프레임 진행 ---------- */
function step(dt) {
  if (!S || S.over || S.pendingAug || S.pendingPact) return;
  S.t += dt;
  if (S.hitFlash > 0) S.hitFlash -= dt;

  // 적 등장
  S.spawnAcc += BAL.spawnRate(S.t) * dt;
  while (S.spawnAcc >= 1) { S.spawnAcc -= 1; spawnWave(); }
  if (S.t >= S.nextBoss) { S.nextBoss += bossInterval(); spawnBoss(); }
  if (S.pendingBoss && (S.pendingBoss.t -= dt) <= 0) appearBoss();

  bossStep(dt);

  // 무기
  for (let i = 0; i < LANES; i++) {
    const w = S.slots[i]; if (!w) continue;
    const lk = S.locks[i]; if (lk && lk.l > 0) continue;     // 봉쇄된 칸은 발사하지 않는다
    w.cd -= dt;
    if (w.ag > 0) {                          // 2연발의 두 번째 발사
      w.ag -= dt;
      if (w.ag <= 0) { w.ag = 0; const st = stats(w); if (fire(w, i, Object.assign({}, st, { dmg: st.dmg * st.again }))) snd(w.type); }
    }
    if (w.aimT > 0) {                        // 저격포 조준 중: 표적을 따라가다 시간이 되면 발사
      w.aimT -= dt;
      const f = w.aimFx, a = w.aim;
      if (f && a && !a.dead) { f.x1 = a.x; f.y1 = a.y; }
      if (w.aimT <= 0) { w.aimT = 0; railShoot(w, i, stats(w)); }
    }
    if (w.cd <= 0) {
      const st = stats(w);
      if (fire(w, i, st)) {
        snd(w.type);
        let cd = st.cd;
        if (st.ramp) { w.rp = Math.min(st.ramp, (w.rp || 0) + 0.03); cd /= 1 + w.rp; }
        if (st.warm) {                       // 예열: 쉬지 않고 쏠수록 빨라진다 (1.5초 쉬면 초기화)
          if (!(S.t - (w.lf == null ? -9 : w.lf) <= HEAT_IDLE)) w.ht = 0;
          w.ht = Math.min(HEAT_MAX, (w.ht || 0) + 1); w.lf = S.t; cd /= 1 + st.warmR * w.ht;
        }
        if (st.again) w.ag = 0.13;
        w.cd = st.dbl && rnd() < st.dbl ? Math.min(0.1, cd) : cd;
      } else { w.cd = 0.05; if (w.rp) w.rp = Math.max(0, w.rp - 0.02); }
    }
    { const st = stats(w); if (st.evo) skillStep(w, i, st, dt); }
  }

  // 지속 빔
  for (const b of S.beams) {
    b.t -= dt; b.tick -= dt;
    if (b.tick <= 1e-9) {                    // 0.1초마다 (부동소수 오차로 마지막 틱이 빠지지 않게 아주 작은 여유를 둔다)
      b.tick += 0.1;
      const wx = (b.k + 0.5) * LW;
      const bs_ = b.st, fo = bs_.focus;
      for (let j = 0, n = S.enemies.length; j < n; j++) { const e = S.enemies[j]; if (inReach(e, wx, bs_)) hit(e, bs_.dmg * bs_.holdD * (fo ? 1 + fo * focusN(e, b) : 1), bs_); }
    }
  }

  // 탄환
  for (const b of S.bullets) {
    const mvx = b.vx * dt, mvy = b.vy * dt;
    b.x += mvx; b.y += mvy; b.left -= Math.hypot(mvx, mvy);
    if (b.left <= 0 || b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) { b.dead = true; continue; }
    for (let i = 0, n = S.enemies.length; i < n; i++) {
      const e = S.enemies[i];
      if (e.dead || b.hit.indexOf(e) >= 0) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) <= e.r + b.r) {
        b.hit.push(e);
        hit(e, b.dmg, b.st);
        if (b.kn && !e.boss && !e.dead) e.y = Math.max(-e.r, e.y - b.kn);
        if (b.sl && !e.dead) { e.slowT = Math.max(e.slowT, 1); e.slowPct = Math.max(e.slowPct, e.boss ? b.sl * 0.5 : b.sl); }   // 묵직한 탄: 1초 둔화
        if (b.tb) miniBoom(b.x, b.y, 45, b.dmg * 0.4, b.st, e);           // 쌍포탑: 맞으면 작은 폭발
        if (b.split) {                       // 분열탄
          const base = Math.atan2(b.vx, -b.vy), m = b.split;
          for (let k = 0; k < m; k++) {
            const off = m === 2 ? (k ? 0.5 : -0.5) : (k - 1) * 0.55;
            bullet(b.x, b.y, base + off, b.dmg * 0.35, b.st, 240, { split: 0, rico: 0, pierce: 0, r: 3.5 }).hit.push(e);
          }
          b.split = 0;
        }
        if (b.rico > 0) {                    // 도탄: 가까운 다른 적에게 방향을 바꾼다
          let nx = null, bd = 280;
          for (let j = 0; j < n; j++) {
            const o = S.enemies[j];
            if (o.dead || o.y + o.r <= 0 || b.hit.indexOf(o) >= 0) continue;
            const dd = Math.hypot(o.x - b.x, o.y - b.y);
            if (dd < bd) { bd = dd; nx = o; }
          }
          if (nx) {
            const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(nx.x - b.x, b.y - nx.y);
            b.vx = Math.sin(a) * sp; b.vy = -Math.cos(a) * sp;
            b.rico--; b.dmg *= 0.5; b.left = Math.max(b.left, 320);
            break;
          }
        }
        if (b.pierce-- <= 0) { b.dead = true; break; }
        b.dmg *= b.big ? 0.85 : b.pk;        // 관통할수록 약해진다 (가속 관통: 덜 약해진다)
      }
    }
  }

  // 포탄
  for (const s of S.shells) {
    s.p += dt / s.dur;
    if (s.p >= 1) {
      s.dead = true;
      if (s.acid) { acidPool(s.tx, s.ty, s.st); continue; }
      const st = s.st, R = st.blast * (s.nuke ? 2.5 : 1);
      explode(s.tx, s.ty, R, s.dmg, st);
      fx({ k: 'crater', d: 1.0, x: s.tx, y: s.ty, r: R * 0.75, c: st.color });   // 잠깐 남는 탄흔
      if (s.nuke) { fx({ k: 'flash', d: 0.22 }); fx({ k: 'ring', d: 0.5, x: s.tx, y: s.ty, r: R * 1.15, c: '#ffffff', fat: 1, full: 1 }); }
      for (let k = 0; k < st.shrap; k++) {
        bullet(s.tx, s.ty, k * 2 * Math.PI / st.shrap + rnd() * 0.4, s.dmg * 0.25, st, 170, { sp: 520, pierce: 0, r: 3.5, rico: 0, split: 0 });
      }
      for (let k = 0; k < st.cluster; k++) {
        const a = rnd() * Math.PI * 2, rr = st.blast * (0.6 + rnd() * 0.7);
        explode(s.tx + Math.cos(a) * rr, s.ty + Math.sin(a) * rr, st.blast * 0.6, s.dmg * 0.8, st);
      }
      if (st.pool) S.pools.push({ x: s.tx, y: s.ty, r: R, dps: s.dmg * st.pool, t: 3, st });
    }
  }

  // 화염 지대
  const aSeen = new Map();
  for (const p of S.pools) {
    p.t -= dt;
    if (p.acid) { acidTick(p, dt, aSeen); continue; }
    if (p.kind) { poolTick(p, dt); continue; }
    for (let i = 0, n = S.enemies.length; i < n; i++) {
      const e = S.enemies[i];
      if (!e.dead && within(e.x - p.x, e.y - p.y, p.r + e.r * 0.5)) dot(e, p.dps * dt, p.st);
    }
  }

  // 지뢰: 적이 밟으면 터진다
  if (S.mines.length) {
    for (let q = 0, nm = S.mines.length; q < nm; q++) {
      const m = S.mines[q]; m.t -= dt;
      if (m.t <= 0) { m.dead = true; continue; }
      for (let i = 0, n = S.enemies.length; i < n; i++) {
        const e = S.enemies[i];
        if (!e.dead && e.y + e.r > 0 && within(e.x - m.x, e.y - m.y, m.tr + e.r * 0.6)) { mineBlast(m); break; }
      }
    }
    if (S.mines.some(m => m.dead)) S.mines = S.mines.filter(m => !m.dead);
  }

  // 기지의 자동 효과
  const bs = bstats(), B = S.base;
  if (bs.regenPct && S.hp < S.maxHp) S.hp = Math.min(S.maxHp, S.hp + S.maxHp * bs.regenPct * dt);   // 1초마다 최대 체력의 일정 비율
  if (bs.turret) {                           // 방어 포탑
    B.tt -= dt;
    if (B.tt <= 0) {
      let t = null;
      for (const e of S.enemies) if (!e.dead && e.y + e.r > 0 && (!t || e.y > t.y)) t = e;
      if (t) {
        bullet(W / 2, H - 6, Math.atan2(t.x - W / 2, H - 6 - t.y), bestDps() * bs.turret * 0.5, bs.st, H + 150, { pierce: 0, rico: 0, split: 0, r: 6 });
        snd('blaster'); B.tt = 0.5;
      } else B.tt = 0.1;
    }
  }
  if (bs.fence) {                            // 전기 울타리
    const dps = bestDps() * bs.fence;
    for (let i = 0, n = S.enemies.length; i < n; i++) { const e = S.enemies[i]; if (!e.dead && e.y + e.r > H * 0.86) dot(e, dps * dt, bs.st); }
  }
  if (bs.wave) {                             // 빙결 파동
    B.wv += dt;
    if (B.wv >= bs.wave && S.enemies.some(e => !e.dead && e.y + e.r > 0)) {
      B.wv = 0;
      for (const e of S.enemies) {
        if (e.dead || e.y + e.r <= 0) continue;
        if (e.boss) { e.slowT = Math.max(e.slowT, 1.5); e.slowPct = Math.max(e.slowPct, 0.4); }
        else { e.stunT = Math.max(e.stunT, 1.5); e.ice = true; }
      }
      fx({ k: 'ring', d: 0.7, x: W / 2, y: H, r: Math.hypot(W / 2, H) * 1.05, c: '#8fe3ff', fat: 1 });
      snd('pulse');
    }
  }
  if (B.bc > 0) B.bc -= dt;
  if (bs.bomb && B.bc <= 0 && S.hp / S.maxHp < bs.bomb / 100 && S.enemies.length) {   // 비상 폭격
    B.bc = 60;
    const bd = bestDps() * 8;
    fx({ k: 'flash', d: 0.3 });
    for (let i = 0, n = S.enemies.length; i < n; i++) {
      const e = S.enemies[i]; if (e.dead || e.y + e.r <= 0) continue;
      fx({ k: 'boom', d: 0.4, x: e.x, y: e.y, r: 60, c: '#ffffff' });
      hit(e, bd, bs.st, true);
    }
    snd('bosskill');
  }

  // 적 이동
  for (let i = 0, n = S.enemies.length; i < n; i++) {
    const e = S.enemies[i]; if (e.dead) continue;
    if (e.flash > 0) e.flash -= dt;
    if (e.vulnT > 0) { e.vulnT -= dt; if (e.vulnT <= 0) e.vulnPct = 0; }
    if (e.burnT > 0) { e.burnT -= dt; dot(e, e.burnDps * dt, e.burnSt); if (e.dead) continue; if (e.burnT <= 0) e.burnDps = 0; }
    if (e.fT > 0) { e.fT -= dt; if (e.fSt) dot(e, e.fDps * dt, e.fSt); if (e.dead) continue; if (e.fT <= 0) e.fDps = 0; }   // 화염 산탄의 화상
    if (e.lgT > 0) { e.lgT -= dt; if (e.inT !== S.t) { dot(e, e.lgDps * dt, e.lgSt); if (e.dead) continue; } }   // 산성 잔류: 웅덩이 밖에서만 (안에서는 웅덩이가 이미 준다)
    if (e.stunT > 0) { e.stunT -= dt; if (e.stunT <= 0) e.ice = false; continue; }
    let sp = e.speed;
    if (e.spdMul) sp *= e.spdMul;
    if (e.slowT > 0) { e.slowT -= dt; sp *= 1 - e.slowPct; if (e.slowT <= 0) e.slowPct = 0; }
    if (bs.nearSlow && e.y > H * 0.75) sp *= 1 - (e.boss ? bs.nearSlow * 0.5 : bs.nearSlow);
    e.y += sp * H * dt;
    if (e.y + e.r * 0.3 >= H) {
      e.dead = true;
      const dmg = Math.round(e.leak * (1 - bs.shield) * (1 - bs.dmgRed) * (hasPact('blood') ? PACT.bloodDmg : 1) * 10) / 10;
      if (!(S.cheat && S.cheat.god)) S.hp -= dmg;   // 테스트: 기지 무적
      S.hitFlash = 0.3;
      fx({ k: 'leak', d: 0.5, x: e.x, n: dmg });
      snd('leak');
      for (let q = 0; q < LANES; q++) {      // 반격: 기지에 닿을 때마다 파동 (0.5초에 한 번)
        const cw = S.slots[q];
        if (cw && cw.evo && cw.type === 'pulse' && !(cw.ct > 0)) { const cs = stats(cw); if (cs.counter) { cw.ct = 0.5; counterPulse(q, cs); } }
      }
      if (bs.shock) {                        // 충격 방벽
        const R = 150, bd = bestDps() * bs.shock / 100;
        fx({ k: 'ring', d: 0.45, x: e.x, y: H, r: R, c: '#7af0c1', fat: 1 });
        for (let j = 0; j < n; j++) {
          const o = S.enemies[j];
          if (o.dead || Math.hypot(o.x - e.x, o.y - H) > R + o.r * 0.5) continue;
          o.y = Math.max(-o.r, o.y - (o.boss ? bs.shock * 0.4 : bs.shock));
          hit(o, bd, bs.st, true);
        }
      }
    }
  }

  // 정리
  if (S.enemies.some(e => e.dead)) S.enemies = S.enemies.filter(e => !e.dead);
  if (S.bullets.some(b => b.dead)) S.bullets = S.bullets.filter(b => !b.dead);
  if (S.shells.some(s => s.dead)) S.shells = S.shells.filter(s => !s.dead);
  if (S.pools.some(p => p.t <= 0)) S.pools = S.pools.filter(p => p.t > 0);
  if (S.beams.some(b => b.t <= 0)) S.beams = S.beams.filter(b => b.t > 0);
  for (const f of S.fx) f.t -= dt;
  if (S.fx.some(f => f.t <= 0)) S.fx = S.fx.filter(f => f.t > 0);

  // 보스 보상은 빈 칸이 생길 때 들어온다
  while (S.drops.length && freeSlot() >= 0) { S.inv[freeSlot()] = S.drops.shift(); S.newDrop = true; S.invDirty = true; }

  if (S.hp <= 0) {
    const k = B.parts.findIndex(p => p && p.id === 'barrier');
    if (k >= 0) {                            // 비상 방벽: 한 번 막고 사라진다
      const v = PARTS.barrier.v[B.parts[k].g];
      B.parts[k] = null; bdirty();
      S.hp = Math.max(1, Math.round(S.maxHp * v / 100));
      for (const e of S.enemies) if (!e.dead && !e.boss && e.y > H * 0.5) e.y -= H * 0.3;
      fx({ k: 'flash', d: 0.4 }); fx({ k: 'ring', d: 0.7, x: W / 2, y: H, r: H * 0.8, c: '#7af0c1', fat: 1 });
      snd('bosskill'); S.revived = true; S.invDirty = true;
    } else { S.hp = 0; S.over = true; }
  }
}

/* ---------- 테스트 모드 ---------- */
// S.cheat 는 테스트 게임에만 있다. 일반 게임에서는 아래 함수가 아무 일도 하지 않고, 본문의 분기도 `S.cheat &&` 뒤에만 있다.
const CHEAT_KEYS = ['gold', 'shards', 'succ', 'god', 'melt'];   // 재화 무한, 조각 무한, 강화 100%, 기지 무적, 용해로 무한
const SK_TOTAL = CFG.maxLv / CFG.augEvery;                      // 진화 100강까지 받는 스킬 포인트 (20)
function testOn() { return !!S && !!S.cheat && !S.over; }
function testIdle() { return testOn() && !S.pendingAug && !S.pendingPact; }
function testWeapons() { const a = []; if (testOn()) for (let k = 0; k < S.slots.length; k++) if (S.slots[k]) a.push(k); return a; }
function testTop(w) { w.lv = CFG.maxLv; w.hi = CFG.maxLv; dirty(w); if (effLv(w) > S.maxLv) S.maxLv = effLv(w); }   // hi 를 맞춰 건너뛴 증강은 다시 받지 못한다
const test = {
  KEYS: CHEAT_KEYS,
  // 테스트 게임 시작. flags: { gold, shards, succ, god, melt }
  newGame(flags, h) {
    newGame(h);
    S.cheat = {};
    for (const k of CHEAT_KEYS) S.cheat[k] = !!(flags && flags[k]);
    return S;
  },
  set(key, on) {
    if (!S || !S.cheat || CHEAT_KEYS.indexOf(key) < 0) return false;
    S.cheat[key] = !!on; return true;
  },
  // 무기 받기: 인벤토리에 넣는다 (가득 차면 -1)
  give(type) {
    if (!testOn() || !WEAPONS[type]) return -1;
    const i = addItem(newWeapon(type));
    if (i >= 0) S.invDirty = true;
    return i;
  },
  // 모두 100강: 장착한 무기 전부 (진화한 무기는 진화 100강과 그만큼의 스킬 포인트). 증강은 주지 않는다
  maxAll() {
    const ks = testWeapons();
    for (const k of ks) { const w = S.slots[k]; testTop(w); if (w.evo) w.skp = Math.max(w.skp || 0, SK_TOTAL); }
    if (ks.length) S.slotDirty = true;
    return ks.length;
  },
  // 모두 진화: 장착한 무기 전부 진화 + 진화 100강 + 스킬 포인트 20 (조각을 쓰지 않는다. 이미 찍은 스킬은 그대로)
  evolveAll() {
    const ks = testWeapons();
    for (const k of ks) {
      const w = S.slots[k];
      w.evo = true; if (!w.sk) w.sk = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      w.skp = SK_TOTAL; testTop(w);
    }
    if (ks.length) S.slotDirty = true;
    return ks.length;
  },
  // 스킬 초기화: 장착한 진화 무기의 스킬을 모두 되돌린다 (포인트는 그대로 남으므로 다시 찍을 수 있다)
  resetSkills() {
    let n = 0;
    for (const k of testWeapons()) { const w = S.slots[k]; if (!w.evo) continue; w.sk = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; dirty(w); n++; }
    if (n) S.slotDirty = true;
    return n;
  },
  // 증강 뽑기: 그 칸의 무기에 100강 기준 선택지를 띄운다 (진화한 무기도)
  aug(slot) {
    const w = testIdle() ? S.slots[slot] : null;
    if (!w) return false;
    S.pendingAug = { slot, lv: CFG.maxLv, options: rollAugs(w.augs, AUG_POOL[w.type], CFG.maxLv) };
    return true;
  },
  // 시간 건너뛰기: 적 체력과 등장 곡선이 그만큼 진행한다. 그 사이의 보스는 건너뛴다
  addTime(sec) {
    if (!testOn() || !(sec > 0)) return false;
    S.t += sec;
    while (S.nextBoss <= S.t) S.nextBoss += bossInterval();
    return true;
  },
  // 보스 부르기: 다음 보스를 지금 예고한다 (다음 정기 보스는 지금부터 한 주기 뒤)
  boss() {
    if (!testIdle() || S.pendingBoss) return false;
    spawnBoss(); S.nextBoss = S.t + bossInterval();
    return true;
  },
  // 적 지우기: 보상 없이 모두 없앤다
  clear() {
    if (!testOn()) return 0;
    const n = S.enemies.length;
    for (const e of S.enemies) e.dead = true;
    S.enemies = [];
    return n;
  },
};

const Core = {
  LANES, LW, W, GRADES, CFG, BAL, WEAPONS, WEAPON_IDS, PARTS, AUGS, AUG_POOL, ENEMIES,
  get S() { return S; }, get H() { return H; },
  newGame, setState, setH, step, stats, dirty, generate, genCost, discard, moveInv, equipWeapon, unequipWeapon, swapSlots, isLocked, WARN_T,
  attachPart, replacePart, putPart, meltPart, meltValue, meltAll, meltSafe, craftPart, detachPart, orbPos, turretPos, heatLevel,
  bstats, basePut, baseDetach, upgradeBase, bestDps, BASE_PART_IDS, WEAPON_PART_IDS, upgrade, upgradeInfo, chooseAug, skipAug, shardCount, goldCount, meltCount, freeSlot,
  partDesc, augDesc, newWeapon, seed,
  SKILLS, canEvolve, evolve, skillUp, skillInfo, skillPoints, skillRank, skillText, effLv, evoLose,
  PACTS, PACT, PACT_IDS, hasPact, isClosed, craftCost, craftBase, craftOdds, choosePact, skipPact, meltList, meltAllValue, SCALE_EVERY,
  test,
};
if (typeof module !== 'undefined' && module.exports) module.exports = Core;
else root.Core = Core;
})(typeof window !== 'undefined' ? window : globalThis);

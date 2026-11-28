'use strict';
/* 도형 디펜스 밸런스 벤치: 같은 적 등장 순서(시드 고정)에서 무기 구성만 바꿔 기지 피해(leak)를 비교한다.
   사용: node tools/bench.js [all|weapons|augs|parts|calibrate] [--runs N] */
const { Worker, isMainThread, parentPort } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const os = require('os');

/* ---------- 시나리오 ---------- */
// 적 체력 배수 M은 (기준팀, 시나리오)마다 따로 보정해 tools/bench_cal.json 에 저장해 둔다. 기준팀이 무기 없을 때 피해의 약 45%를 받도록 맞춘다.
const TARGET = 0.45;
const CS = 3;                                   // 보정에 쓰는 시드 수 (시드 1..CS)
const SCEN = {
  few:   { name: '소수 정예', rate: 1.2, w: [0, 0, 0, 1], lv: 40 },
  swarm: { name: '물량',     rate: 9,   w: [3, 2, 5, 0], lv: 40 },
  mix:   { name: '표준 혼합', rate: 5,   w: null,         lv: 40 },
  boss:  { name: '보스전',   rate: 2.5, w: null,         lv: 40, boss: 30 },   // 보스 체력 배수 1.0의 거대체(전력 보스)
  early: { name: '초반',     rate: 1.5, w: [1, 0, 0, 0], lv: 5 },
};
const SC = Object.keys(SCEN);
const WARM = 10, DUR = 120, T0 = 600, DT = 1 / 60;
const FULL_T = 900, FULL_MARKS = [300, 600, 900];   // run 모드: 15분, 화력 기록 시점(초)
const CAL_FILE = path.join(__dirname, 'bench_cal.json');

/* ---------- 한 번의 시뮬레이션 ---------- */
let Core = null, DEFW = null, ORIG = null, makeBot = null;
function init() {
  Core = require(process.env.BENCH_CORE || path.join(__dirname, '..', 'src', 'core.js'));   // BENCH_CORE: 다른 core.js 로 가정 실험(probe)할 때
  makeBot = require(path.join(__dirname, 'bot.js')).makeBot;
  Core.CFG.waves = false;                     // 벤치와 이것을 쓰는 측정 도구(skill_eq, team_eq, item_eq, mortar_eff)는 예전 연속 등장으로 잰다 (T11 웨이브 전 측정과 이어지게)
  DEFW = Core.BAL.spawnWeights(600);          // 600초 시점의 기본 가중치를 고정해 둔다
  Core.BAL.leakMul = () => 1;                 // 벤치는 기지 체력 변화로 leak 을 센다. 시간에 따라 커지는 기지 피해 배수(BAL.leakMul)를 꺼서 leak 단위와 보정 캐시를 예전과 같게 둔다
  ORIG = { hpMul: Core.BAL.hpMul, spawnRate: Core.BAL.spawnRate, spawnWeights: Core.BAL.spawnWeights, bossHp: Core.BAL.bossHp, bossSpd: Core.BAL.bossSpd, bossEvery: Core.CFG.bossEvery };
}
function restoreBal() { Object.assign(Core.BAL, { hpMul: ORIG.hpMul, spawnRate: ORIG.spawnRate, spawnWeights: ORIG.spawnWeights, bossHp: ORIG.bossHp, bossSpd: ORIG.bossSpd }); Core.CFG.bossEvery = ORIG.bossEvery; }
function fnv(h, x) { return Math.imul(h ^ x, 16777619) >>> 0; }
function strHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = fnv(h, str.charCodeAt(i)); return h >>> 0; }

// spec: 길이 5 배열, 항목 = null | {t:무기, p:[[파츠,등급]], a:[[증강,등급]]}
// jit(선택, 기본 없음): 적마다 체력에 exp(jit*u), u는 -1..1 을 곱한다. u는 등장 정보(시각, 종류, 레인, 위치)와 시드의 해시라 구성이 달라도 같은 적이면 같다 (tools/skill_eq.js 가 계단 현상을 줄이려고 쓴다)
function runSim(spec, sk, seed, M, jit) {
  const sc = SCEN[sk];
  Core.seed(seed);
  Core.newGame(520);
  const S = Core.S;
  S.slots = spec.map((o) => {
    if (!o) return null;
    const w = Core.newWeapon(o.t);
    w.lv = sc.lv;
    (o.p || []).forEach((q, i) => { w.parts[i] = { id: q[0], g: q[1] }; });
    (o.a || []).forEach((q, i) => { w.augs[i] = { id: q[0], g: q[1] }; });
    if (o.evo) {                              // 진화한 무기 (0강). sk = [[뿌리, 상위, 궁극] x 3] 스킬 랭크
      w.evo = true; w.lv = 0; w.hi = 0; w.skp = 0; w.sk = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      if (o.sk) { w.sk = o.sk.map((r) => r.slice()); w.skp = w.sk.reduce((a, r) => a + r[0] + r[1] + 3 * r[2], 0); }   // 궁극은 3점
    }
    Core.dirty(w);
    return w;
  });
  S.t = T0;
  const w0 = sc.w || DEFW;
  restoreBal();
  Core.BAL.hpMul = () => M;
  Core.BAL.spawnRate = () => sc.rate;
  Core.BAL.spawnWeights = () => w0;
  Core.BAL.bossHp = 1; Core.BAL.bossSpd = 1;  // 보스 체력/속도 배수 1.0 (전력 보스 시나리오는 보스 보정 배수와 무관하게 같은 조건)
  Core.CFG.bossEvery = sc.boss || 60;
  S.nextBoss = sc.boss ? T0 + WARM + 5 : Infinity;   // 자연 보스 없음
  S.bossN = 0; S.bossOnly = 'giant';         // 보스 시나리오는 늘 거대체 (T11 부터 보스가 처음부터 무작위)
  // 등장 순서 해시: S.enemies.push를 걸어 종류, 레인, 위치, 시각을 기록한다
  let h = 2166136261, ns = 0, step = 0;
  const hook = (arr) => {
    if (arr.__h) return;
    Object.defineProperty(arr, '__h', { value: 1, enumerable: false });
    Object.defineProperty(arr, 'push', { enumerable: false, value: function (e) {
      ns++;
      h = fnv(h, step); h = fnv(h, e.type.length * 31 + e.type.charCodeAt(0)); h = fnv(h, e.lane);
      h = fnv(h, Math.round(e.x * 1000)); h = fnv(h, Math.round(e.y * 1000));
      if (jit) {
        let q = fnv(fnv(fnv(fnv(fnv(fnv(2166136261, seed), step), e.type.length * 31 + e.type.charCodeAt(0)), e.lane), Math.round(e.x * 1000)), Math.round(e.y * 1000));
        q = Math.imul(q ^ (q >>> 16), 0x45d9f3b); q = Math.imul(q ^ (q >>> 16), 0x45d9f3b); q = (q ^ (q >>> 16)) >>> 0;
        const f = Math.exp(jit * ((q / 4294967296) * 2 - 1));
        e.hp *= f; e.maxHp *= f;
      }
      return Array.prototype.push.call(this, e);
    } });
  };
  hook(S.enemies);
  const total = Math.round((WARM + DUR) / DT), warm = Math.round(WARM / DT);
  let leak = 0, d0 = 0, k0 = 0, wd0 = [];
  for (step = 0; step < total; step++) {
    if (step === warm) { d0 = S.dealt; k0 = S.kills; wd0 = S.slots.map((w) => (w ? w.dealt || 0 : 0)); }
    if (sc.boss) S.bossN = 0;                 // 천칭(10번째 보스)이 나오지 않게 한다
    Core.step(DT);
    S.over = false;                           // 기지는 죽지 않는다: 받은 피해만 기록하고 체력을 되돌린다
    if (step >= warm) leak += Math.max(0, S.maxHp - S.hp);
    S.hp = S.maxHp;
    hook(S.enemies);
  }
  Core.seed(null);
  return {
    leak, dealt: S.dealt - d0, kills: S.kills - k0,
    wd: S.slots.map((w, i) => (w ? (w.dealt || 0) : 0) - wd0[i]),
    hash: h >>> 0, ns,
  };
}
function runSeeds(spec, sk, N, M) {
  const out = [];
  for (let s = 1; s <= N; s++) out.push(runSim(spec, sk, s, M));
  return out;
}

/* ---------- 보정 (이분법, 기준팀마다) ---------- */
const NONE = [null, null, null, null, null];
const teamKey = (spec) => spec.map((o) => (o ? o.t : '-')).join(',');
const meanOf = (a) => a.reduce((x, y) => x + y, 0) / a.length;
function calHash(spec, sk) {   // 이 값이 바뀌면 저장된 보정이 낡은 것: 팀에 든 무기 정의, 적 정의, 시나리오, 체력 곡선
  const types = [...new Set(spec.filter(Boolean).map((o) => o.t))].sort();
  return strHash(JSON.stringify([types.map((t) => Core.WEAPONS[t]), SCEN[sk], Core.ENEMIES, DEFW, TARGET, CS, 2]));   // 벤치는 hpMul/spawnWeights를 덮어쓰므로(고정 M, 600초 시점 가중치 DEFW) 곡선 식 자체는 해시에 넣지 않는다
}
function calibrateTeam(spec, sk) {
  const leaks = (M) => meanOf(runSeeds(spec, sk, CS, M).map((r) => r.leak));
  const nl = meanOf(runSeeds(NONE, sk, CS, 1).map((r) => r.leak));
  let lo = Math.log(0.3), hi = Math.log(400);
  for (let i = 0; i < 13; i++) {
    const mid = (lo + hi) / 2;
    if (leaks(Math.exp(mid)) / nl > TARGET) hi = mid; else lo = mid;
  }
  // 계단 모양이라 경계 양쪽 중 목표에 가까운 쪽을 고르고, 계단 모서리에서 조금 떨어진(같은 비율이 유지되는) 값을 쓴다
  const rLo = leaks(Math.exp(lo)) / nl, rHi = leaks(Math.exp(hi)) / nl;
  const side = Math.abs(rLo - TARGET) <= Math.abs(rHi - TARGET) ? { r: rLo, e: Math.exp(lo), f: [0.9, 0.95, 0.98, 1] } : { r: rHi, e: Math.exp(hi), f: [1.1, 1.05, 1.02, 1] };
  let M = +side.e.toPrecision(4), ratio = side.r;
  for (const f of side.f) {
    const m = +(side.e * f).toPrecision(4), r = leaks(m) / nl;
    if (Math.abs(r - side.r) < 0.015) { M = m; ratio = r; break; }
  }
  return { M, ratio: +ratio.toFixed(3), noneLeak: +nl.toFixed(1), h: calHash(spec, sk) };
}

/* ---------- 전체 게임(run) 모드 ---------- */
function mkSubject(kind, id, g) { return { kind, id, g }; }
function applySubject(S, sj) {
  const pin = (o) => { Object.defineProperty(o, '_pin', { value: 1, enumerable: false }); };
  const rebase = () => { S.base._s = null; for (const w of S.slots) Core.dirty(w); Core.setState(S); };
  const w = S.slots[2];                       // 처음 주어진 블래스터
  if (sj.kind === 'wpart') { w.parts[0] = { id: sj.id, g: sj.g }; pin(w.parts[0]); Core.dirty(w); }
  else if (sj.kind === 'waug') { w.augs[0] = { id: sj.id, g: sj.g }; pin(w.augs[0]); Core.dirty(w); }
  else if (sj.kind === 'bpart') { S.base.parts[0] = { id: sj.id, g: sj.g }; pin(S.base.parts[0]); rebase(); }
  else if (sj.kind === 'baug') { S.base.augs[0] = { id: sj.id, g: sj.g }; pin(S.base.augs[0]); rebase(); }
}
function runFull(sj, seed) {
  restoreBal();
  Core.seed(seed);
  Core.newGame(520);
  const S = Core.S;
  if (sj && sj.kind !== 'none') applySubject(S, sj);
  const bot = makeBot(Core, seed);
  const total = Math.round(FULL_T / DT), marks = FULL_MARKS.map((m) => Math.round(m / DT) - 1);
  let acc = 0, leak = 0; const fp = [];
  for (let i = 0; i < total; i++) {
    Core.step(DT); acc += DT;
    if (acc >= 0.5) { acc = 0; bot.tick(); }
    S.over = false;                           // 기지는 죽지 않는다: 받은 피해만 센다
    leak += Math.max(0, S.maxHp - S.hp);
    S.hp = S.maxHp;
    if (marks.indexOf(i) >= 0) fp.push(S.slots.reduce((a, w) => a + (w ? Core.stats(w).dmg / Core.stats(w).cd : 0), 0));
  }
  const a = bot.acct;
  const res = {
    leak, fp, gold: S.gold + a.goldSpent - 80, shards: (S.shards || 0) + a.shardsSpent, gens: a.gens, kills: S.kills,
    log: a.log.slice(0, 40).join(','), digest: strHash(JSON.stringify([S.slots, S.base, S.inv, S.gold, S.shards, S.kills, S.bossKills, S.t])),
  };
  Core.seed(null);
  return res;
}

/* ---------- 다른 도구가 불러 쓸 때 (예: tools/skill_eq.js): 시뮬레이션 함수만 내보내고 여기서 멈춘다 ---------- */
if (require.main !== module) {
  module.exports = { SCEN, SC, TARGET, CS, WARM, DUR, T0, DT, NONE, init, restoreBal, runSim, runSeeds, calibrateTeam, teamKey, strHash, fnv, core: () => Core };
  return;
}

/* ---------- 워커 ---------- */
if (!isMainThread) {
  init();
  parentPort.on('message', (m) => {
    try {
      let res;
      if (m.kind === 'sims') res = runSeeds(m.spec, m.sk, m.N, m.M);
      else if (m.kind === 'cal') res = calibrateTeam(m.spec, m.sk);
      else if (m.kind === 'full') res = runFull(m.sj, m.seed);
      parentPort.postMessage({ id: m.id, res });
    } catch (e) { parentPort.postMessage({ id: m.id, err: String(e && e.stack || e) }); }
  });
  return;
}

/* ---------- 메인: 작업 실행기 ---------- */
init();
const WID = Core.WEAPON_IDS, AUGS = Core.AUGS, PARTS = Core.PARTS, GR = Core.GRADES;
const cache = new Map();                      // 키 -> 시드별 결과
let pool = null, errors = [];
const specKey = (spec, sk, M) => sk + '|' + M + '|' + JSON.stringify(spec);
function startPool() {
  const n = Math.max(1, os.cpus().length);
  pool = Array.from({ length: n }, () => new Worker(__filename));
}
function stopPool() { for (const w of pool) w.terminate(); }
// 일반 작업 실행기: jobs = [{key, msg}] -> Map(key -> 결과)
async function runJobs(jobs, label, out) {
  let next = 0, done = 0; const t0 = Date.now(); let id = 0;
  await Promise.all(pool.map((w) => new Promise((resolve) => {
    const feed = () => {
      if (next >= jobs.length) { w.removeAllListeners('message'); resolve(); return; }
      const j = jobs[next++];
      w.once('message', (m) => {
        if (m.err) { errors.push(j.key + ' -> ' + m.err); out.set(j.key, null); } else out.set(j.key, m.res);
        if (++done % 100 === 0) process.stderr.write(`[${label}] ${done}/${jobs.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
        feed();
      });
      w.postMessage(Object.assign({ id: id++ }, j.msg));
    };
    feed();
  })));
}
async function runAll(jobs, N, label) {         // jobs: [{spec, sk, M}]
  const uniq = new Map();
  for (const j of jobs) { const k = specKey(j.spec, j.sk, j.M) + '|' + N; if (!cache.has(k) && !uniq.has(k)) uniq.set(k, j); }
  const list = [...uniq.entries()].map(([k, j]) => ({ key: k, msg: { kind: 'sims', spec: j.spec, sk: j.sk, N, M: j.M } }));
  await runJobs(list, label, cache);
}
let CALS = {};                                 // "팀|시나리오" -> {M, ratio, h}
try { CALS = JSON.parse(fs.readFileSync(CAL_FILE, 'utf8')); } catch (e) { CALS = {}; }
const calKey = (spec, sk) => teamKey(spec) + '|' + sk;
const getM = (spec, sk) => { const c = CALS[calKey(spec, sk)]; return c ? c.M : NaN; };
async function ensureCal(specs, force) {      // 필요한 (팀, 시나리오) 보정이 없거나 낡았으면 새로 한다
  const need = [], seen = new Set();
  for (const spec of specs) for (const sk of SC) {
    const k = calKey(spec, sk); if (seen.has(k)) continue; seen.add(k);
    const c = CALS[k];
    if (force || !c || c.h !== calHash(spec, sk)) need.push({ key: k, msg: { kind: 'cal', spec: spec.map((o) => o && { t: o.t }), sk } });
  }
  if (!need.length) return 0;
  process.stderr.write(`보정 ${need.length}개 새로 계산\n`);
  const out = new Map();
  await runJobs(need, 'cal', out);
  for (const [k, v] of out) if (v) CALS[k] = v;
  fs.writeFileSync(CAL_FILE, JSON.stringify(CALS, null, 1));
  return need.length;
}
const get = (spec, sk, N, ref) => cache.get(specKey(spec, sk, getM(ref || spec, sk)) + '|' + N);

/* ---------- 비교 대상 만들기 ---------- */
let GRADES_MODE = 'all', ONLY = null;           // --grades ends|all, --only id,id
const gradesOf = (min, max = 3) => {   // max: 그 항목이 나오는 가장 높은 등급 (T8)
  if (/^[0-3]$/.test(GRADES_MODE)) return [Math.min(max, Math.max(min, +GRADES_MODE))];   // --grades 0..3: 그 등급만 (범위 밖이면 가까운 끝)
  const a = []; for (let g = min; g <= max; g++) a.push(g); return GRADES_MODE === 'ends' ? [...new Set([min, max])] : a;
};
const keep = (id) => !ONLY || ONLY.includes(id);
const five = (t) => Array.from({ length: 5 }, () => ({ t, p: [], a: [] }));
const withW = (x) => [0, 1, 2, 3, 4].map((i) => ({ t: i === 2 ? x : 'blaster', p: [], a: [] }));
function mkWeapons() {
  const ref = five('blaster');
  return { ref, subs: WID.filter(keep).map((x) => ({ id: x, name: Core.WEAPONS[x].name, grade: '-', spec: withW(x), ref })) };
}
const augRef = (T) => [0, 1, 2, 3, 4].map((i) => ({ t: i === 1 || i === 3 ? T : 'blaster', p: [], a: [] }));
function mkAugs() {
  const subs = [];
  for (const T of WID) {
    const mk = (a) => [0, 1, 2, 3, 4].map((i) => ({ t: i === 1 || i === 3 ? T : 'blaster', p: [], a: (i === 1 || i === 3) && a ? [a] : [] }));
    const ref = mk(null);
    for (const id of Core.AUG_POOL[T]) {
      if (!keep(id)) continue;
      const A = AUGS[id];
      for (const g of gradesOf(A.min, A.max != null ? A.max : 3)) subs.push({ id, name: A.name, w: T, grade: g, spec: mk([id, g]), ref });
    }
  }
  return subs;
}
// 스킬 줄 측정: 블래스터 다섯 자루(슬롯 2만 대상 무기, 0강 진화) 대 같은 팀의 스킬 없는 진화 무기. 보정(M)은 블래스터 다섯 자루의 것을 쓴다
const FULL_LINE = [5, 5, 1];
function mkSkills() {
  const subs = [], cal = five('blaster');
  for (const T of WID) {
    Core.SKILLS[T].forEach((line, l) => {
      const id = `${T}.${l}`;
      if (!keep(id) && !keep(T)) return;
      if (!T.match(/^(blaster|shotgun|laser|pulse)$/) && !ONLY) return;   // 2차분 무기는 이름을 직접 줄 때만
      const mk = (sk) => [0, 1, 2, 3, 4].map((i) => (i === 2 ? { t: T, p: [], a: [], evo: 1, sk } : { t: 'blaster', p: [], a: [] }));
      const none = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], full = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; full[l] = FULL_LINE.slice();
      subs.push({ id, name: line.name, w: T, grade: '-', spec: mk(full), ref: mk(none), cal });
    });
  }
  return subs;
}
const PART_TEAM = ['shotgun', 'blaster', 'laser', 'tesla', 'mortar'];
function mkParts() {
  const mk = (p) => PART_TEAM.map((t) => ({ t, p: p ? [p] : [], a: [] }));
  const ref = mk(null), subs = [];
  for (const id of Core.WEAPON_PART_IDS) {
    if (!keep(id)) continue;
    const P = PARTS[id];
    for (const g of gradesOf(P.min, P.max != null ? P.max : 3)) subs.push({ id, name: P.name, grade: g, spec: mk([id, g]), ref });
  }
  return subs;
}

/* ---------- 통계 ---------- */
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / (a.length - 1)); };
const TCRIT = { 1: 12.7, 2: 4.3, 3: 3.18, 4: 2.78, 5: 2.57, 6: 2.45, 7: 2.36, 8: 2.31, 9: 2.26 };
const tcrit = (df) => TCRIT[df] || (df >= 10 ? 2.1 : 99);
// 같은 시드끼리 짝지어 비교한다 (적 등장이 같으므로 잡음이 크게 줄어든다)
function compare(sub, sk, N) {
  const a = get(sub.spec, sk, N, sub.cal || sub.ref), r = get(sub.ref, sk, N, sub.cal);
  if (!a || !r) return null;
  const rl = mean(r.map((x) => x.leak)), rd = mean(r.map((x) => x.dealt));
  if (!(rl > 0)) return { na: true, leak: NaN, dmg: NaN, sd: NaN, se: NaN, sig: false };   // 기준팀이 이미 피해 0이면 변화율을 구할 수 없다
  const dl = a.map((x, i) => (x.leak - r[i].leak) / rl * 100);
  const dd = a.map((x, i) => (x.dealt - r[i].dealt) / rd * 100);
  const m = mean(dl), s = sd(dl), se = s / Math.sqrt(N);
  return {
    leak: m, dmg: mean(dd), sd: s, se, sig: Math.abs(m) > tcrit(N - 1) * se && Math.abs(m) > 0.0,
    refSd: sd(r.map((x) => x.leak)) / rl * 100, refLeak: rl,
    wdealt: mean(a.map((x) => x.wd.reduce((p, q) => p + q, 0))),
  };
}
const f1 = (x) => (x >= 0 ? '+' : '') + x.toFixed(1);
const pad = (s, n) => { s = String(s); const w = [...s].reduce((a, c) => a + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0); return s + ' '.repeat(Math.max(0, n - w)); };

function table(title, subs, N, withW_) {
  const L = [title, ''];
  const hdr = pad('대상', withW_ ? 34 : 28) + SC.map((k) => pad(SCEN[k].name + '(' + k + ')', 22)).join('') + '평균';
  L.push(hdr, '-'.repeat(hdr.length));
  const R = [];
  for (const s of subs) {
    const cs = SC.map((k) => compare(s, k, N));
    R.push({ s, cs });
    const lab = (withW_ ? pad(s.w, 8) : '') + pad(`${s.id} ${s.name} [${s.grade === '-' ? '-' : GR[s.grade]}]`, withW_ ? 26 : 28);
    const ok = cs.filter((c) => c && !c.na);
    L.push(lab + cs.map((c) => pad(c ? (c.na ? 'n/a (기준 leak 0)' : `${f1(c.leak)} / ${f1(c.dmg)}${c.sig ? '' : ' ~'}`) : 'ERR', 22)).join('') + (ok.length ? f1(mean(ok.map((c) => c.leak))) : 'n/a'));
  }
  L.push('', '(셀: leak 변화% / 총 dmg 변화%. 음수 leak이 더 좋음. "~" = leak 변화가 잡음 범위(짝지은 t검정 95%) 안. 마지막 열 = 5개 시나리오 평균 leak 변화%)', '');
  return { text: L.join('\n'), R };
}
const lbl = (s) => `${s.w ? s.w + ':' : ''}${s.id} ${s.name} [${s.grade === '-' ? '-' : GR[s.grade]}]`;

function summary(title, R) {
  const L = [title, ''];
  L.push('[대상별 최적/최악 시나리오 (leak 변화 기준)]');
  for (const { s, cs } of R) {
    const v = cs.map((c, i) => ({ k: SC[i], c })).filter((x) => x.c && !x.c.na);
    if (!v.length) continue;
    const b = v.reduce((p, q) => (q.c.leak < p.c.leak ? q : p)), w = v.reduce((p, q) => (q.c.leak > p.c.leak ? q : p));
    L.push(`  ${lbl(s)}: 최적 ${b.k} ${f1(b.c.leak)}%, 최악 ${w.k} ${f1(w.c.leak)}%`);
  }
  const noise = R.filter(({ cs }) => cs.every((c) => c && (c.na || !c.sig)) && cs.some((c) => c && !c.na));
  L.push('', `[모든 시나리오에서 잡음 범위 안인 항목: ${noise.length}개]`);
  for (const { s } of noise) L.push('  ' + lbl(s));
  const g3 = R.filter(({ s }) => s.grade === 3 && s.id).map(({ s, cs }) => ({ s, m: mean(cs.filter((c) => c && !c.na).map((c) => c.leak)), cs })).filter((x) => isFinite(x.m));
  g3.sort((a, b) => a.m - b.m);
  const line = ({ s, m, cs }) => `  ${pad(lbl(s), 40)} 평균 ${f1(m)}%  (` + cs.map((c, i) => `${SC[i]} ${c ? (c.na ? 'n/a' : f1(c.leak)) : '?'}`).join(', ') + ')';
  if (R.some(({ s }) => s.grade === 3) && g3.length > 1) {
    L.push('', '[등급 3(전설) 기준 가장 강한 10개 (평균 leak 변화가 가장 낮음)]', ...g3.slice(0, 10).map(line));
    L.push('', '[등급 3(전설) 기준 가장 약한 10개 (평균 leak 변화가 가장 높음)]', ...g3.slice(-10).reverse().map(line));
  }
  L.push('');
  return L.join('\n');
}

/* ---------- run 모드 표 ---------- */
const RUN_MARK = '=== 전체 게임(run) 모드';
function runSubjects() {
  const subs = [];
  const add = (kind, id, min, name, label) => { for (const g of gradesOf(min)) subs.push({ kind, id, g, name, label }); };
  for (const id of Core.BASE_PART_IDS) if (keep(id)) add('bpart', id, PARTS[id].min, PARTS[id].name, '기지 파츠');
  for (const id of Core.AUG_POOL.base) if (keep(id)) add('baug', id, AUGS[id].min, AUGS[id].name, '기지 증강');
  if (keep('gold')) add('wpart', 'gold', PARTS.gold.min, PARTS.gold.name, '무기 파츠');
  if (keep('dmg')) add('wpart', 'dmg', PARTS.dmg.min, PARTS.dmg.name, '무기 파츠(기준)');
  if (keep('a_dmg')) add('waug', 'a_dmg', AUGS.a_dmg.min, AUGS.a_dmg.name, '무기 증강(기준)');
  return subs;
}
async function runMode(N, tag) {
  const subs = runSubjects();
  const base = { kind: 'none' };
  const jobs = [], out = new Map();
  const key = (sj, seed) => (sj.kind === 'none' ? 'none' : sj.kind + ':' + sj.id + ':' + sj.g) + '#' + seed;
  for (let seed = 1; seed <= N; seed++) { jobs.push({ key: key(base, seed), msg: { kind: 'full', sj: base, seed } }); for (const sj of subs) jobs.push({ key: key(sj, seed), msg: { kind: 'full', sj, seed } }); }
  // 결정성 검사용 재실행: 기준(시드 1)과 대표 대상(시드 1, 2)을 한 번 더
  const chk = [{ sj: base, seed: 1 }, { sj: subs[0], seed: 1 }, { sj: subs[subs.length - 1], seed: 2 }];
  chk.forEach((c, i) => jobs.push({ key: 'rerun' + i + ':' + key(c.sj, c.seed), msg: { kind: 'full', sj: c.sj, seed: c.seed } }));
  // 작업 순서를 섞어 두 워커에 고르게 나눈다(결과는 순서와 무관해야 한다)
  jobs.sort((a, b) => strHash(a.key) - strHash(b.key));
  const t0 = Date.now();
  await runJobs(jobs, 'run', out);
  const mins = (Date.now() - t0) / 60000;
  const R = (sj) => Array.from({ length: N }, (_, i) => out.get(key(sj, i + 1)));
  const B = R(base);
  const bm = (f) => mean(B.map(f));
  const L = [RUN_MARK + ': 시드 1..' + N + ', 15분 전체 게임, 표준 봇(tools/bot.js), 소요 ' + mins.toFixed(1) + '분 ===', ''];
  L.push('기준(대상 없음) 평균: 총 leak ' + bm((r) => r.leak).toFixed(1) + ', 화력 5/10/15분 ' + [0, 1, 2].map((i) => bm((r) => r.fp[i]).toFixed(1)).join(' / ') + ', 획득 조각 ' + bm((r) => r.shards).toFixed(0) + ', 획득 재화 ' + bm((r) => r.gold).toFixed(0) + ', 생성 횟수 ' + bm((r) => r.gens).toFixed(0));
  L.push('기준 시드별 leak: ' + B.map((r) => r.leak.toFixed(0)).join(', '));
  // 결정성
  const rr = chk.map((c, i) => ({ a: out.get(key(c.sj, c.seed)), b: out.get('rerun' + i + ':' + key(c.sj, c.seed)) }));
  const same = rr.filter((x) => x.a && x.b && JSON.stringify(x.a) === JSON.stringify(x.b)).length;
  L.push(`[결정성] 같은 (대상, 시드)를 두 번 돌려 결과(leak, 화력, 재화, 조각, 생성 로그, 최종 상태 해시)가 완전히 같은지: ${same}/${rr.length}개 일치`);
  // 같은 시드에서 대상 유무와 상관없이 앞쪽 생성 결과가 같은 비율 (전리품 난수열 rndG 분리 검사)
  let tot = 0, eq = 0;
  for (const sj of subs) for (let i = 0; i < N; i++) {
    const a = (out.get(key(sj, i + 1)) || {}).log, b = B[i] && B[i].log; if (!a || !b) continue;
    const x = a.split(','), y = b.split(',');
    for (let k = 0; k < Math.min(x.length, y.length, 20); k++) { tot++; if (x[k] === y[k]) eq++; }
  }
  L.push(`[전리품 난수 분리] 같은 시드에서 대상을 줬을 때와 안 줬을 때 앞 20번 생성 결과가 같은 비율: ${(eq / Math.max(1, tot) * 100).toFixed(1)}% (${eq}/${tot})`);
  const bad = [...out.values()].filter((v) => v == null).length;
  L.push(`[오류] ${errors.length}건`, ...errors.slice(0, 5), '');
  // 표
  const hdr = pad('대상', 30) + pad('leak%', 12) + pad('화력5분%', 11) + pad('화력10분%', 11) + pad('화력15분%', 11) + pad('조각%', 10) + pad('재화%', 10);
  L.push(hdr, '-'.repeat(hdr.length));
  const rows = [];
  const cmp = (A, f) => {   // 시드별로 짝지은 변화%, 평균, 유의 여부
    const rl = bm(f); if (!(rl > 0)) return { m: NaN, sig: false, na: true };
    const d = A.map((r, i) => (f(r) - f(B[i])) / rl * 100);
    const m = mean(d), se = sd(d) / Math.sqrt(N);
    return { m, sig: Math.abs(m) > tcrit(N - 1) * se, se };
  };
  for (const sj of subs) {
    const A = R(sj);
    const c = {
      leak: cmp(A, (r) => r.leak), f5: cmp(A, (r) => r.fp[0]), f10: cmp(A, (r) => r.fp[1]), f15: cmp(A, (r) => r.fp[2]),
      sh: cmp(A, (r) => r.shards), go: cmp(A, (r) => r.gold),
    };
    rows.push({ sj, c });
    const cell = (x) => pad(x.na ? 'n/a' : f1(x.m) + (x.sig ? '' : '~'), x === c.leak ? 12 : x === c.sh || x === c.go ? 10 : 11);
    L.push(pad(`${sj.label}: ${sj.id} ${sj.name} [${GR[sj.g]}]`, 30) + cell(c.leak) + cell(c.f5) + cell(c.f10) + cell(c.f15) + cell(c.sh) + cell(c.go));
  }
  L.push('', '(셀: 같은 시드의 대상 없는 게임 대비 변화%. "~" = 잡음 범위 안(짝지은 t검정 95%). leak은 음수가 좋고 나머지는 양수가 좋다. 기지는 죽지 않으며 hp를 매 스텝 되돌리므로 회복/체력 계열은 leak에 잡히지 않는다.)', '');
  const text = L.join('\n');
  // 리포트 끝에 덧붙인다 (예전 run 섹션은 대체)
  const rp = path.join(__dirname, tag ? `bench_report_${tag}.txt` : 'bench_report.txt');
  let old = ''; try { old = fs.readFileSync(rp, 'utf8'); } catch (e) { old = ''; }
  const i = old.indexOf(RUN_MARK); if (i >= 0) old = old.slice(0, i);
  fs.writeFileSync(rp, (old ? old.replace(/\s*$/, '\n\n') : '') + text);
  fs.writeFileSync(path.join(__dirname, tag ? `bench_run_${tag}.json` : 'bench_run.json'), JSON.stringify({ N, base: B.map((r) => ({ leak: r.leak, fp: r.fp, gold: r.gold, shards: r.shards })), rows: rows.map(({ sj, c }) => ({ kind: sj.kind, id: sj.id, g: sj.g, leak: c.leak.m, f5: c.f5.m, f10: c.f10.m, f15: c.f15.m, sh: c.sh.m, go: c.go.m, leakSig: c.leak.sig, f15Sig: c.f15.sig, se: { leak: c.leak.se, f5: c.f5.se, f10: c.f10.se, f15: c.f15.se, sh: c.sh.se, go: c.go.se } })) }));
  console.log('완료(run):', rp, '일치', same + '/' + rr.length, '오류', errors.length, '소요', mins.toFixed(1) + '분');
}

/* ---------- 메인 ---------- */
(async function main() {
  const args = process.argv.slice(2);
  const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
  const flagVals = new Set(['--runs', '--only', '--grades', '--tag'].map((f) => val(f)).filter(Boolean));
  const mode = args.find((a) => !a.startsWith('--') && !flagVals.has(a) && isNaN(+a)) || 'all';
  const N = val('--runs') ? +val('--runs') : (mode === 'run' ? 8 : 5);
  const tag = val('--tag');
  if (val('--only')) ONLY = val('--only').split(',');
  GRADES_MODE = val('--grades') || (mode === 'run' ? 'ends' : 'all');
  startPool();
  if (mode === 'run') { await runMode(N, tag); stopPool(); process.exit(0); }
  const want = (m) => mode === 'all' || mode === m || mode === 'calibrate';   // skills 모드는 따로 (all에 넣지 않는다)
  const sets = {};
  if (want('weapons')) sets.weapons = mkWeapons();
  if (want('augs')) sets.augs = mkAugs();
  if (want('parts')) sets.parts = mkParts();
  if (mode === 'skills') sets.skills = mkSkills();
  // 기준팀 목록과 보정
  const refSpecs = [five('blaster')];
  if (sets.weapons) refSpecs.push(sets.weapons.ref);
  if (sets.augs) for (const s of sets.augs) refSpecs.push(s.ref);
  if (sets.parts) refSpecs.push(sets.parts[0] ? sets.parts[0].ref : PART_TEAM.map((t) => ({ t })));
  if (sets.skills) refSpecs.push(five('blaster'));
  const uniqSpec = new Map(); for (const sp of refSpecs) uniqSpec.set(teamKey(sp), sp);
  const ncal = await ensureCal([...uniqSpec.values()], args.includes('--recal'));
  if (mode === 'calibrate') {
    for (const [k, sp] of uniqSpec) console.log(pad(k, 40), SC.map((sk) => { const c = CALS[calKey(sp, sk)]; return `${sk} M=${c.M} (${c.ratio})`; }).join('  '));
    stopPool(); process.exit(0);
  }
  const jobs = [];
  const add = (s) => { for (const sk of SC) { jobs.push({ spec: s.spec, sk, M: getM(s.cal || s.ref, sk) }); jobs.push({ spec: s.ref, sk, M: getM(s.cal || s.ref, sk) }); } };
  for (const sk of SC) { jobs.push({ spec: NONE, sk, M: 1 }); }
  for (const sp of uniqSpec.values()) for (const sk of SC) { jobs.push({ spec: sp, sk, M: getM(sp, sk) }); }
  if (sets.weapons) sets.weapons.subs.forEach(add);
  if (sets.augs) sets.augs.forEach(add);
  if (sets.parts) sets.parts.forEach(add);
  if (sets.skills) sets.skills.forEach(add);
  const t0 = Date.now();
  await runAll(jobs, N, mode);
  stopPool();
  const none = NONE, b5 = five('blaster');
  const getNone = (sk) => cache.get(specKey(NONE, sk, 1) + '|' + N);

  // 결정성 검사: 같은 (시나리오, 시드)이면 구성이 달라도 등장 해시가 같아야 한다
  const hs = {};
  for (const [k, res] of cache) {
    if (!res) continue;
    const sk = k.split('|')[0];
    res.forEach((r, i) => { const key = sk + '#' + (i + 1); (hs[key] = hs[key] || new Set()).add(r.hash + ':' + r.ns); });
  }
  const bad = Object.entries(hs).filter(([, v]) => v.size > 1).map(([k]) => k);

  const out = [];
  out.push('도형 디펜스 밸런스 벤치 리포트', `생성: ${new Date().toISOString()}  (모드 ${mode}, 시드 1..${N}, 등급 ${GRADES_MODE}${ONLY ? ', 대상 ' + ONLY.join(',') : ''}, 소요 ${((Date.now() - t0) / 60000).toFixed(1)}분, 새 보정 ${ncal}개)`, '');
  out.push('[설정] 시나리오마다 워밍업 ' + WARM + '초 + 측정 ' + DUR + '초, S.t 시작 ' + T0 + ', 기지는 죽지 않음(피해만 기록). 보스전은 보스 체력 배수 1.0의 거대체.');
  out.push('기준팀마다 보정한 적 체력 배수 M (기준팀이 무기 없을 때 피해의 약 ' + (TARGET * 100) + '%를 받도록. 괄호 = 보정 시드 1..' + CS + '에서 얻은 비율 / 이번 측정(시드 1..' + N + ')의 비율):');
  for (const [k, sp] of uniqSpec) {
    out.push('  ' + pad(k, 40) + SC.map((sk) => {
      const a = get(sp, sk, N), z = getNone(sk);
      const rt = a && z ? mean(a.map((x) => x.leak)) / mean(z.map((x) => x.leak)) : NaN;
      return `${sk} M=${CALS[calKey(sp, sk)].M} (${CALS[calKey(sp, sk)].ratio}/${rt.toFixed(2)})`;
    }).join('  '));
  }
  out.push('', `[결정성] 같은 시나리오/시드에서 구성이 달라도 적 등장 순서 해시(종류, 레인, 위치, 시각)가 동일한지 검사: ${Object.keys(hs).length}개 그룹 중 불일치 ${bad.length}개 ${bad.length ? bad.join(',') : ''}`);
  out.push(`[오류] ${errors.length}건`, ...errors.slice(0, 10), '');
  const allR = {};
  if (sets.weapons) {
    const t = table('=== 무기 비교: [블래스터,블래스터,X,블래스터,블래스터] vs 블래스터 5자루 ===', sets.weapons.subs, N, false);
    out.push(t.text); allR.weapons = t.R;
    const rk = ['[시나리오별 무기 순위 (leak 변화 낮은 순)]'];
    SC.forEach((sk, i) => {
      const v = t.R.map(({ s, cs }) => ({ s, c: cs[i] })).filter((x) => x.c).sort((a, b) => a.c.leak - b.c.leak);
      rk.push(`  ${pad(sk, 6)} ` + v.map((x) => `${x.s.id}(${f1(x.c.leak)})`).join(' > '));
    });
    out.push(...rk, '');
    out.push('[참고: X 자신이 가한 피해(w.dealt)가 팀 전체 피해에서 차지하는 비율 / 시나리오별 평균 kills]');
    for (const s of sets.weapons.subs) {
      out.push('  ' + pad(s.id, 9) + SC.map((sk) => {
        const a = get(s.spec, sk, N, s.ref); if (!a) return pad('ERR', 22);
        const share = mean(a.map((x) => x.wd[2] / Math.max(1, x.dealt))) * 100;
        return pad(`${sk} ${share.toFixed(0)}% k${mean(a.map((x) => x.kills)).toFixed(0)}`, 22);
      }).join(''));
    }
    out.push('');
  }
  if (sets.augs || sets.parts) {
    const refs = [];
    if (sets.augs) { const seen = new Set(); for (const s of sets.augs) if (!seen.has(s.w)) { seen.add(s.w); refs.push(['증강 기준팀 ' + s.w + '(슬롯1,3)', s.ref]); } }
    if (sets.parts && sets.parts[0]) refs.push(['파츠 기준팀 [shotgun,blaster,laser,tesla,mortar]', sets.parts[0].ref]);
    out.push('[기준팀 leak: 평균 (무기 없음 대비 비율). 0에 가까울수록 이 시나리오에서 변화를 측정하기 어렵다(포화)]');
    for (const [nm, ref] of refs) out.push('  ' + pad(nm, 44) + SC.map((sk) => {
      const a = get(ref, sk, N), z = getNone(sk);
      return a && z ? pad(`${sk} ${mean(a.map((x) => x.leak)).toFixed(0)} (${(mean(a.map((x) => x.leak)) / mean(z.map((x) => x.leak))).toFixed(2)})`, 22) : '?';
    }).join(''));
    out.push('');
  }
  if (sets.augs) {
    const t = table('=== 증강 비교: 해당 무기 2자루(슬롯 1,3)에 증강, 나머지 블래스터. 기준 = 증강 없는 같은 팀 ===', sets.augs, N, true);
    out.push(t.text); allR.augs = t.R;
  }
  if (sets.skills) {
    const t = table('=== 스킬 줄 측정 (줄 완성 11점): 블래스터 다섯 자루, 슬롯 2만 대상 무기(0강 진화). 기준 = 스킬 없는 같은 팀 ===', sets.skills, N, true);
    out.push(t.text); allR.skills = t.R;
    out.push('[목표 평균 leak 변화 -30% ~ -60%]');
    for (const { s, cs } of t.R) { const ok = cs.filter((c) => c && !c.na), m = ok.length ? mean(ok.map((c) => c.leak)) : NaN; out.push(`  ${pad(s.id + ' ' + s.name, 22)} ${f1(m)}%  ${m <= -30 && m >= -60 ? '범위 안' : m > -30 ? '약함' : '강함'}   ` + SC.map((k, i) => `${k} ${cs[i] && !cs[i].na ? f1(cs[i].leak) : 'n/a'}`).join('  ')); }
    out.push('');
  }
  if (sets.parts) {
    const t = table('=== 파츠 비교 (무기 파츠): [산탄포,블래스터,레이저,전격기,박격포] 전원에 1개씩. 기준 = 파츠 없음 ===', sets.parts, N, false);
    out.push(t.text); allR.parts = t.R;
  }
  const cc = [];
  const CCI = ['b_frost', 's_knock', 'p_knock', 'p_frost', 'p_stun', 't_stun', 't_slow', 'l_freeze', 'chill'];
  for (const grp of ['augs', 'parts']) for (const { s, cs } of allR[grp] || []) if (CCI.includes(s.id)) cc.push({ s, cs });
  if (cc.length) {
    out.push('=== 군중 제어 효과 (leak 변화%) ===', '');
    for (const { s, cs } of cc) out.push('  ' + pad(lbl(s), 34) + SC.map((k, i) => `${k} ${cs[i] ? (cs[i].na ? 'n/a' : f1(cs[i].leak) + (cs[i].sig ? '' : '~')) : '?'}`).join('  '));
    out.push('');
  }
  out.push('=== 요약 ===', '');
  if (allR.weapons) out.push(summary('-- 무기 --', allR.weapons));
  if (allR.augs) out.push(summary('-- 증강 --', allR.augs));
  if (allR.parts) out.push(summary('-- 파츠 --', allR.parts));
  if (allR.skills) out.push(summary('-- 스킬 줄 --', allR.skills));
  // 잡음 수준
  const sds = SC.map((sk, i) => {
    const v = []; for (const g of Object.values(allR)) for (const { cs } of g) if (cs[i] && !cs[i].na) v.push(cs[i].sd);
    v.sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : NaN;
  });
  out.push('-- 잡음 수준 --', '짝지은 시드별 leak 변화%의 표준편차(중앙값): ' + SC.map((k, i) => `${k} ${sds[i].toFixed(1)}`).join(', '), `(평균의 표준오차는 이 값 / sqrt(${N}))`, '');
  // 기계가 읽는 요약 (튜닝 판정용)
  const sum = {};
  for (const [g, rows] of Object.entries(allR)) sum[g] = rows.map(({ s, cs }) => {
    const ok = cs.filter((c) => c && !c.na);
    return { id: s.id, w: s.w || null, g: s.grade, cs: cs.map((c) => (c && !c.na ? +c.leak.toFixed(2) : null)), sig: cs.map((c) => !!(c && c.sig)), dmg: cs.map((c) => (c && !c.na ? +c.dmg.toFixed(2) : null)),
      mean: ok.length ? +mean(ok.map((c) => c.leak)).toFixed(2) : null, se: ok.length ? +(Math.sqrt(ok.reduce((a, c) => a + c.se * c.se, 0)) / ok.length).toFixed(2) : null };
  });
  const sfx = tag ? '_' + tag : '';
  fs.writeFileSync(path.join(__dirname, `bench_summary${sfx}.json`), JSON.stringify({ N, mode, sum }));
  const rp = path.join(__dirname, `bench_report${sfx}.txt`);
  let runSec = ''; try { const old = fs.readFileSync(rp, 'utf8'); const i = old.indexOf(RUN_MARK); if (i >= 0) runSec = old.slice(i); } catch (e) { }
  fs.writeFileSync(rp, out.join('\n') + (runSec ? '\n' + runSec : ''));
  if (!tag) fs.writeFileSync(path.join(__dirname, 'bench_raw.json'), JSON.stringify([...cache.entries()]));
  console.log('완료:', rp, '불일치', bad.length, '오류', errors.length);
  process.exit(0);
})();

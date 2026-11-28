'use strict';
/* 시드 고정 생존 측정 (표준 봇이 기지가 죽을 때까지 전체 게임을 플레이)
   사용: node tools/surv.js <core.js> <K> <시드수> [옵션]
     K            BAL.hpMul 의 시간 상수 BAL.hpK (적 체력 식 pow(1+pow(t/K,3.1),0.9)*exp(0.0012t+(t/3400)^2). 식은 core.js 에만 있다)
   옵션
     --noevo      봇이 진화하지 않는다 (진화 도입 전의 봇과 같은 행동). 기본은 100강이 되면 진화하고 스킬을 바로 찍는다
     --runner C   BAL.runnerTau(달리는 적 등장 비율 증가 시간 상수) 를 C 초로 (가정 실험)
     --pair 목록  짝지은 생존 비교. 항목 = part:ID:등급 (기지 파츠 칸 0) 또는 aug:ID:등급 (기지 증강 칸 0), 쉼표로 여러 개.
                  시작할 때 공짜로 주고(봇이 바꾸지 않게 고정) 같은 시드의 대상 없는 게임과 비교한다. 결과 = T_with/T_without 기하평균
     --pact 목록  거래 확인. 항목 = PACTS id (쉼표로 여러 개, all = 전부). 대상 없는 게임이 10분(600초)을 넘긴 시드만 골라,
                  600초에 Core.choosePact 로 거래를 적용하고 이후 생존 시간 (T-600)의 비율을 기하평균으로 낸다
                  항목 뒤에 @값[/둘째값] 을 붙이면 그 등급의 수치를 임시로 바꿔 잰다 (예: part:armor:2@30/5, aug:h_repair:2@0.4/8)
     --pactT 초   거래를 적용하는 시각 (기본 600). 봇이 600초 전에 대부분 죽으면 앞당긴다 (T15c 는 180)
     --nobase     대상 없는 일반 게임(첫 줄)을 건너뛴다 (--pair/--pact 만 볼 때)
     --cache 파일 짝지은 기준(자리표시 항목) 결과를 저장/재사용한다. 키 = core.js 내용 해시, K, 시드 수, 종류
                  거래 이름 뒤에 @키=값;키=값 을 붙이면 Core.PACT 의 수치를 임시로 바꿔 잰다 (예: glass@glassDmg=1.2;glassHp=0.6)
     --eval 코드  core를 불러온 직후 실행할 JS (변수 Core). 값 가정 실험용
     --json 파일  시드별 결과를 저장
   시드 순서와 결과는 결정적이다. 작업은 CPU 수만큼 나눠 병렬로 돈다. */
const { Worker, isMainThread, parentPort } = require('worker_threads');
const path = require('path');
const os = require('os');
const fs = require('fs');
const argv = process.argv.slice(2);
const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const CORE = path.resolve(pos[0] || path.join(__dirname, '..', 'src', 'core.js'));
const K = +pos[1] || 300, N = +pos[2] || 24, DT = 1 / 30, CAP = 3600, PACT_T = +opt('--pactT') || 600;
const RUNNER = opt('--runner'), EVAL = opt('--eval'), NOEVO = argv.includes('--noevo');
const MAP = (id, kind) => (kind === 'part' ? Core.PARTS : Core.AUGS)[id];

let Core = null, makeBot = null;
function init() {
  Core = require(CORE);
  ({ makeBot } = require(path.join(__dirname, 'bot.js')));
  Core.BAL.hpK = K;   // 식은 core.js 의 BAL.hpMul 한 곳에만 있다. 여기서는 시간 상수만 바꾼다
  if (RUNNER != null) Core.BAL.runnerTau = +RUNNER;
  if (EVAL) new Function('Core', EVAL)(Core);
}
function pin(o) { Object.defineProperty(o, '_pin', { value: 1, enumerable: false }); }
// 효과가 없는 자리표시 항목: 기준 게임에도 같은 칸을 같은 방식으로 채워, 봇의 행동(칸 점유)이 대상 유무와 같게 한다.
// 이름이 열거 목록(BASE_PART_IDS, AUG_POOL)에 들지 않으므로 전리품으로 나오지 않는다.
function addNone() {
  if (Core.PARTS.__none) return;
  Core.PARTS.__none = { base: true, name: '-', min: 0, v: [0, 0, 0, 0], ap() { }, d: () => '' };
  Core.AUGS.__none = { name: '-', min: 0, for: 'none', v: [0, 0, 0, 0], ap() { }, d: () => '' };
}
function grant(S, spec) {   // spec 'none:part' | 'none:aug' | 'part:id:g' | 'aug:id:g'
  const [kind, id, g] = spec.split(':');
  addNone();
  const o = kind === 'none' ? { id: '__none', g: 0 } : { id, g: +g };
  if (kind === 'part' || (kind === 'none' && id === 'part')) S.base.parts[0] = o; else S.base.augs[0] = o;
  pin(o);
  S.base._s = null; for (const w of S.slots) Core.dirty(w); Core.setState(S);
}
// spec: {grant?: 'part:id:g', pact?: id}. 반환: {T, mx}
function play(spec, seed) {
  let restore = null;
  if (spec.pactOv) {
    const old = {}; for (const k in spec.pactOv) { old[k] = Core.PACT[k]; Core.PACT[k] = spec.pactOv[k]; }
    restore = () => { for (const k in old) Core.PACT[k] = old[k]; };
  }
  if (spec.ov) {   // 수치 임시 변경 [v, w]
    const [kind, id, g] = spec.grant.split(':'), D = MAP(id, kind), ov = spec.ov;
    const old = [D.v[+g], D.w ? D.w[+g] : undefined];
    const hasW = ov[1] != null && D.w;
    D.v[+g] = ov[0]; if (hasW) D.w[+g] = ov[1];
    restore = () => { D.v[+g] = old[0]; if (hasW) D.w[+g] = old[1]; };
  }
  try { return play0(spec, seed); } finally { if (restore) restore(); }
}
function play0(spec, seed) {
  Core.seed(seed); Core.newGame(520);
  const S = Core.S, bot = makeBot(Core, seed, { noevo: NOEVO });
  if (spec.grant) grant(S, spec.grant);
  let acc = 0, applied = !spec.pact;
  while (!S.over && S.t < CAP) {
    if (!applied && S.t >= PACT_T) { applied = true; S.pendingPact = [spec.pact]; Core.choosePact(0); }
    Core.step(DT); acc += DT;
    if (acc >= 0.5) {
      acc = 0; bot.tick();
      if (S.pendingAug) {   // 현자의 눈(건너뛰기 불가)에서 봇이 칸 교체를 못 하면 게임이 멈춘다: 사람처럼 첫 선택지를 고르고, 칸이 차면 가장 낮은 증강 칸을 교체한다
        const pa = S.pendingAug, t = pa.base ? S.base : S.slots[pa.slot];
        if (!t) Core.skipAug(true);
        else { const r = Core.chooseAug(0); if (r.need) { let lo = 0; t.augs.forEach((a, i) => { if (a && (!t.augs[lo] || a.g < t.augs[lo].g)) lo = i; }); Core.chooseAug(0, lo); } }
      }
    }
  }
  const mx = Math.max(...S.slots.map((w) => (w ? Core.effLv(w) : 0)));   // 진화한 무기는 100 + 단계
  const r = { T: S.t, mx };
  Core.seed(null);
  return r;
}

if (!isMainThread) {
  init();
  parentPort.on('message', (m) => {
    try { parentPort.postMessage({ id: m.id, res: play(m.spec, m.seed) }); } catch (e) { parentPort.postMessage({ id: m.id, err: String(e && e.stack || e) }); }
  });
  return;
}

async function main() {
  init();
  const n = Math.max(1, os.cpus().length);
  const pool = Array.from({ length: n }, () => new Worker(__filename, { argv: process.argv.slice(2), execArgv: [] }));
  let uid = 0;
  async function runJobs(jobs) {   // jobs: [{spec, seed}] -> 같은 순서의 결과
    const out = new Array(jobs.length); let next = 0;
    await Promise.all(pool.map((w) => new Promise((resolve) => {
      const feed = () => {
        if (next >= jobs.length) { resolve(); return; }
        const i = next++, id = uid++;
        const h = (m) => { if (m.id !== id) return; w.off('message', h); if (m.err) { console.error(m.err); process.exit(1); } out[i] = m.res; feed(); };
        w.on('message', h);
        w.postMessage({ id, spec: jobs[i].spec, seed: jobs[i].seed });
      };
      feed();
    })));
    return out;
  }
  const seeds = Array.from({ length: N }, (_, i) => i + 1);
  const gm = (a) => Math.exp(a.reduce((x, y) => x + Math.log(y), 0) / a.length);
  const res = {};
  let base = null;
  if (!argv.includes('--nobase') || opt('--pact')) {
    base = await runJobs(seeds.map((seed) => ({ spec: {}, seed })));
    const T = base.map((r) => r.T / 60), srt = T.slice().sort((a, b) => a - b);
    const q = (p) => srt[Math.floor(p * (N - 1))].toFixed(1);
    const early = T.filter((t) => t < 5).length;
    console.log(path.basename(CORE), 'K=' + K, RUNNER != null ? 'runnerTau=' + RUNNER : '', 'mean', (T.reduce((a, b) => a + b) / N).toFixed(1), 'q25/med/q75', q(.25), q(.5), q(.75), 'min', q(0), 'max', q(1), '+100:', base.filter((r) => r.mx >= 100).length + '/' + N, '<5:00:', early + '/' + N);
    res.base = T;
  }
  const pairs = opt('--pair');
  if (pairs) {
    res.pair = {};
    const nb = {};   // 기준: 효과 없는 자리표시 항목을 같은 칸(기지 파츠 칸 0 / 기지 증강 칸 0)에 준 게임
    const cf = opt('--cache');
    let cache = {}; if (cf) { try { cache = JSON.parse(fs.readFileSync(cf, 'utf8')); } catch (e) { cache = {}; } }
    const ch = require('crypto').createHash('sha1').update(fs.readFileSync(CORE)).digest('hex').slice(0, 10);
    // 기준: 기지 파츠는 효과 없는 자리표시 항목. 기지 증강은 같은 증강을 수치 0으로 쥐고 있는 게임
    // (증강 선택지는 이미 가진 같은 증강을 빼고 나오므로, 자리표시로는 선택지가 달라져 +13% 안팎의 치우침이 생긴다)
    const bkey = (sp) => { const [k, id, g] = sp.split('@')[0].split(':'); return k === 'part' ? 'part' : sp.split('@')[0]; };
    for (const key of new Set(pairs.split(',').map(bkey))) {
      const ck = [ch, K, N, RUNNER, key].join('|');
      const spec = key === 'part' ? { grant: 'none:part' } : { grant: key, ov: [0, 0] };
      if (cache[ck]) nb[key] = cache[ck];
      else { nb[key] = await runJobs(seeds.map((seed) => ({ spec, seed }))); if (cf) { cache[ck] = nb[key]; fs.writeFileSync(cf, JSON.stringify(cache)); } }
      const tt = nb[key].map((r) => r.T / 60);
      console.log('pair baseline (' + (key === 'part' ? 'part slot placeholder' : key + ' at zero strength') + '): mean', (tt.reduce((a, b) => a + b) / N).toFixed(1), '<5:00:', tt.filter((t) => t < 5).length + '/' + N);
    }
    for (const sp of pairs.split(',')) {
      const [gs, ovs] = sp.split('@'), ov = ovs ? ovs.split('/').map(Number) : null;
      const w = await runJobs(seeds.map((seed) => ({ spec: { grant: gs, ov }, seed })));
      const B = nb[bkey(sp)];
      const ratios = w.map((r, i) => r.T / B[i].T);
      res.pair[sp] = ratios;
      const lg = ratios.map(Math.log), ml = lg.reduce((a, b) => a + b) / N, se = Math.sqrt(lg.reduce((a, b) => a + (b - ml) * (b - ml), 0) / (N - 1) / N);
      console.log('pair', sp, 'gain', ((gm(ratios) - 1) * 100).toFixed(1) + '%', 'ratio(gmean)', gm(ratios).toFixed(3), '+-' + (se * 100).toFixed(1) + '%(se)', 'min/max', Math.min(...ratios).toFixed(2), Math.max(...ratios).toFixed(2));
    }
  }
  const pacts = opt('--pact');
  if (pacts) {
    res.pact = {};
    const ids = pacts === 'all' ? Core.PACT_IDS : pacts.split(',');
    const ok = seeds.filter((s, i) => base[i].T > PACT_T);
    console.log('trade seeds (no-trade game > ' + PACT_T + 's):', ok.length + '/' + N);
    for (const id of ids) {
      const [pid, pov] = id.split('@'), pactOv = pov ? Object.fromEntries(pov.split(';').map((x) => { const [k, v] = x.split('='); return [k, +v]; })) : null;
      const w = await runJobs(ok.map((seed) => ({ spec: { pact: pid, pactOv }, seed })));
      const ratios = w.map((r, i) => Math.max(1, r.T - PACT_T) / Math.max(1, base[ok[i] - 1].T - PACT_T));
      res.pact[id] = ratios;
      console.log('pact', id, 'ratio(gmean)', gm(ratios).toFixed(3), 'min/max', Math.min(...ratios).toFixed(2), Math.max(...ratios).toFixed(2), 'n=' + ratios.length);
    }
  }
  if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(res));
  process.exit(0);
}
main();

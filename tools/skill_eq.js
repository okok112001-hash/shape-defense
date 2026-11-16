'use strict';
/* 진화 스킬 세기 측정 (등가 화력). 자세한 설명은 tools/README.md 의 "스킬 등가 화력" 절.
   팀 = 같은 무기 다섯 자루, 모두 진화 0강(파츠, 증강 없음), 다섯 자루 모두 같은 스킬.
   시나리오마다 팀이 "무기 없을 때 새는 피해의 45%"만 새게 버티는 적 체력 배수 M* 를 찾고,
   R = M*(스킬) / M*(스킬 없음) 을 그 스킬의 등가 화력 배수로 읽는다 (공격력 +X% 이면 R = 1 + X/100).
   사용: node tools/skill_eq.js [--only blaster.0,laser] [--runs 4] [--tag 이름] [--root|--full] [--nofake] [--jit 0.2] [--from 1] */
const { isMainThread, parentPort } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const os = require('os');
const B = require('./bench.js');           // 시나리오, 한 판 시뮬레이션(runSim), 목표 비율을 그대로 쓴다

const L = require('./eq_lib.js');         // M* 찾기(findM), 워커 실행기, 리포트 도우미 (tools/item_eq.js 와 같이 쓴다)
const { T, PREC, D, K } = L;                // T = 0.45: 무기 없을 때 피해 대비 비율. PREC, D, K 는 리포트 설명에만 쓴다
const PHASE1_GUESS = 300;                   // 스킬 없는 팀 M* 의 첫 추정 (진화 0강 = 일반 100강 화력)
// 가짜 줄: core.js 를 고치지 않고 이 도구 안에서만 쓰는 파츠로 stats 에 끼운다 (무기 파츠 칸 0)
const FAKE = {
  _eq_dmg50: { name: '가짜 줄: 공격력 +50%', v: [0.5, 0.5, 0.5, 0.5], ap: (s, v) => { s.dmgPct += v; } },
  _eq_null:  { name: '가짜 줄: 효과 없음',   v: [0, 0, 0, 0],         ap: () => {} },
};

let Core = null;
function setup() {
  B.init(); Core = B.core();
  for (const [id, P] of Object.entries(FAKE)) Core.PARTS[id] = P;   // 생성 목록(WEAPON_PART_IDS)은 불러올 때 정해져 있어 영향 없음
}

/* ---------- 워커: (팀, 시나리오) 하나의 M* 찾기 (tools/eq_lib.js 의 findM) ---------- */
if (!isMainThread) {
  setup();
  parentPort.on('message', (m) => {
    try { parentPort.postMessage({ id: m.id, res: L.findM(m.spec, m.sk, m.s0, m.N, m.jit, m.guess) }); }
    catch (e) { parentPort.postMessage({ id: m.id, err: String(e && e.stack || e) }); }
  });
  return;
}

/* ---------- 메인 ---------- */
setup();
const SC = B.SC;
const args = process.argv.slice(2);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const N = val('--runs') ? +val('--runs') : 4;
const S0 = val('--from') ? +val('--from') : 1;               // 시드 S0..S0+N-1 (시드 수 안정성 확인용)
const JIT = val('--jit') != null ? +val('--jit') : 0.2;
const TAG = val('--tag');
const ONLY = val('--only') ? val('--only').split(',') : null;
const VARS = args.includes('--root') ? ['root'] : args.includes('--full') ? ['full'] : ['full', 'root'];
const FIRST = ['blaster', 'shotgun', 'laser', 'pulse'];       // 1차분 (새 트리). 2차분은 --only 로 이름을 줄 때만

// 측정 대상 줄
const lines = [];
for (const W of Core.WEAPON_IDS) Core.SKILLS[W].forEach((ln, l) => {
  const id = `${W}.${l}`;
  if (ONLY ? !(ONLY.includes(id) || ONLY.includes(W)) : !FIRST.includes(W)) return;
  lines.push({ id, W, l, name: ln.name, max: ln.nodes.map((nd) => nd.max) });
});
if (!lines.length) { console.error('대상 줄이 없습니다 (--only 확인)'); process.exit(1); }
const types = [...new Set(lines.map((x) => x.W))];
const zero = () => [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
const team = (W, sk, part) => Array.from({ length: 5 }, () => ({ t: W, p: part ? [[part, 0]] : [], a: [], evo: 1, sk }));
// 구성: 스킬 없음(기준), 가짜 줄 2개, 줄 x (완성, 뿌리만)
const cfgs = [];
for (const W of types) {
  cfgs.push({ key: W + '|none', W, kind: 'none', spec: team(W, zero()) });
  if (!args.includes('--nofake')) for (const id of Object.keys(FAKE)) cfgs.push({ key: W + '|' + id, W, kind: 'fake', fid: id, spec: team(W, zero(), id) });
}
for (const x of lines) for (const v of VARS) {
  const sk = zero(); sk[x.l] = v === 'full' ? x.max.slice() : [x.max[0], 0, 0];
  cfgs.push({ key: x.id + '|' + v, W: x.W, kind: v, line: x, spec: team(x.W, sk) });
}

// 작업 실행기 (bench.js 와 같은 방식: CPU 수만큼 워커. tools/eq_lib.js)
const errors = [];
const runJobs = (jobs, label) => L.runJobs(__filename, jobs, label, errors);
const COST = L.COST;                        // 오래 걸리는 작업부터 (부하 고르게)
const KCOST = { full: 3, root: 2, none: 1, fake: 1 };
const mkJobs = (list, guessOf) => list.flatMap((c) => SC.map((sk) => ({ key: c.key + '|' + sk, cost: COST[sk] * KCOST[c.kind], msg: { spec: c.spec, sk, s0: S0, N, jit: JIT, guess: guessOf(c, sk) } })))
  .sort((a, b) => b.cost - a.cost);

const { gm, pad, lpad, fnvStr } = L;

(async function main() {
  const t0 = Date.now();
  // 1단계: 스킬 없는 팀의 M*
  const base = cfgs.filter((c) => c.kind === 'none');
  const R1 = await runJobs(mkJobs(base, () => PHASE1_GUESS), '기준');
  const noneM = (W, sk) => { const r = R1.get(W + '|none|' + sk); return r && !r.fail ? Math.exp(r.lnM) : NaN; };
  // 2단계: 나머지 (첫 추정 = 같은 무기 기준팀의 M*)
  const rest = cfgs.filter((c) => c.kind !== 'none');
  const R2 = await runJobs(mkJobs(rest, (c, sk) => noneM(c.W, sk) || PHASE1_GUESS), '측정');
  const res = new Map([...R1, ...R2]);
  const mins = (Date.now() - t0) / 60000;
  let sims = 0; for (const r of res.values()) if (r) sims += r.sims;

  // R = M*(구성) / M*(스킬 없음)
  const ratio = (c, sk) => {
    const a = res.get(c.key + '|' + sk), z = res.get(c.W + '|none|' + sk);
    if (!a || !z) return { s: 'ERR' };
    if (z.fail) return { s: 'n/a' };
    if (a.fail) return { s: a.fail === 'high' ? '포화' : '못버팀' };
    return { R: Math.exp(a.lnM - z.lnM), se: Math.hypot(a.se || 0, z.se || 0), cl: a.clamped || z.clamped, mv: (a.moved || 0) + (z.moved || 0) };
  };
  const cell = (q) => (q.R != null ? q.R.toFixed(2) + (q.cl ? '!' : q.mv ? '*' : '') : q.s);
  const lvOf = (R) => Math.log(R) / Math.log(1.03);
  const out = [];
  out.push('도형 디펜스 진화 스킬 등가 화력 리포트 (tools/skill_eq.js)');
  out.push(`생성: ${new Date().toISOString()}  시드 ${S0}..${S0 + N - 1}, 체력 흔들기 ±${JIT} (ln), 목표 비율 ${T}, 소요 ${mins.toFixed(1)}분, 시뮬레이션 ${sims}판, 워커 ${os.cpus().length}개${ONLY ? ', 대상 ' + ONLY.join(',') : ''}${VARS.length < 2 ? ', ' + VARS[0] + '만' : ''}`);
  out.push('');
  out.push('[방법] 팀 = 같은 무기 5자루, 모두 진화 0강(파츠, 증강 없음), 다섯 자루 모두 같은 스킬. 시나리오는 bench.js 와 같다(워밍업 10초 + 측정 120초, 기지는 죽지 않음).');
  out.push(`  M* = 팀이 "무기 없을 때 피해의 ${T * 100}%"만 받는 적 체력 배수. 구간 잡기 + 이분법(폭 ${PREC}) 뒤 ±${(K * D).toFixed(3)} 안 ${2 * K + 1}점에 직선을 맞춰 구한다(ln M).`);
  out.push(`  계단 현상 완화: 적마다 체력에 exp(±${JIT}) 범위의 고정 배수를 곱한다(등장 정보의 해시라 구성이 달라도 같은 적이면 같다).`);
  out.push('  R = M*(스킬) / M*(스킬 없음) = 등가 화력 배수. 공격력 +(R-1)% 와 같고, 진화 강화로는 ln R / ln 1.03 단계어치.');
  out.push('  "*" = 답이 처음 창 밖이라 창을 옮겨 다시 맞춤(곡선이 고르지 않음), "!" = 옮겨도 창 밖이라 잘림(믿기 어려움), 포화 = M=1e7 에서도 목표만큼 새지 않음, 못버팀 = M=0.01 에서도 목표보다 많이 샘.');
  out.push('');
  out.push('[스킬 없는 팀의 M*] (괄호 = 맞춤 표준오차 %, 남은 계단의 크기)');
  for (const W of types) out.push('  ' + pad(W, 9) + SC.map((sk) => { const r = res.get(W + '|none|' + sk); return pad(`${sk} ${r && !r.fail ? Math.exp(r.lnM).toPrecision(4) + ' (' + (r.se * 100).toFixed(1) + ')' : r ? (r.fail === 'high' ? '포화' : '못버팀') : 'ERR'}`, 22); }).join(''));
  out.push('');
  const hdr = '  ' + pad('', 30) + SC.map((sk) => lpad(sk, 7)).join('') + lpad('기하평균', 10) + lpad('공격력', 9) + lpad('강화단계', 9) + lpad('오차%', 7);
  const row = (label, c) => {
    const qs = SC.map((sk) => ratio(c, sk)), ok = qs.filter((q) => q.R != null);
    const g = ok.length === SC.length ? gm(ok.map((q) => q.R)) : NaN;
    const se = ok.length ? Math.max(...ok.map((q) => q.se)) * 100 : NaN;
    return { qs, g, text: '  ' + pad(label, 30) + qs.map((q) => lpad(cell(q), 7)).join('') + lpad(isNaN(g) ? '-' : g.toFixed(3), 10) + lpad(isNaN(g) ? '-' : (Math.round((g - 1) * 100) >= 0 ? '+' : '') + Math.round((g - 1) * 100) + '%', 9) + lpad(isNaN(g) ? '-' : lvOf(g).toFixed(1), 9) + lpad(isNaN(se) ? '-' : se.toFixed(1), 7) };
  };
  const fakes = cfgs.filter((c) => c.kind === 'fake');
  if (fakes.length) {
    out.push('[방법 검증: 가짜 줄] 공격력 +50% 는 R = 1.50, 효과 없음은 R = 1.00 이어야 한다 (허용 ±0.05)');
    out.push(hdr);
    let worst = 0, cnt = 0, bad = 0;
    for (const c of fakes) {
      const want = c.fid === '_eq_dmg50' ? 1.5 : 1;
      const r = row(`${c.W} ${FAKE[c.fid].name.replace('가짜 줄: ', '')}`, c);
      for (const q of r.qs) { cnt++; if (q.R == null || Math.abs(q.R - want) > 0.05) bad++; else worst = Math.max(worst, Math.abs(q.R - want)); }
      out.push(r.text);
    }
    out.push(`  판정: ${cnt}칸 중 허용 밖 ${bad}칸, 허용 안 칸의 최대 차이 ${worst.toFixed(3)}`);
    out.push('');
  }
  const sum = [];
  for (const v of VARS) {
    out.push(`[줄 측정: ${v === 'full' ? '완성 (뿌리 5, 상위 5, 궁극 1 = 11점)' : '뿌리만 (5점)'}]  셀 = 시나리오별 R`);
    out.push(hdr);
    for (const x of lines) {
      const c = cfgs.find((q) => q.key === x.id + '|' + v);
      const r = row(`${x.id} ${x.name}`, c); out.push(r.text);
      sum.push({ x, v, r });
    }
    out.push('');
  }
  if (VARS.length === 2) {
    out.push('[요약] 줄 / 완성 R / 뿌리만 R / 완성의 시나리오 최고, 최저');
    for (const x of lines) {
      const f = sum.find((s) => s.x === x && s.v === 'full').r, o = sum.find((s) => s.x === x && s.v === 'root').r;
      // 포화는 가장 높은 쪽(무한대), 못버팀은 가장 낮은 쪽으로 센다
      const ok = SC.map((sk, i) => { const q = f.qs[i]; return { sk, v: q.R != null ? q.R : q.s === '포화' ? Infinity : q.s === '못버팀' ? 0 : NaN, t: q.R != null ? q.R.toFixed(2) : q.s }; })
        .filter((y) => !isNaN(y.v)).sort((a, b) => b.v - a.v);
      const nInf = ok.filter((y) => y.v === Infinity).length;
      out.push('  ' + pad(`${x.id} ${x.name}`, 30) + lpad(isNaN(f.g) ? '-' : f.g.toFixed(2), 7) + lpad(isNaN(o.g) ? '-' : o.g.toFixed(2), 8) + (ok.length ? `   최고 ${ok[0].sk} ${ok[0].t}${nInf > 1 ? ` (포화 ${nInf}곳)` : ''}, 최저 ${ok[ok.length - 1].sk} ${ok[ok.length - 1].t}` : ''));
    }
    out.push('');
  }
  const digest = fnvStr(JSON.stringify([...res.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, r]) => [k, r && (r.fail || r.lnM.toFixed(12))])));
  out.push(`[결정성] 결과 해시 ${digest.toString(16)} (같은 입력이면 같아야 한다)`);
  out.push(`[오류] ${errors.length}건`, ...errors.slice(0, 10));
  const rp = path.join(__dirname, TAG ? `skill_eq_report_${TAG}.txt` : 'skill_eq_report.txt');
  fs.writeFileSync(rp, out.join('\n') + '\n');
  console.log(out.join('\n'));
  console.log('\n저장:', rp);
  process.exit(0);
})();

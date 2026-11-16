'use strict';
/* 파츠·증강 세기 측정 (등가 화력). 자세한 설명은 tools/README.md 의 "파츠·증강 등가 화력" 절.
   팀 X2(T) = [블래스터, T, 블래스터, T, 블래스터] (운반 칸 1, 3. 레이저만 I5 = 레이저 다섯 자루), 팀 P5 = [산탄포, 블래스터, 레이저, 전격기, 박격포] (운반 칸 다섯 모두).
   무기는 진화하지 않은 보통 무기(강화 단계는 시나리오의 lv). 운반 칸마다 대상 하나(파츠 칸 0 또는 증강 칸 0).
   시나리오마다 팀이 "무기 없을 때 새는 피해의 45%"만 새게 버티는 적 체력 배수 M* 를 찾고(tools/eq_lib.js 의 findM, skill_eq.js 와 같다),
   같은 팀의 기준(대상 없음)과 가짜 파츠(공격력 +25/+100/+300%)의 ln M* 꺾은선에서 대상의 ln M* 에 맞는 공격력을 찾는다
   = "운반 무기의 공격력 +몇 %어치". 결과는 tools/item_eq.json (tools/value.js 가 영점 맞춤에 읽는다).
   사용: node tools/item_eq.js [--only laser,P5,rate] [--runs 4] [--from 1] [--jit 0.2] [--grades 0,2,3] [--nofake] [--tag 이름] [--rejson 파일] */
const { isMainThread, parentPort } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const os = require('os');
const B = require('./bench.js');           // 시나리오, 한 판 시뮬레이션(runSim)
const L = require('./eq_lib.js');         // M* 찾기(findM), 워커 실행기, 리포트 도우미
const { T, PREC, D, K } = L;                // T = 0.45: 무기 없을 때 피해 대비 비율

const GUESS0 = 10;                          // bench_cal.json 에 같은 팀이 없을 때 기준 M* 의 첫 추정
// 가짜 파츠: core.js 를 고치지 않고 이 도구 안에서만 Core.PARTS 에 넣는다 (skill_eq.js 의 FAKE 와 같은 방식). 운반 칸의 파츠 칸 0
const FAKE_D = { _eq_d25: 0.25, _eq_d50: 0.5, _eq_d100: 1, _eq_d300: 3 };
const FAKE = {};
for (const [id, d] of Object.entries(FAKE_D)) FAKE[id] = { name: `가짜: 공격력 +${d * 100}%`, min: 0, v: [d, d, d, d], ap: (s, v) => { s.dmgPct += v; } };
const KNOTS = ['_eq_d25', '_eq_d100', '_eq_d300'];   // 환산 꺾은선의 마디 (기준 d=0 과 함께). d50 은 검증용
const X2_PARTS = ['rate', 'range', 'boss', 'exec', 'first', 'chill', 'ember'];   // X2 팀에서 재는 무기 파츠 (무기마다 값이 다를 만한 것)
const PART_TEAM = ['shotgun', 'blaster', 'laser', 'tesla', 'mortar'];             // bench.js 의 PART_TEAM 과 같다
const P5_SKIP = ['dmg', 'gold'];            // P5 에서 빼는 파츠 (dmg 는 정의상 공격력, gold 는 leak 에 안 잡힘)

let Core = null;
function setup() {
  B.init(); Core = B.core();
  for (const [id, P] of Object.entries(FAKE)) Core.PARTS[id] = P;   // 생성 목록(WEAPON_PART_IDS)은 불러올 때 정해져 있어 영향 없음
}

/* ---------- 워커: (구성, 시나리오) 하나의 M* 와 그 M* 에서의 기록 ---------- */
function measure(m) {
  const t0 = Date.now();
  const r = L.findM(m.spec, m.sk, m.s0, m.N, m.jit, m.guess);
  if (r.fail) { r.ms = Date.now() - t0; return r; }
  // M* 에서 시드 N 판을 한 번 더 돌려 운반 칸 피해 비율(팀 전체 피해 대비), 팀 처치 수, 팀 피해(시드 평균, 측정 120초)를 기록
  const M = Math.exp(r.lnM);
  let cw = 0, all = 0, kills = 0, dealt = 0;
  for (let s = m.s0; s < m.s0 + m.N; s++) {
    const q = B.runSim(m.spec, m.sk, s, M, m.jit);
    q.wd.forEach((v, i) => { all += v; if (m.carry.includes(i)) cw += v; });
    kills += q.kills; dealt += q.dealt;
  }
  r.share = all > 0 ? cw / all : null; r.kills = kills / m.N; r.dealt = dealt / m.N; r.sims += m.N;
  r.ms = Date.now() - t0;                   // 이 작업에 걸린 시간 (소요 시간 추정용. 결과 해시에는 넣지 않는다)
  return r;
}
if (!isMainThread) {
  setup();
  parentPort.on('message', (m) => {
    try { parentPort.postMessage({ id: m.id, res: measure(m) }); }
    catch (e) { parentPort.postMessage({ id: m.id, err: String(e && e.stack || e) }); }
  });
  return;
}

/* ---------- 메인 ---------- */
setup();
const SC = B.SC, GR = Core.GRADES;
const args = process.argv.slice(2);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const N = val('--runs') ? +val('--runs') : 4;
const S0 = val('--from') ? +val('--from') : 1;               // 시드 S0..S0+N-1
const JIT = val('--jit') != null ? +val('--jit') : 0.2;
const TAG = val('--tag');
const ONLY = val('--only') ? val('--only').split(',') : null;
const GRADES = val('--grades') ? val('--grades').split(',').map(Number) : null;   // 없으면 max(2, 최저 등급) 하나
const REJSON = val('--rejson');                             // 저장된 json 으로 환산만 다시
const NOFAKE = args.includes('--nofake');                     // 가짜 d50(검증용)만 뺀다. 마디(25/100/300)는 항상 잰다

// 팀
const teams = [];
// 레이저는 I5(레이저 다섯 자루, 다섯 모두 운반): X2 에서는 레이저가 자기 레인을 다 비워 블래스터 레인이 M* 를 정해 버린다(가짜 꺾은선이 평평)
const I5 = ['laser'];
for (const W of Core.WEAPON_IDS) {
  const i5 = I5.includes(W);
  teams.push({
    name: (i5 ? 'I5:' : 'X2:') + W, sel: W, types: [0, 1, 2, 3, 4].map((i) => (i5 || i === 1 || i === 3 ? W : 'blaster')), carry: i5 ? [0, 1, 2, 3, 4] : [1, 3],
    items: [...Core.AUG_POOL[W].filter((id) => id !== 'a_dmg').map((id) => ({ kind: 'aug', id })), ...X2_PARTS.map((id) => ({ kind: 'part', id }))],
  });
}
teams.push({ name: 'P5', sel: 'P5', types: PART_TEAM.slice(), carry: [0, 1, 2, 3, 4],
  items: Core.WEAPON_PART_IDS.filter((id) => !P5_SKIP.includes(id)).map((id) => ({ kind: 'part', id })) });

// --only: 팀 이름(X2 의 무기 id 또는 P5)과 항목 id. 둘 다 주면 그 팀들 안의 그 항목만. 항목이 든 팀의 기준과 가짜는 자동 포함
const teamSel = ONLY ? ONLY.filter((x) => teams.some((t) => t.sel === x)) : [];
const itemSel = ONLY ? ONLY.filter((x) => !teams.some((t) => t.sel === x)) : [];
const unknown = itemSel.filter((x) => !teams.some((t) => t.items.some((it) => it.id === x)));
if (unknown.length) { console.error('모르는 이름: ' + unknown.join(',') + ' (--only 는 무기 id, P5, 항목 id)'); process.exit(1); }
const def = (it) => (it.kind === 'aug' ? Core.AUGS[it.id] : Core.PARTS[it.id]);
const gradesOf = (min) => (GRADES ? GRADES.filter((g) => g >= min && g <= 3) : [Math.max(2, min)]);
const mkSpec = (t, put) => t.types.map((ty, i) => {
  const on = put && t.carry.includes(i);
  return { t: ty, p: on && put.p ? [put.p] : [], a: on && put.a ? [put.a] : [] };
});
const cfgs = [];
for (const t of teams) {
  if (teamSel.length && !teamSel.includes(t.sel)) continue;
  const items = itemSel.length ? t.items.filter((it) => itemSel.includes(it.id)) : t.items;
  const subs = [];
  for (const it of items) for (const g of gradesOf(def(it).min)) {
    subs.push({ key: `${t.name}|${it.kind}|${it.id}|${g}`, team: t.name, kind: it.kind, id: it.id, g, name: def(it).name,
      spec: mkSpec(t, it.kind === 'aug' ? { a: [it.id, g] } : { p: [it.id, g] }) });
  }
  if (!subs.length) continue;
  cfgs.push({ key: `${t.name}|none`, team: t.name, kind: 'none', id: null, g: null, name: '기준 (대상 없음)', spec: mkSpec(t, null) });
  for (const fid of Object.keys(FAKE_D)) {
    if (NOFAKE && fid === '_eq_d50') continue;
    cfgs.push({ key: `${t.name}|fake|${fid}`, team: t.name, kind: 'fake', id: fid, g: null, name: FAKE[fid].name, spec: mkSpec(t, { p: [fid, 0] }) });
  }
  cfgs.push(...subs);
}
if (!cfgs.length) { console.error('대상이 없습니다 (--only, --grades 확인)'); process.exit(1); }
const teamOf = new Map(teams.map((t) => [t.name, t]));
for (const c of cfgs) c.carry = teamOf.get(c.team).carry;
const usedTeams = [...new Set(cfgs.map((c) => c.team))].map((n) => teamOf.get(n));

// 기준 M* 의 첫 추정: bench_cal.json 의 같은 팀(`teamKey|시나리오`) M, 없으면 GUESS0
let CAL = {};
try { CAL = JSON.parse(fs.readFileSync(path.join(__dirname, 'bench_cal.json'), 'utf8')); } catch (e) { CAL = {}; }
const calGuess = (c, sk) => { const q = CAL[B.teamKey(c.spec) + '|' + sk]; return q && q.M > 0 ? q.M : GUESS0; };

// 작업 실행기 (skill_eq.js 와 같은 방식. tools/eq_lib.js)
const errors = [];
const runJobs = (jobs, label) => L.runJobs(__filename, jobs, label, errors);
const mkJobs = (list, guessOf) => list.flatMap((c) => SC.map((sk) => ({ key: c.key + '|' + sk, cost: L.COST[sk], msg: { spec: c.spec, sk, s0: S0, N, jit: JIT, guess: guessOf(c, sk), carry: c.carry } })))
  .sort((a, b) => b.cost - a.cost);   // 오래 걸리는 작업부터 (부하 고르게)
const { gm, pad, lpad, fnvStr } = L;

// 꺾은선 (x 오름차순 점 [x, y]) 의 역함수: y 가 되는 x. 범위 밖은 끝 구간의 기울기로 늘린다. 기울기가 0 이하라 구할 수 없으면 null
function invert(pts, y) {
  const n = pts.length, sl = (i) => (pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]);
  if (y <= pts[0][1]) { const s = sl(0); return s > 0 ? pts[0][0] + (y - pts[0][1]) / s : null; }
  for (let i = 0; i < n - 1; i++) { const s = sl(i); if (s > 0 && y >= pts[i][1] && y <= pts[i + 1][1]) return pts[i][0] + (y - pts[i][1]) / s; }
  if (y > pts[n - 1][1]) { const s = sl(n - 2); return s > 0 ? pts[n - 1][0] + (y - pts[n - 1][1]) / s : null; }
  return null;
}
const failName = (f) => (f === 'high' ? '포화' : f === 'low' ? '못버팀' : '오류');
// 천장: 공격력을 더 올려도 M* 가 거의 안 오르는 구간 (예: 운반 무기가 이미 적을 한 방에 잡아 남는 피해가 버려질 때).
// 꺾은선 구간 기울기가 첫 구간 기울기의 FLAT 배 아래로 떨어지면 거기서 평평하다고 보고, 그 앞 마디의 공격력을 환산 상한(cap)으로 둔다.
// 대상의 ln M* 가 평평한 구간의 높이(상한 마디부터 끝까지의 최솟값) - 0.01 이상이면 eq 는 하한일 뿐이다(sat).
const FLAT = 0.25;
function capOf(pts) {
  if (pts.length < 2) return null;
  const sl = (i) => (pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]), s0 = sl(0);
  let ci = pts.length - 1;
  if (!(s0 > 0)) ci = 0;
  else for (let i = 1; i < pts.length - 1; i++) if (sl(i) < FLAT * s0) { ci = i; break; }
  const flat = ci < pts.length - 1;
  return { d: Math.exp(pts[ci][0]) - 1, flat, level: flat ? Math.min(...pts.slice(ci).map((p) => p[1])) : Infinity };
}

(async function main() {
  const t0 = Date.now();
  // 1단계: 기준 팀(대상 없음)의 M*
  const base = cfgs.filter((c) => c.kind === 'none');
  let res, mins;
  if (REJSON) {   // --rejson 파일: 다시 재지 않고 저장된 M* 로 환산과 리포트만 다시 만든다 (옵션은 그 측정과 같게 줄 것)
    const j = JSON.parse(fs.readFileSync(REJSON, 'utf8'));
    res = new Map();
    for (const r of j.rows) {
      const key = r.kind === 'none' ? `${r.team}|none` : r.kind === 'fake' ? `${r.team}|fake|${r.id}` : `${r.team}|${r.kind}|${r.id}|${r.g}`;
      for (const sk of SC) { const q = r.sc[sk]; if (q) res.set(key + '|' + sk, { lnM: q.lnM, se: q.se, clamped: q.clamped, moved: q.moved, fail: q.fail, share: q.share, kills: q.kills, dealt: q.dealt, ms: q.ms, sims: q.sims || 0 }); }
    }
    mins = j.meta.minutes;
  } else {
    const R1 = await runJobs(mkJobs(base, calGuess), '기준');
    const baseM = (c, sk) => { const r = R1.get(c.team + '|none|' + sk); return r && !r.fail ? Math.exp(r.lnM) : NaN; };
    // 2단계: 가짜와 대상 (첫 추정 = 같은 팀 기준의 M*)
    const rest = cfgs.filter((c) => c.kind !== 'none');
    const R2 = await runJobs(mkJobs(rest, (c, sk) => baseM(c, sk) || calGuess(c, sk)), '측정');
    res = new Map([...R1, ...R2]);
    mins = (Date.now() - t0) / 60000;
  }
  let sims = 0; for (const r of res.values()) if (r) sims += r.sims;

  // 환산: 칸 = (구성, 시나리오)
  const get = (team, k, sk) => res.get(team + '|' + k + '|' + sk);
  // 팀 x 시나리오의 환산 꺾은선: [ln(1+d), ln M*] (기준과 가짜 마디 중 M* 를 찾은 것)
  const curve = (team, sk) => {
    const b = get(team, 'none', sk);
    if (!b || b.fail) return null;
    const pts = [[0, b.lnM]];
    for (const fid of KNOTS) { const q = get(team, 'fake|' + fid, sk); if (q && !q.fail) pts.push([Math.log(1 + FAKE_D[fid]), q.lnM]); }
    return pts;
  };
  function cellOf(c, sk) {
    const r = res.get(c.key + '|' + sk), b = get(c.team, 'none', sk);
    const o = { lnM: null, se: null, clamped: null, moved: null, fail: null, share: null, kills: null, dealt: null, R: null, eq: null, cap: null, sat: null };
    if (!r) { o.fail = 'error'; o.why = '오류'; return o; }
    if (r.fail) o.fail = r.fail;
    else Object.assign(o, { lnM: r.lnM, se: isFinite(r.se) ? r.se : null, clamped: r.clamped, moved: r.moved, share: r.share, kills: r.kills, dealt: r.dealt });
    o.ms = r.ms; o.sims = r.sims;
    if (!b) { o.why = '기준 오류'; return o; }
    if (b.fail) { o.why = '기준 ' + failName(b.fail); return o; }
    if (r.fail) { o.why = '대상 ' + failName(r.fail); return o; }
    o.R = Math.exp(r.lnM - b.lnM);
    const pts = curve(c.team, sk);
    if (pts.length < 2) { o.why = '가짜 마디 부족'; return o; }
    const cp = capOf(pts);
    o.cap = cp.d; o.sat = cp.flat && r.lnM >= cp.level - 0.01;
    const x = invert(pts, r.lnM);
    if (o.sat) { o.eq = cp.d; o.why = '천장 위: eq 는 하한 (= 환산 상한, 평평한 구간을 늘려 쓰면 값이 터무니없이 커진다)'; }
    else if (x == null) { o.why = '기울기 0 이하'; return o; }
    else o.eq = Math.exp(x) - 1;
    o.mark = (o.sat ? '^' : '') + (r.clamped || b.clamped ? '!' : (r.moved || b.moved) ? '*' : '');   // 리포트 표시용 (JSON 에서는 뺀다)
    return o;
  }
  const rows = cfgs.map((c) => ({ c, team: c.team, kind: c.kind, id: c.id, g: c.g, name: c.name, sc: Object.fromEntries(SC.map((sk) => [sk, cellOf(c, sk)])) }));

  const digest = fnvStr(JSON.stringify([...res.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, r]) => [k, r && (r.fail || [r.lnM.toFixed(12), r.share == null ? null : r.share.toFixed(9), r.dealt.toFixed(6), r.kills])])));
  const hash = digest.toString(16);

  /* ---------- JSON ---------- */
  const jsonRows = rows.map((r) => ({ team: r.team, kind: r.kind, id: r.id, g: r.g, name: r.name,
    sc: Object.fromEntries(SC.map((sk) => { const o = Object.assign({}, r.sc[sk]); delete o.mark; return [sk, o]; })) }));
  const meta = {
    created: new Date().toISOString(), runs: N, from: S0, jit: JIT, target: T, minutes: +mins.toFixed(2), workers: os.cpus().length, hash,
    sims, errors: errors.length, only: ONLY, grades: GRADES, nofake: NOFAKE,
    teams: Object.fromEntries(usedTeams.map((t) => [t.name, { weapons: t.types, carry: t.carry,
      curves: Object.fromEntries(SC.map((sk) => { const p = curve(t.name, sk), cp = p && p.length > 1 ? capOf(p) : null; return [sk, { pts: p && p.map(([x, y]) => [+(Math.exp(x) - 1).toFixed(4), y]), cap: cp ? cp.d : null }]; })) }])),
    note: 'eq = 운반 무기 공격력 +eq 어치 (0.25 = +25%). R = M*(대상)/M*(기준). share = M* 에서 운반 칸 피해 / 팀 전체 피해. kills, dealt = M* 에서 측정 120초 동안의 시드 평균. lnM = ln M*. '
      + 'cap = 가짜 꺾은선이 평평해지기 전 마지막 마디의 공격력 (팀 x 시나리오, teams.*.curves 에 마디 [공격력, lnM]). sat = 대상이 평평한 구간(천장)에 닿아 eq 는 하한일 뿐. why = eq 가 null 인 사유',
  };
  const jp = path.join(__dirname, TAG ? `item_eq_${TAG}.json` : 'item_eq.json');
  fs.writeFileSync(jp, JSON.stringify({ meta, rows: jsonRows }, null, 1));

  /* ---------- 리포트 ---------- */
  const pct = (e) => String(Math.round(e * 100));
  const cell = (o) => (o.eq != null ? pct(o.eq) + o.mark : o.why && o.why.startsWith('기준') ? 'n/a' : o.fail ? failName(o.fail) : o.why && o.why.startsWith('천장') ? '천장' : '?');
  const gmText = (r) => {
    const ok = SC.map((sk) => r.sc[sk]).filter((o) => o.eq != null);
    if (!ok.length) return '- (0)';
    const g = gm(ok.map((o) => 1 + o.eq)) - 1;
    return `${pct(g)} (${ok.length})`;
  };
  const out = [];
  out.push('도형 디펜스 파츠·증강 등가 화력 리포트 (tools/item_eq.js)');
  out.push(`생성: ${meta.created}  시드 ${S0}..${S0 + N - 1}, 체력 흔들기 ±${JIT} (ln), 목표 비율 ${T}, 소요 ${mins.toFixed(1)}분, 시뮬레이션 ${sims}판, 워커 ${os.cpus().length}개${ONLY ? ', 대상 ' + ONLY.join(',') : ''}${GRADES ? ', 등급 ' + GRADES.join(',') : ''}`);
  out.push('');
  out.push('[방법] X2(T) = [블래스터, T, 블래스터, T, 블래스터], 운반 칸 1, 3 (레이저만 I5 = 레이저 다섯 자루, 다섯 모두 운반). P5 = [산탄포, 블래스터, 레이저, 전격기, 박격포], 운반 칸 다섯 모두.');
  out.push('  무기는 진화하지 않은 보통 무기(시나리오의 강화 단계). 대상은 운반 칸마다 하나(파츠 칸 0 또는 증강 칸 0). 기본 등급 = 영웅(최저 등급이 전설이면 전설).');
  out.push(`  M* = 팀이 "무기 없을 때 피해의 ${T * 100}%"만 받는 적 체력 배수 (skill_eq.js 와 같다: 구간 잡기 + 이분법(폭 ${PREC}) + ±${(K * D).toFixed(3)} 안 ${2 * K + 1}점 직선 맞춤, 적 체력 흔들기 exp(±${JIT})).`);
  out.push('  환산: 같은 팀의 기준(공격력 +0)과 가짜 파츠 +25/+100/+300% 의 ln M* 를 x = ln(1+공격력) 에 대한 꺾은선으로 보고,');
  out.push('    대상의 ln M* 와 같은 x 를 찾아 eq = e^x - 1 (운반 무기 공격력 +eq 어치). 범위 밖은 끝 구간 기울기로 늘린다(음수 허용).');
  out.push('  셀 = 시나리오별 eq(%). "*" = 맞춤 창을 옮김(곡선이 고르지 않음), "!" = 창 밖이라 잘림(믿기 어려움), 포화/못버팀 = 대상 M* 를 못 찾음,');
  out.push('    n/a = 기준 M* 를 못 찾음, ? = 꺾은선 기울기가 0 이하라 환산 불가. 기하평균 = 유효 칸(^ 포함)의 (1+eq) 기하평균 - 1 (%), 괄호 = 유효 칸 수.');
  out.push(`  천장: 공격력을 더 올려도 M* 가 거의 안 오르는 구간(운반 무기가 이미 한 방에 잡는 등). 가짜 꺾은선의 기울기가 첫 구간의 ${FLAT} 배 밑이면 평평하다고 본다.`);
  out.push('    환산 상한 = 평평해지기 전 마지막 마디의 공격력(%). "^" = 대상이 천장에 닿아 eq 는 하한, 천장 = 천장보다 높아 공격력으로 환산 불가(다른 레인을 돕는 효과 등).');
  out.push('');
  // 가짜 d50 검증
  if (!NOFAKE) {
    out.push('[방법 검증: 가짜 d50] 보간으로 50 ± 5 가 나와야 한다');
    out.push('  ' + pad('', 12) + SC.map((sk) => lpad(sk, 7)).join(''));
    let cnt = 0, bad = 0, badCap = 0, badBase = 0;
    for (const t of usedTeams) {
      const r = rows.find((q) => q.team === t.name && q.kind === 'fake' && q.id === '_eq_d50');
      if (!r) continue;
      out.push('  ' + pad(t.name, 12) + SC.map((sk) => {
        const o = r.sc[sk]; cnt++;
        if (o.eq == null || Math.abs(o.eq - 0.5) > 0.05) { bad++; if (o.why && o.why.startsWith('기준')) badBase++; else if (o.cap != null && o.cap < 0.5) badCap++; }
        return lpad(cell(o), 7);
      }).join(''));
    }
    out.push(`  판정: ${cnt}칸 중 허용 밖 ${bad}칸 (그중 기준 M* 를 못 찾은 칸 ${badBase}칸, 환산 상한이 50% 밑이라 잴 수 없는 칸 ${badCap}칸)`);
    out.push('');
  }
  // 팀마다 표
  const hdr = '  ' + pad('', 36) + SC.map((sk) => lpad(sk, 7)).join('') + lpad('기하평균', 12);
  for (const t of usedTeams) {
    const br = rows.find((q) => q.team === t.name && q.kind === 'none');
    out.push(`[${t.name}] 팀 ${t.types.join(',')}, 운반 칸 ${t.carry.join(',')}`);
    out.push('  ' + pad('기준 M*', 36) + SC.map((sk) => { const o = br.sc[sk]; return lpad(o.lnM != null ? Math.exp(o.lnM).toPrecision(3) : failName(o.fail), 7); }).join(''));
    out.push('  ' + pad('운반 칸 피해 비율 (기준, %)', 36) + SC.map((sk) => { const o = br.sc[sk]; return lpad(o.share != null ? Math.round(o.share * 100) : '-', 7); }).join(''));
    out.push('  ' + pad('환산 상한 (%)', 36) + SC.map((sk) => { const o = br.sc[sk]; return lpad(o.cap != null ? Math.round(o.cap * 100) : '-', 7); }).join(''));
    out.push(hdr);
    for (const r of rows.filter((q) => q.team === t.name && q.kind !== 'none')) {
      const label = r.kind === 'fake' ? r.name : `${r.id} ${r.name} [${GR[r.g]}]`;
      out.push('  ' + pad(label, 36) + SC.map((sk) => lpad(cell(r.sc[sk]), 7)).join('') + lpad(gmText(r), 12));
    }
    out.push('');
  }
  const msOf = (pred) => { let a = 0; for (const c of cfgs) if (pred(c)) for (const sk of SC) { const r = res.get(c.key + '|' + sk); if (r) a += r.ms || 0; } return a / 60000; };
  out.push('[작업 시간] 워커 시간 합 (분, 구성 수): ' + usedTeams.map((t) => `${t.name} ${msOf((c) => c.team === t.name).toFixed(1)} (${cfgs.filter((c) => c.team === t.name).length})`).join(', '));
  out.push(`[결정성] 결과 해시 ${hash} (같은 입력이면 같아야 한다)`);
  out.push(`[오류] ${errors.length}건`, ...errors.slice(0, 10));
  const rp = path.join(__dirname, TAG ? `item_eq_report_${TAG}.txt` : 'item_eq_report.txt');
  fs.writeFileSync(rp, out.join('\n') + '\n');
  console.log(out.join('\n'));
  console.log('\n저장:', rp, jp);
  process.exit(0);
})();

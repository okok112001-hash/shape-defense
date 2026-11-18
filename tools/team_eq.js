'use strict';
/* 섞인 팀에서 한 칸 무기의 세기 (T10e). 산성 분사기처럼 자기 피해보다 다른 무기를 돕는 무기의 값어치를 "팀이 버티는 세기"로 잰다.
   팀 = [a, b, W, c, d] (기본 --team blaster,shotgun,laser,rail. 모두 진화 0강, 가운데 칸 2 만 바뀐다).
   후보 W 마다 팀이 "무기 없을 때 새는 피해의 45%"만 새게 버티는 적 체력 배수 M* 를 찾고 (tools/eq_lib.js 의 findM, skill_eq.js 와 같은 방법),
   기준 팀(가운데 칸 = --ref, 기본 blaster)의 M* 와의 비 R = M*(후보) / M*(기준) 을 본다. R = 1 이면 그 칸에 블래스터를 둔 것과 같은 세기.
   기준 무기에 가짜 공격력 마디(예: blaster+d50, blaster+d100)를 후보로 함께 주면, 다른 후보를 "기준 무기 공격력 몇 % 어치"로도 읽는다
   (ln M* 꺾은선에서 같은 M* 가 되는 공격력. 마디 밖은 끝 구간을 늘여 읽고 "!" 표시).
   후보 문법: 무기[+수식...]
     d<±%>          가짜 파츠: 공격력 ±% (예 acid+d-40 = 공격력 x0.6)
     a.<증강>.<등급> 증강 (등급 0~3. 예 acid+a.c_corrode.2)
     p.<파츠>.<등급> 무기 파츠
     s<줄>.<랭크 셋> 진화 스킬 (예 acid+s1.551 = 줄 1 을 뿌리 5, 상위 5, 궁극 1)
   사용: node tools/team_eq.js --cand acid,acid+d-40,blaster+d50 [--ref blaster] [--team blaster,shotgun,laser,rail] [--runs 4] [--from 1] [--jit 0.2] [--only few,mix] [--tag 이름]
   결과: tools/team_eq_report[_이름].txt */
const { isMainThread, parentPort } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const os = require('os');
const B = require('./bench.js');
const L = require('./eq_lib.js');
const { T } = L;

let Core = null;
// 가짜 공격력 파츠는 이름에서 수치를 읽어 그때그때 만든다 (워커도 같은 식으로)
function fakeOf(id) {
  if (Core.PARTS[id]) return;
  const d = +id.slice(5) / 100;
  Core.PARTS[id] = { name: `가짜: 공격력 ${d >= 0 ? '+' : ''}${Math.round(d * 100)}%`, v: [d, d, d, d], ap: (s, v) => { s.dmgPct += v; } };
}
function setup() { B.init(); Core = B.core(); }
const fakesIn = (spec) => { for (const o of spec) if (o) for (const q of o.p) if (q[0].startsWith('_te_d')) fakeOf(q[0]); };

/* ---------- 워커: (팀, 시나리오) 하나의 M* ---------- */
if (!isMainThread) {
  setup();
  parentPort.on('message', (m) => {
    try { fakesIn(m.spec); parentPort.postMessage({ id: m.id, res: L.findM(m.spec, m.sk, m.s0, m.N, m.jit, m.guess) }); }
    catch (e) { parentPort.postMessage({ id: m.id, err: String(e && e.stack || e) }); }
  });
  return;
}

/* ---------- 메인 ---------- */
setup();
const args = process.argv.slice(2);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const N = +(val('--runs') || 4), S0 = +(val('--from') || 1), JIT = val('--jit') != null ? +val('--jit') : 0.2, TAG = val('--tag');
const TEAM = (val('--team') || 'blaster,shotgun,laser,rail').split(',');
if (TEAM.length !== 4) { console.error('--team 은 무기 넷'); process.exit(1); }
const REF = val('--ref') || 'blaster';
const SC = val('--only') ? val('--only').split(',') : B.SC;
const zero = () => [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
function parse(txt) {
  const [t, ...mods] = txt.split('+');
  if (!Core.WEAPONS[t]) throw new Error('무기 이름 확인: ' + t);
  const o = { t, p: [], a: [], evo: 1, sk: zero() };
  for (const m of mods) {
    if (/^d-?\d+(\.\d+)?$/.test(m)) { const id = '_te_d' + m.slice(1); fakeOf(id); o.p.push([id, 0]); }
    else if (/^a\./.test(m)) { const [, id, g] = m.split('.'); if (!Core.AUGS[id]) throw new Error('증강 확인: ' + id); o.a.push([id, +g]); }
    else if (/^p\./.test(m)) { const [, id, g] = m.split('.'); if (!Core.PARTS[id]) throw new Error('파츠 확인: ' + id); o.p.push([id, +g]); }
    else if (/^s\d\.\d{3}$/.test(m)) { const l = +m[1]; o.sk[l] = m.slice(3).split('').map(Number); }
    else throw new Error('수식 확인: ' + m);
  }
  if (o.p.length > 3 || o.a.length > 3) throw new Error('파츠, 증강은 셋까지: ' + txt);
  return o;
}
const teamOf = (o) => [0, 1, 2, 3, 4].map((i) => (i === 2 ? o : { t: TEAM[i < 2 ? i : i - 1], p: [], a: [], evo: 1, sk: zero() }));
const names = [REF, ...(val('--cand') || '').split(',').filter((x) => x && x !== REF)];
const cfgs = names.map((nm) => ({ nm, spec: teamOf(parse(nm)) }));
// 기준 무기의 가짜 공격력 마디 (x = ln(1 + d))
const knots = [[0, REF]];
for (const nm of names) { const m = nm.match(new RegExp('^' + REF + '\\+d(\\d+(\\.\\d+)?)$')); if (m) knots.push([Math.log(1 + m[1] / 100), nm]); }
knots.sort((a, b) => a[0] - b[0]);

const errors = [];
const { gm, pad, lpad, fnvStr } = L;
(async function main() {
  const t0 = Date.now();
  const job = (c, sk, guess) => ({ key: c.nm + '|' + sk, cost: L.COST[sk], msg: { spec: c.spec, sk, s0: S0, N, jit: JIT, guess } });
  const R1 = await L.runJobs(__filename, SC.map((sk) => job(cfgs[0], sk, 300)).sort((a, b) => b.cost - a.cost), '기준', errors);
  const refM = (sk) => { const r = R1.get(REF + '|' + sk); return r && !r.fail ? Math.exp(r.lnM) : 300; };
  const R2 = await L.runJobs(__filename, cfgs.slice(1).flatMap((c) => SC.map((sk) => job(c, sk, refM(sk)))).sort((a, b) => b.cost - a.cost), '후보', errors);
  const res = new Map([...R1, ...R2]);
  let sims = 0; for (const r of res.values()) if (r) sims += r.sims;
  const ok = (r) => r && !r.fail;
  const out = [];
  out.push('도형 디펜스 섞인 팀 한 칸 세기 리포트 (tools/team_eq.js)');
  out.push(`생성: ${new Date().toISOString()}  시드 ${S0}..${S0 + N - 1}, 체력 흔들기 ±${JIT} (ln), 목표 비율 ${T}, 소요 ${((Date.now() - t0) / 60000).toFixed(1)}분, 시뮬레이션 ${sims}판, 워커 ${os.cpus().length}개`);
  out.push('');
  out.push(`[방법] 팀 = [${TEAM[0]}, ${TEAM[1]}, W, ${TEAM[2]}, ${TEAM[3]}], 모두 진화 0강. 칸 2 의 W 만 바꾼다. 시나리오는 bench.js 와 같다(워밍업 10초 + 측정 120초, 기지는 죽지 않음).`);
  out.push(`  R = M*(후보 팀) / M*(기준 팀, W = ${REF}). M* = 팀이 "무기 없을 때 피해의 ${T * 100}%"만 받는 적 체력 배수 (skill_eq.js 와 같은 방법).`);
  if (knots.length > 1) out.push(`  환산 = ${REF} 공격력 가짜 마디 (${knots.slice(1).map((k) => k[1]).join(', ')}) 의 ln M* 꺾은선에서 같은 M* 가 되는 ${REF} 공격력 증가 (%). "!" = 마디 밖이라 끝 구간을 늘여 읽음.`);
  out.push('');
  out.push('[기준 팀의 M*] ' + SC.map((sk) => { const r = res.get(REF + '|' + sk); return `${sk} ${ok(r) ? Math.exp(r.lnM).toPrecision(4) : r ? r.fail : 'ERR'}`; }).join('  '));
  out.push('');
  const conv = (sk, y) => {     // 꺾은선 읽기
    const pts = knots.map(([x, nm]) => { const r = res.get(nm + '|' + sk); return ok(r) ? [x, r.lnM] : null; }).filter(Boolean);
    if (pts.length < 2) return null;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; if ((y - y0) * (y - y1) <= 0 && y1 !== y0) return { x: x0 + (x1 - x0) * (y - y0) / (y1 - y0) }; }
    const lo = y < pts[0][1], [p0, p1] = lo ? [pts[0], pts[1]] : [pts[pts.length - 2], pts[pts.length - 1]];
    return p1[1] !== p0[1] ? { x: p0[0] + (p1[0] - p0[0]) * (y - p0[1]) / (p1[1] - p0[1]), out: true } : null;
  };
  const hdr = '  ' + pad('후보', 30) + SC.map((sk) => lpad(sk, 7)).join('') + lpad('기하평균', 10) + (knots.length > 1 ? SC.map((sk) => lpad('환' + sk.slice(0, 2), 7)).join('') + lpad('환산', 8) : '') + lpad('오차%', 7);
  out.push('[R = M*(후보) / M*(기준)]' + (knots.length > 1 ? '  환xx = 시나리오별 환산 %, 환산 = 기하평균 R 을 같은 식으로 (마디 기하평균 꺾은선)' : ''));
  out.push(hdr);
  for (const c of cfgs) {
    const qs = SC.map((sk) => { const a = res.get(c.nm + '|' + sk), z = res.get(REF + '|' + sk); return ok(a) && ok(z) ? { R: Math.exp(a.lnM - z.lnM), se: Math.hypot(a.se || 0, z.se || 0), y: a.lnM } : { s: a ? a.fail || 'ERR' : 'ERR' }; });
    const good = qs.filter((q) => q.R != null), g = good.length === SC.length ? gm(good.map((q) => q.R)) : NaN;
    let line = '  ' + pad(c.nm, 30) + qs.map((q) => lpad(q.R != null ? q.R.toFixed(3) : q.s, 7)).join('') + lpad(isNaN(g) ? '-' : g.toFixed(3), 10);
    if (knots.length > 1) {
      line += SC.map((sk, i) => { const q = qs[i]; if (q.R == null) return lpad('-', 7); const v = conv(sk, q.y); return lpad(v ? Math.round((Math.exp(v.x) - 1) * 100) + (v.out ? '!' : '') : '-', 7); }).join('');
      // 기하평균 R 의 환산: 마디마다 기하평균 R 을 구해 같은 꺾은선 읽기
      const kp = knots.map(([x, nm]) => { const rs = SC.map((sk) => { const a = res.get(nm + '|' + sk), z = res.get(REF + '|' + sk); return ok(a) && ok(z) ? Math.exp(a.lnM - z.lnM) : NaN; }); return [x, Math.log(gm(rs))]; }).filter((p) => isFinite(p[1]));
      let gx = null, gout = false; const y = Math.log(g);
      if (isFinite(y) && kp.length > 1) {
        for (let i = 1; i < kp.length && gx == null; i++) { const [x0, y0] = kp[i - 1], [x1, y1] = kp[i]; if ((y - y0) * (y - y1) <= 0 && y1 !== y0) gx = x0 + (x1 - x0) * (y - y0) / (y1 - y0); }
        if (gx == null) { const lo = y < kp[0][1], [p0, p1] = lo ? [kp[0], kp[1]] : [kp[kp.length - 2], kp[kp.length - 1]]; if (p1[1] !== p0[1]) { gx = p0[0] + (p1[0] - p0[0]) * (y - p0[1]) / (p1[1] - p0[1]); gout = true; } }
      }
      line += lpad(gx != null ? (Math.round((Math.exp(gx) - 1) * 100) >= 0 ? '+' : '') + Math.round((Math.exp(gx) - 1) * 100) + '%' + (gout ? '!' : '') : '-', 8);
    }
    line += lpad(good.length ? (Math.max(...good.map((q) => q.se)) * 100).toFixed(1) : '-', 7);
    out.push(line);
  }
  out.push('');
  const digest = fnvStr(JSON.stringify([...res.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, r]) => [k, r && (r.fail || r.lnM.toFixed(12))])));
  out.push(`[결정성] 결과 해시 ${digest.toString(16)} (같은 입력이면 같아야 한다)`);
  out.push(`[오류] ${errors.length}건`, ...errors.slice(0, 10));
  const rp = path.join(__dirname, TAG ? `team_eq_report_${TAG}.txt` : 'team_eq_report.txt');
  fs.writeFileSync(rp, out.join('\n') + '\n');
  console.log(out.join('\n'));
  console.log('\n저장:', rp);
  process.exit(0);
})();

'use strict';
/* 등가 화력 도구(tools/skill_eq.js, tools/item_eq.js)가 같이 쓰는 부분.
   findM: 팀이 "무기 없을 때 새는 피해의 45%"만 새게 버티는 적 체력 배수 M* 를 찾는다 (구간 잡기 + 이분법 + 7점 직선 맞춤).
   runJobs: CPU 수만큼 워커를 띄워 작업을 나눠 돌린다 (워커 파일은 부르는 도구 자신).
   부르는 쪽이 먼저 B.init() 을 해 둬야 한다 (bench.js 는 모듈이 하나라 같은 Core 를 쓴다). */
const { Worker } = require('worker_threads');
const os = require('os');
const B = require('./bench.js');           // 시나리오, 한 판 시뮬레이션(runSim), 목표 비율을 그대로 쓴다

const T = B.TARGET;                         // 0.45: 무기 없을 때 피해 대비 비율
const PREC = 0.02;                          // 이분법을 멈추는 구간 폭 (ln M)
const D = 0.025, K = 3;                     // 마지막 직선 맞춤: x0 ± K*D 에서 2K+1 점 (ln M, 약 ±7.5%)
const STEP0 = Math.log(1.6);                // 처음 구간 넓히는 폭
const LNMIN = Math.log(1e-2), LNMAX = Math.log(1e7);

/* ---------- (팀, 시나리오) 하나의 M* 찾기 ---------- */
const noneMemo = new Map();
function noneLeak(sk, s0, N, jit) {
  const k = sk + '|' + s0 + '|' + N + '|' + jit;
  if (!noneMemo.has(k)) { let l = 0; for (let s = s0; s < s0 + N; s++) l += B.runSim(B.NONE, sk, s, 1, jit).leak; noneMemo.set(k, l); }
  return noneMemo.get(k);
}
function findM(spec, sk, s0, N, jit, guess) {
  const nl = noneLeak(sk, s0, N, jit), memo = new Map();
  let sims = 0;
  const f = (x) => {
    const key = x.toFixed(9);
    if (memo.has(key)) return memo.get(key);
    let l = 0; for (let s = s0; s < s0 + N; s++) l += B.runSim(spec, sk, s, Math.exp(x), jit).leak;
    sims += N; const r = l / nl; memo.set(key, r); return r;
  };
  // 1) 구간 잡기
  let x = Math.log(guess), st = STEP0, lo, hi;
  if (f(x) > T) { hi = x; lo = x - st; while (f(lo) > T) { hi = lo; st *= 1.5; lo -= st; if (lo < LNMIN) return { fail: 'low', sims }; } }
  else { lo = x; hi = x + st; while (f(hi) <= T) { lo = hi; st *= 1.5; hi += st; if (hi > LNMAX) return { fail: 'high', sims }; } }
  // 2) 이분법
  while (hi - lo > PREC) { const m = (lo + hi) / 2; if (f(m) > T) hi = m; else lo = m; }
  const x0 = (lo + hi) / 2;
  // 3) 계단 완화: 중심 c 주변 2K+1 점에 직선을 맞춰 목표 비율이 되는 곳을 구한다
  const fitAt = (c) => {
    const xs = [], ys = [];
    for (let j = -K; j <= K; j++) { xs.push(j * D); ys.push(f(c + j * D)); }
    const n = xs.length, mx = xs.reduce((a, v) => a + v, 0) / n, my = ys.reduce((a, v) => a + v, 0) / n;
    let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
    const b = sxy / sxx, a = my - b * mx;
    const dx = b > 1e-6 ? (T - a) / b : 0;
    let ss = 0; for (let i = 0; i < n; i++) ss += (ys[i] - (a + b * xs[i])) ** 2;
    const sr = Math.sqrt(ss / (n - 2));
    const se = b > 1e-6 ? (sr / b) * Math.sqrt(1 / n + (dx - mx) ** 2 / sxx) : NaN;   // 맞춤의 표준오차 (ln M). 계단이 남은 정도를 보여 준다
    return { dx, b, se };
  };
  // 답이 창 밖이면 창을 그쪽으로 옮겨 다시 맞춘다 (최대 3번). 그래도 밖이면 창 끝에서 자르고 "!" 로 표시
  let c = x0, fit = fitAt(c), tries = 0;
  while (Math.abs(fit.dx) > K * D && tries < 3) { c += Math.sign(fit.dx) * K * D; fit = fitAt(c); tries++; }
  const clamped = Math.abs(fit.dx) > K * D;
  const dx = clamped ? Math.sign(fit.dx) * K * D : fit.dx;
  return { lnM: c + dx, x0, slope: fit.b, se: fit.se, clamped, moved: tries, sims };
}

/* ---------- 작업 실행기 (bench.js 와 같은 방식: CPU 수만큼 워커) ----------
   file = 워커로 띄울 도구 파일(__filename), jobs = [{key, msg}], errors = 오류를 모을 배열 -> Map(key -> 결과) */
async function runJobs(file, jobs, label, errors) {
  const out = new Map(), n = Math.min(jobs.length, Math.max(1, os.cpus().length));
  const pool = Array.from({ length: n }, () => new Worker(file));
  let next = 0, done = 0, id = 0; const t0 = Date.now();
  await Promise.all(pool.map((w) => new Promise((resolve) => {
    const feed = () => {
      if (next >= jobs.length) { resolve(); return; }
      const j = jobs[next++];
      w.once('message', (m) => {
        if (m.err) { errors.push(j.key + ' -> ' + m.err); out.set(j.key, null); } else out.set(j.key, m.res);
        done++; if (done % 10 === 0 || done === jobs.length) process.stderr.write(`[${label}] ${done}/${jobs.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
        feed();
      });
      w.postMessage(Object.assign({ id: id++ }, j.msg));
    };
    feed();
  })));
  for (const w of pool) w.terminate();
  return out;
}

/* ---------- 리포트 도우미 ---------- */
const COST = { swarm: 6, mix: 3, boss: 2, few: 1.5, early: 1 };    // 시나리오별 대략의 작업 비용 (오래 걸리는 작업부터 돌려 부하를 고르게)
const gm = (a) => Math.exp(a.reduce((s, v) => s + Math.log(v), 0) / a.length);
const width = (s) => [...s].reduce((a, c) => a + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);   // 한글은 두 칸
const pad = (s, n) => { s = String(s); return s + ' '.repeat(Math.max(0, n - width(s))); };
const lpad = (s, n) => { s = String(s); return ' '.repeat(Math.max(0, n - width(s))) + s; };
function fnvStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; return h >>> 0; }

module.exports = { T, PREC, D, K, STEP0, LNMIN, LNMAX, noneLeak, findM, runJobs, COST, gm, pad, lpad, fnvStr };

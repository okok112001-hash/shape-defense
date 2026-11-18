'use strict';
/* 수치 가치 환산 계산기. 화력 가치 1 = 그 무기의 공격력 +1%. 설명은 docs/value.md, 쓰는 법은 tools/README.md 의 "수치 가치 환산" 절.
   항목을 core.js 의 진짜 능력치(stats)에 적용한 뒤, 무기마다 "적을 얼마나 빨리 잡는가"(처치 속도 E)를 식으로 계산하고
   같은 E 를 내는 공격력 증가량으로 바꾼다. 식의 계수(적 밀도, 처치 타수, 보스 비중, 군중 제어 계수 ...)는 측정값으로 한 번 맞춰 tools/value_cal.json 에 둔다.
   사용:
     node tools/value.js                  가치 표와 예산 밖 목록 (tools/value_report.txt)
     node tools/value.js fit              측정값으로 계수를 다시 맞추고 예측과 측정을 비교 (tools/value_cal.json, tools/value_fit.txt)
     node tools/value.js item <id> [등급] [무기]   항목 하나 (시나리오별)
     node tools/value.js line <무기>.<줄> [배율]  스킬 줄 하나 (랭크별 누적, 배율 sc 를 바꿔 볼 수 있다)
     node tools/value.js holdout          표본 밖 확인 (항목을 둘로 나눠 한쪽으로 맞추고 다른 쪽을 예측)
   환경변수 VALUE_CORE=경로: 다른 core.js 로 계산 (수치를 바꿔 보기) */
const path = require('path');
const fs = require('fs');
const Core = require(process.env.VALUE_CORE || path.join(__dirname, '..', 'src', 'core.js'));
const { CFG, WEAPONS, WEAPON_IDS, PARTS, AUGS, SKILLS, ENEMIES } = Core;
const B = require('./bench.js');              // 시나리오 정의 (SCEN) 만 쓴다
const H = 520, LW = Core.LW, LANES = Core.LANES, AREA = LW * H;
const CAL_FILE = path.join(__dirname, 'value_cal.json');
const CTX = ['few', 'swarm', 'mix', 'boss', 'early'];
const CTX_KO = { few: '정예', swarm: '물량', mix: '표준', boss: '보스전', early: '초반' };
const GR = ['일반', '희귀', '영웅', '전설'];
const GRADE_RATIO = [0.25, 0.5, 1, 2.5];      // 등급 예산 (영웅 = 1)

/* ---------- 시나리오(시간대) 기본 성질: 적 구성에서 바로 계산 ---------- */
// lam0 = 적이 하나도 죽지 않을 때 레인 하나에 있는 적 수, beta0 = 체력 기준 대형 적(육각형)+보스 비중, betaB = 보스만의 비중, v = 평균 속도(px/초)
const DEFW = Core.BAL.spawnWeights(600);
const CB = {};
for (const c of CTX) {
  const sc = B.SCEN[c], w = sc.w || DEFW, tw = w.reduce((a, b) => a + b, 0), per = sc.rate / LANES;
  let cnt = 0, hp = 0, hv = 0, lam = 0, vs = 0;
  ['basic', 'runner', 'swarm', 'heavy'].forEach((t, i) => {
    const E = ENEMIES[t], r = per * (w[i] / tw) * (t === 'swarm' ? 4 : 1);   // 레인 하나에 1초마다 나오는 수
    cnt += r; hp += r * E.hp; if (t === 'heavy') hv += r * E.hp; lam += r / E.speed; vs += r * E.speed * H;
  });
  let bh = 0;
  if (sc.boss) { bh = ENEMIES.giant.hp / sc.boss / LANES; lam += 1 / sc.boss / LANES / ENEMIES.giant.speed; }
  CB[c] = { lam0: lam, beta0: (hv + bh) / (hp + bh), betaB: bh / (hp + bh), v: vs / cnt, spawn: cnt * LANES, hpAvg: hp / cnt };
}

/* ---------- 계수 (영점에서 맞춘다) ---------- */
// c: 시나리오마다, w: 무기마다, m: 스킬 기구 계수, x: 기지 항목의 교환 비율
function defaults() {
  const c = {}, w = {};
  const K0 = { few: 6, swarm: 1.5, mix: 3, boss: 3.5, early: 2.5 };
  for (const k of CTX) c[k] = { lf: 0.6, K: K0[k], cc: 0.5, phi: 1, bf: 1 };
  for (const t of WEAPON_IDS) w[t] = { kw: 1, dw: 1, kr: 1, kg: 0.6, ccw: 1, bw: 1, vt: 0.3 };
  return { c, w, m: { orb: 1, fld: 1, crush: 1, flame: 1, mine: 1, sea: 1, carpet: 1, shock: 1, spray: 1.07, efield: 0.488, arc: 0.596, ball: 0.586, ovk: 0.5, ovkA: 0.55, stk: 1.8, stkT: 0.37, burst: 1.05, mk: 0.74, xf: 3.9, crk: 1.32, rain: 0.954, slime: 0.548, dsv: 0.312, rot: 0.050 }, x: { aF: 0.8, aS: 0.5, aG: 1.6, Treg: 250, gLuck: 6 } };
}
let P = defaults();
if (fs.existsSync(CAL_FILE)) { const j = JSON.parse(fs.readFileSync(CAL_FILE, 'utf8')); for (const k of ['c', 'w', 'm', 'x']) if (j[k]) for (const a in j[k]) P[k][a] = typeof j[k][a] === 'object' ? Object.assign(P[k][a] || {}, j[k][a]) : j[k][a]; }

/* ---------- 능력치 만들기 (core.js 의 stats 그대로) ---------- */
const zeroSk = () => [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
function statsOf(type, o) {
  o = o || {};
  Core.newGame(H);
  const S = Core.S; S.slots = [null, null, null, null, null];
  const w = Core.newWeapon(type); w.lv = o.lv != null ? o.lv : 40;
  (o.p || []).forEach((q, i) => { w.parts[i] = { id: q[0], g: q[1] }; });
  (o.a || []).forEach((q, i) => { w.augs[i] = { id: q[0], g: q[1] }; });
  if (o.evo) { w.evo = true; w.lv = 0; w.hi = 0; w.sk = (o.sk || zeroSk()).map((r) => r.slice()); w.skp = 20; }
  if (o.base) (o.base.p || []).forEach((q, i) => { S.base.parts[i] = { id: q[0], g: q[1] }; });
  if (o.base) (o.base.a || []).forEach((q, i) => { S.base.augs[i] = { id: q[0], g: q[1] }; });
  S.base._s = null;
  S.slots[2] = w; Core.dirty(w);
  return Object.assign({}, Core.stats(w));
}
// 배치: 운반 무기가 있는 칸 (X2 = 1, 3번 칸, I5 = 다섯 칸). sides = 옆 레인 수 평균, outer = 무지개가 더 덮는 레인 수 평균
const LAY = {};
function mkLay(name, slots, share) {
  const sides = slots.reduce((a, s) => a + (s > 0) + (s < LANES - 1), 0) / slots.length;
  const outer = slots.reduce((a, s) => a + Math.max(0, s - 1) + Math.max(0, LANES - 2 - s), 0) / slots.length;
  LAY[name] = { name, slots, sides, outer, share };
}
mkLay('X2', [1, 3], 0.4); mkLay('I5', [0, 1, 2, 3, 4], 1); mkLay('P5', [0, 1, 2, 3, 4], 1);
mkLay('ONE', [2], 0.25);   // 표의 기본: 다섯 자루 팀에서 가운데 한 자루가 운반 (운반 무기 피해 비율 25% 가정)

/* ---------- 작은 식들 ---------- */
const nIn = (lam, area) => lam * area / AREA;                         // 레인 밀도 lam 에서 넓이(px²) 안 적 수 기대값
const cond = (mu) => (mu < 1e-6 ? 1 : mu / (1 - Math.exp(-mu)));       // 적어도 하나 있을 때의 평균 (포아송)
function atLeast(mu, i) { let p = Math.exp(-mu), c = p; for (let j = 1; j < i; j++) { p *= mu / j; c += p; } return Math.max(0, 1 - c); }
function pierceHits(p, pk, mu) { let s = 0, f = 1; for (let i = 1; i <= Math.min(p, 60); i++) { f *= pk; s += f * atLeast(mu, i); } return s; }   // 관통: 뒤의 적에게 더 맞는 양
const occ = (mu) => 1 - Math.exp(-mu);                                // 적이 하나라도 있을 확률
// 최대 타격 수 n (core.js 의 st.cap): 포아송 적 수 X 에서 E[min(X, n)], 적어도 하나 있을 때의 E[min(X, n) | X >= 1]
function capE(mu, n) { if (!(n < 1e8) || mu < 1e-9) return mu; let s = 0; for (let i = 1; i <= n; i++) { const a = atLeast(mu, i); s += a; if (a < 1e-12) break; } return s; }
const capC = (mu, n) => (mu < 1e-6 ? 1 : capE(mu, n) / occ(mu));
// 조준 레이저 (T9e): 같은 표적을 x 번 쏠 때 [평균 겹, 겹이 다 찬 발의 비율]. 시작 겹 = 앞 표적이 죽을 때의 겹 x f (정상 상태)
function stackRun(x, f) {
  const MX = Core.MARK_MAX, n = Math.max(1, x), m = Math.ceil(n);
  let s0 = 0; if (f > 0) for (let k = 0; k < 30; k++) s0 = f * Math.min(MX, s0 + n);
  let sum = 0, full = 0;
  for (let i = 1; i <= m; i++) { const w = i <= n ? 1 : n - (i - 1), s = Math.min(MX, s0 + i); sum += w * s; if (s >= MX - 1e-9) full += w; }
  return [sum / n, full / n];
}
// 처치 타수 n(X): 끊김 없는 타수 X 에 마지막 탄의 낭비(평균 반 발)를 더하고, 한 방(1발) 밑으로는 내려가지 않게 부드럽게
const nSoft = (x) => 0.5 * (x + 1.5 + Math.sqrt((x - 0.5) * (x - 0.5) + 0.05));
// 문턱 효과(처형, 선제, 즉사): 체력 1 의 적을 한 발 1/X 로 깎을 때 필요한 (끊김 없는) 타수
function thrHits(X, ex, fi, thr) {
  if (!ex && !fi && !thr) return X;
  let f = 1, n = 0; const d = 1 / X;
  for (let i = 0; i < 2000 && f > 1e-9; i++) {
    let m = 1; if (fi && f >= 0.7) m *= 1 + fi; if (ex && f <= 0.5) m *= 1 + ex;
    const dd = d * m;
    if (f - dd <= thr) { n += Math.max(0, f - thr) / dd; break; }
    f -= dd; n += 1;
  }
  return n;
}
function killHits(X, st, bb, thrX) {     // 흔들기(×0.7, ×1, ×1.43) 평균. bb = 보스 비중(즉사 문턱이 안 듣는다)
  const thr = Math.max(st.vap || 0, thrX || 0);
  let s = 0;
  for (const f of [0.7, 1, 1.43]) {
    const x = X * f, a = nSoft(thrHits(x, st.execPct, st.firstPct, thr)), b = thr ? nSoft(thrHits(x, st.execPct, st.firstPct, 0)) : a;
    s += (1 - bb) * a + bb * b;
  }
  return s / 3;
}

/* ---------- 처치 속도 모형 ---------- */
// E = (직접 피해 x 낭비 보정 + 지속 피해) x 군중 제어 x 취약. 단위는 상대값이라 같은 무기끼리 비율만 의미가 있다.
// ref: 같은 무기의 맨 능력치 (처치 타수의 기준), lay: 배치
function model(st, ref, c, lay, PP) {
  PP = PP || P;
  const t = st.type, W0 = WEAPONS[t], cb = CB[c], pc = PP.c[c], pw = PP.w[t], pm = PP.m;
  const lam = cb.lam0 * pc.lf * pw.dw;
  const N = st.cap;   // 범위 공격의 최대 타격 수 (제한 없는 무기는 core.js 의 CAP_NONE)
  const beta = Math.min(0.98, cb.beta0 * pc.bf * pw.bw), bb = cb.betaB;
  const rate = Math.pow(W0.cd / st.cd, pw.kr) / W0.cd * (1 + st.dbl) * (1 + st.ramp * 0.85);   // 공격 속도 효율 kr. 과열 엔진: 쉬지 않고 쏠 때 최대치의 약 85%
  const r = st.range;
  // 한 번 맞힐 때의 피해 배수 기댓값
  const near1 = (rr) => (r > 0 ? occ(lam * rr) / Math.max(1e-6, occ(lam * r)) : 0);   // 가장 가까운 적이 기지에서 rr 안에 있을 확률
  const farSh = t === 'laser' ? Math.max(0, (r - 0.3) / r) : t === 'rail' || t === 'acid' ? 0.7 : t === 'pulse' ? 0 : t === 'mortar' ? 0.15 : Math.max(0, 1 - near1(0.3));
  const closeSh = t === 'laser' ? Math.min(1, 0.35 / r) : t === 'pulse' ? 1 : t === 'rail' || t === 'acid' ? 0.35 : t === 'mortar' ? 0.8 : near1(0.35);
  let q = 1 + st.crit * (1 + st.critDmg);
  if (st.gamble) q *= 0.5 + (st.gamble - 0.5) / 2;
  q *= 1 + beta * st.bossPct;
  q *= 1 + Math.min(1, farSh * pc.phi) * st.farPct;
  q *= 1 + closeSh * st.closePct;
  const q0 = 1 + ref.crit * (1 + ref.critDmg);
  const tf = (t === 'blaster' || t === 'shotgun' || t === 'tesla') ? Math.pow(r / W0.range, pw.kg) : 1;   // 사거리: 머무는 시간
  let dir = 0, dot = 0, burnN = 0, hsz = 1, sig = [], stk = null, cy = null;   // hsz: 주 공격 한 발 크기 배수 (특수 탄 평균)
  const splashN = (R) => nIn(lam, Math.PI * R * R);
  const sides = lay.sides;
  // 군중 제어: 같은 적을 다시 맞히는 간격 tau 에서 둔화/기절/밀치기를 '느려진 비율' sigma 로 바꾼다
  // cov: 범위 안 적 중 실제로 맞는 비율 (최대 타격 수 때문에 레이저·펄스는 적이 많으면 일부만 맞는다. T8)
  const ccHit = (tau, kn, cov = 1) => {
    if (st.slow) sig.push(cov * st.slow * Math.min(1, 1.5 / tau) * (1 - 0.5 * bb));
    if (st.stun) sig.push(cov * Math.min(0.9, st.stun * 0.8 / tau) * (1 - bb));
    if (kn) sig.push(cov * Math.min(0.9, kn / (cb.v * tau)) * (1 - bb));
    if (st.freeze) sig.push(cov * (Math.min(0.9, st.freeze / tau) * (1 - bb) + bb * 0.4 * Math.min(1, 1 / tau)));
  };
  const covOf = (mu) => (mu > 1e-6 ? capE(mu, N) / mu : 1);
  const tau = st.cd / (1 + st.dbl), Rv0 = cb.v;   // Rv0: 적의 평균 속도 (px/초)
  switch (t) {
    case 'blaster': {
      const extraL = Math.max(0, st.lanes - W0.lanes);
      const busy = occ(lam * r * (1 + Math.min(extraL, 4) * 0.5));
      const muB = lam * r * 0.8;
      const one = 1 + pierceHits(st.pierce, st.pk, muB);
      let hits = one + st.shots * (st.shotMul || CFG.extraShotMul) * 0.9 * one;
      if (st.split) hits += st.split * 0.35 * occ(nIn(lam, 240 * 48));
      if (st.splash) hits += st.splash * splashN(62 * (1 + st.areaPct));
      let shot = hits;
      if (st.gnt) {   // 거대탄: gntEvery 번째마다, 레인의 모든 적 (관통마다 x0.85)
        const ge = st.gntEvery || 4;
        let g = 0, f = 1; for (let i = 0; i < 40; i++) { g += f * atLeast(lam * 1.1, i + 1); f *= 0.85; }
        shot = ((ge - 1) * hits + st.gntM * g) / ge; hsz = (ge - 1 + st.gntM) / ge;
      }
      dir = rate * shot * busy * tf;
      burnN = rate * one * busy * tf;
      if (st.tur) {   // 보조 포탑 (쌍포탑: 둘, 맞으면 작은 폭발)
        const n = st.turTwin ? 2 : 1, bs = occ(lam * r) * Math.min(1, sides / n);
        const per = st.turD * (1 + st.turRate) * bs * (1 + (st.turTwin ? 0.4 * splashN(45) : 0));
        dir += rate / (1 + st.dbl) * n * per * tf;
      }
      if (st.warm) dir *= 1 + st.warmR * 9 * busy;
      if (st.spray) {   // 난사 (T9c): 탄띠 ON 초어치를 x spray 로 쏘고 RL 초 재장전. 탄띠는 쏠 때만 줄어 재장전이 적 없는 시간과 겹치면 덜 손해 (적이 있을 확률 busy)
        const A = st.spray * Core.SPRAY_ON / (Core.SPRAY_ON + Core.SPRAY_RL * busy), f = Math.pow(A, pw.kr) * pm.spray;
        dir *= f; burnN *= f;
      }
      ccHit(st.spray ? tau / (st.spray * Core.SPRAY_ON / (Core.SPRAY_ON + Core.SPRAY_RL)) : tau, st.knock);
      break;
    }
    case 'shotgun': {
      let lanesN = 0; for (const s of lay.slots) lanesN += Math.min(LANES - 1, s + st.lanes) - Math.max(0, s - st.lanes) + 1; lanesN /= lay.slots.length;
      const bs = occ(lam * r), muB = lam * r * 0.6;
      const pel = 1 + pierceHits(st.pierce, st.pk, muB);
      let hits = lanesN * bs * (pel + st.shots * CFG.extraShotMul * 0.9 * pel);
      if (st.splash) hits += lanesN * bs * st.splash * splashN(62 * (1 + st.areaPct));
      const ag = 1 + st.again;
      dir = rate * hits * ag * tf;
      burnN = rate * lanesN * bs * pel * ag * tf;
      if (st.slug) {   // 슬러그: slugEvery 번째마다 정면(쌍열: 3레인) 관통 대형 탄
        const sl = st.slugTwin ? Math.min(3, lanesN) : 1;
        let g = 0, f = 1; for (let i = 0; i < 40; i++) { g += f * atLeast(lam * 1.1, i + 1); f *= 0.85; }
        dir += rate / st.slugEvery * sl * st.slug * g;
        const slugT = st.slugEvery * tau;   // 같은 적이 슬러그를 맞는 간격 (밀치기는 1초에 한 번)
        sig.push(Math.min(0.9, st.slugKn / (cb.v * Math.max(1, slugT))) * (1 - bb) * Math.min(1, sl / lanesN));
        if (st.slugStun) sig.push(Math.min(0.9, st.slugStun / slugT) * (1 - bb) * Math.min(1, sl / lanesN));
      }
      if (st.dragon) {   // 용 머리: 5번째마다 정면 레인 끝까지 모든 적 (줄지 않음). 화상은 붙이지 않는다 (T6)
        const g = lam * 1.1 + 0.3;
        dir += rate / 5 * st.dragon * g;
      }
      if (st.flame) dot += burnN * st.flame * Math.min(3, tau) * pm.flame;   // 화염 산탄: 맞은 적마다 공격력 x flame 초당, 3초. 화상은 쌓이지 않아(가장 센 것 하나) 여러 자루가 겹치면 덜 센다 (flame 계수)
      if (st.sea) {   // 불바다: 탄 길의 먼 절반에 2초 불길 (레인마다 최대 3줄)
        const inStrip = capE(nIn(lam, 36 * r * H * 0.5), N) * 1.5 * pm.sea;
        dot += lanesN * st.sea * inStrip * Math.min(1, 2 / tau);
      }
      if (st.mine) {   // 지뢰: mineCd 초마다, 밟으면 반경 60 폭발
        const every = Math.max(0.5, st.mineCd), per = (1 + splashN(60 * (1 + st.areaPct))) * pm.mine;
        let m = st.mine * per / every * Math.min(1, st.mineMax * every / 12 + 0.5);
        if (st.mineChain) m *= 1 + 2 * 0.4 * occ(splashN(40)) ;
        dir += m;
        if (st.mineChain) sig.push(Math.min(0.5, 20 * per / every / (cb.v * Math.max(1, lam * r)) ) * (1 - bb));
      }
      ccHit(tau, st.knock);
      break;
    }
    case 'laser': {
      const mu = lam * r * (1 + 2 * st.lanes), n = capC(mu, N), muC = capE(mu, N);
      const m3 = st.third ? 1 + st.third / 3 : 1;
      let hits = (n + st.lens) * m3;
      if (st.third) hsz = 1 + st.third / 3;
      if (st.orbit) hits += st.orbit * m3 * capC(lam, N) * occ(lam * 4);
      if (st.prism) { const above = capE(lam * r * 0.5, N); hits += m3 * (st.prism + st.prismUp) * above * (sides + (st.rainbow ? 0.6 * lay.outer : 0)); }
      if (st.holdT && !st.always) { const k = Math.round(st.holdT / 0.1); hits += k * st.holdD * (n + st.lens) * (1 + st.focus * (k - 1) / 2); }
      dir = rate * hits;
      burnN = rate * n;
      if (st.always) dir += (1 / st.cd) * st.alwaysM * (muC + st.lens) * (1 + st.focus * 15);
      if (st.melt) { dot += st.melt * muC * Math.min(1, st.meltT / tau); if (st.meltSlow) sig.push(st.meltSlow * Math.min(1, st.meltT / tau) * (1 - 0.5 * bb)); }
      ccHit(tau, st.knock, covOf(mu));
      break;
    }
    case 'pulse': {
      const R = st.radius, mu = nIn(lam, Math.PI * R * R / 2), n = capC(mu, N);
      const ech = 1 + st.echo;
      let hits = n * ech;
      if (st.nova) {
        const R2 = R * st.novaR, n2 = capC(nIn(lam, Math.PI * R2 * R2 / 2), N), e = st.novaEvery;
        const nv = st.nova * n2 * (1 + (st.twinStar ? 0.7 : 0));
        hits = ((e - 1) * n * ech + nv) / e;
        if (st.halo) dot += st.halo * capE(nIn(lam, Math.PI * R2 * R2 / 2), N) * Math.min(1, 1.5 / (e * tau));
      }
      dir = rate * hits;
      burnN = rate * n;
      if (st.counter) dir += Math.min(2, cb.spawn * 0.45 * 0.6) * n;   // 반격: 적이 기지에 닿을 때마다 (0.5초에 한 번)
      if (st.orbs) {   // 위성 구체: 궤도 띠(폭 약 60) 안의 적과 닿는 비율
        const Ro = R * 0.85 * st.orbRad, cr = 18 * st.orbSize + 11;
        const band = nIn(lam, Math.PI * Ro * 2 * cr) * (2 * cr) / (Math.PI * Ro) * 1.6 * pm.orb;
        dot += st.orbs * st.orbDps * band;
        if (st.orbChain && st.orbs > 1) { const segs = st.orbs === 2 ? 1 : st.orbs; dot += segs * st.orbDps * st.orbChainD * band * 0.8; sig.push(Math.min(0.5, 0.15 * segs * band / Math.max(1, mu)) * (1 - bb)); }
      }
      if (st.fld) sig.push(Math.min(0.6, st.fld / 100 * 0.12 * pm.fld) * (1 - 0.5 * bb));   // 역장: 끌어당겨 무기 앞에 모은다 (머무는 시간으로 본다)
      if (st.fldDps) { const Rf = R * 1.5; dot += st.fldDps * capE(nIn(lam, Math.PI * Rf * Rf / 2) * pm.crush, N); }   // 압착 (T6): 역장 안 적에게 지속 피해
      ccHit(tau, st.knock, covOf(mu));
      break;
    }
    case 'mortar': {
      const R = st.blast, around = (Rr) => capE(splashN(Rr) * 0.7, N - 1), nb = 1 + around(R);   // 표적 하나 + 둘레의 적 (최대 타격 수까지)
      const lane = (Rr) => capE(splashN(Rr) * 0.9, N);   // 표적 없이 떨어지는 폭탄 (융단 폭격 둘째부터, 공습의 다른 레인)
      // 보통 차례 한 발: 피해 합(D 단위)과, 파편·집속·화염이 따라붙는 폭발의 피해 합(sc)
      let one = nb, sc = 1;
      if (st.carpet) { const Rc = R * 0.8; one = st.carpetD * (1 + around(Rc) + (st.carpet - 1) * lane(Rc) * pm.carpet); sc = st.carpetD * st.carpet; hsz = st.carpetD; }   // 한 발이 작아 처치 타수가 는다
      const mirv = st.mirv ? st.mirv * st.mirvD * (1 + around(R * 0.5)) * occ(nIn(lam, Math.PI * 260 * 260 / 2)) : 0;   // 분리 탄두 (주변에 적이 있을 때)
      const tw = 1 + st.mslTwin;                          // 쌍발: 둘째 미사일
      let shell = (one + mirv) * tw; sc *= tw;
      if (st.nuke) {                                      // 핵탄두 차례 (nukeEvery 번째마다, 미사일이어도 1발)
        const e = st.nukeEvery, Rn = R * st.nukeR;
        const nk = st.nuke * (1 + around(Rn)) + mirv + (st.nShock ? st.nShock * capE(Math.max(0, splashN(2 * Rn) - splashN(Rn)) * 0.6, N) : 0);
        shell = ((e - 1) * shell + nk) / e; sc = ((e - 1) * sc + st.nuke) / e; hsz = ((e - 1) * hsz + st.nuke) / e;
        if (st.nShock) sig.push(Math.min(0.6, st.nShockKn / (cb.v * tau * e * 1.5)) * 0.5 * pm.shock * (1 - bb));   // 충격파 밀어내기: 앞쪽 적의 절반쯤
      }
      let ex = 0;
      if (st.cluster) ex += st.cluster * 0.8 * capE(splashN(R * 0.6) * 0.8, N);
      if (st.shrap) ex += st.shrap * 0.25 * occ(nIn(lam, 170 * 30));
      dir = rate * (shell + ex * sc);
      if (st.air) dir += st.air * Math.min(LANES, Math.max(1, lam * LANES)) * (1 + around(R * Core.AIR_R)) / Core.AIR_CD;   // 공습 (T10a): AIR_CD 초마다 표적(레인마다 가장 앞의 적, 빈 레인 몫은 다른 적)마다 1발 (발사 속도와 무관)
      burnN = rate * nb;
      if (st.pool) dot += rate * sc * st.pool * 3 * capE(splashN(R) * 0.7 + 0.5, N);
      ccHit(tau * 1.5, st.knock);
      break;
    }
    case 'tesla': {
      const reach = lam * r * (2 * st.lanes + 1), busy = occ(reach);
      const pHop = occ(nIn(lam, Math.PI * st.jump * st.jump) * 0.6), d = st.chainGrow ? 1 + st.chainGrow : 0.8;
      let N1 = 0, f = 1, p = 1; for (let j = 0; j <= st.chain; j++) { N1 += f * p; f *= d; p *= pHop; }
      let hits = N1;
      if (st.multi) for (let k = 1; k <= st.multi; k++) hits += 0.5 * N1 * atLeast(reach, k + 1);
      dir = rate * hits * busy * tf;
      burnN = rate * hits * busy * tf;
      // 전격기 스킬 (T5b). 낙뢰와 먹구름, 쌍구전 폭발은 직접 피해, 전기장, 줄, 구체는 지속 피해
      const allN = lam * LANES, Rv = cb.v;                     // 전장 전체의 적 수, 적의 속도 (px/초)
      const fire = rate * busy;                                // 초당 공격 수 (사거리 안에 적이 있을 때만 쏜다)
      const strikes = (st.th ? fire / 3 * capE(allN, st.th) : 0) + (st.cloud ? occ(allN) : 0);
      if (st.th) dir += fire / 3 * capE(allN, st.th) * st.thD;
      if (st.cloud) dir += occ(allN) * st.cloud;
      if (st.efD) {                                            // 전기장: 낙뢰 자리 반경 45, 2초. 맞은 적이 빠져나갈 때까지 + 지나가는 적
        const Re = 45 * (1 + st.areaPct) + 9.5;
        dot += strikes * st.efD * (Math.min(2, Re / Rv) + 2 * capE(nIn(lam, Math.PI * Re * Re), N)) * pm.efield;
      }
      if (st.arc) {                                            // 전기 줄: 연쇄된 적 사이 (같은 두 적이면 시간만 새로). 끝의 적과 줄에 닿는 적
        let cnt = 0, pp = 1; for (let j = 0; j <= st.chain; j++) { cnt += pp; pp *= pHop; }
        const segs = Math.max(0, cnt - 1), wd = 2 * (7 * st.arcW + 9.5), by = nIn(lam, st.jump * 0.6 * wd);
        const on = busy * Math.min(1, st.arcT / tau), dps = st.arc * (1 + st.arcHv);
        dot += on * dps * capE(cnt + segs * by, N * Math.max(1, segs)) * pm.arc;
        if (st.arcHv) dot += segs / Math.max(st.arcT, 2 * tau) * busy * dps * (0.5 + by) * pm.arc;   // 고압 방전: 사라질 때 닿아 있던 적
      }
      if (st.ball) {                                           // 구전: 4번째 공격마다 (쌍구전: 둘). 닿는 범위 안 적 수 x 지속 시간
        const nb = st.ballTwin ? 2 : 1, Rb = st.ballR * (1 + st.areaPct) + 9.5, per = fire / 4 * nb;
        dot += per * st.ballT * st.ball * capE(nIn(lam, Math.PI * Rb * Rb), N) * pm.ball;
        if (st.ballTwin) {
          const nB = capE(splashN(Core.BALL_BOOM_R * (1 + st.areaPct)), N);
          dir += per * st.ballBoom * nB;
          sig.push(Math.min(0.5, per * 0.8 * nB / Math.max(1, allN)) * (1 - bb));
        }
      }
      ccHit(tau * 1.3, st.knock);
      break;
    }
    case 'rail': {
      const behind = nIn(lam, 1.0 * H * 60) * 0.5;   // 표적 뒤 일직선 위 (폭 약 60)
      const X0 = pc.K * pw.kw * (13 / W0.dmg) * (ref.dmg * q0) / (st.dmg * q);   // 표적 하나를 잡는 타수 (아래 X 와 같은 식)
      // 주 표적 한 발 (T9e): 조준 레이저는 표적을 고정해 죽을 때까지 쏘므로 겹이 실제로 쌓인다. 같은 표적을 X0 번 쏠 때의 평균 겹 (보스는 오래 쏜다).
      //   표식 이전: 앞 표적이 죽을 때의 겹 x mkXfer 에서 시작. 균열: 겹이 다 찬 발마다 최대 체력(~ X0, D 단위)의 crk (보스 1/4), 한 발에 crkY 까지
      let main = 1;
      if (st.mkD) {
        const [aN, fN] = stackRun(X0, st.mkXfer), [aB, fB] = stackRun(X0 * 8, st.mkXfer), a0 = st.mkXfer ? stackRun(X0, 0)[0] : aN, b0 = st.mkXfer ? stackRun(X0 * 8, 0)[0] : aB;
        main *= 1 + st.mkD * ((1 - beta) * (a0 + (aN - a0) * pm.xf) + beta * (b0 + (aB - b0) * pm.xf)) * pm.mk;   // pm.xf: 이어받은 겹의 몫 (측정에서는 계산보다 크다)
        if (st.crk) main += ((1 - beta) * fN * Math.min(st.crk * X0, st.crkY) + beta * fB * Math.min(st.crk * X0 * 8 / 4, st.crkY)) * pm.crk;
      }
      // 점사 (T9d): 뒤 발 bst 개 x bstD. 같은 표적 (표식 보너스도 받음), 표적이 죽었으면 다음 적이라 낭비가 거의 없다
      const bu = st.bst ? st.bst * st.bstD * pm.burst : 0;
      const side = st.twin || 0;   // 이중 저격 (주 표적 아닌 탄)
      let hits = main * (1 + bu) + side + (st.through ? st.through * behind * (1 + bu) : 0);
      // 과잉 살상의 최소 피해 몫 (낭비 회수는 killRate 의 carry): 적 체력 배수에 따라 처치 확률이 달라 killRate 에서 센다 (T9d)
      if (st.carry && st.carryMin) cy = { n: st.carry, min: st.carryMin, amp: st.carryAmp * pm.ovkA, X0, bb, k: pm.ovk, base: hits };
      dir = rate * hits;
      burnN = rate * (1 + (st.twin ? 1 : 0) + st.bst);
      // 연속 사냥 (T9d, T10b): 저격이 처치하면 다음 대기 시간 -stk x STREAK_F^(연속 처치 수). 점사가 끝나고 조준(0.25초)해야 하므로 간격은 0.25 + 점사 시간 아래로 줄지 않는다(emax).
      //   처치 확률은 killRate 에서 (적 체력에 따라). 표적 고르기(한 발에 잡을 수 있는 적부터)는 tg 로 따로 (계산기에는 적 체력이 섞인 모습이 없어 상수)
      if (st.stk) { stk = { emax: 1 - (0.25 + st.bst * Core.BURST_GAP) / st.cd, K: st.stk, F: Core.STREAK_F, h: 1 + bu, kr: pw.kr, k: pm.stk, tg: pm.stkT }; }
      ccHit(tau, st.knock);
      break;
    }
    case 'acid': {
      const rr = 75 * (1 + st.aRange + st.areaPct), np = capC(nIn(lam, Math.PI * rr * rr), N) * 0.8;
      let pools = (1 + st.aMulti) * rate * 4;                 // 살아 있는 웅덩이 수 (웅덩이-초 / 초)
      const cm = 1 + st.crit * (1 + st.critDmg), bm = 1 + beta * st.bossPct;
      const vu = 0.10 + st.aVuln, per = np * cm * bm * (1 + vu);   // 웅덩이 하나의 초당 피해 (D 단위)
      const kr = 0.3 / Math.max(1, pc.K * pw.kw);              // 피해 1 당 처치 수 (처치 폭발과 같은 근사)
      // 산성비 (T5d): 8초마다 rainT 초, 레인 하나 (폭우: 둘) 전체. 적이 가장 많은 레인이라 평균의 1.5배. 폭우는 그친 자리에 작은 웅덩이 3개 (범위 50%, 2초)
      let extra = 0;
      if (st.rain) {
        const nl = st.rain2 ? 2 : 1, inL = capE(lam * 1.5, N);
        extra += nl * st.rainT / Core.RAIN_CD * st.rain * inL * (1 + vu) * pm.rain;
        if (st.rain2) extra += nl * 3 * 2 / Core.RAIN_CD * capC(nIn(lam, Math.PI * rr * rr * 0.25), N) * 0.8 * cm * (1 + vu);
      }
      let dd = pools * per + extra;
      // 점액 흔적: 웅덩이를 밟은 적이 3초 동안 22px 마다 자국 (뒤따르는 같은 레인의 적이 밟는다). 모든 무기 합쳐 80개
      if (st.slime) {
        const enter = pools * np * Rv0 / (2 * rr), marks = Math.min(80 / LANES, enter * 3 * Rv0 / 22 * st.slimeT);
        dd += marks * st.slime * capE(nIn(lam, Math.PI * 31.5 * 31.5) * 1.5, N) * (1 + vu) * pm.slime;
      }
      // 용해: 문턱 아래는 녹인다 (처형과 같은 몫), 녹은 적은 폭발, 연쇄 용해는 그 자리에 2초 웅덩이. 부패: 취약이 걸린 채 죽은 적 자리에 작은 웅덩이
      if (st.dsv) {
        dd /= 1 - st.dsv * (1 - bb);
        const ks = dd * kr * 0.7 * (1 - bb);
        dd += ks * st.dsvD * splashN(70 * st.dsvR * (1 + st.areaPct)) * pm.dsv;
        if (st.dsvPool) dd += ks * 2 * per * pm.dsv;
      }
      if (st.rot) dd += dd * kr * 0.6 * 2 * capC(nIn(lam, Math.PI * rr * rr * 0.36), N) * 0.8 * cm * (1 + vu) * pm.rot;
      dot = dd; q = 1;
      const cov = Math.min(0.9, (pools * np + (st.rain ? (st.rain2 ? 2 : 1) * st.rainT / Core.RAIN_CD * lam * 1.5 : 0)) / Math.max(1, LANES * lam));
      const sl = Math.max(st.aSlow, st.slow); if (sl) sig.push(sl * cov * (1 - 0.5 * bb));
      if (st.deathBoom) dot += dd * st.deathBoom * splashN(70 * (1 + st.areaPct)) * kr;
      break;
    }
  }
  // 공통: 지속 피해 (화상, 화염 지대 등). 화상은 맞은 적마다 공격력 x burn 초당, 마지막으로 맞은 뒤 3초
  // X = 적 체력 배수 1 에서 주 공격 한 발로 적 하나를 잡는 데 드는 (끊김 없는) 타수
  const X = pc.K * pw.kw * (13 / W0.dmg) * (ref.dmg * q0) / (st.dmg * q * hsz);
  const n1 = t === 'acid' ? 1 : killHits(X, st, bb);
  if (st.burn && t !== 'acid') dot += burnN * st.burn * Math.min(3, tau) * Math.max(0, 1 - 1 / Math.max(1, X));
  if (st.deathBoom && t !== 'acid') dir += dir / Math.max(1, n1) * st.deathBoom * splashN(70 * (1 + st.areaPct));   // 처치한 적의 폭발
  // 군중 제어: 느려진 비율 s 를 머무는 시간 증가 g = s / (1 - s) 로, 계수 cc x ccw 를 곱해 처치 속도에
  let s = 0; for (const x of sig) s = 1 - (1 - s) * (1 - Math.max(0, Math.min(0.95, x)));
  s = Math.min(0.95, s);
  const ccf = 1 + pc.cc * pw.ccw * s / (1 - s);
  // 취약 (표식, 산성 웅덩이, 역장 약화): 자기 몫 + 다른 무기 몫(운반 무기 피해 비율 share 에 따라)
  let vul = 0;
  if (st.vuln) vul += st.vuln * Math.max(0, 1 - 1 / Math.max(1, X));
  if (st.fldVuln) vul += st.fldVuln * 0.5;
  const sh = Math.max(0.05, Math.min(1, lay.share));
  let team = 0;
  if (st.vuln) team += st.vuln * pw.vt;
  if (st.fldVuln) team += st.fldVuln * pw.vt;
  if (t === 'acid') { const cov = Math.min(0.9, ((1 + st.aMulti) * rate * 4 * capC(nIn(lam, Math.PI * 75 * 75), st.cap) + (st.rain ? (st.rain2 ? 2 : 1) * st.rainT / Core.RAIN_CD * lam * 1.5 : 0)) / Math.max(1, LANES * lam)); team += (0.10 + st.aVuln) * pw.vt * cov / 0.3; }
  const vf = (1 + vul) * (1 + team * (1 / sh - 1));
  const dr = st.dmg / ref.dmg;   // 모든 피해는 공격력에 비례한다. 지속 피해는 치명타, 보스 보정을 받지 않는다 (산성은 식 안에서 따로)
  return { t, X, n1, sig: s, ccf, vf, D: t === 'acid' ? 0 : dir * q * dr, Dd: dot * dr, carry: st.carry, st, bb, stk, cy };
}
// 적 체력 배수 m 에서의 처치 속도 (초당 처치 수의 상대값)
function killRate(mo, m) {
  let dirPart = 0;
  if (mo.D > 0) {
    const x = mo.X * m;
    let eff = x / killHits(x, mo.st, mo.bb);
    if (mo.carry && eff < 1) eff += (1 - eff) * Math.min(1, mo.carry / 2);   // 넘겨받는 피해 (과잉 살상): 낭비된 몫을 다음 적에게
    dirPart = mo.D * eff;
    if (mo.cy) {    // 과잉 살상: 처치(확률 kp)하면 넘어간 피해 d 가 다음 적에게. d 가 그 적을 처치할 확률 min(1, d x kp) 로만 다음 회차로 이어진다 (T9d: 늘 끝까지 이어진다고 보면 증폭 전달을 2배쯤 크게 봤다)
      const c = mo.cy, kp = 1 / Math.max(1, c.X0 * m);
      let a = 0, f = 1, go = 1; for (let j = 0; j < c.n; j++) { f *= 1 + c.amp; const d = f * c.min; a += go * d; go *= Math.min(1, d * kp); }
      dirPart *= 1 + kp * (1 - c.bb) * a * c.k / c.base;
    }
    if (mo.stk) {   // 연속 사냥: 저격 한 번(점사 포함, 주 탄 h 발어치)이 처치할 확률 pk 만큼 다음 저격이 빨라진다
      // 연속 처치 수 j 의 분포 (1 - pk) pk^j 로 평균 대기 감소 c = pk x 합 (1 - pk) pk^j min(emax, K F^j) (T10b. 늘 처치하면 줄어드는 폭이 0 으로 간다)
      const k = mo.stk, pk = Math.min(1, k.h / killHits(x, mo.st, mo.bb));
      let c = 0; for (let j = 0, pj = 1 - pk, kf = k.K; j < 80 && pj > 1e-9; j++, pj *= pk, kf *= k.F) c += pj * Math.min(k.emax, kf);
      c *= pk;
      dirPart *= (1 + k.tg) * (1 + (Math.pow(1 / (1 - c), k.kr) - 1) * k.k);
    }   // 문턱 효과(처형, 선제, 즉사)는 타수를 X 밑으로 줄여 eff > 1 이 될 수 있다 (T8 전에는 1 로 잘라 처형·선제가 낮게 나왔다)
  }
  return (dirPart + mo.Dd) / m * mo.ccf * mo.vf;
}
// 등가 화력 R: 항목이 있으면 적 체력이 몇 배까지 되어도 맨 무기와 같은 처치 속도를 내는가 (tools/skill_eq.js 의 R 과 같은 뜻). eq = R - 1
function eqOf(st, ref, c, lay, PP) {
  const a = model(st, ref, c, lay, PP), z = model(ref, ref, c, lay, PP);
  const T = killRate(z, 1);
  if (!(T > 0)) return NaN;
  let lo = Math.log(0.01), hi = Math.log(1e4);
  if (killRate(a, Math.exp(hi)) > T) return 9999;
  if (killRate(a, Math.exp(lo)) < T) return -0.99;
  for (let i = 0; i < 46; i++) { const m = (lo + hi) / 2; if (killRate(a, Math.exp(m)) > T) lo = m; else hi = m; }
  return Math.exp((lo + hi) / 2) - 1;
}
const gm = (a) => Math.exp(a.reduce((s, v) => s + Math.log(v), 0) / a.length);
function eqAll(st, ref, lay, PP) {
  const o = {}; for (const c of CTX) o[c] = eqOf(st, ref, c, lay, PP);
  o.all = gm(CTX.map((c) => 1 + o[c])) - 1;
  return o;
}

module.exports = { Core, CB, CTX, P, statsOf, model, killRate, eqOf, eqAll, LAY, defaults };

/* ---------- 측정 자료 읽기 (영점) ---------- */
const PART_TEAM = ['shotgun', 'blaster', 'laser', 'tesla', 'mortar'];   // tools/item_eq.js 의 P5 팀
const ITEM_EQ_EXTRA = ['item_eq_t8a.json', 'item_eq_t8b.json', 'item_eq_t8c.json', 'item_eq_t8d.json'];   // 표본 밖 확인용 측정 (T8, fit 에는 안 씀)
// T8 에서 둘째 수치(w)를 새로 단 항목: 그 전 측정은 w 가 없으니 당시 고정값으로 계산한다 (연발 추가 탄 피해 32%, 철갑 산탄 관통당 -45%)
const LEGACY_W = { b_multi: 32, s_pierce: 45 };
function loadItemEq(file) {
  if (!fs.existsSync(file)) return [];
  const j = JSON.parse(fs.readFileSync(file, 'utf8')), cells = [];
  const pre = !(j.meta && j.meta.caps);   // T4(최대 타격 수) 이전 측정: 제한 없이 계산한다
  const none = {}, d50 = {};
  for (const r of j.rows) if (r.kind === 'none') none[r.team] = r;
  for (const r of j.rows) if (r.kind === 'fake' && r.id === '_eq_d50') d50[r.team] = r;   // 검증용 가짜 +50%: 보간이 50 ± 5 를 못 내는 칸은 믿음을 낮춘다
  for (const r of j.rows) {
    if (r.kind !== 'part' && r.kind !== 'aug') continue;
    const o = r.kind === 'part' ? { p: [[r.id, r.g]] } : { a: [[r.id, r.g]] };
    const wts = r.team === 'P5' ? PART_TEAM : [r.team.split(':')[1]];
    const D = r.kind === 'part' ? PARTS[r.id] : AUGS[r.id];
    if (!D) continue;                       // 그 뒤 지운 항목 (예: 박격포 핵탄두 증강은 T5a 에서 진화 줄로 옮김)
    // 측정 당시 수치(r.v, r.w)로 능력치를 만든다 (그 뒤 core.js 수치를 바꿔도 영점이 어긋나지 않게)
    const sts = withVal(D, r.g, r.v ? r.v[r.g] : null, r.w ? r.w[r.g] : LEGACY_W[r.id] != null ? LEGACY_W[r.id] : null, () => wts.map((t) => ({ t, st: statsOf(t, o), ref: statsOf(t, {}) })));
    if (pre) for (const q of sts) uncap(q);
    for (const c of CTX) {
      const m = r.sc[c];
      if (!m || m.eq == null || !isFinite(m.eq)) continue;
      const nz = none[r.team] && none[r.team].sc[c];
      const share = r.team === 'P5' ? 1 : nz && nz.share != null ? nz.share : 0.4;
      const src = r.team.split(':')[0], ck = d50[r.team] && d50[r.team].sc[c];
      const wt = ck && ck.eq != null && Math.abs(ck.eq - 0.5) <= 0.05 ? 1 : 0.3;   // 가중치: 검증(가짜 +50%) 실패 칸은 0.3. 천장 칸(sat)은 하한으로 쓴다
      cells.push({ src, team: r.team, id: r.id, g: r.g, vv: r.v ? r.v[r.g] : null, kind: r.kind, c, meas: m.eq, wt, sat: !!m.sat, sts, lay: Object.assign({}, LAY[src], { share }), types: wts });
    }
  }
  return cells;
}
// tools/skill_eq.js 리포트 (뒤에 준 파일이 같은 줄을 덮어쓴다)
function loadSkillEq(files) {
  const got = {};
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    let mode = null;
    for (const ln of fs.readFileSync(f, 'utf8').split('\n')) {
      if (ln.startsWith('[줄 측정: 완성')) mode = 'full'; else if (ln.startsWith('[줄 측정: 뿌리만')) mode = 'root'; else if (ln.startsWith('[')) mode = null;
      const m = mode && ln.match(/^\s+(\w+)\.(\d)\s+\S+(?:\s\S+)?\s+((?:[\d.]+[*!]?|포화|못버팀|n\/a)\s+(?:[\d.]+[*!]?|포화|못버팀|n\/a)\s+(?:[\d.]+[*!]?|포화|못버팀|n\/a)\s+(?:[\d.]+[*!]?|포화|못버팀|n\/a)\s+(?:[\d.]+[*!]?|포화|못버팀|n\/a))/);
      if (!m) continue;
      const v = m[3].trim().split(/\s+/).map((x) => (/^[\d.]/.test(x) ? parseFloat(x) : null));
      got[`${m[1]}.${m[2]}|${mode}`] = { t: m[1], l: +m[2], mode, R: v, file: path.basename(f) };
    }
  }
  const cells = [];
  for (const k in got) {
    const g = got[k], sk = zeroSk(), mx = SKILLS[g.t][g.l].nodes.map((n) => n.max);
    sk[g.l] = g.mode === 'full' ? mx.slice() : [mx[0], 0, 0];
    const st = statsOf(g.t, { evo: 1, sk }), ref = statsOf(g.t, { evo: 1 }), q = { t: g.t, st, ref };
    if (PRE_T4_SK.has(g.file)) uncap(q);
    CTX.forEach((c, i) => { if (g.R[i] != null) cells.push({ src: 'SK', id: `${g.t}.${g.l}`, mode: g.mode, c, meas: g.R[i] - 1, sts: [q], lay: LAY.I5, types: [g.t], file: g.file }); });
  }
  return cells;
}
function predCell(x, PP) {
  let s = 0; for (const o of x.sts) s += 1 + eqOf(o.st, o.ref, x.c, x.lay, PP);
  return s / x.sts.length - 1;
}
const lnr = (v) => Math.log(Math.max(0.02, 1 + v));
// T4 이전 측정(최대 타격 수가 없던 때)은 제한 없이 계산한다
const NOCAP = Core.CAP_NONE || 1e9;
function uncap(q) { q.st.cap = NOCAP; q.ref.cap = NOCAP; return q; }
const PRE_T4_SK = new Set(['skill_eq_report.txt', 'skill_eq_report_s5.txt', 'skill_eq_report_t3.txt']);   // T4 전에 잰 스킬 리포트

/* ---------- 계수 맞추기: 좌표 하강 (로그 눈금에서 황금 분할) ---------- */
function fitParams(cells, list, PP, sweeps) {
  const res = (x) => { let d = lnr(predCell(x, PP)) - lnr(x.meas); if (x.sat) d = Math.min(0, d); return (x.wt == null ? 1 : x.wt) * Math.min(d * d, 2.25); };   // 천장 칸(sat)은 하한: 예측이 그보다 작을 때만 벌점
  for (let sw = 0; sw < sweeps; sw++) {
    for (const p of list) {
      const sub = cells.filter(p.on);
      if (!sub.length) continue;
      const obj = (v) => { p.set(PP, v); let s = 0; for (const x of sub) s += res(x); return s; };
      const cur = p.get(PP);
      let a = Math.log(p.lo), b = Math.log(p.hi);
      const gr = 0.618034;
      let x1 = b - gr * (b - a), x2 = a + gr * (b - a), f1 = obj(Math.exp(x1)), f2 = obj(Math.exp(x2));
      for (let i = 0; i < 18; i++) {
        if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - gr * (b - a); f1 = obj(Math.exp(x1)); }
        else { a = x1; x1 = x2; f1 = f2; x2 = a + gr * (b - a); f2 = obj(Math.exp(x2)); }
      }
      const best = f1 < f2 ? Math.exp(x1) : Math.exp(x2), fb = Math.min(f1, f2), f0 = obj(cur);
      p.set(PP, fb < f0 ? best : cur);
    }
  }
}
const BOSS_ITEMS = ['boss', 'm_boss', 'r_heavy'];   // 보스·대형 적 피해 항목 (대형 적 비중 계수를 맞추는 자료)
function paramList(kind) {
  const L = [];
  const add = (name, lo, hi, get, set, on) => L.push({ name, lo, hi, get, set, on });
  if (kind === 'items') {
    for (const c of CTX) {
      add(`c.${c}.lf`, 0.05, 5, (Q) => Q.c[c].lf, (Q, v) => { Q.c[c].lf = v; }, (x) => x.c === c);
      add(`c.${c}.K`, 0.2, 60, (Q) => Q.c[c].K, (Q, v) => { Q.c[c].K = v; }, (x) => x.c === c);
      add(`c.${c}.cc`, 0.01, 5, (Q) => Q.c[c].cc, (Q, v) => { Q.c[c].cc = v; }, (x) => x.c === c);
      add(`c.${c}.bf`, 0.1, 3, (Q) => Q.c[c].bf, (Q, v) => { Q.c[c].bf = v; }, (x) => x.c === c && BOSS_ITEMS.includes(x.id));
      add(`c.${c}.phi`, 0.05, 3, (Q) => Q.c[c].phi, (Q, v) => { Q.c[c].phi = v; }, (x) => x.c === c && x.id === 'sniper');
    }
    for (const t of WEAPON_IDS) {
      const on = (x) => x.types.includes(t);
      if (t !== 'blaster') {
        add(`w.${t}.kw`, 0.05, 20, (Q) => Q.w[t].kw, (Q, v) => { Q.w[t].kw = v; }, on);
        add(`w.${t}.dw`, 0.05, 20, (Q) => Q.w[t].dw, (Q, v) => { Q.w[t].dw = v; }, on);
        add(`w.${t}.bw`, 0.1, 10, (Q) => Q.w[t].bw, (Q, v) => { Q.w[t].bw = v; }, (x) => on(x) && BOSS_ITEMS.includes(x.id));
      }
      add(`w.${t}.ccw`, 0.01, 60, (Q) => Q.w[t].ccw, (Q, v) => { Q.w[t].ccw = v; }, on);   // 블래스터도 맞춘다 (시나리오 cc 와 곱이라 크기는 하나로 정해지지 않지만 예측은 같다)
      add(`w.${t}.kr`, 0.2, 2.5, (Q) => Q.w[t].kr, (Q, v) => { Q.w[t].kr = v; }, on);
      if (['blaster', 'shotgun', 'tesla'].includes(t)) add(`w.${t}.kg`, 0.02, 3, (Q) => Q.w[t].kg, (Q, v) => { Q.w[t].kg = v; }, on);
      if (['rail', 'acid', 'pulse'].includes(t)) add(`w.${t}.vt`, 0.01, 3, (Q) => Q.w[t].vt, (Q, v) => { Q.w[t].vt = v; }, on);
    }
  } else {
    for (const k of Object.keys(P.m)) add(`m.${k}`, 0.05, 20, (Q) => Q.m[k], (Q, v) => { Q.m[k] = v; }, () => true);
  }
  return L;
}

/* ---------- 기지 항목: F(팀 화력 %), S(유효 체력 %), G(재화 %) ---------- */
// 유효 체력 = 최대 체력 / 받는 피해 비율 + 회복량. 회복은 '쓸모 있는 회복 시간' Treg 초 동안 모인 양으로 센다 (영점에서 맞춘다)
// 재화 계열: 강화 성공률 +1%p 는 강화 효율 +1/p̄ (p̄ = 자주 도전하는 단계의 평균 성공률), 조각 몫(생성의 약 2/3)만큼 재화로 바꾼다
const KILL_RATE = 3;          // 중후반 초당 처치 수 (수리 장치의 회복 확률용, 봇 기록 기준의 대략값)
const P_UP = 0.35;            // 중후반에 도전하는 강화 단계의 평균 성공률 (50~90강)
const SHARD_SHARE = 0.67;     // 생성 결과 중 강화 조각의 몫 (무기 5자루일 때 generate() 의 확률)
const BOSS_HEAL_W = 0.25;    // 보스 처치 회복의 몫 (T8 짝 생존 맞춤: 0 이 가장 잘 맞고 0~0.5 는 잡음 안. 봇은 보스를 못 잡는 때에 죽는 일이 많다)
const NEAR_K = 2;             // 기지 바로 앞에서 주는 피해의 가치 배수 (가장 위험한 적이라서)
function withVal(D, g, v, w, fn) {   // 항목의 등급 g 수치를 잠시 바꿔 fn 실행
  const ov = D.v[g], ow = D.w ? D.w[g] : undefined;
  if (v != null) D.v[g] = v; if (w != null && D.w) D.w[g] = w;
  try { return fn(); } finally { D.v[g] = ov; if (D.w) D.w[g] = ow; }
}
function baseFSG(kind, id, g, v, w, PP) {
  PP = PP || P;
  const D = kind === 'part' ? PARTS[id] : AUGS[id];
  return withVal(D, g, v, w, () => {
    const spec = kind === 'part' ? { p: [[id, g]] } : { a: [[id, g]] };
    Core.newGame(H); const S = Core.S;
    if (kind === 'part') S.base.parts[0] = { id, g }; else S.base.augs[0] = { id, g };
    S.base._s = null; const b = Object.assign({}, Core.bstats());
    // F: 모든 무기에 닿는 공격력/사거리 (무기 8종 평균)
    let F = 0;
    if (b.dmgAll || b.rangeAll) { let s = 0; for (const t of WEAPON_IDS) { const st = statsOf(t, { base: spec }), ref = statsOf(t, {}); s += eqAll(st, ref, LAY.X2, PP).all; } F += s / WEAPON_IDS.length * 100; }
    const ccBar = CTX.reduce((a, c) => a + PP.c[c].cc, 0) / CTX.length;
    const ccF = (sg) => 100 * ccBar * sg / (1 - sg);
    if (b.nearSlow) F += ccF(b.nearSlow * 0.8);                                // 아래 4분의 1에서만 걸리지만 싸움 대부분이 기지 가까이에서 일어나 0.8 로 본다 (대략값)
    if (b.wave) F += ccF(Math.min(0.9, 1.5 / b.wave));                        // 모든 적을 1.5초 얼림
    if (b.turret) F += 100 * b.turret * 1.5 / 5 * NEAR_K;                     // 가장 강한 무기 화력의 v (무기 평균의 약 1.5배) / 다섯 자루
    if (b.fence) F += 100 * b.fence * 1.5 / 5 * NEAR_K * (LANES * CB.mix.lam0 * PP.c.mix.lf * 0.14);   // 기지 앞 14% 띠 안의 적 수만큼
    if (b.shock) F += 100 * (b.shock / 100) * 1.5 / 5 * NEAR_K * 3 + ccF(Math.min(0.5, b.shock * 0.004));
    // S: 유효 체력
    const hpm = (1 + b.hpPct) / ((1 - b.shield) * (1 - b.dmgRed));
    let S_ = (hpm - 1) * 100;
    S_ += 100 * (b.regenPct + b.heal * 0.01 * KILL_RATE + b.bossHeal / 60 * BOSS_HEAL_W) * PP.x.Treg;
    if (b.revive) S_ += 100 * b.revive;
    if (b.bomb) S_ += 25;                                                     // 위기 때 한 번 전장을 쓸어 준다 (대략값)
    // G: 재화
    let G = 100 * b.goldAll;
    if (b.luck) G += 100 * b.luck / P_UP * SHARD_SHARE / 0.94;
    if (b.save) G += 100 * b.save / (1 - b.save) * SHARD_SHARE / 0.94;
    if (b.magnet) G += 100 * b.magnet * 0.06 * 450 / (11 * SHARD_SHARE) / 0.94;   // 처치 1회 조각 = 생성 1회(비용 약 450)의 6%, 처치 재화 약 11
    const tot = F + S_ * PP.x.aS / PP.x.aF + G * PP.x.aG / PP.x.aF;
    return { F, S: S_, G, tot, gain: PP.x.aF * F + PP.x.aS * S_ + PP.x.aG * G };
  });
}
// 짝 생존 측정 (tools/balance_log.md 의 T8): 측정 당시 영웅 수치(전설만 있는 항목은 g: 3)와 gain(%). 시드 96, K 321, 표준오차 2~6%p.
// T8 전 기록(C, J, N 절, 시드 24)은 잡음이 커서(같은 항목 +9% / +23%) 이 기록으로 바꿨다
const PAIR = [
  { k: 'part', id: 'command', v: 14, gain: [20.6] },
  { k: 'part', id: 'radar', v: 11, gain: [7.8] },
  { k: 'part', id: 'depot', v: 7, gain: [16.9] },
  { k: 'part', id: 'luck', v: 1.9, gain: [11.9] },
  { k: 'part', id: 'save', v: 5.7, gain: [11.2] },
  { k: 'part', id: 'magnet', v: 1.7, gain: [9.9] },
  { k: 'part', id: 'armor', v: 20, w: 4.4, gain: [18.3] },
  { k: 'part', id: 'drone', v: 0.25, w: 2.8, gain: [29.9] },
  { k: 'part', id: 'heal', v: 4, w: 6, gain: [10.0] },
  { k: 'part', id: 'shield', v: 12, gain: [5.8] },
  { k: 'aug', id: 'h_armor', v: 30, w: 8, gain: [14.8] },
  { k: 'aug', id: 'h_supply', v: 7, gain: [13.3] },
  { k: 'aug', id: 'h_repair', v: 0.25, w: 5, gain: [18.6] },
  { k: 'aug', id: 'h_drill', v: 3.2, gain: [19.8] },
  // 맞춤에는 쓰지 않고 비교만 (기구가 독특해 식이 대략값)
  { k: 'part', id: 'wire', v: 29, gain: [20.4], chk: 1 },
  { k: 'part', id: 'barrier', v: 30, gain: [13.5], chk: 1 },
  { k: 'aug', id: 'h_turret', v: 11, gain: [21.4], chk: 1 },
  { k: 'aug', id: 'h_shock', v: 8, gain: [15.1], chk: 1 },
  { k: 'aug', id: 'h_fence', v: 9, gain: [31.3], chk: 1 },
  { k: 'aug', id: 'h_wave', v: 30, gain: [6.2], chk: 1 },
  { k: 'aug', id: 'h_bomb', v: 35, gain: [19.0], chk: 1, g: 3 },
].map((q) => Object.assign(q, { t4: 1, src: 'T8 96시드' }));
// t4: 1 = T4(최대 타격 수) 뒤에 잰 기록 (제한을 켜고 계산한다). 없으면 제한 없이 계산한다
function withoutCap(fn) {
  const old = WEAPON_IDS.map((t) => WEAPONS[t].cap);
  for (const t of WEAPON_IDS) WEAPONS[t].cap = 0;
  try { return fn(); } finally { WEAPON_IDS.forEach((t, i) => { WEAPONS[t].cap = old[i]; }); }
}
const pairFSG = (q, PP) => { const f = () => baseFSG(q.k, q.id, q.g != null ? q.g : 2, q.v, q.w, PP); return q.t4 ? f() : withoutCap(f); };
function fitExchange(PP) {   // gain = aF F + aS S + aG G 의 최소제곱 (Treg 는 격자로)
  const data = PAIR.filter((q) => !q.chk).map((q) => ({ q, y: q.gain.reduce((a, b) => a + b, 0) / q.gain.length }));
  let best = null;
  for (const Tr of [60, 90, 120, 160, 200, 250, 300, 400, 500]) {
    PP.x.Treg = Tr;
    const X = data.map((d) => { const f = pairFSG(d.q, PP); return [f.F, f.S, f.G]; });
    // 정규 방정식 (3x3), 음수는 0 으로
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bv = [0, 0, 0];
    X.forEach((x, i) => { for (let a = 0; a < 3; a++) { bv[a] += x[a] * data[i].y; for (let b = 0; b < 3; b++) A[a][b] += x[a] * x[b]; } });
    const sol = solve3(A, bv).map((v) => Math.max(0.01, v));
    let ss = 0; X.forEach((x, i) => { const p = sol[0] * x[0] + sol[1] * x[1] + sol[2] * x[2]; ss += (p - data[i].y) ** 2; });
    if (!best || ss < best.ss) best = { ss, Tr, sol };
  }
  PP.x.Treg = best.Tr; PP.x.aF = best.sol[0]; PP.x.aS = best.sol[1]; PP.x.aG = best.sol[2];
  return best;
}
function solve3(A, b) {
  const m = A.map((r, i) => r.concat([b[i]]));
  for (let i = 0; i < 3; i++) {
    let p = i; for (let r = i + 1; r < 3; r++) if (Math.abs(m[r][i]) > Math.abs(m[p][i])) p = r;
    [m[i], m[p]] = [m[p], m[i]];
    const d = m[i][i] || 1e-9;
    for (let r = 0; r < 3; r++) if (r !== i) { const f = m[r][i] / d; for (let c = i; c < 4; c++) m[r][c] -= f * m[i][c]; }
  }
  return [0, 1, 2].map((i) => m[i][3] / (m[i][i] || 1e-9));
}

/* ---------- 표 만들기 ---------- */
const wid = (s) => [...String(s)].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);
const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - wid(s)));
const lpad = (s, n) => ' '.repeat(Math.max(0, n - wid(s))) + String(s);
const pct = (v) => (v == null || isNaN(v) ? '-' : v >= 99 ? '포화' : (v >= 0 ? '+' : '') + Math.round(v * 100));
const gradesFrom = (min, max = 3) => [0, 1, 2, 3].filter((g) => g >= min && g <= max);
const gMax = (D) => (D.max != null ? D.max : 3);
// 예산 기준 영웅 가치 (T8 에서 고정): 무기 파츠 21, 증강 50 (T3 영웅 평균). 무기 파츠도 공용 증강처럼 가장 잘 맞는 무기로 판정하므로 평균을 쓰면 기준이 따라 움직인다
const HERO_BUDGET = { part: 0.21, aug: 0.50 };
// 계산기와 측정이 어긋나 측정으로 판정한 항목 (T8). 예산 밖 목록에 함께 적는다
const MEAS_NOTE = {
  exec: '블래스터·레이저·펄스 영웅 15 / 19 / 20, 전설 25 / 34 / 40 으로 예산 안 (계산기가 약 1.4배 크게 본다)',
  first: '범위 무기에서 계산기의 약 2배, 저격포 1.4배. 낮춘 뒤 저격포 영웅 19 / 전설 46, 펄스 14 / 33',
  t_slow: '계산기의 약 0.8배. 일반 15, 희귀 21',
  b_frost: '일반 12, 희귀(80%) 15 라 일반에만 둔다',
  l_freeze: '0.55초 27, 0.95초 43 (희귀·영웅 예산 안)',
  s_knock: '세기 48 에서 46 (영웅 예산 안). 세기를 바꿔도 거의 그대로라 영웅에만 둔다',
  c_wide: '계산기의 약 0.8배 (웅덩이 하나 더 82 / 예측 103)',
  s_pierce: '희귀에서 계산기의 약 0.6배',
  t_stun: '계산기의 약 2배 (44% 에서 12, 65% 에서 17 -> 희귀 90%)',
  m_shrap: '영웅 100 / 계산기 38 (박격포 측정은 고르지 않다)',
  command: '짝 생존 +18~21%, 기지 파츠 평균의 약 1.4배',
  wire: '짝 생존 +20% (식이 거칠다)', h_fence: '짝 생존: 세기 4 에서 +16%', h_turret: '짝 생존 +21%',
  h_wave: '짝 생존: 영웅 12초 +7%, 전설 6초 +32% -> 영웅 9초', h_bomb: '짝 생존: 문턱 60 / 80% 모두 +26% (60초 대기로 포화)',
};
const AREA_W = WEAPON_IDS.filter((t) => WEAPONS[t].cap && !WEAPONS[t].capSk);   // 범위 무기 (최대 타격 수가 있는 무기)
const layFor = (t, PP) => Object.assign({}, t === 'laser' ? LAY.I5 : LAY.X2, { share: (PP || P).w[t].sh || (t === 'laser' ? 1 : 0.4) });
function partVal(id, g, t, PP) { return eqAll(statsOf(t, { p: [[id, g]] }), statsOf(t, {}), layFor(t, PP), PP); }
function augVal(id, g, t, PP) { return eqAll(statsOf(t, { a: [[id, g]] }), statsOf(t, {}), layFor(t, PP), PP); }
const heroEq = (vals, min) => (min >= 3 ? vals[3] / GRADE_RATIO[3] : vals[2]);   // 전설만 있는 항목은 전설 / 2.5 를 영웅 몫으로
function judge(v, budget) { const r = v / budget; return { r, flag: r > 1.5 ? '강함' : r < 1 / 1.5 ? '약함' : '' }; }

function buildTables(PP) {
  PP = PP || P;
  const out = { parts: [], augs: [], base: [], skills: [], flags: [] };
  // 무기 파츠: 무기 8종의 종합 가치, 평균
  for (const id of Core.WEAPON_PART_IDS) {
    const D = PARTS[id], row = { id, name: D.name, min: D.min, g: {} };
    for (const g of gradesFrom(D.min, gMax(D))) {
      const per = {}; let s = 0, best = null;
      for (const t of WEAPON_IDS) { per[t] = partVal(id, g, t, PP).all; s += per[t]; if ((!D.area || AREA_W.includes(t)) && (best == null || per[t] > per[best])) best = t; }
      // 판정은 가장 잘 맞는 무기 (T8, 사용자 지시: 강한 쪽을 상한으로. 범위 무기 전용은 범위 무기 중에서). avg 칸에 그 값을 쓴다
      row.g[g] = { per, avg: per[best], all8: s / WEAPON_IDS.length, best };
    }
    row.area = !!D.area;
    out.parts.push(row);
  }
  const pHero = out.parts.filter((r) => r.id !== 'gold' && !r.area).map((r) => heroEq([0, 1, 2, 3].map((g) => (r.g[g] ? r.g[g].avg : 0)), r.min));   // 영웅 평균에는 범위 무기 전용 파츠를 넣지 않는다
  out.partHeroMean = pHero.reduce((a, b) => a + b, 0) / pHero.length;
  out.partHero = HERO_BUDGET.part;
  // 증강: 자기 무기 (공용은 8종 중 가장 잘 맞는 무기)
  for (const id of Object.keys(AUGS)) {
    const A = AUGS[id]; if (A.for === 'base' || A.pool === false) continue;
    const ws = A.for === 'all' ? WEAPON_IDS : [A.for];
    const row = { id, name: A.name, min: A.min, for: A.for, g: {} };
    for (const g of gradesFrom(A.min, gMax(A))) {
      let best = null, s = 0; const per = {};
      for (const t of ws) { const e = augVal(id, g, t, PP); per[t] = e; s += e.all; if (!best || e.all > best.e.all) best = { t, e }; }
      row.g[g] = { best: best.t, e: best.e, avg: s / ws.length, per };
    }
    out.augs.push(row);
  }
  const aHero = out.augs.map((r) => heroEq([0, 1, 2, 3].map((g) => (r.g[g] ? r.g[g].e.all : 0)), r.min));
  out.augHeroMean = aHero.reduce((a, b) => a + b, 0) / aHero.length;
  out.augHero = HERO_BUDGET.aug;
  // 기지 파츠, 기지 증강
  for (const id of Core.BASE_PART_IDS) { const D = PARTS[id]; const row = { kind: 'part', id, name: D.name, min: D.min, g: {} }; for (const g of gradesFrom(D.min, gMax(D))) row.g[g] = baseFSG('part', id, g, null, null, PP); out.base.push(row); }
  for (const id of Object.keys(AUGS).filter((k) => AUGS[k].for === 'base')) { const A = AUGS[id]; const row = { kind: 'aug', id, name: A.name, min: A.min, g: {} }; for (const g of gradesFrom(A.min, gMax(A))) row.g[g] = baseFSG('aug', id, g, null, null, PP); out.base.push(row); }
  for (const kind of ['part', 'aug']) {
    const hs = out.base.filter((r) => r.kind === kind).map((r) => heroEq([0, 1, 2, 3].map((g) => (r.g[g] ? r.g[g].tot : 0)), r.min) / 100);
    out['base' + kind + 'Hero'] = hs.reduce((a, b) => a + b, 0) / hs.length;
  }
  // 진화 스킬: 줄마다 랭크를 하나씩 쌓아 가며 누적 R (앞 노드는 다 찍은 상태)
  for (const t of WEAPON_IDS) SKILLS[t].forEach((ln, l) => {
    const ref = statsOf(t, { evo: 1 }), steps = [];
    const mx = ln.nodes.map((n) => n.max);
    for (let tier = 0; tier < 3; tier++) for (let k = 1; k <= mx[tier]; k++) {
      const sk = zeroSk(); for (let q = 0; q < tier; q++) sk[l][q] = mx[q]; sk[l][tier] = k;
      const e = eqAll(statsOf(t, { evo: 1, sk }), ref, LAY.I5, PP);
      steps.push({ tier, k, node: ln.nodes[tier], e });
    }
    out.skills.push({ t, l, id: `${t}.${l}`, name: ln.name, steps, root: steps[mx[0] - 1].e, full: steps[steps.length - 1].e, sc: ln.nodes[0].sc });
  });
  // 예산 밖 목록
  const flag = (kind, label, g, v, hero) => { const j = judge(v, GRADE_RATIO[g] * hero); if (j.flag) out.flags.push({ kind, label, g, v, budget: GRADE_RATIO[g] * hero, r: j.r, flag: j.flag }); };
  for (const r of out.parts) if (r.id !== 'gold') for (const g in r.g) flag('무기 파츠', `${r.id} ${r.name}`, +g, r.g[g].avg, out.partHero);
  for (const r of out.augs) for (const g in r.g) flag('증강', `${r.id} ${r.name}${r.for === 'all' ? ' (' + r.g[g].best + ')' : ''}`, +g, r.g[g].e.all, out.augHero);
  for (const r of out.base) for (const g in r.g) flag(r.kind === 'part' ? '기지 파츠' : '기지 증강', `${r.id} ${r.name}`, +g, r.g[g].tot / 100, out['base' + r.kind + 'Hero']);
  return out;
}

/* ---------- 리포트 ---------- */
function reportText(T, PP, fitInfo) {
  PP = PP || P;
  const o = [];
  const f0 = (v) => (v == null || isNaN(v) ? '-' : (v * 100).toFixed(0));
  o.push('도형 디펜스 수치 가치 환산표 (tools/value.js)');
  o.push(`생성: ${new Date().toISOString()}  계수: ${fs.existsSync(CAL_FILE) ? 'tools/value_cal.json (' + (JSON.parse(fs.readFileSync(CAL_FILE, 'utf8')).meta || {}).date + ')' : '기본값 (영점 전)'}`);
  o.push('');
  o.push('[단위] 화력 가치 1 = 그 항목을 단 무기의 공격력 +1% 와 같은 세기 (적 체력이 몇 배까지 되어도 버티는가, tools/skill_eq.js 의 R 과 같은 뜻: 가치 = (R-1) x 100).');
  o.push('  종합 = 시나리오 5개(정예, 물량, 표준, 보스전, 초반)의 기하평균. 표의 숫자는 종합 가치(+%). 공격력 파츠/증강은 정의상 수치 그대로다.');
  o.push(`  기지 항목: F = 모든 무기 공격력 +% 어치, S = 기지 유효 체력 +%, G = 재화 +%. 교환 비율 1 S = ${(PP.x.aS / PP.x.aF).toFixed(2)} F, 1 G = ${(PP.x.aG / PP.x.aF).toFixed(2)} F (회복은 ${PP.x.Treg}초 동안 모인 양을 유효 체력으로 센다).`);
  o.push(`  등급 예산 = [${GRADE_RATIO.join(', ')}] x 영웅 기준(무기 파츠 ${Math.round(T.partHero * 100)}, 증강 ${Math.round(T.augHero * 100)} 고정, 기지 항목은 영웅 평균). 예산의 1.5배 넘으면 "강함", 1/1.5 밑이면 "약함".`);
  o.push('  무기 파츠와 공용 증강은 가장 잘 맞는 무기로 판정한다(강한 쪽이 상한. 맞지 않는 무기에서는 약해도 된다). 등급 범위(min~max) 밖은 나오지 않는다.');
  o.push('');
  o.push(`=== 무기 파츠 (무기 8종 각각에 달았을 때 종합 가치. 판정은 가장 잘 맞는 무기, 영웅 기준 ${(T.partHero * 100).toFixed(0)}, 참고: 8종 평균의 영웅 평균 ${(T.partHeroMean * 100).toFixed(1)}) ===`);
  o.push('  ' + pad('파츠', 22) + pad('등급', 6) + WEAPON_IDS.map((t) => lpad(t.slice(0, 6), 8)).join('') + lpad('최고', 8) + lpad('예산', 7) + lpad('비', 6) + '  판정');
  for (const r of T.parts) for (const g in r.g) {
    const x = r.g[g], j = judge(x.avg, GRADE_RATIO[g] * T.partHero);
    o.push('  ' + pad(`${r.id} ${r.name}`, 22) + pad(GR[g], 6) + WEAPON_IDS.map((t) => lpad(pct(x.per[t]), 8)).join('') + lpad(pct(x.avg), 8) + lpad(f0(GRADE_RATIO[g] * T.partHero), 7) + lpad(r.id === 'gold' ? '-' : j.r.toFixed(2), 6) + '  ' + (r.id === 'gold' ? '재화(성장)' : j.flag) + `  (${x.best}${r.area ? ', 범위 무기 전용' : ''}, 8종 평균 ${pct(x.all8)})`);
  }
  o.push('  (gold 채굴 칩은 성장 항목이라 화력 0. 기지 항목의 G 와 같은 단위로 보면 이 무기 처치 몫(약 1/5) x 수치)');
  o.push('  ("최고" 칸 = 가장 잘 맞는 무기의 값(범위 무기 전용 파츠는 범위 무기 중에서). 판정은 이 값으로 한다)');
  o.push('');
  o.push(`=== 증강 (자기 무기에 달았을 때, 공용 a_* 는 가장 잘 맞는 무기. 영웅 기준 ${(T.augHero * 100).toFixed(0)}, 참고: 영웅 평균 ${(T.augHeroMean * 100).toFixed(1)}) ===`);
  o.push('  ' + pad('증강', 24) + pad('등급', 6) + pad('무기', 9) + CTX.map((c) => lpad(CTX_KO[c], 8)).join('') + lpad('종합', 8) + lpad('예산', 7) + lpad('비', 6) + '  판정');
  for (const r of T.augs) for (const g in r.g) {
    const x = r.g[g], j = judge(x.e.all, GRADE_RATIO[g] * T.augHero);
    o.push('  ' + pad(`${r.id} ${r.name}`, 24) + pad(GR[g], 6) + pad(x.best, 9) + CTX.map((c) => lpad(pct(x.e[c]), 8)).join('') + lpad(pct(x.e.all), 8) + lpad(f0(GRADE_RATIO[g] * T.augHero), 7) + lpad(j.r.toFixed(2), 6) + '  ' + j.flag + (r.for === 'all' ? `  (8종 평균 ${pct(x.avg)})` : ''));
  }
  o.push('');
  o.push(`=== 기지 파츠·증강 (F 화력, S 유효 체력, G 재화, 합 = F 단위. 영웅 평균: 파츠 ${(T.basepartHero * 100).toFixed(1)}, 증강 ${(T.baseaugHero * 100).toFixed(1)}) ===`);
  o.push('  ' + pad('항목', 22) + pad('등급', 6) + lpad('F', 7) + lpad('S', 7) + lpad('G', 7) + lpad('합', 7) + lpad('예산', 7) + lpad('비', 6) + '  판정');
  for (const r of T.base) for (const g in r.g) {
    const x = r.g[g], hero = T['base' + r.kind + 'Hero'], j = judge(x.tot / 100, GRADE_RATIO[g] * hero);
    o.push('  ' + pad(`${r.id} ${r.name}`, 22) + pad(GR[g], 6) + lpad(x.F.toFixed(1), 7) + lpad(x.S.toFixed(1), 7) + lpad(x.G.toFixed(1), 7) + lpad(x.tot.toFixed(1), 7) + lpad(f0(GRADE_RATIO[g] * hero), 7) + lpad(j.r.toFixed(2), 6) + '  ' + j.flag);
  }
  o.push('');
  o.push('=== 진화 스킬 (같은 무기 다섯 자루 팀 기준, 앞 노드를 다 찍고 쌓은 누적 R. T6 목표: 뿌리만 R 1.3~1.7, 완성 R 2.5~3.5) ===');
  const SKM = fitInfo && fitInfo.skMeas ? fitInfo.skMeas : {};
  const tg = (R, lo, hi) => (R < lo ? '약함' : R > hi ? '강함' : '목표 안');
  for (const s of T.skills) {
    const rk = s.steps.map((x) => (1 + x.e.all).toFixed(2));
    const m = SKM[s.id] || {};
    o.push(`  ${pad(s.id + ' ' + s.name, 18)} 배율 ${s.sc == null ? '-' : s.sc}  뿌리만 R ${(1 + s.root.all).toFixed(2)} (${tg(1 + s.root.all, 1.3, 1.7)})${m.root ? ', 측정 ' + m.root.toFixed(2) : ''}  완성 R ${(1 + s.full.all).toFixed(2)} (${tg(1 + s.full.all, 2.5, 3.5)})${m.full ? ', 측정 ' + m.full.toFixed(2) : ''}`);
    o.push(`    랭크별 누적 R: ${s.steps.map((x, i) => (i < s.steps.length - 1 && x.tier !== s.steps[i + 1].tier ? rk[i] + ' |' : rk[i])).join(' ')}`);
  }
  o.push('  (박격포는 T5a 의 새 트리. 이 무기는 같은 무기 다섯 자루가 버티지 못해 skill_eq.js --mix(섞인 팀)로 잰다. 융단 폭격·충격파 기구 계수는 아직 영점 전. 전격기, 저격포, 산성은 아직 옛 트리(증강 효과를 나눠 담은 노드). 저격포 관통 저격, 이중 저격은 core.js 의 100 나누기 중복으로 피해가 1/100 이다)');
  o.push('');
  o.push('=== 예산에서 크게 벗어난 항목 (계산기 판정) ===');
  for (const kind of ['무기 파츠', '증강', '기지 파츠', '기지 증강']) {
    const L = T.flags.filter((f) => f.kind === kind).sort((a, b) => b.r - a.r);
    if (!L.length) continue;
    o.push(`  [${kind}]`);
    for (const f of L) { const mn = MEAS_NOTE[f.label.split(' ')[0]]; o.push(`    ${pad(f.label, 30)} ${pad(GR[f.g], 5)} 가치 ${lpad((f.v * 100).toFixed(1), 6)}  예산 ${lpad((f.budget * 100).toFixed(1), 6)}  x${f.r.toFixed(2)} ${f.flag}${mn ? '  [측정: ' + mn + ']' : ''}`); }
  }
  o.push('  ([측정: ...] = 계산기와 측정이 달라 측정으로 판정한 항목. 수치는 그 측정에 맞춰 두었다. tools/balance_log.md 의 T8)');
  return o.join('\n') + '\n';
}

/* ---------- 영점 맞춤과 비교 ---------- */
// 뒤의 파일이 같은 줄을 덮어 쓴다. T6(줄 세기 맞추기) 뒤의 측정이 지금 수치다: t6b = 1차분 12줄, t6c = 지뢰 배율 0.42
// 2차분 무기: 첫 값으로 한 번 재서 기구 계수를 맞춘 뒤 계산기로 값을 바꿨으므로, 그 측정은 지금 값과 맞지 않아 fit 에 넣지 않고 맞춘 계수를 defaults() 에 고정한다
//   (전격기 _t5b -> m.efield 0.488, m.arc 0.596, m.ball 0.586. 저격포 _t5c -> m.ovk. T9d 에서 횡단탄·도탄(m.cross, m.rico)을 지우고 연속 사냥 m.stk, 점사 m.burst 를 더함. 산성 _t5d -> m.rain, m.slime, m.dsv, m.rot)
// T9c: 개틀링 궁극을 난사로 바꾼 뒤 잰 완성 (_t9c). 난사 기구 계수 m.spray 1.07 은 이 측정 하나로 맞춘 값 (같은 줄 뿌리의 측정/계산 1.06 을 뺀 나머지)
// T9d: 저격포 과잉 살상(궁극 연속 사냥, 줄 배율 2)과 점사 줄의 완성·뿌리 (_t9d). 이 측정과 상위까지(_t9d_up, fit 에는 안 넣음)로 m.ovk 0.5, m.ovkA 0.55 (증폭 몫),
//   m.stk 11.5 (연속 사냥. 세기 대부분이 '한 발에 잡을 수 있는 적부터' 표적 고르기에서 나오는데 계산기에는 적 체력이 섞인 모습이 없어 이 계수가 대신한다), m.burst 1.05 를 손으로 맞췄다
// T9e: 저격포 조준 레이저 줄을 고정·표식 이전·균열로 바꾼 뒤 잰 완성·뿌리 (_t9e)와 상위까지 (_t9e_up, fit 에는 안 넣음)로 m.mk 0.74 (고정해 쌓이는 겹. 집중 사격 효과도 이 계수가 대신한다),
//   m.xf 3.9 (이어받은 겹의 몫. 측정에서는 계산보다 훨씬 크다), m.crk 1.32 (균열) 를 손으로 맞췄다 (4시나리오 기하평균. 물량은 저격포가 못 버텨 n/a). m.exec, m.mkb 는 지움
// T10b: 연속 사냥의 대기 감소를 연속 처치마다 STREAK_F 배로 줄이고 (-90%, -54%, -32%…) 잰 과잉 살상 완성·뿌리 (_t10b, _t9d 의 rail.0 을 덮어 씀).
//   표적 고르기 몫 m.stkT 0.37 (대기 감소를 끈 측정 2.19 / 상위까지 1.76 에 맞춤)과 대기 감소 몫 m.stk 1.8 (완성 2.48) 을 따로 손으로 맞췄다 (전에는 m.stk 11.5 하나가 둘을 대신했다)
const SK_T6 = ['skill_eq_report_t6b.txt', 'skill_eq_report_t6c.txt', 'skill_eq_report_t9c.txt', 'skill_eq_report_t9d.txt', 'skill_eq_report_t9e.txt', 'skill_eq_report_t10b.txt'];
const skFiles = () => [path.join(__dirname, 'skill_eq_report.txt'), ...fs.readdirSync(__dirname).filter((f) => /^skill_eq_report_t3.*\.txt$/.test(f)).map((f) => path.join(__dirname, f)), ...SK_T6.map((f) => path.join(__dirname, f))];
function skMeasOf(sk) {
  const m = {};
  for (const x of sk) { const s = m[x.id] = m[x.id] || {}; (s['_' + x.mode] = s['_' + x.mode] || []).push(1 + x.meas); }
  for (const id in m) for (const k of ['full', 'root']) if (m[id]['_' + k] && m[id]['_' + k].length === CTX.length) m[id][k] = gm(m[id]['_' + k]);
  return m;
}
function fitAll() {
  const t0 = Date.now();
  const PP = defaults();
  const cells = loadItemEq(path.join(__dirname, 'item_eq.json'));
  // 확인 측정 (T8): 맞춤에는 넣지 않고 표본 밖 비교로만 보인다. 넣으면 계수가 크게 흔들려(레이저 타수 계수 7.1 -> 2.9 등) 측정 없는 항목의 예측이 뒤집힌다
  const chk = ITEM_EQ_EXTRA.flatMap((f) => loadItemEq(path.join(__dirname, f)).map((x) => Object.assign(x, { chkFile: f })));
  if (!cells.length) { console.error('tools/item_eq.json 이 없습니다. 먼저 node tools/item_eq.js'); process.exit(1); }
  const shs = {}; for (const x of cells) if (x.src !== 'P5') (shs[x.types[0]] = shs[x.types[0]] || []).push(x.lay.share);
  for (const t in shs) PP.w[t].sh = shs[t].reduce((a, b) => a + b, 0) / shs[t].length;   // 무기마다 운반 칸 피해 비율 (취약 효과의 팀 몫에 쓴다)
  const sk = loadSkillEq(skFiles());
  fitParams(cells, paramList('items'), PP, 6);
  fitParams(sk, paramList('skills'), PP, 3);
  fitExchange(PP);
  const meta = { date: new Date().toISOString().slice(0, 10), cells: cells.length, skillCells: sk.length, minutes: +((Date.now() - t0) / 60000).toFixed(1) };
  fs.writeFileSync(CAL_FILE, JSON.stringify({ meta, c: PP.c, w: PP.w, m: PP.m, x: PP.x }, null, 1) + '\n');
  for (const k of ['c', 'w', 'm', 'x']) P[k] = PP[k];
  const o = [];
  o.push('도형 디펜스 수치 가치 환산 계산기: 영점 맞춤 결과 (tools/value.js fit)');
  o.push(`생성: ${new Date().toISOString()}  자료: tools/item_eq.json ${cells.length}칸 (확인만: ${ITEM_EQ_EXTRA.join(', ')} ${chk.length}칸), 스킬 ${sk.length}칸 (${[...new Set(sk.map((x) => x.file))].join(', ')}), 소요 ${meta.minutes}분`);
  o.push('셀 = 측정 / 예측 (가치 %, ">" = 측정이 천장에 닿아 하한). 비 = (1+예측)/(1+측정) 의 기하평균 (1 이면 맞음). 맞춤에 쓴 자료와 비교하는 자료가 같다(표본 안 비교). 스킬 줄은 기구 계수(m)만 스킬 자료로 맞췄다.');
  const groups = new Map();
  for (const x of cells.concat(sk, chk)) { const k = x.src === 'SK' ? `SK|${x.id}|${x.mode}` : `${x.chkFile ? '확인 ' : ''}${x.team}|${x.id}|${x.g}|${x.vv}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
  const rows = [];
  for (const [k, xs] of groups) {
    const pr = xs.map((x) => predCell(x, P));
    const rr = gm(xs.map((x, i) => Math.max(0.02, 1 + (x.sat ? Math.min(pr[i], x.meas) : pr[i])) / Math.max(0.02, 1 + x.meas)));   // 천장 칸: 예측이 하한 이상이면 맞은 것으로
    rows.push({ k, xs, pr, rr, mAll: gm(xs.map((x) => Math.max(0.02, 1 + x.meas))) - 1, pAll: gm(pr.map((v) => Math.max(0.02, 1 + v))) - 1 });
  }
  const head = '  ' + pad('대상', 34) + CTX.map((c) => lpad(CTX_KO[c], 11)).join('') + lpad('종합', 11) + lpad('비', 6);
  let lastTeam = '';
  for (const r of rows) {
    const [team] = r.k.split('|');
    if (team !== lastTeam) { o.push(''); o.push(`[${team === 'SK' ? '진화 스킬 줄 (같은 무기 다섯 자루)' : team}]`); o.push(head); lastTeam = team; }
    const x0 = r.xs[0], lab = x0.src === 'SK' ? `${x0.id} ${SKILLS[x0.types[0]][+x0.id.split('.')[1]].name} ${x0.mode === 'full' ? '완성' : '뿌리'}` : `${x0.id} ${(x0.kind === 'part' ? PARTS : AUGS)[x0.id].name} ${GR[x0.g]}${x0.vv != null ? ' (' + x0.vv + ')' : ''}`;
    const cellsTxt = CTX.map((c) => { const i = r.xs.findIndex((x) => x.c === c); return lpad(i < 0 ? '-' : `${r.xs[i].sat ? '>' : ''}${Math.round(r.xs[i].meas * 100)}/${Math.round(r.pr[i] * 100)}`, 11); }).join('');
    o.push('  ' + pad(lab, 34) + cellsTxt + lpad(`${Math.round(r.mAll * 100)}/${Math.round(r.pAll * 100)}`, 11) + lpad(r.rr.toFixed(2), 6) + (r.rr > 1.25 || r.rr < 0.8 ? '  !' : ''));
  }
  o.push('');
  const itemRows = rows.filter((r) => !r.k.startsWith('SK') && !r.k.startsWith('확인')), skRows = rows.filter((r) => r.k.startsWith('SK')), chkRows = rows.filter((r) => r.k.startsWith('확인'));
  const within = (lo, hi, L) => L.filter((r) => r.rr >= lo && r.rr <= hi).length;
  o.push(`[요약] 항목(파츠·증강) ${itemRows.length}개 중 비 0.8~1.25 안 ${within(0.8, 1.25, itemRows)}개, 0.9~1.1 안 ${within(0.9, 1.1, itemRows)}개. 스킬 줄 ${skRows.length}개 중 0.8~1.25 안 ${within(0.8, 1.25, skRows)}개. 표본 밖 확인(T8) ${chkRows.length}개 중 0.8~1.25 안 ${within(0.8, 1.25, chkRows)}개.`);
  o.push('[크게 어긋난 것 (비 0.8 밑 또는 1.25 위)]');
  for (const r of rows.filter((r) => r.rr > 1.25 || r.rr < 0.8).sort((a, b) => Math.abs(Math.log(b.rr)) - Math.abs(Math.log(a.rr)))) o.push(`  ${pad(r.k, 34)} 측정 ${Math.round(r.mAll * 100)}  예측 ${Math.round(r.pAll * 100)}  비 ${r.rr.toFixed(2)}`);
  o.push('');
  o.push('[기지 항목: 짝 생존 gain(%) 측정 / 식. gain = aF F + aS S + aG G 로 맞춤 (표시 "비교만" 은 맞춤에 안 씀)]');
  o.push(`  aF ${P.x.aF.toFixed(3)}, aS ${P.x.aS.toFixed(3)}, aG ${P.x.aG.toFixed(3)}, 회복 시간 ${P.x.Treg}초 -> 1 S = ${(P.x.aS / P.x.aF).toFixed(2)} F, 1 G = ${(P.x.aG / P.x.aF).toFixed(2)} F`);
  for (const q of PAIR) { const f = pairFSG(q, P), y = q.gain.reduce((a, b) => a + b, 0) / q.gain.length; o.push(`  ${pad(q.id + ' ' + q.v + (q.w != null ? '/' + q.w : ''), 22)} F ${lpad(f.F.toFixed(1), 6)} S ${lpad(f.S.toFixed(1), 6)} G ${lpad(f.G.toFixed(1), 6)}  측정 ${lpad(y.toFixed(1), 6)} 식 ${lpad(f.gain.toFixed(1), 6)}  (${q.src})${q.chk ? ' 비교만' : ''}`); }
  o.push('');
  o.push('[계수] (tools/value_cal.json)');
  for (const c of CTX) o.push(`  ${pad(CTX_KO[c], 8)} 밀도 lam=${(CB[c].lam0 * P.c[c].lf).toFixed(2)} (적이 안 죽을 때 ${CB[c].lam0.toFixed(1)} x 생존 비율 ${P.c[c].lf.toFixed(2)})  처치 타수 K=${P.c[c].K.toFixed(2)}  대형 적 비중 ${(Math.min(0.98, CB[c].beta0 * P.c[c].bf) * 100).toFixed(0)}% (구성 ${(CB[c].beta0 * 100).toFixed(0)}% x ${P.c[c].bf.toFixed(2)})  군중 제어 cc=${P.c[c].cc.toFixed(2)}  먼 적 phi=${P.c[c].phi.toFixed(2)}`);
  for (const t of WEAPON_IDS) { const w = P.w[t]; o.push(`  ${pad(t, 8)} 타수 kw=${w.kw.toFixed(2)}  밀도 dw=${w.dw.toFixed(2)}  공속 효율 kr=${w.kr.toFixed(2)}  사거리 kg=${w.kg.toFixed(2)}  제어 ccw=${w.ccw.toFixed(2)}  대형 bw=${w.bw.toFixed(2)}  취약 팀몫 vt=${w.vt.toFixed(2)}  운반 피해 비율 ${w.sh != null ? (w.sh * 100).toFixed(0) + '%' : '-'}`); }
  o.push(`  스킬 기구: 위성 구체 접촉 ${P.m.orb.toFixed(2)}, 역장 ${P.m.fld.toFixed(2)}, 압착 ${P.m.crush.toFixed(2)}, 화염 산탄 ${P.m.flame.toFixed(2)}, 지뢰 ${P.m.mine.toFixed(2)}, 불바다 ${P.m.sea.toFixed(2)}, 융단 폭격 ${P.m.carpet.toFixed(2)}, 충격파 ${P.m.shock.toFixed(2)} (박격포 둘은 아직 영점 전)`);
  fs.writeFileSync(path.join(__dirname, 'value_fit.txt'), o.join('\n') + '\n');
  return { skMeas: skMeasOf(sk) };
}

/* ---------- 명령 ---------- */
Object.assign(module.exports, { buildTables, baseFSG, partVal, augVal, fitExchange, PAIR, pairFSG, loadItemEq, loadSkillEq, predCell, fitParams, paramList });
if (require.main === module) {
const args = process.argv.slice(2);
const cmd = args[0] || 'table';
if (cmd === 'fit' || cmd === 'table') {
  const info = cmd === 'fit' ? fitAll() : { skMeas: skMeasOf(loadSkillEq(skFiles())) };
  const txt = reportText(buildTables(P), P, info);
  fs.writeFileSync(path.join(__dirname, 'value_report.txt'), txt);
  console.log(cmd === 'fit' ? '저장: tools/value_cal.json, tools/value_fit.txt, tools/value_report.txt' : '저장: tools/value_report.txt');
} else if (cmd === 'item') {
  const id = args[1], g = args[2] != null ? +args[2] : 2, kind = PARTS[id] ? 'part' : AUGS[id] ? 'aug' : null;
  if (!kind) { console.error('모르는 항목: ' + id); process.exit(1); }
  const D = kind === 'part' ? PARTS[id] : AUGS[id];
  if (D.base || D.for === 'base') { const f = baseFSG(kind, id, g, null, null, P); console.log(`${id} ${D.name} ${GR[g]}: F ${f.F.toFixed(1)}, S ${f.S.toFixed(1)}, G ${f.G.toFixed(1)} -> 화력 가치 ${f.tot.toFixed(1)}`); }
  else {
    const ws = args[3] ? [args[3]] : kind === 'aug' && D.for !== 'all' ? [D.for] : WEAPON_IDS;
    console.log(`${id} ${D.name} ${GR[g]} (${kind === 'part' ? Core.partDesc({ id, g }) : Core.augDesc({ id, g })})`);
    console.log('  ' + pad('무기', 9) + CTX.map((c) => lpad(CTX_KO[c], 8)).join('') + lpad('종합', 8));
    for (const t of ws) { const e = kind === 'part' ? partVal(id, g, t, P) : augVal(id, g, t, P); console.log('  ' + pad(t, 9) + CTX.map((c) => lpad(pct(e[c]), 8)).join('') + lpad(pct(e.all), 8)); }
  }
} else if (cmd === 'line') {
  const [t, l] = args[1].split('.'), sc = args[2] != null ? +args[2] : null;
  const ln = SKILLS[t][+l], old = ln.nodes.map((n) => n.sc);
  if (sc != null) ln.nodes.forEach((n) => { if (n.nw) n.sc = sc; });
  const ref = statsOf(t, { evo: 1 }), mx = ln.nodes.map((n) => n.max);
  console.log(`${t}.${l} ${ln.name} 배율 ${ln.nodes[0].sc}  (같은 무기 다섯 자루 팀, 누적 R)`);
  console.log('  ' + pad('노드', 18) + pad('랭크', 5) + CTX.map((c) => lpad(CTX_KO[c], 8)).join('') + lpad('종합 R', 8));
  for (let tier = 0; tier < 3; tier++) for (let k = 1; k <= mx[tier]; k++) {
    const sk = zeroSk(); for (let q = 0; q < tier; q++) sk[+l][q] = mx[q]; sk[+l][tier] = k;
    const e = eqAll(statsOf(t, { evo: 1, sk }), ref, LAY.I5, P), nd = ln.nodes[tier];
    console.log('  ' + pad(nd.nw ? nd.nw.name : AUGS[nd.id].name, 18) + pad(k, 5) + CTX.map((c) => lpad((1 + e[c]).toFixed(2), 8)).join('') + lpad((1 + e.all).toFixed(2), 8));
  }
  ln.nodes.forEach((n, i) => { n.sc = old[i]; });
} else if (cmd === 'holdout') {   // 표본 밖 확인: 항목을 둘로 나눠 한쪽으로 맞추고 다른 쪽을 예측한다 (두 번 바꿔서)
  const cells = loadItemEq(path.join(__dirname, 'item_eq.json'));
  const ids = [...new Set(cells.map((x) => x.team + '|' + x.id))].sort();
  const h = (q) => { let a = 7; for (const ch of q) a = (a * 31 + ch.charCodeAt(0)) >>> 0; return a; };
  let N = 0, A = 0, B2 = 0; const bad = [];
  for (const fold of [0, 1]) {
    const test = new Set(ids.filter((k) => h(k) % 2 === fold)), PP = defaults(), shs = {};
    for (const x of cells) if (x.src !== 'P5') (shs[x.types[0]] = shs[x.types[0]] || []).push(x.lay.share);
    for (const t in shs) PP.w[t].sh = shs[t].reduce((a, b) => a + b, 0) / shs[t].length;
    fitParams(cells.filter((x) => !test.has(x.team + '|' + x.id)), paramList('items'), PP, 6);
    const g = new Map(); for (const x of cells.filter((y) => test.has(y.team + '|' + y.id))) { const k = x.team + '|' + x.id; if (!g.has(k)) g.set(k, []); g.get(k).push(x); }
    for (const [k, xs] of g) { const rr = gm(xs.map((x) => { const p = predCell(x, PP); return Math.max(0.02, 1 + (x.sat ? Math.min(p, x.meas) : p)) / Math.max(0.02, 1 + x.meas); })); N++; if (rr >= 0.8 && rr <= 1.25) A++; else bad.push(`${k} ${rr.toFixed(2)}`); if (rr >= 0.9 && rr <= 1.1) B2++; }
  }
  console.log(`표본 밖 예측: 항목 ${N}개 중 비 0.8~1.25 안 ${A}개, 0.9~1.1 안 ${B2}개`);
  console.log('25% 넘게 어긋남: ' + bad.join(', '));
} else { console.error('명령: table | fit | holdout | item <id> [등급] [무기] | line <무기>.<줄> [배율]'); process.exit(1); }
}

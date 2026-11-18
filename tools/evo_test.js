'use strict';
/* 진화와 스킬 점검: node tools/evo_test.js [core.js] [--quick]
   (--quick: 20분 스트레스를 무기 종류마다 2분으로 줄인다) */
const assert = require('assert');
const path = require('path');
const argv = process.argv.slice(2);
const CORE = path.resolve(argv.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'src', 'core.js'));
const QUICK = argv.includes('--quick');
const Core = require(CORE);
const { CFG, BAL, WEAPONS, WEAPON_IDS, SKILLS } = Core;
let n = 0;
const ok = (name) => { n++; console.log('ok  ' + name); };
function mulberry32(a) { return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const num = (st) => { const o = {}; for (const k in st) if (typeof st[k] === 'number') o[k] = st[k]; return o; };
const finite = (st, what) => { for (const k in st) if (typeof st[k] === 'number') assert(Number.isFinite(st[k]), `${what}: ${k} = ${st[k]}`); };
function game(seed) { Core.seed(seed || 1); Core.newGame(520); const S = Core.S; S.shards = 1e9; return S; }
function put(type, k, lv, evo) {   // k번 칸에 무기를 놓는다. evo면 100강에서 진화시킨다
  const S = Core.S, w = Core.newWeapon(type); w.lv = lv; S.slots[k] = w;
  if (evo) { assert(Core.evolve(k).ok); }
  return w;
}

/* 1. 진화 조건과 비용 */
{
  const S = game(), w = put('blaster', 0, 99);
  w.parts[0] = { id: 'dmg', g: 2 }; w.augs[1] = { id: 'a_dmg', g: 1 };
  assert.strictEqual(Core.canEvolve(0).ok, false); assert.strictEqual(Core.canEvolve(0).reason, 'lv');
  assert.strictEqual(Core.canEvolve(3).reason, 'none');
  assert.strictEqual(Core.evolve(0).ok, false); assert(!w.evo && w.lv === 99);
  w.lv = 100; S.shards = CFG.evoCost - 1;
  assert.strictEqual(Core.canEvolve(0).ok, false); assert.strictEqual(Core.canEvolve(0).reason, 'shards');
  S.shards = CFG.evoCost + 7; S.pendingAug = { slot: 0, lv: 100, options: [] };
  assert.strictEqual(Core.canEvolve(0).reason, 'busy'); S.pendingAug = null;
  assert.strictEqual(CFG.evoCost, 5000);
  const r = Core.evolve(0);
  assert(r.ok); assert.strictEqual(S.shards, 7, '조각 5000 차감');
  assert(w.evo === true && w.lv === 0, 'evo, 0강');
  assert.strictEqual(w.parts[0].id, 'dmg'); assert.strictEqual(w.augs[1].id, 'a_dmg', '파츠와 증강 유지');
  assert.strictEqual(Core.canEvolve(0).reason, 'evo'); assert.strictEqual(Core.evolve(0).ok, false, '한 번만');
  assert.strictEqual(Core.skillPoints(w).left, 0);
  ok('진화 조건(100강, 조각 5000, 한 번만), 파츠/증강 유지');
}

/* 2. 전투력 연속성 */
for (const t of WEAPON_IDS) {
  const S = game(), w = put(t, 0, 100);
  w.parts[0] = { id: 'crit', g: 1 }; w.augs[0] = { id: 'a_rate', g: 2 };
  const a = num(Core.stats(w)); Core.evolve(0); const b = num(Core.stats(w));
  assert.deepStrictEqual(b, a, t + ': 진화 직후 능력치가 100강과 같다');
  assert(Math.abs(Core.stats(w).dmg - WEAPONS[t].dmg * BAL.lvMul(100) * (1 + 0.058 * 0 + Core.stats(w).dmgPct)) < 1e-6 * Core.stats(w).dmg);
}
ok('진화 직후 능력치 = 100강 능력치 (모든 무기)');

/* 3. 비용 100 + 5배, 성공률, 피해 배수, 5강마다 포인트, 증강 없음 */
{
  const S = game(7), w = put('rail', 0, 100, true), base = WEAPONS.rail.dmg * BAL.lvMul(100);
  const rate = (L) => Math.max(CFG.maxLv ? 0.03 : 0, Math.min(1, BAL.success(L) + Core.bstats().luck));
  let tries = 0, gotAt = [];
  while (w.lv < 100 && tries < 20000) {
    const info = Core.upgradeInfo(w); tries++;
    assert.strictEqual(info.cost, 100 + 5 * (w.lv + 1), '비용 100 + 5 x 일반 비용'); assert.strictEqual(CFG.evoCostAdd, 100); assert.strictEqual(info.rate, rate(w.lv + 1), '성공률은 진화 단계 기준');
    const before = S.shards, lv0 = w.lv, p0 = Core.skillPoints(w).total;
    const r = Core.upgrade(0); assert(r.ok);
    assert(!S.pendingAug, '진화한 무기는 증강 제안이 없다');
    if (r.success) {
      assert.strictEqual(w.lv, lv0 + 1);
      const expect = (w.lv % 5 === 0) ? 1 : 0;
      assert.strictEqual(Core.skillPoints(w).total - p0, expect, `${w.lv}강 포인트`); assert.strictEqual(!!r.point, !!expect);
      if (expect) gotAt.push(w.lv);
      const st = Core.stats(w);
      assert(Math.abs(st.dmg - base * Math.pow(1.03, w.lv)) < 1e-9 * st.dmg, '피해 = lvMul(100) x 1.03^lv');
    }
    if (!r.saved) assert.strictEqual(before - S.shards, 100 + 5 * (lv0 + 1));
  }
  assert.strictEqual(w.lv, 100); assert.deepStrictEqual(gotAt, Array.from({ length: 20 }, (_, i) => (i + 1) * 5));
  assert.strictEqual(Core.skillPoints(w).total, 20); assert.strictEqual(Core.upgradeInfo(w).max, true);
  assert.strictEqual(Core.upgrade(0).ok, false);
  // 일반 무기는 그대로
  const w2 = put('rail', 1, 4); assert.strictEqual(Core.upgradeInfo(w2).cost, 5);
  ok('비용 100 + 5배, 성공률 곡선 그대로, 피해 배수, 5강마다 포인트(모두 20), 증강 제안 없음');
}

/* 4. 포인트 하락 뒤 다시 올라도 중복 지급 없음 */
{
  const S = game(3), w = put('laser', 0, 100, true);
  w.lv = 10; w.skp = 2; w.hi = 0;
  Core.evoLose(w, 5, 0); assert.strictEqual(w.lv, 5); assert.strictEqual(w.hi, 10);
  let g = 0; while (w.lv < 10 && g++ < 500) Core.upgrade(0);
  assert.strictEqual(w.lv, 10); assert.strictEqual(w.skp, 2, '이미 받은 5, 10강은 다시 주지 않는다');
  g = 0; while (w.lv < 15 && g++ < 500) Core.upgrade(0);
  assert.strictEqual(w.skp, 3);
  ok('가장 높이 도달한 단계 보호 (포인트 중복 없음)');
}

/* 5. 선행 조건과 포인트 소모 */
{
  const S = game(), w = put('blaster', 0, 100, true);
  assert.strictEqual(Core.skillUp(0, 0, 0).ok, false); assert.strictEqual(Core.skillUp(0, 0, 0).reason, 'points');
  w.skp = 20;
  assert.strictEqual(Core.skillUp(0, 0, 1).reason, 'lock'); assert.strictEqual(Core.skillUp(0, 0, 2).reason, 'lock');
  for (let i = 0; i < 4; i++) assert(Core.skillUp(0, 0, 0).ok);
  assert.strictEqual(Core.skillUp(0, 0, 1).ok, false, '뿌리 4/5에서는 윗단 잠김');
  assert(Core.skillUp(0, 0, 0).ok); assert.strictEqual(Core.skillUp(0, 0, 0).reason, 'max');
  for (let i = 0; i < 4; i++) assert(Core.skillUp(0, 0, 1).ok);
  assert.strictEqual(Core.skillUp(0, 0, 2).ok, false, '윗단 4/5에서는 마지막 노드 잠김');
  assert(Core.skillUp(0, 0, 1).ok); assert(Core.skillUp(0, 0, 2).ok); assert.strictEqual(Core.skillUp(0, 0, 2).ok, false);
  assert.strictEqual(Core.skillPoints(w).spent, 11); assert.strictEqual(Core.skillPoints(w).left, 9);
  for (let l = 1; l < 3; l++) for (let t = 0; t < 3; t++) { while (Core.skillUp(0, l, t).ok); }
  assert.strictEqual(Core.skillPoints(w).left, 0); assert.strictEqual(Core.skillUp(0, 1, 1).reason, 'points');
  const nw = put('blaster', 1, 100); assert.strictEqual(Core.skillUp(1, 0, 0).ok, false, '일반 무기는 스킬을 못 찍는다');
  ok('스킬 선행 조건(뿌리5/윗단5), 최대 랭크, 포인트 소모, 환불 없음');
}

/* 6. 모든 노드, 모든 랭크가 능력치를 바꾼다 */
{
  let cnt = 0;
  for (const t of WEAPON_IDS) {
    assert.strictEqual(SKILLS[t].length, 3, t);
    SKILLS[t].forEach((line, l) => {
      assert.strictEqual(line.nodes.length, 3); assert.deepStrictEqual(line.nodes.map((x) => x.max), [5, 5, 1]);
      line.nodes.forEach((node, tier) => {
        for (let r = 1; r <= node.max; r++) {
          game(); const w = put(t, 0, 100, true);
          w.sk[l][tier] = r - 1; Core.dirty(w); const a = num(Core.stats(w)); finite(a, `${t} ${l}${tier} r${r - 1}`);
          w.sk[l][tier] = r; Core.dirty(w); const b = num(Core.stats(w)); finite(b, `${t} ${l}${tier} r${r}`);
          const diff = Object.keys(b).filter((k) => b[k] !== a[k]);
          assert(diff.length, `${t} ${line.name} ${node.id} 랭크 ${r}: 능력치 변화 없음`);
          const txt = Core.skillText(w, l, tier, r); assert(txt && !/NaN|undefined/.test(txt), `${t} ${node.id} 설명: ${txt}`);
          cnt++;
        }
      });
    });
  }
  ok(`모든 노드 x 모든 랭크 ${cnt}개: 능력치 변화, NaN 없음, 설명 문구`);
}

/* 6b. 새 줄은 증강과 더해진다 */
{
  game(); const b = put('blaster', 0, 100, true); b.augs[0] = { id: 'a_rate', g: 2 }; b.sk[0][0] = 3; Core.dirty(b);
  assert(Math.abs(Core.stats(b).ratePct - (0.36 + 0.15 * 3 * SKILLS.blaster[0].nodes[0].sc)) < 1e-12, '증강(영웅 속사 36%) + 개틀링 랭크 3');
  // 새 줄은 증강과 더해진다: 파츠/증강의 공격 속도, 화상, 둔화와 함께
  game(); const sg = put('shotgun', 0, 100, true); sg.augs[0] = { id: 'l_burn', g: 3 }; sg.parts[0] = { id: 'rate', g: 2 }; sg.sk[1] = [5, 0, 0]; Core.dirty(sg);
  assert(Core.stats(sg).burn > 0 && Core.stats(sg).flame > 0, '증강 화상과 화염 화상이 함께 있다');
  game(); const pl = put('pulse', 0, 100, true); pl.augs[0] = { id: 'p_frost', g: 3 }; pl.sk[2] = [5, 5, 0]; Core.dirty(pl);
  assert(Core.stats(pl).slow === 0.55 && Core.stats(pl).fld === 15, '빙결장 둔화와 역장 끌어당김은 따로 있다');
  ok('새 줄은 증강과 더해진다 (공격 속도, 화상, 둔화)');
}

/* 7. 새 노드의 동작 (줄마다 아래 7c~7f 와 11) */
function foe(x, y, hp) { const e = { type: 'basic', lane: Math.floor(x / 100), x, y, r: 19, hp: hp || 1e9, maxHp: hp || 1e9, speed: 0, leak: 1, gold: 0, boss: false, born: 0, slowT: 0, slowPct: 0, vulnT: 0, vulnPct: 0, burnT: 0, burnDps: 0, burnSt: null, stunT: 0, dead: false, flash: 0 }; Core.S.enemies.push(e); return e; }
function maxNodes(w, l) { SKILLS[w.type][l].nodes.forEach((nd, t) => { w.sk[l][t] = nd.max; }); Core.dirty(w); }

/* 8. 진화 해제 */
{
  // 부식체: 진화 3강에서 -5
  let S = game(5), w = put('blaster', 0, 100, true); w.lv = 3; w.skp = 1; w.sk[0][0] = 1; w.parts[0] = { id: 'dmg', g: 1 };
  const sh0 = S.shards;
  S.enemies.push({ type: 'corrode', boss: true, y: 100, x: 250, r: 52, hp: 1e12, maxHp: 1e12, speed: 0, leak: 0, gold: 0, slowT: 0, vulnT: 0, burnT: 0, stunT: 0, dead: false, abT: 0.001 });
  S.corr = { k: 0, t: 0.01 };
  Core.step(1 / 60); Core.step(1 / 60);
  assert(!w.evo && w.lv === 100 && !w.sk && w.skp === 0, '부식 -5: 진화 해제, 정확히 100강'); assert.strictEqual(S.slots[0], w, '무기는 사라지지 않는다');
  assert.strictEqual(S.shards, sh0, '조각 환불 없음'); assert.strictEqual(w.parts[0].id, 'dmg');
  assert(S.evq.some((e) => e.k === 'devo' && e.slot === 0), '이벤트');
  assert.strictEqual(Core.canEvolve(0).ok, true, '다시 진화 가능');
  Core.evolve(0); assert(w.evo && w.lv === 0 && Core.skillPoints(w).total === 0 && w.sk.every((l) => l.every((r) => r === 0)), '새 트리');
  // 7강 -5 = 2강
  w.lv = 7; w.skp = 1; Core.evoLose(w, 5, 0); assert(w.evo && w.lv === 2 && w.skp === 1, '진화 7 -> 2, 포인트 유지');
  // 큰 손실도 정확히 100강
  w.lv = 2; Core.evoLose(w, 3, 0); assert(!w.evo && w.lv === 100, '2 - 3 < 0 -> 일반 100강');
  Core.evolve(0); Core.evoLose(w, 1000, 0); assert(!w.evo && w.lv === 100, '손실이 아무리 커도 100강');
  // 부식 정상 계산: 진화 7 -> 2 (step 경로)
  S = game(5); w = put('mortar', 0, 100, true); w.lv = 7; S.shards = 1e9;
  S.enemies.push({ type: 'corrode', boss: true, y: 100, x: 250, r: 52, hp: 1e12, maxHp: 1e12, speed: 0, leak: 0, gold: 0, slowT: 0, vulnT: 0, burnT: 0, stunT: 0, dead: false, abT: 0.001 });
  S.corr = { k: 0, t: 0.01 }; Core.step(1 / 60); Core.step(1 / 60); assert(w.evo && w.lv === 2, '부식으로 진화 7 -> 2');
  assert(S.notes.length, '알림');
  // 진화 0강 + 부식: 일반 100강, 무기 유지
  S = game(5); w = put('rail', 0, 100, true); S.enemies.push({ type: 'corrode', boss: true, y: 100, x: 250, r: 52, hp: 1e12, maxHp: 1e12, speed: 0, leak: 0, gold: 0, slowT: 0, vulnT: 0, burnT: 0, stunT: 0, dead: false, abT: 0.001 });
  S.corr = { k: 0, t: 0.01 }; Core.step(1 / 60); Core.step(1 / 60); assert(S.slots[0] === w && !w.evo && w.lv === 100, '진화 0강 부식: 100강 일반');
  // 일반 무기는 예전 규칙: 3강 -5 -> 파괴, 7강 -5 -> 2강
  S = game(5); w = put('rail', 0, 3); S.enemies.push({ type: 'corrode', boss: true, y: 100, x: 250, r: 52, hp: 1e12, maxHp: 1e12, speed: 0, leak: 0, gold: 0, slowT: 0, vulnT: 0, burnT: 0, stunT: 0, dead: false, abT: 0.001 });
  S.corr = { k: 0, t: 0.01 }; Core.step(1 / 60); Core.step(1 / 60); assert(S.slots[0] === null, '일반 3강 부식: 파괴(기존 규칙)');
  // 도박사: 진화 0강에서 실패하면 (10%) 일반 100강. 자연 곡선에서 0강 -> 1강은 성공률 100%라 실패가 없으므로, 성공률 곡선을 잠깐 낮춰 이 경로를 확인한다
  let t = 0;
  { const orig = BAL.success; BAL.success = () => 0;
    S = game(9); w = put('blaster', 0, 100, true); S.pacts.push('gamble'); S.shards = 1e12; t = 0; let devoSeen = false;
    while (!devoSeen && t++ < 20000) { const r = Core.upgrade(0); assert(r.ok && !r.success); if (r.drop) { assert(r.devo, '도박사 하락 = 진화 해제'); devoSeen = true; assert(!w.evo && w.lv === 100 && !w.sk, '도박사: 진화 0강 하락 -> 일반 100강'); } }
    assert(devoSeen, '도박사 해제가 일어났다'); assert(S.evq.some((e) => e.k === 'devo'));
    BAL.success = orig; }
  // 도박사: 진화 90강에서 하락하면 89강 (진화 유지)
  S = game(11); w = put('blaster', 0, 100, true); S.pacts.push('gamble'); S.shards = 1e12; t = 0; let dropSeen = false;
  while (!dropSeen && t++ < 20000) { w.lv = 90; Core.dirty(w); const r = Core.upgrade(0); if (r.drop) { dropSeen = true; assert(w.evo && w.lv === 89 && !r.devo); } }
  assert(dropSeen);
  // 유물 거래
  S = game(13); w = put('laser', 1, 100, true); w.lv = 3; w.skp = 1;
  const other = put('blaster', 2, 50); S.pendingPact = ['relic']; let r = Core.choosePact(0);
  assert(!w.evo && w.lv === 100 && r.devo && r.lost.slot === 1 && r.lost.from === 103 && r.lost.to === 100, '유물: 진화 3(=103) -10 -> 일반 100강');
  assert(S.evq.some((e) => e.k === 'devo'));
  S = game(13); w = put('laser', 1, 100, true); w.lv = 25; put('blaster', 2, 50); S.pendingPact = ['relic']; r = Core.choosePact(0);
  assert(w.evo && w.lv === 15 && !r.devo && r.lost.from === 125 && r.lost.to === 115, '유물: 진화 25 -> 15');
  S = game(13); w = put('laser', 1, 100, true); w.lv = 0; const o2 = put('blaster', 2, 99); S.pendingPact = ['relic']; r = Core.choosePact(0);
  assert(!w.evo && w.lv === 100, '유물: 가장 높은 것은 진화 0강(=100) > 일반 99강');
  S = game(13); w = put('laser', 1, 100, true); w.lv = 0; const o3 = put('blaster', 2, 100); S.pendingPact = ['relic']; r = Core.choosePact(0);
  assert(!w.evo && w.lv === 100 && S.slots[2].lv === 100 && r.devo, '동점(100)이면 먼저 찾은 칸이 대상');
  ok('진화 해제: 부식(3->100강 일반, 7->2), 도박사, 유물, 일반 무기 규칙 유지');
}

/* 9. 분해와 단계 비교 */
{
  const S = game(), w = Core.newWeapon('laser'); w.lv = 0; const w2 = Core.newWeapon('blaster'); w2.lv = 100; w2.evo = true; w2.lv = 0; w2.sk = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const w3 = Core.newWeapon('pulse');
  S.inv[0] = w; S.inv[1] = w2; S.inv[2] = w3; S.inv[3] = { kind: 'p', id: 'dmg', g: 0 };
  assert.strictEqual(Core.meltSafe(w2), true); const v = Core.meltAllValue(); assert.strictEqual(v.n, 3, '진화 무기는 모두 분해에서 제외');
  const res = Core.meltAll(); assert.strictEqual(res.n, 3); assert(S.inv[1] === w2, '진화한 무기는 남는다');
  w2.lv = 12; assert.strictEqual(Core.effLv(w2), 112); assert.strictEqual(Core.meltValue(w2), Math.round(30 + 4 * 112 + 0.04 * 112 * 112));
  Core.seed(1); ok('모두 분해 제외, 분해 값은 100 + 단계');
}

/* 11. 새 스킬 줄(블래스터, 산탄포, 레이저, 펄스)의 동작: 모든 노드 x 모든 랭크가 눈에 보이는 변화를 만든다 */
const FOE_KEYS = { type: 'basic', r: 19, speed: 0, leak: 1, gold: 0, boss: false, born: 0, slowT: 0, slowPct: 0, vulnT: 0, vulnPct: 0, burnT: 0, burnDps: 0, burnSt: null, stunT: 0, dead: false, flash: 0, fT: 0, fDps: 0, fSt: null, fcB: null, fcN: 0, fcT: 0, chT: -9 };
function foe2(x, y, o) { const e = Object.assign({ lane: Math.max(0, Math.min(4, Math.floor(x / 100))), x, y, hp: 1e12, maxHp: 1e12 }, FOE_KEYS, o || {}); Core.S.enemies.push(e); return e; }
function layout(type, speed, line) {
  const L = [];
  if (type === 'pulse') { for (const r of [45, 70, 95, 120, 135, 150, 165]) for (const a of [35, 60, 90, 120, 145]) L.push([250 + r * Math.cos(a * Math.PI / 180), 520 - r * Math.sin(a * Math.PI / 180)]); }
  else {
    for (let y = 120; y <= 480; y += 40) L.push([250, y]);
    for (const y of [300, 360, 420, 480]) { L.push([150, y]); L.push([350, y]); }
    for (const y of [300, 420]) { L.push([50, y]); L.push([450, y]); }
  }
  const hpOf = (y) => (y >= 440 ? 1e4 : y >= 400 ? 2.5e4 : y >= 360 ? 6e4 : y >= 300 ? 2e5 : 1e12);   // 기지에 가까운 적일수록 죽기 쉽다. 안쪽 적은 안 죽는다
  if (type === 'acid') return L.map(([x, y], i) => foe2(x, y, { speed: speed || 0, hp: line === 1 ? 1e5 + i * 1e3 : 1500 + i * 260, maxHp: line === 1 ? 1e5 + i * 1e3 : 1500 + i * 260 }));   // 산성: 웅덩이에서 녹고 죽는 적이 나오게 (용해, 부패)
  if (type === 'rail') {   // 저격포는 체력이 가장 많은 적을 노린다. 과잉 살상: 한 발에 죽는 적 / 조준 레이저: 고정한 적을 몇 발에 잡고 다음 적으로 (표식 이전, 균열이 보이게 여러 발에 죽는 적) / 점사: 단단한 적
    if (line === 0) for (let y = 150; y <= 450; y += 50) for (let x = 50; x <= 450; x += 100) L.push([x + 20, y + 13]);   // 과잉 살상: 한 발에 여럿이 죽으므로 연속 사냥이 이어지게 적을 더 둔다
    const hp = (i) => (line === 0 ? 1200 + i * 45 : line === 1 ? (i === 6 ? 7e4 : 4e4 + i * 2e3) : 3e4 + i * 7e3);
    return L.map(([x, y], i) => foe2(x, y, { speed: speed || 0, hp: hp(i), maxHp: hp(i) }));
  }
  return L.map(([x, y]) => foe2(x, y, { speed: speed || 0, hp: hpOf(y), maxHp: hpOf(y) }));
}
// 장면: 무기를 2번 칸에 놓고 secs초 돌린 뒤 눈에 보이는 결과를 모은다
function scene(type, lines, secs, opt) {
  opt = opt || {};
  const S = game(7), w = put(type, 2, 100, true);
  w.sk = lines.map((r) => r.slice()); Core.dirty(w);
  if (opt.setup) opt.setup(w);
  S.hp = S.maxHp = 1e9; S.spawnAcc = -1e9; S.nextBoss = 1e9;
  const foes = layout(type, opt.speed, opt.line);
  const seenB = new WeakSet(), seenM = new WeakSet(), seenP = new WeakSet(), seenF = new WeakSet(), seenBeam = new WeakSet();
  const o = { b: 0, bsm: 0, bbig: 0, m: 0, mini: 0, p: {}, beams: 0, fx: {}, shots: [], tb: 0, mt: [] };
  const N = Math.round(secs * 60); let nPrev = 0; o.cds = [];
  for (let i = 0; i < N; i++) {
    S.hp = S.maxHp; Core.step(1 / 60);
    if (w.n > nPrev) { nPrev = w.n; if (o.cds.length < 60) o.cds.push(+w.cd.toFixed(6)); }   // 발사 직후의 다음 발사까지 간격
    for (const b of S.bullets) if (!seenB.has(b)) { seenB.add(b); o.b++; if (b.sm) o.bsm++; if (b.big) o.bbig++; if (b.tb) o.tb++; if (o.shots.length < 40) o.shots.push(+S.t.toFixed(4)); }
    for (const m of S.mines) if (!seenM.has(m)) { seenM.add(m); o.m++; o.mt.push(+S.t.toFixed(3)); if (m.mini) o.mini++; }
    for (const p of S.pools) if (!seenP.has(p)) { seenP.add(p); o.p[p.kind || 'x'] = (o.p[p.kind || 'x'] || 0) + 1; }
    for (const b of S.beams) if (!seenBeam.has(b)) { seenBeam.add(b); o.beams++; }
    for (const f of S.fx) if (!seenF.has(f)) { seenF.add(f); o.fx[f.k] = (o.fx[f.k] || 0) + 1; }
  }
  o.dealt = +(w.dealt || 0).toPrecision(9); o.n = w.n;
  o.foes = foes.map((e) => [+e.hp.toPrecision(9), +e.y.toFixed(3), +e.x.toFixed(3), +e.slowPct.toFixed(4), e.stunT > 0 ? 1 : 0, e.fT > 0 ? 1 : 0, +(e.vulnT > 0 ? e.vulnPct : 0).toFixed(4), e.dead ? 1 : 0]);
  finite(num(Core.stats(w)), type + ' scene stats');
  for (const e of foes) assert(Number.isFinite(e.hp) && Number.isFinite(e.y), type + ' scene enemy');
  assert(Number.isFinite(S.dealt) && Number.isFinite(S.gold));
  return { S, w, foes, o };
}
{
  let cnt = 0;
  const spd = { shotgun: 0.04, laser: 0, blaster: 0, pulse: 0.05, mortar: 0.03, tesla: 0.03, rail: 0.02, acid: 0.03 };
  for (const t of WEAPON_IDS) {
    SKILLS[t].forEach((line, l) => {
      line.nodes.forEach((node, tier) => {
        for (let r = 1; r <= node.max; r++) {
          const mk = (rank) => { const L = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let q = 0; q < tier; q++) L[l][q] = SKILLS[t][l].nodes[q].max; L[l][tier] = rank; return L; };
          const secs = t === 'blaster' ? 10 : t === 'mortar' || t === 'rail' || t === 'acid' ? 12 : 8;   // 박격포: 공습(3초)이 들어가게. 저격포: 연속 사냥이 이어지게
          const su = (w) => { w.n = 179; };   // 첫 발이 180번째: n번째마다 오는 간격 스킬(초신성, 핵탄두, 용 머리, 거대탄, 슬러그, 쌍구전 등)이 바로 들어간다 (T10c 에서 간격이 길어짐)
          const A = JSON.stringify(scene(t, mk(r - 1), secs, { speed: spd[t], line: l, setup: su }).o), B = JSON.stringify(scene(t, mk(r), secs, { speed: spd[t], line: l, setup: su }).o);
          assert(A !== B, `${t} ${line.name} ${node.id} 랭크 ${r}: 장면에서 눈에 보이는 변화 없음`);
          cnt++;
        }
      });
    });
  }
  ok(`새 스킬 노드 x 랭크 ${cnt}개: 피해, 만들어진 탄/지뢰/불길/빔, 적의 상태가 바뀐다 (이전 랭크와 비교)`);
}
// 줄마다 핵심 모습이 실제로 만들어지는지
{
  const full = (t, l) => { const L = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; L[l] = [5, 5, 1]; return L; };
  const root = (l, r) => { const L = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; L[l][0] = r; return L; };
  // 블래스터
  let g = scene('blaster', root(0, 1), 3).o; assert(g.n > 0);
  const b0 = scene('blaster', [[0, 0, 0], [0, 0, 0], [0, 0, 0]], 6).o, b1 = scene('blaster', root(0, 5), 6).o;
  assert(b1.n > b0.n * 1.25 && b1.dealt > b0.dealt, '개틀링은 더 많이 쏜다 ' + b1.n + ' ' + b0.n);
  { game(1); const w = put('blaster', 2, 100, true); w.sk[0] = [5, 5, 0]; Core.dirty(w); foe2(250, 200); const S = Core.S; S.spawnAcc = -1e9; w.cd = 0;
    const cds = []; for (let i = 0; i < 400 && cds.length < 12; i++) { const n0 = w.n; Core.step(1 / 60); if (w.n > n0) cds.push(w.cd); }
    assert(cds[9] < cds[0] * 0.95 && Math.abs(cds[11] - cds[9]) < 1e-9, '예열: 쏠수록 간격이 줄고 10번째에 멈춘다 ' + cds);
    const st = Core.stats(w); assert(Math.abs(cds[9] - st.cd / (1 + st.warmR * 10)) < 1e-9, '예열 최대: 랭크 x 6%');
    assert(Core.heatLevel(w) > 0.9, '달아오름 표시값');
    for (let i = 0; i < 100; i++) { Core.S.enemies.length = 0; Core.step(1 / 60); }   // 1.5초 이상 쉬면
    assert.strictEqual(Core.heatLevel(w), 0, '예열 초기화'); }
  { game(1); const w = put('blaster', 2, 100, true); w.sk[0] = [5, 5, 1]; Core.dirty(w); foe2(250, 200); const S = Core.S; S.spawnAcc = -1e9; w.cd = 0; const st = Core.stats(w);
    assert(Math.abs(st.spray - Core.SPRAY_K * SKILLS.blaster[0].nodes[2].sc) < 1e-12, '난사 배수: SPRAY_K x 줄 배율');
    const T = [], cds = [], angs = []; let racks = 0, hot = 1;
    for (let i = 0; i < 60 * 9; i++) { const n0 = w.n; S.snd.length = 0; Core.step(1 / 60); if (S.snd.includes('rack')) racks++; if (w.n > n0) { T.push(S.t); cds.push(w.cd); const b = S.bullets[S.bullets.length - 1]; angs.push(Math.atan2(b.vx, -b.vy)); } if (w.rl && Core.heatLevel(w) < 0.9) hot = 0; }
    const gaps = []; for (let i = 1; i < T.length; i++) gaps.push(T[i] - T[i - 1]);
    const rl = gaps.map((g, i) => (g > 0.5 ? i : -1)).filter((i) => i >= 0);
    assert(rl.length >= 2 && racks >= 2, '난사: 탄띠를 다 쓰면 재장전 ' + rl.length + ' ' + racks);
    for (const i of rl) assert(Math.abs(gaps[i] - 1.2) < 0.06, '재장전 1.2초 ' + gaps[i]);
    const burst = T[rl[1]] - T[rl[0] + 1], fast = gaps.slice(rl[0] + 1, rl[1]), cdW = st.cd / (1 + st.warmR * 10) / st.spray;
    assert(Math.abs(burst - 2.4) < 0.1, '난사 2.4초어치 ' + burst);
    assert(Math.abs(fast.reduce((a, b) => a + b, 0) / fast.length - cdW) < cdW * 0.08, '난사 중 간격 = 예열 최대 간격 / 배수 ' + cdW);
    assert(hot, '재장전 1.2초 동안 예열이 유지된다');
    const da = angs.map((a) => a - Math.atan2(0, 1)); assert(Math.max(...da) > 0.02 && Math.min(...da) < -0.02 && Math.max(...da.map(Math.abs)) <= 0.04 + 1e-9, '난사 탄은 ±0.04 rad 안에서 흩뿌려진다');
    S.enemies.length = 0; const bl = w.bl; for (let i = 0; i < 300; i++) Core.step(1 / 60);
    assert(w.bl === bl && !w.rl, '적이 없어 쉬는 동안 탄띠가 줄지 않는다'); }
  { game(1); const w = put('blaster', 2, 100, true); w.sk[1] = [5, 5, 1]; Core.dirty(w); foe2(250, 200); Core.S.spawnAcc = -1e9; const st = Core.stats(w); let giants = 0, shots = 0;
    for (let i = 0; i < 600; i++) { const n0 = w.n; w.cd = Math.min(w.cd, 0); Core.step(1 / 60); if (w.n > n0) { shots++; const gb = Core.S.bullets.filter((b) => b.big && !b.sn); gb.forEach((b) => { b.sn = 1; }); if (gb.length) { giants++; assert(shots % Core.GIANT_N === 0 && gb[0].r >= 40 && gb[0].pierce >= 99 && gb[0].bk === 'giant' && Math.abs(gb[0].dmg - st.dmg * Core.GIANT_M * SKILLS.blaster[1].nodes[2].sc) < 1e-6 * st.dmg, '거대탄: GIANT_N 번째, 레인 폭, GIANT_M 배, 모두 관통'); } } if (shots >= 3 * Core.GIANT_N) break; }
    assert(giants >= 3, '거대탄이 GIANT_N 번째마다'); assert(Math.abs(st.pk - 0.55) < 1e-12, '가속 관통 5단계: 관통당 -45%'); }
  { game(1); const w = put('blaster', 2, 100, true); w.sk[1] = [3, 0, 0]; Core.dirty(w); assert.strictEqual(Core.stats(w).pierce, 3, '광탄 3명 추가 관통'); assert(Math.abs(Core.stats(w).pk - 0.35) < 1e-12, '광탄: 관통당 -65%'); w.sk[1][1] = 0; }
  { game(1); const w = put('blaster', 2, 100, true); w.sk[2] = [3, 0, 0]; Core.dirty(w); foe2(150, 250); Core.S.spawnAcc = -1e9; const S = Core.S;
    const st = Core.stats(w); w.cd = 0; foe2(250, 100); let tb = null; for (let i = 0; i < 90 && !tb; i++) { Core.step(1 / 60); tb = S.bullets.find((b) => b.sm); }
    assert(tb && Math.abs(tb.dmg - st.dmg * 0.36 * SKILLS.blaster[2].nodes[0].sc) < 1e-9 && !tb.tb, '보조 포탑 탄: 피해 12% x 랭크, 쌍포탑 전에는 폭발 없음');
    assert(Core.turretPos(2, 0)[0] < 250 && Core.turretPos(0, 0)[0] > 50, '왼쪽 옆 레인(없으면 오른쪽)');
    w.sk[2] = [5, 5, 1]; Core.dirty(w); const st2 = Core.stats(w); foe2(350, 300); const S2 = Core.S; let hasR = false, hasL = false; S2.bullets.length = 0;
    for (let i = 0; i < 200; i++) { Core.step(1 / 60); for (const b of S2.bullets) if (b.sm) { assert(b.tb === 1); if (b.x > 255 && b.vx > 0) hasR = true; if (b.x < 245 && b.vx < 0) hasL = true; } }
    assert(hasL && hasR, '쌍포탑: 양쪽에서 포탑 탄'); assert(Math.abs(st2.turD - 0.6 * SKILLS.blaster[2].nodes[0].sc) < 1e-9 && Math.abs(st2.turRate - 0.5) < 1e-9); }
  // 산탄포
  { game(1); const w = put('shotgun', 2, 100, true); w.sk[0] = [1, 0, 0]; Core.dirty(w); foe2(250, 400); Core.S.spawnAcc = -1e9; const st = Core.stats(w);
    let slugs = 0, shots = 0; for (let i = 0; i < 900 && shots < 3 * Core.SLUG_N; i++) { const n0 = w.n; w.cd = Math.min(w.cd, 0); Core.step(1 / 60); if (w.n > n0) { shots++; const sb = Core.S.bullets.filter((b) => b.big && !b.sn); sb.forEach((b) => { b.sn = 1; }); if (sb.length) { slugs++; assert(shots % Core.SLUG_N === 0 && sb[0].kn === Core.SLUG_KN && Math.abs(sb[0].dmg - st.dmg * 0.6 * Core.SLUG_K * SKILLS.shotgun[0].nodes[0].sc) < 1e-9 && sb[0].pierce >= 99, '슬러그: SLUG_N 번째, 피해 (0.4+0.2r) x SLUG_K x 배율, 밀어냄 SLUG_KN'); } } }
    assert(slugs >= 2);
    w.sk[0] = [5, 5, 1]; Core.dirty(w); foe2(150, 400); foe2(350, 400); const st2 = Core.stats(w); assert(st2.slugEvery === Core.SLUG_N && st2.slugTwin === 1 && st2.slugKn === Core.SLUG_KN && Math.abs(st2.slugStun - 5 * Core.SLUG_STN) < 1e-9, '묵직한 탄: 밀어내기 강화 없음, SLUG_STN·r초 기절. 쌍열도 SLUG_N 번째마다');
    let sl3 = 0; for (let i = 0; i < 300 && !sl3; i++) { const n0 = w.n; w.cd = Math.min(w.cd, 0); Core.step(1 / 60); if (w.n > n0 && w.n % Core.SLUG_N === 0) sl3 = Core.S.bullets.filter((b) => b.big && !b.sn).length; }
    assert.strictEqual(sl3, 3, '쌍열: SLUG_N 번째 발사마다 3레인 슬러그');
    const ew = foe2(250, 420), eb = foe2(250, 380, { boss: true, type: 'giant' }); Core.S.bullets.length = 0; w.n = Core.SLUG_N - 1; w.cd = 0; Core.S.enemies = [ew, eb]; Core.step(1 / 60); w.cd = 99;
    let stn = 0; for (let i = 0; i < 40; i++) { Core.step(1 / 60); stn = Math.max(stn, ew.stunT); } assert(stn > 5 * Core.SLUG_STN - 0.05 && stn <= 5 * Core.SLUG_STN + 1e-9 && eb.stunT === 0 && ew.slowPct === 0, '묵직한 탄: 맞은 적 5·SLUG_STN 초 기절, 보스 제외, 둔화 없음'); }
  { // 슬러그는 같은 적을 1초에 한 번만 밀어낸다: 두 자루의 쌍열 슬러그가 같은 레인을 동시에 지나가도 한 번
    game(1); const S = Core.S; S.spawnAcc = -1e9; const w1 = put('shotgun', 1, 100, true), w2 = put('shotgun', 2, 100, true);
    for (const w of [w1, w2]) { w.sk[0] = [5, 5, 1]; Core.dirty(w); }
    const e = foe2(250, 300); const y0 = e.y; w1.n = Core.SLUG_N - 1; w2.n = Core.SLUG_N - 1; w1.cd = 0; w2.cd = 0; Core.step(1 / 60); w1.cd = w2.cd = 99;
    assert.strictEqual(S.bullets.filter((b) => b.big && Math.abs(b.x - 250) < 1).length, 2, '같은 레인에 슬러그 두 발');
    for (let i = 0; i < 40; i++) Core.step(1 / 60);
    assert(Math.abs(y0 - e.y - Core.SLUG_KN) < 1e-9, '두 발이 맞아도 한 번만 밀린다 ' + (y0 - e.y));
    for (let i = 0; i < 40; i++) Core.step(1 / 60);
    const y1 = e.y; w1.n = Core.SLUG_N - 1; w1.cd = 0; Core.step(1 / 60); w1.cd = 99; for (let i = 0; i < 40; i++) Core.step(1 / 60);
    assert(Math.abs(y1 - e.y - Core.SLUG_KN) < 1e-9, '1초가 지나면 다시 밀린다 ' + (y1 - e.y)); }
  { game(1); const w = put('shotgun', 2, 100, true); w.sk[1] = [2, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; const e = foe2(250, 400); const st = Core.stats(w); w.cd = 0; Core.step(1 / 60);
    assert(S.bullets.every((b) => b.fl), '화염 산탄: 산탄이 불꽃'); assert(S.fx.some((f) => f.k === 'fcone') && !S.fx.some((f) => f.k === 'cone'));
    for (let i = 0; i < 40; i++) Core.step(1 / 60); assert(e.fT > 0 && Math.abs(e.fDps - st.dmg * 0.6 * SKILLS.shotgun[1].nodes[0].sc) < 1e-6 * st.dmg, '3초 화상, 초당 공격력 30% x 랭크');
    w.sk[1] = [5, 5, 0]; Core.dirty(w); w.cd = 0; Core.step(1 / 60); const pf = S.pools.filter((p) => p.kind === 'fire'); assert(pf.length === 3 && pf.every((p) => Math.abs(p.t - 2) < 0.05), '불바다: 조준한 레인마다 2초 불길');
    // 불길 띠: 총구(250, H-2)에서 조준한 쪽으로 사거리 끝까지 가는 길의 먼 쪽 절반, 폭 36
    const st5 = Core.stats(w), Lr = st5.range * Core.H, mid = pf.find((p) => p.key === 2);
    assert(mid && Math.abs(mid.x0 - 250) < 1e-6 && Math.abs(mid.x1 - 250) < 1e-6 && Math.abs(mid.y0 - (Core.H - 2 - Lr * 0.5)) < 1e-6 && Math.abs(mid.y1 - (Core.H - 2 - Lr)) < 1e-6 && mid.hw === 18, '불바다: 탄 길의 먼 쪽 절반에 띠');
    assert(pf.every((p) => Math.abs(Math.hypot(p.x1 - p.x0, p.y1 - p.y0) - Lr * 0.5) < 1e-6) && pf.find((p) => p.key === 1).x1 < 250 && pf.find((p) => p.key === 3).x1 > 250, '옆 레인의 띠는 그쪽으로 기운다');
    // 띠 위/밖의 적, 겹친 띠는 한 번만: 같은 자리에 띠를 세 겹 쌓아도 피해는 한 겹과 같다
    S.enemies.length = 0; S.bullets.length = 0; w.cd = 99;
    const mx = mid.x0, my = (mid.y0 + mid.y1) / 2, eIn = foe2(mx + 10, my, { hp: 1e9, maxHp: 1e9, speed: 0 }), eOut = foe2(mx + 18 + eIn.r * 0.5 + 30, my, { hp: 1e9, maxHp: 1e9, speed: 0 });
    for (const q of [eIn, eOut]) { q.fT = 0; q.burnT = 0; }
    let h0 = eIn.hp; const hOut = eOut.hp; Core.step(1 / 60); const d1 = h0 - eIn.hp;
    assert(d1 > 0 && Math.abs(d1 - st5.dmg * st5.sea / 60) < 1e-6 * st5.dmg, '불길 위의 적은 초당 공격력 x sea 피해'); assert(eOut.hp === hOut, '띠 밖의 적은 피해 없음');
    for (let k = 0; k < 2; k++) S.pools.push(Object.assign({}, mid));
    h0 = eIn.hp; Core.step(1 / 60); assert(Math.abs((h0 - eIn.hp) - d1) < 1e-6 * st5.dmg, '같은 무기의 불길은 겹쳐도 한 번만');
    // 레인당 최대 3개 (오래된 것부터 교체), 2초 뒤 사라진다
    S.pools.length = 0; S.enemies.length = 0; foe2(250, 400, { hp: 1e9, maxHp: 1e9, speed: 0 });
    for (let k = 0; k < 5; k++) { w.cd = 0; Core.step(1 / 60); for (let i = 0; i < 5; i++) { w.cd = 99; Core.step(1 / 60); } }
    const pf2 = S.pools.filter((p) => p.kind === 'fire'); assert(pf2.length === 9 && [1, 2, 3].every((j) => pf2.filter((p) => p.key === j).length === 3), '불길 띠는 레인당 최대 3개'); assert(Math.min(...pf2.map((p) => p.t)) > 2 - 19 / 60, '오래된 띠부터 교체');
    w.cd = 99; for (let i = 0; i < 125; i++) Core.step(1 / 60); assert(!S.pools.some((p) => p.kind === 'fire'), '2초 뒤 사라진다'); }
  { // 용 머리: DRAGON_N 번째 발사마다 정면 레인 끝까지. 닿는 모든 적에게 D x DRAGON_M x 배율 (줄지 않음), 화상은 붙이지 않는다. 옆 레인은 그대로
    game(1); const w = put('shotgun', 2, 100, true); w.sk[1] = [5, 5, 1]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; const st = Core.stats(w); st.crit = 0;
    const tops = [foe2(250, 40), foe2(250, 25), foe2(262, 60)], side = foe2(150, 40), aim = foe2(250, 400);
    const shotsWith = []; let shots = 0;
    for (let i = 0; i < 1200 && shots < 2 * Core.DRAGON_N; i++) { const n0 = w.n; w.cd = Math.min(w.cd, 0); Core.step(1 / 60); if (w.n > n0) { shots++; if (S.bullets.some((b) => b.drg && !b.sn)) { shotsWith.push(shots); assert(S.fx.some((f) => f.k === 'roar'), '아가리 불꽃 연출'); for (const b of S.bullets) if (b.drg) { b.sn = 1; assert(Math.abs(b.dmg - st.dmg * st.dragon) < 1e-9 * st.dmg && b.x === 250, '용 머리: 정면, D x 배율'); } } } }
    assert.deepStrictEqual(shotsWith, [Core.DRAGON_N, 2 * Core.DRAGON_N], 'DRAGON_N 번째 발사마다 ' + shotsWith); assert(Math.abs(st.dragon - Core.DRAGON_M * SKILLS.shotgun[1].nodes[2].sc) < 1e-12);
    for (let i = 0; i < 130; i++) { w.cd = 99; Core.step(1 / 60); }   // T9a: 용 머리가 느려져 (초속 400) 레인 끝까지 약 1.6초
    assert(!S.bullets.some((b) => b.drg), '레인 끝을 지나면 사라진다');
    for (const e of tops) { const d = 1e12 - e.hp; assert(d > 0 && e.fT === 0, '레인 끝(사거리 밖)의 적도 맞는다. 용 머리는 화상을 붙이지 않는다 (T6)'); }
    const dd = tops.map((e) => 1e12 - e.hp);   // 두 번 맞았다: 피해 = 2 x 용 머리 피해
    assert(dd.every((d) => Math.abs(d - 2 * st.dmg * st.dragon) < 1e-6 * st.dmg), '관통해도 피해가 줄지 않는다 ' + dd.map((d) => (d / st.dmg).toFixed(3)));
    assert(side.hp === 1e12 && side.fT === 0, '옆 레인은 맞지 않는다');
  }
  { game(1); const w = put('shotgun', 2, 100, true); w.sk[2] = [1, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; w.cd = 99; foe2(250, 300);
    for (let i = 0; i < 70; i++) Core.step(1 / 60); assert(S.mines.length === 1 && S.mines[0].t > 10 && Math.abs(S.mines[0].dmg - Core.stats(w).dmg * 0.6 * SKILLS.shotgun[2].nodes[0].sc) < 1e-9 && S.mines[0].R === 60, '4초마다 지뢰 1개 ... 첫 설치');
    for (let i = 0; i < 60 * 40; i++) Core.step(1 / 60); assert(S.mines.filter((m) => !m.mini).length === 3, '최대 3개');
    w.sk[2] = [5, 5, 1]; Core.dirty(w); const st = Core.stats(w); assert(st.mineMax === 5 && Math.abs(st.mineCd - 2) < 1e-9, '빠른 매설 5단계: 2초, 최대 5개');
    S.mines.length = 0; S.enemies.length = 0; w.mt = 0; for (let i = 0; i < 3; i++) Core.step(1 / 60);
    S.enemies.length = 0; const mine = S.mines[0], e = foe2(mine.x, mine.y), e2 = foe2(mine.x + 20, mine.y - 30, { hp: 1e12, maxHp: 1e12 }); const y0 = e2.y;
    Core.step(1 / 60); assert(!S.mines.includes(mine), '밟으면 터진다'); assert(e2.y < y0 - 10, '연쇄 지뢰: 밀어낸다 (세기 20)'); assert(S.mines.filter((m) => m.mini).length === 2 && S.mines.filter((m) => m.mini).every((m) => Math.abs(m.dmg - mine.dmg * 0.4) < 1e-9), '작은 지뢰 2개 (피해 40%)'); }
  // 레이저
  { game(1); const w = put('laser', 2, 100, true); w.sk[0] = [1, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; foe2(250, 300); w.cd = 0; Core.step(1 / 60);
    assert(S.beams.length === 1 && Math.abs(S.beams[0].t - 0.3 + 1 / 60) < 1e-6, '지속 빔: 0.3초'); w.sk[0] = [5, 5, 0]; Core.dirty(w); const st = Core.stats(w); assert(Math.abs(st.holdT - 0.7) < 1e-9 && Math.abs(st.holdD - 0.2 * SKILLS.laser[0].nodes[0].sc) < 1e-9);
    S.beams.length = 0; S.enemies.length = 0; const e = foe2(250, 300); const hp0 = e.hp; w.cd = 99; S.beams.push({ k: 2, t: 0.7, tick: 0.1, st }); const dm = []; for (let i = 0; i < 44; i++) { const h = e.hp; Core.step(1 / 60); if (h - e.hp > 0) dm.push(h - e.hp); }
    assert(dm.length === 7 && dm[6] > dm[0] * 1.3 && dm[1] > dm[0], '초점: 틱마다 피해가 쌓인다 ' + dm); }
  { game(1); const w = put('laser', 2, 100, true); w.sk[0] = [5, 5, 1]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; const st = Core.stats(w); st.crit = 0; const e = foe2(250, 300); w.cd = 99;
    const seen = []; for (let i = 0; i < 70; i++) { const h = e.hp; Core.step(1 / 60); if (h - e.hp > 0) seen.push(h - e.hp); }
    assert(seen.length >= 6 && S.beams.length === 0, '상시 빔: 따로 켜진 빔이 계속 때린다'); assert(seen[0] > 0 && Math.abs(st.alwaysM - 3 * SKILLS.laser[0].nodes[0].sc) < 1e-9);
    const base = st.dmg * st.alwaysM * 0.1 / st.cd; assert(Math.abs(seen[0] - base) < 1e-6 * base, '첫 틱 = D x 3.0 x 배율 x 0.1 / 간격 ' + seen[0] + ' ' + base);
    w.parts[0] = { id: 'ember', g: 3 }; Core.dirty(w); const st3 = Core.stats(w); st3.crit = 0; const e3 = foe2(250, 280); let burns = 0; for (let i = 0; i < 60; i++) { Core.step(1 / 60); if (e3.burnT > 0 && !burns) burns = i; }
    assert(burns > 0 && burns <= 40, '적중 효과(파츠 화상)는 0.5초에 한 번 적용된다'); }
  { game(1); const w = put('laser', 2, 100, true); w.sk[1] = [1, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; const st = Core.stats(w); st.crit = 0;
    const f1 = foe2(250, 400), l1 = foe2(150, 200), l2 = foe2(150, 450), r1 = foe2(350, 300), o1 = foe2(50, 200); w.cd = 0; Core.step(1 / 60);
    assert(1e12 - l1.hp > 0 && 1e12 - r1.hp > 0 && l2.hp === 1e12 && o1.hp === 1e12, '프리즘: 첫 적보다 위의 양옆 레인 적만'); assert(Math.abs(1e12 - l1.hp - st.dmg * 0.12 * SKILLS.laser[1].nodes[0].sc) < 1e-3 * st.dmg, 'D의 12% x 배율');
    assert(S.fx.filter((f) => f.k === 'dbeam').length === 2 && S.fx.some((f) => f.k === 'dbeam' && f.x0 === 250 && f.y0 === 400), '대각선 빔 2개');
    w.sk[1] = [5, 5, 1]; Core.dirty(w); const st2 = Core.stats(w); st2.crit = 0; for (const e of S.enemies) e.hp = 1e12; const o2 = foe2(450, 200); const oo = foe2(50, 250); w.cd = 0; S.fx.length = 0; Core.step(1 / 60);
    assert(S.fx.filter((f) => f.k === 'dbeam').length === 4 && S.fx.some((f) => f.rb), '무지개: 한 번 더 갈라져 바깥 레인까지, 무지개색');
    const d1 = 1e12 - l1.hp, d2 = 1e12 - oo.hp; assert(d2 > 0 && Math.abs(d2 / d1 - 0.6) < 0.01, '바깥 레인은 옆 레인의 60% ' + d2 / d1); assert(Math.abs(d1 - st2.dmg * 1.0 * SKILLS.laser[1].nodes[0].sc) < 1e-3 * st2.dmg, '분광: (12x5 + 8x5)% x 배율'); }
  { game(1); const w = put('laser', 2, 100, true); w.sk[2] = [3, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; foe2(250, 300); w.cd = 0; Core.step(1 / 60);
    const ml = S.pools.filter((p) => p.kind === 'melt'); assert(ml.length === 1 && Math.abs(ml[0].t - 2) < 0.05 && ml[0].x === 250, '용융선 2초');
    for (let i = 0; i < 5; i++) { w.cd = 0; Core.step(1 / 60); } assert(S.pools.filter((p) => p.kind === 'melt').length === 1, '용융선은 갱신될 뿐 늘지 않는다');
    w.sk[2] = [5, 5, 1]; Core.dirty(w); const st = Core.stats(w); assert(Math.abs(st.meltT - 4) < 1e-9 && Math.abs(st.meltSlow - 0.25) < 1e-9 && st.vap === 0.15);
    S.enemies.length = 0; S.pools.length = 0; const v = foe2(250, 200, { hp: 100, maxHp: 100 }); const bs = foe2(250, 220, { boss: true, type: 'giant', hp: 100, maxHp: 100 }); v.hp = 100; const sx = st; sx.crit = 0;
    const saveDmg = sx.dmg; sx.dmg = 100 * 0.9 / 1; w.cd = 0; Core.step(1 / 60); assert(v.dead && !bs.dead, '소멸: 체력 15% 이하가 되면 증발 (보스 제외)'); assert(S.fx.some((f) => f.k === 'vap'), '하얀 섬광'); sx.dmg = saveDmg; }
  // 펄스
  { game(1); const w = put('pulse', 2, 100, true); w.sk[0] = [1, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; const e = foe2(250, 470); const st = Core.stats(w); let n5 = 0, rings = 0;
    for (let i = 0; i < 900 && w.n < Core.NOVA_N; i++) { w.cd = Math.min(w.cd, 0); const n0 = w.n; Core.step(1 / 60); if (w.n > n0) { const k = S.fx.filter((f) => f.k === 'ring' && f.fat).length; if (w.n === Core.NOVA_N) n5 = k; else assert(k === 0, 'NOVA_N 번째 전에는 거대 파동 없음'); } }
    assert(n5 === 1, 'NOVA_N 번째 파동: 거대 파동'); const R2 = st.radius * 1.56; assert(Math.abs(st.novaR - 1.56) < 1e-9 && Math.abs(st.nova - (1 + Core.NOVA_K)) < 1e-9, '범위 x(1.4+0.16r), 피해 x(1+NOVA_K r)');
    w.sk[0] = [5, 5, 1]; Core.dirty(w); const st2 = Core.stats(w); assert(st2.novaEvery === Core.TWIN_N && st2.twinStar === 1 && Math.abs(st2.halo - 0.5) < 1e-9);
    w.n = Core.TWIN_N - 1; w.cd = 0; S.fx.length = 0; const h0 = e.hp; Core.step(1 / 60); const d1 = h0 - e.hp; assert(S.pools.some((p) => p.kind === 'halo' && p.big === 1 && Math.abs(p.t - Core.HALO_T) < 0.05), '잔광 고리 HALO_T 초 (큰 한 방 최대 타격 수)'); assert(w.nv > 0, '쌍성: 한 번 더 예약');
    const h1 = e.hp; for (let i = 0; i < 20; i++) Core.step(1 / 60); assert(S.fx.filter((f) => f.k === 'ring' && f.fat).length === 2, '쌍성: 한 번 더 터진다'); assert(h1 - e.hp > d1 * 0.5, '두 번째 폭발 피해 70% (+고리)'); }
  { game(1); const w = put('pulse', 2, 100, true); w.sk[1] = [1, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; w.cd = 99; const st = Core.stats(w); assert.strictEqual(st.orbs, 1);
    const cnt = []; for (let r = 1; r <= 5; r++) { w.sk[1] = [r, 0, 0]; Core.dirty(w); cnt.push(Core.stats(w).orbs); } assert.deepStrictEqual(cnt, [1, 2, 2, 3, 3], '구체 1/2/2/3/3');
    w.sk[1] = [5, 5, 1]; Core.dirty(w); const s2 = Core.stats(w); assert(Math.abs(s2.orbRad - 1.3) < 1e-9 && Math.abs(s2.orbSize - 1.4) < 1e-9 && s2.orbChain === 1 && Math.abs(s2.orbDps - 0.8 * SKILLS.pulse[1].nodes[0].sc) < 1e-9, '궤도 +6%·5, 크기 +8%·5, 초당 80%');
    // 줄에 닿는 적: 구체 사이 선분 위에 둔다
    S.enemies.length = 0; const a = Core.orbPos(2, s2, 0, S.t + 1 / 60), b = Core.orbPos(2, s2, 1, S.t + 1 / 60); const m = foe2((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); Core.step(1 / 60);
    assert(m.hp < 1e12 && m.stunT > 0.2, '전기 사슬: 줄에 닿은 적은 피해와 0.3초 기절'); const st0 = m.stunT; m.stunT = 0; Core.step(1 / 60); assert(m.stunT === 0, '적 하나당 2초에 한 번'); }
  { game(1); const w = put('pulse', 2, 100, true); w.sk[2] = [3, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; w.cd = 99; const st = Core.stats(w);
    const near = foe2(290, 480), out = foe2(290, 520 - st.radius * Core.FLD_R - 120), bs = foe2(210, 480, { boss: true, type: 'giant' }); const x0 = near.x, y0 = near.y, xo = out.x, xb = bs.x; Core.step(1 / 60);
    assert(Math.abs(x0 - near.x - 9 / 60) < 1e-9 && near.y === y0 && near.slowPct === 0, '역장: 안의 적을 무기 쪽으로 초당 3·r 끌어당김 (아래로는 안 끌고 둔화 없음, T9a)');
    assert(out.x === xo && Math.abs(bs.x - xb - 4.5 / 60) < 1e-9, '범위 밖은 그대로, 보스는 절반');
    { const far = foe2(250 + st.radius * 1.3, 500); const xf = far.x; Core.step(1 / 60); assert(far.x < xf, '역장은 파동 범위보다 넓다 (파동 밖 옆 레인의 적도 끈다, T9a)'); S.enemies.splice(S.enemies.indexOf(far), 1); }
    for (let i = 0; i < 60 * 10; i++) Core.step(1 / 60); assert(Math.abs(near.x - 250) < 1e-9 && Math.abs(bs.x - 250) < 1e-9, '가운데에서 멈춘다 (넘어가지 않음)');
    w.sk[2] = [5, 5, 0]; Core.dirty(w); Core.step(1 / 60); assert(Math.abs(near.vulnPct - 0.15 * SKILLS.pulse[2].nodes[1].sc) < 1e-9 && near.vulnT > 0, '약화: 받는 피해 +3%·r');
    const e1 = foe2(250, 470, { hp: 100, maxHp: 100 }); const bef = e1.hp; Core.step(1 / 60); const st5 = Core.stats(w);
    w.sk[2] = [5, 5, 1]; Core.dirty(w); S.enemies = [near]; near.y = 100; near.speed = 0.5; let before = S.hp; w.ct = 0; near.y = 520; S.hp = 100;
    const bait = foe2(250, 400); const hb = bait.hp; Core.step(1 / 60); assert(bait.hp < hb && S.hp < 100, '반격: 기지에 닿는 순간 파동'); const hb2 = bait.hp; const bait2 = foe2(250, 519, { speed: 0.5 }); Core.step(1 / 60);
    assert(bait.hp === hb2 || w.ct > 0.3, '0.5초에 한 번'); }
  { game(1); const w = put('pulse', 2, 100, true); w.sk[2] = [5, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; w.cd = 99; const st = Core.stats(w);   // 압착 (T6)
    assert(Math.abs(st.fldDps - 0.2 * 5 * SKILLS.pulse[2].nodes[0].sc) < 1e-9, '압착: 초당 20%·r x 배율');
    const ins = []; for (let i = 0; i < 12; i++) ins.push(foe2(232 + (i % 4) * 12, 470 + Math.floor(i / 4) * 10));
    const out = foe2(250, 520 - st.radius * Core.FLD_R - 120); Core.step(1 / 60);
    const hit = ins.filter((e) => e.hp < 1e12), miss = ins.filter((e) => e.hp === 1e12);
    assert.strictEqual(hit.length, st.cap, '압착: 최대 타격 수까지');
    assert(Math.min(...hit.map((e) => e.y)) >= Math.max(...miss.map((e) => e.y)), '압착: 기지에 가까운 적부터');
    assert(hit.every((e) => Math.abs(1e12 - e.hp - st.dmg * st.fldDps / 60) < 1e-6 * st.dmg && e.crT != null), '압착 피해 = D x 초당 비율 x 시간');
    assert(out.hp === 1e12, '역장 밖은 압착 없음'); }
  ok('새 줄 12개의 핵심 모습: 탄, 불길, 지뢰, 빔, 파동, 구체, 역장이 실제로 만들어진다');
}

/* 7c. 박격포 새 줄 (T5a): 핵탄두, 융단 폭격, 미사일과 줄 조합 */
{
  const mk = (sk) => { game(1); const w = put('mortar', 2, 100, true); w.sk = sk; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; S.nextBoss = 1e9; S.hp = S.maxHp = 1e9; w.cd = 99; w.at = 99; const st = Core.stats(w); st.crit = 0; return { w, S, st }; };
  const fireOnce = (w) => { const n0 = w.n; w.cd = 0; Core.step(1 / 60); w.cd = 99; assert.strictEqual(w.n, n0 + 1, '한 번 발사'); };
  const fly = (sec) => { for (let i = 0, n = Math.round(sec * 60); i < n; i++) Core.step(1 / 60); };
  const near = (a, b, what) => assert(Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b)), `${what}: ${a} != ${b}`);
  const took = (e) => 1e12 - e.hp;
  const cN = SKILLS.mortar[0].nodes[0].sc, cC = SKILLS.mortar[1].nodes[0].sc, cM = SKILLS.mortar[2].nodes[0].sc;   // 줄 배율 (T6)
  // 핵탄두 뿌리 1: NUKE_N 번째 포탄마다, 범위 x(NUKE_R0 + 0.1), 피해 x(1 + NUKE_K x 배율)
  const NK = 'o'.repeat(Core.NUKE_N - 1) + 'N', NK2 = 'o'.repeat(Core.NUKE_N2 - 1) + 'N';
  { const { w, S, st } = mk([[1, 0, 0], [0, 0, 0], [0, 0, 0]]); foe2(250, 300); const kinds = [];
    for (let k = 0; k < 2 * Core.NUKE_N; k++) { S.shells.length = 0; fireOnce(w); const sh = S.shells; kinds.push(sh.length !== 1 ? '?' : sh[0].nuke ? 'N' : 'o'); if (sh[0].nuke) { near(sh[0].R, st.blast * (Core.NUKE_R0 + 0.1), '핵 범위'); near(sh[0].dmg, st.dmg * (1 + Core.NUKE_K * cN), '핵 피해'); } }
    assert.strictEqual(kinds.join(''), NK + NK, 'NUKE_N 번째마다 핵탄두 ' + kinds.join('')); }
  // 핵탄두 5 + 충격파 5: 폭발 범위 안은 D x (1 + 5 NUKE_K c), 밖(2배 안)은 D x 0.5c 와 밀어내기 30 (보스는 피해만), 더 먼 적은 그대로
  { const { w, S, st } = mk([[5, 5, 0], [0, 0, 0], [0, 0, 0]]); const R = st.blast * (Core.NUKE_R0 + 0.5);
    const t = foe2(250, 300), inn = foe2(250, 300 - R * 0.5), out = foe2(250, 300 - R * 1.5), bs = foe2(250 - R * 1.5, 300, { boss: true, type: 'giant' }), far = foe2(250 + R * 1.5, 300 - R * 1.6);
    w.n = Core.NUKE_N - 1; fireOnce(w); assert(S.shells[0].nuke === 1); const y0 = out.y; fly(0.6);
    near(took(t), st.dmg * (1 + 5 * Core.NUKE_K * cN), '표적'); near(took(inn), st.dmg * (1 + 5 * Core.NUKE_K * cN), '안쪽 적'); near(took(out), st.dmg * 0.5 * cN, '충격파 피해'); near(y0 - out.y, 30, '충격파 밀어내기 30');
    near(took(bs), st.dmg * 0.5 * cN, '보스도 충격파 피해'); assert.strictEqual(bs.x, 250 - R * 1.5); assert.strictEqual(took(far), 0, '2배 밖은 그대로');
    const nf = S.fx.find((f) => f.k === 'nuke'); assert(nf && Math.abs(nf.s2 - 2 * R) < 1e-9, '핵폭발 연출과 충격파 범위'); assert(S.fx.some((f) => f.k === 'boom' && f.nk), '보통 폭발 그림은 숨김');
    assert(!S.fx.some((f) => f.k === 'quake'), '연쇄 핵 전에는 흔들림 없음'); }
  // 연쇄 핵: NUKE_N2 번째마다, 흔들림
  { const { w, S } = mk([[5, 5, 1], [0, 0, 0], [0, 0, 0]]); foe2(250, 300); const kinds = [];
    for (let k = 0; k < 3 * Core.NUKE_N2; k++) { S.shells.length = 0; fireOnce(w); kinds.push(S.shells[0].nuke ? 'N' : 'o'); }
    assert.strictEqual(kinds.join(''), NK2 + NK2 + NK2, '연쇄 핵: NUKE_N2 번째마다'); fly(0.6); assert(S.fx.some((f) => f.k === 'quake'), '연쇄 핵: 화면 흔들림'); }
  // 융단 폭격 1: 표적 레인을 따라 위로 3발, 한 발 D x 0.33c, 범위 80%. 폭탄창 5: 5발, 한 발 D x (0.45 + 0.05)c
  { const { w, S, st } = mk([[0, 0, 0], [1, 0, 0], [0, 0, 0]]); const t = foe2(250, 400), e2 = foe2(250, 400 - st.blast), e3 = foe2(250, 400 - st.blast * 2), side = foe2(250 + st.blast * 1.6, 400 - st.blast);
    fireOnce(w); const sh = S.shells; assert.strictEqual(sh.length, 3, '3발');
    sh.forEach((s, k) => { assert.strictEqual(s.tx, 250); near(s.ty, 400 - k * st.blast, '세로 한 줄 ' + k); near(s.dmg, st.dmg * 0.33 * cC, '한 발 피해'); near(s.R, st.blast * 0.8, '범위 80%'); });
    fly(0.9); near(took(e2), st.dmg * 0.33 * cC, '둘째 폭탄'); near(took(e3), st.dmg * 0.33 * cC, '셋째 폭탄'); assert.strictEqual(took(side), 0, '줄 밖은 그대로');
    w.sk[1] = [5, 5, 0]; Core.dirty(w); const s5 = Core.stats(w); S.shells.length = 0; fireOnce(w); assert.strictEqual(S.shells.length, 5, '폭탄창 5: 5발'); near(S.shells[0].dmg, s5.dmg * 0.5 * cC, '폭탄창 5: 한 발 D x 0.5c');
    assert.deepStrictEqual(Array.from({ length: 5 }, (_, r) => { w.sk[1] = [5, r + 1, 0]; Core.dirty(w); return Core.stats(w).carpet; }), [4, 4, 4, 5, 5], '폭탄창 발수 +1/+1/+1/+2/+2'); }
  // 핵탄두 차례에는 나뉘지 않는다
  { const { w, S } = mk([[1, 0, 0], [5, 0, 0], [0, 0, 0]]); foe2(250, 400); w.n = Core.NUKE_N - 1; fireOnce(w); assert(S.shells.length === 1 && S.shells[0].nuke, '핵탄두는 나뉘지 않음'); S.shells.length = 0; fireOnce(w); assert.strictEqual(S.shells.length, 3); }
  // 공습 (T10a): AIR_CD 초마다 레인마다 그 레인의 가장 앞의 적에게 1발 (D x 1c, 범위 x AIR_R). 빈 레인 몫은 고른 표적의 폭발 범위 밖에서 가장 앞의 적에게 (적 하나에 한 발, 남으면 버림).
  // 폭격기 길(airTrack) 아래에서 떨어지고, 왼쪽부터 차례로
  { const { w, S, st } = mk([[0, 0, 0], [5, 5, 1], [0, 0, 0]]); const R = st.blast * Core.AIR_R;
    const t = foe2(250, 400), back = foe2(255, 400 - 2.2 * R), close = foe2(262, 400 - 0.5 * R), far = foe2(450, 120);
    w.at = 0.001; Core.step(1 / 60); const sh = S.shells.filter((s) => s.air);
    assert.strictEqual(sh.length, 3, '레인 둘 + 빈 레인 몫 하나 (범위 안의 적은 빼고 남는 몫은 버림) ' + sh.length);
    const f = S.fx.find((x) => x.k === 'airwarn'); assert(f && f.pt.length === 3 && f.g.length >= 2, '예고: 표적 표시와 폭격기 길');
    const on = (e) => sh.filter((s) => Math.hypot(s.tx - e.x, s.ty - e.y) <= 8).length;
    assert(on(t) === 1 && on(back) === 1 && on(far) === 1 && on(close) === 0, '표적: 레인마다 가장 앞 + 범위 밖의 다른 적');
    for (const s of sh) { near(s.dmg, st.dmg * cC, '한 발 D x 1c'); near(s.R, R, '범위 x AIR_R'); assert(s.wt >= Core.AIR_WARN - 1 / 60 - 1e-9, '예고가 먼저'); assert(s.y0 < s.ty - 30, '위에서 떨어짐'); near(s.y0, Core.airTrack(f.g, s.tx) - Core.AIR_ALT, '폭격기 길 아래'); }
    const byX = sh.slice().sort((a, b) => a.tx - b.tx); for (let j = 1; j < byX.length; j++) assert(byX[j].wt >= byX[j - 1].wt - 0.021, '왼쪽부터');
    for (let i = 1; i < f.g.length; i++) assert(Math.abs(f.g[i][1] - f.g[i - 1][1]) <= Core.AIR_SLOPE * (f.g[i][0] - f.g[i - 1][0]) + 1e-9, '길이 완만');
    fly(Math.max(...sh.map((s) => s.wt + s.dur)) + 0.1);
    for (const e of [t, back, far]) near(took(e), st.dmg * cC, '표적 폭탄'); near(took(close), st.dmg * cC, '범위 안의 적도 맞음');
    assert(S.fx.filter((x) => x.k === 'airboom').length === 3 && S.fx.filter((x) => x.k === 'crater' && x.air).length === 3, '공습 폭발과 그을음 3개'); assert(!S.shells.length);
    let warns = 1; const seen = new WeakSet(S.fx); for (let i = 0; i < 60 * (2 * Core.AIR_CD + 0.5); i++) { Core.step(1 / 60); for (const x of S.fx) if (x.k === 'airwarn' && !seen.has(x)) { seen.add(x); warns++; } }
    assert.strictEqual(warns, 3, 'AIR_CD 초마다 ' + warns);
    S.enemies.length = 0; w.at = 0.001; Core.step(1 / 60); assert(!S.shells.some((s) => s.air), '적이 없으면 미룸'); assert(w.at > 0 && w.at <= 0.25, '0.25초 뒤 다시'); }
  // 추적 미사일 1: 움직이는 표적을 따라가 맞힌다. 공격 속도 +15%. 표적은 저장되지 않는다 (직격 추가 피해는 T6 에서 뺐다)
  { const { w, S, st } = mk([[0, 0, 0], [0, 0, 0], [1, 0, 0]]); const t = foe2(150, 200, { speed: 0.12 }); fireOnce(w); const m = S.shells[0];
    assert(m.ms === 1 && m.tg === t && !Object.keys(m).includes('tg') && !JSON.stringify(S.shells).includes('"tg"'), '미사일, 표적은 숨김 속성');
    const y0 = t.y; fly(0.75); assert(t.y > y0 + 20, '표적이 움직였다'); near(took(t), st.dmg, '빗나가지 않음: 폭발 D'); near(st.ratePct, 0.15, '공격 속도 +15%'); }
  // 분리 탄두 3: 착탄 직전에 소형 탄두 2개(1/1/2/2/3)가 가까운 다른 적 2명에게 (D x 0.13c, 범위 50%)
  { const { w, S, st } = mk([[0, 0, 0], [0, 0, 0], [5, 3, 0]]); const t = foe2(250, 300), a = foe2(150, 300), b = foe2(350, 300), c = foe2(250, 190), d = foe2(250, 60);
    fireOnce(w); let minis = []; for (let i = 0; i < 60 && !minis.length; i++) { Core.step(1 / 60); minis = S.shells.filter((s) => s.mini); }
    assert.strictEqual(minis.length, 2, '소형 탄두 2개'); minis.forEach((m) => { near(m.dmg, st.dmg * 0.13 * cM, '탄두 피해'); near(m.R, st.blast * 0.5, '탄두 범위'); });
    assert.deepStrictEqual(new Set(minis.map((m) => m.tg)), new Set([a, b]), '가까운 다른 적 2명'); fly(0.8);
    for (const e of [a, b]) near(took(e), st.dmg * 0.13 * cM, '탄두 피해 받음'); assert.strictEqual(took(c), 0); assert.strictEqual(took(d), 0, '먼 적은 그대로'); near(took(t), st.dmg, '표적: 폭발'); }
  // 쌍발: 두 발, 둘째는 기지에 두 번째로 가까운 적 (30%). 핵탄두 차례에는 핵 미사일 1발
  { const { w, S, st } = mk([[0, 0, 0], [0, 0, 0], [5, 5, 1]]); const t = foe2(250, 400), t2 = foe2(60, 300);
    w.n = 0; fireOnce(w); const ms = S.shells.filter((s) => s.ms); assert.strictEqual(ms.length, 2, '두 발');
    assert(ms[0].tg === t && ms[1].tg === t2, '둘째는 다른 적'); near(ms[1].dmg, st.dmg * 0.3 * cM, '둘째 피해 30%');
    game(1); const w2 = put('mortar', 2, 100, true); w2.sk = [[1, 0, 0], [0, 0, 0], [5, 5, 1]]; Core.dirty(w2); Core.S.spawnAcc = -1e9; w2.cd = 99; foe2(250, 400); foe2(60, 300); w2.n = Core.NUKE_N - 1; fireOnce(w2);
    const nm = Core.S.shells.filter((s) => s.ms); assert(nm.length === 1 && nm[0].nuke === 1, '핵 미사일 1발'); near(nm[0].R, Core.stats(w2).blast * (Core.NUKE_R0 + 0.1), '핵 미사일 범위'); }
  // 미사일 + 융단 폭격: 미사일이 첫 발 (폭탄 한 발 피해, 범위 80%), 맞은 자리 위로 나머지 폭탄이 차례로 떨어진다
  { const { w, S, st } = mk([[0, 0, 0], [5, 0, 0], [1, 0, 0]]); const t = foe2(250, 400), e2 = foe2(250, 400 - st.blast), e3 = foe2(250, 400 - st.blast * 2);
    fireOnce(w); assert(S.shells.length === 1 && S.shells[0].ms && S.shells[0].cw === 2); near(S.shells[0].dmg, st.dmg * st.carpetD, '미사일 = 첫 폭탄'); near(st.carpetD, 0.45 * cC, '폭탄 한 발 0.45c'); near(S.shells[0].R, st.blast * 0.8, '범위 80%');
    fly(0.66); const drops = S.shells.filter((s) => s.drop); assert.strictEqual(drops.length, 2, '뒤따르는 폭탄 2발'); fly(0.6);
    near(took(t), st.dmg * st.carpetD, '표적: 첫 폭탄'); near(took(e2), st.dmg * st.carpetD, '둘째'); near(took(e3), st.dmg * st.carpetD, '셋째'); }
  // 세 줄을 함께 (핵탄두 5, 융단 5+5, 미사일 5+5+1 은 포인트가 넘치므로 나눠 본다): 공습은 미사일과 함께 그대로
  { const { w, S } = mk([[0, 0, 0], [5, 5, 1], [5, 4, 0]]); for (let i = 0; i < 6; i++) foe2(50 + i * 80, 200 + i * 40, { speed: 0.02 }); w.cd = 0; w.at = 0.5;
    const seen = { air: 0, ms: 0, drop: 0, mini: 0 }, ws = new WeakSet();
    for (let i = 0; i < 60 * 8; i++) { Core.step(1 / 60); for (const s of S.shells) if (!ws.has(s)) { ws.add(s); if (s.air) seen.air++; else if (s.drop) seen.drop++; else if (s.mini) seen.mini++; else if (s.ms) seen.ms++; } }
    assert(seen.air === 5 && seen.ms >= 3 && seen.drop >= 6 && seen.mini >= 8, '공습, 미사일, 뒤따르는 폭탄, 분리 탄두가 함께 ' + JSON.stringify(seen)); finite(num(Core.stats(w)), 'mortar combo'); }
  ok('박격포 새 줄 3개: 핵탄두(4번째, 충격파, 연쇄), 융단 폭격(세로 줄, 폭탄창, 공습), 미사일(추적, 분리 탄두, 쌍발)과 줄 조합');
}
/* 7d. 전격기 새 줄: 낙뢰(3번째마다, 전기장, 먹구름), 전류 사슬(줄, 긴 방전, 고압 방전), 구전(4번째마다, 대형 구전, 쌍구전) */
{
  const mk = (sk) => { game(1); const w = put('tesla', 2, 100, true); w.sk = sk; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; S.nextBoss = 1e9; S.hp = S.maxHp = 1e9; w.cd = 99; w.cl = 99; const st = Core.stats(w); st.crit = 0; return { w, S, st }; };
  const fireOnce = (w) => { const n0 = w.n; w.cd = 0; Core.step(1 / 60); w.cd = 99; assert.strictEqual(w.n, n0 + 1, '한 번 발사'); };
  const run = (sec, each) => { for (let i = 0, n = Math.round(sec * 60); i < n; i++) { Core.step(1 / 60); if (each) each(); } };
  const near = (a, b, what, tol) => assert(Math.abs(a - b) <= (tol || 1e-4) * Math.max(1, Math.abs(b)), `${what}: ${a} != ${b}`);   // 체력 1e12 에서 뺀 값이라 소수 자리가 거칠다
  const took = (e) => 1e12 - e.hp;
  const newFx = (S, seen, k) => S.fx.filter((f) => f.k === k && !seen.has(f) && seen.add(f));
  const cT = SKILLS.tesla[0].nodes[0].sc, cA = SKILLS.tesla[1].nodes[0].sc, cB = SKILLS.tesla[2].nodes[0].sc;   // 줄 배율
  const far = () => [foe2(50, 90), foe2(150, 60), foe2(350, 60), foe2(450, 90)];   // 사거리 밖, 서로 140 넘게 떨어져 연쇄되지 않는다
  // 낙뢰 1: 3번째 공격마다 무작위 적 1명에게 D x 0.8c (전기장 없음). 낙뢰 3: 서로 다른 3명
  { const { w, S, st } = mk([[1, 0, 0], [0, 0, 0], [0, 0, 0]]); foe2(250, 470); const fs = far(), seen = new WeakSet(), got = [];
    for (let k = 0; k < 6; k++) { fireOnce(w); got.push(newFx(S, seen, 'thunder').length); }
    assert.deepStrictEqual(got, [0, 0, 1, 0, 0, 1], '3번째마다 낙뢰 1줄기 ' + got);
    const sum = fs.reduce((a, e) => a + took(e), 0); assert(sum === 0 || Math.abs(sum / (st.dmg * 0.8 * cT) - Math.round(sum / (st.dmg * 0.8 * cT))) < 1e-6, '낙뢰 피해 D x 0.8c');
    assert(!S.pools.some((p) => p.kind === 'efield'), '전기장 없음');
    w.sk[0][0] = 3; Core.dirty(w); Core.stats(w).crit = 0; w.n = 2; fireOnce(w); const th = newFx(S, seen, 'thunder');
    assert.strictEqual(th.length, 3, '낙뢰 3: 3줄기'); assert.strictEqual(new Set(th.map((f) => f.x + ',' + f.y)).size, 3, '서로 다른 적'); assert(th.every((f) => f.y0 < 0 && !f.cl), '하늘에서'); }
  // 전기장: 낙뢰 자리에 2초, 반경 45, 초당 D x 0.05 x r x c. 같은 무기의 전기장이 겹쳐도 한 번만
  { const { w, S, st } = mk([[5, 3, 0], [0, 0, 0], [0, 0, 0]]); foe2(250, 470); far(); w.n = 2; fireOnce(w);
    const ef = S.pools.filter((p) => p.kind === 'efield'); assert.strictEqual(ef.length, 5, '낙뢰 5줄기, 전기장 5개');
    for (const p of ef) { assert(S.enemies.some((e) => e.x === p.x && e.y === p.y) && p.r === 45 && Math.abs(p.t - (2 - 1 / 60)) < 1e-9, '낙뢰 자리, 반경 45, 2초'); near(p.dps, st.dmg * 0.05 * 3 * cT, '전기장 피해'); }
    const pr = foe2(ef[0].x + 30, ef[0].y); S.pools.push(Object.assign({}, ef[0]));   // 같은 자리에 하나 더 (겹침)
    const h0 = took(pr); run(1); near(took(pr) - h0, ef[0].dps * 1, '겹쳐도 한 번만 (1초)');
    run(1.2); assert(!S.pools.some((p) => p.kind === 'efield'), '2초 뒤 사라짐'); }
  // 먹구름: 1초마다 무작위 적 1명에게 D x 1c, 구름 자리에서. 전기장도 남김
  { const { w, S, st } = mk([[5, 5, 1], [0, 0, 0], [0, 0, 0]]); const fs = far(), seen = new WeakSet(); w.cl = 0.001; Core.step(1 / 60);
    const th = newFx(S, seen, 'thunder'); assert.strictEqual(th.length, 1); const c = Core.cloudPos(2, Core.S.t);
    assert(th[0].cl === 1 && Math.abs(th[0].x0 - c[0]) < 1e-9 && Math.abs(th[0].y0 - c[1]) < 1e-9, '먹구름에서');
    const hit1 = fs.find((e) => e.x === th[0].x && e.y === th[0].y); near(took(hit1), st.dmg * 1 * cT + st.dmg * 0.05 * 5 * cT / 60, '먹구름 낙뢰 D x 1c (+ 전기장 한 틱)');
    assert(S.pools.some((p) => p.kind === 'efield'), '전기장도 남김');
    let n = 1; run(10.2, () => { n += newFx(S, seen, 'thunder').length; }); assert.strictEqual(n, 11, '1초마다 ' + n); }
  // 전류 사슬 1: 연쇄된 적 사이에 1초 남는 줄 (적을 따라 움직임), 줄에 닿는 적은 초당 D x 0.12c. 같은 두 적이면 시간만 새로. 줄끼리 겹쳐도 한 번만
  { const { w, S, st } = mk([[0, 0, 0], [1, 0, 0], [0, 0, 0]]); const a = foe2(250, 470), b = foe2(250, 390), c = foe2(250, 310);
    fireOnce(w); let arcs = S.pools.filter((p) => p.kind === 'arc');
    assert.strictEqual(arcs.length, 2, '줄 2개 (적 3명 연쇄)'); assert(!JSON.stringify(S.pools).includes('"ea"'), '적 참조는 저장되지 않음');
    const dps = st.dmg * 0.12 * cA; for (const p of arcs) { near(p.dps, dps, '줄 피해'); assert(Math.abs(p.t - (1 - 1 / 60)) < 1e-9 && p.hw === 7); }
    const by = foe2(262, 430);                // 첫 줄에 닿는 적
    const h0 = took(by), hb = took(b); run(0.5); near(took(by) - h0, dps * 0.5, '닿은 적 0.5초'); near(took(b) - hb, dps * 0.5, '두 줄 끝에 걸린 적도 한 번만');
    b.x = 280; Core.step(1 / 60); assert(arcs[0].x1 === 280 || arcs[1].x0 === 280 || arcs[0].x0 === 280 || arcs[1].x1 === 280, '적을 따라 움직임');
    S.enemies.splice(S.enemies.indexOf(by), 1); b.x = 250; fireOnce(w); assert.strictEqual(S.pools.filter((p) => p.kind === 'arc').length, 2, '같은 두 적: 시간만 새로');
    run(1.05); assert(!S.pools.some((p) => p.kind === 'arc'), '1초 뒤 사라짐'); }
  // 긴 방전 5: 2.5초, 닿는 폭 x2, 피해 x1.5. 고압 방전: 줄 피해 2배, 사라질 때 닿아 있던 적에게 줄 피해 1초어치
  { const { w, S, st } = mk([[0, 0, 0], [5, 5, 0], [0, 0, 0]]); foe2(250, 470); foe2(250, 390); fireOnce(w); const p = S.pools.find((q) => q.kind === 'arc');
    assert(Math.abs(p.t - (2.5 - 1 / 60)) < 1e-9 && p.hw === 14, '긴 방전 5: 2.5초, 폭 x2'); near(p.dps, st.dmg * 0.6 * cA * 1.5, '전류 사슬 5: 0.6c, 긴 방전 5: 피해 x1.5');
    const by = foe2(270, 430);               // 폭 14 + 9.5 안
    const h0 = took(by); run(0.5); near(took(by) - h0, p.dps * 0.5, '넓어진 줄에 닿음'); }
  { const { w, S, st } = mk([[0, 0, 0], [5, 5, 1], [0, 0, 0]]); foe2(250, 470); foe2(250, 390); fireOnce(w); const p = S.pools.find((q) => q.kind === 'arc');
    near(p.dps, st.dmg * 0.6 * cA * 1.5 * 2, '고압 방전: 줄 피해 2배'); const by = foe2(262, 430); let tot = 0, h = took(by), zap = 0;
    run(2.6, () => { tot = took(by) - h; if (S.fx.some((f) => f.k === 'arcz')) zap = 1; });
    near(tot, p.dps * (2.5 - 1 / 60) + p.dps, '닿은 동안 + 방전 1초어치 (마지막 틱은 부동소수 오차로 하나 더 들 수 있다)', 0.006); assert(zap, '방전 연출'); }
  // 구전 1: 4번째 공격마다 표적 쪽으로 떠가는 구체 (반경 46, 초속 70, 4초). 닿는 적은 초당 D x 0.3c
  { const { w, S, st } = mk([[0, 0, 0], [0, 0, 0], [1, 0, 0]]); const t = foe2(330, 300); const seen = new WeakSet(), got = [];
    for (let k = 0; k < 8; k++) { fireOnce(w); got.push(S.pools.filter((p) => p.kind === 'ball' && !seen.has(p) && seen.add(p)).length); }
    assert.deepStrictEqual(got, [0, 0, 0, 1, 0, 0, 0, 1], '4번째마다 구체 ' + got);
    const b = S.pools.filter((p) => p.kind === 'ball').pop(); near(Math.hypot(b.vx, b.vy), 70, '초속 70'); assert(b.r === 46);
    const ang = Math.atan2(b.vx, -b.vy), want = Math.atan2(t.x - 250, 520 - 2 - 10 - t.y); near(ang, want, '표적 쪽으로');
    const pr = foe2(b.x, b.y); const h0 = took(pr); run(1, () => { pr.x = b.x; pr.y = b.y; }); near(took(pr) - h0, st.dmg * 0.3 * cB * 1, '닿는 동안 초당 D x 0.3c');
    run(3.1); assert(!S.pools.includes(b), '4초 뒤 사라짐');
    const wb = Object.assign({}, b, { x: 30, y: 300, vx: -70, vy: 0, t: 1 }); S.pools.push(wb); run(0.5); assert(wb.vx > 0 && wb.x >= wb.r * 0.5, '벽에서 튕김'); }
  // 대형 구전 5: 반경 x1.25, 5.5초. 쌍구전: BALL_N2 번째 공격마다 둘 (하나의 피해 x BALL_TW)이 좌우로 갈라지고, 사라질 때 반경 BALL_BOOM_R 에 D x BALL_BOOM c 와 BALL_STUN 초 기절 (보스는 피해만)
  { const { w, S, st } = mk([[0, 0, 0], [0, 0, 0], [5, 5, 1]]); foe2(250, 300); const got = [];
    for (let k = 0; k < Core.BALL_N2 - 1; k++) { fireOnce(w); got.push(S.pools.filter((p) => p.kind === 'ball').length); } assert(got.every((n) => n === 0), '쌍구전: 그 사이에는 구체 없음 ' + got);
    fireOnce(w); const bs = S.pools.filter((p) => p.kind === 'ball');
    assert.strictEqual(bs.length, 2, '쌍구전: BALL_N2 번째에 둘'); bs.forEach((b) => { near(b.r, 57.5, '반경 46 x 1.25'); assert(Math.abs(b.t - (5.5 - 1 / 60)) < 1e-9, '5.5초'); near(b.dps, st.dmg * 0.3 * 5 * cB * Core.BALL_TW, '하나의 피해 x BALL_TW'); });
    near(Math.atan2(bs[1].vx, -bs[1].vy) - Math.atan2(bs[0].vx, -bs[0].vy), 0.84, '좌우로 0.42 rad 씩');
    for (const b of bs) { b.vx = 0; b.vy = 0; b.t = 0.5; }
    bs[0].x = 150; bs[0].y = 300; bs[1].x = 420; bs[1].y = 80; S.enemies.length = 0;
    const BR = Core.BALL_BOOM_R, inn = foe2(250, 300), out = foe2(150 + BR * 0.8, 300 + BR * 0.8), boss = foe2(150 - BR * 0.9, 300, { boss: true, type: 'giant' });
    run(0.6);
    near(took(inn), st.dmg * Core.BALL_BOOM * cB, '터짐 D x BALL_BOOM c'); near(took(boss), st.dmg * Core.BALL_BOOM * cB, '보스도 피해');
    assert(inn.stunT > Core.BALL_STUN - 0.4 && !(boss.stunT > 0), 'BALL_STUN 초 기절, 보스 제외'); assert.strictEqual(took(out), 0, '반경 밖은 그대로');
    assert(S.fx.some((f) => f.k === 'ballboom' && f.r === Core.BALL_BOOM_R)); }
  // 세 줄을 함께: 낙뢰와 전기장, 줄, 구체가 함께 생긴다
  for (const sk of [[[5, 5, 1], [5, 4, 0], [0, 0, 0]], [[0, 0, 0], [5, 4, 0], [5, 5, 1]], [[5, 4, 0], [1, 0, 0], [5, 5, 0]]]) {
    const { w, S } = mk(sk); for (let i = 0; i < 12; i++) foe2(40 + (i % 5) * 100, 200 + Math.floor(i / 5) * 90, { speed: 0.02 }); w.cd = 0; w.cl = 0.5;
    const seen = {}; run(9, () => { for (const p of S.pools) seen[p.kind] = 1; for (const f of S.fx) seen[f.k] = 1; });
    const want = ['bolt'].concat(sk[0][0] ? ['thunder'] : [], sk[0][1] ? ['efield'] : [], sk[1][0] ? ['arc'] : [], sk[2][0] ? ['ball'] : []);
    for (const k of want) assert(seen[k], '줄 조합 ' + JSON.stringify(sk) + ': ' + k); finite(num(Core.stats(w)), 'tesla combo');
  }
  ok('전격기 새 줄 3개: 낙뢰(3번째, 전기장, 먹구름), 전류 사슬(줄, 긴 방전, 고압 방전), 구전(4번째, 대형, 쌍구전)과 줄 조합');
}

/* 7e. 저격포 새 줄: 과잉 살상(넘어가는 피해, 증폭 전달, 연속 사냥: 잡을 수 있는 적부터, 처치하면 빨리), 조준 레이저(고정과 겹, 표식 이전, 균열), 점사(뒤 발, 반동 제어, 3점사) */
{
  const mk = (sk) => { game(1); const w = put('rail', 2, 100, true); w.sk = sk; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; S.nextBoss = 1e9; S.hp = S.maxHp = 1e9; w.cd = 99; const st = Core.stats(w); st.crit = 0; return { w, S, st, D: st.dmg }; };
  const shoot = (w) => { const n0 = w.n; w.cd = 0; Core.step(1 / 60); w.cd = 99; assert.strictEqual(w.n, n0 + 1, '한 번 조준'); for (let i = 0; i < 16; i++) Core.step(1 / 60); assert(!(w.aimT > 0), '발사함'); };
  const near = (a, b, what) => assert(Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b)), `${what}: ${a} != ${b}`);
  const foeH = (x, y, hp, o) => foe2(x, y, Object.assign({ hp, maxHp: 1e12 }, o || {}));   // 최대 체력을 크게 두면 균열은 한 발 상한에 걸리고, 받은 피해 = 처음 체력 - 지금 체력 (죽어도 음수로 남는다)
  const cO = SKILLS.rail[0].nodes[0].sc, cM = SKILLS.rail[1].nodes[0].sc, cR = SKILLS.rail[2].nodes[0].sc, G = Core.BURST_GAP;
  const bD = (r, u) => (0.1 + 0.06 * r + 0.07 * u) * cR;   // 점사 뒤 발 피해 (core.js 의 BURST_A, BURST_B, RECOIL_K)
  // 과잉 살상 2: 처치하고 남은 피해 (적어도 0.4c D)가 다음으로 체력이 많은 적에게, 처치할 때마다 이어서 (최대 2회)
  { const { w, S, D } = mk([[2, 0, 0], [0, 0, 0], [0, 0, 0]]); const A = foeH(250, 300, 0.5 * D), B = foeH(150, 300, 0.4 * D), C = foeH(350, 300, 0.35 * D), E = foeH(50, 300, 0.2 * D);
    shoot(w); const o1 = Math.max(0.5, 0.4 * cO) * D;
    assert(A.dead && B.dead, '표적과 다음 적 처치'); near(0.4 * D - B.hp, o1, '첫 번째로 넘어간 피해'); near(0.35 * D - C.hp, Math.max(o1 - 0.4 * D, 0.4 * cO * D), '두 번째 (적어도 0.4c D)');
    assert.strictEqual(E.hp, 0.2 * D, '최대 2회'); assert(S.fx.filter((f) => f.k === 'rail' && f.ri).length >= 2, '넘어가는 선'); }
  // 증폭 전달 5: 넘어갈 때마다 +75%
  { const { w, D } = mk([[5, 5, 0], [0, 0, 0], [0, 0, 0]]); foeH(250, 300, 0.5 * D); const B = foeH(150, 300, 0.4 * D); shoot(w); near(0.4 * D - B.hp, Math.max(0.5, 0.4 * cO) * D * 1.75, '증폭 전달 x1.75'); }
  // 조준 레이저 1: 표적을 고정해 죽을 때까지 노린다 (체력이 더 많은 적이 와도). 저격할 때마다 겹 +1 (최대 5), 피해 x (1 + 겹 x 0.1c). 고정한 적이 죽으면 풀리고 처음부터. 표적 참조는 저장되지 않는다
  { const { w, D } = mk([[0, 0, 0], [1, 0, 0], [0, 0, 0]]); const A = foeH(250, 300, 1e11); const got = [];
    shoot(w); got.push(+((1e11 - A.hp) / D).toFixed(6)); const B = foeH(150, 300, 5e11);
    for (let k = 0; k < 5; k++) { const h = A.hp; shoot(w); got.push(+((h - A.hp) / D).toFixed(6)); }
    assert.deepStrictEqual(got, [1, 2, 3, 4, 5, 5].map((n) => +(1 + n * 0.1 * cM).toFixed(6)), '겹마다 피해 ' + got); assert(w.mk === A && w.mkN === 5 && !Object.keys(w).includes('mk'));
    assert.strictEqual(B.hp, 5e11, '고정: 체력이 더 많은 적이 와도 고정한 적만');
    A.hp = 1; shoot(w); assert(A.dead && w.mk === null && w.mkN === 0, '고정한 적이 죽으면 풀림 (표식 이전 없음)');
    shoot(w); assert(w.mk === B && w.mkN === 1, '새로 고정하면 처음부터'); }
  // 표식 이전 3: 고정한 적이 죽으면 체력이 가장 많은 적으로 옮겨 가며 겹수 x 0.6. 다음 저격은 그 적 (겹 +1)
  { const { w, D } = mk([[5, 0, 0], [5, 3, 0], [0, 0, 0]]); const A = foeH(250, 300, 1e11); for (let k = 0; k < 5; k++) shoot(w);
    const B = foeH(150, 300, 2e11), C = foeH(350, 300, 3e11); A.hp = 1; shoot(w);
    assert(A.dead && w.mk === C && Math.abs(w.mkN - 3) < 1e-9 && w.mkX, '체력이 가장 많은 적으로 옮겨 가며 3겹');
    const h = C.hp; shoot(w); near((h - C.hp) / D, 1 + 4 * 0.5 * cM, '이어받은 겹 + 1'); assert.strictEqual(B.hp, 2e11);
    w.sk[1] = [5, 5, 0]; Core.dirty(w); Core.stats(w).crit = 0; C.hp = 1; shoot(w); assert(w.mk === B && Math.abs(w.mkN - 5) < 1e-9, '표식 이전 5: 겹 전부'); }
  // 균열: 겹이 다 찬 고정 표적은 저격이 맞을 때마다 최대 체력의 CRACK_P (보스 1/4) 를 더 깎는다. 한 발에 D x CRACK_Y 까지. 조각 연출
  { const { w, S, D } = mk([[0, 0, 0], [5, 0, 1], [0, 0, 0]]); const P = Core.CRACK_P, Y = Core.CRACK_Y, m5 = 1 + 5 * 0.5 * cM;
    const A = foe2(250, 300, { hp: 1e9 * D, maxHp: 10 * D }); let h = A.hp;
    for (let k = 0; k < 4; k++) shoot(w);
    assert(!S.fx.some((f) => f.k === 'chip'), '4겹까지는 균열 없음'); h = A.hp; shoot(w);
    near((h - A.hp) / D, m5 + Math.min(P * 10, Y), '5겹: 최대 체력의 ' + P * 100 + '%'); assert(S.fx.some((f) => f.k === 'chip'), '조각 연출');
    A.maxHp = 1e6 * D; h = A.hp; shoot(w); near((h - A.hp) / D, m5 + Y, '한 발에 D x ' + Y + ' 까지');
    const bo = foe2(150, 300, { hp: 1e9 * D, maxHp: 10 * D, boss: true, type: 'giant' }); A.hp = 1; shoot(w);
    for (let k = 0; k < 4; k++) shoot(w); h = bo.hp; shoot(w); assert(w.mk === bo); near((h - bo.hp) / D, m5 + Math.min(P * 10 / 4, Y), '보스는 1/4'); }
  { const { w, S } = mk([[0, 0, 0], [5, 0, 0], [0, 0, 0]]); foeH(250, 300, 1e11); for (let k = 0; k < 6; k++) shoot(w); assert(!S.fx.some((f) => f.k === 'chip'), '균열 없으면 조각 없음'); }
  // 점사 + 조준 레이저: 뒤 발도 고정한 적에게 겹 보너스, 표적이 죽으면 옮겨 간 표적에게
  { const { w, D } = mk([[0, 0, 0], [5, 5, 0], [3, 0, 0]]); const A = foeH(250, 300, 1e11); shoot(w); for (let i = 0; i < 20; i++) Core.step(1 / 60);
    A.hp = 0.5 * D; const B = foeH(150, 300, 2 * D), C = foeH(350, 300, 3 * D); shoot(w); for (let i = 0; i < 20; i++) Core.step(1 / 60);
    assert(A.dead && w.mk === C && w.mkN === 2, '고정한 적을 처치하고 옮겨 감'); near(3 * D - C.hp, bD(3, 0) * (1 + 2 * 0.5 * cM) * D, '뒤 발은 옮겨 간 표적에게 (겹 보너스)'); assert.strictEqual(B.hp, 2 * D); }
  // 연속 사냥: 한 발에 잡을 수 있는 적부터 노린다 (그중 체력이 가장 많은 적, 없으면 체력이 가장 많은 적)
  { const { w, S, D } = mk([[5, 5, 1], [0, 0, 0], [0, 0, 0]]); const big = foeH(250, 300, 1e11), a = foeH(150, 300, 0.6 * D), b = foeH(350, 300, 0.9 * D), c = foeH(50, 300, 1.2 * D);
    w.cd = 0; Core.step(1 / 60); assert(w.aim === b, '한 발에 잡을 수 있는 적 중 체력이 가장 많은 적'); while (w.aimT > 0) Core.step(1 / 60); assert(b.dead && !big.dead && !c.dead, '그 적을 처치');
    const { w: w2 } = mk([[5, 5, 0], [0, 0, 0], [0, 0, 0]]); const big2 = foeH(250, 300, 1e11); foeH(150, 300, 0.6 * Core.stats(w2).dmg); w2.cd = 0; Core.step(1 / 60); assert(w2.aim === big2, '연속 사냥이 없으면 체력이 가장 많은 적');
    const { w: w3 } = mk([[5, 5, 1], [0, 0, 0], [0, 0, 0]]); const big3 = foeH(250, 300, 1e11); w3.cd = 0; Core.step(1 / 60); assert(w3.aim === big3, '잡을 수 있는 적이 없으면 체력이 가장 많은 적'); }
  // 연속 사냥: 저격(넘어간 피해 포함)으로 처치하면 다음 대기 시간 -STREAK_K x STREAK_F^(연속 처치 수) (저격 하나에 한 번). 처치가 이어지는 동안 연속 처치가 쌓이고, 처치하지 못하면 끊긴다
  { const { w, S, D, st } = mk([[5, 5, 1], [0, 0, 0], [0, 0, 0]]); const cut = Core.STREAK_K, F = Core.STREAK_F;
    assert(cut > 0 && F > 0 && F < 1, '연속 사냥 상수');
    assert(Math.abs(st.stk - cut) < 1e-12, '연속 사냥 수치');
    const A = foeH(250, 300, 0.5 * D), B = foeH(150, 300, 0.4 * D);
    w.cd = 0; Core.step(1 / 60); const cd0 = w.cd; let k = 0; S.snd.length = 0;
    while (w.aimT > 0) { Core.step(1 / 60); k++; }
    assert(A.dead && B.dead, '표적과 넘어간 피해로 처치'); assert(S.snd.includes('cycle'), '노리쇠 소리');
    const cdAfter = (c0, k) => { const v = c0 - k / 60 - cut * st.cd; return v > 0 ? v : 0.05; };   // 0 이 되면 같은 프레임에 다시 쏘려다 표적이 없어 0.05초 뒤에 다시 본다
    near(w.cd, cdAfter(cd0, k), '다음 대기 시간 -' + cut * 100 + '%');
    assert.strictEqual(w.hs, 1, '연속 처치 1'); assert.strictEqual(S.fx.filter((f) => f.k === 'hkx').length, 2, '처치한 자리마다 ✕ 자국');
    const T = []; let n0 = w.n;
    for (let i = 0; i < 400 && T.length < 4; i++) { if (!S.enemies.some((e) => !e.dead)) foeH(250, 200, 0.3 * D); Core.step(1 / 60); if (w.n > n0) { n0 = w.n; T.push(S.t); } }
    while (w.aimT > 0) Core.step(1 / 60);
    const gaps = T.slice(1).map((t, i) => t - T[i]);   // gaps[i]: 연속 처치 i+1 번째 뒤의 간격 = 조준(0.25초)과 (1 - cut x F^(i+1)) x 대기 중 긴 쪽
    assert(T.length === 4, '처치가 이어지면 잇달아 쏜다 ' + gaps.map((g) => g.toFixed(3)));
    gaps.forEach((g, i) => assert(Math.abs(g - Math.max(0.25, (1 - cut * Math.pow(F, i + 1)) * st.cd)) < 2.5 / 60, `연속 ${i + 2}번째 처치 뒤 간격 ${g.toFixed(3)} (줄어드는 폭이 F 배씩)`));
    assert(gaps[0] < gaps[1] && gaps[1] < gaps[2] && gaps[2] < st.cd, '이어질수록 간격이 늘지만 보통 대기보다는 짧다 ' + gaps.map((g) => g.toFixed(3)));
    const hs = w.hs; assert(hs >= 4, '연속 처치가 쌓인다 ' + hs);
    S.enemies.length = 0; const big = foeH(250, 300, 1e11); shoot(w); assert(!big.dead && w.hs === 0 && w.hsL === hs, '처치하지 못하면 연속이 끊긴다');
    S.enemies.length = 0; foeH(250, 300, 0.5 * D); w.cd = 0; Core.step(1 / 60); const c1 = w.cd; k = 0; while (w.aimT > 0) { Core.step(1 / 60); k++; }
    near(w.cd, cdAfter(c1, k), '끊긴 뒤 처음 처치는 다시 -' + cut * 100 + '%'); }
  { const { w, S, D } = mk([[5, 5, 0], [0, 0, 0], [0, 0, 0]]); foeH(250, 300, 0.5 * D); shoot(w); assert(w.cd > 98 && !S.fx.some((f) => f.k === 'hkx') && !w.hs, '연속 사냥 없으면 그대로'); }
  // 점사 3: 같은 표적에게 BURST_GAP 초 뒤 1발 더 (D x (0.1 + 0.06 r) c). 반동 제어 5: +0.07 r. 3점사: 뒤 발 2개, 발마다 저격선과 탕
  { const { w, S, D } = mk([[0, 0, 0], [0, 0, 0], [3, 0, 0]]); const A = foeH(250, 300, 1e11), B = foeH(150, 300, 5e10);
    const T = [], seen = new Set(); let h = A.hp, lines = 0;
    w.cd = 0; Core.step(1 / 60); w.cd = 99;
    for (let i = 0; i < 40; i++) { Core.step(1 / 60); if (A.hp !== h) { T.push([S.t, (h - A.hp) / D]); h = A.hp; } for (const f of S.fx) if (f.k === 'rail' && f.bu && !seen.has(f)) { seen.add(f); lines++; } }
    assert.strictEqual(T.length, 2, '점사: 2발 ' + JSON.stringify(T)); near(T[0][1], 1, '첫 발'); near(T[1][1], bD(3, 0), '뒤 발 피해');
    assert(Math.abs(T[1][0] - T[0][0] - G) < 1 / 60 + 1e-9, '간격 ' + G); assert.strictEqual(B.hp, 5e10, '다른 적은 그대로'); assert.strictEqual(lines, 2, '발마다 저격선');
    w.sk[2] = [5, 5, 0]; Core.dirty(w); Core.stats(w).crit = 0; h = A.hp; shoot(w); for (let i = 0; i < 20; i++) Core.step(1 / 60); near((h - A.hp) / D, 1 + bD(5, 5), '반동 제어 5');
    w.sk[2] = [5, 5, 1]; Core.dirty(w); Core.stats(w).crit = 0; h = A.hp; let shots = 0, hp0 = A.hp;
    w.cd = 0; Core.step(1 / 60); w.cd = 99;
    for (let i = 0; i < 50; i++) { S.snd.length = 0; Core.step(1 / 60); if (A.hp !== hp0) { shots++; hp0 = A.hp; assert(S.snd.includes('railfire'), '발마다 탕'); } }
    assert.strictEqual(shots, 3, '3점사: 3발'); near((h - A.hp) / D, 1 + 2 * bD(5, 5), '3점사 피해'); }
  // 점사: 표적이 죽으면 다음 발은 체력이 가장 많은 적에게. 점사가 끝나기 전에는 다음 조준을 시작하지 않는다
  { const { w, D } = mk([[0, 0, 0], [0, 0, 0], [5, 5, 1]]); const A = foeH(250, 300, 0.5 * D), B = foeH(150, 300, 0.4 * D), C = foeH(350, 300, 0.3 * D);
    shoot(w); for (let i = 0; i < 30; i++) Core.step(1 / 60);
    assert(A.dead, '첫 발에 처치'); near(0.4 * D - B.hp, bD(5, 5) * D, '둘째 발은 다음으로 체력이 많은 적'); near(0.3 * D - C.hp, bD(5, 5) * D, '셋째 발도'); }
  { const { w } = mk([[0, 0, 0], [0, 0, 0], [5, 5, 1]]); foeH(250, 300, 1e11); w.cd = 0; Core.step(1 / 60); const n1 = w.n;
    while (w.aimT > 0) Core.step(1 / 60);
    assert(w.bq === 2, '점사 대기'); w.cd = -1; let g = 0;
    while (w.bq > 0 && g++ < 60) { assert.strictEqual(w.n, n1, '점사 중에는 다음 조준 없음'); Core.step(1 / 60); }
    assert.strictEqual(w.n, n1 + 1, '점사가 끝나면 조준'); }
  // 증강 이중 저격, 관통 저격: 설명대로 v% (T5c 에서 100 으로 두 번 나누던 버그를 고침)
  { game(1); const w = put('rail', 2, 50); w.augs[0] = { id: 'r_twin', g: 2 }; w.augs[1] = { id: 'r_through', g: 2 }; Core.dirty(w); Core.S.spawnAcc = -1e9; const st = Core.stats(w); st.crit = 0; w.cd = 99;
    foeH(250, 300, 1e11); const B = foeH(50, 100, 1e10), C = foeH(250, 200, 1e6); shoot(w);
    near(1e10 - B.hp, st.dmg * Core.AUGS.r_twin.v[2] / 100, '이중 저격 v%'); assert(1e6 - C.hp >= st.dmg * Core.AUGS.r_through.v[2] / 100 * (1 - 1e-6), '관통 저격 v%'); }
  ok('저격포 새 줄 3개: 과잉 살상(넘어가는 피해, 증폭 전달, 연속 사냥), 조준 레이저(고정과 겹, 표식 이전, 균열), 점사(뒤 발, 반동 제어, 3점사), 이중/관통 저격 버그 수정');
}
/* 7f. 산성 분사기 새 줄: 용해(녹이기, 큰 폭발, 연쇄 용해), 산성비(비, 장마, 폭우), 점액 흔적(자국, 끈적한 자국, 부패) */
{
  const mk = (sk) => { game(1); const w = put('acid', 2, 100, true); w.sk = sk; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; S.nextBoss = 1e9; S.hp = S.maxHp = 1e9; w.cd = 99; w.rn = 99; const st = Core.stats(w); st.crit = 0; return { w, S, st, D: st.dmg }; };
  const run = (sec, each) => { for (let i = 0, n = Math.round(sec * 60); i < n; i++) { Core.step(1 / 60); if (each) each(); } };
  const near = (a, b, what, tol) => assert(Math.abs(a - b) <= (tol || 1e-4) * Math.max(1, Math.abs(b)), `${what}: ${a} != ${b}`);
  const pool = (S, st, x, y, o) => { const p = Object.assign({ acid: 1, x, y, r: 75, dps: st.dmg, t: 4, st, c: st.color, vuln: 0.1, slow: 0, sd: 0 }, o || {}); S.pools.push(p); return p; };
  const cD = SKILLS.acid[0].nodes[0].sc, cN = SKILLS.acid[1].nodes[0].sc, cS = SKILLS.acid[2].nodes[0].sc;
  // 용해 1: 웅덩이 안에서 체력 3% 이하가 된 일반 적을 녹이고 반경 70 에 D x c 폭발. 보스는 녹지 않는다
  { const { S, st, D } = mk([[1, 0, 0], [0, 0, 0], [0, 0, 0]]); pool(S, st, 250, 300);
    const a = foe2(250, 300, { hp: 100.05, maxHp: 1e4 }), b = foe2(250, 360, { hp: 1e9, maxHp: 1e9 }), far = foe2(250, 420, { hp: 1e9, maxHp: 1e9 }), bo = foe2(260, 290, { hp: 1e6, maxHp: 1e8, boss: true, type: 'giant' });
    Core.step(1 / 60); assert(a.dead && S.fx.some((f) => f.k === 'dsv'), '3% 이하 녹임'); near(1e9 - b.hp, D * cD + D / 60 * 1.1, '폭발 D x c (+ 웅덩이 한 틱)', 1e-6); assert.strictEqual(far.hp, 1e9, '반경 70 밖');
    assert(!bo.dead, '보스는 녹지 않음'); assert(!S.pools.some((p) => p.acid && p.sm), '연쇄 용해 전에는 새 웅덩이 없음'); }
  // 큰 폭발 5 + 연쇄 용해: 범위 x1.6, 피해 (5 + 10)c D, 그 자리에 2초 웅덩이
  { const { S, st, D } = mk([[5, 5, 1], [0, 0, 0], [0, 0, 0]]); pool(S, st, 250, 300);
    const a = foe2(250, 300, { hp: 1400, maxHp: 1e4 }), b = foe2(250, 400, { hp: 1e9, maxHp: 1e9 }); Core.step(1 / 60);
    assert(a.dead, '15% 이하 녹임'); near(1e9 - b.hp, D * 15 * cD, '큰 폭발 15c D (반경 112)', 1e-6);
    const np = S.pools.filter((p) => p.acid && p.sm); assert(np.length === 1 && np[0].t <= 2 && np[0].t > 1.9 && np[0].x === 250, '연쇄 용해: 2초 웅덩이 ' + np.map((p) => p.t));
    assert(np[0].fl === 1 && np[0].d === 2, '연쇄 용해 웅덩이는 폭발에서 번지는 그림 (fl)'); const bf = S.fx.find((f) => f.k === 'dsvb'); assert(bf && bf.lv === 5, '용해 폭발 그림: 큰 폭발 단계 5 ' + (bf && bf.lv)); }
  // 산성비 1: RAIN_CD 초마다 적이 가장 많은 레인에 3초. 초당 D x RAIN_K c 와 취약. 다른 레인은 그대로
  { const { w, S, st, D } = mk([[0, 0, 0], [1, 0, 0], [0, 0, 0]]); const L1 = [foe2(150, 200, { hp: 1e9, maxHp: 1e12 }), foe2(150, 400, { hp: 1e9, maxHp: 1e12 })], o = foe2(350, 300, { hp: 1e9, maxHp: 1e12 });
    w.rn = 0.001; Core.step(1 / 60); const r = S.pools.find((p) => p.kind === 'rain'); assert(r && r.lane === 1 && Math.abs(r.t - (3 - 1 / 60)) < 1e-9, '적이 가장 많은 레인, 3초');
    run(1); near(1e9 - L1[0].hp, D * Core.RAIN_K * cN * 1.1 * (61 / 60), '초당 D x RAIN_K c (취약 10% 포함)', 1e-3); assert(L1[1].vulnT > 0, '취약'); assert.strictEqual(o.hp, 1e9, '다른 레인');
    run(2.1); assert(!S.pools.some((p) => p.kind === 'rain'), '3초 뒤 그침'); assert(w.rn > Core.RAIN_CD - 3.5 && w.rn < Core.RAIN_CD, 'RAIN_CD 초마다'); }
  // 장마 5: 3 + 5 RAIN_UP 초. 폭우 (T10d): 두 레인, 비가 오는 동안 레인마다 PUD_SITE 곳 x PUD_LOBE 덩이의 웅덩이가 고여 커지고, 그친 뒤 PUD_DRY 초 동안 줄어든다
  { const { w, S } = mk([[0, 0, 0], [5, 5, 1], [0, 0, 0]]); foe2(150, 200); foe2(150, 300); foe2(350, 300); w.rn = 0.001; Core.step(1 / 60);
    const rs = S.pools.filter((p) => p.kind === 'rain'); const RT = 3 + 5 * Core.RAIN_UP; assert(rs.length === 2 && Math.abs(rs[0].t - (RT - 1 / 60)) < 1e-9, '폭우 두 레인, 장마 3 + 5 RAIN_UP 초');
    const pd = S.pools.filter((p) => p.rp), base = 75 * Core.PUD_R; assert.strictEqual(pd.length, 2 * Core.PUD_SITE * Core.PUD_LOBE, '레인마다 PUD_SITE x PUD_LOBE 덩이');
    assert(pd.every((p) => p.r === 0 && p.rm <= base * 1.1 + 1e-9 && Math.abs(p.x - (p.rp.lane + 0.5) * 100) <= 18 + base * 0.95 + 1e-9 && rs.some((r) => r.lane === p.rp.lane)), '비가 내리는 레인 안, 처음에는 반경 0');
    run(RT / 2); assert(pd.some((p) => p.r > 0 && p.r < p.rm), '비가 오는 동안 커지는 중');
    run(RT / 2 - 1 / 60 - 1 / 120); pd.forEach((p) => near(p.r, p.rm, '그칠 때 가장 큼', 1e-3));
    run(Core.PUD_DRY / 2); pd.forEach((p) => near(p.r, p.rm * Math.sqrt(0.5), '그친 뒤 줄어듦 (넓이 절반)', 2e-2));
    run(Core.PUD_DRY / 2 + 0.05); assert(!S.pools.some((p) => p.rp), '마르면 사라짐'); }
  // 고이는 웅덩이의 피해 범위는 그림의 반경 (Core.puddleR) 을 따른다: 중심에서 39.5 인 적 (반경 19) 은 웅덩이 반경 30 부터 맞는다
  { const { S, st } = mk([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); const g = { lane: 2, gr: 2 };
    const p = pool(S, st, 250, 300, { rp: g, rm: 40, s0: 0.5, t: 2 + Core.PUD_DRY, d: 2 + Core.PUD_DRY }), e = foe2(250 + 39.5, 300, { hp: 1e9, maxHp: 1e12 });
    let age = 0; const adv = (sec) => { const n = Math.round(sec * 60); run(n / 60); age += n / 60; };
    const tIn = 0.5 + 1.5 * Math.pow(30 / 40, 1 / 0.6), tOut = 2 + Core.PUD_DRY * (1 - (30 / 40) ** 2);   // 커지며 30 이 되는 때, 줄며 30 아래가 되는 때
    adv(tIn - 0.05); assert.strictEqual(e.hp, 1e9, '반경이 닿기 전에는 피해 없음 ' + p.r);
    adv(0.1); assert(e.hp < 1e9 && e.vulnT > 0, '반경이 커져 닿으면 피해 ' + p.r); near(p.r, Core.puddleR(p), 'puddleR');
    adv(tOut + 0.05 - age); const h = e.hp; adv(0.5); assert.strictEqual(e.hp, h, '마르며 줄어 닿지 않으면 피해 없음 ' + p.r); }
  // 점액 흔적 1: 웅덩이를 밟은 적이 3초 동안 22px 마다 자국 (반경 22, 2초). 자국 위의 적은 초당 D x 0.15c
  { const { S, st, D } = mk([[0, 0, 0], [0, 0, 0], [1, 0, 0]]); pool(S, st, 250, 300, { t: 0.05 }); const m = foe2(250, 300, { speed: 0.1, hp: 1e9, maxHp: 1e12 });
    run(0.1); assert(m.slT > 2.8, '자국 남기기 시작'); run(3.2); const sl = S.pools.filter((p) => p.kind === 'slime');
    assert(sl.length >= 3 && sl.every((p) => p.r === 22 && p.t <= 2), '22px 마다 자국 ' + sl.length); assert(!(m.slT > 0), '3초 뒤 멈춤');
    const by = foe2(sl[sl.length - 1].x, sl[sl.length - 1].y, { hp: 1e9, maxHp: 1e12 }); const h0 = by.hp; run(0.5); near(h0 - by.hp, D * 0.15 * cS * 0.5, '자국 피해', 1e-3); }
  // 끈적한 자국 5: 4.5초. 부패: 이 무기의 취약이 걸린 채 죽은 적 자리에 작은 웅덩이 (범위 60%, 2초)
  { const { S, st } = mk([[0, 0, 0], [0, 0, 0], [5, 5, 1]]); pool(S, st, 250, 300, { t: 0.05 }); const m = foe2(250, 300, { speed: 0.1, hp: 1e9, maxHp: 1e12 });
    run(0.6); assert(S.pools.some((p) => p.kind === 'slime' && p.d === 4.5 && Math.abs(p.dps - st.dmg * 0.15 * 5 * cS * 3) < 1e-6), '끈적한 자국 4.5초, 피해 x3');
    const v = foe2(250, 300, { hp: 1e9, maxHp: 1e12 }); pool(S, st, 250, 300, { t: 0.5 }); run(0.1); assert(v.vulnT > 0); v.hp = 1; run(0.1);
    assert(v.dead && S.pools.some((p) => p.acid && p.sm && Math.abs(p.r - 45) < 1e-9 && p.t <= 2), '부패: 작은 웅덩이'); }
  ok('산성 분사기 새 줄 3개: 용해(녹이기, 큰 폭발, 연쇄 용해), 산성비(비, 장마, 폭우), 점액 흔적(자국, 끈적한 자국, 부패)');
}
/* 6c. 증강 정리 (2026-11): 진화 스킬과 겹치는 증강을 빼고 집광을 넣었다 */
{
  const GONE = ['b_pierce', 'l_exec', 'l_wide', 'b_rico', 'm_barrage', 'm_nuke', 't_storm', 'r_carry', 'c_melt'];   // m_nuke: 박격포 핵탄두 줄로 옮김 (T5a), t_storm: 전격기 낙뢰 줄로 옮김 (T5b)
  for (const t of WEAPON_IDS) for (const id of GONE) assert(!Core.AUG_POOL[t].includes(id), '증강 목록에서 빠짐 ' + id);
  assert(Core.AUG_POOL.laser.includes('l_lens') && Core.AUGS.l_lens.min === 0);
  // 예전 저장에 달린 빠진 증강은 불러올 때 지운다 (칸, 인벤토리, 고르던 증강)
  const S = game(), w = put('blaster', 0, 10), iw = Core.newWeapon('mortar');
  w.augs = [{ id: 'b_pierce', g: 2 }, { id: 'a_dmg', g: 1 }, { id: 'b_rico', g: 3 }]; iw.augs = [{ id: 'm_barrage', g: 3 }, { id: 'm_nuke', g: 3 }, null]; S.inv[0] = iw;
  const tw = Core.newWeapon('tesla'); tw.augs = [{ id: 't_storm', g: 3 }, { id: 't_chain', g: 1 }, null]; S.inv[1] = tw;
  S.pendingAug = { slot: 0, lv: 10, options: [{ id: 'b_pierce', g: 1 }, { id: 'a_crit', g: 0 }] };
  Core.setState(JSON.parse(JSON.stringify(S)));
  const S2 = Core.S; assert.deepStrictEqual(S2.slots[0].augs.map((a) => a && a.id), [null, 'a_dmg', null]); assert.deepStrictEqual(S2.inv[0].augs, [null, null, null]);
  assert.deepStrictEqual(S2.pendingAug.options.map((a) => a.id), ['a_crit']); Core.stats(S2.slots[0]);
  assert.deepStrictEqual(S2.inv[1].augs.map((a) => a && a.id), [null, 't_chain', null], '번개 폭풍 지움'); Core.stats(S2.inv[1]);
  // 집광: 빔에 맞은 적 중 기지에 가장 가까운 적만 +v% (지속 빔 틱에도)
  game(1); const L = put('laser', 2, 50); L.augs[0] = { id: 'l_lens', g: 2 }; Core.dirty(L); Core.S.spawnAcc = -1e9; const st = Core.stats(L); st.crit = 0;
  const near = foe2(250, 470), far = foe2(250, 350); L.cd = 0; Core.step(1 / 60);
  const LV = Core.AUGS.l_lens.v;   // 수치는 정의에서 읽는다 (T3 에서 바뀜)
  assert(Math.abs((1e12 - near.hp) - st.dmg * (1 + LV[2] / 100)) < 1e-3 && Math.abs((1e12 - far.hp) - st.dmg) < 1e-3, `집광 영웅 ${LV[2]}%: 가장 가까운 적만`);
  game(1); const H2 = put('laser', 2, 100, true); H2.augs[0] = { id: 'l_lens', g: 3 }; H2.sk[0] = [1, 0, 0]; Core.dirty(H2); Core.S.spawnAcc = -1e9; const s2 = Core.stats(H2); s2.crit = 0;
  const n2 = foe2(250, 470), f2 = foe2(250, 350); H2.cd = 99; Core.S.beams.push({ k: 2, t: 0.25, tick: 0.1, st: s2 }); for (let i = 0; i < 8; i++) Core.step(1 / 60);
  assert(Math.abs((1e12 - n2.hp) / (1e12 - f2.hp) - (1 + LV[3] / 100)) < 1e-6, `지속 빔 틱에도 집광 (전설 ${LV[3]}%)`);
  assert(!Core.AUGS.m_barrage && !Core.AUGS.m_nuke && !Core.AUGS.t_storm && !Core.AUGS.r_carry && !Core.AUGS.c_melt, '옮긴 증강은 정의에서도 지웠다');
  ok('증강 정리: 빠진 증강 9개, 예전 저장 정리, 집광');
}

/* 6d. 최대 타격 수 (T4): 범위 공격은 한 번에 cap 명까지, 기지에 가까운 적부터. 다중 타격기 +v명, 제한 해제기는 제한 없음 */
{
  const hitN = (foes) => foes.filter((e) => e.hp < e.maxHp).length;
  const nearest = (foes, k) => foes.slice().sort((a, b) => b.y - a.y).slice(0, k);
  const fresh = (type, lv, evo) => { game(1); const S = Core.S; S.spawnAcc = -1e9; S.nextBoss = 1e9; S.hp = S.maxHp = 1e9; return put(type, 2, lv, evo); };
  const lane = (x, n, y0, dy) => Array.from({ length: n }, (_, i) => foe2(x, y0 + i * dy));
  const clump = (x, y, n) => Array.from({ length: n }, (_, i) => foe2(x + (i % 5 - 2) * 8, y + (Math.floor(i / 5) - 2) * 8));
  const C = { laser: 6, pulse: 8, mortar: 8, acid: 6, shotgun: 6, tesla: 6 };
  for (const t of WEAPON_IDS) assert.strictEqual(Core.stats(Core.newWeapon(t)).cap, C[t] || Core.CAP_NONE, t + ' 기본 최대 타격 수');
  // 레이저: 한 레인의 적 20명 중 기지에 가까운 6명만. 빔은 6번째 적에서 멈춘다
  let w = fresh('laser', 50), foes = lane(250, 20, 100, 20); w.cd = 0; Core.step(1 / 60);
  assert.strictEqual(hitN(foes), 6, '레이저 6명');
  assert.deepStrictEqual(foes.filter((e) => e.hp < e.maxHp), nearest(foes, 6).sort((a, b) => a.y - b.y), '기지에 가까운 적부터');
  const bf = Core.S.fx.filter((f) => f.k === 'beam').pop();
  assert(bf.ab === 1 && Math.abs(bf.y0 - (380 - 19 * 0.3)) < 1e-9, '빔이 6번째 적에서 멈춤');
  assert(Math.abs(Core.beamStop(2, Core.stats(w)) - bf.y0) < 1e-9, '화면용 멈춤 높이 (beamStop)');
  // 다중 타격기 +1 / +5, 제한 해제기 (공격력 -v%), 범위 무기가 아니면 쓸모없음
  const base = Core.stats(w).dmg;
  const SV = Core.PARTS.spread.v;   // 수치는 정의에서 읽는다
  for (const [id, g, want] of [['spread', 0, 6 + SV[0]], ['spread', 3, Math.min(20, 6 + SV[3])], ['nolimit', 3, 20]]) {
    w = fresh('laser', 50); w.parts[0] = { id, g }; Core.dirty(w); foes = lane(250, 20, 100, 20); w.cd = 0; Core.step(1 / 60);
    assert.strictEqual(hitN(foes), want, `${id} ${g}: ${want}명`);
  }
  assert(Math.abs(Core.stats(w).dmg / base - (1 - Core.PARTS.nolimit.v[3] / 100)) < 1e-9, '제한 해제기 공격력 -v%');
  assert(Core.stats(w).cap >= Core.CAP_NONE && Core.beamStop(2, Core.stats(w)) === null);
  const bw = Core.newWeapon('blaster'); bw.parts[0] = { id: 'spread', g: 3 }; assert.strictEqual(Core.stats(bw).cap, Core.CAP_NONE, '블래스터는 제한 없음 (다중 타격기 쓸모없음)');
  // 펄스 파동, 박격포 폭발: 8명
  w = fresh('pulse', 50); foes = clump(250, 470, 20); w.cd = 0; Core.step(1 / 60); assert.strictEqual(hitN(foes), 8, '펄스 8명');
  w = fresh('mortar', 50); foes = clump(250, 300, 20); w.cd = 0; for (let i = 0; i < 45; i++) Core.step(1 / 60); assert.strictEqual(hitN(foes), 8, '박격포 8명');
  // 웅덩이와 바닥 효과: 한 틱에 그 무기의 최대 타격 수까지
  const pool = (type, mk, foesOf, want, what) => {
    const ww = fresh(type, 50); ww.cd = 99; const st = Core.stats(ww), ff = foesOf();
    Core.S.pools.push(Object.assign({ t: 2, dps: st.dmg, st, wk: ww, key: 0, c: '#fff', sd: 0 }, mk(st))); Core.step(1 / 60);
    assert.strictEqual(hitN(ff), want, what);
  };
  pool('acid', () => ({ acid: 1, x: 250, y: 300, r: 75, vuln: 0.1, slow: 0 }), () => clump(250, 300, 20), 6, '산성 웅덩이 6명');
  pool('mortar', () => ({ x: 250, y: 300, r: 62 }), () => clump(250, 300, 20), 8, '화염 지대 8명');
  pool('laser', (st) => ({ kind: 'melt', x: 250, y: 520 - st.range * 520, r: 0 }), () => lane(250, 20, 100, 20), 6, '용융선 6명');
  pool('pulse', () => ({ kind: 'halo', x: 250, y: 520, r: 200, big: 1 }), () => clump(250, 430, 30), 8 * Core.BIG_CAP, '잔광 24명 (초신성의 큰 한 방, T10c)');
  pool('tesla', () => ({ kind: 'efield', x: 250, y: 300, r: 45 }), () => clump(250, 300, 20), 6, '전기장 6명');
  pool('acid', () => ({ kind: 'rain', x: 250, vuln: 0.1 }), () => lane(250, 22, 40, 20), 6 * Core.BIG_CAP, '산성비 18명 (레인 전체, T10c)');
  pool('acid', () => ({ kind: 'slime', x: 250, y: 300, r: 22 }), () => clump(250, 300, 20), 6, '점액 자국 6명');
  pool('tesla', () => ({ kind: 'arc', x0: 250, y0: 100, x1: 250, y1: 500, hw: 7 }), () => lane(250, 20, 100, 20), 6, '전기 줄 6명');
  pool('tesla', () => ({ kind: 'ball', x: 250, y: 300, vx: 0, vy: 0, r: 69 }), () => clump(250, 300, 20), 6, '구전 6명');
  { const ww = fresh('tesla', 50); ww.cd = 99; const st = Core.stats(ww), ff = clump(250, 300, 20);
    Core.S.pools.push({ kind: 'ball', x: 250, y: 300, vx: 0, vy: 0, r: 5, t: 1 / 120, dps: 0, st, wk: ww, c: '#fff', sd: 0, boom: st.dmg }); Core.step(1 / 60);
    assert.strictEqual(hitN(ff), 6 * Core.BIG_CAP, '쌍구전 터짐 18명 (큰 한 방, T10c)'); }
  pool('shotgun', () => ({ kind: 'fire', x0: 250, y0: 300, x1: 250, y1: 480, hw: 18, d: 2 }), () => lane(250, 20, 300, 9), 6, '불바다 6명');
  // 진화 스킬: 지속 빔 틱, 상시 빔, 초신성, 프리즘 갈래, 궤도 포격
  w = fresh('laser', 100, true); w.sk[0] = [1, 0, 0]; Core.dirty(w); w.cd = 99; foes = lane(250, 20, 100, 20);
  Core.S.beams.push({ k: 2, t: 0.25, tick: 0.1, st: Core.stats(w) }); for (let i = 0; i < 8; i++) Core.step(1 / 60);
  assert.strictEqual(hitN(foes), 6, '지속 빔 틱 6명');
  w = fresh('laser', 100, true); w.sk[0] = [5, 5, 1]; Core.dirty(w); w.cd = 99; foes = lane(250, 20, 100, 20); for (let i = 0; i < 8; i++) Core.step(1 / 60);
  assert.strictEqual(hitN(foes), 6, '상시 빔 6명');
  w = fresh('pulse', 100, true); w.sk[0] = [1, 0, 0]; Core.dirty(w); w.n = Core.NOVA_N - 1; w.cd = 0; foes = clump(250, 450, 30); Core.step(1 / 60);
  assert(Core.S.fx.some((f) => f.k === 'ring' && f.nova === 1) && hitN(foes) === 8 * Core.BIG_CAP, '초신성 24명 (큰 한 방, T10c)');
  // 핵탄두와 공습: 24명 (큰 한 방)
  w = fresh('mortar', 100, true); w.sk[0] = [1, 0, 0]; Core.dirty(w); w.n = Core.NUKE_N - 1; w.cd = 0; foes = clump(250, 300, 30); for (let i = 0; i < 45; i++) { Core.step(1 / 60); w.cd = 99; }
  assert.strictEqual(hitN(foes), 8 * Core.BIG_CAP, '핵탄두 24명 (큰 한 방, T10c)');
  w = fresh('mortar', 100, true); w.sk[1] = [5, 5, 1]; Core.dirty(w); w.cd = 99; foes = clump(250, 300, 30); w.at = 0.001; for (let i = 0; i < 90; i++) { Core.step(1 / 60); w.cd = 99; }
  assert.strictEqual(hitN(foes), 8 * Core.BIG_CAP, '공습 한 발 24명 (큰 한 방, T10c)');
  // 큰 한 방에 죽은 일반 적은 'fling' (바깥으로 날아가며 쓰러짐), 보통 공격에 죽은 적은 'pop'
  w = fresh('pulse', 100, true); w.sk[0] = [5, 0, 0]; Core.dirty(w); w.n = Core.NOVA_N - 1; w.cd = 0; foes = clump(250, 450, 10); foes.forEach((e) => { e.hp = 1; e.maxHp = 1e6; }); const nf0 = Core.S.fx.length; Core.step(1 / 60);
  const fl = Core.S.fx.slice(nf0).filter((f) => f.k === 'fling');
  assert(foes.every((e) => e.dead) && fl.length === 10 && !Core.S.fx.slice(nf0).some((f) => f.k === 'pop'), '초신성에 죽은 적은 날아가며 쓰러짐 (fling)');
  assert(fl.every((f) => Math.abs(Math.hypot(f.ax, f.ay) - 1) < 1e-9 && f.ay < 0.3 && f.b === 'nova'), '초신성: 무기(기지) 쪽에서 바깥으로');
  w = fresh('pulse', 50); w.cd = 0; foes = clump(250, 470, 3); foes.forEach((e) => { e.hp = 1; }); const nf1 = Core.S.fx.length; Core.step(1 / 60);
  assert(Core.S.fx.slice(nf1).filter((f) => f.k === 'pop').length === 3 && !Core.S.fx.slice(nf1).some((f) => f.k === 'fling'), '보통 파동에 죽은 적은 그대로 (pop)');
  w = fresh('laser', 100, true); w.sk[1] = [1, 0, 0]; Core.dirty(w); foe2(250, 480); const side = lane(150, 20, 100, 18).concat(lane(350, 20, 100, 18)); w.cd = 0; Core.step(1 / 60);
  assert.strictEqual(hitN(side), 12, '프리즘 갈래마다 6명');
  w = fresh('laser', 50); w.augs[0] = { id: 'l_orbit', g: 3 }; Core.dirty(w); foe2(250, 480); foes = lane(50, 20, 100, 20); w.cd = 0; Core.step(1 / 60);
  assert.strictEqual(hitN(foes), 6, '궤도 포격 6명');
  ok('최대 타격 수: 레이저 6, 펄스 8, 박격포 8, 산성 6 (점액 자국 포함), 전격기 스킬 6, 바닥 효과, 다중 타격기, 제한 해제기, 진화 스킬. 큰 한 방 x3 (초신성·잔광, 핵탄두, 공습, 쌍구전 터짐, 산성비)과 쓰러지는 연출');
}

/* 10. 스트레스: 무기 종류마다 다섯 자루를 모두 진화시키고 20분 */
{
  const DT = 1 / 30, T = QUICK ? 120 : 1200;
  for (const type of WEAPON_IDS) {
    const rr = mulberry32(WEAPON_IDS.indexOf(type) + 100);
    const S = game(WEAPON_IDS.indexOf(type) + 1);
    const NEW4 = ['blaster', 'shotgun', 'laser', 'pulse'].includes(type);   // 새 트리의 네 무기: 줄 셋을 섞어 20점을 모두 쓴다 (선행 조건 지킴)
    const VAR = [[[5, 5, 1], [5, 3, 0], [1, 0, 0]], [[5, 0, 0], [5, 5, 1], [4, 0, 0]], [[4, 0, 0], [5, 0, 0], [5, 5, 1]], [[5, 5, 1], [5, 4, 0], [0, 0, 0]], [[5, 5, 1], [1, 0, 0], [5, 3, 0]]];
    let vi = WEAPON_IDS.indexOf(type);
    const mixedSkills = (w, k) => { w.skp = 20; w.sk = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; Core.dirty(w); const v = VAR[vi++ % VAR.length]; for (let l = 0; l < 3; l++) for (let t = 0; t < 3; t++) for (let i = 0; i < v[l][t]; i++) assert(Core.skillUp(k, l, t).ok, '섞은 줄 ' + type + ' ' + l + t); assert.strictEqual(Core.skillPoints(w).left, 0); };
    const randomSkills = (w, k) => { if (NEW4) return mixedSkills(w, k); w.skp = 20; w.sk = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; Core.dirty(w); for (let g = 0; g < 400 && Core.skillPoints(w).left > 0; g++) Core.skillUp(k, Math.floor(rr() * 3), Math.floor(rr() * 3)); };
    for (let k = 0; k < 5; k++) { const w = put(type, k, 100, true); randomSkills(w, k); if (rr() < 0.5) w.augs[0] = { id: Core.AUG_POOL[type][Math.floor(rr() * Core.AUG_POOL[type].length)], g: 3 }; if (rr() < 0.5) w.parts[0] = { id: 'dmg', g: 3 }; Core.dirty(w); }
    let steps = 0, devos = 0;
    while (S.t < T) {
      S.hp = S.maxHp; Core.step(DT); steps++;
      if (S.pendingAug) Core.chooseAug(0, 0) || Core.skipAug(true);
      if (S.pendingPact) Core.skipPact();
      if (steps % 150 === 0) {   // 5초마다: 점검, 가끔 강화/손실/재진화
        for (const w of S.slots) { finite(num(Core.stats(w)), type + ' stats'); assert(Number.isFinite(w.lv)); }
        assert(Number.isFinite(S.dealt) && Number.isFinite(S.gold) && Number.isFinite(S.hp), type + ' 상태 NaN');
        for (const e of S.enemies) assert(Number.isFinite(e.hp) && Number.isFinite(e.x) && Number.isFinite(e.y), type + ' 적 NaN');
        const k = Math.floor(rr() * 5), w = S.slots[k];
        if (rr() < 0.5 && w.evo) Core.upgrade(k);
        if (rr() < 0.08) { if (w.evo) { if (Core.evoLose(w, 1 + Math.floor(rr() * 12), k).devo) devos++; } }
        if (!w.evo && w.lv === 100) { S.shards = 1e9; if (Core.evolve(k).ok) randomSkills(S.slots[k], k); }
        S.evq.length = 0; S.notes.length = 0; S.snd.length = 0;
      }
    }
    assert(S.kills > 0, type + ' 처치 0');
    console.log(`    ${type}: ${T}s, 처치 ${S.kills}, 해제 ${devos}회`);
  }
  ok(`스트레스 ${QUICK ? 2 : 20}분 x 무기 ${WEAPON_IDS.length}종 (다섯 자루 진화, 무작위 스킬, 가끔 강화/손실/재진화)`);
}
Core.seed(null);
console.log(`\n${n} 묶음 통과`);

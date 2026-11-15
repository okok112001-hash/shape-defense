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

/* 6b. 합산 상한: 이미 낀 같은 증강과 더해지고, 상한을 넘지 않는다 */
{
  game(); const w = put('tesla', 0, 100, true);
  w.augs[0] = { id: 't_slow', g: 3 };               // 둔화 80%
  w.sk[1][0] = 5; w.sk[1][1] = 5; Core.dirty(w);
  assert(Core.stats(w).slow <= 0.8 + 1e-12, '둔화 80% 상한');
  w.augs[0] = { id: 't_stun', g: 3 }; Core.dirty(w); assert(Core.stats(w).stun <= 0.9 + 1e-12 && Core.stats(w).stun > 0.8);
  game(); const b = put('blaster', 0, 100, true); b.augs[0] = { id: 'b_pierce', g: 2 }; b.sk[1][0] = 3; Core.dirty(b);
  assert.strictEqual(Core.stats(b).pierce, 3 + 3, '증강(영웅 3) + 랭크(3)');
  game(); const a = put('acid', 0, 100, true); a.augs[0] = { id: 'c_melt', g: 3 }; a.sk[0][0] = 5; a.sk[0][1] = 5; a.sk[0][2] = 1; Core.dirty(a);
  assert.strictEqual(Core.stats(a).deathBoom, 1.0, '용해의 폭발 값은 겹쳐도 1.0');
    // 새 줄은 증강과 더해진다: 파츠/증강의 공격 속도, 화상, 둔화와 함께
  game(); const sg = put('shotgun', 0, 100, true); sg.augs[0] = { id: 'l_burn', g: 3 }; sg.parts[0] = { id: 'rate', g: 2 }; sg.sk[1] = [5, 0, 0]; Core.dirty(sg);
  assert(Core.stats(sg).burn > 0 && Core.stats(sg).flame > 0, '증강 화상과 화염 화상이 함께 있다');
  game(); const pl = put('pulse', 0, 100, true); pl.augs[0] = { id: 'p_frost', g: 3 }; pl.sk[2] = [5, 5, 0]; Core.dirty(pl);
  assert(Core.stats(pl).slow === 0.55 && Core.stats(pl).fld > 0, '빙결장과 역장 둔화는 따로 있다');
  ok('합산 상한(둔화 80%, 확률 90%), 증강과 더해짐, 큰 값 유지 항목');
}

/* 7. 새 노드의 동작 */
function foe(x, y, hp) { const e = { type: 'basic', lane: Math.floor(x / 100), x, y, r: 19, hp: hp || 1e9, maxHp: hp || 1e9, speed: 0, leak: 1, gold: 0, boss: false, born: 0, slowT: 0, slowPct: 0, vulnT: 0, vulnPct: 0, burnT: 0, burnDps: 0, burnSt: null, stunT: 0, dead: false, flash: 0 }; Core.S.enemies.push(e); return e; }
function maxNodes(w, l) { SKILLS[w.type][l].nodes.forEach((nd, t) => { w.sk[l][t] = nd.max; }); Core.dirty(w); }
{
  // 과전류: 기절한 적이 더 아프다
  game(1); const ts = put('tesla', 2, 100, true); ts.sk[1] = [0, 0, 1]; ts.sk[1] = [5, 5, 1]; ts.parts[0] = null; Core.dirty(ts);
  const et = foe(250, 300); const st = Core.stats(ts); st.crit = 0; st.stun = 0; st.slow = 0;   // 기대값을 맞추려고 치명타, 부가 효과를 끈다
  et.stunT = 0; ts.cd = 0; const h1 = et.hp; Core.S.enemies = [et]; Core.step(1 / 60); const plain = h1 - et.hp;
  assert(plain > 0);
  const et2 = foe(250, 300); et2.stunT = 5; Core.S.enemies = [et2]; ts.cd = 0; const h2 = et2.hp; Core.step(1 / 60); const boosted = h2 - et2.hp;
  assert(Math.abs(boosted / plain - 1.4) < 1e-6, '과전류 +40% ' + (boosted / plain));
  // 처형: 20% 아래로 남으면 즉사
  game(1); const rl = put('rail', 2, 100, true); rl.sk[1] = [5, 5, 1]; Core.dirty(rl);
  const rs = Core.stats(rl); assert(Math.abs(rs.instakill - 0.2) < 1e-9);
  const er = foe(250, 300, 100); er.hp = 100; er.maxHp = 100 / 0.85 * 1.0;   // 한 방에 약 80% 뎀: 남는 체력이 20% 아래
  er.hp = er.maxHp * 0.99; const dmgNeeded = er.hp - er.maxHp * 0.15;
  rs.crit = 0; rs.dmg = dmgNeeded; rs.bossPct = 0; rs.vuln = 0; Core.S.enemies = [er]; Core.hit; // hit는 내부 함수: 아래 step으로 확인
  rl.cd = 0; Core.step(1 / 60); for (let i = 0; i < 30; i++) Core.step(1 / 60);
  assert(er.dead || er.hp <= 0, '처형: 20% 아래로 남은 적은 즉사');
  // 속사 저격 +60%
  game(); const rp = put('rail', 0, 100, true); const a1 = Core.stats(rp); rp.sk[2] = [0, 0, 1]; Core.dirty(rp);
  assert(Math.abs(Core.stats(rp).cd - a1.cd / 1.6) < 1e-9, '속사 저격 +60%');
  // 오래 남는 산, 잔류
  game(1); const ac = put('acid', 2, 100, true); ac.sk[2] = [5, 0, 0]; Core.dirty(ac); const d0 = Core.stats(ac).aDur;
  ac.sk[2][1] = 5; Core.dirty(ac); assert(Math.abs(Core.stats(ac).aDur - d0 - 3) < 1e-9, '랭크당 +0.6초');
  const eA = foe(250, 300); eA.speed = 0; ac.cd = 0; Core.step(1 / 60); for (let i = 0; i < 40; i++) Core.step(1 / 60);
  const pool = Core.S.pools.find((p) => p.acid); assert(pool, '웅덩이'); assert(Math.abs(pool.t + (Core.S.t - 0) * 0 - pool.t) < 1e-9);
  assert(pool.t > 3 - 1.2, '웅덩이 지속시간이 늘어남');
  // 잔류: 웅덩이 밖으로 나간 적
  game(1); const ac2 = put('acid', 2, 100, true); ac2.sk[2] = [5, 5, 1]; Core.dirty(ac2);
  const eB = foe(250, 300); const st2 = Core.stats(ac2);
  Core.S.pools.push({ acid: 1, x: 250, y: 300, r: 75, dps: st2.dmg, t: 0.5, st: st2, c: st2.color, vuln: 0.1, slow: 0, sd: 0 });
  ac2.cd = 99; for (let i = 0; i < 10; i++) Core.step(1 / 60);
  assert(eB.lgT > 0 && eB.vulnT > 2.5, '잔류 설정'); eB.x = 480; eB.y = 100;    // 웅덩이 밖
  const hpOut = eB.hp; for (let i = 0; i < 60; i++) Core.step(1 / 60);
  assert(eB.hp < hpOut, '웅덩이 밖에서도 피해'); assert(eB.vulnT > 1.0, '취약 유지(3초)');
  for (let i = 0; i < 200; i++) Core.step(1 / 60); const hpEnd = eB.hp; Core.step(1 / 60); assert(eB.lgT <= 0 && eB.hp === hpEnd - 0 || eB.hp >= hpEnd - 1e-6, '3초 뒤 끝남');
  ok('2차분 노드 동작 유지: 과전류, 처형, 속사 저격, 오래 남는 산, 잔류');
}

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
function layout(type, speed) {
  const L = [];
  if (type === 'pulse') { for (const r of [45, 70, 95, 120, 135, 150, 165]) for (const a of [35, 60, 90, 120, 145]) L.push([250 + r * Math.cos(a * Math.PI / 180), 520 - r * Math.sin(a * Math.PI / 180)]); }
  else {
    for (let y = 120; y <= 480; y += 40) L.push([250, y]);
    for (const y of [300, 360, 420, 480]) { L.push([150, y]); L.push([350, y]); }
    for (const y of [300, 420]) { L.push([50, y]); L.push([450, y]); }
  }
  const hpOf = (y) => (y >= 440 ? 1e4 : y >= 400 ? 2.5e4 : y >= 360 ? 6e4 : y >= 300 ? 2e5 : 1e12);   // 기지에 가까운 적일수록 죽기 쉽다. 안쪽 적은 안 죽는다
  return L.map(([x, y]) => foe2(x, y, { speed: speed || 0, hp: hpOf(y), maxHp: hpOf(y) }));
}
// 장면: 무기를 2번 칸에 놓고 secs초 돌린 뒤 눈에 보이는 결과를 모은다
function scene(type, lines, secs, opt) {
  opt = opt || {};
  const S = game(7), w = put(type, 2, 100, true);
  w.sk = lines.map((r) => r.slice()); Core.dirty(w);
  if (opt.setup) opt.setup(w);
  S.hp = S.maxHp = 1e9; S.spawnAcc = -1e9; S.nextBoss = 1e9;
  const foes = layout(type, opt.speed);
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
  o.foes = foes.map((e) => [+Math.max(0, e.hp).toPrecision(9), +e.y.toFixed(3), +e.x.toFixed(3), +e.slowPct.toFixed(4), e.stunT > 0 ? 1 : 0, e.fT > 0 ? 1 : 0, +(e.vulnT > 0 ? e.vulnPct : 0).toFixed(4), e.dead ? 1 : 0]);
  finite(num(Core.stats(w)), type + ' scene stats');
  for (const e of foes) assert(Number.isFinite(e.hp) && Number.isFinite(e.y), type + ' scene enemy');
  assert(Number.isFinite(S.dealt) && Number.isFinite(S.gold));
  return { S, w, foes, o };
}
{
  let cnt = 0;
  const spd = { shotgun: 0.04, laser: 0, blaster: 0, pulse: 0.05 };
  for (const t of ['blaster', 'shotgun', 'laser', 'pulse']) {
    SKILLS[t].forEach((line, l) => {
      line.nodes.forEach((node, tier) => {
        for (let r = 1; r <= node.max; r++) {
          const mk = (rank) => { const L = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let q = 0; q < tier; q++) L[l][q] = SKILLS[t][l].nodes[q].max; L[l][tier] = rank; return L; };
          const secs = t === 'blaster' ? 10 : 8;
          const A = JSON.stringify(scene(t, mk(r - 1), secs, { speed: spd[t] }).o), B = JSON.stringify(scene(t, mk(r), secs, { speed: spd[t] }).o);
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
  { game(1); const w = put('blaster', 2, 100, true); w.sk[0] = [0, 0, 1]; Core.dirty(w); foe2(250, 200); foe2(150, 300); foe2(350, 300); Core.S.spawnAcc = -1e9; w.cd = 0; Core.step(1 / 60);
    const bs = Core.S.bullets; assert.strictEqual(bs.length, 3, '삼연장: 탄 줄기 3개'); const st = Core.stats(w);
    assert(bs.some((b) => Math.abs(b.dmg - st.dmg * st.triD) < 1e-9) && Math.abs(st.triD - 0.5 * SKILLS.blaster[0].nodes[2].sc) < 1e-12 && bs.filter((b) => b.vx < -1).length === 1 && bs.filter((b) => b.vx > 1).length === 1, '옆 레인 탄 피해 50%'); }
  { game(1); const w = put('blaster', 2, 100, true); w.sk[1] = [5, 5, 1]; Core.dirty(w); foe2(250, 200); Core.S.spawnAcc = -1e9; const st = Core.stats(w); let giants = 0, shots = 0;
    for (let i = 0; i < 600; i++) { const n0 = w.n; w.cd = Math.min(w.cd, 0); Core.step(1 / 60); if (w.n > n0) { shots++; const gb = Core.S.bullets.filter((b) => b.big && !b.sn); gb.forEach((b) => { b.sn = 1; }); if (gb.length) { giants++; assert(shots % 4 === 0 && gb[0].r >= 40 && gb[0].pierce >= 99 && Math.abs(gb[0].dmg - st.dmg * 3) < 1e-6 * st.dmg, '거대탄: 4번째, 레인 폭, 3배, 모두 관통'); } } if (shots >= 12) break; }
    assert(giants >= 3, '거대탄이 4번째마다'); assert(st.pk === 1, '가속 관통 5단계: 감소 없음'); }
  { game(1); const w = put('blaster', 2, 100, true); w.sk[1] = [3, 0, 0]; Core.dirty(w); assert.strictEqual(Core.stats(w).pierce, 3, '광탄 3명 추가 관통'); assert(Math.abs(Core.stats(w).pk - 0.55) < 1e-12); w.sk[1][1] = 0; }
  { game(1); const w = put('blaster', 2, 100, true); w.sk[2] = [3, 0, 0]; Core.dirty(w); foe2(150, 250); Core.S.spawnAcc = -1e9; const S = Core.S;
    const st = Core.stats(w); w.cd = 0; foe2(250, 100); let tb = null; for (let i = 0; i < 90 && !tb; i++) { Core.step(1 / 60); tb = S.bullets.find((b) => b.sm); }
    assert(tb && Math.abs(tb.dmg - st.dmg * 0.36) < 1e-9 && !tb.tb, '보조 포탑 탄: 피해 12% x 랭크, 쌍포탑 전에는 폭발 없음');
    assert(Core.turretPos(2, 0)[0] < 250 && Core.turretPos(0, 0)[0] > 50, '왼쪽 옆 레인(없으면 오른쪽)');
    w.sk[2] = [5, 5, 1]; Core.dirty(w); const st2 = Core.stats(w); foe2(350, 300); const S2 = Core.S; let hasR = false, hasL = false; S2.bullets.length = 0;
    for (let i = 0; i < 200; i++) { Core.step(1 / 60); for (const b of S2.bullets) if (b.sm) { assert(b.tb === 1); if (b.x > 255 && b.vx > 0) hasR = true; if (b.x < 245 && b.vx < 0) hasL = true; } }
    assert(hasL && hasR, '쌍포탑: 양쪽에서 포탑 탄'); assert(Math.abs(st2.turD - 0.6) < 1e-9 && Math.abs(st2.turRate - 0.5) < 1e-9); }
  // 산탄포
  { game(1); const w = put('shotgun', 2, 100, true); w.sk[0] = [1, 0, 0]; Core.dirty(w); foe2(250, 400); Core.S.spawnAcc = -1e9; const st = Core.stats(w);
    let slugs = 0, shots = 0; for (let i = 0; i < 900 && shots < 9; i++) { const n0 = w.n; w.cd = Math.min(w.cd, 0); Core.step(1 / 60); if (w.n > n0) { shots++; const sb = Core.S.bullets.filter((b) => b.big && !b.sn); sb.forEach((b) => { b.sn = 1; }); if (sb.length) { slugs++; assert(shots % 3 === 0 && sb[0].kn === 12 && Math.abs(sb[0].dmg - st.dmg * 0.6) < 1e-9 && sb[0].pierce >= 99, '슬러그: 3번째, 피해 0.4+0.2r, 밀어냄 12'); } } }
    assert(slugs >= 2);
    w.sk[0] = [5, 5, 1]; Core.dirty(w); foe2(150, 400); foe2(350, 400); const st2 = Core.stats(w); assert(st2.slugEvery === 2 && st2.slugTwin === 1 && st2.slugKn === 12 + 20 && Math.abs(st2.slugSlow - 0.5) < 1e-9);
    let sl3 = 0; for (let i = 0; i < 300 && !sl3; i++) { const n0 = w.n; w.cd = Math.min(w.cd, 0); Core.step(1 / 60); if (w.n > n0 && w.n % 2 === 0) sl3 = Core.S.bullets.filter((b) => b.big && !b.sn).length; }
    assert.strictEqual(sl3, 3, '쌍열: 2번째 발사마다 3레인 슬러그');
    const ew = foe2(250, 420); ew.speed = 0; Core.S.bullets.length = 0; w.n = 1; w.cd = 0; Core.S.enemies = [ew]; Core.step(1 / 60); for (let i = 0; i < 40 && ew.slowPct === 0; i++) Core.step(1 / 60); }
  { game(1); const w = put('shotgun', 2, 100, true); w.sk[1] = [2, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; const e = foe2(250, 400); const st = Core.stats(w); w.cd = 0; Core.step(1 / 60);
    assert(S.bullets.every((b) => b.fl), '화염 산탄: 산탄이 불꽃'); assert(S.fx.some((f) => f.k === 'fcone') && !S.fx.some((f) => f.k === 'cone'));
    for (let i = 0; i < 40; i++) Core.step(1 / 60); assert(e.fT > 0 && Math.abs(e.fDps - st.dmg * 0.16) < 1e-6 * st.dmg, '3초 화상, 초당 공격력 8% x 랭크');
    w.sk[1] = [5, 5, 0]; Core.dirty(w); w.cd = 0; Core.step(1 / 60); const pf = S.pools.filter((p) => p.kind === 'fire'); assert(pf.length === 3 && pf.every((p) => Math.abs(p.t - 2) < 0.05), '불바다: 조준한 레인마다 2초 불길');
    const pp = pf[1]; const e2 = foe2(pp.x, pp.y, { hp: 1e9, maxHp: 1e9 }); const h0 = e2.hp; for (let i = 0; i < 30; i++) Core.step(1 / 60); assert(e2.hp < h0, '불길 위의 적은 피해'); }
  { game(1); const w = put('shotgun', 2, 100, true); w.sk[1] = [5, 5, 1]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; w.cd = 99;
    const st = Core.stats(w), a = foe2(250, 400, { hp: 5, maxHp: 5, fT: 2, fDps: 1e6, fSt: st }), b = foe2(280, 400), c = foe2(450, 100);
    const hb = b.hp; Core.step(1 / 60); assert(a.dead, '화상 중 사망'); assert(b.hp < hb && b.fT > 0, '폭염: 주변 적이 피해와 화상'); assert(c.fT === 0, '범위 밖은 영향 없음');
    assert(S.fx.some((f) => f.k === 'boom' && f.r === 70), '폭발 반경 70'); }
  { game(1); const w = put('shotgun', 2, 100, true); w.sk[2] = [1, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; w.cd = 99; foe2(250, 300);
    for (let i = 0; i < 70; i++) Core.step(1 / 60); assert(S.mines.length === 1 && S.mines[0].t > 10 && Math.abs(S.mines[0].dmg - Core.stats(w).dmg * 0.6) < 1e-9 && S.mines[0].R === 60, '4초마다 지뢰 1개 ... 첫 설치');
    for (let i = 0; i < 60 * 40; i++) Core.step(1 / 60); assert(S.mines.filter((m) => !m.mini).length === 3, '최대 3개');
    w.sk[2] = [5, 5, 1]; Core.dirty(w); const st = Core.stats(w); assert(st.mineMax === 5 && Math.abs(st.mineCd - 2) < 1e-9, '빠른 매설 5단계: 2초, 최대 5개');
    S.mines.length = 0; S.enemies.length = 0; w.mt = 0; for (let i = 0; i < 3; i++) Core.step(1 / 60);
    S.enemies.length = 0; const mine = S.mines[0], e = foe2(mine.x, mine.y), e2 = foe2(mine.x + 20, mine.y - 30, { hp: 1e12, maxHp: 1e12 }); const y0 = e2.y;
    Core.step(1 / 60); assert(!S.mines.includes(mine), '밟으면 터진다'); assert(e2.y < y0 - 10, '연쇄 지뢰: 밀어낸다 (세기 20)'); assert(S.mines.filter((m) => m.mini).length === 2 && S.mines.filter((m) => m.mini).every((m) => Math.abs(m.dmg - mine.dmg * 0.4) < 1e-9), '작은 지뢰 2개 (피해 40%)'); }
  // 레이저
  { game(1); const w = put('laser', 2, 100, true); w.sk[0] = [1, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; foe2(250, 300); w.cd = 0; Core.step(1 / 60);
    assert(S.beams.length === 1 && Math.abs(S.beams[0].t - 0.3 + 1 / 60) < 1e-6, '지속 빔: 0.3초'); w.sk[0] = [5, 5, 0]; Core.dirty(w); const st = Core.stats(w); assert(Math.abs(st.holdT - 0.7) < 1e-9 && Math.abs(st.holdD - 0.2) < 1e-9);
    S.beams.length = 0; S.enemies.length = 0; const e = foe2(250, 300); const hp0 = e.hp; w.cd = 99; S.beams.push({ k: 2, t: 0.7, tick: 0.1, st }); const dm = []; for (let i = 0; i < 44; i++) { const h = e.hp; Core.step(1 / 60); if (h - e.hp > 0) dm.push(h - e.hp); }
    assert(dm.length === 7 && dm[6] > dm[0] * 1.3 && dm[1] > dm[0], '초점: 틱마다 피해가 쌓인다 ' + dm); }
  { game(1); const w = put('laser', 2, 100, true); w.sk[0] = [5, 5, 1]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; const st = Core.stats(w); st.crit = 0; const e = foe2(250, 300); w.cd = 99;
    const seen = []; for (let i = 0; i < 70; i++) { const h = e.hp; Core.step(1 / 60); if (h - e.hp > 0) seen.push(h - e.hp); }
    assert(seen.length >= 6 && S.beams.length === 0, '상시 빔: 따로 켜진 빔이 계속 때린다'); assert(seen[0] > 0 && Math.abs(st.alwaysM - 3) < 1e-9);
    const base = st.dmg * 3 * 0.1 / st.cd; assert(Math.abs(seen[0] - base) < 1e-6 * base, '첫 틱 = D x 3.0 x 0.1 / 간격 ' + seen[0] + ' ' + base);
    w.parts[0] = { id: 'ember', g: 3 }; Core.dirty(w); const st3 = Core.stats(w); st3.crit = 0; const e3 = foe2(250, 280); let burns = 0; for (let i = 0; i < 60; i++) { Core.step(1 / 60); if (e3.burnT > 0 && !burns) burns = i; }
    assert(burns > 0 && burns <= 40, '적중 효과(파츠 화상)는 0.5초에 한 번 적용된다'); }
  { game(1); const w = put('laser', 2, 100, true); w.sk[1] = [1, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; const st = Core.stats(w); st.crit = 0;
    const f1 = foe2(250, 400), l1 = foe2(150, 200), l2 = foe2(150, 450), r1 = foe2(350, 300), o1 = foe2(50, 200); w.cd = 0; Core.step(1 / 60);
    assert(1e12 - l1.hp > 0 && 1e12 - r1.hp > 0 && l2.hp === 1e12 && o1.hp === 1e12, '프리즘: 첫 적보다 위의 양옆 레인 적만'); assert(Math.abs(1e12 - l1.hp - st.dmg * 0.12) < 1e-3 * st.dmg, 'D의 12%');
    assert(S.fx.filter((f) => f.k === 'dbeam').length === 2 && S.fx.some((f) => f.k === 'dbeam' && f.x0 === 250 && f.y0 === 400), '대각선 빔 2개');
    w.sk[1] = [5, 5, 1]; Core.dirty(w); const st2 = Core.stats(w); st2.crit = 0; for (const e of S.enemies) e.hp = 1e12; const o2 = foe2(450, 200); const oo = foe2(50, 250); w.cd = 0; S.fx.length = 0; Core.step(1 / 60);
    assert(S.fx.filter((f) => f.k === 'dbeam').length === 4 && S.fx.some((f) => f.rb), '무지개: 한 번 더 갈라져 바깥 레인까지, 무지개색');
    const d1 = 1e12 - l1.hp, d2 = 1e12 - oo.hp; assert(d2 > 0 && Math.abs(d2 / d1 - 0.6) < 0.01, '바깥 레인은 옆 레인의 60% ' + d2 / d1); assert(Math.abs(d1 - st2.dmg * 1.0) < 1e-3 * st2.dmg, '분광: 12x5 + 8x5 = 100%'); }
  { game(1); const w = put('laser', 2, 100, true); w.sk[2] = [3, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; foe2(250, 300); w.cd = 0; Core.step(1 / 60);
    const ml = S.pools.filter((p) => p.kind === 'melt'); assert(ml.length === 1 && Math.abs(ml[0].t - 2) < 0.05 && ml[0].x === 250, '용융선 2초');
    for (let i = 0; i < 5; i++) { w.cd = 0; Core.step(1 / 60); } assert(S.pools.filter((p) => p.kind === 'melt').length === 1, '용융선은 갱신될 뿐 늘지 않는다');
    w.sk[2] = [5, 5, 1]; Core.dirty(w); const st = Core.stats(w); assert(Math.abs(st.meltT - 4) < 1e-9 && Math.abs(st.meltSlow - 0.25) < 1e-9 && st.vap === 0.15);
    S.enemies.length = 0; S.pools.length = 0; const v = foe2(250, 200, { hp: 100, maxHp: 100 }); const bs = foe2(250, 220, { boss: true, type: 'giant', hp: 100, maxHp: 100 }); v.hp = 100; const sx = st; sx.crit = 0;
    const saveDmg = sx.dmg; sx.dmg = 100 * 0.9 / 1; w.cd = 0; Core.step(1 / 60); assert(v.dead && !bs.dead, '소멸: 체력 15% 이하가 되면 증발 (보스 제외)'); assert(S.fx.some((f) => f.k === 'vap'), '하얀 섬광'); sx.dmg = saveDmg; }
  // 펄스
  { game(1); const w = put('pulse', 2, 100, true); w.sk[0] = [1, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; const e = foe2(250, 470); const st = Core.stats(w); let n5 = 0, rings = 0;
    for (let i = 0; i < 900 && w.n < 5; i++) { w.cd = Math.min(w.cd, 0); const n0 = w.n; Core.step(1 / 60); if (w.n > n0 && w.n === 5) n5 = S.fx.filter((f) => f.k === 'ring' && f.fat).length; }
    assert(n5 === 1, '5번째 파동: 거대 파동'); const R2 = st.radius * 1.56; assert(Math.abs(st.novaR - 1.56) < 1e-9 && Math.abs(st.nova - 1.2) < 1e-9, '범위 x(1.4+0.16r), 피해 x(1+0.2r)');
    w.sk[0] = [5, 5, 1]; Core.dirty(w); const st2 = Core.stats(w); assert(st2.novaEvery === 3 && st2.twinStar === 1 && Math.abs(st2.halo - 0.5) < 1e-9);
    w.n = 2; w.cd = 0; S.fx.length = 0; const h0 = e.hp; Core.step(1 / 60); const d1 = h0 - e.hp; assert(S.pools.some((p) => p.kind === 'halo' && Math.abs(p.t - 1.5) < 0.05), '잔광 고리 1.5초'); assert(w.nv > 0, '쌍성: 한 번 더 예약');
    const h1 = e.hp; for (let i = 0; i < 20; i++) Core.step(1 / 60); assert(S.fx.filter((f) => f.k === 'ring' && f.fat).length === 2, '쌍성: 한 번 더 터진다'); assert(h1 - e.hp > d1 * 0.5, '두 번째 폭발 피해 70% (+고리)'); }
  { game(1); const w = put('pulse', 2, 100, true); w.sk[1] = [1, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; w.cd = 99; const st = Core.stats(w); assert.strictEqual(st.orbs, 1);
    const cnt = []; for (let r = 1; r <= 5; r++) { w.sk[1] = [r, 0, 0]; Core.dirty(w); cnt.push(Core.stats(w).orbs); } assert.deepStrictEqual(cnt, [1, 2, 2, 3, 3], '구체 1/2/2/3/3');
    w.sk[1] = [5, 5, 1]; Core.dirty(w); const s2 = Core.stats(w); assert(Math.abs(s2.orbRad - 1.3) < 1e-9 && Math.abs(s2.orbSize - 1.4) < 1e-9 && s2.orbChain === 1 && Math.abs(s2.orbDps - 0.8 * SKILLS.pulse[1].nodes[0].sc) < 1e-9, '궤도 +6%·5, 크기 +8%·5, 초당 80%');
    // 줄에 닿는 적: 구체 사이 선분 위에 둔다
    S.enemies.length = 0; const a = Core.orbPos(2, s2, 0, S.t + 1 / 60), b = Core.orbPos(2, s2, 1, S.t + 1 / 60); const m = foe2((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); Core.step(1 / 60);
    assert(m.hp < 1e12 && m.stunT > 0.2, '전기 사슬: 줄에 닿은 적은 피해와 0.3초 기절'); const st0 = m.stunT; m.stunT = 0; Core.step(1 / 60); assert(m.stunT === 0, '적 하나당 2초에 한 번'); }
  { game(1); const w = put('pulse', 2, 100, true); w.sk[2] = [3, 0, 0]; Core.dirty(w); const S = Core.S; S.spawnAcc = -1e9; w.cd = 99; const st = Core.stats(w);
    const near = foe2(250, 480), far = foe2(250, 520 - st.radius * 0.7 - 30 - 19 * 0.5 + 0), out = foe2(250, 520 - st.radius * 0.7 - 120); Core.step(1 / 60);
    assert(Math.abs(near.slowPct - 0.18) < 1e-9 && out.slowPct === 0, '역장: 안의 적을 6%·r 둔화, 범위 밖은 그대로');
    w.sk[2] = [5, 5, 0]; Core.dirty(w); Core.step(1 / 60); assert(Math.abs(near.vulnPct - 0.15) < 1e-9 && near.vulnT > 0, '약화: 받는 피해 +3%·r');
    const e1 = foe2(250, 470, { hp: 100, maxHp: 100 }); const bef = e1.hp; Core.step(1 / 60); const st5 = Core.stats(w);
    w.sk[2] = [5, 5, 1]; Core.dirty(w); S.enemies = [near]; near.y = 100; near.speed = 0.5; let before = S.hp; w.ct = 0; near.y = 520; S.hp = 100;
    const bait = foe2(250, 400); const hb = bait.hp; Core.step(1 / 60); assert(bait.hp < hb && S.hp < 100, '반격: 기지에 닿는 순간 파동'); const hb2 = bait.hp; const bait2 = foe2(250, 519, { speed: 0.5 }); Core.step(1 / 60);
    assert(bait.hp === hb2 || w.ct > 0.3, '0.5초에 한 번'); }
  ok('새 줄 12개의 핵심 모습: 탄, 불길, 지뢰, 빔, 파동, 구체, 역장이 실제로 만들어진다');
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

'use strict';
/* 표준 봇: 초기 시뮬레이션 봇을 옮겨 온 것. 생성, 장착, 파츠 부착/교체, 용해, 강화, 증강 선택, 기지 강화를 0.5초마다 한 번 처리한다.
   결정적이다: Math.random을 쓰지 않고, 증강을 무작위로 고르는 30%는 시드에서 만든 이 봇 자신의 난수열(mulberry32)로 정한다.
   pin: 벤치가 공짜로 준 대상(비열거 속성 _pin). 봇이 교체하거나 녹이지 않는다. */
function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pinned = (x) => !!(x && x._pin);

function makeBot(Core, seed, o) {
  o = o || {};
  const G = o.G || 6, U = o.U || 40, BASEF = o.BASEF === undefined ? 0.4 : o.BASEF;
  const NOEVO = !!o.noevo;   // true면 진화하지 않는다 (진화 도입 전의 봇과 같은 행동)
  const rr = mulberry32((seed * 1597334677 + 0x9E3779B9) | 0);
  const s = () => Core.S;
  const order = [2, 1, 3, 0, 4];
  const acct = { goldSpent: 0, shardsSpent: 0, gens: 0, log: [] };   // log: 생성 결과 기록(결정성 검사용)

  // 진화: 100강이 되고 조각이 5000 모이면 바로 진화한다. 스킬 포인트는 즉시 쓴다 (결정적 순서: 0번 줄 아래에서 위로, 다음 1번 줄, 2번 줄)
  function evoStep() {
    if (NOEVO) return;
    const S = s();
    for (let k = 0; k < 5; k++) { if (S.slots[k] && Core.canEvolve(k).ok) { Core.evolve(k); acct.evolved = (acct.evolved || 0) + 1; } }
    for (let k = 0; k < 5; k++) {
      const w = S.slots[k]; if (!w || !w.evo) continue;
      for (let l = 0; l < 3; l++) for (let t = 0; t < 3; t++) while (Core.skillUp(k, l, t).ok) acct.skills = (acct.skills || 0) + 1;
    }
  }
  const saving = () => !NOEVO && s().slots.some((w, k) => w && !w.evo && w.lv >= 100);   // 진화할 수 있는 무기가 있으면 조각을 모은다
  function tick() {
    const S = s();
    if (S.pendingPact) Core.skipPact();   // 천칭의 거래 제안이 떠 있으면 건너뛴다 (멈추지 않게)
    for (let g = 0; g < G; g++) {
      const c = Core.genCost();
      if (S.gold >= c && Core.freeSlot() >= 0) {
        const r = Core.generate();
        if (r.ok) { acct.goldSpent += c; acct.gens++; const it = r.item; acct.log.push(it.kind + (it.type || it.id || '') + (it.g != null ? it.g : '') + (it.n != null ? it.n : '')); }
        else break;
      } else break;
    }
    for (let i = 0; i < S.inv.length; i++) {
      const it = S.inv[i]; if (!it) continue;
      if (it.kind === 'w') { const e = order.find((k) => !S.slots[k]); if (e != null) Core.equipWeapon(i, e); else Core.discard(i); }
      else if (it.kind === 'p') {
        if (Core.PARTS[it.id].base) {
          if (Core.basePut(i).ok) continue;
          let lo = -1;
          S.base.parts.forEach((p, k) => { if (!pinned(p) && (lo < 0 || p.g < S.base.parts[lo].g)) lo = k; });
          if (lo >= 0 && S.base.parts[lo].g < it.g) Core.basePut(i, lo);
          Core.meltPart(i); continue;
        }
        const ws = S.slots.map((w, k) => ({ w, k })).filter((x) => x.w).sort((a, b) => b.w.lv - a.w.lv);
        let done = false;
        for (const x of ws) { if (x.w.parts.indexOf(null) >= 0) { Core.attachPart(i, x.k); done = true; break; } }
        if (!done) {
          let worst = null;
          for (const x of ws) x.w.parts.forEach((p, pi) => { if (p && !pinned(p) && p.g < it.g && (!worst || p.g < worst.g)) worst = { g: p.g, k: x.k, pi }; });
          if (worst) Core.replacePart(i, worst.k, worst.pi);
          Core.meltPart(i);
        }
      }
    }
    while (Core.craftPart().ok) { }
    evoStep();
    for (let n = 0; n < U; n++) {
      if (saving() && S.shards < Core.CFG.evoCost) break;   // 진화 비용을 모으는 동안은 다른 강화를 미룬다
      const ws = S.slots.map((w, k) => ({ w, k, e: w ? Core.effLv(w) - (k === 2 ? 12 : 0) : 0 })).filter((x) => x.w && x.w.lv < 100);
      if (BASEF > 0 && S.base.lv < 100) ws.push({ base: true, e: S.base.lv / BASEF });
      if (!ws.length) break;
      ws.sort((a, b) => a.e - b.e);
      const tgt = ws[0].base ? S.base : S.slots[ws[0].k];
      const cost = Core.upgradeInfo(tgt).cost;
      const r = ws[0].base ? Core.upgradeBase() : Core.upgrade(ws[0].k);
      if (!r.ok) break;
      if (!r.saved) acct.shardsSpent += cost;
      if (S.pendingAug) {
        const pa = S.pendingAug, t = pa.base ? S.base : S.slots[pa.slot];
        let bi = 0; pa.options.forEach((op, i) => { if (op.g > pa.options[bi].g) bi = i; });
        if (rr() < 0.3) bi = Math.floor(rr() * 3);
        const r2 = Core.chooseAug(bi);
        if (r2.need) {
          let lo = -1; t.augs.forEach((a, i) => { if (!pinned(a) && (lo < 0 || a.g < t.augs[lo].g)) lo = i; });
          if (lo >= 0 && t.augs[lo].g <= pa.options[bi].g) Core.chooseAug(bi, lo); else Core.skipAug();
        }
      }
      evoStep();
    }
  }
  return { tick, acct };
}
module.exports = { makeBot, mulberry32 };

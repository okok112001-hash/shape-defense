'use strict';
/* 스킬 성능 점검: 진화한 무기 다섯 자루(스킬을 모두 최대로 찍음)와 적 150마리 이상으로 60초를 도는 데 걸리는 시간을 스킬 없는 같은 구성과 비교한다.
   사용: node tools/skill_perf.js [core.js] [--secs 60]
   적이 죽지 않는 경우(hp 아주 큼)와 보통 경우(죽음) 둘 다 잰다. 비율 = 스킬 있음 / 스킬 없음 (목표: 약 2 이하) */
const path = require('path');
const argv = process.argv.slice(2);
const CORE = path.resolve(argv.find((a) => !a.startsWith('--') && !/^\d+$/.test(a)) || path.join(__dirname, '..', 'src', 'core.js'));
const SECS = argv.includes('--secs') ? +argv[argv.indexOf('--secs') + 1] : 60;
const Core = require(CORE);
const TEAMS = { blaster: Array(5).fill('blaster'), shotgun: Array(5).fill('shotgun'), laser: Array(5).fill('laser'), pulse: Array(5).fill('pulse'), mixed: ['blaster', 'shotgun', 'laser', 'pulse', 'laser'] };
function run(team, skills, hpMul) {
  Core.seed(11); Core.newGame(520);
  const S = Core.S; S.shards = 1e12;
  const B = Core.BAL, orig = { hpMul: B.hpMul, spawnRate: B.spawnRate };
  B.hpMul = () => hpMul; B.spawnRate = () => 16;
  team.forEach((t, k) => {
    const w = Core.newWeapon(t); w.lv = 100; S.slots[k] = w; Core.evolve(k);
    if (skills) { w.skp = 33; w.sk = [[5, 5, 1], [5, 5, 1], [5, 5, 1]]; }   // 모든 스킬을 최대로 (현실의 20점보다 무거운 최악의 경우)
    Core.dirty(w);
  });
  S.t = 600; S.nextBoss = 1e9;
  const N = Math.round(SECS * 60); let maxE = 0, sumE = 0;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) { S.hp = S.maxHp; Core.step(1 / 60); if (S.enemies.length > maxE) maxE = S.enemies.length; sumE += S.enemies.length; }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  Object.assign(B, orig); Core.seed(null);
  return { ms, maxE, avgE: sumE / N, kills: S.kills, fx: S.fx.length, mines: S.mines.length, pools: S.pools.length };
}
let worst = 0;
for (const [label, hp] of [['적이 죽지 않음(hp 1e9)', 1e9], ['적이 죽음(hp 배수 30)', 30]]) {
  console.log(`\n## ${label}, ${SECS}초`);
  for (const [name, team] of Object.entries(TEAMS)) {
    run(team, false, hp);   // 예열
    const a = run(team, false, hp), b = run(team, true, hp), r = b.ms / a.ms;
    if (b.maxE >= 150) worst = Math.max(worst, r);
    console.log(`${name.padEnd(8)} 스킬 없음 ${a.ms.toFixed(0)}ms (적 최대 ${a.maxE}, 평균 ${a.avgE.toFixed(0)})  스킬 최대 ${b.ms.toFixed(0)}ms (적 최대 ${b.maxE}, 평균 ${b.avgE.toFixed(0)}, 처치 ${b.kills}, 지뢰 ${b.mines}, 웅덩이류 ${b.pools})  비율 ${r.toFixed(2)}${b.maxE < 150 ? '  (적 150 미만)' : ''}`);
  }
}
console.log(`\n최악 비율 ${worst.toFixed(2)} (목표 약 2 이하)`);

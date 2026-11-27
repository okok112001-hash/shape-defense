// 연결 모드(웨이브 단위 난이도)와 예전 웨이브 방식을 같은 난이도 시간으로 나란히 본다 (T12 O1)
// 실제 게임 코어를 돌려 나온 적의 체력·재화를 모은다 (적은 나오자마자 지운다, 보스는 따로 센다)
// node tools/pipe_table.js [분 수=20]  -> 표를 화면에 찍고 tools/pipe_table.txt 에 남긴다
const fs = require('fs'), path = require('path');
const C = require(path.join(__dirname, '..', 'src', 'core.js'));
const MIN = +(process.argv[2] || 20), DT = 1 / 30;

function run(mode) {
  C.seed(7);
  C.test.newGame({ god: true }, 520, mode);
  const S = C.S, seen = new Set(), rows = [];   // rows[i]: { n, tD, hp, gold, boss, cnt }
  let cur = null;
  const tEnd = MIN * 60;
  while ((mode ? C.tD() : S.t) < tEnd + 1) {
    C.step(DT);
    if (S.wave && (!cur || cur.n !== S.wave.n)) { cur = { n: S.wave.n, tD: C.tD(), t: S.t, hp: 0, gold: 0, boss: S.wave.boss, cnt: 0, v: S.wave.v }; rows.push(cur); }
    for (const e of S.enemies) {
      if (seen.has(e)) continue; seen.add(e);
      if (e.boss || e.cr) continue;
      cur.hp += e.maxHp; cur.gold += e.gold; cur.cnt++;
    }
    S.enemies.length = 0;
    if (S.prep && S.prep.phase === 'rest') C.prepGo();
    if (S.pendingAug) C.skipAug && C.skipAug();
  }
  return rows;
}

const neu = run('pipe'), old = run();
// 1분(난이도 시간) 단위로 묶는다: 예전은 웨이브가 시작한 시각, 연결은 웨이브의 난이도 시간 구간 [30(n-1), 30n) 이 들어가는 분
const bin = (rows, key) => { const b = []; for (const r of rows) { const m = Math.floor(key(r) / 60); if (m >= MIN) continue; (b[m] = b[m] || { hp: 0, gold: 0, w: 0, boss: 0 }); b[m].hp += r.hp; b[m].gold += r.gold; b[m].w++; if (r.boss) b[m].boss++; } return b; };
const bo = bin(old, r => r.t), bn = bin(neu, r => r.tD - C.PREP.span / 2);
const f = (x) => x >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : x >= 1e3 ? (x / 1e3).toFixed(1) + 'k' : x.toFixed(0);
const out = [];
out.push('# 연결 모드(웨이브 30초, 웨이브 n = 난이도 시간 30n-15초) vs 예전 웨이브 방식(20초, 실제 시간)');
out.push('## 웨이브별 (연결 모드)');
out.push('웨이브 | 난이도 시간 | 적 체력 배수 | 기지 피해 배수 | 웨이브 체력 합 | 웨이브 재화 | 종류');
for (const r of neu) {
  if (r.n > MIN * 2) break;
  out.push(`${r.n} | ${(r.tD / 60).toFixed(2)}분 | x${C.BAL.hpMul(r.tD).toFixed(2)} | x${C.BAL.leakMul(r.tD).toFixed(2)} | ${f(r.hp)} | ${f(r.gold)} | ${r.boss ? '보스' : (C.WAVES[r.v].name || '평소')}`);
}
out.push('');
out.push('## 1분(난이도 시간)마다 합: 예전 웨이브 방식 3웨이브 vs 연결 모드 2웨이브 (보스 몸은 빼고 일반 적만)');
out.push('분 | 예전 체력 합 | 연결 체력 합 | 비 | 예전 재화 | 연결 재화 | 비 | 보스 웨이브 예전/연결');
for (let m = 0; m < MIN; m++) {
  const a = bo[m] || { hp: 0, gold: 0, boss: 0 }, b = bn[m] || { hp: 0, gold: 0, boss: 0 };
  out.push(`${m}~${m + 1} | ${f(a.hp)} | ${f(b.hp)} | ${(b.hp / a.hp).toFixed(2)} | ${f(a.gold)} | ${f(b.gold)} | ${(b.gold / a.gold).toFixed(2)} | ${a.boss}/${b.boss}`);
}
const txt = out.join('\n');
console.log(txt);
fs.writeFileSync(path.join(__dirname, 'pipe_table.txt'), txt + '\n');

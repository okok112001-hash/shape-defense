// 배속 추천 기준 점검 (T13d): 연결 모드에서 웨이브 n, 모든 무기 강화 L 로 한 웨이브를 돌려 추천이 뜨는 판을 센다.
// 실행: node tools/spd_tip.js <웨이브들> <강화들> [팀]   예) node tools/spd_tip.js 4,8 30,60,100 acid,shotgun,tesla,pulse,blaster
// 팀을 안 주면 시드마다 무작위 무기 다섯. 판은 무기마다 3칸 이어 보통 공속(draw_bench 와 같음). 기지 무적, 시드 1~5.
// 바탕 조건(웨이브 win 초 지남, 처치 n명, 기지 피해 없음, 깊이 내려온 적 없음)에 더해
//   A: 나타나서 쓰러지기까지 중앙값 <= life,  B: 체력 절반 아래에서 쓰러지기까지 중앙값 <= hit,  U: A 또는 B (게임이 쓰는 것, Core.spdTip)
// 출력: 뜬 판 수/5 (처음 뜬 웨이브 초 평균, 뜬 뒤에 기지가 맞은 판 수). leak/wave: 웨이브 하나에 기지에 닿은 적 수 평균
const C = require('../src/core.js');
const T = C.SPD_TIP;
const med = (a) => { const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
function link() {
  const S = C.S, b = S.m3, own = S.slots.map((w) => w && w.type), rest = Object.keys(C.WEAPONS).filter((t) => own.indexOf(t) < 0);
  for (let k = 0; k < b.C; k++) for (let r = 0; r < b.R; r++) { const o = b.g[r * b.C + k]; o.s = r < 3 && own[k] ? own[k] : rest[(r + k) % rest.length]; o.st = 0; }
}
const [wArg, lArg, tArg] = process.argv.slice(2);
if (!wArg || !lArg) { console.log('사용법: node tools/spd_tip.js <웨이브들> <강화들> [팀]'); process.exit(1); }
const TEAM = tArg ? tArg.split(',') : null, SEEDS = [1, 2, 3, 4, 5];
console.log(`기준 ${JSON.stringify(T)}  팀 ${TEAM ? TEAM.join(',') : '무작위'}`);
for (const n of wArg.split(',').map(Number)) for (const L of lArg.split(',').map(Number)) {
  const got = [[], [], []], bad = [0, 0, 0]; let leaks = 0;
  for (const sd of SEEDS) {
    C.seed(sd); C.test.newGame({ god: true }, undefined, 'pipe'); const S = C.S;
    if (TEAM) for (let k = 0; k < 5; k++) S.slots[k] = C.newWeapon(TEAM[k]);
    for (const w of S.slots) { w.lv = L; w.hi = L; C.dirty(w); }
    if (n > 1) C.test.addTime((n - 1) * C.PREP.span);
    link();
    let lk = S.lkW, nx = 0; const first = [-1, -1, -1], lt = [];
    for (let i = 0; i < 60 * 400 && S.prep.phase === 'wave'; i++) {
      C.step(1 / 60);
      if (S.lkW !== lk) { lk = S.lkW; leaks++; lt.push(S.wt - S.wave.t0); }
      if (S.prep.phase !== 'wave') break;   // 이 프레임에 웨이브를 막았다
      if (S.wt < nx) continue; nx = S.wt + 0.25;   // 화면처럼 0.25초마다
      const el = S.wt - S.wave.t0, from = S.wt - T.win, K = S.kl || [], a = [], b = [];
      if (el < T.win || S.lkW >= from || S.enemies.some((e) => !e.dead && !e.boss && !e.cr && e.y > C.H * T.deep)) continue;
      for (let j = K.length - 3; j >= 0 && K[j] >= from; j -= 3) { a.push(K[j + 1]); b.push(K[j + 2]); }
      if (a.length < T.n) continue;
      const okA = med(b) <= T.life, okB = med(a) <= T.hit, oks = [okA, okB, okA || okB];
      if (oks[2] !== C.spdTip()) throw new Error('Core.spdTip 과 다름');
      for (let q = 0; q < 3; q++) if (oks[q] && first[q] < 0) first[q] = el;
    }
    for (let q = 0; q < 3; q++) if (first[q] >= 0) { got[q].push(first[q]); if (lt.some((x) => x >= first[q])) bad[q]++; }
  }
  const f = (g, q) => `${g.length}${g.length ? '(' + (g.reduce((x, y) => x + y, 0) / g.length).toFixed(0) + 's,' + bad[q] + ')' : ''}`;
  console.log(`w${n} L${L} | leak/wave ${(leaks / SEEDS.length).toFixed(1)} | A ${f(got[0], 0)} B ${f(got[1], 1)} U ${f(got[2], 2)}`);
}

// 배속 추천 기준 점검 (T13d): 연결 모드에서 웨이브 n, 모든 무기 강화 L 로 한 웨이브를 돌려 추천이 뜨는 판을 센다.
// 실행: node tools/spd_tip.js <웨이브들> <강화들> [팀]   예) node tools/spd_tip.js 4,8 30,60,100 acid,shotgun,tesla,pulse,blaster
// 팀을 안 주면 시드마다 무작위 무기 다섯. 판은 무기마다 3칸 이어 보통 공속(draw_bench 와 같음). 기지 무적, 시드 1~5.
// 조건(Core.spdTip): ① 최근 win 초 기지 피해 없음 ② 그 동안 처음 맞고 hit 초 안에 쓰러진 적(한 방 포함)이 n명 이상 (웨이브 win 초 뒤부터)
// 출력: 뜬 판 수/5 (처음 뜬 웨이브 초 평균, 뜬 뒤에 기지가 맞은 판 수). leak/wave: 웨이브 하나에 기지에 닿은 적 수 평균
const C = require('../src/core.js');
const T = C.SPD_TIP;
function link() {
  const S = C.S, b = S.m3, own = S.slots.map((w) => w && w.type), rest = Object.keys(C.WEAPONS).filter((t) => own.indexOf(t) < 0);
  for (let k = 0; k < b.C; k++) for (let r = 0; r < b.R; r++) { const o = b.g[r * b.C + k]; o.s = r < 3 && own[k] ? own[k] : rest[(r + k) % rest.length]; o.st = 0; }
}
const [wArg, lArg, tArg] = process.argv.slice(2);
if (!wArg || !lArg) { console.log('사용법: node tools/spd_tip.js <웨이브들> <강화들> [팀]'); process.exit(1); }
const TEAM = tArg ? tArg.split(',') : null, SEEDS = [1, 2, 3, 4, 5];
console.log(`기준 ${JSON.stringify(T)}  팀 ${TEAM ? TEAM.join(',') : '무작위'}`);
for (const n of wArg.split(',').map(Number)) for (const L of lArg.split(',').map(Number)) {
  const got = [], bad = [0]; let leaks = 0;
  for (const sd of SEEDS) {
    C.seed(sd); C.test.newGame({ god: true }, undefined, 'pipe'); const S = C.S;
    if (TEAM) for (let k = 0; k < 5; k++) S.slots[k] = C.newWeapon(TEAM[k]);
    for (const w of S.slots) { w.lv = L; w.hi = L; C.dirty(w); }
    if (n > 1) C.test.addTime((n - 1) * C.PREP.span);
    link();
    let lk = S.lkW, nx = 0, first = -1; const lt = [];
    for (let i = 0; i < 60 * 400 && S.prep.phase === 'wave'; i++) {
      C.step(1 / 60);
      if (S.lkW !== lk) { lk = S.lkW; leaks++; lt.push(S.wt - S.wave.t0); }
      if (S.prep.phase !== 'wave') break;   // 이 프레임에 웨이브를 막았다
      if (S.wt < nx) continue; nx = S.wt + 0.25;   // 화면처럼 0.25초마다
      const el = S.wt - S.wave.t0, from = S.wt - T.win, K = S.kl || [], a = [];
      for (let j = K.length - 2; j >= 0 && K[j] >= from; j -= 2) a.push(K[j + 1]);
      const ok = el >= T.win && !(S.lkW >= from) && a.filter((x) => x <= T.hit).length >= T.n;
      if (ok !== C.spdTip()) throw new Error('Core.spdTip 과 다름');
      if (ok && first < 0) first = el;
    }
    if (first >= 0) { got.push(first); if (lt.some((x) => x >= first)) bad[0]++; }
  }
  const f = (g, q) => `${g.length}${g.length ? '(' + (g.reduce((x, y) => x + y, 0) / g.length).toFixed(0) + 's,' + bad[q] + ')' : ''}`;
  console.log(`w${n} L${L} | leak/wave ${(leaks / SEEDS.length).toFixed(1)} | 뜬 판 ${f(got, 0)}`);
}

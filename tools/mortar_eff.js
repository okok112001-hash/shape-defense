'use strict';
/* 박격포 진화 스킬 세기: 유효 피해량의 비 (T6, 사용자 제안 2026-11-17).
   박격포는 포탄 수(2초에 한 발, 한 발에 최대 8명)가 한계라 "버티는 적 체력 배수"(skill_eq.js 의 M*)로는 공격력 환산이 안 된다.
   그래서 세기를 "낭비 없이 실제로 깎은 체력의 합"(core.js 의 credit, 무기의 dealt)의 비로 본다:
     R = 박격포 유효 피해(스킬) / 박격포 유효 피해(스킬 없음)  = 피해 x 맞은 수 x 발수 x (1 - 낭비율) 의 비.
   팀 = 섞인 팀 [블래스터, 박격포, 블래스터, 박격포, 블래스터] (모두 진화 0강, 블래스터는 스킬 없음, 박격포 칸 1, 3 에 같은 스킬).
   적 체력 = 블래스터 다섯 자루 팀의 M* (skill_eq_report_t6b.txt 머리, 보통 팀이 버티는 세기). 시드 1..4, 체력 흔들기 0.2 (skill_eq 와 같음).
   참고 줄: 공격력 +100/+300% 가짜 파츠 (낭비가 얼마나 되는지: 낭비가 없으면 2.00 / 4.00).
   "새는 비율" = 그 판에서 무기 없을 때 대비 기지 피해. 낮으면(적을 거의 다 잡으면) 더 잡을 적이 없어 R 이 눌린다.
   --alone: 블래스터 없이 박격포 두 자루만 (적을 다 잡아 R 이 눌리는 것을 피한다, 대신 적이 더 빽빽하다).
   --hp k: 적 체력을 k 배 (완성 줄이 적을 다 잡아 눌리는 것을 피한다. 체력이 높으면 낭비도 준다).
   사용: node tools/mortar_eff.js [--alone] [--hp 3] [--runs 4] [--tag 이름]   결과: tools/mortar_eff_report[_이름].txt */
const fs = require('fs');
const path = require('path');
const B = require('./bench.js');
const args = process.argv.slice(2);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const N = +(val('--runs') || 4), TAG = val('--tag'), JIT = 0.2, ALONE = args.includes('--alone'), HPX = +(val('--hp') || 1);
B.init(); const Core = B.core();
for (const [id, d] of Object.entries({ _me_k1: 1, _me_k3: 3 })) Core.PARTS[id] = { name: `가짜: 공격력 +${d * 100}%`, v: [d, d, d, d], ap: (s, v) => { s.dmgPct += v; } };

// 블래스터 다섯 자루 팀의 M* (같은 방법으로 잰 값을 리포트에서 읽는다)
const rep = fs.readFileSync(path.join(__dirname, 'skill_eq_report_t6b.txt'), 'utf8');
const line = rep.split('\n').find((l) => /^\s+blaster\s+few/.test(l));
const MB = {}; for (const m of line.matchAll(/(few|swarm|mix|boss|early) ([\d.]+)/g)) MB[m[1]] = +m[2];
const SC = ['few', 'swarm', 'mix', 'boss', 'early'], KO = { few: '정예', swarm: '물량', mix: '표준', boss: '보스전', early: '초반' };

const zero = () => [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
const team = (sk, part) => [0, 1, 2, 3, 4].map((i) => (i === 1 || i === 3 ? { t: 'mortar', p: part ? [[part, 0]] : [], a: [], evo: 1, sk } : ALONE ? null : { t: 'blaster', p: [], a: [], evo: 1, sk: zero() }));
const lineSk = (k, r) => { const s = zero(); s[k] = r; return s; };
const NAMES = Core.SKILLS.mortar.map((l) => l.name);
const CFG = [
  { name: '스킬 없음', spec: team(zero()) },
  { name: '참고: 공격력 +100%', spec: team(zero(), '_me_k1') },
  { name: '참고: 공격력 +300%', spec: team(zero(), '_me_k3') },
];
for (let k = 0; k < 3; k++) {
  CFG.push({ name: `${NAMES[k]} 뿌리만`, spec: team(lineSk(k, [5, 0, 0])) });
  CFG.push({ name: `${NAMES[k]} 완성`, spec: team(lineSk(k, [5, 5, 1])) });
}

const t0 = Date.now();
const none = {}; for (const sk of SC) { let l = 0; for (let s = 1; s <= N; s++) l += B.runSim(B.NONE, sk, s, 1, JIT).leak; none[sk] = l; }
const res = CFG.map((c) => {
  const o = {};
  for (const sk of SC) {
    let d = 0, l = 0, all = 0;
    for (let s = 1; s <= N; s++) { const r = B.runSim(c.spec, sk, s, MB[sk] * HPX, JIT); d += r.wd[1] + r.wd[3]; l += r.leak; all += r.dealt; }
    o[sk] = { d, leak: l / none[sk], share: d / all };
  }
  return o;
});
const gm = (a) => Math.exp(a.reduce((s, x) => s + Math.log(x), 0) / a.length);
const f2 = (x) => x.toFixed(2).padStart(6);
const pad = (s, n) => { let w = 0; for (const ch of s) w += ch.charCodeAt(0) > 0x2e80 ? 2 : 1; return s + ' '.repeat(Math.max(0, n - w)); };
const out = [];
out.push('도형 디펜스 박격포 진화 스킬 유효 피해 리포트 (tools/mortar_eff.js)');
out.push(`생성: ${new Date().toISOString()}  시드 1..${N}, 체력 흔들기 ±${JIT}, 소요 ${((Date.now() - t0) / 60000).toFixed(1)}분`);
out.push(ALONE ? '[방법] 박격포 두 자루만 (칸 1, 3, 진화 0강, 같은 스킬, --alone). 다른 무기가 없어 적이 남으므로 "다 잡아서 더 깎을 체력이 없는" 눌림이 없다. 대신 적이 빽빽해 폭발당 맞는 수는 실제보다 많다. 적 체력 = 블래스터 다섯 자루 팀의 M*:' : '[방법] 섞인 팀 [블래스터, 박격포, 블래스터, 박격포, 블래스터] (모두 진화 0강), 박격포 두 자루에 같은 스킬. 적 체력 = 블래스터 다섯 자루 팀의 M*:');
out.push('  ' + SC.map((s) => `${KO[s]} ${MB[s]}`).join(', ') + (HPX !== 1 ? `  (여기에 x${HPX}, --hp)` : ''));
out.push('  R = 박격포 유효 피해(실제로 깎은 체력, 낭비 제외)의 비 = 피해 x 맞은 수 x 발수 x (1 - 낭비율). 공격력 +100% 의 R 이 2 보다 작은 만큼이 낭비(이미 죽을 적에게 남는 피해).');
out.push('');
out.push('[R]                              ' + SC.map((s) => pad(KO[s], 7)).join('') + ' 기하평균');
res.forEach((o, i) => { const r = SC.map((s) => o[s].d / res[0][s].d); out.push(`  ${pad(CFG[i].name, 30)} ${r.map(f2).join(' ')}   ${f2(gm(r))}`); });
out.push('');
out.push('[새는 비율 (무기 없을 때 대비) / 팀 피해 중 박격포 몫]');
res.forEach((o, i) => out.push(`  ${pad(CFG[i].name, 30)} ${SC.map((s) => `${o[s].leak.toFixed(2)}/${o[s].share.toFixed(2)}`).map((x) => x.padStart(10)).join(' ')}`));
const txt = out.join('\n') + '\n';
const rp = path.join(__dirname, TAG ? `mortar_eff_report_${TAG}.txt` : 'mortar_eff_report.txt');
fs.writeFileSync(rp, txt); console.log(txt); console.log('저장:', rp);

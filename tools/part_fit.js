// 파츠 추천 표 (T13g): 무기 파츠마다 "잘 맞는 무기"를 tools/value.js 의 무기별 종합 가치로 뽑는다.
//   node tools/part_fit.js            표를 보이고 tools/part_fit.txt 에 남긴다
//   node tools/part_fit.js --write    src/core.js 의 PART_FIT 블록을 새 표로 바꾼다 (수치를 바꾼 뒤)
//   node tools/part_fit.js --check    core 의 표가 지금 계산과 같은지 본다 (다르면 종료 코드 1)
// 규칙: 영웅 등급(영웅이 없으면 가장 가까운 등급)의 종합 가치 v(무기)로
//   - 가장 높은 값 mx 가 0 이하면 추천 없음
//   - 가장 낮은 값이 mx x FIT_FLAT 이상이면 추천 없음 (어디에 달아도 비슷)
//   - v >= mx x FIT_HI 이고 0 보다 큰 무기를 추천
//   - 추천이 후보의 FIT_MANY 이상이면 추천 없음 (거의 어디든 맞아 가려 주는 것이 없음)
//   후보 무기는 범위 무기 전용 파츠(area)면 범위 무기만, 아니면 8종 모두. 기지 파츠는 뺀다.
'use strict';
const path = require('path');
const fs = require('fs');
const V = require('./value.js');
const { Core, P, partVal } = V;
const { PARTS, WEAPONS, WEAPON_IDS, GRADES } = Core;
const FIT_HI = 0.75, FIT_FLAT = 0.5, FIT_MANY = 0.75;
const AREA_W = WEAPON_IDS.filter((t) => WEAPONS[t].cap && !WEAPONS[t].capSk);   // value.js 와 같은 범위 무기
const CORE = path.join(__dirname, '..', 'src', 'core.js');
const A = '// PART_FIT 시작', Z = '// PART_FIT 끝';

function build() {
  const rows = [], fit = {};
  for (const id of Object.keys(PARTS)) {
    const D = PARTS[id];
    if (D.base) continue;
    const g = Math.min(D.max != null ? D.max : 3, Math.max(2, D.min || 0));
    const cands = D.area ? AREA_W : WEAPON_IDS;
    const val = {}; for (const t of WEAPON_IDS) val[t] = partVal(id, g, t, P).all;
    const vs = cands.map((t) => val[t]), mx = Math.max(...vs), lo = Math.min(...vs);
    let pick = [], why;
    if (!(mx > 0.005)) why = '가치 없음';
    else if (lo >= mx * FIT_FLAT) why = '어디나 비슷';
    else {
      pick = cands.filter((t) => val[t] > 0 && val[t] >= mx * FIT_HI);
      if (pick.length >= cands.length * FIT_MANY) { why = `거의 어디나 (${pick.length}/${cands.length})`; pick = []; }
    }
    if (pick.length) fit[id] = pick;
    rows.push({ id, g, val, cands, pick, why });
  }
  return { rows, fit };
}
const fitText = (fit) => 'const PART_FIT = {\n' + Object.keys(fit).map((id) => `  ${id}: [${fit[id].map((t) => `'${t}'`).join(', ')}],`).join('\n') + '\n};';

const { rows, fit } = build();
const pad = (s, n) => { s = String(s); const w = [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0); return s + ' '.repeat(Math.max(0, n - w)); };
const lpad = (s, n) => ' '.repeat(Math.max(0, n - String(s).length)) + s;
const o = [];
o.push(`파츠 추천 표 (tools/part_fit.js). 칸 = 영웅 등급(없으면 가까운 등급)의 종합 가치 %, * = 추천, ( ) = 후보 밖(범위 무기 전용)`);
o.push(`규칙: 가장 높은 값의 ${FIT_HI}배 이상 추천, 가장 낮은 값이 ${FIT_FLAT}배 이상이면 없음, 추천이 후보의 ${FIT_MANY} 이상이면 없음`);
o.push(pad('파츠', 26) + pad('등급', 5) + WEAPON_IDS.map((t) => lpad(t.slice(0, 6), 8)).join('') + '   추천');
for (const r of rows) {
  const cells = WEAPON_IDS.map((t) => { const v = Math.round(r.val[t] * 100), s = r.cands.includes(t) ? `${v}${r.pick.includes(t) ? '*' : ' '}` : `(${v})`; return lpad(s, 8); }).join('');
  o.push(pad(`${r.id} ${PARTS[r.id].name}`, 26) + pad(GRADES[r.g], 5) + cells + '   ' + (r.pick.length ? r.pick.map((t) => WEAPONS[t].name).join(', ') : `- (${r.why})`));
}
const txt = o.join('\n') + '\n';

const args = process.argv.slice(2);
const src = fs.readFileSync(CORE, 'utf8'), i0 = src.indexOf(A), i1 = src.indexOf(Z);
if (i0 < 0 || i1 < i0) { console.error('src/core.js 에 PART_FIT 표시 줄이 없습니다'); process.exit(1); }
const nl = src.includes('\r\n') ? '\r\n' : '\n';
const body = fitText(fit).replace(/\n/g, nl);
const cur = src.slice(src.indexOf(nl, i0) + nl.length, i1).replace(/\s+$/, '');
if (args.includes('--check')) {
  const same = cur === body;
  console.log(same ? 'PART_FIT 이 지금 계산과 같습니다' : 'PART_FIT 이 지금 계산과 다릅니다. node tools/part_fit.js --write');
  process.exit(same ? 0 : 1);
}
process.stdout.write(txt);
fs.writeFileSync(path.join(__dirname, 'part_fit.txt'), txt);
if (args.includes('--write')) {
  if (cur === body) console.log('\nPART_FIT 그대로 (바뀐 것 없음)');
  else { fs.writeFileSync(CORE, src.slice(0, src.indexOf(nl, i0) + nl.length) + body + nl + src.slice(i1)); console.log('\nsrc/core.js 의 PART_FIT 을 바꿨습니다'); }
} else console.log(cur === body ? '\ncore 의 PART_FIT 과 같음' : '\ncore 의 PART_FIT 과 다름 (--write 로 바꿈)');

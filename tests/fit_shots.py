"""파츠 추천 (T13g) 검사와 캡처. 정비 시간에 무기 다섯(펄스, 박격포, 저격포, 레이저, 블래스터)과 파츠 몇 개를 두고:
   인벤토리 파츠를 고르면 잘 맞는 무기 칸에만 반짝임(core PART_FIT 과 같은 칸), 추천 없는 파츠·기지 파츠는 없음,
   대장간 파츠 고르기에서 이 무기와 잘 맞는 파츠 줄에 반짝임, 설정 '파츠 추천'을 끄면 사라지고(장착 가능 표시는 그대로) 새로 고침 뒤에도 끔.
   실행 (저장소 루트, 먼저 python build.py): python tests/fit_shots.py [테마들 쉼표로, 기본 paper,navy] [rm]
   결과: dist/fit/<테마>_<번호>.png (화면 아래쪽만), 실패하면 FAIL 줄과 종료 코드 1"""
import asyncio, os, sys, pathlib
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'fit'); os.makedirs(OUT, exist_ok=True)
THS = (sys.argv[1] if len(sys.argv) > 1 else 'paper,navy').split(',')
RM = 'rm' in sys.argv[2:]
VW, VH = 390, 760
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)

TYPES = ['pulse', 'mortar', 'rail', 'laser', 'blaster']
FITS = "() => [...document.querySelectorAll('#weapons .slot')].map((e, k) => e.classList.contains('fit') && !!e.querySelector('.fitic') ? k : -1).filter(k => k >= 0)"
TGS = "() => [...document.querySelectorAll('#weapons .slot.tg')].length"
WANT = "(id) => Core.S.slots.map((w, k) => w && Core.partFits(id, w.type) ? k : -1).filter(k => k >= 0)"

async def run(b, TH):
    c = await b.new_context(viewport={'width': VW, 'height': VH}, device_scale_factor=2, has_touch=True, is_mobile=True, reduced_motion='reduce' if RM else 'no-preference')
    await c.add_init_script(f"localStorage.setItem('shape-defense-theme','{TH}'); localStorage.setItem('shape-defense-mute','1');")
    pg = await c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.goto(pathlib.Path(ROOT, 'index.html').as_uri()); await pg.wait_for_timeout(600)
    await pg.click('text=테스트 모드'); await pg.wait_for_timeout(500)
    ev = pg.evaluate
    n = [0]
    pre = f'{TH}{"_rm" if RM else ""}'
    async def shot(tag, y0=None):   # 무기 칸부터 아래만 (y0 없으면 무기 칸 위)
        n[0] += 1; await pg.wait_for_timeout(350)
        if y0 is None: y0 = max(0, await ev("document.getElementById('weapons').getBoundingClientRect().top") - 6)
        await pg.screenshot(path=os.path.join(OUT, f'{pre}_{n[0]:02d}_{tag}.png'), clip={'x': 0, 'y': y0, 'width': VW, 'height': VH - y0})
    async def tap(sel_):
        await pg.tap(sel_); await pg.wait_for_timeout(200)
    has = lambda sel_: ev(f"!!document.querySelector({sel_!r})")
    # 정비로: 적을 다 나오게 하고 지운다. 무기 다섯, 파츠 몇 개
    await ev("(()=>{const S=Core.S;S.cheat.god=true;})()")
    await ev("""(()=>{const S=Core.S,wv=S.wave;S.wt=wv.t0+Core.PREP.spawnT;wv.bq=[];S.pendingBoss=null;S.enemies=[];S.gold=1e6;S.shards=20000;
      %s.forEach((t,k)=>{const w=Core.newWeapon(t);w.lv=w.hi=12+7*k;S.slots[k]=w;Core.dirty(w);});
      const P=(id,g)=>({kind:'p',id,g});S.inv=Array(15).fill(null);[P('range',2),P('sniper',1),P('dmg',2),P('shield',2),P('chill',0),P('ember',3),P('gamble',1)].forEach((it,i)=>S.inv[i]=it);
      S.invDirty=true;S.slotDirty=true;})()""" % TYPES)
    await pg.wait_for_timeout(2600)
    await pg.tap('#fieldWrap', position={'x': 30, 'y': 30}); await pg.wait_for_timeout(200)
    check(await ev("Core.S.prep.phase") == 'rest', f'{TH}: 정비 시간')
    check(await ev("JSON.stringify(Core.S.slots.map(w=>w.type))") == str(TYPES).replace("'", '"').replace(' ', ''), f'{TH}: 무기 다섯')
    # 인벤토리 파츠 → 무기 칸: 잘 맞는 칸에만 반짝임
    for i, id_, tag in [(0, 'range', 'range'), (1, 'sniper', 'sniper'), (5, 'ember', 'ember'), (4, 'chill', 'chill')]:
        await tap(f'[data-inv="{i}"]')
        got, want, tg = await ev(FITS), await ev(f"({WANT})('{id_}')"), await ev(TGS)
        check(got == want and len(want) > 0 and tg == 5, f'{TH}: {id_} 고르면 반짝임 칸 {got} (표 {want}), 장착 가능 표시 {tg}칸')
        if id_ in ('range', 'sniper'): await shot('inv_' + tag)
        await tap(f'[data-inv="{i}"]')   # 다시 누르면 취소
        check(await ev(FITS) == [], f'{TH}: {id_} 취소하면 반짝임 없음')
    for i, id_ in [(2, 'dmg'), (6, 'gamble')]:
        await tap(f'[data-inv="{i}"]')
        check(await ev(FITS) == [] and await ev(TGS) == 5, f'{TH}: 추천 없는 파츠({id_})는 반짝임 없음, 장착 가능 표시는 그대로')
        await tap(f'[data-inv="{i}"]')
    await tap('[data-inv="3"]')
    check(await ev(FITS) == [] and await ev(TGS) == 0, f'{TH}: 기지 파츠는 반짝임 없음')
    await tap('[data-inv="3"]')
    # 대장간 파츠 고르기: 레이저(3번 칸)의 빈 파츠 칸 → 저격 조준기·발화 장치 줄에 반짝임, 확장 모듈 줄은 없음
    await tap('#forgeBtn'); await tap('[data-fw="3"]'); await tap('.fpt.empty')
    rows = await ev("[...document.querySelectorAll('[data-wput]')].map(e=>({i:+e.dataset.wput,fit:e.classList.contains('fit')&&!!e.querySelector('.fitic')}))")
    fit_ids = sorted([r['i'] for r in rows if r['fit']])
    want = await ev("[...Core.S.inv.keys()].filter(i=>{const it=Core.S.inv[i];return it&&it.kind==='p'&&!Core.PARTS[it.id].base&&Core.partFits(it.id,'laser');})")
    check(fit_ids == sorted(want) and 1 in fit_ids and 0 not in fit_ids, f'{TH}: 대장간 파츠 고르기(레이저) 반짝임 줄 {fit_ids} (표 {want})')
    await shot('forge_laser', 0)
    await tap('[data-act=wpickBack]'); await tap('[data-act=wclose]')
    # 설정에서 끄기: 일시정지 → 설정 → 파츠 추천 끔 → 계속
    await tap('#pauseBtn'); await tap('[data-act=opts]')
    check(await has('.orow[data-opt=partTip]') and await ev("document.querySelector('.orow[data-opt=partTip]').getAttribute('aria-checked')") == 'true', f'{TH}: 설정 창에 파츠 추천, 처음엔 켬')
    if TH == THS[0]: await shot('opts_on', 0)
    await tap('.orow[data-opt=partTip]')
    st = await ev("localStorage.getItem('shape-defense-opts')")
    check(st is not None and '"partTip":false' in st, f'{TH}: 끄면 저장 {st}')
    await tap('[data-act=optsBack]'); await tap('[data-act=resume]'); await pg.wait_for_timeout(300)
    await tap('[data-inv="0"]')
    check(await ev(FITS) == [] and await ev(TGS) == 5, f'{TH}: 끄면 반짝임 없음, 장착 가능 표시는 그대로')
    await shot('inv_off')
    await tap('[data-inv="0"]')
    await tap('#forgeBtn'); await tap('[data-fw="3"]'); await tap('.fpt.empty')
    check(await ev("document.querySelectorAll('[data-wput].fit, [data-wput] .fitic').length") == 0, f'{TH}: 끄면 대장간 파츠 줄에도 없음')
    await tap('[data-act=wpickBack]'); await tap('[data-act=wclose]')
    # 새로 고침 뒤에도 끔, 다시 켬
    await pg.reload(); await pg.wait_for_timeout(700)
    await tap('[data-act=opts]')
    check(await ev("document.querySelector('.orow[data-opt=partTip]').getAttribute('aria-checked')") == 'false', f'{TH}: 새로 고침 뒤에도 끔')
    await tap('.orow[data-opt=partTip]')
    check('"partTip":true' in (await ev("localStorage.getItem('shape-defense-opts')") or ''), f'{TH}: 다시 켬')
    check(not errs, f'{TH}: 페이지 오류 없음 {errs[:3]}')
    await c.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for TH in THS: await run(b, TH)
        await b.close()
    print(f'\n{"실패 " + str(len(fails)) + "개" if fails else "모두 통과"}  (캡처: dist/fit)')
    sys.exit(1 if fails else 0)
asyncio.run(main())

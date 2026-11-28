"""스킬 포인트를 받는 순간 (T14a) 검사와 캡처.
   검사: 테스트 모드(강화 100%)로 진화한 무기를 포인트 경계에서 강화 버튼 연타 -> 연출 중에는 강화가 더 되지 않고, 스킬 창이 뜬 뒤 0.4초 안의 누름과
   창이 뜨기 전에 시작한 누름으로는 포인트가 쓰이지 않음, 손가락이 닿아 있으면 뗄 때까지 창이 뜨지 않음, 스킬 버튼으로 직접 열면 바로 뜨고 바로 찍힘.
   캡처: 연출을 0.1배로 늦춰 0.1초 간격으로 찍어 한 장에 모은다.
   실행 (저장소 루트, 먼저 python build.py): python tests/skpt_shots.py [테마들 쉼표로, 기본 paper,navy] [rm] [가로x세로]
   결과: dist/skpt/sheet_<테마>[_rm]_<가로>.png, 실패하면 FAIL 줄과 종료 코드 1"""
import asyncio, os, sys, pathlib, json
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'skpt')
THS = (sys.argv[1] if len(sys.argv) > 1 else 'paper,navy').split(',')
RM = 'rm' in sys.argv[2:]
VW, VH = next(([int(v) for v in a.split('x')] for a in sys.argv[2:] if 'x' in a), (390, 760))   # 화면 크기 (예 360x640)
SLOW = 0.1
TIMES = [0.05] + [0.1 * i for i in range(1, 12)]
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)

async def setup(b, TH, rm):
    c = await b.new_context(viewport={'width': VW, 'height': VH}, device_scale_factor=1, has_touch=True, is_mobile=True,
                            reduced_motion='reduce' if rm else 'no-preference')
    await c.add_init_script(f"localStorage.setItem('shape-defense-theme','{TH}')")
    pg = await c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.goto(pathlib.Path(ROOT, 'index.html').as_uri()); await pg.wait_for_timeout(600)
    await pg.click('text=테스트 모드'); await pg.wait_for_timeout(500)
    # 정비로: 적을 다 나오게 하고 지운다. 강화 100%, 조각 넉넉히. 0번 무기는 진화 +3 (5강에서 포인트)
    await pg.evaluate("""(()=>{const S=Core.S,wv=S.wave;S.cheat.god=true;S.cheat.succ=true;S.wt=wv.t0+Core.PREP.spawnT;wv.bq=[];S.pendingBoss=null;S.enemies=[];S.shards=1e6;
      const w=S.slots[0];w.evo=true;w.sk=[[0,0,0],[0,0,0],[0,0,0]];w.lv=3;w.hi=3;w.skp=0;Core.dirty(w);S.slotDirty=true;})()""")
    await pg.wait_for_timeout(2600)
    await pg.tap('#fieldWrap', position={'x': 30, 'y': 30}); await pg.wait_for_timeout(200)
    await pg.tap('#forgeBtn'); await pg.wait_for_timeout(300)
    if await pg.evaluate("document.querySelector('.fg-chip.on') && document.querySelector('.fg-chip.on').dataset.fw") != '0':
        await pg.tap('[data-fw="0"]'); await pg.wait_for_timeout(250)
    return c, pg, errs

ev_ = lambda pg: (lambda s: pg.evaluate(s))
async def checks(b, TH):
    c, pg, errs = await setup(b, TH, RM)
    ev = ev_(pg)
    st = lambda: ev("(()=>{const w=Core.S.slots[0];return {lv:w.lv,skp:w.skp,spent:w.sk.flat().reduce((a,b)=>a+b,0),sk:!!document.querySelector('.modal.skm'),fg:!!document.querySelector('.modal.fg:not(.fgout)')}})()")
    D = 0.45 if RM else 0.7
    # 1) 4강 -> 5강(포인트) 를 누르고 연출 동안 같은 자리를 연타
    await pg.tap('[data-act=wup]'); await pg.wait_for_timeout(200)
    check((await st())['lv'] == 4, '4강')
    bx = await ev("(()=>{const r=document.querySelector('[data-act=wup]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
    t0 = await ev("performance.now()")
    await pg.tap('[data-act=wup]')
    s = await st(); check(s['lv'] == 5 and s['skp'] == 1 and not s['sk'] and s['fg'], f'5강에서 포인트, 스킬 창은 아직 {s}')
    has_cv = await ev("!!document.getElementById('skFxCv') && !document.getElementById('skFxCv').hidden")
    check(has_cv != RM, '별빛 캔버스 ' + ('없음 (움직임 줄이기)' if RM else '있음'))
    check(await ev("!!document.querySelector('[data-act=skOpen].skglow')"), '스킬 버튼이 밝아짐')
    n = 0
    while await ev(f"performance.now()-{t0}") < D * 1000 - 90:
        await pg.touchscreen.tap(bx[0], bx[1]); n += 1; await pg.wait_for_timeout(40)
    s = await st(); check(s['lv'] == 5 and not s['sk'], f'연출 중 연타 {n}번: 강화 안 됨, 창 아직 {s}')
    await pg.wait_for_function("!!document.querySelector('.modal.skm')", polling=5, timeout=2000)
    open_ms = await ev(f"performance.now()-{t0}")
    check(D * 1000 - 20 <= open_ms <= D * 1000 + 200, f'스킬 창이 연출 뒤에 뜸 ({open_ms:.0f}ms)')
    check(await ev("!!document.querySelector('.modal.skm.skrise')"), '스킬 창이 떠오르며 나타남')
    # 2) 창이 뜬 뒤 0.4초 안의 찍기·노드 누름은 무시
    ctr = lambda q: ev(f"(()=>{{const r=document.querySelector({q!r}).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()")
    up, nd = await ctr('[data-act=skUp]'), await ctr('[data-sk="1:0"]')   # 좌표로 바로 누른다 (pg.tap 은 떠오르는 연출이 멈출 때까지 기다린다)
    ta = await ev("performance.now()")
    k = 0
    while await ev(f"performance.now()-{ta}") < 300:
        await pg.touchscreen.tap(up[0], up[1]); await pg.touchscreen.tap(nd[0], nd[1]); k += 1
    el = await ev(f"performance.now()-{ta}")
    s = await st(); check(s['spent'] == 0 and s['sk'], f'창이 뜬 뒤 {el:.0f}ms 안의 찍기·노드 {k}번씩: 포인트 안 씀 {s}')
    check(await ev("!document.querySelector('[data-sk=\"1:0\"].sel')"), '0.4초 안의 노드 누름도 무시')
    await pg.wait_for_timeout(450)
    await pg.tap('[data-act=skUp]'); await pg.wait_for_timeout(150)
    s = await st(); check(s['spent'] == 1, f'0.4초 뒤 찍기는 됨 {s}')
    await pg.tap('[data-act=skClose]'); await pg.wait_for_timeout(250)
    check((await st())['fg'], '닫으면 대장간으로')
    # 3) 손가락이 닿아 있으면 뗄 때까지 창이 뜨지 않고, 그 누름의 click 은 아무것도 하지 않음
    await ev("(()=>{const w=Core.S.slots[0];w.lv=9;w.hi=9;Core.dirty(w);})()")
    await pg.tap('[data-fw="1"]'); await pg.wait_for_timeout(200); await pg.tap('[data-fw="0"]'); await pg.wait_for_timeout(250)
    bx = await ev("(()=>{const r=document.querySelector('[data-act=wup]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
    skx = await ev("(()=>{const r=document.querySelector('[data-act=skOpen]').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
    cdp = await c.new_cdp_session(pg)
    await pg.tap('[data-act=wup]'); await pg.wait_for_timeout(150)
    s = await st(); check(s['lv'] == 10 and s['skp'] == 2 and not s['sk'], f'10강 포인트 {s}')
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': bx[0], 'y': bx[1]}]})
    await pg.wait_for_timeout(int(D * 1000) + 400)
    s = await st(); check(not s['sk'], f'손가락이 닿아 있는 동안은 창이 안 뜸 {s}')
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    await pg.wait_for_timeout(250)
    s = await st(); check(s['sk'] and s['lv'] == 10 and s['spent'] == 1, f'떼면 창이 뜨고 그 누름은 무시됨 {s}')
    await pg.wait_for_timeout(400); await pg.tap('[data-act=skClose]'); await pg.wait_for_timeout(250)
    # 4) 스킬 버튼으로 직접 열면 바로 뜨고 바로 찍힘
    await pg.tap('[data-act=skOpen]'); await pg.wait_for_timeout(60)
    s = await st(); check(s['sk'] and not await ev("!!document.querySelector('.modal.skm.skrise')"), '스킬 버튼: 바로 열림 (떠오르는 연출 없음)')
    await pg.tap('[data-act=skUp]'); await pg.wait_for_timeout(100)
    s = await st(); check(s['spent'] == 2, f'스킬 버튼으로 연 창은 바로 찍힘 {s}')
    await pg.wait_for_timeout(300)
    check(not await ev("!!document.querySelector('.fgout')") and await ev("document.getElementById('skFxCv') ? document.getElementById('skFxCv').hidden : true"), '연출 요소가 남지 않음')
    check(not errs, f'페이지 오류 {errs[:3]}')
    await c.close()

async def shots(b, TH):
    c, pg, errs = await setup(b, TH, RM)
    ev = ev_(pg)
    await pg.tap('[data-act=wup]'); await pg.wait_for_timeout(300)   # 4강
    cdp = await c.new_cdp_session(pg)
    await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', {'playbackRate': SLOW})
    await ev(f"""(()=>{{const o=performance.now.bind(performance),b=o();performance.now=()=>b+(o()-b)*{SLOW};
      const st=window.setTimeout;window.setTimeout=(f,d,...a)=>st(f,(d||0)/{SLOW},...a);}})()""")
    await pg.tap('[data-act=wup]'); t0 = await ev("performance.now()")
    box = await ev("(()=>{const b=document.querySelector('.modal.fg').getBoundingClientRect();return [b.x,b.y,b.width,b.height]})()")
    frames = []
    for t in TIMES:
        await pg.wait_for_function(f"performance.now()-{t0}>={t*1000}", polling=5)
        el = await ev(f"performance.now()-{t0}")
        f = os.path.join(OUT, f'{TH}{"_rm" if RM else ""}_{VW}_{int(t*100):03d}.png'); await pg.screenshot(path=f)
        frames.append((f, el / 1000))
    print(TH, 'errors', len(errs), errs[:3])
    await c.close()
    x, y, w, h = [int(v) for v in box]
    cols = 6; rows = (len(frames) + cols - 1) // cols; fw, fh = int(w * 0.62), int(h * 0.62)
    sheet = Image.new('RGB', (cols * fw, rows * (fh + 16)), 'white'); d = ImageDraw.Draw(sheet)
    for i, (f, el) in enumerate(frames):
        im = Image.open(f).convert('RGB'); px = (i % cols) * fw; py = (i // cols) * (fh + 16)
        sheet.paste(im.crop((x, y, x + w, y + h)).resize((fw, fh)), (px, py + 16)); d.text((px + 4, py + 2), f'{el:.2f}s', fill='black')
    sp = os.path.join(OUT, f'sheet_{TH}{"_rm" if RM else ""}_{VW}.png'); sheet.save(sp); print(sp)

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for TH in THS:
            await checks(b, TH)
            await shots(b, TH)
        await b.close()
    print('FAILS', len(fails))
    sys.exit(1 if fails else 0)
asyncio.run(main())

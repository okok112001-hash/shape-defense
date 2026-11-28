"""T14d 기지 강화 성공·실패 연출이 창 밖으로 넘치지 않는지 본다. 정비 때 대장간 기지 탭에서 강화 순간을 0.1초 간격으로 찍는다.
   실행 (저장소 루트, 먼저 python build.py): python tests/base_up_shots.py [테마들, 기본 paper,navy] [가로 세로]
   결과: dist/t14d/*.png, 카드 바운딩 박스가 창 안쪽에 머무는지 검사"""
import asyncio, os, sys, pathlib
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 't14d'); os.makedirs(OUT, exist_ok=True)
THS = (sys.argv[1] if len(sys.argv) > 1 else 'paper,navy').split(',')
VW, VH = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (390, 760)
fails = []
async def run(b, TH):
    c = await b.new_context(viewport={'width': VW, 'height': VH}, device_scale_factor=1, has_touch=True, is_mobile=True)
    await c.add_init_script(f"localStorage.setItem('shape-defense-theme','{TH}')")
    pg = await c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(pathlib.Path(ROOT, 'index.html').as_uri()); await pg.wait_for_timeout(600)
    await pg.click('text=테스트 모드'); await pg.wait_for_timeout(500)
    ev = pg.evaluate
    await ev("""(()=>{const S=Core.S,wv=S.wave;S.cheat.god=true;S.wt=wv.t0+Core.PREP.spawnT;wv.bq=[];S.pendingBoss=null;S.enemies=[];S.gold=1e6;S.shards=20000;})()""")
    await pg.wait_for_timeout(2600)
    await pg.tap('#forgeBtn'); await pg.wait_for_timeout(300)
    await pg.tap('[data-ft=b]'); await pg.wait_for_timeout(300)
    for tag, succ in (('ok', True), ('no', False)):
        await ev(f"(()=>{{Core.S.cheat.succ={'true' if succ else 'false'};Core.S.shards=20000;}})()")
        if not succ:
            await ev("(()=>{Core.S.base.lv=97;Core.S.base.hi=97;Core.S.cheat.succ=false;})()")
        await pg.evaluate("window.__r=[]")
        await pg.tap('[data-act=bup]')
        worst = 0
        for i in range(10):
            r = await ev("""(()=>{const m=document.querySelector('.modal.fg').getBoundingClientRect(),c=document.querySelector('.fg-card').getBoundingClientRect(),n=document.querySelector('.fg-card .nm').getBoundingClientRect();
              return [m.left,m.right,c.left,c.right,n.left,n.right,document.querySelector('.fg-card').className]})()""")
            worst = max(worst, r[0]-r[2], r[3]-r[1], r[0]-r[4], r[5]-r[1])
            await pg.screenshot(path=os.path.join(OUT, f'{TH}_{VW}_{tag}_{i}.png'))
            await pg.wait_for_timeout(100)
        print(('ok   ' if worst <= 0 else 'FAIL ') + f'{TH} {VW}x{VH} {tag}: out-of-window max {worst:.1f}px {r[6]}')
        if worst > 0: fails.append(tag)
        await pg.wait_for_timeout(900)
    if errs: print('FAIL 페이지 오류', errs); fails.append('err')
    await c.close()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for t in THS: await run(b, t)
        await b.close()
asyncio.run(main()); sys.exit(1 if fails else 0)

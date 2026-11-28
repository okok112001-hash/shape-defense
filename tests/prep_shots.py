"""웨이브를 막고 정비로 넘어가는 연출 캡처 (T13c). 연출(CSS 애니메이션과 performance.now)을 0.1배로 늦춰 0.1초 간격으로 찍고 한 장에 모은다.
   끝에 '다음 웨이브'를 눌러 정비 -> 웨이브 쪽도 몇 장 찍는다.
   실행 (저장소 루트, 먼저 python build.py): python tests/prep_shots.py [테마 paper|navy|...] [rm]
   rm 을 붙이면 움직임 줄이기. 결과: dist/prep/sheet_<테마>[_rm].png"""
import asyncio, os, sys, pathlib, json
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'prep')
TH = sys.argv[1] if len(sys.argv) > 1 else 'paper'
RM = len(sys.argv) > 2 and sys.argv[2] == 'rm'
SLOW = 0.1
TIMES = [0.1 * i for i in range(0, 16)] + [1.8]
BACK = [0.05, 0.15, 0.3, 0.5]          # 다음 웨이브를 누른 뒤
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        c = await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=1, has_touch=True, is_mobile=True,
                                reduced_motion='reduce' if RM else 'no-preference')
        await c.add_init_script(f"localStorage.setItem('shape-defense-theme','{TH}')")
        pg = await c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(pathlib.Path(ROOT, 'index.html').as_uri()); await pg.wait_for_timeout(600)
        await pg.click('text=시작'); await pg.wait_for_timeout(500)
        # 무기마다 세 칸 잇고, 부식 블록 하나 (판 위 표시가 함께 가라앉는지)
        await pg.evaluate("""(()=>{const S=Core.S,b=S.m3;for(let k=0;k<5;k++){const w=S.slots[k];if(!w)continue;for(let r=0;r<3;r++)b.g[r*5+k].s=w.type;}
          b.g[11].ru=6;})()""")
        await pg.wait_for_timeout(3500)
        cdp = await c.new_cdp_session(pg)
        await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', {'playbackRate': SLOW})
        await pg.evaluate(f"""(()=>{{const o=performance.now.bind(performance),b=o();performance.now=()=>b+(o()-b)*{SLOW};
          const st=window.setTimeout;window.setTimeout=(f,d,...a)=>st(f,(d||0)/{SLOW},...a);
          const S=Core.S,wv=S.wave;S.wt=wv.t0+Core.PREP.spawnT;wv.bq=[];S.pendingBoss=null;S.enemies=[];window.__t0=performance.now();}})()""")
        frames = []
        st = "(()=>{const e=document.querySelector('#bottom'),p=document.querySelector('#prepBar');return e.className+'|'+(p.hidden?'h':'v')+(p.classList.contains('out')?'o':'')+'|'+Core.S.prep.phase})()"
        for t in TIMES:
            await pg.wait_for_function(f"performance.now()-window.__t0>={t*1000}", polling=5)
            el = await pg.evaluate("performance.now()-window.__t0")
            f = os.path.join(OUT, f'{TH}{"_rm" if RM else ""}_{int(t*100):03d}.png'); await pg.screenshot(path=f)
            frames.append((f, el / 1000, await pg.evaluate(st)))
        await pg.evaluate("window.__t0=performance.now()")
        await pg.tap('[data-act=prepGo]')
        for t in BACK:
            await pg.wait_for_function(f"performance.now()-window.__t0>={t*1000}", polling=5)
            el = await pg.evaluate("performance.now()-window.__t0")
            f = os.path.join(OUT, f'{TH}{"_rm" if RM else ""}_go{int(t*100):03d}.png'); await pg.screenshot(path=f)
            frames.append((f, el / 1000, 'go ' + await pg.evaluate(st)))
        print('errors', len(errs), errs[:3])
        print(json.dumps([(round(x[1], 3), x[2]) for x in frames]))
        await b.close()
    n = len(frames); cols = 7; rows = (n + cols - 1) // cols
    fw, fh = int(390 * 0.5), int(760 * 0.5)
    sheet = Image.new('RGB', (cols * fw, rows * (fh + 16)), 'white'); d = ImageDraw.Draw(sheet)
    for i, (f, el, cls) in enumerate(frames):
        im = Image.open(f).convert('RGB'); x = (i % cols) * fw; y = (i // cols) * (fh + 16)
        sheet.paste(im.resize((fw, fh)), (x, y + 16))
        d.text((x + 4, y + 2), f'{"go " if cls.startswith("go") else ""}{el:.2f}s', fill='black')
    sp = os.path.join(OUT, f'sheet_{TH}{"_rm" if RM else ""}.png'); sheet.save(sp); print(sp)
asyncio.run(main())

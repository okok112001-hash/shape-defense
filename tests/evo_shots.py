"""진화하는 순간의 연출 캡처. 연출(CSS 애니메이션과 performance.now, setTimeout)을 0.1배로 늦춰 0.1초 간격으로 찍고 한 장에 모은다.
   실행 (저장소 루트, 먼저 python build.py): python tests/evo_shots.py [테마 paper|navy|...] [무기 blaster|mortar|...] [rm]
   rm 을 붙이면 움직임 줄이기. 결과: dist/evo/sheet_<테마>_<무기>.png (위: 전장과 무기 칸 축소, 아래: 3번 칸 확대)"""
import asyncio, os, sys, pathlib, json
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'evo')
TH = sys.argv[1] if len(sys.argv) > 1 else 'paper'
WP = sys.argv[2] if len(sys.argv) > 2 else 'blaster'
RM = len(sys.argv) > 3 and sys.argv[3] == 'rm'
SLOW = 0.1
TIMES = [0.1 * i for i in range(1, 13)] + [1.4, 1.6, 2.6]
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        c = await b.new_context(viewport={'width': 390, 'height': 700}, device_scale_factor=1, has_touch=True, is_mobile=True,
                                reduced_motion='reduce' if RM else 'no-preference')
        await c.add_init_script(f"localStorage.setItem('shape-defense-theme','{TH}')")
        pg = await c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(pathlib.Path(ROOT, 'index.html').as_uri()); await pg.wait_for_timeout(600)
        await pg.click('text=시작'); await pg.wait_for_timeout(4000)   # 적이 조금 내려오게
        await pg.evaluate(f"""(()=>{{const S=Core.S;S.shards=6000;const w=S.slots[2]||S.slots.find(Boolean);w.type='{WP}';w.lv=100;Core.dirty(w);S.slots[2]=w;S.slotDirty=true;}})()""")
        await pg.wait_for_timeout(300)
        await pg.tap('[data-slot="2"]'); await pg.wait_for_timeout(150); await pg.tap('[data-slot="2"]'); await pg.wait_for_timeout(300)   # 두 번 눌러 무기 창
        await pg.tap('[data-act=evoOpen]'); await pg.wait_for_timeout(250)
        cdp = await c.new_cdp_session(pg)
        await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', {'playbackRate': SLOW})
        await pg.evaluate(f"""(()=>{{const o=performance.now.bind(performance),b=o();performance.now=()=>b+(o()-b)*{SLOW};
          const st=window.setTimeout;window.setTimeout=(f,d,...a)=>st(f,(d||0)/{SLOW},...a);window.__t0=performance.now();}})()""")
        await pg.tap('[data-act=evoOk]')
        box = await pg.evaluate("(()=>{const r=e=>{const b=document.querySelector(e).getBoundingClientRect();return [b.x,b.y,b.width,b.height]};return {w:r('#weapons'),s:r('[data-slot=\"2\"]')}})()")
        frames = []
        for t in TIMES:
            await pg.wait_for_function(f"performance.now()-window.__t0>={t*1000}", polling=5)
            el = await pg.evaluate("performance.now()-window.__t0")
            f = os.path.join(OUT, f'{TH}_{WP}{"_rm" if RM else ""}_{int(t*100):03d}.png'); await pg.screenshot(path=f)
            cls = await pg.evaluate("document.querySelector('[data-slot=\"2\"]').className")
            frames.append((f, el / 1000, cls))
        print('errors', len(errs), errs[:3])
        print(json.dumps([(round(x[1], 3), x[2]) for x in frames]))
        await b.close()
    wx, wy, ww, wh = box['w']; sx, sy, sw, sh = box['s']
    bot = int(wy + wh + 4)
    n = len(frames); cols = 6; rows = (n + cols - 1) // cols
    fw, fh = int(390 * 0.5), int(bot * 0.5); zw, zh = int((sw + 40) * 2), int((sh + 40) * 2)
    sheet = Image.new('RGB', (cols * max(fw, zw), rows * (fh + zh + 18)), 'white'); d = ImageDraw.Draw(sheet)
    for i, (f, el, cls) in enumerate(frames):
        im = Image.open(f).convert('RGB'); x = (i % cols) * max(fw, zw); y = (i // cols) * (fh + zh + 18)
        sheet.paste(im.crop((0, 0, 390, bot)).resize((fw, fh)), (x, y + 16))
        sheet.paste(im.crop((int(sx - 20), int(sy - 20), int(sx + sw + 20), int(sy + sh + 20))).resize((zw, zh)), (x, y + 16 + fh))
        d.text((x + 4, y + 2), f'{el:.2f}s', fill='black')
    sp = os.path.join(OUT, f'sheet_{TH}_{WP}{"_rm" if RM else ""}.png'); sheet.save(sp); print(sp)
asyncio.run(main())

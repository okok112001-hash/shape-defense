"""연결 판의 물길을 연결 수별로 찍는다 (1, 2, 3, 5, 9개 줄을 한 판에).
   실행: python tests/pipe_shots.py [테마=paper]   -> dist/board/pipe_<테마>_*.png (판 부분 a, b 는 0.25초 간격, 전체 화면 full)"""
import asyncio, os, pathlib, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THEME = sys.argv[1] if len(sys.argv) > 1 else 'paper'
OUT = os.path.join(ROOT, 'dist', 'board'); os.makedirs(OUT, exist_ok=True)
# 줄 번호(무기 칸) 배치. '.' 은 아무 무기와도 이어지지 않는 블록
LAYOUT = ['01234', '.1234', '..234', '.4334', '.4444']

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        c = await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.add_init_script(f"localStorage.setItem('shape-defense-theme', '{THEME}'); localStorage.setItem('shape-defense-mute', '1');")
        await pg.goto(pathlib.Path(ROOT, 'index.html').as_uri()); await pg.wait_for_timeout(700)
        btn = await pg.query_selector('text=시작')
        if btn: await btn.click()
        await pg.wait_for_timeout(600)
        n = await pg.evaluate("""(lay) => { const S = Core.S; S.cheat = { god: true }; S.spawnAcc = -1e9;
          const b = S.m3, ty = S.slots.map(w => w.type), fill = Core.WEAPON_IDS.find(t => ty.indexOf(t) < 0);
          lay.forEach((row, r) => [...row].forEach((ch, c) => { const o = b.g[r * b.C + c]; o.s = ch === '.' ? fill : ty[+ch]; o.st = 0; o.ru = 0; o.sl = 0; }));
          return Core.pipeLinks().map(l => l[0]); }""", LAYOUT)
        print('연결 수', n)
        await pg.wait_for_timeout(500)
        box = await (await pg.query_selector('#m3cv')).bounding_box()
        clip = {'x': box['x'], 'y': box['y'] - 70, 'width': box['width'], 'height': box['height'] + 70}
        await pg.screenshot(path=os.path.join(OUT, f'pipe_{THEME}_a.png'), clip=clip)
        await pg.wait_for_timeout(250)
        await pg.screenshot(path=os.path.join(OUT, f'pipe_{THEME}_b.png'), clip=clip)
        await pg.screenshot(path=os.path.join(OUT, f'pipe_{THEME}_full.png'))
        print('오류', errs or '없음')
        await b.close()

asyncio.run(main())

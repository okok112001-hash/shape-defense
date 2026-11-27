"""그림 품질 대조표: 새로 그린 보스(교란체, 석화체)와 품질 기준(황금체, 보급 상자)을 같은 배율로 잘라 붙인다.
   행: 0.17초 간격 6장(보통) + 6장(판에 거는 능력을 예고 중). 열: SPOTS 순서.
   실행 (저장소 루트, 먼저 python build.py): python tests/compare_sheet.py [테마들 쉼표=paper] [rm]  -> dist/compare/sheet_<테마>.png
   새 그림을 넣을 때는 SPOTS 의 앞쪽 두 자리를 그 대상으로 바꿔 쓴다 (뒤쪽 둘은 기준이니 그대로)."""
import asyncio, os, pathlib, sys
from playwright.async_api import async_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'compare'); os.makedirs(OUT, exist_ok=True)
THEMES = (sys.argv[1] if len(sys.argv) > 1 else 'paper').split(',')
RM = 'rm' in sys.argv[2:]
SPOTS = [('jumble', 130, 0.33), ('stone', 370, 0.33), ('gold', 130, 0.72), ('crate', 370, 0.72)]   # (종류, x, 높이 비율)

async def one(p, th):
    b = await p.chromium.launch()
    c = await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True, is_mobile=True, reduced_motion='reduce' if RM else 'no-preference')
    pg = await c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(f"localStorage.setItem('shape-defense-theme', '{th}'); localStorage.setItem('shape-defense-mute', '1');")
    await pg.goto(pathlib.Path(ROOT, 'index.html').as_uri()); await pg.wait_for_timeout(700)
    await (await pg.query_selector('text=시작')).click(); await pg.wait_for_timeout(400)
    await pg.evaluate("""(spots) => { const S = Core.S, H = Core.H; S.cheat = { god: true }; S.spawnAcc = -1e9; for (const w of S.slots) if (w) w.cd = 1e9;
      for (const [type, x, fy] of spots) { const d = Core.ENEMIES[type]; const e = { type, lane: Math.floor(x / 100), x, y: H * fy, r: d.r, hp: 0.6e15, maxHp: 1e15, speed: 0, leak: d.leak, gold: 0, boss: true, born: S.t - 1 - x / 100,
        slowT: 0, slowPct: 0, vulnT: 0, vulnPct: 0, cor: 0, corV: 0, corA: 0, corH: 0, corS: -1, burnT: 0, burnDps: 0, burnSt: null, stunT: 0, dead: false, flash: 0, fT: 0, fDps: 0, fSt: null, fcB: null, fcN: 0, fcT: 0, chT: -9, abT: 1e9 };
        if (type === 'gold') e.gd = { G: 0, bt: 1e9, got: 0, acc: 0 }; if (type === 'crate') e.cr = { t: 1e9, id: 7 }; S.enemies.push(e); } }""", SPOTS)
    rect = await pg.evaluate("() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [r.left, r.top, r.width]; }")
    sc, H, frames = rect[2] / 500, await pg.evaluate("() => Core.H"), []
    for phase in (0, 1):
        if phase: await pg.evaluate("() => { const b = Core.S.m3; b.jw = { rows: [1, 3], t: 1e9 }; b.sw = [{ i: 7, t: 1e9 }, { i: 16, t: 1e9 }]; }"); await pg.wait_for_timeout(1200)
        else: await pg.wait_for_timeout(1500)
        for k in range(6):
            fn = os.path.join(OUT, '_frame.png'); await pg.screenshot(path=fn)
            frames.append(Image.open(fn).copy()); await pg.wait_for_timeout(170)
    await b.close()
    half, cells = 78, []   # 잘라 낼 반폭 (게임 좌표)
    for im in frames:
        row = []
        for (t, x, fy) in SPOTS:
            cx, cy, hw = (rect[0] + x * sc) * 2, (rect[1] + H * fy * sc) * 2, half * sc * 2
            row.append(im.crop((int(cx - hw), int(cy - hw), int(cx + hw), int(cy + hw))))
        cells.append(row)
    w = cells[0][0].width
    sheet = Image.new('RGB', ((w + 2) * len(SPOTS), (w + 4) * len(cells)), (128, 128, 128))
    for i, row in enumerate(cells):
        for j, im in enumerate(row): sheet.paste(im, (j * (w + 2), i * (w + 4)))
    out = os.path.join(OUT, f'sheet_{th}{"_rm" if RM else ""}.png'); sheet.save(out)
    print(th, 'errors', len(errs), errs[:2], out)

async def main():
    async with async_playwright() as p:
        for th in THEMES: await one(p, th)
asyncio.run(main())

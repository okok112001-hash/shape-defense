"""연결 판에 거는 보스 능력(교란체, 석화체, 황금 블록) 연출을 찍는다 (T12 O2).
   실행: python tests/board_shots.py [테마=paper] [rm]   -> dist/board/<테마>_*.png
   시작 버튼으로 연결 모드 게임을 연 뒤 테스트 함수(Core.test)를 쓰려고 S.cheat 를 켠다. 보스 능력 시계(e.abT)를 당겨 기다림을 줄인다."""
import asyncio, os, pathlib, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THEME = sys.argv[1] if len(sys.argv) > 1 else 'paper'
RM = 'rm' in sys.argv[2:]
OUT = os.path.join(ROOT, 'dist', 'board'); os.makedirs(OUT, exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        c = await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True, is_mobile=True, reduced_motion='reduce' if RM else 'no-preference')
        pg = await c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.add_init_script(f"localStorage.setItem('shape-defense-theme', '{THEME}'); localStorage.setItem('shape-defense-mute', '1');")
        await pg.goto(pathlib.Path(ROOT, 'index.html').as_uri()); await pg.wait_for_timeout(700)
        btn = await pg.query_selector('text=시작')
        if btn: await btn.click()
        await pg.wait_for_timeout(600)
        ev = pg.evaluate
        async def shot(name, w=0):
            if w: await pg.wait_for_timeout(w)
            await pg.screenshot(path=os.path.join(OUT, f'{THEME}{"_rm" if RM else ""}_{name}.png'))
        await ev("() => { const S = Core.S; S.cheat = { god: true }; S.spawnAcc = -1e9; S.bossOnly = 'jumble'; Core.test.boss(); }")
        await pg.wait_for_timeout(3400)
        boss = "(t) => Core.S.enemies.find(e => e.type === t && !e.dead)"
        await ev(f"() => {{ const e = ({boss})('jumble'); e.hp = e.maxHp = 1e15; e.abT = 0.05; }}")
        await shot('1_jumble_warn', 2300)
        await shot('2_jumble_ghost', 1900)
        await shot('3_jumble_after', 700)
        await ev(f"() => {{ const S = Core.S, e = ({boss})('jumble'); e.dead = true; S.enemies = S.enemies.filter(o => !o.dead); S.bossOnly = 'stone'; Core.test.boss(); }}")
        await pg.wait_for_timeout(3400)
        await ev(f"() => {{ const e = ({boss})('stone'); e.hp = e.maxHp = 1e15; e.abT = 0.05; }}")
        await shot('4_stone_warn', 2600)
        await shot('5_stone_dust', 1650)
        await shot('6_stone_set', 800)
        await ev(f"() => {{ const e = ({boss})('stone'); e.abT = 0.05; }}")
        await shot('7_stone_more', 4600)
        # 부식체: 0번 무기 열을 그 무기 블록으로 이어 두고 부르면, 이어진 블록 하나가 부식된다 (무기 칸은 +0, 물길의 흐르는 점이 보라)
        await ev(f"() => {{ const S = Core.S, e = ({boss})('stone'); e.dead = true; S.enemies = S.enemies.filter(o => !o.dead); const b = S.m3, t = S.slots[0].type; for (const r of [0, 1, 2]) {{ b.g[r * b.C].s = t; b.g[r * b.C].st = 0; }} S.bossOnly = 'corrode'; Core.test.boss(); }}")
        await pg.wait_for_timeout(3400)
        await ev(f"() => {{ const e = ({boss})('corrode'); e.hp = e.maxHp = 1e15; e.speed = 0; e.abT = 0.05; }}")
        await shot('a_rust_new', 350)
        await shot('b_rust_set', 900)
        await shot('c_rust_drip', 1800)
        await ev("() => { const b = Core.S.m3, i = Core.rustAt(b); if (i >= 0) b.g[i].ru = 0.05; }")
        await shot('d_rust_end', 380)
        await ev(f"() => {{ const S = Core.S, e = ({boss})('corrode'); e.dead = true; S.enemies = S.enemies.filter(o => !o.dead); S.bossOnly = null; Core.test.gold(); }}")
        await pg.wait_for_timeout(3300)
        await ev("() => { const e = Core.S.enemies.find(o => o.gd); e.hp = e.maxHp = 1e15; }")
        await shot('8_gold_new', 1150)
        await shot('9_gold_more', 5500)
        print('errors', len(errs), errs[:3]); await b.close()
asyncio.run(main())

"""웨이브 막대(HUD 아래, 연결 모드 웨이브 중)를 찍는다 (T13b).
   실행: python tests/wave_shots.py [테마=paper] [rm]   -> dist/wave/<테마>_*.png (전체) 와 *_top.png (위쪽만 크게)
   시작 버튼으로 연결 모드 게임을 연 뒤 테스트 함수를 쓰려고 S.cheat 를 켠다(기지 무적). 웨이브 시각(S.wt)을 당겨 기다림을 줄인다.
   차례: 시작 -> 보스 예고 -> 보스 나옴 -> 보스 처치 -> 90초 뒤 마무리(남은 적 절반 처치) -> 정비(막대 숨김) -> 사냥철(보스 둘)."""
import asyncio, os, pathlib, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THEME = sys.argv[1] if len(sys.argv) > 1 else 'paper'
RM = 'rm' in sys.argv[2:]
OUT = os.path.join(ROOT, 'dist', 'wave'); os.makedirs(OUT, exist_ok=True)

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
        state = "() => { const S = Core.S, w = S.wave, el = document.getElementById('waveBar'); return { ph: S.prep.phase, t: +(S.wt - w.t0).toFixed(1), bt: w.bt, hidden: el.hidden, cls: el.className, wf: el.firstChild.style.cssText, wb: [...el.querySelectorAll('.wb')].map(x => x.className + (x.hidden ? ' [hidden]' : '') + ' ' + x.style.left) }; }"
        async def shot(name, w=0):
            if w: await pg.wait_for_timeout(w)
            pre = f'{THEME}{"_rm" if RM else ""}_{name}'
            await pg.screenshot(path=os.path.join(OUT, pre + '.png'))
            await pg.screenshot(path=os.path.join(OUT, pre + '_top.png'), clip={'x': 0, 'y': 0, 'width': 390, 'height': 110})
            print(name, await ev(state))
        async def jump(sec):   # 웨이브 시각을 sec 초로
            await ev(f"() => {{ const S = Core.S; S.wt = S.wave.t0 + {sec}; }}")
        await ev("() => { Core.S.cheat = { god: true }; }")
        await shot('1_start', 1500)
        await jump(42.6); await shot('2_warn', 500)
        await shot('3_boss', 3200)
        # 보스 처치: 체력을 아주 조금 남겨 두고 맞게 한다 (안 맞으면 직접 쓰러뜨린다)
        await ev("() => { for (const e of Core.S.enemies) if (e.wb != null) e.hp = 1e-6; }")
        await pg.wait_for_timeout(2500)
        await ev("() => { const S = Core.S; for (const e of S.enemies) if (e.wb != null && !e.dead) { e.dead = true; } S.enemies = S.enemies.filter(e => !e.dead); }")
        await shot('4_killed', 300)
        await ev("() => { Core.S.spawnAcc += 14; }")   # 당긴 시간만큼 적이 덜 나왔으니 조금 채운다
        await jump(89.5); await shot('5_end_full', 1200)
        await ev("() => { const S = Core.S, a = S.enemies.filter(e => !e.dead && !e.cr); a.sort((x, y) => y.hp - x.hp); let h = a.reduce((s, e) => s + e.hp, 0) * 0.5; for (const e of a) { if (h <= 0) break; h -= e.hp; e.dead = true; } S.enemies = S.enemies.filter(e => !e.dead); }")
        await shot('6_end_less', 800)
        await ev("() => { const S = Core.S; for (const e of S.enemies) if (!e.cr) e.dead = true; S.enemies = S.enemies.filter(e => !e.dead); }")
        await shot('7_prep', 600)
        # 사냥철: 보스 둘 (30초, 60초). 첫 보스는 쓰러뜨리고 둘째는 예고 중
        await ev("() => { const S = Core.S; if (S.pacts.indexOf('hunt') < 0) S.pacts.push('hunt'); Core.test.nextWave(); }")
        await shot('8_hunt_start', 1200)
        await jump(29.5); await pg.wait_for_timeout(3600)
        await ev("() => { const S = Core.S; for (const e of S.enemies) if (e.wb != null) e.dead = true; S.enemies = S.enemies.filter(e => !e.dead); }")
        await jump(57.5); await shot('9_hunt_warn', 400)
        # 일시정지 중에도 막대는 남는다 (창 아래)
        await pg.click('#pauseBtn'); await shot('a_pause', 400)
        print('errors', errs)
        await b.close()

asyncio.run(main())

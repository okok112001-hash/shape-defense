"""배속 추천과 설정 창을 찍고 점검한다 (T13d).
   실행: python tests/spd_shots.py [테마=paper] [rm]   -> dist/spd/<테마>_*.png (전체) 와 *_top.png (위쪽만 크게)
   설정 창: 처음엔 켬, 끄면 저장되고 새로 고침 뒤에도 끔, 다시 켬.
   추천: 연결 모드 게임에서 모두 100강 + 판을 무기마다 3칸 이어 Core.step 으로 시간을 당긴다(기지 무적).
   뜸 -> 10초 뒤 사라짐 -> 다음 웨이브에서 2배를 누르면 사라짐 -> 기지가 맞은 웨이브는 안 뜸 -> 설정을 끄면 안 뜸."""
import asyncio, os, pathlib, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THEME = sys.argv[1] if len(sys.argv) > 1 else 'paper'
RM = 'rm' in sys.argv[2:]
OUT = os.path.join(ROOT, 'dist', 'spd'); os.makedirs(OUT, exist_ok=True)
LINK = """() => { const S = Core.S, b = S.m3, own = S.slots.map(w => w && w.type), rest = Object.keys(Core.WEAPONS).filter(t => own.indexOf(t) < 0);
  for (let k = 0; k < b.C; k++) for (let r = 0; r < b.R; r++) { const o = b.g[r * b.C + k]; o.s = r < 3 && own[k] ? own[k] : rest[(r + k) % rest.length]; o.st = 0; } }"""
STATE = """() => { const S = Core.S, el = document.getElementById('spdTip'), bt = document.getElementById('speedBtn');
  return { wave: S.wn, t: S.wave ? +(S.wt - S.wave.t0).toFixed(1) : null, core: Core.spdTip(), shown: !el.hidden && el.classList.contains('on'), hidden: el.hidden, btn: bt.className, txt: bt.textContent }; }"""
fails = []
def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        c = await b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True, is_mobile=True, reduced_motion='reduce' if RM else 'no-preference')
        pg = await c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.add_init_script(f"localStorage.setItem('shape-defense-theme', '{THEME}'); localStorage.setItem('shape-defense-mute', '1');")
        await pg.goto(pathlib.Path(ROOT, 'index.html').as_uri()); await pg.wait_for_timeout(700)
        ev = pg.evaluate
        pre = f'{THEME}{"_rm" if RM else ""}_'
        async def shot(name, w=0, top=False):
            if w: await pg.wait_for_timeout(w)
            await pg.screenshot(path=os.path.join(OUT, pre + name + '.png'))
            if top: await pg.screenshot(path=os.path.join(OUT, pre + name + '_top.png'), clip={'x': 230, 'y': 0, 'width': 160, 'height': 80})
        async def adv(sec):   # 게임 시간을 sec 초 당긴다 (1배 그대로)
            await ev(f"() => {{ for (let i = 0; i < {round(sec * 60)}; i++) Core.step(1 / 60); }}")
            await pg.wait_for_timeout(150)
        async def until_shown(n=16):   # 판정은 순간마다 흔들린다 (대형 웨이브, 적이 몰리는 때): 0.5초씩 몇 초 더 기다려 본다
            s = await ev(STATE)
            for _ in range(n):
                if s['shown']: break
                await adv(0.5); s = await ev(STATE)
            return s
        async def tap(sel):
            await pg.locator(sel).first.tap(); await pg.wait_for_timeout(250)
        opt = "() => { const r = document.querySelector('.orow[data-opt=spdTip]'); return { aria: r && r.getAttribute('aria-checked'), store: localStorage.getItem('shape-defense-opts') }; }"

        # 설정 창
        await shot('1_start')
        await tap('[data-act=opts]'); o = await ev(opt); check(o['aria'] == 'true' and o['store'] is None, f'처음엔 켬, 저장 없음 {o}')
        await shot('2_opts_on')
        await tap('.orow[data-opt=spdTip]'); o = await ev(opt); check(o['aria'] == 'false' and o['store'] == '{"spdTip":false,"partTip":true}', f'끄면 저장 {o}')
        await shot('3_opts_off')
        await pg.reload(); await pg.wait_for_timeout(700)
        await tap('[data-act=opts]'); o = await ev(opt); check(o['aria'] == 'false', f'새로 고침 뒤에도 끔 {o}')
        await tap('.orow[data-opt=spdTip]'); o = await ev(opt); check(o['aria'] == 'true' and o['store'] == '{"spdTip":true,"partTip":true}', f'다시 켬 {o}')
        await tap('[data-act=optsBack]')
        check(await ev("() => !!document.querySelector('.modal.start')"), '뒤로: 시작 화면')

        # 추천: 모두 100강, 판 이음, 웨이브 6 난이도
        await tap('text=시작')
        await ev("() => { Core.S.cheat = { god: true }; Core.test.maxAll(); Core.test.addTime(450); }"); await ev(LINK)
        await adv(19); s = await ev(STATE); check(not s['shown'], f'20초 전에는 안 뜸 {s}')
        await adv(1.5); s = await until_shown(); check(s['shown'] and 'tip' in s['btn'], f'20초 뒤 뜸 {s}')
        await shot('4_tip', 900, True)
        await pg.wait_for_timeout(500); await shot('4_tip_b', 0, True)
        await adv(10); await pg.wait_for_timeout(1100); s = await ev(STATE); check(s['hidden'] and 'tip' not in s['btn'], f'10초 뒤 사라짐 {s}')
        await adv(5); s = await ev(STATE); check(s['hidden'], f'같은 웨이브에는 다시 안 뜸 {s}')
        async def next_wave():
            await ev("() => { const S = Core.S; S.wt = S.wave.t0 + 90; S.spawnAcc = 0; S.wave.bq = []; S.pendingBoss = null; for (const e of S.enemies) e.dead = true; S.enemies = []; }")
            await adv(0.2); await ev("() => Core.test.nextWave()"); await ev(LINK); await pg.wait_for_timeout(200)
        # 2배를 누르면 사라진다
        await next_wave(); await adv(21); s = await until_shown(); check(s['shown'], f'다음 웨이브에 다시 뜸 {s}')
        await tap('#speedBtn'); await shot('5_2x_fading', 300, True)
        await pg.wait_for_timeout(1000); s = await ev(STATE); check(s['hidden'] and s['txt'] == '2배', f'2배를 누르면 사라짐 {s}')
        await tap('#speedBtn'); await adv(3); s = await ev(STATE); check(s['hidden'] and s['txt'] == '1배', f'1배로 돌아와도 그 웨이브엔 안 뜸 {s}')
        # 기지가 맞은 웨이브: 19초에 적 하나를 기지에 닿게 한다
        await next_wave(); await adv(19)
        await ev("() => { const S = Core.S; let e = S.enemies.find(o => !o.dead && !o.boss && !o.cr); if (!e) { Core.step(1 / 60); e = S.enemies.find(o => !o.dead && !o.boss && !o.cr); } e.y = Core.H; e.stunT = 0; e.hp = e.maxHp = 1e15; }   // 체력을 크게: 그 프레임에 먼저 맞아 쓰러지지 않게")
        await adv(2); s = await ev(STATE); lk = await ev("() => Core.S.lkW - Core.S.wave.t0")
        check(not s['shown'] and lk > 18, f'기지가 맞으면 안 뜸 (맞은 때 {lk:.1f}초) {s}')
        await adv(18); s = await until_shown(); why = await ev("() => { const S = Core.S, t0 = S.wave.t0; return { lk: +(S.lkW - t0).toFixed(1), n: (S.kl.length / 2) }; }")
        check(s['shown'], f'맞은 뒤 20초 지나면 뜸 {s} {why}')
        # 설정을 끄면 안 뜬다 (일시정지 -> 설정)
        await next_wave()
        await tap('#pauseBtn'); await tap('[data-act=opts]'); await shot('6_pause_opts', 200)
        await tap('.orow[data-opt=spdTip]'); await tap('[data-act=optsBack]'); await tap('[data-act=resume]')
        await adv(21); s = await ev(STATE); check(not s['shown'] and not s['core'] is None, f'설정을 끄면 안 뜸 (판정은 {s["core"]}) {s}')
        await tap('#pauseBtn'); await tap('[data-act=opts]'); await tap('.orow[data-opt=spdTip]'); await tap('[data-act=optsBack]'); await tap('[data-act=resume]')
        await adv(0.5); s = await ev(STATE); check(s['shown'] == s['core'], f'다시 켜면 판정대로 {s}')
        check(not errs, f'페이지 오류 {errs}')
        await b.close()
    print('FAILS', len(fails))

asyncio.run(main())

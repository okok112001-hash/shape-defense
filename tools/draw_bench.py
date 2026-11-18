"""전장 그리기 성능 벤치 (휴대폰 대신 CPU 4배 감속 + 소프트웨어 래스터로 잰다).
   고정된 장면(진화 블래스터·산탄포·레이저·펄스·블래스터, 무기마다 무거운 두 줄을 20점으로, 적 20)에서
   한 프레임(게임 진행 + 그리기 + 래스터)에 걸리는 시간을 잰다. rAF 를 직접 돌리고 매 프레임 getImageData 로 그리기를 끝까지 밀어낸다.
   실행 (저장소 루트, 먼저 python build.py):
     git show HEAD:index.html > dist/before.html            # 비교 기준
     python tools/draw_bench.py paper dist/before.html none none none none
     python tools/draw_bench.py paper index.html none none none none
     python tools/draw_bench.py paper index.html none none drawFireStrip VX.glow   # 함수를 꺼 보며 범인 찾기
     DRAW_TEAM=mortar python tools/draw_bench.py paper index.html none none none   # 박격포 다섯 자루 (줄마다 무거운 조합, T5a)
     DRAW_TEAM=tesla python tools/draw_bench.py paper index.html none none none    # 전격기 다섯 자루 (같은 조합, T5b). rail, acid 도 같다 (T5c, T5d)
     DRAW_FLING=1 python tools/draw_bench.py paper index.html none none none     # 큰 한 방에 쓰러지는 적(fling) 40개를 늘 띄워 둔다 (T10c. 기준 html 은 fling 을 그리지 않아 그 비용이 빠진다)
     DRAW_TEAM=acid DRAW_RAIN=1 python tools/draw_bench.py paper index.html none none none   # 폭우가 그치면 0.5초 뒤 다시 내린다 (T10d. 고이는 웅덩이가 늘 있고, 마르는 묶음과 겹친다)
   읽는 법: 첫 측정은 준비(JIT, 스프라이트 생성) 때문에 늘 느리니 버리고, 나머지 평균을 기준과 비교한다. 잡음이 +-10% 쯤이다.
   알게 된 것: 이 환경에서는 넓이보다 drawImage 호출 수가 비용을 정한다(빛 번짐 한 장에 약 0.3ms). 큰 빛 번짐을 여러 장 겹치지 말 것."""
import asyncio, os, pathlib, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
INIT = '''
(() => {
  const q = []; window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  window.__ts = 1000;
  window.__tick = (n) => { for (let i = 0; i < n; i++) { window.__ts += 1000 / 60; const run = q.splice(0); for (const cb of run) cb(window.__ts); } };
})();
'''
FOE = '''() => { const S = Core.S; S.spawnAcc = -1e9; S.nextBoss = 1e9; S.enemies.length = 0; const H = Core.H;
  const add = (type, x, y) => { const d = Core.ENEMIES[type]; S.enemies.push({ type, lane: Math.max(0, Math.min(4, Math.floor(x / 100))), x, y, r: d.r, hp: 1e15, maxHp: 1e15, speed: 0, leak: d.leak, gold: 0, boss: false, born: S.t,
    slowT: 0, slowPct: 0, vulnT: 0, vulnPct: 0, burnT: 0, burnDps: 0, burnSt: null, stunT: 0, dead: false, flash: 0, fT: 0, fDps: 0, fSt: null, fcB: null, fcN: 0, fcT: 0, chT: -9 }); };
  for (let i = 0; i < 20; i++) add(i % 5 === 4 ? 'heavy' : 'basic', 50 + (i % 5) * 100 + ((i * 37) % 30 - 15), H - 60 - ((i * 53) % 9) * 38); }'''
async def main():
    theme = sys.argv[1] if len(sys.argv) > 1 else 'paper'; name = sys.argv[2] if len(sys.argv) > 2 else 'index.html'; sets = sys.argv[3:] or ['none']
    async with async_playwright() as p:
        b = await p.chromium.launch()
        c = await b.new_context(viewport={'width': 390, 'height': 700}, has_touch=True, is_mobile=True, device_scale_factor=2)
        await c.add_init_script(INIT)
        pg = await c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        src = (ROOT / name).read_text(encoding='utf-8')
        inj = '''window.__orig = {}; window.__flush = () => ctx.getImageData(0, 0, 1, 1);
window.__off = (names, off) => { for (const n of names) { try { if (off) { if (!window.__orig[n]) window.__orig[n] = eval(n); eval(n + ' = function () {}'); } else if (window.__orig[n]) eval(n + ' = window.__orig[n]'); } catch (e) { console.log(e); } } };
window.__game = {'''
        i = src.rindex('window.__game = {'); src = src[:i] + inj + src[i + len('window.__game = {'):]
        (ROOT / 'dist' / '_prof.html').write_text(src, encoding='utf-8')
        await pg.goto((ROOT / 'dist' / '_prof.html').as_uri()); await pg.wait_for_timeout(500)
        await pg.evaluate('(t) => { localStorage.setItem("shape-defense-theme", t); localStorage.removeItem("shape-defense-test"); }', theme)
        await pg.reload(); await pg.wait_for_timeout(500)
        await pg.locator('[data-act="testStart"]').first.tap(); await pg.wait_for_timeout(300)
        await pg.evaluate('window.__tick(3)')
        await pg.evaluate('''(team) => { const S = Core.S; S.cheat.god = true;
          const T = ['mortar', 'tesla', 'rail', 'acid'].includes(team) ? [team, team, team, team, team] : ['blaster','shotgun','laser','pulse','blaster'];
          T.forEach((t, k) => { const i = Core.test.give(t); Core.equipWeapon(i, k); });
          Core.test.evolveAll();
          const SK = { blaster: [[5,5,1],[0,0,0],[5,4,0]], shotgun: [[0,0,0],[5,4,0],[5,5,1]], laser: [[5,5,1],[0,0,0],[5,4,0]], pulse: [[0,0,0],[5,5,1],[5,4,0]] };
          const MK = [[[5,5,1],[5,4,0],[0,0,0]], [[0,0,0],[5,5,1],[5,4,0]], [[5,4,0],[0,0,0],[5,5,1]], [[5,5,1],[0,0,0],[5,4,0]], [[0,0,0],[5,4,0],[5,5,1]]];
          S.slots.forEach((w, k) => { w.skp = 20; w.sk = (['mortar', 'tesla', 'rail', 'acid'].includes(w.type) ? MK[k] : SK[w.type]).map(r => r.slice()); Core.dirty(w); });
          S.slotDirty = true; S.invDirty = true; }''', os.environ.get('DRAW_TEAM', ''))
        await pg.evaluate(FOE)
        if os.environ.get('DRAW_FLING'):
            await pg.evaluate('''() => { const o = Core.step, K = ['nova', 'nuke', 'dragon', 'ball', 'rain', 'giant', 'slug', 'air'], T = ['basic', 'runner', 'swarm', 'heavy']; let j = 0;
              Core.step = (dt) => { o(dt); const S = Core.S; let n = 0; for (const f of S.fx) if (f.k === 'fling') n++;
                for (; n < 40; n++, j++) S.fx.push({ k: 'fling', d: 0.8, t: 0.8 * ((j * 0.37) % 1), x: 40 + (j * 83) % 420, y: 120 + (j * 151) % 480, r: 19, ty: T[j % 4], ax: Math.cos(j), ay: -Math.abs(Math.sin(j)), b: K[j % 8] }); }; }''')
        if os.environ.get('DRAW_RAIN'):
            await pg.evaluate('''() => { const o = Core.step;
              Core.step = (dt) => { o(dt); const S = Core.S;
                for (const w of S.slots) if (w && Core.stats(w).rain2 && !S.pools.some(p => p.kind === 'rain' && p.wk === w)) w.rn = Math.min(w.rn == null ? 9 : w.rn, 0.5); }; }''')
        cdp = await c.new_cdp_session(pg)
        await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        await pg.evaluate('() => { for (let i = 0; i < 240; i++) { window.__tick(1); window.__flush(); } }')
        for st in sets:
            names = [] if st == 'none' else st.split(',')
            await pg.evaluate('(n) => window.__off(n, true)', names)
            r = await pg.evaluate('''() => { for (let i = 0; i < 30; i++) { window.__tick(1); window.__flush(); }
              const d = []; for (let i = 0; i < 240; i++) { const t0 = performance.now(); window.__tick(1); window.__flush(); d.push(performance.now() - t0); }
              d.sort((a, b) => a - b); const S = Core.S;
              return { avg: d.reduce((a, b) => a + b, 0) / d.length, p95: d[Math.floor(d.length * 0.95)], bul: S.bullets.length, fx: S.fx.length, mines: S.mines.length }; }''')
            await pg.evaluate('(n) => window.__off(n, false)', names)
            print('%-6s %-16s %-40s avg %5.1f ms  p95 %5.1f  (bullets %d fx %d mines %d)' % (theme, name, st, r['avg'], r['p95'], r['bul'], r['fx'], r['mines']))
        if errs: print('errs', errs[:2])
        await b.close()
asyncio.run(main())

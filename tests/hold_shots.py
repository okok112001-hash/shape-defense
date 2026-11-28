"""꾹 누르기 연속 (T14c) 검사와 캡처.
   검사: 짧게 누르면 한 번, 꾹 누르면 반복(0.35초 뒤 초당 4번, 1.5초 뒤 초당 10번), 손을 뗀 뒤 한 번 더 실행되지 않음,
   멈춤 조건(재화 부족, 인벤토리 가득, 조각 부족, 증강 창은 손을 뗀 뒤에 뜨고 그 누름으로 카드가 골라지지 않음), 누르는 동안 버튼이 그대로(다시 만들지 않음),
   합친 알림 한 줄, 3초 안에 6번 두드리면 손가락 시범(누르면 사라짐, 같은 정비에 두 번은 안 뜸, 꾹 누르기를 한 번 하면 새로 고침 뒤에도 안 뜸),
   손가락이 화면 안, 끝나면 요소가 남지 않음, 페이지 오류 0.
   캡처: 0.1배로 늦춰 0.1초 간격 (생성 꾹 누르기·짧게 누르기, 손가락 시범, 대장간 강화 꾹 누르기), 버튼 주변만 잘라 한 장에.
   실행 (저장소 루트, 먼저 python build.py): python tests/hold_shots.py [테마들 쉼표로, 기본 paper,navy] [rm] [가로x세로] [noshots]
   결과: dist/hold/sheet_<장면>_<테마>[_rm]_<가로>.png, 실패하면 FAIL 줄과 종료 코드 1"""
import asyncio, os, sys, pathlib
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'hold')
THS = (sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else 'paper,navy').split(',')
RM = 'rm' in sys.argv[2:]
SHOTS = 'noshots' not in sys.argv[2:]
CHECKS = "nochecks" not in sys.argv[2:]
VW, VH = next(([int(v) for v in a.split('x')] for a in sys.argv[2:] if 'x' in a), (390, 760))
SLOW = 0.1
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)

async def setup(b, TH, rm, fresh=True):
    c = await b.new_context(viewport={'width': VW, 'height': VH}, device_scale_factor=1, has_touch=True, is_mobile=True,
                            reduced_motion='reduce' if rm else 'no-preference')
    await c.add_init_script(f"localStorage.setItem('shape-defense-theme','{TH}')")
    pg = await c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await start(pg)
    return c, pg, errs

async def start(pg):
    await pg.goto(pathlib.Path(ROOT, 'index.html').as_uri()); await pg.wait_for_timeout(600)
    await pg.click('text=테스트 모드'); await pg.wait_for_timeout(500)
    # 정비로: 적을 다 나오게 하고 지운다. 재화·조각 넉넉히, 강화 100%
    await pg.evaluate("""(()=>{const S=Core.S,wv=S.wave;S.cheat.god=true;S.cheat.succ=true;S.cheat.gold=false;S.cheat.shards=false;S.wt=wv.t0+Core.PREP.spawnT;wv.bq=[];S.pendingBoss=null;S.enemies=[];
      S.gold=1e9;S.shards=1e6;})()""")
    await pg.wait_for_timeout(2600)
    await pg.tap('#fieldWrap', position={'x': 30, 'y': 30}); await pg.wait_for_timeout(300)

ST = """(()=>{const S=Core.S,w=S.slots[0],n=document.querySelector('.hkn');return {gen:S.gen,gold:S.gold,free:S.inv.filter(x=>!x).length,lv:w.lv,blv:S.base.lv,
  aug:!!S.pendingAug,augWin:!!document.querySelector('[data-aug]'),augSel:!!document.querySelector('.aug.sel'),
  toast:document.getElementById('toast').textContent,wm:(document.getElementById('wmInfo')||{}).textContent||'',
  demo:!!document.querySelector('.hkdemo'),fx:document.querySelectorAll('.hkfx').length,cnt:n&&n.classList.contains('on')?n.textContent:'',
  key:localStorage.getItem('shape-defense-hold')}})()"""
CENTER = "(s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})"

async def down(cdp, x, y): await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
async def up(cdp): await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
async def press(pg, cdp, x, y, ms):
    await down(cdp, x, y); await pg.wait_for_timeout(ms); await up(cdp)

async def checks(b, TH):
    c, pg, errs = await setup(b, TH, RM)
    ev = pg.evaluate; cdp = await c.new_cdp_session(pg)
    st = lambda: ev(ST)
    gx, gy = await ev(CENTER + "('#genBtn')")
    # 1) 3초 안에 6번 두드리면 손가락 시범
    s0 = await st()
    for i in range(6):
        await press(pg, cdp, gx, gy, 60); await pg.wait_for_timeout(140)
    s = await st(); check(s['gen'] - s0['gen'] == 6, f'{TH} 짧게 6번: 생성 {s["gen"] - s0["gen"]}번 (6)')
    await pg.wait_for_timeout(700)
    s = await st(); check(s['demo'], f'{TH} 6번 두드리고 멈추면 손가락 시범')
    await pg.wait_for_timeout(500)
    ext = await ev("""(()=>{const a=document.getElementById('app').getBoundingClientRect(),f=document.querySelector('.hkfg svg');if(!f)return null;const r=f.getBoundingClientRect();
      return [r.left-a.left,a.right-r.right,r.top-a.top,a.bottom-r.bottom]})()""")
    check(ext is not None and min(ext) >= 0, f'{TH} 손가락이 화면 안 (왼 {ext and round(ext[0])}, 오른 {ext and round(ext[1])}, 위 {ext and round(ext[2])}, 아래 {ext and round(ext[3])})')
    g1 = (await st())['gen']
    await pg.tap('#fieldWrap', position={'x': 30, 'y': 30}); await pg.wait_for_timeout(300)
    s = await st(); check(not s['demo'] and s['gen'] == g1, f'{TH} 다른 곳을 누르면 시범이 사라짐, 실행은 안 됨 (demo {s["demo"]})')
    for i in range(6):
        await press(pg, cdp, gx, gy, 60); await pg.wait_for_timeout(140)
    await pg.wait_for_timeout(900)
    check(not (await st())['demo'], f'{TH} 같은 정비에서는 시범이 다시 안 뜸')
    await pg.wait_for_timeout(1500)
    # 2) 꾹 누르기 2초: 0.35 0.6 0.85 1.1 1.35 1.6 1.85 1.95 → 8번
    s0 = await st()
    await down(cdp, gx, gy); await pg.wait_for_timeout(1900)
    sm = await st()
    await pg.wait_for_timeout(100); await up(cdp); await pg.wait_for_timeout(250)
    s = await st(); n = s['gen'] - s0['gen']
    check(7 <= n <= 9 or ('전설' in s['toast'] and n >= 5), f'{TH} 꾹 2초: 생성 {n}번 (8 근처, 전설이면 0.6초 멈춤) {s["toast"]}')
    check(sm['cnt'].startswith('×') and int(sm['cnt'][1:]) >= 6, f'{TH} 반복 중 귀퉁이 횟수 {sm["cnt"]}')
    check(f'생성 {n}번' in s['toast'], f'{TH} 합친 알림: {s["toast"]}')
    check(s['key'] == '1', f'{TH} 꾹 누르기를 하면 저장 ({s["key"]})')
    await pg.wait_for_timeout(600)
    check((await st())['gen'] == s['gen'], f'{TH} 손을 뗀 뒤 한 번 더 실행되지 않음')
    # 누르는 동안 버튼을 다시 만들지 않는다 (표시를 단 버튼이 그대로)
    await ev("document.getElementById('genBtn').__tag=7")
    await down(cdp, gx, gy); await pg.wait_for_timeout(900)
    tag = await ev("document.getElementById('genBtn').__tag")
    await up(cdp); await pg.wait_for_timeout(300)
    check(tag == 7, f'{TH} 누르는 동안 생성 버튼이 그대로 ({tag})')
    # 3) 짧게 누르면 한 번
    s0 = await st(); await press(pg, cdp, gx, gy, 120); await pg.wait_for_timeout(300)
    check((await st())['gen'] - s0['gen'] == 1, f'{TH} 짧게 누르면 한 번')
    await pg.wait_for_timeout(1200)
    check((await st())['fx'] == 0, f'{TH} 빛이 빠지면 요소가 남지 않음')
    # 4) 재화 부족: 두 번만 할 수 있는 재화
    await ev("(()=>{const S=Core.S;S.gold=Core.genCost()*2.4})()"); await pg.wait_for_timeout(200)
    s0 = await st(); await down(cdp, gx, gy); await pg.wait_for_timeout(1500)
    s1 = await st(); await up(cdp); await pg.wait_for_timeout(300); s = await st()
    check(s1['gen'] - s0['gen'] == 2 and s['gen'] == s1['gen'], f'{TH} 재화 부족에서 멈춤: {s1["gen"] - s0["gen"]}번, 뗀 뒤 {s["gen"] - s1["gen"]}')
    check('재화 부족' in s['toast'], f'{TH} 멈춘 까닭: {s["toast"]}')
    # 5) 빠르기(1.5초 뒤 초당 10번)와 인벤토리 가득: 빈 칸 여덟을 남기고, 3초쯤 다음 생성이 남은 칸을 모두 채우게 한다 (운에 맡기지 않게)
    await ev("""(()=>{const S=Core.S;S.gold=1e9;let k=0;while(S.inv.filter(x=>!x).length>8&&k++<500)Core.generate();S.invDirty=true;
      const g=Core.generate;Core.generate=function(){const r=g.apply(this,arguments);if(window.__full){for(let i;(i=S.inv.indexOf(null))>=0;)S.inv[i]={kind:'p',id:S.inv.find(Boolean).id,g:0};window.__full=0;}return r;};})()""")
    await pg.wait_for_timeout(300)
    await down(cdp, gx, gy); await pg.wait_for_timeout(2000); a = (await st())['gen']
    await pg.wait_for_timeout(1000); r = (await st())['gen'] - a
    check(7 <= r <= 12, f'{TH} 1.5초 뒤 빠르기: 1초에 {r}번 (10)')
    await ev("window.__full=1"); await pg.wait_for_timeout(500)
    s1 = await st(); await pg.wait_for_timeout(500); s2 = await st(); await up(cdp); await pg.wait_for_timeout(300); s = await st()
    check(s1['free'] == 0 and s2['gen'] == s1['gen'] and s['gen'] == s1['gen'], f'{TH} 인벤토리가 차면 멈춤 (빈 칸 {s1["free"]}, 더 {s2["gen"] - s1["gen"]}, 뗀 뒤 {s["gen"] - s1["gen"]})')
    check('인벤토리 가득' in s['toast'], f'{TH} 멈춘 까닭: {s["toast"]}')
    await ev("(()=>{const S=Core.S;S.inv=S.inv.map(()=>null);S.invDirty=true;})()"); await pg.wait_for_timeout(300)
    # 6) 대장간 무기 강화
    await pg.tap('#forgeBtn'); await pg.wait_for_timeout(350)
    if await ev("document.querySelector('.fg-chip.on') && document.querySelector('.fg-chip.on').dataset.fw") != '0':
        await pg.tap('[data-fw="0"]'); await pg.wait_for_timeout(250)
    await ev("(()=>{const w=Core.S.slots[0];w.lv=6;w.hi=Math.max(w.hi||0,6);Core.dirty&&Core.dirty(w);})()")
    await pg.tap('[data-fw="1"]'); await pg.wait_for_timeout(200); await pg.tap('[data-fw="0"]'); await pg.wait_for_timeout(250)   # 다시 그리기
    ux, uy = await ev(CENTER + "('[data-hold=wup]')")
    await ev("document.querySelector('[data-hold=wup]').__tag=5")
    await down(cdp, ux, uy); await pg.wait_for_timeout(950)
    tag = await ev("document.querySelector('[data-hold=wup]').__tag")
    await up(cdp); await pg.wait_for_timeout(300); s = await st()
    check(s['lv'] == 9, f'{TH} 강화 꾹 0.95초: 6 → {s["lv"]} (9)')
    check(tag == 5, f'{TH} 누르는 동안 강화 버튼이 그대로 ({tag})')
    check('강화 3번: +3' in s['wm'], f'{TH} 대장간 알림: {s["wm"]}')
    # 짧게 누르면 한 번 (11 → 12)
    await ev("(()=>{Core.S.slots[0].lv=11;})()")
    await pg.tap('[data-fw="1"]'); await pg.wait_for_timeout(200); await pg.tap('[data-fw="0"]'); await pg.wait_for_timeout(250)
    await press(pg, cdp, ux, uy, 100); await pg.wait_for_timeout(300)
    check((await st())['lv'] == 12, f'{TH} 강화 짧게: +1')
    # 조각 부족: 13, 14 만
    await ev("(()=>{const S=Core.S,w=S.slots[0];const a=Core.upgradeInfo(w).cost;w.lv=13;const b=Core.upgradeInfo(w).cost;w.lv=12;S.shards=a+b+3;})()")
    await pg.tap('[data-fw="1"]'); await pg.wait_for_timeout(200); await pg.tap('[data-fw="0"]'); await pg.wait_for_timeout(250)
    await down(cdp, ux, uy); await pg.wait_for_timeout(1300); s1 = await st(); await up(cdp); await pg.wait_for_timeout(300); s = await st()
    check(s1['lv'] == 14 and s['lv'] == 14, f'{TH} 조각 부족에서 멈춤: {s1["lv"]} (14)')
    check('조각 부족' in s['wm'], f'{TH} 멈춘 까닭: {s["wm"]}')
    # 증강 창: 13 → 14, 15(증강) 에서 멈추고, 창은 손을 뗀 뒤에, 그 누름으로 카드가 골라지지 않음
    await ev("(()=>{const S=Core.S,w=S.slots[0];S.shards=1e6;w.lv=13;})()")
    await pg.tap('[data-fw="1"]'); await pg.wait_for_timeout(200); await pg.tap('[data-fw="0"]'); await pg.wait_for_timeout(250)
    await down(cdp, ux, uy); await pg.wait_for_timeout(1400); s1 = await st()
    await up(cdp); await pg.wait_for_timeout(400); s = await st()
    check(s1['lv'] == 15 and s1['aug'] and not s1['augWin'], f'{TH} 증강에서 멈춤, 누르는 동안 창 안 뜸 (lv {s1["lv"]}, 창 {s1["augWin"]})')
    check(s['augWin'] and not s['augSel'], f'{TH} 손을 떼면 증강 창, 카드가 골라지지 않음 (창 {s["augWin"]}, 고름 {s["augSel"]})')
    await pg.wait_for_timeout(500)
    check(not errs, f'{TH} 페이지 오류 {errs[:3]}')
    await c.close()
    # 7) 새로 고침 뒤: 꾹 누르기를 해 본 사람에게는 시범이 안 뜬다 (같은 저장소)
    c, pg, errs = await setup(b, TH, RM)
    ev = pg.evaluate; cdp = await c.new_cdp_session(pg)
    await ev("localStorage.setItem('shape-defense-hold','1')"); await start(pg)
    gx, gy = await ev(CENTER + "('#genBtn')")
    for i in range(7):
        await press(pg, cdp, gx, gy, 60); await pg.wait_for_timeout(140)
    await pg.wait_for_timeout(900)
    check(not (await ev(ST))['demo'], f'{TH} 꾹 누르기를 해 본 뒤에는 시범이 안 뜸')
    # 진화한 무기: 스킬 포인트(5강)에서 멈추고, 손을 뗀 뒤 연출 다음에 스킬 창, 그 누름으로 찍히지 않음 (T14a)
    await ev("""(()=>{const S=Core.S,w=S.slots[0];S.shards=1e6;w.evo=true;w.sk=[[0,0,0],[0,0,0],[0,0,0]];w.lv=3;w.hi=3;w.skp=0;Core.dirty(w);S.slotDirty=true;})()""")
    await pg.tap('#forgeBtn'); await pg.wait_for_timeout(350)
    await pg.tap('[data-fw="1"]'); await pg.wait_for_timeout(200); await pg.tap('[data-fw="0"]'); await pg.wait_for_timeout(250)
    ux, uy = await ev(CENTER + "('[data-hold=wup]')")
    SK = "(()=>{const w=Core.S.slots[0];return {lv:w.lv,spent:w.sk.flat().reduce((a,b)=>a+b,0),sk:!!document.querySelector('.modal.skm')}})()"
    await down(cdp, ux, uy); await pg.wait_for_timeout(1500); k1 = await ev(SK)
    await up(cdp); await pg.wait_for_timeout(1000); k2 = await ev(SK)
    check(k1['lv'] == 5 and not k1['sk'], f'{TH} 스킬 포인트에서 멈춤, 누르는 동안 창 안 뜸 ({k1})')
    check(k2['sk'] and k2['spent'] == 0, f'{TH} 손을 떼면 스킬 창, 찍히지 않음 ({k2})')
    await ev("(()=>{const w=Core.S.slots[0];w.evo=false;w.lv=3;Core.dirty(w);})()")
    await pg.tap('[data-act=skClose]') if await ev("!!document.querySelector('[data-act=skClose]')") else None
    await pg.wait_for_timeout(500)
    if await ev("!!document.querySelector('[data-act=wclose]')"): await pg.tap('[data-act=wclose]'); await pg.wait_for_timeout(300)
    # 기지 강화 꾹
    await pg.tap('#forgeBtn'); await pg.wait_for_timeout(350); await pg.tap('[data-ft=b]'); await pg.wait_for_timeout(300)
    b0 = (await ev(ST))['blv']; bx, by = await ev(CENTER + "('[data-hold=bup]')")
    await down(cdp, bx, by); await pg.wait_for_timeout(700); await up(cdp); await pg.wait_for_timeout(300)
    b1 = (await ev(ST))['blv']
    check(b1 - b0 == 2 or (b1 % 5 == 0 and b1 > b0), f'{TH} 기지 강화 꾹 0.7초: +{b1 - b0}')
    check(not errs, f'{TH} 페이지 오류(새로 고침 뒤) {errs[:3]}')
    await c.close()

SLOWJS = f"""(()=>{{const o=performance.now.bind(performance),b=o();performance.now=()=>b+(o()-b)*{SLOW};
  const st=window.setTimeout;window.setTimeout=(f,d,...a)=>st(f,(d||0)/{SLOW},...a);}})()"""
async def film(pg, ev, name, TH, box, plan):
    """plan: [(시각 초, 할 일 또는 None)], 시각마다 찍는다"""
    t0 = await ev("performance.now()"); frames = []
    for t, f in plan:
        await pg.wait_for_function(f"performance.now()-{t0}>={t*1000}", polling=5)
        if f: await f()
        el = await ev(f"performance.now()-{t0}")
        p = os.path.join(OUT, f'{name}_{TH}{"_rm" if RM else ""}_{VW}_{int(round(t*100)):03d}.png'); await pg.screenshot(path=p)
        frames.append((p, el / 1000))
    x, y, w, h = [int(v) for v in box]
    x = max(0, x); y = max(0, y)
    cols = 6; rows = (len(frames) + cols - 1) // cols; k = min(1.0, 300 / w); fw, fh = int(w * k), int(h * k)
    sheet = Image.new('RGB', (cols * fw, rows * (fh + 16)), 'white'); d = ImageDraw.Draw(sheet)
    for i, (p, el) in enumerate(frames):
        im = Image.open(p).convert('RGB'); px = (i % cols) * fw; py = (i // cols) * (fh + 16)
        sheet.paste(im.crop((x, y, x + w, y + h)).resize((fw, fh)), (px, py + 16)); d.text((px + 4, py + 2), f'{el:.2f}s', fill='black')
        os.remove(p)
    sp = os.path.join(OUT, f'sheet_{name}_{TH}{"_rm" if RM else ""}_{VW}.png'); sheet.save(sp); print(sp)

async def shots(b, TH):
    c, pg, errs = await setup(b, TH, RM)
    ev = pg.evaluate; cdp = await c.new_cdp_session(pg)
    gx, gy = await ev(CENTER + "('#genBtn')")
    gb = await ev("(()=>{const r=document.getElementById('genBtn').getBoundingClientRect();return [r.x-10,r.y-110,r.width+20,r.height+122]})()")
    # 손가락 시범 (실제 시간으로 두드린 뒤 늦춘다)
    for i in range(6):
        await press(pg, cdp, gx, gy, 60); await pg.wait_for_timeout(140)
    await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', {'playbackRate': SLOW})
    await ev(SLOWJS)
    await film(pg, ev, 'demo', TH, gb, [(0.06 + 0.15 * i, None) for i in range(24)])
    await pg.wait_for_timeout(3000)
    # 생성: 꾹 누르기 (0.1배: 0.35초 = 실제 3.5초)
    async def dn(): await down(cdp, gx, gy)
    async def upp(): await up(cdp)
    plan = [(0.0, dn)] + [(0.05 + 0.05 * i, None) for i in range(1, 8)] + [(0.45 + 0.1 * i, None) for i in range(17)]
    plan[-6] = (plan[-6][0], upp)
    await film(pg, ev, 'gen', TH, gb, plan + [(2.3 + 0.08 * i, None) for i in range(5)])
    await pg.wait_for_timeout(2000)
    # 짧게 누르기: 0.15초 누르고 뗀다 (빛이 차다 말고 빠짐)
    plan = [(0.0, dn), (0.05, None), (0.1, None), (0.15, upp)] + [(0.15 + 0.06 * i, None) for i in range(1, 9)]
    await film(pg, ev, 'tap', TH, gb, plan)
    await c.close()
    # 대장간 강화 꾹 누르기
    c, pg, errs2 = await setup(b, TH, RM)
    ev = pg.evaluate; cdp = await c.new_cdp_session(pg)
    await ev("localStorage.setItem('shape-defense-hold','1')")
    await pg.tap('#forgeBtn'); await pg.wait_for_timeout(350)
    await ev("(()=>{const w=Core.S.slots[0];w.lv=21;})()")
    await pg.tap('[data-fw="1"]'); await pg.wait_for_timeout(200); await pg.tap('[data-fw="0"]'); await pg.wait_for_timeout(250)
    ux, uy = await ev(CENTER + "('[data-hold=wup]')")
    ub = await ev("(()=>{const m=document.querySelector('.modal.fg').getBoundingClientRect(),r=document.querySelector('[data-hold=wup]').getBoundingClientRect();return [m.x,r.y-150,m.width,r.height+170]})()")
    await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', {'playbackRate': SLOW})
    await ev(SLOWJS)
    async def dn2(): await down(cdp, ux, uy)
    async def up2(): await up(cdp)
    plan = [(0.0, dn2)] + [(0.1 * i, None) for i in range(1, 4)] + [(0.36 + 0.12 * i, None) for i in range(14)]
    plan[-4] = (plan[-4][0], up2)
    await film(pg, ev, 'up', TH, ub, plan)
    print(TH, 'errors', len(errs) + len(errs2), (errs + errs2)[:3])
    await c.close()

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for TH in THS:
            if CHECKS: await checks(b, TH)
            if SHOTS: await shots(b, TH)
        await b.close()
    print('FAILS', len(fails))
    sys.exit(1 if fails else 0)
asyncio.run(main())

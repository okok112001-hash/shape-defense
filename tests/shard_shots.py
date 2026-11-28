"""생성으로 강화 조각을 얻을 때 생성 버튼 근처 연출 (T14b) 검사와 캡처.
   검사: 한 번 누르면 조각 묶음 하나(조각 3~4개)와 +N 하나, 0.6초 안에 또 받으면 새 숫자 없이 합친 숫자, 연타 10번에 묶음은 3개·숫자는 1개까지,
   끝나면 요소가 남지 않음, 조각·숫자가 화면 밖으로 나가지 않음, 움직임 줄이기면 조각 없이 숫자만 제자리에서 흐려짐, 페이지 오류 0.
   캡처: 연출을 0.1배로 늦춰 0.1초 간격으로 찍고, 연타로 합친 숫자도 찍어 한 장에 모은다 (생성 버튼 주변만 잘라서).
   실행 (저장소 루트, 먼저 python build.py): python tests/shard_shots.py [테마들 쉼표로, 기본 paper,navy,sky] [rm] [가로x세로]
   결과: dist/shard/sheet_<테마>[_rm]_<가로>.png, 실패하면 FAIL 줄과 종료 코드 1"""
import asyncio, os, sys, pathlib
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'shard')
THS = (sys.argv[1] if len(sys.argv) > 1 else 'paper,navy,sky').split(',')
RM = 'rm' in sys.argv[2:]
VW, VH = next(([int(v) for v in a.split('x')] for a in sys.argv[2:] if 'x' in a), (390, 760))
SLOW = 0.1
TIMES = [0.05] + [0.1 * i for i in range(1, 10)]
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)

async def setup(b, TH, rm, dsf=1):
    c = await b.new_context(viewport={'width': VW, 'height': VH}, device_scale_factor=dsf, has_touch=True, is_mobile=True,
                            reduced_motion='reduce' if rm else 'no-preference')
    await c.add_init_script(f"localStorage.setItem('shape-defense-theme','{TH}')")
    pg = await c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.goto(pathlib.Path(ROOT, 'index.html').as_uri()); await pg.wait_for_timeout(600)
    await pg.click('text=테스트 모드'); await pg.wait_for_timeout(500)
    # 정비로: 적을 다 나오게 하고 지운다. 재화 넉넉히, 용광로의 축복(파츠 대신 조각)으로 생성이 늘 조각이 되게
    await pg.evaluate("""(()=>{const S=Core.S,wv=S.wave;S.cheat.god=true;S.wt=wv.t0+Core.PREP.spawnT;wv.bq=[];S.pendingBoss=null;S.enemies=[];S.gold=1e9;
      S.pacts=(S.pacts||[]).concat(['forge']);})()""")
    await pg.wait_for_timeout(2600)
    await pg.tap('#fieldWrap', position={'x': 30, 'y': 30}); await pg.wait_for_timeout(300)
    return c, pg, errs

CNT = """(()=>{const L=document.getElementById('fxLayer'),n=L.querySelector('.shnum');
  return {fx:L.querySelectorAll('.shfx').length,sp:L.querySelectorAll('.shfx .sp').length,num:L.querySelectorAll('.shnum').length,all:L.children.length,
    txt:n?n.textContent:'',sh:Core.S.shards}})()"""
async def checks(b, TH):
    c, pg, errs = await setup(b, TH, RM)
    ev = pg.evaluate
    bx = await ev("(()=>{const r=document.getElementById('genBtn').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
    # 1) 한 번
    s0 = (await ev(CNT))['sh']
    await pg.touchscreen.tap(*bx); await pg.wait_for_timeout(60)
    s = await ev(CNT)
    if RM: check(s['fx'] == 0 and s['num'] == 1 and s['txt'] == f"+{s['sh'] - s0}", f'{TH} 움직임 줄이기: 조각 없이 숫자만 {s}')
    else: check(s['fx'] == 1 and s['sp'] in (3, 4) and s['num'] == 1 and s['txt'] == f"+{s['sh'] - s0}", f'{TH} 한 번: 묶음 1, 조각 3~4, 숫자 {s}')
    # 화면 밖으로 나가지 않는지 (가장 멀리 간 즈음), 움직임 줄이기면 숫자가 제자리
    await pg.wait_for_timeout(300)
    ext = await ev("""(()=>{const a=document.getElementById('app').getBoundingClientRect();let l=1e9,r=-1e9,t=1e9;
      document.querySelectorAll('#fxLayer .shfx .sp u, #fxLayer .shnum b').forEach(e=>{const b=e.getBoundingClientRect();l=Math.min(l,b.left-a.left);r=Math.max(r,b.right-a.left);t=Math.min(t,b.top-a.top)});
      const n=document.querySelector('#fxLayer .shnum');return [l,a.width-r,t,n?new DOMMatrixReadOnly(getComputedStyle(n).transform).m42:null]})()""")
    check(ext[0] >= 0 and ext[1] >= 0 and ext[2] >= 0, f'{TH} 조각·숫자가 화면 안 (왼쪽 여유 {ext[0]:.0f}px, 오른쪽 {ext[1]:.0f}px, 위 {ext[2]:.0f}px)')
    if RM:
        await pg.wait_for_timeout(150)
        y2 = await ev("new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#fxLayer .shnum')).transform).m42")
        check(abs(ext[3] - y2) < 0.01, f'{TH} 움직임 줄이기: 숫자가 움직이지 않음 (y {ext[3]} -> {y2})')
    await pg.wait_for_timeout(650 if RM else 800)
    s = await ev(CNT); check(s['fx'] == 0 and s['num'] == 0, f'{TH} 끝나면 남지 않음 {s}')
    # 2) 0.6초가 지나 받으면 새 숫자
    await pg.touchscreen.tap(*bx); await pg.wait_for_timeout(700)
    s1 = (await ev(CNT))['sh']
    await pg.touchscreen.tap(*bx); await pg.wait_for_timeout(60)
    s = await ev(CNT); check(s['num'] == 1 and s['txt'] == f"+{s['sh'] - s1}", f'{TH} 0.7초 뒤: 새 숫자 {s["txt"]} (이번 +{s["sh"] - s1})')
    await pg.wait_for_timeout(1000)
    # 3) 연타 10번: 합친 숫자 하나, 묶음 3개까지
    s0 = (await ev(CNT))['sh']; mx = {'fx': 0, 'num': 0, 'all': 0}
    for i in range(10):
        await pg.touchscreen.tap(*bx); await pg.wait_for_timeout(70)
        s = await ev(CNT)
        for k in mx: mx[k] = max(mx[k], s[k])
    check(mx['fx'] <= (0 if RM else 3) and mx['num'] == 1 and mx['all'] <= 8, f'{TH} 연타 10번: 최대 묶음 {mx["fx"]}, 숫자 {mx["num"]}, 층 요소 {mx["all"]}')
    check(s['txt'] == f"+{s['sh'] - s0}", f'{TH} 연타 10번: 숫자 {s["txt"]} = 받은 조각 합 +{s["sh"] - s0}')
    await pg.wait_for_timeout(1200)
    s = await ev(CNT); check(s['all'] == 0, f'{TH} 연타 뒤 남지 않음 {s}')
    check(not errs, f'{TH} 페이지 오류 {errs[:3]}')
    await c.close()

async def shots(b, TH):
    c, pg, errs = await setup(b, TH, RM, 2)
    ev = pg.evaluate
    box = await ev("(()=>{const b=document.getElementById('genBtn').getBoundingClientRect();return [b.x,b.y,b.width,b.height]})()")
    bx = [box[0] + box[2] / 2, box[1] + box[3] / 2]
    cdp = await c.new_cdp_session(pg)
    await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', {'playbackRate': SLOW})
    await ev(f"""(()=>{{const o=performance.now.bind(performance),b=o();performance.now=()=>b+(o()-b)*{SLOW};
      const st=window.setTimeout;window.setTimeout=(f,d,...a)=>st(f,(d||0)/{SLOW},...a);}})()""")
    await pg.touchscreen.tap(*bx); t0 = await ev("performance.now()")
    frames = []
    for t in TIMES:
        await pg.wait_for_function(f"performance.now()-{t0}>={t*1000}", polling=5)
        el = await ev(f"performance.now()-{t0}")
        f = os.path.join(OUT, f'{TH}{"_rm" if RM else ""}_{VW}_{int(t*100):03d}.png'); await pg.screenshot(path=f)
        frames.append((f, f'{el / 1000:.2f}s'))
    await cdp.send('Animation.setPlaybackRate', {'playbackRate': 1})
    await pg.reload(); await c.close()
    # 연타로 합친 숫자 (보통 속도)
    c, pg, errs2 = await setup(b, TH, RM, 2)
    for i in range(4):
        await pg.touchscreen.tap(*bx); await pg.wait_for_timeout(110)
    f = os.path.join(OUT, f'{TH}{"_rm" if RM else ""}_{VW}_merge.png'); await pg.screenshot(path=f); frames.append((f, '4x'))
    print(TH, 'errors', len(errs) + len(errs2), (errs + errs2)[:3])
    await c.close()
    x, y, w, h = int(box[0]) - 6, int(box[1]) - 96, int(box[2] * 0.75), int(box[3]) + 102
    x = max(0, x); y = max(0, y)
    cols = 6; rows = (len(frames) + cols - 1) // cols; fw, fh = w * 2, h * 2
    sheet = Image.new('RGB', (cols * fw, rows * (fh + 18)), 'white'); d = ImageDraw.Draw(sheet)
    for i, (f, lab) in enumerate(frames):
        im = Image.open(f).convert('RGB'); px = (i % cols) * fw; py = (i // cols) * (fh + 18)
        sheet.paste(im.crop((x * 2, y * 2, (x + w) * 2, (y + h) * 2)), (px, py + 18)); d.text((px + 4, py + 3), lab, fill='black')
    sp = os.path.join(OUT, f'sheet_{TH}{"_rm" if RM else ""}_{VW}.png'); sheet.save(sp); print(sp)

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for TH in THS:
            await checks(b, TH)
            await shots(b, TH)
        await b.close()
    print('FAILS', len(fails))
    sys.exit(1 if fails else 0)
asyncio.run(main())

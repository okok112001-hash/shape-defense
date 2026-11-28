"""천칭 거래 (T15c 전투 거래, T15d 재화·보상 거래) 화면 검사와 캡처. 거래 제안 카드(긴 문구), 맺은 거래 보기(장기전·불굴·외길의 '지금' 줄),
   외길 대상 무기 칸 표시, 예열 중 무기 칸 꺼짐, 불굴의 강화 버튼 성공 확률.
   T15d: 이자·대출·보급 독점·행운의 동전 카드(대출 카드에 받을 재화), 이자 알림('웨이브 N 막음' 아래), 이자·대출 '지금' 줄, 보급 독점의 조각 보스 보상.
   실행 (저장소 루트, 먼저 python build.py): python tests/pact_shots.py [테마들 쉼표로, 기본 paper,navy]
   결과: dist/pact/<테마>_<번호>.png, 실패하면 FAIL 줄과 종료 코드 1"""
import asyncio, os, sys, pathlib
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'pact'); os.makedirs(OUT, exist_ok=True)
THS = (sys.argv[1] if len(sys.argv) > 1 else 'paper,navy').split(',')
VW, VH = 390, 760
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)

async def run(b, TH):
    c = await b.new_context(viewport={'width': VW, 'height': VH}, device_scale_factor=2, has_touch=True, is_mobile=True)
    await c.add_init_script(f"localStorage.setItem('shape-defense-theme','{TH}'); localStorage.setItem('shape-defense-mute','1');")
    pg = await c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.goto(pathlib.Path(ROOT, 'index.html').as_uri()); await pg.wait_for_timeout(600)
    await pg.click('text=테스트 모드'); await pg.wait_for_timeout(500)
    ev = pg.evaluate
    n = [0]
    async def shot(tag, clip=None):
        n[0] += 1; await pg.wait_for_timeout(400)
        await pg.screenshot(path=os.path.join(OUT, f'{TH}_{n[0]:02d}_{tag}.png'), clip=clip)
    await ev("(()=>{const S=Core.S;S.cheat.god=true;S.spawnAcc=-1e9;const st=Core.step;Core.step=function(dt){st(dt);if(window.__pp){Core.S.pendingPact=window.__pp;window.__pp=null;}};})()")   # 걸음 뒤에 거래를 걸어 화면이 창을 열게 한다
    # 1. 거래 제안: 문구가 긴 둘
    for pair in (['grit', 'brink'], ['long', 'path'], ['giant', 'warm'], ['interest', 'loan'], ['supply', 'coin']):
        await ev(f"(()=>{{window.__pp={pair};}})()"); await pg.wait_for_timeout(1500)
        await pg.tap('#overlay', position={'x': 10, 'y': 10}); await pg.wait_for_timeout(300)   # 등장 연출 건너뛰기
        cards = await ev("[...document.querySelectorAll('.pc')].map(e=>{const r=e.getBoundingClientRect();return [r.left,r.right,r.bottom,e.scrollHeight<=e.clientHeight+1]})")
        check(len(cards) == 2 and all(x[0] >= 0 and x[1] <= VW and x[3] for x in cards), f'{TH}: 카드 {pair} 화면 안, 넘침 없음 {cards}')
        if 'loan' in pair: check(await ev("[...document.querySelectorAll('.pc')].some(e=>e.textContent.includes('생성 50번') && e.textContent.includes('◆'))"), f'{TH}: 대출 카드에 받을 재화')
        await shot('offer_' + '_'.join(pair))
        await pg.tap('[data-act=pactSkip]'); await pg.wait_for_timeout(500); await pg.tap('[data-act=pactSkipOk]'); await pg.wait_for_timeout(400)
    # 2. 맺은 거래 보기: 상태 줄
    await ev("""(()=>{const S=Core.S;S.pacts=['glass','long','grit','path','brink','sweep','fat','warm'];S.longK=3;S.grit=2;
      S.slots.forEach((w,k)=>{w.lv=w.hi=10+k*3;Core.dirty(w);});Core.S.slotDirty=true;})()""")
    await pg.wait_for_timeout(600)
    await pg.tap('#pactMark'); await pg.wait_for_timeout(500)
    now = await ev("[...document.querySelectorAll('.pc-row.now span')].map(e=>e.textContent)")
    check(len(now) == 3 and '+3%p' not in now[0] and '-16%' in now[0] and '+6%p' in now[1] and '5번 칸' in now[2], f'{TH}: 지금 줄 {now}')
    await shot('view')
    await pg.evaluate("document.querySelector('.pv-list').scrollTop = 9999"); await shot('view_end')
    await pg.tap('[data-act=pactMarkClose]'); await pg.wait_for_timeout(400)
    # 3. 외길 대상 칸 표시, 예열 꺼짐: 웨이브 시작 직후로
    await ev("(()=>{const S=Core.S;S.wave.t0=S.wt-2;})()"); await pg.wait_for_timeout(500)
    st = await ev("[...document.querySelectorAll('#weapons .slot')].map(e=>[e.classList.contains('dormant'),!!e.querySelector('.pathic')])")
    check(all(x[0] for x in st) and [x[1] for x in st] == [False, False, False, False, True], f'{TH}: 예열 꺼짐, 외길 표시 5번 칸 {st}')
    y0 = await ev("document.getElementById('weapons').getBoundingClientRect().top") - 6
    await shot('slots_warm', {'x': 0, 'y': y0, 'width': VW, 'height': 130})
    await ev("(()=>{const S=Core.S;S.wave.t0=S.wt-20;})()"); await pg.wait_for_timeout(600)
    st = await ev("[...document.querySelectorAll('#weapons .slot')].map(e=>e.classList.contains('dormant'))")
    check(await ev("Core.S.warmOn") is False, f'{TH}: 15초 뒤 예열 끝 {st}')
    await shot('slots_on', {'x': 0, 'y': y0, 'width': VW, 'height': 130})
    # 4. T15d: 이자 알림, 지금 줄, 보급 독점 조각 보상
    await ev("""(()=>{const S=Core.S;S.pacts=['interest','loan','supply','coin'];S.loanG=12345;S.gold=1000;S.cheat.gold=false;
      S.wave.bq=[];S.pendingBoss=null;S.wt=S.wave.t0+Core.PREP.spawnT+1;S.enemies=[];})()""")
    await pg.wait_for_timeout(500)
    iv = await ev("Core.S.intr ? Core.S.intr.v : 0")
    check(iv == 100 and await ev("Core.S.prep.phase") == 'rest', f'{TH}: 이자 100 (1000의 10%, 웨이브 1 상한 137 아래) {iv}')
    await shot('interest', {'x': 0, 'y': 80, 'width': VW, 'height': 260})
    await pg.wait_for_timeout(1600)
    await pg.tap('#pactMark'); await pg.wait_for_timeout(500)
    now = await ev("[...document.querySelectorAll('.pc-row.now span')].map(e=>e.textContent)")
    check(len(now) == 2 and '100' in now[0] and '12345' in now[1], f'{TH}: 이자·대출 지금 줄 {now}')
    await shot('view_d')
    await pg.tap('[data-act=pactMarkClose]'); await pg.wait_for_timeout(400)
    await ev("(()=>{const S=Core.S;S.gT=0;Core.seed(7);const e=Core.spawn('giant',2);e.y=300;Core.kill(e);})()"); await pg.wait_for_timeout(500)
    rw = await ev("[...document.querySelectorAll('.rw-l')].map(e=>e.textContent)")
    check(any(x.startswith('조각 +') for x in rw) or any('보스 보상' in x for x in rw), f'{TH}: 보스 보상 표시 {rw}')
    await shot('supply_reward', {'x': 0, 'y': 120, 'width': VW, 'height': 360})
    if errs: check(False, f'{TH}: 페이지 오류 {errs[:3]}')
    await c.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for TH in THS: await run(b, TH)
        await b.close()
    print('FAIL', len(fails) if fails else 0)
    sys.exit(1 if fails else 0)
asyncio.run(main())

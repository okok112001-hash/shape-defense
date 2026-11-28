"""대장간 (T13e) 검사와 캡처. 정비 시간에 대장간을 열고 모든 기능을 한 번씩 실행한다:
   무기 탭(무기 바꾸기, 강화, 파츠 장착·해제, 장착 해제, 진화, 스킬), 기지 탭(강화, 기지 파츠 장착), 용해로 탭(고르기, 분해, 모두 분해, 제조),
   웨이브 중 잠금, 무기 두 번 누르기로 열기, 바깥 누르면 닫기, 다시 열면 마지막 탭.
   실행 (저장소 루트, 먼저 python build.py): python tests/forge_shots.py [테마들 쉼표로, 기본 paper,navy] [가로 세로]
   결과: dist/forge/shot_<테마>_<번호>.png, 실패하면 FAIL 줄과 종료 코드 1"""
import asyncio, os, sys, pathlib
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'forge')
THS = (sys.argv[1] if len(sys.argv) > 1 else 'paper,navy').split(',')
VW, VH = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (390, 760)
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)

async def run(b, TH, full):
    c = await b.new_context(viewport={'width': VW, 'height': VH}, device_scale_factor=1, has_touch=True, is_mobile=True)
    await c.add_init_script(f"localStorage.setItem('shape-defense-theme','{TH}')")
    pg = await c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.goto(pathlib.Path(ROOT, 'index.html').as_uri()); await pg.wait_for_timeout(600)
    await pg.click('text=테스트 모드'); await pg.wait_for_timeout(500)
    ev = pg.evaluate
    n = [0]
    async def shot(tag):
        n[0] += 1; await pg.wait_for_timeout(250)
        await pg.screenshot(path=os.path.join(OUT, f'shot_{TH}_{VW}_{n[0]:02d}_{tag}.png'))
    async def tap(sel_):
        await pg.tap(sel_); await pg.wait_for_timeout(180)
    async def pick_aug():   # 증강 창: 나타난 뒤 0.4초가 지나야 누를 수 있다
        await pg.wait_for_timeout(1100); await tap('[data-aug="0"]'); await pg.wait_for_timeout(450); await tap('[data-act=augOk]')
    has = lambda sel_: ev(f"!!document.querySelector({sel_!r})")
    # 웨이브 중: 대장간이 없고(판), 무기를 두 번 눌러도 안 열린다
    await ev("(()=>{const S=Core.S;S.cheat.god=true;})()")
    await tap('[data-slot="0"]'); await tap('[data-slot="0"]')
    check(not await has('.modal.fg'), '웨이브 중에는 무기를 두 번 눌러도 대장간이 안 열림')
    # 정비로: 적을 다 나오게 하고 지운다. 재화·조각, 파츠 몇 개
    await ev("""(()=>{const S=Core.S,wv=S.wave;S.wt=wv.t0+Core.PREP.spawnT;wv.bq=[];S.pendingBoss=null;S.enemies=[];S.gold=1e6;S.shards=20000;S.melt=40;
      const P=(id,g)=>({kind:'p',id,g});S.inv=Array(15).fill(null);[P('range',1),P('crit',2),P('shield',2),P('dmg',0),P('rate',0),Core.newWeapon('acid'),P('gold',0)].forEach((it,i)=>S.inv[i]=it);
      const w=S.slots[1];w.lv=99;w.hi=95;Core.dirty(w);const v=S.slots[2];v.lv=23;v.hi=20;Core.dirty(v);S.invDirty=true;S.slotDirty=true;})()""")
    await pg.wait_for_timeout(2600)
    await pg.tap('#fieldWrap', position={'x': 30, 'y': 30}); await pg.wait_for_timeout(200)   # 웨이브 때 고른 무기 칸 선택 풀기
    check(await ev("Core.S.prep.phase") == 'rest', '정비 시간')
    check(await has('#forgeBtn') and await has('#genBtn') and not await has('#upBtn') and not await has('[data-act=meltOn]') and not await has('.bbtn'),
          '아래 버튼은 생성과 대장간 둘 (강화·용해로·기지 버튼 없음)')
    if full: await shot('prep')
    # 대장간 열기: 첫 무기, 무기 탭
    await tap('#forgeBtn')
    check(await has('.modal.fg') and await ev("document.querySelector('.fg-tabs .on').dataset.ft") == 'w', '대장간 버튼: 무기 탭으로 열림')
    t = await ev("document.querySelector('.fg-up').innerText")
    check('보유 조각' in t and '필요' in t and '성공 확률' in t, '강화 버튼에 보유 조각·필요·성공 확률 ' + t.replace('\n', ' '))
    check(await ev("!!document.querySelector('.fg-tabs [data-ft=w] svg') && !!document.querySelector('.fg-tabs [data-ft=b] svg') && !!document.querySelector('.fg-tabs [data-ft=m] svg')"), '탭 세 개에 그림')
    check(not await ev("/게이지|조각 \\d/.test(document.querySelector('.fg-head').innerText)"), '머리에 조각·게이지 숫자 없음')
    await shot('w0')
    # 무기 바꾸기 → 99강 무기 강화 (100강) → 증강 고르기 창이 뜨면 고름
    await tap('[data-fw="1"]')
    check(await ev("document.querySelector('.fg-chip.on').dataset.fw") == '1', '무기 고르기 줄로 다른 무기')
    lv0 = await ev("Core.S.slots[1].lv"); sh0 = await ev("Core.S.shards")
    await ev("Core.S.cheat.succ=true")
    await tap('[data-act=wup]')
    check(await ev("Core.S.slots[1].lv") == lv0 + 1 and await ev("Core.S.shards") < sh0, f'강화 {lv0} -> {await ev("Core.S.slots[1].lv")}, 조각 줄어듦')
    if await ev("!!Core.S.pendingAug"):
        await pick_aug()
        check(not await ev("!!Core.S.pendingAug") and await has('.modal.fg'), '증강을 고르고 대장간으로 돌아옴')
    check(await ev("document.querySelector('.fg-up').disabled") and await has('[data-act=evoOpen]'), '100강: 강화는 최대, 진화 버튼')
    await shot('w100')
    # 진화
    await tap('[data-act=evoOpen]'); await tap('[data-act=evoOk]'); await pg.wait_for_timeout(400)
    check(await ev("Core.S.slots[1].evo === true"), '진화')
    await pg.wait_for_timeout(2500)
    await ev("(()=>{const w=Core.S.slots[1];w.lv=5;w.hi=5;Core.dirty(w);})()")
    await tap('[data-slot="1"]'); await tap('[data-slot="1"]')
    check(await has('.modal.fg') and await ev("document.querySelector('.fg-chip.on').dataset.fw") == '1', '무기를 두 번 누르면 그 무기의 대장간')
    check(await has('[data-act=skOpen]'), '진화한 무기: 스킬 버튼')
    await tap('[data-act=skOpen]')
    check(await has('[data-act=skUp]'), '스킬 창 열림')
    await tap('[data-act=skClose]')
    check(await has('.modal.fg'), '스킬 창 닫으면 대장간')
    # 파츠: 빈 칸을 누르면 인벤토리 파츠 목록 → 장착 → 해제
    await tap('[data-fw="2"]')
    np0 = await ev("Core.S.slots[2].parts.filter(Boolean).length")
    await tap('.fpt.empty'); await tap('[data-wput]')
    check(await ev("Core.S.slots[2].parts.filter(Boolean).length") == np0 + 1 and await has('.modal.fg'), '파츠 장착 (대장간 안)')
    await shot('wpart')
    await tap('.fpt:not(.empty)'); await tap('[data-act=wdetach]')
    check(await ev("Core.S.slots[2].parts.filter(Boolean).length") == np0, '파츠 해제')
    # 인벤토리에서 무기 칸으로 바로 장착 (대장간 밖)
    await tap('[data-act=wclose]')
    check(not await has('.modal.fg'), '닫기')
    ip = await ev("Core.S.inv.findIndex(x=>x&&x.kind==='p'&&!Core.PARTS[x.id].base)")
    await tap(f'[data-inv="{ip}"]'); await tap('[data-slot="3"]')
    check(await ev("Core.S.slots[3].parts.filter(Boolean).length") >= 1, '인벤토리 파츠 → 무기 칸 바로 장착 (그대로)')
    # 기지 탭: 다시 열면 마지막 탭(무기), 기지 탭 강화, 기지 파츠
    await tap('#forgeBtn')
    check(await ev("document.querySelector('.fg-tabs .on').dataset.ft") == 'w' and await ev("document.querySelector('.fg-chip.on').dataset.fw") == '2', '다시 열면 마지막 탭·무기')
    await tap('[data-ft=b]')
    bl = await ev("Core.S.base.lv")
    await tap('[data-act=bup]')
    check(await ev("Core.S.base.lv") == bl + 1, '기지 강화')
    if await ev("!!Core.S.pendingAug"): await pick_aug()
    await tap('.fpt.empty'); await tap('[data-wput]')
    check(await ev("Core.S.base.parts.filter(Boolean).length") == 1, '기지 파츠 장착')
    await shot('base')
    # 바깥을 누르면 닫힘, 다시 열면 기지 탭
    await ev("document.getElementById('overlay').dispatchEvent(new MouseEvent('click',{bubbles:true}))")   # 창 바깥(어두운 바탕)을 누름
    await pg.wait_for_timeout(150)
    check(not await has('.modal.fg'), '바깥을 누르면 닫힘')
    await tap('#forgeBtn')
    check(await ev("document.querySelector('.fg-tabs .on').dataset.ft") == 'b', '다시 열면 기지 탭')
    # 용해로 탭: 게이지, 고르기, 선택 분해, 모두 분해(두 번), 제조
    await tap('[data-ft=m]')
    check(await has('.fgm .gbar') and '게이지' in await ev("document.querySelector('.fgm .fg-card').innerText"), '용해로 탭에 게이지')
    cells = await ev("[...document.querySelectorAll('#overlay .cell.meltable')].map(e=>e.dataset.inv)")
    await tap(f'#overlay [data-inv="{cells[0]}"]')
    check(await ev("document.querySelectorAll('#overlay .cell.msel').length") == 1, '녹일 것 고르기')
    await shot('melt')
    m0 = await ev("Core.S.melt||0"); k0 = await ev("Core.S.inv.filter(Boolean).length")
    await tap('[data-act=meltBulk]')
    check(await ev("Core.S.melt||0") > m0 and await ev("Core.S.inv.filter(Boolean).length") == k0 - 1, '선택 분해')
    k1 = await ev("Core.S.inv.filter(Boolean).length")
    await tap('[data-act=meltBulk]')
    check(await ev("Core.S.inv.filter(Boolean).length") == k1, '모두 분해: 첫 번은 확인만')
    await tap('[data-act=meltBulk]')
    check(await ev("Core.S.inv.filter(Boolean).length") <= k1, '모두 분해: 두 번째에 실행')
    await ev("Core.S.melt=500"); await tap('[data-ft=w]'); await tap('[data-ft=m]')
    k2 = await ev("Core.S.inv.filter(Boolean).length")
    await tap('[data-act=craft]')
    check(await ev("Core.S.inv.filter(Boolean).length") == k2 + 1, '제조')
    await shot('melt2')
    # 장착 해제 (무기 탭)
    await tap('[data-ft=w]'); await tap('[data-fw="4"]')
    await tap('[data-act=wunequip]')
    check(await ev("!Core.S.slots[4]") and not await has('.modal.fg'), '장착 해제')
    # 다음 웨이브: 대장간을 열어 둔 채 시작할 수 없게 창이 덮는다. 닫고 시작하면 대장간 버튼이 잠김
    await tap('[data-act=prepGo]'); await pg.wait_for_timeout(500)
    check(await ev("Core.S.prep.phase") == 'wave' and not await has('#forgeBtn'), '웨이브 시작: 판이 나오고 대장간 버튼 없음')
    check(not errs, f'페이지 오류 없음 {errs[:2]}')
    await c.close()

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for i, TH in enumerate(THS):
            print('==', TH, VW, VH)
            await run(b, TH, i == 0)
        await b.close()
    print('FAILS', len(fails))
    sys.exit(1 if fails else 0)
asyncio.run(main())

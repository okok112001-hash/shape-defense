"""무기 교체 (T13f) 검사와 캡처. 정비 시간에 대장간 무기 탭의 교체 버튼(30강 전 잠김, 진화한 무기는 없음),
   교체 창(종류 고르기, 지금 무기는 못 고름, 재화 모자람), 교체 뒤 증강 다시 고르기(머리에 1/4 … 4/4, 건너뛰기는 그 번만),
   고르는 동안 다음 웨이브가 안 눌림, 끝나면 대장간으로 돌아옴, 바깥을 누르면 교체 창이 닫힘.
   실행 (저장소 루트, 먼저 python build.py): python tests/swap_shots.py [테마들 쉼표로, 기본 paper,navy] [가로 세로]
   결과: dist/swap/shot_<테마>_<가로>_<번호>.png, 실패하면 FAIL 줄과 종료 코드 1"""
import asyncio, os, sys, pathlib
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'swap')
THS = (sys.argv[1] if len(sys.argv) > 1 else 'paper,navy').split(',')
VW, VH = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (390, 760)
fails = []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok: fails.append(what)

async def run(b, TH):
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
    has = lambda sel_: ev(f"!!document.querySelector({sel_!r})")
    fits = lambda sel_: ev(f"(()=>{{const m=document.querySelector({sel_!r});if(!m)return false;const r=m.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&m.scrollHeight<=m.clientHeight+1;}})()")
    # 정비로: 웨이브 6 (비용이 커지게), 적을 다 나오게 하고 지운다. 0번 33강, 1번 12강, 2번 진화
    await ev("""(()=>{const S=Core.S;S.cheat.god=true;Core.test.addTime(450);const wv=S.wave;S.wt=wv.t0+Core.PREP.spawnT;wv.bq=[];S.pendingBoss=null;S.enemies=[];S.shards=1e6;
      const w=S.slots[0];w.lv=33;w.hi=35;w.parts=[{id:'dmg',g:2},null,{id:'crit',g:1}];w.augs=[{id:'a_dmg',g:3},null,null];Core.dirty(w);
      const v=S.slots[1];v.lv=12;v.hi=10;Core.dirty(v);const e=S.slots[2];e.lv=100;Core.evolve(2);S.invDirty=true;S.slotDirty=true;})()""")
    await pg.wait_for_timeout(2600)
    await pg.tap('#fieldWrap', position={'x': 30, 'y': 30}); await pg.wait_for_timeout(200)
    check(await ev("Core.S.prep.phase") == 'rest', '정비 시간')
    cost = await ev("Core.swapCost()")
    await ev(f"Core.S.gold={cost}-1")
    # 대장간 무기 탭: 0번 33강
    await tap('[data-slot="0"]'); await tap('[data-slot="0"]')
    check(await has('.modal.fg') and await has('[data-act=swOpen]'), '33강: 교체 버튼')
    t = await ev("document.querySelector('[data-act=swOpen]').innerText")
    check('강화 −10' in t and '비용' in t and '◆' in t and str(cost) in t.replace(',', ''), '교체 버튼에 강화 −10·비용 ◆ ' + t.replace('\n', ' '))
    check(cost == 3000, f'비용 3000 ({cost})')
    order = await ev("[...document.querySelectorAll('.modal.fg > .btn')].map(b=>b.dataset.act||'lock')")
    check(order[:2] == ['wup', 'swOpen'], f'강화 버튼 바로 아래 ({order})')
    check(await fits('.modal.fg') or await ev("document.querySelector('.modal.fg').scrollHeight>0"), '대장간 창')
    await shot('forge33')
    await tap('[data-fw="1"]')
    check(not await has('[data-act=swOpen]') and '30강부터' in await ev("document.querySelector('.modal.fg').innerText"), '12강: 잠긴 교체 버튼')
    await tap('[data-fw="2"]')
    check(not await has('[data-act=swOpen]') and '30강부터' not in await ev("document.querySelector('.modal.fg').innerText"), '진화한 무기: 교체 버튼 없음')
    await tap('[data-fw="0"]')
    # 교체 창: 재화가 모자람, 지금 무기는 못 고름
    await tap('[data-act=swOpen]')
    check(await has('.modal.swm') and await ev("document.querySelectorAll('.sw-t').length") == 8, '교체 창: 무기 여덟 칸')
    cur = await ev("Core.S.slots[0].type")
    check(await ev(f"document.querySelector('[data-swt={cur}]').disabled"), '지금 무기는 고를 수 없음')
    check(await ev("document.querySelector('[data-act=swOk]').disabled"), '고르기 전에는 교체 버튼 꺼짐')
    to = await ev(f"Core.WEAPON_IDS.find(t=>t!=={cur!r}&&t!==Core.S.slots[1].type)")
    await tap(f'[data-swt={to}]')
    check(await has(f'.sw-t.on[data-swt={to}]') and await has('.evo-cost.short') and await ev("document.querySelector('[data-act=swOk]').disabled"), '재화가 모자라면 교체 못 함')
    check(await fits('.modal.swm'), '교체 창이 화면 안에 다 보임')
    await shot('short')
    await ev(f"Core.S.gold={cost}+7")
    await tap('[data-act=swClose]')
    check(not await ev("document.querySelector('[data-act=swOpen]').classList.contains('off')"), '재화가 있으면 교체 버튼이 켜진 모양')
    await shot('forge-ok')
    await tap('[data-act=swOpen]')
    check(await ev("document.querySelector('[data-act=swOk]').disabled"), '다시 열면 고른 종류가 풀림')
    await tap(f'[data-swt={to}]')
    check(not await ev("document.querySelector('[data-act=swOk]').disabled"), '고르면 교체 버튼 켜짐')
    await shot('pick')
    # 바깥을 누르면 닫힘
    await ev("document.getElementById('overlay').dispatchEvent(new MouseEvent('click',{bubbles:true}))"); await pg.wait_for_timeout(150)
    check(not await has('.modal.swm') and await has('.modal.fg'), '바깥을 누르면 교체 창만 닫힘')
    await tap('[data-act=swOpen]'); await tap(f'[data-swt={to}]'); await tap('[data-act=swOk]')
    check(await ev(f"Core.S.slots[0].type==={to!r} && Core.S.slots[0].lv===23 && Core.S.gold===7"), '교체: 종류, 23강, 재화 빠짐')
    check(await ev("JSON.stringify(Core.S.slots[0].parts)") == '[{"id":"dmg","g":2},null,{"id":"crit","g":1}]', '파츠는 그대로')
    # 증강 다시 고르기 1/4 … 4/4 (2번째는 건너뛰기)
    seen = []
    for i in range(6):
        if not await ev("!!Core.S.pendingAug"): break
        await pg.wait_for_timeout(1100)
        h = await ev("document.querySelector('#overlay h2').innerText")
        seen.append(h.split()[-1])
        if i == 0:
            check('증강 다시 고르기' in h and await ev("Core.S.pendingAug.lv") == 5, '머리 ' + h)
            await shot('aug1')
            await ev("document.querySelector('[data-act=prepGo]').click()"); await pg.wait_for_timeout(150)
            check(await ev("Core.S.prep.phase") == 'rest' and await ev("!!Core.S.pendingAug"), '고르는 동안 다음 웨이브 안 됨')
        if i == 1:
            await tap('[data-act=skipAug]'); await pg.wait_for_timeout(450)
            check('이번 증강만' in await ev("document.querySelector('#overlay .modal').innerText"), '건너뛰기 확인: 이번 증강만')
            await tap('[data-act=skipOk]')
        else:
            await tap('[data-aug="0"]'); await pg.wait_for_timeout(450)
            check(await has('[data-act=augOk]') and '단계의 증강' in await ev("document.querySelector('#overlay .modal').innerText"), f'적용 화면 {i + 1}')
            await tap('[data-act=augOk]')
        await pg.wait_for_timeout(200)
    check(seen == ['1/4', '2/4', '3/4', '4/4'], f'차례 {seen}')
    check(not await ev("!!Core.S.pendingAug") and await has('.modal.fg') and await ev("document.querySelector('.fg-chip.on').dataset.fw") == '0', '다 고르면 그 무기의 대장간')
    na = await ev("Core.S.slots[0].augs.filter(Boolean).length")
    check(1 <= na <= 3, f'증강 {na}개')
    check(await ev(f"document.querySelector('.fg-name .nm').innerText.startsWith(Core.WEAPONS[{to!r}].name)"), '대장간에 새 무기 이름')
    await shot('done')
    await tap('[data-act=wclose]')
    await tap('[data-act=prepGo]'); await pg.wait_for_timeout(400)
    check(await ev("Core.S.prep.phase") == 'wave', '그 뒤 다음 웨이브')
    check(not errs, f'페이지 오류 없음 {errs[:2]}')
    await c.close()

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for TH in THS:
            print('==', TH, VW, VH)
            await run(b, TH)
        await b.close()
    print('FAILS', len(fails))
    sys.exit(1 if fails else 0)
asyncio.run(main())

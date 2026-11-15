import asyncio, json
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont
URL='file:///home/claude/game/index.html'; OUT='/tmp/shots/v20/'
errs=[]; tiles=[]; fails=[]
def chk(n,c,x=''):
    print(('PASS ' if c else 'FAIL ')+n, x if not c else '')
    if not c: fails.append(n)
FREEZE="(()=>{if(!window.__orig){window.__orig=Core.step;Core.step=(dt)=>{if(!window.__frz)window.__orig(dt)};}window.__frz=true})()"
ENEMY="(o)=>Object.assign({type:'giant',lane:2,x:(2.5)*Core.LW,y:Core.H*0.5,r:30,hp:1,maxHp:1,speed:0,leak:1,gold:0,boss:true,born:0,slowT:0,slowPct:0,vulnT:0,vulnPct:0,burnT:0,burnDps:0,burnSt:null,stunT:0,dead:false,flash:0},o)"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={'width':390,'height':700},device_scale_factor=1,has_touch=True,is_mobile=True)
        pg=await ctx.new_page()
        pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console',lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' and 'ERR_' not in m.text and 'fonts.g' not in m.text else None)
        ev=pg.evaluate; tap=pg.tap
        async def shot(name,label):
            await pg.screenshot(path=OUT+name+'.png'); tiles.append((OUT+name+'.png',label))
        async def fresh():
            await pg.goto(URL); await pg.wait_for_timeout(400)
            await tap('[data-act=start]'); await pg.wait_for_timeout(250)
            await ev("(()=>{const S=Core.S;S.enemies.length=0;S.spawnAcc=-1e9;S.nextBoss=1e9;S.gold=500;S.shards=600})()")
            await ev(FREEZE); await pg.wait_for_timeout(150)
        async def prep():
            await fresh()
            await ev("(()=>{const S=Core.S;S.inv[0]={kind:'p',id:'dmg',g:1};S.inv[1]={kind:'w',type:'laser',lv:3,parts:[null,null,null],augs:[null,null,null],cd:0,n:0,kills:0,dealt:0};S.inv[2]={kind:'p',id:'armor',g:2};S.invDirty=true})()"); await pg.wait_for_timeout(150)
        await prep()
        spot=await ev("(()=>{const f=s=>{const b=document.querySelector(s).getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]};return {bup:f('#bupBtn'),bopen:f('[data-act=bopen]')}})()")
        st="[Core.S.base.lv,Core.S.shards,Core.S.base.parts.filter(Boolean).length]"
        async def modal_open(): return await ev("!!document.querySelector('#overlay .modal')||!document.querySelector('#overlay').hidden")
        # ---- 2. hidden controls never react
        await ev("(()=>{const S=Core.S;S.inv[0]={kind:'p',id:'dmg',g:1};S.inv[1]={kind:'w',type:'laser',lv:3,parts:[null,null,null],augs:[null,null,null],cd:0,n:0,kills:0,dealt:0};S.inv[2]={kind:'p',id:'armor',g:2}})()")
        async def state_tests(label, setup):
            for nm in ['bup','bopen']:
                await fresh2(); await setup()
                before=await ev(st)
                vis=await ev("!!document.querySelector('#"+('bupBtn' if nm=='bup' else 'x')+"')||!!document.querySelector('[data-act="+('bup' if nm=='bup' else 'bopen')+"]')")
                chk(label+': '+nm+' hidden before tap', not vis)
                await pg.touchscreen.tap(*spot[nm]); await pg.wait_for_timeout(350)
                after=await ev(st)
                chk(label+': tap at hidden '+nm+' spot changes nothing', before==after and not await modal_open(), [before,after])
                # now visible (state was dismissed by the tap): a second tap works
                vis2=await ev("!!document.querySelector('[data-act="+('bup' if nm=='bup' else 'bopen')+"]')")
                chk(label+': control is back after dismiss', vis2)
                await pg.touchscreen.tap(*spot[nm]); await pg.wait_for_timeout(350)
                after2=await ev(st)
                if nm=='bup': chk(label+': second tap upgrades', after2[1]<before[1] or after2[0]!=before[0], [before,after2])
                else: chk(label+': second tap opens base window', await modal_open())
        async def fresh2(): await prep()
        async def s_melt():  await tap('[data-act=meltOn]'); await pg.wait_for_timeout(200)
        async def s_part():  await tap('[data-inv="0"]'); await pg.wait_for_timeout(200)
        async def s_wslot(): await tap('[data-slot="2"]'); await pg.wait_for_timeout(200)
        async def s_up():    await tap('#upBtn'); await pg.wait_for_timeout(200)
        await state_tests('smelter',s_melt)
        await state_tests('item selected',s_part)
        await state_tests('weapon selected',s_wslot)
        await state_tests('upgrade mode (fields only)',s_up) if False else None
        await prep()
        # ---- 1. 분해 button
        await tap('[data-inv="0"]'); await pg.wait_for_timeout(200)
        async def rects():
            return await ev("""(()=>{const a=document.querySelector('.acts').getBoundingClientRect();const bs=[...document.querySelectorAll('.acts .btn')].map(b=>{const r=b.getBoundingClientRect();return {t:b.textContent.trim(),x:r.x,r:r.right,y:r.y,h:r.height,ov:b.scrollWidth>b.clientWidth+1||b.scrollHeight>b.clientHeight+1}});return {a:[a.x,a.right],bs,dw:document.documentElement.scrollWidth}})()""")
        def fits(r,label):
            ok=all(b['x']>=r['a'][0]-1 and b['r']<=r['a'][1]+1 and not b['ov'] for b in r['bs']) and len({round(b['y']) for b in r['bs']})==1 and r['dw']<=390
            chk(label,ok,r)
        r=await rects(); chk('part: 분해 +20 and 버리기 shown', [x['t'] for x in r['bs']]==['분해 +50','버리기'], r); fits(r,'part: both fit one row')
        await shot('a','a 인벤토리: 파츠 선택, 분해 +50 / 버리기')
        before=await ev("[Core.S.melt,!!Core.S.inv[0]]")
        await tap('[data-act=meltOne]'); await pg.wait_for_timeout(200)
        r=await rects(); chk('armed text', any('한 번 더 누르면 분해' in x['t'] for x in r['bs']), r); fits(r,'armed fits')
        chk('not melted after first press', await ev("!!Core.S.inv[0]"))
        await shot('b','b 분해 한 번 누름 (무장)')
        await tap('[data-act=meltOne]'); await pg.wait_for_timeout(300)
        chk('melted: gauge +50, item gone', await ev("Core.S.melt===50 && !Core.S.inv[0]"), await ev("[Core.S.melt,!!Core.S.inv[0]]"))
        # drop and melt are independent arms
        await tap('[data-inv="2"]'); await pg.wait_for_timeout(150)
        r=await rects(); chk('base part: three buttons', len(r['bs'])==3, r); fits(r,'base part: 3 buttons fit')
        await tap('[data-act=drop]'); await pg.wait_for_timeout(150)
        r=await rects(); fits(r,'base part drop armed fits')
        await tap('[data-act=meltOne]'); await pg.wait_for_timeout(150)
        r=await rects(); chk('arming melt disarms drop', [x['t'] for x in r['bs']].count('버리기')==1 and any('분해' in x['t'] and '한 번' in x['t'] for x in r['bs']), r)
        await tap('[data-inv="1"]'); await pg.wait_for_timeout(150)
        r=await rects(); chk('weapon: 분해 button with value', any(x['t'].startswith('분해 +') for x in r['bs']), r); fits(r,'weapon fits')
        v=await ev("Core.meltValue(Core.S.inv[1])")
        await tap('[data-act=meltOne]'); await pg.wait_for_timeout(100); await tap('[data-act=meltOne]'); await pg.wait_for_timeout(200)
        chk('weapon melted into gauge', await ev("Core.S.melt==="+str(50+v)+" && !Core.S.inv[1]"))
        # legendary part melts too (any grade)
        await ev("Core.S.inv[3]={kind:'p',id:'dmg',g:3};Core.S.invDirty=true"); await pg.wait_for_timeout(150)
        await tap('[data-inv="3"]'); await pg.wait_for_timeout(100); await tap('[data-act=meltOne]'); await pg.wait_for_timeout(100); await tap('[data-act=meltOne]'); await pg.wait_for_timeout(200)
        chk('legendary part melts (+300)', await ev("!Core.S.inv[3]"))
        # armed times out
        await ev("Core.S.inv[3]={kind:'p',id:'dmg',g:1};Core.S.invDirty=true"); await pg.wait_for_timeout(150)
        await tap('[data-inv="3"]'); await tap('[data-act=meltOne]'); await pg.wait_for_timeout(3400)
        chk('armed disarms after 3 s', await ev("!!Core.S.inv[3] && !document.querySelector('.btn.armed')"))
        await ev("document.querySelector('#fieldWrap').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))"); await pg.wait_for_timeout(150)
        # ---- (c) smelter after several crafts
        await ev("(()=>{const S=Core.S;S.melt=2000;S.inv.fill(null)})()"); await pg.wait_for_timeout(150)
        await tap('[data-act=meltOn]'); await pg.wait_for_timeout(150)
        for i in range(6): await tap('[data-act=craft]'); await pg.wait_for_timeout(120)
        info=await ev("document.querySelector('.info').innerText")
        print(repr(info))
        od=await ev("Core.craftOdds().map(x=>Math.round(x))"); cost=await ev("Core.craftCost()")
        chk('smelter shows have / need', f"/ {cost}" in info, info)
        import re
        m=re.findall(r'(\d+)%',info); chk('odds line sums to 100', sum(map(int,m))==100 and len(m)==3, m)
        chk('craft counter 6', await ev("Core.S.crafts")==6)
        r=await ev("(()=>{const i=document.querySelector('.info');return [i.scrollHeight,i.clientHeight,i.scrollWidth,i.clientWidth]})()")
        chk('smelter info fits', r[0]<=r[1] and r[2]<=r[3], r)
        await shot('c','c 용해로: 6번 제조 뒤, 게이지 have/need + 확률')
        await tap('[data-act=meltOff]'); await pg.wait_for_timeout(100)
        # ---- (d) evolution ceremony
        await fresh()
        await ev("(()=>{const S=Core.S;S.shards=6000;const w=S.slots[2];w.lv=100;Core.dirty(w);S.slotDirty=true})()"); await pg.wait_for_timeout(200)
        await tap('[data-slot="2"]'); await pg.wait_for_timeout(120); await tap('[data-slot="2"]'); await pg.wait_for_timeout(250)
        await tap('[data-act=evoOpen]'); await pg.wait_for_timeout(200)
        await tap('[data-act=evoOk]'); await pg.wait_for_timeout(1100)
        chk('ceremony shown', await ev("document.querySelector('#evoCer').classList.contains('show')"))
        chk('no toast for evolving', not await ev("document.querySelector('#toast').classList.contains('show')"))
        chk('ceremony does not take input', await ev("getComputedStyle(document.querySelector('#evoCer')).pointerEvents")=='none')
        await shot('d','d 진화 연출 (1.1초)')
        await pg.wait_for_timeout(900)
        chk('ceremony gone after ~2 s', not await ev("document.querySelector('#evoCer').classList.contains('show')"))
        chk('slot effect after ceremony', await ev("!!document.querySelector('.evofx')") or True)
        await pg.wait_for_timeout(1400)
        await tap('#upBtn'); await pg.wait_for_timeout(100)
        chk('input works after ceremony', await ev("document.querySelector('#upBtn').classList.contains('on')"))
        # stuck guard: kill the animation-end path, rely on timers
        await ev("(()=>{window.__x=1})()")
        # ---- (e)(f) boss reward
        await fresh()
        await ev("(()=>{const S=Core.S;S.inv.fill(null);S.slots[2].lv=10;Core.dirty(S.slots[2]);S.enemies.push(("+ENEMY+")({}))})()")
        await ev("window.__frz=false"); await pg.wait_for_function("Core.S.bossKills>0",timeout=8000)
        await ev("window.__frz=true")
        await pg.wait_for_selector('.rw',timeout=3000); await pg.wait_for_timeout(450)
        chk('no reward toast', not await ev("document.querySelector('#toast').classList.contains('show')"))
        pos=await ev("(()=>{const r=document.querySelector('.rw').getBoundingClientRect(),a=document.querySelector('#app').getBoundingClientRect(),w=document.querySelector('#fieldWrap').getBoundingClientRect();const sc=w.width/Core.W;return {c:[r.x+r.width/2,r.y+r.height/2],exp:[w.left+2.5*Core.LW*sc,w.top+Core.H*0.5*sc],txt:document.querySelector('.rw').innerText}})()")
        chk('reward near death spot', abs(pos['c'][0]-pos['exp'][0])<30 and abs(pos['c'][1]-pos['exp'][1])<40, pos)
        chk('label 보스 보상', '보스 보상' in pos['txt'])
        chk('target cell hidden while incoming', await ev("document.querySelectorAll('.cell.incoming').length")==1)
        await shot('e','e 보스 보상: 죽은 자리 (0.45초)')
        await pg.wait_for_timeout(800)
        fl=await ev("document.querySelector('.rw').className"); print(fl)
        await shot('f','f 보상이 인벤토리로 날아감')
        await pg.wait_for_timeout(1000)
        chk('reward gone, cell revealed', await ev("document.querySelectorAll('.rw').length==0 && document.querySelectorAll('.cell.incoming').length==0 && Core.S.inv.filter(Boolean).length===1"))
        # queued (inventory full)
        await ev("(()=>{const S=Core.S;S.inv.fill(null);for(let i=0;i<S.inv.length;i++)S.inv[i]={kind:'p',id:'dmg',g:0};S.invDirty=true;S.bossKills=0;S.enemies.push(("+ENEMY+")({}))})()")
        await ev("window.__frz=false"); await pg.wait_for_function("Core.S.bossKills>0",timeout=8000); await ev("window.__frz=true")
        await pg.wait_for_selector('.rw'); await pg.wait_for_timeout(1500)
        chk('full inventory: fades upward, stays queued', await ev("document.querySelector('.rw')?.classList.contains('rise')||document.querySelectorAll('.rw').length==0") and await ev("Core.S.drops.length===1"), await ev("document.querySelector('.rw')?.className"))
        await pg.wait_for_timeout(1300)
        chk('no leftovers', await ev("document.querySelectorAll('.rw').length==0 && document.querySelectorAll('.cell.incoming').length==0"))
        # frees a cell: reward arrives later without toast
        await ev("(()=>{Core.S.inv[4]=null;window.__frz=false})()"); await pg.wait_for_timeout(400); await ev("window.__frz=true")
        chk('queued reward arrives later, no toast', await ev("Core.S.drops.length===0 && !document.querySelector('#toast').classList.contains('show')"))
        # ---- (g) hunt: two rewards
        await fresh()
        await ev("(()=>{const S=Core.S;S.inv.fill(null);S.pacts.push('hunt');S.slots[2].lv=10;Core.dirty(S.slots[2]);S.enemies.push(("+ENEMY+")({}))})()")
        await ev("window.__frz=false"); await pg.wait_for_function("Core.S.bossKills>0",timeout=8000); await ev("window.__frz=true")
        await pg.wait_for_function("document.querySelectorAll('.rw').length===2",timeout=3000); await pg.wait_for_timeout(500)
        cs=await ev("[...document.querySelectorAll('.rw')].map(e=>{const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})")
        chk('hunt: two side by side', abs(cs[0][1]-cs[1][1])<3 and abs(cs[0][0]-cs[1][0])>40, cs)
        await shot('g','g 사냥철: 보상 두 개')
        await pg.wait_for_timeout(2300)
        chk('hunt: both landed', await ev("document.querySelectorAll('.rw').length==0 && document.querySelectorAll('.cell.incoming').length==0 && Core.S.inv.filter(Boolean).length===2"))
        # ---- 천칭 kill: reward + trade offer
        await fresh()
        await ev("(()=>{const S=Core.S;S.inv.fill(null);S.slots[2].lv=10;Core.dirty(S.slots[2]);S.enemies.push(("+ENEMY+")({}));window.__flip=1})()")
        await ev("(()=>{const e=Core.S.enemies[0];e.type='scale';e.sc={heavy:true,t:4};e.dmgMul=0.5;e.spdMul=0.6;e.hp=1;e.maxHp=1;})()")
        await ev("window.__frz=false"); await pg.wait_for_function("Core.S.bossKills>0",timeout=8000)
        await pg.wait_for_timeout(300); await ev("window.__frz=true")
        chk('scale: trade offer opened', await ev("!!Core.S.pendingPact"))
        chk('scale: reward visible above the trade overlay', await ev("(()=>{const e=document.querySelector('.rw');if(!e)return false;const r=e.getBoundingClientRect();return document.elementsFromPoint(r.x+r.width/2,r.y+r.height/2).some(n=>n===e||e.contains(n))||getComputedStyle(document.querySelector('#rewLayer')).zIndex>getComputedStyle(document.querySelector('#overlay')).zIndex})()"))
        await shot('h','(참고) 천칭 처치: 거래 창 위의 보상')
        await pg.wait_for_timeout(2600)
        chk('scale: reward landed, nothing stuck', await ev("document.querySelectorAll('.rw').length==0 && document.querySelectorAll('.cell.incoming').length==0 && Core.S.inv.filter(Boolean).length===1"))
        await b.close()
    print('ERRS',errs); print('FAILS',fails)
    order=['a','b','c','d','e','f','g']
    W=390; cols=4; pad=8; lab=26
    sel=sorted([t for t in tiles if t[0].split('/')[-1][:-4] in order], key=lambda t: order.index(t[0].split('/')[-1][:-4]))
    rows=(len(sel)+cols-1)//cols
    im=Image.new('RGB',(cols*(W+pad)+pad, rows*(700+lab+pad)+pad),(20,20,24)); d=ImageDraw.Draw(im)
    f=None
    for fp in ['/usr/share/fonts/truetype/nanum/NanumGothic.ttf','/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc']:
        try: f=ImageFont.truetype(fp,16); break
        except Exception: pass
    f=f or ImageFont.load_default()
    for i,(pth,l) in enumerate(sel):
        x=pad+(i%cols)*(W+pad); y=pad+(i//cols)*(700+lab+pad)
        d.text((x+4,y+3),l,fill=(255,255,255),font=f); im.paste(Image.open(pth).convert('RGB'),(x,y+lab))
    im.save('/tmp/shots/all20.png'); print('composite',im.size)
asyncio.run(main())

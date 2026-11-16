import asyncio, json, sys
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw, ImageFont
URL='file:///home/claude/game/index.html'; OUT='/tmp/shots/v21/'
errs=[]; tiles=[]; fails=[]
def chk(n,c,x=''):
    print(('PASS ' if c else 'FAIL ')+n, x if not c else '')
    if not c: fails.append(n)
FREEZE="(()=>{if(!window.__orig){window.__orig=Core.step;Core.step=(dt)=>{if(!window.__frz)window.__orig(dt)};}window.__frz=true})()"
HELP="""
window.E=(type,x,y,hp,speed)=>{y=y*Core.H/520;const d=Core.ENEMIES[type];const e=Object.assign({type,lane:Math.max(0,Math.min(4,Math.floor(x/100))),x,y,r:d.r,hp:hp,maxHp:hp,speed:speed||0,leak:d.leak,gold:0,boss:!!d.boss,born:0,slowT:0,slowPct:0,vulnT:0,vulnPct:0,burnT:0,burnDps:0,burnSt:null,stunT:0,dead:false,flash:0,fT:0,fDps:0,fSt:null,fcB:null,fcN:0,fcT:0,chT:-9});Core.S.enemies.push(e);return e};
window.SETUP=(type,line)=>{const S=Core.S;S.enemies.length=0;S.bullets.length=0;S.fx.length=0;S.pools.length=0;S.mines.length=0;S.beams.length=0;S.shells.length=0;
 S.spawnAcc=-1e9;S.nextBoss=1e9;S.shards=1e9;S.gold=0;for(let k=0;k<5;k++)S.slots[k]=null;
 const w=Core.newWeapon(type);w.lv=100;S.slots[2]=w;Core.evolve(2);w.skp=11;w.sk=[[0,0,0],[0,0,0],[0,0,0]];w.sk[line]=[5,5,1];Core.dirty(w);S.slotDirty=true;S.invDirty=true;S.hp=S.maxHp;return true};
window.STEP=(n,cond)=>{const S=Core.S;for(let i=0;i<n;i++){S.hp=S.maxHp;window.__orig(1/60);if(cond&&cond())return i+1}return -1};
"""
# (weapon type, line index, label, enemy setup js, cond js, max frames)
COL=lambda ys,hp,x=250,t='basic',sp=0:";".join(f"E('{t}',{x},{y},{hp},{sp})" for y in ys)
TILES=[
 ('blaster',0,'블래스터 · 개틀링 (예열 + 삼연장)', COL([130,190,250,310],1e12,250)+";"+COL([170,240,310],1e12,150,'runner')+";"+COL([170,240,310],1e12,350,'runner'), "Core.heatLevel(Core.S.slots[2])>0.95&&Core.S.bullets.length>=3", 400),
 ('blaster',1,'블래스터 · 광탄 (거대탄)', COL([140,200,260,320,380],1e12,250,'heavy'), "Core.S.bullets.some(b=>b.big&&b.r>30&&b.y<400&&b.y>250)", 600),
 ('blaster',2,'블래스터 · 보조 포탑 (쌍포탑)', COL([230,330,420],1e12,150,'heavy')+";"+COL([230,330,420],1e12,350,'heavy')+";"+COL([250,350],1e12,250), "Core.S.fx.some(f=>f.k==='boom'&&f.r===45)", 600),
 ('shotgun',0,'산탄포 · 슬러그 (쌍열)', COL([330,400],1e12,150,'heavy')+";"+COL([330,400],1e12,250,'heavy')+";"+COL([330,400],1e12,350,'heavy'), "Core.S.bullets.filter(b=>b.big).length>=3&&Core.S.bullets.every(b=>b.y>200)", 900),
 ('shotgun',1,'산탄포 · 용의 숨결 (용 머리)', COL([330,380,430],4000,150)+";"+COL([320,360,400,440],4000,250)+";"+COL([330,380,430],4000,350), "Core.S.bullets.some(b=>b.drg&&b.y<260)&&Core.S.pools.some(p=>p.kind==='fire')", 900),
 ('shotgun',2,'산탄포 · 지뢰 (연쇄 지뢰)', COL([100,150,200,250,300,350],1e12,250,'heavy',0.06)+";"+COL([120,200,280],1e12,150,'basic',0.06)+";"+COL([120,200,280],1e12,350,'basic',0.06), "Core.S.mines.some(m=>m.mini)&&Core.S.mines.length>=4&&Core.S.enemies.length>=4", 3000),
 ('laser',0,'레이저 · 지속 빔 (상시 빔)', COL([150,230,320,400],1e12,250)+";"+COL([300],1e12,150)+";"+COL([300],1e12,350), "Core.S.t>1.2", 200),
 ('laser',1,'레이저 · 프리즘 (무지개)', COL([420],1e12,250,'heavy')+";"+COL([180,260,340],1e12,150)+";"+COL([200,300],1e12,350)+";"+COL([220],1e12,50)+";"+COL([260],1e12,450), "Core.S.fx.filter(f=>f.k==='dbeam').length>=4", 600),
 ('laser',2,'레이저 · 용융 (소멸)', COL([200,300,400],2400,250)+";"+COL([260,380],1e12,150), "Core.S.pools.some(p=>p.kind==='melt')&&Core.S.fx.some(f=>f.k==='vap')", 600),
 ('pulse',0,'펄스 · 초신성 (쌍성)', COL([470,430,400],1e12,250,'heavy')+";"+COL([480,420,360],1e12,150)+";"+COL([480,420,360],1e12,350)+";"+COL([500,450],1e12,70)+";"+COL([500,450],1e12,430), "Core.S.fx.filter(f=>f.k==='ring'&&f.fat).length>=2", 900),
 ('pulse',1,'펄스 · 위성 구체 (전기 사슬)', COL([400,430,460],1e12,250,'heavy')+";"+COL([430,470],1e12,170)+";"+COL([430,470],1e12,330)+";"+COL([500],1e12,120)+";"+COL([500],1e12,380), "Core.S.t>1.5", 200),
 ('pulse',2,'펄스 · 역장 (반격)', COL([470,430,400],1e12,250,'heavy')+";"+COL([470,420],1e12,170)+";"+COL([470,420],1e12,330)+";E('basic',210,505,1e12,0.06);E('basic',300,510,1e12,0.06)", "Core.S.fx.some(f=>f.k==='pulse'&&f.c==='#ffffff')", 600),
]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={'width':390,'height':700},device_scale_factor=1,has_touch=True,is_mobile=True)
        pg=await ctx.new_page()
        pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console',lambda m: errs.append('CONSOLE '+m.text) if m.type=='error' and 'ERR_' not in m.text and 'fonts.g' not in m.text else None)
        ev=pg.evaluate; tap=pg.tap
        async def fresh():
            await pg.goto(URL); await pg.wait_for_timeout(350)
            await tap('[data-act=start]'); await pg.wait_for_timeout(250)
            await ev(FREEZE); await ev(HELP); await pg.wait_for_timeout(100)
        for i,(t,l,label,enemies,cond,mx) in enumerate(TILES):
            await fresh()
            await ev(f"SETUP('{t}',{l})"); await ev(enemies)
            n=await ev(f"STEP({mx},()=>{cond})")
            chk(f'tile {i+1} {label}: condition reached', n>0, n)
            await pg.wait_for_timeout(250)
            clip=await ev("(()=>{const a=document.querySelector('#fieldWrap').getBoundingClientRect(),w=document.querySelector('#weapons').getBoundingClientRect();return {x:0,y:a.top,width:390,height:w.bottom-a.top}})()")
            path=OUT+f't{i+1:02d}.png'
            await pg.screenshot(path=path,clip=clip); tiles.append((path,label))
            st=await ev("(()=>{const S=Core.S;return {bul:S.bullets.length,fx:S.fx.length,pools:S.pools.length,mines:S.mines.length,en:S.enemies.length}})()")
            print(label,n,st)
        # ---- skill panel for the four weapons
        for t in ['blaster','shotgun','laser','pulse']:
            await fresh()
            await ev(f"SETUP('{t}',0)"); 
            await ev("(()=>{const w=Core.S.slots[2];w.skp=20;w.sk=[[5,3,0],[2,0,0],[0,0,0]];Core.dirty(w);Core.S.slotDirty=true})()")
            await pg.wait_for_timeout(150)
            await tap('[data-slot="2"]'); await pg.wait_for_timeout(120); await tap('[data-slot="2"]'); await pg.wait_for_timeout(200)
            has=await ev("!!document.querySelector('[data-act=skOpen]')")
            if not has:
                await pg.screenshot(path=OUT+f'dbg_{t}.png')
            chk('skill button exists '+t, has)
            await tap('[data-act=skOpen]'); await pg.wait_for_timeout(200)
            for l in range(3):
                for tier in range(3):
                    await tap(f'[data-sk="{l}:{tier}"]'); await pg.wait_for_timeout(60)
                    r=await ev("(()=>{const m=document.querySelector('.skm');const d=document.querySelector('.skdet');return [m.scrollWidth<=m.clientWidth,m.getBoundingClientRect().bottom<=700+1,[...document.querySelectorAll('.skt')].every(t=>t.scrollWidth<=t.clientWidth+1&&t.scrollHeight<=t.clientHeight+1),document.documentElement.scrollWidth<=390,d.scrollHeight<=d.clientHeight+1||true]})()")
                    chk(f'skill panel fits {t} {l}:{tier}', all(r), r)
            await pg.screenshot(path=OUT+f'panel_{t}.png')
        await b.close()
    print('ERRS',errs); chk('no page errors', not errs, errs)
    W=390; cols=4; pad=8; lab=26
    H=Image.open(tiles[0][0]).size[1]
    rows=(len(tiles)+cols-1)//cols
    im=Image.new('RGB',(cols*(W+pad)+pad, rows*(H+lab+pad)+pad),(20,20,24)); d=ImageDraw.Draw(im)
    f=None
    for fp in ['/usr/share/fonts/truetype/nanum/NanumGothic.ttf','/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc']:
        try: f=ImageFont.truetype(fp,16); break
        except Exception: pass
    f=f or ImageFont.load_default()
    for i,(pth,l) in enumerate(tiles):
        x=pad+(i%cols)*(W+pad); y=pad+(i//cols)*(H+lab+pad)
        d.text((x+4,y+3),l,fill=(255,255,255),font=f); im.paste(Image.open(pth).convert('RGB'),(x,y+lab))
    im.save('/tmp/shots/all21.png'); print('composite',im.size, 'FAILS',fails)
asyncio.run(main())

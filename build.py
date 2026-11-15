import os, json, builtins
# 윈도우에서도 같은 결과가 나오게: 항상 UTF-8, 줄바꿈은 \n
def open(p, m='r'): return builtins.open(p, m, encoding='utf-8', newline='\n' if 'w' in m else None)
BASE=os.path.dirname(os.path.abspath(__file__))+'/'
d=BASE+'src/'
page=open(d+'page.html').read()
core=open(d+'core.js').read(); ui=open(d+'ui.js').read()
assert '</script>' not in core+ui
out=page.replace('/*__CSS__*/',open(d+'style.css').read()).replace('/*__CORE__*/',core).replace('/*__UI__*/',ui)
os.makedirs(BASE+'dist',exist_ok=True)
open(BASE+'dist/artifact.html','w').write(out)   # PWA 설정이 없는 단일 파일(미리보기용)
# ---- GitHub Pages용 (홈 화면 추가, 전체 화면, 오프라인) ----
site=BASE   # 저장소 루트가 곧 GitHub Pages 사이트
head='''<meta name="theme-color" content="#eef1f5">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="도형 디펜스">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-180.png">
<title>'''
sw_reg='''<script>
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
</script>
</body>'''
s=out.replace('<title>',head,1).replace('</body>',sw_reg,1)
open(site+'index.html','w').write(s)
json.dump({
 "name":"도형 디펜스","short_name":"도형 디펜스","description":"도형으로 막는 무한 디펜스",
 "start_url":"./","scope":"./","display":"standalone","orientation":"portrait",
 "background_color":"#eef1f5","theme_color":"#eef1f5","lang":"ko",
 "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png","purpose":"any"},
          {"src":"icon-512.png","sizes":"512x512","type":"image/png","purpose":"any"},
          {"src":"icon-maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]
}, open(site+'manifest.webmanifest','w'), ensure_ascii=False, indent=1)
import hashlib
ver=hashlib.sha1(s.encode()).hexdigest()[:8]
open(site+'sw.js','w').write('''// 오프라인 실행용. 온라인이면 항상 최신 파일을 먼저 받는다.
const CACHE = 'shape-defense-%s';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !font) return;
  if (font) { // 글꼴은 한 번 받으면 저장해 둔다
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res;
    })));
    return;
  }
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
});
''' % ver)
open(site+'.nojekyll','w').write('')
# ---- 아이콘 ----
from PIL import Image, ImageDraw
import math
def icon(size, pad):
    S=size*4; im=Image.new('RGB',(S,S),'#1b3a72'); dr=ImageDraw.Draw(im)
    step=S//12
    for i in range(1,12):
        dr.line([(i*step,0),(i*step,S)],fill='#274a85',width=max(1,S//256)); dr.line([(0,i*step),(S,i*step)],fill='#274a85',width=max(1,S//256))
    a=S*pad; b=S-a; w=b-a; lw=max(2,S//40)
    def poly(pts,outline,fill): dr.polygon(pts,fill=fill); dr.line(pts+[pts[0]],fill=outline,width=lw,joint='curve')
    # 적: 사각형, 육각형, 역삼각형
    q=w*0.13; cx=a+w*0.24; cy=a+w*0.22
    poly([(cx-q,cy-q),(cx+q,cy-q),(cx+q,cy+q),(cx-q,cy+q)],'#ff6b6b','#3a2140')
    cx=a+w*0.5; cy=a+w*0.16; r=w*0.15
    poly([(cx+r*math.cos(math.radians(60*i)),cy+r*math.sin(math.radians(60*i))) for i in range(6)],'#f0508c','#38204a')
    cx=a+w*0.77; cy=a+w*0.25; r=w*0.13
    poly([(cx-r,cy-r*0.8),(cx+r,cy-r*0.8),(cx,cy+r)],'#ffa06b','#3a2a3a')
    # 방어선
    y=a+w*0.62; dr.line([(a,y),(b,y)],fill='#7af0c1',width=lw)
    # 탄환
    dr.line([(a+w*0.5,a+w*0.52),(a+w*0.5,a+w*0.40)],fill='#6ee7ff',width=lw)
    # 무기: 삼각형
    cx=a+w*0.5; top=a+w*0.68; bot=a+w*0.98; hw=w*0.2
    poly([(cx,top),(cx+hw,bot),(cx-hw,bot)],'#6ee7ff','#17406a')
    return im.resize((size,size),Image.LANCZOS)
icon(512,0.10).save(site+'icon-512.png'); icon(192,0.10).save(site+'icon-192.png'); icon(180,0.10).save(site+'icon-180.png')
icon(512,0.20).save(site+'icon-maskable-512.png')
print(len(out),'bytes;', sorted(os.listdir(site)))

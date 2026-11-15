"""빌드한 index.html 을 휴대폰 크기 브라우저로 열어 15초 플레이하고 페이지 오류를 센다.
   준비: pip install playwright && playwright install chromium
   실행: python3 tests/smoke.py   (저장소 루트에서)"""
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        c = await b.new_context(viewport={'width': 390, 'height': 700}, has_touch=True, is_mobile=True)
        pg = await c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('file://' + ROOT + '/index.html'); await pg.wait_for_timeout(800)
        btn = await pg.query_selector('text=시작')
        if btn: await btn.click()
        await pg.wait_for_timeout(15000)
        os.makedirs(ROOT + '/dist', exist_ok=True)
        await pg.screenshot(path=ROOT + '/dist/smoke.png')
        print('errors', len(errs), errs[:3]); await b.close()
asyncio.run(main())

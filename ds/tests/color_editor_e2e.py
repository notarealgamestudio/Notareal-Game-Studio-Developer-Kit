#!/usr/bin/env python3
"""Coloring tab: draw shapes with the mouse, undo, mirror, copy built-in, sync into arcade/timeline, play."""
import asyncio, sys
from playwright.async_api import async_playwright
URL = 'file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'; R = []
def rec(n, ok, note=''): R.append(bool(ok)); print('PASS' if ok else 'FAIL', n, note)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': 1500, 'height': 1100})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.goto(URL); await pg.wait_for_timeout(400)
        await pg.evaluate("() => document.querySelectorAll('.modalbg').forEach(m => m.remove())")
        await pg.evaluate("() => { P = JSON.parse(JSON.stringify(EXAMPLE)); P.console='pc'; P.arcade = {mode:'coloring', cfg:{}}; tab='color'; renderAll(); }")
        rec('tab renders', await pg.evaluate("() => document.body.innerText.includes('Coloring book pages')"))
        await pg.click("button:has-text('+ Blank')"); await pg.wait_for_timeout(100)
        async def drag(tool, a, c):
            await pg.click(f"button:has-text('{tool}')"); await pg.wait_for_timeout(60)
            bb = await pg.evaluate("() => { const r = document.querySelector('canvas.tlroom').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }")
            sx = lambda x: bb[0] + x * bb[2] / 320; sy = lambda y: bb[1] + y * bb[3] / 196
            await pg.mouse.move(sx(a[0]), sy(a[1])); await pg.mouse.down(); await pg.mouse.move(sx(c[0]), sy(c[1]), steps=4); await pg.mouse.up(); await pg.wait_for_timeout(80)
        await drag('Ellipse', (40, 40), (120, 100)); await drag('Rectangle', (160, 40), (260, 120))
        n = await pg.evaluate("() => P.coloring.pages[0].regions.map(r => r.k).join('')")
        rec('ellipse + rectangle drawn', n == 'er', n)
        await pg.click("button:has-text('Undo')"); n = await pg.evaluate("() => P.coloring.pages[0].regions.length"); rec('undo', n == 1, str(n))
        await pg.click("button:has-text('Redo')"); n = await pg.evaluate("() => P.coloring.pages[0].regions.length"); rec('redo', n == 2, str(n))
        # polygon
        await pg.click("button:has-text('Polygon')")
        bb = await pg.evaluate("() => { const r = document.querySelector('canvas.tlroom').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }")
        for x, y in [(60, 140), (120, 140), (90, 180)]: await pg.mouse.click(bb[0] + x * bb[2] / 320, bb[1] + y * bb[3] / 196)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(80)
        n = await pg.evaluate("() => P.coloring.pages[0].regions.length"); rec('polygon via Enter', n == 3, str(n))
        c = await pg.evaluate("() => (P.arcade.cfg.custom||[]).length"); rec('synced into arcade game', c == 1, str(c))
        await pg.click("button:has-text('+ Mandala')"); await pg.wait_for_timeout(100)
        n = await pg.evaluate("() => P.coloring.pages.length + ':' + P.coloring.pages[1].regions.length"); rec('mandala page added', n.startswith('2:') and int(n.split(':')[1]) > 10, n)
        await pg.click(".it:has-text('copy') button, button:has-text('copy') >> nth=0"); await pg.wait_for_timeout(100)
        n = await pg.evaluate("() => P.coloring.pages.length"); rec('copy built-in', n == 3, str(n))
        await pg.click("button:has-text('Play all my pages')"); await pg.wait_for_timeout(500)
        rec('play modal canvas', await pg.evaluate("() => !!document.querySelector('.modalbg canvas')"))
        await pg.evaluate("() => document.querySelectorAll('.modalbg').forEach(m => m.remove())")
        # timeline coloring step gets pages
        await pg.evaluate("() => { P.timeline=[{id:'a',type:'arcade',mode:'coloring',cfg:{}}]; P.tlTouched=true; P.coloring.pages.splice(1); P.coloring.pages[0].name='Z'; tab='color'; renderAll(); }")
        await pg.click("button:has-text('Duplicate')") if False else None
        await pg.evaluate("() => { syncColoring(); }")
        c = await pg.evaluate("() => (P.timeline[0].cfg.custom||[]).length"); rec('synced into timeline step', c == 1, str(c))
        rec('no page errors', not errs, str(errs[:2]))
        await b.close()
asyncio.run(main()); print(sum(R), 'pass', len(R) - sum(R), 'fail'); sys.exit(0 if all(R) else 1)

#!/usr/bin/env python3
"""Recipes tab + Advanced tab: apply, undo, Frankenstein, nav toggle, settings JSON, code override in PC export, ROM patches."""
import asyncio, sys
from playwright.async_api import async_playwright
URL = 'file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'; R = []
def rec(n, ok, note=''): R.append(bool(ok)); print('PASS' if ok else 'FAIL', n, note)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': 1500, 'height': 1100})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.goto(URL); await pg.wait_for_timeout(400)
        await pg.evaluate("() => document.querySelectorAll('.modalbg').forEach(m => m.remove())")
        await pg.evaluate("() => { P = JSON.parse(JSON.stringify(EXAMPLE)); tab='recipes'; renderAll(); }")
        rec('recipes tab renders', await pg.evaluate("() => document.body.innerText.includes('Every useful number')"))
        rec('recipe cards present', await pg.evaluate("() => document.querySelectorAll('.card button.go, .card button.alt').length > 5"))
        before = await pg.evaluate("() => JSON.stringify(P.meta.physics || null)")
        await pg.evaluate("() => { const b=[...document.querySelectorAll('.card')].find(c=>c.querySelector('small') && c.innerText.includes('fits')); b.querySelector('button').click(); }")
        await pg.wait_for_timeout(200)
        rec('report modal shown', await pg.evaluate("() => !!document.querySelector('.modalbg')"))
        log = await pg.evaluate("() => (P.recipeLog||[]).length"); rec('log recorded', log == 1, str(log))
        await pg.evaluate("() => document.querySelectorAll('.modalbg').forEach(m => m.remove())")
        await pg.click("button:has-text('Undo last recipe')"); await pg.wait_for_timeout(100)
        after = await pg.evaluate("() => JSON.stringify(P.meta.physics || null)")
        rec('undo restores settings', (before if before != '{}' else 'null') == (after if after != '{}' else 'null'), before + ' / ' + after)
        # frankenstein
        await pg.evaluate("() => { RCS.onlyFit = false; renderAll(); }")
        await pg.evaluate("() => { document.querySelectorAll('.tech input[type=checkbox]')[0].click(); document.querySelectorAll('.tech input[type=checkbox]')[1].click(); }")
        await pg.evaluate("() => document.querySelectorAll('.modalbg').forEach(m => m.remove())"); await pg.fill("input[placeholder='Name your recipe']", 'Steve mix'); await pg.click("button:has-text('Save as my recipe')"); await pg.wait_for_timeout(100)
        rec('own recipe saved', await pg.evaluate("() => P.recipes.length === 1 && P.recipes[0].name === 'Steve mix'"))
        # nav: advanced hidden until toggled
        vis = await pg.evaluate("() => { const g=[...document.querySelectorAll('.grpbtn')].find(b=>b.dataset.grp==='Advanced'); return g.style.display; }")
        rec('advanced hidden by default', vis == 'none', vis)
        await pg.evaluate("() => document.querySelectorAll('.modalbg').forEach(m => m.remove())"); await pg.click('#advtoggle'); await pg.wait_for_timeout(100)
        vis = await pg.evaluate("() => { const g=[...document.querySelectorAll('.grpbtn')].find(b=>b.dataset.grp==='Advanced'); return g.style.display; }")
        rec('advanced shown after toggle', vis != 'none', vis)
        await pg.evaluate("() => { tab='advanced'; renderAll(); }")
        rec('advanced renders', await pg.evaluate("() => document.body.innerText.toLowerCase().includes('engine code')"))
        # settings JSON roundtrip
        ok = await pg.evaluate("() => { const o = NRRecipes.describe(P); return NRRecipes.setFromDescribe(P, o) >= 0; }"); rec('settings JSON roundtrip', ok)
        # code override
        rec('code splits into parts', await pg.evaluate("() => Object.keys(srcParts()).length === 20"))
        rec('no override = original sources', await pg.evaluate("() => effectiveSources() === KITSRC"))
        await pg.evaluate("() => { P.advanced.code.nrmusic = KITSRC.nrmusic + '\\n/*MYEDIT*/'; }")
        rec('override used', await pg.evaluate("() => effectiveSources().nrmusic.includes('MYEDIT') && effectiveSources().nrarcade === KITSRC.nrarcade"))
        await pg.evaluate("() => { P.advanced.code = {}; }")
        # patches
        r = await pg.evaluate("() => { P.advanced.patches=[{offset:'2',bytes:'AA BB',on:true},{offset:'ff',bytes:'11',on:false}]; const o = applyPatches(new Uint8Array(8)); return Array.from(o).join(','); }")
        rec('patch applied (disabled one skipped)', r == '0,0,170,187,0,0,0,0', r)
        r = await pg.evaluate("() => Array.from(patchesToIPS(P.advanced.patches.slice(0,1))).join(',')")
        rec('ips bytes', r == '80,65,84,67,72,0,0,2,0,2,170,187,69,79,70', r)
        rec('minigames label', await pg.evaluate("() => NAV_LABELS.arcade.includes('Minigames')"))
        rec('no page errors', not errs, str(errs[:2]))
        await b.close()
    print(sum(R), '/', len(R)); sys.exit(0 if all(R) else 1)
asyncio.run(main())

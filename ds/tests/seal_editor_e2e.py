#!/usr/bin/env python3
"""Sixth Seal panel, wrestling checkbox, basketball template, About tab."""
import asyncio, sys
from playwright.async_api import async_playwright
URL = 'file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'; R = []
def rec(n, ok, note=''): R.append(bool(ok)); print('PASS' if ok else 'FAIL', n, note)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1500, 'height': 1100}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.goto(URL); await pg.wait_for_timeout(400)
        rm = "() => document.querySelectorAll('.modalbg').forEach(m => m.remove())"
        await pg.evaluate(rm); await pg.evaluate("() => { P = JSON.parse(JSON.stringify(EXAMPLE)); tab='sigil'; renderAll(); }")
        rec('seal panel renders', await pg.evaluate("() => document.body.innerText.includes('Sixth Seal')"))
        for i in range(6):
            await pg.evaluate("(i) => { const sel=[...document.querySelectorAll('details select')].filter(s=>s.options[0].text.includes('preset'))[i]; sel.value=String(i); sel.dispatchEvent(new Event('change')); }", i); await pg.wait_for_timeout(80); await pg.evaluate(rm)
        rec('six slots fill and unlock', await pg.evaluate("() => P.sixthseal.prog.hollow && NRSixthSeal.filled(P.sixthseal.tape) === 6"))
        rec('battle + gig UI visible after unlock', await pg.evaluate("() => document.body.innerText.includes('Saturday DJ gig')"))
        await pg.click("button:has-text('Play the gig')"); await pg.wait_for_timeout(100)
        rec('gig paid', await pg.evaluate("() => P.sixthseal.prog.cash > 0 && P.sixthseal.prog.gigs === 1")); await pg.evaluate(rm)
        # wrestling
        await pg.evaluate("() => { const r = NRTemplates.apply('wrestling', JSON.parse(JSON.stringify(EXAMPLE)), { console: 'pc', title: 'W' }); P = r.project; tab='fight'; renderAll(); }")
        rec('wrestling template turns moveset on', await pg.evaluate("() => P.fight.moveset === true && P.fight.fighters[0].finisher === 'jabronidriver'"))
        rec('moveset checkbox + finisher picker', await pg.evaluate("() => document.body.innerText.includes('Pro-wrestling moveset') && document.body.innerText.includes('finisher')"))
        # basketball
        r = await pg.evaluate("() => { const r = NRTemplates.apply('basketball', JSON.parse(JSON.stringify(EXAMPLE)), { console: 'pc', title: 'B' }); return r.project.arcade.mode; }"); rec('basketball template mode', r == 'basketball', r)
        # about
        await pg.evaluate("() => { tab='about'; renderAll(); }"); rec('about tab', await pg.evaluate("() => document.body.innerText.includes('About Notareal Game Studio')"))
        rec('no page errors', not errs, str(errs[:2])); await b.close()
    print(sum(R), '/', len(R)); sys.exit(0 if all(R) else 1)
asyncio.run(main())

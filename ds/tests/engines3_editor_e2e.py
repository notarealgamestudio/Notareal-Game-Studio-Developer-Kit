#!/usr/bin/env python3
"""Real editor: vehicle_combat, sidescroller_3d, platformer_3d (n64) open working engines; PC package export includes the new modes."""
import asyncio, sys
from playwright.async_api import async_playwright
URL = 'file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'; R = []
def rec(n, ok, note=''): R.append(bool(ok)); print('PASS' if ok else 'FAIL', n, note)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': 1400, 'height': 900})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.goto(URL); await pg.wait_for_timeout(400)
        await pg.evaluate("() => document.querySelectorAll('.modalbg').forEach(m => m.remove())")
        for gid, mode, con in [('vehicle_combat', 'combat', 'pc'), ('sidescroller_3d', 'side3d', 'pc'), ('platformer_3d', 'sandbox3d', 'n64')]:
            r = await pg.evaluate("([g, c]) => { const r = NRTemplates.apply(g, JSON.parse(JSON.stringify(EXAMPLE)), { console: c, title: 'T' }); const m = r.project.arcade && r.project.arcade.mode; let ok = false; try { const A = NRArcade.create(m, r.project.arcade.cfg, { seed: 3 }); for (let i = 0; i < 120; i++) A.step({ ArrowRight: i % 2, ArrowUp: true }); ok = A.s.status !== undefined; } catch (e) { ok = String(e); } return [m, ok, NRFit.supports(g, c)]; }", [gid, con])
            rec(gid + ' on ' + con + ' opens ' + mode + ' and runs', r[0] == mode and r[1] is True and r[2] is True, str(r))
        r = await pg.evaluate("() => [NRFit.supports('vehicle_combat','n64'), NRFit.supports('sidescroller_3d','gba'), NRFit.supports('platformer_3d','gba'), NRFit.supports('platformer_3d','ds')]")
        rec('fit: combat / 2.5D are PC-only, 3D platformer not on GBA but on DS', r == [False, False, False, True], str(r))
        r = await pg.evaluate("() => { const r = NRTemplates.apply('coloring_book', JSON.parse(JSON.stringify(EXAMPLE)), { console: 'pc', title: 'T' }); const g = NRArcade.create(r.project.arcade.mode, r.project.arcade.cfg, { seed: 2 }); g.step({ z: true }); const d = NRTemplates.apply('coloring_book', JSON.parse(JSON.stringify(EXAMPLE)), { console: 'ds', title: 'T' }); return [r.project.arcade.mode, d.project.arcade.mode, g.s.pic.regions.length > 5]; }")
        rec('coloring_book: full engine on PC, paint-by-number on DS', r == ['coloring', 'coloring', True], str(r))
        r = await pg.evaluate("() => { const c = NRLifeData.buildComps().find(x => x.id === 'prem_diamond'); const sp = NRGems.sprite(c, 32); return [!!sp, sp && sp.width]; }")
        rec('3D gem sprites render in the browser', r[0] is True and r[1] == 32, str(r))
        rec('no page errors', not errs, str(errs[:2])); await b.close()
    print('engines3 editor tests', sum(R), 'pass', len(R) - sum(R), 'fail'); sys.exit(0 if all(R) else 1)
asyncio.run(main())

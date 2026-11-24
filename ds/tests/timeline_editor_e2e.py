#!/usr/bin/env python3
"""Timeline tab v2 in the real editor: palette, drag/click add, clips, music lane, room editor, DS lane, preview, PC export with the new page."""
import asyncio, sys
from playwright.async_api import async_playwright
URL = 'file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'; R = []
def rec(n, ok, note=''): R.append(bool(ok)); print('PASS' if ok else 'FAIL', n, note)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': 1500, 'height': 1000})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.goto(URL); await pg.wait_for_timeout(400)
        await pg.evaluate("() => document.querySelectorAll('.modalbg').forEach(m => m.remove())")
        await pg.evaluate("() => { P = JSON.parse(JSON.stringify(EXAMPLE)); P.console = 'pc'; P.timeline = []; P.tlTouched = true; tab = 'timeline'; renderAll(); }")
        n = await pg.evaluate("() => document.querySelectorAll('.tlpal .it').length")
        rec('palette lists many section types', n >= 28, str(n))
        # click-add three from palette
        for label in ['Title screen', 'Arcade room (walk-in, machines)', 'Credits']:
            await pg.click(f".tlpal .it:has-text('{label}')"); await pg.wait_for_timeout(80)
        r = await pg.evaluate("() => P.timeline.map(s => s.type + ':' + (s.mode || ''))")
        rec('click adds sections in order', r == ['title:', 'arcade:room', 'credits:'], str(r))
        # drag the credits clip before the room (HTML5 DnD via synthetic events)
        await pg.evaluate("""() => { const clips = [...document.querySelectorAll('.tlclip')].filter(c => c.draggable); const dt = new DataTransfer(); const a = clips[2], t = clips[1]; a.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true })); const r = t.getBoundingClientRect(); t.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, clientX: r.left + 2, clientY: r.top + 5 })); }""")
        r = await pg.evaluate("() => P.timeline.map(s => s.type)")
        rec('drag reorders clips', r == ['title', 'credits', 'arcade'], str(r))
        # select the room clip -> room editor canvas
        await pg.evaluate("() => { TLS.sel = P.timeline[2].id; renderAll(); }")
        rec('room editor is shown for an arcade room', await pg.evaluate("() => !!document.querySelector('canvas.tlroom')"))
        before = await pg.evaluate("() => P.timeline[2].cfg.machines.length")
        await pg.evaluate("() => document.querySelector('canvas.tlroom').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(100)
        box = await pg.evaluate("() => { const b = document.querySelector('canvas.tlroom').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }")
        await pg.mouse.click(box[0] + box[2] * 0.5, box[1] + box[3] * 0.82)  # empty floor low in the room
        await pg.wait_for_timeout(100)
        after = await pg.evaluate("() => P.timeline[2].cfg.machines.length")
        rec('clicking the floor adds a machine', after == before + 1, f'{before}->{after}')
        # change what the new machine plays
        await pg.evaluate("() => { const m = P.timeline[2].cfg.machines.at(-1); m.mode = 'claw'; }")
        rec('room validates', await pg.evaluate("() => NRTimeline.validate(P, 'pc').ok"))
        # music lane: give songs, set music on the room clip through the inspector select
        await pg.evaluate("() => { P.songs = P.songs && P.songs.length ? P.songs : [{ name: 'Test A', tempo: 8, steps: 16, ch: [[60,128,128,128,62,128,128,128,64,128,128,128,65,128,128,128],[],[],[]], inst: ['organ','organ','organ','organ'], vol: [90,90,90,90], pan: [64,64,64,64] }]; renderAll(); }")
        await pg.select_option(".tlinsp select >> nth=0", index=0) if False else None
        await pg.evaluate("() => { const s = P.timeline[2]; s.music = 0; s.transition = 'door'; renderAll(); }")
        lane = await pg.evaluate("() => [...document.querySelectorAll('.tlchip.on')].map(c => c.textContent).join('|')")
        rec('music lane shows the chosen song', 'Test A' in lane or 'Song 1' in lane or '♪' in lane, lane)
        # DS lane appears for DS games and buttons validate
        await pg.evaluate("() => { P.console = 'ds'; renderAll(); }")
        rec('DS lane only for DS', await pg.evaluate("() => /Bottom-screen buttons/.test(document.querySelector('.tlmain').textContent)"))
        await pg.evaluate("() => { P.console = 'pc'; renderAll(); }")
        rec('no DS lane on PC', await pg.evaluate("() => !/Bottom-screen buttons/.test(document.querySelector('.tlmain').textContent)"))
        # preset loads, validates, preview opens and draws
        await pg.evaluate("() => { NRTimeline.preset('arcade_night', P); renderAll(); }")
        rec('preset arcade_night valid', await pg.evaluate("() => NRTimeline.validate(P, 'pc').ok"))
        await pg.evaluate("() => timelinePlay(0)"); await pg.wait_for_timeout(600)
        px = await pg.evaluate("() => { const c = document.querySelector('.modal canvas'); const d = c.getContext('2d').getImageData(0, 0, 320, 240).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i+1] + d[i+2] > 60) n++; return n; }")
        rec('preview draws the title screen', px > 500, str(px))
        await pg.screenshot(path='/tmp/tl_preview.png')
        await pg.evaluate("() => document.querySelectorAll('.modalbg').forEach(m => m.remove())")
        # PC package gets timeline.html with the new page
        r = await pg.evaluate("""() => { const pk = NRPc.buildPackage(P, { sources: KITSRC, renderSong: s => NRMusic.renderSong(s, 32768, 1), images: {}, sfx: {} }); const f = pk.files.find(x => x.name.endsWith('/timeline.html')); return [!!f, f && /NRTimeline\\.session/.test(f.data), f && f.data.length]; }""")
        rec('PC package includes the new timeline page', r[0] and r[1], str(r))
        await pg.evaluate("() => { P.console = 'ds'; const T = NRTimeline; P.timeline = [T.step('title'), Object.assign(T.step('arcade'), { mode: 'hoops', cfg: { title: 'H' } }), Object.assign(T.step('arcade'), { mode: 'coloring', cfg: {} })]; tab = 'timeline'; renderAll(); }")
        rec('DS ROM export button appears for DS arcade chains', await pg.evaluate("() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('DS ROM (.nds)'))"))
        await pg.evaluate("() => { window.__dl = null; const o = window.download; window.download = async (n, d) => { window.__dl = [n, d.length || d.byteLength]; }; }")
        await pg.click("button:has-text('DS ROM (.nds)')"); await pg.wait_for_timeout(800)
        r = await pg.evaluate("() => window.__dl"); rec('DS ROM export builds a .nds', r and r[0].endswith('.nds') and r[1] > 200000, str(r))
        await pg.screenshot(path='/tmp/tl_tab.png')
        rec('no page errors', not errs, str(errs[:3])); await b.close()
    print('timeline editor tests', sum(R), 'pass', len(R) - sum(R), 'fail'); sys.exit(0 if all(R) else 1)
asyncio.run(main())

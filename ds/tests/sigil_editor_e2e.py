#!/usr/bin/env python3
"""Sigil Studio in the real editor (headless Chromium): music maker template opens the tab, grid editing, preview renders audio, WAV/.msig/ROM export, .msig re-import."""
import asyncio, subprocess, sys
from playwright.async_api import async_playwright
URL = 'file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'; R = []
def rec(n, ok, note=''): R.append(bool(ok)); print('PASS' if ok else 'FAIL', n, note)
async def clr(pg): await pg.evaluate("() => document.querySelectorAll('.modalbg').forEach(m => m.remove())")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); ctx = await b.new_context(viewport={'width': 1400, 'height': 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.goto(URL); await pg.wait_for_timeout(400); await clr(pg)
        await pg.evaluate("""() => { const r = NRTemplates.apply('music_maker', JSON.parse(JSON.stringify(EXAMPLE)), {}); P = r.project; tab = r.tab; renderAll(); }""")
        rec('music maker opens the Sigil tab', await pg.evaluate("() => tab === 'sigil' && !!P.sigil"))
        rec('tab content is not blank', await pg.evaluate("() => document.querySelectorAll('#main select').length > 20 && /Sigil Studio/.test(document.querySelector('#main').innerText)"))
        rec('Game Studio group lists Sigil', await pg.evaluate("() => studioTabs().includes('sigil')"))
        before = await pg.evaluate("() => JSON.stringify(P.sigil.pat[0][2])")
        await pg.evaluate("() => { const c = [...document.querySelectorAll('#main div')].filter(d => d.style.cursor === 'pointer'); c[2 * 16 + 5].dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }")
        rec('clicking a grid cell edits the pattern', await pg.evaluate("(b) => JSON.stringify(P.sigil.pat[0][2]) !== b", before))
        rec('preview renders audio', await pg.evaluate("async () => { const r = NRSigil.renderWav(P.sigil, { bars: 2 }); return r.hits > 10 && r.seconds > 2; }"))
        await pg.evaluate("() => { P.sigil.bpm = 133; P.sigil.name = 'E2E SONG'; renderAll(); }")
        async with pg.expect_download() as d: await clr(pg); await pg.click('text=⬇ .msig')
        dl = await d.value; path = '/tmp/e2e_song.msig'; await dl.save_as(path)
        rec('.msig downloads and the DS codec reads it', open(path, 'rb').read()[:4] == b'MSIG' and subprocess.run(['node', '-e', f"const S=require('./kit/nrsigil.js');const r=S.unpack(new Uint8Array(require('fs').readFileSync('{path}')));process.exit(r.ok===0&&r.proj.bpm===133&&r.proj.name==='E2E SONG'?0:1)"], cwd='/home/claude/notareal-kit/ds').returncode == 0)
        async with pg.expect_download() as d: await clr(pg); await pg.click('text=⬇ WAV')
        dl = await d.value; await dl.save_as('/tmp/e2e_song.wav'); rec('WAV downloads', open('/tmp/e2e_song.wav', 'rb').read()[:4] == b'RIFF')
        async with pg.expect_download() as d: await clr(pg); await pg.click('text=⬇ Export DS ROM')
        dl = await d.value; await dl.save_as('/tmp/e2e_sigil.nds'); rom = open('/tmp/e2e_sigil.nds', 'rb').read()
        rec('DS ROM exports with the song inside', len(rom) > 250000 and b'MSIG' in rom and b'E2E SONG' in rom)
        async with pg.expect_file_chooser() as fc: await clr(pg); await pg.click('text=⬆ Open .msig')
        await (await fc.value).set_files(path); await pg.wait_for_timeout(200)
        rec('.msig re-imports', await pg.evaluate("() => P.sigil.bpm === 133"))
        rec('no page errors', not errs, str(errs[:2]))
        await b.close()
    print('sigil editor tests', sum(R), 'pass', len(R) - sum(R), 'fail'); sys.exit(0 if all(R) else 1)
asyncio.run(main())

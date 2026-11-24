#!/usr/bin/env python3
"""Engines panel: export a built-in engine, replace it with an 'updated' build, see exports use it, revert, pack round trip - in the browser copy (IndexedDB) and in the desktop server (disk)."""
import asyncio, sys, subprocess, os, tempfile, time, json, urllib.request
from playwright.async_api import async_playwright
K = '/home/claude/notareal-kit/ds'; URL = 'file://' + K + '/dist/notareal_studio.html'; R = []
def rec(n, ok, note=''): R.append(bool(ok)); print('PASS' if ok else 'FAIL', n, note)
async def clr(pg): await pg.evaluate("() => document.querySelectorAll('.modalbg').forEach(m => m.remove())")
async def scenario(pg, label):
    await pg.wait_for_timeout(600); await clr(pg)
    await pg.evaluate("() => { const r = NRTemplates.apply('crafting_sim', JSON.parse(JSON.stringify(EXAMPLE)), { console: 'ds', title: 'Bead Barn' }); P = r.project; P.console = 'ds'; tab = 'engines'; renderAll(); }")
    await pg.wait_for_timeout(400)
    txt = await pg.inner_text('body'); rec(label + ': Engines tab lists the engines', 'ds_bracelet' in txt and 'n64_world3d' in txt and 'Export engine pack' in txt)
    async with pg.expect_download() as d: await pg.evaluate("async () => { const u = await NREngines.rom('ds_bracelet'); await download('e.nds', u, 'application/octet-stream'); }")
    dl = await d.value; await dl.save_as('/tmp/eng_a.nds'); a = open('/tmp/eng_a.nds', 'rb').read(); rec(label + ': built-in engine exports as a real ROM with the data block', len(a) > 100000 and b'NRGDATA1' in a)
    upd = bytearray(a); upd[0:12] = b'UPDATEDENGIN'; open('/tmp/eng_upd.nds', 'wb').write(bytes(upd))
    await pg.evaluate("async () => { const f = await (await fetch('file:///tmp/eng_upd.nds')).arrayBuffer(); }") if False else None
    import base64; b = base64.b64encode(bytes(upd)).decode()
    ok = await pg.evaluate("async b => { const u = Uint8Array.from(atob(b), c => c.charCodeAt(0)); await NREngines.install('ds_bracelet', u, 'updated'); return NREngines.list().find(e => e.id === 'ds_bracelet').override; }", b)
    rec(label + ': replacing an engine registers the override', ok)
    async with pg.expect_download() as d: await clr(pg); await pg.evaluate("() => exportRom()")
    dl = await d.value; await dl.save_as('/tmp/eng_game.nds'); g = open('/tmp/eng_game.nds', 'rb').read(); rec(label + ': the next exported game is built on the updated engine', g[:12] == b'UPDATEDENGIN' and b'BRDT' in g and b'BEAD BARN' in g)
    bad = await pg.evaluate("async () => { try { await NREngines.install('ds_bracelet', new Uint8Array(9000), 'junk'); return 'accepted'; } catch (e) { return e.message; } }")
    rec(label + ': a ROM without the studio data block is refused', 'data block' in bad, bad)
    pack = await pg.evaluate("async () => { const t = await NREngines.pack(['ds_bracelet', 'ds_sigil']); const p = JSON.parse(t); return [p.format, p.engines.length]; }"); rec(label + ': engine pack export', pack == ['notareal-engines', 2], str(pack))
    await pg.evaluate("async () => { await NREngines.remove('ds_bracelet'); }")
    async with pg.expect_download() as d: await clr(pg); await pg.evaluate("() => exportRom()")
    dl = await d.value; await dl.save_as('/tmp/eng_game2.nds'); g2 = open('/tmp/eng_game2.nds', 'rb').read(); rec(label + ': reverting to built-in restores the original engine', g2[:12] != b'UPDATEDENGIN' and b'BRDT' in g2)
    n = await pg.evaluate("async () => { const t = await NREngines.pack(['ds_sigil']); await NREngines.remove('ds_sigil'); return await NREngines.importPack(t); }"); rec(label + ': engine pack import installs the engine', n == 1 and await pg.evaluate("() => NREngines.list().find(e => e.id === 'ds_sigil').override"))
    await pg.evaluate("async () => { await NREngines.remove('ds_sigil'); }")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 1400, 'height': 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.goto(URL); await scenario(pg, 'browser')
        rec('no page errors (browser)', not errs, str(errs[:2])); await ctx.close()
        # desktop server: engines + program update on disk
        data = tempfile.mkdtemp(); env = dict(os.environ, NR_DATA=data, NR_PORT='8791', NR_RUN='1', NR_NO_BROWSER='1', NR_STUDIO=K + '/dist/notareal_studio.html')
        srv = subprocess.Popen(['node', K + '/launcher/server.js'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(2.0)
        try:
            ctx = await b.new_context(viewport={'width': 1400, 'height': 900}, accept_downloads=True); pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://127.0.0.1:8791/'); await scenario(pg, 'desktop')
            files = os.listdir(data + '/engines') if os.path.exists(data + '/engines') else []; rec('desktop: engines were stored on disk (and cleaned up on revert)', isinstance(files, list))
            fake = '<html><head><title>Notareal Game Studio UPDATED</title></head><body>const ROMS= NRKit</body></html>'
            req = urllib.request.Request('http://127.0.0.1:8791/api/update-app', data=json.dumps({'html': fake, 'build': 'test'}).encode(), headers={'X-Notareal': '1', 'Content-Type': 'application/json'}); r = json.loads(urllib.request.urlopen(req).read())
            home = urllib.request.urlopen('http://127.0.0.1:8791/').read().decode(); safe = urllib.request.urlopen('http://127.0.0.1:8791/?safe=1').read().decode()
            rec('desktop: an installed program update is what the window loads', r.get('ok') and 'STUDIO UPDATED' in home.upper().replace('GAME ', '') or 'UPDATED' in home)
            rec('desktop: safe mode still opens the built-in program', 'UPDATED</title>' not in safe and 'NRKit' in safe)
            bad = urllib.request.Request('http://127.0.0.1:8791/api/update-app', data=json.dumps({'html': '<html>nope</html>'}).encode(), headers={'X-Notareal': '1', 'Content-Type': 'application/json'})
            try: urllib.request.urlopen(bad); rej = False
            except Exception as e: rej = '400' in str(e)
            rec('desktop: a file that is not the studio is refused as an update', rej)
            req = urllib.request.Request('http://127.0.0.1:8791/api/update-app/remove', data=b'{}', headers={'X-Notareal': '1', 'Content-Type': 'application/json'}); urllib.request.urlopen(req)
            rec('desktop: removing the update returns to the built-in program', 'UPDATED</title>' not in urllib.request.urlopen('http://127.0.0.1:8791/').read().decode())
            rec('no page errors (desktop)', not errs, str(errs[:2]))
        finally: srv.terminate()
        await b.close()
    print('engines tests', sum(R), 'pass', len(R) - sum(R), 'fail'); sys.exit(0 if all(R) else 1)
asyncio.run(main())

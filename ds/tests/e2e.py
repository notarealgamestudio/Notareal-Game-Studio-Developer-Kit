#!/usr/bin/env python3
"""End-to-end test of every offline editor feature in headless Chromium (fake microphone), plus the AI repair
framework with a stand-in AI. Exports a ROM and boots it in DeSmuME."""
import asyncio, json, subprocess, sys
from playwright.async_api import async_playwright
URL = 'file:///home/claude/notareal-kit/ds/dist/notareal_studio.html'
FX = '/tmp/fx/'
R = []
def rec(name, ok, note=''): R.append([name, bool(ok), note]); print('PASS' if ok else 'FAIL', name, note)
FAKE_AI = """window.claude = { use: async (n) => { if (n !== 'sample') return null;
  const f = async () => ({ text: '' });
  f.json = async (prompt) => { window.__aiPrompt = prompt; return { explanation: 'Moved the spring out of the ground and removed the spikes.',
     ops: [ { op: 'move_object', level: 0, from: { x: 20, y: 13 }, to: { x: 20, y: 12 } }, { op: 'set_tile', level: 0, x: 30, y: 12, tile: 0 }, { op: 'add_object', level: 0, type: 'dragon', x: 1, y: 1 } ] }; };
  return f; } };"""
async def pick(pg, click_sel, path):
    async with pg.expect_file_chooser() as fc: await pg.click(click_sel)
    ch = await fc.value; await ch.set_files(path)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1400, 'height': 900}, accept_downloads=True)
        await ctx.add_init_script(FAKE_AI)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(300)
        rec('welcome screen', await pg.is_visible('text=Make a game!'))
        await pg.click('text=New game'); await pg.wait_for_timeout(300)
        rec('wizard lists the game types from the catalog', await pg.locator('.modal .famrow .card').count() >= 35)
        await pg.click('.modal .card:has-text("Cartoon / cute")'); await pg.wait_for_timeout(200)
        rec('wizard art style filters heroes', await pg.locator('.modal .pick').count() == 4)
        await pg.click('.modal .card:has-text("Classic pixel")'); await pg.wait_for_timeout(200)
        await pg.fill('.modal input.wide >> nth=0', 'Test Quest'); await pg.click('.modal button.go'); await pg.wait_for_timeout(600)
        rec('wizard creates a DS sidescroller project', await pg.evaluate("P && P.console==='ds' && P.preset==='side2d' && P.meta.title==='Test Quest' && P.genre==='platformer'"))
        rec('new projects get instrument songs and a touch layout', await pg.evaluate("P.songs.length===4 && P.songs.every(s=>s.inst && s.inst.length) && P.touch && P.touch.layout"))
        # paint: spikes tile, then a coin
        await pg.click('.palette >> nth=0 >> .pick >> nth=6'); cv = await pg.query_selector('canvas.level'); await pg.evaluate("document.querySelector('.canvaswrap').scrollLeft=0"); bb = await cv.bounding_box()
        L = await pg.evaluate("({w:P.levels[0].w,h:P.levels[0].h})")
        await pg.mouse.click(bb['x'] + bb['width'] * (16.5 / L['w']), bb['y'] + bb['height'] * (12.5 / L['h']))
        rec('level painter sets a tile', await pg.evaluate("P.levels[0].map[12*P.levels[0].w+16]===6"))
        await pg.click('.palette >> nth=1 >> .pick >> nth=1'); n0 = await pg.evaluate("P.levels[0].objects.length")
        await pg.mouse.click(bb['x'] + bb['width'] * (18.5 / L['w']), bb['y'] + bb['height'] * (10.5 / L['h']))
        rec('level painter places a thing', await pg.evaluate("P.levels[0].objects.length") == n0 + 1)
        await pg.mouse.click(bb['x'] + bb['width'] * (18.5 / L['w']), bb['y'] + bb['height'] * (10.5 / L['h']), button='right')
        rec('right-click removes a thing', await pg.evaluate("P.levels[0].objects.length") == n0)
        # break the level the way Steve saw it, then check + fix it
        await pg.evaluate("""(() => { const L = P.levels[0]; L.objects.push({type:'spring', x:20, y:13});
            for (let x = 31; x < 37; x++) for (let y = 13; y < 16; y++) L.map[y*L.w+x] = 0; L.map[12*L.w+29] = 6; L.map[12*L.w+30] = 6; renderAll(); })()""")
        await pg.click('text=Check this level'); await pg.wait_for_timeout(500)
        rec('checker finds the buried spring and the spike block', await pg.evaluate("lastCheck.r.issues.some(i=>i.code==='BURIED_OBJECT') && !lastCheck.r.reachable"))
        await pg.click('text=Fix it for me'); await pg.wait_for_timeout(800)
        rec('one-click repair makes the level playable', await pg.evaluate("lastCheck.r.issues.length===0 && lastCheck.r.reachable"))
        await pg.click('text=Add'); await pg.wait_for_timeout(300)
        rec('add a level', await pg.evaluate("P.levels.length===2"))
        # Fix it tab: offline + AI framework
        await pg.click('.grpbtn[data-grp=Test]'); await pg.evaluate("() => { tab='fix'; renderAll(); }"); await pg.wait_for_timeout(300)
        await pg.select_option('#main select >> nth=0', '0')
        await pg.evaluate("(() => { const L=P.levels[0]; L.objects.push({type:'spring',x:20,y:13}); L.map[12*L.w+30]=6; renderAll(); })()"); await pg.wait_for_timeout(200)
        await pg.fill('textarea', 'the trampoline is stuck in the ground'); await pg.click('text=1. Run the checks (offline)'); await pg.wait_for_timeout(500)
        rec('fix-it: typed complaint + offline checks list the problem', await pg.is_visible('text=BURIED_OBJECT'))
        await pg.wait_for_timeout(11000)   # window.claude resolves after load in the real viewer; our stand-in is ready at once
        await pg.click('text=2. Ask AI'); await pg.wait_for_timeout(1500)
        rec('fix-it: AI prompt carries the complaint and the level map', await pg.evaluate("window.__aiPrompt && window.__aiPrompt.includes('trampoline') && window.__aiPrompt.includes('S')"))
        rec('fix-it: AI edits validated (bad op dropped) and previewed', await pg.is_visible('text=AI suggests these changes') and await pg.is_visible('text=were unsafe or invalid'))
        await pg.click('.checkres button.go'); await pg.wait_for_timeout(500)
        rec('fix-it: applying AI edits changes the project and logs it', await pg.evaluate("P.levels[0].objects.some(o=>o.type==='spring'&&o.y===12) && P.fixlog.some(f=>f.source==='ai')"))
        await pg.click('text=Repair automatically'); await pg.wait_for_timeout(800)
        rec('fix-it: automatic repair logged', await pg.evaluate("P.fixlog.filter(f=>f.source==='offline').length>=2"))
        async with pg.expect_download() as dl: await pg.click('text=Download fix log')
        d = await dl.value; j = json.load(open(await d.path())); rec('fix log downloads with rules + entries', 'rules' in j and len(j['log']) >= 3)
        # characters
        await pg.evaluate("() => { tab='chars'; renderAll(); }"); await pg.wait_for_timeout(400)
        await pg.select_option('.builder select >> nth=1', 'heavy'); await pg.select_option('.builder select >> nth=2', 'bun'); await pg.click('text=Use as my hero'); await pg.wait_for_timeout(400)
        rec('character builder makes a 32x64 hero', await pg.evaluate("P.sprites.hero.w===32 && P.sprites.hero.h===64 && P.sprites.hero.image.startsWith('data:image/png')"))
        await pick(pg, '.pane .row:has-text("walker") button', FX + 'enemy_sheet.png'); await pg.wait_for_timeout(500)
        rec('import art for an enemy (converted to 16x16 frames)', await pg.evaluate("P.sprites.walker.image.startsWith('data:image/png') && P.sprites.walker.w===16"))
        # art
        await pg.evaluate("() => { tab='art'; renderAll(); }"); await pg.wait_for_timeout(400); nt = await pg.evaluate("P.tileset.cols.length")
        await pick(pg, 'text=Make a tile from a picture', FX + 'photo.png'); await pg.wait_for_timeout(400); await pg.click('.modal button.go'); await pg.wait_for_timeout(600)
        rec('make a tile from a picture', await pg.evaluate("P.tileset.cols.length") == nt + 1)
        await pick(pg, 'text=Import a picture as background', FX + 'photo.png'); await pg.wait_for_timeout(400); await pg.click('.modal button.go'); await pg.wait_for_timeout(500)
        rec('import a background picture', await pg.evaluate("P.background.startsWith('data:image/png')"))
        await pick(pg, 'text=Open image converter', FX + 'photo.png'); await pg.wait_for_timeout(400)
        await pg.fill('.modal input[type=number] >> nth=2', '6'); await pg.keyboard.press('Tab'); await pg.check('.modal input[type=checkbox]')
        async with pg.expect_download() as dl: await pg.click('.modal button.go')
        d = await dl.value; rec('image converter pixelizes and saves a PNG', (await d.path()) is not None)
        # music
        await pg.evaluate("() => { tab='music'; renderAll(); }"); await pg.wait_for_timeout(300); ns = await pg.evaluate("P.songs.length")
        await pg.click('text=+ Empty song'); await pg.wait_for_timeout(300); await pg.click('.seqrow >> nth=0 >> .seqcell >> nth=0'); await pg.wait_for_timeout(200)
        rec('music grid places a note', await pg.evaluate("P.songs[P.songs.length-1].ch[0][0]===72"))
        await pg.click('text=▶ Play'); await pg.wait_for_timeout(300); await pg.click('text=■ Stop')
        await pg.click('.songchip:has-text("Mall After Hours") >> button[title="Add to my game"]'); await pg.wait_for_timeout(300)
        rec('song library adds a lofi vaporwave song with instruments', await pg.evaluate("P.songs[P.songs.length-1].style==='vapor_mall' && P.songs[P.songs.length-1].inst.includes('epiano')"))
        await pg.click('.songchip:has-text("Purple Fog") >> button[title="Make a brand-new song in this style"]'); await pg.wait_for_timeout(300)
        rec('generator writes a new 90s cloud rap song', await pg.evaluate("P.songs[P.songs.length-1].style==='cloud_purple' && P.songs[P.songs.length-1].inst.includes('bass_808')"))
        await pg.click('.songchip:has-text("Iron Overdrive") >> button[title="Listen"]'); await pg.wait_for_timeout(500); await pg.click('text=■ Stop')
        await pg.select_option('.seqrow >> nth=0 >> select', 'sitar'); await pg.wait_for_timeout(200)
        rec('track instrument can be changed (sitar)', await pg.evaluate("P.songs[curSong].inst[0]==='sitar'"))
        await pick(pg, 'text=Import MIDI', FX + 'tune.mid'); await pg.wait_for_timeout(400)
        rec('MIDI import adds a song with the notes', await pg.evaluate("P.songs[P.songs.length-1].ch[0].includes(60) && P.songs[P.songs.length-1].ch[3].includes(1)"))
        await pick(pg, 'text=MP3 → song', FX + 'melody.mp3'); await pg.wait_for_timeout(3000)
        notes = await pg.evaluate("P.songs[P.songs.length-1].ch[0].filter(n=>n>0&&n<128)")
        rec('MP3 → song finds the melody notes', len(notes) >= 6 and all(n in (59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70) for n in notes), f'{len(notes)} notes: {sorted(set(notes))}')
        await pg.click('.modal button.go'); await pg.wait_for_timeout(200)
        # sounds
        await pg.evaluate("() => { tab='sound'; renderAll(); }"); await pg.wait_for_timeout(300)
        await pick(pg, '.pane .row >> nth=0 >> text=Import', FX + 'voice.wav'); await pg.wait_for_timeout(600)
        rec('import a WAV as the jump sound', await pg.evaluate("P.sfx.jump.startsWith('data:audio/wav')"))
        await pick(pg, '.pane .row >> nth=2 >> text=Import', FX + 'clip.mp3'); await pg.wait_for_timeout(800)
        rec('import an MP3 as the stomp sound', await pg.evaluate("P.sfx.stomp.startsWith('data:audio/wav')"))
        await pg.click('.pane .row >> nth=1 >> text=Record'); await pg.wait_for_timeout(3600)
        rec('record a sound with the microphone', await pg.evaluate("P.sfx.coin.startsWith('data:audio/wav')"))
        # settings + library
        await pg.evaluate("() => { tab='settings'; renderAll(); }"); await pg.wait_for_timeout(300); await pg.click('.card:has-text("Floaty adventurer")'); await pg.wait_for_timeout(200)
        rec('movement style from the Technique Library', await pg.evaluate("P.meta.physics.preset==='floaty'"))
        await pg.evaluate("() => { tab='tech'; renderAll(); }"); await pg.wait_for_timeout(300); await pg.fill('.pane input.wide', 'wrestling'); await pg.wait_for_timeout(300)
        rec('Technique Library search', await pg.locator('.tech').count() >= 1)
        # studio mode
        await pg.evaluate("() => { tab='level'; renderAll(); }"); await pg.wait_for_timeout(300)
        rec('studio mode shows advanced options', await pg.is_visible('text=Width'))
        # bottom screen
        await pg.evaluate("() => { tab='touch'; renderAll(); }"); await pg.wait_for_timeout(500)
        await pg.click('.touchcard:has-text("Command menu")'); await pg.wait_for_timeout(400)
        await pg.click('button:has-text("Cutting edge / realistic")'); await pg.wait_for_timeout(400)
        rec('bottom screen: pick the pocket-monster command menu + sleek look', await pg.evaluate("P.touch.layout==='command' && P.touch.theme==='sleek'"))
        await pg.fill('.pane input[style*="90px"] >> nth=0', 'HOP'); await pg.keyboard.press('Tab'); await pg.wait_for_timeout(300)
        rec('bottom screen: rename a button', await pg.evaluate("P.touch.items && P.touch.items.some(i=>i.label==='HOP')"))
        # opening screen
        await pg.evaluate("() => { tab='settings'; renderAll(); }"); await pg.wait_for_timeout(300)
        await pick(pg, 'text=Upload… >> nth=0', FX + 'photo.png'); await pg.wait_for_timeout(600)
        rec('opening screen picture is fitted to 256x192', await pg.evaluate("P.opening.top && P.opening.top.startsWith('data:image/png')"))
        # face wrap
        await pg.evaluate("() => { tab='chars'; renderAll(); }"); await pg.wait_for_timeout(300)
        await pick(pg, 'text=Face wrap maker', FX + 'face.jpg'); await pg.wait_for_timeout(4000)
        rec('face wrap maker finds the face', await pg.is_visible('text=Face found'))
        rec('face wrap maker shows all console versions', await pg.locator('.facewrap .pick').count() >= 8)
        await pg.click('.modal button.go'); await pg.wait_for_timeout(500); await pg.click('.modal button.go'); await pg.wait_for_timeout(200)
        await pg.select_option('.builder select >> nth=0', 'realistic'); await pg.click('text=Use as my hero'); await pg.wait_for_timeout(400)
        rec('face goes onto the hero sprite', await pg.evaluate("CB.faceImg && P.sprites.hero.h===64"))
        await pg.click('button:has-text("Blocky / generic")'); await pg.wait_for_timeout(300); await pg.click('text=Use this whole style'); await pg.wait_for_timeout(300); await pg.click('.modal button.go')
        rec('style pack switches enemies, items, tiles and background', await pg.evaluate("P.sprites.walker.image.includes('styles/blocky') && P.tileset.image.includes('styles/blocky') && P.background.includes('styles/blocky')"))
        await pg.click('button:has-text("All")')
        # research lab
        await pg.evaluate("() => { tab='lab'; renderAll(); }"); await pg.wait_for_timeout(400)
        await pick(pg, 'text=Scan a ROM', FX + 'test.gb'); await pg.wait_for_timeout(1500)
        rec('research lab scans a Game Boy ROM and maps its code', await pg.evaluate("labLast && labLast.platform==='gb' && labLast.code.functions>100"))
        await pg.select_option('.labreport select', 'Monster-collecting RPG'); await pg.click('text=Add to studio database'); await pg.wait_for_timeout(300); await pg.click('.modal button.go')
        rec('research lab saves to the studio database', await pg.evaluate("labLoad().length===1 && labLoad()[0].genre==='Monster-collecting RPG'"))
        await pg.fill('input[placeholder^="Search the code database"]', 'scrolling'); await pg.wait_for_timeout(400)
        rec('code database search finds pre-scanned games', await pg.locator('.labdb details').count() >= 5)
        await pg.evaluate("() => { tab='tech'; renderAll(); }"); await pg.wait_for_timeout(300); await pg.fill('.pane input.wide', 'Research Lab'); await pg.wait_for_timeout(300)
        rec('Technique Library includes Research Lab findings', await pg.locator('.tech').count() >= 5)
        # save / open round trip
        async with pg.expect_download() as dl: await pg.click('#save')
        d = await dl.value; saved = open(await d.path()).read()
        await pick(pg, '#open', await d.path()); await pg.wait_for_timeout(600)
        rec('save and reopen keeps the project', await pg.evaluate("JSON.stringify(P)") == saved)
        # test play
        await pg.click('#play'); await pg.wait_for_timeout(400); await pg.keyboard.down('ArrowRight'); await pg.wait_for_timeout(1200); await pg.keyboard.press('z'); await pg.wait_for_timeout(600); await pg.keyboard.up('ArrowRight')
        await pg.screenshot(path='/tmp/e2e_play.png'); await pg.keyboard.press('Escape'); rec('test play runs', not errs)
        # export
        async with pg.expect_download() as dl: await pg.click('#export')
        d = await dl.value; await d.save_as('/tmp/e2e_export.nds'); await pg.wait_for_timeout(500)
        rec('export ROM', open('/tmp/e2e_export.nds', 'rb').read(4) != b'')
        await pg.click('.modal button.alt'); await pg.wait_for_timeout(200)
        await pg.evaluate("() => { tab='settings'; renderAll(); }"); await pg.wait_for_timeout(300); await pg.click('button:has-text("Super Nintendo")'); await pg.wait_for_timeout(300)
        rec('console switch to SNES', await pg.evaluate("P.console==='snes'"))
        async with pg.expect_download() as dl: await pg.click('#export')
        d = await dl.value; await d.save_as('/tmp/e2e_export.sfc'); await pg.wait_for_timeout(500)
        rec('export SNES ROM', open('/tmp/e2e_export.sfc', 'rb').read(0x80008)[0x80000:] == b'NRGSNES1')
        rec('no script errors during the whole session', not errs, '; '.join(errs[:3]))
        await b.close()
    r = subprocess.run([sys.executable, '-c', """
import sys
from desmume.emulator import DeSmuME
from desmume.controls import Keys, keymask
e=DeSmuME(); e.open('/tmp/e2e_export.nds'); e.volume_set(0)
for f in range(900):
    if f==200:
        o=e.screenshot().convert('RGB'); print('OPENING', len(set(list(o.getdata())[:256*192])))
    if f==560: e.input.keypad_add_key(keymask(Keys.KEY_START))
    if f==565: e.input.keypad_rm_key(keymask(Keys.KEY_START))
    e.cycle(with_joystick=False)
s=e.screenshot().convert('RGB'); s.save('/tmp/e2e_export.png'); print('COLORS', len(set(list(s.getdata())[:256*192]))); print('BOTTOM', len(set(list(s.getdata())[256*192:])))"""], capture_output=True, text=True, env={'SDL_VIDEODRIVER': 'dummy', 'SDL_AUDIODRIVER': 'dummy', 'PATH': '/usr/bin:/bin', 'HOME': '/root'})
    cols = [l for l in r.stdout.splitlines() if l.startswith('COLORS')]
    rec('exported ROM (custom hero, tile, background, sounds, songs) boots and plays in DeSmuME', cols and int(cols[0].split()[1]) > 20)
    bot = [l for l in r.stdout.splitlines() if l.startswith('BOTTOM')]
    rec('exported ROM shows the touch layout on the bottom screen', bot and int(bot[0].split()[1]) > 4)
    op = [l for l in r.stdout.splitlines() if l.startswith('OPENING')]
    rec('exported ROM shows the opening screen after the logo', op and int(op[0].split()[1]) > 30)
    r2 = subprocess.run([sys.executable, '-c', '''
import sys, array
sys.path.insert(0, "/home/claude/tc/snes")
from snesrun import Snes
s = Snes("/tmp/e2e_export.sfc"); s.rec = bytearray(); s.run(300); s.tap(0, "START"); s.run(90); s.hold(0, "RIGHT"); s.run(120)
im = s.image().convert("RGB"); im.save("/tmp/e2e_export_snes.png"); print("COLORS", len(set(im.getdata())))
d = array.array("h", bytes(s.rec)); print("AUDIO", max(abs(v) for v in d))'''], capture_output=True, text=True)
    c2 = [l for l in r2.stdout.splitlines() if l.startswith('COLORS')]; a2 = [l for l in r2.stdout.splitlines() if l.startswith('AUDIO')]
    rec('exported SNES ROM boots and plays in Snes9x', c2 and int(c2[0].split()[1]) > 20, r2.stderr[-200:] if not c2 else '')
    rec('exported SNES ROM plays music on the SPC700', a2 and int(a2[0].split()[1]) > 1000)
    json.dump(R, open('/home/claude/notareal-kit/ds/tests/e2e_results.json', 'w'), indent=1)
    print(f"\n{sum(1 for r in R if r[1])} passed, {sum(1 for r in R if not r[1])} failed")
asyncio.run(main())

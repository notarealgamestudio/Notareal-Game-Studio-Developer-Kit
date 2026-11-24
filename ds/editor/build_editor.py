#!/usr/bin/env python3
"""Bundles the editor into one offline HTML file: kit core, library (data URLs), gzipped engine ROM, Technique Library."""
import base64, gzip, json, os, sqlite3, mimetypes
K = '/home/claude/notareal-kit/ds'
lib = json.load(open(f'{K}/library/library.json'))
files = {}
def add(p):
    mt = 'audio/wav' if p.endswith('.wav') else 'image/png'
    files[p] = f'data:{mt};base64,' + base64.b64encode(open(f'{K}/library/{p}', 'rb').read()).decode()
for t in lib['tilesets']: add(t['png'])
for b in lib['backgrounds']: add(b['png'])
for _k, _v in lib.get('assetpack', {}).items():
    for _e in _v: add(_e['png'])
for w in lib.get('worldsets', []): add(w['png'])
for s in lib['sprites']:
    add(s['png'])
    if s.get('topdown'): add(s['topdown'])
for s in lib['sfx']: add(s['wav'])
for s in lib['songs']: s['data'] = json.load(open(f"{K}/library/{s['json']}"))
lib['files'] = files
lib['measured_motion'] = json.load(open(f'{K}/library/measured_motion.json'))
rom = gzip.compress(open(f'{K}/engine/side2d/nr_side2d.nds', 'rb').read(), 9)
prom = gzip.compress(open(f'{K}/engine/puzzle/nr_puzzle.nds', 'rb').read(), 9)
arcrom = gzip.compress(open(f'{K}/engine/arcade/nr_arcade.nds', 'rb').read(), 9)
wrrom = gzip.compress(open(f'{K}/engine/wrestling/nr_wrestling.nds', 'rb').read(), 9)
skrom = gzip.compress(open(f'{K}/engine/skate3d/nr_skate3d.nds', 'rb').read(), 9)
brrom = gzip.compress(open(f'{K}/engine/bracelet/nr_bracelet.nds','rb').read(),9)
gsrom = gzip.compress(open(f'{K}/engine/godsim/nr_godsim.nds','rb').read(),9)
sgrom = gzip.compress(open(f'{K}/engine/sigil/nr_sigil.nds','rb').read(),9)
w3rom = gzip.compress(open(f'{K}/engine/world3d/nr_world3d.nds','rb').read(),9)
w3n64 = gzip.compress(open(f'{K}/engine/w3soft/nr_w3soft_n64.z64','rb').read(),9)
w3psx = gzip.compress(open(f'{K}/engine/w3soft/nr_w3soft_psx.exe','rb').read(),9)
fightrom = gzip.compress(open(f'{K}/engine/fight/nr_fight.nds', 'rb').read(), 9)
mini_gb = gzip.compress(open('/home/claude/notareal-kit/mini/dist/nr_mini_gb.gb', 'rb').read(), 9)
mini_nes = gzip.compress(open('/home/claude/notareal-kit/mini/dist/nr_mini_nes.nes', 'rb').read(), 9)
mini_gba = gzip.compress(open('/home/claude/notareal-kit/mini/dist/nr_mini_gba.gba', 'rb').read(), 9)
mini_n64 = gzip.compress(open('/home/claude/notareal-kit/mini/dist/nr_mini_n64.z64', 'rb').read(), 9)
mini_psx = gzip.compress(open('/home/claude/notareal-kit/mini/dist/nr_mini_psx.exe', 'rb').read(), 9)
mini_modes = {}
import glob
for f in sorted(glob.glob('/home/claude/notareal-kit/mini/dist/nr_mini_*_*.*')):
    nm = os.path.basename(f).split('.')[0][len('nr_'):]   # mini_race_gb
    mini_modes[nm] = gzip.compress(open(f, 'rb').read(), 9)
srom = gzip.compress(open('/home/claude/notareal-kit/snes/side2d/nr_side2d.sfc', 'rb').read(), 9)
sbk = gzip.compress(open('/home/claude/notareal-kit/snes/basket/nr_basket.sfc', 'rb').read(), 9)
skt = gzip.compress(open('/home/claude/notareal-kit/snes/kart/nr_kart.sfc', 'rb').read(), 9)
db = sqlite3.connect('/home/claude/out/rom_catalog.sqlite'); db.row_factory = sqlite3.Row
tech = [dict(r) for r in db.execute('select system, category, game, platform, what, numbers, feel, use from systems')]
body = json.load(open(f'{K}/library/body_proportions.json'))
example = json.load(open(f'{K}/examples/lakewood_run.json'))
mini_extra = ''.join(f',{k}:"{base64.b64encode(v).decode()}"' for k, v in mini_modes.items())
import datetime
data = (f'const NR_BUILD="{datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M")} UTC";\nconst LIB={json.dumps(lib)};\nconst ROMS={{ds_side2d:"{base64.b64encode(rom).decode()}",snes_side2d:"{base64.b64encode(srom).decode()}",snes_basket:"{base64.b64encode(sbk).decode()}",snes_kart:"{base64.b64encode(skt).decode()}",ds_puzzle:"{base64.b64encode(prom).decode()}",ds_fight:"{base64.b64encode(fightrom).decode()}",ds_arcade:"{base64.b64encode(arcrom).decode()}",ds_skate3d:"{base64.b64encode(skrom).decode()}",ds_wrestling:"{base64.b64encode(wrrom).decode()}",ds_sigil:"{base64.b64encode(sgrom).decode()}",ds_bracelet:"{base64.b64encode(brrom).decode()}",ds_godsim:"{base64.b64encode(gsrom).decode()}",ds_world3d:"{base64.b64encode(w3rom).decode()}",n64_world3d:"{base64.b64encode(w3n64).decode()}",psx_world3d:"{base64.b64encode(w3psx).decode()}",mini_gb:"{base64.b64encode(mini_gb).decode()}",mini_nes:"{base64.b64encode(mini_nes).decode()}",mini_gba:"{base64.b64encode(mini_gba).decode()}",mini_n64:"{base64.b64encode(mini_n64).decode()}",mini_psx:"{base64.b64encode(mini_psx).decode()}"{mini_extra}}};\nconst TECH={json.dumps(tech)};\n'
        f'const BODY={json.dumps(body)};\nconst EXAMPLE={json.dumps(example)};')
logo = 'data:image/png;base64,' + base64.b64encode(open('/home/claude/notareal-kit/n64/nr_logo.png', 'rb').read()).decode()
html = open(f'{K}/editor/editor.html').read()
kit = '\n'.join(open(f'{K}/kit/{m}').read() for m in ('nrkit.js', 'nrmusic.js', 'nrtouch.js', 'nrface.js', 'nrdecomp.js', 'nrgfx.js', 'nrlab.js', 'nrre.js', 'nrsnes.js', 'nrworld.js', 'nrmodes.js', 'nrpc.js', 'nrwrestling.js', 'nrfight.js', 'nrpuzzle.js', 'nrmotion.js', 'nr3d.js', 'nranim.js', 'nrarcade.js', 'nr3d_sandbox.js', 'nr3d_war.js', 'nr3d_store.js', 'nr3d_rpg.js', 'nr3d_frontier.js', 'nrkartparty.js', 'nrlife_data.js', 'nrgems.js', 'nrcolor.js', 'nrroom.js', 'nrlife.js', 'nrlife_ui.js', 'nr3dpresets.js', 'nrphys.js', 'nrrecipes.js', 'nrtex.js', 'nrtimeline.js', 'nrsigil_data.js', 'nrsigil.js', 'nrsixthseal.js', 'nrbracelet.js', 'nrgodsim.js', 'nrberea.js', 'nrtes.js', 'nrworld3d.js', 'nrbuilder.js', 'nrtemplates.js', 'nrtools.js', 'nrai.js', 'nrknowledge.js', 'nritemaudit.js', 'nrfit.js', 'nrassets.js', 'nrbalance.js', 'nrmini.js', 'vendor/pico_mod.js', 'vendor/facefinder.js'))
genres = json.load(open(f'{K}/presets/genres.json'))
catalog = [dict(r) for r in db.execute('select game, platform, genre from games order by platform, game')]
data += 'const KITSRC=' + json.dumps({'nrworld': open(f'{K}/kit/nrworld.js').read(), 'nrmusic': open(f'{K}/kit/nrmusic.js').read(), 'nrfight': open(f'{K}/kit/nrwrestling.js').read() + '\n;\n' + open(f'{K}/kit/nrfight.js').read(), 'nrpuzzle': open(f'{K}/kit/nrpuzzle.js').read(), 'nrtimeline': open(f'{K}/kit/nrtimeline.js').read(), 'nrarcade': ''.join(open(f'{K}/kit/{m}.js').read() + '\n;\n' for m in ('nrmotion', 'nr3d', 'nranim', 'nrarcade', 'nr3d_sandbox', 'nr3d_war', 'nr3d_store', 'nr3d_rpg', 'nr3d_frontier', 'nrkartparty', 'nrlife_data', 'nrgems', 'nrcolor', 'nrroom', 'nrlife', 'nrlife_ui'))}).replace('</', '<\\/') + ';\n'
data += '\nconst ABOUT_TEXT=' + json.dumps(open(f'{K}/editor/about.txt').read()) + ';'
data += '\nconst TES_REF=' + open(f'{K}/presets/tes_reference.json').read() + ';'
data += '\nconst MEASURED=' + open(f'{K}/presets/measured.json').read() + ';'
data += f'\nconst GENRES={json.dumps(genres)};\nconst CATALOG={json.dumps(catalog)};'
if os.path.exists(f'{K}/library/code_db.json'): data += f'\nconst CODEDB={open(f"{K}/library/code_db.json").read()};'
else: data += '\nconst CODEDB=[];'
html = html.replace('__LOGO__', logo).replace('__DATA__', data).replace('__NRKIT__', lambda_kit := kit).replace('__EDITOR__', open(f'{K}/editor/editor.js').read() + '\n' + open(f'{K}/editor/editor_plus.js').read() + '\n' + open(f'{K}/editor/editor_world.js').read() + '\n' + open(f'{K}/editor/editor_gfx.js').read() + '\n' + open(f'{K}/editor/editor_fight.js').read() + '\n' + open(f'{K}/editor/editor_puzzle.js').read() + '\n' + open(f'{K}/editor/editor_re.js').read() + '\n' + open(f'{K}/editor/editor_templates.js').read() + '\n' + open(f'{K}/editor/editor_fit.js').read() + '\n' + open(f'{K}/editor/editor_story.js').read() + '\n' + open(f'{K}/editor/editor_timeline.js').read() + '\n' + open(f'{K}/editor/editor_color.js').read() + '\n' + open(f'{K}/editor/editor_recipes.js').read() + '\n' + open(f'{K}/editor/editor_sigil.js').read() + '\n' + open(f'{K}/editor/editor_berea.js').read() + '\n' + open(f'{K}/editor/editor_bracelet.js').read() + '\n' + open(f'{K}/editor/editor_godsim.js').read() + '\n' + open(f'{K}/editor/editor_frontier.js').read() + '\n' + open(f'{K}/editor/editor_engines.js').read() + '\n' + open(f'{K}/editor/editor_assets.js').read() + '\n' + open(f'{K}/editor/editor_cast.js').read() + '\n' + open(f'{K}/editor/editor_level3d.js').read() + '\n' + open(f'{K}/editor/editor_skatepark.js').read())
os.makedirs(f'{K}/dist', exist_ok=True)
open(f'{K}/dist/notareal_studio.html', 'w').write(html)
print('editor built', len(html) // 1024, 'KB; rom gz', len(rom) // 1024, 'KB; tech rows', len(tech))

"""RPG / monster collecting on every small console: builds the starter world, runs it in real emulators (GB, GBC, NES, GBA, N64, PSX):
title -> town -> tall grass -> wild battle (text screen, sprites) -> win/catch -> back on the map."""
import subprocess, sys, json, re, numpy as np, os
from PIL import Image
K = '/home/claude/notareal-kit'; T = f'{K}/ds/tools'; ok = bad = 0
def t(n, c):
    global ok, bad
    if c: ok += 1
    else: bad += 1; print('FAIL', n)
def build(proj, con, out, tpl=None): subprocess.run(['node', 'mini-cli.js', proj, con, out] + ([tpl] if tpl else []), cwd=T, check=True, capture_output=True)
MK = """const M=require('./kit/nrmodes.js'),fs=require('fs');const b=JSON.parse(fs.readFileSync('examples/lakewood_run.json'));
for (const [k,f] of [['monster','/tmp/rpg_e2e.json'],['jrpg','/tmp/rpg_e2e_j.json']]) { const P=M.rpgProject(b,{kind:k}); const m=P.world.maps[0];
  for (let y=8;y<=13;y++) for (let x=13;x<=21;x++) m.ground[y*m.w+x]=2; fs.writeFileSync(f,JSON.stringify(P)); }"""
subprocess.run(['node', '-e', MK], cwd=f'{K}/ds', check=True)      # the start of the test world sits in a patch of tall grass, so every console meets a wild monster without depending on walking speed
def bright(a): return float(a.mean())
def dark(a): return bright(a) < 45
def diff(a, b): return float((np.abs(a.astype(int) - b.astype(int)).sum(axis=2) > 30).mean())
# script: the same input sequence on every console. directions: r l u d, a, b, s(tart); n frames each
ROUTE = [('s', 6), ('-', 140), ('S0',), ('l', 20), ('-', 60), ('S1',)]
WANDER = [('d', 40), ('-', 4), ('u', 40), ('-', 4)] * 70 + [('S2',)]
FIGHT = [('a', 4), ('-', 100)] * 40 + [('S3',)]
SEQ = ROUTE + WANDER + FIGHT
KEYS = {'a': 1, 'b': 2, 's': 8, 'r': 16, 'l': 32, 'u': 64, 'd': 128}
def run_gba(rom, tag):
    cmd = ['run:120']; shots = {}
    for st in SEQ:
        if st[0].startswith('S'): p = f'/tmp/rpg_{tag}_{st[0]}.ppm'; shots[st[0]] = p; cmd.append('shot:' + p)
        else: cmd += ['key:' + str(KEYS.get(st[0], 0)), f'run:{st[1]}', 'key:0'] if st[0] != '-' else [f'run:{st[1]}']
    subprocess.run([f'{K}/mini/tools/gbarun', rom, ' '.join(cmd)], check=True)
    return {k: np.array(Image.open(v).convert('RGB')) for k, v in shots.items()}
def run_gb(rom, tag):
    from pyboy import PyBoy
    pb = PyBoy(rom, window='null', sound_emulated=False); names = {'a': 'a', 'b': 'b', 's': 'start', 'r': 'right', 'l': 'left', 'u': 'up', 'd': 'down'}; shots = {}
    for _ in range(120): pb.tick()
    for st in SEQ:
        if st[0].startswith('S'): shots[st[0]] = np.array(pb.screen.image.convert('RGB')); continue
        if st[0] == '-': [pb.tick() for _ in range(st[1])]; continue
        pb.button_press(names[st[0]]); [pb.tick() for _ in range(st[1])]; pb.button_release(names[st[0]])
    pb.stop(); return shots
def run_nes(rom, tag):
    from nes_py import NESEnv
    env = NESEnv(rom); env.reset(); m = {'a': 1, 'b': 2, 's': 8, 'u': 16, 'd': 32, 'l': 64, 'r': 128}; shots = {}
    for _ in range(120): env.step(0)
    for st in SEQ:
        if st[0].startswith('S'): shots[st[0]] = env.screen.copy(); continue
        a = m.get(st[0], 0)
        for _ in range(st[1]): env.step(a)
    env.close(); return shots
def run_lib(emu, ids, frames0):
    emu.run(frames0); shots = {}
    for st in SEQ:
        if st[0].startswith('S'): emu.shot(f'/tmp/rpg_lib_{st[0]}.png'); shots[st[0]] = np.array(Image.open(f'/tmp/rpg_lib_{st[0]}.png').convert('RGB')); continue
        if st[0] == '-': emu.run(st[1]); continue
        emu.pressed[0].add(ids[st[0]]); emu.run(st[1]); emu.pressed[0].discard(ids[st[0]])
    return shots
def check(name, sh):
    t(f'{name}: map drawn after START', not dark(sh['S0']) and len(np.unique(sh['S0'].reshape(-1, 3), axis=0)) >= 3)
    t(f'{name}: the hero walks (the view changes)', diff(sh['S0'], sh['S1']) > 0.002)
    t(f'{name}: a wild battle starts in the tall grass (text screen)', dark(sh['S2']) and (sh['S2'].reshape(-1, 3).max(axis=1) > 60).mean() > 0.004)
    t(f'{name}: after fighting you are back on the map', not dark(sh['S3']))
for con, tpl in (('gb', None), ('gbc', None)):
    build('/tmp/rpg_e2e.json', con, f'/tmp/rpg.{con}'); check(con, run_gb(f'/tmp/rpg.{con}', con))
build('/tmp/rpg_e2e.json', 'nes', '/tmp/rpg.nes'); check('nes', run_nes('/tmp/rpg.nes', 'nes'))
build('/tmp/rpg_e2e.json', 'gba', '/tmp/rpg.gba'); check('gba', run_gba('/tmp/rpg.gba', 'gba'))
sys.path.insert(0, '/home/claude/tc/n64'); sys.path.insert(0, '/home/claude/tc/snes')
from n64run import N64
import snesrun
build('/tmp/rpg_e2e.json', 'n64', '/tmp/rpg.z64'); n = N64('/tmp/rpg.z64'); check('n64', run_lib(n, {'a': 0, 'b': 1, 's': 3, 'u': 4, 'd': 5, 'l': 6, 'r': 7}, 450))
build('/tmp/rpg_e2e.json', 'psx', '/tmp/rpg.exe'); p = snesrun.Snes('/tmp/rpg.exe', core='/home/claude/tc/psx/pcsx_rearmed/pcsx_rearmed_libretro.so'); check('psx', run_lib(p, {'a': 8, 'b': 0, 's': 3, 'u': 4, 'd': 5, 'l': 6, 'r': 7}, 400))
# the JRPG variant (no catching) builds and shows a battle on GB
build('/tmp/rpg_e2e_j.json', 'gb', '/tmp/rpgj.gb'); sh = run_gb('/tmp/rpgj.gb', 'j'); t('jrpg (no balls) battle starts on gb', dark(sh['S2']))
print('rpg e2e', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)

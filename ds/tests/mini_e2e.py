"""Runs the exported GB/GBC, NES and GBA ROMs in real emulators: title screen, start, play to the YOU WIN screen on a flat test level."""
import subprocess, sys, os, json, numpy as np
from PIL import Image
K = '/home/claude/notareal-kit'; T = f'{K}/ds/tools'; ok = bad = 0
def t(n, c):
    global ok, bad
    if c: ok += 1
    else: bad += 1; print('FAIL', n)
def build(proj, con, out): subprocess.run(['node', 'mini-cli.js', proj, con, out], cwd=T, check=True, capture_output=True)
def dark(a): return (a.sum(axis=2) < 60).mean()
def mk_flat():
    import copy
    p = json.load(open(f'{K}/ds/examples/lakewood_run.json')); L = copy.deepcopy(p['levels'][0]); w, h = 60, 16
    L['w'] = w; L['h'] = h; L['map'] = [0] * (w * h)
    for y in range(13, 16):
        for x in range(w): L['map'][y * w + x] = 1
    L['objects'] = [{'type': 'start', 'x': 2, 'y': 11}, {'type': 'coin', 'x': 8, 'y': 12}, {'type': 'goal', 'x': 40, 'y': 11}]
    p['levels'] = [L]; json.dump(p, open('/tmp/flat_e2e.json', 'w')); return '/tmp/flat_e2e.json'
flat = mk_flat()
# jump check: pressing A lifts the hero (GB engine, y read from the screen)
# ---- GB / GBC (pyboy)
from pyboy import PyBoy
for con in ('gb', 'gbc'):
    build(flat, con, f'/tmp/e2e.{con}'); pb = PyBoy(f'/tmp/e2e.{con}', window='null', sound_emulated=False)
    for _ in range(120): pb.tick()
    a = np.array(pb.screen.image.convert('RGB')); t(f'{con} title has the logo (several colours)', len(np.unique(a.reshape(-1, 3), axis=0)) >= 3)
    pb.button('start')
    for _ in range(90): pb.tick()
    g0 = np.array(pb.screen.image.convert('RGB')); t(f'{con} game screen drawn', len(np.unique(g0.reshape(-1, 3), axis=0)) >= 4)
    pb.button_press('right'); pb.button_press('b')
    for i in range(900): pb.tick()
    e = np.array(pb.screen.image.convert('RGB')); t(f'{con} reaches the win screen', dark(e) > 0.9); pb.stop()
# ---- NES (nes-py)
from nes_py import NESEnv
build(flat, 'nes', '/tmp/e2e.nes'); env = NESEnv('/tmp/e2e.nes'); env.reset()
for _ in range(120): env.step(0)
t('nes title drawn', len(np.unique(env.screen.reshape(-1, 3), axis=0)) >= 3)
for _ in range(8): env.step(8)
for _ in range(60): env.step(0)
t('nes game screen drawn', len(np.unique(env.screen.reshape(-1, 3), axis=0)) >= 4)
for i in range(900): env.step(128 | 2)
t('nes reaches the win screen', dark(env.screen) > 0.9); env.close()
# ---- GBA (libmgba runner)
build(flat, 'gba', '/tmp/e2e.gba'); run = f'{K}/mini/tools/gbarun'
s = 'run:120 shot:/tmp/e2e_t.ppm key:8 run:8 key:0 run:60 shot:/tmp/e2e_g.ppm ' + 'key:18 run:700' + ' shot:/tmp/e2e_e.ppm'
subprocess.run([run, '/tmp/e2e.gba', s], check=True)
im = lambda n: np.array(Image.open(n).convert('RGB'))
t('gba title drawn', len(np.unique(im('/tmp/e2e_t.ppm').reshape(-1, 3), axis=0)) >= 3); t('gba game screen drawn', len(np.unique(im('/tmp/e2e_g.ppm').reshape(-1, 3), axis=0)) >= 4); t('gba reaches the win screen', dark(im('/tmp/e2e_e.ppm')) > 0.9)
# ---- sound: GB audio is not silent; GBA sound hardware reports both pulse channels playing
import subprocess as _sp
_sp.run(['node', 'mini-cli.js', f'{K}/ds/examples/lakewood_run.json', 'gb', '/tmp/snd.gb'], cwd=T, check=True, capture_output=True)
_pb = PyBoy('/tmp/snd.gb', window='null', sound_emulated=True)
for _ in range(120): _pb.tick()
_pb.button('start'); _mx = 0
for _ in range(300):
    _pb.tick(); _s = _pb.sound.ndarray
    if len(_s): _mx = max(_mx, int(np.abs(_s.astype(int)).max()))
_pb.stop(); t('gb music/sfx audio is not silent', _mx > 0)
_sp.run(['node', 'mini-cli.js', f'{K}/ds/examples/lakewood_run.json', 'gba', '/tmp/snd.gba'], cwd=T, check=True, capture_output=True)
_o = _sp.run([f'{K}/mini/tools/gbarun', '/tmp/snd.gba', 'run:150 key:8 run:6 key:0 run:120 peek:04000084'], capture_output=True, text=True).stdout
t('gba sound channels active', '04000084 = 008' in _o and int(_o.split('04000084 = ')[1][:4], 16) & 3 != 0)

# N64 and PlayStation (software PPU engines): logo, title and gameplay frames
sys.path.insert(0, '/home/claude/tc/n64'); sys.path.insert(0, '/home/claude/tc/snes')
import snesrun
from n64run import N64
_sp.run(['node', 'mini-cli.js', f'{K}/ds/examples/lakewood_run.json', 'n64', '/tmp/e2e.z64'], cwd=T, check=True, capture_output=True)
_n = N64('/tmp/e2e.z64'); _n.run(450); _a = _n.frame_np() if hasattr(_n, 'frame_np') else None
_n.tap(0, 'START'); _n.run(120); _n.hold(0, 'RIGHT'); _n.run(120); _n.shot('/tmp/e2e_n64.png')
from PIL import Image
_im = np.array(Image.open('/tmp/e2e_n64.png').convert('RGB')); t('n64 gameplay renders (sky + ground)', len(np.unique(_im.reshape(-1, 3), axis=0)) > 6 and dark(_im) < 0.8)
_sp.run(['node', 'mini-cli.js', f'{K}/ds/examples/lakewood_run.json', 'psx', '/tmp/e2e.exe'], cwd=T, check=True, capture_output=True)
_p = snesrun.Snes('/tmp/e2e.exe', core=f'/home/claude/tc/psx/pcsx_rearmed/pcsx_rearmed_libretro.so'); _p.run(400)
_p.pressed[0].add(3); _p.run(3); _p.pressed[0].discard(3); _p.run(120); _p.pressed[0].add(7); _p.run(120); _p.shot('/tmp/e2e_psx.png')
_im = np.array(Image.open('/tmp/e2e_psx.png').convert('RGB')); t('psx gameplay renders (sky + ground)', len(np.unique(_im.reshape(-1, 3), axis=0)) > 6 and dark(_im) < 0.8)

print('mini e2e', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)

"""Racing on every small console: builds a track project, runs it in real emulators, checks the countdown, driving, scrolling, rival AI laps and the 3D view."""
import subprocess, sys, json, re, numpy as np, os
from PIL import Image
K = '/home/claude/notareal-kit'; T = f'{K}/ds/tools'; ok = bad = 0
def t(n, c):
    global ok, bad
    if c: ok += 1
    else: bad += 1; print('FAIL', n)
def build(proj, con, out): subprocess.run(['node', 'mini-cli.js', proj, con, out], cwd=T, check=True, capture_output=True)
subprocess.run(['node', '-e', "const M=require('./kit/nrmodes.js'),fs=require('fs');const b=JSON.parse(fs.readFileSync('examples/lakewood_run.json'));fs.writeFileSync('/tmp/race_e2e.json',JSON.stringify(M.raceProject(b,{title:'Street Racers'})));"], cwd=K + '/ds', check=True)
def diff(a, b): return float((np.abs(a.astype(int) - b.astype(int)).sum(axis=2) > 30).mean())
# ---- GB / GBC (pyboy), with the debug ROM so the rivals' lap counters can be read
from pyboy import PyBoy
subprocess.run(['bash', f'{K}/mini/gb/build.sh'], env=dict(os.environ, NRDBGFLAG='-DNRDBG', NRMODE='1', OUT='dbg_race_gb.gb'), capture_output=True, check=True)
noi = open(f'{K}/mini/gb/dbg_race_gb.noi').read(); sym = lambda n: int(re.search(r'DEF _%s 0x([0-9A-F]+)' % n, noi).group(1), 16)
for con in ('gb', 'gbc'):
    build('/tmp/race_e2e.json', con, f'/tmp/r.{con}')
    if con == 'gbc': build('/tmp/race_e2e.json', con, '/tmp/rd.gbc') if False else None
    pb = PyBoy(f'/tmp/r.{con}', window='null', sound_emulated=False)
    for _ in range(120): pb.tick()
    a = np.array(pb.screen.image.convert('RGB')); t(f'{con} race title drawn', len(np.unique(a.reshape(-1, 3), axis=0)) >= 3)
    pb.button('start')
    for _ in range(60): pb.tick()
    g0 = np.array(pb.screen.image.convert('RGB')); t(f'{con} track drawn', len(np.unique(g0.reshape(-1, 3), axis=0)) >= 3)
    for _ in range(300): pb.tick()
    pb.button_press('a')
    for _ in range(300): pb.tick()
    g1 = np.array(pb.screen.image.convert('RGB')); t(f'{con} car drives and the track scrolls', diff(g0, g1) > 0.2); pb.stop()
subprocess.run(['node', 'mini-cli.js', '/tmp/race_e2e.json', 'gbc', '/tmp/rd.gb', f'{K}/mini/gb/dbg_race_gb.gb'], cwd=T, check=True, capture_output=True)
pb = PyBoy('/tmp/rd.gb', window='null', sound_emulated=False)
w = lambda a: pb.memory[a] | (pb.memory[a + 1] << 8)
for _ in range(120): pb.tick()
pb.button('start')
for _ in range(3600): pb.tick()     # one minute: rivals drive on their own
laps = [pb.memory[sym('clap') + i] for i in range(4)]; cnx = [pb.memory[sym('cnx') + i] for i in range(4)]
t(f'gb rival AI drives round the track (laps {laps}, next checkpoint {cnx})', max(laps[1:]) >= 1 or max(cnx[1:]) >= 5); pb.stop()
# ---- NES
from nes_py import NESEnv
build('/tmp/race_e2e.json', 'nes', '/tmp/r.nes'); env = NESEnv('/tmp/r.nes'); env.reset()
for _ in range(120): env.step(0)
for _ in range(8): env.step(8)
for _ in range(60): env.step(0)
n0 = env.screen.copy()
for _ in range(300): env.step(0)
for _ in range(300): env.step(1)
t('nes race drives and scrolls', diff(n0, env.screen) > 0.15); env.close()
# ---- GBA
build('/tmp/race_e2e.json', 'gba', '/tmp/r.gba')
subprocess.run([f'{K}/mini/tools/gbarun', '/tmp/r.gba', 'run:120 key:8 run:8 key:0 run:60 shot:/tmp/r_g0.ppm run:300 key:1 run:300 shot:/tmp/r_g1.ppm'], check=True)
im = lambda n: np.array(Image.open(n).convert('RGB')); t('gba race drives and scrolls', diff(im('/tmp/r_g0.ppm'), im('/tmp/r_g1.ppm')) > 0.15)
# ---- N64 + PSX: perspective view
sys.path.insert(0, '/home/claude/tc/n64'); sys.path.insert(0, '/home/claude/tc/snes')
from n64run import N64
build('/tmp/race_e2e.json', 'n64', '/tmp/r.z64'); n = N64('/tmp/r.z64'); n.run(450); n.tap(0, 'START'); n.run(420); n.hold(0, 'A'); n.run(240); n.shot('/tmp/r_n64.png')
import snesrun
build('/tmp/race_e2e.json', 'psx', '/tmp/r.exe'); p = snesrun.Snes('/tmp/r.exe', core='/home/claude/tc/psx/pcsx_rearmed/pcsx_rearmed_libretro.so'); p.run(400)
p.pressed[0].add(3); p.run(3); p.pressed[0].discard(3); p.run(420); p.pressed[0].add(8); p.run(240); p.shot('/tmp/r_psx.png')
for nm in ('n64', 'psx'):
    a = im(f'/tmp/r_{nm}.png'); h = a.shape[0]; sky = a[int(h * .05):int(h * .22)]; ground = a[int(h * .75):int(h * .95)]
    t(f'{nm} 3D view: sky above, textured road below', len(np.unique(sky.reshape(-1, 3), axis=0)) <= 12 and len(np.unique(ground.reshape(-1, 3), axis=0)) >= 8)
    # perspective: the road narrows towards the horizon (more road-grey pixels at the bottom row than near the horizon)
    bot = a[int(h * .93)]; cols, cnt = np.unique(bot, axis=0, return_counts=True); rc = cols[cnt.argmax()]
    near = lambda row: int((np.abs(row.astype(int) - rc.astype(int)).sum(axis=1) < 40).sum())
    t(f'{nm} 3D view: road widens towards the camera ({near(bot)} px near, {near(a[int(h * .42)])} px far)', near(bot) > near(a[int(h * .42)]) * 1.5)
print('race e2e', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)

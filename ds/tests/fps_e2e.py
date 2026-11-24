"""First-person shooter on N64 and PlayStation: title -> start -> 3D corridor (raycast walls) -> turn/walk changes the view -> shoot."""
import subprocess, sys, numpy as np
from PIL import Image
K = '/home/claude/notareal-kit'; T = f'{K}/ds/tools'; ok = bad = 0
def t(n, c):
    global ok, bad
    if c: ok += 1
    else: bad += 1; print('FAIL', n)
subprocess.run(['node', '-e', "const M=require('./kit/nrmodes.js'),fs=require('fs');fs.writeFileSync('/tmp/fps_e2e.json',JSON.stringify(M.fpsProject(JSON.parse(fs.readFileSync('examples/lakewood_run.json')),{levels:3})))"], cwd=f'{K}/ds', check=True)
sys.path.insert(0, '/home/claude/tc/n64'); sys.path.insert(0, '/home/claude/tc/snes')
from n64run import N64
import snesrun
def build(con, out): subprocess.run(['node', 'mini-cli.js', '/tmp/fps_e2e.json', con, out], cwd=T, check=True, capture_output=True)
def diff(a, b): return float((np.abs(a.astype(int) - b.astype(int)).sum(axis=2) > 30).mean())
def run(emu, ids, f0, tag):
    emu.run(f0); sh = {}
    def shot(n): emu.shot(f'/tmp/fps_{tag}_{n}.png'); sh[n] = np.array(Image.open(f'/tmp/fps_{tag}_{n}.png').convert('RGB'))
    def press(k, n): emu.pressed[0].add(ids[k]); emu.run(n); emu.pressed[0].discard(ids[k])
    press('s', 6); emu.run(120); shot('start')
    press('l', 40); emu.run(10); shot('turn')
    press('u', 60); emu.run(10); shot('walk')
    press('a', 4); emu.run(2); shot('fire')
    press('r', 60); press('u', 60); shot('end')
    return sh
def check(name, sh):
    s = sh['start']; cols = len(np.unique(s.reshape(-1, 3), axis=0))
    t(f'{name}: 3D view drawn', cols >= 3 and s.mean() > 25)
    top = s[:60].reshape(-1, 3); bot = s[100:].reshape(-1, 3)
    t(f'{name}: ceiling and floor differ (a horizon)', abs(float(top.mean()) - float(bot.mean())) > 2 or len(np.unique(s[75:85].reshape(-1, 3), axis=0)) > 2)
    t(f'{name}: turning changes the view', diff(sh['start'], sh['turn']) > 0.02)
    t(f'{name}: walking changes the view', diff(sh['turn'], sh['walk']) > 0.02)
build('n64', '/tmp/fps.z64'); check('n64', run(N64('/tmp/fps.z64'), {'a': 0, 'b': 1, 's': 3, 'u': 4, 'd': 5, 'l': 6, 'r': 7}, 450, 'n64'))
build('psx', '/tmp/fps.exe'); check('psx', run(snesrun.Snes('/tmp/fps.exe', core='/home/claude/tc/psx/pcsx_rearmed/pcsx_rearmed_libretro.so'), {'a': 8, 'b': 0, 's': 3, 'u': 4, 'd': 5, 'l': 6, 'r': 7}, 400, 'psx'))
print('fps e2e', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)

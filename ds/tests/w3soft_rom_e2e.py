# N64 and PlayStation 3D world ROMs (software renderer): built from the kit's world data, booted in the N64 / PCSX emulators.
import subprocess, sys, os
sys.path.insert(0, '/home/claude/tc/n64'); sys.path.insert(0, '/home/claude/tc/snes')
from PIL import Image
K = '/home/claude/notareal-kit/ds'; ok = bad = 0
def chk(n, c):
    global ok, bad; ok += bool(c); bad += not c; print('PASS' if c else 'FAIL', n, flush=True)
if not (len(sys.argv) > 1 and sys.argv[1] == 'run'): subprocess.run(['node', '-e', '''const W=require("./kit/nrworld3d.js"),Kt=require("./kit/nrkit.js"),fs=require("fs");
for(const [m,c] of [["sandbox3d",{title:"Star Rush",goalStars:3}],["warfare3d",{title:"Ring Ops"}],["rpg3d",{title:"Wasteland"}],["store3d",{title:"Quick Mart"}],["frontier3d",{title:"Dust and Lead"}],["combat",{title:"Scrap Run"}]]){const b=W.build({arcade:{mode:m,cfg:c}}).block;
fs.writeFileSync("/tmp/w3t_"+m+".z64",Buffer.from(Kt.patchROM(new Uint8Array(fs.readFileSync("engine/w3soft/nr_w3soft_n64.z64")),b).rom));
fs.writeFileSync("/tmp/w3t_"+m+".exe",Buffer.from(Kt.patchROM(new Uint8Array(fs.readFileSync("engine/w3soft/nr_w3soft_psx.exe")),b).rom));}'''], cwd=K, check=True)
def colours(p): return len(set(Image.open(p).convert('RGB').getdata()))
def crop(p, box): return list(Image.open(p).convert('RGB').resize((320, 240)).crop(box).getdata())
if len(sys.argv) > 3 and sys.argv[1] == 'run':      # worker: one emulator per process
    con, m = sys.argv[2], sys.argv[3]
    if con == 'n64':
        from n64run import N64
        n = N64(f'/tmp/w3t_{m}.z64'); n.run(450); n.shot(f'/tmp/w3t_{con}_{m}_a.png'); n.hold(0, 'UP'); n.run(640 if m == 'store3d' else 240); n.pressed[0].discard(4); n.hold(0, 'B'); n.run(120); n.shot(f'/tmp/w3t_{con}_{m}_b.png')
    else:
        import snesrun
        p = snesrun.Snes(f'/tmp/w3t_{m}.exe', core='/home/claude/tc/psx/pcsx_rearmed/pcsx_rearmed_libretro.so'); p.run(500); p.shot(f'/tmp/w3t_{con}_{m}_a.png'); p.pressed[0].add(4); p.run(640 if m == 'store3d' else 240); p.pressed[0].discard(4); p.pressed[0].add(1); p.run(120); p.shot(f'/tmp/w3t_{con}_{m}_b.png')
    sys.exit(0)
for con in ('n64', 'psx'):
    for m in ("sandbox3d", "warfare3d", "rpg3d", "store3d", "frontier3d", "combat"):
        subprocess.run([sys.executable, __file__, 'run', con, m], capture_output=True, timeout=900)
        a, b = f'/tmp/w3t_{con}_{m}_a.png', f'/tmp/w3t_{con}_{m}_b.png'
        if not (os.path.exists(a) and os.path.exists(b)): chk(f'{con} {m}: emulator ran', False); continue
        chk(f'{con} {m}: 3D view and HUD draw (many colours)', colours(a) > 12)
        chk(f'{con} {m}: walking changes the view', crop(a, (0, 0, 320, 192)) != crop(b, (0, 0, 320, 192)))
        if m == 'sandbox3d': chk(f'{con} sandbox3d: a star was collected (HUD changed)', crop(a, (0, 192, 130, 240)) != crop(b, (0, 192, 130, 240)))
        elif m == 'store3d': chk(f'{con} store3d: clocking in starts the shift clock (HUD changed)', crop(a, (190, 192, 270, 204)) != crop(b, (190, 192, 270, 204)))
        elif m == 'combat': chk(f'{con} combat: driving moves the road and the HUD heat bar fills (HUD changed)', crop(a, (0, 0, 130, 24)) != crop(b, (0, 0, 130, 24)))
        else: chk(f'{con} {m}: firing changes the HUD (ammo / fight)', crop(a, (0, 192, 270, 240)) != crop(b, (0, 192, 270, 240)))
print('w3soft ROM tests', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)

# DS 3D world ROMs (sandbox / warfare / wasteland): built from the kit's world data, booted in DeSmuME; checks rendering, movement, firing and star pickup.
import subprocess, sys
from PIL import Image
K = '/home/claude/notareal-kit/ds'; ok = bad = 0
def chk(n, c):
    global ok, bad; ok += bool(c); bad += not c; print('PASS' if c else 'FAIL', n)
subprocess.run(['node', '-e', '''const W=require("./kit/nrworld3d.js"),Kt=require("./kit/nrkit.js"),fs=require("fs");
for(const [m,c] of [["sandbox3d",{title:"Star Rush",goalStars:3}],["warfare3d",{title:"Ring Ops"}],["rpg3d",{title:"Wasteland"}]]){fs.writeFileSync("/tmp/w3_"+m+".nds",Buffer.from(Kt.patchROM(new Uint8Array(fs.readFileSync("engine/world3d/nr_world3d.nds")),W.build({arcade:{mode:m,cfg:c}}).block).rom));}'''], cwd=K, check=True)
def run(m, frames, keys, shots):
    subprocess.run(f'xvfb-run -a python3 tools/dsrun.py /tmp/w3_{m}.nds /tmp/w3s_{m} {frames} --shots {shots} --keys "{keys}"', shell=True, cwd=K, capture_output=True)
    return [Image.open(f'/tmp/w3s_{m}_{int(s):05d}.png').convert('RGB') for s in shots.split(',')]
top = lambda im: im.crop((0, 0, 256, 192)); bot = lambda im: im.crop((0, 192, 256, 384))
for m in ('sandbox3d', 'warfare3d', 'rpg3d'):
    a, b = run(m, 460, '200-330:UP,200-330:A', '190,450')
    chk(m + ': both screens draw', len(top(a).getcolors(70000)) > 6 and len(bot(a).getcolors(70000)) > 6); chk(m + ': D-pad moves the camera', list(top(a).getdata()) != list(top(b).getdata()))
a, b = run('warfare3d', 700, '200-260:UP,300-600:B', '290,690'); chk('warfare3d: firing and the fight change the HUD', list(bot(a).getdata()) != list(bot(b).getdata()))
cols = len(top(b).getcolors(70000)); chk('warfare3d: enemies/world drawn with many colours (%d)' % cols, cols > 12)
a, b = run('sandbox3d', 600, '200-420:UP', '190,590'); chk('sandbox3d: walking onto a star changes the star counter', list(bot(a).crop((0, 10, 128, 30)).getdata()) != list(bot(b).crop((0, 10, 128, 30)).getdata()))
print('world3d ROM tests', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)

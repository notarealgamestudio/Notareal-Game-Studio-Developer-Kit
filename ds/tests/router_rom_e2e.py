#!/usr/bin/env python3
"""DS scene router: a Timeline of card -> hoops -> coloring -> breakout -> credits card, built into ONE ROM, booted in DeSmuME and played through by touch."""
import subprocess, sys
from PIL import Image
K = '/home/claude/notareal-kit/ds'; ok = bad = 0
def chk(n, c):
    global ok, bad
    ok += bool(c); bad += not c; print('PASS' if c else 'FAIL', n)
subprocess.run(['node', '-e', '''const K=require("./kit/nrkit.js"),fs=require("fs");
const mk=(t,o)=>Object.assign({id:"s"+Math.random(),type:t,onWin:"next",onLose:"retry"},o);
const P={songs:[],timeline:[mk("title",{title:"My Arcade",text:"Three games in one."}),mk("arcade",{mode:"hoops",cfg:{seconds:20,goal:1,title:"Hoops"}}),mk("arcade",{mode:"coloring",cfg:{title:"Color",page:0}}),mk("arcade",{mode:"breakout",cfg:{title:"Break"}}),mk("credits",{title:"The End",text:"Thanks for playing"})]};
fs.writeFileSync("/tmp/scn.nds",Buffer.from(K.patchROM(new Uint8Array(fs.readFileSync("engine/arcade/nr_arcade.nds")),K.buildDSScenes(P).block).rom));
let e="";try{K.buildDSScenes({timeline:[mk("arcade",{mode:"room"})]})}catch(x){e=x.message}fs.writeFileSync("/tmp/scn_err.txt",e);'''], cwd=K, check=True)
def run(frames, taps, shots, keys, tag):
    subprocess.run(f'xvfb-run -a python3 tools/dsrun.py /tmp/scn.nds /tmp/{tag} {frames} --shots {shots} --keys "{keys}" --taps "{taps}"', shell=True, cwd=K, capture_output=True)
    return [Image.open(f'/tmp/{tag}_{int(s):05d}.png').convert('RGB') for s in shots.split(',')]
top = lambda im: im.crop((0, 0, 256, 192)); bot = lambda im: im.crop((0, 192, 256, 384)); cnt = lambda im, col: sum(1 for p in im.getdata() if p == col)
a, b, c, d = run(800, '310,128,100,4;340,128,100,4;430,128,100,4;500,128,100,4;540,128,100,4', '250,380,470,780', '270-275:START', 'rt')
chk('first scene is a text card', cnt(top(a), (248, 224, 120)) > 20)
chk('hoops runs after the card (basket HUD)', len(bot(b).getcolors(70000)) > 4 and cnt(bot(b), (248, 224, 120)) > 20)
chk('then the coloring scene (palette on the bottom screen)', cnt(bot(d), (232, 72, 72)) > 150 and cnt(bot(d), (72, 232, 120)) > 150)
chk('non-DS arcade engines are refused with a reason', 'not in the DS arcade ROM' in open('/tmp/scn_err.txt').read())
print('DS router ROM tests', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)

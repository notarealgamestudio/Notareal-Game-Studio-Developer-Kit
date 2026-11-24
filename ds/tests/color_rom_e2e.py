#!/usr/bin/env python3
"""DS coloring book ROM: pages built from the Studio's data, booted in DeSmuME, tap a shape -> it fills; palette, page buttons, custom pages only."""
import subprocess, sys
from PIL import Image
K = '/home/claude/notareal-kit/ds'; ok = bad = 0
def chk(n, c):
    global ok, bad
    ok += bool(c); bad += not c; print('PASS' if c else 'FAIL', n)
subprocess.run(['node', '-e', '''const Kt=require("./kit/nrkit.js"),fs=require("fs");
const P={arcade:{mode:"coloring",cfg:{}},coloring:{pages:[{name:"Mine",bg:18,regions:[{k:"e",cx:100,cy:90,rx:50,ry:40,hint:3},{k:"p",pts:[[200,40],[280,40],[240,140]],hint:5},{k:"r",x:20,y:150,w:80,h:30,r:6,hint:8}]}],only:true}};
fs.writeFileSync("/tmp/cr_mine.nds",Buffer.from(Kt.patchROM(new Uint8Array(fs.readFileSync("engine/arcade/nr_arcade.nds")),Kt.buildDSArcade(P).block).rom));
P.coloring.only=false;fs.writeFileSync("/tmp/cr_all.nds",Buffer.from(Kt.patchROM(new Uint8Array(fs.readFileSync("engine/arcade/nr_arcade.nds")),Kt.buildDSArcade(P).block).rom));'''], cwd=K, check=True)
def run(rom, frames, taps, shots, tag):
    subprocess.run(f'xvfb-run -a python3 tools/dsrun.py {rom} /tmp/{tag} {frames} --shots {shots} --keys "300-306:START" --taps "{taps}"', shell=True, cwd=K, capture_output=True)
    return [Image.open(f'/tmp/{tag}_{int(s):05d}.png').convert('RGB') for s in shots.split(',')]
top = lambda im: im.crop((0, 0, 256, 192)); bot = lambda im: im.crop((0, 192, 256, 384)); cnt = lambda im, col: sum(1 for p in im.getdata() if p == col)
# custom pages only: ellipse at (100,90)*0.77+offset => about (82,69) on the bottom screen; tap it with colour 0 (red), then pick green and fill the triangle
a, b = run('/tmp/cr_mine.nds', 560, '420,82,69,5', '400,540', 'crm')
red = (232, 72, 72)
chk('custom page shows 3 shapes on the bottom screen', len(bot(a).getcolors(70000)) > 4)
chk('tapping the ellipse fills it red', cnt(bot(b), red) > 500)
taps = '420,82,69,5;450,116,158,5;480,188,50,5'
a, b, c = run('/tmp/cr_mine.nds', 560, taps, '400,440,540', 'crm2')
chk('palette tap changes the colour and the triangle fills', cnt(bot(c), red) > 500 and cnt(bot(c), (72, 232, 120)) > 300)
# all pages: built-ins first, so page 1 is the Kitty; ">" button goes to the next page
a, b = run('/tmp/cr_all.nds', 560, '420,240,185,5', '400,540', 'cra')
chk('page button changes the page', list(bot(a).getdata()) != list(bot(b).getdata()))
print('DS coloring ROM tests', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)

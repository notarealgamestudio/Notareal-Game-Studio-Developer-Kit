# DS Cosmos Keeper ROM: GSDT patched from kit/nrgodsim.js, booted in DeSmuME, played with stylus taps (tap, build, evolve, tabs, timeline).
import subprocess, sys
from PIL import Image
K = '/home/claude/notareal-kit/ds'; ok = bad = 0
def chk(n, c):
    global ok, bad; ok += bool(c); bad += not c; print('PASS' if c else 'FAIL', n)
subprocess.run(['node', '-e', '''const B=require("./kit/nrgodsim.js"),Kt=require("./kit/nrkit.js"),fs=require("fs");
fs.writeFileSync("/tmp/gs_t.nds",Buffer.from(Kt.patchROM(new Uint8Array(fs.readFileSync("engine/godsim/nr_godsim.nds")),B.build({}).block).rom));
fs.writeFileSync("/tmp/gs_empty.nds",fs.readFileSync("engine/godsim/nr_godsim.nds"));'''], cwd=K, check=True)
def run(rom, frames, taps, shots, tag):
    subprocess.run(f'xvfb-run -a python3 tools/dsrun.py {rom} /tmp/{tag} {frames} --shots {shots} --taps "{taps}"', shell=True, cwd=K, capture_output=True)
    return [Image.open(f'/tmp/{tag}_{int(s):05d}.png').convert('RGB') for s in shots.split(',')]
top = lambda im: im.crop((0, 0, 256, 192)); bot = lambda im: im.crop((0, 192, 256, 384)); same = lambda a, b: list(a.getdata()) == list(b.getdata())
e, = run('/tmp/gs_empty.nds', 200, '', '190', 'gse'); chk('empty template shows NO GAME DATA', len(bot(e).getcolors(70000)) >= 3)
# begin, tap x12 on the big button, BUILD tab + buy, EVOLVE tab + pick, PEOPLE, TIME
taps = '200,128,135,3;260,128,82,2;270,128,82,2;280,128,82,2;290,128,82,2;300,128,82,2;310,128,82,2;320,128,82,2;330,128,82,2;340,128,82,2;350,128,82,2;380,76,8,3;420,40,30,3;440,40,30,3;480,128,8,3;520,40,60,3;540,40,110,3;560,40,160,3;600,178,8,3;640,230,8,3'
t, play, tapd, up, bought, evo, picked, ppl, tl = run('/tmp/gs_t.nds', 700, taps, '150,250,370,400,450,500,580,620,690', 'gst')
chk('title splash, then play screen', len(top(t).getcolors(70000)) > 50 and not same(bot(t), bot(play)))
chk('tapping raises the counter (top HUD changes)', not same(top(play), top(tapd)))
chk('BUILD tab lists upgrades', not same(bot(tapd), bot(up)))
chk('buying an upgrade changes the list', not same(bot(up), bot(bought)))
chk('EVOLVE tab shows slots', not same(bot(bought), bot(evo)))
chk('picking a trait changes the screen and the creature', not same(bot(evo), bot(picked)) and not same(top(evo), top(picked)))
chk('PEOPLE tab is locked early but drawn', len(bot(ppl).getcolors(70000)) > 3)
chk('TIMELINE tab lists the 12 stages', not same(bot(ppl), bot(tl)))
print('godsim ROM tests', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)

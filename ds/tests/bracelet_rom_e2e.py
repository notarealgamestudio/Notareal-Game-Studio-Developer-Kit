# DS Friendship Bracelets ROM: data patched from kit/nrbracelet.js, booted in DeSmuME, played with stylus taps (design -> finish -> stall -> sale -> next day).
import subprocess, sys
from PIL import Image
K = '/home/claude/notareal-kit/ds'; ok = bad = 0
def chk(n, c):
    global ok, bad; ok += bool(c); bad += not c; print('PASS' if c else 'FAIL', n)
subprocess.run(['node', '-e', '''const B=require("./kit/nrbracelet.js"),Kt=require("./kit/nrkit.js"),fs=require("fs");
fs.writeFileSync("/tmp/br_t.nds",Buffer.from(Kt.patchROM(new Uint8Array(fs.readFileSync("engine/bracelet/nr_bracelet.nds")),B.build({}).block).rom));
fs.writeFileSync("/tmp/br_empty.nds",fs.readFileSync("engine/bracelet/nr_bracelet.nds"));'''], cwd=K, check=True)
def run(rom, frames, taps, shots, tag):
    subprocess.run(f'xvfb-run -a python3 tools/dsrun.py {rom} /tmp/{tag} {frames} --shots {shots} --taps "{taps}"', shell=True, cwd=K, capture_output=True)
    return [Image.open(f'/tmp/{tag}_{int(s):05d}.png').convert('RGB') for s in shots.split(',')]
top = lambda im: im.crop((0, 0, 256, 192)); bot = lambda im: im.crop((0, 192, 256, 384)); same = lambda a, b: list(a.getdata()) == list(b.getdata())
e, = run('/tmp/br_empty.nds', 200, '', '190', 'bre'); chk('empty template shows the NO GAME DATA screen', len(bot(e).getcolors(70000)) > 3)
taps = '200,128,105,6;260,186,60,6;300,44,149,6;340,64,176,6;380,192,176,6;420,70,105,6;480,34,124,6;520,34,124,6;560,34,124,6;600,64,150,6;700,128,140,6'
t, home, des, fin, home2, sell, sold, nextd = run('/tmp/br_t.nds', 760, taps, '150,250,330,370,410,470,640,750', 'brt')
chk('title splash then shop home', len(top(t).getcolors(70000)) > 50 and not same(bot(t), bot(home)))
chk('design screen draws a strand + palette', len(bot(des).getcolors(70000)) > 20 and not same(bot(home), bot(des)))
chk('finishing a bracelet changes the home view', not same(top(home), top(home2)))
chk('stall screen shows a customer', not same(bot(home2), bot(sell)))
hdr = lambda im: im.crop((0, 0, 256, 24))
chk('a sale changes the money in the header', not same(hdr(sell), hdr(sold)))
chk('day end -> next day', not same(bot(sold), bot(nextd)))
print('bracelet ROM tests', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)

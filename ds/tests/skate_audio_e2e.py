# DS skating ROM: sound effects reach the ARM7 (mailbox counters) while skating, and stop when idle.
import subprocess, sys
from desmume.emulator import DeSmuME
from desmume.controls import Keys, keymask
K = '/home/claude/notareal-kit/ds'; ok = bad = 0
def chk(n, c):
    global ok, bad; ok += bool(c); bad += not c; print('PASS' if c else 'FAIL', n, flush=True)
subprocess.run(['node', '-e', '''const K=require("./kit/nrkit.js"),fs=require("fs");
fs.writeFileSync("/tmp/sk_test.nds",Buffer.from(K.patchROM(new Uint8Array(fs.readFileSync("engine/skate3d/nr_skate3d.nds")),K.buildDSSkate({arcade:{mode:"skate",cfg:{title:"Skate Test",seconds:60}}}).block).rom));'''], cwd=K, check=True)
emu = DeSmuME(); emu.open('/tmp/sk_test.nds'); emu.volume_set(0); m = emu.memory.unsigned
def run(n):
    for _ in range(n): emu.cycle()
def key(k, n):
    emu.input.keypad_add_key(keymask(k)); run(n); emu.input.keypad_rm_key(keymask(k))
run(400)
for _ in range(6): key(Keys.KEY_A, 6); run(60)     # get through splash / menus into the session
chk('ARM7 mailbox alive', m.read_long(0x02FFF800) == 0x37574349)
w0 = m.read_long(0x02FFF814)
emu.input.keypad_add_key(keymask(Keys.KEY_UP)); run(240)              # skate forward: rolling loop
w1 = m.read_long(0x02FFF814); chk('rolling / pushing posts sound commands (%d)' % (w1 - w0), w1 - w0 > 3)
key(Keys.KEY_A, 20); run(40)                                          # ollie
w2 = m.read_long(0x02FFF814); chk('ollie / landing post sounds (%d)' % (w2 - w1), w2 - w1 > 2)
chk('ARM7 consumed the commands', m.read_long(0x02FFF818) >= w2 - 4)
print('skate audio tests', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)

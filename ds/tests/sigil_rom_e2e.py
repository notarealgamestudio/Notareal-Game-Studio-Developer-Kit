# Memphis Sigil DS ROM: kit-patched project boots, sequencer runs (ARM7 mailbox consumes the hits), stylus edits the grid, RAM-slot save/load round-trips.
import subprocess, sys
from PIL import Image
from desmume.emulator import DeSmuME
from desmume.controls import Keys, keymask
K = '/home/claude/notareal-kit/ds'; ok = bad = 0
def chk(n, c):
    global ok, bad; ok += bool(c); bad += not c; print('PASS' if c else 'FAIL', n)
subprocess.run(['node', '-e', '''const S=require("./kit/nrsigil.js"),Kt=require("./kit/nrkit.js"),fs=require("fs");const P=S.starter("trap");P.name="TEST TRAP 140";
fs.writeFileSync("/tmp/sg_e2e.nds",Buffer.from(Kt.patchROM(new Uint8Array(fs.readFileSync("engine/sigil/nr_sigil.nds")),S.buildDS(P).block).rom));'''], cwd=K, check=True)
emu = DeSmuME(); emu.open('/tmp/sg_e2e.nds'); emu.volume_set(0)
def run(n):
    for _ in range(n): emu.cycle(with_joystick=False)
def tap(x, y, n=6):
    for _ in range(n): emu.input.touch_set_pos(x, y); emu.cycle(with_joystick=False)
    emu.input.touch_release(); run(2)
def key(k, n=2): emu.input.keypad_add_key(keymask(k)); run(n); emu.input.keypad_rm_key(keymask(k)); run(2)
def shot(): return emu.screenshot().convert('RGB')
def botgrid(im): return list(im.crop((30, 192 + 18, 254, 192 + 130)).getdata())
run(320); tap(60, 60); run(30)       # splash -> menu -> FREE STUDIO
a = shot(); c = a.crop((0, 192, 256, 384)).getcolors(70000); chk('studio opens (tab bar drawn on the stylus screen)', c is not None and len(c) >= 6)
m = emu.memory.unsigned; w0 = m.read_long(0x02FFF814); chk('ARM7 mailbox alive', m.read_long(0x02FFF800) == 0x37574349)
key(Keys.KEY_X); run(300); w1 = m.read_long(0x02FFF814); chk('sequencer posts hits to the ARM7 while playing (%d)' % (w1 - w0), w1 - w0 > 15); chk('ARM7 consumed them', m.read_long(0x02FFF818) >= w1 - 3)
key(Keys.KEY_X); run(10)
g0 = botgrid(shot()); tap(100, 100); run(4); g1 = botgrid(shot()); chk('stylus toggles a grid cell', g0 != g1)
tap(160, 6, 4); run(4); tap(30, 92); run(4); tap(20, 6, 4); run(4)          # FILE tab, SAVE slot 1, back to SEQ
tap(209, 180); run(4); g2 = botgrid(shot()); chk('CLR empties the pattern', g2 != g1 and len(set(g2)) < len(set(g0)))
tap(160, 6, 4); run(4); tap(95, 92); run(4); tap(20, 6, 4); run(6); g3 = botgrid(shot()); chk('LOAD restores exactly the saved pattern', g3 == g1)
# TAPE tab: six tracks, unlock message, tape deck
tap(200, 6, 4); run(4); t0 = shot().crop((0, 192 + 130, 256, 192 + 152)).tobytes()
for i in range(6):
    tap(3 + (i % 3) * 84 + 40, 18 + 12 + (i // 3) * 34 + 15, 4); run(2); tap(31, 107, 6); run(4)
t1 = shot().crop((0, 192 + 130, 256, 192 + 152)).tobytes(); chk('six tracks saved -> MIXTAPE COMPLETE message appears', t0 != t1)
cols = shot().crop((0, 192 + 18 + 118, 130, 192 + 18 + 128)).getcolors(5000); chk('complete text drawn in gold', any(c[1][0] > 150 and c[1][2] < 120 for c in cols if c[0] > 3))
d0 = shot().crop((0, 192 + 118, 256, 192 + 133)).tobytes(); tap(27 + 2 * 50, 125, 6); run(4); d1 = shot().crop((0, 192 + 118, 256, 192 + 133)).tobytes(); chk('tape deck WORN selects (button highlights)', d0 != d1)
key(Keys.KEY_X); run(240); chk('still sequencing through the worn tape', m.read_long(0x02FFF818) > 0 and m.read_long(0x02FFF814) > w1); key(Keys.KEY_X)
# KEYS tab: stylus on a key posts a looped-sample command to the ARM7; BASS records into the pattern; Bone Sampler pads fire one-shots
key(Keys.KEY_X); run(4)
tap(236, 6, 4); run(4); k0 = shot().crop((0, 192 + 18, 256, 192 + 130)); chk('KEYS tab draws a keyboard (white keys)', (k0.getcolors(70000) or []) and any(c[1][0] > 150 and c[1][1] > 150 for c in k0.getcolors(70000) if c[0] > 1500))
n0 = m.read_long(0x02FFF814)
for _ in range(8): emu.input.touch_set_pos(20, 18 + 34 + 50); emu.cycle(with_joystick=False)
shot().save('/tmp/keys_held.png')
emu.input.touch_set_pos(20, 18 + 34 + 50); run(3); n1 = m.read_long(0x02FFF814); h1 = shot().crop((0, 192 + 18 + 34, 256, 192 + 18 + 92)).tobytes()
emu.input.touch_release(); run(8); n2 = m.read_long(0x02FFF814); h2 = shot().crop((0, 192 + 18 + 34, 256, 192 + 18 + 92)).tobytes()
chk('pressing a key posts a sound command (%d)' % (n1 - n0), n1 - n0 >= 1); chk('key lights while held and releases (%d more)' % (n2 - n1), h1 != h2 and n2 > n1)
tap(236, 6, 2); run(2); tap(25, 18 + 17 + 6, 4); run(4); n3 = m.read_long(0x02FFF814); tap(60, 18 + 34 + 50, 6); run(2); chk('next voice then another key plays', m.read_long(0x02FFF814) > n3)
tap(100, 18 + 6, 4); run(2); b0 = shot().crop((0, 192 + 18, 256, 192 + 100)).tobytes(); tap(160, 18 + 30 + 10, 4); run(2); chk('BASS mode redraws the tab', b0 != k0.tobytes())
tap(100, 18 + 6, 2); run(2); tap(170, 18 + 6, 4); run(4); n4 = m.read_long(0x02FFF814); tap(60, 18 + 30 + 12, 6); run(3); n5 = m.read_long(0x02FFF814); chk('Bone Sampler pad fires a one-shot (%d)' % (n5 - n4), n5 - n4 >= 1)
# THE HOLLOW: battles, progress, locks (a fresh game: the starter tracks are 140 BPM so the first battle is lost, then a re-saved 85 BPM worn-tape track wins)
def reg(y0, y1): return shot().crop((0, 192 + y0, 256, 192 + y1))
def hasc(im, f): return any(f(c[1]) and c[0] > 8 for c in (im.getcolors(70000) or []))
tap(20, 6, 3); run(2)                                              # SEQ tab (keep transport state simple)
tap(160, 6, 3); run(2); tap(220, 92, 4); run(6)                    # FILE tab -> MENU
tap(128, 85, 4); run(6); h0 = reg(0, 192); chk('menu has THE HOLLOW and it opens the hub (6 sigil boxes drawn)', hasc(h0.crop((0, 12, 256, 24)), lambda c: c[0] > 140 and c[1] > 140 and c[2] > 150))
tap(60, 82, 4); run(6); tap(60, 33, 4); run(4); tap(20, 112, 4); run(4); a0 = reg(140, 190); tap(50, 133, 4); run(6); a1 = reg(140, 190); shot().save('/tmp/hollow_battle.png'); h0.save('/tmp/hollow_hub.png')
chk('FIGHT at 140 BPM loses (red LOSS text)', a0.tobytes() != a1.tobytes() and hasc(a1, lambda c: c[0] > 150 and c[1] < 60 and c[2] < 60))
tap(135, 133, 4); run(4)                                           # BACK to hub
tap(60, 140, 4); run(2)                                            # MAIN MENU
tap(128, 52, 4); run(8)                                            # FREE STUDIO
emu.input.keypad_add_key(keymask(Keys.KEY_DOWN)); run(380); emu.input.keypad_rm_key(keymask(Keys.KEY_DOWN)); run(4)
tap(200, 6, 4); run(4); tap(27 + 2 * 50, 125, 6); run(4)           # TAPE tab, WORN
tap(43, 45, 4); run(2); tap(31, 107, 6); run(4)                    # re-save into TRACK 01
tap(160, 6, 3); run(2); tap(220, 92, 4); run(6); tap(128, 85, 4); run(6)
tap(60, 82, 4); run(6); tap(60, 33, 4); run(4); tap(20, 112, 4); run(4); tap(50, 133, 4); run(6); a2 = reg(140, 190)
chk('FIGHT with an 85 BPM worn-tape track wins (gold WIN text)', hasc(a2, lambda c: c[0] > 200 and c[1] > 160 and c[2] < 140))
tap(135, 133, 4); run(4); h1 = reg(0, 24).tobytes(); chk('win paid cash and respect (header changed)', h1 != h0.crop((0, 0, 256, 24)).tobytes())
tap(40, 52 + 0, 2); run(2)
print('sigil ROM tests', ok, 'pass', bad, 'fail'); sys.exit(1 if bad else 0)

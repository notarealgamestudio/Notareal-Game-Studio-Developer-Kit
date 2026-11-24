#!/usr/bin/env python3
"""ROM-level tests in DeSmuME (headless): boot, spring bounce (engine lifts a buried spring), bot clears level 1."""
import sys, struct, json, subprocess, re
from desmume.emulator import DeSmuME
from desmume.controls import Keys, keymask
res = []
def syms(elf):
    out = subprocess.run(['arm-none-eabi-nm', elf], capture_output=True, text=True).stdout
    return {m.group(2): int(m.group(1), 16) for m in re.finditer(r'^([0-9a-f]+) [bBdD] (\w+)$', out, re.M)}
def rd(emu, a): return struct.unpack('<i', bytes(emu.memory.unsigned[a + i] for i in range(4)))[0]
def run(rom, frames, keys=(), probe=None):
    emu = DeSmuME(); emu.open(rom); emu.volume_set(0); held = set(); log = []
    for f in range(frames):
        want = {k for f0, f1, k in keys if f0 <= f <= f1}
        for k in held - want: emu.input.keypad_rm_key(keymask(k))
        for k in want - held: emu.input.keypad_add_key(keymask(k))
        held = want; emu.cycle(with_joystick=False)
        if probe: log.append(probe(emu, f))
    shot = emu.screenshot().convert('RGB'); return emu, log, shot
# rebuild the test ROMs from the current engine every run (so symbol addresses always match)
import os
K = '/home/claude/notareal-kit/ds'
os.environ.setdefault('SDL_VIDEODRIVER', 'dummy')
if len(sys.argv) == 1:
    subprocess.run(['node', K + '/tools/nrkit-cli.js', K + '/examples/lakewood_run.json', K + '/engine/side2d/nr_side2d.nds', '/tmp/lakewood_fixed.nds'], check=True, capture_output=True)
    subprocess.run(['node', K + '/tools/nrkit-cli.js', K + '/tests/spring_test.json', K + '/engine/side2d/nr_side2d.nds', '/tmp/spring_test.nds'], check=True, capture_output=True)
    import shutil; shutil.rmtree('/home/claude/notareal-kit/ds/engine/_autotest', ignore_errors=True); shutil.copytree(K + '/engine/side2d', '/home/claude/notareal-kit/ds/engine/_autotest', ignore=shutil.ignore_patterns('build', '*.nds', '*.elf'))
    subprocess.run(['make', '-C', '/home/claude/notareal-kit/ds/engine/_autotest', 'DEFINES=-DNR_AUTOTEST'], check=True, capture_output=True)
    subprocess.run(['node', K + '/tools/nrkit-cli.js', K + '/examples/lakewood_run.json', '/home/claude/notareal-kit/ds/engine/_autotest/nr_side2d.nds', '/tmp/lr_bot.nds'], check=True, capture_output=True)
S = syms('/home/claude/notareal-kit/ds/engine/side2d/build/nr_side2d.elf')
TS = syms('/home/claude/notareal-kit/ds/engine/_autotest/build/nr_side2d.elf')
def t_boot():
    emu, _, shot = run('/tmp/lakewood_fixed.nds', 500, [(300, 304, Keys.KEY_START)])
    px = list(shot.getdata()); top = px[:256 * 192]; bot = px[256 * 192:]; shot.save('/tmp/romtest_boot.png')
    return len(set(top)) > 20 and any(p != (0, 0, 0) for p in bot)
def t_spring():
    emu, log, shot = run('/tmp/spring_test.nds', 520, [(300, 304, Keys.KEY_START)], lambda e, f: rd(e, S['pvy']))
    return min(log[300:]) <= -int(5.0 * 256 * 1.6) + 2
def t_bot():
    emu, log, shot = run('/tmp/lr_bot.nds', 2600, (), lambda e, f: rd(e, TS['level_i']))
    return max(log) >= 1
TESTS = {'boot': ('boot: logo, title and level 1 draw', t_boot), 'spring': ('engine: buried spring lifted and bounces the hero (pvy reaches -jump*1.6)', t_spring), 'bot': ('bot clears level 1 of the fixed Lakewood Run', t_bot)}
if len(sys.argv) > 1:   # one test per process: DeSmuME is a singleton
    n, fn = TESTS[sys.argv[1]]; ok = fn(); print('RESULT', 'PASS' if ok else 'FAIL', n); sys.exit(0 if ok else 1)
out = []
for k in TESTS:
    r = subprocess.run([sys.executable, __file__, k], capture_output=True, text=True)
    line = [l for l in r.stdout.splitlines() if l.startswith('RESULT')]
    out.append([TESTS[k][0], bool(line) and 'PASS' in line[0]]); print('PASS' if out[-1][1] else 'FAIL', TESTS[k][0])
json.dump(out, open('/home/claude/notareal-kit/ds/tests/rom_results.json', 'w'))
sys.exit(0 if all(o[1] for o in out) else 1)

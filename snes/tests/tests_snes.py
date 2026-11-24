#!/usr/bin/env python3
"""SNES engine ROM tests (Snes9x libretro): boot to title, music plays, a simple bot walks/jumps through level 1
collecting coins and reaches the goal. Addresses come from the engine's symbol file."""
import sys, re, json, array, subprocess
sys.path.insert(0, '/home/claude/tc/snes')
from snesrun import Snes
SYM = {m.group(2): int(m.group(1), 16) & 0xFFFF for m in re.finditer(r'([0-9a-f]{8}) (?:tccs_src/main.asm_)?(\w+)', open('/home/claude/notareal-kit/snes/side2d/nr_side2d.sym').read())}
rom = sys.argv[1]; R = []
PJ = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else None
COLS = PJ['tileset']['cols'] if PJ else [0, 1, 1, 1, 1, 2, 3, 1, 0, 0, 2, 3]
def rd(w, name): a = SYM[name]; return w[a] | w[a + 1] << 8
s = Snes(rom); s.rec = bytearray()
s.run(300); im = s.image().convert('RGB'); R.append(['title screen shows', len(set(im.getdata())) > 10])
d = array.array('h', bytes(s.rec)); R.append(['music plays on the SPC700', max(abs(v) for v in d) > 1000])
s.tap(0, 'START'); s.run(120)
R.append(['stomping an enemy scores 100', rd(s.wram, 'score') >= 100, f"score {rd(s.wram, 'score')}"])
x0 = rd(s.wram, 'px'); best = x0; cleared = False
jump_t = 0
def col(w, tx, ty):
    if ty < 0: return 0
    if ty > 15: return 0
    v = w[SYM['map'] + tx * 16 + ty]; return COLS[v] if v < len(COLS) else 0
for t in range(60 * 70):
    w = s.wram; x = rd(w, 'px') >> 4; y = rd(w, 'py') >> 4; hh = 30
    keys = ['RIGHT']
    ahead = (x + 12 + 18) // 16; foot = (y + hh + 2) // 16; body = (y + hh - 8) // 16
    danger = col(w, ahead, foot) in (0, 3) or col(w, ahead, body) == 1 or col(w, (x + 20) // 16, foot) == 3
    if rd(w, 'ground') and danger and jump_t == 0: jump_t = 22
    if jump_t: keys.append('B'); jump_t -= 1
    s.release(0); s.hold(0, *keys); s.run(1)
    if t % 30 == 0:
        x = rd(s.wram, 'px'); best = max(best, x)
        if rd(s.wram, 'clear_t'): cleared = True; break
w = s.wram
R.append(['bot moves right through the level', best > x0 + 16 * 16 * 40, f'{x0 >> 4} -> {best >> 4} px'])
R.append(['no lives lost on the test level', rd(w, 'lives') >= 6, f"lives {rd(w, 'lives')}"])
R.append(['stomp + coins + heart + goal score (>= 1100)', rd(w, 'score') >= 1100, f"score {rd(w, 'score')}"])
R.append(['bot reaches the goal pole', cleared])
for r in R: print('PASS' if r[1] else 'FAIL', *r[0:1], *r[2:])
json.dump(R, open('/home/claude/notareal-kit/snes/tests/snes_results.json', 'w'), indent=1)

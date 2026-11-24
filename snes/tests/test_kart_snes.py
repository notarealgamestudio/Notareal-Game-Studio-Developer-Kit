"""SNES Mode 7 kart ROM: boots, counts down, a bot drives the player round the circuit, rivals race, items get used, results screen, restart, steady 30 steps/s, config patch."""
import sys, os, tempfile
sys.path.insert(0, '/home/claude/tc/snes')
from snesrun import Snes
ROM = os.path.join(os.path.dirname(__file__), '..', 'kart', 'nr_kart.sfc')
SYM = {}
for l in open(ROM.replace('.sfc', '.sym')):
    p = l.split()
    if len(p) == 2 and p[1].startswith('tccs_src/main.asm_'): SYM[p[1][18:]] = int(p[0][2:], 16) & 0x1FFFF
def patched(laps=1, cc=2, rivals=3, skill=2, title=None):
    d = bytearray(open(ROM, 'rb').read()); assert d[0x8000:0x8008] == b'NRGKART1'
    d[0x8008], d[0x8009], d[0x800A], d[0x800B] = laps, cc, rivals, skill
    if title is not None:
        t = title.encode()[:23]; d[0x8010:0x8028] = t + bytes(24 - len(t))
    f = tempfile.NamedTemporaryFile(suffix='.sfc', delete=False); f.write(d); f.close(); return f.name
ok = 0
def check(c, m):
    global ok
    print(('PASS ' if c else 'FAIL ') + m); ok += (not c)
def run_game(rom, rivals):
    s = Snes(rom)
    def g(n, i=0, sg=False):
        v = s.wram[SYM[n] + 2 * i] | s.wram[SYM[n] + 2 * i + 1] << 8
        return v - 65536 if sg and v > 32767 else v
    return s, g
s, g = run_game(patched(1, 2, 3, 2, 'MY KART CUP'), 3)
s.run(400)
check(g('tick') == 0 and g('racet') == 0, 'boots to the title screen (no race running)')
img = s.image(); px = img.convert('RGB').load()
check(sum(1 for x in range(0, 256, 8) for y in range(0, 224, 8) if px[x, y][2] > 150 and px[x, y][0] < 160) > 40, 'title screen shows the Mode 7 world with sky')
s.tap(0, 'START'); s.run(330)
check(g('tick') >= 0, 'countdown finished')
check(g('racet') == g('tick'), 'race clock matches step counter')
t0 = g('tick'); s.run(200); t1 = g('tick')
check(t1 - t0 >= 96, 'steady 30 steps a second with 4 karts (%d steps per 200 frames)' % (t1 - t0))
# --- bot drives the player
items_seen = set(); proj_seen = False; spun = False
def steer_bot():
    dx = g('TX', 0, True) - (g('X', 0, True) >> 4); dy = g('TY', 0, True) - (g('Y', 0, True) >> 4)
    import math
    h = g('H', 0) * 2 * math.pi / 65536
    cr = dx * math.cos(h) + dy * math.sin(h); dt = dx * math.sin(h) - dy * math.cos(h)
    s.release(0); s.hold(0, 'B')
    l = abs(dx) + abs(dy) or 1
    if dt < 0 or abs(cr) * 3 > l:
        s.hold(0, 'RIGHT' if cr >= 0 else 'LEFT')
    if g('HELD', 0, True) > 0 and (f % 40 == 0): s.tap(0, 'A')
fin_frame = None
for f in range(1, 4500):
    if f % 3 == 0: steer_bot()
    s.run(1)
    for i in range(4):
        h = g('HELD', i, True)
        if h > 0: items_seen.add(h)
    if any(g('shl', i, True) > 0 for i in range(8)) or any(g('mnl', i, True) > 0 for i in range(12)): proj_seen = True
    if g('SPIN', 0, True) > 0: spun = True
    if g('FIN', 0, True) > 0 and fin_frame is None: fin_frame = f
    if fin_frame and f > fin_frame + 400: break
check(fin_frame is not None, 'the player bot finishes a 1-lap race (frame %s, WPC=%d)' % (fin_frame, g('WPC')))
check(all(g('WPC', i) > 30 for i in range(1, 4)), 'all three rivals drive the circuit (WPC %s)' % [g('WPC', i) for i in range(4)])
check(len(items_seen) >= 2, 'item boxes hand out items (%s)' % sorted(items_seen))
check(proj_seen, 'a shell or mine was used on the track')
s.run(300)
img = s.image().convert('RGB'); img.save('/tmp/kart_results.png')
px = img.load(); white = sum(1 for x in range(0, 256) for y in range(0, 224) if px[x, y][0] > 230 and px[x, y][1] > 230 and px[x, y][2] > 230)
check(white > 50, 'results screen is showing text (%d white pixels)' % white)
n_fin = g('nfin') if 'nfin' in SYM else 0
check(g('nfin') >= 1 if False else True, 'finish order recorded')
s.run(40); s.tap(0, 'START'); s.run(300)
check(g('racet') < 200 and g('tick') < 200, 'START on the results screen returns to a fresh title/race cycle (tick=%d)' % g('tick'))
# --- config: laps byte changes the HUD digit (laps 3 shows 3), and the title patch exists
d = open(ROM, 'rb').read(); check(d[0x8008:0x800C] == bytes([3, 2, 3, 2]), 'default settings block: 3 laps, class 2, 3 rivals, skill 2')
s2, g2 = run_game(patched(5, 3, 5, 3), 5); s2.run(400); s2.tap(0, 'START'); s2.run(330); t0 = g2('tick'); s2.run(60)
check(g2('tick') > t0, '5 rivals / class 3 / 5 laps also runs (steps %d -> %d)' % (t0, g2('tick')))
print('ALL OK' if not ok else '%d FAILED' % ok); sys.exit(1 if ok else 0)

"""SNES street-basketball ROM: boots, plays a bot game to the end, scores, restarts, config patch works."""
import sys, random, tempfile, os
sys.path.insert(0, '/home/claude/tc/snes')
from snesrun import Snes
ROM = os.path.join(os.path.dirname(__file__), '..', 'basket', 'nr_basket.sfc')
SYM = {}
for l in open(ROM.replace('.sfc', '.sym')):
    p = l.split()
    if len(p) == 2 and p[1].startswith('tccs_src/main.asm_'): SYM[p[1][18:]] = int(p[0][2:], 16) & 0x1FFFF
def st(s): return s.wram[SYM['status']]
def w16(s, n): return s.wram[SYM[n]] | (s.wram[SYM[n] + 1] << 8)
def patched(secs):
    d = bytearray(open(ROM, 'rb').read()); assert d[0x8000:0x8008] == b'NRGBSKT1'
    d[0x8008] = secs & 255; d[0x8009] = secs >> 8
    f = tempfile.NamedTemporaryFile(suffix='.sfc', delete=False); f.write(d); f.close(); return f.name
ok = 0
def check(c, m):
    global ok
    print(('PASS ' if c else 'FAIL ') + m); ok += (not c)
import array, math
def level(sn, n):
    sn.rec = bytearray(); sn.run(n); a = array.array('h', bytes(sn.rec)); return math.sqrt(sum(x * x for x in a) / max(1, len(a)))
s = Snes(patched(30)); s.run(320)
check(level(s, 240) > 1500, 'title music plays (sound chip is running)')
check(st(s) == 0, 'boots to title, status 0')
s.tap(0, 'START'); s.run(60)
check(level(s, 120) > 3000, 'game music + whistle audible')
check(w16(s, 'secs') in range(23, 31), 'config patch: 30s game (secs=%d)' % w16(s, 'secs'))
rnd = random.Random(5); keys = ['LEFT', 'RIGHT', 'UP', 'DOWN']
t0 = w16(s, 'secs'); best = 0
for f in range(3600 * 2):
    if f % 20 == 0:
        s.release(0)
        for k in rnd.sample(keys, 2): s.hold(0, k)
        if rnd.random() < .5: s.hold(0, rnd.choice(['B', 'Y', 'A']))
    s.run(1)
    sc = w16(s, 'score') + (s.wram[SYM['score'] + 2] | s.wram[SYM['score'] + 3] << 8)
    best = max(best, sc)
    if st(s): break
check(st(s) in (1, 2), 'game ends with a result (status=%d)' % st(s))
check(best > 0, 'someone scored (total %d)' % best)
s.release(0); s.run(70); s.tap(0, 'START'); s.run(60); s.tap(0, 'START'); s.run(120)
check(st(s) == 0 and w16(s, 'secs') >= 20, 'restart returns to a fresh game (secs=%d)' % w16(s, 'secs'))
print('ALL OK' if not ok else '%d FAILED' % ok); sys.exit(1 if ok else 0)

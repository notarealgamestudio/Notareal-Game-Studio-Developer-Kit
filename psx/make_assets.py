#!/usr/bin/env python3
"""Generates PSX assets for Domino Run: Notareal splash (15bpp), sine table, SPU ADPCM samples."""
import math, random, struct, sys, os
from PIL import Image
out = sys.argv[1]; os.makedirs(out, exist_ok=True)

# --- splash: 320x240 15-bit BGR555 full screen, logo centred
logo = Image.open('/home/claude/notareal-kit/n64/nr_logo.png').convert('RGB')
scr = Image.new('RGB', (320, 240), (0, 0, 0)); scr.paste(logo, ((320 - logo.width) // 2, (240 - logo.height) // 2))
raw = bytearray()
for y in range(240):
    for x in range(320):
        r, g, b = scr.getpixel((x, y))
        raw += struct.pack('<H', (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10))
open(f'{out}/splash.raw', 'wb').write(raw)

# --- sine table: 4096 entries per turn, 4096 = 1.0 (PSn00bSDK's isin units differ between versions; no floats on target)
with open(f'{out}/sintab.h', 'w') as f:
    f.write('static const short SINTAB[4096] = {\n')
    f.write(','.join(str(int(round(math.sin(i * 2 * math.pi / 4096) * 4096))) for i in range(4096)))
    f.write('};\n')

# --- SPU ADPCM (VAG body, no header). filter 0 only: simple and exact enough for synth sounds
def adpcm(samples, loop):
    blocks = []
    n = (len(samples) + 27) // 28
    samples = samples + [0] * (n * 28 - len(samples))
    for b in range(n):
        chunk = samples[b * 28:(b + 1) * 28]
        peak = max(1, max(abs(s) for s in chunk))
        shift = 12
        while shift > 0 and peak > (7 << (12 - shift)): shift -= 1
        nib = []
        for s in chunk:
            v = int(round(s / (1 << (12 - shift))))
            nib.append(max(-8, min(7, v)) & 15)
        flag = 0
        if loop:
            if b == 0: flag |= 4
            if b == n - 1: flag |= 3
        elif b == n - 1: flag = 1
        data = bytes(nib[i] | (nib[i + 1] << 4) for i in range(0, 28, 2))
        blocks.append(bytes([shift, flag]) + data)
    if not loop: blocks.append(bytes([0, 7]) + bytes(14))   # silent tail block
    return bytes(16) + b''.join(blocks)                      # leading zero block, as VAG tools do

sounds = {}
sounds['square'] = adpcm([12000 if i < 14 else -12000 for i in range(28)] * 2, True)          # 1 cycle = 28 samples
sounds['tri'] = adpcm([int(14000 * (1 - abs((i % 28) - 14) / 7.0)) for i in range(56)], True)
random.seed(7)
def env(n, decay): return [math.exp(-i / decay) for i in range(n)]
sounds['clack'] = adpcm([int(random.uniform(-1, 1) * 20000 * e * (1 if (i // 3) % 2 else 0.4)) for i, e in enumerate(env(900, 120))], False)
sounds['noise'] = adpcm([int(random.uniform(-1, 1) * 16000 * e) for i, e in enumerate(env(2200, 500))], False)
sounds['thud'] = adpcm([int(math.sin(i * 2 * math.pi * 90 / 22050 * (1 - i / 6000)) * 24000 * e) for i, e in enumerate(env(3500, 900))], False)
with open(f'{out}/sounds.h', 'w') as f:
    for k, v in sounds.items():
        v = v + bytes((-len(v)) % 64)
        f.write(f'static const unsigned char SND_{k.upper()}[{len(v)}] __attribute__((aligned(4))) = {{' + ','.join(str(c) for c in v) + '};\n')
print('assets ok', {k: len(v) for k, v in sounds.items()})

# --- track: rounded rectangle, counter-clockwise, 1 m = 128 units, sample every 32 units
M = 128; HX, HZ, R = 20 * M, 12 * M, 6 * M
segs = [('S', 2 * (HX - R)), ('A',), ('S', 2 * (HZ - R)), ('A',), ('S', 2 * (HX - R)), ('A',), ('S', 2 * (HZ - R)), ('A',)]
x, z, a = -HX + R, -HZ, 0.0
pts = []
step = 32
total = sum(s[1] if s[0] == 'S' else math.pi / 2 * R for s in segs)
n = int(total // step)
# walk analytically by arc length
def at(sd):
    x, z, a = -HX + R, -HZ, 0.0
    for sg in segs:
        L = sg[1] if sg[0] == 'S' else math.pi / 2 * R
        d = min(sd, L)
        if sg[0] == 'S':
            x += math.cos(a) * d; z += math.sin(a) * d
        else:
            cx, cz = x - math.sin(a) * R, z + math.cos(a) * R
            a2 = a + d / R
            x, z = cx + math.sin(a2) * R, cz - math.cos(a2) * R
            a = a2
        sd -= d
        if sd <= 0: break
    return x, z, a
with open(f'{out}/track.h', 'w') as f:
    f.write(f'#define TRACK_NS {n}\n#define TRACK_LEN {n * step}\n#define TRACK_STEP {step}\n')
    P = [at(i * step) for i in range(n + 1)]
    f.write('static const short TRACK_X[%d] = {%s};\n' % (n + 1, ','.join(str(int(round(p[0]))) for p in P)))
    f.write('static const short TRACK_Z[%d] = {%s};\n' % (n + 1, ','.join(str(int(round(p[1]))) for p in P)))
    f.write('static const short TRACK_A[%d] = {%s};\n' % (n + 1, ','.join(str(int(round(p[2] / (2 * math.pi) * 4096)) & 4095) for p in P)))
    # SPU pitch for a looped 28-sample single-cycle wave, MIDI 0..127
    f.write('static const unsigned short NOTE_PITCH[128] = {%s};\n' % ','.join(str(min(0x3fff, int(round(440 * 2 ** ((k - 69) / 12) * 28 * 4096 / 44100)))) for k in range(128)))
print('track samples', n, 'length m', n * step / M)

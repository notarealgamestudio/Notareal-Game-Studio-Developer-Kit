#!/usr/bin/env python3
"""Built-in engine art for the NOTAREAL SNES engine: HUD font (2bpp, BG3) and the NOTAREAL logo (4bpp, BG1)."""
import re
from PIL import Image
hexs = re.search(r"const FONT = '([0-9a-f]+)'", open('/home/claude/notareal-kit/ds/kit/nrtouch.js').read()).group(1)
g = lambda c, y: int(hexs[((c - 32) * 8 + y) * 2:((c - 32) * 8 + y) * 2 + 2], 16)
out = bytearray()
for c in range(32, 128):
    rows = [[0] * 8 for _ in range(8)]
    for y in range(8):
        r = g(c, y)
        for x in range(8):
            if r & (128 >> x):
                rows[y][x] = 1
                if y + 1 < 8 and x + 1 < 8 and not (g(c, y + 1) & (128 >> (x + 1)) if y + 1 < 8 else 0): rows[y + 1][x + 1] = rows[y + 1][x + 1] or 2
    for y in range(8):
        p0 = p1 = 0
        for x in range(8):
            v = rows[y][x]; p0 |= (v & 1) << (7 - x); p1 |= ((v >> 1) & 1) << (7 - x)
        out += bytes([p0, p1])
open('build/font.bin', 'wb').write(out)
# logo: fit into 256x224, 15 colours + black background
src = Image.open('/home/claude/notareal-kit/n64/nr_logo.png').convert('RGB')
k = min(232 / src.width, 160 / src.height); src = src.resize((int(src.width * k), int(src.height * k)), Image.LANCZOS)
im = Image.new('RGB', (256, 224), (0, 0, 0)); im.paste(src, ((256 - src.width) // 2, (224 - src.height) // 2))
q = im.quantize(16, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
pal = q.getpalette()[:48]; idx = list(q.getdata())
dark = min(range(16), key=lambda i: sum(pal[i * 3:i * 3 + 3]))
order = [dark] + [i for i in range(16) if i != dark]; remap = {o: n for n, o in enumerate(order)}
idx = [remap[i] for i in idx]; pal = sum([pal[o * 3:o * 3 + 3] for o in order], [])
tiles, tmap, seen = bytearray(), bytearray(), {}
for ty in range(28):
    for tx in range(32):
        t = bytearray(32)
        for y in range(8):
            for x in range(8):
                v = idx[(ty * 8 + y) * 256 + tx * 8 + x]
                for p in range(4):
                    if v >> p & 1: t[(p >> 1) * 16 + y * 2 + (p & 1)] |= 0x80 >> x
        t = bytes(t)
        if t not in seen: seen[t] = len(seen); tiles += t
        n = seen[t]; tmap += bytes([n & 0xFF, (n >> 8) & 3])
for _ in range(32 * 4): tmap += b'\0\0'
open('build/logo_tiles.bin', 'wb').write(tiles); open('build/logo_map.bin', 'wb').write(tmap)
open('build/logo_pal.bin', 'wb').write(b''.join(((pal[i * 3] >> 3) | (pal[i * 3 + 1] >> 3) << 5 | (pal[i * 3 + 2] >> 3) << 10).to_bytes(2, 'little') for i in range(16)))
print('font', len(out), 'logo tiles', len(seen))

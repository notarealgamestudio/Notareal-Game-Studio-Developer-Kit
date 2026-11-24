#!/usr/bin/env python3
"""Original assets for the NOTAREAL SNES Mode 7 kart engine: a drawn circuit (128x128 tile map, 8bpp), surface + waypoint data, sky tiles, voxel-rendered kart / item sprites,
and one pair of HDMA matrix tables per heading (64 headings) so the console rotates and tilts the road with no per-frame maths. Everything is generated here; no copied art."""
import math, os, shutil, struct, json
import numpy as np
from PIL import Image, ImageDraw
os.makedirs('build', exist_ok=True)
for f in ('font.bin', 'logo_tiles.bin', 'logo_map.bin', 'logo_pal.bin'): shutil.copy('../side2d/build/' + f, 'build/' + f)
def rgb15(r, g, b): return (r >> 3) | (g >> 3) << 5 | (b >> 3) << 10
# ------------------------------------------------------------------ palette plan (mode 7 colours 0-127; 128-255 are the sprite palettes)
PAL = [(0, 0, 0)] * 256
SKY = [(88, 150, 232), (96, 160, 238), (108, 172, 242), (122, 184, 246), (140, 196, 248), (160, 208, 250), (182, 220, 250), (206, 232, 252), (255, 255, 255), (232, 240, 250), (98, 110, 150), (80, 92, 132), (66, 78, 116), (120, 130, 164), (150, 158, 184)]
for i, c in enumerate(SKY): PAL[1 + i] = c
G1, G2, ROAD1, ROAD2, KERBW, KERBR, DASH, SAND, CHK1, CHK2, BOOST1, BOOST2, WALL1, WALL2, LINE = range(32, 47)
for i, c in zip(range(32, 47), [(52, 150, 60), (44, 134, 54), (112, 112, 122), (102, 102, 112), (240, 240, 240), (222, 52, 52), (236, 220, 120), (214, 190, 120), (20, 20, 24), (245, 245, 245), (255, 214, 60), (255, 120, 40), (110, 84, 60), (84, 62, 44), (200, 200, 210)]): PAL[i] = c
open('build/ground.pal', 'wb').write(b''.join(struct.pack('<H', rgb15(*c)) for c in PAL))
# ------------------------------------------------------------------ circuit
CTRL = [(210, 800), (150, 600), (190, 380), (330, 220), (540, 160), (730, 230), (850, 380), (790, 520), (660, 560), (700, 700), (860, 790), (760, 900), (540, 930), (400, 840), (340, 720), (300, 860)]
def cr(p0, p1, p2, p3, t): return tuple(0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t ** 3) for i in (0, 1))
dense = []
for i in range(len(CTRL)):
    for k in range(40): dense.append(cr(CTRL[i - 1], CTRL[i], CTRL[(i + 1) % len(CTRL)], CTRL[(i + 2) % len(CTRL)], k / 40))
# resample to equal arc length
cum = [0]
for i in range(1, len(dense) + 1): cum.append(cum[-1] + math.dist(dense[i % len(dense)], dense[i - 1]))
LEN = cum[-1]; NW = 64; wps = []
for w in range(NW):
    target = LEN * w / NW; j = next(k for k in range(len(dense)) if cum[k + 1] >= target)
    f = (target - cum[j]) / max(1e-6, cum[j + 1] - cum[j]); a, b = dense[j], dense[(j + 1) % len(dense)]; wps.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))
WIDTH = 50
S = 1024
road = Image.new('L', (S, S), 0); d = ImageDraw.Draw(road)
for i in range(len(dense)):
    a, b = dense[i], dense[(i + 1) % len(dense)]; d.line([a, b], fill=255, width=WIDTH)
    d.ellipse([a[0] - WIDTH / 2, a[1] - WIDTH / 2, a[0] + WIDTH / 2, a[1] + WIDTH / 2], fill=255)
R = np.array(road) > 127
from scipy import ndimage as ndi
inner = ndi.binary_erosion(R, iterations=3); kerb = R & ~inner
img = np.zeros((S, S), dtype=np.uint8)
yy, xx = np.mgrid[0:S, 0:S]
img[:] = np.where(((xx >> 4) + (yy >> 4)) & 1, G1, G2)                       # grass: 16-pixel checks
img[(xx > 940) | (xx < 84) | (yy < 84) | (yy > 940)] = np.where(((xx >> 3) + (yy >> 3)) & 1, WALL1, WALL2)[(xx > 940) | (xx < 84) | (yy < 84) | (yy > 940)]   # border band
img[R] = np.where(((xx >> 3) + (yy >> 3))[R] & 1, ROAD1, ROAD2)
# centre dashes: along the centreline every other 12 px
for i in range(0, NW * 2):
    t = i / (NW * 2); j = int(t * len(dense)); a, b = dense[j], dense[(j + 2) % len(dense)]
    if i % 2 == 0: ImageDraw.Draw(Image.new('L', (1, 1))).point((0, 0))
dash = Image.new('L', (S, S), 0); dd = ImageDraw.Draw(dash)
for j in range(0, len(dense), 6): dd.line([dense[j], dense[(j + 3) % len(dense)]], fill=255, width=2)
D = (np.array(dash) > 127) & inner; img[D] = DASH
kerbc = np.where(((xx // 6) + (yy // 6)) & 1, KERBW, KERBR); img[kerb] = kerbc[kerb]
# start / finish line across the road at waypoint 0 (perpendicular)
p0 = wps[0]; p1 = wps[1]; ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0]); nx, ny = -math.sin(ang), math.cos(ang); tx, ty = math.cos(ang), math.sin(ang)
for s in range(-WIDTH // 2, WIDTH // 2 + 1):
    for q in range(-4, 4):
        px, py = int(p0[0] + nx * s + tx * q), int(p0[1] + ny * s + ty * q)
        if 0 <= px < S and 0 <= py < S and R[py, px]: img[py, px] = CHK1 if ((s // 4) + (q // 4)) & 1 else CHK2
# boost pads: chevrons on the road at three waypoints
BOOSTS = (14, 33, 50)
for wi in BOOSTS:
    a = wps[wi]; b = wps[(wi + 1) % NW]; ang = math.atan2(b[1] - a[1], b[0] - a[0]); nx, ny = -math.sin(ang), math.cos(ang); tx, ty = math.cos(ang), math.sin(ang)
    for s in range(-9, 10):
        for q in range(-9, 10):
            ch = abs(q) - abs(s) // 2
            col = BOOST1 if (ch + 20) % 8 < 4 else BOOST2
            px, py = int(a[0] + nx * s + tx * q), int(a[1] + ny * s + ty * q)
            if 0 <= px < S and 0 <= py < S and R[py, px] and abs(q) <= 8 and abs(s) <= 8 and (q + abs(s)) % 6 < 3: img[py, px] = col
# ------------------------------------------------------------------ cut into tiles, merge near-identical ones until <= 250 distinct
tiles = img.reshape(128, 8, 128, 8).transpose(0, 2, 1, 3).reshape(128 * 128, 64)
uniq, inv, cnt = np.unique(tiles, axis=0, return_inverse=True, return_counts=True)
print('exact unique tiles', len(uniq))
def cluster(uniq, inv, cnt, limit):
    order = np.argsort(-cnt); reps = []; mp = np.zeros(len(uniq), dtype=int); T = 0
    while True:
        reps = []
        for k in order:
            best, bd = -1, 99
            for ri, r in enumerate(reps):
                dd_ = int((uniq[k] != uniq[r]).sum())
                if dd_ < bd: bd, best = dd_, ri
            if best >= 0 and bd <= T: mp[k] = best
            else: reps.append(k); mp[k] = len(reps) - 1
        if len(reps) <= limit: return reps, mp, T
        T += 1
reps, mp, T = cluster(uniq, inv, cnt, 250) if len(uniq) > 250 else (list(range(len(uniq))), np.arange(len(uniq)), 0)
print('tiles after merge', len(reps), 'tolerance', T)
tilemap = mp[inv].astype(np.uint8)
pc7 = b''.join(bytes(uniq[r].astype(np.uint8)) for r in reps)
open('build/ground.pc7', 'wb').write(pc7); open('build/ground.mp7', 'wb').write(bytes(tilemap))
# surface map per tile (what the physics sees): 0 grass, 1 road, 2 boost, 3 kerb, 4 wall band
rsurf = np.zeros((128, 128), dtype=np.uint8)
for ty in range(128):
    for tx in range(128):
        blk = img[ty * 8:ty * 8 + 8, tx * 8:tx * 8 + 8]; roadpx = int(R[ty * 8:ty * 8 + 8, tx * 8:tx * 8 + 8].sum())
        if ((blk == BOOST1) | (blk == BOOST2)).sum() > 6: rsurf[ty, tx] = 2
        elif roadpx >= 32: rsurf[ty, tx] = 1
        elif ((blk == WALL1) | (blk == WALL2)).sum() > 32: rsurf[ty, tx] = 4
open('build/surf.bin', 'wb').write(rsurf.tobytes())
# waypoints (u16 x, y), start grid, count
a, b = wps[0], wps[1]; hd = math.atan2(b[1] - a[1], b[0] - a[0])
start_angle = int(round(((hd + math.pi / 2) / (2 * math.pi) * 256) % 256))   # heading 0 = up (north), clockwise
wb = b''.join(struct.pack('<HH', int(round(x)), int(round(y))) for x, y in wps)
open('build/wp.bin', 'wb').write(wb)
meta = dict(nwp=NW, start_angle=start_angle, start=[int(a[0]), int(a[1])], length=int(LEN), width=WIDTH)
json.dump(meta, open('build/track.json', 'w')); print(meta)
Image.fromarray(img, 'P').convert('L').save('/tmp/kart_track.png')
pimg = Image.fromarray(img, 'P'); pimg.putpalette([v for c in PAL for v in c]); pimg.convert('RGB').resize((512, 512)).save('/tmp/kart_track_rgb.png')

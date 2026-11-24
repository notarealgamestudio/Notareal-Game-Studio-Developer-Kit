#!/usr/bin/env python3
"""Original art for the NOTAREAL SNES street-basketball engine: court tiles (BG1, 4bpp), players / ball / hoop / cursor sprites (OBJ, 4bpp, 16x16), palettes.
Everything is drawn here from rectangles; no copied game art."""
import shutil, os
os.makedirs('build', exist_ok=True)
for f in ('font.bin', 'logo_tiles.bin', 'logo_map.bin', 'logo_pal.bin'): shutil.copy('../side2d/build/' + f, 'build/' + f)
def rgb(r, g, b): return (r >> 3) | (g >> 3) << 5 | (b >> 3) << 10
def tile4(px, x0, y0, w):
    t = bytearray(32)
    for y in range(8):
        for x in range(8):
            v = px[(y0 + y) * w + x0 + x] & 15
            for p in range(4):
                if v >> p & 1: t[(p >> 1) * 16 + y * 2 + (p & 1)] |= 0x80 >> x
    return bytes(t)
# ---------------- BG tiles (8x8 each, palette: 0 black, 1 wood light, 2 wood dark, 3 white, 4 wall, 5 crowd a, 6 crowd b, 7 post grey)
def T(fn):
    t = [[0] * 8 for _ in range(8)]
    fn(t); return t
def fill(c): return lambda t: [t[y].__setitem__(x, c) for y in range(8) for x in range(8)]
def wood(a, b):
    def f(t):
        for y in range(8):
            for x in range(8): t[y][x] = a
        for x in range(8): t[7][x] = b
        t[3][2] = b; t[4][5] = b
    return f
def hl(t):
    wood(1, 2)(t)
    for x in range(8): t[3][x] = 3; t[4][x] = 3
def vl(t):
    wood(1, 2)(t)
    for y in range(8): t[y][3] = 3; t[y][4] = 3
def corner(h0, h1, v0, v1):
    def f(t):
        wood(1, 2)(t)
        for x in range(h0, h1): t[3][x] = 3; t[4][x] = 3
        for y in range(v0, v1): t[y][3] = 3; t[y][4] = 3
    return f
def crowd(a, b):
    def f(t):
        fill(4)(t)
        for y in (1, 5):
            for x in (1, 5): t[y][x] = a; t[y][x + 1] = a; t[y + 1][x] = b
    return f
tiles = [T(fill(4)), T(wood(1, 2)), T(wood(2, 1)), T(hl), T(vl), T(corner(3, 8, 3, 8)), T(corner(0, 5, 3, 8)), T(corner(3, 8, 0, 5)), T(corner(0, 5, 0, 5)), T(crowd(5, 6)), T(crowd(6, 5)), T(corner(0, 8, 3, 8)), T(corner(0, 8, 0, 5))]
NT = len(tiles); (WALL, WA, WB, HL, VL, TL, TR, BL, BR, CA, CB, TD, TU) = range(NT)
bg = bytearray()
for t in tiles: bg += tile4([v for row in t for v in row], 0, 0, 8)
MAPW = 32; M = [[WALL] * MAPW for _ in range(32)]
for y in range(2, 12):
    for x in range(MAPW): M[y][x] = CA if (x + y) & 1 else CB
for y in range(12, 28):
    for x in range(MAPW): M[y][x] = WA if (x + y) & 1 else WB
X0, X1, Y0, Y1 = 1, 30, 12, 26
for x in range(X0 + 1, X1): M[Y0][x] = HL; M[Y1][x] = HL
for y in range(Y0 + 1, Y1): M[y][X0] = VL; M[y][X1] = VL
M[Y0][X0] = TL; M[Y0][X1] = TR; M[Y1][X0] = BL; M[Y1][X1] = BR
cx = 15; M[Y0][cx] = TD; M[Y1][cx] = TU
for y in range(Y0 + 1, Y1): M[y][cx] = VL; M[y][cx + 1] = VL if False else M[y][cx + 1]
for (xa, xb, inside) in ((X0, X0 + 6, 1), (X1 - 6, X1, -1)):       # the paint boxes
    ya, yb = 16, 22
    for x in range(min(xa, xb) + (1 if inside > 0 else 0), max(xa, xb) + (0 if inside > 0 else 1)): M[ya][x] = HL; M[yb][x] = HL
    xe = xb if inside > 0 else xa
    for y in range(ya + 1, yb): M[y][xe] = VL
    M[ya][xe] = TR if inside > 0 else TL; M[yb][xe] = BR if inside > 0 else BL
bgmap = bytearray()
for row in M:
    for t in row: bgmap += bytes([t & 255, 0])
bgpal = [rgb(0, 0, 0), rgb(200, 144, 90), rgb(176, 120, 72), rgb(240, 240, 240), rgb(43, 51, 80), rgb(120, 70, 110), rgb(70, 90, 150), rgb(150, 150, 160)] + [0] * 8
open('build/bg_tiles.bin', 'wb').write(bg); open('build/bg_map.bin', 'wb').write(bgmap)
open('build/bg_pal.bin', 'wb').write(b''.join(v.to_bytes(2, 'little') for v in bgpal))
# ---------------- sprites: 16x16 frames on a 128x32 sheet (8 per row). colours: 1 skin 2 jersey 3 jersey dark 4 shorts 5 shoe/black 6 hair 7 white 8 ball 9 ball line 10 yellow 11 rim red 12 shadow 13 grey
SW, SH = 128, 32; sheet = [0] * (SW * SH)
def put(f, x, y, c):
    if 0 <= x < 16 and 0 <= y < 16: sheet[((f // 8) * 16 + y) * SW + (f % 8) * 16 + x] = c
def rect(f, x, y, w, h, c):
    for j in range(h):
        for i in range(w): put(f, x + i, y + j, c)
def body(f, arms, legs, dy=0, tilt=0):
    rect(f, 6 + tilt, 1 + dy, 4, 4, 1); rect(f, 6 + tilt, 1 + dy, 4, 2, 6)                    # head + hair
    rect(f, 5 + tilt, 5 + dy, 6, 6, 2); rect(f, 5 + tilt, 9 + dy, 6, 1, 3)                    # jersey
    rect(f, 5, 11 + dy, 6, 2, 4)                                                              # shorts
    for (x, y, w, h) in arms: rect(f, x, y + dy, w, h, 1)
    for (x, y, w, h) in legs: rect(f, x, y + dy, w, h, 1)
    for (x, y, w, h) in legs:
        if y + h >= 15: rect(f, x - 1, 15 + dy if 15 + dy < 16 else 15, w + 2, 1, 5)
body(0, [(4, 5, 1, 5), (11, 5, 1, 5)], [(6, 13, 2, 2), (9, 13, 2, 2)])
body(1, [(3, 6, 2, 4), (11, 4, 1, 4)], [(5, 13, 2, 2), (9, 12, 2, 3)])
body(2, [(4, 4, 1, 4), (11, 6, 2, 4)], [(6, 12, 2, 3), (10, 13, 2, 2)])
body(3, [(4, 0, 1, 6), (11, 0, 1, 6)], [(6, 13, 2, 2), (9, 13, 2, 2)], dy=0)
body(4, [(11, 0, 2, 3), (4, 6, 1, 3)], [(5, 13, 2, 2), (9, 11, 2, 3)], dy=0, tilt=1)
rect(5, 4, 4, 8, 8, 8); rect(5, 5, 3, 6, 1, 8); rect(5, 5, 12, 6, 1, 8); rect(5, 7, 4, 1, 8, 9); rect(5, 4, 7, 8, 1, 9)           # ball
for y, w in ((11, 8), (12, 12), (13, 12), (14, 8)): rect(6, 8 - w // 2, y, w, 1, 12)                                                  # shadow
rect(7, 2, 0, 12, 9, 13); rect(7, 3, 1, 10, 7, 7); rect(7, 6, 3, 4, 3, 13); rect(7, 3, 9, 10, 1, 11)                                  # backboard + rim
for y in (10, 11, 12): [put(7, x, y, 7) for x in range(4, 12) if (x + y) & 1]
for i, y in enumerate(range(0, 6)): rect(8, 8 - (5 - i), y, 1 + 2 * (5 - i), 1, 10)                                                  # cursor (down arrow)
obj = bytearray()
for ty in range(SH // 8):
    for tx in range(SW // 8): obj += tile4(sheet, tx * 8, ty * 8, SW)
open('build/obj_tiles.bin', 'wb').write(obj)
pal = lambda j: [0, rgb(232, 184, 140), j, rgb(*(max(0, c - 70) for c in {rgb: 0}.get(0, (0, 0, 0)))), rgb(30, 30, 40), rgb(20, 20, 24), rgb(40, 28, 20), rgb(245, 245, 245), rgb(238, 130, 50), rgb(60, 30, 10), rgb(255, 226, 90), rgb(220, 50, 50), rgb(30, 30, 40), rgb(150, 150, 160), 0, 0]
def team(r, g, b): p = pal(rgb(r, g, b)); p[3] = rgb(max(0, r - 70), max(0, g - 70), max(0, b - 70)); return p
open('build/obj_pal.bin', 'wb').write(b''.join(v.to_bytes(2, 'little') for p in (team(232, 74, 74), team(60, 110, 230), team(232, 74, 74), team(60, 110, 230)) for v in p))
# text palettes (BG3, 2bpp): pal 0 white on clear, pal 1 gold, pal 2 grey
tp = []
for c in ((240, 240, 240), (255, 226, 90), (150, 150, 160), (255, 120, 120)): tp += [0, rgb(*c), rgb(30, 30, 40), rgb(0, 0, 0)]
open('build/txt_pal.bin', 'wb').write(b''.join(v.to_bytes(2, 'little') for v in tp))
print('bg tiles', NT, 'obj tiles', len(obj) // 32)

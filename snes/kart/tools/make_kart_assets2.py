#!/usr/bin/env python3
"""Second half of the kart asset build: sprites (voxel-rendered karts at 2 sizes + hand-drawn items), sprite palettes, per-heading HDMA matrix tables, haze/sky tables, sin table and data.asm."""
import math, struct, json, os
import numpy as np
from PIL import Image, ImageDraw
meta = json.load(open('build/track.json'))
def rgb15(r, g, b): return (r >> 3) | (g >> 3) << 5 | (b >> 3) << 10
# ---------------------------------------------------------------- palettes (reuse ground colours 0..46, add sprite palettes at 128+)
pal = [struct.unpack('<H', open('build/ground.pal', 'rb').read()[i * 2:i * 2 + 2])[0] for i in range(256)]
pal[0] = rgb15(40, 88, 176)                                       # backdrop = sky base (HDMA'd colour-math haze is added on top)
RACERS = [((226, 52, 52), (255, 110, 110), (150, 24, 30), (250, 250, 250)),       # red
          ((60, 110, 235), (130, 170, 255), (30, 56, 150), (250, 220, 60)),      # blue
          ((245, 205, 50), (255, 238, 130), (176, 130, 20), (60, 60, 70)),       # yellow
          ((56, 180, 84), (130, 226, 150), (24, 110, 48), (250, 250, 250)),      # green
          ((170, 84, 216), (214, 150, 250), (104, 44, 148), (250, 220, 60)),     # purple
          ((250, 140, 40), (255, 190, 110), (176, 84, 14), (40, 40, 56))]        # orange
def setpal(p, cols):
    for i, c in enumerate(cols): pal[128 + 16 * p + i] = rgb15(*c)
for p, (mid, lt, dk, helm) in enumerate(RACERS):
    setpal(p, [(0, 0, 0), (18, 18, 28), mid, lt, dk, (44, 44, 52), (110, 110, 122), (244, 190, 150), helm, (30, 40, 70), (255, 255, 255)])
setpal(6, [(0, 0, 0), (18, 18, 28), (226, 52, 52), (255, 130, 130), (40, 40, 48), (150, 150, 162), (255, 220, 60), (255, 140, 40), (60, 200, 90), (255, 255, 255), (70, 120, 240), (255, 120, 200), (120, 120, 130)])
setpal(7, [(0, 0, 0), (255, 255, 255), (255, 226, 90), (60, 66, 90)])
open('build/ground.pal', 'wb').write(b''.join(struct.pack('<H', c) for c in pal))
# ---------------------------------------------------------------- voxel kart
def kart_voxels():
    V = {}
    def box(x0, x1, y0, y1, z0, z1, col):
        for x in range(x0, x1):
            for y in range(y0, y1):
                for z in range(z0, z1): V[(x, y, z)] = col
    box(-5, 5, -9, 7, 1, 4, 2)                 # body tub
    box(-3, 3, 7, 13, 1, 3, 2)                 # nose
    box(-2, 2, 13, 15, 1, 2, 3)                # nose tip
    box(-6, 6, -11, -8, 3, 7, 4)               # rear wing
    box(-5, 5, -9, 7, 4, 5, 3)                 # top trim
    for sx in (-8, 5):
        for sy in (-10, 6): box(sx, sx + 3, sy, sy + 5, 0, 5, 5)        # wheels
    for sx in (-8, 5):
        for sy in (-10, 6): box(sx + (0 if sx < 0 else 2), sx + (1 if sx < 0 else 3), sy + 1, sy + 4, 2, 4, 6)   # hubcaps (outer face)
    box(-2, 2, -4, 0, 5, 9, 7)                 # torso/head base
    box(-3, 3, -5, 1, 7, 12, 8)                # helmet
    box(-2, 2, 1, 2, 8, 11, 9)                 # visor
    return V
VOX = kart_voxels()
def render_kart(rel_deg, scale, size=32, anchor=(16, 26), el=34):
    a = math.radians(rel_deg); ca, sa = math.cos(a), math.sin(a); e = math.radians(el); ce, se = math.cos(e), math.sin(e)
    SS = 3; W = size * SS
    out = np.zeros((W, W), dtype=np.uint8)
    vox = {(x, y, z): c for (x, y, z), c in VOX.items()}
    # view basis: screen right = (ca, -sa... ) after rotating the kart by a about z; we rotate the sampling ray instead
    # kart local -> world: x' = x ca + y sa ; y' = -x sa + y ca
    # camera dir (looking from behind/above): moving along ray from the viewer: d = (0, ce, -se) in world (forward-down)
    for py in range(W):
        for px in range(W):
            sx = (px / SS - anchor[0]) / scale; sy = -(py / SS - anchor[1]) / scale   # screen offsets in voxel units (up = +)
            # world point on image plane: x'=sx, z and y' tied by sy = y' se + z ce  -> start high up and walk along the ray
            # choose ray origin far toward the camera: p = (sx, -40 ce + 0, ...) solve for a point with image coord (sx, sy)
            # image-plane point: y'=0, z = sy/ce   (since y' se + z ce = sy)
            ox, oy, oz = sx, 0.0, sy / ce
            # march from the camera side (-d direction) into the scene
            hit = None
            for k in range(-90, 91):
                t = k * 0.45
                wx, wy, wz = ox, oy + t * ce * -1 * -1, oz - t * se   # advance along (0, ce, -se)
                # world -> kart local: x = x' ca - y' sa ; y = x' sa + y' ca
                lx = wx * ca - wy * sa; ly = wx * sa + wy * ca
                key = (int(math.floor(lx + 0.5)), int(math.floor(ly + 0.5)), int(math.floor(wz + 0.5)))
                if key in vox:
                    hit = (key, wx, wy, wz, lx, ly); break
            if hit is None: continue
            key, wx, wy, wz, lx, ly = hit; col = vox[key]
            # shading by facing: top face lighter, +x side (right) mid, others dark; only for body (2..4) colours
            top = (key[0], key[1], key[2] + 1) not in vox and (wz - key[2]) > 0.3
            if col == 2: col = 3 if top else (2 if (lx - key[0]) * ca - 0 > -0.1 else 4)
            if col == 6 or col == 5: col = 5 if not top else 6
            out[py, px] = col
    # downsample SS x SS by majority, keeping an outline
    img = np.zeros((size, size), dtype=np.uint8)
    for y in range(size):
        for x in range(size):
            blk = out[y * SS:(y + 1) * SS, x * SS:(x + 1) * SS].ravel(); nz = blk[blk > 0]
            if len(nz) * 2 >= len(blk): img[y, x] = np.bincount(nz).argmax()
    # outline: transparent pixels touching solid get index 1
    o = img.copy()
    for y in range(size):
        for x in range(size):
            if img[y, x] == 0:
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < size and 0 <= xx < size and img[yy, xx] > 1: o[y, x] = 1; break
    return o
ANG = [0, 45, 90, 135, 180, 22]                                    # frames 0..5, mirrored for the other side
SHEET_W = 128; sheet_rows = 21 * 8
sheet = np.zeros((sheet_rows, SHEET_W), dtype=np.uint8)
print('rendering karts...')
for lod, sc in enumerate((1.0, 0.5)):
    for f, a in enumerate(ANG):
        im = render_kart(a, sc); k = lod * 6 + f; fr_row, fc = k >> 2, k & 3
        sheet[fr_row * 32:fr_row * 32 + 32, fc * 32:fc * 32 + 32] = im
# ---------------------------------------------------------------- items (16x16 hand drawn) -> tile rows 12-13; 8x8 versions row 14; kart dots row 14 cols 4-5
def item_art(i):
    im = Image.new('P', (16, 16), 0); d = ImageDraw.Draw(im)
    if i == 0:   # item crate: yellow cube with a ? 
        d.rectangle([1, 2, 14, 14], fill=1); d.rectangle([2, 3, 13, 13], fill=6); d.rectangle([2, 3, 13, 4], fill=9); d.rectangle([2, 12, 13, 13], fill=7)
        d.rectangle([6, 5, 9, 6], fill=1); d.rectangle([9, 6, 10, 8], fill=1); d.rectangle([7, 8, 8, 9], fill=1); d.rectangle([7, 11, 8, 11], fill=1)
    elif i == 1: # turbo bolt
        d.polygon([(9, 0), (3, 9), (7, 9), (5, 15), (13, 6), (9, 6), (11, 0)], fill=1); d.polygon([(9, 2), (5, 8), (9, 8), (7, 13), (11, 7), (8, 7), (10, 2)], fill=6)
    elif i == 2: # shell
        d.ellipse([1, 3, 14, 14], fill=1); d.ellipse([2, 4, 13, 13], fill=2); d.pieslice([2, 4, 13, 13], 200, 340, fill=3); d.rectangle([3, 11, 12, 12], fill=9); d.ellipse([6, 6, 9, 9], fill=9)
    elif i == 4: # shield bubble
        d.ellipse([1, 1, 14, 14], fill=1); d.ellipse([2, 2, 13, 13], fill=3); d.ellipse([4, 4, 11, 11], fill=0); d.arc([3, 3, 12, 12], 200, 290, fill=9); d.rectangle([7, 6, 8, 9], fill=1)
    elif i == 5: # oil slick
        d.ellipse([0, 4, 15, 13], fill=1); d.ellipse([2, 5, 13, 11], fill=4); d.ellipse([4, 6, 8, 8], fill=9)
    elif i == 6: # triple shells
        for ox, oy in ((0, 6), (8, 6), (4, 0)): d.ellipse([ox, oy, ox + 7, oy + 7], fill=1); d.ellipse([ox + 1, oy + 1, ox + 6, oy + 6], fill=2); d.rectangle([ox + 2, oy + 4, ox + 5, oy + 5], fill=9)
    elif i == 7: # shock (lightning in a ring)
        d.ellipse([0, 0, 15, 15], fill=1); d.ellipse([1, 1, 14, 14], fill=7); d.polygon([(9, 1), (4, 9), (7, 9), (6, 14), (12, 6), (8, 6), (10, 1)], fill=6)
    else:        # mine
        d.ellipse([3, 3, 12, 12], fill=1); d.ellipse([4, 4, 11, 11], fill=4)
        for p in ((7, 0), (7, 14), (0, 7), (14, 7), (2, 2), (12, 2), (2, 12), (12, 12)): d.rectangle([p[0], p[1], p[0] + 1, p[1] + 1], fill=1)
        d.rectangle([6, 6, 8, 8], fill=2)
    return np.array(im)
for i in range(8):
    a16 = item_art(i if i != 3 else 3); sheet[12 * 8:12 * 8 + 16, i * 16:(i + 1) * 16] = a16
    # 8x8: 2x2 block downsample choosing the most common non-zero
    s8 = np.zeros((8, 8), dtype=np.uint8)
    for y in range(8):
        for x in range(8):
            blk = a16[y * 2:y * 2 + 2, x * 2:x * 2 + 2].ravel(); nz = blk[blk > 0]
            if len(nz) >= 2: s8[y, x] = np.bincount(nz).argmax()
    sc = i if i < 4 else i + 4
    sheet[14 * 8:14 * 8 + 8, sc * 8:sc * 8 + 8] = s8
dot = np.array([[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 1, 1, 1, 1, 0, 0], [0, 1, 3, 2, 2, 2, 1, 0], [0, 1, 2, 2, 2, 4, 1, 0], [0, 1, 2, 2, 4, 4, 1, 0], [0, 0, 1, 5, 5, 5, 1, 0], [0, 0, 1, 1, 1, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]], dtype=np.uint8)
sheet[14 * 8:14 * 8 + 8, 4 * 8:5 * 8] = dot
# ---------------------------------------------------------------- font rows 15..20 (2bpp glyphs -> pixel values 0..3)
fb = open('build/font.bin', 'rb').read()
for g in range(96):
    for y in range(8):
        b0, b1 = fb[g * 16 + y * 2], fb[g * 16 + y * 2 + 1]
        for x in range(8): sheet[(15 + g // 16) * 8 + y, (g % 16) * 8 + x] = ((b0 >> (7 - x)) & 1) | (((b1 >> (7 - x)) & 1) << 1)
def to4bpp(sh):
    H, W = sh.shape; out = bytearray()
    for ty in range(H // 8):
        for tx in range(W // 8):
            t = sh[ty * 8:ty * 8 + 8, tx * 8:tx * 8 + 8]
            for base in (0, 2):
                for y in range(8):
                    for pl in (base, base + 1):
                        bb = 0
                        for x in range(8): bb |= ((int(t[y, x]) >> pl) & 1) << (7 - x)
                        out.append(bb)
        # tile order is row-major across the 16-wide sheet
    return bytes(out)
# to4bpp emits per tile (planes 0/1 interleaved rows, then planes 2/3) — correct SNES 4bpp layout
open('build/spr.bin', 'wb').write(to4bpp(sheet)); print('sprite sheet tiles', len(to4bpp(sheet)) // 32)
Image.fromarray((sheet * 15).astype(np.uint8)).save('/tmp/kart_sheet.png')
# ---------------------------------------------------------------- HDMA matrix tables
YH, F, YPIV, Y0 = 40, 128, 192, 64; K = 152.0
NH = 128; TAB = 5 + (224 - Y0) * 5 + 1                              # identity block entry + one entry per ground line + terminator
def s88(v): return struct.pack('<h', max(-32768, min(32767, int(round(v * 256)))))
def ident(): return s88(1) + s88(0)
tabs = []
for h in range(NH):
    th = 2 * math.pi * h / NH; sn, cs = math.sin(th), math.cos(th)
    A = bytearray(); C = bytearray()
    A += bytes([Y0]) + ident(); C += bytes([Y0]) + ident()                  # (A,B)=(1,0) ; (C,D)=(0,1) -> C written as 0, D as 1
    C = bytearray([Y0]) + s88(0) + s88(1)
    for y in range(Y0, 224):
        w = K / (y - YH); D = F * K / (y - YH); D0 = F * K / (YPIV - YH); r = y - YPIV
        if r == 0: q = -F * K / (YPIV - YH) ** 2          # limit of (D-D0)/r
        else: q = (D - D0) / r
        a, b, c, d = cs * w, sn * q, sn * w, -cs * q
        A += bytes([1]) + s88(a) + s88(b); C += bytes([1]) + s88(c) + s88(d)
    A += b'\x00'; C += b'\x00'
    assert len(A) == TAB and len(C) == TAB
    tabs.append(bytes(A) + bytes(C))
# ---------------------------------------------------------------- sky / haze tables (COLDATA writes: 0x20|r, 0x40|g, 0x80|b)
bands = []
y = 0
while y < 224:
    n = 4 if y < 220 else 4
    yc = y + n / 2
    if yc < Y0: hz = (yc / Y0) ** 2
    else: hz = max(0.0, 1 - (yc - Y0) / 130.0) ** 2
    bands.append((n, hz)); y += n
haze_rg = bytearray(); haze_b = bytearray()
for n, hz in bands:
    r = int(round(14 * hz)); g = int(round(10 * hz)); b = int(round(6 * hz))
    haze_rg += bytes([n, 0x20 | r, 0x40 | g]); haze_b += bytes([n, 0x80 | b])
haze_rg += b'\x00'; haze_b += b'\x00'
tm_tab = bytes([Y0, 0x10, 1, 0x11, 0])
# ---------------------------------------------------------------- tables header + sin
sin = [int(round(127 * math.sin(2 * math.pi * i / 256))) for i in range(256)]
yrow = [min(255, 40 + int(19456 / (128 + d))) for d in range(-20, 301)]
ks = [int(round(128 * k / 152)) for k in range(184)]
open('src/tables.h', 'w').write('/* generated by tools/make_kart_assets2.py */\nstatic const signed char SIN[256] = {' + ','.join(map(str, sin)) + '};\nstatic const unsigned char YROW[321] = {' + ','.join(map(str, yrow)) + '};\nstatic const unsigned char KS[184] = {' + ','.join(map(str, ks)) + '};\n#define TABSZ %d\n#define NWP %d\n#define START_ANGLE %d\n#define TRACK_LEN %d\n' % (TAB, meta['nwp'], meta['start_angle'], meta['length']))
# waypoint file with perpendicular vectors (u16 x, u16 y, s8 px, s8 py)
wp = open('build/wp.bin', 'rb').read(); pts = [struct.unpack('<HH', wp[i * 4:i * 4 + 4]) for i in range(meta['nwp'])]
out = bytearray()
for i, (x, y) in enumerate(pts):
    a, b = pts[i - 1], pts[(i + 1) % len(pts)]; dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1
    out += struct.pack('<HHbb', x, y, int(round(-dy / L * 127)), int(round(dx / L * 127)))
open('build/wp2.bin', 'wb').write(bytes(out))
# ---------------------------------------------------------------- data.asm
asm = ['.include "hdr.asm"']
def sec(name, label, path):
    asm.append('.section "%s" superfree\n%s: .incbin "%s"\n%s_end:\n.ends' % (name, label, path, label))
for n, l, p in (('nr_font', 'nr_font', 'build/font.bin'), ('nr_logo_t', 'nr_logo_tiles', 'build/logo_tiles.bin'), ('nr_logo_m', 'nr_logo_map', 'build/logo_map.bin'), ('nr_logo_p', 'nr_logo_pal', 'build/logo_pal.bin'),
                ('g_tiles', 'gnd_tiles', 'build/ground.pc7'), ('g_map', 'gnd_map', 'build/ground.mp7'), ('g_pal', 'gnd_pal', 'build/ground.pal'), ('g_surf', 'surf_map', 'build/surf.bin'), ('g_wp', 'wp_data', 'build/wp2.bin'), ('s_spr', 'spr_tiles', 'build/spr.bin')):
    sec(n, l, p)
asm.append('.section "g_tm" superfree\ntm_tab: .incbin "build/tm.bin"\n.ends\n.section "g_hrg" superfree\nhaze_rg: .incbin "build/hrg.bin"\n.ends\n.section "g_hb" superfree\nhaze_b: .incbin "build/hb.bin"\n.ends')
open('build/tm.bin', 'wb').write(tm_tab); open('build/hrg.bin', 'wb').write(haze_rg); open('build/hb.bin', 'wb').write(haze_b)
for h, t in enumerate(tabs):
    open('build/mt%03d.bin' % h, 'wb').write(t)
    asm.append('.section "mt%d" superfree\nmt%d: .incbin "build/mt%03d.bin"\n.ends' % (h, h, h))
asm.append('.section "mt_ptr" superfree\nmt_ptr: .dw ' + ','.join('mt%d' % h for h in range(NH)) + '\nmt_bank: .db ' + ','.join(':mt%d' % h for h in range(NH)) + '\n.ends')
asm.append('; ---- the settings block the dev kit patches: bank 1 ($81:8000), magic NRGKART1: laps, speed class, rivals, skill, title\n.bank 1 slot 0\n.org 0\n.section "nrgcfg" force\n.db "NRGKART1"\n.db 3, 2, 3, 2\n.dsb 4, 0\n.db "NOTAREAL KART"\n.dsb $1F8 - 8 - 4 - 4 - 13, 0\n.ends')
open('data.asm', 'w').write('\n'.join(asm) + '\n')
print('tables', len(tabs), TAB, 'total', len(tabs) * 2 * TAB)

#!/usr/bin/env python3
"""NOTAREAL Dev Kit style packs: the same set of game art drawn three ways.
  blocky    - chunky, flat, generic (fast to read, easy to edit)
  cute      - cartoon: round shapes, big eyes, pastel colours, soft outlines
  realistic - cutting edge: supersampled shading, 7-heads-tall bodies (SvR 2009 rig proportions), textured tiles,
              painted backgrounds with atmospheric depth
Each pack: 4 heroes (kid, Steve, Rebecca, Austin), 3 enemies, 5 items, 1 tileset (12 tiles, same order and
collision as the classic sets), 2 backgrounds. All original drawings. Adds entries (with "style") to library.json."""
import json, math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

LIB = sys.argv[1]
BODY = json.load(open(os.path.join(LIB, 'body_proportions.json')))
rnd = random.Random(2026)
for d in ('styles',): os.makedirs(f'{LIB}/{d}', exist_ok=True)

def sh(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3])
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def hexc(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

CAST = {   # from the cast look sheet
    'kid':     dict(name='Kid Notareal', skin=hexc('e0ac84'), hair=hexc('3a2414'), hair_style='cap', cap=hexc('16a0a0'), shirt=hexc('f08a24'), pants=hexc('2f4a8a'), shoes=hexc('f2f2f2'), build='lean'),
    'steve':   dict(name='Steve', skin=hexc('f0c4a4'), hair=hexc('3b2a1e'), hair_back=hexc('6b4a2e'), hair_style='mullet', shirt=hexc('22305a'), pants=hexc('3a5a88'), shoes=hexc('5a3a22'), build='average', tattoo=True, grin=True),
    'rebecca': dict(name='Rebecca', skin=hexc('f4d2bc'), hair=hexc('2c1e1a'), hair_style='wavy', shirt=hexc('8a8a90'), apron=hexc('d8a828'), pants=hexc('3a5a88'), shoes=hexc('4a3020'), build='lean', female=True),
    'austin':  dict(name='Austin', skin=hexc('9a6440'), hair=hexc('141010'), hair_style='bun', shirt=hexc('c82828'), accent=hexc('2850c8'), pants=hexc('26262e'), shoes=hexc('202020'), build='lean', glasses=True, mustache=True),
}

# ------------------------------------------------------------------ supersampled painter
class Paint:
    def __init__(self, w, h, s):
        self.s = s; self.im = Image.new('RGBA', (w * s, h * s), (0, 0, 0, 0)); self.d = ImageDraw.Draw(self.im)
    def P(self, x, y): return (x * self.s, y * self.s)
    def ell(self, x0, y0, x1, y1, c): self.d.ellipse([x0 * self.s, y0 * self.s, x1 * self.s, y1 * self.s], fill=c)
    def rect(self, x0, y0, x1, y1, c): self.d.rectangle([x0 * self.s, y0 * self.s, x1 * self.s, y1 * self.s], fill=c)
    def poly(self, pts, c): self.d.polygon([self.P(*p) for p in pts], fill=c)
    def line(self, pts, c, w): self.d.line([self.P(*p) for p in pts], fill=c, width=max(1, int(w * self.s)), joint='curve')
    def cap(self, a, b, r, c, shade=None):
        """capsule from a to b with radius r; shade=(light, dark) gives a rounded, lit look (light from top-left)"""
        if not shade: self.line([a, b], c, r * 2); self.ell(a[0] - r, a[1] - r, a[0] + r, a[1] + r, c); self.ell(b[0] - r, b[1] - r, b[0] + r, b[1] + r, c); return
        lt, dk = shade
        for k, col in ((1.0, dk), (0.78, c), (0.38, lt)):
            off = (1 - k) * r * 0.55
            rr = r * k
            A = (a[0] - off, a[1] - off * 0.5); Bp = (b[0] - off, b[1] - off * 0.5)
            self.line([A, Bp], col, rr * 2); self.ell(A[0] - rr, A[1] - rr, A[0] + rr, A[1] + rr, col); self.ell(Bp[0] - rr, Bp[1] - rr, Bp[0] + rr, Bp[1] + rr, col)
    def done(self, w, h, colors=None, outline=None):
        im = self.im.resize((w, h), Image.LANCZOS)
        a = np.array(im); al = a[:, :, 3]; a[:, :, 3] = np.where(al > 110, 255, 0)
        im = Image.fromarray(a)
        if colors:
            rgb = im.convert('RGB').quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
            out = np.array(rgb.convert('RGBA')); out[:, :, 3] = a[:, :, 3]; im = Image.fromarray(out)
        if outline: im = add_outline(im, outline)
        return im

def add_outline(im, mode):
    a = np.array(im).astype(int); al = a[:, :, 3] > 0; H, W = al.shape; out = a.copy()
    for y in range(H):
        for x in range(W):
            if al[y, x]: continue
            nb = [(y + dy, x + dx) for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)) if 0 <= y + dy < H and 0 <= x + dx < W and al[y + dy, x + dx]]
            if nb:
                if mode == 'black': out[y, x] = (16, 12, 20, 255)
                else:   # selective outline: darker version of the neighbour colour
                    c = a[nb[0][0], nb[0][1], :3]; out[y, x] = (*[int(v * 0.35) for v in c], 255)
    return Image.fromarray(out.astype(np.uint8))

def strip(frames):
    w, h = frames[0].size; s = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames): s.paste(f, (i * w, 0))
    return s

# ------------------------------------------------------------------ people
POSES = {   # (left leg angle, right leg angle, left arm, right arm, knee bend, lean) in degrees; 0 = straight down
    'idle': (2, -2, 8, -8, 0, 0), 'walk1': (26, -22, -24, 22, 10, 2), 'walk2': (-22, 26, 22, -24, 10, 2),
    'jump': (30, -8, -150, -40, 40, 0), 'hurt': (20, -20, -120, 120, 15, -10)}
def limb_end(x, y, L, ang): r = math.radians(ang); return (x + math.sin(r) * L, y + math.cos(r) * L)

def person_realistic(c, pose):
    """7 heads tall, SvR rig proportions, drawn at 8x and reduced to 32x64"""
    W, H, S = 32, 64, 8; p = Paint(W, H, S); B = BODY
    h = 61.0; top = 1.5; cx = 16
    bulk = {'lean': 0.85, 'average': 1.0, 'heavy': 1.3}[c['build']]
    ll, rl, la, ra, knee, lean = POSES[pose]
    hipY = top + h * (1 - B['hip_height']); chestY = hipY - (B['waist'] + B['chest']) * h; neckY = chestY - 2.2
    headH = B['head'] * h; headW = headH * 0.74
    skin = c['skin']; S_L, S_D = sh(skin, 1.12), sh(skin, 0.72)
    pants = c['pants']; P_L, P_D = sh(pants, 1.25), sh(pants, 0.6)
    shirt = c['shirt']; T_L, T_D = sh(shirt, 1.3), sh(shirt, 0.6)
    thigh, shin = B['thigh'] * h, B['shin'] * h; uarm, farm = B['upper_arm'] * h, B['forearm'] * h
    shoulderY = chestY + 1.2; shoulderX = B['shoulder_offset'] * h * bulk * 0.95
    leg_r = 2.0 * bulk; arm_r = 1.45 * bulk
    def leg(sx, ang, back):
        k = (knee if back else knee * 0.4)
        kx, ky = limb_end(sx, hipY, thigh, ang); fx, fy = limb_end(kx, ky, shin, ang - k)
        p.cap((sx, hipY), (kx, ky), leg_r, pants if not back else sh(pants, 0.8), (P_L, P_D))
        p.cap((kx, ky), (fx, fy - 1), leg_r * 0.85, pants if not back else sh(pants, 0.8), (P_L, P_D))
        shoe = c['shoes']; p.cap((fx - 0.5, fy - 0.6), (fx + 2.6, fy - 0.3), 1.25, shoe, (sh(shoe, 1.3), sh(shoe, 0.55)))
    def arm(sx, ang, back):
        ex, ey = limb_end(sx, shoulderY, uarm, ang); hx, hy = limb_end(ex, ey, farm, ang * 0.7 + (15 if pose == 'idle' else 0))
        col = shirt
        p.cap((sx, shoulderY), (ex, ey), arm_r * 1.05, col if not back else sh(col, 0.8), (T_L, T_D))
        p.cap((ex, ey), (hx, hy), arm_r * 0.9, skin if not back else sh(skin, 0.85), (S_L, S_D))
        if c.get('tattoo') and not back: p.line([(ex - 0.4, ey + 1), (ex + 0.3, ey + 3)], sh(skin, 0.45), 0.6)
        p.ell(hx - 1.3, hy - 1.1, hx + 1.3, hy + 1.5, skin if not back else sh(skin, 0.85))
    hipw = B['hip_width'] * h * bulk * 1.4
    # back limbs first
    arm(cx + shoulderX * 0.7, ra, True); leg(cx + hipw * 0.5, rl, True)
    # torso with shading
    tw = 0.19 * h * bulk; ww = tw * 0.82
    torso = [(cx - tw / 2, shoulderY - 0.5), (cx + tw / 2, shoulderY - 0.5), (cx + ww / 2 + 0.3, hipY + 1), (cx - ww / 2 - 0.3, hipY + 1)]
    p.poly(torso, shirt)
    p.poly([(cx + tw * 0.1, shoulderY), (cx + tw / 2, shoulderY), (cx + ww / 2 + 0.3, hipY + 1), (cx + ww * 0.15, hipY + 1)], T_D)
    p.poly([(cx - tw / 2 + 0.5, shoulderY), (cx - tw * 0.15, shoulderY), (cx - ww * 0.25, hipY - 2), (cx - ww / 2 + 0.6, hipY - 2)], T_L)
    p.line([(cx - ww * 0.1, chestY + 3), (cx + ww * 0.25, chestY + 4)], T_D, 0.5)     # cloth fold
    if c.get('apron'):
        ap = c['apron']; p.poly([(cx - tw * 0.36, chestY + 1.5), (cx + tw * 0.36, chestY + 1.5), (cx + ww * 0.5, hipY + 6), (cx - ww * 0.5, hipY + 6)], ap)
        p.poly([(cx + tw * 0.05, chestY + 1.5), (cx + tw * 0.36, chestY + 1.5), (cx + ww * 0.5, hipY + 6), (cx + ww * 0.1, hipY + 6)], sh(ap, 0.72))
        p.line([(cx - tw * 0.3, chestY + 1.5), (cx - tw * 0.2, neckY + 0.5)], sh(ap, 0.6), 0.5); p.line([(cx + tw * 0.3, chestY + 1.5), (cx + tw * 0.2, neckY + 0.5)], sh(ap, 0.6), 0.5)
    if c.get('accent'): p.rect(cx - tw / 2, shoulderY + 3.5, cx + tw / 2, shoulderY + 4.3, c['accent'])
    p.rect(cx - ww / 2 - 0.3, hipY - 0.8, cx + ww / 2 + 0.3, hipY + 0.6, sh(pants, 0.45))     # belt
    # front limbs
    leg(cx - hipw * 0.5, ll, False); arm(cx - shoulderX * 0.7, la, False)
    # neck + head
    p.cap((cx, neckY - 1), (cx, chestY + 0.5), 1.5, S_D)
    hy0 = neckY - headH + 0.8; hx0 = cx - headW / 2 + lean * 0.05
    p.ell(hx0, hy0, hx0 + headW, hy0 + headH, skin)
    p.ell(hx0 + headW * 0.45, hy0 + headH * 0.1, hx0 + headW * 1.0, hy0 + headH * 0.98, S_D)     # side shadow
    p.ell(hx0 + headW * 0.05, hy0 + headH * 0.1, hx0 + headW * 0.55, hy0 + headH * 0.6, S_L)      # forehead light
    p.ell(hx0 - 0.5, hy0 + headH * 0.42, hx0 + 1.0, hy0 + headH * 0.66, S_D)      # ear
    ey = hy0 + headH * 0.47
    for ex in (hx0 + headW * 0.27, hx0 + headW * 0.68):
        p.ell(ex - 0.95, ey - 0.5, ex + 0.95, ey + 0.55, (240, 238, 232)); p.ell(ex - 0.5, ey - 0.5, ex + 0.5, ey + 0.55, (54, 36, 26)); p.ell(ex - 0.2, ey - 0.3, ex + 0.15, ey + 0.05, (255, 255, 255))
        p.line([(ex - 1.1, ey - 1.3), (ex + 1.0, ey - 1.45)], sh(c['hair'], 0.9), 0.55)    # brows
    if c.get('female'):
        for ex in (hx0 + headW * 0.27, hx0 + headW * 0.68): p.line([(ex - 1.1, ey - 0.6), (ex + 1.0, ey - 0.7)], (30, 20, 20), 0.35)
    p.poly([(cx + 0.2, ey + 0.2), (cx + 1.0, ey + 2.5), (cx - 0.3, ey + 2.6)], S_D)     # nose shadow
    my = hy0 + headH * 0.79
    if c.get('grin'): p.ell(cx - 1.7, my - 0.6, cx + 1.7, my + 0.9, (120, 40, 40)); p.rect(cx - 1.3, my - 0.5, cx + 1.3, my, (245, 245, 240))
    else: p.line([(cx - 1.2, my), (cx + 1.2, my)], (170, 80, 80) if c.get('female') else sh(skin, 0.5), 0.7 if c.get('female') else 0.45)
    if c.get('mustache'): p.line([(cx - 1.4, my - 0.8), (cx + 1.4, my - 0.8)], c['hair'], 0.55)
    if c.get('glasses'):
        for ex in (hx0 + headW * 0.27, hx0 + headW * 0.68): p.d.ellipse([ (ex - 1.4) * S, (ey - 1.1) * S, (ex + 1.4) * S, (ey + 1.1) * S], outline=(30, 30, 34), width=int(0.4 * S))
        p.line([(hx0 + headW * 0.27 + 1.4, ey), (hx0 + headW * 0.68 - 1.4, ey)], (30, 30, 34), 0.35)
    if c.get('tattoo'): p.poly([(hx0 + headW * 0.86, ey), (hx0 + headW * 0.95, ey + 1.6), (hx0 + headW * 0.8, ey + 2.2)], (190, 70, 30))
    # hair
    hc = c['hair']; HL = sh(hc, 1.8)
    st = c['hair_style']
    if st == 'cap':
        cap = c['cap']; p.ell(hx0 - 0.3, hy0 - 0.6, hx0 + headW + 0.3, hy0 + headH * 0.48, cap); p.rect(hx0 + headW * 0.4, hy0 + headH * 0.34, hx0 + headW + 2.5, hy0 + headH * 0.44, sh(cap, 0.7))
        p.ell(hx0 + 1, hy0, hx0 + headW * 0.5, hy0 + headH * 0.2, sh(cap, 1.3))
    else:
        p.ell(hx0 - 0.5, hy0 - 0.8, hx0 + headW + 0.5, hy0 + headH * 0.42, hc)
        p.ell(hx0 + 1, hy0 - 0.4, hx0 + headW * 0.55, hy0 + headH * 0.16, HL)
        if st == 'mullet': p.poly([(hx0 - 0.4, hy0 + headH * 0.3), (hx0 + 1.6, hy0 + headH * 0.3), (hx0 + 1.2, hy0 + headH + 3), (hx0 - 1.2, hy0 + headH + 2.5)], c['hair_back'])
        if st == 'wavy':
            for k in range(4): p.ell(hx0 - 1.6 + (k % 2) * 0.6, hy0 + headH * (0.3 + k * 0.22), hx0 + 1.4 + (k % 2) * 0.6, hy0 + headH * (0.6 + k * 0.22), hc)
            p.ell(hx0 + headW - 1.2, hy0 + headH * 0.3, hx0 + headW + 1.2, hy0 + headH * 1.05, hc)
            p.line([(hx0 + headW * 0.2, hy0 + headH * 0.32), (hx0 + headW * 0.6, hy0 + headH * 0.28)], hc, 0.8)   # loose strand
        if st == 'bun': p.ell(hx0 + headW * 0.2, hy0 - 3.2, hx0 + headW * 0.75, hy0 + 0.6, hc); p.ell(hx0 + headW * 0.3, hy0 - 2.8, hx0 + headW * 0.5, hy0 - 1.6, HL)
    im = p.done(W, H, colors=30, outline='selective')
    if pose == 'hurt': im = im.rotate(-8, resample=Image.NEAREST, center=(16, 40))
    return im

def person_cute(c, pose):
    """chibi: head = 45% of height, huge eyes, soft colours, tinted outline. 16x32."""
    W, H, S = 16, 32, 8; p = Paint(W, H, S)
    ll, rl, la, ra, knee, lean = POSES[pose]
    soft = lambda col: mix(col, (255, 240, 245), 0.25)
    skin, shirt, pants = soft(c['skin']), soft(c['shirt']), soft(c['pants'])
    hipY = 24.5; cx = 8
    for sx, ang in ((cx + 1.6, rl), (cx - 1.6, ll)):
        fx, fy = limb_end(sx, hipY, 5.5, ang * 0.8); p.cap((sx, hipY), (fx, fy), 1.5, pants); p.ell(fx - 1.7, fy - 0.8, fx + 1.9, fy + 1.4, soft(c['shoes']))
    p.ell(cx - 4, 16, cx + 4, 26, shirt)
    if c.get('apron'): p.ell(cx - 3, 18, cx + 3, 26, soft(c['apron']))
    for sx, ang in ((cx - 3.6, la), (cx + 3.6, ra)):
        hx, hy = limb_end(sx, 18.5, 4.8, ang * 0.9); p.cap((sx, 18.5), (hx, hy), 1.25, shirt); p.ell(hx - 1.3, hy - 1.3, hx + 1.3, hy + 1.3, skin)
    hx0, hy0, hw, hh = cx - 7, 1.5, 14, 14
    hair = soft(c['hair'])
    if c['hair_style'] in ('wavy', 'mullet'): p.ell(hx0 - 0.5, hy0 + 3, hx0 + hw + 0.5, hy0 + hh + (5 if c['hair_style'] == 'wavy' else 3), hair)
    p.ell(hx0, hy0, hx0 + hw, hy0 + hh, skin)
    if c['hair_style'] == 'cap': p.ell(hx0 - 0.5, hy0 - 1, hx0 + hw + 0.5, hy0 + 6.5, soft(c['cap'])); p.rect(hx0 + 7, hy0 + 4.5, hx0 + hw + 3, hy0 + 6.3, sh(soft(c['cap']), 0.8))
    else:
        p.ell(hx0 - 0.5, hy0 - 1, hx0 + hw + 0.5, hy0 + 6.5, hair)
        p.poly([(hx0 + 2, hy0 + 4), (hx0 + 6, hy0 + 4), (hx0 + 3, hy0 + 8)], hair)
        if c['hair_style'] == 'bun': p.ell(hx0 + 4.5, hy0 - 3.5, hx0 + 9.5, hy0 + 1, hair)
    ey = hy0 + 8.3
    for ex in (hx0 + 4, hx0 + 10):
        p.ell(ex - 1.7, ey - 2.2, ex + 1.7, ey + 2.2, (40, 30, 50)); p.ell(ex - 0.9, ey - 1.7, ex + 0.3, ey - 0.4, (255, 255, 255)); p.ell(ex + 0.3, ey + 0.6, ex + 1.0, ey + 1.3, (255, 255, 255))
        if c.get('glasses'): p.d.ellipse([(ex - 2.4) * S, (ey - 2.6) * S, (ex + 2.4) * S, (ey + 2.6) * S], outline=(60, 50, 70), width=int(0.45 * S))
    p.ell(hx0 + 1.3, ey + 2.3, hx0 + 3.5, ey + 3.6, (255, 160, 170)); p.ell(hx0 + 10.5, ey + 2.3, hx0 + 12.7, ey + 3.6, (255, 160, 170))   # blush
    p.d.arc([(cx - 1.4) * S, (ey + 2) * S, (cx + 1.4) * S, (ey + 4.2) * S], 10, 170, fill=(120, 50, 60), width=int(0.5 * S))
    im = p.done(W, H, colors=16, outline='selective')
    if pose == 'jump': im = im.transform(im.size, Image.AFFINE, (1, 0, 0, 0, 1, 1), resample=Image.NEAREST)
    return im

def person_blocky(c, pose):
    """chunky rectangles, 3-4 flat colours, black outline. 16x32 drawn at native size."""
    im = Image.new('RGBA', (16, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    ll, rl, la, ra, knee, lean = POSES[pose]
    leg = {'idle': (0, 0), 'walk1': (-2, 2), 'walk2': (2, -2), 'jump': (-2, 1), 'hurt': (-2, 2)}[pose]
    d.rectangle([4 + leg[0], 22, 7 + leg[0], 29], fill=c['pants']); d.rectangle([8 + leg[1], 22, 11 + leg[1], 29], fill=sh(c['pants'], 0.8))
    d.rectangle([3 + leg[0], 29, 7 + leg[0], 30], fill=c['shoes']); d.rectangle([8 + leg[1], 29, 12 + leg[1], 30], fill=c['shoes'])
    d.rectangle([4, 13, 11, 22], fill=c['shirt'])
    if c.get('apron'): d.rectangle([5, 15, 10, 23], fill=c['apron'])
    up = pose in ('jump', 'hurt')
    d.rectangle([2, 10 if up else 14, 3, 14 if up else 20], fill=c['skin']); d.rectangle([12, 10 if up else 14, 13, 14 if up else 20], fill=c['skin'])
    d.rectangle([4, 4, 11, 12], fill=c['skin'])
    hair = c.get('cap', c['hair']) if c['hair_style'] == 'cap' else c['hair']
    d.rectangle([4, 2, 11, 5], fill=hair)
    if c['hair_style'] == 'cap': d.rectangle([10, 5, 13, 5], fill=sh(hair, 0.7))
    if c['hair_style'] in ('wavy', 'mullet'): d.rectangle([3, 4, 4, 13 if c['hair_style'] == 'wavy' else 11], fill=c.get('hair_back', hair))
    if c['hair_style'] == 'bun': d.rectangle([6, 0, 9, 2], fill=hair)
    d.point((6, 8), fill=(20, 20, 20)); d.point((9, 8), fill=(20, 20, 20))
    if c.get('glasses'): d.rectangle([5, 7, 10, 7], fill=(20, 20, 20))
    d.line([(7, 10), (8, 10)], fill=sh(c['skin'], 0.6))
    if pose == 'hurt': im = im.rotate(-10, resample=Image.NEAREST)
    return add_outline(im, 'black')

PEOPLE = {'blocky': person_blocky, 'cute': person_cute, 'realistic': person_realistic}

# ------------------------------------------------------------------ enemies and items (16x16 unless noted)
def enemy(style, kind, frame):
    S = 8 if style != 'blocky' else 1; p = Paint(16, 16, S)
    if style == 'blocky':
        im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        col = {'walker': (200, 60, 60), 'hopper': (60, 160, 60), 'flyer': (150, 80, 200)}[kind]
        squash = frame == 2 and kind != 'flyer'
        if kind == 'flyer': d.polygon([(2, 6 + frame), (14, 6 + frame), (8, 14)], fill=col); d.rectangle([0, 4 - frame, 4, 6], fill=(230, 230, 240)); d.rectangle([11, 4 - frame, 15, 6], fill=(230, 230, 240))
        elif squash: d.rectangle([1, 11, 14, 15], fill=col)
        else: d.rectangle([2, 4 if kind == 'walker' else 2 + frame * 3, 13, 15], fill=col); d.rectangle([2 + frame, 14, 5 + frame, 15], fill=sh(col, 0.5)); d.rectangle([10 - frame, 14, 13 - frame, 15], fill=sh(col, 0.5))
        if not squash: d.rectangle([5, 7, 6, 9], fill=(255, 255, 255)); d.rectangle([9, 7, 10, 9], fill=(255, 255, 255)); d.point((6, 8), fill=(0, 0, 0)); d.point((10, 8), fill=(0, 0, 0))
        return add_outline(im, 'black')
    if style == 'cute':
        if kind == 'walker':   # jelly blob
            sq = 1 if frame == 2 else 0; hgt = 5 if sq else 10 - frame
            p.ell(1.5, 15 - hgt - 1, 14.5, 15.5, (130, 210, 255)); p.ell(3.5, 15 - hgt, 8, 15 - hgt + 3, (220, 245, 255))
            if not sq:
                for ex in (6, 10.5): p.ell(ex - 1, 15 - hgt + 3.5, ex + 1, 15 - hgt + 6.5, (30, 40, 70))
                p.ell(3.5, 15 - hgt + 6.5, 5.5, 15 - hgt + 7.5, (255, 160, 190)); p.ell(11.5, 15 - hgt + 6.5, 13.5, 15 - hgt + 7.5, (255, 160, 190))
        elif kind == 'hopper':  # bunny
            y = 3 if frame == 1 else 5; sq = frame == 2
            if sq: p.ell(2, 11, 14, 16, (255, 240, 245))
            else:
                p.ell(4, y - 4, 7, y + 3, (255, 240, 245)); p.ell(9, y - 4, 12, y + 3, (255, 240, 245)); p.ell(4.8, y - 3, 6.2, y + 2, (255, 190, 210)); p.ell(9.8, y - 3, 11.2, y + 2, (255, 190, 210))
                p.ell(2, y + 1, 14, 15.5, (255, 240, 245))
                for ex in (6, 10): p.ell(ex - 0.9, y + 5, ex + 0.9, y + 7.5, (60, 40, 60))
        else:   # bee
            yy = 1 if frame else 0
            p.ell(3, 2 - yy, 8, 7 - yy, (220, 240, 255)); p.ell(8, 2 + yy, 13, 7 + yy, (220, 240, 255))
            p.ell(2, 5, 14, 14, (255, 210, 70)); p.rect(6, 5.5, 8, 13.5, (60, 40, 40)); p.rect(10, 6, 11.5, 13, (60, 40, 40))
            p.ell(3.5, 7.5, 5.3, 10, (30, 30, 40))
        return p.done(16, 16, colors=12, outline='selective')
    # realistic: shaded mechanical/insect designs
    if kind == 'walker':   # armoured beetle drone
        sq = frame == 2
        if sq: p.ell(1, 11, 15, 16, (90, 70, 60)); p.ell(3, 11.5, 12, 13.5, (160, 140, 120))
        else:
            for k, lx in enumerate((3, 7, 11)): p.line([(lx, 11), (lx + (1.5 if (k + frame) % 2 else -1.5), 15.5)], (40, 34, 30), 0.8)
            p.ell(1, 3, 15, 13, (70, 50, 40)); p.ell(1.6, 3.4, 14, 11.8, (120, 84, 56)); p.ell(3, 4, 10, 8, (200, 160, 110)); p.line([(8, 3.5), (8, 12.5)], (40, 28, 20), 0.5)
            p.ell(0.5, 7, 4, 10.5, (40, 30, 26)); p.ell(1.2, 7.8, 2.4, 9, (255, 80, 40))
    elif kind == 'hopper':  # tree frog
        y = 2 if frame == 1 else 5; sq = frame == 2
        if sq: p.ell(1, 11, 15, 16, (60, 130, 50))
        else:
            p.cap((3, y + 9), (1, 15.5), 1.2, (50, 120, 40)); p.cap((13, y + 9), (15, 15.5), 1.2, (50, 120, 40))
            p.ell(2, y + 3, 14, y + 11, (70, 160, 60)); p.ell(4, y + 7, 12, y + 11, (220, 230, 160)); p.ell(3, y + 3.5, 9, y + 6.5, (130, 210, 100))
            for ex in (4.5, 11.5): p.ell(ex - 1.7, y + 0.5, ex + 1.7, y + 4, (200, 60, 30)); p.ell(ex - 0.5, y + 1.3, ex + 0.5, y + 3.2, (10, 10, 10))
    else:   # hover drone
        yy = frame
        p.rect(1, 3 + yy, 15, 3.8 + yy, (60, 64, 72)); p.ell(0, 2.4 + yy, 4, 4.2 + yy, (200, 220, 240) if frame else (120, 140, 160)); p.ell(12, 2.4 + yy, 16, 4.2 + yy, (120, 140, 160) if frame else (200, 220, 240))
        p.ell(3, 4 + yy, 13, 12 + yy, (60, 66, 78)); p.ell(4, 4.5 + yy, 10, 8.5 + yy, (130, 140, 156)); p.ell(6, 8 + yy, 10, 12 + yy, (20, 22, 28)); p.ell(7, 9 + yy, 9, 11 + yy, (255, 60, 40))
    return p.done(16, 16, colors=14, outline='selective')

def item(style, kind, frame):
    if style == 'blocky':
        im = Image.new('RGBA', (16, 32 if kind == 'goal' else 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        if kind == 'coin': w = [6, 4, 1, 4][frame]; d.rectangle([8 - w // 2 - 1, 3, 8 + w // 2, 12], fill=(250, 200, 40)); d.rectangle([8 - w // 2, 4, 8 - w // 2, 11], fill=(255, 250, 180))
        if kind == 'heart': s = frame; d.rectangle([3 - s, 4, 7, 9], fill=(230, 40, 60)); d.rectangle([9, 4, 13 + s, 9], fill=(230, 40, 60)); d.rectangle([5, 9, 11, 12], fill=(230, 40, 60)); d.rectangle([7, 12, 9, 14], fill=(230, 40, 60))
        if kind == 'spring': top = 11 if frame else 6; d.rectangle([2, top, 13, top + 2], fill=(220, 60, 60)); d.rectangle([5, top + 2, 10, 14], fill=(160, 160, 170)); d.rectangle([2, 14, 13, 15], fill=(80, 80, 90))
        if kind == 'check': d.rectangle([3, 1, 4, 15], fill=(120, 120, 130)); d.rectangle([5, 2, 12, 7], fill=(60, 200, 80) if frame else (200, 60, 60))
        if kind == 'goal': d.rectangle([7, 2, 8, 31], fill=(200, 200, 210)); d.rectangle([9, 3 + frame, 15, 10 + frame], fill=(250, 200, 40)); d.rectangle([6, 0, 9, 2], fill=(250, 200, 40))
        return add_outline(im, 'black')
    S = 8; tall = kind == 'goal'; p = Paint(16, 32 if tall else 16, S); real = style == 'realistic'
    if kind == 'coin':
        w = [6.5, 4.5, 1.2, 4.5][frame]
        if real: p.ell(8 - w, 1.5, 8 + w, 14.5, (150, 100, 20)); p.ell(8 - w * 0.86, 2.2, 8 + w * 0.86, 13.8, (230, 180, 50)); p.ell(8 - w * 0.6, 3.5, 8 + w * 0.2, 8, (255, 240, 170)); p.ell(8 - w * 0.4, 5, 8 + w * 0.4, 11, (200, 150, 40))
        else:   # star gem
            pts = [(8 + math.sin(a) * (6.5 if k % 2 == 0 else 3) * (w / 6.5), 8 - math.cos(a) * (6.5 if k % 2 == 0 else 3)) for k, a in enumerate([i * math.pi / 5 for i in range(10)])]
            p.poly(pts, (255, 220, 80)); p.ell(6, 5, 8, 7, (255, 255, 230))
    if kind == 'heart':
        s = 0.6 * frame
        col = (200, 20, 40) if real else (255, 110, 150)
        p.ell(2 - s, 3 - s, 8.4, 9.5, col); p.ell(7.6, 3 - s, 14 + s, 9.5, col); p.poly([(2.2 - s, 7.5), (13.8 + s, 7.5), (8, 14.5 + s)], col)
        p.ell(3.5, 4, 6.5, 6.5, (255, 200, 210) if not real else (255, 120, 130))
        if real: p.poly([(8, 9), (13.5, 7.5), (8, 14.5)], (140, 10, 25))
    if kind == 'spring':
        top = 10 if frame else 5
        for k in range(3 if not frame else 2): p.ell(4, top + 2.5 + k * (2.6 if not frame else 1.2), 12, top + 4 + k * (2.6 if not frame else 1.2), (190, 195, 205) if real else (150, 230, 200))
        p.rect(2, top, 14, top + 2.4, (200, 40, 40) if real else (255, 140, 170)); p.rect(2, top, 14, top + 0.9, (255, 120, 110) if real else (255, 210, 225))
        p.rect(2, 14, 14, 16, (60, 60, 70) if real else (180, 150, 220))
    if kind == 'check':
        p.rect(3, 1, 4.4, 16, (110, 110, 120) if real else (200, 160, 120))
        col = ((40, 170, 70) if frame else (190, 50, 50)) if real else ((140, 230, 160) if frame else (255, 150, 170))
        p.poly([(4.4, 1.5), (13.5, 3.5 + frame), (4.4, 7.5)], col)
        if real: p.poly([(4.4, 4.5), (13.5, 3.5 + frame), (4.4, 7.5)], sh(col, 0.7))
    if kind == 'goal':
        p.rect(7, 2, 9, 32, (210, 210, 220) if real else (255, 240, 200)); p.rect(8.2, 2, 9, 32, (120, 120, 130) if real else (230, 200, 160))
        p.ell(5.5, 0, 10.5, 4, (240, 190, 40)); col = (250, 200, 40) if real else (120, 200, 255)
        p.poly([(9, 3 + frame), (16, 6 + frame), (9, 11 + frame)], col)
        if real: p.poly([(9, 7 + frame), (16, 6 + frame), (9, 11 + frame)], sh(col, 0.7))
    return p.done(16, 32 if tall else 16, colors=12, outline='selective' if not real else 'selective')

# ------------------------------------------------------------------ tiles (12, same order + collision as the classic sets)
TILE_NAMES = [('Empty', 0), ('Ground top', 1), ('Ground', 1), ('Brick', 1), ('Gem block', 1), ('Platform (jump through)', 2), ('Spikes (hurts)', 3), ('Column', 1), ('Bush', 0), ('Flowers', 0), ('Cloud (jump through)', 2), ('Water (hurts)', 3)]
def noise_tex(base, amt, seed, scale=1.0):
    r = np.random.RandomState(seed); n = r.rand(16, 16)
    n = (n + np.roll(n, 1, 0) + np.roll(n, 1, 1)) / 3
    arr = np.zeros((16, 16, 4), np.uint8)
    for i in range(3): arr[:, :, i] = np.clip(base[i] * (1 + (n - 0.5) * amt), 0, 255)
    arr[:, :, 3] = 255; return arr
def tiles(style):
    T = []
    blank = np.zeros((16, 16, 4), np.uint8); T.append(blank)
    if style == 'blocky':
        def flat(c): a = np.zeros((16, 16, 4), np.uint8); a[:, :, :3] = c; a[:, :, 3] = 255; return a
        g = flat((150, 100, 60)); g[:5, :, :3] = (80, 180, 70); g[0, :, :3] = (120, 220, 100); T.append(g)
        T.append(flat((150, 100, 60)))
        b = flat((180, 80, 60)); b[[0, 8], :, :3] = (90, 40, 30); b[:8, [4, 12], :3] = (90, 40, 30); b[8:, [0, 8], :3] = (90, 40, 30); T.append(b)
        q = flat((240, 190, 40)); q[0, :, :3] = q[-1, :, :3] = q[:, 0, :3] = q[:, -1, :3] = (120, 80, 10); q[4:12, 6:10, :3] = (255, 255, 255); T.append(q)
        pl = blank.copy(); pl[:5, :, :3] = (170, 120, 60); pl[:5, :, 3] = 255; pl[0, :, :3] = (220, 170, 100); T.append(pl)
        sp = blank.copy()
        for k in range(4):
            for y in range(8):
                for x in range(4 * k + y // 4, 4 * k + 4 - y // 4): sp[15 - y, x] = (200, 200, 210, 255)
        T.append(sp)
        co = flat((140, 140, 150)); co[:, [2, 13], :3] = (90, 90, 100); T.append(co)
        bu = blank.copy(); bu[8:, 1:15] = (40, 140, 50, 255); bu[6:8, 4:12] = (40, 140, 50, 255); T.append(bu)
        fl = blank.copy(); fl[10:, 7] = (40, 140, 50, 255); fl[8:10, 6:9] = (240, 80, 120, 255); fl[12:, 3] = (40, 140, 50, 255); fl[10:12, 2:5] = (250, 220, 60, 255); T.append(fl)
        cl = blank.copy(); cl[2:7, :] = (255, 255, 255, 255); cl[0:2, 3:13] = (255, 255, 255, 255); T.append(cl)
        wa = flat((40, 100, 220)); wa[0:2, :, :3] = (120, 180, 255); T.append(wa)
        return T
    if style == 'cute':
        def rounded(c, top=None, seed=0):
            p = Paint(16, 16, 8); p.rect(0, 0, 16, 16, c)
            if top: p.rect(0, 0, 16, 5, top); [p.ell(x - 2, 3, x + 2, 7, top) for x in range(0, 18, 4)]
            for k in range(3): x, y = (seed * 7 + k * 5) % 13 + 1, (seed * 3 + k * 7) % 9 + 6; p.ell(x, y, x + 2, y + 2, sh(c, 1.08))
            return np.array(p.done(16, 16))
        T.append(rounded((200, 150, 110), (130, 220, 140), 1)); T.append(rounded((200, 150, 110), None, 2))
        p = Paint(16, 16, 8); p.rect(0, 0, 16, 16, (255, 200, 210)); [p.d.rounded_rectangle([x * 8, y * 8, (x + w) * 8 - 6, (y + 8) * 8 - 6], 12, fill=(255, 170, 190)) for (x, y, w) in ((0, 0, 8), (8, 0, 8), (-4, 8, 8), (4, 8, 8), (12, 8, 8))]; T.append(np.array(p.done(16, 16)))
        p = Paint(16, 16, 8); p.d.rounded_rectangle([0, 0, 127, 127], 24, fill=(255, 210, 90)); p.ell(4, 3, 12, 13, (255, 255, 255)); p.ell(6, 5, 10, 11, (255, 140, 180)); T.append(np.array(p.done(16, 16)))
        p = Paint(16, 16, 8); p.d.rounded_rectangle([0, 0, 127, 44], 18, fill=(255, 190, 130)); p.rect(0, 0, 16, 1.5, (255, 230, 190)); T.append(np.array(p.done(16, 16)))
        p = Paint(16, 16, 8); [p.poly([(x, 16), (x + 2, 9), (x + 4, 16)], (190, 170, 240)) for x in range(0, 16, 4)]; [p.ell(x + 1.5, 9, x + 2.5, 10, (255, 255, 255)) for x in range(0, 16, 4)]; T.append(np.array(p.done(16, 16)))
        p = Paint(16, 16, 8); p.rect(2, 0, 14, 16, (250, 230, 255)); p.rect(10, 0, 14, 16, (220, 200, 240)); T.append(np.array(p.done(16, 16)))
        p = Paint(16, 16, 8); p.ell(0, 6, 9, 16, (120, 210, 130)); p.ell(6, 5, 16, 16, (120, 210, 130)); p.ell(3, 7, 6, 10, (170, 240, 170)); T.append(np.array(p.done(16, 16)))
        p = Paint(16, 16, 8); p.line([(5, 16), (5, 9)], (90, 180, 100), 0.9); p.line([(11, 16), (11, 11)], (90, 180, 100), 0.9)
        for (x, y, c) in ((5, 8, (255, 130, 170)), (11, 10, (130, 190, 255))): [p.ell(x + dx - 1.6, y + dy - 1.6, x + dx + 1.6, y + dy + 1.6, c) for dx, dy in ((0, -1.6), (1.6, 0), (0, 1.6), (-1.6, 0))]; p.ell(x - 1, y - 1, x + 1, y + 1, (255, 240, 120))
        T.append(np.array(p.done(16, 16)))
        p = Paint(16, 16, 8); p.ell(-2, 0, 8, 8, (255, 255, 255)); p.ell(4, -1, 13, 8, (255, 255, 255)); p.ell(10, 0, 18, 8, (255, 255, 255)); T.append(np.array(p.done(16, 16)))
        p = Paint(16, 16, 8); p.rect(0, 0, 16, 16, (120, 190, 255)); [p.ell(x, -2, x + 4, 3, (200, 235, 255)) for x in range(0, 16, 4)]; T.append(np.array(p.done(16, 16)))
        return T
    # realistic: textured, lit from the top-left, ambient occlusion at edges
    def lit(arr, k=0.25):
        y = np.linspace(1 + k, 1 - k, 16)[:, None]; x = np.linspace(1 + k * 0.4, 1 - k * 0.4, 16)[None, :]
        a = arr.astype(float); a[:, :, :3] *= (y * x)[:, :, None]; return np.clip(a, 0, 255).astype(np.uint8)
    dirt = noise_tex((120, 82, 52), 0.55, 1)
    r = np.random.RandomState(4)
    for _ in range(9): y, x = r.randint(4, 16), r.randint(0, 15); dirt[y, x:x + 2, :3] = (90, 86, 82); dirt[y - 1, x, :3] = (150, 146, 140)   # pebbles
    g = dirt.copy(); grass = noise_tex((70, 140, 50), 0.6, 2)
    for x in range(16):
        hgt = 4 + int(r.rand() * 3); g[:hgt, x] = grass[:hgt, x]
        if r.rand() < 0.5: g[hgt, x, :3] = (50, 100, 36)
    g[0, :, :3] = np.clip(g[0, :, :3].astype(int) + 50, 0, 255); T.append(g); T.append(dirt)
    br = noise_tex((128, 120, 112), 0.35, 3)
    for y in (0, 5, 10, 15): br[y, :, :3] = (60, 56, 54)
    for row, y0 in enumerate((0, 5, 10)):
        for x in ([3, 11] if row % 2 == 0 else [7, 15]): br[y0:y0 + 5, x, :3] = (60, 56, 54)
    for y in (1, 6, 11): br[y, :, :3] = np.clip(br[y, :, :3].astype(int) + 40, 0, 255)
    T.append(lit(br))
    mb = noise_tex((90, 100, 120), 0.2, 5); mb[0, :, :3] = (200, 210, 230); mb[:, 0, :3] = (170, 180, 200); mb[-1, :, :3] = (40, 44, 54); mb[:, -1, :3] = (40, 44, 54)
    for (y, x) in ((2, 2), (2, 13), (13, 2), (13, 13)): mb[y, x, :3] = (220, 225, 235); mb[y + 1, x, :3] = (50, 54, 64)
    mb[5:11, 5:11, :3] = (240, 180, 40); mb[5, 5:11, :3] = (255, 240, 160); mb[10, 5:11, :3] = (150, 100, 20); T.append(lit(mb, 0.15))
    pl = np.zeros((16, 16, 4), np.uint8); wood = noise_tex((150, 104, 62), 0.4, 6)
    pl[:6] = wood[:6]
    for x in range(16): pl[:6, x, :3] = np.clip(pl[:6, x, :3].astype(int) + int(8 * math.sin(x * 1.3)), 0, 255)
    pl[0, :, :3] = (200, 160, 110); pl[5, :, :3] = (70, 46, 26); pl[6:9, 3] = (60, 40, 24, 255); pl[6:9, 12] = (60, 40, 24, 255); T.append(pl)
    sp = np.zeros((16, 16, 4), np.uint8)
    for k in range(4):
        cx = 4 * k + 2
        for y in range(9):
            hw = y * 0.22
            for x in range(16):
                if abs(x + 0.5 - cx) <= hw + 0.3: t = (x + 0.5 - cx) / (hw + 0.5); sp[7 + y, x] = (*[int(v) for v in mix((230, 236, 245), (70, 74, 86), (t + 1) / 2)], 255)
    sp[15, :] = (50, 50, 58, 255); T.append(sp)
    co = noise_tex((176, 170, 160), 0.15, 7)
    for x in range(16): co[:, x, :3] = np.clip(co[:, x, :3] * (0.7 + 0.5 * math.sin(math.pi * (x + 0.5) / 16)), 0, 255)
    co[:, [3, 12], :3] = (110, 106, 100); T.append(co)
    p = Paint(16, 16, 8)
    for k in range(26): x, y = r.rand() * 16, 5 + r.rand() * 11; rr = 1.5 + r.rand() * 2; p.ell(x - rr, y - rr, x + rr, y + rr, mix((40, 90, 36), (110, 170, 70), (16 - y) / 11 * 0.7 + r.rand() * 0.3))
    T.append(np.array(p.done(16, 16)))
    p = Paint(16, 16, 8)
    for x0 in (3, 8, 12): p.line([(x0, 16), (x0 + r.rand() - 0.5, 9)], (60, 120, 50), 0.6)
    for (x, y, c) in ((3, 8.5, (220, 60, 80)), (8, 9.5, (250, 220, 240)), (12, 8, (250, 200, 60))):
        for a in range(5): ang = a * 2 * math.pi / 5; p.ell(x + math.cos(ang) * 1.3 - 1, y + math.sin(ang) * 1.3 - 1, x + math.cos(ang) * 1.3 + 1, y + math.sin(ang) * 1.3 + 1, c)
        p.ell(x - 0.6, y - 0.6, x + 0.6, y + 0.6, (250, 230, 120))
    T.append(np.array(p.done(16, 16)))
    p = Paint(16, 16, 8)   # rock ledge (jump through)
    p.poly([(0, 1), (16, 0.5), (16, 4), (13, 6), (9, 5), (5, 7), (0, 5)], (130, 124, 116)); p.poly([(0, 1), (16, 0.5), (16, 2), (0, 2.4)], (190, 184, 174)); p.poly([(5, 7), (9, 5), (13, 6), (10, 4.5), (6, 5)], (80, 76, 72))
    T.append(np.array(p.done(16, 16)))
    wa = np.zeros((16, 16, 4), np.uint8)
    for y in range(16):
        for x in range(16):
            v = math.sin(x * 0.8 + y * 0.3) * 0.5 + math.sin(x * 0.3 - y * 0.9) * 0.5
            wa[y, x] = (*[int(c) for c in mix((20, 70, 140), (60, 140, 210), 0.5 + 0.35 * v - y * 0.02)], 255)
    wa[0, :, :3] = (180, 220, 250); wa[1, ::3, :3] = (140, 200, 240); T.append(wa)
    return T

# ------------------------------------------------------------------ backgrounds 256x192
def bg(style, which):
    W, H = 256, 192
    if style == 'blocky':
        im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
        if which == 0:
            for y in range(0, H, 24): d.rectangle([0, y, W, y + 24], fill=mix((90, 160, 240), (180, 220, 255), y / H))
            for x, y, w in ((30, 30, 40), (150, 50, 56), (210, 20, 32)): d.rectangle([x, y, x + w, y + 12], fill=(255, 255, 255)); d.rectangle([x + 8, y - 8, x + w - 8, y], fill=(255, 255, 255))
            for k, col in enumerate(((70, 150, 80), (50, 120, 60))):
                for x in range(-20, W, 64): d.rectangle([x + k * 30, 110 + k * 25, x + k * 30 + 48, H], fill=col); d.rectangle([x + k * 30 + 8, 98 + k * 25, x + k * 30 + 40, 110 + k * 25], fill=col)
        else:
            for y in range(0, H, 16): d.rectangle([0, y, W, y + 16], fill=mix((20, 20, 50), (70, 40, 90), y / H))
            for x in range(0, W, 40):
                h = 60 + (x * 37) % 70; d.rectangle([x, H - h, x + 34, H], fill=(40, 40, 60))
                for wy in range(H - h + 6, H - 6, 10):
                    for wx in range(x + 4, x + 30, 8):
                        if ((wx * 73856093) ^ (wy * 19349663)) % 7 < 3: d.rectangle([wx, wy, wx + 3, wy + 4], fill=(250, 220, 100))
        return im, ['Block Hills', 'Block City'][which]
    if style == 'cute':
        im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
        top, bot = ((255, 200, 230), (190, 230, 255)) if which == 0 else ((150, 120, 220), (255, 170, 200))
        for y in range(H): d.line([(0, y), (W, y)], fill=mix(top, bot, y / H))
        if which == 1:
            for k in range(40): x, y = rnd.randrange(W), rnd.randrange(100); d.point((x, y), fill=(255, 255, 255))
            d.ellipse([190, 18, 230, 58], fill=(255, 250, 220)); d.ellipse([200, 14, 236, 50], fill=mix(top, bot, 0.15))
        p = Paint(W, H, 2)
        for (x, y, s) in ((40, 30, 1.0), (150, 55, 0.8), (220, 25, 0.7)):
            for dx, dy, r in ((0, 0, 14), (14, -6, 16), (30, 0, 13)): p.ell(x + dx * s - r * s, y + dy * s - r * s, x + dx * s + r * s, y + dy * s + r * s, (255, 255, 255))
            p.ell(x + 8 * s, y - 3 * s, x + 11 * s, y + 1 * s, (90, 70, 100)); p.ell(x + 19 * s, y - 3 * s, x + 22 * s, y + 1 * s, (90, 70, 100))
        cols = [((170, 230, 190), (120, 200, 160)), ((255, 190, 220), (230, 150, 200))][which]
        for k, col in enumerate(cols):
            for x in range(-60, W + 60, 110): p.ell(x + k * 55, 100 + k * 30, x + k * 55 + 140, 260 + k * 30, col)
        ov = p.im.resize((W, H), Image.LANCZOS); im.paste(ov, (0, 0), ov)
        return im, ['Candy Hills', 'Dreamy Night'][which]
    # realistic: painted sky, atmospheric layers, value-graded depth
    a = np.zeros((H, W, 3), float)
    if which == 0:
        sky_t, sky_b = np.array((70, 120, 200)), np.array((235, 200, 170))
        for y in range(H): a[y] = sky_t + (sky_b - sky_t) * min(1, (y / 120) ** 1.3)
        yy, xx = np.mgrid[0:H, 0:W]; sun = np.exp(-(((xx - 190) ** 2 + (yy - 95) ** 2) / 900.0)); halo = np.exp(-(((xx - 190) ** 2 + (yy - 95) ** 2) / 9000.0))
        a += sun[:, :, None] * np.array((255, 240, 200)) * 0.9 + halo[:, :, None] * np.array((255, 200, 140)) * 0.35
        r = np.random.RandomState(9)
        def ridge(base, amp, rough, seed):
            rr = np.random.RandomState(seed); x = np.arange(W); h = np.zeros(W)
            for o in range(1, 7): ph = rr.rand() * 6.28; h += np.sin(x / W * 6.28 * o * rough + ph) * amp / o
            return base + h
        layers = [(95, 22, 1.0, (120, 130, 160), 0.6), (115, 18, 1.6, (90, 110, 120), 0.4), (135, 14, 2.4, (60, 90, 70), 0.2), (160, 10, 3.5, (40, 70, 40), 0.0)]
        for i, (base, amp, rough, col, haze) in enumerate(layers):
            h = ridge(base, amp, rough, 20 + i)
            for x in range(W):
                y0 = int(max(0, h[x]))
                for y in range(y0, H):
                    shade = 1 - (y - y0) / 180
                    c = np.array(col) * shade
                    c = c * (1 - haze) + a[y, x] * haze * 0.9 + np.array((255, 220, 190)) * haze * 0.1
                    a[y, x] = c
            if i >= 2:    # tree texture on the near ridges
                for k in range(int(W * (0.6 if i == 2 else 1.0))):
                    x = r.randint(0, W); y = int(h[x]) + r.randint(-2, 6); s = r.randint(2, 5) if i == 3 else r.randint(1, 3)
                    if 0 <= y < H: a[max(0, y - s):y + 1, max(0, x - s // 2):x + s // 2 + 1] = np.array(col) * (0.7 + 0.5 * r.rand())
        name = 'Golden Valley'
    else:
        for y in range(H): a[y] = np.array((10, 14, 34)) + (np.array((80, 50, 90)) - np.array((10, 14, 34))) * (y / H) ** 1.6
        r = np.random.RandomState(12)
        for k in range(120): x, y = r.randint(0, W), r.randint(0, 110); a[y, x] = (255, 255, 255) if r.rand() < 0.3 else (160, 170, 200)
        yy, xx = np.mgrid[0:H, 0:W]; m = np.exp(-(((xx - 60) ** 2 + (yy - 40) ** 2) / 120.0)); a += m[:, :, None] * np.array((240, 240, 220))
        for depth, (col, hmin, hmax, win) in enumerate((((40, 40, 70), 50, 110, 0.15), ((26, 26, 46), 70, 140, 0.3), ((14, 14, 26), 40, 90, 0.45))):
            x = -10 + depth * 13
            while x < W:
                w = r.randint(18, 40); h = r.randint(hmin, hmax); y0 = H - h
                a[y0:H, max(0, x):x + w] = np.array(col) * (1 + depth * 0.05)
                a[y0:H, max(0, x):x + 2] = np.array(col) * 1.4
                for wy in range(y0 + 4, H - 4, 6):
                    for wx in range(x + 3, x + w - 3, 5):
                        if r.rand() < win and 0 <= wx < W - 2: a[wy:wy + 3, wx:wx + 2] = np.array((255, 214, 140)) * (0.6 + 0.4 * r.rand())
                x += w + r.randint(0, 6)
        glow = np.exp(-((yy - H) ** 2) / 1200.0); a += glow[:, :, None] * np.array((80, 40, 60)) * 0.6
        name = 'Midnight Skyline'
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)), name

# ------------------------------------------------------------------ write
lib = json.load(open(f'{LIB}/library.json'))
for k in ('tilesets', 'backgrounds', 'sprites'):
    lib[k] = [e for e in lib[k] if e.get('style', 'classic') == 'classic']
    for e in lib[k]: e['style'] = 'classic'
lib['styles'] = [{'id': 'classic', 'name': 'Classic pixel', 'about': 'The original dev kit look: clean 16-bit style pixel art.'},
                 {'id': 'blocky', 'name': 'Blocky / generic', 'about': 'Chunky shapes and flat colours. Fast to read, easy to edit, great for prototypes and retro games.'},
                 {'id': 'cute', 'name': 'Cartoon / cute', 'about': 'Round shapes, big eyes, pastel colours, soft outlines.'},
                 {'id': 'realistic', 'name': 'Cutting edge / realistic', 'about': 'Shaded, lit sprites with 7-heads-tall bodies (wrestling-game rig proportions), textured tiles and painted backgrounds.'}]
FN = ['idle', 'walk 1', 'walk 2', 'jump', 'hurt']
for style in ('blocky', 'cute', 'realistic'):
    d = f'{LIB}/styles/{style}'; os.makedirs(d, exist_ok=True)
    for cid, c in CAST.items():
        fr = [PEOPLE[style](c, pz) for pz in ('idle', 'walk1', 'walk2', 'jump', 'hurt')]
        w, h = fr[0].size; strip(fr).save(f'{d}/hero_{cid}.png')
        lib['sprites'].append({'id': f'{style}_hero_{cid}', 'name': f"{c['name']} ({style})", 'role': 'hero', 'png': f'styles/{style}/hero_{cid}.png', 'w': w, 'h': h, 'frames': 5, 'frame_names': FN, 'style': style})
    names = {'blocky': {'walker': 'Block Walker', 'hopper': 'Block Hopper', 'flyer': 'Block Flyer'}, 'cute': {'walker': 'Jelly Blob', 'hopper': 'Bun Bun', 'flyer': 'Buzzy Bee'}, 'realistic': {'walker': 'Beetle Drone', 'hopper': 'Tree Frog', 'flyer': 'Hover Drone'}}[style]
    for kind, nf in (('walker', 3), ('hopper', 3), ('flyer', 2)):
        strip([enemy(style, kind, f) for f in range(nf)]).save(f'{d}/{kind}.png')
        lib['sprites'].append({'id': f'{style}_{kind}', 'name': names[kind], 'role': kind, 'png': f'styles/{style}/{kind}.png', 'w': 16, 'h': 16, 'frames': nf, 'style': style})
    for kind, nf in (('coin', 4), ('heart', 2), ('spring', 2), ('check', 2), ('goal', 2)):
        strip([item(style, kind, f) for f in range(nf)]).save(f'{d}/{kind}.png')
        lib['sprites'].append({'id': f'{style}_{kind}', 'name': f'{kind.title()} ({style})', 'role': kind, 'png': f'styles/{style}/{kind}.png', 'w': 16, 'h': 32 if kind == 'goal' else 16, 'frames': nf, 'style': style})
    T = tiles(style); ts = Image.new('RGBA', (16 * len(T), 16), (0, 0, 0, 0))
    for i, t in enumerate(T): ts.paste(Image.fromarray(t), (i * 16, 0))
    ts.save(f'{d}/tiles.png')
    lib['tilesets'].append({'id': f'{style}_tiles', 'name': {'blocky': 'Block World', 'cute': 'Candy Land', 'realistic': 'Wild Earth'}[style], 'png': f'styles/{style}/tiles.png', 'tiles': [{'name': n, 'col': c} for n, c in TILE_NAMES], 'style': style})
    for which in (0, 1):
        im, nm = bg(style, which); im.save(f'{d}/bg{which}.png')
        lib['backgrounds'].append({'id': f'{style}_bg{which}', 'name': nm, 'png': f'styles/{style}/bg{which}.png', 'style': style})
json.dump(lib, open(f'{LIB}/library.json', 'w'), indent=1)
print('styles written:', {k: len(lib[k]) for k in ('tilesets', 'backgrounds', 'sprites')})

#!/usr/bin/env python3
"""NOTAREAL Dev Kit built-in library (all original art/sound): tilesets, backgrounds, heroes, enemies,
items, songs and sound clips. Writes PNG/WAV/JSON plus library.json into the output folder."""
import json, math, os, random, struct, sys, wave
from PIL import Image, ImageDraw

OUT = sys.argv[1]
for d in ('tiles', 'backgrounds', 'sprites', 'songs', 'sfx'): os.makedirs(f'{OUT}/{d}', exist_ok=True)
random.seed(64)
lib = {'tilesets': [], 'backgrounds': [], 'sprites': [], 'songs': [], 'sfx': []}

def shade(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + ((c[3],) if len(c) > 3 else ())

# ------------------------------------------------------------------ tilesets (16x16 metatiles)
def tile(): return Image.new('RGBA', (16, 16), (0, 0, 0, 0))
def noise_fill(im, base, amt=10, box=(0, 0, 16, 16)):
    px = im.load()
    for y in range(box[1], box[3]):
        for x in range(box[0], box[2]):
            k = 1 + (random.random() - 0.5) * amt / 50
            px[x, y] = shade(base, k) + (255,)
def outline_top(im, col):
    d = ImageDraw.Draw(im); d.line([(0, 0), (15, 0)], fill=col)

def grass_tiles(theme):
    G = {'grass': (86, 170, 64), 'dirt': (150, 98, 56), 'stone': (128, 128, 140), 'wood': (176, 120, 64)}
    if theme == 'city':
        G = {'grass': (90, 90, 104), 'dirt': (70, 66, 78), 'stone': (150, 60, 50), 'wood': (200, 170, 60)}
    if theme == 'castle':
        G = {'grass': (120, 120, 140), 'dirt': (84, 80, 100), 'stone': (110, 100, 120), 'wood': (140, 90, 50)}
    T = []
    # 0: empty (sky)
    T.append(('Empty', tile(), 0))
    # ground top
    t = tile(); noise_fill(t, G['dirt']); d = ImageDraw.Draw(t)
    noise_fill(t, G['grass'], 12, (0, 0, 16, 5))
    for x in range(0, 16, 3): d.point((x, 5 + (x % 2)), fill=G['grass'] + (255,))
    d.line([(0, 0), (15, 0)], fill=shade(G['grass'], 1.3) + (255,))
    T.append(('Ground top', t, 1))
    # ground fill
    t = tile(); noise_fill(t, G['dirt'], 14); d = ImageDraw.Draw(t)
    for _ in range(4): x, y = random.randrange(16), random.randrange(16); d.point((x, y), fill=shade(G['dirt'], 0.7) + (255,))
    T.append(('Ground', t, 1))
    # brick / block
    t = tile(); noise_fill(t, G['stone'], 8); d = ImageDraw.Draw(t)
    for y in (0, 8): d.line([(0, y), (15, y)], fill=shade(G['stone'], 0.6) + (255,))
    for x in (4, 12): d.line([(x, 1), (x, 7)], fill=shade(G['stone'], 0.6) + (255,))
    for x in (0, 8): d.line([(x, 9), (x, 15)], fill=shade(G['stone'], 0.6) + (255,))
    d.line([(0, 1), (15, 1)], fill=shade(G['stone'], 1.25) + (255,))
    T.append(('Brick', t, 1))
    # bonus block
    t = tile(); d = ImageDraw.Draw(t); d.rectangle([0, 0, 15, 15], fill=(120, 60, 200, 255), outline=(60, 30, 110, 255))
    d.polygon([(8, 2), (13, 8), (8, 14), (3, 8)], fill=(90, 220, 230, 255)); d.polygon([(8, 2), (8, 8), (3, 8)], fill=(200, 250, 255, 255))
    T.append(('Gem block', t, 1))
    # one-way platform
    t = tile(); d = ImageDraw.Draw(t); d.rectangle([0, 0, 15, 5], fill=G['wood'] + (255,)); d.line([(0, 0), (15, 0)], fill=shade(G['wood'], 1.3) + (255,))
    d.line([(0, 5), (15, 5)], fill=shade(G['wood'], 0.6) + (255,))
    for x in (3, 12): d.line([(x, 6), (x, 9)], fill=shade(G['wood'], 0.7) + (255,))
    T.append(('Platform (jump through)', t, 2))
    # spikes
    t = tile(); d = ImageDraw.Draw(t)
    for i in range(4):
        x = i * 4; d.polygon([(x, 15), (x + 2, 6), (x + 3, 15)], fill=(200, 200, 210, 255)); d.line([(x + 2, 6), (x + 2, 15)], fill=(255, 255, 255, 255))
    d.rectangle([0, 14, 15, 15], fill=(90, 90, 100, 255))
    T.append(('Spikes (hurts)', t, 3))
    # pillar / pipe-like column (original look: banded column)
    t = tile(); d = ImageDraw.Draw(t); d.rectangle([2, 0, 13, 15], fill=(70, 150, 190, 255))
    d.line([(3, 0), (3, 15)], fill=(140, 210, 240, 255)); d.line([(12, 0), (12, 15)], fill=(40, 90, 130, 255))
    for y in (4, 11): d.line([(2, y), (13, y)], fill=(40, 90, 130, 255))
    T.append(('Column', t, 1))
    # decorations (no collision)
    t = tile(); d = ImageDraw.Draw(t)
    if theme == 'grass':
        d.ellipse([1, 6, 14, 16], fill=(60, 140, 50, 255)); d.ellipse([4, 3, 12, 12], fill=(76, 164, 60, 255)); d.point((7, 6), fill=(140, 220, 110, 255))
        name = 'Bush'
    elif theme == 'city':
        d.rectangle([7, 2, 8, 15], fill=(60, 60, 70, 255)); d.rectangle([4, 0, 11, 3], fill=(250, 230, 140, 255)); name = 'Street lamp'
    else:
        d.rectangle([6, 4, 9, 15], fill=(110, 70, 40, 255)); d.polygon([(5, 4), (10, 4), (7, 0)], fill=(255, 160, 40, 255)); name = 'Torch'
    T.append((name, t, 0))
    t = tile(); d = ImageDraw.Draw(t)
    for i, c in enumerate([(240, 80, 90), (250, 220, 80), (150, 120, 240)]):
        x = 2 + i * 5; d.line([(x + 1, 9), (x + 1, 15)], fill=(60, 140, 50, 255)); d.ellipse([x, 6, x + 3, 9], fill=c + (255,))
    T.append(('Flowers', t, 0))
    # cloud platform
    t = tile(); d = ImageDraw.Draw(t); d.ellipse([0, 0, 9, 8], fill=(250, 250, 255, 255)); d.ellipse([6, 0, 15, 8], fill=(250, 250, 255, 255))
    d.line([(1, 7), (14, 7)], fill=(190, 200, 230, 255))
    T.append(('Cloud (jump through)', t, 2))
    # water (hazard)
    t = tile(); d = ImageDraw.Draw(t); d.rectangle([0, 3, 15, 15], fill=(50, 110, 210, 255))
    for x in range(0, 16, 4): d.arc([x, 1, x + 4, 5], 180, 360, fill=(170, 220, 255, 255))
    T.append(('Water (hurts)', t, 3))
    return T

for theme, nice in (('grass', 'Sunny Fields'), ('city', 'Lakewood Streets'), ('castle', 'Castle Keep')):
    T = grass_tiles(theme)
    sheet = Image.new('RGBA', (16 * len(T), 16), (0, 0, 0, 0))
    for i, (_, t, _) in enumerate(T): sheet.paste(t, (i * 16, 0))
    fn = f'tiles/{theme}.png'; sheet.save(f'{OUT}/{fn}')
    lib['tilesets'].append({'id': theme, 'name': nice, 'png': fn, 'tiles': [{'name': n, 'col': c} for n, _, c in T]})

# ------------------------------------------------------------------ backgrounds 256x192
def grad(d, top, bot, y0=0, y1=192):
    for y in range(y0, y1):
        k = (y - y0) / max(1, y1 - y0 - 1); d.line([(0, y), (255, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * k) for i in range(3)))
def bg_hills():
    im = Image.new('RGB', (256, 192)); d = ImageDraw.Draw(im); grad(d, (110, 180, 250), (200, 235, 255))
    for cx, cy in [(40, 30), (150, 50), (220, 25)]:
        for dx, r in [(-12, 9), (0, 13), (12, 9)]: d.ellipse([cx + dx - r, cy - r, cx + dx + r, cy + r], fill=(255, 255, 255))
    for layer, (col, base, amp) in enumerate([((130, 190, 140), 120, 22), ((90, 160, 90), 145, 16)]):
        pts = [(x, base + int(amp * math.sin(x / (38 + layer * 10) + layer))) for x in range(0, 257, 4)]
        d.polygon(pts + [(256, 192), (0, 192)], fill=col)
    return im
def bg_city():
    im = Image.new('RGB', (256, 192)); d = ImageDraw.Draw(im); grad(d, (20, 22, 60), (90, 50, 110))
    for _ in range(40): d.point((random.randrange(256), random.randrange(90)), fill=(255, 255, 230))
    d.ellipse([196, 18, 222, 44], fill=(250, 245, 210)); d.ellipse([204, 16, 228, 40], fill=(48, 34, 84))
    x = 0
    while x < 256:
        w, h = random.randint(18, 34), random.randint(50, 120); col = random.choice([(40, 40, 70), (50, 46, 80), (34, 34, 60)])
        d.rectangle([x, 192 - h, x + w, 192], fill=col)
        for wy in range(192 - h + 6, 186, 9):
            for wx in range(x + 4, x + w - 3, 6):
                if random.random() < 0.55: d.rectangle([wx, wy, wx + 2, wy + 3], fill=random.choice([(250, 220, 120), (240, 200, 90), (180, 220, 255)]))
        x += w + random.randint(0, 4)
    d.rectangle([0, 180, 255, 191], fill=(30, 30, 40))
    return im
def bg_castle():
    im = Image.new('RGB', (256, 192)); d = ImageDraw.Draw(im); grad(d, (240, 140, 90), (90, 50, 110))
    d.ellipse([30, 100, 90, 160], fill=(255, 200, 120))
    for x0, h in [(0, 90), (60, 120), (130, 100), (190, 130)]:
        d.rectangle([x0, 192 - h, x0 + 50, 192], fill=(60, 40, 80))
        for k in range(0, 50, 10): d.rectangle([x0 + k, 192 - h - 8, x0 + k + 5, 192 - h], fill=(60, 40, 80))
        d.rectangle([x0 + 20, 192 - h + 20, x0 + 28, 192 - h + 34], fill=(250, 200, 100))
    return im
for bid, name, fn in (('hills', 'Sunny Hills', bg_hills), ('city', 'Night City', bg_city), ('castle', 'Castle Dusk', bg_castle)):
    p = f'backgrounds/{bid}.png'; fn().save(f'{OUT}/{p}'); lib['backgrounds'].append({'id': bid, 'name': name, 'png': p})

# ------------------------------------------------------------------ heroes 16x32, frames: idle, walk1, walk2, jump, hurt
def hero(skin, hair, shirt, pants, shoes, style, extra=None):
    frames = []
    for f in range(5):
        im = Image.new('RGBA', (16, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        ol = (30, 24, 30, 255)
        lift = -1 if f == 3 else 0
        # legs
        if f in (1, 2):
            a, b = (2, -2) if f == 1 else (-2, 2)
            d.rectangle([5 + a, 22 + lift, 7 + a, 29], fill=pants); d.rectangle([9 + b, 22 + lift, 11 + b, 29], fill=pants)
            d.rectangle([4 + a, 29, 7 + a, 31], fill=shoes); d.rectangle([9 + b, 29, 12 + b, 31], fill=shoes)
        elif f == 3:
            d.rectangle([4, 21, 7, 26], fill=pants); d.rectangle([9, 21, 12, 28], fill=pants)
            d.rectangle([3, 26, 7, 28], fill=shoes); d.rectangle([9, 28, 13, 30], fill=shoes)
        else:
            d.rectangle([5, 22, 7, 29], fill=pants); d.rectangle([9, 22, 11, 29], fill=pants)
            d.rectangle([4, 29, 7, 31], fill=shoes); d.rectangle([9, 29, 12, 31], fill=shoes)
        # body
        d.rectangle([4, 13 + lift, 12, 22 + lift], fill=shirt)
        d.line([(12, 13 + lift), (12, 22 + lift)], fill=shade(shirt, 0.75))
        if extra == 'apron': d.rectangle([5, 15 + lift, 11, 22 + lift], fill=(220, 170, 40, 255)); d.line([(5, 15 + lift), (11, 15 + lift)], fill=(170, 120, 30, 255))
        if extra == 'tag': d.rectangle([9, 15 + lift, 11, 16 + lift], fill=(250, 250, 250, 255))
        # arms
        if f == 3: d.rectangle([2, 10, 3, 15], fill=skin); d.rectangle([13, 10, 14, 15], fill=skin)
        elif f == 4: d.rectangle([1, 12, 3, 14], fill=skin); d.rectangle([13, 12, 15, 14], fill=skin)
        else:
            s = 1 if f == 1 else (-1 if f == 2 else 0)
            d.rectangle([2, 14 + s, 3, 20 + s], fill=shirt); d.rectangle([2, 20 + s, 3, 21 + s], fill=skin)
            d.rectangle([13, 14 - s, 14, 20 - s], fill=shade(shirt, 0.8)); d.rectangle([13, 20 - s, 14, 21 - s], fill=skin)
        # head (3/4 view facing right)
        hy = 3 + lift
        d.rectangle([4, hy, 12, hy + 9], fill=skin)
        d.line([(12, hy + 1), (12, hy + 9)], fill=shade(skin, 0.82))
        d.rectangle([5, hy + 10, 11, hy + 10], fill=shade(skin, 0.8))
        # hair
        if style == 'mohawk':
            d.rectangle([7, hy - 3, 9, hy + 1], fill=hair); d.rectangle([4, hy, 12, hy], fill=shade(skin, 0.75)); d.rectangle([3, hy + 1, 4, hy + 8], fill=hair)
        elif style == 'bun':
            d.rectangle([4, hy - 1, 12, hy + 2], fill=hair); d.rectangle([6, hy - 4, 9, hy - 1], fill=hair); d.rectangle([3, hy, 4, hy + 6], fill=hair)
        elif style == 'wavy':
            d.rectangle([3, hy - 1, 12, hy + 2], fill=hair); d.rectangle([2, hy, 4, hy + 12], fill=hair); d.point((3, hy + 13), fill=hair); d.rectangle([11, hy + 1, 12, hy + 4], fill=hair)
        elif style == 'cap':
            d.rectangle([3, hy - 1, 12, hy + 2], fill=(40, 170, 140, 255)); d.rectangle([10, hy + 2, 15, hy + 3], fill=(20, 120, 100, 255)); d.rectangle([3, hy + 3, 4, hy + 6], fill=hair)
        # face
        if f == 4:
            d.line([(9, hy + 4), (11, hy + 6)], fill=ol); d.line([(11, hy + 4), (9, hy + 6)], fill=ol)
        else:
            d.rectangle([9, hy + 4, 10, hy + 5], fill=(255, 255, 255, 255)); d.point((10, hy + 5), fill=(40, 30, 30, 255))
            d.line([(8, hy + 3), (11, hy + 3)], fill=shade(hair, 0.9))
            d.line([(9, hy + 8), (11, hy + 8)], fill=shade(skin, 0.6))
        if extra == 'glasses' or extra == 'tag':
            d.rectangle([8, hy + 3, 11, hy + 6], outline=(30, 30, 34, 255))
        if extra == 'tag': d.line([(8, hy + 8), (11, hy + 8)], fill=hair)
        frames.append(im)
    return frames
HEROES = [
    ('kid', 'Kid Notareal', hero((240, 200, 170, 255), (90, 60, 40, 255), (240, 140, 40, 255), (60, 70, 90, 255), (240, 240, 240, 255), 'cap')),
    ('steve', 'Steve', hero((226, 184, 158, 255), (40, 30, 26, 255), (40, 40, 44, 255), (40, 50, 80, 255), (30, 30, 30, 255), 'mohawk')),
    ('rebecca', 'Rebecca', hero((236, 196, 172, 255), (80, 50, 32, 255), (150, 150, 154, 255), (50, 60, 90, 255), (120, 80, 50, 255), 'wavy', 'apron')),
    ('austin', 'Austin', hero((150, 100, 70, 255), (20, 18, 20, 255), (190, 30, 36, 255), (30, 30, 34, 255), (30, 30, 30, 255), 'bun', 'tag')),
]
def save_sheet(frames, path):
    w, h = frames[0].size; s = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames): s.paste(f, (i * w, 0))
    s.save(f'{OUT}/{path}')
for hid, name, fr in HEROES:
    p = f'sprites/hero_{hid}.png'; save_sheet(fr, p)
    lib['sprites'].append({'id': 'hero_' + hid, 'name': name, 'role': 'hero', 'png': p, 'w': 16, 'h': 32, 'frames': 5, 'frame_names': ['idle', 'walk 1', 'walk 2', 'jump', 'hurt']})

# ------------------------------------------------------------------ enemies and items 16x16
def blob(col):
    fr = []
    for f in range(3):
        im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        if f == 2:
            d.ellipse([1, 10, 14, 15], fill=col); fr.append(im); continue
        d.ellipse([1, 2, 14, 14], fill=col); d.ellipse([3, 3, 8, 7], fill=shade(col, 1.25))
        d.rectangle([4, 6, 6, 9], fill=(255, 255, 255, 255)); d.rectangle([9, 6, 11, 9], fill=(255, 255, 255, 255))
        d.point((5, 8), fill=(20, 20, 20, 255)); d.point((10, 8), fill=(20, 20, 20, 255))
        d.line([(4, 5), (6, 6)], fill=(40, 20, 20, 255)); d.line([(11, 5), (9, 6)], fill=(40, 20, 20, 255))
        o = 1 if f else -1
        d.rectangle([3 + o, 13, 6 + o, 15], fill=(60, 40, 30, 255)); d.rectangle([9 - o, 13, 12 - o, 15], fill=(60, 40, 30, 255))
        fr.append(im)
    return fr
def robot():
    fr = []
    for f in range(3):
        im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im); m = (150, 160, 175, 255)
        if f == 2: d.rectangle([2, 11, 13, 15], fill=m); d.line([(3, 13), (12, 13)], fill=(90, 90, 100, 255)); fr.append(im); continue
        d.rectangle([3, 3, 12, 12], fill=m); d.line([(3, 3), (12, 3)], fill=(210, 215, 225, 255)); d.line([(7, 0), (7, 3)], fill=(90, 90, 100, 255)); d.point((7, 0), fill=(255, 80, 80, 255))
        d.rectangle([5, 6, 10, 8], fill=(30, 30, 40, 255)); d.point((6 + f * 3, 7), fill=(90, 230, 255, 255))
        d.ellipse([3, 12, 6, 15], fill=(60, 60, 70, 255)); d.ellipse([9, 12, 12, 15], fill=(60, 60, 70, 255))
        fr.append(im)
    return fr
def frog():
    fr = []
    for f in range(3):
        im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im); g = (80, 200, 90, 255)
        if f == 2: d.ellipse([1, 11, 14, 15], fill=g); fr.append(im); continue
        y = -3 if f == 1 else 0
        d.ellipse([2, 5 + y, 13, 14 + y], fill=g); d.ellipse([2, 2 + y, 7, 7 + y], fill=g); d.ellipse([8, 2 + y, 13, 7 + y], fill=g)
        d.point((4, 4 + y), fill=(20, 20, 20, 255)); d.point((11, 4 + y), fill=(20, 20, 20, 255)); d.line([(5, 10 + y), (10, 10 + y)], fill=(30, 90, 40, 255))
        if f == 1: d.line([(3, 12), (1, 15)], fill=g); d.line([(12, 12), (14, 15)], fill=g)
        else: d.rectangle([1, 13, 4, 15], fill=g); d.rectangle([11, 13, 14, 15], fill=g)
        fr.append(im)
    return fr
def bee():
    fr = []
    for f in range(2):
        im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        wy = 1 if f else 3
        d.ellipse([3, wy, 8, wy + 5], fill=(220, 240, 255, 200)); d.ellipse([8, wy, 13, wy + 5], fill=(220, 240, 255, 200))
        d.ellipse([2, 6, 14, 14], fill=(250, 200, 40, 255))
        for x in (6, 10): d.line([(x, 6), (x, 14)], fill=(40, 30, 20, 255))
        d.point((3, 9), fill=(20, 20, 20, 255)); d.line([(14, 10), (15, 11)], fill=(40, 30, 20, 255))
        fr.append(im)
    return fr
def coin():
    fr = []
    for f, w in enumerate([6, 4, 1, 4]):
        im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.ellipse([8 - w, 2, 7 + w, 13], fill=(250, 200, 40, 255), outline=(190, 130, 20, 255))
        if w > 2: d.line([(8, 5), (8, 10)], fill=(255, 240, 150, 255))
        fr.append(im)
    return fr
def flag():
    fr = []
    for f in range(2):
        im = Image.new('RGBA', (16, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rectangle([2, 2, 3, 31], fill=(220, 220, 230, 255)); d.ellipse([1, 0, 4, 3], fill=(250, 210, 60, 255))
        wave_ = 1 if f else 0
        d.polygon([(4, 4), (15, 7 + wave_), (4, 12)], fill=(90, 70, 220, 255)); d.text((5, 4), 'N', fill=(255, 255, 255, 255))
        d.rectangle([0, 29, 6, 31], fill=(120, 120, 130, 255))
        fr.append(im)
    return fr
def spring():
    fr = []
    for f in range(2):
        im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im); top = 4 if f == 0 else 10
        d.rectangle([1, top, 14, top + 2], fill=(230, 60, 60, 255)); d.rectangle([1, 14, 14, 15], fill=(120, 120, 130, 255))
        for y in range(top + 3, 14, 2): d.line([(4, y), (11, y)], fill=(200, 200, 210, 255))
        fr.append(im)
    return fr
def heart():
    fr = []
    for f in range(2):
        im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im); s = 0 if f == 0 else 1
        d.ellipse([2 + s, 3 + s, 8, 9], fill=(240, 60, 90, 255)); d.ellipse([7, 3 + s, 13 - s, 9], fill=(240, 60, 90, 255)); d.polygon([(2 + s, 7), (13 - s, 7), (8, 14 - s)], fill=(240, 60, 90, 255))
        d.point((5, 5), fill=(255, 200, 210, 255)); fr.append(im)
    return fr
def checkpoint():
    fr = []
    for f in range(2):
        im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rectangle([7, 1, 8, 15], fill=(200, 200, 210, 255)); d.rectangle([4, 13, 11, 15], fill=(120, 120, 130, 255))
        d.ellipse([4, 0, 11, 6], fill=(80, 230, 110, 255) if f else (150, 150, 160, 255))
        fr.append(im)
    return fr
ITEMS = [('walker', 'Grumble (walks)', 'walker', blob((200, 80, 200, 255))), ('walker2', 'Rusty Bot (walks)', 'walker', robot()),
         ('hopper', 'Springy Frog (hops)', 'hopper', frog()), ('flyer', 'Buzz Bee (flies)', 'flyer', bee()),
         ('coin', 'Coin', 'coin', coin()), ('goal', 'Goal flag', 'goal', flag()), ('spring', 'Spring', 'spring', spring()),
         ('heart', 'Heart (1-UP)', 'heart', heart()), ('check', 'Checkpoint', 'check', checkpoint())]
for iid, name, role, fr in ITEMS:
    p = f'sprites/{iid}.png'; save_sheet(fr, p)
    lib['sprites'].append({'id': iid, 'name': name, 'role': role, 'png': p, 'w': fr[0].width, 'h': fr[0].height, 'frames': len(fr)})

# ------------------------------------------------------------------ songs (4 channels: lead, bass, harmony, drums)
def song(name, tempo, bars, lead, bass, harm, drum):
    steps = 16 * bars
    def expand(seq):
        out = []
        for n in seq: out += [n, 128] if n not in (0,) else [0, 0]
        return (out * (steps // max(1, len(out)) + 1))[:steps]
    return {'name': name, 'tempo': tempo, 'steps': steps, 'ch': [expand(lead), expand(bass), expand(harm), (drum * (steps // len(drum) + 1))[:steps]]}
D1 = [1, 0, 3, 0, 2, 0, 3, 0, 1, 1, 3, 0, 2, 0, 3, 3]
S = [
    song('Sunny Run', 7, 4, [72, 76, 79, 76, 77, 76, 74, 0, 72, 76, 79, 84, 83, 79, 77, 0, 76, 74, 72, 74, 76, 79, 77, 76, 74, 72, 71, 72, 74, 0, 72, 0],
         [48, 0, 55, 0, 53, 0, 55, 0, 48, 0, 55, 0, 50, 0, 55, 0], [64, 0, 67, 0, 65, 0, 67, 0], D1),
    song('Night Shift', 8, 4, [69, 72, 76, 74, 72, 69, 67, 69, 0, 72, 74, 76, 79, 76, 74, 0], [45, 0, 45, 52, 43, 0, 43, 50, 41, 0, 41, 48, 40, 0, 47, 0], [57, 0, 60, 0, 55, 0, 59, 0], [1, 0, 3, 3, 2, 0, 3, 0, 1, 0, 3, 1, 2, 0, 3, 3]),
    song('Castle March', 9, 4, [62, 62, 65, 69, 67, 65, 64, 62, 60, 62, 64, 65, 64, 0, 0, 0], [38, 0, 45, 0, 41, 0, 45, 0, 36, 0, 43, 0, 40, 0, 45, 0], [50, 0, 53, 0, 52, 0, 48, 0], [1, 0, 0, 0, 2, 0, 1, 0, 1, 0, 0, 0, 2, 0, 2, 2]),
    song('Victory', 6, 2, [72, 72, 72, 76, 79, 0, 76, 79, 84, 0, 0, 0, 0, 0, 0, 0], [48, 0, 52, 0, 55, 0, 52, 0, 48, 0, 0, 0], [0], [1, 0, 2, 0, 1, 1, 2, 0]),
]
for s in S:
    p = f"songs/{s['name'].lower().replace(' ', '_')}.json"; json.dump(s, open(f'{OUT}/{p}', 'w'))
    lib['songs'].append({'name': s['name'], 'json': p})

# ------------------------------------------------------------------ sound clips (8-bit 16384 Hz WAV)
RATE = 16384
def wav(name, samples):
    p = f'sfx/{name}.wav'
    with wave.open(f'{OUT}/{p}', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(1); w.setframerate(RATE)
        w.writeframes(bytes(max(0, min(255, int(128 + s * 110))) for s in samples))
    return p
def tone(f0, f1, dur, sq=True, decay=3.0):
    n = int(RATE * dur); ph = 0; out = []
    for i in range(n):
        f = f0 + (f1 - f0) * i / n; ph += f / RATE
        v = (1 if (ph % 1) < 0.5 else -1) if sq else math.sin(ph * 2 * math.pi)
        out.append(v * math.exp(-decay * i / n) * 0.8)
    return out
def noise(dur, decay=5.0): return [random.uniform(-1, 1) * math.exp(-decay * i / (RATE * dur)) for i in range(int(RATE * dur))]
CLIPS = {'jump': tone(300, 900, 0.16), 'coin': tone(1320, 1320, 0.05, False, 0.5) + tone(1760, 1760, 0.18, False), 'stomp': [a * 0.7 + b * 0.5 for a, b in zip(noise(0.12), tone(220, 80, 0.12))],
         'hurt': tone(500, 120, 0.4), 'goal': tone(523, 523, 0.1, False, 0.3) + tone(659, 659, 0.1, False, 0.3) + tone(784, 784, 0.1, False, 0.3) + tone(1046, 1046, 0.4, False),
         'spring': tone(200, 1200, 0.25, False), '1up': tone(660, 660, 0.08) + tone(880, 880, 0.08) + tone(1320, 1320, 0.2)}
for k, v in CLIPS.items(): lib['sfx'].append({'id': k, 'name': k.title(), 'wav': wav(k, v)})

json.dump(lib, open(f'{OUT}/library.json', 'w'), indent=1)
print('library:', {k: len(v) for k, v in lib.items()})

#!/usr/bin/env python3
"""Top-down world tiles (32 tiles, 16x16) for the open world builder, drawn in each art style.
Order and collision are shared by every style so maps can switch style freely."""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw

LIB = sys.argv[1]
TILES = [('Empty', 0), ('Grass', 0), ('Tall grass', 0), ('Dirt path', 0), ('Road', 0), ('Road line', 0), ('Sidewalk', 0), ('Water', 1),
         ('Sand', 0), ('Tree', 1), ('Bush', 1), ('Flowers', 0), ('Rock', 1), ('Fence', 1), ('Brick wall', 1), ('Red roof', 1),
         ('Blue roof', 1), ('Door', 0), ('Window wall', 1), ('Wood floor', 0), ('Tile floor', 0), ('Carpet', 0), ('Counter', 1), ('Shelf', 1),
         ('Bed', 1), ('Stairs', 0), ('Lamp post', 1), ('Sign post', 1), ('Crate', 1), ('Lava (hurts)', 3), ('Cliff', 1), ('Bridge', 0)]

def noise(seed, amt):
    r = np.random.RandomState(seed); n = r.rand(16, 16); n = (n + np.roll(n, 1, 0) + np.roll(n, 1, 1)) / 3
    return 1 + (n - 0.5) * amt

def tile(style, k):
    flat = style == 'blocky'; real = style == 'realistic'; cute = style == 'cute'
    amt = 0.0 if flat else 0.18 if cute else 0.45
    soft = (lambda c: tuple(int(v * 0.75 + 255 * 0.25) for v in c)) if cute else (lambda c: c)
    base = np.zeros((16, 16, 4), np.uint8)
    def fill(c, seed=k):
        c = soft(c); n = noise(seed, amt)
        for i in range(3): base[:, :, i] = np.clip(c[i] * n, 0, 255)
        base[:, :, 3] = 255
    im = None
    S = 8; P = Image.new('RGBA', (16 * S, 16 * S), (0, 0, 0, 0)); d = ImageDraw.Draw(P)
    R = lambda x0, y0, x1, y1, c: d.rectangle([x0 * S, y0 * S, x1 * S - 1, y1 * S - 1], fill=soft(c) + (255,))
    E = lambda x0, y0, x1, y1, c: d.ellipse([x0 * S, y0 * S, x1 * S - 1, y1 * S - 1], fill=soft(c) + (255,))
    over = lambda: np.array(P.resize((16, 16), Image.LANCZOS))
    def comp():
        o = over(); a = o[:, :, 3:4] / 255.0; out = base.copy(); out[:, :, :3] = (base[:, :, :3] * (1 - a) + o[:, :, :3] * a).astype(np.uint8); out[:, :, 3] = np.maximum(base[:, :, 3], o[:, :, 3]); return out
    G = (86, 160, 64)
    if k == 0: return base
    if k == 1: fill(G); return base
    if k == 2:
        fill(G)
        for x in range(0, 16, 3): d.line([(x * S + 4, 15 * S), (x * S + 10, 6 * S)], fill=soft((50, 120, 40)) + (255,), width=S)
        return comp()
    if k == 3: fill((170, 130, 84)); return base
    if k == 4: fill((70, 70, 76)); return base
    if k == 5: fill((70, 70, 76)); R(0, 7, 6, 9, (240, 220, 80)); R(10, 7, 16, 9, (240, 220, 80)); return comp()
    if k == 6:
        fill((186, 182, 174))
        for v in (0, 8): base[v, :, :3] = soft((140, 136, 130)); base[:, v, :3] = soft((140, 136, 130))
        return base
    if k == 7:
        fill((40, 110, 200))
        if not flat:
            for y in range(16):
                for x in range(16):
                    if (x + y * 2) % 7 == 0: base[y, x, :3] = soft((120, 180, 240))
        return base
    if k == 8: fill((222, 200, 140)); return base
    if k == 9:
        fill(G); E(1, 1, 15, 12, (40, 110, 40)); E(3, 2, 10, 8, (70, 150, 60)); R(7, 11, 9, 16, (100, 70, 40)); return comp()
    if k == 10: fill(G); E(1, 3, 15, 15, (50, 130, 50)); E(3, 4, 9, 9, (90, 170, 80)); return comp()
    if k == 11:
        fill(G)
        for (x, y, c) in ((4, 4, (240, 90, 120)), (11, 6, (250, 220, 70)), (6, 11, (150, 120, 240)), (12, 12, (250, 250, 250))): E(x - 2, y - 2, x + 2, y + 2, c); E(x - 0.7, y - 0.7, x + 0.7, y + 0.7, (250, 230, 120))
        return comp()
    if k == 12: fill(G); E(1, 3, 15, 15, (120, 120, 126)); E(3, 4, 9, 9, (170, 170, 176)); return comp()
    if k == 13: fill(G); R(0, 6, 16, 8, (150, 110, 70)); R(0, 11, 16, 13, (150, 110, 70)); R(2, 3, 4, 15, (170, 130, 80)); R(12, 3, 14, 15, (170, 130, 80)); return comp()
    if k == 14:
        fill((170, 80, 60))
        for y in (0, 4, 8, 12): base[y, :, :3] = soft((110, 60, 50))
        for r, y in enumerate((0, 4, 8, 12)):
            for x in ((3, 11) if r % 2 == 0 else (7, 15)): base[y:y + 4, x, :3] = soft((110, 60, 50))
        return base
    if k in (15, 16):
        c = (190, 60, 50) if k == 15 else (60, 90, 170); fill(c)
        for y in range(0, 16, 4): base[y, :, :3] = soft(tuple(int(v * 0.6) for v in c))
        return base
    if k == 17: fill((170, 80, 60)); R(3, 2, 13, 16, (110, 70, 40)); R(4, 3, 12, 16, (140, 90, 50)); E(10, 9, 11.5, 10.5, (230, 200, 80)); return comp()
    if k == 18: fill((230, 220, 200)); R(3, 3, 13, 12, (60, 60, 70)); R(4, 4, 12, 11, (150, 200, 240)); R(7.5, 4, 8.5, 11, (60, 60, 70)); return comp()
    if k == 19:
        fill((170, 120, 70))
        for y in (0, 5, 10, 15): base[y, :, :3] = soft((120, 80, 45))
        return base
    if k == 20:
        fill((226, 226, 220))
        for v in (0, 8): base[v, :, :3] = soft((180, 180, 176)); base[:, v, :3] = soft((180, 180, 176))
        return base
    if k == 21: fill((170, 50, 70)); R(2, 2, 14, 14, (200, 80, 100)); R(4, 4, 12, 12, (170, 50, 70)); return comp()
    if k == 22: fill((200, 190, 170)); R(0, 2, 16, 14, (130, 90, 60)); R(0, 2, 16, 5, (170, 120, 80)); return comp()
    if k == 23:
        fill((120, 80, 50))
        for y, c in ((2, (220, 60, 60)), (7, (60, 140, 220)), (12, (240, 200, 60))): R(1, y, 15, y + 3, c)
        return comp()
    if k == 24: fill((200, 190, 170)); R(1, 1, 15, 15, (240, 240, 245)); R(1, 1, 15, 5, (250, 250, 255)); R(1, 7, 15, 15, (90, 130, 200)); return comp()
    if k == 25:
        fill((150, 140, 130))
        for y in range(0, 16, 4): base[y:y + 1, :, :3] = soft((90, 84, 78))
        return base
    if k == 26: fill(G); R(7, 4, 9, 16, (60, 60, 70)); E(4, 0, 12, 6, (250, 230, 140)); return comp()
    if k == 27: fill(G); R(7, 8, 9, 16, (110, 80, 50)); R(2, 2, 14, 9, (170, 130, 80)); R(4, 4, 12, 5, (90, 60, 40)); R(4, 6, 10, 7, (90, 60, 40)); return comp()
    if k == 28: fill((200, 190, 170)); R(1, 1, 15, 15, (150, 110, 60)); d.line([(S, S), (15 * S, 15 * S)], fill=soft((110, 80, 40)) + (255,), width=S); d.line([(15 * S, S), (S, 15 * S)], fill=soft((110, 80, 40)) + (255,), width=S); return comp()
    if k == 29:
        fill((220, 70, 20))
        for y in range(16):
            for x in range(16):
                if math.sin(x * 0.9 + y * 0.6) > 0.7: base[y, x, :3] = soft((255, 200, 60))
        return base
    if k == 30:
        fill((130, 110, 90))
        for y in range(16): base[y, :, :3] = np.clip(base[y, :, :3] * (1.2 - y / 22), 0, 255)
        base[0:2, :, :3] = soft(G)
        return base
    if k == 31:
        fill((40, 110, 200)); R(0, 2, 16, 14, (160, 110, 60))
        for x in range(0, 16, 4): R(x, 2, x + 0.6, 14, (110, 70, 40))
        return comp()
    return base

lib = json.load(open(f'{LIB}/library.json'))
lib['worldsets'] = []
for style in ('classic', 'blocky', 'cute', 'realistic'):
    os.makedirs(f'{LIB}/styles/{style}', exist_ok=True)
    sheet = Image.new('RGBA', (16 * len(TILES), 16), (0, 0, 0, 0))
    for k in range(len(TILES)): sheet.paste(Image.fromarray(tile(style, k).astype(np.uint8)), (k * 16, 0))
    sheet.save(f'{LIB}/styles/{style}/town.png')
    lib['worldsets'].append({'id': f'{style}_town', 'name': {'classic': 'Town', 'blocky': 'Block Town', 'cute': 'Pastel Town', 'realistic': 'Real Town'}[style], 'png': f'styles/{style}/town.png', 'tiles': [{'name': n, 'col': c} for n, c in TILES], 'style': style, 'view': 'topdown'})
json.dump(lib, open(f'{LIB}/library.json', 'w'), indent=1)
print('world tilesets:', [w['id'] for w in lib['worldsets']])

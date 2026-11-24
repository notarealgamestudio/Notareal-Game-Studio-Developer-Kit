#!/usr/bin/env python3
"""Top-down walk sheets for the library heroes: 6 frames (down A/B, up A/B, side A/B; left = mirrored side).
Drawn at 8x and reduced, using each character's colours; same size as the hero's side-view sheet."""
import json, sys, importlib.util
from PIL import Image
LIB = sys.argv[1]
spec = importlib.util.spec_from_file_location('sp', 'tools/make_style_packs.py')
src = open('tools/make_style_packs.py').read().split('# ------------------------------------------------------------------ write')[0]
G = {}; sys.argv = ['x', LIB]; exec(src, G)
CAST, Paint, add_outline, sh = G['CAST'], G['Paint'], G['add_outline'], G['sh']
def frame(c, W, H, view, step):
    S = 8; p = Paint(W, H, S); k = H / 32
    cx = W / 2; skin, shirt, pants, hair = c['skin'], c['shirt'], c['pants'], c['hair']
    leg = 1.6 * k if step else -1.6 * k
    # legs
    for side, off in ((-1, leg), (1, -leg)):
        if view == 'side': p.cap((cx + off * 0.8, 21 * k), (cx + off * 1.6, 29 * k), 1.6 * k, pants if side < 0 else sh(pants, 0.8))
        else: p.cap((cx + side * 2.2 * k, 21 * k), (cx + side * 2.2 * k, 29 * k + (off if view == 'down' else -off) * 0.3), 1.6 * k, pants)
    for side in (-1, 1):
        fx = cx + (side * 2.2 * k if view != 'side' else leg * side); p.ell(fx - 2 * k, 28.5 * k, fx + 2 * k, 31 * k, c['shoes'])
    # torso + arms
    p.ell(cx - 5 * k, 12 * k, cx + 5 * k, 23 * k, shirt)
    if c.get('apron') and view == 'down': p.ell(cx - 3.5 * k, 14 * k, cx + 3.5 * k, 23 * k, c['apron'])
    for side in ((-1, 1) if view != 'side' else (1,)):
        sw = (leg if side > 0 else -leg) * 0.6
        p.cap((cx + side * 5 * k, 14 * k), (cx + side * 5.5 * k + (sw if view == 'side' else 0), 21 * k + (sw if view != 'side' else 0)), 1.3 * k, shirt)
        p.ell(cx + side * 5.5 * k - 1.4 * k, 20.5 * k, cx + side * 5.5 * k + 1.4 * k, 23 * k, skin)
    # head
    p.ell(cx - 5 * k, 1.5 * k, cx + 5 * k, 12.5 * k, skin)
    hs = c['hair_style']; hc = c.get('cap', hair) if hs == 'cap' else hair
    if view == 'up': p.ell(cx - 5.3 * k, 1 * k, cx + 5.3 * k, 12 * k, hc)
    elif view == 'down':
        p.ell(cx - 5.3 * k, 1 * k, cx + 5.3 * k, 6 * k, hc)
        if hs in ('wavy', 'mullet'): p.rect(cx - 5.4 * k, 4 * k, cx - 3.8 * k, 13 * k, hair); p.rect(cx + 3.8 * k, 4 * k, cx + 5.4 * k, 13 * k, hair)
        for ex in (-2, 2): p.ell(cx + ex * k - 0.9 * k, 6.8 * k, cx + ex * k + 0.9 * k, 8.8 * k, (40, 30, 30))
        if c.get('glasses'): p.rect(cx - 3.5 * k, 7.6 * k, cx + 3.5 * k, 8 * k, (30, 30, 30))
        p.ell(cx - 1 * k, 10 * k, cx + 1 * k, 10.8 * k, sh(skin, 0.6))
    else:
        p.ell(cx - 5.3 * k, 1 * k, cx + 4 * k, 6 * k, hc); p.ell(cx - 5.3 * k, 1 * k, cx - 1 * k, 11 * k, hc)
        p.ell(cx + 2 * k, 6.8 * k, cx + 3.6 * k, 8.8 * k, (40, 30, 30))
    if hs == 'bun' and view != 'down': p.ell(cx - 2 * k, -0.5 * k, cx + 2 * k, 3 * k, hair)
    return p.done(W, H, colors=16, outline='selective')
lib = json.load(open(f'{LIB}/library.json'))
heroes = [s for s in lib['sprites'] if s['role'] == 'hero']
made = 0
for s in heroes:
    cid = next((k for k in CAST if k in s['id']), None)
    if not cid: continue
    W, H = s['w'], s['h']
    fr = [frame(CAST[cid], W, H, v, st) for v in ('down', 'up', 'side') for st in (0, 1)]
    sheet = Image.new('RGBA', (W * 6, H), (0, 0, 0, 0))
    for i, f in enumerate(fr): sheet.paste(f, (i * W, 0))
    path = s['png'].replace('.png', '_td.png'); sheet.save(f'{LIB}/{path}'); s['topdown'] = path; made += 1
json.dump(lib, open(f'{LIB}/library.json', 'w'), indent=1)
print('top-down sheets', made)

#!/usr/bin/env python3
"""Kit DS test harness (DeSmuME, headless). Usage:
dsrun.py rom.nds outprefix frames --shots 100,200 --keys "300-305:START,400-900:RIGHT+B" --taps "f,x,y" """
import sys, argparse
from desmume.emulator import DeSmuME
from desmume.controls import Keys, keymask
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('rom'); ap.add_argument('out'); ap.add_argument('frames', type=int)
ap.add_argument('--shots', default=''); ap.add_argument('--keys', default=''); ap.add_argument('--taps', default='')
a = ap.parse_args()
NAMES = {'A': Keys.KEY_A, 'B': Keys.KEY_B, 'X': Keys.KEY_X, 'Y': Keys.KEY_Y, 'L': Keys.KEY_L, 'R': Keys.KEY_R, 'START': Keys.KEY_START,
         'SELECT': Keys.KEY_SELECT, 'UP': Keys.KEY_UP, 'DOWN': Keys.KEY_DOWN, 'LEFT': Keys.KEY_LEFT, 'RIGHT': Keys.KEY_RIGHT}
script = []
for tok in filter(None, a.keys.split(',')):
    rng, btns = tok.split(':'); f0, f1 = map(int, rng.split('-')); script.append((f0, f1, [NAMES[b] for b in btns.split('+')]))
taps = {}   # f,x,y[,len]: pen held for len frames (default 1)
for t in filter(None, a.taps.split(';')):
    v = list(map(int, t.split(','))); n = v[3] if len(v) > 3 else 1
    for k in range(n): taps[v[0] + k] = (v[1], v[2])
shots = set(int(s) for s in filter(None, a.shots.split(',')))
emu = DeSmuME(); emu.open(a.rom); emu.volume_set(0)
held = set()
for f in range(a.frames):
    want = set()
    for f0, f1, ks in script:
        if f0 <= f <= f1: want.update(ks)
    for k in held - want: emu.input.keypad_rm_key(keymask(k))
    for k in want - held: emu.input.keypad_add_key(keymask(k))
    held = want
    if f in taps: emu.input.touch_set_pos(*taps[f])
    elif f - 1 in taps: emu.input.touch_release()
    emu.cycle(with_joystick=False)
    if f in shots: emu.screenshot().convert('RGB').save(f'{a.out}_{f:05d}.png')
emu.screenshot().convert('RGB').save(f'{a.out}_last.png')

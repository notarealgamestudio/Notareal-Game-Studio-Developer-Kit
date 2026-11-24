#!/usr/bin/env python3
"""Aggregate motionscan outputs into the compact Notareal motion library (measurements only)."""
import json, re, sys, statistics as st
CATS = [('fall', r'down|fall|bump|knockd|ko|flatten|sprawl|tumble|lie|dead|stunned|land'), ('getup', r'getup|rise|raise|stand|kickout|recover|rollout'),
 ('pin', r'pin|cover'), ('whip', r'whip|irish'), ('rope', r'rebound|rope'), ('run', r'run|sprint|dash|walk|jog'),
 ('climb', r'climb|turnbuckle'), ('aerial', r'swanton|moon|legdrop|splash|flyline|dive|elbowdrop|senton|diving|hurricanrana'),
 ('throw', r'suplex|slam|throw|piledriv|powerbomb|bomb|ddt|bulldog|neckbrk|drop|toss|tombstone|backbreak|facebust'),
 ('grapple', r'lock|grap|choke|hold|hammer|snapmare|takedown|wrench|submis|stretch|headlock|armbar'),
 ('kick', r'kick|stomp|stmp|knee|dropkick'), ('strike', r'punch|elbow|jab|strike|chop|slap|hook|uppercut|swing|clothesline|lowblow|eyerake|forearm|smash'),
 ('taunt', r'taunt|win|celebr|pose|entrance|point'), ('dodge', r'dodge|evade|duck|slip|escape|block|counter|reversal'), ('idle', r'idle|breath|stance|wait')]
def cat(n):
    l = n.lower()
    for c, rx in CATS:
        if re.search(rx, l): return c
    return None
clips = []
for f in sys.argv[2:]: clips += json.load(open(f))['clips']
by = {}
for c in clips:
    if c['active'] < 8 or not (8 <= c['frames'] <= 400) or c['mean_total_deg_per_frame'] <= 0: continue
    k = cat(c['name'])
    if k: by.setdefault(k, []).append(c)
def med(v): return round(st.median(v), 2) if v else 0
lib = {}
for k, v in by.items():
    prof = [round(st.mean(c['profile'][i] for c in v), 3) for i in range(8)]
    # limb sequencing: joints bucketed by hierarchy depth (index quartile of the active joints) -> mean peak time and peak speed
    q = [[], [], [], []]; qs = [[], [], [], []]
    for c in v:
        jt = c['jt']
        if len(jt) < 4: continue
        for i, (idx, t, sp) in enumerate(jt):
            b = min(3, i * 4 // len(jt)); q[b].append(t); qs[b].append(sp)
    lib[k] = {'n': len(v), 'frames': med([c['frames'] for c in v]), 'framesLo': round(st.quantiles([c['frames'] for c in v], n=10)[0]) if len(v) > 9 else 0,
              'framesHi': round(st.quantiles([c['frames'] for c in v], n=10)[8]) if len(v) > 9 else 0,
              'peak': med([c['peak_deg_per_frame'] for c in v]), 'mean': med([c['mean_total_deg_per_frame'] for c in v]),
              'peakAt': med([c['peak_at'] for c in v]), 'profile': prof,
              'dy': med([c['root_dy'] for c in v]), 'drop': med([c['root_peak_vdrop'] for c in v]), 'rise': med([c['root_peak_vrise'] for c in v]),
              'yRange': med([c['root_y_max'] - c['root_y_min'] for c in v]),
              'chainT': [round(st.mean(x), 2) if x else 0 for x in q], 'chainSpd': [round(st.mean(x), 1) if x else 0 for x in qs]}
json.dump({'v': 1, 'note': 'measurements only: medians/means of timing, angular speed and ease per move class', 'clips': len(clips), 'lib': lib}, open(sys.argv[1], 'w'), separators=(',', ':'))
for k, v in sorted(lib.items()): print(k, v['n'], 'fr', v['frames'], 'peak', v['peak'], 'at', v['peakAt'], 'chainT', v['chainT'], 'drop', v['drop'], 'yR', v['yRange'])

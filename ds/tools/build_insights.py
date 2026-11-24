#!/usr/bin/env python3
"""Merge a research database export into library/code_db.json and rebuild presets/measured.json (per-genre measurements) + genres.json learns_from."""
import json,sys,statistics as st,re
src=sys.argv[1] if len(sys.argv)>1 else None
K='/home/claude/notareal-kit/ds'
db=json.load(open(f'{K}/library/code_db.json'))
if src:
    new=json.load(open(src)); key=lambda x:(x['name'],x['platform'])
    keep=[x for x in db if key(x) not in {key(n) for n in new} and x['id'] not in {n['id'] for n in new}]
    print('replaced',len(db)-len(keep),'added',len(new)); db=keep+new
    json.dump(db,open(f'{K}/library/code_db.json','w'))
MAP=[('3d rpg','rpg_linear'),('party rpg','jrpg'),('coloring','coloring_book'),('survival_rpg','survival_rpg'),('friendship','crafting_sim'),('3d open adventure','adventure_explore'),('2d open world','open_world_2d'),('combat ops','military_shooter'),('minigame','minigames'),('farm','farm_sim'),('kart','kart_racing'),('racing','racing'),('2.5d','sidescroller_3d'),('puzzle / memory','memory_puzzle'),('ball-and-paddle','breakout'),('skate','trick_sports'),('music maker','music_maker'),('3d open world','open_world_3d'),('falling','puzzle_falling'),('wrestling','wrestling'),('fighting','fighting'),('god sim','god_sim'),('3d platformer','platformer_3d'),('action adventure','action_adventure'),('basketball','basketball'),('monster','monster_rpg'),('auto-runner','runner'),('platformer','platformer'),('shmup','shmup'),('shooter','shooter_fps')]
def gid(g):
    g=(g or '').lower()
    for k,v in MAP:
        if k in g: return v
by={}
for x in db:
    g=gid(x.get('genre'))
    if g: by.setdefault(g,[]).append(x)
out={}
for g,xs in by.items():
    fn=[(x.get('code') or {}).get('functions') or 0 for x in xs]; fn=[f for f in fn if f>50] or [0]
    hw={}; 
    for x in xs:
        for k,v in ((x.get('code') or {}).get('byHardware') or {}).items(): kk=k.split(' ')[0].lower(); hw[kk]=hw.get(kk,0)+v
    tot=sum(hw.values()) or 1
    mb=sorted(round(x['size']/1048576,1) for x in xs)
    own=[x['name'] for x in xs if x['platform']=='Super Nintendo' or 'HOMEBREW' in x['name']]
    out[g]={'games':len(xs),'platforms':sorted({x['platform'] for x in xs}),'medianMB':st.median(mb),'medianRoutines':int(st.median(fn)),'hardwareShare':{k:round(v*100/tot) for k,v in sorted(hw.items(),key=lambda kv:-kv[1])[:4]},'examples':[x['name'] for x in xs][:5]}
json.dump({'version':1,'note':'Measurements only, from the games you scanned. No game content.','genres':out,'games':len(db)},open(f'{K}/presets/measured.json','w'),indent=1)
gj=json.load(open(f'{K}/presets/genres.json'))
for t in gj['types']:
    xs=by.get(t['id'],[]); names=[re.sub(r'\.(nds|gba|gb|gbc|sfc|smc|z64|n64|v64)$','',x['file'],flags=re.I) for x in xs if not x['name'].startswith('HOMEBREW')]
    if names: t['learns_from']=sorted(set((t.get('learns_from') or [])+names))
json.dump(gj,open(f'{K}/presets/genres.json','w'),indent=1)
print('games',len(db),'genres measured',len(out),'of',len(gj['types']))

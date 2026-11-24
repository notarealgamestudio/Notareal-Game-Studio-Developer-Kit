#!/usr/bin/env python3
"""Notareal motion scanner: reads NSBCA (BCA0) joint animations from a DS ROM you own and keeps ONLY
measurements (timing, angular speed, ease profile, root travel/drop). No animation data is copied.
usage: motionscan.py rom.nds out.json"""
import sys, struct, json, math, re
S = struct.Struct
def bits(x, a, b): return (x >> a) & ((1 << (b - a)) - 1)
def fix16(x, s, i, f):
    w = s + i + f
    x &= (1 << w) - 1
    if s and x & (1 << (w - 1)): x -= 1 << w
    return x / (1 << f)
def fix32(x):
    if x & 0x80000000: x -= 1 << 32
    return x / 4096.0
def pivot(sel, neg, a, b):
    if sel >= 9: return None
    o = 1.0 if bits(neg, 0, 1) == 0 else -1.0
    c = b if bits(neg, 1, 2) == 0 else -b
    d = a if bits(neg, 2, 3) == 0 else -a
    t = {0: (o,0,0,0,a,b,0,c,d), 1: (0,o,0,a,0,b,c,0,d), 2: (0,0,o,a,b,0,c,d,0), 3: (0,a,b,o,0,0,0,c,d),
         4: (a,0,b,0,o,0,c,0,d), 5: (a,b,0,0,0,o,c,d,0), 6: (0,a,b,0,c,d,o,0,0), 7: (a,0,b,c,0,d,0,o,0), 8: (a,b,0,c,d,0,0,0,o)}[sel]
    return t
def basis(d):
    i0, i1, i2, i3, i4 = d
    inp = [i4, i0, i1, i2, i3]; out = [0]*6
    for i in range(5):
        out[i] = bits(inp[i], 3, 16); out[5] = ((out[5] << 3) | bits(inp[i], 0, 3)) & 0xFFFF
    f = lambda x: fix16(x, 1, 0, 12)
    a = (f(out[1]), f(out[2]), f(out[3])); b = (f(out[4]), f(out[0]), f(out[5]))
    c = (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
    return (a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2])
def sample(curve, fr, default):
    if curve is None: return default
    k = curve[0]
    if k == 'c': return curve[1]
    _, s, e, vals = curve
    if not vals: return default
    if fr <= s: return vals[0]
    if fr >= e - 1: return vals[-1]
    idx = (fr - s) / (e - 1 - s) * (len(vals) - 1)
    lo = int(idx); hi = min(lo + 1, len(vals) - 1); g = idx - lo
    if isinstance(vals[0], tuple): return tuple(vals[lo][j]*(1-g)+vals[hi][j]*g for j in range(9))
    return vals[lo]*(1-g)+vals[hi]*g
def read_anim(d, base):
    stamp, nf, no, _u, pivo, basoo = S('<4sHHIII').unpack_from(d, base)
    if stamp != b'J\0AC' or nf == 0 or nf > 2000 or no > 200: return None
    offs = S('<%dH' % no).unpack_from(d, base + 20)
    objs = []
    for co in offs:
        p = base + co
        flags, _dm, idx = S('<HBB').unpack_from(d, p); p += 4
        trans = [None]*3; rot = None
        if bits(flags, 0, 1) != 0: objs.append((trans, rot)); continue
        def info(x):
            s = bits(x, 0, 16); e = bits(x, 16, 28); dw = bits(x, 28, 30); r = bits(x, 30, 32)
            if s >= e: raise ValueError
            return s, e, dw, max(1, (e - s) >> r)
        if bits(flags, 1, 3) == 0:
            for i in range(3):
                if bits(flags, 3+i, 4+i):
                    trans[i] = ('c', fix32(S('<I').unpack_from(d, p)[0])); p += 4
                else:
                    s, e, dw, n = info(S('<I').unpack_from(d, p)[0]); off = S('<I').unpack_from(d, p+4)[0]; p += 8
                    if n > 4000: raise ValueError
                    vals = [fix32(x) for x in S('<%dI' % n).unpack_from(d, base+off)] if dw == 0 else [fix16(x, 1, 3, 12) for x in S('<%dH' % n).unpack_from(d, base+off)]
                    trans[i] = ('s', s, e, vals)
        def fetch(x):
            if bits(x, 15, 16) == 1:
                sn, a, b = S('<HHH').unpack_from(d, base + pivo + (x & 0x7FFF)*6)
                return pivot(bits(sn, 0, 4), bits(sn, 4, 8), fix16(a, 1, 3, 12), fix16(b, 1, 3, 12))
            return basis(S('<5H').unpack_from(d, base + basoo + (x & 0x7FFF)*10))
        if bits(flags, 6, 8) == 0:
            if bits(flags, 8, 9):
                v = S('<H').unpack_from(d, p)[0]; p += 4; m = fetch(v)
                rot = ('c', m) if m else None
            else:
                s, e, dw, n = info(S('<I').unpack_from(d, p)[0]); off = S('<I').unpack_from(d, p+4)[0]; p += 8
                if n > 4000: raise ValueError
                vs = [fetch(v) for v in S('<%dH' % n).unpack_from(d, base+off)]
                if None in vs: rot = None
                else: rot = ('s', s, e, vs)
        if bits(flags, 9, 11) == 0:
            for i in range(3):
                p += 8
        objs.append((trans, rot))
    return nf, objs
def ang_between(a, b):
    # angle of a^T b
    tr = sum(a[i*3+r]*b[i*3+r] for i in range(3) for r in range(3)) if False else sum(a[r*3+c]*b[r*3+c] for r in range(3) for c in range(3))
    return math.acos(max(-1, min(1, (tr - 1) / 2)))
def analyse(nf, objs):
    n = nf
    rots = []; ys = []; xs = []; zs = []
    ang = [0.0]*max(1, n-1); per_joint_peak = []; jt = []
    for ob in objs:
        t, r = ob
        if r is None or r[0] == 'c': per_joint_peak.append(0.0); continue
        m = [sample(r, f, (1,0,0,0,1,0,0,0,1)) for f in range(n)]
        sp = [ang_between(m[i], m[i+1]) for i in range(n-1)]
        for i, v in enumerate(sp): ang[i] += v
        per_joint_peak.append(sorted(sp)[int(len(sp)*0.95)] if sp else 0.0)
        if sp and max(sp) > 0.02: jt.append((len(per_joint_peak)-1, round(max(range(len(sp)), key=lambda i: sp[i])/max(1, len(sp)), 2), round(math.degrees(max(sp)), 1)))
    # root = the joint that travels the most (hips/root); its path gives drops, lifts and ground travel
    best = None; bt = 0
    for ob in objs:
        t = ob[0]
        yy = [sample(t[1], f, 0.0) for f in range(n)] if t[1] else None
        rng = (max(yy) - min(yy)) if yy else 0
        tot_t = sum(((max(sample(t[i], f, 0.0) for f in range(n)) - min(sample(t[i], f, 0.0) for f in range(n))) if t[i] else 0) for i in range(3))
        if tot_t > bt: bt = tot_t; best = t
    root = best or [None]*3
    ry = [sample(root[1], f, 0.0) for f in range(n)]
    rx = [sample(root[0], f, 0.0) for f in range(n)]; rz = [sample(root[2], f, 0.0) for f in range(n)]
    active = sum(1 for v in per_joint_peak if v > 0.01)
    tot = sum(ang) or 1e-9
    bins = 8; prof = []
    for b in range(bins):
        lo = int(b*len(ang)/bins); hi = max(lo+1, int((b+1)*len(ang)/bins)); prof.append(round(sum(ang[lo:hi])/tot, 3))
    pk = max(range(len(ang)), key=lambda i: ang[i]) if ang else 0
    dy = [ry[i+1]-ry[i] for i in range(n-1)] or [0]
    return {'frames': n, 'joints': len(objs), 'active': active,
            'peak_deg_per_frame': round(math.degrees(max(per_joint_peak or [0])), 2),
            'mean_total_deg_per_frame': round(math.degrees(tot/max(1, len(ang))), 2),
            'peak_at': round(pk/max(1, len(ang)), 2), 'profile': prof,
            'root_dx': round(rx[-1]-rx[0], 2), 'root_dy': round(ry[-1]-ry[0], 2), 'root_dz': round(rz[-1]-rz[0], 2),
            'root_y_min': round(min(ry), 2), 'root_y_max': round(max(ry), 2),
            'jt': jt, 'root_peak_vdrop': round(min(dy), 3), 'root_peak_vrise': round(max(dy), 3)}
def scan(path):
    d = open(path, 'rb').read(); out = []; bad = 0
    for m in re.finditer(b'BCA0', d):
        o = m.start()
        try:
            bom, ver, size, hs, nb = S('<HHIHH').unpack_from(d, o+4)
            if bom != 0xFEFF or size > 4_000_000 or nb < 1: continue
            jo = o + S('<I').unpack_from(d, o+16)[0]
            if d[jo:jo+4] != b'JNT0': continue
            _, n = S('<BB').unpack_from(d, jo+8)
            p = jo + 8 + 4 + 8 + n*4 + 4
            offs = S('<%dI' % n).unpack_from(d, p); p += n*4
            names = [d[p+i*16:p+i*16+16].split(b'\0')[0].decode('latin1') for i in range(n)]
            for nm, ao in zip(names, offs):
                try:
                    r = read_anim(d, jo + ao)
                    if r: a = analyse(*r); a['name'] = nm; out.append(a)
                except Exception: bad += 1
        except Exception: bad += 1
    return out, bad
if __name__ == '__main__':
    res, bad = scan(sys.argv[1])
    json.dump({'source': re.sub(r'[^A-Za-z0-9 _-]', '', sys.argv[1].split('/')[-1])[:40], 'clips': res}, open(sys.argv[2], 'w'))
    print(len(res), 'clips', bad, 'skipped')

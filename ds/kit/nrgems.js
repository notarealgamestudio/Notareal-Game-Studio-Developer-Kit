/* nrgems.js (v1.20) - cute and impressive 3D jewels, beads and charms for the jewelry engine (Friendship Bracelets), drawn with the offline software 3D renderer (nr3d.js).
 *   - gem cuts built facet by facet (round brilliant, oval, pear, heart, marquise, emerald, cushion) with sparkle that twinkles as the piece turns, plus 4-point glints
 *   - cabochons (opal / moonstone / labradorite with a colour sheen), polished and nugget stones, faceted + bicone crystal, glass, sea glass, wood, ceramic, pony and vintage beads
 *   - pearls with a pink / blue pearly sheen, mirror-like gold / silver / platinum metal beads
 *   - 3D puffy enamel charms with a metal rim and a shine spot: heart, star, flower, moon, sun, butterfly, key, feather, anchor, cloud, bolt, smiley, crown, gear, skull, shell, compass, dice, rose, infinity, leaf, stud
 *   - letter cubes with the letter drawn on the front
 * G.partOf(comp) -> part description;  G.draw(R, comp, x, y, z, size, yaw, t, opts) draws into a nr3d renderer;  G.flush(g, R, t) draws glints and letters on the 2D canvas after R.end(g);
 * G.sprite(comp, px) -> small canvas picture of the piece (palette, strand, shop); G.stats() for tests. Meshes are built once and cached. */
(function (root) {
    'use strict';
    const G = {}, TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v, mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const faceN = (a, b, c) => nrm(cross(sub(b, a), sub(c, a)));

    /* ---------------------------------------------------------- 2D outlines (unit size, y up) */
    const circle = (n, r, cx, cy) => Array.from({ length: n }, (_, i) => [(cx || 0) + Math.cos(i / n * TAU) * r, (cy || 0) + Math.sin(i / n * TAU) * r]);
    const star = (k, ro, ri, rot) => { const o = []; for (let i = 0; i < k * 2; i++) { const a = (rot == null ? Math.PI / 2 : rot) + i / (k * 2) * TAU, r = i % 2 ? ri : ro; o.push([Math.cos(a) * r, Math.sin(a) * r]); } return o; };
    const heart = n => Array.from({ length: n }, (_, i) => { const t = i / n * TAU; return [.062 * 16 * Math.pow(Math.sin(t), 3) * 1.05, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16 * .98 + .08]; });
    const flower = (p, n, a, b) => Array.from({ length: n }, (_, i) => { const t = i / n * TAU, r = a + b * Math.pow(Math.cos(p * t / 2), 2); return [Math.cos(t) * r, Math.sin(t) * r]; });
    const mirror = h => h.concat(h.slice().reverse().map(p => [-p[0], p[1]]));
    const lens = (w, n) => { const r = [], l = []; for (let i = 0; i <= n; i++) { const t = i / n, x = w * Math.pow(Math.sin(Math.PI * t), .85), y = -.95 + 1.9 * t; r.push([x, y]); l.push([-x, y]); } return r.concat(l.reverse().slice(1, -1)); };
    const moon = () => { const o = []; for (let i = 0; i <= 18; i++) { const a = (51 + (309 - 51) * i / 18) * Math.PI / 180; o.push([Math.cos(a), Math.sin(a)]); } for (let i = 0; i <= 14; i++) { const a = (282.6 - (282.6 - 77.4 + 360 * 0) * 0 - (282.6 - 77.4) * i / 14) * Math.PI / 180; o.push([.45 + Math.cos(a) * .8, Math.sin(a) * .8]); } return o; };
    const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const arcBand = (cx, cy, r0, r1, a0, a1, n) => { const o = [], p = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; o.push([cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]); p.push([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0]); } return o.concat(p.reverse()); };
    const gearO = () => { const o = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, w = TAU / 8; for (const [da, r] of [[0, .78], [.14, 1], [.36, 1], [.5, .78]]) o.push([Math.cos(a + da * w) * r, Math.sin(a + da * w) * r]); } return o; };
    const lemn = n => Array.from({ length: n }, (_, i) => { const t = i / n * TAU, d = 1 + Math.sin(t) * Math.sin(t); return [Math.cos(t) / d * 1.05, Math.sin(t) * Math.cos(t) / d * 1.05]; });
    const eyes = (y, dx, r) => [{ t: 'sphere', x: -dx, y, r, c: [40, 30, 50] }, { t: 'sphere', x: dx, y, r, c: [40, 30, 50] }];
    const CHARMS = {
        heart: { polys: [heart(40)], decor: [{ t: 'shine', x: -.35, y: .42 }] }, star: { polys: [star(5, 1, .46)], decor: [{ t: 'shine', x: -.15, y: .35 }] }, flower: { polys: [flower(5, 50, .5, .5)], decor: [{ t: 'sphere', x: 0, y: 0, r: .26, c: [255, 220, 90] }, { t: 'shine', x: -.4, y: .4 }] },
        moon: { polys: [moon()], decor: [{ t: 'shine', x: -.55, y: .35 }] }, sun: { polys: [star(12, 1, .72)], decor: [{ t: 'sphere', x: 0, y: 0, r: .42, c: [255, 220, 110] }, { t: 'shine', x: -.2, y: .25 }] },
        smile: { polys: [circle(32, 1)], decor: eyes(.25, .33, .11).concat([{ t: 'tube', pts: Array.from({ length: 9 }, (_, i) => { const a = (200 + i * 17.5) * Math.PI / 180; return [Math.cos(a) * .52, Math.sin(a) * .5 + .02]; }), r: .06, c: [40, 30, 50] }, { t: 'shine', x: -.5, y: .55 }]) },
        butterfly: { polys: [mirror([[.06, .12], [.3, .6], [.85, .9], [1, .45], [.72, .02], [.98, -.42], [.58, -.82], [.22, -.4], [.06, -.2]])], decor: [{ t: 'sphere', x: 0, y: 0, r: .1, c: [60, 40, 70] }, { t: 'sphere', x: -.45, y: .45, r: .17, c: [255, 255, 255] }, { t: 'sphere', x: .45, y: .45, r: .17, c: [255, 255, 255] }] },
        key: { polys: [circle(24, .36, 0, .58), rect(-.1, -.85, .2, 1.15), rect(.1, -.85, .24, .14), rect(.1, -.55, .24, .14)], decor: [{ t: 'sphere', x: 0, y: .58, r: .15, c: [60, 50, 70] }] },
        feather: { polys: [lens(.4, 22)], decor: [{ t: 'tube', pts: [[0, -.95], [0, -.3], [0, .3], [0, .85]], r: .03, c: [255, 255, 255] }] },
        leaf: { polys: [lens(.5, 22)], decor: [{ t: 'tube', pts: [[0, -.9], [0, 0], [0, .85]], r: .035, c: [120, 70, 40] }] },
        anchor: { polys: [circle(16, .2, 0, .72), rect(-.07, -.7, .14, 1.15), rect(-.34, .3, .68, .12), arcBand(0, -.1, .45, .62, 200, 340, 12)], decor: [] },
        cloud: { polys: [circle(20, .42, -.42, -.1), circle(20, .55, .05, .12), circle(20, .4, .5, -.1), rect(-.42, -.5, .92, .4)], decor: [{ t: 'shine', x: -.1, y: .45 }] },
        bolt: { polys: [[[.2, .98], [-.5, -.05], [-.08, -.05], [-.28, -.98], [.5, .12], [.06, .12]]], decor: [] },
        gear: { polys: [gearO()], decor: [{ t: 'sphere', x: 0, y: 0, r: .3, c: [70, 70, 84] }] },
        skull: { polys: [circle(28, .72, 0, .2), rect(-.36, -.78, .72, .6)], decor: eyes(.18, .3, .17).concat([{ t: 'sphere', x: 0, y: -.12, r: .07, c: [40, 30, 50] }]) },
        shell: { polys: [(() => { const o = [[0, -.9]]; for (let i = 0; i <= 28; i++) { const a = (15 + 150 * i / 28) * Math.PI / 180; o.push([Math.cos(a) * (1 + .07 * Math.cos(i * 1.6)), Math.sin(a) * (1 + .07 * Math.cos(i * 1.6)) - .3]); } return o; })()], decor: [{ t: 'shine', x: -.3, y: .35 }] },
        compass: { polys: [circle(32, 1)], decor: [{ t: 'sphere', x: 0, y: 0, r: .72, c: [245, 240, 220] }, { t: 'tube', pts: [[0, -.5], [0, .5]], r: .07, c: [220, 50, 60] }] },
        crown: { polys: [[[-.95, -.55], [-.95, .45], [-.5, 0], [0, .75], [.5, 0], [.95, .45], [.95, -.55]]], decor: [{ t: 'sphere', x: 0, y: .78, r: .12, c: [255, 90, 120] }, { t: 'sphere', x: -.95, y: .48, r: .1, c: [90, 200, 255] }, { t: 'sphere', x: .95, y: .48, r: .1, c: [90, 200, 255] }] },
        infinity: { polys: [], decor: [{ t: 'tube', pts: lemn(36).concat([lemn(36)[0]]), r: .12, c: null }] },
        dice: { cube: true, polys: [], decor: [] }, rose: { polys: [flower(6, 60, .62, .36)], decor: [{ t: 'sphere', x: 0, y: 0, r: .46, c: null, dark: .8 }, { t: 'sphere', x: .06, y: .04, r: .26, c: null, dark: .65 }, { t: 'shine', x: -.25, y: .3 }] },
        stud: { cone: true, polys: [], decor: [] }
    };
    G.CHARMS = Object.keys(CHARMS);

    /* ---------------------------------------------------------- mesh building (faces: {p:[a,b,c], n:[..]|null, id}) */
    const fanTris = (poly, z, up) => { const out = [], c = poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]); for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; out.push(up ? [[c[0], c[1], z], [a[0], a[1], z], [b[0], b[1], z]] : [[c[0], c[1], z], [b[0], b[1], z], [a[0], a[1], z]]); } return out; };
    const area = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
    const earclip = poly => { // simple polygon -> triangles of indices
        const idx = poly.map((_, i) => i), ccw = area(poly) > 0, tris = [], cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), inT = (p, a, b, c) => { const d1 = cr(a, b, p), d2 = cr(b, c, p), d3 = cr(c, a, p); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
        let guard = 0; while (idx.length > 3 && guard++ < 2000) { let cut = false; for (let i = 0; i < idx.length; i++) { const i0 = idx[(i + idx.length - 1) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length], a = poly[i0], b = poly[i1], c = poly[i2], k = cr(a, b, c); if (ccw ? k <= 1e-9 : k >= -1e-9) continue; let ok = true; for (const j of idx) if (j !== i0 && j !== i1 && j !== i2 && inT(poly[j], a, b, c)) { ok = false; break; } if (ok) { tris.push([i0, i1, i2]); idx.splice(i, 1); cut = true; break; } } if (!cut) break; }
        if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]); return tris;
    };
    // puffy extrusion: wall at +-t, rounded shoulder, domed front/back; smooth normals on the dome
    const puff = (poly, t, off) => {
        const F = [], c = poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]), shrink = (p, k) => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k], z0 = off || 0, n = poly.length;
        const inner = poly.map(p => shrink(p, .8)), tops = earclip(inner), ccw = area(poly) > 0;
        for (let side = 0; side < 2; side++) { const sg = side ? -1 : 1, zs = z0 + sg * t, zd = z0 + sg * t * 1.5;
            for (let i = 0; i < n; i++) { const j = (i + 1) % n, a = [poly[i][0], poly[i][1], z0 + sg * t * .35], b = [poly[j][0], poly[j][1], z0 + sg * t * .35], a2 = [inner[i][0], inner[i][1], zd], b2 = [inner[j][0], inner[j][1], zd], am = [poly[i][0], poly[i][1], zs * .8 + z0 * .2], bm = [poly[j][0], poly[j][1], zs * .8 + z0 * .2];
                const q = side ? [[a, b, bm], [a, bm, am], [am, bm, b2], [am, b2, a2]] : [[b, a, am], [b, am, bm], [bm, am, a2], [bm, a2, b2]]; q.forEach((f, k) => F.push({ p: f, n: null, part: k < 2 ? 'rim' : 'dome', id: i * 4 + k })); }
            for (const [a, b, c2] of tops) { const P = [[inner[a][0], inner[a][1], zd], [inner[b][0], inner[b][1], zd], [inner[c2][0], inner[c2][1], zd]]; F.push({ p: side ? [P[0], P[2], P[1]] : P, n: [[0, 0, sg], [0, 0, sg], [0, 0, sg]], part: 'dome', id: 99 }); } }
        return F;
    };
    const lathe = (prof, sides, smooth, tw) => { // prof: [r,y] from bottom to top; tw = twist per ring (faceted gems)
        const F = [], rings = prof.map((q, k) => Array.from({ length: sides }, (_, i) => { const a = (i + (tw ? (k % 2) * .5 : 0)) / sides * TAU; return [Math.cos(a) * q[0], q[1], Math.sin(a) * q[0]]; }));
        for (let k = 0; k < prof.length - 1; k++) for (let i = 0; i < sides; i++) { const j = (i + 1) % sides, a = rings[k][i], b = rings[k][j], c = rings[k + 1][j], d = rings[k + 1][i];
            const dr = prof[k + 1][0] - prof[k][0], dy = prof[k + 1][1] - prof[k][1], sn = (p) => { const l = Math.hypot(p[0], p[2]) || 1, ny = -dr, rr = dy; return nrm([p[0] / l * rr, ny, p[2] / l * rr]); };
            if (prof[k][0] > 1e-6 || true) { if (smooth) { F.push({ p: [a, c, b], n: [sn(a), sn(c), sn(b)], id: k * sides + i }); if (prof[k + 1][0] > 1e-6) F.push({ p: [a, d, c], n: [sn(a), sn(d), sn(c)], id: k * sides + i + 500 }); } else { F.push({ p: [a, c, b], n: null, id: (k * sides + i) * 2 }); if (prof[k + 1][0] > 1e-6) F.push({ p: [a, d, c], n: null, id: (k * sides + i) * 2 + 1 }); } } }
        return F;
    };
    const flipOut = F => { for (const f of F) { const c = [(f.p[0][0] + f.p[1][0] + f.p[2][0]) / 3, (f.p[0][1] + f.p[1][1] + f.p[2][1]) / 3, (f.p[0][2] + f.p[1][2] + f.p[2][2]) / 3], n = faceN(f.p[0], f.p[1], f.p[2]); if (dot(n, [c[0], c[1] * .3, c[2]]) < 0 && !f.keep) { f.p = [f.p[0], f.p[2], f.p[1]]; if (f.n) f.n = [f.n[0], f.n[2], f.n[1]]; } } return F; };
    // gem cut from an outline: girdle, crown (mid ring + table), pavilion to a point
    const cut = (outline, crown, table, pav, rot) => {
        const n = outline.length, F = [], P = (s, y, twist) => outline.map((p, i) => { const q = twist ? [(p[0] + outline[(i + 1) % n][0]) / 2, (p[1] + outline[(i + 1) % n][1]) / 2] : p; return [q[0] * s, y, q[1] * s]; });
        const g = P(1, 0), m = P((1 + table) / 2 + .06, crown * .55, true), t = P(table, crown), p1 = P(.62, -pav * .5, true), apex = [0, -pav, 0];
        for (let i = 0; i < n; i++) { const j = (i + 1) % n;
            F.push({ p: [g[i], m[i], g[j]], id: i * 8 }); F.push({ p: [g[j], m[i], m[j]], id: i * 8 + 1 }); // crown kite facets
            F.push({ p: [m[i], t[i], m[j]], id: i * 8 + 2 }); F.push({ p: [m[j], t[i], t[j]], id: i * 8 + 3 }); // star + upper girdle
            F.push({ p: [g[i], g[j], p1[i]], id: i * 8 + 4 }); F.push({ p: [g[j], p1[j], p1[i]], id: i * 8 + 5 }); // lower girdle
            F.push({ p: [p1[i], p1[j], apex], id: i * 8 + 6 }); }
        for (let i = 1; i < n - 1; i++) F.push({ p: [t[0], t[i], t[i + 1]], id: 9000 + i, table: true }); // flat table
        return flipOut(F.map(f => (f.keep = false, f)));
    };
    const cabochon = (sx, sy, sides, rings) => { const prof = [[0, 0], [1, 0], ...Array.from({ length: rings }, (_, i) => { const a = (i + 1) / rings * Math.PI / 2; return [Math.cos(a), Math.sin(a) * .62]; })]; const F = lathe(prof, sides, true); for (const f of F) { f.p = f.p.map(p => [p[0] * sx, p[1], p[2] * sy]); } return F; };
    const nugget = (seed, lat, lon) => { const h = hash(seed), F = [], g = [], rr = (i, j) => { const w = Math.sin(i / lat * Math.PI); return 1 + w * (.18 * Math.sin(i * 2.3 + (h % 7)) * Math.cos(j * 1.7 + (h % 5)) + .08 * Math.sin(j * 3.1 + h % 3)); }; for (let i = 0; i <= lat; i++) { const th = i / lat * Math.PI, row = []; for (let j = 0; j < lon; j++) { const ph = j / lon * TAU, r = rr(i, j), n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; row.push({ p: [n[0] * r * .92, n[1] * r * .8, n[2] * r * .92], n }); } g.push(row); } for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) { const j2 = (j + 1) % lon, a = g[i][j], b = g[i][j2], c = g[i + 1][j2], d = g[i + 1][j]; if (i > 0) F.push({ p: [a.p, c.p, b.p], n: [a.n, c.n, b.n], id: i * 99 + j }); if (i < lat - 1) F.push({ p: [a.p, d.p, c.p], n: [a.n, d.n, c.n], id: i * 99 + j + 50 }); } return F; };
    const ball = (lat, lon, sx, sy, sz) => { const F = []; const g = []; for (let i = 0; i <= lat; i++) { const th = i / lat * Math.PI, row = []; for (let j = 0; j < lon; j++) { const ph = j / lon * TAU, n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; row.push({ p: [n[0] * sx, n[1] * sy, n[2] * sz], n }); } g.push(row); } for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) { const j2 = (j + 1) % lon, a = g[i][j], b = g[i][j2], c = g[i + 1][j2], d = g[i + 1][j]; if (i > 0) F.push({ p: [a.p, c.p, b.p], n: [a.n, c.n, b.n], id: i * 200 + j }); if (i < lat - 1) F.push({ p: [a.p, d.p, c.p], n: [a.n, d.n, c.n], id: i * 200 + j + 100 }); } return F; };
    const cubeM = () => { const F = [], v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], fs = [[0, 1, 2, 3, [0, 0, -1]], [5, 4, 7, 6, [0, 0, 1]], [4, 0, 3, 7, [-1, 0, 0]], [1, 5, 6, 2, [1, 0, 0]], [3, 2, 6, 7, [0, 1, 0]], [4, 5, 1, 0, [0, -1, 0]]]; for (const f of fs) { const A = v[f[0]].map(x => x * .8), B = v[f[1]].map(x => x * .8), C = v[f[2]].map(x => x * .8), D = v[f[3]].map(x => x * .8); F.push({ p: [A, B, C], n: [f[4], f[4], f[4]], id: 1 }, { p: [A, C, D], n: [f[4], f[4], f[4]], id: 2 }); } return F; };

    /* ---------------------------------------------------------- parts: which mesh + material a bead / stone / charm component uses */
    const OUT = { round: () => circle(16, 1), oval: () => circle(18, 1).map(p => [p[0] * .74, p[1] * 1.05]), pear: () => Array.from({ length: 22 }, (_, i) => { const t = i / 22 * TAU; return [Math.cos(t) * (.62 - .26 * Math.sin(t)), Math.sin(t) * 1.05]; }), heart: () => heart(20).map(p => [p[0] * .95, p[1] * 1]), marquise: () => circle(20, 1).map(p => [p[0] * .5, p[1] * 1.1 * (1 - Math.abs(p[0]) * .4)]), emerald: () => [[-.5, 1], [.5, 1], [1, .6], [1, -.6], [.5, -1], [-.5, -1], [-1, -.6], [-1, .6]].map(p => [p[0] * .72, p[1] * .9]), cushion: () => circle(16, 1).map(p => [Math.sign(p[0]) * Math.pow(Math.abs(p[0]), .72) * .95, Math.sign(p[1]) * Math.pow(Math.abs(p[1]), .72) * .95]) };
    const GEMCUT = { amethyst: 'oval', rosequartz: 'heart', citrine: 'cushion', garnet: 'round', topaz: 'marquise', peridot: 'pear', fluorite: 'emerald', diamond: 'round', emerald: 'emerald', ruby: 'heart', sapphire: 'cushion' }, CAB = ['turquoise', 'opal', 'jade', 'lapis', 'moonstone', 'labradorite', 'malachite'], SHEEN = { opal: [[255, 170, 220], [150, 230, 255]], moonstone: [[210, 230, 255], [255, 255, 255]], labradorite: [[90, 200, 255], [190, 120, 255]] };
    G.partOf = c => {
        const id = c.id || '', rgb = c.rgb || [200, 200, 200]; let m;
        if (c.kind === 'letter') return { k: 'letter', mesh: 'cube', mat: 'glossy', rgb, letter: c.letter };
        if ((m = /^(?:charm|metal)_(.+)$/.exec(id))) { const key = m[1].replace(/^silver_/, '').replace(/^copper_/, '').replace(/_charm$/, '').replace(/^shell$/, 'shell'); const name = CHARMS[key] ? key : CHARMS[m[1]] ? m[1] : key === 'shell' ? 'shell' : /leaf/.test(m[1]) ? 'leaf' : 'smile'; return { k: 'charm', mesh: 'charm:' + (CHARMS[name] ? name : 'star'), mat: /^metal_/.test(id) ? 'metal' : 'enamel', rgb, rim: /^metal_/.test(id) ? null : [236, 222, 176] }; }
        if ((m = /^gem_([a-z]+)_(round|faceted|nugget)$/.exec(id))) { const g = m[1], sh = m[2]; if (sh === 'nugget') return { k: 'stone', mesh: 'nugget:' + id, mat: 'polish', rgb }; if (sh === 'round') return { k: 'stone', mesh: 'ball', mat: CAB.includes(g) ? 'cab' : 'polish', rgb, sheen: SHEEN[g] }; if (CAB.includes(g)) return { k: 'stone', mesh: 'cab', mat: 'cab', rgb, sheen: SHEEN[g] }; return { k: 'gem', mesh: 'cut:' + (GEMCUT[g] || 'oval'), mat: 'gem', rgb }; }
        if ((m = /^prem_(diamond|emerald|ruby|sapphire)$/.exec(id))) return { k: 'gem', mesh: 'cut:' + GEMCUT[m[1]], mat: 'gem', rgb: m[1] === 'diamond' ? [235, 245, 255] : rgb, bright: m[1] === 'diamond' };
        if (/^(prem_gold_bead|prem_plat_bead|prem_gold_link|gold_bead|plat_bead|silver_bead|asilver_bead|silver_chain)$/.test(id)) return { k: 'bead', mesh: 'ball', mat: 'metal', rgb };
        if (/^(prem_gold_charm|asilver_charm|prem_deco)/.test(id)) return { k: 'charm', mesh: 'charm:' + (/deco/.test(id) ? 'sun' : 'crown'), mat: 'metal', rgb };
        if (/^rpearl|^pearl_/.test(id)) return { k: 'bead', mesh: 'ball', mat: 'pearl', rgb };
        if (/^bicone_/.test(id)) return { k: 'bead', mesh: 'bicone', mat: 'gem', rgb };
        if (/^faceted_/.test(id)) return { k: 'bead', mesh: 'facetball', mat: 'gem', rgb };
        if (/^vintage_/.test(id)) return { k: 'bead', mesh: 'facetball', mat: 'glossy', rgb };
        if (/^seaglass_/.test(id)) return { k: 'bead', mesh: 'nugget:' + id, mat: 'frost', rgb };
        if (/^glass_/.test(id)) return { k: 'bead', mesh: 'ball', mat: 'glass', rgb };
        if (/^ceramic_/.test(id)) return { k: 'bead', mesh: 'rondelle', mat: 'glossy', rgb, band: true };
        if (/^wood_|^find_driftwood/.test(id)) return { k: 'bead', mesh: 'barrel', mat: 'matte', rgb };
        if (/^pony_/.test(id)) return { k: 'bead', mesh: 'barrel', mat: 'glossy', rgb };
        if (/^clay_/.test(id)) return { k: 'bead', mesh: 'ball', mat: 'matte', rgb };
        if (/^stone_/.test(id) || c.kind === 'stone') return { k: 'stone', mesh: 'ball', mat: 'polish', rgb };
        if (/^find_(shell)/.test(id)) return { k: 'charm', mesh: 'charm:shell', mat: 'enamel', rgb, rim: [236, 222, 176] };
        if (/^find_(crystal|mineral)/.test(id)) return { k: 'gem', mesh: 'cut:marquise', mat: 'gem', rgb };
        if (c.kind === 'charm') return { k: 'charm', mesh: 'charm:star', mat: 'enamel', rgb, rim: [236, 222, 176] };
        return { k: 'bead', mesh: 'ball', mat: 'glossy', rgb };
    };

    const cache = {};
    const meshFor = key => {
        if (cache[key]) return cache[key]; let F, m;
        if (key === 'ball') F = ball(9, 16, 1, 1, 1); else if (key === 'cube') F = cubeM(); else if (key === 'cab') F = cabochon(1, 1, 16, 4); else if (key === 'bicone') F = lathe([[0, -1], [.95, 0], [0, 1]], 10, false); else if (key === 'facetball') F = lathe([[0, -1], [.55, -.8], [.92, -.35], [1, 0], [.92, .35], [.55, .8], [0, 1]], 10, false, true);
        else if (key === 'rondelle') F = ball(7, 16, 1.05, .62, 1.05); else if (key === 'barrel') F = lathe([[0, -.85], [.8, -.85], [1, -.4], [1, .4], [.8, .85], [0, .85]], 12, true);
        else if ((m = /^nugget:(.+)$/.exec(key))) F = nugget(m[1], 7, 12);
        else if ((m = /^cut:(.+)$/.exec(key))) F = cut(OUT[m[1]](), .34, .56, .78);
        else if ((m = /^charm:(.+)$/.exec(key))) { const d = CHARMS[m[1]]; F = []; if (d.cube) F = cubeM().map(f => f); else if (d.cone) F = lathe([[0, 0], [1, 0], [.12, 1.4]], 8, true); else d.polys.forEach((poly, i) => puff(poly, .17, i * .004).forEach(f => F.push(f))); F.decor = d.decor || []; if (d.cube) F.decor = [{ t: 'sphere', x: 0, y: 0, r: .12, c: [30, 30, 40], face: 1 }]; }
        F.key = key; return cache[key] = F;
    };

    /* ---------------------------------------------------------- shading */
    const L = nrm([-.4, .85, .55]), V = [0, .25, 1], H = nrm([L[0] + V[0], L[1] + V[1], L[2] + V[2]]);
    const rotY = (p, c, s) => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c], rotX = (p, c, s) => [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
    G.tris = 0;
    const faceColor = (f, n, part, base, t, st) => {
        const ndl = clamp(dot(n, L), 0, 1), spec = Math.pow(clamp(dot(n, H), 0, 1), part.mat === 'metal' ? 14 : part.mat === 'gem' ? 28 : 40); let c = base, glint = 0;
        switch (part.mat) {
            case 'gem': { const tw = .5 + .5 * Math.sin(f.id * 2.399 + t * 2.6 + st.seed), k = .5 + .5 * ndl * 1 + .22 * tw, hi = Math.pow(clamp(dot(n, H) + .06 * tw, 0, 1), 18); c = mixc(base.map(v => v * k * 1.05), [255, 255, 255], clamp(hi * 1.1 + (part.bright ? .18 * tw : 0), 0, .95)); if (hi > .72) glint = hi; if (f.table) c = mixc(base.map(v => v * (.85 + .3 * tw)), [255, 255, 255], .16 + .28 * spec + .1 * tw); break; }
            case 'metal': { const e = clamp(n[1] * .5 + .5, 0, 1), k2 = Math.pow(e, 1.3), lo = base.map(v => v * .28), mid = base.map(v => Math.min(255, v * 1.08)); c = mixc(mixc(lo, mid, clamp(k2 * 1.6, 0, 1)), [255, 255, 255], clamp((k2 - .7) * 1.4, 0, .6) + spec * .9); if (spec > .5) glint = spec; break; }
            case 'pearl': { const irid = mixc(mixc([255, 205, 235], [195, 235, 255], .5 + .5 * n[0]), [255, 240, 205], .5 + .5 * n[2] * .6); c = mixc(base.map(v => v * (.7 + .34 * ndl)), irid, .24 + .1 * (1 - ndl)); c = mixc(c, [255, 255, 255], spec * .9); if (spec > .6) glint = spec * .8; break; }
            case 'glass': c = mixc(base.map(v => v * (.7 + .4 * ndl)), [255, 255, 255], spec * .9 + .12 * (1 - Math.abs(n[2]))); if (spec > .6) glint = spec * .6; break;
            case 'frost': c = mixc(base.map(v => v * (.8 + .3 * ndl)), [255, 255, 255], .28 + spec * .3); break;
            case 'glossy': c = mixc(base.map(v => v * (.75 + .35 * ndl)), [255, 255, 255], spec * .75); if (spec > .7) glint = spec * .5; break;
            case 'polish': c = mixc(base.map(v => v * (.8 + .3 * ndl + .1 * Math.sin(f.id * 1.7))), [255, 255, 255], spec * .55); break;
            case 'cab': { const sh = part.sheen; c = mixc(base.map(v => v * (.8 + .3 * ndl)), [255, 255, 255], spec * .7); if (sh) c = mixc(c, mixc(sh[0], sh[1], .5 + .5 * Math.sin(n[0] * 4 + n[1] * 3 + t * 1.4 + st.seed)), .35); break; }
            case 'enamel': c = part.dome === 'rim' ? mixc(part.rim || base, [255, 255, 255], spec * .7) : mixc(base.map(v => Math.min(255, v * (.98 + .26 * ndl))), [255, 255, 255], spec * .55); break;
            default: c = base.map(v => v * (.78 + .3 * ndl));
        }
        return { c, glint };
    };

    /* ---------------------------------------------------------- drawing */
    G.draw = (R, comp, x, y, z, size, yaw, t, opts) => {
        opts = opts || {}; const part = comp.part || G.partOf(comp), mesh = meshFor(part.mesh), base = part.rgb || comp.rgb || [200, 200, 200], tilt = opts.tilt == null ? (part.k === 'gem' ? .9 : part.mesh === 'cab' ? .55 : part.k === 'charm' ? .12 : .25) : opts.tilt, cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(tilt), sx = Math.sin(tilt), st = { seed: hash(comp.id || 'x') % 100 }, S = size * (part.k === 'charm' ? 1 : 1);
        const flat = part.mesh.indexOf('charm:') === 0 || part.mesh === 'cube' ? 1 : 0, world = p => { const q = rotX(rotY([p[0], p[1], p[2]], cy, sy), cx, sx); return [x + q[0] * S, y + q[1] * S, z + q[2] * S]; }, wn = n => rotX(rotY(n, cy, sy), cx, sx);
        const pend = R._glints = R._glints || [];
        for (const f of mesh) {
            const wp = f.p.map(world); let n0 = f.n ? f.n.map(wn) : null; const fnrm = n0 ? nrm([n0[0][0] + n0[1][0] + n0[2][0], n0[0][1] + n0[1][1] + n0[2][1], n0[0][2] + n0[1][2] + n0[2][2]]) : faceN(wp[0], wp[1], wp[2]);
            const pp = Object.assign({}, part, { dome: f.part }), fc = faceColor(f, fnrm, pp, f.part === 'rim' && part.rim ? part.rim : base, t || 0, st); G.tris++;
            R.tri(wp[0], wp[1], wp[2], fc.c.map(v => clamp(v, 0, 255)), n0 ? n0[0] : null, n0 ? n0[1] : null, n0 ? n0[2] : null);
            if (fc.glint > .7 && pend.length < 60) pend.push({ x: (wp[0][0] + wp[1][0] + wp[2][0]) / 3, y: (wp[0][1] + wp[1][1] + wp[2][1]) / 3, z: (wp[0][2] + wp[1][2] + wp[2][2]) / 3, a: fc.glint, s: S });
        }
        if (mesh.decor) for (const d of mesh.decor) {
            const pos = (px, py, pz) => world([px, py, pz]);
            if (d.t === 'sphere') { const q = pos(d.x, d.y, d.face ? .95 : .3 * 1.5 + .12), col = d.c || base.map(v => v * (d.dark || .8)); R.sphere(q[0], q[1], q[2], d.r * S, col, 4, 8); }
            else if (d.t === 'shine') { const q = pos(d.x, d.y, .43); R.sphere(q[0], q[1], q[2], .14 * S, [255, 255, 255], 3, 6, .09 * S, .05 * S); }
            else if (d.t === 'tube') { const col = d.c || base.map(v => v * .8); for (let i = 0; i < d.pts.length - 1; i++) { const a = pos(d.pts[i][0], d.pts[i][1], .33), b = pos(d.pts[i + 1][0], d.pts[i + 1][1], .33); R.limb(a, b, d.r * S, d.r * S, col, 5, true); } }
        }
        if (part.k === 'letter' && part.letter) (R._letters = R._letters || []).push({ x, y, z, s: S, ch: part.letter, yaw });
    };
    // glints + letters drawn on the 2D canvas after R.end(g)
    G.flush = (g, R, t) => {
        const gl = R._glints || [], lt = R._letters || []; R._glints = []; R._letters = [];
        for (const q of gl) { const p = R.project(q.x, q.y, q.z + 0); if (!p) continue; const sz = clamp(q.s * 130 / p[2] * (.5 + .5 * Math.sin(t * 5 + q.x * 40)) * q.a, 1.5, 9); if (sz < 2) continue; g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(p[0] - sz, p[1] - .5, sz * 2, 1); g.fillRect(p[0] - .5, p[1] - sz, 1, sz * 2); g.fillRect(p[0] - 1, p[1] - 1, 2, 2); }
        for (const q of lt) { if (Math.cos(q.yaw) < .15) continue; const p = R.project(q.x, q.y, q.z); if (!p) continue; const sz = clamp(q.s * 150 / p[2], 5, 28); g.font = 'bold ' + Math.round(sz) + 'px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#3a2d5a'; g.fillText(q.ch, p[0], p[1] + 1); g.textBaseline = 'alphabetic'; }
    };
    // small picture of a piece for palettes, strands and shops (needs a canvas; returns null otherwise)
    const sprites = {};
    G.sprite = (comp, px) => {
        px = px || 24; const key = (comp.id || '') + '@' + px; if (sprites[key] !== undefined) return sprites[key]; if (typeof document === 'undefined') return sprites[key] = null;
        const N3 = typeof module !== 'undefined' && typeof require !== 'undefined' ? require('./nr3d.js') : root.NR3D; if (!N3) return sprites[key] = null;
        const R = N3.create(px * 2, px * 2), cv = document.createElement('canvas'); cv.width = px * 2; cv.height = px * 2; const g = cv.getContext('2d'), KEY = [255, 0, 255];
        R.begin({ x: 0, y: .06, z: 2.7, yaw: Math.PI, pitch: -.02, fov: .62 }, { top: KEY, bottom: KEY, fogNear: 99, fogFar: 200, ambient: .72 }); G.draw(R, comp, 0, 0, 0, .85, .55, 1.2); R.end(g); G.flush(g, R, 1.2);
        const im = g.getImageData(0, 0, cv.width, cv.height), d = im.data; for (let i = 0; i < d.length; i += 4) if (d[i] > 245 && d[i + 1] < 12 && d[i + 2] > 245) d[i + 3] = 0; g.putImageData(im, 0, 0);
        const out = document.createElement('canvas'); out.width = px; out.height = px; const og = out.getContext('2d'); og.imageSmoothingEnabled = true; og.drawImage(cv, 0, 0, px, px); return sprites[key] = out;
    };
    G.stats = () => ({ meshes: Object.keys(cache).length, charms: G.CHARMS.length });
    G.meshFor = meshFor; G.KINDS = ['round', 'oval', 'pear', 'heart', 'marquise', 'emerald', 'cushion'];
    if (typeof module !== 'undefined') module.exports = G; else root.NRGems = G;
})(typeof window !== 'undefined' ? window : globalThis);

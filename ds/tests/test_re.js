const RE = require('../kit/nrre.js'); let pass = 0, fail = 0;
const T = (n, c, x) => { if (c) pass++; else { fail++; console.log('FAIL', n, x === undefined ? '' : JSON.stringify(x)); } };
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
/* a drawn picture: shaded balls and bars on a plain background, quantised to `levels` colour indices */
function picture(W, H, levels, variant = 0) {
    const px = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; const balls = [[W * 0.3 + variant * 2, H * 0.4, H * 0.28], [W * 0.7, H * 0.65, H * 0.22]];
        for (const [cx, cy, r] of balls) { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d < r) v = Math.max(v, 1 + Math.floor((1 - (dx * -0.5 + dy * -0.6) / r / 2 - 0.5 + 0.5) * (levels - 2)) % (levels - 1)); }
        if (x > W * 0.45 && x < W * 0.55 && y > H * 0.1) v = levels - 1; px[y * W + x] = v; }
    return px;
}
const enc = {
    gb2: (px, W, tx, ty) => { const o = []; for (let y = 0; y < 8; y++) { let lo = 0, hi = 0; for (let x = 0; x < 8; x++) { const v = px[(ty * 8 + y) * W + tx * 8 + x]; lo |= (v & 1) << (7 - x); hi |= (v >> 1 & 1) << (7 - x); } o.push(lo, hi); } return o; },
    snes4: (px, W, tx, ty) => { const o = [[], [], [], []]; for (let y = 0; y < 8; y++) { const pl = [0, 0, 0, 0]; for (let x = 0; x < 8; x++) { const v = px[(ty * 8 + y) * W + tx * 8 + x]; for (let b = 0; b < 4; b++) pl[b] |= (v >> b & 1) << (7 - x); } o[0].push(pl[0], pl[1]); o[1].push(pl[2], pl[3]); } return o[0].concat(o[1]); },
    lin4: (px, W, tx, ty) => { const o = []; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x += 2) o.push(px[(ty * 8 + y) * W + tx * 8 + x] | px[(ty * 8 + y) * W + tx * 8 + x + 1] << 4); return o; },
};
function sheet(fmt, tilesW, tilesH, levels, variant) { const W = tilesW * 8, px = picture(W, tilesH * 8, levels, variant), out = []; for (let ty = 0; ty < tilesH; ty++) for (let tx = 0; tx < tilesW; tx++) out.push(...enc[fmt](px, W, tx, ty)); return out; }
const noise = n => { const a = new Uint8Array(n); for (let i = 0; i < n; i++) a[i] = rnd() * 256; return a; };
function rom(parts) { const L = parts.reduce((s, p) => s + p.length, 0); const d = new Uint8Array(L); let o = 0; for (const p of parts) { d.set(p, o); o += p.length; } return d; }

/* format detection */
for (const [fmt, lv] of [['gb2', 4], ['snes4', 16], ['lin4', 16]]) {
    const s = Uint8Array.from(sheet(fmt, 16, 12, lv)), d = rom([noise(4096), s, noise(4096)]), r = RE.detectFormat(d, 4096, 96, ['gb2', 'snes4', 'lin4', 'lin8', 'nes2']);
    T('detect ' + fmt, r[0].fmt === fmt || (fmt === 'snes4' && r[0].fmt === 'gb2'), r.slice(0, 3));
}
/* 4bpp vs 2bpp told apart by plane link */
const s4 = Uint8Array.from(sheet('snes4', 16, 12, 16)), s2 = Uint8Array.from(sheet('gb2', 16, 12, 4));
T('planeCorr 4bpp', RE.planeCorr(s4, 0, 64) > 0.12, RE.planeCorr(s4, 0, 64));
T('planeCorr 2bpp', RE.planeCorr(s2, 0, 64) < 0.08, RE.planeCorr(s2, 0, 64));
/* width */
for (const w of [8, 16]) { const s = Uint8Array.from(sheet('snes4', w, 192 / w, 16)), g = RE.guessWidth(s, 0, 'snes4', 192); T('width ' + w, g.width === w, g); }
/* animation: 8-tile frames, each differs a little */
{ const frames = []; for (let f = 0; f < 8; f++) frames.push(...sheet('snes4', 4, 2, 16, f % 3 * 0.5)); const a = RE.animation(Uint8Array.from(frames), 0, 'snes4', 64); T('animation frame size', a && a.frameTiles === 8, a); }
/* tilemap */
{ const m = []; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const t = (y < 20 && x < 20) ? 16 + y * 20 % 300 + x : 0; m.push(t & 255, (t >> 8 & 3) | (x % 7 === 0 ? 4 : 0) | (y > 24 ? 0x10 : 0)); }
  const d = rom([noise(8192), Uint8Array.from(m), noise(8192)]), r = RE.tilemaps(d, 0, d.length, { stride: 32 }); T('tilemap found', r.length >= 1 && Math.abs(r[0].off - 8192) <= 64, r); }
/* measure: reuse + flips */
{ const base = sheet('gb2', 8, 4, 4), tile = base.slice(0, 16); const mirrored = []; for (let i = 0; i < 8; i++) { const t = base.slice((i + 3) * 16, (i + 4) * 16), m = []; for (let y = 0; y < 8; y++) { const rev = b => { let r = 0; for (let k = 0; k < 8; k++) r |= (b >> k & 1) << (7 - k); return r; }; m.push(rev(t[y * 2]), rev(t[y * 2 + 1])); } mirrored.push(...m); }
  const data = Uint8Array.from([...base, ...mirrored]), me = RE.measure(data, { off: 0, len: data.length, fmt: 'gb2' }); T('flip reuse found', me.flipReuse > 0.1, me); T('measure has no pixels', !JSON.stringify(me).includes('data'), me); }
/* analyze + record: numbers only */
{ const d = rom([noise(65536), Uint8Array.from(sheet('gb2', 16, 20, 4)), noise(65536), Uint8Array.from(sheet('gb2', 16, 24, 4, 1)), noise(65536)]), A = RE.analyze(d, 'gb', { maxMs: 8000 }); T('analyze finds 2 sheets', A.assets.length >= 2, A.assets.map(a => [a.off, a.len]));
  const hit = A.assets.find(a => Math.abs(a.off - 65536) <= 1024); T('sheet offset', !!hit, A.assets.map(a => a.off)); if (hit) T('sheet width', hit.width === 16, hit.width);
  const rec = RE.record(A, { id: 'x', name: 'synthetic' }), js = JSON.stringify(rec); T('record small', js.length < 4000, js.length); T('record explains', rec.lines.length >= 2, rec.lines);
  T('record has no pixel arrays', !/"data"|\[\[\d+,\d+,\d+/.test(js), js.slice(0, 200));
  const lib = RE.lib.merge(null, rec); RE.lib.merge(lib, Object.assign({}, rec, { id: 'y' })); RE.lib.merge(lib, Object.assign({}, rec, { id: 'x' })); T('lib dedupe by id', lib.games.length === 2);
  const adv = RE.lib.advice(lib, 'gb'); T('advice', adv && adv.games === 2 && adv.lines.length >= 2, adv); const st = RE.lib.styleFor(adv, 'retro'); T('styleFor', st.ramp >= 3 || st.dither !== undefined, st); }
/* bitmap width */
{ const w = 64, h = 60, d = new Uint8Array(w * h * 2); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = (Math.min(31, x >> 1) << 11 | Math.min(31, y >> 1) << 6 | 8 << 1 | 1); d[(y * w + x) * 2] = v >> 8; d[(y * w + x) * 2 + 1] = v & 255; }
  const g = RE.guessBitmap(d, 0, { be: true }); T('bitmap width', g && g.width === 64, g); const im = RE.renderBitmap(d, { off: 0, width: 64, height: 60, be: true }); T('bitmap render', im.w === 64 && im.data[3] === 255); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

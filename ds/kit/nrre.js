/* NOTAREAL Graphics Reverse Engineer (v1.0). Works on ROMs you feed it, fully offline.
 *  detectFormat()  which tile format is this data? (2bpp, SNES 4bpp/8bpp planar, GBA/DS linear 4bpp/8bpp, NES)
 *  guessWidth()    how many tiles wide is this picture/sprite sheet?   guessBitmap(): width of a raw 16-bit bitmap (N64/PSX/GBA)
 *  tilemaps()      find background maps (tile numbers + flips + palette banks)
 *  animation()     find the size of one animation frame and how much changes frame to frame
 *  measure()       technique numbers for a region: tile reuse, flip reuse, symmetry, dither, colours per tile, shading ramps
 *  analyze()       the whole pipeline on a ROM -> list of graphic assets with offsets, formats and confidence
 *  record()        strips everything down to NUMBERS (no pixels, no colours) so it can go into the graphics library
 *  lib.*           merge records from many games and turn them into design budgets for new games
 *  render()        draws a region on screen (preview only; the studio never saves what it draws). */
(function (root) {
'use strict';
const RE = {};
const G = typeof NRGfx !== 'undefined' ? NRGfx : require('./nrgfx.js');
const I = G._int;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
const u16 = (d, o) => d[o] | d[o + 1] << 8;

/* ------------------------------------------------------------ formats */
const FMT = Object.assign({}, G._FMT);
FMT.nes2 = { bytes: 16, colors: 4, dec: (d, o, out) => { for (let y = 0; y < 8; y++) { const lo = d[o + y], hi = d[o + 8 + y]; for (let x = 0; x < 8; x++) out[y * 8 + x] = ((hi >> (7 - x)) & 1) << 1 | ((lo >> (7 - x)) & 1); } } };
FMT.snes8 = { bytes: 64, colors: 256, dec: (d, o, out) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const s = 7 - x; let v = 0; for (let p = 0; p < 4; p++) { v |= (d[o + p * 16 + y * 2] >> s & 1) << (p * 2); v |= (d[o + p * 16 + y * 2 + 1] >> s & 1) << (p * 2 + 1); } out[y * 8 + x] = v; } } };
RE.FMT = FMT;
RE.FMT_NAMES = { gb2: '2bpp planar (Game Boy / SNES / GBC)', nes2: '2bpp planar (NES)', snes4: '4bpp planar (SNES)', snes8: '8bpp planar (SNES)', lin4: '4bpp linear (GBA / DS)', lin8: '8bpp linear (GBA / DS)' };
RE.PLAT_FORMATS = { gb: ['gb2'], gbc: ['gb2'], nes: ['nes2'], snes: ['snes4', 'gb2'], gba: ['lin4', 'lin8'], nds: ['lin4', 'lin8'] };
const BPP = { gb2: 2, nes2: 2, snes4: 4, snes8: 8, lin4: 4, lin8: 8 };
const GRAY = [[0, 0, 0], [96, 96, 96], [176, 176, 176], [248, 248, 248]];

/* ------------------------------------------------------------ render (preview only) */
RE.render = (d, o) => {      // o: {off, fmt, cols, rows, pal:[[r,g,b]], bank}
    const f = FMT[o.fmt]; if (!f) return null; const cols = o.cols || 16, avail = Math.max(0, Math.floor((d.length - o.off) / f.bytes)), total = Math.min(avail, (o.rows || 16) * cols);
    const rows = Math.ceil(total / cols), w = cols * 8, h = Math.max(1, rows) * 8, data = new Uint8ClampedArray(w * h * 4), tmp = new Uint8Array(64), pal = o.pal;
    for (let t = 0; t < total; t++) {
        f.dec(d, o.off + t * f.bytes, tmp); const bx = (t % cols) * 8, by = Math.floor(t / cols) * 8;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = tmp[y * 8 + x], i = ((by + y) * w + bx + x) * 4; let c;
            if (pal) { c = pal[v % pal.length] || [0, 0, 0]; if (!v && f.colors > 4 && !o.opaque) continue; } else c = f.colors === 4 ? GRAY[v] : [v * 17 & 255, v * 17 & 255, v * 17 & 255];
            data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255; }
    }
    return { w, h, data, tiles: total };
};
RE.renderBitmap = (d, o) => {    // raw 16-bit 5551 (N64 BE / GBA LE) bitmap, o: {off, width, height, be}
    const w = o.width, h = o.height, data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { const p = o.off + i * 2; if (p + 1 >= d.length) break; const v = o.be ? d[p] << 8 | d[p + 1] : d[p] | d[p + 1] << 8;
        if (o.be) { data[i * 4] = (v >> 11 & 31) * 255 / 31; data[i * 4 + 1] = (v >> 6 & 31) * 255 / 31; data[i * 4 + 2] = (v >> 1 & 31) * 255 / 31; data[i * 4 + 3] = v & 1 ? 255 : 0; }
        else { data[i * 4] = (v & 31) * 255 / 31; data[i * 4 + 1] = (v >> 5 & 31) * 255 / 31; data[i * 4 + 2] = (v >> 10 & 31) * 255 / 31; data[i * 4 + 3] = 255; } }
    return { w, h, data };
};

/* ------------------------------------------------------------ detect format */
function sheetScore(d, off, fmt, n, tmp) {
    const f = FMT[fmt]; n = Math.min(n, Math.floor((d.length - off) / f.bytes)); if (n < 8) return null;
    const s = I && G._tileScore(d, off, f, n, tmp), K = f.colors === 4 ? 3.9 : 9.5;
    const score = (s.eq - 0.3) + 0.5 * s.diag - 2.2 * s.iso - 0.35 * Math.abs(Math.log(clamp(s.ratio, 0.2, 5))) + 0.3 * s.uniq - (s.colors > K ? 0.6 : 0) - (s.zero > 0.93 ? 0.5 : 0);
    return { fmt, score: r3(score), eq: r3(s.eq), iso: r3(s.iso), colors: r2(s.colors), uniq: r3(s.uniq) };
}
/* 4bpp planar art read as 2bpp looks like two related pictures per tile: planes 0-1 and planes 2-3 share the same silhouette.
   Real 2bpp art has no such link between neighbouring tiles. Returns how much stronger the (even,odd) link is than (odd,even). */
RE.planeCorr = (d, off, nTiles = 64) => {
    const tmp = new Uint8Array(64), masks = []; nTiles = Math.min(nTiles * 2, Math.floor((d.length - off) / 16)); if (nTiles < 8) return 0;
    for (let t = 0; t < nTiles; t++) { FMT.gb2.dec(d, off + t * 16, tmp); let m = 0n; for (let i = 0; i < 64; i++) if (tmp[i]) m |= 1n << BigInt(i); masks.push(m); }
    const pc = x => { let c = 0; while (x) { x &= x - 1n; c++; } return c; }, jac = (a, b) => { const u = pc(a | b); return u ? pc(a & b) / u : -1; };
    let A = 0, an = 0, B = 0, bn = 0;
    for (let t = 0; t + 1 < nTiles; t++) { if (!masks[t] && !masks[t + 1]) continue; const j = jac(masks[t], masks[t + 1]); if (j < 0) continue; if (t % 2 === 0) { A += j; an++; } else { B += j; bn++; } }
    return an > 8 && bn > 8 ? A / an - B / bn : 0;
};
RE.detectFormat = (d, off, nTiles = 96, candidates) => {
    const tmp = new Uint8Array(64), out = []; for (const fmt of candidates || Object.keys(FMT)) { const r = sheetScore(d, off, fmt, fmt === 'snes8' || fmt === 'lin8' ? Math.min(nTiles, 64) : nTiles, tmp); if (r) out.push(r); }
    return out.sort((a, b) => b.score - a.score);
};

/* ------------------------------------------------------------ width (tiles per row) */
RE.guessWidth = (d, off, fmt, nTiles = 256, maxW = 32) => {
    const f = FMT[fmt], n = Math.min(nTiles, Math.floor((d.length - off) / f.bytes)); if (n < 4) return null; const px = new Uint8Array(n * 64), tmp = new Uint8Array(64);
    for (let t = 0; t < n; t++) { f.dec(d, off + t * f.bytes, tmp); px.set(tmp, t * 64); }
    const best = [], P = (t, x, y) => px[t * 64 + y * 8 + x];
    const edge = (a, b, vertical) => { let m = 0, c = 0; for (let k = 0; k < 8; k++) { const p = vertical ? P(a, k, 7) : P(a, 7, k), q = vertical ? P(b, k, 0) : P(b, 0, k); if (p || q) { c++; if (p === q) m++; else if (Math.abs(p - q) === 1) m += 0.4; } } return c ? [m, c] : [0, 0]; };
    for (let W = 1; W <= Math.min(maxW, n >> 1 || 1); W++) {
        let hm = 0, hc = 0, vm = 0, vc = 0;
        for (let t = 0; t < n; t++) { if ((t + 1) % W && t + 1 < n) { const [m, c] = edge(t, t + 1, false); hm += m; hc += c; } if (t + W < n) { const [m, c] = edge(t, t + W, true); vm += m; vc += c; } }
        const hs = hc ? hm / hc : 0, vs = vc ? vm / vc : 0; best.push({ width: W, score: r3(W === 1 ? vs : (hs + vs) / 2), h: r3(hs), v: r3(vs) });
    }
    best.sort((a, b) => b.score - a.score); const top = best[0], sec = best[1];
    // among near-equal scores prefer the smallest width that divides the others (a 16-wide sheet also scores well at 8 or 32)
    const near = best.filter(b => b.score >= top.score - 0.02).sort((a, b) => a.width - b.width)[0];
    return { width: near.width, score: near.score, confidence: r2(clamp((top.score - (sec ? sec.score : 0)) * 6 + top.score * 0.5, 0, 1)), candidates: best.slice(0, 3) };
};
RE.guessBitmap = (d, off, o = {}) => {      // raw 16-bit pictures: choose the width where each row best matches the one below it
    const be = !!o.be, rowsToUse = 48, out = [], pix = (p) => be ? (d[p] << 8 | d[p + 1]) : (d[p] | d[p + 1] << 8);
    const chan = v => be ? [v >> 11 & 31, v >> 6 & 31, v >> 1 & 31] : [v & 31, v >> 5 & 31, v >> 10 & 31];
    for (const w of o.widths || [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 256, 320, 512]) {
        if (off + w * 2 * (rowsToUse + 1) > d.length) continue; let s = 0, n = 0;
        for (let y = 0; y < rowsToUse; y++) for (let x = 0; x < w; x++) { const a = chan(pix(off + (y * w + x) * 2)), b = chan(pix(off + ((y + 1) * w + x) * 2)); s += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); n++; }
        out.push({ width: w, diff: r2(s / n) });
    }
    out.sort((a, b) => a.diff - b.diff); if (!out.length) return null; return { width: out[0].width, diff: out[0].diff, candidates: out.slice(0, 3), confidence: r2(clamp((out[1] ? out[1].diff - out[0].diff : 1) / Math.max(1, out[1] ? out[1].diff : 1) * 2, 0, 1)) };
};

/* ------------------------------------------------------------ tilemaps */
RE.tilemaps = (d, start, end, o = {}) => {
    const bits = o.entry === 8 ? 8 : 16, win = o.win || 64, stride = o.stride || 32, maxTile = o.maxTile || (bits === 8 ? 256 : 1024), out = []; let run = null; const t0 = Date.now();
    const step = bits / 8;
    for (let p = start; p + win * step <= end; p += stride) {
        if ((p & 0xFFFFF) === 0 && Date.now() - t0 > (o.maxMs || 3000)) break;
        const vals = new Array(win), tiles = new Set(), hi = new Set(); let near = 0, rep = 0, maxT = 0;
        for (let k = 0; k < win; k++) { const v = bits === 8 ? d[p + k] : u16(d, p + k * 2); vals[k] = v; const t = bits === 8 ? v : v & 0x3FF; tiles.add(t); hi.add(bits === 8 ? 0 : v >> 10); if (t > maxT) maxT = t; if (k) { const dd = Math.abs(t - (bits === 8 ? vals[k - 1] : vals[k - 1] & 0x3FF)); if (dd <= 1) near++; if (dd === 0) rep++; } }
        const coh = near / (win - 1), ok = tiles.size >= 3 && tiles.size <= win * 0.75 && maxT < maxTile && hi.size <= 8 && coh >= (bits === 8 ? 0.5 : 0.55) && rep < win * 0.97 && (bits === 8 ? coh > 0.6 : true);
        if (ok) { if (run && p <= run.end) { run.end = p + win * step; run.cohs.push(coh); } else { run = { start: p, end: p + win * step, cohs: [coh] }; out.push(run); } } else if (run && p > run.end) run = null;
    }
    return out.filter(r => r.end - r.start >= (o.minBytes || 1024)).map(r => {
        const n = (r.end - r.start) / step, tiles = new Set(); let flips = 0, pals = new Set(), maxT = 0;
        for (let k = 0; k < n; k++) { const v = bits === 8 ? d[r.start + k] : u16(d, r.start + k * 2), t = bits === 8 ? v : v & 0x3FF; tiles.add(t); if (t > maxT) maxT = t; if (bits === 16) { if (v & 0xC00) flips++; pals.add(v >> 12 & 15); } }
        return { off: r.start, len: r.end - r.start, entries: n, entryBits: bits, tilesUsed: tiles.size, tileMax: maxT, flipRate: r3(flips / n), paletteBanks: bits === 16 ? pals.size : 0, coherence: r2(mean(r.cohs)), width: n >= 1024 ? 32 : n >= 512 ? 32 : 0 };
    });
};

/* ------------------------------------------------------------ animation */
function frameSim(px, a, b, n) { let m = 0, c = 0; for (let i = 0; i < n; i++) { const p = px[a + i], q = px[b + i]; if (p || q) { c++; if (p === q) m++; } } return c ? m / c : 1; }
RE.animation = (d, off, fmt, nTiles = 256) => {
    const f = FMT[fmt], n = Math.min(nTiles, Math.floor((d.length - off) / f.bytes)); if (n < 12) return null; const px = new Uint8Array(n * 64), tmp = new Uint8Array(64);
    for (let t = 0; t < n; t++) { f.dec(d, off + t * f.bytes, tmp); px.set(tmp, t * 64); }
    const res = [];
    for (const ft of [2, 3, 4, 6, 8, 9, 12, 16, 18, 24, 32, 36, 48, 64]) { const frames = Math.floor(n / ft); if (frames < 3) continue; let s = 0, k = 0; for (let i = 0; i + 1 < frames; i++) { s += frameSim(px, i * ft * 64, (i + 1) * ft * 64, ft * 64); k++; } res.push({ frameTiles: ft, frames, sim: r3(s / k) }); }
    if (!res.length) return null; const mx = Math.max(...res.map(r => r.sim)); if (mx < 0.5) return null;
    const small = res.filter(r => r.sim >= mx - 0.04 && r.frameTiles >= 2).sort((a, b) => a.frameTiles - b.frameTiles)[0];
    const chosen = small; if (!chosen || chosen.frameTiles < 2) return null;
    return { frameTiles: chosen.frameTiles, frames: chosen.frames, similarity: chosen.sim, changeRate: r3(1 - chosen.sim) };
};

/* ------------------------------------------------------------ measure */
function canon(px, o, flips) {      // hash of a tile and (optionally) its 3 mirror images; returns min hash
    let best = 1e18; const T = flips ? 4 : 1;
    for (let v = 0; v < T; v++) { let h = 5381; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const yy = v & 2 ? 7 - y : y, xx = v & 1 ? 7 - x : x; h = (h * 33 + px[o + yy * 8 + xx]) >>> 0; } if (h < best) best = h; } return best;
}
RE.measure = (d, region, pal) => {      // region: {off, len, fmt}
    const f = FMT[region.fmt], n = Math.min(Math.floor(region.len / f.bytes), 1024); if (n < 4) return null; const px = new Uint8Array(n * 64), tmp = new Uint8Array(64);
    for (let t = 0; t < n; t++) { f.dec(d, region.off + t * f.bytes, tmp); px.set(tmp, t * 64); }
    const ex = new Set(), fl = new Set(); let blank = 0, sym = 0, cps = 0, edgeOpaque = 0;
    for (let t = 0; t < n; t++) {
        const o = t * 64; let nz = 0, mask = 0; for (let i = 0; i < 64; i++) if (px[o + i]) { nz++; mask |= 1 << (px[o + i] & 31); }
        if (!nz) { blank++; continue; } ex.add(canon(px, o, false)); fl.add(canon(px, o, true));
        let s = true; for (let y = 0; y < 8 && s; y++) for (let x = 0; x < 4; x++) if (px[o + y * 8 + x] !== px[o + y * 8 + 7 - x]) { s = false; break; } if (s) sym++;
        let c = 0; for (let m = mask; m; m &= m - 1) c++; cps += c;
    }
    const filled = n - blank, st = I.tileStats(d, [{ start: region.off, end: region.off + n * f.bytes }], f);
    const m = { tiles: n, blank: r3(blank / n), unique: ex.size, reuse: r3(filled ? 1 - ex.size / filled : 0), flipReuse: r3(ex.size ? (ex.size - fl.size) / ex.size : 0), symmetric: r3(filled ? sym / filled : 0), colorsPerTile: r2(filled ? cps / filled : 0), bpp: BPP[region.fmt] };
    if (st) { m.dither = st.dither; m.flat = st.flat; m.fill = st.fill; }
    if (pal) { const img = RE.render(d, { off: region.off, fmt: region.fmt, cols: 16, rows: Math.ceil(Math.min(n, 256) / 16), pal }); const p = G.profile(img, { sheet: true }); if (p) { m.shading = { colors: p.colors, ramps: p.ramps, rampLen: p.rampLen, hueShift: p.hueShift, outline: p.outline, outlineKind: p.outlineKind, sat: p.sat, lumRange: p.lumRange, smooth: p.smooth, blockiness: p.blockiness }; } }
    return m;
};

/* ------------------------------------------------------------ analyze a whole ROM */
RE.analyze = (d, plat, o = {}) => {
    const t0 = Date.now(), maxMs = o.maxMs || 25000, fmts = RE.PLAT_FORMATS[plat], out = { platform: plat, size: d.length, assets: [], maps: [], palettes: [], ms: 0, notes: [] };
    if (!fmts) { out.notes.push('Explorer-only console: use the manual explorer (offset, format, width) for this one.'); return out; }
    const limit = Math.min(d.length, 48 << 20), big = d.length > (12 << 20); let regions = [];
    for (const fm of fmts) {
        const f = FMT[fm]; const rs = I.findTileRegions(d, 0, limit, f, { stride: big ? f.bytes * 128 : f.bytes * 8, maxMs: Math.min(maxMs / 2, 12000) });
        for (const r of rs) regions.push({ start: r.start, end: r.end, fmt: fm });
    }
    // two formats can claim the same bytes (SNES 2bpp inside 4bpp art): keep the one that scores best on the overlap
    regions.sort((a, b) => a.start - b.start); const kept = [];
    for (const r of regions) { const clash = kept.find(k => k.end > r.start && k.start < r.end && k.fmt !== r.fmt);
        if (!clash) { kept.push(r); continue; } const rank = RE.detectFormat(d, Math.max(r.start, clash.start), 96, [r.fmt, clash.fmt]); if (rank[0] && rank[0].fmt === r.fmt && rank[0].score > (rank[1] ? rank[1].score : -9)) { kept.splice(kept.indexOf(clash), 1, r); } }
    regions = kept;
    if (plat === 'snes') { for (const r of regions) if (r.fmt === 'gb2') { const pcs = []; for (let p = r.start; p + 2048 <= r.end && pcs.length < 12; p += Math.max(2048, Math.floor((r.end - r.start) / 12 / 32) * 32)) pcs.push(RE.planeCorr(d, p, 64)); if (pcs.length && median(pcs) > 0.12) r.fmt = 'snes4'; } }
    let pals = []; if (plat !== 'gb' && plat !== 'nes' && regions.length) { pals = I.findPalettes(d, 0, limit, 16, { step: big ? 32 : 2, maxMs: 6000 }); pals = pals.filter(p => regions.some(r => p.off > r.start - 0x20000 && p.off < r.end + 0x20000)); }
    out.palettes = pals.map(p => ({ off: p.off, colors: p.colors }));
    let id = 0; for (const r of regions.slice(0, o.maxAssets || 300)) {
        if (Date.now() - t0 > maxMs) { out.notes.push('Stopped early (time limit); analysis covers the first part of the ROM.'); break; }
        const len = r.end - r.start, f = FMT[r.fmt], pal = f.colors > 4 ? (I.bestPalette(d, { start: r.start, end: r.end }, f, pals) || I.nearestPalette(pals, r.start)) : null;
        const region = { off: r.start, len, fmt: r.fmt }, meas = RE.measure(d, region, pal ? pal.colors : null); if (!meas) continue;
        const wd = RE.guessWidth(d, r.start, r.fmt, 256), an = RE.animation(d, r.start, r.fmt, 256);
        const det = RE.detectFormat(d, r.start, 96, fmts), conf = clamp(0.4 + (det[0] && det[0].fmt === r.fmt ? 0.3 : 0) + (wd ? wd.confidence * 0.2 : 0) + (len >= 2048 ? 0.1 : 0), 0, 1);
        const kind = an && an.similarity >= 0.6 && an.frames >= 4 ? 'sprites' : (wd && wd.width >= 16 && meas.unique > 40 && meas.reuse > 0.1 ? 'background tiles' : meas.tiles >= 128 ? 'tileset' : 'sprites');
        out.assets.push({ id: ++id, off: r.start, len, fmt: r.fmt, kind, width: wd ? wd.width : 16, widthConfidence: wd ? wd.confidence : 0, animation: an, palette: pal ? pal.off : null, measure: meas, confidence: r2(conf) });
    }
    for (const fm of ['gb', 'gbc', 'nes'].includes(plat) ? [8] : [16]) {
        const maps = RE.tilemaps(d, 0, limit, { entry: fm, maxMs: 4000, stride: big ? 256 : 32 }); for (const m of maps.slice(0, 150)) out.maps.push(m);
    }
    out.ms = Date.now() - t0; return out;
};

/* ------------------------------------------------------------ record: numbers only */
RE.record = (A, meta = {}) => {
    const as = A.assets, by = {}; for (const a of as) { by[a.fmt] = by[a.fmt] || { regions: 0, tiles: 0 }; by[a.fmt].regions++; by[a.fmt].tiles += a.measure.tiles; }
    const med = k => { const v = as.map(a => a.measure[k]).filter(x => x != null); return v.length ? r3(median(v)) : null; };
    const sh = as.map(a => a.measure.shading).filter(Boolean), shm = k => { const v = sh.map(s => s[k]).filter(x => x != null); return v.length ? r2(median(v)) : null; };
    const anim = as.map(a => a.animation).filter(Boolean), sprites = as.filter(a => a.kind === 'sprites'), bg = as.filter(a => a.kind !== 'sprites');
    const rec = {
        version: 1, id: meta.id || null, name: meta.name || null, platform: A.platform, romBytes: A.size,
        formats: by, totalTiles: as.reduce((s, a) => s + a.measure.tiles, 0), graphicsBytes: as.reduce((s, a) => s + a.len, 0), regions: as.length,
        tileReuse: med('reuse'), flipReuse: med('flipReuse'), symmetric: med('symmetric'), colorsPerTile: med('colorsPerTile'), dither: med('dither'), blankTiles: med('blank'),
        sheetWidthTiles: as.length ? median(as.map(a => a.width)) : null,
        sprite: sprites.length ? { regions: sprites.length, medianTiles: median(sprites.map(a => a.measure.tiles)), frameTiles: anim.length ? median(anim.map(a => a.frameTiles)) : null, frameChange: anim.length ? r3(median(anim.map(a => a.changeRate))) : null } : null,
        background: bg.length ? { regions: bg.length, medianTiles: median(bg.map(a => a.measure.tiles)) } : null,
        maps: A.maps.length ? { count: A.maps.length, flipRate: r3(median(A.maps.map(m => m.flipRate))), paletteBanks: median(A.maps.map(m => m.paletteBanks)), tilesUsed: median(A.maps.map(m => m.tilesUsed)), entryBits: A.maps[0].entryBits } : null,
        palettes: A.palettes.length ? { found: A.palettes.length } : null,
        shading: sh.length ? { colors: shm('colors'), ramps: shm('ramps'), rampLen: shm('rampLen'), hueShift: shm('hueShift'), outline: shm('outline'), sat: shm('sat'), lumRange: shm('lumRange'), blockiness: shm('blockiness') } : null,
        confidence: as.length ? r2(mean(as.map(a => a.confidence))) : 0,
    };
    rec.lines = RE.explain(rec); return rec;
};
RE.explain = r => {
    const L = [], pn = (G.CONSOLES[r.platform] || {}).name || r.platform;
    if (!r.regions) return ['No readable tile graphics were found (they may be compressed, or this console stores art in a format the explorer has to be pointed at by hand).'];
    L.push(`${pn}: ${r.regions} graphic regions, ${r.totalTiles} tiles measured (${Object.entries(r.formats).map(([k, v]) => v.regions + '× ' + (RE.FMT_NAMES[k] || k)).join(', ')}).`);
    if (r.tileReuse != null) L.push(`Tile reuse: about ${Math.round(r.tileReuse * 100)}% of filled tiles repeat inside a sheet${r.flipReuse > 0.02 ? `; ${Math.round(r.flipReuse * 100)}% more are mirror images of other tiles, so the artists drew one side and flipped it` : ''}.`);
    if (r.symmetric > 0.1) L.push(`${Math.round(r.symmetric * 100)}% of tiles are left-right symmetric: shapes are built from mirrored halves to save space.`);
    if (r.colorsPerTile) L.push(`Each tile uses about ${r.colorsPerTile} colours${r.dither > 0.02 ? `; checkerboard dithering shows up on ${(r.dither * 100).toFixed(1)}% of pixel pairs` : ' with little dithering'}.`);
    if (r.sprite && r.sprite.frameTiles) L.push(`Animated sprites: a frame is about ${r.sprite.frameTiles} tiles and ${Math.round(r.sprite.frameChange * 100)}% of the pixels change between frames, so animation is done by redrawing only the moving parts.`);
    if (r.maps) L.push(`Background maps: ${r.maps.count} found, ${r.maps.entryBits === 16 ? `${Math.round(r.maps.flipRate * 100)}% of entries use flips and ${r.maps.paletteBanks} palette banks per map` : 'one byte per tile'}, about ${r.maps.tilesUsed} different tiles per map.`);
    if (r.shading) L.push(`Shading (when a palette could be matched): ${r.shading.ramps || '?'} colour ramps, ${r.shading.rampLen || '?'} steps each${r.shading.hueShift != null ? `, hue shifts about ${r.shading.hueShift}° from shadow to light` : ''}.`);
    return L;
};

/* ------------------------------------------------------------ library: many games -> design budgets */
RE.lib = {
    empty: () => ({ version: 1, games: [] }),
    merge: (lib, rec) => { lib = lib || RE.lib.empty(); const i = lib.games.findIndex(g => g.id && g.id === rec.id); if (i >= 0) lib.games[i] = rec; else lib.games.push(rec); return lib; },
    advice: (lib, platform) => {
        const gs = (lib.games || []).filter(g => g.regions && (!platform || g.platform === platform)); if (!gs.length) return null;
        const m = k => { const v = gs.map(g => g[k]).filter(x => x != null); return v.length ? r3(median(v)) : null; };
        const sp = gs.map(g => g.sprite).filter(Boolean), sh = gs.map(g => g.shading).filter(Boolean), mp = gs.map(g => g.maps).filter(Boolean), s = (a, k) => { const v = a.map(x => x[k]).filter(x => x != null); return v.length ? r2(median(v)) : null; };
        const A = { platform, games: gs.length, tileReuse: m('tileReuse'), flipReuse: m('flipReuse'), symmetric: m('symmetric'), colorsPerTile: m('colorsPerTile'), dither: m('dither'),
            spriteFrameTiles: sp.length ? s(sp, 'frameTiles') : null, spriteFrameChange: sp.length ? s(sp, 'frameChange') : null, spriteSheetTiles: sp.length ? s(sp, 'medianTiles') : null,
            mapFlipRate: mp.length ? s(mp, 'flipRate') : null, mapPaletteBanks: mp.length ? s(mp, 'paletteBanks') : null, mapTilesUsed: mp.length ? s(mp, 'tilesUsed') : null,
            ramps: sh.length ? s(sh, 'ramps') : null, rampLen: sh.length ? s(sh, 'rampLen') : null, hueShift: sh.length ? s(sh, 'hueShift') : null, outline: sh.length ? s(sh, 'outline') : null, colors: sh.length ? s(sh, 'colors') : null };
        A.lines = []; const pn = (G.CONSOLES[platform] || {}).name || platform || 'all consoles', add = t => A.lines.push(t);
        add(`From ${gs.length} ${pn} game${gs.length > 1 ? 's' : ''}:`);
        if (A.tileReuse != null) add(`Plan for about ${Math.round(A.tileReuse * 100)}% tile reuse in a sheet${A.flipReuse > 0.02 ? ` and use mirroring for another ${Math.round(A.flipReuse * 100)}%` : ''}.`);
        if (A.spriteFrameTiles) add(`Sprite animation frames are usually around ${A.spriteFrameTiles} tiles, with about ${Math.round((A.spriteFrameChange || 0) * 100)}% of pixels changing per frame.`);
        if (A.colorsPerTile) add(`Keep tiles to about ${Math.round(A.colorsPerTile)} colours each.`);
        if (A.rampLen) add(`Shade in ramps of about ${Math.round(A.rampLen)} steps${A.hueShift != null ? ` with a ${A.hueShift}° hue shift` : ''}.`);
        if (A.mapPaletteBanks) add(`Background maps use about ${A.mapPaletteBanks} palette banks.`);
        return A;
    },
    /* turn the advice into settings for NRGfx.upgrade() so new art follows what real games do on this console */
    styleFor: (adv, base) => { const st = Object.assign({}, G.STYLES[base || 'shaded']); if (!adv) return st; if (adv.rampLen) st.ramp = clamp(Math.round(adv.rampLen), 3, 6); if (adv.hueShift != null) st.hueShift = clamp(adv.hueShift, 4, 30); if (adv.dither != null && adv.dither > 0.04) st.dither = true; if (adv.colors) st.budget = clamp(Math.round(adv.colors), 4, 255); return st; },
};
RE.version = '1.0';
if (typeof module !== 'undefined') module.exports = RE; else root.NRRE = RE;
})(typeof self !== 'undefined' ? self : this);

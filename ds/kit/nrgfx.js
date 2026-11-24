/* NOTAREAL Graphics Lab (offline): learn how real games draw, then use it to improve your own art.
 *  scanRom()  reads tiles, palettes, textures and 3D model stats out of a ROM (DS, GBA, GB/GBC, SNES, N64, PSX) and measures HOW
 *             the art is built: shade steps per colour, hue shifting, outlines, dithering, colour budgets, light direction, texture sizes.
 *             Only numbers are stored. No pixels from a scanned game are kept in the database or copied into your games.
 *  profile()  measures any sprite/texture (yours too) with the same yardstick, including a "blockiness" score.
 *  upgrade()  turns a flat, blocky sprite into shaded art: ramps with hue shift, rounded lighting, selective outline, cleanup, console colour budget.
 *  texture()  makes tileable textures (brick, wood, stone, canvas mat, skin...) sized and coloured for PlayStation / N64 limits.
 *  rules()    turns the database into plain-language graphic design techniques for the Technique Library. */
(function (root) {
'use strict';
const G = {};
const u16 = (d, o) => d[o] | d[o + 1] << 8, u32 = (d, o) => (d[o] | d[o + 1] << 8 | d[o + 2] << 16 | d[o + 3] << 24) >>> 0;
const be16 = (d, o) => d[o] << 8 | d[o + 1], be32 = (d, o) => (d[o] << 24 | d[o + 1] << 16 | d[o + 2] << 8 | d[o + 3]) >>> 0;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

/* ------------------------------------------------------------------ colour helpers */
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
}
function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360; if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
const hueDelta = (a, b) => { let d = ((b - a) % 360 + 540) % 360 - 180; return d; };   // signed shortest path a -> b
const c555 = w => [(w & 31) * 255 / 31 | 0, (w >> 5 & 31) * 255 / 31 | 0, (w >> 10 & 31) * 255 / 31 | 0];
G.rgb2hsl = rgb2hsl; G.hsl2rgb = hsl2rgb;

/* ------------------------------------------------------------------ ramps: group colours into shade families */
G.ramps = colors => {      // colors: [[r,g,b,count]]; shade families = chains of colours with near hue/saturation that step up in brightness
    const items = colors.map(c => { const [h, s, l] = rgb2hsl(c[0], c[1], c[2]); return { c, h, s, l, y: lum(c[0], c[1], c[2]), gray: s <= 0.16 || l <= 0.05 || l >= 0.97 }; }).sort((a, b) => a.y - b.y);
    const chains = [];
    for (const o of items) {
        let best = null, bd = 1e9;
        for (const ch of chains) {
            const last = ch.items[ch.items.length - 1], gap = o.y - last.y; if (ch.gray !== o.gray || gap < 6 || gap > 80) continue;
            const hd = o.gray ? 0 : Math.abs(hueDelta(last.h, o.h)), sd = Math.abs(o.s - last.s);
            if (hd > 16 || sd > 0.3) continue; const sc = hd / 16 + sd + gap / 200; if (sc < bd) { bd = sc; best = ch; }
        }
        if (best) best.items.push(o); else chains.push({ gray: o.gray, items: [o] });
    }
    const out = [];
    for (const ch of chains) {
        const it = ch.items; if (it.length < 2) continue; const lo = it[0], hi = it[it.length - 1];
        out.push({ gray: ch.gray, hue: mean(it.map(o => o.h)), sat: mean(it.map(o => o.s)), steps: it.map(o => o.c), shift: !ch.gray && it.length >= 3 ? hueDelta(lo.h, hi.h) : null, satShift: it.length >= 3 ? hi.s - lo.s : null });
    }
    return out;
};

/* ------------------------------------------------------------------ profile: measure how an image is drawn */
G.profile = (img, opts = {}) => {   // opts.sheet: a sheet of many tiles, so a light direction is meaningless
    const w = img.w, h = img.h, d = img.data, N = w * h;
    const op = new Uint8Array(N); let n = 0; const counts = new Map();
    for (let i = 0; i < N; i++) if (d[i * 4 + 3] > 127) { op[i] = 1; n++; const k = d[i * 4] << 16 | d[i * 4 + 1] << 8 | d[i * 4 + 2]; counts.set(k, (counts.get(k) || 0) + 1); }
    if (n < 4) return null;
    const col = i => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]], key = i => d[i * 4] << 16 | d[i * 4 + 1] << 8 | d[i * 4 + 2];
    const Y = new Float32Array(N); for (let i = 0; i < N; i++) Y[i] = lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    // flatness + smoothness over neighbouring opaque pairs, dither over 2x2 windows
    let pairs = 0, same = 0, dsum = 0, win = 0, chk = 0, hasTrans = false;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!op[i]) { hasTrans = true; continue; }
        if (x + 1 < w && op[i + 1]) { pairs++; const k0 = key(i), k1 = key(i + 1); if (k0 === k1) same++; else dsum += Math.hypot(d[i * 4] - d[i * 4 + 4], d[i * 4 + 1] - d[i * 4 + 5], d[i * 4 + 2] - d[i * 4 + 6]) / 441; }
        if (y + 1 < h && op[i + w]) { pairs++; const k0 = key(i), k1 = key(i + w); if (k0 === k1) same++; else dsum += Math.hypot(d[i * 4] - d[(i + w) * 4], d[i * 4 + 1] - d[(i + w) * 4 + 1], d[i * 4 + 2] - d[(i + w) * 4 + 2]) / 441; }
        if (x + 1 < w && y + 1 < h && op[i + 1] && op[i + w] && op[i + w + 1]) { win++; const a = key(i), b = key(i + 1), c = key(i + w), e = key(i + w + 1); if (a === e && b === c && a !== b) chk++; }
    }
    // edge / outline
    let edge = 0, edgeY = 0, intY = 0, intN = 0, dark = 0; const edgeCols = new Map();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!op[i]) continue;
        const e = (x > 0 && !op[i - 1]) || (x + 1 < w && !op[i + 1]) || (y > 0 && !op[i - w]) || (y + 1 < h && !op[i + w]);
        if (e) { edge++; edgeY += Y[i]; const k = key(i); edgeCols.set(k, (edgeCols.get(k) || 0) + 1); } else { intN++; intY += Y[i]; }
    }
    const meanInt = intN ? intY / intN : null, meanEdge = edge ? edgeY / edge : null;
    let outline = null, outlineKind = null;
    if (edge >= 6 && intN) {
        let dark = 0, cnt = 0; const dcols = new Map();
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!op[i]) continue;
            const isE = j => op[j] && ((j % w > 0 && !op[j - 1]) || (j % w < w - 1 && !op[j + 1]) || (j >= w && !op[j - w]) || (j + w < N && !op[j + w]));
            if (!isE(i)) continue; let nb = -1; for (const j of [i - 1, i + 1, i - w, i + w]) { if (j < 0 || j >= N || (j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue; if (op[j] && !isE(j)) { nb = j; break; } }
            if (nb < 0) continue; cnt++; if (Y[i] < Y[nb] - 14) { dark++; const k = key(i); dcols.set(k, (dcols.get(k) || 0) + 1); } }
        if (cnt >= 4) { outline = dark / cnt; const top2 = [...dcols.values()].sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0) / Math.max(1, dark); outlineKind = outline < 0.35 ? 'none' : top2 > 0.75 ? 'uniform dark outline' : 'selective outline (colour varies with the shape)'; }
    }
    // ramps from colours that cover at least ~0.3% of the opaque pixels
    const minCount = Math.max(2, n * 0.003), cols = [];
    for (const [k, c] of counts) if (c >= minCount) cols.push([k >> 16, k >> 8 & 255, k & 255, c]);
    const rr = G.ramps(cols), lens = rr.map(r => r.steps.length), shifts = rr.filter(r => r.shift != null).map(r => r.shift);
    // light direction: brightness steps inside a material (small steps only) lean one way when there is a light source
    let sdx = 0, adx = 0, sdy = 0, ady = 0, nst = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!op[i]) continue;
        if (x + 1 < w && op[i + 1]) { const dd = Y[i + 1] - Y[i]; if (Math.abs(dd) >= 3 && Math.abs(dd) < 48) { sdx += dd; adx += Math.abs(dd); nst++; } }
        if (y + 1 < h && op[i + w]) { const dd = Y[i + w] - Y[i]; if (Math.abs(dd) >= 3 && Math.abs(dd) < 48) { sdy += dd; ady += Math.abs(dd); nst++; } } }
    const cx = adx ? sdx / adx : 0, cy = ady ? sdy / ady : 0, strength = nst >= 6 ? Math.hypot(cx, cy) : 0;
    const light = opts.sheet ? null : strength < 0.2 ? 'flat (no clear light direction)' : (Math.abs(cy) > Math.abs(cx) * 0.5 ? (cy < 0 ? 'top' : 'bottom') : '') + (Math.abs(cx) > Math.abs(cy) * 0.5 ? (cx < 0 ? '-left' : '-right') : '');
    const ys = []; for (let i = 0; i < N; i++) if (op[i]) ys.push(Y[i]); ys.sort((a, b) => a - b);
    const lumRange = ys[Math.floor(ys.length * 0.95)] - ys[Math.floor(ys.length * 0.05)];
    let satSum = 0; for (const [k, c] of counts) satSum += rgb2hsl(k >> 16, k >> 8 & 255, k & 255)[1] * c;
    const flat = pairs ? same / pairs : 1, avgRamp = lens.length ? mean(lens) : 1;
    const outlineScore = outline == null ? 0.5 : clamp(outline * 1.5, 0, 1);
    const blockiness = Math.round(100 * (0.35 * flat + 0.25 * (1 - clamp(avgRamp / 4, 0, 1)) + 0.2 * (1 - clamp(lumRange / 150, 0, 1)) + 0.2 * (1 - outlineScore)));
    return {
        pixels: n, colors: counts.size, flat: +flat.toFixed(3), smooth: +(pairs ? dsum / pairs : 0).toFixed(3), dither: +(win ? chk / win : 0).toFixed(4),
        outline: outline == null ? null : +outline.toFixed(3), outlineKind, ramps: rr.length, rampLen: +avgRamp.toFixed(2), hueShift: shifts.length ? Math.round(median(shifts)) : null,
        sat: +(satSum / n).toFixed(3), lumRange: Math.round(lumRange), light, lightStrength: +strength.toFixed(2), blockiness, hasAlpha: hasTrans,
    };
};
/* Combine several profiles (weighted by pixels) into one summary */
G.mergeProfiles = list => {
    list = list.filter(Boolean); if (!list.length) return null; const W = list.reduce((a, p) => a + p.pixels, 0);
    const wavg = k => { const v = list.filter(p => p[k] != null); const w = v.reduce((a, p) => a + p.pixels, 0); return w ? v.reduce((a, p) => a + p[k] * p.pixels, 0) / w : null; };
    const sh = list.filter(p => p.hueShift != null).map(p => p.hueShift);
    const lights = {}; for (const p of list) if (p.light) lights[p.light] = (lights[p.light] || 0) + p.pixels;
    const r = x => x == null ? null : +x.toFixed(3);
    return { pixels: W, images: list.length, colors: Math.round(median(list.map(p => p.colors))), flat: r(wavg('flat')), smooth: r(wavg('smooth')), dither: r(wavg('dither')), outline: r(wavg('outline')), ramps: +wavg('ramps').toFixed(1), rampLen: +wavg('rampLen').toFixed(2),
        hueShift: sh.length ? Math.round(median(sh)) : null, sat: r(wavg('sat')), lumRange: Math.round(wavg('lumRange')), light: Object.keys(lights).length ? Object.entries(lights).sort((a, b) => b[1] - a[1])[0][0] : null, blockiness: Math.round(wavg('blockiness')) };
};

/* ------------------------------------------------------------------ tile decoding */
const FMT = {
    gb2: { bytes: 16, dec: (d, o, out) => { for (let y = 0; y < 8; y++) { const lo = d[o + y * 2], hi = d[o + y * 2 + 1]; for (let x = 0; x < 8; x++) out[y * 8 + x] = ((hi >> (7 - x)) & 1) << 1 | ((lo >> (7 - x)) & 1); } }, colors: 4 },
    snes4: { bytes: 32, dec: (d, o, out) => { for (let y = 0; y < 8; y++) { const a = d[o + y * 2], b = d[o + y * 2 + 1], c = d[o + 16 + y * 2], e = d[o + 17 + y * 2]; for (let x = 0; x < 8; x++) { const s = 7 - x; out[y * 8 + x] = (a >> s & 1) | (b >> s & 1) << 1 | (c >> s & 1) << 2 | (e >> s & 1) << 3; } } }, colors: 16 },
    lin4: { bytes: 32, dec: (d, o, out) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x += 2) { const v = d[o + y * 4 + (x >> 1)]; out[y * 8 + x] = v & 15; out[y * 8 + x + 1] = v >> 4; } }, colors: 16 },
    lin8: { bytes: 64, dec: (d, o, out) => { for (let i = 0; i < 64; i++) out[i] = d[o + i]; }, colors: 256 },
};
/* How "picture-like" is a run of tiles: neighbouring pixels agree far more often than in code, text, music or compressed data */
function tileScore(d, o, fmt, count, tmp) {
    let hq = 0, hn = 0, vq = 0, vn = 0, zero = 0, tot = 0, iso = 0, dq = 0, dn = 0, cols = 0; const seen = new Set();
    for (let t = 0; t < count; t++) {
        fmt.dec(d, o + t * fmt.bytes, tmp); let h = 0, mask = 0;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            const v = tmp[y * 8 + x]; h = (h * 31 + v) | 0; mask |= 1 << (v & 31); if (v === 0) zero++; tot++;
            if (x < 7) { hn++; if (tmp[y * 8 + x + 1] === v) hq++; } if (y < 7) { vn++; if (tmp[y * 8 + 8 + x] === v) vq++; } if (x < 7 && y < 7) { dn++; if (tmp[y * 8 + 9 + x] === v) dq++; }
            if (x > 0 && x < 7 && y > 0 && y < 7 && tmp[y * 8 + x - 1] !== v && tmp[y * 8 + x + 1] !== v && tmp[y * 8 + x - 8] !== v && tmp[y * 8 + x + 8] !== v) iso++;
        }
        seen.add(h); let c = 0; for (let m = mask; m; m &= m - 1) c++; cols += c;
    }
    const eq = (hq + vq) / (hn + vn), ratio = (hq / hn) / Math.max(0.001, vq / vn);
    return { eq, zero: zero / tot, uniq: seen.size / count, ratio, iso: iso / (count * 36), diag: dq / dn / Math.max(0.01, eq), colors: cols / count };
}
G._tileScore = tileScore; G._FMT = FMT;
function findTileRegions(d, start, end, fmt, o = {}) {
    const WIN = o.win || 64, stride = o.stride || fmt.bytes * 8, tmp = new Uint8Array(64), regions = []; let run = null;
    const minEq = o.minEq || (fmt.colors === 4 ? 0.55 : 0.42), t0 = Date.now();
    for (let p = start; p + WIN * fmt.bytes <= end; p += stride) {
        if ((p & 0xFFFF) === 0 && Date.now() - t0 > (o.maxMs || 5000)) break;
        let blank = true; for (let k = 0; k < 64; k++) if (d[p + k * (fmt.bytes >> 1)] !== d[p]) { blank = false; break; }
        let ok = false;
        if (!blank) { const s = tileScore(d, p, fmt, WIN, tmp); ok = s.eq >= minEq && s.eq <= 0.985 && s.zero < 0.93 && s.uniq > 0.3 && s.ratio > 0.5 && s.ratio < 2 && s.iso < (fmt.colors === 4 ? 0.12 : 0.09) && s.diag > 0.55 && s.colors < (fmt.colors === 4 ? 3.9 : 9.5); }
        if (ok) { if (run && p <= run.end) run.end = p + WIN * fmt.bytes; else { run = { start: p, end: p + WIN * fmt.bytes }; regions.push(run); } } else if (run && p > run.end) run = null;
    }
    return regions.filter(r => r.end - r.start >= WIN * fmt.bytes);
}

/* ------------------------------------------------------------------ palette finding (15-bit colour, SNES / GBA / DS / GBC) */
function findPalettes(d, start, end, n, o = {}) {
    const out = [], step = o.step || 2, t0 = Date.now();
    for (let p = start; p + n * 2 <= end; p += step) {
        if ((p & 0xFFFFF) === 0 && Date.now() - t0 > (o.maxMs || 4000)) break;
        let bad = false, zeros = 0; for (let k = 0; k < n; k++) { const w = u16(d, p + k * 2); if (w & 0x8000) { bad = true; break; } if (!w) zeros++; }
        if (bad || zeros > n / 2) continue;
        const cs = [], ws = new Set(); for (let k = 0; k < n; k++) { const w = u16(d, p + k * 2); ws.add(w); cs.push(c555(w)); }
        if (ws.size < Math.max(4, n * 0.6)) continue;
        let seq = 0, adj = 0, rnd = 0, rn = 0; for (let k = 1; k < n; k++) { const a = u16(d, p + k * 2 - 2), b = u16(d, p + k * 2); if (Math.abs(a - b) < 4) seq++; adj += Math.hypot(cs[k][0] - cs[k - 1][0], cs[k][1] - cs[k - 1][1], cs[k][2] - cs[k - 1][2]); }
        if (seq > n * 0.5) continue;
        for (let a = 0; a < n; a++) for (let b = a + 2; b < n; b += 3) { rnd += Math.hypot(cs[a][0] - cs[b][0], cs[a][1] - cs[b][1], cs[a][2] - cs[b][2]); rn++; }
        const ys = cs.map(c => lum(c[0], c[1], c[2])), spread = Math.max(...ys) - Math.min(...ys);
        const R = new Set(cs.map(c => c[0])), Gs = new Set(cs.map(c => c[1])), B = new Set(cs.map(c => c[2]));
        if (spread < 40 || R.size < 3 || Gs.size < 3 || B.size < 3) continue;
        if ((adj / (n - 1)) > 0.62 * (rnd / rn)) continue;       // colours should group into families (ramps), unlike tables of numbers
        out.push({ off: p, colors: cs }); p += n * 2 - step;
    }
    return out;
}
function paletteStats(pals) {
    const profs = [];
    for (const p of pals) { const cols = p.colors.filter((c, i) => !(i === 0 && c[0] + c[1] + c[2] === 0)).map(c => [c[0], c[1], c[2], 1]); const rr = G.ramps(cols); const sh = rr.filter(r => r.shift != null).map(r => r.shift); const ys = cols.map(c => lum(c[0], c[1], c[2])); profs.push({ ramps: rr.length, rampLen: rr.length ? mean(rr.map(r => r.steps.length)) : 1, shift: sh.length ? median(sh) : null, sat: mean(cols.map(c => rgb2hsl(c[0], c[1], c[2])[1])), range: Math.max(...ys) - Math.min(...ys), colors: new Set(cols.map(c => c.join())).size }); }
    if (!profs.length) return null; const sh = profs.filter(p => p.shift != null).map(p => p.shift);
    return { count: profs.length, colors: Math.round(median(profs.map(p => p.colors))), ramps: +mean(profs.map(p => p.ramps)).toFixed(1), rampLen: +mean(profs.map(p => p.rampLen)).toFixed(2), hueShift: sh.length ? Math.round(median(sh)) : null, sat: +mean(profs.map(p => p.sat)).toFixed(3), lumRange: Math.round(mean(profs.map(p => p.range))) };
}

/* ------------------------------------------------------------------ render tile regions into small preview sheets */
function renderTiles(d, region, fmt, pal, cols = 16, maxTiles = 256) {
    const total = Math.min(maxTiles, Math.floor((region.end - region.start) / fmt.bytes)), rows = Math.ceil(total / cols), w = cols * 8, h = rows * 8, data = new Uint8ClampedArray(w * h * 4), tmp = new Uint8Array(64);
    const gray = [[0, 0, 0], [96, 96, 96], [176, 176, 176], [248, 248, 248]];
    for (let t = 0; t < total; t++) {
        fmt.dec(d, region.start + t * fmt.bytes, tmp); const bx = (t % cols) * 8, by = Math.floor(t / cols) * 8;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = tmp[y * 8 + x], i = ((by + y) * w + bx + x) * 4; if (!v && fmt.colors > 4) continue; const c = pal ? (pal[v % pal.length] || [0, 0, 0]) : gray[v & 3]; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255; }
    }
    return { w, h, data };
}
/* Pick the palette that makes this region look like a picture: neighbouring pixels should land on similar colours */
function bestPalette(d, r, fmt, pals) {
    if (!pals.length) return null; const nT = Math.min(128, Math.floor((r.end - r.start) / fmt.bytes)), tmp = new Uint8Array(64), K = Math.min(16, fmt.colors), M = new Float64Array(K * K);
    for (let t = 0; t < nT; t++) { fmt.dec(d, r.start + t * fmt.bytes, tmp); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const a = tmp[y * 8 + x] & 15; if (x < 7) { const b = tmp[y * 8 + x + 1] & 15; if (a !== b) M[a * K + b]++; } if (y < 7) { const b = tmp[y * 8 + 8 + x] & 15; if (a !== b) M[a * K + b]++; } } }
    const F = new Float64Array(K); let FT = 0, MT = 0; for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) { F[a] += M[a * K + b]; F[b] += M[a * K + b]; MT += M[a * K + b]; } for (let a = 0; a < K; a++) FT += F[a];
    if (!MT) return pals[0];
    let best = null, bc = 1e18; const step = Math.max(1, Math.floor(pals.length / 3000));
    for (let pi = 0; pi < pals.length; pi += step) {
        const P = pals[pi].colors; if (P.length < K) continue; let c = 0, base = 0;
        for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) { const dd = Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1], P[a][2] - P[b][2]); if (M[a * K + b]) c += M[a * K + b] * dd; base += F[a] * F[b] / FT * dd; }
        if (base < 40) continue; const sc = (c / MT) / (base / FT * 1) ; if (sc < bc) { bc = sc; best = pals[pi]; }
    }
    return best;
}
function nearestPalette(pals, off) { let best = null, bd = 1 << 30; for (const p of pals) { const dd = Math.abs(p.off - off); if (dd < bd) { bd = dd; best = p; } } return best; }
function tileStats(d, regions, fmt) {      // index-only statistics (no palette needed)
    const tmp = new Uint8Array(64); let flat = 0, fn = 0, chk = 0, cn = 0, tiles = 0, colorsPer = 0; const uniq = new Set(); let totalTiles = 0, fill = 0;
    for (const r of regions) { const nT = Math.min(512, Math.floor((r.end - r.start) / fmt.bytes)); for (let t = 0; t < nT; t++) {
        fmt.dec(d, r.start + t * fmt.bytes, tmp); totalTiles++; let hh = 0; const cs = new Set(); let nz = 0;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = tmp[y * 8 + x]; hh = (hh * 31 + v) | 0; if (v) { nz++; cs.add(v); } if (x < 7) { fn++; if (tmp[y * 8 + x + 1] === v) flat++; } if (y < 7) { fn++; if (tmp[y * 8 + 8 + x] === v) flat++; } if (x < 7 && y < 7) { cn++; if (v === tmp[y * 8 + 9 + x] && tmp[y * 8 + x + 1] === tmp[y * 8 + 8 + x] && v !== tmp[y * 8 + x + 1]) chk++; } }
        if (!uniq.has(hh)) { uniq.add(hh); colorsPer += cs.size; } fill += nz / 64; } }
    if (!totalTiles) return null;
    return { tiles: totalTiles, unique: uniq.size, reuse: +(1 - uniq.size / totalTiles).toFixed(3), flat: +(flat / fn).toFixed(3), dither: +(chk / cn).toFixed(4), colorsPerTile: +(colorsPer / Math.max(1, uniq.size)).toFixed(1), fill: +(fill / totalTiles).toFixed(2) };
}

/* ------------------------------------------------------------------ per-console scanners */
function scanTiled(d, fmt, pfx, R, maxMs) {
    const end = d.length, big = end > (12 << 20);
    const regions = findTileRegions(d, 0, Math.min(end, 48 << 20), fmt, { stride: big ? fmt.bytes * 128 : fmt.bytes * 8, maxMs });
    let pals = fmt.colors === 4 || !regions.length ? [] : findPalettes(d, 0, Math.min(end, 48 << 20), 16, { step: big ? 32 : 2, maxMs });
    pals = pals.filter(p => regions.some(r => p.off > r.start - 0x20000 && p.off < r.end + 0x20000));     // palettes live near their pictures; far-away matches are mostly code and tables
    return { regions, pals };
}
function scanNDS(d, R, maxMs) {
    const files = R.files || [], tiles = [], pals = [];
    const handle = (buf, off, name) => {
        const m = String.fromCharCode(d[off], d[off + 1], d[off + 2], d[off + 3]);
        if (m === 'RGCN') { let p = off + 16; for (let k = 0; k < 3 && p + 32 < d.length; k++) { if (String.fromCharCode(d[p], d[p + 1], d[p + 2], d[p + 3]) === 'RAHC') { const depth = u32(d, p + 12), size = u32(d, p + 24), th = u16(d, p + 8), tw = u16(d, p + 10); tiles.push({ off: p + 32, size: Math.min(size, d.length - p - 32), bpp: depth === 3 ? 4 : 8, name, w: tw, h: th }); break; } p += u32(d, p + 4); } }
        else if (m === 'RLCN') { let p = off + 16; for (let k = 0; k < 3 && p + 24 < d.length; k++) { if (String.fromCharCode(d[p], d[p + 1], d[p + 2], d[p + 3]) === 'TTLP') { const depth = u32(d, p + 8), size = Math.min(u32(d, p + 16), 512 * 2); const cols = []; for (let i = 0; i < size / 2; i++) cols.push(c555(u16(d, p + 24 + i * 2) & 0x7FFF)); pals.push({ off: p + 24, colors: cols, bpp: depth === 3 ? 4 : 8, name }); break; } p += u32(d, p + 4); } }
    };
    for (const f of files) {
        if (f.fmt === 'RGCN' || f.fmt === 'RLCN') handle(d, f.off, f.path);
        else if (f.fmt === 'NARC' && f.size > 64) {      // look inside packed folders
            try { const o = f.off, btaf = o + u16(d, o + 12); if (String.fromCharCode(d[btaf], d[btaf + 1], d[btaf + 2], d[btaf + 3]) !== 'BTAF') continue; const cnt = u32(d, btaf + 8); const btnf = btaf + u32(d, btaf + 4); const gmif = btnf + u32(d, btnf + 4); for (let i = 0; i < Math.min(cnt, 4000); i++) { const s = u32(d, btaf + 12 + i * 8), e = u32(d, btaf + 16 + i * 8); const so = gmif + 8 + s; if (e - s > 40 && so + 4 < d.length) handle(d, so, f.path + '#' + i); } } catch (e) {}
        }
    }
    return { tiles, pals };
}
function scanPSX(R, iso, cooked) {
    const tims = [], tmds = [];
    const scan = (b, base) => {
        for (let o = 0; o + 20 < b.length; o += 4) {
            if (b[o] === 0x10 && b[o + 1] === 0 && b[o + 2] === 0 && b[o + 3] === 0) {
                const fl = u32(b, o + 4); if ((fl & ~0xF) !== 0 || (fl & 3) === 3 && false) continue; const bpp = [4, 8, 16, 24][fl & 3]; if ((fl & 3) > 3) continue;
                let p = o + 8, clut = null; if (fl & 8) { const bn = u32(b, p); if (bn > 0x20000 || bn < 12) continue; const cw = u16(b, p + 8), ch = u16(b, p + 10); if (cw * ch * 2 + 12 !== bn || cw > 256 || ch > 64) continue; clut = { w: cw, h: ch, off: p + 12 }; p += bn; }
                if (p + 12 > b.length) continue; const bn = u32(b, p), iw = u16(b, p + 8), ih = u16(b, p + 10); if (bn < 12 || bn > 0x400000 || iw * ih * 2 + 12 !== bn) continue;
                const pw = iw * (bpp === 4 ? 4 : bpp === 8 ? 2 : bpp === 16 ? 1 : 2 / 3); if (pw < 4 || pw > 1024 || ih < 4 || ih > 512) continue;
                tims.push({ off: base + o, bpp, w: Math.round(pw), h: ih, clut, dataOff: p + 12, buf: b }); o = p + bn - 4;
            } else if (b[o] === 0x41 && b[o + 1] === 0 && b[o + 2] === 0 && b[o + 3] === 0 && (b[o + 4] === 0 || b[o + 4] === 1) && b[o + 5] === 0 && b[o + 6] === 0 && b[o + 7] === 0 && b[o + 8] > 0 && b[o + 8] <= 40 && b[o + 9] === 0 && b[o + 10] === 0 && b[o + 11] === 0) {
                const nobj = u32(b, o + 8); let prims = 0, verts = 0, good = true;
                for (let k = 0; k < nobj; k++) {
                    const e = o + 12 + k * 28; if (e + 28 > b.length) { good = false; break; }
                    const vt = u32(b, e), nv = u32(b, e + 4), nt = u32(b, e + 8), nn = u32(b, e + 12), pt = u32(b, e + 16), np = u32(b, e + 20), sc = u32(b, e + 24) | 0;
                    if (nv < 3 || np < 1 || nv > 8000 || np > 8000 || vt < nobj * 28 || vt > 0x300000 || pt < nobj * 28 || pt > 0x300000 || nt > 0x300000 || nn > 8000 || Math.abs(sc) > 12 || (vt & 3) || (pt & 3)) { good = false; break; }
                    verts += nv; prims += np;
                }
                if (good) tmds.push({ off: base + o, objects: nobj, prims, verts });
            }
        }
    };
    scan(cooked, 0);
    return { tims, tmds };
}
function timToRGBA(t) {
    const b = t.buf, w = t.w, h = t.h, data = new Uint8ClampedArray(w * h * 4), P = t.clut ? [] : null;
    if (t.clut) for (let i = 0; i < t.clut.w * t.clut.h; i++) { const v = u16(b, t.clut.off + i * 2); P.push([(v & 31) * 255 / 31 | 0, (v >> 5 & 31) * 255 / 31 | 0, (v >> 10 & 31) * 255 / 31 | 0, v === 0 ? 0 : 255]); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let c;
        if (t.bpp === 4) { const v = b[t.dataOff + (y * w + x >> 1)]; c = P ? P[(x & 1 ? v >> 4 : v & 15) % P.length] : null; }
        else if (t.bpp === 8) { c = P ? P[b[t.dataOff + y * w + x] % P.length] : null; }
        else if (t.bpp === 16) { const v = u16(b, t.dataOff + (y * w + x) * 2); c = [(v & 31) * 255 / 31 | 0, (v >> 5 & 31) * 255 / 31 | 0, (v >> 10 & 31) * 255 / 31 | 0, v === 0 ? 0 : 255]; }
        else { const o = t.dataOff + (y * w + x) * 3; c = [b[o], b[o + 1], b[o + 2], 255]; }
        if (!c) c = [0, 0, 0, 0]; const i = (y * w + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = c[3];
    }
    return { w, h, data };
}
/* N64: ROMs rarely label textures, so look for runs of 16-bit RGBA that are smooth the way a picture is. */
function scanN64(d, maxMs) {
    const out = [], WIN = 2048, t0 = Date.now(); let run = null;
    const lim = Math.min(d.length, 40 << 20);
    for (let p = 0x1000; p + WIN <= lim; p += 512) {
        if ((p & 0xFFFFF) === 0 && Date.now() - t0 > maxMs) break;
        let dsum = 0, uniq = new Set(), n = 0, bad = 0;
        for (let k = 0; k < WIN - 64; k += 2) { const a = be16(d, p + k), b = be16(d, p + k + 2); uniq.add(a); if (k % 64 < 62) { n++; const dr = (a >> 11) - (b >> 11), dg = (a >> 6 & 31) - (b >> 6 & 31), db = (a >> 1 & 31) - (b >> 1 & 31); dsum += Math.abs(dr) + Math.abs(dg) + Math.abs(db); } if ((a & 1) === 0 && a) bad++; }
        const avg = dsum / n, ok = avg < 7 && uniq.size > 24 && uniq.size < 900 && bad < 300;
        if (ok) { if (run && p <= run.end) run.end = p + WIN; else { run = { start: p, end: p + WIN }; out.push(run); } } else if (run && p > run.end) run = null;
    }
    return out.filter(r => r.end - r.start >= 4096);
}
function n64Render(d, r, w = 32) {
    const nPix = Math.min(32 * 64 * 4, (r.end - r.start) >> 1), h = Math.floor(nPix / w), data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { const v = be16(d, r.start + i * 2); data[i * 4] = (v >> 11) * 255 / 31 | 0; data[i * 4 + 1] = (v >> 6 & 31) * 255 / 31 | 0; data[i * 4 + 2] = (v >> 1 & 31) * 255 / 31 | 0; data[i * 4 + 3] = 255; }
    return { w, h, data };
}

/* ------------------------------------------------------------------ main entry: scan a ROM for graphics facts */
G._scanRaw = (d, plat, R = {}, opts = {}) => {
    const maxMs = opts.maxMs || 5000, t0 = Date.now(), previews = [], F = { platform: plat, sources: [] };
    const addPreview = (label, img) => { if (previews.length < 6 && img && img.w && img.h) previews.push({ label, w: img.w, h: img.h, data: img.data }); };
    let spriteProfiles = [], pstats = null;
    try {
        if (plat === 'gb' || plat === 'gbc' || plat === 'snes' || plat === 'gba' || plat === 'nds') {
            let regs = [], pals = [], fmt = plat === 'gb' || plat === 'gbc' ? FMT.gb2 : plat === 'snes' ? FMT.snes4 : FMT.lin4;
            if (plat === 'nds') {
                const nd = scanNDS(d, R, maxMs);
                if (nd.tiles.length) {
                    F.sources.push(`${nd.tiles.length} tile graphics files (NCGR) and ${nd.pals.length} palettes (NCLR)`);
                    regs = nd.tiles.filter(t => t.bpp === 4 && t.size >= 256).map(t => ({ start: t.off, end: t.off + t.size })); pals = nd.pals.filter(p => p.bpp === 4).map(p => ({ off: p.off, colors: p.colors.slice(0, 16) }));
                    const p8 = nd.pals.filter(p => p.bpp === 8); F.palette256 = p8.length;
                    F.tileFiles = { total: nd.tiles.length, bpp4: nd.tiles.filter(t => t.bpp === 4).length, bpp8: nd.tiles.filter(t => t.bpp === 8).length, medianKB: Math.round(median(nd.tiles.map(t => t.size)) / 1024) };
                    if (!pals.length) pals = nd.pals.map(p => ({ off: p.off, colors: p.colors.slice(0, 16) }));
                    if (!regs.length && nd.tiles.some(t => t.bpp === 8)) F.sources.push('tiles are 8-bit (256 colours per tile)');
                }
                if (!regs.length) { const s = scanTiled(d, fmt, 'nds', R, maxMs); regs = s.regions; pals = pals.length ? pals : s.pals; if (regs.length) F.sources.push('picture-like tile data found by pattern search'); }
            } else { const s = scanTiled(d, fmt, plat, R, maxMs); regs = s.regions; pals = s.pals; if (plat === 'gbc') { const gp = findPalettes(d, 0, Math.min(d.length, 8 << 20), 32, { step: 2, maxMs: 1500 }).filter(p => regs.some(r => p.off > r.start - 0x20000 && p.off < r.end + 0x20000)); pals = gp.map(p => ({ off: p.off, colors: p.colors.slice(0, 4) })); } if (regs.length) F.sources.push('picture-like tile data found by pattern search'); }
            F.tileRegions = regs.length; F.tileBytes = regs.reduce((a, r) => a + r.end - r.start, 0);
            const ts = tileStats(d, regs.slice(0, 200), fmt); if (ts) F.tiles = ts;
            if (pals.length) { F.palettes = paletteStats(pals); }
            if (plat === 'gb') F.shades = 4;
            // colour profile: render a handful of regions with the nearest palette
            const usable = regs.filter(r => r.end - r.start >= 1024).slice(0, 14);
            for (let i = 0; i < usable.length; i++) {
                const r = usable[Math.floor(i * usable.length / Math.min(14, usable.length))] || usable[i], pal = plat === 'gb' ? null : (bestPalette(d, r, fmt, pals) || nearestPalette(pals, r.start) || {}).colors;
                const img = renderTiles(d, r, fmt, plat === 'gb' ? null : pal, 16, 128); const p = G.profile(img, { sheet: true }); if (p) spriteProfiles.push(p); if (i < 3) addPreview(`${plat.toUpperCase()} tiles @0x${r.start.toString(16)} (estimated colours)`, img);
            }
        } else if (plat === 'psx' || plat === 'psxexe') {
            const cooked = opts.psxCooked || d; const s = scanPSX(R, null, cooked); const t = s.tims;
            if (t.length) {
                const sizes = {}; for (const x of t) { const k = x.w + 'x' + x.h; sizes[k] = (sizes[k] || 0) + 1; }
                F.textures = { count: t.length, bpp4: t.filter(x => x.bpp === 4).length, bpp8: t.filter(x => x.bpp === 8).length, bpp16: t.filter(x => x.bpp === 16).length, bpp24: t.filter(x => x.bpp === 24).length, medianW: median(t.map(x => x.w)), medianH: median(t.map(x => x.h)), commonSizes: Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ×${v}`), withPalette: t.filter(x => x.clut).length };
                F.sources.push(`${t.length} TIM images`);
                const pick = t.filter(x => x.w * x.h >= 256 && x.w * x.h <= 160000); const step = Math.max(1, Math.floor(pick.length / 24));
                for (let i = 0; i < pick.length && spriteProfiles.length < 24; i += step) { const img = timToRGBA(pick[i]); const p = G.profile(img, { sheet: false }); if (p) spriteProfiles.push(p); if (previews.length < 3 && img.w * img.h > 1200) addPreview(`PlayStation TIM ${img.w}×${img.h}`, img); }
            }
            if (s.tmds.length >= 2) { F.models = { count: s.tmds.length, medianPrims: median(s.tmds.map(m => m.prims)), maxPrims: Math.max(...s.tmds.map(m => m.prims)), medianVerts: median(s.tmds.map(m => m.verts)) }; F.sources.push(`${s.tmds.length} TMD 3D models`); }
        } else if (plat === 'n64') {
            const regs = scanN64(d, maxMs); F.textureRegions = regs.length; F.textureBytes = regs.reduce((a, r) => a + r.end - r.start, 0);
            if (regs.length) { F.sources.push(`${regs.length} picture-like 16-bit colour regions (estimated textures)`); const pick = regs.slice(0, 30); const step = Math.max(1, Math.floor(pick.length / 14)); for (let i = 0; i < pick.length; i += step) { const img = n64Render(d, pick[i]); const p = G.profile(img, { sheet: true }); if (p) spriteProfiles.push(p); if (previews.length < 3) addPreview(`N64 texture region @0x${pick[i].start.toString(16)} (32 wide RGBA16 guess)`, img); } }
            F.notes = ['N64 textures are usually compressed or palettised; the lab finds uncompressed RGBA16 runs only, so numbers are a lower bound.'];
        }
    } catch (e) { F.error = e.message; }
    if (spriteProfiles.length) F.art = G.mergeProfiles(spriteProfiles);
    F.ms = Date.now() - t0; F.previews = previews;
    return F;
};


G._int = { findTileRegions, findPalettes, renderTiles, bestPalette, tileStats, paletteStats, nearestPalette, c555 };
/* Look inside compressed streams too (LZ10/LZ11/RLE/Yaz0/MIO0/Huffman): decode what can be decoded, scan the result as one buffer. */
const DC = typeof NRDecomp !== 'undefined' ? NRDecomp : (typeof require !== 'undefined' ? (() => { try { return require('./nrdecomp.js'); } catch (e) { return null; } })() : null);
G.scanRom = (d, plat, R = {}, opts = {}) => {
    const F = G._scanRaw(d, plat, R, opts);
    if (!DC || opts.noDecomp || plat === 'psx' || plat === 'psxexe' || !F || F.error) return F;
    try {
        const t0 = Date.now(), found = DC.scan(d, { minOut: 1024, maxFound: 150, align: plat === 'snes' || plat === 'gb' || plat === 'gbc' ? 1 : 4 }).filter(x => x.size >= 1024);
        if (!found.length) return F;
        const parts = []; let tot = 0; for (const f of found) { if (tot + f.size > 12 << 20) break; parts.push(f); tot += f.size + 256; }
        const cat = new Uint8Array(tot); let o = 0; for (const f of parts) { cat.set(f.data, o); o += f.size + 256; }
        const sub = G._scanRaw(cat, plat, {}, { maxMs: 3000, noDecomp: true });
        const fm = {}; for (const f of parts) fm[f.fmt] = (fm[f.fmt] || 0) + 1;
        F.compressed = { streams: parts.length, bytes: parts.reduce((a, f) => a + f.size, 0), formats: fm, tileRegions: sub.tileRegions || 0, textureRegions: sub.textureRegions || 0 };
        if (sub.tileRegions || sub.textureRegions) {
            F.sources.push(`${parts.length} compressed streams (${Object.entries(fm).map(([k, v]) => v + ' ' + k).join(', ')}) opened; ${sub.tileRegions || sub.textureRegions} picture regions inside`);
            if (!F.art && sub.art) F.art = sub.art; if (!F.tiles && sub.tiles) F.tiles = sub.tiles; if (!F.palettes && sub.palettes) F.palettes = sub.palettes;
            for (const pv of sub.previews || []) if (F.previews.length < 6) F.previews.push(Object.assign({}, pv, { label: 'inside compressed data: ' + pv.label }));
        } else F.sources.push(`${parts.length} compressed streams opened, no pictures recognised inside`);
        F.ms += Date.now() - t0;
    } catch (e) { F.compressedError = e.message; }
    return F;
};

/* Plain-language findings (go into "uses" for the Technique Library) */
G.findings = F => {
    const U = []; if (!F) return U; const A = F.art, P = F.palettes, T = F.tiles, add = t => U.push({ area: 'Graphic design', text: t });
    if (F.textures) add(`${F.textures.count} textures: ${F.textures.bpp4} are 4-bit, ${F.textures.bpp8} 8-bit, ${F.textures.bpp16} 16-bit, ${F.textures.bpp24} 24-bit; typical size ${F.textures.medianW}×${F.textures.medianH}${F.textures.commonSizes.length ? ' (most common ' + F.textures.commonSizes.slice(0, 3).join(', ') + ')' : ''}. A good reference for how big to make your own.`);
    if (F.models) add(`3D models: typical ${F.models.medianPrims} polygons, biggest ${F.models.maxPrims} (typical ${F.models.medianVerts} vertices). Use as your polygon budget per object.`);
    if (F.compressed && F.compressed.streams) add(`${F.compressed.streams} compressed blocks (${Object.entries(F.compressed.formats).map(([k, v]) => v + ' ' + k).join(', ')}) were unpacked and scanned${F.compressed.tileRegions || F.compressed.textureRegions ? '; pictures were found inside, so these games keep much of their art compressed' : ''}.`);
    if (F.textureRegions) add(`About ${F.textureRegions} texture-like regions (${Math.round(F.textureBytes / 1024)} KB of uncompressed 16-bit colour) found.`);
    if (P) add(`Palettes (estimated from ${P.count} colour blocks near the pictures): a typical one uses ${P.colors} colours in about ${P.ramps} shade families of ${P.rampLen} steps${P.hueShift != null ? `; shadows shift ${P.hueShift > 0 ? '+' : ''}${P.hueShift}° in hue toward highlights` : ''}; saturation ${Math.round(P.sat * 100)}%, brightness spread ${P.lumRange}/255.`);
    if (T) add(`Tile art: ${T.tiles} tiles measured, ${Math.round(T.reuse * 100)}% repeats; ${Math.round(T.flat * 100)}% of neighbouring pixels are the same colour (${T.flat > 0.8 ? 'large flat areas' : T.flat > 0.6 ? 'balanced flat areas and detail' : 'busy, detailed pixels'}); dithering ${T.dither > 0.02 ? 'is used (' + (T.dither * 100).toFixed(1) + '% of 2×2 blocks)' : 'is rare'}; about ${T.colorsPerTile} colours per tile.`);
    if (A) { add(`Look: ${A.colors} colours per image, shade families of ~${A.rampLen} steps, ${A.outline != null ? Math.round(A.outline * 100) + '% of silhouette edge pixels darker than the body' : 'no silhouette edges measured'}, ${A.light ? 'light from ' + A.light : 'light direction not measured (tile sheets)'}${A.hueShift != null ? ', hue shift ' + (A.hueShift > 0 ? '+' : '') + A.hueShift + '°' : ''}. Blockiness score ${A.blockiness}/100 (lower is smoother shading).`); }
    return U;
};

/* ------------------------------------------------------------------ console colour budgets */
G.CONSOLES = {
    gb: { name: 'Game Boy', colors: 4, gray: true, note: '4 shades of green/grey: use dither and outline for depth' }, gbc: { name: 'Game Boy Color', colors: 4, note: '4 colours per sprite palette, 8 palettes' },
    snes: { name: 'Super Nintendo', colors: 15, note: '15 colours + transparent per palette' }, gba: { name: 'Game Boy Advance', colors: 15, note: '15 colours + transparent per palette' }, nds: { name: 'Nintendo DS', colors: 15, note: '15 + transparent (4-bit) or 255 (8-bit)' },
    ds8: { name: 'Nintendo DS (8-bit)', colors: 63, note: 'Up to 255; 63 keeps palettes small' }, psx: { name: 'PlayStation', colors: 15, note: '16-colour CLUT textures are the sweet spot; 256 for hero art' }, n64: { name: 'Nintendo 64', colors: 255, note: '4 KB texture cache: small textures, 16-bit colour' }, pc: { name: 'PC / Xbox', colors: 255, note: 'No hard limit' },
};

/* ------------------------------------------------------------------ upgrade: blocky sprite -> shaded art */
function medianCut(items, K) {    // items: [[r,g,b,w]] -> centers
    let boxes = [items.slice()]; while (boxes.length < K) {
        let bi = -1, bs = 0; boxes.forEach((b, i) => { if (b.length < 2) return; let r = [255, 0, 255, 0, 255, 0]; for (const c of b) for (let k = 0; k < 3; k++) { r[k * 2] = Math.min(r[k * 2], c[k]); r[k * 2 + 1] = Math.max(r[k * 2 + 1], c[k]); } const s = Math.max(r[1] - r[0], r[3] - r[2], r[5] - r[4]) * Math.sqrt(b.reduce((a, c) => a + c[3], 0)); if (s > bs) { bs = s; bi = i; } });
        if (bi < 0) break; const b = boxes[bi]; let ch = 0, best = -1; for (let k = 0; k < 3; k++) { let mn = 255, mx = 0; for (const c of b) { mn = Math.min(mn, c[k]); mx = Math.max(mx, c[k]); } if (mx - mn > best) { best = mx - mn; ch = k; } }
        b.sort((x, y) => x[ch] - y[ch]); const tot = b.reduce((a, c) => a + c[3], 0); let acc = 0, cut = 1; for (let i = 0; i < b.length; i++) { acc += b[i][3]; if (acc >= tot / 2) { cut = clamp(i + 1, 1, b.length - 1); break; } }
        boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
    }
    return boxes.map(b => { let w = 0, r = 0, g = 0, bl = 0; for (const c of b) { w += c[3]; r += c[0] * c[3]; g += c[1] * c[3]; bl += c[2] * c[3]; } return [Math.round(r / w), Math.round(g / w), Math.round(bl / w)]; });
}
const nearestIdx = (cs, r, g, b) => { let bi = 0, bd = 1e9; for (let i = 0; i < cs.length; i++) { const dd = (cs[i][0] - r) ** 2 + (cs[i][1] - g) ** 2 + (cs[i][2] - b) ** 2; if (dd < bd) { bd = dd; bi = i; } } return bi; };
G.STYLES = {
    shaded: { label: 'Shaded (fix blocky art)', ramp: 4, hueShift: 16, contrast: 1, outline: 'selout', detail: 0.5, gloss: false, rim: false, satBoost: 1 },
    cute: { label: 'Cute / cartoon', ramp: 3, hueShift: 10, contrast: 0.8, outline: 'dark', detail: 0.3, gloss: true, rim: false, satBoost: 1.12, outlineHue: 20 },
    realistic: { label: 'Realistic', ramp: 6, hueShift: 22, contrast: 1.15, outline: 'selout', detail: 0.9, gloss: true, rim: true, satBoost: 1 },
    wrestler: { label: 'Wrestler / muscle', ramp: 5, hueShift: 18, contrast: 1.25, outline: 'dark', detail: 0.7, gloss: true, rim: true, satBoost: 1.05 },
    retro: { label: 'Retro 16-bit dither', ramp: 4, hueShift: 14, contrast: 1, outline: 'dark', detail: 0.4, gloss: false, rim: false, dither: true, satBoost: 1 },
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
G.upgrade = (img, o = {}) => {
    const st = Object.assign({}, G.STYLES.shaded, G.STYLES[o.style || 'shaded'], o);
    const light = st.light || [-0.55, -0.7], budget = st.budget || (st.console && G.CONSOLES[st.console] ? G.CONSOLES[st.console].colors : 15);
    let { w, h, data } = img; const before = G.profile(img);
    const PAD = st.pad ? 1 : 0, W = w + PAD * 2, H = h + PAD * 2, N = W * H;
    const mask = new Uint8Array(N), src = new Uint8ClampedArray(N * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y + PAD) * W + x + PAD, j = y * w + x; if (data[j * 4 + 3] > 127) { mask[i] = 1; src[i * 4] = data[j * 4]; src[i * 4 + 1] = data[j * 4 + 1]; src[i * 4 + 2] = data[j * 4 + 2]; src[i * 4 + 3] = 255; } }
    // 1. families of colour
    const cnt = new Map(); let n = 0; for (let i = 0; i < N; i++) if (mask[i]) { n++; const k = src[i * 4] << 16 | src[i * 4 + 1] << 8 | src[i * 4 + 2]; cnt.set(k, (cnt.get(k) || 0) + 1); }
    if (n < 4) return { w: W, h: H, data: new Uint8ClampedArray(src), palette: [], before, after: before, style: st };
    const sig = [...cnt].filter(([, c]) => c >= n * 0.008).length, K = clamp(sig, 2, st.maxFamilies || 8);
    const items = [...cnt].map(([k, c]) => [k >> 16, k >> 8 & 255, k & 255, c]), centers = medianCut(items, K);
    const cl = new Int16Array(N).fill(-1); for (let i = 0; i < N; i++) if (mask[i]) cl[i] = nearestIdx(centers, src[i * 4], src[i * 4 + 1], src[i * 4 + 2]);
    // 2. clean up lone pixels
    if (st.cleanup !== false) for (let pass = 0; pass < 2; pass++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x; if (!mask[i]) continue; const nb = [cl[i - 1], cl[i + 1], cl[i - W], cl[i + W]].filter((v, k) => mask[[i - 1, i + 1, i - W, i + W][k]]);
        if (nb.length >= 3 && nb.every(v => v !== cl[i])) { const m = {}; nb.forEach(v => m[v] = (m[v] || 0) + 1); const best = Object.entries(m).sort((a, b) => b[1] - a[1])[0]; if (best[1] >= 2) cl[i] = +best[0]; }
    }
    // 3. ramps with hue shift
    const R = Math.max(2, st.ramp), base = Math.min(R - 1, Math.max(1, Math.round((R - 1) * 0.55))), ramps = centers.map(c => {
        let [hh, ss, ll] = rgb2hsl(c[0], c[1], c[2]); ss = clamp(ss * st.satBoost, 0, 1); const l0 = clamp(ll, ll < 0.18 ? 0.06 : 0.28, ll > 0.9 ? 0.96 : 0.74), arr = [];
        for (let k = 0; k < R; k++) {
            const t = R === 1 ? 0.5 : k / (R - 1), dl = (t - base / (R - 1)) * 0.62 * st.contrast * (ll < 0.18 ? 0.4 : 1);
            const toward = dl < 0 ? 250 : 55, f = clamp(Math.abs(dl) / 0.34, 0, 1) * clamp(st.hueShift / 22, 0, 1.6) * 0.5 * (ss < 0.12 ? 0.4 : 1);
            const hk = hh + hueDelta(hh, toward) * f * (st.hueShift / 22 > 0 ? 1 : 0) * 0.35;
            arr.push(hsl2rgb(hk, clamp(ss * (dl < 0 ? 1 + 0.18 * -dl / 0.34 : 1 - 0.14 * dl / 0.34), 0, 1), clamp(l0 + dl, 0.03, 0.97)));
        }
        return arr;
    });
    // 4. height field -> normals -> light
    const dt = (test) => { const D = new Float32Array(N); const INF = 1e4; for (let i = 0; i < N; i++) D[i] = test(i) ? 0 : INF;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (D[i] === 0) continue; let v = D[i]; if (x > 0) v = Math.min(v, D[i - 1] + 1); if (y > 0) v = Math.min(v, D[i - W] + 1); if (x > 0 && y > 0) v = Math.min(v, D[i - W - 1] + 1.4); if (x + 1 < W && y > 0) v = Math.min(v, D[i - W + 1] + 1.4); D[i] = v; }
        for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (D[i] === 0) continue; let v = D[i]; if (x + 1 < W) v = Math.min(v, D[i + 1] + 1); if (y + 1 < H) v = Math.min(v, D[i + W] + 1); if (x + 1 < W && y + 1 < H) v = Math.min(v, D[i + W + 1] + 1.4); if (x > 0 && y + 1 < H) v = Math.min(v, D[i + W - 1] + 1.4); D[i] = v; }
        return D; };
    // image border is not an edge unless padded; transparent pixels are
    const dSil = dt(i => !mask[i]), dReg = dt(i => !mask[i] || ((i % W) > 0 && mask[i - 1] && cl[i - 1] !== cl[i]) || ((i % W) < W - 1 && mask[i + 1] && cl[i + 1] !== cl[i]) || (i >= W && mask[i - W] && cl[i - W] !== cl[i]) || (i + W < N && mask[i + W] && cl[i + W] !== cl[i]));
    let maxD = 1; for (let i = 0; i < N; i++) if (mask[i] && dSil[i] < 1e3) maxD = Math.max(maxD, dSil[i]);
    const hgt = new Float32Array(N); for (let i = 0; i < N; i++) if (mask[i]) hgt[i] = 0.55 * Math.min(1, dSil[i] / (maxD * 0.9)) + 0.45 * Math.min(1, dReg[i] / 3);
    const hb = new Float32Array(N); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!mask[i]) continue; let s = 0, c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (mask[j]) { s += hgt[j]; c++; } } hb[i] = s / c; }
    const L3 = (() => { const v = [light[0], light[1], 0.65], m = Math.hypot(...v); return v.map(a => a / m); })(), I0 = L3[2];
    const kk = maxD * 0.9 + 0.5, out = new Uint8ClampedArray(N * 4), shadeIdx = new Int8Array(N).fill(-1);
    const clY = centers.map(c => lum(c[0], c[1], c[2])), clMean = new Float32Array(centers.length), clN = new Int32Array(centers.length);
    for (let i = 0; i < N; i++) if (mask[i]) { clMean[cl[i]] += lum(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]); clN[cl[i]]++; }
    for (let k = 0; k < centers.length; k++) if (clN[k]) clMean[k] /= clN[k];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x; if (!mask[i]) continue;
        const gx = ((x + 1 < W && mask[i + 1] ? hb[i + 1] : hb[i]) - (x > 0 && mask[i - 1] ? hb[i - 1] : hb[i])) * 0.5, gy = ((y + 1 < H && mask[i + W] ? hb[i + W] : hb[i]) - (y > 0 && mask[i - W] ? hb[i - W] : hb[i])) * 0.5;
        let nx = -gx * kk, ny = -gy * kk, nz = 1; const m = Math.hypot(nx, ny, nz); nx /= m; ny /= m; nz /= m;
        const I = nx * L3[0] + ny * L3[1] + nz * L3[2]; let shade = (I - I0) / (1 - I0 + 1e-6);
        shade += (lum(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]) - clMean[cl[i]]) / 255 * st.detail * 3;
        if (st.rim && dSil[i] <= 1.6 && I < I0 - 0.18) shade += 0.5;
        let f = (R - 1) * (base / (R - 1) + 0.5 * clamp(shade, -1.2, 1.2));
        if (st.dither) f += (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * 0.9;
        const idx = clamp(Math.round(f), 0, R - 1); shadeIdx[i] = idx;
        const c = ramps[cl[i]][idx]; out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
        if (st.gloss && shade > 0.9 && dSil[i] > 1.5 && R >= 3) { const t = ramps[cl[i]][R - 1]; out[i * 4] = Math.min(255, t[0] + 18); out[i * 4 + 1] = Math.min(255, t[1] + 18); out[i * 4 + 2] = Math.min(255, t[2] + 14); }
    }
    // 5. outline
    const darkOf = (k, f) => { const c = ramps[k][0], [hh, ss, ll] = rgb2hsl(c[0], c[1], c[2]); return hsl2rgb(hh + (st.outlineHue || 0), clamp(ss * 0.9, 0, 1), clamp(ll * f, 0.02, 0.5)); };
    if (st.outline && st.outline !== 'none') {
        const o2 = new Uint8ClampedArray(out);
        let dk = 0, dn = 0; for (let i = 0; i < N; i++) if (mask[i]) { dk += clY[cl[i]] * 0; }
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x, nb = [x > 0 ? !mask[i - 1] : false, x + 1 < W ? !mask[i + 1] : false, y > 0 ? !mask[i - W] : false, y + 1 < H ? !mask[i + W] : false];
            if (mask[i]) {
                if (!(nb[0] || nb[1] || nb[2] || nb[3])) continue; const lightSide = nb[0] || nb[2]; const dark = clY[cl[i]] < 50;
                const c = st.outline === 'dark' ? darkOf(cl[i], 0.55) : darkOf(cl[i], lightSide ? 0.78 : 0.5);
                if (dark && st.outline === 'selout') continue;     // already dark: keep as is
                o2[i * 4] = c[0]; o2[i * 4 + 1] = c[1]; o2[i * 4 + 2] = c[2];
            } else if (PAD) {      // outside outline on the padding ring
                let k = -1; if (x > 0 && mask[i - 1]) k = cl[i - 1]; else if (x + 1 < W && mask[i + 1]) k = cl[i + 1]; else if (y > 0 && mask[i - W]) k = cl[i - W]; else if (y + 1 < H && mask[i + W]) k = cl[i + W];
                if (k >= 0) { const c = darkOf(k, st.outline === 'dark' ? 0.4 : 0.35); o2[i * 4] = c[0]; o2[i * 4 + 1] = c[1]; o2[i * 4 + 2] = c[2]; o2[i * 4 + 3] = 255; }
            }
        }
        out.set(o2);
    }
    // 6. colour budget
    const fin = new Map(); for (let i = 0; i < N; i++) if (out[i * 4 + 3] > 127) { const k = out[i * 4] << 16 | out[i * 4 + 1] << 8 | out[i * 4 + 2]; fin.set(k, (fin.get(k) || 0) + 1); }
    let palette;
    if (fin.size > budget) {
        const its = [...fin].map(([k, c]) => [k >> 16, k >> 8 & 255, k & 255, c]); palette = medianCut(its, budget);
        if (st.console === 'gb') { palette = palette.map(c => { const y = lum(c[0], c[1], c[2]); return [y, y, y]; }); }
        for (let i = 0; i < N; i++) if (out[i * 4 + 3] > 127) { const c = palette[nearestIdx(palette, out[i * 4], out[i * 4 + 1], out[i * 4 + 2])]; out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; }
    } else palette = [...fin.keys()].map(k => [k >> 16, k >> 8 & 255, k & 255]);
    const res = { w: W, h: H, data: out, palette, style: st };
    res.before = before; res.after = G.profile(res); return res;
};
/* Grade an image against the studio's own database of real games */
G.grade = (prof, ref) => {
    if (!prof) return { score: null, tips: ['Nothing to measure: the image is empty.'] };
    const tips = [];
    if (prof.flat > 0.86) tips.push(`${Math.round(prof.flat * 100)}% of neighbouring pixels are the same colour: large flat areas read as blocky. Add 2-3 shade steps per colour (Upgrade does this).`);
    if (prof.rampLen < 2.6) tips.push(`Colours have ~${prof.rampLen} shade steps. Shipped games usually use 3-5 per material.`);
    if (prof.outline != null && prof.outline < 0.35) tips.push('No darker outline around the silhouette: add a selective outline so the character separates from the background.');
    if (prof.lumRange < 80) tips.push(`Low contrast (brightness spread ${prof.lumRange}/255): push the darkest and lightest steps apart.`);
    if (prof.hueShift == null || Math.abs(prof.hueShift) < 6) tips.push('Shadows and highlights share one hue. Shift shadows cooler and highlights warmer for richer colour.');
    if (/flat/.test(prof.light)) tips.push('No consistent light direction. Pick one (top-left is the classic) and shade every sprite the same way.');
    if (prof.colors > 24) tips.push(`${prof.colors} colours is more than most consoles allow per sprite; reduce with a console preset.`);
    if (ref) { if (ref.rampLen && prof.rampLen < ref.rampLen - 0.8) tips.push(`Reference games average ${ref.rampLen} steps per colour here.`); }
    return { score: 100 - prof.blockiness, tips: tips.length ? tips : ['Looks well shaded: consistent ramps, outline and light.'] };
};

/* ------------------------------------------------------------------ procedural textures (tileable) */
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, period, seed) {     // value noise that wraps every `period` cells
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), P = period;
    const a = hash(((xi % P) + P) % P, ((yi % P) + P) % P, seed), b = hash((((xi + 1) % P) + P) % P, ((yi % P) + P) % P, seed), c = hash(((xi % P) + P) % P, (((yi + 1) % P) + P) % P, seed), d = hash((((xi + 1) % P) + P) % P, (((yi + 1) % P) + P) % P, seed);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}
const fbm = (x, y, per, seed, oct = 4) => { let v = 0, a = 0.5, tot = 0; for (let o = 0; o < oct; o++) { v += vnoise(x * (1 << o), y * (1 << o), per * (1 << o), seed + o * 17) * a; tot += a; a *= 0.5; } return v / tot; };
G.TEXTURES = {
    brick: { label: 'Brick wall', colors: ['#7a3b2e', '#a85a43'], mortar: '#b8b0a0' }, wood: { label: 'Wood planks', colors: ['#5a3a1e', '#a0703a'] }, stone: { label: 'Stone', colors: ['#5c5f66', '#9ca0a8'] }, grass: { label: 'Grass', colors: ['#2f5b2a', '#7fb348'] },
    metal: { label: 'Brushed metal', colors: ['#3a4048', '#b4bcc6'] }, canvas: { label: 'Canvas (wrestling mat)', colors: ['#7c8fb8', '#d6dff2'] }, skin: { label: 'Skin', colors: ['#8a4f3a', '#e8b28e'] }, concrete: { label: 'Concrete', colors: ['#6f6f6f', '#b0aca4'] },
};
const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
G.texture = (kind, size = 32, seed = 1, o = {}) => {
    const T = G.TEXTURES[kind] || G.TEXTURES.stone, S = size, per = Math.max(2, S >> 3), steps = o.colors || 8, dither = o.dither !== false;
    const lo = rgb2hsl(...hex(T.colors[0])), hi = rgb2hsl(...hex(T.colors[1])), pal = [];
    for (let i = 0; i < steps; i++) { const t = steps === 1 ? 0.5 : i / (steps - 1); pal.push(hsl2rgb(lo[0] + hueDelta(lo[0], hi[0]) * t - (1 - t) * 6 + t * 4, lo[1] + (hi[1] - lo[1]) * t, lo[2] + (hi[2] - lo[2]) * t)); }
    const data = new Uint8ClampedArray(S * S * 4), val = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const u = x / S * per, v = y / S * per; let t;
        if (kind === 'brick') { const rows = 4, bh = S / rows, row = Math.floor(y / bh), off = row % 2 ? S / 4 : 0, bw = S / 2, xx = (x + off) % S, inX = xx % bw, inY = y % bh; const mortar = inY < 1 || inX < 1; t = mortar ? -1 : 0.3 + 0.5 * fbm(u * 2, v * 2, per * 2, seed) + (hash(Math.floor((x + off) / bw), row, seed) - 0.5) * 0.3; if (!mortar && inY < 2) t += 0.15; if (!mortar && inY > bh - 2) t -= 0.2; }
        else if (kind === 'wood') { const n = fbm(u * 0.5, v * 4, per, seed, 3), ring = Math.sin((y / S * 6 + n * 3) * Math.PI * 2) * 0.5 + 0.5; t = 0.25 + 0.5 * ring + 0.25 * n; if ((x % Math.max(8, S / 2)) < 1) t = 0.05; }
        else if (kind === 'grass') { t = 0.25 + 0.55 * fbm(u * 4, v * 4, per * 4, seed, 3) + (hash(x, y, seed) > 0.93 ? 0.2 : 0); }
        else if (kind === 'metal') { t = 0.45 + 0.35 * vnoise(u * 0.4, v * 12, per, seed) + 0.15 * hash(x, y, seed + 3) - 0.1; if ((x % (S / 4) < 1 || y % (S / 4) < 1)) t -= 0.25; }
        else if (kind === 'canvas') { const wx = Math.sin(x / S * Math.PI * 2 * (S / 4)) * 0.5 + 0.5, wy = Math.sin(y / S * Math.PI * 2 * (S / 4)) * 0.5 + 0.5; t = 0.5 + 0.18 * (wx * wy - 0.3) + 0.25 * (fbm(u, v, per, seed) - 0.5); }
        else if (kind === 'skin') { t = 0.55 + 0.35 * (fbm(u, v, per, seed, 3) - 0.5) + 0.05 * (hash(x, y, seed) - 0.5); }
        else if (kind === 'concrete') { t = 0.5 + 0.4 * (fbm(u * 2, v * 2, per * 2, seed) - 0.5) + 0.12 * (hash(x, y, seed) - 0.5); }
        else { t = 0.35 + 0.55 * fbm(u * 1.5, v * 1.5, per * 2, seed, 4); const c = Math.abs(fbm(u * 3, v * 3, per * 3, seed + 9, 2) - 0.5); if (c < 0.03) t -= 0.25; }
        val[y * S + x] = t;
    }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const t = val[y * S + x], i = (y * S + x) * 4;
        if (t < 0 && kind === 'brick') { const m = hex(T.mortar); data[i] = m[0]; data[i + 1] = m[1]; data[i + 2] = m[2]; data[i + 3] = 255; continue; }
        let f = clamp(t, 0, 1) * (steps - 1); if (dither) f += (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * 0.7; const c = pal[clamp(Math.round(f), 0, steps - 1)];
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
    return { w: S, h: S, data, palette: pal, kind };
};
/* does a texture fit the console? */
G.texCheck = (consoleId, w, h, colors) => {
    const notes = []; let ok = true; const pow2 = v => (v & (v - 1)) === 0;
    if (consoleId === 'n64') { const bits = colors <= 16 ? 4 : colors <= 256 ? 8 : 16, bytes = w * h * bits / 8 + (colors <= 256 ? colors * 2 : 0); if (bytes > 4096) { ok = false; notes.push(`${w}×${h} at ${bits}-bit is ${bytes} bytes; the N64 texture cache is 4096. Use ${bits === 16 ? '32×32 16-bit or 64×32 8-bit' : 'a smaller size or fewer bits'}.`); } if (!pow2(w) || !pow2(h)) notes.push('Power-of-two sizes tile and wrap correctly.'); }
    else if (consoleId === 'psx') { if (w > 256 || h > 256) { ok = false; notes.push('PlayStation textures are at most 256×256 per page.'); } if (colors > 256) { notes.push('Use 16 (4-bit) or 256 (8-bit) colours; 16-bit direct colour eats VRAM.'); } else if (colors > 16 && w * h > 128 * 128) notes.push('Big 8-bit textures crowd the 1 MB video memory; prefer 4-bit at 64×64.'); }
    else if (consoleId === 'nds') { if (!pow2(w) || !pow2(h) || w < 8 || h < 8 || w > 1024) { ok = false; notes.push('DS 3D textures must be power-of-two sizes from 8 to 1024.'); } }
    if (!notes.length) notes.push('Fits.'); return { ok, notes };
};

/* ------------------------------------------------------------------ rules: the database -> plain-language techniques */
G.CRAFT = [
    ['Hue shifting', 'Shadows drift toward blue/purple and highlights toward yellow instead of just getting darker or lighter. Real 16-bit palettes do this; it is the cheapest way to make flat art look rich.', 'Use the Shaded, Cute, Realistic or Wrestler preset in the Graphics tab. Hue shift 14-22° is typical.'],
    ['Shade steps per material', 'Most shipped sprites use 3-5 brightness steps per colour (base, shadow, deep shadow, highlight). Fewer than 3 reads as blocky; more than 6 gets muddy at small sizes.', 'Ramp length is set per style. Cute 3, Shaded 4, Wrestler 5, Realistic 6.'],
    ['Selective outline', 'Instead of one black line, the outline takes a darker tone of the colour next to it, lighter on the lit side. The character stays readable without looking stickered on.', 'Outline: selout. Use dark for cartoon looks.'],
    ['One light source', 'Pick a direction (top-left is the classic) and shade every sprite, tile and object the same way. Mixed lighting is the quickest tell of amateur art.', 'The upgrader lights from the top-left by default; you can change it.'],
    ['Rounded volume, not outlines of boxes', 'Shade each part as if it were a cylinder or ball: brightest just inside the lit edge, darkest toward the far edge. A rim of light on the far edge separates body from background.', 'Wrestler preset adds rim light along shadowed edges for muscle definition.'],
    ['Dithering', 'Alternating checker pixels between two shades fakes a gradient with a small palette. Good for skies, shadows on 4-colour hardware (Game Boy) and retro looks; avoid on faces and small sprites.', 'Retro preset, or turn on dither.'],
    ['Silhouette first', 'A character must read as a filled-in black shape. Distinct heads, arms and weapons beat fine inner detail at DS and SNES sizes.', 'Preview the sprite with the colour turned off in the Graphics tab.'],
    ['Colour budgets', 'Game Boy 4 shades. Game Boy Color 4 colours per palette. SNES, GBA, DS 15 + transparent per 4-bit palette. PlayStation 16-colour textures are the sweet spot. N64: 4 KB texture cache.', 'Pick the console in the upgrader and it merges colours to fit.'],
    ['Avoid pillow shading', 'Light that comes from the middle and fades outward in every direction looks like a pillow. Choose a light direction and let one side stay dark.', 'The upgrader uses directional light, not radial.'],
    ['Low-poly texture tricks', 'On PlayStation and N64, bake shading and details into small textures instead of adding polygons: painted creases on clothes, a belt line, stitching. Reuse one texture across many objects.', 'Graphics tab → Textures makes tileable brick, wood, stone, canvas and skin at console-safe sizes.'],
    ['Vertex colour as cheap lighting', 'Both consoles can tint polygons per vertex. Darken the underside of a wrestler and brighten the shoulders with vertex colours instead of extra textures.', 'Applies in the PSX/N64 modes when they arrive; keep textures neutral so tinting works.'],
    ['Wrestling sprites', 'Large readable bodies: 5-step skin ramps, strong rim light, dark outline, trunks and boots in saturated contrasting colours, face wrap on a separate layer so faces stay detailed while bodies are shaded.', 'Wrestler preset + Face Wrap maker.'],
    ['Animation frames share a palette', 'Keep one palette for every frame of a character so colours do not flicker, and shade each frame with the same light.', 'Batch upgrade applies one style to all sprites.'],
];
G.rules = (dbs) => {
    const rows = G.CRAFT.map(([t, w, how]) => ({ system: 'Graphic design · ' + t, category: 'Graphic design', game: 'Studio craft notes', platform: 'All', what: w, numbers: how, feel: '' }));
    const by = {}; for (const r of dbs) if (r.gfx && (r.gfx.art || r.gfx.palettes)) { (by[r.platform] = by[r.platform] || []).push(r); }
    for (const [plat, list] of Object.entries(by)) {
        const arts = list.filter(r => r.gfx.art).map(r => r.gfx.art), pals = list.filter(r => r.gfx.palettes).map(r => r.gfx.palettes);
        const bits = []; if (pals.length) bits.push(`typical palette: ${Math.round(median(pals.map(p => p.colors)))} colours, ${median(pals.map(p => p.rampLen)).toFixed(1)}-step shade families, saturation ${Math.round(median(pals.map(p => p.sat)) * 100)}%`);
        if (arts.length) bits.push(`${Math.round(median(arts.map(a => a.flat)) * 100)}% flat neighbours, outline on ${Math.round(median(arts.map(a => a.outline || 0)) * 100)}% of edges, blockiness ${Math.round(median(arts.map(a => a.blockiness)))}/100`);
        rows.push({ system: `Graphic design · ${plat} measured from ${list.length} games`, category: 'Graphic design', game: list.slice(0, 5).map(r => r.name).join(', '), platform: plat, what: bits.join('; ') + '.', numbers: '', feel: '' });
    }
    return rows;
};
G.reference = (dbs, platform) => { const arts = dbs.filter(r => r.gfx && r.gfx.art && (!platform || r.platform === platform)).map(r => r.gfx.art); if (!arts.length) return null; return { rampLen: +median(arts.map(a => a.rampLen)).toFixed(2), flat: +median(arts.map(a => a.flat)).toFixed(3), outline: +median(arts.map(a => a.outline || 0)).toFixed(2), blockiness: Math.round(median(arts.map(a => a.blockiness))), games: arts.length }; };

if (typeof module !== 'undefined') module.exports = G; else root.NRGfx = G;
})(typeof self !== 'undefined' ? self : this);

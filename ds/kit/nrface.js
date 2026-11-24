/* NOTAREAL Dev Kit: face wrap maker (runs offline in the editor and in node).
 * Photo -> find the face (skin-colour regions + eye search) -> sample the skin tone -> cut away the background and
 * hair and fill it with the skin tone -> a "face wrap" laid out like the create-a-wrestler head textures:
 * square, face centred, eyes at 31.5/64 of the height, 11/64 of the width apart, plain skin all around so it wraps a
 * head with no seam. Then console versions (fewer pixels/colours for older hardware) and a tiny sprite face.
 * The photo never leaves the computer. */
(function (root) {
'use strict';
const F = {};
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
function isSkin(r, g, b) {
    const y = lum(r, g, b), cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b, cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    return y > 40 && cb > 77 && cb < 130 && cr > 133 && cr < 178 && r > g && r > b && (r - Math.min(g, b)) > 12;
}
/* downscale for analysis (max side 200) */
function small(im, max = 200) {
    const k = Math.min(1, max / Math.max(im.w, im.h)), w = Math.max(1, Math.round(im.w * k)), h = Math.max(1, Math.round(im.h * k)), d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, n = 0; const x0 = Math.floor(x / k), x1 = Math.max(x0 + 1, Math.floor((x + 1) / k)), y0 = Math.floor(y / k), y1 = Math.max(y0 + 1, Math.floor((y + 1) / k));
        for (let yy = y0; yy < y1 && yy < im.h; yy++) for (let xx = x0; xx < x1 && xx < im.w; xx++) { const i = (yy * im.w + xx) * 4; r += im.data[i]; g += im.data[i + 1]; b += im.data[i + 2]; n++; }
        const o = (y * w + x) * 4; d[o] = r / n; d[o + 1] = g / n; d[o + 2] = b / n; d[o + 3] = 255;
    }
    return { w, h, data: d, k };
}
/* find the face: returns { cx, cy, rx, ry, eyes:[[x,y],[x,y]], skin:[r,g,b], confidence } in photo pixels */
let classify = null;
F.setCascade = bytes => { const P = (typeof module !== 'undefined') ? require('./vendor/pico_mod.js') : root.pico; classify = P.unpack_cascade(bytes); F._pico = P; };
F.hasDetector = () => !!classify;
/* pico face detector: returns [{r,c,s,q}] in photo pixels, best first */
F.findFaces = im => {
    if (!classify) return [];
    // grey copy at most 480 px, padded by 30% so faces cut off by the frame edge still match, tried at several tilts
    const k = Math.min(1, 480 / Math.max(im.w, im.h)), w = Math.round(im.w * k), h = Math.round(im.h * k), pad = Math.round(Math.max(w, h) * 0.3);
    const W = w + 2 * pad, H = h + 2 * pad, src = new Float32Array(W * H);
    let mean = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (Math.floor(y / k) * im.w + Math.floor(x / k)) * 4, v = (2 * im.data[i] + 7 * im.data[i + 1] + im.data[i + 2]) / 10; src[(y + pad) * W + x + pad] = v; mean += v; }
    mean /= w * h; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (y < pad || y >= pad + h || x < pad || x >= pad + w) { const cx = Math.min(w - 1, Math.max(0, x - pad)), cy = Math.min(h - 1, Math.max(0, y - pad)); src[y * W + x] = src[(cy + pad) * W + cx + pad] * 0.5 + mean * 0.5; }
    const all = [];
    for (const deg of [0, -18, 18, -32, 32]) {
        const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), g = new Uint8Array(W * H), ox = W / 2, oy = H / 2;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const sx = Math.round(ox + (x - ox) * ca - (y - oy) * sa), sy = Math.round(oy + (x - ox) * sa + (y - oy) * ca); g[y * W + x] = sx >= 0 && sy >= 0 && sx < W && sy < H ? src[sy * W + sx] : mean; }
        let dets = F._pico.run_cascade({ pixels: g, nrows: H, ncols: W, ldim: W }, classify, { shiftfactor: 0.08, minsize: Math.max(20, Math.min(w, h) * 0.06), maxsize: Math.max(W, H), scalefactor: 1.08 });
        dets = F._pico.cluster_detections(dets, 0.2);
        for (const d of dets) { const x = ox + (d[1] - ox) * ca - (d[0] - oy) * sa, y = oy + (d[1] - ox) * sa + (d[0] - oy) * ca; all.push({ r: (y - pad) / k, c: (x - pad) / k, s: d[2] / k, q: d[3] * (deg ? 0.85 : 1), tilt: deg }); }
    }
    // merge the same face found at several tilts; keep the strongest
    all.sort((p, q) => q.q - p.q); const out = [];
    for (const d of all) { if (d.q < 3) continue; if (out.some(o => Math.hypot(o.c - d.c, o.r - d.r) < Math.max(o.s, d.s) * 0.4)) continue; out.push(d); }
    out.sort((p, q) => Math.min(q.q, 25) * Math.sqrt(q.s) - Math.min(p.q, 25) * Math.sqrt(p.s));
    return out;
};
F.detect = (im, faceIndex = 0) => {
    const faces = F.findFaces(im);
    if (faces.length) return F.fromBox(im, faces[Math.min(faceIndex, faces.length - 1)], faces.length);
    return F.detectSkin(im);
};
/* refine a detector box: eyes = darkest spots near the expected eye line, skin = cheek median */
F.fromBox = (im, f, count) => {
    const L = (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= im.w || y >= im.h) return 255; const i = (y * im.w + x) * 4; return lum(im.data[i], im.data[i + 1], im.data[i + 2]); };
    const s = f.s, ey0 = f.r - 0.09 * s, step = Math.max(1, s / 120), eyes = [];
    const ta = (f.tilt || 0) * Math.PI / 180, tc = Math.cos(ta), ts = Math.sin(ta);
    const Lr = (x, y) => { const dx = x - f.c, dy = y - f.r; return L(f.c + dx * tc - dy * ts, f.r + dx * ts + dy * tc); };
    for (const side of [-1, 1]) {
        let bx = f.c + side * 0.17 * s, by = ey0, bv = 1e9;
        for (let y = ey0 - 0.08 * s; y <= ey0 + 0.07 * s; y += step) for (let x = f.c + side * 0.08 * s; side < 0 ? x >= f.c - 0.3 * s : x <= f.c + 0.3 * s; x += side * step) {
            let v = 0; const rr = Math.max(1, s / 60); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) v += Lr(x + dx * rr, y + dy * rr);
            v += Math.abs(x - (f.c + side * 0.17 * s)) / s * 600 + Math.abs(y - ey0) / s * 900;
            if (v < bv) { bv = v; bx = x; by = y; }
        }
        { const dx = bx - f.c, dy = by - f.r; eyes.push([f.c + dx * tc - dy * ts, f.r + dx * ts + dy * tc]); }
    }
    const px = []; const st2 = Math.max(1, s / 80);
    for (const side of [-1, 1]) for (let y = f.r + 0.02 * s; y < f.r + 0.16 * s; y += st2) for (let x = f.c + side * 0.1 * s; side < 0 ? x > f.c - 0.24 * s : x < f.c + 0.24 * s; x += side * st2) { const xi = Math.round(x), yi = Math.round(y); if (xi < 0 || yi < 0 || xi >= im.w || yi >= im.h) continue; const i = (yi * im.w + xi) * 4; px.push([im.data[i], im.data[i + 1], im.data[i + 2]]); }
    const skinOnly = px.filter(p => isSkin(p[0], p[1], p[2])), use = skinOnly.length > px.length * 0.2 ? skinOnly : px;
    const med = k => { const a = use.map(p => p[k]).sort((p, q) => p - q); return a[a.length >> 1] || 180; };
    return { cx: f.c, cy: f.r, rx: s * 0.36, ry: s * 0.48, eyes, skin: [med(0), med(1), med(2)], confidence: Math.min(1, +(f.q / 40).toFixed(2)), faces: count, method: 'detector' };
};
F.detectSkin = im => {
    const s = small(im), { w, h } = s, m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) m[i] = isSkin(s.data[i * 4], s.data[i * 4 + 1], s.data[i * 4 + 2]) ? 1 : 0;
    // close small holes (eyes, mouth) with a 2-pass dilate/erode
    const morph = (src, dil) => { const o = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = dil ? 0 : 1; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xx = x + dx; const p = yy >= 0 && yy < h && xx >= 0 && xx < w ? src[yy * w + xx] : 0; if (dil && p) v = 1; if (!dil && !p) v = 0; } o[y * w + x] = v; } return o; };
    const mc = morph(morph(m, true), false);
    // connected components; score = size * centrality * roundness
    const lab = new Int32Array(w * h).fill(-1), comps = [];
    for (let i = 0; i < w * h; i++) {
        if (!mc[i] || lab[i] >= 0) continue;
        const st = [i], c = { n: 0, sx: 0, sy: 0, x0: w, x1: 0, y0: h, y1: 0, id: comps.length }; lab[i] = c.id;
        while (st.length) { const j = st.pop(), x = j % w, y = (j / w) | 0; c.n++; c.sx += x; c.sy += y; c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x); c.y0 = Math.min(c.y0, y); c.y1 = Math.max(c.y1, y);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const q = yy * w + xx; if (mc[q] && lab[q] < 0) { lab[q] = c.id; st.push(q); } } }
        comps.push(c);
    }
    let best = null, bestScore = 0;
    for (const c of comps) {
        if (c.n < w * h * 0.01) continue;
        const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1, fill = c.n / (bw * bh), aspect = bh / bw;
        const cx = c.sx / c.n, cy = c.sy / c.n, cent = 1 - Math.hypot((cx - w / 2) / w, (cy - h * 0.45) / h);
        const sc = c.n * cent * cent * (fill > 0.45 ? 1 : 0.5) * (aspect > 0.8 && aspect < 2.2 ? 1 : 0.4) * (cy < h * 0.75 ? 1 : 0.5);
        if (sc > bestScore) { bestScore = sc; best = c; }
    }
    let cx, cy, rx, ry, conf;
    if (!best) { cx = w / 2; cy = h * 0.45; rx = w * 0.22; ry = h * 0.3; conf = 0; }
    else {
        // a skin blob often includes the neck: the face is the top part, about 1.35x as tall as wide
        const bw = best.x1 - best.x0 + 1; rx = bw / 2 * 0.92; ry = Math.min((best.y1 - best.y0 + 1) / 2, rx * 1.35);
        cx = (best.x0 + best.x1) / 2; cy = best.y0 + ry; conf = Math.min(1, bestScore / (w * h * 0.08));
        // re-centre x on the skin rows of the face area only
        let sx = 0, n = 0; for (let y = Math.round(cy - ry * 0.5); y < cy + ry * 0.5; y++) for (let x = best.x0; x <= best.x1; x++) if (y >= 0 && y < h && lab[y * w + x] === best.id) { sx += x; n++; }
        if (n) cx = sx / n;
    }
    // eyes: darkest compact spots in each half of the band 30%-55% down the face
    const L = (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= w || y >= h) return 255; const i = (y * w + x) * 4; return lum(s.data[i], s.data[i + 1], s.data[i + 2]); };
    const eyes = [];
    for (const side of [-1, 1]) {
        let bx = cx + side * rx * 0.4, by = cy - ry * 0.12, bv = 1e9;
        for (let y = cy - ry * 0.45; y <= cy + ry * 0.1; y++) for (let x = cx + side * rx * 0.12; side < 0 ? x >= cx - rx * 0.75 : x <= cx + rx * 0.75; x += side) {
            let v = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) v += L(x + dx, y + dy);
            v += Math.abs(y - (cy - ry * 0.15)) * 4;           // prefer the expected eye line over brows and nostrils
            if (v < bv) { bv = v; bx = x; by = y; }
        }
        eyes.push([bx, by]);
    }
    if (eyes[0][0] > eyes[1][0]) eyes.reverse();
    const ed = Math.hypot(eyes[1][0] - eyes[0][0], eyes[1][1] - eyes[0][1]);
    if (ed < rx * 0.45 || ed > rx * 1.4) { const ey = cy - ry * 0.12; eyes[0] = [cx - rx * 0.4, ey]; eyes[1] = [cx + rx * 0.4, ey]; conf *= 0.7; }
    // skin tone: median of the cheeks
    const px = []; for (const side of [-1, 1]) for (let y = cy + ry * 0.05; y < cy + ry * 0.35; y++) for (let x = cx + side * rx * 0.25; side < 0 ? x > cx - rx * 0.6 : x < cx + rx * 0.6; x += side) { const xi = Math.round(x), yi = Math.round(y); if (xi < 0 || yi < 0 || xi >= w || yi >= h) continue; const i = (yi * w + xi) * 4; if (isSkin(s.data[i], s.data[i + 1], s.data[i + 2])) px.push([s.data[i], s.data[i + 1], s.data[i + 2]]); }
    let skin = [200, 160, 130];
    if (px.length) { const med = k => { const a = px.map(p => p[k]).sort((p, q) => p - q); return a[a.length >> 1]; }; skin = [med(0), med(1), med(2)]; }
    const K = 1 / s.k;
    return { cx: cx * K, cy: cy * K, rx: rx * K, ry: ry * K, eyes: eyes.map(([x, y]) => [x * K, y * K]), skin, confidence: +conf.toFixed(2) };
};
/* make the wrap: size x size RGBA. opts: { keepHair, feather (0..1) } */
F.makeWrap = (im, det, size = 256, opts = {}) => {
    const [e0, e1] = det.eyes, ed = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]) || det.rx * 0.8, ang = Math.atan2(e1[1] - e0[1], e1[0] - e0[0]);
    const scale = ed / (size * 11 / 64), mx = (e0[0] + e1[0]) / 2, my = (e0[1] + e1[1]) / 2, ca = Math.cos(ang), sa = Math.sin(ang);
    const out = new Uint8ClampedArray(size * size * 4), sk = det.skin, feather = opts.feather == null ? 0.18 : opts.feather;
    // face oval in wrap space: centred under the eyes, ear to ear, brow to chin
    const ocx = size / 2, ocy = size * (31.5 / 64) + size * 0.06, orx = size * 0.205, ory = size * (opts.keepHair ? 0.36 : 0.27);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = (x - size / 2) * scale, v = (y - size * 31.5 / 64) * scale;
        const sx = mx + u * ca - v * sa, sy = my + u * sa + v * ca;
        // bilinear sample
        let r = sk[0], g = sk[1], b = sk[2];
        if (sx >= 0 && sy >= 0 && sx < im.w - 1 && sy < im.h - 1) { const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0; const at = (xx, yy, c) => im.data[(yy * im.w + xx) * 4 + c]; const bil = c => at(x0, y0, c) * (1 - fx) * (1 - fy) + at(x0 + 1, y0, c) * fx * (1 - fy) + at(x0, y0 + 1, c) * (1 - fx) * fy + at(x0 + 1, y0 + 1, c) * fx * fy; r = bil(0); g = bil(1); b = bil(2); }
        const d = Math.hypot((x - ocx) / orx, (y - ocy) / ory);
        let t = d < 1 - feather ? 1 : d > 1 ? 0 : (1 - d) / feather;
        if (!opts.keepHair && t > 0 && t < 1 && !isSkin(r, g, b)) t *= 0.5;            // hair/background at the edge fades faster
        const o = (y * size + x) * 4;
        out[o] = r * t + sk[0] * (1 - t); out[o + 1] = g * t + sk[1] * (1 - t); out[o + 2] = b * t + sk[2] * (1 - t); out[o + 3] = 255;
    }
    return { w: size, h: size, data: out };
};
/* console versions: texture size and colour limits of each target */
F.TARGETS = {
    gb: { label: 'Game Boy', size: 32, colors: 4, palette: [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]] },
    gbc: { label: 'Game Boy Color', size: 32, colors: 4 },
    snes: { label: 'SNES', size: 64, colors: 15 },
    gba: { label: 'Game Boy Advance', size: 64, colors: 15 },
    psx: { label: 'PlayStation', size: 128, colors: 16 },
    n64: { label: 'Nintendo 64', size: 64, colors: 256 },
    ds: { label: 'Nintendo DS', size: 128, colors: 256 },
};
F.forConsole = (wrap, target, NRK) => {
    const T = F.TARGETS[target]; const r = NRK.resize(wrap, T.size, T.size);
    if (T.palette) { // map brightness onto the fixed 4 greens
        for (let i = 0; i < r.data.length; i += 4) { const l = lum(r.data[i], r.data[i + 1], r.data[i + 2]) / 256, k = Math.min(3, Math.floor(l * 4)); const c = T.palette[k]; r.data[i] = c[0]; r.data[i + 1] = c[1]; r.data[i + 2] = c[2]; }
        return r;
    }
    return NRK.pixelize(r, T.size, T.size, T.colors);
};
/* a small front-facing face for sprites (e.g. 7x8 for 32x64 heroes) */
F.spriteFace = (wrap, w, h, NRK) => { const c = NRK.crop(wrap, Math.round(wrap.w * 0.29), Math.round(wrap.h * 0.3), Math.round(wrap.w * 0.42), Math.round(wrap.h * 0.5)); return NRK.pixelize(c, w, h, 12); };
if (typeof module !== 'undefined') module.exports = F; else root.NRFace = F;
})(typeof self !== 'undefined' ? self : this);

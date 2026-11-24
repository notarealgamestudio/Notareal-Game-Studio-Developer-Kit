/* nrassets.js - the shared asset library for EVERY game type.
   One set of premade (or imported) skylines, land types, buildings and props lives in the project (P.assets) and each engine reads it.
   The DS engines get an 'ASET' section in their data block: SKY (128x64 256-colour), LAND (64x64 16-colour), WALL (64x64 16-colour),
   all in the engines' own 'PT' texture format (PT, bpp, flags, RGB15 palette, pixels), so the 3D engines can upload them as they are.
   Images come in as {w,h,data(RGBA)}; the editor decodes them with a canvas, tests pass raw arrays. */
(function (root) {
    'use strict'; const A = {};
    A.CATS = [{ id: 'sky', label: 'Skylines & backgrounds', size: [256, 96] }, { id: 'land', label: 'Land types (ground, floors, roads)', size: [32, 32] },
        { id: 'building', label: 'Buildings', size: [48, 64] }, { id: 'prop', label: 'Objects & props', size: [24, 24] }];
    A.SLOTS = { sky: { w: 128, h: 64, bpp: 8 }, land: { w: 64, h: 64, bpp: 4 }, wall: { w: 64, h: 64, bpp: 4 } };
    function resize(img, W, H, opaque) {      // box average, alpha composited onto grey when transparent
        const o = new Uint8Array(W * H * 3);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const x0 = Math.floor(x * img.w / W), x1 = Math.max(x0 + 1, Math.floor((x + 1) * img.w / W)), y0 = Math.floor(y * img.h / H), y1 = Math.max(y0 + 1, Math.floor((y + 1) * img.h / H)); let r = 0, g = 0, b = 0, n = 0;
            for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * img.w + xx) * 4, a = img.data[i + 3] / 255; r += img.data[i] * a + 120 * (1 - a); g += img.data[i + 1] * a + 150 * (1 - a); b += img.data[i + 2] * a + 190 * (1 - a); n++; }
            o.set([r / n, g / n, b / n], (y * W + x) * 3);
        } return o;
    }
    function medianCut(cols, K) {      // cols: Map(key -> count) of 5-bit rgb
        let boxes = [[...cols].map(([k, c]) => [k >> 10 & 31, k >> 5 & 31, k & 31, c])];
        while (boxes.length < K) {
            let bi = -1, bs = 0; boxes.forEach((b, i) => { if (b.length < 2) return; const rg = [0, 1, 2].map(a => { let lo = 99, hi = -1; for (const p of b) { lo = Math.min(lo, p[a]); hi = Math.max(hi, p[a]); } return hi - lo; }), s = Math.max(...rg) * Math.log2(1 + b.length); if (s > bs) { bs = s; bi = i; } });
            if (bi < 0) break; const b = boxes[bi], rg = [0, 1, 2].map(a => { let lo = 99, hi = -1; for (const p of b) { lo = Math.min(lo, p[a]); hi = Math.max(hi, p[a]); } return hi - lo; }), ax = rg.indexOf(Math.max(...rg));
            b.sort((p, q) => p[ax] - q[ax]); const tot = b.reduce((s, p) => s + p[3], 0); let acc = 0, cut = 1; for (let i = 0; i < b.length - 1; i++) { acc += b[i][3]; if (acc >= tot / 2) { cut = i + 1; break; } cut = i + 1; }
            boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
        }
        return boxes.map(b => { let w = 0, r = 0, g = 0, bl = 0; for (const p of b) { w += p[3]; r += p[0] * p[3]; g += p[1] * p[3]; bl += p[2] * p[3]; } return [Math.round(r / w * 255 / 31), Math.round(g / w * 255 / 31), Math.round(bl / w * 255 / 31)]; });
    }
    /* image -> engine texture ('PT' + bpp + flags + palette + pixels) */
    A.pt = (img, W, H, bpp) => {
        const px = resize(img, W, H), K = bpp === 8 ? 256 : 16, cnt = new Map();
        for (let i = 0; i < W * H; i++) { const k = (px[i * 3] >> 3) << 10 | (px[i * 3 + 1] >> 3) << 5 | px[i * 3 + 2] >> 3; cnt.set(k, (cnt.get(k) || 0) + 1); }
        const pal = medianCut(cnt, K); while (pal.length < K) pal.push([0, 0, 0]);
        const out = new Uint8Array(4 + K * 2 + (bpp === 8 ? W * H : W * H / 2)); out[0] = 80; out[1] = 84; out[2] = bpp; out[3] = 0;
        pal.forEach((c, i) => { const v = (c[0] >> 3) | (c[1] >> 3) << 5 | (c[2] >> 3) << 10 | 0x8000; out[4 + i * 2] = v & 255; out[5 + i * 2] = v >> 8; });
        const base = 4 + K * 2, idx = new Uint8Array(W * H);
        for (let i = 0; i < W * H; i++) { let best = 0, bd = 1e9; const r = px[i * 3], g = px[i * 3 + 1], b = px[i * 3 + 2]; for (let k = 0; k < K; k++) { const c = pal[k], d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2; if (d < bd) { bd = d; best = k; } } idx[i] = best; }
        if (bpp === 8) out.set(idx, base); else for (let i = 0; i < W * H; i += 2) out[base + (i >> 1)] = idx[i] | idx[i + 1] << 4;
        return out;
    };
    /* sel: { sky, land, wall } each a decoded image or null -> ASET payload (flags byte, 3 pad, then the textures that are present, in order) */
    A.payload = sel => {
        const parts = [], flags = (sel.sky ? 1 : 0) | (sel.land ? 2 : 0) | (sel.wall ? 4 : 0);
        for (const [k, bit] of [['sky', 1], ['land', 2], ['wall', 4]]) if (flags & bit) { const s = A.SLOTS[k]; parts.push(A.pt(sel[k], s.w, s.h, s.bpp)); }
        const n = 4 + parts.reduce((s, p) => s + p.length, 0), out = new Uint8Array(n); out[0] = flags; let o = 4; for (const p of parts) { out.set(p, o); o += p.length; } return out;
    };
    /* append (or replace) the ASET section of an NRGDATA1 block */
    A.attach = (block, payload, sid) => {
        sid = sid || 'ASET';
        const v = new DataView(block.buffer, block.byteOffset, block.length), cnt = v.getUint32(16, true), secs = [];
        for (let i = 0; i < cnt; i++) { const o = 20 + i * 12, id = String.fromCharCode(...block.subarray(o, o + 4)); if (id === sid) continue; secs.push({ id, data: block.subarray(v.getUint32(o + 4, true), v.getUint32(o + 4, true) + v.getUint32(o + 8, true)) }); }
        secs.push({ id: sid, data: payload });
        let off = (20 + secs.length * 12 + 15) & ~15; const pos = secs.map(s => { const p = off; off = (off + s.data.length + 15) & ~15; return p; });
        const out = new Uint8Array(off), dv = new DataView(out.buffer); out.set([...'NRGDATA1'].map(c => c.charCodeAt(0)), 0); dv.setUint32(8, v.getUint32(8, true), true); dv.setUint32(12, off, true); dv.setUint32(16, secs.length, true);
        secs.forEach((s, i) => { out.set([...s.id].map(c => c.charCodeAt(0)), 20 + i * 12); dv.setUint32(24 + i * 12, pos[i], true); dv.setUint32(28 + i * 12, s.data.length, true); out.set(s.data, pos[i]); });
        return out;
    };
    if (typeof module !== 'undefined') module.exports = A; else root.NRAssets = A;
})(typeof window !== 'undefined' ? window : globalThis);

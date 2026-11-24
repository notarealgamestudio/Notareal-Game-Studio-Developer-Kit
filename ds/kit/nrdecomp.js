/* nrdecomp.js - decoders for the compression formats found in console ROMs.
 * D.lz10 (GBA/NDS BIOS LZ77), D.lz11 (NDS/3DS extended LZ), D.rle (GBA/NDS BIOS RLE), D.yaz0 (Nintendo), D.mio0 (N64),
 * D.huff (NDS/GBA BIOS Huffman 4/8-bit), D.scan(buf, opts) -> candidate streams found anywhere in a ROM.
 * Every decoder returns a Uint8Array or null (never throws, never loops forever, output capped). */
(function (root) {
    'use strict';
    const D = {}, CAP = 1 << 22;
    const u32le = (b, o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0, u32be = (b, o) => (b[o] << 24 | b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3]) >>> 0;
    D.lz10 = (b, o = 0) => { if (b[o] !== 0x10) return null; const n = b[o + 1] | b[o + 2] << 8 | b[o + 3] << 16; if (!n || n > CAP) return null; const out = new Uint8Array(n); let i = o + 4, w = 0;
        while (w < n) { if (i >= b.length) return null; const fl = b[i++]; for (let k = 7; k >= 0 && w < n; k--) { if (fl >> k & 1) { if (i + 1 >= b.length) return null; const a = b[i++], c = b[i++], len = (a >> 4) + 3, disp = ((a & 15) << 8 | c) + 1; if (disp > w) return null; for (let j = 0; j < len && w < n; j++, w++) out[w] = out[w - disp]; } else { if (i >= b.length) return null; out[w++] = b[i++]; } } }
        return out; };
    D.lz11 = (b, o = 0) => { if (b[o] !== 0x11) return null; let n = b[o + 1] | b[o + 2] << 8 | b[o + 3] << 16, i = o + 4; if (!n) { n = u32le(b, i); i += 4; } if (!n || n > CAP) return null; const out = new Uint8Array(n); let w = 0;
        while (w < n) { if (i >= b.length) return null; const fl = b[i++]; for (let k = 7; k >= 0 && w < n; k--) { if (fl >> k & 1) { if (i + 1 >= b.length) return null; const a = b[i++]; let len, disp; if (a >> 4 === 0) { const c = b[i++], d = b[i++]; if (d === undefined) return null; len = ((a & 15) << 4 | c >> 4) + 17; disp = ((c & 15) << 8 | d) + 1; } else if (a >> 4 === 1) { const c = b[i++], d = b[i++], e = b[i++]; if (e === undefined) return null; len = ((a & 15) << 12 | c << 4 | d >> 4) + 273; disp = ((d & 15) << 8 | e) + 1; } else { const c = b[i++]; if (c === undefined) return null; len = (a >> 4) + 1; disp = ((a & 15) << 8 | c) + 1; } if (disp > w) return null; for (let j = 0; j < len && w < n; j++, w++) out[w] = out[w - disp]; } else { if (i >= b.length) return null; out[w++] = b[i++]; } } }
        return out; };
    D.rle = (b, o = 0) => { if (b[o] !== 0x30) return null; const n = b[o + 1] | b[o + 2] << 8 | b[o + 3] << 16; if (!n || n > CAP) return null; const out = new Uint8Array(n); let i = o + 4, w = 0;
        while (w < n) { if (i >= b.length) return null; const f = b[i++]; if (f & 0x80) { const len = (f & 0x7f) + 3, v = b[i++]; if (v === undefined) return null; for (let j = 0; j < len && w < n; j++) out[w++] = v; } else { const len = (f & 0x7f) + 1; for (let j = 0; j < len && w < n; j++) { if (i >= b.length) return null; out[w++] = b[i++]; } } }
        return out; };
    D.yaz0 = (b, o = 0) => { if (!(b[o] === 0x59 && b[o + 1] === 0x61 && b[o + 2] === 0x7a && b[o + 3] === 0x30)) return null; const n = u32be(b, o + 4); if (!n || n > CAP) return null; const out = new Uint8Array(n); let i = o + 16, w = 0;
        while (w < n) { if (i >= b.length) return null; const fl = b[i++]; for (let k = 7; k >= 0 && w < n; k--) { if (fl >> k & 1) { if (i >= b.length) return null; out[w++] = b[i++]; } else { if (i + 1 >= b.length) return null; const a = b[i++], c = b[i++]; let len = a >> 4; const dist = ((a & 15) << 8 | c) + 1; if (len === 0) { if (i >= b.length) return null; len = b[i++] + 18; } else len += 2; if (dist > w) return null; for (let j = 0; j < len && w < n; j++, w++) out[w] = out[w - dist]; } } }
        return out; };
    D.mio0 = (b, o = 0) => { if (!(b[o] === 0x4d && b[o + 1] === 0x49 && b[o + 2] === 0x4f && b[o + 3] === 0x30)) return null; const n = u32be(b, o + 4), co = u32be(b, o + 8), uo = u32be(b, o + 12); if (!n || n > CAP || co > b.length || uo > b.length) return null; const out = new Uint8Array(n); let bi = o + 16, ci = o + co, ui = o + uo, w = 0, bits = 0, left = 0;
        while (w < n) { if (!left) { if (bi + 3 >= b.length) return null; bits = u32be(b, bi); bi += 4; left = 32; } const bit = bits >>> 31 & 1; bits = bits << 1 >>> 0; left--; if (bit) { if (ui >= b.length) return null; out[w++] = b[ui++]; } else { if (ci + 1 >= b.length) return null; const a = b[ci++], c = b[ci++], len = (a >> 4) + 3, dist = ((a & 15) << 8 | c) + 1; if (dist > w) return null; for (let j = 0; j < len && w < n; j++, w++) out[w] = out[w - dist]; } }
        return out; };
    D.huff = (b, o = 0) => { const t = b[o], bitsz = t & 15; if ((t >> 4) !== 2 || (bitsz !== 4 && bitsz !== 8)) return null; const n = b[o + 1] | b[o + 2] << 8 | b[o + 3] << 16; if (!n || n > CAP) return null; const tsz = (b[o + 4] + 1) * 2, tb = o + 4, out = new Uint8Array(n); let i = o + 4 + tsz, w = 0, cur = 0, nib = 0;
        if (tb + tsz > b.length) return null; let node = tb + 1, bitsLeft = 0, word = 0, outw = 0, outn = 0;
        while (w < n) { if (!bitsLeft) { if (i + 3 >= b.length) return null; word = u32le(b, i); i += 4; bitsLeft = 32; } const bit = word >>> 31 & 1; word = word << 1 >>> 0; bitsLeft--; const nd = b[node], off = nd & 0x3f, next = (node & ~1) + off * 2 + 2 + bit; const leaf = bit ? nd & 0x40 : nd & 0x80; if (next >= tb + tsz) return null;
            if (leaf) { const v = b[next]; if (bitsz === 8) out[w++] = v; else { outw |= v << (outn * 4); if (++outn === 2) { out[w++] = outw; outw = 0; outn = 0; } } node = tb + 1; } else node = next; }
        return out; };
    D.FORMATS = { lz10: D.lz10, lz11: D.lz11, rle: D.rle, yaz0: D.yaz0, mio0: D.mio0, huff: D.huff };
    const MAGIC = { 0x10: 'lz10', 0x11: 'lz11', 0x30: 'rle' };
    /* scan(buf, {minOut, maxFound, align, fmts}) -> [{off, fmt, size, data}] */
    D.scan = (b, o = {}) => { const minOut = o.minOut || 256, maxF = o.maxFound || 200, align = o.align || 4, fm = o.fmts || ['lz10', 'lz11', 'rle', 'yaz0', 'mio0', 'huff'], out = [];
        for (let i = 0; i + 8 < b.length && out.length < maxF; i += align) { const c = b[i]; let f = null;
            if (c === 0x59 && b[i + 1] === 0x61 && b[i + 2] === 0x7a && b[i + 3] === 0x30) f = 'yaz0'; else if (c === 0x4d && b[i + 1] === 0x49 && b[i + 2] === 0x4f && b[i + 3] === 0x30) f = 'mio0'; else if (c === 0x10) f = 'lz10'; else if (c === 0x11) f = 'lz11'; else if (c === 0x30) f = 'rle'; else if ((c === 0x24 || c === 0x28)) f = 'huff';
            if (!f || !fm.includes(f)) continue; const n = f === 'yaz0' || f === 'mio0' ? u32be(b, i + 4) : (b[i + 1] | b[i + 2] << 8 | b[i + 3] << 16); if (n < minOut || n > CAP) continue;
            const d = D[f](b, i); if (d) { out.push({ off: i, fmt: f, size: d.length, data: d }); } }
        return out; };
    if (typeof module !== 'undefined') module.exports = D; else root.NRDecomp = D;
})(typeof self !== 'undefined' ? self : this);

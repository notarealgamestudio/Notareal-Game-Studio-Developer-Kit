/* NOTAREAL Dev Kit: SNES builder. Turns a studio project into the data block of the SNES engine (nr_side2d.sfc):
 * 4bpp tiles and palettes (tileset in up to 3 palettes, background in up to 4), OBJ sprites packed into the 512-tile
 * sprite area, levels, and a complete sound image for the SPC700 driver (BRR samples from the studio instruments,
 * song byte-code for 6 voices, sound effects). Pure JS: runs in the editor and in node. */
(function (root) {
'use strict';
const S = {};
const NRK = () => (typeof module !== 'undefined') ? require('./nrkit.js') : root.NRKit;
const MUS = () => (typeof module !== 'undefined') ? require('./nrmusic.js') : root.NRMusic;
const rgb15 = (r, g, b) => (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10);
class W { constructor() { this.a = []; } u8(v) { this.a.push(v & 255); } u16(v) { this.u8(v); this.u8(v >> 8); } u32(v) { this.u16(v & 0xFFFF); this.u16(v >>> 16); } bytes(b) { for (const x of b) this.a.push(x & 255); } str(s, n) { for (let i = 0; i < n; i++) this.u8(i < s.length ? s.charCodeAt(i) : 0); } out() { return Uint8Array.from(this.a); } }

/* ------------------------------------------------------------------ graphics helpers */
function tile4(idx, w, x0, y0) {            // 8x8 indices (0-15) -> 32 bytes SNES 4bpp
    const t = new Uint8Array(32);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = idx[(y0 + y) * w + x0 + x] & 15; for (let p = 0; p < 4; p++) if (v >> p & 1) t[(p >> 1) * 16 + y * 2 + (p & 1)] |= 0x80 >> x; }
    return t;
}
/* split an image into groups (k-means on mean colour of each block) and give each group its own 15-colour palette.
   returns { pals: [[rgb]*15]..., blockPal: [], index: Uint8Array (0 = transparent, 1-15) } */
function multiPalette(im, bw, bh, groups) {
    const Q = NRK()._q, nbx = im.w / bw, nby = im.h / bh, nb = nbx * nby, mean = [];
    for (let b = 0; b < nb; b++) {
        const bx = (b % nbx) * bw, by = Math.floor(b / nbx) * bh; let r = 0, g = 0, bl = 0, n = 0;
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = ((by + y) * im.w + bx + x) * 4; if (im.data[i + 3] < 128) continue; r += im.data[i]; g += im.data[i + 1]; bl += im.data[i + 2]; n++; }
        mean.push(n ? [r / n, g / n, bl / n, n] : null);
    }
    // k-means
    const used = mean.filter(Boolean); let C = [];
    for (let k = 0; k < groups; k++) { const m = used[Math.floor((k + 0.5) * used.length / groups)]; C.push(m ? m.slice(0, 3) : [0, 0, 0]); }
    const asg = new Array(nb).fill(0);
    for (let it = 0; it < 12; it++) {
        mean.forEach((m, b) => { if (!m) return; let bi = 0, bd = 1e12; C.forEach((c, k) => { const d = (c[0] - m[0]) ** 2 + (c[1] - m[1]) ** 2 + (c[2] - m[2]) ** 2; if (d < bd) { bd = d; bi = k; } }); asg[b] = bi; });
        C = C.map((c, k) => { let s = [0, 0, 0], n = 0; mean.forEach((m, b) => { if (m && asg[b] === k) { s[0] += m[0] * m[3]; s[1] += m[1] * m[3]; s[2] += m[2] * m[3]; n += m[3]; } }); return n ? s.map(v => v / n) : c; });
    }
    const pals = [], index = new Uint8Array(im.w * im.h);
    for (let k = 0; k < groups; k++) {
        const counts = new Map();
        mean.forEach((m, b) => { if (!m || asg[b] !== k) return; const bx = (b % nbx) * bw, by = Math.floor(b / nbx) * bh; for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = ((by + y) * im.w + bx + x) * 4; if (im.data[i + 3] < 128) continue; const key = rgb15(im.data[i], im.data[i + 1], im.data[i + 2]); counts.set(key, (counts.get(key) || 0) + 1); } });
        const pal = Q.medianCut(counts, 15); while (pal.length < 15) pal.push([0, 0, 0]); pals.push(pal);
        const P = [null, ...pal];
        mean.forEach((m, b) => { if (asg[b] !== k) return; const bx = (b % nbx) * bw, by = Math.floor(b / nbx) * bh; for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const p = (by + y) * im.w + bx + x, i = p * 4; index[p] = im.data[i + 3] < 128 ? 0 : Q.nearest(P, im.data[i], im.data[i + 1], im.data[i + 2], 1); } });
    }
    return { pals, blockPal: asg, index };
}

/* ------------------------------------------------------------------ BRR */
function brrEncode(x, loopStart) {      // x: Float32 -1..1; loopStart multiple of 16 or -1
    const n = Math.ceil(x.length / 16) * 16 || 16, out = []; let p1 = 0, p2 = 0;
    const nb = n / 16, lb = loopStart >= 0 ? loopStart / 16 : -1;
    for (let b = 0; b < nb; b++) {
        const seg = []; for (let i = 0; i < 16; i++) { const v = x[b * 16 + i] || 0; seg.push(Math.max(-16000, Math.min(16000, v * 16000))); }
        let best = null;
        const filters = (b === 0 || b === lb) ? [0] : [0, 1];
        for (const f of filters) for (let shift = 0; shift <= 12; shift++) {
            let q1 = p1, q2 = p2, err = 0; const nib = [];
            for (let i = 0; i < 16; i++) {
                const pred = f === 1 ? q1 + ((-q1) >> 4) : 0;
                let nn = Math.round((seg[i] - pred) * 2 / (1 << shift)); nn = Math.max(-8, Math.min(7, nn));
                let s = ((nn << shift) >> 1) + pred; if (s > 32767 || s < -32768) err += 1e12; s = Math.max(-32768, Math.min(32767, s));
                let s2 = (s << 1) & 0xFFFF; if (s2 & 0x8000) s2 -= 0x10000;
                q2 = q1; q1 = s2 >> 1; err += (q1 - seg[i]) ** 2; nib.push(nn & 15);
            }
            if (!best || err < best.err) best = { err, f, shift, nib, q1, q2 };
        }
        let hdr = (best.shift << 4) | (best.f << 2);
        if (b === nb - 1) { hdr |= 1; if (lb >= 0) hdr |= 2; }
        out.push(hdr); for (let i = 0; i < 8; i++) out.push((best.nib[i * 2] << 4) | best.nib[i * 2 + 1]);
        p1 = best.q1; p2 = best.q2;
    }
    return Uint8Array.from(out);
}
S.brrEncode = brrEncode;
const PITCH = Array.from({ length: 84 }, (_, k) => Math.round(4096 * 0.44 * Math.pow(2, (k - 45) / 12)));
const adsr = (ar, dr, sl, sr) => [0x80 | (dr << 4) | ar, (sl << 5) | sr];

/* ------------------------------------------------------------------ sound image for the SPC driver (loaded at $0800) */
S.buildSound = (P, assets, budget = 0xE800 - 0x0B00) => {
    const M = MUS(), songs = P.songs.map(s => M.upgradeSong(JSON.parse(JSON.stringify(s))));
    // 1. which instruments / drum sounds are used
    const melUsed = new Set(), kitUsed = new Map();
    for (const s of songs) s.ch.forEach((row, c) => { const id = s.inst[c]; if (M.isKit(id)) { const set = kitUsed.get(id) || new Set(); row.forEach(v => { if (v && v < 128) set.add(v); }); kitUsed.set(id, set); } else if (row.some(v => v && v < 128)) melUsed.add(id); });
    let quality = 2;   // 2: P=32 / kits 7040 Hz / 0.9 s; 1: P=16 / 5274 Hz / 0.6 s; 0: P=16 / 3520 Hz / 0.35 s
    for (;;) {
        const P_S = quality === 2 ? 32 : 16, KD = quality === 2 ? 33 : quality === 1 ? 28 : 21, KR = PITCH[KD] / 4096 * 32000, MAXS = [0.35, 0.6, 0.9][quality];
        const samples = [], inst = [], instOf = new Map();
        for (const id of melUsed) {
            const r = M.renderAt(id, P_S, KR, MAXS); if (!r) continue;
            const loop = r.loop >= 0 ? Math.floor(r.loop / 16) * 16 : -1;
            samples.push({ brr: brrEncode(r.data, loop), loop });
            const sus = r.loop >= 0, env = sus ? adsr(13, 7, 7, 0) : adsr(15, 7, 7, 0);
            instOf.set(id, inst.length); inst.push({ smp: samples.length - 1, a1: env[0], a2: env[1], off: P_S === 32 ? 0 : -12 });
        }
        const drumOf = new Map();
        for (const [id, set] of kitUsed) {
            const r = M.renderAt(id, 32, KR, MAXS * 0.5); if (!r) continue;
            for (const v of [...set].sort((a, b) => a - b)) { const snd = r.sounds[v - 1]; if (!snd) continue; samples.push({ brr: brrEncode(snd.data, -1), loop: -1 }); drumOf.set(id + ':' + v, inst.length); inst.push({ smp: samples.length - 1, a1: adsr(15, 7, 7, 0)[0], a2: adsr(15, 7, 7, 0)[1], off: 0 }); }
        }
        // sound effects (WAV clips from the project) at 8 kHz
        const sfx = [], ORDER = ['jump', 'coin', 'stomp', 'hurt', 'spring', '1up', 'goal'];
        for (const k of ORDER) {
            const ref = P.sfx && P.sfx[k]; const w = ref && assets.snd ? assets.snd(ref) : null;
            if (!w) { sfx.push(null); continue; }
            const rate = 8000, src = w.samples, sr = w.rate, n = Math.min(Math.floor(src.length * rate / sr), rate * (quality ? 1 : 0.5)), d = new Float32Array(n);
            let pk = 1e-6; for (let i = 0; i < n; i++) { d[i] = src[Math.floor(i * sr / rate)] || 0; pk = Math.max(pk, Math.abs(d[i])); } for (let i = 0; i < n; i++) d[i] /= pk;
            samples.push({ brr: brrEncode(d, -1), loop: -1 }); sfx.push({ smp: samples.length - 1, pitch: Math.round(4096 * rate / 32000), ticks: Math.min(255, Math.ceil(n / rate * 100) + 2) });
        }
        if (inst.length > 22 || samples.length > 64) { if (quality > 0) { quality--; continue; } throw new Error('Too many different instruments for the SNES (max 22 including drum sounds): use fewer drum sounds or instruments.'); }
        // 2. song byte-code
        const offOf = new Map([...instOf.entries()].map(([id, k]) => [id, inst[k].off]));
        const songBytes = songs.slice(0, 32).map(s => compileSong(s, M, instOf, drumOf, KD, offOf));
        // 3. layout
        const base = 0x0800, blob = new Uint8Array(0xE800 - base); let at = 0x300;
        const put = b => { const a = base + at; blob.set(b, at); at += b.length; return a; };
        PITCH.forEach((p, k) => { blob[0x100 + k * 2] = p & 255; blob[0x101 + k * 2] = p >> 8; });
        inst.forEach((it, k) => { blob.set([it.smp, it.a1, it.a2, it.off & 255], 0x1A8 + k * 4); });
        sfx.forEach((e, k) => { if (!e) return; blob.set([e.smp, e.pitch & 255, e.pitch >> 8, 0, 110, 0, e.ticks, 4], 0x240 + k * 8); });
        const over = () => at > blob.length;
        songBytes.forEach((sb, si) => {
            const voices = sb.voices.map(v => v.length ? v : null), heads = [];
            const vaddr = voices.map(v => v ? put(Uint8Array.from(v)) : 0);
            const hdr = new Uint8Array(16); vaddr.forEach((a, i) => { hdr[i * 2] = a & 255; hdr[i * 2 + 1] = a >> 8; });
            hdr[12] = sb.div; hdr[13] = 0x18; hdr[14] = 0x30; hdr[15] = sb.echo;
            const ha = put(hdr); blob[0x200 + si * 2] = ha & 255; blob[0x201 + si * 2] = ha >> 8;
        });
        let fits = true;
        samples.forEach((s, k) => { if (at + s.brr.length > blob.length) { fits = false; return; } const a = put(s.brr), lp = s.loop >= 0 ? a + s.loop / 16 * 9 : a; blob.set([a & 255, a >> 8, lp & 255, lp >> 8], k * 4); });
        if (!fits || over()) { if (quality > 0) { quality--; continue; } throw new Error('The music and sounds do not fit in the SNES sound memory (64 KB): use fewer or shorter songs.'); }
        return { blob: blob.slice(0, at), used: at, quality, instruments: inst.length, samples: samples.length, sfxIds: sfx.map((e, k) => e ? k : 0xFF) };
    }
};
/* our song (up to 8 tracks, steps, tempo frames/step) -> 6 driver voices */
function compileSong(s, M, instOf, drumOf, KD, offOf) {
    const stepSec = s.tempo / 60; let T = Math.max(1, Math.ceil(8000 * stepSec / 255)); const div = Math.max(1, Math.min(255, Math.round(8000 * stepSec / T)));
    // pick at most 6 tracks: merge drum tracks of the same kit, then keep the loudest
    let tracks = s.ch.map((row, c) => ({ row: row.slice(), id: s.inst[c], vol: s.vol[c] == null ? 90 : s.vol[c], pan: s.pan[c] == null ? 64 : s.pan[c], kit: M.isKit(s.inst[c]) })).filter(t => t.row.some(v => v && v < 128));
    for (let i = 0; i < tracks.length; i++) for (let j = i + 1; j < tracks.length && tracks.length > 6; j++) if (tracks[i].kit && tracks[j].id === tracks[i].id) { tracks[j].row.forEach((v, k) => { if (v && v < 128 && !(tracks[i].row[k] && tracks[i].row[k] < 128)) tracks[i].row[k] = v; }); tracks.splice(j, 1); j--; }
    while (tracks.length > 6) { let q = 0; tracks.forEach((t, i) => { if (t.vol < tracks[q].vol) q = i; }); tracks.splice(q, 1); }
    const voices = [], len = (t, first, out) => { out.push(first, Math.min(t, 255)); t -= 255; while (t > 0) { out.push(0x61, Math.min(t, 255)); t -= 255; } };
    let echo = 0;
    tracks.forEach((t, vi) => {
        const out = [], steps = s.steps;
        let curInst = -1;
        const setInst = i => { if (i !== curInst) { out.push(0xE0, i); curInst = i; } };
        const firstInst = t.kit ? drumOf.get(t.id + ':' + (t.row.find(v => v && v < 128))) : instOf.get(t.id);
        out.push(0xE0, firstInst || 0, 0xE1, Math.round(t.vol * 0.6), 0xE2, t.pan); curInst = firstInst || 0;
        if (!t.kit && t.vol < 100) echo |= 1 << vi;
        let i = 0;
        // leading silence
        let lead = 0; while (i < steps && !(t.row[i] && t.row[i] < 128)) { lead++; i++; }
        if (lead) len(lead * T, 0x60, out);
        while (i < steps) {
            const v = t.row[i]; let L = 1; while (i + L < steps && t.row[i + L] === 128) L++;
            if (t.kit) { while (i + L < steps && !t.row[i + L]) L++; const ins = drumOf.get(t.id + ':' + v); if (ins == null) { len(L * T, 0x61, out); i += L; continue; } setInst(ins); len(L * T, KD + (0), out); }
            else {
                const ins = instOf.get(t.id); setInst(ins); const off = offOf.get(t.id) || 0;
                let n = v - 24; while (n + off > 83) n -= 12; while (n + off < 0) n += 12;
                len(L * T, n, out);
                let r = 0; while (i + L + r < steps && !t.row[i + L + r]) r++;
                if (r) len(r * T, 0x60, out); L += r;
            }
            i += L;
        }
        out.push(0xFE); voices.push(out);
    });
    while (voices.length < 6) voices.push([]);
    return { voices, div, echo };
}

/* ------------------------------------------------------------------ the data block */
const OBJ_ENGINE = { start: 0, coin: 1, walker: 2, hopper: 3, flyer: 4, spring: 5, heart: 6, check: 7, goal: 8 };
const SHEETS = ['hero', 'walker', 'hopper', 'flyer', 'coin', 'goal', 'spring', 'heart', 'check'];
const SHEET_PAL = { hero: 0, walker: 1, hopper: 2, flyer: 3, coin: 4, heart: 4, goal: 5, spring: 6, check: 7 };
S.build = (P, assets) => {
    const K = NRK(), Q = K._q, warn = [], items = [];
    const add = (tag, bytes) => items.push([tag, bytes]);
    const pals = new Uint16Array(256);
    pals[0] = 0; pals[1] = rgb15(255, 255, 255); pals[2] = rgb15(20, 20, 30); pals[3] = rgb15(40, 40, 40);
    pals[5] = rgb15(255, 230, 90); pals[6] = rgb15(20, 20, 30);
    // tileset -> metatiles in up to 3 palettes (CGRAM palettes 1-3)
    const ts = assets.img(P.tileset.image), nmt = Math.min(192, Math.floor(ts.w / 16));
    const tsc = K.crop(ts, 0, 0, nmt * 16, 16);
    const mp = multiPalette(tsc, 16, 16, Math.min(3, Math.max(1, Math.ceil(nmt / 8))));
    mp.pals.forEach((pal, k) => pal.forEach((c, i) => { pals[(1 + k) * 16 + 1 + i] = rgb15(c[0], c[1], c[2]); }));
    pals[0] = rgb15(...(P.snesBackdrop || [100, 150, 220]));
    const tiles = [new Uint8Array(32)], tkey = new Map([[tiles[0].join(','), 0]]), MT = new W();
    for (let m = 0; m < nmt; m++) {
        const pal = 1 + mp.blockPal[m];
        for (const [ox, oy] of [[0, 0], [8, 0], [0, 8], [8, 8]]) {
            const t = tile4(mp.index, tsc.w, m * 16 + ox, oy), k = t.join(',');
            let n = tkey.get(k); if (n === undefined) { n = tiles.length; tiles.push(t); tkey.set(k, n); }
            MT.u16(n | (pal << 10));
        }
    }
    // reorder metatile words to the engine's layout: [TL, TR? ] engine reads q[r*4 .. ] as (left,right) per row
    const mt = MT.out(), mt2 = new Uint8Array(mt.length);
    for (let m = 0; m < nmt; m++) { const o = m * 8; mt2.set(mt.subarray(o, o + 2), o); mt2.set(mt.subarray(o + 2, o + 4), o + 2); mt2.set(mt.subarray(o + 4, o + 6), o + 4); mt2.set(mt.subarray(o + 6, o + 8), o + 6); }
    const bg1 = new Uint8Array(tiles.length * 32); tiles.forEach((t, i) => bg1.set(t, i * 32));
    add('BG1T', bg1); add('MTIL', mt2); add('MCOL', Uint8Array.from({ length: nmt }, (_, i) => P.tileset.cols[i] || 0));
    // background: 256x224 in up to 4 palettes (4-7) on BG2
    let bg2n = 0, bg2base = Math.ceil(tiles.length / 256) * 0x1000;
    if (P.background) {
        const src = assets.img(P.background), bgi = K.resize(src, 256, 224);
        for (let i = 3; i < bgi.data.length; i += 4) bgi.data[i] = 255;
        let maxTiles = Math.floor((0x4C00 - bg2base) / 16), b;
        b = multiPalette(bgi, 8, 8, 4);
        b.pals.forEach((pal, k) => pal.forEach((c, i) => { pals[(4 + k) * 16 + 1 + i] = rgb15(c[0], c[1], c[2]); }));
        const bt = [], bk = new Map(), map = new W();
        for (let ty = 0; ty < 32; ty++) for (let tx = 0; tx < 32; tx++) {
            if (ty >= 28) { map.u16(0); continue; }
            const blk = ty * 32 + tx, t = tile4(b.index, 256, tx * 8, ty * 8), k = t.join(',');
            let n = bk.get(k);
            if (n === undefined) { if (bt.length < maxTiles) { n = bt.length; bt.push(t); bk.set(k, n); } else { n = 0; } }
            map.u16(n | ((4 + b.blockPal[blk]) << 10));
        }
        if (bt.length >= maxTiles) warn.push('The background has a lot of detail: some 8x8 tiles were simplified for the SNES.');
        const bb = new Uint8Array(bt.length * 32); bt.forEach((t, i) => bb.set(t, i * 32));
        add('BG2T', bb); add('BG2M', map.out()); bg2n = bt.length;
    }
    // sprites: per palette group a 15-colour palette; pack frames into the 16x32-tile OBJ area
    const grid = Array.from({ length: 32 }, () => new Array(16).fill(false)), obj = new Uint8Array(512 * 32), SP = new W();
    const place = (bw, bh) => { for (let r = 0; r + bh <= 32; r++) for (let c = 0; c + bw <= 16; c += bw) { let ok = true; for (let y = 0; y < bh && ok; y++) for (let x = 0; x < bw; x++) if (grid[r + y][c + x]) { ok = false; break; } if (ok) { for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) grid[r + y][c + x] = true; return r * 16 + c; } } throw new Error('Not enough sprite memory on the SNES for all these sprites.'); };
    const groupImgs = {};
    for (const role of SHEETS) { const s = P.sprites[role]; if (!s) continue; (groupImgs[SHEET_PAL[role]] = groupImgs[SHEET_PAL[role]] || []).push(assets.img(s.image)); }
    const objPal = {};
    for (const [g, ims] of Object.entries(groupImgs)) { const pal = Q.medianCut(Q.collect(ims, new Map()), 15); while (pal.length < 15) pal.push([0, 0, 0]); objPal[g] = pal; pal.forEach((c, i) => { pals[128 + g * 16 + 1 + i] = rgb15(c[0], c[1], c[2]); }); }
    for (const role of SHEETS) {
        const s = P.sprites[role]; if (!s) { for (let i = 0; i < 24; i++) SP.u8(0); continue; }
        let im = assets.img(s.image); let fw = s.w, fh = s.h, frames = Math.min(8, s.frames || 1);
        // SNES sprite pieces are 16x16 or 32x32: make each frame 16 or 32 wide, height = width or 2x width
        let pw = fw <= 16 ? 16 : 32, ph = fh <= pw ? pw : pw * 2;
        if (fw !== pw || fh !== ph) { const out = { w: pw * frames, h: ph, data: new Uint8ClampedArray(pw * frames * ph * 4) }; for (let f = 0; f < frames; f++) { const fr = K.crop(im, f * fw, 0, fw, fh), rs = K.resize(fr, Math.min(pw, fw), Math.min(ph, fh)); for (let y = 0; y < rs.h; y++) for (let x = 0; x < rs.w; x++) { const si = (y * rs.w + x) * 4, di = ((ph - rs.h + y) * out.w + f * pw + Math.floor((pw - rs.w) / 2) + x) * 4; for (let c = 0; c < 4; c++) out.data[di + c] = rs.data[si + c]; } } im = out; fw = pw; fh = ph; }
        const pal = SHEET_PAL[role], idx = Q.indexImage(im, [null, ...objPal[pal]], 1), bw = pw / 8, bh = ph / 8, bases = [];
        for (let f = 0; f < frames; f++) {
            const base = place(bw, bh); bases.push(base);
            for (let ty = 0; ty < bh; ty++) for (let tx = 0; tx < bw; tx++) obj.set(tile4(idx, im.w, f * pw + tx * 8, ty * 8), (base + ty * 16 + tx) * 32);
        }
        for (let f = 0; f < 8; f++) SP.u16(bases[Math.min(f, frames - 1)]);
        SP.u8(frames); SP.u8(pw); SP.u8(ph); SP.u8(pal); SP.u32(0);
    }
    add('OBJT', obj); add('SPRT', SP.out());
    // levels (column-major metatile maps, objects as type,x,y)
    P.levels.slice(0, 99).forEach((L, i) => {
        const w = new W(), Wd = Math.min(255, L.w), H = Math.min(16, L.h);
        w.str((L.name || 'LEVEL ' + (i + 1)).toUpperCase(), 16); w.u8(Wd); w.u8(H); w.u8(L.song || 0);
        const objs = L.objects.filter(o => OBJ_ENGINE[o.type] !== undefined && o.x < Wd && o.y < H).slice(0, 255);
        w.u8(objs.length);
        for (let x = 0; x < Wd; x++) for (let y = 0; y < H; y++) w.u8(Math.min(nmt - 1, L.map[y * L.w + x] || 0));
        for (const o of objs) { w.u8(OBJ_ENGINE[o.type]); w.u8(o.x); w.u8(o.y); }
        add('LV' + String(i).padStart(2, '0'), w.out());
    });
    // sound
    const snd = S.buildSound(P, assets);
    for (let k = 0, o = 0; o < snd.blob.length; k++, o += 30000) { const part = snd.blob.subarray(o, Math.min(snd.blob.length, o + 30000)), w = new W(); w.u16(0x0800 + o); w.bytes(part); add('SND' + k, w.out()); }
    const SFX_EV = ['jump', 'coin', 'stomp', 'hurt', 'spring', '1up', 'goal', 'hurt'], ORDER = ['jump', 'coin', 'stomp', 'hurt', 'spring', '1up', 'goal'];
    add('SFXI', Uint8Array.from(SFX_EV.map(e => { const k = ORDER.indexOf(e); return snd.sfxIds[k]; })));
    // cutscenes: text screens (speaker + wrapped text); engine shows them with START / A to advance
    { const cs = (P.cutscenes || []).filter(c => c && String(c.text || '').trim()).slice(0, 8), w = new W(); w.u8(cs.length);
      for (const c of cs) {
          const clean = x => String(x || '').toUpperCase().replace(/[^A-Z0-9 !.:\-?]/g, ' ').replace(/\s+/g, ' ').trim(), WID = 28, words = clean(c.text).split(' '), lines = []; let cur = '';
          for (const t of words) { if ((cur + ' ' + t).trim().length > WID && cur) { lines.push(cur); cur = t.slice(0, WID); } else cur = (cur + ' ' + t).trim(); }
          if (cur) lines.push(cur);
          const out = [], sp = clean(c.speaker); let r = 3;
          if (sp) { out.push([sp.slice(0, WID), r]); r += 2; }
          const stp = lines.length * 2 <= 18 ? 2 : 1; lines.slice(0, 18).forEach(l => { out.push([l, r]); r += stp; }); out.push(['PRESS START', 25]);
          const when = c.when === 'level' ? 1 : c.when === 'ending' ? 2 : 0;
          w.u8(when); w.u8(when === 1 ? Math.max(0, Math.min(255, c.level | 0)) : 0); w.u8(out.length);
          for (const [t, row] of out) { w.u8(Math.floor((32 - t.length) / 2)); w.u8(row); w.u8(t.length); for (const ch of t) w.u8(ch.charCodeAt(0)); }
      }
      if (cs.length) add('CUTS', w.out()); }
    add('PALS', (() => { const b = new Uint8Array(512); pals.forEach((v, i) => { b[i * 2] = v & 255; b[i * 2 + 1] = v >> 8; }); return b; })());
    // meta + physics (1/16 px units)
    const m = new W(), ph = P.meta.physics, hero = P.sprites.hero;
    m.str((P.meta.title || 'MY GAME').toUpperCase().slice(0, 31), 32); m.str((P.meta.author || '').toUpperCase().slice(0, 23), 24);
    m.u8(P.meta.lives || 5); m.u8(Math.min(99, P.levels.length)); m.u8(P.meta.titleSong || 0); m.u8(P.meta.clearSong == null ? 0xFF : P.meta.clearSong);
    for (const k of ['gravity', 'jump', 'jumpRun', 'run', 'runFast', 'accel', 'maxFall']) m.u16(Math.round((ph[k] || 0) * 16) & 0xFFFF);
    const hw = hero.w <= 16 ? 16 : 32, hh = hero.h <= hw ? hw : hw * 2;
    m.u8(hw); m.u8(hh); m.u8(Math.min(8, hero.frames || 5)); m.u8(0);
    m.u16(tiles.length); m.u16(nmt); m.u16(bg2n); m.u8(P.songs.length); m.u8(0); m.u16(bg2base);
    add('META', m.out());
    // pack into banks: each item inside one 32 KB bank window
    const DATA = new Uint8Array(0x100000); DATA.set([78, 82, 71, 83, 78, 69, 83, 49], 0);
    let off = 16 + items.length * 12; off = (off + 15) & ~15;
    const dir = [];
    for (const [tag, bytes] of items) {
        if (bytes.length > 0x8000) throw new Error(tag + ' is too large for one SNES bank');
        if ((off & 0x7FFF) + bytes.length > 0x8000) off = (off + 0x7FFF) & ~0x7FFF;
        if (off + bytes.length > DATA.length) throw new Error('The game is too big for the SNES cartridge (1 MB of data).');
        DATA.set(bytes, off);
        const bank = 0x90 + (off >> 15), addr = 0x8000 + (off & 0x7FFF);
        dir.push([tag, bank, addr, bytes.length]); off += bytes.length; off = (off + 1) & ~1;
    }
    DATA[8] = 1; DATA[10] = dir.length & 255; DATA[11] = dir.length >> 8; DATA[12] = off & 255; DATA[13] = (off >> 8) & 255; DATA[14] = (off >> 16) & 255;
    dir.forEach(([tag, bank, addr, len], i) => { const o = 16 + i * 12; for (let k = 0; k < 4; k++) DATA[o + k] = tag.charCodeAt(k); DATA[o + 4] = addr & 255; DATA[o + 5] = addr >> 8; DATA[o + 6] = bank; DATA[o + 8] = len & 255; DATA[o + 9] = len >> 8; });
    return { block: DATA.subarray(0, off), used: off, capacity: DATA.length, warnings: warn, sound: { bytes: snd.used, quality: snd.quality, instruments: snd.instruments }, bg1Tiles: tiles.length, bg2Tiles: bg2n };
};
S.patch = (rom, block) => {
    const out = Uint8Array.from(rom);
    if (String.fromCharCode(...out.subarray(0x80000, 0x80008)) !== 'NRGSNES1') throw new Error('This is not the NOTAREAL SNES engine ROM');
    out.fill(0, 0x80000, 0x180000); out.set(block, 0x80000);
    // header checksum (LoROM header at $7FC0)
    out[0x7FDC] = 0xFF; out[0x7FDD] = 0xFF; out[0x7FDE] = 0; out[0x7FDF] = 0;
    let sum = 0; for (let i = 0; i < out.length; i++) sum = (sum + out[i]) & 0xFFFF;
    out[0x7FDE] = sum & 255; out[0x7FDF] = sum >> 8; out[0x7FDC] = (~sum) & 255; out[0x7FDD] = ((~sum) >> 8) & 255;
    return { rom: out, used: block.length, capacity: 0x100000 };
};
/* Street basketball engine (snes/basket): the settings live in a small block at ROM offset 0x8000 ("NRGBSKT1"). */
S.patchBasket = (rom, cfg) => {
    const out = Uint8Array.from(rom), c = cfg || {};
    if (String.fromCharCode(...out.subarray(0x8000, 0x8008)) !== 'NRGBSKT1') throw new Error('This is not the NOTAREAL SNES basketball ROM');
    const secs = Math.max(20, Math.min(300, Math.round(c.seconds || 90)));
    out[0x8008] = secs & 255; out[0x8009] = secs >> 8; out[0x800A] = Math.max(1, Math.min(3, c.skill || 1)); out[0x800B] = Math.max(1, Math.min(3, c.turbo || 1));
    const title = String(c.title || 'STREET HOOPS').toUpperCase().replace(/[^ -_]/g, '').slice(0, 23);
    out.fill(0, 0x8010, 0x8028); for (let i = 0; i < title.length; i++) out[0x8010 + i] = title.charCodeAt(i);
    out[0x7FDC] = 0xFF; out[0x7FDD] = 0xFF; out[0x7FDE] = 0; out[0x7FDF] = 0;
    let sum = 0; for (let i = 0; i < out.length; i++) sum = (sum + out[i]) & 0xFFFF;
    out[0x7FDE] = sum & 255; out[0x7FDF] = sum >> 8; out[0x7FDC] = (~sum) & 255; out[0x7FDD] = ((~sum) >> 8) & 255;
    return { rom: out };
};
/* Mode 7 kart engine (snes/kart): settings block at ROM offset 0x8000 ("NRGKART1"): laps, speed class 1-3, rivals 1-5, rival skill 1-3, title. */
S.patchKart = (rom, cfg) => {
    const out = Uint8Array.from(rom), c = cfg || {};
    if (String.fromCharCode(...out.subarray(0x8000, 0x8008)) !== 'NRGKART1') throw new Error('This is not the NOTAREAL SNES kart ROM');
    out[0x8008] = Math.max(1, Math.min(9, Math.round(c.laps || 3))); out[0x8009] = Math.max(1, Math.min(3, Math.round(c.cc || 2)));
    out[0x800A] = Math.max(1, Math.min(5, Math.round(c.rivals || 3))); out[0x800B] = Math.max(1, Math.min(3, Math.round(c.skill || 2)));
    const title = String(c.title || 'NOTAREAL KART').toUpperCase().replace(/[^ -_]/g, '').slice(0, 23);
    out.fill(0, 0x8010, 0x8028); for (let i = 0; i < title.length; i++) out[0x8010 + i] = title.charCodeAt(i);
    out[0x7FDC] = 0xFF; out[0x7FDD] = 0xFF; out[0x7FDE] = 0; out[0x7FDF] = 0;
    let sum = 0; for (let i = 0; i < out.length; i++) sum = (sum + out[i]) & 0xFFFF;
    out[0x7FDE] = sum & 255; out[0x7FDF] = sum >> 8; out[0x7FDC] = (~sum) & 255; out[0x7FDD] = ((~sum) >> 8) & 255;
    return { rom: out };
};
if (typeof module !== 'undefined') module.exports = S; else root.NRSnes = S;
})(typeof self !== 'undefined' ? self : this);

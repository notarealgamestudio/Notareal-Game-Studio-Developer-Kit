/* NOTAREAL Dev Kit core (runs in the editor and in node).
 * Project JSON + decoded images/sounds  ->  NRG1 data block  ->  patched DS ROM.
 * Also: image pixelize/recolor/resize, WAV and MIDI import. No compiler needed: the engine ROM is prebuilt. */
(function (root) {
'use strict';
const NR = {};

/* ---------------------------------------------------------------- colour */
const rgb15 = (r, g, b) => (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10);
NR.rgb15 = rgb15;
/* median-cut quantizer over 5-bit colours. colors: Map key=rgb15 -> count. returns array of [r,g,b] */
function medianCut(counts, max) {
    let boxes = [[...counts.entries()].map(([k, n]) => [(k & 31) << 3, ((k >> 5) & 31) << 3, ((k >> 10) & 31) << 3, n])];
    if (boxes[0].length === 0) return [];
    if (boxes[0].length <= max) return boxes[0].map(c => [c[0], c[1], c[2]]);
    while (boxes.length < max) {
        let bi = -1, best = -1, axis = 0;
        boxes.forEach((b, i) => {
            if (b.length < 2) return;
            for (let a = 0; a < 3; a++) {
                let lo = 255, hi = 0; for (const c of b) { if (c[a] < lo) lo = c[a]; if (c[a] > hi) hi = c[a]; }
                const score = (hi - lo) * Math.log2(b.length + 1);
                if (score > best) { best = score; bi = i; axis = a; }
            }
        });
        if (bi < 0) break;
        const b = boxes[bi].sort((p, q) => p[axis] - q[axis]);
        let total = b.reduce((s, c) => s + c[3], 0), acc = 0, cut = 1;
        for (let i = 0; i < b.length - 1; i++) { acc += b[i][3]; if (acc >= total / 2) { cut = i + 1; break; } }
        boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
    }
    return boxes.map(b => { let r = 0, g = 0, bl = 0, n = 0; for (const c of b) { r += c[0] * c[3]; g += c[1] * c[3]; bl += c[2] * c[3]; n += c[3]; } return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)]; });
}
function nearest(pal, r, g, b, from) {
    let bi = from, bd = 1e9;
    for (let i = from; i < pal.length; i++) { const p = pal[i]; if (!p) continue; const d = (p[0] - r) ** 2 * 3 + (p[1] - g) ** 2 * 4 + (p[2] - b) ** 2 * 2; if (d < bd) { bd = d; bi = i; } }
    return bi;
}
function collect(imgs, counts) {
    for (const im of imgs) for (let i = 0; i < im.data.length; i += 4) if (im.data[i + 3] >= 128) { const k = rgb15(im.data[i], im.data[i + 1], im.data[i + 2]); counts.set(k, (counts.get(k) || 0) + 1); }
    return counts;
}
/* map an RGBA image to palette indices (alpha < 128 -> 0) with a per-colour cache */
function indexImage(im, pal, from) {
    const out = new Uint8Array(im.w * im.h), cache = new Map();
    for (let i = 0, p = 0; p < out.length; i += 4, p++) {
        if (im.data[i + 3] < 128) { out[p] = 0; continue; }
        const k = rgb15(im.data[i], im.data[i + 1], im.data[i + 2]);
        let v = cache.get(k); if (v === undefined) { v = nearest(pal, im.data[i], im.data[i + 1], im.data[i + 2], from); cache.set(k, v); }
        out[p] = v;
    }
    return out;
}

/* ---------------------------------------------------------------- image tools (editor importer) */
NR.crop = (im, x, y, w, h) => {
    const o = { w, h, data: new Uint8ClampedArray(w * h * 4) };
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const sx = x + i, sy = y + j, d = (j * w + i) * 4;
        if (sx < 0 || sy < 0 || sx >= im.w || sy >= im.h) continue;
        const s = (sy * im.w + sx) * 4; o.data[d] = im.data[s]; o.data[d + 1] = im.data[s + 1]; o.data[d + 2] = im.data[s + 2]; o.data[d + 3] = im.data[s + 3];
    }
    return o;
};
/* area-average resize (good for shrinking photos into pixel art) */
NR.resize = (im, w, h) => {
    const o = { w, h, data: new Uint8ClampedArray(w * h * 4) };
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const x0 = Math.floor(i * im.w / w), x1 = Math.max(x0 + 1, Math.floor((i + 1) * im.w / w)), y0 = Math.floor(j * im.h / h), y1 = Math.max(y0 + 1, Math.floor((j + 1) * im.h / h));
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const s = (y * im.w + x) * 4; const al = im.data[s + 3]; r += im.data[s] * al; g += im.data[s + 1] * al; b += im.data[s + 2] * al; a += al; n++; }
        const d = (j * w + i) * 4;
        if (a) { o.data[d] = r / a; o.data[d + 1] = g / a; o.data[d + 2] = b / a; } o.data[d + 3] = a / n;
    }
    return o;
};
/* pixelize: resize to w x h, cut to ncolors, optional ordered dither, hard alpha */
NR.pixelize = (im, w, h, ncolors, dither) => {
    const s = NR.resize(im, w, h);
    const pal = medianCut(collect([s], new Map()), ncolors);
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const d = (j * w + i) * 4;
        if (s.data[d + 3] < 128) { s.data[d + 3] = 0; continue; }
        const t = dither ? (B[(j & 3) * 4 + (i & 3)] - 7.5) * 3 : 0;
        const p = pal[nearest(pal, s.data[d] + t, s.data[d + 1] + t, s.data[d + 2] + t, 0)];
        s.data[d] = p[0]; s.data[d + 1] = p[1]; s.data[d + 2] = p[2]; s.data[d + 3] = 255;
    }
    return s;
};
NR.palette = (imgs, n) => medianCut(collect(imgs, new Map()), n);
NR._q = { medianCut, collect, indexImage, nearest };

/* ---------------------------------------------------------------- sound tools */
NR.parseWav = (buf) => {
    const dv = new DataView(buf.buffer || buf, buf.byteOffset || 0, buf.byteLength);
    let p = 12, fmt = null, data = null;
    while (p + 8 <= dv.byteLength) {
        const id = String.fromCharCode(dv.getUint8(p), dv.getUint8(p + 1), dv.getUint8(p + 2), dv.getUint8(p + 3)), sz = dv.getUint32(p + 4, true);
        if (id === 'fmt ') fmt = { ch: dv.getUint16(p + 10, true), rate: dv.getUint32(p + 12, true), bits: dv.getUint16(p + 22, true) };
        if (id === 'data') data = { off: p + 8, len: Math.min(sz, dv.byteLength - p - 8) };
        p += 8 + sz + (sz & 1);
    }
    if (!fmt || !data) throw new Error('not a PCM WAV file');
    const bps = fmt.bits / 8, n = Math.floor(data.len / (bps * fmt.ch)), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        let s = 0;
        for (let c = 0; c < fmt.ch; c++) { const o = data.off + (i * fmt.ch + c) * bps; s += bps === 1 ? (dv.getUint8(o) - 128) / 128 : bps === 2 ? dv.getInt16(o, true) / 32768 : dv.getFloat32(o, true); }
        out[i] = s / fmt.ch;
    }
    return { rate: fmt.rate, samples: out };
};
/* to signed 8-bit at the DS rate, normalised, max seconds */
NR.toPCM8 = (snd, rate = 16384, maxSec = 3) => {
    const n = Math.min(Math.floor(snd.samples.length * rate / snd.rate), rate * maxSec), out = new Int8Array(n);
    let peak = 0.01; for (const v of snd.samples) peak = Math.max(peak, Math.abs(v));
    for (let i = 0; i < n; i++) { const v = snd.samples[Math.floor(i * snd.rate / rate)] / peak; out[i] = Math.max(-127, Math.min(127, Math.round(v * 120))); }
    return { rate, pcm: out };
};
/* MIDI file -> kit song (4 channels at 16th-note steps; lead = highest track notes, bass = lowest, drums = GM ch 10) */
NR.parseMidi = (u8, maxSteps = 512) => {
    const rd = (p, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + u8[p + i]; return v; };
    if (String.fromCharCode(...u8.slice(0, 4)) !== 'MThd') throw new Error('not a MIDI file');
    const ntr = rd(10, 2), div = rd(12, 2); let p = 8 + rd(4, 4), tempo = 500000;
    const notes = [];
    for (let t = 0; t < ntr; t++) {
        const end = p + 8 + rd(p + 4, 4); p += 8; let tick = 0, run = 0;
        while (p < end) {
            let dt = 0, b; do { b = u8[p++]; dt = dt * 128 + (b & 127); } while (b & 128); tick += dt;
            let st = u8[p]; if (st < 128) st = run; else p++; run = st;
            const ty = st & 0xF0, ch = st & 15;
            if (st === 0xFF) { const mt = u8[p++]; let len = 0; do { b = u8[p++]; len = len * 128 + (b & 127); } while (b & 128); if (mt === 0x51) tempo = rd(p, 3); p += len; }
            else if (st === 0xF0 || st === 0xF7) { let len = 0; do { b = u8[p++]; len = len * 128 + (b & 127); } while (b & 128); p += len; }
            else if (ty === 0x90 && u8[p + 1] > 0) { notes.push({ tick, ch, note: u8[p], track: t }); p += 2; }
            else if (ty === 0xC0 || ty === 0xD0) p += 1; else p += 2;
        }
        p = end;
    }
    const step = div / 4, steps = Math.min(maxSteps, Math.ceil((Math.max(0, ...notes.map(n => n.tick)) + 1) / step / 16) * 16 || 16);
    const ch = [0, 1, 2, 3].map(() => new Array(steps).fill(0));
    const at = new Map();
    for (const n of notes) { const s = Math.round(n.tick / step); if (s >= steps) continue; if (!at.has(s)) at.set(s, []); at.get(s).push(n); }
    for (const [s, list] of at) {
        const drums = list.filter(n => n.ch === 9), mel = list.filter(n => n.ch !== 9).sort((a, b) => b.note - a.note);
        if (mel.length) { ch[0][s] = mel[0].note; if (mel.length > 1) ch[1][s] = mel[mel.length - 1].note; if (mel.length > 2) ch[2][s] = mel[1].note; }
        if (drums.length) { const d = drums[0].note; ch[3][s] = d <= 36 ? 1 : d <= 40 ? 2 : 3; }
    }
    const fps = 60, frames = Math.max(3, Math.min(20, Math.round(tempo / 1e6 / 4 * fps)));
    return { name: 'Imported song', tempo: frames, steps, ch };
};

/* ---------------------------------------------------------------- DS NRG1 builder */
/* Technique Library: movement presets built from measured behaviour in the ROM catalog (numbers only, our own code) */
NR.PHYSICS = {
    classic: { name: 'Classic platformer', source: 'Super Mario World (SNES): run/P-speed, speed-dependent jump, hold-to-jump gravity 3/6',
               gravity: 0.1875, jump: 5.0, jumpRun: 6.06, run: 1.25, runFast: 2.25, accel: 0.094, maxFall: 4 },
    floaty:  { name: 'Floaty adventurer', source: "Link's Awakening DX (GBC) side-view rooms: 1 px/frame walk, slow air steering",
               gravity: 0.125, jump: 3.6, jumpRun: 0, run: 1.0, runFast: 1.5, accel: 0.0625, maxFall: 3 },
    skate:   { name: 'Skate run', source: 'Notareal skate engine (nrarcade skate): long glide, low friction, big ollie, kicker ramps',
               gravity: 0.2, jump: 4.8, jumpRun: 6.2, run: 1.9, runFast: 2.8, accel: 0.035, maxFall: 5 },
    snappy:  { name: 'Snappy arcade', source: 'Notareal default: fast start, short air time (good for kids)',
               gravity: 0.25, jump: 4.6, jumpRun: 5.2, run: 1.5, runFast: 2.25, accel: 0.12, maxFall: 5 },
};
const ROLE_ORDER = ['hero', 'walker', 'hopper', 'flyer', 'coin', 'goal', 'spring', 'heart', 'check'];
const SFX_ORDER = ['jump', 'coin', 'stomp', 'hurt', 'goal', 'spring', '1up'];
const OBJ_TYPES = { start: 0, coin: 1, walker: 2, hopper: 3, goal: 4, spring: 5, heart: 6, check: 7, flyer: 8 };
NR.OBJ_TYPES = OBJ_TYPES; NR.ROLE_ORDER = ROLE_ORDER; NR.SFX_ORDER = SFX_ORDER;

class Writer {
    constructor() { this.a = []; this.n = 0; }
    u8(v) { this.a.push(v & 255); } u16(v) { this.u8(v); this.u8(v >> 8); } u32(v) { this.u16(v & 0xffff); this.u16(v >>> 16); }
    bytes(b) { for (const v of b) this.a.push(v & 255); } str(s, n) { for (let i = 0; i < n; i++) this.u8(i < s.length ? s.charCodeAt(i) & 127 : 0); }
    align(n = 4) { while (this.a.length % n) this.a.push(0); } get length() { return this.a.length; } out() { return Uint8Array.from(this.a); }
}
function tiles8(idx, w, x0, y0) {        // one 8x8 tile of an indexed image, row-major
    const t = new Uint8Array(64);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) t[y * 8 + x] = idx[(y0 + y) * w + x0 + x];
    return t;
}
function frame1D(idx, w, fx, fw, fh) {    // sprite frame in OBJ 1D order: 8x8 tiles row-major
    const out = [];
    for (let ty = 0; ty < fh / 8; ty++) for (let tx = 0; tx < fw / 8; tx++) out.push(...tiles8(idx, w, fx + tx * 8, ty * 8));
    return out;
}

/* project: see docs. assets.img(ref) -> {w,h,data}, assets.snd(ref) -> {rate, pcm Int8Array} */
NR.music = () => (typeof module !== 'undefined' && typeof require === 'function') ? require('./nrmusic.js') : root.NRMusic;
NR.touch = () => (typeof module !== 'undefined' && typeof require === 'function') ? require('./nrtouch.js') : root.NRTouch;
NR.buildDS = (project, assets) => {
    const warn = [];
    const P = project, sections = [];
    /* --- tiles + background palette */
    const ts = assets.img(P.tileset.image), ntile = Math.min(192, Math.floor(ts.w / 16));   // DS engine VRAM layout holds 192 metatiles
    const tileImgs = []; for (let i = 0; i < ntile; i++) tileImgs.push(NR.crop(ts, i * 16, 0, 16, 16));
    let bg = P.background ? assets.img(P.background) : null;
    if (bg && (bg.w !== 256 || bg.h !== 192)) bg = NR.resize(bg, 256, 192);
    const bpal = new Array(256).fill(null);
    const back = P.meta.backdrop || (bg ? [bg.data[0], bg.data[1], bg.data[2]] : [100, 170, 240]);
    bpal[0] = back;
    medianCut(collect(tileImgs, new Map()), 127).forEach((c, i) => bpal[1 + i] = c);
    if (bg) { const bgOpaque = { w: 256, h: 192, data: Uint8ClampedArray.from(bg.data, (v, i) => (i & 3) === 3 ? 255 : v) }; bg = bgOpaque; medianCut(collect([bg], new Map()), 128).forEach((c, i) => bpal[128 + i] = c); }
    const BPAL = new Writer(); for (let i = 0; i < 256; i++) { const c = bpal[i] || [0, 0, 0]; BPAL.u16(rgb15(c[0], c[1], c[2])); }
    sections.push(['BPAL', BPAL.out()]);
    const tilePal = bpal.slice(0, 128).map((c, i) => i === 0 ? null : c);
    const MTIL = new Writer(); MTIL.u16(ntile); MTIL.u16(0);
    for (const im of tileImgs) { const idx = indexImage(im, tilePal, 1); for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) MTIL.bytes(tiles8(idx, 16, x, y)); }
    sections.push(['MTIL', MTIL.out()]);
    const cols = P.tileset.cols || []; const MCOL = new Writer(); for (let i = 0; i < ntile; i++) MCOL.u8(cols[i] || 0); MCOL.align();
    sections.push(['MCOL', MCOL.out().slice(0, ntile)]);
    if (bg) {
        const bgPal = bpal.map((c, i) => i < 128 ? null : c), idx = indexImage(bg, bgPal, 128), W = new Writer();
        for (let ty = 0; ty < 24; ty++) for (let tx = 0; tx < 32; tx++) W.bytes(tiles8(idx, 256, tx * 8, ty * 8));
        sections.push(['BGIM', W.out()]);
    }
    /* --- sprites */
    const sheets = [...ROLE_ORDER, ...(P._extraSheets || [])].map(r => P.sprites[r] ? { role: r, ...P.sprites[r], im: assets.img(P.sprites[r].image) } : null);
    const spal = [null, ...medianCut(collect(sheets.filter(Boolean).map(s => s.im), new Map()), 253)];
    const SPAL = new Writer(); for (let i = 0; i < 256; i++) { const c = spal[i] || [0, 0, 0]; SPAL.u16(i === 0 ? 0 : rgb15(c[0], c[1], c[2])); }
    sections.push(['SPAL', SPAL.out()]);
    const SPRS = new Writer(); SPRS.u8(sheets.length); SPRS.u8(0); SPRS.u16(0);
    for (const s of sheets) {
        if (!s) { SPRS.u8(16); SPRS.u8(16); SPRS.u8(0); SPRS.u8(0); continue; }
        const idx = indexImage(s.im, spal, 1), fr = Math.min(s.frames, Math.floor(s.im.w / s.w));
        SPRS.u8(s.w); SPRS.u8(s.h); SPRS.u8(fr); SPRS.u8(0);
        for (let f = 0; f < fr; f++) SPRS.bytes(frame1D(idx, s.im.w, f * s.w, s.w, s.h));
    }
    sections.push(['SPRS', SPRS.out()]);
    /* --- levels */
    const LV = new Writer(); LV.u8(P.levels.length); LV.u8(0); LV.u16(0);
    for (const L of P.levels) {
        LV.str(L.name || 'Level', 24); LV.u16(L.w); LV.u8(L.h); LV.u8(L.song || 0); LV.u8(0); LV.u8(0); LV.u8(0); LV.u8(0);
        const objs = (L.objects || []).filter(o => o.type in OBJ_TYPES);
        LV.u16(objs.length); LV.u16(0);
        for (let x = 0; x < L.w; x++) for (let y = 0; y < L.h; y++) LV.u8(L.map[y * L.w + x] || 0);   // editor stores row-major; engine wants column-major
        LV.align();
        for (const o of objs) { LV.u8(OBJ_TYPES[o.type]); LV.u8(o.y); LV.u16(o.x); }
        if (!objs.some(o => o.type === 'start')) warn.push(`${L.name}: no player start (using the left edge)`);
        if (!objs.some(o => o.type === 'goal')) warn.push(`${L.name}: no goal flag, the level can't be finished`);
    }
    sections.push(['LVLS', LV.out()]);
    /* --- cutscenes: P.cutscenes = [{when:'intro'|'level'|'ending', level, speaker, text, duration}] (no "when" = intro) */
    { const cs = (P.cutscenes || []).filter(c => c && String(c.text || '').trim()).slice(0, 24);
      if (cs.length) { const W = [cs.length]; for (const c of cs) { const sp = String(c.speaker || '').replace(/[^\x20-\x7E]/g, '?').slice(0, 23), tx = String(c.text).replace(/[^\x20-\x7E]/g, '?').slice(0, 159), fr = Math.max(60, Math.min(1800, +c.duration || 300)); W.push({ intro: 0, level: 1, ending: 2 }[c.when] || 0, Math.max(0, Math.min(255, c.level | 0)), fr & 255, fr >> 8, sp.length, tx.length); for (const ch of sp + tx) W.push(ch.charCodeAt(0)); } sections.push(['CUTS', Uint8Array.from(W)]); } }
    /* --- songs (v2: up to 8 tracks, each a chip voice or a synthesized instrument from INST) */
    const MU = NR.music();
    const used = [];
    const songs = P.songs.map(s => MU.upgradeSong(JSON.parse(JSON.stringify(s))));
    for (const s of songs) for (const id of s.inst) { const inf = MU.info(id); if (inf.psg === undefined && !used.includes(id)) used.push(id); }
    const SG = new Writer(); SG.u8(songs.length); SG.u8(2); SG.u16(0);
    for (const s of songs) {
        const nch = Math.min(8, s.ch.length);
        SG.u16(s.steps); SG.u16(Math.max(16, Math.round((s.tempo || 8) * 16))); SG.u8(nch); SG.u8(0); SG.u8(0); SG.u8(0);
        for (let c = 0; c < nch; c++) { const inf = MU.info(s.inst[c]); SG.u8(inf.psg !== undefined ? inf.psg : 16 + used.indexOf(s.inst[c])); SG.u8(Math.min(127, s.vol[c] == null ? 90 : s.vol[c])); SG.u8(s.pan[c] == null ? 64 : s.pan[c]); SG.u8(0); }
        for (let c = 0; c < nch; c++) for (let i = 0; i < s.steps; i++) SG.u8((s.ch[c] || [])[i] || 0);
        SG.align();
    }
    sections.push(['SONG', SG.out()]);
    if (used.length > 24) warn.push('More than 24 different instruments across all songs: only the first 24 play on the DS');
    if (used.length) {
        const IN = new Writer(), n = Math.min(24, used.length), heads = [], blobs = [];
        for (let i = 0; i < n; i++) { const r = MU.render(used[i]); heads.push(r); }
        // layout: [count,pad][offsets...][entries...][sample data 16-aligned]
        let off = 4 + n * 4; const entOff = [];
        heads.forEach(r => { entOff.push(off); off += 4 + (r.kind === 'kit' ? r.sounds.length : 1) * 16; });
        off = (off + 15) & ~15;
        const ents = heads.map(r => {
            const list = r.kind === 'kit' ? r.sounds.map(x => MU.toPCM8(x.data, -1)).map((p, k) => ({ ...p, rate: r.sounds[k].rate })) : [{ ...MU.toPCM8(r.data, r.loop), rate: r.rate }];
            return list.map(p => { const o = off; blobs.push([o, p.pcm]); off = (off + p.pcm.length + 15) & ~15; return { rate: p.rate, len: p.pcm.length, loop: p.loop, o }; });
        });
        IN.u16(n); IN.u16(0); entOff.forEach(o => IN.u32(o));
        heads.forEach((r, i) => { IN.u8(r.kind === 'kit' ? 2 : 1); IN.u8(r.base || 60); IN.u8(ents[i].length); IN.u8(0); ents[i].forEach(e => { IN.u32(e.rate); IN.u32(e.len); IN.u32(e.loop < 0 ? 0xFFFFFFFF : e.loop); IN.u32(e.o); }); });
        const buf = new Uint8Array(off); buf.set(IN.out(), 0); for (const [o, pcm] of blobs) buf.set(Uint8Array.from(pcm, v => v & 255), o);
        sections.push(['INST', buf]);
    }
    /* --- sound clips */
    const SF = new Writer(); SF.u8(SFX_ORDER.length); SF.u8(0); SF.u16(0);
    for (const k of SFX_ORDER) {
        const ref = P.sfx && P.sfx[k]; const s = ref ? assets.snd(ref) : null;
        if (!s) { SF.u16(0); SF.u16(0); SF.u32(0); continue; }
        SF.u16(s.rate); SF.u16(0); SF.u32(s.pcm.length); SF.bytes(Uint8Array.from(s.pcm, v => v & 255)); SF.align();
    }
    sections.push(['SFXC', SF.out()]);
    /* --- opening screen after the NOTAREAL logo */
    if (P.opening && P.opening.top) {
        const fit = im => (im.w === 256 && im.h === 192) ? im : NR.resize(im, 256, 192);
        const top = fit(assets.img(P.opening.top)), bot = P.opening.bottom ? fit(assets.img(P.opening.bottom)) : null;
        const OW = new Writer(); OW.u16(Math.round((P.opening.seconds || 3) * 60)); OW.u16(bot ? 1 : 0);
        for (const im of bot ? [top, bot] : [top]) for (let i = 0; i < 256 * 192; i++) OW.u16(rgb15(im.data[i * 4], im.data[i * 4 + 1], im.data[i * 4 + 2]) | 0x8000);
        sections.push(['OPEN', OW.out()]);
    }
    /* --- bottom screen touch layout */
    if (P.touch && P.touch.layout !== 'text') {
        const TT = NR.touch(), tc = TT.compile(P.touch, bg);
        const im = tc.image, pal = medianCut(collect([im], new Map()), 125), idx = indexImage(im, [null, ...pal], 1);
        const TW = new Writer(); TW.u16(1); TW.u8(tc.buttons.length); TW.u8(tc.widgets.length); TW.u32(0);
        TW.bytes(idx);
        for (let i = 0; i < 256; i++) {
            let c = i === 0 ? (pal[0] || [0, 0, 0]) : i < 126 ? pal[i - 1] : i >= 128 && i < 254 ? pal[i - 129] : i === 254 ? tc.outline : i === 255 ? tc.text : null;
            if (c && i >= 128 && i < 254) c = [Math.min(255, c[0] * 0.7 + 90), Math.min(255, c[1] * 0.7 + 90), Math.min(255, c[2] * 0.7 + 90)];
            TW.u16(c ? rgb15(c[0], c[1], c[2]) : 0);
        }
        for (const b of tc.buttons) { TW.u8(b.x); TW.u8(b.y); TW.u8(b.w); TW.u8(b.h & 255); TW.u8(b.action); TW.u8(b.h >> 8); TW.u8(0); TW.u8(0); }
        for (const w of tc.widgets) { TW.u8(w.x); TW.u8(w.y); TW.u8(w.w); TW.u8(w.h); TW.u8(w.kind); TW.u8(w.scale); TW.u8(0); TW.u8(0); }
        sections.push(['TPAD', TW.out()]);
    }
    /* --- meta */
    const M = P.meta, ph = M.physics || {}, hero = P.sprites.hero || { w: 16, h: 32 };
    const MW = new Writer();
    MW.str(M.title || 'My Game', 32); MW.str(M.author || '', 32);
    MW.u8(M.lives || 3); MW.u8(P.levels.length); MW.u8(hero.w); MW.u8(hero.h);
    MW.u16(Math.round((ph.gravity || 0.25) * 256)); MW.u16(Math.round((ph.jump || 4.6) * 256)); MW.u16(Math.round((ph.run || 1.5) * 256)); MW.u16(Math.round((ph.accel || 0.08) * 256));
    MW.u8(M.titleSong || 0); MW.u8(M.clearSong || 0); MW.u8(back[0]); MW.u8(back[1]); MW.u8(back[2]); MW.u8(Math.round(ph.maxFall || 4)); MW.u8(0); MW.u8(0);
    MW.str(M.tagline || '', 40); MW.u16(Math.round((ph.runFast || 0) * 256)); MW.u16(Math.round((ph.jumpRun || 0) * 256));
    if (P._worldSections) for (const [id, b] of Object.entries(P._worldSections)) if (b instanceof Uint8Array) sections.push([id, b]);
    sections.unshift(['META', MW.out()]);
    /* --- block */
    const hdr = 20 + sections.length * 12; let off = (hdr + 15) & ~15;
    const placed = sections.map(([id, b]) => { const o = off; off = (off + b.length + 15) & ~15; return [id, b, o]; });
    const blk = new Uint8Array(off), dv = new DataView(blk.buffer);
    blk.set([...'NRGDATA1'].map(c => c.charCodeAt(0)), 0);
    dv.setUint32(12, off, true); dv.setUint32(16, sections.length, true);
    placed.forEach(([id, b, o], i) => { blk.set([...id].map(c => c.charCodeAt(0)), 20 + i * 12); dv.setUint32(24 + i * 12, o, true); dv.setUint32(28 + i * 12, b.length, true); blk.set(b, o); });
    return { block: blk, warnings: warn, sizes: Object.fromEntries(placed.map(([id, b]) => [id, b.length])) };
};
/* World projects: combine the world tile sets into one sheet, add NPC sprite sheets, compile maps + rules */
NR.buildDSWorld = (project, assets) => {
    const WM = (typeof module !== 'undefined') ? require('./nrworld.js') : root.NRWorld; let P = project; const world = P.world;
    const sets = [...new Set(world.maps.map(m => m.tileset))], tileOff = {}, cols = [0], imgs = [];
    let n = 1;
    for (const id of sets) { const t = (P.worldTilesets && P.worldTilesets[id]) || { image: P.tileset.image, cols: P.tileset.cols }; const im = assets.img(t.image), cnt = Math.min(Math.floor(im.w / 16), 191 - n); if (cnt <= 0) break; tileOff[id] = n - 1; imgs.push([im, cnt, n]); for (let i = 1; i < cnt; i++) cols.push(t.cols[i] || 0); cols.push(0); n += cnt; }
    // tile 0 must stay empty; each set's tile i lands at (offset + i) with offset = start - 1 (its own tile 0 is skipped)
    const total = Math.min(192, n), comb = { w: total * 16, h: 16, data: new Uint8ClampedArray(total * 16 * 16 * 4) }, cc = new Array(total).fill(0);
    for (const [im, cnt, start] of imgs) for (let i = 1; i < cnt; i++) { const dst = start - 1 + i; if (dst >= total) break; cc[dst] = ((P.worldTilesets && P.worldTilesets[sets[imgs.findIndex(x => x[0] === im)]]) || P.tileset).cols[i] || 0; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const s = (y * im.w + i * 16 + x) * 4, d = (y * comb.w + dst * 16 + x) * 4; for (let c = 0; c < 4; c++) comb.data[d + c] = im.data[s + c]; } }
    const sprites = Object.assign({}, P.sprites);
    for (const [k, s] of Object.entries(P.sprites)) if (s.td) sprites[k + '__td'] = { image: s.td, w: s.w, h: s.h, frames: 6 };
    P = Object.assign({}, P, { sprites });
    const extra = Object.keys(sprites).filter(k => !ROLE_ORDER.includes(k)), sheetIndex = {};
    [...ROLE_ORDER, ...extra].forEach((k, i) => sheetIndex[k] = i);
    const ws = WM.compileDS(world, { sheetIndex, tileOff });
    const P2 = Object.assign({}, P, { tileset: { image: '__world_tiles', cols: cc }, levels: P.levels && P.levels.length ? P.levels : [{ name: 'World', w: 16, h: 16, map: new Array(256).fill(0), objects: [{ type: 'start', x: 1, y: 1 }, { type: 'goal', x: 14, y: 12 }] }], _extraSheets: extra, _worldSections: { WRLD: ws.WRLD, WTXT: ws.WTXT } });
    const r = NR.buildDS(P2, Object.assign({}, assets, { img: ref => ref === '__world_tiles' ? comb : assets.img(ref) }));
    r.warnings = r.warnings.filter(w => !/goal flag|player start/.test(w));
    return r;
};
/* Puzzle ROM: one PZCF section (see engine/puzzle/source/main.c struct Cfg) in the standard data block */
NR.buildDSPuzzle = P => {
    const C = P.puzzle; if (!C) throw new Error('No puzzle set up yet');
    const S = C[C.mode], b = new Uint8Array(66), dv = new DataView(b.buffer), hex = h => [1, 3, 5].map(i => parseInt((h || '#000000').slice(i, i + 2), 16) || 0);
    const pat = ['chevron', 'diagonal', 'candy', 'diamond'];
    b[0] = C.mode === 'bracelet' ? 1 : 0; b[1] = S.w || 8; b[2] = S.h || 8; b[3] = S.colors || 5; b[4] = Math.min(255, S.moves || 20); dv.setUint16(6, Math.min(65535, S.goal || 1000), true);
    b[8] = S.threads || 6; b[9] = S.rows || 10; b[10] = S.tries || 6; b[11] = Math.max(0, pat.indexOf(S.pattern)); const pal = (S.palette || []).slice(0, 6); b[12] = pal.length;
    pal.forEach((h, i) => b.set(hex(h), 16 + i * 3)); const t = String(S.title || 'Puzzle').slice(0, 31); for (let i = 0; i < t.length; i++) b[34 + i] = t.charCodeAt(i) & 127;
    const hdr = 20 + 12, off = (hdr + 15) & ~15, blk = new Uint8Array((off + b.length + 15) & ~15), v = new DataView(blk.buffer);
    blk.set([...'NRGDATA1'].map(c => c.charCodeAt(0)), 0); v.setUint32(12, blk.length, true); v.setUint32(16, 1, true);
    blk.set([...'PZCF'].map(c => c.charCodeAt(0)), 20); v.setUint32(24, off, true); v.setUint32(28, b.length, true); blk.set(b, off);
    return { block: blk, warnings: [] };
};
/* Arcade ROM: one ARCF section = mode, 8 settings (i16), two RGB15 colours, title. Engine: engine/arcade/source/main.c */
NR.ARCADE_KEYS = { shmup: ['lives', 'speed', 'fireRate', 'waves', 'enemyHp', 'boss'], breakout: ['lives', 'rows', 'cols', 'ballSpeed', 'paddle'], race: ['laps', 'laneCars', 'maxSpeed', 'timeLimit', 'curves'], fps: ['size', 'enemies', 'health', 'ammo', 'damage'], brawler: ['lives', 'waves', 'enemyHp', 'boss'], falling: ['w', 'h', 'startSpeed', 'goalLines'], memory: ['pairs', 'cols', 'tries'], sim: ['w', 'h', 'cash', 'goalPop'], paint: ['picture'], hoops: ['seconds', 'goal', 'meterSpeed'], music: ['tempo'], coloring: ['page'], combat: [] };
/* Skate park data ('SKPK'): the shared level builder's skate park. Presets mirror the engine's three built-in parks. */
NR.SKATE_PARKS = [
  { name: 'Plaza', qh: 2.2, c: { sky0: [150,196,240], sky1: [60,110,210], slab: [150,150,154], walls: [150,150,160], deck: [110,90,60] }, spawn: { x: 3.5, z: 3 }, yaw: 180,
    rails: [[-12,-6,-2,-6,.7,0],[4,6,14,6,.7,0],[-15,2,-15,10,.9,0],[-7,7.85,-5,7.85,.5,1],[5,7.85,7,7.85,.5,1]].map(r => ({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], h: r[4], kind: r[5] })), ramps: [{ x: 0, z: 0, hw: 2, hd: 1.4, h: .7, kind: 0 }], obs: [{ x0: 7, z0: -5.6, x1: 9, z1: -4.4, h: 1.2 }],
    letters: [[-7,1.6,-6],[0,2.6,0],[9,1.6,6],[-15,2,6],[8,2.4,-5],[0,4.5,13],[0,4.5,-13]].map(l => ({ x: l[0], y: l[1], z: l[2] })) },
  { name: 'Bowl', qh: 3.2, c: { sky0: [250,170,120], sky1: [90,70,150], slab: [176,166,150], walls: [190,150,120], deck: [90,80,70] }, spawn: { x: -3.5, z: 8 }, yaw: 180,
    rails: [[-10,-5,-2,-5,.8,0],[3,5,11,5,.8,0],[14,-4,14,4,1,0]].map(r => ({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], h: r[4], kind: r[5] })), ramps: [{ x: 0, z: 0, hw: 3, hd: 2.6, h: 1, kind: 1 }, { x: -9, z: 5, hw: 2, hd: 1.4, h: .7, kind: 0 }, { x: 9, z: -5, hw: 2, hd: 1.4, h: .7, kind: 0 }], obs: [{ x0: -8, z0: -9.4, x1: -6, z1: -8.2, h: 1 }],
    letters: [[-9,1.6,5],[0,2.2,0],[9,1.6,-5],[-14,2.4,0],[14,2.4,0],[0,5,13],[0,5,-13]].map(l => ({ x: l[0], y: l[1], z: l[2] })) },
  { name: 'Street', qh: 0, c: { sky0: [170,180,200], sky1: [80,96,140], slab: [128,128,132], walls: [120,112,108], deck: [70,70,76] }, spawn: { x: 0, z: -4 }, yaw: 0,
    rails: [[-14,-8,-4,-8,.7,0],[2,-8,12,-8,.5,1],[-12,6,-2,6,.9,0],[4,6,14,6,.5,1],[15,-4,15,6,.7,0],[-6,0,6,0,.5,1]].map(r => ({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], h: r[4], kind: r[5] })), ramps: [{ x: 0, z: 10, hw: 3, hd: 2, h: .9, kind: 1 }, { x: -8, z: -2, hw: 2, hd: 1.4, h: .7, kind: 0 }], obs: [{ x0: -3, z0: -12.4, x1: 3, z1: -11.2, h: 1.5 }, { x0: 8, z0: 1.8, x1: 10, z1: 3.2, h: 1.1 }],
    letters: [[-12,1.6,-8],[-9,1.6,6],[0,2,0],[14,1.6,-6],[0,2.6,10],[-14,1.8,12],[10,2.6,-2]].map(l => ({ x: l[0], y: l[1], z: l[2] })) }];
NR.SKATE_NEW = base => JSON.parse(JSON.stringify(NR.SKATE_PARKS[base || 0]));
NR.skatePark = sp => {
    const b = new Uint8Array(224), dv = new DataView(b.buffer), s16 = (o, v) => dv.setInt16(o, Math.max(-32000, Math.min(32000, Math.round(v * 10))), true), u8 = (o, v) => { b[o] = Math.max(0, Math.min(255, Math.round(v))); };
    const rl = (sp.rails || []).slice(0, 8), rm = (sp.ramps || []).slice(0, 4), ob = (sp.obs || []).slice(0, 2), c = sp.c;
    b[0] = 1; b[1] = Math.round(Math.max(-12, Math.min(12, sp.qh || 0)) * 10) & 255; b[2] = rl.length; b[3] = rm.length; b[4] = ob.length;
    ['sky0', 'sky1', 'slab', 'walls', 'deck'].forEach((k, i) => { for (let j = 0; j < 3; j++) u8(5 + i * 3 + j, c[k][j]); });
    b[20] = Math.round(Math.max(-60, Math.min(60, (sp.spawn || { x: 0 }).x * 2))) & 255; b[21] = Math.round(Math.max(-60, Math.min(60, (sp.spawn || { z: 0 }).z * 2))) & 255; dv.setUint16(22, ((sp.yaw || 0) % 360 + 360) % 360, true);
    rl.forEach((r, k) => { const o = 24 + k * 12; s16(o, r.x0); s16(o + 2, r.z0); s16(o + 4, r.x1); s16(o + 6, r.z1); u8(o + 8, r.h * 10); u8(o + 9, r.kind); });
    rm.forEach((r, k) => { const o = 120 + k * 10; s16(o, r.x); s16(o + 2, r.z); u8(o + 4, r.hw * 10); u8(o + 5, r.hd * 10); u8(o + 6, r.h * 10); u8(o + 7, r.kind); });
    ob.forEach((r, k) => { const o = 160 + k * 10; s16(o, r.x0); s16(o + 2, r.z0); s16(o + 4, r.x1); s16(o + 6, r.z1); u8(o + 8, r.h * 10); });
    for (let k = 0; k < 7; k++) { const l = (sp.letters || [])[k] || { x: 0, y: 2, z: 0 }, o = 180 + k * 6; s16(o, l.x); s16(o + 2, l.y); s16(o + 4, l.z); }
    return b;
};
/* DS 3D skate ROM (engine/skate3d, built from the Jabroni Hawk engine): one SKCF section = park, run length, goal, physics, skater look (the CAW face generator), title */
NR.buildDSSkate = P => {
    const A = P.arcade; if (!A || A.mode !== 'skate') throw new Error('No skate game set up yet');
    let c = A.cfg || {}; const sk = NR.castFor(P, 'skate')[0]; if (sk) c = Object.assign({}, c, { sex: sk.sex, skin: sk.skin, hair: sk.hair, hairc: sk.hairc, eyes: sk.eyes, beard: sk.beard, top: sk.top, pants: sk.pants, boots: sk.boots, skaterHeight: sk.height, skaterBuild: sk.build });   // the shared cast decides who skates
    const b = new Uint8Array(120), dv = new DataView(b.buffer), u = (i, v) => dv.setUint16(i * 2, Math.max(0, Math.min(65535, Math.round(+v || 0))), true);
    u(0, (c.spot || 0) % 3); u(1, c.seconds || 120); u(2, c.goalScore || 0); u(3, (c.maxSpeed || 4.2) * 4.05); u(4, (c.ollie || 4.6) * 4.13); u(5, (c.gravity || .24) * 45.8);
    [c.sex, c.skin, c.hair, c.hairc, c.eyes, c.beard, c.top, c.pants, c.boots].forEach((v, i) => u(6 + i, v)); u(15, (c.skaterHeight || 1) * 100); u(16, (c.skaterBuild || 1) * 100);
    const t = String(c.title || 'Skate Session').slice(0, 30).toUpperCase(); for (let i = 0; i < t.length; i++) b[40 + i] = t.charCodeAt(i) & 127;
    const hdr = 20 + 12, off = (hdr + 15) & ~15, blk = new Uint8Array((off + b.length + 15) & ~15), v = new DataView(blk.buffer);
    blk.set([...'NRGDATA1'].map(ch => ch.charCodeAt(0)), 0); v.setUint32(12, blk.length, true); v.setUint32(16, 1, true);
    blk.set([...'SKCF'].map(ch => ch.charCodeAt(0)), 20); v.setUint32(24, off, true); v.setUint32(28, b.length, true); blk.set(b, off);
    let out = blk; if (P.skatepark && P.skatepark.on) { const A2 = typeof NRAssets !== 'undefined' ? NRAssets : require('./nrassets.js'); out = A2.attach(blk, NR.skatePark(P.skatepark), 'SKPK'); }
    return { block: out, warnings: [] };
};
/* DS 3D wrestling ROM (engine/wrestling, the ICW match engine): WRCF section = up to 8 wrestlers (40-byte records, see engine/wrestling/source/main.c) + the match type */
NR.WRESTLE_DEFAULT = () => ({ title: 'Pro Wrestling', matchType: 5, roster: [
    { name: 'Hero', sex: 0, skin: 2, hair: 1, hairc: 1, eyes: 1, beard: 0, top: 1, pants: 2, boots: 4, height: 1, build: 1, fin: 0, heel: 0, preset: 0, key: 5, tempo: 124, power: 100, tough: 100, speed: 100, gain: 100 },
    { name: 'Rival', sex: 0, skin: 4, hair: 0, hairc: 0, eyes: 2, beard: 1, top: 3, pants: 1, boots: 2, height: 1.05, build: 1.1, fin: 2, heel: 1, preset: 1, key: 3, tempo: 96, power: 110, tough: 110, speed: 90, gain: 100 }] });
/* the shared cast: one list of characters (look + per-game extras) used by every game type. c.games = { wrestling, skate } turns a character on or off for a game (default on). */
NR.CAST_NEW = i => ({ name: 'Character ' + (i + 1), sex: 0, skin: i % 8, hair: i % 8, hairc: i % 8, eyes: 1, beard: 0, top: i % 10, pants: 2, boots: 4, height: 1, build: 1, fin: i % 4, heel: i % 2, preset: i % 3, key: i % 12, tempo: 110, power: 100, tough: 100, speed: 100, gain: 100, games: { wrestling: true, skate: i === 0 } });
NR.castFor = (P, game) => (P.cast || []).filter(c => !c.games || c.games[game] !== false);
NR.buildDSWrestling = P => {
    const W = P.wrestle || NR.WRESTLE_DEFAULT(), cast = NR.castFor(P, 'wrestling'), R = (cast.length >= 2 ? cast : (W.roster || [])).slice(0, 8); if (R.length < 2) throw new Error('A wrestling game needs at least 2 wrestlers');
    const pl = new Uint8Array(4 + 40 * R.length); pl[0] = R.length; pl[1] = W.matchType == null ? 5 : Math.max(0, Math.min(5, W.matchType | 0));
    R.forEach((w, i) => { const o = 4 + i * 40, nm = String(w.name || 'WRESTLER').slice(0, 15).toUpperCase(); for (let k = 0; k < nm.length; k++) pl[o + k] = nm.charCodeAt(k) & 127;
        [w.sex, w.skin, w.hair, w.hairc, w.eyes, w.beard, w.top, w.pants, w.boots].forEach((v, k) => { pl[o + 16 + k] = (+v || 0) & 255; });
        pl[o + 25] = Math.round((w.height || 1) * 100); pl[o + 26] = Math.round((w.build || 1) * 100); pl[o + 27] = (w.fin || 0) & 3; pl[o + 28] = w.heel ? 1 : 0; pl[o + 29] = (w.preset || 0) % 3; pl[o + 30] = (w.key || 0) % 12; pl[o + 31] = Math.max(60, Math.min(200, +w.tempo || 120)); [w.power, w.tough, w.speed, w.gain].forEach((v, k) => { pl[o + 32 + k] = Math.max(40, Math.min(200, Math.round(+v || 100))); });
        (w.moves || []).slice(0, 4).forEach((v, k) => { pl[o + 36 + k] = (Math.max(0, Math.min(4, v | 0)) + 1); }); });   // bytes 36-39: grapple used for UP / DOWN / LEFT / RIGHT + B (value + 1, 0 = engine default)
    const hdr = 20 + 12, off = (hdr + 15) & ~15, blk = new Uint8Array((off + pl.length + 15) & ~15), v = new DataView(blk.buffer);
    blk.set([...'NRGDATA1'].map(ch => ch.charCodeAt(0)), 0); v.setUint32(12, blk.length, true); v.setUint32(16, 1, true);
    blk.set([...'WRCF'].map(ch => ch.charCodeAt(0)), 20); v.setUint32(24, off, true); v.setUint32(28, pl.length, true); blk.set(pl, off);
    return { block: blk, warnings: [] };
};
NR.DS_ARCADE_MODES = () => Object.keys(NR.ARCADE_KEYS).filter(k => k !== 'combat');   /* combat has its own KCFG section: single-game ROM only, not in timeline routers */
/* Timeline -> DS router ROM: every game step must be one of the DS arcade engines; story steps become text cards; branches (win / lose / menus) are resolved to scene indexes */
NR.buildDSScenes = P => {
    const tl = (P.timeline || []).filter(s => s && s.type !== 'transition' && s.type !== 'menu'), ok = new Set(NR.DS_ARCADE_MODES()), bad = [], MAP = { paint: 'coloring' };
    const kinds = tl.map(s => { if (s.type === 'arcade') { const m = MAP[s.mode] || s.mode; if (ok.has(m)) return { game: true, mode: m }; bad.push((s.title || s.mode || 'arcade') + ' (' + (s.mode || '?') + ')'); return null; } const fam = (typeof NRTimeline !== 'undefined' ? NRTimeline : require('./nrtimeline.js')).TYPES[s.type]; if (fam && fam.family === 'story') return { card: true }; bad.push((s.title || s.type) + ' (' + s.type + ')'); return null; });
    if (bad.length) throw new Error('These sections are not in the DS arcade ROM yet: ' + bad.join(', ') + '. Keep to the DS arcade games (shoot-em-up, breakout, racing, first-person, brawler, falling blocks, memory, town builder, hoops, music maker, coloring) and story cards, or export to PC / Xbox.');
    if (!kinds.some(k => k.game)) throw new Error('Add at least one arcade game section to the timeline.');
    const idx = id => tl.findIndex(x => x.id === id), link = (v, i, dflt) => { if (v === 'retry') return 254; if (v === 'end') return 255; if (v === 'next' || v == null || v === '') return i + 1 < tl.length ? i + 1 : 255; if (v === 'skip') return i + 1 < tl.length ? i + 1 : 255; const j = idx(v); return j >= 0 ? j : dflt; };
    const list = tl.map((s, i) => { const k = kinds[i]; const lines = (s.lines || []).map(l => (l.speaker ? l.speaker + ': ' : '') + (l.text || l)).join('\n'); return Object.assign({ card: !!k.card, mode: k.mode, cfg: Object.assign({}, k.game ? s.cfg : {}), title: s.title || (k.game ? '' : 'Story'), text: s.text || lines, music: s.music, win: link(s.onWin, i, 255), lose: s.onLose === 'next' || s.type && kinds[i].card ? link('next', i) : link(s.onLose || 'retry', i, 254) }); });
    const first = list.find(x => !x.card); const col = list.find(x => x.mode === 'coloring');
    if (col && !(P.coloring && P.coloring.pages && P.coloring.pages.length) && col.cfg.custom) P = Object.assign({}, P, { coloring: { pages: col.cfg.custom, only: !!col.cfg.onlyCustom } });
    return NR.buildDSArcade(P, { list, first });
};
/* DS arcade engine design sections. SHMP (160 bytes): [0]=1 [1] types [2] waves [3] boss hp [4] boss pattern [5] boss fire; types at 8 + 8k: hp, speed x4, pattern, fire/4, score/10, colour, size; waves at 56 + 6k: at u16, type, n, form, x. BRKL: [0]=1 [1] rows [2] cols, then rows*cols cells (0-4). */
NR.shmupDesign = d => {
    const b = new Uint8Array(160), cl = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v || 0))), ty = d.types.slice(0, 6), wv = d.waves.slice(0, 16).sort((p, q) => p.at - q.at);
    b[0] = 1; b[1] = ty.length; b[2] = wv.length; b[3] = cl(d.boss && d.boss.hp, 0, 255); b[4] = cl(d.boss && d.boss.pattern, 0, 2); b[5] = cl(d.boss && d.boss.fire, 0, 255);
    ty.forEach((t, k) => { const o = 8 + k * 8; b[o] = cl(t.hp, 1, 60); b[o + 1] = cl((t.speed || 1) * 4, 1, 24); b[o + 2] = cl(t.pattern, 0, 3); b[o + 3] = cl((t.fire || 0) / 4, 0, 255); b[o + 4] = cl((t.score || 100) / 10, 1, 250); b[o + 5] = cl(t.color, 0, 4); b[o + 6] = cl(t.size, 0, 2); });
    wv.forEach((w, k) => { const o = 56 + k * 6, at = cl(w.at, 0, 65535); b[o] = at & 255; b[o + 1] = at >> 8; b[o + 2] = cl(w.type, 0, Math.max(0, ty.length - 1)); b[o + 3] = cl(w.n, 1, 12); b[o + 4] = cl(w.form, 0, 3); b[o + 5] = cl(w.x, 0, 255); });
    return b;
};
/* RACE: [0]=1 [1] sections [4..6] grass rgb; sections at 8 + 2k: length (x50 units), curve (signed) */
NR.raceDesign = d => { const t = d.track.slice(0, 16), b = new Uint8Array(8 + t.length * 2 + 8), g = d.grass || [42, 138, 42]; b[0] = 1; b[1] = t.length; for (let i = 0; i < 3; i++) b[4 + i] = Math.max(0, Math.min(255, g[i] | 0)); t.forEach((q, k) => { b[8 + k * 2] = Math.max(1, Math.min(20, q.len | 0)); b[9 + k * 2] = Math.max(-6, Math.min(6, Math.round(q.curve || 0))) & 255; }); return b; };
/* BRWL: [0]=1 [1] types [2] waves [3] boss hp [4] boss dmg; types at 8 + 6k: hp, speed x4, dmg, score/10, colour; waves at 40 + 3k: type, n, side */
NR.brawlerDesign = d => { const b = new Uint8Array(96), cl = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v || 0))), ty = d.types.slice(0, 4), wv = d.waves.slice(0, 16); b[0] = 1; b[1] = ty.length; b[2] = wv.length; b[3] = cl(d.boss && d.boss.hp, 1, 250); b[4] = cl(d.boss && d.boss.dmg, 1, 9);
    ty.forEach((t, k) => { const o = 8 + k * 6; b[o] = cl(t.hp, 1, 60); b[o + 1] = cl((t.speed || 1) * 4, 2, 10); b[o + 2] = cl(t.dmg, 1, 9); b[o + 3] = cl((t.score || 50) / 10, 1, 250); b[o + 4] = cl(t.color, 0, 4); }); wv.forEach((w, k) => { const o = 40 + k * 3; b[o] = cl(w.type, 0, Math.max(0, ty.length - 1)); b[o + 1] = cl(w.n, 1, 8); b[o + 2] = cl(w.side, 0, 2); }); return b; };
/* FPSL: [0]=1 [1] size n (<= 24), then n*n cells: 0 floor, 1 wall, 2 enemy, 3 health, 4 ammo, 5 start, 6 exit */
NR.fpsDesign = d => { const n = Math.max(8, Math.min(24, Math.max(d.map.length, ...d.map.map(r => r.length)))), b = new Uint8Array(8 + n * n); b[0] = 1; b[1] = n; const code = { '#': 1, '.': 0, E: 2, H: 3, A: 4, S: 5, X: 6 };
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const ch = (d.map[y] || '')[x]; b[8 + y * n + x] = ch === undefined ? 1 : (code[ch] === undefined ? 0 : code[ch]); } return b; };
/* MEMC: [0]=1 [1] cards (2-16); palette 16 x RGB15 u16 at 8 (index 0 = transparent); card pictures at 40 + 256k (palette indexes) */
NR.memoryDesign = d => { const cards = d.cards.slice(0, 16), b = new Uint8Array(40 + cards.length * 256), hx = h => [1, 3, 5].map(i => parseInt((h || '#000000').slice(i, i + 2), 16) || 0); b[0] = 1; b[1] = cards.length;
    (d.pal || []).slice(0, 16).forEach((c, i) => { const v = hx(c), w = (v[0] >> 3) | (v[1] >> 3) << 5 | (v[2] >> 3) << 10; b[8 + i * 2] = w & 255; b[9 + i * 2] = w >> 8; }); cards.forEach((c, k) => { for (let i = 0; i < 256; i++) b[40 + k * 256 + i] = parseInt((c.px || '')[i] || '0', 16) || 0; }); return b; };
/* FALD (56): [0]=1 [1] pieces (1-12) [2] speed-up per line in tenths of a frame [3] fastest speed; shape masks u16 at 8 (4x4, row 0 = top bits); colours RGB15 u16 at 32 */
NR.fallingDesign = d => { const ps = d.pieces.slice(0, 12), b = new Uint8Array(56), hx = h => [1, 3, 5].map(i => parseInt((h || '#ffffff').slice(i, i + 2), 16) || 0); b[0] = 1; b[1] = ps.length; b[2] = Math.max(0, Math.min(60, Math.round((d.speedUp == null ? 1.2 : d.speedUp) * 10))); b[3] = Math.max(2, Math.min(40, d.fastest || 5));
    ps.forEach((p, k) => { let m = 0; for (let i = 0; i < 16; i++) if ((p.cells || '')[i] === '1') m |= 1 << (15 - i); b[8 + k * 2] = m & 255; b[9 + k * 2] = m >> 8; const v = hx(p.color), w = (v[0] >> 3) | (v[1] >> 3) << 5 | (v[2] >> 3) << 10; b[32 + k * 2] = w & 255; b[33 + k * 2] = w >> 8; }); return b; };
NR.breakoutDesign = d => { const g = d.grid.slice(0, 8), cols = Math.max(2, Math.min(16, Math.max(...g.map(r => r.length)))), b = new Uint8Array(4 + g.length * cols); b[0] = 1; b[1] = g.length; b[2] = cols; g.forEach((r, y) => { for (let x = 0; x < cols; x++) b[4 + y * cols + x] = Math.max(0, Math.min(4, (r[x] | 0))); }); return b; };
NR.buildDSArcade = (P, scenes) => {
    const A = scenes ? { mode: scenes.first.mode, cfg: scenes.first.cfg } : P.arcade; if (!A) throw new Error('No arcade game set up yet');
    const modes = Object.keys(NR.ARCADE_KEYS), hex = h => [1, 3, 5].map(i => parseInt((h || '#000000').slice(i, i + 2), 16) || 0), rgb15 = c => (c[0] >> 3 | (c[1] >> 3) << 5 | (c[2] >> 3) << 10 | 0x8000), warn = [];
    const mk = (mode, cfg) => { const mi = modes.indexOf(mode); if (mi < 0) throw new Error('Unknown arcade game: ' + mode); cfg = cfg || {}; const b = new Uint8Array(56), dv = new DataView(b.buffer);
        b[0] = mode === 'combat' ? 13 : mi; NR.ARCADE_KEYS[mode].forEach((k, i) => { let v = cfg[k]; if (k === 'picture') v = Math.max(0, ['house', 'cat', 'tree'].indexOf(v)); if (k === 'tempo') v = v || 120; if (k === 'meterSpeed') v = Math.round((v || 2.2) * 10); dv.setInt16(4 + i * 2, Math.max(-32768, Math.min(32767, Math.round(+v || 0))), true); });
        dv.setUint16(20, rgb15(hex(cfg.color)), true); dv.setUint16(22, rgb15(hex(cfg.color2)), true); const t = String(cfg.title || 'Arcade').slice(0, 31); for (let i = 0; i < t.length; i++) b[24 + i] = t.charCodeAt(i) & 127; return b; };
    const cfg = A.cfg || {}, b = mk(A.mode, cfg);
    const sections = [['ARCF', b]];
    if (!scenes && A.mode === 'shmup' && cfg.design && cfg.design.types && cfg.design.waves) sections.push(['SHMP', NR.shmupDesign(cfg.design)]);
    if (!scenes && A.mode === 'falling' && cfg.design && Array.isArray(cfg.design.pieces) && cfg.design.pieces.length) sections.push(['FALD', NR.fallingDesign(cfg.design)]);
    if (!scenes && A.mode === 'memory' && cfg.design && Array.isArray(cfg.design.cards) && cfg.design.cards.length >= 2) sections.push(['MEMC', NR.memoryDesign(cfg.design)]);
    if (!scenes && A.mode === 'fps' && cfg.design && Array.isArray(cfg.design.map) && cfg.design.map.length) sections.push(['FPSL', NR.fpsDesign(cfg.design)]);
    if (!scenes && A.mode === 'brawler' && cfg.design && cfg.design.types && cfg.design.waves) sections.push(['BRWL', NR.brawlerDesign(cfg.design)]);
    if (!scenes && (A.mode === 'race' || A.mode === 'combat') && cfg.design && Array.isArray(cfg.design.track) && cfg.design.track.length) sections.push(['RACE', NR.raceDesign(cfg.design)]);
    if (!scenes && A.mode === 'breakout' && cfg.design && Array.isArray(cfg.design.grid) && cfg.design.grid.length) sections.push(['BRKL', NR.breakoutDesign(cfg.design)]);
    if (A.mode === 'combat' && !scenes) { const W3 = typeof NRWorld3D !== 'undefined' ? NRWorld3D : require('./nrworld3d.js'), cb = W3.combatBlock(cfg); sections.push(['KCFG', cb.subarray(80, 110)]); }
    if (A.mode === 'coloring' || (scenes && scenes.list.some(x => x.mode === 'coloring'))) {   /* COLR: the coloring-book pages (shapes + magic hint colours), same data as the PC engine; the DS ROM rasterises them itself */
        const CC = typeof NRColor !== 'undefined' ? NRColor : require('./nrcolor.js'), cu = ((A.cfg && A.cfg.custom) || (P.coloring && P.coloring.pages) || []).map(CC.cleanPage).filter(p => p.regions.length), only = !!((A.cfg && A.cfg.onlyCustom) || (P.coloring && P.coloring.only)), list = (only && cu.length ? [] : CC.PAGES).concat(cu).slice(0, 60), W = [], u8 = v => W.push(v & 255), i16 = v => { v = Math.max(-32768, Math.min(32767, Math.round(v))); u8(v); u8(v >> 8); }, rec = (kind, hint, vals) => { u8(kind); u8(hint); u8(vals.length); u8(vals.length >> 8); vals.forEach(i16); };
        u8(list.length); u8(0); u8(0); u8(0);
        for (const pg of list) {
            const rg = pg.regions.slice(0, 127); u8(rg.length); u8(pg.bg == null ? 18 : pg.bg); const nm = String(pg.name || 'PAGE').toUpperCase().replace(/[^ -~]/g, '').slice(0, 14); for (let i = 0; i < 14; i++) u8(i < nm.length ? nm.charCodeAt(i) : 0);
            for (const r of rg) { const hint = r.hint == null ? 255 : r.hint;
                if (r.k === 'e') rec(0, hint, [r.cx, r.cy, r.rx, r.ry, (r.rot || 0) * 1000]); else if (r.k === 'r') rec(1, hint, [r.x, r.y, r.w, r.h, r.r || 0]);
                else { let pts = r.pts; if (pts.length > 64) pts = Array.from({ length: 64 }, (_, i) => r.pts[Math.floor(i * r.pts.length / 64)]); rec(2, hint, pts.flatMap(q => [q[0], q[1]])); } }
        }
        sections.push(['COLR', Uint8Array.from(W)]); if (W.length > 200000) warn.push('Coloring pages are large for a DS ROM; trim some pages if it fails to load.');
    }
    /* music: the same song data the platformer ROMs use, reduced to chip voices (square, square, square, noise) so no sample bank is needed */
    const songs = (P.songs || []).slice(0, 8);
    if (songs.length) {
        const MU = NR.music(), W = [], u8 = v => W.push(v & 255), u16 = v => { u8(v); u8(v >> 8); }; u8(songs.length); u8(2); u16(0);
        for (const s0 of songs) { const s = MU.upgradeSong(JSON.parse(JSON.stringify(s0))), tr = []; for (let c = 0; c < s.ch.length && tr.length < 5; c++) { const inf = MU.info(s.inst[c]); const v = inf.psg !== undefined ? inf.psg : (/drum|kit|perc|noise/i.test(inf.name || inf.kind || '') ? 3 : 1); if (v === 3 ? tr.some(x => x.v === 3) : tr.filter(x => x.v !== 3).length >= 4) continue; tr.push({ c, v }); }
            u16(s.steps); u16(Math.max(16, Math.round((s.tempo || 8) * 16))); u8(tr.length); u8(0); u8(0); u8(0); for (const x of tr) { u8(x.v); u8(Math.min(127, s.vol[x.c] == null ? 90 : s.vol[x.c])); u8(s.pan[x.c] == null ? 64 : s.pan[x.c]); u8(0); }
            for (const x of tr) for (let i = 0; i < s.steps; i++) u8((s.ch[x.c] || [])[i] || 0); while (W.length & 3) u8(0); }
        sections.push(['SONG', Uint8Array.from(W)]);
        const pick = (v, d) => v == null ? d : Math.max(0, Math.min(songs.length, +v)); b[1] = pick(cfg.song, 1); b[2] = pick(cfg.titleSong, 0);
        if (songs.some(s0 => MU.upgradeSong(JSON.parse(JSON.stringify(s0))).inst.some(id => MU.info(id).psg === undefined))) warn.push('Some song tracks use sampled instruments; on the DS arcade engines they play as simple square-wave voices.');
    }
    if (scenes) {   /* SCNS: one 192-byte record per scene: [0..55] the ARCF settings, [56] win link, [57] lose link, [58] 1 = text card, [64..191] card text. Links: scene index, 254 = retry, 255 = end */
        const W = new Uint8Array(4 + scenes.list.length * 192); W[0] = scenes.list.length; let last = 1;
        scenes.list.forEach((sc, i) => { const r = sc.card ? mk('hoops', { title: sc.title, color: sc.cfg && sc.cfg.color }) : mk(sc.mode, sc.cfg), o = 4 + i * 192, songs = (P.songs || []).slice(0, 8).length;
            if (sc.music !== undefined && sc.music !== null) last = sc.music < 0 || sc.music >= songs ? 0 : sc.music + 1; r[1] = songs ? last : 0; r[2] = 0; W.set(r, o); W[o + 56] = sc.win; W[o + 57] = sc.lose; W[o + 58] = sc.card ? 1 : 0;
            const tx = String(sc.text || '').replace(/[^\n -~]/g, '').slice(0, 126); for (let k = 0; k < tx.length; k++) W[o + 64 + k] = tx.charCodeAt(k); });
        sections.push(['SCNS', W]);
    }
    const hdr = 20 + sections.length * 12; let off = (hdr + 15) & ~15; const placed = sections.map(([id, d]) => { const o = off; off = (off + d.length + 15) & ~15; return [id, d, o]; });
    const blk = new Uint8Array(off), v = new DataView(blk.buffer); blk.set([...'NRGDATA1'].map(c => c.charCodeAt(0)), 0); v.setUint32(12, off, true); v.setUint32(16, sections.length, true);
    placed.forEach(([id, d, o], i) => { blk.set([...id].map(c => c.charCodeAt(0)), 20 + i * 12); v.setUint32(24 + i * 12, o, true); v.setUint32(28 + i * 12, d.length, true); blk.set(d, o); });
    return { block: blk, warnings: warn };
};
/* Fight ROM: FGCF (title, ring, two fighters) + FSP0/FSP1 sprite frames as RGB15 (bit 15 = opaque) */
NR.buildDSFight = (P, assets) => {
    const C = P.fight; if (!C || !C.fighters || C.fighters.length < 2) throw new Error('Set up two fighters first');
    const rgb15 = (r, g, b) => (r >> 3 | (g >> 3) << 5 | (b >> 3) << 10 | 0x8000), hex15 = n => rgb15(n >> 16 & 255, n >> 8 & 255, n & 255);
    const cfg = new Uint8Array(84), dv = new DataView(cfg.buffer), put = (o, str, n) => { for (let i = 0; i < Math.min(str.length, n - 1); i++) cfg[o + i] = str.charCodeAt(i) & 127; };
    put(0, C.title || 'Ring Fight', 32); const ring = C.ring || { floor: 0x3b5ba8, rope: 0xe84a4a }; dv.setUint16(32, hex15(ring.floor), true); dv.setUint16(34, hex15(ring.rope), true);
    const warn = [], sections = [['FGCF', cfg]];
    C.fighters.slice(0, 2).forEach((f, i) => { const o = 36 + i * 24; put(o, (f.name || 'FIGHTER').toUpperCase(), 16); dv.setUint16(o + 16, Math.max(20, Math.min(400, f.hp || 100)), true); cfg[o + 18] = Math.round(Math.max(0.5, Math.min(2, f.power || 1)) * 100); cfg[o + 19] = Math.round(Math.max(0.5, Math.min(1.6, f.speed || 1)) * 100);
        const sp = P.sprites[f.sprite]; if (!sp) { warn.push(`Fighter ${i + 1}: sprite "${f.sprite}" not found; a plain block is drawn.`); return; }
        const im = assets.img(sp.image), w = sp.w, h = sp.h, fr = Math.max(1, Math.min(4, sp.frames || 1)), out = new Uint8Array(4 + fr * w * h * 2), od = new DataView(out.buffer); out[0] = w; out[1] = h; out[2] = fr;
        for (let k = 0; k < fr; k++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = (y * im.w + k * w + x) * 4, a = im.data[q + 3]; od.setUint16(4 + ((k * h + y) * w + x) * 2, a >= 128 ? rgb15(im.data[q], im.data[q + 1], im.data[q + 2]) : 0, true); }
        sections.push(['FSP' + i, out]); });
    const hdr = 20 + sections.length * 12; let off = (hdr + 15) & ~15; const placed = sections.map(([id, b]) => { const o = off; off = (off + b.length + 15) & ~15; return [id, b, o]; });
    const blk = new Uint8Array(off), v = new DataView(blk.buffer); blk.set([...'NRGDATA1'].map(c => c.charCodeAt(0)), 0); v.setUint32(12, off, true); v.setUint32(16, sections.length, true);
    placed.forEach(([id, b, o], i) => { blk.set([...id].map(c => c.charCodeAt(0)), 20 + i * 12); v.setUint32(24 + i * 12, o, true); v.setUint32(28 + i * 12, b.length, true); blk.set(b, o); });
    return { block: blk, warnings: warn };
};
/* DS banner: the icon (32x32, 15 colours + clear) and the three title lines the DS menu / DraStic shows for the ROM.
 * opts: { title: 'Line 1\nLine 2\nLine 3', icon: {w,h,data:RGBA} (any size; scaled to 32x32) }. Rewrites the banner in place and fixes its CRCs. */
NR.crc16 = (b, a, z) => { let c = 0xFFFF; for (let i = a; i < z; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c & 1) ? (c >>> 1) ^ 0xA001 : c >>> 1; } return c & 0xFFFF; };
NR.iconTo32 = im => { const out = new Uint8ClampedArray(32 * 32 * 4); if (!im || !im.w || !im.h) return out; const sc = Math.min(32 / im.w, 32 / im.h), w = Math.max(1, Math.round(im.w * sc)), h = Math.max(1, Math.round(im.h * sc)), ox = (32 - w) >> 1, oy = (32 - h) >> 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = Math.min(im.w - 1, Math.floor((x + .5) / sc)), sy = Math.min(im.h - 1, Math.floor((y + .5) / sc)), q = (sy * im.w + sx) * 4, d = ((oy + y) * 32 + ox + x) * 4; for (let c = 0; c < 4; c++) out[d + c] = im.data[q + c]; } return out; };
NR.patchBanner = (rom, opts) => {
    const r = new Uint8Array(rom), dv = new DataView(r.buffer, r.byteOffset, r.byteLength), bo = dv.getUint32(0x68, true); if (!bo || bo + 0x840 > r.length) throw new Error('This ROM has no banner to edit');
    const ver = dv.getUint16(bo, true) & 0xFF;
    if (opts.icon) {
        const px = NR.iconTo32(opts.icon), pal = [], idx = new Uint8Array(1024), key = i => ((px[i] >> 3) | (px[i + 1] >> 3) << 5 | (px[i + 2] >> 3) << 10), cnt = new Map();
        for (let i = 0; i < 1024; i++) if (px[i * 4 + 3] >= 128) { const k = key(i * 4); cnt.set(k, (cnt.get(k) || 0) + 1); }
        const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => e[0]); pal.push(0, ...top);
        const dist = (a, b) => { const dr = (a & 31) - (b & 31), dg = ((a >> 5) & 31) - ((b >> 5) & 31), db = ((a >> 10) & 31) - ((b >> 10) & 31); return dr * dr + dg * dg + db * db; };
        for (let i = 0; i < 1024; i++) { if (px[i * 4 + 3] < 128) { idx[i] = 0; continue; } const k = key(i * 4); let best = 1, bd = 1e9; for (let j = 1; j < pal.length; j++) { const d = dist(k, pal[j]); if (d < bd) { bd = d; best = j; } } idx[i] = best; }
        for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x += 2) { const o = bo + 0x20 + (ty * 4 + tx) * 32 + y * 4 + (x >> 1), a = idx[(ty * 8 + y) * 32 + tx * 8 + x], b2 = idx[(ty * 8 + y) * 32 + tx * 8 + x + 1]; r[o] = a | b2 << 4; }
        for (let i = 0; i < 16; i++) dv.setUint16(bo + 0x220 + i * 2, pal[i] || 0, true);
    }
    if (opts.title != null) { const lines = String(opts.title).split('\n').slice(0, 3).map(l => l.replace(/[^\x20-\x7E]/g, '?').slice(0, 31)), txt = lines.join('\n'), nl = ver >= 3 ? 8 : ver >= 2 ? 7 : 6;
        for (let l = 0; l < nl; l++) { const o = bo + 0x240 + l * 0x100; r.fill(0, o, o + 0x100); for (let i = 0; i < txt.length; i++) dv.setUint16(o + i * 2, txt.charCodeAt(i), true); } }
    dv.setUint16(bo + 2, NR.crc16(r, bo + 0x20, bo + 0x840), true); if (ver >= 2) dv.setUint16(bo + 4, NR.crc16(r, bo + 0x20, bo + 0x940), true); if (ver >= 3) dv.setUint16(bo + 6, NR.crc16(r, bo + 0x20, bo + 0xA40), true);
    return r;
};
/* write the block into the engine template ROM */
NR.patchROM = (rom, block) => {
    const magic = [78, 82, 71, 68, 65, 84, 65, 49];
    let at = -1;
    /* the engine's own code also contains the magic string, so require a plausible capacity right after it */
    outer: for (let i = 0; i < rom.length - 16; i += 4) {
        for (let k = 0; k < 8; k++) if (rom[i + k] !== magic[k]) continue outer;
        const c = rom[i + 8] | rom[i + 9] << 8 | rom[i + 10] << 16 | rom[i + 11] << 24;
        if (c >= 65536 && c <= 4 << 20) { at = i; break; }
    }
    if (at < 0) throw new Error('This ROM is not a Notareal engine template');
    const cap = rom[at + 8] | rom[at + 9] << 8 | rom[at + 10] << 16 | rom[at + 11] << 24;
    if (block.length > cap) throw new Error(`Game is too big: ${block.length} bytes, the DS engine holds ${cap}`);
    const out = Uint8Array.from(rom);
    out.fill(0, at, at + cap);
    out.set(block, at);
    out[at + 8] = cap & 255; out[at + 9] = cap >> 8 & 255; out[at + 10] = cap >> 16 & 255; out[at + 11] = cap >>> 24;   // keep capacity
    /* game title in the DS header (offset 0, 12 chars) so launchers show it */
    return { rom: out, offset: at, used: block.length, capacity: cap };
};


/* ---------------------------------------------------------------- level checker (playability) */
/* Exact port of the DS engine's player physics (8.8 fixed point, same collision order), used to prove a
   level can be finished: from the start, simulate runs, walk-offs and jumps of several heights from every
   reachable standing spot, follow springs, avoid hazards, and see whether the goal pole can be touched. */
const COL = { EMPTY: 0, SOLID: 1, PLATFORM: 2, HAZARD: 3 };
NR.FIX_RULES = {
    BURIED_OBJECT: 'Thing placed inside a solid tile (e.g. a spring sunk into the ground): lift it to the first free tile above.',
    NO_START: 'Level has no player start: add one above the ground near the left edge.',
    NO_GOAL: 'Level has no goal flag: add one on the ground near the right edge.',
    START_BURIED: 'Player start is inside a wall: lift it.',
    UNREACHABLE: 'The goal cannot be reached with the hero\'s jump: remove hazards near where the hero gets stuck, lower a step, or add a platform.',
    HAZARD_BLOCK: 'Spikes/water right where the hero has to land or take off make the next platform impossible.',
};
/* margin < 1 plays like a less-than-perfect human: a bit less jump and speed than the maximum. A jump that only
   works pixel-perfect at full power is reported as impossible for real players. */
function physOf(P, margin = 1) {
    const ph = P.meta.physics || {}, hero = P.sprites.hero || { w: 16, h: 32 }, r = v => Math.round(v * 256);
    return { gravity: r(ph.gravity || 0.25), jump: r((ph.jump || 4.6) * margin), run: r((ph.run || 1.5) * margin), runFast: r((ph.runFast || 0) * margin), jumpRun: r((ph.jumpRun || 0) * margin),
             accel: r(ph.accel || 0.08), maxFall: (Math.round(ph.maxFall || 4) || 6) * 256, hw: hero.w - 4, hh: hero.h - 2 };
}
function makeSim(P, L, margin) {
    const cols = P.tileset.cols, ph = physOf(P, margin), H = L.h, W = L.w;
    const col = (x, y) => { const mx = x >> 4, my = y >> 4; if (mx < 0 || mx >= W) return COL.SOLID; if (my < 0 || my >= H) return COL.EMPTY; return cols[L.map[my * W + mx]] || 0; };
    const solid = (x, y) => col(x, y) === COL.SOLID;
    const springs = (L.objects || []).filter(o => o.type === 'spring').map(o => [o.x * 16, o.y * 16]);
    const goal = (L.objects || []).find(o => o.type === 'goal');
    /* run one input script from a state; returns landings / goal / death */
    function run(st, script, maxF) {
        let { px, py, pvx, pvy } = st, onG = st.onG, coy = 0, jbuf = 0, left = false, prevJump = false;
        const out = { lands: [], goal: false, dead: false, path: [] };
        const { hw, hh } = ph; let wasAir = !onG;
        for (let f = 0; f < maxF; f++) {
            const k = script(f, onG, px >> 8); const jumpHeld = !!k.jump, jumpPressed = jumpHeld && !prevJump; prevJump = jumpHeld;
            const maxv = k.run ? (ph.runFast || (ph.run * 3 >> 1)) : ph.run, acc = ph.accel;
            if (k.dir < 0) { pvx -= acc; if (pvx < -maxv) pvx = -maxv; } else if (k.dir > 0) { pvx += acc; if (pvx > maxv) pvx = maxv; }
            else { if (pvx > 0) { pvx -= acc; if (pvx < 0) pvx = 0; } else if (pvx < 0) { pvx += acc; if (pvx > 0) pvx = 0; } }
            let nx = px + pvx, x = nx >> 8, y = py >> 8;
            if (pvx > 0 && (solid(x + hw - 1, y) || solid(x + hw - 1, y + (hh >> 1)) || solid(x + hw - 1, y + hh - 1))) { nx = (((x + hw - 1) >> 4) * 16 - hw) * 256; pvx = 0; }
            if (pvx < 0 && (solid(x, y) || solid(x, y + (hh >> 1)) || solid(x, y + hh - 1))) { nx = ((x >> 4) * 16 + 16) * 256; pvx = 0; }
            px = nx < 0 ? 0 : nx;
            if (jumpPressed) jbuf = 6; else if (jbuf) jbuf--;
            if (onG) coy = 6; else if (coy) coy--;
            if (jbuf && coy) { let j = ph.jump; if (ph.jumpRun && ph.runFast) { const sp = Math.min(Math.abs(pvx), ph.runFast); j += Math.trunc((ph.jumpRun - ph.jump) * sp / ph.runFast); } pvy = -j; jbuf = 0; coy = 0; onG = false; }
            let g = ph.gravity; if (pvy < 0 && !jumpHeld) g *= 2;
            pvy += g; if (pvy > ph.maxFall) pvy = ph.maxFall;
            let ny = py + pvy; x = px >> 8; const yb = (py >> 8) + hh, nyb = (ny >> 8) + hh;
            onG = false;
            if (pvy >= 0) {
                for (let sx = x + 1; sx <= x + hw - 2; sx += hw - 3) {
                    const c = col(sx, nyb), top = (nyb >> 4) * 16;
                    if (c === COL.SOLID || (c === COL.PLATFORM && yb <= top)) { ny = (top - hh) * 256; pvy = 0; onG = true; break; }
                }
            } else { const ty = ny >> 8; if (solid(x + 1, ty) || solid(x + hw - 2, ty)) { ny = ((ty >> 4) * 16 + 16) * 256; pvy = 0; } }
            py = ny; x = px >> 8; y = py >> 8;
            if (col(x + (hw >> 1), y + hh - 2) === COL.HAZARD || col(x + 2, y + (hh >> 1)) === COL.HAZARD || col(x + hw - 3, y + (hh >> 1)) === COL.HAZARD || y > H * 16 + 32) { out.dead = true; out.deathAt = [x, y]; break; }
            for (const [sx, sy] of springs) if (pvy > 0 && x < sx + 14 && sx + 2 < x + hw && y < sy + 16 && sy + 2 < y + hh) pvy = -Math.trunc(ph.jump * 8 / 5);
            if (goal && x < goal.x * 16 + 14 && goal.x * 16 + 2 < x + hw) out.goal = true;
            if (f % 4 === 0) out.path.push([x, y]);
            if (onG && (wasAir || f % 8 === 0)) out.lands.push({ px, py, mx: (x + (hw >> 1)) >> 4, my: (y + hh) >> 4 });
            if (onG && wasAir && f > 2 && k.stopOnLand) break;
            wasAir = !onG;
        }
        return out;
    }
    return { run, ph, col, springs };
}
/* input scripts the checker tries. Kid-friendly rule (default): every level must be finishable WITHOUT
   holding the run button, because players who don't know about Y couldn't clear a jump that needs it. */
const makeScripts = run => {
    const s = [];
    for (const dir of [1, -1]) {
        s.push({ name: 'walk', fn: () => ({ dir, run }), frames: 90 });
        for (const hold of [3, 8, 16, 60]) for (const release of [999, 26, 14, 8, 4]) s.push({ name: `jump${hold}/${release}`, fn: f => ({ dir: f < release ? dir : 0, run, jump: f < hold, stopOnLand: true }), frames: 200 });
        for (const pre of [10, 24]) s.push({ name: `runup${pre}`, fn: f => ({ dir, run, jump: f >= pre && f < pre + 60, stopOnLand: f > pre + 2 }), frames: 220 });
    }
    return s;
};
const SCRIPTS_WALK = makeScripts(false), SCRIPTS_RUN = makeScripts(true);
NR._makeSim = makeSim;
NR.checkLevel = (P, li, opts = {}) => {
    const SCRIPTS = opts.allowRun ? SCRIPTS_RUN : SCRIPTS_WALK;
    const L = P.levels[li], issues = [], cols = P.tileset.cols, W = L.w, H = L.h;
    const tileCol = (x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? (x < 0 || x >= W ? 1 : 0) : (cols[L.map[y * W + x]] || 0);
    for (const o of L.objects || []) {
        if ((o.type !== 'start') && (tileCol(o.x, o.y) === COL.SOLID || tileCol(o.x, o.y) === COL.HAZARD))
            issues.push({ code: 'BURIED_OBJECT', x: o.x, y: o.y, msg: `${o.type} at column ${o.x} is inside a ${tileCol(o.x, o.y) === COL.HAZARD ? 'hazard' : 'solid'} tile`, fix: { kind: 'lift', obj: o } });
    }
    const start = (L.objects || []).find(o => o.type === 'start'), goal = (L.objects || []).find(o => o.type === 'goal');
    if (!start) issues.push({ code: 'NO_START', msg: 'No player start', fix: { kind: 'add_start' } });
    if (!goal) issues.push({ code: 'NO_GOAL', msg: 'No goal flag', fix: { kind: 'add_goal' } });
    if (start && (tileCol(start.x, start.y) === COL.SOLID)) issues.push({ code: 'START_BURIED', x: start.x, y: start.y, msg: 'Player start is inside a wall', fix: { kind: 'lift', obj: start } });
    if (!start || !goal) return { ok: false, reachable: false, issues, visited: [] };
    const sim = makeSim(P, L, opts.margin != null ? opts.margin : 0.9), { hw, hh } = sim.ph;
    /* the engine spawns the hero centred on the start tile with feet on its bottom edge, then it falls */
    let s0 = { px: (start.x * 16 + ((16 - hw) >> 1)) * 256, py: (start.y * 16 + 16 - hh) * 256, pvx: 0, pvy: 0, onG: false };
    const drop = sim.run(s0, () => ({ dir: 0 }), 240);
    if (drop.dead) { issues.push({ code: 'UNREACHABLE', msg: 'The hero falls into a pit or hazard right at the start', x: start.x, fix: { kind: 'repair', at: start.x } }); return { ok: false, reachable: false, issues, visited: [] }; }
    const l0 = drop.lands[drop.lands.length - 1];
    const key = l => l.mx + ',' + l.my, seen = new Map(), q = [];
    const push = l => { const k = key(l); if (seen.has(k)) return; seen.set(k, l); q.push(l); };
    if (!l0) return { ok: false, reachable: false, issues: issues.concat([{ code: 'UNREACHABLE', msg: 'The hero never lands after starting', x: start.x }]), visited: [] };
    push(l0);
    let reached = false, maxX = l0.mx, deaths = [];
    while (q.length && !reached) {
        const l = q.shift();
        /* targeted scripts for springs nearby: step onto the spring with a small hop, then steer left or right after the bounce */
        const extra = [];
        for (const o of L.objects) if (o.type === 'spring' && Math.abs(o.x - l.mx) <= 5) {
            const tx = o.x * 16 + 8;
            for (const side of [1, -1]) extra.push({ fn: (f, onG, x) => { const c = x + (hw >> 1); return { dir: f > 24 ? side : (c < tx - 2 ? 1 : c > tx + 2 ? -1 : 0), run: false, jump: f < 3 || (f > 4 && f < 70), stopOnLand: f > 30 }; }, frames: 260 });
        }
        for (const sc of SCRIPTS.concat(extra)) {
            const r = sim.run({ px: l.px, py: l.py, pvx: 0, pvy: 0, onG: true }, sc.fn, sc.frames);
            if (r.goal) { reached = true; break; }
            if (r.dead && r.deathAt) deaths.push(r.deathAt);
            for (const n of r.lands) { push(n); if (n.mx > maxX) maxX = n.mx; }
        }
        if (seen.size > 4000) break;
    }
    if (!reached) {
        const gx = goal.x, hz = [];
        for (let x = maxX; x < Math.min(W, maxX + 10); x++) for (let y = 0; y < H; y++) if (tileCol(x, y) === COL.HAZARD) hz.push([x, y]);
        const blockedByHazard = hz.length > 0;
        const withRun = !opts.allowRun && NR.checkLevel(P, li, { allowRun: true, margin: 1 }).reachable;
        issues.push({ code: blockedByHazard ? 'HAZARD_BLOCK' : 'UNREACHABLE', x: maxX, msg: `The hero can't get past column ${maxX} of ${W}${blockedByHazard ? ` (hazards at column ${[...new Set(hz.map(h => h[0]))].join(', ')})` : ''}; the goal is at column ${gx}.` + (withRun ? ' It is only possible with a perfect running jump (holding Y), which most players won\'t find.' : ''), fix: { kind: 'repair', at: maxX }, needsRun: withRun });
    }
    return { ok: reached && !issues.some(i => i.code !== 'BURIED_OBJECT' ? false : true), reachable: reached, issues, visited: [...seen.values()].map(l => [l.mx, l.my]), maxX };
};
/* offline auto-fix: apply the simplest edit that removes each issue, re-checking after every change */
NR.autofixLevel = (P, li, maxSteps = 24) => {
    const L = P.levels[li], cols = P.tileset.cols, W = L.w, H = L.h, log = [];
    const tc = (x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? 0 : (cols[L.map[y * W + x]] || 0);
    const groundAt = x => { for (let y = 0; y < H; y++) if (tc(x, y) === 1 || tc(x, y) === 2) return y; return H; };
    const solidTile = cols.findIndex((c, i) => i > 0 && c === 1), platTile = cols.findIndex((c, i) => i > 0 && c === 2);
    for (let step = 0; step < maxSteps; step++) {
        const r = NR.checkLevel(P, li); const iss = r.issues;
        if (!iss.length) { log.push('Level checks out: the goal can be reached.'); return { ok: true, log, check: r }; }
        const i = iss[0];
        if (i.fix && i.fix.kind === 'lift') { const o = i.fix.obj, y0 = o.y; while (o.y > 0 && (tc(o.x, o.y) === 1 || tc(o.x, o.y) === 3)) o.y--; log.push(`Lifted ${o.type} at column ${o.x} from row ${y0} to row ${o.y} (${NR.FIX_RULES.BURIED_OBJECT})`); continue; }
        if (i.code === 'NO_START') { L.objects.push({ type: 'start', x: 2, y: Math.max(0, groundAt(2) - 2) }); log.push('Added a player start.'); continue; }
        if (i.code === 'NO_GOAL') { L.objects.push({ type: 'goal', x: W - 3, y: Math.max(0, groundAt(W - 3) - 1) }); log.push('Added a goal flag.'); continue; }
        if (i.code === 'HAZARD_BLOCK' || i.code === 'UNREACHABLE') {
            const at = i.x || 0; let fixed = false;
            const floorLeft = x => { for (let xx = x; xx >= 0; xx--) { const g = groundAt(xx); if (g < H) return g; } return H - 3; };
            /* 1) remove hazards near the sticking point, nearest first */
            for (let x = at; x < Math.min(W, at + 10) && !fixed; x++) for (let y = 0; y < H; y++) if (tc(x, y) === 3) { L.map[y * W + x] = 0; log.push(`Removed a hazard tile at column ${x}, row ${y} (${NR.FIX_RULES.HAZARD_BLOCK})`); fixed = true; break; }
            if (fixed) continue;
            /* 2) a wall too tall: lower the next column that rises 2+ tiles above the current floor */
            const g0 = floorLeft(at);
            for (let x = at + 1; x < Math.min(W, at + 6) && !fixed; x++) { const g = groundAt(x); if (g < g0 - 2) { L.map[g * W + x] = 0; log.push(`Lowered the step at column ${x} (it was too tall to jump)`); fixed = true; } }
            if (fixed) continue;
            /* 3) a gap too wide: add a jump-through platform in the middle */
            /* first empty column of the gap, 2+ tiles past the last floor the hero reached */
            for (let x = at + 1; x < Math.min(W, at + 9) && !fixed; x++) if (groundAt(x) >= H && groundAt(x - 1) >= H - 0 || (groundAt(x) >= H && x >= at + 2)) { const y = Math.min(H - 1, Math.max(1, g0)); if (L.map[y * W + x]) continue; L.map[y * W + x] = platTile > 0 ? platTile : solidTile; log.push(`Added a platform at column ${x} over a gap that was too wide`); fixed = true; }
            if (fixed) continue;
            log.push(`Could not fix automatically near column ${at}. Try the AI helper or move things by hand.`); return { ok: false, log, check: r };
        }
    }
    return { ok: false, log, check: NR.checkLevel(P, li) };
};
/* edit operations the AI helper may propose: validated and applied to a copy */
NR.applyOps = (P, ops) => {
    const Q = JSON.parse(JSON.stringify(P)), done = [], bad = [];
    const nt = P.tileset.cols.length, types = Object.keys(OBJ_TYPES), PH = { gravity: [0.05, 0.6], jump: [1, 9], jumpRun: [0, 10], run: [0.3, 4], runFast: [0, 5], accel: [0.01, 0.5], maxFall: [1, 8] };
    for (const op of ops || []) {
        const L = Q.levels[op.level != null ? op.level : 0];
        const inb = (x, y) => L && Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < L.w && y < L.h;
        if (op.op === 'set_tile' && inb(op.x, op.y) && Number.isInteger(op.tile) && op.tile >= 0 && op.tile < nt) { L.map[op.y * L.w + op.x] = op.tile; done.push(op); }
        else if (op.op === 'remove_object' && inb(op.x, op.y)) { const n = L.objects.length; L.objects = L.objects.filter(o => !(o.x === op.x && o.y === op.y)); (n !== L.objects.length ? done : bad).push(op); }
        else if (op.op === 'add_object' && inb(op.x, op.y) && types.includes(op.type)) { if (op.type === 'start') L.objects = L.objects.filter(o => o.type !== 'start'); L.objects.push({ type: op.type, x: op.x, y: op.y }); done.push(op); }
        else if (op.op === 'move_object' && op.from && op.to && inb(op.from.x, op.from.y) && inb(op.to.x, op.to.y)) { const o = L.objects.find(o => o.x === op.from.x && o.y === op.from.y); if (o) { o.x = op.to.x; o.y = op.to.y; done.push(op); } else bad.push(op); }
        else if (op.op === 'set_physics' && PH[op.key] && typeof op.value === 'number') { Q.meta.physics[op.key] = Math.max(PH[op.key][0], Math.min(PH[op.key][1], op.value)); Q.meta.physics.preset = 'custom'; done.push(op); }
        else if (op.op === 'set_lives' && Number.isInteger(op.value) && op.value >= 1 && op.value <= 9) { Q.meta.lives = op.value; done.push(op); }
        else bad.push(op);
    }
    return { project: Q, applied: done, rejected: bad };
};
/* compact text view of a level for the AI helper */
NR.levelText = (P, li) => {
    const L = P.levels[li], cols = P.tileset.cols, ch = ['.', '#', '=', '^'];
    const rows = []; for (let y = 0; y < L.h; y++) { let r = ''; for (let x = 0; x < L.w; x++) r += L.map[y * L.w + x] ? ch[cols[L.map[y * L.w + x]] || 0] : '.'; rows.push(r); }
    const sym = { start: 'S', coin: 'c', walker: 'w', hopper: 'h', flyer: 'f', spring: 'J', heart: 'H', check: 'k', goal: 'G' };
    for (const o of L.objects) if (o.y >= 0 && o.y < L.h && o.x >= 0 && o.x < L.w) rows[o.y] = rows[o.y].slice(0, o.x) + (sym[o.type] || '?') + rows[o.y].slice(o.x + 1);
    return rows.join('\n');
};

if (typeof module !== 'undefined' && module.exports) module.exports = NR; else root.NRKit = NR;
})(typeof window !== 'undefined' ? window : globalThis);

/* MEMPHIS SIGIL kit side: .msig project codec (byte-identical to engine/sigil/source/msig.h), the integer drum synth (identical to synth.h, so the
   editor previews exactly what the DS plays), a WAV renderer that follows the DS sequencer rules (swing, pitch, volume, hat choke, song chain),
   starter projects built from the Korg DS-10 / M01 data, and the DS ROM data block (section "SGPJ"). */
(function (root) {
    const node = typeof module !== 'undefined', S = {};
    S.ROWS = 8; S.STEPS = 32; S.PATS = 5; S.VER = 1; S.HZ = 22050; S.SIZE = 8 + 16 + 2 + 4 + 16 + 2 + 8 + 8 + 8 + 5 * (8 * 32 + 32) + 4;
    S.SOUNDS = [['808 KICK', 'KICK'], ['PUNCH KICK', 'PNCH'], ['SNARE', 'SNR'], ['CLAP', 'CLAP'], ['CLOSED HAT', 'CHAT'], ['OPEN HAT', 'OHAT'], ['COWBELL', 'COWB'], ['RIMSHOT', 'RIM'], ['METAL HAT', 'METL'], ['PERC TOM', 'PERC'], ['808 BASS', 'BASS'], ['SNAP SNARE', 'SNP2']];
    const LEN = [11025, 5512, 4851, 5512, 1543, 8820, 6615, 1323, 3308, 6615, 19845, 4410], TUNE = [[0x11, 0x4c], [0x11, 0x43], [0x1d, 0x44], [0x1d, 0x21], [0x7f, 0], [0x7f, 1], [0x15, 0x1c], [0x39, 0], [0x7f, 3], [0x3e, 0], [0x0e, 0x61], [0x39, 0]];
    S.LEN = LEN; S.ROOT_MIDI = 33; S.PAN = [64, 64, 80, 40, 90, 100, 30, 64];
    /* ---------------- CRC32 + codec */
    const CT = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; CT[i] = c >>> 0; }
    S.crc = (b, n) => { let c = 0xFFFFFFFF; for (let i = 0; i < n; i++) c = CT[(c ^ b[i]) & 255] ^ (c >>> 8); return (~c) >>> 0; };
    S.blank = () => ({ name: 'NEW SONG', bpm: 100, swing: 0, master: 110, npat: 5, chainlen: 1, chain: new Array(16).fill(0), songmode: 0, bassnote: 33, snd: [0, 2, 3, 4, 5, 6, 7, 10], pitch: new Array(8).fill(0), vol: [118, 100, 100, 80, 100, 70, 100, 115], pat: Array.from({ length: 5 }, () => Array.from({ length: 8 }, () => new Array(32).fill(0))), note: Array.from({ length: 5 }, () => new Array(32).fill(0)) });
    S.pack = P => {
        const b = new Uint8Array(S.SIZE); let o = 0; b.set([77, 83, 73, 71], 0); o = 4; b[o++] = S.VER; b[o++] = 0; const sz = o; o += 2;
        const nm = String(P.name || '').toUpperCase().slice(0, 15); for (let i = 0; i < 16; i++) b[o + i] = i < nm.length ? nm.charCodeAt(i) & 127 : 0; o += 16;
        b[o++] = P.bpm & 255; b[o++] = P.bpm >> 8; b[o++] = P.swing; b[o++] = P.master; b[o++] = P.npat; b[o++] = P.chainlen; for (let i = 0; i < 16; i++) b[o++] = P.chain[i] | 0; b[o++] = P.songmode; b[o++] = P.bassnote;
        for (let i = 0; i < 8; i++) b[o++] = P.snd[i]; for (let i = 0; i < 8; i++) b[o++] = P.pitch[i] & 255; for (let i = 0; i < 8; i++) b[o++] = P.vol[i];
        for (let p = 0; p < 5; p++) { for (let r = 0; r < 8; r++) for (let s = 0; s < 32; s++) b[o++] = P.pat[p][r][s] | 0; for (let s = 0; s < 32; s++) b[o++] = P.note[p][s] | 0; }
        const pay = o - (sz + 2); b[sz] = pay & 255; b[sz + 1] = pay >> 8; const c = S.crc(b, o); b[o++] = c & 255; b[o++] = (c >>> 8) & 255; b[o++] = (c >>> 16) & 255; b[o++] = c >>> 24; return b.slice(0, o);
    };
    /* returns {ok:0, proj} or {ok:code}: 1 too short, 2 bad magic, 3 version too new, 4 bad crc, 5 size mismatch / out of range */
    S.unpack = b => {
        const n = b.length; if (n < 12) return { ok: 1 }; if (b[0] !== 77 || b[1] !== 83 || b[2] !== 73 || b[3] !== 71) return { ok: 2 }; if ((b[4] | b[5] << 8) > S.VER) return { ok: 3 };
        const pay = b[6] | b[7] << 8; if (n < 8 + pay + 4) return { ok: 1 }; const c = S.crc(b, 8 + pay), s = (b[8 + pay] | b[9 + pay] << 8 | b[10 + pay] << 16 | b[11 + pay] << 24) >>> 0; if (c !== s) return { ok: 4 }; if (pay !== S.SIZE - 12) return { ok: 5 };
        const P = S.blank(); let o = 8; let nm = ''; for (let i = 0; i < 16 && b[o + i]; i++) nm += String.fromCharCode(b[o + i]); P.name = nm; o += 16; P.bpm = b[o] | b[o + 1] << 8; o += 2; P.swing = b[o++]; P.master = b[o++]; P.npat = b[o++]; P.chainlen = b[o++];
        for (let i = 0; i < 16; i++) P.chain[i] = b[o++]; P.songmode = b[o++]; P.bassnote = b[o++]; for (let i = 0; i < 8; i++) P.snd[i] = b[o++]; for (let i = 0; i < 8; i++) P.pitch[i] = (b[o++] << 24) >> 24; for (let i = 0; i < 8; i++) P.vol[i] = b[o++];
        for (let p = 0; p < 5; p++) { for (let r = 0; r < 8; r++) for (let s2 = 0; s2 < 32; s2++) P.pat[p][r][s2] = b[o++]; for (let s2 = 0; s2 < 32; s2++) P.note[p][s2] = b[o++]; }
        if (P.bpm < 40 || P.bpm > 240 || P.npat > 5 || P.chainlen > 16) return { ok: 5 }; return { ok: 0, proj: P };
    };
    /* ---------------- the integer drum synth (mirror of synth.h) */
    const mul15 = (a, b) => Math.floor(a * b / 32768), clip16 = v => v > 32767 ? 32767 : v < -32768 ? -32768 : v, sat8 = v => v > 127 ? 127 : v < -128 ? -128 : v;
    const LUT = new Int16Array(256); for (let i = 0; i < 256; i++) { const x = i < 128 ? i : i - 128, u = x * (128 - x), s = Math.trunc(32767 * 16 * u / (81920 - 4 * u)); LUT[i] = i < 128 ? s : -s; }
    S.LUT = LUT; const osc = ph => LUT[ph >>> 24], inc = fq8 => Math.floor(fq8 * 194783 / 256) >>> 0;
    S.render = id => {
        const n = LEN[id], o = new Int8Array(n), t0 = TUNE[id][0], t1 = TUNE[id][1]; let rs = (0x9E3779B9 + id * 2654435) >>> 0; const noise = () => { rs = (rs ^ (rs << 13)) >>> 0; rs = (rs ^ (rs >>> 17)) >>> 0; rs = (rs ^ (rs << 5)) >>> 0; return ((rs >>> 8) & 0xffff) << 16 >> 16; };
        let ph = 0, ph2 = 0, env = 32767, envf = 32767, px = 0;
        for (let i = 0; i < n; i++) {
            let v = 0;
            switch (id) {
                case 0: { const f = (40 << 8) + Math.trunc((t0 << 7) / 17) * 2 + Math.floor(envf * (110 << 8) / 32768); ph = (ph + inc(f)) >>> 0; v = mul15(osc(ph), env); envf = (envf * 32723) >> 15; env = (env * (32760 - (t1 >> 5))) >> 15; if (i < 40) v += Math.trunc((i < 20 ? 6000 : -6000) * (40 - i) / 40); v = Math.trunc(v * 3 / 2); v = clip16(v); break; }
                case 1: { const f = (52 << 8) + Math.floor(envf * (260 << 8) / 32768); ph = (ph + inc(f)) >>> 0; v = mul15(osc(ph), env) * 2; v = clip16(v); envf = (envf * 32701) >> 15; env = (env * 32747) >> 15; break; }
                case 2: case 11: { const fr = id === 2 ? 185 + (t0 >> 3) : 240 + (t0 >> 3); ph = (ph + inc(fr << 8)) >>> 0; const tone = mul15(osc(ph), envf), nz = mul15(noise(), env); v = ((tone * (id === 2 ? 5 : 3)) >> 3) + ((nz * (id === 2 ? 5 : 7)) >> 3); envf = (envf * 32731) >> 15; env = (env * (id === 2 ? 32744 : 32723)) >> 15; break; }
                case 3: { const nz = noise(), hp = nz - px; px = nz; let g = 0; const ms = Math.trunc(i * 1000 / S.HZ); if (ms < 6 || (ms >= 11 && ms < 17) || (ms >= 22 && ms < 28)) g = 32767; else if (ms >= 28) g = env; if (ms >= 28) env = (env * 32747) >> 15; v = mul15(hp, g); break; }
                case 4: case 5: { const nz = noise(), hp = nz - px; px = nz; v = mul15(hp, env); env = (env * (id === 4 ? 32664 : 32755)) >> 15; break; }
                case 6: { ph = (ph + inc(540 << 8)) >>> 0; ph2 = (ph2 + inc(800 << 8)) >>> 0; const a = ph >>> 31 ? 14000 : -14000, b = ph2 >>> 31 ? 14000 : -14000; v = mul15(a + b, env); env = (env * 32753) >> 15; break; }
                case 7: { ph = (ph + inc(1700 << 8)) >>> 0; ph2 = (ph2 + inc(480 << 8)) >>> 0; v = Math.trunc(Math.floor((osc(ph) + osc(ph2)) * env / 32768) / 2); if (i < 10) v += (i & 1 ? -9000 : 9000); env = (env * 32634) >> 15; break; }
                case 8: { const m = [411, 616, 854, 1115, 1394, 1685]; let a = 0; for (let k = 0; k < 6; k++) { const q = Math.imul(inc(m[k] << 8), i + 1) >>> 0; a += (q >>> 31) ? 3500 : -3500; } v = mul15(a, env); env = (env * 32726) >> 15; break; }
                case 9: { const f = (110 << 8) + Math.floor(envf * (130 << 8) / 32768) + t0 * 12; ph = (ph + inc(f)) >>> 0; v = mul15(osc(ph), env); envf = (envf * 32738) >> 15; env = (env * 32750) >> 15; break; }
                case 10: { ph = (ph + inc((55 << 8) + 32)) >>> 0; const s1 = osc(ph), s2 = osc((ph * 2) >>> 0) >> 2; v = mul15(s1 + s2, env); v = Math.trunc(v * 5 / 4); v = clip16(v); env = (env * (32764 - (t1 >> 5))) >> 15; if (i > n - 400) v = Math.trunc(v * (n - i) / 400); if (i < 30) v = Math.trunc(v * i / 30); break; }
            }
            o[i] = sat8(Math.floor(v / 256));
        }
        return o;
    };
    S.fnv = a => { let c = 2166136261; for (let i = 0; i < a.length; i++) c = Math.imul(c ^ (a[i] & 255), 16777619) >>> 0; return c; };
    const SEMI = [256, 271, 287, 304, 322, 341, 362, 383, 406, 430, 456, 483, 512];
    S.rate = semis => { let oct = 0; while (semis >= 12) { semis -= 12; oct++; } while (semis < 0) { semis += 12; oct--; } const hz = (S.HZ * SEMI[semis]) >> 8; return oct >= 0 ? hz << oct : hz >> -oct; };
    let cache = null; S.sounds = () => cache || (cache = S.SOUNDS.map((_, i) => S.render(i)));
    /* ---------------- render a project to a mono 16-bit WAV, following the DS sequencer (96 PPQ ticks, swing on odd steps, hat choke, chain) */
    S.renderWav = (P, o = {}) => {
        const sr = o.rate || 44100, snds = S.sounds(), bars = o.bars || (P.songmode && P.chainlen ? P.chainlen : 2), tickSec = 60 / P.bpm / 96, total = bars * 16 * 24, events = [];
        for (let t = 0, step = 0, cp = 0; t < total; ) {
            const pp = P.songmode && P.chainlen ? P.chain[cp] % 5 : (o.pattern || 0), sw = (step & 1) ? P.swing : 0, at = (t + sw) * tickSec;
            for (let r = 0; r < 8; r++) { const v = P.pat[pp][r][step]; if (v) events.push({ at, r, v, semis: r === 7 ? P.note[pp][step] + (P.bassnote - S.ROOT_MIDI) : 0 }); }
            t += 24; if (++step >= 16) { step = 0; if (P.songmode && P.chainlen && ++cp >= P.chainlen) cp = 0; }
        }
        const n = Math.ceil(sr * (total * tickSec + 1.2)), out = new Float32Array(n), chokes = events.filter(e => e.r === 3).map(e => Math.round(e.at * sr)).sort((x, y) => x - y);
        events.sort((a, b) => a.at - b.at);
        for (const e of events) {
            const d = snds[P.snd[e.r]] || snds[0], hz = S.rate(P.pitch[e.r] + e.semis), vol = Math.min(127, Math.floor(e.v * P.vol[e.r] / 127)) / 127 * (P.master / 127) * 0.5, start = Math.round(e.at * sr), stepS = hz / sr, len = d.length & ~3;
            const cut = e.r === 4 ? (chokes.find(c => c > start) ?? Infinity) : Infinity;   // a closed hat kills the open hat that is still ringing (the DS does the same with snd_stop)
            for (let k = 0, pos = 0; pos < len; k++, pos += stepS) { const idx = start + k; if (idx >= n || idx >= cut) break; out[idx] += d[pos | 0] / 128 * vol; }
        }
        let peak = 1; for (const v of out) peak = Math.max(peak, Math.abs(v)); const b = new Uint8Array(44 + n * 2), dv = new DataView(b.buffer), w = (p, t) => [...t].forEach((c, i) => b[p + i] = c.charCodeAt(0));
        w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(out[i] / peak * 30000))), true); return { wav: b, seconds: n / sr, hits: events.length };
    };
    /* ---------------- starter projects: DS-10 demo tempos/chains + M01 grooves */
    const D = () => node ? require('./nrsigil_data.js') : root.NRSigilData;
    S.data = D;
    S.starter = (kind = 'boom-bap') => {
        const P = S.blank(), K = (a, b) => { for (const s of b) P.pat[a][0][s] = s ? 100 : 127; };
        P.name = kind.toUpperCase().slice(0, 15); P.snd = [0, 2, 3, 4, 5, 6, 7, 10];
        const set = (p, r, steps, v) => steps.forEach(s => P.pat[p][r][s] = v), preset = {
            'boom-bap': { bpm: 92, sw: 3, k: [[0, 6, 10], [0, 3, 8, 10, 15]], sn: [4, 12], h: 2, bass: [[0, 0], [7, 7], [10, 3]] }, 'trap': { bpm: 140, sw: 0, k: [[0, 7, 10], [0, 3, 10, 13]], sn: [8], h: 1, bass: [[0, 0], [3, 0], [10, 5]] }, 'house': { bpm: 124, sw: 0, k: [[0, 4, 8, 12], [0, 4, 8, 12]], sn: [4, 12], h: 2, bass: [[2, 0], [6, 0], [10, 3], [14, 0]] }
        }[kind] || null; if (!preset) throw new Error('Unknown starter: ' + kind);
        P.bpm = preset.bpm; P.swing = preset.sw; for (let p = 0; p < 2; p++) { K(p, preset.k[p]); set(p, 1, preset.sn, 118); set(p, 2, preset.sn, 80); for (let s = 0; s < 16; s += preset.h) P.pat[p][3][s] = s % 4 ? 64 : 90; if (kind === 'trap') for (const s of [13, 14, 15]) P.pat[p][3][s] = 50; set(p, 4, [14], 90); for (const [s, n] of preset.bass) { P.pat[p][7][s] = 105; P.note[p][s] = n; } }
        const G = D().grooves; for (let p = 2; p < 5; p++) for (let r = 0; r < 7; r++) for (let s = 0; s < 16; s++) P.pat[p][r][s] = G[(p * 7 + 1) % G.length][r][s];
        P.chainlen = 4; P.chain.splice(0, 4, 0, 0, 1, 0); return P;
    };
    /* the DS-10 demos' tempo and section layout, mapped onto the 5 Sigil patterns */
    S.fromKorgDemo = i => { const d = D().ds10_demos.filter(x => x.chain.length)[i % 6], P = S.starter('boom-bap'), uniq = []; for (const c of d.chain) if (!uniq.includes(c)) uniq.push(c);
        P.name = ('DS10 ' + d.name).slice(0, 15); P.bpm = Math.max(40, Math.min(240, d.bpm)); const seq = []; for (const c of d.chain) { const q = uniq.indexOf(c) % 5; if (seq.length === 0 || seq[seq.length - 1] !== q) seq.push(q); } P.chainlen = Math.min(16, seq.length); P.chain = seq.concat(new Array(16).fill(0)).slice(0, 16); P.songmode = 1; return P; };
    S.randomise = (P, p, rnd) => { const R = rnd || Math.random; const g = P.pat[p]; for (const r of g) r.fill(0); P.note[p].fill(0); for (let s = 0; s < 16; s++) { if (s === 0 || (!(s & 3) && R() < .33) || (s & 1 && R() < .14)) g[0][s] = s ? 100 : 127; if (s === 4 || s === 12) g[1][s] = 118; if (!(s & 1)) g[3][s] = 55 + Math.floor(R() * 4) * 14; if (R() < .2) { g[7][s] = 100; P.note[p][s] = [0, 0, 3, 5, 7, 10, 12][Math.floor(R() * 7)]; } } };
    S.summary = P => { let hits = 0; for (let p = 0; p < 5; p++) for (let r = 0; r < 8; r++) for (let s = 0; s < 16; s++) if (P.pat[p][r][s]) hits++; return { hits, bars: P.songmode ? P.chainlen : 1, seconds: Math.round((P.songmode ? P.chainlen : 1) * 4 * 60 / P.bpm * 10) / 10 }; };
    /* ---------------- DS ROM data block: a single SGPJ section holding the .msig bytes the engine boots into */
    S.buildDS = P => {
        const b = S.pack(P), hdr = 20 + 12, off = (hdr + 15) & ~15, blk = new Uint8Array((off + b.length + 15) & ~15), v = new DataView(blk.buffer);
        blk.set([...'NRGDATA1'].map(c => c.charCodeAt(0)), 0); v.setUint32(12, blk.length, true); v.setUint32(16, 1, true); blk.set([...'SGPJ'].map(c => c.charCodeAt(0)), 20); v.setUint32(24, off, true); v.setUint32(28, b.length, true); blk.set(b, off);
        return { block: blk, warnings: [] };
    };
    if (node) module.exports = S; else root.NRSigil = S;
})(typeof window !== 'undefined' ? window : globalThis);

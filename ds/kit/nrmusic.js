/* NOTAREAL Dev Kit: instruments + style composer (runs in the editor and in node).
 * Every instrument is synthesized here from maths (no samples taken from any game), so the browser preview
 * and the DS build use the exact same sounds. Songs are up to 8 tracks; each track has an instrument.
 *   note values: 0 = silence, 1..127 = MIDI note (or drum number on a kit track), 128 = keep holding. */
(function (root) {
'use strict';
const M = {};
const TAU = Math.PI * 2;
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
M.rng = rng;

/* ------------------------------------------------------------------ synthesis helpers */
const DR = 16384;                                   // drum / one-shot sample rate
const env = (i, sr, a, d, s, r, len) => { const t = i / sr; if (t < a) return t / a; const td = t - a; if (td < d) return 1 - (1 - s) * td / d; if (len && t > len) return s * Math.max(0, 1 - (t - len) / r); return s; };
const expd = (i, sr, tau) => Math.exp(-i / (sr * tau));
function lp(buf, cut, sr) { const a = 1 - Math.exp(-TAU * cut / sr); let y = 0; for (let i = 0; i < buf.length; i++) { y += a * (buf[i] - y); buf[i] = y; } return buf; }
function hp(buf, cut, sr) { const a = Math.exp(-TAU * cut / sr); let y = 0, x0 = 0; for (let i = 0; i < buf.length; i++) { const x = buf[i]; y = a * (y + x - x0); x0 = x; buf[i] = y; } return buf; }
function bp(buf, f, q, sr) { const w = TAU * f / sr, al = Math.sin(w) / (2 * q), b0 = al, a0 = 1 + al, a1 = -2 * Math.cos(w), a2 = 1 - al; let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < buf.length; i++) { const x = buf[i], y = (b0 * x - b0 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; buf[i] = y; } return buf; }
const drive = (buf, g) => { for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * g); return buf; };
const saw = p => 2 * (p - Math.floor(p + 0.5));
const tri = p => 1 - 4 * Math.abs(p - Math.floor(p + 0.5));
const sqr = (p, d = 0.5) => (p - Math.floor(p)) < d ? 1 : -1;
function norm(buf, peak = 0.97) { let m = 1e-6; for (const v of buf) m = Math.max(m, Math.abs(v)); for (let i = 0; i < buf.length; i++) buf[i] *= peak / m; return buf; }
/* Karplus-Strong string: brightness 0..1, decay seconds, optional buzz (sitar bridge) */
function pluck(f, sr, secs, bright = 0.6, damp = 0.996, r, buzz = 0) {
    const n = Math.floor(sr * secs), out = new Float32Array(n), P = Math.max(2, Math.round(sr / f)), d = new Float32Array(P);
    for (let i = 0; i < P; i++) d[i] = (r() * 2 - 1);
    lp(d, 400 + bright * 6000, sr);
    let k = 0, prev = 0;
    for (let i = 0; i < n; i++) {
        const cur = d[k], nxt = d[(k + 1) % P];
        let v = damp * (cur * (0.5 + bright * 0.25) + nxt * (0.5 - bright * 0.25));
        if (buzz && v > 0.15) v = v - buzz * (v - 0.15) * 0.6;
        d[k] = v; out[i] = cur; prev = v; k = (k + 1) % P;
    }
    return out;
}
/* make a sustained instrument: render(len) -> Float32 signal at sr, loop the tail seamlessly by crossfading */
function looped(sr, attackSec, loopSec, P, render) {
    const loopN = Math.max(P, Math.round(loopSec * sr / P) * P), aN = Math.ceil(attackSec * sr / 16) * 16, xf = Math.min(loopN >> 1, 512);
    const sig = render(aN + loopN + xf);
    const out = new Float32Array(aN + loopN);
    for (let i = 0; i < aN + loopN; i++) out[i] = sig[i];
    for (let i = 0; i < xf; i++) { const t = i / xf; out[aN + i] = sig[aN + loopN + i] * (1 - t) + sig[aN + i] * t; }
    return { data: out, loop: aN };
}

/* ------------------------------------------------------------------ instrument bank
 * melodic: { name, group, base (MIDI note the sample is at), P (samples per period at base), make(sr, r) -> {data, loop} }
 * rate = mtof(base) * P, so the loop is a whole number of cycles and stays in tune. */
const MEL = {};
const def = (id, label, group, base, P, make, extra) => MEL[id] = Object.assign({ id, label, group, base, P, make }, extra || {});
def('piano', 'Piano', 'Keys', 60, 64, (sr, r) => { const f = mtof(60), n = sr * 1.4 | 0, o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; let v = 0; for (let h = 1; h <= 8; h++) v += Math.sin(TAU * f * h * t * (1 + 0.0004 * h * h)) * Math.exp(-t * (1.2 + h * 0.9)) / h; o[i] = v * Math.min(1, i / 40); } return { data: o, loop: -1 }; });
def('epiano', 'Electric piano (lofi)', 'Keys', 60, 64, (sr, r) => { const f = mtof(60), n = sr * 1.6 | 0, o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr, ia = 2.2 * Math.exp(-t * 3); o[i] = Math.sin(TAU * f * t + ia * Math.sin(TAU * f * t)) * Math.exp(-t * 1.6) * (1 + 0.25 * Math.sin(TAU * 5 * t)) + 0.15 * Math.sin(TAU * f * 14 * t) * Math.exp(-t * 30); } lp(o, 3500, sr); return { data: o, loop: -1 }; });
def('organ', 'Organ', 'Keys', 60, 64, (sr) => looped(sr, 0.03, 0.25, 64, n => { const f = mtof(60), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = (Math.sin(TAU * f * t) + 0.6 * Math.sin(TAU * f * 2 * t) + 0.4 * Math.sin(TAU * f * 3 * t) + 0.25 * Math.sin(TAU * f * 4 * t)) * Math.min(1, i / 60); } return o; }));
def('bell', 'Bell', 'Keys', 72, 32, (sr) => { const f = mtof(72), n = sr * 1.8 | 0, o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = Math.sin(TAU * f * t + 3 * Math.exp(-t * 2) * Math.sin(TAU * f * 3.5 * t)) * Math.exp(-t * 2.2); } return { data: o, loop: -1 }; });
def('musicbox', 'Music box', 'Keys', 72, 32, (sr) => { const f = mtof(72), n = sr * 1.2 | 0, o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 4.2 * t) * Math.exp(-t * 8)) * Math.exp(-t * 3.5); } return { data: o, loop: -1 }; });
def('dist_guitar', 'Distorted guitar (power chord)', 'Guitar', 40, 256, (sr) => looped(sr, 0.12, 0.3, 256, n => { const f = mtof(40), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = saw(f * t) + 0.8 * saw(f * 1.4983 * t + 0.3) + 0.6 * saw(f * 2 * t + 0.1); } drive(o, 6); lp(o, 2800, sr); hp(o, 90, sr); return o; }));
def('chug', 'Palm-muted chug', 'Guitar', 40, 256, (sr) => { const f = mtof(40), n = sr * 0.22 | 0, o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = (saw(f * t) + 0.8 * saw(f * 1.4983 * t)) * Math.exp(-t * 14); } drive(o, 9); lp(o, 1200, sr); return { data: o, loop: -1 }; });
def('lead_guitar', 'Lead guitar (screaming)', 'Guitar', 64, 64, (sr) => looped(sr, 0.06, 0.2, 64, n => { const f = mtof(64), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = saw(f * t) + 0.5 * sqr(f * t, 0.3); } drive(o, 8); lp(o, 4200, sr); hp(o, 200, sr); return o; }));
def('clean_guitar', 'Clean guitar', 'Guitar', 52, 128, (sr, r) => { const o = pluck(mtof(52), sr, 1.4, 0.55, 0.997, r); return { data: o, loop: -1 }; });
def('bass_finger', 'Bass guitar', 'Bass', 36, 256, (sr, r) => { const o = pluck(mtof(36), sr, 1.2, 0.3, 0.998, r); lp(o, 900, sr); return { data: o, loop: -1 }; });
def('bass_808', '808 bass (glide)', 'Bass', 36, 256, (sr) => { const f = mtof(36), n = sr * 1.6 | 0, o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr, ff = f * (1 + 0.9 * Math.exp(-t * 28)); ph += ff / sr; o[i] = Math.sin(TAU * ph) * Math.exp(-t * 1.1) * Math.min(1, i / 30); } drive(o, 2.2); return { data: o, loop: -1 }; });
def('synth_bass', 'Synth bass', 'Bass', 36, 256, (sr) => looped(sr, 0.05, 0.25, 256, n => { const f = mtof(36), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = saw(f * t) + saw(f * 1.006 * t); } lp(o, 700, sr); return o; }));
def('vapor_pad', 'Vapor pad', 'Synth', 60, 64, (sr) => looped(sr, 0.35, 0.6, 64, n => { const f = mtof(60), o = new Float32Array(n), D = [1, 1.004, 0.9965, 2.002, 0.5]; for (let i = 0; i < n; i++) { const t = i / sr; let v = 0; D.forEach((d, k) => v += saw(f * d * t + k * 0.21) * (k > 2 ? 0.5 : 1)); o[i] = v * Math.min(1, t / 0.3); } lp(o, 1800, sr); return o; }));
def('warm_pad', 'Warm pad', 'Synth', 60, 64, (sr) => looped(sr, 0.25, 0.5, 64, n => { const f = mtof(60), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = (tri(f * t) + tri(f * 1.003 * t + 0.4) + 0.4 * Math.sin(TAU * f * 2 * t)) * Math.min(1, t / 0.2); } lp(o, 1500, sr); return o; }));
def('air_choir', 'Airy choir', 'Synth', 60, 64, (sr, r) => looped(sr, 0.3, 0.6, 64, n => { const f = mtof(60), o = new Float32Array(n), a = new Float32Array(n), b = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr, v = saw(f * t) + saw(f * 1.005 * t) + 0.3 * (r() * 2 - 1); a[i] = v; b[i] = v; } bp(a, 700, 4, sr); bp(b, 1150, 5, sr); for (let i = 0; i < n; i++) o[i] = (a[i] + 0.7 * b[i]) * Math.min(1, i / sr / 0.25); return o; }));
def('supersaw', 'Supersaw lead', 'Synth', 60, 64, (sr) => looped(sr, 0.03, 0.4, 64, n => { const f = mtof(60), o = new Float32Array(n), D = [1, 1.006, 0.994, 1.012, 0.988]; for (let i = 0; i < n; i++) { const t = i / sr; let v = 0; D.forEach((d, k) => v += saw(f * d * t + k * 0.13)); o[i] = v; } lp(o, 5000, sr); return o; }));
def('pluck_synth', 'Synth pluck', 'Synth', 60, 64, (sr) => { const f = mtof(60), n = sr * 0.7 | 0, o = new Float32Array(n), b = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; b[i] = saw(f * t) + 0.5 * sqr(f * 2 * t); } let y = 0; for (let i = 0; i < n; i++) { const t = i / sr, a = 1 - Math.exp(-TAU * (300 + 5000 * Math.exp(-t * 12)) / sr); y += a * (b[i] - y); o[i] = y * Math.exp(-t * 4); } return { data: o, loop: -1 }; });
def('strings', 'Strings', 'Orchestra', 60, 64, (sr, r) => looped(sr, 0.25, 0.5, 64, n => { const f = mtof(60), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = (saw(f * t) + saw(f * 1.003 * t + 0.5) + saw(f * 0.997 * t + 0.2)) * Math.min(1, t / 0.2); } lp(o, 2600, sr); return o; }));
def('brass', 'Brass', 'Orchestra', 60, 64, (sr) => looped(sr, 0.08, 0.3, 64, n => { const f = mtof(60), o = new Float32Array(n), b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = saw(f * i / sr); let y = 0; for (let i = 0; i < n; i++) { const t = i / sr, a = 1 - Math.exp(-TAU * (600 + 2200 * Math.min(1, t / 0.08)) / sr); y += a * (b[i] - y); o[i] = y; } return o; }));
/* world instruments */
def('koto', 'Koto (Japan)', 'World', 60, 64, (sr, r) => { const o = pluck(mtof(60), sr, 1.5, 0.85, 0.9965, r); for (let i = 0; i < o.length; i++) o[i] *= 1 + 0.4 * Math.exp(-i / sr * 20); return { data: o, loop: -1 }; });
def('shamisen', 'Shamisen (Japan)', 'World', 60, 64, (sr, r) => { const o = pluck(mtof(60), sr, 0.8, 0.95, 0.993, r, 0.4); return { data: o, loop: -1 }; });
def('sitar', 'Sitar (India)', 'World', 60, 64, (sr, r) => { const o = pluck(mtof(60), sr, 1.8, 0.9, 0.9975, r, 0.9); hp(o, 150, sr); return { data: o, loop: -1 }; });
def('tanpura', 'Tanpura drone (India)', 'World', 48, 128, (sr, r) => looped(sr, 0.2, 0.8, 128, n => { const f = mtof(48), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; let v = 0; for (let h = 1; h < 14; h++) v += Math.sin(TAU * f * h * t + h) * (1 + 0.5 * Math.sin(TAU * 0.7 * t * h / 3)) / h; o[i] = v * Math.min(1, t / 0.15); } return o; }));
def('oud', 'Oud (Middle East)', 'World', 52, 128, (sr, r) => { const o = pluck(mtof(52), sr, 1.2, 0.5, 0.9955, r); lp(o, 2600, sr); return { data: o, loop: -1 }; });
def('kora', 'Kora (West Africa)', 'World', 60, 64, (sr, r) => { const o = pluck(mtof(60), sr, 1.5, 0.7, 0.9975, r); return { data: o, loop: -1 }; });
def('kalimba', 'Kalimba / mbira (Southern Africa)', 'World', 72, 32, (sr) => { const f = mtof(72), n = sr * 1.0 | 0, o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = (Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 25) + 0.15 * Math.sin(TAU * f * 2.98 * t)) * Math.exp(-t * 4); } return { data: o, loop: -1 }; });
def('balafon', 'Balafon / marimba', 'World', 60, 64, (sr, r) => { const f = mtof(60), n = sr * 0.8 | 0, o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * f * 3.9 * t) * Math.exp(-t * 18) + 0.08 * (r() * 2 - 1) * Math.exp(-t * 60)) * Math.exp(-t * 5.5); } return { data: o, loop: -1 }; });
def('steel_pan', 'Steel pan (Caribbean)', 'World', 64, 64, (sr) => { const f = mtof(64), n = sr * 1.3 | 0, o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = (Math.sin(TAU * f * t) + 0.6 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 3) + 0.4 * Math.sin(TAU * f * 3.01 * t) * Math.exp(-t * 5) + 0.3 * Math.sin(TAU * f * 4.2 * t) * Math.exp(-t * 9)) * Math.exp(-t * 2.4) * Math.min(1, i / 25); } return { data: o, loop: -1 }; });
def('pan_flute', 'Pan flute (Andes)', 'World', 72, 32, (sr, r) => looped(sr, 0.08, 0.4, 32, n => { const f = mtof(72), o = new Float32Array(n), ns = new Float32Array(n); for (let i = 0; i < n; i++) ns[i] = r() * 2 - 1; bp(ns, f, 6, sr); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = (Math.sin(TAU * f * t) + 0.15 * Math.sin(TAU * f * 2 * t) + 1.2 * ns[i]) * Math.min(1, t / 0.06); } return o; }));
def('shakuhachi', 'Shakuhachi (Japan)', 'World', 67, 64, (sr, r) => looped(sr, 0.15, 0.4, 64, n => { const f = mtof(67), o = new Float32Array(n), ns = new Float32Array(n); for (let i = 0; i < n; i++) ns[i] = r() * 2 - 1; bp(ns, f * 2, 3, sr); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * f * 3 * t) + 1.6 * ns[i]) * Math.min(1, t / 0.12); } return o; }));
def('bagpipe', 'Bagpipe (Scotland / Ireland)', 'World', 69, 64, (sr) => looped(sr, 0.05, 0.25, 64, n => { const f = mtof(69), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = sqr(f * t, 0.2) + 0.5 * saw(f * t) + 0.35 * saw(f / 4 * t); } bp(o, 1400, 0.8, sr); return o; }));
def('fiddle', 'Fiddle (Celtic / country)', 'World', 67, 64, (sr) => looped(sr, 0.06, 0.3, 64, n => { const f = mtof(67), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = saw(f * t) * Math.min(1, t / 0.05); } bp(o, 2500, 0.7, sr); lp(o, 5000, sr); return o; }));
def('accordion', 'Accordion (Mexico / Europe)', 'World', 60, 64, (sr) => looped(sr, 0.04, 0.4, 64, n => { const f = mtof(60), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = sqr(f * t, 0.35) + sqr(f * 1.008 * t, 0.35) + 0.4 * sqr(f * 2 * t, 0.3); } lp(o, 3000, sr); return o; }));
def('erhu', 'Erhu (China)', 'World', 67, 64, (sr) => looped(sr, 0.08, 0.3, 64, n => { const f = mtof(67), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = saw(f * t) * Math.min(1, t / 0.07); } bp(o, 1100, 1.2, sr); bp(o, 1100, 0.7, sr); return o; }));
def('guzheng', 'Guzheng (China)', 'World', 60, 64, (sr, r) => { const o = pluck(mtof(60), sr, 1.6, 0.75, 0.9972, r); return { data: o, loop: -1 }; });
def('gamelan', 'Gamelan metallophone (Indonesia)', 'World', 60, 64, (sr) => { const f = mtof(60), n = sr * 2 | 0, o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 2) + 0.3 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 4) + 0.2 * Math.sin(TAU * f * 1.007 * t)) * Math.exp(-t * 1.2); } return { data: o, loop: -1 }; });
def('balalaika', 'Balalaika (Russia)', 'World', 64, 64, (sr, r) => { const n = sr * 0.9 | 0, o = new Float32Array(n), p = pluck(mtof(64), sr, 0.9, 0.8, 0.995, r); for (let i = 0; i < n; i++) o[i] = p[i] * (0.6 + 0.4 * Math.abs(Math.sin(TAU * 7 * i / sr))); return { data: o, loop: -1 }; });
def('cavaquinho', 'Cavaquinho (Brazil)', 'World', 67, 64, (sr, r) => { const o = pluck(mtof(67), sr, 0.8, 0.9, 0.994, r); return { data: o, loop: -1 }; });

/* drum kits: list of [name, make(sr, r)] played at their own rate; a kit track's note value picks the sound */
const KIT = {};
const noiseBuf = (n, r) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = r() * 2 - 1; return o; };
const kick = (f0, f1, dec, click, dist) => (sr, r) => { const n = sr * dec * 2.5 | 0, o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr, f = f1 + (f0 - f1) * Math.exp(-t * 35); ph += f / sr; o[i] = Math.sin(TAU * ph) * Math.exp(-t / dec) + click * (r() * 2 - 1) * Math.exp(-t * 400); } if (dist) drive(o, dist); return o; };
const snare = (tone, nz, dec, cut) => (sr, r) => { const n = sr * dec * 3 | 0, o = new Float32Array(n), z = noiseBuf(n, r); hp(z, cut, sr); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = tone * Math.sin(TAU * 190 * t) * Math.exp(-t * 30) + nz * z[i] * Math.exp(-t / dec); } return o; };
const hat = (dec, cut) => (sr, r) => { const n = sr * dec * 3 + 8 | 0, o = noiseBuf(n, r); hp(o, cut, sr); for (let i = 0; i < n; i++) o[i] *= Math.exp(-i / sr / dec); return o; };
const tom = (f, dec) => (sr) => { const n = sr * dec * 3 | 0, o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr; ph += f * (1 + 0.5 * Math.exp(-t * 20)) / sr; o[i] = Math.sin(TAU * ph) * Math.exp(-t / dec); } return o; };
const clap = (sr, r) => { const n = sr * 0.35 | 0, o = noiseBuf(n, r); bp(o, 1200, 1.5, sr); for (let i = 0; i < n; i++) { const t = i / sr, e = t < 0.03 ? (0.6 + 0.4 * Math.cos(TAU * t / 0.01)) : Math.exp(-(t - 0.03) * 14); o[i] *= e; } return o; };
const block = (f, dec, ns) => (sr, r) => { const n = sr * dec * 4 | 0, o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = (Math.sin(TAU * f * t) + (ns || 0) * (r() * 2 - 1)) * Math.exp(-t / dec); } return o; };
const drumhead = (f, dec, slap) => (sr, r) => { const n = sr * dec * 3 | 0, o = new Float32Array(n), z = noiseBuf(n, r); bp(z, f * 4, 2, sr); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = Math.sin(TAU * f * t * (1 + 0.15 * Math.exp(-t * 30))) * Math.exp(-t / dec) + slap * z[i] * Math.exp(-t * 40); } return o; };
const shaker = (dec) => (sr, r) => { const n = sr * dec * 3 | 0, o = noiseBuf(n, r); hp(o, 5000, sr); for (let i = 0; i < n; i++) { const t = i / sr; o[i] *= Math.min(1, t / 0.01) * Math.exp(-t / dec); } return o; };
const cymbal = (dec, rev) => (sr, r) => { const n = sr * dec * 2 | 0, o = noiseBuf(n, r); hp(o, 3500, sr); for (let i = 0; i < n; i++) o[i] *= rev ? Math.pow(i / n, 2) : Math.exp(-i / sr / dec * 1.3); return o; };
const crackle = (sr, r) => { const n = sr * 1.0 | 0, o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = (r() < 0.004 ? (r() * 2 - 1) : 0) + 0.05 * (r() * 2 - 1); lp(o, 4000, sr); return o; };
const gong = (sr) => { const n = sr * 2.4 | 0, o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = (Math.sin(TAU * 98 * t) + 0.6 * Math.sin(TAU * 98 * 1.47 * t) + 0.4 * Math.sin(TAU * 98 * 2.09 * t + Math.sin(TAU * 3 * t))) * Math.exp(-t * 0.9) * Math.min(1, t / 0.02); } return o; };
const bell2 = (f, dec) => (sr) => { const n = sr * dec * 3 | 0, o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; o[i] = (Math.sin(TAU * f * t) + 0.6 * Math.sin(TAU * f * 1.48 * t)) * Math.exp(-t / dec); } return o; };
const kdef = (id, label, list) => KIT[id] = { id, label, group: 'Drums', sounds: list.map(([name, make]) => ({ name, make })) };
kdef('kit_rock', 'Rock / metal kit', [['kick', kick(160, 50, 0.12, 0.6, 1.5)], ['snare', snare(0.7, 1, 0.12, 1500)], ['hat', hat(0.03, 7000)], ['open hat', hat(0.25, 6000)], ['crash', cymbal(1.0)], ['tom hi', tom(200, 0.18)], ['tom lo', tom(110, 0.25)], ['ride', bell2(3200, 0.3)]]);
kdef('kit_trap', '808 / trap kit', [['808 kick', kick(140, 45, 0.25, 0.3, 1.8)], ['clap', clap], ['snare', snare(0.5, 1, 0.09, 2500)], ['hat', hat(0.018, 8000)], ['open hat', hat(0.18, 7000)], ['rim', block(1700, 0.02, 0.2)], ['snap', block(2500, 0.012, 1)], ['reverse cymbal', cymbal(0.9, true)]]);
kdef('kit_lofi', 'Lofi dusty kit', [['dusty kick', (sr, r) => lp(kick(110, 48, 0.16, 0.1, 1.2)(sr, r), 1500, sr)], ['soft snare', (sr, r) => lp(snare(0.4, 0.8, 0.1, 900)(sr, r), 3500, sr)], ['shaker', shaker(0.05)], ['rim', block(1500, 0.025, 0.1)], ['vinyl crackle', crackle], ['tape hat', (sr, r) => lp(hat(0.04, 5000)(sr, r), 6000, sr)]]);
kdef('kit_tabla', 'Tabla (India)', [['dha', (sr, r) => { const a = drumhead(90, 0.35, 0.2)(sr, r), b = bell2(520, 0.25)(sr); for (let i = 0; i < Math.min(a.length, b.length); i++) a[i] += 0.6 * b[i]; return a; }], ['na', bell2(560, 0.18)], ['tin', bell2(700, 0.12)], ['ge', (sr) => { const n = sr * 0.6 | 0, o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr; ph += (80 + 40 * Math.min(1, t * 4)) / sr; o[i] = Math.sin(TAU * ph) * Math.exp(-t * 4); } return o; }], ['ke', block(300, 0.02, 0.8)]]);
kdef('kit_djembe', 'Djembe (West Africa)', [['bass', drumhead(75, 0.2, 0.1)], ['tone', drumhead(210, 0.12, 0.3)], ['slap', drumhead(330, 0.06, 1.2)], ['shekere', shaker(0.08)], ['bell', bell2(900, 0.15)]]);
kdef('kit_darbuka', 'Darbuka + riq (Middle East)', [['doum', drumhead(95, 0.22, 0.15)], ['tek', block(900, 0.03, 0.6)], ['ka', block(650, 0.025, 0.7)], ['riq jingle', shaker(0.12)]]);
kdef('kit_taiko', 'Taiko (Japan)', [['don', drumhead(60, 0.5, 0.2)], ['ka (rim)', block(1200, 0.02, 0.5)], ['shime', drumhead(320, 0.08, 0.6)], ['kane bell', bell2(2100, 0.2)]]);
kdef('kit_latin', 'Latin percussion', [['conga hi', drumhead(330, 0.12, 0.3)], ['conga lo', drumhead(220, 0.15, 0.25)], ['bongo', drumhead(480, 0.07, 0.4)], ['clave', block(2500, 0.03)], ['guiro', (sr, r) => { const n = sr * 0.25 | 0, o = noiseBuf(n, r); bp(o, 3000, 2, sr); for (let i = 0; i < n; i++) o[i] *= (i % 300 < 120 ? 1 : 0.2) * Math.exp(-i / n * 2); return o; }], ['cowbell', bell2(800, 0.12)], ['timbale', drumhead(600, 0.15, 0.5)], ['shaker', shaker(0.06)]]);
kdef('kit_gamelan', 'Gamelan gongs (Indonesia)', [['gong', gong], ['kempul', bell2(196, 0.8)], ['kenong', bell2(392, 0.5)], ['kendang', drumhead(140, 0.15, 0.4)]]);
kdef('kit_world_hand', 'Hand percussion', [['frame drum', drumhead(110, 0.25, 0.3)], ['woodblock', block(1100, 0.03)], ['triangle', bell2(4200, 0.5)], ['shaker', shaker(0.06)], ['tambourine', shaker(0.15)]]);

/* the four classic DS chip voices (PSG) */
const PSG = { sq50: { id: 'sq50', label: 'Chip square', group: 'Chip (DS sound chip)', psg: 0 }, sq25: { id: 'sq25', label: 'Chip square thin', group: 'Chip (DS sound chip)', psg: 1 }, sq12: { id: 'sq12', label: 'Chip square buzzy', group: 'Chip (DS sound chip)', psg: 2 }, noise: { id: 'noise', label: 'Chip noise drums', group: 'Chip (DS sound chip)', psg: 3, drums: ['', 'kick', 'snare', 'hat'] } };
M.instruments = () => [...Object.values(PSG), ...Object.values(MEL), ...Object.values(KIT).map(k => Object.assign({}, k, { drums: ['', ...k.sounds.map(s => s.name)] }))];
M.info = id => PSG[id] || MEL[id] || (KIT[id] && Object.assign({}, KIT[id], { drums: ['', ...KIT[id].sounds.map(s => s.name)] })) || PSG.sq50;
M.isKit = id => !!KIT[id] || id === 'noise';

/* render an instrument to float samples (cached). returns { kind:'mel', rate, base, data, loop } or { kind:'kit', sounds:[{rate,data}] } */
const cache = {};
M.render = id => {
    if (cache[id]) return cache[id];
    let out = null;
    if (MEL[id]) { const d = MEL[id], rate = Math.round(mtof(d.base) * d.P), r = rng(id.length * 7919 + 13), s = d.make(rate, r); norm(s.data, 0.95); out = { kind: 'mel', rate, base: d.base, data: s.data, loop: s.loop }; }
    else if (KIT[id]) { const r = rng(id.length * 104729 + 7); out = { kind: 'kit', sounds: KIT[id].sounds.map(s => ({ name: s.name, rate: DR, data: norm(s.make(DR, r), 0.95) })) }; }
    return cache[id] = out;
};
/* render at a chosen sample rate (SNES): melodic -> P samples per cycle at the base note; kits -> given rate; chip voices -> one cycle */
M.renderAt = (id, P, kitRate, maxSec) => {
    const cut = (d, loop) => { if (loop < 0 && maxSec && d.length > 0) { const n = Math.min(d.length, Math.floor(maxSec * (d.rate || 1))); } return d; };
    if (PSG[id]) {
        const ps = PSG[id].psg;
        if (ps === 3) { const r = rng(5), mk = [(sr) => { const n = sr * 0.12 | 0, o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { ph += (120 * Math.exp(-i / sr * 30) + 50) / sr; o[i] = Math.sin(TAU * ph) * Math.exp(-i / sr * 18); } return o; }, (sr) => { const n = sr * 0.1 | 0, o = noiseBuf(n, r); for (let i = 0; i < n; i++) o[i] *= Math.exp(-i / sr * 25); return o; }, (sr) => { const n = sr * 0.04 | 0, o = noiseBuf(n, r); hp(o, 4000, sr); for (let i = 0; i < n; i++) o[i] *= Math.exp(-i / sr * 70); return o; }];
            return { kind: 'kit', sounds: mk.map((f, i) => ({ name: ['kick', 'snare', 'hat'][i], rate: kitRate, data: norm(f(kitRate), 0.95) })) }; }
        const duty = [0.5, 0.25, 0.125][ps], o = new Float32Array(P * 4); for (let i = 0; i < o.length; i++) o[i] = ((i % P) / P) < duty ? 0.8 : -0.8;
        return { kind: 'mel', base: 60, rate: mtof(60) * P, data: o, loop: 0 };
    }
    if (MEL[id]) {
        const d = MEL[id], rate = mtof(d.base) * P, s = d.make(rate, rng(id.length * 7919 + 13));
        let data = s.data;
        if (s.loop < 0 && maxSec && data.length > rate * maxSec) { const n = Math.floor(rate * maxSec), f = Math.floor(n * 0.2); data = data.slice(0, n); for (let i = 0; i < f; i++) data[n - 1 - i] *= i / f; }
        if (s.loop >= 0 && maxSec && s.loop > rate * maxSec) { /* long attack: keep it */ }
        norm(data, 0.95);
        return { kind: 'mel', base: d.base, rate, data, loop: s.loop };
    }
    if (KIT[id]) { const r = rng(id.length * 104729 + 7); return { kind: 'kit', sounds: KIT[id].sounds.map(s => { let d = s.make(kitRate, r); if (maxSec && d.length > kitRate * maxSec) { const n = Math.floor(kitRate * maxSec), f = Math.floor(n * 0.3); d = d.slice(0, n); for (let i = 0; i < f; i++) d[n - 1 - i] *= i / f; } return { name: s.name, rate: kitRate, data: norm(d, 0.95) }; }) }; }
    return null;
};
/* signed 8-bit for the DS: length padded to 4 bytes, loop start rounded to 16 bytes (ARM7 mailbox stores loop/16) */
M.toPCM8 = (data, loop) => {
    let ls = loop >= 0 ? Math.floor(loop / 16) * 16 : -1;
    const n = (data.length + 3) & ~3, pcm = new Int8Array(n);
    for (let i = 0; i < data.length; i++) pcm[i] = Math.max(-127, Math.min(127, Math.round(data[i] * 120)));
    return { pcm, loop: ls };
};

/* ------------------------------------------------------------------ the composer */
const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11], hijaz: [0, 1, 4, 5, 7, 8, 10], insen: [0, 1, 5, 7, 10], yo: [0, 2, 5, 7, 9], pentmaj: [0, 2, 4, 7, 9], pentmin: [0, 3, 5, 7, 10],
    yaman: [0, 2, 4, 6, 7, 9, 11], bhairav: [0, 1, 4, 5, 7, 8, 11], slendro: [0, 2, 5, 7, 9], blues: [0, 3, 5, 6, 7, 10], gypsy: [0, 1, 4, 5, 7, 8, 11]
};
/* style recipes. grid = steps per bar; tempo in BPM; prog = chord roots as scale degrees (0-based) per bar; parts: role -> instrument */
const STYLES = {
    metal_gallop: { label: 'Heavy metal: Iron Overdrive', family: 'Heavy metal', bpm: 168, key: 40, scale: 'minor', grid: 16, prog: [0, 0, 5, 6, 0, 0, 3, 4], parts: { riff: 'chug', power: 'dist_guitar', lead: 'lead_guitar', bass: 'bass_finger', kick: 'kit_rock', top: 'kit_rock' }, drums: 'double_kick', riff: 'gallop', lead: 'shred' },
    metal_doom: { label: 'Heavy metal: Doom Hall', family: 'Heavy metal', bpm: 72, key: 38, scale: 'phrygian', grid: 16, prog: [0, 0, 1, 0, 5, 4, 1, 0], parts: { power: 'dist_guitar', lead: 'lead_guitar', bass: 'bass_finger', pad: 'organ', kick: 'kit_rock', top: 'kit_rock' }, drums: 'doom', riff: 'doom', lead: 'wail' },
    metal_thrash: { label: 'Heavy metal: Thrash Sprint', family: 'Heavy metal', bpm: 200, key: 40, scale: 'harmonic', grid: 16, prog: [0, 1, 0, 6, 0, 1, 4, 4], parts: { riff: 'chug', power: 'dist_guitar', lead: 'lead_guitar', bass: 'bass_finger', kick: 'kit_rock', top: 'kit_rock' }, drums: 'thrash', riff: 'tremolo', lead: 'shred' },
    vapor_mall: { label: 'Lofi vaporwave: Mall After Hours', family: 'Lofi / vaporwave', bpm: 78, key: 53, scale: 'major', grid: 16, swing: 0.18, prog: [1, 4, 0, 5, 1, 4, 2, 5], seventh: true, parts: { chord: 'epiano', chord2: 'epiano', chord3: 'epiano', lead: 'bell', bass: 'bass_finger', kick: 'kit_lofi', top: 'kit_lofi', tex: 'kit_lofi' }, drums: 'lofi', lead: 'lazy' },
    vapor_sunset: { label: 'Lofi vaporwave: Pastel Sunset 1995', family: 'Lofi / vaporwave', bpm: 84, key: 56, scale: 'major', grid: 16, swing: 0.1, prog: [3, 4, 2, 5, 3, 4, 0, 0], seventh: true, parts: { chord: 'vapor_pad', chord2: 'vapor_pad', chord3: 'vapor_pad', lead: 'supersaw', bass: 'synth_bass', kick: 'kit_lofi', top: 'kit_trap', tex: 'kit_lofi' }, drums: 'vapor', lead: 'lazy' },
    vapor_rain: { label: 'Lofi vaporwave: Rainy Window Study', family: 'Lofi / vaporwave', bpm: 70, key: 50, scale: 'dorian', grid: 16, swing: 0.22, prog: [0, 3, 0, 3, 5, 4, 0, 4], seventh: true, parts: { chord: 'epiano', chord2: 'epiano', chord3: 'warm_pad', lead: 'clean_guitar', bass: 'bass_finger', kick: 'kit_lofi', top: 'kit_lofi', tex: 'kit_lofi' }, drums: 'lofi', lead: 'lazy' },
    cloud_purple: { label: '90s cloud rap: Purple Fog', family: '90s experimental cloud rap', bpm: 66, key: 49, scale: 'minor', grid: 24, prog: [0, 0, 5, 5, 3, 3, 4, 4], seventh: true, parts: { chord: 'air_choir', chord2: 'air_choir', lead: 'bell', bass: 'bass_808', kick: 'kit_trap', top: 'kit_trap', snare: 'kit_trap', tex: 'kit_lofi' }, drums: 'cloud', lead: 'sparse' },
    cloud_screw: { label: '90s cloud rap: Slowed Down South', family: '90s experimental cloud rap', bpm: 60, key: 46, scale: 'pentmin', grid: 24, prog: [0, 0, 3, 3, 4, 4, 3, 2], parts: { chord: 'organ', lead: 'epiano', bass: 'bass_808', kick: 'kit_trap', top: 'kit_trap', snare: 'kit_trap', tex: 'kit_lofi' }, drums: 'screw', lead: 'sparse' },
    cloud_static: { label: '90s cloud rap: Haze Static (experimental)', family: '90s experimental cloud rap', bpm: 70, key: 51, scale: 'phrygian', grid: 24, prog: [0, 1, 0, 5, 0, 1, 6, 5], seventh: true, parts: { chord: 'vapor_pad', chord2: 'air_choir', lead: 'musicbox', bass: 'bass_808', kick: 'kit_trap', top: 'kit_trap', snare: 'kit_trap', tex: 'kit_trap' }, drums: 'cloud_broken', lead: 'glitch' },
    world_japan: { label: 'Japan: Cherry Blossom Gate', family: 'World', region: 'Japan', bpm: 96, key: 62, scale: 'insen', grid: 16, prog: [0, 0, 3, 2, 0, 0, 4, 0], parts: { lead: 'koto', lead2: 'shakuhachi', pad: 'shamisen', bass: 'koto', kick: 'kit_taiko', top: 'kit_taiko' }, drums: 'taiko', lead: 'pent' },
    world_india: { label: 'India: Monsoon Raga', family: 'World', region: 'India', bpm: 100, key: 61, scale: 'yaman', grid: 16, prog: [0, 0, 0, 0, 4, 4, 0, 0], parts: { lead: 'sitar', drone: 'tanpura', drone2: 'tanpura', kick: 'kit_tabla', top: 'kit_tabla' }, drums: 'teental', lead: 'raga' },
    world_mideast: { label: 'Middle East: Desert Caravan', family: 'World', region: 'Middle East / North Africa', bpm: 108, key: 62, scale: 'hijaz', grid: 16, prog: [0, 0, 6, 0, 3, 3, 1, 0], parts: { lead: 'oud', lead2: 'fiddle', bass: 'oud', drone: 'tanpura', kick: 'kit_darbuka', top: 'kit_darbuka' }, drums: 'maqsum', lead: 'maqam' },
    world_westafrica: { label: 'West Africa: Kora Sunrise', family: 'World', region: 'West Africa', bpm: 116, key: 60, scale: 'major', grid: 12, prog: [0, 4, 3, 4, 0, 4, 3, 0], parts: { lead: 'kora', arp: 'kora', lead2: 'balafon', bass: 'bass_finger', kick: 'kit_djembe', top: 'kit_djembe' }, drums: 'djembe12', lead: 'kora' },
    world_southafrica: { label: 'Southern Africa: Mbira Circle', family: 'World', region: 'Southern Africa', bpm: 104, key: 62, scale: 'mixolydian', grid: 12, prog: [0, 3, 4, 0, 0, 3, 4, 3], parts: { lead: 'kalimba', arp: 'kalimba', bass: 'balafon', kick: 'kit_world_hand', top: 'kit_world_hand' }, drums: 'shaker12', lead: 'kora' },
    world_caribbean: { label: 'Caribbean: Steel Pan Harbour', family: 'World', region: 'Caribbean', bpm: 120, key: 60, scale: 'major', grid: 16, prog: [0, 3, 4, 0, 0, 3, 4, 4], parts: { lead: 'steel_pan', arp: 'steel_pan', bass: 'bass_finger', kick: 'kit_latin', top: 'kit_latin' }, drums: 'soca', lead: 'bouncy' },
    world_reggae: { label: 'Jamaica: One Drop Sunday', family: 'World', region: 'Jamaica', bpm: 76, key: 55, scale: 'major', grid: 16, prog: [0, 0, 3, 3, 4, 4, 3, 0], parts: { skank: 'organ', skank2: 'clean_guitar', lead: 'brass', bass: 'bass_finger', kick: 'kit_rock', top: 'kit_rock' }, drums: 'onedrop', lead: 'bouncy' },
    world_latin: { label: 'Latin America: Salsa Night', family: 'World', region: 'Latin America', bpm: 180, key: 57, scale: 'minor', grid: 16, prog: [0, 3, 4, 0, 0, 3, 4, 4], parts: { montuno: 'piano', lead: 'brass', bass: 'bass_finger', kick: 'kit_latin', top: 'kit_latin', perc: 'kit_latin' }, drums: 'clave', lead: 'bouncy' },
    world_andes: { label: 'Andes: Condor Pass', family: 'World', region: 'Andes', bpm: 112, key: 62, scale: 'pentmin', grid: 16, prog: [0, 0, 2, 4, 0, 0, 2, 0], parts: { lead: 'pan_flute', arp: 'cavaquinho', bass: 'bass_finger', kick: 'kit_world_hand', top: 'kit_world_hand' }, drums: 'huayno', lead: 'pent' },
    world_mexico: { label: 'Mexico: Norteño Road Trip', family: 'World', region: 'Mexico', bpm: 132, key: 60, scale: 'major', grid: 16, prog: [0, 0, 4, 4, 4, 4, 0, 0], parts: { lead: 'accordion', oompah: 'clean_guitar', bass: 'bass_finger', kick: 'kit_rock', top: 'kit_rock' }, drums: 'polka', lead: 'bouncy' },
    world_celtic: { label: 'Celtic: Highland Jig', family: 'World', region: 'Ireland / Scotland', bpm: 116, key: 62, scale: 'mixolydian', grid: 12, prog: [0, 0, 6, 6, 0, 0, 4, 0], parts: { lead: 'fiddle', lead2: 'bagpipe', drone: 'bagpipe', bass: 'bass_finger', kick: 'kit_world_hand', top: 'kit_world_hand' }, drums: 'jig', lead: 'jig' },
    world_china: { label: 'China: Jade Mountain', family: 'World', region: 'China', bpm: 88, key: 62, scale: 'pentmaj', grid: 16, prog: [0, 0, 4, 3, 0, 0, 4, 0], parts: { lead: 'erhu', arp: 'guzheng', bass: 'guzheng', kick: 'kit_world_hand', top: 'kit_gamelan' }, drums: 'chinese', lead: 'pent' },
    world_indonesia: { label: 'Indonesia: Gamelan Moon', family: 'World', region: 'Indonesia', bpm: 92, key: 60, scale: 'slendro', grid: 16, prog: [0, 0, 0, 0, 2, 2, 0, 0], parts: { lead: 'gamelan', arp: 'gamelan', bass: 'gamelan', kick: 'kit_gamelan', top: 'kit_gamelan' }, drums: 'gamelan', lead: 'pent' },
    world_brazil: { label: 'Brazil: Samba Street', family: 'World', region: 'Brazil', bpm: 100, key: 57, scale: 'major', grid: 16, prog: [1, 4, 0, 0, 1, 4, 0, 5], seventh: true, parts: { lead: 'cavaquinho', arp: 'clean_guitar', bass: 'bass_finger', kick: 'kit_latin', top: 'kit_latin', perc: 'kit_world_hand' }, drums: 'samba', lead: 'bouncy' },
    world_russia: { label: 'Russia: Winter Troika', family: 'World', region: 'Russia / Eastern Europe', bpm: 140, key: 57, scale: 'harmonic', grid: 16, prog: [0, 3, 4, 0, 0, 3, 4, 4], parts: { lead: 'balalaika', lead2: 'accordion', bass: 'bass_finger', kick: 'kit_rock', top: 'kit_world_hand' }, drums: 'polka', lead: 'bouncy' },
    world_balkan: { label: 'Balkans: Gypsy Brass Wedding', family: 'World', region: 'Balkans', bpm: 150, key: 57, scale: 'gypsy', grid: 16, prog: [0, 0, 1, 1, 0, 0, 6, 0], parts: { lead: 'brass', lead2: 'accordion', bass: 'brass', kick: 'kit_rock', top: 'kit_world_hand' }, drums: 'polka', lead: 'maqam' },
    chip_adventure: { label: 'Chiptune: Pocket Adventure', family: 'Classic chip', bpm: 132, key: 60, scale: 'major', grid: 16, prog: [0, 5, 3, 4, 0, 5, 3, 4], parts: { lead: 'sq25', arp: 'sq12', bass: 'sq50', kick: 'noise' }, drums: 'chip', lead: 'bouncy' },
    orchestral_epic: { label: 'Orchestral: Final Boss', family: 'Cinematic', bpm: 140, key: 50, scale: 'harmonic', grid: 16, prog: [0, 5, 3, 4, 0, 5, 1, 4], parts: { chord: 'strings', chord2: 'strings', lead: 'brass', bass: 'strings', kick: 'kit_taiko', top: 'kit_rock' }, drums: 'epic', lead: 'heroic' },
};
M.styles = () => Object.entries(STYLES).map(([id, s]) => ({ id, label: s.label, family: s.family, region: s.region || '', bpm: s.bpm }));

/* drum patterns, written per bar as strings over the grid: each line = [kit role, sound number, pattern] (x = hit, . = rest) */
const DRUMS = {
    double_kick: [['kick', 1, 'xxxxxxxxxxxxxxxx'], ['top', 2, '....x.......x...'], ['top', 3, 'x.x.x.x.x.x.x.x.']],
    doom: [['kick', 1, 'x.......x.x.....'], ['top', 2, '........x.......'], ['top', 8, 'x...x...x...x...']],
    thrash: [['kick', 1, 'x.x.x.x.x.x.x.x.'], ['top', 2, '..x...x...x...x.'], ['top', 3, 'xxxxxxxxxxxxxxxx']],
    lofi: [['kick', 1, 'x.....x...x.....'], ['top', 2, '....x.......x...'], ['top', 3, '..x...x...x...x.'], ['tex', 5, 'x...x...x...x...']],
    vapor: [['kick', 1, 'x.......x.x.....'], ['top', 2, '....x.......x...'], ['top', 4, 'x.x.x.x.x.x.x.x.'], ['tex', 5, 'x...............']],
    cloud: [['kick', 1, 'x...........x.........x.................'.slice(0, 24)], ['snare', 2, '............x...........'], ['top', 4, 'x.x.x.x.x.x.x.x.x.xxx.x.'], ['tex', 5, 'x.......................']],
    screw: [['kick', 1, 'x.....x...........x.....'], ['snare', 2, '............x...........'], ['top', 4, 'x...x...x...x...x...xxxx'], ['tex', 5, 'x.......................']],
    cloud_broken: [['kick', 1, 'x........x.......x......'], ['snare', 3, '............x.........x.'], ['top', 4, 'x.xx..x.x.xxx...x.x.xxxx'], ['top', 8, '....................x...']],
    taiko: [['kick', 1, 'x.......x.x.....'], ['top', 2, '....x.......x.x.'], ['top', 3, 'x.x.x.x.x.x.x.x.']],
    teental: [['kick', 1, 'x...x...x.......'], ['top', 2, '..x...x...x.x.x.'], ['top', 3, '.x...x...x...x..']],
    maqsum: [['kick', 1, 'x.....x.........'], ['top', 2, '...x....x..x....'], ['top', 3, '..x.x.x...x.x.x.']],
    djembe12: [['kick', 1, 'x.....x.....'], ['top', 2, '..x.x...x.x.'], ['top', 3, '...x.....x..']],
    shaker12: [['kick', 1, 'x.....x.....'], ['top', 4, 'x.xx.xx.xx.x']],
    soca: [['kick', 1, 'x...x...x...x...'], ['top', 6, '..x...x...x...x.'], ['top', 8, 'xx.xxx.xxx.xxx.x']],
    onedrop: [['kick', 1, '........x.......'], ['top', 6, '........x.......'], ['top', 3, 'x.x.x.x.x.x.x.x.']],
    clave: [['kick', 2, '...x..x....x..x.'], ['top', 4, 'x..x..x...x.x...'], ['perc', 8, 'x.xxx.xxx.xxx.xx']],
    huayno: [['kick', 1, 'x..x....x..x....'], ['top', 4, '..x.x.x...x.x.x.']],
    polka: [['kick', 1, 'x.......x.......'], ['top', 2, '....x.......x...'], ['top', 3, 'x.x.x.x.x.x.x.x.']],
    jig: [['kick', 1, 'x.....x.....'], ['top', 5, 'x.xx.xx.xx.x']],
    chinese: [['kick', 1, 'x.......x.......'], ['top', 3, '....x.......x...']],
    gamelan: [['kick', 1, 'x...............'], ['top', 3, '........x.......'], ['top', 4, '..x...x...x...x.']],
    samba: [['kick', 2, 'x...x...x...x...'], ['top', 6, '..x..x.x..x..x.x'], ['perc', 4, 'xxxxxxxxxxxxxxxx']],
    chip: [['kick', 1, 'x.......x.......'], ['kick', 2, '....x.......x...'], ['kick', 3, '..x...x...x...x.']],
    epic: [['kick', 1, 'x..x..x.x..x..x.'], ['top', 5, 'x...............'], ['top', 2, '....x.......x...']],
};

/* compose: returns a song { name, style, tempo (frames per step), steps, inst[], vol[], pan[], ch[][] } */
M.compose = (styleId, seed = 1, bars = 8) => {
    const S = STYLES[styleId]; if (!S) throw new Error('unknown style ' + styleId);
    const r = rng(seed * 2654435761 + styleId.length), G = S.grid, steps = G * bars, sc = SCALES[S.scale];
    const tracks = []; const add = (inst, vol, pan) => { const t = { inst, vol, pan, notes: new Array(steps).fill(0) }; tracks.push(t); return t; };
    const deg = (d, oct = 0) => { const n = sc.length, o = Math.floor(d / n); return S.key + sc[((d % n) + n) % n] + 12 * (o + oct); };
    const chordTones = (root, n) => { const out = []; for (let k = 0; k < n; k++) out.push(root + 2 * k); return out; };   // stacked thirds in scale degrees
    const P = S.parts, beat = G / 4, pick = a => a[Math.floor(r() * a.length)];
    const put = (t, step, note, len) => { if (step >= steps) return; t.notes[step] = note; for (let k = 1; k < len && step + k < steps; k++) t.notes[step + k] = 128; };
    const prog = S.prog;
    // bass
    if (P.bass) {
        const b = add(P.bass, MEL[P.bass] && MEL[P.bass].group === 'Bass' || P.bass === 'bass_808' ? 110 : 90, 64), lo = P.bass === 'bass_808' ? -1 : -2;
        for (let bar = 0; bar < bars; bar++) {
            const root = deg(prog[bar % prog.length], lo), st = bar * G;
            if (S.family === 'Heavy metal') { for (let s = 0; s < G; s += 2) put(b, st + s, root, 2); }
            else if (P.bass === 'bass_808') { put(b, st, root, beat * 3); put(b, st + beat * 3 + beat / 2, r() < 0.5 ? root : root + 12, beat / 2); }
            else if (S.drums === 'onedrop') { put(b, st + beat, root, beat); put(b, st + beat * 2 + beat / 2, deg(prog[bar % prog.length] + 2, lo), beat / 2); put(b, st + beat * 3, deg(prog[bar % prog.length] + 4, lo), beat); }
            else if (S.drums === 'polka') { for (let k = 0; k < 4; k += 2) { put(b, st + k * beat, root, beat); put(b, st + (k + 1) * beat, deg(prog[bar % prog.length] + 4, lo), beat); } }
            else if (S.drums === 'clave') { put(b, st + beat + beat / 2, root, beat); put(b, st + beat * 3, deg(prog[bar % prog.length] + 4, lo), beat); }
            else if (G === 12) { for (let k = 0; k < 4; k++) put(b, st + k * 3, k % 2 ? deg(prog[bar % prog.length] + 4, lo) : root, 3); }
            else { const pat = pick([[0, 6, 8, 14], [0, 8, 10], [0, 4, 8, 12], [0, 3, 8, 11]]); pat.forEach((s, k) => put(b, st + Math.round(s * G / 16), k === pat.length - 1 && r() < 0.4 ? deg(prog[bar % prog.length] + 4, lo) : root, Math.max(1, Math.round(2 * G / 16)))); }
        }
    }
    // chords: up to three tracks each taking one chord tone, held for the bar (or the riff for metal)
    const chordParts = ['chord', 'chord2', 'chord3'].filter(k => P[k]);
    chordParts.forEach((k, ci) => {
        const t = add(P[k], 62, [44, 84, 64][ci]);
        for (let bar = 0; bar < bars; bar++) { const tones = chordTones(prog[bar % prog.length], S.seventh ? 4 : 3), d = tones[ci + (S.seventh && ci === 2 ? 1 : 0)]; const st = bar * G; if (S.family.startsWith('Lofi') && P[k] === 'epiano') { put(t, st, deg(d, 0), beat * 2 - 1); put(t, st + beat * 2 + (ci ? 1 : 0), deg(d, 0), beat * 2 - 1); } else put(t, st, deg(d, 0), G); }
    });
    // metal riffing
    if (P.power) {
        const t = add(P.power, 96, 50), rf = P.riff ? add(P.riff, 100, 78) : null;
        for (let bar = 0; bar < bars; bar++) {
            const root = deg(prog[bar % prog.length], -1), st = bar * G;
            if (S.riff === 'doom') { put(t, st, root, 6); put(t, st + 6, root + 6 === root ? root : root + (bar % 2 ? 6 : 3), 6); put(t, st + 12, root + 1, 4); }
            else { put(t, st, root, 4); put(t, st + 12, root + (bar % 2 ? 3 : 5), 4); if (rf) { const pat = S.riff === 'tremolo' ? [4, 5, 6, 7, 8, 9, 10, 11] : [4, 6, 7, 8, 10, 11]; pat.forEach(s => put(rf, st + s, root, 1)); } }
        }
    }
    if (P.pad) { const t = add(P.pad, 54, 64); for (let bar = 0; bar < bars; bar++) put(t, bar * G, deg(prog[bar % prog.length], 0), G); }
    // drones
    ['drone', 'drone2'].forEach((k, i) => { if (!P[k]) return; const t = add(P[k], 50, i ? 90 : 38); for (let bar = 0; bar < bars; bar += 2) put(t, bar * G, i ? S.key - 5 : S.key - 12, G * 2); });
    // offbeat skank (reggae) / montuno (salsa) / oompah (norteño) / arps
    if (P.skank || P.skank2) ['skank', 'skank2'].forEach((k, i) => { if (!P[k]) return; const t = add(P[k], 70, i ? 90 : 40); for (let bar = 0; bar < bars; bar++) for (let b = 0; b < 4; b++) put(t, bar * G + b * beat + beat / 2, deg(prog[bar % prog.length] + 2 * i, 0), 2); });
    if (P.montuno) { const t = add(P.montuno, 76, 70); for (let bar = 0; bar < bars; bar++) { const tones = chordTones(prog[bar % prog.length], 3); [0, 3, 4, 6, 8, 11, 12, 14].forEach((s, k) => put(t, bar * G + s, deg(tones[k % 3], k % 4 === 3 ? 1 : 0), 1)); } }
    if (P.oompah) { const t = add(P.oompah, 70, 80); for (let bar = 0; bar < bars; bar++) for (let b = 0; b < 4; b++) if (b % 2) put(t, bar * G + b * beat, deg(prog[bar % prog.length] + 2, 0), beat - 1); }
    if (P.arp) { const t = add(P.arp, 66, 88); for (let bar = 0; bar < bars; bar++) { const tones = chordTones(prog[bar % prog.length], 3), pat = G === 12 ? [0, 1, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2] : [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 3, 2, 1, 2, 1]; for (let s = 0; s < G; s += (G === 12 ? 1 : 1)) put(t, bar * G + s, deg(tones[pat[s % pat.length] % 3], pat[s % pat.length] === 3 ? 1 : 0), 1); } }
    // melody: build a 2-bar motif, then vary it over the progression
    const leadParts = ['lead', 'lead2'].filter(k => P[k]);
    leadParts.forEach((k, li) => {
        const t = add(P[k], li ? 72 : 92, li ? 40 : 64), mode = S.lead || 'bouncy', oct = li ? 0 : (MEL[P[k]] && MEL[P[k]].base >= 70 ? 0 : 1);
        const density = { shred: 0.85, wail: 0.3, lazy: 0.35, sparse: 0.22, glitch: 0.3, pent: 0.45, raga: 0.55, maqam: 0.55, kora: 0.6, bouncy: 0.55, jig: 0.75, heroic: 0.45 }[mode] || 0.5;
        const unit = mode === 'shred' ? 1 : G === 24 ? 3 : G === 12 ? 1 : 2;
        const motif = []; let cur = 0;
        for (let s = 0; s < G * 2; s += unit) {
            const strong = s % beat === 0;
            if (r() < (strong ? density + 0.2 : density)) { cur += pick(strong ? [-2, 0, 2, 2, 4, -4] : [-1, 1, 1, -1, 2, -2]); cur = Math.max(-3, Math.min(9, cur)); let len = unit * (r() < 0.3 ? 2 : 1); if (mode === 'wail' || mode === 'sparse') len = unit * pick([2, 3, 4]); motif.push([s, cur, len]); }
        }
        if (!motif.length) motif.push([0, 0, beat]);
        const startBar = li ? 2 : (S.family === '90s experimental cloud rap' || S.family === 'Lofi / vaporwave' ? 1 : 0);
        for (let bar = startBar; bar < bars; bar += 2) {
            const root = prog[bar % prog.length], varied = bar >= bars / 2;
            for (const [s, d, len] of motif) {
                if (li && r() < 0.4) continue;
                let dd = root + d + (varied && s >= G ? pick([0, 1, -1]) : 0);
                if (s % beat === 0) { const ct = chordTones(root, 3); dd = ct.reduce((best, c) => Math.abs(c + 7 * Math.round((dd - c) / 7) - dd) < Math.abs(best - dd) ? c + 7 * Math.round((dd - c) / 7) : best, dd); }
                let note = deg(dd, oct - (li ? 0 : 0)) + (li ? -12 + (P[k] === 'bagpipe' ? 12 : 0) : 0);
                if (mode === 'glitch' && r() < 0.25) note += 12;
                put(t, bar * G + s, Math.max(24, Math.min(108, note)), len);
            }
        }
        if (mode === 'shred') for (let s = steps - G; s < steps; s++) t.notes[s] = deg(prog[(bars - 1) % prog.length] + (s % 8), 1);
    });
    // drums: one track per kit role, pattern repeated, small fills every 4th bar
    const pat = DRUMS[S.drums] || DRUMS.polka;
    const roleTrack = {};
    for (const [role, sound, p] of pat) {
        const kit = P[role] || P.kick || P.top; if (!kit) continue;
        const key = role + ':' + kit; let t = roleTrack[key];
        if (!t) { t = roleTrack[key] = add(kit, role === 'kick' ? 120 : role === 'tex' ? 60 : 96, role === 'top' ? 76 : 64); }
        for (let bar = 0; bar < bars; bar++) for (let s = 0; s < G; s++) {
            if (p[s % p.length] !== 'x') continue;
            const at = bar * G + s; if (t.notes[at] && role !== 'top') continue;
            t.notes[at] = sound;
        }
        if (role === 'top' && (S.family === '90s experimental cloud rap')) for (let bar = 3; bar < bars; bar += 4) for (let s = G - 6; s < G; s++) t.notes[bar * G + s] = sound;   // hi-hat triplet roll
    }
    if (S.family === 'Heavy metal' || S.drums === 'epic') { const t = roleTrack['top:' + P.top] || tracks[tracks.length - 1]; for (let bar = 0; bar < bars; bar += 4) t.notes[bar * G] = 5; }
    // merge to at most 8 tracks (drop the quietest extras)
    while (tracks.length > 8) { let qi = 0; tracks.forEach((t, i) => { if (t.vol < tracks[qi].vol) qi = i; }); tracks.splice(qi, 1); }
    const spb = 60 / S.bpm * 4 / G;   // seconds per step
    return { name: S.label.replace(/^[^:]+:\s*/, ''), style: styleId, tempo: Math.round(spb * 60 * 16) / 16, steps, inst: tracks.map(t => t.inst), vol: tracks.map(t => t.vol), pan: tracks.map(t => t.pan), ch: tracks.map(t => t.notes) };
};

/* songs from before instruments existed (4 rows: melody, bass, harmony, chip drums) */
M.upgradeSong = s => { if (!s.inst) { s.inst = ['sq25', 'sq50', 'sq12', 'noise'].slice(0, s.ch.length); s.vol = s.ch.map((_, i) => i === 1 ? 110 : 90); s.pan = s.ch.map(() => 64); } return s; };

/* render a whole song to a stereo float buffer (used for browser preview and tests). sr = output rate */
M.renderSong = (song, sr = 32768, loops = 1) => {
    M.upgradeSong(song);
    const stepSec = song.tempo / 60, total = Math.ceil(song.steps * loops * stepSec * sr) + sr, L = new Float32Array(total), R = new Float32Array(total);
    song.ch.forEach((notes, c) => {
        const id = song.inst[c], vol = (song.vol[c] || 90) / 127 * 0.35, pan = (song.pan[c] == null ? 64 : song.pan[c]) / 127, info = M.info(id);
        for (let rep = 0; rep < loops; rep++) for (let i = 0; i < song.steps; i++) {
            const n = notes[i]; if (!n || n >= 128) continue;
            let len = 1; while (i + len < song.steps && notes[i + len] === 128) len++;
            const t0 = Math.floor(((rep * song.steps) + i) * stepSec * sr), dur = Math.floor(len * stepSec * sr);
            let src, rate, loop = -1, ratio;
            if (info.psg !== undefined) {
                if (info.psg === 3) { const d = [0, 0.05, 0.08, 0.02][n & 3], cut = Math.floor(d * sr); for (let k = 0; k < cut && t0 + k < total; k++) { const v = (Math.random() * 2 - 1) * Math.exp(-k / (cut / 3)) * vol; L[t0 + k] += v * (1 - pan); R[t0 + k] += v * pan; } continue; }
                const f = mtof(n), duty = [0.5, 0.25, 0.125][info.psg]; for (let k = 0; k < dur && t0 + k < total; k++) { const v = sqr(f * k / sr, duty) * vol * 0.5; L[t0 + k] += v * (1 - pan); R[t0 + k] += v * pan; } continue;
            }
            const rd = M.render(id); if (!rd) continue;
            if (rd.kind === 'kit') { const s = rd.sounds[n - 1]; if (!s) continue; src = s.data; rate = s.rate; ratio = rate / sr; }
            else { src = rd.data; rate = rd.rate; loop = rd.loop; ratio = rate * Math.pow(2, (n - rd.base) / 12) / sr; }
            const kit = rd.kind === 'kit';
            let next = i + len; while (next < song.steps && !notes[next]) next++;
            let nx = i + 1; while (nx < song.steps && (!notes[nx] || notes[nx] === 128)) nx++;
            const maxLen = kit ? (nx < song.steps ? Math.floor((nx - i) * stepSec * sr) : Infinity) : dur;
            let p = 0;
            for (let k = 0; t0 + k < total && k < maxLen; k++) {
                if (p >= src.length) { if (loop >= 0) p = loop + (p - src.length); else break; }
                const v = src[Math.floor(p)] * vol; L[t0 + k] += v * (1 - pan); R[t0 + k] += v * pan; p += ratio;
            }
        }
    });
    return { sr, L, R };
};

/* ready-made library: every style with a fixed seed */
M.presetSongs = () => Object.keys(STYLES).map((id, i) => M.compose(id, 7 + i));

if (typeof module !== 'undefined') module.exports = M; else root.NRMusic = M;
})(typeof self !== 'undefined' ? self : this);

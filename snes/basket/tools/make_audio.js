// Builds the basketball sound image (hoops sound effects + 3 songs) with the dev kit's own SNES sound builder.
// node make_audio.js  -> build/audio_data.bin (loads at $0800 in sound RAM); then spcasm builds the driver.
const S = require('../../../ds/kit/nrsnes.js'), M = require('../../../ds/kit/nrmusic.js'), fs = require('fs');
const R = 22050; let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 * 2 - 1;
const mk = (sec, f) => { const n = Math.floor(sec * R), d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = f(i / R, i / n); return { samples: d, rate: R }; };
let lp = 0; const noise = (k) => (lp += k * (rnd() - lp));
const SND = {
    bounce: mk(0.18, (t, u) => Math.sin(2 * Math.PI * (60 + 140 * Math.exp(-t * 30)) * t) * Math.exp(-t * 22) * 1.0 + rnd() * 0.15 * Math.exp(-t * 60)),
    swish: mk(0.42, (t, u) => noise(0.45) * Math.sin(Math.PI * Math.pow(u, 0.6)) * 1.2),
    hit: mk(0.14, (t, u) => (Math.sin(2 * Math.PI * 90 * t) * 0.8 + rnd() * 0.6) * Math.exp(-t * 28)),
    whistle: mk(0.55, (t, u) => Math.sin(2 * Math.PI * (2800 + 120 * Math.sin(t * 60)) * t + 6 * Math.sin(2 * Math.PI * 40 * t)) * (u < 0.05 ? u / 0.05 : u > 0.85 ? (1 - u) / 0.15 : 1)),
    pass: mk(0.14, (t, u) => noise(0.6) * Math.sin(Math.PI * u)),
    cheer: mk(0.95, (t, u) => (noise(0.35) * 0.9 + Math.sin(2 * Math.PI * 520 * t) * 0.15 * rnd()) * Math.sin(Math.PI * Math.pow(u, 0.7))),
    buzzer: mk(0.7, (t, u) => ((Math.sin(2 * Math.PI * 190 * t) > 0 ? 1 : -1) * 0.7 + (Math.sin(2 * Math.PI * 193 * t) > 0 ? 1 : -1) * 0.3) * (u > 0.9 ? (1 - u) / 0.1 : 1)),
};
// driver sound slots (order fixed by the driver): jump, coin, stomp, hurt, spring, 1up, goal
const P = { songs: [M.compose('cloud_purple', 5, 8), M.compose('chip_adventure', 9, 8), M.compose('world_latin', 4, 4)],
    sfx: { jump: 'bounce', coin: 'swish', stomp: 'hit', hurt: 'whistle', spring: 'pass', '1up': 'cheer', goal: 'buzzer' } };
const out = S.buildSound(P, { snd: n => SND[n] }, 0xE800 - 0x0B00);
fs.writeFileSync(__dirname + '/../build/audio_data.bin', out.blob);
fs.writeFileSync(__dirname + '/../build/audio_info.json', JSON.stringify({ used: out.used, quality: out.quality, instruments: out.instruments, samples: out.samples, sfxIds: out.sfxIds }));
console.log('sound image', out.used, 'bytes, quality', out.quality, 'sfx', out.sfxIds.join(','));

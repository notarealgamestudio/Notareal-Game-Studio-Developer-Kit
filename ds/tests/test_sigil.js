// Memphis Sigil kit tests: codec, synth parity with the C engine, starters, WAV render, ROM block
const S = require('../kit/nrsigil.js'), Kit = require('../kit/nrkit.js'), fs = require('fs'); let pass = 0, fail = 0;
const t = (n, ok) => { if (ok) pass++; else { fail++; console.log('FAIL', n); } };
const P = S.starter('boom-bap'), b = S.pack(P);
t('pack size', b.length === S.SIZE); const r = S.unpack(b); t('unpack ok', r.ok === 0 && r.proj.bpm === 92 && r.proj.name === 'BOOM-BAP'); t('roundtrip identical', Buffer.compare(Buffer.from(S.pack(r.proj)), Buffer.from(b)) === 0);
const bad = b.slice(); bad[100] ^= 1; t('crc detects flipped byte', S.unpack(bad).ok === 4); t('truncated', S.unpack(b.slice(0, 50)).ok === 1); const bm = b.slice(); bm[0] = 0; t('bad magic', S.unpack(bm).ok === 2);
const nv = b.slice(); nv[4] = 9; t('newer version refused', S.unpack(nv).ok === 3); t('negative pitch survives', (() => { const q = S.starter('trap'); q.pitch[2] = -5; return S.unpack(S.pack(q)).proj.pitch[2] === -5; })());
// synth: bit-identical to engine/sigil/source/synth.h (FNV-1a of each rendered sample; regenerate with the host C build when synth.h changes)
const C = [3326605122, 481781149, 3870653421, 2247826684, 2334177058, 4211005988, 1843299163, 4139580827, 380674355, 2260475656, 676750220, 1300796457];
S.SOUNDS.forEach((_, i) => t('synth parity ' + S.SOUNDS[i][0], S.fnv(S.render(i)) === C[i]));
t('12 sounds, 8+ drums', S.SOUNDS.length === 12 && S.SOUNDS.filter(s => !/BASS/.test(s[0])).length >= 8);
t('sounds are audible', S.SOUNDS.every((_, i) => { let pk = 0; for (const v of S.render(i)) pk = Math.max(pk, Math.abs(v)); return pk > 40; }));
t('rate octaves', S.rate(0) === 22050 && S.rate(12) === 44100 && S.rate(-12) === 11025);
for (const k of ['boom-bap', 'trap', 'house']) { const q = S.starter(k); const w = S.renderWav(q, { bars: 2 }); t('render ' + k, w.hits > 20 && w.seconds > 2 && w.wav.length > 1e5 && S.unpack(S.pack(q)).ok === 0); }
const w = S.renderWav(S.starter('house'), { bars: 1 }), dv = new DataView(w.wav.buffer); let pk = 0; for (let i = 44; i < w.wav.length; i += 2) pk = Math.max(pk, Math.abs(dv.getInt16(i, true))); t('wav not silent', pk > 5000);
const D = S.data(); t('korg data: 24 DS-10 patches', D.ds10_patches.length === 24 && D.ds10_patches[16].name === 'KICK1'); t('korg data: 36 M01 grooves', D.grooves.length === 36); t('korg data: M01 programs and kits', D.m01_programs.length > 300 && D.m01_kits.length > 20);
t('DS-10 demo tempos plausible', D.ds10_demos.filter(x => x.chain.length).every(x => x.bpm >= 100 && x.bpm <= 140));
for (let i = 0; i < 6; i++) { const q = S.fromKorgDemo(i); t('korg demo ' + i, q.songmode === 1 && q.chainlen >= 1 && q.bpm >= 100 && S.unpack(S.pack(q)).ok === 0); }
const blk = S.buildDS(P).block; t('block header', Buffer.from(blk.slice(0, 8)).toString() === 'NRGDATA1' && Buffer.from(blk.slice(20, 24)).toString() === 'SGPJ');
const rom = fs.readFileSync(__dirname + '/../engine/sigil/nr_sigil.nds'), out = Kit.patchROM(new Uint8Array(rom), blk); t('patchROM accepts the block', out.rom.length === rom.length && !!Buffer.from(out.rom).includes(Buffer.from(b.slice(0, 40))));
t('ROM has the NRGDATA1 block and is a sane size', rom.length > 200000 && rom.length < 600000 && Buffer.from(rom).includes(Buffer.from('NRGDATA1')));
const T = require('../kit/nrtemplates.js'), ap = T.apply('music_maker', JSON.parse(fs.readFileSync(__dirname + '/../examples/lakewood_run.json')), {}); t('music_maker template opens Sigil Studio', ap.tab === 'sigil' && ap.project.sigil && ap.project.sigil.bpm === 92);
console.log(`sigil: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

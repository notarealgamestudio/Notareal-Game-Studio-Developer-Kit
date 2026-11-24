const X = require('../kit/nrsixthseal.js'); let ok = 0, bad = 0; const t = (n, c, x) => { c ? ok++ : (bad++, console.log('FAIL', n, x || '')); };
t('presets 20-30 total content', X.KITS.length * 8 + X.BASS.length + X.KEYS.length + X.PRESETS.length >= 20);
t('4 kits, 8 bass, 12 keys, 5 tape', X.KITS.length === 4 && X.BASS.length === 8 && X.KEYS.length === 12 && X.TAPE.length === 5);
t('6 sigils, 5 districts', X.SIGILS.length === 6 && X.DISTRICTS.length === 5);
const tape = X.newTape(), prog = X.newProgress();
t('six empty slots', tape.slots.length === 6 && X.filled(tape) === 0);
// preset combos only use unlocked-at-start or valid items
for (const pr of X.PRESETS) { t('preset valid ' + pr.name, X.KITS.some(k => k.id === pr.kit) && X.BASS[pr.bass] && X.KEYS[pr.keys] && X.TAPE[pr.tape] && pr.bpm >= 60 && pr.bpm <= 180); }
// save: no silent overwrite, unlock when all six filled
let r = X.saveBeat(tape, 0, X.fromPreset(X.PRESETS[0])); t('first save', r.ok && !r.unlockedHollow);
r = X.saveBeat(tape, 0, X.fromPreset(X.PRESETS[1])); t('overwrite needs confirm', !r.ok && r.needsConfirm && tape.slots[0].name === 'DARK KIT + SUB'.slice(0, 14).toUpperCase());
r = X.saveBeat(tape, 0, X.fromPreset(X.PRESETS[1]), { confirm: true }); t('overwrite confirmed', r.ok);
for (let i = 1; i < 6; i++) { r = X.saveBeat(tape, i, X.fromPreset(X.PRESETS[i % X.PRESETS.length], i)); }
t('sixth save unlocks the Hollow', r.unlockedHollow && X.complete(tape)); t('checkUnlock sets flag', X.checkUnlock(tape, prog) && prog.hollow && !X.checkUnlock(tape, prog));
// available items gated by sigils
let av = X.available(prog); t('start: no distorted kit', !av.kits.some(k => k.id === 'grave') && !av.bass.some(b => b.id === 7));
t('quest grants sigil', X.questSigil(prog, 'cemetery').new); av = X.available(prog); t('grave mark unlocks kit + bass', av.kits.some(k => k.id === 'grave') && av.bass.some(b => b.id === 7));
t('quest blocked before unlock', !X.questSigil(X.newProgress(), 'chapel').ok);
// battle
const rev = X.RIVALS[1], good = X.fromPreset(X.PRESETS[1]); good.bpm = 66; const sc = X.scoreBattle(good, rev); t('battle returns parts', sc.total > 0 && sc.parts.compliance >= 0 && Array.isArray(sc.checks));
const bad1 = X.fromPreset(X.PRESETS[4]); bad1.bpm = 140; const sc2 = X.scoreBattle(bad1, rev); t('non-compliant loses with reasons', !sc2.win && sc2.why.length >= 1, JSON.stringify(sc2.why));
const w = X.finishBattle(prog, rev, X.scoreBattle(Object.assign(X.fromPreset(X.PRESETS[1]), { bpm: 66 }), rev)); t('battle reward applied', prog.cash >= 0);
const cem = X.RIVALS[2], heavy = X.fromPreset(X.PRESETS[7]); for (let i = 0; i < 16; i += 2) heavy.bassNotes[i] = i % 8; [0, 1, 2, 3].forEach(i => heavy.drums[i][i * 3 % 16] = 100); const hs = X.scoreBattle(heavy, cem); if (hs.win) { X.finishBattle(prog, cem, hs); t('rival sigil granted on win', prog.sigils.includes('serpent_groove')); } else t('heavy beat meets challenge', false, JSON.stringify(hs.why));
// gig
const g = X.scoreGig(tape, [0, 1, 2], [1, .8, .6]); t('gig mood 0..100 with log', g.mood >= 0 && g.mood <= 100 && g.cash > 0);
let threw = false; try { X.scoreGig(tape, [0, 0, 1]); } catch (e) { threw = true; } t('gig needs 3 different tracks', threw);
const g2 = X.scoreGig(tape, [0, 1, 2], [1, 1, 1]), g3 = X.scoreGig(tape, [0, 1, 2], [0, 0, 0]); t('timing matters', g2.mood > g3.mood);
X.finishGig(prog, g2); t('respect milestone eventually grants black candle', (() => { prog.respect = 40; X.milestones(prog); return prog.sigils.includes('black_candle'); })());
t('day clock + saturday gig', (() => { const p = X.newProgress(); let d; for (let i = 0; i < 5; i++) d = X.nextDay(p); return d.saturday && d.day === 'Sat'; })());
// save / load roundtrip + corruption
const bin = X.pack(tape, prog), u = X.unpack(bin); t('roundtrip ok', u.ok === 0, u.ok); t('roundtrip data', u.ok === 0 && JSON.stringify(u.tape.slots[2].drums.map(r => r.map(v => v > 0))) === JSON.stringify(tape.slots[2].drums.map(r => r.map(v => v > 0))) && u.tape.slots[3].name === tape.slots[3].name && u.prog.cash === prog.cash && u.prog.sigils.length === prog.sigils.length && u.prog.hollow);
const cor = bin.slice(); cor[40] ^= 255; t('corruption detected', X.unpack(cor).ok === 4); t('short rejected', X.unpack(bin.slice(0, 8)).ok === 1); const fut = bin.slice(); fut[4] = 9; t('future version rejected', X.unpack(fut).ok === 3 || X.unpack(fut).ok === 4);
t('save size small', bin.length < 1200, bin.length);
console.log('sixthseal', ok, 'pass', bad, 'fail; save bytes', bin.length); process.exit(bad ? 1 : 0);

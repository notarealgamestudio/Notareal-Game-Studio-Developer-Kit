const W = require('../kit/nrwrestling.js'), F = require('../kit/nrfight.js'); let ok = 0, bad = 0; const t = (n, c, x) => { c ? ok++ : (bad++, console.log('FAIL', n, x || '')); };
const ctx = new Proxy({}, { get: (o, k) => k === 'measureText' ? () => ({ width: 10 }) : (typeof o[k] === 'undefined' ? () => { } : o[k]), set: (o, k, v) => { o[k] = v; return true; } });
const cv = { width: 384, height: 216, getContext: () => ctx };
t('move count', W.MOVES.length >= 28, W.MOVES.length);
const types = W.summary(); for (const k of ['strike', 'grapple', 'back', 'run', 'ground', 'aerial', 'finisher']) t('has ' + k, types[k] >= 1, JSON.stringify(types));
const ids = new Set(); for (const m of W.MOVES) { t('unique ' + m.id, !ids.has(m.id)); ids.add(m.id); t(m.id + ' frames', m.frames >= 8 && m.hitAt > .3 && m.hitAt < 1); for (const kf of [m.me, m.you]) { if (!kf) continue; t(m.id + ' kf sorted', kf.every((a, i) => !i || a[0] >= kf[i - 1][0])); t(m.id + ' kf ends at 1', kf[kf.length - 1][0] === 1 || kf[kf.length - 1][0] > .8); } }
// every pose interpolates to finite numbers
for (const m of W.MOVES) for (let u = 0; u <= 1; u += .1) { const p = W.at(m.me, u); t(m.id + ' finite', Object.values(p).every(Number.isFinite)); }
// choose(): situation -> move type
const r = () => .3;
t('running A -> run', ['run'].includes(W.choose({ button: 'A', dist: 30, running: true, combo: 0 }, r).type));
t('foe down -> ground', W.choose({ button: 'A', dist: 30, foeDown: true }, r).type === 'ground');
t('ropes + down + B -> aerial', W.choose({ button: 'B', dist: 30, foeDown: true, atRopes: true }, r).type === 'aerial');
t('behind -> back move', W.choose({ button: 'B', dist: 20, behind: true, foeHp: 1 }, r).type === 'back');
t('mom full -> finisher', W.choose({ button: 'AB', dist: 20, mom: 100, foeHp: .5 }, r).type === 'finisher');
t('low hp unlocks powerbomb family', (() => { const seen = new Set(); for (let i = 0; i < 200; i++) seen.add(W.choose({ button: 'B', dist: 20, foeHp: .3 }, Math.random).id); return seen.has('powerbomb') || seen.has('piledriver') || seen.has('chokeslam'); })());
// full match with moveset: player mashes, finishes or wins; pose set during moves
const keys = {}; const cfg = { title: 'T', moveset: true, ring: {}, fighters: [{ name: 'A', hp: 100, power: 1, speed: 1, finisher: 'stunner' }, { name: 'B', hp: 100, power: 1, speed: .9 }] };
const g = F.play(cv, cfg, { keys, manual: true, seed: 5 }); const moves = new Set(); let posed = 0;
for (let i = 0; i < 6000 && !g.state.over; i++) { keys.ArrowRight = (i % 90) < 40; keys.z = (i % 12) < 3; keys.x = (i % 50) > 40; keys.v = (i % 300) > 280; g.step(1); if (g.state.f[0].pose) posed++; g.state.log.filter(l => l.startsWith('move:')).forEach(l => moves.add(l)); }
t('match used several moves', moves.size >= 4, [...moves].join(','));
t('poses were applied', posed > 50, posed);
t('someone took damage', g.state.f[1].hp < 100 || g.state.f[0].hp < 100);
t('held released', !g.state.f[0].held || g.state.over);
console.log('wrestling', ok, 'pass', bad, 'fail; moves used:', [...moves].join(', ')); process.exit(bad ? 1 : 0);

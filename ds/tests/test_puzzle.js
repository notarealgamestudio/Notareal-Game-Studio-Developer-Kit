const PZ = require('../kit/nrpuzzle.js'); let p = 0, f = 0; const T = (n, ok) => { ok ? p++ : f++; console.log(ok ? 'PASS' : 'FAIL', n); };
const m = PZ.match3({}, { seed: 3 }); T('match3 starts with no ready matches and a playable move', m.state.score === 0 && m.possible());
let did = 0; outer: for (let y = 0; y < 8; y++) for (let x = 0; x < 7; x++) { const before = m.state.moves; if (m.swap(x, y, x + 1, y)) { did = 1; T('valid swap scores and uses a move', m.state.score > 0 && m.state.moves === before - 1); break outer; } }
if (!did) T('found a valid swap', false);
const bad = PZ.match3({}, { seed: 3 }); let rej = 0; for (let y = 0; y < 8 && !rej; y++) for (let x = 0; x < 7; x++) { const mv = bad.state.moves; if (!bad.swap(x, y, x + 1, y)) { rej = bad.state.moves === mv ? 1 : 0; break; } } T('swap that makes no match is refused and costs nothing', rej === 1);
T('non-adjacent swap refused', PZ.match3({}, { seed: 1 }).swap(0, 0, 3, 3) === 0);
const g = PZ.match3({ moves: 3, goal: 99999 }, { seed: 5 }); for (let k = 0; k < 200 && !g.state.over; k++) for (let y = 0; y < 8 && !g.state.over; y++) for (let x = 0; x < 7; x++) if (g.swap(x, y, x + 1, y)) break; T('running out of moves ends the game', g.state.over && !g.state.over.win && g.state.moves === 0);
const w = PZ.match3({ goal: 30 }, { seed: 9 }); for (let y = 0; y < 8 && !w.state.over; y++) for (let x = 0; x < 7; x++) if (w.swap(x, y, x + 1, y)) break; T('reaching the goal wins', w.state.over && w.state.over.win);
const b = PZ.bracelet({ rows: 3, threads: 4, pattern: 'diagonal' }); for (let r = 0; r < 3; r++) { b.hint().forEach((c, i) => b.paint(i, c)); b.check(); } T('bracelet copied correctly finishes and scores', b.state.over && b.state.over.win && b.state.score >= 300);
const b2 = PZ.bracelet({ rows: 2, threads: 4, tries: 2 }); b2.check(); T('checking an empty row asks to fill threads', b2.state.row === 0 && b2.state.tries === 2); for (let k = 0; k < 2; k++) { const h = b2.hint(); h.forEach((c, i) => b2.paint(i, (c + 1) % 3)); b2.check(); } T('too many wrong rows tangles the bracelet', b2.state.over && !b2.state.over.win);
for (const k of Object.keys(PZ.PATTERNS)) T('pattern ' + k + ' uses only palette colours 0-2', PZ.PATTERNS[k](6, 12).every(r => r.length === 6 && r.every(v => v >= 0 && v <= 2)));
console.log(`\n${p} passed, ${f} failed`); process.exit(f ? 1 : 0);

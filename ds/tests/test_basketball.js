const A = require('../kit/nrarcade.js'); let ok = 0, bad = 0; const t = (n, c, x) => { c ? ok++ : (bad++, console.log('FAIL', n, x || '')); };
t('registered', A.MODES.basketball && A.DEFAULTS.basketball);
const ctx = new Proxy({}, { get: (o, k) => k === 'measureText' ? () => ({ width: 5 }) : (typeof o[k] === 'undefined' ? () => { } : o[k]), set: (o, k, v) => { o[k] = v; return true; } });
let best = null;
for (const seed of [1, 2, 3, 4]) { const g = A.create('basketball', { seconds: 60 }, { seed }), k = {}; let shots = 0, msgs = new Set(), tgt;
    for (let i = 0; i < 4000 && g.s.status === 'play'; i++) { const me = g.s.P[0], b = g.s.ball; const h = g.s.ball.h === 0; k.ArrowRight = true; k.ArrowLeft = false; k.ArrowUp = (i % 120) < 30; k.ArrowDown = false; k.z = h && (i % 90) === 60; k.x = !h && (i % 40) < 3; k.c = (i % 200) < 40; g.step(k); if (g.s.msgT > 0) msgs.add(g.s.msg); g.draw(ctx); if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.z)) { t('finite ball', false, JSON.stringify(b)); break; } }
    t('seed ' + seed + ' ends', g.s.status !== 'play', g.s.status); t('scores sensible', g.s.score[0] + g.s.score[1] > 0, JSON.stringify(g.s.score)); best = best || [g.s.score, [...msgs]]; t('events', msgs.size >= 1, [...msgs].join()); if (seed === 1) console.log(JSON.stringify(g.s.score), [...msgs].join(','));
}
// determinism
const run = sd => { const g = A.create('basketball', {}, { seed: sd }); for (let i = 0; i < 1500; i++) g.step({ ArrowRight: i % 50 < 30, z: i % 70 === 0 }); return JSON.stringify(g.s.score) + g.s.t; }; t('deterministic', run(9) === run(9));
console.log('basketball', ok, 'pass', bad, 'fail'); process.exit(bad ? 1 : 0);

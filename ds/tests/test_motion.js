const M = require('../kit/nrmotion.js'); let f = 0, n = 0; const ok = (c, m) => { n++; if (!c) { f++; console.log('FAIL', m); } };
ok(M.CLASSES.length >= 14, 'classes'); ok(M.cls('N86_SuplexZ_A') === 'throw', 'cls throw'); ok(M.cls('PunchZ') === 'strike', 'cls strike');
ok(M.ease('strike', 0) === 0 && Math.abs(M.ease('strike', 1) - 1) < 1e-9, 'ease ends'); let prev = -1, mono = true; for (let i = 0; i <= 20; i++) { const e = M.ease('throw', i / 20); if (e < prev) mono = false; prev = e; } ok(mono, 'ease monotonic');
ok(M.ease('strike', 0.5) > 0.2 && M.ease('strike', 0.5) < 0.95, 'ease mid not linear-trivial');
const fl = M.fall(1, 0); ok(fl.length > 20 && fl[fl.length - 1] === 0 && Math.max(...fl.slice(fl.indexOf(0) + 1)) < 0.15 && Math.max(...fl.slice(fl.indexOf(0) + 1)) >= 0, 'fall bounces and settles');
ok(M.maxSpeed('strike') > M.maxSpeed('idle') * 3, 'strikes faster than idle'); ok(M.hitImpulse(1)[3] > M.hitImpulse(1)[0], 'extremities whip hardest');
console.log(`motion: ${n - f}/${n} passed`); process.exit(f ? 1 : 0);

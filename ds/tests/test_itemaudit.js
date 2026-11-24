const A = require('../kit/nritemaudit.js'); let f = 0, n = 0; const ok = (c, m) => { n++; if (!c) { f++; console.log('FAIL', m); } };
const p = A.fromText('shop General: hoe, seed\ndrop mine: stone, coal\nrecipe furnace = stone x25, coal\nrecipe scarecrow = wood x50, fiber\nitems: ruby');
const r = A.audit(p);
ok(r.reachable.includes('furnace'), 'recipe with obtainable ingredients'); ok(r.unobtainable.includes('scarecrow') && r.unobtainable.includes('wood'), 'missing ingredient reported');
ok(r.unobtainable.includes('ruby'), 'item with no source'); ok(!r.ok, 'not ok');
const r2 = A.audit(A.fromText(p.items.length ? 'shop X: wood, fiber, ruby, hoe, seed\ndrop m: stone, coal\nrecipe furnace = stone, coal\nrecipe scarecrow = wood, fiber' : ''));
ok(r2.ok, 'all obtainable'); ok(/Every item/.test(A.report(r2)), 'report');
console.log(`itemaudit: ${n - f}/${n} passed`); process.exit(f ? 1 : 0);

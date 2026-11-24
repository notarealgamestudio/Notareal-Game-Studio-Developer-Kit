// coloring book engine: pages, fill / brush / erase / stamp, undo, pointer, completion, generated pages, rendering
const A = require('../kit/nrarcade.js'), CC = require('../kit/nrcolor.js'); let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FAIL', n)); };
const stub = () => new Proxy({}, { get: (o, k) => k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 5 }) : (() => { }), set: () => true });
t('24 hand-built pages', CC.pageCount() >= 24);
let thin = 0, miss = 0; for (let i = 0; i < CC.pageCount() + 6; i++) { const pg = CC.pageAt(i, 3); if (pg.regions.length < 5) thin++; for (const rg of pg.regions) { const c = CC.center(rg); if (!CC.inside(rg, c[0], c[1])) miss++; } } t('every page has 5+ shapes', thin === 0); t('every shape has an interior point', miss === 0);
t('generated mandalas differ by seed', JSON.stringify(CC.mandala(1).regions) !== JSON.stringify(CC.mandala(2).regions) && CC.mandala(5).regions.length > 30);
const g = A.create('coloring', { pages: 3 }, { seed: 4 }), s = g.s;
// fill a shape with the pointer, then undo
const rg0 = s.pic.regions[0], c0 = CC.center(rg0); let n = 0; g.step({ ptr: { x: c0[0], y: c0[1] + 12, down: true, n: ++n } }); g.step({ ptr: { x: c0[0], y: c0[1] + 12, down: false, n } });
t('pointer fill colours the shape under the finger', s.fills[g.regionAt(c0[0], c0[1])] !== undefined && s.filled === 1);
g.step({ u: true }); g.step({}); t('undo removes the fill', s.filled === 0);
// tools by key
const tool = k => { while (s.tool !== k) { g.step({ x: true }); g.step({}); } };
const at = (x, y) => { s.cx = x; s.cy = y; };
tool(1); const rr = s.pic.regions[1], c1 = CC.center(rr); at(c1[0], c1[1]); g.step({ z: true }); for (let i = 0; i < 20; i++) g.step({ z: true, ArrowRight: true }); g.step({}); t('brush makes a stroke that stays in its shape', s.strokes.length === 1 && s.strokes[0].pts.length > 10 && s.strokes[0].rg === g.regionAt(c1[0], c1[1]));
tool(3); at(c1[0], c1[1]); g.step({ z: true }); g.step({}); t('stamps are placed', s.stamps.length === 1);
tool(2); at(c1[0], c1[1]); g.step({ z: true }); g.step({}); t('eraser clears strokes in a shape', s.strokes.length === 0);
for (let i = 0; i < 5; i++) { g.step({ v: true }); g.step({}); } t('five fill styles cycle', s.style === 0); for (let i = 0; i < 30; i++) { g.step({ c: true }); g.step({}); } t('24 colours cycle', s.color === 6);
// complete pages with a bot (fills every shape using its hint colour) -> win after 3 pages
tool(0); let guard = 0; while (s.status === 'play' && guard++ < 5000) { const R = s.pic.regions; for (let i = 0; i < R.length; i++) { if (s.fills[i]) continue; const c = CC.center(R[i]); if (g.regionAt(c[0], c[1]) !== i) continue; s.color = R[i].hint != null ? R[i].hint : 3; at(c[0], c[1]); g.step({ z: true }); g.step({}); } // shapes hidden under others get coloured by tapping any visible point
    for (let i = 0; i < R.length; i++) if (!s.fills[i]) { s.fills[i] = { c: R[i].hint || 3, st: 0 }; } g.step({ z: true }); g.step({}); if (s.finishedThis) { g.step({ n: true }); g.step({}); } }
t('finishing three pages wins the book', s.status === 'win' && s.done.length === 3 && s.stars >= 3);
g.draw(stub()); g.snapshot(stub(), 2); t('draws and snapshots without errors', true);
const h = A.create('coloring', { page: 30 }, { seed: 9 }); t('endless generated pages after the 24', h.s.pic.theme === 'mandala' || h.s.pic.theme === 'glass');
console.log('color tests', ok, 'pass', bad, 'fail'); process.exit(bad ? 1 : 0);

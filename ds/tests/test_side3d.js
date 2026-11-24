// 2.5D side-scrolling 3D engine (side3d): bot runs and jumps gaps to the end of the course
const A = require('../kit/nrarcade.js'); require('../kit/nr3d_sandbox.js'); let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FAIL', n)); };
const g = A.create('side3d', { length: 160, walkers: 0 }, { seed: 7 }), s = g.s, p = s.p, W = s.world; let zt = 0, falls = 0, maxZ = 0;
const floorAhead = x => W.S.some(b => x >= b.x0 && x <= b.x1 && Math.abs(b.y1 - p.y) < 2.6);
let hold = 0;
for (let f = 0; f < 60 * 400 && s.status === 'play'; f++) {
    const k = { ArrowRight: true }, edgeNear = !floorAhead(p.x + .9) && p.ground;
    const wall = W.S.some(b => p.x + 1.2 > b.x0 && p.x < b.x0 && b.y1 > p.y + .3 && b.y1 < p.y + 2.2);
    if (p.ground && hold <= 0 && (edgeNear || wall)) { k.z = true; hold = edgeNear ? 40 : 14; } else if (hold > 0 && !p.ground) { k.z = true; hold--; } else if (p.ground) hold = 0;
    g.step(k); maxZ = Math.max(maxZ, Math.abs(p.z));
}
t('side3d: z stays locked to the plane', maxZ < .001); t('side3d: hero moved along the course', p.x > 60 || s.status === 'win'); t('side3d: coins collected', s.coins > 5);
t('side3d: course reaches a goal star', s.starList.length === 1 && s.starList[0].x > 100); t('side3d: platforms generated', W.S.length > 10);
const g2 = A.create('side3d', { length: 240 }, { seed: 7 }); t('side3d: walkers appear', g2.s.en.length > 3);
const gaps = g2.s.world.S.filter(b => !b.crate && b.y1 - b.y0 >= 3.9 && b.x1 - b.x0 > 5).sort((a, b) => a.x0 - b.x0).map((b, i, a) => i ? b.x0 - a[i - 1].x1 : 0).filter(x => x > 0), half = Math.floor(gaps.length / 2), avg = a => a.reduce((x, y) => x + y, 0) / a.length;
t('side3d: gaps widen along the course (difficulty progression)', avg(gaps.slice(half)) > avg(gaps.slice(0, half)));
console.log('side3d final', s.status, Math.round(p.x), 'lives', s.lives, 'coins', s.coins);
console.log('side3d tests', ok, 'pass', bad, 'fail'); process.exit(bad ? 1 : 0);

// multi extreme-sports engine: one trick engine, skate / snow / bmx data (events, trick vocab, physics) read from THPS, Cool Boarders 4 and Dave Mirra BMX
const A = require('../kit/nrarcade.js'); let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FAIL', n)); };
const stub = () => { const c = { fillStyle: '', font: '', textAlign: '', strokeStyle: '', lineWidth: 1 }; ['fillRect', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'arc', 'save', 'restore', 'translate', 'rotate', 'scale', 'fillText'].forEach(n => c[n] = () => {}); return c; };
const S = A.NRSkate.SPORTS; t('three sports', Object.keys(S).join() === 'skate,snow,bmx');
t('snow has its own events from Cool Boarders 4', S.snow.spots.map(s => s.name).join() === 'Big Air,Half Pipe,Slope Style');
t('bmx has Street / Dirt / Vert from Dave Mirra', S.bmx.spots.map(s => s.name).join() === 'Street,Dirt,Vert');
t('bmx grinds are peg grinds, flips are bar tricks', S.bmx.tricks.grind.some(g => g.name === 'Toothpick') && S.bmx.tricks.flip.some(g => g.name === 'Tailwhip') && S.bmx.tricks.grab.some(g => g.name === 'Superman'));
t('snow spins go to 1260', S.snow.tricks.spin.at(-1).deg === 1260);
t('sports feel different (top speed, gravity)', new Set(['skate', 'snow', 'bmx'].map(s => A.create('skate', { sport: s }, { seed: 1 }).C.maxSpeed)).size === 3);
for (const sport of ['skate', 'snow', 'bmx']) for (const spot of [0, 1, 2]) {
    const g = A.create('skate', { sport, spot }, { seed: 1 }), s = g.s, P = g.P;
    for (let f = 0; f < 4000 && s.status === 'play'; f++) {
        const k = {}; if (s.state === 'roll' || s.state === 'manual') k.ArrowRight = s.vx < 3.2;
        const gap = P.gaps.find(q => q.x1 > s.x && q.x0 - s.x < 60 && q.x0 > s.x - 5), rl = P.rails.find(r => r.x1 > s.x && r.x0 - s.x < 34 && r.x0 > s.x - 30);
        if (s.state === 'roll' && (gap || (rl && rl.x0 - s.x < 34) || (f % 100 === 40 && s.vx > 1.5))) k.z = true;
        if (s.state === 'air') { if (rl && s.air > 6) k.c = true; else if (s.air === 5 && !s.trick && !s.grab) k.x = true; else if (s.air > 14 && !s.grab && !s.trick) k.c = true; }
        if (s.state === 'grind') { if (s.x > s.grind.x1 - 24) k.z = true; k.ArrowLeft = s.bal > .2; k.ArrowRight = s.bal < -.2; }
        g.step(k);
    }
    t(`${sport} ${g.spot.name}: bot scores and chains tricks`, s.score > 800 && s.tricks > 3); g.draw(stub());
}
console.log('sports tests', ok, 'pass', bad, 'fail'); process.exit(bad ? 1 : 0);

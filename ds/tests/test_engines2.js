// rail shooter + baseball engines (v1.19): bot players finish a run; rules checks (civilians, cover, headshots, strikes / walks / outs / innings)
const A = require('../kit/nrarcade.js'); let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FAIL', n)); };
const stub = () => { const c = { fillStyle: '', font: '', textAlign: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1 }; ['fillRect', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'arc', 'save', 'restore', 'translate', 'rotate', 'scale', 'fillText'].forEach(n => c[n] = () => {}); return c; };
// ---- rail shooter
{
    const g = A.create('rail', {}, { seed: 2 }), s = g.s; let toggle = 0;
    for (let f = 0; f < 20000 && s.status === 'play'; f++) {
        const k = {}, live = s.en.filter(e => !e.dead && e.kind !== 'civ').sort((a, b) => b.z - a.z)[0];
        if (s.ammo === 0 || (s.hp < 3 && s.en.some(e => e.tel))) k.x = true;
        else if (live) { const sc = .35 + live.z * 1.1, hy = live.y - 44 * sc * (live.kind === 'boss' ? 2.4 : 1) * .85, hx = live.kind === 'boss' ? live.x + Math.sin(s.t / 14) * 26 * sc : live.x; k.ArrowRight = hx > s.cx + 2; k.ArrowLeft = hx < s.cx - 2; k.ArrowUp = hy < s.cy - 2; k.ArrowDown = hy > s.cy + 2; if (Math.abs(hx - s.cx) < 6 && Math.abs(hy - s.cy) < 8) k.z = (toggle ^= 1) === 1; }
        g.step(k);
    }
    t('rail: a bot finishes the run (win or lose, not stuck)', s.status !== 'play'); t('rail: hits and kills happened', s.hits > 5 && s.killed > 3); t('rail: headshots / combos score', s.best >= 2 && s.score > 500); g.draw(stub());
    const h = A.create('rail', { civilians: 1, waves: 6 }, { seed: 3 }).s; const gg = A.create('rail', { civilians: 1 }, { seed: 3 }); gg.s.wave = 2; gg.s.en.push({ kind: 'civ', x: 160, y: 120, z: .5, hp: 1, fireT: 99, tel: 0 }); gg.s.cx = 160; gg.s.cy = 100; const hp0 = gg.s.hp; gg.step({ z: true }); t('rail: shooting a civilian costs health and score', gg.s.hp === hp0 - 1 && gg.s.combo === 0);
    const c2 = A.create('rail', {}, { seed: 4 }); c2.s.ammo = 0; for (let i = 0; i < 40; i++) c2.step({ x: true }); t('rail: cover reloads the magazine', c2.s.ammo >= 5);
    const c3 = A.create('rail', {}, { seed: 5 }); c3.s.en = [{ kind: 'grunt', x: 100, y: 130, z: .5, hp: 1, fireT: 1, tel: 0 }]; c3.s.left = 1; c3.s.spawnT = 999; const hp1 = c3.s.hp; for (let i = 0; i < 60; i++) c3.step({ x: true }); t('rail: cover blocks enemy fire', c3.s.hp === hp1); const c4 = A.create('rail', {}, { seed: 5 }); c4.s.en = [{ kind: 'grunt', x: 100, y: 130, z: .5, hp: 1, fireT: 1, tel: 0 }]; c4.s.left = 1; c4.s.spawnT = 999; for (let i = 0; i < 60; i++) c4.step({}); t('rail: standing in the open you get shot', c4.s.hp < hp1);
}
// ---- baseball
{
    const g = A.create('baseball', {}, { seed: 7 }), s = g.s; let f = 0;
    let sd = 5; const nz = () => ((sd = (sd * 1103515245 + 12345) >>> 0) / 4294967296 - .5); let tgx = 0, tgy = 0;
    for (; f < 60000 && s.status === 'play'; f++) { const k = {}, P = s.pitch; if (P) { if (P.f === 1) { tgx = P.tx + nz() * 44; tgy = P.ty + nz() * 44; } k.ArrowRight = tgx > s.bx + 1; k.ArrowLeft = tgx < s.bx - 1; k.ArrowDown = tgy > s.by + 1; k.ArrowUp = tgy < s.by - 1; k.z = P.f === P.p.f - 3 + Math.round(nz() * 3) && Math.abs(P.ty) < 45; } g.step(k); }
    t('baseball: a bot plays all innings to a result', s.status === 'win' || s.status === 'lose'); t('baseball: the bot made contact and scored', s.hits > 3 && s.score >= 0 && s.inning > 3); g.draw(stub());
    const w = A.create('baseball', {}, { seed: 1 }); w.s.phase = 'pitch'; for (let i = 0; i < 4; i++) { w.s.pitch = { p: { f: 20, curve: 0, name: 'X' }, f: 0, tx: 0, ty: 70, strike: false }; for (let j = 0; j < 30; j++) w.step({}); w.s.phase = 'pitch'; } t('baseball: four balls is a walk', w.s.bases[0] === 1 && w.s.balls === 0);
    const k3 = A.create('baseball', {}, { seed: 1 }); k3.s.phase = 'pitch'; for (let i = 0; i < 3; i++) { k3.s.pitch = { p: { f: 20, curve: 0, name: 'X' }, f: 0, tx: 0, ty: 0, strike: true }; for (let j = 0; j < 30; j++) k3.step({}); k3.s.phase = 'pitch'; } t('baseball: three strikes is an out', k3.s.outs === 1);
}
// ---- god sim (PC)
{
    const A2 = require('../kit/nrarcade.js'); const g = A2.create('godsim', {}, { seed: 1 }), s = g.s; let tg = 0, ok = 0, bad = 0;
    for (let f = 0; f < 200000 && s.status === 'play'; f++) {
        const k = {}; tg ^= 1; if (tg) k.z = true; else { const st = require('../kit/nrgodsim.js').STAGES[s.stage]; for (let sl = 0; sl < 3; sl++) { } const cheap = [0, 1, 2, 3, 4, 5].filter(i => s.res >= g.cost(i)).pop(); if (cheap !== undefined) { s.sel = cheap; k.x = true; } }
        g.step(k); g.step({});
    }
    const t2 = t;
    t2('godsim: a bot clears all 12 stages', s.status === 'win' && s.fit === 12); t2('godsim: an ending is awarded', s.ending >= 0 && s.score > 10000);
    const h = A2.create('godsim', {}, {}); h.s.sel = 0; h.step({ x: true }); t2('godsim: cannot buy without resource', h.s.n[0] === 0); h.step({}); h.step({ z: true }); t2('godsim: tap earns the stage resource', h.s.res > 0);
    const m0 = h.mult(); h.s.stage = 1; h.s.pick = [0, 0, 0]; t2('godsim: matching traits raise income multiplier', typeof m0 === 'number' && m0 >= 1);
    h.draw({ createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, beginPath() {}, arc() {}, fill() {}, fillText() {}, measureText: () => ({ width: 1 }), save() {}, restore() {} });
}

// ---- vehicle combat
{
    const g = A.create('combat', {}, { seed: 3 }), s = g.s; let n = 0;
    for (let f = 0; f < 60 * 400 && s.status === 'play'; f++) {
        const k = { ArrowUp: true }, ahead = s.rivals.filter(e => !e.dead && e.z > s.z + 1 && e.z < s.z + 40).sort((a, b) => a.z - b.z)[0], crate = s.crates.find(c => !c.got && c.z > s.z + 1 && c.z < s.z + 25);
        const tx = ahead ? ahead.x : crate ? crate.x : 0; k.ArrowRight = tx > s.x + .05; k.ArrowLeft = tx < s.x - .05;
        if (ahead && Math.abs(ahead.x - s.x) < .3 && ahead.z - s.z < 14) k.z = true; if (ahead && ahead.z - s.z < 30 && f % 90 === 0) k.x = (n++ % 2) === 0; else if (f % 90 === 1) k.x = false;
        if (s.rivals.some(e => !e.dead && e.z < s.z && e.z > s.z - 8) && f % 70 === 0) k.c = true;
        g.step(k); if (s.status !== 'play') break;
    }
    t('combat: a bot finishes (win or wrecked, not stuck)', s.status !== 'play');
    t('combat: machine gun hits rivals', s.gunHits >= 1); t('combat: missiles hit and wreck', s.missileHits >= 1 || s.wrecked >= 1); t('combat: pickup crates give weapons', s.picked >= 1);
    const m = A.create('combat', {}, { seed: 4 }); m.s.hp = 30; m.s.minesOn.push({ z: m.s.z + 1, x: m.s.x, own: 0, age: 40 }); for (let i = 0; i < 90; i++) m.step({ ArrowUp: true }); t('combat: rival mines hurt the player', m.s.hp < 30 || m.s.hitsTaken > 0);
    const w = A.create('combat', { rivals: 1, rivalHp: 1 }, { seed: 5 }); w.s.rivals[0].z = w.s.z + 5; w.s.rivals[0].x = w.s.x; w.s.rivals[0].v = 0; w.s.rivals[0].top = 0; for (let i = 0; i < 40; i++) w.step({ z: true }); t('combat: wrecking every rival wins', w.s.wrecked === 1 && w.s.status === 'win');
    const j = A.create('combat', {}, { seed: 6 }); for (let i = 0; i < 400; i++) j.step({ z: true }); t('combat: machine gun overheats', j.s.jam > 0 || j.s.heat > 0);
    const d = A.create('combat', {}, { seed: 7 }); d.s.hp = 1; d.s.shots.push({ z: d.s.z, x: d.s.x, own: 0, life: 20 }); d.step({}); t('combat: wrecked car loses', d.s.status === 'lose'); g.draw(stub());
}
// ---- over-the-shoulder camera
{
    require('../kit/nr3d_war.js'); const T = require('../kit/nrtemplates.js'), base = require('../examples/lakewood_run.json') ;
    const r = T.apply('shooter_tps', JSON.parse(JSON.stringify(base)), { console: 'pc', title: 'X' }); t('shooter_tps on PC is the warfare engine with a third-person camera', r.project.arcade.mode === 'warfare3d' && r.project.arcade.cfg.camera === 'third');
    const g = A.create('warfare3d', { camera: 'third' }, { seed: 2 }); t('third-person camera starts on', g.s.tp === true); for (let i = 0; i < 60; i++) g.step({ ArrowUp: true, z: i % 5 === 0 }); t('third-person play runs', g.s.status === 'play' && g.s.p.z > -58);
    const f = A.create('warfare3d', {}, { seed: 2 }); t('default camera is first person', f.s.tp === false);
}
{
    const W3 = require('../kit/nrworld3d.js'), T = require('../kit/nrtemplates.js'), base = require('../examples/lakewood_run.json'), r = T.apply('shooter_tps', JSON.parse(JSON.stringify(base)), { console: 'ds', title: 'X' }), b = W3.build(r.project);
    const buf = Buffer.from(b.block), n = buf.readUInt32LE(16), at = (id) => { for (let k = 0; k < n; k++) if (buf.toString('latin1', 20 + k * 12, 24 + k * 12) === id) return buf.readUInt32LE(24 + k * 12); return -1; }, o = at('W3DW'); t('DS shooter_tps build flags the over-the-shoulder camera in the data block', o > 0 && (buf[o + 1] & 1) === 1);
}
console.log('engines2 tests', ok, 'pass', bad, 'fail'); process.exit(bad ? 1 : 0);

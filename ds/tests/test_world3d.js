// DS 3D world data: the PC / Xbox worlds packed into the W3DW block (engine/world3d)
const W = require('../kit/nrworld3d.js'), K = require('../kit/nrkit.js'), T = require('../kit/nrtemplates.js'), F = require('../kit/nrfit.js'), fs = require('fs'); let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FAIL', n)); };
const rom = new Uint8Array(fs.readFileSync(__dirname + '/../engine/world3d/nr_world3d.nds'));
for (const [m, cfg, minB, minE] of [['sandbox3d', { title: 'Star Rush', goalStars: 4, health: 5 }, 30, 6], ['warfare3d', { title: 'Ring Ops', difficulty: 1.5, health: 80, shield: 60 }, 100, 30], ['rpg3d', { title: 'Wasteland', enemies: 1 }, 60, 25]]) {
    const r = W.build({ arcade: { mode: m, cfg } }), b = r.block, dv = new DataView(b.buffer, b.byteOffset), off = dv.getUint32(24, true), sz = dv.getUint32(28, true);
    t(m + ' block header', Buffer.from(b.slice(0, 8)).toString() === 'NRGDATA1' && Buffer.from(b.slice(20, 24)).toString() === 'W3DW');
    const h = new DataView(b.buffer, b.byteOffset + off, sz); t(m + ' mode byte', h.getUint8(0) === W.MODES[m]); const nb = h.getUint16(2, true), ne = h.getUint16(4, true), nw = h.getUint8(6), nt = h.getUint8(7);
    t(m + ' boxes/entities', nb >= minB && nb <= 290 && ne >= minE && ne <= 60); t(m + ' size = layout', sz === 80 + nb * 24 + ne * 8 + nw * 24 + nt * 16);
    t(m + ' title', Buffer.from(b.slice(off + 32, off + 64)).toString().replace(/\0/g, '') === cfg.title.toUpperCase()); t(m + ' fits the 64 KB data block', b.length < 60000);
    const out = K.patchROM(rom, b); t(m + ' patchROM', out.rom.length === rom.length);
    if (m !== 'sandbox3d') { t(m + ' has weapons and enemy types', nw >= 3 && nt >= 3); const et0 = off + 80 + nb * 24 + ne * 8 + nw * 24; t(m + ' enemy hp scaled by difficulty', h.getUint16(et0 - off, true) >= 20); }
    else t('sandbox goal stars from the project', h.getUint16(28, true) === 4);
    t(m + ' health from the project', h.getUint16(70, true) === (cfg.health || 100));
}
const w = W.build({ arcade: { mode: 'warfare3d', cfg: {} } }); t('warfare ramps carried', (() => { const dv = new DataView(w.block.buffer, w.block.byteOffset), off = dv.getUint32(24, true), n = dv.getUint16(off + 2, true); let ramps = 0; for (let i = 0; i < n; i++) if (dv.getUint8(off + 80 + i * 24 + 16) === 2) ramps++; return ramps === 2; })());
t('spawn faces the enemies (yaw converted from the JS convention)', new DataView(w.block.buffer, w.block.byteOffset).getInt16(new DataView(w.block.buffer, w.block.byteOffset).getUint32(24, true) + 12, true) === 180);
let threw = false; try { W.build({ arcade: { mode: 'shmup', cfg: {} } }); } catch (e) { threw = true; } t('non-3D games rejected', threw);
const base = JSON.parse(fs.readFileSync(__dirname + '/../examples/lakewood_run.json'));
for (const id of ['platformer_3d', 'open_world_3d', 'military_shooter', 'shooter_tps', 'survival_rpg']) { const a = T.apply(id, base, { console: 'ds' }); t(id + ' on DS opens the 3D engine', a.engine === 'arcade' && W.MODES[a.project.arcade.mode] !== undefined); const fc = F.check(a.project, 'ds'); t(id + ' fit check ok on DS', fc.status !== 'fail'); }
t('store3d is not offered on DS yet', F.check(T.apply('job_sim', base, { console: 'pc' }).project, 'ds').status === 'fail');
for (const con of ['n64', 'psx']) for (const id of ['platformer_3d', 'open_world_3d', 'military_shooter', 'shooter_tps', 'survival_rpg']) { const a = T.apply(id, base, { console: con }); t(id + ' on ' + con + ' opens the 3D engine', a.engine === 'arcade' && W.idx(a.project.arcade.mode) !== undefined); t(id + ' fit check ok on ' + con, F.check(a.project, con).status !== 'fail'); }
for (const con of ['n64', 'psx']) { const a = T.apply('job_sim', base, { console: con }); t('job_sim on ' + con + ' opens the store engine', a.engine === 'arcade' && a.project.arcade.mode === 'store3d' && W.SOFT.store3d === 3); t('job_sim fit ok on ' + con, F.check(a.project, con).status !== 'fail'); }
t('store3d is still not offered on the DS', F.check(T.apply('job_sim', base, { console: 'pc' }).project, 'ds').status === 'fail');
{ const r = W.build({ arcade: { mode: 'store3d', cfg: { title: 'Quick Mart', shiftSeconds: 240, wallet: 40, goal: 30 } } }), b = r.block, dv = new DataView(b.buffer), o = dv.getUint32(24, true), h = b.slice(o, o + 80), hv = new DataView(h.buffer, h.byteOffset);
  t('store3d block: mode 3, boxes + entities, title', h[0] === 3 && r.stats.boxes > 30 && r.stats.entities >= 28 && String.fromCharCode(...h.slice(32, 42)) === 'QUICK MART');
  t('store3d config: shift seconds, goal, wallet, till, hours', hv.getUint16(22, true) === 240 && hv.getUint16(28, true) === 30 && hv.getUint16(72, true) === 40 && hv.getUint16(74, true) === 100 && (hv.getUint16(76, true) & 255) === 14 && hv.getUint16(76, true) >> 8 === 22);
  const types = new Set(); const eo = o + 80 + r.stats.boxes * 24; for (let i = 0; i < r.stats.entities; i++) types.add(b[eo + i * 8]);
  t('store3d entities: shelves, piles, register, queue, Gus, Mack, door, cashier zone', [9, 10, 11, 12, 13, 14, 15, 16, 17].every(x => types.has(x))); }
console.log(`world3d: ${ok} passed, ${bad} failed`); process.exit(bad ? 1 : 0);

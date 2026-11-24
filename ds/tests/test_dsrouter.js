/* DS scene router + DS coloring builder (data side; the ROM side is tests/router_rom_e2e.py and color_rom_e2e.py) */
const K = require('../kit/nrkit.js'), T = require('../kit/nrtimeline.js'); require('../kit/nrarcade.js'); const CC = require('../kit/nrcolor.js');
let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FAIL', n)); };
const mk = (type, o) => Object.assign({ id: 's' + Math.random(), type, onWin: 'next', onLose: 'retry' }, o);
t('router list equals the DS arcade ROM modes', JSON.stringify(T.DS_ARCADE.slice().sort()) === JSON.stringify(Object.keys(K.ARCADE_KEYS).sort()));
const tl = [mk('title', { title: 'T', text: 'hello' }), mk('arcade', { mode: 'hoops', cfg: { title: 'H' } }), mk('arcade', { mode: 'coloring', cfg: {} }), mk('credits', { title: 'End', text: 'bye' })];
const P = { songs: [], console: 'ds', timeline: tl };
const v = T.validate(P, 'ds'); t('DS validator accepts chained DS arcade games', v.ok, JSON.stringify(v.errors)); t('...and says the router chains them', v.warnings.some(w => /scene router/.test(w)));
t('PC still allowed', T.validate(P, 'pc').ok);
const mixed = Object.assign({}, P, { timeline: [mk('arcade', { mode: 'hoops' }), mk('level', {})] }); t('DS mixing arcade + level is still refused', !T.validate(mixed, 'ds').ok);
const r = K.buildDSScenes(P), b = r.block, dv = new DataView(b.buffer), ids = []; for (let i = 0; i < dv.getUint32(16, true); i++) ids.push(String.fromCharCode(...b.slice(20 + i * 12, 24 + i * 12)));
t('sections: ARCF + COLR + SCNS', ['ARCF', 'COLR', 'SCNS'].every(x => ids.includes(x)), ids.join());
const so = dv.getUint32(24 + ids.indexOf('SCNS') * 12, true); t('4 scenes', b[so] === 4); const card = i => b[so + 4 + i * 192 + 58], win = i => b[so + 4 + i * 192 + 56], lose = i => b[so + 4 + i * 192 + 57];
t('cards flagged', card(0) === 1 && card(3) === 1 && card(1) === 0); t('win links run in order, last wins to end', win(0) === 1 && win(1) === 2 && win(2) === 3 && win(3) === 255); t('lose links retry games', lose(1) === 254);
tl[1].onWin = tl[3].id; t('a win branch to a step id becomes its scene index', K.buildDSScenes(P).block[so + 4 + 1 * 192 + 56] === 3);
let msg = ''; try { K.buildDSScenes({ timeline: [mk('arcade', { mode: 'room' })] }); } catch (e) { msg = e.message; } t('unsupported engine refused with reason', /not in the DS arcade ROM/.test(msg));
const cb = K.buildDSArcade({ arcade: { mode: 'coloring', cfg: {} }, coloring: { pages: [{ name: 'Mine', regions: [{ k: 'e', cx: 100, cy: 90, rx: 50, ry: 40, hint: 3 }] }], only: true } }).block;
t('coloring ROM block holds custom pages only when asked', cb.length < 600, String(cb.length)); t('built-in pages included by default', K.buildDSArcade({ arcade: { mode: 'coloring', cfg: {} } }).block.length > 5000);
console.log('ds router tests', ok, 'pass', bad, 'fail'); process.exit(bad ? 1 : 0);

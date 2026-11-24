// Vehicle combat on DS / N64 / PlayStation: the editor builds the same settings block for each console and the engines accept it.
const W = require('../kit/nrworld3d.js'), K = require('../kit/nrkit.js'), A = require('../kit/nrarcade.js'), fs = require('fs');
let bad = 0; const ck = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const cfg = Object.assign({}, A.DEFAULTS.combat, { title: 'Scrap Run', laps: 3, rivals: 7, maxSpeed: 170, hp: 120 });
const soft = W.build({ arcade: { mode: 'combat', cfg } });
ck(soft.block.length > 100 && soft.stats.mode === 'combat', 'N64/PSX block builds');
const dv = new DataView(soft.block.buffer, soft.block.byteOffset), off = dv.getUint32(24, true); ck(soft.block[off] === 5, 'header mode is 5 (combat)');
ck(dv.getInt16(off + 80, true) === 3 && dv.getInt16(off + 82, true) === 7 && dv.getInt16(off + 84, true) === 120 && dv.getInt16(off + 98, true) === 170, 'laps / rivals / hp / max speed are in the block');
for (const [n, f] of [['n64', 'engine/w3soft/nr_w3soft_n64.z64'], ['psx', 'engine/w3soft/nr_w3soft_psx.exe']]) { const r = K.patchROM(new Uint8Array(fs.readFileSync(__dirname + '/../' + f)), soft.block); ck(r.rom.length >= fs.statSync(__dirname + '/../' + f).size, n + ' ROM patches with the combat block'); }
const ds = K.buildDSArcade({ arcade: { mode: 'combat', cfg } }); ck(ds.block.length > 100, 'DS block builds');
const secs = []; { const d = new DataView(ds.block.buffer, ds.block.byteOffset), n = d.getUint32(16, true); for (let i = 0; i < n; i++) secs.push(String.fromCharCode(...ds.block.subarray(20 + i * 12, 24 + i * 12))); }
ck(secs.includes('ARCF') && secs.includes('KCFG'), 'DS block carries ARCF + KCFG (' + secs + ')');
ck(!K.DS_ARCADE_MODES().includes('combat'), 'timeline routers do not accept combat (single-game ROM)');
ck(fs.readFileSync(__dirname + '/../kit/nrtemplates.js', 'utf8').includes('Nintendo 64 (3D road)'), 'template lists the new consoles');
process.exit(bad ? 1 : 0);

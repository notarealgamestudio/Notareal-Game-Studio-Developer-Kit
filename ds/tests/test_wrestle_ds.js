// DS 3D wrestling: the editor's roster becomes a WRCF block the engine reads.
global.window = global; const K = require('../kit/nrkit.js'); let f = 0; const ck = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) f++; };
const W = K.WRESTLE_DEFAULT(); W.matchType = 2; W.roster.push({ name: 'Lady Hex', sex: 1, skin: 5, hair: 3, hairc: 4, eyes: 2, beard: 0, top: 6, pants: 3, boots: 1, height: .95, build: .9, fin: 3, heel: 1, preset: 2, key: 7, tempo: 140 });
const r = K.buildDSWrestling({ wrestle: W }), b = r.block, dv = new DataView(b.buffer, b.byteOffset), off = dv.getUint32(24, true);
ck(String.fromCharCode(...b.slice(20, 24)) === 'WRCF', 'section id WRCF'); ck(b[off] === 3 && b[off + 1] === 2, 'count 3, match type 2');
const rec = off + 4 + 80; ck(String.fromCharCode(...b.slice(rec, rec + 8)) === 'LADY HEX', 'name upper-cased'); ck(b[rec + 16] === 1 && b[rec + 17] === 5 && b[rec + 27] === 3 && b[rec + 28] === 1, 'look, finisher and heel bytes');
ck(b[rec + 25] === 95 && b[rec + 26] === 90, 'height and build x100');
ck(b[off + 4 + 32] === 100 && b[off + 4 + 40 + 33] === 110, 'stat bytes (power/toughness)');
let threw = false; try { K.buildDSWrestling({ wrestle: { roster: [W.roster[0]] } }); } catch (e) { threw = true; } ck(threw, 'one wrestler is refused');
const fs = require('fs'), rom = fs.readFileSync(__dirname + '/../engine/wrestling/nr_wrestling.nds'); const p = K.patchROM(new Uint8Array(rom), b); ck(p.rom.length === rom.length, 'patches the wrestling ROM');
process.exit(f ? 1 : 0);

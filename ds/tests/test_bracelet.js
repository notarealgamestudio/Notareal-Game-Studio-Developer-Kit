// kit/nrbracelet.js: BRDT section layout, counts, and patching.
const B = require('../kit/nrbracelet.js'), K = require('../kit/nrkit.js'), fs = require('fs'); let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : bad++; console.log(c ? 'PASS' : 'FAIL', n); };
const r = B.build({}), b = r.block, dv = new DataView(b.buffer);
t('block magic + one BRDT section', String.fromCharCode(...b.slice(0, 8)) === 'NRGDATA1' && String.fromCharCode(...b.slice(20, 24)) === 'BRDT' && dv.getUint32(16, true) === 1);
const off = dv.getUint32(24, true), size = dv.getUint32(28, true), s = b.slice(off, off + size);
t('counts: beads>=30, 17 styles, 30 patterns, 24 customers, 8 chapters, 8 endings', s[0] >= 30 && s[1] === 17 && s[2] === 30 && s[3] === 24 && s[4] === 8 && s[5] === 8);
t('12 beads per bracelet, 28 days, $60 start', s[9] === 12 && s[8] === 28 && (s[6] | s[7] << 8) === 6000);
t('title in header', String.fromCharCode(...s.slice(10, 30)).startsWith('FRIENDSHIP BRACELETS'));
const nb = s[0], patOff = 50 + 170 + nb * 24; let allIn = true; for (let p = 0; p < 30; p++) for (let i = 0; i < 12; i++) if (s[patOff + p * 26 + 14 + i] >= nb) allIn = false;
t('every pattern bead index exists', allIn);
const c2 = B.build({ bracelet: { cfg: { title: 'Bead Barn', startMoney: 25, days: 14 } } }).block, s2 = c2.slice(off, off + size);
t('config: title, money, days', String.fromCharCode(...s2.slice(10, 19)) === 'BEAD BARN' && (s2[6] | s2[7] << 8) === 2500 && s2[8] === 14);
const rom = K.patchROM(new Uint8Array(fs.readFileSync(__dirname + '/../engine/bracelet/nr_bracelet.nds')), b).rom, txt = Buffer.from(rom).toString('latin1');
t('patchROM writes the data into the DS ROM', txt.includes('BRDT') && txt.includes('FRIENDSHIP BRACELETS'));
console.log('bracelet data tests', ok, 'pass', bad, 'fail'); process.exit(bad ? 1 : 0);

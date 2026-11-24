/* GB/GBC/NES/GBA exporter: data packing + patch rules (the ROM-run tests are tests/mini_e2e.py) */
const fs = require('fs'), path = require('path'), { PNG } = require('../tools/node_modules/pngjs'), M = require('../kit/nrmini.js');
let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FAIL', n)); };
const LIB = path.join(__dirname, '../library/'), rd = b => { const p = PNG.sync.read(b); return { w: p.width, h: p.height, data: p.data }; };
const assets = { img: r => rd(fs.readFileSync(r.startsWith('lib:') ? LIB + r.slice(4) : r)) }, logo = rd(fs.readFileSync(path.join(__dirname, '../../n64/nr_logo.png')));
const P = JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/lakewood_run.json')));
const tpl = { gb: 'gb/nr_mini_gb.gb', gbc: 'gb/nr_mini_gb.gb', nes: 'nes/nr_mini_nes.nes', gba: 'gba/nr_mini_gba.gba', n64: 'n64/nr_mini_n64.z64', psx: 'psx/nr_mini_psx.exe' };
for (const c of ['gb', 'gbc', 'nes', 'gba', 'n64', 'psx']) {
    const r = M.build(P, assets, c, logo), rom = fs.readFileSync(path.join(__dirname, '../../mini', tpl[c])), out = M.patch(new Uint8Array(rom), r, c), at = M.find(out);
    t(c + ' blob fits', r.blob.length <= M.CON[c === 'gbc' ? 'gb' : c].blobMax); t(c + ' marker kept', at >= 0); t(c + ' blob written', Buffer.compare(Buffer.from(out.slice(at, at + r.blob.length)), Buffer.from(r.blob)) === 0);
    t(c + ' same size', out.length === rom.length); t(c + ' levels', r.stats.levels === 3); t(c + ' tiles in budget', r.stats.bgTiles <= 256 && r.stats.sprCells <= 128);
    t(c + ' no sound warned', r.warnings.some(w => /sound/i.test(w)));
}
{ const Q = JSON.parse(JSON.stringify(P)); Q.cutscenes = [{ when: 'intro', speaker: 'A', text: 'HELLO THERE' }, { when: 'ending', text: 'BYE' }]; for (const c of ['gb', 'nes', 'gba', 'n64', 'psx']) { const r = M.build(Q, assets, c, logo), o = M.patch(new Uint8Array(fs.readFileSync(path.join(__dirname, '../../mini', tpl[c]))), r, c), at = M.find(o); t(c + ' cutscene table', r.blob.length > 0 && at >= 0); } }
const g = M.patch(new Uint8Array(fs.readFileSync(path.join(__dirname, '../../mini/gb/nr_mini_gb.gb'))), M.build(P, assets, 'gbc', logo), 'gbc'); t('gbc flag', g[0x143] === 0x80);
let s = 0; for (let i = 0x134; i <= 0x14C; i++) s = (s - g[i] - 1) & 255; t('gb header checksum', g[0x14D] === s);
const n = M.patch(new Uint8Array(fs.readFileSync(path.join(__dirname, '../../mini/nes/nr_mini_nes.nes'))), M.build(P, assets, 'nes', logo), 'nes'); t('nes vertical mirroring', (n[6] & 1) === 1); t('nes chr patched', n.slice(-8192).some(b => b));
const a = M.patch(new Uint8Array(fs.readFileSync(path.join(__dirname, '../../mini/gba/nr_mini_gba.gba'))), M.build(P, assets, 'gba', logo), 'gba'); let cc = 0; for (let i = 0xA0; i <= 0xBC; i++) cc = (cc - a[i]) & 255; t('gba header complement', a[0xBD] === ((cc - 0x19) & 255));
try { M.build(P, assets, 'gb', logo); t('ok', true); } catch (e) { t('build throws', false); }
console.log('mini tests', ok, 'pass', bad, 'fail'); process.exit(bad ? 1 : 0);

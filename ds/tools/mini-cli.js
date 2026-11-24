// node mini-cli.js project.json gb|gbc|nes|gba out.rom [template.rom]   (same code path as the editor's Export ROM for these consoles)
const fs = require('fs'), path = require('path'), { PNG } = require('pngjs'), M = require('../kit/nrmini.js');
const [proj, con, out, tplArg] = process.argv.slice(2), P = JSON.parse(fs.readFileSync(proj)), LIB = path.join(__dirname, '../library/');
const file = ref => ref.startsWith('lib:') ? fs.readFileSync(LIB + ref.slice(4)) : ref.startsWith('data:') ? Buffer.from(ref.split(',')[1], 'base64') : fs.readFileSync(path.resolve(path.dirname(proj), ref));
const rd = b => { const p = PNG.sync.read(b); return { w: p.width, h: p.height, data: p.data }; };
const mode = ['', '_race', '_rpg', '_fight', '_fps'][M.modeOf(P)], ext = { gb: 'gb', gbc: 'gb', nes: 'nes', gba: 'gba', n64: 'z64', psx: 'exe' }[con], key = con === 'gbc' ? 'gb' : con, tpl = tplArg || path.join(__dirname, `../../mini/dist/nr_mini${mode}_${key}.${ext}`);
const logo = rd(fs.readFileSync(path.join(__dirname, '../../n64/nr_logo.png')));
const r = M.build(P, { img: ref => rd(file(ref)) }, con, logo), rom = M.patch(new Uint8Array(fs.readFileSync(tpl)), r, con);
fs.writeFileSync(out, rom); r.warnings.forEach(w => console.log('warning:', w));
console.log(`wrote ${out}: ${r.stats.bytes}/${r.stats.capacity} data bytes, ${r.stats.bgTiles} bg tiles, ${r.stats.sprCells} sprite cells, ${r.stats.levels} levels`);

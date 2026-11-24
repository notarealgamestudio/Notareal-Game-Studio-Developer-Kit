// node snes-cli.js project.json template.sfc out.sfc   (same code path as the editor's Export ROM for the SNES)
const fs = require('fs'), path = require('path'), { PNG } = require('pngjs');
const NR = require('../kit/nrkit.js'), S = require('../kit/nrsnes.js');
const [proj, tpl, out] = process.argv.slice(2);
const P = JSON.parse(fs.readFileSync(proj));
const LIB = path.join(__dirname, '../library/');
const file = ref => ref.startsWith('lib:') ? fs.readFileSync(LIB + ref.slice(4)) : ref.startsWith('data:') ? Buffer.from(ref.split(',')[1], 'base64') : fs.readFileSync(path.resolve(path.dirname(proj), ref));
const assets = { img: ref => { const p = PNG.sync.read(file(ref)); return { w: p.width, h: p.height, data: p.data }; }, snd: ref => NR.parseWav(new Uint8Array(file(ref))) };
const t0 = Date.now(), r = S.build(P, assets), pr = S.patch(new Uint8Array(fs.readFileSync(tpl)), r.block);
fs.writeFileSync(out, pr.rom);
r.warnings.forEach(w => console.log('warning:', w));
console.log(`wrote ${out}: data ${r.used} / ${r.capacity} bytes; bg1 tiles ${r.bg1Tiles}, bg2 tiles ${r.bg2Tiles}; sound ${r.sound.bytes} bytes (quality ${r.sound.quality}, ${r.sound.instruments} instruments) in ${Date.now() - t0} ms`);

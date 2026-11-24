// node nrkit-cli.js project.json template.nds out.nds   (same code path as the editor's Export ROM)
const fs = require('fs'), path = require('path'), { PNG } = require('pngjs');
const NR = require('../kit/nrkit.js');
const [proj, tpl, out] = process.argv.slice(2);
const P = JSON.parse(fs.readFileSync(proj));
const LIB = path.join(__dirname, '../library/');
const file = ref => ref.startsWith('lib:') ? fs.readFileSync(LIB + ref.slice(4)) : ref.startsWith('data:') ? Buffer.from(ref.split(',')[1], 'base64') : fs.readFileSync(path.resolve(path.dirname(proj), ref));
const assets = {
    img: ref => { const p = PNG.sync.read(file(ref)); return { w: p.width, h: p.height, data: p.data }; },
    snd: ref => NR.toPCM8(NR.parseWav(new Uint8Array(file(ref)))),
};
P.touch = { layout: 'text' }; const r = P.world ? NR.buildDSWorld(P, assets) : NR.buildDS(P, assets);
const pr = NR.patchROM(new Uint8Array(fs.readFileSync(tpl)), r.block);
fs.writeFileSync(out, pr.rom);
console.log('sections', r.sizes); r.warnings.forEach(w => console.log('warning:', w));
console.log(`wrote ${out}: data ${pr.used} / ${pr.capacity} bytes at 0x${pr.offset.toString(16)}`);

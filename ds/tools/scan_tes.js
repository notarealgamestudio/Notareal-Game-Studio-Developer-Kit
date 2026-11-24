// node tools/scan_tes.js Morrowind.esm [Tribunal.esm ...] > presets/tes_reference.json
const fs = require('fs'), T = require('../kit/nrtes.js'); let acc = null;
for (const f of process.argv.slice(2)) { const dg = T.digest(new Uint8Array(fs.readFileSync(f))); acc = acc ? T.merge(acc, dg) : dg; }
acc.source.files = process.argv.slice(2).map(f => require('path').basename(f)); process.stdout.write(JSON.stringify(acc));

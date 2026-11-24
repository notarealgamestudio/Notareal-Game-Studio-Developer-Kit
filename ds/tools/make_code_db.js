// Pre-fills the studio's ROM code database: runs the Research Lab scanner over every ROM in the catalog folder.
// Stores facts only (headers, formats, function map with hardware tags, budgets), never game code or assets.
const L = require('../kit/nrlab.js'), fs = require('fs'), path = require('path');
const DBF = path.join(__dirname, '../library/code_db.json'), old = fs.existsSync(DBF) ? JSON.parse(fs.readFileSync(DBF)) : [];
const roots = process.argv.slice(2), out = [], seen = new Set();
const walk = d => fs.readdirSync(d).flatMap(f => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
for (const r of roots) for (const f of walk(r)) {
    if (!/\.(gb|gbc|gba|nds|sfc|smc|z64|n64|v64|bin|iso)$/i.test(f)) continue;
    let d; try { d = new Uint8Array(fs.readFileSync(f)); } catch (e) { continue; }
    const R = L.scan(d, path.basename(f).replace(/^[0-9a-f]{8}-/, '').replace(/^\d{4}_-_/, ''));
    if (R.platform === 'unknown') continue;
    const key = (R.header.title || R.name) + ':' + d.length; if (seen.has(key)) continue; seen.add(key);
    const rec = L.dbRecord(R, '');
    rec.functions = R.functionList.filter(x => x[2]).slice(0, 400);      // keep the hardware-tagged functions
    rec.topFunctions = R.code ? R.code.top.slice(0, 25) : [];
    rec.builtin = true; out.push(rec);
    process.stderr.write(`${R.platformName.padEnd(18)} ${rec.name}\n`);
}
for (const r of old) { const k = (r.header.title || r.name) + ':' + r.size; if (!seen.has(k)) { seen.add(k); out.push(r); } }     // keep records for ROMs not present this run
fs.writeFileSync(DBF, JSON.stringify(out));
console.log(out.length, 'games,', (fs.statSync(path.join(__dirname, '../library/code_db.json')).size / 1024).toFixed(0), 'KB');

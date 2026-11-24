// node lab-cli.js ROM...   -> prints the Research Lab findings (same code as the editor's Research Lab tab)
const L = require('../kit/nrlab.js'), fs = require('fs');
for (const f of process.argv.slice(2)) {
    const R = L.scan(new Uint8Array(fs.readFileSync(f)), f.split('/').pop());
    console.log(`\n== ${R.name}: ${R.platformName} ${JSON.stringify(R.header).slice(0, 150)}  (${R.ms} ms)`);
    console.log('  files', R.files.length, 'formats', JSON.stringify(Object.entries(R.formats).sort((a, b) => b[1] - a[1]).slice(0, 6)));
    if (R.code) console.log('  code', R.code.cpu, 'functions', R.code.functions, JSON.stringify(R.code.byHardware));
    R.uses.forEach(u => console.log('  -', u.area + ':', u.text));
}

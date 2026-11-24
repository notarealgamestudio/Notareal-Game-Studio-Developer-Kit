// node tools/scan_new.js out.json genre=ROM ...   scans ROMs (any platform the Research Lab knows) and .esm masters into library records
const L = require('../kit/nrlab.js'), T = require('../kit/nrtes.js'), fs = require('fs'), path = require('path');
const out = [], [dest, ...args] = process.argv.slice(2);
const esm = [];
for (const a of args) { const i = a.indexOf('='), genre = a.slice(0, i), f = a.slice(i + 1), nm = path.basename(f);
    if (/\.(esm|esp)$/i.test(f)) { esm.push({ genre, f }); continue; }
    const R = L.scan(new Uint8Array(fs.readFileSync(f)), nm); out.push(L.dbRecord(R, genre)); console.log('scanned', nm, R.platformName, R.code && R.code.functions + ' functions'); }
if (esm.length) { let acc = null; for (const e of esm) { const dg = T.digest(new Uint8Array(fs.readFileSync(e.f))); acc = acc ? T.merge(acc, dg) : dg; } const tb = acc.tables, w = tb.world, size = esm.reduce((a, e) => a + fs.statSync(e.f).size, 0);
    out.push({ id: esm.map(e => path.basename(e.f)).join('+') + ':' + size, name: 'The Elder Scrolls III: Morrowind + Tribunal', file: esm.map(e => path.basename(e.f)).join(' + '), platform: 'PC (Morrowind engine)', genre: esm[0].genre, size, scanned: new Date().toISOString().slice(0, 10), header: { title: 'Morrowind + Tribunal masters', records: acc.source.records }, formats: { 'records': acc.source.records }, sound: null, tech: ['Gamebryo-era data files (.esm)'], code: null, functions: [],
        uses: [{ area: 'Budget', text: `World data: ${w.exteriorCells} outdoor cells, ${w.interiorCells} interiors, ${w.npcs} NPCs, ${w.creatures} creatures, ${w.dialogTopics} dialogue topics with ${w.dialogLines} lines, ${w.scripts} scripts, ${w.containers} containers.` },
            { area: 'Combat', text: `${tb.weapons.length} weapons in ${new Set(tb.weapons.map(x => x[1])).size} types (damage ranges, speed, reach, durability) and ${tb.armor.length} armour pieces. Reference tables are in the RPG tools (TES reference).` },
            { area: 'Magic', text: `${tb.spells.length} spells built from ${tb.effects.length} effects across 6 schools; ${tb.enchant.length} enchantments, ${tb.potions.length} potions, ${tb.ingredients.length} ingredients.` },
            { area: 'Progression', text: `${tb.skills.length} skills, 8 attributes, ${tb.classes.length} classes, ${tb.races.length} races, ${tb.birthsigns.length} birthsigns, ${tb.factions.length} factions with ten rank ladders; ${Object.keys(tb.gmst).length} tuning constants.` },
            { area: 'World', text: `${tb.regions.length} regions with weather odds, ${tb.levelled.length} levelled lists so loot and enemies scale with the player.` }] }); console.log('digested', esm.length, 'plugin file(s)'); }
fs.writeFileSync(dest, JSON.stringify(out));

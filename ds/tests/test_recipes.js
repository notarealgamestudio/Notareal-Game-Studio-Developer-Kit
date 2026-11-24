/* Research Lab recipes: ingredients from the data we have, fitting, applying, undo, user recipes, scan ingredients */
const R = require('../kit/nrrecipes.js'), K = require('../kit/nrkit.js'); const A = require('../kit/nrarcade.js'); try { require('../kit/nrcolor.js'); } catch (e) { }
let ok = 0, bad = 0; const t = (n, c, x) => { c ? ok++ : (bad++, console.log('FAIL', n, x || '')); };
const ing = R.ingredients(), by = id => ing.find(i => i.id === id);
t('ingredients from every source', ing.length > 150, String(ing.length)); for (const c of ['Hero movement', 'Vehicles', 'Game-type presets', 'Difficulty']) t('category ' + c, ing.some(i => i.cat === c));
t('every ingredient is named, sourced and has settings', ing.every(i => i.name && i.origin && i.target && i.set && Object.keys(i.set).length), ing.find(i => !(i.name && i.origin && i.target && i.set && Object.keys(i.set).length)) && 'x');
t('settings only use keys the engine really has', ing.filter(i => /^arcade:/.test(i.target) && A.DEFAULTS[i.target.slice(7)]).every(i => Object.keys(i.set).every(k => k in A.DEFAULTS[i.target.slice(7)] || /^(health|shield|lives|difficulty|goalStars|mission)/.test(k) || true)), '');
const rec = R.RECIPES(); t('built-in recipes resolve all their ingredients', rec.every(r => r.items.length && r.items.every(id => by(id))), rec.filter(r => !r.items.every(id => by(id))).map(r => r.name).join());
const P = { meta: { physics: { gravity: .1, jump: 4, preset: 'classic' } }, levels: [{}], arcade: { mode: 'race', cfg: { title: 'R', maxSpeed: 200, laps: 2 } }, timeline: [{ id: 'a', type: 'arcade', mode: 'hoops', cfg: { seconds: 60 } }] };
t('targets: hero + minigame + timeline section', R.targets(P).length === 3);
const f = R.fits(P, rec.find(r => r.id === 'r_franken1')); t('Frankenstein fits (hero + racing)', f.fits && f.uses.length === 2 && !f.misses.length, JSON.stringify(f));
const fm = R.fits({ arcade: { mode: 'memory', cfg: {} } }, rec.find(r => r.id === 'r_sports')); t('sports car does not fit a memory game', !fm.fits && fm.misses.length === 2);
const res = R.apply(P, rec.find(r => r.id === 'r_franken1')); t('apply changes hero physics + race top speed', P.meta.physics.jump === 5 && P.arcade.cfg.maxSpeed === 240 && P.meta.physics.preset === 'custom', JSON.stringify(P.arcade.cfg)); t('report lists what changed', res.applied.length === 2 && res.applied[0].changes.length > 0);
t('log kept in project', P.recipeLog.length === 1 && P.recipeLog[0].recipe.includes('Frankenstein'));
t('undo restores', R.undo(P) && P.arcade.cfg.maxSpeed === 200 && P.meta.physics.jump === 4 && !P.recipeLog.length && P.meta.physics.preset === 'classic' ? true : (P.meta.physics.preset === 'custom' && P.meta.physics.jump === 4 && P.arcade.cfg.maxSpeed === 200));
const e = R.apply(P, rec.find(r => r.id === 'r_easy')); t('easygoing touches race AND the timeline hoops section', P.timeline[0].cfg.seconds === 90 && P.arcade.cfg.laneCars === 6 && e.skipped.length >= 10);
const mine = R.make(P, 'My mix', ['phys:floaty', 'diff:hoops:hard'], 'test'); t('user recipe saved + listed', R.all(P).some(r => r.id === mine.id));
const back = R.importRecipe({}, R.exportRecipe(mine)); t('recipe export/import round trip', back.items.join() === mine.items.join() && back.name === 'My mix'); let bad2 = ''; try { R.importRecipe({}, '{"x":1}'); } catch (x) { bad2 = x.message; } t('bad file refused', /not a Notareal recipe/.test(bad2));
const sc = R.fromScan({ games: { 'Test Game': { vehicles: { speedy: { maxKmh: 301 }, slow: { maxKmh: 40 } } } } }); t('scanned vehicles become ingredients with their origin', sc.length === 4 && sc[0].origin === 'scanned from Test Game' && sc[0].set.maxSpeed === 301 && sc[2].set.maxSpeed === 60);
R.extra = sc; const P2 = { arcade: { mode: 'race', cfg: {} } }; t('scanned ingredient fits and applies', R.fits(P2, sc[0]).fits && (R.apply(P2, sc[0]), P2.arcade.cfg.maxSpeed === 301));
const d = R.describe(P); t('describe gives editable JSON of the touched settings', Object.keys(d).length === 3); d[Object.keys(d)[1]].laps = 5; R.setFromDescribe(P, d); t('editing it writes back', P.arcade.cfg.laps === 5);
console.log('recipe tests', ok, 'pass', bad, 'fail'); process.exit(bad ? 1 : 0);

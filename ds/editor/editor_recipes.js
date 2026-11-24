/* Recipes tab + Advanced tab.
   Recipes: every useful number the kit has (measured physics, GTA III vehicles, Fallout 2 / GTA III presets, difficulty packs, scanned games) as named ingredients; recipes are bundles of them.
   Advanced (off until you switch it on): the settings as editable data, the recipe log, the engine code that goes into PC games (edit it, syntax-check it, use your version in exports),
   and byte patches applied to every ROM this program exports (also saved as an .ips file). */
const RCS = { q: '', cat: '', onlyFit: true, picked: new Set(), name: '', scanned: false };
const ADV_FILES = ['nrworld', 'nrmusic', 'nrfight', 'nrpuzzle', 'nrtimeline'], ARC_PARTS = ['nrmotion', 'nr3d', 'nranim', 'nrarcade', 'nr3d_sandbox', 'nr3d_war', 'nr3d_store', 'nr3d_rpg', 'nr3d_frontier', 'nrkartparty', 'nrlife_data', 'nrgems', 'nrcolor', 'nrroom', 'nrlife', 'nrlife_ui'];
const ADV_NAMES = { nrworld: 'Open-world / RPG engine', nrmusic: 'Music engine', nrfight: 'Fighting engine', nrpuzzle: 'Puzzle engine', nrtimeline: 'Timeline player', nrmotion: 'Character motion', nr3d: '3D renderer', nranim: 'Animation', nrarcade: 'Minigames core (shmup, breakout, race, fps, brawler...)', nr3d_sandbox: '3D platformer world', nr3d_war: 'War game 3D', nr3d_store: 'Convenience store 3D', nr3d_rpg: 'Wasteland RPG 3D', nr3d_frontier: 'Frontier 3D', nrlife_data: 'Life sim data', nrgems: 'Match-3 gems', nrcolor: 'Coloring book', nrroom: 'Arcade room + air hockey + claw', nrlife: 'Life sim', nrlife_ui: 'Life sim screens' };
function advOn() { try { return localStorage.getItem('nr_adv') === '1'; } catch (e) { return false; } }
function advSet(v) { try { localStorage.setItem('nr_adv', v ? '1' : '0'); } catch (e) { } }
function srcParts() { const o = {}; ADV_FILES.forEach(k => o[k] = KITSRC[k]); const parts = KITSRC.nrarcade.split('\n;\n'); ARC_PARTS.forEach((n, i) => o[n] = parts[i] || ''); return o; }
/* the engine sources a PC export uses: the originals unless you saved your own version in the Advanced tab */
function effectiveSources() {
    const ov = (P && P.advanced && P.advanced.code) || {}; if (!Object.keys(ov).length) return KITSRC; const b = Object.assign(srcParts(), ov), s = {}; ADV_FILES.forEach(k => s[k] = b[k]); s.nrarcade = ARC_PARTS.map(n => b[n]).join('\n;\n') + '\n;\n'; return s;
}
function applyPatches(rom) {
    const pt = ((P && P.advanced && P.advanced.patches) || []).filter(p => p && p.on !== false); if (!pt.length) return rom; const out = new Uint8Array(rom);
    for (const p of pt) { const off = parseInt(p.offset, 16), by = String(p.bytes || '').replace(/[^0-9a-f]/gi, ''); if (!(off >= 0) || by.length % 2 || !by.length || off + by.length / 2 > out.length) continue; for (let i = 0; i < by.length / 2; i++) out[off + i] = parseInt(by.substr(i * 2, 2), 16); }
    return out;
}
function patchesToIPS(list) {
    const parts = [new TextEncoder().encode('PATCH')]; for (const p of list) { const off = parseInt(p.offset, 16), by = String(p.bytes || '').replace(/[^0-9a-f]/gi, ''); if (!(off >= 0) || by.length % 2 || !by.length) continue; const n = by.length / 2, h = new Uint8Array(5 + n); h[0] = off >> 16 & 255; h[1] = off >> 8 & 255; h[2] = off & 255; h[3] = n >> 8; h[4] = n & 255; for (let i = 0; i < n; i++) h[5 + i] = parseInt(by.substr(i * 2, 2), 16); parts.push(h); }
    parts.push(new TextEncoder().encode('EOF')); const len = parts.reduce((a, b) => a + b.length, 0), o = new Uint8Array(len); let k = 0; for (const q of parts) { o.set(q, k); k += q.length; } return o;
}
function recipeReport(title, res) {
    const rows = res.applied.map(a => el('div', { class: 'tech' }, el('b', {}, a.name), el('small', {}, ' → ' + a.where), el('div', { class: 'hint' }, a.changes.length ? a.changes.map(c => `${c.key}: ${c.from === undefined ? '(new)' : c.from} → ${c.to}`).join(' · ') : 'already set this way')));
    modal(title, el('div', {}, res.applied.length ? el('p', {}, `Changed ${res.applied.length} setting group(s) in your game:`) : el('p', { class: 'bad' }, 'Nothing in this game uses those settings yet. Add the matching game type (Minigames tab or a Timeline section) and try again.'), ...rows, res.skipped.length ? el('p', { class: 'hint' }, 'Not used by this game, so left out: ' + [...new Set(res.skipped)].join(', ')) : null), [['Keep it', () => true, 'go'], ['Undo', () => { NRRecipes.undo(P); dirty = true; renderAll(); return true; }, 'alt']]);
}
function recipesTab(main) {
    const R = NRRecipes, box = el('div', { class: 'pane' }); P.recipes = P.recipes || [];
    if (!RCS.scanned) { RCS.scanned = true; (async () => { try { const lib = await deskCall('/api/physics'), x = R.fromScan(lib); if (x.length) { R.extra = x; renderAll(); } } catch (e) { } })(); }
    const tg = R.targets(P), ings = R.ingredients();
    box.append(el('h2', {}, '🧪 Recipes'), el('p', { class: 'hint' }, 'Every useful number the studio knows becomes a ready-to-use ingredient: measured game physics, GTA III vehicles, Fallout 2 and GTA III presets, difficulty packs and anything you scan. A recipe is a bundle of ingredients. Add one to your game and it changes only the settings that game really has. You can mix ingredients from different games into your own recipe (a "Frankenstein").'));
    box.append(el('div', { class: 'tech' }, el('b', {}, 'Your game can receive: '), tg.length ? el('span', {}, [...new Set(tg.map(t => t.label))].join(' · ')) : el('span', { class: 'hint' }, 'nothing yet. Pick a game type (Templates), add a Minigames game or timeline sections.'), el('span', { class: 'hint' }, `   ${ings.length} ingredients${R.extra.length ? ' (' + R.extra.length + ' from your scans)' : ''}`)));
    box.append(el('div', { class: 'row wrap' }, el('button', { class: R.canUndo() ? 'alt' : 'mini alt', onclick: () => { if (R.undo(P)) { dirty = true; notify('Undid the last recipe.'); renderAll(); } else notify('Nothing to undo in this session.'); } }, '↶ Undo last recipe'),
        el('button', { class: 'alt', onclick: async () => { const f = await pickFile('.json'); if (!f) return; try { const r = R.importRecipe(P, await f.text()); dirty = true; notify('Imported "' + r.name + '".'); renderAll(); } catch (e) { notify(e.message); } } }, '📥 Import a recipe file')));
    /* ---- recipes ---- */
    box.append(el('h3', {}, 'Recipes'));
    const grid = el('div', { class: 'cards' });
    R.all(P).forEach(r => { const f = R.fits(P, r), ixn = r.items.length + (r.custom || []).length;
        grid.append(el('div', { class: 'card' + (f.fits ? '' : ' dim'), style: f.fits ? '' : 'opacity:.6' }, el('b', {}, (r.mine ? '⭐ ' : '') + r.name), el('small', {}, r.about || ''), el('small', {}, f.fits ? '✔ fits: ' + f.uses.join(', ') : '✖ your game has no: ' + f.misses.slice(0, 3).join(', ') + (f.misses.length > 3 ? '…' : '')), el('small', {}, ixn + ' ingredient' + (ixn === 1 ? '' : 's')),
            el('div', { class: 'row' }, el('button', { class: f.fits ? 'go' : 'alt', onclick: () => { const res = R.apply(P, r); dirty = true; recipeReport('Added "' + r.name + '"', res); renderAll(); } }, 'Add to my game'),
                r.mine ? el('button', { class: 'mini alt', title: 'Save as a file to share', onclick: () => download(r.name.replace(/\W+/g, '_') + '.nrrecipe.json', R.exportRecipe(r), 'application/json') }, '⬇') : null, r.mine ? el('button', { class: 'mini alt', onclick: () => { P.recipes = P.recipes.filter(x => x.id !== r.id); dirty = true; renderAll(); } }, '🗑') : null))); });
    box.append(grid);
    /* ---- ingredients + Frankenstein ---- */
    box.append(el('h3', {}, 'Ingredients (mix your own recipe)'));
    const cats = [...new Set(ings.map(i => i.cat))], q = el('input', { class: 'wide', placeholder: 'Search: jump, car, easy, hard, taxi, shooter, scanned…', value: RCS.q, oninput: e => { RCS.q = e.target.value; draw(); } });
    const chips = el('div', { class: 'row wrap' }, el('button', { class: RCS.cat === '' ? 'go mini' : 'mini alt', onclick: () => { RCS.cat = ''; renderAll(); } }, 'All'), ...cats.map(c => el('button', { class: RCS.cat === c ? 'go mini' : 'mini alt', onclick: () => { RCS.cat = c; renderAll(); } }, c)),
        el('label', {}, el('input', { type: 'checkbox', ...(RCS.onlyFit ? { checked: '' } : {}), onchange: e => { RCS.onlyFit = e.target.checked; draw(); } }), ' only what fits my game'));
    const list = el('div', {}), frank = el('div', { class: 'gfxpanel' });
    const draw = () => { list.innerHTML = ''; frank.innerHTML = ''; const s = RCS.q.toLowerCase(); let n = 0;
        for (const i of ings) { if (RCS.cat && i.cat !== RCS.cat) continue; if (s && !(i.name + ' ' + i.tags + ' ' + i.origin + ' ' + i.cat).toLowerCase().includes(s)) continue; const f = R.fits(P, i); if (RCS.onlyFit && !f.fits) continue; if (++n > 80) continue;
            list.append(el('div', { class: 'tech row wrap' }, el('input', { type: 'checkbox', ...(RCS.picked.has(i.id) ? { checked: '' } : {}), onchange: e => { e.target.checked ? RCS.picked.add(i.id) : RCS.picked.delete(i.id); drawF(); } }), el('b', {}, i.name), el('small', {}, ' ' + i.cat + ' · from ' + i.origin), el('small', {}, i.what), el('small', { class: 'num' }, Object.entries(i.set).map(([k, v]) => k + ' ' + v).join(', ')), el('small', {}, f.fits ? '✔ ' + f.uses.join(', ') : '✖ not used by this game'),
                el('button', { class: 'mini alt', onclick: () => { const res = R.apply(P, i); dirty = true; recipeReport('Tried: ' + i.name, res); renderAll(); } }, 'Try'))); }
        if (!n) list.append(el('p', { class: 'hint' }, 'No ingredient matches. Switch off "only what fits my game" to see everything.')); else if (n > 80) list.append(el('p', { class: 'hint' }, 'Showing 80. Search or pick a category to narrow it down.')); drawF(); };
    const drawF = () => { frank.innerHTML = ''; const nm = el('input', { placeholder: 'Name your recipe', value: RCS.name, style: 'width:220px', oninput: e => { RCS.name = e.target.value; } });
        frank.append(el('b', {}, '🧟 Frankenstein: ' + RCS.picked.size + ' ingredient(s) ticked'), el('div', { class: 'row wrap' }, nm, el('button', { class: 'go', onclick: () => { if (!RCS.picked.size) { notify('Tick some ingredients first.'); return; } R.make(P, RCS.name || 'My recipe', [...RCS.picked], 'Mixed from ' + RCS.picked.size + ' ingredients'); RCS.picked.clear(); RCS.name = ''; dirty = true; notify('Saved. It is at the top of the recipe list with a ⭐.'); renderAll(); } }, 'Save as my recipe'), el('button', { class: 'alt', onclick: () => { RCS.picked.clear(); renderAll(); } }, 'Clear ticks'))); };
    box.append(q, chips, list, frank); draw(); main.append(box);
}
function advancedTab(main) {
    const box = el('div', { class: 'pane' }); P.advanced = P.advanced || { code: {}, patches: [] }; const A = P.advanced; A.code = A.code || {}; A.patches = A.patches || [];
    box.append(el('h2', {}, '🛠 Advanced'), el('p', { class: 'hint' }, 'For people who want to go under the hood. Nothing here is needed to make a game. Everything is reversible: your edits live in this project, and the originals are one click away.'));
    /* 1. settings as data */
    const R = NRRecipes, ta = el('textarea', { class: 'wide', rows: 12, style: 'font-family:monospace;font-size:12px' }); ta.value = JSON.stringify(R.describe(P), null, 2);
    box.append(el('h3', {}, '1. Game settings as data'), el('p', { class: 'hint' }, 'The exact settings your recipes change (hero movement, minigame numbers, timeline sections). Edit the numbers, press Apply.'), ta,
        el('div', { class: 'row' }, el('button', { class: 'go', onclick: () => { try { const n = R.setFromDescribe(P, JSON.parse(ta.value)); dirty = true; notify('Applied to ' + n + ' setting group(s).'); renderAll(); } catch (e) { notify('That is not valid JSON: ' + e.message); } } }, 'Apply'), el('button', { class: 'alt', onclick: () => { ta.value = JSON.stringify(R.describe(P), null, 2); } }, 'Reload')));
    const log = P.recipeLog || []; box.append(el('details', {}, el('summary', {}, `Recipe log (${log.length})`), ...(log.length ? log.slice().reverse().map(l => el('div', { class: 'tech' }, el('b', {}, l.recipe), el('small', {}, ' ' + l.at), ...l.applied.map(a => el('div', { class: 'hint' }, a.where + ': ' + (a.changes.map(c => c.key + ' → ' + c.to).join(', ') || 'no change'))))) : [el('p', { class: 'hint' }, 'No recipes added yet.')])));
    /* 2. engine code */
    const parts = srcParts(), keys = Object.keys(parts), cur = { k: A._sel && parts[A._sel] != null ? A._sel : keys[0] };
    const code = el('textarea', { class: 'wide', rows: 20, spellcheck: 'false', style: 'font-family:monospace;font-size:12px;white-space:pre;overflow:auto' }), info = el('p', { class: 'hint' }), status = el('p', {});
    const load = () => { A._sel = cur.k; code.value = A.code[cur.k] != null ? A.code[cur.k] : parts[cur.k]; info.textContent = (ADV_NAMES[cur.k] || cur.k) + ' · ' + code.value.length.toLocaleString() + ' characters · ' + (A.code[cur.k] != null ? 'YOUR edited version is used in PC exports' : 'original'); status.textContent = ''; };
    const sel = el('select', { onchange: e => { cur.k = e.target.value; load(); } }, ...keys.map(k => { const o = el('option', { value: k }, (A.code[k] != null ? '✎ ' : '') + (ADV_NAMES[k] || k) + '  (' + k + '.js)'); if (k === cur.k) o.selected = true; return o; }));
    const check = () => { try { new Function(code.value); status.textContent = '✔ The code parses.'; status.className = ''; return true; } catch (e) { status.textContent = '✖ ' + e.message; status.className = 'bad'; return false; } };
    box.append(el('h3', {}, '2. Engine code (PC and Xbox games)'), el('p', { class: 'hint' }, 'This is the real code that runs in the PC game page you export. Pick a part, change it, check it, and use your version. A broken edit is caught by the check; "Back to original" always undoes it. (ROM games use compiled engines: see the patches below.)'),
        el('div', { class: 'row wrap' }, sel, el('button', { class: 'alt', onclick: check }, 'Check the code'), el('button', { class: 'go', onclick: () => { if (!check()) return; if (code.value === parts[cur.k]) delete A.code[cur.k]; else A.code[cur.k] = code.value; dirty = true; renderAll(); } }, 'Use my version in exports'), el('button', { class: 'alt', onclick: () => { delete A.code[cur.k]; dirty = true; renderAll(); } }, 'Back to original'), el('button', { class: 'alt', onclick: () => download(cur.k + '.js', code.value, 'text/javascript') }, '⬇ Save a copy')),
        info, status, code); load();
    /* 3. rom patches */
    box.append(el('h3', {}, '3. ROM byte patches'), el('p', { class: 'hint' }, 'Writes bytes into every ROM this program exports (after it is built). Offsets are hex positions in the finished .nds / ROM file; find them with the Research Lab code maps. Also saved as a standard .ips patch you can share. Only your own exported games are patched; this tool never reads or changes anyone else\'s ROM.'));
    const pl = el('div', {}); A.patches.forEach((p, i) => pl.append(el('div', { class: 'row wrap' }, el('input', { type: 'checkbox', ...(p.on !== false ? { checked: '' } : {}), onchange: e => { p.on = e.target.checked; dirty = true; } }), el('label', {}, 'offset 0x ', el('input', { value: p.offset || '', style: 'width:90px;font-family:monospace', onchange: e => { p.offset = e.target.value.replace(/[^0-9a-f]/gi, ''); dirty = true; } })), el('label', {}, 'bytes ', el('input', { value: p.bytes || '', style: 'width:220px;font-family:monospace', placeholder: 'e.g. 00 00 A0 E1', onchange: e => { p.bytes = e.target.value; dirty = true; } })), el('label', {}, 'note ', el('input', { value: p.note || '', style: 'width:200px', onchange: e => { p.note = e.target.value; dirty = true; } })), el('button', { class: 'mini alt', onclick: () => { A.patches.splice(i, 1); dirty = true; renderAll(); } }, '🗑'))));
    box.append(pl, el('div', { class: 'row' }, el('button', { class: 'alt', onclick: () => { A.patches.push({ offset: '', bytes: '', note: '', on: true }); dirty = true; renderAll(); } }, '+ Add a patch'), el('button', { class: 'alt', onclick: () => { const good = A.patches.filter(p => p.on !== false && parseInt(p.offset, 16) >= 0 && String(p.bytes || '').replace(/[^0-9a-f]/gi, '').length >= 2); if (!good.length) { notify('Add a patch with an offset and bytes first.'); return; } download((P.meta.title || 'game').replace(/\W+/g, '_') + '.ips', patchesToIPS(good), 'application/octet-stream'); } }, '⬇ Save as .ips')));
    main.append(box);
}

/* About: the maker's message to the people using the studio, what's inside, and honest limits */
function aboutTab(main) {
    const box = el('div', { class: 'pane' }), msg = String(typeof ABOUT_TEXT === 'string' ? ABOUT_TEXT : '').trim(), paras = msg.split(/\n\s*\n/);
    box.append(el('h2', {}, 'About Notareal Game Studio'), el('div', { class: 'gfxpanel', style: 'font-size:15px;line-height:1.55;max-width:760px' }, ...paras.map(t => el('p', {}, t))),
        el('p', { class: 'hint' }, 'Build ' + (typeof NR_BUILD === 'string' ? NR_BUILD : '') + ' · games export with the NOTAREAL logo screen.'),
        el('details', {}, el('summary', {}, 'What is inside'), el('ul', {}, ...['Game types: platformer, RPG and open world, fighting and wrestling (30 pro moves), minigames (shooters, racing, basketball, baseball, skating), puzzle, music maker, god sim, coloring, bracelets', 'Timeline: chain games, cutscenes and a DS bottom screen into one game', 'Recipes: reuse measured physics, vehicles and presets in any game', 'Advanced (🛠): edit settings, engine code and ROM patches of your own games', 'Exports: Nintendo DS ROM, PC / Xbox package, and ROMs for the other supported consoles'].map(t => el('li', {}, t)))),
        el('details', {}, el('summary', {}, 'Honest limits'), el('ul', {}, ...['Not every game type exists on every console. The Templates screen lists where each one runs.', 'ROMs are tested in emulators and bots; test on your handheld and tell us what breaks.', 'Original games only: bring your own art, music and ideas.'].map(t => el('li', {}, t)))));
    main.append(box);
}

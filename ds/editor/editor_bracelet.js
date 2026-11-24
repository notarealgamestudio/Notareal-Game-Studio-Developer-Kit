/* ------------------------------------------------------------------ Bracelets: the Friendship Bracelets DS ROM (bead shop sim). Its data comes from the life sim (kit/nrlife_data.js) through kit/nrbracelet.js. */
function braceProj() { if (!P.bracelet) P.bracelet = { cfg: { title: 'Friendship Bracelets', seed: 7, startMoney: 60, days: 28 } }; return P.bracelet.cfg; }
function braceletTab(main) {
    const C = braceProj(), box = el('div', { class: 'pane' }), r = NRBracelet.build(P), LD = NRLifeData, w = LD.build(C.seed || 7);
    const num = (label, key, mn, mx) => el('label', {}, label + ' ', el('input', { type: 'number', min: mn, max: mx, value: C[key], style: 'width:70px', onchange: e => { C[key] = Math.max(mn, Math.min(mx, +e.target.value || mn)); dirty = true; renderAll(); } }));
    box.append(el('h2', {}, '📿 Friendship Bracelets'), el('p', { class: 'hint' }, 'A bead-shop sim for the Nintendo DS: buy beads, design 12-bead strands (or load one of the ready patterns), sell at the stall to customers with their own favourite styles, colours and budgets. Over ' + (C.days || 28) + ' days you work through 8 chapters to one of 8 endings. The beads, prices, patterns, customers and chapters are the life sim\'s data.'),
        el('div', { class: 'row wrap' }, el('label', {}, 'Title ', el('input', { value: C.title || '', maxlength: 31, onchange: e => { C.title = e.target.value.slice(0, 31); dirty = true; } })), num('Seed', 'seed', 1, 9999), num('Start $', 'startMoney', 0, 999), num('Days', 'days', 7, 99)));
    box.append(el('p', {}, `${r.stats.beads} beads / letters / charms / stones, ${r.stats.patterns} patterns, ${r.stats.customers} customers (${r.stats.bytes} bytes of game data).`));
    box.append(el('div', { class: 'row wrap' }, ...w.comps.filter(c => c.kind === 'bead').slice(0, 40).map(c => el('span', { title: c.n, style: `display:inline-block;width:18px;height:18px;border-radius:9px;background:rgb(${c.rgb.join(',')})` }))));
    box.append(el('div', { class: 'row wrap' }, el('button', { class: 'go', onclick: exportBraceletRom }, '⬇ Export DS ROM (.nds)')),
        el('p', { class: 'hint' }, 'On the DS everything is stylus: BEAD SHOP buys beads, DESIGN builds a strand (PATTERN loads a ready one, FINISH uses up the beads), OPEN STALL serves customers - tap a bracelet, set the price and OFFER. Quality comes from symmetry, repeats, colour harmony and letters/charms. No save file yet: a season is one sitting.'));
    main.append(box);
}
async function exportBraceletRom() {
    try { braceProj(); const res = NRBracelet.build(P), out = NRKit.patchROM(await gunzipB64(ROMS.ds_bracelet), res.block), nm = (braceProj().title || 'bracelets').replace(/\W+/g, '_'); await download(nm + '.nds', await withBanner(out.rom), 'application/octet-stream'); notify('Saved ' + nm + '.nds: copy it to roms/NDS on your RG DS Plus and open in DraStic. It opens on the NOTAREAL logo.'); }
    catch (e) { notify('Could not build the DS ROM: ' + e.message); }
}

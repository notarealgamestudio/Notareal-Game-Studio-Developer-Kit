/* ------------------------------------------------------------------ Cosmos: the Cosmos Keeper DS ROM (god sim, Spore x Sims x Cell to Singularity). Data from kit/nrgodsim.js. */
function godProj() { if (!P.godsim) P.godsim = { cfg: { title: 'Cosmos Keeper', seed: 7, pace: 25 } }; return P.godsim.cfg; }
function godsimTab(main) {
    const C = godProj(), box = el('div', { class: 'pane' }), r = NRGodSim.build(P), sim = NRGodSim.simulate(C);
    const num = (label, key, mn, mx) => el('label', {}, label + ' ', el('input', { type: 'number', min: mn, max: mx, value: C[key], style: 'width:70px', onchange: e => { C[key] = Math.max(mn, Math.min(mx, +e.target.value || mn)); dirty = true; renderAll(); } }));
    box.append(el('h2', {}, '🌌 Cosmos Keeper'), el('p', { class: 'hint' }, 'A god sim for the Nintendo DS in 12 stages, Big Bang to Singularity. Like Cell to Singularity you tap and buy upgrades that grow on their own; like Spore you choose the traits of what lives in each stage; like The Sims you keep the people of the late stages fed, happy and social. Real history, from 13.8 billion years ago to 2100.'),
        el('div', { class: 'row wrap' }, el('label', {}, 'Title ', el('input', { value: C.title || '', maxlength: 31, onchange: e => { C.title = e.target.value.slice(0, 31); dirty = true; } })), num('Seed', 'seed', 1, 9999), num('Pace (lower = faster)', 'pace', 8, 120)));
    box.append(el('p', {}, `${r.stats.stages} stages, ${r.stats.upgrades} upgrades, ${r.stats.traits} traits, ${r.stats.people} people (${r.stats.bytes} bytes). Estimated minutes per stage for a player who taps and buys: ` + sim.map(s => (s / 60).toFixed(1)).join(', ')));
    box.append(el('div', { class: 'row wrap' }, ...NRGodSim.STAGES.map((s, i) => el('span', { class: 'chip', title: s[1] }, (i + 1) + '. ' + s[0]))), el('div', { class: 'row wrap' }, el('button', { class: 'go', onclick: exportGodsimRom }, '⬇ Export DS ROM (.nds)')),
        el('p', { class: 'hint' }, 'On the DS: TAP the big button, BUILD upgrades, EVOLVE picks 3 traits (a trait that suits the world counts double), PEOPLE from the City stage, TIME lists the history. Reach the goal and ADVANCE. No save file: one run is one sitting.'));
    main.append(box);
}
async function exportGodsimRom() {
    try { godProj(); const res = NRGodSim.build(P), out = NRKit.patchROM(await gunzipB64(ROMS.ds_godsim), res.block), nm = (godProj().title || 'cosmos').replace(/\W+/g, '_'); await download(nm + '.nds', await withBanner(out.rom), 'application/octet-stream'); notify('Saved ' + nm + '.nds: copy it to roms/NDS on your RG DS Plus and open in DraStic.'); }
    catch (e) { notify('Could not build the DS ROM: ' + e.message); }
}

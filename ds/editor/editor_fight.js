/* ------------------------------------------------------------------ Fight tab: wrestling / fighting roster + play test */
function fightCfg() { if (!P.fight) { const ks = Object.keys(P.sprites); P.fight = JSON.parse(JSON.stringify(NRFight.DEFAULT)); P.fight.fighters[0].sprite = ks.includes('hero') ? 'hero' : ks[0]; P.fight.fighters[1].sprite = ks.includes('walker') ? 'walker' : ks[ks.length - 1]; } return P.fight; }

function wrestleCfg() { if (!P.wrestle) P.wrestle = NRKit.WRESTLE_DEFAULT(); return P.wrestle; }
function wrestlePanel(box) {
    const W = wrestleCfg(), num = (o, k, l, mn, mx, st) => el('label', {}, l + ' ', el('input', { type: 'number', min: mn, max: mx, step: st || 1, value: o[k], style: 'width:62px', onchange: e => { o[k] = Math.max(mn, Math.min(mx, +e.target.value)); dirty = true; } }));
    const sel = (o, k, l, names) => el('label', {}, l + ' ', el('select', { onchange: e => { o[k] = +e.target.value; dirty = true; } }, ...names.map((n, i) => { const x = el('option', { value: i }, n); if ((o[k] | 0) === i) x.selected = true; return x; })));
    const MT = ['Singles', 'No disqualification', '2 out of 3 falls', 'Steel cage', 'Last man standing', 'Ask before each match'];
    box.append(el('div', { class: 'gfxpanel' }, el('b', {}, '🤼 3D wrestling game for the Nintendo DS (the ICW match engine)'),
        el('p', { class: 'hint' }, 'Real 3D ring, referee, pins, ropes, finishers and move hints. Add 2 to 8 wrestlers: each gets a generated face and body, a finisher, a theme song and heel or face. The same game is what the DS ROM plays.'),
        el('div', { class: 'row wrap' }, el('label', {}, 'Title ', el('input', { value: W.title || '', onchange: e => { W.title = e.target.value; dirty = true; } })), sel(W, 'matchType', 'Match type', MT)),
        ...W.roster.map((w, i) => el('div', { class: 'gfxpanel' }, el('div', { class: 'row wrap' }, el('label', {}, 'Name ', el('input', { value: w.name, style: 'width:110px', maxlength: 15, onchange: e => { w.name = e.target.value; dirty = true; } })),
            sel(w, 'fin', 'Finisher', ['Barn Burner', 'Graveyard Shift', 'Snake Bite', 'Forehead Tap']), sel(w, 'heel', 'Role', ['Face', 'Heel']), sel(w, 'sex', 'Body', ['Male', 'Female']),
            el('button', { class: 'alt', onclick: () => { if (W.roster.length > 2) { W.roster.splice(i, 1); dirty = true; renderAll(); } } }, 'Remove')),
            el('div', { class: 'row wrap' }, num(w, 'skin', 'Skin 0-7', 0, 7), num(w, 'hair', 'Hair style 0-7', 0, 7), num(w, 'hairc', 'Hair colour 0-7', 0, 7), num(w, 'eyes', 'Eyes 0-3', 0, 3), num(w, 'beard', 'Beard 0-3', 0, 3), num(w, 'top', 'Top 0-9', 0, 9), num(w, 'pants', 'Pants 0-9', 0, 9), num(w, 'boots', 'Boots 0-9', 0, 9), num(w, 'height', 'Height', 0.8, 1.3, 0.05), num(w, 'build', 'Build', 0.7, 1.4, 0.05)),
            el('div', { class: 'row wrap' }, el('b', {}, 'Stats (%): '), num(w, 'power', 'Power', 40, 200, 5), num(w, 'tough', 'Toughness', 40, 200, 5), num(w, 'speed', 'Speed', 40, 200, 5), num(w, 'gain', 'Momentum gain', 40, 200, 5), el('small', {}, 'Power = damage dealt. Toughness = damage taken is divided by it.')),
            el('div', { class: 'row wrap' }, sel(w, 'preset', 'Entrance theme', ['Rock', 'Dark', 'Punk']), num(w, 'key', 'Key 0-11', 0, 11), num(w, 'tempo', 'Tempo', 60, 200, 4)))),
        el('div', { class: 'row' }, W.roster.length < 8 ? el('button', { class: 'alt', onclick: () => { W.roster.push({ name: 'Wrestler ' + (W.roster.length + 1), sex: 0, skin: W.roster.length % 8, hair: W.roster.length % 8, hairc: W.roster.length % 8, eyes: 1, beard: 0, top: W.roster.length % 10, pants: 2, boots: 4, height: 1, build: 1, fin: W.roster.length % 4, heel: W.roster.length % 2, preset: W.roster.length % 3, key: W.roster.length, tempo: 110, power: 100, tough: 100, speed: 100, gain: 100 }); dirty = true; renderAll(); } }, '+ Add wrestler') : '',
            el('button', { class: 'go', title: 'Real Nintendo DS ROM: plays in DraStic on the RG DS Plus', onclick: exportWrestleRom }, '⬇ Export 3D wrestling DS ROM')),
        el('p', { class: 'hint' }, 'The ring, crowd and move list are built into the engine for now. There is no in-editor preview of the 3D match: export the ROM to play it.')));
}
async function exportWrestleRom() {
    try { const W = wrestleCfg(), res = NRKit.buildDSWrestling(P), out = NRKit.patchROM(await gunzipB64(ROMS.ds_wrestling), res.block), nm = (W.title || 'wrestling').replace(/\W+/g, '_');
        await download(nm + '.nds', await withBanner(out.rom), 'application/octet-stream'); notify('Saved ' + nm + '.nds: copy to RG DS Plus roms/NDS, open in DraStic. Pick a match type, your wrestler and your rival. A strike, B grapple, Y pin, X taunt.'); }
    catch (e) { notify('Could not build the wrestling ROM: ' + e.message); }
}
function fightTab(main) {
    const C = fightCfg(), box = el('div', { class: 'pane' }), keys = Object.keys(P.sprites);
    box.append(el('h2', {}, '🤼 Wrestling / fighting'), el('p', { class: 'hint' }, 'Two fighters in a ring. A strikes (3-hit combo), B grabs then throws, Y blocks, X taunts to build momentum. When the gold momentum bar is full, hold A+B up close for a finisher. Knock your rival down below 40% health, stand close and hold A for a three count to win by pin. Controller or keyboard (arrows, Z, X, C, V). Use the Graphics tab Wrestler style on your sprites first.'),
        el('label', {}, 'Match title ', el('input', { value: C.title, onchange: e => { C.title = e.target.value; dirty = true; } })));
    box.append(el('label', { class: 'gfxpanel' }, el('input', { type: 'checkbox', ...(C.moveset ? { checked: '' } : {}), onchange: e => { C.moveset = e.target.checked; dirty = true; renderAll(); } }), ' Pro-wrestling moveset: 30 moves with real body movement (jabs and chops, suplexes, DDT, powerbomb, running clothesline, dropkick, ground drops, top-rope splash, finishers). A/B pick the move from the situation: running, behind, opponent down, low health, ropes.'));
    if (C.moveset) box.append(el('div', { class: 'row wrap' }, ...C.fighters.map((f, i) => el('label', {}, (f.name || 'Fighter ' + (i + 1)) + ' finisher ', el('select', { onchange: e => { f.finisher = e.target.value; dirty = true; } }, ...NRWrestling.MOVES.filter(m => m.type === 'finisher').map(m => { const o = el('option', { value: m.id }, m.name); if (f.finisher === m.id) o.selected = true; return o; }))))));
    wrestlePanel(box);
    box.append(el('p', { class: 'hint' }, 'Below: the simple 2D fighter (used for the PC page and the small 2D fighting ROM).'));
    C.fighters.forEach((f, i) => box.append(el('div', { class: 'gfxpanel' }, el('b', {}, i ? 'Fighter 2 (computer or player 2)' : 'Fighter 1 (you)'),
        el('div', { class: 'row wrap' }, el('label', {}, 'Name ', el('input', { value: f.name, style: 'width:110px', onchange: e => { f.name = e.target.value; dirty = true; } })),
            el('label', {}, 'Sprite ', el('select', { onchange: e => { f.sprite = e.target.value; dirty = true; } }, ...keys.map(k => { const o = el('option', { value: k }, k); if (k === f.sprite) o.selected = true; return o; }))),
            ...[['hp', 'Health', 40, 300], ['power', 'Power', 0.5, 2], ['speed', 'Speed', 0.5, 1.6]].map(([k, l, mn, mx]) => el('label', {}, l + ' ', el('input', { type: 'number', step: k === 'hp' ? 10 : 0.1, min: mn, max: mx, value: f[k], style: 'width:64px', onchange: e => { f[k] = Math.max(mn, Math.min(mx, +e.target.value)); dirty = true; } })))))));
    box.append(el('div', { class: 'row' }, el('button', { class: 'go', onclick: playFight }, '▶ Play a match'), el('button', { class: 'go', title: 'Real Nintendo DS ROM: plays in DraStic on the RG DS Plus', onclick: exportFightRom }, '⬇ Export simple 2D fighter DS ROM'), el('button', { class: 'alt', title: 'One HTML file: double-click to play with keyboard or Xbox controller', onclick: async () => { await download('match.html', NRPc.fightHTML(P, { images: Object.fromEntries(Object.entries(P.sprites).map(([k, v]) => [k, libUrl(v.image)])) }), 'text/html'); notify('Saved match.html: open it in Edge or Chrome, controller works.'); } }, '💾 Export playable match'), el('button', { class: 'alt', onclick: () => { C.fighters.push({ name: 'Fighter ' + (C.fighters.length + 1), sprite: keys[0], hp: 100, power: 1, speed: 1, color: '#88c' }); dirty = true; renderAll(); } }, '+ Fighter (roster)')));
    main.append(box);
}
async function playFight() {
    const C = fightCfg(), cv = el('canvas', { width: 384, height: 216, class: 'pix play' }), imgs = {}, k = {}, k2 = {};
    cv.style.cssText = 'width:768px;height:432px;image-rendering:pixelated';
    for (const [n, s] of Object.entries(P.sprites)) imgs[n] = await loadImage(s.image);
    const kd = e => { k[e.key] = true; if (e.key === 'Escape') close(); if (e.key.startsWith('Arrow')) e.preventDefault(); }, ku = e => { k[e.key] = false; };
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    const padPoll = setInterval(() => { const p = (navigator.getGamepads && [...navigator.getGamepads()].find(x => x && x.connected)); if (!p) return; const b = i => !!(p.buttons[i] && p.buttons[i].pressed); k.ArrowLeft = k.ArrowLeft || p.axes[0] < -0.45 || b(14); k.ArrowRight = k.ArrowRight || p.axes[0] > 0.45 || b(15); k.z = k.z || b(0); k.x = k.x || b(2); k.c = k.c || b(1); k.v = k.v || b(3); }, 16);
    const game = NRFight.play(cv, { title: C.title, ring: C.ring || NRFight.DEFAULT.ring, moveset: C.moveset, fighters: C.fighters.slice(0, 2) }, { keys: k, keys2: null, images: imgs, sprites: P.sprites, sound: () => {} });
    window.__fight = game; const close = () => { game.stop(); clearInterval(padPoll); removeEventListener('keydown', kd); removeEventListener('keyup', ku); m.remove(); };
    const m = modal('🤼 ' + C.title, el('div', {}, cv, el('p', { class: 'hint' }, 'Arrows move · Z strike · X grab/throw · C block · V taunt · A+B finisher · Esc closes')), [['Close', () => { close(); return false; }, 'alt']]);
}

async function exportFightRom() {
    try { const C = fightCfg(), imgs = new Map(); for (const f of C.fighters.slice(0, 2)) { const sp = P.sprites[f.sprite]; if (sp && !imgs.has(sp.image)) imgs.set(sp.image, await imageData(sp.image)); }
        const res = NRKit.buildDSFight(P, { img: r => imgs.get(r) }), out = NRKit.patchROM(await gunzipB64(ROMS.ds_fight), res.block), nm = (C.title || 'fight').replace(/\W+/g, '_');
        await download(nm + '.nds', await withBanner(out.rom), 'application/octet-stream'); notify('Saved ' + nm + '.nds: copy to RG DS Plus roms/NDS, open in DraStic. D-pad moves, A strike, B grab/throw, Y block, X taunt.' + (res.warnings.length ? ' ' + res.warnings.join(' ') : '')); }
    catch (e) { notify('Could not build the DS ROM: ' + e.message); }
}

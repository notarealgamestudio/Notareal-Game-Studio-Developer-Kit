/* ------------------------------------------------------------------ Puzzle tab: match-3 + friendship bracelet */
function puzzleCfg() { if (!P.puzzle) P.puzzle = { mode: 'bracelet', match3: Object.assign({}, NRPuzzle.MATCH3, { palette: NRPuzzle.GEMS.slice() }), bracelet: Object.assign({}, NRPuzzle.BRACELET, { palette: NRPuzzle.BRACELET.palette.slice() }) }; return P.puzzle; }
function puzzleSet(c) { return c[c.mode]; }
function puzzleTab(main) {
    const C = puzzleCfg(), S = puzzleSet(C), box = el('div', { class: 'pane' });
    const num = (lbl, k, mn, mx) => el('label', {}, lbl + ' ', el('input', { type: 'number', min: mn, max: mx, value: S[k], style: 'width:60px', onchange: e => { S[k] = Math.max(mn, Math.min(mx, +e.target.value || mn)); dirty = true; } }));
    box.append(el('h2', {}, '🧩 Puzzle games'), el('p', { class: 'hint' }, 'Two ready puzzle games you can retheme with your own colours and title. Bracelet: copy the knot pattern row by row (A paints a thread, up/down picks the colour, B checks the row, Y shows a hint for −20 points). Match-3: pick a gem with A, move to a neighbour, A again to swap.'),
        el('div', { class: 'row wrap' }, el('label', {}, 'Game ', el('select', { onchange: e => { C.mode = e.target.value; dirty = true; renderAll(); } }, ...[['bracelet', 'Friendship bracelet'], ['match3', 'Match-3']].map(([v, l]) => { const o = el('option', { value: v }, l); if (v === C.mode) o.selected = true; return o; }))),
            el('label', {}, 'Title ', el('input', { value: S.title, onchange: e => { S.title = e.target.value; dirty = true; } }))));
    if (C.mode === 'bracelet') box.append(el('div', { class: 'row wrap' }, num('Threads', 'threads', 3, 10), num('Rows', 'rows', 3, 40), num('Tries', 'tries', 1, 20),
        el('label', {}, 'Pattern ', el('select', { onchange: e => { S.pattern = e.target.value; dirty = true; } }, ...Object.keys(NRPuzzle.PATTERNS).map(k => { const o = el('option', { value: k }, k); if (k === S.pattern) o.selected = true; return o; })))));
    else box.append(el('div', { class: 'row wrap' }, num('Width', 'w', 5, 10), num('Height', 'h', 5, 10), num('Gem colours', 'colors', 3, 6), num('Moves', 'moves', 5, 80), num('Score goal', 'goal', 100, 20000)));
    box.append(el('h3', {}, 'Colours'), el('div', { class: 'row wrap' }, ...S.palette.map((c, i) => el('input', { type: 'color', value: c, onchange: e => { S.palette[i] = e.target.value; dirty = true; } })),
        C.mode === 'bracelet' ? el('button', { class: 'alt', onclick: () => { if (S.palette.length < 6) { S.palette.push('#ffffff'); dirty = true; renderAll(); } } }, '+ thread colour') : ''));
    box.append(el('div', { class: 'row' }, el('button', { class: 'go', onclick: playPuzzle }, '▶ Play'), el('button', { class: 'go', title: 'Real Nintendo DS ROM: plays in DraStic on the RG DS Plus', onclick: exportPuzzleRom }, '⬇ Export DS ROM'), el('button', { class: 'alt', onclick: async () => { await download('puzzle.html', NRPc.puzzleHTML(P), 'text/html'); notify('Saved puzzle.html: open in Edge or Chrome, controller works.'); } }, '💾 Export playable puzzle')));
    main.append(box);
}
async function playPuzzle() {
    const C = puzzleCfg(), S = puzzleSet(C), cv = el('canvas', { width: 384, height: 216, class: 'pix play' }), k = {};
    cv.style.cssText = 'width:768px;height:432px;image-rendering:pixelated';
    const kd = e => { k[e.key] = true; if (e.key === 'Escape') close(); if (e.key.startsWith('Arrow')) e.preventDefault(); }, ku = e => { k[e.key] = false; };
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    const poll = setInterval(() => { const p = (navigator.getGamepads && [...navigator.getGamepads()].find(x => x && x.connected)); if (!p) return; const b = i => !!(p.buttons[i] && p.buttons[i].pressed); k.ArrowLeft = k.ArrowLeft || p.axes[0] < -0.45 || b(14); k.ArrowRight = k.ArrowRight || p.axes[0] > 0.45 || b(15); k.ArrowUp = k.ArrowUp || p.axes[1] < -0.45 || b(12); k.ArrowDown = k.ArrowDown || p.axes[1] > 0.45 || b(13); k.z = k.z || b(0); k.x = k.x || b(1); k.c = k.c || b(3); }, 16);
    const game = NRPuzzle.play(cv, C.mode, S, { keys: k, seed: Date.now() & 0xffff }); window.__puzzle = game;
    const close = () => { game.stop(); clearInterval(poll); removeEventListener('keydown', kd); removeEventListener('keyup', ku); m.remove(); };
    const m = modal('🧩 ' + S.title, el('div', {}, cv, el('p', { class: 'hint' }, 'Arrows move · Z select/paint · X cancel/check row · C hint · Esc closes')), [['Close', () => { close(); return false; }, 'alt']]);
}

async function exportPuzzleRom() {
    try { const res = NRKit.buildDSPuzzle(P), tpl = await gunzipB64(ROMS.ds_puzzle), out = NRKit.patchROM(tpl, res.block); const nm = ((puzzleSet(puzzleCfg()).title) || 'puzzle').replace(/\W+/g, '_');
        await download(nm + '.nds', await withBanner(out.rom), 'application/octet-stream'); notify('Saved ' + nm + '.nds: copy to your RG DS Plus (roms/NDS) and open in DraStic. It opens on the NOTAREAL logo.'); }
    catch (e) { notify('Could not build the DS ROM: ' + e.message); }
}

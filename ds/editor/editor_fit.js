/* Fit & Balance tab (v1.2): console support matrix, Console Fit for this project, platformer playtest report, arcade Auto-Balance. */
const FIT = { sel: 'ds', bal: null };
function fitTab(main) {
    const box = el('div', { class: 'pane' }), cov = NRFit.coverage(), cons = NRFit.CONSOLES;
    box.append(el('h2', {}, '🎯 Fit & Balance'), el('p', { class: 'hint' }, 'The honest map of what exports where, a check that your game fits a console, and a robot that plays your game so you can tune the difficulty.'));
    // 1. matrix
    const ids = Object.keys(cons), tbl = el('table', { class: 'tbl' }), hr = el('tr', {}, el('th', {}, 'Game type'), ...ids.map(c => el('th', {}, c.toUpperCase())));
    tbl.append(hr);
    for (const r of NRFit.matrix()) tbl.append(el('tr', {}, el('td', {}, r.name), ...ids.map(c => el('td', { title: r.cells[c] }, { rom: '✅', pc: '🖥', planned: '·' }[r.cells[c]] || '·'))));
    box.append(el('h3', {}, 'Where each game type can be exported'), el('p', { class: 'hint' }, '✅ real ROM export   🖥 PC game page   · not built yet. ROM counts: ' + ids.filter(c => c !== 'pc').map(c => c.toUpperCase() + ' ' + cov[c]).join(' · ') + ' of ' + NRFit.matrix().length + ' types.'), el('div', { style: 'overflow:auto;max-height:320px' }, tbl));
    // 2. console fit
    const sel = el('select', { onchange: e => { FIT.sel = e.target.value; renderAll(); } }, ...ids.map(c => el('option', Object.assign({ value: c }, FIT.sel === c ? { selected: '' } : {}), c.toUpperCase())));
    const fr = NRFit.check(P, FIT.sel), col = { ok: '#6c6', warn: '#fc6', fail: '#f66' }[fr.status] || '#ccc';
    box.append(el('h3', {}, 'Does my game fit this console?'), el('div', { class: 'row' }, sel, el('b', { style: 'color:' + col }, fr.status.toUpperCase())), ...fr.lines.map(l => el('div', {}, '• ' + l)), ...fr.fixes.map(l => el('div', { class: 'hint' }, '→ ' + l)));
    // 3. playtest
    if (P && P.levels && P.levels.length) {
        const rep = NRFit.report(P), t = el('table', { class: 'tbl' }, el('tr', {}, ...['Level', 'Length', 'Time', 'Enemies', 'Hazards', 'Pits', 'Danger', 'Finishable'].map(h => el('th', {}, h))));
        for (const l of rep.levels) t.append(el('tr', {}, el('td', {}, l.name), el('td', {}, l.width), el('td', {}, l.seconds + 's'), el('td', {}, l.enemies), el('td', {}, l.hazards), el('td', {}, l.pits), el('td', {}, l.danger), el('td', {}, l.finishable ? '✅' : '❌')));
        box.append(el('h3', {}, 'Platformer playtest report'), t, ...rep.warnings.map(w => el('div', { style: 'color:#fc6' }, '⚠ ' + w)));
    }
    // 4. auto-balance (arcade)
    if (P && P.arcade && NRBalance.MODES.includes(P.arcade.mode)) {
        const mode = P.arcade.mode, out = el('div', { class: 'hint' }, FIT.bal || 'Pick a level. The robot plays about 70 games per click (a few seconds).');
        const btn = lv => el('button', { class: 'go', onclick: () => { out.textContent = 'Playing...'; setTimeout(() => { const r = NRBalance.tune(mode, P.arcade.cfg, lv, { runs: 10 }); P.arcade.cfg = r.cfg; dirty = true; FIT.bal = `${lv}: a casual bot wins ${Math.round(r.winRate * 100)}% of games (target ${Math.round(r.target * 100)}%), about ${r.avgSeconds}s per game. Settings applied.`; renderAll(); }, 30); } }, lv[0].toUpperCase() + lv.slice(1));
        box.append(el('h3', {}, 'Auto-Balance: ' + NRArcade.MODES[mode].name), el('div', { class: 'row' }, btn('easy'), btn('normal'), btn('hard')), out);
    } else box.append(el('p', { class: 'hint' }, 'Auto-Balance works on Shoot-em-up, Racing and Falling-blocks games from the Arcade tab. More modes come later.'));
    main.append(box);
}

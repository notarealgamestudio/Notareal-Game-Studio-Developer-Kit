/* ------------------------------------------------------------------ skate park builder (shown in the 3D level builder tab when the project is a skate game)
   Top-down: rails, ledges, coping, kickers / funboxes, blocks, the 7 letters, spawn and colours. Written to the 'SKPK' section; the DS skate engine plays it. */
const SK = { tool: 'rail', h: 0.7, kind: 0 };
function skateparkInit() { if (!P.skatepark) { P.skatepark = NRKit.SKATE_NEW(0); P.skatepark.on = true; } return P.skatepark; }
function skateparkDraw(cv) {
    const sp = skateparkInit(), g = cv.getContext('2d'), S = cv.width / 40, X = x => (x + 20) * S, Y = z => (z + 20) * S, rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
    g.fillStyle = rgb(sp.c.slab); g.fillRect(0, 0, cv.width, cv.height); g.strokeStyle = 'rgba(0,0,0,.15)';
    for (let m = -20; m <= 20; m += 5) { g.beginPath(); g.moveTo(X(m), 0); g.lineTo(X(m), cv.height); g.moveTo(0, Y(m)); g.lineTo(cv.width, Y(m)); g.stroke(); }
    if (sp.qh > 0) { g.strokeStyle = '#fff'; g.setLineDash([6, 4]); g.strokeRect(X(-16), Y(-16), 32 * S, 32 * S); g.setLineDash([]); }
    sp.ramps.forEach((r, i) => { g.fillStyle = r.kind ? '#c8a050' : '#a07838'; g.fillRect(X(r.x - r.hw), Y(r.z - r.hd), r.hw * 2 * S, r.hd * 2 * S); g.strokeStyle = '#000'; g.strokeRect(X(r.x - r.hw), Y(r.z - r.hd), r.hw * 2 * S, r.hd * 2 * S); g.fillStyle = '#000'; g.font = '9px sans-serif'; g.fillText(r.kind ? 'funbox' : 'kicker', X(r.x - r.hw) + 2, Y(r.z) + 3); });
    sp.obs.forEach(o => { g.fillStyle = '#5a5a60'; g.fillRect(X(o.x0), Y(o.z0), (o.x1 - o.x0) * S, (o.z1 - o.z0) * S); });
    sp.rails.forEach(r => { g.strokeStyle = ['#d33', '#3ad', '#fa0'][r.kind] || '#d33'; g.lineWidth = 4; g.beginPath(); g.moveTo(X(r.x0), Y(r.z0)); g.lineTo(X(r.x1), Y(r.z1)); g.stroke(); g.lineWidth = 1; });
    sp.letters.forEach((l, i) => { g.fillStyle = '#ffd23c'; g.beginPath(); g.arc(X(l.x), Y(l.z), 8, 0, 7); g.fill(); g.strokeStyle = '#000'; g.stroke(); g.fillStyle = '#000'; g.font = 'bold 10px sans-serif'; g.fillText('SKATER'.concat('!')[i], X(l.x) - 3, Y(l.z) + 4); });
    g.fillStyle = '#fff'; g.beginPath(); g.arc(X(sp.spawn.x), Y(sp.spawn.z), 7, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#000'; g.fillText('S', X(sp.spawn.x) - 3, Y(sp.spawn.z) + 3);
}
function skateparkTab(main) {
    const sp = skateparkInit(), box = el('div', { class: 'pane' }), cv = el('canvas', { width: 640, height: 640, style: 'width:100%;max-width:640px;border:1px solid #444;border-radius:6px;cursor:crosshair' });
    const tools = [['rail', 'Rail'], ['ledge', 'Ledge'], ['coping', 'Coping'], ['kicker', 'Kicker'], ['funbox', 'Funbox'], ['block', 'Block'], ['letter', 'Letter'], ['spawn', 'Spawn'], ['erase', 'Erase']];
    box.append(el('h2', {}, '🛹 Skate park builder'), el('p', { class: 'hint' }, 'Your park, not a preset: pick a tool, click for the start, click again for the end of rails, ledges and blocks. Limits: 8 rails, 4 ramps, 2 blocks, 7 letters. The DS skate engine plays exactly what you draw.'));
    box.append(el('div', { class: 'row wrap' }, 'Start from: ', ...NRKit.SKATE_PARKS.map((p, i) => el('button', { class: 'alt', onclick: () => { P.skatepark = NRKit.SKATE_NEW(i); P.skatepark.on = true; dirty = true; renderAll(); } }, p.name))));
    box.append(el('div', { class: 'row wrap' }, ...tools.map(([k, n]) => el('button', { class: SK.tool === k ? 'go' : 'alt', onclick: () => { SK.tool = k; SK.p0 = null; renderAll(); } }, n))));
    const cols = [['sky0', 'Sky top'], ['sky1', 'Sky bottom'], ['slab', 'Floor'], ['walls', 'Walls'], ['deck', 'Deck']], hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
    box.append(el('div', { class: 'row wrap' }, ...cols.map(([k, n]) => el('label', {}, n + ' ', el('input', { type: 'color', value: hex(sp.c[k]), onchange: e => { const v = e.target.value; sp.c[k] = [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)); dirty = true; skateparkDraw(cv); } }))),
        el('label', {}, 'Height m ', el('input', { type: 'number', step: .1, min: .2, max: 3, value: SK.h, style: 'width:56px', onchange: e => { SK.h = Math.max(.2, Math.min(3, +e.target.value)); } })),
        el('label', {}, 'Quarter-pipe walls m ', el('input', { type: 'number', step: .2, min: 0, max: 5, value: sp.qh, style: 'width:56px', onchange: e => { sp.qh = Math.max(0, Math.min(5, +e.target.value)); dirty = true; skateparkDraw(cv); } }))));
    box.append(cv, el('div', { class: 'hint' }, sp.rails.length + ' rails · ' + sp.ramps.length + ' ramps · ' + sp.obs.length + ' blocks'));
    cv.onclick = e => {
        const r = cv.getBoundingClientRect(), S = r.width / 40, x = Math.round(((e.clientX - r.left) / S - 20) * 2) / 2, z = Math.round(((e.clientY - r.top) / S - 20) * 2) / 2, t = SK.tool, h = SK.h;
        const near = (ax, az) => Math.hypot(ax - x, az - z);
        if (t === 'spawn') sp.spawn = { x, z };
        else if (t === 'letter') { sp.letters.push({ x, y: 2, z }); if (sp.letters.length > 7) sp.letters.shift(); }
        else if (t === 'kicker' || t === 'funbox') { if (sp.ramps.length < 4) sp.ramps.push({ x, z, hw: t === 'kicker' ? 2 : 3, hd: t === 'kicker' ? 1.4 : 2, h, kind: t === 'funbox' ? 1 : 0 }); }
        else if (t === 'erase') {
            let best = null, bd = 3; const tryit = (arr, d, a) => arr.forEach((o, i) => { const q = d(o); if (q < bd) { bd = q; best = [a, i]; } });
            tryit(sp.rails, o => near((o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2), 'rails'); tryit(sp.ramps, o => near(o.x, o.z), 'ramps'); tryit(sp.obs, o => near((o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2), 'obs'); tryit(sp.letters, o => near(o.x, o.z), 'letters');
            if (best) sp[best[0]].splice(best[1], 1);
        } else {
            if (!SK.p0) { SK.p0 = { x, z }; return; }
            const a = SK.p0; SK.p0 = null;
            if (t === 'block') { if (sp.obs.length < 2) sp.obs.push({ x0: Math.min(a.x, x), z0: Math.min(a.z, z), x1: Math.max(a.x, x) + .5, z1: Math.max(a.z, z) + .5, h }); }
            else if (sp.rails.length < 8) sp.rails.push({ x0: a.x, z0: a.z, x1: x, z1: z, h, kind: { rail: 0, ledge: 1, coping: 2 }[t] });
        }
        dirty = true; renderAll();
    };
    main.append(box); skateparkDraw(cv);
}

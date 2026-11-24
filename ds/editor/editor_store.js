/* ------------------------------------------------------------------ store builder (shown in the 3D level builder tab when the project is the store job sim)
   Your own store: products with names and prices, shelves placed on a floor plan, the counter / register, outside props. Stored in P.arcade.cfg.store; the PC / Xbox store engine plays it. */
const SB = { tool: 'shelf', prod: null, face: -1, len: 7, decor: 'dumpster' };
function storeInit() { const A = P.arcade; A.cfg = A.cfg || {}; if (!A.cfg.store) A.cfg.store = NRStore.DEFAULT_STORE(); const s = A.cfg.store; SB.prod = SB.prod && s.products.some(p => p.id === SB.prod) ? SB.prod : (s.products[0] || {}).id; return s; }
function storeDraw(cv) {
    const s = storeInit(), g = cv.getContext('2d'), W = 30, S = cv.width / W, X = x => (x + 15) * S, Y = z => (z + 20) * S, rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
    g.fillStyle = '#c9c3b0'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#6a6a70'; g.fillRect(0, 0, cv.width, Y(-9)); g.fillStyle = '#e8e4d6'; g.fillRect(X(-14), Y(-9), 28 * S, 18 * S); g.fillStyle = '#d6d2c2'; g.fillRect(X(-14), Y(9), 8 * S, 8 * S);
    g.strokeStyle = '#444'; g.lineWidth = 3; g.strokeRect(X(-14), Y(-9), 28 * S, 18 * S); g.lineWidth = 1; g.fillStyle = '#000'; g.font = '10px sans-serif'; g.fillText('street / door', X(-2), Y(-9.6)); g.fillText('back room', X(-13), Y(9.8));
    s.shelves.forEach(q => { const p = s.products.find(z => z.id === q.id) || { col: [150, 150, 150], name: q.id }, x = q.face === 'x-', w = x ? 1.2 : q.w, d = x ? 7 : .9; g.fillStyle = rgb(p.col); g.fillRect(X(q.x - w / 2), Y(q.z - d / 2), w * S, d * S); g.strokeStyle = '#000'; g.strokeRect(X(q.x - w / 2), Y(q.z - d / 2), w * S, d * S); g.fillStyle = '#000'; g.fillText(p.name, X(q.x - w / 2) + 2, Y(q.z) + 3); const f = q.face === 1 ? .9 : q.face === -1 ? -.9 : 0; g.fillStyle = '#c33'; g.fillRect(X(q.x) - 3, Y(q.z + f * 1.0) - (q.face === 'x-' ? 0 : 0), 6, 6); });
    s.decor.forEach(d => { g.fillStyle = '#486'; g.fillRect(X(d.x) - 8, Y(d.z) - 8, 16, 16); g.fillStyle = '#fff'; g.fillText(d.kind[0].toUpperCase(), X(d.x) - 3, Y(d.z) + 4); });
    g.fillStyle = '#964'; g.fillRect(X(s.counter.x - 3), Y(s.counter.z - .4), 6 * S, .8 * S); g.fillStyle = '#000'; g.fillText('REGISTER', X(s.counter.x - 2), Y(s.counter.z) + 3);
}
function storeTab(main) {
    const s = storeInit(), box = el('div', { class: 'pane' }), cv = el('canvas', { width: 600, height: 780, style: 'width:100%;max-width:600px;border:1px solid #444;border-radius:6px;cursor:crosshair' });
    box.append(el('h2', {}, '🏪 Store builder'), el('p', { class: 'hint' }, 'Design your own store: set the products and prices, then place shelves and the counter on the floor plan. Customers shop only for products that have a shelf. The shop shell (walls, door, back room) is fixed.'));
    box.append(el('div', { class: 'row wrap' }, el('button', { class: 'alt', onclick: () => { P.arcade.cfg.store = NRStore.DEFAULT_STORE(); dirty = true; renderAll(); } }, 'Reset to the default store'), el('button', { class: 'alt', onclick: () => { s.shelves = []; dirty = true; renderAll(); } }, 'Clear shelves')));
    const tools = [['shelf', 'Shelf'], ['counter', 'Move register'], ['decor', 'Outside prop'], ['erase', 'Erase']];
    box.append(el('div', { class: 'row wrap' }, ...tools.map(([k, n]) => el('button', { class: SB.tool === k ? 'go' : 'alt', onclick: () => { SB.tool = k; renderAll(); } }, n))));
    const sel = (opts, cur, fn) => el('select', { onchange: e => fn(e.target.value) }, ...opts.map(([v, n]) => { const o = el('option', { value: v }, n); if (String(v) === String(cur)) o.selected = true; return o; }));
    const o2 = el('div', { class: 'row wrap' });
    if (SB.tool === 'shelf') o2.append(el('label', {}, 'Product ', sel(s.products.map(p => [p.id, p.name]), SB.prod, v => { SB.prod = v; })), el('label', {}, 'Faces ', sel([[-1, 'south (aisle toward the door)'], [1, 'north'], ['x-', 'west (tall wall unit)']], SB.face, v => { SB.face = v === 'x-' ? v : +v; })), el('label', {}, 'Length m ', el('input', { type: 'number', min: 2, max: 14, value: SB.len, style: 'width:56px', onchange: e => { SB.len = Math.max(2, Math.min(14, +e.target.value)); } })));
    if (SB.tool === 'decor') o2.append(sel(['dumpster', 'crate', 'barrel', 'car', 'lamp', 'bench', 'tree'].map(k => [k, k]), SB.decor, v => { SB.decor = v; }));
    box.append(o2, cv);
    const tb = el('table', { class: 'tbl' }, el('tr', {}, ...['Product', 'Name', 'Sell $', 'Cost $', 'Colour', ''].map(h => el('th', {}, h))));
    const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
    s.products.forEach((p, i) => tb.append(el('tr', {}, el('td', {}, p.id), el('td', {}, el('input', { value: p.name, style: 'width:110px', onchange: e => { p.name = e.target.value.slice(0, 14) || p.id; dirty = true; storeDraw(cv); } })),
        el('td', {}, el('input', { type: 'number', step: .01, min: .1, max: 99, value: p.price, style: 'width:64px', onchange: e => { p.price = Math.max(.1, +e.target.value || 1); dirty = true; } })), el('td', {}, el('input', { type: 'number', step: .01, min: .05, max: 99, value: p.cost, style: 'width:64px', onchange: e => { p.cost = Math.max(.05, +e.target.value || .5); dirty = true; } })),
        el('td', {}, el('input', { type: 'color', value: hex(p.col), onchange: e => { const v = e.target.value; p.col = [1, 3, 5].map(k => parseInt(v.slice(k, k + 2), 16)); dirty = true; storeDraw(cv); } })),
        el('td', {}, s.products.length > 1 ? el('button', { class: 'alt', onclick: () => { s.products.splice(i, 1); s.shelves = s.shelves.filter(q => q.id !== p.id); dirty = true; renderAll(); } }, 'Remove') : ''))));
    box.append(el('h3', {}, 'Products'), tb, s.products.length < 8 ? el('button', { class: 'alt', onclick: () => { let n = 1; while (s.products.some(p => p.id === 'item' + n)) n++; s.products.push({ id: 'item' + n, name: 'Item ' + n, price: 2, cost: 1, col: [120 + n * 15 % 120, 140, 200] }); dirty = true; renderAll(); } }, '+ Add product') : '', el('div', { class: 'hint' }, s.shelves.length + ' shelves · ' + s.products.length + ' products (up to 8)'));
    cv.onclick = e => {
        const r = cv.getBoundingClientRect(), S = r.width / 30, x = Math.round(((e.clientX - r.left) / S - 15) * 2) / 2, z = Math.round(((e.clientY - r.top) / S - 20) * 2) / 2;
        if (SB.tool === 'shelf') { if (s.shelves.length < 12 && SB.prod) s.shelves.push({ id: SB.prod, x: Math.max(-12, Math.min(13.5, x)), z: Math.max(-7.5, Math.min(8, z)), w: SB.len, face: SB.face }); }
        else if (SB.tool === 'counter') s.counter = { x: Math.max(-9, Math.min(10, x)), z: Math.max(-6.5, Math.min(5, z)) };
        else if (SB.tool === 'decor') { if (s.decor.length < 12) s.decor.push({ kind: SB.decor, x: Math.max(-28, Math.min(28, x)), z: Math.max(-26, Math.min(-9.5, z)) }); }
        else { let best = null, bd = 2.5; s.shelves.forEach((q, i) => { const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = ['shelves', i]; } }); s.decor.forEach((q, i) => { const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = ['decor', i]; } }); if (best) s[best[0]].splice(best[1], 1); }
        dirty = true; renderAll();
    };
    main.append(box); storeDraw(cv);
}

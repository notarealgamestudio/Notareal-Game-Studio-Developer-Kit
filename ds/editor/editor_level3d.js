/* ------------------------------------------------------------------ shared 3D level builder (tab "3D level builder")
   Top-down editor for the 3D game types: place buildings (from the Asset library), props, ramps, stars / pickups / enemies and the spawn. P.level3d feeds NRWorld3D.build,
   so the DS, PlayStation and N64 3D world engines play your map instead of the built-in one. */
const L3 = { tool: 'building', asset: null, w: 10, d: 10, h: 12, axis: 'z', sel: -1 };
function level3dInit() { P.level3d = P.level3d || { half: 40, spawn: { x: 0, z: -30 }, yaw: 180, objs: [] }; return P.level3d; }
async function assetColor(ref, fallback) { try { const im = await imageData(ref); let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < im.data.length; i += 4) if (im.data[i + 3] > 128) { r += im.data[i]; g += im.data[i + 1]; b += im.data[i + 2]; n++; } return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : fallback; } catch (e) { return fallback; } }
async function level3dSample() {
    const L = level3dInit(), bl = assetList('building'), pr = ['tree', 'pine', 'rock', 'crate', 'lamp', 'car', 'bench', 'bush'], o = [];
    const colOf = async id => { const e = bl.find(q => q.id === id); return e ? assetColor(e.ref, [150, 120, 100]) : [150, 120, 100]; };
    const rows = [[-22, -8, 'building_house', 8, 8, 6], [-8, -8, 'building_shop', 9, 8, 7], [8, -8, 'building_office', 9, 9, 16], [22, -8, 'building_warehouse', 10, 8, 8], [-20, 14, 'building_store', 10, 8, 7], [0, 16, 'building_skyscraper', 9, 9, 26], [20, 14, 'building_gym', 10, 8, 9]];
    for (const [x, z, id, w, d, h] of rows) o.push({ t: 'building', id, x, z, w, d, h, col: await colOf(id) });
    pr.forEach((id, i) => o.push({ t: 'prop', id, x: -30 + i * 8, z: -20 + (i % 2) * 4 })); o.push({ t: 'ramp', x: 0, z: -22, w: 6, d: 8, h: 2.5, axis: 'z', col: [160, 120, 70] });
    [[-14, 0], [14, 0], [0, 8], [-26, 8], [26, 6], [-6, 26], [8, 28], [30, -18]].forEach(([x, z]) => o.push({ t: 'star', x, z }));
    L.objs = o; L.spawn = { x: 0, z: -32 }; L.half = 40; dirty = true;
}
async function level3dDraw(cv) {
    const L = level3dInit(), g = cv.getContext('2d'), S = cv.width / (L.half * 2), X = x => (x + L.half) * S, Y = z => (z + L.half) * S; g.imageSmoothingEnabled = false;
    g.fillStyle = '#5a8a50'; g.fillRect(0, 0, cv.width, cv.height);
    if (P.assets && P.assets.land) { const im = await loadImage(P.assets.land); for (let x = 0; x < cv.width; x += 32) for (let y = 0; y < cv.height; y += 32) g.drawImage(im, x, y, 32, 32); }
    g.strokeStyle = 'rgba(0,0,0,.12)'; for (let m = -L.half; m <= L.half; m += 10) { g.beginPath(); g.moveTo(X(m), 0); g.lineTo(X(m), cv.height); g.moveTo(0, Y(m)); g.lineTo(cv.width, Y(m)); g.stroke(); }
    L.objs.forEach((o, i) => {
        const c = o.col || [150, 120, 90], col = `rgb(${c[0]},${c[1]},${c[2]})`;
        if (o.t === 'building' || o.t === 'ramp') { g.fillStyle = col; g.fillRect(X(o.x - o.w / 2), Y(o.z - o.d / 2), o.w * S, o.d * S); g.strokeStyle = o.t === 'ramp' ? '#fff' : '#222'; g.strokeRect(X(o.x - o.w / 2), Y(o.z - o.d / 2), o.w * S, o.d * S); g.fillStyle = '#fff'; g.font = '10px sans-serif'; g.fillText(o.t === 'ramp' ? 'ramp ' + o.h : o.h + 'm', X(o.x - o.w / 2) + 3, Y(o.z - o.d / 2) + 11); }
        else if (o.t === 'prop') { g.fillStyle = col; g.beginPath(); g.arc(X(o.x), Y(o.z), 4, 0, 7); g.fill(); g.fillStyle = '#000'; g.font = '9px sans-serif'; g.fillText(o.id, X(o.x) + 5, Y(o.z) + 3); }
        else { const ic = { star: ['#ffd23c', '★'], health: ['#4be04b', '+'], ammo: ['#4b8cff', 'A'], enemy: ['#ff4b4b', 'E'], npc: ['#d4a', 'N'] }[o.t]; g.fillStyle = ic[0]; g.beginPath(); g.arc(X(o.x), Y(o.z), 6, 0, 7); g.fill(); g.fillStyle = '#000'; g.font = 'bold 9px sans-serif'; g.fillText(ic[1], X(o.x) - 3, Y(o.z) + 3); }
        if (i === L3.sel) { g.strokeStyle = '#f0f'; g.lineWidth = 2; g.strokeRect(X(o.x) - 8, Y(o.z) - 8, 16, 16); g.lineWidth = 1; }
    });
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.beginPath(); g.arc(X(L.spawn.x), Y(L.spawn.z), 7, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#000'; g.font = 'bold 9px sans-serif'; g.fillText('S', X(L.spawn.x) - 3, Y(L.spawn.z) + 3);
}
function level3dTab(main) {
    if (P.arcade && P.arcade.mode === 'skate') return skateparkTab(main);
    if (P.arcade && P.arcade.mode === 'store3d') return storeTab(main);
    if (P.arcade && P.arcade.mode === 'shmup') return shmupDesignTab(main);
    if (P.arcade && P.arcade.mode === 'breakout') return breakoutDesignTab(main);
    if (P.arcade && (P.arcade.mode === 'race' || P.arcade.mode === 'combat')) return raceDesignTab(main);
    if (P.arcade && P.arcade.mode === 'brawler') return brawlerDesignTab(main);
    if (P.arcade && P.arcade.mode === 'fps') return fpsDesignTab(main);
    if (P.arcade && P.arcade.mode === 'rail') return railDesignTab(main);
    if (P.arcade && P.arcade.mode === 'basketball') return basketballDesignTab(main);
    if (P.arcade && P.arcade.mode === 'baseball') return baseballDesignTab(main);
    const L = level3dInit(), box = el('div', { class: 'pane' }), cv = el('canvas', { width: 640, height: 640, style: 'width:100%;max-width:640px;border:1px solid #444;border-radius:6px;cursor:crosshair;image-rendering:pixelated' });
    box.append(el('h2', {}, '🏙 3D level builder'), el('p', { class: 'hint' }, 'Build the map for the 3D game types (open world, war, RPG world) on any console that has a 3D engine: DS, PlayStation, N64. Pick a tool, click the map. Buildings use your Asset library walls. Top-down view; export the ROM to walk it in 3D.'));
    const tools = [['building', '🏢 Building'], ['prop', '🌳 Prop'], ['ramp', '⛰ Ramp'], ['star', '★ Star'], ['health', '+ Health'], ['ammo', 'Ammo'], ['enemy', 'Enemy'], ['npc', 'Person'], ['spawn', 'S Spawn'], ['erase', '🗑 Erase']];
    const bAssets = assetList('building'), pAssets = assetList('prop').filter(a => a.id.replace('prop_', '') in { tree: 1, pine: 1, bush: 1, rock: 1, crate: 1, barrel: 1, bench: 1, lamp: 1, sign: 1, car: 1, fence: 1, cone: 1, hydrant: 1, trash_can: 1, rail: 1, chest: 1, torch: 1 });
    if (!L3.asset) L3.asset = bAssets[0] ? bAssets[0].id : null;
    const bar = el('div', { class: 'row wrap' }, ...tools.map(([k, n]) => el('button', { class: L3.tool === k ? 'go' : 'alt', onclick: () => { L3.tool = k; L3.asset = k === 'building' ? (bAssets[0] || {}).id : k === 'prop' ? (pAssets[0] || {}).id : L3.asset; renderAll(); } }, n)));
    const opt = (list, cur) => el('select', { onchange: e => { L3.asset = e.target.value; } }, ...list.map(a => { const o = el('option', { value: a.id }, a.name); if (a.id === cur) o.selected = true; return o; }));
    const sz = (k, l, mn, mx) => el('label', {}, l + ' ', el('input', { type: 'number', min: mn, max: mx, value: L3[k], style: 'width:56px', onchange: e => { L3[k] = Math.max(mn, Math.min(mx, +e.target.value)); } }));
    const opts = el('div', { class: 'row wrap' });
    if (L3.tool === 'building') opts.append(opt(bAssets, L3.asset), sz('w', 'Width m', 2, 40), sz('d', 'Depth m', 2, 40), sz('h', 'Height m', 2, 60));
    if (L3.tool === 'prop') opts.append(opt(pAssets, L3.asset));
    if (L3.tool === 'ramp') opts.append(sz('w', 'Width m', 2, 30), sz('d', 'Length m', 2, 30), sz('h', 'Height m', 1, 12), el('label', {}, 'Rises along ', el('select', { onchange: e => { L3.axis = e.target.value; } }, ...['z', 'x'].map(a => { const o = el('option', { value: a }, a === 'z' ? 'north-south' : 'east-west'); if (L3.axis === a) o.selected = true; return o; }))));
    box.append(bar, opts, cv, el('div', { class: 'row wrap' }, el('label', {}, 'Map half-size m ', el('input', { type: 'number', min: 20, max: 120, value: L.half, style: 'width:60px', onchange: e => { L.half = Math.max(20, Math.min(120, +e.target.value)); dirty = true; renderAll(); } })),
        el('button', { class: 'alt', onclick: async () => { await level3dSample(); renderAll(); } }, 'Start from a sample town'), el('button', { class: 'alt', onclick: () => { L.objs = []; dirty = true; renderAll(); } }, 'Clear map'),
        el('span', { class: 'hint' }, L.objs.length + ' objects (the DS engine holds about 290 boxes and 60 pickups / people; extra ones are dropped on export with a warning).')));
    cv.onclick = async e => {
        const r = cv.getBoundingClientRect(), S = r.width / (L.half * 2), x = Math.round((e.clientX - r.left) / S - L.half), z = Math.round((e.clientY - r.top) / S - L.half);
        if (L3.tool === 'spawn') L.spawn = { x, z };
        else if (L3.tool === 'erase') { let bi = -1, bd = 1e9; L.objs.forEach((o, i) => { const d = Math.hypot(o.x - x, o.z - z) - (o.w || 1) / 2; if (d < bd) { bd = d; bi = i; } }); if (bi >= 0 && bd < 4) L.objs.splice(bi, 1); }
        else if (L3.tool === 'building') { const a = bAssets.find(q => q.id === L3.asset); L.objs.push({ t: 'building', id: L3.asset, x, z, w: L3.w, d: L3.d, h: L3.h, col: a ? await assetColor(a.ref, [150, 120, 100]) : [150, 120, 100] }); }
        else if (L3.tool === 'prop') { const a = pAssets.find(q => q.id === L3.asset); L.objs.push({ t: 'prop', id: (L3.asset || 'prop_crate').replace('prop_', ''), x, z, col: a ? await assetColor(a.ref, [150, 120, 100]) : [150, 120, 100] }); }
        else if (L3.tool === 'ramp') L.objs.push({ t: 'ramp', x, z, w: L3.w, d: L3.d, h: L3.h, axis: L3.axis, col: [160, 120, 70] });
        else L.objs.push({ t: L3.tool, x, z });
        dirty = true; level3dDraw(cv); box.querySelector('.hint:last-child') && 0;
    };
    main.append(box); level3dDraw(cv);
}

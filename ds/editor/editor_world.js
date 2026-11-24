/* NOTAREAL Game Studio: 🌍 World builder (open maps, things, rules, items, in-app play). Runs fully offline. */
let wsel = { map: 0, tool: 'ground', tile: 1, tpl: 'npc', ent: null, zoom: 2, lastTile: [2, 2] };
function worldTilesetList() { return [...(LIB.worldsets || []).map(w => ({ id: w.id, name: w.name + ' (top-down)', image: 'lib:' + w.png, cols: w.tiles.map(t => t.col), names: w.tiles.map(t => t.name) })), { id: 'side', name: 'My platform tiles (side view)', image: P.tileset.image, cols: P.tileset.cols, names: P.tileset.names || [] }]; }
function syncWorldTilesets() { P.worldTilesets = Object.fromEntries(worldTilesetList().map(t => [t.id, { image: t.image, cols: t.cols, names: t.names }])); }
function worldTab(main) {
    const box = el('div', { class: 'pane worldpane' });
    if (!P.world) {
        box.append(el('h2', {}, '🌍 World builder'), el('p', {}, 'Build open games: towns, houses, fields, dungeons and side-view stages joined by doors. Put people, enemies, items, chests, shops, signs and triggers on the maps, and give them rules like "when the player talks to Maya, if they have the key, give $50". Everything runs on this computer.'),
            el('div', { class: 'row' }, el('button', { class: 'big', onclick: () => { syncWorldTilesets(); P.world = NRWorld.starterTown(P, (P.style || 'classic') + '_town'); castStarter(); dirty = true; renderAll(); } }, '🏘 Start from the Town starter (town, house, field, side-view cliffs, a quest)'),
                el('button', { class: 'big', onclick: () => { syncWorldTilesets(); P.world = NRWorld.moonlightHoller(P, (P.style || 'classic') + '_town'); castStarter(); dirty = true; renderAll(); } }, '🌙 Moonlight Holler DS preset (bottom screen: map, world, items, chests)'),
                el('button', { class: 'big alt', onclick: () => { syncWorldTilesets(); P.world = NRWorld.newWorld(); P.world.maps.push(NRWorld.newMap('Map 1', 32, 24, 'topdown', (P.style || 'classic') + '_town')); P.world.maps[0].entities.push(NRWorld.entity('start', 4, 4)); dirty = true; renderAll(); } }, '⬜ Empty world')));
        main.append(box); return;
    }
    syncWorldTilesets();
    const Wd = P.world; if (wsel.map >= Wd.maps.length) wsel.map = 0;
    const m = Wd.maps[wsel.map], tsl = worldTilesetList(), ts = tsl.find(t => t.id === m.tileset) || tsl[0];
    // ---------------- left: maps
    const left = el('div', { class: 'wleft' }, el('h3', {}, 'Maps'));
    Wd.maps.forEach((mm, i) => left.append(el('div', { class: 'wmap' + (i === wsel.map ? ' on' : ''), onclick: () => { wsel.map = i; wsel.ent = null; renderAll(); } }, (mm.view === 'side' ? '↔ ' : '⬚ ') + mm.name, el('small', {}, ` ${mm.w}×${mm.h}`))));
    left.append(el('button', { onclick: () => { const nm = NRWorld.newMap('Map ' + (Wd.maps.length + 1), 32, 24, 'topdown', m.tileset === 'side' ? (P.style || 'classic') + '_town' : m.tileset); Wd.maps.push(nm); wsel.map = Wd.maps.length - 1; dirty = true; renderAll(); } }, '+ Top-down map'),
        el('button', { onclick: () => { Wd.maps.push(NRWorld.newMap('Stage ' + (Wd.maps.length + 1), 96, 16, 'side', 'side')); wsel.map = Wd.maps.length - 1; dirty = true; renderAll(); } }, '+ Side-view stage'));
    left.append(el('h3', {}, 'This map'), el('label', {}, 'Name ', el('input', { value: m.name, onchange: e => { m.name = e.target.value; dirty = true; renderAll(); } })),
        el('label', {}, 'Plays as ', el('select', { onchange: e => { m.view = e.target.value; if (m.view === 'side' && m.tileset !== 'side') m.tileset = 'side'; dirty = true; renderAll(); } }, ...[['topdown', 'Top-down (RPG, adventure, town)'], ['side', 'Side view (platformer)']].map(([v, t]) => { const o = el('option', { value: v }, t); if (v === m.view) o.selected = true; return o; }))),
        el('label', {}, 'Tiles ', el('select', { onchange: e => { m.tileset = e.target.value; dirty = true; renderAll(); } }, ...tsl.map(t => { const o = el('option', { value: t.id }, t.name); if (t.id === m.tileset) o.selected = true; return o; }))),
        el('label', {}, 'Intro text (first time the player enters) ', el('textarea', { rows: 2, class: 'wide', oninput: e => { m.intro = e.target.value; dirty = true; } }, m.intro || '')),
        el('label', {}, 'Music ', el('select', { onchange: e => { m.song = +e.target.value; dirty = true; } }, ...P.songs.map((s, i) => { const o = el('option', { value: i }, s.name); if (i === m.song) o.selected = true; return o; }))),
        el('div', { class: 'row' }, el('label', {}, 'W ', el('input', { type: 'number', min: 8, max: 256, value: m.w, style: 'width:56px', onchange: e => { NRWorld.resize(m, Math.max(8, Math.min(256, +e.target.value)), m.h); dirty = true; renderAll(); } })),
            el('label', {}, 'H ', el('input', { type: 'number', min: 8, max: 256, value: m.h, style: 'width:56px', onchange: e => { NRWorld.resize(m, m.w, Math.max(8, Math.min(256, +e.target.value))); dirty = true; renderAll(); } }))),
        Wd.maps.length > 1 ? el('button', { class: 'alt', onclick: () => { if (confirmDel()) { Wd.maps.splice(wsel.map, 1); wsel.map = 0; dirty = true; renderAll(); } } }, '🗑 Delete map') : '');
    left.append(el('h3', {}, 'Player'), ...[['hp', 'Hearts'], ['speed', 'Walk speed'], ['attack', 'Attack power']].map(([k, l]) => el('label', {}, l + ' ', el('input', { type: 'number', step: k === 'speed' ? 0.1 : 1, value: Wd.player[k], style: 'width:60px', onchange: e => { Wd.player[k] = +e.target.value; dirty = true; } }))));
    left.append(el('label', { title: 'DS: the bottom screen shows tabs for Map, World (places found), Items (use / drop) and Chests. Tap the tabs or press L / R.' }, el('input', { type: 'checkbox', ...(Wd.panel ? { checked: '' } : {}), onchange: e => { Wd.panel = e.target.checked; dirty = true; } }), ' Bottom-screen panel (map, world, items, chests)'));
    // ---------------- middle: tools + canvas
    const mid = el('div', { class: 'wmid' });
    const tools = [['text', '💬 Text'], ['ground', '🖌 Floor'], ['over', '🌳 Above player'], ['erase', '🧽 Erase'], ['fill', '🪣 Fill'], ['things', '🧍 Place things'], ['select', '👆 Select / move']];
    mid.append(el('div', { class: 'row wrap' }, ...tools.map(([id, l]) => el('button', { class: wsel.tool === id ? 'on' : 'alt', onclick: () => { wsel.tool = id; renderAll(); } }, l)),
        el('button', { class: 'go', onclick: () => playWorld() }, '▶ Play world'), el('button', { class: 'alt', title: 'Controller-first PC game + Xbox port package', onclick: () => exportPC() }, '🎮 PC / Xbox package'),
        el('label', { title: 'When on, Export ROM makes this World game for the DS (SNES world engine coming).' }, el('input', { type: 'checkbox', ...(P.exportWorld !== false ? { checked: '' } : {}), onchange: e => { P.exportWorld = e.target.checked; dirty = true; } }), ' Export ROM = this world'), el('button', { class: 'alt', onclick: () => playWorld(m.id, wsel.lastTile[0], wsel.lastTile[1]) }, '▶ Play from last click')));
    if (wsel.tool === 'text') mid.append(el('div', { class: 'row wrap texttool' }, el('input', { id: 'wtxt', class: 'wide', placeholder: 'Type a line, e.g.  Maya: The bridge is out!   then click the map', value: wsel.text || '', oninput: e => wsel.text = e.target.value }),
        el('label', {}, el('input', { type: 'checkbox', ...(wsel.textOnce !== false ? { checked: '' } : {}), onchange: e => wsel.textOnce = e.target.checked }), ' only once'),
        el('small', {}, 'Click empty ground: the text shows when the player walks there. Click a person or sign: the line is added to what they say.')));
    if (wsel.tool === 'things') mid.append(el('div', { class: 'row wrap' }, ...Object.entries(NRWorld.TEMPLATES).map(([id, t]) => el('button', { class: wsel.tpl === id ? 'on' : 'alt', title: t.about, onclick: () => { wsel.tpl = id; renderAll(); } }, t.label))));
    else if (wsel.tool !== 'select') {
        const pal = el('div', { class: 'row wrap wpal' });
        ts.cols.forEach((c, i) => { if (!i && wsel.tool !== 'erase') return; const b = el('div', { class: 'pick' + (wsel.tile === i ? ' on' : '') + (c === 3 ? ' danger' : ''), title: (ts.names[i] || 'tile ' + i) + ['', ' (solid)', ' (platform)', ' (hurts)'][c], onclick: () => { wsel.tile = i; renderAll(); } }); thumb(b, ts.image, 16, 16, i, 2); pal.append(b); });
        mid.append(pal);
    }
    const wrap = el('div', { class: 'canvaswrap wcanvas' }), Z = wsel.zoom * 16, cv = el('canvas', { width: m.w * Z, height: m.h * Z, class: 'pix' });
    wrap.append(cv); mid.append(el('div', { class: 'row' }, el('small', {}, 'Zoom '), ...[1, 2, 3].map(z => el('button', { class: wsel.zoom === z ? 'on mini' : 'alt mini', onclick: () => { wsel.zoom = z; renderAll(); } }, z + '×')), el('small', { id: 'wpos' }, '')), wrap);
    (async () => {
        const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; const tim = await loadImage(ts.image); const spr = {}; for (const [k, s] of Object.entries(P.sprites)) spr[k] = { ...s, im: await loadImage(s.image) };
        const draw = () => {
            g.fillStyle = m.view === 'side' ? '#6ab0e8' : '#1d1d26'; g.fillRect(0, 0, cv.width, cv.height);
            for (const layer of ['ground', 'over']) for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const t = m[layer][y * m.w + x]; if (t) { g.globalAlpha = layer === 'over' && wsel.tool !== 'over' ? 0.85 : 1; g.drawImage(tim, t * 16, 0, 16, 16, x * Z, y * Z, Z, Z); } }
            g.globalAlpha = 1;
            for (const e of m.entities) {
                const x = e.x * Z, y = e.y * Z, T = NRWorld.TEMPLATES[e.t];
                if (e.t === 'trigger') { g.strokeStyle = '#f0f'; g.setLineDash([4, 3]); g.strokeRect(x, y, (+e.props.w || 1) * Z, (+e.props.h || 1) * Z); g.setLineDash([]); }
                const sn = e.props.sprite || (e.t === 'start' || e.t === 'npc' || e.t === 'shop' ? 'hero' : T.icon), s = spr[sn];
                if (s && sn !== 'none' && e.t !== 'door' && e.t !== 'sign' && e.t !== 'chest' && e.t !== 'save') g.drawImage(s.im, 0, 0, s.w, s.h, x + Z / 2 - s.w * wsel.zoom / 4, y + Z - s.h * wsel.zoom / 2, s.w * wsel.zoom / 2, s.h * wsel.zoom / 2);
                else { g.fillStyle = { door: '#a0522d', sign: '#c19a6b', chest: '#d4a017', save: '#5ef', trigger: 'rgba(255,0,255,.25)', spawner: '#f44' }[e.t] || '#fff'; g.fillRect(x + 3, y + 3, Z - 6, Z - 6); }
                g.fillStyle = '#fff'; g.font = '9px monospace'; g.fillText({ start: '★', door: '⇥', sign: 'i', chest: '$', save: 'S', trigger: 'T', spawner: '∞' }[e.t] || '', x + 2, y + 10);
                if (e.rules.length) { g.fillStyle = '#7cf'; g.fillRect(x + Z - 5, y + 1, 4, 4); }
                if (wsel.ent === e.id) { g.strokeStyle = '#ff0'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, Z - 2, Z - 2); g.lineWidth = 1; }
            }
            if (wsel.zoom > 1) { g.strokeStyle = 'rgba(255,255,255,.06)'; for (let x = 0; x <= m.w; x++) { g.beginPath(); g.moveTo(x * Z, 0); g.lineTo(x * Z, m.h * Z); g.stroke(); } for (let y = 0; y <= m.h; y++) { g.beginPath(); g.moveTo(0, y * Z); g.lineTo(m.w * Z, y * Z); g.stroke(); } }
        };
        draw();
        let down = false, dragging = null;
        const at = e => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * m.w), Math.floor((e.clientY - r.top) / r.height * m.h)]; };
        const fill = (x, y, layer, t) => { const from = m[layer][y * m.w + x]; if (from === t) return; const st = [[x, y]]; let n = 0; while (st.length && n < 70000) { const [a, b] = st.pop(); if (a < 0 || b < 0 || a >= m.w || b >= m.h || m[layer][b * m.w + a] !== from) continue; m[layer][b * m.w + a] = t; n++; st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); } };
        const act = (e, right) => {
            const [x, y] = at(e); if (x < 0 || y < 0 || x >= m.w || y >= m.h) return; wsel.lastTile = [x, y];
            if (wsel.tool === 'ground' || wsel.tool === 'over') m[wsel.tool][y * m.w + x] = right ? 0 : wsel.tile;
            else if (wsel.tool === 'erase') { m.over[y * m.w + x] = 0; m.ground[y * m.w + x] = 0; }
            else if (wsel.tool === 'fill') fill(x, y, 'ground', right ? 0 : wsel.tile);
            else if (wsel.tool === 'things') { if (right) { m.entities = m.entities.filter(q => !(q.x === x && q.y === y)); } else { if (wsel.tpl === 'start') Wd.maps.forEach(mm => mm.entities = mm.entities.filter(q => q.t !== 'start')); const ne = NRWorld.entity(wsel.tpl, x, y); m.entities.push(ne); wsel.ent = ne.id; dirty = true; renderAll(); return; } }
            else if (wsel.tool === 'text') {
                const txt = (wsel.text || '').trim(); if (!txt) { notify('Type the text first, then click the map.'); return; }
                const on = m.entities.filter(q => q.x === x && q.y === y).pop();
                if (on && 'lines' in on.props && !on.rules.some(r => r.on === 'talk')) on.props.lines = (on.props.lines ? on.props.lines + '\n' : '') + txt;
                else if (on && on.t === 'sign') on.props.text = (on.props.text ? on.props.text + ' ' : '') + txt;
                else if (on && on.rules.some(r => r.on === 'talk')) on.rules.find(r => r.on === 'talk').actions.push({ do: 'say', text: txt });
                else { const t = NRWorld.entity('trigger', x, y); t.props.w = 1; t.props.h = 1; t.props.once = wsel.textOnce !== false; t.rules.push({ on: 'enter', actions: [{ do: 'say', text: txt }] }); m.entities.push(t); }
                wsel.text = ''; dirty = true; renderAll(); return;
            }
            else if (wsel.tool === 'select') { const hit = m.entities.filter(q => q.x === x && q.y === y).pop(); wsel.ent = hit ? hit.id : null; dragging = hit || null; dirty = true; renderAll(); return; }
            dirty = true; draw();
        };
        cv.onmousedown = e => { down = true; act(e, e.button === 2); };
        cv.onmousemove = e => { const [x, y] = at(e); const p = document.getElementById('wpos'); if (p) p.textContent = ` tile ${x}, ${y}`; if (!down) return; if (['ground', 'over', 'erase'].includes(wsel.tool)) act(e, e.buttons === 2); };
        window.onmouseup = e => { down = false; };
        cv.oncontextmenu = e => e.preventDefault();
        cv.ondblclick = e => { if (wsel.tool !== 'select') return; const [x, y] = at(e); const s = m.entities.find(q => q.id === wsel.ent); if (s) { s.x = x; s.y = y; dirty = true; renderAll(); } };
    })();
    if (wsel.tool === 'select') mid.append(el('p', { class: 'hint' }, 'Click a thing to edit it. Double-click an empty tile to move the selected thing there.'));
    // ---------------- right: inspector
    const right = el('div', { class: 'wright' }), sel = m.entities.find(e => e.id === wsel.ent);
    if (sel) right.append(entityInspector(sel, m)); else right.append(el('h3', {}, 'Inspector'), el('p', { class: 'hint' }, 'Place or select a thing to edit what it is and what it does.'));
    right.append(allTextPanel(), itemsEditor());
    const probs = NRWorld.check(Wd);
    right.append(el('h3', {}, '🩺 World check'), probs.length ? el('ul', {}, ...probs.map(p => el('li', {}, p.msg))) : el('p', { class: 'hint' }, 'No problems found.'));
    box.append(el('div', { class: 'wgrid' }, left, mid, right));
    main.append(box);
}
const confirmDel = () => true;
function castStarter() {   /* give the starter town's people their own looks from the library (same art style) */
    const st = P.style || 'classic', pick = n => LIB.sprites.find(x => x.role === 'hero' && (x.style || 'classic') === st && x.id.includes(n)) || LIB.sprites.find(x => x.role === 'hero' && x.id.includes(n));
    const looks = { Maya: 'rebecca', Grandpa: 'steve', Hermit: 'austin', Shop: 'austin' };
    for (const m of P.world.maps) for (const e of m.entities) { const who = looks[e.props.name]; if (!who) continue; const L = pick(who); if (!L) continue; const key = 'npc_' + L.id; P.sprites[key] = spriteRef(L); e.props.sprite = key; }
}
function fieldInput(type, val, set, opts = {}) {
    const W = P.world;
    if (type === 'text') return el(opts.long ? 'textarea' : 'input', { value: val == null ? '' : val, rows: 3, class: 'wide', oninput: e => set(e.target.value) });
    if (type === 'number') return el('input', { type: 'number', value: val == null ? 0 : val, style: 'width:70px', oninput: e => set(+e.target.value) });
    if (type === 'bool') return el('input', { type: 'checkbox', ...(val ? { checked: '' } : {}), onchange: e => set(e.target.checked) });
    const sel = (list) => el('select', { onchange: e => set(e.target.value) }, el('option', { value: '' }, '—'), ...list.map(([v, t]) => { const o = el('option', { value: v }, t); if (String(v) === String(val)) o.selected = true; return o; }));
    if (type === 'map') return sel(W.maps.map(m => [m.id, m.name]));
    if (type === 'item') return sel(W.items.map(i => [i.id, i.name]));
    if (type === 'sprite') { const s = el('select', { onchange: e => { let v = e.target.value; if (v.startsWith('lib:')) { const L = LIB.sprites.find(x => x.id === v.slice(4)); const key = 'npc_' + L.id; P.sprites[key] = spriteRef(L); v = key; } set(v); renderAll(); } }, el('option', { value: '' }, '—'));
        const og1 = el('optgroup', { label: 'This game' }); Object.keys(P.sprites).forEach(k => { const o = el('option', { value: k }, k.replace(/^npc_/, '')); if (k === val) o.selected = true; og1.append(o); }); s.append(og1);
        const og2 = el('optgroup', { label: 'Library characters' }); LIB.sprites.filter(x => x.role === 'hero' || x.role === 'walker' || x.role === 'hopper' || x.role === 'flyer').forEach(x => og2.append(el('option', { value: 'lib:' + x.id }, x.name))); s.append(og2); return s; }
    if (type === 'ai') return sel(Object.entries(NRWorld.AI));
    if (type === 'move') return sel([['stand', 'Stands still'], ['wander', 'Wanders']]);
    if (type === 'song') return el('select', { onchange: e => set(+e.target.value) }, ...P.songs.map((s, i) => { const o = el('option', { value: i }, s.name); if (i === val) o.selected = true; return o; }));
    if (type === 'sfx') return sel(Object.keys(P.sfx || {}).map(k => [k, k]));
    if (type === 'flag') { const id = 'flags' + Math.random().toString(36).slice(2); const i = el('input', { value: val || '', list: id, style: 'width:120px', oninput: e => set(e.target.value) }); return el('span', {}, i, el('datalist', { id }, ...NRWorld.flagsUsed(W).map(f => el('option', { value: f })))); }
    if (type === 'tile') return el('input', { type: 'number', min: 0, value: val || 0, style: 'width:60px', oninput: e => set(+e.target.value) });
    return el('input', { value: val || '', oninput: e => set(e.target.value) });
}
const PROP_TYPES = { name: 'text', lines: 'text', text: 'text', sprite: 'sprite', ai: 'ai', hp: 'number', damage: 'number', speed: 'number', drop: 'text', item: 'item', count: 'number', toMap: 'map', toX: 'number', toY: 'number', needItem: 'item', invisible: 'bool', stock: 'text', w: 'number', h: 'number', once: 'bool', every: 'number', max: 'number', solid: 'bool', move: 'move' };
const PROP_LABEL = { lines: 'What they say (one line each)', drop: 'Drops (money:5 or item:count)', toMap: 'Goes to map', toX: 'Arrive at x', toY: 'Arrive at y', needItem: 'Needs item', invisible: 'Invisible', stock: 'Sells (item:price, …)', every: 'Every (seconds)', max: 'At most', once: 'Only once', w: 'Width (tiles)', h: 'Height (tiles)', ai: 'Behaviour', move: 'Moves' };
function entityInspector(e, m) {
    const T = NRWorld.TEMPLATES[e.t], box = el('div', {});
    box.append(el('h3', {}, T.label), el('p', { class: 'hint' }, T.about), el('small', {}, `at ${e.x}, ${e.y}`));
    for (const [k, v] of Object.entries(e.props)) box.append(el('label', { class: 'prop' }, (PROP_LABEL[k] || k) + ' ', fieldInput(PROP_TYPES[k] || 'text', v, nv => { e.props[k] = nv; dirty = true; }, { long: k === 'lines' || k === 'text' })));
    box.append(el('h3', {}, 'Rules'), el('p', { class: 'hint' }, 'When something happens, do these steps in order. When a person is talked to, the first rule (top to bottom) whose "only if" matches is the one used, so put special cases first.'));
    e.rules.forEach((r, ri) => {
        const rb = el('div', { class: 'rule' });
        const trig = el('select', { onchange: ev => { r.on = ev.target.value; dirty = true; } }, ...[...(T.triggers || []), 'load'].map(t => { const o = el('option', { value: t }, 'When ' + NRWorld.TRIGGERS[t]); if (t === r.on) o.selected = true; return o; }));
        rb.append(el('div', { class: 'row wrap' }, trig, el('button', { class: 'mini alt', onclick: () => { e.rules.splice(ri, 1); dirty = true; renderAll(); } }, '✕')));
        rb.append(condEditor(r.if, c => { r.if = c; dirty = true; }), el('label', {}, el('input', { type: 'checkbox', ...(r.once ? { checked: '' } : {}), onchange: ev => { r.once = ev.target.checked; dirty = true; } }), ' only the first time'));
        rb.append(actionsEditor(r.actions = r.actions || []));
        box.append(rb);
    });
    box.append(el('button', { onclick: () => { e.rules.push({ on: (T.triggers || ['load'])[0] || 'load', actions: [] }); dirty = true; renderAll(); } }, '+ Add a rule'),
        el('button', { class: 'alt', onclick: () => { m.entities = m.entities.filter(q => q !== e); wsel.ent = null; dirty = true; renderAll(); } }, '🗑 Remove this thing'));
    return box;
}
function condEditor(c, set) {
    c = c || {}; const wrap = el('div', { class: 'row wrap cond' }, el('small', {}, 'Only if '));
    const kind = el('select', { onchange: ev => { const k = ev.target.value; set(k ? { kind: k } : null); renderAll(); } }, el('option', { value: '' }, 'always'), ...Object.entries(NRWorld.CONDS).map(([k, l]) => { const o = el('option', { value: k }, l); if (k === c.kind) o.selected = true; return o; }));
    wrap.append(kind);
    if (c.kind === 'has') wrap.append(fieldInput('item', c.item, v => { c.item = v; set(c); }), fieldInput('number', c.n || 1, v => { c.n = v; set(c); }));
    if (c.kind === 'flag' || c.kind === 'notflag') { wrap.append(fieldInput('flag', c.flag, v => { c.flag = v; set(c); })); if (c.kind === 'flag') wrap.append(fieldInput('number', c.value == null ? 1 : c.value, v => { c.value = v; set(c); })); }
    if (c.kind === 'money') wrap.append(fieldInput('number', c.n || 0, v => { c.n = v; set(c); }));
    return wrap;
}
function actionsEditor(list) {
    const box = el('div', { class: 'actions' });
    list.forEach((a, i) => {
        const A = NRWorld.ACTIONS[a.do]; const row = el('div', { class: 'action' }, el('b', {}, (i + 1) + '. ' + A.label));
        for (const [f, type] of Object.entries(A.fields)) {
            if (type === 'actions') { row.append(el('div', { class: 'sub' }, el('small', {}, { yes: 'If Yes:', no: 'If No:', then: 'Then:', else: 'Otherwise:' }[f]), actionsEditor(a[f] = a[f] || []))); continue; }
            if (type === 'cond') { row.append(condEditor(a.test, c => { a.test = c; dirty = true; })); continue; }
            row.append(el('label', {}, ' ' + f + ' ', fieldInput(type, a[f], v => { a[f] = v; dirty = true; }, { long: f === 'text' })));
        }
        row.append(el('span', { class: 'row' }, i > 0 ? el('button', { class: 'mini alt', onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; dirty = true; renderAll(); } }, '↑') : '', el('button', { class: 'mini alt', onclick: () => { list.splice(i, 1); dirty = true; renderAll(); } }, '✕')));
        box.append(row);
    });
    box.append(el('select', { class: 'addaction', onchange: ev => { const k = ev.target.value; if (!k) return; const a = { do: k }; for (const [f, t] of Object.entries(NRWorld.ACTIONS[k].fields)) a[f] = t === 'actions' ? [] : t === 'number' ? (f === 'n' ? 1 : 0) : t === 'cond' ? null : ''; list.push(a); dirty = true; renderAll(); } },
        el('option', { value: '' }, '+ add a step…'), ...Object.entries(NRWorld.ACTIONS).map(([k, A]) => el('option', { value: k }, A.label))));
    return box;
}
let textFilter = '';
function allTextPanel() {
    const W = P.world, all = NRWorld.allText(W).filter(t => !t.intro || t.get()), box = el('details', { class: 'alltext', ...(wsel.textOpen ? { open: '' } : {}), ontoggle: e => wsel.textOpen = e.target.open }, el('summary', {}, `📜 All the words in your game (${all.length})`));
    const q = el('input', { class: 'wide', placeholder: 'Find text…', value: textFilter, oninput: e => { textFilter = e.target.value; list(); } }), holder = el('div', {});
    const list = () => { holder.innerHTML = ''; const f = textFilter.toLowerCase();
        all.filter(t => !f || (t.get() + t.where).toLowerCase().includes(f)).slice(0, 200).forEach(t => holder.append(el('div', { class: 'textrow' },
            el('small', {}, t.where, ' ', el('button', { class: 'mini alt', onclick: () => { wsel.map = W.maps.indexOf(t.map); wsel.ent = t.ent ? t.ent.id : null; wsel.tool = 'select'; renderAll(); } }, 'show')),
            el('textarea', { rows: Math.min(4, 1 + Math.floor(t.get().length / 40)), class: 'wide', oninput: e => { t.set(e.target.value); dirty = true; } }, t.get())))); };
    list(); box.append(el('p', { class: 'hint' }, 'Every line of dialogue, sign, choice and intro in the whole game. Edit any of them here. Start a line with a name and a colon (Maya: …) to show who is talking.'), q, holder);
    return box;
}
function itemsEditor() {
    const W = P.world, box = el('details', { class: 'items' }, el('summary', {}, `🎒 Items (${W.items.length})`));
    W.items.forEach((it, i) => box.append(el('div', { class: 'row wrap' }, el('input', { value: it.id, style: 'width:70px', title: 'id', onchange: e => { it.id = e.target.value.replace(/\W/g, '_'); dirty = true; } }), el('input', { value: it.name, style: 'width:90px', onchange: e => { it.name = e.target.value; dirty = true; } }),
        el('select', { onchange: e => { it.kind = e.target.value; dirty = true; } }, ...[['stuff', 'thing'], ['key', 'key item'], ['heal', 'heals'], ['money', 'money']].map(([v, t]) => { const o = el('option', { value: v }, t); if (v === it.kind) o.selected = true; return o; })),
        el('input', { type: 'number', value: it.value, style: 'width:46px', title: 'value', onchange: e => { it.value = +e.target.value; dirty = true; } }), el('input', { type: 'color', value: it.color || '#ffffff', onchange: e => { it.color = e.target.value; dirty = true; } }),
        el('button', { class: 'mini alt', onclick: () => { W.items.splice(i, 1); dirty = true; renderAll(); } }, '✕'))));
    box.append(el('button', { onclick: () => { W.items.push({ id: 'item' + (W.items.length + 1), name: 'New item', kind: 'stuff', value: 0, color: '#88ccff' }); dirty = true; renderAll(); } }, '+ Item'));
    return box;
}
let worldGame = null;
async function playWorld(mapId, x, y) {
    if (!P.world || !P.world.maps.length) return;
    syncWorldTilesets();
    const cv = el('canvas', { width: 256, height: 192, class: 'pix play' }), info = el('p', { class: 'hint' }, 'Arrows move · Z / Space: talk, attack, jump, confirm · X: run / back · C: bag (use potions) · Esc closes. Same rules the console engines will follow.');
    const keys = {}, imgs = {};
    for (const [k, s] of Object.entries(P.sprites)) { imgs[k] = await loadImage(s.image); if (s.td) imgs[k + '__td'] = await loadImage(s.td); }
    for (const t of worldTilesetList()) imgs['__ts_' + t.id] = await loadImage(t.image);
    if (P.background) imgs.__bg = await loadImage(P.background);
    const kd = e => { keys[e.key] = true; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault(); if (e.key === 'Escape') close(); };
    const ku = e => { keys[e.key] = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    const close = () => { if (worldGame) worldGame.stop(); stopSong(); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); mdl.remove(); };
    const sfxPlay = k => { try { const r = P.sfx && P.sfx[k]; if (r) { const a = new Audio(libUrl(r)); a.volume = 0.5; a.play(); } } catch (e) {} };
    const mdl = modal('▶ ' + (P.meta.title || 'World'), el('div', {}, cv, info), [['Close', () => { close(); return false; }, 'alt']]);
    worldGame = NRWorld.play(cv, P, { keys, images: imgs, map: mapId, x, y, music: n => { if (P.songs[n]) playSong(P.songs[n]); }, sound: sfxPlay });
    window.__world = worldGame; window.__worldKeys = keys;
}

/* ------------------------------------------------------------------ PC / Xbox package */
async function pcContext() {
    syncWorldTilesets(); const images = {}, sfx = {};
    for (const [k, sp] of Object.entries(P.sprites)) { images[k] = libUrl(sp.image); if (sp.td) images[k + '__td'] = libUrl(sp.td); }
    for (const t of worldTilesetList()) images['__ts_' + t.id] = libUrl(t.image);
    if (P.background) images.__bg = libUrl(P.background);
    for (const [k, ref] of Object.entries(P.sfx || {})) if (ref) sfx[k] = libUrl(ref);
    const logo = (document.querySelector('header img') || {}).src || '';
    return { images, sfx, logo, openTop: P.opening && P.opening.top ? libUrl(P.opening.top) : null, renderSong: s => NRMusic.renderSong(s, 32768, 1), sources: effectiveSources() };
}
async function exportPC() {
    if (!P) return;
    let Q = P;
    if (!P.world || !P.world.maps.length) {
        if (!P.levels || !P.levels.length) { notify('Make a World or platformer game first.'); return; }
        Q = JSON.parse(JSON.stringify(P)); NRWorld.fromPlatformer(Q, true); syncWorldTilesets(); Q.worldTilesets = P.worldTilesets;     // platformer levels become side-view World maps
    }
    const chk = NRPc.xboxCheck(Q);
    const m = modal('🎮 PC / Xbox package', el('div', {}, el('p', { class: 'hint' }, 'Makes a folder you can zip and share: the game as a web page that plays with an Xbox controller (works offline on PC), plus the game as plain data, PNG and WAV files for an Xbox port, and a guide.'),
        el('ul', {}, ...chk.map(c => el('li', { style: c.ok ? '' : 'color:#ffd37a' }, (c.ok ? '✔ ' : '⚠ ') + c.msg + (c.ok ? '' : ' ' + c.fix)))),
        el('p', { class: 'hint' }, 'Xbox store: new UWP games are reported as no longer accepted, so a store release goes through ID@Xbox and a GDK port. The package is built to make that port a runtime job, not a redesign. Details are in xbox/XBOX_PORT_GUIDE.md inside the zip.')),
        [['Cancel', () => true, 'alt'], ['Build package', () => { (async () => { try { const pk = NRPc.buildPackage(Q, await pcContext()); await download(pk.slug + '_pc_xbox.zip', pk.zip(), 'application/zip'); notify(`Package built (${(pk.bytes / 1048576).toFixed(1)} MB): open ${pk.slug}/index.html or windows/play_edge.bat.`); } catch (e) { notify('Could not build the package: ' + e.message); } })(); return true; }, 'go']]);
}

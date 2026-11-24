/* ------------------------------------------------------------------ shared asset library (every game type, every console)
   Skylines, land types, buildings and props are chosen once per project (P.assets) or imported from your own art. The engines read them:
   DS 3D engines get an ASET block (kit/nrassets.js); the 2D engines get the backdrop as P.background. */
const ASSET_CATS = [
    { id: 'sky', label: '🌆 Skylines & backgrounds', size: [256, 96], pick: 'the backdrop behind the game', slot: 'sky' },
    { id: 'land', label: '🟩 Land types (ground, floors, roads, mats)', size: [32, 32], pick: 'the ground / floor', slot: 'land' },
    { id: 'building', label: '🏢 Buildings', size: [48, 64], pick: 'buildings in this game', multi: 'buildings' },
    { id: 'prop', label: '🌳 Objects & props', size: [24, 24], pick: 'objects in this game', multi: 'props' }];
function assetsInit() { P.assets = P.assets || {}; const A = P.assets; A.sky = A.sky || null; A.land = A.land || null; A.wall = A.wall || null; A.buildings = A.buildings || []; A.props = A.props || []; A.imports = A.imports || { sky: [], land: [], building: [], prop: [] }; for (const k of ['sky', 'land', 'building', 'prop']) A.imports[k] = A.imports[k] || []; return A; }
const assetList = cat => [...((LIB.assetpack || {})[cat] || []).map(e => ({ id: e.id, name: e.name, ref: 'lib:' + e.png, own: false })), ...assetsInit().imports[cat].map(e => ({ id: e.id, name: e.name + ' (yours)', ref: e.image, own: true }))];
async function assetFromFile(cat, file) {
    const url = URL.createObjectURL(file), im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }), C = ASSET_CATS.find(c => c.id === cat), [w, h] = C.size;
    const c = el('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    if (cat === 'prop' || cat === 'building') { const s = Math.min(w / im.width, h / im.height); g.drawImage(im, (w - im.width * s) / 2, h - im.height * s, im.width * s, im.height * s); } else g.drawImage(im, 0, 0, w, h);
    URL.revokeObjectURL(url); return { id: cat + '_mine_' + Date.now(), name: file.name.replace(/\.[^.]+$/, '').slice(0, 24), image: c.toDataURL('image/png') };
}
async function assetBackdrop() {   // the skyline as the 256x192 backdrop the 2D engines use
    const A = assetsInit(); if (!A.sky) return; const im = await loadImage(A.sky), c = el('canvas'); c.width = 256; c.height = 192; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const t = g.createLinearGradient(0, 0, 0, 192); g.fillStyle = '#000'; g.drawImage(im, 0, 192 - 144, 256, 144); const top = g.getImageData(0, 192 - 144, 1, 1).data; g.fillStyle = `rgb(${top[0]},${top[1]},${top[2]})`; g.fillRect(0, 0, 256, 192 - 144); g.drawImage(im, 0, 192 - 144, 256, 144);
    P.background = c.toDataURL('image/png');
}
async function assetPreview(cv) {
    const A = assetsInit(), g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#3a4a66'; g.fillRect(0, 0, cv.width, cv.height);
    if (A.sky) g.drawImage(await loadImage(A.sky), 0, 0, cv.width, 96 * cv.width / 256);
    const gy = Math.round(96 * cv.width / 256) - 4; if (A.land) { const im = await loadImage(A.land); for (let x = 0; x < cv.width; x += 32) for (let y = gy; y < cv.height; y += 32) g.drawImage(im, x, y, 32, 32); } else { g.fillStyle = '#5a9a50'; g.fillRect(0, gy, cv.width, cv.height - gy); }
    let x = 8; for (const id of A.buildings) { const e = assetList('building').find(q => q.id === id); if (!e) continue; const im = await loadImage(e.ref); g.drawImage(im, x, gy - 40, 48, 64); x += 56; }
    x = 8; for (const id of A.props) { const e = assetList('prop').find(q => q.id === id); if (!e) continue; const im = await loadImage(e.ref); g.drawImage(im, x, gy + 30, 24, 24); x += 30; }
}
function assetsTab(main) {
    const A = assetsInit(), box = el('div', { class: 'pane' });
    box.append(el('h2', {}, '🧰 Asset library'), el('p', { class: 'hint' }, 'One shared library for every game type and console: skylines, land types, buildings and props, premade or your own art. What you pick here is used by the 3D engines (ground, skyline, building walls), the 2D engines (backdrop) and the minigames. Import your own picture in any section and it works exactly like the premade ones.'));
    const prev = el('canvas', { width: 512, height: 220, style: 'width:100%;max-width:512px;border-radius:8px;image-rendering:pixelated;display:block;margin:6px 0' }); box.append(el('h3', {}, 'Your scene so far'), prev); assetPreview(prev);
    const refresh = async () => { dirty = true; await assetBackdrop(); renderAll(); };
    for (const C of ASSET_CATS) {
        const items = assetList(C.id), row = el('div', { class: 'row wrap' });
        box.append(el('h3', {}, C.label), el('p', { class: 'hint' }, 'Click to choose ' + C.pick + (C.multi ? ' (click again to remove).' : '.')));
        for (const it of items) {
            const on = C.multi ? A[C.multi].includes(it.id) : A[C.slot] === it.ref, w = C.id === 'sky' ? 128 : C.id === 'building' ? 48 : C.id === 'land' ? 48 : 36;
            const d = el('div', { class: 'pick' + (on ? ' on' : ''), title: it.name, style: 'padding:3px;text-align:center;font-size:10px', onclick: () => { if (C.multi) { const l = A[C.multi], i = l.indexOf(it.id); if (i >= 0) l.splice(i, 1); else l.push(it.id); } else A[C.slot] = on ? null : it.ref; refresh(); } },
                el('img', { src: libUrl(it.ref), style: `width:${w}px;image-rendering:pixelated;display:block;margin:auto;background:#222` }), el('div', {}, it.name));
            if (C.id === 'land') d.append(el('button', { style: 'font-size:10px;margin-top:2px', title: 'Use this as the walls of buildings', onclick: e => { e.stopPropagation(); A.wall = A.wall === it.ref ? null : it.ref; refresh(); } }, A.wall === it.ref ? '✓ walls' : 'as walls'));
            row.append(d);
        }
        const inp = el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: async e => { const f = e.target.files[0]; if (!f) return; const ent = await assetFromFile(C.id, f); A.imports[C.id].push(ent); if (C.multi) A[C.multi].push(ent.id); else A[C.slot] = ent.image; refresh(); } });
        box.append(row, inp, el('button', { onclick: () => inp.click() }, '+ Import your own ' + C.label.replace(/^\S+\s/, '').split(' ')[0].toLowerCase() + ' art…'));
    }
    box.append(el('h3', {}, 'Where it goes'), el('p', { class: 'hint' }, 'DS 3D engines (3D world, skating, wrestling): ground, skyline and building walls are written into the ROM. 2D engines: the skyline becomes the backdrop. Buildings and props are saved with the project for the level tools and engines that place objects. Skyline and land are shown in the scene preview above.'));
    main.append(box);
}
/* decoded picks for the DS engines, and a block with the ASET section attached */
async function assetsForExport() { const A = assetsInit(), out = {}; for (const [k, ref] of [['sky', A.sky], ['land', A.land], ['wall', A.wall]]) out[k] = ref ? await imageData(ref) : null; return out; }
async function withAssets(block) { if (!P || !P.assets) return block; const sel = await assetsForExport(); if (!sel.sky && !sel.land && !sel.wall) return block; return NRAssets.attach(block, NRAssets.payload(sel)); }

function assetsDataUrls() { const A = P && P.assets; if (!A || (!A.sky && !A.land)) return null; return { sky: A.sky ? libUrl(A.sky) : null, land: A.land ? libUrl(A.land) : null }; }

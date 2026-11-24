/* Research Lab > Graphics Reverse Engineer (v1.0). Everything runs on this computer. Pictures are drawn on screen only; the library keeps numbers. */
const reClamp = (v, a, b) => v < a ? a : v > b ? b : v;
const RES = { d: null, name: '', plat: '', A: null, fmt: 'snes4', off: 0, cols: 16, rows: 24, pal: 'auto', zoom: 3, bw: 64, bh: 64, rec: null, status: '' };
const RE_PLATS = { snes: 'Super Nintendo', gb: 'Game Boy', gbc: 'Game Boy Color', gba: 'Game Boy Advance', nds: 'Nintendo DS', n64: 'Nintendo 64', psx: 'PlayStation', nes: 'NES' };
function reAdvice(plat) { const lib = { games: labLoad().filter(r => r.re).map(r => r.re) }; return NRRE.lib.advice(lib, plat); }
/* "Follow my library" art styles: the Graphics tab can shade new art the way real games on that console do */
function reRefreshStyles() { try { for (const k of Object.keys(NRGfx.STYLES)) if (k.startsWith('lib_')) delete NRGfx.STYLES[k]; for (const p of Object.keys(RE_PLATS)) { const a = reAdvice(p); if (a) NRGfx.STYLES['lib_' + p] = Object.assign(NRRE.lib.styleFor(a, 'shaded'), { label: 'Follow my graphics library: ' + RE_PLATS[p] }); } } catch (e) {} }
function reSaveRecord() {
    const R = RES; if (!R.rec) return false; const db = labLoad(), id = R.name + ':' + R.d.length; let rec = db.find(x => x.id === id);
    const uses = R.rec.lines.map(t => ({ area: 'Graphic design', text: t }));
    if (!rec) { rec = { id, name: R.name.replace(/\.[^.]+$/, ''), file: R.name, platform: RE_PLATS[R.plat] || R.plat, genre: '', size: R.d.length, scanned: new Date().toISOString().slice(0, 10), uses: [], tech: [], formats: {}, functions: [] }; db.push(rec); }
    rec.uses = (rec.uses || []).filter(u => !(u.area === 'Graphic design' && u.re)).concat(uses.map(u => Object.assign(u, { re: true }))); rec.re = R.rec; labSave(db); reRefreshStyles(); return true;
}
function reCanvas(info) {
    const R = RES, c = el('canvas', { style: 'image-rendering:pixelated;background:#000;border:1px solid #333;max-width:100%' });
    if (!R.d) return c; let img, pals = [];
    if (/^bmp/.test(R.fmt)) img = NRRE.renderBitmap(R.d, { off: R.off, width: R.bw, height: R.bh, be: R.fmt === 'bmp5551be' });
    else {
        const f = NRRE.FMT[R.fmt]; let pal = null;
        if (f.colors > 4 && R.plat !== 'nes') { pals = NRGfx._int.findPalettes(R.d, Math.max(0, R.off - 0x10000), Math.min(R.d.length, R.off + 0x30000), 16, { maxMs: 300 });
            if (R.pal === 'auto' && pals.length) { const p = NRGfx._int.bestPalette(R.d, { start: R.off, end: R.off + R.cols * R.rows * f.bytes }, f, pals) || NRGfx._int.nearestPalette(pals, R.off); pal = p && p.colors; info.palOff = p && p.off; }
            else if (R.pal !== 'gray' && R.pal !== 'auto') { const p = pals.find(x => String(x.off) === R.pal); pal = p && p.colors; info.palOff = p && p.off; } }
        img = NRRE.render(R.d, { off: R.off, fmt: R.fmt, cols: R.cols, rows: R.rows, pal, opaque: true }); info.pals = pals; info.pal = pal;
    }
    c.width = img.w; c.height = img.h; c.style.width = img.w * R.zoom + 'px'; c.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0); info.img = img; return c;
}
function reGfxPanel() {
    const R = RES, box = el('div', { class: 'gfxpanel' }), body = el('div'), status = el('p', { class: 'hint' }, R.status);
    box.append(el('h3', {}, '🧬 Graphics Reverse Engineer'), el('p', { class: 'hint' }, 'Load a ROM and the tool works out how its art is stored: tile format, picture width, palettes, background maps and animation sizes. You can also browse the ROM by hand. Pictures are drawn on screen only and are never saved. The library keeps measurements and techniques, so future games can be built the same way without copying anything.'));
    const draw = () => {
        body.innerHTML = ''; if (!R.d) return; const info = {}, canvas = reCanvas(info), bmp = /^bmp/.test(R.fmt), f = bmp ? null : NRRE.FMT[R.fmt], tileBytes = f ? f.bytes : 0;
        const num = (label, key, min, max, w = 60) => el('label', { class: 'rf' }, label + ' ', el('input', { type: 'number', value: R[key], min, max, style: 'width:' + w + 'px', onchange: e => { R[key] = reClamp(+e.target.value || min, min, max); draw(); } }));
        const page = bmp ? R.bw * R.bh * 2 : R.cols * R.rows * tileBytes, rowB = bmp ? R.bw * 2 : R.cols * tileBytes, go = o => { R.off = reClamp(o, 0, Math.max(0, R.d.length - 64)); draw(); };
        const offIn = el('input', { value: R.off.toString(16).toUpperCase(), style: 'width:90px;font-family:monospace', onchange: e => go(parseInt(e.target.value, 16) || 0) });
        const fsel = el('select', { onchange: e => { R.fmt = e.target.value; draw(); } }, ...Object.entries(NRRE.FMT_NAMES).map(([k, v]) => el('option', Object.assign({ value: k }, R.fmt === k ? { selected: '' } : {}), v)), el('option', Object.assign({ value: 'bmp5551be' }, R.fmt === 'bmp5551be' ? { selected: '' } : {}), '16-bit picture (N64, big-endian)'), el('option', Object.assign({ value: 'bmp555le' }, R.fmt === 'bmp555le' ? { selected: '' } : {}), '16-bit picture (GBA/DS, little-endian)'));
        const psel = el('select', { onchange: e => { R.pal = e.target.value; draw(); } }, el('option', Object.assign({ value: 'auto' }, R.pal === 'auto' ? { selected: '' } : {}), 'Palette: best match'), el('option', Object.assign({ value: 'gray' }, R.pal === 'gray' ? { selected: '' } : {}), 'Palette: grey'), ...(info.pals || []).map(p => el('option', Object.assign({ value: String(p.off) }, R.pal === String(p.off) ? { selected: '' } : {}), 'Palette at ' + p.off.toString(16).toUpperCase())));
        const bar = el('div', { class: 'row wrap' }, el('button', { class: 'mini alt', onclick: () => go(R.off - page) }, '⏮ page'), el('button', { class: 'mini alt', onclick: () => go(R.off - rowB) }, '▲ row'), el('button', { class: 'mini alt', onclick: () => go(R.off + rowB) }, '▼ row'), el('button', { class: 'mini alt', onclick: () => go(R.off + page) }, 'page ⏭'),
            el('label', { class: 'rf' }, 'Offset (hex) ', offIn), fsel, bmp ? num('Width px', 'bw', 8, 512) : num('Tiles wide', 'cols', 1, 64), bmp ? num('Height px', 'bh', 8, 512) : num('Rows', 'rows', 1, 64), num('Zoom', 'zoom', 1, 6, 40));
        if (!bmp) bar.append(psel);
        const out = el('div', { class: 'hint' }, `Showing bytes ${R.off.toString(16).toUpperCase()} to ${(R.off + page).toString(16).toUpperCase()}${info.palOff != null ? ' · palette at ' + info.palOff.toString(16).toUpperCase() : ''}`);
        const tools = el('div', { class: 'row wrap' },
            el('button', { class: 'alt', onclick: () => { if (bmp) { const g = NRRE.guessBitmap(R.d, R.off, { be: R.fmt === 'bmp5551be' }); if (g) { R.bw = g.width; out.textContent = `Best width: ${g.width} pixels (others: ${g.candidates.slice(1).map(c => c.width).join(', ')})`; draw(); } } else { const r = NRRE.detectFormat(R.d, R.off, 96, NRRE.PLAT_FORMATS[R.plat] || Object.keys(NRRE.FMT)); if (r.length) { let best = r[0].fmt; if (best === 'gb2' && R.plat === 'snes' && NRRE.planeCorr(R.d, R.off, 64) > 0.12) best = 'snes4'; R.fmt = best; const w = NRRE.guessWidth(R.d, R.off, R.fmt, 256); if (w) R.cols = w.width; draw(); } } } }, '🔎 Detect format and width here'),
            el('button', { class: 'alt', onclick: () => { if (bmp) return; const m = NRRE.measure(R.d, { off: R.off, len: page, fmt: R.fmt }, info.pal); out.textContent = m ? `${m.tiles} tiles · ${m.unique} unique · reuse ${Math.round(m.reuse * 100)}% · mirror reuse ${Math.round(m.flipReuse * 100)}% · ${m.colorsPerTile} colours per tile · ${m.bpp} bits per pixel${m.shading ? ' · ramps ' + m.shading.ramps + ' × ' + m.shading.rampLen + ' steps' : ''}` : 'Not enough picture data in view.'; } }, '📏 Measure this view'),
            el('button', { class: 'alt', onclick: () => { if (bmp) return; const a = NRRE.animation(R.d, R.off, R.fmt, 256); out.textContent = a ? `Animation frames of about ${a.frameTiles} tiles; ${Math.round(a.changeRate * 100)}% of pixels change between frames.` : 'No repeating animation frames found here.'; } }, '🎞 Find animation frame size'));
        canvas.onwheel = e => { e.preventDefault(); go(R.off + Math.sign(e.deltaY) * rowB * (e.shiftKey ? R.rows : 1)); };
        body.append(bar, tools, out, el('div', { style: 'overflow:auto;max-height:70vh' }, canvas));
    };
    const load = el('button', { class: 'big', onclick: async () => {
        const f = await pickFile('.nds,.gba,.gb,.gbc,.sfc,.smc,.nes,.z64,.n64,.v64,.bin,.iso,.img,*/*'); if (!f) return;
        R.d = new Uint8Array(await f.arrayBuffer()); R.name = f.name; R.A = null; R.rec = null; let p = NRLab.detect(R.d); if (/\.nes$/i.test(f.name)) p = 'nes'; R.plat = p === 'unknown' ? 'snes' : p === 'psxexe' ? 'psx' : p; R.off = 0;
        R.fmt = (NRRE.PLAT_FORMATS[R.plat] || ['bmp5551be'])[0]; if (R.plat === 'n64') R.fmt = 'bmp5551be'; if (R.plat === 'psx') R.fmt = 'bmp555le'; R.status = `${f.name}: ${(R.d.length / 1048576).toFixed(1)} MB, looks like ${RE_PLATS[R.plat] || R.plat}. Press "Analyze" or browse by hand.`; renderAll(); } }, '📥 Load a ROM…');
    const platSel = el('select', { onchange: e => { R.plat = e.target.value; R.fmt = (NRRE.PLAT_FORMATS[R.plat] || [R.plat === 'n64' ? 'bmp5551be' : 'bmp555le'])[0]; draw(); } }, ...Object.entries(RE_PLATS).map(([k, v]) => el('option', Object.assign({ value: k }, R.plat === k ? { selected: '' } : {}), v)));
    const an = el('button', { class: 'go', onclick: async () => {
        if (!R.d) { notify('Load a ROM first.'); return; } an.disabled = true; status.textContent = 'Analyzing… this can take up to half a minute for big ROMs.'; await new Promise(r => setTimeout(r, 40));
        try { R.A = NRRE.analyze(R.d, R.plat); R.rec = NRRE.record(R.A, { id: R.name + ':' + R.d.length, name: R.name.replace(/\.[^.]+$/, '') }); R.status = `Found ${R.A.assets.length} graphic regions, ${R.A.maps.length} background maps, ${R.A.palettes.length} palettes in ${(R.A.ms / 1000).toFixed(1)} s.${R.A.notes.length ? ' ' + R.A.notes.join(' ') : ''}`; } catch (e) { R.status = 'Analysis failed: ' + e.message; }
        renderAll(); } }, '🧪 Analyze this ROM');
    box.append(el('div', { class: 'row wrap' }, load, platSel, an), status);
    if (R.A && R.rec) {
        box.append(el('b', {}, 'What this game does'), el('ul', {}, ...R.rec.lines.map(t => el('li', {}, t))),
            el('div', { class: 'row wrap' }, el('button', { class: 'go', onclick: () => { reSaveRecord(); status.textContent = 'Saved to your graphics library (numbers only).'; renderAll(); } }, '💾 Save measurements to my library'),
                el('button', { class: 'alt', onclick: () => download(R.name.replace(/\.[^.]+$/, '') + '_graphics.json', JSON.stringify(R.rec, null, 1), 'application/json') }, '⬇ Export the measurements (JSON)')));
        const list = el('details', {}, el('summary', {}, `Graphic regions (${R.A.assets.length}) - click one to look at it`)), tb = el('div', { style: 'max-height:260px;overflow:auto;font-family:monospace;font-size:12px' });
        for (const a of R.A.assets.slice().sort((x, y) => y.len - x.len)) tb.append(el('div', { class: 'songchip', style: 'cursor:pointer;display:block', onclick: () => { R.off = a.off; R.fmt = a.fmt; R.cols = a.width; R.rows = Math.min(48, Math.ceil(a.len / NRRE.FMT[a.fmt].bytes / a.width)); R.pal = a.palette != null ? String(a.palette) : 'auto'; draw(); body.scrollIntoView(); } },
            `${a.off.toString(16).toUpperCase().padStart(7, '0')}  ${String(a.len).padStart(7)} bytes  ${a.fmt.padEnd(6)} ${a.kind.padEnd(16)} ${a.width} wide  ${Math.round(a.confidence * 100)}%`));
        list.append(tb); box.append(list);
        if (R.A.maps.length) box.append(el('details', {}, el('summary', {}, `Background maps (${R.A.maps.length})`), el('pre', {}, R.A.maps.slice(0, 60).map(m => `${m.off.toString(16).toUpperCase().padStart(7, '0')}  ${m.entries} entries, ${m.tilesUsed} tiles, ${Math.round(m.flipRate * 100)}% flipped, ${m.paletteBanks} palette banks`).join('\n'))));
    }
    const lines = []; for (const p of Object.keys(RE_PLATS)) { const a = reAdvice(p); if (a) lines.push(el('div', { class: 'famrow' }, el('b', {}, RE_PLATS[p]), el('ul', {}, ...a.lines.map(t => el('li', {}, t))))); }
    if (lines.length) box.append(el('h4', {}, '📚 Your graphics library: design budgets from the games you fed it'), el('p', { class: 'hint' }, 'The Graphics tab now has a "Follow my graphics library" style for each console listed here.'), ...lines);
    box.append(body); draw(); return box;
}

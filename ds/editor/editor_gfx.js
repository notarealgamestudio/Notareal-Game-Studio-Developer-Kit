/* ------------------------------------------------------------------ Graphics tab: upgrade art, grade art, make textures, and the graphic design database (all offline) */
const gfxS = { key: 'hero', src: null, srcName: '', style: 'shaded', con: 'snes', outline: 'style', ramp: 0, hue: -1, light: 'tl', dither: false, rim: null, gloss: null, pad: false, out: null,
    tex: { kind: 'brick', size: 32, colors: 8, con: 'psx', seed: 1, dither: true } };
const LIGHTS = { tl: [-0.55, -0.7], t: [0, -0.9], tr: [0.55, -0.7], l: [-0.9, 0], r: [0.9, 0] };
const gfxDB = () => [...CODEDB, ...labLoad()];
function gfxOpts() {
    const o = { style: gfxS.style, console: gfxS.con, light: LIGHTS[gfxS.light], dither: gfxS.dither || undefined, pad: gfxS.pad };
    if (gfxS.outline !== 'style') o.outline = gfxS.outline; if (gfxS.ramp) o.ramp = gfxS.ramp; if (gfxS.hue >= 0) o.hueShift = gfxS.hue; if (gfxS.rim != null) o.rim = gfxS.rim; if (gfxS.gloss != null) o.gloss = gfxS.gloss;
    return o;
}
function drawRGBA(img, scale, label) {
    const c = el('canvas', { class: 'pix' }); c.width = img.w; c.height = img.h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.w, img.h), 0, 0);
    c.style.cssText = `width:${img.w * scale}px;height:${img.h * scale}px;image-rendering:pixelated;background:repeating-conic-gradient(#3a3a46 0 25%,#2e2e38 0 50%) 0 0/12px 12px;border-radius:6px`;
    return el('div', { class: 'gfxbox' }, el('small', {}, label), el('br'), c);
}
async function gfxLoadFromProject(key) { const s = P && P.sprites[key]; if (!s) return; gfxS.key = key; gfxS.src = await imageData(s.image); gfxS.srcName = key; gfxRun(); }
function gfxRun() { if (!gfxS.src) { gfxS.out = null; return; } try { gfxS.out = NRGfx.upgrade(gfxS.src, gfxOpts()); } catch (e) { gfxS.out = null; gfxS.err = e.message; } }
function statRow(label, a, b, fmt = v => v, better) {
    const worse = a != null && b != null && better && ((better === 'lo' && b > a) || (better === 'hi' && b < a));
    return el('tr', {}, el('td', {}, label), el('td', {}, a == null ? '–' : fmt(a)), el('td', { style: worse ? 'color:#ff9a9a' : (a != null && b != null && a !== b ? 'color:#8ee59a' : '') }, b == null ? '–' : fmt(b)));
}
function gfxUpgradePanel() {
    const box = el('div', { class: 'gfxpanel' }), keys = P ? Object.keys(P.sprites) : [];
    const sel = el('select', { onchange: e => gfxLoadFromProject(e.target.value).then(renderAll) }, ...keys.map(k => { const o = el('option', { value: k }, k); if (k === gfxS.key && !gfxS.srcName.startsWith('upload:')) o.selected = true; return o; }));
    if (!gfxS.src && keys.length) gfxLoadFromProject(keys.includes('hero') ? 'hero' : keys[0]).then(renderAll);
    const opt = (label, id, items, key) => el('label', { class: 'gfxopt' }, label + ' ', el('select', { id, onchange: e => { gfxS[key] = isNaN(+e.target.value) || e.target.value === '' ? e.target.value : +e.target.value; gfxRun(); renderAll(); } }, ...items.map(([v, t]) => { const o = el('option', { value: v }, t); if (String(gfxS[key]) === String(v)) o.selected = true; return o; })));
    box.append(el('h3', {}, '🎨 Upgrade art'), el('p', { class: 'hint' }, 'Turns flat, blocky sprites into shaded art using what the lab measured in real games: shade steps with a hue shift, one light source, rounded volume, a selective outline, and the colour limit of the console you pick. Works on your project sprites or any PNG. Everything happens on this computer.'),
        el('div', { class: 'row wrap' }, el('label', {}, 'Sprite ', sel), el('button', { class: 'alt', onclick: async () => { const f = await pickFile('image/*'); if (!f) return; const im = new Image(); im.onload = async () => { gfxS.src = await imageDataFromImg(im); gfxS.srcName = 'upload:' + f.name; gfxS.pad = true; gfxRun(); renderAll(); }; im.src = await fileToDataUrl(f); } }, '📂 Use my own PNG…')),
        el('div', { class: 'row wrap' },
            opt('Style', 'g_style', Object.entries(NRGfx.STYLES).map(([k, v]) => [k, v.label]), 'style'),
            opt('Console', 'g_con', Object.entries(NRGfx.CONSOLES).map(([k, v]) => [k, `${v.name} (${v.colors} colours)`]), 'con'),
            opt('Outline', 'g_out', [['style', 'by style'], ['selout', 'selective'], ['dark', 'dark'], ['none', 'none']], 'outline'),
            opt('Shade steps', 'g_ramp', [[0, 'by style'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7']], 'ramp'),
            opt('Hue shift', 'g_hue', [[-1, 'by style'], [0, 'none'], [10, 'light'], [16, 'medium'], [22, 'strong'], [30, 'max']], 'hue'),
            opt('Light from', 'g_light', [['tl', 'top-left'], ['t', 'top'], ['tr', 'top-right'], ['l', 'left'], ['r', 'right']], 'light'),
            el('label', { class: 'gfxopt' }, el('input', { type: 'checkbox', checked: gfxS.dither, onchange: e => { gfxS.dither = e.target.checked; gfxRun(); renderAll(); } }), ' dither'),
            el('label', { class: 'gfxopt', title: 'Single sprites only: adds a 1 pixel ring so the outline can go outside the shape' }, el('input', { type: 'checkbox', checked: gfxS.pad, onchange: e => { gfxS.pad = e.target.checked; gfxRun(); renderAll(); } }), ' outer outline (single sprites)')));
    box.lastChild.querySelectorAll('input[type=checkbox]').forEach((c, i) => c.checked = i === 0 ? gfxS.dither : gfxS.pad);
    if (!gfxS.src) { box.append(el('p', { class: 'hint' }, P ? 'Pick a sprite or load a PNG.' : 'Open or create a game first, or load a PNG above.')); return box; }
    if (!gfxS.out) { box.append(el('p', { class: 'hint' }, 'Could not process this image' + (gfxS.err ? ': ' + gfxS.err : '') + '.')); return box; }
    const s = Math.max(1, Math.min(8, Math.floor(520 / Math.max(gfxS.src.w, gfxS.out.w))));
    box.append(el('div', { class: 'row wrap', style: 'align-items:flex-start' }, drawRGBA(gfxS.src, s, 'Before'), drawRGBA(gfxS.out, s, `After · ${gfxS.out.palette.length} colours`)));
    const a = gfxS.out.before, b = gfxS.out.after, ref = NRGfx.reference(gfxDB(), (NRGfx.CONSOLES[gfxS.con] || {}).name);
    const t = el('table', { class: 'gfxstats' }, el('tr', {}, el('th', {}, 'Measured'), el('th', {}, 'Before'), el('th', {}, 'After')));
    t.append(statRow('Blockiness (lower is smoother)', a && a.blockiness, b && b.blockiness, v => v + ' / 100', 'lo'), statRow('Shade steps per colour', a && a.rampLen, b && b.rampLen, v => v, 'hi'), statRow('Outline on silhouette edge', a && a.outline, b && b.outline, v => Math.round(v * 100) + '%', 'hi'),
        statRow('Flat neighbouring pixels', a && a.flat, b && b.flat, v => Math.round(v * 100) + '%', 'lo'), statRow('Colours', a && a.colors, b && b.colors, v => v), statRow('Hue shift shadow→light', a && a.hueShift, b && b.hueShift, v => (v > 0 ? '+' : '') + v + '°'), statRow('Light', a && a.light, b && b.light));
    const gr = NRGfx.grade(b, ref);
    box.append(t, el('p', { class: 'hint' }, ref ? `Reference: ${ref.games} scanned games on this console average ${ref.rampLen} shade steps, ${Math.round(ref.flat * 100)}% flat pixels, blockiness ${ref.blockiness}.` : 'Scan games in the Research Lab and the reference here comes from them.'),
        el('div', { class: 'gfxtips' }, el('b', {}, 'Tips for the result'), el('ul', {}, ...gr.tips.map(x => el('li', {}, x)))));
    const fromProject = P && gfxS.srcName && !gfxS.srcName.startsWith('upload:') && P.sprites[gfxS.key];
    box.append(el('div', { class: 'row wrap' },
        fromProject ? el('button', { class: 'go', onclick: () => { if (gfxS.pad) { notify('Turn off "outer outline" to keep the sprite sheet the same size.'); return; } P.sprites[gfxS.key].image = dataUrlFromRGBA(gfxS.out); imgCache.clear(); dirty = true; notify(`${gfxS.key} now uses the upgraded art. Undo by re-picking the sprite in Characters.`); } }, '✔ Apply to this sprite') : '',
        fromProject ? el('button', { class: 'alt', onclick: async () => { if (gfxS.pad) { notify('Turn off "outer outline" first.'); return; } let n = 0; for (const [k, sp] of Object.entries(P.sprites)) { for (const f of ['image', 'td']) { if (!sp[f]) continue; try { const r = NRGfx.upgrade(await imageData(sp[f]), Object.assign(gfxOpts(), { pad: false })); sp[f] = dataUrlFromRGBA(r); n++; } catch (e) {} } } imgCache.clear(); dirty = true; renderAll(); notify(`Upgraded ${n} sprite sheets in the same style, so the whole cast matches.`); } }, '🎨 Upgrade every sprite in this style') : '',
        el('button', { class: 'alt', onclick: () => { const u = dataUrlFromRGBA(gfxS.out); const a2 = el('a', { href: u, download: (gfxS.srcName.replace(/^upload:/, '').replace(/\W+/g, '_') || 'sprite') + '_upgraded.png' }); document.body.append(a2); a2.click(); a2.remove(); } }, '⬇ Download PNG')));
    return box;
}
function gfxTexturePanel() {
    const T = gfxS.tex, box = el('div', { class: 'gfxpanel' });
    const pick = (label, items, key) => el('label', { class: 'gfxopt' }, label + ' ', el('select', { onchange: e => { T[key] = isNaN(+e.target.value) ? e.target.value : +e.target.value; renderAll(); } }, ...items.map(([v, t]) => { const o = el('option', { value: v }, t); if (String(T[key]) === String(v)) o.selected = true; return o; })));
    box.append(el('h3', {}, '🧱 Textures for 3D (PlayStation, N64, DS)'), el('p', { class: 'hint' }, 'Tileable textures made on this computer: brick, wood, stone, grass, metal, wrestling-mat canvas, skin, concrete. Each is checked against the console\'s texture limits (PlayStation 256×256 pages and CLUT sizes, N64 4 KB texture cache, DS power-of-two sizes).'),
        el('div', { class: 'row wrap' }, pick('Material', Object.entries(NRGfx.TEXTURES).map(([k, v]) => [k, v.label]), 'kind'), pick('Size', [16, 32, 64, 128].map(v => [v, v + '×' + v]), 'size'), pick('Colours', [[4, '4'], [8, '8'], [16, '16 (4-bit)'], [32, '32'], [64, '64'], [256, '256 (8-bit)']], 'colors'),
            pick('Console', [['psx', 'PlayStation'], ['n64', 'Nintendo 64'], ['nds', 'Nintendo DS'], ['pc', 'PC / Xbox']], 'con'), el('label', { class: 'gfxopt' }, 'Variation ', el('input', { type: 'number', value: T.seed, style: 'width:56px', onchange: e => { T.seed = +e.target.value || 1; renderAll(); } })),
            el('label', { class: 'gfxopt' }, el('input', { type: 'checkbox', checked: T.dither, onchange: e => { T.dither = e.target.checked; renderAll(); } }), ' dither')));
    box.lastChild.querySelector('input[type=checkbox]').checked = T.dither;
    const tx = NRGfx.texture(T.kind, T.size, T.seed, { colors: Math.min(T.colors, 64), dither: T.dither }), chk = NRGfx.texCheck(T.con, T.size, T.size, T.colors);
    const tiled = { w: T.size * 2, h: T.size * 2, data: new Uint8ClampedArray(T.size * T.size * 16) };
    for (let y = 0; y < tiled.h; y++) for (let x = 0; x < tiled.w; x++) { const i = (y * tiled.w + x) * 4, j = ((y % T.size) * T.size + (x % T.size)) * 4; for (let k = 0; k < 4; k++) tiled.data[i + k] = tx.data[j + k]; }
    const sc = Math.max(1, Math.floor(192 / T.size));
    box.append(el('div', { class: 'row wrap', style: 'align-items:flex-start' }, drawRGBA(tx, sc * 2 > 8 ? sc : sc, 'One tile'), drawRGBA(tiled, Math.max(1, Math.floor(sc / 2) || 1), 'Tiled 2×2 (check the seams)')),
        el('p', { class: chk.ok ? 'hint' : 'warn' }, (chk.ok ? '✔ ' : '⚠ ') + chk.notes.join(' ')),
        el('div', { class: 'row wrap' }, el('button', { class: 'alt', onclick: () => { const a = el('a', { href: dataUrlFromRGBA(tx), download: `${T.kind}_${T.size}.png` }); document.body.append(a); a.click(); a.remove(); } }, '⬇ Download PNG'),
            el('button', { class: 'alt', onclick: async () => { for (const k of Object.keys(NRGfx.TEXTURES)) { const t2 = NRGfx.texture(k, T.size, T.seed, { colors: Math.min(T.colors, 64), dither: T.dither }); await download(`${k}_${T.size}.png`, bytesFromDataUrl(dataUrlFromRGBA(t2)), 'image/png'); } } }, '⬇ All materials at this size')));
    return box;
}
function gfxDatabasePanel() {
    const box = el('div', { class: 'gfxpanel' }), db = gfxDB().filter(r => r.gfx && r.gfx.art);
    box.append(el('h3', {}, '📊 What real games do (from your database)'));
    if (!db.length) { box.append(el('p', { class: 'hint' }, 'No graphics measurements yet. Scan ROMs in the Research Lab and they appear here.')); return box; }
    const plats = [...new Set(db.map(r => r.platform))], tb = el('table', { class: 'gfxstats' }, el('tr', {}, ...['Console', 'Games', 'Shade steps', 'Flat pixels', 'Outline', 'Blockiness'].map(h => el('th', {}, h))));
    for (const p of plats) { const ref = NRGfx.reference(db, p); tb.append(el('tr', {}, el('td', {}, p), el('td', {}, ref.games), el('td', {}, ref.rampLen), el('td', {}, Math.round(ref.flat * 100) + '%'), el('td', {}, Math.round(ref.outline * 100) + '%'), el('td', {}, ref.blockiness))); }
    const wr = db.filter(r => /wwf|wcw|wrestl|smackdown|raw|power move|royal rumble|fighter|toshinden|tekken|boxing/i.test(r.name + ' ' + r.file)).sort((a, b) => a.platform.localeCompare(b.platform) || a.name.localeCompare(b.name));
    box.append(tb, el('p', { class: 'hint' }, 'Medians per console, measured from the pictures the lab could read (compressed art is invisible to it). Lower blockiness means smoother shading.'));
    if (wr.length) { const t2 = el('table', { class: 'gfxstats' }, el('tr', {}, ...['Fighting / wrestling game', 'Console', 'Shade steps', 'Flat pixels', 'Outline', 'Blockiness', 'Textures'].map(h => el('th', {}, h))));
        for (const r of wr) { const a = r.gfx.art, tx = r.gfx.textures; t2.append(el('tr', {}, el('td', {}, r.name), el('td', {}, r.platform), el('td', {}, a.rampLen), el('td', {}, Math.round(a.flat * 100) + '%'), el('td', {}, a.outline == null ? '–' : Math.round(a.outline * 100) + '%'), el('td', {}, a.blockiness), el('td', {}, tx ? `${tx.count} (${tx.commonSizes[0] || ''})` : '–'))); }
        box.append(el('details', {}, el('summary', {}, `Wrestling and fighting games measured (${wr.length}): what your wrestling game is compared against`), t2)); }
    return box;
}
function gfxTab(main) {
    const box = el('div', { class: 'pane' });
    box.append(el('h2', {}, '🎨 Graphics'), el('p', { class: 'hint' }, 'Better art without leaving the studio. The Research Lab measures how real games build their graphics; this tab applies those lessons to your sprites and textures. For a wrestling game, pick the Wrestler style: five shade steps, rim light and a dark outline.'),
        gfxUpgradePanel(), gfxTexturePanel(), gfxDatabasePanel(),
        el('details', {}, el('summary', {}, 'Graphic design techniques (also in the Technique Library)'), ...NRGfx.CRAFT.map(([t, w, how]) => el('div', { class: 'tech' }, el('b', {}, t), el('p', {}, w), el('p', { class: 'num' }, '🛠 ' + how)))));
    main.append(box);
}

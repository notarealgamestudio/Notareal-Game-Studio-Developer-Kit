/* NOTAREAL Game Studio editor, part 2: game types, art styles, instrument music, bottom-screen touch layouts,
 * opening screen, face wrap maker, Research Lab. Uses NRMusic, NRTouch, NRFace, NRLab (kit modules). */
'use strict';
const STYLE_THEME = { classic: 'pocket', blocky: 'blocky', cute: 'cute', realistic: 'sleek' };
const STYLE_SONGS = { classic: ['world_celtic', 'vapor_mall'], blocky: ['chip_adventure', 'metal_thrash'], cute: ['vapor_sunset', 'world_caribbean'], realistic: ['orchestral_epic', 'cloud_purple'] };
let styleFilter = 'all';
const byStyle = (list) => styleFilter === 'all' ? list : list.filter(x => (x.style || 'classic') === styleFilter);
function styleBar() {
    return el('div', { class: 'row stylebar' }, el('b', {}, 'Art style: '), ...[{ id: 'all', name: 'All' }, ...LIB.styles].map(s => el('button', { class: styleFilter === s.id ? 'on' : 'alt', title: s.about || '', onclick: () => { styleFilter = s.id; renderAll(); } }, s.name)),
        styleFilter !== 'all' ? el('button', { class: 'go', onclick: () => { applyStylePack(styleFilter); renderAll(); notify('Switched the tiles, background, enemies and items to the ' + LIB.styles.find(s => s.id === styleFilter).name + ' pack. Your hero stays the same.'); } }, '🎨 Use this whole style') : '');
}
function libSprite(role, style) { return LIB.sprites.find(s => s.role === role && (s.style || 'classic') === style) || LIB.sprites.find(s => s.role === role); }
function spriteRef(s) { const r = { image: 'lib:' + s.png, w: s.w, h: s.h, frames: s.frames }; if (s.topdown) r.td = 'lib:' + s.topdown; return r; }
function applyStylePack(style, keepHero = true) {
    const ts = LIB.tilesets.find(t => (t.style || 'classic') === style); if (ts) P.tileset = { image: 'lib:' + ts.png, cols: ts.tiles.map(t => t.col), names: ts.tiles.map(t => t.name) };
    const bg = LIB.backgrounds.find(b => (b.style || 'classic') === style); if (bg) P.background = 'lib:' + bg.png;
    for (const r of ['walker', 'hopper', 'flyer', 'coin', 'goal', 'spring', 'heart', 'check']) P.sprites[r] = spriteRef(libSprite(r, style));
    if (!keepHero) P.sprites.hero = spriteRef(libSprite('hero', style));
    P.style = style; if (P.touch) P.touch.theme = STYLE_THEME[style]; dirty = true;
}

/* ------------------------------------------------------------------ wizard: console, game type (35 from the ROM catalog), art style, hero, music, name */
function wizard() {
    let cons = 'ds', genre = 'platformer', style = 'classic', hero = null, music = null, info = null;
    const body = el('div', {}), titleIn = el('input', { value: 'My Game', class: 'wide' }), authorIn = el('input', { value: '', placeholder: 'Your name', class: 'wide' });
    const G = () => GENRES.types.find(g => g.id === genre);
    function draw() {
        body.innerHTML = '';
        body.append(el('h3', {}, '1. Console'), el('div', { class: 'cards' }, ...CONSOLES.map(c => el('div', { class: 'card' + (c.ready ? '' : ' soon') + (c.id === cons ? ' on' : ''), onclick: () => { if (c.ready) { cons = c.id; draw(); } } }, el('b', {}, c.name), el('small', {}, c.ready ? c.note : 'Coming soon · ' + c.note)))));
        body.append(el('h3', {}, '2. Kind of game'), el('p', { class: 'hint' }, `${GENRES.types.length} game types, each learned from the games in the ROM catalog. ✅ = builds for the console you picked; ↪ = no engine for that console yet, so it is made for the DS or PC instead.`));
        const fams = [...new Set(GENRES.types.map(g => g.family))];
        for (const fam of fams) body.append(el('div', { class: 'famrow' }, el('b', {}, fam), el('div', { class: 'cards small' }, ...GENRES.types.filter(g => g.family === fam).map(g => el('div', { class: 'card' + (NRFit.supports(g.id, cons) ? '' : ' soon') + (g.id === genre ? ' on' : ''), title: g.about, onclick: () => { info = g.id; genre = g.id; music = null; draw(); } }, el('b', {}, (NRFit.supports(g.id, cons) ? '✅ ' : '↪ ') + g.name))))));
        const I = GENRES.types.find(g => g.id === (info || genre));
        if (I) body.append(el('div', { class: 'genreinfo' }, el('b', {}, I.name), el('p', {}, I.about), el('small', {}, 'Learns from: ' + (I.learns_from.slice(0, 8).join(', ') || '-') + (I.learns_from.length > 8 ? ` and ${I.learns_from.length - 8} more` : '')),
            I.systems.length ? el('small', {}, ' · Measured systems: ' + I.systems.slice(0, 5).join(', ')) : '', el('small', {}, ' · Controls: ' + I.controls + ' · Consoles: ' + NRFit.consolesFor(I.id).join(', ').toUpperCase()),
            !NRFit.supports(I.id, cons) ? el('p', { class: 'hint' }, 'The ' + CONSOLES.find(c => c.id === cons).name + ' has engines for: ' + GENRES.types.filter(g => NRFit.supports(g.id, cons)).map(g => g.name).join(', ') + '. This type is made as a full starter game for ' + NRFit.consolesFor(I.id).map(c => c.toUpperCase()).join(' / ') + ' (the project switches to the DS when you press Create).') : ''));
        body.append(el('h3', {}, '3. Art style'), el('div', { class: 'cards small' }, ...LIB.styles.map(s => el('div', { class: 'card' + (s.id === style ? ' on' : ''), onclick: () => { style = s.id; hero = null; draw(); } }, el('b', {}, s.name), el('small', {}, s.about)))));
        const heroes = LIB.sprites.filter(s => s.role === 'hero' && (s.style || 'classic') === style); if (!hero || !heroes.some(h => h.id === hero)) hero = heroes[0].id;
        body.append(el('h3', {}, '4. Hero'), el('div', { class: 'row' }, ...heroes.map(s => { const b = el('div', { class: 'pick' + (s.id === hero ? ' on' : ''), onclick: () => { hero = s.id; draw(); } }); thumb(b, 'lib:' + s.png, s.w, s.h, 0, s.h > 32 ? 2 : 3); b.append(el('small', {}, s.name.replace(/ \(.*\)$/, ''))); return b; })));
        if (!music) music = G().music;
        const styles = NRMusic.styles();
        body.append(el('h3', {}, '5. Main music'), el('select', { onchange: e => { music = e.target.value; } }, ...[...new Set(styles.map(s => s.family))].map(f => { const og = el('optgroup', { label: f }); styles.filter(s => s.family === f).forEach(s => { const o = el('option', { value: s.id }, s.label); if (s.id === music) o.selected = true; og.append(o); }); return og; })),
            el('button', { class: 'alt', onclick: () => previewStyle(music) }, '▶ Hear it'), el('button', { class: 'alt', onclick: stopSong }, '■'));
        body.append(el('h3', {}, '6. Name it'), el('div', { class: 'row' }, titleIn, authorIn));
    }
    draw();
    modal('New game', body, [['Cancel', () => { stopSong(); return true; }, 'alt'], ['Create', () => { stopSong(); createFromWizard({ console: cons, genre, style, hero, music, title: titleIn.value, author: authorIn.value }); }, 'go']]);
}
function createFromWizard(o) {
    const base = newProject(o), sup = NRFit.consolesFor(o.genre), con = sup.includes(o.console) ? o.console : (sup.includes('ds') ? 'ds' : sup[0] || 'pc');
    if (o.genre === 'platformer') { base.console = con; setProject(base); return; }
    const r = NRTemplates.apply(o.genre, base, { title: o.title, theme: o.style === 'classic' ? 'forest' : 'forest', levels: 3, seed: Date.now() % 100000, console: con });
    r.project.console = con; if (o.author) r.project.meta.author = o.author;
    applyResult(r); setProject(P);
}
function newProject(opts) {
    const style = opts.style || 'classic', G = GENRES.types.find(g => g.id === (opts.genre || 'platformer'));
    const ts = LIB.tilesets.find(t => (t.style || 'classic') === style) || LIB.tilesets[0];
    const bg = LIB.backgrounds.find(b => (b.style || 'classic') === style) || LIB.backgrounds[0];
    const songIds = [...new Set([opts.music || G.music, ...STYLE_SONGS[style], 'chip_adventure'])].slice(0, 4);
    while (songIds.length < 4) songIds.push('chip_adventure');
    const phys = G.preset_physics || 'classic';
    const p = {
        format: 'notareal-project', version: 2, console: opts.console || 'ds', preset: 'side2d', genre: G.id, style,
        meta: { title: opts.title || 'My Game', author: opts.author || '', tagline: '', lives: G.id === 'kids_first' ? 9 : 5, physics: Object.assign({ preset: phys }, NRKit.PHYSICS[phys] || NRKit.PHYSICS.classic), titleSong: 0, clearSong: 3 },
        tileset: { image: 'lib:' + ts.png, cols: ts.tiles.map(t => t.col), names: ts.tiles.map(t => t.name) },
        background: 'lib:' + bg.png,
        sprites: { hero: spriteRef(LIB.sprites.find(s => s.id === opts.hero) || libSprite('hero', style)) },
        levels: [blankLevel('Level 1', 96)],
        songs: songIds.map((id, i) => NRMusic.compose(id, 11 + i)),
        sfx: Object.fromEntries(LIB.sfx.map(s => [s.id, 'lib:' + s.wav])),
        touch: { layout: G.touch_layout || 'stats', theme: STYLE_THEME[style] },
    };
    for (const r of ['walker', 'hopper', 'flyer', 'coin', 'goal', 'spring', 'heart', 'check']) p.sprites[r] = spriteRef(libSprite(r, style));
    const l = p.levels[0];
    for (let x = 10; x < 14; x++) l.map[9 * l.w + x] = 5;
    [11, 12, 13].forEach(x => l.objects.push({ type: 'coin', x, y: 8 }));
    l.objects.push({ type: 'walker', x: 24, y: 12 }, { type: 'coin', x: 30, y: 11 }, { type: 'coin', x: 31, y: 11 });
    return p;
}

/* ------------------------------------------------------------------ music: instrument tracks, style library, generator */
let curSong = 0, playing = null, pen = 72;
function songAudio(song, loops = 2) { const r = NRMusic.renderSong(JSON.parse(JSON.stringify(song)), 32768, loops); const ac = AC(), b = ac.createBuffer(2, r.L.length, r.sr); b.copyToChannel(r.L, 0); b.copyToChannel(r.R, 1); return b; }
function playBuffer(b) { stopSong(); const ac = AC(), s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = 0.8; s.buffer = b; s.connect(g).connect(ac.destination); s.start(); playing = [s]; }
function playSong(s) { playBuffer(songAudio(s)); }
function stopSong() { if (playing) playing.forEach(n => { try { n.stop(); } catch (e) {} }); playing = null; }
function previewStyle(id) { playSong(NRMusic.compose(id, 7)); }
function musicTab(main) {
    P.songs.forEach(s => NRMusic.upgradeSong(s));
    const s = P.songs[curSong] || P.songs[0], box = el('div', { class: 'pane' }), INS = NRMusic.instruments();
    const instSel = (c) => el('select', { onchange: e => { s.inst[c] = e.target.value; const isK = NRMusic.isKit(s.inst[c]); if (isK) s.ch[c] = s.ch[c].map(v => v && v < 128 ? Math.min(v, 3) : v); dirty = true; renderAll(); } },
        ...[...new Set(INS.map(i => i.group))].map(gp => { const og = el('optgroup', { label: gp }); INS.filter(i => i.group === gp).forEach(i => { const o = el('option', { value: i.id }, i.label); if (i.id === s.inst[c]) o.selected = true; og.append(o); }); return og; }));
    box.append(el('h2', {}, 'Music'),
        el('div', { class: 'row' }, el('select', { onchange: e => { curSong = +e.target.value; renderAll(); } }, ...P.songs.map((x, i) => { const o = el('option', { value: i }, (i + 1) + '. ' + x.name); if (i === curSong) o.selected = true; return o; })),
            el('button', { onclick: () => playSong(s) }, '▶ Play'), el('button', { class: 'alt', onclick: stopSong }, '■ Stop'),
            el('button', { onclick: () => { P.songs.push(NRMusic.upgradeSong({ name: 'New song', tempo: 8, steps: 64, ch: [0, 1, 2, 3].map(() => new Array(64).fill(0)) })); curSong = P.songs.length - 1; dirty = true; renderAll(); } }, '+ Empty song'),
            el('button', { onclick: importMidi }, 'Import MIDI…'), el('button', { onclick: importMp3 }, 'MP3 → song…'),
            P.songs.length > 1 ? el('button', { class: 'alt', onclick: () => { P.songs.splice(curSong, 1); curSong = 0; dirty = true; renderAll(); } }, '🗑 Remove') : ''),
        el('div', { class: 'row' }, el('label', {}, 'Name ', el('input', { value: s.name, onchange: e => { s.name = e.target.value; dirty = true; } })),
            el('label', {}, 'Speed ', el('input', { type: 'range', min: 2, max: 20, step: 0.25, value: 22 - s.tempo, oninput: e => { s.tempo = 22 - +e.target.value; dirty = true; } })), el('small', {}, s.style ? 'Style: ' + (NRMusic.styles().find(x => x.id === s.style) || {}).label : '')));
    // style library
    const lib = el('details', { class: 'songlib', open: '' }, el('summary', {}, '🎼 Song library: heavy metal, lofi vaporwave, 90s cloud rap, world music and more'));
    const fams = [...new Set(NRMusic.styles().map(x => x.family))];
    for (const f of fams) lib.append(el('div', { class: 'famrow' }, el('b', {}, f), el('div', { class: 'row wrap' }, ...NRMusic.styles().filter(x => x.family === f).map(x => el('span', { class: 'songchip' }, el('span', {}, x.region ? x.region : x.label.replace(/^[^:]+:\s*/, '')),
        el('button', { class: 'mini alt', title: 'Listen', onclick: () => previewStyle(x.id) }, '▶'),
        el('button', { class: 'mini', title: 'Add to my game', onclick: () => { P.songs.push(NRMusic.compose(x.id, 7)); curSong = P.songs.length - 1; dirty = true; renderAll(); } }, '+'),
        el('button', { class: 'mini alt', title: 'Make a brand-new song in this style', onclick: () => { P.songs.push(Object.assign(NRMusic.compose(x.id, (Math.random() * 1e9) | 0), {})); P.songs[P.songs.length - 1].name += ' (new)'; curSong = P.songs.length - 1; dirty = true; renderAll(); } }, '🎲'))))));
    box.append(lib, el('p', { class: 'hint' }, 'Every sound is synthesized by the studio itself, so the DS plays exactly what you hear here. Up to 8 tracks per song; drum-kit tracks pick a drum per cell. Click a cell to place the note chosen below, right-click to clear.'));
    const NOTES = []; for (let n = 96; n >= 24; n--) NOTES.push(n);
    box.append(el('div', { class: 'row' }, el('span', {}, 'Note to place: '), el('select', { onchange: e => pen = +e.target.value }, ...NOTES.map(n => { const o = el('option', { value: n }, noteName(n)); if (n === pen) o.selected = true; return o; })),
        s.ch.length < 8 ? el('button', { class: 'alt', onclick: () => { s.ch.push(new Array(s.steps).fill(0)); s.inst.push('piano'); s.vol.push(90); s.pan.push(64); dirty = true; renderAll(); } }, '+ Track') : ''));
    const grid = el('div', { class: 'seq' });
    s.ch.forEach((row, c) => {
        const info = NRMusic.info(s.inst[c]), kit = NRMusic.isKit(s.inst[c]), drums = info.drums || [];
        const r = el('div', { class: 'seqrow' }, el('span', { class: 'seqname wide' }, instSel(c), el('input', { type: 'range', min: 0, max: 127, value: s.vol[c], title: 'Volume', class: 'vol', oninput: e => { s.vol[c] = +e.target.value; dirty = true; } })));
        for (let i = 0; i < s.steps; i++) {
            const v = row[i];
            const cell = el('span', { class: 'seqcell' + (i % 16 === 0 ? ' bar' : '') + (v ? ' on' : '') + (v === 128 ? ' hold' : ''), title: v && v < 128 ? (kit ? drums[v] || '' : noteName(v)) : '' });
            cell.textContent = v && v < 128 ? (kit ? (drums[v] || '?').slice(0, 2) : noteName(v).replace(/\d/, '')) : '';
            cell.onclick = () => { row[i] = kit ? ((row[i] || 0) % Math.max(1, drums.length - 1)) + 1 : pen; dirty = true; renderAll(); };
            cell.oncontextmenu = e => { e.preventDefault(); row[i] = 0; dirty = true; renderAll(); };
            r.append(cell);
        }
        grid.append(r);
    });
    box.append(el('div', { class: 'seqwrap' }, grid));
    main.append(box);
}

/* ------------------------------------------------------------------ bottom screen (DS touch layouts) */
function touchTab(main) {
    if (P.console !== 'ds') { main.append(el('div', { class: 'pane' }, el('h2', {}, '📱 Bottom screen'), el('p', {}, 'Only the Nintendo DS has a second (touch) screen. This game is for the ' + (CONSOLES.find(c => c.id === P.console) || {}).name + '. Switch the console in ⚙ Game to use touch layouts.'))); return; }
    P.touch = P.touch || { layout: 'stats', theme: STYLE_THEME[P.style || 'classic'] };
    const T = P.touch, box = el('div', { class: 'pane' });
    const canvasOf = (img, scale = 1) => { const c = el('canvas', { class: 'pix', width: 256 * scale, height: 192 * scale }); const t = el('canvas'); t.width = 256; t.height = 192; t.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), 256, 192), 0, 0); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(t, 0, 0, c.width, c.height); return c; };
    box.append(el('h2', {}, '📱 DS bottom screen'), el('p', { class: 'hint' }, 'The touch screen under the game. Pick a layout and a look; the buttons light up when pressed on the DS. Ideas taken from how the catalogued DS games use their lower screen (Pokemon Platinum\'s big command buttons and touch menus, DS-10\'s touch pads, the stats screens of action games).'));
    box.append(el('label', {}, el('input', { type: 'checkbox', ...(T.layout === 'text' ? { checked: '' } : {}), onchange: e => { T.layout = e.target.checked ? 'text' : 'stats'; dirty = true; renderAll(); } }), ' Plain text screen (old style, no touch buttons)'));
    if (T.layout !== 'text') {
        box.append(el('h3', {}, 'Look'), el('div', { class: 'row' }, ...Object.entries(NRTouch.THEMES).map(([id, th]) => el('button', { class: T.theme === id ? 'on' : 'alt', onclick: () => { T.theme = id; dirty = true; renderAll(); } }, th.label))),
            el('label', {}, el('input', { type: 'checkbox', ...(T.useBackground ? { checked: '' } : {}), onchange: e => { T.useBackground = e.target.checked; dirty = true; renderAll(); } }), ' Show my game background behind the buttons'));
        box.append(el('h3', {}, 'Layout'));
        const cards = el('div', { class: 'cards' });
        for (const [id, L] of Object.entries(NRTouch.LAYOUTS)) {
            const lay = NRTouch.layout(id), c = el('div', { class: 'card touchcard' + (T.layout === id && !T.items ? ' on' : ''), onclick: () => { T.layout = id; delete T.items; dirty = true; renderAll(); } }, canvasOf(NRTouch.render(lay.items, T.theme), 0.75), el('b', {}, L.label), el('small', {}, L.for));
            cards.append(c);
        }
        box.append(cards);
        const cur = NRTouch.layout(T.layout in NRTouch.LAYOUTS ? T.layout : 'stats'), items = T.items || cur.items;
        const prevWrap = el('div', { class: 'row' });
        (async () => { let bgi = null; if (T.useBackground && P.background) bgi = await imageData(P.background); prevWrap.append(canvasOf(NRTouch.render(items, T.theme, { background: bgi }), 2)); })();
        box.append(el('h3', {}, 'How to use it'), el('ul', {}, ...(cur.how || []).map(h => el('li', {}, h))), prevWrap);
        box.append(el('h3', {}, 'Buttons'), el('p', { class: 'hint' }, 'Change what each button says and does.' + ' Move and resize them too.'));
        const tbl = el('div', {});
        items.forEach((it, k) => {
            if (it.type !== 'button') return;
            const upd = (key, v) => { if (!T.items) T.items = JSON.parse(JSON.stringify(items)); T.items[k][key] = v; dirty = true; renderAll(); };
            const row = el('div', { class: 'row wrap' }, el('input', { value: it.label || '', style: 'width:90px', onchange: e => upd('label', e.target.value.toUpperCase().slice(0, 10)) }),
                el('select', { onchange: e => upd('action', e.target.value) }, ...Object.entries(NRTouch.ACTION_INFO).map(([a, [lab]]) => { const o = el('option', { value: a }, lab); if (a === it.action) o.selected = true; return o; })),
                el('small', {}, (NRTouch.ACTION_INFO[it.action] || [, ''])[1]));
            for (const key of ['x', 'y', 'w', 'h']) row.append(el('label', {}, key + ' ', el('input', { type: 'number', style: 'width:52px', value: it[key], onchange: e => upd(key, Math.max(0, +e.target.value)) })));
            tbl.append(row);
        });
        box.append(tbl, T.items ? el('button', { class: 'alt', onclick: () => { delete T.items; dirty = true; renderAll(); } }, 'Reset to the preset') : '');
        box.append(el('h3', {}, 'Every button action'), el('div', { class: 'row wrap' }, ...Object.entries(NRTouch.ACTION_INFO).map(([a, [lab, d]]) => el('div', { class: 'tech small' }, el('b', {}, lab), el('small', {}, ' ' + d)))));
    }
    main.append(box);
}

/* ------------------------------------------------------------------ opening screen (after the NOTAREAL logo) */
async function fitImage(url, w, h, mode = 'cover') {
    const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = url; });
    const c = el('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const k = mode === 'cover' ? Math.max(w / im.width, h / im.height) : Math.min(w / im.width, h / im.height);
    g.imageSmoothingQuality = 'high'; g.drawImage(im, (w - im.width * k) / 2, (h - im.height * k) / 2, im.width * k, im.height * k);
    return c.toDataURL('image/png');
}
function consoleSwitch() {
    return el('div', { class: 'row' }, el('b', {}, 'Console: '), ...CONSOLES.filter(c => c.ready).map(c => el('button', { class: P.console === c.id ? 'on' : 'alt', onclick: () => { P.console = c.id; dirty = true; renderAll(); } }, c.name)),
        el('small', {}, ' The same project exports for every ready console; each one gets art and music converted to what its hardware can do.'));
}
function openingSection() {
    P.opening = P.opening || { top: null, bottom: null, seconds: 3, fit: 'cover' };
    const O = P.opening, wrap = el('div', {});
    const pickOne = async which => { const f = await pickFile('image/*'); if (!f) return; O['src_' + which] = await fileToDataUrl(f); O[which] = await fitImage(O['src_' + which], 256, 192, O.fit); dirty = true; renderAll(); };
    const prev = which => { const d = el('div', { class: 'pick' }); if (O[which]) { const i = el('img', { src: O[which], class: 'pix', style: 'width:256px;height:192px' }); d.append(i); } else d.append(el('div', { class: 'empty', style: 'width:256px;height:192px;display:flex;align-items:center;justify-content:center' }, 'No picture')); return d; };
    if (P.console === 'snes') { wrap.append(el('h3', {}, '🎬 Opening screen'), el('p', { class: 'hint' }, 'The SNES engine shows the NOTAREAL logo and then your title screen; a custom opening picture is DS-only for now.')); return wrap; }
    wrap.append(el('h3', {}, '🎬 Opening screen'), el('p', { class: 'hint' }, 'Your own title card, shown right after the NOTAREAL logo when the ROM starts (fades in and out; START/A/tap skips). Any picture works: it is fitted to the DS screen (256×192).'),
        el('div', { class: 'row wrap' }, el('div', {}, el('b', {}, 'Top screen'), prev('top'), el('div', { class: 'row' }, el('button', { onclick: () => pickOne('top') }, 'Upload…'), O.top ? el('button', { class: 'alt', onclick: () => { O.top = null; dirty = true; renderAll(); } }, 'Remove') : '')),
            el('div', {}, el('b', {}, 'Bottom screen (optional)'), prev('bottom'), el('div', { class: 'row' }, el('button', { onclick: () => pickOne('bottom') }, 'Upload…'), O.bottom ? el('button', { class: 'alt', onclick: () => { O.bottom = null; dirty = true; renderAll(); } }, 'Remove') : ''))),
        el('div', { class: 'row' }, el('label', {}, 'Seconds ', el('input', { type: 'number', min: 1, max: 10, value: O.seconds, onchange: e => { O.seconds = +e.target.value; dirty = true; } })),
            el('label', {}, 'Fit ', el('select', { onchange: async e => { O.fit = e.target.value; for (const w of ['top', 'bottom']) if (O['src_' + w]) O[w] = await fitImage(O['src_' + w], 256, 192, O.fit); dirty = true; renderAll(); } }, ...[['cover', 'Fill the screen (crop)'], ['contain', 'Show all (black bars)']].map(([v, t]) => { const o = el('option', { value: v }, t); if (v === O.fit) o.selected = true; return o; })))));
    return wrap;
}

/* ------------------------------------------------------------------ face wrap maker */
let faceCascadeReady = false;
function ensureCascade() { if (!faceCascadeReady && typeof NR_FACEFINDER_B64 !== 'undefined') { NRFace.setCascade(Int8Array.from(atob(NR_FACEFINDER_B64), c => c.charCodeAt(0) << 24 >> 24)); faceCascadeReady = true; } }
async function faceWrapMaker(castIdx) {
    const f = await pickFile('image/*'); if (!f) return;
    ensureCascade();
    const url = await fileToDataUrl(f), im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = url; });
    const src = await imageDataFromImg(im);
    let faceIdx = 0, det = NRFace.detect(src, 0), keepHair = false, target = 'ds';
    const body = el('div', { class: 'facewrap' }), photo = el('canvas'), outs = el('div', { class: 'row wrap' });
    const PW = 360, k = PW / src.w; photo.width = PW; photo.height = Math.round(src.h * k);
    let drag = -1;
    function drawPhoto() {
        const g = photo.getContext('2d'); g.drawImage(im, 0, 0, photo.width, photo.height);
        g.strokeStyle = '#ff3d7f'; g.lineWidth = 2; g.beginPath(); g.ellipse(det.cx * k, det.cy * k, det.rx * k, det.ry * k, 0, 0, Math.PI * 2); g.stroke();
        det.eyes.forEach(([x, y]) => { g.fillStyle = '#39ff8a'; g.beginPath(); g.arc(x * k, y * k, 6, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#000'; g.stroke(); });
    }
    function redo() {
        drawPhoto(); outs.innerHTML = '';
        const wrap = NRFace.makeWrap(src, det, 256, { keepHair });
        body._wrap = wrap;
        const show = (img, label, scale) => { const c = el('canvas', { class: 'pix' }); c.width = img.w * scale; c.height = img.h * scale; const t = el('canvas'); t.width = img.w; t.height = img.h; t.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.w, img.h), 0, 0); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(t, 0, 0, c.width, c.height); return el('div', { class: 'pick' }, c, el('small', {}, label)); };
        outs.append(show(NRKit.resize(wrap, 128, 128), 'Face wrap (full quality)', 1));
        for (const [id, T] of Object.entries(NRFace.TARGETS)) outs.append(show(NRFace.forConsole(wrap, id, NRKit), `${T.label} · ${T.size}px · ${T.colors} colours`, Math.max(1, Math.round(96 / T.size))));
        info.textContent = `${det.method === 'detector' ? 'Face found' : 'No clear face found: drag the green dots onto the eyes'}${det.faces > 1 ? ` (face ${faceIdx + 1} of ${det.faces})` : ''} · skin tone rgb(${det.skin.map(v => Math.round(v)).join(', ')})`;
        skinIn.value = '#' + det.skin.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    }
    photo.onmousedown = e => { const r = photo.getBoundingClientRect(), x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k; drag = det.eyes.findIndex(([ex, ey]) => Math.hypot(ex - x, ey - y) < 14 / k); };
    photo.onmousemove = e => { if (drag < 0) return; const r = photo.getBoundingClientRect(); det.eyes[drag] = [(e.clientX - r.left) / k, (e.clientY - r.top) / k]; drawPhoto(); };
    photo.onmouseup = () => { if (drag >= 0) { drag = -1; redo(); } };
    const info = el('p', { class: 'hint' }), skinIn = el('input', { type: 'color', oninput: e => { det.skin = hex(e.target.value); redo(); } });
    body.append(el('p', { class: 'hint' }, 'Like create-a-wrestler face wraps: the studio finds your face, samples your skin tone, cuts away the background and hair and fills them with that skin tone, so the picture wraps around a head with no seam. Then it makes a version for each console. Everything happens on this computer; the photo is not uploaded anywhere.'),
        el('div', { class: 'row wrap' }, photo, el('div', {}, info, el('div', { class: 'row wrap' }, el('label', {}, 'Skin tone ', skinIn),
            el('label', {}, el('input', { type: 'checkbox', onchange: e => { keepHair = e.target.checked; redo(); } }), ' Keep hairline'),
            el('button', { class: 'alt', onclick: () => { faceIdx++; const faces = NRFace.findFaces(src); if (!faces.length) return; faceIdx %= faces.length; det = NRFace.fromBox(src, faces[faceIdx], faces.length); redo(); } }, 'Next face in photo')),
            el('div', { class: 'row wrap' }, el('label', {}, 'Download for ', el('select', { onchange: e => target = e.target.value }, ...Object.entries(NRFace.TARGETS).map(([id, T]) => { const o = el('option', { value: id }, T.label); if (id === target) o.selected = true; return o; }))),
                el('button', { onclick: () => download('face_wrap_' + target + '.png', bytesFromDataUrl(dataUrlFromRGBA(NRFace.forConsole(body._wrap, target, NRKit))), 'image/png') }, '⬇ PNG'),
                el('button', { class: 'alt', onclick: () => download('face_wrap_full.png', bytesFromDataUrl(dataUrlFromRGBA(body._wrap)), 'image/png') }, '⬇ Full quality'))) ), outs);
    const castList = (typeof castInit === 'function') ? castInit() : [], castSel = el('select', {}, ...castList.map((c, k) => { const o = el('option', { value: k }, c.name || ('Character ' + (k + 1))); if (k === (castIdx | 0)) o.selected = true; return o; })), castMsg = el('span', { class: 'hint' });
    if (castList.length) body.append(el('div', { class: 'row wrap' }, el('label', {}, 'Put this face on cast character ', castSel), el('button', { onclick: () => { const c = castList[+castSel.value], r = NRKit.resize(body._wrap, 64, 64), u = new Uint8Array(8192); for (let q = 0; q < 4096; q++) { const R = r.data[q * 4], G = r.data[q * 4 + 1], B = r.data[q * 4 + 2], v = (R >> 3) | ((G >> 3) << 5) | ((B >> 3) << 10) | 0x8000; u[q * 2] = v & 255; u[q * 2 + 1] = v >> 8; } let bs = ''; for (let q = 0; q < u.length; q++) bs += String.fromCharCode(u[q]); c.faceWrap = { b64: btoa(bs), w: 64 }; dirty = true; castMsg.textContent = '✔ saved on ' + c.name + '. It is painted on the head in the 3D wrestling game (DS) when you export.'; } }, 'Put on character'), castMsg));
    redo();
    modal('📸 Face wrap maker', body, [['Close', () => true, 'alt'], ['Put this face on the character builder', () => { CB.face = dataUrlFromRGBA(body._wrap); CB.faceImg = body._wrap; CB.skin = '#' + det.skin.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); renderAll(); notify('The face is on the character builder (Characters tab). Press "Use as my hero" to put it in the game.'); }, 'go']]);
}
/* paste a face onto builder frames: called by buildCharacter with the head rectangle of each frame */
function pasteFace(put, hx0, top, hw, headH, frame) {
    if (!CB.faceImg || frame === 4) return;
    const fw = Math.max(3, Math.round(hw * 0.92)), fh = Math.max(3, Math.round(headH * 0.78)), sf = NRFace.spriteFace(CB.faceImg, fw, fh, NRKit);
    const x0 = Math.round(hx0 + hw - fw), y0 = Math.round(top + headH * 0.22);
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const i = (y * fw + x) * 4; const nx = (x - fw / 2) / (fw / 2), ny = (y - fh / 2) / (fh / 2); if (nx * nx + ny * ny > 1.1) continue; put(x0 + x, y0 + y, [sf.data[i], sf.data[i + 1], sf.data[i + 2]]); }
}

/* ------------------------------------------------------------------ Research Lab: scan ROMs into the studio database */
const LAB_KEY = 'notareal_lab_db_v1';
/* Desktop launcher: the research library lives in a file next to the program, not in browser storage */
const DESK = { ok: false, data: '', lib: [] };
async function deskCall(path, body) { const r = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Notareal': '1', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { j = t; } if (!r.ok) throw new Error((j && j.error) || ('error ' + r.status)); return j; }
async function deskInit() { if (!window.NR_DESKTOP) return; try { const p = await deskCall('/api/ping'); DESK.ok = true; DESK.data = p.data; DESK.lib = await deskCall('/api/library'); const old = (() => { try { return JSON.parse(localStorage.getItem(LAB_KEY) || '[]'); } catch (e) { return []; } })(); const fresh = old.filter(r => !DESK.lib.some(c => c.id === r.id)); if (fresh.length) { await deskCall('/api/library', fresh); DESK.lib = await deskCall('/api/library'); } } catch (e) { DESK.ok = false; } }
function labLoad() { if (DESK.ok) return DESK.lib; try { return JSON.parse(localStorage.getItem(LAB_KEY) || '[]'); } catch (e) { return LABMEM || []; } }
let LABMEM = null;
function labSave(db) {
    if (DESK.ok) { const before = DESK.lib; DESK.lib = db; const gone = before.filter(r => !db.some(c => c.id === r.id)), changed = db.filter(r => !before.includes(r));
        (async () => { try { for (const r of gone) await deskCall('/api/library/remove', { id: r.id }); if (changed.length) await deskCall('/api/library', changed); } catch (e) { notify('Could not save to the data folder: ' + e.message); } })(); return true; }
    LABMEM = db; try { localStorage.setItem(LAB_KEY, JSON.stringify(db)); return true; } catch (e) { return false; } }
async function labScanFolder(dir, status) {
    const { files } = await deskCall('/api/list', { dir }); if (!files.length) { status('No ROMs, disc images or game folders found there.'); return; }
    let done = 0, added = 0, skipped = 0, failed = 0; for (const f of files) { status(`Scanning ${++done} of ${files.length}: ${f.name} (${(f.size / 1048576).toFixed(1)} MB)`); await new Promise(r => setTimeout(r, 10));
        try { const r = await deskCall('/api/scan', { file: f.path }); if (r.record) added++; else skipped++; } catch (e) { failed++; } }
    DESK.lib = await deskCall('/api/library'); status(`Done: ${added} scanned and saved, ${skipped} not recognised, ${failed} failed.`); renderAll();
}
function labDesktopPanel() {
    const box = el('div', { class: 'gfxpanel' });
    if (!DESK.ok) { box.append(el('b', {}, '📁 Scan a whole folder of ROMs'), el('p', { class: 'hint' }, window.NR_DESKTOP ? 'The desktop program is not answering. Close and reopen Notareal Studio.' : 'This needs the Notareal Studio desktop program (it reads folders on your computer and keeps your results in a data folder). In this web page you can scan one ROM at a time.')); return box; }
    const dir = el('input', { class: 'wide', placeholder: 'Folder, disc image or zip: C:\\ROMs, D:\\Games\\SomeGame, E:\\xbox\\game.iso (subfolders included)' }), st = el('p', { class: 'hint' }, 'Results are saved in: ' + DESK.data);
    const go = el('button', { class: 'go', onclick: async () => { if (!dir.value.trim()) return; go.disabled = true; try { await labScanFolder(dir.value.trim().replace(/^"|"$/g, ''), t => st.textContent = t); } catch (e) { st.textContent = e.message; } go.disabled = false; } }, '🔍 Scan this folder');
    box.append(el('b', {}, '📁 Scan ROMs, Windows games and Xbox discs (folders, .iso, .zip, .exe, .xbe). Only measurements are kept, never the game\'s art, sound or code.'), el('div', { class: 'row wrap' }, dir, go),
        el('div', { class: 'row' }, el('button', { class: 'alt', onclick: async () => { try { const t = await deskCall('/api/report'); await download('graphics_report.md', t, 'text/markdown'); } catch (e) { notify(e.message); } } }, '⬇ Graphics report (.md)')), st);
    return box;
}

/* ------------------------------------------------------------------ Physics + data library, and AI art tools */
async function physPanelRefresh(box) {
    box.innerHTML = ''; let lib = { games: {} }; try { lib = await deskCall('/api/physics'); } catch (e) {}
    const games = Object.entries(lib.games || {}), st = el('p', { class: 'hint' }, games.length ? '' : 'Nothing scanned yet. Built in: GTA III vehicle handling (' + NRPhys.vehicles().length + ' cars), movement packs, surfaces.');
    const dir = el('input', { class: 'wide', placeholder: 'Any game: disc image, .zip, first split part (game.zip.001), BIN/CUE, DAT archive, or a game folder' });
    const go = el('button', { class: 'go', onclick: async () => { const f = dir.value.trim().replace(/^"|"$/g, ''); if (!f) return; go.disabled = true; st.textContent = 'Scanning (large discs take about a minute)...'; try { const r = await deskCall('/api/scan-any', { file: f }); st.textContent = r.skipped ? r.skipped : `${r.name}: ${r.tables.length} data tables, ${r.vehicles} vehicles, ${r.characters} characters, ${r.weapons} weapons, ${r.light} light frames${r.parts > 1 ? ' (joined ' + r.parts + ' parts)' : ''}.`; if (!r.skipped) await physPanelRefresh(box); } catch (e) { st.textContent = e.message; } go.disabled = false; } }, '🔍 Scan for physics + data');
    box.append(el('b', {}, '⚙ Physics and game data library'), el('p', { class: 'hint' }, 'Reads numbers from the games you scan: vehicle handling, weapon and character stats, day/night light, object physics. Only numbers and names are kept. Games use them as presets.'), el('div', { class: 'row wrap' }, dir, go), st);
    for (const [n, g] of games) box.append(el('details', {}, el('summary', {}, `${n}: ${g.tables.length} tables, ${Object.keys(g.vehicles).length} vehicles, ${Object.keys(g.characters).length} characters`), ...g.tables.map(t => el('div', { class: 'hint' }, `${t.kind} - ${t.file} (${t.rows} rows x ${t.cols})`))));
    const car = el('select', {}, ...NRPhys.vehicles().map(v => el('option', {}, v))), pack = el('select', {}, ...NRPhys.packs().map(v => el('option', {}, v))), out = el('pre', { class: 'hint', style: 'white-space:pre-wrap' });
    const show = () => { const v = NRPhys.vehicle(car.value), c = NRPhys.character(pack.value); out.textContent = `Vehicle ${v.name}: ${Math.round(v.mass)} kg, top ${(v.maxSpeed * 3.6).toFixed(0)} km/h, accel ${v.accel}, brake ${v.brake}, grip ${v.grip}, steering ${(v.steer * 57.3).toFixed(0)} deg\nMovement pack ${pack.value}: ` + Object.entries(c).map(([k, x]) => k + ' ' + (Array.isArray(x) ? x.join('/') : x)).join(', '); }; car.onchange = pack.onchange = show; show();
    box.append(el('div', { class: 'row wrap' }, el('label', {}, 'Vehicle '), car, el('label', {}, ' Movement '), pack, el('button', { class: 'alt', onclick: () => download('physics_presets.json', JSON.stringify({ vehicles: Object.fromEntries(NRPhys.vehicles().map(v => [v, NRPhys.vehicle(v)])), movement: Object.fromEntries(NRPhys.packs().map(p => [p, NRPhys.character(p)])), surfaces: Object.fromEntries(NRPhys.surfaces().map(s => [s, NRPhys.surface(s)])), library: lib }, null, 1), 'application/json') }, '⬇ Export physics presets')), out);
}
function artToolsPanel() {
    const box = el('div', { class: 'gfxpanel' }), prompt = el('input', { class: 'wide', placeholder: 'Describe it: "16px cobblestone ground tiles", "night city background", "wood plank floor texture for gba"' }), view = el('div', { class: 'row wrap' }), st = el('p', { class: 'hint' }, 'Textures: ' + NRTex.kinds().join(', ') + '. Backgrounds: ' + NRTex.backgrounds().join(', ') + '.');
    let last = null;
    const make = (text) => { try { const r = NRTex.make(text), im = r.image.flat || r.image; last = { im, plan: r.plan }; view.innerHTML = ''; const c = NRTex.toCanvas(im); c.style.cssText = 'image-rendering:pixelated;max-width:520px;width:' + Math.min(520, im.w * (im.w <= 64 ? 8 : im.w <= 256 ? 2 : 1)) + 'px;border:1px solid #345'; view.append(c); if (r.image.layers) { const row = el('div', { class: 'row wrap' }); r.image.layers.forEach((L, i) => { const lc = NRTex.toCanvas(L); lc.style.cssText = 'width:120px;border:1px solid #234;background:#222'; row.append(lc); }); view.append(row); } st.textContent = `${r.plan.tool}: ${JSON.stringify(r.plan.args)}${r.plan.console ? ' reduced for ' + r.plan.console : ''}`; } catch (e) { st.textContent = e.message; } };
    box.append(el('b', {}, '🎨 Art tools: textures, ground tiles and backgrounds (made from maths, seamless, original)'), el('div', { class: 'row wrap' }, prompt, el('button', { class: 'go', onclick: () => make(prompt.value || 'grass texture') }, 'Make it'), el('button', { class: 'alt', onclick: () => { const k = NRTex.kinds(); prompt.value = (Math.random() < .5 ? k[Math.floor(Math.random() * k.length)] + ' ground tiles' : NRTex.backgrounds()[Math.floor(Math.random() * 11)] + ' background'); make(prompt.value); } }, '🎲 Surprise me'), el('button', { class: 'alt', onclick: () => { if (!last) return; last.im.toBlob ? 0 : 0; NRTex.toCanvas(last.im).toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (last.plan.args.kind || 'art') + '_' + last.plan.tool + '.png'; a.click(); }); } }, '⬇ Save PNG')), st, view);
    return box;
}
let labLast = null;
function labTab(main) {
    const box = el('div', { class: 'pane' }), db = labLoad();
    box.append(el('h2', {}, '🔬 Research Lab'), el('p', { class: 'hint' }, 'Drop in any game ROM (DS, GBA, Game Boy, Game Boy Color, NES, SNES, N64, PlayStation) or a Morrowind-style .esm/.esp data file. The lab reads it on this computer: header, file system, data formats, sound budget, and the code (every function it can find from the entry point and which hardware each one talks to). What it learns goes into your studio database and the Technique Library. The studio stores facts and numbers only; nothing from a scanned game is copied into the games you make.'),
        el('div', { class: 'row' }, el('button', { class: 'big', onclick: labScanFile }, '📥 Scan a ROM…'), el('button', { class: 'alt', onclick: () => download('notareal_research_db.json', JSON.stringify(labLoad(), null, 1), 'application/json') }, '⬇ Export database'),
            el('button', { class: 'alt', onclick: async () => { const f = await pickFile('.json'); if (!f) return; try { const add = JSON.parse(await f.text()); const cur = labLoad(); for (const r of add) if (!cur.some(c => c.id === r.id)) cur.push(r); labSave(cur); renderAll(); } catch (e) { notify('That is not a research database file.'); } } }, '⬆ Import database')));
    box.append(labDesktopPanel());
    { const pb = el('div', { class: 'gfxpanel' }); box.append(pb); physPanelRefresh(pb); }
    box.append(artToolsPanel());
    box.append(reGfxPanel());
    if (labLast) box.append(labReport(labLast));
    box.append(el('h3', {}, `Studio database: ${db.length} scanned by you + ${CODEDB.length} ROMs pre-scanned + ${CATALOG.length} catalogued games`));
    const q = el('input', { class: 'wide', placeholder: 'Search the code database: a game, a console, a kind of game, or hardware like sound, scrolling, 3d…' }), res = el('div', { class: 'labdb' });
    const drawQ = () => { res.innerHTML = ''; const t = q.value.toLowerCase(); if (!t) return; [...db, ...CODEDB].filter(r => JSON.stringify([r.name, r.file, r.platform, r.genre, r.catalogName, r.code && r.code.byHardware, r.tech, r.formats]).toLowerCase().includes(t)).slice(0, 40).forEach(r => res.append(labCard(r))); };
    q.oninput = drawQ; box.append(q, res);
    const list = el('div', { class: 'labdb' });
    for (const r of db.slice().reverse()) list.append(labCard(r, true));
    const pre = el('details', {}, el('summary', {}, `Pre-scanned ROMs (${CODEDB.length}): code maps by console`)); 
    for (const plat of [...new Set(CODEDB.map(r => r.platform))]) pre.append(el('div', { class: 'famrow' }, el('b', {}, plat), el('div', {}, ...CODEDB.filter(r => r.platform === plat).map(r => labCard(r)))));
    box.append(pre);
    const cat = el('details', {}, el('summary', {}, 'Built-in catalog (games the kit already learned from)'), el('div', { class: 'row wrap' }, ...CATALOG.map(g => el('span', { class: 'songchip' }, `${g.game} · ${g.platform}${g.genre ? ' · ' + g.genre : ''}`))));
    box.append(list, cat);
    main.append(box);
}
async function labScanFile() {
    const f = await pickFile('.nds,.gba,.gb,.gbc,.sfc,.smc,.nes,.z64,.n64,.v64,.bin,.iso,.img,.exe,.esm,.esp,*/*'); if (!f) return;
    const m = modal('Scanning…', el('p', {}, `Reading ${f.name} (${(f.size / 1048576).toFixed(1)} MB)…`), [['Close', () => true, 'alt']]);
    await new Promise(r => setTimeout(r, 30));
    try { const d = new Uint8Array(await f.arrayBuffer());
        if (/\.(esm|esp)$/i.test(f.name)) { const dg = NRTes.digest(d); dg.source.files = [f.name]; const old = JSON.parse(localStorage.getItem('nr_tes_ref') || 'null'); const ref = old && old.tables ? NRTes.merge(old, dg) : dg; ref.source.files = ((old && old.source && old.source.files) || []).concat(f.name); localStorage.setItem('nr_tes_ref', JSON.stringify(ref)); m.remove(); notify('Read ' + f.name + ': ' + dg.tables.weapons.length + ' weapons, ' + dg.tables.creatures.length + ' creatures, ' + dg.tables.spells.length + ' spells, ' + dg.tables.factions.length + ' factions. Open Berea tools > Real-game numbers.'); renderAll(); return; }
        labLast = NRLab.scan(d, f.name); m.remove(); renderAll(); }
    catch (e) { m.remove(); notify('Could not read that file: ' + e.message); }
}
function labReport(R) {
    const box = el('div', { class: 'labreport' });
    box.append(el('h3', {}, `${R.header.title || R.name} · ${R.platformName}`), el('small', {}, `${(R.size / 1048576).toFixed(2)} MB · scanned in ${R.ms} ms`));
    if (R.platform === 'unknown') { box.append(el('p', {}, 'Not a ROM type the lab knows yet.')); return box; }
    const hw = (R.code && R.code.byHardware) || {}, maxv = Math.max(1, ...Object.values(hw));
    box.append(el('div', { class: 'row wrap' },
        el('div', { class: 'col' }, el('b', {}, 'What it means for your games'), el('ul', {}, ...R.uses.map(u => el('li', {}, el('b', {}, u.area + ': '), u.text)))),
        el('div', { class: 'col' }, el('b', {}, R.code ? `Code: ${R.code.cpu}, entry ${R.code.entry}, ${R.code.functions} functions` : 'Code'),
            ...Object.entries(hw).sort((a, b) => b[1] - a[1]).map(([k, v]) => el('div', { class: 'bar' }, el('span', { class: 'barlab' }, k), el('span', { class: 'barfill', style: `width:${Math.round(v / maxv * 180)}px` }), el('small', {}, ' ' + v))))));
    if (Object.keys(R.formats).length) box.append(el('p', {}, el('b', {}, 'Data formats: '), Object.entries(R.formats).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${v}× ${k}`).join(' · ')));
    if (R.gfx) box.append(labGfxPanel(R));
    if (R.code && R.code.top) box.append(el('details', {}, el('summary', {}, 'Most-called functions (address, calls, hardware)'), el('pre', {}, R.code.top.map(f => `${f.addr.padEnd(12)} ${String(f.calls).padStart(5)}×  ${f.cpu ? f.cpu + ' ' : ''}${f.thumb ? 'thumb ' : ''}${f.tags.join(', ')}`).join('\n'))));
    if (R.sampleStrings && R.sampleStrings.length) box.append(el('details', {}, el('summary', {}, 'Text found inside'), el('pre', {}, R.sampleStrings.slice(0, 40).join('\n'))));
    const gsel = el('select', {}, el('option', { value: '' }, 'Pick the kind of game…'), ...GENRES.types.map(g => el('option', { value: g.name }, g.name)));
    box.append(el('div', { class: 'row' }, gsel, el('button', { class: 'go', onclick: () => { const db = labLoad(), rec = NRLab.dbRecord(R, gsel.value); const i = db.findIndex(x => x.id === rec.id); if (i >= 0) db[i] = rec; else db.push(rec); const ok = labSave(db); labLast = null; renderAll(); notify(ok ? `Added ${rec.name} to your studio database. Its findings now show in the Technique Library.` : 'Added for this session (this browser would not save it permanently: use Export database to keep it).'); } }, '➕ Add to studio database')));
    return box;
}
function labGfxPanel(R) {
    const g = R.gfx, box = el('div', { class: 'labgfx' });
    box.append(el('h3', {}, '🎨 Graphic design findings'), el('ul', {}, ...NRGfx.findings(g).map(u => el('li', {}, u.text))), g.sources && g.sources.length ? el('small', {}, 'Found: ' + g.sources.join(' · ') + '. Compressed art cannot be read by the lab, so figures are what is visible, not the whole game.') : el('small', {}, 'No uncompressed graphics found: this game packs its art. The numbers elsewhere in this report still apply.'));
    if (R.gfxPreview && R.gfxPreview.length) { const row = el('div', {}); for (const p of R.gfxPreview) { const c = el('canvas'); c.width = p.w; c.height = p.h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(p.data), p.w, p.h), 0, 0); const sc = Math.max(1, Math.min(3, Math.floor(300 / p.w))); c.style.cssText = `width:${p.w * sc}px;height:${p.h * sc}px;background:#33333c`; row.append(el('div', { style: 'display:inline-block;vertical-align:top' }, el('small', {}, p.label), el('br'), c)); }
        box.append(el('details', {}, el('summary', {}, 'Look at what was found (shown on this computer only; never saved)'), row)); }
    return box;
}
function labCard(r, removable) {
    const hw = r.code && r.code.byHardware ? Object.entries(r.code.byHardware).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => v + ' ' + k).join(', ') : '';
    const d = el('details', { class: 'tech' }, el('summary', {}, el('b', {}, r.name), el('small', {}, ` ${r.platform}${r.genre ? ' · ' + r.genre : ''}${r.code ? ' · ' + r.code.functions + ' functions' : ''}${hw ? ' · ' + hw : ''}`)),
        ...r.uses.map(u => el('p', {}, el('b', {}, u.area + ': '), u.text)),
        r.topFunctions && r.topFunctions.length ? el('pre', {}, r.topFunctions.map(f => `${f.addr.padEnd(12)} ${String(f.calls).padStart(5)}×  ${f.tags.join(', ')}`).join('\n')) : '',
        removable ? el('button', { class: 'mini alt', onclick: () => { labSave(labLoad().filter(x => x.id !== r.id)); renderAll(); } }, 'Remove') : '');
    return d;
}
/* Technique Library gets the lab's findings too */
function labTechRows() { return [...CODEDB, ...labLoad()].flatMap(r => r.uses.map(u => ({ system: u.area + ' · ' + r.name, category: u.area === 'Graphic design' ? 'Graphic design' : 'Research Lab', game: r.name, platform: r.platform, what: u.text, numbers: '', feel: '' }))); }
function genreTechRows() { return GENRES.types.map(g => ({ system: 'Game type: ' + g.name + (g.status === 'ready' ? '' : ' (blueprint)'), category: 'Game types', game: g.learns_from.slice(0, 4).join(', '), platform: g.consoles.join('/').toUpperCase(), what: g.about + ' Controls: ' + g.controls + '. Bottom screen: ' + g.touch_layout + '. Music: ' + g.music + '.', numbers: g.systems.join('; '), feel: '' })); }
async function importMidi() { const f = await pickFile('.mid,.midi,audio/midi'); if (!f) return; try { const s = NRKit.parseMidi(new Uint8Array(await f.arrayBuffer())); s.name = f.name.replace(/\.\w+$/, ''); P.songs.push(NRMusic.upgradeSong(s)); curSong = P.songs.length - 1; dirty = true; renderAll(); } catch (e) { notify('Could not read that MIDI file: ' + e.message); } }
/* MP3 -> song: decode audio, detect the melody pitch every 16th note (autocorrelation), bass from a low-passed copy, drums from energy onsets */
async function importMp3() {
    const f = await pickFile('audio/*'); if (!f) return;
    const buf = await AC().decodeAudioData(await f.arrayBuffer()); const sr = buf.sampleRate, x = buf.getChannelData(0);
    const bpm = estimateTempo(x, sr), step = 60 / bpm / 4, steps = Math.min(256, Math.floor(buf.duration / step / 16) * 16) || 16;
    const ch = [0, 1, 2, 3].map(() => new Array(steps).fill(0)); let prevE = 0;
    for (let i = 0; i < steps; i++) {
        const a = Math.floor(i * step * sr), n = Math.min(2048, Math.floor(step * sr)); const seg = x.subarray(a, a + n); if (seg.length < 256) break;
        let e = 0; for (const v of seg) e += v * v; e /= seg.length;
        const p = pitch(seg, sr, 80, 1000); if (p && e > 1e-4) ch[0][i] = Math.max(48, Math.min(96, Math.round(69 + 12 * Math.log2(p / 440))));
        const pb = pitch(lowpass(seg, sr, 250), sr, 40, 250); if (pb && i % 2 === 0) ch[1][i] = Math.max(28, Math.min(60, Math.round(69 + 12 * Math.log2(pb / 440))));
        if (e > prevE * 1.8 && e > 5e-4) ch[3][i] = i % 8 === 4 ? 2 : (i % 4 === 0 ? 1 : 3); prevE = e;
    }
    for (let c = 0; c < 2; c++) for (let i = 1; i < steps; i++) if (ch[c][i] && ch[c][i] === ch[c][i - 1]) ch[c][i] = 128;     // held notes
    const frames = Math.max(3, Math.min(16, Math.round(step * 60)));
    P.songs.push({ name: f.name.replace(/\.\w+$/, '') + ' (from MP3)', tempo: frames, steps, ch }); curSong = P.songs.length - 1; dirty = true; renderAll();
    notify('Done! The melody, bass and drums were picked out automatically at ' + Math.round(bpm) + ' BPM. Tidy up any wrong notes in the grid.');
}

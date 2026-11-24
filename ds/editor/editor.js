/* NOTAREAL Game Studio - Dev Kit editor (slice 1: DS 2D sidescroller).
 * Globals injected by the build: NRKit, LIB (library with data URLs), ROMS (gzipped engine templates, base64),
 * TECH (Technique Library rows), BODY (measured body proportions), EXAMPLE (example project). */
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) e[k] = v; else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v); } for (const c of kids) if (c != null && c !== false) e.append(c); return e; };
const OBJ = [
    { type: 'start', label: 'Player start', icon: 'hero' }, { type: 'coin', label: 'Coin', icon: 'coin' },
    { type: 'walker', label: 'Walker enemy', icon: 'walker' }, { type: 'hopper', label: 'Hopper enemy', icon: 'hopper' },
    { type: 'flyer', label: 'Flyer enemy', icon: 'flyer' }, { type: 'spring', label: 'Spring', icon: 'spring' },
    { type: 'heart', label: 'Heart (1-UP)', icon: 'heart' }, { type: 'check', label: 'Checkpoint', icon: 'check' },
    { type: 'goal', label: 'Goal flag', icon: 'goal' },
];
const CONSOLES = [
    { id: 'ds', name: 'Nintendo DS', ready: true, note: 'Plays on the RG DS Plus (DraStic) and DS flash carts' },
    { id: 'snes', name: 'Super Nintendo', ready: true, note: 'SNES side-scroller engine: SPC700 music, 4bpp art in 8 palettes; plays in Snes9x / on a flash cart' },
    { id: 'psx', name: 'PlayStation', ready: true, note: 'Platformer (2D engine) with sound, exported as a PS-EXE: runs on emulators (DuckStation, PCSX) and PS1 loaders. 3D engine: Domino Run' },
    { id: 'gbc', name: 'Game Boy Color', ready: true, note: 'Platformer ROM: colour art, levels, enemies, coins. No sound yet. Also plays on a plain Game Boy' },
    { id: 'gb', name: 'Game Boy', ready: true, note: 'Platformer ROM in 4 shades of green/grey. No sound yet' },
    { id: 'gba', name: 'Game Boy Advance', ready: true, note: 'Platformer ROM with 16-colour art, sound, cutscenes' }, { id: 'n64', name: 'Nintendo 64', ready: true, note: 'Platformer (2D engine) with sound, .z64 ROM: runs on emulators and flash carts. 3D engines: CS64 / Quick Mart Shift' },
    { id: 'nes', name: 'NES', ready: true, note: 'Platformer ROM: 4 background colours, 3-colour sprites. No sound yet' }, { id: 'pc', name: 'PC (Windows / Xbox controller)', ready: true, note: 'Plays in a window on Windows with keyboard or Xbox controller. Every game type works here (38 of 39; the music maker is DS-only)' },
];
const PRESETS = [
    { id: 'side2d', name: '2D Sidescroller', ready: true, from: 'Viper Bros (Convenience Store)' },
    { id: 'side3d', name: '3D Sidescroller', ready: false }, { id: 'rpg2d', name: '2D Open World / RPG', ready: false, from: 'Last Dream, Hindu Defense League' },
    { id: 'farm', name: 'Farm / Life Sim', ready: false, from: 'Moonlight Holler' }, { id: 'open3d', name: '3D Open World / Sim', ready: false, from: 'CS64, ICW open world' },
    { id: 'shooter', name: 'War Game / Shooter', ready: false, from: 'Hounds Reloaded' }, { id: 'adv3d', name: '3D Open Adventure', ready: false },
    { id: 'rpg3d', name: '3D RPG Linear Quest', ready: false }, { id: 'wrestling', name: 'Wrestling', ready: false, from: 'ICW' },
    { id: 'basketball', name: 'Basketball', ready: false }, { id: 'racing', name: 'Racing', ready: false, from: 'Domino Run' },
    { id: 'puzzle', name: 'Puzzle / Memory', ready: false, from: 'Pillman' },
];
let lastCheck = null, P = null, tab = 'level', curLevel = 0, brush = { kind: 'tile', id: 1 }, dirty = false;
const imgCache = new Map();

/* ------------------------------------------------------------------ asset access */
function libUrl(ref) { if (!ref) return null; if (ref.startsWith('lib:')) return LIB.files[ref.slice(4)]; return ref; }
function loadImage(ref) {
    if (imgCache.has(ref)) return imgCache.get(ref);
    const pr = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = libUrl(ref); });
    imgCache.set(ref, pr); return pr;
}
async function imageData(ref) {
    const im = await loadImage(ref), c = el('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, data: d.data };
}
function dataUrlFromRGBA(img) { const c = el('canvas'); c.width = img.w; c.height = img.h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.w, img.h), 0, 0); return c.toDataURL('image/png'); }
function bytesFromDataUrl(u) { const b = atob(u.split(',')[1]); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
async function gunzipB64(b64) { const s = new Blob([bytesFromDataUrl('x,' + b64)]).stream().pipeThrough(new DecompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }
let audioCtx = null; const AC = () => audioCtx || (audioCtx = new (window.AudioContext || window.webkitAudioContext)());

/* ------------------------------------------------------------------ project creation */
function blankLevel(name, w) {
    const H = 16, map = new Array(w * H).fill(0);
    for (let x = 0; x < w; x++) { map[13 * w + x] = 1; map[14 * w + x] = 2; map[15 * w + x] = 2; }
    return { name, w, h: H, song: 0, map, objects: [{ type: 'start', x: 2, y: 11 }, { type: 'goal', x: w - 3, y: 12 }] };
}
function setProject(p) { P = p; curLevel = 0; dirty = false; imgCache.clear(); renderAll(); }

/* ------------------------------------------------------------------ shell */
/* ---- grouped navigation (Master Plan panels): Project / World / Assets / Studio (only the tools of this game type) / Test / Research */
const NAV_GROUPS = [['Game', ['templates', 'builder', 'settings', 'recipes', 'fit', 'engines']], ['Timeline', ['timeline', 'story', 'touch']],
    ['Game types', ['level', 'world', 'fight', 'arcade', 'color', 'puzzle', 'bracelet', 'sigil', 'godsim', 'frontier', 'berea']], ['Assets', ['assets', 'level3d', 'chars', 'art', 'gfx', 'music', 'sound']], ['Test', ['fix']], ['Research', ['tech', 'lab']], ['Advanced', ['advanced']], ['About', ['about']]];
/* the names players use, not the names of the games we built them for */
const NAV_LABELS = { color: '🖍 Coloring book', recipes: '🧪 Recipes', about: 'ℹ About', advanced: '🛠 Advanced', templates: '📦 Templates', builder: '✨ Make me a game', settings: '⚙ Game settings', fit: '🎯 Console fit', engines: '⚙ Engines', timeline: '🧭 Timeline', story: '🎬 Cutscenes & banner', touch: '📱 DS bottom screen',
    level: '🏃 Platformer', world: '🌍 RPG & open world', fight: '🤼 Fighting & wrestling', arcade: '🕹 Minigames (shooters, racing, sports & sims)', puzzle: '🧩 Puzzle & match-3', bracelet: '📿 Arrange (bracelets)', sigil: '🎚 Rhythm & music maker', godsim: '🌌 God sim', berea: '☢ Berea (wasteland RPG tools)', frontier: '🤠 Western open world',
    assets: '🧰 Asset library', level3d: '🏙 Level / content builder', chars: '🧍 Characters', art: '🎨 Art', gfx: '🖼 Graphics', music: '🎵 Music', sound: '🔊 Sounds', fix: '🩺 Fix it', tech: '📚 Technique library', lab: '🔬 Research lab' };
function studioTabs() {
    if (!P) return ['arcade', 'puzzle', 'fight', 'sigil']; const g = String(P.genre || ''), out = [];
    if (P.arcade || /craft|life|sim|shooter|warfare|sandbox|open_world|platformer_3d|racing|breakout|falling|memory|skate|shmup/.test(g)) out.push('arcade');
    if (P.puzzle || /puzzle|match|minigame/.test(g)) out.push('puzzle');
    if (P.fight || /fight|brawl|versus/.test(g)) out.push('fight');
    if (P.sigil || /music_maker|music/.test(g)) out.push('sigil');
    if (P.bracelet) out.push('bracelet');
    if (P.godsim) out.push('godsim');
    if (P.berea || /survival_rpg|fallout|wasteland/.test(g)) out.push('berea');
    if (P.arcade && P.arcade.mode === 'frontier3d') out.push('frontier');
    return out.length ? out : ['arcade'];
}
function navGroups() {
    const nav = document.querySelector('nav'); if (!nav) return;
    if (!nav.dataset.grouped) { nav.dataset.grouped = 1; const btns = {}; $$('.tabbtn').forEach(b => btns[b.dataset.tab] = b); nav.innerHTML = '';
        const top = el('div', { class: 'navtop' }), sub = el('div', { class: 'navsub' }); nav.append(top, sub); nav.style.cssText = 'display:block;padding:6px 14px';
        top.style.cssText = 'display:flex;gap:4px;margin-bottom:4px'; sub.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap';
        NAV_GROUPS.forEach(([n, tabs]) => { const gb = el('button', { class: 'grpbtn', 'data-grp': n }, n); gb.style.cssText = 'font-weight:700'; gb.onclick = () => { navGrp = n; const vis = navTabs(tabs); if (!vis.includes(tab)) { tab = vis[0]; if (P) renderAll(); } navGroups(); }; top.append(gb); });
        const at = el('button', { class: 'grpbtn', id: 'advtoggle', title: 'Show or hide the Advanced section' }, '🛠'); at.onclick = () => { advSet(!advOn()); if (!advOn() && tab === 'advanced') tab = 'templates'; navGrp = 'Game'; renderAll(); }; top.append(at);
        Object.entries(btns).forEach(([k, b]) => { if (NAV_LABELS[k]) b.textContent = NAV_LABELS[k]; }); nav._btns = btns; sub._btns = btns; }
    const top = nav.querySelector('.navtop'), sub = nav.querySelector('.navsub'), btns = nav._btns, cur = NAV_GROUPS.find(g => g[1].includes(tab)); if (cur && !navLock) navGrp = cur[0];
    $$('.grpbtn').forEach(b => { b.classList.toggle('on', b.dataset.grp === navGrp); if (b.dataset.grp === 'Advanced') b.style.display = advOn() ? '' : 'none'; }); { const t = document.getElementById('advtoggle'); if (t) t.classList.toggle('on', advOn()); } const tabs = (NAV_GROUPS.find(g => g[0] === navGrp) || NAV_GROUPS[0])[1];
    const shown = navTabs(tabs); if (P && tab === 'touch' && P.console !== 'ds') { tab = 'timeline'; }
    sub.innerHTML = ''; shown.forEach(t => { if (btns[t]) { btns[t].classList.toggle('on', t === tab); sub.append(btns[t]); } });
}
let navGrp = 'Game', navLock = false;
function navTabs(tabs) { return tabs.filter(t => t !== 'touch' || !P || P.console === 'ds'); }   /* the bottom-screen editor only exists for Nintendo DS games */
function renderAll() {
    navGroups();
    $('#title').textContent = P ? P.meta.title : 'Notareal Game Studio';
    $$('.tabbtn').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const main = $('#main'); main.innerHTML = '';
    if (!P) { main.append(welcome()); return; }
    ({ assets: assetsTab, level3d: level3dTab, level: levelTab, chars: charsTab, art: artTab, music: musicTab, sigil: sigilTab, bracelet: braceletTab, godsim: godsimTab, berea: bereaTab, frontier: frontierTab, engines: enginesTab, sound: soundTab, touch: touchTab, world: worldTab, gfx: gfxTab, fight: fightTab, puzzle: puzzleTab, arcade: arcadeTab, templates: templatesTab, builder: builderTab, fit: fitTab, story: storyTab, timeline: timelineTab, color: colorTab, recipes: recipesTab, about: aboutTab, advanced: advancedTab, settings: settingsTab, tech: techTab, fix: fixTab, lab: labTab }[tab])(main);
}
function welcome() {
    return el('div', { class: 'welcome' },
        el('h1', {}, 'Make a game!'),
        el('p', {}, 'Pick a console and a kind of game. You can change everything later.'),
        el('div', { class: 'row' }, el('button', { class: 'big', onclick: wizard }, '✨ New game'), el('button', { class: 'big', onclick: () => { P = JSON.parse(JSON.stringify(EXAMPLE)); tab = 'templates'; renderAll(); } }, '📦 Start from a template'), el('button', { class: 'big', onclick: () => { P = JSON.parse(JSON.stringify(EXAMPLE)); tab = 'builder'; renderAll(); } }, '✨ Make me a game'), el('button', { class: 'big alt', onclick: openFile }, '📂 Open project')));
}
function modal(title, body, buttons) {
    const bg = el('div', { class: 'modalbg' }), box = el('div', { class: 'modal' }, el('h2', {}, title), body, el('div', { class: 'row end' }, ...buttons.map(([t, f, cls]) => el('button', { class: cls || '', onclick: () => { if (f() !== false) bg.remove(); } }, t))));
    bg.append(box); document.body.append(bg); return bg;
}
async function thumb(parent, ref, w, h, frame, scale) {
    const c = el('canvas', { width: w * scale, height: h * scale, class: 'pix' }); parent.append(c);
    const im = await loadImage(ref); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, frame * w, 0, w, h, 0, 0, w * scale, h * scale);
    return c;
}

/* ------------------------------------------------------------------ level painter */
function raceSettings(tools) {
    const R = P.race = Object.assign({ laps: 3, rivals: 3, rivalPct: 92, top: 3, view: '3d' }, P.race || {}), num = (k, lo, hi, step) => el('input', { type: 'number', min: lo, max: hi, step: step || 1, value: R[k], style: 'width:60px', onchange: e => { R[k] = Math.max(lo, Math.min(hi, +e.target.value)); dirty = true; } });
    tools.append(el('h3', {}, '🏁 Race settings'), el('div', { class: 'row wrap' }, el('label', {}, 'Laps ', num('laps', 1, 9)), el('label', {}, 'Rivals ', num('rivals', 0, 3)), el('label', {}, 'Rival speed % ', num('rivalPct', 60, 110)), el('label', {}, 'Top speed ', num('top', 1.5, 4, .25))),
        el('div', { class: 'row wrap' }, el('label', {}, 'Your car ', el('input', { type: 'color', value: '#' + R.car.map(v => v.toString(16).padStart(2, '0')).join(''), onchange: e => { R.car = [1, 3, 5].map(i => parseInt(e.target.value.slice(i, i + 2), 16)); dirty = true; } })), el('label', {}, 'Rival car ', el('input', { type: 'color', value: '#' + R.rival.map(v => v.toString(16).padStart(2, '0')).join(''), onchange: e => { R.rival = [1, 3, 5].map(i => parseInt(e.target.value.slice(i, i + 2), 16)); dirty = true; } })),
            el('label', {}, 'PlayStation / N64 view ', el('select', { onchange: e => { R.view = e.target.value; dirty = true; } }, ...[['3d', '3D (perspective road)'], ['2d', 'Top-down']].map(([v, n]) => { const o = el('option', { value: v }, n); if (R.view === v) o.selected = true; return o; }))),
            el('button', { class: 'alt', onclick: () => { const T = NRModes.raceProject(P, { title: P.meta.title, tracks: 1, seed: Date.now() % 100000, rivals: R.rivals }); P.levels.push(Object.assign({}, T.levels[0], { name: 'Track ' + (P.levels.length + 1) })); curLevel = P.levels.length - 1; dirty = true; renderAll(); } }, '+ New random track')));
}
function levelTab(main) {
    const L = P.levels[curLevel];
    const tools = el('div', { class: 'side' });
    const lvsel = el('select', { onchange: e => { curLevel = +e.target.value; renderAll(); } }, ...P.levels.map((l, i) => { const o = el('option', { value: i }, (i + 1) + '. ' + l.name); if (i === curLevel) o.selected = true; return o; }));
    tools.append(el('h3', {}, 'Levels'), lvsel,
        el('div', { class: 'row' }, el('button', { onclick: () => { P.levels.push(blankLevel('Level ' + (P.levels.length + 1), 96)); curLevel = P.levels.length - 1; dirty = true; renderAll(); } }, '+ Add'),
            el('button', { class: 'alt', onclick: () => { if (P.levels.length > 1) { P.levels.splice(curLevel, 1); curLevel = 0; renderAll(); } } }, 'Delete')),
        el('label', {}, 'Name ', el('input', { value: L.name, onchange: e => { L.name = e.target.value.slice(0, 23); dirty = true; renderAll(); } })),
        el('label', {}, 'Music ', el('select', { onchange: e => { L.song = +e.target.value; dirty = true; } }, ...P.songs.map((s, i) => { const o = el('option', { value: i }, s.name); if (i === L.song) o.selected = true; return o; }))));
    tools.append(el('label', {}, 'Width ', el('input', { type: 'number', min: 16, max: 512, value: L.w, onchange: e => { resizeLevel(L, Math.max(16, Math.min(512, +e.target.value))); renderAll(); } })));
    tools.append(el('h3', {}, 'Tiles'));
    const tpal = el('div', { class: 'palette' }); tools.append(tpal);
    P.tileset.cols.forEach((col, i) => {
        const b = el('div', { class: 'pick' + (brush.kind === 'tile' && brush.id === i ? ' on' : ''), title: (P.tileset.names || [])[i] || ('Tile ' + i), onclick: () => { brush = { kind: 'tile', id: i }; renderAll(); } });
        thumb(b, P.tileset.image, 16, 16, i, 2); if (col === 3) b.classList.add('danger'); tpal.append(b);
    });
    tools.append(el('h3', {}, 'Things'));
    const opal = el('div', { class: 'palette' }); tools.append(opal);
    const RL = { start: 'Start grid (your car)', walker: 'Rival car', coin: 'Boost pad', check: 'Checkpoint (drive order)', goal: 'Finish line' };
    for (const o of OBJ) {
        if (P.miniMode === 'race' && !RL[o.type]) continue;
        const s = P.sprites[o.icon]; if (!s) continue;
        const b = el('div', { class: 'pick' + (brush.kind === 'obj' && brush.id === o.type ? ' on' : ''), title: (P.miniMode === 'race' && RL[o.type]) || o.label, onclick: () => { brush = { kind: 'obj', id: o.type }; renderAll(); } });
        thumb(b, s.image, s.w, s.h, 0, s.h > 16 ? 1 : 2); opal.append(b);
    }
    const er = el('div', { class: 'pick' + (brush.kind === 'erase' ? ' on' : ''), onclick: () => { brush = { kind: 'erase' }; renderAll(); } }, '🧽'); opal.append(er);
    if (P.miniMode === 'race') raceSettings(tools);
    tools.append(el('p', { class: 'hint' }, P.miniMode === 'race' ? 'Paint road tiles, put the start grid, rival cars and checkpoints in driving order, and the finish line. Grass and sand slow you down, water sends you back to the last checkpoint, fences and trees are walls.' : 'Click or drag to paint. Right-click removes things. Tip: put the goal flag at the end!'),
        el('button', { class: 'go', onclick: () => { lastCheck = { li: curLevel, r: NRKit.checkLevel(P, curLevel) }; renderAll(); } }, '🩺 Check this level'));
    if (lastCheck && lastCheck.li === curLevel) {
        const r = lastCheck.r;
        tools.append(el('div', { class: 'checkres ' + (r.issues.length ? 'bad' : 'good') }, r.issues.length ? `${r.issues.length} problem(s):` : '✅ Playable: the goal can be reached without needing the run button.',
            ...r.issues.map(i => el('div', {}, '• ' + i.msg))),
            r.issues.length ? el('button', { onclick: () => { const f = NRKit.autofixLevel(P, curLevel); logFix('Check level button', f.log, 'offline'); lastCheck = { li: curLevel, r: f.check }; dirty = true; renderAll(); } }, '🔧 Fix it for me') : '');
    }
    const wrap = el('div', { class: 'canvaswrap' }), cv = el('canvas', { class: 'pix level' });
    main.append(el('div', { class: 'split' }, tools, wrap)); wrap.append(cv);
    drawLevel(cv, L);
    let down = false;
    const at = e => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * L.w), Math.floor((e.clientY - r.top) / r.height * L.h)]; };
    const paint = (e, right) => {
        const [x, y] = at(e); if (x < 0 || y < 0 || x >= L.w || y >= L.h) return;
        if (right || brush.kind === 'erase') { const n = L.objects.length; L.objects = L.objects.filter(o => !(o.x === x && (o.y === y || (o.type === 'goal' && o.y - 1 === y)))); if (L.objects.length === n && brush.kind === 'erase') L.map[y * L.w + x] = 0; }
        else if (brush.kind === 'tile') L.map[y * L.w + x] = brush.id;
        else if (brush.kind === 'obj') {
            if (brush.id === 'start') L.objects = L.objects.filter(o => o.type !== 'start');
            if (!L.objects.some(o => o.x === x && o.y === y)) L.objects.push({ type: brush.id, x, y });
        }
        dirty = true; drawLevel(cv, L);
    };
    cv.onmousedown = e => { down = true; paint(e, e.button === 2); }; cv.onmousemove = e => { if (down && brush.kind !== 'obj') paint(e, e.buttons === 2); };
    window.onmouseup = () => down = false; cv.oncontextmenu = e => e.preventDefault();
}
function resizeLevel(L, w) {
    const m = new Array(w * L.h).fill(0);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < Math.min(w, L.w); x++) m[y * w + x] = L.map[y * L.w + x];
    if (w > L.w) for (let x = L.w; x < w; x++) { m[13 * w + x] = 1; m[14 * w + x] = 2; m[15 * w + x] = 2; }
    L.map = m; L.w = w; L.objects = L.objects.filter(o => o.x < w); dirty = true;
}
async function drawLevel(cv, L) {
    const S = 2; cv.width = L.w * 16 * S; cv.height = L.h * 16 * S;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const bg = P.background ? await loadImage(P.background) : null;
    g.fillStyle = '#9cf'; g.fillRect(0, 0, cv.width, cv.height);
    if (bg) for (let x = 0; x < cv.width; x += 256 * S) { g.drawImage(bg, x, (L.h * 16 - 192) * S, 256 * S, 192 * S); g.drawImage(bg, 0, 0, 256, 2, x, 0, 256 * S, (L.h * 16 - 192) * S); }
    const ts = await loadImage(P.tileset.image);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) { const t = L.map[y * L.w + x]; if (t) g.drawImage(ts, t * 16, 0, 16, 16, x * 16 * S, y * 16 * S, 16 * S, 16 * S); }
    for (const o of L.objects) {
        const icon = OBJ.find(k => k.type === o.type).icon, s = P.sprites[icon]; if (!s) continue;
        const im = await loadImage(s.image), dy = o.type === 'goal' ? -16 : (o.type === 'start' ? 16 - s.h : 0);
        g.drawImage(im, 0, 0, s.w, s.h, o.x * 16 * S, (o.y * 16 + dy) * S, s.w * S, s.h * S);
    }
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    for (let x = 0; x <= L.w; x++) { g.beginPath(); g.moveTo(x * 16 * S, 0); g.lineTo(x * 16 * S, cv.height); g.stroke(); }
    for (let y = 0; y <= L.h; y++) { g.beginPath(); g.moveTo(0, y * 16 * S); g.lineTo(cv.width, y * 16 * S); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,0,0.5)'; g.strokeRect(0, (L.h * 16 - 192) * S, 256 * S, 192 * S);
    if (lastCheck && P.levels[lastCheck.li] === L) {           /* checker overlay: green = the hero can stand here, red = stuck */
        g.fillStyle = 'rgba(40,220,90,0.45)'; for (const [x, y] of lastCheck.r.visited) g.fillRect(x * 16 * S + 8, (y * 16 - 4) * S, 16 * S - 16, 4 * S);
        for (const i of lastCheck.r.issues) if (i.x != null) { g.strokeStyle = '#ff3b3b'; g.lineWidth = 3; g.strokeRect(i.x * 16 * S, (i.y != null ? i.y * 16 : 0) * S, 16 * S, (i.y != null ? 16 : L.h * 16) * S); g.lineWidth = 1; }
    }
}

/* ------------------------------------------------------------------ characters: library heroes + character builder */
function charsTab(main) {
    const box = el('div', { class: 'pane' });
    castPanel(box);
    box.append(styleBar(), el('h2', {}, '2D hero (sprite based, used by the platformer and other 2D games)'));
    const cur = el('div', { class: 'row' }); thumb(cur, P.sprites.hero.image, P.sprites.hero.w, P.sprites.hero.h, 0, 4).then(() => {}); box.append(cur);
    box.append(el('h3', {}, 'Pick a premade hero'));
    box.append(el('div', { class: 'row' }, ...byStyle(LIB.sprites.filter(s => s.role === 'hero')).map(s => { const b = el('div', { class: 'pick', onclick: () => { P.sprites.hero = spriteRef(s); dirty = true; renderAll(); } }); thumb(b, 'lib:' + s.png, s.w, s.h, 0, s.h > 32 ? 2 : 3); b.append(el('small', {}, s.name)); return b; })));
    box.append(el('div', { class: 'row' }, el('button', { class: 'big alt', onclick: faceWrapMaker }, '📸 Face wrap maker (use your own face)')), builderUI());
    box.append(el('h3', {}, 'Enemies and items'));
    const roles = ['walker', 'hopper', 'flyer', 'coin', 'goal', 'spring', 'heart', 'check'];
    for (const r of roles) {
        const opts = byStyle(LIB.sprites.filter(s => s.role === r));
        const row = el('div', { class: 'row' }, el('b', { style: 'width:110px' }, r));
        opts.forEach(s => { const b = el('div', { class: 'pick' + (P.sprites[r] && P.sprites[r].image === 'lib:' + s.png ? ' on' : ''), title: s.name, onclick: () => { P.sprites[r] = { image: 'lib:' + s.png, w: s.w, h: s.h, frames: s.frames }; dirty = true; renderAll(); } }); thumb(b, 'lib:' + s.png, s.w, s.h, 0, 2); row.append(b); });
        row.append(el('button', { class: 'alt', onclick: () => importSheet(r) }, 'Import art…'));
        box.append(row);
    }
    main.append(box);
}
/* Character builder: proportions measured from the SmackDown vs Raw 2009 shared skeleton (BODY), our own drawing code */
const HAIR = ['short', 'long', 'bun', 'mohawk', 'curly', 'bald', 'cap', 'ponytail'];
let CB = { size: 'realistic', build: 'average', skin: '#c99a76', hair: '#2a1d14', hairStyle: 'short', shirt: '#3c78d8', pants: '#2b3350', shoes: '#ececec', glasses: false, beard: false, apron: false };
function builderUI() {
    const wrap = el('div', { class: 'builder' }), prev = el('div', { class: 'row' });
    const field = (label, input) => el('label', {}, label + ' ', input);
    const color = k => el('input', { type: 'color', value: CB[k], oninput: e => { CB[k] = e.target.value; draw(); } });
    const sel = (k, opts) => el('select', { onchange: e => { CB[k] = e.target.value; draw(); } }, ...opts.map(o => { const op = el('option', { value: o }, o); if (o === CB[k]) op.selected = true; return op; }));
    const chk = k => el('input', { type: 'checkbox', ...(CB[k] ? { checked: '' } : {}), onchange: e => { CB[k] = e.target.checked; draw(); } });
    function draw() {
        prev.innerHTML = '';
        const sheet = buildCharacter(CB), c = el('canvas', { class: 'pix' }); c.width = sheet.w * 4; c.height = sheet.h * 4;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false; const t = el('canvas'); t.width = sheet.w; t.height = sheet.h;
        t.getContext('2d').putImageData(new ImageData(sheet.data, sheet.w, sheet.h), 0, 0); g.drawImage(t, 0, 0, c.width, c.height); prev.append(c);
    }
    wrap.append(el('h3', {}, 'Character builder'),
        el('p', { class: 'hint' }, 'Body proportions come from the measured shared skeleton in WWE SmackDown vs Raw 2009 (DS): legs half the height, arm span equal to height, about 7 heads tall, bulk from lean to heavy. Frames: idle, walk, walk, jump, hurt.'),
        el('div', { class: 'row wrap' }, field('Size', sel('size', ['classic', 'realistic'])), field('Build', sel('build', ['lean', 'average', 'heavy'])), field('Hair', sel('hairStyle', HAIR)),
            field('Skin', color('skin')), field('Hair colour', color('hair')), field('Shirt', color('shirt')), field('Pants', color('pants')), field('Shoes', color('shoes')),
            field('Glasses', chk('glasses')), field('Beard', chk('beard')), field('Apron', chk('apron'))),
        prev, el('button', { class: 'go', onclick: () => { const s = buildCharacter(CB); P.sprites.hero = { image: dataUrlFromRGBA(s), w: s.fw, h: s.h, frames: 5 }; dirty = true; renderAll(); } }, 'Use as my hero'));
    draw();
    return wrap;
}
function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function buildCharacter(o) {
    const fw = o.size === 'realistic' ? 32 : 16, H = o.size === 'realistic' ? 64 : 32, fh = H;
    const W = fw * 5, data = new Uint8ClampedArray(W * fh * 4);
    const put = (x, y, c, a = 255) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= fh) return; const i = (y * W + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = a; };
    const sh = (c, k) => c.map(v => Math.max(0, Math.min(255, Math.round(v * k))));
    const B = BODY, h = H - 1;                                         // standing height in pixels
    const bulk = { lean: B.build_examples.lean, average: B.build_examples.average, heavy: B.build_examples.heavy }[o.build] / B.build_examples.average;
    const skin = hex(o.skin), hair = hex(o.hair), shirt = hex(o.shirt), pants = hex(o.pants), shoes = hex(o.shoes), ol = [28, 22, 26];
    const seg = (x0, y0, x1, y1, r, c) => {                            // thick limb segment
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
        for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + 0.5) put(x + dx, y + dy, c); }
    };
    // walk poses (degrees; 0 = straight down): thigh, shin bend, arm, elbow bend for near/far side
    const POSES = [
        { lt: 0, lk: 0, rt: 0, rk: 0, la: 4, ra: -4, lift: 0 },          // idle
        { lt: 26, lk: 8, rt: -22, rk: 30, la: -22, ra: 20, lift: 0 },    // walk A (contact)
        { lt: -22, lk: 30, rt: 26, rk: 8, la: 20, ra: -22, lift: 0 },    // walk B
        { lt: 30, lk: 60, rt: -10, rk: 20, la: -140, ra: -150, lift: 3 },// jump: knees up, arms raised
        { lt: 12, lk: 10, rt: -12, rk: 10, la: -100, ra: -80, lift: 0 }, // hurt: arms flung out
    ];
    const rad = d => d * Math.PI / 180;
    POSES.forEach((p, f) => {
        const ox = f * fw + fw / 2, foot = fh - 1 - p.lift;
        const hipY = foot - B.hip_height * h, thigh = B.thigh * h, shin = B.shin * h;
        const hipW = Math.max(1, B.hip_width * h * bulk), limb = o.size === 'realistic' ? Math.max(1.4, 2.0 * bulk) : 0.9 * Math.max(1, bulk);
        const chestY = hipY - (B.waist + B.chest) * h, neckY = chestY - B.neck_to_head_joint * h * 0.45, headH = B.head * h * (o.size === 'realistic' ? 1.12 : 1.45);
        const torsoW = (o.size === 'realistic' ? 0.2 : 0.22) * h * bulk;
        const leg = (side, t, k, col) => {
            const hx = ox + side * hipW * 0.6, kx = hx + Math.sin(rad(t)) * thigh, ky = hipY + Math.cos(rad(t)) * thigh;
            const ax = kx + Math.sin(rad(t - k)) * shin, ay = ky + Math.cos(rad(t - k)) * shin;
            seg(hx, hipY, kx, ky, limb + 0.4, col); seg(kx, ky, ax, ay, limb, col);
            seg(ax, ay, ax + (o.size === 'realistic' ? 4 : 2), ay, limb * 0.8, shoes);
        };
        leg(-1, p.rt, p.rk, sh(pants, 0.78)); // far leg darker
        const arm = (side, a, col, hand) => {
            const sx = ox + side * torsoW * 0.35, sy = chestY + 2, ua = B.upper_arm * h * 0.95, fa = B.forearm * h * 0.95;
            const ex = sx + Math.sin(rad(a)) * ua, ey = sy + Math.cos(rad(a)) * ua, hx2 = ex + Math.sin(rad(a + (a < -60 ? -10 : 18))) * fa, hy2 = ey + Math.cos(rad(a + (a < -60 ? -10 : 18))) * fa;
            seg(sx, sy, ex, ey, limb, col); seg(ex, ey, hx2, hy2, limb * 0.9, hand);
        };
        arm(-1, p.ra, sh(shirt, 0.75), sh(skin, 0.85));
        // torso (tapered chest -> waist) and pelvis
        for (let y = Math.floor(chestY); y <= hipY + 1; y++) {
            const t = (y - chestY) / (hipY - chestY), w = torsoW * (1 - 0.18 * t);
            for (let x = -w / 2; x <= w / 2; x++) put(ox + x, y, x > w / 2 - 1.5 ? sh(shirt, 0.8) : shirt);
            if (o.apron && y > chestY + 2) for (let x = -w / 2 + 1.5; x <= w / 2 - 1.5; x++) put(ox + x, y, [220, 170, 40]);
        }
        leg(1, p.lt, p.lk, pants);
        arm(1, p.la, shirt, skin);
        // neck and head (3/4 view facing right)
        seg(ox, chestY, ox + 0.5, neckY, Math.max(1, limb * 0.8), sh(skin, 0.85));
        const hw = headH * 0.78, hx0 = ox - hw / 2 + 0.5, hy0 = neckY - headH;
        for (let y = 0; y < headH; y++) for (let x = 0; x < hw; x++) {
            const nx = (x - hw / 2) / (hw / 2), ny = (y - headH / 2) / (headH / 2); if (nx * nx + ny * ny * 0.85 > 1.05) continue;
            put(hx0 + x, hy0 + y, nx > 0.45 ? sh(skin, 0.86) : skin);
        }
        // hair
        const HC = hair, top = hy0;
        if (o.hairStyle !== 'bald') {
            for (let x = -1; x < hw + 1; x++) for (let y = -1; y < headH * 0.3; y++) { const nx = (x - hw / 2) / (hw / 2 + 0.5); if (nx * nx + ((y - headH * 0.25) / (headH * 0.5)) ** 2 <= 1.15) put(hx0 + x, top + y, HC); }
            for (let y = 0; y < headH * 0.55; y++) put(hx0 - 0.5, top + y, HC), put(hx0, top + y, HC);    // back of head
            if (o.hairStyle === 'long' || o.hairStyle === 'ponytail') for (let y = 0; y < headH * (o.hairStyle === 'long' ? 1.5 : 1.1); y++) { put(hx0 - 1, top + y, HC); put(hx0, top + y, HC); if (o.size === 'realistic') put(hx0 + 1, top + y, HC); }
            if (o.hairStyle === 'bun') for (let y = -3; y < 0; y++) for (let x = hw * 0.3; x < hw * 0.7; x++) put(hx0 + x, top + y - (o.size === 'realistic' ? 2 : 0), HC);
            if (o.hairStyle === 'mohawk') for (let y = -4; y < 1; y++) for (let x = hw * 0.4; x < hw * 0.6; x++) put(hx0 + x, top + y, HC);
            if (o.hairStyle === 'curly') for (let x = -1; x < hw + 1; x += 2) put(hx0 + x, top - 1, HC);
            if (o.hairStyle === 'cap') { for (let x = -1; x < hw + 1; x++) for (let y = -1; y < headH * 0.3; y++) put(hx0 + x, top + y, [40, 170, 140]); for (let x = hw * 0.6; x < hw + headH * 0.35; x++) put(hx0 + x, top + headH * 0.3, [20, 120, 100]); }
        }
        // face: eye with white + iris, brow, nose shadow, mouth
        const ex = hx0 + hw * 0.66, ey = top + headH * 0.48;
        if (f === 4) { put(ex, ey, ol); put(ex + 1, ey + 1, ol); put(ex + 1, ey, ol); put(ex, ey + 1, ol); }
        else if (o.size === 'realistic') {
            put(ex, ey, [245, 245, 240]); put(ex + 1, ey, [245, 245, 240]); put(ex + 1, ey, [50, 35, 25]); put(ex, ey + 1, sh(skin, 0.8));
            for (let x = -1; x < 3; x++) put(ex + x, ey - 2, sh(hair, 0.9));
            put(hx0 + hw * 0.92, ey + 2, sh(skin, 0.75)); put(hx0 + hw * 0.92, ey + 3, sh(skin, 0.75));
            for (let x = 0; x < 3; x++) put(hx0 + hw * 0.62 + x, top + headH * 0.8, sh(skin, 0.62));
        } else { put(ex, ey, [245, 245, 240]); put(ex + 1, ey, [40, 30, 30]); for (let x = 0; x < 2; x++) put(ex - 1 + x, ey - 1, sh(hair, 0.9)); put(ex, top + headH * 0.82, sh(skin, 0.6)); }
        if (o.faceImg && o.size === 'realistic') pasteFace(put, hx0, top, hw, headH, f);
        if (o.glasses) for (let x = -1; x < 4; x++) { put(ex + x - 0.5, ey - 1, [30, 30, 34]); put(ex + x - 0.5, ey + 2, [30, 30, 34]); }
        if (o.beard) for (let y = headH * 0.68; y < headH; y++) for (let x = hw * 0.35; x < hw * 0.95; x++) if (((x + y) | 0) % 2 === 0 || o.size !== 'realistic') put(hx0 + x, top + y, sh(hair, 0.95));
        // outline pass for readability (dark pixel where opaque meets transparent)
    });
    // outline
    const src = Uint8ClampedArray.from(data);
    for (let y = 0; y < fh; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4; if (src[i + 3]) continue;
        if ((x % fw) === 0 || (x % fw) === fw - 1) continue;
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < fh && src[(yy * W + xx) * 4 + 3]; });
        if (n) put(x, y, ol);
    }
    return { w: W, h: fh, fw, data };
}
async function importSheet(role) {
    const f = await pickFile('image/*'); if (!f) return;
    const url = await fileToDataUrl(f), im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = url; });
    const cur = P.sprites[role] || { w: 16, h: 16, frames: 2 };
    const frames = Math.max(1, Math.round(im.width / im.height * cur.h / cur.w));
    const src = await imageDataFromImg(im), fitted = NRKit.pixelize(src, cur.w * frames, cur.h, 15, false);
    P.sprites[role] = { image: dataUrlFromRGBA(fitted), w: cur.w, h: cur.h, frames: Math.min(frames, 8) }; dirty = true; renderAll();
}

/* ------------------------------------------------------------------ art: tiles, background, image converter */
function artTab(main) {
    const box = el('div', { class: 'pane' });
    box.append(styleBar(), el('h2', {}, 'World art'), el('h3', {}, 'Tile set'));
    box.append(el('div', { class: 'row' }, ...byStyle(LIB.tilesets).map(t => { const b = el('div', { class: 'pick' + (P.tileset.image === 'lib:' + t.png ? ' on' : ''), onclick: () => { P.tileset = { image: 'lib:' + t.png, cols: t.tiles.map(x => x.col), names: t.tiles.map(x => x.name) }; dirty = true; renderAll(); } }); thumb(b, 'lib:' + t.png, 16 * t.tiles.length, 16, 0, 2); b.append(el('small', {}, t.name)); return b; })));
    const tl = el('div', { class: 'row wrap' });
    P.tileset.cols.forEach((c, i) => { const cell = el('div', { class: 'tilecell' }); thumb(cell, P.tileset.image, 16, 16, i, 3);
        cell.append(el('select', { onchange: e => { P.tileset.cols[i] = +e.target.value; dirty = true; } }, ...['see-through', 'solid', 'jump-through', 'hurts'].map((n, k) => { const o = el('option', { value: k }, n); if (k === c) o.selected = true; return o; }))); tl.append(cell); });
    box.append(tl, el('button', { onclick: addTileFromImage }, '+ Make a tile from a picture'));
    box.append(el('h3', {}, 'Background'), el('div', { class: 'row' }, ...byStyle(LIB.backgrounds).map(b => { const d = el('div', { class: 'pick' + (P.background === 'lib:' + b.png ? ' on' : ''), onclick: () => { P.background = 'lib:' + b.png; dirty = true; renderAll(); } }); thumb(d, 'lib:' + b.png, 256, 192, 0, 0.5); d.append(el('small', {}, b.name)); return d; })),
        el('button', { onclick: () => converter('Background', 256, 192, 120, url => { P.background = url; dirty = true; renderAll(); }) }, 'Import a picture as background…'));
    box.append(el('h3', {}, 'Image converter'), el('p', { class: 'hint' }, 'Turns any picture into console-ready pixel art: resize, pixelize, cut the colours to what the DS layer can show, optional dithering.'),
        el('button', { onclick: () => converter('Convert any image', 64, 64, 32, url => { const a = el('a', { href: url, download: 'converted.png' }); a.click(); }) }, 'Open image converter…'));
    main.append(box);
}
async function addTileFromImage() { converter('New tile', 16, 16, 15, async url => {
    const cur = await imageData(P.tileset.image), add = await imageData(url), n = Math.floor(cur.w / 16);
    if (n >= 192) return notify('This tile set is full (192 tiles).');
    const out = { w: cur.w + 16, h: 16, data: new Uint8ClampedArray((cur.w + 16) * 16 * 4) };
    for (let y = 0; y < 16; y++) { out.data.set(cur.data.subarray(y * cur.w * 4, (y + 1) * cur.w * 4), y * out.w * 4); out.data.set(add.data.subarray(y * 64, y * 64 + 64), (y * out.w + cur.w) * 4); }
    P.tileset.image = dataUrlFromRGBA(out); P.tileset.cols.push(1); (P.tileset.names = P.tileset.names || []).push('My tile'); dirty = true; renderAll(); }); }
async function converter(title, w, h, colors, onUse) {
    const f = await pickFile('image/*'); if (!f) return;
    const url = await fileToDataUrl(f), im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = url; });
    const src = await imageDataFromImg(im);
    let opt = { w, h, colors, dither: false };
    const out = el('canvas', { class: 'pix' }), body = el('div', {});
    const redo = () => { const r = NRKit.pixelize(src, opt.w, opt.h, opt.colors, opt.dither); out.width = r.w * 3; out.height = r.h * 3; const t = el('canvas'); t.width = r.w; t.height = r.h; t.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0); const g = out.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(t, 0, 0, out.width, out.height); out._res = r; };
    const num = (k, min, max) => el('input', { type: 'number', min, max, value: opt[k], onchange: e => { opt[k] = Math.max(min, Math.min(max, +e.target.value)); redo(); } });
    body.append(el('div', { class: 'row wrap' }, el('label', {}, 'Width ', num('w', 8, 256)), el('label', {}, 'Height ', num('h', 8, 192)), el('label', {}, 'Colours ', num('colors', 2, 253)),
        el('label', {}, 'Dither ', el('input', { type: 'checkbox', onchange: e => { opt.dither = e.target.checked; redo(); } }))), out);
    redo();
    modal(title, body, [['Cancel', () => true, 'alt'], ['Use it', () => onUse(dataUrlFromRGBA(out._res)), 'go']]);
}

/* ------------------------------------------------------------------ music: step grid, preview, MIDI and MP3 import */
const noteName = n => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][n % 12] + (Math.floor(n / 12) - 1);
function lowpass(seg, sr, fc) { const out = new Float32Array(seg.length), a = Math.exp(-2 * Math.PI * fc / sr); let y = 0; for (let i = 0; i < seg.length; i++) { y = (1 - a) * seg[i] + a * y; out[i] = y; } return out; }
function pitch(seg, sr, fmin, fmax) {
    const minL = Math.floor(sr / fmax), maxL = Math.min(seg.length - 1, Math.floor(sr / fmin)); let best = 0, bl = 0, e0 = 0;
    for (const v of seg) e0 += v * v; if (e0 < 1e-6) return 0;
    for (let L = minL; L <= maxL; L++) { let s = 0; for (let i = 0; i + L < seg.length; i++) s += seg[i] * seg[i + L]; if (s > best) { best = s; bl = L; } }
    return best / e0 > 0.35 ? sr / bl : 0;
}
function estimateTempo(x, sr) {
    const hop = Math.floor(sr / 100), env = []; for (let i = 0; i + hop < x.length && env.length < 6000; i += hop) { let e = 0; for (let k = 0; k < hop; k++) e += Math.abs(x[i + k]); env.push(e); }
    const d = env.map((v, i) => Math.max(0, v - (env[i - 1] || 0))); let best = 120, bs = 0;
    for (let bpm = 70; bpm <= 170; bpm++) { const L = 6000 / bpm; let s = 0; for (let i = 0; i + L < d.length; i++) s += d[i] * d[Math.round(i + L)]; if (s > bs) { bs = s; best = bpm; } }
    return best;
}

/* ------------------------------------------------------------------ sounds: library, record, import */
function soundTab(main) {
    const box = el('div', { class: 'pane' }); box.append(el('h2', {}, 'Sound effects'), el('p', { class: 'hint' }, 'Each game moment has a sound. Use the built-in ones, record your own voice or sound with the microphone, or import a WAV/MP3 (up to 3 seconds).'));
    for (const k of NRKit.SFX_ORDER) {
        const row = el('div', { class: 'row' }, el('b', { style: 'width:80px' }, k));
        row.append(el('button', { onclick: () => playRef(P.sfx[k]) }, '▶'),
            el('select', { onchange: e => { P.sfx[k] = e.target.value; dirty = true; } }, ...LIB.sfx.map(s => { const o = el('option', { value: 'lib:' + s.wav }, s.name); if (P.sfx[k] === 'lib:' + s.wav) o.selected = true; return o; }), ...(P.sfx[k] && !P.sfx[k].startsWith('lib:') ? [(() => { const o = el('option', { value: P.sfx[k] }, 'My recording'); o.selected = true; return o; })()] : [])),
            el('button', { onclick: () => recordClip(k) }, '🎤 Record'), el('button', { class: 'alt', onclick: () => importClip(k) }, 'Import…'));
        box.append(row);
    }
    main.append(box);
}
async function playRef(ref) { if (!ref) return; const ac = AC(); const b = await ac.decodeAudioData(bytesFromDataUrl(libUrl(ref)).buffer); const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(); }
async function importClip(k) { const f = await pickFile('audio/*'); if (!f) return; const b = await AC().decodeAudioData(await f.arrayBuffer()); P.sfx[k] = toWavDataUrlSafe(b); dirty = true; renderAll(); }
function toWavDataUrlSafe(buf) {   // btoa-safe chunked conversion
    const rate = 16384, x = buf.getChannelData(0), n = Math.min(Math.floor(buf.duration * rate), rate * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) s[i] = x[Math.floor(i * buf.sampleRate / rate)] || 0;
    const b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, t) => [...t].forEach((c, i) => b[o + i] = c.charCodeAt(0));
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    let peak = 0.01; for (const q of s) peak = Math.max(peak, Math.abs(q));
    for (let i = 0; i < n; i++) b[44 + i] = Math.max(0, Math.min(255, Math.round(128 + s[i] / peak * 110)));
    let str = ''; for (let i = 0; i < b.length; i += 8192) str += String.fromCharCode(...b.subarray(i, i + 8192));
    return 'data:audio/wav;base64,' + btoa(str);
}
async function recordClip(k) {
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return notify('The microphone is not available here. You can import a WAV or MP3 instead.'); }
    const rec = new MediaRecorder(stream), parts = []; rec.ondataavailable = e => parts.push(e.data);
    const done = new Promise(r => rec.onstop = r); rec.start();
    const m = modal('Recording "' + k + '"…', el('p', {}, 'Make your sound now (up to 3 seconds).'), [['Stop', () => rec.stop(), 'go']]);
    setTimeout(() => { if (rec.state === 'recording') { rec.stop(); m.remove(); } }, 3000);
    await done; stream.getTracks().forEach(t => t.stop());
    const b = await AC().decodeAudioData(await new Blob(parts).arrayBuffer()); P.sfx[k] = toWavDataUrlSafe(b); dirty = true; renderAll();
}

/* ------------------------------------------------------------------ settings + technique library */
function settingsTab(main) {
    const M = P.meta, box = el('div', { class: 'pane' });
    const txt = (label, k, max) => el('label', {}, label + ' ', el('input', { class: 'wide', value: M[k] || '', maxlength: max, onchange: e => { M[k] = e.target.value; dirty = true; $('#title').textContent = M.title; } }));
    box.append(el('h2', {}, 'Game settings'), txt('Title', 'title', 30), txt('Made by', 'author', 30), txt('Tagline', 'tagline', 38),
        el('label', {}, 'Lives ', el('input', { type: 'number', min: 1, max: 9, value: M.lives, onchange: e => { M.lives = +e.target.value; dirty = true; } })),
        el('label', {}, 'Title music ', el('select', { onchange: e => { M.titleSong = +e.target.value; dirty = true; } }, ...P.songs.map((s, i) => { const o = el('option', { value: i }, s.name); if (i === M.titleSong) o.selected = true; return o; }))),
        consoleSwitch(), openingSection(), el('h3', {}, 'How the hero moves (Technique Library)'));
    const G = GENRES.types.find(g => g.id === P.genre); if (G) box.prepend(el('div', { class: 'genreinfo' }, el('b', {}, 'Game type: ' + G.name), el('p', {}, G.about), el('small', {}, 'Learns from: ' + G.learns_from.slice(0, 6).join(', '))));
    for (const [id, ph] of Object.entries(NRKit.PHYSICS)) {
        box.append(el('div', { class: 'card' + (M.physics.preset === id ? ' on' : ''), onclick: () => { M.physics = Object.assign({ preset: id }, ph); dirty = true; renderAll(); } }, el('b', {}, ph.name), el('small', {}, ph.source)));
    }
    {
        const num = (k, step) => el('label', {}, k + ' ', el('input', { type: 'number', step, value: M.physics[k], onchange: e => { M.physics[k] = +e.target.value; M.physics.preset = 'custom'; dirty = true; } }));
        box.append(el('div', { class: 'row wrap' }, num('gravity', 0.01), num('jump', 0.1), num('jumpRun', 0.1), num('run', 0.05), num('runFast', 0.05), num('accel', 0.005), num('maxFall', 0.5)),
            el('p', { class: 'hint' }, 'Units: pixels per frame (60 frames a second). Gravity is applied every frame; letting go of jump doubles it, for short hops.'));
    }
    main.append(box);
}
const ALLTECH = () => [...TECH, ...genreTechRows(), ...labTechRows(), ...NRGfx.rules([...CODEDB, ...labLoad()])];
function techTab(main) {
    const box = el('div', { class: 'pane' }), q = el('input', { class: 'wide', placeholder: 'Search: jump, damage, walking, story, wrestling…' });
    const list = el('div', {});
    const draw = () => { list.innerHTML = ''; const s = q.value.toLowerCase();
        ALLTECH().filter(t => !s || JSON.stringify(t).toLowerCase().includes(s)).forEach(t => list.append(el('div', { class: 'tech' }, el('b', {}, t.system), el('small', {}, ` ${t.game} (${t.platform}) · ${t.category}`), el('p', {}, t.what), t.numbers ? el('p', { class: 'num' }, '📏 ' + t.numbers) : '', t.feel ? el('p', { class: 'feel' }, '✨ ' + t.feel) : ''))); };
    q.oninput = draw;
    const chips = el('div', { class: 'row wrap' }, ...['Graphic design', 'Game types', 'Research Lab', 'wrestling', 'jump', 'story'].map(c => el('button', { class: 'mini alt', onclick: () => { q.value = c; draw(); } }, c)));
    box.append(el('h2', {}, 'Technique Library'), el('p', { class: 'hint' }, `${ALLTECH().length} measured game systems, game types, graphic design techniques and Research Lab findings from the ROM catalog. They are facts and numbers about how classic games behave; the kit's engines recreate them with our own code, so your game stays yours.`), chips, q, list);
    draw(); main.append(box);
}


/* ------------------------------------------------------------------ Fix it: type what's wrong -> offline checks + AI */
let fixLevel = 0, aiState = { busy: false, out: '', proposal: null }, sampleFn, apiKey = '';
try { apiKey = localStorage.getItem('nr_api_key') || ''; } catch (e) {}
setTimeout(async () => { try { sampleFn = window.claude && await window.claude.use('sample'); } catch (e) { sampleFn = null; } }, 0);
function logFix(complaint, lines, source) {
    (P.fixlog = P.fixlog || []).push({ time: new Date().toISOString(), complaint, source, changes: lines });
}
function fixTab(main) {
    const box = el('div', { class: 'pane' }), L = P.levels[fixLevel] || P.levels[0];
    const ta = el('textarea', { rows: 3, class: 'wide', placeholder: 'Tell the studio what\'s wrong. Example: "the trampoline is stuck in the ground" or "I can\'t jump over the spikes after the first platform"' });
    ta.value = aiState.complaint || '';
    const levelSel = el('select', { onchange: e => { fixLevel = +e.target.value; renderAll(); } }, ...P.levels.map((l, i) => { const o = el('option', { value: i }, l.name); if (i === fixLevel) o.selected = true; return o; }));
    box.append(el('h2', {}, '🩺 Fix it'), el('p', { class: 'hint' }, 'Step 1 runs offline: the studio plays every level itself with the same physics as the console and repairs what it can. Step 2 asks AI (online) for anything the checks miss; you see every change before it is applied.'),
        el('div', { class: 'row' }, el('span', {}, 'Level: '), levelSel), ta);
    const res = el('div', {});
    box.append(el('div', { class: 'row' },
        el('button', { class: 'go', onclick: () => { aiState.complaint = ta.value; const r = NRKit.checkLevel(P, fixLevel); aiState.check = r; renderAll(); } }, '1. Run the checks (offline)'),
        el('button', { onclick: () => { aiState.complaint = ta.value; const f = NRKit.autofixLevel(P, fixLevel); logFix(ta.value || 'auto-fix', f.log, 'offline'); aiState.check = f.check; aiState.fixed = f.log; dirty = true; renderAll(); } }, '🔧 Repair automatically'),
        el('button', { onclick: () => { aiState.complaint = ta.value; askAI(); } }, '2. Ask AI ✨')));
    if (aiState.check) {
        const r = aiState.check;
        res.append(el('div', { class: 'checkres ' + (r.issues.length ? 'bad' : 'good') }, r.issues.length ? `Found ${r.issues.length} problem(s) in ${L.name}:` : `✅ ${L.name} is playable: the goal can be reached without the run button, with room for error.`, ...r.issues.map(i => el('div', {}, `• ${i.msg}  [${i.code}]`))));
    }
    if (aiState.fixed) res.append(el('div', { class: 'checkres good' }, 'Changes made:', ...aiState.fixed.map(l => el('div', {}, '• ' + l))));
    const localOn = typeof TPL !== 'undefined' && TPL.ai.kind !== 'none' && typeof aiClient === 'function' && aiClient(), aiAvail = localOn ? 'The offline AI on this computer answers this (nothing leaves your computer).' : sampleFn ? 'AI is available through your Claude account (it will ask permission the first time).' : (apiKey ? 'AI uses your Anthropic API key.' : 'No AI yet: set up the Built-in offline AI in Make me a game (one-time download). An Anthropic API key below is optional.');
    res.append(el('p', { class: 'hint' }, aiAvail));
    if (!sampleFn) res.append(el('div', { class: 'row' }, el('label', {}, 'API key ', el('input', { type: 'password', value: apiKey, placeholder: 'sk-ant-…', onchange: e => { apiKey = e.target.value.trim(); try { localStorage.setItem('nr_api_key', apiKey); } catch (err) {} } }))));
    if (aiState.busy) res.append(el('p', {}, 'Thinking…'));
    if (aiState.out) res.append(el('div', { class: 'checkres' }, aiState.out));
    if (aiState.proposal) {
        const pr = aiState.proposal;
        res.append(el('div', { class: 'checkres' }, el('b', {}, 'AI suggests these changes:'), ...pr.applied.map(o => el('div', {}, '• ' + describeOp(o))),
            pr.rejected.length ? el('div', { class: 'hint' }, `${pr.rejected.length} suggestion(s) were unsafe or invalid and were dropped.`) : '',
            el('div', {}, pr.after.reachable ? '✅ After these changes the checker can finish the level.' : '⚠️ After these changes the checker still can\'t finish the level.'),
            el('div', { class: 'row' }, el('button', { class: 'go', onclick: () => { P = pr.project; logFix(aiState.complaint, pr.applied.map(describeOp), 'ai'); aiState.proposal = null; aiState.check = NRKit.checkLevel(P, fixLevel); dirty = true; renderAll(); } }, 'Apply'),
                el('button', { class: 'alt', onclick: () => { aiState.proposal = null; renderAll(); } }, 'Discard'))));
    }
    const kq = el('input', { class: 'wide', placeholder: 'Search known problems, e.g. "sprites invisible" or "touch not working"', value: aiState.kq || '' }), kc = el('select', { onchange: e => { aiState.kcon = e.target.value; renderAll(); } }, ...Object.entries(NRKnowledge.CONSOLES).map(([id, c]) => { const o = el('option', { value: id }, c.name); if (id === (aiState.kcon || P.console || 'ds')) o.selected = true; return o; }));
    const con = aiState.kcon || P.console || 'ds', C0 = NRKnowledge.CONSOLES[con], hits = aiState.kq ? NRKnowledge.lookup(aiState.kq, con, P.knowledge).slice(0, 6) : NRKnowledge.FIXES.concat(P.knowledge || []).filter(f => f.con.includes('*') || f.con.includes(con)).slice(0, 6).map(f => ({ fix: f }));
    box.append(res, el('h3', {}, '📚 Console help and known fixes'), el('div', { class: 'row' }, kc, kq, el('button', { onclick: () => { aiState.kq = kq.value; renderAll(); } }, 'Search')),
        el('div', { class: 'tech' }, el('b', {}, C0.name), el('p', {}, `CPU ${C0.cpu}. Screen ${C0.screen}. RAM ${C0.ram}.`), el('p', {}, 'Graphics: ' + C0.gfx), el('p', {}, 'Sound: ' + C0.sound), el('p', { class: 'note' }, C0.notes)),
        ...hits.map(h => el('div', { class: 'tech' }, el('b', {}, h.fix.symptom), el('p', {}, 'Cause: ' + h.fix.cause), el('p', { class: 'note' }, 'Fix: ' + h.fix.fix))),
        el('button', { class: 'alt', onclick: () => { const sym = prompt('What went wrong?'); if (!sym) return; const fx = prompt('How did you fix it?') || ''; NRKnowledge.record(P, { con: [con], symptom: sym, fix: fx }); dirty = true; renderAll(); } }, '+ Add a problem I solved'),
        el('h3', {}, '🧾 Item Audit'), el('p', { class: 'hint' }, 'Paste where items come from and the studio proves every item can be obtained. Lines: "items: ruby, hoe" / "shop General Store: seed, hoe" / "drop mine: coal, stone" / "recipe chest = wood x50" / "gift Hush: moonstone".'),
        (() => { const ta = el('textarea', { class: 'wide', rows: 5, placeholder: 'shop General Store: hoe, seed\ndrop mine: stone, coal\nrecipe furnace = stone x25, coal' }, aiState.iaText || ''); const out = el('pre', { class: 'tech' }, aiState.iaOut || ''); return el('div', {}, ta, el('button', { onclick: () => { aiState.iaText = ta.value; aiState.iaOut = NRItemAudit.report(NRItemAudit.audit(NRItemAudit.fromText(ta.value))); renderAll(); } }, 'Run audit'), out); })(),
        el('h3', {}, 'Fix log'), el('p', { class: 'hint' }, 'Every repair is recorded so the dev kit can learn which problems happen most. Send this file back to improve future versions.'),
        el('div', {}, ...(P.fixlog || []).slice(-8).reverse().map(f => el('div', { class: 'tech' }, el('small', {}, `${f.time.slice(0, 16).replace('T', ' ')} · ${f.source}`), el('p', {}, f.complaint || '(automatic)'), ...f.changes.map(c => el('p', { class: 'num' }, c))))),
        el('button', { onclick: () => download('fix_log.json', JSON.stringify({ game: P.meta.title, kit: 'notareal-ds-side2d', rules: NRKit.FIX_RULES, log: P.fixlog || [] }, null, 1), 'application/json') }, 'Download fix log'));
    main.append(box);
}
function describeOp(o) {
    return ({ set_tile: () => `Set tile at column ${o.x}, row ${o.y} to "${(P.tileset.names || [])[o.tile] || o.tile}"`, remove_object: () => `Remove the thing at column ${o.x}, row ${o.y}`,
              add_object: () => `Add a ${o.type} at column ${o.x}, row ${o.y}`, move_object: () => `Move the thing at ${o.from.x},${o.from.y} to ${o.to.x},${o.to.y}`,
              set_physics: () => `Change ${o.key} to ${o.value}`, set_lives: () => `Set lives to ${o.value}` }[o.op] || (() => JSON.stringify(o)))();
}
async function askAI() {
    const L = P.levels[fixLevel], r = NRKit.checkLevel(P, fixLevel);
    const tiles = P.tileset.cols.map((c, i) => `${i}: ${(P.tileset.names || [])[i] || 'tile'} (${['see-through', 'solid', 'jump-through', 'hurts'][c]})`).join('\n');
    const prompt = `${NRKnowledge.context(P.console || 'ds', aiState.complaint, P.knowledge)}You are the repair assistant inside the Notareal Game Studio dev kit (a ROM maker for kids and studios).
The game is a Nintendo DS 2D sidescroller. The player says: "${aiState.complaint || 'Please check this level for problems.'}"

Level "${L.name}" is ${L.w} columns x ${L.h} rows (row 0 at the top; the hero falls with gravity). Map legend: . empty  # solid  = jump-through  ^ hurts  S start  G goal  J spring  c coin  w/h/f enemies  H heart  k checkpoint.
${NRKit.levelText(P, fixLevel)}

Tiles (index: name, collision):
${tiles}
Hero physics (pixels/frame, 16 px per tile, 60 fps): ${JSON.stringify(P.meta.physics)}. The hero is ${P.sprites.hero.w}x${P.sprites.hero.h} px.
The offline checker (it simulates the real physics, without the run button, with a 10% human margin) reports: ${r.issues.length ? r.issues.map(i => i.msg).join(' | ') : 'no problems'}.

Reply with ONLY a JSON object: {"explanation": "one or two plain-language sentences", "ops": [ ... ]} using these operations (columns/rows are tile coordinates, level index ${fixLevel}):
{"op":"set_tile","level":${fixLevel},"x":0,"y":0,"tile":0}   (tile 0 = empty)
{"op":"remove_object","level":${fixLevel},"x":0,"y":0}
{"op":"add_object","level":${fixLevel},"type":"coin|walker|hopper|flyer|spring|heart|check|goal|start","x":0,"y":0}
{"op":"move_object","level":${fixLevel},"from":{"x":0,"y":0},"to":{"x":0,"y":0}}
{"op":"set_physics","key":"gravity|jump|jumpRun|run|runFast|accel|maxFall","value":0}
{"op":"set_lives","value":5}
Make the smallest set of changes that fixes what the player described. Keep the level's style.`;
    aiState.busy = true; aiState.out = ''; aiState.proposal = null; renderAll();
    try {
        let obj;
        const local = (typeof aiClient === 'function' && typeof TPL !== 'undefined') ? aiClient() : null;
        if (local) { const raw = await local(prompt, { maxTokens: 900 }); obj = NRAI.safeJson(raw); if (!obj) throw { message: 'the offline AI did not return a usable answer. Try again or describe the problem more simply.' }; }
        else if (sampleFn) obj = await sampleFn.json(prompt, { modelTier: 'default' });
        else if (apiKey) {
            const resp = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
                body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }) });
            const j = await resp.json(); if (!resp.ok) throw { code: 'api', message: (j.error && j.error.message) || resp.status };
            const t = j.content.map(c => c.text || '').join(''); obj = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
        } else { aiState.out = 'The offline AI isn\'t set up. Open Make me a game, then Built-in offline AI, and press Download the AI (one time). The offline checks and repairs (buttons 1 and the auto-fix) work without it.'; return; }
        const pr = NRKit.applyOps(P, obj.ops || []); pr.after = NRKit.checkLevel(pr.project, fixLevel);
        aiState.out = obj.explanation || ''; aiState.proposal = pr;
    } catch (e) { aiState.out = e && e.code === 'not_granted' ? 'AI was not allowed for this page.' : 'AI could not answer: ' + ((e && e.message) || e); }
    finally { aiState.busy = false; renderAll(); }
}

/* ------------------------------------------------------------------ files */
function pickFile(accept) { return new Promise(res => { const i = el('input', { type: 'file', accept }); i.onchange = () => res(i.files[0] || null); i.click(); }); }
function fileToDataUrl(f) { return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); }); }
async function imageDataFromImg(im) { const c = el('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return { w: im.width, h: im.height, data: g.getImageData(0, 0, im.width, im.height).data }; }
/* downloads: the published page asks the viewer through the 'downloads' capability; a local copy uses a normal link */
let dlCap; setTimeout(async () => { try { dlCap = window.claude && await window.claude.use('downloads'); } catch (e) { dlCap = null; } }, 0);
async function download(name, data, type) {
    if (dlCap) { try { await dlCap.save({ filename: name, data: new Blob([data], { type }) }); return; } catch (e) { try { await dlCap.save({ filename: name, data: typeof data === 'string' ? data : new Uint8Array(data) }); return; } catch (e2) { notify('The download was cancelled.'); return; } } }
    const a = el('a', { href: URL.createObjectURL(new Blob([data], { type })), download: name }); document.body.append(a); a.click(); a.remove();
}
function notify(msg) { modal('Notareal Game Studio', el('p', {}, msg), [['OK', () => true, 'go']]); }
async function openFile() { const f = await pickFile('.json,.nrproj'); if (!f) return; try { const p = JSON.parse(await f.text()); if (p.format !== 'notareal-project') throw new Error('not a Notareal project'); setProject(p); } catch (e) { notify('Could not open: ' + e.message); } }
function saveFile() { if (!P) return; download((P.meta.title || 'game').replace(/\W+/g, '_') + '.nrproj.json', JSON.stringify(P), 'application/json'); dirty = false; }

/* ------------------------------------------------------------------ export ROM */
async function exportRom() {
    if (!P) return;
    if (P.sigil && String(P.genre) === 'music_maker') return P.console === 'pc' ? download((P.sigil.name || 'song').replace(/\W+/g, '_') + '.wav', NRSigil.renderWav(P.sigil, { bars: P.sigil.songmode ? P.sigil.chainlen : 4 }).wav, 'audio/wav') : exportSigilRom();
    if (P.bracelet && P.console === 'ds') return exportBraceletRom();
    if (P.godsim && P.console === 'ds') return exportGodsimRom();
    if (P.fight && P.console === 'ds' && String(P.genre) === 'wrestling') return exportWrestleRom();
    if (P.console === 'pc') { if (P.arcade) return exportArcade(); return exportPC(); }
    if (P.console === 'ds' && P.arcade && NRWorld3D.MODES[P.arcade.mode] !== undefined) return exportArcadeDS();
    if ((P.console === 'n64' || P.console === 'psx') && P.arcade && NRWorld3D.idx(P.arcade.mode) !== undefined) return exportArcadeSoft();
    if (P.miniMode === 'race' && P.console === 'ds' && P.arcade) return exportArcadeDS();
    if (P.miniMode === 'race' && P.console === 'snes') return exportKartSnes();
    if (P.console === 'snes' && P.arcade && P.arcade.mode === 'basketball') return exportBasketSnes();
    const status = modal('Building your ROM…', el('p', { id: 'buildmsg' }, 'Converting art, music and sounds for the DS…'), [['Close', () => true, 'alt']]);
    try {
        const refs = new Set([P.tileset.image, P.background, ...Object.values(P.sprites).flatMap(s => [s.image, s.td]), P.opening && P.opening.top, P.opening && P.opening.bottom].filter(Boolean));
        const imgs = new Map(); for (const r of refs) imgs.set(r, await imageData(r));
        if (['gb', 'gbc', 'nes', 'gba', 'n64', 'psx'].includes(P.console)) { await exportMini(imgs); return; }
        const snds = new Map(); for (const r of Object.values(P.sfx || {})) if (r && !snds.has(r)) snds.set(r, NRKit.toPCM8(NRKit.parseWav(bytesFromDataUrl(libUrl(r)))));
        const problems = (P.world && P.exportWorld !== false) ? [] : P.levels.map((L, i) => [L.name, NRKit.checkLevel(P, i).issues]).filter(x => x[1].length);
        const worldExport = P.world && P.world.maps.length && P.exportWorld !== false && P.console !== 'snes';
        if (worldExport) { syncWorldTilesets(); for (const t of Object.values(P.worldTilesets)) if (!imgs.has(t.image)) imgs.set(t.image, await imageData(t.image)); }
        const res = worldExport ? NRKit.buildDSWorld(Object.assign({}, P, { touch: { layout: 'text' } }), { img: r => imgs.get(r), snd: r => snds.get(r) }) : NRKit.buildDS(P, { img: r => imgs.get(r), snd: r => snds.get(r) });
        problems.forEach(([n, iss]) => iss.forEach(i => res.warnings.push(`${n}: ${i.msg} (open 🩺 Fix it to repair)`)));
        if (P.console === 'snes') {
            const sres = NRSnes.build(P, { img: r => imgs.get(r), snd: r => NRKit.parseWav(bytesFromDataUrl(libUrl(r))) });
            const sout = NRSnes.patch(await gunzipB64(ROMS.snes_side2d), sres.block);
            download((P.meta.title || 'game').replace(/\W+/g, '_') + '.sfc', sout.rom, 'application/octet-stream');
            $('#buildmsg').innerHTML = `Done! <b>${P.meta.title || 'game'}.sfc</b> downloaded (${Math.round(sres.used / 1024)} KB of game data; music ${Math.round(sres.sound.bytes / 1024)} KB of the 56 KB sound memory).<br>Plays in Snes9x / bsnes, on the RG DS Plus SNES core, or on a flash cart.` + ([...res.warnings, ...sres.warnings].length ? '<br><br>⚠️ ' + [...res.warnings, ...sres.warnings].join('<br>⚠️ ') : '');
            return;
        }
        const tpl = await gunzipB64(ROMS.ds_side2d);
        const out = NRKit.patchROM(tpl, res.block);
        download((P.meta.title || 'game').replace(/\W+/g, '_') + '.nds', await withBanner(out.rom), 'application/octet-stream');
        $('#buildmsg').innerHTML = `Done! <b>${(P.meta.title || 'game')}.nds</b> downloaded (${Math.round(out.used / 1024)} KB of game data, ${Math.round(out.used / out.capacity * 100)}% of the space).<br>Copy it to your RG DS Plus (roms/NDS) and open it in DraStic.` + (res.warnings.length ? '<br><br>⚠️ ' + res.warnings.join('<br>⚠️ ') : '');
    } catch (e) { $('#buildmsg').textContent = 'Something went wrong: ' + e.message; console.error(e); }
}

/* ------------------------------------------------------------------ test play (same rules as the DS engine) */
async function testPlay() {
    if (P && P.sigil && String(P.genre) === 'music_maker') return sigilPlay();
    if (!P) return;
    const cv = el('canvas', { width: 256, height: 192, class: 'pix play' }), info = el('p', { class: 'hint' }, 'Arrows move · Z or Space jumps · X runs · Esc closes. This preview follows the same rules as the DS engine.');
    const m = modal('Test play: ' + P.levels[curLevel].name, el('div', {}, cv, info), [['Close', () => { stop = true; }, 'alt']]);
    let stop = false; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const ts = await loadImage(P.tileset.image), bg = P.background ? await loadImage(P.background) : null;
    const sp = {}; for (const [k, s] of Object.entries(P.sprites)) sp[k] = { ...s, im: await loadImage(s.image) };
    const L = P.levels[curLevel], ph = P.meta.physics, cols = P.tileset.cols, keys = {};
    const kd = e => { keys[e.key] = true; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault(); if (e.key === 'Escape') { stop = true; m.remove(); } };
    const ku = e => keys[e.key] = false; window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    const col = (x, y) => { const mx = Math.floor(x / 16), my = Math.floor(y / 16); if (mx < 0 || mx >= L.w) return 1; if (my < 0 || my >= L.h) return 0; return cols[L.map[my * L.w + mx]] || 0; };
    const hero = sp.hero, hw = hero.w - 4, hh = hero.h - 2;
    const st = L.objects.find(o => o.type === 'start') || { x: 2, y: 11 };
    let px = st.x * 16 + (16 - hw) / 2, py = st.y * 16 + 16 - hh, vx = 0, vy = 0, ground = false, coy = 0, jb = 0, camx = 0, camy = 64, dir = 1, frame = 0, coins = 0, dead = 0, clear = 0, score = 0;
    const acts = L.objects.filter(o => o.type !== 'start').map(o => ({ ...o, ax: o.x * 16, ay: o.y * 16, vx: o.type === 'walker' ? -0.5 : o.type === 'flyer' ? -0.6 : 0, vy: 0, alive: true, t: 0, st: 0, y0: o.y * 16 }));
    const solidish = c => c === 1 || c === 2;
    let prevJump = false;
    function step() {
        frame++;
        const jumpHeld = keys['z'] || keys['Z'] || keys[' '] || keys['ArrowUp'], jumpPressed = jumpHeld && !prevJump; prevJump = jumpHeld;
        if (dead) { dead++; vy += ph.gravity; py += vy; if (dead > 90) { dead = 0; px = st.x * 16; py = st.y * 16 + 16 - hh; vx = vy = 0; } return; }
        if (clear) { clear++; return; }
        const maxv = (keys['x'] || keys['X']) ? ph.runFast : ph.run;
        if (keys['ArrowLeft']) { vx = Math.max(-maxv, vx - ph.accel); dir = 0; } else if (keys['ArrowRight']) { vx = Math.min(maxv, vx + ph.accel); dir = 1; } else vx = vx > 0 ? Math.max(0, vx - ph.accel) : Math.min(0, vx + ph.accel);
        let nx = px + vx;
        if (vx > 0 && [py, py + hh / 2, py + hh - 1].some(y => col(nx + hw - 1, y) === 1)) { nx = Math.floor((nx + hw - 1) / 16) * 16 - hw; vx = 0; }
        if (vx < 0 && [py, py + hh / 2, py + hh - 1].some(y => col(nx, y) === 1)) { nx = Math.floor(nx / 16) * 16 + 16; vx = 0; }
        px = Math.max(0, nx);
        jb = jumpPressed ? 6 : Math.max(0, jb - 1); coy = ground ? 6 : Math.max(0, coy - 1);
        if (jb && coy) { let j = ph.jump; if (ph.jumpRun && ph.runFast) j += (ph.jumpRun - ph.jump) * Math.min(Math.abs(vx), ph.runFast) / ph.runFast; vy = -j; jb = coy = 0; ground = false; }
        let gr = ph.gravity; if (vy < 0 && !jumpHeld) gr *= 2; vy = Math.min(ph.maxFall || 6, vy + gr);
        let ny = py + vy; ground = false;
        if (vy >= 0) { for (const sx of [px + 1, px + hw - 2]) { const c = col(sx, ny + hh), top = Math.floor((ny + hh) / 16) * 16; if (c === 1 || (c === 2 && py + hh <= top)) { ny = top - hh; vy = 0; ground = true; break; } } }
        else if (col(px + 1, ny) === 1 || col(px + hw - 2, ny) === 1) { ny = Math.floor(ny / 16) * 16 + 16; vy = 0; }
        py = ny;
        if (col(px + hw / 2, py + hh - 2) === 3 || py > L.h * 16 + 32) { dead = 1; vy = -4; }
        for (const a of acts) {
            if (!a.alive) continue; a.t++;
            if (a.type === 'walker' || a.type === 'hopper') {
                if (a.st) { if (++a.st > 24) a.alive = false; continue; }
                if (a.type === 'hopper') { const gnd = solidish(col(a.ax + 8, a.ay + 16)); if (gnd && a.vy >= 0 && a.t % 70 === 0) { a.vy = -4; a.vx = (px < a.ax ? -1 : 1) * 0.75; } if (gnd && a.vy >= 0 && a.t % 70 > 2) a.vx = 0; }
                a.vy = Math.min(5, a.vy + ph.gravity); a.ax += a.vx;
                if ((a.vx < 0 && col(a.ax, a.ay + 8) === 1) || (a.vx > 0 && col(a.ax + 15, a.ay + 8) === 1)) { a.vx = -a.vx; a.ax += a.vx * 2; }
                if (a.type === 'walker') { const fx = a.vx < 0 ? a.ax - 1 : a.ax + 16; if (!solidish(col(fx, a.ay + 17)) && col(a.ax + 8, a.ay + 17)) a.vx = -a.vx; }
                a.ay += a.vy; if (a.vy >= 0 && (solidish(col(a.ax + 3, a.ay + 16)) || solidish(col(a.ax + 12, a.ay + 16)))) { a.ay = Math.floor((a.ay + 16) / 16) * 16 - 16; a.vy = 0; }
            }
            if (a.type === 'flyer') { a.ax += a.vx; if (a.t % 160 === 0) a.vx = -a.vx; a.ay = a.y0 + Math.sin(a.t * 300 / 32768 * Math.PI * 2) * 20; }
            const bh = a.type === 'goal' ? 224 : 16, by = a.type === 'goal' ? a.ay - 208 : a.ay;
            if (!(px < a.ax + 14 && a.ax + 2 < px + hw && py < by + bh && by + 2 < py + hh)) continue;
            if (a.type === 'coin') { a.alive = false; coins++; score += 10; }
            else if (a.type === 'heart') { a.alive = false; score += 50; }
            else if (a.type === 'spring' && vy > 0) { vy = -ph.jump * 1.6; a.st = 8; }
            else if (a.type === 'goal') { clear = 1; score += 1000; }
            else if (['walker', 'hopper', 'flyer'].includes(a.type) && !a.st) { if (vy > 0 && py + hh < a.ay + 10) { a.st = 1; if (a.type === 'flyer') a.alive = false; vy = -ph.jump * 0.6; score += 100; } else { dead = 1; vy = -4; } }
        }
        const tx = px + hw / 2 - 112 + (dir ? 16 : -16); camx += (tx - camx) / 6; camx = Math.max(0, Math.min(L.w * 16 - 256, camx));
        const ty = py - 100; camy += (ty - camy) / 6; camy = Math.max(0, Math.min(L.h * 16 - 192, camy));
    }
    function draw() {
        g.fillStyle = '#69c'; g.fillRect(0, 0, 256, 192);
        if (bg) { const bx = -((camx / 2) % 256); g.drawImage(bg, bx, -camy / 4); g.drawImage(bg, bx + 256, -camy / 4); }
        const cx = Math.floor(camx), cy = Math.floor(camy);
        for (let my = 0; my < L.h; my++) for (let mx = Math.floor(cx / 16); mx <= Math.floor(cx / 16) + 16 && mx < L.w; mx++) { const t = L.map[my * L.w + mx]; if (t) g.drawImage(ts, t * 16, 0, 16, 16, mx * 16 - cx, my * 16 - cy, 16, 16); }
        for (const a of acts) { if (!a.alive) continue; const s = sp[OBJ.find(o => o.type === a.type).icon]; if (!s) continue;
            let f = 0; if (a.type === 'coin') f = (frame >> 3) & 3; else if (a.st && a.type !== 'spring') f = 2; else if (a.type === 'spring') { f = a.st ? 1 : 0; if (a.st) a.st--; } else f = (frame >> 4) & 1;
            g.drawImage(s.im, (f % s.frames) * s.w, 0, s.w, s.h, Math.round(a.ax - cx), Math.round(a.ay - cy - (a.type === 'goal' ? 16 : 0)), s.w, s.h); }
        const hf = dead ? 4 : !ground ? 3 : vx ? 1 + ((frame >> 3) & 1) : 0;
        g.save(); const hx = Math.round(px - (hero.w - hw) / 2 - cx), hy = Math.round(py - (hero.h - hh) - cy);
        if (!dir) { g.translate(hx + hero.w, hy); g.scale(-1, 1); g.drawImage(hero.im, hf * hero.w, 0, hero.w, hero.h, 0, 0, hero.w, hero.h); } else g.drawImage(hero.im, hf * hero.w, 0, hero.w, hero.h, hx, hy, hero.w, hero.h);
        g.restore();
        g.fillStyle = '#fff'; g.font = '8px monospace'; g.fillText(`SCORE ${score}  COINS ${coins}`, 4, 10);
        if (clear) { g.font = 'bold 14px monospace'; g.fillText('LEVEL CLEAR!', 80, 90); }
    }
    let last = performance.now(), acc = 0;
    (function loop(t) { if (stop) { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); return; } acc += Math.min(100, t - last); last = t; while (acc >= 1000 / 60) { step(); acc -= 1000 / 60; } draw(); requestAnimationFrame(loop); })(last);
}

/* ------------------------------------------------------------------ boot */
window.addEventListener('DOMContentLoaded', () => {
    $$('.tabbtn').forEach(b => b.onclick = () => { if (!P) return; tab = b.dataset.tab; renderAll(); });
    $('#new').onclick = wizard; $('#open').onclick = openFile; $('#save').onclick = saveFile; $('#play').onclick = testPlay; $('#export').onclick = exportRom;
    deskInit().then(() => { try { reRefreshStyles(); if (DESK.ok) renderAll(); } catch (e) {} });
    window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    renderAll();
});

async function exportMini(imgs) {
    const c = P.console, tpl = ROMS['mini_' + (P.miniMode ? P.miniMode + '_' : '') + (c === 'gbc' ? 'gb' : c)], ext = { gb: 'gb', gbc: 'gbc', nes: 'nes', gba: 'gba', n64: 'z64', psx: 'exe' }[c];
    const logoUrl = document.querySelector('header img').src, logo = await imageData(logoUrl);
    const res = NRMini.build(P, { img: r => imgs.get(r) }, c, logo), rom = NRMini.patch(await gunzipB64(tpl), res, c);
    download((P.meta.title || 'game').replace(/\W+/g, '_') + '.' + ext, rom, 'application/octet-stream');
    $('#buildmsg').innerHTML = `Done! <b>${P.meta.title || 'game'}.${ext}</b> downloaded (${Math.round(res.stats.bytes / 1024)} KB of ${Math.round(res.stats.capacity / 1024)} KB game data, ${res.stats.levels} levels).<br>Plays in any ${NRMini.CON[c === 'gbc' ? 'gb' : c].name} emulator or on a flash cart.` + (c === 'psx' ? '<br>PlayStation: this is a PS-EXE (load it in DuckStation / PCSX or a PS1 loader; burning a disc needs the SDK image tool).' : '') + (res.warnings.length ? '<br><br>⚠️ ' + res.warnings.join('<br>⚠️ ') : '');
}

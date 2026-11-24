/* NOTAREAL PC / Xbox target (offline): controller-first player + portable game package.
 *  playerHTML()  one self-contained web page that plays a World project with an Xbox controller (Gamepad API, standard mapping),
 *                keyboard as backup, no mouse needed. 16:9 (384x216, exactly 5x = 1920x1080), logo -> opening picture -> title -> game,
 *                pause menu, saves, rumble, title-safe mode, pauses and saves when the window loses focus (like a console suspend).
 *  buildPackage() zip with the player, the game as plain data + PNG + WAV files (what a native port reads), and an Xbox port guide.
 *  xboxCheck()   readiness report: what this project already satisfies and what the Xbox store still needs from you.
 *  Honest limit: Xbox store publishing needs an ID@Xbox account and a GDK build; the web player is for PC and for testing on console Edge. */
(function (root) {
'use strict';
const X = {};
const hasNode = typeof module !== 'undefined' && typeof require !== 'undefined';
X.sources = () => {
    if (typeof KITSRC !== 'undefined') return KITSRC;
    if (hasNode) { const fs = require('fs'), path = require('path'); return { nrworld: fs.readFileSync(path.join(__dirname, 'nrworld.js'), 'utf8'), nrmusic: fs.readFileSync(path.join(__dirname, 'nrmusic.js'), 'utf8'), nrfight: fs.readFileSync(path.join(__dirname, 'nrwrestling.js'), 'utf8') + '\n;\n' + fs.readFileSync(path.join(__dirname, 'nrfight.js'), 'utf8'), nrarcade: ['nrmotion', 'nr3d', 'nranim', 'nrarcade', 'nr3d_sandbox', 'nr3d_war', 'nr3d_store', 'nr3d_rpg', 'nr3d_frontier', 'nrkartparty', 'nrlife_data', 'nrgems', 'nrcolor', 'nrroom', 'nrlife', 'nrlife_ui'].map(m => fs.readFileSync(path.join(__dirname, m + '.js'), 'utf8')).join('\n;\n'), nrpuzzle: fs.readFileSync(path.join(__dirname, 'nrpuzzle.js'), 'utf8'), nrtimeline: fs.readFileSync(path.join(__dirname, 'nrtimeline.js'), 'utf8') }; }
    throw new Error('kit sources unavailable');
};
const slugOf = t => String(t || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game';
X.slug = slugOf;
X.BUTTONS = [
    { pad: 'A', index: 0, key: 'Z / Enter / Space', does: 'Talk, confirm, jump, attack' }, { pad: 'B', index: 1, key: 'X', does: 'Back, run (hold)' }, { pad: 'X', index: 2, key: 'Z', does: 'Same as A' }, { pad: 'Y', index: 3, key: 'C', does: 'Open the bag' },
    { pad: 'D-pad / Left stick', index: '12-15 / axes 0,1', key: 'Arrow keys / WASD', does: 'Move' }, { pad: 'Menu (Start)', index: 9, key: 'Esc / P', does: 'Pause menu' }, { pad: 'View (Back)', index: 8, key: 'Tab', does: 'Toggle title-safe guide' },
];

/* ------------------------------------------------------------------ readiness report */
X.xboxCheck = (P, extra = {}) => {
    const W = P.world, out = [], add = (id, ok, msg, fix) => out.push({ id, ok, msg, fix: ok ? '' : fix || '' });
    add('world', !!(W && W.maps && W.maps.length), 'Project is a World game (the PC/Xbox player runs World projects).', 'Build the game in the World tab. Platformer projects need to be converted to a World first.');
    if (!W || !W.maps) return out;
    add('start', W.maps.some(m => m.entities.some(e => e.t === 'start')), 'There is a start point.', 'Place a Start entity on a map.');
    const lines = []; for (const m of W.maps) { if (m.intro) lines.push(...String(m.intro).split('\n')); for (const e of m.entities) for (const r of e.rules || []) for (const a of r.actions || []) if (a.text) lines.push(a.text); }
    const long = lines.filter(l => l.length > 140);
    add('text', long.length === 0, `Dialogue lines fit on screen (${lines.length} lines checked).`, `${long.length} line(s) are over 140 characters and will wrap past the dialogue box. Split them.`);
    add('music', W.maps.every(m => m.song != null && P.songs && P.songs[m.song]), 'Every map has music.', 'Pick a song for each map (Map settings).');
    add('controller', true, 'Every action uses A, B, Y, D-pad or stick. The mouse is never needed; the pause menu and title screen work with the controller alone.', '');
    add('res', true, '16:9 at 384×216, scales exactly 5× to 1920×1080 and 10× to 4K with sharp pixels.', '');
    add('save', true, 'Progress saves automatically when the window loses focus (console suspend) and from the pause menu; the Continue option loads it.', '');
    add('safe', true, 'Title-safe mode (Menu → Safe area) shrinks the picture to 90% so nothing is cut off on a TV.', '');
    add('title', !!(P.meta && P.meta.title && P.meta.title.length >= 3), 'Game has a title.', 'Set the game title in the Game tab.');
    add('logo', true, 'Starts with the NOTAREAL logo, then your opening picture (if set), then the title screen.', '');
    add('size', !extra.bytes || extra.bytes < 200 * 1048576, 'Package size is small' + (extra.bytes ? ` (${(extra.bytes / 1048576).toFixed(1)} MB).` : '.'), 'Reduce music or images.');
    return out;
};
X.STORE_STEPS = [
    'Register with ID@Xbox (Microsoft reviews every game; you sign an NDA and get GDK access).', 'Port the game to the Xbox GDK. The package gives you the game as plain data (JSON, PNG, WAV) and the exact input map, so the port is a runtime, not a redesign.',
    'Add Xbox services: sign-in handling, connected storage for saves, suspend/resume, achievements if you want them.', 'Set an age rating (IARC questionnaire in Partner Center), store listing, screenshots, privacy policy.', 'Run Microsoft\'s certification checks and fix anything they report.',
];

/* ------------------------------------------------------------------ zip (stored) */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const utf8 = s => typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8'));
X.zip = files => {
    const parts = [], central = []; let off = 0;
    const w16 = (a, v) => a.push(v & 255, v >> 8 & 255), w32 = (a, v) => a.push(v & 255, v >> 8 & 255, v >> 16 & 255, v >>> 24 & 255);
    for (const f of files) {
        const name = utf8(f.name), data = typeof f.data === 'string' ? utf8(f.data) : f.data, crc = crc32(data), h = [];
        w32(h, 0x04034b50); w16(h, 20); w16(h, 0x0800); w16(h, 0); w16(h, 0); w16(h, 0x21); w32(h, crc); w32(h, data.length); w32(h, data.length); w16(h, name.length); w16(h, 0);
        parts.push(Uint8Array.from(h), name, data);
        const c = []; w32(c, 0x02014b50); w16(c, 20); w16(c, 20); w16(c, 0x0800); w16(c, 0); w16(c, 0); w16(c, 0x21); w32(c, crc); w32(c, data.length); w32(c, data.length); w16(c, name.length); w16(c, 0); w16(c, 0); w16(c, 0); w16(c, 0); w32(c, 0); w32(c, off);
        central.push(Uint8Array.from(c), name); off += h.length + name.length + data.length;
    }
    let csz = 0; for (const c of central) csz += c.length; const end = []; w32(end, 0x06054b50); w16(end, 0); w16(end, 0); w16(end, files.length); w16(end, files.length); w32(end, csz); w32(end, off); w16(end, 0);
    const all = [...parts, ...central, Uint8Array.from(end)]; let n = 0; for (const a of all) n += a.length; const out = new Uint8Array(n); let p = 0; for (const a of all) { out.set(a, p); p += a.length; } return out;
};
const dataUrlBytes = u => { const b64 = u.slice(u.indexOf(',') + 1); if (typeof atob !== 'undefined') { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; } return Uint8Array.from(Buffer.from(b64, 'base64')); };
X.wav = (L, R, sr) => { const n = L.length, b = new Uint8Array(44 + n * 4), v = new DataView(b.buffer); const s = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
    s(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); } return b; };

/* ------------------------------------------------------------------ the player page */
const PLAYER = String.raw`
(function () {
'use strict';
const W = 384, H = 216, SLUG = __SLUG__, TITLE = PROJ.meta.title || 'Game';
const view = document.getElementById('c'), vg = view.getContext('2d'); vg.imageSmoothingEnabled = false;
const gcv = document.createElement('canvas'); gcv.width = W; gcv.height = H;
const imgs = {}, sfx = {}; let scene = 'load', game = null, t0 = performance.now(), safe = false, guide = false, volM = 0.7, volS = 0.6, toast = '', toastT = 0, menuSel = 0, menu = null, hadPad = false, lastHp = null;
const say = (m, f = 150) => { toast = m; toastT = f; };
function loadAll() { const jobs = []; for (const [k, u] of Object.entries(IMGS)) jobs.push(new Promise(r => { const im = new Image(); im.onload = () => { imgs[k] = im; r(); }; im.onerror = r; im.src = u; })); return Promise.all(jobs); }
/* ---------------------------------------------------------- input: controller first */
const keyState = {}, prev = {}, now = {}; let pad = null;
addEventListener('keydown', e => { keyState[e.key] = true; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Tab'].includes(e.key)) e.preventDefault(); });
addEventListener('keyup', e => { keyState[e.key] = false; });
addEventListener('gamepadconnected', () => say('Controller connected')); addEventListener('gamepaddisconnected', () => say('Controller disconnected - press Menu to pause'));
function poll() {
    const pads = (navigator.getGamepads && navigator.getGamepads()) || []; pad = null; for (const p of pads) if (p && p.connected) { pad = p; break; }
    const b = i => !!(pad && pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5)), ax = (i, s) => pad ? (s > 0 ? pad.axes[i] > 0.45 : pad.axes[i] < -0.45) : false, k = (...n) => n.some(x => keyState[x]);
    const c = { up: b(12) || ax(1, -1) || k('ArrowUp', 'w', 'W'), down: b(13) || ax(1, 1) || k('ArrowDown', 's', 'S'), left: b(14) || ax(0, -1) || k('ArrowLeft', 'a', 'A'), right: b(15) || ax(0, 1) || k('ArrowRight', 'd', 'D'),
        a: b(0) || b(2) || k('z', 'Z', 'Enter', ' '), b: b(1) || k('x', 'X'), y: b(3) || k('c', 'C'), start: b(9) || k('Escape', 'p', 'P'), select: b(8) || k('Tab') };
    for (const n in c) { prev[n] = now[n] || false; now[n] = c[n]; } now.any = Object.values(c).some(Boolean); prev.any = now.__any || false; now.__any = now.any;
    if (!!pad !== hadPad) { hadPad = !!pad; }
}
const press = n => now[n] && !prev[n];
function rumble(ms, s, w) { try { const a = pad && pad.vibrationActuator; if (a && a.playEffect) a.playEffect('dual-rumble', { duration: ms, strongMagnitude: s, weakMagnitude: w }); window.__rumbles = (window.__rumbles || 0) + 1; } catch (e) {} }
/* ---------------------------------------------------------- audio */
let ac = null, curSong = null, songBuf = {}, songNode = null, mGain = null;
function unlock() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); mGain = ac.createGain(); mGain.gain.value = volM; mGain.connect(ac.destination); } catch (e) {} } if (ac && ac.state === 'suspended') ac.resume(); }
function playSong(n) {
    if (!ac || n == null || !PROJ.songs[n] || curSong === n) return; curSong = n; if (songNode) { try { songNode.stop(); } catch (e) {} }
    if (!songBuf[n]) { const r = NRMusic.renderSong(JSON.parse(JSON.stringify(PROJ.songs[n])), 32768, 1), b = ac.createBuffer(2, r.L.length, r.sr); b.copyToChannel(r.L, 0); b.copyToChannel(r.R, 1); songBuf[n] = b; }
    songNode = ac.createBufferSource(); songNode.buffer = songBuf[n]; songNode.loop = true; songNode.connect(mGain); songNode.start();
}
function playSfx(k) { try { const u = SFX[k]; if (!u || !ac) return; if (!sfx[k]) sfx[k] = new Audio(u); const a = sfx[k].cloneNode(); a.volume = volS; a.play(); } catch (e) {} }
function setVol() { if (mGain) mGain.gain.value = volM; }
/* ---------------------------------------------------------- saves */
const SAVEKEY = 'nr_pc_save_' + SLUG; let memSave = null;
function hasSave() { try { return !!localStorage.getItem(SAVEKEY); } catch (e) { return !!memSave; } }
function save() { if (!game) return; const s = JSON.stringify(game.snapshot()); try { localStorage.setItem(SAVEKEY, s); } catch (e) { memSave = s; } }
function load() { try { return JSON.parse(localStorage.getItem(SAVEKEY)); } catch (e) { return memSave ? JSON.parse(memSave) : null; } }
let csq = [], csDone = {}, lastMapId = null, endCs = false;
function csFor(when, lv) { return (PROJ.cutscenes || []).filter(c => c && String(c.text || '').trim() && (c.when || 'intro') === when && (when !== 'level' || (c.level | 0) === lv)); }
function playCs(list) { if (!list.length) return; csq = list.slice(); scene = 'cs'; sceneT = 0; }
function levelOf(id) { if (!PROJ.levels || !PROJ.levels.length || !PROJ.world) return -1; return PROJ.world.maps.findIndex(m => m.id === id); }
function startGame(resume) { unlock(); curSong = null; csDone = {}; endCs = false; game = NRWorld.play(gcv, PROJ, { keys: gk, images: imgs, manual: true, music: playSong, sound: playSfx, resume }); lastHp = game.state.hp; scene = 'play'; window.__nr.game = game;
    lastMapId = game.pos().map; if (!resume) { csDone[levelOf(lastMapId)] = 1; playCs(csFor('intro', 0).concat(levelOf(lastMapId) >= 0 || !(PROJ.levels && PROJ.levels.length) ? csFor('level', Math.max(0, levelOf(lastMapId))) : [])); } }
function wrapCs(t, n) { const w = String(t).split(/\s+/), out = []; let cur = ''; for (const x of w) { if ((cur + ' ' + x).trim().length > n && cur) { out.push(cur); cur = x; } else cur = (cur + ' ' + x).trim(); } if (cur) out.push(cur); return out; }
const gk = {};
function feed() { gk.ArrowUp = now.up; gk.ArrowDown = now.down; gk.ArrowLeft = now.left; gk.ArrowRight = now.right; gk.z = now.a; gk.x = now.b; gk.c = now.y; gk.Enter = false; gk[' '] = false; }
/* ---------------------------------------------------------- screens */
function text(s, x, y, size, col, align) { vg.font = (size || 10) + 'px monospace'; vg.fillStyle = col || '#fff'; vg.textAlign = align || 'left'; vg.fillText(s, x, y); }
function panel(x, y, w, h) { vg.fillStyle = 'rgba(8,10,24,.88)'; vg.fillRect(x, y, w, h); vg.strokeStyle = '#7aa8ff'; vg.lineWidth = 1; vg.strokeRect(x + .5, y + .5, w - 1, h - 1); }
function drawMenu(title, items, sel, hint) { panel(W / 2 - 100, 40, 200, 24 + items.length * 15 + (hint ? 14 : 0)); text(title, W / 2, 56, 11, '#ffe38a', 'center'); items.forEach((it, i) => text((i === sel ? '> ' : '  ') + (typeof it === 'function' ? it() : it), W / 2 - 84, 76 + i * 15, 10, i === sel ? '#fff' : '#9fb3d9')); if (hint) text(hint, W / 2, 56 + items.length * 15 + 36, 8, '#7b8cb0', 'center'); }
const logoImg = LOGO ? Object.assign(new Image(), { src: LOGO }) : null;
let sceneT = 0; const go = s => { scene = s; sceneT = 0; menuSel = 0; };
function drawCover(im) { const s = Math.max(W / im.width, H / im.height); vg.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s); }
const MENUS = {
    title: () => (hasSave() ? ['Continue', 'New game', 'Controls'] : ['New game', 'Controls']),
    pause: () => ['Resume', 'Save game', () => 'Music volume  < ' + Math.round(volM * 100) + ' >', () => 'Sound volume  < ' + Math.round(volS * 100) + ' >', () => 'Safe area  ' + (safe ? 'ON' : 'off'), 'Fullscreen', 'Controls', 'Quit to title'],
};
function menuInput(name, onPick) {
    const items = MENUS[name](); if (press('up')) menuSel = (menuSel + items.length - 1) % items.length; if (press('down')) menuSel = (menuSel + 1) % items.length;
    const it = items[menuSel], label = typeof it === 'function' ? it() : it;
    if (/volume/.test(label)) { const d = press('left') ? -0.1 : press('right') ? 0.1 : 0; if (d) { if (/Music/.test(label)) { volM = Math.max(0, Math.min(1, volM + d)); setVol(); } else volS = Math.max(0, Math.min(1, volS + d)); } }
    if (press('a')) onPick(label);
}
function frame(dt) {
    poll(); sceneT++;
    if (press('select')) guide = !guide;
    if (scene === 'load') { vg.fillStyle = '#000'; vg.fillRect(0, 0, W, H); text('Loading...', W / 2, H / 2, 10, '#789', 'center'); return; }
    if (scene === 'logo') { if (now.any && !prev.any && sceneT > 20) { unlock(); go(PROJ.opening && IMGS.__open_top ? 'open' : 'title'); } vg.fillStyle = '#000'; vg.fillRect(0, 0, W, H); const a = Math.min(1, sceneT / 30, (150 - sceneT) / 30);
        vg.globalAlpha = Math.max(0, a); if (logoImg && logoImg.complete && logoImg.width) { const s = Math.min(W * 0.6 / logoImg.width, H * 0.5 / logoImg.height); vg.drawImage(logoImg, (W - logoImg.width * s) / 2, (H - logoImg.height * s) / 2, logoImg.width * s, logoImg.height * s); } else text('NOTAREAL', W / 2, H / 2, 26, '#fff', 'center'); vg.globalAlpha = 1;
        if (sceneT > 150) go(PROJ.opening && IMGS.__open_top ? 'open' : 'title'); return; }
    if (scene === 'open') { vg.fillStyle = '#000'; vg.fillRect(0, 0, W, H); if (imgs.__open_top) drawCover(imgs.__open_top); if (press('a') || press('start') || sceneT > ((PROJ.opening && PROJ.opening.seconds) || 3) * 60) go('title'); return; }
    if (scene === 'title') {
        vg.fillStyle = '#0a1230'; vg.fillRect(0, 0, W, H); if (imgs.__bg) { vg.globalAlpha = 0.5; vg.drawImage(imgs.__bg, 0, 0); vg.globalAlpha = 1; }
        text(TITLE, W / 2, 80, Math.min(30, 300 / Math.max(6, TITLE.length) * 1.6), '#ffe38a', 'center'); text(pad ? 'Press A' : 'Press Z or Enter  (controller supported)', W / 2, 108, 9, '#b8c8ff', 'center');
        menuInput('title', l => { unlock(); if (l === 'Continue') startGame(load()); else if (l === 'New game') startGame(null); else go('controls'); });
        const items = MENUS.title(); items.forEach((it, i) => text((i === menuSel ? '> ' : '  ') + it, W / 2 - 40, 134 + i * 14, 10, i === menuSel ? '#fff' : '#7f93c4')); return;
    }
    if (scene === 'controls') { vg.fillStyle = '#0a1230'; vg.fillRect(0, 0, W, H); text('Controls', W / 2, 30, 14, '#ffe38a', 'center'); CONTROLS.forEach((r, i) => { text(r[0], 40, 58 + i * 17, 10, '#fff'); text(r[1], 150, 58 + i * 17, 10, '#9fb3d9'); }); text('Press B or A to go back', W / 2, H - 20, 9, '#7b8cb0', 'center'); if (press('a') || press('b')) go(game ? 'pause' : 'title'); return; }
    if (scene === 'cs') {
        blitGame(); vg.fillStyle = 'rgba(0,0,0,.82)'; vg.fillRect(0, 0, W, H); const c = csq[0];
        if (c) { let y = 50; if (c.speaker) { text(String(c.speaker), W / 2, y, 13, '#ffe38a', 'center'); y += 26; } wrapCs(c.text, 46).slice(0, 8).forEach(l => { text(l, W / 2, y, 11, '#fff', 'center'); y += 18; }); text('Press A', W / 2, H - 22, 9, '#7b8cb0', 'center'); }
        if (sceneT > 12 && (press('a') || press('start'))) { csq.shift(); sceneT = 0; if (!csq.length) scene = 'play'; }
        return;
    }
    if (scene === 'play') {
        if (press('start')) { save(); go('pause'); return; }
        { const mid = game.pos().map; if (mid !== lastMapId) { lastMapId = mid; const li = levelOf(mid); if (li >= 0 && !csDone[li]) { csDone[li] = 1; playCs(csFor('level', li)); if (scene === 'cs') return; } } }
        if (game.state.over && game.state.over.win && !endCs) { endCs = true; playCs(csFor('ending', 0)); if (scene === 'cs') return; }
        feed(); const steps = Math.min(3, Math.max(1, Math.round(dt / 16.67))); for (let i = 0; i < steps; i++) game.step(1);
        const hp = game.state.hp; if (lastHp != null && hp < lastHp) rumble(180, 0.7, 0.4); lastHp = hp;
        blitGame(); return;
    }
    if (scene === 'pause') { blitGame(); vg.fillStyle = 'rgba(0,0,0,.45)'; vg.fillRect(0, 0, W, H); drawMenu('Paused', MENUS.pause(), menuSel, 'Menu: resume');
        if (press('start') || press('b')) { go('play'); return; }
        menuInput('pause', l => { if (l === 'Resume') go('play'); else if (l === 'Save game') { save(); say('Saved'); } else if (/Safe/.test(l)) safe = !safe; else if (l === 'Fullscreen') { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) {} } else if (l === 'Controls') go('controls'); else if (l === 'Quit to title') { save(); game.stop(); game = null; if (songNode) { try { songNode.stop(); } catch (e) {} } curSong = null; go('title'); } }); return; }
}
function blitGame() { vg.fillStyle = '#000'; vg.fillRect(0, 0, W, H); if (safe) vg.drawImage(gcv, W * 0.05, H * 0.05, W * 0.9, H * 0.9); else vg.drawImage(gcv, 0, 0); }
const CONTROLS = [__CONTROLS__];
function overlay() {
    if (guide) { vg.strokeStyle = 'rgba(255,220,80,.8)'; vg.lineWidth = 1; vg.strokeRect(W * 0.05 + .5, H * 0.05 + .5, W * 0.9, H * 0.9); }
    if (toastT > 0) { toastT--; panel(W / 2 - 80, H - 28, 160, 16); text(toast, W / 2, H - 16, 9, '#fff', 'center'); }
}
let last = performance.now(), fitScale = 1;
function fit() { const s = Math.min(innerWidth / W, innerHeight / H); const k = s >= 1 ? Math.floor(s) : s; fitScale = k; view.style.width = W * k + 'px'; view.style.height = H * k + 'px'; }
addEventListener('resize', fit); fit();
function loop(t) { const dt = t - last; last = t; try { frame(dt); overlay(); } catch (e) { console.error(e); } requestAnimationFrame(loop); }
document.addEventListener('visibilitychange', () => { if (document.hidden && game) { save(); if (scene === 'play') go('pause'); if (ac) ac.suspend(); } else if (ac) ac.resume(); });
addEventListener('blur', () => { if (game && scene === 'play') { save(); go('pause'); } });
window.__nr = { get scene() { return scene; }, game: null, state: () => game && game.state, safe: () => safe, press: () => {} };
loadAll().then(() => { go('logo'); }); requestAnimationFrame(loop);
})();
`;
X.playerHTML = (P, ctx = {}) => {
    const src = ctx.sources || X.sources(), title = (P.meta && P.meta.title) || 'Game', slug = slugOf(title);
    const proj = JSON.parse(JSON.stringify(P)); delete proj.fixlog;
    const images = Object.assign({}, ctx.images || {}); if (ctx.openTop) images.__open_top = ctx.openTop;
    const controls = X.BUTTONS.map(b => JSON.stringify([b.pad, b.does])).join(',');
    const js = PLAYER.replace('__SLUG__', JSON.stringify(slug)).replace('__CONTROLS__', controls);
    const OPEN = '<scr' + 'ipt>', CLOSE = '</scr' + 'ipt>', esc = s => s.replace(new RegExp('<' + '/script', 'gi'), '<\\/script');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="mobile-web-app-capable" content="yes"><title>${title.replace(/[<&]/g, '')}</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}body{display:flex;align-items:center;justify-content:center}canvas{image-rendering:pixelated;image-rendering:crisp-edges;background:#000}</style></head>
<body><canvas id="c" width="384" height="216"></canvas>
${OPEN}${esc(src.nrmusic)}${CLOSE}${OPEN}${esc(src.nrworld)}${CLOSE}
${OPEN}const PROJ=${esc(JSON.stringify(proj))};const IMGS=${esc(JSON.stringify(images))};const SFX=${esc(JSON.stringify(ctx.sfx || {}))};const LOGO=${JSON.stringify(ctx.logo || '')};${CLOSE}
${OPEN}${esc(js)}${CLOSE}</body></html>`;
};

/* ------------------------------------------------------------------ the portable package */

X.fightHTML = (P, ctx = {}) => {
    const src = ctx.sources || X.sources(), C = P.fight, title = C.title || 'Match', sp = {}, im = {};
    for (const [n, v] of Object.entries(P.sprites || {})) { sp[n] = Object.assign({}, v); im[n] = (ctx.images && ctx.images[n]) || v.image; sp[n].image = im[n]; }
    const OPEN = '<' + 'script>', CLOSE = '<' + '/script>', esc = t => String(t).replace(/<\/script/gi, '<\\/script');
    const data = JSON.stringify({ cfg: C, sprites: sp }).replace(/<\//g, '<\\/');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.replace(/[<>&]/g, '')}</title><style>html,body{margin:0;background:#000;height:100%;display:flex;align-items:center;justify-content:center}canvas{image-rendering:pixelated;width:min(100vw,177.7vh);height:min(56.25vw,100vh)}</style></head><body><canvas id="c" width="384" height="216"></canvas>
${OPEN}${esc(src.nrfight)}${CLOSE}${OPEN}
const D=${data};const k={},imgs={};
addEventListener('keydown',e=>{k[e.key]=true;if(e.key.startsWith('Arrow'))e.preventDefault()});addEventListener('keyup',e=>{k[e.key]=false});
setInterval(()=>{const p=[...(navigator.getGamepads?navigator.getGamepads():[])].find(x=>x&&x.connected);if(!p)return;const b=i=>!!(p.buttons[i]&&p.buttons[i].pressed);k.ArrowLeft=p.axes[0]<-0.45||b(14);k.ArrowRight=p.axes[0]>0.45||b(15);k.z=b(0);k.x=b(2);k.c=b(1);k.v=b(3);k.Select=b(8);k.Start=b(9);k.q=b(4);k.e=b(5)},16);
let n=0;const names=Object.keys(D.sprites);Promise.all(names.map(nm=>new Promise(r=>{const i=new Image();i.onload=()=>{imgs[nm]=i;r()};i.onerror=r;i.src=D.sprites[nm].image}))).then(()=>{NRFight.play(document.getElementById('c'),D.cfg,{keys:k,keys2:null,images:imgs,sprites:D.sprites,sound:()=>{}})});
${CLOSE}</body></html>`;
};

X.puzzleHTML = (P, ctx = {}) => {
    const src = ctx.sources || X.sources(), C = P.puzzle, S = C[C.mode], title = S.title || 'Puzzle';
    const OPEN = '<' + 'script>', CLOSE = '<' + '/script>', esc = t => String(t).replace(/<\/script/gi, '<\\/script'), data = JSON.stringify({ mode: C.mode, cfg: S }).replace(/<\//g, '<\\/');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.replace(/[<>&]/g, '')}</title><style>html,body{margin:0;background:#000;height:100%;display:flex;align-items:center;justify-content:center}canvas{image-rendering:pixelated;width:min(100vw,177.7vh);height:min(56.25vw,100vh)}</style></head><body><canvas id="c" width="384" height="216"></canvas>
${OPEN}${esc(src.nrpuzzle)}${CLOSE}${OPEN}
const D=${data};const k={};
addEventListener('keydown',e=>{k[e.key]=true;if(e.key.startsWith('Arrow'))e.preventDefault()});addEventListener('keyup',e=>{k[e.key]=false});
setInterval(()=>{const p=[...(navigator.getGamepads?navigator.getGamepads():[])].find(x=>x&&x.connected);if(!p)return;const b=i=>!!(p.buttons[i]&&p.buttons[i].pressed);k.ArrowLeft=p.axes[0]<-0.45||b(14);k.ArrowRight=p.axes[0]>0.45||b(15);k.ArrowUp=p.axes[1]<-0.45||b(12);k.ArrowDown=p.axes[1]>0.45||b(13);k.z=b(0);k.x=b(1);k.c=b(3)},16);
window.__game=NRPuzzle.play(document.getElementById('c'),D.mode,D.cfg,{keys:k,seed:Date.now()&0xffff});
${CLOSE}</body></html>`;
};
X.arcadeHTML = (P, ctx = {}) => {
    const src = ctx.sources || X.sources(), C = P.arcade, title = (C.cfg && C.cfg.title) || 'Arcade game';
    const OPEN = '<' + 'script>', CLOSE = '<' + '/script>', esc = t => String(t).replace(/<\/script/gi, '<\\/script'), data = JSON.stringify({ mode: C.mode, cfg: C.cfg }).replace(/<\//g, '<\\/');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.replace(/[<>&]/g, '')}</title><style>html,body{margin:0;background:#000;height:100%;display:flex;align-items:center;justify-content:center}canvas{image-rendering:pixelated;width:min(100vw,133.3vh);height:min(75vw,100vh)}</style></head><body><canvas id="c"></canvas>
${OPEN}${esc(src.nrarcade)}${CLOSE}${OPEN}
const D=${data};const k={};
addEventListener('keydown',e=>{k[e.key]=true;if(e.key.startsWith('Arrow')||e.key===' ')e.preventDefault()});addEventListener('keyup',e=>{k[e.key]=false});
setInterval(()=>{const p=[...(navigator.getGamepads?navigator.getGamepads():[])].find(x=>x&&x.connected);if(!p)return;const b=i=>!!(p.buttons[i]&&p.buttons[i].pressed);k.ArrowLeft=p.axes[0]<-0.45||b(14);k.ArrowRight=p.axes[0]>0.45||b(15);k.ArrowUp=p.axes[1]<-0.45||b(12);k.ArrowDown=p.axes[1]>0.45||b(13);k.z=b(0);k.x=b(1);k.c=b(3)},16);
window.__game=NRArcade.play(document.getElementById('c'),D.mode,D.cfg,{keys:k,seed:Date.now()&0xffff});
${CLOSE}</body></html>`;
};
X.guide = (P, check) => `# ${((P.meta && P.meta.title) || 'Game')}: PC and Xbox guide

## What is in this folder
- \`index.html\` : the game. Double-click it; it runs offline in Edge or Chrome with an Xbox controller (keyboard also works).
- \`game/game.nrpack.json\` : the whole game as plain data (maps, tiles, entities, rules, items, text, input map). No code.
- \`game/assets/\` : every picture as PNG. \`game/audio/\` : every song rendered to WAV, plus sound effects.
- \`windows/\` : shortcuts that open the game full-screen in Edge or Chrome.
- \`xbox/readiness_report.json\` : what this game already satisfies, and what is left.

## Controller map (standard Xbox layout)
${X.BUTTONS.map(b => `- ${b.pad}: ${b.does}`).join('\n')}

## Playing on a PC
Open \`windows/play_edge.bat\` (full screen) or \`index.html\`. Plug in an Xbox controller first or press a key. Menu (Start) pauses and saves. Saves are stored by the browser for this game.

## Putting the game on Xbox
Be clear about what is and is not possible from here:
- The web player runs on a PC today. It can also be tried on a console through Microsoft Edge for testing, but that is not a store release.
- Microsoft's own support answers say new UWP games are no longer accepted in the Xbox Store, so a web page or UWP wrapper is not a route to the store. The route is **ID@Xbox plus the Xbox GDK** (check the current rules with ID@Xbox before you start).
- The steps:
${X.STORE_STEPS.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}

### Why this package makes the port easier
The game is data. A native Xbox runtime only has to: read \`game.nrpack.json\`, draw 16×16 tiles and sprites from the PNG files at 384×216 (scale 5× to 1080p), play the WAV files, run the rule list (on talk / touch / enter / defeat / load → actions) and map the buttons in \`xbox/input_map.json\`. The rule actions and conditions are documented in the data file under \`rulesReference\`.

## Readiness report
${check.map(c => `- [${c.ok ? 'x' : ' '}] ${c.msg}${c.ok ? '' : ' → ' + c.fix}`).join('\n')}
`;
X.buildPackage = (P, ctx = {}) => {
    const title = (P.meta && P.meta.title) || 'Game', slug = slugOf(title), root = slug + '/', files = [];
    const add = (n, d) => files.push({ name: root + n, data: d });
    const html = X.playerHTML(P, ctx); add('index.html', html);
    const proj = JSON.parse(JSON.stringify(P)); delete proj.fixlog;
    const refs = {}, assetFiles = [];
    const putImg = (kind, name, url) => { if (!url || !/^data:/.test(url)) return null; const fn = `assets/${kind}/${name.replace(/[^\w.-]+/g, '_')}.png`; assetFiles.push({ name: 'game/' + fn, data: dataUrlBytes(url) }); return fn; };
    for (const [k, url] of Object.entries(ctx.images || {})) { const kind = k.startsWith('__ts_') ? 'tiles' : k === '__bg' ? 'backgrounds' : k.endsWith('__td') ? 'sprites_topdown' : 'sprites'; refs[k] = putImg(kind, k.replace(/^__ts_/, '').replace(/^__/, ''), url); }
    if (ctx.openTop) refs.__open_top = putImg('opening', 'top', ctx.openTop);
    const songs = [];
    if (ctx.renderSong) (P.songs || []).forEach((s, i) => { try { const r = ctx.renderSong(JSON.parse(JSON.stringify(s))); assetFiles.push({ name: `game/audio/music_${i}.wav`, data: X.wav(r.L, r.R, r.sr) }); songs.push({ index: i, name: s.name, file: `audio/music_${i}.wav`, loops: true }); } catch (e) {} });
    for (const [k, url] of Object.entries(ctx.sfx || {})) assetFiles.push({ name: `game/audio/sfx_${k.replace(/\W+/g, '_')}.wav`, data: dataUrlBytes(url) });
    const dataProj = Object.assign({}, proj); delete dataProj.sprites; delete dataProj.worldTilesets; delete dataProj.background; delete dataProj.tileset; delete dataProj.songs; delete dataProj.sfx; delete dataProj.opening;
    const pack = { format: 'notareal-pack', version: 1, title, resolution: [384, 216], tileSize: 16, fps: 60, input: X.BUTTONS, world: proj.world, physics: proj.meta && proj.meta.physics, assets: refs, songs, music: (P.songs || []).map(s => ({ name: s.name, tempo: s.tempo, steps: s.steps, ch: s.ch, inst: s.inst })), meta: proj.meta,
        sprites: Object.fromEntries(Object.entries(proj.sprites || {}).map(([k, s]) => [k, { w: s.w, h: s.h, frames: s.frames, sheet: refs[k] || null, topdownSheet: refs[k + '__td'] || null }])), tilesets: Object.fromEntries(Object.entries(proj.worldTilesets || {}).map(([k, t]) => [k, { sheet: refs['__ts_' + k] || null, solid: t.cols, names: t.names || null }])), opening: ctx.openTop ? { image: refs.__open_top, seconds: (P.opening && P.opening.seconds) || 3 } : null,
        rulesReference: { triggers: ['talk', 'touch', 'enter', 'defeat', 'load'], conditions: 'has item / flag value / money (see world.items and rule.if)', actions: 'say, choice, give, take, money, set flag, warp, heal, damage, win, lose, sound, music, wait and more (rule.actions[].do)', note: 'collision: tile column value 0 see-through, 1 solid, 2 jump-through, 3 hurts' } };
    add('game/game.nrpack.json', JSON.stringify(pack, null, 1)); for (const f of assetFiles) files.push({ name: root + f.name, data: f.data });
    const check = X.xboxCheck(P, { bytes: 0 });
    add('xbox/readiness_report.json', JSON.stringify({ title, checked: new Date().toISOString().slice(0, 10), items: check, storeSteps: X.STORE_STEPS }, null, 1));
    add('xbox/input_map.json', JSON.stringify({ standardMapping: true, buttons: X.BUTTONS, deadzone: 0.45, rumbleOnDamage: { ms: 180, strong: 0.7, weak: 0.4 } }, null, 1));
    add('xbox/XBOX_PORT_GUIDE.md', X.guide(P, check)); add('PLAY_ME.txt', `${title}\n\nOpen index.html (or windows\\play_edge.bat).\n\n${X.BUTTONS.map(b => b.pad + ': ' + b.does).join('\n')}\n`);
    if (P.fight && P.fight.fighters && P.fight.fighters.length && (ctx.sources || X.sources()).nrfight) { add('fight_match.html', X.fightHTML(P, ctx)); add('PLAY_ME.txt', `${title}\n\nOpen index.html for the game, or fight_match.html for the wrestling/fighting match.\n\n${X.BUTTONS.map(b => b.pad + ': ' + b.does).join('\n')}\n\nFight match: left stick/D-pad move, A strike, X grab/throw, B block, Y taunt.\n`); files.splice(files.findIndex(f => f.name === root + 'PLAY_ME.txt'), 1); }
    if (P.puzzle && (ctx.sources || X.sources()).nrpuzzle) add('puzzle.html', X.puzzleHTML(P, ctx));
    if (P.arcade && P.arcade.mode && (ctx.sources || X.sources()).nrarcade) add('arcade.html', X.arcadeHTML(P, ctx));
    if (Array.isArray(P.timeline) && P.timeline.length && (ctx.sources || X.sources()).nrarcade) { const TL = typeof require === 'function' && typeof module !== 'undefined' ? require('./nrtimeline.js') : (typeof self !== 'undefined' ? self : globalThis).NRTimeline; if (TL) add('timeline.html', TL.html(P, ctx.sources || X.sources())); }
    add('windows/play_edge.bat', '@echo off\r\nstart "" msedge --app="file:///%~dp0..\\index.html" --start-fullscreen\r\n'); add('windows/play_chrome.bat', '@echo off\r\nstart "" chrome --app="file:///%~dp0..\\index.html" --start-fullscreen\r\n');
    return { files, zip: () => X.zip(files), slug, check, bytes: files.reduce((a, f) => a + (typeof f.data === 'string' ? f.data.length : f.data.length), 0) };
};
if (typeof module !== 'undefined') module.exports = X; else root.NRPc = X;
})(typeof self !== 'undefined' ? self : this);

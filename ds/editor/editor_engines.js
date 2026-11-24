/* ------------------------------------------------------------------ Engines: every game engine ROM the program carries, how to get at it, and how to update it without a new program.
 * The program embeds each engine as a gzipped ROM in ROMS. An "override" (a newer engine ROM, or an engine added later for a future game) is kept on disk in the desktop program
 * (Notareal_Data/engines) or in the browser's IndexedDB, and gunzipB64() hands the override out instead of the built-in whenever an exporter asks for that engine.
 * Engine packs (.nrengines) move several engines at once; a program update (.html) replaces the whole studio page the desktop program shows. */
const ENGINE_INFO = {
    ds_side2d: ['2D platformer / runner engine', 'ds', 'META BPAL SPAL MTIL MCOL BGIM SPRS LVLS SONG SFXC', 'Side-scrolling games, kids games, collectathons'],
    snes_basket: ['Street basketball engine', 'snes', 'NRGBSKT1 block', '2-on-2 street basketball on the SNES'],
    snes_kart: ['Mode 7 kart racer', 'snes', 'NRGKART1 block', 'Mario-Kart-style Mode 7 racer on the SNES'],
    snes_side2d: ['2D platformer engine', 'snes', 'NRGSNES1 block', 'Side-scrolling games on the SNES'],
    ds_puzzle: ['Puzzle engine (match-3, falling blocks, bracelets)', 'ds', 'puzzle block', 'Puzzle and mini-game types'],
    ds_fight: ['Simple 2D fighter engine', 'ds', 'fight block', 'Fighting'],
    ds_wrestling: ['3D wrestling engine (ICW match engine)', 'ds', 'WRCF roster block', 'Wrestling'],
    ds_arcade: ['Arcade engine (shmup, breakout, brawler, memory, hoops ...)', 'ds', 'arcade block', 'Arcade game types'],
    ds_skate3d: ['Skate 3D engine', 'ds', 'skate block', 'Trick-sports / skating games (with audio)'],
    ds_sigil: ['Memphis Sigil music workstation', 'ds', 'SGPJ', 'Drum machine, sequencer, song chain'],
    ds_godsim: ['Cosmos Keeper god sim (12 stages)', 'ds', 'GSDT', 'God sim / idle evolution'],
    ds_bracelet: ['Friendship Bracelets bead-shop sim', 'ds', 'BRDT', 'Crafting / shop sim with customers'],
    ds_world3d: ['3D worlds engine (sandbox / warfare / wasteland)', 'ds', 'W3DW', '3D platformer, open world, shooters, survival RPG'],
    n64_world3d: ['3D worlds + store engine (software renderer)', 'n64', 'W3DW', 'Same worlds as the DS plus the convenience-store job sim'],
    psx_world3d: ['3D worlds + store engine (software renderer)', 'psx', 'W3DW', 'Same worlds as the DS plus the convenience-store job sim']
};
const ENGINE_MARKERS = ['NRGDATA1', 'NRGSNES1', 'NRMNDATA'], ENGINE_EXT = { ds: 'nds', snes: 'sfc', gb: 'gb', gbc: 'gbc', nes: 'nes', gba: 'gba', n64: 'z64', psx: 'exe' };
const NREngines = (() => {
    const E = {}, OV = {}, META = {}, origGunzip = gunzipB64, KEYOF = new Map(Object.entries(ROMS).map(([k, v]) => [v, k])); let UPD = { installed: false }, ready = null;
    const desk = () => !!window.NR_DESKTOP, hasMagic = (b, m) => { const c = [...m].map(x => x.charCodeAt(0)); outer: for (let i = 0; i < b.length - 8; i++) { for (let j = 0; j < 8; j++) if (b[i + j] !== c[j]) continue outer; return true; } return false; };
    const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }, unb64 = t => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
    const gz = async u8 => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    const idb = () => new Promise((res, rej) => { const r = indexedDB.open('notareal_engines', 1); r.onupgradeneeded = () => r.result.createObjectStore('e'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const idbDo = async (mode, fn) => { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('e', mode), rq = fn(tx.objectStore('e')); tx.oncomplete = () => res(rq && rq.result); tx.onerror = () => rej(tx.error); }); };
    async function load() {
        for (const k of Object.keys(OV)) delete OV[k]; for (const k of Object.keys(META)) delete META[k];
        if (desk()) { try { const j = await deskCall('/api/engines'); UPD = j.update || { installed: false }; for (const m of j.engines) { const r = await fetch('/api/engine?id=' + m.id, { headers: { 'X-Notareal': '1' } }); OV[m.id] = new Uint8Array(await r.arrayBuffer()); META[m.id] = m; } } catch (e) { /* no desktop engine yet */ } return; }
        try { const keys = await idbDo('readonly', s => s.getAllKeys()); for (const k of keys) { const v = await idbDo('readonly', s => s.get(k)); if (v && v.bytes) { OV[k] = v.bytes; META[k] = { id: k, name: v.name, size: v.bytes.length, date: v.date }; } } } catch (e) { /* storage unavailable */ }
    }
    E.refresh = () => (ready = load()); E.ready = () => ready;
    E.update = () => UPD;
    E.list = () => { const ids = [...new Set([...Object.keys(ROMS), ...Object.keys(OV)])]; return ids.map(id => { const inf = ENGINE_INFO[id] || (id.startsWith('mini_') ? ['Small-console engine (' + id.slice(5).replace('_', ' ') + ')', id.split('_').pop(), 'NRMNDATA', 'Game Boy / NES / GBA small-console games'] : [(META[id] && META[id].name) || id, '?', '', 'Added engine']); const m = META[id];
        return { id, name: (m && !ROMS[id] ? m.name : inf[0]), console: inf[1], section: inf[2], makes: inf[3], builtin: !!ROMS[id], override: !!OV[id], size: OV[id] ? OV[id].length : 0, date: m && m.date || '' }; }).sort((a, b) => a.console.localeCompare(b.console) || a.id.localeCompare(b.id)); };
    E.rom = async id => { await ready; if (OV[id]) return OV[id].slice(); if (!ROMS[id]) throw new Error('No engine called ' + id); return origGunzip(ROMS[id]); };
    E.builtin = async id => { if (!ROMS[id]) throw new Error('No built-in engine called ' + id); return origGunzip(ROMS[id]); };
    E.validate = async (id, bytes) => {
        if (bytes.length < 4096) throw new Error('That file is too small to be an engine ROM.');
        const base = ROMS[id] ? await origGunzip(ROMS[id]) : null, need = base ? ENGINE_MARKERS.filter(m => hasMagic(base, m)) : [];
        if (base) { for (const m of need) if (!hasMagic(bytes, m)) throw new Error('This ROM has no ' + m + ' data block, so the studio could not write a game into it. Pick an engine ROM built for the studio.'); }
        else if (!ENGINE_MARKERS.some(m => hasMagic(bytes, m))) throw new Error('This ROM has no data block the studio can write a game into (no NRGDATA1 / NRMNDATA / NRGSNES1 marker).');
        return true;
    };
    E.install = async (id, bytes, name) => {
        await E.validate(id, bytes);
        if (desk()) await deskCall('/api/engine', { id, name: name || id, b64: b64(bytes) }); else await idbDo('readwrite', s => s.put({ name: name || id, date: new Date().toISOString(), bytes }, id));
        await E.refresh();
    };
    E.remove = async id => { if (desk()) await deskCall('/api/engine/remove', { id }); else await idbDo('readwrite', s => s.delete(id)); await E.refresh(); };
    E.pack = async ids => { const out = []; for (const id of ids || E.list().map(e => e.id)) { const u8 = await E.rom(id); out.push({ id, name: (E.list().find(e => e.id === id) || {}).name || id, gz: b64(await gz(u8)) }); } return JSON.stringify({ format: 'notareal-engines', version: 1, build: typeof NR_BUILD === 'string' ? NR_BUILD : '', date: new Date().toISOString(), engines: out }); };
    E.importPack = async text => { const p = JSON.parse(text); if (p.format !== 'notareal-engines' || !Array.isArray(p.engines)) throw new Error('Not a Notareal engine pack.'); let n = 0; for (const e of p.engines) { if (!/^[a-z0-9_]{2,40}$/.test(e.id || '')) continue; const u8 = await origGunzip(e.gz); await E.install(e.id, u8, e.name); n++; } return n; };
    gunzipB64 = async s => { await ready; const k = KEYOF.get(s); if (k && OV[k]) return OV[k].slice(); return origGunzip(s); };
    ready = load(); return E;
})();
function enginesTab(main) {
    const box = el('div', { class: 'pane' }), U = NREngines.update(), fmt = n => n > 1 << 20 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB', refresh = () => NREngines.refresh().then(renderAll);
    box.append(el('h2', {}, '⚙ Engines & updates'), el('p', { class: 'hint' }, 'Every game this program makes is a ready-made engine ROM plus a block of game data written into it. This is the list of engines the program carries. Export one to use it on its own, replace one with a newer build, or add an engine made later for a future game; the exporters pick up the new one straight away.'));
    box.append(el('p', {}, 'Program build: ' + (typeof NR_BUILD === 'string' ? NR_BUILD : 'unknown')));
    const upd = el('div', { class: 'row wrap' });
    if (window.NR_DESKTOP) {
        upd.append(el('b', {}, U && U.installed ? 'Program update installed (' + String(U.date || '').slice(0, 10) + ', ' + fmt(U.size || 0) + ')' : 'Running the built-in program'),
            el('button', { class: 'go', onclick: async () => { const f = await pickFile('.html'); if (!f) return; try { const html = await f.text(); await deskCall('/api/update-app', { html, build: f.name }); notify('Update installed. Close the program and open it again to use the new version. Your projects, ROM library and engines are kept. If the new version ever misbehaves, use "Open built-in program" below.'); refresh(); } catch (e) { notify('Could not install the update: ' + e.message); } } }, 'Install program update (.html)…'));
        if (U && U.installed) upd.append(el('button', { class: 'alt', onclick: async () => { await deskCall('/api/update-app/remove', {}); notify('Update removed. Close and reopen the program to go back to the built-in version.'); refresh(); } }, 'Remove update'));
        upd.append(el('button', { class: 'alt', title: 'Opens the program that is built into this app, ignoring any installed update', onclick: () => { location.href = '/?safe=1'; } }, 'Open built-in program (safe mode)'));
    } else upd.append(el('span', { class: 'hint' }, 'This copy runs from one page: to update the program, replace the notareal_studio.html file. Engines can still be updated below.'));
    box.append(el('h3', {}, 'Program'), upd);
    box.append(el('h3', {}, 'Engines'));
    const tbl = el('table', { class: 'tbl', style: 'width:100%;border-collapse:collapse' }), th = (...c) => el('tr', {}, ...c.map(x => el('th', { style: 'text-align:left;padding:3px 6px;border-bottom:1px solid #444' }, x)));
    tbl.append(th('Engine', 'Console', 'Data', 'Source', 'Size', ''));
    for (const e of NREngines.list()) {
        const ext = ENGINE_EXT[e.console] || 'rom', act = el('td', { style: 'padding:3px 6px;white-space:nowrap' },
            el('button', { class: 'alt', onclick: async () => { try { await download(e.id + '.' + ext, await NREngines.rom(e.id), 'application/octet-stream'); } catch (x) { notify(x.message); } } }, 'Export ROM'),
            el('button', { class: 'alt', title: 'Use a newer build of this engine', onclick: async () => { const f = await pickFile('.' + ext + ',.rom,.bin,.z64,.exe,.nds'); if (!f) return; try { await NREngines.install(e.id, new Uint8Array(await f.arrayBuffer()), e.name); notify('Engine "' + e.id + '" replaced. Games you export from now on use it.'); refresh(); } catch (x) { notify(x.message); } } }, 'Replace…'));
        if (e.override) act.append(el('button', { class: 'alt', onclick: async () => { await NREngines.remove(e.id); notify(e.builtin ? 'Back to the built-in ' + e.id + ' engine.' : 'Engine "' + e.id + '" removed.'); refresh(); } }, e.builtin ? 'Use built-in' : 'Remove'));
        const src = e.override ? (e.builtin ? 'Updated ' : 'Added ') + e.date.slice(0, 10) : 'Built in';
        tbl.append(el('tr', {}, el('td', { style: 'padding:3px 6px' }, el('b', {}, e.name), el('div', { class: 'hint' }, e.id + ' - ' + e.makes)), el('td', { style: 'padding:3px 6px' }, e.console.toUpperCase()), el('td', { style: 'padding:3px 6px;font-size:11px' }, e.section), el('td', { style: 'padding:3px 6px' }, src), el('td', { style: 'padding:3px 6px' }, e.override ? fmt(e.size) : ''), act));
    }
    box.append(tbl);
    box.append(el('div', { class: 'row wrap', style: 'margin-top:10px' },
        el('button', { class: 'go', onclick: async () => { download('notareal_engines_' + new Date().toISOString().slice(0, 10) + '.nrengines', await NREngines.pack(), 'application/json'); } }, 'Export engine pack (all engines)'),
        el('button', { class: 'go', onclick: async () => { const f = await pickFile('.nrengines,.json'); if (!f) return; try { const n = await NREngines.importPack(await f.text()); notify(n + ' engine(s) installed from the pack.'); refresh(); } catch (x) { notify('Could not import: ' + x.message); } } }, 'Import engine pack…'),
        el('button', { class: 'alt', onclick: async () => { const f = await pickFile('.nds,.z64,.exe,.sfc,.gb,.gba,.nes,.rom'); if (!f) return; const id = (prompt('Short id for this engine (letters, numbers, underscore):', f.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)) || '').trim(); if (!/^[a-z0-9_]{2,40}$/.test(id)) return notify('Engine ids are 2-40 letters, numbers or underscores.'); try { await NREngines.install(id, new Uint8Array(await f.arrayBuffer()), f.name); notify('Engine "' + id + '" added.'); refresh(); } catch (x) { notify(x.message); } } }, 'Add an engine ROM…')));
    box.append(el('p', { class: 'hint' }, 'An engine ROM must carry the studio data block (the NRGDATA1 / NRMNDATA / NRGSNES1 marker the exporters search for). Engines are kept ' + (window.NR_DESKTOP ? 'in the Notareal_Data/engines folder next to the program.' : 'in this browser only.') + ' The studio cannot add an editor screen for a brand-new game type by itself: a new game type needs the engine (here) plus a program update (above).'));
    main.append(box);
}

/* Templates, Arcade games and "Make me a game" (v1.1). One starter for every game type; works offline, the AI is optional. */
const TPL = { family: 'All', ai: { kind: 'none', url: '', model: '' }, log: [], busy: false };
function tplBase() { return (P && P.sprites && P.tileset && P.songs && P.songs.length) ? P : EXAMPLE; }
function applyResult(r) {
    P = r.project; curLevel = 0; imgCache.clear();
    if (r.engine === 'world') { syncWorldTilesets(); P.world = (r.kind === 'survival' ? NRWorld.berea : NRWorld.starterTown)(P, (P.style || 'classic') + '_town'); castStarter(); if (r.player) Object.assign(P.world.player, r.player); }
    tab = r.tab; dirty = true; renderAll();
}
function useTemplate(id, o) {
    const go = () => applyResult(NRTemplates.apply(id, tplBase(), Object.assign({ theme: 'forest', levels: 3, seed: Date.now() % 100000 }, o || {})));
    if (P && dirty) { const m = modal('Start a new game?', el('p', {}, 'This replaces the game you are working on. Save it first if you want to keep it.'), [['Cancel', () => true, 'alt'], ['Start new game', () => { go(); return true; }, 'go']]); return m; }
    go();
}
function templatesTab(main) {
    const all = NRTemplates.all(), fams = ['All', ...new Set(all.map(t => t.family))], box = el('div', { class: 'pane' });
    box.append(el('h2', {}, '📦 Templates: a ready game for every kind of game'), el('p', { class: 'hint' }, `${all.length} starters. Pick one and you get a game that already plays; change anything after. "Plays on" shows what you can export it as today.`),
        el('div', { class: 'row wrap' }, ...fams.map(f => el('button', { class: 'mini ' + (TPL.family === f ? '' : 'alt'), onclick: () => { TPL.family = f; renderAll(); } }, f))));
    const grid = el('div', { class: 'cards' });
    for (const t of all.filter(t => TPL.family === 'All' || t.family === TPL.family)) grid.append(el('div', { class: 'card' }, el('b', {}, t.name), el('small', {}, t.family), el('p', {}, t.about), el('small', {}, 'Plays on: ' + t.runs.join(', ')), (MEASURED.genres[t.id] ? el('small', { style: 'color:#8cf' }, 'Measured from ' + MEASURED.genres[t.id].games + ' real game' + (MEASURED.genres[t.id].games > 1 ? 's' : '')) : ''), t.note ? el('small', { style: 'color:#ffd37a' }, t.note) : '', el('button', { class: 'go', onclick: () => useTemplate(t.id, { title: t.name }) }, 'Use this template')));
    box.append(grid); main.append(box);
}
/* ------------------------------------------------------------------ Arcade tab */
function arcadeTab(main) {
    const box = el('div', { class: 'pane' }); box.append(el('h2', {}, '🕹 Arcade games'), el('p', { class: 'hint' }, 'Nine ready game engines: shoot-em-up, breakout, racing, first-person shooter, beat-em-up, falling blocks, memory, town builder, hoops and a colouring book. Change the numbers and colours, press Play, then export a page that plays offline with an Xbox controller.'));
    if (!P.arcade) { box.append(el('div', { class: 'cards' }, ...Object.entries(NRArcade.MODES).map(([k, m]) => el('div', { class: 'card' }, el('b', {}, m.name), el('small', {}, m.controls), el('button', { class: 'go', onclick: () => { P.arcade = { mode: k, cfg: Object.assign({}, NRArcade.DEFAULTS[k]) }; dirty = true; renderAll(); } }, 'Start')))));
        main.append(box); return; }
    const A = P.arcade, def = NRArcade.DEFAULTS[A.mode], fields = el('div', { class: 'row wrap' });
    box.append(el('div', { class: 'row wrap' }, el('label', {}, 'Game ', el('select', { onchange: e => { const old = A.cfg; A.mode = e.target.value; A.cfg = Object.assign({}, NRArcade.DEFAULTS[A.mode], { title: old.title, color: old.color, color2: old.color2 }); dirty = true; renderAll(); } }, ...Object.entries(NRArcade.MODES).map(([k, m]) => el('option', Object.assign({ value: k }, A.mode === k ? { selected: '' } : {}), m.name)))), el('small', {}, NRArcade.MODES[A.mode].controls)));
    for (const [k, v] of Object.entries(def)) { const cur = A.cfg[k] == null ? v : A.cfg[k];
        fields.append(el('label', {}, k === 'color' ? 'Main colour ' : k === 'color2' ? 'Second colour ' : k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()) + ' ',
            k === 'sport' ? el('select', { onchange: e => { A.cfg.sport = e.target.value; dirty = true; renderAll(); } }, ...['skate', 'snow', 'bmx'].map(s => { const o = el('option', { value: s }, { skate: 'Skateboard', snow: 'Snowboard', bmx: 'BMX' }[s]); if ((A.cfg.sport || 'skate') === s) o.selected = true; return o; })) : typeof v === 'number' ? el('input', { type: 'number', value: cur, style: 'width:70px', onchange: e => { A.cfg[k] = +e.target.value; dirty = true; } }) : /^#/.test(v) ? el('input', { type: 'color', value: cur, onchange: e => { A.cfg[k] = e.target.value; dirty = true; } }) : el('input', { value: cur, onchange: e => { A.cfg[k] = e.target.value; dirty = true; } }))); }
    const songSel = (key, label, dflt) => el('label', {}, label + ' ', el('select', { onchange: e => { A.cfg[key] = +e.target.value; dirty = true; } }, ...[['0', '(none)'], ...(P.songs || []).slice(0, 8).map((s, i) => [String(i + 1), s.name || 'Song ' + (i + 1)])].map(([v, n]) => { const o = el('option', { value: v }, n); if (String(A.cfg[key] == null ? dflt : A.cfg[key]) === v) o.selected = true; return o; })));
    fields.append(songSel('song', 'Music while playing', 1), songSel('titleSong', 'Title music', 0));
    /* presets built from the ROM data (GTA III / Fallout 2 tables, Jabroni Hawk, measured physics) + the ROM titles this game type learns from */
    const prNames = NR3DPresets.list(A.mode);
    if (prNames.length) box.append(el('div', { class: 'gfxpanel' }, el('b', {}, '🎯 Presets from the ROM data'), el('div', { class: 'row wrap' }, ...prNames.map(n => el('button', { class: 'alt', title: 'Fills in the numbers below from the scanned game data', onclick: () => { A.cfg = NR3DPresets.apply(A.mode, n, A.cfg); dirty = true; renderAll(); } }, n.replace(/ \(.*$/, ''))))));
    const gt = (GENRES.types || []).find(g => g.id === P.genre), ms = ((MEASURED || {}).genres || {})[P.genre];
    if (gt) box.append(el('details', {}, el('summary', {}, '📚 ROM data behind this game type'), el('p', { class: 'hint' }, `${gt.name} learns from: ${(gt.learns_from || []).join(' · ') || '-'}.` + (ms ? ` Measured across ${ms.games} scanned games (${(ms.platforms || []).join(', ')}): median ${ms.medianMB} MB, ${ms.medianRoutines} routines, hardware use ${Object.entries(ms.hardwareShare || {}).map(([k, v]) => k + ' ' + v + '%').join(', ')}.` : '') + ' The Technique Library tab lists the numbers pulled from each ROM.')));
    box.append(fields, el('div', { class: 'row' }, el('button', { class: 'go', onclick: playArcade }, '▶ Play'), el('button', { class: 'go', onclick: exportArcade }, '⬇ Export PC game page (.html)'), el('button', { class: 'go', onclick: exportArcadeDS }, '⬇ Export Nintendo DS ROM (.nds)'), A.mode === 'basketball' ? el('button', { class: 'go', onclick: exportBasketSnes }, '⬇ Export SNES ROM (.sfc)') : '', A.mode === 'combat' ? el('button', { class: 'go', onclick: () => exportArcadeSoft('n64') }, '⬇ Export Nintendo 64 ROM (.z64)') : '', A.mode === 'combat' ? el('button', { class: 'go', onclick: () => exportArcadeSoft('psx') }, '⬇ Export PlayStation (.exe)') : '', el('button', { class: 'alt', onclick: () => { P.arcade = null; dirty = true; renderAll(); } }, 'Pick another game')),
        el('p', { class: 'hint' }, 'The page works offline, with keyboard or an Xbox controller. The DS ROM has the game on the top screen and a touch panel on the bottom (score, minimap, controls). Copy it to roms/NDS on your RG DS Plus.'));
    main.append(box);
}
async function playArcade() {
    const A = P.arcade, cv = el('canvas', { width: 320, height: 240, class: 'pix play' }), k = {}; cv.style.cssText = 'width:640px;height:480px;image-rendering:pixelated';
    const kd = e => { k[e.key] = true; if (e.key === ' ') k.z = true; if (e.key === 'Escape') close(); if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); }, ku = e => { k[e.key] = false; if (e.key === ' ') k.z = false; };
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    const game = NRArcade.play(cv, A.mode, A.cfg, { keys: k, seed: Date.now() & 0xffff }); window.__arcade = game;
    const close = () => { game.stop(); removeEventListener('keydown', kd); removeEventListener('keyup', ku); m.remove(); };
    const m = modal('🕹 ' + (A.cfg.title || 'Arcade'), el('div', {}, cv, el('p', { class: 'hint' }, NRArcade.MODES[A.mode].controls + ' · Z/Space = A · X = B · C = Y · Esc closes')), [['Close', () => { close(); return false; }, 'alt']]);
}
async function exportBasketSnes() {
    try { const out = NRSnes.patchBasket(await gunzipB64(ROMS.snes_basket), P.arcade.cfg), nm = ((P.arcade.cfg.title || 'basketball').replace(/\W+/g, '_')); await download(nm + '.sfc', out.rom, 'application/octet-stream'); notify('Saved ' + nm + '.sfc: copy it to your SNES folder (RG DS Plus: roms/SFC). Game length, difficulty, turbo speed and the title come from your settings. It opens on the NOTAREAL logo.'); } catch (e) { notify('Could not build the SNES ROM: ' + e.message); }
}
async function exportKartSnes() {
    try {
        const R = Object.assign({ laps: 3, rivals: 3, rivalPct: 92, top: 3 }, P.race || {});
        const cfg = { laps: R.laps, rivals: Math.max(1, Math.min(3, R.rivals || 3)), cc: R.top < 2.5 ? 1 : R.top < 3.5 ? 2 : 3, skill: R.rivalPct <= 80 ? 1 : R.rivalPct <= 100 ? 2 : 3, title: (P.meta && P.meta.title) || 'NOTAREAL KART' };
        const out = NRSnes.patchKart(await gunzipB64(ROMS.snes_kart), cfg), nm = String(cfg.title).replace(/\W+/g, '_');
        await download(nm + '.sfc', out.rom, 'application/octet-stream');
        notify('Saved ' + nm + '.sfc: copy it to your SNES folder (RG DS Plus: roms/SFC). It is the Mode 7 kart racer: the circuit is built in, and your laps, rivals (up to 3), speed class, rival skill and title come from the Race settings. It opens on the NOTAREAL logo.');
    } catch (e) { notify('Could not build the SNES kart ROM: ' + e.message); }
}
async function exportArcadeDS() {
    try { const sk = P.arcade.mode === 'skate', w3 = NRWorld3D.MODES[P.arcade.mode] !== undefined, res = w3 ? NRWorld3D.build(P) : sk ? NRKit.buildDSSkate(P) : NRKit.buildDSArcade(P), out = NRKit.patchROM(await gunzipB64(w3 ? ROMS.ds_world3d : sk ? ROMS.ds_skate3d : ROMS.ds_arcade), res.block), nm = ((P.arcade.cfg.title || 'arcade').replace(/\W+/g, '_')); await download(nm + '.nds', await withBanner(out.rom), 'application/octet-stream'); notify('Saved ' + nm + '.nds: copy to roms/NDS on your RG DS Plus and open in DraStic. It opens on the NOTAREAL logo.'); } catch (e) { notify('Could not build the DS ROM: ' + e.message); }
}
async function exportArcadeSoft(conArg) {
    const con = typeof conArg === 'string' ? conArg : P.console;
    try { const res = NRWorld3D.build(P), out = NRKit.patchROM(await gunzipB64(con === 'n64' ? ROMS.n64_world3d : ROMS.psx_world3d), res.block), nm = ((P.arcade.cfg.title || 'arcade').replace(/\W+/g, '_')), ext = con === 'n64' ? 'z64' : 'exe'; await download(nm + '.' + ext, out.rom, 'application/octet-stream'); notify('Saved ' + nm + '.' + ext + ' (software-rendered 3D, same world as the DS and PC versions). It opens on the NOTAREAL logo.' + (res.warnings.length ? ' ' + res.warnings.join(' ') : '')); } catch (e) { notify('Could not build the ' + (con === 'n64' ? 'N64' : 'PlayStation') + ' ROM: ' + e.message); }
}
async function exportArcade() {
    try { const html = NRPc.arcadeHTML(P, { sources: effectiveSources() }); await download(((P.arcade.cfg.title || 'arcade').replace(/[^a-z0-9]+/gi, '_').toLowerCase()) + '.html', html, 'text/html'); notify('Saved. Double-click the file to play it offline in Edge or Chrome (Xbox controller works).'); } catch (e) { notify('Could not export: ' + e.message); }
}
/* ------------------------------------------------------------------ Make me a game */
function aiClient() {
    const c = TPL.ai; if (c.kind === 'none') return null;
    const via = DESK.ok ? ((u, o) => deskCall('/api/ai', { url: u, body: JSON.parse(o.body) }).then(j => ({ json: async () => j }))) : null;
    return NRAI.client({ kind: c.kind, url: c.url || undefined, model: c.model || undefined }, via || undefined);
}
function builderTab(main) {
    const box = el('div', { class: 'pane' }), ta = el('textarea', { rows: 3, style: 'width:100%', placeholder: 'Describe your game: "a haunted castle platformer with 4 levels called Boo Hall", "a kart race through the desert", "a farm game", "a wrestling game"...' }),
        log = el('pre', { class: 'hint', style: 'min-height:60px;white-space:pre-wrap' }, TPL.log.join('\n')), st = el('p', { class: 'hint' }, '');
    box.append(el('h2', {}, '✨ Make me a game'), el('p', { class: 'hint' }, 'Type what you want. With no AI it reads your keywords and picks the right template, theme and level count. With a local AI (below) it also names your game and writes story lines. Every level it builds is checked and can be finished. Everything runs on this computer.'), ta,
        el('div', { class: 'row' }, el('button', { class: 'go', onclick: async () => {
            if (TPL.busy || !ta.value.trim()) return; TPL.busy = true; TPL.log = []; const say = m => { TPL.log.push(m); log.textContent = TPL.log.join('\n'); };
            try { const r = await NRAI.make(ta.value, tplBase(), aiClient(), say); const apply = () => applyResult(r); if (P && dirty) { modal('Replace your game?', el('p', {}, 'Your game "' + r.project.meta.title + '" is ready. Starting it replaces the one you are working on.'), [['Cancel', () => true, 'alt'], ['Use it', () => { apply(); return true; }, 'go']]); } else apply(); }
            catch (e) { say('Problem: ' + e.message); } TPL.busy = false; } }, '✨ Build it')), log, st);
    const ai = el('details', {}, el('summary', {}, '🧠 Local AI (optional)')), kindSel = el('select', { onchange: e => { TPL.ai.kind = e.target.value; TPL.ai.url = TPL.ai.model = ''; renderAll(); } }, ...[['none', 'No AI (keywords only)'], ['llama', 'llama.cpp server (127.0.0.1:8080)'], ['ollama', 'Ollama (127.0.0.1:11434)']].map(([k, n]) => el('option', Object.assign({ value: k }, TPL.ai.kind === k ? { selected: '' } : {}), n)));
    ai.append(el('p', { class: 'hint' }, 'Run a small model on your own computer (for example Qwen 2.5 7B). Nothing is sent over the internet. The AI only chooses words and numbers; the kit builds and checks the game. See HOW_TO_USE for the one-time setup.'), el('div', { class: 'row wrap' }, kindSel,
        TPL.ai.kind !== 'none' ? el('input', { placeholder: 'Model name (optional)', value: TPL.ai.model, style: 'width:180px', onchange: e => { TPL.ai.model = e.target.value; } }) : '',
        TPL.ai.kind !== 'none' ? el('button', { class: 'alt', onclick: async () => { try { const r = await aiClient()('Reply with {"ok":1}', { maxTokens: 20 }); st.textContent = 'AI answered: ' + String(r).slice(0, 60); } catch (e) { st.textContent = 'AI did not answer: ' + e.message; } } }, 'Test') : ''));
    box.append(ai); main.append(box);
    /* assistant with tools: does what the buttons do */
    const ctx = () => ({ P: () => P, tesRef: () => bereaRef(), codedb: () => CODEDB.concat(labLoad()), measured: () => MEASURED, hooks: { markDirty: () => { dirty = true; }, useTemplate: (id, o) => useTemplate(id, o), exportRom: () => exportRom(), openTab: t => { tab = t; renderAll(); } } });
    const ask = el('input', { placeholder: 'Tell the assistant what to change: "4 player kart game, 3 rivals, 5 laps", "late game long blade", "validate the campaign"...', style: 'width:100%' }), out = el('pre', { class: 'hint', style: 'white-space:pre-wrap;min-height:40px' }, '');
    const run = async () => { if (!ask.value.trim()) return; const r = await NRTools.agent(ask.value, ctx(), TPL.ai.kind !== 'none' ? aiClient() : null); out.textContent = (r.understood ? '(' + (r.source === 'ai' ? 'local AI' : 'keywords') + ')\n' : 'I did not understand. Tools I can use:\n' + NRTools.list().map(t => '• ' + t.about).join('\n')) + r.steps.map(s => (s.ok ? '✔ ' : '✘ ') + s.msg).join('\n'); if (P) { renderAssistKeep = true; } };
    let renderAssistKeep = false;
    box.append(el('h3', {}, '🛠 Assistant (uses the same tools as the buttons)'), el('p', { class: 'hint' }, 'It can change race settings, title, console, design weapons / armour / enemies from scanned RPG data, check and test the wasteland campaign, search the games you scanned, and export. It can only use the listed tools.'), ask, el('div', { class: 'row' }, el('button', { class: 'go', onclick: run }, 'Do it'), el('button', { class: 'alt', onclick: () => { out.textContent = NRTools.list().map(t => '• ' + t.id + ' - ' + t.about).join('\n'); } }, 'What can you do?')), out);
}

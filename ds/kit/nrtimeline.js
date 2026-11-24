/* nrtimeline.js (v1.0) - the Timeline: one ordered list of everything in a game (cutscenes, levels, races, RPG maps, shooter missions, arcade games such as
 * skateboarding / zombie rounds / bracelet shop, world maps, puzzles, fights) with what happens on a win or a loss. The same list drives
 *   - the PC / Xbox / desktop package (timeline.html plays cutscenes + every arcade engine in order, score and flags carry over),
 *   - the small-console ROMs (levels / race tracks / cutscenes are put in order; a ROM is one engine, so a mixed list is explained, not silently cut),
 *   - the checker (T.validate) and a headless runner (T.run) used by the tests and the offline AI.
 * step = { id, type, title, text, speaker, mode, cfg, level, map, onWin:'next'|<step id>, onLose:'retry'|'skip'|'end', needs:'flag', sets:'flag', reward:number } */
(function (root) {
'use strict';
const T = {}, node = typeof require === 'function' && typeof module !== 'undefined';
const Arcade = node ? require('./nrarcade.js') : root.NRArcade; if (node) { try { require('./nrroom.js'); } catch (e) {} }
T.TYPES = {
    title: { label: 'Title screen', family: 'story', group: 'Screens & story', icon: '🏷', about: 'Game title and PRESS Z. Plays on every console.' },
    loading: { label: 'Loading screen', family: 'story', group: 'Screens & story', icon: '⏳', about: 'A loading bar with a tip. Use it to hide a switch between two engines.' },
    cutscene: { label: 'Cutscene', family: 'story', group: 'Screens & story', icon: '🎬', about: 'A text card with a speaker. Plays on every console.' },
    dialogue: { label: 'Dialogue', family: 'story', group: 'Screens & story', icon: '💬', about: 'Several lines, one speaker per line ("Name: text"), Z advances.' },
    menu: { label: 'Choice menu', family: 'story', group: 'Screens & story', icon: '☰', about: 'The player picks one option; each option can jump to a different section.' },
    credits: { label: 'Credits', family: 'story', group: 'Screens & story', icon: '🎞', about: 'Scrolling credits.' },
    transition: { label: 'Transition', family: 'story', group: 'Screens & story', icon: '🚪', about: 'Fade, wipe, door, vehicle or portal between two sections (get in the car, walk through a door).' },
    level: { label: 'Platformer level', family: 'platformer', group: 'Platformer', icon: '🏃', about: 'A level from the Level tab (side-scrolling).' },
    race: { label: 'Race track', family: 'race', group: 'Racing & vehicles', icon: '🏁', about: 'A track from the Level tab (racing mode).' },
    rpg: { label: 'RPG world', family: 'rpg', group: 'Open world & adventure', icon: '🧙', about: 'The World tab maps as an RPG.' },
    fps: { label: 'First-person maze', family: 'fps3d', group: 'Action & shooters', icon: '🔫', about: 'A maze level for the N64 / PlayStation first-person ROM.' },
    arcade: { label: 'Arcade / sport / mission game', family: 'arcade', group: 'Minigames & arcade', icon: '🕹', about: 'Any Arcade-tab engine: skateboarding, military missions, zombie rounds, bracelet shop, shooter, racing, brawler, puzzles, basketball, arcade room...' },
    world: { label: 'Open-world map', family: 'world', group: 'Open world & adventure', icon: '🗺', about: 'A World-tab map played top-down (PC / Xbox / DS).' },
    puzzle: { label: 'Puzzle game', family: 'puzzle', group: 'Minigames & arcade', icon: '🧩', about: 'Match-3 or bracelet pattern puzzle (PC / DS).' },
    fight: { label: 'Fight / wrestling match', family: 'fight', group: 'Fighting & wrestling', icon: '🤼', about: 'A match from the Fight tab (PC / DS).' }
};
T.TRANSITIONS = { cut: 'Cut', fade: 'Fade', wipe: 'Wipe', door: 'Door', vehicle: 'Vehicle (speed lines)', portal: 'Portal (iris)' };
T.GROUPS = ['Screens & story', 'Open world & adventure', 'Action & shooters', 'Platformer', 'Racing & vehicles', 'Fighting & wrestling', 'Sports', 'Minigames & arcade'];
T.COLORS = { 'Screens & story': '#6a7fd8', 'Open world & adventure': '#3fae6a', 'Action & shooters': '#d8584a', 'Platformer': '#e0a63a', 'Racing & vehicles': '#e0703a', 'Fighting & wrestling': '#b04ad8', 'Sports': '#3aa8c8', 'Minigames & arcade': '#d84a9a' };
/* the palette on the left of the timeline: every kind of section a game can have, named the way players name them. mode = an Arcade-tab engine */
T.PALETTE = [
    { id: 'title', type: 'title' }, { id: 'loading', type: 'loading' }, { id: 'cutscene', type: 'cutscene' }, { id: 'dialogue', type: 'dialogue' }, { id: 'menu', type: 'menu' }, { id: 'credits', type: 'credits' }, { id: 'transition', type: 'transition' },
    { id: 'rpg', type: 'rpg' }, { id: 'world', type: 'world' }, { id: 'open3d', type: 'arcade', mode: 'sandbox3d', label: '3D open world', icon: '🌆', group: 'Open world & adventure' }, { id: 'rpg3d', type: 'arcade', mode: 'rpg3d', label: '3D open-world RPG', icon: '☢', group: 'Open world & adventure' },
    { id: 'store3d', type: 'arcade', mode: 'store3d', label: 'Store job sim (3D)', icon: '🏪', group: 'Open world & adventure' }, { id: 'life3d', type: 'arcade', mode: 'life3d', label: 'Life sim (3D town)', icon: '🏡', group: 'Open world & adventure' }, { id: 'sim', type: 'arcade', mode: 'sim', label: 'City builder', icon: '🏙', group: 'Open world & adventure' },
    { id: 'godsim', type: 'arcade', mode: 'godsim', label: 'God sim', icon: '🌌', group: 'Open world & adventure' }, { id: 'craft', type: 'arcade', mode: 'craft', label: 'Bracelet shop (life sim)', icon: '📿', group: 'Open world & adventure' },
    { id: 'fps', type: 'arcade', mode: 'fps', label: 'First-person shooter', icon: '🔫', group: 'Action & shooters' }, { id: 'military', type: 'arcade', mode: 'military', label: 'Military shooter / zombies', icon: '🪖', group: 'Action & shooters' }, { id: 'warfare3d', type: 'arcade', mode: 'warfare3d', label: '3D warfare (large map)', icon: '💥', group: 'Action & shooters' },
    { id: 'rail', type: 'arcade', mode: 'rail', label: 'Rail shooter', icon: '🎯', group: 'Action & shooters' }, { id: 'shmup', type: 'arcade', mode: 'shmup', label: 'Shoot-em-up', icon: '🚀', group: 'Action & shooters' }, { id: 'brawler', type: 'arcade', mode: 'brawler', label: 'Beat-em-up', icon: '👊', group: 'Action & shooters' },
    { id: 'level', type: 'level' }, { id: 'side3d', type: 'arcade', mode: 'side3d', label: '3D side-scroller', icon: '🍄', group: 'Platformer' },
    { id: 'race', type: 'race' }, { id: 'race3', type: 'arcade', mode: 'race', label: 'Racing (pseudo-3D)', icon: '🏎', group: 'Racing & vehicles' }, { id: 'combat', type: 'arcade', mode: 'combat', label: 'Vehicle combat', icon: '🚙', group: 'Racing & vehicles' },
    { id: 'fight', type: 'fight', label: 'Wrestling / fighting match' },
    { id: 'hoops', type: 'arcade', mode: 'hoops', label: 'Hoop shootout', icon: '🏀', group: 'Sports' }, { id: 'basketball', type: 'arcade', mode: 'basketball', label: 'Basketball 2-on-2', icon: '🏀', group: 'Sports' }, { id: 'baseball', type: 'arcade', mode: 'baseball', label: 'Baseball', icon: '⚾', group: 'Sports' }, { id: 'skate', type: 'arcade', mode: 'skate', label: 'Skateboarding', icon: '🛹', group: 'Sports' }, { id: 'airhockey', type: 'arcade', mode: 'airhockey', label: 'Air hockey', icon: '🏒', group: 'Sports' },
    { id: 'room', type: 'arcade', mode: 'room', label: 'Arcade room (walk-in, machines)', icon: '🕹', group: 'Minigames & arcade' }, { id: 'claw', type: 'arcade', mode: 'claw', label: 'Claw machine', icon: '🧸', group: 'Minigames & arcade' },
    { id: 'puzzle', type: 'puzzle', label: 'Match-3 / bracelet arrange' }, { id: 'falling', type: 'arcade', mode: 'falling', label: 'Falling blocks', icon: '🟪', group: 'Minigames & arcade' }, { id: 'memory', type: 'arcade', mode: 'memory', label: 'Memory pairs', icon: '🃏', group: 'Minigames & arcade' },
    { id: 'breakout', type: 'arcade', mode: 'breakout', label: 'Breakout', icon: '🧱', group: 'Minigames & arcade' }, { id: 'coloring', type: 'arcade', mode: 'coloring', label: 'Coloring book', icon: '🖍', group: 'Minigames & arcade' }
].map(p => { const t = T.TYPES[p.type]; return Object.assign({ label: t.label, icon: t.icon, group: t.group }, p); });
/* palette entries that can actually be built right now (an engine that is not loaded is hidden) */
T.palette = () => T.PALETTE.filter(p => p.type !== 'arcade' || (Arcade && Arcade.MODES && Arcade.MODES[p.mode]));
T.fromPalette = id => { const p = T.PALETTE.find(x => x.id === id); if (!p) return null; const o = { title: p.label }; if (p.type === 'arcade') { o.mode = p.mode; o.cfg = JSON.parse(JSON.stringify((Arcade.DEFAULTS && Arcade.DEFAULTS[p.mode]) || {})); if (p.mode === 'room') o.cfg.machines = JSON.parse(JSON.stringify(Arcade.ROOM_MACHINES || o.cfg.machines || [])); o.title = p.label; } if (p.type === 'transition') o.mode = 'fade'; if (p.type === 'menu') o.choices = [{ text: 'Continue', next: 'next' }]; return T.step(p.type, o); };
/* arcade engines the DS ROM scene router can chain (kept equal to NRKit.ARCADE_KEYS minus the old paint key; checked by tests) */
T.DS_ARCADE = ['shmup', 'breakout', 'race', 'fps', 'brawler', 'falling', 'memory', 'sim', 'paint', 'hoops', 'music', 'coloring'];
/* which step families a console can hold in ONE game: a small-console ROM is a single engine; DS holds one engine ROM; PC / Xbox mix everything */
T.CAN = {
    pc: ['story', 'platformer', 'race', 'rpg', 'fps3d', 'arcade', 'world', 'puzzle', 'fight'], xbox: ['story', 'platformer', 'race', 'rpg', 'fps3d', 'arcade', 'world', 'puzzle', 'fight'],
    ds: ['story', 'platformer', 'world', 'puzzle', 'fight', 'arcade'], snes: ['story', 'platformer'], gb: ['story', 'platformer', 'race', 'rpg'], gbc: ['story', 'platformer', 'race', 'rpg'], nes: ['story', 'platformer', 'race', 'rpg'],
    gba: ['story', 'platformer', 'race', 'rpg'], n64: ['story', 'platformer', 'race', 'rpg', 'fps3d'], psx: ['story', 'platformer', 'race', 'rpg', 'fps3d']
};
let uid = 1; T.newId = () => 's' + (uid++) + Math.floor(Math.random() * 1e4).toString(36);
T.step = (type, o = {}) => Object.assign({ id: T.newId(), type, title: o.title || T.TYPES[type].label, text: '', speaker: '', mode: '', cfg: {}, level: 0, map: '', onWin: 'next', onLose: T.TYPES[type].family === 'story' ? 'next' : 'retry', needs: '', sets: '', reward: 0, music: null, transition: '', dur: 0, lines: [], choices: [], triggers: [] }, o);
/* rough length in seconds, for the width of a clip on the timeline ruler */
T.length = s => { if (s.dur) return s.dur / 60; const t = s.type; if (t === 'title') return 4; if (t === 'loading') return 3; if (t === 'cutscene') return 6; if (t === 'dialogue') return Math.max(4, (s.lines && s.lines.length || String(s.text || '').split('\n').length) * 4); if (t === 'menu') return 4; if (t === 'credits') return 20; if (t === 'transition') return 1.5; if (t === 'arcade') { if (s.mode === 'room') return 120; return 90; } if (t === 'level') return 120; if (t === 'race') return 90; if (t === 'rpg' || t === 'world') return 300; if (t === 'fight') return 150; return 60; };
T.get = P => (P.timeline = Array.isArray(P.timeline) ? P.timeline : []);
/* a timeline from what the project already has, so old projects open with a sensible one */
T.fromProject = P => {
    const out = [];
    for (const c of (P.cutscenes || []).filter(c => c.when === 'intro')) out.push(T.step('cutscene', { title: 'Intro', text: c.text, speaker: c.speaker }));
    if (P.arcade && P.arcade.mode && !(P.levels || []).length) out.push(T.step('arcade', { title: (P.arcade.cfg && P.arcade.cfg.title) || 'Game', mode: P.arcade.mode, cfg: P.arcade.cfg || {} }));
    const ty = P.miniMode === 'race' ? 'race' : P.miniMode === 'fps' ? 'fps' : 'level';
    (P.levels || []).forEach((L, i) => { for (const c of (P.cutscenes || []).filter(c => c.when === 'level' && (c.level | 0) === i)) out.push(T.step('cutscene', { title: 'Before ' + (L.name || i + 1), text: c.text, speaker: c.speaker })); out.push(T.step(ty, { title: L.name || 'Level ' + (i + 1), level: i })); });
    if (P.world && (P.world.maps || []).length) out.push(T.step('world', { title: P.world.maps[0].name, map: P.world.maps[0].id }));
    for (const c of (P.cutscenes || []).filter(c => c.when === 'ending')) out.push(T.step('cutscene', { title: 'Ending', text: c.text, speaker: c.speaker }));
    return out;
};
T.validate = (P, con) => {
    const tl = T.get(P), errors = [], warnings = [], can = T.CAN[con || P.console || 'pc'] || T.CAN.pc, fams = new Set();
    if (!tl.length) errors.push('The timeline is empty. Add a step.');
    const ids = new Set(tl.map(s => s.id)), flags = new Set(), isTarget = v => !v || v === 'next' || v === 'end' || v === 'retry' || v === 'skip' || ids.has(v);
    tl.forEach((s, i) => {
        const ty = T.TYPES[s.type], nm = `Step ${i + 1} "${s.title}"`; if (!ty) { errors.push(`Step ${i + 1}: unknown type "${s.type}".`); return; }
        fams.add(ty.family);
        if (!can.includes(ty.family)) errors.push(`${nm}: ${ty.label} cannot run on ${con || P.console}.`);
        if (s.type === 'arcade') { if (!Arcade.MODES[s.mode]) errors.push(`${nm}: pick an arcade game.`); }
        if (s.type === 'arcade' && s.mode === 'room') { const ms = (s.cfg && s.cfg.machines) || Arcade.ROOM_MACHINES || []; if (!ms.length) warnings.push(`${nm}: the arcade room has no machines.`); ms.forEach(m => { if (!Arcade.MODES[m.mode] || m.mode === 'room') errors.push(`${nm}: machine "${m.label || '?'}" has no valid game.`); }); }
        if ((s.type === 'level' || s.type === 'race' || s.type === 'fps') && !(P.levels || [])[s.level | 0]) errors.push(`${nm}: level ${(s.level | 0) + 1} does not exist.`);
        if (s.type === 'world' && P.world && s.map && !(P.world.maps || []).some(m => m.id === s.map)) errors.push(`${nm}: map not found.`);
        if (!isTarget(s.onWin)) errors.push(`${nm}: the win branch points to a step that is gone.`);
        if (!isTarget(s.onLose)) errors.push(`${nm}: the lose branch points to a step that is gone.`);
        if (s.needs && !flags.has(s.needs)) warnings.push(`${nm} needs flag "${s.needs}", which no earlier step sets.`);
        if (s.music != null && s.music >= 0 && !(P.songs || [])[s.music]) errors.push(`${nm}: music ${s.music + 1} does not exist (Music tab).`);
        if (s.transition && !T.TRANSITIONS[s.transition]) errors.push(`${nm}: unknown transition "${s.transition}".`);
        if (s.type === 'menu') { if (!(s.choices || []).length) errors.push(`${nm}: a menu needs at least one choice.`); (s.choices || []).forEach(c => { if (!isTarget(c.next)) errors.push(`${nm}: choice "${c.text}" points to a step that is gone.`); }); }
        (s.triggers || []).forEach(tr => { if (!isTarget(tr.next)) errors.push(`${nm}: a trigger points to a step that is gone.`); if (tr.on !== 'score' && tr.on !== 'time') errors.push(`${nm}: unknown trigger "${tr.on}".`); });
        if (s.sets) flags.add(s.sets);
    });
    const dsb = T.dsButtons(P); dsb.forEach((b, i) => { if (b.action === 'scene' && !ids.has(b.target)) errors.push(`Bottom-screen button ${i + 1} "${b.label}" points to a step that is gone.`); });
    if (dsb.length && (con || P.console) !== 'ds' && (con || P.console)) warnings.push('Bottom-screen buttons are only used on the DS (the PC preview shows them as keys 1-4).');
    const game = [...new Set(tl.filter(s => T.TYPES[s.type] && T.TYPES[s.type].family !== 'story').map(s => s.type === 'arcade' ? 'arcade:' + (s.mode || '?') : T.TYPES[s.type].family))];
    const dsRouter = con === 'ds' && game.length > 1 && game.every(g => g.startsWith('arcade:') && T.DS_ARCADE.includes(g.slice(7)));
    if (dsRouter) warnings.push('DS: ' + game.length + ' arcade engines are chained by the ROM scene router (' + game.map(g => g.slice(7)).join(', ') + '). Story sections become text cards.');
    if (con && con !== 'pc' && con !== 'xbox' && game.length > 1 && !dsRouter) errors.push(`${con.toUpperCase()} builds one engine per ROM today, but this timeline mixes ${game.join(' + ')}. A PC / Xbox package runs a mixed game; for ${con.toUpperCase()} keep one kind of step until the multi-engine ROM router covers it (the DS router chains the DS arcade games: shoot-em-up, breakout, racing, first-person, brawler, falling blocks, memory, town builder, hoops, music maker, coloring).`);
    return { ok: !errors.length, errors, warnings, families: [...fams] };
};
/* the DS bottom-screen buttons of this game: { label, icon, action: 'scene' (call that step, then come back) | 'flag' (set a story flag), target } */
T.dsButtons = P => ((P.ds && P.ds.bottomScreen && P.ds.bottomScreen.buttons) || []).filter(b => b && b.label);
/* order a small-console project by the timeline: levels / tracks in timeline order, cutscenes become intro / before-level / ending */
T.compileMini = P => {
    const Q = JSON.parse(JSON.stringify(P)), tl = T.get(Q), order = [], cs = []; let pending = [];
    for (const s of tl) {
        if (s.type === 'cutscene') { pending.push(s); continue; }
        if (s.type === 'level' || s.type === 'race' || s.type === 'fps') { const idx = order.length; order.push(s.level | 0); pending.forEach(c => cs.push({ when: idx === 0 && !cs.some(x => x.when === 'intro') ? 'intro' : 'level', level: idx, speaker: c.speaker || '', text: c.text || c.title, duration: 300 })); pending = []; }
    }
    pending.forEach(c => cs.push({ when: 'ending', level: 0, speaker: c.speaker || '', text: c.text || c.title, duration: 300 }));
    if (order.length) { const L = Q.levels; Q.levels = order.map(i => L[i]).filter(Boolean); }
    Q.cutscenes = cs; return Q;
};
/* run a timeline without a screen: bot(step, game) gives the keys for arcade steps; other kinds use result(step) -> 'win'|'lose' (default win) */
T.run = (P, o = {}) => {
    const tl = T.get(P), log = [], st = { score: 0, flags: {}, lives: o.lives || 3, steps: 0 }; let i = 0, guard = 0;
    while (i < tl.length && guard++ < (o.maxSteps || 200)) {
        const s = tl[i]; let res = 'win';
        if (s.needs && !st.flags[s.needs]) { log.push({ id: s.id, skipped: 'needs ' + s.needs }); i++; continue; }
        if (s.type === 'arcade') {
            const g = Arcade.create(s.mode, Object.assign({}, s.cfg), { seed: o.seed || 1 }); const lim = o.frames || 6000;
            for (let f = 0; f < lim && g.s.status === 'play'; f++) g.step(o.bot ? o.bot(s, g, f) || {} : {});
            res = g.s.status === 'win' ? 'win' : g.s.status === 'lose' ? 'lose' : (o.timeoutIs || 'lose'); st.score += g.s.score | 0;
        } else if (s.type !== 'cutscene') res = o.result ? o.result(s) : 'win';
        st.steps++; log.push({ id: s.id, type: s.type, title: s.title, result: res });
        if (res === 'win') { if (s.sets) st.flags[s.sets] = 1; st.score += s.reward | 0; if (s.onWin && s.onWin !== 'next') { const j = tl.findIndex(x => x.id === s.onWin); i = j >= 0 ? j : i + 1; } else i++; }
        else if (s.onLose === 'skip') i++; else if (s.onLose && !['retry', 'next', 'end'].includes(s.onLose) && tl.some(x => x.id === s.onLose)) i = tl.findIndex(x => x.id === s.onLose); else if (s.onLose === 'next') i++; else if (s.onLose === 'end') break; else { st.lives--; if (st.lives <= 0) { st.over = true; break; } }
    }
    st.finished = i >= tl.length && !st.over; return { state: st, log };
};
/* ready-made timelines (each is a complete multi-genre game; levels / worlds are made by the other tabs or templates) */
T.PRESETS = {
    story_campaign: { name: 'Story campaign (mixed genres)', about: 'Intro, a race, a skate session, a military mission, the bracelet shop, then a zombie finale. PC / Xbox / desktop.', steps: () => [
        T.step('cutscene', { title: 'Intro', speaker: 'Narrator', text: 'Steve needs cash, skills and a crew. It starts with a race across town.' }),
        T.step('arcade', { title: 'Street race', mode: 'race', cfg: { laps: 2, title: 'Street race' }, sets: 'raced', reward: 200 }),
        T.step('cutscene', { title: 'Skate park', speaker: 'Rebecca', text: 'Show me what you can do on a board, then we talk.' }),
        T.step('arcade', { title: 'Skate session', mode: 'skate', cfg: { spot: 1 }, reward: 300 }),
        T.step('arcade', { title: 'Military mission', mode: 'military', cfg: { mode: 'campaign', mission: 0 }, sets: 'mission1', reward: 400 }),
        T.step('arcade', { title: 'Bracelet shop', mode: 'craft', cfg: { days: 5, goalCash: 300 }, reward: 200 }),
        T.step('cutscene', { title: 'Finale', speaker: 'Narrator', text: 'One last night. They keep coming.' }),
        T.step('arcade', { title: 'Zombie night', mode: 'military', cfg: { mode: 'zombies', rounds: 5 }, reward: 800 })] },
    skate_career: { name: 'Skate career', about: 'Three parks in a row with a story between each.', steps: () => [
        T.step('cutscene', { title: 'Intro', speaker: 'Coach', text: 'Parking lot first. Learn to grind.' }), T.step('arcade', { title: 'Parking Lot', mode: 'skate', cfg: { spot: 0 } }),
        T.step('cutscene', { title: 'Skate Park', speaker: 'Coach', text: 'Now the bowl. Get that combo up.' }), T.step('arcade', { title: 'Skate Park', mode: 'skate', cfg: { spot: 1 } }),
        T.step('cutscene', { title: 'Downtown', speaker: 'Coach', text: 'Real streets. Real gaps.' }), T.step('arcade', { title: 'Downtown', mode: 'skate', cfg: { spot: 2 } })] },
    war_and_zombies: { name: 'War campaign + zombie mode', about: 'Four missions then unlock zombies.', steps: () => [
        ...[0, 1, 2, 3].flatMap(m => [T.step('cutscene', { title: 'Briefing ' + (m + 1), speaker: 'Command', text: 'Mission ' + (m + 1) + ': follow the briefing and extract.' }), T.step('arcade', { title: 'Mission ' + (m + 1), mode: 'military', cfg: { mode: 'campaign', mission: m, single: true }, sets: 'm' + (m + 1) })]),
        T.step('arcade', { title: 'Zombie mode', mode: 'military', cfg: { mode: 'zombies', rounds: 8 }, needs: 'm4' })] },
    arcade_night: { name: 'Arcade night (title, room, credits)', about: 'Title, a loading screen, Mamaw hands you tokens, you walk through a door into an arcade room full of machines, then the credits.', steps: () => [
        T.step('title', { title: 'Title', text: 'Friday night at the arcade', music: 0 }), T.step('loading', { title: 'Loading', text: 'Tip: air hockey is easier than it looks.', dur: 90 }),
        T.step('dialogue', { title: 'Mamaw', lines: [{ speaker: 'Mamaw', text: 'Here are your tokens, hon. Do not spend them all on the claw.' }, { speaker: 'Steve', text: 'No promises.' }] }),
        T.step('transition', { title: 'Through the door', mode: 'door', text: 'Arcade' }), T.step('arcade', { title: 'Arcade room', mode: 'room', cfg: { title: 'Arcade Room', tokens: 6, goalTickets: 10 }, music: 1 }),
        T.step('credits', { title: 'Credits', text: 'THE END\nThanks for playing\nMade with Notareal Studio' })] },
    genre_hop: { name: 'Genre hop (walk, drive, fight, arcade)', about: 'A 3D town, get in the car (transition), race, then an arcade room: four engines in one game. PC / Xbox / desktop.', steps: () => [
        T.step('title', { title: 'Title', text: 'One game, many genres' }), T.step('arcade', { title: 'Town (3D)', mode: 'sandbox3d', cfg: {}, triggers: [{ on: 'time', value: 45, next: 'next' }] }),
        T.step('transition', { title: 'Get in the car', mode: 'vehicle', text: 'Drive' }), T.step('arcade', { title: 'Street race', mode: 'race', cfg: { laps: 2 }, reward: 200, sets: 'raced' }),
        T.step('transition', { title: 'Into the arcade', mode: 'door', text: 'Arcade' }), T.step('arcade', { title: 'Arcade room', mode: 'room', cfg: { goalTickets: 5 }, needs: 'raced' }), T.step('credits', { title: 'Credits', text: 'THE END\nThanks for playing' })] },
    shop_life: { name: 'Bracelet shop life', about: 'Run the shop for two weeks, then the craft fair (puzzle).', steps: () => [
        T.step('cutscene', { title: 'Intro', speaker: 'Mamaw', text: 'Open the shop, hon. Folks want bracelets.' }), T.step('arcade', { title: 'The shop', mode: 'craft', cfg: {} }), T.step('puzzle', { title: 'Craft fair', mode: 'bracelet' })] }
};
T.preset = (id, P) => { const p = T.PRESETS[id]; if (!p) return []; P.timeline = p.steps(); P.timeline.forEach(s => { if (s.music != null && s.music >= 0 && !(P.songs || [])[s.music]) s.music = null; }); return P.timeline; };
/* ---------------------------------------------------------------------------------------------------------------------------------------------
 * The Timeline player: ONE state machine used by the editor preview, the PC / Xbox page and the tests, so they can never disagree.
 *   S = T.session(P, { seed, ds, music(songIndex|-1) }); S.step(keys) every 1/60 s; S.draw(ctx 320x240); S.state = { score, lives, flags, over, finished, log, idx }
 * Sections switch seamlessly: every step creates its own engine (arcade modes), screens (title, loading, cutscene, dialogue, menu, credits, transition) are drawn here.
 * Branching: onWin / onLose = 'next' | step id | 'end' | 'retry' | 'skip'; menu choices; triggers (score / time) inside an engine; DS bottom-screen buttons (call a step and come back). */
const FONT = s => s + 'px monospace', WW = 320, HH = 240;
const txt = (g, t, x, y, c, s, al) => { g.font = FONT(s || 10); g.fillStyle = c || '#fff'; g.textAlign = al || 'left'; g.fillText(t, x, y); };
const wrapT = (t, n) => { const w = String(t || '').split(' '), o = []; let l = ''; for (const x of w) { if ((l + ' ' + x).length > n) { o.push(l); l = x; } else l = l ? l + ' ' + x : x; } if (l) o.push(l); return o; };
/* p = how covered the screen is, 0 clear .. 1 black */
T.drawTransition = (g, kind, cover, t) => {
    if (cover <= 0.001) return; const c = Math.min(1, cover);
    if (kind === 'wipe') { g.fillStyle = '#000'; g.fillRect(0, 0, WW * c, HH); }
    else if (kind === 'door') { g.fillStyle = '#2a1a0a'; g.fillRect(0, 0, WW / 2 * c, HH); g.fillRect(WW - WW / 2 * c, 0, WW / 2 * c, HH); g.fillStyle = '#c9a050'; g.fillRect(WW / 2 * c - 2, 0, 2, HH); g.fillRect(WW - WW / 2 * c, 0, 2, HH); }
    else if (kind === 'portal') { const r = (1 - c) * 210; g.save(); g.beginPath(); g.rect(0, 0, WW, HH); g.arc(WW / 2, HH / 2, Math.max(0, r), 0, Math.PI * 2, true); g.fillStyle = '#000'; g.fill('evenodd'); g.strokeStyle = '#8af'; g.lineWidth = 3; g.beginPath(); g.arc(WW / 2, HH / 2, Math.max(0, r), 0, Math.PI * 2); g.stroke(); g.restore(); }
    else if (kind === 'vehicle') { g.fillStyle = 'rgba(0,0,0,' + (c * .8) + ')'; g.fillRect(0, 0, WW, HH); g.strokeStyle = 'rgba(255,255,255,' + (c) + ')'; g.lineWidth = 1; for (let i = 0; i < 18; i++) { const y = (i * 37 + (t || 0) * 9) % HH, l = 40 + (i * 53) % 120, x = (i * 91 + (t || 0) * 23) % (WW + l) - l; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); } }
    else if (kind !== 'cut') { g.fillStyle = 'rgba(0,0,0,' + c + ')'; g.fillRect(0, 0, WW, HH); }
};
T.session = (P, o = {}) => {
    const steps = T.get(P), byId = id => steps.findIndex(s => s.id === id), S = { score: 0, lives: o.lives || 3, flags: {}, over: false, finished: false, log: [], idx: 0, frame: 0, calls: 0 };
    const btns = (o.ds || (P.console === 'ds')) ? T.dsButtons(P).slice(0, 4) : [], songs = P.songs || []; let cur = null, stack = [], musicNow = null, last = {}; const NOSTEP = { type: 'cutscene', title: '', text: '' };
    const edge = (k, n) => { const v = !!k[n], w = !!last[n]; last[n] = v; return v && !w; };
    const setMusic = m => { if (m == null || m === musicNow) return; if (m >= 0 && !songs[m]) return; musicNow = m; if (o.music) o.music(m); };
    const enter = (idx, isCall) => {
        const s = steps[idx]; if (!s) { S.finished = true; cur = null; return; }
        if (!isCall && s.needs && !S.flags[s.needs]) { S.log.push({ id: s.id, skipped: 'needs ' + s.needs }); return enter(idx + 1); }
        S.idx = idx; cur = { idx, s, t: 0, G: null, hold: 0, sel: 0, line: 0, call: !!isCall, fired: false };
        if (s.music != null) setMusic(s.music); cur.mus = musicNow;
        if (s.type === 'arcade' && Arcade.MODES[s.mode]) cur.G = Arcade.create(s.mode, JSON.parse(JSON.stringify(s.cfg || {})), { seed: ((o.seed || 1) * 977 + idx * 131 + S.calls) >>> 0 });
        if (s.type === 'dialogue') cur.L = (s.lines && s.lines.length ? s.lines : String(s.text || '').split('\n').filter(Boolean).map(l => { const m = l.match(/^([^:]{1,18}):\s*(.*)$/); return m ? { speaker: m[1], text: m[2] } : { speaker: s.speaker || '', text: l }; }));
    };
    const target = (t, def) => { if (!t || t === 'next') return def; if (t === 'end') return -1; const j = byId(t); return j >= 0 ? j : def; };
    const finish = (res, jump) => {
        const c = cur, s = c.s; S.log.push({ id: s.id, type: s.type, title: s.title, result: res }); S.calls++;
        if (c.call) { if (res === 'win') { S.score += (c.G && c.G.s.score | 0); if (s.sets) S.flags[s.sets] = 1; } cur = stack.pop() || null; if (!cur) S.finished = true; else setMusic(cur.mus); return; }
        if (res === 'win') { if (c.G) S.score += c.G.s.score | 0; if (s.sets) S.flags[s.sets] = 1; S.score += s.reward | 0; const n = target(jump != null ? jump : s.onWin, c.idx + 1); if (n < 0) { S.finished = true; cur = null; } else enter(n); }
        else { const l = s.onLose; if (l === 'skip') enter(c.idx + 1); else if (l === 'end') { S.over = true; cur = null; } else if (l && l !== 'retry' && l !== 'next' && byId(l) >= 0) enter(byId(l)); else if (l === 'next') enter(c.idx + 1); else { S.lives--; if (S.lives <= 0) { S.over = true; cur = null; } else enter(c.idx); } }
    };
    const call = b => { if (!cur || b.action === 'flag') { if (b.target) S.flags[b.target] = 1; return; } const j = byId(b.target); if (j < 0 || stack.length > 3) return; if (cur.call) return; stack.push(cur); enter(j, true); };
    enter(0);
    S.step = k => {
        if (S.finished || S.over || !cur) return; S.frame++; const c = cur, s = c.s, z = edge(k, 'z'); c.t++;
        const playing = s.type !== 'title' && s.type !== 'loading' && s.type !== 'transition' && s.type !== 'credits';
        if (playing && btns.length) for (let i = 0; i < btns.length; i++) if (edge(k, String(i + 1))) { call(btns[i]); return; }
        const ty = s.type;
        if (ty === 'title') { if (z && c.t > 15) finish('win'); }
        else if (ty === 'loading') { if (c.t >= (s.dur || 120)) finish('win'); }
        else if (ty === 'transition') { if (c.t >= (s.dur || 60)) finish('win'); }
        else if (ty === 'cutscene') { if (z && c.t > 20) finish('win'); }
        else if (ty === 'dialogue') { const L = c.L || [], cl = L[c.line]; if (c.lt0 == null) c.lt0 = 0; const rev = !cl || Math.floor((c.t - c.lt0) / 2) >= cl.text.length; if (!L.length && c.t > 12) finish('win'); else if (z && c.t > 12) { if (!rev) c.lt0 = c.t - 99999; else { c.line++; c.lt0 = c.t; if (c.line >= L.length) finish('win'); } } }
        else if (ty === 'menu') { const n = (s.choices || []).length || 1; if (edge(k, 'ArrowDown')) c.sel = (c.sel + 1) % n; if (edge(k, 'ArrowUp')) c.sel = (c.sel + n - 1) % n; if (z && c.t > 10) finish('win', (s.choices[c.sel] || {}).next || 'next'); }
        else if (ty === 'credits') { const n = String(s.text || '').split('\n').length; if (c.t > (s.dur || (n * 22 + 260)) || (z && c.t > 40)) finish('win'); }
        else if (c.G) {
            const G = c.G; if (G.s.status === 'play') { G.step(k); if (!c.fired) for (const tr of s.triggers || []) { if ((tr.on === 'score' && G.s.score >= (tr.value | 0)) || (tr.on === 'time' && c.t >= (tr.value | 0) * 60)) { c.fired = true; finish('win', tr.next); return; } } }
            else { c.hold++; if (c.hold > 30 && z) finish(G.s.status === 'win' ? 'win' : 'lose'); else if (c.hold > 600) finish(G.s.status === 'win' ? 'win' : 'lose'); }
        } else { if (z && c.t > 20) finish('win'); }   /* a step the page cannot play itself (level, race, RPG world, fight...) is a card that continues */
    };
    S.draw = g => {
        g.fillStyle = '#111'; g.fillRect(0, 0, WW, HH); const c = cur, s = c && c.s;
        if (!c) { txt(g, S.over ? 'GAME OVER' : 'THE END', 160, 110, '#fff', 16, 'center'); txt(g, 'SCORE ' + S.score, 160, 134, '#cde', 10, 'center'); return; }
        const ty = s.type;
        if (ty === 'title') { const gr = g.createLinearGradient ? g.createLinearGradient(0, 0, 0, HH) : null; if (gr) { gr.addColorStop(0, '#1a1f4a'); gr.addColorStop(1, '#0a0a14'); g.fillStyle = gr; g.fillRect(0, 0, WW, HH); } txt(g, String((P.meta && P.meta.title) || s.title).toUpperCase(), 160, 100, '#fff', 22, 'center'); txt(g, s.text || (P.meta && P.meta.tagline) || '', 160, 124, '#9ac', 10, 'center'); if ((c.t >> 5) & 1) txt(g, 'PRESS Z', 160, 180, '#ffd070', 12, 'center'); }
        else if (ty === 'loading') { const p = Math.min(1, c.t / (s.dur || 120)); txt(g, 'LOADING', 160, 104, '#fff', 14, 'center'); g.fillStyle = '#333'; g.fillRect(60, 120, 200, 10); g.fillStyle = '#7ad'; g.fillRect(60, 120, 200 * p, 10); txt(g, s.text || '', 160, 160, '#9ab', 9, 'center'); }
        else if (ty === 'transition') { const p = Math.min(1, c.t / (s.dur || 60)); T.drawTransition(g, s.mode || 'fade', Math.sin(p * Math.PI), c.t); if (p > .3 && p < .7 && s.text) txt(g, s.text, 160, 124, '#fff', 12, 'center'); }
        else if (ty === 'cutscene') { g.fillStyle = '#9cd'; g.fillRect(20, 70, 280, 100); g.fillStyle = '#112'; txt(g, s.speaker || s.title || '', 30, 90, '#112', 11); wrapT(s.text || s.title, 38).slice(0, 5).forEach((l, n) => txt(g, l, 30, 108 + n * 12, '#112', 10)); if (c.t > 20) txt(g, 'Z', 290, 164, '#336', 9, 'right'); }
        else if (ty === 'dialogue') { const L = (c.L || [])[Math.min(c.line, (c.L || []).length - 1)] || { speaker: '', text: '' }, n = Math.min(L.text.length, Math.floor((c.t - (c.lt0 || 0)) / 2)); g.fillStyle = '#0b1830'; g.fillRect(0, 150, WW, 90); g.strokeStyle = '#7ad'; g.lineWidth = 2; g.strokeRect(4, 154, WW - 8, 82); txt(g, L.speaker, 14, 172, '#ffd070', 11); wrapT(L.text.slice(0, n), 40).slice(0, 4).forEach((l, i) => txt(g, l, 14, 190 + i * 12, '#fff', 10)); }
        else if (ty === 'menu') { txt(g, s.text || s.title, 160, 60, '#fff', 13, 'center'); (s.choices || []).forEach((ch, i) => txt(g, (i === c.sel ? '> ' : '  ') + ch.text, 160, 100 + i * 20, i === c.sel ? '#ffd070' : '#aab', 12, 'center')); }
        else if (ty === 'credits') { const L = String(s.text || '').split('\n'); L.forEach((l, i) => { const y = HH - c.t * .8 + i * 22; if (y > -10 && y < HH + 10) txt(g, l, 160, y, i === 0 ? '#ffd070' : '#fff', i === 0 ? 14 : 11, 'center'); }); }
        else if (c.G) { c.G.draw(g); txt(g, 'STEP ' + (c.idx + 1) + '/' + steps.length + '  LIVES ' + S.lives + '  TOTAL ' + S.score, 316, 236, '#fff', 8, 'right'); if (c.G.s.status !== 'play' && c.hold > 30) txt(g, 'Z to continue', 160, 150, '#fff', 8, 'center'); }
        else { g.fillStyle = '#223'; g.fillRect(20, 80, 280, 80); txt(g, (T.TYPES[ty] || {}).label + ': ' + s.title, 160, 112, '#fff', 11, 'center'); txt(g, 'plays in its own tab / the console build  -  Z to continue', 160, 136, '#9ab', 8, 'center'); }
        if (s.transition && s.transition !== 'cut' && c.t < 26) T.drawTransition(g, s.transition, 1 - c.t / 26, c.t);
        if (btns.length && s.type !== 'title' && s.type !== 'loading') { g.fillStyle = 'rgba(10,10,30,.85)'; g.fillRect(0, HH - 22, WW, 22); btns.forEach((b, i) => { const x = 4 + i * 78; g.fillStyle = '#334'; g.fillRect(x, HH - 20, 74, 18); txt(g, (i + 1) + ' ' + String(b.label).slice(0, 9), x + 4, HH - 8, '#cde', 9); }); }
    };
    S.state = S; S.current = () => cur; S.steps = steps; return S;
};
/* run the whole timeline without a screen (tests, the offline AI, "will this game finish?"): bot(step, game, frame) -> keys for engine steps; screens get Z presses */
T.simulate = (P, o = {}) => {
    const S = T.session(P, o); let f = 0; const max = o.maxFrames || 60 * 60 * 20;
    while (!S.finished && !S.over && f++ < max) { const c = S.current(), k = {}; if (c && c.G && c.G.s.status === 'play' && o.bot) Object.assign(k, o.bot(c.s, c.G, f) || {}); else if (c && o.press) Object.assign(k, o.press(c, f) || {}); else k.z = (f % 6) < 3; if (o.keysAt) Object.assign(k, o.keysAt(f, S) || {}); S.step(k); }
    return { state: S, log: S.log, frames: f, finished: S.finished, over: S.over };
};
T.html = (P, src) => {
    const OPEN = '<' + 'script>', CLOSE = '<' + '/script>', esc = t => String(t || '').replace(/<\/script/gi, '<\\/script');
    const used = new Set(); T.get(P).forEach(s => { if (s.music != null && s.music >= 0) used.add(s.music); });
    const Q = { meta: P.meta || {}, console: P.console, timeline: T.get(P), ds: P.ds || null, songs: (P.songs || []).map((s, i) => used.has(i) ? s : null) };
    const data = JSON.stringify(Q).replace(/<\//g, '<\\/');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${String((P.meta && P.meta.title) || 'Game').replace(/[<>&]/g, '')}</title><style>html,body{margin:0;background:#000;height:100%;display:flex;align-items:center;justify-content:center}canvas{image-rendering:pixelated;width:min(100vw,calc(100vh*4/3));height:auto;aspect-ratio:4/3;background:#111}</style></head><body><canvas id="c"></canvas>
${OPEN}${esc(src.nrarcade)}${CLOSE}${OPEN}${esc(src.nrmusic)}${CLOSE}${OPEN}${esc(src.nrtimeline)}${CLOSE}${OPEN}
const P=${data},cv=document.getElementById('c');cv.width=320;cv.height=240;const g=cv.getContext('2d'),k={};
addEventListener('keydown',e=>{k[e.key]=true;k[e.key.toLowerCase()]=true;unlock();if(e.key.startsWith('Arrow')||e.key===' ')e.preventDefault()});addEventListener('keyup',e=>{k[e.key]=false;k[e.key.toLowerCase()]=false});addEventListener('pointerdown',unlock);
setInterval(()=>{const p=[...(navigator.getGamepads?navigator.getGamepads():[])].find(x=>x&&x.connected);if(!p)return;const b=i=>!!(p.buttons[i]&&p.buttons[i].pressed);k.ArrowLeft=p.axes[0]<-0.45||b(14);k.ArrowRight=p.axes[0]>0.45||b(15);k.ArrowUp=p.axes[1]<-0.45||b(12);k.ArrowDown=p.axes[1]>0.45||b(13);k.z=b(0);k.x=b(1);k.c=b(2);k['1']=b(4);k['2']=b(5);k['3']=b(6);k['4']=b(7)},16);
let ac=null,node=null,gain=null,want=null,playing=null;const buf={};
function unlock(){if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(ac&&ac.state==='suspended')ac.resume();applyMusic()}
function applyMusic(){if(!ac||want===playing)return;playing=want;try{if(node){const o=node,gg=gain;gg.gain.linearRampToValueAtTime(0,ac.currentTime+.4);setTimeout(()=>{try{o.stop()}catch(e){}},450)}}catch(e){}node=null;if(want==null||want<0||!P.songs[want]||!window.NRMusic)return;
 if(!buf[want]){const r=NRMusic.renderSong(JSON.parse(JSON.stringify(P.songs[want])),32768,1),b=ac.createBuffer(2,r.L.length,r.sr);b.copyToChannel(r.L,0);b.copyToChannel(r.R,1);buf[want]=b}
 node=ac.createBufferSource();node.buffer=buf[want];node.loop=true;gain=ac.createGain();gain.gain.setValueAtTime(0,ac.currentTime);gain.gain.linearRampToValueAtTime(.8,ac.currentTime+.5);node.connect(gain);gain.connect(ac.destination);node.start()}
const S=NRTimeline.session(P,{seed:Date.now()&0xffff,ds:P.console==='ds',music:n=>{want=n;applyMusic()}});
let last=performance.now(),acc=0;
function loop(t){acc+=Math.min(100,t-last);last=t;while(acc>=16.7){acc-=16.7;S.step(k)}S.draw(g);requestAnimationFrame(loop)}
requestAnimationFrame(loop);
${CLOSE}</body></html>`;
};
if (typeof module !== 'undefined') module.exports = T; else root.NRTimeline = T;
})(typeof window !== 'undefined' ? window : globalThis);

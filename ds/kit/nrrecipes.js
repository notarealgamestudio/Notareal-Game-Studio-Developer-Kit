/* nrrecipes.js (v1.24) - Research Lab recipes: every useful number the kit knows (measured game physics, GTA III vehicle handling, Fallout 2 / GTA III presets,
 * studio difficulty packs, and anything you scan) is an INGREDIENT with a plain name, what it does, where it came from, and which game types it fits.
 * A RECIPE is a named bundle of ingredients ("Frankenstein" = mix ingredients from different games). Adding a recipe to a game changes only the settings that game
 * actually has; the rest is reported as "not used by this game", never silently dropped. Everything is plain data, so recipes can be saved, shared and edited.
 *
 *   R.extra = ingredients added at run time (the scanned games); R.ingredients(extra) -> [{id, name, cat, what, origin, target, set, tags}]       target: 'physics' (platformer hero) | 'arcade:<mode>' (that minigame / engine's settings)
 *   R.targets(P) -> what this project can receive      R.fits(P, ing|recipe) -> {fits, uses:[labels], misses:[names]}
 *   R.apply(P, recipeOrIngredient) -> {applied:[{name, where, changes}], skipped:[name]}      R.undo() -> restores the last apply
 *   R.RECIPES (built in)   R.make(P, name, ids, about) saves your own into P.recipes      R.all(P) = built in + yours      R.exportRecipe / R.importRecipe (JSON)
 *   R.fromScan(lib) -> ingredients from scanned games (physics library)      R.describe(P) -> the settings recipes can touch, as editable JSON (Advanced tab) */
(function (root) {
    'use strict';
    const R = { extra: [] }, dep = (g, f) => { if (root[g]) return root[g]; try { return typeof require === 'function' ? require('./' + f + '.js') : null; } catch (e) { return null; } };
    const clean = o => JSON.parse(JSON.stringify(o));

    /* studio difficulty packs: hand-tuned by us (not scanned); each is a set of the settings that game type really has */
    const DIFF = {
        shmup: [{ lives: 5, enemyHp: 1, waves: 4, speed: 3 }, { lives: 2, enemyHp: 3, waves: 9, speed: 4 }], breakout: [{ lives: 5, rows: 4, ballSpeed: 2, paddle: 64 }, { lives: 2, rows: 7, ballSpeed: 4, paddle: 36 }],
        race: [{ laneCars: 6, timeLimit: 120, curves: 3 }, { laneCars: 16, timeLimit: 70, curves: 9 }], fps: [{ enemies: 4, health: 150, ammo: 60, damage: 3 }, { enemies: 12, health: 80, ammo: 30, damage: 1 }],
        brawler: [{ lives: 5, enemyHp: 2, waves: 3 }, { lives: 2, enemyHp: 5, waves: 7 }], falling: [{ startSpeed: 20, goalLines: 10 }, { startSpeed: 45, goalLines: 30 }],
        memory: [{ pairs: 6, tries: 30 }, { pairs: 12, tries: 18 }], hoops: [{ seconds: 90, goal: 8, meterSpeed: 1.6 }, { seconds: 45, goal: 15, meterSpeed: 3.4 }],
        sim: [{ cash: 1000, goalPop: 80 }, { cash: 300, goalPop: 200 }], airhockey: [{ cpuSkill: 0.6, goal: 3 }, { cpuSkill: 1.6, goal: 7 }], claw: [{ grip: 0.9, tries: 8 }, { grip: 0.5, tries: 3 }],
        baseball: [{ cpuSkill: 0.8, contact: 1.3 }, { cpuSkill: 1.6, contact: 0.8 }], rail: [{ hp: 8, mag: 9 }, { hp: 3, mag: 4 }], combat: [{ rivals: 3, rivalHp: 20 }, { rivals: 8, rivalHp: 45 }]
    };
    const MODE_NAME = { shmup: 'Shoot-em-up', breakout: 'Breakout', race: 'Racing', fps: 'First-person shooter', brawler: 'Beat-em-up', falling: 'Falling blocks', memory: 'Memory match', hoops: 'Basketball hoops', sim: 'Town builder', airhockey: 'Air hockey', claw: 'Claw machine', baseball: 'Baseball', rail: 'Rail shooter', combat: 'Vehicle combat', store3d: 'Convenience store 3D', rpg3d: 'Wasteland RPG 3D', skate: 'Skate / snow / BMX', warfare3d: 'War game 3D', sandbox3d: '3D platformer world' };
    const mname = m => MODE_NAME[m] || m;

    R.ingredients = extra => {
        const out = [], K = dep('NRKit', 'nrkit'), Ph = dep('NRPhys', 'nrphys'), PR = dep('NR3DPresets', 'nr3dpresets');
        if (K && K.PHYSICS) for (const [id, ph] of Object.entries(K.PHYSICS)) out.push({ id: 'phys:' + id, name: ph.name, cat: 'Hero movement', what: 'How the hero runs, jumps and falls (gravity, jump height, run speed).', origin: ph.source, target: 'physics', set: { gravity: ph.gravity, jump: ph.jump, jumpRun: ph.jumpRun, run: ph.run, runFast: ph.runFast, accel: ph.accel, maxFall: ph.maxFall }, tags: 'jump platformer mario run gravity' });
        if (Ph) for (const n of Ph.vehicles()) { const v = Ph.VEH[n], kmh = Math.round(v.maxKmh), cls = v.mass > 3500 ? 'heavy' : v.maxKmh >= 190 ? 'fast' : v.mass < 900 ? 'tiny' : 'family';
            for (const m of ['race', 'combat']) out.push({ id: 'veh:' + m + ':' + n, name: 'Vehicle: ' + n + ' (' + cls + ')', cat: 'Vehicles', what: `Top speed ${kmh} km/h, grip ${v.grip}, ${v.mass} kg.`, origin: 'GTA III handling table', target: 'arcade:' + m, set: { maxSpeed: Math.max(60, Math.min(320, kmh)) }, tags: 'car vehicle driving speed handling ' + cls + ' ' + n }); }
        if (PR) for (const m of PR.modes()) for (const n of PR.list(m)) out.push({ id: 'mode:' + m + ':' + n, name: mname(m) + ': ' + n.replace(/ \(.*$/, ''), cat: 'Game-type presets', what: (n.match(/\((.*)\)/) || [])[1] || 'A ready-made setup for this game type.', origin: 'GTA III / Fallout 2 / Jabroni Hawk data tables + Studio tuning', target: 'arcade:' + m, set: (() => { const o = PR.apply(m, n, {}); delete o.title; return o; })(), tags: m + ' preset ' + n });
        for (const [m, [easy, hard]] of Object.entries(DIFF)) { out.push({ id: 'diff:' + m + ':easy', name: mname(m) + ': easygoing', cat: 'Difficulty', what: 'More lives / time and weaker enemies, for relaxed play.', origin: 'Studio tuning', target: 'arcade:' + m, set: easy, tags: m + ' easy casual kids cozy' }); out.push({ id: 'diff:' + m + ':hard', name: mname(m) + ': hardcore', cat: 'Difficulty', what: 'Fewer lives, tougher enemies, tighter timers.', origin: 'Studio tuning', target: 'arcade:' + m, set: hard, tags: m + ' hard brutal challenge' }); }
        return out.concat(extra || R.extra || []);
    };
    /* scanned games (desktop /api/physics library: {games:{name:{vehicles:{...}}}}) become ingredients too, labelled with where they came from */
    R.fromScan = lib => { const out = []; for (const [g, d] of Object.entries((lib && lib.games) || {})) for (const [n, v] of Object.entries(d.vehicles || {})) { const kmh = Math.round(v.maxKmh || (v.maxSpeed ? v.maxSpeed * 3.6 : 0)); if (!kmh) continue; for (const m of ['race', 'combat']) out.push({ id: 'scan:' + g + ':' + m + ':' + n, name: 'Scanned vehicle: ' + n, cat: 'Scanned from your games', what: `Top speed ${kmh} km/h.`, origin: 'scanned from ' + g, target: 'arcade:' + m, set: { maxSpeed: Math.max(60, Math.min(320, kmh)) }, tags: 'scanned car vehicle ' + n + ' ' + g }); } return out; };

    /* what this project can receive: hero movement (platformer levels), and the settings of every minigame / engine in it (the Minigames tab game and Timeline sections) */
    R.targets = P => {
        const out = []; if (P && P.meta && P.meta.physics && (P.levels || []).length) out.push({ target: 'physics', label: 'Hero movement', obj: P.meta.physics });
        if (P && P.arcade && P.arcade.mode) out.push({ target: 'arcade:' + P.arcade.mode, label: mname(P.arcade.mode) + ' (Minigames tab)', obj: P.arcade.cfg || (P.arcade.cfg = {}) });
        ((P && P.timeline) || []).forEach(s => { if (s && s.type === 'arcade' && s.mode) out.push({ target: 'arcade:' + s.mode, label: (s.title || mname(s.mode)) + ' (timeline)', obj: s.cfg || (s.cfg = {}) }); });
        return out;
    };
    const index = P => { const m = {}; R.ingredients().forEach(i => m[i.id] = i); return m; };
    const resolve = (P, item) => { if (item && item.items) { const ix = index(P); return item.items.map(id => ix[id]).filter(Boolean).concat((item.custom || []).map((c, k) => ({ id: 'custom:' + k, name: c.name || 'Custom', target: c.target, set: c.set }))); } return [item]; };
    R.fits = (P, x) => { const ings = resolve(P, x), tg = R.targets(P), uses = [], misses = []; for (const i of ings) { const t = tg.filter(q => q.target === i.target); if (t.length) t.forEach(q => uses.push(q.label)); else misses.push(i.name); } return { fits: uses.length > 0, uses: [...new Set(uses)], misses }; };

    let undoStack = [];
    R.apply = (P, x) => {
        const ings = resolve(P, x), tg = R.targets(P), applied = [], skipped = [], snap = [];
        for (const i of ings) { const t = tg.filter(q => q.target === i.target); if (!t.length) { skipped.push(i.name); continue; }
            for (const q of t) { const before = {}; for (const k of Object.keys(i.set)) before[k] = q.obj[k]; if (q.target === 'physics') before.preset = q.obj.preset; snap.push({ obj: q.obj, before }); const changes = []; for (const [k, v] of Object.entries(i.set)) { if (q.obj[k] !== v) changes.push({ key: k, from: q.obj[k], to: v }); q.obj[k] = v; } if (q.target === 'physics') q.obj.preset = 'custom'; applied.push({ name: i.name, where: q.label, changes }); } }
        if (snap.length) { undoStack.push(snap); P.recipeLog = (P.recipeLog || []).concat([{ recipe: x.name || x.id || 'ingredient', at: new Date().toISOString().slice(0, 16), applied: applied.map(a => ({ name: a.name, where: a.where, changes: a.changes })) }]).slice(-40); }
        return { applied, skipped };
    };
    R.undo = P => { const s = undoStack.pop(); if (!s) return false; for (let k = s.length - 1; k >= 0; k--) for (const [key, v] of Object.entries(s[k].before)) { if (v === undefined) delete s[k].obj[key]; else s[k].obj[key] = v; } if (P && P.recipeLog) P.recipeLog.pop(); return true; };
    R.canUndo = () => undoStack.length > 0;

    /* ---- built-in recipes: bundles by id; a recipe fits a game if ANY ingredient has a target in it ---- */
    const mode = (m, prefix) => { const PR = dep('NR3DPresets', 'nr3dpresets'); const n = PR && PR.list(m).find(x => x.startsWith(prefix)); return n ? 'mode:' + m + ':' + n : null; };
    const allDiff = k => Object.keys(DIFF).map(m => 'diff:' + m + ':' + k);
    R.RECIPES = () => [
        { id: 'r_easy', name: 'Easygoing everything', about: 'Relaxed settings for every minigame and engine in your game.', items: allDiff('easy') },
        { id: 'r_hard', name: 'Hardcore everything', about: 'Fewer lives, meaner enemies, tighter timers across the board.', items: allDiff('hard') },
        { id: 'r_classic', name: 'Classic platformer hero', about: 'Super Mario World style run, P-speed and hold-to-jump.', items: ['phys:classic'] },
        { id: 'r_floaty', name: 'Floaty dream hero', about: 'Soft, long jumps. Good for cozy exploration.', items: ['phys:floaty'] },
        { id: 'r_snappy', name: 'Snappy action hero', about: 'Quick, tight controls for precision platforming.', items: ['phys:snappy'] },
        { id: 'r_sports', name: 'Sports-car racing', about: 'Top speed and feel from the GTA III sports car (Infernus).', items: ['veh:race:infernus', 'veh:combat:infernus'] },
        { id: 'r_hauler', name: 'Heavy hauler', about: 'Slow, heavy truck handling from the GTA III Linerunner.', items: ['veh:race:linerun', 'veh:combat:linerun'] },
        { id: 'r_taxi', name: 'City taxi', about: 'Family-car speed from the GTA III Taxi: fast enough, forgiving.', items: ['veh:race:taxi', 'veh:combat:taxi'] },
        { id: 'r_rookie_war', name: 'Boot camp shooter', about: 'Big shield and forgiving enemies for new players.', items: [mode('warfare3d', 'Rookie'), 'diff:fps:easy'] },
        { id: 'r_vet_war', name: 'Veteran war game', about: 'Thin shield and sharp AI.', items: [mode('warfare3d', 'Veteran'), 'diff:fps:hard'] },
        { id: 'r_wasteland', name: 'Wasteland survivor', about: 'Fallout 2 style stats and gunslinger pacing.', items: [mode('rpg3d', 'Wasteland Walker')] },
        { id: 'r_skatepro', name: 'Skate park pro', about: 'Big bowl, combo goals.', items: [mode('skate', 'Concrete Bowl')] },
        { id: 'r_franken1', name: 'Frankenstein: Mario hero + GTA sports car', about: 'The hero moves like Super Mario World; when the game switches to driving you get the GTA III Infernus.', items: ['phys:classic', 'veh:race:infernus'] },
        { id: 'r_franken2', name: 'Frankenstein: floaty hero + heavy truck + easy arcade', about: 'A gentle game: dreamy hero, slow truck, relaxed minigames.', items: ['phys:floaty', 'veh:race:linerun'].concat(allDiff('easy')) }
    ].map(r => Object.assign(r, { items: r.items.filter(Boolean) }));
    R.all = P => R.RECIPES().concat((P && P.recipes) || []);
    R.make = (P, name, ids, about, custom) => { P.recipes = P.recipes || []; const r = { id: 'u_' + Date.now().toString(36), name: String(name || 'My recipe').slice(0, 40), about: String(about || '').slice(0, 160), items: ids.slice(), custom: custom || [], mine: true }; P.recipes.push(r); return r; };
    R.exportRecipe = r => JSON.stringify({ nrRecipe: 1, name: r.name, about: r.about, items: r.items, custom: r.custom || [] });
    R.importRecipe = (P, text) => { const o = JSON.parse(text); if (!o || o.nrRecipe !== 1 || !Array.isArray(o.items)) throw new Error('That is not a Notareal recipe file.'); return R.make(P, o.name, o.items, o.about, o.custom); };
    /* the settings recipes can touch, as plain data (Advanced tab shows and edits this) */
    R.describe = P => { const o = {}; R.targets(P).forEach((t, i) => { o[(i + 1) + '. ' + t.label] = clean(t.obj); }); return o; };
    R.setFromDescribe = (P, obj) => { const tg = R.targets(P), keys = Object.keys(obj); keys.forEach((k, i) => { const t = tg[i]; if (!t || typeof obj[k] !== 'object' || obj[k] === null) return; for (const key of Object.keys(t.obj)) if (!(key in obj[k])) delete t.obj[key]; Object.assign(t.obj, obj[k]); }); return tg.length; };
    if (typeof module !== 'undefined' && module.exports) module.exports = R; else root.NRRecipes = R;
})(typeof self !== 'undefined' ? self : globalThis);

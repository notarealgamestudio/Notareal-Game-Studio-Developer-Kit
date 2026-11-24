/* nrbuilder.js (v1.1) - the "make me a game" builder. Works in node and in the editor, needs no AI.
 * The AI (nrai.js) only chooses WORDS and NUMBERS (title, genre, theme, level count); this file does all the building and proves
 * every level can be finished with the real level checker. Everything it makes is original: generated level layouts, music
 * transposed/re-timed from the library songs, art taken from the project it starts from (so it matches the kit's own graphics).
 *
 * Builder.fromBase(base, spec)   -> a complete notareal-project (platformer family)
 * Builder.tools(base)            -> the tool set an AI can call, one JSON step at a time (create, addLevel, setTheme, ...)
 * Builder.TEMPLATES / start(id)  -> see nrtemplates.js (one starter per genre) */
(function (root) {
    'use strict';
    const B = {}, NR = typeof require === 'function' && typeof module !== 'undefined' ? require('./nrkit.js') : root.NRKit;
    const rng = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
    const clone = o => JSON.parse(JSON.stringify(o));
    B.THEMES = {
        forest: { pits: .12, spikes: .05, enemy: ['walker', 'hopper'], shift: 0, words: ['Mossy', 'Fern', 'Hollow', 'Canopy', 'Creek'] },
        castle: { pits: .16, spikes: .10, enemy: ['walker', 'flyer'], shift: -2, words: ['Gate', 'Keep', 'Tower', 'Dungeon', 'Rampart'] },
        space: { pits: .22, spikes: .08, enemy: ['flyer', 'hopper'], shift: 5, words: ['Orbit', 'Comet', 'Crater', 'Nebula', 'Dock'] },
        cave: { pits: .18, spikes: .14, enemy: ['hopper', 'walker'], shift: -5, words: ['Echo', 'Crystal', 'Mine', 'Drip', 'Deep'] },
        city: { pits: .10, spikes: .04, enemy: ['walker', 'hopper', 'flyer'], shift: 2, words: ['Main St', 'Alley', 'Rooftop', 'Plaza', 'Subway'] },
        ice: { pits: .14, spikes: .10, enemy: ['hopper', 'flyer'], shift: 7, words: ['Frost', 'Glacier', 'Drift', 'Floe', 'Peak'] },
        fire: { pits: .20, spikes: .16, enemy: ['hopper', 'flyer'], shift: -3, words: ['Ember', 'Magma', 'Forge', 'Ash', 'Blaze'] },
        ocean: { pits: .08, spikes: .06, enemy: ['flyer', 'walker'], shift: 4, words: ['Reef', 'Dock', 'Tide', 'Cove', 'Deep'] },
        desert: { pits: .14, spikes: .12, enemy: ['walker', 'hopper'], shift: 1, words: ['Dune', 'Oasis', 'Ruins', 'Mesa', 'Canyon'] },
        factory: { pits: .16, spikes: .14, enemy: ['walker', 'flyer'], shift: -1, words: ['Belt', 'Furnace', 'Press', 'Vent', 'Control'] }
    };
    /* style presets used by the platformer-family templates */
    B.STYLES = {
        platformer: { physics: 'classic', coin: 1, enemy: 1, spring: 1, len: 1 },
        puzzle_platformer: { physics: 'floaty', coin: .6, enemy: .6, spring: 2, len: .9 },
        runner: { physics: 'snappy', coin: 1.4, enemy: .7, spring: .5, len: 1.7, runner: true },
        collectathon2d: { physics: 'floaty', coin: 2.4, enemy: .5, spring: 1.2, len: 1.1 },
        kids_first: { physics: 'floaty', coin: 1.5, enemy: .25, spring: 1, len: .8, gentle: true },
        platformer_3d: { physics: 'floaty', coin: 1.2, enemy: .8, spring: 1.2, len: 1 },
        skate: { physics: 'skate', coin: 2.2, enemy: .3, spring: 2.4, len: 1.5, runner: true },
        sidescroller_3d: { physics: 'classic', coin: 1, enemy: 1, spring: 1, len: 1 }
    };
    B.pickTheme = t => B.THEMES[t] ? t : (Object.keys(B.THEMES).find(k => String(t || '').toLowerCase().includes(k)) || 'forest');

    /* ---------------------------------------------------------------- one level */
    B.level = (base, o) => {
        const r = rng(o.seed || 1), T = B.THEMES[B.pickTheme(o.theme)], S = B.STYLES[o.style] || B.STYLES.platformer, d = o.difficulty == null ? .5 : o.difficulty;
        const W = Math.max(48, Math.min(400, Math.round((o.w || 120) * S.len))), H = 16, cols = base.tileset.cols, N = W * H, map = new Array(N).fill(0), objs = [];
        const find = (c, from = 1) => cols.findIndex((v, i) => i >= from && v === c), grass = find(1), dirt = cols.findIndex((v, i) => i > grass && v === 1), plat = find(2), spike = find(3);
        const gy = new Array(W).fill(12); let y = 12, x = 0;
        const flat = (n) => { for (let i = 0; i < n && x < W; i++, x++) gy[x] = y; };
        flat(10);
        while (x < W - 14) {
            const roll = r();
            if (roll < T.pits * (.6 + d) && !S.gentle) { const pw = 2 + Math.floor(r() * (d > .6 ? 3 : 2)); for (let i = 0; i < pw && x < W - 12; i++, x++) gy[x] = H + 1; flat(4 + Math.floor(r() * 3)); }
            else if (roll < .55) { const step = r() < .5 ? -1 : 1; y = Math.max(8, Math.min(13, y + step)); flat(6 + Math.floor(r() * 8)); }
            else flat(5 + Math.floor(r() * 9));
        }
        y = Math.max(y, 11); for (let i = x; i < W; i++) gy[i] = y; for (let i = Math.max(0, W - 12); i < W; i++) gy[i] = y;
        for (let cx = 0; cx < W; cx++) { if (gy[cx] > H) continue; map[gy[cx] * W + cx] = grass; for (let yy = gy[cx] + 1; yy < H; yy++) map[yy * W + cx] = dirt; }
        const groundTop = cx => gy[cx] <= H ? gy[cx] : null, put = (type, px, py, extra) => objs.push(Object.assign({ type, x: px, y: py }, extra || {}));
        objs.push({ type: 'start', x: 2, y: gy[2] - 2 });
        /* floating platforms, coins on them and along arcs, hazards, enemies, springs, hearts, checkpoints */
        let lastPlat = -99; for (let cx = 14; cx < W - 16; cx++) {
            const g = groundTop(cx); if (g === null) { if (plat > 0 && r() < .5) { const py = 9 + Math.floor(r() * 2); for (let i = -1; i <= 1; i++) if (map[py * W + cx + i] === 0 && groundTop(cx + i) === null) map[py * W + cx + i] = plat; } continue; }
            if (cx - lastPlat > 9 && r() < .09 && plat > 0) { const py = g - 3 - Math.floor(r() * 2), pw = 3 + Math.floor(r() * 3); for (let i = 0; i < pw; i++) if (map[py * W + cx + i] === 0) map[py * W + cx + i] = plat; for (let i = 0; i < pw; i++) put('coin', cx + i, py - 1); if (r() < .15) put('heart', cx + 1, py - 2); lastPlat = cx; continue; }
            if (cx % 5 === 0 && r() < .55 * S.coin) { for (let i = 0; i < 3; i++) put('coin', cx + i, g - 1 - (i === 1 ? 2 : 1) - (S.runner ? 0 : 0)); }
            if (cx > 18 && r() < .035 * S.enemy * (.5 + d) * 2 && groundTop(cx - 1) === g && groundTop(cx + 1) === g) { const pool = Math.max(1, Math.round(T.enemy.length * (o.t == null ? 1 : .65 + .35 * o.t))), t = T.enemy[Math.floor(r() * pool)]; put(t, cx, t === 'flyer' ? g - 4 : g - 1); }
            if (!S.gentle && spike > 0 && r() < T.spikes * .35 * (.5 + d) && cx > 20 && groundTop(cx - 1) === g && groundTop(cx + 1) === g && cx - lastPlat > 3) map[(g - 1) * W + cx] = spike;
            if (r() < .012 * S.spring && cx > 20) put('spring', cx, g - 1);
            if (cx % 40 === 0 && cx > 10) put('check', cx, g - 1);
        }
        put('goal', W - 6, gy[W - 6] - 2);
        const L = { name: o.name || 'Level', w: W, h: H, song: o.song || 0, map, objects: objs.filter(ob => !(ob.type !== 'start' && ob.type !== 'goal' && map[ob.y * W + ob.x] && cols[map[ob.y * W + ob.x]] === 1)) };
        return L;
    };

    /* ---------------------------------------------------------------- whole game */
    const transpose = (song, shift, name) => { const s = clone(song); s.name = name || s.name; s.ch = s.ch.map(ch => ch.map(n => (n > 0 && n < 128) ? Math.max(24, Math.min(100, n + shift)) : n)); return s; };
    B.fromBase = (base, spec = {}) => {
        const theme = B.pickTheme(spec.theme), T = B.THEMES[theme], style = B.STYLES[spec.genre] ? spec.genre : (B.STYLES[spec.style] ? spec.style : 'platformer'), S = B.STYLES[style], r = rng(spec.seed || 1), n = Math.max(1, Math.min(12, spec.levels || 3));
        const P = clone(base); P.console = spec.console && ['ds', 'snes'].includes(spec.console) ? spec.console : (P.console || 'ds'); P.preset = 'side2d';
        const ph = NR.PHYSICS[S.physics] || NR.PHYSICS.classic; P.meta = Object.assign({}, P.meta, { title: String(spec.title || 'My Game').slice(0, 30), author: String(spec.author || 'Notareal Game Studio').slice(0, 30), tagline: String(spec.tagline || ('A ' + theme + ' adventure')).slice(0, 60), lives: S.gentle ? 9 : 5, physics: Object.assign({ preset: S.physics }, ph) });
        const baseSongs = base.songs.filter((s, i) => i < base.songs.length - 1 || base.songs.length === 1), win = base.songs[base.songs.length - 1];
        P.songs = baseSongs.map((s, i) => transpose(s, T.shift, (T.words[i % T.words.length] || 'Theme') + ' ' + (spec.genre === 'runner' ? 'Rush' : 'Theme'))); P.songs.push(transpose(win, T.shift, 'Victory')); P.meta.titleSong = 0; P.meta.clearSong = P.songs.length - 1;
        P.levels = []; const w = (spec.levelWidth || 110);
        for (let i = 0; i < n; i++) {
            const tt = n === 1 ? 0 : i / (n - 1), d = n === 1 ? .4 : .2 + .6 * tt, name = (T.words[i % T.words.length] + (i >= T.words.length ? ' ' + (Math.floor(i / T.words.length) + 1) : '')).slice(0, 22);
            let L, tries = 0, chk; do { L = B.level(P, { theme, style, difficulty: spec.difficulty == null ? d : spec.difficulty, t: tt, w: Math.round(w * (1 + .22 * tt)), seed: (spec.seed || 1) * 131 + i * 17 + tries * 7919, name, song: i % Math.max(1, P.songs.length - 1) }); P.levels.push(L); chk = NR.autofixLevel(P, P.levels.length - 1); if (chk.ok) break; P.levels.pop(); tries++; } while (tries < 8);
            if (!chk.ok) { P.levels.pop(); L = B.level(P, { theme, style, difficulty: 0, w: 80, seed: 5 + i, name, song: 0 }); P.levels.push(L); NR.autofixLevel(P, P.levels.length - 1); }
        }
        P.theme = theme; P.genre = spec.genre || 'platformer'; P.story = spec.story || ''; P.cutscenes = spec.cutscenes || []; P.builtBy = 'nrbuilder 1.1';
        return P;
    };
    B.checkAll = P => P.levels.map((l, i) => { const c = NR.checkLevel(P, i); return { level: l.name, ok: c.ok, issues: c.issues.map(x => x.msg) }; });

    /* ---------------------------------------------------------------- tools for an AI: each call is one small JSON step */
    B.tools = base => {
        const S = { spec: { title: 'My Game', genre: 'platformer', theme: 'forest', levels: 3, seed: 1 }, project: null, log: [] };
        const T = {
            createGame(a) { Object.assign(S.spec, { title: String(a.title || S.spec.title).slice(0, 30), genre: a.genre || S.spec.genre, theme: B.pickTheme(a.theme || S.spec.theme), levels: Math.max(1, Math.min(12, +a.levels || S.spec.levels)), seed: +a.seed || S.spec.seed, tagline: a.tagline, story: a.story }); S.project = null; return { ok: true, spec: S.spec }; },
            setTheme(a) { S.spec.theme = B.pickTheme(a.theme); return { ok: true, theme: S.spec.theme }; },
            setDifficulty(a) { S.spec.difficulty = Math.max(0, Math.min(1, +a.value)); return { ok: true }; },
            build() { S.project = B.fromBase(base, S.spec); return { ok: true, levels: S.project.levels.length, check: B.checkAll(S.project) }; },
            addLevel(a) { if (!S.project) return { ok: false, error: 'call build first' }; const L = B.level(S.project, Object.assign({ theme: S.spec.theme, style: B.STYLES[S.spec.genre] ? S.spec.genre : 'platformer' }, a)); S.project.levels.push(L); const i = S.project.levels.length - 1, c = NR.autofixLevel(S.project, i); if (!c.ok) { S.project.levels.pop(); return { ok: false, error: 'could not make a finishable level' }; } return { ok: true, index: i }; },
            addCutscene(a) { if (!S.project) return { ok: false, error: 'call build first' }; (S.project.cutscenes = S.project.cutscenes || []).push({ type: a.type || 'narration', text: String(a.text || '').slice(0, 100), duration: +a.duration || 180, speaker: a.speaker || '' }); return { ok: true }; },
            applyOps(a) { if (!S.project) return { ok: false, error: 'call build first' }; return { ok: true, applied: NR.applyOps(S.project, Array.isArray(a.ops) ? a.ops : []) }; },
            validate() { return S.project ? { ok: true, check: B.checkAll(S.project) } : { ok: false, error: 'call build first' }; },
            exportProject() { return S.project ? { ok: true, project: S.project } : { ok: false, error: 'call build first' }; }
        };
        return { S, call(name, args) { if (!T[name]) return { ok: false, error: 'unknown tool ' + name }; let r; try { r = T[name](args || {}); } catch (e) { r = { ok: false, error: e.message }; } S.log.push({ tool: name, args, ok: r.ok }); return r; }, names: Object.keys(T) };
    };
    if (typeof module !== 'undefined') module.exports = B; else root.NRBuilder = B;
})(typeof window !== 'undefined' ? window : globalThis);

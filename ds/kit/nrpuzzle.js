/* nrpuzzle.js - puzzle engines that run offline in any browser.
 * PZ.match3(cfg, opts)   swap neighbouring gems, clear lines of 3+, gravity, refills, combos, move limit and score goal.
 * PZ.bracelet(cfg, opts) friendship-bracelet pattern game: copy the knot pattern row by row with the thread colours.
 * Both are plain state machines (headless, testable) plus PZ.play(canvas, mode, cfg, opts) for drawing + input. */
(function (root) {
    'use strict';
    const PZ = {};
    const rng = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
    PZ.GEMS = ['#e84a4a', '#4a9be8', '#4ae87a', '#f5c542', '#b04ae8', '#f58a42'];

    /* ---------------- match 3 ---------------- */
    PZ.MATCH3 = { title: 'Match-3', w: 8, h: 8, colors: 5, moves: 20, goal: 1000 };
    PZ.match3 = (cfg = {}, o = {}) => {
        const C = Object.assign({}, PZ.MATCH3, cfg), r = rng(o.seed || 7), S = { w: C.w, h: C.h, grid: [], score: 0, moves: C.moves, goal: C.goal, over: null, combo: 0 };
        const rnd = () => Math.floor(r() * C.colors), at = (x, y) => x < 0 || y < 0 || x >= S.w || y >= S.h ? -1 : S.grid[y * S.w + x];
        for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { let c; do { c = rnd(); } while ((x >= 2 && at(x - 1, y) === c && at(x - 2, y) === c) || (y >= 2 && at(x, y - 1) === c && at(x, y - 2) === c)); S.grid[y * S.w + x] = c; }
        const find = () => { const m = new Set(); for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { const c = at(x, y); if (c < 0) continue; let n = 1; while (at(x + n, y) === c) n++; if (n >= 3) for (let k = 0; k < n; k++) m.add(y * S.w + x + k); n = 1; while (at(x, y + n) === c) n++; if (n >= 3) for (let k = 0; k < n; k++) m.add((y + k) * S.w + x); } return m; };
        const settle = () => { let chain = 0, total = 0; for (;;) { const m = find(); if (!m.size) break; chain++; total += m.size * 10 * chain; for (const i of m) S.grid[i] = -1;
                for (let x = 0; x < S.w; x++) { let w = S.h - 1; for (let y = S.h - 1; y >= 0; y--) if (S.grid[y * S.w + x] >= 0) { S.grid[w * S.w + x] = S.grid[y * S.w + x]; if (w !== y) S.grid[y * S.w + x] = -1; w--; } for (let y = w; y >= 0; y--) S.grid[y * S.w + x] = rnd(); } }
            S.combo = chain; return total; };
        const possible = () => { for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) { const x2 = x + dx, y2 = y + dy; if (x2 >= S.w || y2 >= S.h) continue; const a = y * S.w + x, b = y2 * S.w + x2; [S.grid[a], S.grid[b]] = [S.grid[b], S.grid[a]]; const ok = find().size > 0; [S.grid[a], S.grid[b]] = [S.grid[b], S.grid[a]]; if (ok) return true; } return false; };
        const api = { state: S, cfg: C, at, possible,
            swap(x1, y1, x2, y2) { if (S.over) return 0; if (Math.abs(x1 - x2) + Math.abs(y1 - y2) !== 1 || at(x1, y1) < 0 || at(x2, y2) < 0) return 0; const a = y1 * S.w + x1, b = y2 * S.w + x2;
                [S.grid[a], S.grid[b]] = [S.grid[b], S.grid[a]]; if (!find().size) { [S.grid[a], S.grid[b]] = [S.grid[b], S.grid[a]]; return 0; }
                S.moves--; const pts = settle(); S.score += pts; let guard = 0; while (!possible() && guard++ < 20) for (let i = 0; i < S.grid.length; i++) S.grid[i] = rnd(), settle();
                if (S.score >= S.goal) S.over = { win: true, text: 'Goal reached!' }; else if (S.moves <= 0) S.over = { win: false, text: 'Out of moves' }; return pts; } };
        settle(); S.score = 0; return api;
    };

    /* ---------------- friendship bracelet ---------------- */
    PZ.PATTERNS = {
        chevron: (n, rows) => Array.from({ length: rows }, (_, y) => Array.from({ length: n }, (_, x) => { const d = Math.abs(x - (n - 1) / 2); return (Math.floor(d) + y) % 3; })),
        diagonal: (n, rows) => Array.from({ length: rows }, (_, y) => Array.from({ length: n }, (_, x) => (x + y) % 3)),
        candy: (n, rows) => Array.from({ length: rows }, (_, y) => Array.from({ length: n }, (_, x) => (x + (y >> 1)) % 2)),
        diamond: (n, rows) => Array.from({ length: rows }, (_, y) => Array.from({ length: n }, (_, x) => { const c = (n - 1) / 2, d = Math.abs(x - c) + Math.abs((y % (n + 1)) - c); return Math.min(2, Math.floor(d / 2)); })),
    };
    PZ.BRACELET = { title: 'Friendship bracelet', threads: 6, rows: 10, pattern: 'chevron', palette: ['#e84a8a', '#f5c542', '#4a9be8'], tries: 6 };
    PZ.bracelet = (cfg = {}, o = {}) => {
        const C = Object.assign({}, PZ.BRACELET, cfg), gen = PZ.PATTERNS[C.pattern] || PZ.PATTERNS.chevron, target = gen(C.threads, C.rows);
        const S = { target, rows: C.rows, n: C.threads, row: 0, built: [], cur: new Array(C.threads).fill(-1), tries: C.tries, mistakes: 0, over: null, score: 0 };
        const api = { state: S, cfg: C,
            paint(x, colorIdx) { if (S.over || x < 0 || x >= S.n || colorIdx < 0 || colorIdx >= C.palette.length) return false; S.cur[x] = colorIdx; return true; },
            check() { if (S.over) return null; if (S.cur.some(v => v < 0)) return { ok: false, reason: 'fill every thread first' }; const want = S.target[S.row], wrong = S.cur.filter((v, i) => v !== want[i]).length;
                if (wrong) { S.mistakes++; S.tries--; S.cur = new Array(S.n).fill(-1); if (S.tries <= 0) S.over = { win: false, text: 'The bracelet came out tangled' }; return { ok: false, wrong, tries: S.tries }; }
                S.built.push(S.cur.slice()); S.cur = new Array(S.n).fill(-1); S.row++; S.score += 100; if (S.row >= S.rows) { S.score += S.tries * 50; S.over = { win: true, text: 'Bracelet finished!' }; } return { ok: true, row: S.row }; },
            hint() { return S.over ? null : S.target[S.row].slice(); } };
        return api;
    };

    /* ---------------- drawing + input ---------------- */
    PZ.play = (cv, mode, cfg, opts = {}) => {
        const g = cv.getContext('2d'), W = cv.width, H = cv.height, keys = opts.keys || {}, pal = (cfg.palette && cfg.palette.length ? cfg.palette : PZ.GEMS);
        const G = mode === 'bracelet' ? PZ.bracelet(cfg, opts) : PZ.match3(cfg, opts), S = G.state; let cx = 0, cy = 0, sel = null, color = 0, cool = 0, msg = '', stopped = false, t = 0;
        const edge = k => { if (keys[k] && !edge['p' + k]) { edge['p' + k] = true; return true; } if (!keys[k]) edge['p' + k] = false; return false; };
        function update() { t++; const L = edge('ArrowLeft'), R = edge('ArrowRight'), U = edge('ArrowUp'), D = edge('ArrowDown'), A = edge('z'), B = edge('x'), Y = edge('c');
            if (mode === 'match3') { if (L) cx = Math.max(0, cx - 1); if (R) cx = Math.min(S.w - 1, cx + 1); if (U) cy = Math.max(0, cy - 1); if (D) cy = Math.min(S.h - 1, cy + 1);
                if (A) { if (!sel) sel = [cx, cy]; else { const p = G.swap(sel[0], sel[1], cx, cy); msg = p ? '+' + p + (S.combo > 1 ? ' combo x' + S.combo : '') : (Math.abs(sel[0] - cx) + Math.abs(sel[1] - cy) === 1 ? 'No match' : ''); sel = null; } } if (B) sel = null; }
            else { if (L) cx = Math.max(0, cx - 1); if (R) cx = Math.min(S.n - 1, cx + 1); if (U) color = (color + pal.length - 1) % pal.length; if (D) color = (color + 1) % pal.length; if (A) G.paint(cx, color); if (B) { const r = G.check(); msg = r ? (r.ok ? 'Nice knots!' : r.reason || `${r.wrong} wrong: ${r.tries} tries left`) : ''; } if (Y) { const h = G.hint(); if (h) { h.forEach((c, i) => G.paint(i, c)); S.score = Math.max(0, S.score - 20); msg = 'Hint used (-20)'; } } } }
        function draw() { g.fillStyle = '#10142a'; g.fillRect(0, 0, W, H); g.font = '10px monospace'; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText((cfg.title || mode), 6, 12);
            if (mode === 'match3') { const cs = Math.floor(Math.min((H - 40) / S.h, (W - 140) / S.w)), ox = 8, oy = 22; for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { const c = G.at(x, y); g.fillStyle = '#1b2142'; g.fillRect(ox + x * cs, oy + y * cs, cs - 1, cs - 1); if (c >= 0) { g.fillStyle = pal[c % pal.length]; g.beginPath(); g.arc(ox + x * cs + cs / 2, oy + y * cs + cs / 2, cs / 2 - 3, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(ox + x * cs + cs / 2 - 3, oy + y * cs + cs / 2 - 3, 3, 0, 7); g.fill(); } }
                g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(ox + cx * cs, oy + cy * cs, cs - 1, cs - 1); if (sel) { g.strokeStyle = '#ffe38a'; g.strokeRect(ox + sel[0] * cs + 2, oy + sel[1] * cs + 2, cs - 5, cs - 5); }
                const px = ox + S.w * cs + 12; g.fillStyle = '#fff'; g.fillText('Score ' + S.score, px, 36); g.fillText('Goal  ' + S.goal, px, 50); g.fillText('Moves ' + S.moves, px, 64); g.fillStyle = '#ffe38a'; g.fillText(msg, px, 90); }
            else { const cs = Math.min(18, Math.floor((W - 150) / S.n)), ox = 10, oy = 24; const shown = Math.min(S.rows, 8), top = Math.max(0, S.row - 3);
                g.fillStyle = '#9aa'; g.fillText('Pattern', ox, oy - 2); for (let i = 0; i < shown && top + i < S.rows; i++) { const ry = top + i; for (let x = 0; x < S.n; x++) { g.fillStyle = pal[S.target[ry][x]]; g.fillRect(ox + x * cs, oy + 4 + i * (cs - 2), cs - 2, cs - 4); } if (ry === S.row) { g.strokeStyle = '#ffe38a'; g.strokeRect(ox - 2, oy + 2 + i * (cs - 2), S.n * cs, cs - 1); } }
                const bx = ox + S.n * cs + 24; g.fillStyle = '#9aa'; g.fillText('Your bracelet', bx, oy - 2); const rows = S.built.concat([S.cur]); for (let i = Math.max(0, rows.length - 7); i < rows.length; i++) for (let x = 0; x < S.n; x++) { const v = rows[i][x]; g.fillStyle = v >= 0 ? pal[v] : '#1b2142'; g.fillRect(bx + x * cs, oy + 4 + (i - Math.max(0, rows.length - 7)) * (cs - 2), cs - 2, cs - 4); }
                const cur = S.row >= 0 ? 0 : 0; g.strokeStyle = '#fff'; g.strokeRect(bx + cx * cs - 1, oy + 3 + (Math.min(rows.length, 7) - 1) * (cs - 2), cs, cs - 2);
                for (let i = 0; i < pal.length; i++) { g.fillStyle = pal[i]; g.fillRect(8 + i * 22, H - 30, 18, 14); if (i === color) { g.strokeStyle = '#fff'; g.strokeRect(7 + i * 22, H - 31, 20, 16); } }
                g.fillStyle = '#fff'; g.fillText(`Score ${S.score}  Tries ${S.tries}`, 8, H - 38 - 4); g.fillStyle = '#ffe38a'; g.fillText(msg, 8, H - 4); }
            if (S.over) { g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(0, H / 2 - 22, W, 44); g.fillStyle = S.over.win ? '#9f9' : '#f99'; g.font = 'bold 16px monospace'; g.textAlign = 'center'; g.fillText(S.over.text, W / 2, H / 2 + 5); } }
        const api = { game: G, state: S, step(n = 1) { for (let i = 0; i < n; i++) update(); draw(); }, stop() { stopped = true; }, draw, cursor: () => ({ cx, cy, color }) };
        if (!opts.manual) { const loop = () => { if (stopped) return; update(); draw(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); } else draw();
        return api;
    };
    if (typeof module !== 'undefined') module.exports = PZ; else root.NRPuzzle = PZ;
})(typeof self !== 'undefined' ? self : this);

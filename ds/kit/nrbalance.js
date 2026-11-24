/* nrbalance.js (v1.2) - Auto-Balance: the kit PLAYS your arcade game with a "casual player" bot (it reacts late and makes mistakes)
 * hundreds of times and tunes the difficulty numbers until an ordinary player wins about as often as you asked for.
 *   Bal.simulate(mode, cfg, {runs, skill, seed}) -> {winRate, avgSeconds, avgScore}
 *   Bal.tune(mode, cfg, 'easy'|'normal'|'hard') -> {cfg, winRate, avgSeconds, t}      (Bal.TARGET = win rates) */
(function (root) {
    'use strict';
    const Bal = {}, node = typeof require === 'function' && typeof module !== 'undefined', A = node ? require('./nrarcade.js') : root.NRArcade;
    Bal.TARGET = { easy: .9, normal: .6, hard: .3 };
    const rng = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
    const near = (a, list, key) => list.reduce((b, e) => (!b || Math.abs(e[key || 'x'] - a) < Math.abs(b[key || 'x'] - a)) ? e : b, null);
    const BOT = {
        shmup: g => { const s = g.s, tgt = s.boss || near(s.px, s.en.filter(e => e.y > 0)), k = { z: 1 }, dodge = s.eb.find(b => b.y > s.py - 50 && b.y < s.py + 8 && Math.abs(b.x - s.px) < 14); if (dodge) { k[dodge.x < s.px ? 'ArrowRight' : 'ArrowLeft'] = 1; } else if (tgt) { if (tgt.x < s.px - 4) k.ArrowLeft = 1; else if (tgt.x > s.px + 4) k.ArrowRight = 1; } return k; },
        breakout: g => ({ z: 1, ArrowLeft: g.s.bx < g.s.px - 4, ArrowRight: g.s.bx > g.s.px + 4 }),
        race: g => ({ ArrowUp: Math.abs(g.s.x) < 1.2, ArrowDown: Math.abs(g.s.x) > 1.5, ArrowLeft: g.s.x > .08, ArrowRight: g.s.x < -.08 }),
        fps: g => { const s = g.s, e = s.en.filter(e => e.hp > 0).sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0], tx = e ? e.x : s.exit.x, ty = e ? e.y : s.exit.y, ang = Math.atan2(ty - s.y, tx - s.x), da = ((ang - s.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return { ArrowLeft: da < -.05, ArrowRight: da > .05, ArrowUp: Math.abs(da) < .5, z: e && Math.abs(da) < .12 }; },
        brawler: g => { const s = g.s, e = s.en[0] || s.boss; return e ? { ArrowLeft: e.x < s.px - 18, ArrowRight: e.x > s.px + 18, ArrowUp: e.y < s.py - 4, ArrowDown: e.y > s.py + 4, z: Math.abs(e.x - s.px) < 28 && Math.abs(e.y - s.py) < 14 } : {}; },
        hoops: (g, rnd, skill) => ({ z: !g.s.ball && Math.abs(g.s.meter - 62) < 3 + (1 - skill) * 14 }),
        memory: (g, rnd, skill) => { const s = g.s, C = g.C; if (s.wait > 0) return {}; const need = s.up.length === 1 ? g.s.deck.findIndex((v, i) => v === s.deck[s.up[0]] && i !== s.up[0] && !s.found.has(i)) : g.s.deck.findIndex((v, i) => !s.found.has(i)); let target = need < 0 ? 0 : need; if (rnd() > .55 + skill * .45 && s.up.length === 1) target = s.deck.findIndex((v, i) => !s.found.has(i) && !s.up.includes(i) && v !== s.deck[s.up[0]]); if (target < 0) target = 0; const tx = target % C.cols, ty = Math.floor(target / C.cols), cx = s.cur % C.cols, cy = Math.floor(s.cur / C.cols); if (cx < tx) return { ArrowRight: 1 }; if (cx > tx) return { ArrowLeft: 1 }; if (cy < ty) return { ArrowDown: 1 }; if (cy > ty) return { ArrowUp: 1 }; return { z: 1 }; },
        sim: g => { const s = g.s; if (!g._plan) { g._plan = []; const put = (x, y, t) => g._plan.push([x, y, t]); for (let x = 0; x < 8; x++) put(x, 3, 0); for (let x = 0; x < 8; x++) { put(x, 2, 1); put(x, 4, 2); } put(8, 3, 3); for (let x = 0; x < 8; x++) { put(x, 1, 1); put(x, 5, 1); } g._ph = 0; }
            if (!g._plan.length) return {}; const [x, y, t] = g._plan[0]; if (s.cx < x) return g._ph++ % 2 ? {} : { ArrowRight: 1 }; if (s.cx > x) return g._ph++ % 2 ? {} : { ArrowLeft: 1 }; if (s.cy < y) return g._ph++ % 2 ? {} : { ArrowDown: 1 }; if (s.cy > y) return g._ph++ % 2 ? {} : { ArrowUp: 1 }; if (s.sel !== t) return g._ph++ % 2 ? {} : { x: 1 }; if (A.BUILD[t].c > s.cash) return {}; if (g._ph++ % 2) return {}; g._plan.shift(); return { z: 1 }; },
        falling: g => { const s = g.s, C = g.C; if (!s.p) return {}; if (g._p !== s.p) { g._p = s.p; let best = null, m = s.p.m; for (let r = 0; r < 4; r++) { for (let x = -2; x < C.w; x++) { if (!g.fits(m, x, 0)) continue; let y = 0; while (g.fits(m, x, y + 1)) y++; const b = s.b.map(r2 => r2.slice()); m.forEach((row, j) => row.forEach((v, i) => { if (v && y + j >= 0) b[y + j][x + i] = 1; })); let h = 0, holes = 0, full = 0; for (let cx = 0; cx < C.w; cx++) { let top = -1; for (let cy = 0; cy < C.h; cy++) { if (b[cy][cx]) { if (top < 0) top = cy; } else if (top >= 0) holes++; } h += top < 0 ? 0 : C.h - top; } for (const row of b) if (row.every(v => v)) full++; const sc = full * 8 - h * .5 - holes * 4; if (!best || sc > best.sc) best = { sc, r, x }; } m = m[0].map((_, i) => m.map(row => row[i]).reverse()); } g._acts = []; for (let r = 0; r < best.r; r++) g._acts.push('ArrowUp'); const dx = best.x - s.px; for (let i = 0; i < Math.abs(dx); i++) g._acts.push(dx < 0 ? 'ArrowLeft' : 'ArrowRight'); g._ph = 0; }
            g._ph++; if (g._acts.length && g._ph % 2) { return { [g._acts.shift()]: 1 }; } if (!g._acts.length) return { ArrowDown: 1 }; return {}; },
        paint: g => ({})
    };
    const KNOBS = {
        shmup: t => ({ enemyHp: Math.round(1 + t * 5), lives: Math.round(5 - t * 3) }), breakout: t => ({ ballSpeed: +(2 + t * 3.5).toFixed(1), paddle: Math.round(64 - t * 34), lives: Math.round(5 - t * 3) }), race: t => ({ timeLimit: Math.round(130 - t * 75), laneCars: Math.round(4 + t * 14) }),
        fps: t => ({ enemies: Math.round(3 + t * 9), health: Math.round(140 - t * 70), ammo: Math.round(60 - t * 25) }), brawler: t => ({ enemyHp: Math.round(1 + t * 5), lives: Math.round(5 - t * 3) }), falling: t => ({ startSpeed: Math.round(45 - t * 30), goalLines: Math.round(8 + t * 22) }),
        memory: (t, c) => ({ tries: Math.round((c.pairs || 8) * (2.6 - 1.7 * t)) }), sim: t => ({ goalPop: Math.round(60 + t * 160), cash: Math.round(900 - t * 500) }), hoops: t => ({ meterSpeed: +(1.2 + t * 3.4).toFixed(1), goal: Math.round(6 + t * 12) }), paint: () => ({})
    };
    Bal.simulate = (mode, cfg, o = {}) => {
        const runs = o.runs || 12, skill = o.skill == null ? .75 : o.skill, max = o.maxFrames || { sim: 60000, fps: 9000, race: 9000, shmup: 12000, breakout: 20000, brawler: 20000, falling: 20000, memory: 6000, hoops: 8000, paint: 100 }[mode] || 12000; let wins = 0, frames = 0, score = 0;
        for (let r = 0; r < runs; r++) { const rnd = rng((o.seed || 1) * 9973 + r * 31), g = A.create(mode, cfg, { seed: (o.seed || 1) * 7 + r }); let k = {}, n = 0; for (; n < max && g.s.status === 'play'; n++) { if (rnd() < skill || n === 0) k = BOT[mode](g, rnd, skill) || {}; g.step(k); } if (g.s.status === 'win') wins++; frames += n; score += g.s.score; }
        return { winRate: wins / runs, avgSeconds: Math.round(frames / runs / 60), avgScore: Math.round(score / runs) };
    };
    Bal.tune = (mode, cfg, level, o = {}) => {
        if (Bal.MODES.indexOf(mode) < 0) throw new Error('no balance knobs for ' + mode); const target = Bal.TARGET[level] == null ? +level : Bal.TARGET[level], base = Object.assign({}, A.DEFAULTS[mode], cfg); let lo = 0, hi = 1, best = null;
        for (let i = 0; i < 7; i++) { const t = (lo + hi) / 2, c = Object.assign({}, base, KNOBS[mode](t, base)), r = Bal.simulate(mode, c, o); if (!best || Math.abs(r.winRate - target) < Math.abs(best.r.winRate - target)) best = { t, c, r }; if (r.winRate > target) lo = t; else hi = t; }
        return { cfg: best.c, t: best.t, winRate: best.r.winRate, avgSeconds: best.r.avgSeconds, target };
    };
    Bal.MODES = ['shmup', 'race', 'falling']; // bots proven to move the win rate; other modes are not offered yet (honest scope)
    if (typeof module !== 'undefined') module.exports = Bal; else root.NRBalance = Bal;
})(typeof window !== 'undefined' ? window : globalThis);

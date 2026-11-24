/* nrroom.js (v1.21) - the ARCADE ROOM and two more machine games.
 *   room     : a walkable arcade. Walk up to a machine, press Z, spend a token, play ANY arcade engine (or your own settings of it) and win tickets.
 *              Exit through the door at the bottom. Machines are plain data (cfg.machines = [{x,y,label,mode,cfg}]) so the Timeline editor can place them.
 *   airhockey: first to N goals against a CPU paddle (arrows move, Z smash).
 *   claw     : claw machine - move, Z drops the claw, grab prizes before the tries run out.
 * Same contract as every engine: g = A.create(mode, cfg, {seed}); g.step(keys); g.draw(ctx); g.s = {status, score, ...}. Esc leaves a machine. */
(function (root) {
    'use strict';
    const isNode = typeof module !== 'undefined' && typeof require !== 'undefined';
    const A = isNode ? require('./nrarcade.js') : root.NRArcade, W = A.W, H = A.H, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const rng = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
    const ax = k => (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0), ay = k => (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0);
    const text = (g, t, x, y, c, s, al) => { g.font = (s || 10) + 'px monospace'; g.fillStyle = c || '#fff'; g.textAlign = al || 'left'; g.fillText(t, x, y); };
    const endCard = (g, s) => { if (s.status === 'play') return; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, H / 2 - 24, W, 48); text(g, s.status === 'win' ? 'YOU WIN!' : 'GAME OVER', W / 2, H / 2 + 4, s.status === 'win' ? '#7f7' : '#f77', 16, 'center'); };

    /* ------------------------------------------------------------ the machines in a default room */
    const MACHINES = [
        { x: 50, y: 70, label: 'BLOCK DROP', mode: 'falling', cfg: { goalLines: 6 } },
        { x: 110, y: 70, label: 'BRICKS', mode: 'breakout', cfg: { rows: 3 } },
        { x: 170, y: 70, label: 'MEMORY', mode: 'memory', cfg: { pairs: 6 } },
        { x: 230, y: 70, label: 'AIR HOCKEY', mode: 'airhockey', cfg: { goal: 3 } },
        { x: 90, y: 140, label: 'CLAW', mode: 'claw', cfg: {} },
        { x: 150, y: 140, label: 'HOOPS', mode: 'hoops', cfg: { seconds: 30, goal: 5 } },
        { x: 210, y: 140, label: 'STAR RUN', mode: 'shmup', cfg: { waves: 2, boss: 0 } },
        { x: 270, y: 140, label: 'BASEBALL', mode: 'baseball', cfg: { innings: 1 } }
    ];
    A.ROOM_MACHINES = MACHINES;
    A.DEFAULTS.room = { title: 'Arcade Room', tokens: 6, goalTickets: 0, ticketsPerPoint: .1, color: '#3a2a6a', color2: '#ff5ad8', machines: MACHINES };
    A.MODES.room = { name: 'Arcade room (walk around, play machines, win tickets)', controls: 'D-pad walk, Z play the machine you stand at, Esc leave a machine, walk into the door to leave the room', genres: ['arcade_room', 'minigames'] };
    A.DEFAULTS.airhockey = { title: 'Air Hockey', goal: 5, cpuSkill: 1, seconds: 90, color: '#4ae8ff', color2: '#ff5a5a' };
    A.MODES.airhockey = { name: 'Air hockey', controls: 'D-pad move the paddle, Z smash', genres: ['minigames'] };
    A.DEFAULTS.claw = { title: 'Claw Machine', tries: 5, goalPrizes: 2, grip: .7, prizes: 9, color: '#ff7aa8', color2: '#f5c542' };
    A.MODES.claw = { name: 'Claw machine', controls: 'Left/Right move the claw, Z drop it', genres: ['minigames'] };

    /* ------------------------------------------------------------ room */
    A.room = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.room, cfg), r = rng(o.seed || 1), ms = (C.machines || MACHINES).filter(m => m && A.MODES[m.mode] && m.mode !== 'room' && A.DEFAULTS[m.mode]);
        const s = { status: 'play', score: 0, tokens: C.tokens, tickets: 0, x: W / 2, y: H - 40, face: 'up', inner: null, innerM: null, hold: 0, msg: '', msgT: 0, plays: 0, last: {}, t: 0 }, DOOR = { x: W / 2 - 22, y: H - 14, w: 44, h: 14 };
        const edge = (k, n) => { const v = !!k[n], w = !!s.last[n]; s.last[n] = v; return v && !w; };
        const near = () => { let best = null, bd = 34; for (const m of ms) { const d = Math.hypot(m.x - s.x, m.y + 8 - s.y); if (d < bd) { bd = d; best = m; } } return best; };
        const say = t => { s.msg = t; s.msgT = 90; };
        const blocked = (x, y) => ms.some(m => Math.abs(x - m.x) < 15 && y > m.y - 14 && y < m.y + 14) || x < 10 || x > W - 10 || y < 28 || y > H - 4;
        return { s, C, machines: ms, step(k) {
            if (s.status !== 'play') return; s.t++; const z = edge(k, 'z'), esc = edge(k, 'Escape');
            if (s.inner) {
                const G = s.inner;
                if (G.s.status === 'play') { if (esc) { G.s.status = 'lose'; } else G.step(k); }
                if (G.s.status !== 'play') { s.hold++; if (s.hold > 50 && (z || s.hold > 240 || esc)) { const pts = (G.s.score | 0) * C.ticketsPerPoint, got = Math.max(G.s.status === 'win' ? 3 : 0, Math.round(pts)); s.tickets += got; s.score = s.tickets * 10; say(got ? '+' + got + ' tickets' : 'no tickets'); s.inner = null; s.innerM = null; s.hold = 0; } }
                return; }
            const sp = 1.7, dx = ax(k) * sp, dy = ay(k) * sp; if (dx) s.face = dx > 0 ? 'right' : 'left'; if (dy) s.face = dy > 0 ? 'down' : 'up';
            if (!blocked(s.x + dx, s.y)) s.x += dx; if (!blocked(s.x, s.y + dy) || s.y + dy > H - 4) s.y = clamp(s.y + dy, 28, H - 2);
            if (s.msgT > 0) s.msgT--;
            const m = near(); if (z && m) { if (s.tokens <= 0) say('Out of tokens!'); else { s.tokens--; s.plays++; s.innerM = m; s.hold = 0; s.inner = A.create(m.mode, Object.assign({}, m.cfg), { seed: ((o.seed || 1) * 31 + s.plays * 7919) >>> 0 }); } }
            if (s.y > H - 10 && s.x > DOOR.x && s.x < DOOR.x + DOOR.w) { if (s.tickets >= (C.goalTickets | 0)) s.status = 'win'; else { s.y = H - 22; say('Need ' + C.goalTickets + ' tickets to leave (you have ' + s.tickets + ')'); } }
            if (s.tokens <= 0 && !s.inner && s.tickets < (C.goalTickets | 0) && s.t > 60) { /* stuck: no tokens and short on tickets */ s.status = 'lose'; }
        }, draw(g) {
            if (s.inner) { s.inner.draw(g); text(g, s.innerM.label + (s.inner.s.status === 'play' ? '   Esc: leave' : '   Z: back to the room'), 4, H - 4, '#ff9', 8); text(g, 'TOKENS ' + s.tokens + '  TICKETS ' + s.tickets, W - 4, H - 4, '#fff', 8, 'right'); return; }
            g.fillStyle = '#17112b'; g.fillRect(0, 0, W, H); const c1 = C.color; for (let y = 28; y < H; y += 16) for (let x = 0; x < W; x += 16) { g.fillStyle = ((x + y) / 16) & 1 ? c1 : '#2a1f4f'; g.fillRect(x, y, 16, 16); }
            g.fillStyle = '#0d0a1c'; g.fillRect(0, 0, W, 28); const neon = (s.t >> 4) & 1; text(g, C.title.toUpperCase(), W / 2, 19, neon ? C.color2 : '#fff', 14, 'center');
            for (const m of ms) { const lit = (s.t + m.x) % 40 < 20; g.fillStyle = '#222'; g.fillRect(m.x - 13, m.y - 14, 26, 30); g.fillStyle = '#444'; g.fillRect(m.x - 13, m.y - 14, 26, 4); g.fillStyle = lit ? C.color2 : '#7a2a6a'; g.fillRect(m.x - 9, m.y - 8, 18, 12); g.fillStyle = '#111'; g.fillRect(m.x - 9, m.y + 6, 18, 6); g.fillStyle = '#e44'; g.fillRect(m.x - 5, m.y + 8, 3, 3); g.fillStyle = '#4e4'; g.fillRect(m.x + 2, m.y + 8, 3, 3); text(g, m.label, m.x, m.y + 26, '#bbb', 6, 'center'); }
            g.fillStyle = '#3a2410'; g.fillRect(DOOR.x, H - 8, DOOR.w, 8); text(g, 'EXIT', W / 2, H - 1, '#ffd070', 7, 'center');
            const px = s.x, py = s.y, bob = (s.t >> 3) & 1; g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(px - 6, py + 8, 12, 3); g.fillStyle = '#3c78d8'; g.fillRect(px - 5, py - 2, 10, 10); g.fillStyle = '#2b3350'; g.fillRect(px - 5, py + 6 + bob, 4, 3); g.fillRect(px + 1, py + 6 + (1 - bob), 4, 3); g.fillStyle = '#e0b090'; g.fillRect(px - 4, py - 10, 8, 8); g.fillStyle = '#2a1d14'; g.fillRect(px - 4, py - 11, 8, 3);
            const m = near(); if (m) text(g, 'Z: play ' + m.label + (s.tokens > 0 ? '' : '  (no tokens)'), W / 2, H - 16, '#ffe', 9, 'center');
            text(g, 'TOKENS ' + s.tokens, 4, 40, '#ffd070', 8); text(g, 'TICKETS ' + s.tickets + (C.goalTickets ? '/' + C.goalTickets : ''), W - 4, 40, '#7ff', 8, 'right'); if (s.msgT > 0) text(g, s.msg, W / 2, 56, '#fff', 10, 'center'); endCard(g, s); } };
    };

    /* ------------------------------------------------------------ air hockey */
    A.airhockey = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.airhockey, cfg), r = rng(o.seed || 1), TW = 300, TH = 200, X0 = 10, Y0 = 20, GOALW = 70, PR = 12, UR = 8;
        const s = { status: 'play', score: 0, me: 0, cpu: 0, t: C.seconds * 60, px: X0 + 40, py: Y0 + TH / 2, cx: X0 + TW - 40, cy: Y0 + TH / 2, bx: X0 + TW / 2, by: Y0 + TH / 2, vx: 0, vy: 0, serve: 60, last: {}, msg: '', smash: 0 };
        const reset = side => { s.bx = X0 + TW / 2; s.by = Y0 + TH / 2; s.vx = side * (1.2 + r()); s.vy = (r() - .5) * 2; s.serve = 50; };
        const hit = (hx, hy, pad, pvx, pvy, boost) => { const dx = s.bx - hx, dy = s.by - hy, d = Math.hypot(dx, dy); if (d < PR + UR && d > 0) { const nx = dx / d, ny = dy / d, rel = (s.vx - pvx) * nx + (s.vy - pvy) * ny; if (rel < 0) { s.vx -= 2 * rel * nx; s.vy -= 2 * rel * ny; } const sp = Math.hypot(s.vx, s.vy), want = Math.min(7.5, Math.max(sp, 2.2) * 1.08 + boost); s.vx = s.vx / (sp || 1) * want; s.vy = s.vy / (sp || 1) * want; s.bx = hx + nx * (PR + UR + .5); s.by = hy + ny * (PR + UR + .5); } };
        reset(-1);
        return { s, C, step(k) {
            if (s.status !== 'play') return; s.t--; const ox = s.px, oy = s.py, z = !!k.z && !s.last.z; s.last.z = !!k.z; if (z) s.smash = 14; s.smash--;
            s.px = clamp(s.px + ax(k) * 3.2, X0 + PR, X0 + TW / 2 - PR); s.py = clamp(s.py + ay(k) * 3.2, Y0 + PR, Y0 + TH - PR); if (k.ptr) { s.px = clamp(k.ptr.x, X0 + PR, X0 + TW / 2 - PR); s.py = clamp(k.ptr.y, Y0 + PR, Y0 + TH - PR); }
            const pvx = s.px - ox, pvy = s.py - oy;
            /* CPU: defend its half, hit the puck back when it is close */
            const ocx = s.cx, ocy = s.cy, spd = 1.8 * C.cpuSkill; let tx = X0 + TW - 30, ty = Y0 + TH / 2; if (s.bx > X0 + TW / 2 - 10 || s.vx > 0) { ty = s.by; tx = s.bx > X0 + TW / 2 && Math.abs(s.bx - s.cx) < 70 ? s.bx + 10 : X0 + TW - 40; } s.cx += clamp(tx - s.cx, -spd, spd); s.cy += clamp(ty - s.cy, -spd, spd); s.cx = clamp(s.cx, X0 + TW / 2 + PR, X0 + TW - PR); s.cy = clamp(s.cy, Y0 + PR, Y0 + TH - PR);
            if (s.serve > 0) { s.serve--; } else { s.bx += s.vx; s.by += s.vy; s.vx *= .9985; s.vy *= .9985; }
            hit(s.px, s.py, 'p', pvx, pvy, s.smash > 0 ? 2.2 : 0); hit(s.cx, s.cy, 'c', s.cx - ocx, s.cy - ocy, 0);
            if (s.by < Y0 + UR) { s.by = Y0 + UR; s.vy = Math.abs(s.vy); } if (s.by > Y0 + TH - UR) { s.by = Y0 + TH - UR; s.vy = -Math.abs(s.vy); }
            const inGoal = Math.abs(s.by - (Y0 + TH / 2)) < GOALW / 2;
            if (s.bx < X0 + UR) { if (inGoal) { s.cpu++; s.msg = 'CPU SCORES'; reset(-1); } else { s.bx = X0 + UR; s.vx = Math.abs(s.vx); } }
            if (s.bx > X0 + TW - UR) { if (inGoal) { s.me++; s.score += 10; s.msg = 'GOAL!'; reset(1); } else { s.bx = X0 + TW - UR; s.vx = -Math.abs(s.vx); } }
            if (s.me >= C.goal) { s.status = 'win'; s.score += 20; } else if (s.cpu >= C.goal) s.status = 'lose'; else if (s.t <= 0) { s.status = s.me > s.cpu ? 'win' : 'lose'; }
        }, draw(g) {
            g.fillStyle = '#10243a'; g.fillRect(0, 0, W, H); g.fillStyle = '#d8f0ff'; g.fillRect(X0, Y0, TW, TH); g.strokeStyle = '#7ac'; g.lineWidth = 2; g.strokeRect(X0, Y0, TW, TH); g.beginPath(); g.moveTo(X0 + TW / 2, Y0); g.lineTo(X0 + TW / 2, Y0 + TH); g.stroke(); g.beginPath(); g.arc(X0 + TW / 2, Y0 + TH / 2, 28, 0, 7); g.stroke();
            g.fillStyle = '#2a2a2a'; g.fillRect(X0 - 4, Y0 + TH / 2 - GOALW / 2, 5, GOALW); g.fillRect(X0 + TW - 1, Y0 + TH / 2 - GOALW / 2, 5, GOALW);
            for (const [x, y, c] of [[s.px, s.py, C.color], [s.cx, s.cy, C.color2]]) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x + 2, y + 2, PR, 0, 7); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(x, y, PR, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x - 3, y - 3, 4, 0, 7); g.fill(); }
            g.fillStyle = '#111'; g.beginPath(); g.arc(s.bx, s.by, UR, 0, 7); g.fill();
            text(g, 'YOU ' + s.me + '  -  ' + s.cpu + ' CPU   TIME ' + Math.ceil(s.t / 60), W / 2, 14, '#fff', 10, 'center'); if (s.serve > 0 && s.msg) text(g, s.msg, W / 2, Y0 + 20, '#c33', 12, 'center'); endCard(g, s); } };
    };

    /* ------------------------------------------------------------ claw machine */
    A.claw = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.claw, cfg), r = rng(o.seed || 1), FX = 24, FY = 40, FW = 220, FH = 170, CH = { x: FX + FW + 10, y: FY + FH - 44, w: 54, h: 44 };
        const cols = ['#ff7aa8', '#7ad4ff', '#ffd25a', '#8bff7a', '#c89bff', '#ff9a5a'];
        const prizes = []; for (let i = 0; i < C.prizes; i++) prizes.push({ x: FX + 20 + r() * (FW - 40), y: FY + FH - 18 - (i % 3) * 7, c: cols[i % cols.length], kind: i % 3, got: false });
        const s = { status: 'play', score: 0, tries: C.tries, got: 0, cx: FX + FW / 2, cy: FY + 14, phase: 'aim', grab: null, last: {}, msg: '', msgT: 0, t: 0, open: 1 };
        return { s, C, step(k) {
            if (s.status !== 'play') return; s.t++; if (s.msgT > 0) s.msgT--; const z = !!k.z && !s.last.z; s.last.z = !!k.z;
            if (s.phase === 'aim') { s.cx = clamp(s.cx + ax(k) * 2, FX + 12, FX + FW - 12); if (z) s.phase = 'down'; }
            else if (s.phase === 'down') { s.cy += 2.2; s.open = 1; if (s.cy >= FY + FH - 30) s.phase = 'close'; }
            else if (s.phase === 'close') { s.open = Math.max(0, s.open - .06); if (s.open <= 0) { let b = null, bd = 16; for (const p of prizes) if (!p.got) { const d = Math.hypot(p.x - s.cx, p.y - (s.cy + 8)); if (d < bd) { bd = d; b = p; } } if (b) { s.grab = b; s.slip = r() > C.grip ? FY + 40 + r() * 60 : -1; } s.phase = 'up'; } }
            else if (s.phase === 'up') { s.cy -= 1.6; if (s.grab) { s.grab.x = s.cx; s.grab.y = s.cy + 14; if (s.slip > 0 && s.cy < s.slip) { s.grab.fall = true; s.grab = null; s.slip = -1; s.msg = 'IT SLIPPED!'; s.msgT = 70; } } if (s.cy <= FY + 14) { s.cy = FY + 14; s.phase = 'across'; } }
            else if (s.phase === 'across') { const tx = CH.x + 8; s.cx += clamp(tx - s.cx, -2.4, 2.4); if (Math.abs(s.cx - tx) < 1) { s.phase = 'drop'; } if (s.grab) { s.grab.x = s.cx; s.grab.y = s.cy + 14; } }
            else if (s.phase === 'drop') { s.open = Math.min(1, s.open + .1); if (s.grab) { s.grab.y += 3; if (s.grab.y > CH.y + 20) { s.grab.got = true; s.got++; s.score += 25; s.grab = null; s.msg = 'GOT ONE!'; s.msgT = 70; } } else if (s.open >= 1) { s.phase = 'back'; } if (s.open >= 1 && !s.grab) s.phase = 'back'; }
            else if (s.phase === 'back') { s.cx += clamp(FX + FW / 2 - s.cx, -3, 3); if (Math.abs(s.cx - (FX + FW / 2)) < 2) { s.tries--; s.phase = 'aim'; } }
            for (const p of prizes) if (p.fall && !p.got) { p.y += 3; const floor = FY + FH - 14; if (p.y >= floor) { p.y = floor; p.fall = false; } }
            if (s.got >= C.goalPrizes) { s.status = 'win'; s.score += 25; } else if (s.tries <= 0 && s.phase === 'aim') s.status = s.got >= C.goalPrizes ? 'win' : 'lose';
        }, draw(g) {
            g.fillStyle = '#2a1840'; g.fillRect(0, 0, W, H); g.fillStyle = '#a4d8f0'; g.fillRect(FX, FY, FW, FH); g.fillStyle = '#d9a35a'; g.fillRect(FX, FY + FH - 12, FW, 12); g.strokeStyle = '#eee'; g.lineWidth = 3; g.strokeRect(FX, FY, FW, FH);
            g.fillStyle = '#222'; g.fillRect(CH.x, CH.y, CH.w, CH.h); text(g, 'PRIZE', CH.x + CH.w / 2, CH.y + 16, C.color2, 8, 'center'); g.fillStyle = '#000'; g.fillRect(CH.x + 8, CH.y + 20, CH.w - 16, CH.h - 22);
            for (const p of prizes) { if (p.got) continue; g.fillStyle = p.c; if (p.kind === 0) { g.beginPath(); g.arc(p.x, p.y, 8, 0, 7); g.fill(); g.fillStyle = '#222'; g.fillRect(p.x - 3, p.y - 2, 2, 2); g.fillRect(p.x + 2, p.y - 2, 2, 2); } else if (p.kind === 1) { g.fillRect(p.x - 7, p.y - 7, 14, 14); g.fillStyle = '#fff'; g.fillRect(p.x - 4, p.y - 3, 3, 3); g.fillRect(p.x + 2, p.y - 3, 3, 3); } else { g.beginPath(); g.moveTo(p.x, p.y - 9); g.lineTo(p.x + 8, p.y + 7); g.lineTo(p.x - 8, p.y + 7); g.fill(); } }
            g.strokeStyle = '#ddd'; g.lineWidth = 2; g.beginPath(); g.moveTo(s.cx, FY); g.lineTo(s.cx, s.cy); g.stroke(); const sp = 6 + s.open * 8; g.strokeStyle = C.color; g.lineWidth = 3; g.beginPath(); g.moveTo(s.cx - sp, s.cy + 16); g.lineTo(s.cx - 3, s.cy + 2); g.lineTo(s.cx + 3, s.cy + 2); g.lineTo(s.cx + sp, s.cy + 16); g.stroke();
            if (s.msgT > 0) text(g, s.msg, W / 2, 30, '#fff', 12, 'center'); text(g, 'TRIES ' + s.tries + '   PRIZES ' + s.got + '/' + C.goalPrizes, 4, 12, '#fff', 9); text(g, 'SCORE ' + s.score, W - 4, 12, '#fff', 9, 'right'); endCard(g, s); } };
    };
    if (isNode) module.exports = A; else root.NRArcade = A;
})(typeof window !== 'undefined' ? window : globalThis);

/* nrarcade.js (v1.1) - eight more game engines that run offline in any browser / the desktop window, and export to PC like the
 * puzzle and world engines. Every engine is a plain state machine (headless, testable): g = A.create(mode, cfg, {seed});
 * g.step(keys) once per 1/60 s, g.draw(ctx), g.s = state {status:'play'|'win'|'lose', score, lives, ...}.
 * keys: ArrowLeft/Right/Up/Down, z (A / fire), x (B), c (Y).
 * Modes: shmup, breakout, race, fps, brawler, falling, memory, sim, hoops.
 * Shapes are drawn with code so a game works the moment it is created; the Graphics tab colours (cfg.color / cfg.color2) restyle it. */
(function (root) {
    'use strict';
    const A = {}, W = 320, H = 240; A.W = W; A.H = H;
    const rng = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v, dist = (a, b, c, d) => Math.hypot(a - c, b - d), ax = k => (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0), ay = k => (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0);
    A.DEFAULTS = {
        shmup: { title: 'Star Run', lives: 3, speed: 3, fireRate: 8, waves: 6, enemyHp: 1, boss: 1, color: '#4ae8ff', color2: '#ff5a5a' },
        breakout: { title: 'Brick Smash', lives: 3, rows: 5, cols: 10, ballSpeed: 3, paddle: 48, color: '#f5c542', color2: '#4a9be8' },
        race: { title: 'Road Rush', laps: 2, laneCars: 10, maxSpeed: 200, timeLimit: 90, curves: 6, color: '#ff8a42', color2: '#4ae87a' },
        fps: { title: 'Corridor Ops', size: 16, enemies: 6, health: 100, ammo: 40, damage: 2, color: '#8b8bff', color2: '#ff5a5a' },
        brawler: { title: 'Street Brawl', lives: 3, waves: 4, enemyHp: 3, boss: 1, color: '#ffcf5a', color2: '#e84a4a' },
        falling: { title: 'Block Drop', w: 10, h: 18, startSpeed: 30, goalLines: 20, color: '#b04ae8', color2: '#4ae8ff' },
        maze: { title: 'Dot Dash', lives: 3, ghosts: 3, stepFrames: 9, powerFrames: 360, color: '#f5c542', color2: '#e84a8a' },
        memory: { title: 'Pair Up', pairs: 8, cols: 4, tries: 20, color: '#4ae87a', color2: '#f58a42' },
        sim: { title: 'Little Town', w: 16, h: 12, cash: 600, goalPop: 120, color: '#4ae87a', color2: '#f5c542' },
        paint: { title: 'Color Me', picture: 'house', color: '#ff7aa8', color2: '#4ae8ff' },
        military: { title: 'Task Force', mode: 'campaign', mission: 0, rounds: 10, health: 100, color: '#8ab070', color2: '#e8c84a' },
        craft: { title: 'Friendship Bracelets', threads: 5, rows: 6, perDay: 4, days: 14, cash: 40, rent: 30, goalCash: 1200, color: '#e84a8a', color2: '#f5c542' },
        hoops: { title: 'Hoop Shot', seconds: 60, goal: 12, meterSpeed: 2.2, color: '#f58a42', color2: '#ffffff' },
        combat: { title: 'Scrap Run', laps: 2, rivals: 5, hp: 100, rivalHp: 30, missiles: 3, mines: 2, gunDamage: 4, missileDamage: 18, mineDamage: 22, maxSpeed: 150, curves: 2, timeLimit: 150, difficulty: 1, color: '#4ae8ff', color2: '#ff5a5a' },
        rail: { title: 'Rail Gunner', hp: 5, mag: 6, waves: 4, bossHp: 14, civilians: .25, reticleSpeed: 3.2, difficulty: 1, color: '#ffb23a', color2: '#4ae8ff' },
        godsim: { title: 'Cosmos Keeper', pace: 25 },
        baseball: { title: 'Sandlot Slugger', innings: 3, cpuSkill: 1.2, contact: 1, power: 1, color: '#3a8a3a', color2: '#ffffff' }
    };
    A.MODES = {
        shmup: { name: 'Shoot-em-up', controls: 'D-pad move, A fire', genres: ['shmup', 'rail_shooter'] },
        breakout: { name: 'Breakout', controls: 'Left/Right paddle, A launch', genres: ['breakout'] },
        race: { name: 'Racing (pseudo-3D)', controls: 'Up gas, Down brake, Left/Right steer', genres: ['racing', 'kart_racing', 'vehicle_combat'] },
        fps: { name: 'First-person shooter', controls: 'Up/Down move, Left/Right turn, A fire', genres: ['shooter_fps', 'shooter_tps', 'rpg_linear'] },
        brawler: { name: 'Beat-em-up', controls: 'D-pad walk, A punch, B kick', genres: ['beat_em_up'] },
        falling: { name: 'Falling blocks', controls: 'Left/Right move, Up rotate, Down drop', genres: ['puzzle_falling'] },
        maze: { name: 'Maze chase', controls: 'D-pad move: eat every dot, avoid the ghosts, big dots let you chase them', genres: ['minigames', 'puzzle_falling'] },
        memory: { name: 'Memory pairs', controls: 'D-pad move, A flip', genres: ['memory_puzzle', 'minigames'] },
        sim: { name: 'Town / city builder', controls: 'D-pad cursor, A build, B change building', genres: ['city_builder', 'god_sim'] },
        paint: { name: 'Coloring book', controls: 'D-pad cursor, A paint, B next colour', genres: ['coloring_book'] },
        military: { name: 'Military shooter (campaign + zombie mode)', controls: 'Up/Down move, Left/Right turn, Z fire, X reload, C switch weapon (buy at the pad in zombie mode), Up+Down grenade', genres: ['military_shooter', 'shooter_fps', 'shooter_tps'] },
        craft: { name: 'Bracelet shop (jewelry life sim)', controls: 'Z take order / tie knot, X turn away / back, C thread shop, D-pad pick threads', genres: ['crafting_sim'] },
        hoops: { name: 'Basketball shooting', controls: 'A to stop the meter, Left/Right aim', genres: ['basketball'] },
        combat: { name: 'Vehicle combat (Twisted Metal / Vigilante 8 / Mario Kart items)', controls: 'Up gas, Down brake, Left/Right steer, hold Z machine gun, X homing missile, C drop a mine', genres: ['vehicle_combat'] },
        rail: { name: 'Rail shooter (Time Crisis / House of the Dead / Star Fox)', controls: 'Arrows aim, Z fire, hold X for cover (reloads)', genres: ['rail_shooter'] },
        godsim: { name: 'God sim (Big Bang to Singularity)', controls: 'Z tap, Up/Down pick upgrade, X buy, C next trait slot, Left/Right change trait', genres: ['god_sim'] },
        baseball: { name: 'Baseball (bat against a pitcher)', controls: 'Arrows move the bat, Z swing (time it as the ball reaches the plate)', genres: ['baseball'] }
    };
    const fillText = (g, t, x, y, c, s, al) => { g.font = (s || 10) + 'px monospace'; g.fillStyle = c || '#fff'; g.textAlign = al || 'left'; g.fillText(t, x, y); };
    const hud = (g, s, C) => { fillText(g, (C.title || '').toUpperCase(), 4, 10, '#9aa', 8); fillText(g, 'SCORE ' + s.score, W - 4, 10, '#fff', 8, 'right'); if (s.lives != null) fillText(g, 'LIVES ' + s.lives, 4, H - 4, '#fff', 8); };
    const end = (g, s) => { if (s.status === 'play') return; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, H / 2 - 24, W, 48); fillText(g, s.status === 'win' ? 'YOU WIN!' : 'GAME OVER', W / 2, H / 2 + 4, s.status === 'win' ? '#4ae87a' : '#ff5a5a', 20, 'center'); fillText(g, 'press A', W / 2, H / 2 + 20, '#aaa', 9, 'center'); };

    /* ---------------------------------------------------------------- shmup */
    /* design = { types: [{ name, hp, speed, pattern 0 straight / 1 weave / 2 chase / 3 dive, fire (avg frames between shots, 0 = never), score, color 0-4, size 0-2 }], waves: [{ at (frames), type, n, form 0 line / 1 V / 2 column / 3 sides, x }], boss: { hp, pattern 0-2, fire } } */
    A.SHMUP_DESIGN = () => ({ types: [{ name: 'Scout', hp: 1, speed: 1, pattern: 0, fire: 160, score: 100, color: 0, size: 0 }, { name: 'Weaver', hp: 2, speed: 1, pattern: 1, fire: 120, score: 150, color: 1, size: 0 }, { name: 'Chaser', hp: 2, speed: 1.2, pattern: 2, fire: 0, score: 200, color: 2, size: 1 }, { name: 'Diver', hp: 3, speed: 1, pattern: 3, fire: 0, score: 250, color: 3, size: 1 }],
        waves: [{ at: 60, type: 0, n: 4, form: 0, x: 128 }, { at: 360, type: 1, n: 5, form: 1, x: 128 }, { at: 700, type: 2, n: 3, form: 3, x: 128 }, { at: 1000, type: 0, n: 6, form: 0, x: 128 }, { at: 1300, type: 3, n: 4, form: 2, x: 80 }, { at: 1600, type: 1, n: 7, form: 1, x: 128 }], boss: { hp: 40, pattern: 0, fire: 40 } });
    A.shmup = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.shmup, cfg), r = rng(o.seed || 1), s = { status: 'play', score: 0, lives: C.lives, t: 0, px: W / 2, py: H - 30, shots: [], en: [], eb: [], cool: 0, inv: 0, wave: 0, boss: null };
        const D = C.design && C.design.waves && C.design.types ? C.design : null; if (D) { s.q = 0; s.bossHp = (D.boss && D.boss.hp) | 0; }
        const SC = [null, '#ffd24a', '#5be08a', '#c07aff', '#ffffff'];
        const spawnD = w => { const ty = D.types[w.type] || D.types[0]; for (let i = 0; i < w.n; i++) { const f = w.form | 0; let x = w.x, y = -10 - i * 14; if (f === 0) x = clamp(w.x + (i - (w.n - 1) / 2) * 34, 12, W - 12); else if (f === 1) { x = clamp(w.x + (i - (w.n - 1) / 2) * 30, 12, W - 12); y = -10 - Math.abs(i - (w.n - 1) / 2) * 16; } else if (f === 2) { x = w.x; y = -10 - i * 24; } else { x = i % 2 ? W - 16 : 16; y = -10 - i * 18; } s.en.push({ x, y, hp: ty.hp, pat: ty.pattern, ph: r() * 6, ty, t: 0 }); } };
        const spawn = () => { const n = 3 + Math.min(5, s.wave); for (let i = 0; i < n; i++) s.en.push({ x: 30 + (i + .5) * (W - 60) / n, y: -10 - i * 14, hp: C.enemyHp, pat: s.wave % 3, ph: r() * 6 }); };
        const shoot = (x, y, tx, ty, sp) => { const d = Math.max(1, dist(x, y, tx, ty)); s.eb.push({ x, y, vx: (tx - x) / d * sp, vy: (ty - y) / d * sp }); };
        return { s, C, step(k) {
            if (s.status !== 'play') return; s.t++; s.px = clamp(s.px + ax(k) * C.speed, 8, W - 8); s.py = clamp(s.py + ay(k) * C.speed, 20, H - 12);
            if (k.z && s.cool <= 0) { s.shots.push({ x: s.px, y: s.py - 8 }); s.cool = C.fireRate; } s.cool--; s.inv--;
            s.shots = s.shots.filter(b => (b.y -= 6) > -4);
            if (D) {
                while (s.q < D.waves.length && D.waves[s.q].at <= s.t) spawnD(D.waves[s.q++]);
                for (const e of s.en) { e.t++; const sp = e.ty.speed || 1; e.y += e.pat === 3 ? sp * (e.t > 40 ? 2.4 : .5) : sp * .7; if (e.pat === 1) e.x += Math.sin(s.t / 20 + e.ph) * 1.4; if (e.pat === 2) e.x += Math.sign(s.px - e.x) * .6; if (e.ty.fire && r() < 1 / e.ty.fire) shoot(e.x, e.y, s.px, s.py, 2); }
            } else
            for (const e of s.en) { e.y += .7; if (e.pat === 1) e.x += Math.sin(s.t / 20 + e.ph) * 1.4; if (e.pat === 2) e.x += Math.sign(s.px - e.x) * .5; if (r() < .006) shoot(e.x, e.y, s.px, s.py, 2); }
            if (s.boss) { const b = s.boss, bp = D && D.boss ? D.boss.pattern | 0 : 0; b.x = bp === 1 ? W / 2 + Math.sin(s.t / 25) * 120 : bp === 2 ? clamp(b.x + Math.sign(s.px - b.x) * 1.2, 30, W - 30) : W / 2 + Math.sin(s.t / 50) * 100; const fr = D && D.boss && D.boss.fire ? D.boss.fire : 40; if (s.t % fr === 0) for (let i = -2; i <= 2; i++) shoot(b.x, b.y + 10, b.x + i * 40, H, 2); }
            for (const b of s.shots) { for (const e of s.en) if (e.hp > 0 && Math.abs(b.x - e.x) < 10 && Math.abs(b.y - e.y) < 10) { e.hp--; b.y = -99; if (e.hp <= 0) s.score += e.ty ? e.ty.score : 100; } if (s.boss && b.y > -50 && Math.abs(b.x - s.boss.x) < 22 && Math.abs(b.y - s.boss.y) < 14) { s.boss.hp--; b.y = -99; s.score += 10; } }
            s.en = s.en.filter(e => e.hp > 0 && e.y < H + 12); s.eb = s.eb.filter(b => (b.x += b.vx, b.y += b.vy, b.y < H + 8 && b.y > -8 && b.x > -8 && b.x < W + 8));
            if (s.inv <= 0) { const hit = s.eb.some(b => dist(b.x, b.y, s.px, s.py) < 6) || s.en.some(e => dist(e.x, e.y, s.px, s.py) < 11); if (hit) { s.lives--; s.inv = 90; s.eb = []; if (s.lives <= 0) s.status = 'lose'; } }
            if (D) { if (!s.en.length && !s.boss && s.q >= D.waves.length) { if (C.boss && s.bossHp > 0) { s.boss = { x: W / 2, y: 36, hp: s.bossHp, max: s.bossHp }; } else s.status = 'win'; } }
            else if (!s.en.length && !s.boss) { if (s.wave >= C.waves) { if (C.boss) s.boss = { x: W / 2, y: 36, hp: 40 }; else s.status = 'win'; } else { s.wave++; spawn(); } }
            if (s.boss && s.boss.hp <= 0) { s.score += 2000; s.status = 'win'; }
        }, draw(g) {
            g.fillStyle = '#05060f'; g.fillRect(0, 0, W, H); for (let i = 0; i < 40; i++) { g.fillStyle = '#334'; g.fillRect((i * 97) % W, (i * 53 + s.t * (1 + i % 3)) % H, 1, 1); }
            g.fillStyle = C.color; if (s.inv <= 0 || s.t % 6 < 3) { g.beginPath(); g.moveTo(s.px, s.py - 8); g.lineTo(s.px - 7, s.py + 7); g.lineTo(s.px + 7, s.py + 7); g.fill(); }
            g.fillStyle = '#fff'; for (const b of s.shots) g.fillRect(b.x - 1, b.y - 4, 2, 6); for (const e of s.en) { g.fillStyle = e.ty && e.ty.color ? SC[e.ty.color] || C.color2 : C.color2; const z = e.ty ? [7, 10, 15][e.ty.size | 0] || 7 : 7; g.fillRect(e.x - z, e.y - z * .85, z * 2, z * 1.7); } if (s.boss) { g.fillRect(s.boss.x - 24, s.boss.y - 12, 48, 24); g.fillStyle = '#fff'; g.fillRect(s.boss.x - 24, s.boss.y - 18, 48 * s.boss.hp / (s.boss.max || 40), 3); }
            g.fillStyle = '#ffd24a'; for (const b of s.eb) g.fillRect(b.x - 2, b.y - 2, 4, 4); hud(g, s, C); end(g, s); } };
    };

    /* ---------------------------------------------------------------- breakout */
    /* design = { grid: rows of numbers, 0 = empty, 1-4 = hits the brick takes (up to 8 rows x 16 columns) } */
    A.BREAKOUT_DESIGN = () => ({ grid: [[0,0,1,1,1,1,1,1,1,1,0,0],[0,1,2,2,2,2,2,2,2,2,1,0],[1,1,2,3,3,3,3,3,3,2,1,1],[1,2,3,4,4,0,0,4,4,3,2,1],[1,1,2,3,3,3,3,3,3,2,1,1],[0,1,2,2,2,2,2,2,2,2,1,0]] });
    A.breakout = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.breakout, cfg), s = { status: 'play', score: 0, lives: C.lives, px: W / 2, bx: W / 2, by: H - 30, vx: 0, vy: 0, held: true, bricks: [], t: 0 }, bw = W / C.cols;
        const G = C.design && Array.isArray(C.design.grid) && C.design.grid.length ? C.design.grid : null, gc = G ? Math.max(...G.map(r => r.length)) : 0, gw = G ? W / gc : bw;
        if (G) G.forEach((row, y) => row.forEach((v, x) => { if (v > 0) s.bricks.push({ x: x * gw, y: 24 + y * 12, hit: false, row: y, hp: v, v, w: gw }); }));
        else for (let y = 0; y < C.rows; y++) for (let x = 0; x < C.cols; x++) s.bricks.push({ x: x * bw, y: 24 + y * 12, hit: false, row: y, hp: 1, v: 1 + y % 4, w: bw });
        return { s, C, step(k) {
            if (s.status !== 'play') return; s.t++; s.px = clamp(s.px + ax(k) * 4, C.paddle / 2, W - C.paddle / 2);
            if (s.held) { s.bx = s.px; s.by = H - 30; if (k.z) { s.held = false; s.vx = 1.2; s.vy = -C.ballSpeed; } return; }
            s.bx += s.vx; s.by += s.vy; if (s.bx < 3 || s.bx > W - 3) { s.vx = -s.vx; s.bx = clamp(s.bx, 3, W - 3); } if (s.by < 3) { s.vy = Math.abs(s.vy); }
            if (s.vy > 0 && s.by > H - 24 && s.by < H - 16 && Math.abs(s.bx - s.px) < C.paddle / 2 + 3) { s.vy = -Math.abs(s.vy); s.vx = clamp((s.bx - s.px) / (C.paddle / 2) * 3.2, -3.6, 3.6); }
            for (const b of s.bricks) if (!b.hit && s.bx > b.x - 2 && s.bx < b.x + b.w + 2 && s.by > b.y - 2 && s.by < b.y + 11) { if (--b.hp <= 0) { b.hit = true; s.score += 10 + (G ? b.v * 5 : (C.rows - b.row) * 2); } s.vy = -s.vy; break; }
            if (s.by > H) { s.lives--; s.held = true; s.vx = 0; s.vy = 0; if (s.lives <= 0) s.status = 'lose'; } if (s.bricks.every(b => b.hit)) s.status = 'win';
        }, draw(g) {
            g.fillStyle = '#080a14'; g.fillRect(0, 0, W, H); for (const b of s.bricks) if (!b.hit) { g.fillStyle = G ? ['#7ae87a', '#4ae8ff', '#f5c542', '#ff5a5a'][(b.hp - 1) & 3] : `hsl(${(b.row * 40 + 20) % 360},70%,55%)`; g.fillRect(b.x + 1, b.y + 1, b.w - 2, 10); }
            g.fillStyle = C.color; g.fillRect(s.px - C.paddle / 2, H - 20, C.paddle, 6); g.fillStyle = '#fff'; g.beginPath(); g.arc(s.bx, s.by, 3, 0, 7); g.fill(); hud(g, s, C); end(g, s); } };
    };

    /* design = { track: [{ len 1-20, curve -6..6 (negative = left) }] up to 16 sections, grass: [r, g, b] } */
    A.RACE_DESIGN = () => ({ grass: [42, 138, 42], track: [{ len: 3, curve: 0 }, { len: 2, curve: 3 }, { len: 3, curve: 6 }, { len: 2, curve: 3 }, { len: 3, curve: 0 }, { len: 2, curve: -3 }, { len: 3, curve: -6 }, { len: 2, curve: -3 }, { len: 3, curve: 0 }, { len: 2, curve: 4 }] });
    /* ---------------------------------------------------------------- race (pseudo-3D road) */
    A.race = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.race, cfg), r = rng(o.seed || 1), seg = 200, total = 600, curveAt = [], cars = [];
        const RD = C.design && Array.isArray(C.design.track) && C.design.track.length ? C.design : null, grass = RD && RD.grass ? RD.grass : [42, 138, 42];
        if (RD) { const sum = RD.track.reduce((n, q) => n + Math.max(1, q.len | 0), 0); let acc = 0, k = 0; for (let i = 0; i < total; i++) { while (k < RD.track.length - 1 && i >= (acc + Math.max(1, RD.track[k].len | 0)) / sum * total) { acc += Math.max(1, RD.track[k].len | 0); k++; } curveAt.push((RD.track[k].curve || 0) * .4); } }
        else for (let i = 0; i < total; i++) curveAt.push(Math.sin(i / (total / (C.curves * 2 * Math.PI) * 1)) * 1.6); for (let i = 0; i < C.laneCars; i++) cars.push({ z: 40 + r() * (total - 40) * 1, x: (r() - .5) * 1.4, v: 20 + r() * 40 });
        const s = { status: 'play', score: 0, t: 0, z: 0, x: 0, v: 0, lap: 1, time: C.timeLimit, crash: 0, place: 0, laps: C.laps };
        return { s, C, step(k) {
            if (s.status !== 'play') return; s.t++; if (s.t % 60 === 0) s.time--; const cur = curveAt[Math.floor(s.z) % total];
            s.v = clamp(s.v + (k.ArrowUp ? 1.2 : k.ArrowDown ? -2.4 : -.5), 0, C.maxSpeed * (Math.abs(s.x) > 1 ? .5 : 1)); s.x = clamp(s.x + ax(k) * .03 * (s.v / C.maxSpeed + .3) + cur * s.v / C.maxSpeed * .012 * -1, -1.8, 1.8);
            s.z += s.v / 60 / 4; s.score += Math.round(s.v / 30); for (const c of cars) { c.z += c.v / 60 / 4 * .6; if (c.z > s.z + total) c.z -= total; if (Math.abs(((c.z - s.z) % total + total) % total) < .6 && Math.abs(c.x - s.x) < .22) { s.v *= .4; s.crash = 20; c.z += 6; } }
            if (s.crash > 0) s.crash--; if (s.z >= s.lap * total) { s.lap++; s.time += 25; if (s.lap > C.laps) { s.status = 'win'; s.score += 1000 + s.time * 10; } } if (s.time <= 0) s.status = 'lose';
        }, draw(g) {
            g.fillStyle = '#58b8ff'; g.fillRect(0, 0, W, H / 2); g.fillStyle = `rgb(${grass[0]},${grass[1]},${grass[2]})`; g.fillRect(0, H / 2, W, H / 2); let x = 0, dx = 0, y = H; const base = Math.floor(s.z);
            for (let n = 1; n < 80; n++) { const i = (base + n) % total, sc = 1 / (n * .12 + .2), yy = H / 2 + (H / 2) * sc * .55, w = 150 * sc; dx += curveAt[i] * .35; x += dx; const cx = W / 2 + x * sc * 8 - s.x * w * .9; if (yy > y) continue; g.fillStyle = `rgb(${grass[0] + (i % 6 < 3 ? 14 : 0)},${grass[1] + (i % 6 < 3 ? 14 : 0)},${grass[2] + (i % 6 < 3 ? 14 : 0)})`; g.fillRect(0, yy, W, y - yy + 1); g.fillStyle = (i % 6 < 3) ? '#d44' : '#eee'; g.fillRect(cx - w * 1.15, yy, w * 2.3, y - yy + 1); g.fillStyle = '#555'; g.fillRect(cx - w, yy, w * 2, y - yy + 1); if (i % 4 < 2) { g.fillStyle = '#ddd'; g.fillRect(cx - 2 * sc, yy, 4 * sc, y - yy + 1); } y = yy;
                for (const c of cars) if (Math.floor(c.z) % total === i) { g.fillStyle = C.color2; g.fillRect(cx + c.x * w - 10 * sc * 1.5, yy - 14 * sc * 1.5, 20 * sc * 1.5, 14 * sc * 1.5); } }
            g.fillStyle = C.color; g.fillRect(W / 2 - 14 + (s.crash % 4 < 2 ? 0 : 3), H - 34, 28, 18); g.fillStyle = '#111'; g.fillRect(W / 2 - 16, H - 22, 6, 6); g.fillRect(W / 2 + 10, H - 22, 6, 6);
            fillText(g, Math.round(s.v) + ' km/h', W - 4, H - 4, '#fff', 9, 'right'); fillText(g, 'LAP ' + Math.min(s.lap, C.laps) + '/' + C.laps + '  TIME ' + Math.max(0, s.time), 4, 10, '#fff', 9); hud2(g, s, C); end(g, s); } };
        function hud2(g, s, C) { fillText(g, 'SCORE ' + s.score, W - 4, 10, '#fff', 8, 'right'); }
    };

    /* design = { map: [strings] up to 24 x 24: # wall, . floor, S start, X exit (PC), E enemy, H health, A ammo } */
    A.FPS_DESIGN = () => { const N = 23, G = []; for (let y = 0; y < N; y++) G.push(new Array(N).fill('#')); let seed = 12345; const rn = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; }; const st = [[1, 1]]; G[1][1] = '.';
        while (st.length) { const [x, y] = st[st.length - 1], d = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dx, dy]) => x + dx > 0 && y + dy > 0 && x + dx < N - 1 && y + dy < N - 1 && G[y + dy][x + dx] === '#'); if (!d.length) { st.pop(); continue; } const [dx, dy] = d[rn(d.length)]; G[y + dy / 2][x + dx / 2] = '.'; G[y + dy][x + dx] = '.'; st.push([x + dx, y + dy]); }
        for (let i = 0; i < 40; i++) { const x = 1 + rn(N - 2), y = 1 + rn(N - 2); G[y][x] = '.'; }
        const put = (ch, n, minD) => { for (let k = 0, t = 0; k < n && t < 999; t++) { const x = 1 + rn(N - 2), y = 1 + rn(N - 2); if (G[y][x] === '.' && Math.abs(x - 1) + Math.abs(y - 1) >= minD) { G[y][x] = ch; k++; } } };
        G[1][1] = 'S'; G[N - 2][N - 2] = 'X'; put('E', 6, 8); put('H', 3, 4); put('A', 3, 4); return { map: G.map(r => r.join('')) }; };    /* ---------------------------------------------------------------- fps (raycaster) */
    A.fps = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.fps, cfg), r = rng(o.seed || 1), FD = C.design && Array.isArray(C.design.map) && C.design.map.length ? C.design : null, N = FD ? Math.max(FD.map.length, ...FD.map.map(q => q.length)) : C.size, M = []; for (let y = 0; y < N; y++) { M.push([]); for (let x = 0; x < N; x++) M[y].push(x === 0 || y === 0 || x === N - 1 || y === N - 1 ? 1 : 0); }
        for (let i = 0; i < N * 2; i++) { const x = 2 + Math.floor(r() * (N - 4)), y = 2 + Math.floor(r() * (N - 4)); if ((x < 4 && y < 4) || (x > N - 5 && y > N - 5)) continue; M[y][x] = 1; if (r() < .5 && x + 1 < N - 2) M[y][x + 1] = 1; else if (y + 1 < N - 2) M[y + 1][x] = 1; }
        const en = [], pks = []; let start = null, endp = null;
        if (FD) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const ch = (FD.map[y] || '')[x] || '#'; M[y][x] = ch === '#' ? 1 : 0; if (ch === 'E') en.push({ x: x + .5, y: y + .5, hp: 3, cd: 0 }); else if (ch === 'H' || ch === 'A') pks.push({ x: x + .5, y: y + .5, kind: ch, on: true }); else if (ch === 'S') start = { x: x + .5, y: y + .5 }; else if (ch === 'X') endp = { x: x + .5, y: y + .5 }; } }
        else for (let i = 0; i < C.enemies; i++) { let x, y; do { x = 3 + r() * (N - 6); y = 3 + r() * (N - 6); } while (M[Math.floor(y)][Math.floor(x)] || (x < 5 && y < 5)); en.push({ x, y, hp: 3, cd: 0 }); }
        const s = { status: 'play', score: 0, x: start ? start.x : 1.5, y: start ? start.y : 1.5, a: .8, hp: C.health, ammo: C.ammo, cool: 0, flash: 0, en, pks, exit: endp || { x: N - 1.5, y: N - 1.5 }, kills: 0 }, wall = (x, y) => M[Math.floor(y)] && M[Math.floor(y)][Math.floor(x)];
        const cast = (a) => { let d = 0, dx = Math.cos(a), dy = Math.sin(a); while (d < 24) { d += .05; if (wall(s.x + dx * d, s.y + dy * d)) return d; } return 24; };
        return { s, C, M, step(k) {
            if (s.status !== 'play') return; s.a += ax(k) * .045; const mv = -ay(k) * .06, nx = s.x + Math.cos(s.a) * mv, ny = s.y + Math.sin(s.a) * mv; if (!wall(nx, s.y)) s.x = nx; if (!wall(s.x, ny)) s.y = ny; s.cool--; s.flash--;
            if (k.z && s.cool <= 0 && s.ammo > 0) { s.ammo--; s.cool = 14; s.flash = 4; let best = null; for (const e of s.en) { if (e.hp <= 0) continue; const ang = Math.atan2(e.y - s.y, e.x - s.x), da = Math.abs(((ang - s.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI), d = dist(e.x, e.y, s.x, s.y); if (da < .13 / Math.max(.6, d / 4) + .05 && d < cast(ang) + .2 && (!best || d < best.d)) best = { e, d }; } if (best && (best.e.hp -= C.damage) <= 0) { s.kills++; s.score += 100; } }
            for (const e of s.en) { if (e.hp <= 0) continue; const d = dist(e.x, e.y, s.x, s.y); if (d < 9) { const nx = e.x + (s.x - e.x) / d * .02, ny = e.y + (s.y - e.y) / d * .02; if (!wall(nx, e.y)) e.x = nx; if (!wall(e.x, ny)) e.y = ny; if (d < 1 && --e.cd <= 0) { s.hp -= 5; e.cd = 40; } } }
            for (const p of s.pks) if (p.on && dist(p.x, p.y, s.x, s.y) < .6) { p.on = false; if (p.kind === 'H') s.hp = Math.min(C.health + 25, s.hp + 25); else s.ammo += 14; }
            if (s.hp <= 0) s.status = 'lose'; if (dist(s.x, s.y, s.exit.x, s.exit.y) < 1 && s.en.every(e => e.hp <= 0)) { s.status = 'win'; s.score += 500; }
        }, draw(g) {
            g.fillStyle = '#222'; g.fillRect(0, 0, W, H / 2); g.fillStyle = '#444'; g.fillRect(0, H / 2, W, H / 2); const depth = []; for (let col = 0; col < W; col += 2) { const a = s.a + (col / W - .5) * 1.05, d = cast(a) * Math.cos(a - s.a), h = Math.min(H, 120 / Math.max(.2, d)); depth[col] = d; g.fillStyle = `rgb(${Math.max(20, 150 - d * 14)},${Math.max(20, 120 - d * 12)},${Math.max(40, 220 - d * 16)})`; g.fillRect(col, (H - h) / 2, 2, h); }
            for (const e of [...s.en.filter(e => e.hp > 0), ...s.pks.filter(p => p.on), { x: s.exit.x, y: s.exit.y, ex: 1 }].sort((a, b) => dist(b.x, b.y, s.x, s.y) - dist(a.x, a.y, s.x, s.y))) { const ang = Math.atan2(e.y - s.y, e.x - s.x), da = ((ang - s.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI, d = dist(e.x, e.y, s.x, s.y); if (Math.abs(da) > .7) continue; const sx = (da / 1.05 + .5) * W, sz = Math.min(160, 90 / Math.max(.3, d)); if (depth[Math.floor(sx / 2) * 2] < d - .3) continue; g.fillStyle = e.ex ? '#4ae87a' : e.kind === 'H' ? '#ff4b6b' : e.kind === 'A' ? '#ffd24a' : C.color2; if (e.kind) g.fillRect(sx - sz / 8, H / 2 + sz * .1, sz / 4, sz / 4); else g.fillRect(sx - sz / 4, H / 2 - sz / 2 + 6, sz / 2, sz); }
            if (s.flash > 0) { g.fillStyle = '#fd8'; g.fillRect(W / 2 - 3, H / 2 - 3, 6, 6); } g.fillStyle = '#ccc'; g.fillRect(W / 2 - 1, H / 2 - 8, 2, 16); g.fillRect(W / 2 - 8, H / 2 - 1, 16, 2); g.fillStyle = '#555'; g.fillRect(W / 2 - 10, H - 30, 20, 30);
            fillText(g, 'HP ' + s.hp + '  AMMO ' + s.ammo + '  KILLS ' + s.kills + '/' + C.enemies, 4, 10, '#fff', 9); fillText(g, 'SCORE ' + s.score, W - 4, 10, '#fff', 8, 'right'); end(g, s); } };
    };

    /* design = { types: [{ name, hp, speed (0.5-2), dmg, score, color 0-4 }], waves: [{ type, n, side 0 right / 1 left / 2 both }], boss: { hp, dmg } } - waves play one after another */
    A.BRAWLER_DESIGN = () => ({ types: [{ name: 'Thug', hp: 3, speed: 1, dmg: 1, score: 50, color: 0 }, { name: 'Runner', hp: 2, speed: 1.6, dmg: 1, score: 60, color: 1 }, { name: 'Bruiser', hp: 7, speed: .7, dmg: 2, score: 120, color: 3 }],
        waves: [{ type: 0, n: 2, side: 0 }, { type: 0, n: 3, side: 2 }, { type: 1, n: 3, side: 1 }, { type: 2, n: 1, side: 0 }, { type: 1, n: 4, side: 2 }], boss: { hp: 30, dmg: 3 } });
    /* ---------------------------------------------------------------- brawler */
    A.brawler = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.brawler, cfg), r = rng(o.seed || 1), s = { status: 'play', score: 0, lives: C.lives, t: 0, px: 60, py: 170, face: 1, hp: 20, atk: 0, kind: 0, cool: 0, en: [], wave: 0, boss: null, inv: 0, cam: 0 };
        const BD = C.design && Array.isArray(C.design.waves) && C.design.types && C.design.types.length ? C.design : null, BC = [null, '#ffd24a', '#5be08a', '#c07aff', '#ffffff'];
        const spawn = () => { if (BD) { const w = BD.waves[s.wave - 1], ty = BD.types[w.type] || BD.types[0]; for (let i = 0; i < Math.min(8, w.n); i++) { const left = w.side === 1 || (w.side === 2 && i % 2); s.en.push({ x: left ? -20 - i * 24 : W + 20 + i * 24, y: 140 + r() * 70, hp: ty.hp, cd: 30 + i * 10, hit: 0, ty }); } return; } const n = 2 + s.wave; for (let i = 0; i < n; i++) s.en.push({ x: W - 20 + i * 24, y: 140 + r() * 70, hp: C.enemyHp, cd: 30 + i * 10, hit: 0 }); };
        return { s, C, step(k) {
            if (s.status !== 'play') return; s.t++; s.cool--; s.inv--; if (s.atk > 0) s.atk--; else { const mx = ax(k), my = ay(k); s.px = clamp(s.px + mx * 2, 10, W - 10); s.py = clamp(s.py + my * 1.4, 130, 215); if (mx) s.face = mx; if (s.cool <= 0 && (k.z || k.x)) { s.atk = 8; s.kind = k.x ? 1 : 0; s.cool = 16; const rng_ = s.kind ? 34 : 26, dmg = s.kind ? 2 : 1; for (const e of [...s.en, ...(s.boss ? [s.boss] : [])]) if (Math.abs(e.y - s.py) < 16 && (e.x - s.px) * s.face > 0 && Math.abs(e.x - s.px) < rng_) { e.hp -= dmg; e.hit = 8; e.x += s.face * 6; s.score += 10; } } }
            for (const e of s.en.concat(s.boss ? [s.boss] : [])) { e.hit--; e.cd--; const d = dist(e.x, e.y, s.px, s.py); if (d > 22) { e.x += Math.sign(s.px - e.x) * (e === s.boss ? .6 : e.ty ? .45 * e.ty.speed : .45); e.y += Math.sign(s.py - e.y) * .3; } else if (e.cd <= 0 && s.inv <= 0) { s.hp -= e === s.boss ? (BD && BD.boss ? BD.boss.dmg : 3) : (e.ty ? e.ty.dmg : 1); s.inv = 30; e.cd = 50; if (s.hp <= 0) { s.lives--; s.hp = 20; s.inv = 90; if (s.lives <= 0) s.status = 'lose'; } } }
            const dead = s.en.filter(e => e.hp <= 0).length; if (dead) s.score += BD ? s.en.filter(e => e.hp <= 0).reduce((n, e) => n + (e.ty ? e.ty.score : 50), 0) : dead * 50; s.en = s.en.filter(e => e.hp > 0);
            if (s.boss && s.boss.hp <= 0) { s.score += 1000; s.status = 'win'; }
            if (!s.en.length && !s.boss) { const nw = BD ? BD.waves.length : C.waves; if (s.wave >= nw) { if (C.boss) { const bh = BD && BD.boss ? BD.boss.hp : C.enemyHp * 8; s.bossMax = bh; s.boss = { x: W - 30, y: 170, hp: bh, cd: 40, hit: 0 }; } else s.status = 'win'; } else { s.wave++; spawn(); } }
        }, draw(g) {
            g.fillStyle = '#243'; g.fillRect(0, 0, W, 130); g.fillStyle = '#586'; g.fillRect(0, 130, W, H - 130); for (let i = 0; i < 8; i++) { g.fillStyle = '#354'; g.fillRect(i * 48 + 6, 40, 30, 70); }
            const body = (x, y, c, face, flash, atk) => { g.fillStyle = flash > 0 ? '#fff' : c; g.fillRect(x - 6, y - 30, 12, 22); g.fillStyle = '#e8b890'; g.fillRect(x - 5, y - 38, 10, 9); g.fillStyle = '#222'; g.fillRect(x - 6, y - 8, 5, 8); g.fillRect(x + 1, y - 8, 5, 8); if (atk) { g.fillStyle = '#e8b890'; g.fillRect(x + face * 6, y - 26, face * (atk > 1 ? 20 : 12), 5); } };
            for (const e of [...s.en, ...(s.boss ? [s.boss] : []), { player: 1 }].sort((a, b) => (a.player ? s.py : a.y) - (b.player ? s.py : b.y))) { if (e.player) { if (s.inv <= 0 || s.t % 6 < 3) body(s.px, s.py, C.color, s.face, 0, s.atk > 0 ? (s.kind ? 3 : 2) : 0); } else { body(e.x, e.y, e === s.boss ? '#a22' : (e.ty && e.ty.color ? BC[e.ty.color] : C.color2), e.x > s.px ? -1 : 1, e.hit, 0); if (e === s.boss) { g.fillStyle = '#e22'; g.fillRect(e.x - 18, e.y - 48, 36 * e.hp / (s.bossMax || C.enemyHp * 8), 3); } } }
            fillText(g, 'HP ' + s.hp, 4, 22, '#fff', 9); hud(g, s, C); end(g, s); } };
    };

    /* ---------------------------------------------------------------- falling blocks */
    const PIECES = [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[0, 1, 1], [1, 1, 0]], [[1, 1, 0], [0, 1, 1]]];
    /* design = { pieces: [{ name, cells: 16 chars of 0/1 (a 4x4 grid), color }] (1-12), speedUp: frames faster per line, fastest: frames per drop at the limit } */
    A.FALLING_DESIGN = () => { const mk = (name, rows, color) => ({ name, cells: rows.join(''), color }); return { speedUp: 1.2, fastest: 5, pieces: [mk('Line', ['0000', '1111', '0000', '0000'], '#4ae8ff'), mk('Square', ['0000', '0110', '0110', '0000'], '#f5c542'), mk('T', ['0000', '0100', '1110', '0000'], '#b04ae8'), mk('J', ['0000', '1000', '1110', '0000'], '#4a64e8'), mk('L', ['0000', '0010', '1110', '0000'], '#f58a42'), mk('S', ['0000', '0110', '1100', '0000'], '#7ae87a'), mk('Z', ['0000', '1100', '0110', '0000'], '#e84a4a')] }; };
    A.falling = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.falling, cfg), r = rng(o.seed || 1), FD = C.design && Array.isArray(C.design.pieces) && C.design.pieces.length ? C.design : null, PS = FD ? FD.pieces.slice(0, 12).map(p => { const g4 = []; for (let y = 0; y < 4; y++) g4.push([0, 1, 2, 3].map(x => (p.cells || '')[y * 4 + x] === '1' ? 1 : 0)); const rs = g4.filter(r => r.some(v => v)), cs = [0, 1, 2, 3].filter(x => rs.some(r => r[x])); return rs.length ? rs.map(r => cs.map(x => r[x])) : [[1]]; }) : PIECES, s = { status: 'play', score: 0, lines: 0, t: 0, b: Array.from({ length: C.h }, () => Array(C.w).fill(0)), p: null, px: 0, py: 0, kt: 0, last: {} }, rot = m => m[0].map((_, i) => m.map(row => row[i]).reverse());
        const fits = (m, x, y) => m.every((row, j) => row.every((v, i) => !v || (x + i >= 0 && x + i < C.w && y + j < C.h && (y + j < 0 || !s.b[y + j][x + i])))), spawn = () => { const n = Math.floor(r() * PS.length); s.p = { m: PS[n], c: n + 1 }; s.px = Math.floor((C.w - 2) / 2); s.py = 0; if (!fits(s.p.m, s.px, s.py)) s.status = 'lose'; };
        spawn(); const edge = (k, n) => { const v = !!k[n], was = !!s.last[n]; s.last[n] = v; return v && !was; };
        return { s, C, fits, rot, step(k) {
            if (s.status !== 'play') return; s.t++; if (edge(k, 'ArrowLeft') && fits(s.p.m, s.px - 1, s.py)) s.px--; if (edge(k, 'ArrowRight') && fits(s.p.m, s.px + 1, s.py)) s.px++; if (edge(k, 'ArrowUp')) { const m = rot(s.p.m); if (fits(m, s.px, s.py)) s.p.m = m; }
            const spd = Math.max(FD ? (FD.fastest || 5) : 5, C.startSpeed - s.lines * (FD && FD.speedUp != null ? FD.speedUp : 1.2)), fall = k.ArrowDown ? 3 : spd; if (++s.kt >= fall) { s.kt = 0; if (fits(s.p.m, s.px, s.py + 1)) s.py++; else { s.p.m.forEach((row, j) => row.forEach((v, i) => { if (v && s.py + j >= 0) s.b[s.py + j][s.px + i] = s.p.c; })); let n = 0; for (let y = C.h - 1; y >= 0; y--) if (s.b[y].every(v => v)) { s.b.splice(y, 1); s.b.unshift(Array(C.w).fill(0)); n++; y++; } if (n) { s.lines += n; s.score += [0, 100, 300, 500, 800][n] || 800; } if (s.lines >= C.goalLines) s.status = 'win'; else spawn(); } }
        }, draw(g) {
            g.fillStyle = '#0a0a18'; g.fillRect(0, 0, W, H); const cs = Math.floor((H - 16) / C.h), ox = (W - C.w * cs) / 2, oy = 8; g.fillStyle = '#151530'; g.fillRect(ox, oy, C.w * cs, C.h * cs); const cc = i => FD && FD.pieces[i - 1] ? FD.pieces[i - 1].color : `hsl(${i * 51},65%,55%)`;
            for (let y = 0; y < C.h; y++) for (let x = 0; x < C.w; x++) if (s.b[y][x]) { g.fillStyle = cc(s.b[y][x]); g.fillRect(ox + x * cs, oy + y * cs, cs - 1, cs - 1); } if (s.p) s.p.m.forEach((row, j) => row.forEach((v, i) => { if (v) { g.fillStyle = cc(s.p.c); g.fillRect(ox + (s.px + i) * cs, oy + (s.py + j) * cs, cs - 1, cs - 1); } }));
            fillText(g, 'LINES ' + s.lines + '/' + C.goalLines, 6, 20, '#fff', 9); fillText(g, 'SCORE ' + s.score, 6, 34, '#fff', 9); end(g, s); } };
    };

    /* ---------------------------------------------------------------- memory pairs */
    /* design = { pal: 16 colours (index 0 = transparent), cards: [{ name, px: 256 hex digits, a 16x16 picture of palette indexes }] } - 2 to 16 pairs */
    A.MEMORY_DESIGN = () => { const pal = ['#000000', '#e84a4a', '#4a9be8', '#f5c542', '#7ae87a', '#b04ae8', '#ff8c3c', '#ffffff', '#222222', '#8a5a2a', '#4ae8ff', '#ff90b0', '#3a8a3a', '#a0a0a0', '#5a3a1a', '#f0d0a0'], mk = fn => { const a = []; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) a.push(fn(x - 7.5, y - 7.5)); return a.map(v => v.toString(16)).join(''); };
        return { pal, cards: [{ name: 'Sun', px: mk((x, y) => Math.hypot(x, y) < 5 ? 3 : 0) }, { name: 'Heart', px: mk((x, y) => ((x * x + y * y - 30) ** 3 - x * x * y * y * y * .9 * -1) < 0 && y > -6 ? 1 : 0) }, { name: 'Moon', px: mk((x, y) => Math.hypot(x, y) < 6 && Math.hypot(x - 3, y - 1) > 5 ? 7 : 0) }, { name: 'Leaf', px: mk((x, y) => Math.abs(x + y) < 2 && Math.hypot(x, y) < 7 ? 4 : (Math.hypot(x + 1, y - 1) < 6 && Math.abs(x - y) < 5 ? 12 : 0)) }, { name: 'Gem', px: mk((x, y) => Math.abs(x) + Math.abs(y) < 7 ? 10 : 0) }, { name: 'Block', px: mk((x, y) => Math.abs(x) < 5 && Math.abs(y) < 5 ? 5 : 0) }] }; };
    A.memory = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.memory, cfg), r = rng(o.seed || 1), MD = C.design && Array.isArray(C.design.cards) && C.design.cards.length >= 2 ? C.design : null; if (MD) C.pairs = Math.min(16, MD.cards.length); const n = C.pairs * 2, deck = []; for (let i = 0; i < C.pairs; i++) deck.push(i, i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
        const s = { status: 'play', score: 0, cur: 0, up: [], found: new Set(), tries: C.tries, wait: 0, deck, last: {} }, rows = Math.ceil(n / C.cols), edge = (k, nm) => { const v = !!k[nm], w = !!s.last[nm]; s.last[nm] = v; return v && !w; };
        return { s, C, rows, step(k) {
            if (s.status !== 'play') return; if (s.wait > 0) { if (--s.wait === 0) { const [a, b] = s.up; if (deck[a] === deck[b]) { s.found.add(a); s.found.add(b); s.score += 100; } else s.tries--; s.up = []; if (s.found.size === n) { s.status = 'win'; s.score += s.tries * 20; } else if (s.tries <= 0) s.status = 'lose'; } return; }
            const x = s.cur % C.cols, y = Math.floor(s.cur / C.cols); if (edge(k, 'ArrowLeft') && x > 0) s.cur--; if (edge(k, 'ArrowRight') && x < C.cols - 1 && s.cur + 1 < n) s.cur++; if (edge(k, 'ArrowUp') && y > 0) s.cur -= C.cols; if (edge(k, 'ArrowDown') && s.cur + C.cols < n) s.cur += C.cols;
            if (edge(k, 'z') && !s.found.has(s.cur) && !s.up.includes(s.cur)) { s.up.push(s.cur); if (s.up.length === 2) s.wait = 40; }
        }, draw(g) {
            g.fillStyle = '#0b1220'; g.fillRect(0, 0, W, H); const cw = 54, ch = 50, ox = (W - C.cols * cw) / 2, oy = 30; for (let i = 0; i < n; i++) { const x = ox + (i % C.cols) * cw, y = oy + Math.floor(i / C.cols) * ch, face = s.found.has(i) || s.up.includes(i); g.fillStyle = face ? (MD ? '#f0f0e6' : `hsl(${deck[i] * 47},65%,55%)`) : C.color; g.globalAlpha = s.found.has(i) ? .35 : 1; g.fillRect(x + 2, y + 2, cw - 4, ch - 4); g.globalAlpha = 1; if (face && MD) { const px = MD.cards[deck[i]].px || '', q = Math.floor(Math.min(cw - 4, ch - 4) / 16), x0 = x + (cw - 16 * q) / 2, y0 = y + (ch - 16 * q) / 2; for (let k = 0; k < 256; k++) { const c = parseInt(px[k] || '0', 16) || 0; if (c) { g.fillStyle = MD.pal[c] || '#000'; g.fillRect(x0 + (k % 16) * q, y0 + Math.floor(k / 16) * q, q, q); } } } else if (face) fillText(g, String(deck[i] + 1), x + cw / 2, y + ch / 2 + 6, '#fff', 18, 'center'); if (i === s.cur) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x, y, cw, ch); } }
            fillText(g, 'TRIES LEFT ' + s.tries, 4, 14, '#fff', 9); fillText(g, 'SCORE ' + s.score, W - 4, 14, '#fff', 9, 'right'); end(g, s); } };
    };

    /* ---------------------------------------------------------------- maze chase (eat the dots, avoid the ghosts; original maze) */
    A.MAZE = ['###################', '#o.......#.......o#', '#.##.###.#.###.##.#', '#.................#', '#.##.#.#####.#.##.#', '#....#...#...#....#', '####.###.G.###.####', '#....#.......#....#', '#.##.#.#####.#.##.#', '#.................#', '#.##.###.#.###.##.#', '#o.......P.......o#', '###################'];
    A.maze = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.maze, cfg), r = rng(o.seed || 1), g0 = A.MAZE.map(row => row.split('')), RW = g0.length, CW = g0[0].length, DX = [1, 0, -1, 0], DY = [0, 1, 0, -1], nG = Math.max(0, Math.min(3, C.ghosts | 0));
        let start = [9, 11], gs = [9, 6]; g0.forEach((row, y) => row.forEach((c, x) => { if (c === 'P') { start = [x, y]; g0[y][x] = ' '; } if (c === 'G') { gs = [x, y]; g0[y][x] = ' '; } }));
        const s = { status: 'play', score: 0, lives: C.lives, grid: g0, px: start[0], py: start[1], dir: 0, want: 0, fright: 0, t: 0, dots: 0, last: {}, ghosts: [] };
        s.grid.forEach(row => row.forEach(c => { if (c === '.' || c === 'o') s.dots++; }));
        const free = (x, y) => y >= 0 && y < RW && x >= 0 && x < CW && s.grid[y][x] !== '#', reset = () => { s.px = start[0]; s.py = start[1]; s.dir = 0; s.want = 0; s.ghosts = []; for (let i = 0; i < nG; i++) s.ghosts.push({ x: gs[0] + (i - 1), y: gs[1], dir: 0, dead: 0 }); }; reset();
        const hit = () => { for (const gh of s.ghosts) if (gh.x === s.px && gh.y === s.py) { if (s.fright > 0) { s.score += 200; gh.x = gs[0]; gh.y = gs[1]; } else { s.lives--; if (s.lives <= 0) s.status = 'lose'; else { reset(); s.fright = 0; } return; } } };
        return { s, C, step(k) {
            if (s.status !== 'play') return; s.t++; if (k.ArrowRight) s.want = 0; else if (k.ArrowDown) s.want = 1; else if (k.ArrowLeft) s.want = 2; else if (k.ArrowUp) s.want = 3; if (s.fright > 0) s.fright--;
            if (s.t % Math.max(2, C.stepFrames) === 0) { if (free(s.px + DX[s.want], s.py + DY[s.want])) s.dir = s.want; if (free(s.px + DX[s.dir], s.py + DY[s.dir])) { s.px += DX[s.dir]; s.py += DY[s.dir]; } const c = s.grid[s.py][s.px]; if (c === '.') { s.grid[s.py][s.px] = ' '; s.dots--; s.score += 10; } else if (c === 'o') { s.grid[s.py][s.px] = ' '; s.dots--; s.score += 50; s.fright = C.powerFrames; } if (s.dots <= 0) { s.status = 'win'; return; } hit(); if (s.status !== 'play') return; }
            if (s.t % (Math.max(2, C.stepFrames) + (s.fright > 0 ? 4 : 2)) === 0) { for (const gh of s.ghosts) { let opts = [0, 1, 2, 3].filter(d => free(gh.x + DX[d], gh.y + DY[d]) && d !== (gh.dir + 2) % 4); if (!opts.length) opts = [(gh.dir + 2) % 4]; let d; if (s.fright > 0 || r() < .25) d = opts[Math.floor(r() * opts.length)]; else { d = opts.reduce((b, c) => (Math.abs(gh.x + DX[c] - s.px) + Math.abs(gh.y + DY[c] - s.py) < Math.abs(gh.x + DX[b] - s.px) + Math.abs(gh.y + DY[b] - s.py) ? c : b), opts[0]); } gh.dir = d; gh.x += DX[d]; gh.y += DY[d]; } hit(); }
        }, draw(g) {
            g.fillStyle = '#05050f'; g.fillRect(0, 0, W, H); const cs = 16, ox = (W - CW * cs) / 2, oy = 22;
            for (let y = 0; y < RW; y++) for (let x = 0; x < CW; x++) { const c = s.grid[y][x]; if (c === '#') { g.fillStyle = '#2a3cc8'; g.fillRect(ox + x * cs + 1, oy + y * cs + 1, cs - 2, cs - 2); } else if (c === '.') { g.fillStyle = '#f5e6b0'; g.fillRect(ox + x * cs + 7, oy + y * cs + 7, 3, 3); } else if (c === 'o') { g.fillStyle = '#fff'; g.beginPath(); g.arc(ox + x * cs + 8, oy + y * cs + 8, 5, 0, 7); g.fill(); } }
            g.fillStyle = C.color; g.beginPath(); g.arc(ox + s.px * cs + 8, oy + s.py * cs + 8, 7, 0, 7); g.fill();
            s.ghosts.forEach((gh, i) => { g.fillStyle = s.fright > 0 ? (s.fright < 90 && s.t % 10 < 5 ? '#fff' : '#3a6aff') : ['#e84a4a', C.color2, '#4ae8ff'][i % 3]; g.fillRect(ox + gh.x * cs + 2, oy + gh.y * cs + 2, 12, 12); });
            fillText(g, 'SCORE ' + s.score, 6, 14, '#fff', 9); fillText(g, 'LIVES ' + s.lives, W - 6, 14, '#fff', 9, 'right'); end(g, s); } };
    };

    /* ---------------------------------------------------------------- town / city builder */
    A.BUILD = [{ n: 'Road', c: 5, col: '#777' }, { n: 'House', c: 40, col: '#e8a85a', pop: 6 }, { n: 'Farm', c: 30, col: '#7ac84a', food: 8 }, { n: 'Shop', c: 60, col: '#4a9be8', cash: 6 }, { n: 'Park', c: 25, col: '#2a9a4a', joy: 1 }];
    A.sim = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.sim, cfg), s = { status: 'play', score: 0, cash: C.cash, g: Array.from({ length: C.h }, () => Array(C.w).fill(0)), cx: 0, cy: 0, sel: 1, pop: 0, food: 0, joy: 0, t: 0, day: 0, last: {}, msg: '' }, edge = (k, n) => { const v = !!k[n], w = !!s.last[n]; s.last[n] = v; return v && !w; };
        const near = (x, y, t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s.g[y + dy] && s.g[y + dy][x + dx] === t + 1);
        const tally = () => { s.pop = 0; s.food = 0; s.joy = 0; let shopIncome = 0; for (let y = 0; y < C.h; y++) for (let x = 0; x < C.w; x++) { const t = s.g[y][x] - 1; if (t < 0) continue; const b = A.BUILD[t]; if (b.pop && near(x, y, 0)) s.pop += b.pop; if (b.food) s.food += b.food; if (b.joy) s.joy += b.joy; if (b.cash && near(x, y, 0)) shopIncome += b.cash; } s.income = shopIncome + Math.floor(s.pop * .8); };
        tally(); return { s, C, step(k) {
            if (s.status !== 'play') return; s.t++; if (edge(k, 'ArrowLeft')) s.cx = Math.max(0, s.cx - 1); if (edge(k, 'ArrowRight')) s.cx = Math.min(C.w - 1, s.cx + 1); if (edge(k, 'ArrowUp')) s.cy = Math.max(0, s.cy - 1); if (edge(k, 'ArrowDown')) s.cy = Math.min(C.h - 1, s.cy + 1); if (edge(k, 'x')) s.sel = (s.sel + 1) % A.BUILD.length;
            if (edge(k, 'z')) { const b = A.BUILD[s.sel]; if (s.g[s.cy][s.cx]) { s.g[s.cy][s.cx] = 0; s.cash += Math.floor(b.c / 2); s.msg = 'Bulldozed'; } else if (s.cash >= b.c) { s.cash -= b.c; s.g[s.cy][s.cx] = s.sel + 1; s.msg = 'Built ' + b.n; } else s.msg = 'Not enough cash'; tally(); }
            if (s.t % 120 === 0) { s.day++; const eat = Math.ceil(s.pop / 3), happy = s.food >= eat; s.cash += s.income + s.joy * 2; if (!happy) s.pop = Math.max(0, s.pop - 2); s.score = s.pop * 10 + s.cash; if (s.pop >= C.goalPop && happy) s.status = 'win'; if (s.day > 400) s.status = 'lose'; }
        }, draw(g) {
            g.fillStyle = '#3a8a3a'; g.fillRect(0, 0, W, H); const cs = Math.min(18, Math.floor((W - 8) / C.w)), ox = 4, oy = 24; for (let y = 0; y < C.h; y++) for (let x = 0; x < C.w; x++) { const t = s.g[y][x] - 1; g.fillStyle = (x + y) % 2 ? '#3f923f' : '#3a8a3a'; g.fillRect(ox + x * cs, oy + y * cs, cs, cs); if (t >= 0) { g.fillStyle = A.BUILD[t].col; g.fillRect(ox + x * cs + 1, oy + y * cs + 1, cs - 2, cs - 2); } }
            g.strokeStyle = '#fff'; g.strokeRect(ox + s.cx * cs, oy + s.cy * cs, cs, cs); fillText(g, `CASH ${s.cash}  POP ${s.pop}/${C.goalPop}  FOOD ${s.food}  DAY ${s.day}`, 4, 12, '#fff', 8); fillText(g, 'Build: ' + A.BUILD[s.sel].n + ' ($' + A.BUILD[s.sel].c + ')  ' + s.msg, 4, H - 6, '#ff0', 9); end(g, s); } };
    };

    /* ---------------------------------------------------------------- coloring book (colour by number) */
    A.PICS = { house: ['............', '.....22.....', '....2222....', '...222222...', '..22222222..', '.2222222222.', '.1111111111.', '.1133113311.', '.1133113311.', '.1111441111.', '.1111441111.', '............'],
        heart: ['............', '..111..111..', '.11111111111', '.11111111111', '.11111111111', '..111111111.', '...1111111..', '....11111...', '.....111....', '......1.....', '............', '............'],
        fish: ['............', '............', '...2222.....', '..222222..3.', '.22222222.33', '.2422222.333', '.22222222.33', '..222222..3.', '...2222.....', '............', '............', '............'] };
    A.PAINTCOL = ['#e84a4a', '#4a9be8', '#f5c542', '#4ae87a', '#2a2a2a'];
    A.paint = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.paint, cfg), pic = A.PICS[C.picture] || A.PICS.house, s = { status: 'play', score: 0, cx: 0, cy: 0, sel: 1, cells: pic.map(r => r.split('').map(ch => ch === '.' ? 0 : -1)), last: {}, left: 0 }, edge = (k, n) => { const v = !!k[n], w = !!s.last[n]; s.last[n] = v; return v && !w; };
        s.left = pic.join('').replace(/\./g, '').length;
        return { s, C, step(k) {
            if (s.status !== 'play') return; if (edge(k, 'ArrowLeft')) s.cx = Math.max(0, s.cx - 1); if (edge(k, 'ArrowRight')) s.cx = Math.min(11, s.cx + 1); if (edge(k, 'ArrowUp')) s.cy = Math.max(0, s.cy - 1); if (edge(k, 'ArrowDown')) s.cy = Math.min(11, s.cy + 1); if (edge(k, 'x')) s.sel = s.sel % 4 + 1;
            if (edge(k, 'z') && pic[s.cy][s.cx] !== '.') { const want = +pic[s.cy][s.cx], was = s.cells[s.cy][s.cx]; s.cells[s.cy][s.cx] = s.sel; if (s.sel === want && was !== want) { s.score += 10; s.left--; } else if (s.sel !== want && was === want) { s.left++; s.score -= 10; } if (s.left <= 0) s.status = 'win'; }
        }, draw(g) {
            g.fillStyle = '#fff8e8'; g.fillRect(0, 0, W, H); const cs = 16, ox = 20, oy = 24; for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const ch = pic[y][x]; if (ch === '.') continue; g.fillStyle = s.cells[y][x] > 0 ? A.PAINTCOL[s.cells[y][x] - 1] : '#eee'; g.fillRect(ox + x * cs, oy + y * cs, cs - 1, cs - 1); if (s.cells[y][x] < 1) fillText(g, ch, ox + x * cs + 8, oy + y * cs + 12, '#999', 9, 'center'); }
            g.strokeStyle = C.color; g.lineWidth = 2; g.strokeRect(ox + s.cx * cs, oy + s.cy * cs, cs - 1, cs - 1); for (let i = 1; i <= 4; i++) { g.fillStyle = A.PAINTCOL[i - 1]; g.fillRect(240, 40 + i * 28, 30, 22); fillText(g, String(i), 280, 56 + i * 28, '#333', 12); if (i === s.sel) { g.strokeStyle = '#000'; g.strokeRect(238, 38 + i * 28, 34, 26); } }
            fillText(g, C.title.toUpperCase() + '  Paint the numbers: 1=red 2=blue 3=yellow 4=green', 4, 12, '#333', 8); fillText(g, 'LEFT ' + s.left, 4, H - 4, '#333', 9); end(g, s); } };
    };

    /* ---------------------------------------------------------------- hoops (timing meter) */
    A.hoops = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.hoops, cfg), r = rng(o.seed || 1), s = { status: 'play', score: 0, made: 0, t: C.seconds * 60, meter: 0, dir: 1, ball: null, last: {}, aim: 0, msg: '', hx: W / 2 }, edge = (k, n) => { const v = !!k[n], w = !!s.last[n]; s.last[n] = v; return v && !w; };
        return { s, C, step(k) {
            if (s.status !== 'play') return; s.t--; s.hx = W / 2 + Math.sin(s.t / 90) * 40; if (!s.ball) { s.aim = clamp(s.aim + ax(k) * .02, -.5, .5); s.meter += s.dir * C.meterSpeed; if (s.meter > 100 || s.meter < 0) { s.dir = -s.dir; s.meter = clamp(s.meter, 0, 100); } if (edge(k, 'z')) { const err = Math.abs(s.meter - 62); s.ball = { f: 0, good: err < 9 && Math.abs(s.aim) < .3, perfect: err < 3 }; s.msg = ''; } }
            else { s.ball.f++; if (s.ball.f > 60) { if (s.ball.good) { s.made++; s.score += s.ball.perfect ? 3 : 2; s.msg = s.ball.perfect ? 'PERFECT!' : 'SWISH!'; } else s.msg = 'MISS'; s.ball = null; s.meter = 0; } }
            if (s.t <= 0) s.status = s.made >= C.goal ? 'win' : 'lose';
        }, draw(g) {
            g.fillStyle = '#c8905a'; g.fillRect(0, 0, W, H); g.fillStyle = '#b07848'; g.fillRect(0, 150, W, 90); g.fillStyle = '#fff'; g.fillRect(s.hx - 22, 40, 44, 28); g.strokeStyle = C.color; g.lineWidth = 3; g.beginPath(); g.ellipse(s.hx, 72, 14, 4, 0, 0, 7); g.stroke();
            const bx = W / 2 + s.aim * 60, by = s.ball ? 200 - Math.sin(s.ball.f / 60 * Math.PI) * 120 - (s.ball.f / 60) * 60 : 200; g.fillStyle = C.color; g.beginPath(); g.arc(s.ball ? bx + (s.hx - bx) * s.ball.f / 60 : bx, by, 9, 0, 7); g.fill(); g.fillStyle = '#222'; g.fillRect(40, H - 24, 240, 10); g.fillStyle = '#4ae87a'; g.fillRect(40 + 240 * .53, H - 24, 240 * .18, 10); g.fillStyle = '#fff'; g.fillRect(40 + 2.4 * s.meter - 2, H - 28, 4, 18);
            fillText(g, `TIME ${Math.ceil(s.t / 60)}  MADE ${s.made}/${C.goal}  ${s.msg}`, 4, 12, '#fff', 9); fillText(g, 'SCORE ' + s.score, W - 4, 12, '#fff', 9, 'right'); end(g, s); } };
    };



    /* ---------------------------------------------------------------- basketball: 2-on-2 street game (NBA Jam / Street Hoops shape).
     * Arrows move, Z shoot or dunk (on defense: jump to block), X pass (on defense: steal), C turbo. Shot odds fall with distance and with a defender in your face;
     * a dunk needs turbo and a clear lane. Teammates and rivals run a simple half-court AI (ball handler drives, others space the floor, defenders mark and reach). */
    /* design = { home / away: { name, color, players: [{ name, speed .6-1.5, shooting .6-1.4, dunk 0-1.5, defense .5-1.5 } x2] }, court: '#rrggbb' } */
    A.BASKETBALL_DESIGN = () => ({ home: { name: 'Home', color: '#f58a42', players: [{ name: 'Ace', speed: 1.1, shooting: 1, dunk: 1, defense: 1 }, { name: 'Big', speed: .85, shooting: .9, dunk: 1.4, defense: 1.2 }] }, away: { name: 'Away', color: '#4ae8ff', players: [{ name: 'Flash', speed: 1.25, shooting: 1.1, dunk: .8, defense: .9 }, { name: 'Tank', speed: .8, shooting: .85, dunk: 1.3, defense: 1.3 }] }, court: '#c8905a' });
    A.DEFAULTS.basketball = { title: 'Street Hoops', seconds: 90, goal: 21, skill: 1, turbo: 1, color: '#f58a42', color2: '#4ae8ff' };
    A.MODES.basketball = { name: 'Basketball (2-on-2 street game)', controls: 'Arrows move, Z shoot / dunk / block, X pass / steal, C turbo', genres: ['basketball'] };
    A.basketball = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.basketball, cfg), r = rng(o.seed || 1), COURT = { x0: 8, x1: W - 8, y0: 96, y1: H - 14 }, HX = [14, W - 14], HY = 78;
        const BD = C.design && C.design.home && C.design.away ? C.design : null, TEAM = [BD ? BD.home : null, BD ? BD.away : null], TC = [BD ? BD.home.color : C.color, BD ? BD.away.color : C.color2], COURTC = BD && BD.court ? BD.court : '#c8905a';
        const rate = (team, i) => { const p = BD && TEAM[team].players[i]; return p ? { speed: p.speed, shoot: p.shooting, dunk: p.dunk, def: p.defense, name: p.name } : { speed: 1, shoot: 1, dunk: 1, def: 1, name: '' }; };
        const mk = (team, i, x, y) => ({ team, i, x, y, z: 0, vz: 0, face: team ? -1 : 1, st: 0, cool: 0, turbo: 100, r: rate(team, i) });
        const s = { status: 'play', score: [0, 0], t: C.seconds * 60, P: [mk(0, 0, 80, 150), mk(0, 1, 110, 120), mk(1, 0, 230, 150), mk(1, 1, 200, 120)], ball: { x: 80, y: 150, z: 14, vx: 0, vy: 0, vz: 0, h: 0, shot: null }, ctl: 0, last: {}, msg: '', msgT: 0, hang: 0, poss: 0, shotClock: 24 * 60, combo: 0 };
        const edge = (k, n) => { const v = !!k[n], w = !!s.last[n]; s.last[n] = v; return v && !w; }, tgt = t => HX[t ? 0 : 1], say = (m, n = 70) => { s.msg = m; s.msgT = n; };
        const holder = () => s.ball.h >= 0 && s.ball.h !== null && s.ball.shot === null ? s.P[s.ball.h] : null; s.ball.h = 0;
        const sc = (t, n, how) => { s.score[t] += n; say(how + (n === 3 ? ' THREE!' : '!')); s.ball.h = null; s.ball.shot = null; const p = s.P[t ? 1 : 2]; s.P[0].x = 70; s.P[1].x = 110; s.P[2].x = 230; s.P[3].x = 200; s.P.forEach((q, i) => { q.y = 110 + (i % 2) * 40; q.z = 0; }); s.ball.h = t ? 0 : 2; s.shotClock = 24 * 60; s.poss = t ? 0 : 1; s.combo = 0; };
        const shootOdds = p => { const d = dist(p.x, p.y, tgt(p.team), HY + 30), dq = s.P.filter(q => q.team !== p.team).sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y))[0], def = dist(p.x, p.y, dq.x, dq.y), base = 0.88 - d / 330 - (def < 26 ? .3 * dq.r.def * (1 - def / 26) : 0); return clamp(base * p.r.shoot + (p.team ? -(C.skill - 1) * .08 : 0), .08, .95); };
        const doShot = (p, dunk) => { const b = s.ball, t = tgt(p.team); b.h = null; if (dunk) { p.vz = 4.6; p.st = 3; s.hang = 22; b.shot = { p, dunk: true, odds: .98, f: 0, tx: t }; return; } p.vz = 3.2; const od = shootOdds(p), three = dist(p.x, p.y, t, HY + 30) > 120; b.shot = { p, dunk: false, odds: od, f: 0, tx: t, three, good: r() < od, sx: b.x, sy: b.y }; };
        const nearest = (t, x, y, ex) => s.P.filter(q => q.team === t && q !== ex).sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y))[0];
        const move = (p, dx, dy, sp) => { const n = Math.hypot(dx, dy) || 1, run = p.turbo > 0 && p.runT; const v = (sp + (run ? 1.1 : 0)) * (p.team ? C.skill > 1 ? 1.05 : 1 : 1) * p.r.speed; p.x = clamp(p.x + dx / n * v, COURT.x0, COURT.x1); p.y = clamp(p.y + dy / n * v * .8, COURT.y0, COURT.y1); if (Math.abs(dx) > .3) p.face = Math.sign(dx); };
        const ai = (p, k) => { const b = s.ball, h = holder(), mine = h && h.team === p.team, t = tgt(p.team);
            if (p.z > 0 || p.cool > 0) { p.cool--; return; }
            if (h === p) { move(p, t - p.x, 140 - p.y, 1.5); const d = dist(p.x, p.y, t, HY + 30); if (d < 34 && p.turbo > 20 && r() < .06 * p.r.dunk) doShot(p, true); else if ((d < 96 && r() < .02 * C.skill) || s.shotClock < 70 || (d < 130 && r() < .006)) doShot(p, false); else if (r() < .008) { const m = nearest(p.team, p.x, p.y, p); b.h = m.team * 2 + m.i; } return; }
            if (mine) { const spot = [[t + (p.team ? 70 : -70), 126], [t + (p.team ? 120 : -120), 160]][p.i]; move(p, spot[0] - p.x, spot[1] - p.y, 1.1); return; }
            if (h) { const mark = s.P.filter(q => q.team === h.team).sort((a, c) => (a === h) - (c === h)).filter(q => q !== h)[0], tg2 = p.i === 0 ? h : mark; move(p, tg2.x - p.x, tg2.y - p.y, 1.25 * (C.skill > 1 ? 1.1 : 1)); if (p.i === 0 && dist(p.x, p.y, h.x, h.y) < 14 && r() < .05 * C.skill) { if (r() < .5) { s.ball.h = p.team * 2 + p.i; say('STEAL!'); } else { p.cool = 14; } } if (p.i === 0 && s.ball.shot === null && dist(p.x, p.y, h.x, h.y) < 24 && r() < .01) p.vz = 3; return; }
            move(p, b.x - p.x, b.y - p.y, 1.3); };
        return { s, C, step(k) {
            if (s.status !== 'play') return; s.t--; s.shotClock--; if (s.msgT > 0) s.msgT--; const b = s.ball, h0 = holder();
            if (s.t <= 0) { s.status = s.score[0] > s.score[1] ? 'win' : s.score[0] < s.score[1] ? 'lose' : (s.t = 20 * 60, 'play'); if (s.status === 'play') say('OVERTIME!'); return; }
            if (s.shotClock <= 0 && h0) { s.shotClock = 24 * 60; if (h0.team === 0) { b.h = 2; say('SHOT CLOCK!'); } else { b.h = 0; say('SHOT CLOCK!'); } }
            // who does the human control: the ball holder if on team 0, else the teammate nearest the ball
            const me = h0 && h0.team === 0 ? h0 : nearest(0, b.x, b.y), mate = s.P[me === s.P[0] ? 1 : 0];
            const mx = ax(k), my = ay(k), tb = !!k.c && me.turbo > 0; me.runT = tb; me.turbo = clamp(me.turbo + (tb && (mx || my) ? -1.1 * C.turbo : .35), 0, 100); if (mx || my) move(me, mx, my, 1.7);
            // human buttons
            if (edge(k, 'z') && me.z === 0) { if (h0 === me) { const d = dist(me.x, me.y, tgt(0), HY + 30); doShot(me, d < 38 && tb && me.r.dunk > .3); } else if (h0 && h0.team === 1) { me.vz = 3.4; me.st = 2; } }
            if (edge(k, 'x')) { if (h0 === me) { b.h = mate.team * 2 + mate.i; say('PASS'); } else if (h0 && h0.team === 1 && dist(me.x, me.y, h0.x, h0.y) < 22) { if (r() < .55 / C.skill) { b.h = me.i; say('STEAL!'); } else me.cool = 12; } else if (!h0 && b.shot === null && dist(me.x, me.y, b.x, b.y) < 30) b.h = me.i; }
            // AI for everyone else
            s.P.forEach(p => { if (p !== me) ai(p, k); });
            // jumping
            s.P.forEach(p => { if (p.vz !== 0 || p.z > 0) { p.z += p.vz; p.vz -= .32; if (p.z <= 0) { p.z = 0; p.vz = 0; p.st = 0; } if (p.st === 3 && p.vz < 0 && s.hang-- > 0) { p.vz = 0; p.z = Math.max(p.z, 14); } } });
            // dunk resolution
            if (b.shot && b.shot.dunk) { const p = b.shot.p; b.x = p.x + p.face * 4; b.y = p.y; b.z = 24 + p.z; p.x += (b.shot.tx - p.x) * .1; b.shot.f++; if (b.shot.f > 14) { const blocked = s.P.some(q => q.team !== p.team && q.z > 8 && dist(q.x, q.y, p.x, p.y) < 18); if (blocked && r() < .5) { say('BLOCKED!'); b.shot = null; b.h = null; b.vx = (r() - .5) * 3; b.vy = (r() - .5) * 2; b.vz = 2; } else sc(p.team, 2, 'SLAM DUNK'); return; } }
            // jump shot flight
            else if (b.shot) { const sh = b.shot, p = sh.p; sh.f++; const u = sh.f / 50; b.x = sh.sx + (sh.tx - sh.sx) * u; b.y = sh.sy + (HY + 30 - sh.sy) * u; b.z = 12 + Math.sin(u * Math.PI) * 54 + (HY - 12) * u * .5; const blk = s.P.find(q => q.team !== p.team && q.z > 10 && dist(q.x, q.y, p.x, p.y) < 20 && sh.f < 10); if (blk && r() < .5) { say('REJECTED!'); b.shot = null; b.h = null; b.vx = (r() - .5) * 3; b.vy = (r() - .5) * 2; b.vz = 2; } else if (sh.f >= 50) { if (sh.good) sc(p.team, sh.three ? 3 : 2, 'SWISH'); else { say('MISS'); b.shot = null; b.h = null; b.vx = (r() - .5) * 3 + (p.team ? 1 : -1); b.vy = (r() - .5) * 2; b.vz = 2.4; } return; } }
            // ball follows holder / loose ball physics
            const h = holder(); if (h) { b.x = h.x + h.face * 8; b.y = h.y; b.z = 10 + h.z + Math.abs(Math.sin(s.t / 5)) * 6; } else if (!b.shot) { b.x = clamp(b.x + b.vx, COURT.x0, COURT.x1); b.y = clamp(b.y + b.vy, COURT.y0 - 10, COURT.y1); b.vz -= .22; b.z += b.vz; if (b.z < 2) { b.z = 2; b.vz = Math.abs(b.vz) * .5; b.vx *= .9; b.vy *= .9; } if (b.z < 22) { const q = s.P.filter(p => dist(p.x, p.y, b.x, b.y) < 14).sort((a, c) => dist(a.x, a.y, b.x, b.y) - dist(c.x, c.y, b.x, b.y))[0]; if (q) { b.h = q.team * 2 + q.i; b.vx = b.vy = 0; if (q.team !== s.poss) { s.poss = q.team; s.shotClock = 24 * 60; } } } }
        }, draw(g) {
            g.fillStyle = '#2b3350'; g.fillRect(0, 0, W, H); g.fillStyle = COURTC; g.fillRect(0, 92, W, H - 92); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(8, 96, W - 16, H - 110); g.beginPath(); g.moveTo(W / 2, 96); g.lineTo(W / 2, H - 14); g.stroke(); g.beginPath(); g.arc(W / 2, 150, 22, 0, 7); g.stroke(); for (const t of [0, 1]) { const x = HX[t]; g.beginPath(); g.arc(x, HY + 30, 120, t ? Math.PI * .6 : -Math.PI * .4, t ? Math.PI * 1.4 : Math.PI * .4); g.stroke(); }
            for (const t of [0, 1]) { const x = HX[t]; g.fillStyle = '#eee'; g.fillRect(x - (t ? 0 : 3), HY - 18, 3, 22); g.fillStyle = C.color; g.fillRect(x + (t ? -14 : 0), HY + 2, 14, 2); }
            const list = s.P.slice().sort((a, b) => a.y - b.y), b = s.ball; g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(b.x, b.y + 2, 4, 2, 0, 0, 7); g.fill();
            for (const p of list) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(p.x, p.y + 1, 7, 3, 0, 0, 7); g.fill(); const col = TC[p.team], y = p.y - p.z, up = p.st === 3 ? 6 : 0; g.fillStyle = '#d9a37a'; g.fillRect(p.x - 3, y - 26 - up, 6, 6); g.fillStyle = col; g.fillRect(p.x - 4, y - 20 - up, 8, 11); g.fillStyle = '#222'; g.fillRect(p.x - 4, y - 9 - up, 3, 8 + (up ? -2 : 0)); g.fillRect(p.x + 1, y - 9 - up, 3, 8 + (up ? -2 : 0)); if (p.st) { g.fillStyle = col; g.fillRect(p.x + p.face * 4, y - 30 - up, 2, 10); } }
            const me = holder() && holder().team === 0 ? holder() : nearest(0, b.x, b.y); if (me.r.name) fillText(g, me.r.name, me.x, me.y - me.z - 46, '#ffe38a', 7, 'center'); g.fillStyle = '#ffe38a'; g.beginPath(); g.moveTo(me.x, me.y - me.z - 36); g.lineTo(me.x - 4, me.y - me.z - 42); g.lineTo(me.x + 4, me.y - me.z - 42); g.fill();
            g.fillStyle = '#f58a42'; g.beginPath(); g.arc(b.x, b.y - b.z, 3.6, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 1; g.stroke();
            fillText(g, `${C.title}`, 4, 12, '#fff', 9); fillText(g, `YOU ${s.score[0]}  -  ${s.score[1]} CPU   ${Math.ceil(s.t / 60)}s   CLOCK ${Math.ceil(s.shotClock / 60)}`, W / 2, 26, '#ffe38a', 10, 'center');
            g.fillStyle = '#222'; g.fillRect(8, 36, 60, 5); g.fillStyle = '#ffd24a'; g.fillRect(8, 36, 60 * me.turbo / 100, 5); fillText(g, 'TURBO', 8, 50, '#fff', 7); if (s.msgT > 0) fillText(g, s.msg, W / 2, 70, '#fff', 14, 'center'); end(g, s); } };
    };

    /* ---------------------------------------------------------------- military shooter (Call of Duty / Halo style): campaign missions and zombie mode */
    A.WEAPONS = [
        { id: 'pistol', name: 'M9 Pistol', dmg: 2, rate: 16, mag: 12, spread: .02, pellets: 1, cost: 0, reserve: 60 },
        { id: 'smg', name: 'MP5 SMG', dmg: 1.4, rate: 5, mag: 30, spread: .06, pellets: 1, cost: 500, reserve: 150 },
        { id: 'rifle', name: 'M4 Rifle', dmg: 2.4, rate: 7, mag: 30, spread: .03, pellets: 1, cost: 900, reserve: 120 },
        { id: 'shotgun', name: 'Shotgun', dmg: 1.6, rate: 34, mag: 6, spread: .16, pellets: 6, cost: 1200, reserve: 36 },
        { id: 'sniper', name: 'Sniper', dmg: 9, rate: 50, mag: 5, spread: .004, pellets: 1, cost: 1800, reserve: 25 }
    ];
    A.MISSIONS = [
        { name: 'Insertion', brief: 'Clear the compound and reach the extraction point.', goal: 'extract', size: 18, enemies: 7, intel: 0 },
        { name: 'Dark Hangar', brief: 'Eliminate the garrison. No survivors.', goal: 'kill', size: 20, enemies: 11, intel: 0 },
        { name: 'Black File', brief: 'Recover the intel briefcase, then extract.', goal: 'intel', size: 22, enemies: 13, intel: 1 },
        { name: 'Last Light', brief: 'Fight through to the command post. Extract alive.', goal: 'extract', size: 24, enemies: 17, intel: 0 }
    ];
    A.military = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.military, cfg), r = rng(o.seed || 1), Z = C.mode === 'zombies';
        let mi = Math.min(C.mission || 0, A.MISSIONS.length - 1), N, M, s;
        const wallAt = (x, y) => { const row = M[Math.floor(y)]; return !row || row[Math.floor(x)] !== 0; };
        const cast = a => { let d = 0, dx = Math.cos(a), dy = Math.sin(a); while (d < 26) { d += .05; if (wallAt(s.x + dx * d, s.y + dy * d)) return d; } return 26; };
        const free = (x, y) => !wallAt(x, y) && !wallAt(x + .25, y) && !wallAt(x - .25, y) && !wallAt(x, y + .25) && !wallAt(x, y - .25);
        let reach = null; const flood = (sx, sy) => { const seen = new Set([sx + ',' + sy]), q = [[sx, sy]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx > 0 && ny > 0 && nx < N - 1 && ny < N - 1 && M[ny][nx] === 0 && !seen.has(nx + ',' + ny)) { seen.add(nx + ',' + ny); q.push([nx, ny]); } } } return seen; };
        const spawnPoint = (minD) => { let x, y, n = 0; do { x = 2 + r() * (N - 4); y = 2 + r() * (N - 4); n++; } while ((wallAt(x, y) || !reach.has(Math.floor(x) + ',' + Math.floor(y)) || dist(x, y, s ? s.x : 1.5, s ? s.y : 1.5) < minD) && n < 400); return [x, y]; };
        const build = () => {
            const m = A.MISSIONS[mi]; N = Z ? 20 : m.size; M = []; for (let y = 0; y < N; y++) { M.push([]); for (let x = 0; x < N; x++) M[y].push(x === 0 || y === 0 || x === N - 1 || y === N - 1 ? 1 : 0); }
            const blocks = Z ? 18 : N; for (let i = 0; i < blocks; i++) { const x = 3 + Math.floor(r() * (N - 6)), y = 3 + Math.floor(r() * (N - 6)), w = 1 + Math.floor(r() * 3), h = 1 + Math.floor(r() * 3); if (Math.abs(x - N / 2) < 3 && Math.abs(y - N / 2) < 3 && Z) continue; if (x < 4 && y < 4) continue; for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (xx < N - 2 && yy < N - 2) M[yy][xx] = 1; }
            { const sx0 = Z ? Math.floor(N / 2) : 1, sy0 = sx0; M[sy0][sx0] = 0; reach = flood(sx0, sy0); const need = Z ? [] : [[N - 3, N - 3]].concat(m.intel ? [[N - 4, 2]] : []); need.forEach(([x, y]) => { M[y][x] = 0; M[y - 1][x] = 0; M[y][x - 1] = 0; }); reach = flood(sx0, sy0); for (const [x, y] of need) { let cx = x, cy = y, guard = 0; while (!reach.has(cx + ',' + cy) && guard++ < 80) { if (cx > sx0) cx--; else if (cx < sx0) cx++; else if (cy > sy0) cy--; else cy++; M[cy][cx] = 0; } } reach = flood(sx0, sy0); }
            const keep = s ? { score: s.score, hp: s.hp, w: s.w, guns: s.guns, kills: s.kills } : null;
            s = { status: 'play', score: keep ? keep.score : 0, kills: keep ? keep.kills : 0, x: Z ? N / 2 + .5 : 1.5, y: Z ? N / 2 + .5 : 1.5, a: Z ? 0 : .8, hp: keep ? Math.min(100, keep.hp + 30) : C.health, w: keep ? keep.w : 0, guns: keep ? keep.guns : (Z ? [{ id: 'pistol', mag: 12, reserve: 60 }] : [{ id: 'pistol', mag: 12, reserve: 90 }, { id: 'rifle', mag: 30, reserve: 90 }]), en: [], eb: [], cool: 0, flash: 0, reload: 0, hurt: 0, grenades: 2, nade: null, round: 0, spawnLeft: 0, between: 120, intel: false, hasIntel: !m.intel, lastC: false, lastX: false, msg: Z ? '' : m.brief, msgT: 200, pts: 0, brief: Z ? 0 : 150, buyPad: { x: N / 2 + 2.5, y: N / 2 + .5 }, exit: { x: N - 2.5, y: N - 2.5 }, item: m.intel ? { x: N - 3.5, y: 2.5 } : null, ...(!Z ? {} : {}) };
            if (!Z) for (let i = 0; i < m.enemies; i++) { const [x, y] = spawnPoint(7); s.en.push({ x, y, hp: 3 + (mi > 1 ? 1 : 0), cd: 30 + Math.floor(r() * 60), type: 'soldier' }); }
            if (!Z) s.total = m.enemies;
        };
        build();
        const gun = () => A.WEAPONS.find(w => w.id === s.guns[s.w].id), say = (m, n) => { s.msg = m; s.msgT = n || 100; };
        const addEnemy = (hp) => { const [x, y] = spawnPoint(8); s.en.push({ x, y, hp, cd: 0, type: 'zombie', sp: .018 + Math.min(.02, s.round * .0012) }); };
        const reloadNow = () => { const g = s.guns[s.w], w = gun(); if (s.reload || g.mag >= w.mag || g.reserve <= 0) return; s.reload = 60; };
        const fire = () => {
            const g = s.guns[s.w], w = gun(); if (s.cool > 0 || s.reload) return; if (g.mag <= 0) { reloadNow(); return; }
            g.mag--; s.cool = w.rate; s.flash = 4;
            for (let p = 0; p < w.pellets; p++) {
                const a = s.a + (r() - .5) * w.spread * 2; let best = null;
                for (const e of s.en) { if (e.hp <= 0) continue; const ang = Math.atan2(e.y - s.y, e.x - s.x), da = Math.abs(((ang - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI), d = dist(e.x, e.y, s.x, s.y); if (da < .11 / Math.max(.7, d / 4) + .03 && d < cast(ang) + .2 && (!best || d < best.d)) best = { e, d }; }
                if (best) { best.e.hp -= w.dmg; s.pts += 10; s.score += 10; best.e.hit = 5; if (best.e.hp <= 0) { s.kills++; s.score += Z ? 60 : 100; s.pts += Z ? 60 : 0; if (!Z) s.guns.forEach(gg => { gg.reserve += Math.ceil(A.WEAPONS.find(w => w.id === gg.id).mag / 2); }); } }
            }
        };
        return { s, C, M, A_missions: A.MISSIONS, step(k) {
            if (s.status !== 'play') return;
            if (s.brief > 0) { s.brief--; if (!k.z) return; s.brief = 0; }
            s.cool--; s.flash--; if (s.hurt > 0) s.hurt--; if (s.msgT > 0) s.msgT--;
            s.a += ax(k) * .05; const mv = -ay(k) * .06, nx = s.x + Math.cos(s.a) * mv, ny = s.y + Math.sin(s.a) * mv; if (free(nx, s.y)) s.x = nx; if (free(s.x, ny)) s.y = ny;
            if (s.reload) { if (--s.reload === 0) { const g = s.guns[s.w], w = gun(), need = w.mag - g.mag, take = Math.min(need, g.reserve); g.mag += take; g.reserve -= take; } }
            const kx = !!k.x, kc = !!k.c; if (kx && !s.lastX) reloadNow();
            if (kc && !s.lastC) {
                const nearPad = Z && dist(s.x, s.y, s.buyPad.x, s.buyPad.y) < 1.4;
                if (nearPad) { const have = new Set(s.guns.map(g => g.id)), next = A.WEAPONS.find(w => !have.has(w.id));
                    if (next && s.pts >= next.cost) { s.pts -= next.cost; s.guns.push({ id: next.id, mag: next.mag, reserve: next.reserve }); s.w = s.guns.length - 1; say('BOUGHT ' + next.name, 80); }
                    else if (s.pts >= 200) { s.pts -= 200; const g = s.guns[s.w], w = gun(); g.reserve = w.reserve; g.mag = w.mag; say('AMMO REFILLED', 80); }
                    else say('NEED ' + (next ? next.cost : 200) + ' POINTS', 80); }
                else s.w = (s.w + 1) % s.guns.length;
            }
            s.lastX = kx; s.lastC = kc;
            if (s.guns[s.w].mag <= 0 && s.guns[s.w].reserve <= 0) { const o2 = s.guns.findIndex(gg => gg.mag > 0 || gg.reserve > 0); if (o2 >= 0) { s.w = o2; say('SWITCHED WEAPON', 50); } }
            if (k.z) fire(); else if (s.guns[s.w].mag <= 0) reloadNow();
            if (k.ArrowDown && k.ArrowUp && !s.nade && s.grenades > 0) { s.grenades--; s.nade = { x: s.x, y: s.y, dx: Math.cos(s.a) * .18, dy: Math.sin(s.a) * .18, t: 50 }; }
            if (s.nade) { const n = s.nade; if (wallAt(n.x + n.dx, n.y)) n.dx *= -.5; if (wallAt(n.x, n.y + n.dy)) n.dy *= -.5; n.x += n.dx; n.y += n.dy; if (--n.t <= 0) { for (const e of s.en) if (e.hp > 0 && dist(e.x, e.y, n.x, n.y) < 2.6) { e.hp -= 8; if (e.hp <= 0) { s.kills++; s.score += 100; s.pts += 60; } } if (dist(s.x, s.y, n.x, n.y) < 2) s.hp -= 25; s.nade = null; s.flash = 6; } }
            // enemies
            for (const e of s.en) {
                if (e.hp <= 0) continue; if (e.hit > 0) e.hit--; const d = dist(e.x, e.y, s.x, s.y);
                if (e.type === 'zombie') { if (e.lx !== undefined && Math.abs(e.x - e.lx) + Math.abs(e.y - e.ly) < .004) e.st = (e.st || 0) + 1; else e.st = 0; e.lx = e.x; e.ly = e.y; if (e.st > 100) { const [px, py] = spawnPoint(7); e.x = px; e.y = py; e.st = 0; } if (d > .8) { const nx = e.x + (s.x - e.x) / d * e.sp * 3, ny = e.y + (s.y - e.y) / d * e.sp * 3; if (!wallAt(nx, e.y)) e.x = nx; else if (!wallAt(e.x, e.y + Math.sign(s.y - e.y) * .03)) e.y += Math.sign(s.y - e.y) * .03; if (!wallAt(e.x, ny)) e.y = ny; else if (!wallAt(e.x + Math.sign(s.x - e.x) * .03, e.y)) e.x += Math.sign(s.x - e.x) * .03; } else if (--e.cd <= 0) { s.hp -= 14; e.cd = 38; s.hurt = 12; } }
                else { const ang = Math.atan2(s.y - e.y, s.x - e.x), los = cast(ang + 0) , seen = d < 12 && (function () { let t = 0; while (t < d) { t += .1; if (wallAt(e.x + Math.cos(ang) * t, e.y + Math.sin(ang) * t)) return false; } return true; })();
                    if (seen) { if (d > 4) { const nx = e.x + Math.cos(ang) * .018, ny = e.y + Math.sin(ang) * .018; if (!wallAt(nx, e.y)) e.x = nx; if (!wallAt(e.x, ny)) e.y = ny; } if (--e.cd <= 0) { e.cd = 55 + Math.floor(r() * 40); if (r() < Math.max(.2, .7 - d / 18)) { s.hp -= 6 + mi; s.hurt = 10; } } } void los; }
            }
            s.en = s.en.filter(e => e.hp > 0 || (e.dead = (e.dead || 0) + 1) < 25);
            if (Z) {
                const alive = s.en.filter(e => e.hp > 0).length;
                if (s.spawnLeft > 0) { if (s.between > 0) s.between--; else if (alive < 14 && (s.t = (s.t || 0) + 1) % 40 === 0) { addEnemy(2 + Math.floor(s.round * .8)); s.spawnLeft--; } }
                else if (alive === 0) { if (s.between > 0) s.between--; else { s.round++; s.spawnLeft = 4 + s.round * 3; s.between = 150; say('ROUND ' + s.round, 120); s.hp = Math.min(100, s.hp + 20); } }
                if (s.round === 0 && s.between === 120) { s.round = 0; }
                if (s.round === 0 && s.spawnLeft === 0 && alive === 0 && s.between > 0 && s.between <= 120) { /* first round starts after the opening pause */ }
                if (s.round >= C.rounds) s.status = 'win';
            } else {
                const alive = s.en.filter(e => e.hp > 0).length, m = A.MISSIONS[mi];
                if (s.item && !s.hasIntel && dist(s.x, s.y, s.item.x, s.item.y) < 1) { s.hasIntel = true; s.score += 300; say('INTEL SECURED - EXTRACT', 120); }
                const done = m.goal === 'kill' ? alive === 0 : m.goal === 'intel' ? s.hasIntel : alive <= Math.ceil(m.enemies * .4);
                if (done && s.hasIntel && (m.goal === 'kill' ? true : dist(s.x, s.y, s.exit.x, s.exit.y) < 1.2)) { s.score += 500; if (mi + 1 < A.MISSIONS.length && !C.single) { mi++; build(); say('MISSION ' + (mi + 1) + ': ' + A.MISSIONS[mi].name.toUpperCase(), 140); } else s.status = 'win'; }
                else if (done && dist(s.x, s.y, s.exit.x, s.exit.y) < 1.2 && !s.hasIntel) say('GET THE INTEL FIRST', 60);
            }
            if (s.hp <= 0) s.status = 'lose';
        }, draw(g) {
            g.fillStyle = Z ? '#1a1020' : '#2a3140'; g.fillRect(0, 0, W, H / 2); g.fillStyle = Z ? '#2a2018' : '#3a3a34'; g.fillRect(0, H / 2, W, H / 2);
            const depth = []; for (let col = 0; col < W; col += 2) { const a = s.a + (col / W - .5) * 1.05, d = cast(a) * Math.cos(a - s.a), h = Math.min(H * 1.6, 130 / Math.max(.2, d)); depth[col] = d; const sh = Math.max(.15, 1 - d / 14); g.fillStyle = Z ? `rgb(${90 * sh | 0},${70 * sh | 0},${70 * sh | 0})` : `rgb(${110 * sh | 0},${125 * sh | 0},${95 * sh | 0})`; g.fillRect(col, H / 2 - h / 2, 2, h); }
            const things = s.en.map(e => ({ x: e.x, y: e.y, e })).concat([{ x: s.exit.x, y: s.exit.y, ex: 1 }], s.item && !s.hasIntel ? [{ x: s.item.x, y: s.item.y, it: 1 }] : [], Z ? [{ x: s.buyPad.x, y: s.buyPad.y, pad: 1 }] : [], s.nade ? [{ x: s.nade.x, y: s.nade.y, nade: 1 }] : []).sort((a, b) => dist(b.x, b.y, s.x, s.y) - dist(a.x, a.y, s.x, s.y));
            for (const t of things) { const ang = Math.atan2(t.y - s.y, t.x - s.x), da = ((ang - s.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI, d = dist(t.x, t.y, s.x, s.y); if (Math.abs(da) > .7 || d < .3) continue; const sx = (da / 1.05 + .5) * W, sz = Math.min(190, 100 / Math.max(.3, d)); if (depth[Math.max(0, Math.min(W - 2, Math.round(sx / 2) * 2))] < d - .2) continue;
                const base = H / 2 + sz * .35; if (t.e) { const e = t.e, dead = e.hp <= 0, z = e.type === 'zombie'; g.save(); g.translate(sx, base); if (dead) g.rotate(Math.min(1.5, (e.dead || 0) / 12)); g.fillStyle = e.hit > 0 ? '#fff' : (z ? '#6a8a4a' : '#7a6a4a'); g.fillRect(-sz * .16, -sz * .95, sz * .32, sz * .55); g.fillStyle = z ? '#8aaa6a' : '#e8c8a0'; g.fillRect(-sz * .1, -sz * 1.15, sz * .2, sz * .22); g.fillStyle = z ? '#3a4a2a' : '#3a4a60'; g.fillRect(-sz * .14, -sz * .4, sz * .12, sz * .4); g.fillRect(sz * .02, -sz * .4, sz * .12, sz * .4); g.fillStyle = z ? '#c33' : '#222'; g.fillRect(-sz * .08, -sz * 1.08, sz * .05, sz * .04); g.fillRect(sz * .03, -sz * 1.08, sz * .05, sz * .04); g.restore(); }
                else if (t.ex) { g.fillStyle = '#4ae87a'; g.fillRect(sx - sz * .15, base - sz * .9, sz * .3, sz * .9); g.fillStyle = '#0a3'; g.fillRect(sx - sz * .1, base - sz * .8, sz * .2, sz * .7); }
                else if (t.it) { g.fillStyle = '#f5c542'; g.fillRect(sx - sz * .12, base - sz * .3, sz * .24, sz * .2); }
                else if (t.pad) { g.fillStyle = '#4ae8ff'; g.fillRect(sx - sz * .2, base - sz * .25, sz * .4, sz * .05); g.fillRect(sx - sz * .02, base - sz * .6, sz * .04, sz * .35); }
                else if (t.nade) { g.fillStyle = '#6a6'; g.fillRect(sx - 3, base - 6, 6, 6); } }
            if (s.hurt > 0) { g.fillStyle = `rgba(200,0,0,${s.hurt / 24})`; g.fillRect(0, 0, W, H); }
            if (s.flash > 0) { g.fillStyle = '#fd8'; g.fillRect(W / 2 - 4, H - 70, 8, 14); }
            g.fillStyle = '#ccc'; g.fillRect(W / 2 - 1, H / 2 - 7, 2, 14); g.fillRect(W / 2 - 7, H / 2 - 1, 14, 2); g.fillStyle = '#333'; g.fillRect(W / 2 - 6, H - 56, 12, 56); g.fillStyle = '#555'; g.fillRect(W / 2 - 3, H - 66, 6, 20);
            const gn = s.guns[s.w], wp = gun(); fillText(g, 'HP ' + Math.max(0, Math.round(s.hp)) + '   ' + wp.name.toUpperCase() + ' ' + gn.mag + '/' + gn.reserve + (s.reload ? ' RELOAD' : '') + '   GREN ' + s.grenades, 4, H - 4, '#fff', 8);
            fillText(g, Z ? 'ROUND ' + s.round + '/' + C.rounds + '  POINTS ' + s.pts : 'M' + (mi + 1) + ' ' + A.MISSIONS[mi].name.toUpperCase() + '  KILLS ' + s.kills, 4, 10, '#fff', 9); fillText(g, 'SCORE ' + s.score, W - 4, 10, '#fff', 8, 'right');
            if (s.msgT > 0 && s.msg) fillText(g, s.msg, W / 2, 40, '#ffe14a', 10, 'center');
            if (s.brief > 0) { g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(20, 60, W - 40, 90); fillText(g, 'MISSION ' + (mi + 1) + ': ' + A.MISSIONS[mi].name.toUpperCase(), W / 2, 84, '#4ae8ff', 11, 'center'); fillText(g, A.MISSIONS[mi].brief, W / 2, 106, '#fff', 8, 'center'); fillText(g, 'PRESS FIRE', W / 2, 136, '#9aa', 8, 'center'); }
            end(g, s); } };
    };


    /* ---------------------------------------------------------------- bracelet shop (jewelry-making life sim): customers, orders, weaving, thread stock, rent, reputation */
    A.CRAFT_PATTERNS = { stripes: n => (x, y) => (x + 0) % 3, chevron: (n) => (x, y) => (Math.floor(Math.abs(x - (n - 1) / 2)) + y) % 3, diagonal: () => (x, y) => (x + y) % 3, candy: () => (x, y) => (x + (y >> 1)) % 2, diamond: (n) => (x, y) => { const c = (n - 1) / 2, d = Math.abs(x - c) + Math.abs((y % (n + 1)) - c); return Math.min(2, Math.floor(d / 2)); }, hearts: (n) => (x, y) => ((y % 4 === 0 && (x === 1 || x === n - 2)) || (y % 4 === 1) || (y % 4 === 2 && x > 0 && x < n - 1) || (y % 4 === 3 && x > 1 && x < n - 2 && n > 4)) ? 1 : 0 };
    A.CRAFT_COLORS = ['#e84a8a', '#f5c542', '#4a9be8', '#4ae87a', '#a855f7', '#f58a42', '#ffffff', '#222222'];
    A.CRAFT_NAMES = ['Rebecca', 'Austin', 'Daisy', 'Pearl', 'Squid', 'Joe', 'Michelle', 'Wendell', 'Mamaw', 'Gus'];
    A.craft = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.craft, cfg), r = rng(o.seed || 1), pats = Object.keys(A.CRAFT_PATTERNS), n = C.threads;
        const s = { status: 'play', score: 0, day: 1, cash: C.cash, rep: 1, stock: [8, 8, 8, 8, 4, 4, 4, 4], screen: 'order', cust: null, served: 0, dayServed: 0, unlocked: 2, order: null, row: 0, rowsDone: [], cur: new Array(n).fill(0), sel: 0, cc: 0, quality: 0, marker: 0, dir: 1, msg: '', msgT: 0, last: {}, shopSel: 0, earned: 0, daySales: 0, dayLeft: C.perDay, tick: 0 };
        const edge = (k, nme) => { const v = !!k[nme], w = !!s.last[nme]; s.last[nme] = v; return v && !w; };
        const say = (m, t) => { s.msg = m; s.msgT = t || 90; };
        const newCust = () => { const id = pats[Math.floor(r() * s.unlocked)], pal = []; while (pal.length < 3) { const c = Math.floor(r() * A.CRAFT_COLORS.length); if (!pal.includes(c)) pal.push(c); } s.cust = { name: A.CRAFT_NAMES[Math.floor(r() * A.CRAFT_NAMES.length)], pattern: id, pal, rows: C.rows + Math.floor(s.rep / 2), pay: Math.round(20 + s.rep * 6 + Math.floor(r() * 10)), patience: 1 }; s.screen = 'order'; };
        const startWeave = () => { const need = [0, 0, 0, 0, 0, 0, 0, 0]; s.cust.pal.forEach(c => { need[c] += Math.ceil(s.cust.rows / 3); }); const miss = s.cust.pal.find(c => s.stock[c] < Math.ceil(s.cust.rows / 3)); if (miss !== undefined) { say('Not enough ' + ['PINK', 'GOLD', 'BLUE', 'GREEN', 'PURPLE', 'ORANGE', 'WHITE', 'BLACK'][miss] + ' thread! Press C for the shop.', 120); return; } s.cust.pal.forEach(c => { s.stock[c] -= Math.ceil(s.cust.rows / 3); }); s.screen = 'weave'; s.row = 0; s.rowsDone = []; s.quality = 0; s.cur = new Array(n).fill(0); s.sel = 0; s.marker = 0; s.stage = 'pick'; };
        const gen = () => A.CRAFT_PATTERNS[s.cust.pattern](n);
        const target = (x, y) => s.cust.pal[gen()(x, y) % 3];
        const finish = () => { const q = Math.max(0, Math.min(1, s.quality / s.cust.rows)), pay = Math.round(s.cust.pay * (.4 + q * .9)), tip = q > .85 ? 5 + Math.floor(s.rep) : 0; s.cash += pay + tip; s.earned += pay + tip; s.score += pay + tip; s.served++; s.dayServed++; if (q > .8) { s.rep += .4; } else if (q < .4) s.rep = Math.max(1, s.rep - .3); say(s.cust.name + ': ' + (q > .85 ? 'PERFECT! +$' + (pay + tip) : q > .5 ? 'Nice! +$' + pay : 'Meh... +$' + pay), 120); s.dayLeft--; s.cust = null; s.screen = s.dayLeft > 0 ? 'order' : 'summary'; if (s.screen === 'order') newCust(); if (s.screen === 'summary') { s.cash -= C.rent; s.sumT = 0; s.unlocked = Math.min(pats.length, 2 + Math.floor(s.rep)); } };
        newCust();
        return { s, C, step(k) {
            if (s.status !== 'play') return; if (s.msgT > 0) s.msgT--;
            if (s.screen === 'order') { if (edge(k, 'z')) startWeave(); if (edge(k, 'x')) { s.dayLeft--; s.rep = Math.max(1, s.rep - .2); say('You turned ' + s.cust.name + ' away.', 80); if (s.dayLeft > 0) newCust(); else { s.screen = 'summary'; s.cash -= C.rent; s.sumT = 0; } } if (edge(k, 'c')) s.screen = 'shop'; }
            else if (s.screen === 'shop') { if (edge(k, 'ArrowRight')) s.shopSel = (s.shopSel + 1) % 8; if (edge(k, 'ArrowLeft')) s.shopSel = (s.shopSel + 7) % 8; if (edge(k, 'z')) { if (s.cash >= 6) { s.cash -= 6; s.stock[s.shopSel] += 6; say('Bought 6 thread', 50); } else say('Not enough cash', 60); } if (edge(k, 'x') || edge(k, 'c')) s.screen = s.cust ? 'order' : 'summary'; }
            else if (s.screen === 'weave') {
                if (s.stage === 'pick') {
                    if (edge(k, 'ArrowRight')) s.sel = (s.sel + 1) % n; if (edge(k, 'ArrowLeft')) s.sel = (s.sel + n - 1) % n;
                    if (edge(k, 'ArrowUp')) s.cur[s.sel] = (s.cur[s.sel] + 1) % 3; if (edge(k, 'ArrowDown')) s.cur[s.sel] = (s.cur[s.sel] + 2) % 3;
                    if (edge(k, 'z')) { s.stage = 'knot'; s.marker = 0; s.dir = 1; s.speed = 2 + s.rep * .2; }
                } else { s.marker += s.dir * (s.speed || 2.5); if (s.marker > 100) { s.marker = 100; s.dir = -1; } if (s.marker < 0) { s.marker = 0; s.dir = 1; }
                    if (edge(k, 'z')) { let right = 0; for (let x = 0; x < n; x++) if (s.cust.pal[s.cur[x]] === target(x, s.row)) right++; const neat = Math.abs(s.marker - 50) < 14 ? 1 : Math.abs(s.marker - 50) < 28 ? .6 : .25, rowQ = (right / n) * (.6 + neat * .4); s.quality += rowQ; s.rowsDone.push({ cur: s.cur.slice(), q: rowQ }); s.row++; s.stage = 'pick'; if (s.row >= s.cust.rows) finish(); } }
            } else if (s.screen === 'summary') { s.sumT++; if (edge(k, 'z') && s.sumT > 20) { if (s.cash < 0) { s.status = 'lose'; } else if (s.cash >= C.goalCash || s.day >= C.days) { s.status = s.cash >= C.goalCash ? 'win' : 'lose'; } else { s.day++; s.dayLeft = C.perDay; s.dayServed = 0; s.earned = 0; newCust(); } } }
        }, draw(g) {
            g.fillStyle = '#f7e9d6'; g.fillRect(0, 0, W, H); g.fillStyle = '#d9b48a'; g.fillRect(0, 0, W, 22); fillText(g, C.title.toUpperCase() + '  DAY ' + s.day + '/' + C.days, 4, 14, '#4a2f1a', 10); fillText(g, '$' + s.cash + '  REP ' + s.rep.toFixed(1) + '  GOAL $' + C.goalCash, W - 4, 14, '#4a2f1a', 9, 'right');
            const swatch = (x, y, c, sz) => { g.fillStyle = A.CRAFT_COLORS[c]; g.fillRect(x, y, sz, sz); g.strokeStyle = '#4a2f1a'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, sz - 1, sz - 1); };
            if (s.screen === 'order' && s.cust) { const c = s.cust; fillText(g, c.name + ' wants a ' + c.pattern.toUpperCase() + ' bracelet', W / 2, 50, '#4a2f1a', 11, 'center'); fillText(g, 'Colours', 60, 78, '#4a2f1a', 9); c.pal.forEach((p, i) => swatch(60 + i * 26, 84, p, 22)); fillText(g, 'Pays about $' + c.pay + '   ' + c.rows + ' rows', W / 2, 130, '#4a2f1a', 9, 'center');
                const gn = A.CRAFT_PATTERNS[c.pattern](n); for (let y = 0; y < 6; y++) for (let x = 0; x < n; x++) swatch(190 + x * 12, 72 + y * 10, c.pal[gn(x, y) % 3], 10);
                fillText(g, 'Z take the order   X turn away   C thread shop', W / 2, 200, '#8a6a4a', 8, 'center'); fillText(g, 'Customers left today: ' + s.dayLeft, W / 2, 214, '#8a6a4a', 8, 'center'); }
            else if (s.screen === 'shop') { fillText(g, 'THREAD SHOP  ($6 for 6)', W / 2, 44, '#4a2f1a', 11, 'center'); for (let i = 0; i < 8; i++) { swatch(30 + i * 34, 80, i, 26); fillText(g, 'x' + s.stock[i], 43 + i * 34, 124, '#4a2f1a', 9, 'center'); if (i === s.shopSel) { g.strokeStyle = '#d33'; g.lineWidth = 2; g.strokeRect(27 + i * 34, 77, 32, 32); } } fillText(g, 'Left/Right choose   Z buy   X back', W / 2, 190, '#8a6a4a', 8, 'center'); }
            else if (s.screen === 'weave' && s.cust) { const c = s.cust; fillText(g, 'Weaving for ' + c.name + '   row ' + (s.row + 1) + '/' + c.rows, W / 2, 38, '#4a2f1a', 10, 'center');
                const gn = A.CRAFT_PATTERNS[c.pattern](n); fillText(g, 'Pattern', 24, 60, '#8a6a4a', 8); for (let x = 0; x < n; x++) swatch(24 + x * 18, 66, c.pal[gn(x, s.row) % 3], 16);
                fillText(g, 'Your knots', 24, 104, '#8a6a4a', 8); for (let x = 0; x < n; x++) { swatch(24 + x * 18, 110, c.pal[s.cur[x]], 16); if (s.stage === 'pick' && x === s.sel) { g.strokeStyle = '#d33'; g.lineWidth = 2; g.strokeRect(22 + x * 18, 108, 20, 20); } }
                fillText(g, 'Bracelet', 190, 60, '#8a6a4a', 8); const show = s.rowsDone.slice(-9); show.forEach((row, yy) => { for (let x = 0; x < n; x++) swatch(190 + x * 12, 66 + yy * 11, c.pal[row.cur[x]], 10); });
                if (s.stage === 'knot') { g.fillStyle = '#ccc'; g.fillRect(40, 160, 240, 12); g.fillStyle = '#4ae87a'; g.fillRect(40 + 240 * .36, 160, 240 * .28, 12); g.fillStyle = '#d33'; g.fillRect(40 + 240 * s.marker / 100 - 2, 156, 4, 20); fillText(g, 'Press Z when the marker is in the green', W / 2, 192, '#4a2f1a', 8, 'center'); }
                else fillText(g, 'Left/Right pick a thread   Up/Down change colour   Z tie the knot', W / 2, 192, '#8a6a4a', 8, 'center'); }
            else if (s.screen === 'summary') { fillText(g, 'END OF DAY ' + s.day, W / 2, 56, '#4a2f1a', 13, 'center'); fillText(g, 'Bracelets made: ' + s.dayServed + '   Earned: $' + s.earned, W / 2, 84, '#4a2f1a', 10, 'center'); fillText(g, 'Rent paid: $' + C.rent + '   Cash: $' + s.cash, W / 2, 104, s.cash < 0 ? '#d33' : '#4a2f1a', 10, 'center'); fillText(g, 'Patterns unlocked: ' + s.unlocked + '/' + pats.length, W / 2, 124, '#4a2f1a', 10, 'center'); fillText(g, 'Press Z for the next day   C thread shop', W / 2, 170, '#8a6a4a', 8, 'center'); if (s.last.c) s.screen = 'shop'; }
            if (s.msgT > 0 && s.msg) { g.fillStyle = 'rgba(74,47,26,.85)'; g.fillRect(10, 214, W - 20, 18); fillText(g, s.msg, W / 2, 227, '#fff', 8, 'center'); }
            end(g, s); } };
    };

    /* ---------------------------------------------------------------- skate: trick-skating engine (see header) */
/* nrskate.js (v1.0) - a real trick-skating engine (side view): the same game for the PC / Xbox package, the desktop window and, in a smaller form,
 * the small-console ROMs (nrmodes.js skate mode). Headless state machine like every NRArcade engine: g = Skate.create(cfg, {seed}); g.step(keys); g.draw(ctx).
 * What it models (all of it is data in Skate.TRICKS / Skate.SPOTS, so a game can rename, rescore or add tricks):
 *   ground:  push, brake, rolling friction, slopes that speed you up and slow you down, quarter-pipes, bowls, funboxes, gaps, pits
 *   air:     ollie (hold for height), 8 flip tricks, 8 grabs, 180 / 360 / 540 / 720 spins, board rotation, landing checks (sloppy / clean / perfect, or bail)
 *   rails:   8 grinds (50-50, 5-0, nosegrind, boardslide, lipslide, smith, feeble, tailslide) with a balance meter, ledges, rails, boxes
 *   ground:  manuals and nose manuals with a balance meter, revert on landing off a ramp
 *   scoring: base points x number of different moves in the combo, special meter that makes special tricks worth double, bonus gaps, S-K-A-T-E letters
 *   spots:   a park per level with a two-minute run and goals (score, letters, gaps, grinds, combo size)
 * keys: ArrowLeft/Right (push / brake in the street, spin in the air, balance on rails), ArrowUp/Down (trick direction), z ollie, x flip, c grab / grind. */
    const nm = () => { try { return typeof module !== 'undefined' ? require('./nrmotion.js') : root.NRMotion; } catch (e) { return null; } }, mEase = (c, u) => { const NM = nm(); return NM && NM.ease ? NM.ease(c, u) : u; };   /* measured ease profiles (nrmotion.js, from ~9,800 real clips) shape flips, spins and bails when the library is present */
    const Sk = (function () {
const Sk = {}, W = 320, H = 240;
const rng2 = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
/* direction index: 0 none, 1 up, 2 up-right, 3 right, 4 down-right, 5 down, 6 down-left, 7 left, 8 up-left */
const dirOf = k => { const x = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0), y = (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0); return [[0, 8, 1], [7, 0, 3], [6, 5, 4]].map(r => r)[y + 1][x + 1] === 0 && !x && !y ? 0 : ({ '0,-1': 1, '1,-1': 2, '1,0': 3, '1,1': 4, '0,1': 5, '-1,1': 6, '-1,0': 7, '-1,-1': 8 })[x + ',' + y] || 0; };
/* ---------------------------------------------------------------- the move lists. pts = base score, f = frames the move takes, rot = board turns */
Sk.TRICKS = {
    flip: [   // x + direction. rot: board spins around its long axis (kickflip, heelflip) or flat (shove-it)
        { id: 'kickflip', name: 'Kickflip', pts: 150, f: 26, axis: 'long', turns: 1 },
        { id: 'heelflip', name: 'Heelflip', pts: 150, f: 26, axis: 'long', turns: -1 },
        { id: 'shove', name: 'Pop Shove-it', pts: 120, f: 24, axis: 'flat', turns: .5 },
        { id: 'fsshove', name: 'FS Pop Shove-it', pts: 130, f: 24, axis: 'flat', turns: -.5 },
        { id: 'varial', name: 'Varial Kickflip', pts: 220, f: 30, axis: 'both', turns: 1 },
        { id: 'varheel', name: 'Varial Heelflip', pts: 220, f: 30, axis: 'both', turns: -1 },
        { id: 'tre', name: '360 Flip', pts: 300, f: 36, axis: 'both', turns: 1.5 },
        { id: 'hard', name: 'Hardflip', pts: 280, f: 34, axis: 'both', turns: 1.25 },
        { id: 'impossible', name: 'Impossible', pts: 260, f: 32, axis: 'wrap', turns: 1 }],
    grab: [   // c + direction in the air
        { id: 'indy', name: 'Indy', pts: 100, f: 16 }, { id: 'melon', name: 'Melon', pts: 110, f: 16 }, { id: 'nose', name: 'Nose Grab', pts: 120, f: 16 }, { id: 'tail', name: 'Tail Grab', pts: 120, f: 16 },
        { id: 'stalefish', name: 'Stalefish', pts: 160, f: 20 }, { id: 'mute', name: 'Mute', pts: 140, f: 18 }, { id: 'method', name: 'Method', pts: 200, f: 22 }, { id: 'japan', name: 'Japan Air', pts: 180, f: 20 }, { id: 'christ', name: 'Christ Air', pts: 260, f: 24 }],
    grind: [  // c near a rail or ledge, direction picks the grind
        { id: '5050', name: '50-50', pts: 90 }, { id: '50', name: '5-0', pts: 110 }, { id: 'nose', name: 'Nosegrind', pts: 130 }, { id: 'board', name: 'Boardslide', pts: 140 },
        { id: 'lip', name: 'Lipslide', pts: 150 }, { id: 'smith', name: 'Smith', pts: 170 }, { id: 'feeble', name: 'Feeble', pts: 170 }, { id: 'tail', name: 'Tailslide', pts: 160 }, { id: 'crook', name: 'Crooked', pts: 190 }],
    manual: [{ id: 'manual', name: 'Manual', pts: 40 }, { id: 'nosemanual', name: 'Nose Manual', pts: 45 }],
    spin: [{ deg: 180, name: '180', pts: 60 }, { deg: 360, name: '360', pts: 140 }, { deg: 540, name: '540', pts: 260 }, { deg: 720, name: '720', pts: 440 }, { deg: 900, name: '900', pts: 700 }],
    special: { fill: 1000, mult: 2, note: 'When the special meter is full, flips, grabs and grinds score double.' }
};
const FLIP_BY_DIR = [0, 6, 4, 2, 7, 8, 5, 1, 3], GRAB_BY_DIR = [0, 4, 3, 2, 1, 5, 7, 8, 6], GRIND_BY_DIR = [0, 3, 2, 1, 4, 5, 6, 7, 8];   // none -> kickflip, indy, 50-50 ... (index into the lists above)
/* ---------------------------------------------------------------- spots: a park piece list, rails and goals */
Sk.SPOTS = [
    { name: 'Parking Lot', length: 2600, seconds: 120, pieces: ['flat 200', 'rail 140', 'flat 120', 'box 90', 'flat 100', 'gap 60', 'flat 160', 'qp 90', 'flat 80', 'ledge 160', 'flat 140', 'funbox 200', 'flat 160', 'rail 160', 'flat 120', 'qp 90'], goals: [{ k: 'score', n: 4000, t: 'Score 4,000' }, { k: 'letters', n: 5, t: 'Spell S-K-A-T-E' }, { k: 'gaps', n: 1, t: 'Clear the gap' }] },
    { name: 'Skate Park', length: 3400, seconds: 120, pieces: ['flat 200', 'qp 100', 'bowl 220', 'qp 100', 'flat 120', 'rail 200', 'flat 80', 'funbox 220', 'flat 100', 'gap 80', 'ledge 220', 'flat 100', 'bowl 260', 'flat 100', 'rail 220', 'flat 140'], goals: [{ k: 'score', n: 9000, t: 'Score 9,000' }, { k: 'combo', n: 6, t: 'A 6-move combo' }, { k: 'letters', n: 5, t: 'Spell S-K-A-T-E' }, { k: 'grinds', n: 5, t: 'Five grinds' }] },
    { name: 'Downtown', length: 4200, seconds: 150, pieces: ['flat 220', 'rail 220', 'gap 70', 'ledge 240', 'down 140', 'flat 140', 'box 120', 'rail 260', 'gap 74', 'funbox 240', 'flat 120', 'ledge 300', 'qp 110', 'flat 100', 'rail 300', 'flat 160', 'gap 78', 'flat 200'], goals: [{ k: 'score', n: 16000, t: 'Score 16,000' }, { k: 'combo', n: 9, t: 'A 9-move combo' }, { k: 'gaps', n: 3, t: 'Clear three gaps' }, { k: 'letters', n: 5, t: 'Spell S-K-A-T-E' }] }
];
/* ---------------------------------------------------------------- sports: one trick engine, three extreme sports. cfg.sport = 'skate' | 'snow' | 'bmx'.
 * Trick names, events and course themes were read from the games themselves: Tony Hawk's Pro Skater / THUG2 (GBC, GBA: trick lists, goal tiers, balance meters),
 * Cool Boarders 4 (PlayStation: Big Air / Half Pipe / Slope Style events, trick-point averages, unlockable boards, Trickmaster) and Dave Mirra Freestyle BMX (PlayStation:
 * Street / Dirt / Vert, peg grinds, bar tricks, manuals, "longest manual / longest grind / single trick / trick set" records). Physics numbers are tuned feel, not measured. */
const PEG = [['5050', 'Double Peg', 90], ['50', 'Feeble', 120], ['nose', 'Toothpick', 150], ['board', 'Sprocket', 140], ['lip', 'Icepick', 170], ['smith', 'Smith', 170], ['feeble', 'Crooked', 180], ['tail', 'Luc-E', 190], ['crook', 'Pegless Crook', 200]];
Sk.SPORTS = {
    skate: { name: 'Skateboarding', rider: 'board' },
    snow: { name: 'Snowboarding', rider: 'snowboard', physics: { push: .06, friction: .0015, maxSpeed: 6.2, gravity: .21, ollie: 5.4, bailTime: 80, balance: .9, color: '#bfe8ff', color2: '#ff8a4a' },
        tricks: { flip: [{ id: 'rodeo', name: 'Rodeo', pts: 220, f: 34, axis: 'both', turns: 1.5 }, { id: 'backflip', name: 'Backflip', pts: 320, f: 40, axis: 'flat', turns: 1 }, { id: 'frontflip', name: 'Front Flip', pts: 320, f: 40, axis: 'flat', turns: -1 }, { id: 'cork', name: 'Cork', pts: 260, f: 32, axis: 'both', turns: 1 },
            { id: 'misty', name: 'Misty', pts: 300, f: 36, axis: 'both', turns: 1.25 }, { id: 'tamedog', name: 'Tame Dog', pts: 200, f: 30, axis: 'long', turns: .75 }, { id: 'sloth', name: 'Sloth Roll', pts: 180, f: 28, axis: 'long', turns: .5 }, { id: 'rocketair', name: 'Rocket Air', pts: 240, f: 30, axis: 'flat', turns: .5 }],
            grab: [{ id: 'indy', name: 'Indy', pts: 110, f: 16 }, { id: 'melon', name: 'Melon', pts: 120, f: 16 }, { id: 'nose', name: 'Nose Grab', pts: 130, f: 16 }, { id: 'tail', name: 'Tail Grab', pts: 130, f: 16 }, { id: 'stalefish', name: 'Stalefish', pts: 170, f: 20 }, { id: 'mute', name: 'Mute', pts: 150, f: 18 }, { id: 'method', name: 'Method', pts: 220, f: 22 }, { id: 'japan', name: 'Japan Air', pts: 200, f: 20 }, { id: 'truck', name: 'Truck Driver', pts: 240, f: 22 }],
            grind: [{ id: '5050', name: '50-50', pts: 100 }, { id: '50', name: 'Tail Press', pts: 130 }, { id: 'nose', name: 'Nose Press', pts: 130 }, { id: 'board', name: 'Boardslide', pts: 150 }, { id: 'lip', name: 'Lipslide', pts: 160 }, { id: 'smith', name: 'Bluntslide', pts: 180 }, { id: 'feeble', name: 'Backside Slide', pts: 170 }, { id: 'tail', name: 'Tailslide', pts: 170 }, { id: 'crook', name: 'Nosepress Slide', pts: 190 }],
            manual: [{ id: 'manual', name: 'Tail Press', pts: 30 }, { id: 'nosemanual', name: 'Nose Press', pts: 35 }], spin: [{ deg: 180, name: '180', pts: 70 }, { deg: 360, name: '360', pts: 160 }, { deg: 540, name: '540', pts: 300 }, { deg: 720, name: '720', pts: 520 }, { deg: 900, name: '900', pts: 800 }, { deg: 1080, name: '1080', pts: 1200 }, { deg: 1260, name: '1260', pts: 1800 }], special: { fill: 1200, mult: 2, note: 'Boost meter: a full meter makes grabs and flips double.' } },
        spots: [{ name: 'Big Air', length: 3000, seconds: 90, pieces: ['flat 160', 'down 200', 'flat 80', 'gap 90', 'down 220', 'qp 120', 'flat 100', 'gap 100', 'down 200', 'flat 120'], goals: [{ k: 'score', n: 5000, t: 'Score 5,000' }, { k: 'combo', n: 3, t: 'Land a 3-trick combo' }] },
            { name: 'Half Pipe', length: 3200, seconds: 90, pieces: ['flat 160', 'qp 100', 'bowl 240', 'qp 100', 'bowl 240', 'qp 100', 'bowl 240', 'qp 100', 'flat 120'], goals: [{ k: 'score', n: 8000, t: 'Score 8,000' }, { k: 'combo', n: 4, t: 'Land a 4-trick combo' }] },
            { name: 'Slope Style', length: 4200, seconds: 120, pieces: ['flat 160', 'rail 200', 'down 140', 'box 120', 'gap 90', 'down 160', 'rail 240', 'funbox 200', 'gap 110', 'down 140', 'ledge 220', 'qp 110', 'rail 260', 'flat 140'], goals: [{ k: 'score', n: 14000, t: 'Score 14,000' }, { k: 'grinds', n: 5, t: 'Grind 5 rails' }, { k: 'letters', n: 5, t: 'Collect S-K-A-T-E' }] }] },
    bmx: { name: 'BMX', rider: 'bike', physics: { push: .075, friction: .005, maxSpeed: 3.8, gravity: .23, ollie: 4.2, bailTime: 75, balance: 1.05, color: '#ffb23a', color2: '#4ae8ff' },
        tricks: { flip: [{ id: 'tailwhip', name: 'Tailwhip', pts: 160, f: 28, axis: 'flat', turns: 1 }, { id: 'barspin', name: 'Barspin', pts: 150, f: 24, axis: 'flat', turns: 1 }, { id: 'xup', name: 'X-Up', pts: 130, f: 22, axis: 'flat', turns: .5 }, { id: 'turndown', name: 'Turndown', pts: 240, f: 30, axis: 'both', turns: .75 }, { id: 'candybar', name: 'Candy Bar', pts: 260, f: 32, axis: 'both', turns: 1 }, { id: 'flair', name: 'Flair', pts: 360, f: 42, axis: 'flat', turns: 1 }, { id: 'backflip', name: 'Backflip', pts: 340, f: 40, axis: 'flat', turns: 1 }, { id: 'decade', name: 'Decade', pts: 280, f: 34, axis: 'both', turns: 1 }, { id: 'tailwhipbf', name: 'Tailwhip Backflip', pts: 520, f: 48, axis: 'both', turns: 2 }],
            grab: [{ id: 'nohand', name: 'No Hander', pts: 110, f: 16 }, { id: 'nofoot', name: 'No Footer', pts: 120, f: 16 }, { id: 'seatgrab', name: 'Seat Grab', pts: 130, f: 16 }, { id: 'onefoot', name: 'One Footer', pts: 100, f: 14 }, { id: 'superman', name: 'Superman', pts: 190, f: 22 }, { id: 'supermanindian', name: 'Superman Indian', pts: 230, f: 24 }, { id: 'cancan', name: 'Can-Can', pts: 150, f: 18 }, { id: 'rocketair', name: 'Rocket Air', pts: 170, f: 20 }, { id: 'suicide', name: 'Suicide No Hander', pts: 260, f: 24 }],
            grind: PEG.map(g => ({ id: g[0], name: g[1], pts: g[2] })), manual: [{ id: 'manual', name: 'Manual', pts: 45 }, { id: 'nosemanual', name: 'Nose Wheelie', pts: 50 }],
            spin: [{ deg: 180, name: '180', pts: 60 }, { deg: 360, name: '360', pts: 140 }, { deg: 540, name: '540', pts: 260 }, { deg: 720, name: '720', pts: 440 }, { deg: 900, name: '900', pts: 700 }], special: { fill: 1000, mult: 2, note: 'A full special meter doubles bar tricks and flips.' } },
        spots: [{ name: 'Street', length: 3600, seconds: 120, pieces: ['flat 200', 'rail 180', 'flat 100', 'box 100', 'gap 70', 'flat 140', 'ledge 200', 'qp 100', 'flat 100', 'rail 220', 'funbox 200', 'flat 140'], goals: [{ k: 'score', n: 6000, t: 'Score 6,000' }, { k: 'grinds', n: 4, t: 'Peg grind 4 rails' }] },
            { name: 'Dirt', length: 3800, seconds: 120, pieces: ['flat 200', 'gap 80', 'flat 100', 'gap 100', 'down 120', 'gap 90', 'flat 100', 'gap 110', 'qp 100', 'gap 80', 'flat 100', 'gap 110', 'flat 140'], goals: [{ k: 'score', n: 8000, t: 'Score 8,000' }, { k: 'gaps', n: 4, t: 'Clear 4 gaps' }] },
            { name: 'Vert', length: 3400, seconds: 120, pieces: ['flat 180', 'qp 100', 'bowl 260', 'qp 100', 'bowl 260', 'qp 100', 'flat 120'], goals: [{ k: 'score', n: 12000, t: 'Score 12,000' }, { k: 'combo', n: 4, t: 'Land a 4-trick combo' }] }] }
};
/* skater body rig (Jabroni Hawk movement update): a jointed body (hips, torso, head, two-bone arms and legs) posed per state and per trick, so every grab reaches
 * a different part of the board, an ollie winds up (crouch, arms back), pops (legs tuck, arms forward), flips kick the feet, grinds sit low with balancing arms,
 * manuals lean back, and the spin turns the shoulders. Angles are degrees; 0 = straight down for limbs, 0 = upright for the torso. */
const RIG = { grabs: { indy: [-2, 62, 100], melon: [4, 70, 100], nose: [-14, 120, 140], tail: [14, 120, 140], stalefish: [2, 100, 70], method: [26, 150, 60], mute: [-6, 70, 130], japan: [12, 140, 90], airwalk: [0, 160, 130], nohand: [0, 150, 150], superman: [-40, 160, 160], melonchicken: [10, 90, 110] } };
const limb = (g, x0, y0, a0, l0, bend, l1, col, w) => { const r0 = a0 * Math.PI / 180, kx = x0 + Math.sin(r0) * l0, ky = y0 + Math.cos(r0) * l0, r1 = (a0 + bend) * Math.PI / 180, ex = kx + Math.sin(r1) * l1, ey = ky + Math.cos(r1) * l1; g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(kx, ky); g.lineTo(ex, ey); g.stroke(); return [ex, ey]; };
Sk.rig = (g, s, C, lift) => {
    const st = s.state, air = st === 'air', t = s.t || 0, tr = s.trick, gr = s.grab, charge = s.charge > 3 ? Math.min(1, s.charge / 14) : 0, vy = s.vy || 0, spinA = ((s.spin || 0) % 360) * Math.PI / 180, sh = Math.cos(spinA), fl = tr ? Math.min(1, s.trickT / Math.max(1, tr.f)) : 0, bal = s.bal || 0;
    let crouch = 0, torso = 0, aF = 25, aB = -25, hipx = 0, lF = 0, lB = 0, bF = 12, bB = 12;
    if (st === 'roll') { const push = s.pushT > 0 ? Math.sin(t * .5) : 0; crouch = 1 + (s.pushT > 0 ? 1.5 : 0); torso = 4; aF = 22 + push * 18; aB = -20 - push * 18; lB = s.pushT > 0 ? -20 - push * 18 : 0; }
    if (charge) { crouch = 3 + charge * 3; torso = 8 + charge * 8; aF = -30 - charge * 30; aB = -50 - charge * 20; bF = bB = 40; }
    if (air) { const up = vy < 0; crouch = up ? 4 : 2; torso = up ? -4 : 6; aF = up ? 60 : 40; aB = up ? -60 : -40; bF = bB = 50; lF = 14; lB = -14; if (tr) { lF = 24 + 30 * Math.sin(fl * Math.PI); lB = -18 - 30 * Math.sin(fl * Math.PI); aF = 90; aB = -90; } if (s.spin) aF += 20 * sh; }
    if (gr && RIG.grabs[gr.id]) { const a = RIG.grabs[gr.id]; crouch = 6; torso = a[0]; aF = a[1]; aB = a[1] > 140 ? -a[1] : -30; lF = 18; lB = -18; bF = bB = 90 + (a[2] - 100) / 3; }
    if (st === 'grind') { crouch = 6; torso = 6 + bal * 10; aF = 70 + bal * 30; aB = -70 + bal * 30; bF = bB = 70; lF = 10; lB = -10; }
    if (st === 'manual') { crouch = 1; torso = -16 - bal * 8; aF = 80 + bal * 40; aB = -80 + bal * 40; hipx = -2; }
    if (s.specialOn) { aF += 12 * Math.sin(t * .3); aB -= 12 * Math.sin(t * .3); }
    const hy = lift - 12 + crouch, tx = hipx, lean = torso * Math.PI / 180, sx = tx + Math.sin(lean) * 11, sy = hy - Math.cos(lean) * 11, col = C.color, skin = '#e8b890', pants = '#35507a', wide = Math.abs(sh) * .75 + .25, fx = 5 * wide, bx = -5 * wide;
    g.save();
    limb(g, tx - 1.5, hy, -lB, 6, -bB, 6, pants, 3); limb(g, tx + 1.5, hy, lF, 6, bF, 6, pants, 3);
    g.fillStyle = '#222'; g.fillRect(bx - 2, lift + 1, 4, 2); g.fillRect(fx - 2, lift + 1, 4, 2);
    g.strokeStyle = col; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(tx, hy); g.lineTo(sx, sy); g.stroke();
    limb(g, sx, sy, aB, 5, 18, 5, skin, 2.4); limb(g, sx, sy, aF, 5, 18, 5, skin, 2.4);
    g.fillStyle = skin; g.beginPath(); g.arc(sx + Math.sin(lean) * 3, sy - 4, 3.3, 0, 7); g.fill(); g.fillStyle = '#222'; g.fillRect(sx + Math.sin(lean) * 3 - 3.4, sy - 7.4, 6.8, 2);
    g.restore();
};
Sk.DEFAULTS = { title: 'Street Session', sport: 'skate', spot: 0, seed: 3, seconds: 0, push: .09, maxSpeed: 4.2, gravity: .24, ollie: 4.6, friction: .006, bailTime: 70, balance: 1, color: '#f5c542', color2: '#4ae8ff', goalScore: 0, sex: 0, skin: 2, hair: 0, hairc: 1, eyes: 1, beard: 0, top: 1, pants: 2, boots: 4, skaterHeight: 1, skaterBuild: 1 };
function park(spot, seed) {
    const r = rng2(seed), len = spot.length, ground = new Float32Array(len + 400), GY = 190, rails = [], boxes = [], gaps = [], letters = [], ramps = [];
    let x = 0; ground.fill(GY);
    const setH = (a, b, f) => { for (let i = a; i < b && i < ground.length; i++) ground[i] = f(i - a, b - a); };
    spot.pieces.forEach(p => {
        const [t, ns] = p.split(' '), n = +ns, x0 = x;
        if (t === 'qp') { setH(x0, x0 + n, (i, m) => GY - 34 * Math.pow(i / m, 1.8)); ramps.push({ x0, x1: x0 + n, kind: 'qp' }); }
        else if (t === 'bowl') { setH(x0, x0 + n, (i, m) => GY + 26 * Math.sin(Math.PI * i / m)); ramps.push({ x0, x1: x0 + n, kind: 'bowl' }); }
        else if (t === 'down') setH(x0, x0 + n, (i, m) => GY - 40 + i / m * 40);
        else if (t === 'funbox') { const a = 40, top = GY - 28; setH(x0, x0 + a, (i, m) => GY - i / m * 28); setH(x0 + a, x0 + n - a, () => top); setH(x0 + n - a, x0 + n, (i, m) => top + i / m * 28); boxes.push({ x0: x0 + a, x1: x0 + n - a, y: top }); ramps.push({ x0, x1: x0 + n, kind: 'fun' }); }
        else if (t === 'box') { setH(x0 + 14, x0 + n - 14, () => GY - 24); setH(x0, x0 + 14, (i, m) => GY - i / m * 24); setH(x0 + n - 14, x0 + n, (i, m) => GY - 24 + i / m * 24); boxes.push({ x0: x0 + 14, x1: x0 + n - 14, y: GY - 24 }); }
        else if (t === 'rail') rails.push({ x0: x0 + 10, x1: x0 + n - 10, y: GY - 30, kind: 'rail' });
        else if (t === 'ledge') { setH(x0 + 12, x0 + n - 12, () => GY - 18); setH(x0, x0 + 12, (i, m) => GY - i / m * 18); setH(x0 + n - 12, x0 + n, (i, m) => GY - 18 + i / m * 18); rails.push({ x0: x0 + 12, x1: x0 + n - 12, y: GY - 18, kind: 'ledge' }); }
        else if (t === 'gap') { setH(x0, x0 + n, () => 400); gaps.push({ x0, x1: x0 + n, name: ['Dumpster', 'Stairs', 'Fountain', 'Bus Stop', 'Hydrant'][gaps.length % 5], done: false }); }
        x += n;
    });
    // gaps are bridged by a rail-free pit: ground 400 means "pit"; the surface before/after is GY
    const names = 'SKATE'; for (let i = 0; i < 5; i++) { const px = 300 + Math.floor((len - 500) / 5 * (i + .5) + r() * 40); letters.push({ x: px, y: GY - 70 - r() * 40, ch: names[i], got: false }); }
    return { ground, len, rails, boxes, gaps, letters, ramps, GY };
}
Sk.create = (cfg, o = {}) => {
    const SP = Sk.SPORTS[(cfg && cfg.sport) || 'skate'] || Sk.SPORTS.skate, C = Object.assign({}, Sk.DEFAULTS, SP.physics || {}, cfg), spots = SP.spots || Sk.SPOTS, spot = spots[C.spot % spots.length], P = park(spot, C.seed + (o.seed || 0)), T = SP.tricks ? Object.assign({}, Sk.TRICKS, SP.tricks) : Sk.TRICKS;
    const s = { status: 'play', t: (C.seconds || spot.seconds) * 60, score: 0, x: 40, y: P.GY, vx: 0, vy: 0, state: 'roll', ground: true, rot: 0, spin: 0, spinTarget: 0, board: 0, boardAxis: 'long', trick: null, trickT: 0, grab: null, grabT: 0, grind: null, grindX: 0, bal: 0, manual: 0, combo: [], comboPts: 0, comboT: 0, special: 0, specialOn: false, bail: 0, msg: '', msgT: 0, best: 0, letters: 0, gaps: 0, grinds: 0, maxCombo: 0, tricks: 0, last: {}, upT: 99, dnT: 99, charge: 0, cam: 0, goals: spot.goals.map(g => Object.assign({ done: false }, g)), air: 0, pushSnd: 0, lastGround: 0 };
    const edge = (k, n) => { const v = !!k[n], w = !!s.last[n]; s.last[n] = v; return v && !w; };
    const surf = x => P.ground[clamp(Math.floor(x), 0, P.ground.length - 1)], slope = x => (surf(x + 3) - surf(x - 3)) / 6;
    const say = (m, n) => { s.msg = m; s.msgT = n || 70; };
    const addMove = (name, pts) => {
        const dup = s.combo.includes(name) ? .5 : 1; s.combo.push(name); const mult = s.combo.length, gain = Math.round(pts * (s.specialOn ? T.special.mult : 1) * dup);
        s.comboPts += gain; s.comboT = 130; s.special = Math.min(T.special.fill, s.special + gain * .5); if (s.special >= T.special.fill) s.specialOn = true; s.tricks++;
        s.maxCombo = Math.max(s.maxCombo, s.combo.length); s.lastMove = name; say(name + '  ' + s.comboPts + ' x' + mult, 50);
    };
    const cash = () => { if (!s.combo.length) return; const total = s.comboPts * s.combo.length; s.score += total; s.best = Math.max(s.best, total); say('+' + total, 60); s.combo = []; s.comboPts = 0; s.comboT = 0; };
    const bail = why => { if (s.state === 'bail') return; s.state = 'bail'; s.bail = C.bailTime; s.vx *= .3; s.combo = []; s.comboPts = 0; s.comboT = 0; s.grind = null; s.specialOn = false; s.special = Math.max(0, s.special - 300); say('BAIL! ' + (why || ''), 70); };
    const nearRail = () => P.rails.find(r => s.x + 4 >= r.x0 && s.x - 4 <= r.x1 && Math.abs(s.y - r.y) < 16 && s.vy >= -1);
    const goals = () => { s.goals.forEach(g => { if (g.done) return; const v = { score: s.score, letters: s.letters, gaps: s.gaps, grinds: s.grinds, combo: s.maxCombo }[g.k]; if (v >= g.n) { g.done = true; say('GOAL: ' + g.t, 90); } }); };
    const land = () => {
        const turns = s.trick ? (s.trick.turns || 0) : 0, boardOk = !s.trick || s.trickT >= s.trick.f * .6, bt = s.trick && !boardOk, spinOff = ((s.spin % 180) + 180) % 180, spinBad = Math.min(spinOff, 180 - spinOff) > 38;
        s.ground = true; s.vy = 0; s.y = surf(s.x); s.air = 0;
        if (bt || spinBad) { bail(bt ? 'board not landed' : 'bad landing'); return; }
        const deg = Math.round(Math.abs(s.spin) / 180) * 180; if (deg >= 180) { const sp = T.spin.filter(x => x.deg <= deg).pop(); if (sp) addMove(sp.name + (s.spin < 0 ? ' BS' : ' FS'), sp.pts); }
        const clean = Math.min(spinOff, 180 - spinOff) < 12; s.state = 'roll'; s.rot = 0; s.spin = 0; s.board = 0; s.trick = null; s.grab = null; s.lastGround = 0;
        if (clean && s.combo.length) { s.comboPts = Math.round(s.comboPts * 1.1); say('CLEAN  ' + s.comboPts, 40); }
        P.gaps.forEach(g => { if (!g.done && s.cleared === g) { g.done = true; s.gaps++; addMove('GAP: ' + g.name, 400); } });
        s.cleared = null; s.revert = s.vy;
    };
    const take = (x, y) => P.letters.forEach(l => { if (!l.got && Math.abs(l.x - x) < 14 && Math.abs(l.y - y) < 26) { l.got = true; s.letters++; s.score += 250; say('LETTER ' + l.ch, 40); } });
    const step = k => {
        if (s.status !== 'play') return;
        if (s.x > P.len + 40) { cash(); s.status = s.goals.every(g => g.done) ? 'win' : 'lose'; return; }
        s.t--; if (s.t <= 0) { cash(); s.status = s.goals.every(g => g.done) ? 'win' : 'lose'; return; }
        if (s.msgT > 0) s.msgT--; if (s.comboT > 0 && s.state !== 'air' && s.state !== 'grind' && s.state !== 'manual' && --s.comboT <= 0) cash();
        const d = dirOf(k); s.upT++; s.dnT++; if (edge(k, 'ArrowUp')) s.upT = 0; if (edge(k, 'ArrowDown')) s.dnT = 0;
        if (s.state === 'bail') { s.bail--; s.x += s.vx; s.vx *= .94; s.y = surf(s.x); if (s.bail <= 0) { s.state = 'roll'; s.ground = true; s.vx = 0; s.rot = 0; s.spin = 0; s.board = 0; } s.cam += (s.x - 100 - s.cam) * .1; return; }
        if (s.ground && (s.state === 'roll' || s.state === 'manual')) {
            const sl = slope(s.x); if (k.ArrowRight) s.vx += C.push; if (k.ArrowLeft) s.vx -= C.push * 1.6; s.vx += clamp(sl, -.6, .6) * C.gravity * .55; s.vx -= s.vx * C.friction; s.vx = clamp(s.vx, -.5, C.maxSpeed + (sl < 0 ? 0 : sl * 1.5));
            if (s.vx < 0 && !k.ArrowLeft) s.vx = 0;
            const nx = s.x + s.vx; s.x = nx; const gy = surf(s.x), prev = s.y;
            if (gy - prev > 5 + Math.abs(s.vx) * 1.5 && gy < 380) { s.ground = false; s.vy = -Math.max(0, -sl) * s.vx - (prev - gy < 0 ? 0 : 0); s.y = prev; s.state = 'air'; s.air = 0; }
            else if (gy >= 380) { s.ground = false; s.state = 'air'; s.vy = 0; s.y = prev; P.gaps.forEach(g => { if (s.x >= g.x0 - 12 && s.x <= g.x1) s.cleared = g; }); }
            else s.y = gy;
            // ollie: tap = low, hold = higher (charge counts while z is held)
            if (k.z && s.charge < 14) s.charge++; else if (k.z) { s.charge = 15; } else if (s.charge > 0 || edge(k, 'z')) { }
            if (s.ground && ((!k.z && s.charge > 0) || s.charge >= 15 || edge(k, 'z') && false)) { s.vy = -(C.ollie * .72 + s.charge / 14 * C.ollie * .5) - Math.max(0, -sl) * s.vx * .3; s.ground = false; s.state = 'air'; s.charge = 0; s.air = 0; s.y -= 1; if (s.combo.length || s.comboT > 0) { } addMove('Ollie', 30); s.comboT = 0; s.comboPts = Math.round(s.comboPts); }
            // manuals: up,down quickly = manual; down,up = nose manual
            if (s.state === 'roll' && s.ground) { if (edge(k, 'ArrowDown') && s.upT < 14 && s.vx > 1) { s.state = 'manual'; s.manual = 1; s.bal = 0; s.mkind = 0; addMove('Manual', 0); } else if (edge(k, 'ArrowUp') && s.dnT < 14 && s.vx > 1) { s.state = 'manual'; s.manual = 1; s.bal = 0; s.mkind = 1; addMove('Nose Manual', 0); } }
            if (s.state === 'manual') { s.bal += (Math.sin(s.t / 17) * .012 + (s.bal > 0 ? .006 : -.006)) * C.balance; if (k.ArrowRight) s.bal -= .02; if (k.ArrowLeft) s.bal += .02; s.comboPts += s.mkind ? 1 : 1; s.comboT = 130; if (Math.abs(s.bal) > 1 || s.vx < .6) { if (Math.abs(s.bal) > 1) bail('lost balance'); else { s.state = 'roll'; cash(); } } if (!k.ArrowUp && !k.ArrowDown && s.state === 'manual' && !k.z && Math.abs(s.bal) < .02 && false) s.state = 'roll'; if (s.state === 'manual' && edge(k, 'x')) { s.state = 'roll'; cash(); } }
            if (s.state === 'roll' && s.combo.length === 0) s.comboPts = 0;
        } else if (s.state === 'air') {
            s.air++; s.vy += C.gravity; s.x += s.vx; s.y += s.vy; s.vx -= s.vx * .0015;
            // spin: Left/Right in the air; flips: x + direction; grabs: c + direction
            if (k.ArrowLeft) { s.spin -= 6; } else if (k.ArrowRight) { s.spin += 6; }
            if (s.spin !== 0) { const sp = T.spin.filter(x => x.deg <= Math.abs(s.spin) - 20).length; if (sp > (s.spunNames || 0)) { s.spunNames = sp; } }
            if (edge(k, 'x') && !s.trick && s.air > 3) { const t = T.flip[FLIP_BY_DIR[d] % T.flip.length === 0 && d === 0 ? 0 : (FLIP_BY_DIR[d] - 1 + T.flip.length) % T.flip.length]; s.trick = t; s.trickT = 0; addMove(t.name, t.pts); }
            if (s.trick && s.trickT < s.trick.f) s.trickT += 1.5;
            if (edge(k, 'c')) { const rl = nearRail(); if (rl) { const gd = T.grind[(GRIND_BY_DIR[d] || 1) - 1]; s.state = 'grind'; s.grind = rl; s.gk = gd; s.bal = 0; s.y = rl.y; s.vy = 0; s.ground = false; s.trick = null; s.spin = Math.round(s.spin / 180) * 180; addMove(gd.name, gd.pts); s.grinds++; s.grindT = 0; sfxSkip(); }
                else if (!s.grab) { const g = T.grab[(GRAB_BY_DIR[d] || 1) - 1 + (d === 0 ? 0 : 0)]; s.grab = g; s.grabT = 0; addMove(g.name, g.pts); } }
            if (s.grab) { s.grabT++; if (s.grabT > s.grab.f + 8 && !k.c) s.grab = null; }
            take(s.x, s.y - 14);
            const gy = surf(s.x);
            if (s.y >= gy && s.vy >= 0) { if (gy >= 380) { if (s.y > 300) { bail('fell in the gap'); s.y = P.GY; s.x = Math.max(0, s.x - 80); } } else land(); }
            if (s.x > P.len + 60) { cash(); s.status = s.goals.every(g => g.done) ? 'win' : 'lose'; }
        } else if (s.state === 'grind') {
            const r = s.grind; s.x += s.vx * .94; s.y = r.y; s.grindT++; s.comboT = 130;
            s.bal += (Math.sin(s.t / 11) * .02 + (s.bal >= 0 ? .008 : -.008)) * C.balance; if (k.ArrowRight) s.bal -= .025; if (k.ArrowLeft) s.bal += .025; s.comboPts += 1.2; s.vx = Math.max(1.4, s.vx - .004);
            if (Math.abs(s.bal) > 1) { bail('fell off the ' + (r.kind === 'ledge' ? 'ledge' : 'rail')); return; }
            if (edge(k, 'z') || s.x > r.x1) { s.state = 'air'; s.ground = false; s.vy = -C.ollie * .6; s.grind = null; s.air = 0; if (s.x <= r.x1) addMove('Ollie out', 20); }
        }
        if (s.state === 'air' || s.state === 'roll') { /* nothing */ }
        s.rot += ((s.state === 'air' ? 0 : slope(s.x) * 20) - s.rot) * .2;
        s.cam += (s.x - 110 - s.cam) * .12; goals();
        s.pushSnd = 0;
    };
    function sfxSkip() { }
    return { s, C, P, spot, step, draw: g => draw(g, s, C, P, spot) };
};
/* ---------------------------------------------------------------- drawing (code-drawn so it works the moment it exists) */
function draw(g, s, C, P, spot) {
    g.fillStyle = '#8fc4ee'; g.fillRect(0, 0, W, H); g.fillStyle = '#b9dcf5'; for (let i = 0; i < 6; i++) g.fillRect(((i * 150 - s.cam * .15) % 480 + 480) % 480 - 80, 30 + (i % 3) * 18, 70, 10);
    g.fillStyle = '#7d8590'; for (let i = 0; i < 10; i++) { const bx = ((i * 120 - s.cam * .4) % 1200 + 1200) % 1200 - 100, bh = 50 + (i * 37) % 60; g.fillRect(bx, 190 - bh, 60, bh); g.fillStyle = '#6a727c'; g.fillRect(bx + 8, 190 - bh + 8, 8, 8); g.fillRect(bx + 28, 190 - bh + 8, 8, 8); g.fillStyle = '#7d8590'; }
    const sx = x => Math.round(x - s.cam);
    g.fillStyle = '#9a9a9a'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 2) { const wx = s.cam + x, y = P.ground[clamp(Math.floor(wx), 0, P.ground.length - 1)]; g.lineTo(x, Math.min(y, H)); } g.lineTo(W, H); g.closePath(); g.fill();
    g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= W; x += 2) { const wx = s.cam + x, y = P.ground[clamp(Math.floor(wx), 0, P.ground.length - 1)]; if (y < 380) { x === 0 ? g.moveTo(x, y) : g.lineTo(x, y); } else g.moveTo(x, H); } g.stroke();
    P.gaps.forEach(gp => { g.fillStyle = '#222'; g.fillRect(sx(gp.x0), P.GY + 4, gp.x1 - gp.x0, H); g.fillStyle = gp.done ? '#4ae87a' : '#f5c542'; g.font = '8px monospace'; g.textAlign = 'center'; g.fillText(gp.name.toUpperCase(), sx((gp.x0 + gp.x1) / 2), P.GY - 6); });
    P.rails.forEach(r => { g.strokeStyle = r.kind === 'rail' ? '#d8d8e0' : '#c9a66b'; g.lineWidth = r.kind === 'rail' ? 3 : 5; g.beginPath(); g.moveTo(sx(r.x0), r.y); g.lineTo(sx(r.x1), r.y); g.stroke(); if (r.kind === 'rail') { g.fillStyle = '#888'; g.fillRect(sx(r.x0), r.y, 3, P.GY - r.y); g.fillRect(sx(r.x1) - 3, r.y, 3, P.GY - r.y); } });
    P.letters.forEach(l => { if (l.got) return; g.fillStyle = C.color; g.beginPath(); g.arc(sx(l.x), l.y, 9, 0, 7); g.fill(); g.fillStyle = '#222'; g.font = 'bold 11px monospace'; g.textAlign = 'center'; g.fillText(l.ch, sx(l.x), l.y + 4); });
    // skater
    const x = sx(s.x), y = s.y, ang = s.state === 'air' ? 0 : s.rot, face = 1; g.save(); g.translate(x, y); g.rotate(ang);
    const bt = s.trick ? mEase('aerial', Math.min(1, s.trickT / s.trick.f)) : 0, flipA = s.trick ? (s.trick.axis === 'long' || s.trick.axis === 'both' ? bt * Math.PI * 2 * s.trick.turns : 0) : 0, flatA = s.trick ? (s.trick.axis === 'flat' || s.trick.axis === 'both' || s.trick.axis === 'wrap' ? bt * Math.PI * 2 * s.trick.turns : 0) : 0;
    const lift = s.state === 'air' ? -5 : 0, bail = s.state === 'bail';
    if (!bail) { g.save(); g.translate(0, lift - 2); g.scale(Math.cos(flatA) || 1, Math.abs(Math.cos(flipA)) * .8 + .2); g.fillStyle = '#3b2a1a'; g.fillRect(-13, -2, 26, 3); g.fillStyle = C.color2; g.fillRect(-13, 1, 26, 2); g.restore(); g.fillStyle = '#222'; g.fillRect(-9, lift + 2, 4, 4); g.fillRect(5, lift + 2, 4, 4); }
    const spinA = (s.spin % 360) * Math.PI / 180, body = Math.cos(spinA), crouch = s.state === 'manual' ? 2 : s.charge > 3 ? 4 : s.grab ? 3 : 0;
    if (!bail) Sk.rig(g, s, C, lift);
    else { g.rotate(Math.PI / 2 * mEase('fall', Math.min(1, (C.bailTime - s.bail) / 24)) + Math.sin((C.bailTime - s.bail) / 7) * .15); g.fillStyle = C.color; g.fillRect(-10, -6, 20, 6); g.fillStyle = '#e8b890'; g.fillRect(8, -8, 6, 6); }
    g.restore();
    // HUD
    g.font = '9px monospace'; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(spot.name.toUpperCase() + '  TIME ' + Math.ceil(s.t / 60), 4, 11); g.textAlign = 'right'; g.fillText('SCORE ' + s.score, W - 4, 11);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(4, 16, 90, 6); g.fillStyle = s.specialOn ? '#ff5aff' : '#f5c542'; g.fillRect(4, 16, 90 * s.special / Sk.TRICKS.special.fill, 6);
    if (s.state === 'grind' || s.state === 'manual') { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(W / 2 - 40, 26, 80, 7); g.fillStyle = Math.abs(s.bal) > .7 ? '#ff5a5a' : '#4ae87a'; g.fillRect(W / 2 + s.bal * 38 - 2, 26, 4, 7); }
    if (s.combo.length) { g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = 'bold 11px monospace'; g.fillText(s.comboPts + ' x ' + s.combo.length, W / 2, 46); g.font = '8px monospace'; g.fillStyle = '#ffe9a0'; g.fillText(s.combo.slice(-4).join(' + '), W / 2, 58); }
    if (s.msgT > 0 && s.msg) { g.textAlign = 'center'; g.font = 'bold 13px monospace'; g.fillStyle = s.state === 'bail' ? '#ff5a5a' : '#ffe14a'; g.fillText(s.msg, W / 2, 84); }
    g.textAlign = 'left'; g.font = '8px monospace'; g.fillStyle = '#fff'; g.fillText('SKATE ' + 'SKATE'.split('').map((c, i) => P.letters[i].got ? c : '.').join(''), 4, H - 4);
    g.textAlign = 'right'; s.goals.forEach((gl, i) => { g.fillStyle = gl.done ? '#4ae87a' : '#fff'; g.fillText((gl.done ? '[x] ' : '[ ] ') + gl.t, W - 4, H - 4 - (s.goals.length - 1 - i) * 10); });
    if (s.status !== 'play') { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, H / 2 - 30, W, 60); g.textAlign = 'center'; g.fillStyle = s.status === 'win' ? '#4ae87a' : '#ff5a5a'; g.font = '18px monospace'; g.fillText(s.status === 'win' ? 'SESSION COMPLETE!' : 'TIME UP', W / 2, H / 2 - 4); g.font = '9px monospace'; g.fillStyle = '#fff'; g.fillText('SCORE ' + s.score + '   BEST COMBO ' + s.best + '   LETTERS ' + s.letters + '/5', W / 2, H / 2 + 16); }
}
    return Sk; })();
    A.NRSkate = Sk;
    A.DEFAULTS.skate = Sk.DEFAULTS;
    A.MODES.skate = { name: 'Skateboarding (trick skating)', controls: 'Right push / Left brake, hold Z + release = ollie, X flip trick (+direction), C grab or grind (+direction), Left/Right spin in the air, Up-Down / Down-Up manual', genres: ['skateboarding', 'trick_sports'] };
    A.skate = (cfg, o) => Sk.create(cfg, o);

    /* ---------------------------------------------------------------- rail shooter (light-gun style, on a fixed path). Built from the three big names of the genre:
     * Time Crisis (duck behind cover to reload and dodge, enemies telegraph before they fire), House of the Dead (civilians you must not shoot, weak points / headshots, boss with a moving core)
     * and Star Fox / Panzer Dragoon (waves arriving from the horizon, combo chains for clean streaks). Arrows move the reticle, Z fires, hold X for cover (reloads). */
    /* design = { waves: [{ grunts, civilians (do not shoot), hp, speed .6-1.8, fire (frames between shots, 40-200) }], boss: { hp, fire }, theme: { wall, floor, lines } } */
    A.RAIL_DESIGN = () => ({ waves: [{ grunts: 4, civilians: 0, hp: 1, speed: 1, fire: 100 }, { grunts: 5, civilians: 2, hp: 1, speed: 1, fire: 90 }, { grunts: 6, civilians: 2, hp: 2, speed: 1.1, fire: 80 }, { grunts: 8, civilians: 3, hp: 2, speed: 1.2, fire: 70 }], boss: { hp: 14, fire: 80 }, theme: { wall: '#2b3b52', floor: '#1a2230', lines: '#3d5272' } });
    A.rail = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.rail, cfg), r = rng(o.seed || 1), s = { status: 'play', score: 0, hp: C.hp, ammo: C.mag, wave: 0, cx: W / 2, cy: H / 2 - 20, cover: false, combo: 0, best: 0, en: [], t: 0, last: {}, msg: '', msgT: 0, spawnT: 40, left: 0, killed: 0, shots: 0, hits: 0, boss: null, reloadT: 0, flash: 0 }, edge = (k, n) => { const v = !!k[n], w = !!s.last[n]; s.last[n] = v; return v && !w; };
        const RD = C.design && Array.isArray(C.design.waves) && C.design.waves.length ? C.design : null, NW = RD ? RD.waves.length : C.waves, BH = RD && RD.boss ? RD.boss.hp : C.bossHp;
        const spawnWave = () => { s.wave++; const w = RD && RD.waves[s.wave - 1]; const n = w ? w.grunts : 3 + s.wave + (C.difficulty > 1 ? 1 : 0); s.left = n; s.civQ = w ? w.civilians : 0; if (s.wave > NW) { s.boss = { kind: 'boss', x: W / 2, y: 100, z: .25, hp: BH, max: BH, fireT: RD && RD.boss ? RD.boss.fire : 90, tel: 0, dir: 1, core: 0 }; s.en.push(s.boss); s.msg = 'BOSS!'; s.msgT = 90; } else { s.msg = 'WAVE ' + s.wave; s.msgT = 70; } };
        spawnWave();
        const add = () => { const w = RD && RD.waves[s.wave - 1], civ = w ? (s.civQ > 0 && r() < s.civQ / (s.civQ + s.left)) : (r() < C.civilians && s.wave > 1); if (w && civ) s.civQ--; s.en.push({ kind: civ ? 'civ' : 'grunt', x: 40 + r() * (W - 80), y: 90 + r() * 70, z: .08, hp: civ ? 1 : (w ? w.hp : 1 + (s.wave > 3 ? 1 : 0)), fireT: w ? Math.round(w.fire * (.8 + r() * .4)) : 70 + Math.floor(r() * 60), tel: 0, vx: (r() - .5) * .8, dead: 0, sp: w ? w.speed : 1 }); };
        return { s, C, step(k) {
            if (s.status !== 'play') return; s.t++; if (s.msgT > 0) s.msgT--; if (s.flash > 0) s.flash--;
            s.cover = !!k.x; s.cx = clamp(s.cx + ax(k) * C.reticleSpeed, 6, W - 6); if (!s.cover) s.cy = clamp(s.cy + ay(k) * C.reticleSpeed, 40, H - 30);
            if (s.cover) { if (s.ammo < C.mag && s.t % 6 === 0) s.ammo++; }
            else if (edge(k, 'z')) {
                if (s.ammo <= 0) { s.msg = 'RELOAD: TAKE COVER'; s.msgT = 40; }
                else { s.ammo--; s.shots++; let tgt = null, best = 9; for (const e of s.en) { if (e.dead) continue; const sc = .35 + e.z * 1.1, bs = e.kind === 'boss', w = 22 * sc * (bs ? 2.6 : 1), h = 44 * sc * (bs ? 2.4 : 1), dx = Math.abs(s.cx - e.x), dy = s.cy - (e.y - h / 2); if (dx < w / 2 + 2 && Math.abs(dy) < h / 2 + 2 && e.z > (tgt ? tgt.z : -1)) { tgt = e; best = dy; } }
                    if (tgt) { const sc = .35 + tgt.z * 1.1, h = 44 * sc, head = s.cy < tgt.y - h * .22, weak = tgt.kind === 'boss' ? Math.abs(s.cx - (tgt.x + Math.sin(s.t / 14) * 26 * sc)) < 7 * sc : head;
                        if (tgt.kind === 'civ') { tgt.dead = 20; s.hp--; s.combo = 0; s.score = Math.max(0, s.score - 300); s.msg = 'DO NOT SHOOT CIVILIANS'; s.msgT = 60; s.flash = 8; }
                        else { s.hits++; tgt.hp -= weak ? 2 : 1; s.combo++; s.best = Math.max(s.best, s.combo); if (tgt.hp <= 0) { tgt.dead = 20; s.killed++; s.score += (tgt.kind === 'boss' ? 5000 : weak ? 250 : 100) * (1 + Math.min(4, Math.floor(s.combo / 4))); if (tgt.kind !== 'boss') s.left--; if (weak) { s.msg = 'HEADSHOT'; s.msgT = 30; } } else s.score += 20; } }
                    else s.combo = 0; } }
            if (s.spawnT > 0) s.spawnT--; else if (s.left - s.en.filter(e => !e.dead && e.kind !== 'civ' && e.kind !== 'boss').length > 0 && s.en.filter(e => !e.dead).length < 4 && !s.boss) { add(); s.spawnT = Math.max(24, 70 - s.wave * 6); }
            for (const e of s.en) {
                if (e.dead) { if (e.dead > 0 && --e.dead === 0) e.dead = -1; continue; }
                if (e.kind === 'boss') { e.x += e.dir * 1.1; if (e.x > W - 70 || e.x < 70) e.dir = -e.dir; e.z = Math.min(.7, e.z + .0008); }
                else { e.z = Math.min(.9, e.z + (e.kind === 'civ' ? .0016 : (.0022 + s.wave * .0002) * (e.sp || 1))); e.x = clamp(e.x + (e.vx || 0), 20, W - 20); }
                if (e.kind === 'civ') { if (e.z >= .9) e.dead = 1, e.gone = true; continue; }
                if (--e.fireT <= 0 && e.tel === 0) { e.tel = 28; } if (e.tel > 0 && --e.tel === 0) { if (!s.cover) { s.hp -= e.kind === 'boss' ? 2 : 1; s.combo = 0; s.flash = 10; s.msg = 'HIT'; s.msgT = 20; } e.fireT = e.kind === 'boss' ? 80 : 90 + Math.floor(r() * 50) - s.wave * 3; }
            }
            s.en = s.en.filter(e => e.dead !== -1);
            if (s.hp <= 0) s.status = 'lose';
            else if (s.boss && s.boss.dead) { s.status = 'win'; s.score += s.hp * 500; }
            else if (!s.boss && s.left <= 0 && !s.en.some(e => !e.dead && e.kind === 'grunt')) { if (s.wave <= NW) spawnWave(); }
        }, draw(g) {
            g.fillStyle = RD && RD.theme ? RD.theme.floor : '#1a2230'; g.fillRect(0, 0, W, H); g.fillStyle = RD && RD.theme ? RD.theme.wall : '#2b3b52'; g.fillRect(0, 0, W, 90); g.strokeStyle = RD && RD.theme ? RD.theme.lines : '#3d5272'; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(W / 2, 80); g.lineTo(i * 40, H); g.stroke(); } for (let i = 0; i < 6; i++) { const y = 90 + i * i * 4 + (s.t % 20) * i * .4; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
            for (const e of s.en.slice().sort((a, b) => a.z - b.z)) { const sc = .35 + e.z * 1.1, w = 22 * sc, h = 44 * sc * (e.kind === 'boss' ? 2.4 : 1), wd = w * (e.kind === 'boss' ? 2.6 : 1); if (e.dead) { g.globalAlpha = e.dead / 20; }
                g.fillStyle = e.kind === 'civ' ? '#6ac46a' : e.kind === 'boss' ? '#8a3a3a' : e.tel ? '#ff5a5a' : '#c46a3a'; g.fillRect(e.x - wd / 2, e.y - h, wd, h); g.fillStyle = '#e8c8a0'; g.fillRect(e.x - wd * .22, e.y - h - 8 * sc, wd * .44, 8 * sc); if (e.kind === 'boss') { g.fillStyle = '#ffd24a'; g.fillRect(e.x + Math.sin(s.t / 14) * 26 * sc - 4, e.y - h * .6, 8, 8); fillText(g, 'BOSS ' + e.hp + '/' + e.max, e.x, e.y - h - 12, '#fff', 8, 'center'); }
                if (e.tel) fillText(g, '!', e.x, e.y - h - 12, '#ff0', 12, 'center'); g.globalAlpha = 1; }
            if (s.cover) { g.fillStyle = '#3b3b44'; g.fillRect(0, H - 90, W, 90); fillText(g, 'COVER  (RELOADING)', W / 2, H - 50, '#9ab', 9, 'center'); }
            else { g.strokeStyle = s.flash ? '#f55' : '#fff'; g.beginPath(); g.arc(s.cx, s.cy, 9, 0, 6.3); g.moveTo(s.cx - 14, s.cy); g.lineTo(s.cx + 14, s.cy); g.moveTo(s.cx, s.cy - 14); g.lineTo(s.cx, s.cy + 14); g.stroke(); }
            fillText(g, 'HP ' + s.hp + '  AMMO ' + s.ammo + '/' + C.mag + '  SCORE ' + s.score, 4, 12, '#fff', 9); fillText(g, 'WAVE ' + Math.min(s.wave, NW + 1) + '  COMBO ' + s.combo, W - 4, 12, '#fc6', 9, 'right'); if (s.msgT > 0) fillText(g, s.msg, W / 2, 60, '#ff0', 12, 'center'); end(g, s); } };
    };
    /* ---------------------------------------------------------------- baseball: you bat, the computer pitches. Pitch types (fastball, curve, changeup), timing + height contact, ground / fly / line-drive outcomes,
     * balls and strikes, walks, base running, innings. References: MLB The Show (timing-and-zone batting), Backyard Baseball (simple, readable, kid-friendly rules), Baseball Stars (arcade rules). */
    /* design = { pitcher: { name, pitches: { fastball, curve, change, slider: true/false }, strikeRate .3-.9, speed .7-1.4 }, field: { grass, sky, dirt colours }, you / cpu: team names } */
    A.BASEBALL_DESIGN = () => ({ you: 'Sandlot', cpu: 'Rivals', pitcher: { name: 'Big Lefty', pitches: { fastball: true, curve: true, change: true, slider: true }, strikeRate: .62, speed: 1 }, field: { grass: '#4a9a4a', sky: '#7fb8e8', dirt: '#b08a5a' } });
    A.baseball = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.baseball, cfg), r = rng(o.seed || 1), s = { status: 'play', score: 0, cpu: 0, inning: 1, top: false, outs: 0, balls: 0, strikes: 0, bases: [0, 0, 0], pitch: null, wait: 50, bx: 0, by: 0, swing: 0, result: '', resT: 0, hits: 0, hr: 0, last: {}, aim: 0, bat: 0, phase: 'wait' }, edge = (k, n) => { const v = !!k[n], w = !!s.last[n]; s.last[n] = v; return v && !w; };
        const PITCHES = { fastball: { f: 38, curve: 0, name: 'FASTBALL' }, curve: { f: 50, curve: 1, name: 'CURVEBALL' }, change: { f: 62, curve: 0, name: 'CHANGEUP' }, slider: { f: 44, curve: -1, name: 'SLIDER' } }, names = Object.keys(PITCHES);
        const advance = n => { let runs = 0; for (let i = 2; i >= 0; i--) if (s.bases[i]) { const to = i + n; s.bases[i] = 0; if (to >= 3) runs++; else s.bases[to] = 1; } if (n >= 4) runs++; else if (n >= 1) s.bases[n - 1] = 1; s.score += runs; return runs; };
        const walk = () => { if (s.bases[0] && s.bases[1] && s.bases[2]) s.score++; else if (s.bases[0] && s.bases[1]) s.bases[2] = 1; else if (s.bases[0]) s.bases[1] = 1; s.bases[0] = 1; };
        const out = () => { s.outs++; s.balls = s.strikes = 0; if (s.outs >= 3) endHalf(); };
        const endHalf = () => { s.outs = s.balls = s.strikes = 0; s.bases = [0, 0, 0]; let runs = 0; for (let i = 0; i < 3; i++) if (r() < C.cpuSkill / 3.4 && r() < .85) runs += 1 + (r() < .2 ? 1 : 0); runs = Math.min(runs, 4); s.cpu += runs; s.result = 'CPU SCORES ' + runs; s.resT = 80; s.inning++; if (s.inning > C.innings) s.status = s.score > s.cpu ? 'win' : 'lose'; };
        const strike = () => { s.strikes++; s.balls >= 0 && s.strikes >= 3 && (s.result = 'STRIKE OUT', s.resT = 50, out()); };
        const ballc = () => { s.balls++; if (s.balls >= 4) { walk(); s.result = 'WALK', s.resT = 50; s.balls = s.strikes = 0; } };
        const BD = C.design && C.design.pitcher ? C.design : null, on = BD ? names.filter(n => BD.pitcher.pitches[n]) : names, pn = on.length ? on : names;
        const throwPitch = () => { const p0 = PITCHES[pn[Math.floor(r() * pn.length)]], p = BD ? Object.assign({}, p0, { f: Math.max(20, Math.round(p0.f / (BD.pitcher.speed || 1))) }) : p0, strike_ = r() < (BD ? BD.pitcher.strikeRate : .62), ty = strike_ ? (r() - .5) * 60 : (r() < .5 ? -1 : 1) * (55 + r() * 25), tx = strike_ ? (r() - .5) * 50 : (r() - .5) * 120; s.pitch = { p, f: 0, tx, ty, strike: strike_ && Math.abs(ty) < 40 && Math.abs(tx) < 30 }; s.phase = 'pitch'; };
        return { s, C, step(k) {
            if (s.status !== 'play') return; if (s.resT > 0) s.resT--; if (s.swing > 0) s.swing--;
            s.bx = clamp(s.bx + ax(k) * 2.4, -50, 50); s.by = clamp(s.by + ay(k) * 2.4, -50, 50);
            if (s.phase === 'wait') { if (--s.wait <= 0) throwPitch(); return; }
            if (s.phase === 'run') { if (--s.wait <= 0) s.phase = 'wait', s.wait = 40; return; }
            const P = s.pitch; P.f++; const t = P.f / P.p.f;
            if (edge(k, 'z') && !P.swung) { P.swung = true; s.swing = 12; const dt = (P.f - (P.p.f - 3)) / P.p.f, bx = P.tx + P.p.curve * 18 * t * (1 - t) * 3, dyv = Math.abs(P.ty - s.by), dxv = Math.abs(bx - s.bx);
                if (Math.abs(dt) < .13 && dyv < 24 + C.contact * 4 && dxv < 40) { const q = 1 - Math.abs(dt) / .13 * .6 - dyv / 80, power = clamp(q + C.power * .1 + (s.by < P.ty ? .1 : -.05), .05, 1.2); P.hit = { q, power, pull: dt < -.04 ? -1 : dt > .04 ? 1 : 0, lift: clamp((P.ty - s.by) / 30, -1, 1) };
                    const d = power * 330 * (.7 + (1 - Math.abs(P.ty - s.by) / 60) * .3); s.hits++;
                    if (Math.abs(P.hit.pull) > .5 && q < .45) { s.result = 'FOUL'; s.resT = 40; if (s.strikes < 2) s.strikes++; P.done = true; }
                    else if (q < .28) { s.result = P.hit.lift < 0 ? 'GROUND OUT' : 'POP OUT'; s.resT = 50; out(); P.done = true; }
                    else if (d > 300 && q > .6) { s.result = 'HOME RUN!'; s.hr++; advance(4); s.resT = 80; P.done = true; s.phase = 'run'; s.wait = 60; }
                    else if (d > 230) { s.result = 'TRIPLE'; advance(3); s.resT = 60; P.done = true; s.phase = 'run'; s.wait = 50; }
                    else if (d > 160) { s.result = 'DOUBLE'; advance(2); s.resT = 60; P.done = true; s.phase = 'run'; s.wait = 50; }
                    else if (d > 90) { s.result = 'SINGLE'; advance(1); s.resT = 60; P.done = true; s.phase = 'run'; s.wait = 50; }
                    else { s.result = 'FLY OUT'; s.resT = 50; out(); P.done = true; } }
                else { P.whiff = true; } }
            if (P.f >= P.p.f + 4) { if (!P.done) { if (P.swung) { s.result = 'STRIKE (SWING)'; s.resT = 40; strike(); } else if (P.strike) { s.result = 'STRIKE (LOOKING)'; s.resT = 40; strike(); } else { s.result = 'BALL'; s.resT = 40; ballc(); } } s.pitch = null; if (s.phase === 'pitch') { s.phase = 'wait'; s.wait = 36; } if (s.status === 'play' && s.phase === 'wait' && s.outs === 0 && s.balls === 0 && s.strikes === 0 && s.resT > 0) s.wait = 70; }
        }, draw(g) {
            g.fillStyle = BD && BD.field ? BD.field.grass : '#4a9a4a'; g.fillRect(0, 0, W, H); g.fillStyle = BD && BD.field ? BD.field.sky : '#7fb8e8'; g.fillRect(0, 0, W, 70); g.fillStyle = BD && BD.field ? BD.field.dirt : '#b08a5a'; g.beginPath(); g.moveTo(W / 2 - 70, 90); g.lineTo(W / 2 + 70, 90); g.lineTo(W - 20, H); g.lineTo(20, H); g.closePath(); g.fill();
            g.strokeStyle = '#fff'; g.strokeRect(W / 2 - 30, 150 - 40, 60, 80); const P = s.pitch; if (P) { const t = P.f / P.p.f, bx = W / 2 + (P.tx * t) + P.p.curve * 18 * t * (1 - t) * 3, by = 100 + (150 + P.ty - 100) * t, sc = .25 + t * 1; g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, 6 * sc, 0, 6.3); g.fill(); }
            g.strokeStyle = s.swing ? '#fc6' : '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2 + s.bx - 30, 150 + s.by + 10); g.lineTo(W / 2 + s.bx + 30, 150 + s.by - 10 * (s.swing ? -1 : 1)); g.stroke(); g.lineWidth = 1;
            g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, W, 26); fillText(g, `INN ${s.inning}/${C.innings}  ${BD && BD.you ? BD.you.toUpperCase() : 'YOU'} ${s.score}  ${BD && BD.cpu ? BD.cpu.toUpperCase() : 'CPU'} ${s.cpu}  OUTS ${s.outs}  B ${s.balls} S ${s.strikes}`, 4, 11, '#fff', 8); fillText(g, 'BASES ' + s.bases.map((b, i) => b ? i + 1 : '-').join(' '), 4, 22, '#fc6', 8); if (P) fillText(g, P.p.name, W - 4, 22, '#9cf', 8, 'right'); if (s.resT > 0) fillText(g, s.result, W / 2, 120, '#ff0', 14, 'center'); end(g, s); } };
    };

    /* ---------------------------------------------------------------- god sim (PC version of the DS "Cosmos Keeper"): 12 stages of known history, Big Bang to Singularity. Tap for the stage resource, buy upgrades that earn on their own,
     * and pick one trait per slot (Spore): traits whose environment matches the stage give a bonus. Stage data comes from NRGodSim (the same data the DS ROM uses). The ending depends on how well your traits fit each stage (Sims-style care). */
    A.godsim = (cfg, o) => {
        const GS = (typeof module !== 'undefined' && typeof require === 'function') ? require('./nrgodsim.js') : root.NRGodSim;
        const C = Object.assign({}, A.DEFAULTS.godsim, cfg), S = GS.STAGES, s = { status: 'play', score: 0, stage: 0, res: 0, total: 0, n: [0, 0, 0, 0, 0, 0], pick: [0, 0, 0], sel: 0, slot: 0, matches: 0, fit: 0, t: 0, last: {}, msg: '', msgT: 0, ending: -1, goal: 0, data: null }, edge = (k, n) => { const v = !!k[n], w = !!s.last[n]; s.last[n] = v; return v && !w; };
        const begin = () => { s.data = GS.stageData(s.stage, C); s.goal = s.data.goal; s.res = 0; s.total = 0; s.n = [0, 0, 0, 0, 0, 0]; s.pick = [0, 0, 0]; s.sel = 0; s.slot = 0; };
        const fitOf = () => { const st = S[s.stage], env = st[3]; let m = 0; for (let i = 0; i < 3; i++) { const tr = st[9][i * 3 + s.pick[i]]; if (tr[1] === env) m += 1; else if (tr[1] === 255) m += .3; } return m; };
        const mult = () => 1 + .25 * fitOf();
        const cost = k => Math.round(s.data.ups[k].cost * Math.pow(1.15, s.n[k]));
        const income = () => { let v = 0; for (let k = 0; k < 6; k++) v += s.n[k] * s.data.ups[k].auto; return v * mult(); };
        begin();
        return { s, C, cost, income, mult, step(k) {
            if (s.status !== 'play') return; s.t++; if (s.msgT > 0) s.msgT--;
            if (edge(k, 'z')) { s.res += s.data.click * mult(); s.total += s.data.click * mult(); }
            if (edge(k, 'ArrowDown')) s.sel = (s.sel + 1) % 6; if (edge(k, 'ArrowUp')) s.sel = (s.sel + 5) % 6;
            if (edge(k, 'c')) s.slot = (s.slot + 1) % 3;
            if (edge(k, 'ArrowRight')) s.pick[s.slot] = (s.pick[s.slot] + 1) % 3; if (edge(k, 'ArrowLeft')) s.pick[s.slot] = (s.pick[s.slot] + 2) % 3;
            if (edge(k, 'x')) { const c = cost(s.sel); if (s.res >= c) { s.res -= c; s.n[s.sel]++; s.score += 5; } else { s.msg = 'NEED ' + c; s.msgT = 40; } }
            if (s.t % 60 === 0) { const v = income(); s.res += v; s.total += v; }
            if (s.total >= s.goal) { s.matches += fitOf(); s.score += 1000 * (s.stage + 1); s.fit++; s.msg = S[s.stage][0] + ' COMPLETE'; s.msgT = 90;
                if (s.stage >= S.length - 1) { const ratio = s.matches / (S.length * 3); s.ending = ratio < .2 ? 0 : ratio < .45 ? 1 : ratio < .7 ? 2 : 3; s.status = 'win'; s.score += 5000 * (s.ending + 1); } else { s.stage++; begin(); } }
        }, draw(g) {
            const st = S[s.stage], a = st[4], b = st[5], gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, `rgb(${a})`); gr.addColorStop(1, `rgb(${b})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
            const ac = `rgb(${st[6]})`; g.fillStyle = ac; for (let i = 0; i < 24; i++) { const x = (i * 97 + s.t * (.2 + (i % 5) * .1)) % W, y = (i * 53) % 120; g.fillRect(x, y, 2, 2); }
            fillText(g, st[0] + '  ' + st[1], 6, 14, '#fff', 11); fillText(g, st[2] + ' ' + Math.floor(s.res) + '  (+' + income().toFixed(1) + '/s)', 6, 28, ac, 9);
            g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(6, 34, W - 12, 6); g.fillStyle = ac; g.fillRect(6, 34, (W - 12) * Math.min(1, s.total / s.goal), 6); fillText(g, Math.floor(s.total) + ' / ' + s.goal, W / 2, 52, '#fff', 8, 'center');
            const r = 18 + 6 * Math.sin(s.t / 20); g.fillStyle = ac; g.beginPath(); g.arc(W - 70, 100, r + s.stage * 1.5, 0, 6.3); g.fill(); fillText(g, 'Z TAP', W - 70, 150, '#fff', 8, 'center');
            for (let k = 0; k < 6; k++) { const y = 62 + k * 17, on = k === s.sel; g.fillStyle = on ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.4)'; g.fillRect(6, y, 190, 15); fillText(g, st[8][k] + ' x' + s.n[k], 10, y + 11, s.res >= cost(k) ? '#fff' : '#889', 8); fillText(g, String(cost(k)), 192, y + 11, '#fc6', 8, 'right'); }
            for (let i = 0; i < 3; i++) { const tr = st[9][i * 3 + s.pick[i]], good = tr[1] === st[3]; fillText(g, (i === s.slot ? '> ' : '  ') + st[7][i] + ': ' + tr[0], 6, 182 + i * 12, good ? '#9f9' : '#fff', 8); }
            fillText(g, 'ENV ' + GS.ENV[st[3]] + '  x' + mult().toFixed(2), 190, 182, '#cde', 8); fillText(g, st[10][s.stage % 2], 6, 226, '#cde', 7);
            if (s.msgT > 0) fillText(g, s.msg, W / 2, 120, '#fff', 12, 'center'); if (s.status === 'win') { g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(0, 80, W, 70); fillText(g, GS.ENDINGS[s.ending], W / 2, 112, '#ffd24a', 16, 'center'); fillText(g, 'SCORE ' + s.score + '  (Z: again)', W / 2, 134, '#fff', 9, 'center'); }
        } };
    };

    /* ---------------------------------------------------------------- vehicle combat: a lap race where everyone is armed. References: Twisted Metal (weapons, wrecking, special attacks), Mario Kart (pickup crates, rubber banding, position),
     * Vigilante 8 (machine gun that overheats, homing missiles, mines). Player: Z machine gun (heat meter), X homing missile, C drop a mine, Up/Down gas / brake. Rivals: drive the lane, shoot back, drop mines when ahead.
     * You win by finishing the laps in the top 3 or by wrecking every rival; you lose when your car is wrecked or the clock runs out. */
    A.combat = (cfg, o) => {
        const C = Object.assign({}, A.DEFAULTS.combat, cfg), r = rng(o.seed || 1), total = 600, curveAt = [];
        const RD = C.design && Array.isArray(C.design.track) && C.design.track.length ? C.design : null;
        if (RD) { const sum = RD.track.reduce((n, q) => n + Math.max(1, q.len | 0), 0); let acc = 0, k = 0; for (let i = 0; i < total; i++) { while (k < RD.track.length - 1 && i >= (acc + Math.max(1, RD.track[k].len | 0)) / sum * total) { acc += Math.max(1, RD.track[k].len | 0); k++; } curveAt.push((RD.track[k].curve || 0) * .4); } }
        else for (let i = 0; i < total; i++) curveAt.push(Math.sin(i / (total / (C.curves * 2 * Math.PI))) * 1.6);
        const s = { status: 'play', score: 0, t: 0, z: 0, x: 0, v: 0, hp: C.hp, heat: 0, jam: 0, missiles: C.missiles, mines: C.mines, lap: 1, time: C.timeLimit, place: C.rivals + 1, wrecked: 0, hitsTaken: 0, gunHits: 0, missileHits: 0, mineHits: 0, picked: 0, crash: 0, msg: '', msgT: 0, last: {}, rivals: [], shots: [], missilesAir: [], minesOn: [], crates: [], fx: [] };
        const edge = (k, n) => { const v = !!k[n], w = !!s.last[n]; s.last[n] = v; return v && !w; };
        const say = (m, t) => { s.msg = m; s.msgT = t || 60; };
        for (let i = 0; i < C.rivals; i++) s.rivals.push({ id: i, z: 6 + i * 5, x: (i % 3 - 1) * .5, v: 0, hp: C.rivalHp, top: C.maxSpeed * (.82 + .05 * (i % 4)) * C.difficulty, fireT: 90 + i * 20, mineT: 200 + i * 40, dead: 0, lane: (i % 3 - 1) * .5, flash: 0 });
        for (let i = 0; i < 28; i++) s.crates.push({ z: 30 + i * (total * C.laps / 28) + r() * 10, x: (r() - .5) * 1.5, kind: i % 4, got: 0 });
        const crateAt = c => c.z; const prog = e => e.z;
        const dmg = (e, n, by) => { if (e.dead) return; e.hp -= n; e.flash = 8; if (e.hp <= 0) { e.dead = 120; s.wrecked++; s.score += 500 + (by === 'missile' ? 200 : 0); say('WRECKED!', 70); s.fx.push({ z: e.z, x: e.x, t: 20 }); } };
        const hurt = (n, why) => { if (s.crash > 0 && why === 'crash') return; s.hp -= n; s.hitsTaken++; s.crash = why === 'crash' ? 20 : 8; s.v *= why === 'mine' ? .5 : .85; if (why === 'mine') say('MINE!', 40); };
        const rank = () => 1 + s.rivals.filter(e => !e.dead && prog(e) > s.z).length;
        return { s, C, step(k) {
            if (s.status !== 'play') return; s.t++; if (s.t % 60 === 0) s.time--; if (s.msgT > 0) s.msgT--; if (s.crash > 0) s.crash--;
            const cur = curveAt[Math.floor(s.z) % total], off = Math.abs(s.x) > 1.05;
            s.v = clamp(s.v + (k.ArrowUp ? 1.2 : k.ArrowDown ? -2.4 : -.5), 0, C.maxSpeed * (off ? .5 : 1)); s.x = clamp(s.x + ax(k) * .03 * (s.v / C.maxSpeed + .3) - cur * s.v / C.maxSpeed * .012, -1.8, 1.8); s.z += s.v / 240; s.score += Math.round(s.v / 60);
            // weapons
            s.heat = Math.max(0, s.heat - (s.jam ? .5 : .8)); if (s.jam > 0 && --s.jam === 0) s.heat = 0;
            if (k.z && s.jam === 0 && s.t % 5 === 0) { s.shots.push({ z: s.z + .2, x: s.x, own: 1, life: 28 }); s.heat += 7; if (s.heat >= 100) { s.jam = 90; say('OVERHEAT', 60); } }
            if (edge(k, 'x') && s.missiles > 0) { let tg = null, bd = 40; for (const e of s.rivals) { const d = e.z - s.z; if (!e.dead && d > 1 && d < bd && Math.abs(e.x - s.x) < .9) { tg = e; bd = d; } } s.missiles--; s.missilesAir.push({ z: s.z + .4, x: s.x, own: 1, tg, v: s.v / 240 + .55, life: 120 }); }
            if (edge(k, 'c') && s.mines > 0) { s.mines--; s.minesOn.push({ z: s.z - .6, x: s.x, own: 1 }); }
            for (const b of s.shots) { b.life--; b.z += b.own ? .5 : -.4; for (const e of s.rivals) if (b.own && !e.dead && b.life > 0 && Math.abs(e.z - b.z) < .55 && Math.abs(e.x - b.x) < .26) { dmg(e, C.gunDamage, 'gun'); b.life = 0; s.gunHits++; s.score += 20; } if (!b.own && b.life > 0 && Math.abs(b.z - s.z) < .5 && Math.abs(b.x - s.x) < .26) { hurt(C.gunDamage * .8, 'gun'); b.life = 0; } }
            s.shots = s.shots.filter(b => b.life > 0);
            for (const m of s.missilesAir) { m.life--; if (m.own) { m.z += m.v; if (m.tg && !m.tg.dead) m.x += clamp(m.tg.x - m.x, -.04, .04); for (const e of s.rivals) if (!e.dead && Math.abs(e.z - m.z) < .6 && Math.abs(e.x - m.x) < .3) { dmg(e, C.missileDamage, 'missile'); m.life = 0; s.missileHits++; s.score += 100; s.fx.push({ z: m.z, x: m.x, t: 14 }); } } else { m.z -= m.v; m.x += clamp(s.x - m.x, -.025, .025); if (Math.abs(m.z - s.z) < .6 && Math.abs(m.x - s.x) < .3) { hurt(C.missileDamage, 'missile'); m.life = 0; s.fx.push({ z: m.z, x: m.x, t: 14 }); } } }
            s.missilesAir = s.missilesAir.filter(m => m.life > 0);
            // mines hit whoever drives over them (never the one who dropped it for the first second)
            for (const m of s.minesOn) { m.age = (m.age || 0) + 1; for (const e of s.rivals) if (!e.dead && Math.abs(e.z - m.z) < .5 && Math.abs(e.x - m.x) < .3 && (!m.own || m.age > 30)) { dmg(e, C.mineDamage, 'mine'); m.gone = 1; s.mineHits += m.own ? 1 : 0; s.score += 80; s.fx.push({ z: m.z, x: m.x, t: 14 }); } if (!m.gone && !m.own && m.age > 20 && Math.abs(s.z - m.z) < .5 && Math.abs(s.x - m.x) < .3) { hurt(C.mineDamage, 'mine'); m.gone = 1; s.fx.push({ z: m.z, x: m.x, t: 14 }); } }
            s.minesOn = s.minesOn.filter(m => !m.gone);
            for (const c of s.crates) if (!c.got && Math.abs(c.z - s.z) < .5 && Math.abs(c.x - s.x) < .3) { c.got = 1; s.picked++; s.score += 50; if (c.kind === 0) { s.missiles = Math.min(9, s.missiles + 2); say('MISSILES +2'); } else if (c.kind === 1) { s.mines = Math.min(6, s.mines + 2); say('MINES +2'); } else if (c.kind === 2) { s.hp = Math.min(C.hp, s.hp + 30); say('REPAIR +30'); } else { s.v = Math.min(C.maxSpeed * 1.2, s.v + 25); say('NITRO'); } }
            for (const c of s.crates) if (c.got && c.z < s.z - 20) c.got = 0 || c.got;
            // rivals
            for (const e of s.rivals) {
                if (e.flash > 0) e.flash--; if (e.dead) { e.dead--; if (e.dead === 0) { e.dead = -1; } continue; } if (e.dead === -1) continue;
                const gap = s.z - e.z, rubber = gap > 8 ? 1.12 : gap < -10 ? .9 : 1; e.v = clamp(e.v + (e.top * rubber - e.v) * .05, 0, C.maxSpeed * 1.1); e.z += e.v / 240 * (1 - .15 * (Math.abs(e.x) > 1.05 ? 1 : 0));
                const ahead = -gap; if (ahead > 0 && ahead < 8 && Math.abs(e.x - s.x) < .3) e.lane = e.x + (e.x > s.x ? .45 : -.45); // block / swerve
                e.x += clamp(e.lane - e.x, -.015, .015); if (r() < .004) e.lane = (r() - .5) * 1.5; e.lane = clamp(e.lane, -.9, .9);
                if (Math.abs(e.z - s.z) < .5 && Math.abs(e.x - s.x) < .3) { hurt(6, 'crash'); e.v *= .7; dmg(e, 4, 'ram'); }
                if (--e.fireT <= 0) { const behind = gap > 0 && gap < 22 && Math.abs(e.x - s.x) < .5; if (behind) { if (r() < .35) s.missilesAir.push({ z: e.z, x: e.x, own: 0, v: .4, life: 90 }); else s.shots.push({ z: e.z + .3, x: e.x, own: 0, life: 22 }); } e.fireT = Math.max(25, Math.floor((90 - 25 * C.difficulty) + r() * 70)); }
                if (--e.mineT <= 0) { if (ahead > 0) s.minesOn.push({ z: e.z - .6, x: e.x, own: 0 }); e.mineT = 260 + Math.floor(r() * 200); }
            }
            s.fx = s.fx.filter(f => --f.t > 0);
            s.place = rank();
            if (s.hp <= 0) { s.status = 'lose'; say('WRECKED', 90); }
            if (s.z >= s.lap * total) { s.lap++; s.time += 25; s.score += 300; if (s.lap > C.laps) { s.status = s.place <= 3 ? 'win' : 'lose'; s.score += s.status === 'win' ? 1000 * (4 - s.place) + s.time * 10 : 0; } }
            if (s.rivals.length && s.rivals.every(e => e.dead)) { s.status = 'win'; s.score += 3000; }
            if (s.time <= 0 && s.status === 'play') s.status = 'lose';
        }, draw(g) {
            g.fillStyle = '#58b8ff'; g.fillRect(0, 0, W, H / 2); g.fillStyle = '#2a8a2a'; g.fillRect(0, H / 2, W, H / 2); let x = 0, dx = 0, y = H; const base = Math.floor(s.z), proj = [];
            for (let n = 1; n < 70; n++) { const i = (base + n) % total, sc = 1 / (n * .12 + .2), yy = H / 2 + (H / 2) * sc * .55, w = 150 * sc; dx += curveAt[i] * .35; x += dx; const cx = W / 2 + x * sc * 8 - s.x * w * .9; proj[n] = { cx, yy, w, sc }; if (yy > y) continue; g.fillStyle = (i % 6 < 3) ? '#3a8a3a' : '#2f7a2f'; g.fillRect(0, yy, W, y - yy + 1); g.fillStyle = (i % 6 < 3) ? '#d44' : '#eee'; g.fillRect(cx - w * 1.15, yy, w * 2.3, y - yy + 1); g.fillStyle = '#555'; g.fillRect(cx - w, yy, w * 2, y - yy + 1); if (i % 4 < 2) { g.fillStyle = '#ddd'; g.fillRect(cx - 2 * sc, yy, 4 * sc, y - yy + 1); } y = yy; }
            const at = (zz, xx, f) => { const n = Math.round(zz - s.z); if (n < 1 || n >= 70 || !proj[n]) return; const q = proj[n]; f(q.cx + xx * q.w, q.yy, q.sc); };
            for (const c of s.crates) if (!c.got) at(c.z, c.x, (px, py, sc) => { g.fillStyle = ['#ff8a2a', '#8a4aff', '#4ae87a', '#4ab8ff'][c.kind]; g.fillRect(px - 6 * sc * 1.5, py - 12 * sc * 1.5, 12 * sc * 1.5, 12 * sc * 1.5); });
            for (const m of s.minesOn) at(m.z, m.x, (px, py, sc) => { g.fillStyle = '#222'; g.fillRect(px - 6 * sc * 1.5, py - 4 * sc * 1.5, 12 * sc * 1.5, 4 * sc * 1.5); g.fillStyle = '#f33'; g.fillRect(px - sc, py - 5 * sc * 1.5, 2 * sc, 2 * sc); });
            for (const e of s.rivals.slice().sort((a, b) => b.z - a.z)) if (e.dead >= 0) at(e.z, e.x, (px, py, sc) => { const w = 20 * sc * 1.5, h = 14 * sc * 1.5; g.fillStyle = e.dead > 0 ? '#555' : e.flash % 2 ? '#fff' : C.color2; g.fillRect(px - w / 2, py - h, w, h); if (!e.dead) { g.fillStyle = '#300'; g.fillRect(px - w / 2, py - h - 4, w, 2); g.fillStyle = '#4f4'; g.fillRect(px - w / 2, py - h - 4, w * Math.max(0, e.hp) / C.rivalHp, 2); } });
            for (const b of s.shots) at(b.z, b.x, (px, py, sc) => { g.fillStyle = b.own ? '#ff0' : '#f84'; g.fillRect(px - 1, py - 8 * sc, 2, 3 * sc + 2); });
            for (const m of s.missilesAir) at(m.z, m.x, (px, py, sc) => { g.fillStyle = m.own ? '#fff' : '#f55'; g.fillRect(px - 2 * sc - 1, py - 8 * sc, 4 * sc + 2, 6 * sc + 2); });
            for (const f of s.fx) at(f.z, f.x, (px, py, sc) => { g.fillStyle = f.t % 4 < 2 ? '#fd4' : '#f63'; g.beginPath(); g.arc(px, py - 8 * sc, (20 - f.t) * sc + 3, 0, 6.3); g.fill(); });
            g.fillStyle = C.color; g.fillRect(W / 2 - 14 + (s.crash % 4 < 2 ? 0 : 3), H - 34, 28, 18); g.fillStyle = '#111'; g.fillRect(W / 2 - 16, H - 22, 6, 6); g.fillRect(W / 2 + 10, H - 22, 6, 6); if (s.heat > 0) { g.fillStyle = '#ff0'; g.fillRect(W / 2 - 2, H - 40, 4, 6); }
            g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, W, 24); fillText(g, 'HP', 4, 10, '#fff', 8); g.fillStyle = '#400'; g.fillRect(18, 3, 60, 7); g.fillStyle = s.hp > 30 ? '#4f4' : '#f44'; g.fillRect(18, 3, 60 * Math.max(0, s.hp) / C.hp, 7); fillText(g, 'HEAT', 4, 21, '#fff', 8); g.fillStyle = '#442'; g.fillRect(30, 15, 48, 5); g.fillStyle = s.jam ? '#f44' : '#fc4'; g.fillRect(30, 15, 48 * Math.min(1, s.heat / 100), 5);
            fillText(g, 'MISSILES ' + s.missiles + '  MINES ' + s.mines, 88, 10, '#fff', 8); fillText(g, 'POS ' + s.place + '/' + (C.rivals + 1) + '  LAP ' + Math.min(s.lap, C.laps) + '/' + C.laps + '  TIME ' + Math.max(0, s.time), 88, 21, '#fff', 8); fillText(g, 'SCORE ' + s.score, W - 4, 10, '#fff', 8, 'right'); fillText(g, Math.round(s.v) + ' km/h', W - 4, H - 4, '#fff', 9, 'right');
            if (s.msgT > 0) fillText(g, s.msg, W / 2, 60, '#fff', 12, 'center'); end(g, s); } };
    };
    A.create = (mode, cfg, o) => { if (!A[mode] || !A.DEFAULTS[mode]) throw new Error('unknown arcade mode: ' + mode); return A[mode](cfg || {}, o || {}); };
    /* browser loop: A.play(canvas, mode, cfg, {keys}) */
    A.play = (canvas, mode, cfg, o = {}) => {
        canvas.width = W; canvas.height = H; const g = canvas.getContext('2d'), keys = o.keys || {}; let G = A.create(mode, cfg, { seed: o.seed }), acc = 0, last = performance.now(), raf = 0, stopped = false, zWas = false;
        const pollPads = () => { try { const ps = (typeof navigator !== 'undefined' && navigator.getGamepads) ? [...navigator.getGamepads()].filter(p => p && p.connected) : []; if (!ps.length) { keys.gp = []; return; } const b = (p, i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > .5)); keys.gp = ps.slice(0, 4).map(p => ({ ax: Math.abs(p.axes[0]) > .25 ? p.axes[0] : (b(p, 15) ? 1 : b(p, 14) ? -1 : 0), gas: b(p, 0) || b(p, 7), brake: b(p, 1) || b(p, 6), item: b(p, 2) || b(p, 3) || b(p, 5), any: p.buttons.some(x => x.pressed) })); if (keys.gp[0] && keys.gp[0].any) { keys.z = keys.z || keys.gp[0].gas; } } catch (e) {} };
        const loop = t => { if (stopped) return; pollPads(); acc += Math.min(100, t - last); last = t; while (acc >= 16.7) { acc -= 16.7; if (G.s.status !== 'play') { if (keys.z && !zWas) G = A.create(mode, cfg, { seed: (Math.random() * 1e9) | 0 }); } else G.step(keys); zWas = !!keys.z; } G.draw(g); raf = requestAnimationFrame(loop); };
        if (canvas.addEventListener) { let pn = 0; const pt = (e, d) => { const r = canvas.getBoundingClientRect(); keys.ptr = { x: (e.clientX - r.left) * W / (r.width || W), y: (e.clientY - r.top) * H / (r.height || H), down: d, n: d && !(keys.ptr && keys.ptr.down) ? ++pn : (keys.ptr ? keys.ptr.n : 0) }; }; canvas.addEventListener('pointerdown', e => pt(e, true)); canvas.addEventListener('pointermove', e => { if (keys.ptr && keys.ptr.down) pt(e, true); }); addEventListener('pointerup', e => { if (keys.ptr) keys.ptr.down = false; }); }
        raf = requestAnimationFrame(loop); return { get game() { return G; }, stop() { stopped = true; cancelAnimationFrame(raf); } };
    };
    if (typeof module !== 'undefined') module.exports = A; else root.NRArcade = A;
})(typeof window !== 'undefined' ? window : globalThis);

/* nr3d_sandbox.js (v1.13) - open-world 3D movement sandbox ("Sunlit Isles"): the Super Mario 64 style of play - a hub island with a mountain, a
 * wall-kick tower, a lava-pit platform course, goombas-style walkers, a stompable boss, coins, red coins and stars - built on the offline
 * software 3D renderer (nr3d.js) and the posable human + preset animations (nranim.js).
 * MOVEMENT (numbers come from the ROM catalog data where a real game gave them, tuned for metres/seconds):
 *   - speed ramps to a target each frame and jump height grows with run speed (Super Mario World: 0x50 standing -> 0x61 at full speed);
 *   - variable jump gravity: light while Z is held, double when released (SMW 3 vs 6 per frame) so taps hop and holds soar;
 *   - the heading steers toward the input in limited turn windows (Zelda Oracle angle steering) with a skid + side-flip turn-around at speed;
 *   - hits knock back for a short timer and grant invincibility frames (Zelda Oracle knockback / flashing);
 *   - jump chain (single -> double -> triple inside a landing window), long jump, backflip, side flip, wall slide + wall kick, dive + belly slide,
 *     ground pound, punch, crouch, ledge grab.
 * Keys: Arrows move relative to the camera (auto-chase), Z jump, X punch / dive (in air), C crouch (on ground) / ground pound (in air).
 * g = A.create('sandbox3d', cfg, {seed}); g.step(keys); g.draw(ctx); g.s = state. */
(function (root) {
    'use strict';
    const isNode = typeof module !== 'undefined' && typeof require !== 'undefined';
    const A = isNode ? require('./nrarcade.js') : root.NRArcade, N3 = isNode ? require('./nr3d.js') : root.NR3D, An = isNode ? require('./nranim.js') : root.NRAnim;
    const W = A.W, H = A.H, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, rng = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
    const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    const SB = {};
    /* ---- movement constants (m, s) ---- */
    SB.PHYS = {
        run: 8.2, crouchWalk: 2.4, accel: 22, decel: 26, skidDecel: 48, turnSlow: 14, turnFast: 4.2,
        jump: 10.8, jumpSpeedBonus: .14, double: 13.4, triple: 17.6, longSpeed: 12, longVy: 8.4, backVy: 15.2, backSpeed: 3.6, sideVy: 14.6,
        gHold: 26, gRelease: 52, terminal: -30, wallSlide: -4.6, wallKickVy: 12.8, wallKickSpeed: 7.6, diveSpeed: 11.5, diveVy: 3.5, poundDelay: .28, poundSpeed: -38, poundRadius: 3.6,
        chainWindow: .3, tripleMinSpeed: 6.5, airAccel: 15, knock: 7.5, knockTime: .4, inv: 1.6, stompBounce: 9.5, punchCd: .36, punchReach: 1.6
    };
    const DEF = { title: 'Sunlit Isles', hero: 'austin', goalStars: 4, health: 8, lives: 3, color: '#4aa8ff', color2: '#ffd84a' };
    A.DEFAULTS.sandbox3d = DEF;
    A.MODES.sandbox3d = { name: 'Open-world 3D movement (Mario-64 style)', controls: 'Arrows move (camera follows), Z jump (chain 3 for a triple), X punch / dive in air, C crouch / ground pound in air; crouch + Z = long jump / backflip; jump at a wall to wall-kick', genres: ['platformer_3d', 'open_world_3d', 'action_adventure'] };

    /* ---- the world ---- */
    SB.world = () => {
        const S = [], decor = [], add = (b, col, top) => { b.col = col; if (top) b.top = top; S.push(b); return b; }, G = [90, 160, 80], ROCK = [150, 120, 90], STONE = [170, 170, 180];
        // mountain: three tiers, each reached by a gentle ramp
        add(N3.box(0, 0, 28, 28, 3.2, 22), ROCK, [100, 170, 80]);
        add(N3.box(5, 3.2, 28, 14, 3.2, 12), ROCK, [100, 170, 80]);
        add(N3.box(9, 6.4, 28, 6, 3.2, 8), ROCK, [110, 180, 90]);
        for (const [x0, z0, x1, z1, h0, h1, ax] of [[-6, 5, 6, 17, 0, 3.2, 'z'], [-12, 26, -2, 30, 3.2, 6.4, 'x'], [-2, 26, 6, 30, 6.4, 9.6, 'x']]) { const b = { x0, z0, x1, z1, y0: 0, y1: Math.max(h0, h1), ramp: { axis: ax, h0, h1 }, col: STONE }; S.push(b); }
        // note: ramps 2 and 3 sit on top of the tiers below them
        S[S.length - 2].y0 = 3.2; S[S.length - 1].y0 = 6.4;
        // wall-kick shaft: two tall walls 2.4 apart, cap on top of the far one
        add(N3.box(-29.7, 0, -3, .6, 11, 6), [200, 190, 170]);
        add(N3.box(-26.7, 0, -3, .6, 11, 6), [200, 190, 170]);
        add(N3.box(-24.5, 10, -3, 4.8, 1, 6), [200, 190, 170], [230, 220, 120]);
        // fenced yard + crates + stone blocks to practise movement on
        for (let i = 0; i < 6; i++) add(N3.box(-8 + i * 1.8, 0, -14, 1.2, 1.2 + (i % 3) * .9, 1.2), [190, 140, 80], [215, 170, 100]).crate = i < 4;
        add(N3.box(6, 0, -6, 3, 1.3, 3), STONE); add(N3.box(11, 0, -6, 3, 2.6, 3), STONE); add(N3.box(16, 0, -6, 3, 3.9, 3), STONE);
        add(N3.box(24, 0, 10, 10, 1, 10), [190, 170, 120], [220, 200, 140]);
        // long platforms of a lava course (pit x 10..42, z -42..-10 is void/lava)
        const P = [[14, -26, 4.4, 1.0], [21, -26, 4, 1.6], [28.5, -26, 4, 2.4], [37, -26, 4, 3.2], [40, -18, 4, 4.2], [34, -12.5, 4.4, 5.4]];
        P.forEach((p, i) => add(N3.box(p[0], p[3] - .9, p[1], p[2], .9, p[2]), [210, 130, 70], [250, 200, 110]).pad = i);
        add(N3.box(10.5, 0, -26, 2.4, 1.0, 4.4), [210, 130, 70], [250, 200, 110]); // entry step
        // trees (decor, solid trunks)
        const r = rng(11); for (let i = 0; i < 30; i++) { const x = (r() - .5) * 84, z = (r() - .5) * 84; if (Math.hypot(x, z - 28) < 20 || (x > 6 && x < 44 && z < -8 && z > -44) || (x < -22 && x > -34 && Math.abs(z) < 8) || Math.hypot(x, z) < 6 || Math.abs(x - 24) < 7 && Math.abs(z - 10) < 7) continue; const b = add(N3.box(x, 0, z, .9, 3.2, .9), [110, 76, 46]); b.tree = true; }
        const solids = S.slice();
        const half = 45, groundFn = (x, z) => (Math.abs(x) > half || Math.abs(z) > half) ? -60 : (x > 12 && x < 42 && z < -10 && z > -42) ? -10 : 0;
        return { S: solids, half, groundFn };
    };
    const COINS = (() => { const c = []; for (let i = 0; i < 8; i++) c.push([-12 + Math.cos(i / 8 * 6.283) * 4, .8, -26 + Math.sin(i / 8 * 6.283) * 4]); for (let i = 0; i < 8; i++) c.push([-3 + i * .75, .8 + i * .38, 6 + i * 1.5 + 0]); for (let i = 0; i < 6; i++) c.push([-12 + i * 2, 4.2 + i * .53, 28]); for (let i = 0; i < 6; i++) c.push([14 + i * 4.2, 2.2 + i * .5, -26]); for (let i = 0; i < 6; i++) c.push([8, .8, -8 + i * 2.2 - 12]); for (let i = 0; i < 8; i++) c.push([36 + Math.cos(i / 8 * 6.283) * 5, .8, 28 + Math.sin(i / 8 * 6.283) * 5]); for (let i = 0; i < 6; i++) c.push([-20 + i * 2.2, .8, 18 - i * 1.5]); for (let i = 0; i < 5; i++) c.push([-38 + i * 1.6, .8, 20 + (i % 2) * 2]); return c; })();
    const REDS = [[-20, 1, -26], [10, 10.4, 25], [-24.5, 11.4, -3], [-36, 1, -34], [41, 1, 38], [-4, 1, 40], [26, 2, 12], [16, 5, -6]];
    const GOOMBAS = [[-16, -8], [-18, 6], [-10, 16], [8, -18], [16, 2], [24, 22], [34, 30], [-34, 24], [-22, 36], [4, 36], [-4, -30], [40, 8], [-36, -14], [30, -4]];
    const STARS = [{ id: 'mountain', name: 'On top of the mountain', x: 9, y: 11.2, z: 28 }, { id: 'tower', name: 'Climb the wall-kick tower', x: -24.5, y: 12, z: -3 }, { id: 'course', name: 'Cross the lava course', x: 34, y: 7, z: -12.5 }, { id: 'coins', name: '50 coins', x: 0, y: 1.5, z: -4, hidden: true }, { id: 'reds', name: 'Eight red coins', x: 0, y: 1.5, z: -8, hidden: true }, { id: 'king', name: 'Defeat the King Walker', x: 28, y: 1.8, z: 28, hidden: true }];
    SB.STARS = STARS;
    /* ---- 2.5D side-scrolling course (New Super Mario Bros / Klonoa / Crash style): the same 3D hero, camera and physics, locked to one plane.
     * Difficulty climbs along the course using presets/progression.json-style pacing: gaps widen, platforms rise, more walkers per section. ---- */
    SB.course = (seed, length, walkers) => {
        const r = rng(seed || 7), L = length || 240, S = [], coins = [], reds = [], goombas = [], stars = [], add = (b, col, top) => { b.col = col; if (top) b.top = top; S.push(b); return b; };
        let x = 0, y = 0, sec = 0; const GR = [90, 160, 80], TOPC = [110, 180, 90];
        add(N3.box(8, -2, 0, 20, 2 + 0, 6), [150, 120, 90], TOPC); x = 18; // start platform (top at y 0)
        S[0].y0 = -4; S[0].y1 = 0;
        while (x < L) {
            const t = x / L, gap = 2.2 + t * 3.2 + r() * 1.2, dy = Math.min(1.5, Math.round((r() - .4) * (1.2 + t * 2.4) * 2) / 2), w = 8 + r() * 7 - t * 3;
            x += gap; y = Math.max(0, Math.min(7, y + dy)); const cx = x + w / 2;
            add(N3.box(cx, y - 4, 0, w, 4, 6), [150, 120, 90], TOPC);
            const n = 3 + Math.floor(r() * 3); for (let i = 0; i < n; i++) coins.push([x + 1 + i * (w - 2) / n, y + .8 + (i % 2) * .6, 0]);
            if (walkers !== 0 && t > .12 && w > 9) for (let e = 0; e < Math.min(2, 1 + Math.floor(t * 2 + r())); e++) goombas.push([x + 4.5 + e * 2.6, 0]);
            if (sec % 4 === 2) add(N3.box(cx, y + 2.6, 0, 3, .6, 3), [210, 130, 70], [250, 200, 110]);
            if (sec % 5 === 3) reds.push([cx, y + 3.6, 0]);
            x += w; sec++;
        }
        stars.push({ id: 'flag', name: 'Reach the end of the course', x: x - 3, y: y + 1.2, z: 0 });
        add(N3.box(x - 3, y - 4, 0, 14, 4, 6), [150, 120, 90], TOPC);
        const groundFn = () => -40;
        return { world: { S, half: x + 40, groundFn }, coins: coins.map(c => c), reds, goombas, stars, king: null, start: [2, 0], minX: -4, length: x };
    };
    A.DEFAULTS.side3d = Object.assign({}, DEF, { title: 'Sunlit Run', plane: 'side', length: 240, walkers: 1, goalStars: 1, health: 6, lives: 3 });
    A.MODES.side3d = { name: '3D side-scroller (2.5D, Mario-style)', controls: 'Left/Right run, Z jump (chain 3 for a triple), X punch / dive, C crouch / ground pound, crouch + Z = long jump, jump at a wall to wall-kick', genres: ['sidescroller_3d'] };
    A.side3d = (cfg, o) => A.sandbox3d(Object.assign({}, A.DEFAULTS.side3d, cfg, { plane: 'side' }), o || {});

    A.sandbox3d = (cfg, o) => {
        const C = Object.assign({}, DEF, cfg), r = rng(o.seed || 1), P = SB.PHYS, LY = o.layout || (C.plane === 'side' ? SB.course(o.seed || 7, C.length, C.walkers) : null), Wd = LY ? LY.world : SB.world(), grid = N3.grid(Wd.S, 8);
        const hero = An.STYLES[C.hero] || An.STYLES.austin, act = An.actor(hero, (o.seed || 1) + 5);
        const s = { status: 'play', score: 0, t: 0, coins: 0, reds: 0, stars: 0, health: C.health, lives: C.lives, starList: (LY ? LY.stars : STARS).map(x => ({ id: x.id, name: x.name, got: false, x: x.x, y: x.y, z: x.z, show: !x.hidden })), goal: C.goalStars, msg: '', msgT: 0, hurtT: 0, kind: 'idle', chain: 0, chainT: 0, last: {}, shake: 0, world: Wd, anim: act, hits: 0, stomps: 0, pounds: 0, crates: 0, log: [] };
        const p = s.p = { x: LY ? LY.start[0] : 0, y: 0, z: LY ? LY.start[1] : -2, r: .42, h: 1.55, vx: 0, vy: 0, vz: 0, yaw: 0, groundFn: Wd.groundFn, speed: 0 }; s.safe = { x: LY ? LY.start[0] : 0, z: LY ? LY.start[1] : -2 }; s.cam = { yaw: 0, x: 0, y: 3, z: -8, pitch: 0 };
        s.coinList = (LY ? LY.coins : COINS).map((c, i) => ({ x: c[0], y: c[1], z: c[2], got: false, id: i })); s.redList = (LY ? LY.reds : REDS).map((c, i) => ({ x: c[0], y: c[1], z: c[2], got: false, id: i }));
        s.en = (LY ? LY.goombas : GOOMBAS).map((g, i) => ({ x: g[0], z: g[1], hx: g[0], hz: g[1], y: 0, yaw: r() * 6, hp: 1, st: 'patrol', t: r() * 3, dead: 0, sq: 0, id: i, vy: 0 }));
        s.king = { x: 28, z: 28, y: 9.6 - 9.6 + 0, hp: 3, st: 'idle', t: 0, yaw: 0, inv: 0, dead: 0, sq: 0, vy: 0 };
        s.king.y = 0; if (LY) { if (LY.king) { s.king.x = LY.king[0]; s.king.z = LY.king[1]; } else { s.king.dead = 1; s.king.sq = 0; } }
        const say = (m, t) => { s.msg = m; s.msgT = t || 120; s.log.push(m); };
        const addScore = n => { s.score += n; };
        const edge = (k, n) => { const v = !!k[n], w = !!s.last[n]; s.last[n] = v; return v && !w; };
        const starGet = id => { const st = s.starList.find(x => x.id === id); if (!st || st.got) return; st.got = true; s.stars++; addScore(1000); say('STAR GET!  ' + st.name, 220); s.health = C.health; if (s.stars >= s.goal) s.status = 'win'; };
        const hurt = (n, fx, fz) => { if (s.hurtT > 0 || s.kind === 'dead') return; s.health -= n; s.hurtT = P.inv; s.hits++; s.shake = 12; const l = Math.hypot(fx, fz) || 1; p.vx = fx / l * P.knock; p.vz = fz / l * P.knock; p.vy = Math.max(p.vy, 5); s.kind = 'hurt'; s.kt = P.knockTime; act.play('hurt', { replace: true }); if (s.health <= 0) { s.lives--; s.kind = 'dead'; s.kt = 1.2; act.play('die'); say(s.lives > 0 ? 'OUCH!' : 'GAME OVER', 120); } };
        const respawn = () => { p.x = s.safe.x; p.z = s.safe.z; p.y = Wd.groundFn(p.x, p.z) < -5 ? 0 : 0; p.vx = p.vy = p.vz = 0; s.health = C.health; s.kind = 'idle'; s.hurtT = 1.2; act.layers = []; };
        const horizSpeed = () => Math.hypot(p.vx, p.vz);
        const setVel = (sp, yaw) => { p.vx = Math.sin(yaw) * sp; p.vz = Math.cos(yaw) * sp; };
        const startAnim = (name, o2) => act.play(name, Object.assign({ mask: 'full', replace: true }, o2 || {}));
        s.step = k => {
            const dt = 1 / 60; if (s.status !== 'play') return; s.t += dt;
            if (C.plane === 'side') { k = Object.assign({}, k, { ArrowUp: s.kind === 'ledge' && !!(k.ArrowLeft || k.ArrowRight || k.ArrowUp), ArrowDown: false }); s.cam.yaw = 0; p.z = 0; p.vz = 0; }
            const zP = edge(k, 'z'), xP = edge(k, 'x'), cP = edge(k, 'c'), zH = !!k.z, cH = !!k.c;
            const ax = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0), fw = (k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0), mag = Math.min(1, Math.hypot(ax, fw));
            const cam = s.cam, fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
            const wx = rx * ax + fx * fw, wz = rz * ax + fz * fw, wantYaw = mag > 0 ? Math.atan2(wx, wz) : p.yaw;
            s.hurtT = Math.max(0, s.hurtT - dt); s.msgT = Math.max(0, s.msgT - 1); s.shake = Math.max(0, s.shake - 1);
            if (s.chainT > 0) { s.chainT -= dt; if (s.chainT <= 0) { s.chainT = 0; s.chain = 0; } } s.pc = Math.max(0, (s.pc || 0) - dt);
            const sp = horizSpeed(), kind = s.kind, grounded = p.ground;
            /* --- states --- */
            if (kind === 'dead') { s.kt -= dt; p.vx *= .9; p.vz *= .9; if (s.kt <= 0) { if (s.lives <= 0) s.status = 'lose'; else respawn(); } }
            else if (kind === 'hurt') { s.kt -= dt; p.vy -= P.gRelease * dt; if (s.kt <= 0 && grounded) s.kind = 'idle'; else if (s.kt <= -1) s.kind = 'idle'; }
            else if (kind === 'ledge') { p.vx = p.vz = p.vy = 0; s.kt -= dt; if ((zP || k.ArrowUp) && s.kt < 0) { s.kind = 'climb'; s.kt = .42; startAnim('pick_up_box', { speed: 1.6 }); } else if (cP || k.ArrowDown) { s.kind = 'air'; p.vy = -1; act.stop('ledge_hang', .1); } }
            else if (kind === 'climb') { p.vx = p.vz = p.vy = 0; s.kt -= dt; if (s.kt <= 0) { p.x -= s.ledge.nx * (p.r + .3); p.z -= s.ledge.nz * (p.r + .3); p.y = s.ledge.top; s.kind = 'idle'; act.stop(); } }
            else if (kind === 'pound') {
                s.kt -= dt; if (s.kt > 0) { p.vx = p.vz = 0; p.vy = 0; } else { p.vy = P.poundSpeed; p.vx = p.vz = 0; }
                if (grounded && s.kt <= 0) { s.kind = 'poundland'; s.kt = .35; s.pounds++; s.shake = 14; p.vy = 0; for (const e of s.en) if (!e.dead && Math.hypot(e.x - p.x, e.z - p.z) < P.poundRadius) killEn(e, 'pound'); for (const b of grid.near(p.x, p.z, P.poundRadius)) if (b.crate && !b.broken && Math.hypot((b.x0 + b.x1) / 2 - p.x, (b.z0 + b.z1) / 2 - p.z) < P.poundRadius) breakCrate(b); kingHit('pound'); }
            }
            else if (kind === 'poundland') { s.kt -= dt; p.vx = p.vz = 0; if (s.kt <= 0) { s.kind = 'idle'; act.stop('ground_pound', .1); } }
            else if (kind === 'slide') { s.kt -= dt; const f = Math.max(0, horizSpeed() - 9 * dt), yw = Math.atan2(p.vx, p.vz); setVel(f, yw); if (s.kt <= 0 || f < 1.5) { s.kind = 'idle'; act.stop('belly_slide', .12); } if (zP) { s.kind = 'air'; p.vy = 9.5; act.stop('belly_slide', .1); startAnim('jump', { hold: true }); } }
            else { /* idle / run / crouch / air / wallslide / skid */
                const crouching = grounded && cH && mag < .2 + (sp > 3 ? 1 : 0) * 0 || grounded && cH;
                if (grounded) {
                    p.pound = false; if (kind === 'air' || kind === 'wallslide') { landed(); }
                    // steering + speed
                    const target = (cH ? P.crouchWalk : P.run) * mag; let heading = p.yaw;
                    if (mag > 0) {
                        const d = angDiff(heading, wantYaw);
                        if (sp > 5.2 && Math.abs(d) > 2.4 && s.kind !== 'crouch') { s.kind = 'skid'; s.skidYaw = wantYaw; }
                        if (s.kind === 'skid') { const ns = Math.max(0, sp - P.skidDecel * dt); setVel(ns, heading); if (ns < 1.5) { s.kind = 'idle'; p.yaw = s.skidYaw; heading = p.yaw; } else if (zP) { s.kind = 'air'; heading = s.skidYaw; p.yaw = heading; setVel(5, heading); p.vy = P.sideVy; s.chain = 0; startAnim('side_flip', { hold: true }); s.jumpKind = 'side'; } }
                        if (s.kind !== 'skid') { const turn = lerp(P.turnSlow, P.turnFast, clamp(sp / P.run, 0, 1)) * dt; heading += clamp(d, -turn, turn); p.yaw = heading; }
                    }
                    if (s.kind !== 'skid') {
                        const cur = sp, nsp = cur + clamp(target - cur, -P.decel * dt, P.accel * dt); setVel(mag > 0 || nsp > .1 ? nsp : 0, mag > 0 ? p.yaw : Math.atan2(p.vx, p.vz) || p.yaw);
                        if (mag === 0 && nsp < .2) p.vx = p.vz = 0; s.kind = cH ? 'crouch' : nsp > .3 ? 'run' : 'idle';
                    }
                    /* jump */
                    if (zP && s.kind !== 'skid') {
                        const cur = horizSpeed(); s.jumpKind = 'single';
                        if (cH && cur > 5) { s.jumpKind = 'long'; p.vy = P.longVy; setVel(Math.max(cur, P.longSpeed), p.yaw); startAnim('long_jump', { hold: true }); s.chain = 0; }
                        else if (cH && cur < 3.2) { s.jumpKind = 'back'; p.vy = P.backVy; setVel(-P.backSpeed, p.yaw); startAnim('backflip', { hold: true }); s.chain = 0; }
                        else {
                            const n = s.chainT > 0 ? s.chain : 0;
                            if (n === 1) { p.vy = P.double + cur * .05; s.jumpKind = 'double'; s.chain = 2; startAnim('double_jump', { hold: true }); }
                            else if (n === 2 && cur >= P.tripleMinSpeed) { p.vy = P.triple; s.jumpKind = 'triple'; s.chain = 0; startAnim('triple_jump', { hold: true }); }
                            else { p.vy = P.jump + cur * P.jumpSpeedBonus; s.chain = 1; startAnim('jump', { hold: true }); }
                            s.chainT = 0;
                        }
                        s.kind = 'air'; p.ground = false; s.jumps = (s.jumps || 0) + 1;
                    } else if (xP && s.pc <= 0 && s.kind !== 'skid') { s.pc = P.punchCd; act.play('punch', { mask: 'upper' }); punch(); }
                    if (!zP && s.kind === 'crouch') { if (!act.playing('crouch')) startAnim('crouch', { loop: true, hold: true }); } else if (s.kind !== 'crouch' && act.playing('crouch')) act.stop('crouch', .1);
                } else {
                    /* airborne */
                    if (s.kind !== 'air' && s.kind !== 'wallslide') { s.kind = 'air'; if (!s.jumpKind) s.jumpKind = 'fall'; }
                    const prevKind = s.kind; s.kind = 'air';
                    // air steering toward input (limited, SMW-style: speed moves toward target)
                    if (mag > 0 && s.jumpKind !== 'long' && s.jumpKind !== 'dive') { const cur = horizSpeed(), cy = Math.atan2(p.vx, p.vz), tgt = P.run * mag, ns = clamp(cur + clamp(tgt - cur, -P.airAccel * dt, P.airAccel * dt * (cur < 3 ? 1.4 : .6)), 0, Math.max(cur, P.run)); const nvx = p.vx + wx * P.airAccel * dt * mag, nvz = p.vz + wz * P.airAccel * dt * mag, l = Math.hypot(nvx, nvz) || 1, cap = Math.max(ns, Math.min(l, Math.max(cur, P.run))); if (s.jumpKind !== 'back') { p.vx = nvx / l * cap; p.vz = nvz / l * cap; } else { p.vx = nvx / l * cap; p.vz = nvz / l * cap; } if (cur > .5 && s.jumpKind !== 'back' && s.jumpKind !== 'side') p.yaw += clamp(angDiff(p.yaw, Math.atan2(p.vx, p.vz)), -8 * dt, 8 * dt); }
                    // gravity (variable by held jump button)
                    const holding = zH && p.vy > 0 && s.jumpKind !== 'dive';
                    p.vy = Math.max(P.terminal, p.vy - (holding ? P.gHold : P.gRelease) * dt);
                    // actions in the air
                    if (cP && s.kind === 'air') { s.kind = 'pound'; s.kt = P.poundDelay; startAnim('ground_pound', { hold: true }); s.jumpKind = 'pound'; }
                    else if (xP && s.jumpKind !== 'dive') { s.jumpKind = 'dive'; setVel(P.diveSpeed, p.yaw); p.vy = Math.max(p.vy, P.diveVy); startAnim('dive', { hold: true }); }
                    // wall slide / kick / ledge
                    const w = p.wall;
                    if (w && p.vy < .5 && !(s.kind === 'pound')) {
                        const into = -(wx * w.nx + wz * w.nz);
                        // ledge: wall top just above head height
                        const top = w.box && w.box.y1, headY = p.y + p.h;
                        if (top && !w.box.ramp && p.vy <= 0 && top - headY > -.45 && top - headY < .5 && (into > .3 || mag === 0) && s.jumpKind !== 'dive') { s.kind = 'ledge'; s.kt = .25; s.ledge = { nx: w.nx, nz: w.nz, top: top }; p.y = top - p.h * .96; p.vy = 0; p.yaw = Math.atan2(-w.nx, -w.nz); startAnim('ledge_hang', { hold: true }); s.jumpKind = 'ledge'; }
                        else if (into > .3 && p.vy < 0 && w.box && w.box.y1 - p.y > 1.2 && !w.box.tree) { s.kind = 'wallslide'; p.vy = Math.max(p.vy, P.wallSlide); if (!act.playing('wall_slide')) startAnim('wall_slide', { hold: true }); p.yaw = Math.atan2(-w.nx, -w.nz); if (zP) { p.vy = P.wallKickVy; p.vx = w.nx * P.wallKickSpeed; p.vz = w.nz * P.wallKickSpeed; p.yaw = Math.atan2(w.nx, w.nz); s.jumpKind = 'kick'; s.kind = 'air'; s.kicks = (s.kicks || 0) + 1; startAnim('wall_kick', { hold: true }); s.chain = 0; } }
                    } else if (act.playing('wall_slide')) act.stop('wall_slide', .08);
                    if (zP && w && s.kind === 'air' && p.vy < 4 && w.box && !w.box.tree && w.box.y1 - p.y > 1.0) { p.vy = P.wallKickVy; p.vx = w.nx * P.wallKickSpeed; p.vz = w.nz * P.wallKickSpeed; p.yaw = Math.atan2(w.nx, w.nz); s.jumpKind = 'kick'; s.kicks = (s.kicks || 0) + 1; startAnim('wall_kick', { hold: true }); s.chain = 0; }
                }
            }
            /* --- move + collide --- */
            const prevGround = p.ground, prevVy = p.vy;
            p.vx = clamp(p.vx, -20, 20); p.vz = clamp(p.vz, -20, 20);
            const dx = p.vx * dt, dz = p.vz * dt, body = p; body.vx = dx; body.vz = dz; const vyKeep = p.vy; body.vy = vyKeep * dt;
            const near = grid.near(p.x, p.z, 4 + Math.hypot(dx, dz)); N3.collide(near, body, .55); body.vy = vyKeep; body.vx = dx / dt; body.vz = dz / dt; if (body.ground) body.vy = Math.min(0, vyKeep) === vyKeep ? 0 : vyKeep; if (body.hitHead) body.vy = Math.min(0, vyKeep);
            if (p.wall && p.ground) { /* walking into a wall kills that component */ const w = p.wall, d = p.vx * w.nx + p.vz * w.nz; if (d < 0) { p.vx -= d * w.nx; p.vz -= d * w.nz; } }
            if (p.wall && !p.ground) { const w = p.wall, d = p.vx * w.nx + p.vz * w.nz; if (d < 0 && s.kind !== 'ledge') { p.vx -= d * w.nx * .0; } }
            // pit / lava / void
            const gf = Wd.groundFn(p.x, p.z);
            if (p.y < -3.2 && gf === -10) { say('Lava!', 80); hurt(2, 0, 1); respawnSafe(); }
            else if (p.y < -25) { say('Fell off!', 80); s.health -= 2; if (s.health <= 0) { s.lives--; s.health = C.health; if (s.lives <= 0) s.status = 'lose'; } respawnSafe(); }
            if (p.ground && Math.abs(p.x) < Wd.half - 2 && gf === 0 && p.floor >= -.01 && (!p.wall) && s.t % 1 < dt) { const near2 = grid.near(p.x, p.z, 2); if (p.floor === 0 || near2.length === 0 || true) { s.safe.x = p.x; s.safe.z = p.z; s.safeY = p.floor; } }
            /* --- collectibles, enemies, stars --- */
            for (const c of s.coinList) if (!c.got && Math.abs(c.x - p.x) < 1 && Math.abs(c.z - p.z) < 1 && c.y > p.y - .6 && c.y < p.y + p.h + .5) { c.got = true; s.coins++; addScore(10); if (s.coins >= 50) { const st = s.starList.find(q => q.id === 'coins'); if (!st.got) { st.show = true; st.x = p.x + 1.5 * Math.sin(p.yaw); st.z = p.z + 1.5 * Math.cos(p.yaw); st.y = p.y + .8; say('A star appeared!', 120); } } }
            for (const c of s.redList) if (!c.got && Math.abs(c.x - p.x) < 1.1 && Math.abs(c.z - p.z) < 1.1 && c.y > p.y - .7 && c.y < p.y + p.h + .6) { c.got = true; s.reds++; addScore(50); s.coins += 2; say('Red coin ' + s.reds + '/8', 60); if (s.reds >= 8) { const st = s.starList.find(q => q.id === 'reds'); if (!st.got) { st.show = true; st.x = p.x + 1.5 * Math.sin(p.yaw); st.z = p.z + 1.5 * Math.cos(p.yaw); st.y = p.y + .8; say('A star appeared!', 120); } } }
            for (const st of s.starList) if (st.show && !st.got && Math.hypot(st.x - p.x, st.z - p.z) < 1.2 && Math.abs(st.y - (p.y + .8)) < 1.6) starGet(st.id);
            enemies(dt);
            /* camera: Lakitu-style chase; Left/Right alone swings it */
            const still = mag === 0 || (ax !== 0 && fw === 0 && sp < .5); if (ax !== 0 && fw === 0 && sp < .5) cam.yaw += ax * 2.2 * dt;
            else if (sp > 1 && fw > 0 && s.kind !== 'ledge') { const hy = Math.atan2(p.vx, p.vz); cam.yaw += clamp(angDiff(cam.yaw, hy), -1.7 * dt, 1.7 * dt) * clamp(sp / 8, .3, 1); }
            const tx = p.x, ty = p.y + 1.3, tz = p.z; let dist = 7.4; const cx = tx - Math.sin(cam.yaw) * dist, cz = tz - Math.cos(cam.yaw) * dist, cy2 = ty + 2.6 + Math.max(0, (p.y - (p.floor || 0)) * .15);
            let dd = 1; for (let i = 1; i <= 8; i++) { const t = i / 8, px = tx + (cx - tx) * t, py = ty + (cy2 - ty) * t, pz = tz + (cz - tz) * t; if (grid.blocked(tx, ty, tz, px, py, pz, .6)) { dd = Math.max(.25, (i - 1) / 8); break; } }
            const gx = tx + (cx - tx) * dd, gy = ty + (cy2 - ty) * dd, gz = tz + (cz - tz) * dd; cam.x += (gx - cam.x) * .25; cam.y += (gy - cam.y) * .25; cam.z += (gz - cam.z) * .25; cam.pitch = -Math.atan2(cam.y - ty, Math.hypot(cam.x - tx, cam.z - tz)); cam.yawView = Math.atan2(tx - cam.x, tz - cam.z);
            /* animate */
            act.x = p.x; act.y = p.y; act.z = p.z; act.floor = p.floor; const speed = Math.hypot(p.vx, p.vz); act.crouch = s.kind === 'crouch' ? 1 : 0; act.sneak = false;
            const anyClip = act.layers.some(l => !l.idle && l.mask === 'full' && !l.done);
            if (p.ground && !['pound', 'poundland', 'slide', 'ledge', 'climb', 'dead', 'hurt'].includes(s.kind)) { for (const l of act.layers) if (!l.idle && l.mask === 'full' && l.hold && !l.stopping && ['jump', 'double_jump', 'triple_jump', 'long_jump', 'backflip', 'side_flip', 'wall_slide', 'wall_kick', 'dive'].includes(l.name)) { act.stop(l.name, .06); } }
            if (s.kind === 'skid' && !act.playing('skid')) act.play('skid', { loop: true, mask: 'full' }); else if (s.kind !== 'skid' && act.playing('skid')) act.stop('skid', .1);
            if (!p.ground && !anyClip && s.kind === 'air' && p.vy < -4 && !act.playing('fall_flail')) act.play('fall_flail', { loop: true, mask: 'full' }); else if ((p.ground || p.vy > -1) && act.playing('fall_flail')) act.stop('fall_flail', .1);
            if (s.kind === 'dive' || s.jumpKind === 'dive') { /* dive landing */ }
            act.yaw = p.yaw; act.update(dt, { speed: p.ground ? speed : 0, grounded: p.ground || anyClip, vy: p.vy, yaw: p.yaw, mood: s.hurtT > 0 ? 'scared' : 'happy', energy: 1, ctx: 'bored' });
            s.speed = speed;
        };
        const landed = () => { const jk = s.jumpKind; if (jk === 'dive') { s.kind = 'slide'; s.kt = .7; startAnim('belly_slide', { hold: true }); } else { if (jk && jk !== 'long' && jk !== 'back' && jk !== 'side' && jk !== 'kick' && jk !== 'fall' && jk !== 'ledge') s.chainT = P.chainWindow + .12 * (jk === 'triple' ? 0 : 1); if (jk === 'long' || jk === 'back' || jk === 'side') s.chain = 0; if (jk === 'triple') { s.chain = 0; s.chainT = 0; } if (jk !== 'fall' || true) act.play('land', { mask: 'full', speed: 1.3, replace: true }); s.kind = 'idle'; } s.jumpKind = null; };
        const respawnSafe = () => { p.x = s.safe.x; p.z = s.safe.z; p.y = (s.safeY || 0) + .1; p.vx = p.vz = 0; p.vy = 0; s.kind = 'idle'; s.jumpKind = null; act.layers = []; s.hurtT = Math.max(s.hurtT, 1); };
        const killEn = (e, how) => { e.dead = 1; e.sq = 1; s.stomps++; addScore(100); s.coins++; const rx = r(); s.coinList.push({ x: e.x, y: e.y + .8, z: e.z, got: false, id: s.coinList.length }); };
        const breakCrate = b => { if (b.broken) return; b.broken = true; b.ghost = true; b.hide = true; s.crates++; for (let i = 0; i < 3; i++) s.coinList.push({ x: (b.x0 + b.x1) / 2 + (i - 1) * .6, y: b.y1 + .6, z: (b.z0 + b.z1) / 2, got: false, id: s.coinList.length }); addScore(30); };
        const kingHit = how => { const k = s.king; if (k.dead || k.inv > 0) return; if (Math.hypot(k.x - p.x, k.z - p.z) < 3.8 && (how === 'pound' || how === 'stomp')) { k.hp--; k.inv = 1.2; k.sq = 1; s.shake = 16; say('King Walker hit! ' + k.hp + ' left', 80); if (k.hp <= 0) { k.dead = 1; const st = s.starList.find(q => q.id === 'king'); st.show = true; st.x = k.x; st.z = k.z; st.y = 1.6; say('A star appeared!', 120); } } };
        const punch = () => { const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw); p.vx += fx * 2.5; p.vz += fz * 2.5; for (const e of s.en) if (!e.dead && Math.hypot(e.x - (p.x + fx * .8), e.z - (p.z + fz * .8)) < P.punchReach && Math.abs(e.y - p.y) < 1.4) killEn(e, 'punch'); for (const b of grid.near(p.x + fx, p.z + fz, 2)) if (b.crate && !b.broken) { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; if (Math.hypot(cx - (p.x + fx * .9), cz - (p.z + fz * .9)) < 1.6 && p.y < b.y1) breakCrate(b); } };
        const enemies = dt => {
            for (const e of s.en) {
                if (e.dead) { e.sq = Math.max(0, e.sq - dt * .8); continue; }
                const d = Math.hypot(p.x - e.x, p.z - e.z), see = d < 11 && s.kind !== 'dead';
                if (see) { e.st = 'chase'; } else if (e.st === 'chase' && d > 16) e.st = 'patrol';
                let tx, tz, spd;
                if (e.st === 'chase') { tx = p.x; tz = p.z; spd = 3.4; } else { e.t -= dt; if (e.t <= 0) { e.t = 2 + r() * 3; e.gx = e.hx + (r() - .5) * 8; e.gz = e.hz + (r() - .5) * 8; } tx = e.gx == null ? e.hx : e.gx; tz = e.gz == null ? e.hz : e.gz; spd = 1.6; }
                const dx = tx - e.x, dz = tz - e.z, l = Math.hypot(dx, dz);
                if (l > .3) { const nx = e.x + dx / l * spd * dt, nz = e.z + dz / l * spd * dt; const body = { x: nx, y: e.y, z: nz, r: .45, h: 1, vx: 0, vy: 0, vz: 0, groundFn: Wd.groundFn }; const nb = grid.near(nx, nz, 2); let blocked = false; for (const b of nb) if (!b.ghost && !b.ramp && b.y1 > e.y + .5 && b.y0 < e.y + 1 && nx > b.x0 - .45 && nx < b.x1 + .45 && nz > b.z0 - .45 && nz < b.z1 + .45) { blocked = true; break; } if (!blocked && Wd.groundFn(nx, nz) >= -1) { e.x = nx; e.z = nz; e.yaw = Math.atan2(dx, dz); } else e.t = 0; }
                const fl = N3.floorAt(grid.near(e.x, e.z, 2), { x: e.x, z: e.z, r: .4, groundFn: Wd.groundFn }, e.y + .6); e.y = fl;
                // contact: stomp if the player is falling onto the head, otherwise damage
                const dh = Math.hypot(p.x - e.x, p.z - e.z);
                if (dh < .95 && s.kind !== 'dead') {
                    const above = p.y > e.y + .55 && p.vy < 0.5;
                    if (above || s.kind === 'pound' && p.y > e.y) { killEn(e, 'stomp'); p.vy = P.stompBounce; if (s.kind === 'pound') s.kind = 'air'; s.jumpKind = 'single'; startAnim('jump', { hold: true }); }
                    else if (s.kind === 'slide' || (s.jumpKind === 'dive' && !p.ground)) { killEn(e, 'dive'); }
                    else if (s.hurtT <= 0) hurt(1, p.x - e.x, p.z - e.z);
                }
            }
            const k = s.king; if (!k.dead) {
                k.inv = Math.max(0, k.inv - dt); const d = Math.hypot(p.x - k.x, p.z - k.z), spd = d < 20 ? 2.4 : 0; k.sq = Math.max(0, k.sq - dt);
                if (d < 20 && d > 2.2) { k.x += (p.x - k.x) / d * spd * dt; k.z += (p.z - k.z) / d * spd * dt; k.yaw = Math.atan2(p.x - k.x, p.z - k.z); }
                k.y = N3.floorAt(grid.near(k.x, k.z, 3), { x: k.x, z: k.z, r: 1.2, groundFn: Wd.groundFn }, k.y + 1);
                if (d < 2.3 && p.y < k.y + 2.8 && s.hurtT <= 0 && s.kind !== 'dead') { if (p.y > k.y + 2.0 && p.vy < 0) { kingHit('stomp'); p.vy = 11; } else hurt(2, p.x - k.x, p.z - k.z); }
            }
        };
        /* ---- drawing ---- */
        const R = N3.create(W, H); let spin = 0;
        const drawGoomba = (e, sc) => { const y = e.y, sq = 1 - e.sq * .7, mat = [Math.cos(e.yaw), 0, Math.sin(e.yaw), 0, 1, 0, -Math.sin(e.yaw), 0, Math.cos(e.yaw)]; const I = [1, 0, 0, 0, 1, 0, 0, 0, 1]; An.ellipsoid(R, I, [e.x, y + .55 * sc * sq, e.z], .55 * sc, .5 * sc * sq, .55 * sc, [150, 95, 55], 4, 8); An.ellipsoid(R, I, [e.x, y + .18 * sc, e.z], .4 * sc, .2 * sc * sq, .42 * sc, [240, 210, 170], 3, 7); const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw), rx = Math.cos(e.yaw), rz = -Math.sin(e.yaw); const ph = Math.sin(s.t * 9 + e.id) * .25; for (const sd of [-1, 1]) { An.ellipsoid(R, I, [e.x + rx * sd * .28 * sc + fx * ph * sd * sc * .5, y + .08 * sc, e.z + rz * sd * .28 * sc + fz * ph * sd * sc * .5], .17 * sc, .09 * sc, .27 * sc, [60, 36, 24], 3, 6); if (e.sq < .6) { An.ellipsoid(R, I, [e.x + rx * sd * .2 * sc + fx * .44 * sc, y + .66 * sc * sq, e.z + rz * sd * .2 * sc + fz * .44 * sc], .11 * sc, .14 * sc, .05 * sc, [250, 250, 250], 2, 6); An.ellipsoid(R, I, [e.x + rx * sd * .2 * sc + fx * .49 * sc, y + .66 * sc * sq, e.z + rz * sd * .2 * sc + fz * .49 * sc], .045 * sc, .07 * sc, .03 * sc, [20, 20, 24], 2, 5); R.limb([e.x + rx * sd * .32 * sc + fx * .46 * sc, y + .86 * sc * sq, e.z + rz * sd * .32 * sc + fz * .46 * sc], [e.x + rx * sd * .06 * sc + fx * .5 * sc, y + .79 * sc * sq, e.z + rz * sd * .06 * sc + fz * .5 * sc], .03 * sc, .03 * sc, [40, 24, 16], 3, false); } } };
        const star = (x, y, z, sz, col) => { const a = spin, pts = [], rr = [sz, sz * .45]; for (let i = 0; i < 10; i++) { const t = i / 10 * Math.PI * 2 + a; pts.push([x + Math.cos(t) * rr[i & 1], y + Math.sin(t) * rr[i & 1], z]); } const d = .18 * sz, cF = [x, y, z - d], cB = [x, y, z + d]; for (let i = 0; i < 10; i++) { const q = pts[i], w = pts[(i + 1) % 10]; R.tri(cF, q, w, col); R.tri(cB, w, q, N3.shade(col, .85)); } };
        const rot = (cx, cz, yaw, f) => f; // placeholder (stars face camera by yawing the axes below)
        s.draw = g => {
            spin += .05; const cam = s.cam, sh = s.shake > 0 ? (Math.random() - .5) * .12 : 0;
            R.begin({ x: cam.x + sh, y: cam.y + sh, z: cam.z, yaw: cam.yawView, pitch: cam.pitch, fov: 1.1 }, { top: [70, 140, 235], bottom: [200, 225, 245], fog: [196, 222, 245], fogNear: 45, fogFar: 140, ambient: .46 });
            // water / lava below
            R.floor(-110, -110, 110, 110, -14, [30, 90, 170], [26, 84, 160], 20);
            R.floor(12, -42, 42, -10, -4.5, [240, 100, 30], [255, 150, 40], 6);
            R.floor(-45, -45, 45, 45, 0, [92, 170, 78], [84, 160, 70], 5);
            // island edge skirt
            for (const [x0, z0, x1, z1] of [[-45, -45, 45, -45], [-45, 45, 45, 45], [-45, -45, -45, 45], [45, -45, 45, 45]]) R.quad([x0, 0, z0], [x1, 0, z1], [x1, -14, z1], [x0, -14, z0], [120, 90, 60]);
            // pit walls
            R.quad([12, 0, -10], [42, 0, -10], [42, -4.5, -10], [12, -4.5, -10], [110, 80, 60]); R.quad([12, 0, -42], [12, 0, -10], [12, -4.5, -10], [12, -4.5, -42], [120, 86, 60]); R.quad([42, 0, -42], [42, 0, -10], [42, -4.5, -10], [42, -4.5, -42], [120, 86, 60]); R.quad([12, 0, -42], [42, 0, -42], [42, -4.5, -42], [12, -4.5, -42], [100, 72, 52]);
            R.quad([12, 0, -42], [42, 0, -42], [42, 0, -10], [12, 0, -10], [250, 120, 40], .0001); // keeps the pit mouth open
            const lim = 70;
            for (const b of Wd.S) {
                if (b.hide) continue; const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; if (Math.abs(cx - cam.x) > lim || Math.abs(cz - cam.z) > lim) continue;
                if (b.ramp) { N3.drawRamp(R, b, b.col); continue; }
                if (b.tree) { R.prism(cx, 0, cz, .42, 2.3, 6, [110, 76, 46], .34); R.prism(cx, 1.8, cz, 2, 3, 8, [44, 130, 56], .05); R.prism(cx, 3.4, cz, 1.4, 2.2, 8, [54, 150, 64], .05); continue; }
                const cols = [b.col, b.col, N3.shade(b.col, .85), N3.shade(b.col, .85), b.top || b.col, b.col]; R.box(cx, b.y0, cz, b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0, b.col, 0, cols);
                if (b.crate) { R.box(cx, b.y0, cz, b.x1 - b.x0 + .02, .12, b.z1 - b.z0 + .02, [120, 80, 40]); R.box(cx, b.y1 - .12, cz, b.x1 - b.x0 + .02, .12, b.z1 - b.z0 + .02, [120, 80, 40]); }
            }
            for (const c of s.coinList) if (!c.got) { const a = spin + c.id; R.quad([c.x - Math.cos(a) * .3, c.y - .3, c.z - Math.sin(a) * .3], [c.x + Math.cos(a) * .3, c.y - .3, c.z + Math.sin(a) * .3], [c.x + Math.cos(a) * .3, c.y + .3, c.z + Math.sin(a) * .3], [c.x - Math.cos(a) * .3, c.y + .3, c.z - Math.sin(a) * .3], [250, 210, 50]); }
            for (const c of s.redList) if (!c.got) { const a = spin * 1.3 + c.id; R.quad([c.x - Math.cos(a) * .38, c.y - .38, c.z - Math.sin(a) * .38], [c.x + Math.cos(a) * .38, c.y - .38, c.z + Math.sin(a) * .38], [c.x + Math.cos(a) * .38, c.y + .38, c.z + Math.sin(a) * .38], [c.x - Math.cos(a) * .38, c.y + .38, c.z - Math.sin(a) * .38], [235, 50, 50]); }
            for (const e of s.en) { if (e.dead && e.sq <= 0) continue; if (Math.hypot(e.x - cam.x, e.z - cam.z) > 60) continue; R.shadow(e.x, e.y, e.z, .6, .35); drawGoomba(e, 1); }
            if (!s.king.dead || s.king.sq > 0) { const k = s.king; R.shadow(k.x, k.y, k.z, 1.8, .4); drawGoomba({ x: k.x, z: k.z, y: k.y, yaw: k.yaw, sq: k.sq * .5, id: 3 }, 3); if (k.inv > 0 && ((s.t * 12) | 0) % 2) { /* flicker */ } }
            for (const st of s.starList) if (st.show && !st.got) { star(st.x, st.y + Math.sin(s.t * 3) * .15, st.z, .55, [255, 224, 60]); R.shadow(st.x, N3.floorAt(Wd.S, { x: st.x, z: st.z, r: .3, groundFn: Wd.groundFn }, st.y), st.z, .5, .25); }
            if (!(s.hurtT > 0 && ((s.t * 14) | 0) % 2 && s.kind !== 'dead')) An.draw(R, act, { lod: 0 });
            R.end(g);
            // HUD
            g.font = 'bold 11px monospace'; g.textAlign = 'left'; g.fillStyle = '#ffe14a'; g.fillText('x' + s.coins, 20, 14); g.fillStyle = '#ffe14a'; g.beginPath(); g.arc(12, 10, 5, 0, 6.3); g.fill();
            g.fillStyle = '#fff'; g.fillText('★ ' + s.stars + '/' + s.goal, 8, 28); g.fillStyle = '#ff7a7a'; g.fillText('RED ' + s.reds + '/8', 8, 40);
            for (let i = 0; i < C.health; i++) { g.fillStyle = i < s.health ? (s.health <= 2 ? '#ff4a4a' : '#4ae87a') : 'rgba(0,0,0,.45)'; g.fillRect(W - 12 - (C.health - i) * 9, 6, 7, 10); }
            g.textAlign = 'right'; g.fillStyle = '#fff'; g.font = '9px monospace'; g.fillText('LIVES ' + s.lives, W - 6, 28);
            if (s.msgT > 0 && s.msg) { g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(W / 2 - 130, H - 40, 260, 20); g.fillStyle = '#ffe14a'; g.font = 'bold 11px monospace'; g.fillText(s.msg, W / 2, H - 26); }
            if (s.status !== 'play') { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, H / 2 - 30, W, 60); g.textAlign = 'center'; g.fillStyle = s.status === 'win' ? '#4ae87a' : '#ff5a5a'; g.font = '18px monospace'; g.fillText(s.status === 'win' ? 'ALL STARS COLLECTED' : 'GAME OVER', W / 2, H / 2 + 6); }
        };
        const stepFn = s.step; s.step = k => { stepFn(k); if (C.plane === 'side') { p.z = 0; p.vz = 0; s.cam.yaw = 0; if (p.x < LY.minX) { p.x = LY.minX; p.vx = Math.max(0, p.vx); } } };
        return { s, C, step: s.step, draw: s.draw };
    };
    A.NRSandbox = SB;
    if (isNode) module.exports = SB; else root.NRSandbox = SB;
})(typeof window !== 'undefined' ? window : globalThis);

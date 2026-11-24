/* nr3d_war.js (v1.13) - large-map first-person sci-fi shooter ("Ring Ops"): the Halo style of fight rather than the corridor-shooter style.
 *   - a 130 x 130 m valley with a crash site, boulder fields, low walls, ridges and a walled outpost with a sniper tower; enemies hide in ambush
 *     behind cover until you come close, then pop up, peek, strafe, flank and throw grenades;
 *   - regenerating shield + health (shield recharges ~4.5 s after the last hit; health only from packs), headshots, frag grenades, melee,
 *     pick-up weapons dropped by enemies, a motion-tracker radar, dodgeable plasma bolts and a sniper's laser telegraph;
 *   - enemy tactics are chosen with the score-table scheme of the Pokemon trainer AI recorded in the ROM catalog (every tactic starts at 10,
 *     rules add or subtract, the LOWEST score wins, ties are random) so each enemy type feels different with almost no code;
 *   - damage has the catalog's random 217..255 / 255 spread (about 15%) and headshots count as criticals.
 * Keys: Up/Down move, Left/Right turn, hold C = strafe (Left/Right) or look up/down (Up/Down), Z fire, X reload (melee when close), Up+Down = grenade,
 *       Left+Right = swap weapon.  g = A.create('warfare3d', cfg, {seed}); g.step(keys); g.draw(ctx); g.s = state. */
(function (root) {
    'use strict';
    const isNode = typeof module !== 'undefined' && typeof require !== 'undefined';
    const A = isNode ? require('./nrarcade.js') : root.NRArcade, N3 = isNode ? require('./nr3d.js') : root.NR3D, An = isNode ? require('./nranim.js') : root.NRAnim;
    const W = A.W, H = A.H, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, rng = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
    const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    const WR = {};
    WR.WEAPONS = {
        ar: { name: 'Assault Rifle', dmg: 7, rate: 5, mag: 32, spread: .02, pellets: 1, auto: true, zoom: 1, reserve: 224, held: 'rifle', reload: 100 },
        pistol: { name: 'Magnum', dmg: 24, rate: 16, mag: 12, spread: .003, pellets: 1, zoom: 2, reserve: 60, held: 'pistol', reload: 80 },
        shotgun: { name: 'Shotgun', dmg: 8, rate: 44, mag: 6, spread: .075, pellets: 9, zoom: 1, reserve: 30, held: 'rifle', reload: 130 },
        sniper: { name: 'Sniper Rifle', dmg: 75, rate: 58, mag: 4, spread: .0008, pellets: 1, zoom: 5, reserve: 20, held: 'rifle', reload: 140 }
    };
    WR.ENEMIES = {
        grunt: { name: 'Scrapper', hp: 20, sh: 0, spd: 3.3, style: 'grunt', dmg: 6, cd: 55, burst: 3, bspd: 15, acc: .07, score: 100, scale: .78, panic: true, held: 'pistol' },
        warden: { name: 'Warden', hp: 45, sh: 70, spd: 4.3, style: 'elite', dmg: 11, cd: 44, burst: 4, bspd: 24, acc: .04, score: 300, scale: 1, charge: true, held: 'rifle' },
        hawk: { name: 'Hawk', hp: 30, sh: 30, spd: 3.4, style: 'soldier', dmg: 48, cd: 140, burst: 1, bspd: 0, acc: .0, score: 250, scale: 1, sniper: true, held: 'rifle' }
    };
    const DEF = { title: 'Ring Ops', mode: 'campaign', camera: 'first', health: 100, shield: 100, lives: 3, difficulty: 1, color: '#5ab0ff', color2: '#ffd84a' };
    A.DEFAULTS.warfare3d = DEF;
    A.MODES.warfare3d = { name: 'Large-map 3D warfare (Halo style: cover, flanking, shields)', controls: 'Up/Down move, Left/Right turn, hold C to strafe or look up/down, Z fire, X reload (melee up close), Up+Down grenade, Left+Right swap weapon', genres: ['military_shooter', 'shooter_fps', 'shooter_tps', 'open_world_3d'] };
    const HALF = 100;

    /* ---------------------------------------------------------------- the map */
    WR.world = () => {
        const r = rng(5), S = [], add = (b, col, kind, extra) => { b.col = col; b.kind = kind || 'solid'; if (extra) Object.assign(b, extra); S.push(b); return b; };
        const ROCK = [120, 112, 100], DIRT = [140, 120, 96], METAL = [96, 104, 116], WALL = [150, 146, 136], CRATE = [116, 98, 66];
        // canyon walls
        add(N3.box(0, 0, -HALF - 3, HALF * 2 + 12, 16, 6), [110, 96, 84], 'cliff', { nocover: true }); add(N3.box(0, 0, HALF + 3, HALF * 2 + 12, 16, 6), [110, 96, 84], 'cliff', { nocover: true }); add(N3.box(-HALF - 3, 0, 0, 6, 16, HALF * 2 + 12), [100, 88, 78], 'cliff', { nocover: true }); add(N3.box(HALF + 3, 0, 0, 6, 16, HALF * 2 + 12), [100, 88, 78], 'cliff', { nocover: true });
        // crash site: broken hull segments
        add(N3.box(-14, 0, -26, 9, 3.4, 3.2), METAL, 'hull'); add(N3.box(-5, 0, -28, 7, 2.2, 3), METAL, 'hull'); add(N3.box(-9.5, 0, -22, 3, 1.2, 6), METAL, 'hull'); add(N3.box(6, 0, -24, 4, 4.2, 4), METAL, 'hull');
        // rocks and boulders (ellipsoid visual, slightly smaller collision)
        const rocks = []; let tries = 0; while (rocks.length < 46 && tries++ < 700) { const x = (r() - .5) * 112, z = -34 + r() * 76; if (Math.hypot(x, z + 58) < 12 || Math.hypot(x - 44, z - 56) < 10 || (z > 28 && Math.abs(x) < 26) || (Math.abs(x + 10) < 12 && z < -18 && z > -34)) continue; if (rocks.some(q => Math.hypot(q.x - x, q.z - z) < 7)) continue; const a = 1.2 + r() * 2.6, h = 1.0 + r() * 3.4; rocks.push({ x, z, a, h }); add(N3.box(x, 0, z, a * 1.5, h, a * 1.4), ROCK, 'rock', { rx: a * .95, ry: h * .62, rz: a * .92 }); }
        // low walls in lines (half cover) - ruins
        for (let i = 0; i < 14; i++) { const x = (r() - .5) * 96, z = -26 + r() * 54; if (Math.hypot(x, z + 58) < 14 || (z > 28 && Math.abs(x) < 26)) continue; if (S.some(b => x > b.x0 - 4 && x < b.x1 + 4 && z > b.z0 - 4 && z < b.z1 + 4 && b.kind !== 'cliff')) continue; const al = r() < .5; add(N3.box(x, 0, z, al ? 7 : .7, 1.15, al ? .7 : 7), WALL, 'low'); }
        // open-world extension: outer rocks, west fuel depot, east radio station
        { let t2 = 0, n2 = 0; while (n2 < 60 && t2++ < 900) { const x = (r() - .5) * 2 * (HALF - 8), z = (r() - .5) * 2 * (HALF - 8); if (Math.abs(x) < 60 && z > -66 && z < 62) continue; if (Math.hypot(x + 66, z - 20) < 18 || Math.hypot(x - 70, z + 14) < 16) continue; if (S.some(b => b.kind === 'rock' && Math.hypot((b.x0 + b.x1) / 2 - x, (b.z0 + b.z1) / 2 - z) < 8)) continue; const a = 1.2 + r() * 2.6, h = 1 + r() * 3.4; add(N3.box(x, 0, z, a * 1.5, h, a * 1.4), ROCK, 'rock', { rx: a * .95, ry: h * .62, rz: a * .92 }); n2++; } }
        add(N3.box(-66, 0, 20, 12, 3.4, 8), [112, 118, 128], 'bunker'); add(N3.box(-76, 0, 14, 6, 2.8, 6), [120, 110, 100], 'bunker'); add(N3.box(-58, 0, 12, 1.6, 1.2, 9), WALL, 'low'); add(N3.box(-72, 0, 28, 9, 1.2, 1.4), WALL, 'low');
        for (const [x, z] of [[-60, 26], [-70, 24], [-64, 14], [-78, 22]]) add(N3.box(x, 0, z, 1.5, 1.15, 1.5), CRATE, 'crate');
        add(N3.box(70, 0, -14, 5, 11, 5), [118, 124, 136], 'tower'); add(N3.box(70, 11, -14, 9, .5, 9), [90, 96, 110], 'deck', { nocover: true }); add(N3.box(62, 0, -8, 10, 3, 7), [112, 118, 128], 'bunker'); add(N3.box(78, 0, -6, 1.6, 1.2, 10), WALL, 'low');
        // two ridges with ramps (high ground)
        for (const sx of [-1, 1]) { add(N3.box(sx * 44, 0, 6, 10, 5.5, 26), [128, 110, 90], 'ridge'); S.push({ x0: sx * 44 - 5, x1: sx * 44 + 5, z0: -18, z1: -7, y0: 0, y1: 5.5, ramp: { axis: 'z', h0: 0, h1: 5.5 }, col: [150, 130, 108], kind: 'ramp' }); }
        // outpost: perimeter walls with a south gate, bunker, crates, sniper tower
        const wy = 3.4; add(N3.box(0, 0, 58, 46, wy, 1.4), WALL, 'wall'); add(N3.box(-22.5, 0, 44, 1.4, wy, 28), WALL, 'wall'); add(N3.box(22.5, 0, 44, 1.4, wy, 28), WALL, 'wall'); add(N3.box(-13.5, 0, 30, 19, wy, 1.4), WALL, 'wall'); add(N3.box(13.5, 0, 30, 19, wy, 1.4), WALL, 'wall');
        add(N3.box(-12, 0, 50, 9, 3.6, 7), [112, 118, 128], 'bunker'); add(N3.box(2, 0, 48, 6, 2.6, 4), [112, 118, 128], 'bunker');
        const tower = add(N3.box(14, 0, 52, 4, 9, 4), [118, 124, 136], 'tower'); add(N3.box(14, 9, 52, 8, .5, 8), [90, 96, 110], 'deck', { nocover: true });
        for (const [x, z] of [[-8, 38], [-4, 36], [6, 38], [10, 42], [-16, 42], [16, 36], [-2, 44], [20, 46], [-18, 54], [8, 55]]) add(N3.box(x, 0, z, 1.5, 1.15, 1.5), CRATE, 'crate');
        // build helper structures
        const grid = N3.grid(S, 8), nav = N3.nav(S, -HALF, -HALF, HALF, HALF, 1.5, .6, .6);
        // cover nodes around anything tall enough to hide behind
        const nodes = [];
        for (const b of S) { if (b.ramp || b.nocover || b.kind === 'cliff' || b.y1 < .95) continue; const w = b.x1 - b.x0, d = b.z1 - b.z0, off = .95;
            const side = (nx, nz, cx, cz) => { if (Math.abs(cx) > HALF - 2 || Math.abs(cz) > HALF - 2) return; nodes.push({ x: cx, z: cz, nx, nz, h: b.y1, box: b, tx: -nz, tz: nx, len: nx ? d : w }); };
            const ns = Math.max(1, Math.round(d / 5)), ew = Math.max(1, Math.round(w / 5));
            for (let i = 0; i < ns; i++) { const z = b.z0 + d * (i + .5) / ns; side(-1, 0, b.x0 - off, z); side(1, 0, b.x1 + off, z); }
            for (let i = 0; i < ew; i++) { const x = b.x0 + w * (i + .5) / ew; side(0, -1, x, b.z0 - off); side(0, 1, x, b.z1 + off); } }
        const cover = nodes.filter(n => nav.free(n.x, n.z));
        // spawn / goal / waypoints
        return { S, grid, nav, cover, spawn: { x: 0, z: -58, yaw: 0 }, extract: { x: 44, z: 56 }, tower: { x: 14, z: 52, y: 9.5 }, jeep: { x: 7, z: -55, yaw: 0 } };
    };
    /* ---------------------------------------------------------------- enemy squads: [type, x, z, hidden?, squad] */
    WR.SQUADS = [
        { name: 'Crash site patrol', zone: 0, units: [['grunt', -2, -38], ['grunt', 3, -34], ['grunt', -8, -40], ['warden', 0, -30]], patrol: [[-10, -36], [8, -36], [8, -26], [-10, -26]] },
        { name: 'Hull ambush', zone: 0, units: [['grunt', -14, -23, 1], ['grunt', 6.5, -21, 1]], hide: true },
        { name: 'Boulder field A', zone: 1, units: [['warden', -24, -6, 1], ['grunt', -20, -2, 1], ['grunt', -28, 0, 1]], hide: true },
        { name: 'Boulder field B', zone: 1, units: [['warden', 22, -2, 1], ['grunt', 18, 4, 1], ['grunt', 26, 6, 1]], hide: true },
        { name: 'Ruins guard', zone: 1, units: [['grunt', 0, 6], ['grunt', -6, 12], ['grunt', 6, 10], ['warden', 0, 14]], patrol: [[-6, 10], [8, 10], [8, 16], [-6, 16]] },
        { name: 'Ridge marksmen', zone: 1, units: [['hawk', -44, 14, 1, 'ridge'], ['hawk', 44, 18, 1, 'ridge']], post: true },
        { name: 'Outpost garrison', zone: 2, units: [['warden', -10, 40], ['warden', 8, 40], ['grunt', -4, 46], ['grunt', 4, 46], ['grunt', -16, 48], ['grunt', 16, 44], ['warden', 0, 52]], patrol: [[-12, 40], [12, 40], [12, 50], [-12, 50]] },
        { name: 'Fuel depot', zone: 1, units: [['warden', -64, 18, 1], ['grunt', -70, 20, 1], ['grunt', -60, 22], ['grunt', -74, 16, 1]], hide: true },
        { name: 'Radio station', zone: 1, units: [['hawk', 70, -14, 1, 'radio'], ['grunt', 62, -4], ['grunt', 66, -2, 1], ['warden', 74, -8]], patrol: [[62, -4], [76, -4], [76, 0], [62, 0]] },
        { name: 'Tower', zone: 2, units: [['hawk', 14, 52, 1, 'tower']], post: true }
    ];
    WR.OBJECTIVES = [{ text: 'Secure the crash site', zone: 0 }, { text: 'Cross the valley - watch the cover', zone: 1 }, { text: 'Take the outpost', zone: 2 }, { text: 'Reach the extraction pad', zone: 3 }];

    A.warfare3d = (cfg, o) => {
        const C = Object.assign({}, DEF, cfg), r = rng(o.seed || 1), Wd = WR.world(), grid = Wd.grid, nav = Wd.nav, WEAP = WR.WEAPONS, ET = WR.ENEMIES, diff = C.difficulty || 1;
        const soldier = An.actor(An.STYLES.soldier, 99); soldier.noShadowHack = true;
        const p = { x: Wd.spawn.x, y: 0, z: Wd.spawn.z, yaw: 0, pitch: 0, r: .42, h: 1.8, vx: 0, vy: 0, vz: 0, groundFn: () => 0, bob: 0 };
        const s = { status: 'play', score: 0, t: 0, kills: 0, headshots: 0, lives: C.lives, health: C.health, shield: C.shield, shT: 0, hurtT: 0, dmgDir: [], flash: 0, hit: 0, p, en: [], bolts: [], gren: [], tracers: [], pick: [], msg: '', msgT: 0, obj: 0, zone: [0, 0, 0], zoneTotal: [0, 0, 0], cp: { x: p.x, z: p.z, yaw: 0 }, last: {}, wi: 0, grenades: [2, 0], world: Wd, log: [], noise: 0, zoom: 0, fireT: 0, rel: 0, melT: 0, deaths: 0, eid: 0 };
        s.tp = C.camera === 'third'; s.veh = 0; s.jeep = { x: Wd.jeep.x, z: Wd.jeep.z, yaw: Wd.jeep.yaw, v: 0, rot: 0 };
        s.weapons = [{ id: 'ar', mag: WEAPEAP('ar').mag, res: WEAP.ar.reserve }, { id: 'pistol', mag: WEAP.pistol.mag, res: WEAP.pistol.reserve }];
        function WEAPEAP(id) { return WEAP[id]; }
        const say = (m, t) => { s.msg = m; s.msgT = t || 150; s.log.push(m); };
        const edge = (k, n) => { const v = !!k[n], w = !!s.last[n]; s.last[n] = v; return v && !w; };
        const eyeY = e => e.y + (e.crouch ? .95 : 1.55) * e.scale;
        /* ---- spawn squads ---- */
        for (const q of WR.SQUADS) {
            const sq = { id: s.eid, q, alert: false, flankT: 0, alive: 0 };
            for (const u of q.units) {
                const T = ET[u[0]], e = { id: s.eid++, type: u[0], T, scale: T.scale, x: u[1], z: u[2], y: u[4] === 'tower' ? 9.5 : u[4] === 'radio' ? 11.5 : u[4] === 'ridge' ? 5.5 : 0, yaw: r() * 6.28, hp: T.hp * (diff >= 1.5 ? 1.2 : 1), sh: T.sh, maxsh: T.sh, shT: 0, st: u[3] ? 'hide' : (q.patrol ? 'patrol' : 'idle'), hidden: !!u[3], zone: q.zone, squad: sq, patrol: q.patrol, pi: 0, path: null, pk: 0, t: r() * 2, fireT: 60 + r() * 60, burst: 0, bT: 0, seen: null, seeT: 0, node: null, crouch: false, dead: 0, hurtT: 0, post: !!q.post, postY: u[4] === 'tower' ? 9.5 : u[4] === 'ridge' ? 5.5 : 0, flee: 0, lastDecide: 0, gren: u[0] === 'warden' ? 1 : 0, laser: 0, tgt: null, speed: 0, aware: 0 };
                e.actor = An.actor(An.STYLES[T.style], e.id + 3); e.actor.held = { kind: T.held }; e.actor.style.height = T.scale; e.actor.mood = 'onduty'; e.actor.ctx = 'onduty';
                e.optional = !!q.post; s.en.push(e); sq.alive++; if (!e.optional) s.zoneTotal[q.zone]++;
            }
        }
        s.zoneLeft = s.zoneTotal.slice();
        /* ---- helpers ---- */
        const solidsNear = (x, z, rad) => grid.near(x, z, rad);
        const hasLOS = (x0, y0, z0, x1, y1, z1) => !grid.blocked(x0, y0, z0, x1, y1, z1, .6);
        const dmgPlayer = (n, fx, fz, kind) => {
            if (s.status !== 'play') return; n *= diff * (kind === 'melee' ? 1 : 1); s.hurtT = 40; s.shT = 270; s.flash = 10;
            const a = Math.atan2(fx - p.x, fz - p.z); s.dmgDir.push({ a, t: 50 });
            if (s.shield > 0) { const ab = Math.min(s.shield, n); s.shield -= ab; n -= ab; } if (n > 0) s.health -= n;
            if (s.health <= 0) { s.deaths++; s.lives--; if (s.lives < 0) { s.status = 'lose'; say('MISSION FAILED', 300); } else { say('KILLED IN ACTION - checkpoint', 200); p.x = s.cp.x; p.z = s.cp.z; p.yaw = s.cp.yaw; p.y = 0; s.health = C.health; s.shield = C.shield; s.shT = 0; for (const e of s.en) if (!e.dead && e.st !== 'hide') { e.seen = null; if (e.st !== 'patrol') e.st = 'search'; } s.bolts = []; s.gren = []; s.weapons.forEach(w => { w.mag = WEAP[w.id].mag; }); } }
        };
        const killEnemy = (e, how, head) => {
            e.dead = 1; e.dt = 0; s.kills++; s.score += e.T.score * (head ? 1.5 : 1); if (head) s.headshots++; e.squad.alive--; if (!e.optional) s.zoneLeft[e.zone]--; e.actor.layers = []; e.actor.play('die', { replace: true }); e.actor.aim = false;
            for (const m of e.squad.q.units ? s.en.filter(z => z.squad === e.squad && !z.dead) : []) { m.aware = 1; if (m.T.panic && e.T.name === 'Warden') m.flee = 300; }
            if (e.type === 'warden' && r() < .6) s.pick.push({ k: 'weapon', id: 'shotgun', x: e.x, z: e.z, y: e.y }); else if (e.type === 'hawk') s.pick.push({ k: 'weapon', id: 'sniper', x: e.x, z: e.z, y: e.y }); else if (r() < .65) s.pick.push({ k: 'ammo', x: e.x, z: e.z, y: e.y });
            if (r() < .18) s.pick.push({ k: 'health', x: e.x + .4, z: e.z, y: e.y });
        };
        const hitEnemy = (e, dmg, head, how) => {
            if (e.dead) return; const T = e.T; dmg *= (217 + r() * 38) / 255; if (head) dmg *= 2; e.hurtT = 20; s.hit = 8;
            e.aware = 1; if (e.st === 'hide' || e.st === 'idle' || e.st === 'patrol') { e.st = 'combat'; e.hidden = false; } alertSquad(e, p.x, p.z);
            if (e.sh > 0) { const ab = Math.min(e.sh, dmg); e.sh -= ab; dmg -= ab; e.shT = 300; if (e.sh <= 0 && dmg <= 0) dmg = 0; if (e.sh <= 0 && e.type === 'warden') e.shBroke = 1; } if (dmg > 0) e.hp -= dmg;
            if (e.hp <= 0) killEnemy(e, how, head); else { if (!e.actor.busy()) e.actor.play('hurt', { replace: true, mask: 'upper' }); }
        };
        const alertSquad = (e, x, z) => { for (const m of s.en) if (!m.dead && m.squad === e.squad) { m.aware = 1; m.seen = m.seen || { x, z, t: s.t }; if (m.st === 'hide' || m.st === 'idle' || m.st === 'patrol' || m.st === 'search') { m.st = 'combat'; m.hidden = false; m.lastDecide = 0; } } };
        /* ---- weapons ---- */
        const curW = () => s.weapons[s.wi], dirOf = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
        const fire = () => {
            const w = curW(), D = WEAP[w.id]; if (s.rel > 0 || s.fireT > 0 || s.melT > 0) return; if (w.mag <= 0) { reload(); return; }
            w.mag--; s.fireT = D.rate; s.noise = 60; soldier.play('fire_recoil', { mask: 'upper', replace: true }); s.recoil = 6; s.flashT = 3;
            const ex = p.x, ey = p.y + 1.6, ez = p.z;
            for (let i = 0; i < D.pellets; i++) {
                const sp = D.spread * (s.zoom > .5 ? .45 : 1) * (Math.hypot(p.vx, p.vz) > 2 ? 1.6 : 1), yaw = p.yaw + (r() - .5) * sp * 2, pit = p.pitch + (r() - .5) * sp * 2, d = dirOf(yaw, pit);
                let hitE = null, head = false, endT = 90; for (let t = .6; t < 90; t += .5) { const x = ex + d[0] * t, y = ey + d[1] * t, z = ez + d[2] * t; if (y < 0) { endT = t; break; } let blocked = false; for (const b of grid.near(x, z, 1)) if (!b.ghost && !b.ramp && x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && z > b.z0 && z < b.z1) { blocked = true; break; } if (blocked) { endT = t; break; }
                    for (const e of s.en) { if (e.dead) continue; const dx = x - e.x, dz = z - e.z, rr = .42 * e.scale; if (dx * dx + dz * dz < rr * rr && y > e.y && y < e.y + 1.95 * e.scale) { hitE = e; head = y > e.y + (e.crouch ? 1.15 : 1.58) * e.scale; endT = t; break; } } if (hitE) break; }
                if (hitE) hitEnemy(hitE, D.dmg, head, 'bullet'); if (i < 3) s.tracers.push({ x0: ex + d[0] * 1.2 + Math.cos(p.yaw) * .25, y0: ey - .25, z0: ez + d[2] * 1.2 - Math.sin(p.yaw) * .25, x1: ex + d[0] * endT, y1: ey + d[1] * endT, z1: ez + d[2] * endT, t: 4 });
            }
            for (const e of s.en) if (!e.dead && e.st === 'hide' && Math.hypot(e.x - p.x, e.z - p.z) < 24) { e.aware = 1; if (r() < .35) alertSquad(e, p.x, p.z); }
            if (w.mag <= 0 && w.res > 0) { s.autoRel = 12; }
        };
        const reload = () => { const w = curW(), D = WEAP[w.id]; if (s.rel > 0 || w.res <= 0 || w.mag >= D.mag) return; s.rel = D.reload; soldier.play('reload', { mask: 'upper', replace: true }); s.reloadW = w; };
        const melee = () => { if (s.melT > 0 || s.rel > 0) return; s.melT = 28; soldier.play('melee_butt', { mask: 'upper', replace: true }); const d = dirOf(p.yaw, 0); for (const e of s.en) { if (e.dead) continue; const dx = e.x - p.x, dz = e.z - p.z, L = Math.hypot(dx, dz); if (L < 2.4 && (dx * d[0] + dz * d[2]) / (L || 1) > .45) { const back = Math.atan2(p.x - e.x, p.z - e.z), behind = Math.abs(angDiff(back, e.yaw)) > 2.2; hitEnemy(e, behind ? 999 : 55, behind, 'melee'); } } };
        const throwGren = () => { if (s.gT > 0 || s.grenades[0] <= 0) return; s.grenades[0]--; s.gT = 50; soldier.play('throw_grenade', { mask: 'upper', replace: true }); const d = dirOf(p.yaw, p.pitch + .22); s.gren.push({ x: p.x, y: p.y + 1.5, z: p.z, vx: d[0] * 15 + p.vx, vy: d[1] * 15 + 2.5, vz: d[2] * 15 + p.vz, t: 120, own: 'p' }); };
        const explode = (g) => { s.shake = 14; s.booms = (s.booms || []); s.booms.push({ x: g.x, y: g.y, z: g.z, t: 14 }); const R2 = 5.5; for (const e of s.en) { if (e.dead) continue; const d = Math.hypot(e.x - g.x, e.z - g.z); if (d < R2 && hasLOS(g.x, g.y + .3, g.z, e.x, e.y + 1, e.z)) hitEnemy(e, 90 * (1 - d / R2) + 15, false, 'grenade'); } const d = Math.hypot(p.x - g.x, p.z - g.z); if (d < R2 && hasLOS(g.x, g.y + .3, g.z, p.x, p.y + 1, p.z)) dmgPlayer(70 * (1 - d / R2) + 10, g.x, g.z); };
        /* ---- enemy brain: score table, lowest wins (Pokemon trainer-AI scheme from the catalog) ---- */
        const TACTICS = ['attack', 'peek', 'cover', 'flank', 'advance', 'retreat', 'melee', 'grenade', 'hold'];
        const scoreTactics = (e, ctx) => {
            const sc = {}; for (const t of TACTICS) sc[t] = 10; const T = e.T, shp = e.maxsh ? e.sh / e.maxsh : 1, d = ctx.d, los = ctx.los, inCover = ctx.inCover, hp = e.hp / T.hp;
            // attack: stand and shoot
            if (los && d < 26) sc.attack -= 3; if (!los) sc.attack += 5; if (shp < .25 && e.maxsh) sc.attack += 4; if (T.sniper) sc.attack -= 4; if (inCover && !los) sc.attack += 2;
            // cover
            if (!inCover && (shp < .5 || e.hurtT > 0 || ctx.exposed)) sc.cover -= 4; if (inCover) sc.cover += 8; if (T.sniper) sc.cover += 6;
            // peek (leave cover for a burst)
            if (inCover && ctx.peekReady && shp > .25) sc.peek -= 5; if (!inCover) sc.peek += 10;
            // flank
            if (ctx.mates >= 1 && !ctx.someoneFlanking && d > 12 && !T.sniper) sc.flank -= 3; if (e.squad.flankT > s.t - 8) sc.flank += 6; if (T.panic) sc.flank += 2; if (T.sniper) sc.flank += 20;
            // advance
            if (d > 30) sc.advance -= 3; if (d < 16) sc.advance += 6; if (T.panic) sc.advance += 2; if (T.sniper) sc.advance += 20;
            // retreat
            if (e.maxsh && shp < .12 && hp < .5) sc.retreat -= 5; if (T.panic && ctx.mates === 0) sc.retreat -= 5; if (e.flee > 0) sc.retreat -= 12; if (T.sniper) sc.retreat += 20;
            // melee rush
            if (d < 3 && T.charge) sc.melee -= 8; if (T.charge && s.rel > 0 && d < 9) sc.melee -= 4; if (!T.charge) sc.melee += 6; if (d > 12) sc.melee += 6;
            // grenade
            if (e.gren > 0 && !los && ctx.covered > 2.5 && d < 26) sc.grenade -= 5; else sc.grenade += 8;
            // hold
            sc.hold += 1; if (T.sniper) sc.hold -= 6; if (!los && ctx.lost > 6) sc.hold += 4;
            let best = 99, bag = []; for (const t of TACTICS) { if (sc[t] < best) { best = sc[t]; bag = [t]; } else if (sc[t] === best) bag.push(t); }
            return bag[Math.floor(r() * bag.length)];
        };
        const coverFor = (e, px, pz, wantFlank) => {
            let best = null, bs = 1e9; const near = Wd.cover; const T = e.T;
            for (const n of near) { const de = Math.hypot(n.x - e.x, n.z - e.z); if (de > 26 || de < .8) continue; const dp = Math.hypot(n.x - px, n.z - pz); if (dp < 7 || dp > 48) continue; if (n.taken && n.taken !== e.id && n.takenT > s.t) continue;
                const tpx = px - n.x, tpz = pz - n.z, L = Math.hypot(tpx, tpz) || 1, facing = (tpx * n.nx + tpz * n.nz) / L; if (facing > -.25) continue; // box must be between node and player
                const covered = grid.blocked(n.x, .9, n.z, px, 1.5, pz, .6); if (!covered) continue;
                let sc = de + (T.panic ? 0 : dp * .15); if (wantFlank) { const a0 = Math.atan2(px - e.x, pz - e.z), a1 = Math.atan2(px - n.x, pz - n.z); const ad = Math.abs(angDiff(a0, a1)); if (ad < .8) continue; sc -= ad * 8; }
                if (n.h < 1.5) sc -= 3; if (sc < bs) { bs = sc; best = n; } }
            return best;
        };
        const peekSpot = (n, px, pz, e) => { // a point beside / above the cover from where the player can be seen
            const h = n.h; if (h < 1.5) return { x: n.x, z: n.z, stand: true }; for (const sg of [1, -1]) { const x = n.x + n.tx * sg * (n.len / 2 + 1.1), z = n.z + n.tz * sg * (n.len / 2 + 1.1); if (nav.free(x, z) && !grid.blocked(x, 1.55, z, px, 1.5, pz, .6)) return { x, z, stand: true }; } return null;
        };
        const goPath = (e, x, z, spd) => { if (!e.path || e.pathGoal == null || Math.hypot(e.pathGoal[0] - x, e.pathGoal[1] - z) > 2 || s.t - (e.pathT || 0) > 2.5) { e.path = nav.path(e.x, e.z, x, z, 3500) || [[x, z]]; e.pathGoal = [x, z]; e.pathT = s.t; e.pk = 0; } };
        const stepPath = (e, spd, dt) => {
            if (!e.path || e.pk >= e.path.length) { e.speed = 0; return true; } const [tx, tz] = e.path[e.pk], dx = tx - e.x, dz = tz - e.z, L = Math.hypot(dx, dz);
            if (L < .5) { e.pk++; return e.pk >= e.path.length; } const vx = dx / L * spd, vz = dz / L * spd; moveE(e, vx * dt, vz * dt); e.speed = spd; e.yaw += clamp(angDiff(e.yaw, Math.atan2(dx, dz)), -9 * dt, 9 * dt); return false;
        };
        const moveE = (e, dx, dz) => { const nx = e.x + dx, nz = e.z + dz; let bx = false, bz = false; for (const b of solidsNear(nx, nz, 2)) { if (b.ghost || b.ramp || b.y1 <= e.y + .6 || b.y0 > e.y + 1.5) continue; if (nx > b.x0 - .42 && nx < b.x1 + .42 && e.z > b.z0 - .42 && e.z < b.z1 + .42) bx = true; if (e.x > b.x0 - .42 && e.x < b.x1 + .42 && nz > b.z0 - .42 && nz < b.z1 + .42) bz = true; } if (!bx) e.x = nx; if (!bz) e.z = nz; e.x = clamp(e.x, -HALF + 1, HALF - 1); e.z = clamp(e.z, -HALF + 1, HALF - 1); };
        const shootAt = (e, dt) => {
            const T = e.T; e.fireT--; if (T.sniper) { if (e.laser > 0) { e.laser--; if (e.laser === 0) { const hasL = hasLOS(e.x, eyeY(e), e.z, p.x, p.y + 1.4, p.z); if (hasL && Math.hypot(p.vx, p.vz) < 9 && r() > .12) dmgPlayer(T.dmg, e.x, e.z); s.tracers.push({ x0: e.x, y0: eyeY(e) - .2, z0: e.z, x1: p.x, y1: p.y + 1.3, z1: p.z, t: 5, red: 1 }); e.fireT = T.cd; } } else if (e.fireT <= 0) { e.laser = 55; e.aimAt = [p.x, p.z]; } return; }
            if (e.burst > 0) { e.bT--; if (e.bT <= 0) { e.bT = 5; e.burst--; const mx = e.x + Math.sin(e.yaw) * .5, my = eyeY(e) - .25 * e.scale, mz = e.z + Math.cos(e.yaw) * .5, tx = p.x, ty = p.y + 1.2, tz = p.z, dx = tx - mx, dy = ty - my, dz = tz - mz, L = Math.hypot(dx, dy, dz) || 1, sp = T.acc * (1 + L / 40) * (Math.hypot(p.vx, p.vz) > 3 ? 1.3 : 1); s.bolts.push({ x: mx, y: my, z: mz, vx: dx / L * T.bspd + (r() - .5) * sp * T.bspd, vy: dy / L * T.bspd + (r() - .5) * sp * T.bspd, vz: dz / L * T.bspd + (r() - .5) * sp * T.bspd, dmg: T.dmg, t: 160, own: e.id, col: e.type === 'warden' ? [90, 170, 255] : [120, 255, 120] }); e.actor.play('fire_recoil', { mask: 'upper', replace: true }); } }
            else if (e.fireT <= 0) { e.burst = T.burst; e.bT = 8; e.fireT = T.cd * (.8 + r() * .5); }
        };
        const brain = (e, dt) => {
            const T = e.T; if (e.dead) { e.dt += dt; return; }
            e.hurtT = Math.max(0, e.hurtT - 1); if (e.maxsh && e.sh < e.maxsh) { e.shT -= 1; if (e.shT <= 0) e.sh = Math.min(e.maxsh, e.sh + 28 * dt); }
            const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
            /* perception every ~0.2 s */
            e.seeT -= dt; if (e.seeT <= 0) { e.seeT = .2 + r() * .08; const fov = Math.abs(angDiff(e.yaw, toP)) < 1.25 || e.aware, range = e.st === 'hide' ? 14 : 55; e.los = d < range && (fov || d < 5) && hasLOS(e.x, eyeY(e), e.z, p.x, p.y + 1.45, p.z); if (!e.los && d < 28 && s.noise > 0 && e.aware) e.heard = true;
                if (e.los && s.status === 'play') { e.seen = { x: p.x, z: p.z, t: s.t }; e.lost = 0; if (e.st === 'hide' || e.st === 'idle' || e.st === 'patrol' || e.st === 'search') { e.st = 'combat'; e.hidden = false; e.lastDecide = 0; alertSquad(e, p.x, p.z); } } else if (e.st === 'combat') e.lost = (e.lost || 0) + .2; }
            if (e.st === 'hide') { // ambusher crouched behind cover until the player is close or shoots
                e.crouch = true; e.actor.crouch = 1; if (d < 15 || e.aware) { e.st = 'combat'; e.hidden = false; e.lastDecide = 0; alertSquad(e, p.x, p.z); } e.speed = 0; return; }
            if (e.st === 'patrol') { e.crouch = false; if (!e.path || e.pk >= e.path.length) { e.pi = (e.pi + 1) % e.patrol.length; e.path = nav.path(e.x, e.z, e.patrol[e.pi][0], e.patrol[e.pi][1]) || [e.patrol[e.pi]]; e.pk = 0; e.pathGoal = e.patrol[e.pi]; } stepPath(e, 1.7, dt); return; }
            if (e.st === 'idle') { e.speed = 0; if (e.post) { e.yaw += clamp(angDiff(e.yaw, toP), -.5 * dt, .5 * dt) * 0; } return; }
            if (e.st === 'search') { e.crouch = false; const g = e.seen || { x: p.x, z: p.z }; goPath(e, g.x, g.z); const done = stepPath(e, T.spd * .75, dt); e.t -= dt; if (done || (e.t -= dt) < -9) { e.st = e.patrol ? 'patrol' : 'combat'; e.t = 0; } if (e.los) e.st = 'combat'; return; }
            /* combat */
            if (e.flee > 0) { e.flee -= 1; const away = Math.atan2(-dx, -dz); moveE(e, Math.sin(away) * T.spd * 1.25 * dt, Math.cos(away) * T.spd * 1.25 * dt); e.speed = T.spd * 1.25; e.yaw = away; e.crouch = false; e.fleeing = true; return; } e.fleeing = false;
            if (T.sniper) { e.crouch = false; e.speed = 0; if (e.laser > 0) e.yaw += clamp(angDiff(e.yaw, Math.atan2(e.aimAt[0] - e.x, e.aimAt[1] - e.z)), -3 * dt, 3 * dt); else e.yaw += clamp(angDiff(e.yaw, toP), -2 * dt, 2 * dt); if (e.los) shootAt(e, dt); else if ((e.lost || 0) > 8) e.st = 'idle'; return; }
            const mates = s.en.filter(m => !m.dead && m !== e && m.squad === e.squad).length, someoneFlanking = s.en.some(m => !m.dead && m !== e && m.squad === e.squad && m.tac === 'flank');
            e.lastDecide -= dt; const inCover = e.node && Math.hypot(e.node.x - e.x, e.node.z - e.z) < 1.1;
            if (e.lastDecide <= 0) { e.lastDecide = .5 + r() * .5; const ctx = { d, los: e.los, inCover: !!inCover, exposed: e.los && d < 40 && (e.aware), peekReady: (e.peekT || 0) <= s.t, mates, someoneFlanking, covered: e.hiddenT || 0, lost: e.lost || 0 }; const t = scoreTactics(e, ctx); if (t !== e.tac) { e.tac = t; e.path = null; e.tacT = s.t; }
                if (t === 'cover') { const n = coverFor(e, p.x, p.z, false); if (n) { e.node = n; n.taken = e.id; n.takenT = s.t + 8; goPath(e, n.x, n.z); } else e.tac = 'attack'; }
                else if (t === 'flank') { const n = coverFor(e, p.x, p.z, true); if (n) { e.node = n; n.taken = e.id; n.takenT = s.t + 10; e.squad.flankT = s.t; goPath(e, n.x, n.z); } else e.tac = 'advance'; }
                else if (t === 'peek') { const n = e.node; if (n) { const sp = peekSpot(n, p.x, p.z, e); if (sp) { e.peekAt = sp; e.peekEnd = s.t + 1.2 + r() * 1.2; e.crouch = false; } else e.tac = 'attack'; } else e.tac = 'attack'; }
                else if (t === 'retreat') { const n = coverFor(e, p.x, p.z, false); if (n) { e.node = n; goPath(e, n.x, n.z); } else { e.flee = 150; } }
                else if (t === 'grenade') { if (e.gren > 0 && e.seen) { e.gren--; const gx = e.seen.x, gz = e.seen.z, dd = Math.hypot(gx - e.x, gz - e.z) || 1, v = clamp(dd * .9 + 4, 8, 20); s.gren.push({ x: e.x, y: eyeY(e), z: e.z, vx: (gx - e.x) / dd * v, vy: 6 + dd * .12, vz: (gz - e.z) / dd * v, t: 100, own: e.id }); e.actor.play('throw_grenade', { mask: 'upper', replace: true }); } }
                else if (t === 'advance') { goPath(e, p.x - dx / (d || 1) * 10, p.z - dz / (d || 1) * 10); }
            }
            e.hiddenT = e.los ? 0 : (e.hiddenT || 0) + dt; const tac = e.tac;
            if (tac === 'cover' || tac === 'flank' || tac === 'retreat') { const done = stepPath(e, T.spd, dt); e.crouch = done && e.node && e.node.h < 1.6 && !e.los; if (done) { e.tac = 'hold'; e.peekT = s.t + 1.5 + r() * 2.5; e.lastDecide = .3; } }
            else if (tac === 'advance') { e.crouch = false; const done = stepPath(e, T.spd, dt); if (done || d < 14) e.lastDecide = Math.min(e.lastDecide, .2); }
            else if (tac === 'peek' && e.peekAt) { e.crouch = false; const dxp = e.peekAt.x - e.x, dzp = e.peekAt.z - e.z, L = Math.hypot(dxp, dzp); if (L > .4) { moveE(e, dxp / L * T.spd * dt, dzp / L * T.spd * dt); e.speed = T.spd; } else e.speed = 0; e.yaw += clamp(angDiff(e.yaw, toP), -7 * dt, 7 * dt); if (e.los) shootAt(e, dt); if (s.t > e.peekEnd) { e.tac = 'hold'; e.peekT = s.t + 2 + r() * 3; e.peekAt = null; e.lastDecide = .1; if (e.node) { e.path = [[e.node.x, e.node.z]]; e.pk = 0; e.tac = 'cover'; } } }
            else if (tac === 'melee') { e.crouch = false; const sp = T.spd * 1.5; moveE(e, dx / (d || 1) * sp * dt, dz / (d || 1) * sp * dt); e.speed = sp; e.yaw = toP; if (d < 1.7 && (e.meleeT || 0) <= s.t) { e.meleeT = s.t + 1.1; e.actor.play('melee_butt', { mask: 'upper', replace: true }); dmgPlayer(26, e.x, e.z, 'melee'); } }
            else if (tac === 'attack') { e.crouch = false; e.speed = 0; e.yaw += clamp(angDiff(e.yaw, toP), -7 * dt, 7 * dt); if (e.los) { shootAt(e, dt); const sg = Math.sin(s.t * 1.7 + e.id) * T.spd * .5; moveE(e, Math.cos(e.yaw) * sg * dt, -Math.sin(e.yaw) * sg * dt); e.speed = Math.abs(sg); } }
            else { /* hold in cover */ e.speed = 0; e.yaw += clamp(angDiff(e.yaw, e.seen ? Math.atan2(e.seen.x - e.x, e.seen.z - e.z) : toP), -4 * dt, 4 * dt); if (e.los && !e.crouch) shootAt(e, dt); if ((e.lost || 0) > 7 && !e.los) { e.st = 'search'; e.t = 0; } }
        };
        /* ---- player step ---- */
        s.step = k => {
            const dt = 1 / 60; if (s.status !== 'play') return; s.t += dt;
            const L = !!k.ArrowLeft, Rr = !!k.ArrowRight, U = !!k.ArrowUp, D = !!k.ArrowDown, c = !!k.c;
            if (edge(k, 'v') || edge(k, 'Select')) { s.tp = !s.tp; say(s.tp ? 'THIRD PERSON' : 'FIRST PERSON', 50); }
            if (edge(k, 'e') || edge(k, 'q')) { const J = s.jeep; if (s.veh) { s.veh = 0; p.x = J.x + Math.cos(J.yaw) * 2.4; p.z = J.z - Math.sin(J.yaw) * 2.4; if (!nav.free(p.x, p.z)) { p.x = J.x - Math.cos(J.yaw) * 2.4; p.z = J.z + Math.sin(J.yaw) * 2.4; } say('OUT OF JEEP', 50); } else if (Math.hypot(J.x - p.x, J.z - p.z) < 4.2) { s.veh = 1; s.tp = true; say('JEEP  E=exit  Z=fire', 100); } }
            if (edge(k, 'x') && !s.veh) { let near = false; for (const e of s.en) if (!e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 2.3) near = true; if (near) melee(); else reload(); }
            const swap = L && Rr && !s.veh, gren = U && D && !s.veh; if (swap && !s.swapHeld) { s.swapHeld = true; s.wi = (s.wi + 1) % s.weapons.length; s.rel = 0; s.fireT = 20; say(WEAP[curW().id].name, 60); } if (!swap) s.swapHeld = false; if (gren && !s.grenHeld) { s.grenHeld = true; throwGren(); } if (!gren) s.grenHeld = false;
            const dl = !swap && !gren; let fwd = 0, str = 0, turn = 0, look = 0;
            if (dl) { if (c) { str = (Rr ? 1 : 0) - (L ? 1 : 0); look = (U ? 1 : 0) - (D ? 1 : 0); } else { fwd = (U ? 1 : 0) - (D ? 1 : 0); turn = (Rr ? 1 : 0) - (L ? 1 : 0); } }
            if (s.zoom > .5) turn *= .4; p.yaw += turn * 2.3 * dt; p.pitch = clamp(p.pitch + look * 1.4 * dt, -.5, .5);
            const sp = 5.4 * (fwd < 0 ? .7 : 1), fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = fz, rz = -fx; let wx = (fx * fwd + rx * str) , wz = (fz * fwd + rz * str); const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
            const tvx = wx * sp, tvz = wz * sp; p.vx += (tvx - p.vx) * Math.min(1, 14 * dt); p.vz += (tvz - p.vz) * Math.min(1, 14 * dt);
            const body = p, ox = p.x, oz = p.z; body.vy = 0; const keepX = p.vx * dt, keepZ = p.vz * dt, near = grid.near(p.x, p.z, 4); const sv = { vx: p.vx, vz: p.vz }; body.vx = keepX; body.vz = keepZ; N3.collide(near, body, .6); p.vx = sv.vx; p.vz = sv.vz; p.x = clamp(p.x, -HALF + .6, HALF - .6); p.z = clamp(p.z, -HALF + .6, HALF - .6); p.bob += Math.hypot(p.vx, p.vz) * dt * 1.8;
            if (s.veh) { const J = s.jeep, acc = U ? 1 : D ? -.7 : 0; J.v += acc * 15 * dt; J.v *= 1 - (acc ? .5 : 1.6) * dt; J.v = clamp(J.v, -6, 17); J.yaw += ((Rr ? 1 : 0) - (L ? 1 : 0)) * 1.8 * dt * clamp(J.v / 5, -1, 1);
                const nx = J.x + Math.sin(J.yaw) * J.v * dt, nz = J.z + Math.cos(J.yaw) * J.v * dt; let hit = Math.abs(nx) > HALF - 2 || Math.abs(nz) > HALF - 2; if (!hit) for (const b of grid.near(nx, nz, 3)) if (!b.ghost && !b.ramp && b.y0 < 1 && b.y1 > .3 && nx > b.x0 - 1.1 && nx < b.x1 + 1.1 && nz > b.z0 - 1.1 && nz < b.z1 + 1.1) { hit = true; break; }
                if (hit) { if (Math.abs(J.v) > 6) { s.shake = 8; dmgPlayer(Math.abs(J.v) * .5, J.x, J.z, 'crash'); } J.v *= -.3; } else { J.x = nx; J.z = nz; }
                for (const e of s.en) if (!e.dead && e.y < 1 && Math.hypot(e.x - J.x, e.z - J.z) < 1.9 && Math.abs(J.v) > 4) { hitEnemy(e, 60 + Math.abs(J.v) * 5, false, 'vehicle'); J.v *= .85; s.shake = 6; }
                J.rot += J.v * dt * 1.6; p.x = J.x; p.z = J.z; p.yaw = J.yaw; p.vx = p.vz = 0; p.y = 0; }
            // aim assist (vertical): ease pitch toward the nearest enemy near the crosshair
            if (!look) { let bestE = null, bd = 1e9; for (const e of s.en) { if (e.dead || e.st === 'hide') continue; const dx = e.x - p.x, dz = e.z - p.z, a = Math.abs(angDiff(p.yaw, Math.atan2(dx, dz))); if (a < .09 && Math.hypot(dx, dz) < 70) { const d = Math.hypot(dx, dz); if (d < bd && hasLOS(p.x, p.y + 1.6, p.z, e.x, e.y + 1.2, e.z)) { bd = d; bestE = e; } } } if (bestE) { const tp = Math.atan2(bestE.y + 1.4 * bestE.scale - (p.y + 1.6), bd); p.pitch += (tp - p.pitch) * .25; } else p.pitch *= .985; }
            // weapons
            s.fireT = Math.max(0, s.fireT - 1); s.melT = Math.max(0, s.melT - 1); s.gT = Math.max(0, (s.gT || 0) - 1); s.noise = Math.max(0, s.noise - 1); s.recoil = Math.max(0, (s.recoil || 0) - 1); s.flashT = Math.max(0, (s.flashT || 0) - 1);
            const w = curW(), WD = WEAP[w.id]; s.zoom += ((WD.zoom > 1 && c && !L && !Rr ? 1 : 0) - s.zoom) * .25;
            if (s.rel > 0) { s.rel--; if (s.rel === 0) { const need = WD.mag - s.reloadW.mag, take = Math.min(need, s.reloadW.res); s.reloadW.mag += take; s.reloadW.res -= take; } }
            if (s.autoRel > 0) { s.autoRel--; if (s.autoRel === 0) reload(); }
            if (k.z) { if (WD.auto || !s.zHeld) fire(); s.zHeld = true; } else s.zHeld = false;
            // shield / health
            s.hurtT = Math.max(0, s.hurtT - 1); s.flash = Math.max(0, s.flash - 1); s.hit = Math.max(0, s.hit - 1); if (s.shT > 0) s.shT--; else if (s.shield < C.shield) s.shield = Math.min(C.shield, s.shield + 40 * dt);
            s.dmgDir = s.dmgDir.filter(x => --x.t > 0); s.msgT = Math.max(0, s.msgT - 1); s.shake = Math.max(0, (s.shake || 0) - 1);
            // projectiles
            for (const b of s.bolts) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.t--; if (b.y < 0) b.t = 0; for (const bx of grid.near(b.x, b.z, 1)) if (!bx.ghost && !bx.ramp && b.x > bx.x0 && b.x < bx.x1 && b.y > bx.y0 && b.y < bx.y1 && b.z > bx.z0 && b.z < bx.z1) b.t = 0; if (b.t > 0 && Math.hypot(b.x - p.x, b.z - p.z) < .6 && b.y > p.y && b.y < p.y + 1.85) { dmgPlayer(b.dmg, b.x - b.vx, b.z - b.vz); b.t = 0; } }
            s.bolts = s.bolts.filter(b => b.t > 0);
            for (const g of s.gren) { g.vy -= 18 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt; g.t--; for (const bx of grid.near(g.x, g.z, 1)) if (!bx.ghost && !bx.ramp && g.x > bx.x0 && g.x < bx.x1 && g.y > bx.y0 && g.y < bx.y1 && g.z > bx.z0 && g.z < bx.z1) { g.x -= g.vx * dt; g.z -= g.vz * dt; g.vx *= -.3; g.vz *= -.3; } if (g.y < .15) { g.y = .15; g.vy = Math.abs(g.vy) * .35; g.vx *= .7; g.vz *= .7; } if (g.t <= 0) { explode(g); g.dead = 1; } }
            s.gren = s.gren.filter(g => !g.dead); if (s.booms) s.booms = s.booms.filter(b => --b.t > 0);
            s.tracers = s.tracers.filter(t => --t.t > 0);
            // enemies
            for (const e of s.en) brain(e, dt);
            // pickups
            for (const pk of s.pick) { if (pk.got || Math.hypot(pk.x - p.x, pk.z - p.z) > 1.4) continue; if (pk.k === 'ammo') { for (const wq of s.weapons) wq.res += Math.ceil(WEAP[wq.id].mag * 1.6); s.grenades[0] = Math.min(4, s.grenades[0] + 1); say('Ammo', 60); pk.got = 1; } else if (pk.k === 'health') { if (s.health < C.health) { s.health = Math.min(C.health, s.health + 40); say('Health pack', 60); pk.got = 1; } } else if (pk.k === 'weapon') { const have = s.weapons.find(q => q.id === pk.id); if (have) { have.res += WEAP[pk.id].mag * 2; pk.got = 1; say('Ammo: ' + WEAP[pk.id].name, 60); } else { if (s.weapons.length < 2) s.weapons.push({ id: pk.id, mag: WEAP[pk.id].mag, res: WEAP[pk.id].reserve }); else { s.pick.push({ k: 'weapon', id: curW().id, x: p.x + 1.6, z: p.z, y: 0, drop: 1, got: 0, ignore: 120 }); s.weapons[s.wi] = { id: pk.id, mag: WEAP[pk.id].mag, res: WEAP[pk.id].reserve }; } pk.got = 1; say('Picked up ' + WEAP[pk.id].name, 90); } } }
            s.pick = s.pick.filter(q => !q.got);
            // zones / objectives / checkpoints
            const ob = WR.OBJECTIVES[s.obj];
            if (ob && ob.zone < 3 && s.zoneLeft[ob.zone] <= 0) { s.obj++; s.score += 500; const nx = WR.OBJECTIVES[s.obj]; s.cp = { x: p.x, z: p.z, yaw: p.yaw }; s.pick.push({ k: 'health', x: p.x + 1.5, z: p.z, y: 0 }, { k: 'ammo', x: p.x - 1.5, z: p.z, y: 0 }, { k: 'ammo', x: p.x - 1.5, z: p.z + 1.5, y: 0 }, { k: 'ammo', x: p.x - 3, z: p.z, y: 0 }); say('Checkpoint - ' + nx.text, 200); }
            if (ob && ob.zone === 3 && Math.hypot(p.x - Wd.extract.x, p.z - Wd.extract.z) < 5) { s.status = 'win'; s.score += 1000; }
            // animation / camera
            soldier.x = p.x; soldier.y = p.y + (s.veh ? .3 : 0); soldier.crouch = s.veh ? 1 : 0; soldier.z = p.z; soldier.yaw = p.yaw; soldier.held = { kind: WD.held }; soldier.update(dt, { speed: Math.hypot(p.vx, p.vz), grounded: true, yaw: p.yaw });
            for (const e of s.en) { const a = e.actor; a.x = e.x; a.y = e.y; a.z = e.z; a.yaw = e.yaw; a.crouch = e.crouch ? 1 : 0; a.aim = !e.dead && (e.burst > 0 || e.laser > 0 || e.tac === 'peek' || e.tac === 'attack') && !e.fleeing; a.mood = e.st === 'combat' ? 'angry' : 'onduty'; a.ctx = e.st === 'combat' ? 'impatient' : (e.st === 'search' ? 'scared' : 'onduty'); a.look = e.st === 'idle' || e.st === 'patrol' ? null : { x: p.x, y: 1.5, z: p.z }; if (e.dead) { a.noIdle = true; a.update(dt, { speed: 0, grounded: true }); } else { if (e.fleeing && !a.playing('hands_up')) a.play('hands_up', { mask: 'arms' }); if (!e.fleeing && a.playing('hands_up')) a.stop('hands_up'); a.update(dt, { speed: e.speed || 0, grounded: true, yaw: e.yaw }); } }
            s.en = s.en.filter(e => !(e.dead && e.dt > 12));
        };
        /* ---- drawing ---- */
        const R = N3.create(W, H); const mountains = (() => { const m = []; const rr = rng(9); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, d = 175 + rr() * 30; m.push({ x: Math.sin(a) * d, z: Math.cos(a) * d, h: 28 + rr() * 40, w: 36 + rr() * 30 }); } return m; })();
        const drawBox = b => { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, w = b.x1 - b.x0, d = b.z1 - b.z0, h = b.y1 - b.y0, c = b.col; if (b.ramp) { N3.drawRamp(R, b, c); return; } if (b.kind === 'rock') { R.sphere(cx, b.y0 + b.ry * .75, cz, b.rx, c, 4, 7, b.ry, b.rz); return; } R.box(cx, b.y0, cz, w, h, d, c, 0, [c, c, N3.shade(c, .88), N3.shade(c, .88), N3.shade(c, 1.12), c]); if (b.kind === 'crate') R.box(cx, b.y1 - .08, cz, w + .03, .08, d + .03, [90, 74, 46]); };
        s.draw = g => {
            const sh = s.shake > 0 ? (Math.random() - .5) * .08 : 0, eye = p.y + 1.62 + Math.sin(p.bob) * .035 * Math.min(1, Math.hypot(p.vx, p.vz) / 5), fov = lerp(1.2, 1.2 / (WEAP[curW().id].zoom || 1), s.zoom);
            let cam = { x: p.x, y: eye + sh, z: p.z, yaw: p.yaw, pitch: p.pitch, fov };
            if (s.tp) { const back = s.veh ? 6.5 : 3.3, up = s.veh ? 2.6 : 1.0; let d = back; for (; d > .6; d -= .4) { const cx = p.x - Math.sin(p.yaw) * d, cz = p.z - Math.cos(p.yaw) * d, cy = eye + up; let bad = Math.abs(cx) > HALF + 1 || Math.abs(cz) > HALF + 1; if (!bad) for (const b of grid.near(cx, cz, 1)) if (!b.ghost && !b.ramp && cx > b.x0 - .2 && cx < b.x1 + .2 && cz > b.z0 - .2 && cz < b.z1 + .2 && cy > b.y0 && cy < b.y1 + .2) { bad = true; break; } if (!bad) break; } const shoulder = s.veh ? 0 : (C.camera === 'third' ? .75 : 0) * (1 - Math.min(1, s.zoom || 0) * .35), zin = (C.camera === 'third' && !s.veh) ? 1 - Math.min(1, s.zoom || 0) * .45 : 1; cam = { x: p.x - Math.sin(p.yaw) * d * zin + Math.cos(p.yaw) * shoulder, y: eye + sh + up * (d / back), z: p.z - Math.cos(p.yaw) * d * zin - Math.sin(p.yaw) * shoulder, yaw: p.yaw, pitch: p.pitch - .1, fov: 1.2 }; }
            R.begin(cam, { top: [64, 120, 205], bottom: [210, 222, 235], fog: [200, 216, 232], fogNear: 70, fogFar: 175, ambient: .5 });
            for (const m of mountains) R.prism(m.x, -2, m.z, m.w, m.h, 5, [118, 128, 150], .6);
            R.floor(-HALF - 6, -HALF - 6, HALF + 6, HALF + 6, 0, [110, 138, 84], [102, 130, 78], 8);
            // dirt patches / crash scar
            for (const [x, z, rr] of [[-10, -26, 9], [0, 44, 16], [44, 56, 7], [0, 0, 12]]) { const pts = []; for (let i = 0; i < 10; i++) { const t = i / 10 * 6.283; pts.push([x + Math.cos(t) * rr, .03, z + Math.sin(t) * rr * .8]); } for (let i = 1; i < 9; i++) R.tri(pts[0], pts[i + 1], pts[i], [128, 108, 84]); }
            R.quad([Wd.extract.x - 4, .05, Wd.extract.z - 4], [Wd.extract.x + 4, .05, Wd.extract.z - 4], [Wd.extract.x + 4, .05, Wd.extract.z + 4], [Wd.extract.x - 4, .05, Wd.extract.z + 4], s.obj >= 3 ? [90, 230, 120] : [90, 100, 110]);
            for (const b of Wd.S) { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; if (b.kind === 'cliff') { if (Math.hypot(cx - p.x, cz - p.z) > 170) continue; } else if (Math.abs(cx - p.x) > 110 || Math.abs(cz - p.z) > 110) continue; drawBox(b); }
            for (const e of s.en) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d > 120) continue; if (e.dead && e.dt > 9) continue; An.draw(R, e.actor, { lod: d < 18 ? 0 : d < 45 ? 1 : 2, noShadow: false }); if (e.laser > 0) { const ey = eyeY(e), tx = e.aimAt[0], tz = e.aimAt[1]; R.limb([e.x, ey - .2, e.z], [tx, p.y + 1.3, tz], .02, .02, [255, 40, 40], 3, false); } if (!e.dead && e.sh > 0 && e.hurtT > 0) R.sphere(e.x, e.y + 1, e.z, .9 * e.scale, [120, 190, 255], 3, 7, 1.1 * e.scale, .9 * e.scale); }
            { const J = s.jeep, P = (lx, lz) => [J.x + lx * Math.cos(J.yaw) + lz * Math.sin(J.yaw), J.z - lx * Math.sin(J.yaw) + lz * Math.cos(J.yaw)], OD = [86, 98, 70], TY = [28, 28, 30];
                R.shadow(J.x, .02, J.z, 2.2); R.box(J.x, .45, J.z, 1.9, .55, 3.6, OD, J.yaw); R.box(P(0, -.55)[0], .95, P(0, -.55)[1], 1.8, .5, 1.5, [76, 88, 62], J.yaw); R.box(P(0, 1.35)[0], .95, P(0, 1.35)[1], 1.7, .12, .9, [60, 70, 52], J.yaw); R.box(P(0, 1.1)[0], 1.1, P(0, 1.1)[1], 1.6, .55, .1, [130, 170, 200], J.yaw);
                for (const [lx, lz] of [[-1.0, 1.15], [1.0, 1.15], [-1.0, -1.15], [1.0, -1.15]]) { const q = P(lx, lz); R.box(q[0], 0, q[1], .35, .7, .75, TY, J.yaw + Math.sin(J.rot) * .0); }
                R.box(P(0, -1.9)[0], .5, P(0, -1.9)[1], .8, .8, .2, TY, J.yaw); R.box(P(0, -.9)[0], 1.45, P(0, -.9)[1], .12, .5, .12, [50, 50, 54], J.yaw); }
            if (s.tp) { An.draw(R, soldier, { lod: 0, noShadow: s.veh ? true : false }); }
            for (const b of s.bolts) R.sphere(b.x, b.y, b.z, .14, b.col, 2, 5);
            for (const gr of s.gren) R.sphere(gr.x, gr.y, gr.z, .12, [60, 90, 50], 2, 5);
            for (const bm of (s.booms || [])) R.sphere(bm.x, bm.y + 1, bm.z, 5.5 * (1 - bm.t / 14) + .5, [255, 190, 70], 3, 7, 3.8 * (1 - bm.t / 14) + .5, 5.5 * (1 - bm.t / 14) + .5);
            for (const pk of s.pick) { const a = s.t * 2; R.box(pk.x, (pk.y || 0) + .15 + Math.sin(a) * .06, pk.z, .5, .22, .3, pk.k === 'health' ? [235, 70, 70] : pk.k === 'ammo' ? [220, 190, 70] : [90, 160, 230], a); }
            for (const t of s.tracers) R.limb([t.x0, t.y0, t.z0], [t.x1, t.y1, t.z1], .012, .012, t.red ? [255, 50, 50] : [255, 230, 140], 3, false);
            // viewmodel
            const WD = WEAP[curW().id], fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = fz, rz = -fx, bobx = Math.sin(p.bob) * .012, boby = Math.abs(Math.cos(p.bob)) * .012, kick = (s.recoil || 0) * .012, down = s.rel > 0 ? Math.sin(Math.min(1, (WD.reload - s.rel) / WD.reload) * Math.PI) * .22 : 0, ads = s.zoom;
            const base = (side, up, fwdv) => [p.x + fx * fwdv + rx * side, eye + sh + up, p.z + fz * fwdv + rz * side], cp = Math.cos(p.pitch), sp2 = Math.sin(p.pitch);
            if (ads < .6 && !s.tp) { const o0 = base(.2 * (1 - ads) + bobx, -.2 + boby - down, .38 - kick), o1 = base(.2 * (1 - ads) + bobx, -.17 + boby - down + p.pitch * .6, .95 - kick); R.limb(o0, o1, .028, .022, [52, 54, 60], 5); R.limb(base(.2 + bobx, -.2 + boby - down, .42 - kick), base(.2 + bobx, -.31 + boby - down, .4 - kick), .02, .02, [40, 40, 44], 4); R.limb(base(.12, -.22 - down, .3), base(.17, -.19 + boby - down, .6), .026, .02, [200, 160, 120], 5); R.limb(base(.26, -.28 - down, .2), base(.21, -.2 + boby - down, .42), .028, .022, [90, 110, 80], 5); if (s.flashT > 0) R.sphere(o1[0] + fx * .08, o1[1] + .01, o1[2] + fz * .08, .07, [255, 230, 120], 2, 5); }
            R.end(g);
            // HUD
            if (WD.zoom >= 4 && s.zoom > .6) { g.fillStyle = '#000'; g.fillRect(0, 0, W, 30); g.fillRect(0, H - 30, W, 30); g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = 60; g.beginPath(); g.arc(W / 2, H / 2, 150, 0, 6.3); g.stroke(); g.lineWidth = 1; g.strokeStyle = '#111'; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke(); }
            else { const sp3 = 6 + (Math.hypot(p.vx, p.vz) > 2 ? 3 : 0) + (s.recoil || 0) * .6; g.strokeStyle = s.hit > 0 ? '#ff5050' : '#9ff'; g.lineWidth = 1; g.beginPath(); g.moveTo(W / 2 - sp3 - 5, H / 2); g.lineTo(W / 2 - sp3, H / 2); g.moveTo(W / 2 + sp3, H / 2); g.lineTo(W / 2 + sp3 + 5, H / 2); g.moveTo(W / 2, H / 2 - sp3 - 5); g.lineTo(W / 2, H / 2 - sp3); g.moveTo(W / 2, H / 2 + sp3); g.lineTo(W / 2, H / 2 + sp3 + 5); g.stroke(); }
            // shield + health (Halo style: segmented bar)
            const segs = 10; for (let i = 0; i < segs; i++) { const on = s.shield / C.shield * segs > i; g.fillStyle = on ? (s.shield < 30 && ((s.t * 6) | 0) % 2 ? '#ff6a4a' : '#6ae0ff') : 'rgba(0,0,0,.4)'; g.fillRect(70 + i * 18, 8, 15, 6); }
            for (let i = 0; i < 10; i++) { g.fillStyle = s.health / C.health * 10 > i ? '#e84a4a' : 'rgba(0,0,0,.4)'; g.fillRect(70 + i * 18, 17, 15, 3); }
            g.font = '10px monospace'; g.fillStyle = '#fff'; g.textAlign = 'right'; const cw = curW(); g.fillText(WEAP[cw.id].name + '  ' + cw.mag + ' / ' + cw.res, W - 8, H - 22); g.fillText('GRENADES ' + s.grenades[0], W - 8, H - 10); g.textAlign = 'left'; g.fillText('KILLS ' + s.kills + '  SCORE ' + Math.round(s.score), 8, 14); g.fillText('LIVES ' + s.lives, 8, 26);
            const ob = WR.OBJECTIVES[s.obj]; if (ob) { g.fillStyle = '#ffe14a'; g.fillText('> ' + ob.text + (ob.zone < 3 ? ' (' + Math.max(0, s.zoneLeft[ob.zone]) + ' left)' : ''), 8, H - 8); }
            // motion tracker
            const rcx = 38, rcy = H - 52, rr = 30; g.fillStyle = 'rgba(10,30,20,.65)'; g.beginPath(); g.arc(rcx, rcy, rr, 0, 6.3); g.fill(); g.strokeStyle = '#3f8'; g.beginPath(); g.arc(rcx, rcy, rr, 0, 6.3); g.stroke(); g.fillStyle = '#3f8'; g.fillRect(rcx - 1, rcy - 1, 3, 3);
            for (const e of s.en) { if (e.dead) continue; const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz); if (d > 38 || (!(e.speed > .5) && !(e.burst > 0) && !(e.laser > 0))) continue; const a = Math.atan2(dx, dz) - p.yaw, rd = d / 38 * rr; g.fillStyle = '#ff5030'; g.fillRect(rcx + Math.sin(a) * rd - 1.5, rcy - Math.cos(a) * rd - 1.5, 3, 3); }
            if (s.flash > 0 || s.shield < 25) { g.fillStyle = 'rgba(255,40,30,' + (s.flash > 0 ? .25 : .08 + .05 * Math.sin(s.t * 8)) + ')'; g.fillRect(0, 0, W, H); }
            for (const dd of s.dmgDir) { const a = dd.a - p.yaw; g.fillStyle = 'rgba(255,60,40,' + dd.t / 60 + ')'; g.save(); g.translate(W / 2, H / 2); g.rotate(a); g.fillRect(-12, -62, 24, 5); g.restore(); }
            if (s.msgT > 0 && s.msg) { g.textAlign = 'center'; g.font = 'bold 11px monospace'; g.fillStyle = '#fff'; g.fillText(s.msg, W / 2, 48); }
            if (s.status !== 'play') { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, H / 2 - 30, W, 60); g.textAlign = 'center'; g.fillStyle = s.status === 'win' ? '#4ae87a' : '#ff5a5a'; g.font = '18px monospace'; g.fillText(s.status === 'win' ? 'MISSION COMPLETE' : 'MISSION FAILED', W / 2, H / 2 + 6); }
        };
        return { s, C, step: s.step, draw: s.draw };
    };
    A.NRWar = WR;
    if (isNode) module.exports = WR; else root.NRWar = WR;
})(typeof window !== 'undefined' ? window : globalThis);

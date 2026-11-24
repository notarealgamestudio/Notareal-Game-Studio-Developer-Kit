/* nrworld3d.js - DS (and later PSX / N64) version of the kit's 3D game types. Takes the SAME world definitions the PC / Xbox engines play
   (nr3d_sandbox.js, nr3d_war.js, nr3d_rpg.js: boxes, ramps, squads, enemy and weapon tables, physics numbers) and packs them into the W3DW section of
   engine/world3d's data block. build(P) -> { block, warnings, stats }. Layout mirrors engine/world3d/source/main.c (Hd 80 bytes, Bx 24, Ent 8, Wp 24, Et 16). */
(function (root) {
    'use strict'; const node = typeof module !== 'undefined', W3 = {}, req = n => node ? require('./' + n) : root[{ 'nr3d_sandbox.js': 'NRSandbox', 'nr3d_war.js': 'NRWar', 'nr3d_rpg.js': 'NRRpg', 'nr3d_store.js': 'NRStore', 'nr3d_frontier.js': 'NRFrontier' }[n]];
    const rgb15 = c => (c[0] >> 3 | (c[1] >> 3) << 5 | (c[2] >> 3) << 10 | 0x8000), s16 = v => Math.max(-32768, Math.min(32767, Math.round(v))), clampu = (v, m) => Math.max(0, Math.min(m, Math.round(+v || 0)));
    W3.MODES = { sandbox3d: 0, warfare3d: 1, rpg3d: 2 };
    W3.SOFT = { store3d: 3, frontier3d: 4, combat: 5 };   // N64 / PlayStation only (engine/w3soft store mode); the DS engine has no store game
    W3.idx = m => m in W3.MODES ? W3.MODES[m] : W3.SOFT[m];
    const WP = w => ({ name: w.name, dmg: w.dmg, rate: w.rate, mag: w.mag, pellets: w.pellets || 1, reserve: w.reserve, spread: Math.round((w.spread || 0) * 1000), autof: w.auto ? 1 : 0, reload: w.reload || 90 });
    const ST = (name, hp, sh, spd, dmg, cd, burst, acc, score, scale, range, col) => ({ name, hp, sh, spd, dmg, cd, burst, acc, score, scale, range, col });
    function sandbox(cfg) {
        const S = req('nr3d_sandbox.js'), w = S.world(), boxes = w.S.map(b => ({ x0: b.x0, y0: b.y0, z0: b.z0, x1: b.x1, y1: b.y1, z1: b.z1, col: b.col || [150, 120, 90], top: b.top, ramp: b.ramp }));
        const stars = S.STARS.map(s => ({ type: 4, x: s.x, y: s.y, z: s.z })), P = S.PHYS;
        return { boxes, ents: stars, weapons: [], etypes: [], half: w.half + 4, spawn: { x: 0.4, z: -12, yaw: 180 }, ex: 0, ez: 0, sky: [[110, 170, 230], [180, 215, 245]], ground: [96, 168, 80], run: P.run, jump: P.jump, grav: P.gHold, hp: cfg.health || 6, sh: 0, goal: Math.min(stars.length, cfg.goalStars || 6), time: 0 };
    }
    function warfare(cfg) {
        const Wr = req('nr3d_war.js'), w = Wr.world(), boxes = w.S.map(b => ({ x0: b.x0, y0: b.y0, z0: b.z0, x1: b.x1, y1: b.y1, z1: b.z1, col: b.col, ramp: b.ramp })), ents = [], idx = { grunt: 0, warden: 1, hawk: 2 };
        for (const sq of Wr.SQUADS) for (const u of sq.units) ents.push({ type: idx[u[0]] || 0, x: u[1], z: u[2], y: 0, hide: u[3] ? 1 : 0 });
        const cv = w.cover.filter((c, i) => i % Math.max(1, Math.floor(w.cover.length / 12)) === 0).slice(0, 12); cv.forEach((c, i) => ents.push({ type: i % 2 ? 6 : 5, x: c.x + c.nx * 1.5, z: c.z + c.nz * 1.5, y: .3 }));
        const E = Wr.ENEMIES, d = cfg.difficulty || 1, et = [ST('grunt', E.grunt.hp * d, E.grunt.sh, E.grunt.spd * 10, E.grunt.dmg, E.grunt.cd, E.grunt.burst, E.grunt.acc * 100, E.grunt.score, E.grunt.scale * 100, 14, [150, 70, 50]), ST('warden', E.warden.hp * d, E.warden.sh, E.warden.spd * 10, E.warden.dmg, E.warden.cd, E.warden.burst, E.warden.acc * 100, E.warden.score, E.warden.scale * 100, 18, [60, 70, 150]), ST('hawk', E.hawk.hp * d, E.hawk.sh, E.hawk.spd * 10, E.hawk.dmg, E.hawk.cd, 1, 0, E.hawk.score, E.hawk.scale * 100, 40, [60, 110, 60])];
        return { boxes, ents, weapons: ['ar', 'pistol', 'shotgun', 'sniper'].map(k => WP(Wr.WEAPONS[k])), etypes: et, half: 110, spawn: { x: w.spawn.x, z: w.spawn.z, yaw: 180 - (w.spawn.yaw || 0) * 57.2958 }, ex: w.extract.x, ez: w.extract.z, sky: [[196, 170, 130], [230, 205, 170]], ground: [168, 146, 112], run: 6.4, jump: 7.6, grav: 22, hp: cfg.health || 100, sh: cfg.shield == null ? 100 : cfg.shield, goal: 0, time: 0 };
    }
    function rpg(cfg) {
        const R = req('nr3d_rpg.js'), w = R.world(), boxes = [], ents = [], d = cfg.enemies || 1;
        for (const b of w.B) boxes.push({ x0: b.x0, y0: 0, z0: b.z0, x1: b.x1, y1: b.h, z1: b.z1, col: b.col });
        for (const r of w.rocks) boxes.push({ x0: r.x - r.s * .8, y0: 0, z0: r.z - r.s * .8, x1: r.x + r.s * .8, y1: r.s * 1.1, z1: r.z + r.s * .8, col: [130, 112, 92] });
        for (const t of w.trees) boxes.push({ x0: t.x - .25, y0: 0, z0: t.z - .25, x1: t.x + .25, y1: 2.2 * t.s, z1: t.z + .25, col: [96, 78, 56], top: [86, 120, 60] });
        for (const c of w.crates) ents.push({ type: 7, x: c.x, z: c.z, y: .4 });
        for (const n of w.npcs) ents.push({ type: 8, x: n.x, z: n.z, y: 0 });
        const pl = w.places, ring = (p, n, r, type) => { for (let i = 0; i < n; i++) { const a = i / n * 6.283 + .5; ents.push({ type, x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r, y: 0 }); } };
        ring(pl.camp, Math.round(4 * d), 6, 0); ring(pl.ruins, Math.round(3 * d), 5, 0); ring(pl.vault, 2, 4, 0); ents.push({ type: 1, x: pl.vault.x, z: pl.vault.z, y: 0 }); ring(pl.crater, 3, 10, 3); ring({ x: -20, z: 30 }, 2, 6, 2);
        [[-30, 10], [30, -15], [10, 40], [-10, -40]].forEach((p, i) => ents.push({ type: i % 2 ? 6 : 5, x: p[0], z: p[1], y: .3 }));
        const E = R.ENEMIES, Rw = R.WEAPONS, wp = (k, auto) => ({ name: Rw[k].name.slice(0, 11), dmg: Rw[k].dmg, rate: Math.round(Rw[k].rate * 60), mag: Rw[k].clip, pellets: Rw[k].pellets || 1, reserve: Rw[k].clip * 6, spread: Math.round(Rw[k].spread * 1000), autof: auto ? 1 : 0, reload: 90 });
        const et = [ST('raider', E.raider.hp * d, 0, E.raider.speed * 10, E.raider.dmg, 50, 3, 6, E.raider.xp * 4, 100, 15, [150, 100, 60]), ST('chief', E.chief.hp * d, 40, E.chief.speed * 10, E.chief.dmg, 40, 4, 4, E.chief.xp * 4, 115, 18, [120, 50, 50]), ST('dog', E.dog.hp * d, 0, E.dog.speed * 10, E.dog.dmg, 40, 1, 0, E.dog.xp * 4, 70, 0, [140, 110, 80]), ST('scorpion', E.scorpion.hp * d, 0, E.scorpion.speed * 10, E.scorpion.dmg, 50, 1, 0, E.scorpion.xp * 4, 90, 0, [120, 70, 40])];
        return { boxes, ents, weapons: [wp('pistol', 0), wp('rifle', 0), wp('shotgun', 0)], etypes: et, half: 75, spawn: { x: 0, z: 14, yaw: 0 }, ex: 0, ez: 0, sky: [[210, 180, 130], [236, 210, 160]], ground: [190, 160, 110], run: 5.4, jump: 7, grav: 22, hp: cfg.health || 100, sh: 0, goal: 0, time: 0 };
    }

    function store(cfg) {
        const St = req('nr3d_store.js'), w = St.world(), d = cfg || {}, boxes = [], ents = [], E = (type, flags, x, z, y) => ents.push({ type, flags: flags || 0, x, z, y: y || 0 });
        for (const b of w.S) { if (b.kind === 'kerb' && b.ghost) { boxes.push({ x0: b.x0, y0: b.y0, z0: b.z0, x1: b.x1, y1: b.y1, z1: b.z1, col: b.col }); continue; } const inv = (b.kind === 'invis' || b.kind === 'npc' || !b.col); boxes.push({ x0: b.x0, y0: b.y0, z0: b.z0, x1: b.x1, y1: b.y1, z1: b.z1, col: b.col || [90, 90, 90], top: b.top, inv }); }
        w.shelves.forEach((s, i) => { const px = St.PRODUCTS.findIndex(p => p.id === s.id); E(9, px, s.fx, s.fz); E(16, px, s.x, s.z, Math.round((s.face === 'x-' ? -7 : s.w) * 8)); });
        w.piles.forEach(p => E(10, St.PRODUCTS.findIndex(q => q.id === p.id), p.fx, p.fz));
        E(11, 0, w.reg.x, w.reg.z); w.queue.forEach((q, i) => E(12, i, q.x, q.z)); E(13, 0, w.hobo.x, w.hobo.z); E(14, 0, w.dealer.x, w.dealer.z); E(15, 0, w.door.x, w.door.z); E(15, 1, w.spawnOut.x, w.spawnOut.z);
        E(17, 0, w.zone.x0, w.zone.z0); E(17, 1, w.zone.x1, w.zone.z1);
        const hr = (+d.startHour || 14) | ((+d.endHour || 22) << 8), fl = Math.round((d.thieves == null ? .16 : d.thieves) * 100) | ((d.hobo === false ? 0 : 1) << 8) | ((d.dealer === false ? 0 : 2) << 8) | ((d.robbery === false ? 0 : 4) << 8);
        return { boxes, ents, weapons: [], etypes: [], half: 45, spawn: { x: w.spawnHero.x, z: w.spawnHero.z, yaw: 0 }, ex: 0, ez: 0, sky: [[110, 170, 230], [180, 215, 245]], ground: [92, 96, 104], run: 4.4, jump: 0, grav: 24, hp: 100, sh: Math.round(d.wallet == null ? 25 : d.wallet), time: Math.round(d.shiftSeconds || 300), goal: Math.round(d.goal || 20), pad: [Math.round(d.till || 100), hr, fl] };
    }
    function frontier(cfg) {
        const Fr = req('nr3d_frontier.js'), w = Fr.world(cfg.seed || 7, cfg), d = cfg || {}, boxes = w.S.map(b => ({ x0: b.x0, y0: b.y0, z0: b.z0, x1: b.x1, y1: b.y1, z1: b.z1, col: b.col, top: b.top })), k = d.difficulty || 1;
        const et = Fr.ENEMIES.map(e => ST(e.n, e.hp * k, e.sh, e.spd, e.dmg, e.cd, e.burst, e.acc, e.score, e.scale, e.range, e.col));
        return { boxes, ents: w.ents, weapons: Fr.WEAPONS.map(WP), etypes: et, half: w.half, spawn: w.spawn, ex: 0, ez: 0, sky: [[228, 170, 110], [246, 214, 160]], ground: [196, 160, 108], run: 5.6, jump: 0, grav: 22, hp: d.health || 100, sh: 0, goal: d.questsToWin || 3, time: 0, pad: [Math.round(d.startMoney == null ? 20 : d.startMoney), 0, 0], front: Fr.pack(d) };
    }
    /* vehicle combat (N64 / PlayStation): header (mode 5) + the KcCfg block of shared/kartcombat.h; the same numbers the DS arcade ROM and the PC engine use */
    const hexc = h => [1, 3, 5].map(i => parseInt((h || '#000000').slice(i, i + 2), 16) || 0);
    W3.combatBlock = cfg => {
        const A = require_('nrarcade.js'), D = Object.assign({}, A.DEFAULTS.combat, cfg || {}), b = new Uint8Array(112), dv = new DataView(b.buffer); b[0] = 5;
        const t = String(D.title || 'Scrap Run').slice(0, 31).toUpperCase(); for (let i = 0; i < t.length; i++) b[32 + i] = t.charCodeAt(i) & 127;
        const v = [D.laps, D.rivals, D.hp, D.rivalHp, D.missiles, D.mines, D.gunDamage, D.missileDamage, D.mineDamage, D.maxSpeed, D.curves, D.timeLimit, Math.round((D.difficulty || 1) * 10)];
        v.forEach((x, i) => dv.setInt16(80 + i * 2, Math.max(-32768, Math.min(32767, Math.round(+x || 0))), true)); dv.setUint16(106, rgb15(hexc(D.color)), true); dv.setUint16(108, rgb15(hexc(D.color2)), true);
        return b;
    };
    const require_ = n => node ? require('./' + n) : root.NRArcade;
    W3.build = P => {
        const A = P.arcade; if (!A || W3.idx(A.mode) === undefined) throw new Error('No 3D game (sandbox3d / warfare3d / rpg3d / store3d / frontier3d) set up yet'); const cfg = A.cfg || {}, warn = [];
        if (A.mode === 'combat') { const b = W3.combatBlock(cfg), hdr = 32, blk = new Uint8Array(hdr + b.length + 16), v = new DataView(blk.buffer); blk.set([...'NRGDATA1'].map(c => c.charCodeAt(0)), 0); v.setUint32(12, blk.length, true); v.setUint32(16, 1, true); blk.set([...'W3DW'].map(c => c.charCodeAt(0)), 20); v.setUint32(24, hdr, true); v.setUint32(28, b.length, true); blk.set(b, hdr); return { block: blk, warnings: warn, stats: { mode: 'combat', boxes: 0, entities: 0, weapons: 3, enemyTypes: 1, bytes: b.length } }; }
        const g = A.mode === 'frontier3d' ? frontier(cfg) : A.mode === 'store3d' ? store(cfg) : A.mode === 'sandbox3d' ? sandbox(cfg) : A.mode === 'warfare3d' ? warfare(cfg) : rpg(cfg);
        let boxes = g.boxes.filter(b => b.x1 > b.x0 && b.z1 > b.z0 && b.y1 > b.y0); if (boxes.length > 290) { const big = boxes.slice().sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.z1 - a.z0) * (a.y1 - a.y0)).slice(0, 290); warn.push(`${boxes.length - 290} small objects left out to fit the DS (290 solid boxes max).`); boxes = boxes.filter(b => big.includes(b)); }
        let ents = g.ents.slice(0, 60); if (g.ents.length > 60) warn.push(`${g.ents.length - 60} extra enemies / pickups left out (60 max).`);
        const wps = g.weapons.slice(0, 4), ets = g.etypes.slice(0, 4), nb = boxes.length, ne = ents.length, nw = wps.length, nt = ets.length, size = 80 + nb * 24 + ne * 8 + nw * 24 + nt * 16, b = new Uint8Array(size), dv = new DataView(b.buffer);
        let o = 0; const u8 = v => { b[o++] = v; }, u16 = v => { dv.setUint16(o, v & 0xffff, true); o += 2; }, i16 = v => { dv.setInt16(o, s16(v), true); o += 2; };
        u8(W3.idx(A.mode)); u8((cfg.camera === 'third' ? 1 : 0) | (A.mode === 'sandbox3d' && (cfg.platformer || String(P.genre) === 'platformer_3d') ? 2 : 0)); u16(nb); u16(ne); u8(nw); u8(nt); i16(g.spawn.x * 8); i16(g.spawn.z * 8); i16(g.spawn.yaw || 0); i16(g.half * 8); u16(rgb15(g.sky[0])); u16(rgb15(g.sky[1])); u16(rgb15(g.ground)); u16(g.time); i16(g.ex * 8); i16(g.ez * 8); u16(g.goal); u16(0);
        const t = String(cfg.title || 'Notareal 3D').slice(0, 31).toUpperCase(); for (let i = 0; i < 32; i++) u8(i < t.length ? t.charCodeAt(i) & 127 : 0); u16(Math.round(g.run * 10)); u16(Math.round(g.jump * 10)); u16(Math.round(g.grav * 10)); u16(g.hp); u16(g.sh); u16((g.pad || [])[0] || 0); u16((g.pad || [])[1] || 0); u16((g.pad || [])[2] || 0);
        if (o !== 80) throw new Error('header size ' + o);
        for (const x of boxes) { i16(x.x0 * 8); i16(x.y0 * 8); i16(x.z0 * 8); i16(x.x1 * 8); i16(x.y1 * 8); i16(x.z1 * 8); u16(rgb15(x.col || [150, 120, 90])); u16(x.top ? rgb15(x.top) : 0); u8(x.ramp ? 2 : x.inv ? 3 : 0); u8(x.ramp ? (x.ramp.axis === 'x' ? 1 : 2) : 0); i16(x.ramp ? x.ramp.h0 * 8 : 0); i16(x.ramp ? x.ramp.h1 * 8 : 0); i16(0); }
        for (const e of ents) { u8(e.type); u8(e.flags || (e.hide ? 1 : 0)); i16(e.x * 8); i16((e.y || 0) * 8); i16(e.z * 8); }
        for (const w of wps) { for (let i = 0; i < 12; i++) u8(i < w.name.length ? w.name.toUpperCase().charCodeAt(i) & 127 : 0); u8(clampu(w.dmg, 255)); u8(clampu(w.rate, 255)); u8(clampu(w.mag, 255)); u8(clampu(w.pellets, 255)); u16(clampu(w.reserve, 65535)); u8(clampu(w.spread, 255)); u8(w.autof); u16(clampu(w.reload, 65535)); u8(0); u8(0); }
        for (const e of ets) { u16(clampu(e.hp, 65535)); u16(clampu(e.sh, 65535)); u16(clampu(e.spd, 65535)); u8(clampu(e.dmg, 255)); u8(clampu(e.cd, 255)); u8(clampu(e.burst, 255)); u8(clampu(e.acc, 255)); u16(clampu(e.score, 65535)); u8(clampu(e.scale, 255)); u8(clampu(e.range, 255)); u16(rgb15(e.col)); }
        if (o !== size) throw new Error('size mismatch ' + o + ' vs ' + size);
        const secs = [['W3DW', b]]; if (g.front) secs.push(['FRNT', g.front]); const hdr = 20 + secs.length * 12; let off = (hdr + 15) & ~15, total = off; for (const x of secs) total += (x[1].length + 15) & ~15;
        const blk = new Uint8Array(total), v = new DataView(blk.buffer); blk.set([...'NRGDATA1'].map(c => c.charCodeAt(0)), 0); v.setUint32(12, blk.length, true); v.setUint32(16, secs.length, true);
        secs.forEach((x, i) => { blk.set([...x[0]].map(c => c.charCodeAt(0)), 20 + i * 12); v.setUint32(24 + i * 12, off, true); v.setUint32(28 + i * 12, x[1].length, true); blk.set(x[1], off); off += (x[1].length + 15) & ~15; });
        return { block: blk, warnings: warn, stats: { mode: A.mode, boxes: nb, entities: ne, weapons: nw, enemyTypes: nt, bytes: size } };
    };
    if (node) module.exports = W3; else root.NRWorld3D = W3;
})(typeof window !== 'undefined' ? window : globalThis);

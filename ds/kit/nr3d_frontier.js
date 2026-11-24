/* nr3d_frontier.js - the FRONTIER third-person shooter: a dusty western town, a homestead, an outlaw camp and a mine, with factions you build a reputation with,
   people to talk to (choices change standing and start quests), a horse, duels at high noon, a bounty the law collects on and a Dead Eye slow-motion aim.
   Feel: Red Dead Redemption (horse, duels, bounty, Dead Eye) x Fallout: New Vegas (factions, reputation titles, dialogue choices, quests) x Gun (2005-08: a hard, dirty, dusty frontier).
   world(seed) -> boxes + entities + the FRNT tables (factions, people, dialogues, quests) that engine/w3soft/source/w3front.h plays. All text is upper-case, short (the font is 8x8). */
(function (root) {
    'use strict'; const F = {};
    F.FACTIONS = ['LAW', 'OUTLAWS', 'SETTLERS'];
    // kind: 0 civilian, 1 lawman, 2 outlaw, 3 duelist, 4 horse
    F.NPCS = [
        { n: 'SHERIFF COLE', f: 0, kind: 1, d: 0, d2: 2, q: 0, x: -7, z: -7 }, { n: 'MAE', f: 2, kind: 0, d: 3, d2: 255, q: 255, x: -7, z: -23 }, { n: 'ABEL', f: 2, kind: 0, d: 5, d2: 255, q: 255, x: -7, z: 7 },
        { n: 'ADA HOLT', f: 2, kind: 0, d: 6, d2: 7, q: 1, x: 62, z: 38 }, { n: 'DUTCH', f: 1, kind: 2, d: 8, d2: 10, q: 2, x: -7, z: -18 }, { n: 'BLACK JACK', f: 1, kind: 3, d: 11, d2: 12, q: 3, x: 0, z: -36 },
        { n: 'PREACHER', f: 2, kind: 0, d: 13, d2: 255, q: 255, x: 7, z: 10 }, { n: 'DRIFTER', f: 2, kind: 0, d: 14, d2: 255, q: 255, x: -3, z: 27 }, { n: 'BANKER', f: 0, kind: 0, d: 15, d2: 255, q: 255, x: -7, z: 22 },
        { n: 'STABLE HAND', f: 2, kind: 0, d: 16, d2: 255, q: 255, x: 7, z: -25 }, { n: 'HORSE', f: 2, kind: 4, d: 255, d2: 255, q: 255, x: 5, z: -31 }, { n: 'HORSE', f: 2, kind: 4, d: 255, d2: 255, q: 255, x: 58, z: 33 }
    ];
    // effects: 0 end, 1 rep(a1=faction,a2=delta), 2 give $ (a1*5), 3 take $ (a1*5, needs it), 4 start quest a1, 5 turn in quest, 6 buy ammo (cost a1*5, +a2 per gun), 7 heal (cost a1*5, +a2 hp), 8 duel (a1 skill 1-4), 9 pay bounty
    const O = (l, eff, a1, a2, next, rf, rv) => ({ l, eff: eff || 0, a1: a1 || 0, a2: a2 || 0, next: next == null ? 255 : next, rf: rf == null ? 255 : rf, rv: rv || 0 });
    F.DIALOGUES = [
        { t: 'OUTLAWS HOLE UP IN DRY GULCH. CLEAR THEM?', o: [O("I'LL DO IT", 4, 0), O("WHAT'S IN IT FOR ME?", 0, 0, 0, 1), O('NOT MY PROBLEM', 1, 0, -3)] },
        { t: '$100 AND THE TOWN WILL REMEMBER YOU.', o: [O('DEAL', 4, 0), O('FORGET IT')] },
        { t: 'GULCH IS QUIET. GOOD WORK, PARTNER.', o: [O('COLLECT REWARD', 5)] },
        { t: 'WHISKEY HEALS WHAT LEAD DID. $5 A SHOT.', o: [O('DRINK  $5', 7, 1, 40), O('ANY WORK AROUND?', 0, 0, 0, 4), O('LEAVE')] },
        { t: 'DUTCH IN THE BACK WANTS A WORD.', o: [O('THANKS')] },
        { t: 'AMMO AND TONIC. WHAT WILL IT BE?', o: [O('AMMO  $10', 6, 2, 12), O('TONIC  $10', 7, 2, 60), O('JUST LOOKING')] },
        { t: 'BANDITS TOOK MY SUPPLIES. FETCH 3 CRATES?', o: [O("I'LL FIND THEM", 4, 1), O('SORRY. NO.')] },
        { t: 'YOU FOUND THEM! BLESS YOU.', o: [O('TAKE REWARD', 5)] },
        { t: 'LAW IS BAD FOR BUSINESS. DROP 3 DEPUTIES.', o: [O('COUNT ME IN', 4, 2, 0, 255, 1, -30), O('I RIDE FOR THE LAW', 1, 0, 5), O('WHO ARE YOU?', 0, 0, 0, 9)] },
        { t: 'DUTCH. THIS TOWN OWES ME, AND I COLLECT.', o: [O('GO ON', 0, 0, 0, 8)] },
        { t: 'DEPUTIES DOWN. YOU RIDE WITH US NOW.', o: [O('TAKE THE CUT', 5)] },
        { t: 'THEY SAY YOU ARE QUICK. PROVE IT AT NOON.', o: [O('DRAW!', 8, 2), O('WALK AWAY', 1, 1, -2)] },
        { t: 'HELL OF A DRAW, STRANGER.', o: [O('FAIR ENOUGH', 5)] },
        { t: 'THE LORD FORGIVES. THE LAW WANTS PAYING.', o: [O('PAY MY BOUNTY', 9), O('BLESS ME', 1, 2, 2), O('LEAVE')] },
        { t: 'DEAD EYE SLOWS TIME. MINE IS FULL OF THEM.', o: [O('THANKS')] },
        { t: 'TOWN FUNDS ARE NOT FOR SALE. MOVE ALONG.', o: [O('LEAVE')] },
        { t: 'TAKE ANY HORSE. A TO MOUNT AND DISMOUNT.', o: [O('THANKS')] }
    ];
    // type 0 kill N enemies of faction `tg`, 1 fetch N loot crates, 3 win the duel
    F.QUESTS = [
        { n: 'CLEAR DRY GULCH', type: 0, giver: 0, count: 6, tg: 1, reward: 20, rf: 0, rd: 15 }, { n: 'STOLEN SUPPLIES', type: 1, giver: 3, count: 3, tg: 0, reward: 14, rf: 2, rd: 15 },
        { n: 'THIN THE BADGES', type: 0, giver: 4, count: 3, tg: 0, reward: 24, rf: 1, rd: 20 }, { n: 'HIGH NOON', type: 3, giver: 5, count: 1, tg: 0, reward: 20, rf: 1, rd: 10 }
    ];
    F.WEAPONS = [{ name: 'REVOLVER', dmg: 26, rate: 20, mag: 6, pellets: 1, reserve: 54, spread: 5, auto: 0, reload: 110 }, { name: 'REPEATER', dmg: 40, rate: 38, mag: 8, pellets: 1, reserve: 48, spread: 2, auto: 0, reload: 150 }, { name: 'SHOTGUN', dmg: 13, rate: 54, mag: 2, pellets: 7, reserve: 20, spread: 30, auto: 0, reload: 130 }];
    F.ENEMIES = [{ n: 'bandit', hp: 40, sh: 0, spd: 40, dmg: 7, cd: 60, burst: 2, acc: 8, score: 100, scale: 100, range: 16, col: [150, 90, 60] }, { n: 'gunman', hp: 65, sh: 0, spd: 52, dmg: 9, cd: 46, burst: 3, acc: 5, score: 200, scale: 100, range: 20, col: [90, 50, 40] },
        { n: 'deputy', hp: 70, sh: 0, spd: 46, dmg: 8, cd: 50, burst: 2, acc: 5, score: 150, scale: 100, range: 22, col: [50, 70, 130] }, { n: 'bounty hunter', hp: 150, sh: 40, spd: 50, dmg: 14, cd: 36, burst: 3, acc: 3, score: 500, scale: 110, range: 24, col: [40, 36, 34] }];
    F.ENEMY_FACTION = [1, 1, 0, 1];
    F.data = cfg => { const d = (cfg && cfg.data) || {}; return { FACTIONS: d.FACTIONS || F.FACTIONS, NPCS: d.NPCS || F.NPCS, DIALOGUES: d.DIALOGUES || F.DIALOGUES, QUESTS: d.QUESTS || F.QUESTS }; };
    F.world = (seed, cfg) => {
        const D = F.data(cfg);
        let s = (seed || 7) * 2654435761 >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }, S = [], ents = [];
        const box = (x0, z0, x1, z1, h, col, top, y0) => S.push({ x0, y0: y0 || 0, z0, x1, y1: (y0 || 0) + h, z1, col, top }), E = (type, x, z, flags, y) => ents.push({ type, x, z, flags: flags || 0, y: y || 0 });
        const WOOD = [130, 96, 62], WOOD2 = [110, 80, 52], ROOF = [92, 66, 44], ADOBE = [190, 150, 105], STONE = [140, 130, 120], WHITE = [214, 206, 190], RED = [140, 60, 44];
        // main street buildings: x -20..-8 west, 8..20 east; open front (no doors to walk through: a wall with a gap is too many boxes), solid blocks with a porch
        const bld = (x0, z0, x1, z1, h, col, porchSide) => { box(x0, z0, x1, z1, h, col, ROOF); porchSide < 0 ? box(x1, z0, x1 + 1.6, z1, .35, WOOD2, WOOD) : box(x0 - 1.6, z0, x0, z1, .35, WOOD2, WOOD); };
        bld(-20, -32, -8, -16, 6, WOOD, -1); bld(-20, -12, -8, -2, 5, ADOBE, -1); bld(-20, 2, -8, 12, 5.5, WOOD, -1); bld(-20, 16, -8, 28, 6.5, STONE, -1);
        bld(8, -34, 20, -18, 4.5, WOOD2, 1); bld(8, -12, 20, 0, 6, WHITE, 1); bld(8, 6, 20, 18, 5, WHITE, 1); bld(8, 22, 20, 30, 5, WOOD, 1);
        box(11, 8, 15, 12, 4, WHITE, [120, 90, 60], 5); box(12.4, 9.4, 13.6, 10.6, 3, WHITE, [160, 40, 40], 9);    // steeple
        box(24, -4, 28, 0, 1, WOOD2, WOOD, 7); [[24, -4], [27, -4], [24, -1], [27, -1]].forEach(p => box(p[0], p[1], p[0] + 1, p[1] + 1, 7, WOOD2)); box(23, -5, 29, 1, 3, [90, 60, 40], null, 8);   // water tower
        // fences, hitching posts, barrels, crates (cover)
        for (let z = -36; z <= 32; z += 4) { if (z > -4 && z < 4) continue; box(-6.4, z, -6.2, z + 2, .9, WOOD2); box(6.2, z, 6.4, z + 2, .9, WOOD2); }
        for (let i = 0; i < 10; i++) { const side = i % 2 ? 1 : -1, z = -30 + i * 6.4; box(side * 4.6, z, side * 4.6 + 1, z + 1, 1, [100, 72, 48], WOOD); }
        [[-3, -12], [3, -4], [-2, 14], [3, 20], [1, 0]].forEach(p => box(p[0], p[1], p[0] + 1.2, p[1] + 1.2, 1.1, [120, 86, 54], [140, 110, 80]));
        // the outskirts: canyon walls around the edge, mesas, rocks, dead trees
        const H = 90; box(-H - 6, -H - 6, H + 6, -H, 22, [150, 96, 66]); box(-H - 6, H, H + 6, H + 6, 22, [150, 96, 66]); box(-H - 6, -H, -H, H, 22, [140, 90, 62]); box(H, -H, H + 6, H, 22, [140, 90, 62]);
        for (let i = 0; i < 26; i++) { const x = (rnd() - .5) * 150, z = (rnd() - .5) * 150; if (Math.abs(x) < 26 && z > -42 && z < 36) continue; if (Math.hypot(x - 55, z + 55) < 18 || Math.hypot(x - 60, z - 36) < 14) continue; const w = 2 + rnd() * 5, h = 1.5 + rnd() * 6; box(x, z, x + w, z + w * (.6 + rnd() * .6), h, [160 - rnd() * 25, 110 - rnd() * 20, 80 - rnd() * 15], [175, 130, 95]); }
        for (let i = 0; i < 10; i++) { const x = (rnd() - .5) * 140, z = (rnd() - .5) * 140; if (Math.abs(x) < 24 && z > -42 && z < 36) continue; if (Math.hypot(x - 55, z + 55) < 12) continue; box(x, z, x + .35, z + .35, 2.6, [86, 66, 46], [86, 66, 46]); box(x - .6, z, x + .95, z + .3, .3, [86, 66, 46], null, 1.9); }
        // outlaw camp (55,-55): tents, barrels, a wagon, a campfire ring
        [[48, -60], [58, -62], [64, -54], [46, -49]].forEach(p => box(p[0], p[1], p[0] + 4, p[1] + 3.4, 2.2, [150, 130, 100], [170, 150, 118])); box(52, -54, 54, -52, .5, [60, 40, 30], [200, 90, 30]); box(60, -48, 66, -45, 1.2, WOOD2, WOOD); box(60.6, -47, 61.4, -46, 2.2, WOOD2);
        // homestead (60,36): house, barn, corral
        box(52, 30, 62, 38, 4, WOOD, RED); box(66, 40, 78, 52, 6, RED, ROOF); for (let i = 0; i < 6; i++) box(50 + i * 2.6, 44, 50.2 + i * 2.6, 46, .9, WOOD2);
        // mine (-58,48): rock face with a dark mouth, timber supports, crates
        box(-72, 52, -46, 60, 9, [110, 100, 92]); box(-60, 46, -57, 52, 3.6, [24, 20, 18], null); box(-61, 46, -60.2, 52, 3.6, WOOD2); box(-56.8, 46, -56, 52, 3.6, WOOD2);
        // entities: people, horses (type 8: flags = npc index), enemies, pickups
        D.NPCS.forEach((n, i) => E(8, n.x, n.z, i));
        // enemies: 0 bandit, 1 gunman, 2 deputy, 3 bounty hunter
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + .4; E(0, 55 + Math.cos(a) * 9, -55 + Math.sin(a) * 9); } E(1, 52, -49); E(1, 60, -56); E(3, 55, -58);
        [[-58, 44], [-54, 44], [-62, 44]].forEach(p => E(1, p[0], p[1])); [[44, 22], [70, 30], [46, 50]].forEach(p => E(0, p[0], p[1]));
        [[-4, -2], [3, 12], [-3, 24]].forEach(p => E(2, p[0], p[1]));
        // loot crates (type 7, the stolen supplies are the ones at the camp), health (5), ammo (6)
        [[50, -50], [62, -58], [58, -46], [-60, 42]].forEach(p => E(7, p[0], p[1], 0, .4)); [[-30, 60], [75, -20], [-5, -60], [30, 10], [-40, -20], [4, 4]].forEach((p, i) => E(i % 2 ? 6 : 5, p[0], p[1], 0, .3));
        return { S, ents, half: H + 4, spawn: { x: 0.4, z: 28, yaw: 0 } };
    };
    // FRNT: bytes the engine reads directly (no endian issues). header 8, factions 3x10, people n x16, dialogues d x122 (text 44 + 3 options x26), quests q x24
    F.pack = cfg => {
        const D = F.data(cfg), nn = Math.min(16, D.NPCS.length), nd = Math.min(250, D.DIALOGUES.length), nq = Math.min(8, D.QUESTS.length), size = 8 + 30 + nn * 16 + nd * 122 + nq * 24, b = new Uint8Array(size); let o = 0;
        const u8 = v => { b[o++] = v & 255; }, str = (t, n) => { t = String(t).toUpperCase().replace(/[^A-Z0-9 .,'$!?&-]/g, ''); for (let i = 0; i < n; i++) b[o++] = i < t.length ? t.charCodeAt(i) : 0; };
        u8(3); u8(nn); u8(nd); u8(nq); for (let i = 0; i < 4; i++) u8(0); D.FACTIONS.slice(0, 3).forEach(f => str(f, 10));
        D.NPCS.slice(0, nn).forEach(n => { u8(n.f); u8(n.d == null ? 255 : n.d); u8(n.d2 == null ? 255 : n.d2); u8(n.q == null ? 255 : n.q); u8(n.kind || 0); str(n.n, 10); u8(0); });
        D.DIALOGUES.slice(0, nd).forEach(d => { str(d.t, 44); for (let k = 0; k < 3; k++) { const x = d.o[k]; if (!x) { for (let i = 0; i < 26; i++) u8(0); continue; } str(x.l, 20); u8(x.eff || 0); u8(x.a1 || 0); u8(x.a2 || 0); u8(x.next == null ? 255 : x.next); u8(x.rf == null ? 255 : x.rf); u8(x.rv || 0); } });
        D.QUESTS.slice(0, nq).forEach(q => { u8(q.type); u8(q.giver); u8(q.count); u8(q.tg); u8(q.reward); u8(q.rf); u8(q.rd); str(q.n, 17); });
        if (o !== size) throw new Error('FRNT size ' + o + ' vs ' + size); return b;
    };
    if (typeof module !== 'undefined') module.exports = F; else root.NRFrontier = F;
})(typeof window !== 'undefined' ? window : globalThis);

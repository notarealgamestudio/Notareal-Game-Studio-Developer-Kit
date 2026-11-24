/* nrbracelet.js - data for the DS "Friendship Bracelets" ROM (engine/bracelet), taken from the life sim's data (nrlife_data.js):
 * 48 beads / letters / charms / stones with colour, style tags and price; 30 ready-made patterns (10 structures x palettes, as 12-bead strands);
 * 24 customers from the town's 52 people (name, two favourite styles, favourite colour, budget); 8 story chapters; 8 endings.
 * B.build(P) -> { block, warnings, stats }: one BRDT section in an NRGDATA1 block, written over the ROM's nr_gamedata[] by NRKit.patchROM. */
(function (root) {
    'use strict';
    const node = typeof module !== 'undefined' && typeof require !== 'undefined', LD = node ? require('./nrlife_data.js') : root.NRLifeData, B = {};
    const rgb15 = c => (c[0] >> 3) | (c[1] >> 3) << 5 | (c[2] >> 3) << 10, up = (s, n) => String(s).toUpperCase().replace(/[^A-Z0-9 .'$!?-]/g, '').slice(0, n);
    const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    B.NB = 12;   // beads per bracelet
    B.pick = (world, seed) => {
        const cs = world.comps, beads = [], seen = new Set(), add = c => { if (c && !seen.has(c.id) && beads.length < 48) { seen.add(c.id); beads.push(c); } };
        const byKind = k => cs.filter(c => c.kind === k && c.tier <= 1);
        const cols = []; for (const c of byKind('bead')) { const key = c.rgb.join(','); if (!cols.includes(key) && (c.id.startsWith('plastic') || c.id.startsWith('glass'))) { cols.push(key); add(c); } if (cols.length >= 20) break; }
        for (const c of byKind('letter').filter(c => 'MAYBFLOVEST'.includes(c.letter)).slice(0, 8)) add(c);
        byKind('charm').slice(0, 8).forEach(add); byKind('stone').slice(0, 12).forEach(add);
        return beads;
    };
    B.build = P => {
        const cfg = (P && P.bracelet && P.bracelet.cfg) || (P && P.arcade && P.arcade.cfg) || {}, world = LD.build(cfg.seed || 7), warn = [];
        const beads = B.pick(world, 7), STY = LD.STYLES, nearest = rgb => { let bi = 0, bd = 1e9; beads.forEach((b, i) => { if (b.kind !== 'bead') return; const d = dist(b.rgb, rgb); if (d < bd) { bd = d; bi = i; } }); return bi; };
        const pats = [], seenP = new Set();
        for (const p of world.patterns) { const key = p.struct + p.palette; if (seenP.has(key) || pats.length >= 30) continue; seenP.add(key); const pal = LD.PALETTES[p.palette], seq = LD.STRUCT[p.struct](B.NB, pal.length);
            pats.push({ n: up(p.n, 13), seq: seq.map(i => nearest(LD.COLORS[pal[i % pal.length]] || [200, 200, 200])) }); }
        const custs = world.npcs.filter(n => n.styles && n.styles.length).slice(0, 24).map(n => { const col = LD.COLORS[(n.colors || [])[0]] || [200, 200, 200];
            return { n: up(n.n, 13), s0: STY.indexOf(n.styles[0]), s1: n.styles.length > 1 ? STY.indexOf(n.styles[1]) : STY.indexOf(n.styles[0]), col: nearest(col), budget: Math.min(255, 12 + Math.round(((n.age || '').includes('adult') ? 1 : .7) * 18 + (n.career || '').length % 9 * 3)) }; });
        const chap = LD.CHAPTERS.slice(0, 8), goals = [0, 15, 40, 120, 300, 600, 1000, 1600];
        const size = 50 + 17 * 10 + beads.length * 24 + pats.length * (14 + B.NB) + custs.length * 20 + chap.length * 26 + LD.ENDINGS.length * 20, b = new Uint8Array(size), dv = new DataView(b.buffer); let o = 0;
        const u8 = v => { b[o++] = v & 255; }, u16 = v => { dv.setUint16(o, v & 0xffff, true); o += 2; }, u32 = v => { dv.setUint32(o, v >>> 0, true); o += 4; }, str = (s, n) => { for (let i = 0; i < n; i++) u8(i < s.length ? s.charCodeAt(i) : 0); };
        u8(beads.length); u8(STY.length); u8(pats.length); u8(custs.length); u8(chap.length); u8(LD.ENDINGS.length); u16(Math.round((cfg.startMoney == null ? 60 : cfg.startMoney) * 100)); u8(cfg.days || 28); u8(B.NB);
        str(up(cfg.title || 'Friendship Bracelets', 31), 32); u32(0); u32(0);
        if (o !== 50) throw new Error('header ' + o);
        for (const s of STY) str(up(s, 9), 10);
        for (const c of beads) { str(up(c.n.replace('Plastic bead', 'PLASTIC').replace('Alphabet bead', 'LETTER'), 13), 14); u16(rgb15(c.rgb)); u8({ bead: 0, letter: 1, charm: 2, stone: 3 }[c.kind] || 0); u8(Math.min(255, Math.max(3, Math.round(c.v * 100)))); u32((c.st || []).reduce((m, s) => m | 1 << Math.max(0, STY.indexOf(s)), 0)); u8(c.letter ? c.letter.charCodeAt(0) : 0); u8(0); }
        for (const p of pats) { str(p.n, 14); for (let i = 0; i < B.NB; i++) u8(p.seq[i]); }
        for (const c of custs) { str(c.n, 14); u8(c.s0 < 0 ? 0 : c.s0); u8(c.s1 < 0 ? 0 : c.s1); u8(c.col); u8(c.budget); u16(0); }
        chap.forEach((c, i) => { str(up(c.n, 23), 24); u16(goals[i] * 100); });
        for (const e of LD.ENDINGS) str(up(e.n, 19), 20);
        if (o > size) throw new Error('size ' + o + ' > ' + size);
        const hdr = 20 + 12, off = (hdr + 15) & ~15, blk = new Uint8Array((off + size + 15) & ~15), v = new DataView(blk.buffer);
        blk.set([...'NRGDATA1'].map(c => c.charCodeAt(0)), 0); v.setUint32(12, blk.length, true); v.setUint32(16, 1, true); blk.set([...'BRDT'].map(c => c.charCodeAt(0)), 20); v.setUint32(24, off, true); v.setUint32(28, size, true); blk.set(b, off);
        return { block: blk, warnings: warn, stats: { beads: beads.length, patterns: pats.length, customers: custs.length, bytes: size } };
    };
    if (node) module.exports = B; else root.NRBracelet = B;
})(typeof window !== 'undefined' ? window : globalThis);

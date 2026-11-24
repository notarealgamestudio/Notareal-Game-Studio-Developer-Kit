/* nrfit.js (v1.2) - Console Fit and Playtest Report.
 * Fit.matrix()        which game types export to which console TODAY (rom / pc / planned) - honest, from the real exporters
 * Fit.check(P, id)    does THIS project fit that console's real limits? -> {status, lines[], fixes[]}
 * Fit.report(P)       playtest report for a platformer project: clear times, hazard density, difficulty curve, warnings */
(function (root) {
    'use strict';
    const F = {}, node = typeof require === 'function' && typeof module !== 'undefined', Tpl = node ? require('./nrtemplates.js') : root.NRTemplates;
    /* real hardware limits (OAM = hardware sprites on screen, perLine = sprites on one scanline) */
    F.CONSOLES = {
        ds: { name: 'Nintendo DS', oam: 128, perLine: 128, maxSprite: 64, colors: 16, ch: 16, tilesMax: 1024, romMB: 512, exporter: true },
        snes: { name: 'Super Nintendo', oam: 128, perLine: 32, maxSprite: 64, colors: 16, ch: 8, tilesMax: 1024, romMB: 2, exporter: true },
        gba: { exporter: true, name: 'Game Boy Advance', oam: 128, perLine: 128, maxSprite: 64, colors: 16, ch: 6, tilesMax: 1024, romMB: 32 },
        gbc: { exporter: true, name: 'Game Boy Color', oam: 40, perLine: 10, maxSprite: 16, colors: 4, ch: 4, tilesMax: 384, romMB: 8 },
        gb: { exporter: true, name: 'Game Boy', oam: 40, perLine: 10, maxSprite: 16, colors: 4, ch: 4, tilesMax: 384, romMB: 8 },
        nes: { exporter: true, name: 'NES', oam: 64, perLine: 8, maxSprite: 16, colors: 4, ch: 5, tilesMax: 512, romMB: 1 },
        psx: { exporter: true, name: 'PlayStation', oam: 4000, perLine: 4000, maxSprite: 256, colors: 256, ch: 24, tilesMax: 9999, romMB: 700 },
        n64: { exporter: true, name: 'Nintendo 64', oam: 4000, perLine: 4000, maxSprite: 64, colors: 256, ch: 16, tilesMax: 9999, romMB: 64, tex: 'Each texture must fit the 4 KB texture memory (e.g. 32x32 at 16 colours)' },
        pc: { name: 'PC / Xbox controller page', oam: 9999, perLine: 9999, maxSprite: 512, colors: 99999, ch: 99, tilesMax: 99999, romMB: 99999, exporter: true }
    };
    /* what each engine exports to today (matches the real exporters in this kit) */
    const ROM = { race: ['ds', 'snes', 'gba', 'gbc', 'gb', 'nes', 'psx', 'n64', 'pc'], side2d: ['ds', 'snes', 'gba', 'gbc', 'gb', 'nes', 'psx', 'n64', 'pc'], world: ['ds', 'gba', 'gbc', 'gb', 'nes', 'psx', 'n64', 'pc'], fps: ['ds', 'psx', 'n64', 'pc'], skate: ['ds', 'gba', 'gbc', 'gb', 'nes', 'psx', 'n64', 'pc'], arcade3d: ['pc'], store3d: ['psx', 'n64', 'pc'], frontier3d: ['psx', 'n64'], arcadepc: ['pc'], arcade3dds: ['ds', 'psx', 'n64', 'pc'], puzzle: ['ds', 'pc'], fight: ['ds', 'pc'], arcade: ['ds', 'pc'], basketball: ['ds', 'snes', 'pc'], music: ['ds'] };
    const ARC3D = ['side3d', 'sandbox3d', 'warfare3d', 'store3d', 'frontier3d', 'life3d', 'rpg3d'], PCONLY = ['rail', 'baseball', 'combat'], key = t => t.engine === 'arcade' && t.kind === 'basketball' ? 'basketball' : t.engine === 'arcade' && PCONLY.includes(t.kind) ? 'arcadepc' : t.engine === 'arcade' && t.kind === 'sandbox3d' ? 'arcade3dds' : t.engine === 'arcade' && ARC3D.includes(t.kind) && t.kind !== 'life3d' ? (t.kind === 'store3d' ? 'store3d' : 'arcade3d') : t.engine;
    F.matrix = () => { const ids = Object.keys(F.CONSOLES); return Tpl.all().map(t => ({ id: t.id, name: t.name, family: t.family, cells: Object.fromEntries(ids.map(c => [c, (ROM[key(t)] || []).includes(c) ? (c === 'pc' ? 'pc' : 'rom') : 'planned'])) })); };
    F.supports = (genreId, con) => { const t = Tpl.all().find(x => x.id === genreId); return !!(t && (ROM[key(t)] || []).includes(con)); };
    F.consolesFor = genreId => { const t = Tpl.all().find(x => x.id === genreId); return t ? (ROM[key(t)] || []).slice() : []; };
    F.coverage = () => { const m = F.matrix(), ids = Object.keys(F.CONSOLES); return Object.fromEntries(ids.map(c => [c, m.filter(r => r.cells[c] !== 'planned').length])); };
    const objsNear = (L, win) => { let worst = 0, line = 0; const xs = (L.objects || []).filter(o => o.type !== 'start' && o.type !== 'goal'); xs.sort((a, b) => a.x - b.x); for (let i = 0, j = 0; i < xs.length; i++) { while (xs[i].x - xs[j].x > win) j++; worst = Math.max(worst, i - j + 1); const row = {}; for (let k = j; k <= i; k++) row[xs[k].y] = (row[xs[k].y] || 0) + 1; line = Math.max(line, ...Object.values(row)); } return { worst, line }; };
    F.check = (P, id) => {
        const C = F.CONSOLES[id], lines = [], fixes = []; let status = 'ok'; if (!C) return { status: 'fail', lines: ['Unknown console'], fixes: [] };
        const bump = s => { if (s === 'fail' || (s === 'warn' && status === 'ok')) status = s; };
        const eng = P.miniMode === 'race' ? 'race' : P.arcade ? (PCONLY.includes(P.arcade.mode) ? 'arcadepc' : ARC3D.includes(P.arcade.mode) ? (['sandbox3d', 'warfare3d', 'rpg3d'].includes(P.arcade.mode) ? 'arcade3dds' : P.arcade.mode === 'store3d' ? 'store3d' : P.arcade.mode === 'frontier3d' ? 'frontier3d' : 'arcade3d') : P.arcade.mode === 'basketball' ? 'basketball' : 'arcade') : P.puzzle && !(P.levels && P.levels.length) ? 'puzzle' : P.fight && !(P.levels && P.levels.length) ? 'fight' : P.world && P.world.maps && P.world.maps.length ? 'world' : 'side2d';
        if (!(ROM[eng] || []).includes(id)) { bump('fail'); lines.push(`There is no ${C.name} exporter for ${eng === 'side2d' ? 'platformer' : eng === 'arcade3d' ? '3D (life sim)' : eng === 'store3d' ? 'convenience store' : eng === 'frontier3d' ? 'frontier shooter' : eng === 'arcadepc' ? 'rail shooter / baseball / vehicle combat' : eng} games yet.`); fixes.push('Export for ' + (ROM[eng] || []).map(c => F.CONSOLES[c].name).join(' or ') + ' instead.'); } else lines.push(`${C.name} export exists for this kind of game.`);
        if (eng === 'side2d' && P.sprites) {
            for (const [k, s] of Object.entries(P.sprites)) if (s.w > C.maxSprite || s.h > C.maxSprite) { bump('fail'); lines.push(`Sprite "${k}" is ${s.w}x${s.h}, over the ${C.name} limit of ${C.maxSprite}.`); fixes.push(`Shrink "${k}" to ${C.maxSprite}px or build it from several sprites.`); }
            let worst = 0, line = 0; (P.levels || []).forEach(L => { const o = objsNear(L, 20); worst = Math.max(worst, o.worst); line = Math.max(line, o.line); });
            if (worst + 2 > C.oam * .9) { bump('warn'); lines.push(`Up to ${worst} things can be on screen at once (limit ${C.oam} sprites).`); fixes.push('Spread coins and enemies out.'); } else lines.push(`Busiest screen: ${worst} objects (limit ${C.oam}). OK.`);
            if (line > C.perLine) { bump('warn'); lines.push(`${line} sprites can share one row (limit ${C.perLine}): they would flicker.`); fixes.push('Stagger coins and enemies onto different rows.'); }
            const tiles = (P.tileset && P.tileset.cols || []).length; if (tiles > C.tilesMax) { bump('fail'); lines.push(`${tiles} tiles is over the ${C.name} limit of ${C.tilesMax}.`); }
            const songs = (P.songs || []).reduce((m, s) => Math.max(m, (s.ch || []).length), 0); if (songs > C.ch) { bump('fail'); lines.push(`Songs use ${songs} channels, ${C.name} has ${C.ch}.`); fixes.push('Merge music channels.'); } else if (songs) lines.push(`Music uses ${songs} channels (${C.name} has ${C.ch}). OK.`);
            const bytes = (P.levels || []).reduce((a, L) => a + L.w * L.h, 0) + (P.songs || []).reduce((a, s) => a + (s.ch || []).reduce((x, c) => x + c.length, 0), 0); const mb = bytes / 1048576; if (mb * 4 > C.romMB * .8 && C.romMB < 64) { bump('warn'); lines.push(`Level and music data is about ${(bytes / 1024).toFixed(0)} KB; this console's ROM is ${C.romMB} MB.`); } else lines.push(`Level and music data: about ${(bytes / 1024).toFixed(0)} KB. OK.`);
            if (C.colors <= 4) { bump('warn'); lines.push(`${C.name} has only ${C.colors} colours per palette: art will be reduced to ${C.colors}.`); fixes.push('Use the Graphics tab "Follow my graphics library" style for this console.'); }
        }
        if (C.tex && eng !== 'arcade' && eng !== 'arcade3d' && eng !== 'arcade3dds' && eng !== 'store3d' && eng !== 'frontier3d' && eng !== 'arcadepc') lines.push(C.tex + '.');
        return { status, lines, fixes, engine: eng };
    };
    F.report = P => {
        const L = P.levels || [], ph = (P.meta && P.meta.physics) || {}, run = ph.run || 1.25, out = { levels: [], warnings: [] };
        L.forEach((lv, i) => { const cnt = t => (lv.objects || []).filter(o => o.type === t).length, ene = cnt('walker') + cnt('hopper') + cnt('flyer'), hz = lv.map.filter(v => P.tileset.cols[v] === 3).length, pits = (() => { let n = 0, inP = false; for (let x = 0; x < lv.w; x++) { let g = false; for (let y = 0; y < lv.h; y++) if (P.tileset.cols[lv.map[y * lv.w + x]] === 1) { g = true; break; } if (!g && !inP) { n++; inP = true; } else if (g) inP = false; } return n; })();
            const secs = Math.round(lv.w * 16 / (run * 60 * 0.55)), per100 = Math.round((ene + hz + pits) * 100 / lv.w * 10) / 10; out.levels.push({ name: lv.name, width: lv.w, seconds: secs, enemies: ene, hazards: hz, pits, coins: cnt('coin'), checkpoints: cnt('check'), springs: cnt('spring'), danger: per100, finishable: NRKitCheck(P, i) }); });
        out.levels.forEach((l, i) => { if (!l.finishable) out.warnings.push(`"${l.name}" cannot be finished.`); if (l.seconds > 150) out.warnings.push(`"${l.name}" takes about ${l.seconds}s: players may get bored. Add checkpoints or shorten it.`); if (l.width > 80 && l.checkpoints === 0) out.warnings.push(`"${l.name}" has no checkpoint.`); if (i > 0 && l.danger + 1.5 < out.levels[i - 1].danger) out.warnings.push(`"${l.name}" is easier than the level before it.`); });
        if (out.levels.length > 1 && out.levels[out.levels.length - 1].danger <= out.levels[0].danger) out.warnings.push('The last level is not harder than the first.');
        return out;
    };
    function NRKitCheck(P, i) { const K = node ? require('./nrkit.js') : root.NRKit; return K.checkLevel(P, i).ok; }
    if (typeof module !== 'undefined') module.exports = F; else root.NRFit = F;
})(typeof window !== 'undefined' ? window : globalThis);

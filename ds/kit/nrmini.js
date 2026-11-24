/* nrmini.js (v1.3) - GB / GBC / NES / GBA platformer exporter. Turns a studio project into the data blob (and NES CHR) of the mini engine
 * (mini/src/game.c + one small HAL per console). Levels, physics, enemies, coins, checkpoints, springs, hearts and the goal all play;
 * tiles are 16x16 like every other target, art is quantised to what each console can show. Sound: music (first song, 2 pulse voices) + 5 effects. */
(function (root) {
'use strict';
const M = {}, node = typeof require === 'function' && typeof module !== 'undefined';
const NRK = () => node ? require('./nrkit.js') : root.NRKit;
M.CON = {
    gb:  { name: 'Game Boy / Color', SW: 20, SH: 18, ring: 32, ncol: 21, scrW: 160, scrH: 144, bgN: 4, sprN: 4, maxRows: 16, logoW: 80, logoH: 48, bgTiles: 255, sprCells: 63, blobMax: 16 * 1024, ext: 'gb' },
    nes: { name: 'NES', SW: 32, SH: 30, ring: 64, ncol: 33, scrW: 256, scrH: 240, bgN: 4, sprN: 4, maxRows: 15, logoW: 112, logoH: 72, bgTiles: 255, sprCells: 127, blobMax: 20000, ext: 'nes' },
    gba: { name: 'Game Boy Advance', SW: 30, SH: 20, ring: 64, ncol: 31, scrW: 240, scrH: 160, bgN: 16, sprN: 16, maxRows: 16, logoW: 128, logoH: 80, bgTiles: 255, sprCells: 127, blobMax: 60 * 1024, ext: 'gba' },
    n64: { name: 'Nintendo 64 (2D engine)', SW: 30, SH: 20, ring: 64, ncol: 31, scrW: 240, scrH: 160, bgN: 16, sprN: 16, maxRows: 16, logoW: 128, logoH: 80, bgTiles: 255, sprCells: 127, blobMax: 60 * 1024, ext: 'z64' },
    psx: { name: 'PlayStation (2D engine)', SW: 30, SH: 20, ring: 64, ncol: 31, scrW: 240, scrH: 160, bgN: 16, sprN: 16, maxRows: 16, logoW: 128, logoH: 80, bgTiles: 255, sprCells: 127, blobMax: 60 * 1024, ext: 'exe' }
};
M.MODES = { plat: 0, race: 1, rpg: 2, fight: 3, fps: 4 };
M.modeOf = P => M.MODES[P && P.miniMode] || 0;
M.TYPES = ['start', 'walker', 'hopper', 'flyer', 'coin', 'goal', 'spring', 'heart', 'check'];
const FRAMES = { hero: [0, 1, 2, 3], walker: [0, 1], hopper: [0, 1], flyer: [0, 1], coin: [0, 1], goal: [0, 1], spring: [0], heart: [0], check: [0] };
const SPRNAMES = ['start', 'walker', 'hopper', 'flyer', 'coin', 'goal', 'spring', 'heart', 'check', 'hero'];
const GROUPS = { nes: [[9], [1, 2, 3], [4, 5], [6, 7, 8]], gb: [[9], [1], [2], [3], [4], [5], [7], [6, 8]] };
const FONT_CH = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!.:-?';
const FONT = { A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110', C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110', E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000', G: '01110 10001 10000 10111 10001 10001 01110', H: '10001 10001 10001 11111 10001 10001 10001', I: '01110 00100 00100 00100 00100 00100 01110', J: '00111 00010 00010 00010 00010 10010 01100', K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111', M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 11001 10101 10011 10001 10001 10001', O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000', Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001', S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100', W: '10001 10001 10001 10101 10101 11011 10001', X: '10001 10001 01010 00100 01010 10001 10001', Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111', 0: '01110 10011 10101 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110', 2: '01110 10001 00001 00110 01000 10000 11111', 3: '11110 00001 00001 01110 00001 00001 11110', 4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110', 6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000', 8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100', '!': '00100 00100 00100 00100 00100 00000 00100', '.': '00000 00000 00000 00000 00000 00000 00100', ':': '00000 00100 00000 00000 00000 00100 00000', '-': '00000 00000 00000 11111 00000 00000 00000', '?': '01110 10001 00010 00100 00100 00000 00100', '/': '00001 00010 00010 00100 01000 01000 10000' };
const NESPAL = [[84,84,84],[0,30,116],[8,16,144],[48,0,136],[68,0,100],[92,0,48],[84,4,0],[60,24,0],[32,42,0],[8,58,0],[0,64,0],[0,60,0],[0,50,60],[0,0,0],[0,0,0],[0,0,0],[152,150,152],[8,76,196],[48,50,236],[92,30,228],[136,20,176],[160,20,100],[152,34,32],[120,60,0],[84,90,0],[40,114,0],[8,124,0],[0,118,40],[0,102,120],[0,0,0],[0,0,0],[0,0,0],[236,238,236],[76,154,236],[120,124,236],[176,98,236],[228,84,236],[236,88,180],[236,106,100],[212,136,32],[160,170,0],[116,196,0],[76,208,32],[56,204,108],[56,180,204],[60,60,60],[0,0,0],[0,0,0],[236,238,236],[168,204,236],[188,188,236],[212,178,236],[236,174,236],[236,174,212],[236,180,176],[228,196,144],[204,210,120],[180,222,120],[168,226,144],[152,226,180],[160,214,228],[160,162,160],[0,0,0],[0,0,0]];
const lum = c => c[0] * .3 + c[1] * .59 + c[2] * .11;
const rgb15 = c => (c[0] >> 3) | ((c[1] >> 3) << 5) | ((c[2] >> 3) << 10);
const nesIdx = c => { let b = 0x0F, bd = 1e9; NESPAL.forEach((p, i) => { if ((i & 15) > 12 && i !== 0x0F) return; const d = (p[0] - c[0]) ** 2 * 3 + (p[1] - c[1]) ** 2 * 4 + (p[2] - c[2]) ** 2 * 2; if (d < bd) { bd = d; b = i; } }); return b; };
function quant(pixels, n) {                       // pixels: [[r,g,b],...] -> up to n colours (median cut)
    const counts = new Map(); for (const p of pixels) { const k = rgb15(p); counts.set(k, (counts.get(k) || 0) + 1); }
    const pal = NRK()._q.medianCut(counts, n); return pal;
}
const nearest = (pal, p, from) => { let bi = from, bd = 1e12; for (let i = from; i < pal.length; i++) { const q = pal[i], d = (q[0] - p[0]) ** 2 * 3 + (q[1] - p[1]) ** 2 * 4 + (q[2] - p[2]) ** 2 * 2; if (d < bd) { bd = d; bi = i; } } return bi; };
function px(im, x, y) { const i = (y * im.w + x) * 4; return im.data[i + 3] < 128 ? null : [im.data[i], im.data[i + 1], im.data[i + 2]]; }
function scale(im, w, h) {                         // box-filter resize, keeps alpha
    const out = { w, h, data: new Uint8Array(w * h * 4) };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const x0 = Math.floor(x * im.w / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * im.w / w)), y0 = Math.floor(y * im.h / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * im.h / h)); let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * im.w + xx) * 4; r += im.data[i]; g += im.data[i + 1]; b += im.data[i + 2]; a += im.data[i + 3]; n++; }
        const o = (y * w + x) * 4; out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = a / n;
    }
    return out;
}
const enc = {
    nes: t => { const o = new Uint8Array(16); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = t[y * 8 + x]; if (v & 1) o[y] |= 0x80 >> x; if (v & 2) o[8 + y] |= 0x80 >> x; } return o; },
    gb: t => { const o = new Uint8Array(16); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = t[y * 8 + x]; if (v & 1) o[y * 2] |= 0x80 >> x; if (v & 2) o[y * 2 + 1] |= 0x80 >> x; } return o; },
    gba: t => { const o = new Uint8Array(32); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x += 2) o[y * 4 + (x >> 1)] = (t[y * 8 + x] & 15) | ((t[y * 8 + x + 1] & 15) << 4); return o; }
};
class TileSet { constructor() { this.list = []; this.map = new Map(); } add(t) { const k = t.join(','); let n = this.map.get(k); if (n === undefined) { n = this.list.length; this.list.push(t); this.map.set(k, n); } return n; } }
class W { constructor() { this.a = []; } u8(v) { this.a.push(v & 255); } u16(v) { this.u8(v); this.u8(v >> 8); } bytes(b) { for (const x of b) this.a.push(x & 255); } get len() { return this.a.length; } at(o, v) { this.a[o] = v & 255; this.a[o + 1] = (v >> 8) & 255; } }

/* ------------------------------------------------------------------ build */
M.build = (P, assets, con, logoImg) => {
    if (Array.isArray(P.timeline) && P.timeline.length) { const TL = typeof require === 'function' && typeof module !== 'undefined' ? require('./nrtimeline.js') : root.NRTimeline; if (TL && TL.validate(P, con).ok) P = TL.compileMini(P); }   // the Timeline orders levels / tracks and turns cutscene steps into the ROM's cutscene table
    const C0 = M.CON[con === 'gbc' ? 'gb' : con], C = (con === 'nes' && M.modeOf(P)) ? Object.assign({}, C0, { blobMax: 14000 }) : C0, isNes = con === 'nes', isGba = con === 'gba' || con === 'n64' || con === 'psx', warn = [], E = isNes ? enc.nes : isGba ? enc.gba : enc.gb;
    const mode = M.modeOf(P), MD = typeof require === 'function' && typeof module !== 'undefined' ? require('./nrmodes.js') : root.NRModes, RC = mode === 2 ? MD.rpgConfig(P) : null, rpgC = mode === 2 ? MD.rpgCompile(P, { maxRows: C.maxRows, textW: C.SW }) : null;
    const ovr = mode === 1 ? MD.raceSprites(P) : mode === 2 ? MD.rpgSprites(P) : null, FR = mode === 1 ? Object.assign({}, FRAMES, MD.RACE_FRAMES) : mode === 2 ? Object.assign({}, FRAMES, MD.rpgFrames(RC.species.length)) : FRAMES;
    const FCH = mode === 2 ? FONT_CH + '/' : FONT_CH;
    if (rpgC) rpgC.warnings.forEach(w => warn.push(w));
    const physics = (P.meta && P.meta.physics) || {}, ph = Object.assign({ gravity: .1875, jump: 5, jumpRun: 6.06, run: 1.25, runFast: 2.25, accel: .094, maxFall: 4 }, physics);
    const sky = P.snesBackdrop || (P.meta && P.meta.sky) || [100, 150, 220];
    /* ---- BG tiles: blank, font, logo, level metatiles ---- */
    const bg = new TileSet(); bg.add(new Uint8Array(64));
    const fontId = {};
    for (const ch of FCH) { if (ch === ' ') { fontId[ch] = 0; continue; } const rows = (FONT[ch] || FONT['?']).split(' '), t = new Uint8Array(64); rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '1') t[(y + 0) * 8 + x + 1] = 3; })); fontId[ch] = bg.add(t); }
    // level metatiles
    const ts = assets.img(P.tileset.image), nmt = Math.min(Math.floor(ts.w / 16), 64), tpx = [];
    for (let m = 0; m < nmt; m++) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const p = px(ts, m * 16 + x, y); if (p) tpx.push(p); }
    const gcols = quant(tpx, C.bgN - 1).sort((a, b) => lum(b) - lum(a)); while (gcols.length < C.bgN - 1) gcols.push([0, 0, 0]);
    const gpal = [sky, ...gcols];
    const meta = new Uint8Array(Math.max(1, nmt) * 4);
    const tiles8 = (im, ox, oy, pal, from) => { const t = new Uint8Array(64); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const p = px(im, ox + x, oy + y); t[y * 8 + x] = p ? nearest(pal, p, from) : 0; } return t; };
    const metaFirst = bg.list.length;
    for (let m = 0; m < nmt; m++) for (const [ox, oy] of [[0, 0], [8, 0], [0, 8], [8, 8]]) { const id = bg.add(tiles8(ts, m * 16 + ox, oy, gpal, 1)); meta[m * 4 + (oy ? 2 : 0) + (ox ? 1 : 0)] = id; }
    // logo (title palette = quantised logo, dark first)
    let lw = C.logoW, lh = C.logoH, logo, tpal, logoMap, logoCols, logoRows, bgSnap;
    const logoBase = { w: logoImg.w, h: logoImg.h, data: logoImg.data };
    for (let tries = 0; ; tries++) {
        const snapList = bg.list.length, snapMap = new Map(bg.map);
        logo = scale(logoBase, lw, Math.round(lw * logoBase.h / logoBase.w / 8) * 8 || 8); lh = logo.h; logoCols = lw / 8; logoRows = lh / 8;
        const lp = []; for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) { const p = px(logo, x, y); if (p) lp.push(p); }
        const lcols = quant(lp, C.bgN).sort((a, b) => lum(a) - lum(b)); while (lcols.length < C.bgN) lcols.push([255, 255, 255]);
        tpal = lcols; if (isNes || con !== 'gba') tpal[C.bgN - 1] = [255, 255, 255];
        logoMap = []; for (let r = 0; r < logoRows; r++) for (let c = 0; c < logoCols; c++) logoMap.push(bg.add(tiles8(logo, c * 8, r * 8, tpal, 0)));
        if (bg.list.length <= C.bgTiles || lw <= 32) break;
        bg.list.length = snapList; bg.map = snapMap; lw -= 16;                         // too many tiles: shrink the logo and retry
    }
    if (bg.list.length > C.bgTiles + 1) warn.push('background tiles over budget: ' + bg.list.length);
    /* ---- screens ---- */
    const text = (rows, s, r, tint) => { const t = s.toUpperCase().replace(/[^A-Z0-9 !.:\-?]/g, ' ').slice(0, C.SW), c0 = Math.floor((C.SW - t.length) / 2); [...t].forEach((ch, i) => { rows[r * C.SW + c0 + i] = fontId[ch] || 0; }); };
    const mkScreen = (lines, withLogo) => { const rows = new Uint8Array(C.SW * C.SH); if (withLogo) { const r0 = Math.max(1, Math.floor((C.SH - logoRows - 8) / 3)), c0 = Math.floor((C.SW - logoCols) / 2); for (let r = 0; r < logoRows; r++) for (let c = 0; c < logoCols; c++) rows[(r0 + r) * C.SW + c0 + c] = logoMap[r * logoCols + c]; lines.forEach(([s, off]) => text(rows, s, r0 + logoRows + off, 0)); } else lines.forEach(([s, r]) => text(rows, s, r, 0)); return rows; };
    const title = String((P.meta && P.meta.title) || 'MY GAME');
    const scr = [mkScreen([[title, 2], ['PRESS START', 5]], true), mkScreen([['YOU WIN!', Math.floor(C.SH / 2) - 2], ['THE END', Math.floor(C.SH / 2)]], false), mkScreen([['GAME OVER', Math.floor(C.SH / 2) - 1], ['PRESS START', Math.floor(C.SH / 2) + 2]], false)];
    /* ---- cutscenes: text screens (speaker + wrapped text), shown with START to advance ---- */
    const csList = [];
    for (const c of (P.cutscenes || []).filter(c => c && String(c.text || '').trim()).slice(0, 8)) {
        const clean = x => String(x || '').toUpperCase().replace(/[^A-Z0-9 !.:\-?]/g, ' ').replace(/\s+/g, ' ').trim(), W = C.SW - 4, words = clean(c.text).split(' '), lines = []; let cur = '';
        for (const w of words) { if ((cur + ' ' + w).trim().length > W && cur) { lines.push(cur); cur = w.slice(0, W); } else cur = (cur + ' ' + w).trim(); }
        if (cur) lines.push(cur);
        const maxL = C.SH - 8, sp = clean(c.speaker), out = []; let r = 2;
        if (sp) { out.push([sp.slice(0, W), r]); r += 2; }
        const stp = lines.length * 2 <= maxL - 2 ? 2 : 1; lines.slice(0, maxL).forEach(l => { out.push([l, r]); r += stp; }); out.push(['PRESS START', C.SH - 3]);
        const when = c.when === 'level' ? 1 : c.when === 'ending' ? 2 : 0; csList.push({ when, level: when === 1 ? Math.max(0, Math.min(255, c.level | 0)) : 0, idx: scr.length });
        scr.push(mkScreen(out, false));
    }
    /* ---- sprites ---- */
    const cells = [], cellMap = new Map(), sprDef = [];
    const spritePx = {}, groupsOf = isNes ? (mode === 2 ? [[9], [1, 3], [2], [4, 5, 6, 7, 8]] : GROUPS.nes) : isGba ? SPRNAMES.map((_, i) => [i]) : GROUPS.gb, groupPal = [];
    const sprImg = n => { if (ovr) return ovr[n] ? { s: ovr[n].s, im: ovr[n].im } : null; const s = P.sprites[n]; return s ? { s, im: assets.img(s.image) } : null; };
    const palOf = {}; groupsOf.forEach((g, gi) => g.forEach(t => { palOf[t] = gi; }));
    groupsOf.forEach(g => { const pp = []; for (const t of g) { const si = sprImg(SPRNAMES[t]); if (!si) continue; const { s, im } = si; for (const f of FR[SPRNAMES[t]]) { if (f >= s.frames) continue; for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const p = px(im, f * s.w + x, y); if (p) pp.push(p); } } } const q = quant(pp, C.sprN - 1).sort((a, b) => lum(b) - lum(a)); while (q.length < C.sprN - 1) q.push([0, 0, 0]); groupPal.push([[0, 0, 0], ...q]); });
    SPRNAMES.forEach((name, t) => {
        const si = sprImg(name), pal = groupPal[palOf[t]]; if (!si) { sprDef.push([0, 1, 1, palOf[t], 0]); return; }
        const { s, im } = si, cw = s.w / 8, ch = s.h / 16, frames = FR[name].filter(f => f < s.frames); let first = -1;
        for (const f of frames) for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
            const top = new Uint8Array(64), bot = new Uint8Array(64);
            for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { const p = px(im, f * s.w + cx * 8 + x, cy * 16 + y), v = p ? nearest(pal, p, 1) : 0; (y < 8 ? top : bot)[(y & 7) * 8 + x] = v; }
            const key = top.join(',') + '|' + bot.join(','); let id = cellMap.get(key);
            // frames must stay contiguous, so never share ids across cells
            id = cells.length; cells.push([top, bot]); if (first < 0) first = id;
        }
        sprDef.push([frames.length, cw, ch, palOf[t], first < 0 ? 0 : first]);
    });
    if (cells.length > C.sprCells) warn.push('sprite cells over budget: ' + cells.length + ' of ' + C.sprCells);
    /* ---- levels ---- */
    const lv = [], pri = { goal: 0, check: 1, walker: 2, hopper: 2, flyer: 2, spring: 3, heart: 4, coin: 5 };
    (mode === 2 ? rpgC.levels : (P.levels || [])).slice(0, 16).forEach((L, li) => {
        const rows = Math.min(L.h, C.maxRows), skip = L.h - rows, w = Math.min(L.w, 255), map = new Uint8Array(w * rows);
        if (skip) { for (let i = 0; i < skip * L.w; i++) if (L.map[i]) { warn.push(`level ${li + 1}: the top ${skip} row(s) are not empty; ${con.toUpperCase()} shows ${rows} rows, so they are cut`); break; } }
        for (let y = 0; y < rows; y++) for (let x = 0; x < w; x++) map[y * w + x] = Math.min(L.map[(y + skip) * L.w + x] || 0, Math.max(0, nmt - 1));
        let start = [1, 1], objs = [];
        for (const o of L.objects || []) { const t = M.TYPES.indexOf(o.type); if (t < 0) continue; if (t === 0) start = [o.x, o.y - skip]; else objs.push([t, o.x, o.y - skip, o.a | 0, o.b | 0, o.c | 0]); }
        objs.sort((a, b) => pri[M.TYPES[a[0]]] - pri[M.TYPES[b[0]]]); if (objs.length > 40) { warn.push(`level ${li + 1}: ${objs.length - 40} extra objects dropped (limit 40, coins first)`); objs = objs.slice(0, 40); }
        lv.push({ w, rows, start, objs, map, enc: L.enc });
    });
    /* ---- blob ---- */
    const b = new W(); b.bytes([...'NRMNDATA'].map(c => c.charCodeAt(0))); b.u8(lv.length); b.u8(Math.max(1, Math.min(9, (P.meta && P.meta.lives) || 3))); b.u8(nmt); b.u8(10);
    for (const v of [ph.gravity, ph.jump, ph.jumpRun, ph.run, ph.runFast, ph.maxFall, ph.accel]) b.u16(Math.round(v * 256)); b.u8(12); b.u8(28);
    const hdrOff = b.len; for (let i = 0; i < 24; i++) b.u8(0);                     // offsets patched below (28..51)
    const set = (o, v) => b.at(hdrOff + o - 28, v);
    set(28, b.len); for (let i = 0; i < Math.max(1, nmt); i++) b.u8((P.tileset.cols && P.tileset.cols[i]) || 0);
    set(30, b.len); b.bytes(meta);
    set(32, b.len); const tblAt = b.len; lv.forEach(() => b.u16(0));
    set(34, b.len); sprDef.forEach(d => { b.u8(d[0]); b.u8(d[1]); b.u8(d[2]); b.u8(d[3]); b.u16(d[4]); });
    set(36, b.len); const scrTbl = b.len; for (let i = 0; i < scr.length * 4; i++) b.u8(0);
    lv.forEach((L, i) => { b.at(tblAt + i * 2, b.len); b.u8(L.w); b.u8(L.rows); b.u8(L.start[0]); b.u8(L.start[1]); b.u8(L.objs.length); L.objs.forEach(o => { b.u8(o[0]); b.u8(o[1]); b.u8(o[2]); }); b.bytes(L.map); });
    scr.forEach((s, i) => { b.at(scrTbl + i * 4, b.len); b.at(scrTbl + i * 4 + 2, b.len); b.bytes(s); });
    // palettes + (GB/GBA) tile graphics
    let chr = null, palOff = 0, bgOff = 0, sprOff = 0;
    const bgT = bg.list.map(E), sprT = []; cells.forEach(c => { sprT.push(E(c[0]), E(c[1])); });
    if (isNes) {
        chr = new Uint8Array(8192); bgT.slice(0, 256).forEach((t, i) => chr.set(t, i * 16)); sprT.slice(0, 256).forEach((t, i) => chr.set(t, 4096 + i * 16));
        palOff = b.len; for (const pal of [gpal, tpal]) { b.u8(nesIdx(pal[0])); for (let i = 1; i < 4; i++) b.u8(nesIdx(pal[i])); } groupPal.forEach(g => { for (let i = 1; i < 4; i++) b.u8(nesIdx(g[i])); });
    } else {
        palOff = b.len; for (const pal of [gpal, tpal]) pal.forEach(c => b.u16(rgb15(c))); for (const g of groupPal) { b.u16(0); for (let i = 1; i < g.length; i++) b.u16(rgb15(g[i])); }
        bgOff = b.len; for (const t of bgT) b.bytes(t); sprOff = b.len; for (const t of sprT) b.bytes(t);
    }
    // extra header: 52..61 palette/tiles
    const ex = b.len; b.u16(palOff); b.u16(bgOff); b.u16(bgT.length); b.u16(sprOff); b.u16(sprT.length); const exAt = ex; set(48, exAt);   // 48 = pointer to extra header
    // ---- sound: the project's first song (two best melodic tracks, 2 voices) + five small effects; format read by game.c snd_tick
    b.u16(0); b.u16(0); b.u16(0);                                                  // extra header +14 = cutscene table; +10 music offset, +12 sfx table offset (patched below)
    const rc = Object.assign({ laps: 3, rivals: 3, rivalPct: 92, top: 3 }, P.race || {});    // +16 mode, +17 laps, +18 rivals, +19 rival speed %, +20 top speed 8.8
    const RSC = (con === 'gb' || con === 'gbc' || con === 'nes') ? 2 : 1;
    b.u8(mode); b.u8(rc.laps); b.u8(rc.rivals); b.u8(rc.rivalPct); b.u16(Math.round(rc.top * 256 * RSC)); b.u8((con === 'psx' || con === 'n64') && rc.view !== '2d' ? 1 : 0); b.u8(0); b.u16(0);      // +24 = RPG block
    const song = (P.songs || [])[0];
    if (song && song.ch && song.ch.length) {
        const chs = song.ch.map((n, i) => ({ i, n, c: n.filter(v => v > 0 && v < 128).length, noise: (song.inst && song.inst[i] === 'noise') })).filter(c => !c.noise && c.c > 0).sort((a, c) => c.c - a.c).slice(0, 2);
        if (chs.length) {
            const steps = Math.min(song.steps || chs[0].n.length, 128), enc = n => { const o = []; for (let i = 0; i < steps; i++) { const v = n[i]; o.push(v === 128 ? 255 : (v > 0 && v < 128) ? Math.max(24, Math.min(96, v)) : 0); } return o; };
            b.at(exAt + 10, b.len); b.u8(steps); b.u8(Math.max(1, Math.min(30, Math.round(song.tempo || 8)))); b.u8(chs.length > 1 ? 1 : 0); b.bytes(enc(chs[0].n)); if (chs.length > 1) b.bytes(enc(chs[1].n));
        }
    }
    if (csList.length) { b.at(exAt + 14, b.len); b.u8(csList.length); csList.forEach(c => { b.u8(c.when); b.u8(c.level); b.u8(c.idx); }); }
    const SFX = [[72, 76, 79], [88, 95, 95], [60, 55, 50, 45], [84, 88], [72, 76, 79, 84, 88, 91]];   // jump, coin, hurt, stomp, level clear
    b.at(exAt + 12, b.len); const sfxTbl = b.len; SFX.forEach(() => b.u16(0)); SFX.forEach((sf, i) => { b.at(sfxTbl + i * 2, b.len); b.u8(sf.length); b.bytes(sf); });
    if (mode === 2) {
        const sp = RC.species, str = [], sys = MD.RPG_SYS, enc = t => { const o = []; for (const ch of String(t).toUpperCase()) { if (ch === '\n') o.push(250); else if (ch === '\u0001') o.push(251); else o.push(Math.max(0, FCH.indexOf(ch))); } o.push(252); return o; };
        sys.forEach(t => str.push(enc(t))); sp.forEach(s => str.push(enc(String(s.name).slice(0, 10)))); rpgC.dialogs.forEach(t => str.push(enc(t)));
        const rb = b.len; b.at(exAt + 24, rb);
        b.u8(sp.length); b.u8(RC.catch ? 1 : 0); b.u8(RC.balls); b.u8(RC.potions); b.u8(RC.rate); b.u8(RC.startLevel); b.u8(Math.min(255, RC.gold)); b.u8(RC.potionPrice); b.u8(RC.ballPrice); b.u8(0);
        const hd = b.len; for (let i = 0; i < 4; i++) b.u16(0);
        b.at(hd - 0, b.len); for (let i = 0; i < FCH.length; i++) b.u8(i === 0 ? 0 : fontId[FCH[i]] || 0);
        b.at(hd + 2, b.len); sp.forEach(s => { b.u8(Math.min(120, s.hp)); b.u8(Math.min(60, s.atk)); b.u8(Math.min(60, s.def)); b.u8(Math.min(40, s.xp)); b.u8(0); });
        const stbl = b.len; b.at(hd + 4, stbl); str.forEach(() => b.u16(0)); str.forEach((s, i) => { b.at(stbl + i * 2, b.len); b.bytes(s); });
        const ltbl = b.len; b.at(hd + 6, ltbl); lv.forEach(() => b.u16(0));
        lv.forEach((L, i) => { b.at(ltbl + i * 2, b.len); const e = L.enc || { n: 0, sp: [], lo: 2, hi: 3 }; b.u8(e.n); for (let k = 0; k < 4; k++) b.u8(e.sp[k] || 0); b.u8(e.lo); b.u8(Math.max(e.lo, e.hi)); L.objs.forEach(o => { b.u8(o[3]); b.u8(o[4]); b.u8(o[5]); }); });
        if (str.length > 255) warn.push('too many text strings (' + str.length + ' of 255)');
        if (sp.length > 9) warn.push('only the first 9 monsters are used');
        if (!rpgC.levels.length) warn.push('no maps to export');
    }
    if (b.len > C.blobMax) warn.push(`game data is ${b.len} bytes; ${C.name} export has room for ${C.blobMax}. Use fewer or shorter levels.`);
    if (!(P.songs || []).length) warn.push('No song in the project: the game plays sound effects only. Add a song in the Music tab to get music.');
    else warn.push('Sound: the first song plays as music on two voices (lead + bass); jump, coin, hurt, stomp and level-clear effects share the second voice.');
    if (isNes) warn.push('NES: one background palette (4 colours) for the whole level, sprites use 4 palettes of 3 colours.');
    return { blob: Uint8Array.from(b.a), chr, mode, warnings: warn, stats: { bgTiles: bg.list.length, sprCells: cells.length, levels: lv.length, bytes: b.len, capacity: C.blobMax } };
};
M.find = (rom, magic = 'NRMNDATA') => { const m = [...magic].map(c => c.charCodeAt(0)); outer: for (let i = 0; i < rom.length - 8; i++) { for (let j = 0; j < 8; j++) if (rom[i + j] !== m[j]) continue outer; return i; } return -1; };
M.patch = (rom, built, con) => {
    const out = new Uint8Array(rom), at = M.find(out); if (at < 0) throw new Error('engine data marker not found');
    const cap = (con === 'nes' && built.mode) ? 14000 : M.CON[con === 'gbc' ? 'gb' : con].blobMax; if (built.blob.length > cap) throw new Error('game data too large for ' + con);
    out.set(built.blob, at);
    if (con === 'nes') { out[6] = (out[6] & 0xFE) | 1; if (built.chr) out.set(built.chr, out.length - 8192); }
    if (con === 'gb' || con === 'gbc') { out[0x143] = con === 'gbc' ? 0x80 : 0x00; let s = 0; for (let i = 0x134; i <= 0x14C; i++) s = (s - out[i] - 1) & 255; out[0x14D] = s; let g = 0; for (let i = 0; i < out.length; i++) if (i !== 0x14E && i !== 0x14F) g = (g + out[i]) & 0xFFFF; out[0x14E] = g >> 8; out[0x14F] = g & 255; }
    if (con === 'n64') { /* z64 big-endian ROM: the data blob sits in the ELF image; nothing else to fix (custom IPL3 does not verify a CRC) */ }
    if (con === 'gba') { let c = 0; for (let i = 0xA0; i <= 0xBC; i++) c = (c - out[i]) & 255; out[0xBD] = (c - 0x19) & 255; }
    return out;
};
if (typeof module !== 'undefined') module.exports = M; else root.NRMini = M;
})(typeof window !== 'undefined' ? window : globalThis);

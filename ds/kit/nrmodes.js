/* nrmodes.js (v1.12) - game modes for the small consoles (GB / GBC / NES / GBA / N64 / PSX): racing now; RPG and fighting next.
 * Everything here is data and art made in JS, so the same code runs in the editor and in node tests.
 *   Modes.carSheet(body, accent)   9 headings (0..180 degrees; the other half is the mirror) of a top-down car, 16x16 each
 *   Modes.raceSprites(P)           the sprite sheets the racing engine expects, in the platformer's sprite slots
 *   Modes.track(opts)              a closed circuit on a 16-row map: {w,h,map,objects} (road, kerbs, grass, walls, water, boosts)
 *   Modes.TILES                    tile numbers in the town tileset used for tracks */
(function (root) {
'use strict';
const Mo = {}, node = typeof require === 'function' && typeof module !== 'undefined';
const FONT = { 0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110', 2: '01110 10001 00001 00010 00100 01000 11111', 3: '11110 00001 00001 01110 00001 00001 11110', 4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110', 6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000', 8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100', P: '11110 10001 10001 11110 10000 10000 10000', L: '10000 10000 10000 10000 10000 10000 11111', '/': '00001 00010 00010 00100 01000 01000 10000' };
/* tile numbers in the Town tileset (library worldsets): 1 grass, 2 tall grass, 3 dirt, 4 road, 5 road line, 6 sidewalk, 7 water, 8 sand, 9 tree, 10 bush, 12 rock, 13 fence, 14 brick wall, 31 bridge */
Mo.TILES = { grass: 1, tall: 2, dirt: 3, road: 4, line: 5, kerb: 6, water: 7, sand: 8, tree: 9, bush: 10, rock: 12, fence: 13, wall: 14, bridge: 31 };
/* collision classes for racing: 0 road, 1 wall, 2 rough (slow), 3 water (back to the last checkpoint) */
Mo.raceCols = () => { const c = new Array(32).fill(0); [1, 2, 8, 11].forEach(i => { c[i] = 2; }); [7, 29].forEach(i => { c[i] = 3; }); [9, 10, 12, 13, 14, 15, 16, 18, 22, 23, 24, 26, 27, 28, 30].forEach(i => { c[i] = 1; }); return c; };
const px = (im, x, y, c, a) => { if (x < 0 || y < 0 || x >= im.w || y >= im.h) return; const i = (y * im.w + x) * 4; im.data[i] = c[0]; im.data[i + 1] = c[1]; im.data[i + 2] = c[2]; im.data[i + 3] = a === undefined ? 255 : a; };
const img = (w, h) => ({ w, h, data: new Uint8Array(w * h * 4) });
/* a top-down car facing up, drawn at 32x32 (rotated and shrunk to 16x16 by carSheet) */
function carBase(body, accent) {
    const g = img(32, 32), dark = body.map(v => v * .55 | 0), lite = body.map(v => Math.min(255, v * 1.3 + 30) | 0);
    const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(g, x, y, c); };
    rect(9, 5, 22, 27, body); rect(10, 3, 21, 4, body); rect(10, 28, 21, 29, body); rect(11, 2, 20, 2, dark); rect(11, 30, 20, 30, dark);
    rect(9, 6, 9, 26, dark); rect(22, 6, 22, 26, dark); rect(11, 7, 20, 8, lite);                       // hood highlight
    rect(12, 13, 19, 19, [30, 40, 70]); rect(13, 13, 18, 14, [120, 160, 210]);                           // windscreen / roof glass
    rect(11, 20, 20, 24, body.map(v => v * .8 | 0)); rect(15, 3, 16, 29, accent);                          // roof + racing stripe
    rect(6, 6, 8, 12, [15, 15, 15]); rect(23, 6, 25, 12, [15, 15, 15]); rect(6, 21, 8, 28, [15, 15, 15]); rect(23, 21, 25, 28, [15, 15, 15]);   // wheels
    rect(11, 3, 12, 4, [255, 240, 150]); rect(19, 3, 20, 4, [255, 240, 150]);                            // headlights
    return g;
}
Mo.carSheet = (body, accent) => {
    const base = carBase(body, accent || [250, 250, 250]), out = img(16 * 9, 16);
    for (let k = 0; k < 9; k++) {
        const a = k * Math.PI / 8, ca = Math.cos(a), sa = Math.sin(a);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            let r = 0, g = 0, b = 0, n = 0, hit = 0;
            for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
                const dx = (x + (sx + .5) / 3 - 8) * 2, dy = (y + (sy + .5) / 3 - 8) * 2, ux = dx * ca + dy * sa + 16, uy = -dx * sa + dy * ca + 16, ix = Math.floor(ux), iy = Math.floor(uy);
                n++; if (ix < 0 || iy < 0 || ix > 31 || iy > 31) continue; const i = (iy * 32 + ix) * 4; if (base.data[i + 3] < 128) continue; hit++; r += base.data[i]; g += base.data[i + 1]; b += base.data[i + 2];
            }
            if (hit * 2 >= n) px(out, k * 16 + x, y, [r / hit | 0, g / hit | 0, b / hit | 0]);
        }
    }
    return out;
};
const sheet = (frames, w, h) => ({ s: { w, h, frames }, im: img(w * frames, h) });
function digits() {
    const keys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'P', 'L', '/'], d = sheet(keys.length, 8, 16);
    keys.forEach((k, f) => { (FONT[k] || FONT['0']).split(' ').forEach((row, y) => [...row].forEach((c, x) => { if (c === '1') for (let yy = 0; yy < 2; yy++) { px(d.im, f * 8 + x + 1, y * 2 + 1 + yy, [255, 255, 255]); } })); });
    return d;
}
function boost() {
    const b = sheet(2, 16, 16);
    for (let f = 0; f < 2; f++) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const ch = Math.abs(x - 7.5) + (f ? y : 15 - y) * .5; const on = ((Math.floor(ch + 0) % 6) < 2) && Math.abs(x - 7.5) < 6 && y > 1 && y < 14; if (on) px(b.im, f * 16 + x, y, f ? [255, 230, 60] : [255, 150, 30]); else if (Math.abs(x - 7.5) < 7 && y > 0 && y < 15) px(b.im, f * 16 + x, y, [40, 40, 60], 255); }
    return b;
}
function flag() {
    const b = sheet(2, 16, 16);
    for (let f = 0; f < 2; f++) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const on = ((x >> 2) + (y >> 2) + f) % 2 === 0; px(b.im, f * 16 + x, y, on ? [250, 250, 250] : [20, 20, 20]); }
    return b;
}
const tint = (c, k) => c.map(v => Math.max(0, Math.min(255, v * k | 0)));
Mo.raceSprites = P => {
    const r = Object.assign({ car: [214, 40, 40], rival: [40, 90, 220] }, (P && P.race) || {}), pl = Mo.carSheet(r.car, [250, 250, 250]), rv = Mo.carSheet(r.rival, [250, 220, 60]);
    return { hero: { s: { w: 16, h: 16, frames: 9 }, im: pl }, walker: { s: { w: 16, h: 16, frames: 9 }, im: rv }, coin: boost(), goal: flag(), heart: digits() };
};
Mo.RACE_FRAMES = { hero: [0, 1, 2, 3, 4, 5, 6, 7, 8], walker: [0, 1, 2, 3, 4, 5, 6, 7, 8], coin: [0, 1], goal: [0, 1], heart: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
/* ---- circuit generator: a closed loop on a w x h tile map (h <= 16). Road is `width` tiles wide, with kerbs, grass, a fence/tree border,
   a few water puddles, checkpoints around the loop in order, a finish line, boost pads and rival grid slots. */
function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
Mo.track = (o = {}) => {
    const T = Mo.TILES, w = Math.max(30, Math.min(120, o.w || 56)), h = 16, rnd = rng(o.seed || 7), width = Math.max(2, Math.min(3, o.width || 3)), map = new Array(w * h).fill(T.grass);
    const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < w && y < h) map[y * w + x] = t; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) map[y * w + x] = (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? T.tree : (rnd() < .06 ? T.tall : T.grass);
    // centre line of the loop: a rounded rectangle with a kink on the top and bottom straights
    const m = 3, x0 = m + 1, x1 = w - m - 2, y0 = m, y1 = h - m - 1, pts = [], N = 4 * (x1 - x0 + y1 - y0);
    const kink = Math.floor(rnd() * 2) + 1, cx = (x0 + x1) / 2;
    const path = [];
    for (let x = x0; x <= x1; x++) path.push([x, y0 + (x > cx - 5 && x < cx + 5 ? kink : 0)]);
    for (let y = y0; y <= y1; y++) path.push([x1, y]);
    for (let x = x1; x >= x0; x--) path.push([x, y1 - (x > cx - 7 && x < cx + 7 ? kink : 0)]);
    for (let y = y1; y >= y0; y--) path.push([x0, y]);
    const paint = (x, y, r) => { for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (xx > 0 && yy > 0 && xx < w - 1 && yy < h - 1) set(xx, yy, T.road); };
    const r = width >> 1;
    path.forEach(([x, y]) => paint(x, y, r));
    // kerbs on the outside edge, sand run-off, then fence
    const isRoad = (x, y) => x > 0 && y > 0 && x < w - 1 && y < h - 1 && map[y * w + x] === T.road;
    const edge = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (map[y * w + x] !== T.road) { let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isRoad(x + dx, y + dy)) n++; if (n) edge.push([x, y]); }
    edge.forEach(([x, y]) => set(x, y, T.sand));
    // fence on the grass edge of the map border ring
    for (let x = 1; x < w - 1; x++) { set(x, 1, T.fence); set(x, h - 2, T.fence); } for (let y = 1; y < h - 1; y++) { set(1, y, T.fence); set(w - 2, y, T.fence); }
    // infield decoration: a pond and bushes
    const ix0 = x0 + 4, ix1 = x1 - 4, iy0 = y0 + 3, iy1 = y1 - 3;
    for (let y = iy0; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) { if (map[y * w + x] === T.grass || map[y * w + x] === T.tall) set(x, y, rnd() < .08 ? T.bush : T.grass); }
    for (let y = iy0 + 1; y < iy1; y++) for (let x = Math.floor(cx) - 4; x <= Math.floor(cx) + 4; x++) if (map[y * w + x] !== T.road && map[y * w + x] !== T.sand) set(x, y, T.water);
    // finish line: two columns of line tiles across the road on the first straight
    const fx = x0 + 6; for (let y = 0; y < h; y++) if (map[y * w + fx] === T.road) { set(fx, y, T.line); }
    // checkpoints spread along the path (skipping the start straight), in driving order
    const objs = [], per = Math.max(6, Math.floor(path.length / (o.checkpoints || 10)));
    for (let i = 0; i < path.length; i += per) { const [x, y] = path[i]; if (i < 8 || i > path.length - 6) continue; objs.push({ type: 'check', x, y }); }
    objs.push({ type: 'goal', x: fx, y: path[fx - x0][1] });
    const sy = path[fx - x0][1];
    objs.unshift({ type: 'start', x: fx - 2, y: sy });
    const rivals = Math.max(0, Math.min(3, o.rivals === undefined ? 3 : o.rivals));
    const slots = [[fx - 3, sy - 1], [fx - 3, sy + 1], [fx - 5, sy]]; for (let i = 0; i < rivals; i++) objs.push({ type: 'walker', x: slots[i][0], y: slots[i][1] });
    // boost pads on the straights
    [Math.floor(w * .45), Math.floor(w * .75)].forEach((x, i) => { const y = i ? y1 : y0 + (i ? 0 : 0); const yy = path.find(p => p[0] === x) ? path.find(p => p[0] === x)[1] : y; objs.push({ type: 'coin', x, y: yy }); });
    objs.sort((a, b) => 0);
    return { w, h, map, objects: objs, path };
};
/* a complete racing project for the small consoles: `base` supplies songs, sound effects and meta; tracks are made here */
Mo.TOWN = 'lib:styles/classic/town.png';
Mo.raceProject = (base, o = {}) => {
    const P = JSON.parse(JSON.stringify(base || {})), n = Math.max(1, Math.min(8, o.tracks || 3)), names = ['Lakeside Loop', 'Dusty Oval', 'Harbor Run', 'Pine Circuit', 'Cliff Sprint', 'Night Lap', 'Dune Dash', 'Grand Final'];
    P.miniMode = 'race'; P.genre = o.genre || 'racing'; P.preset = 'side2d';
    P.meta = Object.assign({}, P.meta, { title: String(o.title || 'Street Racers').slice(0, 30), lives: 3 });
    P.race = { laps: o.laps || 3, rivals: o.rivals === undefined ? 3 : o.rivals, rivalPct: o.rivalPct || 92, top: o.top || 3, car: o.car || [214, 40, 40], rival: o.rival || [40, 90, 220] };
    P.tileset = { image: o.tileset || Mo.TOWN, cols: Mo.raceCols(), names: ['Empty', 'Grass', 'Tall grass', 'Dirt path', 'Road', 'Road line', 'Kerb', 'Water', 'Sand', 'Tree', 'Bush', 'Flowers', 'Rock', 'Fence'] };
    P.levels = []; for (let i = 0; i < n; i++) { const t = Mo.track({ seed: (o.seed || 7) + i * 11, w: 48 + i * 6, rivals: P.race.rivals, width: 3, checkpoints: 9 + i }); P.levels.push({ name: names[i % names.length], w: t.w, h: t.h, map: t.map, objects: t.objects }); }
    return P;
};

/* ================================================================ RPG / monster collecting (mode 2)
 * Art: a walking hero + people, up to 9 creatures, a sign, a chest, a pickup and a healing pad, all 16x16, drawn here.
 * Data: Modes.rpgCompile(P) turns the project's World (top-down maps with people, doors, chests, wild monsters) into the mini engine's levels
 * plus dialog strings; Modes.rpgWorld(kind) builds a ready-made small-console world (town, house, route with tall grass, cave with a boss). */
Mo.RPG_SYS = ['WILD', 'APPEARED!', 'HIT FOR', 'CAUGHT IT!', 'IT BROKE FREE!', 'FAINTED!', 'YOU WON!', 'LEVEL UP!', 'GOT AWAY!', 'CANT ESCAPE!', 'NO BALLS LEFT', 'A FIGHT  B BALL', 'UP POTION  START RUN', 'LV', 'HP', 'YOU BLACKED OUT...', 'HEALED!', 'GOLD', 'POTION', 'BALL', 'SHOP', 'A POTION  B BALL', 'START LEAVE', 'NOT ENOUGH GOLD', 'YOU GOT', 'NO POTIONS', 'PARTY', 'GO!'];
Mo.SPECIES = [
    { name: 'SPROUTLE', shape: 'sprout', color: [92, 190, 84], hp: 18, atk: 5, def: 3, xp: 6 },
    { name: 'FLAMLET', shape: 'flame', color: [236, 120, 52], hp: 14, atk: 6, def: 2, xp: 8 },
    { name: 'DRIPPER', shape: 'drop', color: [70, 140, 232], hp: 16, atk: 4, def: 4, xp: 8 },
    { name: 'ZAPKIT', shape: 'bolt', color: [244, 208, 60], hp: 12, atk: 6, def: 2, xp: 9 },
    { name: 'ROCKPUP', shape: 'rock', color: [150, 150, 160], hp: 20, atk: 4, def: 6, xp: 10 },
    { name: 'GLOOMOTH', shape: 'wing', color: [150, 100, 200], hp: 13, atk: 5, def: 3, xp: 10 },
    { name: 'FUZZLING', shape: 'fluff', color: [240, 160, 190], hp: 15, atk: 3, def: 3, xp: 5 },
    { name: 'DRAKELET', shape: 'horn', color: [200, 60, 70], hp: 22, atk: 7, def: 5, xp: 16 },
];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function monsterArt(sp) {
    const g = img(16, 16), c = sp.color, dark = tint(c, .45), lite = mix(c, [255, 255, 255], .45), mid = tint(c, .8), S = sp.shape;
    const m = new Array(256).fill(0), col = new Array(256).fill(null);
    const put = (x, y, cc) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x > 15 || y > 15) return; m[y * 16 + x] = 1; col[y * 16 + x] = cc; };
    const ell = (cx, cy, rx, ry, cc, wob) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const a = Math.atan2(y - cy, x - cx), k = wob ? 1 + wob * Math.sin(a * 7) : 1; if (((x - cx) / (rx * k)) ** 2 + ((y - cy) / (ry * k)) ** 2 <= 1) put(x, y, typeof cc === 'function' ? cc(x, y) : cc); } };
    const tri = (x0, y0, x1, y1, x2, y2, cc) => { const mnx = Math.min(x0, x1, x2), mxx = Math.max(x0, x1, x2), mny = Math.min(y0, y1, y2), mxy = Math.max(y0, y1, y2); for (let y = mny; y <= mxy; y++) for (let x = mnx; x <= mxx; x++) { const d = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0), a = ((x1 - x) * (y2 - y) - (x2 - x) * (y1 - y)) / d, b = ((x2 - x) * (y0 - y) - (x0 - x) * (y2 - y)) / d, cc2 = 1 - a - b; if (a >= -.02 && b >= -.02 && cc2 >= -.02) put(x, y, cc); } };
    const body = (x, y) => (y > 9.5 && Math.abs(x - 7.5) < 3.6) ? lite : (y < 6 ? mid : c);
    if (S === 'wing') { ell(2.5, 7, 2.4, 3.8, lite); ell(13, 7, 2.4, 3.8, lite); }
    if (S === 'flame') { tri(11, 12, 15, 4, 14, 12, [255, 200, 60]); tri(12, 12, 15, 7, 14, 12, [255, 110, 40]); }
    if (S === 'horn') { tri(4, 5, 3, 0, 6, 4, [240, 230, 200]); tri(11, 5, 12, 0, 9, 4, [240, 230, 200]); tri(10, 13, 15, 12, 11, 15, dark); }
    if (S === 'bolt') { tri(3, 6, 2, 0, 7, 4, c); tri(12, 6, 13, 0, 8, 4, c); put(2, 0, [30, 30, 30]); put(13, 0, [30, 30, 30]); }
    if (S === 'drop') tri(8, 0, 3.5, 8, 12.5, 8, c);
    if (S === 'rock') { tri(3, 5, 4, 0, 6, 4, dark); tri(7, 4, 8, 0, 9, 3, dark); tri(10, 5, 12, 0, 12, 4, dark); }
    ell(7.5, 9.6, S === 'fluff' ? 6.4 : 5.6, S === 'fluff' ? 5.6 : 5, body, S === 'fluff' ? .09 : 0);
    if (S === 'sprout') { tri(8, 5, 7, 0, 9, 0, [60, 150, 60]); tri(9, 2, 14, 0, 12, 4, [120, 220, 100]); tri(7, 2, 2, 0, 4, 4, [120, 220, 100]); }
    if (S === 'bolt') { put(4, 11, [235, 70, 70]); put(11, 11, [235, 70, 70]); }
    if (S === 'rock') { put(6, 10, dark); put(7, 11, dark); put(9, 9, dark); }
    if (S === 'drop') put(6, 9, lite);
    // eyes
    const eye = (x, y) => { put(x, y, [255, 255, 255]); put(x + 1, y, [255, 255, 255]); put(x, y + 1, [255, 255, 255]); put(x + 1, y + 1, [20, 20, 30]); };
    eye(4, 7); eye(9, 7); put(7, 12, dark); put(8, 12, dark);
    // outline
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (!m[y * 16 + x]) { let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < 16 && yy < 16 && m[yy * 16 + xx]) n++; } if (n) px(g, x, y, [24, 22, 34]); }
    for (let i = 0; i < 256; i++) if (m[i]) px(g, i & 15, i >> 4, col[i]);
    return g;
}
/* a 16x16 person: dir 0 down, 1 up, 2 side (faces right); step 0/1 = walking pose */
function person(dir, step, o) {
    const g = img(16, 16), skin = o.skin || [244, 200, 160], hair = o.hair || [90, 60, 40], shirt = o.shirt || [60, 110, 200], pants = o.pants || [50, 60, 90], ol = [24, 22, 34];
    const r = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(g, x, y, c); };
    const legL = step ? 1 : 0, legR = step ? 0 : 1;
    if (dir === 2) {
        r(5, 9, 10, 13, shirt); r(6, 13 + (step ? 0 : 1) - 1, 8, 14 + (step ? 0 : 1), pants); r(8, 13 + (step ? 1 : 0) - 1, 10, 14 + (step ? 1 : 0), pants); r(7, 9, 9, 12, tint(shirt, .8));
        r(5, 2, 10, 8, skin); r(4, 1, 10, 4, hair); r(4, 2, 5, 7, hair); r(9, 5, 9, 5, ol); r(10, 6, 10, 6, tint(skin, .85));
    } else if (dir === 1) {
        r(4, 9, 11, 13, shirt); r(5, 13 + legL, 7, 14 + legL, pants); r(8, 13 + legR, 10, 14 + legR, pants);
        r(4, 2, 11, 8, hair); r(5, 8, 10, 9, skin);
    } else {
        r(4, 9, 11, 13, shirt); r(5, 13 + legL, 7, 14 + legL, pants); r(8, 13 + legR, 10, 14 + legR, pants); r(7, 9, 8, 13, tint(shirt, .85));
        r(4, 2, 11, 8, skin); r(4, 1, 11, 3, hair); r(4, 3, 4, 5, hair); r(11, 3, 11, 5, hair); r(5, 5, 6, 6, [255, 255, 255]); r(9, 5, 10, 6, [255, 255, 255]); px(g, 6, 6, ol); px(g, 9, 6, ol); px(g, 7, 8, tint(skin, .7)); px(g, 8, 8, tint(skin, .7));
    }
    // outline
    const out = img(16, 16); out.data.set(g.data);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (g.data[(y * 16 + x) * 4 + 3] < 128) { let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < 16 && yy < 16 && g.data[(yy * 16 + xx) * 4 + 3] >= 128) n++; } if (n) px(out, x, y, ol); }
    return out;
}
const joinH = (list) => { const o = img(16 * list.length, 16); list.forEach((im, k) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = (y * 16 + x) * 4, j = (y * (16 * list.length) + k * 16 + x) * 4; for (let q = 0; q < 4; q++) o.data[j + q] = im.data[i + q]; } }); return o; };
function simple(fn, frames) { const l = []; for (let f = 0; f < frames; f++) { const g = img(16, 16); fn(g, f); l.push(g); } return joinH(l); }
Mo.rpgSprites = P => {
    const R = Mo.rpgConfig(P), hero = R.hero, npc = R.npc, sp = R.species, out = {};
    const hf = [person(0, 0, hero), person(0, 1, hero), person(1, 0, hero), person(1, 1, hero), person(2, 0, hero), person(2, 1, hero)];
    out.hero = { s: { w: 16, h: 16, frames: 6 }, im: joinH(hf) };
    out.walker = { s: { w: 16, h: 16, frames: 2 }, im: joinH([person(0, 0, npc), person(0, 1, npc)]) };
    const arts = sp.slice(0, 9).map((s, i) => (i === 0 && !R.catch) ? person(0, 0, hero) : monsterArt(s));
    out.hopper = { s: { w: 16, h: 16, frames: arts.length }, im: joinH(arts) };
    const r4 = (g, x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(g, x, y, c); };
    out.flyer = { s: { w: 16, h: 16, frames: 1 }, im: simple(g => { r4(g, 7, 8, 8, 15, [110, 80, 50]); r4(g, 2, 2, 13, 8, [180, 135, 80]); r4(g, 2, 2, 13, 2, [220, 180, 120]); r4(g, 4, 4, 11, 4, [90, 60, 40]); r4(g, 4, 6, 9, 6, [90, 60, 40]); }, 1) };
    out.spring = { s: { w: 16, h: 16, frames: 1 }, im: simple(g => { r4(g, 2, 6, 13, 14, [150, 90, 40]); r4(g, 2, 4, 13, 7, [190, 120, 50]); r4(g, 2, 9, 13, 9, [70, 70, 80]); r4(g, 7, 8, 8, 11, [250, 220, 80]); for (let x = 2; x <= 13; x++) { px(g, x, 3, [24, 22, 34]); px(g, x, 15, [24, 22, 34]); } for (let y = 4; y <= 14; y++) { px(g, 1, y, [24, 22, 34]); px(g, 14, y, [24, 22, 34]); } }, 1) };
    out.coin = { s: { w: 16, h: 16, frames: 2 }, im: simple((g, f) => { const cy = 8 + f; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - cy); if (d <= 4.2) px(g, x, y, d > 3.2 ? [200, 140, 20] : [252, 214, 60]); } px(g, 6, cy - 1, [255, 250, 190]); px(g, 7, cy - 2, [255, 250, 190]); }, 2) };
    out.check = { s: { w: 16, h: 16, frames: 1 }, im: simple(g => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, (y - 8) * 1.5); if (d <= 7 && d > 5.5) px(g, x, y, [90, 220, 190]); else if (d <= 5.5) px(g, x, y, [210, 250, 240]); } r4(g, 7, 4, 8, 11, [220, 60, 80]); r4(g, 4, 7, 11, 8, [220, 60, 80]); }, 1) };
    return out;
};
Mo.rpgFrames = nsp => ({ hero: [0, 1, 2, 3, 4, 5], walker: [0, 1], hopper: Array.from({ length: Math.max(1, Math.min(9, nsp)) }, (_, i) => i), flyer: [0], coin: [0, 1], goal: [], spring: [0], heart: [], check: [0] });
Mo.rpgConfig = P => {
    const r = (P && P.rpg) || {}, catchOn = r.catch !== false, sp = (r.species && r.species.length ? r.species : (catchOn ? Mo.SPECIES : Mo.SPECIES.map((s, i) => i ? s : Object.assign({}, s, { name: (r.heroName || 'HERO').toUpperCase().slice(0, 8), hp: 22, atk: 6, def: 4 })))).slice(0, 9);
    if (!catchOn && !(r.species && r.species.length)) sp.forEach((s, i) => { if (i) s.name = ['SLIME', 'IMP', 'WISP', 'BAT', 'GOLEM', 'GHOST', 'SNAKE', 'OGRE'][i - 1] || s.name; });
    return { catch: catchOn, species: sp, hero: Object.assign({ skin: [244, 200, 160], hair: [90, 60, 40], shirt: [60, 110, 200], pants: [50, 60, 90] }, r.heroLook || {}), npc: Object.assign({ skin: [236, 190, 150], hair: [150, 110, 60], shirt: [200, 90, 90], pants: [70, 70, 90] }, r.npcLook || {}),
        balls: r.balls === undefined ? 5 : r.balls, potions: r.potions === undefined ? 3 : r.potions, rate: r.rate || 22, startLevel: r.startLevel || 5, gold: r.gold === undefined ? 30 : r.gold, potionPrice: r.potionPrice || 15, ballPrice: r.ballPrice || 20 };
};
/* collision classes for the Town tileset: 0 walk, 1 solid, 2 tall grass (encounters), 3 solid (water / lava) */
Mo.rpgCols = names => { const c = new Array(32).fill(0); const cols = [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 3, 1, 0]; cols.forEach((v, i) => { c[i] = v; }); c[2] = 2; c[7] = 3; return c; };
const wrapText = (t, W) => { const words = String(t).toUpperCase().replace(/[^A-Z0-9 !.:\-?\/\n]/g, ' ').split(/\n/), out = []; for (const para of words) { let cur = ''; for (const w of para.split(/ +/).filter(Boolean)) { if ((cur + ' ' + w).trim().length > W && cur) { out.push(cur); cur = w.slice(0, W); } else cur = (cur + ' ' + w).trim(); } out.push(cur); } return out; };
/* ---- world -> levels */
Mo.rpgCompile = (P, opt = {}) => {
    const R = Mo.rpgConfig(P), nsp = R.species.length, warn = [], world = P.world, maxRows = opt.maxRows || 16, strW = Math.max(12, (opt.textW || 20) - 4), dialogs = [];
    const first = Mo.RPG_SYS.length + nsp;
    const maps = ((world && world.maps) || []).filter(m => m.view !== 'side');
    if (!maps.length) return { levels: [], dialogs, warnings: ['This project has no top-down map. Open the World tab and build one (or start from an RPG template).'], species: R.species, cfg: R };
    if ((world.maps || []).length > maps.length) warn.push('Side-view maps are not part of the small-console RPG (' + ((world.maps || []).length - maps.length) + ' left out).');
    const idx = new Map(maps.slice(0, 16).map((m, i) => [m.id, i]));
    const addText = (name, text) => { const lines = wrapText((name ? name + ':\n' : '') + text, strW), pages = []; for (let i = 0; i < lines.length; i += 6) pages.push(lines.slice(i, i + 6)); const s = pages.map(p => p.join('\n')).join('\u0001'); const at = dialogs.indexOf(s); if (at >= 0) return first + at; dialogs.push(s); return first + dialogs.length - 1; };
    let foe = 0, tallSeen = 0; const levels = [], cut = [], y0s = [];
    maps.slice(0, 16).forEach((m, li) => {
        const h = Math.min(m.h, maxRows), w = Math.min(m.w, 255); let y0 = 0;
        if (m.h > maxRows) { const ys = m.entities.filter(e => e.t !== 'trigger').map(e => e.y); const mid = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : m.h / 2; y0 = Math.max(0, Math.min(m.h - maxRows, Math.round(mid - maxRows / 2))); cut.push(m.name); }
        y0s[li] = y0;
        const map = new Array(w * h).fill(0); let tall = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const t = m.ground[(y + y0) * m.w + x] || 0; map[y * w + x] = Math.min(t, 31); if (t === 2) tall++; }
        const objs = []; let start = null, dropped = 0;
        for (const e of m.entities) {
            const x = e.x, y = e.y - y0; if (x >= w || y < 0 || y >= h) { dropped++; continue; }
            const p = e.props || {}; let o = null;
            if (e.t === 'start') { start = { type: 'start', x, y }; continue; }
            if (e.t === 'npc') { const extra = (e.rules || []).filter(r => r.on === 'talk' && !r.if).flatMap(r => (r.actions || []).filter(a => a.do === 'say').map(a => a.text)), wins = (e.rules || []).some(r => (r.actions || []).some(a => a.do === 'win'));
                const txt = [String(p.lines || '').replace(/\n/g, ' ')].concat(extra).filter(Boolean).join(' ') || '...'; o = { type: 'walker', x, y, a: addText(String(p.name || '').toUpperCase().slice(0, 10), txt), b: 0, c: wins ? 2 : 0 }; }
            else if (e.t === 'shop') o = { type: 'walker', x, y, a: addText(String(p.name || 'SHOP').toUpperCase().slice(0, 10), 'Welcome! Take a look.'), b: 0, c: 1 };
            else if (e.t === 'sign') o = { type: 'flyer', x, y, a: addText('', p.text || 'Sign'), b: 0, c: 0 };
            else if (e.t === 'chest' || e.t === 'item') { const it = ((world.items || []).find(i => i.id === p.item)) || { kind: 'money', value: 1 }, n = Math.max(1, Math.min(99, +p.count || 1));
                const kind = it.kind === 'heal' ? 1 : it.kind === 'money' ? 0 : (R.catch ? 2 : 1), amt = kind === 0 ? Math.min(250, n * (it.value || 1) * (e.t === 'chest' ? 1 : 1)) : n; o = { type: e.t === 'chest' ? 'spring' : 'coin', x, y, a: amt, b: kind, c: 0 }; }
            else if (e.t === 'door') { const to = idx.get(p.toMap); if (to === undefined) { dropped++; continue; } o = { type: 'goal', x, y, a: to, b: Math.min(255, p.toX | 0), c: Math.min(15, p.toY | 0), toMap: to }; }
            else if (e.t === 'save') o = { type: 'check', x, y, a: 0, b: 0, c: 0 };
            else if (e.t === 'enemy') { const s = nsp > 1 ? 1 + (foe++ % (nsp - 1)) : 0; o = { type: 'hopper', x, y, a: s, b: Math.max(2, Math.min(40, 1 + li + (+p.hp || 2))), c: 0 }; }
            else dropped++;
            if (o) objs.push(o);
        }
        if (dropped) warn.push(m.name + ': ' + dropped + ' thing(s) have no small-console version (triggers, spawners, props, doors to side-view maps).');
        // doors that point into another map's cropped rows keep their coordinates: clamp later in the engine by the map size
        if (!start) { const d = objs.find(o => o.type === 'goal'); start = { type: 'start', x: d ? d.x : 1, y: d ? d.y : 1 }; }
        const enc = tall ? { n: Math.min(4, Math.max(1, nsp - 1)), sp: Array.from({ length: Math.min(4, Math.max(1, nsp - 1)) }, (_, k) => nsp > 1 ? 1 + ((k + li) % (nsp - 1)) : 0), lo: 2 + tallSeen * 2, hi: 4 + tallSeen * 2 } : { n: 0, sp: [], lo: 2, hi: 3 };
        if (tall) tallSeen++;
        levels.push({ name: m.name, w, h, map, objects: [start].concat(objs), enc });
    });
    // door targets are tile coordinates in the target map as designed; shift them into the cropped window of that map
    levels.forEach((L, li) => L.objects.forEach(o => { if (o.type === 'goal') { const ty0 = y0s[o.toMap] || 0; o.c = Math.max(0, Math.min(levels[o.toMap].h - 1, o.c - ty0)); o.b = Math.min(levels[o.toMap].w - 1, o.b); } }));
    if (cut.length) warn.push('These maps are taller than ' + maxRows + ' rows and were cropped around their things: ' + cut.join(', ') + '. Small consoles draw ' + maxRows + ' rows at most.');
    if (!tallSeen && nsp > 1) warn.push('No tall grass on any map, so there are no random encounters. Paint tall grass (tile 2) where wild monsters should appear.');
    if (dialogs.length + first > 250) warn.push('Too many different dialog lines for one game cartridge; later ones are dropped.');
    warn.push(R.catch ? 'Monster collecting: walk into wild monsters or tall grass to battle; A attacks, B throws a ball, Up drinks a potion, Start runs.' : 'RPG: walk into foes or tall grass to battle; A attacks, Up drinks a potion, Start runs.');
    warn.push('Quests with conditions are not supported on the small consoles: people say their lines, chests and pickups give gold, potions or balls.');
    return { levels, dialogs: dialogs.slice(0, 250 - first), warnings: warn, species: R.species, cfg: R };
};
/* ---- a ready-made small-console world: town, house, route, cave. kind: 'monster' | 'jrpg' | 'adventure' */
Mo.rpgWorld = (kind, o = {}) => {
    const W = (typeof require === 'function' && typeof module !== 'undefined') ? require('./nrworld.js') : root.NRWorld, T = 'classic_town';
    const world = W.newWorld(); world.player = { hp: 8, speed: 1.3, attack: 2 };
    const mk = (n, w, h, fill) => { const m = W.newMap(n, w, h, 'topdown', T); m.ground.fill(fill); return m; };
    const set = (m, x, y, t) => { if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.ground[y * m.w + x] = t; };
    const rect = (m, x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(m, x, y, t); };
    const border = (m, t, sides) => { for (let x = 0; x < m.w; x++) { set(m, x, 0, t); set(m, x, m.h - 1, t); } for (let y = 0; y < m.h; y++) { if (sides !== 'ns') { set(m, 0, y, t); set(m, m.w - 1, y, t); } } };
    const E = (m, t, x, y, props, rules) => { const e = W.entity(t, x, y); Object.assign(e.props, props || {}); e.rules = rules || []; m.entities.push(e); return e; };
    const monster = kind !== 'jrpg';
    const town = mk('Town', 36, 16, 1), house = mk('Home', 12, 10, 19), route = mk('Route 1', 56, 16, 1), cave = mk('Old Cave', 32, 16, 20);
    // town: street, three houses, pond, trees
    border(town, 9); rect(town, 1, 8, 34, 9, 4); for (let x = 1; x < 35; x += 3) set(town, x, 8, 5); rect(town, 1, 7, 34, 7, 6); rect(town, 1, 10, 34, 10, 6);
    [[3, 2, 15], [14, 2, 16], [25, 2, 15]].forEach(([hx, hy, rf], i) => { rect(town, hx, hy, hx + 6, hy + 1, rf); rect(town, hx, hy + 2, hx + 6, hy + 4, 14); set(town, hx + 3, hy + 4, 17); set(town, hx + 1, hy + 3, 18); set(town, hx + 5, hy + 3, 18); });
    rect(town, 4, 12, 9, 14, 7); for (const [x, y] of [[13, 12], [15, 13], [28, 13], [31, 12], [20, 12]]) set(town, x, y, 11); for (const [x, y] of [[12, 12], [22, 13], [33, 13], [10, 5], [22, 5]]) set(town, x, y, 9);
    set(town, 35, 8, 4); set(town, 35, 9, 4);
    // home interior
    border(house, 14); set(house, 5, 9, 17); set(house, 2, 1, 24); rect(house, 4, 4, 7, 6, 21); set(house, 9, 1, 23); set(house, 10, 1, 23);
    // route 1: tall grass patches, trees, a pond, a path
    border(route, 9); rect(route, 1, 7, 54, 8, 3); [[8, 2, 16, 6], [20, 9, 33, 14], [36, 2, 48, 6], [42, 10, 52, 14]].forEach(([a, b, c, d]) => rect(route, a, b, c, d, 2));
    rect(route, 24, 2, 29, 5, 7); for (let i = 0; i < 26; i++) set(route, 2 + (i * 7) % 52, 1 + (i * 5) % 14, i % 3 ? 10 : 11); rect(route, 1, 7, 54, 8, 3);
    // cave: floor, rock walls, a corridor
    border(cave, 30); rect(cave, 1, 1, 30, 3, 30); rect(cave, 1, 12, 30, 14, 30); rect(cave, 8, 4, 10, 8, 30); rect(cave, 16, 8, 18, 11, 30); rect(cave, 22, 4, 24, 7, 30); rect(cave, 27, 6, 29, 11, 21);
    // entities
    E(town, 'start', 17, 9); E(town, 'sign', 19, 6, { text: 'Welcome! ' + (monster ? 'Route 1 to the east has wild monsters in the tall grass.' : 'The cave to the east is full of foes.') });
    E(town, 'npc', 12, 10, { name: 'Mia', lines: monster ? 'Walk through tall grass to meet wild monsters. Press B to throw a ball when they are tired!' : 'Weak foes hide in the tall grass. Press Up to drink a potion in a fight.' });
    E(town, 'npc', 26, 10, { name: 'Old Tom', lines: 'The healing pad by the pond fixes everyone. Use it whenever you need.' });
    E(town, 'shop', 22, 6, { name: 'Shop', stock: 'potion:15' }); E(town, 'save', 7, 11, {});
    E(town, 'chest', 32, 11, { item: 'potion', count: 2 });
    E(town, 'door', 6, 5, { toMap: house.id, toX: 5, toY: 8 }); E(house, 'door', 5, 9, { toMap: town.id, toX: 6, toY: 6 });
    E(town, 'door', 35, 8, { toMap: route.id, toX: 1, toY: 7 }); E(town, 'door', 35, 9, { toMap: route.id, toX: 1, toY: 8 });
    E(house, 'npc', 6, 3, { name: 'Gran', lines: monster ? 'Take care out there. Catch monsters with balls and make a team!' : 'Come back safe, hero. The cave beyond Route 1 holds the Ogre.' });
    E(house, 'chest', 9, 6, { item: 'coin', count: 40 });
    E(route, 'door', 0, 7, { toMap: town.id, toX: 34, toY: 8 }); E(route, 'door', 0, 8, { toMap: town.id, toX: 34, toY: 9 });
    E(route, 'door', 55, 7, { toMap: cave.id, toX: 1, toY: 7 }); E(route, 'door', 55, 8, { toMap: cave.id, toX: 1, toY: 8 });
    E(route, 'sign', 3, 6, { text: 'Route 1. Tall grass ahead: wild monsters!' }); E(route, 'chest', 14, 12, { item: 'potion', count: 3 }); E(route, 'chest', 47, 8, { item: 'coin', count: 60 });
    for (const [x, y] of [[12, 4], [30, 11], [40, 4], [48, 12]]) E(route, 'enemy', x, y, { name: 'Wild', hp: 2 });
    E(route, 'npc', 22, 7, { name: 'Ranger', lines: 'The cave ahead is tough. Heal first and bring potions.' });
    E(cave, 'door', 0, 7, { toMap: route.id, toX: 54, toY: 7 }); E(cave, 'door', 0, 8, { toMap: route.id, toX: 54, toY: 8 });
    E(cave, 'save', 3, 8, {}); E(cave, 'chest', 14, 6, { item: 'potion', count: 3 });
    E(cave, 'enemy', 12, 7, { name: 'Guard', hp: 4 }); E(cave, 'enemy', 20, 7, { name: 'Guard', hp: 5 }); E(cave, 'enemy', 25, 9, { name: 'Boss', hp: 8 });
    E(cave, 'npc', 29, 5, { name: monster ? 'Champion' : 'King', lines: monster ? 'You made it! You are a true monster master. THE END.' : 'You beat the cave! The kingdom is safe. THE END.' }, [{ on: 'talk', actions: [{ do: 'win', text: 'THE END' }] }]);
    world.maps.push(town, house, route, cave); world.start = town.id;
    return world;
};
Mo.rpgProject = (base, o = {}) => {
    const P = JSON.parse(JSON.stringify(base || {})), kind = o.kind || 'monster';
    P.miniMode = 'rpg'; P.genre = o.genre || (kind === 'monster' ? 'monster_rpg' : kind === 'adventure' ? 'action_adventure' : 'jrpg'); P.preset = 'world';
    P.meta = Object.assign({}, P.meta, { title: String(o.title || (kind === 'monster' ? 'Monster Quest' : 'Hero Quest')).slice(0, 30), lives: 3 });
    P.rpg = Object.assign({ catch: kind === 'monster', balls: kind === 'monster' ? 5 : 0, potions: 3, rate: kind === 'adventure' ? 12 : 22, startLevel: 5, gold: 30 }, o.rpg || {});
    P.worldTilesets = Object.assign({}, P.worldTilesets, {});
    P.world = o.world || Mo.rpgWorld(kind, o); P.tileset = { image: Mo.TOWN, cols: Mo.rpgCols(), names: ['Empty', 'Grass', 'Tall grass', 'Dirt path', 'Road', 'Road line', 'Sidewalk', 'Water', 'Sand', 'Tree', 'Bush', 'Flowers', 'Rock', 'Fence', 'Brick wall', 'Red roof', 'Blue roof', 'Door', 'Window wall', 'Wood floor', 'Tile floor', 'Carpet', 'Counter', 'Shelf', 'Bed', 'Stairs', 'Lamp post', 'Sign post', 'Crate', 'Lava', 'Cliff', 'Bridge'] };
    P.levels = []; return P;
};

/* ================================================================ FIRST-PERSON SHOOTER (mode 4, PlayStation / Nintendo 64)
 * Mo.fpsMaze builds a maze with a few open rooms, enemies, pickups and an exit; Mo.fpsProject wraps levels into a project. */
Mo.fpsMaze = (o = {}) => {
    let s = (o.seed || 5) >>> 0 || 1; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const cw = o.cells || 14, ch = 7, w = cw * 2 + 1, h = ch * 2 + 1, WALL = Mo.TILES.wall, FLOOR = Mo.TILES.dirt, map = new Array(w * h).fill(WALL), seen = new Set();
    const open = (x, y) => { map[y * w + x] = FLOOR; };
    const stack = [[0, 0]]; seen.add('0,0'); open(1, 1);
    while (stack.length) {
        const [cx, cy] = stack[stack.length - 1], nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy, dx, dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < cw && y < ch && !seen.has(x + ',' + y));
        if (!nb.length) { stack.pop(); continue; }
        const [nx, ny, dx, dy] = nb[Math.floor(r() * nb.length)]; seen.add(nx + ',' + ny); open(nx * 2 + 1, ny * 2 + 1); open(cx * 2 + 1 + dx, cy * 2 + 1 + dy); stack.push([nx, ny]);
    }
    for (let i = 0; i < cw * 2; i++) { const x = 2 + Math.floor(r() * (w - 4)), y = 2 + Math.floor(r() * (h - 4)); if (map[y * w + x] === WALL && ((map[y * w + x - 1] === FLOOR && map[y * w + x + 1] === FLOOR) || (map[(y - 1) * w + x] === FLOOR && map[(y + 1) * w + x] === FLOOR))) open(x, y); }   // loops
    for (let k = 0; k < Math.max(1, Math.round(cw / 5)); k++) { const rx = 3 + Math.floor(r() * (w - 8)), ry = 3 + Math.floor(r() * (h - 7)); for (let y = ry; y < ry + 3; y++) for (let x = rx; x < rx + 3; x++) open(x, y); }   // rooms
    const cells = []; for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) cells.push([x * 2 + 1, y * 2 + 1]);
    const objs = [{ type: 'start', x: 1, y: 1 }, { type: 'goal', x: w - 2, y: h - 2 }];
    const far = cells.filter(([x, y]) => x + y > 8 && !(x === w - 2 && y === h - 2));
    const pick = () => far.splice(Math.floor(r() * far.length), 1)[0];
    const nE = o.enemies || 8; for (let i = 0; i < nE && far.length; i++) { const [x, y] = pick(); objs.push({ type: i % 5 === 4 ? 'hopper' : 'walker', x, y }); }
    for (let i = 0; i < 6 && far.length; i++) { const [x, y] = pick(); objs.push({ type: 'coin', x, y }); }
    for (let i = 0; i < 2 && far.length; i++) { const [x, y] = pick(); objs.push({ type: 'heart', x, y }); }
    return { w, h, map, objects: objs };
};
Mo.fpsProject = (base, o = {}) => {
    const P = JSON.parse(JSON.stringify(base || {})), n = Math.max(1, Math.min(8, o.levels || 3)), names = ['Entry Hall', 'Cellar Maze', 'Cold Storage', 'Power Room', 'Vent Run', 'Lab Block', 'Rooftop', 'Reactor'];
    P.miniMode = 'fps'; P.genre = o.genre || 'shooter_fps'; P.preset = 'side2d';
    P.meta = Object.assign({}, P.meta, { title: String(o.title || 'Corridor Ops').slice(0, 30), lives: 3 });
    P.tileset = { image: o.tileset || Mo.TOWN, cols: Mo.raceCols(), names: ['Empty', 'Grass', 'Tall grass', 'Dirt path', 'Road', 'Road line', 'Kerb', 'Water', 'Sand', 'Tree', 'Bush', 'Flowers', 'Rock', 'Fence', 'Brick wall'] };
    P.levels = []; for (let i = 0; i < n; i++) { const t = Mo.fpsMaze({ seed: (o.seed || 5) + i * 13, cells: 10 + i * 2, enemies: 5 + i * 2 }); P.levels.push({ name: names[i % names.length], w: t.w, h: t.h, map: t.map, objects: t.objects }); }
    return P;
};
if (typeof module !== 'undefined') module.exports = Mo; else root.NRModes = Mo;
})(typeof window !== 'undefined' ? window : globalThis);

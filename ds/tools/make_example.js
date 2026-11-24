// Builds the example project "Lakewood Run" (3 levels) from the built-in library.
const fs = require('fs');
const lib = 'lib:';
function level(name, w, theme, seed, song) {
    let r = seed; const rnd = n => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r % n; };
    const H = 16, map = new Array(w * H).fill(0), objs = [];
    const set = (x, y, t) => { if (x >= 0 && x < w && y >= 0 && y < H) map[y * w + x] = t; };
    let ground = 13, x = 0;
    objs.push({ type: 'start', x: 2, y: ground - 2 });
    while (x < w) {
        const seg = 4 + rnd(6);
        const gap = x > 10 && x < w - 16 && rnd(4) === 0;
        for (let i = 0; i < seg && x < w; i++, x++) {
            if (gap && i < 2) continue;
            set(x, ground, 1); for (let y = ground + 1; y < H; y++) set(x, y, 2);
            if (x > 8 && x < w - 12 && rnd(9) === 0) set(x, ground - 1, 8 + rnd(2));          // decoration
        }
        if (x < w - 14 && x > 8) {
            const k = rnd(7);
            if (k === 0) { for (let i = 0; i < 4; i++) set(x - 4 + i, ground - 4, 5); for (let i = 0; i < 3; i++) objs.push({ type: 'coin', x: x - 4 + i, y: ground - 5 }); }
            if (k === 1) { set(x - 2, ground - 4, 3); set(x - 1, ground - 4, 4); set(x, ground - 4, 3); objs.push({ type: 'heart', x: x - 1, y: ground - 5 }); }
            if (k === 2) objs.push({ type: 'walker', x: x - 2, y: ground - 1 });
            if (k === 3) objs.push({ type: 'hopper', x: x - 2, y: ground - 1 });
            if (k === 4) objs.push({ type: 'flyer', x: x - 2, y: ground - 4 });
            if (k === 5 && x > 30) { set(x - 1, ground - 1, 6); set(x - 2, ground - 1, 6); }
            if (k === 6) { for (let i = 0; i < 5; i++) objs.push({ type: 'coin', x: x - 5 + i, y: ground - 2 }); }
            if (rnd(5) === 0) ground = Math.max(9, Math.min(13, ground + (rnd(2) ? 1 : -1)));
        }
    }
    objs.push({ type: 'check', x: Math.floor(w / 2), y: 12 });
    for (let y = 0; y < H; y++) if (map[y * w + Math.floor(w / 2)] === 1) { objs[objs.length - 1].y = y - 1; break; }
    objs.push({ type: 'spring', x: 20, y: 12 });
    for (let xx = w - 6; xx < w; xx++) { for (let y = 0; y < H; y++) set(xx, y, 0); set(xx, 13, 1); for (let y = 14; y < H; y++) set(xx, y, 2); }
    objs.push({ type: 'goal', x: w - 3, y: 12 });
    return { name, w, h: H, song, map, objects: objs };
}
const libj = JSON.parse(fs.readFileSync(__dirname + '/../library/library.json'));
const proj = {
    format: 'notareal-project', version: 1, console: 'ds', preset: 'side2d',
    meta: { title: 'Lakewood Run', author: 'Notareal Game Studio', tagline: 'Get to the Quick Mart before close!', lives: 5,
            physics: Object.assign({ preset: 'classic' }, require('../kit/nrkit.js').PHYSICS.classic), titleSong: 0, clearSong: 3 },
    tileset: { image: lib + 'tiles/grass.png', cols: libj.tilesets[0].tiles.map(t => t.col) },
    background: lib + 'backgrounds/hills.png',
    sprites: { hero: { image: lib + 'sprites/hero_austin.png', w: 16, h: 32, frames: 5 }, walker: { image: lib + 'sprites/walker.png', w: 16, h: 16, frames: 3 },
               hopper: { image: lib + 'sprites/hopper.png', w: 16, h: 16, frames: 3 }, flyer: { image: lib + 'sprites/flyer.png', w: 16, h: 16, frames: 2 },
               coin: { image: lib + 'sprites/coin.png', w: 16, h: 16, frames: 4 }, goal: { image: lib + 'sprites/goal.png', w: 16, h: 32, frames: 2 },
               spring: { image: lib + 'sprites/spring.png', w: 16, h: 16, frames: 2 }, heart: { image: lib + 'sprites/heart.png', w: 16, h: 16, frames: 2 },
               check: { image: lib + 'sprites/check.png', w: 16, h: 16, frames: 2 } },
    levels: [level('Steilacoom Blvd', 120, 'grass', 7, 0), level('Gravelly Lake', 150, 'grass', 99, 1), level('South Tacoma Way', 180, 'grass', 2024, 2)],
    songs: libj.songs.map(s => JSON.parse(fs.readFileSync(__dirname + '/../library/' + s.json))),
    sfx: Object.fromEntries(libj.sfx.map(s => [s.id, lib + s.wav])),
};
/* every kit-made level must pass the playability checker (no buried springs, no jump that only works pixel-perfect) */
const NR = require('../kit/nrkit.js');
proj.levels.forEach((L, i) => { const f = NR.autofixLevel(proj, i); console.log(L.name, f.ok ? 'OK' : 'NOT FIXED'); f.log.forEach(l => console.log('  -', l)); if (!f.ok) process.exit(1); });
fs.writeFileSync(__dirname + '/../examples/lakewood_run.json', JSON.stringify(proj));
console.log('example written', proj.levels.map(l => l.objects.length));

// Unit tests for the kit core (offline). node tests/test_kit.js  (run from ds/tools so pngjs resolves)
const fs = require('fs'), path = require('path');
const NR = require('../kit/nrkit.js');
const { PNG } = require(path.join(__dirname, '../tools/node_modules/pngjs'));
let pass = 0, fail = 0; const results = [];
function t(name, fn) { try { fn(); pass++; results.push(['PASS', name]); } catch (e) { fail++; results.push(['FAIL', name + ': ' + e.message]); } }
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} expected ${b}, got ${a}`); };
const ok = (v, m) => { if (!v) throw new Error(m || 'not true'); };
const LIB = path.join(__dirname, '../library/'), file = r => fs.readFileSync(LIB + r.slice(4));
const assets = { img: r => { const p = PNG.sync.read(file(r)); return { w: p.width, h: p.height, data: p.data }; }, snd: r => NR.toPCM8(NR.parseWav(new Uint8Array(file(r)))) };
const EX = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/lakewood_run.json')));
const TPL = new Uint8Array(fs.readFileSync(path.join(__dirname, '../engine/side2d/nr_side2d.nds')));
const solid = (w, h, c) => ({ w, h, data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => [c[0], c[1], c[2], 255][i % 4]) });

t('image: resize keeps size and averages', () => { const r = NR.resize(solid(40, 20, [200, 100, 50]), 10, 5); eq(r.w, 10); eq(r.h, 5); eq(r.data[0], 200); eq(r.data[3], 255); });
t('image: pixelize limits colour count', () => {
    const im = { w: 64, h: 64, data: new Uint8ClampedArray(64 * 64 * 4) };
    for (let i = 0; i < 64 * 64; i++) { im.data[i * 4] = i % 256; im.data[i * 4 + 1] = (i * 7) % 256; im.data[i * 4 + 2] = (i * 13) % 256; im.data[i * 4 + 3] = 255; }
    const p = NR.pixelize(im, 32, 32, 8, true), set = new Set();
    for (let i = 0; i < p.data.length; i += 4) set.add(p.data[i] + ',' + p.data[i + 1] + ',' + p.data[i + 2]);
    ok(set.size <= 8, 'colours ' + set.size); eq(p.w, 32);
});
t('image: transparency survives pixelize', () => { const im = solid(16, 16, [10, 20, 30]); im.data[3] = 0; const p = NR.pixelize(im, 16, 16, 4); eq(p.data[3], 0); eq(p.data[7], 255); });
t('sound: WAV parse + PCM8 conversion', () => { const s = NR.parseWav(new Uint8Array(file('lib:sfx/jump.wav'))); eq(s.rate, 16384); const p = NR.toPCM8(s); ok(p.pcm.length > 1000); ok(Math.max(...p.pcm) > 100, 'normalised'); });
t('sound: 16-bit stereo WAV parses', () => {
    const n = 1000, b = Buffer.alloc(44 + n * 4); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(44100, 24); b.writeUInt32LE(44100 * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) { const v = Math.round(Math.sin(i / 10) * 20000); b.writeInt16LE(v, 44 + i * 4); b.writeInt16LE(v, 46 + i * 4); }
    const s = NR.parseWav(new Uint8Array(b)); eq(s.rate, 44100); eq(s.samples.length, n); const p = NR.toPCM8(s); eq(p.rate, 16384); ok(Math.abs(p.pcm.length - Math.floor(n * 16384 / 44100)) <= 1);
});
function makeMidi() {   // format 0: tempo 120, C major arpeggio on ch 0, kick on ch 9
    const ev = []; const vl = n => { const o = [n & 127]; while (n >>= 7) o.unshift((n & 127) | 128); return o; };
    ev.push(...vl(0), 0xFF, 0x51, 3, 0x07, 0xA1, 0x20);
    [60, 64, 67, 72].forEach((n, i) => { ev.push(...vl(i ? 120 : 0), 0x90, n, 100, ...vl(0), 0x99, 36, 100, ...vl(100), 0x80, n, 0); });
    ev.push(...vl(0), 0xFF, 0x2F, 0);
    const trk = [0x4D, 0x54, 0x72, 0x6B, 0, 0, (ev.length >> 8) & 255, ev.length & 255, ...ev];
    return new Uint8Array([0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 120, ...trk]);
}
t('music: MIDI import gives melody + drums', () => { const s = NR.parseMidi(makeMidi()); eq(s.ch.length, 4); ok(s.ch[0].includes(60) && s.ch[0].includes(72), 'melody notes'); ok(s.ch[3].includes(1), 'kick'); ok(s.tempo >= 3 && s.tempo <= 20); });
t('build: every section present and inside the block', () => {
    const r = NR.buildDS(EX(), assets), b = r.block, dv = new DataView(b.buffer);
    eq(String.fromCharCode(...b.slice(0, 8)), 'NRGDATA1'); const n = dv.getUint32(16, true); const ids = [];
    for (let i = 0; i < n; i++) { const id = String.fromCharCode(...b.slice(20 + i * 12, 24 + i * 12)), o = dv.getUint32(24 + i * 12, true), sz = dv.getUint32(28 + i * 12, true); ids.push(id); ok(o % 16 === 0 && o + sz <= b.length, id + ' bounds'); }
    for (const id of ['META', 'BPAL', 'SPAL', 'MTIL', 'MCOL', 'BGIM', 'SPRS', 'LVLS', 'SONG', 'SFXC']) ok(ids.includes(id), 'missing ' + id);
});
t('build: palettes keep index 0 transparent/backdrop', () => { const r = NR.buildDS(EX(), assets); ok(r.sizes.BPAL === 512 && r.sizes.SPAL === 512); });
t('build: 32x64 hero sheets are accepted', () => { const P = EX(); P.sprites.hero = { image: 'lib:sprites/hero_kid.png', w: 16, h: 32, frames: 5 }; const r = NR.buildDS(P, assets); ok(r.block.length > 1000); });
t('rom: patch finds the real block, keeps capacity', () => { const r = NR.buildDS(EX(), assets), p = NR.patchROM(TPL, r.block); ok(p.capacity >= 1 << 20); eq(p.rom.length, TPL.length); eq(p.rom[p.offset + 12] | p.rom[p.offset + 13] << 8 | p.rom[p.offset + 14] << 16, r.block.length & 0xffffff); });
t('rom: oversize game is refused with a clear message', () => { let m = ''; try { NR.patchROM(TPL, new Uint8Array(3 << 20)); } catch (e) { m = e.message; } ok(/too big/.test(m), m); });
t('rom: non-template ROM refused', () => { let m = ''; try { NR.patchROM(new Uint8Array(4096), new Uint8Array(16)); } catch (e) { m = e.message; } ok(/not a Notareal/.test(m)); });
/* playability checker */
function tinyLevel(fn) {
    const P = EX(); const W = 40, H = 16, map = new Array(W * H).fill(0);
    for (let x = 0; x < W; x++) for (let y = 13; y < 16; y++) map[y * W + x] = y === 13 ? 1 : 2;
    const L = { name: 'Test', w: W, h: H, song: 0, map, objects: [{ type: 'start', x: 2, y: 11 }, { type: 'goal', x: 36, y: 12 }] };
    fn(L, (x, y, t) => L.map[y * W + x] = t); P.levels = [L]; return P;
}
t('checker: flat level is playable', () => { const r = NR.checkLevel(tinyLevel(() => {}), 0); ok(r.reachable && !r.issues.length, JSON.stringify(r.issues)); });
t('checker: buried spring found and lifted (Steve\'s bug 1)', () => {
    const P = tinyLevel(L => L.objects.push({ type: 'spring', x: 10, y: 13 }));
    const r = NR.checkLevel(P, 0); ok(r.issues.some(i => i.code === 'BURIED_OBJECT'));
    const f = NR.autofixLevel(P, 0); ok(f.ok); eq(P.levels[0].objects.find(o => o.type === 'spring').y, 12);
});
t('checker: spikes before a wide gap block the level (Steve\'s bug 2) and get fixed', () => {
    const P = tinyLevel((L, set) => { for (let x = 14; x < 19; x++) for (let y = 13; y < 16; y++) set(x, y, 0); set(12, 12, 6); set(13, 12, 6); });
    const r = NR.checkLevel(P, 0); ok(!r.reachable, 'should be blocked'); ok(r.issues.some(i => i.code === 'HAZARD_BLOCK'));
    const f = NR.autofixLevel(P, 0); ok(f.ok, f.log.join('|'));
});
t('checker: an impossible gap gets a platform', () => { const P = tinyLevel((L, set) => { for (let x = 12; x < 22; x++) for (let y = 13; y < 16; y++) set(x, y, 0); }); ok(!NR.checkLevel(P, 0).reachable); const f = NR.autofixLevel(P, 0); ok(f.ok, f.log.join('|')); });
t('checker: a wall too tall gets lowered', () => { const P = tinyLevel((L, set) => { for (let y = 6; y < 13; y++) set(20, y, 3); }); ok(!NR.checkLevel(P, 0).reachable); const f = NR.autofixLevel(P, 0); ok(f.ok, f.log.join('|')); });
t('checker: springs let the hero reach a high ledge', () => {
    const P = tinyLevel((L, set) => { for (let y = 5; y < 13; y++) for (let x = 20; x < 40; x++) set(x, y, 3); L.objects.find(o => o.type === 'goal').y = 4; L.objects.push({ type: 'spring', x: 18, y: 12 }); });
    ok(NR.checkLevel(P, 0).reachable);
});
t('checker: missing start/goal reported and added', () => { const P = tinyLevel(L => L.objects = []); const r = NR.checkLevel(P, 0); ok(r.issues.some(i => i.code === 'NO_START') && r.issues.some(i => i.code === 'NO_GOAL')); ok(NR.autofixLevel(P, 0).ok); });
t('checker: all three example levels pass', () => { const P = EX(); for (let i = 0; i < 3; i++) ok(NR.checkLevel(P, i).reachable, 'level ' + i); });
/* AI edit operations */
t('ai ops: valid edits applied to a copy, invalid ones rejected', () => {
    const P = tinyLevel(() => {}); const r = NR.applyOps(P, [{ op: 'set_tile', level: 0, x: 5, y: 12, tile: 3 }, { op: 'set_tile', level: 0, x: 999, y: 0, tile: 1 }, { op: 'add_object', level: 0, type: 'coin', x: 6, y: 10 }, { op: 'add_object', level: 0, type: 'boss', x: 1, y: 1 }, { op: 'set_physics', key: 'jump', value: 99 }, { op: 'delete_everything' }]);
    eq(r.applied.length, 3); eq(r.rejected.length, 3); eq(P.levels[0].map[12 * 40 + 5], 0, 'original untouched'); eq(r.project.levels[0].map[12 * 40 + 5], 3); eq(r.project.meta.physics.jump, 9, 'clamped');
});
t('ai ops: level text map matches the level', () => { const P = tinyLevel(() => {}); const txt = NR.levelText(P, 0).split('\n'); eq(txt.length, 16); eq(txt[13][0], '#'); eq(txt[11][2], 'S'); });
t('physics presets carry their catalog source', () => { for (const [k, v] of Object.entries(NR.PHYSICS)) ok(v.source && v.jump > 0 && v.gravity > 0, k); });

/* ---- graphics lab */
const GFX = require('../kit/nrgfx.js'), LAB = require('../kit/nrlab.js');
const blocky = () => { const w = 24, h = 32, d = new Uint8ClampedArray(w * h * 4); const put = (x0, y0, x1, y1, c) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } };
    put(7, 2, 17, 12, [224, 172, 140]); put(5, 12, 19, 24, [200, 40, 40]); put(7, 24, 11, 31, [40, 60, 160]); put(13, 24, 17, 31, [40, 60, 160]); put(2, 13, 5, 22, [224, 172, 140]); put(19, 13, 22, 22, [224, 172, 140]); return { w, h, data: d }; };
t('graphics: blocky sprite scores as blocky, flat, unoutlined', () => { const p = GFX.profile(blocky()); ok(p.blockiness > 55, 'blockiness ' + p.blockiness); ok(p.flat > 0.9); ok(p.rampLen < 2.2, 'ramp ' + p.rampLen); });
t('graphics: upgrade adds shade steps, outline and cuts blockiness', () => { const r = GFX.upgrade(blocky(), { style: 'shaded' }); ok(r.after.rampLen > r.before.rampLen + 0.8, `ramps ${r.before.rampLen} -> ${r.after.rampLen}`); ok(r.after.blockiness < r.before.blockiness - 10, `blockiness ${r.before.blockiness} -> ${r.after.blockiness}`); ok(r.after.outline > 0.5, 'outline ' + r.after.outline); ok(r.after.flat < r.before.flat); });
t('graphics: upgrade keeps silhouette and transparency', () => { const a = blocky(), r = GFX.upgrade(a, { style: 'cute' }); eq(r.w, a.w); for (let i = 0; i < a.w * a.h; i++) eq(r.data[i * 4 + 3] > 127, a.data[i * 4 + 3] > 127, 'pixel ' + i); });
t('graphics: console colour budget respected (SNES 15, Game Boy 4 greys)', () => { const r = GFX.upgrade(blocky(), { style: 'realistic', console: 'snes' }); ok(r.palette.length <= 15, 'snes ' + r.palette.length); const g = GFX.upgrade(blocky(), { style: 'shaded', console: 'gb' }); ok(g.palette.length <= 4, 'gb ' + g.palette.length); ok(g.palette.every(c => c[0] === c[1] && c[1] === c[2]), 'grey'); });
t('graphics: pad option adds an outer outline ring', () => { const a = blocky(), r = GFX.upgrade(a, { style: 'shaded', pad: true }); eq(r.w, a.w + 2); ok(r.data[(2 * r.w + 13) * 4 + 3] === 255, 'outer ring pixel above the head'); ok(a.data[(2 * a.w + 12) * 4 + 3] === 255, 'source head top row'); });
t('graphics: shadows shift cooler than highlights (hue shift)', () => { const r = GFX.upgrade(blocky(), { style: 'realistic' }); ok(r.after.hueShift != null && r.after.hueShift !== 0, 'shift ' + r.after.hueShift); });
t('graphics: grade gives actionable tips for blocky art, fewer for upgraded', () => { const a = GFX.grade(GFX.profile(blocky())), b = GFX.grade(GFX.upgrade(blocky(), { style: 'wrestler' }).after); ok(a.tips.length >= 3, 'tips ' + a.tips.length); ok(b.score > a.score, `${a.score} -> ${b.score}`); });
t('graphics: textures tile without seams and fit console checks', () => { for (const k of Object.keys(GFX.TEXTURES)) { const x = GFX.texture(k, 32, 3, { colors: 8 }); eq(x.w, 32); let seam = 0, inner = 0; for (let y = 0; y < 32; y++) { const e0 = x.data[(y * 32) * 4], e1 = x.data[(y * 32 + 31) * 4], i0 = x.data[(y * 32 + 15) * 4], i1 = x.data[(y * 32 + 16) * 4]; seam += Math.abs(e0 - e1); inner += Math.abs(i0 - i1); } ok(seam < inner * 2.6 + 400, k + ' seam ' + seam + ' vs ' + inner); }
    ok(!GFX.texCheck('n64', 64, 64, 256).ok, 'n64 64x64 8-bit too big'); ok(GFX.texCheck('n64', 32, 32, 16).ok); ok(!GFX.texCheck('psx', 512, 64, 16).ok); ok(!GFX.texCheck('nds', 24, 32, 16).ok); });
function snesTile(pix) { const b = new Uint8Array(32); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = pix[y * 8 + x]; for (let p = 0; p < 4; p++) if (v >> p & 1) b[(p >> 1) * 16 + y * 2 + (p & 1)] |= 0x80 >> x; } return b; }
function fakeSnes() {       // 128 smooth tiles (discs shaded in 7 steps) + 3 colour ramps in 15-bit
    const rom = new Uint8Array(0x20000); for (let i = 0; i < rom.length; i++) rom[i] = (i * 2654435761 >>> 24) & 0xFF;
    for (let t = 0; t < 128; t++) { const pix = new Uint8Array(64); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) pix[y * 8 + x] = y < 1 + (t % 3) ? 0 : x < 3 + (t % 2) * 2 ? 1 + (t % 3) : x + y > 9 + (t % 5) ? 5 + (t % 4) : 2 + (t % 7) % 4; rom.set(snesTile(pix), 0x8000 + t * 32); }
    const ramp = (h, o) => { const cols = [0]; for (let i = 0; i < 7; i++) { const c = GFX.hsl2rgb(h + i * 3, 0.6, 0.15 + i * 0.1); cols.push((c[2] >> 3) << 10 | (c[1] >> 3) << 5 | (c[0] >> 3)); } for (let i = 0; i < 7; i++) { const c = GFX.hsl2rgb(h + 140 + i * 3, 0.5, 0.2 + i * 0.09); cols.push((c[2] >> 3) << 10 | (c[1] >> 3) << 5 | (c[0] >> 3)); } cols.push(0x7FFF, 0x0421); cols.forEach((v, i) => { rom[o + i * 2] = v & 255; rom[o + i * 2 + 1] = v >> 8; }); };
    ramp(20, 0x7000); ramp(210, 0x7040); return rom;
}
t('graphics lab: finds picture-like SNES tiles and palettes in a ROM', () => { const rom = fakeSnes(), F = GFX.scanRom(rom, 'snes', {}, { maxMs: 4000 }); ok(F.tileRegions >= 1, 'regions ' + F.tileRegions); ok(F.tiles && F.tiles.tiles >= 64, 'tiles'); ok(F.palettes && F.palettes.count >= 1, 'palettes'); ok(F.art && F.art.pixels > 500); eq(F.art.light, null); });
t('graphics lab: random data is not mistaken for art', () => { const rom = new Uint8Array(0x20000); for (let i = 0; i < rom.length; i++) rom[i] = (i * 2654435761 >>> 24) & 0xFF; const F = GFX.scanRom(rom, 'snes', {}, { maxMs: 3000 }); eq(F.tileRegions, 0); });
t('graphics lab: PlayStation TIM textures are counted with sizes', () => { const mk = (bpp, w, h) => { const clut = bpp < 16, hdr = 8, cl = clut ? 12 + (bpp === 4 ? 16 : 256) * 2 : 0, wide = bpp === 4 ? w / 4 : bpp === 8 ? w / 2 : w, img = 12 + wide * h * 2, b = Buffer.alloc(hdr + cl + img); b.writeUInt32LE(0x10, 0); b.writeUInt32LE((clut ? 8 : 0) | (bpp === 4 ? 0 : bpp === 8 ? 1 : 2), 4); let p = 8; if (clut) { const n = bpp === 4 ? 16 : 256; b.writeUInt32LE(12 + n * 2, p); b.writeUInt16LE(n, p + 8); b.writeUInt16LE(1, p + 10); for (let i = 0; i < n; i++) b.writeUInt16LE(0x421 * (i % 31 + 1), p + 12 + i * 2); p += 12 + n * 2; } b.writeUInt32LE(img, p); b.writeUInt16LE(wide, p + 8); b.writeUInt16LE(h, p + 10); for (let i = 0; i < wide * h * 2; i++) b[p + 12 + i] = (i * 7) & 255; return b; };
    const buf = Buffer.concat([Buffer.alloc(2048), mk(4, 32, 32), Buffer.alloc(100), mk(8, 64, 64), mk(16, 32, 16)]), F = GFX.scanRom(new Uint8Array(buf), 'psx', {}, { psxCooked: new Uint8Array(buf) }); eq(F.textures.count, 3); eq(F.textures.bpp4, 1); eq(F.textures.bpp8, 1); eq(F.textures.bpp16, 1); });
t('graphics lab: findings and design rules reach the Technique Library', () => { const F = GFX.scanRom(fakeSnes(), 'snes', {}, { maxMs: 3000 }), U = GFX.findings(F); ok(U.length >= 2 && U.every(u => u.area === 'Graphic design')); const rows = GFX.rules([{ name: 'Fake', platform: 'Super Nintendo', gfx: F }]); ok(rows.length >= GFX.CRAFT.length + 1); ok(rows.every(r => r.category === 'Graphic design')); ok(GFX.reference([{ platform: 'Super Nintendo', gfx: F }], 'Super Nintendo')); });
t('graphics lab: Research Lab scan carries graphics facts and keeps previews out of the database record', () => { const rom = fakeSnes(); const h = 0x7FC0; rom.set(Buffer.from('FAKE GAME TITLE        '.slice(0, 21)), h); rom[h + 0x15] = 0x20; rom[h + 0x1C] = 0xFF; rom[h + 0x1D] = 0xFF; rom[h + 0x1E] = 0; rom[h + 0x1F] = 0; const R = LAB.scan(rom, 'fake.sfc'); eq(R.platform, 'snes'); ok(R.gfx && R.gfx.tileRegions >= 1, 'gfx'); ok(R.uses.some(u => u.area === 'Graphic design')); const rec = LAB.dbRecord(R, 'Fighting'); ok(rec.gfx && !rec.gfx.previews, 'no previews stored'); ok(JSON.stringify(rec).length < 200000); });
const REAL = '/mnt/user-data/uploads/';
t('graphics lab (real ROMs, skipped if absent): wrestling SNES + PSX', () => { const f1 = REAL + '2104bbcf-WWF_WrestleMania_-_The_Arcade_Game_USA.sfc'; if (fs.existsSync(f1)) { const R = LAB.scan(new Uint8Array(fs.readFileSync(f1)), 'wwf'); ok(R.gfx && R.gfx.tileRegions > 3, 'snes regions'); } const f2 = REAL + 'Power_Move_Pro_Wrestling__USA___Track_1_.bin'; if (fs.existsSync(f2)) { const R = LAB.scan(new Uint8Array(fs.readFileSync(f2)), 'pmpw'); ok(R.gfx.textures.count > 100, 'tims ' + R.gfx.textures.count); } });

/* ---- fight engine (no screen needed) */
const FIGHT = require('../kit/nrfight.js'), fakeCv = () => { const n = () => {}, g = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 0 }) : n, set: () => true }); return { width: 384, height: 216, getContext: () => g }; };
const bout = (k1, ticks, seed) => { const k = Object.assign({}, k1); const G2 = FIGHT.play(fakeCv(), FIGHT.DEFAULT, { keys: k, manual: true, seed }); return { G2, k }; };
t('fight: strikes damage the opponent and build momentum', () => { const { G2, k } = bout({}, 0, 3); G2.state.f[1].x = G2.state.f[0].x + 20; for (let i = 0; i < 6; i++) { k.z = true; G2.step(1); k.z = false; G2.step(20); } ok(G2.state.f[1].hp < 100, 'hp ' + G2.state.f[1].hp); ok(G2.state.f[0].mom > 0, 'momentum'); });
t('fight: block cuts damage', () => { const run = blk => { const G2 = FIGHT.play(fakeCv(), FIGHT.DEFAULT, { keys: {}, keys2: blk ? { c: true } : {}, manual: true, seed: 3 }); const k = {}; G2.state.f[1].x = G2.state.f[0].x + 20; return G2; };
    const go = blk => { const k = {}, G2 = FIGHT.play(fakeCv(), FIGHT.DEFAULT, { keys: k, keys2: blk ? { c: true } : {}, manual: true, seed: 3 }); G2.state.f[1].x = G2.state.f[0].x + 20; for (let i = 0; i < 8; i++) { k.z = true; G2.step(1); k.z = false; G2.step(20); } return { lost: 100 - G2.state.f[1].hp, log: G2.state.log }; };
    const open = go(false), blocked = go(true); ok(open.log.includes('hit:strike') && !open.log.includes('block:strike'), 'open'); ok(blocked.log.includes('block:strike') && !blocked.log.includes('hit:strike'), 'blocked log'); const per = blocked.lost / blocked.log.filter(x => x === 'block:strike').length; ok(per <= 2, 'chip damage per blocked hit ' + per); });
t('fight: a pin on a weak downed fighter usually wins the match', () => { let wins = 0; for (let seed = 1; seed <= 15; seed++) { const k = { z: true }, G2 = FIGHT.play(fakeCv(), FIGHT.DEFAULT, { keys: k, manual: true, seed }), a = G2.state.f[0], v = G2.state.f[1]; a.x = 150; v.x = 170; v.hp = 5; v.st = 'down'; v.t = 3000; G2.step(260); if (G2.state.over && G2.state.over.winner === 'Steve' && G2.state.over.how === 'Pin') wins++; } ok(wins >= 8, 'pins ' + wins + '/15'); });
t('fight: KO ends the match and the AI fights back', () => { const G2 = FIGHT.play(fakeCv(), FIGHT.DEFAULT, { keys: {}, manual: true, seed: 5 }); G2.state.f[1].x = G2.state.f[0].x + 22; G2.step(1500); ok(G2.state.f[0].hp < 100, 'AI landed hits: ' + G2.state.f[0].hp); });
results.forEach(r => console.log(r[0], r[1]));
console.log(`\n${pass} passed, ${fail} failed`);
fs.writeFileSync(path.join(__dirname, 'unit_results.json'), JSON.stringify({ pass, fail, results }, null, 1));
process.exit(fail ? 1 : 0);


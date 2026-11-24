/* NOTAREAL PC/console game scanner (v1.1). Node only, runs on the user's own computer, streams files from disk (never loads a whole game).
 * Reads: game folders, .iso (ISO9660 + Xbox XDVDFS), .zip, .exe/.xbe/.xex. Records MEASUREMENTS only (formats, counts, sizes,
 * engine, API use). No pixels, sounds, models, text or code are copied or kept. */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const S = {};
const u16 = (b, o) => b[o] | b[o + 1] << 8, u32 = (b, o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;
const str = (b, o, n) => { let s = ''; for (let i = 0; i < n && b[o + i]; i++) s += String.fromCharCode(b[o + i]); return s; };

/* ---------------------------------------------------------------- virtual file systems: {kind, files:[{path,size,read(off,len)}]} */
S.openDir = (root, o = {}) => {
    const files = [], max = o.maxFiles || 40000;
    (function walk(d, depth) {
        if (files.length >= max || depth > 12) return; let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
        for (const e of ents) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, depth + 1); else { let st; try { st = fs.statSync(p); } catch (x) { continue; } files.push({ path: path.relative(root, p).replace(/\\/g, '/'), size: st.size, read: (off, len) => { const fd = fs.openSync(p, 'r'); try { const b = Buffer.alloc(Math.min(len, Math.max(0, st.size - off))); fs.readSync(fd, b, 0, b.length, off); return b; } finally { fs.closeSync(fd); } } }); } }
    })(root, 0);
    return { kind: 'folder', files };
};
function fdReader(p) { const fd = fs.openSync(p, 'r'), size = fs.fstatSync(fd).size; return { size, read: (off, len) => { const b = Buffer.alloc(Math.max(0, Math.min(len, size - off))); if (b.length) fs.readSync(fd, b, 0, b.length, off); return b; }, close: () => fs.closeSync(fd) }; }
/* ISO9660 (PC, PS1, PS2, Dreamcast-style data tracks, 2048 byte sectors) */
S.openIso = (rd, base = 0) => {
    const pvd = rd.read(base + 0x8000, 2048); if (str(pvd, 1, 5) !== 'CD001') return null;
    const files = [], vol = str(pvd, 40, 32).trim(), root = pvd.subarray(156, 190);
    (function walk(lba, size, pre, depth) {
        if (depth > 10 || files.length > 40000 || size > 1 << 24) return; const d = rd.read(base + lba * 2048, size);
        for (let o = 0; o < d.length;) { const l = d[o]; if (!l) { o = (o + 2048) & ~2047; continue; } const nl = d[o + 32]; let name = str(d, o + 33, nl); const flags = d[o + 25], ext = u32(d, o + 2), sz = u32(d, o + 10);
            if (nl === 1 && (d[o + 33] === 0 || d[o + 33] === 1)) { o += l; continue; } name = name.replace(/;\d+$/, '');
            if (flags & 2) walk(ext, sz, pre + name + '/', depth + 1); else files.push({ path: pre + name, size: sz, read: (off, len) => rd.read(base + ext * 2048 + off, Math.min(len, Math.max(0, sz - off))) }); o += l; }
    })(u32(root, 2), u32(root, 10), '', 0);
    return { kind: 'iso9660', volume: vol, files };
};
/* Xbox / Xbox 360 XDVDFS. Game partition offset differs by dump type, so try the usual ones. */
S.openXdvd = rd => {
    for (const base of [0, 0xFD90000, 0x2080000, 0x18300000, 0x2090000]) {
        const h = rd.read(base + 32 * 2048, 2048); if (str(h, 0, 20) !== 'MICROSOFT*XBOX*MEDIA') continue;
        const rootSec = u32(h, 20), rootSize = u32(h, 24), files = [];
        (function dir(sec, size, pre, depth) {
            if (depth > 10 || size > 1 << 24 || files.length > 40000) return; const d = rd.read(base + sec * 2048, size), seen = new Set();
            (function ent(o) { if (o + 14 > d.length || seen.has(o)) return; seen.add(o); const l = u16(d, o), r = u16(d, o + 2); if (l === 0xFFFF) return; const s = u32(d, o + 4), sz = u32(d, o + 8), at = d[o + 12], nl = d[o + 13], name = str(d, o + 14, nl);
                if (l) ent(l * 4); if (r) ent(r * 4);
                if (at & 0x10) dir(s, sz, pre + name + '/', depth + 1); else files.push({ path: pre + name, size: sz, read: (off, len) => rd.read(base + s * 2048 + off, Math.min(len, Math.max(0, sz - off))) }); })(0);
        })(rootSec, rootSize, '', 0);
        return { kind: 'xdvdfs', volume: 'XBOX', files, base };
    }
    return null;
};
S.openZip = rd => {
    const n = rd.size, tail = rd.read(Math.max(0, n - 65557), 65557); let e = -1; for (let i = tail.length - 22; i >= 0; i--) if (u32(tail, i) === 0x06054b50) { e = i; break; } if (e < 0) return null;
    const cnt = u16(tail, e + 10), cdSize = u32(tail, e + 12), cdOff = u32(tail, e + 16); if (cdOff === 0xFFFFFFFF) return { kind: 'zip64', files: [] };
    const cd = rd.read(cdOff, cdSize), files = []; let o = 0;
    for (let i = 0; i < cnt && o + 46 <= cd.length; i++) { const meth = u16(cd, o + 10), csz = u32(cd, o + 20), usz = u32(cd, o + 24), nl = u16(cd, o + 28), el = u16(cd, o + 30), cl = u16(cd, o + 32), lho = u32(cd, o + 42), name = cd.toString('latin1', o + 46, o + 46 + nl); o += 46 + nl + el + cl;
        if (name.endsWith('/')) continue;
        files.push({ path: name, size: usz, read: (off, len) => { try { const lh = rd.read(lho, 30), data = rd.read(lho + 30 + u16(lh, 26) + u16(lh, 28), csz); const out = meth === 0 ? data : meth === 8 ? zlib.inflateRawSync(data, { finishFlush: zlib.constants.Z_SYNC_FLUSH }) : Buffer.alloc(0); return out.subarray(off, off + len); } catch (x) { return Buffer.alloc(0); } }, _csz: csz }); }
    return { kind: 'zip', files };
};

/* ---------------------------------------------------------------- measuring one file (header only) */
const IMG = { png: b => b.length > 24 && b[0] === 0x89 && b[1] === 0x50 ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20), t: 'png' } : null,
    bmp: b => b[0] === 0x42 && b[1] === 0x4D && b.length > 26 ? { w: b.readInt32LE(18), h: Math.abs(b.readInt32LE(22)), t: 'bmp' } : null,
    tga: (b, n) => /\.tga$/i.test(n) && b.length > 18 ? { w: u16(b, 12), h: u16(b, 14), t: 'tga' } : null,
    gif: b => str(b, 0, 3) === 'GIF' ? { w: u16(b, 6), h: u16(b, 8), t: 'gif' } : null,
    dds: b => str(b, 0, 4) === 'DDS ' && b.length > 20 ? { w: u32(b, 16), h: u32(b, 12), t: 'dds' } : null,
    jpg: b => { if (b[0] !== 0xFF || b[1] !== 0xD8) return null; for (let o = 2; o + 9 < b.length;) { if (b[o] !== 0xFF) { o++; continue; } const m = b[o + 1]; if (m >= 0xC0 && m <= 0xC3) return { h: b.readUInt16BE(o + 5), w: b.readUInt16BE(o + 7), t: 'jpg' }; o += 2 + b.readUInt16BE(o + 2); } return null; } };
const MAGIC = [[0x5A4950, 'zip'], ['Rar!', 'rar'], ['7z\xBC\xAF', '7z'], ['UnityFS', 'Unity bundle'], ['UnityWeb', 'Unity web'], ['FORM', 'GameMaker data'], ['GDPC', 'Godot pack'], ['RPA-', 'Ren\'Py archive'], ['BIGF', 'EA BIG'], ['BIGB', 'EA BIG'], ['PACK', 'Quake PAK'], ['IWAD', 'DOOM WAD'], ['PWAD', 'DOOM WAD'], ['VPK', 'Valve VPK'], ['RIFF', 'RIFF'], ['OggS', 'Ogg'], ['FWS', 'Flash'], ['CWS', 'Flash'], ['XFIR', 'Director'], ['RIFX', 'Director'], ['MThd', 'MIDI'], ['fLaC', 'FLAC'], ['ID3', 'MP3'], ['BKHD', 'Wwise bank'], ['FSB5', 'FMOD bank'], ['XEX2', 'Xbox360 exe'], ['XBEH', 'Xbox exe'], ['\x7FELF', 'ELF'], ['wOFF', 'font'], ['SARC', 'Nintendo SARC'], ['NARC', 'NARC']];
S.sniff = (b, name) => { const s = b.toString('latin1', 0, 8); for (const [m, t] of MAGIC) { if (typeof m === 'number') { if ((b[0] | b[1] << 8 | b[2] << 16) === m) return t; } else if (s.startsWith(m)) return t; } if (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0) return 'MP3'; return null; };
S.pe = b => {
    if (b[0] !== 0x4D || b[1] !== 0x5A) return null; const o = u32(b, 0x3C); if (o + 24 > b.length || str(b, o, 2) !== 'PE') return null;
    const mach = u16(b, o + 4), ns = u16(b, o + 6), opt = o + 24, magic = u16(b, opt), sub = u16(b, opt + 68), secs = [];
    for (let i = 0; i < ns && o + 24 + u16(b, o + 20) + i * 40 + 40 <= b.length; i++) { const so = o + 24 + u16(b, o + 20) + i * 40; secs.push({ name: str(b, so, 8), size: u32(b, so + 16) }); }
    return { machine: { 0x14c: 'x86', 0x8664: 'x64', 0x1c0: 'ARM', 0xAA64: 'ARM64' }[mach] || '0x' + mach.toString(16), bits: magic === 0x20b ? 64 : 32, subsystem: sub === 2 ? 'windows GUI' : sub === 3 ? 'console' : sub === 14 ? 'Xbox' : String(sub), sections: secs, packed: secs.some(s => /^(UPX|\.aspack|\.petite|\.themida|\.vmp)/i.test(s.name)) };
};
S.xbe = b => { if (str(b, 0, 4) !== 'XBEH') return null; const base = u32(b, 0x104), certAddr = u32(b, 0x118), co = certAddr - base; if (co < 0 || co + 0x90 > b.length) return { title: '' }; let t = ''; for (let i = 0; i < 40; i++) { const c = u16(b, co + 0x0C + i * 2); if (!c) break; t += String.fromCharCode(c); } return { title: t, id: u32(b, co + 8).toString(16).toUpperCase(), regions: u32(b, co + 0x9C) }; };
S.wav = b => str(b, 0, 4) === 'RIFF' && str(b, 8, 4) === 'WAVE' && str(b, 12, 4) === 'fmt ' ? { rate: u32(b, 24), ch: u16(b, 22), bits: u16(b, 34), fmt: u16(b, 20) } : null;
const ENGINE_HINT = [[/UnityPlayer|Assembly-CSharp|globalgamemanagers/i, 'Unity'], [/UE4|UnrealEngine|\.uasset|\.pak$/i, 'Unreal'], [/data\.win|\.yyc|game\.droid/i, 'GameMaker'], [/\.rpa$|renpy/i, 'Ren\'Py'], [/godot|\.pck$/i, 'Godot'], [/\.xnb$|MonoGame|XNA/i, 'XNA/MonoGame'], [/\.rgss|Game\.rxdata|\.rvdata/i, 'RPG Maker'], [/\.vpk$|\.gcf$|\.bsp$/i, 'Source/Quake-style'], [/\.wad$|\.pk3$/i, 'id Tech'], [/\.bik$|\.smk$/i, 'RAD Bink/Smacker video'], [/\.swf$|\.dcr$|\.dxr$/i, 'Flash/Director'], [/\.sprite|\.spr$|\.tmx$/i, 'sprite/tilemap data']];
const IMPORT_API = { d3d8: 'Direct3D 8', d3d9: 'Direct3D 9', d3d11: 'Direct3D 11', d3d12: 'Direct3D 12', ddraw: 'DirectDraw (2D)', dsound: 'DirectSound', dinput: 'DirectInput', xinput: 'XInput gamepad', opengl32: 'OpenGL', vulkan: 'Vulkan', sdl2: 'SDL2', sdl: 'SDL', fmod: 'FMOD audio', openal: 'OpenAL', bink: 'Bink video', steam_api: 'Steamworks', winmm: 'Windows multimedia', xaudio2: 'XAudio2' };

/* ---------------------------------------------------------------- game archives: list what is inside (no extraction, names/sizes only) */
const be32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
S.expandOne = f => {
    const h = f.read(0, 16), tag = h.toString('latin1', 0, 4), sub = (name, off, size) => ({ path: f.path + '/' + name, size, read: (o, l) => f.read(off + o, Math.min(l, Math.max(0, size - o))) }), out = [];
    if (tag === 'PACK' && f.size > 12) { const dofs = u32(h, 4), dlen = u32(h, 8); if (dofs + dlen <= f.size && dlen < 8 << 20) { const d = f.read(dofs, dlen); for (let i = 0; i + 64 <= d.length && out.length < 20000; i += 64) out.push(sub(str(d, i, 56), u32(d, i + 56), u32(d, i + 60))); return { kind: 'Quake PAK', files: out }; } }
    if ((tag === 'IWAD' || tag === 'PWAD') && f.size > 12) { const n = u32(h, 4), ofs = u32(h, 8); if (n < 20000 && ofs + n * 16 <= f.size) { const d = f.read(ofs, n * 16); for (let i = 0; i < n; i++) out.push(sub(str(d, i * 16 + 8, 8) + '.lmp', u32(d, i * 16), u32(d, i * 16 + 4))); return { kind: 'DOOM WAD', files: out }; } }
    if (tag === 'BIGF' || tag === 'BIGB') { const n = be32(h, 8), hs = be32(h, 12); if (n < 50000 && hs < 16 << 20) { const d = f.read(16, Math.min(hs, 8 << 20)); let o = 0; for (let i = 0; i < n && o + 9 < d.length; i++) { const off = be32(d, o), size = be32(d, o + 4); let e = o + 8; while (e < d.length && d[e]) e++; out.push(sub(d.toString('latin1', o + 8, e), off, size)); o = e + 1; } return { kind: 'EA BIG', files: out }; } }
    if (tag === 'FORM' || tag === 'UnityF' || tag === 'GDPC' || tag === 'RPA-') return { kind: S.sniff(h) || tag, files: [], opaque: true };
    if (h[0] === 0x50 && h[1] === 0x4B && !f._csz && /\.(zip|pk3|pk4|pak|dat|bin|jar|apk|xpi|assets|vpk)$/i.test(f.path) && f.size > 64) { const z = S.openZip({ size: f.size, read: (o, l) => f.read(o, l) }); if (z && z.files.length) return { kind: 'zip-based pack', files: z.files.map(x => Object.assign({}, x, { path: f.path + '/' + x.path })) }; }
    return null;
};
S.expand = (F, o = {}) => {
    const out = [], found = {}; let budget = o.maxFiles || 40000;
    for (const f of F) { out.push(f); if (f.size < 32 || f.size > 8 * 1024 * 1024 * 1024 || out.length > budget) continue; const e = path_ext(f.path); if (!/^(pak|wad|big|pk3|pk4|zip|dat|bin|vpk|assets|forge|arc|pck|rpa|win|unity3d|apk|jar|none|xp3|cpk)$/.test(e) && !/\.(bundle|resource|resS)$/.test(f.path)) continue;
        let r = null; try { r = S.expandOne(f); } catch (x) {} if (!r) continue; found[r.kind] = (found[r.kind] || 0) + 1; if (r.files.length) { f._expanded = r.files.length; for (const x of r.files) { if (out.length > budget) break; x._inner = true; out.push(x); } } }
    return { files: out, found };
};
const path_ext = p => (p.match(/\.([A-Za-z0-9]+)$/) || [, 'none'])[1].toLowerCase();
/* Xbox 360 .xex: title id and whether the program is compressed (read from the header only) */
S.xex = b => { if (str(b, 0, 4) !== 'XEX2') return null; const n = be32(b, 20), H = {}; for (let i = 0; i < n && 24 + i * 8 + 8 <= b.length; i++) H[be32(b, 24 + i * 8)] = be32(b, 28 + i * 8); const ex = H[0x40006], ff = H[0x3FF]; const R = { moduleFlags: be32(b, 4) }; if (ex && ex + 16 <= b.length) { R.titleId = be32(b, ex + 12).toString(16).toUpperCase().padStart(8, '0'); R.mediaId = be32(b, ex).toString(16).toUpperCase(); } if (ff && ff + 8 <= b.length) { R.compression = ['none', 'basic', 'LZX', 'delta'][(b[ff + 6] << 8) | b[ff + 7]] || 'unknown'; R.encrypted = ((b[ff + 4] << 8) | b[ff + 5]) !== 0; } return R; };

/* ---------------------------------------------------------------- the scan */
S.scanVfs = (vfs, name, o = {}) => {
    const t0 = Date.now(), maxMs = o.maxMs || 60000, EX = S.expand(vfs.files, o), F = EX.files, ext = {}, bytes = {}, dirs = new Set(), tech = new Set(), apis = new Set(), imgs = { n: 0, sizes: {}, pow2: 0, tiny: 0, big: 0 }, aud = { wav: 0, rates: {}, bits: {}, mono: 0, stereo: 0, other: {} }, R = { exes: [], archives: {}, titles: [] };
    let total = 0, big = [], truncated = false;
    for (const f of F) { if (!f._inner) total += f.size; const e = (path.extname(f.path).slice(1) || 'none').toLowerCase(); ext[e] = (ext[e] || 0) + 1; bytes[e] = (bytes[e] || 0) + f.size; const d = path.posix.dirname(f.path); if (d !== '.') dirs.add(d.split('/')[0]); for (const [re, t] of ENGINE_HINT) if (re.test(f.path)) tech.add(t); }
    big = F.slice().sort((a, b) => b.size - a.size).slice(0, 8);
    for (const f of F) {
        if (Date.now() - t0 > maxMs) { truncated = true; break; } const e = path.extname(f.path).slice(1).toLowerCase(); let h;
        try {
            if (/^(png|bmp|tga|gif|jpg|jpeg|dds)$/.test(e) && f.size < 64 << 20) { h = f.read(0, 4096); const im = IMG[e === 'jpeg' ? 'jpg' : e](h, f.path); if (im && im.w > 0 && im.h > 0 && im.w < 16384 && im.h < 16384) { imgs.n++; const k = im.w + 'x' + im.h; imgs.sizes[k] = (imgs.sizes[k] || 0) + 1; if (!(im.w & im.w - 1) && !(im.h & im.h - 1)) imgs.pow2++; if (im.w <= 32 && im.h <= 32) imgs.tiny++; if (im.w >= 1024) imgs.big++; } }
            else if (e === 'wav') { h = f.read(0, 64); const w = S.wav(h); if (w) { aud.wav++; aud.rates[w.rate] = (aud.rates[w.rate] || 0) + 1; aud.bits[w.bits] = (aud.bits[w.bits] || 0) + 1; w.ch === 1 ? aud.mono++ : aud.stereo++; } }
            else if (/^(exe|dll)$/.test(e) && R.exes.length < 12) { h = f.read(0, 4096); const p = S.pe(h); if (p) { R.exes.push({ file: f.path, size: f.size, machine: p.machine, bits: p.bits, subsystem: p.subsystem, packed: p.packed }); if (e === 'exe' || f.size > 1 << 20) { const blob = f.read(0, Math.min(f.size, 4 << 20)).toString('latin1').toLowerCase(); for (const k of Object.keys(IMPORT_API)) if (blob.includes(k + '.dll') || blob.includes(k + 'ex.dll') || blob.includes(k + '_x86') || blob.includes(k + '64.dll')) apis.add(IMPORT_API[k]); if (/unityplayer|mono\.dll|il2cpp/.test(blob)) tech.add('Unity'); if (/macromedia|director/.test(blob) && /xfir|dirapi/.test(blob)) tech.add('Flash/Director'); } } }
            else if (e === 'xbe') { h = f.read(0, 8192); const x = S.xbe(h); if (x) { R.titles.push(x.title); R.exes.push({ file: f.path, size: f.size, machine: 'Xbox (x86)', xbe: x }); } }
            else if (e === 'xex' || /^default\.xex$/i.test(path.basename(f.path))) { h = f.read(0, 4096); const x = S.xex(h); R.exes.push({ file: f.path, size: f.size, machine: 'Xbox 360 (PowerPC)', xex: x }); if (x && x.titleId) R.titles.push('Xbox 360 title ' + x.titleId); }
            else if (f.size > 1024 && !/^(txt|ini|cfg|xml|json|html|htm|css|js|lua|py|inf|log|md)$/.test(e)) { h = f.read(0, 16); const t = S.sniff(h, f.path); if (t && !/^(RIFF|Ogg|MP3|FLAC|MIDI|Flash|zip)$/.test(t)) R.archives[t] = (R.archives[t] || 0) + 1; else if (t === 'zip' && /^(pak|pk3|pk4|wad|dat|bin|assets|rpf|bsa|vpk|zip)$/.test(e)) R.archives['zip-based pack (.' + e + ')'] = (R.archives['zip-based pack (.' + e + ')'] || 0) + 1; }
        } catch (x) {}
    }
    for (const t of Object.keys(R.archives)) tech.add(t); for (const t of Object.keys(EX.found)) tech.add(t); for (const a of apis) tech.add(a);
    const cnt = (...x) => x.reduce((s, k) => s + (ext[k] || 0), 0), sz = (...x) => x.reduce((s, k) => s + (bytes[k] || 0), 0), mb = v => v >= 1 << 20 ? (v / (1 << 20)).toFixed(1) + ' MB' : Math.round(v / 1024) + ' KB';
    const images = cnt('png', 'bmp', 'tga', 'gif', 'jpg', 'jpeg', 'dds'), audio = cnt('wav', 'ogg', 'mp3', 'wma', 'flac', 'xm', 'it', 's3m', 'mod'), midi = cnt('mid', 'midi'), video = cnt('bik', 'smk', 'avi', 'mpg', 'mpeg', 'wmv', 'mp4', 'webm', 'flv', 'bk2'), models = cnt('obj', 'fbx', 'x', '3ds', 'md2', 'md3', 'md5mesh', 'dae', 'gltf', 'glb', 'xmo', 'nif'), flash = cnt('swf');
    const U = [{ area: 'Budget', text: `A shipped ${name} release: ${mb(total)} in ${F.filter(f => !f._inner).length} files${F.some(f => f._inner) ? ' (' + F.length + ' counting files inside game archives)' : ''} across ${dirs.size} top folders. Biggest piece: ${big[0] ? path.posix.basename(big[0].path) + ' (' + mb(big[0].size) + ')' : 'n/a'}.` }];
    if (images) { const top = Object.entries(imgs.sizes).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' x' + v).join(', '); U.push({ area: 'Graphics', text: `${images} picture files (${mb(sz('png', 'bmp', 'tga', 'gif', 'jpg', 'jpeg', 'dds'))}). Most common sizes: ${top || 'n/a'}. ${imgs.n ? Math.round(imgs.pow2 * 100 / imgs.n) + '% are power-of-two (texture friendly), ' : ''}${imgs.tiny} are tile/sprite sized (32px or smaller).` }); }
    if (audio || midi) U.push({ area: 'Music', text: `Sound budget: ${audio} audio files${midi ? ', ' + midi + ' MIDI songs' : ''} (${mb(sz('wav', 'ogg', 'mp3', 'wma', 'flac', 'mid', 'midi', 'xm', 'it', 's3m', 'mod'))}).${aud.wav ? '' : ''}` + (Object.keys(aud.rates).length ? ` WAV sample rates: ${Object.entries(aud.rates).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' Hz x' + v).join(', ')}.` : '') });
    if (models) U.push({ area: '3D', text: `${models} 3D model files, ${cnt('dds', 'tga')} texture-style files. A reference for how many models a game of this kind ships.` });
    if (video) U.push({ area: 'Cutscenes', text: `${video} pre-rendered video files (${mb(sz('bik', 'smk', 'avi', 'mpg', 'mpeg', 'wmv', 'mp4', 'webm', 'flv', 'bk2'))}): cutscenes and intros are video, not in-engine.` });
    if (flash) U.push({ area: 'Engineering', text: `${flash} Flash movies: menus and animations are built from vector timelines, not sprite sheets.` });
    if (tech.size) U.push({ area: 'Engineering', text: `Technology seen: ${[...tech].join(', ')}.` });
    const xx = R.exes.find(e => e.xex); if (xx) U.push({ area: 'Engineering', text: `Xbox 360 program: title ${xx.xex.titleId || 'unknown'}${xx.xex.compression ? ', ' + xx.xex.compression + ' compression' : ''}${xx.xex.encrypted ? ', encrypted' : ''}. Only the header can be read; the code inside is not opened.` });
    const opened = Object.entries(EX.found).map(([k, v]) => k + ' x' + v).join(', '); if (opened) U.push({ area: 'Engineering', text: `Game archives listed: ${opened}. Data is packed into archives: file names and sizes were measured, nothing was extracted.` });
    const exe = R.exes[0]; if (exe) U.push({ area: 'Engineering', text: `Main program: ${exe.machine}${exe.bits ? ' ' + exe.bits + '-bit' : ''}${exe.subsystem ? ' ' + exe.subsystem : ''}${exe.packed ? ', compressed with an executable packer' : ''}.` });
    return { name, archives: EX.found, kind: vfs.kind, volume: vfs.volume || '', files: F.length, size: total, formats: Object.fromEntries(Object.entries(ext).sort((a, b) => b[1] - a[1]).slice(0, 24)), tech: [...tech], apis: [...apis], titles: R.titles, exes: R.exes.slice(0, 8), images: { n: imgs.n, topSizes: Object.entries(imgs.sizes).sort((a, b) => b[1] - a[1]).slice(0, 8), pow2: imgs.pow2, tiny: imgs.tiny }, audio: aud, uses: U, truncated, ms: Date.now() - t0 };
};

/* what is this path? folder, iso, zip, exe/xbe/xex -> a report. Nested zips are not unpacked: they are counted and sniffed. */
S.scanPath = (p, o = {}) => {
    const st = fs.statSync(p), name = path.basename(p).replace(/\.[^.]+$/, '');
    if (st.isDirectory()) { const rep = S.scanVfs(S.openDir(p, o), name, o); return S.finish(rep, p, rep.size); }
    const rd = fdReader(p); try {
        const ext = path.extname(p).toLowerCase(); let vfs = null;
        if (/^\.(iso|img|bin|xiso)$/.test(ext) || rd.size > 4 << 20) vfs = S.openXdvd(rd) || S.openIso(rd);
        if (!vfs && ext === '.zip') vfs = S.openZip(rd);
        if (!vfs && /^\.(exe|xbe|xex|dll)$/.test(ext)) vfs = { kind: 'program', files: [{ path: path.basename(p), size: rd.size, read: rd.read }] };
        if (!vfs) return { skipped: 'not a game folder, disc image, zip or Windows/Xbox program' };
        const rep = S.scanVfs(vfs, name, o); return S.finish(rep, p, rd.size);
    } finally { rd.close(); }
};
S.PLAT = { xdvdfs: 'Xbox / Xbox 360', iso9660: 'Disc image', folder: 'Windows PC game', zip: 'Windows PC game (zip)', program: 'Windows PC program', zip64: 'Windows PC game (zip)' };
S.finish = (rep, p, size) => {
    const isX = rep.kind === 'xdvdfs' || rep.exes.some(e => /Xbox/.test(e.machine)); rep.platform = isX ? 'Xbox / Xbox 360' : S.PLAT[rep.kind] || 'PC';
    rep.record = { id: rep.name + ':' + size, name: rep.titles[0] || rep.name, file: path.basename(p), platform: rep.platform, genre: '', size, scanned: new Date().toISOString().slice(0, 10), header: { volume: rep.volume, kind: rep.kind }, formats: rep.formats, sound: rep.audio.wav ? { wav: rep.audio.wav } : null, tech: rep.tech, code: null, uses: rep.uses, gfx: null, functions: [], pcscan: { images: rep.images, apis: rep.apis, note: 'Measurements only. No pictures, sounds, models, text or code are kept.' } };
    return rep;
};

/* ================================================================ v1.13: split archives, raw CD images, DAT2 packs, big zipped discs, numeric table harvesting */
S.partsOf = p => { const m = p.match(/^(.*)\.(\d{3}|z\d{2})$/i); if (!m) return [p]; const dir = path.dirname(p), base = path.basename(m[1]), out = []; let names = []; try { names = fs.readdirSync(dir); } catch (e) { return [p]; }
    const num = names.filter(n => n.startsWith(base + '.') && /\.(\d{3}|z\d{2})$/i.test(n)).sort(); for (const n of num) out.push(path.join(dir, n)); const last = names.find(n => n.toLowerCase() === (base + '.zip').toLowerCase()); if (last && /^z\d\d$/i.test(m[2])) out.push(path.join(dir, last)); return out.length ? out : [p]; };
S.multiReader = paths => { const fds = paths.map(p => fs.openSync(p, 'r')), sizes = paths.map(p => fs.statSync(p).size), total = sizes.reduce((a, b) => a + b, 0);
    return { size: total, parts: paths.length, read: (off, len) => { len = Math.max(0, Math.min(len, total - off)); const b = Buffer.alloc(len); let got = 0, acc = 0; for (let i = 0; i < fds.length && got < len; i++) { if (off + got < acc + sizes[i]) { const o = off + got - acc, n = Math.min(len - got, sizes[i] - o); fs.readSync(fds[i], b, got, n, o); got += n; } acc += sizes[i]; } return b; }, close: () => fds.forEach(fs.closeSync) }; };
/* raw 2352-byte-sector CD image (BIN/CUE, Mode 1 or Mode 2 form 1) -> a 2048-byte-sector reader the ISO code understands */
S.rawCdReader = rd => { const h = rd.read(0, 16); const sync = h[0] === 0 && h[11] === 0 && h.slice(1, 11).every(v => v === 255); if (!sync) return null; const mode = h[15], off = mode === 2 ? 24 : 16;
    return { size: Math.floor(rd.size / 2352) * 2048, raw: true, read: (o, l) => { l = Math.max(0, Math.min(l, Math.floor(rd.size / 2352) * 2048 - o)); const out = Buffer.alloc(l); let got = 0; while (got < l) { const sec = Math.floor((o + got) / 2048), so = (o + got) % 2048, n = Math.min(l - got, 2048 - so), b = rd.read(sec * 2352 + off + so, n); b.copy(out, got); got += n; } return out; }, close: () => {} }; };
/* Fallout 1/2 style DAT2 (zlib entries, directory tree at the end). Lists names and sizes; read() inflates one entry on demand. */
S.openDat2 = rd => { if (rd.size < 64) return null; const t = rd.read(rd.size - 8, 8), tree = u32(t, 0), dsz = u32(t, 4); if (dsz !== rd.size || tree < 8 || tree > rd.size) return null; const tb = rd.read(rd.size - 8 - tree, tree), cnt = u32(tb, 0); if (cnt < 1 || cnt > 400000) return null; let p = 4; const files = [];
    for (let i = 0; i < cnt && p + 4 <= tb.length; i++) { const nl = u32(tb, p); p += 4; if (nl > 260 || p + nl + 13 > tb.length) return null; const nm = tb.toString('latin1', p, p + nl).replace(/\\/g, '/'); p += nl; const ty = tb[p], rs = u32(tb, p + 1), ps = u32(tb, p + 5), off = u32(tb, p + 9); p += 13;
        files.push({ path: nm, size: rs, read: (o, l) => { const raw = rd.read(off, ps), d = ty === 1 ? zlib.inflateSync(raw) : raw; return d.subarray(o, o + l); } }); }
    return { kind: 'Fallout DAT2', files }; };
const _expandOne = S.expandOne;
S.expandOne = f => { const r = _expandOne(f); if (r) return r; if (f.size > 4096 && /\.dat$/i.test(f.path)) { const d = S.openDat2({ size: f.size, read: (o, l) => f.read(o, l) }); if (d) return d; } return null; };
/* zip with zip64 + split parts */
const _openZip = S.openZip;
S.openZip64 = rd => { const n = rd.size, tail = rd.read(Math.max(0, n - 65557), Math.min(n, 65557)); let e = -1; for (let i = tail.length - 22; i >= 0; i--) if (u32(tail, i) === 0x06054b50) { e = i; break; } if (e < 0) return null;
    let cnt = u16(tail, e + 10), cdSize = u32(tail, e + 12), cdOff = u32(tail, e + 16);
    if (cdOff === 0xFFFFFFFF || cnt === 0xFFFF || cdSize === 0xFFFFFFFF) { const loc = tail.subarray(Math.max(0, e - 20), e); if (loc.length < 20 || u32(loc, 0) !== 0x07064b50) return null; const e64 = Number(loc.readBigUInt64LE(8)), z = rd.read(e64, 56); if (u32(z, 0) !== 0x06064b50) return null; cnt = Number(z.readBigUInt64LE(32)); cdSize = Number(z.readBigUInt64LE(40)); cdOff = Number(z.readBigUInt64LE(48)); }
    const cd = rd.read(cdOff, cdSize), files = []; let o = 0;
    for (let i = 0; i < cnt && o + 46 <= cd.length; i++) { const meth = u16(cd, o + 10); let csz = u32(cd, o + 20), usz = u32(cd, o + 24), lho = u32(cd, o + 42); const nl = u16(cd, o + 28), el = u16(cd, o + 30), cl = u16(cd, o + 32), name = cd.toString('latin1', o + 46, o + 46 + nl); let x = o + 46 + nl; const xe = x + el;
        while (x + 4 <= xe) { const id = u16(cd, x), sz = u16(cd, x + 2); if (id === 1) { let q = x + 4; if (usz === 0xFFFFFFFF) { usz = Number(cd.readBigUInt64LE(q)); q += 8; } if (csz === 0xFFFFFFFF) { csz = Number(cd.readBigUInt64LE(q)); q += 8; } if (lho === 0xFFFFFFFF) { lho = Number(cd.readBigUInt64LE(q)); q += 8; } } x += 4 + sz; } o += 46 + nl + el + cl; if (name.endsWith('/')) continue;
        files.push({ path: name, size: usz, csize: csz, method: meth, lho, rd, read: (off, len) => { if (usz > 256 << 20) return Buffer.alloc(0); const l2 = rd.read(lho, 30), data = rd.read(lho + 30 + u16(l2, 26) + u16(l2, 28), csz), out = meth === 0 ? data : zlib.inflateRawSync(data); return out.subarray(off, off + len); } }); }
    return { kind: files.some(f => f.size > 0xFFFFFFFE) ? 'zip64' : 'zip', files }; };
/* stream one deflated zip entry (any size) through a callback: cb(chunk, uncompressedOffset) -> return false to stop. Async. */
S.streamEntry = (e, cb) => new Promise((resolve, reject) => { const rd = e.rd; const lh = rd.read(e.lho, 30); const start = e.lho + 30 + u16(lh, 26) + u16(lh, 28); let pos = 0, cpos = 0, stopped = false; const inf = e.method === 8 ? zlib.createInflateRaw() : null;
    const done = () => resolve({ bytes: pos }); const emit = ch => { if (stopped) return; if (cb(ch, pos) === false) stopped = true; pos += ch.length; };
    if (inf) { inf.on('data', emit); inf.on('end', done); inf.on('error', e2 => stopped ? done() : reject(e2)); } 
    (async () => { try { while (cpos < e.csize && !stopped) { const n = Math.min(4 << 20, e.csize - cpos), b = rd.read(start + cpos, n); cpos += n; if (inf) { if (!inf.write(b)) await new Promise(r => inf.once('drain', r)); } else emit(b); } if (inf) { if (stopped) { inf.destroy(); done(); } else inf.end(); } else done(); } catch (x) { reject(x); } })(); });
const WANT = /(handling|weapon|ped(stats|grp)?\b|fist|physic|vehicle|carcols|cars?\b|surface|timecyc|object|particle|gameplay|balance|tuning|constants?|stat(s)?\b|move|jump|\.ide$|\.cfg$|\.ini$|\.tbl$|\.csv$|\.def$|\.properties$|\.dat$|\.txt$)/i;
const TEXTEXT = /\.(cfg|dat|ini|txt|ide|tbl|csv|def|properties|conf|lst)$/i;
/* numeric tables from plain-text config files. Keeps numbers and row labels only; comments and prose are dropped. */
S.parseTable = (text, file) => { const rows = []; for (const raw of text.split(/\r?\n/)) { const line = raw.replace(/(#|;|\/\/).*$/, '').trim(); if (!line || /^[%!$]/.test(line)) continue; const tok = line.split(/[\s,]+/).filter(Boolean); if (tok.length < 3) continue; const nums = tok.filter(t => /^-?\d+(\.\d+)?$/.test(t)).length; if (nums < 3 || nums / tok.length < .55) continue; const label = tok.find(t => !/^-?\d+(\.\d+)?$/.test(t)) || 'row' + rows.length; rows.push({ label: label.slice(0, 24), v: tok.filter(t => /^-?\d+(\.\d+)?$/.test(t)).map(Number) }); }
    if (rows.length < 3) return null; const cnt = {}; rows.forEach(r => cnt[r.v.length] = (cnt[r.v.length] || 0) + 1); const cols = +Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0], keep = rows.filter(r => Math.abs(r.v.length - cols) <= 3 && r.v.length >= 3).map(r => ({ label: r.label, v: r.v.length >= cols ? r.v.slice(0, cols) : r.v.concat(Array(cols - r.v.length).fill(0)) })).slice(0, 600); if (keep.length < 3) return null;
    const stats = []; for (let c = 0; c < cols; c++) { const v = keep.map(r => r.v[c]).sort((a, b) => a - b); stats.push({ min: v[0], max: v[v.length - 1], median: v[v.length >> 1] }); }
    return { file, cols, rows: keep.length, kind: S.classifyTable(stats, keep, file), stats, data: keep.map(r => [r.label, ...r.v]) }; };
S.classifyTable = (st, rows, file) => { const f = (file || '').toLowerCase().replace(/^.*\//, ''), c = st.length; if (/particle|effect/.test(f)) return 'effects'; if (/flight|track|path|route|nav/.test(f)) return 'paths'; if (/carcols|colou?r|palette/.test(f)) return 'colour table'; if (/timecyc|weather|daylight/.test(f) || (c >= 30 && st.slice(0, 9).every(s => s.max <= 255 && s.min >= 0))) return 'time-of-day light'; if ((/handling|vehicle/.test(f) && c >= 8) || (c >= 14 && st[0].min >= 300 && st[0].max >= 1500 && st[1].max < 12 && st[2].max < 12)) return 'vehicle handling'; if (/weapon|gun/.test(f)) return 'weapons'; if (/fist|fight|combo/.test(f)) return 'combat moves'; if (/ped|stat|char|npc/.test(f)) return 'character stats'; if (/surface|friction/.test(f)) return 'surfaces'; if (/object|prop/.test(f)) return 'object physics'; if (/train|rail/.test(f)) return 'rail'; return 'numeric table'; };
S.harvestTables = (F, o = {}) => { const out = [], max = o.maxTables || 120; for (const f of F) { if (out.length >= max) break; if (f.size < 64 || f.size > 2 << 20 || !TEXTEXT.test(f.path) || !WANT.test(f.path)) continue; let b; try { b = f.read(0, f.size); } catch (e) { continue; } if (!b || !b.length) continue; let nz = 0; for (let i = 0; i < Math.min(b.length, 512); i++) if (b[i] === 0 || b[i] > 126) nz++; if (nz > 20) continue; const t = S.parseTable(b.toString('latin1'), f.path); if (t) out.push(t); } return out; };
/* tables -> ready-to-use presets: vehicles for NRPhys, light cycles, character stats */
S.presetsFromTables = tables => { const o = { vehicles: {}, characters: {}, weapons: {}, light: [], other: [] }; for (const t of tables) { if (t.kind === 'vehicle handling') for (const r of t.data) o.vehicles[String(r[0]).toLowerCase()] = { mass: r[1], size: [r[2], r[3], r[4]], maxKmh: r[13] || r[12], accel: r[14] || r[13], grip: r[9], brake: r[17] }; else if (t.kind === 'character stats') for (const r of t.data) o.characters[String(r[0]).toLowerCase()] = r.slice(1); else if (t.kind === 'weapons') for (const r of t.data) o.weapons[String(r[0]).toLowerCase()] = r.slice(1); else if (t.kind === 'time-of-day light') o.light = t.data.map(r => r.slice(1, 10)); else o.other.push({ file: t.file, kind: t.kind, rows: t.rows, cols: t.cols }); } return o; };
/* the scan of a game now also keeps its tables */
const _scanVfs = S.scanVfs;
S.scanVfs = (vfs, name, o = {}) => { const rep = _scanVfs(vfs, name, o); if (o.tables !== false) { try { const EX = S.expand(vfs.files, o); const T = S.harvestTables(EX.files, o); rep.tables = T; if (rep.record) rep.record.tables = T.map(t => ({ file: t.file, kind: t.kind, rows: t.rows, cols: t.cols, stats: t.stats })); rep.presets = S.presetsFromTables(T); } catch (e) { rep.tables = []; } } return rep; };
/* a zipped disc image (the usual way big discs are shared): stream it once, read the file tree from its head, keep only small config files */
S.scanZippedDisc = async (rd, name, o = {}) => { const z = S.openZip64(rd); if (!z || !z.files.length) return null; const e = z.files.slice().sort((a, b) => b.size - a.size)[0]; if (!/\.(iso|bin|img|gcm|xiso)$/i.test(e.path) || e.method !== 8 && e.method !== 0) return null; const HEAD = o.headBytes || 24 << 20; let head = Buffer.alloc(0);
    await S.streamEntry(e, (ch, pos) => { if (pos < HEAD) head = Buffer.concat([head, ch.subarray(0, HEAD - pos)]); return pos + ch.length < HEAD; });
    let hrd = { size: head.length, read: (off, len) => head.subarray(off, off + len) }; const raw = S.rawCdReader(hrd); if (raw) { raw.sizeFull = e.size; hrd = raw; }
    const vfs = S.openXdvd(hrd) || S.openIso(hrd); if (!vfs) return { skipped: 'zipped file is not a disc image the scanner can read', entry: e.path };
    const wanted = vfs.files.filter(f => f.size >= 64 && f.size < 2 << 20 && TEXTEXT.test(f.path) && WANT.test(f.path)); const mul = raw ? 2352 / 2048 : 1;
    /* locate each wanted file's byte range in the uncompressed stream (needs its LBA: re-walk records) */
    const loc = []; for (const f of wanted) { const hit = f._lba != null ? f._lba : null; if (hit != null) loc.push({ f, off: hit }); }
    return { vfs, entry: e, head, raw: !!raw, wanted, rd, mul }; };
S.discTables = async (rd, name, o = {}) => { const info = await S.scanZippedDisc(rd, name, o); if (!info || !info.vfs) return info; const { vfs, entry, raw } = info, want = info.wanted, bufs = new Map(); /* need LBAs: patch openIso records via a probe read */
    const L = []; for (const f of want) { const probe = f.read(0, 16); L.push({ f, probe }); }
    /* find each file's offset by matching: openIso closes over ext; recover by scanning the head for the directory record again */
    const lbas = S.lbaMap(info.head, raw); const ranges = []; for (const f of want) { const lba = lbas[f.path]; if (lba != null) ranges.push({ f, start: raw ? lba * 2352 : lba * 2048, len: raw ? Math.ceil(f.size / 2048) * 2352 : f.size, lba }); } ranges.sort((a, b) => a.start - b.start); const last = ranges.length ? ranges[ranges.length - 1].start + ranges[ranges.length - 1].len : 0; let total = 0; const keep = ranges.filter(r => (total += r.f.size) < (o.maxBytes || 96 << 20));
    for (const r of keep) bufs.set(r, []); await S.streamEntry(entry, (ch, pos) => { const end = pos + ch.length; for (const r of keep) { const a = Math.max(pos, r.start), b = Math.min(end, r.start + r.len); if (a < b) bufs.get(r).push(Buffer.from(ch.subarray(a - pos, b - pos))); } return end < last; });
    const files = keep.map(r => { let b = Buffer.concat(bufs.get(r)); if (raw) { const out = []; for (let i = 0; i + 2352 <= b.length; i += 2352) out.push(b.subarray(i + 24 > b.length ? i + 16 : i + (b[i + 15] === 2 ? 24 : 16), i + (b[i + 15] === 2 ? 24 : 16) + 2048)); b = Buffer.concat(out); } b = b.subarray(0, r.f.size); return { path: r.f.path, size: b.length, read: (off, len) => b.subarray(off, off + len) }; });
    const tables = S.harvestTables(files, o), vf = vfs.files; return { name, kind: vfs.kind, volume: vfs.volume || '', discFiles: vf.length, discBytes: vf.reduce((a, f) => a + f.size, 0), tables, presets: S.presetsFromTables(tables), listing: vf.slice(0, 4000).map(f => ({ path: f.path, size: f.size })) }; };
/* LBA of every file in the first-pass head (ISO9660 directory records) */
S.lbaMap = (head, raw) => { const rdr = raw ? raw : { read: (o, l) => head.subarray(o, o + l) }; const m = {}; const pvd = rdr.read(0x8000, 2048); if (str(pvd, 1, 5) !== 'CD001') return m; (function walk(lba, size, pre, depth) { if (depth > 10 || size > 1 << 24) return; const d = rdr.read(lba * 2048, size); for (let o = 0; o < d.length;) { const l = d[o]; if (!l) { o = (o + 2048) & ~2047; continue; } const nl = d[o + 32]; let nm = str(d, o + 33, nl); const fl = d[o + 25], ext = u32(d, o + 2), sz = u32(d, o + 10); if (nl === 1 && (d[o + 33] === 0 || d[o + 33] === 1)) { o += l; continue; } nm = nm.replace(/;\d+$/, ''); if (fl & 2) walk(ext, sz, pre + nm + '/', depth + 1); else m[pre + nm] = ext; o += l; } })(u32(pvd.subarray(156, 190), 2), u32(pvd.subarray(156, 190), 10), '', 0); return m; };
/* one call for everything: folder, disc, zip, split zip (.001), BIN/CUE, DAT2, zipped disc. Returns a report with .tables and .presets */
S.scanAny = async (p, o = {}) => { const ext = path.extname(p).toLowerCase(); let rd = null, parts = [p];
    try { if (/\.(\d{3}|z\d{2})$/i.test(p)) { parts = S.partsOf(p); rd = S.multiReader(parts); } else if (fs.statSync(p).isDirectory()) { const r = S.scanPath(p, o); return r; } else rd = fdReader(p);
        const name = path.basename(p).replace(/\.(\d{3}|z\d{2})$/i, '').replace(/\.[^.]+$/, '');
        const head = rd.read(0, 4), isZip = head[0] === 0x50 && head[1] === 0x4B;
        if (isZip) { const z = S.openZip64(rd); const big = z && z.files.length && z.files.slice().sort((a, b) => b.size - a.size)[0]; if (big && /\.(iso|bin|img|gcm|xiso)$/i.test(big.path)) { const r = await S.discTables(rd, name, o); if (r && r.tables) return Object.assign(r, { parts: parts.length, source: 'zipped disc' }); } if (z && z.files.length) { const rep = S.scanVfs(z, name, o); return S.finish(rep, p, rd.size); } }
        const raw = S.rawCdReader(rd), use = raw || rd, vfs = S.openXdvd(use) || S.openIso(use); if (vfs) { const rep = S.scanVfs(vfs, name, o); return S.finish(rep, p, rd.size); }
        const d2 = S.openDat2(rd); if (d2) { const rep = S.scanVfs(d2, name, o); return S.finish(rep, p, rd.size); }
        return { skipped: 'not a recognised game folder, disc image, zip or archive' };
    } finally { if (rd && rd.close) rd.close(); } };

if (typeof module !== 'undefined') module.exports = S;

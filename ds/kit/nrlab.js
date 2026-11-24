/* NOTAREAL Research Lab: scan a game ROM (offline) and turn what is inside into facts the studio can use.
 * Recognises DS, GBA, Game Boy / Color, SNES, N64 and PlayStation images. For each it reads the header, lists the
 * file system and known data formats, finds the code (entry point, every called function, which hardware each
 * function talks to: graphics, sound, input, DMA...), pulls out engine/middleware fingerprints, and writes
 * "uses": budgets and techniques for the Technique Library (how many songs, models, textures, files a real game
 * of that type ships, which systems it uses).
 * The studio stores facts and measurements only. No code or asset from a scanned game goes into a game you make. */
(function (root) {
'use strict';
const L = {};
const u8 = (d, o) => d[o], u16 = (d, o) => d[o] | d[o + 1] << 8, u32 = (d, o) => (d[o] | d[o + 1] << 8 | d[o + 2] << 16 | d[o + 3] << 24) >>> 0;
const be32 = (d, o) => (d[o] << 24 | d[o + 1] << 16 | d[o + 2] << 8 | d[o + 3]) >>> 0, be16 = (d, o) => d[o] << 8 | d[o + 1];
const str = (d, o, n) => { let s = ''; for (let i = 0; i < n; i++) { const c = d[o + i]; if (!c) break; s += c >= 32 && c < 127 ? String.fromCharCode(c) : '?'; } return s.trim(); };
const magic = (d, o) => String.fromCharCode(d[o], d[o + 1], d[o + 2], d[o + 3]);

/* ------------------------------------------------------------------ platform detection */
L.detect = d => {
    if (d.length > 16 && d[0] === 0x4E && d[1] === 0x45 && d[2] === 0x53 && d[3] === 0x1A) return 'nes';
    if (d.length > 0x200 && u8(d, 0x15C) === 0x56 && u8(d, 0x15D) === 0xCF) return 'nds';           // DS header logo CRC
    if (d.length > 0xC0 && u8(d, 0xB2) === 0x96 && u8(d, 3) === 0xEA) return 'gba';
    if (d.length > 0x150 && u8(d, 0x104) === 0xCE && u8(d, 0x105) === 0xED) return u8(d, 0x143) & 0x80 ? 'gbc' : 'gb';
    if (d.length > 0x40 && (be32(d, 0) === 0x80371240 || be32(d, 0) === 0x37804012 || be32(d, 0) === 0x40123780)) return 'n64';
    if (d.length > 0x9400 && (str(d, 0x8001, 5) === 'CD001' || str(d, 0x9319, 5) === 'CD001')) return 'psx';
    if (d.length > 0x800 && str(d, 0, 8) === 'PS-X EXE') return 'psxexe';
    if (snesHeader(d)) return 'snes';
    return 'unknown';
};
function snesHeader(d) {
    const off = d.length % 1024 === 512 ? 512 : 0;
    for (const [base, map] of [[0x7FC0, 'LoROM'], [0xFFC0, 'HiROM'], [0x40FFC0, 'ExHiROM']]) {
        const h = base + off; if (h + 0x40 > d.length) continue;
        const ck = u16(d, h + 0x1E), cm = u16(d, h + 0x1C);
        if (((ck ^ cm) & 0xFFFF) === 0xFFFF) return { h, off, map, title: str(d, h, 21), base };
    }
    return null;
}
L.PLATFORMS = { nds: 'Nintendo DS', gba: 'Game Boy Advance', gb: 'Game Boy', gbc: 'Game Boy Color', snes: 'Super Nintendo', nes: 'NES', n64: 'Nintendo 64', psx: 'PlayStation', psxexe: 'PlayStation (EXE)', unknown: 'Unknown' };

/* ------------------------------------------------------------------ data format fingerprints (DS + PSX + generic) */
const FORMATS = {
    NARC: ['archive', 'Packed folder of files'], SDAT: ['sound', 'Sound data: sequences (songs), instrument banks, wave archives'], RGCN: ['graphics', 'Tiles (NCGR)'], RLCN: ['graphics', 'Palette (NCLR)'], RCSN: ['graphics', 'Tilemap / screen (NSCR)'],
    RECN: ['graphics', 'Sprite cells (NCER)'], RNAN: ['animation', '2D animation (NANR)'], BMD0: ['3d', '3D model (NSBMD)'], BTX0: ['3d', '3D textures (NSBTX)'], BCA0: ['animation', 'Skeletal animation (NSBCA)'], BTA0: ['animation', 'Texture animation (NSBTA)'],
    BTP0: ['animation', 'Texture swap animation (NSBTP)'], BMA0: ['animation', 'Material animation (NSBMA)'], MESG: ['text', 'Text messages (BMG)'], SSEQ: ['sound', 'Song sequence'], SBNK: ['sound', 'Instrument bank'], SWAR: ['sound', 'Wave archive'], STRM: ['sound', 'Streamed audio'],
    'VAG': ['sound', 'PSX sound sample'], 'pBAV': ['sound', 'PSX instrument bank'], 'pQES': ['sound', 'PSX sequence'], 'BIK': ['video', 'Bink video'], 'RIFF': ['media', 'RIFF media (WAV/AVI/STR)'], '\x10\x00\x00\x00': ['graphics', 'PSX TIM image'],
};
const fmtOf = (d, o) => { const m = magic(d, o); if (FORMATS[m]) return m; if (m.slice(0, 3) === 'BIK') return 'BIK'; if (m.slice(0, 3) === 'VAG') return 'VAG'; return null; };

/* ------------------------------------------------------------------ middleware / engine fingerprints in strings */
const TECH = [[/CRIWARE|CRI Middleware|\(c\)CRI|CRI ADX/, 'CRI middleware (ADX audio / Sofdec video)'], [/Havok/i, 'Havok physics'], [/RenderWare/i, 'RenderWare engine'], [/\bBink\b|BIKi/, 'Bink video'],
    [/NitroSDK|NITRO/, 'Nintendo NITRO SDK (DS)'], [/libnds|devkitPro|BlocksDS/i, 'Homebrew DS toolchain'], [/Psy-?Q|PSYQ/i, 'Psy-Q SDK (PlayStation)'], [/libgs|LIBGPU|LIBGTE|LIBSPU/i, 'Sony PSX libraries (GPU/GTE/SPU)'],
    [/libultra|NuSystem/i, 'Nintendo libultra (N64)'], [/libdragon/i, 'libdragon (homebrew N64)'], [/MusyX/i, 'MusyX sound system'], [/GAX Sound/i, 'GAX sound engine (GBA)'], [/Krawall/i, 'Krawall sound engine (GBA)'], [/MP2K|m4a|Sappy/i, 'MP2K "Sappy" sound engine (GBA)'],
    [/Wwise/i, 'Wwise audio'], [/FMOD/i, 'FMOD audio'], [/\blua_[a-z]+|Lua 5\.\d|lua_State/, 'Lua scripting'], [/Unreal/i, 'Unreal engine'], [/Neversoft/i, 'Neversoft engine'], [/Yuke'?s/i, "Yuke's engine"], [/Vicarious Visions/i, 'Vicarious Visions engine'], [/\bMaxis\b/, 'Maxis'], [/EA Games|Electronic Arts/i, 'EA tools'],
    [/zlib|inflate/i, 'zlib compression'], [/LZ77|LZSS/i, 'LZ compression'], [/Huffman/i, 'Huffman compression']];
function strings(d, max = 4000, minLen = 6) {
    const out = []; let cur = '';
    const step = d.length > 64e6 ? 4 : 1;   // very big images: sample
    for (let i = 0; i < d.length && out.length < max; i += (cur ? 1 : step)) { const c = d[i]; if (c >= 32 && c < 127) cur += String.fromCharCode(c); else { if (cur.length >= minLen) out.push(cur); cur = ''; } }
    return out;
}

/* ------------------------------------------------------------------ code: function discovery per CPU
 * Each returns { entry, functions: [{addr, calls, tags[]}], summary } using linear sweeps for call instructions
 * (BL/JAL/JSR/CALL), then tags each target by the hardware registers referenced near it. */
function tagBy(addrs, table) { const t = new Set(); for (const a of addrs) for (const [lo, hi, tag] of table) if (a >= lo && a <= hi) t.add(tag); return [...t]; }
const IO_DS = [[0x04000000, 0x0400006F, 'graphics'], [0x04000100, 0x0400010F, 'timers'], [0x040000B0, 0x040000EF, 'dma'], [0x04000130, 0x04000137, 'input'], [0x04000180, 0x040001BF, 'ipc'], [0x04000300, 0x040006FF, '3d'], [0x04000400, 0x0400051F, 'sound'], [0x04001000, 0x0400106F, 'graphics (sub)'], [0x05000000, 0x07FFFFFF, 'video memory']];
const IO_GBA = [[0x04000000, 0x04000055, 'graphics'], [0x04000060, 0x040000A8, 'sound'], [0x040000B0, 0x040000DF, 'dma'], [0x04000100, 0x0400010F, 'timers'], [0x04000130, 0x04000133, 'input'], [0x05000000, 0x07FFFFFF, 'video memory']];
function scanARM(d, base, start, len, io) {
    // ARM: BL = cond 1011 + offset24; Thumb: BL pair F000/F800. Count literal-pool words that point at IO.
    const calls = new Map(), lits = [];
    const end = Math.min(d.length, start + len);
    for (let o = start; o + 4 <= end; o += 4) {
        const w = u32(d, o);
        if ((w & 0x0F000000) === 0x0B000000 && (w >>> 28) === 0xE) { let off = w & 0xFFFFFF; if (off & 0x800000) off -= 0x1000000; const t = base + (o - start) + 8 + off * 4; if (t >= base && t < base + len) calls.set(t, (calls.get(t) || 0) + 1); }
        if (w >= 0x04000000 && w < 0x04110000) lits.push([o, w]);
    }
    for (let o = start; o + 4 <= end; o += 2) {
        const a = u16(d, o), b = u16(d, o + 2);
        if ((a & 0xF800) === 0xF000 && (b & 0xF800) === 0xF800) { let off = ((a & 0x7FF) << 12) | ((b & 0x7FF) << 1); if (off & 0x400000) off -= 0x800000; const t = base + (o - start) + 4 + off; if (t >= base && t < base + len) calls.set(t | 1, (calls.get(t | 1) || 0) + 1); }
    }
    const fn = [...calls.entries()].filter(([, n]) => n >= 1).map(([addr, n]) => ({ addr, calls: n, tags: [] }));
    fn.sort((a, b) => (a.addr & ~1) - (b.addr & ~1));
    // tag: literal IO addresses found between a function start and the next one
    let li = 0; lits.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < fn.length; i++) {
        const s = (fn[i].addr & ~1) - base + start, e = i + 1 < fn.length ? (fn[i + 1].addr & ~1) - base + start : s + 512, near = [];
        while (li < lits.length && lits[li][0] < s) li++;
        for (let k = li; k < lits.length && lits[k][0] < Math.min(e, s + 4096); k++) near.push(lits[k][1]);
        fn[i].tags = tagBy(near, io); fn[i].thumb = !!(fn[i].addr & 1);
    }
    return fn;
}
const GB_HW = { 0x00: 'input', 0x04: 'random/timer', 0x05: 'timers', 0x06: 'timers', 0x07: 'timers', 0x10: 'sound', 0x11: 'sound', 0x12: 'sound', 0x13: 'sound', 0x14: 'sound', 0x16: 'sound', 0x17: 'sound', 0x18: 'sound', 0x19: 'sound', 0x1A: 'sound', 0x1C: 'sound', 0x1E: 'sound', 0x24: 'sound', 0x25: 'sound', 0x26: 'sound', 0x40: 'graphics', 0x41: 'graphics', 0x42: 'scrolling', 0x43: 'scrolling', 0x44: 'raster timing', 0x45: 'raster timing', 0x46: 'sprites (OAM DMA)', 0x47: 'palettes', 0x48: 'palettes', 0x49: 'palettes', 0x4A: 'window', 0x4B: 'window', 0x4F: 'vram bank', 0x55: 'dma', 0x68: 'colour palettes', 0x69: 'colour palettes', 0x6A: 'colour palettes', 0x6B: 'colour palettes', 0x70: 'wram bank' };
function scanSM83(d) {
    const LEN3 = new Set([0x01, 0x11, 0x21, 0x31, 0x08, 0xC2, 0xC3, 0xCA, 0xD2, 0xDA, 0xC4, 0xCC, 0xCD, 0xD4, 0xDC, 0xEA, 0xFA]), LEN2 = new Set([0x06, 0x0E, 0x16, 0x1E, 0x26, 0x2E, 0x36, 0x3E, 0xC6, 0xCE, 0xD6, 0xDE, 0xE6, 0xEE, 0xF6, 0xFE, 0x18, 0x20, 0x28, 0x30, 0x38, 0xE0, 0xF0, 0xE8, 0xF8, 0x10, 0xCB]);
    const banks = Math.max(1, d.length >> 14), fns = new Map(); const seen = new Set();
    // recursive descent within each bank from known call targets (bank 0 seeds: 0x100, rst/irq vectors)
    const queue = [[0, 0x100], [0, 0x40], [0, 0x48], [0, 0x50], [0, 0x58], [0, 0x60]];
    for (let r = 0; r < 0x40; r += 8) queue.push([0, r]);
    const fileOff = (bank, a) => a < 0x4000 ? a : bank * 0x4000 + (a - 0x4000);
    let steps = 0;
    while (queue.length && steps < 3e6) {
        const [bank, a0] = queue.pop(); const key = bank * 0x10000 + a0; if (seen.has(key)) continue; seen.add(key);
        const f = fns.get(key) || { addr: a0, bank, calls: 0, tags: new Set(), size: 0 }; fns.set(key, f);
        let a = a0, curBank = bank;
        for (let n = 0; n < 4000; n++, steps++) {
            const o = fileOff(curBank, a); if (o >= d.length) break;
            const op = d[o], ln = LEN3.has(op) ? 3 : LEN2.has(op) ? 2 : 1; f.size += ln;
            if (op === 0xE0 || op === 0xF0) { const t = GB_HW[d[o + 1]]; if (t) f.tags.add(t); }
            if (op === 0xEA || op === 0xFA) { const t16 = u16(d, o + 1); if (t16 >= 0xFF00 && GB_HW[t16 & 0xFF]) f.tags.add(GB_HW[t16 & 0xFF]); if (op === 0xEA && t16 >= 0x2000 && t16 < 0x4000) f.tags.add('bank switch'); }
            if (op === 0x3E && d[o + 2] === 0xEA && u16(d, o + 3) >= 0x2000 && u16(d, o + 3) < 0x4000) curBank = d[o + 1] || 1;
            if (op === 0xCD || op === 0xC4 || op === 0xCC || op === 0xD4 || op === 0xDC) { const t = u16(d, o + 1); const tb = t < 0x4000 ? 0 : curBank; if (t < 0x8000) { const k = tb * 0x10000 + t; const g = fns.get(k) || { addr: t, bank: tb, calls: 0, tags: new Set(), size: 0 }; g.calls++; fns.set(k, g); queue.push([tb, t]); } }
            if ((op & 0xC7) === 0xC7) { const t = op & 0x38; const g = fns.get(t); if (g) g.calls++; }
            if (op === 0xC3) { const t = u16(d, o + 1); if (t < 0x8000) { a = t; continue; } break; }
            if (op === 0x18) { const r = (d[o + 1] << 24 >> 24); a = a + 2 + r; continue; }
            if ([0x20, 0x28, 0x30, 0x38].includes(op)) { const r = (d[o + 1] << 24 >> 24); queue.push([curBank, a + 2 + r]); }
            if ([0xC2, 0xCA, 0xD2, 0xDA].includes(op)) { const t = u16(d, o + 1); if (t < 0x8000) queue.push([t < 0x4000 ? 0 : curBank, t]); }
            if (op === 0xC9 || op === 0xD9 || op === 0xE9 || op === 0x76 && false) break;
            a += ln; if (a >= 0x8000) break;
        }
    }
    // also sweep every bank for CALLs into itself so code only reached through jump tables is counted
    for (let b = 1; b < banks; b++) for (let o = b * 0x4000; o + 3 <= Math.min(d.length, (b + 1) * 0x4000); o++) if (d[o] === 0xCD) { const t = u16(d, o + 1); if (t >= 0x4000 && t < 0x8000) { const k = b * 0x10000 + t; if (!fns.has(k)) fns.set(k, { addr: t, bank: b, calls: 1, tags: new Set(), size: 0, swept: true }); } }
    return [...fns.values()].map(f => ({ addr: f.addr, bank: f.bank, calls: f.calls, size: f.size, tags: [...f.tags] }));
}
const IO_N64 = [[0xA4000000, 0xA40FFFFF, 'RSP'], [0xA4100000, 0xA41FFFFF, 'RDP graphics'], [0xA4300000, 0xA43FFFFF, 'MIPS interface'], [0xA4400000, 0xA44FFFFF, 'video'], [0xA4500000, 0xA45FFFFF, 'audio'], [0xA4600000, 0xA46FFFFF, 'cartridge DMA'], [0xA4800000, 0xA48FFFFF, 'controllers'], [0xBFC00000, 0xBFC007FF, 'PIF / controllers']];
const IO_PSX = [[0x1F801040, 0x1F80105F, 'controllers / memory card'], [0x1F801070, 0x1F801077, 'interrupts'], [0x1F801080, 0x1F8010FF, 'dma'], [0x1F801100, 0x1F80112F, 'timers'], [0x1F801800, 0x1F801803, 'CD-ROM'], [0x1F801810, 0x1F801817, 'GPU graphics'], [0x1F801820, 0x1F801827, 'MDEC video'], [0x1F801C00, 0x1F801FFF, 'SPU sound']];
function scanMIPS(d, base, start, len, io, bigEndian) {
    const rd = bigEndian ? be32 : u32, calls = new Map(), lui = [];
    const end = Math.min(d.length, start + len);
    for (let o = start; o + 4 <= end; o += 4) {
        const w = rd(d, o), op = w >>> 26;
        if (op === 3) { const t = ((((base + (o - start) + 4) & 0xF0000000) >>> 0) + ((w & 0x3FFFFFF) * 4)) >>> 0; if (t >= base && t < base + len) calls.set(t >>> 0, (calls.get(t >>> 0) || 0) + 1); }
        if (op === 15) { const hi = (w & 0xFFFF) << 16 >>> 0; if (io.some(([lo, h]) => hi >= (lo & 0xFFFF0000) >>> 0 && hi <= h)) lui.push([o, hi]); }
        if (w === 0x0000000C) lui.push([o, -1]);     // syscall
        if ((w >>> 26) === 0x12) lui.push([o, -2]);  // COP2 = GTE (PSX) / RSP vector unit
    }
    const fn = [...calls.entries()].map(([addr, n]) => ({ addr, calls: n, tags: [] })).sort((a, b) => a.addr - b.addr);
    let li = 0;
    for (let i = 0; i < fn.length; i++) {
        const s = fn[i].addr - base + start, e = i + 1 < fn.length ? fn[i + 1].addr - base + start : s + 1024, t = new Set();
        while (li < lui.length && lui[li][0] < s) li++;
        for (let k = li; k < lui.length && lui[k][0] < Math.min(e, s + 8192); k++) { const v = lui[k][1]; if (v === -1) t.add('system call'); else if (v === -2) t.add('3D math (GTE/COP2)'); else for (const [lo, hi, tag] of io) if (v >= (lo & 0xFFFF0000) >>> 0 && v <= hi) t.add(tag); }
        fn[i].tags = [...t];
    }
    return fn;
}
function scan65816(d, hdr) {
    // linear sweep for JSR abs (20 xx xx) and JSL long (22 xx xx xx); tag by $21xx PPU / $42xx-$43xx CPU IO operands nearby
    const calls = new Map(), io = [];
    const off = hdr.off;
    for (let o = off; o + 4 <= d.length; o++) {
        const op = d[o];
        if (op === 0x22) { const t = d[o + 1] | d[o + 2] << 8 | d[o + 3] << 16; if ((t & 0xFFFF) >= 0x8000 || hdr.map !== 'LoROM') calls.set(t, (calls.get(t) || 0) + 1); }
        if (op === 0x8D || op === 0x8E || op === 0x8C || op === 0x9C || op === 0x8F || op === 0xAD || op === 0xAF) { const a = u16(d, o + 1); if (a >= 0x2100 && a <= 0x21FF || a >= 0x4200 && a <= 0x43FF) io.push([o, a]); }
    }
    const bankOf = t => hdr.map === 'LoROM' ? ((t >> 16) & 0x7F) * 0x8000 + ((t & 0xFFFF) - 0x8000) + off : (t & 0x3FFFFF) + off;
    const fn = [...calls.entries()].filter(([, n]) => n >= 2).map(([addr, n]) => ({ addr, calls: n, tags: [] })).sort((a, b) => a.addr - b.addr);
    io.sort((a, b) => a[0] - b[0]); let li = 0;
    const T = a => a >= 0x2140 && a <= 0x2143 ? 'sound (APU ports)' : a <= 0x2133 ? 'graphics (PPU)' : a <= 0x2183 ? 'graphics/WRAM' : a === 0x4200 ? 'interrupts' : a >= 0x4202 && a <= 0x4206 ? 'math hardware' : a === 0x420B || a === 0x420C || a >= 0x4300 ? 'dma' : a >= 0x4218 && a <= 0x421F ? 'input' : 'cpu io';
    for (let i = 0; i < fn.length; i++) { const s = bankOf(fn[i].addr); if (s < 0 || s >= d.length) continue; const t = new Set(); while (li < io.length && io[li][0] < s) li++; for (let k = li; k < io.length && io[k][0] < s + 600; k++) t.add(T(io[k][1])); fn[i].tags = [...t]; }
    return fn;
}

/* ------------------------------------------------------------------ DS file system */
function ndsFiles(d) {
    const fntOff = u32(d, 0x40), fatOff = u32(d, 0x48), fatSize = u32(d, 0x4C), files = [];
    const nfiles = fatSize / 8;
    const walk = (dirId, path) => {
        const e = fntOff + (dirId & 0xFFF) * 8; let p = fntOff + u32(d, e); let fid = u16(d, e + 4);
        for (let guard = 0; guard < 100000; guard++) {
            const t = d[p++]; if (!t) break; const len = t & 0x7F, name = str(d, p, len); p += len;
            if (t & 0x80) { const sub = u16(d, p); p += 2; walk(sub, path + name + '/'); }
            else { const s = u32(d, fatOff + fid * 8), en = u32(d, fatOff + fid * 8 + 4); files.push({ path: path + name, size: en - s, off: s, fmt: en - s >= 4 ? fmtOf(d, s) : null }); fid++; }
        }
    };
    try { walk(0xF000, ''); } catch (e) {}
    return { files, nfiles };
}
function sdatInfo(d, o) {
    // SDAT: header then SYMB/INFO/FAT/FILE blocks; INFO has record lists per type (SSEQ, SSAR, SBNK, SWAR, player, group, player2, STRM)
    try {
        const infoOff = o + u32(d, o + 0x18); if (magic(d, infoOff) !== 'INFO') return null;
        const types = ['songs (SSEQ)', 'sound-effect archives (SSAR)', 'instrument banks (SBNK)', 'wave archives (SWAR)', 'players', 'groups', 'stream players', 'streams (STRM)'], out = {};
        for (let k = 0; k < 8; k++) { const r = infoOff + u32(d, infoOff + 8 + k * 4); out[types[k]] = u32(d, r); }
        return out;
    } catch (e) { return null; }
}
/* ------------------------------------------------------------------ PSX ISO9660 */
function isoFiles(d) {
    const raw = str(d, 0x9319, 5) === 'CD001', sec = raw ? 2352 : 2048, hdr = raw ? 24 : 0;
    const S = n => n * sec + hdr, files = [];
    const pvd = S(16), rootLBA = u32(d, pvd + 156 + 2), rootLen = u32(d, pvd + 156 + 10);
    const walk = (lba, len, path, depth) => {
        if (depth > 8) return;
        for (let s = 0; s < Math.ceil(len / 2048); s++) {
            let p = S(lba + s), end = p + 2048;
            while (p < end) { const rl = d[p]; if (!rl) break; const flba = u32(d, p + 2), flen = u32(d, p + 10), fl = d[p + 25], nl = d[p + 32], name = str(d, p + 33, nl).replace(/;1$/, '');
                if (nl === 1 && (d[p + 33] === 0 || d[p + 33] === 1)) { p += rl; continue; }
                if (fl & 2) walk(flba, flen, path + name + '/', depth + 1); else files.push({ path: path + name, size: flen, lba: flba, fmt: S(flba) + 4 <= d.length ? fmtOf(d, S(flba)) : null });
                p += rl; }
        }
    };
    try { walk(rootLBA, rootLen, '', 0); } catch (e) {}
    return { files, raw, sec, read: (lba, n) => { const out = new Uint8Array(n); for (let i = 0; i < n; i++) { const s = Math.floor(i / 2048), k = i % 2048, o = S(lba + s) + k; out[i] = o < d.length ? d[o] : 0; } return out; } };
}


/* ------------------------------------------------------------------ NES (iNES): 6502 call graph with PPU / APU / controller / mapper tags */
const NES_MAPPERS = { 0: 'NROM', 1: 'MMC1', 2: 'UxROM', 3: 'CNROM', 4: 'MMC3', 5: 'MMC5', 7: 'AxROM', 9: 'MMC2', 10: 'MMC4', 11: 'Color Dreams', 19: 'Namco 163', 21: 'VRC4', 23: 'VRC2/4', 24: 'VRC6', 25: 'VRC4', 26: 'VRC6', 34: 'BNROM', 66: 'GxROM', 69: 'Sunsoft FME-7', 71: 'Camerica' };
function nesHeader(d) { const prg = d[4], chr = d[5], f6 = d[6], f7 = d[7], v2 = (f7 & 0x0C) === 0x08, mapper = (f6 >> 4) | (f7 & 0xF0); return { prgKB: prg * 16, chrKB: chr * 8, mapper, mapperName: NES_MAPPERS[mapper] || 'mapper ' + mapper, mirroring: f6 & 8 ? 'four-screen' : f6 & 1 ? 'vertical' : 'horizontal', battery: !!(f6 & 2), trainer: !!(f6 & 4), nes2: v2, chrRam: chr === 0, off: 16 + (f6 & 4 ? 512 : 0) }; }
function scan6502(d, h) {
    const prgLen = h.prgKB << 10, prg = d.subarray(h.off, h.off + prgLen), banks = prgLen >> 14, fixed = (banks - 1) << 14, fns = new Map();
    const tagFor = a => a >= 0x2000 && a <= 0x2007 ? 'ppu' : a === 0x4014 ? 'sprite dma' : (a >= 0x4000 && a <= 0x4013) || a === 0x4015 || a === 0x4017 ? 'sound (apu)' : a === 0x4016 ? 'controller' : a >= 0x8000 ? 'mapper bank switch' : a >= 0x6000 && a < 0x8000 ? 'battery ram' : null;
    const MEM = new Set([0x8D, 0x8E, 0x8C, 0xAD, 0xAE, 0xAC, 0x2C, 0xEE, 0xCE, 0x0E, 0x4E, 0x2E, 0x6E, 0x0D, 0x2D, 0x4D]);
    const map = a => a >= 0xC000 ? fixed + (a - 0xC000) : (banks === 1 ? ((a - 0x8000) & 0x3FFF) : a >= 0x8000 ? (a - 0x8000) : -1);   // first/fixed-bank view
    const read = o => o >= 0 && o < prg.length ? prg[o] : 0;
    for (let b = 0; b < banks; b++) {
        const base = b << 14; for (let i = 0; i + 2 < 0x4000; i++) { if (prg[base + i] !== 0x20) continue; const tgt = prg[base + i + 1] | prg[base + i + 2] << 8; if (tgt < 0x8000) continue; const key = (tgt >= 0xC000 || banks === 1 ? 0 : b) * 0x10000 + tgt; const f = fns.get(key) || { addr: tgt, bank: tgt >= 0xC000 || banks === 1 ? banks - 1 : b, calls: 0, tags: new Set() }; f.calls++; fns.set(key, f); }
    }
    for (const f of fns.values()) { const o = f.addr >= 0xC000 || banks === 1 ? map(f.addr) : (f.bank << 14) + (f.addr - 0x8000); for (let i = 0; i < 96; i++) { const op = read(o + i); if (op === 0x60 || op === 0x40) break; if (MEM.has(op)) { const a = read(o + i + 1) | read(o + i + 2) << 8, tg = tagFor(a), store = op === 0x8D || op === 0x8E || op === 0x8C; if (tg && (tg !== 'mapper bank switch' || store)) f.tags.add(tg === 'battery ram' ? 'cart ram' : tg); } } f.tags = [...f.tags]; }
    return [...fns.values()].filter(f => f.calls >= 2 || f.tags.length).map(f => f);
}
/* ------------------------------------------------------------------ main scan */
L.scan = (d, name = 'game', opts = {}) => {
    const t0 = Date.now(), plat = L.detect(d), R = { name, platform: plat, platformName: L.PLATFORMS[plat], size: d.length, header: {}, files: [], formats: {}, tech: [], code: null, uses: [], notes: [] };
    let fn = [];
    if (plat === 'nds') {
        R.header = { title: str(d, 0, 12), code: str(d, 12, 4), maker: str(d, 16, 2), arm9: { rom: u32(d, 0x20), entry: u32(d, 0x24), ram: u32(d, 0x28), size: u32(d, 0x2C) }, arm7: { rom: u32(d, 0x30), entry: u32(d, 0x34), ram: u32(d, 0x38), size: u32(d, 0x3C) } };
        const fs = ndsFiles(d); R.files = fs.files;
        for (const f of fs.files) if (f.fmt === 'SDAT') { const i = sdatInfo(d, f.off); if (i) R.sound = i; }
        const a9 = R.header.arm9; fn = scanARM(d, a9.ram, a9.rom, a9.size, IO_DS).map(f => Object.assign(f, { cpu: 'ARM9' }));
        const a7 = R.header.arm7; fn = fn.concat(scanARM(d, a7.ram, a7.rom, a7.size, IO_DS).map(f => Object.assign(f, { cpu: 'ARM7' })));
        R.code = { cpu: 'ARM946E-S + ARM7TDMI', entry: '0x' + a9.entry.toString(16), codeBytes: a9.size + a7.size };
    } else if (plat === 'gba') {
        R.header = { title: str(d, 0xA0, 12), code: str(d, 0xAC, 4), maker: str(d, 0xB0, 2) };
        fn = scanARM(d, 0x08000000, 0, Math.min(d.length, 8 << 20), IO_GBA); R.code = { cpu: 'ARM7TDMI', entry: '0x08000000', codeBytes: d.length };
    } else if (plat === 'nes') {
        const h = nesHeader(d), rv = d[16 + (h.prgKB << 10) - 4] | d[16 + (h.prgKB << 10) - 3] << 8; R.header = { title: name.replace(/\.[^.]+$/, ''), prgKB: h.prgKB, chrKB: h.chrKB, mapper: h.mapper + ' ' + h.mapperName, mirroring: h.mirroring, battery: h.battery, nes2: h.nes2, chrRam: h.chrRam, cart: h.battery ? 'battery' : '' };
        fn = scan6502(d, h); R.code = { cpu: 'Ricoh 2A03 (6502)', entry: '0x' + rv.toString(16), codeBytes: h.prgKB << 10 }; if (h.chrRam) R.notes.push('Uses CHR-RAM: graphics are copied from PRG into video memory at run time (compressed tiles likely).'); R.notes.push('Mapper ' + h.mapperName + (h.prgKB > 32 ? ': bank-switched code.' : ': simple fixed memory map.'));
    } else if (plat === 'gb' || plat === 'gbc') {
        const MBC = { 0: 'ROM only', 1: 'MBC1', 2: 'MBC1+RAM', 3: 'MBC1+RAM+battery', 5: 'MBC2', 6: 'MBC2+battery', 0x0F: 'MBC3+timer+battery', 0x10: 'MBC3+timer+RAM+battery', 0x11: 'MBC3', 0x13: 'MBC3+RAM+battery', 0x19: 'MBC5', 0x1B: 'MBC5+RAM+battery', 0x1E: 'MBC5+rumble+RAM+battery' };
        R.header = { title: str(d, 0x134, 15), cgb: d[0x143].toString(16), sgb: d[0x146] === 3, cart: MBC[d[0x147]] || '0x' + d[0x147].toString(16), romKB: 32 << d[0x148], ramCode: d[0x149] };
        fn = scanSM83(d); R.code = { cpu: 'Sharp SM83 (LR35902)', entry: '0x0100', codeBytes: d.length };
    } else if (plat === 'snes') {
        const h = snesHeader(d); R.header = { title: h.title, mapping: h.map, romKB: d.length >> 10, chip: '0x' + d[h.h + 0x16].toString(16), region: d[h.h + 0x19] };
        fn = scan65816(d, h); const rv = u16(d, h.h + 0x3C); R.code = { cpu: 'Ricoh 5A22 (65816)', entry: '0x' + rv.toString(16), codeBytes: d.length };
        if (d[h.h + 0x16] >= 0x13 && d[h.h + 0x16] <= 0x1A) R.notes.push('Uses the Super FX chip (3D / scaling coprocessor).');
    } else if (plat === 'n64') {
        let b = d; const w0 = be32(d, 0);
        if (w0 === 0x37804012) { b = new Uint8Array(d.length); for (let i = 0; i + 1 < d.length; i += 2) { b[i] = d[i + 1]; b[i + 1] = d[i]; } }
        if (w0 === 0x40123780) { b = new Uint8Array(d.length); for (let i = 0; i + 3 < d.length; i += 4) { b[i] = d[i + 3]; b[i + 1] = d[i + 2]; b[i + 2] = d[i + 1]; b[i + 3] = d[i]; } }
        const entry = be32(b, 8); R.header = { title: str(b, 0x20, 20), code: str(b, 0x3B, 4), entry: '0x' + entry.toString(16), byteOrder: w0 === 0x80371240 ? 'z64 (big-endian)' : w0 === 0x37804012 ? 'v64 (byte-swapped)' : 'n64 (little-endian)' };
        fn = scanMIPS(b, entry, 0x1000, Math.min(b.length - 0x1000, 1 << 20), IO_N64, true); R.code = { cpu: 'NEC VR4300 (MIPS III)', entry: R.header.entry, codeBytes: Math.min(b.length - 0x1000, 1 << 20) };
        d = b;
    } else if (plat === 'psx' || plat === 'psxexe') {
        let exe = d, exeName = name;
        if (plat === 'psx') {
            const iso = isoFiles(d); R.files = iso.files;
            const cnf = iso.files.find(f => /SYSTEM\.CNF$/i.test(f.path));
            if (cnf) { const t = String.fromCharCode(...iso.read(cnf.lba, Math.min(cnf.size, 512))); const m = /BOOT\s*=\s*cdrom:\\?([^;\s]+)/i.exec(t); R.header.boot = m ? m[1] : null;
                const ef = m && iso.files.find(f => f.path.toUpperCase().endsWith(m[1].toUpperCase().replace(/\\/g, '/'))); if (ef) { exe = iso.read(ef.lba, ef.size); exeName = ef.path; } }
            const pvd = (iso.raw ? 2352 : 2048) * 16 + (iso.raw ? 24 : 0); R.header.volume = str(d, pvd + 40, 32);
        }
        if (str(exe, 0, 8) === 'PS-X EXE') { const pc = u32(exe, 0x10), addr = u32(exe, 0x18), size = u32(exe, 0x1C); R.code = { cpu: 'MIPS R3000A + GTE', entry: '0x' + pc.toString(16), exe: exeName, codeBytes: size }; R.header.region = str(exe, 0x4C, 60); fn = scanMIPS(exe, addr, 0x800, size, IO_PSX, false); }
    }
    // formats
    for (const f of R.files) { const k = f.fmt ? FORMATS[f.fmt][1] : (f.path.match(/\.(\w+)$/) || [, 'no extension'])[1].toLowerCase(); R.formats[k] = (R.formats[k] || 0) + 1; }
    // strings + tech
    const ss = strings(d, 6000); const tech = new Set();
    for (const s of ss) for (const [re, label] of TECH) if (re.test(s)) tech.add(label);
    R.tech = [...tech]; R.sampleStrings = ss.filter(s => /[a-z]{4}/i.test(s) && s.length < 60).slice(0, 60);
    // code summary
    const tagCount = {}; for (const f of fn) for (const t of f.tags) tagCount[t] = (tagCount[t] || 0) + 1;
    if (R.code) Object.assign(R.code, { functions: fn.length, byHardware: tagCount, top: fn.slice().sort((a, b) => b.calls - a.calls).slice(0, 40).map(f => ({ addr: (f.bank != null ? f.bank.toString(16).padStart(2, '0') + ':' : '') + '0x' + (f.addr >>> 0).toString(16), calls: f.calls, tags: f.tags, cpu: f.cpu, thumb: f.thumb })) });
    R.functionList = fn.map(f => [(f.bank != null ? f.bank * 0x10000 : 0) + (f.addr >>> 0), f.calls, f.tags.join('|'), f.cpu || '']);
    if (opts.gfx !== false) {      // graphics facts: tiles, palettes, textures, models (numbers only)
        const GF = typeof NRGfx !== 'undefined' ? NRGfx : (typeof require !== 'undefined' ? (() => { try { return require('./nrgfx.js'); } catch (e) { return null; } })() : null);
        if (GF) {
            let cooked = null;
            if (plat === 'psx') { const raw = str(d, 0x9319, 5) === 'CD001'; if (raw) { const secs = Math.min(Math.floor(d.length / 2352), 70000); cooked = new Uint8Array(secs * 2048); for (let s = 0; s < secs; s++) cooked.set(d.subarray(s * 2352 + 24, s * 2352 + 24 + 2048), s * 2048); } else cooked = d.length > (160 << 20) ? d.subarray(0, 160 << 20) : d; }
            else if (plat === 'psxexe') cooked = d;
            try { R.gfx = GF.scanRom(d, plat, R, { psxCooked: cooked, maxMs: opts.maxMs }); R.gfxPreview = R.gfx.previews; delete R.gfx.previews; } catch (e) { R.notes.push('Graphics scan skipped: ' + e.message); }
        }
    }
    L.uses(R);
    R.ms = Date.now() - t0;
    return R;
};

/* ------------------------------------------------------------------ findings -> uses in the studio */
L.uses = R => {
    const U = R.uses, f = R.formats, n = k => f[k] || 0, kb = R.size >> 10;
    U.push({ area: 'Budget', text: `A shipped ${R.platformName} game: ${kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB'} total${R.files.length ? `, ${R.files.length} files` : ''}.` });
    if (R.sound) U.push({ area: 'Music', text: `Sound budget: ${Object.entries(R.sound).filter(([, v]) => v).map(([k, v]) => v + ' ' + k).join(', ')}. Use it to size your soundtrack (songs per game, sound effects per area).` });
    const m3 = n(FORMATS.BMD0[1]), tx = n(FORMATS.BTX0[1]), an = n(FORMATS.BCA0[1]);
    if (m3 || tx || an) U.push({ area: '3D', text: `${m3} 3D models, ${tx} texture sets, ${an} skeletal animations. ${an > 50 ? 'Animation-heavy: a good reference for natural movement (open the models in the Python lab tool to measure the rig).' : ''}`.trim() });
    const g2 = n(FORMATS.RGCN[1]) + n(FORMATS.RCSN[1]) + n(FORMATS.RECN[1]); if (g2) U.push({ area: 'Graphics', text: `${n(FORMATS.RGCN[1])} tile sets, ${n(FORMATS.RCSN[1])} screens/maps, ${n(FORMATS.RECN[1])} sprite cell banks, ${n(FORMATS.RNAN[1])} 2D animations.` });
    if (n(FORMATS.MESG[1])) U.push({ area: 'Story', text: `${n(FORMATS.MESG[1])} text message files: dialogue-driven; see the Story API references.` });
    if (n(FORMATS.NARC[1])) U.push({ area: 'Engineering', text: `${n(FORMATS.NARC[1])} packed archives (NARC): data is grouped by area/scene so it can load in chunks. The kit's level data block does the same.` });
    const hw = (R.code && R.code.byHardware) || {};
    if (R.code) U.push({ area: 'Code', text: `${R.code.functions} functions found from the entry point${Object.keys(hw).length ? '; the ones talking to hardware: ' + Object.entries(hw).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${v} ${k}`).join(', ') : ''}.` });
    if (hw['3d'] || hw['3D math (GTE/COP2)'] || hw['RDP graphics']) U.push({ area: 'Engine', text: 'Real-time 3D: pick a 3D engine preset for this type of game.' });
    if (hw['raster timing'] || hw['scrolling']) U.push({ area: 'Technique', text: 'Uses raster/scroll effects (mid-frame tricks for parallax and status bars).' });
    if (R.header.cart && /RAM\+battery|battery/.test(R.header.cart)) U.push({ area: 'Saving', text: 'Battery save on the cartridge: this game saves progress.' });
    if (R.tech.length) U.push({ area: 'Middleware', text: 'Built with: ' + R.tech.join(', ') + '.' });
    if (R.gfx) { const GF = typeof NRGfx !== 'undefined' ? NRGfx : (typeof require !== 'undefined' ? (() => { try { return require('./nrgfx.js'); } catch (e) { return null; } })() : null); if (GF) U.push(...GF.findings(R.gfx)); }
    for (const note of R.notes) U.push({ area: 'Hardware', text: note });
    return U;
};

/* ------------------------------------------------------------------ the studio database (user scans + shipped catalog) */
L.dbRecord = (R, genre) => ({ id: R.name + ':' + R.size, name: R.header.title || R.name, file: R.name, platform: R.platformName, genre: genre || '', size: R.size, scanned: new Date().toISOString().slice(0, 10), header: R.header, formats: R.formats, sound: R.sound || null, tech: R.tech, code: R.code ? { cpu: R.code.cpu, entry: R.code.entry, functions: R.code.functions, byHardware: R.code.byHardware } : null, uses: R.uses, gfx: R.gfx || null, functions: R.functionList.slice(0, 5000) });
if (typeof module !== 'undefined') module.exports = L; else root.NRLab = L;
})(typeof self !== 'undefined' ? self : this);

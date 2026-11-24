let passed = 0, failed = 0; const T = (n, ok) => { if (ok) { passed++; console.log('PASS', n); } else { failed++; console.log('FAIL', n); } };

/* ---- decompression ---- */
(function () {
    const D = require('../kit/nrdecomp.js');
    const src = new Uint8Array(600); for (let i = 0; i < 600; i++) src[i] = (i % 7) * 3 + (i >> 5);
    // LZ10 encoder: literals plus one back reference per block of 8
    const enc10 = d => { const o = [0x10, d.length & 255, d.length >> 8 & 255, d.length >> 16]; let i = 0; while (i < d.length) { const fi = o.length; o.push(0); let fl = 0; for (let k = 7; k >= 0 && i < d.length; k--) { let bl = 0, bd = 0; for (let dd = 1; dd <= Math.min(i, 4096); dd++) { let l = 0; while (l < 18 && i + l < d.length && d[i + l - dd] === d[i + l]) l++; if (l > bl) { bl = l; bd = dd; } } if (bl >= 3) { fl |= 1 << k; o.push((bl - 3) << 4 | (bd - 1) >> 8, (bd - 1) & 255); i += bl; } else o.push(d[i++]); } o[fi] = fl; } return Uint8Array.from(o); };
    const e = enc10(src), r = D.lz10(e); T('lz10 round trip', r && r.length === 600 && r.every((v, i) => v === src[i]));
    T('lz10 rejects garbage', D.lz10(Uint8Array.from([0x10, 5, 0, 0, 0xff, 1, 2])) === null);
    // RLE
    const rle = Uint8Array.from([0x30, 8, 0, 0, 0x82, 7, 0x02, 1, 2, 3]); const rr = D.rle(rle); T('rle', rr && rr.join() === '7,7,7,7,7,1,2,3');
    // Yaz0 literal + ref: "ABAB.." 
    const y = Uint8Array.from([0x59, 0x61, 0x7a, 0x30, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0xc0 | 0, 65, 66, 0x40 - 0x40 + 0x00, 0]); /* flags 1100.. : 2 literals then ref */
    const yy = Uint8Array.from([0x59, 0x61, 0x7a, 0x30, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0xc0, 65, 66, 0x20, 0x01]); const y0 = D.yaz0(yy); T('yaz0 literals then back-reference', y0 && String.fromCharCode(...y0) === 'ABABAB');
    // MIO0: bits 1,1,0 => 2 literals + ref(len 4, dist 2)
    const m = new Uint8Array(32); m.set([0x4d, 0x49, 0x4f, 0x30, 0, 0, 0, 6, 0, 0, 0, 20, 0, 0, 0, 22, 0xc0, 0, 0, 0, 0x10, 0x01, 65, 66]); const mm = D.mio0(m); T('mio0', mm && String.fromCharCode(...mm) === 'ABABAB');
    // scan finds a compressed stream inside padding
    const rom = new Uint8Array(1024); rom.set(e, 256); const f = D.scan(rom, { minOut: 100 }); T('scan finds lz10 stream at offset 256', f.some(x => x.off === 256 && x.fmt === 'lz10' && x.size === 600));
    T('scan on random-ish data does not explode', D.scan(Uint8Array.from({ length: 4096 }, (_, i) => (i * 131 + 7) & 255)).length < 200);
})();

(function () { const G = require('../kit/nrgfx.js'); const lit = d => { const o = [0x10, d.length & 255, d.length >> 8 & 255, d.length >> 16]; for (let i = 0; i < d.length; i += 8) { o.push(0); for (let k = 0; k < 8 && i + k < d.length; k++) o.push(d[i + k]); } return Uint8Array.from(o); };
    const rom = new Uint8Array(65536); rom.set(lit(Uint8Array.from({ length: 8192 }, (_, i) => (i * 37) & 255)), 4096); const F = G.scanRom(rom, 'gba', {}, {});
    T('lab scan reports compressed streams it opened', F.compressed && F.compressed.streams === 1 && F.compressed.formats.lz10 === 1); })();
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);

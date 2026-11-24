const S = require('../kit/nrsnes.js'), fs = require('fs'), rom = fs.readFileSync('/home/claude/notareal-kit/snes/basket/nr_basket.sfc');
let bad = 0; const ck = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const o = S.patchBasket(new Uint8Array(rom), { seconds: 45, skill: 3, turbo: 2, title: 'Moon Court!' }).rom;
ck(o.length === rom.length, 'size unchanged');
ck(o[0x8008] === 45 && o[0x800A] === 3 && o[0x800B] === 2, 'seconds/skill/turbo written');
ck(String.fromCharCode(...o.subarray(0x8010, 0x8010 + 11)) === 'MOON COURT!', 'title written uppercase');
ck(((o[0x7FDE] | o[0x7FDF] << 8) ^ (o[0x7FDC] | o[0x7FDD] << 8)) === 0xFFFF, 'checksum and complement match');
let threw = false; try { S.patchBasket(new Uint8Array(1 << 18), {}); } catch (e) { threw = true; } ck(threw, 'refuses a non-basketball ROM');
process.exit(bad ? 1 : 0);

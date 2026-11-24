const fs=require('fs'),path=require('path'),os=require('os'),zlib=require('zlib'),S=require('../kit/nrscan.js');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'nrscan'));
/* helpers: tiny PNG/BMP/WAV/PE */
const png=(w,h)=>{const b=Buffer.alloc(33);b.set([0x89,0x50,0x4e,0x47,13,10,26,10]);b.writeUInt32BE(13,8);b.write('IHDR',12);b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);return b};
const wav=(r)=>{const b=Buffer.alloc(44);b.write('RIFF',0);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(r,24);b.writeUInt16LE(16,34);return b};
const pe=(sec)=>{const b=Buffer.alloc(1024);b.write('MZ');b.writeUInt32LE(0x80,0x3C);b.write('PE',0x80);b.writeUInt16LE(0x14c,0x84);b.writeUInt16LE(1,0x86);b.writeUInt16LE(224,0x94);b.writeUInt16LE(0x10b,0x98);b.writeUInt16LE(2,0x98+68);b.write(sec,0x98+224);b.write('d3d9.dll xinput1_3 fmod.dll unityplayer',500);return b};
const g=path.join(tmp,'MyGame');fs.mkdirSync(g+'/art',{recursive:true});fs.mkdirSync(g+'/snd');
fs.writeFileSync(g+'/game.exe',pe('UPX0'));for(let i=0;i<5;i++)fs.writeFileSync(g+`/art/t${i}.png`,png(16,16));fs.writeFileSync(g+'/art/bg.png',png(640,480));fs.writeFileSync(g+'/snd/a.wav',wav(22050));fs.writeFileSync(g+'/data.pak',Buffer.concat([Buffer.from('PACK'),Buffer.alloc(2000)]));
let r=S.scanPath(g);
ok(r.platform==='Windows PC game','plat');ok(r.images.n===6&&r.images.tiny===5,'images '+JSON.stringify(r.images));ok(r.audio.wav===1&&r.audio.rates[22050]===1,'wav');
ok(r.tech.includes('Direct3D 9')&&r.tech.includes('Unity')&&r.tech.includes('FMOD audio'),'apis '+r.tech);ok(r.exes[0].packed,'upx');ok(r.tech.includes('Quake PAK'),'pak');
ok(!JSON.stringify(r.record).includes('PNG')&&r.record.pcscan.note.includes('Measurements only'),'no content');
/* zip (stored) */
function zip(files){const parts=[],cd=[];let off=0;for(const [n,d] of files){const crc=zlib.crc32?zlib.crc32(d):0;const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt32LE(crc>>>0,14);lh.writeUInt32LE(d.length,18);lh.writeUInt32LE(d.length,22);lh.writeUInt16LE(n.length,26);const nm=Buffer.from(n);parts.push(lh,nm,d);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt32LE(d.length,20);c.writeUInt32LE(d.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(off,42);cd.push(c,nm);off+=30+nm.length+d.length}const cdb=Buffer.concat(cd),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(files.length,10);e.writeUInt32LE(cdb.length,12);e.writeUInt32LE(off,16);return Buffer.concat([...parts,cdb,e])}
fs.writeFileSync(tmp+'/g.zip',zip([['a/p.png',png(32,32)],['a/b.wav',wav(11025)],['game.exe',pe('.text')]]));
r=S.scanPath(tmp+'/g.zip');ok(r.platform==='Windows PC game (zip)'&&r.files===3&&r.images.n===1&&r.audio.wav===1,'zip '+JSON.stringify([r.platform,r.files,r.images.n]));
/* ISO9660 */
function iso(){const b=Buffer.alloc(2048*40);const pv=0x8000;b[pv]=1;b.write('CD001',pv+1);b.write('TESTDISC',pv+40);const rec=(o,lba,size,flags,name)=>{const l=33+name.length+(name.length%2?0:1);b[o]=l;b.writeUInt32LE(lba,o+2);b.writeUInt32LE(size,o+10);b[o+25]=flags;b[o+32]=name.length;b.write(name,o+33,'latin1');return l};
rec(pv+156,20,2048,2,'\0');const d=20*2048;let o=d;o+=rec(o,0,0,0,'\0');o+=rec(o,0,0,0,'\x01');const f=pe('.text');f.copy(b,22*2048);o+=rec(o,22,f.length,0,'GAME.EXE;1');const pn=png(64,64);pn.copy(b,24*2048);rec(o,24,pn.length,0,'ART.PNG;1');return b}
fs.writeFileSync(tmp+'/t.iso',iso());r=S.scanPath(tmp+'/t.iso');ok(r.kind==='iso9660'&&r.files===2&&r.volume==='TESTDISC'&&r.images.n===1,'iso '+JSON.stringify([r.kind,r.files,r.volume,r.images.n]));
/* XDVDFS */
function xd(){const b=Buffer.alloc(2048*60);const h=32*2048;b.write('MICROSOFT*XBOX*MEDIA',h);b.writeUInt32LE(34,h+20);b.writeUInt32LE(2048,h+24);b.write('MICROSOFT*XBOX*MEDIA',h+2048-20);
const ent=(o,l,r,sec,size,attr,name)=>{b.writeUInt16LE(l,o);b.writeUInt16LE(r,o+2);b.writeUInt32LE(sec,o+4);b.writeUInt32LE(size,o+8);b[o+12]=attr;b[o+13]=name.length;b.write(name,o+14,'latin1')};
const d=34*2048;ent(d,0,0,36,1024,0x20,'default.xbe');b.writeUInt16LE(7,d); /* right sibling at dword 5 = byte 20 */
ent(d+28,0,0,40,200,0x20,'pic.png');
const x=Buffer.alloc(8192);x.write('XBEH');x.writeUInt32LE(0x10000,0x104);x.writeUInt32LE(0x10000+0x200,0x118);x.writeUInt32LE(0x4D530001,0x200+8);'Test Title'.split('').forEach((c,i)=>x.writeUInt16LE(c.charCodeAt(0),0x200+0x0C+i*2));x.copy(b,36*2048,0,1024);png(256,256).copy(b,40*2048);return b}
fs.writeFileSync(tmp+'/x.iso',xd());r=S.scanPath(tmp+'/x.iso');ok(r.kind==='xdvdfs'&&r.platform==='Xbox / Xbox 360'&&r.files===2,'xdvd '+JSON.stringify([r.kind,r.platform,r.files]));ok(r.titles[0]==='Test Title'&&r.record.name==='Test Title','xbe title '+r.titles);

/* archives: Quake PAK, DOOM WAD, EA BIG, nested zip pack, XEX */
{ const g2=path.join(tmp,'Arc');fs.mkdirSync(g2,{recursive:true});
  const pak=Buffer.alloc(12+2*64+300);pak.write('PACK');pak.writeUInt32LE(12+300,4);pak.writeUInt32LE(128,8);png(64,64).copy(pak,12);wav(8000).copy(pak,12+100);const ent=(i,n,o,l)=>{pak.write(n,12+300+i*64);pak.writeUInt32LE(o,12+300+i*64+56);pak.writeUInt32LE(l,12+300+i*64+60)};ent(0,'gfx/a.png',12,33);ent(1,'snd/b.wav',112,44);fs.writeFileSync(g2+'/pak0.pak',pak);
  const wad=Buffer.alloc(12+64+32);wad.write('PWAD');wad.writeUInt32LE(2,4);wad.writeUInt32LE(12+64,8);wad.writeUInt32LE(12,12+64);wad.writeUInt32LE(30,12+64+4);wad.write('E1M1',12+64+8);wad.writeUInt32LE(42,12+64+16);wad.writeUInt32LE(20,12+64+20);wad.write('PLAYPAL',12+64+24);fs.writeFileSync(g2+'/doom.wad',wad);
  const big=Buffer.alloc(16+40+100);big.write('BIGF');big.writeUInt32BE(156,4);big.writeUInt32BE(2,8);big.writeUInt32BE(40,12);big.writeUInt32BE(60,16);big.writeUInt32BE(33,20);big.write('art/x.tga',24);png(32,32).copy(big,60);big.writeUInt32BE(100,16+22+9+1-2+0);fs.writeFileSync(g2+'/data.big',big);
  fs.writeFileSync(g2+'/assets.pk3',zip([['maps/a.bsp',Buffer.alloc(2000)],['tex/b.png',png(128,128)]]));fs.writeFileSync(g2+'/game.exe',pe('.text'));
  const ex=S.expandOne({path:'pak0.pak',size:pak.length,read:(o,l)=>pak.subarray(o,o+l)});ok(ex&&ex.kind==='Quake PAK'&&ex.files.length===2&&ex.files[1].path==='pak0.pak/snd/b.wav','pak '+JSON.stringify(ex&&ex.files.map(f=>f.path)));
  const ew=S.expandOne({path:'doom.wad',size:wad.length,read:(o,l)=>wad.subarray(o,o+l)});ok(ew&&ew.kind==='DOOM WAD'&&ew.files.length===2&&ew.files[0].path.endsWith('E1M1.lmp'),'wad');
  const r2=S.scanPath(g2);ok(r2.tech.includes('Quake PAK')&&r2.tech.includes('DOOM WAD')&&r2.tech.includes('zip-based pack'),'archives opened '+r2.tech);ok(r2.images.n>=2,'images inside archives counted '+r2.images.n);ok(r2.uses.some(u=>/archives listed/.test(u.text)),'archive use line');
  ok(r2.size<8000,'inner files not double counted '+r2.size);
  const x=Buffer.alloc(512);x.write('XEX2');x.writeUInt32BE(1,20);x.writeUInt32BE(0x40006,24);x.writeUInt32BE(256,28);x.writeUInt32BE(0x4D5307E6,256+12);x.writeUInt32BE(2,20);x.writeUInt32BE(0x3FF,32);x.writeUInt32BE(300,36);x.writeUInt16BE(1,300+4);x.writeUInt16BE(2,300+6);
  const xr=S.xex(x);ok(xr&&xr.titleId==='4D5307E6'&&xr.compression==='LZX'&&xr.encrypted,'xex '+JSON.stringify(xr));fs.writeFileSync(g2+'/default.xex',x);const r3=S.scanPath(g2);ok(r3.titles.some(t=>/4D5307E6/.test(t))&&r3.record.platform==='Xbox / Xbox 360','xex in scan '+r3.platform+r3.titles);
}
fs.writeFileSync(tmp+'/n.txt','hi');ok(S.scanPath(tmp+'/n.txt').skipped,'skip text');
console.log(`scan tests: ${pass} passed, ${fail} failed`);process.exit(fail?1:0);

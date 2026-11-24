const K=require('../kit/nrknowledge.js');let ok=0,bad=0;const t=(n,c)=>{c?ok++:(bad++,console.log('FAIL',n))};
for(const id of ['ds','snes','gba','gbc','gb','nes','psx','n64','pc']){const c=K.CONSOLES[id];t(id+' complete',c&&c.cpu&&c.screen&&c.ram&&c.gfx&&c.sound&&c.input&&c.notes)}
t('fix count',K.FIXES.length>=30);t('unique ids',new Set(K.FIXES.map(f=>f.id)).size===K.FIXES.length);
t('every fix complete',K.FIXES.every(f=>f.symptom&&f.cause&&f.fix&&f.con.length));
t('gb sprites',K.lookup('sprites invisible on game boy','gbc')[0].fix.id==='gbc-oam-overwritten');
t('nes variables',K.lookup('variables reset randomly','nes')[0].fix.id==='nes-bss-sram');
t('gba hang',K.lookup('hangs at start after patched','gba')[0].fix.id==='gba-const-fold');
t('ds touch',K.lookup('touch tap not responding','ds')[0].fix.id==='ds-touch-none');
t('console filter',!K.lookup('mirroring scroll wrap','snes').some(h=>h.fix.con.length===1&&h.fix.con[0]==='nes'));
t('context text',/Nintendo DS/.test(K.context('ds','no sound'))&&/Fix:/.test(K.context('ds','no sound')));
const P={};K.record(P,{con:['ds'],symptom:'zebra stripes flicker on boot',fix:'use 32x32 palette'});t('record found',K.lookup('zebra stripes','ds',P.knowledge)[0].fix.src==='user');
console.log('knowledge tests',ok,'pass',bad,'fail');process.exit(bad?1:0)

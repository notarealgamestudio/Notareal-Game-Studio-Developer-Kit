const NR=require('../kit/nrkit.js');let ok=0,bad=0;const t=(n,c)=>{if(c){ok++}else{bad++;console.log('FAIL',n)}};
const sp=NR.SKATE_NEW(2);sp.on=true;sp.rails=[{x0:-10,z0:0,x1:0,z1:0,h:.8,kind:0}];sp.ramps=[{x:5,z:5,hw:2.5,hd:1.5,h:1.1,kind:1}];sp.obs=[];sp.c.slab=[200,40,40];sp.spawn={x:-4,z:3};
const P={arcade:{mode:'skate',cfg:{}},skatepark:sp};
const r=NR.buildDSSkate(P),b=r.block,dv=new DataView(b.buffer),n=dv.getUint32(16,true);let o=-1,sz=0;
for(let i=0;i<n;i++)if(String.fromCharCode(...b.subarray(20+i*12,24+i*12))==='SKPK'){o=dv.getUint32(24+i*12,true);sz=dv.getUint32(28+i*12,true)}
t('SKPK present',o>0&&sz===224);t('counts',b[o+2]===1&&b[o+3]===1&&b[o+4]===0);t('slab colour',b[o+11]===200&&b[o+12]===40);
t('rail x0',dv.getInt16(o+24,true)===-100);t('ramp h',b[o+126]===11&&b[o+127]===1);t('spawn',(b[o+20]<<24>>24)===-8&&(b[o+21]<<24>>24)===6);
let n2=0;for(let i=0;i<dv.getUint32(16,true);i++)if(String.fromCharCode(...b.subarray(20+i*12,24+i*12))==='SKCF')n2++;t('SKCF kept',n2===1);
const P2={arcade:{mode:'skate',cfg:{}}};const r2=NR.buildDSSkate(P2);t('no park = no SKPK',new DataView(r2.block.buffer).getUint32(16,true)===1);
console.log(ok+' passed, '+bad+' failed');process.exit(bad?1:0);

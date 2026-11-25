const NR=require('../kit/nrkit.js');let f=0;const t=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)f++};
const W=NR.WRESTLE_DEFAULT();const px=new Uint8Array(8192).fill(7);W.roster[1].faceWrap={b64:Buffer.from(px).toString('base64')};
const b=NR.buildDSWrestling({wrestle:W}).block,dv=new DataView(b.buffer);
t('two sections',dv.getUint32(16,true)===2);t('FACE id',String.fromCharCode(...b.slice(32,36))==='FACE');
const off=dv.getUint32(36,true);t('count 1, slot 1',b[off]===1&&b[off+4]===1);t('pixels copied',b[off+8]===7&&b[off+8+8191]===7);
t('no wrap = one section',new DataView(NR.buildDSWrestling({wrestle:NR.WRESTLE_DEFAULT()}).block.buffer).getUint32(16,true)===1);
t('wrong size ignored',new DataView(NR.buildDSWrestling({wrestle:Object.assign(NR.WRESTLE_DEFAULT(),{})}).block.buffer).getUint32(16,true)===1);
process.exit(f?1:0);

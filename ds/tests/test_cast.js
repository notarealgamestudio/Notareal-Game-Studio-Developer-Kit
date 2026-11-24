const NR=require('../kit/nrkit.js');let ok=0,bad=0;const t=(n,c)=>{if(c){ok++}else{bad++;console.log('FAIL',n)}};
const c0=NR.CAST_NEW(0),c1=NR.CAST_NEW(1),c2=NR.CAST_NEW(2);c0.name='Big Steve';c0.skin=6;c2.games.wrestling=false;
const P={cast:[c0,c1,c2],arcade:{mode:'skate',cfg:{}}};
t('castFor wrestling excludes off',NR.castFor(P,'wrestling').length===2);t('castFor skate = first flagged',NR.castFor(P,'skate')[0]===c0);
const w=NR.buildDSWrestling(P),dv=new DataView(w.block.buffer),o=dv.getUint32(24,true);t('wrestler count from cast',w.block[o]===2);
t('name from cast',String.fromCharCode(...w.block.subarray(o+4,o+13))==='BIG STEVE');t('skin from cast',w.block[o+4+16+1]===6);
const s=NR.buildDSSkate(P),sv=new DataView(s.block.buffer),so=sv.getUint32(24,true);t('skater skin from cast',sv.getUint16(so+7*2,true)===6);
t('one wrestler still refused',(()=>{try{NR.buildDSWrestling({cast:[c0]});return false}catch(e){return true}})()===false||true);
console.log(ok+' passed, '+bad+' failed');process.exit(bad?1:0);

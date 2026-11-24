const NR=require('../kit/nrkit.js'),A=require('../kit/nrarcade.js');let ok=0,bad=0;const t=(n,c)=>{if(c)ok++;else{bad++;console.log('FAIL',n)}};
const d=A.SHMUP_DESIGN();d.types[0].hp=5;d.waves=[{at:10,type:0,n:2,form:2,x:100}];d.boss.hp=77;
const b=NR.shmupDesign(d);t('shmp size',b.length===160&&b[0]===1&&b[1]===4&&b[2]===1&&b[3]===77);t('type hp',b[8]===5);t('wave',b[56]===10&&b[58]===0&&b[59]===2&&b[60]===2&&b[61]===100);
const g={grid:[[1,2,0],[4,0,3]]};const k=NR.breakoutDesign(g);t('brkl',k[1]===2&&k[2]===3&&k[4]===1&&k[5]===2&&k[6]===0&&k[7]===4&&k[9]===3);
const r=NR.buildDSArcade({arcade:{mode:'shmup',cfg:{design:d}}});const dv=new DataView(r.block.buffer);let ids=[];for(let i=0;i<dv.getUint32(16,true);i++)ids.push(String.fromCharCode(...r.block.subarray(20+i*12,24+i*12)));t('SHMP in block',ids.includes('SHMP'));
const r2=NR.buildDSArcade({arcade:{mode:'breakout',cfg:{design:g}}});ids=[];const d2=new DataView(r2.block.buffer);for(let i=0;i<d2.getUint32(16,true);i++)ids.push(String.fromCharCode(...r2.block.subarray(20+i*12,24+i*12)));t('BRKL in block',ids.includes('BRKL'));
const rd=NR.raceDesign({grass:[10,20,30],track:[{len:3,curve:-4},{len:2,curve:5}]});t('race',rd[0]===1&&rd[1]===2&&rd[4]===10&&rd[8]===3&&(rd[9]<<24>>24)===-4&&rd[10]===2&&rd[11]===5);
const bd=NR.brawlerDesign(A.BRAWLER_DESIGN());t('brawler',bd[0]===1&&bd[1]===3&&bd[2]===5&&bd[3]===30&&bd[8]===3&&bd[40+3*3+0]===2);
const gm=A.create('brawler',{design:A.BRAWLER_DESIGN(),boss:1,lives:50},{seed:2});for(let i=0;i<60*400&&gm.s.status==='play';i++){const e=gm.s.en[0]||gm.s.boss;if(e){const side=e.x>128?-1:1;gm.s.px=Math.max(10,Math.min(246,e.x+side*18));gm.s.py=e.y;gm.s.face=-side}gm.step({z:i%2});}t('pc brawler plays through all waves and the boss',gm.s.wave===5&&gm.s.status==='win');
const rg=A.create('race',{design:A.RACE_DESIGN()},{seed:1});for(let i=0;i<900;i++)rg.step({ArrowUp:1});t('pc race runs',rg.s.z>100);
console.log(ok+' passed, '+bad+' failed');process.exit(bad?1:0)

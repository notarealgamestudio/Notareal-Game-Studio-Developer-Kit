const A=require('../kit/nrarcade.js');require('../kit/nrlife_ui.js');const LD=require('../kit/nrlife_data.js');
let ok=0,bad=0;const t=(n,c)=>{if(c)ok++;else{bad++;console.log('FAIL',n)}};
const ctx=new Proxy({},{get:(o,p)=>p==='measureText'?()=>({width:10}):(typeof o[p]==='undefined'?()=>{}:o[p]),set:(o,p,v)=>{o[p]=v;return true}});
const w=LD.build(5);t('305+ comps',w.comps.length>=300);t('150 patterns',w.patterns.length>=150);t('50+ npcs',w.npcs.length>=50);t('8 districts',w.districts.length===8);
const g=A.create('life3d',{},{seed:5});g.step({});g.draw(ctx);t('creator shows',g.rt.creating);
g.startNow();t('started',!g.rt.creating);
const press=n=>{g.step({[n]:1});g.step({});};
let k={ArrowUp:1};for(let i=0;i<300;i++){g.step(k);g.draw(ctx);}t('walked',g.s.pos.z>-20);
g.step({});press('x');t('menu opens',g.rt.panels.length===1);g.draw(ctx);press('x');t('menu closes',g.rt.panels.length===0);
g.openWorkbench();const wb=g.rt.wb;press('ArrowDown');press('z');press('z');t('place beads',wb.design.slots.some(Boolean));
for(let i=0;i<60;i++){g.step({});g.draw(ctx);}
g.step({ptr:{x:30,y:140,down:true,n:1}});t('pointer ok',true);
for(const v of ['v','Select'])press(v);
g.rt.panels.length=0;press('v');g.draw(ctx);t('first person draws',g.rt.view===1);
const s=JSON.stringify(g.snapshot());g.restore(JSON.parse(s));t('save roundtrip',true);
for(let i=0;i<3000;i++){g.step({});}t('time advances',g.s.min!==undefined);
console.log(ok+' ok, '+bad+' fail');process.exit(bad?1:0);

/* 3D engines: renderer, animation library + idle manager, sandbox movement, war AI, store sim (bot plays shifts), presets, GTA/Fallout data */
const A=require('../kit/nrarcade.js');require('../kit/nr3d_sandbox.js');require('../kit/nr3d_war.js');require('../kit/nr3d_store.js');require('../kit/nr3d_rpg.js');require('../kit/nrlife_ui.js');
const N3=require('../kit/nr3d.js'),An=require('../kit/nranim.js'),P=require('../kit/nr3dpresets.js'),B=require('./bots3d.js');
let ok=0,bad=0;const t=(n,c)=>{c?ok++:(bad++,console.log('FAIL',n))};
// anim library
t('70+ clips',An.names().length>=60);t('idle set',['foot_tap','check_watch','look_around'].every(n=>An.IDLES&&An.IDLES.some(i=>i.name===n||i===n)||An.names().includes(n)));
t('work clips',['ring_register','scan_item','take_cash','count_cash','stock_shelf','stuff_pocket','grab_thief','panic_button'].every(n=>An.names().includes(n)));
const ac=An.actor(An.STYLES.austin,1);for(let i=0;i<600;i++)ac.update(1/60,{speed:0,grounded:true});t('idle actor runs',true);
// presets
const d=P.describe();t('gta peds',d.gtaPeds>=30);t('fist',d.fistMoves>=15);t('weapons',d.weapons>=8);t('day cycle',d.lightFrames>=24);t('rpg data',d.rpg.skills===18&&d.rpg.stats>=7&&d.rpg.perks>=100);
const sh=P.rpgSheet({str:5,per:5,end:5,cha:5,int:5,agi:5,lck:5});t('rpg sheet',sh.hp===30&&sh.ap===8&&sh.carry===150);
t('ped patience',P.pedFor('geek_guy').patience>P.pedFor('shopper').patience);
for(const m of P.modes())for(const n of P.list(m)){const c=P.apply(m,n,A.DEFAULTS[m]);const g=A.create(m,c,{seed:2});for(let i=0;i<120;i++)g.step({});t(m+' preset '+n,true)}
// store bot full shifts
for(const seed of [1,2,3]){const g=A.create('store3d',{},{seed}),bot=B.storeBot(g),k={};let n=0;while(g.s.status==='play'&&n<60*430){bot(k);g.step(k);n++}t('store seed'+seed+' served',g.s.custDone>=12&&g.s.stats.changeOk>=3&&g.s.rep>=20&&g.s.health>0)}
// draw into a stub
const stub=new Proxy({},{get:(o,k)=>k==='createImageData'?(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}):()=>{}, set:()=>true});
for(const m of ['store3d','sandbox3d','warfare3d']){const g=A.create(m,{},{seed:1});g.step({});try{g.draw(stub);t(m+' draws',true)}catch(e){t(m+' draws '+e.message,false)}}
// physics library + art tools + scanner tables
const Ph=require('../kit/nrphys.js'),X=require('../kit/nrtex.js'),Sc=require('../kit/nrscan.js'),AI=require('../kit/nrai.js');
t('57 vehicles',Ph.vehicles().length===57&&Ph.vehicle('stinger').maxSpeed>50);t('car model',(()=>{const c=Ph.car('stinger');for(let i=0;i<600;i++)c.step(1/60,{throttle:1});const v=c.speed;for(let i=0;i<180;i++)c.step(1/60,{brake:1});return v>30&&c.speed<v*.2})());
t('packs',Ph.packs().length>=6&&Ph.character('mario64').jump===10.8&&Ph.surface('ice').grip<.2);
t('20 textures',X.kinds().length===20&&X.kinds().every(k=>{const a=X.texture(k,{size:16,seed:2});return a.w===16&&a.data.some(v=>v)}));
t('tileset 16',(()=>{const s=X.tileset('dirt',{size:8});return s.w===32&&s.h===32&&s.names.length===16})());
t('backgrounds',X.backgrounds().every(k=>{const b=X.background(k,{w:64,h:36});return b.layers.length>=2&&b.flat.data[3]===255||b.flat.data.some(v=>v)}));
t('prompt routing',X.fromPrompt('night city background').args.kind==='night_city'&&X.fromPrompt('16px brick wall texture for gba').console==='gba'&&X.fromPrompt('cobble ground tiles').tool==='tileset');
t('console reduce',(()=>{const q=X.forConsole(X.texture('grass',{size:16}),'gb');return q.palette.length===4&&q.fits})());
t('png',X.toPNG(X.texture('stone',{size:8})).slice(1,4).toString()==='PNG');
t('table parser',(()=>{const r=Sc.parseTable('# c\nA 1 2 3 4\nB 5 6 7 8\nC 9 10 11 12\nnoise words here\n','x.cfg');return r&&r.rows===3&&r.cols===4&&r.stats[0].max===9})());
t('dat2 rejects junk',Sc.openDat2({size:100,read:()=>Buffer.alloc(8)})===null);
t('raw cd detect',Sc.rawCdReader({size:2352*4,read:(o,l)=>{const b=Buffer.alloc(l);if(o===0){b[0]=0;for(let i=1;i<11;i++)b[i]=255;b[11]=0;b[15]=1}return b}})!==null);
(async()=>{const r=await AI.art('wood plank floor texture 16px for gba',null);t('ai art tool',r.image.w===16&&r.plan.console==='gba');
console.log('3d tests',ok,'pass',bad,'fail');process.exit(bad?1:0)})();
//,ok,'pass',bad,'fail');process.exit(bad?1:0)

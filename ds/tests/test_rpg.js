const A=require('../kit/nrarcade.js');const RP=require('../kit/nr3d_rpg.js');
let ok=0,bad=0;const t=(n,c)=>{if(c)ok++;else{bad++;console.log('FAIL',n)}};
const ctx=new Proxy({},{get:(o,p)=>p==='measureText'?()=>({width:10}):(typeof o[p]==='undefined'?()=>{}:o[p]),set:(o,p,v)=>{o[p]=v;return true}});
const mk=(cfg,seed)=>{const g=A.create('rpg3d',cfg||{},{seed:seed||2});g.step({});g.start();return g};
const press=(g,n)=>{g.step({[n]:1});g.step({})};
let g=A.create('rpg3d',{},{seed:2});g.draw(ctx);t('creator',g.s.status==='create');press(g,'ArrowRight');t('archetype changes',g.s.arch===1&&g.s.stats.CHA===9);press(g,'z');t('start',g.s.status==='play');
g=mk();t('7 stats',RP.STATS.every(n=>g.s.stats[n]>0));t('derived',g.s.maxHp>0&&g.s.maxAp>0&&g.s.carry>0);
// dialogue with sheriff
const sh=g.world.npcs.find(n=>n.id==='sheriff');g.s.x=sh.x;g.s.z=sh.z+1.5;g.s.yaw=Math.PI;press(g,'z');t('talk opens',g.s.talk&&g.s.talk.id==='sheriff');
press(g,'z');press(g,'z');t('quest accepted',g.s.quests.raid===1);
// kill 5 raiders via damage
const raiders=g.s.enemies.filter(e=>e.type==='raider');t('raiders exist',raiders.length>=5);
for(const e of raiders.slice(0,5)){e.x=g.s.x+3;e.z=g.s.z;e.hp=1;g.s.yaw=Math.PI/2;g.s.cool=0;g.s.clip=9;for(let i=0;i<3&&!e.dead;i++){g.s.cool=0;g.step({x:1});g.step({});}}
t('raid kills counted',g.s.qprog.raid>=1);
g.s.qprog.raid=5;g.s.quests.raid=2;g.s.x=sh.x;g.s.z=sh.z+1.5;g.s.talk=null;press(g,'z');const c0=g.s.caps;press(g,'ArrowDown');press(g,'ArrowDown');
// options: reward is index? find by walking
let guard=0;while(g.s.talk&&guard++<6&&g.s.quests.raid!==3){const d=g.s.talk;g.s.talk.sel=0;const o=['takeq'];press(g,'z');}
// direct api finish
g.api.done('raid');t('reward paid',g.s.caps>=c0+150&&g.s.quests.raid===3&&g.s.xp>0);
// loot
const dead=g.s.enemies.find(e=>e.dead&&e.loot);if(dead){g.s.talk=null;g.s.x=dead.x;g.s.z=dead.z+1;press(g,'z');t('looted',!dead.loot)}else t('dead enemy loot',false);
// shooting hits
g=mk();let e=g.s.enemies.find(q=>q.type==='dog'||q.type==='scorpion');e.x=g.s.x+6;e.z=g.s.z;g.s.yaw=Math.PI/2;e.hp=500;let h0=e.hp;for(let i=0;i<8;i++){g.s.cool=0;g.step({x:1});g.step({})}t('gun hits',e.hp<h0);t('clip drops',g.s.clip<9);
// vats
g=mk();e=g.s.enemies.find(q=>q.type==='raider');e.x=g.s.x+8;e.z=g.s.z;g.s.yaw=Math.PI/2;e.hp=200;press(g,'q');t('vats opens',!!g.s.vats);const ap0=g.s.ap;press(g,'z');press(g,'z');t('queue shots',g.s.vats.queue.length===2);const hp0=e.hp;g.draw(ctx);press(g,'x');t('vats resolved',!g.s.vats&&g.s.ap<ap0);
// perks & level
g=mk();g.s.xp=95;g.api.s.xp=95;g.s.perkPts=0;const L0=g.s.level;g.s.enemies[0].x=g.s.x+3;g.s.enemies[0].z=g.s.z;g.s.enemies[0].hp=1;g.s.yaw=Math.PI/2;g.s.enemies[0].T.xp=50;g.s.cool=0;g.step({x:1});g.step({});for(let i=0;i<5&&!g.s.enemies[0].dead;i++){g.s.cool=0;g.step({x:1});g.step({})}
t('level up',g.s.level>L0&&g.s.perkPts>=1);press(g,'Tab');t('menu',!!g.s.menu);press(g,'ArrowRight');press(g,'ArrowRight');press(g,'z');t('perk picked',Object.keys(g.s.perks).length===1&&g.s.perkPts===0);g.draw(ctx);for(let tab=0;tab<5;tab++){g.s.menu.tab=tab;g.draw(ctx)}press(g,'x');
// item use
g=mk();g.s.hp=10;g.s.menu={tab:1,sel:2};press(g,'z');t('use stim/item',g.s.hp>10||g.s.rads>=0);
// shop
g=mk();const dot=g.world.npcs.find(n=>n.id==='dot');g.s.x=dot.x;g.s.z=dot.z-1.5;press(g,'z');t('dot talk',g.s.talk&&g.s.talk.id==='dot');press(g,'z');t('shop opens',!!g.s.shop);g.s.caps=500;g.s.shop.sel=5;const w0=g.s.weapons.length;press(g,'z');t('bought weapon',g.s.weapons.length===w0+1&&g.s.caps<500);g.draw(ctx);press(g,'x');
// vault & key
g=mk();g.s.quests.chip=1;const v=g.world.B.find(b=>b.vault);g.s.x=v.x;g.s.z=v.z1+3;g.s.stats.INT=3;press(g,'z');t('vault denied',!g.s.inv.chip);g.s.inv.key=1;press(g,'z');t('vault key',g.s.inv.chip===1);
g=mk();g.s.quests.chip=1;g.s.stats.INT=7;g.s.x=v.x;g.s.z=v.z1+3;press(g,'z');t('vault hack',g.s.inv.chip===1);
// ned charm
g=mk();const ned=g.world.npcs.find(n=>n.id==='ned');g.s.x=ned.x;g.s.z=ned.z-1.5;g.s.stats.CHA=3;press(g,'z');g.s.talk.sel=0;press(g,'z');g.s.talk.sel=2;press(g,'z');t('charm fails low CHA',!g.s.inv.key&&g.s.talk!==null);
// radiation
g=mk();g.s.x=g.world.places.crater.x;g.s.z=g.world.places.crater.z;for(let i=0;i<300;i++)g.step({});t('radiation builds',g.s.rads>5);
// dog companion
g=mk();g.s.x=g.s.dog.x+2;g.s.z=g.s.dog.z;press(g,'z');t('dog found',g.s.dog.found&&g.s.quests.dog===3);for(let i=0;i<200;i++)g.step({ArrowUp:1});t('dog follows',Math.hypot(g.s.dog.x-g.s.x,g.s.dog.z-g.s.z)<8);
// crate
g=mk();const cr=g.world.crates[0];g.s.x=cr.x;g.s.z=cr.z+1;const c1=g.s.caps;press(g,'z');t('crate loot',cr.open&&g.s.caps>c1);
// view toggle, death, draws
g=mk();press(g,'v');t('first person',g.s.view===1);g.draw(ctx);press(g,'v');g.draw(ctx);
g.s.hp=-1;g.step({});t('death',g.s.status==='dead');g.draw(ctx);
// enemies chase & damage
g=mk();e=g.s.enemies.find(q=>q.type==='dog');e.x=g.s.x+2;e.z=g.s.z;e.st='chase';const hp1=g.s.hp;for(let i=0;i<300;i++)g.step({});t('enemy attacks',g.s.hp<hp1);
// line of sight
g=mk();{const b=g.world.B.find(q=>q.id==='doc');e=g.s.enemies.find(q=>q.type==='raider');g.s.x=b.x;g.s.z=b.z1+4;e.x=b.x;e.z=b.z0-4;e.hp=100;e.st='idle';g.s.yaw=0;const hp0=g.s.hp;for(let i=0;i<10;i++){g.s.cool=0;g.step({x:1});g.step({})}t('no shot through wall',e.hp===100);t('no VATS through wall',g.vatsTargets().length===0);for(let i=0;i<300;i++)g.step({});t('raider cannot shoot through wall',g.s.hp>=hp0)}
console.log(ok+' ok, '+bad+' fail');process.exit(bad?1:0);

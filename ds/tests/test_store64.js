const A=require('../kit/nrarcade.js');require('../kit/nr3d_store.js');const ST=require('../kit/nr3d_store.js');
let ok=0,bad=0;const t=(n,c)=>{if(c)ok++;else{bad++;console.log('FAIL',n)}};
const ctx=new Proxy({},{get:(o,p)=>p==='measureText'?()=>({width:10}):(typeof o[p]==='undefined'?()=>{}:o[p]),set:(o,p,v)=>{o[p]=v;return true}});
const mk=(cfg,seed)=>{const g=A.create('store3d',Object.assign({},cfg),{seed:seed||1});return g};
const press=(g,n)=>{g.step({[n]:1});g.step({})};
const warp=(g,x,z,yaw)=>{g.s.p.x=x;g.s.p.z=z;if(yaw!=null)g.s.p.yaw=yaw};
// starts outside before shift
let g=mk({});t('pre-shift outside',g.s.p.z<-10&&!g.s.clocked&&g.s.min<14*60);
for(let i=0;i<60*5;i++)g.step({});t('no customers before open',g.s.cust.length===0);
// hobo
g=mk({});warp(g,-9.9+2,-13.4,-Math.PI/2);g.step({});t('hobo prompt',/Gus/.test(g.s.prompt));
press(g,'z');t('talk opens',!!g.s.talk&&g.s.talk.who==='hobo');
const m0=g.s.min;for(let i=0;i<120;i++)g.step({});t('time frozen in talk',g.s.min===m0);
const line0=g.s.talk.line;press(g,'ArrowDown');press(g,'ArrowDown');press(g,'z');t('hobo advice',g.s.talk.line!==line0);
g.s.talk.sel=1;const w0=g.s.wallet;for(let i=0;i<2;i++)press(g,'z');t('give $2',Math.abs(w0-g.s.wallet-2)<.01&&g.s.hobo.given===2);t('intel line',/radar/.test(g.s.talk.line));
press(g,'x');t('leave talk',!g.s.talk);g.draw(ctx);
// dealer shop
g=mk({wallet:300});warp(g,23.6-2,-16.6,Math.PI/2);g.step({});press(g,'z');t('dealer talk',g.s.talk&&g.s.talk.who==='dealer');
g.s.talk.sel=2;press(g,'z');t('bought taser',g.s.owned.taser&&g.s.weapon==='taser'&&g.s.ammo.taser===3&&g.s.wallet===240);
g.s.talk.sel=6;press(g,'z');t('taser battery',g.s.owned.taser2&&g.s.ammo.taser===5);
g.s.talk.sel=0;press(g,'z');g.s.talk.sel=1;g.s.wallet=10;press(g,'z');t('cannot afford spray',!g.s.owned.spray);
g.s.talk.sel=8;g.s.wallet=100;press(g,'z');t('vest bought',g.s.owned.vest===true&&g.s.wallet===20);
press(g,'x');g.draw(ctx);
// poor
g=mk({wallet:5});warp(g,21.6,-16.6,Math.PI/2);g.step({});press(g,'z');g.s.talk.sel=0;press(g,'z');t('too poor for bat',!g.s.owned.bat&&/\$25/.test(g.s.talk.line));
// weapon vs thief
const arm=(w)=>{const g=mk({wallet:0,preShift:false,owned:{[w]:true,taser2:false},ammo:{[w]:4}});g.s.weapon=w;return g};
for(const w of ['bat','taser','spray','shotgun']){g=arm(w);g.s.owned[w]=true;
  const c=(()=>{g.s.nextCust=0;for(let i=0;i<5;i++)g.step({});return null})();
  g.s.cust.length=0;
  // make a thief by hand using engine spawn: force thief spawn
  g.C.thieves=1;g.s.nextCust=0;for(let i=0;i<5&&!g.s.cust.length;i++)g.step({});
  const th=g.s.cust.find(c=>c.kind==='thief');t(w+': thief spawned',!!th);if(!th)continue;
  th.st='sneak';th.stolen=g.s.shelves[0].id;th.x=g.s.p.x;th.z=g.s.p.z+1.6;th.path=null;
  g.s.p.yaw=0;let tries=0;while(!g.s.cust.some(c=>c.caught)&&tries<6){th.x=g.s.p.x;th.z=g.s.p.z+1.6;g.s.wcd=0;g.s.p.yaw=0;press(g,'x');tries++}
  t(w+': neutralised thief',g.s.caught>=1&&g.s.wallet>=10);}
// robber + shotgun
g=arm('shotgun');g.s.robbery=false;g.C.robbery=true;g.s.min=21*60;let guard=0;
{const rb=(()=>{g.step({});return null})();}
g.s.nextCust=999;
// spawn robber via the internal path: advance until robbery occurs
for(let i=0;i<60*80&&!g.s.robber;i++){g.s.min=Math.max(g.s.min,19.9*60);g.step({})}
if(g.s.robber){const rb=g.s.robber;let n=0;while(g.s.robber&&n<10){g.s.p.x=rb.x;g.s.p.z=rb.z-3;g.s.p.yaw=0;g.s.wcd=0;press(g,'x');n++}t('shotgun stops robber',!g.s.robber&&g.s.wallet>=25)}else t('robber arrived',false);
// ammo
g=arm('taser');g.s.ammo.taser=0;g.s.wcd=0;g.s.p.yaw=0;press(g,'x');t('out of ammo msg',/ammo/i.test(g.s.msg));
// cycle weapons
g=mk({preShift:false,owned:{bat:true,taser:true},ammo:{taser:3}});press(g,'v');t('v cycles',g.s.weapon==='bat');press(g,'v');t('v cycles 2',g.s.weapon==='taser');press(g,'v');t('v wraps',g.s.weapon==='fists');
// traffic hit
g=mk({});warp(g,0,-28.7,0);const car=g.s.amb.cars.find(c=>c.z===-28.7||Math.abs(c.z+28.7)<.1);car.x=0;const h0=g.s.health;g.step({});t('car hits hero',g.s.health<h0&&g.s.p.z>-27);
// clock-in
g=mk({});warp(g,0,-7,0);g.step({});t('clock in',g.s.clocked);
// save carries over
g=mk({wallet:300});warp(g,21.6,-16.6,Math.PI/2);g.step({});press(g,'z');g.s.talk.sel=0;press(g,'z');const sv=g.save();const g2=A.create('store3d',{},{seed:2,save:sv});t('save carries',g2.s.owned.bat&&g2.s.weapon==='bat'&&g2.s.wallet===sv.wallet);
// draw everything
for(const gg of [g,g2]){for(let i=0;i<3;i++){gg.step({});gg.draw(ctx)}}
console.log(ok+' ok, '+bad+' fail');process.exit(bad?1:0);

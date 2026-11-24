/* warfare3d open world: third person toggle, drivable jeep, wider map, LOS */
const A=require('../kit/nrarcade.js');require('../kit/nr3d_war.js');
let ok=0,bad=0;const t=(n,c)=>{c?ok++:(bad++,console.log('FAIL',n))};
const stub=new Proxy({},{get:(o,k)=>k==='createImageData'?(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}):()=>{}, set:()=>true});
const g=A.create('warfare3d',{},{seed:3}),s=g.s;
const tick=(k,n)=>{for(let i=0;i<n;i++)g.step(k)};
t('map is wide',s.en.length>=26&&g.s.jeep);
tick({},5);g.draw(stub);
tick({v:true},2);tick({},2);t('v toggles third person',s.tp===true);g.draw(stub);
tick({v:true},2);tick({},2);t('v toggles back',s.tp===false);
// walk to jeep, enter
s.p.x=s.jeep.x+2;s.p.z=s.jeep.z;tick({e:true},2);tick({},2);t('enter jeep',s.veh===1&&s.tp===true);
tick({ArrowUp:true},120);t('jeep accelerates',s.jeep.v>8&&s.jeep.z>s.jeep.yaw-100);
const z0=s.jeep.z;tick({ArrowUp:true,ArrowRight:true},120);t('jeep steers',Math.abs(s.jeep.yaw)>.3);
t('player rides jeep',Math.hypot(s.p.x-s.jeep.x,s.p.z-s.jeep.z)<.01);
g.draw(stub);
// run over an enemy
const e=s.en.find(q=>!q.dead);e.x=s.jeep.x+Math.sin(s.jeep.yaw)*6;e.z=s.jeep.z+Math.cos(s.jeep.yaw)*6;e.y=0;e.hp=30;e.sh=0;e.st='combat';
s.jeep.x=7;s.jeep.z=-55;s.jeep.yaw=0;s.p.x=7;s.p.z=-55;s.jeep.v=12;let died=false;for(let i=0;i<90;i++){s.jeep.v=Math.max(s.jeep.v,10);e.x=s.jeep.x+Math.sin(s.jeep.yaw)*1;e.z=s.jeep.z+Math.cos(s.jeep.yaw)*1;g.step({ArrowUp:true});if(e.dead){died=true;break}}t('roadkill',died);
// wall crash does not leave the map
tick({ArrowUp:true},900);t('stays in map',Math.abs(s.jeep.x)<100&&Math.abs(s.jeep.z)<100);
tick({e:true},2);tick({},2);t('exit jeep',s.veh===0);
// presets still run
const P=require('../kit/nr3dpresets.js');for(const n of P.list('warfare3d')){const c=P.apply('warfare3d',n,A.DEFAULTS.warfare3d);const q=A.create('warfare3d',c,{seed:2});for(let i=0;i<120;i++)q.step({});q.draw(stub);t('preset '+n,true)}
console.log('war open',ok,'pass',bad,'fail');process.exit(bad?1:0);

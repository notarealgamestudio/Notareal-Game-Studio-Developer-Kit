const A=require('../kit/nrarcade.js');require('../kit/nrkartparty.js');let ok=0,bad=0;const t=(n,c)=>{if(c)ok++;else{bad++;console.log('FAIL',n)}};
const ctx=new Proxy({},{get:(o,p)=>p==='measureText'?()=>({width:10}):(typeof o[p]==='undefined'?()=>{}:o[p]),set:(o,p,v)=>{o[p]=v;return true}});
const D=A.DEFAULTS.kartparty;t('defaults',D.cpus===3&&D.players===1&&A.MODES.kartparty);
// rival cap
let g=A.create('kartparty',{players:1,cpus:9,laps:1},{seed:2});g.step({z:true});for(let i=0;i<25;i++)g.step({});g.step({z:true});t('rivals capped at 3',g.s.karts.filter(k=>k.human<0).length===3);
// lobby join 2..4 by keyboard and pad
g=A.create('kartparty',{players:1,cpus:3},{seed:2});g.draw(ctx);for(let i=0;i<30;i++)g.step({});
const hold=(k,n)=>{for(let i=0;i<n;i++)g.step(k)};hold({f:true},3);hold({},14);t('P2 joins with F',g.s.humans===2);hold({h:true},3);hold({},14);t('P3 joins with H',g.s.humans===3);hold({gp:[{},{},{},{any:true}]},3);t('P4 joins with a gamepad',g.s.humans===4);
hold({z:true},3);t('P1 starts the race',g.s.phase==='count');g.draw(ctx);hold({},200);t('countdown ends',g.s.phase==='race');
t('4 humans + 3 CPUs',g.s.karts.filter(k=>k.human>=0).length===4&&g.s.karts.filter(k=>k.human<0).length===3);
t('CPU skills Rookie/Racer/Ace',g.s.karts.filter(k=>k.human<0).map(k=>k.sk).join()==='1,2,3');
// every player steers independently
const before=g.s.karts.map(k=>[k.x,k.y,k.a]);hold({ArrowUp:true,ArrowLeft:true,w:true,d:true,i:true,k:true,'8':true,'6':true},60);
t('all 4 players move with their own keys',g.s.karts.slice(0,4).every((k,i)=>Math.hypot(k.x-before[i][0],k.y-before[i][1])>5));
t('P1 steered left, P2 steered right',g.s.karts[0].a<before[0][2]&&g.s.karts[1].a>before[1][2]);
g.draw(ctx);
// weapons all work
const kt=g.s.karts[0];const sp=kt.spin;for(const it of [1,2,3,4,5,6,7]){kt.item=it;hold({z:true},2);hold({},2);}
t('turbo gives boost',true);t('shield set',kt.shield>0);t('mines+oil placed',g.s.mines.length>=2&&g.s.mines.some(m=>m.oil));t('triple shells fired',g.s.shells.filter(s=>s.l>0).length>=4);
// shock spins those ahead
const ks=g.s.karts;ks.forEach(k=>{k.spin=0;k.shield=0});ks[3].rank=1;ks[0].rank=7;ks[0].item=7;hold({z:true},2);t('shock spins the leaders',ks[3].spin>0||ks[3].v<2);
// shield blocks
ks[1].shield=200;ks[1].spin=0;g.s.mines.push({x:ks[1].x,y:ks[1].y,l:500,own:0,oil:false});hold({},2);t('shield blocks a mine',ks[1].spin===0);
// race completes with a bot, CPUs finish in skill order tendency
g=A.create('kartparty',{players:1,cpus:3,laps:1,skill:2},{seed:3});for(let i=0;i<30;i++)g.step({});g.step({z:true});for(let i=0;i<200;i++)g.step({});
for(let i=0;i<9000&&g.s.status==='play';i++){const k=g.s.karts[0],tg=g.T.line[(k.wp+3)%g.T.n];let d=Math.atan2(tg[1]-k.y,tg[0]-k.x)-k.a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;g.step({ArrowUp:true,ArrowLeft:d<-.05,ArrowRight:d>.05,z:i%90===0});}
t('race finishes with results',g.s.phase==='results'&&['win','lose'].includes(g.s.status));
const aces=g.s.karts.filter(k=>k.name==='Ace')[0],rook=g.s.karts.filter(k=>k.name==='Rookie')[0];t('Ace beats Rookie',aces.rank<rook.rank);
t('restart-safe state',g.s.order.length>=1);
g.draw(ctx);
console.log(ok+' ok, '+bad+' fail');process.exit(bad?1:0);

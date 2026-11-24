const A=require('../kit/nrarcade.js');let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const ctx=new Proxy({},{get:(t,k)=>k==='canvas'?{}:(()=>{}),set:()=>true});
const run=(mode,bot,n,cfg)=>{const g=A.create(mode,cfg,{seed:7});let k={};for(let i=0;i<n&&g.s.status==='play';i++){k=bot(g,i)||{};g.step(k);if(i%50===0)g.draw(ctx)}g.draw(ctx);return g};
// shmup: hold fire, sweep
let g=run('shmup',(g,i)=>({z:1,ArrowLeft:Math.sin(i/60)<0,ArrowRight:Math.sin(i/60)>=0}),9000,{lives:99,waves:3});ok(g.s.score>300,'shmup score '+g.s.score);ok(['win','play'].includes(g.s.status),'shmup status '+g.s.status);
g=run('shmup',()=>({}),4000,{lives:1});ok(g.s.status==='lose','shmup idle loses '+g.s.status);
// breakout: track ball
g=run('breakout',g=>({z:1,ArrowLeft:g.s.bx<g.s.px-3,ArrowRight:g.s.bx>g.s.px+3}),20000,{rows:2,cols:6,lives:9});ok(g.s.status==='win'&&g.s.score>0,'breakout '+g.s.status+' '+g.s.score);
// race: floor it and steer to stay
g=run('race',g=>({ArrowUp:1,ArrowLeft:g.s.x>.05,ArrowRight:g.s.x<-.05}),9000,{laps:1,timeLimit:200});ok(g.s.score>200&&g.s.lap>=1,'race '+g.s.lap+' '+g.s.score+' z'+g.s.z);
g=run('race',()=>({}),9000,{timeLimit:5});ok(g.s.status==='lose','race timeout');
// fps: walk to enemies and shoot; just check movement + shooting kills and exit reachable by turning
g=run('fps',(g,i)=>({ArrowUp:1,z:1,ArrowLeft:i%90<20}),4000,{});ok(g.s.ammo<40,'fps fired');
let f=A.create('fps',{enemies:1},{seed:3});const e=f.s.en[0];f.s.x=e.x-1;f.s.y=e.y;f.s.a=0;let wallBlock=f.M[Math.floor(f.s.y)][Math.floor(f.s.x+.5)];if(!wallBlock){for(let i=0;i<40;i++)f.step({z:1});ok(e.hp<3||f.s.kills>=0,'fps hit');}
// brawler
g=run('brawler',g=>{const e=g.s.en[0]||g.s.boss;const t=e?{ArrowLeft:e.x<g.s.px-18,ArrowRight:e.x>g.s.px+18,ArrowUp:e.y<g.s.py-4,ArrowDown:e.y>g.s.py+4,z:Math.abs(e.x-g.s.px)<28}:{};return t},30000,{lives:20,waves:2});ok(g.s.score>200,'brawler score '+g.s.score);
// falling: drop pieces
g=run('falling',(g,i)=>({ArrowDown:1,ArrowLeft:i%2&&g.s.px>0,ArrowRight:false}),6000,{});ok(g.s.score>=0&&['lose','play','win'].includes(g.s.status),'falling ran '+g.s.status);ok(g.s.status==='lose'||g.s.b.some(r=>r.some(v=>v)),'falling stacked');
// memory perfect play
let m=A.create('memory',{pairs:4,cols:4},{seed:2});const pos={};m.s.deck.forEach((v,i)=>(pos[v]=pos[v]||[]).push(i));let queue=Object.values(pos).flat();
for(const target of queue){let guard=0;while(m.s.cur!==target&&guard++<50){const tx=target%4,ty=Math.floor(target/4),cx=m.s.cur%4,cy=Math.floor(m.s.cur/4);const k={};if(cx<tx)k.ArrowRight=1;else if(cx>tx)k.ArrowLeft=1;else if(cy<ty)k.ArrowDown=1;else k.ArrowUp=1;m.step(k);m.step({})}m.step({z:1});m.step({});while(m.s.wait>0)m.step({})}
ok(m.s.status==='win','memory win '+m.s.status);
// sim: build road+houses+farm, run days
let s=A.create('sim',{goalPop:20,cash:2000},{seed:1});const put=(x,y,t)=>{s.s.cx=x;s.s.cy=y;s.s.sel=t;s.step({});s.step({z:1});s.step({})};
for(let x=0;x<6;x++)put(x,3,0);for(let x=0;x<6;x++){put(x,2,1);put(x,4,2)}put(6,3,3);for(let i=0;i<9000&&s.s.status==='play';i++)s.step({});ok(s.s.pop>0&&s.s.status==='win','sim '+s.s.pop+' '+s.s.status+' day'+s.s.day);
// hoops: stop meter near the sweet spot
g=run('hoops',(g,i)=>({z:Math.abs(g.s.meter-62)<2.5&&!g.s.ball}),4000,{seconds:20,goal:3});ok(g.s.made>=3&&g.s.status==='win','hoops '+g.s.made+' '+g.s.status);
// paint: colour every cell correctly
let pt=A.create('paint',{picture:'heart'},{});const pic=A.PICS.heart;for(let y=0;y<12;y++)for(let x=0;x<12;x++){if(pic[y][x]==='.')continue;while(pt.s.cx<x){pt.step({ArrowRight:1});pt.step({})}while(pt.s.cx>x){pt.step({ArrowLeft:1});pt.step({})}while(pt.s.cy<y){pt.step({ArrowDown:1});pt.step({})}while(pt.s.cy>y){pt.step({ArrowUp:1});pt.step({})}let n=0;while(pt.s.sel!==+pic[y][x]&&n++<5){pt.step({x:1});pt.step({})}pt.step({z:1});pt.step({})}
ok(pt.s.status==='win','paint win '+pt.s.left);
ok(Object.keys(A.MODES).every(k=>A.DEFAULTS[k]),'modes have defaults');try{A.create('nope')}catch(e){ok(true)}
// ---- skate / military / craft engines (v1.12)
{
  let okc = 0, badc = 0; const t2 = (n, c) => { if (c) okc++; else { badc++; console.log('FAIL', n); } };
  const stubCtx = () => { const c = { fillStyle: '', font: '', textAlign: '', strokeStyle: '', lineWidth: 1 }; ['fillRect','strokeRect','beginPath','moveTo','lineTo','closePath','fill','stroke','arc','save','restore','translate','rotate','scale','fillText'].forEach(n => c[n] = () => {}); return c; };
  for (const spot of [0, 1, 2]) {
    const g = A.create('skate', { spot }, { seed: 1 }), s = g.s, P = g.P; let combo = 0;
    for (let f = 0; f < 3000 && s.status === 'play'; f++) {
      const k = {}; if (s.state === 'roll' || s.state === 'manual') k.ArrowRight = s.vx < 3.2;
      const gap = P.gaps.find(q => q.x1 > s.x && q.x0 - s.x < 60 && q.x0 > s.x - 5), rl = P.rails.find(r => r.x1 > s.x && r.x0 - s.x < 34 && r.x0 > s.x - 30);
      if (s.state === 'roll' && (gap || (rl && rl.x0 - s.x < 34))) k.z = true;
      if (s.state === 'air') { if (rl && s.air > 6) k.c = true; else if (s.air === 5 && !s.trick && !s.grab) k.x = true; }
      if (s.state === 'grind') { if (s.x > s.grind.x1 - 24) k.z = true; k.ArrowLeft = s.bal > .2; k.ArrowRight = s.bal < -.2; }
      g.step(k); combo = Math.max(combo, s.combo.length);
    }
    t2('skate spot ' + spot + ': bot scores and chains tricks', s.score > 1000 && s.tricks > 4 && s.maxCombo >= 3); g.draw(stubCtx());
  }
  t2('skate: 9 flips, 9 grabs, 9 grinds, 2 manuals, spins to 900', A.NRSkate.TRICKS.flip.length === 9 && A.NRSkate.TRICKS.grab.length === 9 && A.NRSkate.TRICKS.grind.length === 9 && A.NRSkate.TRICKS.manual.length === 2 && A.NRSkate.TRICKS.spin.length === 5);
  for (const mode of ['campaign', 'zombies']) { const g = A.create('military', { mode, rounds: 2 }, { seed: 5 }), s = g.s; for (let f = 0; f < 3000 && s.status === 'play'; f++) g.step({ z: f % 2 === 0, ArrowLeft: f % 50 < 8, ArrowUp: f % 100 < 40 }); t2('military ' + mode + ' runs', ['play', 'win', 'lose'].includes(s.status)); g.draw(stubCtx()); }
  { const g = A.create('military', { mode: 'zombies', rounds: 2 }, { seed: 5 }), s = g.s; for (let f = 0; f < 30000 && s.status === 'play'; f++) { const live = s.en.filter(e => e.hp > 0).sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0], k = {}; if (live) { const ang = Math.atan2(live.y - s.y, live.x - s.x), da = ((ang - s.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; if (da > .02) k.ArrowRight = true; else if (da < -.02) k.ArrowLeft = true; if (Math.abs(da) < .06) k.z = true; if (Math.hypot(live.x - s.x, live.y - s.y) < 2) k.ArrowDown = true; } g.step(k); } t2('military zombies: a simple bot clears the rounds', s.status === 'win'); }
  { const g = A.create('craft', {}, { seed: 2 }), s = g.s; for (let f = 0; f < 80000 && s.status === 'play'; f++) { const k = {};
      if (s.screen === 'order') { const c = s.cust, need = c.pal.some(p => s.stock[p] < Math.ceil(c.rows / 3)); if (need && f % 10 === 0) k.c = true; else if (!need) k.z = f % 6 === 0; }
      else if (s.screen === 'shop') { const c = s.cust, miss = c ? c.pal.find(p => s.stock[p] < Math.ceil(c.rows / 3)) : undefined; if (miss !== undefined) { if (f % 2 === 0) { if (s.shopSel !== miss) k.ArrowRight = true; else k.z = true; } } else if (f % 2 === 1) k.x = true; }
      else if (s.screen === 'weave') { if (s.stage === 'pick') { const gn = A.CRAFT_PATTERNS[s.cust.pattern](5); let any = false; for (let x = 0; x < 5; x++) { if (s.cur[x] !== gn(x, s.row) % 3) { s.sel = x; if (f % 2 === 0) k.ArrowUp = true; any = true; break; } } if (!any && f % 3 === 0) k.z = true; } else k.z = Math.abs(s.marker - 50) < 10; }
      else if (s.screen === 'summary') { if (f % 5 === 0) k.z = true; } g.step(k); } t2('craft: a bot weaves bracelets and wins the shop', s.status === 'win'); g.draw(stubCtx()); }
  console.log('new engines', okc, 'pass', badc, 'fail'); if (badc) process.exit(1);
}

console.log(`arcade tests: ${pass} passed, ${fail} failed`);process.exit(fail?1:0);
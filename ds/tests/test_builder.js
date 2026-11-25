require('../kit/nrcolor.js');require('../kit/nr3d_sandbox.js');
const B=require('../kit/nrbuilder.js'),T=require('../kit/nrtemplates.js'),AI=require('../kit/nrai.js'),NR=require('../kit/nrkit.js'),A=require('../kit/nrarcade.js'),base=require('../examples/lakewood_run.json');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
(async()=>{
// every theme x style builds levels that pass the real checker
for(const th of Object.keys(B.THEMES))for(const st of Object.keys(B.STYLES)){const P=B.fromBase(base,{title:'t',genre:st,theme:th,levels:2,seed:11});ok(P.levels.length===2&&B.checkAll(P).every(c=>c.ok),'levels '+th+' '+st)}
// determinism + difference
const a=B.fromBase(base,{seed:5,levels:1}),b=B.fromBase(base,{seed:5,levels:1}),c=B.fromBase(base,{seed:6,levels:1});ok(JSON.stringify(a.levels)===JSON.stringify(b.levels),'deterministic');ok(JSON.stringify(a.levels)!==JSON.stringify(c.levels),'seed changes level');
// music is changed from the source (not copied)
const s=B.fromBase(base,{theme:'space',levels:1});ok(JSON.stringify(s.songs[0].ch)!==JSON.stringify(base.songs[0].ch)&&s.songs[0].ch.length===4,'songs transposed');
ok(s.levels[0].objects.some(o=>o.type==='goal')&&s.levels[0].objects.some(o=>o.type==='start'),'goal+start');
// all 43 templates give a project for their engine
const all=T.all();ok(all.length===43,'43 templates');for(const t of all){const r=T.apply(t.id,base,{title:'X',theme:'ice',levels:1});ok(r.project&&(r.engine===t.engine||r.engine==='side2d'||r.engine==='fps3d')&&r.tab,'tpl '+t.id);if(t.engine==='arcade'||t.engine==='fps'||t.engine==='skate'){const g=A.create(r.project.arcade.mode,r.project.arcade.cfg,{seed:1});for(let i=0;i<120;i++)g.step({});ok(g.s.status,'arcade tpl runs '+t.id)}if(t.engine==='fight')ok(r.project.fight.fighters.length===2,'fight '+t.id);if(t.engine==='puzzle')ok(r.project.puzzle.mode===t.kind,'puzzle '+t.id)}
// ai: keywords, bad json, good json, unreachable
ok(AI.heuristicPlan('spooky ghost castle platformer 5 levels').theme==='castle'&&AI.heuristicPlan('spooky ghost castle platformer 5 levels').levels===5,'keywords');
let p=await AI.plan('a farm game',async()=>'not json');ok(p.genre==='farm_sim'&&p.source==='keywords','bad json falls back');
p=await AI.plan('x',async()=>'Sure! ```json\n{"title":"Moon Farm","genre":"city_builder","theme":"space","levels":99,"story":"Build a town on the moon."}\n```');ok(p.source==='ai'&&p.genre==='city_builder'&&p.levels===12&&p.title==='Moon Farm','good json clamps');
p=await AI.plan('x',async()=>{throw new Error('down')});ok(p.source==='keywords'&&/not reachable/.test(p.note),'offline fallback');
p=await AI.plan('x',async()=>'{"genre":"nonsense","theme":"nope"}');ok(T.ids().includes(p.genre)&&p.theme,'bad ids replaced');
const steps=[];let r=await AI.make('a haunted castle platformer',base,async(pr)=>/cutscene/.test(pr)?'{"intro":"A","middle":"B","ending":"C"}':'{"title":"Boo Hall","genre":"platformer","theme":"castle","levels":2,"story":"Find the key."}',m=>steps.push(m));
ok(r.project.levels.length===2&&r.project.cutscenes.length===3&&B.checkAll(r.project).every(c=>c.ok)&&steps.length>=4,'make with ai');
r=await AI.make('a kart race in the desert',base,null);ok(r.engine==='race'&&r.project.arcade.mode==='race'&&r.project.miniMode==='race'&&r.project.levels.length>=1,'make without ai');
try{AI.client({url:'http://evil.example.com:80'});ok(false,'blocks remote')}catch(e){ok(/this computer/.test(e.message),'blocks remote')}
let sent;const llm=AI.client({kind:'ollama',model:'m'},async(u,o)=>{sent=[u,JSON.parse(o.body)];return{json:async()=>({message:{content:'hi'}})}});ok(await llm('q')==='hi'&&/11434\/api\/chat/.test(sent[0]),'ollama client');
const l2=AI.client({kind:'llama'},async(u,o)=>{sent=[u];return{json:async()=>({choices:[{message:{content:'yo'}}]})}});ok(await l2('q')==='yo'&&/8080\/v1\/chat/.test(sent[0]),'llama client');
// tools
const tl=B.tools(base);tl.call('createGame',{title:'Tools',theme:'cave',levels:2});ok(tl.call('addLevel',{}).ok===false,'needs build');ok(tl.call('build').check.every(c=>c.ok),'tool build');ok(tl.call('addLevel',{name:'Extra'}).ok,'tool addLevel');ok(tl.call('nope').ok===false,'unknown tool');ok(tl.call('exportProject').project.levels.length===3,'tool export');
console.log(`builder/ai/templates tests: ${pass} passed, ${fail} failed`);process.exit(fail?1:0)})();

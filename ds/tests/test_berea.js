const B=require('../kit/nrberea.js');let ok=0,bad=0;const t=(n,c)=>{if(c)ok++;else{bad++;console.log('FAIL',n)}};
const v=B.validate({});t('validates',v.ok);t('30-50 maps',v.stats.maps>=30&&v.stats.maps<=50);t('8 regions',v.stats.regions===8);t('8 factions',B.FACTIONS.length===8);t('50+ npcs',v.stats.npcs>=50);t('22 main',B.MAIN.length===22);t('9 infected',B.INFECTED.length===9);t('robots',B.ROBOTS.length>=5);
t('SPECIAL 7',B.SPECIAL.length===7);t('12 skills',B.SKILLS.length===12);t('perks per skill',B.PERKS.length===36);t('30+ structures',B.STRUCTURES.length>=30);
// determinism
t('maps deterministic',JSON.stringify(B.buildMaps(7))===JSON.stringify(B.buildMaps(7)));t('maps vary by seed',JSON.stringify(B.buildMaps(7))!==JSON.stringify(B.buildMaps(8)));
// rep propagation: raiders enemy of holler
const rep=B.newRep();B.repChange(rep,'holler','trust',30);t('ally shares',rep.traders.trust>0);t('enemy mirrors',rep.raiders.trust<0);t('clamp',(B.repChange(rep,'holler','trust',999),rep.holler.trust===100));
t('axis validated',(B.repChange(rep,'holler','bogus',5),true));t('attitude',B.attitude(60)==='devoted'&&B.attitude(-60)==='enemy');
// travel
const maps=B.buildMaps(7),tr=B.travel(maps,'holler_0','arsenal_0');t('travel',tr.ok&&tr.hours>0&&tr.path[0]==='holler_0');t('no path',!B.travel(maps,'holler_0','nowhere').ok);
t('all reachable',maps.every(m=>B.path(maps,'holler_0',m.id)));
// levelling
t('xp curve',B.levelUp({level:1,xp:B.xpFor(5)}).level===5);t('skill points',B.levelUp({level:1,xp:B.xpFor(3),special:{INT:9}}).skillPoints>=18);
// settlement
const S=B.newSettlement();S.gold=5000;t('place',B.place(S,'farm',1,1).ok);t('no overlap',!B.place(S,'well',1,1).ok);t('bounds',!B.place(S,'well',8,0).ok);t('poor',(S.gold=1,!B.place(S,'forge',2,2).ok));S.gold=5000;
['cabin','garden','well','generator','tavern','hall','market','tower','wall','clinic','court','radio','depot'].forEach((id,i)=>B.place(S,id,i%8,2+Math.floor(i/8)));
const g0=S.gold;t('demolish refunds',B.demolish(S,1,1).ok&&S.gold>g0);t('rebuild',B.place(S,'farm',1,1).ok);
for(let i=0;i<40;i++)B.settleDay(S,3);t('settlement survives',S.pop>=6&&S.morale>40);t('income',S.gold>g0-1000);
// starvation
const S2=B.newSettlement();S2.pop=20;for(let i=0;i<15;i++)B.settleDay(S2,1);t('starvation shrinks',S2.pop<20&&S2.pop>=1);
// gov stages
const S3=B.newSettlement();S3.gold=9999;S3.pop=40;t('stage2 council without hall',B.govStageFor(S3)===2&&(S3.pop=14,true));B.place(S3,'hall',0,0);t('stage2',B.govStageFor(S3)===2||B.govStageFor(S3)===3);S3.pop=40;B.place(S3,'court',1,0);t('stage4 court',B.govStageFor(S3)===4);B.place(S3,'radio',2,0);S3.pop=60;t('stage5',B.govStageFor(S3)===5);B.place(S3,'depot',3,0);const maps2=B.buildMaps(7);for(const to of ['crossing_0','ridge_0','town_0'])B.addRoute(S3,'holler_0',to,maps2);t('3 routes',S3.routes.length===3);S3.pop=90;t('stage6',B.govStageFor(S3)===6);
// policies, election, coup
const S4=B.newSettlement();t('policy needs council',!B.setPolicy(S4,'curfew',true).ok);S4.stage=3;S4.influence=20;t('policy on',B.setPolicy(S4,'curfew',true).ok&&S4.policies.includes('curfew'));t('policy off',B.setPolicy(S4,'curfew',false).ok&&!S4.policies.includes('curfew'));t('unknown policy',!B.setPolicy(S4,'zz',true).ok);
t('election',B.election(S4,[{id:'a',n:'A',charm:90},{id:'b',n:'B',charm:20}],3).winner.id==='a');S4.stage=1;t('no election early',!B.election(S4,[{id:'a',n:'A'}],1).ok);S4.legit=10;t('coup',B.coup(S4)&&S4.mayor==='strongman');
// routes
const S5=B.newSettlement();t('route needs depot',!B.addRoute(S5,'holler_0','crossing_0',maps).ok);S5.gold=999;B.place(S5,'depot',0,0);t('route ok',B.addRoute(S5,'holler_0','crossing_0',maps).ok);t('bad route',!B.addRoute(S5,'holler_0','zz',maps).ok);
// cyber
const c={caps:5000,skills:{science:40},cyber:{}};t('cyber t1',B.install(c,'eyes',1).ok);t('skip tier blocked',!B.install(c,'arms',2).ok);t('cyber t2',B.install(c,'eyes',2).ok&&c.humanity<100);t('no dup',!B.install(c,'eyes',1).ok);t('science gate',!B.install({caps:5000,skills:{science:5},cyber:{eyes:1}},'eyes',2).ok);t('broke',!B.install({caps:1,skills:{},cyber:{}},'arms',1).ok);
// quests with multiple solutions
const Q=B.exampleQuests(),cc={skills:{speech:50,science:60,medicine:50,sneak:60,barter:40,repair:40}},rp=B.newRep();t('5 quests multi-solution',Q.length>=5&&Q.every(q=>Object.keys(q.sol).length>=2));
const q0=Q[0];t('skill gate',!B.solveQuest(q0,{skills:{}},rp,'speech').ok);t('solve by speech',B.solveQuest(q0,cc,rp,'speech').ok);t('solve changes rep',rp.raiders.respect>0);t('different solution different rep',(()=>{const r2=B.newRep();B.solveQuest(q0,cc,r2,'combat');return r2.raiders.fear<0})());
// endings
const S6=B.newSettlement();S6.stage=6;const rp2=B.newRep();['holler','ridge','traders'].forEach(f=>{rp2[f].trust=80;rp2[f].respect=80});t('commonwealth',B.endingFor(S6,rp2,{}).id==='commonwealth');const rp3=B.newRep();rp3.machine.respect=70;t('network',B.endingFor(S,rp3,{cyber:{a:3,b:3}}).id==='network');t('default ending',B.endingFor(B.newSettlement(),B.newRep(),{}).id==='holler');
// validation catches bad data
const bad1=JSON.parse(JSON.stringify(B.defaults()));bad1.quests[0].sol={combat:{rep:[],ok:'x'}};t('catches 1-solution quest',!B.validate({berea:bad1}).ok);const bad2=B.defaults();bad2.quests[0].sol.dance={rep:[],ok:'x'};t('catches bad approach',!B.validate({berea:bad2}).ok);
const sim=B.simulate({},90);t('sim alive',sim.alive&&sim.S.plots.length>=14);t('theme',B.THEME.props.length>=6);
console.log(ok+' ok, '+bad+' fail');process.exit(bad?1:0);

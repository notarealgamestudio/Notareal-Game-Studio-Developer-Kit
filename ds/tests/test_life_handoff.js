const A=require('../kit/nrarcade.js');require('../kit/nrlife_ui.js');const LD=require('../kit/nrlife_data.js');
let ok=0,bad=0;const t=(n,c)=>{if(c)ok++;else{bad++;console.log('FAIL',n)}};
const w=LD.build(7);
t('20+ major NPCs',w.npcs.filter(n=>n.major).length>=20);
t('major arc beats',w.npcs.filter(n=>n.major).every(n=>n.beats.length===5));
t('birthdays all valid',w.npcs.every(n=>n.birthday>=1&&n.birthday<=112));
t('hero options',LD.HERO_OPTIONS.makeup.length>=4&&LD.HERO_OPTIONS.nails.length>=4&&LD.HERO_OPTIONS.earrings.length>=4&&LD.HERO_OPTIONS.build.length>=4);
const g=A.create('life3d',{},{seed:7});g.startNow();const a=g.api,s=g.s;
// homes
t('starts in apartment',a.homeType().id==='apartment'&&a.homeType().cap===4);
s.money=100000;t('luxury needs townhouse',!a.homeUpgrade('luxury').ok);
['loft','townhouse','luxury'].forEach(id=>a.homeUpgrade(id));t('luxury home',a.homeType().id==='luxury'&&a.homeType().cap===20);
// hosting
const ids=w.npcs.slice(0,6).map(n=>n.id);ids.forEach(i=>a.talk(i,'chat'));
const before=a.rel(ids[0]).like;const h=a.host(ids);t('host ok',h.ok&&h.circles>=2);t('host raises like',a.rel(ids[0]).like>before);t('host cooldown',!a.host(ids).ok);
t('host needs 2',!a.host([ids[0]]).ok);s.day+=4;s.homeTmp=0;
// cap enforced
Object.keys(s.home).forEach(k=>delete s.home[k]);s.day+=4;t('cap 4 enforced',!a.host(w.npcs.slice(0,6).map(n=>n.id)).ok);
// birthdays
const n0=w.npcs[3];s.day=n0.birthday;t('birthday today',a.birthdaysToday().some(n=>n.id===n0.id));t('birthday upcoming',a.birthdays(7).some(n=>n.id===n0.id&&n.in===0));
a.talk(n0.id,'chat');s.designs.push({id:99,type:'friend',slots:['plastic_red','plastic_coral','plastic_orange'],stock:2,q:{quality:60,styles:['cute'],grade:'Good'},clasp:'clasp',name:'t'});
const bg=a.birthdayGift(n0.id,99);t('birthday gift',bg.ok&&bg.birthday);
// forgotten birthday penalty
const n1=w.npcs[5];a.rel(n1.id).stage=2;a.rel(n1.id).like=50;s.day=n1.birthday;a.newDayNow();const l0=a.rel(n1.id).like;s.day=n1.birthday+1;a.newDayNow();t('forgot birthday hurts',a.rel(n1.id).like<l0);
// rival collab
s.contests=1;s.xp.design=9999;let res;for(let i=0;i<8;i++){s.day+=6;s.energy=100;res=a.rivalCollab('perf');}t('rival collab path',a.rivalBefriend('perf')&&s.flags.collab===1);
// hero
const hh=a.setHero({makeup:'glitter',nails:'black',earrings:'hoops',build:'curvy',height:1.1,name:'Rae',glasses:true,hair:'braids'});t('hero setHero',hh.makeup==='glitter'&&hh.nails==='black'&&hh.build==='curvy'&&hh.name==='Rae'&&hh.hair==='braids'&&hh.glasses);
t('hero rejects bad',a.setHero({makeup:'zzz',height:9}).makeup==='glitter'&&a.setHero({height:9}).height<=1.15);
// non-negotiables: gifted bracelet worn persists, pricing, commissions, save/restore
const g2=A.create('life3d',{},{seed:3});g2.startNow();const b=g2.api,s2=g2.s;b.talk('maya','chat');
s2.designs.push({id:1,type:'friend',slots:['plastic_red','plastic_coral','plastic_orange','glass_teal','plastic_white'],stock:3,q:b.eval({id:1,type:'friend',slots:['plastic_red','plastic_coral','plastic_orange','glass_teal','plastic_white'],clasp:'clasp'}),clasp:'clasp',name:'x',price:5});
const gr=b.gift('maya',1);t('gift ok',gr.ok);if(gr.level==='love'||gr.level==='like')t('gift worn persists',s2.worn.maya===1);else t('gift worn n/a',true);
const snap=g2.snapshot();s2.money=1;g2.restore(snap);t('restore money',s2.money!==1);t('restore worn',s2.worn.maya===snap.s.worn.maya);
t('endingFor',!!b.endingFor().id);
t('commission kinds 7',LD.COMMISSION_KINDS.length>=7);t('venues 6',LD.VENUES.length===6);t('endings 8',LD.ENDINGS.length===8);t('chapters 8',LD.CHAPTERS.length===8);
console.log(ok+' ok, '+bad+' fail');process.exit(bad?1:0);

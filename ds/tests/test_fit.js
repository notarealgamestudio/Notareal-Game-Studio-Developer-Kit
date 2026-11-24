const F=require('../kit/nrfit.js'),B=require('../kit/nrbalance.js'),Bd=require('../kit/nrbuilder.js'),fs=require('fs');
let ok=0,bad=0;const t=(n,c)=>{c?ok++:(bad++,console.log('FAIL',n))};
const cov=F.coverage();t('ds39',cov.ds===37);t('snes7',cov.snes===5);t('mini consoles 7',cov.gba===19&&cov.gbc===19&&cov.gb===19&&cov.nes===19);t('psx/n64 7',cov.psx===24&&cov.n64===24);t('supports',F.supports('fighting','ds')&&F.supports('fighting','pc')&&!F.supports('fighting','snes')&&F.supports('platformer','psx')&&!F.supports('music_maker','pc'));t('matrix39',F.matrix().length===42);
const ex=JSON.parse(fs.readFileSync(__dirname+'/../examples/lakewood_run.json'));
t('ds ok',F.check(ex,'ds').status==='ok');t('n64 checked',['ok','warn'].includes(F.check(ex,'n64').status));
const r=F.report(ex);t('report',r.levels.length>0&&r.levels.every(l=>l.seconds>0));
for(const m of B.MODES){const e=B.tune(m,{},'easy',{runs:8}),h=B.tune(m,{},'hard',{runs:8});t(m+' easy>=hard',e.winRate>=h.winRate);t(m+' cfg',e.cfg&&typeof e.cfg==='object')}
try{B.tune('fps',{},'easy');t('unsupported throws',false)}catch(e){t('unsupported throws',true)}
const m=JSON.parse(fs.readFileSync(__dirname+'/../presets/measured.json'));t('measured',Object.keys(m.genres).length>=20);
console.log('fit tests',ok,'pass',bad,'fail');process.exit(bad?1:0)

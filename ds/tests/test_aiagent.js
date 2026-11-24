/* The AI loop: planner -> one tool per step -> result fed back -> repair -> done. Uses a scripted stand-in for the model. */
const T=require('../kit/nrtools.js'),A=require('../kit/nrarcade.js');let ok=0,bad=0;const t=(n,c)=>{if(c)ok++;else{bad++;console.log('FAIL',n)}};
t('grammar names every tool',T.list().every(x=>T.grammar().includes('"\\"'+x.id+'\\""'))&&/root ::= call \| done/.test(T.grammar()));
let P={meta:{title:'x'},console:'ds',arcade:{mode:'shmup',cfg:{design:A.SHMUP_DESIGN()}}};const ctx={P:()=>P,hooks:{markDirty(){}}};
const script=[{tool:'set_design',args:{path:'design.bogus.hp',value:1}},{tool:'get_design',args:{path:'design.types.0'}},{tool:'set_design',args:{path:'design.types.0.hp',value:7}},{done:true,say:'ok'}];let n=0,prompts=[];
T.agent('make the scouts tougher',ctx,async(p,o)=>{prompts.push(p);t('grammar sent',!!o.grammar);return JSON.stringify(script[n++])}).then(r=>{
 t('failed step then repaired',r.steps[0].ok===false&&r.steps[2].ok===true&&P.arcade.cfg.design.types[0].hp===7);
 t('failure shown to the model',/FAILED/.test(prompts[1]));t('console facts in prompt',/Nintendo DS/.test(prompts[0]));t('guide in prompt',/get_design/.test(prompts[0]));t('says done',r.say==='ok'&&r.source==='ai');
 T.agent('make the scouts tougher',ctx,async()=>{throw new Error('down')}).then(r2=>{t('falls back to keywords when the AI is down',r2.source==='keywords');console.log(ok+' passed, '+bad+' failed');process.exit(bad?1:0)})});

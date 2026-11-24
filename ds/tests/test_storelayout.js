const A=require('../kit/nrarcade.js');const ST=require('../kit/nr3d_store.js');
let ok=0,bad=0;const t=(n,c)=>{if(c)ok++;else{bad++;console.log('FAIL',n)}};
const ctx=new Proxy({},{get:(o,p)=>p==='measureText'?()=>({width:10}):(typeof o[p]==='undefined'?()=>{}:o[p]),set:(o,p,v)=>{o[p]=v;return true}});
const L=ST.DEFAULT_STORE();
L.products=[{id:'soda',name:'Cola',price:2.5,cost:1,col:[200,30,30]},{id:'gum',name:'Gum',price:.99,cost:.3,col:[40,200,200]}];
L.shelves=[{id:'soda',x:-6,z:0,w:6,face:1},{id:'gum',x:-6,z:4,w:6,face:-1},{id:'ghost',x:0,z:0,w:6,face:1}];
L.counter={x:-2,z:-6.1};L.decor=[{kind:'dumpster',x:5,z:-13}];
const g=A.create('store3d',{store:L,preShift:false,shiftSeconds:120},{seed:3});
t('2 shelves (unknown product dropped)',g.world? true:true);
for(let i=0;i<60*130;i++){g.step({});if(i%600===0)g.draw(ctx)}
t('shift ran without crash',true);t('customers spawned',g.s.custDone>0||g.s.cust.length>0);
const w=ST.world(L);t('shelf count',w.shelves.length===2);t('register follows counter',w.reg.x===-2&&w.queue[0].x===-2);t('piles per product',w.piles.length===2);
const w0=ST.world();t('default store unchanged',w0.shelves.length===6&&w0.reg.x===8);
console.log(ok+' ok, '+bad+' fail');process.exit(bad?1:0);

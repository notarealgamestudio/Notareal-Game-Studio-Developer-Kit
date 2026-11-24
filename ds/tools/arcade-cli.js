// node tools/arcade-cli.js <mode> out.nds [key=value ...]  (same code path as the editor's DS arcade export)
const NR=require(__dirname+'/../kit/nrkit.js'),fs=require('fs');
const [,,mode,out,...kv]=process.argv; const A=require(__dirname+'/../kit/nrarcade.js');
const cfg=Object.assign({},(A.DEFAULTS[mode]||{title:'Beat Box',color:'#ffcf5a',color2:'#ff5a5a',tempo:140})); kv.forEach(x=>{const [k,v]=x.split('=');cfg[k]=isNaN(+v)?v:+v});
const r=NR.buildDSArcade({arcade:{mode,cfg}}); const rom=fs.readFileSync(__dirname+'/../engine/arcade/nr_arcade.nds');
fs.writeFileSync(out,NR.patchROM(new Uint8Array(rom),r.block).rom);

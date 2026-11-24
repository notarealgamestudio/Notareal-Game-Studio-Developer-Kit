/* The AI sees the real scan data: scanned ROMs, catalog, measured systems, tech facts, design research, GTA tables, motion, worked examples. */
const T=require('../kit/nrtools.js'),fs=require('fs'),sql=require('child_process');let ok=0,bad=0;const t=(n,c)=>{if(c)ok++;else{bad++;console.log('FAIL',n)}};
const K=__dirname+'/..';const ld=f=>JSON.parse(fs.readFileSync(K+'/'+f,'utf8'));
const rows=JSON.parse(sql.execSync(`python3 -c "import sqlite3,json;d=sqlite3.connect('/home/claude/out/rom_catalog.sqlite');d.row_factory=sqlite3.Row;print(json.dumps({'systems':[dict(r) for r in d.execute('select system,category,game,platform,routine,what,numbers,feel,use from systems')],'tech':[dict(r) for r in d.execute('select game,platform,area,item,value from tech_fingerprints')],'cat':[dict(r) for r in d.execute('select game,platform,genre from games')]}))"`,{maxBuffer:1e8}).toString());
const R={design_refs:ld('presets/design_refs.json'),progression:ld('presets/progression.json'),gta:ld('presets/gta_tables.json'),motion:ld('library/measured_motion.json'),body:ld('library/body_proportions.json'),systems:rows.systems,tech:rows.tech,story_api:[],my_games:ld('presets/my_games.json'),rom_sources:ld('presets/rom_sources.json')};
const ctx={P:()=>null,codedb:()=>ld('library/code_db.json'),catalog:()=>rows.cat,measured:()=>ld('presets/measured.json'),refs:()=>R,hooks:{}};
const q=x=>T.retrieve(ctx,x);
const a=q('make a 3D convenience store game with guns and stealable cars');
t('scanned convenience store ROM found',/CONVENIENCE STO/.test(a));t('GTA weapon table given for guns/cars',/Real weapon tables/.test(a));
t('worked examples always included',/Worked examples/.test(a)&&/kart_racing/.test(a));
const b=q('skating game with grind and trick physics');t('measured systems found for skating',/How real games do it/.test(b));
const c=q('wrestling fighter animation');t('measured motion data given for wrestling',/Measured motion data/.test(c));
const d=q('open world rpg');t('design research found',/Design research/.test(d));
t('prompt stays small enough for a 1.5B model',[a,b,c,d].every(x=>x.length<9000));
const e=q('mario 3d open world like super mario 64 with rebecca');t('new scanned Mario 64 DS found',/S\.MARIO64DS/.test(e));t('your characters + rules given',/Rebecca = /.test(e)&&/NOTAREAL logo/.test(e));
const g=q('how was the icw wrestling game built');t('own ROM source notes found',/How your own ROMs were built/.test(g)&&/ICW/i.test(g));
const KN=require('../kit/nrknowledge.js');t('problem log has the bank white-screen fix',KN.lookup('white screen on handheld','gbc').some(x=>x.fix&&x.fix.id==='gbc-white-screen-bank'));
const f=q('wrestling game');t('new scanned WCW ROMs found',/NITRO64|WCW/.test(f));
console.log(ok+' passed, '+bad+' failed, prompt sizes '+[a,b,c,d].map(x=>x.length).join('/'));process.exit(bad?1:0);

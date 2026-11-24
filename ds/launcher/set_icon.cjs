/* Puts the NOTAREAL icon into the Windows .exe (pure JS, no wine): node set_icon.cjs <exe> <icon.ico> */
const fs = require('fs'), path = require('path'), TOOLS = process.env.TOOLS || '/tmp/ntools', M = n => require(path.join(TOOLS, 'node_modules', n, 'cjs.cjs')).load();
(async () => {
    const [R, PE] = await Promise.all([M('resedit'), M('pe-library')]), [exe, ico] = process.argv.slice(2);
    const ne = PE.NtExecutable.from(fs.readFileSync(exe)), res = PE.NtExecutableResource.from(ne);
    const groups = R.Resource.IconGroupEntry.fromEntries(res.entries), id = groups.length ? groups[0].id : 101, lang = groups.length ? groups[0].lang : 1033;
    const icons = R.Data.IconFile.from(fs.readFileSync(ico)).icons.map(i => i.data);
    R.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, lang, icons);
    res.outputResource(ne); fs.writeFileSync(exe, Buffer.from(ne.generate()));
    console.log('icon set on', path.basename(exe), '(group', id + ')');
})().catch(e => { console.error('ICON FAILED:', e.message); process.exit(1); });

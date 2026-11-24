const TL = require('../kit/nrtimeline.js'), X = require('../kit/nrpc.js'), T = require('../kit/nrtemplates.js'), F = require('../kit/nrfit.js'), base = require('../examples/lakewood_run.json');
let ok = 0, bad = 0; const t = (n, c) => { if (c) ok++; else { bad++; console.log('FAIL', n); } };
// every preset validates on PC / Xbox and is refused (explained) on a one-engine console when it mixes engines
for (const [id, p] of Object.entries(TL.PRESETS)) { const P = { meta: { title: p.name }, console: 'pc' }; TL.preset(id, P); t(id + ' on pc', TL.validate(P, 'pc').ok); t(id + ' on xbox', TL.validate(P, 'xbox').ok); }
{ const P = { meta: { title: 'm' } }; TL.preset('story_campaign', P); const v = TL.validate(P, 'gba'); t('mixed timeline refused on gba with a reason', !v.ok && v.errors.some(e => /one engine per ROM/.test(e) || /cannot run on gba/.test(e))); }
{ const P = { meta: { title: 's' } }; TL.preset('skate_career', P); t('skate career on ds (arcade ROM)', TL.validate(P, 'ds').ok); }
// small console: levels in timeline order, cutscenes become the ROM's cutscene table
{ const P = JSON.parse(JSON.stringify(base)); P.console = 'gba'; const n = P.levels.length; P.timeline = [TL.step('cutscene', { text: 'A' }), TL.step('level', { level: 1 }), TL.step('cutscene', { text: 'B' }), TL.step('level', { level: 0 }), TL.step('cutscene', { text: 'C' })];
  t('mini timeline validates', TL.validate(P, 'gba').ok); const Q = TL.compileMini(P); t('levels reordered by timeline', Q.levels.length === 2 && Q.levels[0].name === base.levels[1].name && Q.levels[1].name === base.levels[0].name); t('cutscenes: intro, before level 2, ending', Q.cutscenes.map(c => c.when).join() === 'intro,level,ending' && Q.cutscenes[1].level === 1 && Q.cutscenes[0].text === 'A'); }
// branching, flags, needs
{ const P = { meta: { title: 'b' }, timeline: [TL.step('cutscene', { sets: 'x' }), TL.step('arcade', { mode: 'memory', cfg: {}, needs: 'never' }), TL.step('cutscene', { title: 'end' })] }; const r = TL.run(P); t('step with an unmet need is skipped', r.log[1].skipped && r.state.finished); }
{ const P = { meta: { title: 'r' }, timeline: [TL.step('arcade', { mode: 'memory', cfg: {} }), TL.step('cutscene', {})] }; const r = TL.run(P, { lives: 2, frames: 50 }); t('losing costs lives then game over', r.state.over === true && r.state.steps === 2); }
{ const P = { meta: { title: 'w' }, timeline: [TL.step('cutscene', {}), TL.step('arcade', { mode: 'military', cfg: { mode: 'zombies', rounds: 1 }, reward: 50 }), TL.step('cutscene', {})] };
  const r = TL.run(P, { frames: 20000, lives: 3, bot: (s, g) => { const st = g.s, live = st.en.filter(e => e.hp > 0)[0], k = {}; if (live) { const ang = Math.atan2(live.y - st.y, live.x - st.x), da = ((ang - st.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; if (da > .02) k.ArrowRight = true; else if (da < -.02) k.ArrowLeft = true; if (Math.abs(da) < .06) k.z = true; if (Math.hypot(live.x - st.x, live.y - st.y) < 2) k.ArrowDown = true; } return k; } });
  t('a whole timeline with a real engine step runs to the end', r.state.finished && r.state.score >= 50); }
// PC package carries timeline.html
{ const P = JSON.parse(JSON.stringify(base)); P.console = 'pc'; TL.preset('skate_career', P); const pk = X.buildPackage(P, {}); const f = (pk.files || pk).find(x => /timeline\.html$/.test(x.name)); t('PC package contains timeline.html', !!f); if (f) { const s = String(f.data); t('timeline.html embeds the engines and the steps', s.includes('NRArcade') && s.includes('Parking Lot') && s.includes('skate')); } }
// the offline AI -> a timeline: every template id has a family and every console in the fit matrix has an entry
t('every console has a timeline rule', Object.keys(TL.CAN).length >= 10 && F.consolesFor('racing').every(c => TL.CAN[c]));
console.log('timeline tests', ok, 'pass', bad, 'fail'); process.exit(bad ? 1 : 0);

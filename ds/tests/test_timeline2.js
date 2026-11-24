const A = require('../kit/nrarcade.js'); for (const f of ['nrmotion', 'nr3d', 'nranim', 'nr3d_sandbox', 'nr3d_war', 'nr3d_store', 'nr3d_rpg', 'nrlife_data', 'nrgems', 'nrcolor', 'nrlife', 'nrlife_ui', 'nr3d_frontier']) require('../kit/' + f + '.js'); const T = require('../kit/nrtimeline.js'); let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FAIL', n)); };
const proj = (tl, extra) => Object.assign({ format: 'notareal-project', console: 'pc', meta: { title: 'Test', tagline: 'tag' }, songs: [{ name: 'a' }, { name: 'b' }], timeline: tl }, extra || {});
// palette
const pal = T.palette(); t('palette has every group', T.GROUPS.every(g => pal.some(p => p.group === g)));
t('palette items build valid steps', pal.every(p => { const s = T.fromPalette(p.id); return s && T.TYPES[s.type] && (s.type !== 'arcade' || A.MODES[s.mode]); }));
t('room step carries machines', T.fromPalette('room').cfg.machines.length >= 6);
// presets validate on pc
for (const [k, p] of Object.entries(T.PRESETS)) { const P = proj(p.steps()); const v = T.validate(P, 'pc'); t('preset ' + k + ' valid on pc (' + v.errors.join(';') + ')', v.ok); }
// mixed engines refused on ds with the honest message
t('ds refuses mixed engines', !T.validate(proj(T.PRESETS.genre_hop.steps(), { console: 'ds' }), 'ds').ok);
// screens flow + music + branching
{ const a = T.step('title', { id: 'a', music: 0 }), b = T.step('cutscene', { id: 'b', text: 'hi', music: 1 }), m = T.step('menu', { id: 'm', choices: [{ text: 'left', next: 'l' }, { text: 'right', next: 'r' }] }), l = T.step('cutscene', { id: 'l', text: 'L', sets: 'wentL', onWin: 'end' }), r = T.step('cutscene', { id: 'r', text: 'R', sets: 'wentR', onWin: 'end' });
  const mus = []; const P = proj([a, b, m, l, r]); t('menu validates', T.validate(P, 'pc').ok);
  let sim = T.simulate(P, { music: n => mus.push(n), press: (c, f) => c.s.type === 'menu' ? (c.sel === 1 ? { z: f % 6 < 3 } : { ArrowDown: f % 4 === 0 }) : { z: f % 6 < 3 } });
  t('menu choice 2 -> R branch', sim.state.flags.wentR === 1 && !sim.state.flags.wentL && sim.finished); t('music changes per section', JSON.stringify(mus) === '[0,1]'); }
// triggers: time + score
{ const g = T.step('arcade', { id: 'g', mode: 'breakout', cfg: {}, triggers: [{ on: 'time', value: 2, next: 'e' }] }), e = T.step('cutscene', { id: 'e', text: 'x', sets: 'out' }); const sim = T.simulate(proj([g, e]), { bot: () => ({}) }); t('time trigger jumps', sim.state.flags.out === 1 && sim.log[0].result === 'win' && sim.frames < 600); }
// room as a section, exit with bot
{ const room = T.step('arcade', { id: 'rm', mode: 'room', cfg: { tokens: 1, machines: [] }, sets: 'left' }); const sim = T.simulate(proj([room]), { bot: () => ({ ArrowDown: true }), maxFrames: 3000 }); t('room section ends via the door', sim.state.flags.left === 1 && sim.finished); }
// DS buttons: call a section and come back; music restored
{ const A1 = T.step('arcade', { id: 'A1', mode: 'breakout', cfg: {}, music: 0 }), M = T.step('arcade', { id: 'M', mode: 'memory', cfg: {}, music: 1, onWin: 'end' });
  const P = proj([A1, M], { console: 'ds', ds: { bottomScreen: { buttons: [{ label: 'Phone', action: 'scene', target: 'M' }] } } }); const mus = [];
  const S = T.session(P, { music: n => mus.push(n) }); for (let i = 0; i < 5; i++) S.step({}); S.step({ '1': true }); S.step({}); t('button jumps to the called section', S.current().s.id === 'M' && S.current().call);
  S.current().G.s.status = 'win'; for (let i = 0; i < 80; i++) S.step({ z: i % 4 < 2 }); t('called section returns to the caller (game kept)', S.current() && S.current().s.id === 'A1' && S.current().G.s.status === 'play'); t('music restored after return', JSON.stringify(mus) === '[0,1,0]');
  t('ds buttons validated', !T.validate(proj([A1], { console: 'ds', ds: { bottomScreen: { buttons: [{ label: 'x', action: 'scene', target: 'nope' }] } } }), 'ds').ok); }
// lose branches to an id; lives
{ const g = T.step('arcade', { id: 'g', mode: 'hoops', cfg: { seconds: 1, goal: 99 }, onLose: 'bad' }), bad = T.step('cutscene', { id: 'bad', text: 'x', sets: 'badEnd', onWin: 'end' }); const sim = T.simulate(proj([g, bad]), { bot: () => ({}) }); t('lose can jump to a section', sim.state.flags.badEnd === 1); }
// validation catches
{ const v = T.validate(proj([T.step('cutscene', { music: 9 }), T.step('menu', { choices: [] }), T.step('arcade', { mode: 'room', cfg: { machines: [{ label: 'x', mode: 'room' }] } })]), 'pc'); t('bad music/menu/machine reported', v.errors.length >= 3); }
// PC page: run its script in a fake browser for a few seconds
{ const vm = require('vm'), fs = require('fs'), src = { nrarcade: ['nrarcade', 'nrroom'].map(f => fs.readFileSync(__dirname + '/../kit/' + f + '.js', 'utf8')).join('\n'), nrmusic: fs.readFileSync(__dirname + '/../kit/nrmusic.js', 'utf8'), nrtimeline: fs.readFileSync(__dirname + '/../kit/nrtimeline.js', 'utf8') };
  const html = T.html(proj(T.PRESETS.arcade_night.steps()), src); const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]); t('page has 4 scripts', scripts.length === 4);
  const calls = []; const ctx = new Proxy({}, { get: (o, p) => p === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...a) => calls.push(p), set: () => true }); let raf = null; const keys = {};
  const win = { addEventListener: (n, f) => { (win._l = win._l || {})[n] = f; }, requestAnimationFrame: f => { raf = f; }, NRMusic: undefined }; const doc = { getElementById: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  const sb = Object.assign(win, { document: doc, window: win, navigator: {}, performance: { now: () => 0 }, setInterval: () => 0, setTimeout: () => 0, console, JSON, Math, Date });
  try { vm.createContext(sb); scripts.forEach(sc => vm.runInContext(sc, sb)); let tm = 0; for (let i = 0; i < 400; i++) { tm += 17; if (win._l && win._l.keydown && i % 20 === 0) win._l.keydown({ key: 'z', preventDefault() {} }); if (win._l && win._l.keyup && i % 20 === 5) win._l.keyup({ key: 'z' }); const f = raf; raf = null; f(tm); } t('page runs and draws', calls.length > 500); } catch (e) { console.log(e.stack); t('page runs', false); } }
console.log(ok + ' pass, ' + bad + ' fail'); process.exit(bad ? 1 : 0);

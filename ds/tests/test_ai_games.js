// The offline AI (keywords, no model) must produce a working game for every kind of request, on every console it supports.
const AI = require('../kit/nrai.js'), B = require('../kit/nrbuilder.js'), A = require('../kit/nrarcade.js'), F = require('../kit/nrfit.js'), W = require('../kit/nrworld.js'), base = require('../examples/lakewood_run.json');
let ok = 0, bad = 0; const t = (n, c) => { if (c) ok++; else { bad++; console.log('FAIL', n); } };
const CASES = [
  ['an advanced skateboarding game with grinds and flip tricks', 'trick_sports'], ['call of duty style military shooter with a zombie mode', 'military_shooter'],
  ['friendship bracelet shop where I weave bracelets for customers', 'crafting_sim'], ['fallout style wasteland survival game in Berea Kentucky', 'survival_rpg'],
  ['monster catching rpg', 'monster_rpg'], ['open world game like GTA', 'open_world_2d'], ['a kart race in the desert', 'kart_racing'], ['first person shooter in a corridor', 'shooter_fps'],
  ['a haunted castle platformer 4 levels', 'platformer'], ['basketball shooting game', 'basketball'], ['wrestling game', 'wrestling'], ['city builder tycoon', 'city_builder']];
(async () => {
  for (const [text, genre] of CASES) {
    const plan = AI.heuristicPlan(text); t('plan: ' + text.slice(0, 30) + ' -> ' + genre, plan.genre === genre);
    for (const con of F.consolesFor(genre)) {
      const r = await AI.make(text, base, null, null, { console: con });
      t(`${genre} on ${con}: project built`, !!(r.project && r.engine));
      if (r.project && r.project.arcade && A.MODES[r.project.arcade.mode]) { const g = A.create(r.project.arcade.mode, r.project.arcade.cfg, { seed: 1 }); for (let i = 0; i < 300; i++) g.step({}); t(`${genre} on ${con}: arcade engine runs`, !!g.s.status); }
      if (r.project && r.project.world) t(`${genre} on ${con}: world has no errors`, (W.check(r.project.world) || []).filter(x => x.level === 'error' || /error/i.test(x.kind || '')).length === 0);
      if (r.project && r.project.levels && r.project.levels.length && !r.project.arcade) { if (r.engine === 'side2d') { const c = B.checkAll(r.project); t(`${genre} on ${con}: every level passes the checker`, c.every(x => x.ok)); } }
    }
  }
  console.log('ai games', ok, 'pass', bad, 'fail'); process.exit(bad ? 1 : 0);
})();

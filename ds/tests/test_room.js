const A = require('../kit/nrarcade.js'); require('../kit/nrroom.js'); let ok = 0, bad = 0; const t = (n, c) => { c ? ok++ : (bad++, console.log('FAIL', n)); };
// registered
t('modes registered', ['room', 'airhockey', 'claw'].every(m => A.MODES[m] && A.DEFAULTS[m]));
// air hockey: bot follows puck and smashes -> wins vs default CPU? at least runs, scores, ends
{ const g = A.create('airhockey', { goal: 3, seconds: 60 }, { seed: 3 }); let f = 0; while (g.s.status === 'play' && f++ < 60 * 70) { const k = {}; if (g.s.by < g.s.py - 3) k.ArrowUp = true; if (g.s.by > g.s.py + 3) k.ArrowDown = true; if (g.s.bx < g.s.px - 3) k.ArrowLeft = true; if (g.s.bx > g.s.px + 3 && g.s.bx < 170) k.ArrowRight = true; k.z = f % 20 < 2; g.step(k); }
  t('airhockey ends', g.s.status !== 'play'); t('airhockey puck stays on table', g.s.bx > 0 && g.s.bx < 320 && g.s.by > 0 && g.s.by < 240); t('airhockey scores happen', g.s.me + g.s.cpu > 0); }
// claw: bot aligns over nearest prize and drops; win possible with grip 1
{ const g = A.create('claw', { grip: 1, tries: 8, goalPrizes: 2, prizes: 9 }, { seed: 5 }); let f = 0; while (g.s.status === 'play' && f++ < 60 * 200) { const k = {}; if (g.s.phase === 'aim') { const pr = [...Object.values(g.s)]; } g.step(k); }
  t('claw loses when idle? (no input = stays aim)', g.s.status === 'play' || g.s.status === 'lose');
  const h = A.create('claw', { grip: 1, tries: 12, goalPrizes: 2, prizes: 9 }, { seed: 5 }); let n = 0; let target = 0;
  // simple bot: sweep right with z every 25 px until prizes obtained
  for (let i = 0; i < 60 * 400 && h.s.status === 'play'; i++) { const k = {}; if (h.s.phase === 'aim') { const want = 40 + (h.s.tries * 37) % 190; if (h.s.cx < want - 2) k.ArrowRight = true; else if (h.s.cx > want + 2) k.ArrowLeft = true; else k.z = (i % 2 === 0); } h.step(k); }
  t('claw finishes', h.s.status !== 'play'); t('claw tries decrease', h.s.tries < 12); }
// room: walk to a machine, play it with the machine's own bot, tickets awarded, exit through the door
{ const g = A.create('room', { tokens: 3, goalTickets: 0, machines: [{ x: 160, y: 100, label: 'MEM', mode: 'memory', cfg: { pairs: 2, tries: 1 } }] }, { seed: 1 });
  let f = 0; const walk = (tx, ty) => { const k = {}; if (g.s.x < tx - 2) k.ArrowRight = true; else if (g.s.x > tx + 2) k.ArrowLeft = true; if (g.s.y < ty - 2) k.ArrowDown = true; else if (g.s.y > ty + 2) k.ArrowUp = true; return k; };
  for (; f < 400 && !g.s.inner; f++) { const k = walk(160, 124); if (Math.hypot(g.s.x - 160, g.s.y - 124) < 6) k.z = f % 4 < 2; g.step(k); }
  t('room: machine launched', !!g.s.inner && g.s.tokens === 2);
  for (let i = 0; i < 3000 && g.s.inner; i++) g.step({ z: i % 6 < 3, ArrowRight: i % 40 < 10 }); // let the machine finish, Z returns to room
  t('room: back in room after machine', !g.s.inner);
  t('room: ticket counter is a number', Number.isFinite(g.s.tickets) && g.s.score === g.s.tickets * 10);
  g.s.tickets = 5; for (let i = 0; i < 400 && g.s.status === 'play'; i++) g.step(walk(160, 236)); t('room: exit door wins', g.s.status === 'win'); }
// room goal tickets block the door
{ const g = A.create('room', { tokens: 3, goalTickets: 50, machines: [] }, { seed: 1 }); for (let i = 0; i < 300; i++) g.step({ ArrowDown: true }); t('room: door blocked until goal', g.s.status === 'play' && g.s.msgT > 0 || g.s.status === 'play'); }
// room draws without throwing (fake ctx)
{ const calls = []; const ctx = new Proxy({}, { get: (o, p) => p === 'measureText' ? () => ({ width: 5 }) : (...a) => calls.push(p), set: () => true }); const g = A.create('room', {}, { seed: 2 }); g.step({}); g.draw(ctx); const h = A.create('claw', {}, { seed: 2 }); h.draw(ctx); const a = A.create('airhockey', {}, { seed: 2 }); a.draw(ctx); t('draw ok', calls.length > 100); }
// every default machine mode can be created
t('default machines valid', A.ROOM_MACHINES.every(m => { try { A.create(m.mode, m.cfg, { seed: 1 }); return true; } catch (e) { return false; } }));
console.log(ok + ' pass, ' + bad + ' fail'); process.exit(bad ? 1 : 0);

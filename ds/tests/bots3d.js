/* shared test bots for the 3D engines: camera-relative steering */
const ang = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
// keys that walk the player toward (tx,tz) given the camera yaw
exports.steerCam = (g, tx, tz) => {
  const p = g.s.p, cy = g.s.cam.yaw, dx = tx - p.x, dz = tz - p.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
  const fw = ux * Math.sin(cy) + uz * Math.cos(cy), rt = ux * Math.cos(cy) - uz * Math.sin(cy), k = {};
  if (fw > .35) k.ArrowUp = true; else if (fw < -.35) k.ArrowDown = true;
  if (rt > .35) k.ArrowRight = true; else if (rt < -.35) k.ArrowLeft = true;
  if (!k.ArrowUp && !k.ArrowDown && !k.ArrowLeft && !k.ArrowRight) { if (fw > 0) k.ArrowUp = true; else k.ArrowRight = true; }
  return k;
};
exports.dist = (g, x, z) => Math.hypot(g.s.p.x - x, g.s.p.z - z);
const N3 = require('../kit/nr3d.js');
// edge-detecting hopper: jump when the ground ahead disappears
exports.edgeJump = (g, k, look) => { const p = g.s.p, W = g.s.world, sp = Math.hypot(p.vx, p.vz); if (p.ground && p.wall && p.wall.box && p.wall.box.y1 - p.y < 3.2 && !p.wall.box.tree) { k.z = true; return k; } if (!p.ground || sp < 2) return k; const ux = p.vx / sp, uz = p.vz / sp, ax = p.x + ux * (look || 1.1), az = p.z + uz * (look || 1.1); const fl = N3.floorAt(W.S, { x: ax, z: az, r: .4, groundFn: W.groundFn }, p.y + .6); if (fl < p.y - .8) k.z = true; return k; };
// first-person warfare bot: shoot what it can see, otherwise hunt the current zone, then walk to extraction
const angD = ang;
exports.warBot = (g, st) => {
  const s = g.s, p = s.p, W = s.world, k = {}; st = st || (g._bot = g._bot || { path: null, pk: 0, pt: -9 });
  const eye = (e) => e.y + 1.45 * e.scale;
  let wp = s.weapons[s.wi];
  let tgt = null, bd = 1e9;
  for (const e of s.en) { if (e.dead || e.st === 'hide') continue; const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz); if (d < bd && d < (wp.id === 'ar' ? 34 : wp.id === 'shotgun' ? 14 : 70) && !W.grid.blocked(p.x, p.y + 1.6, p.z, e.x, eye(e), e.z, .6)) { bd = d; tgt = e; } }
  if (wp.mag <= 0 && wp.res <= 0 && s.weapons.length > 1 && !st.swapped) { k.ArrowLeft = k.ArrowRight = true; st.swapped = 20; return k; } if (st.swapped) st.swapped--;
  if (wp.mag <= 0 && wp.res > 0 && s.rel === 0) k.x = true;
  const dry = s.weapons.every(w => w.mag + w.res <= 0);
  if (tgt && !dry) {
    const d = angD(p.yaw, Math.atan2(tgt.x - p.x, tgt.z - p.z));
    if (Math.abs(d) > .02) { if (d > 0) k.ArrowRight = true; else k.ArrowLeft = true; }
    if (Math.abs(d) < .07 && wp.mag > 0) { if (wp.id === 'ar') k.z = true; else k.z = (Math.floor(s.t * 20) % 2) === 0; }
    if (bd < 2.2) k.x = true;
    if (bd > 22 && s.shield > 50 && Math.abs(d) < .3 && wp.id !== 'pistol') k.ArrowUp = true;
    if (s.t % 6 < .5 && s.grenades[0] > 0 && bd > 8 && bd < 25) { k.ArrowUp = true; k.ArrowDown = true; delete k.ArrowRight; delete k.ArrowLeft; }
    return k;
  }
  // choose a destination
  let dest = null; const ammo = s.weapons.reduce((a, w) => a + w.mag + w.res, 0);
  if (ammo < 110) { let b = 1e9; for (const q of s.pick) { if (q.k === 'health') continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < b && d < 60) { b = d; dest = { x: q.x, z: q.z }; } } }
  if (!dest && s.health < 50) { let b = 1e9; for (const q of s.pick) { if (q.k !== 'health') continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < b && d < 40) { b = d; dest = { x: q.x, z: q.z }; } } }
  const ob = s.obj;
  if (dest) { /* chasing a pickup */ } else if (ob >= 3) dest = W.extract; else { let b = 1e9; for (const e of s.en) { if (e.dead || e.zone !== ob || e.optional) continue; const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < b) { b = d; dest = { x: e.x, z: e.z }; } } if (!dest) dest = ob === 0 ? { x: 0, z: -22 } : ob === 1 ? { x: 0, z: 18 } : { x: 0, z: 40 }; }
  if (s.shield < 40 && s.shT > 0 && s.t % 3 < 1.5) { /* take a breath: just hold */ return k; }
  if (!st.path || st.pk >= st.path.length || s.t - st.pt > 2.5 || Math.hypot(st.goal[0] - dest.x, st.goal[1] - dest.z) > 3) { st.path = W.nav.path(p.x, p.z, dest.x, dest.z) || [[dest.x, dest.z]]; st.pk = 0; st.pt = s.t; st.goal = [dest.x, dest.z]; }
  const [tx, tz] = st.path[st.pk]; if (Math.hypot(tx - p.x, tz - p.z) < 1.2) st.pk++;
  const d = angD(p.yaw, Math.atan2(tx - p.x, tz - p.z));
  if (Math.abs(d) > .12) { if (d > 0) k.ArrowRight = true; else k.ArrowLeft = true; } if (Math.abs(d) < .9) k.ArrowUp = true;
  return k;
};

/* storeBot: plays a full shift. Serves the queue (scans, takes cash, counts exact change), restocks low shelves, mops spills, tackles thieves. */
function storeBot(g) {
    const s = g.s, W = s.world, N3 = require('../kit/nr3d.js'); let path = null, goal = null, pk = 0, zt = 0;
    const go = (x, z) => { if (!goal || Math.hypot(goal[0] - x, goal[1] - z) > .5) { path = N3.nav.path ? null : null; const p = W.nav.path(s.p.x, s.p.z, x, z, 4000); path = p || [[x, z]]; goal = [x, z]; pk = 0; } };
    const face = (k, tx, tz) => { const want = Math.atan2(tx - s.p.x, tz - s.p.z); let d = want - s.p.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; if (d > .1) k.ArrowRight = true; else if (d < -.1) k.ArrowLeft = true; return Math.abs(d); };
    const walk = (k, run) => { if (!path || pk >= path.length) return true; const [tx, tz] = path[pk]; if (Math.hypot(tx - s.p.x, tz - s.p.z) < .45) { pk++; return pk >= path.length; } const d = face(k, tx, tz); if (d < .7) k.ArrowUp = true; if (run && d < .3) k.c = true; return false; };
    return function (k) {
        for (const q in k) k[q] = false; zt++;
        const reg = s.reg; if (reg) { if (reg.ph === 'change') { const d = Math.round((reg.due - reg.give) * 100) / 100; if (zt % 2 === 0) { if (d >= 1) k.ArrowUp = true; else if (d >= .25) { k.ArrowRight = true; k.c = true; } else if (d >= .05) k.ArrowRight = true; else if (d <= -.05) k.ArrowLeft = true; } if (Math.abs(d) < .005 && zt % 3 === 0) k.z = true; } else k.z = zt % 4 === 0; return; }
        if (s.act) return;
        if (s.robber && !s.robber.fired) { go(W.zone.x0 + 1, -4.6); if (!walk(k)) return; k.z = zt % 6 === 0; return; }
        const thief = s.cust.find(c => c.kind === 'thief' && c.stolen && !c.reported && c.st !== 'caught');
        if (thief) { go(thief.x, thief.z); walk(k, true); const d = Math.hypot(thief.x - s.p.x, thief.z - s.p.z); if (d < 2.2) k.x = zt % 3 === 0; return; }
        const head = s.cust.find(c => c.st === 'service' && Math.hypot(c.x - W.queue[0].x, c.z - W.queue[0].z) < 1.0);
        if (head) { go(W.start.x, W.start.z); if (!walk(k)) return; if (s.p.x > W.zone.x0 && s.p.x < W.zone.x1) k.z = zt % 4 === 0; return; }
        const sp = s.spill.find(q => !q.done); if (sp) { go(sp.x, sp.z + .2); if (!walk(k)) return; k.z = zt % 4 === 0; return; }
        if (s.carry) { const sh = s.shelves.find(q => q.id === s.carry.id), spot = sh.spots[0]; go(spot.x, spot.z); if (!walk(k)) return; k.z = zt % 4 === 0; return; }
        const low = s.shelves.filter(q => q.stock < 5).sort((a, b) => a.stock - b.stock)[0];
        if (low) { const pl = s.piles.find(q => q.id === low.id); if (pl.qty > 0) { go(pl.fx, pl.fz); if (!walk(k)) return; k.z = zt % 4 === 0; return; } }
        go(W.start.x, W.start.z); walk(k);
    };
}
module.exports.storeBot = storeBot;

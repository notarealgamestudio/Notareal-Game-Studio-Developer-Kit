/* NOTAREAL Fight engine: wrestling / fighting games (offline, controller or keyboard).
 * Moves: A strike (3-hit combo), B grab then throw (slam), Y block, X taunt (builds momentum). Momentum full + A+B up close = finisher.
 * A downed fighter below 40% health can be pinned: stand close and hold A for a three count; the pinned fighter's health, and a roll, decide the kick-out.
 * FIGHT.play(canvas, cfg, opts) -> { state, step(n), stop() }. cfg: { title, ring, fighters:[{name, sprite, hp, power, speed, color}] }  opts: { keys (P1), keys2 (P2, optional: else AI), images, manual, sound } */
(function (root) {
'use strict';
const F = {}, Wr = (typeof require === 'function' && typeof module !== 'undefined') ? require('./nrwrestling.js') : root.NRWrestling;
F.DEFAULT = { title: 'Ring Fight', ring: { floor: 0x3b5ba8, rope: 0xe84a4a }, fighters: [
    { name: 'Steve', sprite: 'hero', hp: 100, power: 1, speed: 1, color: '#e8a33d' }, { name: 'Rival', sprite: 'walker', hp: 100, power: 1, speed: 0.9, color: '#c43c3c' }] };
F.play = (cv, cfg = F.DEFAULT, opts = {}) => {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, FLOOR = H - 44, keys = opts.keys || {}, keys2 = opts.keys2 || null, ims = opts.images || {};
    let seed = (opts.seed || 7) >>> 0; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const mk = (d, x, face) => ({ d, x, y: FLOOR, vx: 0, vy: 0, face, hp: d.hp || 100, maxhp: d.hp || 100, mom: 0, st: 'idle', t: 0, combo: 0, hold: 0, grabbed: null, lastHit: 0, run: 0, mv: null, pose: null, held: false, dazed: 0 });
    const f = [mk(cfg.fighters[0], W * 0.3, 1), mk(cfg.fighters[1], W * 0.7, -1)];
    const S = { f, over: null, frame: 0, pin: null, log: [] }; let stopped = false;
    const log = m => { S.log.push(m); if (opts.onEvent) opts.onEvent(m); };
    const prevK = [{}, {}];
    const input = (i, k) => { const p = prevK[i], o = { l: !!(k.ArrowLeft || k.a), r: !!(k.ArrowRight || k.d), A: !!(k.z || k.Z), B: !!(k.x || k.X), Y: !!(k.c || k.C), X: !!(k.v || k.V) }; o.pA = o.A && !p.A; o.pB = o.B && !p.B; o.pY = o.Y && !p.Y; o.pX = o.X && !p.X; prevK[i] = o; return o; };
    const ai = (me, you) => { const dx = you.x - me.x, near = Math.abs(dx) < 34, o = { l: dx < -30, r: dx > 30, A: false, B: false, Y: false, X: false }; const k = S.frame % 40;
        if (near && you.st !== 'down') { if (k === 5 && rnd() < 0.7) o.A = true; else if (k === 20 && rnd() < 0.3) o.B = true; if (you.st === 'attack' && rnd() < 0.5) o.Y = true; }
        if (you.st === 'down' && near && me.hp > 0) o.A = true; if (me.mom >= 100 && near && k === 10) { o.A = o.B = true; }
        o.pA = o.A && !prevK[1].A; o.pB = o.B && !prevK[1].B; o.pY = o.Y && !prevK[1].Y; o.pX = false; prevK[1] = o; return o; };
    const dmg = (v, a, amt, kind) => { const blocked = v.st === 'block' && Math.sign(a.x - v.x) === v.face; const n = blocked ? Math.ceil(amt * 0.2) : Math.round(amt * (a.d.power || 1)); v.hp = Math.max(0, v.hp - n); a.mom = Math.min(100, a.mom + (blocked ? 2 : 7)); v.mom = Math.min(100, v.mom + 3); if (!blocked) { v.st = kind === 'throw' ? 'down' : 'hurt'; v.t = kind === 'throw' ? 70 : 14; v.vx = a.face * (kind === 'throw' ? 3 : 1.5); } log((blocked ? 'block:' : 'hit:') + kind); if (opts.sound) opts.sound(blocked ? 'block' : 'hit'); if (v.hp <= 0 && !S.over) { v.st = 'down'; v.t = 9999; S.over = { winner: a.d.name, how: 'KO' }; log('ko'); } };
    function stepMove(me, you) {
        const mv = me.mv, m = mv.m; mv.t++; const u = mv.t / m.frames; me.pose = Wr.at(m.me, u); me.x += (m.type === 'run' ? me.face * 1.6 : 0);
        const v = mv.vict; if (v && !S.over) { if (m.type !== 'strike') { v.held = true; v.pose = Wr.at(m.you, u); v.x += (me.x + me.face * Math.min(m.range, 26) - v.x) * 0.25; } else if (u > m.hitAt) v.pose = Wr.at(m.you, u); }
        if (!mv.hit && u >= m.hitAt) { mv.hit = true; if (v) { if (m.type === 'strike' || m.type === 'run') { dmg(v, me, m.dmg, m.type === 'strike' ? 'strike' : 'throw'); if (m.type === 'strike' && rnd() < 0.3) { v.dazed = 50; v.face = me.face; } } else { dmg(v, me, m.dmg, 'throw'); v.held = true; } me.mom = Math.min(100, me.mom + m.mom * (m.type === 'finisher' ? 0 : 0.5)); } }
        if (mv.t >= m.frames + (m.rest || 0)) { me.mv = null; me.pose = null; me.st = 'idle'; if (v) { v.held = false; v.pose = null; if (m.keepDown && v.hp > 0) { v.st = 'down'; v.t = 70; } } }
    }
    function act(me, you, i, o) {
        const dist = Math.abs(you.x - me.x);
        if (me.held) return;
        if (me.mv) { stepMove(me, you); return; }
        if (me.dazed > 0) me.dazed--;
        if (me.st === 'down') { if (--me.t <= 0 && !S.pin) { me.st = 'idle'; } return; }
        if (me.st === 'hurt') { me.x += me.vx; me.vx *= 0.8; if (--me.t <= 0) me.st = 'idle'; return; }
        if (me.st === 'attack' || me.st === 'throw') { if (--me.t <= 0) me.st = 'idle'; else if (me.st === 'attack' && me.t === 6 && dist < 30) { dmg(you, me, 6 + me.combo * 2, 'strike'); me.combo = (me.combo + 1) % 3; } else if (me.st === 'throw' && me.t === 10 && dist < 30 && you.st !== 'block') { dmg(you, me, 16, 'throw'); you.x = me.x + me.face * 28; } return; }
        if (me.dazed <= 0) me.face = you.x > me.x ? 1 : -1; me.st = 'idle';
        if (o.Y) { me.st = 'block'; return; }
        if (you.st === 'down' && me.hp > 0 && dist < 34 && you.hp < you.maxhp * 0.4 && o.A) { me.st = 'pin'; me.hold++; if (!S.pin) { S.pin = { by: me, who: you, n: 0 }; log('pin'); } S.pin.n++; const cnt = Math.floor(S.pin.n / 40); if (cnt >= 3 && !S.over) { S.over = { winner: me.d.name, how: 'Pin' }; log('pinfall'); } return; }
        if (S.pin && S.pin.by === me) { S.pin = null; }
        me.run = (o.l || o.r) ? Math.min(60, me.run + 1) : 0;
        if (cfg.moveset && Wr) { const both = o.A && o.B && me.mom >= 100, btn = both ? 'AB' : o.pA ? 'A' : o.pB ? 'B' : null;
            if (btn) { const m = Wr.choose({ button: btn, dist, running: me.run > 25, behind: you.dazed > 0 && you.face === me.face, foeDown: you.st === 'down', foeHp: you.hp / you.maxhp, mom: me.mom, atRopes: me.x < 40 || me.x > W - 40, combo: me.combo, finisher: me.d.finisher }, rnd);
                if (m) { me.mv = { m, t: 0, hit: false, vict: dist < m.range + 6 && (m.type === 'strike' || m.type === 'run' || you.st !== 'block') ? you : null }; if (m.type === 'finisher') { me.mom = 0; } S.callout = { who: me.d.name, name: m.name, t: 70 }; log('move:' + m.name); if (m.type === 'strike') me.combo = (me.combo + 1) % 5; me.st = 'move'; return; } } }
        if (o.pX) { me.mom = Math.min(100, me.mom + 14); me.t = 20; me.st = 'taunt'; log('taunt'); return; }
        if (o.A && o.B && me.mom >= 100 && dist < 34) { dmg(you, me, 40, 'throw'); me.mom = 0; log('finisher'); me.st = 'attack'; me.t = 30; return; }
        if (o.pA) { me.st = 'attack'; me.t = 14; return; }
        if (o.pB) { me.st = 'throw'; me.t = 22; return; }
        const sp = 1.1 * (me.d.speed || 1); if (o.l) { me.x -= sp; me.st = 'walk'; } else if (o.r) { me.x += sp; me.st = 'walk'; }
        me.x = Math.max(18, Math.min(W - 18, me.x));
    }
    function update() {
        S.frame++; if (S.over) return;
        const o1 = input(0, keys), o2 = keys2 ? input(1, keys2) : ai(f[1], f[0]);
        act(f[0], f[1], 0, o1); act(f[1], f[0], 1, o2);
        for (const a of f) if (a.st === 'taunt' && --a.t <= 0) a.st = 'idle';
        if (S.pin && (S.pin.who.st !== 'down' || S.pin.by.st !== 'pin')) { if (S.pin.n > 20 && S.pin.who.st !== 'down') log('kickout'); S.pin = null; }
        if (S.pin && S.pin.n % 40 === 39) { const w = S.pin.who; if (rnd() < 0.05 + (w.hp / w.maxhp) * 0.8) { w.st = 'idle'; log('kickout'); S.pin = null; } }
        if (f[1].st === 'down' && f[1].t > 0 && f[1].t < 9999 && S.pin == null) { /* waits on the mat */ }
    }
    const spr = (p) => { const d = p.d, im = ims[d.sprite], sp = (opts.sprites || {})[d.sprite] || { w: 16, h: 32, frames: 1 };
        g.save(); g.translate(p.x, p.y); if (p.face < 0) g.scale(-1, 1); if (p.pose) { const q = p.pose, vic = p.held; g.translate(q.dx, -q.lift); g.rotate((vic ? -q.lean : q.lean) * Math.PI / 180 + q.rot * 0); g.scale(q.sx, q.sy); } else if (p.st === 'down') { g.rotate(-Math.PI / 2 * p.face); g.translate(0, -4); }
        if (im) { const fr = p.st === 'walk' ? (S.frame >> 3) % Math.max(1, sp.frames) : 0; const sc = 1.4; g.drawImage(im, fr * sp.w, 0, sp.w, sp.h, -sp.w * sc / 2, -sp.h * sc, sp.w * sc, sp.h * sc); } else { g.fillStyle = d.color || '#fff'; g.fillRect(-8, -34, 16, 34); }
        if (p.st === 'attack') { g.fillStyle = '#fff'; g.fillRect(10, -26, 14, 4); } if (p.pose && (p.pose.arm || p.pose.leg)) { g.strokeStyle = d.color || '#fff'; g.lineWidth = 3; const ln = (x, y, a, l) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a * Math.PI / 180) * l, y + Math.cos(a * Math.PI / 180) * l); g.stroke(); }; ln(0, -26, p.pose.arm, 13); ln(0, -12, p.pose.leg, 12); } if (p.st === 'block') { g.strokeStyle = '#8cf'; g.strokeRect(6, -34, 6, 30); } g.restore(); };
    function draw() {
        g.fillStyle = '#10142a'; g.fillRect(0, 0, W, H); g.fillStyle = '#' + (cfg.ring && cfg.ring.floor != null ? cfg.ring.floor : 0x3b5ba8).toString(16).padStart(6, '0'); g.fillRect(0, FLOOR, W, H - FLOOR);
        g.fillStyle = '#' + ((cfg.ring && cfg.ring.rope) || 0xe84a4a).toString(16).padStart(6, '0'); for (let i = 0; i < 3; i++) g.fillRect(0, 60 + i * 26, W, 2);
        [...f].sort((a, b) => a.y - b.y).forEach(spr);
        for (let i = 0; i < 2; i++) { const p = f[i], x = i ? W - 12 - 150 : 12; g.fillStyle = '#222'; g.fillRect(x, 8, 150, 10); g.fillStyle = p.hp / p.maxhp > 0.4 ? '#4ade80' : '#f87171'; g.fillRect(x, 8, 150 * p.hp / p.maxhp, 10); g.fillStyle = '#f5c542'; g.fillRect(x, 20, 150 * p.mom / 100, 3); g.fillStyle = '#fff'; g.font = '9px monospace'; g.textAlign = i ? 'right' : 'left'; g.fillText(p.d.name, i ? x + 150 : x, 34); }
        if (S.callout && S.callout.t > 0) { S.callout.t--; g.fillStyle = '#ffe38a'; g.font = 'bold 13px monospace'; g.textAlign = 'center'; g.fillText(S.callout.name.toUpperCase(), W / 2, H - 14); }
        if (S.pin) { g.fillStyle = '#fff'; g.font = 'bold 20px monospace'; g.textAlign = 'center'; g.fillText(String(Math.min(3, Math.floor(S.pin.n / 40) + 1)), W / 2, 60); }
        if (S.over) { g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(0, H / 2 - 24, W, 48); g.fillStyle = '#ffe38a'; g.font = 'bold 16px monospace'; g.textAlign = 'center'; g.fillText(`${S.over.winner} wins by ${S.over.how}!`, W / 2, H / 2 + 5); }
    }
    const api = { state: S, stop: () => stopped = true, step: n => { for (let i = 0; i < n; i++) update(); draw(); }, draw };
    if (!opts.manual) { let last = 0, acc = 0; const loop = t => { if (stopped) return; if (!last) last = t; acc += Math.min(100, t - last); last = t; while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; } draw(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); } else draw();
    return api;
};
if (typeof module !== 'undefined') module.exports = F; else root.NRFight = F;
})(typeof self !== 'undefined' ? self : this);

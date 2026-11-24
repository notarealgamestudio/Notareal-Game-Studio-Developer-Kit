/* NOTAREAL Dev Kit: open world. The data model the World builder edits, and the runtime that plays it in the app.
 * A world = maps of any size. Each map is played top-down (RPG / adventure / town / shooter) or side-view (platformer),
 * so one game can mix both (the game type splitter). Things on a map are entities made from templates
 * (player start, NPC, enemy, item, door, sign, chest, trigger, shop, save point, spawner, prop). Every entity can have rules:
 * "when <trigger> [if <condition>] do <actions>". Everything here runs offline on the user's computer. */
(function (root) {
'use strict';
const W = {};

/* ------------------------------------------------------------------ templates and actions (the editor builds its UI from these) */
W.TEMPLATES = {
    start:   { label: 'Player start', icon: 'hero', props: {}, kid: true, about: 'Where the game begins on this map.' },
    npc:     { label: 'Person (NPC)', icon: 'hero', props: { name: 'Friend', sprite: 'hero', move: 'stand', lines: 'Hi there!' }, triggers: ['talk', 'touch'], kid: true, about: 'Talks when you press A next to them. Add rules for quests, gifts, choices.' },
    enemy:   { label: 'Enemy', icon: 'walker', props: { name: 'Enemy', sprite: 'walker', ai: 'chase', hp: 3, damage: 1, speed: 0.6, drop: 'money:5' }, triggers: ['defeat', 'touch'], kid: true, about: 'Hurts the player on touch. Defeat it with the action button (A) or by stomping in side view.' },
    item:    { label: 'Item pickup', icon: 'coin', props: { item: 'coin', count: 1, sprite: 'coin' }, triggers: ['touch'], kid: true, about: 'Picked up on touch: an item from your item list, money or a heart.' },
    door:    { label: 'Door / warp', icon: 'check', props: { toMap: '', toX: 2, toY: 2, needItem: '', invisible: false }, triggers: ['touch'], kid: true, about: 'Takes the player to another map (or another spot). Can need a key item.' },
    sign:    { label: 'Sign', icon: 'check', props: { text: 'Welcome!' }, triggers: ['talk'], kid: true, about: 'Shows its text when read.' },
    chest:   { label: 'Chest', icon: 'spring', props: { item: 'coin', count: 10 }, triggers: ['talk'], kid: true, about: 'Opens once and gives what is inside.' },
    shop:    { label: 'Shop keeper', icon: 'hero', props: { name: 'Shop', sprite: 'hero', stock: 'potion:10, key:50' }, triggers: ['talk'], kid: true, about: 'Sells items for money (item:price, comma separated).' },
    save:    { label: 'Save point', icon: 'heart', props: {}, triggers: ['talk'], kid: false, about: 'Saves the game (and heals) when used.' },
    trigger: { label: 'Trigger area', icon: 'none', props: { w: 2, h: 2, once: true }, triggers: ['enter'], kid: false, about: 'Invisible area: runs its rules when the player walks in. Cut-scenes, traps, story beats.' },
    spawner: { label: 'Enemy spawner', icon: 'flyer', props: { sprite: 'flyer', ai: 'chase', hp: 1, damage: 1, speed: 0.7, every: 4, max: 4 }, triggers: [], kid: false, about: 'Makes enemies every few seconds (waves, zombie mode).' },
    prop:    { label: 'Prop (decoration)', icon: 'spring', props: { sprite: 'spring', solid: true }, triggers: ['talk', 'touch'], kid: false, about: 'Any picture placed on the map, solid or not. Give it rules to make it interactive.' },
};
W.TRIGGERS = { talk: 'player talks to it (A)', touch: 'player touches it', enter: 'player walks into it', defeat: 'it is defeated', load: 'the map loads' };
/* action schema: fields with a type the editor renders. text/number/map/item/song/flag/tile */
W.ACTIONS = {
    say:     { label: 'Show text', fields: { text: 'text' }, kid: true },
    choice:  { label: 'Ask a question (Yes / No)', fields: { text: 'text', yes: 'actions', no: 'actions' }, kid: true },
    give:    { label: 'Give item', fields: { item: 'item', n: 'number' }, kid: true },
    take:    { label: 'Take item', fields: { item: 'item', n: 'number' }, kid: true },
    money:   { label: 'Give / take money', fields: { n: 'number' }, kid: true },
    heal:    { label: 'Heal player', fields: { n: 'number' }, kid: true },
    hurt:    { label: 'Hurt player', fields: { n: 'number' }, kid: false },
    flag:    { label: 'Set a story flag', fields: { name: 'flag', value: 'number' }, kid: false },
    addflag: { label: 'Add to a counter', fields: { name: 'flag', value: 'number' }, kid: false },
    if:      { label: 'If … then … else …', fields: { test: 'cond', then: 'actions', else: 'actions' }, kid: false },
    warp:    { label: 'Go to map', fields: { map: 'map', x: 'number', y: 'number' }, kid: true },
    music:   { label: 'Change music', fields: { song: 'song' }, kid: true },
    sound:   { label: 'Play sound', fields: { sfx: 'sfx' }, kid: true },
    tile:    { label: 'Change a tile', fields: { x: 'number', y: 'number', tile: 'tile' }, kid: false },
    remove:  { label: 'Remove this thing', fields: {}, kid: true },
    spawn:   { label: 'Spawn an enemy here', fields: { sprite: 'sprite', hp: 'number' }, kid: false },
    shop:    { label: 'Open a shop', fields: { stock: 'text' }, kid: false },
    wait:    { label: 'Wait (seconds)', fields: { s: 'number' }, kid: false },
    win:     { label: 'Win the game', fields: { text: 'text' }, kid: true },
    lose:    { label: 'Game over', fields: { text: 'text' }, kid: false },
};
W.CONDS = { has: 'player has item', flag: 'flag is at least', money: 'money is at least', notflag: 'flag is not set' };
W.AI = { stand: 'Stands still', wander: 'Wanders', patrol: 'Walks back and forth', chase: 'Chases the player', shooter: 'Keeps distance and shoots', fly: 'Flies in waves' };
W.defaultItems = () => [
    { id: 'coin', name: 'Coin', kind: 'money', value: 1, color: '#f5c542' },
    { id: 'heart', name: 'Heart', kind: 'heal', value: 1, color: '#ef4444' },
    { id: 'potion', name: 'Potion', kind: 'heal', value: 3, color: '#a855f7' },
    { id: 'key', name: 'Key', kind: 'key', value: 0, color: '#eab308' },
];

/* ------------------------------------------------------------------ data helpers */
let uid = 1;
W.newId = () => 'e' + Date.now().toString(36) + (uid++);
W.newMap = (name, w, h, view, tileset) => {
    const m = { id: 'm' + Date.now().toString(36) + (uid++), name, w, h, view: view || 'topdown', tileset, song: 0, ground: new Array(w * h).fill(view === 'side' ? 0 : 1), over: new Array(w * h).fill(0), entities: [] };
    if (view === 'side') for (let x = 0; x < w; x++) for (let y = h - 3; y < h; y++) m.ground[y * w + x] = y === h - 3 ? 1 : 2;
    return m;
};
W.newWorld = (P, tilesetRef, cols, names) => ({ start: null, items: W.defaultItems(), player: { hp: 5, speed: 1.4, attack: 1 }, maps: [] });
W.entity = (template, x, y) => ({ id: W.newId(), t: template, x, y, props: JSON.parse(JSON.stringify(W.TEMPLATES[template].props)), rules: [] });

/* Turn a platformer project (levels + tile set) into a World: every level becomes a side-view map, goals lead to the next level, the last goal wins.
 * Lets platformer games use the World player, the PC / Xbox package and everything else built on Worlds. Returns the world; sets P.world if you pass keep=true. */
W.fromPlatformer = (P, keep) => {
    const world = W.newWorld(); const warnings = [];
    const maps = P.levels.map(L => { const m = W.newMap(L.name, L.w, L.h, 'side', 'side'); m.ground = L.map.slice(); m.song = L.song || 0; return m; });
    P.levels.forEach((L, i) => {
        const m = maps[i], next = maps[i + 1], start = L.objects.find(o => o.type === 'start') || { x: 2, y: 2 };
        const E = (t, x, y, props, rules) => { const e = W.entity(t, x, y); Object.assign(e.props, props || {}); e.rules = rules || []; m.entities.push(e); return e; };
        E('start', start.x, start.y);
        for (const o of L.objects) {
            if (o.type === 'start') continue;
            if (o.type === 'coin') E('item', o.x, o.y, { item: 'coin', count: 1, sprite: 'coin' });
            else if (o.type === 'heart') E('item', o.x, o.y, { item: 'heart', count: 1, sprite: 'heart' });
            else if (o.type === 'walker') E('enemy', o.x, o.y, { sprite: 'walker', ai: 'patrol', hp: 1, damage: 1, speed: 0.5, drop: '' });
            else if (o.type === 'hopper') E('enemy', o.x, o.y, { sprite: 'hopper', ai: 'wander', hp: 1, damage: 1, speed: 0.7, drop: '' });
            else if (o.type === 'flyer') E('enemy', o.x, o.y, { sprite: 'flyer', ai: 'chase', hp: 1, damage: 1, speed: 0.5, drop: '' });
            else if (o.type === 'goal') {
                if (next) { const ns = P.levels[i + 1].objects.find(q => q.type === 'start') || { x: 2, y: 2 }; E('door', o.x, o.y, { toMap: next.id, toX: ns.x, toY: ns.y, invisible: false, sprite: 'goal' }); }
                else E('trigger', o.x, o.y, { w: 1, h: 2, once: true }, [{ on: 'enter', actions: [{ do: 'win', text: 'You made it!' }] }]);
            } else if (o.type === 'spring' || o.type === 'check') { E('prop', o.x, o.y, { sprite: o.type, solid: false, checkpoint: o.type === 'check' }); }
        }
    });
    world.maps = maps; world.player = { hp: 3, speed: 1.4, attack: 1 };
    if (keep) { P.world = world; P.worldFromPlatformer = true; }
    return { world, warnings };
};
W.resize = (m, w, h) => { const g = new Array(w * h).fill(0), o = new Array(w * h).fill(0); for (let y = 0; y < Math.min(h, m.h); y++) for (let x = 0; x < Math.min(w, m.w); x++) { g[y * w + x] = m.ground[y * m.w + x]; o[y * w + x] = m.over[y * m.w + x]; } m.ground = g; m.over = o; m.w = w; m.h = h; m.entities = m.entities.filter(e => e.x < w && e.y < h); };
W.flagsUsed = world => { const s = new Set(); const walk = acts => (acts || []).forEach(a => { if (a.name && (a.do === 'flag' || a.do === 'addflag')) s.add(a.name); if (a.test && a.test.flag) s.add(a.test.flag); walk(a.yes); walk(a.no); walk(a.then); walk(a.else); }); world.maps.forEach(m => m.entities.forEach(e => e.rules.forEach(r => { walk(r.actions); if (r.if && r.if.flag) s.add(r.if.flag); }))); return [...s]; };
/* every piece of text in the world, with a setter, so the editor can list and edit them in one place */
W.allText = world => {
    const out = [];
    for (const m of world.maps) {
        out.push({ map: m, where: m.name + ' › intro (when entering)', get: () => m.intro || '', set: v => m.intro = v, intro: true });
        for (const e of m.entities) {
            const T = W.TEMPLATES[e.t], label = `${m.name} › ${e.props.name || T.label} (${e.x},${e.y})`;
            if ('lines' in e.props) out.push({ map: m, ent: e, where: label + ' · default lines', get: () => e.props.lines, set: v => e.props.lines = v });
            if ('text' in e.props) out.push({ map: m, ent: e, where: label + ' · sign', get: () => e.props.text, set: v => e.props.text = v });
            const walk = (acts, path) => (acts || []).forEach((a, i) => { if ((a.do === 'say' || a.do === 'choice' || a.do === 'win' || a.do === 'lose') ) out.push({ map: m, ent: e, where: `${label} · ${path}${i + 1}`, get: () => a.text || '', set: v => a.text = v }); walk(a.yes, path + (i + 1) + ' yes › '); walk(a.no, path + (i + 1) + ' no › '); walk(a.then, path + (i + 1) + ' then › '); walk(a.else, path + (i + 1) + ' else › '); });
            e.rules.forEach((r, ri) => walk(r.actions, `rule ${ri + 1} (when ${W.TRIGGERS[r.on] || r.on}) › step `));
        }
    }
    return out;
};
/* checks for the Fix-it tab: problems that make a world unplayable */
W.check = (world) => {
    const out = [];
    if (!world.maps.length) out.push({ code: 'NO_MAP', msg: 'The world has no maps yet.' });
    const starts = world.maps.flatMap(m => m.entities.filter(e => e.t === 'start').map(e => [m, e]));
    if (!starts.length && world.maps.length) out.push({ code: 'NO_START', msg: 'No Player start: place one on the first map.' });
    for (const m of world.maps) for (const e of m.entities) {
        if (e.t === 'door' && e.props.toMap && !world.maps.some(x => x.id === e.props.toMap)) out.push({ code: 'DOOR_NOWHERE', msg: `A door on "${m.name}" goes to a map that no longer exists.`, map: m.id, id: e.id });
        const walk = acts => (acts || []).forEach(a => { if (a.do === 'warp' && !world.maps.some(x => x.id === a.map)) out.push({ code: 'WARP_NOWHERE', msg: `A rule on "${m.name}" goes to a missing map.`, map: m.id, id: e.id }); if ((a.do === 'give' || a.do === 'take') && !world.items.some(i => i.id === a.item)) out.push({ code: 'NO_ITEM', msg: `A rule on "${m.name}" uses an item that is not in the item list.`, map: m.id, id: e.id }); walk(a.yes); walk(a.no); walk(a.then); walk(a.else); });
        e.rules.forEach(r => walk(r.actions));
    }
    return out;
};

/* ------------------------------------------------------------------ runtime */
/* W.play(canvas, P, opts) -> { stop(), state }. opts: { map, x, y, keys (object updated by caller), onEvent(msg) } */
W.play = (cv, P, opts = {}) => {
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const world = JSON.parse(JSON.stringify(P.world)), ims = opts.images || {}, keys = opts.keys || {};
    const SW = cv.width, SH = cv.height, TS = 16;
    const st = { hp: world.player.hp, maxhp: world.player.hp, money: 0, inv: {}, flags: {}, taken: {}, msg: null, over: null, log: [], frame: 0 };
    let map, M, cols, ents = [], px = 0, py = 0, vx = 0, vy = 0, face = 2, ground = false, inv = 0, camx = 0, camy = 0, atk = 0, busy = null, stopped = false;
    const items = Object.fromEntries(world.items.map(i => [i.id, i]));
    const log = s => { st.log.push(s); if (opts.onEvent) opts.onEvent(s); };
    const tilesetOf = m => (P.worldTilesets && P.worldTilesets[m.tileset]) || { image: P.tileset.image, cols: P.tileset.cols };
    function load(mapId, tx, ty) {
        map = world.maps.find(m => m.id === mapId) || world.maps[0]; M = map; cols = tilesetOf(map).cols;
        ents = map.entities.filter(e => e.t !== 'start' && !st.taken[e.id]).map(e => ({ ...e, ex: e.x * TS, ey: e.y * TS, hp: +(e.props.hp || 1), vx: 0, vy: 0, t: e.t, timer: 0, dead: false, fired: false, home: [e.x * TS, e.y * TS], spawned: 0 }));
        px = tx * TS; py = ty * TS; vx = vy = 0;
        log('map:' + map.name);
        if (opts.music) opts.music(map.song);
        if (map.intro && (map.introAlways || !st.taken['intro' + map.id])) { st.taken['intro' + map.id] = 1; String(map.intro).split('\n').filter(Boolean).forEach(l => queue.push([{ do: 'say', text: l }, null])); }
        for (const e of ents) for (const r of e.rules) if (r.on === 'load') run(r, e);
    }
    const colAt = (x, y) => { const mx = Math.floor(x / TS), my = Math.floor(y / TS); if (mx < 0 || my < 0 || mx >= M.w || my >= M.h) return 1; const o = M.over[my * M.w + mx]; if (o && cols[o] === 1) return 1; return cols[M.ground[my * M.w + mx]] || 0; };
    const solidEnt = (x, y, w, h, self) => ents.some(e => e !== self && !e.dead && (['npc', 'shop', 'sign', 'chest', 'save'].includes(e.t) || (e.t === 'prop' && e.props.solid)) && x < e.ex + 14 && e.ex + 2 < x + w && y < e.ey + 14 && e.ey + 2 < y + h);
    const blocked = (x, y, w, h, self) => { for (const [cx, cy] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1], [x + w / 2, y + h - 1]]) { const c = colAt(cx, cy); if (c === 1) return true; } return solidEnt(x, y, w, h, self); };
    const HW = 12, HH = 12;      // player feet box (top-down)
    /* ---------------------------------------------------------- rules */
    const condOk = c => { if (!c || !c.kind) return true; if (c.kind === 'has') return (st.inv[c.item] || 0) >= (c.n || 1); if (c.kind === 'flag') return (st.flags[c.flag] || 0) >= (c.value == null ? 1 : c.value); if (c.kind === 'notflag') return !st.flags[c.flag]; if (c.kind === 'money') return st.money >= (c.n || 0); return true; };
    const queue = [];
    function run(rule, e) { if (!condOk(rule.if)) return; if (rule.once && e && st.taken['r' + e.id + rule.on]) return; if (rule.once && e) st.taken['r' + e.id + rule.on] = 1; queue.push(...(rule.actions || []).map(a => [a, e])); }
    function addItem(id, n, pickup) { const it = items[id]; if (!it) return; if (it.kind === 'money') st.money += n * (it.value || 1); else if (it.kind === 'heal' && pickup && st.hp < st.maxhp) st.hp = Math.min(st.maxhp, st.hp + n * (it.value || 1)); else st.inv[id] = (st.inv[id] || 0) + n; }
    function step_actions() {
        while (!busy && queue.length) {
            const [a, e] = queue.shift();
            if (a.do === 'say') { busy = { kind: 'say', text: a.text || '' }; log('say:' + a.text); }
            else if (a.do === 'choice') { busy = { kind: 'choice', text: a.text || '', sel: 0, yes: a.yes || [], no: a.no || [], e }; log('ask:' + a.text); }
            else if (a.do === 'give') { addItem(a.item, a.n || 1); log('give:' + a.item); }
            else if (a.do === 'take') { st.inv[a.item] = Math.max(0, (st.inv[a.item] || 0) - (a.n || 1)); }
            else if (a.do === 'money') st.money = Math.max(0, st.money + (a.n || 0));
            else if (a.do === 'heal') st.hp = Math.min(st.maxhp, st.hp + (a.n || 1));
            else if (a.do === 'hurt') damage(a.n || 1);
            else if (a.do === 'flag') { st.flags[a.name] = a.value == null ? 1 : a.value; log('flag:' + a.name); }
            else if (a.do === 'addflag') st.flags[a.name] = (st.flags[a.name] || 0) + (a.value == null ? 1 : a.value);
            else if (a.do === 'if') queue.unshift(...(condOk(a.test) ? (a.then || []) : (a.else || [])).map(x => [x, e]));
            else if (a.do === 'warp') { load(a.map, a.x || 0, a.y || 0); }
            else if (a.do === 'music') { if (opts.music) opts.music(a.song); }
            else if (a.do === 'sound') { if (opts.sound) opts.sound(a.sfx); }
            else if (a.do === 'tile') { if (a.x >= 0 && a.y >= 0 && a.x < M.w && a.y < M.h) M.ground[a.y * M.w + a.x] = a.tile | 0; }
            else if (a.do === 'remove') { if (e) { e.dead = true; st.taken[e.id] = 1; } }
            else if (a.do === 'spawn') ents.push({ id: W.newId(), t: 'enemy', ex: e ? e.ex : px, ey: e ? e.ey : py, hp: a.hp || 1, props: { sprite: a.sprite || 'walker', ai: 'chase', damage: 1, speed: 0.6 }, rules: [], vx: 0, vy: 0, timer: 0, home: [px, py] });
            else if (a.do === 'shop') busy = { kind: 'shop', stock: parseStock(a.stock), sel: 0 };
            else if (a.do === 'wait') busy = { kind: 'wait', t: Math.round((a.s || 1) * 60) };
            else if (a.do === 'win') { st.over = { win: true, text: a.text || 'You win!' }; log('win'); }
            else if (a.do === 'lose') { st.over = { win: false, text: a.text || 'Game over' }; }
        }
    }
    const parseStock = s => String(s || '').split(',').map(p => p.trim()).filter(Boolean).map(p => { const [id, price] = p.split(':'); return { id: id.trim(), price: +price || 0 }; }).filter(x => items[x.id]);
    function damage(n) { if (inv) return; st.hp -= n; inv = 60; log('hurt'); if (opts.sound) opts.sound('hurt'); if (st.hp <= 0) die(); }
    function die() { if (st.cp) { st.hp = st.maxhp; st.over = null; load(st.cp.map, st.cp.x, st.cp.y); inv = 90; log('respawn'); return; } st.over = { win: false, text: 'Game over' }; log('dead'); }
    function interact(e) {
        if (e.t === 'npc') { const rules = e.rules.filter(r => r.on === 'talk' && condOk(r.if) && !(r.once && st.taken['r' + e.id + r.on])); if (rules.length) run(rules[0], e); else String(e.props.lines || '').split('\n').filter(Boolean).forEach(l => queue.push([{ do: 'say', text: (e.props.name ? e.props.name + ': ' : '') + l }, e])); }
        else if (e.t === 'sign') { queue.push([{ do: 'say', text: e.props.text }, e]); e.rules.filter(r => r.on === 'talk').forEach(r => run(r, e)); }
        else if (e.t === 'chest') { if (!st.taken[e.id]) { st.taken[e.id] = 1; addItem(e.props.item, +e.props.count || 1); queue.push([{ do: 'say', text: `Found ${e.props.count} × ${(items[e.props.item] || {}).name || e.props.item}!` }, e]); e.opened = true; } else queue.push([{ do: 'say', text: 'It is empty.' }, e]); e.rules.filter(r => r.on === 'talk').forEach(r => run(r, e)); }
        else if (e.t === 'shop') { queue.push([{ do: 'say', text: (e.props.name || 'Shop') + ': Take a look!' }, e], [{ do: 'shop', stock: e.props.stock }, e]); }
        else if (e.t === 'save') { st.hp = st.maxhp; try { localStorage.setItem('nr_world_save', JSON.stringify({ map: map.id, x: Math.round(px / TS), y: Math.round(py / TS), st })); } catch (er) {} queue.push([{ do: 'say', text: 'Game saved. You feel rested.' }, e]); log('save'); }
        else e.rules.filter(r => r.on === 'talk').forEach(r => run(r, e));
    }
    /* ---------------------------------------------------------- update */
    let prevA = false, prevB = false, prevU = false, prevD = false, prevC = false, prevJ = false, jbuf = 0, coy = 0;
    function update() {
        st.frame++;
        const A = !!(keys.z || keys.Z || keys[' '] || keys.Enter), B = !!(keys.x || keys.X);
        const pA = A && !prevA, pB = B && !prevB; prevA = A; prevB = B;
        const up = !!keys.ArrowUp, dn = !!keys.ArrowDown, pU = up && !prevU, pD = dn && !prevD; prevU = up; prevD = dn;
        const C = !!(keys.c || keys.C), pC = C && !prevC; prevC = C;
        if (st.over) return;
        if (busy) {
            if (busy.kind === 'wait') { if (--busy.t <= 0) busy = null; }
            else if (busy.kind === 'say') { if (pA || pB) busy = null; }
            else if (busy.kind === 'choice') { if (pU || pD) busy.sel ^= 1; if (pA) { const b = busy; busy = null; queue.unshift(...(b.sel === 0 ? b.yes : b.no).map(x => [x, b.e])); log('chose:' + (b.sel ? 'no' : 'yes')); } }
            else if (busy.kind === 'bag') { const list = Object.entries(st.inv).filter(([, n]) => n > 0); const n = list.length + 1; if (pU) busy.sel = (busy.sel + n - 1) % n; if (pD) busy.sel = (busy.sel + 1) % n; if (pB || pC || (pA && busy.sel === n - 1)) busy = null; else if (pA) { const [id] = list[busy.sel]; const it = items[id]; if (it && it.kind === 'heal' && st.hp < st.maxhp) { st.hp = Math.min(st.maxhp, st.hp + (it.value || 1)); st.inv[id]--; log('use:' + id); } } }
            else if (busy.kind === 'shop') { const n = busy.stock.length + 1; if (pU) busy.sel = (busy.sel + n - 1) % n; if (pD) busy.sel = (busy.sel + 1) % n; if (pB || (pA && busy.sel === n - 1)) busy = null; else if (pA) { const s = busy.stock[busy.sel]; if (st.money >= s.price) { st.money -= s.price; addItem(s.id, 1); log('bought:' + s.id); if (opts.sound) opts.sound('coin'); } } }
            step_actions(); return;
        }
        step_actions(); if (busy) return;
        if (pC) { busy = { kind: 'bag', sel: 0 }; return; }
        const side = M.view === 'side', ph = P.meta.physics, sp = world.player.speed || 1.4;
        if (side) {
            const maxv = B ? ph.runFast : ph.run;
            if (keys.ArrowLeft) { vx = Math.max(-maxv, vx - ph.accel); face = 1; } else if (keys.ArrowRight) { vx = Math.min(maxv, vx + ph.accel); face = 3; } else vx = vx > 0 ? Math.max(0, vx - ph.accel) : Math.min(0, vx + ph.accel);
            const hw = 12, hh = (P.sprites.hero.h || 32) - 2;
            let nx = px + vx; if (blocked(nx, py, hw, hh)) { vx = 0; nx = px; } px = nx;
            const talkT = pA ? ents.find(e => !e.dead && ['npc', 'sign', 'chest', 'shop', 'save'].includes(e.t) && Math.abs(e.ex + 8 - (px + 6)) < 22 && Math.abs(e.ey + 8 - (py + hh - 8)) < 24) : null;
            if (talkT) { interact(talkT); prevJ = A; return; }
            if (A && !prevJ) jbuf = 6; else if (jbuf) jbuf--; prevJ = A; coy = ground ? 6 : Math.max(0, coy - 1);
            if (jbuf && coy) { let j = ph.jump; if (ph.jumpRun && ph.runFast) j += (ph.jumpRun - ph.jump) * Math.min(Math.abs(vx), ph.runFast) / ph.runFast; vy = -j; ground = false; jbuf = coy = 0; if (opts.sound) opts.sound('jump'); }
            vy = Math.min(ph.maxFall || 5, vy + ph.gravity * (vy < 0 && !A ? 2 : 1));
            let ny = py + vy; ground = false;
            if (blocked(px, ny, hw, hh)) { if (vy > 0) { ny = Math.floor((ny + hh) / TS) * TS - hh; ground = true; } else ny = Math.floor(ny / TS) * TS + TS; vy = 0; if (blocked(px, ny, hw, hh)) ny = py; }
            else if (vy > 0) { const c1 = colAt(px + 2, ny + hh), c2 = colAt(px + hw - 2, ny + hh), top = Math.floor((ny + hh) / TS) * TS; if ((c1 === 2 || c2 === 2) && py + hh <= top) { ny = top - hh; vy = 0; ground = true; } }
            py = ny;
            if (!ground && vy >= 0) { const b1 = colAt(px + 1, py + hh + 0.5), b2 = colAt(px + hw - 2, py + hh + 0.5); if (b1 === 1 || b2 === 1 || ((b1 === 2 || b2 === 2) && (py + hh) % TS < 1)) ground = true; }
            if (colAt(px + hw / 2, py + hh - 1) === 3 || py > M.h * TS) { if (py > M.h * TS) { st.hp = 0; inv = 0; } damage(1); if (st.hp <= 0 && !st.over) die(); }
            for (const e of ents) if (e.t === 'prop' && e.props.checkpoint && !e.on && Math.abs(e.ex + 8 - (px + hw / 2)) < 12 && Math.abs(e.ey + 8 - (py + hh / 2)) < 16) { for (const o of ents) if (o.props && o.props.checkpoint) o.on = false; e.on = true; st.cp = { map: map.id, x: e.x, y: e.y }; log('checkpoint'); if (opts.sound) opts.sound('pick'); }
        } else {
            let dx = 0, dy = 0;
            if (keys.ArrowLeft) { dx = -1; face = 1; } if (keys.ArrowRight) { dx = 1; face = 3; } if (keys.ArrowUp) { dy = -1; face = 0; } if (keys.ArrowDown) { dy = 1; face = 2; }
            const k = dx && dy ? 0.7071 : 1, s = sp * (B ? 1.6 : 1);
            const nx = px + dx * s * k, ny = py + dy * s * k;
            if (!blocked(nx, py, HW, HH)) px = nx; if (!blocked(px, ny, HW, HH)) py = ny;
            if (colAt(px + 6, py + 6) === 3) damage(1);
        }
        if (inv) inv--;
        // action button: talk to what is in front, else attack
        if (pA && !side) {
            const fx = px + 6 + [0, -14, 0, 14][face], fy = py + 6 + [-14, 0, 14, 0][face];
            const t = ents.find(e => !e.dead && Math.abs(e.ex + 8 - fx) < 12 && Math.abs(e.ey + 8 - fy) < 12 && e.t !== 'enemy');
            if (t) interact(t); else { atk = 12; if (opts.sound) opts.sound('stomp'); }
        }
        if (atk) atk--;
        // entities
        for (const e of ents) {
            if (e.dead) continue; e.timer++;
            const hit = (bx, by, bw, bh) => px < bx + bw && bx < px + HW && py < by + bh && by < py + (side ? (P.sprites.hero.h || 32) - 2 : HH);
            if (e.t === 'enemy') {
                const ai = e.props.ai || 'chase', spd = +e.props.speed || 0.6, dxp = px - e.ex, dyp = py - e.ey, dist = Math.hypot(dxp, dyp);
                let mx = 0, my = 0;
                if (ai === 'chase' && dist < 160) { mx = dxp / dist * spd; my = side ? 0 : dyp / dist * spd; }
                else if (ai === 'wander') { if (e.timer % 90 === 1) { const a = Math.random() * 6.28; e.vx = Math.cos(a) * spd; e.vy = side ? 0 : Math.sin(a) * spd; } mx = e.vx; my = e.vy; }
                else if (ai === 'patrol') { if (!e.vx) e.vx = spd; mx = e.vx; }
                else if (ai === 'fly') { mx = Math.sign(dxp || 1) * spd * 0.8; my = Math.sin(e.timer / 20) * 0.8; }
                else if (ai === 'shooter') { if (dist < 60) { mx = -dxp / dist * spd; my = side ? 0 : -dyp / dist * spd; } if (e.timer % 90 === 0 && dist < 180) ents.push({ id: 'b', t: 'bullet', ex: e.ex + 4, ey: e.ey + 4, vx: dxp / dist * 2, vy: dyp / dist * 2, props: {}, rules: [], timer: 0, dead: false }); }
                if (side && ai !== 'fly') { e.vy = (e.vy || 0) + ph.gravity; if (blocked(e.ex, e.ey + e.vy, 14, 14, e)) e.vy = 0; e.ey += e.vy; }
                if (!blocked(e.ex + mx, e.ey, 14, 14, e)) e.ex += mx; else if (ai === 'patrol') e.vx = -e.vx;
                if (!blocked(e.ex, e.ey + my, 14, 14, e)) e.ey += my;
                // player attack (top-down sword swing) or stomp (side view)
                const ax = px + 6 + [0, -14, 0, 14][face], ay = py + 6 + [-14, 0, 14, 0][face];
                if (atk === 11 && Math.abs(e.ex + 8 - ax) < 14 && Math.abs(e.ey + 8 - ay) < 14) { e.hp -= world.player.attack || 1; e.ex += Math.sign(e.ex - px) * 10; e.ey += side ? 0 : Math.sign(e.ey - py) * 10; if (e.hp <= 0) defeat(e); continue; }
                if (hit(e.ex + 1, e.ey + 1, 14, 14)) { if (side && vy > 0 && py + 20 < e.ey + 10) { vy = -ph.jump * 0.6; e.hp = 0; defeat(e); } else damage(+e.props.damage || 1); }
            } else if (e.t === 'bullet') { e.ex += e.vx; e.ey += e.vy; if (e.timer > 200 || colAt(e.ex + 4, e.ey + 4) === 1) e.dead = true; else if (hit(e.ex, e.ey, 8, 8)) { e.dead = true; damage(1); } }
            else if (e.t === 'prop' && side && e.props.sprite === 'spring') { if (vy > 0 && hit(e.ex + 1, e.ey + 4, 14, 12)) { vy = -ph.jump * 1.55; ground = false; log('spring'); if (opts.sound) opts.sound('jump'); } }
            else if (e.t === 'item') { if (hit(e.ex + 2, e.ey + 2, 12, 12)) { e.dead = true; st.taken[e.id] = 1; addItem(e.props.item, +e.props.count || 1, true); log('pick:' + e.props.item); if (opts.sound) opts.sound('coin'); e.rules.filter(r => r.on === 'touch').forEach(r => run(r, e)); } }
            else if (e.t === 'door') { if (hit(e.ex + 3, e.ey + 3, 10, 10)) { if (e.props.needItem && !(st.inv[e.props.needItem] > 0)) { if (!e._msg) { queue.push([{ do: 'say', text: 'It is locked. You need: ' + ((items[e.props.needItem] || {}).name || e.props.needItem) }, e]); e._msg = 1; } } else { e.rules.filter(r => r.on === 'touch').forEach(r => run(r, e)); if (e.props.toMap) { load(e.props.toMap, +e.props.toX || 0, +e.props.toY || 0); log('door'); return; } } } else e._msg = 0; }
            else if (e.t === 'trigger') { const inside = hit(e.ex, e.ey, (+e.props.w || 1) * TS, (+e.props.h || 1) * TS); if (inside && !e.inside && !(e.props.once && e.fired)) { e.fired = true; e.rules.filter(r => r.on === 'enter').forEach(r => run(r, e)); log('trigger'); } e.inside = inside; }
            else if (e.t === 'spawner') { if (e.timer % Math.max(30, (+e.props.every || 4) * 60) === 0 && ents.filter(x => x.t === 'enemy' && x.from === e.id && !x.dead).length < (+e.props.max || 4)) ents.push({ id: W.newId(), from: e.id, t: 'enemy', ex: e.ex, ey: e.ey, hp: +e.props.hp || 1, props: { sprite: e.props.sprite, ai: e.props.ai, damage: e.props.damage, speed: e.props.speed }, rules: [], vx: 0, vy: 0, timer: 0 }); }
            else if (e.t === 'prop' || e.t === 'npc') { if (e.t === 'npc' && e.props.move === 'wander' && e.timer % 120 === 1) { e.vx = (Math.random() - 0.5); e.vy = side ? 0 : (Math.random() - 0.5); } if (e.vx && !blocked(e.ex + e.vx, e.ey + (e.vy || 0), 14, 14, e) && !hit(e.ex + e.vx, e.ey + (e.vy || 0), 16, 16)) { e.ex += e.vx; e.ey += e.vy || 0; } if (hit(e.ex, e.ey, 16, 16)) e.rules.filter(r => r.on === 'touch').forEach(r => { if (!e._t) run(r, e); }), e._t = 1; else e._t = 0; }
        }
        ents = ents.filter(e => !e.dead || e.t !== 'bullet');
        camx = Math.max(0, Math.min(M.w * TS - SW, px - SW / 2)); camy = Math.max(0, Math.min(M.h * TS - SH, py - SH / 2));
        if (M.w * TS < SW) camx = (M.w * TS - SW) / 2; if (M.h * TS < SH) camy = (M.h * TS - SH) / 2;
    }
    function defeat(e) { e.dead = true; st.taken[e.id] = 1; log('defeat'); if (opts.sound) opts.sound('stomp'); const [what, n] = String(e.props.drop || '').split(':'); if (what === 'money') st.money += +n || 1; else if (what && items[what]) addItem(what, +n || 1); e.rules.filter(r => r.on === 'defeat').forEach(r => run(r, e)); }
    /* ---------------------------------------------------------- draw */
    function spr(name, f, x, y, flip, dir) { const s0 = P.sprites[name] || P.sprites.hero; if (dir != null && M.view !== 'side' && ims[name + '__td']) { const tdf = [2, 4, 0, 4][dir] + (f ? 1 : 0); return sprImg(ims[name + '__td'], s0, tdf, x, y, dir === 1); } const s = s0, im = ims[name]; if (!im) { g.fillStyle = '#f0f'; g.fillRect(x, y, 16, 16); return; } const fr = Math.min(f, (s.frames || 1) - 1); g.save(); if (flip) { g.translate(x + s.w, y); g.scale(-1, 1); g.drawImage(im, fr * s.w, 0, s.w, s.h, 0, 0, s.w, s.h); } else g.drawImage(im, fr * s.w, 0, s.w, s.h, x, y, s.w, s.h); g.restore(); }
    function sprImg(im, s, fr, x, y, flip) { g.save(); if (flip) { g.translate(x + s.w, y); g.scale(-1, 1); g.drawImage(im, fr * s.w, 0, s.w, s.h, 0, 0, s.w, s.h); } else g.drawImage(im, fr * s.w, 0, s.w, s.h, x, y, s.w, s.h); g.restore(); }
    function wrapText(t, w) { const words = String(t).split(' '), out = []; let line = ''; for (const wd of words) { if ((line + ' ' + wd).trim().length > w) { out.push(line.trim()); line = wd; } else line += ' ' + wd; } out.push(line.trim()); return out; }
    function draw() {
        const ts = ims['__ts_' + map.tileset] || ims.__tileset;
        g.fillStyle = M.view === 'side' ? '#6ab0e8' : '#2a2a35'; g.fillRect(0, 0, SW, SH);
        if (M.view === 'side' && ims.__bg) { const bx = -((camx / 2) % 256); g.drawImage(ims.__bg, bx, 0); g.drawImage(ims.__bg, bx + 256, 0); }
        const cx = Math.floor(camx), cy = Math.floor(camy), x0 = Math.max(0, Math.floor(cx / TS)), y0 = Math.max(0, Math.floor(cy / TS));
        for (let my = y0; my <= y0 + SH / TS + 1 && my < M.h; my++) for (let mx = x0; mx <= x0 + SW / TS + 1 && mx < M.w; mx++) { const t = M.ground[my * M.w + mx]; if (t && ts) g.drawImage(ts, t * TS, 0, TS, TS, mx * TS - cx, my * TS - cy, TS, TS); }
        const list = ents.filter(e => !e.dead && e.t !== 'trigger' && e.t !== 'spawner' && !(e.t === 'door' && e.props.invisible)).sort((a, b) => a.ey - b.ey);
        const heroY = py - ((P.sprites.hero.h || 32) - (M.view === 'side' ? (P.sprites.hero.h || 32) - 2 : HH)) ;
        let heroDrawn = false;
        const drawHero = () => { if (inv & 4) return; const s = P.sprites.hero, moving = keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown; const f = M.view === 'side' && !ground ? 3 : moving ? 1 + ((st.frame >> 3) & 1) : 0; spr('hero', M.view === 'side' ? f : (moving ? (st.frame >> 3) & 1 : 0), Math.round(px - (s.w - HW) / 2 - cx), Math.round(heroY - cy), face === 1, M.view === 'side' ? null : face); if (atk) { g.fillStyle = 'rgba(255,255,255,.8)'; const ax = px + 6 + [0, -14, 0, 14][face] - cx, ay = py + 6 + [-14, 0, 14, 0][face] - cy; g.fillRect(ax - 6, ay - 6, 12, 12); } };
        for (const e of list) {
            if (!heroDrawn && e.ey > py) { drawHero(); heroDrawn = true; }
            const ex = Math.round(e.ex - cx), ey = Math.round(e.ey - cy);
            if (ex < -40 || ey < -70 || ex > SW + 8 || ey > SH + 8) continue;
            if (e.t === 'bullet') { g.fillStyle = '#ff5'; g.fillRect(ex, ey, 6, 6); continue; }
            if (e.t === 'door') { g.fillStyle = 'rgba(80,40,10,.6)'; g.fillRect(ex + 2, ey, 12, 16); continue; }
            if (e.t === 'item') { const it = items[e.props.item]; if (e.props.sprite && P.sprites[e.props.sprite] && ims[e.props.sprite]) spr(e.props.sprite, (st.frame >> 3) & 3, ex, ey); else { g.fillStyle = (it && it.color) || '#ff0'; g.beginPath(); g.arc(ex + 8, ey + 8, 5, 0, 7); g.fill(); } continue; }
            if (e.t === 'sign') { g.fillStyle = '#a0703c'; g.fillRect(ex + 2, ey + 2, 12, 9); g.fillRect(ex + 7, ey + 11, 2, 5); continue; }
            if (e.t === 'chest') { g.fillStyle = e.opened || st.taken[e.id] ? '#6b4a2a' : '#c0802a'; g.fillRect(ex + 1, ey + 4, 14, 11); g.fillStyle = '#ffd34d'; g.fillRect(ex + 7, ey + 8, 2, 3); continue; }
            if (e.t === 'save') { g.fillStyle = '#5ef'; g.beginPath(); g.moveTo(ex + 8, ey + 1); g.lineTo(ex + 15, ey + 8); g.lineTo(ex + 8, ey + 15); g.lineTo(ex + 1, ey + 8); g.fill(); continue; }
            const sname = e.props.sprite || (e.t === 'enemy' ? 'walker' : 'hero'), s = P.sprites[sname] || P.sprites.hero;
            const tdir = Math.abs(px - e.ex) > Math.abs(py - e.ey) ? (px < e.ex ? 1 : 3) : (py < e.ey ? 0 : 2); spr(sname, e.t === 'enemy' ? (st.frame >> 4) & 1 : 0, ex + 8 - s.w / 2, ey + 16 - s.h, e.t === 'enemy' ? px > e.ex : px < e.ex, e.t === 'enemy' ? null : tdir);
            if (e.t === 'npc' || e.t === 'shop') { g.fillStyle = '#fff'; g.font = '7px monospace'; g.fillText((e.props.name || '').slice(0, 10), ex - 4, ey + 16 - s.h - 2); }
        }
        if (!heroDrawn) drawHero();
        for (let my = y0; my <= y0 + SH / TS + 1 && my < M.h; my++) for (let mx = x0; mx <= x0 + SW / TS + 1 && mx < M.w; mx++) { const t = M.over[my * M.w + mx]; if (t && ts) g.drawImage(ts, t * TS, 0, TS, TS, mx * TS - cx, my * TS - cy, TS, TS); }
        // HUD
        g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, SW, 11); g.font = '8px monospace'; g.fillStyle = '#f55';
        g.fillText('♥'.repeat(Math.max(0, st.hp)) + '♡'.repeat(Math.max(0, st.maxhp - st.hp)), 3, 8); g.fillStyle = '#fd4'; g.fillText('$' + st.money, SW - 40, 8);
        const invs = Object.entries(st.inv).filter(([, n]) => n > 0).slice(0, 4).map(([k, n]) => (items[k] ? items[k].name : k).slice(0, 5) + 'x' + n).join(' ');
        g.fillStyle = '#ddd'; g.fillText(invs, 70, 8);
        if (busy && (busy.kind === 'say' || busy.kind === 'choice')) {
            g.fillStyle = 'rgba(10,10,30,.92)'; g.fillRect(4, SH - 58, SW - 8, 54); g.strokeStyle = '#fff'; g.strokeRect(4.5, SH - 57.5, SW - 9, 53);
            g.font = '8px monospace'; let tx = busy.text; const sp = /^([^:]{1,16}):\s*(.*)$/.exec(tx); let row0 = 0; if (sp) { g.fillStyle = '#fd4'; g.fillText(sp[1], 10, SH - 46); tx = sp[2]; row0 = 1; } g.fillStyle = '#fff'; wrapText(tx, 38).slice(0, 4 - row0).forEach((l, i) => g.fillText(l, 10, SH - 46 + (i + row0) * 10));
            if (busy.kind === 'choice') { ['Yes', 'No'].forEach((o, i) => { g.fillStyle = busy.sel === i ? '#fd4' : '#aaa'; g.fillText((busy.sel === i ? '▶ ' : '  ') + o, SW - 60, SH - 30 + i * 10); }); }
            else if ((st.frame >> 4) & 1) g.fillText('▼', SW - 16, SH - 8);
        }
        if (busy && busy.kind === 'shop') {
            g.fillStyle = 'rgba(10,10,30,.94)'; g.fillRect(30, 20, SW - 60, SH - 40); g.fillStyle = '#fd4'; g.font = '8px monospace'; g.fillText('SHOP   money $' + st.money, 38, 32);
            busy.stock.forEach((s, i) => { g.fillStyle = busy.sel === i ? '#fff' : '#9ab'; g.fillText((busy.sel === i ? '▶ ' : '  ') + (items[s.id] ? items[s.id].name : s.id) + '  $' + s.price, 38, 46 + i * 11); });
            g.fillStyle = busy.sel === busy.stock.length ? '#fff' : '#9ab'; g.fillText((busy.sel === busy.stock.length ? '▶ ' : '  ') + 'Leave', 38, 46 + busy.stock.length * 11);
        }
        if (busy && busy.kind === 'bag') {
            const list = Object.entries(st.inv).filter(([, n]) => n > 0);
            g.fillStyle = 'rgba(10,10,30,.94)'; g.fillRect(30, 20, SW - 60, SH - 40); g.fillStyle = '#fd4'; g.font = '8px monospace'; g.fillText('BAG   (A: use, C/X: close)', 38, 32);
            list.forEach(([id, n], i) => { g.fillStyle = busy.sel === i ? '#fff' : '#9ab'; g.fillText((busy.sel === i ? '▶ ' : '  ') + (items[id] ? items[id].name : id) + ' x' + n, 38, 46 + i * 11); });
            g.fillStyle = busy.sel === list.length ? '#fff' : '#9ab'; g.fillText((busy.sel === list.length ? '▶ ' : '  ') + 'Close', 38, 46 + list.length * 11);
        }
        if (st.over) { g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(0, SH / 2 - 20, SW, 40); g.fillStyle = st.over.win ? '#7f7' : '#f77'; g.font = 'bold 11px monospace'; g.fillText(st.over.text, SW / 2 - st.over.text.length * 3.3, SH / 2 + 4); }
    }
    // start
    let start = null; for (const m of world.maps) { const e = m.entities.find(x => x.t === 'start'); if (e) { start = [m.id, e.x, e.y]; break; } }
    if (opts.map) start = [opts.map, opts.x || 0, opts.y || 0];
    if (!start) start = [world.maps[0].id, 2, 2];
    load(...start);
    if (opts.resume && opts.resume.map) { const r = opts.resume; Object.assign(st, r.st || {}); queue.length = 0; busy = null; load(r.map, r.x, r.y); }     // continue a saved game
    let last = 0, acc = 0;
    const api = { state: st, stop: () => stopped = true, warp: (id, tx, ty, f) => { load(id, tx, ty); if (f != null) face = f; }, busy: () => busy, ents: () => ents, step: n => { for (let i = 0; i < n; i++) update(); draw(); }, pos: () => ({ map: map.id, x: px, y: py }), snapshot: () => ({ map: map.id, x: Math.round(px / TS), y: Math.round(py / TS), st: JSON.parse(JSON.stringify(st)) }), draw };
    if (!opts.manual) { const loop = t => { if (stopped) return; if (!last) last = t; acc += Math.min(100, t - last); last = t; while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; } draw(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); } else draw();
    return api;
};

/* ------------------------------------------------------------------ starter worlds (offline templates) */
W.starterTown = (P, tilesetId) => {
    const world = W.newWorld(); const T = n => n;
    const town = W.newMap('Town', 40, 30, 'topdown', tilesetId), house = W.newMap('House', 12, 10, 'topdown', tilesetId), field = W.newMap('Wild field', 48, 32, 'topdown', tilesetId), cave = W.newMap('Cliff run', 80, 16, 'side', 'side');
    const set = (m, x, y, t, layer = 'ground') => { if (x >= 0 && y >= 0 && x < m.w && y < m.h) m[layer][y * m.w + x] = t; };
    const rect = (m, x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(m, x, y, t); };
    // town: roads, houses, trees, water
    rect(town, 0, 14, 39, 15, 4); for (let x = 0; x < 40; x += 3) set(town, x, 14, 5); rect(town, 19, 0, 20, 29, 4);
    rect(town, 0, 13, 39, 13, 6); rect(town, 0, 16, 39, 16, 6);
    for (const [hx, hy] of [[4, 6], [26, 6], [4, 19], [26, 20]]) { rect(town, hx, hy, hx + 6, hy + 2, hx < 20 ? 15 : 16); rect(town, hx, hy + 3, hx + 6, hy + 5, 14); set(town, hx + 3, hy + 5, 17); set(town, hx + 1, hy + 4, 18); set(town, hx + 5, hy + 4, 18); }
    for (let x = 0; x < 40; x++) { set(town, x, 0, 9); set(town, x, 29, 9); } for (let y = 0; y < 30; y++) { set(town, 0, y, 9); set(town, 39, y, 9); }
    set(town, 39, 14, 4); set(town, 39, 15, 4);
    rect(town, 10, 24, 15, 27, 7); for (const [x, y] of [[13, 9], [15, 22], [33, 26], [36, 4]]) set(town, x, y, 11);
    // house interior
    rect(house, 0, 0, 11, 9, 19); rect(house, 0, 0, 11, 0, 14); rect(house, 0, 0, 0, 9, 14); rect(house, 11, 0, 11, 9, 14); rect(house, 0, 9, 11, 9, 14); set(house, 5, 9, 17); set(house, 2, 1, 24); set(house, 9, 1, 23); rect(house, 4, 4, 7, 6, 21);
    // field
    for (let i = 0; i < 90; i++) set(field, (i * 37) % 48, (i * 53) % 32, i % 3 ? 2 : 10);
    for (let x = 0; x < 48; x++) { set(field, x, 0, 9); set(field, x, 31, 9); } for (let y = 0; y < 32; y++) { set(field, 47, y, 9); }
    rect(field, 0, 14, 6, 15, 3); rect(field, 30, 10, 36, 16, 7); rect(field, 33, 10, 33, 16, 31);
    // side-view cliff run uses the platform tileset (map.tileset 'side')
    for (let x = 20; x < 24; x++) for (let y = 13; y < 16; y++) cave.ground[y * 80 + x] = 0;
    for (let x = 40; x < 46; x++) cave.ground[9 * 80 + x] = 5;
    const E = (m, t, x, y, props, rules) => { const e = W.entity(t, x, y); Object.assign(e.props, props || {}); e.rules = rules || []; m.entities.push(e); return e; };
    E(town, 'start', 20, 17);
    E(town, 'sign', 22, 17, { text: 'Welcome to Notareal Town! The field is to the east.' });
    E(town, 'npc', 17, 18, { name: 'Maya', lines: 'I lost my key in the wild field...\nCould you find it for me?' }, [
        { on: 'talk', if: { kind: 'has', item: 'key', n: 1 }, actions: [{ do: 'say', text: 'Maya: My key! Thank you so much!' }, { do: 'take', item: 'key', n: 1 }, { do: 'money', n: 50 }, { do: 'flag', name: 'helped_maya', value: 1 }, { do: 'say', text: 'You got $50.' }] },
        { on: 'talk', if: { kind: 'notflag', flag: 'helped_maya' }, actions: [{ do: 'say', text: 'Maya: I lost my key in the wild field... Could you find it?' }] },
        { on: 'talk', if: { kind: 'flag', flag: 'helped_maya', value: 1 }, actions: [{ do: 'say', text: 'Maya: You are the best! Visit the cliffs past the river.' }] }]);
    E(town, 'shop', 29, 12, { name: 'Shop', stock: 'potion:15, key:200' });
    const hd = E(town, 'door', 7, 11, { toMap: house.id, toX: 5, toY: 7 });
    E(house, 'door', 5, 9, { toMap: town.id, toX: 7, toY: 12 });
    E(house, 'chest', 9, 3, { item: 'potion', count: 2 });
    E(house, 'save', 2, 6, {});
    E(house, 'npc', 6, 3, { name: 'Grandpa', lines: 'Stay out of the field at night.' });
    E(town, 'door', 39, 14, { toMap: field.id, toX: 1, toY: 14, invisible: true });
    E(field, 'door', 0, 14, { toMap: town.id, toX: 38, toY: 14, invisible: true });
    E(field, 'item', 40, 25, { item: 'key', count: 1, sprite: '' });
    for (const [x, y] of [[12, 8], [22, 20], [28, 5], [40, 20]]) E(field, 'enemy', x, y, { sprite: 'walker', ai: x % 2 ? 'wander' : 'chase', hp: 2, drop: 'money:5' });
    for (const [x, y] of [[8, 10], [9, 10], [10, 10], [15, 26], [16, 26]]) E(field, 'item', x, y, { item: 'coin', count: 1, sprite: 'coin' });
    E(field, 'door', 46, 28, { toMap: cave.id, toX: 2, toY: 10 });
    E(cave, 'start', 2, 10);
    for (const x of [10, 14, 30, 50, 52]) E(cave, 'item', x, 11, { item: 'coin', count: 1, sprite: 'coin' });
    E(cave, 'enemy', 34, 12, { sprite: 'walker', ai: 'patrol', hp: 1 });
    E(cave, 'npc', 76, 12, { name: 'Hermit', lines: '' }, [{ on: 'talk', actions: [{ do: 'say', text: 'Hermit: You made it to the end of the cliffs!' }, { do: 'choice', text: 'Ready to finish your adventure?', yes: [{ do: 'win', text: 'THE END - thanks for playing!' }], no: [{ do: 'say', text: 'Take your time.' }] }] }]);
    cave.entities = cave.entities.filter(e => e.t !== 'start');
    world.maps.push(town, house, field, cave);
    return world;
};
/* Moonlight Holler DS preset: the Town starter, renamed and extended, with the bottom-screen panel (Map / World / Items / Chests) switched on.
 * Chests hold named items so the Items and Chests tabs have something to show. Edit anything after. */
W.moonlightHoller = (P, tilesetId) => {
    const world = W.starterTown(P, tilesetId); world.panel = true; world.player = { hp: 8, speed: 1.3, attack: 2 };
    world.items.push({ id: 'moonshine', name: 'Moonshine', kind: 'heal', value: 4, color: '#f5e6a8' }, { id: 'lockpick', name: 'Lockpick', kind: 'stuff', value: 0, color: '#9ca3af' }, { id: 'oldmap', name: 'Old Holler Map', kind: 'stuff', value: 0, color: '#d6b36a' }, { id: 'lantern', name: 'Lantern', kind: 'stuff', value: 0, color: '#fbbf24' }, { id: 'cellarkey', name: 'Cellar Key', kind: 'key', value: 0, color: '#60a5fa' });
    const [town, house, field, cave] = world.maps; town.name = 'Moonlight Holler'; house.name = "Steve's Place"; field.name = 'Holler Woods'; cave.name = 'Old Mine Run';
    const E = (m, t, x, y, props, rules) => { const e = W.entity(t, x, y); Object.assign(e.props, props || {}); e.rules = rules || []; m.entities.push(e); return e; };
    E(town, 'chest', 23, 18, { item: 'moonshine', count: 2 }); E(town, 'chest', 3, 22, { item: 'lockpick', count: 1 }); E(house, 'chest', 3, 3, { item: 'oldmap', count: 1 });
    E(field, 'chest', 10, 20, { item: 'lantern', count: 1 }); E(field, 'chest', 38, 6, { item: 'potion', count: 3 }); E(field, 'chest', 20, 28, { item: 'cellarkey', count: 1 }); E(cave, 'chest', 60, 11, { item: 'coin', count: 25 });
    town.entities.find(e => e.t === 'sign').props.text = 'Welcome to Moonlight Holler! Tap the bottom screen: MAP, WORLD, ITEMS and CHESTS tabs (or press L / R).';
    return world;
};

/* Fallout-style survival RPG reference game: "Berea: After the Fall" (a ruined Kentucky college town). A settlement hub with a trader and a doctor,
 * a wasteland road with raiders, mutant dogs and a roach nest, the college ruins with a raider boss, a mountain cave and a bunker ending.
 * Quests use story flags and counters; stimpaks, scrap, ammo, water and a key gate the way. Everything is editable in the World tab. */
W.berea = (P, tilesetId) => {
    const world = W.newWorld(); world.player = { hp: 12, speed: 1.2, attack: 2 };
    world.items.push(
        { id: 'stimpak', name: 'Stimpak', kind: 'heal', value: 6, color: '#ef4444' }, { id: 'radaway', name: 'RadAway', kind: 'heal', value: 3, color: '#f59e0b' },
        { id: 'scrap', name: 'Scrap Metal', kind: 'stuff', value: 0, color: '#9ca3af' }, { id: 'water', name: 'Clean Water', kind: 'heal', value: 2, color: '#60a5fa' },
        { id: 'ammo', name: 'Ammo Box', kind: 'stuff', value: 0, color: '#d97706' }, { id: 'bunkerkey', name: 'Bunker Key Card', kind: 'key', value: 0, color: '#22d3ee' },
        { id: 'datachip', name: 'Pre-War Data Chip', kind: 'stuff', value: 0, color: '#a78bfa' });
    const sq = W.newMap('Berea Square', 36, 26, 'topdown', tilesetId), road = W.newMap('Old US-25', 60, 26, 'topdown', tilesetId), college = W.newMap('College Ruins', 44, 28, 'topdown', tilesetId), cave = W.newMap('Fort Mountain Cave', 40, 24, 'topdown', tilesetId), bunker = W.newMap('Bunker 12', 24, 16, 'topdown', tilesetId);
    const set = (m, x, y, t) => { if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.ground[y * m.w + x] = t; }, rect = (m, x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(m, x, y, t); };
    const border = (m, t) => { for (let x = 0; x < m.w; x++) { set(m, x, 0, t); set(m, x, m.h - 1, t); } for (let y = 0; y < m.h; y++) { set(m, 0, y, t); set(m, m.w - 1, y, t); } };
    const rubble = (m, n, seed) => { let s = seed; for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const x = 2 + s % (m.w - 4); s = (s * 1103515245 + 12345) & 0x7fffffff; const y = 2 + s % (m.h - 4); if (m.ground[y * m.w + x] === 8) set(m, x, y, i % 3 ? 12 : 9); } };
    const E = (m, t, x, y, props, rules) => { const e = W.entity(t, x, y); Object.assign(e.props, props || {}); e.rules = rules || []; m.entities.push(e); return e; };
    // Berea Square: sand-and-dirt settlement behind rubble walls
    for (const m of [sq, road, college, cave]) rect(m, 0, 0, m.w - 1, m.h - 1, 8);
    rect(sq, 0, 12, 35, 13, 3); rect(sq, 17, 0, 18, 25, 3); border(sq, 12);
    for (const [hx, hy] of [[3, 4], [24, 4], [3, 17], [24, 17]]) { rect(sq, hx, hy, hx + 7, hy + 3, 14); rect(sq, hx, hy, hx + 7, hy, 16); set(sq, hx + 3, hy + 3, 17); set(sq, hx + 1, hy + 2, 18); set(sq, hx + 5, hy + 2, 18); }
    rubble(sq, 30, 11); rect(sq, 14, 9, 21, 9, 8); set(sq, 35, 12, 3); set(sq, 35, 13, 3);
    rect(bunker, 0, 0, 23, 15, 19); border(bunker, 14); rect(bunker, 8, 5, 15, 5, 14); set(bunker, 11, 5, 19); rect(bunker, 4, 3, 5, 4, 14);
    // road: long wasteland strip with cars (rocks) and a roach nest
    rect(road, 0, 12, 59, 13, 4); for (let x = 0; x < 60; x += 4) set(road, x, 12, 5); border(road, 12); rubble(road, 120, 7); rect(road, 0, 12, 59, 13, 4);
    rect(road, 42, 4, 50, 8, 8); rect(road, 41, 3, 51, 3, 12); rect(road, 41, 9, 51, 9, 12);
    // college ruins: broken hall with a courtyard
    border(college, 12); rect(college, 6, 4, 37, 4, 14); rect(college, 6, 4, 6, 22, 14); rect(college, 37, 4, 37, 22, 14); rect(college, 6, 22, 37, 22, 14); rect(college, 7, 5, 36, 21, 19);
    for (const x of [14, 22, 30]) { rect(college, x, 8, x, 13, 14); rect(college, x, 16, x, 21, 14); } set(college, 21, 22, 19); rect(college, 20, 22, 22, 24, 3); rect(college, 7, 14, 12, 14, 14); rect(college, 24, 14, 29, 14, 14);
    rubble(college, 25, 3);
    // cave
    border(cave, 12); rubble(cave, 140, 21); for (let x = 3; x < 38; x++) set(cave, x, 12, 3); rect(cave, 30, 6, 37, 11, 3);
    // doors
    E(sq, 'door', 35, 12, { toMap: road.id, toX: 1, toY: 12, invisible: true }); E(sq, 'door', 35, 13, { toMap: road.id, toX: 1, toY: 13, invisible: true });
    E(road, 'door', 0, 12, { toMap: sq.id, toX: 34, toY: 12, invisible: true }); E(road, 'door', 0, 13, { toMap: sq.id, toX: 34, toY: 13, invisible: true });
    E(road, 'door', 59, 12, { toMap: college.id, toX: 21, toY: 25, invisible: true }); E(road, 'door', 59, 13, { toMap: college.id, toX: 21, toY: 25, invisible: true });
    E(road, 'door', 46, 4, { toMap: cave.id, toX: 3, toY: 12 });
    E(college, 'door', 21, 27, { toMap: road.id, toX: 57, toY: 12, invisible: true });
    E(cave, 'door', 2, 12, { toMap: road.id, toX: 46, toY: 6, invisible: true });
    E(cave, 'door', 36, 8, { toMap: bunker.id, toX: 12, toY: 13, needItem: 'bunkerkey' });
    E(bunker, 'door', 12, 15, { toMap: cave.id, toX: 35, toY: 8, invisible: true });
    // Berea Square people
    E(sq, 'start', 17, 14);
    E(sq, 'sign', 20, 14, { text: 'BEREA SETTLEMENT - pop. 41. No guns drawn. The Old US-25 road leads east to the college ruins.' });
    E(sq, 'npc', 15, 15, { name: 'Elder Maggie', lines: '' }, [
        { on: 'talk', if: { kind: 'flag', flag: 'quest_done', value: 1 }, actions: [{ do: 'say', text: 'Maggie: The old world is a map now, not a home. Thank you for what you did.' }] },
        { on: 'talk', if: { kind: 'flag', flag: 'quest_chip', value: 1 }, actions: [{ do: 'if', test: { kind: 'has', item: 'datachip', n: 1 }, then: [{ do: 'say', text: 'Maggie: The data chip! The bunker holds seed vaults. Berea can eat again.' }, { do: 'take', item: 'datachip', n: 1 }, { do: 'money', n: 200 }, { do: 'flag', name: 'quest_done', value: 1 }, { do: 'win', text: 'THE FALL ENDS HERE. BEREA WILL GROW AGAIN.' }], else: [{ do: 'say', text: 'Maggie: Find the Pre-War Data Chip. Raiders hold it in the college ruins.' }] }] },
        { on: 'talk', actions: [{ do: 'say', text: 'Maggie: Stranger... the raiders in the college took our seed records. Bring back their Data Chip and the settlement is yours too.' }, { do: 'flag', name: 'quest_chip', value: 1 }, { do: 'give', item: 'ammo', n: 1 }] }]);
    E(sq, 'shop', 30, 11, { name: 'Trader Cole', stock: 'stimpak:40, radaway:25, water:8, ammo:15' });
    E(sq, 'npc', 6, 8, { name: 'Doc Hallie', lines: '' }, [
        { on: 'talk', if: { kind: 'has', item: 'scrap', n: 3 }, actions: [{ do: 'say', text: 'Hallie: Three scraps! I can build you a stimpak for that.' }, { do: 'take', item: 'scrap', n: 3 }, { do: 'give', item: 'stimpak', n: 1 }] },
        { on: 'talk', actions: [{ do: 'heal', n: 12 }, { do: 'say', text: 'Hallie: Sit. Breathe. You are patched up. Bring me 3 scrap metal and I will make you a stimpak.' }] }]);
    E(sq, 'npc', 27, 20, { name: 'Gearhead Wes', lines: 'Cars on the road still have scrap in them. Check the rocks near the wrecks.' });
    E(sq, 'npc', 8, 20, { name: 'Dog Lady Pearl', lines: 'Those mutant dogs came from the college. Stay off the dirt at night.' });
    E(sq, 'save', 14, 12, {}); E(sq, 'chest', 4, 7, { item: 'water', count: 2 }); E(sq, 'chest', 26, 8, { item: 'stimpak', count: 1 });
    // Old US-25: raiders, dogs, a nest, loot
    for (const [x, y, ai, hp] of [[10, 8, 'wander', 2], [16, 16, 'chase', 3], [24, 10, 'chase', 3], [30, 18, 'wander', 2], [36, 8, 'chase', 3], [52, 16, 'chase', 4]]) E(road, 'enemy', x, y, { name: 'Raider', sprite: 'walker', ai, hp, damage: 2, speed: .7, drop: 'money:8' });
    for (const [x, y] of [[20, 20], [34, 14], [48, 20]]) E(road, 'enemy', x, y, { name: 'Mutant Dog', sprite: 'hopper', ai: 'chase', hp: 2, damage: 1, speed: 1, drop: 'money:3' });
    E(road, 'spawner', 46, 6, { sprite: 'flyer', ai: 'chase', hp: 1, damage: 1, speed: .8, every: 6, max: 3 });
    for (const [x, y] of [[8, 20], [26, 6], [38, 20], [14, 6]]) E(road, 'item', x, y, { item: 'scrap', count: 1, sprite: 'coin' });
    E(road, 'chest', 12, 20, { item: 'ammo', count: 2 }); E(road, 'chest', 40, 5, { item: 'stimpak', count: 1 }); E(road, 'sign', 3, 14, { text: 'US-25 NORTH: Berea 0.5 mi. College 3 mi. Radiation advisory (old sign).' });
    // college ruins: patrol guards and the boss with the data chip
    for (const [x, y, ai] of [[10, 8, 'patrol'], [18, 8, 'chase'], [26, 10, 'patrol'], [10, 18, 'chase'], [18, 18, 'patrol'], [33, 18, 'chase'], [33, 8, 'chase']]) E(college, 'enemy', x, y, { name: 'Raider', sprite: 'walker', ai, hp: 3, damage: 2, speed: .7, drop: 'money:10' });
    E(college, 'enemy', 32, 12, { name: 'Raider Chief', sprite: 'walker', ai: 'chase', hp: 14, damage: 3, speed: .75, drop: '' }, [{ on: 'defeat', actions: [{ do: 'give', item: 'datachip', n: 1 }, { do: 'say', text: 'You take the Pre-War Data Chip from the Raider Chief.' }, { do: 'flag', name: 'got_chip', value: 1 }] }]);
    E(college, 'chest', 9, 6, { item: 'stimpak', count: 2 }); E(college, 'chest', 34, 20, { item: 'radaway', count: 2 }); E(college, 'item', 20, 12, { item: 'scrap', count: 1, sprite: 'coin' }); E(college, 'item', 24, 19, { item: 'ammo', count: 1, sprite: 'coin' });
    E(college, 'sign', 20, 24, { text: 'BEREA COLLEGE - Class of 2087 (the sign is scorched)' });
    // cave: key card and the bunker
    E(cave, 'start', 3, 12); for (const [x, y] of [[12, 12], [20, 12], [27, 12], [33, 9]]) E(cave, 'enemy', x, y, { name: 'Cave Roach', sprite: 'flyer', ai: 'chase', hp: 2, damage: 1, speed: .9, drop: 'money:4' });
    E(cave, 'chest', 36, 6, { item: 'bunkerkey', count: 1 }); E(cave, 'chest', 32, 7, { item: 'stimpak', count: 1 }); E(cave, 'sign', 5, 11, { text: 'Fort Mountain. Something glows at the far end.' });
    E(bunker, 'npc', 11, 8, { name: 'Bunker Terminal', lines: '' }, [{ on: 'talk', actions: [{ do: 'say', text: 'TERMINAL: SEED VAULT 12 ONLINE. 400 VARIETIES. DELIVER DATA CHIP TO BEREA SETTLEMENT.' }, { do: 'flag', name: 'bunker_found', value: 1 }] }]);
    E(bunker, 'chest', 5, 7, { item: 'stimpak', count: 3 }); E(bunker, 'chest', 18, 7, { item: 'water', count: 4 });
    world.maps.push(sq, road, college, cave, bunker);
    return world;
};
/* ------------------------------------------------------------------ compile for the console engines (DS world mode)
 * WTXT: text bank. WRLD: header, items, maps (layers + entities + rule byte-code). See engine world.c for the reader. */
W.OPS = { end: 0, say: 1, choice: 2, give: 3, take: 4, money: 5, heal: 6, hurt: 7, flag: 8, addflag: 9, if: 10, warp: 11, music: 12, sound: 13, tile: 14, remove: 15, spawn: 16, shop: 17, wait: 18, win: 19, lose: 20, jmp: 21 };
W.compileDS = (world, ctx) => {
    const texts = [], tix = new Map();
    const str = s => { s = String(s == null ? '' : s).replace(/[^\x20-\x7E\n]/g, '?'); if (tix.has(s)) return tix.get(s); tix.set(s, texts.length); texts.push(s); return texts.length - 1; };
    const flags = [], fl = n => { if (!n) return 0; let i = flags.indexOf(n); if (i < 0) { flags.push(n); i = flags.length - 1; } return Math.min(63, i); };
    const itemIx = id => { const i = world.items.findIndex(x => x.id === id); return i < 0 ? 0xFF : i; };
    const mapIx = id => { const i = world.maps.findIndex(x => x.id === id); return i < 0 ? 0xFF : i; };
    const sheet = n => n && ctx.sheetIndex[n] != null ? ctx.sheetIndex[n] : 0xFF;
    const SFXN = ['jump', 'coin', 'stomp', 'hurt', 'goal', 'spring', '1up'];
    const cond = c => !c || !c.kind ? [0, 0, 0] : c.kind === 'has' ? [1, itemIx(c.item), c.n || 1] : c.kind === 'flag' ? [2, fl(c.flag), c.value == null ? 1 : c.value] : c.kind === 'notflag' ? [3, fl(c.flag), 0] : c.kind === 'money' ? [4, 0, c.n || 0] : [0, 0, 0];
    const parseStock = s => String(s || '').split(',').map(p => p.trim()).filter(Boolean).map(p => { const [id, pr] = p.split(':'); return [itemIx(id.trim()), +pr || 0]; }).filter(x => x[0] !== 0xFF);
    function code(acts) {          // -> array of bytes; offsets are absolute within the returned array once placed
        const out = []; const u16 = v => out.push(v & 255, (v >> 8) & 255);
        const emit = (list) => { for (const a of list || []) {
            const o = W.OPS[a.do]; if (o == null) continue;
            if (a.do === 'choice' || a.do === 'if') {
                out.push(o); if (a.do === 'choice') u16(str(a.text)); else { const c = cond(a.test); out.push(c[0], c[1]); u16(c[2] & 0xFFFF); }
                const patchElse = out.length; u16(0);
                emit(a.do === 'choice' ? a.yes : a.then); out.push(W.OPS.jmp); const patchEnd = out.length; u16(0);
                const elseAt = out.length; out[patchElse] = elseAt & 255; out[patchElse + 1] = elseAt >> 8;
                emit(a.do === 'choice' ? a.no : a.else); const endAt = out.length; out[patchEnd] = endAt & 255; out[patchEnd + 1] = endAt >> 8; continue;
            }
            out.push(o);
            if (a.do === 'say' || a.do === 'win' || a.do === 'lose') u16(str(a.text));
            else if (a.do === 'give' || a.do === 'take') out.push(itemIx(a.item), Math.min(255, a.n || 1));
            else if (a.do === 'money') u16((a.n || 0) & 0xFFFF);
            else if (a.do === 'heal' || a.do === 'hurt') out.push(Math.min(255, a.n || 1));
            else if (a.do === 'flag' || a.do === 'addflag') { out.push(fl(a.name)); u16((a.value == null ? 1 : a.value) & 0xFFFF); }
            else if (a.do === 'warp') out.push(mapIx(a.map), a.x || 0, a.y || 0);
            else if (a.do === 'music') out.push(a.song || 0);
            else if (a.do === 'sound') out.push(Math.max(0, SFXN.indexOf(a.sfx)));
            else if (a.do === 'tile') out.push(a.x || 0, a.y || 0, a.tile || 0);
            else if (a.do === 'spawn') out.push(sheet(a.sprite || 'walker'), a.hp || 1);
            else if (a.do === 'shop') { const st = parseStock(a.stock).slice(0, 8); out.push(st.length); for (const [i, p] of st) { out.push(i); u16(p); } }
            else if (a.do === 'wait') u16(Math.round((a.s || 1) * 60));
        } };
        emit(acts); out.push(0); return out;
    }
    const TRIG = { talk: 1, touch: 2, enter: 3, defeat: 4, load: 5 }, TT = { start: 0, npc: 1, enemy: 2, item: 3, door: 4, sign: 5, chest: 6, shop: 7, save: 8, trigger: 9, spawner: 10, prop: 11 }, AIX = { stand: 0, wander: 1, patrol: 2, chase: 3, shooter: 4, fly: 5 };
    const B = []; const u8 = v => B.push(v & 255), u16 = v => { u8(v); u8(v >> 8); }, u32 = v => { u16(v & 0xFFFF); u16(v >>> 16); }, align = () => { while (B.length & 3) B.push(0); };
    let start = null; for (const m of world.maps) { const e = m.entities.find(x => x.t === 'start'); if (e) { start = [mapIx(m.id), e.x, e.y]; break; } }
    start = start || [0, 2, 2];
    const nm = Math.min(32, world.maps.length);
    u8(nm); u8(Math.min(64, world.items.length)); u8(world.panel ? 1 : 0); u8(start[0]); u8(start[1]); u8(start[2]); u8(world.player.hp || 5); u8(world.player.attack || 1); u16(Math.round((world.player.speed || 1.4) * 256)); u8(sheet('hero__td')); u8(0);
    const mapOffAt = B.length; for (let i = 0; i < nm; i++) u32(0);
    for (const it of world.items.slice(0, 64)) { u16(str(it.name)); u8({ stuff: 0, key: 1, heal: 2, money: 3 }[it.kind] || 0); u8(it.value || 0); const c = /^#?([0-9a-f]{6})$/i.exec(it.color || '') ? parseInt(it.color.slice(1), 16) : 0xffffff; u8(c >> 16); u8(c >> 8); u8(c); u8(0); }
    world.maps.slice(0, 32).forEach((m, mi) => {
        align(); const at = B.length; B[mapOffAt + mi * 4] = at & 255; B[mapOffAt + mi * 4 + 1] = (at >> 8) & 255; B[mapOffAt + mi * 4 + 2] = (at >> 16) & 255;
        const w = Math.min(255, m.w), h = Math.min(255, m.h), off = ctx.tileOff[m.tileset] || 0, ents = m.entities.filter(e => e.t !== 'start').slice(0, 250);
        u16(str(m.name)); u8(w); u8(h); u8(m.view === 'side' ? 1 : 0); u8(off); u8(m.song || 0); u8(m.introAlways ? 1 : 0); u16(m.intro ? str(m.intro) : 0xFFFF); u16(ents.length);
        for (const layer of ['ground', 'over']) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const t = m[layer][y * m.w + x] || 0; u8(t ? Math.min(255, t + off) : 0); }
        align();
        for (const e of ents) {
            const p = e.props; let rules = e.rules.slice();
            if (e.t === 'shop') rules = [{ on: 'talk', actions: [{ do: 'say', text: (p.name || 'Shop') + ': Take a look!' }, { do: 'shop', stock: p.stock }] }];
            const [dk, dv] = String(p.drop || '').split(':'); const dropKind = dk === 'money' ? 1 : dk && itemIx(dk) !== 0xFF ? 2 : 0;
            u8(TT[e.t] || 0); u8(e.x); u8(e.y); u8(sheet(p.sprite || (e.t === 'enemy' ? 'walker' : e.t === 'npc' || e.t === 'shop' ? 'hero' : ''))); u8(AIX[p.ai || p.move] || 0); u8(Math.min(255, +p.hp || 1)); u8(Math.min(255, +p.damage || 1)); u8(Math.min(255, Math.round((+p.speed || 0.6) * 32)));
            u8(p.move === 'wander' ? 1 : 0); u8(p.solid ? 1 : 0); u8(p.invisible ? 1 : 0); u8(p.once ? 1 : 0); u8(Math.min(255, +p.w || 1)); u8(Math.min(255, +p.h || 1)); u8(Math.min(255, +p.every || 4)); u8(Math.min(255, +p.max || 4));
            u8(p.item ? itemIx(p.item) : 0xFF); u8(Math.min(255, +p.count || 1)); u8(p.toMap ? mapIx(p.toMap) : 0xFF); u8(+p.toX || 0); u8(+p.toY || 0); u8(p.needItem ? itemIx(p.needItem) : 0xFF); u8(dropKind); u8(dropKind === 1 ? Math.min(255, +dv || 1) : Math.min(255, +dv || 1)); u8(dropKind === 2 ? itemIx(dk) : 0); u8(rules.length); { const sn = p.sprite || (e.t === 'npc' || e.t === 'shop' ? 'hero' : ''); u8(sn ? sheet(sn + '__td') : 0xFF); } u8(0);
            u16(str(p.name || '')); u16(str(p.lines != null ? p.lines : p.text != null ? p.text : ''));
            for (const r of rules) { const c = cond(r.if), cd = code(r.actions); u8(TRIG[r.on] || 1); u8(c[0]); u8(c[1]); u8(r.once ? 1 : 0); u16(c[2] & 0xFFFF); u16(cd.length); for (const b of cd) u8(b); if (B.length & 1) u8(0); }
        }
    });
    const T = []; const t16 = v => T.push(v & 255, (v >> 8) & 255); t16(texts.length); t16(0); let toff = 4 + texts.length * 4; const offs = [];
    const bytes = texts.map(s => { const b = [...s].map(c => c.charCodeAt(0)); b.push(0); return b; });
    for (const b of bytes) { offs.push(toff); toff += b.length; }
    for (const o of offs) { T.push(o & 255, (o >> 8) & 255, (o >> 16) & 255, 0); } for (const b of bytes) T.push(...b);
    return { WRLD: Uint8Array.from(B), WTXT: Uint8Array.from(T), flags };
};
if (typeof module !== 'undefined') module.exports = W; else root.NRWorld = W;
})(typeof self !== 'undefined' ? self : this);

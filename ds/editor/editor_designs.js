/* ------------------------------------------------------------------ content builders for the arcade engines (shown in the level / world builder tab)
   Shoot-em-up: enemy types + scheduled waves + boss. Breakout: brick grid. Stored in P.arcade.cfg.design; PC / Xbox and the DS ROM both play it. */
function dsgSel(opts, cur, fn) { return el('select', { onchange: e => fn(e.target.value) }, ...opts.map(([v, n]) => { const o = el('option', { value: v }, n); if (String(v) === String(cur)) o.selected = true; return o; })); }
function dsgNum(v, mn, mx, st, fn, w) { return el('input', { type: 'number', min: mn, max: mx, step: st || 1, value: v, style: 'width:' + (w || 58) + 'px', onchange: e => { fn(Math.max(mn, Math.min(mx, +e.target.value || 0))); dirty = true; } }); }
function shmupDesignTab(main) {
    const A = P.arcade; A.cfg = A.cfg || {}; if (!A.cfg.design) A.cfg.design = NRArcade.SHMUP_DESIGN(); const D = A.cfg.design, box = el('div', { class: 'pane' });
    box.append(el('h2', {}, '🚀 Shoot-em-up designer'), el('p', { class: 'hint' }, 'Design your enemies, then schedule them in waves. Times are in seconds from the start. The boss appears after the last wave if "Boss" is on in the Arcade tab. Up to 6 enemy types and 16 waves (the DS ROM holds exactly that).'),
        el('div', { class: 'row wrap' }, el('button', { class: 'alt', onclick: () => { A.cfg.design = NRArcade.SHMUP_DESIGN(); dirty = true; renderAll(); } }, 'Reset to the starter design')));
    const patterns = [[0, 'Straight down'], [1, 'Weave side to side'], [2, 'Chase the player'], [3, 'Hover then dive']], colors = [[0, 'Red'], [1, 'Yellow'], [2, 'Green'], [3, 'Purple'], [4, 'White']], sizes = [[0, 'Small'], [1, 'Medium'], [2, 'Large']], forms = [[0, 'Line'], [1, 'V shape'], [2, 'Column'], [3, 'Both sides']];
    const tt = el('table', { class: 'tbl' }, el('tr', {}, ...['Enemy', 'HP', 'Speed', 'Moves', 'Fires every (frames, 0 = never)', 'Score', 'Colour', 'Size', ''].map(h => el('th', {}, h))));
    D.types.forEach((t, i) => tt.append(el('tr', {}, el('td', {}, el('input', { value: t.name, style: 'width:90px', onchange: e => { t.name = e.target.value.slice(0, 12); dirty = true; renderAll(); } })), el('td', {}, dsgNum(t.hp, 1, 60, 1, v => t.hp = v)), el('td', {}, dsgNum(t.speed, .5, 6, .5, v => t.speed = v)),
        el('td', {}, dsgSel(patterns, t.pattern, v => { t.pattern = +v; dirty = true; })), el('td', {}, dsgNum(t.fire, 0, 600, 10, v => t.fire = v, 70)), el('td', {}, dsgNum(t.score, 10, 2500, 10, v => t.score = v, 70)),
        el('td', {}, dsgSel(colors, t.color, v => { t.color = +v; dirty = true; })), el('td', {}, dsgSel(sizes, t.size, v => { t.size = +v; dirty = true; })), el('td', {}, D.types.length > 1 ? el('button', { class: 'alt', onclick: () => { D.types.splice(i, 1); D.waves.forEach(w => { if (w.type >= D.types.length) w.type = 0; else if (w.type > i) w.type--; }); dirty = true; renderAll(); } }, 'Remove') : ''))));
    box.append(el('h3', {}, 'Enemy types'), tt, D.types.length < 6 ? el('button', { class: 'alt', onclick: () => { D.types.push({ name: 'Enemy ' + (D.types.length + 1), hp: 2, speed: 1, pattern: 0, fire: 120, score: 100, color: D.types.length % 5, size: 1 }); dirty = true; renderAll(); } }, '+ Add enemy type') : '');
    const wt = el('table', { class: 'tbl' }, el('tr', {}, ...['Appears at (seconds)', 'Enemy', 'How many', 'Formation', 'Centre x (0-255)', ''].map(h => el('th', {}, h))));
    D.waves.forEach((w, i) => wt.append(el('tr', {}, el('td', {}, dsgNum(Math.round(w.at / 6) / 10, 0, 1000, .5, v => w.at = Math.round(v * 60))), el('td', {}, dsgSel(D.types.map((t, k) => [k, t.name]), w.type, v => { w.type = +v; dirty = true; })), el('td', {}, dsgNum(w.n, 1, 12, 1, v => w.n = v)),
        el('td', {}, dsgSel(forms, w.form, v => { w.form = +v; dirty = true; })), el('td', {}, dsgNum(w.x, 0, 255, 8, v => w.x = v, 64)), el('td', {}, el('button', { class: 'alt', onclick: () => { D.waves.splice(i, 1); dirty = true; renderAll(); } }, 'Remove')))));
    box.append(el('h3', {}, 'Waves'), wt, el('div', { class: 'row wrap' }, D.waves.length < 16 ? el('button', { class: 'alt', onclick: () => { const last = D.waves.length ? D.waves[D.waves.length - 1].at : 0; D.waves.push({ at: last + 300, type: 0, n: 4, form: 0, x: 128 }); dirty = true; renderAll(); } }, '+ Add wave') : '', el('button', { class: 'alt', onclick: () => { D.waves.sort((a, b) => a.at - b.at); dirty = true; renderAll(); } }, 'Sort by time')));
    const bar = el('canvas', { width: 600, height: 40, style: 'width:100%;max-width:600px;border:1px solid #444;border-radius:4px' }), g = bar.getContext('2d'), end = Math.max(600, ...D.waves.map(w => w.at + 200)); g.fillStyle = '#0a0c1a'; g.fillRect(0, 0, 600, 40);
    D.waves.forEach(w => { const x = w.at / end * 590 + 4; g.fillStyle = ['#ff5a5a', '#ffd24a', '#5be08a', '#c07aff', '#fff'][(D.types[w.type] || {}).color | 0]; g.fillRect(x, 8, Math.max(4, w.n * 3), 24); }); g.fillStyle = '#888'; g.font = '10px sans-serif'; g.fillText('0s', 2, 38); g.fillText(Math.round(end / 60) + 's', 570, 38);
    box.append(bar);
    const bs = D.boss = D.boss || { hp: 40, pattern: 0, fire: 40 };
    box.append(el('h3', {}, 'Boss'), el('div', { class: 'row wrap' }, el('label', {}, 'HP ', dsgNum(bs.hp, 1, 255, 5, v => bs.hp = v)), el('label', {}, 'Moves ', dsgSel([[0, 'Slow sweep'], [1, 'Fast sweep'], [2, 'Chases the player']], bs.pattern, v => { bs.pattern = +v; dirty = true; })), el('label', {}, 'Fires every (frames) ', dsgNum(bs.fire, 10, 255, 5, v => bs.fire = v)),
        el('label', {}, el('input', { type: 'checkbox', checked: !!A.cfg.boss, onchange: e => { A.cfg.boss = e.target.checked ? 1 : 0; dirty = true; } }), ' Boss at the end')));
    main.append(box);
}
const BKD = { v: 1 };
function breakoutDesignTab(main) {
    const A = P.arcade; A.cfg = A.cfg || {}; if (!A.cfg.design) A.cfg.design = NRArcade.BREAKOUT_DESIGN(); const D = A.cfg.design, box = el('div', { class: 'pane' }), COL = ['#161a2e', '#7ae87a', '#4ae8ff', '#f5c542', '#ff5a5a'];
    box.append(el('h2', {}, '🧱 Brick layout designer'), el('p', { class: 'hint' }, 'Click a cell to cycle it: empty, then bricks that take 1, 2, 3 or 4 hits. Up to 8 rows by 16 columns.'));
    const rows = D.grid.length, cols = Math.max(2, ...D.grid.map(r => r.length));
    box.append(el('div', { class: 'row wrap' }, el('label', {}, 'Rows ', dsgNum(rows, 1, 8, 1, v => { while (D.grid.length < v) D.grid.push(new Array(cols).fill(1)); D.grid.length = v; renderAll(); }, 50)), el('label', {}, 'Columns ', dsgNum(cols, 2, 16, 1, v => { D.grid.forEach(r => { while (r.length < v) r.push(1); r.length = v; }); renderAll(); }, 50)),
        el('button', { class: 'alt', onclick: () => { A.cfg.design = NRArcade.BREAKOUT_DESIGN(); dirty = true; renderAll(); } }, 'Reset to the starter layout'), el('button', { class: 'alt', onclick: () => { D.grid.forEach(r => r.fill(1)); dirty = true; renderAll(); } }, 'Fill'), el('button', { class: 'alt', onclick: () => { D.grid.forEach(r => r.fill(0)); dirty = true; renderAll(); } }, 'Clear')));
    const gr = el('div', { style: 'display:grid;grid-template-columns:repeat(' + cols + ',34px);gap:2px;margin:8px 0' });
    D.grid.forEach((row, y) => { for (let x = 0; x < cols; x++) { const v = row[x] | 0; gr.append(el('button', { 'data-cell': y + ',' + x, style: 'width:34px;height:20px;border:1px solid #444;border-radius:3px;cursor:pointer;color:#000;font-size:10px;background:' + COL[v], onclick: () => { row[x] = ((row[x] | 0) + 1) % 5; dirty = true; renderAll(); } }, v ? String(v) : '')); } });
    box.append(gr, el('div', { class: 'hint' }, D.grid.reduce((n, r) => n + r.filter(v => v > 0).length, 0) + ' bricks'));
    main.append(box);
}
function raceDesignTab(main) {
    const A = P.arcade; A.cfg = A.cfg || {}; if (!A.cfg.design || !A.cfg.design.track) A.cfg.design = NRArcade.RACE_DESIGN(); const D = A.cfg.design, box = el('div', { class: 'pane' });
    box.append(el('h2', {}, '🏁 Track designer'), el('p', { class: 'hint' }, 'Build the track as sections: how long each is and how hard it bends (negative = left, positive = right). Up to 16 sections. The lap counter, time limit and rival cars are in the Arcade tab.'),
        el('div', { class: 'row wrap' }, el('button', { class: 'alt', onclick: () => { const g = D.grass; A.cfg.design = NRArcade.RACE_DESIGN(); A.cfg.design.grass = g; dirty = true; renderAll(); } }, 'Reset to the starter track'), el('button', { class: 'alt', onclick: () => { D.track = [{ len: 6, curve: 0 }]; dirty = true; renderAll(); } }, 'Straight road'),
            el('label', {}, 'Grass ', el('input', { type: 'color', value: '#' + (D.grass || [42, 138, 42]).map(v => v.toString(16).padStart(2, '0')).join(''), onchange: e => { const v = e.target.value; D.grass = [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)); dirty = true; renderAll(); } }))));
    const tt = el('table', { class: 'tbl' }, el('tr', {}, ...['#', 'Length', 'Bend (-6 left … 6 right)', ''].map(h => el('th', {}, h))));
    D.track.forEach((q, i) => tt.append(el('tr', {}, el('td', {}, String(i + 1)), el('td', {}, dsgNum(q.len, 1, 20, 1, v => q.len = v)), el('td', {}, el('input', { type: 'range', min: -6, max: 6, value: q.curve, onchange: e => { q.curve = +e.target.value; dirty = true; renderAll(); } }), ' ' + q.curve),
        el('td', {}, el('button', { class: 'alt', onclick: () => { D.track.splice(i + 1, 0, { len: q.len, curve: q.curve }); dirty = true; renderAll(); } }, 'Duplicate'), D.track.length > 1 ? el('button', { class: 'alt', onclick: () => { D.track.splice(i, 1); dirty = true; renderAll(); } }, 'Remove') : ''))));
    box.append(tt, D.track.length < 16 ? el('button', { class: 'alt', onclick: () => { D.track.push({ len: 3, curve: 0 }); dirty = true; renderAll(); } }, '+ Add section') : '');
    const cv = el('canvas', { width: 400, height: 400, style: 'width:100%;max-width:400px;border:1px solid #444;border-radius:6px;background:#1b3a1b' }), g = cv.getContext('2d'); let x = 200, y = 360, a = -Math.PI / 2; g.strokeStyle = '#999'; g.lineWidth = 10; g.beginPath(); g.moveTo(x, y);
    for (const q of D.track) for (let k = 0; k < q.len * 4; k++) { a += q.curve * .006; x += Math.cos(a) * 3; y += Math.sin(a) * 3; g.lineTo(x, y); } g.stroke(); box.append(el('div', { class: 'hint' }, 'Top-down sketch of the road (a straight-ahead view in the game, not a loop).'), cv);
    main.append(box);
}
function brawlerDesignTab(main) {
    const A = P.arcade; A.cfg = A.cfg || {}; if (!A.cfg.design || !A.cfg.design.types) A.cfg.design = NRArcade.BRAWLER_DESIGN(); const D = A.cfg.design, box = el('div', { class: 'pane' });
    box.append(el('h2', {}, '👊 Stage designer (beat-em-up)'), el('p', { class: 'hint' }, 'Design your fighters and the order they come at you. Waves play one after another; the next starts when the last is beaten. Up to 4 enemy types and 16 waves (8 fighters per wave).'),
        el('div', { class: 'row wrap' }, el('button', { class: 'alt', onclick: () => { A.cfg.design = NRArcade.BRAWLER_DESIGN(); dirty = true; renderAll(); } }, 'Reset to the starter stage')));
    const colors = [[0, 'Default'], [1, 'Yellow'], [2, 'Green'], [3, 'Purple'], [4, 'White']];
    const tt = el('table', { class: 'tbl' }, el('tr', {}, ...['Fighter', 'HP', 'Speed', 'Damage', 'Score', 'Colour', ''].map(h => el('th', {}, h))));
    D.types.forEach((t, i) => tt.append(el('tr', {}, el('td', {}, el('input', { value: t.name, style: 'width:90px', onchange: e => { t.name = e.target.value.slice(0, 12); dirty = true; renderAll(); } })), el('td', {}, dsgNum(t.hp, 1, 60, 1, v => t.hp = v)), el('td', {}, dsgNum(t.speed, .5, 2.5, .1, v => t.speed = v)), el('td', {}, dsgNum(t.dmg, 1, 9, 1, v => t.dmg = v)), el('td', {}, dsgNum(t.score, 10, 2500, 10, v => t.score = v, 70)), el('td', {}, dsgSel(colors, t.color, v => { t.color = +v; dirty = true; })),
        el('td', {}, D.types.length > 1 ? el('button', { class: 'alt', onclick: () => { D.types.splice(i, 1); D.waves.forEach(w => { if (w.type >= D.types.length) w.type = 0; else if (w.type > i) w.type--; }); dirty = true; renderAll(); } }, 'Remove') : ''))));
    box.append(el('h3', {}, 'Fighters'), tt, D.types.length < 4 ? el('button', { class: 'alt', onclick: () => { D.types.push({ name: 'Fighter ' + (D.types.length + 1), hp: 3, speed: 1, dmg: 1, score: 50, color: D.types.length }); dirty = true; renderAll(); } }, '+ Add fighter') : '');
    const wt = el('table', { class: 'tbl' }, el('tr', {}, ...['Wave', 'Fighter', 'How many', 'Comes from', ''].map(h => el('th', {}, h))));
    D.waves.forEach((w, i) => wt.append(el('tr', {}, el('td', {}, String(i + 1)), el('td', {}, dsgSel(D.types.map((t, k) => [k, t.name]), w.type, v => { w.type = +v; dirty = true; })), el('td', {}, dsgNum(w.n, 1, 8, 1, v => w.n = v)), el('td', {}, dsgSel([[0, 'Right'], [1, 'Left'], [2, 'Both sides']], w.side, v => { w.side = +v; dirty = true; })), el('td', {}, el('button', { class: 'alt', onclick: () => { D.waves.splice(i, 1); dirty = true; renderAll(); } }, 'Remove')))));
    const bs = D.boss = D.boss || { hp: 30, dmg: 3 };
    box.append(el('h3', {}, 'Waves'), wt, D.waves.length < 16 ? el('button', { class: 'alt', onclick: () => { D.waves.push({ type: 0, n: 3, side: 2 }); dirty = true; renderAll(); } }, '+ Add wave') : '',
        el('h3', {}, 'Boss'), el('div', { class: 'row wrap' }, el('label', {}, 'HP ', dsgNum(bs.hp, 1, 250, 5, v => bs.hp = v)), el('label', {}, 'Damage ', dsgNum(bs.dmg, 1, 9, 1, v => bs.dmg = v)), el('label', {}, el('input', { type: 'checkbox', checked: !!A.cfg.boss, onchange: e => { A.cfg.boss = e.target.checked ? 1 : 0; dirty = true; } }), ' Boss at the end')));
    main.append(box);
}
function dsgColor(v, fn) { return el('input', { type: 'color', value: v, onchange: e => { fn(e.target.value); dirty = true; renderAll(); } }); }
function dsgRange(v, mn, mx, st, fn) { return el('span', {}, el('input', { type: 'range', min: mn, max: mx, step: st, value: v, onchange: e => { fn(+e.target.value); dirty = true; renderAll(); } }), ' ' + (+v).toFixed(2)); }
function basketballDesignTab(main) {
    const A = P.arcade; A.cfg = A.cfg || {}; if (!A.cfg.design || !A.cfg.design.home) A.cfg.design = NRArcade.BASKETBALL_DESIGN(); const D = A.cfg.design, box = el('div', { class: 'pane' });
    box.append(el('h2', {}, '🏀 Team builder (street basketball)'), el('p', { class: 'hint' }, 'Two teams of two. Set each player: Speed, Shooting, Dunk (0 = cannot dunk) and Defense. The home team is yours. The court colour is the floor. Plays on PC, Xbox and the desktop window; the DS has no street-basketball ROM engine yet.'),
        el('div', { class: 'row wrap' }, el('button', { class: 'alt', onclick: () => { A.cfg.design = NRArcade.BASKETBALL_DESIGN(); dirty = true; renderAll(); } }, 'Reset to the starter teams'), el('label', {}, 'Court ', dsgColor(D.court || '#c8905a', v => D.court = v))));
    for (const [key, label] of [['home', 'Your team'], ['away', 'Rivals']]) { const T = D[key];
        box.append(el('h3', {}, label), el('div', { class: 'row wrap' }, el('label', {}, 'Team name ', el('input', { value: T.name, style: 'width:110px', onchange: e => { T.name = e.target.value.slice(0, 14); dirty = true; } })), el('label', {}, 'Colour ', dsgColor(T.color, v => T.color = v))));
        const tb = el('table', { class: 'tbl' }, el('tr', {}, ...['Player', 'Speed', 'Shooting', 'Dunk', 'Defense'].map(h => el('th', {}, h))));
        T.players.forEach(p => tb.append(el('tr', {}, el('td', {}, el('input', { value: p.name, style: 'width:90px', onchange: e => { p.name = e.target.value.slice(0, 10); dirty = true; } })), el('td', {}, dsgRange(p.speed, .6, 1.5, .05, v => p.speed = v)), el('td', {}, dsgRange(p.shooting, .6, 1.4, .05, v => p.shooting = v)), el('td', {}, dsgRange(p.dunk, 0, 1.5, .05, v => p.dunk = v)), el('td', {}, dsgRange(p.defense, .5, 1.5, .05, v => p.defense = v)))));
        box.append(tb); }
    main.append(box);
}
function baseballDesignTab(main) {
    const A = P.arcade; A.cfg = A.cfg || {}; if (!A.cfg.design || !A.cfg.design.pitcher) A.cfg.design = NRArcade.BASEBALL_DESIGN(); const D = A.cfg.design, box = el('div', { class: 'pane' });
    box.append(el('h2', {}, '⚾ Pitcher and ballpark designer'), el('p', { class: 'hint' }, 'Choose which pitches the pitcher throws, how often they are strikes and how fast, then colour the ballpark. Plays on PC, Xbox and the desktop window; the DS has no baseball engine yet.'),
        el('div', { class: 'row wrap' }, el('button', { class: 'alt', onclick: () => { A.cfg.design = NRArcade.BASEBALL_DESIGN(); dirty = true; renderAll(); } }, 'Reset'), el('label', {}, 'Your team ', el('input', { value: D.you, style: 'width:100px', onchange: e => { D.you = e.target.value.slice(0, 12); dirty = true; } })), el('label', {}, 'Rivals ', el('input', { value: D.cpu, style: 'width:100px', onchange: e => { D.cpu = e.target.value.slice(0, 12); dirty = true; } }))));
    const pt = D.pitcher; box.append(el('h3', {}, 'Pitcher'), el('div', { class: 'row wrap' }, ...[['fastball', 'Fastball'], ['curve', 'Curveball'], ['change', 'Changeup'], ['slider', 'Slider']].map(([k, n]) => el('label', {}, el('input', { type: 'checkbox', checked: !!pt.pitches[k], onchange: e => { pt.pitches[k] = e.target.checked; dirty = true; } }), ' ' + n))),
        el('div', { class: 'row wrap' }, el('label', {}, 'Strike rate ', dsgRange(pt.strikeRate, .3, .9, .02, v => pt.strikeRate = v)), el('label', {}, 'Speed ', dsgRange(pt.speed, .7, 1.4, .05, v => pt.speed = v))),
        el('h3', {}, 'Ballpark'), el('div', { class: 'row wrap' }, el('label', {}, 'Grass ', dsgColor(D.field.grass, v => D.field.grass = v)), el('label', {}, 'Sky ', dsgColor(D.field.sky, v => D.field.sky = v)), el('label', {}, 'Infield dirt ', dsgColor(D.field.dirt, v => D.field.dirt = v))));
    main.append(box);
}
const FD = { tool: '#' };
function fpsDesignTab(main) {
    const A = P.arcade; A.cfg = A.cfg || {}; if (!A.cfg.design || !A.cfg.design.map) A.cfg.design = NRArcade.FPS_DESIGN(); const D = A.cfg.design, box = el('div', { class: 'pane' }), N = Math.max(D.map.length, ...D.map.map(r => r.length)), C = 22;
    D.map = D.map.map(r => r.padEnd(N, '#')); while (D.map.length < N) D.map.push('#'.repeat(N));
    box.append(el('h2', {}, '🔫 First-person level designer'), el('p', { class: 'hint' }, 'Paint the level: walls, floor, enemies, health and ammo pickups, where you start, and the exit (PC; the DS level ends when every enemy is down). The edge is always wall. Up to 24 x 24, 16 enemies and 12 pickups on the DS.'));
    const tools = [['#', 'Wall'], ['.', 'Floor'], ['E', 'Enemy'], ['H', 'Health'], ['A', 'Ammo'], ['S', 'Start'], ['X', 'Exit']];
    box.append(el('div', { class: 'row wrap' }, ...tools.map(([k, n]) => el('button', { class: FD.tool === k ? 'go' : 'alt', onclick: () => { FD.tool = k; renderAll(); } }, n)), el('label', {}, 'Size ', dsgNum(N, 8, 24, 1, v => { const m = []; for (let y = 0; y < v; y++) m.push((D.map[y] || '').padEnd(v, '#').slice(0, v)); D.map = m; renderAll(); }, 50)),
        el('button', { class: 'alt', onclick: () => { A.cfg.design = NRArcade.FPS_DESIGN(); dirty = true; renderAll(); } }, 'Reset to the starter level'), el('button', { class: 'alt', onclick: () => { D.map = D.map.map((r, y) => r.split('').map((c, x) => x === 0 || y === 0 || x === N - 1 || y === N - 1 ? '#' : (c === 'S' ? 'S' : '.')).join('')); dirty = true; renderAll(); } }, 'Open room')));
    const cv = el('canvas', { width: N * C, height: N * C, style: 'border:1px solid #444;border-radius:4px;cursor:crosshair;max-width:100%' }), g = cv.getContext('2d'), COL = { '#': '#4a4f66', '.': '#14161f', E: '#ff4b4b', H: '#ff4b6b', A: '#ffd24a', S: '#4ae8ff', X: '#4ae87a' };
    D.map.forEach((r, y) => r.split('').forEach((c, x) => { g.fillStyle = COL[c] || COL['.']; g.fillRect(x * C, y * C, C - 1, C - 1); if ('EHASX'.includes(c)) { g.fillStyle = '#000'; g.font = 'bold 12px sans-serif'; g.fillText(c, x * C + 6, y * C + 15); } }));
    const count = ch => D.map.join('').split(ch).length - 1;
    cv.onclick = e => { const r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * N), y = Math.floor((e.clientY - r.top) / r.height * N); if (x < 0 || y < 0 || x >= N || y >= N) return; if (x === 0 || y === 0 || x === N - 1 || y === N - 1) return;
        let t = FD.tool; if (t === 'S' || t === 'X') D.map = D.map.map(r => r.replace(t, '.')); const row = D.map[y].split(''); row[x] = t; D.map[y] = row.join(''); dirty = true; renderAll(); };
    box.append(cv, el('div', { class: 'hint' }, count('E') + ' enemies · ' + count('H') + ' health · ' + count('A') + ' ammo' + (count('S') ? '' : ' · no start set') + (count('E') > 16 ? ' · the DS holds 16 enemies' : '')));
    main.append(box);
}
function railDesignTab(main) {
    const A = P.arcade; A.cfg = A.cfg || {}; if (!A.cfg.design || !A.cfg.design.waves) A.cfg.design = NRArcade.RAIL_DESIGN(); const D = A.cfg.design, box = el('div', { class: 'pane' });
    box.append(el('h2', {}, '🎯 Rail shooter designer'), el('p', { class: 'hint' }, 'Script each wave: how many gunmen, how many civilians walk through (shooting one costs a life), how tough and fast they are, and how often they fire. Then the boss and the look of the room. Plays on PC, Xbox and the desktop window; the DS has no rail-shooter engine yet.'),
        el('div', { class: 'row wrap' }, el('button', { class: 'alt', onclick: () => { A.cfg.design = NRArcade.RAIL_DESIGN(); dirty = true; renderAll(); } }, 'Reset to the starter script')));
    const tb = el('table', { class: 'tbl' }, el('tr', {}, ...['Wave', 'Gunmen', 'Civilians', 'Gunman HP', 'Speed', 'Fires every (frames)', ''].map(h => el('th', {}, h))));
    D.waves.forEach((w, i) => tb.append(el('tr', {}, el('td', {}, String(i + 1)), el('td', {}, dsgNum(w.grunts, 1, 14, 1, v => w.grunts = v)), el('td', {}, dsgNum(w.civilians, 0, 8, 1, v => w.civilians = v)), el('td', {}, dsgNum(w.hp, 1, 6, 1, v => w.hp = v)), el('td', {}, dsgNum(w.speed, .6, 1.8, .1, v => w.speed = v)), el('td', {}, dsgNum(w.fire, 40, 200, 10, v => w.fire = v, 70)),
        el('td', {}, D.waves.length > 1 ? el('button', { class: 'alt', onclick: () => { D.waves.splice(i, 1); dirty = true; renderAll(); } }, 'Remove') : ''))));
    const bs = D.boss = D.boss || { hp: 14, fire: 80 }, th = D.theme = D.theme || { wall: '#2b3b52', floor: '#1a2230', lines: '#3d5272' };
    box.append(el('h3', {}, 'Waves'), tb, D.waves.length < 12 ? el('button', { class: 'alt', onclick: () => { const l = D.waves[D.waves.length - 1]; D.waves.push(Object.assign({}, l)); dirty = true; renderAll(); } }, '+ Add wave (copy of the last)') : '',
        el('h3', {}, 'Boss'), el('div', { class: 'row wrap' }, el('label', {}, 'HP ', dsgNum(bs.hp, 1, 99, 1, v => bs.hp = v)), el('label', {}, 'Fires every (frames) ', dsgNum(bs.fire, 30, 200, 10, v => bs.fire = v))),
        el('h3', {}, 'Room'), el('div', { class: 'row wrap' }, el('label', {}, 'Wall ', dsgColor(th.wall, v => th.wall = v)), el('label', {}, 'Floor ', dsgColor(th.floor, v => th.floor = v)), el('label', {}, 'Grid lines ', dsgColor(th.lines, v => th.lines = v))));
    main.append(box);
}

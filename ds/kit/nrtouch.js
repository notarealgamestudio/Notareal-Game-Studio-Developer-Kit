/* NOTAREAL Dev Kit: DS bottom-screen touch layouts.
 * A layout = touch buttons (each runs an action) + live widgets (score, lives, mini-map...) + decoration.
 * renderTouch() paints it in a visual theme to a 256x192 picture; the engine gets the picture + the button
 * rectangles and lights a button up while it is pressed. Ideas from how the DS games in the catalog use the
 * lower screen: Pokemon Platinum's big command buttons and touch menus, the stats panels of action games,
 * DS-10's touch pads. All drawn from scratch. */
(function (root) {
'use strict';
const T = {};
const FONT = '000000000000000010101010100010002828000000000000287c28287c280000103c50381478100064680810202c4c0030485020544834001010200000000000081020202010080020100808081020000054387c385400000010107c1010000000000000301020000000007c0000000000000000003030000408081020204000384c54545464380010301010101038003844041820407c007804043804047800081828487c0808007c4078040444380018204078444438007c0408102020200038444438444438003844443c0408300000303000303000000000000000000000081020402010080000007c007c0000002010080408102000384404081000100000000000000000003844447c444444007844447844447800384440404044380078444444444478007c40407840407c007c404078404040003844405c44443c004444447c4444440038101010101038001c0808080848300044485060504844004040404040407c00446c5454444444004464544c4444440038444444444438007844447840404000384444445448340078444478504844003c404038040478007c10101010101000444444444444380044444444442810004444445454542800444428102844440044442810101010007c04081020407c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003844447c444444007844447844447800384440404044380078444444444478007c40407840407c007c404078404040003844405c44443c004444447c4444440038101010101038001c0808080848300044485060504844004040404040407c00446c5454444444004464544c4444440038444444444438007844447840404000384444445448340078444478504844003c404038040478007c10101010101000444444444444380044444444442810004444445454542800444428102844440044442810101010007c04081020407c0000000000000000000000000000000000000000000000000000000000000000000000000000000000';
const glyph = (c, y) => parseInt(FONT.substr(((c - 32) * 8 + y) * 2, 2), 16);
T.ACTIONS = { none: 0, left: 1, right: 2, up: 3, down: 4, jump: 5, run: 6, pause: 7, music: 8, restart: 9, map: 10, action: 11, runtoggle: 12, select: 13 };
T.ACTION_INFO = {
    left: ['Move left', 'Walks left while you hold it.'], right: ['Move right', 'Walks right while you hold it.'], up: ['Up', 'Same as pressing Up on the D-pad.'], down: ['Down', 'Same as pressing Down on the D-pad.'],
    jump: ['Jump', 'Same as B/A: tap to hop, hold for a high jump.'], run: ['Run (hold)', 'Same as holding Y.'], runtoggle: ['Auto-run on/off', 'Tap once to always run, again to walk. Great for touch-only play.'],
    pause: ['Pause', 'Same as START.'], music: ['Music on/off', 'Mutes or restores the soundtrack.'], restart: ['Retry from checkpoint', 'Puts the hero back at the last checkpoint (no life lost).'],
    map: ['Map', 'Shows or hides the level map widget.'], action: ['Action', 'Same as X (used by future engines: attack, talk, use item).'], select: ['Select', 'Same as SELECT.']
};
T.WIDGETS = { score: 0, coins: 1, lives: 2, level: 3, title: 4, hearts: 5, minimap: 6, timer: 7, levelname: 8 };
T.THEMES = {
    blocky: { label: 'Blocky / generic', bg: [[60, 60, 70], [60, 60, 70]], panel: [90, 90, 105], edge: [0, 0, 0], radius: 0, border: 2, shadow: 0, gloss: 0, text: [255, 255, 255], outline: [0, 0, 0],
        colors: [[200, 40, 40], [40, 90, 200], [40, 160, 60], [220, 180, 30], [120, 120, 130]] },
    cute: { label: 'Cartoon / cute', bg: [[255, 214, 232], [200, 230, 255]], panel: [255, 255, 255], edge: [255, 255, 255], radius: 14, border: 3, shadow: 3, gloss: 0.35, dots: true, text: [255, 255, 255], outline: [110, 60, 120],
        colors: [[255, 120, 160], [120, 170, 255], [120, 210, 150], [255, 200, 90], [190, 160, 230]] },
    pocket: { label: 'Pocket monster style', bg: [[236, 236, 228], [200, 205, 200]], panel: [250, 250, 245], edge: [60, 60, 70], radius: 10, border: 3, shadow: 2, gloss: 0.25, stripes: true, text: [255, 255, 255], outline: [40, 40, 50],
        colors: [[220, 60, 50], [240, 190, 40], [70, 170, 90], [60, 120, 220], [150, 150, 160]] },
    sleek: { label: 'Cutting edge / realistic', bg: [[8, 12, 24], [28, 38, 64]], panel: [20, 28, 48], edge: [120, 220, 255], radius: 6, border: 1, shadow: 0, gloss: 0.5, glow: true, grid: true, text: [230, 245, 255], outline: [0, 10, 30],
        colors: [[0, 170, 230], [220, 40, 140], [40, 200, 150], [240, 160, 30], [90, 100, 130]] },
};
/* ---------------------------------------------------------------- drawing on an RGBA buffer */
function canvas() { return { w: 256, h: 192, data: new Uint8ClampedArray(256 * 192 * 4) }; }
function px(c, x, y, rgb, a = 1) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= c.w || y >= c.h) return; const i = (y * c.w + x) * 4; c.data[i] = c.data[i] * (1 - a) + rgb[0] * a; c.data[i + 1] = c.data[i + 1] * (1 - a) + rgb[1] * a; c.data[i + 2] = c.data[i + 2] * (1 - a) + rgb[2] * a; c.data[i + 3] = 255; }
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function inRound(x, y, w, h, r) { if (r <= 0) return true; const cx = x < r ? r : x > w - 1 - r ? w - 1 - r : x, cy = y < r ? r : y > h - 1 - r ? h - 1 - r : y; return (x - cx) ** 2 + (y - cy) ** 2 <= r * r; }
function rrect(c, x0, y0, w, h, r, fill) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inRound(x, y, w, h, r)) px(c, x0 + x, y0 + y, typeof fill === 'function' ? fill(x, y) : fill); }
function poly(c, pts, rgb) {
    const ys = pts.map(p => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) { const xs = []; for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= y + 0.5) !== (by <= y + 0.5)) xs.push(ax + (y + 0.5 - ay) / (by - ay) * (bx - ax)); } xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) px(c, x, y, rgb); }
}
function disc(c, cx, cy, r, rgb) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) px(c, cx + x, cy + y, rgb); }
function text(c, x, y, s, sc, fill, outline) {
    s = String(s).toUpperCase();
    const draw = (ox, oy, col) => { for (let k = 0; k < s.length; k++) { const ch = s.charCodeAt(k); if (ch < 32 || ch > 127) continue; for (let j = 0; j < 8; j++) { const row = glyph(ch, j); for (let i = 0; i < 8; i++) if (row & (128 >> i)) for (let b = 0; b < sc; b++) for (let a = 0; a < sc; a++) px(c, x + ox + k * 6 * sc + i * sc + a, y + oy + j * sc + b, col); } } };
    if (outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) draw(dx, dy, outline);
    draw(0, 0, fill);
}
const textW = (s, sc) => String(s).length * 6 * sc - sc;
/* icons in a 16x16 box */
const ICONS = {
    left: [[[12, 2], [4, 8], [12, 14]]], right: [[[4, 2], [12, 8], [4, 14]]], up: [[[2, 12], [8, 4], [14, 12]]], down: [[[2, 4], [8, 12], [14, 4]]],
    jump: [[[8, 1], [15, 8], [11, 8], [11, 13], [5, 13], [5, 8], [1, 8]], [[3, 14], [13, 14], [13, 16], [3, 16]]],
    run: [[[2, 3], [7, 8], [2, 13], [4, 13], [9, 8], [4, 3]], [[8, 3], [13, 8], [8, 13], [10, 13], [15, 8], [10, 3]]],
    runtoggle: [[[2, 3], [7, 8], [2, 13], [4, 13], [9, 8], [4, 3]], [[8, 3], [13, 8], [8, 13], [10, 13], [15, 8], [10, 3]]],
    pause: [[[3, 2], [7, 2], [7, 14], [3, 14]], [[9, 2], [13, 2], [13, 14], [9, 14]]],
    music: [[[9, 1], [11, 1], [11, 11], [9, 11]], [[11, 1], [15, 3], [15, 6], [11, 4]], 'disc:7:12:3'],
    map: [[[1, 3], [5, 1], [10, 3], [15, 1], [15, 13], [10, 15], [5, 13], [1, 15]]],
    restart: ['ring:8:8:6', [[11, 0], [16, 4], [10, 6]]], action: [[[8, 0], [10, 6], [16, 6], [11, 10], [13, 16], [8, 12], [3, 16], [5, 10], [0, 6], [6, 6]]], select: ['disc:4:8:2', 'disc:8:8:2', 'disc:12:8:2'],
};
function icon(c, name, x, y, size, rgb) {
    const s = size / 16;
    for (const part of ICONS[name] || []) {
        if (typeof part === 'string') { const [k, a, b, r] = part.split(':'); if (k === 'disc') disc(c, x + a * s, y + b * s, Math.max(1, r * s), rgb); else for (let t = 0.3; t < 5.8; t += 0.05) disc(c, x + (+a + r * Math.cos(t)) * s, y + (+b + r * Math.sin(t)) * s, Math.max(1, 1.2 * s), rgb); continue; }
        poly(c, part.map(([a, b]) => [x + a * s, y + b * s]), rgb);
    }
}
/* ---------------------------------------------------------------- layouts */
const B = (x, y, w, h, action, label, color, extra) => Object.assign({ type: 'button', x, y, w, h, action, label, color }, extra || {});
const W = (kind, x, y, w, h, label, scale) => ({ type: 'widget', kind, x, y, w, h, label, scale: scale || 1 });
const PN = (x, y, w, h, label) => ({ type: 'panel', x, y, w, h, label });
T.LAYOUTS = {
    stats: { label: 'Stats panel', for: 'Any game. The player uses the buttons; the touch screen shows the numbers.', how: ['D-pad moves, B/A jumps, Y runs.', 'Tap the pause button (or press START) to pause.', 'Good for: platformers, racing, sports.'],
        items: [PN(8, 8, 240, 30), W('title', 16, 19, 220, 10, null, 1), PN(8, 46, 116, 92), PN(132, 46, 116, 92), W('score', 18, 70, 100, 10, 'SCORE', 2), W('coins', 18, 112, 100, 10, 'COINS', 2), W('lives', 142, 70, 100, 10, 'LIVES', 2), W('timer', 142, 112, 100, 10, 'TIME', 2), B(8, 146, 116, 38, 'pause', 'PAUSE', 4), B(132, 146, 116, 38, 'music', 'MUSIC', 1)] },
    command: { label: 'Command menu (pocket monster style)', for: 'RPG-style big touch buttons, like the battle menu in the Pokemon DS games: one giant main command and smaller ones under it.', how: ['Tap the big button for the main move (jump here; attack or talk in RPG engines).', 'The three buttons below are shortcuts: auto-run, map, pause.', 'Works one-handed: hold the DS in your left hand and tap with your thumb.', 'Good for: RPGs, adventure, monster collecting, kids.'],
        items: [W('levelname', 12, 8, 160, 10, null, 1), W('hearts', 180, 6, 70, 10, null, 1), B(16, 24, 224, 92, 'jump', 'JUMP', 0, { big: true }), B(4, 124, 80, 64, 'runtoggle', 'RUN', 1), B(88, 124, 80, 64, 'map', 'MAP', 2), B(172, 124, 80, 64, 'pause', 'PAUSE', 3)] },
    controller: { label: 'Touch controller', for: 'Play with the stylus or a thumb only: left/right pads and a big jump button.', how: ['Hold the arrows to walk. Hold the big round button to jump higher.', 'RUN switches auto-run on and off.', 'Good for: players who prefer touch, accessibility, one-thumb play.'],
        items: [W('score', 12, 22, 100, 10, 'SCORE', 1), W('lives', 180, 22, 60, 10, 'LIVES', 1), B(8, 60, 60, 80, 'left', '', 4, { icon: 'left' }), B(72, 60, 60, 80, 'right', '', 4, { icon: 'right' }), B(150, 50, 98, 98, 'jump', 'JUMP', 0, { round: true }), B(8, 152, 80, 34, 'runtoggle', 'RUN', 1), B(96, 152, 64, 34, 'restart', 'RETRY', 2), B(168, 152, 80, 34, 'pause', 'PAUSE', 3)] },
    lefty: { label: 'Touch controller (left-handed)', for: 'The touch controller mirrored: jump on the left, arrows on the right.', how: ['Same as the touch controller, mirrored for left-handed players.'],
        items: [W('score', 12, 22, 100, 10, 'SCORE', 1), W('lives', 180, 22, 60, 10, 'LIVES', 1), B(8, 50, 98, 98, 'jump', 'JUMP', 0, { round: true }), B(124, 60, 60, 80, 'left', '', 4, { icon: 'left' }), B(188, 60, 60, 80, 'right', '', 4, { icon: 'right' }), B(8, 152, 80, 34, 'pause', 'PAUSE', 3), B(96, 152, 64, 34, 'restart', 'RETRY', 2), B(168, 152, 80, 34, 'runtoggle', 'RUN', 1)] },
    mapscreen: { label: 'Map screen', for: 'A big live map of the level with the hero blinking on it, like the map screens on many DS adventures.', how: ['The map updates as you move. Tap MAP to hide it.', 'RETRY puts you back at the last checkpoint.', 'Good for: open levels, exploration, adventure.'],
        items: [PN(6, 6, 244, 120), W('minimap', 12, 18, 232, 100, null, 1), W('levelname', 12, 8, 200, 8, null, 1), W('score', 12, 134, 110, 10, 'SCORE', 1), W('lives', 140, 134, 100, 10, 'LIVES', 1), B(6, 150, 78, 36, 'map', 'MAP', 2), B(89, 150, 78, 36, 'restart', 'RETRY', 1), B(172, 150, 78, 36, 'pause', 'PAUSE', 0)] },
    quickbar: { label: 'Quick bar', for: 'Stats on top and a row of four shortcut buttons along the bottom, like an item belt.', how: ['Buttons do the gameplay; the touch row gives quick shortcuts.', 'Good for: action games, shooters, sims.'],
        items: [PN(8, 8, 240, 112), W('title', 18, 16, 220, 10, null, 1), W('score', 18, 40, 100, 10, 'SCORE', 2), W('coins', 18, 82, 100, 10, 'COINS', 2), W('lives', 140, 40, 100, 10, 'LIVES', 2), W('level', 140, 82, 100, 10, 'LEVEL', 2), B(4, 128, 60, 60, 'restart', 'RETRY', 4, { icon: 'restart' }), B(68, 128, 60, 60, 'map', 'MAP', 2, { icon: 'map' }), B(132, 128, 60, 60, 'music', 'MUSIC', 1, { icon: 'music' }), B(196, 128, 56, 60, 'pause', 'PAUSE', 0, { icon: 'pause' })] },
    minimal: { label: 'Minimal', for: 'Clean art screen with one pause button. Lets your game art breathe.', how: ['All play is on the buttons. Tap anywhere on the pause bar to pause.'],
        items: [W('title', 16, 80, 224, 10, null, 2), B(0, 160, 255, 32, 'pause', 'PAUSE', 4)] },
};
T.layout = id => { const L = T.LAYOUTS[id]; if (L.mirrorOf) { const S = T.LAYOUTS[L.mirrorOf]; return Object.assign({}, L, { items: S.items.map(it => it.type === 'button' && it.y >= 40 && it.y < 150 ? Object.assign({}, it, { x: 256 - it.x - it.w }) : it) }); } return L; };
/* ---------------------------------------------------------------- render */
T.render = (items, themeId, opts = {}) => {
    const th = T.THEMES[themeId] || T.THEMES.cute, c = canvas();
    for (let y = 0; y < 192; y++) { const col = mix(th.bg[0], th.bg[1], y / 191); for (let x = 0; x < 256; x++) { let k = col; if (th.dots && ((x + (y >> 4 & 1) * 8) % 16 === 0) && y % 16 === 0) k = mix(col, [255, 255, 255], 0.6); if (th.grid && (x % 16 === 0 || y % 16 === 0)) k = mix(col, th.edge, 0.12); if (th.stripes && y % 8 < 2) k = mix(col, [255, 255, 255], 0.35); px(c, x, y, k); } }
    if (opts.background) { const b = opts.background; for (let y = 0; y < 192; y++) for (let x = 0; x < 256; x++) { const i = (Math.floor(y * b.h / 192) * b.w + Math.floor(x * b.w / 256)) * 4; px(c, x, y, [b.data[i], b.data[i + 1], b.data[i + 2]], 0.85); } }
    const box = (it, fillCol, isBtn) => {
        const r = it.round ? Math.min(it.w, it.h) / 2 : th.radius * (it.big ? 1.4 : 1);
        if (th.shadow) rrect(c, it.x + th.shadow, it.y + th.shadow, it.w, it.h, r, mix(th.bg[1], [0, 0, 0], 0.35));
        if (th.glow && isBtn) for (let g = 3; g >= 1; g--) rrect(c, it.x - g, it.y - g, it.w + 2 * g, it.h + 2 * g, r + g, mix(th.bg[0], fillCol, 0.25 / g));
        if (th.border) rrect(c, it.x, it.y, it.w, it.h, r, isBtn ? th.edge : mix(th.edge, th.panel, 0.5));
        const b = th.border;
        rrect(c, it.x + b, it.y + b, it.w - 2 * b, it.h - 2 * b, Math.max(0, r - b), (x, y) => { const t = y / (it.h - 2 * b); let k = fillCol; if (th.gloss) k = mix(mix(fillCol, [255, 255, 255], th.gloss * Math.max(0, 0.5 - t)), [0, 0, 0], th.gloss * 0.4 * Math.max(0, t - 0.5)); return k; });
        if (th.gloss && isBtn && th.radius) rrect(c, it.x + b + 4, it.y + b + 2, it.w - 2 * b - 8, Math.max(2, (it.h - 2 * b) * 0.28), Math.max(0, r - b - 3), mix(fillCol, [255, 255, 255], 0.45));
    };
    for (const it of items) {
        if (it.type === 'panel') box(it, th.panel, false);
        else if (it.type === 'button') {
            const col = th.colors[it.color % th.colors.length]; box(it, col, true);
            const sc = it.big ? 3 : it.w >= 70 && it.h >= 34 ? 2 : 1, lw = it.label ? textW(it.label, sc) : 0;
            const ic = it.icon || (!it.label ? T.ACTION_NAMES[it.action] : null);
            if (ic && ICONS[ic]) { const s = Math.min(it.w, it.h) * (it.label ? 0.42 : 0.6); icon(c, ic, it.x + (it.w - s) / 2, it.y + (it.h - s) / 2 - (it.label ? 7 : 0), s, th.text); if (it.label) text(c, it.x + (it.w - textW(it.label, 1)) / 2, it.y + it.h - 13, it.label, 1, th.text, th.outline); }
            else if (it.label) text(c, it.x + (it.w - lw) / 2, it.y + (it.h - 7 * sc) / 2, it.label, sc, th.text, th.outline);
        } else if (it.type === 'widget' && it.label) {
            const ink = th.panel[0] + th.panel[1] + th.panel[2] > 450 ? th.outline : th.text;
            text(c, it.x, it.y - 10, it.label, 1, ink, null);
        }
    }
    return c;
};
T.ACTION_NAMES = Object.fromEntries(Object.entries(T.ACTIONS).map(([k, v]) => [k, k]));
/* project touch settings -> { image, buttons, widgets } for the ROM builder */
T.compile = (touch, background) => {
    const L = touch.items ? touch : T.layout(touch.layout || 'stats');
    const items = touch.items || L.items;
    const img = T.render(items, touch.theme || 'cute', { background: touch.useBackground ? background : null });
    const buttons = items.filter(i => i.type === 'button').map(b => ({ x: Math.max(0, b.x - 2) & ~1, y: Math.max(0, b.y - 2), w: Math.min(255, b.w + 6), h: Math.min(192, b.h + 6), action: T.ACTIONS[b.action] || 0 }));
    const widgets = items.filter(i => i.type === 'widget').map(w => ({ x: w.x, y: w.y, w: w.w, h: w.h, kind: T.WIDGETS[w.kind] || 0, scale: w.scale || 1 }));
    const th = T.THEMES[touch.theme || 'cute'] || T.THEMES.cute;
    return { image: img, buttons, widgets, text: th.text, outline: th.outline };
};
if (typeof module !== 'undefined') module.exports = T; else root.NRTouch = T;
})(typeof self !== 'undefined' ? self : this);

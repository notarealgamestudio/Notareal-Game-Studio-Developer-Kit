/* nranim.js (v1.13) - posable human figure + preset animation library + idle manager for the offline 3D engines (nr3d.js).
 *  - Skeleton: hips / torso / head / 2 arms (shoulder pitch+roll, elbow) / 2 legs (hip, knee) + face (eyes, brows, jaw, smile), forward kinematics.
 *  - ~70 authored pose clips (work, idle, movement, platforming, combat, social). Timing/ease of each clip uses the measured move classes of
 *    nrmotion.js (ease profiles from ~9,800 real clips); the poses themselves are authored here (no game animation data is copied).
 *  - Layers: procedural locomotion (walk/run/sneak/air from real speed) + upper-body or full-body action clips + idle manager + mood + look-at,
 *    breathing, blinking and weight shift on top, so a standing character never freezes (Sims / GTA style "alive" idle).
 *  - Idle manager: after N still seconds it plays check-watch, foot-tap, look-around, stretch, yawn, scratch-head... weighted by mood/energy/context.
 *  const a = Anim.actor(Anim.STYLES.austin, seed); a.play('ring_register'); a.update(dt, {speed, grounded}); Anim.draw(R, a);
 *  Pose angles are radians. Local frame: x right, y up, z forward. */
(function (root) {
    'use strict';
    const Anim = {}, N3 = (typeof require !== 'undefined' && typeof module !== 'undefined') ? require('./nr3d.js') : root.NR3D, Mo = (typeof require !== 'undefined' && typeof module !== 'undefined') ? require('./nrmotion.js') : root.NRMotion;
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, D = x => x * Math.PI / 180;
    const NEUTRAL = { y: 0, lean: 0, twist: 0, roll: 0, hp: 0, hy: 0, hr: 0, flip: 0, spin: 0, hipTwist: 0, aLp: .06, aLr: .12, aLe: .2, aRp: .06, aRr: .12, aRe: .2, lLp: 0, lLk: 0, lRp: 0, lRk: 0, jaw: 0, brow: 0, smile: 0, eye: 1 };
    const KEYS = Object.keys(NEUTRAL), UPPER = ['lean', 'twist', 'roll', 'hp', 'hy', 'hr', 'aLp', 'aLr', 'aLe', 'aRp', 'aRr', 'aRe', 'jaw', 'brow', 'smile', 'eye'], ARMS = ['aLp', 'aLr', 'aLe', 'aRp', 'aRr', 'aRe'], LOWER = ['y', 'hipTwist', 'lLp', 'lLk', 'lRp', 'lRk'], HEAD = ['hp', 'hy', 'hr', 'jaw', 'brow', 'smile', 'eye'], RLEG = ['lRp', 'lRk'], FULL = KEYS;
    const MASKS = { full: FULL, upper: UPPER, arms: ARMS, lower: LOWER, head: HEAD, rleg: RLEG, rarm: ['aRp', 'aRr', 'aRe'], larm: ['aLp', 'aLr', 'aLe'] };
    Anim.NEUTRAL = NEUTRAL; Anim.MASKS = MASKS;

    /* ------------------------------------------------------------------ clip library */
    // C(name, group, seconds, mask, class, keys[, opts]) ; keys = [time 0..1, partial pose]
    const LIB = {}, C = (name, group, dur, mask, cls, keys, o) => { LIB[name] = Object.assign({ name, group, dur, mask, cls, loop: false, keys: keys.map(k => [k[0], Object.assign({}, NEUTRAL, k[1])]) }, o || {}); };
    const L = (name, group, dur, mask, cls, keys, o) => C(name, group, dur, mask, cls, keys, Object.assign({ loop: true }, o || {}));
    const ARMS_UP = { aLp: 2.9, aRp: 2.9, aLe: .25, aRe: .25, aLr: .25, aRr: .25 };

    /* idle / life */
    C('check_watch', 'idle', 2.8, 'upper', 'idle', [[0, {}], [.2, { aLp: 1.15, aLe: 1.9, aLr: -.35, hp: .08 }], [.35, { aLp: 1.2, aLe: 2.05, aLr: -.4, hp: .38, lean: .03, brow: .2 }], [.6, { aLp: 1.2, aLe: 2.05, aLr: -.4, hp: .42, lean: .05, brow: .3, jaw: .1 }], [.72, { aLp: 1.15, aLe: 1.95, aLr: -.35, hp: .12, hy: .15 }], [.9, { aLp: .5, aLe: .8, hp: 0 }], [1, {}]]);
    L('foot_tap', 'idle', .52, 'rleg', 'idle', [[0, { lRp: .22, lRk: .15 }], [.35, { lRp: .22, lRk: .55 }], [.6, { lRp: .24, lRk: .12 }], [1, { lRp: .22, lRk: .15 }]], { repeat: [5, 9] });
    C('look_around', 'idle', 3.4, 'upper', 'idle', [[0, {}], [.25, { hy: -.85, twist: -.12, hp: -.04 }], [.5, { hy: -.85, twist: -.12 }], [.7, { hy: .9, twist: .14, hp: .03 }], [.88, { hy: .9, twist: .14 }], [1, {}]]);
    C('stretch', 'idle', 3.2, 'upper', 'idle', [[0, {}], [.3, { ...ARMS_UP, lean: -.12, hp: -.3, jaw: .25, eye: .5 }], [.65, { ...ARMS_UP, lean: -.16, hp: -.35, jaw: .3, eye: .4 }], [.9, { aLp: .5, aRp: .5, lean: 0 }], [1, {}]]);
    C('yawn', 'idle', 2.6, 'upper', 'idle', [[0, {}], [.25, { aRp: 1.5, aRe: 1.8, aRr: -.1, hp: -.18, jaw: .6, eye: .3 }], [.6, { aRp: 1.55, aRe: 1.85, hp: -.22, jaw: .85, eye: .15 }], [.85, { aRp: 1.0, aRe: 1.2, hp: 0, jaw: .1, eye: .6 }], [1, {}]]);
    C('scratch_head', 'idle', 2.4, 'upper', 'idle', [[0, {}], [.2, { aRp: 2.4, aRe: 1.9, aRr: .15, hr: .06 }], [.35, { aRp: 2.5, aRe: 2.0, hr: .08 }], [.5, { aRp: 2.35, aRe: 1.85, hr: .06 }], [.65, { aRp: 2.5, aRe: 2.0, hr: .08 }], [.85, { aRp: 1.0, aRe: 1.0 }], [1, {}]]);
    C('arms_crossed', 'idle', 4, 'arms', 'idle', [[0, {}], [.15, { aLp: 1.0, aLe: 2.1, aLr: -.55, aRp: 1.0, aRe: 2.1, aRr: -.55 }], [.85, { aLp: 1.0, aLe: 2.1, aLr: -.55, aRp: 1.0, aRe: 2.1, aRr: -.55 }], [1, {}]]);
    C('hands_on_hips', 'idle', 3.5, 'arms', 'idle', [[0, {}], [.15, { aLp: .1, aLe: 1.3, aLr: .75, aRp: .1, aRe: 1.3, aRr: .75 }], [.85, { aLp: .1, aLe: 1.3, aLr: .75, aRp: .1, aRe: 1.3, aRr: .75 }], [1, {}]]);
    C('phone_check', 'idle', 4.2, 'upper', 'idle', [[0, {}], [.15, { aRp: 1.1, aRe: 1.7, aRr: -.25, hp: .35, lean: .05 }], [.4, { aRp: 1.15, aRe: 1.75, aRr: -.25, hp: .42, lean: .06, smile: .3 }], [.7, { aRp: 1.1, aRe: 1.7, hp: .4, hy: .1, brow: .2 }], [.88, { aRp: .5, aRe: .8, hp: .1 }], [1, {}]]);
    C('shrug', 'idle', 1.6, 'upper', 'idle', [[0, {}], [.25, { aLp: .3, aLe: 1.5, aLr: .55, aRp: .3, aRe: 1.5, aRr: .55, hr: .1, brow: .5 }], [.7, { aLp: .3, aLe: 1.5, aLr: .55, aRp: .3, aRe: 1.5, aRr: .55, hr: .1, brow: .5 }], [1, {}]]);
    C('rub_neck', 'idle', 2.6, 'upper', 'idle', [[0, {}], [.25, { aRp: 2.1, aRe: 2.3, aRr: -.3, hr: .22, hp: .1 }], [.5, { aRp: 2.15, aRe: 2.4, hr: .25, hp: .12, eye: .6 }], [.75, { aRp: 2.1, aRe: 2.3, hr: .2 }], [1, {}]]);
    C('wipe_brow', 'idle', 1.8, 'upper', 'idle', [[0, {}], [.25, { aRp: 2.2, aRe: 2.0, aRr: -.2, hp: .1, eye: .6 }], [.5, { aRp: 2.2, aRe: 2.0, aRr: .2, hp: .1, jaw: .12 }], [.75, { aRp: 1.0, aRe: 1.2, hp: 0 }], [1, {}]]);
    C('lean_counter', 'idle', 4.5, 'upper', 'idle', [[0, {}], [.2, { lean: .3, aLp: .9, aRp: .9, aLe: 1.1, aRe: 1.1, hp: -.15 }], [.85, { lean: .3, aLp: .9, aRp: .9, aLe: 1.1, aRe: 1.1, hp: -.12, hy: .3 }], [1, {}]]);
    C('drink_soda', 'idle', 3, 'upper', 'idle', [[0, {}], [.25, { aRp: 1.6, aRe: 2.1, aRr: -.1 }], [.45, { aRp: 1.7, aRe: 2.35, hp: -.28, aRr: -.1 }], [.65, { aRp: 1.7, aRe: 2.35, hp: -.3 }], [.85, { aRp: 1.0, aRe: 1.2, hp: 0 }], [1, {}]]);
    C('weight_shift', 'idle', 4, 'lower', 'idle', [[0, {}], [.3, { y: -.015, lLp: .04, lRk: .1, lRp: -.06, hipTwist: .06 }], [.7, { y: -.015, lLp: .04, lRk: .1, lRp: -.06, hipTwist: .06 }], [1, {}]]);
    L('breathe_heavy', 'idle', 2, 'upper', 'idle', [[0, { lean: 0 }], [.5, { lean: .04, aLr: .2, aRr: .2, hp: -.03 }], [1, { lean: 0 }]]);
    /* social */
    C('nod', 'social', .9, 'head', 'idle', [[0, {}], [.3, { hp: .28 }], [.6, { hp: -.04 }], [.8, { hp: .2 }], [1, {}]]);
    C('shake_head', 'social', 1.1, 'head', 'idle', [[0, {}], [.2, { hy: .5, hr: .05 }], [.45, { hy: -.5 }], [.7, { hy: .4 }], [1, {}]]);
    C('wave', 'social', 1.8, 'upper', 'idle', [[0, {}], [.2, { aRp: 2.6, aRe: .5, aRr: .35, smile: .6 }], [.4, { aRp: 2.6, aRe: .9, aRr: .55, smile: .7 }], [.6, { aRp: 2.6, aRe: .5, aRr: .35, smile: .7 }], [.8, { aRp: 2.6, aRe: .9, aRr: .55 }], [1, {}]]);
    C('point', 'social', 1.4, 'arms', 'strike', [[0, {}], [.3, { aRp: 1.55, aRe: .05, aRr: .05 }], [.8, { aRp: 1.55, aRe: .05, aRr: .05 }], [1, {}]]);
    L('talk', 'social', 2.2, 'upper', 'idle', [[0, { aRp: .9, aRe: 1.2, jaw: .25, hy: .06 }], [.25, { aRp: 1.1, aRe: 1.0, jaw: .05, aLp: .5, aLe: 1.2, hy: -.05 }], [.5, { aRp: .8, aRe: 1.4, jaw: .3, hr: .05 }], [.75, { aRp: 1.0, aRe: 1.1, jaw: .08, aLp: .6, aLe: 1.3, hy: .08 }], [1, { aRp: .9, aRe: 1.2, jaw: .25, hy: .06 }]]);
    C('shout', 'social', 1.1, 'upper', 'strike', [[0, {}], [.25, { aLp: 1.9, aLe: 1.5, aLr: .3, aRp: 1.9, aRe: 1.5, aRr: .3, jaw: .9, brow: .4, lean: -.05, hp: -.1 }], [.7, { aLp: 1.9, aLe: 1.5, aLr: .3, aRp: 1.9, aRe: 1.5, aRr: .3, jaw: .8, brow: .4 }], [1, {}]]);
    C('hands_up', 'social', 1.2, 'arms', 'idle', [[0, {}], [.3, { aLp: 2.7, aRp: 2.7, aLe: .5, aRe: .5, aLr: .35, aRr: .35 }], [1, { aLp: 2.7, aRp: 2.7, aLe: .5, aRe: .5, aLr: .35, aRr: .35 }]], { hold: true });
    C('hurt', 'combat', .55, 'full', 'fall', [[0, {}], [.2, { lean: -.3, hp: -.3, aLp: .8, aRp: .8, aLr: .5, aRr: .5, brow: -.4, jaw: .5, y: -.04 }], [.6, { lean: -.15, aLp: .5, aRp: .5 }], [1, {}]]);
    /* work: register, cash, stocking, cleaning */
    C('ring_register', 'work', 1.5, 'upper', 'idle', [[0, {}], [.18, { aRp: 1.0, aRe: .75, aRr: -.05, hp: .3, lean: .08 }], [.3, { aRp: 1.1, aRe: .75, hp: .32, lean: .1 }], [.4, { aRp: .95, aRe: .75, hp: .32 }], [.5, { aRp: 1.1, aRe: .75, hp: .3 }], [.6, { aRp: .95, aRe: .75 }], [.7, { aRp: 1.1, aRe: .75, hp: .3 }], [.85, { aRp: .9, aRe: .8, hp: .1, lean: .04 }], [1, {}]]);
    C('scan_item', 'work', .9, 'upper', 'idle', [[0, {}], [.2, { aLp: 1.1, aLe: 1.2, aRp: .95, aRe: .9, aRr: -.15, hp: .22, lean: .06 }], [.5, { aLp: 1.15, aLe: 1.1, aRp: .95, aRe: .9, aRr: .25, twist: .1, hp: .24 }], [.8, { aLp: 1.0, aLe: 1.1, aRp: .9, aRe: .9, aRr: -.1, twist: -.05 }], [1, {}]]);
    C('take_cash', 'work', 1.3, 'upper', 'idle', [[0, {}], [.25, { aRp: 1.15, aRe: .35, aRr: .22, lean: .1, hp: .08, smile: .4 }], [.45, { aRp: 1.2, aRe: .3, aRr: .2, lean: .12 }], [.7, { aRp: .55, aRe: 1.4, aRr: -.05, hp: .25, lean: .06 }], [1, {}]]);
    C('count_cash', 'work', 1.8, 'upper', 'idle', [[0, {}], [.15, { aLp: .8, aLe: 1.6, aLr: -.2, aRp: .85, aRe: 1.6, aRr: -.2, hp: .4, lean: .06 }], [.35, { aLp: .8, aLe: 1.6, aRp: .95, aRe: 1.4, aRr: -.15, hp: .42 }], [.55, { aLp: .8, aLe: 1.6, aRp: .8, aRe: 1.7, aRr: -.2, hp: .4 }], [.75, { aLp: .8, aLe: 1.6, aRp: .95, aRe: 1.4, hp: .42 }], [1, {}]]);
    C('give_change', 'work', 1.2, 'upper', 'idle', [[0, {}], [.3, { aRp: 1.3, aRe: .25, aRr: .1, lean: .1, smile: .55, hp: .05 }], [.65, { aRp: 1.35, aRe: .2, lean: .12, smile: .6 }], [1, {}]]);
    C('bag_items', 'work', 1.6, 'upper', 'idle', [[0, {}], [.2, { aLp: .8, aLe: .7, aRp: .9, aRe: .8, lean: .2, hp: .3 }], [.45, { aLp: .55, aLe: 1.2, aRp: .6, aRe: 1.2, lean: .2, hp: .35 }], [.7, { aLp: 1.0, aLe: .6, aRp: 1.0, aRe: .6, lean: .15 }], [1, {}]]);
    C('open_drawer', 'work', .9, 'upper', 'idle', [[0, {}], [.3, { aRp: .9, aRe: .7, lean: .1, hp: .25 }], [.55, { aRp: .7, aRe: .4, lean: .12 }], [1, {}]]);
    C('stock_shelf', 'work', 2.0, 'upper', 'idle', [[0, {}], [.2, { aLp: 1.2, aLe: 1.0, aRp: 1.1, aRe: 1.0, aLr: -.1, aRr: -.1, lean: .05 }], [.45, { aLp: 1.9, aLe: .5, aRp: 1.85, aRe: .5, lean: .02, hp: -.15 }], [.6, { aLp: 1.95, aLe: .4, aRp: 1.95, aRe: .4, hp: -.12 }], [.8, { aLp: 1.0, aLe: .9, aRp: 1.0, aRe: .9, hp: 0 }], [1, {}]]);
    C('stock_low', 'work', 2.1, 'full', 'grapple', [[0, {}], [.25, { y: -.42, lLp: 1.35, lLk: 2.2, lRp: .9, lRk: 2.0, lean: .35, aLp: 1.3, aRp: 1.3, aLe: .6, aRe: .6, hp: -.1 }], [.55, { y: -.45, lLp: 1.4, lLk: 2.3, lRp: .95, lRk: 2.1, lean: .4, aLp: 1.55, aRp: 1.55, aLe: .3, aRe: .3 }], [.8, { y: -.2, lLp: .7, lLk: 1.2, lRp: .5, lRk: 1.0, lean: .2, aLp: 1.0, aRp: 1.0 }], [1, {}]]);
    C('pick_up_box', 'work', 1.7, 'full', 'getup', [[0, {}], [.3, { y: -.4, lLp: 1.3, lLk: 2.2, lRp: 1.2, lRk: 2.1, lean: .3, aLp: 1.2, aRp: 1.2, aLe: .5, aRe: .5, aLr: -.1, aRr: -.1 }], [.55, { y: -.42, lLp: 1.3, lLk: 2.25, lRp: 1.2, lRk: 2.15, lean: .35, aLp: 1.25, aRp: 1.25, aLe: .6, aRe: .6, aLr: -.2, aRr: -.2 }], [.85, { y: -.1, lLp: .4, lLk: .7, lRp: .4, lRk: .7, lean: .1, aLp: 1.2, aRp: 1.2, aLe: 1.1, aRe: 1.1, aLr: -.15, aRr: -.15 }], [1, { aLp: 1.2, aRp: 1.2, aLe: 1.1, aRe: 1.1, aLr: -.15, aRr: -.15, lean: -.05 }]]);
    L('carry_box', 'work', 1, 'arms', 'idle', [[0, { aLp: 1.2, aRp: 1.2, aLe: 1.1, aRe: 1.1, aLr: -.15, aRr: -.15 }], [1, { aLp: 1.2, aRp: 1.2, aLe: 1.1, aRe: 1.1, aLr: -.15, aRr: -.15 }]]);
    L('sweep', 'work', 1.6, 'upper', 'idle', [[0, { aLp: 1.1, aLe: .7, aRp: 1.0, aRe: .9, twist: -.2, lean: .18, hp: .3 }], [.5, { aLp: 1.1, aLe: .7, aRp: 1.0, aRe: .9, twist: .2, lean: .18, hp: .3 }], [1, { aLp: 1.1, aLe: .7, aRp: 1.0, aRe: .9, twist: -.2, lean: .18, hp: .3 }]]);
    L('wipe_counter', 'work', 1.4, 'upper', 'idle', [[0, { aRp: 1.1, aRe: .5, aRr: -.15, lean: .2, hp: .3, twist: .08 }], [.5, { aRp: 1.1, aRe: .5, aRr: .35, lean: .2, hp: .3, twist: -.08 }], [1, { aRp: 1.1, aRe: .5, aRr: -.15, lean: .2, hp: .3, twist: .08 }]]);
    C('face_shelf', 'work', 1.1, 'upper', 'idle', [[0, {}], [.35, { hp: -.12, hy: .35, aRp: .9, aRe: 1.5, brow: .25 }], [.8, { hp: -.12, hy: .35, aRp: .9, aRe: 1.5 }], [1, {}]]);
    /* customers */
    C('browse', 'social', 2, 'upper', 'idle', [[0, {}], [.25, { aRp: 1.3, aRr: .4, aRe: .4, hy: .5, lean: .06 }], [.5, { aRp: .9, aRr: .35, aRe: 1.5, hy: .4, hp: .2 }], [.85, { aRp: .5, aRe: 1.0, hy: 0 }], [1, {}]]);
    C('pick_item', 'social', 1.4, 'upper', 'idle', [[0, {}], [.3, { aRp: 1.5, aRr: .35, aRe: .25, lean: .12, hy: .4 }], [.55, { aRp: 1.4, aRr: .3, aRe: .3, lean: .12 }], [.85, { aRp: .8, aRe: 1.5 }], [1, {}]]);
    C('stuff_pocket', 'combat', .8, 'upper', 'idle', [[0, {}], [.3, { aRp: .5, aRe: .8, hy: -.7, brow: -.2, lean: .05 }], [.6, { aRp: -.2, aRe: 1.2, aRr: -.15, hy: -.7 }], [1, {}]]);
    /* movement / platforming (SM64 style) */
    C('jump', 'move', .5, 'full', 'aerial', [[0, { y: -.15, lLp: .5, lLk: .9, lRp: .4, lRk: .8, lean: .1 }], [.25, { y: .05, lLp: .35, lLk: .6, lRp: -.15, lRk: .5, aLp: 2.2, aRp: 1.6, aLr: .3, aRr: .3, lean: .05, jaw: .3 }], [1, { lLp: .3, lLk: .9, lRp: -.2, lRk: .3, aLp: 2.4, aRp: 1.4, aLr: .4, aRr: .4 }]]);
    C('double_jump', 'move', .55, 'full', 'aerial', [[0, { y: -.18, lLp: .6, lLk: 1.1, lRp: .5, lRk: 1.0, lean: .15 }], [.3, { y: .05, lLp: .5, lLk: .5, lRp: -.3, lRk: .5, aLp: 2.5, aRp: 2.5, aLr: .3, aRr: .3, jaw: .4 }], [1, { lLp: .4, lLk: .9, lRp: -.25, lRk: .6, aLp: 2.6, aRp: 1.9, aLr: .5, aRr: .5 }]]);
    C('triple_jump', 'move', 1.0, 'full', 'aerial', [[0, { y: -.2, lLp: .6, lLk: 1.2, lRp: .6, lRk: 1.2, lean: .2 }], [.15, { y: .05, flip: 0, lLp: 1.0, lLk: 1.8, lRp: 1.0, lRk: 1.8, aLp: 1.0, aRp: 1.0, aLe: 2.0, aRe: 2.0, lean: .2 }], [.85, { y: 0, flip: -6.283, lLp: 1.4, lLk: 2.0, lRp: 1.4, lRk: 2.0, aLp: 1.0, aRp: 1.0, aLe: 2.0, aRe: 2.0, lean: .2 }], [1, { flip: -6.283, lLp: .5, lLk: .5, lRp: -.1, lRk: .3, aLp: 2.4, aRp: 2.4 }]]);
    C('long_jump', 'move', .9, 'full', 'aerial', [[0, { y: -.3, lean: .4, lLp: .8, lLk: 1.5, lRp: .8, lRk: 1.5, aLp: 1.0, aRp: 1.0 }], [.25, { y: -.1, lean: 1.0, lLp: -.9, lLk: .3, lRp: -.95, lRk: .3, aLp: 2.7, aRp: 2.7, aLr: .1, aRr: .1, aLe: .1, aRe: .1, jaw: .4 }], [1, { lean: 1.1, lLp: -1.0, lLk: .2, lRp: -1.05, lRk: .2, aLp: 2.8, aRp: 2.8, aLe: .05, aRe: .05 }]]);
    C('backflip', 'move', 1.1, 'full', 'aerial', [[0, { y: -.3, lean: .3, lLp: 1.0, lLk: 1.8, lRp: 1.0, lRk: 1.8 }], [.2, { y: 0, flip: 0, lLp: 1.1, lLk: 1.9, lRp: 1.1, lRk: 1.9, aLp: 1.0, aRp: 1.0, aLe: 2.0, aRe: 2.0 }], [.85, { flip: 6.283, lLp: 1.4, lLk: 2.0, lRp: 1.4, lRk: 2.0, aLp: 1.0, aRp: 1.0, aLe: 2.0, aRe: 2.0 }], [1, { flip: 6.283, lLp: .3, lLk: .4, lRp: .1, lRk: .3, aLp: 2.3, aRp: 2.3, aLr: .5, aRr: .5 }]]);
    C('side_flip', 'move', .9, 'full', 'aerial', [[0, { y: -.3, lLp: .8, lLk: 1.5, lRp: .8, lRk: 1.5 }], [.2, { y: 0, spin: 0, lLp: 1.0, lLk: 1.8, lRp: 1.0, lRk: 1.8, aLp: 1.0, aRp: 1.0, aLe: 2.0, aRe: 2.0 }], [.85, { spin: 6.283, lLp: 1.1, lLk: 1.9, lRp: 1.1, lRk: 1.9, aLp: 1.0, aRp: 1.0, aLe: 2.0, aRe: 2.0 }], [1, { spin: 6.283, lLp: .3, lLk: .4, aLp: 2.3, aRp: 2.3 }]]);
    C('wall_slide', 'move', .6, 'full', 'idle', [[0, { y: -.05, lean: -.15, aLp: 2.4, aRp: 2.4, aLr: .3, aRr: .3, aLe: .3, aRe: .3, lLp: .3, lLk: .5, lRp: .1, lRk: .4, jaw: .3 }], [1, { y: -.05, lean: -.15, aLp: 2.4, aRp: 2.4, aLr: .3, aRr: .3, aLe: .3, aRe: .3, lLp: .3, lLk: .5, lRp: .1, lRk: .4, jaw: .3 }]], { hold: true });
    C('wall_kick', 'move', .55, 'full', 'aerial', [[0, { y: -.1, lean: -.2, lLp: .6, lLk: 1.2, lRp: .3, lRk: .8, aLp: 2.2, aRp: 2.2 }], [.4, { y: .05, lean: .2, spin: 3.14, lLp: .9, lLk: .7, lRp: -.3, lRk: .4, aLp: 2.5, aRp: 2.5, jaw: .5 }], [1, { spin: 3.14, lLp: .4, lLk: .6, aLp: 2.4, aRp: 1.8 }]]);
    C('ground_pound', 'move', .9, 'full', 'aerial', [[0, { flip: 0, lLp: 1.0, lLk: 1.9, lRp: 1.0, lRk: 1.9, aLp: 1.0, aRp: 1.0, aLe: 2.0, aRe: 2.0, y: -.1 }], [.4, { flip: -6.283, lLp: 1.4, lLk: 2.1, lRp: 1.4, lRk: 2.1, aLp: 1.0, aRp: 1.0, aLe: 2.0, aRe: 2.0, y: 0 }], [.6, { flip: -6.283, lLp: .1, lLk: .1, lRp: .1, lRk: .1, aLp: 1.2, aRp: 1.2, aLe: .1, aRe: .1, y: -.1, lean: .3 }], [1, { flip: -6.283, y: -.35, lLp: 1.2, lLk: 2.2, lRp: 1.2, lRk: 2.2, aLp: .5, aRp: .5, lean: .4 }]], { hold: true });
    C('dive', 'move', .6, 'full', 'aerial', [[0, { lean: .5, aLp: 2.0, aRp: 2.0 }], [.3, { lean: 1.35, lLp: -.8, lLk: .2, lRp: -.85, lRk: .2, aLp: 2.9, aRp: 2.9, aLe: .05, aRe: .05, aLr: .1, aRr: .1, hp: -.5, jaw: .4 }], [1, { lean: 1.45, lLp: -.9, lLk: .1, lRp: -.9, lRk: .1, aLp: 2.9, aRp: 2.9, aLe: .05, aRe: .05, hp: -.55 }]], { hold: true });
    C('belly_slide', 'move', .8, 'full', 'fall', [[0, { lean: 1.45, y: -.55, lLp: -.9, lLk: .1, lRp: -.9, lRk: .1, aLp: 2.9, aRp: 2.9, aLe: .05, aRe: .05, hp: -.6 }], [1, { lean: 1.45, y: -.6, lLp: -.9, lLk: .1, lRp: -.9, lRk: .1, aLp: 2.9, aRp: 2.9, hp: -.6 }]], { hold: true });
    C('punch', 'combat', .38, 'upper', 'strike', [[0, {}], [.2, { aRp: -.5, aRe: 1.6, twist: .3, lean: .05 }], [.55, { aRp: 1.55, aRe: .1, twist: -.35, lean: .15, jaw: .3 }], [1, {}]]);
    C('kick', 'combat', .5, 'full', 'kick', [[0, {}], [.3, { lRp: -.5, lRk: 1.3, lean: -.1 }], [.6, { lRp: 1.45, lRk: .1, lean: -.3, aLp: .9, aRp: -.3 }], [1, {}]]);
    C('land', 'move', .3, 'full', 'fall', [[0, { y: -.35, lLp: 1.0, lLk: 1.9, lRp: 1.0, lRk: 1.9, lean: .3, aLp: .7, aRp: .7 }], [1, {}]]);
    L('crouch', 'move', 1, 'full', 'idle', [[0, { y: -.4, lLp: 1.25, lLk: 2.2, lRp: 1.1, lRk: 2.0, lean: .25, aLp: .6, aRp: .6, hp: -.15 }], [1, { y: -.4, lLp: 1.25, lLk: 2.2, lRp: 1.1, lRk: 2.0, lean: .25, aLp: .6, aRp: .6, hp: -.15 }]]);
    L('skid', 'move', .5, 'full', 'idle', [[0, { lean: -.35, lLp: .7, lLk: .1, lRp: .5, lRk: .1, aLp: -.4, aRp: -.4, aLr: .6, aRr: .6, jaw: .3 }], [1, { lean: -.35, lLp: .7, lLk: .1, lRp: .5, lRk: .1, aLp: -.4, aRp: -.4, aLr: .6, aRr: .6 }]]);
    L('fall_flail', 'move', .5, 'full', 'idle', [[0, { aLp: 2.7, aRp: 2.2, aLr: .8, aRr: .6, lLp: .4, lLk: .6, lRp: -.2, lRk: .2, jaw: .6, brow: .5 }], [.5, { aLp: 2.2, aRp: 2.7, aLr: .6, aRr: .8, lLp: -.2, lLk: .2, lRp: .4, lRk: .6, jaw: .6 }], [1, { aLp: 2.7, aRp: 2.2, aLr: .8, aRr: .6, lLp: .4, lLk: .6, lRp: -.2, lRk: .2, jaw: .6 }]]);
    C('ledge_hang', 'move', .6, 'full', 'climb', [[0, { aLp: 3.0, aRp: 3.0, aLe: .15, aRe: .15, aLr: .1, aRr: .1, lLp: .2, lLk: .4, lRp: .1, lRk: .3, y: .02 }], [1, { aLp: 3.0, aRp: 3.0, aLe: .15, aRe: .15, lLp: .2, lLk: .4, lRp: .1, lRk: .3 }]], { hold: true });
    C('die', 'combat', 1.4, 'full', 'fall', [[0, {}], [.25, { lean: -.4, aLp: 1.2, aRp: 1.2, aLr: .8, aRr: .8, hp: -.4, jaw: .7 }], [.7, { lean: -1.3, y: -.55, lLp: .8, lLk: 1.5, lRp: .4, lRk: 1.0, aLp: .3, aRp: .3, aLr: .9, aRr: .9, hp: -.2 }], [1, { lean: -1.5, y: -.8, lLp: .6, lLk: 1.2, lRp: .3, lRk: .9, aLp: .2, aRp: .3, aLr: .9, aRr: .8 }]], { hold: true });
    /* combat / warfare (Halo style) */
    L('aim_rifle', 'combat', 1, 'upper', 'idle', [[0, { aRp: 1.35, aRe: .9, aRr: -.15, aLp: 1.45, aLe: .5, aLr: -.2, lean: .04, twist: -.25, hp: -.04 }], [1, { aRp: 1.35, aRe: .9, aRr: -.15, aLp: 1.45, aLe: .5, aLr: -.2, lean: .04, twist: -.25, hp: -.04 }]]);
    L('hip_rifle', 'combat', 1, 'arms', 'idle', [[0, { aRp: .75, aRe: 1.0, aRr: .05, aLp: 1.1, aLe: .6, aLr: -.2 }], [1, { aRp: .75, aRe: 1.0, aRr: .05, aLp: 1.1, aLe: .6, aLr: -.2 }]]);
    L('aim_pistol', 'combat', 1, 'arms', 'idle', [[0, { aRp: 1.5, aRe: .1, aRr: .03, aLp: .06, aLe: .2 }], [1, { aRp: 1.5, aRe: .1, aRr: .03 }]]);
    C('fire_recoil', 'combat', .14, 'upper', 'strike', [[0, {}], [.2, { aRp: 1.5, aRe: .8, aLp: 1.55, aLe: .45, lean: -.06, hp: -.05, twist: -.22 }], [1, {}]]);
    C('reload', 'combat', 1.6, 'upper', 'idle', [[0, {}], [.2, { aRp: 1.2, aRe: 1.1, aLp: 1.0, aLe: 1.4, hp: .35, lean: .08 }], [.45, { aRp: 1.2, aRe: 1.1, aLp: .55, aLe: 1.7, hp: .4 }], [.7, { aRp: 1.2, aRe: 1.1, aLp: 1.1, aLe: 1.3, hp: .3 }], [.85, { aRp: 1.3, aRe: .9, aLp: 1.4, aLe: .6, hp: 0 }], [1, {}]]);
    C('throw_grenade', 'combat', 1.0, 'upper', 'throw', [[0, {}], [.3, { aRp: -.6, aRe: 1.5, aRr: .3, twist: .5, lean: -.12, aLp: 1.0, aLe: .5, hp: -.1 }], [.55, { aRp: 2.2, aRe: .3, twist: -.45, lean: .22, aLp: .5 }], [.8, { aRp: 1.2, aRe: .3, twist: -.2, lean: .1 }], [1, {}]]);
    C('melee_butt', 'combat', .5, 'upper', 'strike', [[0, {}], [.25, { aRp: .6, aLp: 1.2, aLe: .8, aRe: 1.6, twist: .45, lean: -.1 }], [.55, { aRp: 1.35, aLp: 1.5, aLe: .3, aRe: .4, twist: -.4, lean: .25 }], [1, {}]]);
    L('cover_crouch', 'combat', 1, 'full', 'idle', [[0, { y: -.42, lLp: 1.25, lLk: 2.25, lRp: 1.05, lRk: 2.0, lean: .22, aRp: 1.1, aRe: 1.0, aLp: 1.2, aLe: .9, hp: -.12 }], [1, { y: -.42, lLp: 1.25, lLk: 2.25, lRp: 1.05, lRk: 2.0, lean: .22, aRp: 1.1, aRe: 1.0, aLp: 1.2, aLe: .9, hp: -.12 }]]);
    C('peek_lean', 'combat', .6, 'upper', 'idle', [[0, {}], [.4, { roll: .38, lean: .02, aRp: 1.35, aRe: .8, aLp: 1.4, aLe: .5, hr: -.3 }], [1, { roll: .38, aRp: 1.35, aRe: .8, aLp: 1.4, aLe: .5, hr: -.3 }]], { hold: true });
    C('grab_thief', 'combat', .8, 'full', 'grapple', [[0, { lean: .2, aLp: 1.2, aRp: 1.2 }], [.4, { lean: .85, y: -.15, lLp: -.4, lLk: .2, lRp: .8, lRk: 1.0, aLp: 1.9, aRp: 1.9, aLe: .3, aRe: .3, aLr: .15, aRr: .15, jaw: .35 }], [1, { lean: .7, y: -.35, lLp: .9, lLk: 1.5, lRp: .9, lRk: 1.5, aLp: 1.5, aRp: 1.5, aLe: .8, aRe: .8 }]]);
    C('tackled', 'combat', 1.0, 'full', 'fall', [[0, {}], [.3, { lean: -.5, aLp: 1.5, aRp: 1.5, aLr: .8, aRr: .8, jaw: .6, brow: .5 }], [.75, { lean: -1.45, y: -.7, lLp: .5, lLk: 1.0, lRp: .3, lRk: .8, aLp: .4, aRp: .4, aLr: .9, aRr: .9 }], [1, { lean: -1.5, y: -.8, aLr: .9, aRr: .9 }]], { hold: true });
    C('aim_gun_robber', 'combat', .8, 'arms', 'strike', [[0, {}], [.3, { aRp: 1.55, aRe: .1, aRr: .03, brow: -.5 }], [1, { aRp: 1.55, aRe: .1, aRr: .03 }]], { hold: true });
    C('panic_button', 'work', 1.0, 'upper', 'idle', [[0, {}], [.4, { aRp: .35, aRe: 1.2, lean: .18, hp: .35, eye: .8 }], [.7, { aRp: .3, aRe: 1.1, lean: .2 }], [1, {}]]);
    C('sit', 'move', 1, 'full', 'idle', [[0, { y: -.5, lLp: 1.55, lLk: 1.5, lRp: 1.55, lRk: 1.5, aLp: .7, aLe: 1.2, aRp: .7, aRe: 1.2, lean: .05 }], [1, { y: -.5, lLp: 1.55, lLk: 1.5, lRp: 1.55, lRk: 1.5, aLp: .7, aLe: 1.2, aRp: .7, aRe: 1.2 }]], { hold: true });
    Anim.LIB = LIB; Anim.names = () => Object.keys(LIB); Anim.groups = () => { const g = {}; for (const k in LIB) (g[LIB[k].group] = g[LIB[k].group] || []).push(k); return g; };
    Anim.describe = () => Object.values(LIB).map(c => `${c.name} (${c.group}, ${c.dur}s, ${c.mask}${c.loop ? ', loop' : ''})`).join('\n');

    /* ------------------------------------------------------------------ sampling */
    const ease = (cls, u) => { const e = Mo ? Mo.ease(cls || 'idle', u) : u, s = u * u * (3 - 2 * u); return cls === 'idle' || !cls ? s : lerp(s, e, 0.6); };
    Anim.sample = (clip, t) => { // t in 0..1 -> full pose
        const k = clip.keys; if (t <= k[0][0]) return k[0][1]; if (t >= k[k.length - 1][0]) return k[k.length - 1][1];
        let i = 0; while (i < k.length - 2 && t > k[i + 1][0]) i++;
        const a = k[i], b = k[i + 1], u = ease(clip.cls, (t - a[0]) / (b[0] - a[0])), out = {}; for (const j of KEYS) out[j] = lerp(a[1][j], b[1][j], u); return out;
    };

    /* ------------------------------------------------------------------ idle manager */
    // each entry: clip, minStill seconds before it can start, weight, cooldown seconds, moods/ctx it favours
    Anim.IDLES = [
        { clip: 'foot_tap', still: 2.5, w: 3, cd: 8, ctx: ['waiting', 'impatient', 'bored'], repeat: true },
        { clip: 'check_watch', still: 4, w: 3, cd: 18, ctx: ['waiting', 'bored', 'impatient', 'onduty'] },
        { clip: 'look_around', still: 3, w: 3, cd: 10, ctx: ['onduty', 'waiting', 'bored', 'scared'] },
        { clip: 'weight_shift', still: 1.5, w: 4, cd: 6, ctx: ['*'] },
        { clip: 'stretch', still: 8, w: 2, cd: 40, ctx: ['tired', 'bored', 'onduty'] },
        { clip: 'yawn', still: 6, w: 2, cd: 30, ctx: ['tired', 'bored'] },
        { clip: 'scratch_head', still: 5, w: 1.5, cd: 25, ctx: ['bored', 'onduty'] },
        { clip: 'arms_crossed', still: 5, w: 2, cd: 25, ctx: ['waiting', 'impatient', 'angry'] },
        { clip: 'hands_on_hips', still: 5, w: 1.5, cd: 25, ctx: ['impatient', 'angry', 'onduty'] },
        { clip: 'phone_check', still: 9, w: 2, cd: 45, ctx: ['bored', 'waiting'] },
        { clip: 'rub_neck', still: 7, w: 1.5, cd: 40, ctx: ['tired', 'bored'] },
        { clip: 'wipe_brow', still: 6, w: 1.2, cd: 40, ctx: ['tired', 'onduty'] },
        { clip: 'lean_counter', still: 7, w: 1.5, cd: 50, ctx: ['bored', 'onduty'], near: 'counter' },
        { clip: 'drink_soda', still: 10, w: 1.2, cd: 60, ctx: ['bored', 'tired'] },
        { clip: 'shrug', still: 5, w: 1, cd: 30, ctx: ['impatient', 'bored'] }
    ];
    const rngOf = seed => { let s = (seed >>> 0) || 7; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };

    /* ------------------------------------------------------------------ styles (look presets) */
    const sk = { tan: [196, 140, 100], brown: [150, 98, 66], pale: [236, 200, 175], fair: [226, 184, 150], dark: [110, 72, 50] };
    Anim.STYLES = {
        austin: { skin: sk.brown, hair: [22, 16, 14], hairStyle: 'bun', shirt: [232, 200, 60], pants: [46, 82, 160], shoes: [30, 30, 36], apron: [235, 235, 235], glasses: true, stubble: true, mustache: true, height: 1.0, bulk: .92, eye: [50, 34, 24] },
        austin_street: { skin: sk.brown, hair: [22, 16, 14], hairStyle: 'bun', shirt: [24, 24, 26], pants: [20, 20, 24], shoes: [28, 28, 30], jacket: [118, 124, 132], glasses: true, stubble: true, mustache: true, height: 1.0, bulk: .92, eye: [50, 34, 24] },
        steve: { skin: sk.fair, hair: [34, 24, 18], hairStyle: 'mohawk', shirt: [60, 70, 90], pants: [38, 44, 60], shoes: [40, 30, 24], height: 1.03, bulk: 1.12, eye: [70, 50, 34] },
        rebecca: { skin: sk.pale, hair: [66, 42, 30], hairStyle: 'long', shirt: [150, 150, 154], pants: [60, 80, 120], shoes: [70, 48, 34], apron: [226, 168, 40], height: .93, bulk: .9, eye: [88, 56, 36] },
        thief: { skin: sk.tan, hair: [30, 30, 32], hairStyle: 'short', shirt: [40, 40, 48], pants: [30, 30, 34], shoes: [20, 20, 22], mask: [20, 20, 24], height: 1.0, bulk: .98, eye: [30, 24, 20] },
        robber: { skin: sk.pale, hair: [30, 30, 32], hairStyle: 'bald', shirt: [90, 30, 30], pants: [30, 30, 36], shoes: [18, 18, 20], mask: [16, 16, 18], height: 1.06, bulk: 1.15, eye: [40, 40, 40] },
        soldier: { skin: sk.tan, hair: [40, 34, 30], hairStyle: 'short', shirt: [84, 104, 70], pants: [70, 88, 60], shoes: [36, 32, 28], helmet: [80, 98, 66], height: 1.04, bulk: 1.18, eye: [60, 44, 30] },
        elite: { skin: [96, 120, 150], hair: [30, 40, 60], hairStyle: 'bald', shirt: [70, 90, 160], pants: [60, 76, 140], shoes: [30, 36, 70], helmet: [90, 110, 190], height: 1.22, bulk: 1.3, eye: [240, 200, 60] },
        hobo: { skin: sk.fair, hair: [120, 110, 100], hairStyle: 'long', shirt: [96, 84, 70], pants: [70, 70, 62], shoes: [52, 44, 36], jacket: [110, 92, 70], beanie: [90, 40, 40], beard: [112, 104, 96], stubble: true, height: .98, bulk: 1.08, eye: [60, 44, 30] },
        dealer: { skin: sk.tan, hair: [26, 24, 24], hairStyle: 'crewcut', shirt: [30, 30, 34], pants: [28, 28, 32], shoes: [14, 14, 16], jacket: [74, 62, 48], coat: [74, 62, 48], sunglasses: true, stubble: true, height: 1.07, bulk: 1.12, eye: [30, 24, 20] },
        grunt: { skin: [190, 110, 70], hair: [40, 30, 30], hairStyle: 'bald', shirt: [200, 120, 50], pants: [160, 90, 40], shoes: [60, 40, 30], helmet: [210, 130, 50], height: .72, bulk: 1.3, eye: [30, 20, 20] }
    };
    const CUST_SKIN = [sk.tan, sk.brown, sk.pale, sk.fair, sk.dark], CUST_HAIR = [[24, 18, 14], [70, 44, 28], [150, 110, 60], [40, 40, 44], [190, 190, 195], [120, 50, 30]], CUST_SHIRT = [[200, 60, 60], [60, 130, 200], [80, 170, 90], [220, 180, 60], [150, 90, 180], [230, 230, 230], [60, 60, 70], [240, 130, 60]], CUST_PANTS = [[50, 70, 120], [60, 60, 66], [120, 100, 70], [30, 30, 36], [90, 110, 150]];
    Anim.randomStyle = seed => { const r = rngOf(seed * 7 + 3), pick = a => a[Math.floor(r() * a.length)]; return { skin: pick(CUST_SKIN), hair: pick(CUST_HAIR), hairStyle: pick(['short', 'short', 'long', 'bun', 'curly', 'bald', 'ponytail']), shirt: pick(CUST_SHIRT), pants: pick(CUST_PANTS), shoes: [40, 34, 30], glasses: r() < .2, stubble: r() < .2, height: .9 + r() * .2, bulk: .85 + r() * .4, eye: [60, 44, 30] }; };

    /* ------------------------------------------------------------------ actor */
    Anim.actor = (style, seed) => {
        const rnd = rngOf(seed || 1), a = {
            style: Object.assign({}, style || Anim.STYLES.austin), x: 0, y: 0, z: 0, yaw: 0, speed: 0, grounded: true, vy: 0, mood: 'onduty', energy: 1, ctx: 'onduty',
            held: null, look: null, layers: [], still: 0, phase: 0, t: 0, blink: 2 + rnd() * 3, blinkT: 0, idleCd: {}, idleClip: null, headYaw: 0, headPitch: 0, crouch: 0, aim: false, carry: false, sneak: false, state: null, pose: Object.assign({}, NEUTRAL), rnd, sway: rnd() * 6
        };
        a.play = (name, o) => { const c = LIB[name]; if (!c) throw new Error('unknown animation: ' + name); o = o || {}; const mask = o.mask || c.mask; a.layers = a.layers.filter(l => !(l.name === name) && !(l.mask === mask && !l.idle && !l.loop && o.replace !== false)); a.layers.push({ name, clip: c, t: 0, speed: o.speed || 1, w: 0, mask, loop: o.loop != null ? o.loop : c.loop, hold: o.hold != null ? o.hold : c.hold, fade: o.fade || .12, idle: !!o.idle, repeat: o.repeat || 1, stopping: false, done: false, onDone: o.onDone }); return a; };
        a.stop = (name, fade) => { for (const l of a.layers) if (!name || l.name === name) { l.stopping = true; l.outFade = fade || .15; } return a; };
        a.playing = name => a.layers.some(l => l.name === name && !l.stopping && !l.done);
        a.busy = () => a.layers.some(l => !l.idle && !l.loop && !l.done);          // a one-shot gameplay action is running
        a.update = (dt, st) => {
            st = st || {}; a.t += dt; a.speed = st.speed != null ? st.speed : a.speed; a.grounded = st.grounded != null ? st.grounded : a.grounded; a.vy = st.vy != null ? st.vy : a.vy; if (st.yaw != null) a.yaw = st.yaw;
            if (st.crouch != null) a.crouch = st.crouch; if (st.ctx) a.ctx = st.ctx; if (st.mood) a.mood = st.mood; if (st.energy != null) a.energy = st.energy;
            const sp = a.speed, moving = sp > 0.15, runK = clamp((sp - 2) / 3.5, 0, 1), P = Object.assign({}, NEUTRAL);
            /* locomotion */
            if (!a.grounded && st.air !== false && !a.noAir) { // airborne default pose (games can override by playing jump clips)
                const up = a.vy > 0; P.lLp = up ? .5 : .25; P.lLk = up ? .9 : .5; P.lRp = up ? -.2 : -.3; P.lRk = up ? .3 : .3; P.aLp = up ? 2.2 : 1.9; P.aRp = up ? 1.5 : 1.9; P.aLr = P.aRr = .5; P.lean = up ? .08 : 0;
            } else if (moving) {
                const stride = lerp(1.35, 2.1, runK), freq = sp / stride; a.phase += dt * freq * Math.PI * 2; const ph = a.phase, A = clamp(.22 + .2 * sp, .25, 1.15), sneak = a.sneak || a.crouch > .3 ? 1 : 0;
                const sw = Math.sin(ph), cw = Math.cos(ph), kA = .35 + .8 * A + sneak * .5;
                P.lLp = sw * A + sneak * .35; P.lRp = -sw * A + sneak * .35; P.lLk = .12 + kA * Math.max(0, cw) + sneak * .6; P.lRk = .12 + kA * Math.max(0, -cw) + sneak * .6;
                P.aLp = -sw * A * .9; P.aRp = sw * A * .9; P.aLe = .2 + runK * 1.1 + Math.max(0, -sw) * .3; P.aRe = .2 + runK * 1.1 + Math.max(0, sw) * .3; P.aLr = .1; P.aRr = .1;
                P.y = -(.012 + .035 * A) * Math.abs(cw) * (1 + runK) - .015 * runK - sneak * .22; P.lean = .04 + .27 * runK + sneak * .22; P.twist = sw * (.1 + .12 * runK); P.hipTwist = -sw * .08; P.roll = cw * .02;
            } else { a.phase += 0; }
            if (a.crouch > .3 && !moving) { P.y = -.4 * a.crouch; P.lLp = 1.2 * a.crouch; P.lRp = 1.05 * a.crouch; P.lLk = 2.1 * a.crouch; P.lRk = 1.95 * a.crouch; P.lean = .25 * a.crouch; }
            /* mood + tiredness posture, breathing, weight sway (always on: nobody stands like a statue) */
            const tired = clamp(1 - a.energy, 0, 1), droop = (a.mood === 'tired' ? .6 : 0) + tired * .5 + (a.mood === 'sad' ? .5 : 0);
            P.lean += droop * .1 * (moving ? .4 : 1); P.hp += droop * .16;
            if (a.mood === 'happy') { P.smile += .6; P.hp -= .03; } else if (a.mood === 'angry') { P.brow -= .6; P.smile -= .2; P.aLr += .1; P.aRr += .1; } else if (a.mood === 'scared') { P.brow += .6; P.eye = 1.2; P.jaw += .1; P.lean -= .05; } else if (a.mood === 'impatient') { P.brow -= .25; }
            const br = Math.sin(a.t * 1.7 + a.sway) * .5 + .5; P.lean += br * .018 * (moving ? .3 : 1); P.aLr += br * .02; P.aRr += br * .02;
            if (!moving) { P.roll += Math.sin(a.t * .35 + a.sway) * .012; P.hipTwist += Math.sin(a.t * .27 + a.sway) * .02; P.y -= (Math.sin(a.t * .35 + a.sway) * .5 + .5) * .006; }
            /* idle manager: only when still, nothing else running */
            const busy = a.layers.some(l => !l.idle && !l.done && !l.stopping && !l.loop && !l.hold), holding = a.layers.some(l => !l.idle && !l.done && !l.stopping);
            if (!moving && a.grounded && !busy && !a.noIdle) a.still += dt; else { a.still = 0; if (a.idleClip) { a.stop(a.idleClip, .2); a.idleClip = null; } }
            if (a.idleClip && !a.playing(a.idleClip)) a.idleClip = null;
            if (!a.idleClip && a.still > 1.2 && !holding) {
                const cands = []; let tot = 0;
                for (const e of Anim.IDLES) { if (a.still < e.still || (a.idleCd[e.clip] || 0) > a.t) continue; if (a.near && e.near && a.near !== e.near) continue; if (e.near && !a.near) continue; let w = e.w * (e.ctx.indexOf('*') >= 0 ? 1 : (e.ctx.indexOf(a.ctx) >= 0 ? 2.2 : (e.ctx.indexOf(a.mood) >= 0 ? 1.8 : .25))); if (tired > .5 && (e.clip === 'yawn' || e.clip === 'stretch' || e.clip === 'rub_neck')) w *= 2.5; if (w > 0) { cands.push([e, w]); tot += w; } }
                if (cands.length && a.rnd() < dt * 1.4) { let r = a.rnd() * tot, pick = cands[0][0]; for (const c of cands) { r -= c[1]; if (r <= 0) { pick = c[0]; break; } } const c = LIB[pick.clip], rep = c.repeat ? Math.round(lerp(c.repeat[0], c.repeat[1], a.rnd())) : 1; a.play(pick.clip, { idle: true, repeat: rep, fade: .25 }); a.idleClip = pick.clip; a.idleCd[pick.clip] = a.t + pick.cd * (.7 + a.rnd() * .6); a.lastIdle = pick.clip; (a.idleLog = a.idleLog || []).push(pick.clip); }
            }
            /* clip layers */
            for (const l of a.layers) {
                const dur = l.clip.dur / (l.speed || 1); l.t += dt / dur;
                if (l.stopping) { l.w -= dt / (l.outFade || .15); if (l.w <= 0) l.done = true; }
                else if (l.t >= 1 && !l.loop) { if (l.repeat > 1) { l.repeat--; l.t = 0; } else if (l.hold) { l.t = 1; } else { l.w -= dt / .18; if (l.w <= 0) { l.done = true; if (l.onDone) l.onDone(a, l.name); } } }
                else l.w = Math.min(1, l.w + dt / (l.fade || .12));
                if (l.loop && l.t >= 1) l.t -= 1;
                if (l.done) continue;
                const s = Anim.sample(l.clip, clamp(l.t, 0, 1)); let wgt = l.w; if (l.t >= .82 && !l.loop && !l.hold && !l.stopping) wgt = Math.min(wgt, (1 - l.t) / .18 * 1);
                // while moving, walking legs win over idle/upper clips' legs
                const keys = MASKS[l.mask] || FULL; for (const j of keys) { if (moving && l.mask === 'full' && LOWER.indexOf(j) >= 0 && !l.clip.keepLegs && (l.name === 'jump' ? false : false)) continue; P[j] = lerp(P[j], s[j], clamp(wgt, 0, 1)); }
            }
            a.layers = a.layers.filter(l => !l.done);
            /* carry / aim sustained arm poses ride on the arms while walking */
            if (a.carry && !a.playing('carry_box')) { a.play('carry_box', { fade: .2 }); a.layers[a.layers.length - 1].auto = true; } else if (!a.carry) for (const l of a.layers) if (l.auto && l.name === 'carry_box' && !l.stopping) a.stop('carry_box');
            if (a.aim && !a.playing('aim_rifle')) { a.play('aim_rifle', { fade: .15 }); a.layers[a.layers.length - 1].auto = true; } else if (!a.aim) for (const l of a.layers) if (l.auto && l.name === 'aim_rifle' && !l.stopping) a.stop('aim_rifle');
            /* look-at (head follows a target with a spring, clamped), blink */
            let ty = 0, tp = 0;
            if (a.look) { const dx = a.look.x - a.x, dz = a.look.z - a.z, dy = (a.look.y == null ? 1.5 : a.look.y) - (a.y + 1.6 * (a.style.height || 1)); let rel = Math.atan2(dx, dz) - a.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel)); ty = clamp(rel, -1.0, 1.0); tp = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -.5, .5); }
            const sprK = 9 * dt; a.headYaw += (ty - a.headYaw) * Math.min(1, sprK); a.headPitch += (tp - a.headPitch) * Math.min(1, sprK); P.hy += a.headYaw; P.hp += a.headPitch;
            a.blink -= dt; if (a.blink <= 0) { a.blinkT = .14; a.blink = 2 + a.rnd() * 4; } if (a.blinkT > 0) { a.blinkT -= dt; P.eye *= .05; }
            a.pose = P; return a;
        };
        return a;
    };

    /* ------------------------------------------------------------------ forward kinematics */
    const mmul = (A, B) => { const o = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]); return o; };
    const mv = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
    const RX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }, RY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }, RZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
    const rxv = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c - v[2] * s, -v[1] * s + v[2] * c]; };
    const limbDir = (p, r, side) => { const v = rxv([0, -1, 0], p), c = Math.cos(r), sn = Math.sin(r) * side; return [v[0] * c - v[1] * sn, v[0] * sn + v[1] * c, v[2]]; };
    Anim.skeleton = a => {
        const P = a.pose, S = a.style.height || 1, B = a.style.bulk || 1, hipH = .95 * S, yawM = RY(a.yaw + P.spin), flipM = RX(-P.flip);
        const base = mmul(yawM, flipM), H = [a.x, a.y + hipH + P.y * S, a.z]; // flip about the hip pivot
        const hipM = mmul(base, RY(P.hipTwist)), torso = mmul(mmul(base, RZ(P.roll)), mmul(RY(P.twist), RX(-P.lean)));
        const headM = mmul(torso, mmul(RZ(P.hr), mmul(RX(P.hp), RY(P.hy))));
        const add = (o, v) => [o[0] + v[0], o[1] + v[1], o[2] + v[2]], T = (M, v, o) => add(o || H, mv(M, v));
        const J = { H, base, hipM, torso, headM, S, B };
        J.chest = T(torso, [0, .32 * S, 0]); J.neck = T(torso, [0, .57 * S, 0]); J.head = add(J.neck, mv(headM, [0, .13 * S, .012 * S]));
        const sh = (side) => T(torso, [side * .205 * S * Math.sqrt(B), .5 * S, 0]);
        J.shL = sh(-1); J.shR = sh(1);
        const arm = (shp, side, p, r, e) => { const ua = .29 * S, fa = .27 * S, d1 = limbDir(p, r, side), d2 = limbDir(p + e, r * .8, side), m1 = mv(torso, d1), m2 = mv(torso, d2), el = add(shp, m1.map(v => v * ua)), ha = add(el, m2.map(v => v * fa)); return { el, ha, dir: mv(torso, limbDir(p + e * .5, r * .9, side)) }; };
        const aL = arm(J.shL, -1, P.aLp, P.aLr, P.aLe), aR = arm(J.shR, 1, P.aRp, P.aRr, P.aRe); J.elL = aL.el; J.haL = aL.ha; J.elR = aR.el; J.haR = aR.ha; J.dirR = aR.dir; J.dirL = aL.dir;
        const leg = (side, p, k) => { const hp = T(hipM, [side * .095 * S * Math.sqrt(B), -.02 * S, 0]), t = .46 * S, s = .45 * S, m1 = mv(base, rxv([0, -1, 0], p)), m2 = mv(base, rxv([0, -1, 0], p - k)), kn = add(hp, m1.map(v => v * t)), an = add(kn, m2.map(v => v * s)); const f = mv(base, [0, 0, 1]), toe = add(an, [f[0] * .2 * S, -.035 * S, f[2] * .2 * S]), heel = add(an, [-f[0] * .045 * S, -.045 * S, -f[2] * .045 * S]); return { hp, kn, an, toe, heel }; };
        const lL = leg(-1, P.lLp, P.lLk), lR = leg(1, P.lRp, P.lRk); J.hpL = lL.hp; J.knL = lL.kn; J.anL = lL.an; J.toeL = lL.toe; J.heelL = lL.heel; J.hpR = lR.hp; J.knR = lR.kn; J.anR = lR.an; J.toeR = lR.toe; J.heelR = lR.heel;
        J.fwd = mv(torso, [0, 0, 1]); J.right = mv(torso, [1, 0, 0]); J.up = mv(torso, [0, 1, 0]); J.eye = add(J.head, mv(headM, [0, .015 * S, .08 * S]));
        // lowest foot (for grounding checks)
        J.footY = Math.min(J.heelL[1], J.toeL[1], J.heelR[1], J.toeR[1]);
        return J;
    };

    /* ------------------------------------------------------------------ drawing */
    const ell = (R, M, c, rx, ry, rz, col, lat, lon, alpha) => { // oriented ellipsoid, smooth shaded
        lat = lat || 4; lon = lon || 8; const g = [];
        for (let i = 0; i <= lat; i++) { const th = i / lat * Math.PI, row = []; for (let j = 0; j < lon; j++) { const ph = j / lon * Math.PI * 2, nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph), lp = mv(M, [nx * rx, ny * ry, nz * rz]), ln = mv(M, [nx / Math.max(rx, .01), ny / Math.max(ry, .01), nz / Math.max(rz, .01)]), l = Math.hypot(ln[0], ln[1], ln[2]) || 1; row.push({ p: [c[0] + lp[0], c[1] + lp[1], c[2] + lp[2]], n: [ln[0] / l, ln[1] / l, ln[2] / l] }); } g.push(row); }
        for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) { const j2 = (j + 1) % lon, a = g[i][j], b = g[i][j2], cc = g[i + 1][j2], d = g[i + 1][j]; if (i > 0) R.tri(a.p, cc.p, b.p, col, a.n, cc.n, b.n, alpha); if (i < lat - 1) R.tri(a.p, d.p, cc.p, col, a.n, d.n, cc.n, alpha); }
    };
    Anim.ellipsoid = ell;
    const darker = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
    Anim.draw = (R, a, opt) => {
        opt = opt || {}; const J = Anim.skeleton(a), st = a.style, S = J.S, B = J.B, P = a.pose, cam = R.cam, dist = Math.hypot(a.x - cam.x, a.z - cam.z);
        const lod = opt.lod != null ? opt.lod : dist < 14 ? 0 : dist < 38 ? 1 : 2, skin = st.skin, shirt = st.shirt, pants = st.pants, I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        const shirtLo = st.jacket || shirt, sleeve = st.jacket || shirt;
        if (!opt.noShadow) R.shadow(a.x, a.floor != null ? a.floor : a.y, a.z, .38 * S * B, a.y > (a.floor || 0) + .5 ? .22 : .38);
        const sd = lod === 0 ? 6 : 5;
        // legs
        const legs = [['L', J.hpL, J.knL, J.anL, J.heelL, J.toeL], ['R', J.hpR, J.knR, J.anR, J.heelR, J.toeR]];
        for (const l of legs) { R.limb(l[1], l[2], .075 * S * B, .058 * S * B, pants, sd); R.limb(l[2], l[3], .058 * S * B, .044 * S * B, pants, sd); R.limb(l[4], l[5], .052 * S, .05 * S, st.shoes, 5); }
        // pelvis, belly, chest (ellipsoids on the torso frame)
        const hipC = [J.H[0], J.H[1] + .02 * S, J.H[2]];
        ell(R, J.hipM, hipC, .165 * S * B, .11 * S, .115 * S * B, pants, 3, 8);
        const bel = [J.H[0] + J.up[0] * .17 * S, J.H[1] + J.up[1] * .17 * S, J.H[2] + J.up[2] * .17 * S];
        ell(R, J.torso, bel, .15 * S * B, .15 * S, .105 * S * B, shirt, 3, 8);
        const chc = [J.H[0] + J.up[0] * .38 * S, J.H[1] + J.up[1] * .38 * S, J.H[2] + J.up[2] * .38 * S];
        ell(R, J.torso, chc, .19 * S * Math.sqrt(B), .16 * S, .115 * S * B, st.jacket || shirt, 4, 9);
        if (st.coat) { const km = [(J.knL[0] + J.knR[0]) / 2, (J.knL[1] + J.knR[1]) / 2 + .1 * S, (J.knL[2] + J.knR[2]) / 2]; R.limb([hipC[0] + J.up[0] * .06 * S, hipC[1] + J.up[1] * .06 * S, hipC[2] + J.up[2] * .06 * S], km, .205 * S * B, .215 * S * B, st.coat, 8); const f2 = J.fwd; R.limb([hipC[0] + f2[0] * .15 * S * B, hipC[1] + .1 * S, hipC[2] + f2[2] * .15 * S * B], [km[0] + f2[0] * .16 * S * B, km[1], km[2] + f2[2] * .16 * S * B], .01, .01, darker(st.coat, .6), 4, false); }
        if (st.apron) { const f = J.fwd, ac = [bel[0] + f[0] * .098 * S * B, bel[1] + f[1] * .098 * S * B - .03 * S, bel[2] + f[2] * .098 * S * B]; ell(R, J.torso, ac, .13 * S * B, .21 * S, .02 * S, st.apron, 3, 8); }
        if (st.helmet || st.vest) { const f = J.fwd; ell(R, J.torso, [chc[0] + f[0] * .012, chc[1], chc[2] + f[2] * .012], .2 * S * Math.sqrt(B), .17 * S, .125 * S * B, darker(st.helmet || shirt, .8), 3, 8); }
        // neck + arms
        R.limb([J.neck[0] - J.up[0] * .05 * S, J.neck[1] - J.up[1] * .05 * S, J.neck[2] - J.up[2] * .05 * S], [J.neck[0] + J.up[0] * .06 * S, J.neck[1] + J.up[1] * .06 * S, J.neck[2] + J.up[2] * .06 * S], .05 * S, .045 * S, skin, 5);
        const arms = [[J.shL, J.elL, J.haL], [J.shR, J.elR, J.haR]];
        for (const r of arms) { ell(R, I, r[0], .062 * S * Math.sqrt(B), .062 * S, .062 * S, sleeve, 3, 6); R.limb(r[0], r[1], .056 * S * B, .045 * S * B, sleeve, sd); R.limb(r[1], r[2], .045 * S * B, .036 * S, st.jacket ? sleeve : skin, sd); ell(R, I, r[2], .04 * S, .045 * S, .04 * S, skin, 3, 6); }
        // held items
        if (a.held) drawHeld(R, a, J);
        // head
        const hm = J.headM, hc = J.head, hs = S;
        ell(R, hm, hc, .095 * hs, .115 * hs, .105 * hs, skin, lod === 2 ? 3 : 5, lod === 2 ? 6 : 10);
        if (lod < 2) {
            const hp = (x, y, z) => { const v = mv(hm, [x * hs, y * hs, z * hs]); return [hc[0] + v[0], hc[1] + v[1], hc[2] + v[2]]; };
            ell(R, hm, hp(0, -.06, .018), .082 * hs, .06 * hs, .09 * hs, st.stubble ? N3.mix(skin, [30, 24, 20], .22) : skin, 3, 8); // jaw
            if (st.mask) { ell(R, hm, hp(0, 0, .005), .099 * hs, .12 * hs, .109 * hs, st.mask, 4, 9); ell(R, hm, hp(0, .018, .085), .075 * hs, .02 * hs, .03 * hs, skin, 3, 6); }
            const hairStyle = st.hair && st.hairStyle !== 'bald' ? st.hairStyle : null, hair = st.hair;
            // hair
            if (hairStyle && !st.helmet && !st.mask) {
                if (hairStyle !== 'mohawk') ell(R, hm, hp(0, .045, -.012), .101 * hs, .082 * hs, .112 * hs, hair, 3, 9);
                if (hairStyle === 'bun') ell(R, hm, hp(0, .165, -.03), .042 * hs, .042 * hs, .042 * hs, hair, 3, 7);
                if (hairStyle === 'long') { ell(R, hm, hp(0, -.07, -.075), .105 * hs, .19 * hs, .05 * hs, hair, 3, 8); ell(R, hm, hp(-.09, -.02, -.02), .018 * hs, .11 * hs, .06 * hs, hair, 3, 6); ell(R, hm, hp(.09, -.02, -.02), .018 * hs, .11 * hs, .06 * hs, hair, 3, 6); }
                if (hairStyle === 'ponytail') R.limb(hp(0, .02, -.1), hp(0, -.2, -.15), .03 * hs, .02 * hs, hair, 5);
                if (hairStyle === 'curly') for (let i = 0; i < 9; i++) { const t = i / 9 * Math.PI * 2; ell(R, I, hp(Math.cos(t) * .085, .06 + Math.sin(t * 2) * .02, Math.sin(t) * .09 - .02), .03 * hs, .03 * hs, .03 * hs, hair, 2, 5); }
                if (hairStyle === 'mohawk') { ell(R, hm, hp(0, .035, -.012), .098 * hs, .07 * hs, .108 * hs, darker(skin, .75), 3, 8); ell(R, hm, hp(0, .095, -.02), .02 * hs, .055 * hs, .1 * hs, hair, 3, 6); R.limb(hp(0, .08, -.09), hp(0, -.1, -.17), .022 * hs, .014 * hs, hair, 4); }
            }
            if (st.helmet) { ell(R, hm, hp(0, .035, -.005), .108 * hs, .098 * hs, .118 * hs, st.helmet, 4, 9); R.box(hc[0], hc[1], hc[2], 0, 0, 0, st.helmet); }
            if (st.beanie) { ell(R, hm, hp(0, .065, -.008), .107 * hs, .075 * hs, .117 * hs, st.beanie, 3, 9); R.limb(hp(-.1, .03, 0), hp(.1, .03, 0), .008 * hs, .008 * hs, darker(st.beanie, .7), 3, false); }
            if (st.beard) ell(R, hm, hp(0, -.085, .03), .075 * hs, .065 * hs, .08 * hs, st.beard, 3, 8);
            if (hairStyle === 'crewcut') ell(R, hm, hp(0, .085, 0), .09 * hs, .02 * hs, .1 * hs, hair, 3, 8);
            if (st.cap) { ell(R, hm, hp(0, .05, -.008), .104 * hs, .075 * hs, .114 * hs, st.cap, 3, 9); R.limb(hp(0, .045, .08), hp(0, .02, .17), .06 * hs, .05 * hs, st.cap, 4); }
            if (lod === 0) {
                const eyeO = P.eye, blink = clamp(eyeO, .06, 1.2), ec = st.eye || [50, 36, 26];
                for (const sx of [-1, 1]) {
                    ell(R, hm, hp(sx * .04, .022, .088), .02 * hs, .0135 * hs * blink, .012 * hs, [236, 232, 226], 2, 7);
                    if (blink > .2) ell(R, hm, hp(sx * .04, .022, .098), .0095 * hs, .0095 * hs * Math.min(1, blink), .006 * hs, ec, 2, 6);
                    const by = .05 + P.brow * .012, tilt = -P.brow * .008; R.limb(hp(sx * .06, by + (sx < 0 ? tilt : -tilt) * -1, .084), hp(sx * .02, by + (sx < 0 ? -tilt : tilt) * -1 + (P.brow < 0 ? -.008 * sx * sx : 0), .092), .0065 * hs, .0065 * hs, st.hair || [30, 24, 20], 4, false);
                    ell(R, hm, hp(sx * .1, 0, 0), .012 * hs, .028 * hs, .02 * hs, skin, 2, 6);
                }
                ell(R, hm, hp(0, -.012, .102), .014 * hs, .022 * hs, .02 * hs, darker(skin, .92), 3, 6); // nose
                if (st.sunglasses) { const dk = [8, 8, 12]; for (const sx of [-1, 1]) { const cx = sx * .042, cy = .022, w = .032, h = .024; R.quad(hp(cx - w, cy - h, .112), hp(cx + w, cy - h, .112), hp(cx + w, cy + h, .112), hp(cx - w, cy + h, .112), dk, 1); } R.limb(hp(-.01, .026, .113), hp(.01, .026, .113), .004 * hs, .004 * hs, dk, 3, false); R.limb(hp(-.074, .026, .108), hp(-.099, .02, .04), .004 * hs, .004 * hs, dk, 3, false); R.limb(hp(.074, .026, .108), hp(.099, .02, .04), .004 * hs, .004 * hs, dk, 3, false); }
                if (st.mustache) ell(R, hm, hp(0, -.04, .098), .035 * hs, .008 * hs, .014 * hs, st.hair || [30, 24, 20], 2, 7);
                const sm = P.smile, jw = P.jaw, my = -.068 - jw * .02;
                if (jw > .08) ell(R, hm, hp(0, my, .095), .03 * hs, (.006 + jw * .02) * hs, .01 * hs, [70, 24, 28], 2, 7);
                else R.limb(hp(-.03, my + sm * .008, .097), hp(0, my - sm * .004, .102), .005 * hs, .005 * hs, [120, 56, 56], 4, false), R.limb(hp(0, my - sm * .004, .102), hp(.03, my + sm * .008, .097), .005 * hs, .005 * hs, [120, 56, 56], 4, false);
                if (st.glasses) { const gc = [30, 30, 34]; for (const sx of [-1, 1]) { const cx = sx * .04, cy = .022, w = .027, h = .022; const q = [hp(cx - w, cy - h, .108), hp(cx + w, cy - h, .108), hp(cx + w, cy + h, .108), hp(cx - w, cy + h, .108)]; for (let i = 0; i < 4; i++) R.limb(q[i], q[(i + 1) % 4], .0035 * hs, .0035 * hs, gc, 3, false); R.quad(q[0], q[1], q[2], q[3], [160, 190, 210], .18); } R.limb(hp(-.013, .026, .108), hp(.013, .026, .108), .0035 * hs, .0035 * hs, gc, 3, false); }
            }
        }
        return J;
    };
    const drawHeld = (R, a, J) => {
        const h = a.held, S = J.S; const mid = [(J.haL[0] + J.haR[0]) / 2, (J.haL[1] + J.haR[1]) / 2, (J.haL[2] + J.haR[2]) / 2];
        if (h.kind === 'box') { R.box(mid[0] + J.fwd[0] * .1 * S, mid[1] - .08 * S, mid[2] + J.fwd[2] * .1 * S, .34, .26, .3, h.col || [190, 150, 90], a.yaw); }
        else if (h.kind === 'item') { R.box(J.haR[0], J.haR[1] - .05, J.haR[2], .08, .12, .06, h.col || [220, 80, 80], a.yaw); }
        else if (h.kind === 'bag') { R.box(J.haR[0], J.haR[1] - .28, J.haR[2], .22, .26, .14, h.col || [200, 170, 110], a.yaw); }
        else if (h.kind === 'cash') { R.box(J.haR[0], J.haR[1], J.haR[2], .1, .015, .06, [120, 190, 120], a.yaw); }
        else if (h.kind === 'phone') { R.box(J.haR[0], J.haR[1], J.haR[2], .05, .09, .01, [20, 20, 24], a.yaw); }
        else if (h.kind === 'rifle' || h.kind === 'pistol') {
            const d = J.dirR, len = h.kind === 'rifle' ? .95 : .26, back = h.kind === 'rifle' ? .3 : .05, c = h.col || [50, 52, 56], p0 = [J.haR[0] - d[0] * back, J.haR[1] - d[1] * back, J.haR[2] - d[2] * back], p1 = [p0[0] + d[0] * len, p0[1] + d[1] * len, p0[2] + d[2] * len];
            R.limb(p0, p1, .035, .028, c, 5); if (h.kind === 'rifle') { R.limb(p0, [p0[0] - d[0] * .12, p0[1] - d[1] * .12 - .04, p0[2] - d[2] * .12], .03, .03, darker(c, .8), 4); R.limb([p0[0] + d[0] * .3, p0[1] + d[1] * .3, p0[2] + d[2] * .3], [p0[0] + d[0] * .3, p0[1] + d[1] * .3 - .13, p0[2] + d[2] * .3], .025, .02, darker(c, .7), 4); }
            a.muzzle = p1;
        } else if (h.kind === 'bat') { const d = J.dirR; R.limb([J.haR[0] - d[0] * .08, J.haR[1] - d[1] * .08 + .02, J.haR[2] - d[2] * .08], [J.haR[0] + d[0] * .62, J.haR[1] + d[1] * .62 + .06, J.haR[2] + d[2] * .62], .042, .022, h.col || [190, 150, 90], 5); }
        else if (h.kind === 'taser') { const d = J.dirR; R.limb([J.haR[0], J.haR[1], J.haR[2]], [J.haR[0] + d[0] * .2, J.haR[1] + d[1] * .2, J.haR[2] + d[2] * .2], .035, .03, [240, 200, 40], 5); if (h.on) R.limb([J.haR[0] + d[0] * .2, J.haR[1] + d[1] * .2, J.haR[2] + d[2] * .2], [J.haR[0] + d[0] * .32, J.haR[1] + d[1] * .32 + .02, J.haR[2] + d[2] * .32], .01, .004, [140, 220, 255], 3); }
        else if (h.kind === 'spray') { R.limb([J.haR[0], J.haR[1] - .05, J.haR[2]], [J.haR[0], J.haR[1] + .1, J.haR[2]], .028, .026, [200, 50, 50], 5); }
        else if (h.kind === 'shotgun') { const d = J.dirR, c = [60, 50, 44], p0 = [J.haR[0] - d[0] * .25, J.haR[1] - d[1] * .25, J.haR[2] - d[2] * .25], p1 = [p0[0] + d[0] * .9, p0[1] + d[1] * .9, p0[2] + d[2] * .9]; R.limb(p0, p1, .036, .03, [40, 42, 46], 5); R.limb(p0, [p0[0] - d[0] * .18, p0[1] - d[1] * .18 - .05, p0[2] - d[2] * .18], .04, .03, c, 4); a.muzzle = p1; }
        else if (h.kind === 'broom') { R.limb([J.haR[0], J.haR[1] + .3, J.haR[2]], [J.haR[0] + J.fwd[0] * .3, J.haR[1] - .8, J.haR[2] + J.fwd[2] * .3], .015, .015, [150, 110, 60], 4); R.box(J.haR[0] + J.fwd[0] * .3, J.haR[1] - .85, J.haR[2] + J.fwd[2] * .3, .3, .08, .06, [200, 170, 90], a.yaw); }
    };
    if (typeof module !== 'undefined') module.exports = Anim; else root.NRAnim = Anim;
})(typeof window !== 'undefined' ? window : globalThis);

/* NOTAREAL TES reader: reads a Morrowind-format plugin/master (.esm / .esp) fully offline and boils it down to design NUMBERS
 * (weapon and armour stats, spell and effect costs, classes, races, factions, skills, creatures, levelled lists, weather, game constants).
 * No dialogue text, book text, models or textures are kept. The result feeds the RPG tools (Berea, Frontier) as a real-game reference. */
(function (root) {
    'use strict';
    const T = {};
    const u8 = (d, o) => d[o], u16 = (d, o) => d[o] | d[o + 1] << 8, s32 = (d, o) => d[o] | d[o + 1] << 8 | d[o + 2] << 16 | d[o + 3] << 24, u32 = (d, o) => s32(d, o) >>> 0;
    const f32 = (d, o) => { const v = new DataView(d.buffer, d.byteOffset + o, 4).getFloat32(0, true); return Math.round(v * 1000) / 1000; };
    const str = (d, o, n) => { let s = ''; for (let i = 0; i < n; i++) { const c = d[o + i]; if (!c) break; s += String.fromCharCode(c); } return s; };
    T.ATTR = ['Strength', 'Intelligence', 'Willpower', 'Agility', 'Speed', 'Endurance', 'Personality', 'Luck'];
    T.SPEC = ['Combat', 'Magic', 'Stealth'];
    T.SKILLS = ['Block', 'Armorer', 'Medium Armor', 'Heavy Armor', 'Blunt Weapon', 'Long Blade', 'Axe', 'Spear', 'Athletics', 'Enchant', 'Destruction', 'Alteration', 'Illusion', 'Conjuration', 'Mysticism', 'Restoration', 'Alchemy', 'Unarmored', 'Security', 'Sneak', 'Acrobatics', 'Light Armor', 'Short Blade', 'Marksman', 'Mercantile', 'Speechcraft', 'Hand-to-hand'];
    T.SCHOOLS = ['Alteration', 'Conjuration', 'Destruction', 'Illusion', 'Mysticism', 'Restoration'];
    T.WEAPON_TYPES = ['Short blade', 'Long blade 1h', 'Long blade 2h', 'Blunt 1h', 'Blunt 2h close', 'Blunt 2h wide', 'Spear 2h', 'Axe 1h', 'Axe 2h', 'Bow', 'Crossbow', 'Thrown', 'Arrow', 'Bolt'];
    T.ARMOR_TYPES = ['Helmet', 'Cuirass', 'L pauldron', 'R pauldron', 'Greaves', 'Boots', 'L gauntlet', 'R gauntlet', 'Shield', 'L bracer', 'R bracer'];
    T.WEATHER = ['Clear', 'Cloudy', 'Foggy', 'Overcast', 'Rain', 'Thunder', 'Ash', 'Blight', 'Snow', 'Blizzard'];
    /* split into records -> [{t, flags, subs:[[name, Uint8Array]]}] */
    T.records = d => { const out = []; let o = 0; while (o + 16 <= d.length) { const t = str(d, o, 4), sz = u32(d, o + 4), fl = u32(d, o + 12), body = d.subarray(o + 16, o + 16 + sz), subs = []; let p = 0; while (p + 8 <= body.length) { const n = str(body, p, 4), s = u32(body, p + 4); subs.push([n, body.subarray(p + 8, p + 8 + s)]); p += 8 + s; } out.push({ t, flags: fl, subs }); o += 16 + sz; } return out; };
    const sub = (r, n) => { const s = r.subs.find(x => x[0] === n); return s ? s[1] : null; }, subs = (r, n) => r.subs.filter(x => x[0] === n).map(x => x[1]);
    const idOf = r => { const n = sub(r, 'NAME'); return n ? str(n, 0, n.length) : ''; }, nameOf = r => { const n = sub(r, 'FNAM'); return n ? str(n, 0, n.length) : ''; };
    const effects = r => subs(r, 'ENAM').map(e => [s32(e, 0) & 0xFFFF, e[2] > 127 ? -1 : e[2], e[3] > 127 ? -1 : e[3], s32(e, 4), s32(e, 8), s32(e, 12), s32(e, 16), s32(e, 20)]);   // effect, skill, attr, range, area, duration, magMin, magMax
    T.digest = (d, opts) => {
        opts = opts || {}; const recs = T.records(d), by = {}; for (const r of recs) (by[r.t] = by[r.t] || []).push(r);
        const out = { source: { records: recs.length, counts: {} }, tables: {} }; for (const k of Object.keys(by)) out.source.counts[k] = by[k].length;
        const tb = out.tables, g = k => by[k] || [];
        /* weapons: id, type, weight, value, health, speed, reach, enchant, chop min/max, slash min/max, thrust min/max */
        tb.weapons = g('WEAP').map(r => { const w = sub(r, 'WPDT'); if (!w) return null; return [idOf(r), u16(w, 8), f32(w, 0), u32(w, 4), u16(w, 10), f32(w, 12), f32(w, 16), u16(w, 20), w[22], w[23], w[24], w[25], w[26], w[27]]; }).filter(Boolean);
        tb.armor = g('ARMO').map(r => { const a = sub(r, 'AODT'); if (!a) return null; return [idOf(r), u32(a, 0), f32(a, 4), u32(a, 8), u32(a, 12), u32(a, 16), u32(a, 20)]; }).filter(Boolean);   // id, type, weight, value, health, enchant, rating
        tb.clothing = g('CLOT').length;
        tb.spells = g('SPEL').map(r => { const s = sub(r, 'SPDT'); if (!s) return null; return [idOf(r), u32(s, 0), u32(s, 4), u32(s, 8), effects(r)]; }).filter(Boolean);   // id, type(0 spell,1 ability,2 blight,3 disease,4 curse,5 power), cost, flags, effects
        tb.effects = g('MGEF').map(r => { const m = sub(r, 'MEDT'), i = sub(r, 'INDX'); if (!m || !i) return null; return [s32(i, 0), u32(m, 0), f32(m, 4), u32(m, 8), f32(m, 24), f32(m, 28)]; }).filter(Boolean);   // index, school, baseCost, flags, speed, size
        tb.classes = g('CLAS').map(r => { const c = sub(r, 'CLDT'); if (!c) return null; const sk = []; for (let i = 0; i < 10; i++) sk.push(s32(c, 12 + i * 4)); return [idOf(r), s32(c, 0), s32(c, 4), s32(c, 8), sk, u32(c, 52)]; }).filter(Boolean);   // id, attr1, attr2, specialization, [minor,major]x5, playable
        tb.races = g('RACE').map(r => { const a = sub(r, 'RADT'); if (!a) return null; const sk = [], at = []; for (let i = 0; i < 7; i++) sk.push([s32(a, i * 8), s32(a, i * 8 + 4)]); for (let i = 0; i < 8; i++) at.push([s32(a, 56 + i * 8), s32(a, 60 + i * 8)]); return [idOf(r), sk, at, f32(a, 120), f32(a, 124), f32(a, 128), f32(a, 132), u32(a, 136)]; }).filter(Boolean);
        tb.factions = g('FACT').map(r => { const f = sub(r, 'FADT'); if (!f) return null; const ranks = []; for (let i = 0; i < 10; i++) ranks.push([s32(f, 8 + i * 20), s32(f, 12 + i * 20), s32(f, 16 + i * 20), s32(f, 20 + i * 20), s32(f, 24 + i * 20)]); const fav = []; for (let i = 0; i < 7; i++) fav.push(s32(f, 208 + i * 4)); return [idOf(r), [s32(f, 0), s32(f, 4)], ranks.filter(x => x[0] || x[2] || x[4] || x[1]), fav.filter(x => x >= 0), subs(r, 'ANAM').length]; }).filter(Boolean);
        tb.skills = g('SKIL').map(r => { const s = sub(r, 'SKDT'), i = sub(r, 'INDX'); if (!s || !i) return null; return [s32(i, 0), s32(s, 0), s32(s, 4), f32(s, 8), f32(s, 12), f32(s, 16), f32(s, 20)]; }).filter(Boolean);   // skill, attribute, specialization, use values x4
        tb.birthsigns = g('BSGN').map(r => [idOf(r), subs(r, 'NPCS').length]);
        tb.creatures = g('CREA').map(r => { const n = sub(r, 'NPDT'); if (!n || n.length < 96) return null; const v = []; for (let i = 0; i < 24; i++) v.push(s32(n, i * 4)); return [idOf(r), v.slice(0, 2), v.slice(2, 10), v.slice(10, 17), v.slice(17, 23), v[23], subs(r, 'NPCO').length]; }).filter(Boolean);   // id, [type, level], attrs8, [hp, mp, fatigue, soul, combat, magic, stealth] (6), attacks (min,max x3), gold
        tb.enchant = g('ENCH').map(r => { const e = sub(r, 'ENDT'); return e ? [idOf(r), u32(e, 0), u32(e, 4), u32(e, 8), effects(r).length] : null; }).filter(Boolean);
        tb.potions = g('ALCH').map(r => { const a = sub(r, 'ALDT'); return a ? [idOf(r), f32(a, 0), u32(a, 4), effects(r)] : null; }).filter(Boolean);
        tb.ingredients = g('INGR').map(r => { const a = sub(r, 'IRDT'); if (!a) return null; const e = [], s = [], at = []; for (let i = 0; i < 4; i++) { e.push(s32(a, 8 + i * 4)); s.push(s32(a, 24 + i * 4)); at.push(s32(a, 40 + i * 4)); } return [idOf(r), f32(a, 0), u32(a, 4), e, s, at]; }).filter(Boolean);
        tb.tools = ['APPA', 'LOCK', 'PROB', 'REPA'].map(k => g(k).length);
        tb.levelled = g('LEVI').concat(g('LEVC')).map(r => { const dt = sub(r, 'DATA'), nn = sub(r, 'NNAM'), n = sub(r, 'INDX'); const lv = []; subs(r, 'INTV').forEach(x => lv.push(u16(x, 0))); return [r.t === 'LEVI' ? 'item' : 'creature', idOf(r), dt ? u32(dt, 0) : 0, nn ? nn[0] : 0, n ? s32(n, 0) : 0, lv]; });   // kind, id, flags, chance none, count, levels
        tb.regions = g('REGN').map(r => { const w = sub(r, 'WEAT'); return [idOf(r), w ? Array.from(w).slice(0, 10) : [], subs(r, 'SNAM').length]; });
        const ext = g('CELL').filter(r => { const x = sub(r, 'DATA'); return x && !(u32(x, 0) & 1); }), intr = g('CELL').length - ext.length;
        tb.world = { exteriorCells: ext.length, interiorCells: intr, landscapes: g('LAND').length, dialogTopics: g('DIAL').length, dialogLines: g('INFO').length, scripts: g('SCPT').length, doors: g('DOOR').length, containers: g('CONT').length, statics: g('STAT').length, npcs: g('NPC_').length, creatures: g('CREA').length, books: g('BOOK').length, sounds: g('SOUN').length, lights: g('LIGH').length };
        /* NPC population: level and attribute averages per class, services, gold */
        const cls = {}; for (const r of g('NPC_')) { const n = sub(r, 'NPDT'), c = sub(r, 'CNAM'); if (!n) continue; const k = c ? str(c, 0, c.length) : '?'; const a = cls[k] || (cls[k] = { n: 0, lv: 0, hp: 0, gold: 0, att: new Array(8).fill(0) }); a.n++; if (n.length >= 52) { a.lv += u16(n, 0); for (let i = 0; i < 8; i++) a.att[i] += n[2 + i]; a.hp += u16(n, 38); a.gold += u32(n, 48); } else a.lv += u16(n, 0); }
        tb.npcClasses = Object.keys(cls).map(k => { const a = cls[k]; return [k, a.n, Math.round(a.lv / a.n * 10) / 10, Math.round(a.hp / a.n), Math.round(a.gold / a.n), a.att.map(v => Math.round(v / a.n))]; }).sort((a, b) => b[1] - a[1]).slice(0, 80);
        /* game settings: only the numeric constants (formulas) */
        tb.gmst = {}; for (const r of g('GMST')) { const id = idOf(r), v = sub(r, 'FLTV') || sub(r, 'INTV'); if (v && /^[fi][A-Z]/.test(id)) tb.gmst[id] = sub(r, 'FLTV') ? f32(v, 0) : s32(v, 0); }
        return out;
    };
    /* merge a later plugin over an earlier one by record id (the way the game does) */
    T.merge = (a, b) => { const out = JSON.parse(JSON.stringify(a)); for (const k of ['weapons', 'armor', 'spells', 'classes', 'races', 'factions', 'creatures', 'enchant', 'potions', 'ingredients', 'birthsigns']) { const m = {}; (out.tables[k] || []).forEach(r => { m[r[0]] = r; }); (b.tables[k] || []).forEach(r => { m[r[0]] = r; }); out.tables[k] = Object.values(m); } for (const k of Object.keys(b.tables.gmst || {})) out.tables.gmst[k] = b.tables.gmst[k]; for (const k of Object.keys(b.tables.world)) if (typeof b.tables.world[k] === 'number') out.tables.world[k] += b.tables.world[k]; out.tables.effects = (() => { const m = {}; a.tables.effects.concat(b.tables.effects).forEach(r => { m[r[0]] = r; }); return Object.values(m); })(); return out; };

    /* ---- advice: turn the real numbers into starting values for your own game */
    const quant = (arr, q) => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a[1] - b[1]); return s[Math.min(s.length - 1, Math.floor(q * s.length))][0]; };
    T.weaponAdvice = (ref, type, tier) => { const ws = ref.tables.weapons.filter(w => w[1] === type && w[3] > 0 && !/^(test|debug|_)/.test(w[0])); const w = quant(ws.map(x => [x, x[3]]), Math.max(0, Math.min(.999, tier))); if (!w) return null; const best = Math.max(w[8] + w[9], w[10] + w[11], w[12] + w[13]) / 2; return { example: w[0], type: T.WEAPON_TYPES[type], weight: w[2], value: w[3], health: w[4], speed: w[5], reach: w[6], chop: [w[8], w[9]], slash: [w[10], w[11]], thrust: [w[12], w[13]], bestAvg: best, dps: Math.round(best * w[5] * 10) / 10 }; };
    T.armorAdvice = (ref, type, tier) => { const as = ref.tables.armor.filter(a => a[1] === type && a[3] > 0); const a = quant(as.map(x => [x, x[3]]), Math.max(0, Math.min(.999, tier))); return a ? { example: a[0], type: T.ARMOR_TYPES[type], weight: a[2], value: a[3], health: a[4], rating: a[6] } : null; };
    T.creatureAdvice = (ref, level) => { const cs = ref.tables.creatures.filter(c => c[1][0] === 0 && c[1][1] >= 1).sort((a, b) => Math.abs(a[1][1] - level) - Math.abs(b[1][1] - level)).slice(0, 5); return cs.map(c => ({ example: c[0], level: c[1][1], health: c[3][0], magicka: c[3][1], fatigue: c[3][2], combat: c[3][4], attacks: c[4], attrs: c[2] })); };
    T.spellCost = (ref, fx) => { let total = 0; const fm = {}; ref.tables.effects.forEach(e => { fm[e[0]] = e; }); for (const e of fx) { const m = fm[e[0]]; if (!m) continue; const mag = (e[6] + e[7]) / 2 || 1, dur = Math.max(1, e[5]), area = e[4]; let c = (mag * dur + area) * m[2] / 40; if (e[3] === 2) c *= 1.5; total += c; } return Math.round(total * 10) / 10; };
    T.rankLadder = (ref, n) => { const ls = ref.tables.factions.map(f => f[2].map(r => r[4])).filter(l => l.length >= 5); if (!ls.length) return []; const out = []; for (let i = 0; i < n; i++) { const k = i / Math.max(1, n - 1); let s = 0; for (const l of ls) s += l[Math.min(l.length - 1, Math.round(k * (l.length - 1)))]; out.push(Math.round(s / ls.length)); } return out; };
    T.levelCurve = ref => { const g = ref.tables.gmst; return { skillsPerLevel: g.iLevelupTotal || 10, healthPerEnd: g.fLevelUpHealthEndMult || .1, fatigueBase: g.fFatigueBase || 1.25, fatigueMult: g.fFatigueMult || .5, combatFatigue: g.fCombatInvisoMult || 0 }; };
    T.summary = ref => { const t = ref.tables; return { weaponsByType: T.WEAPON_TYPES.map((n, i) => [n, t.weapons.filter(w => w[1] === i).length]), armorByType: T.ARMOR_TYPES.map((n, i) => [n, t.armor.filter(a => a[1] === i).length]), spellsBySchool: T.SCHOOLS.map((n, i) => [n, t.effects.filter(e => e[1] === i).length]) }; };
    if (typeof module !== 'undefined') module.exports = T; else root.NRTes = T;
})(typeof window !== 'undefined' ? window : globalThis);

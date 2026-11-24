/* nritemaudit.js (v1.7) - Item Audit: proves every item in a game can actually be obtained.
 * A.audit({items:[{name}], sources:[{kind:'shop'|'drop'|'recipe'|'gift'|'quest'|'start'|'forage'|'craft', name, gives:[items], needs:[items]}]})
 * -> {unobtainable:[names], reachable:[names], bySource:{name:[kinds]}, cycles:[names]}.
 * Recipes only count when their ingredients are reachable (so a recipe whose ingredient has no source is reported, like clay/scarecrow in
 * Super Moonlight Holler). A.fromText(text) parses simple lines: "shop General Store: seed, hoe" / "recipe chest = wood x50" / "drop mine: coal, geode". */
(function (root) {
    'use strict';
    const A = {};
    A.audit = (proj) => {
        const names = (proj.items || []).map(i => typeof i === 'string' ? i : i.name);
        const have = new Set(), by = {};
        const note = (n, k) => { (by[n] = by[n] || new Set()).add(k); };
        let changed = true;
        const src = proj.sources || [];
        while (changed) {
            changed = false;
            for (const s of src) {
                if ((s.needs || []).every(n => have.has(n))) for (const g of s.gives || []) { note(g, s.kind); if (!have.has(g)) { have.add(g); changed = true; } }
            }
        }
        const bySource = {}; for (const k in by) bySource[k] = [...by[k]];
        const unobtainable = names.filter(n => !have.has(n));
        const cycles = src.filter(s => (s.needs || []).length && !(s.needs || []).every(n => have.has(n)) && (s.gives || []).some(g => !have.has(g))).map(s => s.name);
        return { total: names.length, reachable: names.filter(n => have.has(n)), unobtainable, bySource, cycles, ok: unobtainable.length === 0 };
    };
    A.fromText = (text) => {
        const items = new Set(), sources = [];
        for (const raw of String(text).split(/\n/)) {
            const l = raw.trim(); if (!l || l[0] === '#') continue;
            let m;
            if ((m = l.match(/^item[s]?\s*:\s*(.+)$/i))) { m[1].split(',').forEach(x => items.add(x.trim())); continue; }
            if ((m = l.match(/^recipe\s+(.+?)\s*=\s*(.+)$/i))) { const needs = m[2].split(/,|\+/).map(x => x.replace(/\s*x\d+\s*$/i, '').trim()).filter(Boolean); sources.push({ kind: 'recipe', name: m[1].trim(), gives: [m[1].trim()], needs }); items.add(m[1].trim()); needs.forEach(n => items.add(n)); continue; }
            if ((m = l.match(/^(shop|drop|gift|quest|start|forage|craft)\s*([^:]*):\s*(.+)$/i))) { const gives = m[3].split(',').map(x => x.trim()).filter(Boolean); sources.push({ kind: m[1].toLowerCase(), name: (m[2] || m[1]).trim(), gives, needs: [] }); gives.forEach(g => items.add(g)); }
        }
        return { items: [...items], sources };
    };
    A.report = r => `${r.total} items: ${r.reachable.length} obtainable, ${r.unobtainable.length} not.` + (r.unobtainable.length ? '\nNo way to get: ' + r.unobtainable.join(', ') + '\nAdd a shop entry, a mine/forage drop, a recipe whose ingredients are obtainable, or an NPC gift.' : '\nEvery item has a source.');
    if (typeof module !== 'undefined') module.exports = A; else root.NRItemAudit = A;
})(typeof window !== 'undefined' ? window : globalThis);

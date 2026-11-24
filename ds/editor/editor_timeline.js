/* Timeline tab (v2.0) - the spine of a game. A video-editor style track: every section of the game is a clip (title, loading, cutscene, dialogue, a level, a race, a 3D open world,
   a wrestling match, a match-3, an arcade room with its own machines...). Drag clips to reorder, pick the music for each section on the music lane, choose how one section
   switches into the next (fade, door, get-in-the-car, portal), branch on win / lose / menu choices / score or time triggers, and (DS only) give the bottom-screen buttons jobs.
   The same list plays in the preview below, in the PC / Xbox timeline page, and orders the levels of small-console ROMs. */
const TLS = { sel: null, ds: false, room: -1, fresh: 0 };
(function css() {
    if (document.getElementById('tlcss')) return; const st = document.createElement('style'); st.id = 'tlcss';
    st.textContent = `.tlwrap{display:flex;gap:12px;align-items:flex-start}.tlpal{width:210px;flex:none;background:var(--panel);border-radius:12px;padding:8px;max-height:calc(100vh - 210px);overflow:auto}
.tlpal h4{margin:8px 0 4px;font-size:12px;color:var(--acc2);text-transform:uppercase;letter-spacing:.07em}.tlpal .it{display:flex;gap:6px;align-items:center;padding:4px 6px;margin:2px 0;border-radius:6px;background:var(--panel2);cursor:grab;font-size:13px;border-left:4px solid #888}.tlpal .it:hover{outline:1px solid var(--acc)}
.tlmain{flex:1;min-width:0}.tltrack{background:#0f0d16;border:1px solid #3d3460;border-radius:10px;padding:8px;overflow-x:auto}.tllane{display:flex;gap:3px;align-items:stretch;margin:3px 0;min-height:30px}.tllabel{position:sticky;left:0;font-size:10px;color:var(--dim);writing-mode:horizontal-tb;width:54px;flex:none;display:flex;align-items:center}
.tlclip{flex:none;border-radius:7px;padding:5px 7px;color:#fff;font-size:12px;cursor:grab;border:2px solid transparent;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-height:46px;display:flex;flex-direction:column;justify-content:center}.tlclip.sel{border-color:#fff;box-shadow:0 0 0 2px var(--acc)}.tlclip small{opacity:.85;font-size:10px}
.tlclip.over{outline:2px dashed #fff}.tlchip{flex:none;border-radius:6px;font-size:10px;padding:3px 6px;background:var(--panel2);color:var(--dim);display:flex;align-items:center;overflow:hidden;white-space:nowrap;cursor:pointer}.tlchip.on{background:#2a5a7a;color:#fff}.tlchip.dim{opacity:.5}
.tlinsp{background:var(--panel);border-radius:12px;padding:10px;margin-top:10px}.tlinsp h3{margin-top:2px}.tlroom{border:2px solid #3d3460;image-rendering:pixelated;cursor:crosshair;background:#111}.tlend{border-left:3px dashed #666;margin:0 4px}`;
    document.head.append(st);
})();
const tlColor = s => NRTimeline.COLORS[(NRTimeline.TYPES[s.type] || {}).group] || '#666';
const tlIcon = s => { const p = NRTimeline.PALETTE.find(x => x.type === s.type && (s.type !== 'arcade' || x.mode === s.mode)); return (p && p.icon) || (NRTimeline.TYPES[s.type] || {}).icon || '▣'; };
function tlSongName(n) { if (n == null) return '↪ keeps playing'; if (n < 0) return '🔇 silence'; const s = (P.songs || [])[n]; return '♪ ' + ((s && (s.name || s.style)) || 'Song ' + (n + 1)); }
function tlCfgFields(def, cfg, after) {
    const row = el('div', { class: 'row wrap' });
    for (const [k, v] of Object.entries(def)) {
        if (Array.isArray(v) || (v && typeof v === 'object')) continue; const cur = cfg[k] == null ? v : cfg[k], nm = k === 'color' ? 'Main colour' : k === 'color2' ? 'Second colour' : k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
        const inp = typeof v === 'number' ? el('input', { type: 'number', step: 'any', value: cur, style: 'width:80px', onchange: e => { cfg[k] = +e.target.value; dirty = true; if (after) after(); } })
            : (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) ? el('input', { type: 'color', value: cur, onchange: e => { cfg[k] = e.target.value; dirty = true; if (after) after(); } })
            : el('input', { value: cur, style: 'width:120px', oninput: e => { cfg[k] = e.target.value.slice(0, 40); dirty = true; } });
        row.append(el('label', {}, nm + ' ', inp));
    }
    return row;
}
function tlTargets(steps, cur, extra) { return [['next', 'next section'], ...(extra || []), ['end', 'end the game'], ...steps.filter(s => s.id !== cur.id).map((s, i) => [s.id, '→ ' + (steps.indexOf(s) + 1) + '. ' + s.title])]; }
function tlSel(opts, val, on, w) { return el('select', { style: w ? 'width:' + w : '', onchange: e => on(e.target.value) }, ...opts.map(([v, n]) => { const o = el('option', { value: v }, n); if (String(v) === String(val)) o.selected = true; return o; })); }

function timelineTab(main) {
    const TL = NRTimeline, steps = TL.get(P), con = P.console || 'pc', box = el('div', { class: 'pane' });
    if (!steps.length && !P.tlTouched && ((P.levels || []).length + (P.cutscenes || []).length + (P.arcade ? 1 : 0))) { steps.push(...TL.fromProject(P)); P.tlTouched = true; }
    const sel = steps.find(s => s.id === TLS.sel) || null; if (!sel) TLS.sel = null;
    const redraw = () => { dirty = true; P.tlTouched = true; renderAll(); }, add = (id, at) => { const s = TL.fromPalette(id); if (!s) return; if (s.type === 'level' && !(P.levels || [])[0]) { notify('Make a level on the Levels tab first, then add it here.'); return; } at = at == null ? steps.length : at; steps.splice(at, 0, s); TLS.sel = s.id; redraw(); };
    box.append(el('h2', {}, '🧭 Timeline'), el('p', { class: 'hint' }, 'Your whole game in order. Drag sections from the left onto the track, drag clips to reorder, click one to edit it. One game can switch genre at every clip: walk around a 3D town, drive (transition), fight, step into an arcade room full of mini games.'));
    const v = TL.validate(P, con);
    box.append(el('div', { class: 'tech' }, el('b', {}, (v.ok ? '✔ Runs on ' : '✖ Problems on ') + con.toUpperCase()), ...v.errors.map(e => el('div', { class: 'bad' }, e)), ...v.warnings.map(e => el('div', { class: 'hint' }, '⚠ ' + e))));

    /* ---- left: the palette of section types, named the way players name them */
    const pal = el('div', { class: 'tlpal' }), items = TL.palette();
    for (const g of TL.GROUPS) { const list = items.filter(p => p.group === g); if (!list.length) continue; pal.append(el('h4', {}, g)); for (const p of list) { const it = el('div', { class: 'it', draggable: 'true', title: (TL.TYPES[p.type] || {}).about || '', style: 'border-left-color:' + TL.COLORS[g], onclick: () => add(p.id, sel ? steps.indexOf(sel) + 1 : null) }, el('span', {}, p.icon || '▣'), el('span', {}, p.label)); it.ondragstart = e => { e.dataTransfer.setData('text/plain', 'pal:' + p.id); }; pal.append(it); } }

    /* ---- the track: clips + music lane + branch lane + (DS) bottom-screen lane */
    const track = el('div', { class: 'tltrack' }), lane = el('div', { class: 'tllane' }), mlane = el('div', { class: 'tllane' }), blane = el('div', { class: 'tllane' });
    lane.append(el('div', { class: 'tllabel' }, 'Sections')); mlane.append(el('div', { class: 'tllabel' }, 'Music')); blane.append(el('div', { class: 'tllabel' }, 'Branches'));
    const widthOf = s => Math.round(96 + Math.min(150, TL.length(s) * .9));
    const drop = (e, at) => { e.preventDefault(); const d = e.dataTransfer.getData('text/plain'); if (d.startsWith('pal:')) add(d.slice(4), at); else if (d.startsWith('clip:')) { const from = +d.slice(5); if (from === at || from + 1 === at) return; const [m] = steps.splice(from, 1); steps.splice(from < at ? at - 1 : at, 0, m); redraw(); } };
    steps.forEach((s, i) => {
        const w = widthOf(s), c = el('div', { class: 'tlclip' + (s.id === TLS.sel ? ' sel' : ''), draggable: 'true', style: `width:${w}px;background:${tlColor(s)}`, title: (TL.TYPES[s.type] || {}).about || '', onclick: () => { TLS.sel = s.id; renderAll(); } },
            el('b', {}, tlIcon(s) + ' ' + (i + 1) + '. ' + s.title), el('small', {}, (s.type === 'arcade' ? ((NRArcade.MODES[s.mode] || {}).name || 'pick a game') : (TL.TYPES[s.type] || {}).label) + (s.transition && s.transition !== 'cut' ? ' · ' + TL.TRANSITIONS[s.transition] : '')));
        c.ondragstart = e => { e.dataTransfer.setData('text/plain', 'clip:' + i); }; c.ondragover = e => { e.preventDefault(); c.classList.add('over'); }; c.ondragleave = () => c.classList.remove('over'); c.ondrop = e => { c.classList.remove('over'); const r = c.getBoundingClientRect(); drop(e, e.clientX > r.left + r.width / 2 ? i + 1 : i); };
        lane.append(c);
        mlane.append(el('div', { class: 'tlchip' + (s.music != null ? ' on' : ' dim'), style: `width:${w}px`, title: 'Click to choose the music for this section', onclick: () => { TLS.sel = s.id; renderAll(); } }, tlSongName(s.music)));
        const br = []; if (s.onWin && s.onWin !== 'next') br.push('win→' + (s.onWin === 'end' ? 'end' : (steps.findIndex(x => x.id === s.onWin) + 1))); if (s.onLose && !['retry', 'next'].includes(s.onLose)) br.push('lose→' + (s.onLose === 'end' || s.onLose === 'skip' ? s.onLose : (steps.findIndex(x => x.id === s.onLose) + 1))); (s.choices || []).forEach(ch => { if (ch.next && ch.next !== 'next') br.push('«' + String(ch.text).slice(0, 6) + '»→' + (ch.next === 'end' ? 'end' : steps.findIndex(x => x.id === ch.next) + 1)); }); (s.triggers || []).forEach(tr => br.push(tr.on + '≥' + tr.value + '→' + (tr.next === 'next' ? '+1' : steps.findIndex(x => x.id === tr.next) + 1))); if (s.needs) br.push('needs ' + s.needs); if (s.sets) br.push('sets ' + s.sets);
        blane.append(el('div', { class: 'tlchip' + (br.length ? ' on' : ' dim'), style: `width:${w}px`, onclick: () => { TLS.sel = s.id; renderAll(); } }, br.join(' · ') || '—'));
    });
    const end = el('div', { class: 'tlclip', style: 'width:90px;background:#222;border:2px dashed #666;cursor:default', ondragover: e => e.preventDefault(), ondrop: e => drop(e, steps.length) }, el('small', {}, '+ drop here'), el('small', {}, 'THE END')); lane.append(end);
    track.ondragover = e => e.preventDefault(); track.ondrop = e => { if (e.target === track) drop(e, steps.length); };
    track.append(lane, mlane, blane);
    if (!steps.length) track.append(el('p', { class: 'hint' }, 'Nothing here yet. Click or drag a section from the left, or load a ready-made timeline below.'));
    /* DS bottom-screen lane: only for DS games */
    const showDS = con === 'ds' || TLS.ds, dsBox = el('div', {});
    if (showDS) {
        P.ds = P.ds || {}; P.ds.bottomScreen = P.ds.bottomScreen || {}; const bs = P.ds.bottomScreen; bs.buttons = bs.buttons || []; const dl = el('div', { class: 'tllane' }); dl.append(el('div', { class: 'tllabel' }, 'DS touch'));
        bs.buttons.forEach(b => dl.append(el('div', { class: 'tlchip on', style: 'padding:6px 10px', title: b.action === 'scene' ? 'Calls a section, then comes back' : 'Sets a story flag' }, (b.icon || '🔘') + ' ' + b.label + (b.action === 'scene' ? ' → ' + ((steps.find(x => x.id === b.target) || {}).title || '?') : ' ⚑ ' + (b.target || '')))));
        if (!bs.buttons.length) dl.append(el('div', { class: 'tlchip dim', style: 'padding:6px 10px' }, 'no buttons yet'));
        track.append(dl);
        dsBox.append(el('div', { class: 'tlinsp' }, el('h3', {}, '📱 Bottom-screen buttons (Nintendo DS only)'), el('p', { class: 'hint' }, 'Each button can call any section (like tapping the phone to play a match-3) and returns to where you were, or set a story flag. They show as keys 1-4 in the PC preview.'),
            ...bs.buttons.map((b, i) => el('div', { class: 'row wrap' }, el('input', { value: b.icon || '', placeholder: '🔘', style: 'width:44px', oninput: e => { b.icon = e.target.value.slice(0, 2); dirty = true; } }), el('input', { value: b.label, style: 'width:120px', oninput: e => { b.label = e.target.value.slice(0, 12); dirty = true; } }),
                tlSel([['scene', 'call a section'], ['flag', 'set a flag']], b.action || 'scene', x => { b.action = x; b.target = ''; redraw(); }), b.action === 'flag' ? el('input', { value: b.target || '', placeholder: 'flag name', style: 'width:110px', oninput: e => { b.target = e.target.value.trim(); dirty = true; } }) : tlSel([['', '- pick -'], ...steps.map((s, k) => [s.id, (k + 1) + '. ' + s.title])], b.target, x => { b.target = x; redraw(); }), el('button', { class: 'mini alt', onclick: () => { bs.buttons.splice(i, 1); redraw(); } }, '🗑'))),
            bs.buttons.length < 4 ? el('button', { class: 'alt', onclick: () => { bs.buttons.push({ label: 'Button ' + (bs.buttons.length + 1), icon: '', action: 'scene', target: '' }); redraw(); } }, '+ Add button') : el('small', { class: 'hint' }, 'Four buttons fit.')));
    }
    main.append(box); box.append(el('div', { class: 'tlwrap' }, pal, el('div', { class: 'tlmain' }, track)));
    const mainCol = box.querySelector('.tlmain'); mainCol.append(dsBox);

    /* ---- inspector for the selected clip */
    if (sel) mainCol.append(tlInspector(sel, steps, redraw));
    else mainCol.append(el('p', { class: 'hint' }, 'Click a clip to edit it: its text, game settings, music, transition and what happens next.'));

    /* ---- bottom bar */
    const dsv = TL.validate(P, 'ds'), dsGame = steps.some(s => s.type === 'arcade');
    mainCol.append(el('div', { class: 'row wrap' }, el('button', { class: 'go', onclick: () => timelinePlay(0) }, '▶ Play from start'), dsGame ? el('button', { class: dsv.ok ? 'go' : 'alt', title: dsv.ok ? 'One DS ROM that chains these arcade games (story sections become text cards)' : dsv.errors.join(' '), onclick: exportTimelineDS }, '⬇ DS ROM (.nds)') : null, sel ? el('button', { class: 'go', onclick: () => timelinePlay(steps.indexOf(sel)) }, '▶ Play from the selected section') : null,
        con !== 'ds' ? el('label', {}, el('input', { type: 'checkbox', ...(TLS.ds ? { checked: '' } : {}), onchange: e => { TLS.ds = e.target.checked; renderAll(); } }), 'Show DS bottom-screen buttons') : null,
        el('span', { class: 'hint' }, 'Ready-made:'), ...Object.entries(TL.PRESETS).map(([k, p]) => el('button', { class: 'alt', title: p.about, onclick: () => { TL.preset(k, P); TLS.sel = null; redraw(); } }, p.name)),
        steps.length ? el('button', { class: 'alt', onclick: () => { P.timeline = []; TLS.sel = null; redraw(); } }, 'Clear') : null));
}

function tlInspector(s, steps, redraw) {
    const TL = NRTimeline, i = steps.indexOf(s), ty = TL.TYPES[s.type] || {}, box = el('div', { class: 'tlinsp' }), set = (k, v) => { s[k] = v; dirty = true; };
    box.append(el('div', { class: 'row wrap' }, el('h3', { style: 'margin:0' }, tlIcon(s) + ' ' + (i + 1) + '. ' + (ty.label || s.type)), el('input', { value: s.title, style: 'width:200px', oninput: e => { set('title', e.target.value.slice(0, 30)); } }),
        el('button', { class: 'mini alt', title: 'Move earlier', onclick: () => { if (i > 0) { [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]]; redraw(); } } }, '←'), el('button', { class: 'mini alt', title: 'Move later', onclick: () => { if (i < steps.length - 1) { [steps[i + 1], steps[i]] = [steps[i], steps[i + 1]]; redraw(); } } }, '→'),
        el('button', { class: 'mini alt', title: 'Duplicate', onclick: () => { const c = JSON.parse(JSON.stringify(s)); c.id = TL.newId(); c.title = (c.title + ' copy').slice(0, 30); steps.splice(i + 1, 0, c); TLS.sel = c.id; redraw(); } }, '⧉'), el('button', { class: 'mini alt', onclick: () => { steps.splice(i, 1); TLS.sel = null; redraw(); } }, '🗑 Delete')));
    box.append(el('p', { class: 'hint' }, ty.about || ''));
    /* what the section is */
    if (s.type === 'cutscene') box.append(el('div', {}, el('input', { value: s.speaker, placeholder: 'Who talks', style: 'width:160px', oninput: e => set('speaker', e.target.value.slice(0, 23)) }), el('textarea', { rows: 3, class: 'wide', maxlength: 160, oninput: e => set('text', e.target.value) }, s.text || '')));
    if (s.type === 'title') box.append(el('label', {}, 'Subtitle ', el('input', { value: s.text, class: 'wide', oninput: e => set('text', e.target.value.slice(0, 50)) })));
    if (s.type === 'loading') box.append(el('div', { class: 'row wrap' }, el('label', {}, 'Tip shown ', el('input', { value: s.text, class: 'wide', oninput: e => set('text', e.target.value.slice(0, 60)) })), el('label', {}, 'Seconds ', el('input', { type: 'number', min: 1, max: 30, value: (s.dur || 120) / 60, style: 'width:60px', onchange: e => set('dur', Math.max(1, Math.min(30, +e.target.value || 2)) * 60) }))));
    if (s.type === 'credits') box.append(el('textarea', { rows: 5, class: 'wide', oninput: e => set('text', e.target.value) }, s.text || ''), el('p', { class: 'hint' }, 'One line per row. The first line is shown big.'));
    if (s.type === 'transition') box.append(el('div', { class: 'row wrap' }, el('label', {}, 'Kind ', tlSel(Object.entries(TL.TRANSITIONS).filter(([k]) => k !== 'cut'), s.mode || 'fade', v => { set('mode', v); })), el('label', {}, 'Caption ', el('input', { value: s.text, style: 'width:200px', oninput: e => set('text', e.target.value.slice(0, 40)) })), el('label', {}, 'Seconds ', el('input', { type: 'number', min: .5, max: 10, step: .5, value: (s.dur || 60) / 60, style: 'width:60px', onchange: e => set('dur', Math.max(30, Math.round((+e.target.value || 1) * 60))) }))));
    if (s.type === 'dialogue') {
        s.lines = s.lines && s.lines.length ? s.lines : [{ speaker: '', text: '' }]; box.append(...s.lines.map((l, k) => el('div', { class: 'row wrap' }, el('input', { value: l.speaker, placeholder: 'Who', style: 'width:110px', oninput: e => { l.speaker = e.target.value.slice(0, 18); dirty = true; } }), el('input', { value: l.text, class: 'wide', oninput: e => { l.text = e.target.value.slice(0, 120); dirty = true; } }), el('button', { class: 'mini alt', onclick: () => { s.lines.splice(k, 1); redraw(); } }, '🗑'))), el('button', { class: 'alt', onclick: () => { s.lines.push({ speaker: s.lines.length ? s.lines[s.lines.length - 1].speaker : '', text: '' }); redraw(); } }, '+ line'));
    }
    if (s.type === 'menu') { s.choices = s.choices && s.choices.length ? s.choices : [{ text: 'Continue', next: 'next' }]; box.append(el('label', {}, 'Question ', el('input', { value: s.text, class: 'wide', oninput: e => set('text', e.target.value.slice(0, 50)) })), ...s.choices.map((c, k) => el('div', { class: 'row wrap' }, el('input', { value: c.text, style: 'width:180px', oninput: e => { c.text = e.target.value.slice(0, 24); dirty = true; } }), el('span', {}, 'goes to'), tlSel(tlTargets(steps, s), c.next || 'next', v => { c.next = v; redraw(); }), el('button', { class: 'mini alt', onclick: () => { s.choices.splice(k, 1); redraw(); } }, '🗑'))), s.choices.length < 5 ? el('button', { class: 'alt', onclick: () => { s.choices.push({ text: 'Option ' + (s.choices.length + 1), next: 'next' }); redraw(); } }, '+ choice') : null); }
    if (s.type === 'arcade') {
        const groups = {}; TL.palette().filter(p => p.type === 'arcade').forEach(p => (groups[p.group] = groups[p.group] || []).push(p)); const known = new Set(TL.palette().map(p => p.mode));
        const sele = el('select', { onchange: e => { s.mode = e.target.value; s.cfg = JSON.parse(JSON.stringify(NRArcade.DEFAULTS[s.mode] || {})); if (s.mode === 'room') s.cfg.machines = JSON.parse(JSON.stringify(NRArcade.ROOM_MACHINES || [])); dirty = true; renderAll(); } }, el('option', { value: '' }, '- pick a game -'), ...Object.entries(groups).map(([g, l]) => { const og = el('optgroup', { label: g }); l.forEach(p => { const o = el('option', { value: p.mode }, p.label); if (s.mode === p.mode) o.selected = true; og.append(o); }); return og; }), ...Object.entries(NRArcade.MODES).filter(([k]) => !known.has(k)).map(([k, m]) => { const o = el('option', { value: k }, m.name); if (s.mode === k) o.selected = true; return o; }));
        box.append(el('div', { class: 'row wrap' }, el('label', {}, 'Game ', sele), s.mode && NRArcade.MODES[s.mode] ? el('small', { class: 'hint' }, 'Controls: ' + NRArcade.MODES[s.mode].controls) : null));
        if (s.mode && NRArcade.DEFAULTS[s.mode]) { s.cfg = s.cfg || {}; box.append(tlCfgFields(NRArcade.DEFAULTS[s.mode], s.cfg)); if (s.mode === 'room') box.append(tlRoomEditor(s, redraw)); }
        /* triggers */
        s.triggers = s.triggers || []; box.append(el('h3', {}, 'Triggers (jump out of this section early)'), ...s.triggers.map((tr, k) => el('div', { class: 'row wrap' }, tlSel([['score', 'when the score reaches'], ['time', 'after this many seconds']], tr.on, v => { tr.on = v; redraw(); }), el('input', { type: 'number', value: tr.value | 0, style: 'width:80px', onchange: e => { tr.value = +e.target.value | 0; dirty = true; } }), el('span', {}, 'go to'), tlSel(tlTargets(steps, s), tr.next || 'next', v => { tr.next = v; redraw(); }), el('button', { class: 'mini alt', onclick: () => { s.triggers.splice(k, 1); redraw(); } }, '🗑'))), el('button', { class: 'alt', onclick: () => { s.triggers.push({ on: 'time', value: 60, next: 'next' }); redraw(); } }, '+ trigger'));
    }
    if (s.type === 'level' || s.type === 'race' || s.type === 'fps') box.append(el('label', {}, 'Level ', tlSel((P.levels || []).map((L, k) => [k, L.name || 'Level ' + (k + 1)]), s.level | 0, v => set('level', +v))));
    if (s.type === 'world' && P.world) box.append(el('label', {}, 'Map ', tlSel((P.world.maps || []).map(m => [m.id, m.name]), s.map, v => set('map', v))));
    if (['rpg', 'puzzle', 'fight'].includes(s.type)) box.append(el('p', { class: 'hint' }, s.type === 'puzzle' ? 'Settings: Puzzle tab.' : s.type === 'fight' ? 'Settings: Fighting tab.' : 'Settings: World tab.'));
    /* how the section starts, sounds and ends */
    box.append(el('h3', {}, 'Music, transition and what happens next'),
        el('div', { class: 'row wrap' }, el('label', {}, '♪ Music ', tlSel([['', '↪ keep what is playing'], ['-1', '🔇 silence'], ...(P.songs || []).map((sg, k) => [String(k), '♪ ' + (sg.name || sg.style || 'Song ' + (k + 1))])], s.music == null ? '' : String(s.music), v => { s.music = v === '' ? null : +v; redraw(); })),
            el('label', {}, 'Comes in with ', tlSel(Object.entries(TL.TRANSITIONS), s.transition || 'cut', v => { s.transition = v === 'cut' ? '' : v; redraw(); })),
            !(P.songs || []).length ? el('small', { class: 'hint' }, 'Make songs on the Music tab to pick them here.') : null),
        el('div', { class: 'row wrap' }, el('label', {}, 'When it ends ', tlSel(tlTargets(steps, s), s.onWin || 'next', v => { s.onWin = v; redraw(); })),
            TL.TYPES[s.type].family !== 'story' ? el('label', {}, 'If the player loses ', tlSel([['retry', 'retry (costs a life)'], ['skip', 'skip ahead'], ['end', 'game over'], ...steps.filter(x => x.id !== s.id).map(x => [x.id, '→ ' + (steps.indexOf(x) + 1) + '. ' + x.title])], s.onLose || 'retry', v => { s.onLose = v; redraw(); })) : null,
            el('label', {}, 'Needs flag ', el('input', { value: s.needs, style: 'width:80px', placeholder: 'flag', oninput: e => set('needs', e.target.value.trim()) })), el('label', {}, 'Sets flag ', el('input', { value: s.sets, style: 'width:80px', placeholder: 'flag', oninput: e => set('sets', e.target.value.trim()) })),
            el('label', {}, 'Reward ', el('input', { type: 'number', value: s.reward | 0, style: 'width:70px', onchange: e => set('reward', +e.target.value | 0) }))));
    return box;
}

/* the arcade-room layout editor: click empty floor to put a machine, click a machine to edit, drag to move */
function tlRoomEditor(s, redraw) {
    const C = s.cfg, ms = C.machines = C.machines || JSON.parse(JSON.stringify(NRArcade.ROOM_MACHINES || [])), box = el('div', {}), S2 = 2, cv = el('canvas', { width: 320 * S2, height: 240 * S2, class: 'tlroom' }), g = cv.getContext('2d'); let drag = -1;
    const modes = Object.entries(NRArcade.MODES).filter(([k]) => k !== 'room' && NRArcade.DEFAULTS[k]);
    const paint = () => { const r = NRArcade.create('room', Object.assign({}, C, { machines: ms }), { seed: 1 }); r.s.x = -50; r.s.y = -50; g.save(); g.scale(S2, S2); g.imageSmoothingEnabled = false; r.draw(g); if (TLS.room >= 0 && ms[TLS.room]) { const m = ms[TLS.room]; g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(m.x - 15, m.y - 16, 30, 34); } g.restore(); };
    const pos = e => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * 320 / b.width, y: (e.clientY - b.top) * 240 / b.height }; };
    const hit = p => ms.findIndex(m => Math.abs(p.x - m.x) < 15 && p.y > m.y - 16 && p.y < m.y + 18);
    cv.onmousedown = e => { const p = pos(e), h = hit(p); if (h >= 0) { drag = h; TLS.room = h; } else if (p.y > 34 && p.y < 224) { const k = modes.find(([id]) => !ms.some(m => m.mode === id)) || modes[0]; ms.push({ x: Math.round(p.x), y: Math.round(p.y), label: String(k[1].name).split(/[ (]/)[0].toUpperCase().slice(0, 10), mode: k[0], cfg: {} }); TLS.room = ms.length - 1; dirty = true; renderAll(); return; } paint(); fillInsp(); };
    cv.onmousemove = e => { if (drag < 0) return; const p = pos(e); ms[drag].x = Math.max(16, Math.min(304, Math.round(p.x))); ms[drag].y = Math.max(42, Math.min(214, Math.round(p.y))); dirty = true; paint(); }; cv.onmouseup = cv.onmouseleave = () => { drag = -1; };
    const insp = el('div', {}); const fillInsp = () => { insp.innerHTML = ''; const m = ms[TLS.room]; if (!m) { insp.append(el('p', { class: 'hint' }, 'Click the floor to place a machine. Click a machine to choose what it plays; drag to move it.')); return; }
        insp.append(el('div', { class: 'row wrap' }, el('label', {}, 'Name ', el('input', { value: m.label, style: 'width:110px', oninput: e => { m.label = e.target.value.slice(0, 12).toUpperCase(); dirty = true; paint(); } })), el('label', {}, 'Plays ', tlSel(modes.map(([k, d]) => [k, d.name]), m.mode, v => { m.mode = v; m.cfg = {}; dirty = true; fillInsp(); }, '220px')), el('button', { class: 'mini alt', onclick: () => { ms.splice(TLS.room, 1); TLS.room = -1; dirty = true; renderAll(); } }, '🗑 Remove machine')), tlCfgFields(NRArcade.DEFAULTS[m.mode] || {}, m.cfg = m.cfg || {})); };
    box.append(el('h3', {}, '🕹 Arcade room layout'), el('p', { class: 'hint' }, 'The player walks around, stands at a machine, presses Z to spend a token and play it, and wins tickets by score. Walk into the EXIT at the bottom to continue the timeline (set Goal tickets above to lock the exit until they have enough). Any engine can be a machine.'), cv, insp,
        el('div', { class: 'row wrap' }, el('button', { class: 'alt', onclick: () => { C.machines = JSON.parse(JSON.stringify(NRArcade.ROOM_MACHINES)); TLS.room = -1; redraw(); } }, 'Reset to the default 8 machines'), el('button', { class: 'alt', onclick: () => { C.machines = []; TLS.room = -1; redraw(); } }, 'Empty room')));
    paint(); fillInsp(); return box;
}

/* ---- preview: plays the whole timeline (or from one section) with music, branches, transitions and DS buttons */
function timelinePlay(from) {
    const steps = NRTimeline.get(P); if (!steps.length) { notify('Add a section first.'); return; }
    const sub = JSON.parse(JSON.stringify(P)); if (from) sub.timeline = steps.slice(from).map(s => Object.assign({}, s, { needs: '' }));
    let ac = null, node = null, gain = null, playing = null; const bufs = {}, killMusic = () => { try { if (node) node.stop(); } catch (e) { } node = null; };
    const music = n => { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); if (n === playing) return; playing = n; if (node) { const o = node, gg = gain; gg.gain.linearRampToValueAtTime(0, ac.currentTime + .4); setTimeout(() => { try { o.stop(); } catch (e) { } }, 450); node = null; } if (n == null || n < 0 || !(P.songs || [])[n]) return;
        if (!bufs[n]) { const r = NRMusic.renderSong(JSON.parse(JSON.stringify(P.songs[n])), 32768, 1), b = ac.createBuffer(2, r.L.length, r.sr); b.copyToChannel(r.L, 0); b.copyToChannel(r.R, 1); bufs[n] = b; }
        node = ac.createBufferSource(); node.buffer = bufs[n]; node.loop = true; gain = ac.createGain(); gain.gain.setValueAtTime(0, ac.currentTime); gain.gain.linearRampToValueAtTime(.8, ac.currentTime + .5); node.connect(gain); gain.connect(ac.destination); node.start(); } catch (e) { } };
    const S = NRTimeline.session(sub, { seed: Date.now() & 0xffff, ds: (P.console === 'ds') || TLS.ds, music });
    const box = el('div', {}), cv = el('canvas', { width: 320, height: 240, style: 'width:640px;height:480px;image-rendering:pixelated;background:#111' }), info = el('small', {}, 'Keys: arrows, Z, X, C. Z continues. Esc leaves a machine. 1-4 = DS bottom-screen buttons. Click the picture once so the music can start.'), keys = {}; let raf = 0, stopped = false, acc = 0, last = performance.now();
    const kd = e => { keys[e.key] = true; keys[e.key.toLowerCase()] = true; if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); }, ku = e => { keys[e.key] = false; keys[e.key.toLowerCase()] = false; };
    addEventListener('keydown', kd); addEventListener('keyup', ku); const g = cv.getContext('2d');
    cv.onpointerdown = () => { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); const p = playing; playing = undefined; music(p); } catch (e) { } };
    const loop = t => { if (stopped) return; acc += Math.min(100, t - last); last = t; while (acc >= 16.7) { acc -= 16.7; S.step(keys); } S.draw(g); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); box.append(cv, el('br'), info);
    modal('Timeline preview', box, [['Close', () => { stopped = true; cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); killMusic(); return true; }, 'alt']]);
}

/* DS scene router: the timeline's arcade sections (+ story text cards) in ONE ROM; sections the DS arcade ROM does not have are refused with the reason */
async function exportTimelineDS() {
    try { const res = NRKit.buildDSScenes(P), out = NRKit.patchROM(await gunzipB64(ROMS.ds_arcade), res.block), nm = ((P.meta && P.meta.title) || 'timeline').replace(/\W+/g, '_'); await download(nm + '.nds', await withBanner(out.rom), 'application/octet-stream'); notify('Saved ' + nm + '.nds: copy it to roms/NDS on your RG DS Plus and open in DraStic. Games play in timeline order; winning moves on, losing retries.'); }
    catch (e) { notify(e.message); }
}

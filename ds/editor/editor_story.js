/* Story & Banner tab (v1.5): the cutscene timeline (intro, before each level, ending) and the DS banner (icon + title lines shown by the DS menu / DraStic). */
const STORY = { slot: 'all' };
async function withBanner(rom) {
    rom = applyPatches(rom);
    if (!P || !P.banner || (!P.banner.title && !P.banner.icon)) return rom;
    let icon = null; if (P.banner.icon) { const im = await loadImage(P.banner.icon), c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); icon = { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data }; }
    return NRKit.patchBanner(rom, { title: P.banner.title, icon });
}
function storyTab(main) {
    const box = el('div', { class: 'pane' }); P.cutscenes = P.cutscenes || []; const CS = P.cutscenes, n = P.levels.length;
    box.append(el('h2', {}, '🎬 Story & Banner'), el('p', { class: 'hint' }, 'Cutscenes play on the Nintendo DS platformer ROM: an intro after the title screen, a scene before any level, and an ending after the last level. A / START / touch moves on. (SNES and the PC page do not play cutscenes yet.)'));
    const slots = [['all', 'All'], ['intro', 'Intro'], ...P.levels.map((l, i) => ['level' + i, 'Before ' + (i + 1)]), ['ending', 'Ending']];
    const count = k => CS.filter(c => k === 'all' || slotOf(c) === k).length, slotOf = c => c.when === 'ending' ? 'ending' : c.when === 'level' ? 'level' + (c.level | 0) : 'intro';
    box.append(el('div', { class: 'row wrap' }, ...slots.map(([k, l]) => el('button', { class: 'mini ' + (STORY.slot === k ? '' : 'alt'), onclick: () => { STORY.slot = k; renderAll(); } }, `${l} (${count(k)})`))));
    const list = el('div', {});
    CS.forEach((c, i) => { if (STORY.slot !== 'all' && slotOf(c) !== STORY.slot) return;
        const when = el('select', { onchange: e => { c.when = e.target.value; dirty = true; renderAll(); } }, ...[['intro', 'Intro'], ['level', 'Before level'], ['ending', 'Ending']].map(([v, t]) => { const o = el('option', { value: v }, t); if ((c.when || 'intro') === v) o.selected = true; return o; }));
        list.append(el('div', { class: 'tech' }, el('div', { class: 'row wrap' }, when,
            (c.when === 'level') ? el('label', {}, 'Level ', el('input', { type: 'number', min: 1, max: n, value: (c.level | 0) + 1, style: 'width:56px', onchange: e => { c.level = Math.max(0, Math.min(n - 1, +e.target.value - 1)); dirty = true; renderAll(); } })) : '',
            el('label', {}, 'Who ', el('input', { value: c.speaker || '', style: 'width:130px', oninput: e => { c.speaker = e.target.value.slice(0, 23); dirty = true; } })),
            el('label', {}, 'Seconds ', el('input', { type: 'number', min: 1, max: 30, step: 0.5, value: (c.duration || 300) / 60, style: 'width:60px', onchange: e => { c.duration = Math.round(Math.max(1, +e.target.value) * 60); dirty = true; } })),
            el('button', { class: 'mini alt', onclick: () => { if (i > 0) { [CS[i - 1], CS[i]] = [CS[i], CS[i - 1]]; dirty = true; renderAll(); } } }, '↑'), el('button', { class: 'mini alt', onclick: () => { if (i < CS.length - 1) { [CS[i + 1], CS[i]] = [CS[i], CS[i + 1]]; dirty = true; renderAll(); } } }, '↓'),
            el('button', { class: 'mini alt', onclick: () => { CS.splice(i, 1); dirty = true; renderAll(); } }, '🗑')),
            el('textarea', { rows: 2, class: 'wide', maxlength: 159, oninput: e => { c.text = e.target.value; dirty = true; } }, c.text || ''), el('small', {}, 'Up to 159 letters. It wraps by itself.'))); });
    if (!list.children.length) list.append(el('p', { class: 'hint' }, 'No scenes here yet.'));
    const add = w => { const s = STORY.slot; CS.push({ when: s === 'ending' ? 'ending' : /^level/.test(s) ? 'level' : 'intro', level: /^level/.test(s) ? +s.slice(5) : 0, speaker: '', text: '', duration: 300 }); dirty = true; renderAll(); };
    box.append(list, el('div', { class: 'row' }, el('button', { class: 'go', onclick: add }, '+ Add a scene'), el('button', { onclick: () => storyPreview(CS.filter(c => STORY.slot === 'all' || slotOf(c) === STORY.slot)) }, '▶ Preview')));
    /* banner */
    const B = P.banner = P.banner || { title: (P.meta.title || 'My Game') + '\nMade with Notareal\nGame Studio', icon: '' };
    const cv = el('canvas', { width: 32, height: 32, style: 'width:96px;height:96px;image-rendering:pixelated;background:#222' });
    const draw = async () => { const g = cv.getContext('2d'); g.clearRect(0, 0, 32, 32); if (B.icon) { const im = await loadImage(B.icon), s = Math.min(32 / im.width, 32 / im.height); g.imageSmoothingEnabled = false; g.drawImage(im, (32 - im.width * s) / 2, (32 - im.height * s) / 2, im.width * s, im.height * s); } };
    draw();
    const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif', onchange: async e => { const f = e.target.files[0]; if (!f) return; B.icon = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }); dirty = true; draw(); } });
    const hero = el('button', { onclick: async () => { const sp = P.sprites.hero || Object.values(P.sprites)[0]; if (!sp) return; const im = await loadImage(sp.image), c = document.createElement('canvas'); c.width = sp.w; c.height = sp.h; c.getContext('2d').drawImage(im, 0, 0, sp.w, sp.h, 0, 0, sp.w, sp.h); B.icon = c.toDataURL('image/png'); dirty = true; draw(); } }, 'Use my hero');
    const lines = el('textarea', { rows: 3, style: 'width:260px', maxlength: 100, oninput: e => { B.title = e.target.value; dirty = true; } }, B.title || '');
    box.append(el('h3', {}, 'DS banner (icon and title in the DS menu)'), el('p', { class: 'hint' }, 'The icon is scaled to 32x32 with 15 colours. Up to 3 title lines. Applied to every DS ROM you export (platformer, world, puzzle, fight, arcade). Check it on the RG DS Plus in DraStic.'),
        el('div', { class: 'row wrap' }, cv, el('div', {}, lines, el('div', { class: 'row' }, file, hero, el('button', { class: 'alt', onclick: () => { B.icon = ''; dirty = true; renderAll(); } }, 'Clear icon')))));
    main.append(box);
}
function storyPreview(scenes) {
    if (!scenes.length) { notify('No scenes to preview.'); return; }
    let i = 0; const t = el('div', { style: 'min-height:90px;background:#9cd;color:#112;padding:12px;font:15px monospace;text-align:center' }), show = () => { const c = scenes[i]; t.replaceChildren(el('b', {}, c.speaker || ''), el('p', {}, c.text || '')); };
    show(); modal('Scene preview', el('div', {}, t, el('small', {}, `Scene ${1} of ${scenes.length}`)), [['Next', () => { i++; if (i >= scenes.length) return true; show(); return false; }, 'go'], ['Close', () => true, 'alt']]);
}

/* ------------------------------------------------------------------ Moonlight Holler (Game Boy Color): the studio's first game as a template.
   The finished ROM is the engine. This tab edits its dialogue (every sign, neighbor and tip) and exports a new ROM with your words in it. Pages are 3 lines of 18 characters. */
function mhgbTab(main) {
    const S = P ? (P.mh = P.mh || {}) : (window._mh = window._mh || {}); S.dialog = S.dialog || {};
    const box = el('div', { class: 'pane' }), list = el('div', {}), editor = el('div', {}); let cur = S.cur || MH_DIALOG.dialogs[0].id, filter = '';
    const fonts = MH_DIALOG.chars, pages = id => S.dialog[id] || MH_DIALOG.dialogs.find(d => d.id === id).pages, orig = id => MH_DIALOG.dialogs.find(d => d.id === id).pages;
    const edited = () => Object.keys(S.dialog).filter(id => JSON.stringify(S.dialog[id]) !== JSON.stringify(orig(id))).length;
    const info = el('span', { class: 'hint' });
    function drawList() { list.innerHTML = ''; MH_DIALOG.dialogs.filter(d => !filter || d.id.toLowerCase().includes(filter) || JSON.stringify(pages(d.id)).toLowerCase().includes(filter)).forEach(d => { const ch = JSON.stringify(pages(d.id)) !== JSON.stringify(d.pages); list.append(el('button', { class: d.id === cur ? 'go' : 'alt', style: 'display:block;width:100%;text-align:left;margin:1px 0;font-size:11px', onclick: () => { cur = S.cur = d.id; drawList(); drawEd(); } }, (ch ? '✎ ' : '') + d.id)); }); info.textContent = edited() + ' dialogue(s) changed'; }
    function drawEd() {
        editor.innerHTML = ''; const pg = pages(cur).map(p => p.slice()); editor.append(el('h3', {}, cur), el('p', { class: 'hint' }, 'Each page is up to 3 lines of 18 characters. Letters, numbers and , . - : ! ? \' > / + $ only. The number of pages is fixed.'));
        pg.forEach((page, pi) => {
            const row = el('div', { class: 'gfxpanel' }, el('b', {}, 'Page ' + (pi + 1)));
            for (let i = 0; i < 3; i++) { const inp = el('input', { value: page[i] || '', maxlength: 18, style: 'width:21ch;font-family:monospace;display:block;margin:2px 0' }), msg = el('small', {});
                inp.oninput = () => { const v = inp.value; const bad = [...v].filter(c => !fonts.includes(c)); msg.textContent = bad.length ? ' not in font: ' + [...new Set(bad)].join(' ') : ''; if (bad.length) return; page[i] = v; S.dialog[cur] = pg.map(p => { const o = p.slice(); while (o.length < 1) o.push(''); return o; }); dirty = true; drawListQuiet(); };
                row.append(el('div', {}, inp, msg)); }
            editor.append(row);
        });
        editor.append(el('button', { class: 'alt', onclick: () => { delete S.dialog[cur]; dirty = true; drawList(); drawEd(); } }, 'Put the original back'));
    }
    const drawListQuiet = () => { info.textContent = edited() + ' dialogue(s) changed'; };
    const search = el('input', { placeholder: 'Search dialogue (e.g. Daisy, corn, mill)', style: 'width:100%', oninput: e => { filter = e.target.value.toLowerCase(); drawList(); } });
    box.append(el('h2', {}, '🌙 Moonlight Holler (Game Boy Color)'), el('p', { class: 'hint' }, 'The first game we made, as an editable template. The finished ROM is the engine: change what the neighbors, signs and tips say, then export a ROM that runs on a Game Boy Color, in an emulator or on your handheld. Maps, items, prices and art are not editable here yet.'),
        el('div', { class: 'row wrap' }, el('button', { class: 'go', onclick: exportMhgb }, '⬇ Export Moonlight Holler .gbc'), info),
        el('div', { style: 'display:grid;grid-template-columns:230px 1fr;gap:12px' }, el('div', { style: 'max-height:520px;overflow:auto' }, search, list), editor));
    main.append(box); drawList(); drawEd();
}
async function exportMhgb() {
    try { const S = P ? (P.mh || {}) : (window._mh || {}), res = NRKit.buildGBMoonlight(await gunzipB64(ROMS.gb_moonlight), S.dialog || {}, MH_DIALOG);
        if (res.problems.length) { notify('Fix this first: ' + res.problems[0]); return; }
        await download('moonlight_holler.gbc', res.rom, 'application/octet-stream'); notify('Saved moonlight_holler.gbc (' + res.changed + ' dialogue page(s) changed). Open it in a Game Boy Color emulator or copy to your handheld.'); }
    catch (e) { notify('Could not build Moonlight Holler: ' + e.message); }
}

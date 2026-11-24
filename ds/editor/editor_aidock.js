/* ------------------------------------------------------------------ The AI dock: one box at the bottom of EVERY screen. Tell the studio what you want; the built-in offline AI plans it and
   runs the studio's own tools one step at a time (the same tools the buttons use), checks each result and fixes mistakes. No AI installed = the keyword assistant answers instead. */
const AID = { open: false, log: [], busy: false, st: '' };
function aiCtx() { return { P: () => P, tesRef: () => (typeof bereaRef === 'function' ? bereaRef() : null), codedb: () => CODEDB.concat(labLoad()), measured: () => MEASURED, hooks: { markDirty: () => { dirty = true; }, useTemplate: (id, o) => useTemplate(id, o), exportRom: () => exportRom(), openTab: t => { tab = t; renderAll(); } } }; }
async function aiDockStatus() {
    const chip = document.getElementById('aidChip'); if (!chip) return;
    if (!DESK.ok) { chip.textContent = TPL.ai.kind === 'none' ? '⚠ keyword mode (the built-in AI is in the desktop program)' : '🧠 local AI'; chip.className = 'aidchip warn'; return; }
    try { const s = await deskCall('/api/ai/status'); const inst = s.hasServer && s.models.length;
        chip.textContent = s.ready ? '🟢 AI ready' : s.phase === 'download' ? '⬇ ' + s.msg + (s.pct ? ' ' + s.pct + '%' : '') : s.phase === 'loading' ? '⏳ ' + s.msg : inst ? '🟡 AI installed - starts when you ask' : '🔴 AI not installed';
        chip.className = 'aidchip ' + (s.ready ? 'ok' : inst ? 'mid' : 'warn'); const ib = document.getElementById('aidInstall'); if (ib) ib.style.display = inst || s.phase === 'download' ? 'none' : ''; } catch (e) { chip.textContent = 'AI status unavailable'; }
}
function aiDockDraw() {
    const dock = document.getElementById('aidock'); if (!dock) return; const lg = document.getElementById('aidLog'); lg.innerHTML = ''; AID.log.slice(-40).forEach(l => lg.append(el('div', { class: 'aidl ' + (l.k || '') }, l.t))); lg.scrollTop = lg.scrollHeight; lg.style.display = AID.open && AID.log.length ? '' : 'none';
}
async function aiDockRun(text) {
    text = String(text || '').trim(); if (!text || AID.busy) return; AID.busy = true; AID.open = true; AID.log.push({ k: 'me', t: '▶ ' + text }); aiDockDraw();
    try {
        const llm = typeof aiClient === 'function' ? aiClient() : null; if (!llm && TPL.ai.kind === 'bundled') AID.log.push({ k: 'dim', t: 'The AI is not installed yet, so the keyword assistant is answering. Press "Install the AI" once.' });
        const r = await NRTools.agent(text, aiCtx(), llm, st => { AID.log.push({ k: st.ok ? 'ok' : 'bad', t: (st.ok ? '✔ ' : '✘ ') + st.msg }); aiDockDraw(); });
        if (r.source !== 'ai') r.steps.forEach(s => AID.log.push({ k: s.ok ? 'ok' : 'bad', t: (s.ok ? '✔ ' : '✘ ') + s.msg }));
        AID.log.push({ k: 'dim', t: r.understood ? (r.say || 'Done.') + '  (' + (r.source === 'ai' ? 'offline AI' : 'keywords') + ')' : 'I did not understand that. Try: "make a kart racing game with 3 rivals and 5 laps", "make the scouts tougher", "check my game".' });
        if (P) { dirty = true; renderAll(); }
    } catch (e) { AID.log.push({ k: 'bad', t: 'Something went wrong: ' + (e && e.message || e) }); }
    AID.busy = false; aiDockDraw(); aiDockStatus();
}
function aiDockInit() {
    if (document.getElementById('aidock')) return;
    const css = el('style', {}, `#aidock{position:fixed;left:0;right:0;bottom:0;z-index:50;background:#14141e;border-top:2px solid #6a7fd8;font-size:13px}#aidock .aidrow{display:flex;gap:6px;padding:6px 8px;align-items:center}#aidock input{flex:1;padding:8px;font-size:14px;background:#0c0c14;color:#fff;border:1px solid #444;border-radius:4px}#aidLog{max-height:220px;overflow:auto;padding:4px 10px;border-bottom:1px solid #333}.aidl{padding:1px 0;white-space:pre-wrap}.aidl.ok{color:#7ae87a}.aidl.bad{color:#ff8a7a}.aidl.me{color:#9fb4ff}.aidl.dim{color:#aaa}.aidchip{padding:2px 8px;border-radius:10px;font-size:12px;white-space:nowrap}.aidchip.ok{background:#1f4d2a}.aidchip.mid{background:#4d4420}.aidchip.warn{background:#5a2a2a}#main{padding-bottom:70px}`);
    document.head.append(css);
    const inp = el('input', { id: 'aidIn', placeholder: '🧠 Tell the AI what to build or change: "make a haunted castle platformer", "make the kart game 5 laps and 3 rivals", "make the boss tougher", "check my game"...', onkeydown: e => { if (e.key === 'Enter') { const v = e.target.value; e.target.value = ''; aiDockRun(v); } } });
    const dock = el('div', { id: 'aidock' }, el('div', { id: 'aidLog', style: 'display:none' }), el('div', { class: 'aidrow' }, el('span', { id: 'aidChip', class: 'aidchip warn' }, '...'), inp,
        el('button', { class: 'go', onclick: () => { const v = inp.value; inp.value = ''; aiDockRun(v); } }, 'Do it'),
        el('button', { id: 'aidInstall', class: 'alt', style: 'display:none', onclick: async () => { const r = await deskCall('/api/ai/download', {}); AID.log.push({ k: 'dim', t: 'AI download: ' + r.msg + ' (about 2 GB, one time). The chip shows progress.' }); AID.open = true; aiDockDraw(); } }, 'Install the AI'),
        el('button', { class: 'alt', onclick: () => { AID.open = !AID.open; aiDockDraw(); } }, '▾▴')));
    document.body.append(dock); aiDockStatus(); setInterval(aiDockStatus, 3000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(aiDockInit, 400)); else setTimeout(aiDockInit, 400);

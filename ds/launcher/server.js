/* Notareal Game Studio - desktop launcher.
 * Runs the whole dev kit on this computer with no internet: serves the studio on 127.0.0.1 and adds the things a web page can't do:
 * read ROM folders from disk, scan them with the Research Lab + Graphics lab, and keep the results in Notareal_Data next to the program. */
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const NRLab = require('../kit/nrlab.js'), NRGfx = require('../kit/nrgfx.js'), NRRE = require('../kit/nrre.js'), NRScan = require('../kit/nrscan.js');
let STUDIO_HTML = null;
try { STUDIO_HTML = require('./studio.html'); } catch (e) { /* dev mode: read from disk below */ }
const isSea = (() => { try { return require('node:sea').isSea(); } catch (e) { return false; } })();
const HOME = isSea ? path.dirname(process.execPath) : (process.env.NR_HOME || process.cwd());
const DATA = process.env.NR_DATA || path.join(HOME, 'Notareal_Data'), LIB = path.join(DATA, 'research_library.json'), REPORT = path.join(DATA, 'graphics_report.md'), LOG = path.join(DATA, 'launcher.log');
const ROM_EXT = new Set(['.nds', '.gba', '.gb', '.gbc', '.sfc', '.smc', '.z64', '.n64', '.v64', '.iso', '.bin', '.img', '.exe', '.xbe', '.xex', '.zip', '.xiso']);
const PC_EXE = /\.(exe|xbe|xex)$/i;
const log = m => { try { fs.mkdirSync(DATA, { recursive: true }); fs.appendFileSync(LOG, new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} };
const UPD = path.join(DATA, 'update'), UPD_FILE = path.join(UPD, 'notareal_studio.html'), ENG = path.join(DATA, 'engines');
const validEngineId = id => /^[a-z0-9_]{2,40}$/.test(String(id || ''));
function updatedHtml() { try { const h = fs.readFileSync(UPD_FILE, 'utf8'); return h.includes('const ROMS=') && h.includes('NRKit') ? h : null; } catch (e) { return null; } }
function updInfo() { try { const st = fs.statSync(UPD_FILE), m = JSON.parse(fs.readFileSync(UPD_FILE + '.json', 'utf8')); return { installed: !!updatedHtml(), size: st.size, date: m.date, build: m.build || '' }; } catch (e) { return { installed: false }; } }
function engList() { try { return fs.readdirSync(ENG).filter(f => f.endsWith('.json')).map(f => { try { return JSON.parse(fs.readFileSync(path.join(ENG, f), 'utf8')); } catch (e) { return null; } }).filter(Boolean); } catch (e) { return []; } }
function studioHtml(safe) {
    if (!safe) { const u = updatedHtml(); if (u) return u; }
    if (STUDIO_HTML) return STUDIO_HTML;
    if (isSea) return require('node:sea').getAsset('studio.html', 'utf8');
    return fs.readFileSync(process.env.NR_STUDIO || path.join(__dirname, '..', 'dist', 'notareal_studio.html'), 'utf8');
}
const loadLib = () => { try { return JSON.parse(fs.readFileSync(LIB, 'utf8')); } catch (e) { return []; } };
function saveLib(db) { fs.mkdirSync(DATA, { recursive: true }); const tmp = LIB + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, LIB); writeReport(db); }
function writeReport(db) {
    const rows = NRGfx.rules(db.map(r => r)).filter(r => !/Studio craft/.test(r.game));
    const L = ['# Graphics data collected from your ROMs', '', `Games scanned: ${db.length}. Updated ${new Date().toISOString().slice(0, 10)}.`, '', 'Numbers are lower bounds: compressed or unrecognised art cannot be measured. Pictures are never saved, only measurements.', ''];
    for (const r of rows) L.push(`## ${r.platform}: ${r.system.replace('Graphic design · ', '')}`, '', r.what, '', 'Games: ' + r.game, '');
    const res = db.filter(r => r.re).map(r => r.re), plats = [...new Set(res.map(r => r.platform))];
    if (plats.length) { L.push('## Design budgets learned from your ROMs (graphics reverse engineering)', ''); for (const p of plats) { const a = NRRE.lib.advice({ games: res }, p); if (a) { L.push('### ' + p, ''); for (const t of a.lines) L.push('- ' + t); L.push(''); } }
        try { fs.writeFileSync(path.join(DATA, 'graphics_techniques.json'), JSON.stringify({ version: 1, updated: new Date().toISOString().slice(0, 10), note: 'Measurements only. No pixels, colours or tiles from any game.', games: res }, null, 1)); } catch (e) {} }
    L.push('## Per game', ''); for (const r of db) { const g = r.gfx; if (!g) continue; L.push(`### ${r.name} (${r.platform})`); for (const u of NRGfx.findings(g)) L.push('- ' + u.text); L.push(''); }
    try { fs.writeFileSync(REPORT, L.join('\n')); } catch (e) {}
}
function listRoms(dir, out = [], depth = 0) {
    if (out.length >= 5000 || depth > 6) return out; let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
    /* a folder with a Windows/Xbox program in it is one game: scan it as a whole instead of listing its files */
    if (ents.some(e => e.isFile() && PC_EXE.test(e.name)) && !ents.some(e => e.isFile() && ROM_EXT.has(path.extname(e.name).toLowerCase()) && !PC_EXE.test(e.name) && e.name.toLowerCase().indexOf('.zip') < 0)) { out.push({ path: dir, name: path.basename(dir) + ' (game folder)', size: 0, pc: true }); return out; }
    for (const e of ents) { const p = path.join(dir, e.name); if (e.isDirectory()) listRoms(p, out, depth + 1); else if (ROM_EXT.has(path.extname(e.name).toLowerCase())) { try { const s = fs.statSync(p); if (s.size >= 4096) out.push({ path: p, name: e.name, size: s.size }); } catch (x) {} } }
    return out;
}
const PHYS = path.join(DATA, 'physics_library.json'); function loadPhys() { try { return JSON.parse(fs.readFileSync(PHYS, 'utf8')); } catch (e) { return { games: {} }; } }
function scanPC(p) { const r = NRScan.scanPath(p, { maxMs: 90000 }); if (r.skipped) return r; return { record: r.record, ms: r.ms, pc: true }; }
function scanFile(p) {
    const st = fs.statSync(p), ext = path.extname(p).toLowerCase();
    if (st.isDirectory() || st.size > 512 << 20 || /^\.(zip|xbe|xex|xiso)$/.test(ext) || (ext === '.exe' && st.size > 4096)) { try { const r = scanPC(p); if (r.record || st.isDirectory() || ext !== '.exe') return r; } catch (e) { log('PC scan failed for ' + p + ': ' + e.message); if (st.isDirectory()) return { skipped: e.message }; } }
    const buf = fs.readFileSync(p), R = NRLab.scan(new Uint8Array(buf.buffer, buf.byteOffset, buf.length), path.basename(p));
    if (R.platform === 'unknown') { try { return scanPC(p); } catch (e) { return { skipped: 'not a ROM the lab recognises' }; } }
    const rec = NRLab.dbRecord(R, '');
    try { const d = new Uint8Array(buf.buffer, buf.byteOffset, buf.length), plat = R.platform === 'psxexe' ? 'psx' : R.platform, A = NRRE.analyze(d, plat, { maxMs: 20000 }), re = NRRE.record(A, { id: rec.id, name: rec.name });
        rec.re = re; rec.uses = (rec.uses || []).concat(re.lines.map(t => ({ area: 'Graphic design', text: t, re: true }))); } catch (e) { log('graphics RE failed for ' + p + ': ' + e.message); }
    return { record: rec, ms: R.ms };
}
function body(req) { return new Promise((res, rej) => { const c = []; let n = 0; req.on('data', d => { n += d.length; if (n > 60 << 20) { rej(new Error('too big')); req.destroy(); } else c.push(d); }); req.on('end', () => { try { res(JSON.parse(Buffer.concat(c).toString() || '{}')); } catch (e) { rej(e); } }); }); }
const send = (res, code, obj, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(type === 'application/json' ? JSON.stringify(obj) : obj); };
function handler(PORT) {
    return async (req, res) => {
        const host = (req.headers.host || '').split(':')[0]; if (host !== '127.0.0.1' && host !== 'localhost') return send(res, 403, { error: 'local only' });
        const u = new URL(req.url, 'http://x');
        try {
            if (u.pathname === '/' || u.pathname === '/index.html') return send(res, 200, studioHtml(u.searchParams.get('safe') === '1').replace('<head>', '<head><script>window.NR_DESKTOP=true;</script>'), 'text/html');
            if (!u.pathname.startsWith('/api/')) return send(res, 404, { error: 'not found' });
            if (req.headers['x-notareal'] !== '1') return send(res, 403, { error: 'missing header' });
            if (u.pathname === '/api/ping') return send(res, 200, { ok: true, data: DATA, version: 1 });
            if (u.pathname === '/api/engines' && req.method === 'GET') return send(res, 200, { engines: engList(), update: updInfo() });
            if (u.pathname === '/api/engine' && req.method === 'GET') { const id = u.searchParams.get('id'); if (!validEngineId(id) || !fs.existsSync(path.join(ENG, id + '.rom'))) return send(res, 404, { error: 'no such engine' }); const b = fs.readFileSync(path.join(ENG, id + '.rom')); res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' }); return res.end(b); }
            if (u.pathname === '/api/engine' && req.method === 'POST') { const { id, name, b64 } = await body(req); if (!validEngineId(id) || typeof b64 !== 'string') return send(res, 400, { error: 'bad engine id or data' }); const buf = Buffer.from(b64, 'base64'); if (buf.length < 4096 || buf.length > 48 << 20) return send(res, 400, { error: 'engine ROM has a strange size' });
                fs.mkdirSync(ENG, { recursive: true }); fs.writeFileSync(path.join(ENG, id + '.rom'), buf); fs.writeFileSync(path.join(ENG, id + '.json'), JSON.stringify({ id, name: String(name || id).slice(0, 60), size: buf.length, date: new Date().toISOString() })); log('engine installed ' + id + ' ' + buf.length); return send(res, 200, { ok: true }); }
            if (u.pathname === '/api/engine/remove' && req.method === 'POST') { const { id } = await body(req); if (!validEngineId(id)) return send(res, 400, { error: 'bad engine id' }); for (const e of ['.rom', '.json']) { try { fs.unlinkSync(path.join(ENG, id + e)); } catch (x) { } } log('engine removed ' + id); return send(res, 200, { ok: true }); }
            if (u.pathname === '/api/update-app' && req.method === 'POST') { const { html, build } = await body(req); if (typeof html !== 'string' || !html.includes('const ROMS=') || !html.includes('NRKit') || !html.includes('Notareal')) return send(res, 400, { error: 'That file is not a Notareal Game Studio program page.' });
                fs.mkdirSync(UPD, { recursive: true }); if (fs.existsSync(UPD_FILE)) fs.copyFileSync(UPD_FILE, UPD_FILE + '.bak'); fs.writeFileSync(UPD_FILE, html); fs.writeFileSync(UPD_FILE + '.json', JSON.stringify({ date: new Date().toISOString(), build: String(build || '').slice(0, 60) })); log('program update installed ' + html.length); return send(res, 200, { ok: true }); }
            if (u.pathname === '/api/update-app/remove' && req.method === 'POST') { for (const f of [UPD_FILE, UPD_FILE + '.json']) { try { fs.unlinkSync(f); } catch (x) { } } log('program update removed'); return send(res, 200, { ok: true }); }
            if (u.pathname === '/api/library' && req.method === 'GET') return send(res, 200, loadLib());
            if (u.pathname === '/api/library' && req.method === 'POST') { const add = await body(req); const cur = loadLib(); for (const r of Array.isArray(add) ? add : []) { const i = cur.findIndex(c => c.id === r.id); if (i >= 0) cur[i] = r; else cur.push(r); } saveLib(cur); return send(res, 200, { ok: true, count: cur.length }); }
            if (u.pathname === '/api/library/remove' && req.method === 'POST') { const { id } = await body(req); saveLib(loadLib().filter(r => r.id !== id)); return send(res, 200, { ok: true }); }
            if (u.pathname === '/api/list' && req.method === 'POST') { const { dir } = await body(req); if (!dir || !fs.existsSync(dir)) return send(res, 400, { error: 'That folder does not exist on this computer.' }); const st = fs.statSync(dir); const files = st.isDirectory() ? listRoms(dir) : [{ path: dir, name: path.basename(dir), size: st.size }]; return send(res, 200, { files }); }
            if (u.pathname === '/api/ai' && req.method === 'POST') { /* relays one chat request to a model server running on THIS computer (llama.cpp / Ollama). Never leaves the machine. */
                const { url, body: payload } = await body(req); let tu; try { tu = new URL(String(url)); } catch (e) { return send(res, 400, { error: 'bad address' }); }
                if (!/^(127\.0\.0\.1|localhost|\[::1\])$/.test(tu.hostname) || !/^https?:$/.test(tu.protocol)) return send(res, 400, { error: 'The AI server must run on this computer (127.0.0.1).' });
                const data = JSON.stringify(payload), out = await new Promise(ok => { const q = require('http').request({ hostname: tu.hostname.replace(/^\[|\]$/g, ''), port: tu.port || 80, path: tu.pathname, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }, timeout: 240000 }, r => { const c = []; r.on('data', d => c.push(d)); r.on('end', () => { try { ok({ code: 200, j: JSON.parse(Buffer.concat(c).toString('utf8')) }); } catch (e) { ok({ code: 502, j: { error: 'The AI server sent something unreadable.' } }); } }); }); q.on('error', e => ok({ code: 502, j: { error: 'Could not reach the AI server at ' + tu.host + ' (is it running?)' } })); q.on('timeout', () => { q.destroy(); ok({ code: 504, j: { error: 'The AI server took too long.' } }); }); q.end(data); });
                return send(res, out.code, out.j); }
            if (u.pathname === '/api/scan-any' && req.method === 'POST') { const { file } = await body(req); if (!file || !fs.existsSync(file)) return send(res, 400, { error: 'File not found' }); const r = await NRScan.scanAny(file, { maxMs: 120000 }); if (r.skipped) return send(res, 200, r); const pl = loadPhys(), key = (r.name || path.basename(file)); const pre = r.presets || {}; pl.games[key] = { scanned: new Date().toISOString().slice(0, 10), vehicles: pre.vehicles || {}, characters: pre.characters || {}, weapons: pre.weapons || {}, light: pre.light || [], tables: (r.tables || []).map(t => ({ file: t.file, kind: t.kind, rows: t.rows, cols: t.cols, stats: t.stats, data: t.data })) }; fs.writeFileSync(PHYS, JSON.stringify(pl)); if (r.record) { const cur = loadLib(), i = cur.findIndex(c => c.id === r.record.id); if (i >= 0) cur[i] = Object.assign(r.record, { genre: cur[i].genre || '' }); else cur.push(r.record); saveLib(cur); } log('scan-any ' + file); return send(res, 200, { name: key, tables: (r.tables || []).map(t => ({ file: t.file, kind: t.kind, rows: t.rows, cols: t.cols })), vehicles: Object.keys(pre.vehicles || {}).length, characters: Object.keys(pre.characters || {}).length, weapons: Object.keys(pre.weapons || {}).length, light: (pre.light || []).length, files: r.discFiles || r.files, parts: r.parts || 1 }); }
            if (u.pathname === '/api/physics' && req.method === 'GET') return send(res, 200, loadPhys());
            if (u.pathname === '/api/scan' && req.method === 'POST') { const { file } = await body(req); if (!file || !fs.existsSync(file)) return send(res, 400, { error: 'File not found' }); const r = scanFile(file); if (r.record) { const cur = loadLib(), i = cur.findIndex(c => c.id === r.record.id); if (i >= 0) cur[i] = Object.assign(r.record, { genre: cur[i].genre || '' }); else cur.push(r.record); saveLib(cur); log('scanned ' + file); } return send(res, 200, r); }
            if (u.pathname === '/api/report') { const db = loadLib(); writeReport(db); return send(res, 200, fs.readFileSync(REPORT, 'utf8'), 'text/markdown'); }
            return send(res, 404, { error: 'unknown call' });
        } catch (e) { log('error ' + e.stack); return send(res, 500, { error: String(e.message || e) }); }
    };
}
function openBrowser(url) { try { if (process.platform === 'win32') cp.spawn('cmd', ['/c', 'start', '""', url], { stdio: 'ignore', detached: true }).unref(); else if (process.platform === 'darwin') cp.spawn('open', [url], { stdio: 'ignore', detached: true }).unref(); else cp.spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref(); } catch (e) {} }
function start(port = +process.env.NR_PORT || 8765, tries = 0) {
    const srv = http.createServer(); srv.on('request', handler(port));
    srv.on('error', e => { if (e.code === 'EADDRINUSE' && tries < 20) start(port + 1, tries + 1); else { console.error('Could not start: ' + e.message); process.exit(1); } });
    srv.listen(port, '127.0.0.1', () => { const url = `http://127.0.0.1:${port}/`; fs.mkdirSync(DATA, { recursive: true });
        console.log(`\n  NOTAREAL GAME STUDIO v1.4 is running (no internet needed).\n  Open: ${url}\n  Your data: ${DATA}\n  Keep this window open while you work. Close it to quit.\n`); log('started ' + url);
        if (!process.env.NR_NO_BROWSER) openBrowser(url); });
    return srv;
}
if (require.main === module || isSea || process.env.NR_RUN) start();
module.exports = { start, scanFile, listRoms };

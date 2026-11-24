/* localai.js - the bundled offline AI: starts llama.cpp's llama-server with a GGUF model that sits next to the program, and can download both
 * (one time, only when YOU press the button; after that nothing needs the internet). Layout, next to the program:
 *   ai/bin/llama-server(.exe)           ai/models/*.gguf   (Qwen 2.5 3B or 1.5B, about 2 GB or 1 GB)
 * The server only listens on 127.0.0.1. */
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http'), https = require('https');
const PORT = 18080, MODELS = [['qwen2.5-3b-instruct-q4_k_m.gguf', 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf'], ['qwen2.5-1.5b-instruct-q4_k_m.gguf', 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf']], MODEL_FILE = MODELS[0][0];
module.exports = function (HOME, log) {
    const dir = path.join(HOME, 'ai'), exe = path.join(dir, 'bin', process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'), mdir = path.join(dir, 'models');
    let proc = null, state = { phase: 'idle', msg: '', pct: 0 }, dl = null;
    const models = () => { try { return fs.readdirSync(mdir).filter(f => /\.gguf$/i.test(f) && !/\.part$/i.test(f)).sort((a, b) => (b === MODEL_FILE) - (a === MODEL_FILE)); } catch (e) { return []; } };
    const get = (url, to, depth = 0) => new Promise((ok, no) => { if (depth > 6) return no(new Error('too many redirects')); const u = new URL(url); (u.protocol === 'http:' ? http : https).get(u, { headers: { 'user-agent': 'NotarealStudio' } }, r => { if ([301, 302, 303, 307, 308].includes(r.statusCode)) { r.resume(); return get(new URL(r.headers.location, url).href, to, depth + 1).then(ok, no); } if (r.statusCode !== 200) { r.resume(); return no(new Error('HTTP ' + r.statusCode)); } const total = +r.headers['content-length'] || 0; let got = 0; const w = to ? fs.createWriteStream(to) : null, buf = []; r.on('data', d => { got += d.length; if (w) w.write(d); else buf.push(d); if (total) state.pct = Math.floor(got / total * 100); }); r.on('end', () => { if (w) w.end(() => ok(to)); else ok(Buffer.concat(buf)); }); r.on('error', no); }).on('error', no); });
    const ping = () => new Promise(ok => { const q = http.get({ hostname: '127.0.0.1', port: PORT, path: '/health', timeout: 1500 }, r => { r.resume(); ok(r.statusCode === 200); }); q.on('error', () => ok(false)); q.on('timeout', () => { q.destroy(); ok(false); }); });
    const api = {
        port: PORT,
        status: async () => ({ hasServer: fs.existsSync(exe), models: models(), running: !!proc, ready: proc ? await ping() : false, phase: state.phase, msg: state.msg, pct: state.pct, dir, port: PORT, modelGB: 2.1 }),
        start: async (model) => {
            if (proc) return { ok: true, msg: 'already running' }; if (!fs.existsSync(exe)) return { ok: false, msg: 'llama-server is not installed yet (ai/bin). Press "Download the AI" or copy it there.' };
            const m = model || models()[0]; if (!m) return { ok: false, msg: 'No model file in ai/models. Press "Download the AI" or copy a .gguf file there.' };
            const threads = Math.max(2, Math.min(8, (require('os').cpus().length || 4) - 1));
            proc = cp.spawn(exe, ['-m', path.join(mdir, m), '--host', '127.0.0.1', '--port', String(PORT), '-c', '4096', '-t', String(threads)], { stdio: 'ignore', windowsHide: true, cwd: path.dirname(exe) });
            proc.on('exit', c => { log('llama-server exited ' + c); proc = null; state = { phase: 'idle', msg: 'AI stopped', pct: 0 }; }); proc.on('error', e => { log('llama-server error ' + e.message); proc = null; state = { phase: 'error', msg: String(e.message), pct: 0 }; });
            state = { phase: 'loading', msg: 'Loading the model (30-90 seconds the first time)...', pct: 0 };
            for (let i = 0; i < 240 && proc; i++) { if (await ping()) { state = { phase: 'ready', msg: 'AI ready', pct: 100 }; return { ok: true, msg: 'ready' }; } await new Promise(r => setTimeout(r, 1000)); }
            return { ok: false, msg: 'The model did not load (not enough memory?).' };
        },
        stop: () => { if (proc) { try { proc.kill(); } catch (e) {} proc = null; } state = { phase: 'idle', msg: '', pct: 0 }; return { ok: true }; },
        /* one-time download of the model and llama.cpp (Windows CPU build). Runs in the background; poll status(). */
        download: async () => {
            if (dl) return { ok: true, msg: 'already downloading' }; dl = true;
            (async () => { try {
                fs.mkdirSync(path.join(dir, 'bin'), { recursive: true }); fs.mkdirSync(mdir, { recursive: true });
                if (!fs.existsSync(exe)) { state = { phase: 'download', msg: 'Finding the AI engine (llama.cpp)...', pct: 0 }; const rel = JSON.parse((await get('https://api.github.com/repos/ggml-org/llama.cpp/releases/latest')).toString()), want = process.platform === 'win32' ? /bin-win-cpu-x64\.zip$|bin-win-avx2-x64\.zip$/ : /bin-ubuntu-x64\.(zip|tar\.gz)$/, a = (rel.assets || []).find(x => want.test(x.name)); if (!a) throw new Error('No matching llama.cpp download found'); state = { phase: 'download', msg: 'Downloading the AI engine...', pct: 0 }; const z = path.join(dir, a.name); await get(a.browser_download_url, z); state = { phase: 'download', msg: 'Unpacking...', pct: 100 }; cp.execFileSync(process.platform === 'win32' ? 'tar' : 'unzip', process.platform === 'win32' ? ['-xf', z, '-C', path.join(dir, 'bin')] : ['-o', '-q', z, '-d', path.join(dir, 'bin')]); fs.unlinkSync(z);
                    if (!fs.existsSync(exe)) { const found = (function f(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { const r = f(p); if (r) return r; } else if (e.name === path.basename(exe)) return p; } })(path.join(dir, 'bin')); if (found) { for (const e of fs.readdirSync(path.dirname(found))) fs.copyFileSync(path.join(path.dirname(found), e), path.join(dir, 'bin', e)); } } }
                if (!models().length) { let done = false, lastErr; for (const [fn, url] of MODELS) { try { state = { phase: 'download', msg: 'Downloading the model ' + fn + ' (one time)...', pct: 0 }; const part = path.join(mdir, fn + '.part'); await get(url, part); fs.renameSync(part, path.join(mdir, fn)); done = true; break; } catch (e) { lastErr = e; try { fs.unlinkSync(path.join(mdir, fn + '.part')); } catch (x) {} } } if (!done) throw lastErr; }
                state = { phase: 'idle', msg: 'Download finished', pct: 100 };
            } catch (e) { state = { phase: 'error', msg: 'Download failed: ' + e.message + '. You can copy the files into ' + dir + ' yourself.', pct: 0 }; } dl = null; })();
            return { ok: true, msg: 'started' };
        },
    };
    return api;
};

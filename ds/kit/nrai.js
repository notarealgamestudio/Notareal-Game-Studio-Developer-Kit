/* nrai.js (v1.1) - optional local AI helper. Works without any AI: heuristicPlan() turns a sentence into a plan with keywords.
 * With a local model (llama.cpp server or Ollama running on THIS computer) the plan, story lines and level fixes get smarter.
 * The AI only ever returns small JSON (words and numbers). The builder does the building, the checker proves levels work.
 * AI.plan(text, llm)  -> {title, genre, theme, levels, story, hero, source:'ai'|'keywords'}
 * AI.make(text, base, llm, onStep) -> {plan, template, project|config}   llm(prompt) -> Promise<string> (or null for no AI) */
(function (root) {
    'use strict';
    const AI = {}, Builder = typeof require === 'function' && typeof module !== 'undefined' ? require('./nrbuilder.js') : root.NRBuilder, Tpl = typeof require === 'function' && typeof module !== 'undefined' ? require('./nrtemplates.js') : root.NRTemplates;
    AI.safeJson = txt => { if (!txt) return null; const m = String(txt).replace(/```(?:json)?/g, '').match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch (e) { try { return JSON.parse(m[0].replace(/,\s*([}\]])/g, '$1').replace(/'/g, '"')); } catch (x) { return null; } } };
    const KEYS = [[/convenience store|corner store|shopkeep|cashier|job sim|stock(ing)? shelves|quick ?mart|gas station|night shift/i, 'job_sim'], [/skate|skateboard|tony hawk|\bthps?\b|kickflip/i, 'trick_sports'], [/zombie|call of duty|halo|military|soldier|war game|warfare|\bcod\b|special ops/i, 'military_shooter'], [/bracelet|jewel|friendship|bead|craft shop/i, 'crafting_sim'], [/fallout|wasteland|post.?apoc|survival|berea|after the fall/i, 'survival_rpg'], [/pokemon|monster.?catch|catch.*monster|creature collect|monster collect/i, 'monster_rpg'], [/gta|san andreas|open.?world|sandbox/i, 'open_world_2d'], [/baseball|batting/i, 'baseball'], [/wrestl|ring|ppv/i, 'wrestling'], [/fight|fighter|versus|vs\b|street/i, 'fighting'], [/brawl|beat.?em|belt/i, 'beat_em_up'], [/shmup|shoot.?em|space ship|spaceship|bullet/i, 'shmup'], [/fps|first.?person|doom|corridor/i, 'shooter_fps'], [/third.?person|tps|cover shooter/i, 'shooter_tps'], [/race|racing|\bcar\b|kart/i, 'racing'], [/farm|crop|harvest|stardew/i, 'farm_sim'], [/city|town builder|tycoon|build a town/i, 'city_builder'], [/god game|villager/i, 'god_sim'], [/rpg|quest|monster|party|jrpg/i, 'jrpg'], [/puzzle|match|gem|block|tetris/i, 'puzzle_falling'], [/memory|cards|pairs/i, 'memory_puzzle'], [/breakout|paddle|brick/i, 'breakout'], [/basket|hoop|dunk/i, 'basketball'], [/color|colour|paint/i, 'coloring_book'], [/music|song|beat maker/i, 'music_maker'], [/run|runner|endless/i, 'runner'], [/kid|toddler|easy/i, 'kids_first'], [/collect|coin|gather/i, 'collectathon2d'], [/zelda|adventure|explore|dungeon|open world|overworld/i, 'action_adventure'], [/platform|jump|mario|side.?scroll/i, 'platformer']];
    const THEMES = ['forest', 'castle', 'space', 'cave', 'city', 'ice', 'fire', 'ocean', 'desert', 'factory'];
    AI.heuristicPlan = text => {
        const t = String(text || ''); let genre = 'platformer'; for (const [re, g] of KEYS) if (re.test(t)) { genre = g; break; } if (/kart/i.test(t)) genre = 'kart_racing';
        const theme = THEMES.find(x => new RegExp(x + (x === 'city' ? '|street|town' : x === 'space' ? '|star|galaxy|alien' : x === 'castle' ? '|haunted|ghost|knight' : x === 'fire' ? '|lava|volcano' : x === 'ocean' ? '|sea|water|pirate|island' : ''), 'i').test(t)) || 'forest';
        const n = +(t.match(/(\d+)\s*(levels?|stages?|worlds?)/i) || [])[1] || 3, quoted = (t.match(/["“]([^"”]{2,30})["”]/) || [])[1], words = t.replace(/[^a-z0-9 ]/gi, ' ').split(/\s+/).filter(w => w.length > 3 && !/^(make|game|with|that|about|where|have|levels|stages|please|want|like|called)$/i.test(w));
        const title = (quoted || ((theme[0].toUpperCase() + theme.slice(1)) + ' ' + (words.find(w => !new RegExp(theme, 'i').test(w)) || 'Quest')).replace(/\b\w/g, c => c.toUpperCase())).slice(0, 30);
        return { title, genre, theme, levels: Math.max(1, Math.min(12, n)), story: '', hero: '', source: 'keywords' };
    };
    AI.PLAN_PROMPT = text => `You design small retro games. User request: "${String(text).slice(0, 400)}"\nAnswer with JSON only, no other words:\n{"title":"max 30 letters","genre":"one of: ${Tpl.ids().join(', ')}","theme":"one of: ${THEMES.join(', ')}","levels":3,"story":"one sentence, max 100 letters","hero":"short description"}`;
    AI.plan = async (text, llm) => {
        const fallback = AI.heuristicPlan(text); if (!llm) return fallback;
        try { const j = AI.safeJson(await llm(AI.PLAN_PROMPT(text), { maxTokens: 220 })); if (!j) return Object.assign(fallback, { note: 'AI answer was not usable; used keywords' });
            const ids = Tpl.ids(); return { title: String(j.title || fallback.title).slice(0, 30), genre: ids.includes(j.genre) ? j.genre : fallback.genre, theme: THEMES.includes(j.theme) ? j.theme : fallback.theme, levels: Math.max(1, Math.min(12, +j.levels || fallback.levels)), story: String(j.story || '').slice(0, 100), hero: String(j.hero || '').slice(0, 60), source: 'ai' };
        } catch (e) { return Object.assign(fallback, { note: 'AI not reachable: ' + e.message }); }
    };
    AI.make = async (text, base, llm, onStep, mo = {}) => {
        const say = m => { try { onStep && onStep(m); } catch (e) {} }; say('Planning...'); const plan = await AI.plan(text, llm); say(`Plan (${plan.source}): ${plan.title}, ${plan.genre}, ${plan.theme}, ${plan.levels} levels`);
        const tpl = Tpl.get(plan.genre); say('Building from the ' + tpl.name + ' template...'); const out = Tpl.apply(tpl.id, base, { title: plan.title, theme: plan.theme, levels: plan.levels, story: plan.story, seed: Date.now() % 100000, console: mo.console });
        if (llm && out.project && plan.story) { try { const j = AI.safeJson(await llm(`Write 3 short cutscene lines (max 90 letters each) for the game "${plan.title}" (${plan.theme}). Story: ${plan.story}\nJSON only: {"intro":"...","middle":"...","ending":"..."}`, { maxTokens: 200 })); if (j) { out.project.cutscenes = [{ type: 'narration', text: String(j.intro || '').slice(0, 100), duration: 200 }, { type: 'narration', text: String(j.middle || '').slice(0, 100), duration: 200 }, { type: 'victory', text: String(j.ending || '').slice(0, 100), duration: 240 }]; say('Story lines written.'); } } catch (e) { say('Story lines skipped.'); } }
        say('Done.'); return Object.assign({ plan, template: tpl }, out);
    };
    /* art tools: textures, ground tiles, backgrounds. With a local model it picks the tool and arguments; without one, keywords do. The maths draws the picture. */
    AI.art = async (text, llm) => { const X = typeof require === 'function' && typeof module !== 'undefined' ? require('./nrtex.js') : root.NRTex; let plan = X.fromPrompt(text), note = '';
        if (llm) { try { const j = AI.safeJson(await llm('Pick an art tool for: "' + String(text).slice(0, 200) + '"\nTools: ' + JSON.stringify(X.TOOLS) + '\nAnswer JSON only: {"tool":"texture|tileset|background","args":{...},"console":"optional"}', { maxTokens: 120 })); if (j && ['texture', 'tileset', 'background'].includes(j.tool) && j.args) { const ok = j.tool === 'background' ? X.backgrounds().includes(j.args.kind) : X.kinds().includes(j.args.kind); if (ok) plan = { tool: j.tool, args: Object.assign({}, plan.args, j.args), console: j.console || plan.console }; else note = 'model chose an unknown kind; used keywords'; } } catch (e) { note = 'AI not reachable'; } }
        return { plan, image: X.run(plan.tool, plan.args, plan.console), note }; };
    /* ask about a console problem: known fixes first (works offline); with a local model, the model gets the console facts and the matching fixes as context */
    AI.help = async (question, con, llm, extra) => {
        const K = typeof require === 'function' && typeof module !== 'undefined' ? require('./nrknowledge.js') : root.NRKnowledge, hits = K.lookup(question, con, extra).slice(0, 4), out = { fixes: hits.map(h => h.fix), answer: null };
        if (llm) { try { out.answer = await llm(K.context(con, question, extra) + 'Question from a game maker: ' + String(question).slice(0, 400) + '\nAnswer in 3 short plain sentences. Use the known fixes if they match; do not invent hardware facts.', { maxTokens: 220 }); } catch (e) { out.note = 'AI not reachable: ' + e.message; } }
        return out;
    };
    /* talk to a local server on this computer. kind: 'llama' (llama.cpp /v1/chat/completions) or 'ollama' (/api/chat). fetchFn lets the desktop program route it through its own server. */
    AI.client = (cfg = {}, fetchFn) => {
        const f = fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null), url = cfg.url || (cfg.kind === 'ollama' ? 'http://127.0.0.1:11434' : 'http://127.0.0.1:8080');
        if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?/.test(url)) throw new Error('The AI server must run on this computer (127.0.0.1).');
        return async (prompt, o = {}) => {
            const msgs = [{ role: 'user', content: prompt }];
            if (cfg.kind === 'ollama') { const r = await f(url + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: cfg.model || 'qwen2.5:7b', messages: msgs, stream: false, options: { temperature: .6, num_predict: o.maxTokens || 300 } }) }); const j = await r.json(); return j.message && j.message.content; }
            const r = await f(url + '/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: cfg.model || 'local', messages: msgs, temperature: .6, max_tokens: o.maxTokens || 300 }) }); const j = await r.json(); return j.choices && j.choices[0] && j.choices[0].message.content;
        };
    };
    if (typeof module !== 'undefined') module.exports = AI; else root.NRAI = AI;
})(typeof window !== 'undefined' ? window : globalThis);

/* SIXTH SEAL: Memphis Underground. Game-logic layer for the Memphis Sigil music maker, written from the product handoff:
 * a six-slot mixtape of editable beat data (not audio), the virtual rack (Graveyard Drums, Bone Sampler, Black Bass, Crypt Keys, Tape Deck) with curated presets,
 * the six sigils that unlock sounds, beat-battle scoring from measurable pattern properties, weekend DJ-gig scoring from saved-track metadata, cash and respect,
 * a day clock and the districts of The Hollow. Everything is plain data and pure functions (node + editor), so the studio, the DS engine and the PC build can share it.
 * Original names and fictional lore only. The DS engine today plays the drum/sequencer part (nrsigil.js); this layer is the progression and save model around it. */
(function (root) {
'use strict';
const X = {}; X.VER = 1; X.SLOTS = 6; X.STEPS = 16;
/* ---------------- the rack */
X.KITS = [
    { id: 'dust', name: 'Dusty Tape', voices: ['KICK', 'SNR', 'CLAP', 'CHAT', 'OHAT', 'RIM', 'COWB', 'PERC'], snd: [0, 2, 3, 4, 5, 7, 6, 9], sigil: null, about: 'Warm clipped kicks, dry snares, gritty hats.' },
    { id: 'crypt', name: 'Crypt Punch', voices: ['PNCH', 'SNR', 'CLAP', 'CHAT', 'OHAT', 'RIM', 'METL', 'PERC'], snd: [1, 2, 3, 4, 5, 7, 8, 9], sigil: null, about: 'Tight punchy kick and metal hats.' },
    { id: 'grave', name: 'Grave Mark Distorted', voices: ['KICK', 'SNR', 'CLAP', 'METL', 'OHAT', 'COWB', 'PERC', 'BASS'], snd: [0, 11, 3, 8, 5, 6, 9, 10], sigil: 'grave_mark', about: 'Crushed drums for the dark end of the tape.' },
    { id: 'serpent', name: 'Serpent Groove', voices: ['PNCH', 'SNR', 'CLAP', 'CHAT', 'OHAT', 'COWB', 'RIM', 'PERC'], snd: [1, 2, 3, 4, 5, 6, 7, 9], sigil: 'serpent_groove', about: 'Bouncy funk pocket.' }
];
X.BASS = [['Sub 808', 'sub'], ['Black Bass', 'saw'], ['Reverend Drone', 'drone'], ['Cassette Wobble', 'wobble'], ['Hollow Square', 'square'], ['Distorted Low', 'dist'], ['Serpent Funk', 'funk'], ['Graveyard Growl', 'growl']].map((a, i) => ({ id: i, name: a[0], wave: a[1], sigil: i === 6 ? 'serpent_groove' : i === 7 ? 'grave_mark' : null }));
X.KEYS = [['Minor Piano', 'piano'], ['Haunted Organ', 'organ'], ['Choir Pad', 'choir'], ['Cold Strings', 'strings'], ['Detuned Bells', 'bells'], ['Black Candle Pad', 'pad', 'black_candle'], ['Chapel Choir', 'choir2', 'hollow_eye'], ['Radio Ghost', 'noise', 'dead_frequency'], ['Church Organ Slow', 'organ2'], ['Vinyl Keys', 'ep'], ['Fog Pad', 'pad2', 'black_candle'], ['Funk Clav', 'clav', 'serpent_groove']].map((a, i) => ({ id: i, name: a[0], wave: a[1], sigil: a[2] || null }));
X.PADS = ['Vinyl Crackle', 'Radio Noise', 'Choir Hit', 'Bell Toll', 'Tape Stop', 'Door Creak', 'Whisper', 'Organ Stab', 'Horror Drone', 'Candle Hiss', 'Ghost Vox', 'Chain Rattle'].map((n, i) => ({ id: i, name: n, sigil: i === 8 || i === 10 ? 'hollow_eye' : null }));
X.TAPE = [{ id: 0, name: 'Clean', sat: 0, hiss: 0, lo: 0, wow: 0 }, { id: 1, name: 'Warm Cassette', sat: 30, hiss: 10, lo: 20, wow: 10 }, { id: 2, name: 'Worn Tape', sat: 50, hiss: 30, lo: 45, wow: 30 }, { id: 3, name: 'Radio Static', sat: 20, hiss: 60, lo: 60, wow: 15, sigil: 'dead_frequency' }, { id: 4, name: 'Dead Frequency', sat: 70, hiss: 55, lo: 70, wow: 55, sigil: 'dead_frequency' }];
/* curated combinations (drum kit + bass + keys + tape + tempo + starter grooves) that sound good together */
X.PRESETS = [
    { name: 'Dark Kit + Sub + Choir', kit: 'dust', bass: 0, keys: 2, tape: 1, bpm: 78 }, { name: 'Basement Reverend', kit: 'dust', bass: 2, keys: 8, tape: 2, bpm: 66 }, { name: 'Boom Bap Ghost', kit: 'dust', bass: 0, keys: 0, tape: 1, bpm: 92 },
    { name: 'Chapel Bells', kit: 'crypt', bass: 1, keys: 4, tape: 1, bpm: 84 }, { name: 'Cold Strings Trap', kit: 'crypt', bass: 0, keys: 3, tape: 0, bpm: 140 }, { name: 'Blackout Tape', kit: 'grave', bass: 5, keys: 7, tape: 4, bpm: 70 },
    { name: 'Hollow Choir', kit: 'grave', bass: 7, keys: 6, tape: 2, bpm: 74 }, { name: 'Serpent Pocket', kit: 'serpent', bass: 6, keys: 11, tape: 1, bpm: 98 }, { name: 'Fog Walker', kit: 'dust', bass: 3, keys: 10, tape: 2, bpm: 80 },
    { name: 'Candle Room', kit: 'crypt', bass: 4, keys: 5, tape: 1, bpm: 72 }
];
X.unlocked = (prog, item) => !item.sigil || prog.sigils.includes(item.sigil);
/* ---------------- the six sigils */
X.SIGILS = [
    { id: 'grave_mark', name: 'Grave Mark', unlocks: 'Distorted drum kit, Graveyard Growl bass', how: 'Cemetery quest', place: 'The Graveyard' },
    { id: 'hollow_eye', name: 'Hollow Eye', unlocks: 'Horror and ambient samples, Chapel Choir', how: 'Chapel quest', place: 'The Chapel' },
    { id: 'sixfold_seal', name: 'Sixfold Seal', unlocks: 'The sixth instrument layer: a second keys part', how: 'Main storyline', place: 'The Hollow' },
    { id: 'black_candle', name: 'Black Candle', unlocks: 'Ambient and pad presets', how: 'Club reputation milestone (30 respect)', place: 'The Blacklight Club', respect: 30 },
    { id: 'serpent_groove', name: 'Serpent Groove', unlocks: 'Funk bass, Serpent kit, Funk Clav', how: 'Win a beat battle', place: 'The Strip' },
    { id: 'dead_frequency', name: 'Dead Frequency', unlocks: 'Radio Static and Dead Frequency tape', how: 'Hidden studio quest', place: 'The Underground Studio' }
];
X.DISTRICTS = [{ id: 'strip', name: 'The Strip', what: 'Hub: shops, producers, errands, equipment' }, { id: 'club', name: 'The Blacklight Club', what: 'Saturday DJ gigs: cash and reputation' }, { id: 'graveyard', name: 'The Graveyard', what: 'Secrets and hidden sigils' }, { id: 'chapel', name: 'The Chapel', what: 'Lore, rare presets, story events' }, { id: 'studio', name: 'The Underground Studio', what: 'Home base: make and edit beats' }];
X.DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/* ---------------- mixtape: six slots of editable data */
X.blankBeat = (name = '') => ({ name, used: false, bpm: 90, kit: 'dust', swing: 0, bass: 0, keys: 0, tape: 1, drums: Array.from({ length: 8 }, () => new Array(16).fill(0)), bassNotes: new Array(16).fill(-1), keyNotes: new Array(16).fill(-1), pads: new Array(8).fill(-1), padSteps: new Array(16).fill(0), mix: { drums: 100, bass: 100, keys: 90, pads: 90, master: 110 } });
X.newTape = () => ({ ver: X.VER, title: 'TAPE 001', slots: Array.from({ length: X.SLOTS }, (_, i) => X.blankBeat('TRACK 0' + (i + 1))) });
X.newProgress = () => ({ ver: X.VER, cash: 0, respect: 0, day: 0, week: 1, sigils: [], flags: {}, hollow: false, battlesWon: 0, gigs: 0, rivalsBeaten: [] });
X.filled = tape => tape.slots.filter(s => s.used).length;
X.complete = tape => X.filled(tape) === X.SLOTS;
/* save a beat into a slot; never silently erases: overwriting a used slot needs confirm:true */
X.saveBeat = (tape, i, beat, opt = {}) => { if (i < 0 || i >= X.SLOTS) throw new Error('slot out of range'); if (tape.slots[i].used && !opt.confirm) return { ok: false, needsConfirm: true }; tape.slots[i] = Object.assign(JSON.parse(JSON.stringify(beat)), { used: true, name: String(beat.name || 'TRACK 0' + (i + 1)).toUpperCase().slice(0, 14) }); return { ok: true, unlockedHollow: X.complete(tape) }; };
/* unlock the RPG once all six slots are saved */
X.checkUnlock = (tape, prog) => { if (!prog.hollow && X.complete(tape)) { prog.hollow = true; return true; } return false; };
/* ---------------- measurable properties of a beat (used by battles and gigs: no pretending to judge taste) */
X.analyse = b => { const hits = b.drums.map(r => r.filter(v => v > 0).length), total = hits.reduce((a, c) => a + c, 0), voices = hits.filter(n => n > 0).length, bassN = b.bassNotes.filter(n => n >= 0).length, keyN = b.keyNotes.filter(n => n >= 0).length, padN = b.padSteps.filter(v => v > 0).length, uniqBass = new Set(b.bassNotes.filter(n => n >= 0)).size, offbeat = b.drums.reduce((a, r) => a + r.filter((v, s) => v > 0 && s % 4).length, 0);
    return { drumHits: total, drumVoices: voices, variation: Math.min(1, (voices / 5) * .6 + (offbeat / Math.max(1, total)) * .6), bassNotes: bassN, bassUnique: uniqBass, keyNotes: keyN, padHits: padN, density: (total + bassN + keyN + padN) / 64, kick: hits[0] > 0, snare: hits[1] > 0, bpm: b.bpm, tape: b.tape, kit: b.kit, keys: b.keys, bass: b.bass }; };
/* ---------------- beat battles */
X.RIVALS = [
    { id: 'phantom', name: 'DJ Phantom', style: 'horror samples, distorted drums', challenge: { kit: 'grave', minPads: 2, bpmMin: 60, bpmMax: 90 }, reward: { cash: 120, respect: 8 }, sigil: null },
    { id: 'reverend', name: 'The Reverend', style: 'organ, slow beats', challenge: { keysWave: ['organ', 'organ2'], bpmMax: 76, bassMin: 4 }, reward: { cash: 100, respect: 8 }, sigil: null },
    { id: 'cemetery', name: "Lil' Cemetery", style: 'heavy bass and percussion', challenge: { bassMin: 8, drumVoices: 4 }, reward: { cash: 140, respect: 10 }, sigil: 'serpent_groove' },
    { id: 'ghost', name: 'The Memphis Ghost', style: 'tape-worn, soulful textures', challenge: { tapeMin: 2, keysMin: 4, bpmMax: 90 }, reward: { cash: 180, respect: 14 }, sigil: null }
];
X.scoreBattle = (beat, rival) => { const a = X.analyse(beat), c = rival.challenge, checks = [], add = (k, ok, why) => checks.push({ k, ok, why }), kitOf = X.KITS.find(k => k.id === beat.kit), keyOf = X.KEYS[beat.keys];
    if (c.kit) add('kit', beat.kit === c.kit, 'Use the ' + X.KITS.find(k => k.id === c.kit).name + ' kit'); if (c.minPads) add('pads', a.padHits >= c.minPads, 'Trigger at least ' + c.minPads + ' sample pads'); if (c.bpmMin) add('tempo', a.bpm >= c.bpmMin, 'Tempo ' + c.bpmMin + ' or faster'); if (c.bpmMax) add('tempo max', a.bpm <= c.bpmMax, 'Tempo ' + c.bpmMax + ' or slower');
    if (c.keysWave) add('organ', !!keyOf && c.keysWave.includes(keyOf.wave), 'Play an organ preset'); if (c.bassMin) add('bass', a.bassNotes >= c.bassMin, 'At least ' + c.bassMin + ' bass notes'); if (c.drumVoices) add('percussion', a.drumVoices >= c.drumVoices, 'Use at least ' + c.drumVoices + ' drum voices');
    if (c.tapeMin) add('tape', beat.tape >= c.tapeMin, 'Tape coloration at "Worn Tape" or heavier'); if (c.keysMin) add('keys', a.keyNotes >= c.keysMin, 'At least ' + c.keysMin + ' keyboard notes');
    const comp = checks.length ? checks.filter(x => x.ok).length / checks.length : 1, parts = { compliance: Math.round(comp * 40), drums: Math.round(Math.min(1, a.drumHits / 14) * 15 + a.variation * 10), bass: a.bassNotes >= 3 ? 15 : Math.round(a.bassNotes * 5), melody: Math.min(10, a.keyNotes * 2 + a.padHits * 2), tempo: a.bpm >= 60 && a.bpm <= 180 ? 10 : 0 }, total = Object.values(parts).reduce((x, y) => x + y, 0);
    return { total, parts, checks, win: comp === 1 && total >= 60, why: checks.filter(x => !x.ok).map(x => x.why) }; };
X.finishBattle = (prog, rival, res) => { if (!res.win) return { cash: 0, respect: 1 }; prog.cash += rival.reward.cash; prog.respect += rival.reward.respect; prog.battlesWon++; if (!prog.rivalsBeaten.includes(rival.id)) prog.rivalsBeaten.push(rival.id); if (rival.sigil) X.grant(prog, rival.sigil); X.milestones(prog); return rival.reward; };
/* ---------------- DJ gig: three tracks in an order; mood from saved-pattern metadata plus stylus timing prompts (0..1 each) */
X.scoreGig = (tape, order, timing = [.8, .8, .8], crowd = { likes: ['dark', 'heavy', 'tempo'] }) => { if (order.length !== 3 || new Set(order).size !== 3) throw new Error('pick three different tracks'); let mood = 40; const log = []; order.forEach((si, n) => { const b = tape.slots[si]; if (!b.used) throw new Error('slot ' + (si + 1) + ' is empty'); const a = X.analyse(b); let d = Math.round(a.variation * 10 + Math.min(10, a.density * 14)); const prev = n ? tape.slots[order[n - 1]] : null; if (prev && Math.abs(prev.bpm - b.bpm) <= 14) { d += 6; log.push('Smooth tempo change into ' + b.name); } else if (prev) { d -= 4; log.push('Big tempo jump into ' + b.name); } if (b.tape >= 2 && crowd.likes.includes('dark')) { d += 4; log.push(b.name + ' has the tape-worn sound the club likes'); } if (a.bassNotes >= 6 && crowd.likes.includes('heavy')) { d += 4; log.push(b.name + ': bass hits'); } d += Math.round(timing[n] * 10); mood += d; });
    mood = Math.max(0, Math.min(100, mood)); return { mood, cash: Math.round(mood * 1.4), respect: Math.round(mood / 8), log }; };
X.finishGig = (prog, res) => { prog.cash += res.cash; prog.respect += res.respect; prog.gigs++; X.milestones(prog); return res; };
/* ---------------- progression */
X.grant = (prog, id) => { if (!X.SIGILS.some(s => s.id === id)) throw new Error('unknown sigil ' + id); if (!prog.sigils.includes(id)) { prog.sigils.push(id); return true; } return false; };
X.milestones = prog => { const g = []; if (prog.respect >= 30 && X.grant(prog, 'black_candle')) g.push('black_candle'); if (prog.hollow && prog.battlesWon >= 3 && prog.gigs >= 2 && X.grant(prog, 'sixfold_seal')) g.push('sixfold_seal'); return g; };
X.nextDay = prog => { prog.day = (prog.day + 1) % 7; if (prog.day === 0) prog.week++; return { day: X.DAYS[prog.day], saturday: prog.day === 5, sunday: prog.day === 6 }; };
X.questSigil = (prog, quest) => { const m = { cemetery: 'grave_mark', chapel: 'hollow_eye', studio_secret: 'dead_frequency' }[quest]; if (!m) throw new Error('unknown quest'); if (!prog.hollow) return { ok: false, why: 'Finish the six-track mixtape first.' }; return { ok: true, sigil: m, new: X.grant(prog, m) }; };
/* what the player can pick right now */
X.available = prog => ({ kits: X.KITS.filter(k => X.unlocked(prog, k)), bass: X.BASS.filter(k => X.unlocked(prog, k)), keys: X.KEYS.filter(k => X.unlocked(prog, k)), pads: X.PADS.filter(k => X.unlocked(prog, k)), tape: X.TAPE.filter(k => X.unlocked(prog, k)) });
/* ---------------- versioned save with CRC (six slots; the sample audio stays in ROM, only IDs and parameters are stored) */
const CT = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; CT[i] = c >>> 0; }
const crc = (b, n) => { let c = 0xFFFFFFFF; for (let i = 0; i < n; i++) c = CT[(c ^ b[i]) & 255] ^ (c >>> 8); return (~c) >>> 0; };
const KITIDS = X.KITS.map(k => k.id);
X.pack = (tape, prog) => { const o = [83, 83, 77, 49, X.VER, 0]; const u8 = v => o.push(v & 255), u16 = v => { u8(v); u8(v >> 8); };
    const t = String(tape.title || 'TAPE 001').slice(0, 14).padEnd(14, ' '); for (const ch of t) u8(ch.charCodeAt(0) & 127);
    for (const s of tape.slots) { u8(s.used ? 1 : 0); const n = String(s.name || '').slice(0, 14).padEnd(14, ' '); for (const ch of n) u8(ch.charCodeAt(0) & 127); u16(s.bpm); u8(KITIDS.indexOf(s.kit)); u8(s.swing); u8(s.bass); u8(s.keys); u8(s.tape); for (const r of s.drums) { let bits = 0; r.forEach((v, i) => { if (v) bits |= 1 << i; }); u16(bits); } s.bassNotes.forEach(v => u8(v + 1)); s.keyNotes.forEach(v => u8(v + 1)); s.pads.forEach(v => u8(v + 1)); let pb = 0; s.padSteps.forEach((v, i) => { if (v) pb |= 1 << i; }); u16(pb); u8(s.mix.drums); u8(s.mix.bass); u8(s.mix.keys); u8(s.mix.pads); u8(s.mix.master); }
    u8(prog.hollow ? 1 : 0); u16(prog.cash); u16(prog.respect); u8(prog.day); u8(prog.week); u8(prog.battlesWon); u8(prog.gigs); let sb = 0; X.SIGILS.forEach((s, i) => { if (prog.sigils.includes(s.id)) sb |= 1 << i; }); u8(sb);
    const b = Uint8Array.from(o), c = crc(b, b.length), out = new Uint8Array(b.length + 4); out.set(b); out.set([c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24], b.length); return out; };
X.unpack = b => { try { const n = b.length; if (n < 12) return { ok: 1 }; if (b[0] !== 83 || b[1] !== 83 || b[2] !== 77 || b[3] !== 49) return { ok: 2 }; if (b[4] > X.VER) return { ok: 3 }; const c = crc(b, n - 4), s = (b[n - 4] | b[n - 3] << 8 | b[n - 2] << 16 | b[n - 1] << 24) >>> 0; if (c !== s) return { ok: 4 };
    let p = 6; const u8 = () => b[p++], u16 = () => { const v = b[p] | b[p + 1] << 8; p += 2; return v; }, str = l => { let t = ''; for (let i = 0; i < l; i++) t += String.fromCharCode(u8()); return t.trimEnd(); };
    const tape = X.newTape(); tape.title = str(14); for (let i = 0; i < X.SLOTS; i++) { const s = tape.slots[i]; s.used = !!u8(); s.name = str(14); s.bpm = u16(); s.kit = KITIDS[u8()] || 'dust'; s.swing = u8(); s.bass = u8(); s.keys = u8(); s.tape = u8(); for (let r = 0; r < 8; r++) { const bits = u16(); for (let k = 0; k < 16; k++) s.drums[r][k] = bits >> k & 1 ? 100 : 0; } for (let k = 0; k < 16; k++) s.bassNotes[k] = u8() - 1; for (let k = 0; k < 16; k++) s.keyNotes[k] = u8() - 1; for (let k = 0; k < 8; k++) s.pads[k] = u8() - 1; const pb = u16(); for (let k = 0; k < 16; k++) s.padSteps[k] = pb >> k & 1; s.mix = { drums: u8(), bass: u8(), keys: u8(), pads: u8(), master: u8() }; }
    const prog = X.newProgress(); prog.hollow = !!u8(); prog.cash = u16(); prog.respect = u16(); prog.day = u8(); prog.week = u8(); prog.battlesWon = u8(); prog.gigs = u8(); const sb = u8(); X.SIGILS.forEach((s, i) => { if (sb >> i & 1) prog.sigils.push(s.id); }); if (p !== n - 4) return { ok: 5 }; return { ok: 0, tape, prog }; } catch (e) { return { ok: 6 }; } };
/* a playable starter beat from a preset, so the first screen already sounds right */
X.fromPreset = (pr, seed = 1) => { let s = seed >>> 0 || 1; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296, b = X.blankBeat(pr.name.toUpperCase().slice(0, 14)); b.bpm = pr.bpm; b.kit = pr.kit; b.bass = pr.bass; b.keys = pr.keys; b.tape = pr.tape; [0, 6, 10].forEach(i => b.drums[0][i] = 120); [4, 12].forEach(i => b.drums[1][i] = 110); for (let i = 0; i < 16; i += 2) b.drums[3][i] = i % 4 ? 70 : 95; if (r() < .6) b.drums[2][12] = 90; for (let i = 0; i < 16; i += 4) b.bassNotes[i] = [0, 0, 3, 7, 5][Math.floor(r() * 5)]; b.bassNotes[10] = 7; [0, 6, 8, 14].forEach(i => b.keyNotes[i] = [12, 15, 19, 22][Math.floor(r() * 4)]); b.pads[0] = 0; b.padSteps[0] = 1; return b; };
if (typeof module !== 'undefined') module.exports = X; else root.NRSixthSeal = X;
})(typeof self !== 'undefined' ? self : this);

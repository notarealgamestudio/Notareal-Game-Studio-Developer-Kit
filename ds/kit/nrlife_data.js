/* nrlife_data.js (v1.14) - content for the "Friendship Bracelets" life sim: districts, buildings, social circles, 52 named NPCs (8 handcrafted + 44 generated),
 * 300+ components, jewelry types, 150 pattern recipes, skills, venues, events, commissions, rivals, chapters, endings, dialogue.
 * Everything is plain data plus small generators so the Studio can edit it and the engine (nrlife.js) stays generic.
 *   LD.build(seed) -> {districts, buildings, npcs, comps, patterns}   (deterministic) */
(function (root) {
    'use strict';
    const LD = {}, rngOf = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
    const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];

    /* ------------------------------------------------------------------ colours and styles */
    LD.COLORS = { red: [220, 50, 60], coral: [245, 120, 100], orange: [245, 150, 50], yellow: [245, 215, 70], lime: [160, 215, 70], green: [60, 170, 90], teal: [40, 175, 170], sky: [110, 190, 235], blue: [50, 100, 210], indigo: [80, 70, 170], purple: [150, 80, 190], pink: [240, 130, 180], white: [240, 240, 238], black: [30, 30, 34], brown: [130, 90, 60], gray: [150, 152, 160] };
    LD.hue = c => { const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < .08) return -1; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; };
    LD.light = c => (c[0] * .3 + c[1] * .59 + c[2] * .11) / 255;
    LD.STYLES = ['cute', 'romantic', 'punk', 'goth', 'bohemian', 'minimalist', 'luxury', 'vintage', 'nature', 'ocean', 'celestial', 'streetwear', 'abstract', 'colorful', 'elegant', 'industrial', 'artistic'];
    LD.TRAITS = ['friendly', 'shy', 'extroverted', 'introverted', 'competitive', 'generous', 'materialistic', 'artistic', 'practical', 'romantic', 'ambitious', 'lazy', 'perfectionist', 'impulsive', 'loyal', 'dramatic', 'sarcastic', 'curious', 'traditional', 'adventurous', 'jealous', 'forgiving'];
    LD.STAGES = ['Stranger', 'Acquaintance', 'Friendly', 'Friend', 'Close Friend', 'Best Friend', 'Trusted Partner'];
    LD.STAGE_AT = [0, 8, 22, 40, 62, 82, 95];            // relationship score needed for each stage (0-100)
    LD.SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter']; LD.WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    /* ------------------------------------------------------------------ skills */
    LD.SKILLS = { beading: 'patterns, speed, precision', wirework: 'wrapped stones and wire shapes', gemology: 'identify stones, judge quality, find rare minerals', metalworking: 'silver, gold, settings', design: 'coherence, originality, collections', business: 'pricing, marketing, sales, management', social: 'networking, relationships, customer talk' };
    LD.levelOf = xp => Math.min(10, Math.floor(Math.sqrt(Math.max(0, xp) / 18)));

    /* ------------------------------------------------------------------ jewelry types (4 tiers) */
    LD.TYPES = [
        { id: 'friend', n: 'Friendship bracelet', tier: 0, shape: 'ring', slots: [10, 24], need: {}, labor: 45, base: 1.5, tags: ['colorful', 'cute'] },
        { id: 'beaded', n: 'Beaded bracelet', tier: 0, shape: 'ring', slots: [12, 22], need: {}, labor: 40, base: 2, tags: [] },
        { id: 'anklet', n: 'Anklet', tier: 0, shape: 'ring', slots: [14, 26], need: {}, labor: 50, base: 2, tags: ['ocean'] },
        { id: 'necklace', n: 'Simple necklace', tier: 0, shape: 'strand', slots: [16, 28], need: { beading: 1 }, labor: 60, base: 3, tags: [] },
        { id: 'keychain', n: 'Keychain', tier: 0, shape: 'drop', slots: [4, 10], need: {}, labor: 25, base: 1.5, tags: ['cute', 'streetwear'] },
        { id: 'phone', n: 'Phone charm', tier: 0, shape: 'drop', slots: [4, 12], need: {}, labor: 30, base: 2, tags: ['cute'] },
        { id: 'charm', n: 'Charm bracelet', tier: 1, shape: 'ring', slots: [10, 20], need: { beading: 3 }, labor: 70, base: 4, tags: ['vintage'] },
        { id: 'layered', n: 'Layered necklace', tier: 1, shape: 'strand', slots: [20, 34], need: { beading: 3, design: 2 }, labor: 90, base: 5, tags: ['elegant'] },
        { id: 'earrings', n: 'Earrings (pair)', tier: 1, shape: 'drop', slots: [3, 8], need: { wirework: 2 }, labor: 50, base: 4, tags: [] },
        { id: 'ring', n: 'Ring', tier: 1, shape: 'band', slots: [3, 9], need: { wirework: 3 }, labor: 60, base: 5, tags: ['minimalist'] },
        { id: 'wirestone', n: 'Wire-wrapped stone', tier: 1, shape: 'drop', slots: [2, 6], need: { wirework: 4, gemology: 2 }, labor: 80, base: 7, tags: ['nature', 'bohemian'] },
        { id: 'resin', n: 'Resin pendant', tier: 1, shape: 'drop', slots: [2, 6], need: { design: 3 }, labor: 90, base: 6, tags: ['artistic', 'nature'] },
        { id: 'namejewel', n: 'Personalized name jewelry', tier: 1, shape: 'ring', slots: [6, 16], need: { beading: 2 }, labor: 60, base: 5, tags: ['cute'] },
        { id: 'mixed', n: 'Mixed-material piece', tier: 1, shape: 'strand', slots: [10, 24], need: { design: 4 }, labor: 100, base: 6, tags: ['artistic'] },
        { id: 'silver', n: 'Silver jewelry', tier: 2, shape: 'strand', slots: [8, 20], need: { metalworking: 4 }, labor: 140, base: 14, tags: ['elegant'] },
        { id: 'goldpiece', n: 'Gold jewelry', tier: 2, shape: 'strand', slots: [8, 20], need: { metalworking: 5 }, labor: 160, base: 22, tags: ['luxury'] },
        { id: 'gemset', n: 'Gemstone setting', tier: 2, shape: 'drop', slots: [3, 8], need: { metalworking: 5, gemology: 4 }, labor: 170, base: 26, tags: ['luxury'] },
        { id: 'customcut', n: 'Custom-cut stone piece', tier: 2, shape: 'drop', slots: [2, 6], need: { gemology: 5, metalworking: 4 }, labor: 180, base: 30, tags: ['luxury', 'artistic'] },
        { id: 'finechain', n: 'Fine chain', tier: 2, shape: 'strand', slots: [20, 40], need: { metalworking: 5, wirework: 4 }, labor: 150, base: 20, tags: ['minimalist', 'elegant'] },
        { id: 'luxbrace', n: 'Luxury bracelet', tier: 2, shape: 'ring', slots: [8, 18], need: { metalworking: 6, design: 5 }, labor: 190, base: 34, tags: ['luxury'] },
        { id: 'designer', n: 'Designer pendant', tier: 2, shape: 'drop', slots: [3, 8], need: { design: 6, metalworking: 5 }, labor: 170, base: 32, tags: ['artistic', 'luxury'] },
        { id: 'finecoll', n: 'Fine-jewelry collection piece', tier: 3, shape: 'strand', slots: [10, 24], need: { metalworking: 7, design: 7 }, labor: 240, base: 70, tags: ['luxury', 'elegant'] },
        { id: 'customring', n: 'Custom ring', tier: 3, shape: 'band', slots: [3, 9], need: { metalworking: 7, gemology: 6 }, labor: 220, base: 80, tags: ['luxury'] },
        { id: 'luxneck', n: 'Luxury gemstone necklace', tier: 3, shape: 'strand', slots: [12, 26], need: { metalworking: 8, gemology: 7 }, labor: 260, base: 110, tags: ['luxury'] },
        { id: 'watch', n: 'Watch / accessory', tier: 3, shape: 'ring', slots: [8, 16], need: { metalworking: 8 }, labor: 250, base: 95, tags: ['industrial', 'luxury'] },
        { id: 'corporate', n: 'Corporate collection piece', tier: 3, shape: 'strand', slots: [8, 20], need: { design: 8, business: 5 }, labor: 230, base: 85, tags: ['minimalist', 'elegant'] },
        { id: 'limited', n: 'Limited edition', tier: 3, shape: 'strand', slots: [10, 24], need: { design: 8, metalworking: 7 }, labor: 280, base: 120, tags: ['artistic', 'luxury'] },
        { id: 'signature', n: 'Signature line piece', tier: 3, shape: 'strand', slots: [10, 24], need: { design: 9, business: 6 }, labor: 300, base: 140, tags: ['artistic'] }
    ];
    LD.CLASPS = [{ id: 'knot', n: 'Sliding knot', q: 0, v: 0 }, { id: 'lobster', n: 'Lobster clasp', q: 2, v: 1 }, { id: 'toggle', n: 'Toggle clasp', q: 3, v: 2 }, { id: 'magnet', n: 'Magnetic clasp', q: 4, v: 3 }, { id: 'goldclasp', n: 'Gold clasp', q: 6, v: 12 }];

    /* ------------------------------------------------------------------ components (300+) */
    LD.buildComps = () => {
        const C = [], names = Object.keys(LD.COLORS), add = (id, n, kind, tier, rgb, v, st, from, size) => C.push({ id, n, kind, tier, rgb, v, st: st || [], from: from || [], size: size || 1 });
        const cs = k => LD.COLORS[k];
        // tier 0 common
        for (const m of [['plastic', 'Plastic', .05, ['cute', 'colorful']], ['glass', 'Glass', .1, ['colorful', 'elegant']], ['wood', 'Wooden', .08, ['nature', 'bohemian']], ['clay', 'Clay', .09, ['artistic', 'cute']]]) for (const c of names) add(m[0] + '_' + c, m[1] + ' bead (' + c + ')', 'bead', 0, cs(c), m[2], m[3].concat(c === 'black' ? ['goth'] : c === 'pink' ? ['cute', 'romantic'] : []), ['bead_barn'], 1);
        for (let i = 0; i < 26; i++) { const L = String.fromCharCode(65 + i); add('letter_' + L, 'Alphabet bead ' + L, 'letter', 0, i % 3 ? cs('white') : cs('pink'), .12, ['cute', 'streetwear'], ['bead_barn'], 1); C[C.length - 1].letter = L; }
        for (const c of names) add('cotton_' + c, 'Cotton thread (' + c + ')', 'cord', 0, cs(c), .03, ['colorful'], ['thread_emporium'], 0); add('elastic', 'Elastic cord', 'cord', 0, cs('white'), .03, ['minimalist'], ['thread_emporium']); add('nylon_black', 'Nylon cord (black)', 'cord', 0, cs('black'), .04, ['streetwear', 'goth'], ['thread_emporium']);
        for (const c of names) add('ribbon_' + c, 'Ribbon (' + c + ')', 'cord', 0, cs(c), .06, ['romantic', 'cute'], ['fabric_ribbon']);
        for (const [id, n, col, st] of [['heart', 'Heart charm', 'pink', ['cute', 'romantic']], ['star', 'Star charm', 'yellow', ['celestial', 'cute']], ['smile', 'Smiley charm', 'yellow', ['cute', 'streetwear']], ['flower', 'Flower charm', 'coral', ['nature', 'cute']], ['moon', 'Moon charm', 'sky', ['celestial']], ['sun', 'Sun charm', 'orange', ['celestial', 'bohemian']], ['butterfly', 'Butterfly charm', 'purple', ['nature', 'cute']], ['key', 'Key charm', 'gray', ['vintage']], ['feather', 'Feather charm', 'teal', ['bohemian', 'nature']], ['anchor', 'Anchor charm', 'blue', ['ocean']], ['cloud', 'Cloud charm', 'sky', ['cute', 'celestial']], ['bolt', 'Lightning charm', 'yellow', ['punk', 'streetwear']]]) add('charm_' + id, n, 'charm', 0, cs(col), .25, st, ['charm_shop'], 1.3);
        // tier 1 uncommon
        for (const c of ['white', 'teal', 'green', 'sky', 'pink', 'brown']) add('seaglass_' + c, 'Sea glass (' + c + ')', 'bead', 1, cs(c), .5, ['ocean', 'nature'], ['boardwalk_beach', 'secondhand'], 1.1);
        for (const [c, n] of [['white', 'white'], ['pink', 'blush'], ['gray', 'gray'], ['black', 'black'], ['yellow', 'cream']]) add('pearl_' + c, 'Pearl (' + n + ')', 'bead', 1, cs(c), .8, ['elegant', 'romantic', 'luxury'], ['crystal_stone', 'imports'], 1.1);
        for (const c of names) add('ceramic_' + c, 'Handmade ceramic bead (' + c + ')', 'bead', 1, cs(c), .45, ['artistic', 'bohemian'], ['arts_coop', 'old_town_market'], 1.1);
        for (const c of ['red', 'blue', 'green', 'purple', 'orange', 'teal', 'pink', 'yellow']) add('vintage_' + c, 'Vintage bead (' + c + ')', 'bead', 1, cs(c), .6, ['vintage', 'bohemian'], ['old_town_market', 'secondhand', 'flea'], 1.1);
        for (const c of names) add('faceted_' + c, 'Faceted glass (' + c + ')', 'bead', 1, cs(c), .35, ['elegant', 'colorful'], ['bead_barn', 'crystal_stone'], 1.05);
        for (const c of names) add('pony_' + c, 'Pony bead (' + c + ')', 'bead', 0, cs(c), .04, ['colorful', 'streetwear'], ['bead_barn'], 1.2);
        for (const c of names) add('bicone_' + c, 'Crystal bicone (' + c + ')', 'bead', 1, cs(c), .4, ['elegant', 'celestial'], ['crystal_stone', 'bead_barn'], 1.05);
        for (const [id, n, c, st] of [['howlite', 'Howlite', 'white', ['minimalist', 'nature']], ['aventurine', 'Aventurine', 'green', ['nature']], ['tigereye', 'Tiger eye', 'brown', ['bohemian', 'nature']], ['hematite', 'Hematite', 'gray', ['industrial', 'punk']], ['carnelian', 'Carnelian', 'orange', ['bohemian']], ['onyx', 'Black onyx', 'black', ['goth', 'elegant']], ['sodalite', 'Sodalite', 'indigo', ['celestial', 'nature']], ['jasper', 'Red jasper', 'red', ['nature', 'bohemian']]]) add('stone_' + id, n, 'stone', 1, cs(c), .7, st, ['crystal_stone', 'trail'], 1.1);
        for (const [id, n, c, st] of [['silver_star', 'Silver star charm', 'gray', ['celestial', 'elegant']], ['silver_heart', 'Silver heart charm', 'gray', ['romantic', 'elegant']], ['copper_leaf', 'Copper leaf charm', 'brown', ['nature', 'bohemian']], ['skull', 'Skull charm', 'black', ['punk', 'goth']], ['stud', 'Spike stud', 'gray', ['punk', 'industrial']], ['gear', 'Gear charm', 'gray', ['industrial']], ['shell_charm', 'Shell charm', 'sky', ['ocean']], ['compass', 'Compass charm', 'brown', ['vintage', 'adventure']], ['crown', 'Crown charm', 'yellow', ['luxury', 'cute']], ['infinity', 'Infinity charm', 'gray', ['romantic', 'minimalist']], ['dice', 'Dice charm', 'white', ['streetwear']], ['rose', 'Rose charm', 'red', ['romantic', 'goth']]]) add('metal_' + id, n, 'charm', 1, cs(c), 1.2, st, ['charm_shop', 'jewelry_tools'], 1.3);
        for (const [id, n, c] of [['shell', 'Beach shell', 'white'], ['driftwood', 'Driftwood bead', 'brown'], ['beachstone', 'Beach stone', 'gray'], ['seed', 'Park seed', 'brown'], ['dryflower', 'Pressed flower', 'pink'], ['button', 'Old button', 'blue'], ['crystal_frag', 'Crystal fragment', 'sky'], ['mineral_frag', 'Mineral fragment', 'purple']]) add('find_' + id, n, 'bead', 1, cs(c), .3, ['nature', id.includes('shell') || id.includes('drift') || id.includes('beach') ? 'ocean' : 'bohemian'], ['gather'], 1.05);
        // tier 2 rare
        for (const [id, n, c, st] of [['amethyst', 'Amethyst', 'purple', ['celestial', 'romantic']], ['rosequartz', 'Rose quartz', 'pink', ['romantic', 'cute']], ['citrine', 'Citrine', 'yellow', ['bohemian']], ['garnet', 'Garnet', 'red', ['romantic', 'vintage']], ['turquoise', 'Turquoise', 'teal', ['bohemian', 'ocean']], ['opal', 'Opal', 'white', ['celestial', 'elegant']], ['jade', 'Jade', 'green', ['elegant', 'nature']], ['lapis', 'Lapis lazuli', 'indigo', ['celestial', 'vintage']], ['moonstone', 'Moonstone', 'sky', ['celestial', 'romantic']], ['labradorite', 'Labradorite', 'teal', ['celestial', 'artistic']], ['fluorite', 'Fluorite', 'lime', ['nature', 'artistic']], ['malachite', 'Malachite', 'green', ['nature', 'vintage']], ['peridot', 'Peridot', 'lime', ['nature']], ['topaz', 'Blue topaz', 'sky', ['elegant', 'ocean']]])
            for (const [sh, mul] of [['round', 1], ['faceted', 1.3], ['nugget', .9]]) add('gem_' + id + '_' + sh, n + ' (' + sh + ')', 'stone', 2, cs(c), 3 * mul, st, ['crystal_stone', 'imports', 'trail'], 1.15);
        for (const [id, n, c, st] of [['asilver_bead', 'Antique silver bead', 'gray', ['vintage', 'elegant']], ['asilver_charm', 'Antique silver charm', 'gray', ['vintage']], ['rpearl_tahiti', 'Rare Tahitian pearl', 'black', ['luxury', 'elegant']], ['rpearl_gold', 'Rare golden pearl', 'yellow', ['luxury']], ['silver_bead', 'Sterling silver bead', 'gray', ['elegant', 'minimalist']], ['silver_chain', 'Sterling chain link', 'gray', ['minimalist']]]) add(id, n, id.includes('chain') ? 'metal' : 'bead', 2, cs(c), 4.5, st, ['imports', 'old_town_antique'], 1.1);
        // tier 3 premium
        for (const [id, n, c, v, st] of [['gold_bead', 'Gold bead', 'yellow', 14, ['luxury']], ['gold_link', 'Gold chain link', 'yellow', 12, ['luxury', 'minimalist']], ['gold_charm', 'Gold charm', 'yellow', 18, ['luxury']], ['plat_bead', 'Platinum bead', 'white', 26, ['luxury', 'elegant']], ['diamond', 'Diamond (high grade)', 'white', 60, ['luxury', 'elegant']], ['emerald', 'Emerald', 'green', 48, ['luxury']], ['ruby', 'Ruby', 'red', 52, ['luxury', 'romantic']], ['sapphire', 'Sapphire', 'blue', 50, ['luxury', 'celestial']], ['vintage_rare', 'Rare vintage component', 'purple', 30, ['vintage', 'luxury']], ['deco_clasp', 'Art-deco gem charm', 'teal', 34, ['vintage', 'luxury']]]) add('prem_' + id, n, id.includes('link') ? 'metal' : id.includes('charm') || id.includes('clasp') ? 'charm' : 'stone', 3, cs(c), v, st, ['imports', 'jewelry_row'], 1.2);
        return C;
    };

    /* ------------------------------------------------------------------ pattern recipes (150) - each returns a list of palette indices for n slots */
    LD.PALETTES = { 'Candy': ['pink', 'white', 'sky'], 'Sunset': ['red', 'orange', 'yellow'], 'Ocean': ['teal', 'sky', 'blue', 'white'], 'Forest': ['green', 'lime', 'brown'], 'Berry': ['purple', 'pink', 'red'], 'Midnight': ['black', 'indigo', 'purple'], 'Mono': ['black', 'white', 'gray'], 'Rainbow': ['red', 'orange', 'yellow', 'green', 'blue', 'purple'], 'Pastel': ['pink', 'sky', 'lime', 'yellow'], 'Earth': ['brown', 'orange', 'green'], 'Citrus': ['yellow', 'orange', 'lime'], 'Sky': ['sky', 'white', 'blue'], 'Blush': ['pink', 'coral', 'white'], 'Jewel': ['indigo', 'teal', 'purple', 'red'], 'Neon': ['lime', 'pink', 'yellow', 'sky'] };
    LD.STRUCT = { stripe: (n, k) => Array.from({ length: n }, (_, i) => i % k), pairs: (n, k) => Array.from({ length: n }, (_, i) => Math.floor(i / 2) % k), chevron: (n, k) => Array.from({ length: n }, (_, i) => Math.min(i, n - 1 - i) % k), gradient: (n, k) => Array.from({ length: n }, (_, i) => Math.min(k - 1, Math.floor(i * k / n))), wave: (n, k) => Array.from({ length: n }, (_, i) => Math.round((Math.sin(i * .9) + 1) / 2 * (k - 1))), checker: (n, k) => Array.from({ length: n }, (_, i) => (i % 2 ? 0 : (Math.floor(i / 2) % (k - 1)) + 1)), pulse: (n, k) => Array.from({ length: n }, (_, i) => i % 4 === 0 ? 1 % k : 0), triples: (n, k) => Array.from({ length: n }, (_, i) => Math.floor(i / 3) % k), solid: (n) => Array(n).fill(0), mirror: (n, k) => Array.from({ length: n }, (_, i) => { const h = Math.min(i, n - 1 - i); return (h % (2 * k - 2 || 1)) < k ? h % k : k - 1 - (h % k); }) };
    LD.patterns = () => { const out = []; for (const pn of Object.keys(LD.PALETTES)) for (const sk of Object.keys(LD.STRUCT)) out.push({ id: sk + '_' + pn.toLowerCase(), n: pn + ' ' + sk, struct: sk, palette: pn, level: Math.min(6, 'solid stripe pairs triples checker pulse wave gradient chevron mirror'.split(' ').indexOf(sk)) }); return out; };
    LD.applyPattern = (pat, n, tier) => { const cols = LD.PALETTES[pat.palette], seq = LD.STRUCT[pat.struct](n, cols.length); return seq.map(i => cols[i % cols.length]); };

    /* ------------------------------------------------------------------ the town: 8 districts, 4 x 2 grid of 64 m plots separated by 8 m streets */
    LD.PLOT = 64; LD.STREET = 8;
    LD.DISTRICTS = [
        { id: 'square', n: 'Friendship Square', col: [226, 190, 120], roof: [200, 90, 80], gx: 0, gy: 0, about: 'Fountain, benches, bulletin board, outdoor market, cafe, park, event stage and the bus stop.', music: 'town', open: 0, shops: [['cafe', 'Sunny Side Cafe', 'venue'], ['hall', 'Town Hall & Stage', 'venue'], ['bus', 'Bus Stop', 'venue'], ['market', 'Outdoor Market Lot', 'venue'], ['park', 'Park (gather)', 'gather'], ['home', 'Your Bedroom Workshop', 'home']] },
        { id: 'bead', n: 'Bead Boulevard', col: [240, 150, 170], roof: [150, 70, 130], gx: 1, gy: 0, about: 'Every shop a jewelry maker needs; stock rotates by day, season and supplier trust.', music: 'retail', open: 0, shops: [['bead_barn', 'Bead Barn', 'shop'], ['charm_shop', 'Charm Shop', 'shop'], ['crystal_stone', 'Crystal & Stone', 'shop'], ['thread_emporium', 'Thread Emporium', 'shop'], ['secondhand', 'Secondhand Craft Supply', 'shop'], ['jewelry_tools', 'Jewelry Tools', 'shop'], ['fabric_ribbon', 'Fabric & Ribbon Store', 'shop'], ['imports', 'Specialty Imports', 'shop']] },
        { id: 'arts', n: 'Arts Quarter', col: [170, 150, 220], roof: [90, 70, 150], gx: 2, gy: 0, about: 'Studios, workshops, gallery and the creative co-op; collaborations start here.', music: 'arts', open: 0, shops: [['art_studio', 'Art Studio', 'venue'], ['arts_coop', 'Creative Co-op (workshop)', 'workshop'], ['photo', 'Photography Studio', 'venue'], ['music_venue', 'Music Venue', 'venue'], ['fashion_school', 'Fashion Design School', 'venue'], ['gallery', 'Gallery', 'venue'], ['rooftop', 'Rooftop Hangout', 'venue']] },
        { id: 'fashion', n: 'Fashion District', col: [210, 210, 220], roof: [60, 60, 80], gx: 3, gy: 0, about: 'Designer boutiques and the fashion agency. Intimidating at first; reputation and friends open the doors.', music: 'fashion', open: 25, shops: [['designer_row', 'Designer Boutiques', 'venue'], ['dept_luxe', 'Luxury Department Store', 'venue'], ['agency', 'Fashion Agency', 'venue'], ['modeling', 'Modeling Studio', 'venue'], ['showroom', 'Jewelry Showroom', 'venue'], ['hotel', 'Grand Hotel', 'venue'], ['fine_dining', 'Upscale Restaurant', 'venue']] },
        { id: 'boardwalk', n: 'Boardwalk', col: [120, 200, 230], roof: [230, 120, 90], gx: 0, gy: 1, about: 'Beach, pier, arcade and the tourist markets. Shells, sea glass and driftwood wash up here.', music: 'boardwalk', open: 0, shops: [['beach', 'Beach (gather)', 'gather'], ['pier', 'Pier & Fishing', 'venue'], ['arcade', 'Arcade', 'venue'], ['icecream', 'Ice Cream Stand', 'venue'], ['souvenir', 'Souvenir Shops', 'shop'], ['tourist_market', 'Tourist Markets', 'venue']] },
        { id: 'old', n: 'Old Town', col: [180, 150, 120], roof: [110, 80, 60], gx: 1, gy: 1, about: 'Antique jewelers, a pawn shop, the museum and a hidden courtyard. Vintage parts and traditional techniques.', music: 'oldtown', open: 0, shops: [['old_town_antique', 'Antique Jewelry Store', 'shop'], ['pawn', 'Pawn Shop', 'shop'], ['museum', 'Museum', 'venue'], ['library', 'Old Library', 'venue'], ['old_town_market', 'Vintage Market', 'shop'], ['trad_workshop', 'Traditional Jewelry Workshop', 'workshop'], ['courtyard', 'Hidden Courtyard', 'venue'], ['trail', 'Trailhead (gather)', 'gather']] },
        { id: 'mall', n: 'Shopping Mall', col: [220, 220, 180], roof: [90, 130, 160], gx: 2, gy: 1, about: 'Clothing shops, kiosks, food court and the cinema. A kiosk here reaches broader customers.', music: 'retail', open: 0, shops: [['kiosk', 'Jewelry Kiosk Row', 'venue'], ['mall_clothes', 'Clothing Shops', 'venue'], ['mall_dept', 'Department Store', 'venue'], ['foodcourt', 'Food Court', 'venue'], ['cinema', 'Cinema', 'venue'], ['mall_accessory', 'Accessory Stores', 'shop']] },
        { id: 'row', n: 'Jewelry Row', col: [200, 205, 215], roof: [40, 50, 70], gx: 3, gy: 1, about: 'Manufacturers, wholesale gem suppliers and luxury brands. The late-game industry.', music: 'fashion', open: 60, shops: [['jewelry_row', 'Wholesale Gem Suppliers', 'shop'], ['manufacturer', 'Manufacturers', 'venue'], ['luxury_brand', 'Luxury Brands', 'venue'], ['trade_center', 'Trade Center', 'venue'], ['corporate', 'Corporate Offices', 'venue'], ['expo', 'Exhibition Hall', 'venue']] }
    ];
    LD.plotOrigin = d => ({ x: d.gx * (LD.PLOT + LD.STREET), z: d.gy * (LD.PLOT + LD.STREET) });

    /* ------------------------------------------------------------------ social circles */
    LD.CIRCLES = [
        { id: 'beadheads', n: 'The Beadheads', about: 'Casual hobbyists: friendship bracelets, craft nights, sharing and trading.', teaches: 'beginner patterns, cooperative crafting', perk: 'free pattern each friendship stage', styles: ['colorful', 'cute', 'bohemian'], mats: ['glass', 'plastic', 'letter', 'seaglass'], home: 'square', hang: 'cafe', skill: 'beading' },
        { id: 'glitter', n: 'The Glitter Girls', about: 'Fashion-conscious socialites: trends, makeup, parties.', teaches: 'trend forecasting', perk: 'boutique discounts and influencer buzz', styles: ['cute', 'romantic', 'streetwear', 'colorful'], mats: ['pearl', 'faceted', 'charm'], home: 'mall', hang: 'foodcourt', skill: 'social' },
        { id: 'artkids', n: 'The Art Kids', about: 'Experimental artists: unusual materials, music, photography.', teaches: 'unconventional techniques', perk: 'exhibition invites', styles: ['artistic', 'abstract', 'punk', 'industrial'], mats: ['ceramic', 'metal', 'clay', 'find'], home: 'arts', hang: 'rooftop', skill: 'design' },
        { id: 'luxe', n: 'The Luxe Society', about: 'Wealthy collectors and executives who value prestige and quality.', teaches: 'luxury standards', perk: 'high-value commissions', styles: ['luxury', 'elegant', 'minimalist'], mats: ['pearl', 'gem', 'gold', 'diamond', 'prem'], home: 'fashion', hang: 'fine_dining', skill: 'business' },
        { id: 'rockhounds', n: 'The Rockhounds', about: 'Mineral collectors and geology fans: exploration, identification, rare materials.', teaches: 'gemology and expeditions', perk: 'rare-material tips', styles: ['nature', 'bohemian', 'celestial'], mats: ['stone', 'gem', 'find'], home: 'old', hang: 'museum', skill: 'gemology' },
        { id: 'fashionistas', n: 'The Fashionistas', about: 'Designers, stylists, models and fashion students.', teaches: 'styling', perk: 'runway commissions', styles: ['elegant', 'streetwear', 'abstract', 'goth'], mats: ['faceted', 'metal', 'pearl'], home: 'fashion', hang: 'agency', skill: 'design' },
        { id: 'bizcrew', n: 'The Business Crew', about: 'Entrepreneurs and investors: sales, marketing, wholesale.', teaches: 'marketing and expansion', perk: 'wholesale supplier access', styles: ['minimalist', 'elegant', 'industrial'], mats: ['silver', 'faceted', 'wood'], home: 'row', hang: 'trade_center', skill: 'business' },
        { id: 'oldsouls', n: 'The Old Souls', about: 'Older residents and traditional craftspeople: antiques, vintage, local history.', teaches: 'repairs and historical patterns', perk: 'vintage sourcing', styles: ['vintage', 'nature', 'romantic'], mats: ['vintage', 'asilver', 'ceramic', 'stone'], home: 'old', hang: 'library', skill: 'metalworking' }
    ];

    /* ------------------------------------------------------------------ NPCs: 8 named in the handoff + 44 generated */
    LD.STARTERS = [
        { id: 'maya', n: 'Maya Flores', circle: 'beadheads', age: 'young adult', traits: ['friendly', 'generous', 'artistic'], career: 'bracelet maker', about: 'Welcoming bracelet maker; your first close friend. Loves colorful materials and handmade gifts.', styles: ['colorful', 'cute'], mats: ['glass', 'letter'], colors: ['pink', 'yellow', 'teal'], skin: 'tan', hair: 'curly', home: 'square', teaches: 'beading' },
        { id: 'vivienne', n: 'Vivienne Sterling', circle: 'luxe', age: 'adult', traits: ['materialistic', 'perfectionist', 'dramatic'], career: 'fashion enthusiast', about: 'Wealthy and initially dismissive of casual handmade jewelry, but can come to respect craftsmanship.', styles: ['luxury', 'elegant'], mats: ['pearl', 'gem', 'prem'], colors: ['white', 'black', 'indigo'], skin: 'pale', hair: 'long', home: 'fashion', teaches: 'business' },
        { id: 'jax', n: 'Jax Moreno', circle: 'artkids', age: 'young adult', traits: ['artistic', 'adventurous', 'sarcastic'], career: 'experimental artist', about: 'Works in recycled materials, wire and glass; pushes you to try unconventional things.', styles: ['artistic', 'industrial', 'punk'], mats: ['metal', 'find', 'ceramic'], colors: ['black', 'orange', 'teal'], skin: 'brown', hair: 'short', home: 'arts', teaches: 'wirework' },
        { id: 'tessa', n: 'Tessa Bloom', circle: 'glitter', age: 'young adult', traits: ['extroverted', 'impulsive', 'competitive'], career: 'trendsetter and social-media personality', about: 'Trendsetter whose posts can make a design sell out.', styles: ['cute', 'streetwear', 'colorful'], mats: ['pearl', 'charm', 'faceted'], colors: ['pink', 'lime', 'sky'], skin: 'fair', hair: 'ponytail', home: 'mall', teaches: 'social' },
        { id: 'renee', n: 'Renee Park', circle: 'bizcrew', age: 'adult', traits: ['ambitious', 'practical', 'loyal'], career: 'business mentor', about: 'Ambitious mentor with sales, marketing and networking expertise.', styles: ['minimalist', 'elegant'], mats: ['silver', 'wood'], colors: ['gray', 'blue', 'white'], skin: 'tan', hair: 'bun', home: 'row', teaches: 'business' },
        { id: 'bellamy', n: 'Mr. Bellamy', circle: 'oldsouls', age: 'senior', traits: ['traditional', 'perfectionist', 'forgiving'], career: 'jeweler and repair craftsman', about: 'Experienced jeweler who teaches traditional techniques and repairs.', styles: ['vintage', 'elegant'], mats: ['asilver', 'vintage', 'silver'], colors: ['brown', 'gray', 'red'], skin: 'dark', hair: 'bald', home: 'old', teaches: 'metalworking' },
        { id: 'nicolette', n: 'Nicolette Vale', circle: 'fashionistas', age: 'adult', traits: ['ambitious', 'perfectionist', 'dramatic'], career: 'professional designer', about: 'Designs collections; commissions accessories and expects quality and deadlines.', styles: ['elegant', 'abstract', 'goth'], mats: ['faceted', 'metal', 'pearl'], colors: ['black', 'purple', 'white'], skin: 'pale', hair: 'long', home: 'fashion', teaches: 'design' },
        { id: 'sam', n: 'Sam Rivera', circle: 'rockhounds', age: 'young adult', traits: ['adventurous', 'curious', 'friendly'], career: 'mineral collector', about: 'Leads expeditions to hidden material spots.', styles: ['nature', 'bohemian'], mats: ['stone', 'gem', 'find'], colors: ['teal', 'brown', 'green'], skin: 'brown', hair: 'short', home: 'old', teaches: 'gemology' }
    ];
    const FIRST = ['Ava', 'Noah', 'Priya', 'Mateo', 'Hana', 'Liam', 'Zoe', 'Omar', 'Ines', 'Kai', 'Sofia', 'Dev', 'Lena', 'Marcus', 'Yuki', 'Tobias', 'Amara', 'Felix', 'Rosa', 'Ethan', 'Nia', 'Theo', 'Carmen', 'Jonah', 'Mei', 'Rafael', 'Imani', 'Oscar', 'Paloma', 'Gideon', 'Talia', 'Hugo', 'Esme', 'Desmond', 'Ruth', 'Anders', 'Camila', 'Wes', 'Sunny', 'Idris', 'Greta', 'Lucas', 'Dalia', 'Pete'];
    const LAST = ['Okafor', 'Lindqvist', 'Hartley', 'Nakamura', 'Duarte', 'Brennan', 'Castellanos', 'Whitaker', 'Mbeki', 'Novak', 'Delgado', 'Abernathy', 'Tanaka', 'Fitzgerald', 'Rahman', 'Kowalski', 'Moreau', 'Santos', 'Ellison', 'Voss', 'Chen', 'Alvarez', 'Prescott', 'Haddad', 'Sorensen', 'Banerjee', 'Calloway', 'Ibarra', 'Whitlock', 'Osei'];
    const CAREERS = { beadheads: ['craft club host', 'teacher', 'barista', 'student'], glitter: ['stylist', 'influencer', 'boutique clerk', 'makeup artist'], artkids: ['painter', 'photographer', 'sculptor', 'musician'], luxe: ['collector', 'executive', 'art dealer', 'hotelier'], rockhounds: ['geologist', 'hiker', 'museum guide', 'lapidary student'], fashionistas: ['model', 'fashion student', 'seamstress', 'agent'], bizcrew: ['investor', 'marketing manager', 'wholesaler', 'accountant'], oldsouls: ['antique dealer', 'librarian', 'watch repairer', 'retired teacher'] };
    LD.SCHEDULE_TEMPLATES = { default: [[6, 8, 'home'], [8, 12, 'work'], [12, 13, 'cafe'], [13, 17, 'work'], [17, 20, 'hang'], [20, 22, 'home']], weekend: [[6, 10, 'home'], [10, 14, 'hang'], [14, 17, 'square'], [17, 21, 'hang'], [21, 23, 'home']] };
    LD.GOALS = ['open a studio', 'win the spring contest', 'find a rare stone', 'collect every vintage bead', 'plan a wedding', 'get a promotion', 'finish a portfolio', 'write a family history', 'start a band', 'save for a trip', 'host a charity auction', 'repair an heirloom'];
    LD.SECRETS = ['secretly writes poetry', 'owes a favor to a rival', 'is afraid of the ocean', 'once won a national craft prize', 'is saving for someone special', 'collects broken watches', 'hates being photographed', 'cries at commercials'];

    /* ------------------------------------------------------------------ dialogue (compact, data-driven) */
    LD.LINES = {
        stage: [
            ['Oh. Hi. Do I know you?', 'Excuse me, I am in a hurry.', 'You are new around here.'],
            ['Hey, we have met, right? Nice bracelet.', 'Oh, hello again.', 'Good to see a familiar face.'],
            ['Hi! I was hoping I would run into you.', 'You are fun to talk to, you know that?', 'Got any new designs?'],
            ['There you are! Come hang out.', 'I told everyone about your jewelry.', 'You always make my day better.'],
            ['I can tell you anything, can I not?', 'Honestly? You are one of my favorite people.', 'Whatever you are making next, I want in.'],
            ['You are my best friend. That is just a fact.', 'I would not trust anyone else with this.', 'Remember when we first met? Look at us now.'],
            ['We are partners in this. Whatever happens.', 'I would not be who I am without you.', 'Let us build something that lasts.']],
        trait: {
            friendly: 'You have such a warm way about you.', shy: '...Sorry, I get nervous. I like talking to you, though.', extroverted: 'Everyone should come! The more the merrier!', introverted: 'I recharge alone, but your company is easy.', competitive: 'Do not think I will let you win the next contest.', generous: 'Take it, really. I insist.', materialistic: 'Quality shows. I notice what things cost.', artistic: 'I see colors in everything. Even this conversation.', practical: 'Will it hold up, though? That is what I wonder.', romantic: 'Sunsets and sea glass... I am a sucker for both.', ambitious: 'I am going places. Come along if you can keep up.', lazy: 'Can we sit? Walking is a lot.', perfectionist: 'The clasp is slightly off. Sorry, I notice these things.', impulsive: 'Let us do something, right now! Anything!', loyal: 'I stand by my friends. Always.', dramatic: 'You will not BELIEVE the day I have had.', sarcastic: 'Oh sure, another masterpiece. Obviously.', curious: 'How did you make that? Show me everything.', traditional: 'They do not make them like they used to.', adventurous: 'Hidden trails, secret beaches, let us go find them.', jealous: 'I saw you with the others. I am not bothered. Much.', forgiving: 'Water under the bridge. Truly.' },
        gift: { love: ['I love it! I am wearing it right now.', 'This is exactly me. How did you know?', 'I will never take this off.'], like: ['Oh, this is lovely, thank you!', 'Nice work. I will wear it.', 'That is so thoughtful.'], ok: ['Thanks. That is kind of you.', 'Oh. Well, thank you.'], dislike: ['Hm. Not really my style, but thanks.', 'I... appreciate the thought.'] },
        remember: ['I still wear the {d} you made me.', 'This {d} always gets compliments. Thank you.', 'Your {d} is my favorite piece.'],
        circle: { beadheads: 'Craft night is Thursday. Bring beads!', glitter: 'Pink is back. Trust me, I know these things.', artkids: 'The gallery wants something raw this season.', luxe: 'One expects a certain standard, you understand.', rockhounds: 'Found a vein of something sparkly out on the trail.', fashionistas: 'The collection needs a statement piece. Hint, hint.', bizcrew: 'Margins. Always think about margins.', oldsouls: 'My grandmother wore a necklace like that.' },
        ask: ['What are you into lately?', 'Tell me about your week.', 'Any news around town?']
    };

    /* ------------------------------------------------------------------ venues / business progression */
    LD.VENUES = [
        { id: 'bedroom', n: 'Bedroom Workshop', stage: 1, rent: 0, traffic: 1, cap: 2, req: { chapter: 1 }, about: 'Make jewelry at home and sell to friends.' },
        { id: 'stall', n: 'Market Stall', stage: 2, rent: 20, traffic: 6, cap: 10, req: { chapter: 3, money: 60 }, about: 'Rent a booth in Friendship Square: table, sign, trays, lighting, packaging, labels.', setup: ['table', 'sign', 'trays', 'lighting', 'packaging', 'labels'] },
        { id: 'kiosk', n: 'Mall Kiosk', stage: 3, rent: 55, traffic: 14, cap: 20, req: { chapter: 4, money: 400, rep: 20 }, about: 'Reach broader customers in the Shopping Mall.', setup: ['sign', 'cases', 'lighting', 'packaging'] },
        { id: 'boutique', n: 'Small Boutique', stage: 4, rent: 140, traffic: 26, cap: 40, req: { chapter: 5, money: 1800, rep: 35 }, about: 'Rent a storefront: layout, products, staff, branding, music, signage.', setup: ['walls', 'floors', 'shelves', 'counter', 'cases', 'chairs', 'mirrors', 'lighting', 'plants', 'posters', 'rugs', 'music'] },
        { id: 'designer', n: 'Designer Boutique', stage: 5, rent: 380, traffic: 40, cap: 70, req: { chapter: 6, money: 9000, rep: 60 }, about: 'Recognition, large commissions and fashion collaborations.', setup: ['walls', 'floors', 'cases', 'lighting', 'music', 'signage'] },
        { id: 'brand', n: 'Luxury Brand', stage: 6, rent: 900, traffic: 80, cap: 140, req: { chapter: 7, money: 40000, rep: 80 }, about: 'Optional expansion: more stores, employees, collections, manufacturers.', setup: ['stores', 'staff', 'collections', 'manufacturers'] }
    ];
    LD.DECOR = { table: 60, sign: 40, trays: 25, lighting: 80, packaging: 50, labels: 20, cases: 220, walls: 150, floors: 180, shelves: 120, counter: 140, chairs: 90, mirrors: 70, plants: 35, posters: 30, rugs: 60, music: 45, signage: 260, stores: 5000, staff: 0, collections: 800, manufacturers: 2500 };
    LD.STAFF_PROFILES = [['Poppy', 'beading'], ['Dario', 'social'], ['Ingrid', 'design'], ['Colt', 'business'], ['Mina', 'gemology'], ['Bea', 'metalworking']];
    LD.HOME_UPGRADES = [{ id: 'bench2', n: 'Better workbench', cost: 120, effect: 'crafting time -15%' }, { id: 'lamp', n: 'Daylight lamp', cost: 80, effect: 'precision +' }, { id: 'drawers', n: 'Bead drawers', cost: 100, effect: 'storage +100' }, { id: 'display', n: 'Display shelves', cost: 90, effect: 'friends see your best work' }, { id: 'tools2', n: 'Pro tool kit', cost: 400, effect: 'unlocks silver work' }, { id: 'loft', n: 'Move to a loft', cost: 2500, effect: 'host gatherings of 8' }, { id: 'townhouse', n: 'Townhouse', cost: 14000, effect: 'studio + guest room' }, { id: 'luxury', n: 'Luxury home', cost: 60000, effect: 'host gatherings of 20, needs the townhouse', needs: 'townhouse' }];
    LD.HOME_TYPES = [{ id: 'apartment', n: 'Apartment', cap: 4, req: null }, { id: 'loft', n: 'Loft', cap: 8, req: 'loft' }, { id: 'townhouse', n: 'Townhouse', cap: 12, req: 'townhouse' }, { id: 'luxury', n: 'Luxury home', cap: 20, req: 'luxury' }];
    LD.MAJOR_ARC = ['Stranger', 'Acquaintance', 'Friend', 'Close friend', 'Partner in craft', 'Trusted partner'];
    LD.HERO_OPTIONS = { skin: [[236, 206, 186], [226, 186, 156], [200, 146, 108], [150, 98, 66], [96, 62, 44]], hair: ['short', 'long', 'bun', 'curly', 'ponytail', 'braids', 'buzz'], hairCol: [[24, 18, 14], [70, 44, 28], [150, 110, 60], [40, 40, 44], [120, 50, 30], [190, 190, 195], [200, 70, 140], [60, 90, 200]], makeup: ['none', 'natural', 'bold lip', 'glitter', 'smoky'], nails: ['bare', 'pastel', 'bright', 'black', 'glitter', 'french'], earrings: ['none', 'studs', 'hoops', 'dangles', 'charms'], build: ['slim', 'average', 'curvy', 'athletic', 'tall', 'petite'], height: [.9, 1.15], outfits: ['casual', 'artsy', 'cozy', 'streetwear', 'elegant'] };

    /* ------------------------------------------------------------------ events and calendar (28 days per season) */
    LD.WEEKLY = [
        { id: 'craftclub', n: 'Crafting Club', wd: 3, from: 18, to: 21, at: 'cafe', circle: 'beadheads', kind: 'social' }, { id: 'flea', n: 'Flea Market', wd: 5, from: 9, to: 15, at: 'old_town_market', circle: 'oldsouls', kind: 'market' },
        { id: 'fashionmeet', n: 'Fashion Meetup', wd: 4, from: 17, to: 20, at: 'designer_row', circle: 'fashionistas', kind: 'social' }, { id: 'artshop', n: 'Art Workshop', wd: 1, from: 15, to: 18, at: 'art_studio', circle: 'artkids', kind: 'workshop' },
        { id: 'rockclub', n: 'Rock Collecting Walk', wd: 6, from: 9, to: 13, at: 'trail', circle: 'rockhounds', kind: 'gather' }, { id: 'cafehang', n: 'Cafe Hangout', wd: 2, from: 12, to: 15, at: 'cafe', circle: 'glitter', kind: 'social' },
        { id: 'compete', n: 'Jewelry Competition', wd: 6, from: 15, to: 18, at: 'hall', circle: null, kind: 'contest' }, { id: 'stallday', n: 'Square Market Day', wd: 5, from: 10, to: 16, at: 'market', circle: null, kind: 'market' }, { id: 'biznet', n: 'Business Mixer', wd: 0, from: 18, to: 20, at: 'trade_center', circle: 'bizcrew', kind: 'social' }
    ];
    LD.SEASONAL = [
        { season: 0, day: 8, n: 'Flower Festival', theme: 'nature', kind: 'festival' }, { season: 0, day: 15, n: 'Pastel Design Contest', theme: 'cute', kind: 'contest' }, { season: 0, day: 22, n: 'Garden Market', theme: 'nature', kind: 'market' },
        { season: 1, day: 6, n: 'Beach Festival', theme: 'ocean', kind: 'festival' }, { season: 1, day: 14, n: 'Boardwalk Market', theme: 'ocean', kind: 'market' }, { season: 1, day: 24, n: 'Ocean Collection Contest', theme: 'ocean', kind: 'contest' },
        { season: 2, day: 7, n: 'Vintage Fair', theme: 'vintage', kind: 'market' }, { season: 2, day: 16, n: 'Harvest Festival', theme: 'bohemian', kind: 'festival' }, { season: 2, day: 23, n: 'Earthy & Amber Contest', theme: 'nature', kind: 'contest' },
        { season: 3, day: 5, n: 'Holiday Market', theme: 'elegant', kind: 'market' }, { season: 3, day: 14, n: 'Snowflake Contest', theme: 'minimalist', kind: 'contest' }, { season: 3, day: 21, n: 'Gift Exchange', theme: 'romantic', kind: 'social' }, { season: 3, day: 26, n: 'Charity Event', theme: 'elegant', kind: 'charity' }
    ];
    LD.SPECIAL = ['Fashion Show', 'Exhibition', 'Grand Opening', 'Designer Awards', 'Charity Auction', 'Networking Party', 'Celebrity Visit', 'Museum Exhibition'];

    /* ------------------------------------------------------------------ rivals */
    LD.RIVALS = [
        { id: 'perf', n: 'Hazel Quinn', about: 'Affordable-handmade perfectionist', skill: 5, themes: ['cute', 'colorful'], temper: 'perfectionist' }, { id: 'lux', n: 'Auguste Marchand', about: 'Luxury designer', skill: 8, themes: ['luxury', 'elegant'], temper: 'ambitious' },
        { id: 'infl', n: 'Kiki Delacroix', about: 'Trend-following influencer', skill: 4, themes: ['streetwear', 'cute'], temper: 'dramatic' }, { id: 'trad', n: 'Old Tomas Brandt', about: 'Traditional jeweler', skill: 7, themes: ['vintage', 'nature'], temper: 'traditional' },
        { id: 'artist', n: 'Wren Okonkwo', about: 'Artist who dislikes commerce', skill: 6, themes: ['artistic', 'abstract'], temper: 'artistic' }, { id: 'aggr', n: 'Brock Hollis', about: 'Aggressive competitor', skill: 6, themes: ['industrial', 'punk'], temper: 'competitive' }
    ];

    /* ------------------------------------------------------------------ commissions */
    LD.COMMISSION_KINDS = [
        { id: 'pair', n: 'Matching bracelets for two best friends', count: 2, type: 'friend', budget: [20, 45], days: 6, q: 35, rep: 0, circles: ['beadheads', 'glitter'] },
        { id: 'birthday', n: 'Birthday gift for a sibling', count: 1, type: null, budget: [15, 40], days: 5, q: 30, rep: 0, circles: ['beadheads', 'oldsouls', 'rockhounds'] },
        { id: 'prom', n: 'Prom jewelry to match an outfit', count: 2, type: 'necklace', budget: [50, 120], days: 7, q: 45, rep: 10, circles: ['glitter', 'fashionistas'] },
        { id: 'wedding', n: 'Wedding jewelry for a bridal party', count: 4, type: null, budget: [220, 520], days: 14, q: 55, rep: 25, circles: ['luxe', 'oldsouls'] },
        { id: 'runway', n: 'Fashion collection accessories', count: 5, type: null, budget: [500, 1400], days: 12, q: 65, rep: 40, circles: ['fashionistas'] },
        { id: 'corporate', n: 'Corporate collection (aesthetic, budget, deadline)', count: 6, type: null, budget: [1500, 4200], days: 18, q: 70, rep: 55, circles: ['bizcrew', 'luxe'] },
        { id: 'celebrity', n: 'Exclusive celebrity commission', count: 1, type: null, budget: [3000, 9000], days: 10, q: 85, rep: 70, circles: ['luxe', 'fashionistas'] }
    ];

    /* ------------------------------------------------------------------ chapters and endings */
    LD.CHAPTERS = [
        { n: 'New Beginnings', goal: 'Meet Maya, learn the basics, make and gift your first bracelet, explore Friendship Square.' },
        { n: 'Finding Your People', goal: 'Meet the social circles and become Friendly with people in at least two circles.' },
        { n: 'A Creative Identity', goal: 'Develop a recognizable style (5 pieces in one style) and enter your first jewelry competition.' },
        { n: 'Making a Living', goal: 'Sell jewelry, earn $300 in sales and rent a market stall.' },
        { n: 'Reputation', goal: 'Finish a major commission and reach reputation 35.' },
        { n: 'Friendship Bracelets', goal: 'Open your first boutique with three friends supporting you.' },
        { n: 'The Fashion World', goal: 'Enter professional circles, finish a collaboration and design a 5-piece collection.' },
        { n: 'Your Legacy', goal: 'Exhibit your personal collection. The ending reflects your relationships, style, business and choices.' }
    ];
    LD.ENDINGS = [
        { id: 'community', n: 'Community Jeweler', about: 'A beloved neighborhood shop.' }, { id: 'fashion', n: 'Fashion Designer', about: 'Fashion-house collaborations.' }, { id: 'mogul', n: 'Luxury Mogul', about: 'A high-end brand and multiple stores.' }, { id: 'visionary', n: 'Artistic Visionary', about: 'Experimental work shown in galleries and museums.' },
        { id: 'friendship', n: 'Friendship Specialist', about: 'Sentimental personalized jewelry.' }, { id: 'collector', n: 'Collector', about: 'Rare materials and jewelry expertise.' }, { id: 'butterfly', n: 'Social Butterfly', about: 'A broad network and popularity.' }, { id: 'indie', n: 'Independent Creator', about: 'A small handmade business and loyal customers.' }
    ];

    /* ------------------------------------------------------------------ build the world (deterministic) */
    LD.build = seed => {
        const r = rngOf(seed || 7), comps = LD.buildComps(), patterns = LD.patterns(), buildings = [], npcs = [];
        for (const d of LD.DISTRICTS) {
            const o = LD.plotOrigin(d), n = d.shops.length, per = Math.ceil(n / 2);
            d.x0 = o.x - LD.PLOT / 2; d.x1 = o.x + LD.PLOT / 2; d.z0 = o.z - LD.PLOT / 2; d.z1 = o.z + LD.PLOT / 2; d.cx = o.x; d.cz = o.z;
            d.shops.forEach((s, i) => {
                const row = i < per ? 0 : 1, idx = row ? i - per : i, cnt = row ? n - per : per, w = 11, dd = 10, gap = (LD.PLOT - 8 - cnt * w) / (cnt + 1), x = o.x - LD.PLOT / 2 + 4 + gap * (idx + 1) + w * idx + w / 2, z = o.z + (row ? 17 : -17), h = 5 + ((i * 7 + d.gx) % 4);
                buildings.push({ id: s[0], n: s[1], kind: s[2], district: d.id, x, z, w, d: dd, h, row, door: { x, z: z + (row ? -dd / 2 - 1.4 : dd / 2 + 1.4) }, col: LD.COLORS[Object.keys(LD.COLORS)[(i * 3 + d.gx * 5 + d.gy) % 16]].map((v, k) => Math.round((v + d.col[k] * 2) / 3)), roof: d.roof, open: d.open });
            });
        }
        const circ = c => LD.CIRCLES.find(x => x.id === c), skinTones = { pale: [236, 206, 186], fair: [226, 186, 156], tan: [200, 146, 108], brown: [150, 98, 66], dark: [96, 62, 44] };
        const mk = (o, i) => {
            const c = circ(o.circle), dist = LD.DISTRICTS.find(d => d.id === o.home), homeB = buildings.filter(b => b.district === dist.id);
            const sched = k => (LD.SCHEDULE_TEMPLATES[k] || LD.SCHEDULE_TEMPLATES.default).map(([a, b, w]) => ({ from: a, to: b, place: w === 'home' ? 'home' : w === 'work' ? 'work' : w === 'cafe' ? 'cafe' : w === 'square' ? 'square' : 'hang' }));
            return Object.assign({ idx: i, mood: 'content', skills: {}, gifts: {}, secret: pick(r, LD.SECRETS), goal: pick(r, LD.GOALS), looks: { skin: skinTones[o.skin || 'tan'], hair: o.hair || 'short', hairCol: [[24, 18, 14], [70, 44, 28], [150, 110, 60], [40, 40, 44], [120, 50, 30], [190, 190, 195]][Math.floor(r() * 6)], shirt: LD.COLORS[Object.keys(LD.COLORS)[Math.floor(r() * 16)]], pants: [[46, 60, 100], [60, 60, 70], [110, 90, 70], [40, 40, 50]][Math.floor(r() * 4)] },
                work: homeB.length ? homeB[Math.floor(r() * homeB.length)].id : c.hang, hang: c.hang, weekday: sched('default'), weekend: sched('weekend'), links: [], arc: 'Stranger to Trusted Partner' }, o);
        };
        LD.STARTERS.forEach((o, i) => npcs.push(mk(Object.assign({}, o), i)));
        let k = 0; while (npcs.length < 52) {
            const c = LD.CIRCLES[k % 8], first = pick(r, FIRST), last = pick(r, LAST), nm = first + ' ' + last; if (npcs.some(x => x.n === nm)) { k += 0; continue; }
            const tr = []; while (tr.length < 3) { const t = pick(r, LD.TRAITS); if (!tr.includes(t)) tr.push(t); }
            npcs.push(mk({ id: (first + '_' + last).toLowerCase(), n: nm, circle: c.id, age: pick(r, ['teen', 'young adult', 'adult', 'adult', 'senior']), traits: tr, career: pick(r, CAREERS[c.id]), about: 'Part of ' + c.n + '.', styles: [pick(r, c.styles), pick(r, LD.STYLES)], mats: [pick(r, c.mats), pick(r, ['glass', 'pearl', 'stone', 'seaglass', 'charm', 'faceted'])], colors: [pick(r, Object.keys(LD.COLORS)), pick(r, Object.keys(LD.COLORS))], skin: pick(r, ['pale', 'fair', 'tan', 'brown', 'dark']), hair: pick(r, ['short', 'long', 'bun', 'curly', 'ponytail']), home: c.home }, npcs.length)); k++;
        }
        // inter-NPC links: each NPC knows 2-3 others, mostly in the same circle
        for (const n of npcs) { const same = npcs.filter(m => m !== n && m.circle === n.circle), other = npcs.filter(m => m.circle !== n.circle); n.links = [pick(r, same).id, pick(r, same).id, pick(r, other).id].filter((v, i, a) => a.indexOf(v) === i).map(id => ({ id, bond: ['friends', 'rivals', 'family', 'coworkers', 'neighbors'][Math.floor(r() * 5)], str: Math.round(20 + r() * 60) })); }
        // major relationship NPCs (24): full arc, deeper dialogue and a story beat per stage; birthdays for everyone (112-day year)
        const majorIdx = []; npcs.forEach((n, i) => { if (i < 4 || (i % 2 === 1 && majorIdx.length < 24)) majorIdx.push(i); }); majorIdx.slice(0, 24).forEach(i => { const n = npcs[i]; n.major = true; n.arc = LD.MAJOR_ARC.join(' > '); n.beats = LD.MAJOR_ARC.slice(1).map((a, k) => ({ stage: k + 1, n: a, text: n.n.split(' ')[0] + ' ' + ['waves back for the first time', 'remembers what you like', 'asks about your dreams', 'trusts you with a secret: ' + n.secret, 'wants to make something together'][k] })); });
        npcs.forEach((n, i) => { n.birthday = 1 + (i * 37 + Math.floor(r() * 5)) % 112; });
        return { districts: LD.DISTRICTS, buildings, npcs, comps, patterns };
    };
    LD.circle = id => LD.CIRCLES.find(c => c.id === id);
    if (typeof module !== 'undefined') module.exports = LD; else root.NRLifeData = LD;
})(typeof window !== 'undefined' ? window : globalThis);

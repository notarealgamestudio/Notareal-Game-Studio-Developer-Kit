# Friendship Bracelets (DS) - engine/bracelet

A playable DS bead-shop sim. Data: `kit/nrbracelet.js` builds one **BRDT** section from the life sim's data (`kit/nrlife_data.js`), written into the ROM's `nr_gamedata[]` block.

**What is in the data:** 40 beads / letters / charms / stones (colour, price, style tags), 17 styles, 30 ready patterns (12-bead strands), 24 customers taken from the town's 52 people (two favourite styles, favourite colour, budget), 8 chapters with earning goals, 8 endings. Start money, days and title come from the project (`P.bracelet.cfg`).

**How it plays (stylus):** BEAD SHOP buys beads - DESIGN fills 12 slots from your stock (PATTERN loads one of the 30, CLEAR, ERASE, FINISH uses up the beads) - OPEN STALL serves 3-6 customers a day: pick a bracelet, set the price, OFFER. A customer pays up to `suggested price x (40 + match)%`, capped by their budget; match = style hits (35 + 25) + favourite colour (20) + quality / 5. Quality (0-100) = symmetry + repeat structure + colour harmony + letter / charm / stone bonuses. Reputation raises what people will pay and how many come. 28 days; chapters advance with total earnings; the chapter you reach picks the ending.

**Honest limits:** menu driven (the 3D town of the original design is not in this ROM); no save file yet - a season is one sitting; sounds are PSG blips; checked in DeSmuME with stylus taps (`tests/bracelet_rom_e2e.py`), not on the RG DS Plus.

Editor: Crafting-sim template on the DS opens the **Bracelets** tab (title, seed, start money, days, export). Tests: `tests/test_bracelet.js`, `tests/bracelet_rom_e2e.py`, `tests/bracelet_editor_e2e.py`.

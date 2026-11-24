## v1.33 - 3D wrestling engine for the DS (replaces the rectangle fighter for wrestling)
- engine/wrestling = the ICW match engine (3D ring, referee, pins, ropes, finishers, move hints, 5 match types) without ICW's story/world. The Fight tab edits 2-8 wrestlers (generated face and body, finisher, heel/face, entrance theme) + match type; the data goes in a WRCF section (kit/nrkit.js buildDSWrestling). Export ROM on a DS wrestling project builds this ROM. Test: tests/test_wrestle_ds.js; emulator-checked with the default and a 3-wrestler custom roster.
- Ring/apron/titantron art is neutral (NOTAREAL / PRO), not ICW's.
- Still open: moves and stats are not editable yet (engine move list is fixed); faces are the generated blocky ones; HUD footer still says THROWDOWN; a stray sign texture on the apron; no in-editor preview of the 3D match; wrestling is DS-only.
- Face painter: lit faces (key light, eye sockets, nose, jaw, skin grain, hair strands, cheek colour via a precomputed table) in the wrestling and skate engines and in ICW. Hair outlines are still blocky.
- Wrestler stats (power, toughness, speed, momentum gain) change the match; proven in the emulator.
- 3D platformer is now its own game (world3d header flag): Mario-64 style momentum, single/double/triple jump chain, long jump (X+A), ground pound (B), wall kick. Measured chained heights 2.15 / 3.34 / 7.51.
- Skate preset now edits the 3D skate game (see skate panel); the side-view skater is PC-only.


## v1.21 - Timeline v2, arcade room, reorganized menus (from the DeepSeek spec, "Devkit Updates")
Done:
- Timeline is now the spine: video-editor style track (clips by game type, drag to reorder, click-add from a palette grouped Screens & story / Open world & adventure / Action & shooters / Platformer / Racing & vehicles / Fighting & wrestling / Sports / Minigames & arcade).
- Section types: title, loading, cutscene, dialogue, choice menu, credits, transition (fade / wipe / door / vehicle / portal) + every engine (levels, race, RPG, world, fight, puzzle, all 20+ arcade engines).
- Music lane: each section picks a song (keep playing / silence / any Music-tab song), crossfaded in the PC page and the preview.
- Branching: win / lose can jump to any section, menu choices, score / time triggers, flags. DS bottom-screen buttons (DS games only) call a section and return (tap the phone -> match-3 -> back).
- Arcade room (walk-in): machines are plain data, any engine can be a machine; tickets; exit door (optional ticket goal). Layout editor in the Timeline inspector. New machine games: claw machine, air hockey.
- One shared player (NRTimeline.session) drives the editor preview, the PC / Xbox timeline.html and tests, so they cannot disagree.
- Menus reorganized by game type: Game / Timeline / Game types / Assets / Test / Research. DS bottom screen tab only for DS games. Kid mode removed. NOTAREAL icon on the window, taskbar and .exe.
- Fixed: timeline.html was never written into the PC package from the editor (variable shadowing in nrpc.js).
Not done yet (honest):
- A DS ROM is still ONE engine; mixing engines on DS needs the multi-engine scene router in C (validator says so). PC / Xbox mix freely.
- Triggers inside an engine are score / time only. "Walk up to a car and get in" needs an engine-side event (not wired); use a transition + trigger today.
- Level / race / RPG / fight / puzzle sections play as "continue" cards in the PC timeline page (they play in their own tabs / ROMs).
- Coloring pages editor, DS ports of Bracelets / coloring / gems, Experiment area (3D character builder), Research Lab -> recipes -> presets.

## v1.22 – Coloring book page editor
- New tab "🖍 Coloring book" (Game types): draw ellipses, rounded rectangles, polygons, freehand; select/move/resize/nudge, mirror, snap, undo/redo, forward/back, duplicate, flip, rotate, magic-hint colour per shape; blank, mandala and stained-glass starters; copy any built-in page to edit; reorder/delete pages; "play only my pages"; Try-it preview in the real engine.
- Pages stored in P.coloring and copied into the Arcade coloring game and every Coloring timeline section (cfg.custom / onlyCustom), so PC/Xbox exports carry them. Test: tests/color_editor_e2e.py.
- Still open: DS ROM scene router (multi-engine on DS), DS ports of Bracelets/Coloring/other engines (Bracelets DS ROM is still flat tiles), 3D character Experiment area, Research Lab recipes.

## v1.23 – DS: Bracelets graphics, DS Coloring, DS scene router
- **Friendship Bracelets (DS ROM)**: shaded glass/pearl beads (light from upper left, specular spot), faceted charms, bevelled letter cubes, velvet pad under the strand, cord ring, glossy bevelled buttons, shaded customer portraits (6 skin tones, 8 hair colours, 4 hair styles, mood from patience). Sprites/pad/portrait are rendered once and cached; the screen only redraws when something changes. Test: tests/bracelet_rom_e2e.py (7 pass).
- **Coloring book on DS** (arcade ROM mode 12): COLR section = the same page data as the PC engine (26 built-ins + your own pages from the Coloring tab); shapes are rasterised on the DS into an id map, tap a shape on the bottom screen to fill, 24-colour palette, magic-hint stars, page buttons, D-pad cursor + A. Fill only (brush/stamps/glitter stay PC/Xbox). Template "coloring_book" now builds this on DS. Tests: tests/color_rom_e2e.py, tests/test_dsrouter.js.
- **DS scene router** (arcade ROM, SCNS section): a Timeline of DS arcade games (shmup, breakout, race, fps, brawler, falling, memory, sim, hoops, music maker, coloring) + story sections (shown as text cards) becomes ONE ROM. Win/lose links (next scene, a step id, retry, end) are resolved at build time; per-scene music. Timeline tab has "⬇ DS ROM (.nds)". Engines that exist only on PC (arcade room, airhockey, claw, 3D engines, levels, RPG...) are refused with the reason. Tests: tests/router_rom_e2e.py, timeline_editor_e2e.py.
- Still open: DS versions of Bracelets/gems/rooms/3D engines inside the router (each is a separate ROM), triggers inside DS scenes, DS bottom-screen buttons in the router, 3D character experiment area, Research Lab recipes.

## v1.24: Recipes, Advanced, Minigames
- **🧪 Recipes** (Game group): every number the kit knows (measured physics, GTA III vehicles, 3D presets, difficulty packs, anything scanned in the Research Lab) is an ingredient. Recipes bundle ingredients; "Add to my game" changes only the settings your game actually has, shows a report, and can be undone. Tick ingredients to save your own "Frankenstein" recipe; import/export recipe files.
- **🛠 Advanced** (hidden until the 🛠 button in the top bar is switched on): game settings as editable JSON, recipe log, the real PC/Xbox engine code (syntax-checked, your version used in exports, one-click back to original), and ROM byte patches applied to every ROM you export plus .ips export. Only your own exports are touched.
- **🕹 Minigames**: the old "Arcade" tab is renamed; minigames are chained into any game via the Timeline.
- Honest limits: the DS Bracelets ROM cannot host minigames itself; DS router only holds the arcade-ROM modes. No hardware tests were possible; verified by headless emulator and browser tests.

## v1.25: wrestling moves, basketball, skater rig, Sixth Seal logic, About
- **Wrestling** (kit/nrwrestling.js): 30 moves (strikes, front/back grapples, running, ground, top-rope, 3 finishers). Each move carries body-movement keyframes for both wrestlers (lean, lift, flip, lunge, limb swing, squash) so suplexes lift and flip the victim. A/B pick the move from the situation: running, opponent behind or dazed, opponent down, low health, ropes. The Wrestling template turns it on; the Fight tab has a checkbox and a finisher picker. PC / Xbox package. The DS fight ROM still uses the older 4-move engine.
- **Basketball 2-on-2** (arcade mode `basketball`): PC / Xbox / desktop only. The one-player shooting game stays as the `hoops` minigame (DS ROM works).
- **Skater (Jabroni Hawk) rig**: PC skate engine now draws a jointed body with a pose per grab, flip, grind, manual and ollie phase. The DS skate3d ROM is unchanged.
- **Sixth Seal logic** (kit/nrsixthseal.js + panel in the Sigil tab): six-slot mixtape, rack presets, six sigils, beat-battle and DJ-gig scoring, cash/respect, day clock, versioned CRC save (.ssm). The DS Sigil ROM now has a TAPE tab (v1.26): six TRACK slots over the save slots with an unlock message when all six are saved, and a Tape Deck (CLEAN / WARM / WORN / RADIO / DEAD lo-fi on the drum sounds). Keys and sample-pad instruments, tape effect saved per track, sigils, battles, gigs and The Hollow world are NOT in the ROM yet.
- **About tab** shows editor/about.txt (placeholder until Steve's message is supplied).
### Not done yet (asked for)
- SNES: 8 of 42 game types now have a SNES engine (5 platformer types, racing/kart racing on the Mode 7 kart engine, and basketball). Other genres (RPG, fighting, shooters) still need new 65816 engines.
- Vehicle combat on DS / N64 / PSX: exists as a PC mode only.
- Sixth Seal DS ROM milestones M2-M6.

## v1.26
- Sigil DS ROM: TAPE tab (six-track mixtape + Tape Deck lo-fi). Emulator test: 11 checks pass.

## v1.27 - SNES street basketball
- New SNES engine `snes/basket` (PVSnesLib C, 256 KB LoROM): 2-on-2 street basketball, court + crowd, jointed-looking sprites, shot arcs with odds, turbo, dunks, blocks, steals, shot clock, pause, win/lose screen, NOTAREAL logo splash. No sound yet.
- Editor: Basketball template now lists "Super Nintendo (SNES ROM)" and the arcade tab has "Export SNES ROM (.sfc)". Game length, difficulty, turbo speed and title are patched into a settings block at ROM offset 0x8000 (`NRSnes.patchBasket`), checksum fixed. Team colours are fixed in this version.
- Tests: `snes/tests/test_basket_snes.py` (bot plays a full game in Snes9x: boot, config patch, scores, ends, restarts), `tests/test_basket_snes_patch.js`, `tests/snes_basket_editor_e2e.py`.
- Bug fixed on the way: BG2 was left on in Mode 1 and drew random VRAM as stray squares; now disabled.
- Not done: SNES basketball audio, hardware test, SNES Mode 7 kart/combat, vehicle combat on DS/N64/PSX, Sigil ROM keys/pads/battles, About message (waiting for Steve's text).

## v1.28 - About message + Sigil ROM KEYS tab
- About tab now carries Steve's message: short description, BTC / ETH / DOGE donation addresses, thank-you, signed "Development" (editor/about.txt).
- Sigil DS ROM: new KEYS tab (7 tabs now). KEYS = 12 Crypt Keys voices, BASS = 8 bass voices (REC + PLAY records the notes into the bass row), BONE = Bone Sampler with 12 synthesised one-shot pads. Keys/bass loop a 128-sample cycle (stylus held = note sounds; no envelopes). All sounds are made at boot by the integer synth.
- Test: tests/sigil_rom_e2e.py now 17 checks (needs SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy).
- Still not in the Sigil ROM: battles/gigs/rivals/Hollow unlock logic, sigil unlock progression, tape effect per track saved in the file, bass voices used by the pattern bass row (the sequencer bass still uses the 808 sample).
- Audio has never been heard by us: keys/pads timbres are untested by ear.

## v1.29 - SNES Mode 7 kart + handoff wrap-up
- SNES kart racer (snes/kart, 512 KB LoROM): Mode 7 floor, 128-heading HDMA, 3 kart LODs, rivals 1-5, 3 items, laps, results. 30 steps/s with 3 rivals, about 20 fps with 5. Exported from the Race template on SNES (laps, class, rivals, skill, title patched in the ROM).
- Friendship Bracelets (PC/Xbox life3d) gap fill from the handoff: 24 major relationship NPCs with 5-beat arcs, birthdays for everyone (112-day year, forgotten birthdays cost trust), home types apartment/loft/townhouse/luxury with guest caps, hosting gatherings that mix circles (rival tension handled), rival collaboration/befriending, hero creator options (makeup, nails, earrings, build, height). tests/test_life_handoff.js (28 checks).
  - Limit: makeup, nails and earrings are stored and shown in the creator; only build and height change the 3D model.
- Berea tools (kit/nrberea.js, Berea tab, survival_rpg template carries P.berea): SPECIAL, 12 skills + 36 perks, 8 factions with 6 reputation axes and propagation, 8 regions / ~40 connected maps, 32 structures on an 8x8 settlement grid, population/jobs/morale/events/defense, trade routes, government stages 1-6 with policies, elections and coups, 9 infected, 6 robots, 5 cyber parts x 3 tiers, 22 main missions, quests with several solutions, 6 endings, 56 NPC roster, Appalachian theme. tests/test_berea.js (67) + berea_editor_e2e.py.
  - Limit: these are planning/validation tools. The playable rpg3d engine does not read the settlement, faction or government data yet; that is the next step if you want Berea playable.

## v1.30 - first public version (Nov 24)
Added: SNES kart capped at 3 CPU rivals with preset skills (rookie/racer/ace) and 7 collectible weapons (turbo, shell, mine, shield, oil, triple shell, shock). PC/Xbox/desktop **Kart Party**: 1-4 human split-screen players (keyboard + up to 4 gamepads) plus up to 3 CPUs, same weapons. Research Lab now reads NES ROMs and Morrowind-style .esm/.esp data. Scanned this round: Gradius, Snake's Revenge, SMB2, Harvest Moon FoMT, Morrowind + Tribunal (numbers only). **Real-game numbers** in the Berea tab (weapon/armour/enemy/spell/rank advice, "Apply real numbers"). **Assistant** box in the Make-me-a-game tab: a toolbox of ~20 tools (race settings, title, console, real-number design, campaign check/test, library search, genre advice, export). Works with keywords only, or with a local AI that picks tools; only listed tools can run. Scanned games you add yourself update genre advice immediately.

Also finished in v1.30:
- **SNES basketball sound**: the platformer's SPC700 driver is now in the basketball ROM (512 KB). Synthesised bounce, swish, hit/block, whistle, pass/steal, cheer, buzzer, plus title / game / end music. Emulator test confirms the sound chip runs and music is audible. (Not heard by ear.)
- **Sigil DS ROM, THE HOLLOW**: new menu entry. Four rivals (DJ Phantom, The Reverend, Lil Cemetery, Memphis Ghost) judged on what a saved track holds (tempo, drum voices, hits, off-beat variety, bass notes, bass voice, swing, tape); club gigs on Saturdays (pick 3 tracks, 3 timing taps); day clock, cash, respect; six sigils unlocked by simplified milestones; progress saved to SD (PROGRESS.msp, CRC) with RAM fallback. In The Hollow, locked sounds (some keys, bass voices, RADIO/DEAD tape) need the matching sigil; FREE STUDIO keeps everything open.
- **Sigil**: tape effect and bass voice are saved per track (.msig v2; v1 files still load). The pattern bass row can use any of the 8 bass voices (KEYS > BASS > PATTERN BASS). Keys have attack / decay / release.
- Packaging audit: every tool in tools/*-cli.js says "same code path as the editor export"; build_insights is replaced in the app by the Research Lab + genre advice.

Honest limits / not finished:
- Sigil keys and sample pads are not stored in a track, so battles judge drums, bass, tempo, swing and tape only. Sigil quests are simplified into milestones. Nothing in the Sigil or basketball audio has been heard by ear, only by emulator.
- The Sigil ROM tests ran on DeSmuME, not real hardware.
- Kart Party multiplayer is PC/Xbox/desktop only; the SNES kart is one player.
- The assistant is a tool router, not a general chatbot; a small local model is optional.
- CLI tools in tools/ are for developers; every capability users need has a path in the app (Research Lab, Assistant, Export).

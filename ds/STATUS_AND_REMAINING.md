
## v1.5 - DS for everything
Done: DS Arcade engine (engine/arcade, 10 modes + music maker, ARCF section, NR.buildDSArcade, tools/arcade-cli.js, tests/arcade_rom_e2e.py 11/11 in DeSmuME);
Fit matrix DS coverage 39 of 39; Moonlight Holler world preset + bottom-screen panel (world.panel flag in WRLD header byte 2; MAP/WORLD/ITEMS/CHESTS tabs, touch + L/R).
Honest limits: DS FPS is a raycaster (flat-shaded walls, billboard enemies, no textures); DS arcade games have no music yet (beeps/noise only);
Auto-Balance bots still cover only shmup/race/falling; arcade DS games are not auto-tested beyond boot/draw/input.
Still not built: GB/NES/GBA sound drivers, SNES/DS scene router test, timeline/banner/melody editor tools, PSX/N64 exporters, other engines on GB/NES/GBA, scanning Windows/Xbox games.

## v1.5 batch 2
Done: kit/nrknowledge.js (9 consoles, 30 fixes, lookup/context/record), AI.help, Fix tab panel, tests/test_knowledge.js (19) + knowledge_e2e.py; DS arcade music (SONG section, chip voices, song_step verified advancing in DeSmuME).
Beeps in the arcade engine now use PSG channels 12-13 / noise 15 (they were on PCM channels 0-3 before, which cannot play PSG).
Note: audio output itself is not auditioned (no audio capture in the test emulator); verified by the sequencer advancing and by sound commands being sent.
Next: cutscene tests (DS/SNES), timeline editor, banner designer, GB/NES/GBA sound, scanning, PSX/N64.

## v1.5 batch 3
Found: cutscenes were data only (no ROM could play them). Built: CUTS section + play_scenes() in the DS platformer engine (intro / before level / ending), NR.patchBanner (icon + titles + CRCs, verified vs independent CRC), Story & Banner tab, tests cutscene_rom_e2e.py, story_e2e.py.
Not verified: the ending scene path (code mirrors the others), and the banner on a real RG DS Plus.
Not built: cutscene playback on SNES / GB / NES / GBA / PC and in the DS world engine (worlds use map intro text instead); a visual timeline with images/portraits.
Still to do: GB/NES/GBA sound, scanning, PSX/N64.

## v1.6 (motion data + Moonlight Holler item audit)
- tools/motionscan.py + motionbuild.py (in kit tools/): read NSBCA joint animations from a DS ROM you own and keep ONLY measurements
  (timing, angular speed, ease profile, root drop). Run on SvR 2008/09/10: ~9,800 clips -> 15 move classes (kit/nrmotion.js).
- kit/nrmotion.js: ease/spring/speed-limit/fall-bounce/hit-impulse helpers + 3 knowledge-DB fixes (mechanical motion, falls, limb speed).
- ICW (icw/rom/source/motion.c, motion_lib.h): render-side motion layer - springs per joint with overshoot, limb speed limits, falls with bounce, hit whips.
- Super Moonlight Holler: item audit found clay, scarecrow, chest unobtainable -> clay in hardware shop, scarecrow/chest craft recipes. Gems come from geodes.
- STILL TO DO: Stardew-parity checklist + own Stardew-style character for Moonlight Holler; Item Audit tool in the studio; skating/racing motion data (needs 3D skate/racing ROMs - only SvR has BCA0 here);
  apply motion layer to arcade/skate minigames; GB/NES/GBA sound; PSX/N64 exporters; Windows/Xbox scans.
- Moonlight Holler v2.x: 3 new original characters inspired by Stardew's Krobus / Junimo / Wizard but with a new story:
  Hush (shadow merchant: shop 8 of gems/rare finds, weekly shadow shard at 6 hearts), Glim (lantern wisp: at 4 hearts wisps water the whole farm every night),
  Old Thistle (hermit mystic: at 4 hearts trades a spirit essence for max luck for the day). New saves needed (villager count 20 -> 23 changed the save layout).
  Built clean + 1500-input random crash test clean. NOT yet verified in person: that Hush/Glim/Thistle appear at the scheduled spots and the shop/blessing dialogs run (needs a manual play check).

## v1.7
- kit/nritemaudit.js + Fix-tab "Item Audit": proves every item has a source (shop/drop/gift/recipe with obtainable ingredients). tests/test_itemaudit.js.
- Moonlight Holler: jar makes mayonnaise (eggs) and cheese (milk); skill perks at levels 5/10 (sell price); 8 achievements (+500g). Build clean, 1500-input crash test clean.
- ICW: motion layer now also drives the arcade brawler and the Jabroni Hawk skate game (bail = real fall + bounce). Random-input crash test clean.
- STILL OPEN: Moonlight Holler greenhouse + pets, in-person check of Hush/Glim/Thistle; GB/NES/GBA sound; PSX/N64 exporters; Windows/Xbox scans; cutscenes on SNES/GB/NES/GBA/PC; banner on real hardware.
- Moonlight Holler: greenhouse key (hardware shop, passive): crops grow/survive in any season; all seeds sold year-round. Pets still not built.

## v1.8 - sound for GB/GBC/NES/GBA exports
- mini engine: snd_tick player (first song, two best melodic tracks on 2 pulse voices) + 5 effects (jump, coin, hurt, stomp, level clear). HALs: GB/GBC NR registers, NES APU pulse 1/2, GBA PSG ch1/ch2. Data at extra header +10/+12.
- Verified: GB audio non-silent (PyBoy), GBA sound channels report active (mGBA), all engines still play to the win screen (mini_e2e 14 pass). NES: builds and plays; audio not measured (no APU readback in the test emulator).
- Limits: no noise/drum channel or triangle; one song; effects steal the bass voice for ~0.2 s.

## v1.9 - Nintendo 64 and PlayStation exporters (2D engine)
- mini engine now exports to N64 (.z64, libdragon, software PPU, 2 square voices) and PlayStation (PS-EXE, PSn00bSDK, software PPU -> VRAM, SPU square voices). Both open on the NOTAREAL logo.
- Shared src/softppu.h renders the same GBA-layout data blob (BG ring, 8x16 sprites, 16 palettes) into a 240x160 box centred in 320x240.
- Studio: PlayStation and N64 are now selectable (ready) and export through the same Export ROM button. mini_e2e checks both reach gameplay (16 pass); test_mini 48 pass.
- Bug found on the way: a `const` data blob defined in the same file as the PPU was constant-folded by the compiler (all zeros) -> black screen. Blob now lives in its own file (nrd_n64.c / nrd_psx.c).
- PSX is delivered as PS-EXE (disc image would need EDC/ECC); N64 audio and PSX audio are built but not measured (no audio readback in the test harnesses).
- 3D engines for PSX/N64 already exist as separate game engines (Domino Run, CS64); they are not template-driven in the studio yet.
- STILL OPEN: cutscene playback on SNES/GB/NES/GBA/PC; Windows/Xbox scans (run the scanner on your PC); Moonlight Holler pets + in-person check of Hush/Glim/Thistle; banner on a real RG DS Plus; real-hardware checks for N64/PSX.

## v1.9b - cutscenes on GB/GBC/NES/GBA/N64/PSX exports
- Project "cutscenes" (intro / before level N / ending; speaker + text) now play as text screens in the mini engine (START advances). Extra header +14 = table. Up to 8 scenes. NES data room trimmed 20480 -> 20000 bytes to fit.
- Verified on GB (PyBoy) and PSX (PCSX). Not built: SNES and PC cutscene playback (separate engines); Moonlight Holler pets; real-hardware checks.

## v1.10 - cutscenes on SNES and PC
- SNES engine (snes/side2d/src/main.c): play_cs() + CUTS data section (intro / before level N / ending text screens, START or A advances). Exporter writes up to 8 scenes. Verified in Snes9x (intro, level-0, regression test 7/7 pass).
- PC / Xbox player (nrpc.js): 'cs' scene, intro + before-level (detected on map change for platformer projects) + ending on win. Verified in Chromium.
- Cutscenes now play on every export target: DS, SNES, GB, GBC, NES, GBA, N64, PSX, PC.
- Studio (editor) rebuilt; desktop program zip rebuilt as 1.10.0.
- STILL OPEN (need your hardware / PC): Windows + Xbox game scans; real-hardware checks (RG DS Plus banner, N64, PSX); Moonlight Holler pets + in-person Hush/Glim/Thistle check.

## v1.11
- New-game wizard now follows the real engines: PC console is available; every game type shows a tick per selected console (DS 39, PC 38, others the 7 platformer types). Types a console lacks are made for DS/PC instead. Every type builds a starter game from its template.
- psx/n64 added to the fit matrix (platformer). Kid mode toggle and the Lakewood Run example button removed.
- Honest limit: GB/NES/SNES/GBA/PSX/N64 still only have the 2D platformer engine.

## v1.12 - more game types on every console, skateboarding, first-person 3D, reference games
Done (all tested):
- Skateboarding (nrarcade 'skate', PC / Xbox / desktop): 9 flip tricks, 9 grabs, 9 grinds, manuals, spins to 900, balance meters on rails and manuals, special meter (double points), combo multiplier,
  bails, S-K-A-T-E letters, gaps, 3 parks with goals; ease curves from the measured motion library (nrmotion). Small consoles get a "skate run" (side-scrolling skate course on the platformer engine, skate physics preset).
- First-person shooter ROM (NRMODE 4) on Nintendo 64 and PlayStation: real raycast 3D (textured walls, shaded sides, billboard enemies, pickups, exit, hearts, lives), maze levels from the Level tab, tests/fps_e2e.py (both consoles).
  Not built: first-person ROMs for GB / NES / GBA (no frame buffer there).
- Military shooter (nrarcade 'military'): 4 campaign missions (clear / kill all / recover intel / extract) with briefing, 5 weapons with reload and spread, grenades, ammo drops, enemy fire; zombie mode with rounds, buy pad, points.
- Bracelet shop (nrarcade 'craft'): Friendship Bracelets life sim - customers, orders, 6 patterns, thread stock and shop, weaving with a knot-timing bar, reputation, rent, day summary, goal cash.
- Berea: After the Fall (NRWorld.berea): Fallout-style survival RPG world (settlement, road, college ruins with boss, cave, bunker; trader, doctor, quests with flags). Template 'survival_rpg' (title names are no longer game types).
- RPG / open-world templates now route to the RPG ROM on all small consoles when the wizard console is a small console.
- Fit matrix: GBA/GBC/GB/NES 20 types, N64/PlayStation 23, DS 38, PC/Xbox 38.
Honest limits: small-console RPG ignores quest conditions (warned at export); skate trick system, military shooter and bracelet shop are PC / Xbox / desktop (the DS ports of skate and craft are not built);
fighting / wrestling and the arcade types (shmup, breakout, falling blocks...) are still DS + PC only; SNES has platformer only; N64 / PlayStation RPG world is flat top-down (3D view planned); PC / Xbox "3D" is pseudo-3D / raycast, not polygons.

## v1.13.0 (3D games, physics library, art tools, any-game scanner)
Built (PC / Xbox / desktop window only):
- kit/nr3d.js software 3D renderer (z-buffer, lighting, fog, shadows, collision, A* nav); kit/nranim.js humanoid rig with ~70 authored clips, idle manager
  (foot tap, check watch, look around...), work/combat clips, 9 character styles. Ease timing uses the measured motion classes; the poses are authored, not scanned.
- kit/nr3d_sandbox.js: Mario-64-style movement (jump chain, long/back/side flips, wall kick, ground pound, ledge grab, Lakitu camera), open world, boss, stars.
- kit/nr3d_war.js: Halo-style large-map shooter (regenerating shield, grenades, melee, motion tracker, cover/flank/ambush AI, zones, checkpoints).
- kit/nr3d_store.js: Convenience-store job sim with GTA-style controls and HUD: register + change counting, stocking, mopping, shoplifters, late robbery,
  customer moods from GTA pedestrian stats, reputation, day/night. tests/bots3d.js plays full shifts.
- Genre job_sim added (40 templates). Platformer_3d / open_world_3d / military_shooter / shooter_tps give the 3D versions when the console is PC or Xbox.
- kit/nr3dpresets.js (presets per mode, GTA tables, Fallout 2 stats/skills/perks names + the standard derived-stat formulas), kit/nrphys.js (57 GTA III vehicle handling
  rows, 6 movement packs, 13 surfaces, small car model), kit/nrtex.js (20 seamless textures, 16-tile ground sets, 11 parallax backgrounds, console palette reduction, PNG export),
  AI.art(text, llm) routes prompts to those tools with or without a local model.
- kit/nrscan.js: scanAny() reads split zips (.001), zip64, raw BIN/CUE, ISO, DAT2 archives, folders; streams a zipped disc without unpacking it and keeps only numeric
  tables (handling, weapons, ped stats, light cycles, object physics) -> physics_library.json in the data folder. Research Lab has the panels.
- presets/gta_tables.json, presets/gta3_reference, presets/fallout2_reference.json (names only).
Tests: tests/test_3d.js 42 checks; all other unit tests and the e2e suites that were run pass.
NOT built / honest limits:
- N64, PSX, DS (and all small-console) ports of sandbox3d / warfare3d / store3d: they need C ports in mini/src/game.c. The fit matrix lists them PC / Xbox only.
- No vehicles inside the 3D games yet (the car model exists in NRPhys but is not driven in a world). No Fallout-style turn-based RPG engine yet (data is in presets).
- War campaign: the test bot clears zones but did not finish the whole campaign in the time limit; difficulty not tuned by a human yet.
- Store game: first visual pass, shelf goods are flat bars; no sound or music yet. Fallout 2's art, maps and text were not copied. GTA map layouts not used (only tables).
- The scanner classifies tables by file name and column shape: check the labels on a new game. Physics pulled from a game is only as good as that game's text config files;
  games that keep physics in code (most console games) need the Research Lab code scan instead.
- Not verified on real hardware (RG DS Plus). Xbox build is still the controller-ready PC package, not a store-ready GDK build.

## v1.14 - Friendship Bracelets life sim + grouped editor
Done: kit/nrlife_data.js, nrlife.js, nrlife_ui.js (crafting_sim on PC/Xbox now builds the real life sim; small consoles keep the old craft minigame), tests/test_life.js (14), grouped editor nav, AUDIT_CHECKLIST.md, presets/design_refs.json.
Not built yet (see AUDIT_CHECKLIST.md): Fallout-style open-world RPG engine, warfare open world + third-person, DS skating rebuild, DS port of the bracelet game, per-type full studios, device-profile test panel.

## v1.14b - Convenience Store 64 remake
Done: store3d now starts on a GTA-style street (traffic, pedestrians, lamps, day/night, shop fronts, barrel fire). Ol' Gus (hobo, 22 funny lines, $1 tips unlock radar intel / lucky cap / fewer thieves) and Mack (crewcut, sunglasses, trenchcoat) who sells bat, pepper spray, taser, shotgun and 9 gear upgrades. Wallet, shift pay, V swap weapon, X use; save() carries wallet/weapons to the next shift. New styles hobo/dealer, sunglasses/coat/beanie/beard/crewcut in nranim. Presets: Convenience Store 64 (GTA street), Armed shift, Inside only. tests/test_store64.js (31).
Limits: shift length unchanged; one block of street, not a full city; no audio; weapon visuals are simple shapes.

## v1.15 - Open-world wasteland RPG (rpg3d)
Done: kit/nr3d_rpg.js (first/third person, SPECIAL with 5 archetypes, 10 perks, level-ups, real-time shooting + VATS-style targeting with body parts and AP, Pip-Boy menu, dialogue trees with stat checks, barter, 3 quests, companion dog, radiation zones, crates and loot, day/night, 160x160 map with town, raider camp, vault, ruins, crater), 6 presets, survival_rpg on PC/Xbox now builds it, tests/test_rpg.js (34).
Limits: no audio; one map; enemies have no line-of-sight checks (walls do not block shots); no save/load yet; no vehicles; not on DS/small consoles.
Still not built: warfare open world + third person + vehicles, DS skating rebuild, DS/N64/PSX ports of 3D games.

## v1.16 - warfare open world, DS 3D skating, ICW body physics
- Warfare (nr3d_war.js): map 128 -> 200 m with a fuel depot and a radio station; V / Select = first/third person; E = get in/out of the jeep (Up/Down drive, Left/Right steer, Z fire from it, run enemies over, crash damage). tests/test_war_open.js (14).
- DS skating rebuilt as a real 3D engine (engine/skate3d, ported from ICW's Jabroni Hawk): third-person park, 3D skater with solved feet + motion layer, face from the CAW generator, 3 parks (Plaza, Bowl, Street), 3 goals per park, grinds/manuals/grabs/flips/spins/special, tuning + skater look from the SKCF block (NR.buildDSSkate). The earlier 2D side-view DS skate mode was removed. Tested in DeSmuME (screenshots of all 3 parks).
- ICW motion layer (icw/rom/source/motion.c): body physics - mass scales spring stiffness and hit whip, momentum lean/bank from velocity, directed hit reactions (head/torso/arms follow the blow), limp ragdoll after knockdowns, landing squat, fatigue slouch. 6000-frame random-input run clean. Lives in the ICW project, not the kit zip.
- Honest limits: native DS/PSX/N64 ports of sandbox3d/warfare3d/store3d/rpg3d are NOT done (PC / Xbox only); skate3d is DS only (PSX/N64 skating not built); skate3d has no audio yet; jeep has no ramps/terrain height; per-type studio panels not started.


## v1.17 - Memphis Sigil, Korg data, DS 3D worlds
- Memphis Sigil: DS drum/bass workstation (engine/sigil), Sigil Studio tab, music_maker template exports it. See docs/SIGIL.md.
- Korg DS-10/M01 data extracted and applied (docs/KORG_DATA.md).
- DS 3D world engine (engine/world3d): sandbox, warfare and wasteland modes on DS from the same kit worlds (kit/nrworld3d.js).
  Box geometry only, no textures, no jeep/dialogue/store/music on DS.
- Arcade tab: ROM-data presets panel.
- N64 and PlayStation 3D ports of the same worlds (engine/w3soft, docs/W3SOFT.md): software-rendered, tested in the N64 and PCSX emulators; not run on real hardware (PlayStation will be slow).
- DS skating audio (engine/skate3d): roll and grind loops, ollie, tricks, landing, bail, combo bank and goal sounds through the ARM7 mailbox; checked by command counters in the emulator (tests/skate_audio_e2e.py), not by ear.
- Not done: Sigil FAT save unverified on hardware.

## v1.18 - Bracelets ROM, store on N64/PSX, engine updates
- Friendship Bracelets DS ROM (engine/bracelet, kit/nrbracelet.js, docs/BRACELETS.md): bead shop -> design strands -> stall with 24 customers -> 28 days / 8 chapters / 8 endings; its data (beads, prices, patterns, customers, chapters, endings) is now in the program. Crafting-sim template on DS opens the Bracelets tab.
- Convenience Store job sim on N64 and PlayStation (engine/w3soft store mode, docs/W3SOFT.md): street + shop, customers, register change, stocking, mopping, shoplifters, robber, Gus, Mack, wallet, day/night, shift pay. Reduced scope (no traffic/cutscenes/gear upgrades); tested on a host build and in the N64 + PCSX emulators.
- Engines tab (docs/ENGINES.md): list/export the embedded engines, replace one with a newer build, add engines for future games, engine packs (.nrengines), desktop program update (.html) with safe mode.
- Not done: Bracelets has no save file and no 3D town; store port not tried on hardware; new game types still need a program update (engine pack alone is not enough).

## v1.19 - god sim, frontier shooter, progression, extreme sports, rail shooter, baseball
- Done: Cosmos Keeper (DS ROM + PC), frontier shooter (N64 / PSX), progression data from SMW, skate / snow / BMX engine, rail shooter, baseball (PC only).
- Not verified: no hardware run (RG DS Plus) of the god sim or frontier ROMs; audio not heard by ear; DK levels not parsed (SMW only); sport visuals reuse the skateboard drawing.
- Remaining stand-ins: vehicle_combat weapons, 3D platformers, shooter_tps on PC / DS.

## v1.19b - engines
- Vehicle combat (weapons), 3D side-scroller (2.5D), 3D platformer restricted to 3D-capable consoles. All three new kinds are PC / Xbox / desktop only except the platformer.
- Not verified: no hands-on feel testing (bots only), no audio for the new engines, the 2.5D course is generated (not hand-authored), enemy density does not scale along the course, no port of combat / side3d to DS / N64 / PSX.
- Remaining stand-in: shooter_tps on PC / DS.

## v1.20 - jewelry 3D graphics, coloring book engine, over-the-shoulder camera
- Done: nrgems.js (3D gems / beads / charms), nrcolor.js (coloring book), third-person camera for shooter_tps on PC / Xbox.
- Not verified: no hands-on feel; gem sparkle and charm looks were judged from rendered contact sheets only; the DS Bracelets ROM does not use the 3D graphics; coloring pages cannot be added from the Studio UI yet (they are plain data in nrcolor.js).

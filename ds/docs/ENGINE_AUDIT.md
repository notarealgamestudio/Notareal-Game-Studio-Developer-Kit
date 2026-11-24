# Engine audit (written 2026-11-24) - what is real, what is starter, what is not built

Plain categories. "Verified" means I ran it in this session (emulator, browser or host build) and looked at the result.

## Shared tools (apply to every game type)
| Tool | State |
|---|---|
| Asset library: 12 skylines, 16 land types, 10 buildings, 21 props, import your own | Real. Tab in Assets group, same for every game type (click-tested for 3D world, skate, wrestling). |
| Where the assets reach the game | DS 3D world: ground, skyline ring, building walls (emulator-verified ground + skyline; walls not seen yet). DS skate park: skyline + slab (boots, verified). DS wrestling: crowd/backdrop + floor (boots). PSX/N64 soft engine: skyline + ground (verified on the PC host build only). PC 3D engines: ground (verified in browser), skyline (works, mostly behind scenery). 2D engines: skyline becomes the backdrop. |
| Buildings and props | Chosen and saved with the project. NOT yet placed in any engine except as building wall textures. Placing them in levels is still to do. |
| Characters (one shared cast for all game types) | Real for wrestling and skate: one cast list (Assets > Characters), the wrestling roster and the skater both read it (click-tested, wrestling verified in emulator). NOT yet read by the 3D world player, basketball or the 2D engines. Face preview in the editor: none (the engine draws the face from the numbers); face-from-photo tool still separate. |
| Level / world building shared across types | NOT done. Platformer level editor, RPG world editor and DS 3D box worlds are separate. |
| Music, sounds | Shared tabs exist in the Assets group; not re-checked this session. |

## DS engines
| Engine | State |
|---|---|
| 3D wrestling (engine/wrestling) | Real engine, editable roster (8), looks, stats, match type, textured ring art. Moves are a fixed set (not editable). Verified in emulator. |
| 3D skate (engine/skate3d) | Real engine, 3 parks, skater look, goals, physics. Parks are fixed (no park editor yet). Verified boots. |
| 3D world (engine/world3d): open world, war, RPG boxes world | Real engine, data-driven (boxes, enemies, weapons). World content is the built-in worlds. Platformer movement verified. |
| Arcade minigames (shmup, breakout, race, fps, brawler, falling, memory, ...) | Real but small minigames; the only engines the DS Timeline can merge. |
| Puzzle, sigil/rhythm, bracelets, godsim, 2D fighter, 2D platformer | Real starter engines. Bracelets is not the 3D life sim. |
| Basketball | DS engine started (engine/basketball: folder only, nothing built). SNES basketball exists. |
| Baseball, rail shooter | PC only. |

## PSX / N64
- Software 3D engine (w3soft): world, war, RPG, store and frontier modes, combat. Now draws the library skyline + ground. The ROMs embedded in the editor/desktop app are the OLD builds until they are rebuilt (see below).
- Everything else in the support table that lists psx/n64 uses the mini engines or the same soft engine; not re-verified this session.

## PC / Xbox
- 2D platformer/RPG pages, arcade pages, 3D engines in nr3d*.js. Not re-clicked in the installed desktop app.

## Timeline
- Merges only DS arcade-family minigames into one ROM. The real engines (wrestling, skate, 3D world) cannot be combined into one DS ROM yet. This is the main gap against the original Timeline plan.

## Data not yet used
- TNA animation inventory, SvR joint ranges and measured motion JSON: not read by any engine. WM2000 and THPS2 data not decoded.


## Skate park builder (added)
- REAL: the 3D skate engine reads an 'SKPK' section (rails, ledges, coping, kickers, funboxes, blocks, 7 letters, spawn, colours). Edited in the 3D level builder tab when the project is a skate game. Checked: node test (8), Playwright click-through, DS emulator screenshot of a custom park.
- STARTER: goals/challenges still come from the chosen base park; limits are 8 rails, 4 ramps, 2 blocks.
- NOT DONE: other skate engines (PC/other consoles) do not read it.

## Convenience store job sim: your own store (added)
- REAL (PC / Xbox / desktop): the store engine plays a layout you build in the 3D level builder tab (store builder): products with names, prices, costs and colours (up to 8), shelves (product, position, length, facing, up to 12), register / counter position, outside props. Customers only shop for products that have a shelf. Checked: node tests (7 new, 31 old pass), Playwright click-through of the builder, engine run on a custom layout without errors.
- PARTIAL (N64 / PlayStation): shelf and register positions from your layout go into the world data and the soft engine plays them (host build, screenshot differs from default). Product names and prices there are still the engine's built-in six. Not run on a real N64 / PSX emulator.
- NOT DONE: the shop shell (walls, door, back room) is fixed; no DS store engine; the store does not read the shared cast, the asset library or story/NPC data; your original Convenience Store minigames are not a rebuildable project in the kit.

## Timeline for every game (added) and how editable each game type is
- REAL: every new game from any of the 42 templates starts with a Timeline plan (title, the game's own sections, credits). Checked in the editor for all 42 templates on PC and DS: all validate with 0 errors and run headless. Racing on DS uses the arcade racing engine because the DS cannot run level-based race tracks.
- Editability today (content = you can change the level / map / roster / layout, not just numbers):
  - FULL content tools: platformers and runners (Level tab), RPG / open world / farm / adventure (World tab), fighting and wrestling (Fight tab + shared cast), puzzle (Puzzle tab), coloring book, godsim, bracelet, sigil, berea.
  - Content tools added this session: 3D skate (park builder), store job sim (store builder), 3D open world / war / RPG world (3D level builder, buildings and props from the asset library).
  - SETTINGS ONLY (numbers and toggles, no layout / content editor): shoot-em-up, breakout, arcade racing, first-person arcade, beat-em-up, falling blocks, memory, city sim, hoops, vehicle combat, rail shooter, baseball, basketball, kart racing, life sim 3D, side-scroller 3D. These need their own editors (waves and enemies, brick layouts, tracks, stages, courts and teams, arenas, rails).

## Content designers for the arcade engines (added)
Each lives in the "Level / content builder" tab when the game is that type, is stored in the project (`cfg.design`), and is played by the PC / Xbox engine AND the DS ROM (new ROM sections SHMP, BRKL, RACE, BRWL).
- Shoot-em-up: enemy types (HP, speed, movement, fire rate, score, colour, size), up to 16 timed waves with formations, boss (HP, movement, fire rate). Checked: node tests, editor click-through, PC run to a win, DS emulator screenshot.
- Breakout: 8x16 brick grid, 0-4 hits per brick. Same checks.
- Racing: track sections (length, bend), grass colour. Same checks (DS screenshot showed the custom bend and colour).
- Beat-em-up: fighter types, up to 16 waves (type, count, side), boss. Same checks.
- First-person shooter: paint the level (walls, enemies, health and ammo pickups, start, exit). PC + DS ROM (FPSL section; DS emulator minimap showed the painted layout and enemy count). PC gained pickups for this.
- Street basketball (PC only): two teams of two with speed / shooting / dunk / defense per player, team colours and names, court colour. Checked: node tests, editor click-through. No DS engine exists for it.
- Baseball (PC only): pitcher repertoire, strike rate and speed, ballpark colours, team names. Checked the same way. No DS engine exists for it.
- Vehicle combat: uses the same track designer as racing. PC, DS ROM (shared/kartcombat.h reads the RACE section; DS emulator run checked) and the shared header still compiles for the N64 / PlayStation soft engine, which does not read the design yet.
- Rail shooter (PC only): per-wave gunmen / civilians / HP / speed / fire rate, boss, room colours. Checked: node tests (bot plays through to a win), editor click-through. No DS rail-shooter engine exists.
- STILL SETTINGS ONLY: falling blocks, memory, city sim, hoops, kart racing, 3D life sim, 3D side-scroller. Timeline-driven DS ROMs (several scenes in one ROM) still use the old built-in content, not these designs.

## Memory-match and falling-blocks designers
- Memory: paint 16x16 cards (15 colours + transparent), 2-16 pairs. PC engine draws the pictures; DS ROM reads a `MEMC` section. Verified: node tests, Playwright painting, DS emulator screenshot.
- Falling blocks: draw up to 12 pieces on a 4x4 grid with colours, set speed-up per line and fastest speed (plus well size, start speed, lines to win). PC engine and DS ROM (`FALD`) read it. Verified: node tests, Playwright, DS emulator screenshot with a custom 2x3 piece.
- Not verified: the installed Windows app; Timeline multi-scene DS ROMs still use built-in content.

## Built-in offline AI (from the DeepSeek spec)
- Real: `launcher/localai.js` starts llama-server (127.0.0.1:18080) from `ai/bin` + a `.gguf` in `ai/models`, with status / start / stop / one-time download endpoints; "Built-in AI" is the default in the desktop app; `NRTools.agent` is a planner -> one-tool-per-step loop (max 12) with results fed back, repair on failure, grammar-constrained output (`NRTools.grammar()`), console facts + kit guide in the prompt; new tools `get_design`, `set_design`, `add_design_item`, `remove_design_item`, `list_templates`, `timeline_show`.
- Verified: node tests (`tests/test_aiagent.js`), a mock llama-server over HTTP through the editor in Playwright, and the launcher start/stop with a stand-in server process.
- NOT verified: a real Qwen model (never downloaded or run here: disk and network), the download button, Windows `tar` unpacking, answer quality of a 7B model on these tools. No model or engine is bundled in the zip (4.7 GB).
- Not built: the spec's telemetry/model-manager extras, AI texture/background generation tools, tools for the skate park / store layout / face tool.

## Feeding the AI the studio's data (24 Nov)
- Real: each AI step's prompt now carries (a) console facts, (b) the studio guide, (c) retrieved data matching the request: scanned games from the library, measured real-game numbers, recipes, templates, the open game's settings and design layout, and fixes already learned in this project.
- Learning (no model training): a request that finished with every step working, and every AI repair the user applies in Fix it, is saved in the project's knowledge list and found by later requests.
- NOT done: training or fine-tuning a model; telemetry; retrieval over decompiled code from scans beyond the library records the app already stores. Verified with node tests only, not with a real model.

## AI dock (24 Nov): the AI is now the front of the app
- Real: `editor/editor_aidock.js` puts one AI box at the bottom of every screen (also the welcome screen): status chip (installed / starting / not installed / keyword mode), "Install the AI" button, live step log. It runs the planner/tool loop; with no model it falls back to the keyword assistant and says so.
- Verified: Playwright with a stand-in model server (made a kart game from one sentence on the welcome screen; dock stays on other tabs). NOT verified: a real Qwen model, the Install button on Windows, the installed app.

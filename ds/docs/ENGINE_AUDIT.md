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

# Engines, engine packs and program updates

Every game the program makes = a prebuilt **engine ROM** + one **data block** written into it. The program embeds each engine (gzip + base64 in `ROMS`); exporters call `gunzipB64(ROMS.<id>)`.

**Engines tab (Project group)** lists them (id, console, data section, source, size) and lets you:
- **Export ROM** - the raw engine, unpatched.
- **Replace...** - install a newer build of an engine. The new ROM must carry the same studio data marker as the built-in (`NRGDATA1`, `NRMNDATA` or `NRGSNES1`); otherwise it is refused. From then on `gunzipB64` hands out the replacement whenever an exporter asks for that engine, so every export (and the Bracelets / Sigil / 3D tabs) uses it. **Use built-in** reverts.
- **Add an engine ROM...** - register an engine under a new id for a future game (listed, exportable; an exporter for it needs a program update).
- **Export / Import engine pack** (`.nrengines`, JSON of gz+base64 ROMs) - move several engines at once; a pack is how new engine builds are delivered.
- **Program update (desktop only)** - *Install program update (.html)* stores a newer `notareal_studio.html` in `Notareal_Data/update/`; the desktop window loads it instead of the built-in page on next start. *Remove update* or *Open built-in program (safe mode)* (`/?safe=1`) go back. Projects, the ROM library and engines are untouched.

Storage: desktop program -> `Notareal_Data/engines/<id>.rom` + `.json` (served by `launcher/server.js`: `/api/engines`, `/api/engine`, `/api/engine/remove`, `/api/update-app`, `/api/update-app/remove`); browser copy -> IndexedDB `notareal_engines`.

**Limit:** a brand-new *game type* also needs editor screens and a data builder, which live in the program page - so it arrives as engine (pack) + program update together. Engines alone cover: bug fixes, new sounds / art baked into an engine, new builds of existing engines.

Tests: `tests/engines_e2e.py` (browser + desktop server: export, replace, game built on the replacement, junk refused, pack round trip, program update / safe mode).

## v1.19 engines (added this chunk)
- **Cosmos Keeper (god sim)**: DS ROM (`engine/godsim`) and PC version (`A.godsim`). 12 stages Big Bang to Singularity; tap, buy upgrades, pick one trait per slot (traits matching the stage environment give +25%). Pacing set by `cfg.pace` (seconds per stage for a player buying upgrades).
- **Frontier shooter (N64 / PSX)**: over-the-shoulder, horse, factions (LAW / OUTLAWS / SETTLERS) with reputation and bounty, dialogue trees, quests, duels, Dead Eye. Data in `kit/nr3d_frontier.js`. See `docs/W3SOFT.md`.
- **Side-scroller progression**: `presets/progression.json` is measured from Super Mario World sprite lists (enemy mix and level width per level number); the builder uses it. Donkey Kong levels were not parsed.
- **Multi-sport trick engine**: skate, snowboard, BMX in one engine (`Sk.SPORTS`): grinds, big air, half pipe, slope style, street / dirt / vert spots.
- **Rail shooter** (`rail`): aim, fire, hold X for cover to reload, enemies telegraph shots, civilians, headshot weak points, boss with a moving core. PC / Xbox / desktop only.
- **Baseball** (`baseball`): bat against fastball / curve / changeup, strikes, balls, outs, innings. PC / Xbox / desktop only.

- **Vehicle combat** (`combat`, PC / Xbox / desktop only): armed lap race. Machine gun with heat, homing missiles, mines, pickup crates (missiles / mines / repair / nitro), rivals that shoot back and drop mines, win by top-3 finish or wrecking everyone. Modelled on Twisted Metal, Vigilante 8, Mario Kart items.
- **3D side-scroller** (`side3d`, PC / Xbox / desktop only): the Mario-64-style 3D hero and physics locked to one plane with a side camera, on a generated course whose gaps widen along its length.
- **3D platformer** (`sandbox3d`): the real 3D engine on PC / Xbox / DS / N64 / PSX; the 2D-only consoles no longer list it.

Still stand-ins: shooter_tps on PC / DS (first person; the frontier shooter is the over-the-shoulder version on N64 / PSX). Vehicle combat is not on DS / N64 / PSX / GBA (Racing and Kart Racing still are).

## v1.20 (jewelry 3D, coloring book, over-the-shoulder shooter)
- **3D jewels, beads and charms** (`kit/nrgems.js`): round / oval / pear / heart / marquise / emerald / cushion gem cuts built facet by facet with twinkling sparkle and glints; cabochons (opal, moonstone, labradorite sheen); pearls with a pearly sheen; mirror-like gold / silver / platinum; faceted, bicone, glass, sea glass, wood, ceramic, pony and vintage beads; letter cubes; 22 puffy enamel charms with a metal rim and shine spot (heart, star, flower, moon, sun, butterfly, key, feather, anchor, cloud, bolt, smiley, crown, gear, skull, shell, compass, dice, rose, infinity, leaf, stud). Used by the Friendship Bracelets workbench preview (PC / desktop) and as small sprites in its bead palette and strand. The DS Bracelets ROM keeps its flat tiles.
- **Coloring book** (`kit/nrcolor.js`, mode `coloring`): 24 hand-built pages plus endless mandalas and stained glass; fill, brush (stays inside the shape), erase, stamps, glitter; 24 colours and 5 fill styles; undo; stars; mouse / touch / keys; `snapshot()` draws the finished picture for saving. The DS ROM keeps the simpler paint-by-number grid (`paint`).
- **Third-person shooter**: `cfg.camera = 'third'` in the warfare engine gives an over-the-shoulder camera (V toggles first person, zoom pulls it in). The DS ROM starts over the shoulder too (Y toggles first person); N64 / PSX run the frontier shooter.

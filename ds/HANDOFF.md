# Notareal Game Studio dev kit: handoff for the next person or AI

## What it is
One offline program (NotarealStudio.exe) that runs the studio on your own computer, no internet. It is the editor (tabs: World, Levels, Characters, Art, Music, Sounds, Puzzle, Fighting, Graphics, Bottom screen, Game, Technique Library, Fix it, Research Lab), the ROM exporters, and the ROM research lab. Results from scanned ROMs are saved in `Notareal_Data` next to the program.

## Where things are (all under ds/)
- `kit/` core modules (plain JS, same code runs in the browser and in node): nrkit (DS data blocks + ROM patching), nrsnes, nrworld (World runtime/compiler), nrfight, nrpuzzle, nrpc (PC/Xbox package), nrlab + nrgfx + nrdecomp (ROM research lab: code map, graphics measurements, decompressors), nrmusic, nrtouch, nrface.
- `editor/` the studio UI. `build_editor.py` bundles everything into `dist/notareal_studio.html` (single file, ~2.3 MB, includes the engine ROM templates as base64).
- `engine/side2d`, `engine/puzzle`, `engine/fight` native DS engines in C (BlocksDS, `BLOCKSDS=/opt/blocksds/core make`). The editor patches a data block into the compiled template (`NRGDATA1` magic), so users never need a compiler.
- `launcher/server.js` desktop launcher: serves the studio on 127.0.0.1 and adds folder scanning + saving to disk. `launcher/build_exe.sh` builds the programs (node single-executable; Windows binary taken from npm package node-win-x64 of the same node version).
- `library/` pre-scanned ROM database (120 games), sprites, tiles, songs. `tools/` command-line helpers (lab-cli, make_code_db, dsrun.py emulator test harness).
- `tests/` run from `ds/tools`: `node ../tests/test_kit.js`, `test_puzzle.js`, `test_decomp.js`; browser tests (`python3 tests/*_e2e.py`, Playwright); ROM boot tests need `xvfb-run` + DeSmuME (`puzzle_rom_e2e.py`, `fight_rom_e2e.py`); `desktop_e2e.py` tests the launcher binary.

## What the program can do now
- Scan ROMs (DS, GBA, GB, GBC, SNES, N64, PSX): header, files, code map, sound, graphics measurements (tile regions, palettes, shading, outline, dithering, blockiness), compressed blocks (LZ10, LZ11, RLE, Yaz0, MIO0, Huffman). Whole folders at once in the desktop program. Report: `Notareal_Data/graphics_report.md`.
- Technique Library and Graphics tab use that data (sprite upgrader with Wrestler/Cute/Realistic styles, texture maker with console checks).
- Export DS ROMs: platformer, World (top-down + side), puzzle (match-3, bracelet), fight. Export SNES platformer ROMs. Export PC/Xbox packages (controller-first, includes puzzle and fight pages).

## Honest gaps
- ROM exporters inside the program: DS (4 engines) and SNES (platformer). The earlier GB/GBC (Moonlight Holler, Convenience Store), N64 (cs64/qm64), PSX (domino) and the hand-built ICW, Goodwill and Hounds ROMs were made with separate toolchains in other folders (gbkit, n64, psxdomino, icw, goodwill, hounds). They are NOT yet inside the program. To fold one in: write its engine, compile a template ROM, embed it as base64 in build_editor.py, add a data-block builder in kit/, and an export button.
- Windows exe was built but could not be run on Windows in this environment. Windows may show a SmartScreen warning for an unsigned program (More info, Run anyway).
- Lab numbers are lower bounds (unrecognised or custom-compressed art is invisible). Decompression covers six common formats only.
- Fight/puzzle ROMs: no real-device test yet; fight ROM is one player vs computer.
- Not started: PSX and N64 kit modes, racing/sports/shooter engines, DS touch coloring book, SNES versions of fight/puzzle.

## Rules the owner set
Every ROM starts with the NOTAREAL logo. Document every ROM/tool problem in the dev kit doc. Use the ROM catalog/game-physics database. Character faces realistic, not blocky. As much as possible works offline. Keep credit use low: no repeat file sends, no unrequested extras.

# 3D worlds on N64 and PlayStation (engine/w3soft)

One C core (`source/w3core.c`) runs the sandbox, warfare and wasteland games on both consoles. It reads the same W3DW world data as the DS engine
(boxes, ramps, enemies, pickups, weapons, physics numbers), so the game plays the same on DS, N64, PlayStation and PC.

- Renderer: software, integer projection, flat-shaded boxes in painter's order into a 160x96 buffer, doubled to 320x192. Bottom 48 lines = HUD (objective, health, ammo, minimap).
- N64: `n64/` (libdragon, custom IPL3, NOTAREAL logo first). World data is little-endian, so it is copied and byte-swapped at load.
- PlayStation: `psx/` (PSn00bSDK, PS-EXE). The R3000 has no FPU and the cross-compiler's float helpers use FPU instructions, so `psx/nr_softfloat.c`
  provides integer-only IEEE single-precision add/sub/mul/div/compare/convert (checked bit-exact against hardware floats over 2M random cases).
- Controls: N64 D-pad / stick move, L/R and C-left/right turn, A jump, B or Z fire, C-down reload, C-up third person, Start weapon switch.
  PlayStation D-pad move, L1/R1 turn, Cross jump, Square or R2 fire, Circle reload, Triangle third person, Select/Start weapon switch.
- Studio: Export ROM with the console set to Nintendo 64 or PlayStation and any 3D template (platformer_3d, open_world_3d, military_shooter, shooter_tps, survival_rpg).
- Build: N64 `cd engine/w3soft/n64 && N64_INST=/opt/libdragon PATH=$N64_INST/bin:$PATH make`; PSX `cmake -S engine/w3soft/psx -B build` with the PSn00bSDK toolchain file, then `cmake --build`. Copy the outputs to `engine/w3soft/nr_w3soft_n64.z64` and `nr_w3soft_psx.exe` (the editor build embeds those).
- Tests: `python3 tests/w3soft_rom_e2e.py` (18 checks in the N64 and PCSX emulators), `python3 tests/w3soft_editor_e2e.py`, `node tests/test_world3d.js`.

## Known limits
- Not run on real N64 / PlayStation hardware. On PlayStation the soft-float maths will be slow on big worlds; expect a low frame rate there.
- Painter's-order sorting by box centre: long walls can occasionally draw in the wrong order. No textures, no jeep / dialogue / store, no music.
- Sound is two square voices plus a noise burst (N64) or SPU squares (PlayStation); not checked by ear.

## Store mode (N64 / PlayStation): the Convenience Store job sim
`store3d` is a fourth mode (3) of this engine (`source/w3store.h`, `source/w3storehud.h`). The shop, street, shelves, parked cars and lamp posts are the same boxes the PC / Xbox game uses (`NRStore.world()`), packed by `kit/nrworld3d.js`; shelf stand spots, back-room piles, register, queue, door, cashier zone, Gus and Mack are entities (types 9-17). Shift settings live in the header pad fields (shift seconds, goal, wallet, till, hours, thief rate, flags).

**In the game:** street spawn -> walk in to clock in -> customers shop (1-3 items from the shelves), queue and wait for you; stand behind the counter and press A to ring them up, then count the change (up/down $1, left/right 5c, hold R for 25c) - exact change builds reputation, over / short costs money / reputation. Shelves empty out: grab a box from the back-room pile (A) and stock the matching shelf (A). Spills appear in the aisle: hold A to mop (customers slip on them). Shoplifters run for the door: tackle with B (fists / bat / pepper spray / taser reach differ). Once per shift a robber demands the till: stop him within 8 s or lose it. Ol' Gus (street): A chat, X give $1 (every third dollar he watches the door); Mack (street): A opens his trunk - bat $25, pepper spray $40, taser $60, refills $10, paid from your wallet. Clock runs 2 PM to 10 PM with a darkening sky; pay (hourly + 5% tips + goal bonus) goes to the wallet at shift end and A starts the next shift (gear carries over).

**Reduced compared with PC / Xbox:** no AI traffic or pedestrians on the street, no cutscenes / story beats, no shotgun, no gear upgrades (steel bat etc.), customers walk fixed lanes instead of a nav grid, one carry box at a time, no save file. Not tried on hardware.

Tests: `tests/w3soft_store_host.py` (host build logic: clock-in, register, stocking, Gus, Mack, thief caught / escaping, mopping, robber, shift end), `tests/w3soft_rom_e2e.py` (boots the store ROM in the N64 and PCSX emulators), `tests/w3soft_editor_e2e.py` (job sim exports on both consoles).

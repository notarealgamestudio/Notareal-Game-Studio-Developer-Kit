# Memphis Sigil - DS music workstation

## Feasibility audit
DS hardware (ARM9 UI + ARM7 sound) is enough for an 8-voice drum/bass step sequencer. Chosen design: ARM7 mailbox sampler
(shared/mailbox.h at 0x02FFF800); ARM9 renders 12 original sounds into RAM at boot (22050 Hz) and posts triggers.
Maxmod is not used.

## Features (built and tested)
Main menu, 8 rows x 16 steps, 5 patterns (A-E), song chain, BPM (timer ISR, 96 PPQ), swing, hat choke, 808-style bass row with
note select, stylus editing on the bottom screen, top-screen playhead/pattern feedback, save/load (.msig, CRC32, 1516 bytes).
Keys: X play, Y record, L/R pattern, Up/Down BPM, Select stop, Start play.

## Build
`cd engine/sigil && BLOCKSDS=/opt/blocksds/core WONDERFUL_TOOLCHAIN=/opt/wonderful make` -> `nr_sigil.nds` (~312 KB).
In the app: Game Studio > Sigil Studio > Export DS ROM (also WAV and .msig export).

## Tests
`node tests/test_sigil.js` (41), `python3 tests/sigil_rom_e2e.py` (7, DeSmuME), `python3 tests/sigil_editor_e2e.py` (10).

## Known limitations
- SD-card save (`fat:/MEMPHIS_SIGIL/PROJECTS/SONG_00N.msig`) is untested: DeSmuME has no FAT card here; only the RAM-slot fallback was verified.
- Audio was verified through mailbox counters and tempo timing, not by ear. Test on the RG DS Plus.
- 16 steps and 5 patterns only; no sample import, no live recording of pitched notes.

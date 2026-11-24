# Korg ROM data in the devkit

Source ROMs: Korg DS-10 and Korg M01 (NitroFS). Extracted by `tools/korg_extract.py <DS-10.nds> <M01.nds>`.
Outputs: `library/korg_ds10_m01.json`, `kit/nrsigil_data.js`, `engine/sigil/source/groove_bank.h`.

## What is used
- DS-10 patch bytes 11 and 12 (24 patches): seed the drum/bass tuning of Sigil sounds.
- DS-10 demo songs: tempo and pattern chain become starter projects (Sigil Studio > starters).
- M01 drum-pattern lanes: folded (lane mod 8) into 36 grooves for the groove picker.
- M01 341 program names and 37 kit names: reference lists shown in the Korg data panel.

## Not fully decoded (honest limits)
- The meaning of the M01 groove lanes is only partly known; they are used as rhythm material, not exact Korg patterns.
- DS-10 patch parameters are used as tuning seeds, not as a full synth patch emulation.
- No Korg audio samples are copied; all 12 Sigil sounds are synthesised originals.

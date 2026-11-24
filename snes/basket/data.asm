.include "hdr.asm"
.section ".nr_driver" superfree
nr_driver: .incbin "build/spc_driver.bin"
nr_driver_end:
.ends
.section ".nr_aud0" superfree
nr_aud0: .incbin "build/audio0.bin"
nr_aud0_end:
.ends
.section ".nr_aud1" superfree
nr_aud1: .incbin "build/audio1.bin"
nr_aud1_end:
.ends
.section ".nr_font" superfree
nr_font: .incbin "build/font.bin"
nr_font_end:
.ends
.section ".nr_logo_t" superfree
nr_logo_tiles: .incbin "build/logo_tiles.bin"
nr_logo_tiles_end:
.ends
.section ".nr_logo_m" superfree
nr_logo_map: .incbin "build/logo_map.bin"
nr_logo_map_end:
.ends
.section ".nr_logo_p" superfree
nr_logo_pal: .incbin "build/logo_pal.bin"
nr_logo_pal_end:
.ends
.section ".bg_t" superfree
bg_tiles: .incbin "build/bg_tiles.bin"
bg_tiles_end:
.ends
.section ".bg_m" superfree
bg_map: .incbin "build/bg_map.bin"
bg_map_end:
.ends
.section ".bg_p" superfree
bg_pal: .incbin "build/bg_pal.bin"
bg_pal_end:
.ends
.section ".obj_t" superfree
obj_tiles: .incbin "build/obj_tiles.bin"
obj_tiles_end:
.ends
.section ".obj_p" superfree
obj_pal: .incbin "build/obj_pal.bin"
obj_pal_end:
.ends
.section ".txt_p" superfree
txt_pal: .incbin "build/txt_pal.bin"
txt_pal_end:
.ends
; ---- the settings block the dev kit patches: bank 1 ($81:8000), magic NRGBSKT1
.bank 1 slot 0
.org 0
.section "nrgcfg" force
.db "NRGBSKT1"
.dsb $1F8, 0
.ends

.include "hdr.asm"
.section ".nr_driver" superfree
nr_driver: .incbin "build/spc_driver.bin"
nr_driver_end:
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
; ---- the game data block: 1 MB in banks 16-47, written by the NOTAREAL dev kit (magic NRGSNES1 at bank 16 $8000)
.bank 16 slot 0
.org 0
.section "nrgdata16" force
.db "NRGSNES1"
.dsb $7FF8, 0
.ends
.bank 17 slot 0
.org 0
.section "nrgdata17" force
.dsb $8000, 0
.ends
.bank 18 slot 0
.org 0
.section "nrgdata18" force
.dsb $8000, 0
.ends
.bank 19 slot 0
.org 0
.section "nrgdata19" force
.dsb $8000, 0
.ends
.bank 20 slot 0
.org 0
.section "nrgdata20" force
.dsb $8000, 0
.ends
.bank 21 slot 0
.org 0
.section "nrgdata21" force
.dsb $8000, 0
.ends
.bank 22 slot 0
.org 0
.section "nrgdata22" force
.dsb $8000, 0
.ends
.bank 23 slot 0
.org 0
.section "nrgdata23" force
.dsb $8000, 0
.ends
.bank 24 slot 0
.org 0
.section "nrgdata24" force
.dsb $8000, 0
.ends
.bank 25 slot 0
.org 0
.section "nrgdata25" force
.dsb $8000, 0
.ends
.bank 26 slot 0
.org 0
.section "nrgdata26" force
.dsb $8000, 0
.ends
.bank 27 slot 0
.org 0
.section "nrgdata27" force
.dsb $8000, 0
.ends
.bank 28 slot 0
.org 0
.section "nrgdata28" force
.dsb $8000, 0
.ends
.bank 29 slot 0
.org 0
.section "nrgdata29" force
.dsb $8000, 0
.ends
.bank 30 slot 0
.org 0
.section "nrgdata30" force
.dsb $8000, 0
.ends
.bank 31 slot 0
.org 0
.section "nrgdata31" force
.dsb $8000, 0
.ends
.bank 32 slot 0
.org 0
.section "nrgdata32" force
.dsb $8000, 0
.ends
.bank 33 slot 0
.org 0
.section "nrgdata33" force
.dsb $8000, 0
.ends
.bank 34 slot 0
.org 0
.section "nrgdata34" force
.dsb $8000, 0
.ends
.bank 35 slot 0
.org 0
.section "nrgdata35" force
.dsb $8000, 0
.ends
.bank 36 slot 0
.org 0
.section "nrgdata36" force
.dsb $8000, 0
.ends
.bank 37 slot 0
.org 0
.section "nrgdata37" force
.dsb $8000, 0
.ends
.bank 38 slot 0
.org 0
.section "nrgdata38" force
.dsb $8000, 0
.ends
.bank 39 slot 0
.org 0
.section "nrgdata39" force
.dsb $8000, 0
.ends
.bank 40 slot 0
.org 0
.section "nrgdata40" force
.dsb $8000, 0
.ends
.bank 41 slot 0
.org 0
.section "nrgdata41" force
.dsb $8000, 0
.ends
.bank 42 slot 0
.org 0
.section "nrgdata42" force
.dsb $8000, 0
.ends
.bank 43 slot 0
.org 0
.section "nrgdata43" force
.dsb $8000, 0
.ends
.bank 44 slot 0
.org 0
.section "nrgdata44" force
.dsb $8000, 0
.ends
.bank 45 slot 0
.org 0
.section "nrgdata45" force
.dsb $8000, 0
.ends
.bank 46 slot 0
.org 0
.section "nrgdata46" force
.dsb $8000, 0
.ends
.bank 47 slot 0
.org 0
.section "nrgdata47" force
.dsb $8000, 0
.ends

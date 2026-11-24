; Super Moonlight Holler - talking to the sound chip (SPC700)
;  snd_boot : upload the driver and all sound data through the IPL boot ROM, start the driver
;  snd_flush: send the commands queued this frame (sound effects, music changes); called once a frame
; The queue (snd_qn, snd_qc/qa/qb) is filled from C (src/sound.c).

.include "hdr.asm"

.BASE $00
.RAMSECTION ".snd_ram" BANK $7E SLOT 2
snd_seq     dw
snd_qn      dw
snd_qc      dsw 8           ; command
snd_qa      dsw 8           ; argument 1
snd_qb      dsw 8           ; argument 2
snd_len     dw
snd_blocks  dsw 32          ; up to 8 uploads: dst, src lo, src bank, len (filled by C; len 0 ends)
.ENDS

.ifdef FASTROM
.BASE $80
.else
.BASE $00
.endif
.SECTION ".snd_code" SUPERFREE

.accu 16
.index 16
.16bit

snd_boot:
    php
    phb
    rep #$30
    pea $7e7e
    plb
    plb
    sep #$20
-   lda.l $002140
    cmp #$AA
    bne -
    lda.l $002141
    cmp #$BB
    bne -
    rep #$20
    lda.w #$00CC
    sta.w snd_seq
    ldx.w #0
@blk:
    lda.l snd_blocks+6,x
    bne @go
    jmp @exec
@go:
    sta.w snd_len
    lda.l snd_blocks,x
    sta.l $002142
    lda.l snd_blocks+2,x
    sta.b tcc__r9
    lda.l snd_blocks+4,x
    sta.b tcc__r9h
    phx
    sep #$20
    lda #$01
    sta.l $002141
    lda.w snd_seq
    sta.l $002140
-   cmp.l $002140
    bne -
    rep #$20
    ldy.w #0
@byte:
    sep #$20
    lda.b [tcc__r9],y
    sta.l $002141
    tya
    sta.l $002140
-   cmp.l $002140
    bne -
    rep #$20
    iny
    cpy.w snd_len
    bne @byte
    ; the next block's kick: last index + 3 (never 0)
    tya
    inc a
    inc a
    and.w #$00FF
    bne +
    lda.w #1
+   sta.w snd_seq
    plx
    txa
    clc
    adc.w #8
    tax
    jmp @blk
@exec:
    lda.w #$0200
    sta.l $002142
    sep #$20
    lda #$00
    sta.l $002141
    lda.w snd_seq
    sta.l $002140
-   cmp.l $002140
    bne -
-   lda.l $002143
    cmp #$5A
    bne -
    rep #$20
    stz.w snd_qn
    plb
    plp
    rtl

snd_flush:
    php
    phb
    rep #$30
    pea $7e7e
    plb
    plb
    ldx.w #0
@q:
    txa
    lsr a
    cmp.w snd_qn
    bcs @done
    sep #$20
    lda.w snd_qa,x
    sta.l $002142
    lda.w snd_qb,x
    sta.l $002143
    lda.w snd_qc,x
    sta.l $002141
    rep #$20
    lda.w snd_seq
    inc a
    and.w #$00FF
    sta.w snd_seq
    sep #$20
    sta.l $002140
    ldy.w #3000
-   cmp.l $002140
    beq +
    dey
    bne -
+   rep #$20
    inx
    inx
    bra @q
@done:
    stz.w snd_qn
    plb
    plp
    rtl

.ENDS

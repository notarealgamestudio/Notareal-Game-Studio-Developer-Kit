; Super Moonlight Holler - SPC700 sound driver
; Voices 0-5: music (instrument sequences with pan, pitch bends, pattern repeats), voices 6-7: sound effects
; (one-shot samples with pitch slide / volume decay, or short note jingles).  Echo for reverb.
; CPU protocol: write $2141=cmd, $2142=arg1, $2143=arg2, then $2140=seq (changes each command).
; The driver echoes seq on port0 when done.  Port3 out = $5A when ready.
;   cmd 1 = sound effect (arg1 id, arg2 pan 0 centre / 1 left / 2 right)
;   cmd 2 = music (arg1 song)     cmd 3 = stop music     cmd 5 = music master volume (arg1 0-127)
.include "../build/audio.inc"

lastseq   = $00
t0        = $01
t1        = $02
t2        = $03
ptr       = $04      ; word
ptr2      = $06      ; word
konbits   = $08
kofbits   = $09
argA      = $0A
argB      = $0B
cmd       = $0C
chreg     = $0D
master    = $0E
cur_song  = $0F
chx       = $10
; music, 6 voices each
m_on      = $12
m_wait    = $18
m_pl      = $1E
m_ph      = $24
m_sl      = $2A      ; channel start (loop point)
m_sh      = $30
m_rl      = $36      ; return address after a repeated pattern
m_rh      = $3C
m_cl      = $42      ; repeated pattern start
m_ch      = $48
m_rc      = $4E      ; repeats left
m_inst    = $54
m_off     = $5A      ; instrument's offset into the pitch table
m_vol     = $60
m_pan     = $66
m_vl      = $6C
m_vr      = $72
m_slide   = $78      ; pitch bend per tick (signed) for the current note
m_nslide  = $7E      ; bend for the next note
m_pitl    = $84
m_pith    = $8A
; sound effects, 2 slots (voices 6, 7)
s_on      = $90
s_time    = $92
s_vol     = $94
s_decay   = $96
s_pl      = $98
s_ph      = $9A
s_slide   = $9C
s_pri     = $9E
s_pan     = $A0
s_seq     = $A2      ; 1 = jingle
s_ql      = $A4
s_qh      = $A6
s_qwait   = $A8
s_vol0    = $AA
rr        = $AC

.org $0200
start:
    clrp
    mov x,#$EF
    mov sp,x
    mov a,#0
    mov x,#0
@clr:
    mov (x)+,a
    cmp x,#$E0
    bne @clr
    mov x,#0
@dsp:
    mov a,!dsp_init_tab+x
    cmp a,#$FF
    beq @dspdone
    mov $F2,a
    inc x
    mov a,!dsp_init_tab+x
    mov $F3,a
    inc x
    bra @dsp
@dspdone:
    mov master,#$6C
    mov cur_song,#$FF
    ; let the echo unit sweep its buffer clean (echo volume 0, feedback 0) for ~250 ms
    mov $FC,#250         ; timer 2 at 64 kHz / 250 = 256 Hz
    mov $F1,#$04
    mov y,#64
@ew:
    mov a,$FF
    beq @ew
    dbnz y,@ew
    mov $FA,#200         ; timer 0: music tempo (set per song)
    mov $FB,#80          ; timer 1: sound effects, 8000/80 = 100 Hz
    mov $F1,#$03         ; timers 0+1 on, IPL ROM off
    mov a,$F4
    mov lastseq,a
    mov $F7,#$5A         ; ready
    mov $F4,a

mainloop:
    mov a,$FD
    beq @t1
    mov t2,a
@tk:
    call mus_tick
    dbnz t2,@tk
    call flush_keys
@t1:
    mov a,$FE
    beq @cmdchk
    mov t2,a
@tk1:
    call sfx_tick
    dbnz t2,@tk1
    call flush_keys
@cmdchk:
    mov a,$F4
    cmp a,$F4
    bne mainloop
    cmp a,lastseq
    beq mainloop
    mov lastseq,a
    mov cmd,$F5
    mov argA,$F6
    mov argB,$F7
    mov a,cmd
    cmp a,#1
    bne @n1
    call cmd_sfx
    bra @ack
@n1:
    cmp a,#2
    bne @n2
    call cmd_music
    bra @ack
@n2:
    cmp a,#3
    bne @n3
    call stop_music
    bra @ack
@n3:
    cmp a,#5
    bne @ack
    mov master,argA
@ack:
    call flush_keys
    mov a,lastseq
    mov $F4,a
    jmp !mainloop

; ------------------------------------------------------------ key flush
flush_keys:
    mov $F2,#$5C
    mov $F3,#$00
    mov a,konbits
    beq @nokon
    mov $F2,#$4C
    mov $F3,a
@nokon:
    mov a,kofbits
    beq @nokof
    mov $F2,#$5C
    mov $F3,a
@nokof:
    mov konbits,#0
    mov kofbits,#0
    ret

; ------------------------------------------------------------ music
cmd_music:
    mov a,argA
    cmp a,cur_song
    bne @new
    ret                  ; already playing
@new:
    call stop_music
    mov a,argA
    mov cur_song,a
    asl a
    mov y,a
    mov a,!AUDIO_SONGS+y
    mov ptr,a
    mov a,!AUDIO_SONGS+1+y
    mov ptr+1,a
    ; header: 6 channel pointers, tempo divisor, echo volume, echo feedback, echo channel mask
    mov y,#0
    mov x,#0
@lp:
    mov a,[ptr]+y
    mov m_pl+x,a
    mov m_sl+x,a
    inc y
    mov a,[ptr]+y
    mov m_ph+x,a
    mov m_sh+x,a
    inc y
    or a,m_pl+x
    beq @off
    mov a,#1
@off:
    mov m_on+x,a
    mov a,#1
    mov m_wait+x,a
    mov a,#100
    mov m_vol+x,a
    mov m_vl+x,a
    mov m_vr+x,a
    mov a,#64
    mov m_pan+x,a
    mov a,#0
    mov m_slide+x,a
    mov m_nslide+x,a
    mov m_rc+x,a
    mov m_inst+x,a
    mov a,!inst_off0
    mov m_off+x,a
    inc x
    cmp x,#6
    bne @lp
    mov a,[ptr]+y
    mov $FA,a            ; tempo
    inc y
    mov a,[ptr]+y
    mov $F2,#$2C
    mov $F3,a            ; EVOL L
    mov $F2,#$3C
    mov $F3,a            ; EVOL R
    inc y
    mov a,[ptr]+y
    mov $F2,#$0D
    mov $F3,a            ; EFB
    inc y
    mov a,[ptr]+y
    mov $F2,#$4D
    mov $F3,a            ; EON
    ret

stop_music:
    mov x,#0
    mov a,#0
@lp:
    mov m_on+x,a
    inc x
    cmp x,#6
    bne @lp
    mov a,kofbits
    or a,#$3F
    mov kofbits,a
    mov cur_song,#$FF
    ret

inst_off0:
    .db 0

; one music tick: count down each voice, read its events when due, apply pitch bends
mus_tick:
    mov x,#0
@ch:
    mov a,m_on+x
    beq @next
    mov a,m_slide+x
    beq @ns
    call bend
@ns:
    mov a,m_wait+x
    dec a
    mov m_wait+x,a
    bne @next
    mov chx,x
    call mus_events
    mov x,chx
@next:
    inc x
    cmp x,#6
    bne @ch
    ret

; pitch += slide*2 (signed) and write it, for voice x
bend:
    mov t1,#0
    mov a,m_slide+x
    bpl @p
    mov t1,#$FF
@p:
    asl a
    rol t1
    clrc
    adc a,m_pitl+x
    mov m_pitl+x,a
    mov a,m_pith+x
    adc a,t1
    and a,#$3F
    mov m_pith+x,a
    mov a,x
    xcn a
    or a,#2
    mov $F2,a
    mov a,m_pitl+x
    mov $F3,a
    mov a,x
    xcn a
    or a,#3
    mov $F2,a
    mov a,m_pith+x
    mov $F3,a
    ret

; events for voice chx until a note or rest sets the wait
mus_events:
    mov x,chx
    mov a,m_pl+x
    mov ptr,a
    mov a,m_ph+x
    mov ptr+1,a
@ev:
    mov x,chx
    mov y,#0
    mov a,[ptr]+y
    cmp a,#$60
    bcs @notnote
    jmp !@note
@notnote:
    bne @n60
    jmp !@rest
@n60:
    cmp a,#$61
    bne @n61
    jmp !@tie
@n61:
    cmp a,#$E0
    beq @inst
    cmp a,#$E1
    beq @vol
    cmp a,#$E2
    beq @pan
    cmp a,#$E3
    beq @slide
    cmp a,#$E4
    beq @call
    cmp a,#$E5
    beq @ret
    cmp a,#$FE
    beq @loop
    ; $FF: end of this voice
    mov a,#0
    mov m_on+x,a
    mov a,!bit_tab+x
    or a,kofbits
    mov kofbits,a
    ret
@loop:
    mov a,m_sl+x
    mov ptr,a
    mov a,m_sh+x
    mov ptr+1,a
    jmp !@ev
@inst:
    inc y
    mov a,[ptr]+y
    mov m_inst+x,a
    asl a
    asl a
    mov y,a
    mov a,!AUDIO_INST+3+y
    mov m_off+x,a
    call adv2
    jmp !@ev
@vol:
    inc y
    mov a,[ptr]+y
    mov m_vol+x,a
    call panvol
    call adv2
    jmp !@ev
@pan:
    inc y
    mov a,[ptr]+y
    mov m_pan+x,a
    call panvol
    call adv2
    jmp !@ev
@slide:
    inc y
    mov a,[ptr]+y
    mov m_nslide+x,a
    call adv2
    jmp !@ev
@call:
    ; $E4 lo hi n: play the pattern at lo/hi n times, then carry on
    inc y
    mov a,[ptr]+y
    mov m_cl+x,a
    inc y
    mov a,[ptr]+y
    mov m_ch+x,a
    inc y
    mov a,[ptr]+y
    mov m_rc+x,a
    mov a,ptr
    clrc
    adc a,#4
    mov m_rl+x,a
    mov a,ptr+1
    adc a,#0
    mov m_rh+x,a
    mov a,m_cl+x
    mov ptr,a
    mov a,m_ch+x
    mov ptr+1,a
    jmp !@ev
@ret:
    mov a,m_rc+x
    dec a
    mov m_rc+x,a
    beq @done
    mov a,m_cl+x
    mov ptr,a
    mov a,m_ch+x
    mov ptr+1,a
    jmp !@ev
@done:
    mov a,m_rl+x
    mov ptr,a
    mov a,m_rh+x
    mov ptr+1,a
    jmp !@ev
@tie:
    inc y
    mov a,[ptr]+y
    mov m_wait+x,a
    call adv2
    jmp !@store
@rest:
    inc y
    mov a,[ptr]+y
    mov m_wait+x,a
    call adv2
    mov a,#0
    mov m_slide+x,a
    mov a,!bit_tab+x
    or a,kofbits
    mov kofbits,a
    jmp !@store
@note:
    ; pitch = table[note + instrument offset]
    clrc
    adc a,m_off+x
    asl a
    mov y,a
    mov a,!AUDIO_PITCH+y
    mov m_pitl+x,a
    mov a,!AUDIO_PITCH+1+y
    mov m_pith+x,a
    mov a,m_nslide+x
    mov m_slide+x,a
    mov a,#0
    mov m_nslide+x,a
    mov a,x
    xcn a
    mov chreg,a
    or a,#2
    mov $F2,a
    mov a,m_pitl+x
    mov $F3,a
    mov a,chreg
    or a,#3
    mov $F2,a
    mov a,m_pith+x
    mov $F3,a
    ; instrument: sample, ADSR
    mov a,m_inst+x
    asl a
    asl a
    mov y,a
    mov a,chreg
    or a,#4
    mov $F2,a
    mov a,!AUDIO_INST+y
    mov $F3,a
    mov a,chreg
    or a,#5
    mov $F2,a
    mov a,!AUDIO_INST+1+y
    mov $F3,a
    mov a,chreg
    or a,#6
    mov $F2,a
    mov a,!AUDIO_INST+2+y
    mov $F3,a
    ; volume (with the master volume)
    mov a,m_vl+x
    mov y,master
    mul ya
    mov a,y
    asl a
    mov $F2,chreg
    mov $F3,a
    mov a,m_vr+x
    mov y,master
    mul ya
    mov a,y
    asl a
    mov t0,a
    mov a,chreg
    or a,#1
    mov $F2,a
    mov $F3,t0
    ; duration
    mov y,#1
    mov a,[ptr]+y
    mov m_wait+x,a
    call adv2
    mov a,!bit_tab+x
    or a,konbits
    mov konbits,a
    mov a,!bit_tab+x
    eor a,#$FF
    and a,kofbits
    mov kofbits,a
@store:
    mov x,chx
    mov a,ptr
    mov m_pl+x,a
    mov a,ptr+1
    mov m_ph+x,a
    ret

; left/right volume of voice x from its volume and pan (0 left .. 64 centre .. 128 right)
panvol:
    push y
    mov a,#128
    setc
    sbc a,m_pan+x
    mov y,m_vol+x
    mul ya
    call @scale
    mov m_vl+x,a
    mov a,m_pan+x
    mov y,m_vol+x
    mul ya
    call @scale
    mov m_vr+x,a
    pop y
    ret
@scale:             ; ya >> 6, at most 127
    movw ptr2,ya
    asl ptr2
    rol ptr2+1
    asl ptr2
    rol ptr2+1
    mov a,ptr2+1
    bpl @ok
    mov a,#127
@ok:
    ret

adv2:
    mov a,ptr
    clrc
    adc a,#2
    mov ptr,a
    mov a,ptr+1
    adc a,#0
    mov ptr+1,a
    ret

; ------------------------------------------------------------ sound effects
; table entry (8 bytes): sample, pitch lo, pitch hi, slide, volume, decay, ticks, priority
;   jingle: $FF, sample, seq lo, seq hi, volume, decay, 0, priority  (seq: pitch-table index, ticks ... $FF)
cmd_sfx:
    mov a,argA
    cmp a,#SFX_COUNT
    bcc @ok
    ret
@ok:
    mov y,#8
    mul ya
    clrc
    adc a,#<AUDIO_SFXTAB
    mov ptr,a
    mov a,y
    adc a,#>AUDIO_SFXTAB
    mov ptr+1,a
    mov y,#7
    mov a,[ptr]+y
    mov t0,a             ; priority
    ; a free slot, else the quieter/lower one
    mov x,#0
    mov a,s_on
    beq @got
    inc x
    mov a,s_on+1
    beq @got
    mov a,s_pri
    cmp a,s_pri+1
    bcc @l0
    ; slot 1 is lower (or equal: alternate)
    mov x,#1
    mov a,s_pri+1
    cmp a,s_pri
    bne @l1
    mov a,rr
    eor a,#1
    mov rr,a
    mov x,a
@l1:
    bra @chk
@l0:
    mov x,#0
@chk:
    mov a,t0
    cmp a,s_pri+x
    bcs @got
    ret
@got:
    mov chx,x
    mov a,t0
    mov s_pri+x,a
    mov a,argB
    mov s_pan+x,a
    mov a,#1
    mov s_on+x,a
    mov a,x
    clrc
    adc a,#6
    xcn a
    mov chreg,a
    mov y,#0
    mov a,[ptr]+y
    cmp a,#$FF
    beq @jingle
    ; one-shot
    mov t1,a
    mov a,#0
    mov s_seq+x,a
    inc y
    mov a,[ptr]+y
    mov s_pl+x,a
    inc y
    mov a,[ptr]+y
    mov s_ph+x,a
    inc y
    mov a,[ptr]+y
    mov s_slide+x,a
    inc y
    mov a,[ptr]+y
    mov s_vol+x,a
    inc y
    mov a,[ptr]+y
    mov s_decay+x,a
    inc y
    mov a,[ptr]+y
    mov s_time+x,a
    call s_start
    ret
@jingle:
    inc y
    mov a,[ptr]+y
    mov t1,a             ; sample
    inc y
    mov a,[ptr]+y
    mov s_ql+x,a
    inc y
    mov a,[ptr]+y
    mov s_qh+x,a
    inc y
    mov a,[ptr]+y
    mov s_vol0+x,a
    inc y
    mov a,[ptr]+y
    mov s_decay+x,a
    mov a,#1
    mov s_seq+x,a
    mov s_qwait+x,a
    mov a,#0
    mov s_slide+x,a
    mov a,chreg
    or a,#4
    mov $F2,a
    mov $F3,t1
    mov a,chreg
    or a,#5
    mov $F2,a
    mov $F3,#0
    mov a,chreg
    or a,#7
    mov $F2,a
    mov $F3,#$7F
    ret                  ; the first note plays on the next tick

; voice for slot x: sample t1, regs, key on
s_start:
    mov a,chreg
    or a,#4
    mov $F2,a
    mov $F3,t1
    mov a,chreg
    or a,#5
    mov $F2,a
    mov $F3,#0           ; ADSR off: GAIN
    mov a,chreg
    or a,#7
    mov $F2,a
    mov $F3,#$7F
    call s_regs
    mov a,!bit_tab+6+x
    or a,konbits
    mov konbits,a
    mov a,!bit_tab+6+x
    eor a,#$FF
    and a,kofbits
    mov kofbits,a
    ret

; volume and pitch registers for slot x (chreg set)
s_regs:
    mov a,chreg
    or a,#2
    mov $F2,a
    mov a,s_pl+x
    mov $F3,a
    mov a,chreg
    or a,#3
    mov $F2,a
    mov a,s_ph+x
    mov $F3,a
    mov a,s_vol+x
    mov t1,a
    lsr a
    mov t0,a
    mov a,s_pan+x
    cmp a,#1
    bne @nl
    mov $F2,chreg
    mov $F3,t1
    mov a,chreg
    or a,#1
    mov $F2,a
    mov $F3,t0
    ret
@nl:
    cmp a,#2
    bne @c
    mov $F2,chreg
    mov $F3,t0
    mov a,chreg
    or a,#1
    mov $F2,a
    mov $F3,t1
    ret
@c:
    mov $F2,chreg
    mov $F3,t1
    mov a,chreg
    or a,#1
    mov $F2,a
    mov $F3,t1
    ret

sfx_tick:
    mov x,#0
@sl:
    mov chx,x
    mov a,s_on+x
    bne @on
    jmp !@next
@on:
    mov a,x
    clrc
    adc a,#6
    xcn a
    mov chreg,a
    mov a,s_seq+x
    beq @oneshot
    ; jingle: next note when due
    mov a,s_qwait+x
    dec a
    mov s_qwait+x,a
    bne @dec
    mov a,s_ql+x
    mov ptr,a
    mov a,s_qh+x
    mov ptr+1,a
    mov y,#0
    mov a,[ptr]+y
    cmp a,#$FF
    beq @off
    asl a
    mov y,a
    mov a,!AUDIO_PITCH+y
    mov s_pl+x,a
    mov a,!AUDIO_PITCH+1+y
    mov s_ph+x,a
    mov y,#1
    mov a,[ptr]+y
    mov s_qwait+x,a
    call adv2
    mov a,ptr
    mov s_ql+x,a
    mov a,ptr+1
    mov s_qh+x,a
    mov a,s_vol0+x
    mov s_vol+x,a
    call s_regs
    mov a,!bit_tab+6+x
    or a,konbits
    mov konbits,a
    bra @next
@dec:
    mov a,s_vol+x
    setc
    sbc a,s_decay+x
    bcs @dv
    mov a,#0
@dv:
    mov s_vol+x,a
    call s_regs
    bra @next
@oneshot:
    mov a,s_vol+x
    setc
    sbc a,s_decay+x
    bcs @v
    mov a,#0
@v:
    mov s_vol+x,a
    mov a,s_slide+x
    beq @nos
    mov t1,#0
    mov a,s_slide+x
    bpl @pos
    mov t1,#$FF
@pos:
    asl a
    rol t1
    asl a
    rol t1
    clrc
    adc a,s_pl+x
    mov s_pl+x,a
    mov a,s_ph+x
    adc a,t1
    and a,#$3F
    mov s_ph+x,a
@nos:
    call s_regs
    mov a,s_time+x
    dec a
    mov s_time+x,a
    beq @off
    mov a,s_vol+x
    bne @next
@off:
    mov a,#0
    mov s_on+x,a
    mov s_pri+x,a
    mov a,!bit_tab+6+x
    or a,kofbits
    mov kofbits,a
@next:
    mov x,chx
    inc x
    mov chx,x
    cmp x,#2
    beq @x
    jmp !@sl
@x:
    ret

bit_tab:
    .db $01,$02,$04,$08,$10,$20,$40,$80

dsp_init_tab:
    .db $6C,$20, $0C,$7F, $1C,$7F, $2C,$00, $3C,$00, $3D,$00, $4D,$00, $2D,$00
    .db $5D,AUDIO_DIR_PAGE, $6D,ECHO_PAGE, $7D,ECHO_EDL, $0D,$00, $5C,$FF
    .db $0F,$40, $1F,$20, $2F,$10, $3F,$08, $4F,$04, $5F,$02, $6F,$01, $7F,$00
    .db $6C,$00
    .db $FF

driver_end:
.assert driver_end < AUDIO_DATA_BASE, "driver overlaps audio data"

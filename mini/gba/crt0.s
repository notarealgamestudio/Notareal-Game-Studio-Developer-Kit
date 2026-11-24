    .section .text.start, "ax"
    .arm
    .global _start
_start:
    b       1f
    .incbin "logo.bin"
    .ascii  "NOTAREAL    "          @ title (12)
    .ascii  "NRMN"                  @ game code
    .ascii  "NR"                    @ maker
    .byte   0x96, 0, 0, 0, 0, 0, 0, 0, 0, 0   @ fixed, unit, device, reserved
    .byte   0                       @ version
    .byte   0                       @ complement check (patched by the studio)
    .byte   0, 0
    .balign 4
1:  mov     r0, #0x12               @ IRQ mode stack
    msr     cpsr_c, r0
    ldr     sp, =0x03007FA0
    mov     r0, #0x1F               @ system mode
    msr     cpsr_c, r0
    ldr     sp, =0x03007F00
    ldr     r0, =__data_lma         @ copy .data
    ldr     r1, =__data_start
    ldr     r2, =__data_end
2:  cmp     r1, r2
    ldrlo   r3, [r0], #4
    strlo   r3, [r1], #4
    blo     2b
    ldr     r1, =__bss_start        @ zero .bss
    ldr     r2, =__bss_end
    mov     r3, #0
3:  cmp     r1, r2
    strlo   r3, [r1], #4
    blo     3b
    ldr     r0, =main
    bx      r0
    .pool

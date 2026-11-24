# NOTAREAL kit: tiny RSP program used to detect whether the emulator really runs
# custom RSP microcode (LLE RSP). HLE-only RSP plugins never execute it.
#include <rsp.inc>
    .set noreorder

    .data
    .long 0                 # (data section must not be empty)
    .text
    .globl _start
_start:
    li t0, 0x4E52
    sll t0, 16
    ori t0, 0x4B54          # "NRKT"
    sw t0, 0x100(zero)
    break
    nop

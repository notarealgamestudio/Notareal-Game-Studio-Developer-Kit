// Shared ARM9 <-> ARM7 mailbox in main RAM. Both CPUs poll it; no IPC FIFO and no interrupts are involved,
// so it keeps working on emulators that drop FIFO interrupts (DraStic). 0x02FFF800 is an uncached main-RAM
// mirror in DS mode, past libnds's transfer region (0x02FFF000) and before the firmware user settings (0x02FFFC80).
#pragma once
#include <stdint.h>

#define MB_MAGIC_ARM7 0x37574349u   // "ICW7": set by the ARM7 once it is servicing the mailbox
#define MB_RING 32

enum { MB_NOP, MB_SAMPLE, MB_PSG, MB_NOISE, MB_KILL, MB_VOL, MB_TIMER, MB_MASTER };

// w0: op | ch << 8 | vol << 16 | pan << 24
// SAMPLE: w1 source address, w2 length in words, w3 timer | format << 16 | loop << 18 | (loop start words/4) << 20
// PSG:    w2 duty (0-7), w3 timer        NOISE: w3 timer        VOL: vol in w0      TIMER: w3 timer
typedef struct { uint32_t w0, w1, w2, w3; } MbCmd;

typedef struct {
    volatile uint32_t magic;                 // ARM7 alive marker
    volatile uint32_t frame7;                // ARM7 frame counter
    volatile uint16_t keyxy;                 // REG_KEYXY with the touch bit from the pen test (0 = pressed)
    volatile uint16_t pad0;
    volatile uint16_t rawx, rawy, px, py;    // last touch position while the pen is down
    volatile uint32_t wr;                    // written by ARM9 (next slot to fill)
    volatile uint32_t rd;                    // written by ARM7 (next slot to execute)
    volatile MbCmd cmd[MB_RING];
} Mailbox;

_Static_assert(sizeof(Mailbox) <= 0x480, "mailbox must fit below the firmware user settings");
#define MAILBOX ((Mailbox *)0x02FFF800)

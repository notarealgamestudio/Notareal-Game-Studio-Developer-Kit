// ICW ARM7: sound hardware + input, serviced through a polled shared-memory mailbox (see shared/mailbox.h).
// No libnds FIFO and no interrupt handlers: DraStic drops IPC FIFO interrupts, which deadlocked the stock core.
#include <nds.h>
#include "../../shared/mailbox.h"

static void run_cmd(const volatile MbCmd *c)
{
    uint32_t w0 = c->w0, op = w0 & 0xFF, ch = (w0 >> 8) & 15, vol = (w0 >> 16) & 127, pan = (w0 >> 24) & 127;
    switch (op) {
    case MB_SAMPLE:
        REG_SOUNDXCNT(ch) = 0;
        REG_SOUNDXSAD(ch) = c->w1;
        REG_SOUNDXPNT(ch) = 0;
        REG_SOUNDXLEN(ch) = c->w2;
        REG_SOUNDXTMR(ch) = c->w3 & 0xFFFF;
        REG_SOUNDXCNT(ch) = SOUNDXCNT_ENABLE | SOUNDXCNT_VOL_MUL(vol) | SOUNDXCNT_PAN(pan)
                          | (((c->w3 >> 16) & 3) << 29) | (((c->w3 >> 18) & 1) ? SOUNDXCNT_REPEAT : SOUNDXCNT_ONE_SHOT);
        break;
    case MB_PSG:
        if (ch < 8 || ch > 13) break;
        REG_SOUNDXCNT(ch) = 0;
        REG_SOUNDXTMR(ch) = c->w3 & 0xFFFF;
        REG_SOUNDXCNT(ch) = SOUNDXCNT_ENABLE | vol | SOUNDXCNT_PAN(pan) | SOUNDXCNT_FORMAT_PSG | ((c->w2 & 7) << 24);
        break;
    case MB_NOISE:
        if (ch < 14) break;
        REG_SOUNDXCNT(ch) = 0;
        REG_SOUNDXTMR(ch) = c->w3 & 0xFFFF;
        REG_SOUNDXCNT(ch) = SOUNDXCNT_ENABLE | vol | SOUNDXCNT_PAN(pan) | SOUNDXCNT_FORMAT_PSG;
        break;
    case MB_KILL:
        REG_SOUNDXCNT(ch) = 0;
        break;
    case MB_VOL:                                     // change volume without restarting the channel
        REG_SOUNDXCNT(ch) = (REG_SOUNDXCNT(ch) & ~0x7Fu) | vol;
        break;
    case MB_TIMER:
        REG_SOUNDXTMR(ch) = c->w3 & 0xFFFF;
        break;
    case MB_MASTER:
        REG_SOUNDCNT = SOUNDCNT_ENABLE | SOUNDCNT_VOL(vol);
        break;
    }
}

static void service(void)
{
    Mailbox *mb = MAILBOX;
    uint32_t rd = mb->rd;
    while (rd != mb->wr) {
        run_cmd(&mb->cmd[rd % MB_RING]);
        rd++;
        mb->rd = rd;
    }
}

static void input(void)
{
    Mailbox *mb = MAILBOX;
    u16 keys = REG_KEYXY | KEYXY_TOUCH;              // KEYXY_TOUCH set = not touching
    if (touchPenDown()) {
        touchPosition t;
        touchReadXY(&t);
        if (t.rawx && t.rawy) {
            mb->rawx = t.rawx; mb->rawy = t.rawy; mb->px = t.px; mb->py = t.py;
            keys &= ~KEYXY_TOUCH;
        }
    }
    mb->keyxy = keys;
    mb->frame7++;
}

int main(void)
{
    Mailbox *mb = MAILBOX;
    enableSound();
    REG_SOUNDCNT = SOUNDCNT_ENABLE | SOUNDCNT_VOL(127);
    readUserSettings();
    touchInit();
    mb->keyxy = 0xFFFF;
    mb->rd = mb->wr;                                 // drop anything queued before we started
    mb->magic = MB_MAGIC_ARM7;
    while (1) {
        while (REG_VCOUNT != 192) service();        // keep draining sound commands all frame
        input();                                     // once per frame, at the start of VBlank
        while (REG_VCOUNT == 192) service();
    }
    return 0;
}

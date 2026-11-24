// ARM9 side of the kit's shared-memory sound/input link (from ICW): no IPC FIFO, so it works on DraStic.
#include <nds.h>
#include "../../../shared/mailbox.h"
static u32 snd_t(int hz) { if (hz < 1) hz = 1; return (u16)((-(33513982 >> 1) - ((hz + 1) >> 1)) / hz); }
static void post(u32 w0, u32 w1, u32 w2, u32 w3) {
    Mailbox *mb = MAILBOX;
    if (mb->magic != MB_MAGIC_ARM7) return;
    u32 wr = mb->wr;
    if (wr - mb->rd >= MB_RING) return;
    volatile MbCmd *c = &mb->cmd[wr % MB_RING];
    c->w0 = w0; c->w1 = w1; c->w2 = w2; c->w3 = w3;
    mb->wr = wr + 1;
}
static u32 head(int op, int ch, int vol, int pan) {
    if (vol < 0) vol = 0; if (vol > 127) vol = 127; if (pan < 0) pan = 0; if (pan > 127) pan = 127;
    return op | (ch & 15) << 8 | vol << 16 | pan << 24;
}
void snd_sample_ch(int ch, const void *data, u32 bytes, int fmt, int hz, int vol, int pan, int loop)
{ post(head(MB_SAMPLE, ch, vol, pan), (u32)data, bytes >> 2, snd_t(hz) | (fmt & 3) << 16 | (loop ? 1u : 0u) << 18); }
void snd_sample_loop(int ch, const void *data, u32 bytes, int hz, int vol, int pan, int loop_bytes)
{ post(head(MB_SAMPLE, ch, vol, pan), (u32)data, bytes >> 2, snd_t(hz) | (loop_bytes >= 0 ? (1u << 18) | ((u32)(loop_bytes >> 4) << 20) : 0)); }
void snd_psg_ch(int ch, int duty, int hz, int vol, int pan) { post(head(MB_PSG, ch, vol, pan), 0, duty, snd_t(hz)); }
void snd_noise_ch(int ch, int hz, int vol, int pan) { post(head(MB_NOISE, ch, vol, pan), 0, 0, snd_t(hz)); }
void snd_stop(int ch) { post(head(MB_KILL, ch, 0, 0), 0, 0, 0); }
void snd_master(int vol) { post(head(MB_MASTER, 0, vol, 0), 0, 0, 0); }
void setTransferInputData(touchPosition *touch, u16 buttons);
void snd_input(void) {
    Mailbox *mb = MAILBOX;
    if (mb->magic != MB_MAGIC_ARM7) return;
    touchPosition t = { 0 };
    u16 k = mb->keyxy;
    if (!(k & KEYXY_TOUCH)) { t.rawx = mb->rawx; t.rawy = mb->rawy; t.px = mb->px; t.py = mb->py; }
    setTransferInputData(&t, k);
}

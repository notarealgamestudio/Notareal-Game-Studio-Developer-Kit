// ARM9 side of the shared-memory sound/input link (shared/mailbox.h). Replaces libnds's FIFO-based sound
// calls (icw.h maps soundPlaySample & co. onto these) and feeds touch/X/Y into libnds's key state.
#include "icw.h"
#include "../../../shared/mailbox.h"

static u32 snd_t(int hz) { if (hz < 1) hz = 1; return (u16)((-(33513982 >> 1) - ((hz + 1) >> 1)) / hz); }

static void post(u32 w0, u32 w1, u32 w2, u32 w3)
{
    Mailbox *mb = MAILBOX;
    if (mb->magic != MB_MAGIC_ARM7) return;           // ARM7 not up yet: drop
    u32 wr = mb->wr;
    if (wr - mb->rd >= MB_RING) return;                // ring full: drop rather than block
    volatile MbCmd *c = &mb->cmd[wr % MB_RING];
    c->w0 = w0; c->w1 = w1; c->w2 = w2; c->w3 = w3;
    mb->wr = wr + 1;
}
static u32 head(int op, int ch, int vol, int pan)
{
    if (vol < 0) vol = 0; if (vol > 127) vol = 127; if (pan < 0) pan = 0; if (pan > 127) pan = 127;
    return op | (ch & 15) << 8 | vol << 16 | pan << 24;
}

void snd_sample_ch(int ch, const void *data, u32 bytes, int fmt, int hz, int vol, int pan, int loop)
{
    post(head(MB_SAMPLE, ch, vol, pan), (u32)data, bytes >> 2, snd_t(hz) | (fmt & 3) << 16 | (loop ? 1u : 0u) << 18);
}
void snd_psg_ch(int ch, int duty, int hz, int vol, int pan) { post(head(MB_PSG, ch, vol, pan), 0, duty, snd_t(hz)); }
void snd_noise_ch(int ch, int hz, int vol, int pan) { post(head(MB_NOISE, ch, vol, pan), 0, 0, snd_t(hz)); }
void snd_vol(int ch, int vol) { post(head(MB_VOL, ch, vol, 0), 0, 0, 0); }
void snd_pitch(int ch, int hz) { post(head(MB_TIMER, ch, 0, 0), 0, 0, snd_t(hz)); }
void snd_stop(int ch) { if (ch >= 0) post(head(MB_KILL, ch, 0, 0), 0, 0, 0); }
void snd_master(int vol) { post(head(MB_MASTER, 0, vol, 0), 0, 0, 0); }

// libnds-compatible wrappers for sound effects: channels 11-13 for samples, 12-13 PSG, 14 noise.
// (0-10 and 15 belong to the music engine.)
static int rr_s, rr_p;
void snd_enable(void) {}
int snd_play_sample(const void *data, int fmt, u32 bytes, int hz, int vol, int pan, int loop, int lp)
{
    (void)lp;
    int ch = 11 + rr_s; rr_s = (rr_s + 1) % 3;
    snd_sample_ch(ch, data, bytes, fmt, hz, vol, pan, loop);
    return ch;
}
int snd_play_psg(int duty, int hz, int vol, int pan) { int ch = 12 + rr_p; rr_p ^= 1; snd_psg_ch(ch, duty, hz, vol, pan); return ch; }
int snd_play_noise(int hz, int vol, int pan) { snd_noise_ch(14, hz, vol, pan); return 14; }
void snd_kill(int ch) { snd_stop(ch); }

// Input: hand the ARM7's touch/X/Y/lid state to libnds before scanKeys() so keysHeld()/touchRead() work as usual.
void setTransferInputData(touchPosition *touch, u16 buttons);   // libnds (keys.c), not in public headers
void snd_input(void)
{
    Mailbox *mb = MAILBOX;
    if (mb->magic != MB_MAGIC_ARM7) return;
    touchPosition t = { 0 };
    u16 k = mb->keyxy;
    if (!(k & KEYXY_TOUCH)) { t.rawx = mb->rawx; t.rawy = mb->rawy; t.px = mb->px; t.py = mb->py; }
    setTransferInputData(&t, k);
}

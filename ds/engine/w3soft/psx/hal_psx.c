/* PlayStation front end for the software 3D world engine (PSn00bSDK): 320x240 15bpp framebuffer via LoadImage, pad, SPU square voices. */
#include <stdint.h>
#include <stdio.h>
#include <psxgpu.h>
#include <psxapi.h>
#include <psxpad.h>
#include <psxspu.h>
#include <hwregs_c.h>
#include "notareal_psx.h"
#include "assets/pitch.h"
#include "assets/sq.h"
extern const uint32_t nr_splash[];
#include "../source/w3core.c"
static DISPENV disp[2]; static DRAWENV draw[2]; static int cur;
static uint8_t pad_buff[2][34];
static int sq_addr; static int vnote[2], vlife[2];
static void spo(int ch, int note, int vol)
{
    if (!note) { SpuSetKey(0, 1 << ch); vnote[ch] = 0; return; }
    SpuSetKey(0, 1 << ch);
    SPU_CH_FREQ(ch) = NOTE_PITCH[note]; SPU_CH_ADDR(ch) = getSPUAddr(sq_addr);
    SPU_CH_VOL_L(ch) = SPU_CH_VOL_R(ch) = vol * 0xA0;
    SPU_CH_ADSR1(ch) = 0x00ff; SPU_CH_ADSR2(ch) = 0x0000;
    SpuSetKey(1, 1 << ch); vnote[ch] = note;
}
static int hz2note(int hz) { int note = 69; float f = 440; while (hz > f * 1.03f && note < 96) { f *= 1.05946f; note++; } while (hz < f / 1.03f && note > 24) { f /= 1.05946f; note--; } return note; }
void h_blip(int hz, int ch) { ch &= 1; spo(ch, hz2note(hz), 9); vlife[ch] = 9; }
void h_shot(int big) { spo(2, big ? 28 : 36, 14); vlife[2] = big ? 10 : 6; }
unsigned h_keys(void)
{
    PADTYPE *p = (PADTYPE *)pad_buff[0]; unsigned r = 0; uint16_t b;
    if (p->stat != 0 || !(p->type == 4 || p->type == 5 || p->type == 7)) return 0;
    b = ~p->btn;
    if (b & PAD_UP) r |= KEY_UP; if (b & PAD_DOWN) r |= KEY_DOWN; if (b & PAD_LEFT) r |= KEY_LEFT; if (b & PAD_RIGHT) r |= KEY_RIGHT;
    if (b & PAD_L1) r |= KEY_L; if (b & PAD_R1) r |= KEY_R; if (b & PAD_CROSS) r |= KEY_A; if (b & (PAD_SQUARE | PAD_R2)) r |= KEY_B;
    if (b & PAD_CIRCLE) r |= KEY_X; if (b & PAD_TRIANGLE) r |= KEY_Y; if (b & (PAD_SELECT | PAD_START)) r |= KEY_SELECT;
    return r;
}
void h_present(const u16 *fb)
{
    RECT r; static u16 pk[320 * 240]; for (int i = 0; i < 320 * 240; i++) pk[i] = fb[i] & 0x7FFF;
    r.x = 0; r.y = draw[cur ^ 1].clip.y; r.w = 320; r.h = 240;   /* write into the buffer that is not on screen */
    LoadImage(&r, (uint32_t *)pk); DrawSync(0);
    for (int v = 0; v < 3; v++) if (vlife[v] && --vlife[v] == 0) spo(v, 0, 0);
    VSync(0);
    PutDispEnv(&disp[cur ^ 1]); cur ^= 1;
}
int main(void)
{
    static uint32_t zero[320 * 8 / 2]; int y; RECT z;
    ResetGraph(0);
    notareal_psx_splash(nr_splash);          /* every Notareal ROM opens on the logo */
    SetDefDispEnv(&disp[0], 0, 0, 320, 240); SetDefDrawEnv(&draw[0], 0, 0, 320, 240);
    SetDefDispEnv(&disp[1], 0, 240, 320, 240); SetDefDrawEnv(&draw[1], 0, 240, 320, 240);
    for (y = 0; y < 480; y += 8) { z.x = 0; z.y = y; z.w = 320; z.h = 8; LoadImage(&z, zero); DrawSync(0); }
    cur = 0; PutDispEnv(&disp[0]); SetDispMask(1);
    SpuInit(); SpuSetTransferMode(SPU_TRANSFER_BY_DMA); SpuSetTransferStartAddr(0x1010);
    SpuWrite((const uint32_t *)SND_SQUARE, 64); SpuIsTransferCompleted(SPU_TRANSFER_WAIT);
    sq_addr = 0x1010; SPU_MASTER_VOL_L = 0x3fff; SPU_MASTER_VOL_R = 0x3fff;
    InitPAD(pad_buff[0], 34, pad_buff[1], 34); StartPAD(); ChangeClearPAD(0);
    w3_run();
    return 0;
}

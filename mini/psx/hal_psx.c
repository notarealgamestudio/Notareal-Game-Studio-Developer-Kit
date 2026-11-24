/* PlayStation HAL for the mini engine (PSn00bSDK): software PPU -> 15bpp VRAM, pad, SPU square voices. */
#include <stdint.h>
#include <stdio.h>
#include <psxgpu.h>
#include <psxapi.h>
#include <psxpad.h>
#include <psxspu.h>
#include <hwregs_c.h>
#include "notareal_psx.h"
#include "../src/hal.h"
#define SP_COL(c) ((u16)(c))
#include "../src/softppu.h"
#include "assets/pitch.h"
#include "assets/sq.h"
extern const uint32_t nr_splash[];
void game_main(void);
static DISPENV disp[2]; static DRAWENV draw[2]; static int cur;
static uint8_t pad_buff[2][34];
static int sq_addr; static u8 vnote[2];
void hal_snd_init(void) {
    SpuInit();
    SpuSetTransferMode(SPU_TRANSFER_BY_DMA); SpuSetTransferStartAddr(0x1010);
    SpuWrite((const uint32_t *)SND_SQUARE, 64); SpuIsTransferCompleted(SPU_TRANSFER_WAIT);
    sq_addr = 0x1010; SPU_MASTER_VOL_L = 0x3fff; SPU_MASTER_VOL_R = 0x3fff;
}
void hal_tone(u8 v, u8 note, u8 vol) {
    int ch = v;
    if (!note || !vol) { if (vnote[v]) { SpuSetKey(0, 1 << ch); vnote[v] = 0; } return; }
    if (vnote[v] == note) { SPU_CH_VOL_L(ch) = SPU_CH_VOL_R(ch) = vol * 0xA0; return; }
    SpuSetKey(0, 1 << ch);
    SPU_CH_FREQ(ch) = NOTE_PITCH[note]; SPU_CH_ADDR(ch) = getSPUAddr(sq_addr);
    SPU_CH_VOL_L(ch) = SPU_CH_VOL_R(ch) = vol * 0xA0;
    SPU_CH_ADSR1(ch) = 0x00ff; SPU_CH_ADSR2(ch) = 0x0000;
    SpuSetKey(1, 1 << ch); vnote[v] = note;
}
u8 hal_pad(void) {
    PADTYPE *p = (PADTYPE *)pad_buff[0]; u8 r = 0; uint16_t b;
    if (p->stat != 0 || !(p->type == 4 || p->type == 5 || p->type == 7)) return 0;
    b = ~p->btn;
    if (b & PAD_RIGHT) r |= P_R; if (b & PAD_LEFT) r |= P_L; if (b & PAD_DOWN) r |= P_D; if (b & PAD_UP) r |= P_U;
    if (b & (PAD_CROSS | PAD_CIRCLE)) r |= P_A; if (b & PAD_SQUARE) r |= P_B; if (b & PAD_START) r |= P_START;
    return r;
}
void hal_frame(void) {
    RECT r; sp_render();
    r.x = 40; r.y = draw[cur ^ 1].clip.y + 40; r.w = SPW; r.h = SPH;   /* write into the buffer that is not on screen */
    LoadImage(&r, (uint32_t *)sp_fb); DrawSync(0);
    VSync(0);
    PutDispEnv(&disp[cur ^ 1]); cur ^= 1;
}
int main(void) {
    static uint32_t zero[320 * 8 / 2]; int y; RECT z;
    ResetGraph(0);
    notareal_psx_splash(nr_splash);          /* every Notareal ROM opens on the logo */
    SetDefDispEnv(&disp[0], 0, 0, 320, 240); SetDefDrawEnv(&draw[0], 0, 0, 320, 240);
    SetDefDispEnv(&disp[1], 0, 240, 320, 240); SetDefDrawEnv(&draw[1], 0, 240, 320, 240);
    for (y = 0; y < 480; y += 8) { z.x = 0; z.y = y; z.w = 320; z.h = 8; LoadImage(&z, zero); DrawSync(0); }
    cur = 0; PutDispEnv(&disp[0]); SetDispMask(1);
    InitPAD(pad_buff[0], 34, pad_buff[1], 34); StartPAD(); ChangeClearPAD(0);
    game_main();
    return 0;
}

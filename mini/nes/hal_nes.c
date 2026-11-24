#include "../src/hal.h"
#define REG(a) (*(volatile u8 *)(a))
#define PPUCTRL REG(0x2000)
#define PPUMASK REG(0x2001)
#define PPUSTATUS REG(0x2002)
#define PPUSCROLL REG(0x2005)
#define PPUADDR REG(0x2006)
#define PPUDATA REG(0x2007)
#define OAMDMA REG(0x4014)
#define JOY REG(0x4016)
#define D8(o) (NRD[o])
#define D16(o) ((u16)(NRD[o] | (NRD[(o) + 1] << 8)))
#include "../src/notes_nes.h"
void hal_snd_init(void) { REG(0x4015) = 0x03; REG(0x4000) = 0x30; REG(0x4004) = 0x30; REG(0x4017) = 0x40; }
void hal_tone(u8 v, u8 note, u8 vol) {
    u16 f; u8 b = v ? 4 : 0;
    if (!note) { REG(0x4000 + b) = 0x30; return; }
    f = NOTE_REG[note - 24]; REG(0x4000 + b) = (u8)(0x70 | vol); REG(0x4002 + b) = (u8)f; REG(0x4003 + b) = (u8)(0x08 | (f >> 8));
}
#pragma bss-name (push, "OAM")
u8 oam[256];
#pragma bss-name (pop)
static u8 direct, oamn, qbuf[30], qn, qpend; static u16 qcol, sx; static u8 *op;
static u16 xhdr(void) { return D16(48); }
static void waitvbl(void) { while (!(PPUSTATUS & 0x80)) ; }
static void setaddr(u16 a) { (void)PPUSTATUS; PPUADDR = (u8)(a >> 8); PPUADDR = (u8)a; }
static void setpal(u8 which) {
    u16 p = D16(xhdr()); u8 i;
    setaddr(0x3F00);
    for (i = 0; i < 4; i++) PPUDATA = D8(p + (which ? 4 : 0) + i);
    setaddr(0x3F04); for (i = 0; i < 4; i++) PPUDATA = D8(p + (which ? 4 : 0) + i);
    for (i = 0; i < 12; i++) { u8 g = i / 3, k = i % 3; setaddr(0x3F11 + g * 4 + k); PPUDATA = D8(p + 8 + g * 3 + k); }
}
static void clear_nt(void) { u16 i; setaddr(0x2000); for (i = 0; i < 2048; i++) PPUDATA = 0; }
void hal_init(void) {
    u16 i; PPUCTRL = 0; PPUMASK = 0;
    waitvbl(); waitvbl();
    for (i = 0; i < 256; i++) oam[i] = 0xFF;
    direct = 1;
}
void hal_show_screen(const u8 *map, const u8 *attr, u8 which) {
    u16 i; (void)attr; (void)which;
    PPUMASK = 0; PPUCTRL = 0x20; direct = 1;
    waitvbl(); setpal(1); clear_nt();
    setaddr(0x2000); for (i = 0; i < 960; i++) PPUDATA = map[i];
    for (i = 0; i < 64; i++) PPUDATA = 0x55;
    for (i = 0; i < 256; i += 4) oam[i] = 0xFF;
    sx = 0; setaddr(0); PPUSCROLL = 0; PPUSCROLL = 0;
    waitvbl(); OAMDMA = 2; PPUMASK = 0x0A; PPUCTRL = 0x20; PPUSCROLL = 0; PPUSCROLL = 0;
}
void hal_text_begin(void) {
    u8 i; PPUMASK = 0; PPUCTRL = 0x20; direct = 1; waitvbl(); setpal(1); clear_nt();
    for (i = 0; i < 64; i++) oam[i * 4] = 0xFF; sx = 0;
}
void hal_put_tiles(u8 row, u8 col, const u8 *t, u8 n) { setaddr(0x2000 + (u16)row * 32 + col); while (n--) PPUDATA = *t++; }
void hal_text_end(u8 s) {
    u8 i; setaddr(0x23C0); for (i = 0; i < 64; i++) PPUDATA = 0x55;
    setaddr(0); PPUSCROLL = 0; PPUSCROLL = 0; waitvbl(); OAMDMA = 2; PPUMASK = s ? 0x1E : 0x0A; PPUCTRL = 0x20; PPUSCROLL = 0; PPUSCROLL = 0; direct = 0;
}
void hal_level_begin(void) { PPUMASK = 0; PPUCTRL = 0x20; waitvbl(); setpal(0); clear_nt(); direct = 1; }
void hal_level_end(void) { u8 i; for (i = 0; i < 4; i++) { setaddr(0x23C0 + i * 8); } waitvbl(); OAMDMA = 2; setaddr(0); PPUSCROLL = 0; PPUSCROLL = 0; PPUMASK = 0x1E; PPUCTRL = 0x20; direct = 0; }
void hal_col_begin(u16 hwcol) { qcol = hwcol & 63; qn = 0; }
void hal_col_put(u8 hwrow, u8 tile) { if (hwrow < 30) { qbuf[hwrow] = tile; if (hwrow >= qn) qn = hwrow + 1; } }
static void flush_col(void) {
    u8 r; u16 a = ((qcol & 32) ? 0x2400 : 0x2000) + (qcol & 31);
    PPUCTRL = 0x24; setaddr(a);
    for (r = 0; r < qn; r++) PPUDATA = qbuf[r];
    PPUCTRL = 0x20;
}
void hal_col_end(void) { if (direct) { flush_col(); return; } qpend = 1; }
void hal_scroll(u16 x, u16 y) { sx = x; (void)y; }
void hal_hud_begin(void) { oamn = 0; op = oam; }
void hal_hud_end(void) { while (oamn < HUD_CELLS) { *op = 0xFF; op += 4; oamn++; } }
void hal_spr_begin(void) { oamn = HUD_CELLS; op = oam + HUD_CELLS * 4; }
void hal_spr(i16 x, i16 y, u8 cell, u8 pal, u8 flip) {
    u8 *o; if (oamn >= 64) return;
    if (x <= -8 || x >= 256 || y <= -16 || y >= 240) return;
    o = op; o[0] = (u8)(y - 1); o[1] = (u8)((cell << 1) | 1); o[2] = (u8)((flip ? 0x40 : 0) | (pal & 3)); o[3] = (u8)x; op += 4; oamn++;
}
void hal_spr_end(void) { while (oamn < 64) { *op = 0xFF; op += 4; oamn++; } }
u8 hal_pad(void) {
    u8 i, v = 0, r = 0; JOY = 1; JOY = 0;
    for (i = 0; i < 8; i++) { v = (u8)((v << 1) | (JOY & 1)); }
    /* order read: A B Select Start Up Down Left Right -> v bit7 = A */
    if (v & 0x80) r |= P_A; if (v & 0x40) r |= P_B; if (v & 0x10) r |= P_START; if (v & 8) r |= P_U; if (v & 4) r |= P_D; if (v & 2) r |= P_L; if (v & 1) r |= P_R;
    return r;
}
void hal_frame(void) {
    waitvbl();
    OAMDMA = 2;
    if (qpend) { flush_col(); qpend = 0; }
    setaddr(0); PPUSCROLL = (u8)sx; PPUSCROLL = 0;
    PPUCTRL = 0x20 | ((sx >> 8) & 1);
}
void game_main(void);
void main(void) { game_main(); }
#ifndef NRD_SIZE
#define NRD_SIZE 20000
#endif
const u8 NRD[NRD_SIZE] = { 'N', 'R', 'M', 'N', 'D', 'A', 'T', 'A' };

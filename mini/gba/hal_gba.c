#include "../src/hal.h"
#define R16(a) (*(volatile unsigned short *)(a))
#define DISPCNT R16(0x04000000)
#define VCOUNT R16(0x04000006)
#define BG0CNT R16(0x04000008)
#define BG0HOFS R16(0x04000010)
#define BG0VOFS R16(0x04000012)
#define KEYIN R16(0x04000130)
#define MAPBASE 0x0600E000u
#define D8(o) (NRD[o])
#define D16(o) ((u16)(NRD[o] | (NRD[(o) + 1] << 8)))
#include "../src/notes_gb.h"
void hal_snd_init(void) { R16(0x04000084) = 0x80; R16(0x04000080) = 0xFF77; R16(0x04000082) = 2; R16(0x04000060) = 8; }
void hal_tone(u8 v, u8 note, u8 vol) {
    u16 f;
    if (!note) { if (v) R16(0x04000068) = 0; else R16(0x04000062) = 0; R16(v ? 0x0400006C : 0x04000064) = 0x8000; return; }
    f = NOTE_REG[note - 24];
    if (v) { R16(0x04000068) = (u16)((vol << 12) | 0x80); R16(0x0400006C) = (u16)(0x8000 | f); }
    else { R16(0x04000062) = (u16)((vol << 12) | 0x80); R16(0x04000064) = (u16)(0x8000 | f); }
}
static unsigned short soam[128 * 4]; static u8 oamn; static u16 sx, sy; static u16 qcol; static u8 qbuf[32]; static u8 qn, qpend, direct;
static u16 xhdr(void) { return D16(48); }
static void vwait(void) { while (VCOUNT >= 160) ; while (VCOUNT < 160) ; }
static void put_pal(unsigned short *dst, u16 off, u16 n) { u16 i; for (i = 0; i < n; i++) dst[i] = D16(off + i * 2); }
void hal_init(void) {
    u16 x = xhdr(), po = D16(x), bo = D16(x + 2), bn = D16(x + 4), so = D16(x + 6), sn = D16(x + 8), i; unsigned short *dst; u8 t;
    DISPCNT = 0x0080;                                  /* forced blank */
    dst = (unsigned short *)0x06000000; for (i = 0; i < bn * 16; i++) dst[i] = D16(bo + i * 2);
    dst = (unsigned short *)0x06010000; for (i = 0; i < sn * 16; i++) dst[i] = D16(so + i * 2);
    put_pal((unsigned short *)0x05000000, po, 16); put_pal((unsigned short *)0x05000020, po + 32, 16);
    for (t = 0; t < 10; t++) put_pal((unsigned short *)(0x05000200 + t * 32), po + 64 + t * 32, 16);
    BG0CNT = 0x5C00; BG0HOFS = 0; BG0VOFS = 0;
    for (i = 0; i < 128; i++) soam[i * 4] = 0x200;
    direct = 1;
}
static void clear_map(void) { unsigned short *m = (unsigned short *)MAPBASE; u16 i; for (i = 0; i < 2048; i++) m[i] = 0; }
void hal_show_screen(const u8 *map, const u8 *attr, u8 which) {
    unsigned short *m = (unsigned short *)MAPBASE; u8 r, c, i; (void)attr; (void)which;
    DISPCNT = 0x0080; direct = 1; clear_map();
    for (r = 0; r < 20; r++) for (c = 0; c < 30; c++) m[r * 32 + c] = map[r * 30 + c] | 0x1000;
    for (i = 0; i < 128; i++) soam[i * 4] = 0x200;
    { unsigned short *o = (unsigned short *)0x07000000; for (c = 0; c < 128; c++) { o[c * 4] = 0x200; } }
    BG0HOFS = 0; BG0VOFS = 0; sx = sy = 0;
    R16(0x05000000) = D16(D16(xhdr()) + 32);            /* title backdrop */
    DISPCNT = 0x0100;
}
void hal_text_begin(void) {
    u8 c; DISPCNT = 0x0080; direct = 1; clear_map();
    { unsigned short *o = (unsigned short *)0x07000000; for (c = 0; c < 128; c++) { o[c * 4] = 0x200; } }
    BG0HOFS = 0; BG0VOFS = 0; sx = sy = 0; R16(0x05000000) = D16(D16(xhdr()) + 32);
}
void hal_put_tiles(u8 row, u8 col, const u8 *t, u8 n) { unsigned short *m = (unsigned short *)MAPBASE + (u16)row * 32 + col; while (n--) *m++ = *t++ | 0x1000; }
void hal_text_end(u8 s) { DISPCNT = s ? 0x1140 : 0x0100; direct = 0; }
void hal_level_begin(void) { DISPCNT = 0x0080; direct = 1; clear_map(); R16(0x05000000) = D16(D16(xhdr())); }
void hal_level_end(void) { DISPCNT = 0x1140; direct = 0; }
void hal_col_begin(u16 hwcol) { qcol = hwcol & 63; qn = 0; }
void hal_col_put(u8 hwrow, u8 tile) { if (hwrow < 32) { qbuf[hwrow] = tile; if (hwrow >= qn) qn = hwrow + 1; } }
static void flush_col(void) {
    u8 r; unsigned short *m = (unsigned short *)(MAPBASE + ((qcol & 32) ? 0x800u : 0u)) + (qcol & 31);
    for (r = 0; r < qn; r++) m[r * 32] = qbuf[r];
}
void hal_col_end(void) { if (direct) flush_col(); else qpend = 1; }
void hal_scroll(u16 x, u16 y) { sx = x; sy = y; }
void hal_hud_begin(void) { oamn = 0; }
void hal_hud_end(void) { while (oamn < HUD_CELLS) { soam[oamn * 4] = 0x200; oamn++; } }
void hal_spr_begin(void) { oamn = HUD_CELLS; }
void hal_spr(i16 x, i16 y, u8 cell, u8 pal, u8 flip) {
    unsigned short *o; if (oamn >= 128) return;
    if (x <= -8 || x >= 240 || y <= -16 || y >= 160) return;
    o = &soam[oamn * 4]; o[0] = (unsigned short)((y & 255) | 0x8000); o[1] = (unsigned short)((x & 511) | (flip ? 0x1000 : 0)); o[2] = (unsigned short)((cell << 1) | ((u16)pal << 12)); oamn++;
}
void hal_spr_end(void) { while (oamn < 128) { soam[oamn * 4] = 0x200; oamn++; } }
u8 hal_pad(void) {
    u16 k = ~KEYIN; u8 r = 0;
    if (k & 1) r |= P_A; if (k & 2) r |= P_B; if (k & 8) r |= P_START; if (k & 16) r |= P_R; if (k & 32) r |= P_L; if (k & 64) r |= P_U; if (k & 128) r |= P_D;
    return r;
}
void hal_frame(void) {
    u16 i; unsigned short *o = (unsigned short *)0x07000000;
    vwait();
    for (i = 0; i < 512; i++) o[i] = soam[i];
    if (qpend) { flush_col(); qpend = 0; }
    BG0HOFS = sx & 511; BG0VOFS = sy & 255;
}
void game_main(void);
int main(void) { game_main(); return 0; }

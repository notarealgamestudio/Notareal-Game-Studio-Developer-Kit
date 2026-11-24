#include "../src/hal.h"
extern u8 _cpu;
void wait_vbl_done(void);
void game_main(void);
void main(void) { game_main(); }
#define REG(a) (*(volatile u8 *)(a))
#define LCDC REG(0xFF40)
#define LY REG(0xFF44)
#define SCY REG(0xFF42)
#define SCX REG(0xFF43)
#define BGP REG(0xFF47)
#define OBP0 REG(0xFF48)
#define OBP1 REG(0xFF49)
#define P1 REG(0xFF00)
#define VBK REG(0xFF4F)
#define BCPS REG(0xFF68)
#define BCPD REG(0xFF69)
#define OCPS REG(0xFF6A)
#define OCPD REG(0xFF6B)
#define D8(o) (NRD[o])
#define D16(o) ((u16)(NRD[o] | (NRD[(o) + 1] << 8)))
#include "../src/notes_gb.h"
#define NR(a) REG(a)
static u8 snd_vol[2];
void hal_snd_init(void) { NR(0xFF26) = 0x80; NR(0xFF25) = 0xFF; NR(0xFF24) = 0x77; NR(0xFF10) = 0; }
void hal_tone(u8 v, u8 note, u8 vol) {
    u16 f; u8 r = v ? 0x16 : 0x11;
    if (!note) { NR(v ? 0xFF17 : 0xFF12) = 0; NR(v ? 0xFF19 : 0xFF14) = 0x80; return; }
    f = NOTE_REG[note - 24]; NR(v ? 0xFF16 : 0xFF11) = 0x80; NR(v ? 0xFF17 : 0xFF12) = (u8)(vol << 4);
    NR(v ? 0xFF18 : 0xFF13) = (u8)f; NR(v ? 0xFF19 : 0xFF14) = (u8)(0x80 | (f >> 8)); (void)r;
}
static u8 cgb, direct, oamn, spr_on; static u8 *op; static u16 sx, sy;
extern u8 shadow_OAM[160];
#define oam shadow_OAM
static u8 qbuf[34]; static u8 qn, qcol; static u8 qpend;
static void vwait(void) { if (!(LCDC & 0x80)) return; while (LY != 144) ; }
static u16 xhdr(void) { return D16(48); }
static void setpal_cgb(u8 which) {            /* which: 0 game, 1 title; also loads sprite palettes */
    u16 p = D16(xhdr()); u8 i;
    BCPS = 0x80; for (i = 0; i < 16; i++) BCPD = D8(p + i);
    OCPS = 0x80; for (i = 0; i < 64; i++) OCPD = D8(p + 16 + i);
}
void hal_init(void) {
    u16 x = xhdr(), bo = D16(x + 2), bn = D16(x + 4), so = D16(x + 6), sn = D16(x + 8), i, j; u8 *dst;
    cgb = (_cpu == 0x11) && (*(const u8 *)0x0143 & 0x80);
    vwait(); LCDC = 0;
    for (i = 0; i < bn; i++) { dst = (u8 *)(i < 128 ? 0x9000 + i * 16 : 0x8800 + (i - 128) * 16); for (j = 0; j < 16; j++) dst[j] = D8(bo + i * 16 + j); }
    for (i = 0; i < sn; i++) { dst = (u8 *)(0x8000 + i * 16); for (j = 0; j < 16; j++) dst[j] = D8(so + i * 16 + j); }
    OBP0 = 0xE4; OBP1 = 0xE4; BGP = 0xE4;
    if (cgb) setpal_cgb(0);
    for (i = 0; i < 160; i++) oam[i] = 0;
    direct = 1;
}
static void clear_maps(void) {
    u16 i; u8 *m = (u8 *)0x9800;
    if (cgb) { VBK = 1; for (i = 0; i < 1024; i++) m[i] = 0; VBK = 0; }
    for (i = 0; i < 1024; i++) m[i] = 0;
}
void hal_show_screen(const u8 *map, const u8 *attr, u8 which) {
    u8 r, c; u8 *m = (u8 *)0x9800; u16 i; (void)attr;
    vwait(); LCDC = 0; direct = 1; spr_on = 0;
    clear_maps();
    for (r = 0; r < 18; r++) for (c = 0; c < 20; c++) m[r * 32 + c] = map[r * 20 + c];
    if (cgb) { VBK = 1; for (r = 0; r < 18; r++) for (c = 0; c < 20; c++) m[r * 32 + c] = 1; VBK = 0; }
    BGP = 0x1B; SCX = 0; SCY = 0; sx = sy = 0;
    for (i = 0; i < 160; i++) oam[i] = 0;
    LCDC = 0x91 & 0xFD; (void)which;
    LCDC = 0x91;     /* LCD on, BG on at 0x9800, tile data 0x8800 mode */
    LCDC = 0x81;
}
void hal_text_begin(void) {
    u8 r, c; u8 *m = (u8 *)0x9800; u16 i;
    vwait(); LCDC = 0; direct = 1; spr_on = 0; clear_maps();
    if (cgb) { VBK = 1; for (r = 0; r < 18; r++) for (c = 0; c < 20; c++) m[r * 32 + c] = 1; VBK = 0; }
    BGP = 0x1B; SCX = 0; SCY = 0; sx = sy = 0; for (i = 0; i < 160; i++) oam[i] = 0;
}
void hal_put_tiles(u8 row, u8 col, const u8 *t, u8 n) { u8 *m = (u8 *)0x9800 + (u16)row * 32 + col; while (n--) *m++ = *t++; }
void hal_text_end(u8 s) { if (s) { LCDC = 0x87; spr_on = 1; } else LCDC = 0x81; direct = 0; }
void hal_level_begin(void) { vwait(); LCDC = 0; direct = 1; clear_maps(); BGP = 0xE4; spr_on = 1; }
void hal_level_end(void) { LCDC = 0x87; direct = 0; }
void hal_col_begin(u16 hwcol) {
    if (direct) { qcol = (u8)(hwcol & 31); qn = 0; } else { qcol = (u8)(hwcol & 31); qn = 0; }
}
void hal_col_put(u8 hwrow, u8 tile) { qbuf[hwrow] = tile; if (hwrow >= qn) qn = hwrow + 1; }
static void flush_col(void) {
    u8 r; u8 *m = (u8 *)(0x9800 + qcol);
    for (r = 0; r < qn; r++) m[(u16)r * 32] = qbuf[r];
    if (cgb) { VBK = 1; for (r = 0; r < qn; r++) m[(u16)r * 32] = 0; VBK = 0; }
}
void hal_col_end(void) {
    if (direct) { flush_col(); return; }
    qpend = 1;
}
void hal_scroll(u16 x, u16 y) { sx = x; sy = y; }
void hal_hud_begin(void) { oamn = 0; op = oam; }
void hal_hud_end(void) { while (oamn < HUD_CELLS) { *op = 0; op += 4; oamn++; } }
void hal_spr_begin(void) { oamn = HUD_CELLS; op = oam + HUD_CELLS * 4; }
void hal_spr(i16 x, i16 y, u8 cell, u8 pal, u8 flip) {
    u8 *o; if (oamn >= 40) return;
    if (x <= -8 || x >= 160 || y <= -16 || y >= 144) return;
    o = op; o[0] = (u8)(y + 16); o[1] = (u8)(x + 8); o[2] = (u8)(cell << 1); o[3] = (u8)((flip ? 0x20 : 0) | (pal & 7)); op += 4; oamn++;
}
void hal_spr_end(void) { u8 *p = op; while (p < oam + 160) { *p = 0; p += 4; } }
u8 hal_pad(void) {
    u8 r = 0, v;
    P1 = 0x20; v = ~P1 & 15; v = ~P1 & 15; if (v & 1) r |= P_R; if (v & 2) r |= P_L; if (v & 4) r |= P_U; if (v & 8) r |= P_D;
    P1 = 0x10; v = ~P1 & 15; v = ~P1 & 15; if (v & 1) r |= P_A; if (v & 2) r |= P_B; if (v & 8) r |= P_START;
    P1 = 0x30; return r;
}
void hal_frame(void) {
    wait_vbl_done();
    if (qpend) { flush_col(); qpend = 0; }
    SCX = (u8)sx; SCY = (u8)sy;
}
const u8 __at(HAL_NRD_AT) NRD[16384] = { 'N', 'R', 'M', 'N', 'D', 'A', 'T', 'A' };

/* softppu.h - a tiny software "PPU" that gives the mini platformer engine (game.c) the same HAL as the GBA build, for consoles that
 * only have a framebuffer (PlayStation, N64). Data layout = the GBA export: 4bpp 8x8 tiles, BG ring map 64x32, 8x16 sprites.
 * Platform file must define: SP_COL(rgb555) -> final pixel, then include this, then call sp_present(fb) from hal_frame. */
#ifndef SOFTPPU_H
#define SOFTPPU_H
#include "hal.h"
#define SPW 240
#define SPH 160
#ifndef SP_DARK
#define SP_DARK(c) ((u16)(((c) >> 1) & 0x3DEF))
#endif
#define D8(o) (NRD[o])
#define D16(o) ((u16)(NRD[o] | (NRD[(o) + 1] << 8)))
static u16 sp_fb[SPW * SPH];
static u16 sp_pal[26][16];                 /* 0,1 = BG game/title, 2..11 = sprite palettes (game order) */
static u8 sp_bgt[256][64], sp_spt[512][64]; /* tiles expanded to one byte per pixel */
static u16 sp_ring[32][64];                /* BG ring: tile | pal<<12 */
static u16 sp_scr[20][30];                 /* full-screen map (title/win/over) */
#ifdef NR3D
static u8 g3_on, fp_on;
#endif
static u16 sp_backdrop, sp_sx, sp_sy; static u8 sp_mode, sp_sprs;   /* 0 level, 1 screen */
typedef struct { i16 x, y; u8 cell, pal, flip, on; } SpObj;
static SpObj sp_obj[128]; static u8 sp_n;
static u16 sp_x(void) { return D16(48); }
static void sp_decode(u8 *dst, u16 off) { u8 i; for (i = 0; i < 32; i++) { u8 b = D8(off + i); dst[i * 2] = b & 15; dst[i * 2 + 1] = b >> 4; } }
void hal_init(void) {
    u16 x = sp_x(), po = D16(x), bo = D16(x + 2), bn = D16(x + 4), so = D16(x + 6), sn = D16(x + 8), i, t, k;
    for (i = 0; i < bn && i < 256; i++) sp_decode(sp_bgt[i], bo + i * 32);
    for (i = 0; i < sn && i < 512; i++) sp_decode(sp_spt[i], so + i * 32);
    for (k = 0; k < 16; k++) { sp_pal[0][k] = SP_COL(D16(po + k * 2)); sp_pal[1][k] = SP_COL(D16(po + 32 + k * 2)); }
    for (t = 0; t < 10; t++) for (k = 0; k < 16; k++) sp_pal[2 + t][k] = SP_COL(D16(po + 64 + t * 32 + k * 2));
    sp_backdrop = sp_pal[0][0];
}
void hal_show_screen(const u8 *map, const u8 *attr, u8 which) {
    u8 r, c; (void)attr; (void)which;
    for (r = 0; r < 20; r++) for (c = 0; c < 30; c++) sp_scr[r][c] = map[r * 30 + c];
    sp_mode = 1; sp_sprs = 0; sp_sx = sp_sy = 0; sp_n = 0; sp_backdrop = sp_pal[1][0];
#ifdef NR3D
    g3_on = 0; fp_on = 0;
#endif
}
void hal_text_begin(void) {
    u8 r, c; for (r = 0; r < 20; r++) for (c = 0; c < 30; c++) sp_scr[r][c] = 0;
    for (r = 0; r < 128; r++) sp_obj[r].on = 0;
    sp_mode = 1; sp_sprs = 0; sp_sx = sp_sy = 0; sp_n = 0; sp_backdrop = sp_pal[1][0];
#ifdef NR3D
    g3_on = 0; fp_on = 0;
#endif
}
void hal_put_tiles(u8 row, u8 col, const u8 *t, u8 n) { while (n-- && col < 30) sp_scr[row][col++] = *t++; }
void hal_text_end(u8 s) { sp_sprs = s; }
void hal_level_begin(void) {
#ifdef NR3D
    g3_on = 0; fp_on = 0;
#endif
    { u8 r, c; for (r = 0; r < 32; r++) for (c = 0; c < 64; c++) sp_ring[r][c] = 0; sp_mode = 0; sp_sprs = 0; sp_backdrop = sp_pal[0][0]; } }
void hal_level_end(void) {}
static u16 sp_qcol;
void hal_col_begin(u16 hwcol) { sp_qcol = hwcol & 63; }
void hal_col_put(u8 hwrow, u8 tile) { if (hwrow < 32) sp_ring[hwrow][sp_qcol] = tile; }
void hal_col_end(void) {}
void hal_scroll(u16 x, u16 y) { sp_sx = x; sp_sy = y; }
static u8 sp_cur;
void hal_hud_begin(void) { sp_cur = 0; }
void hal_hud_end(void) { while (sp_cur < HUD_CELLS) sp_obj[sp_cur++].on = 0; }
void hal_spr_begin(void) { sp_cur = HUD_CELLS; }
void hal_spr(i16 x, i16 y, u8 cell, u8 pal, u8 flip) {
    SpObj *o; if (sp_cur >= 128) return;
    if (x <= -8 || x >= SPW || y <= -16 || y >= SPH) return;
    o = &sp_obj[sp_cur++]; o->x = x; o->y = y; o->cell = cell; o->pal = pal; o->flip = flip; o->on = 1;
}
void hal_spr_end(void) { while (sp_cur < 128) sp_obj[sp_cur++].on = 0; }
#ifdef NR3D
static const u8 *g3_map, *g3_meta; static u8 g3_w, g3_h; static i32 g3_x, g3_y; static u8 g3_a;
typedef struct { i16 x, y, w, z; u8 cell, pal, flip; } Sp3; static Sp3 sp3[24]; static u8 sp3n;
static const i8 g3_sn[64] = { 0, 8, 16, 24, 32, 39, 46, 53, 59, 65, 70, 74, 78, 82, 84, 86, 88, 86, 84, 82, 78, 74, 70, 65, 59, 53, 46, 39, 32, 24, 16, 8, 0, -8, -16, -24, -32, -39, -46, -53, -59, -65, -70, -74, -78, -82, -84, -86, -88, -86, -84, -82, -78, -74, -70, -65, -59, -53, -46, -39, -32, -24, -16, -8 };
void hal_ground3d(const u8 *map, const u8 *meta, u8 lw, u8 lh, i32 camx, i32 camy, u8 ang) { g3_map = map; g3_meta = meta; g3_w = lw; g3_h = lh; g3_x = camx; g3_y = camy; g3_a = ang & 63; g3_on = 1; sp3n = 0; }
void hal_ground_off(void) { g3_on = 0; fp_on = 0; }
void hal_spr3d(i16 x, i16 y, i16 w, i16 z, u8 cell0, u8 pal, u8 flip) { Sp3 *o; if (sp3n >= 24) return; o = &sp3[sp3n++]; o->x = x; o->y = y; o->w = w; o->z = z; o->cell = cell0; o->pal = pal; o->flip = flip; }
static const u8 *fp_map, *fp_meta, *fp_cols; static u8 fp_w, fp_h; static i32 fp_x, fp_y, fp_a; static i16 fp_z[120];
void hal_fp3d(const u8 *map, const u8 *meta, const u8 *cols, u8 lw, u8 lh, i32 x, i32 y, u8 ang) { fp_map = map; fp_meta = meta; fp_cols = cols; fp_w = lw; fp_h = lh; fp_x = x; fp_y = y; fp_a = ang & 63; fp_on = 1; g3_on = 0; sp3n = 0; }
void hal_fp_zbuf(u8 col, i16 *dist) { *dist = fp_z[col < 120 ? col : 119]; }
static void sp_fpcast(void) {
    int x, y, s = g3_sn[fp_a], c = g3_sn[(fp_a + 16) & 63], px = (int)(fp_x >> 8), py = (int)(fp_y >> 8);
    for (y = 0; y < SPH; y++) { u16 *row = &sp_fb[y * SPW]; u16 col = y < SPH / 2 ? sp_backdrop : sp_pal[0][1]; for (x = 0; x < SPW; x++) row[x] = col; }
    for (x = 0; x < 120; x++) {
        int cam = x - 60, rdx = c * 128 - s * ((cam * 3) >> 1), rdy = s * 128 + c * ((cam * 3) >> 1), d, sx = px, sy = py, hit = 0, side = 0, tx = 0, ty = 0, h, y0, y1, u = 0, cosf = 1000 - (cam * cam) / 20;
        int lx = px, ly = py;
        for (d = 4; d < 400; d += 4) {
            sx = px + (rdx * d) / 11264; sy = py + (rdy * d) / 11264;
            tx = sx >> 4; ty = sy >> 4;
            if (sx < 0 || sy < 0 || tx >= fp_w || ty >= fp_h) { hit = 1; break; }
            if (fp_cols[fp_map[ty * fp_w + tx]] == 1) { hit = 1; break; }
            lx = sx; ly = sy;
        }
        { int ox = lx >> 4, oy = ly >> 4; side = (ox != tx) ? 0 : 1; u = side ? (sx & 15) : (sy & 15); if (ox != tx && oy != ty) side = (sx & 15) < 8; }
        d = d * cosf / 1000; if (d < 6) d = 6; fp_z[x] = (i16)d;
        h = 3600 / d; if (h > SPH * 2) h = SPH * 2; y0 = SPH / 2 - h / 2; y1 = y0 + h;
        for (y = y0 < 0 ? 0 : y0; y < y1 && y < SPH; y++) {
            u16 col; int v = ((y - y0) * 16) / h, m = (tx >= 0 && ty >= 0 && tx < fp_w && ty < fp_h) ? fp_map[ty * fp_w + tx] : 0; u8 t = fp_meta[(m << 2) + ((v >> 3) << 1) + (u >> 3)], q = sp_bgt[t][(v & 7) * 8 + (u & 7)];
            col = q ? sp_pal[0][q] : sp_pal[0][1]; if (side) col = SP_DARK(col);
            sp_fb[y * SPW + x * 2] = col; sp_fb[y * SPW + x * 2 + 1] = col;
        }
    }
}
static void sp_ground(void) {
    int y, x, i, j; i32 fx = g3_sn[(g3_a + 16) & 63] ? 0 : 0;
    int s = g3_sn[g3_a], c = g3_sn[(g3_a + 16) & 63];                   /* sin, cos (88 = 1.0 -> /88) */
    for (y = 0; y < SPH; y++) {
        u16 *row = &sp_fb[y * SPW];
        if (y <= G3_HY) { for (x = 0; x < SPW; x++) row[x] = (y > G3_HY - 6) ? sp_pal[0][1] : sp_backdrop; continue; }
        {   int dy = y - G3_HY; i32 z = (i32)G3_H * G3_F * 256 / dy;                /* forward distance in 8.8 pixels */
            /* world point under screen column x:  cam + f*z + r*(x-120)*z/F ;  f = (s, -c), r = (c, s) */
            i32 cxw = g3_x + (s * z) / 88, cyw = g3_y - (c * z) / 88, stp = z / G3_F;
            i32 wx = cxw + (c * stp * -120) / 88, wy = cyw + (s * stp * -120) / 88, dwx = (c * stp) / 88, dwy = (s * stp) / 88;
            for (x = 0; x < SPW; x += 2) {
                int tx = (int)(wx >> 12), ty = (int)(wy >> 12);   /* 16 px metatile = 4096 in 8.8 */
                u16 col;
                if (tx < 0 || ty < 0 || tx >= g3_w || ty >= g3_h) col = sp_pal[0][1];
                else { int m = g3_map[ty * g3_w + tx], px = (int)(wx >> 8) & 15, py = (int)(wy >> 8) & 15; u8 t = g3_meta[(m << 2) + ((py >> 3) << 1) + (px >> 3)], v = sp_bgt[t][(py & 7) * 8 + (px & 7)]; col = v ? sp_pal[0][v] : sp_backdrop; }
                row[x] = col; if (x + 1 < SPW) row[x + 1] = col;
                wx += dwx * 2; wy += dwy * 2;
            }
        }
    }
    (void)fx; (void)i; (void)j;
}
static void sp_billboards(void) {
    int a, b, i, k; 
    for (a = 1; a < sp3n; a++) { Sp3 t = sp3[a]; b = a - 1; while (b >= 0 && sp3[b].z < t.z) { sp3[b + 1] = sp3[b]; b--; } sp3[b + 1] = t; }   /* far to near */
    for (k = 0; k < sp3n; k++) {
        Sp3 *o = &sp3[k]; const u16 *pal = sp_pal[2 + (o->pal < 10 ? o->pal : 0)]; int w = o->w, dx, dy, x0 = o->x - w / 2, y0 = o->y - w;
        if (w < 2) continue; if (w > 120) w = 120;
        for (dy = 0; dy < w; dy++) {
            int yy = y0 + dy, v = dy * 16 / w; if ((unsigned)yy >= SPH) continue;
            for (dx = 0; dx < w; dx++) {
                int xx = x0 + dx, u = dx * 16 / w, uu = o->flip ? 15 - u : u; const u8 *t; if ((unsigned)xx >= SPW) continue;
                t = &sp_spt[(o->cell + (uu >> 3)) * 2 + (v >> 3)][(v & 7) * 8 + (uu & 7)]; i = *t;
                if (i) sp_fb[yy * SPW + xx] = pal[i];
            }
        }
    }
}
#endif
static void sp_render(void) {
    int y, seg, i, k; u16 *row;
#ifdef NR3D
    if (fp_on && !sp_mode) { sp_fpcast(); sp_billboards(); goto sprites; }
    if (g3_on && !sp_mode) { sp_ground(); sp_billboards(); goto sprites; }
#endif
    for (y = 0; y < SPH; y++) {
        row = &sp_fb[y * SPW];
        if (sp_mode) {
            const u16 *m = sp_scr[y >> 3]; int py = y & 7;
            for (seg = 0; seg < 30; seg++) {
                const u8 *t = &sp_bgt[m[seg] & 255][py * 8]; u16 *d = row + seg * 8;
                for (i = 0; i < 8; i++) d[i] = t[i] ? sp_pal[1][t[i]] : sp_backdrop;
            }
        } else {
            int by = (sp_sy + y) & 255, py = by & 7, off = sp_sx & 7, col0 = (sp_sx >> 3) & 63;
            const u16 *m = sp_ring[by >> 3];
            for (seg = 0; seg < 31; seg++) {
                u16 e = m[(col0 + seg) & 63]; const u8 *t = &sp_bgt[e & 255][py * 8]; int dx = seg * 8 - off;
                for (i = 0; i < 8; i++) { int x = dx + i; if ((unsigned)x < SPW) row[x] = t[i] ? sp_pal[0][t[i]] : sp_backdrop; }
            }
        }
    }
    if (sp_mode && !sp_sprs) return;
#ifdef NR3D
sprites:
#endif
    for (k = 127; k >= 0; k--) {
        SpObj *o = &sp_obj[k]; int r;
        if (!o->on) continue;
        for (r = 0; r < 16; r++) {
            int yy = o->y + r; const u8 *t; const u16 *pal = sp_pal[2 + (o->pal < 10 ? o->pal : 0)];
            if ((unsigned)yy >= SPH) continue;
            t = &sp_spt[o->cell * 2 + (r >> 3)][(r & 7) * 8];
            for (i = 0; i < 8; i++) { int x = o->x + i, s = o->flip ? 7 - i : i; if ((unsigned)x < SPW && t[s]) sp_fb[yy * SPW + x] = pal[t[s]]; }
        }
    }
}
#endif

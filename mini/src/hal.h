/* NOTAREAL mini engine: portable platformer for GB / GBC / NES / GBA. One game.c, one small HAL per console. */
#ifndef HAL_H
#define HAL_H
typedef unsigned char u8; typedef signed char i8; typedef unsigned short u16; typedef signed short i16; typedef signed long i32;
#define P_R 1
#define P_L 2
#define P_D 4
#define P_U 8
#define P_A 16
#define P_B 32
#define P_START 64
/* provided by the console HAL */
void hal_init(void);
void hal_frame(void);                     /* end of frame: wait vblank, flush queued VRAM/OAM writes */
u8   hal_pad(void);
void hal_show_screen(const u8 *map, const u8 *attr, u8 which); /* full-screen map (title/win/over) */
void hal_level_begin(void);               /* screen off, game palette, clear map */
void hal_level_end(void);                 /* screen on */
void hal_col_begin(u16 hwcol);            /* write one hardware column of the level ring */
void hal_col_put(u8 hwrow, u8 tile);
void hal_col_end(void);
void hal_scroll(u16 x, u16 y);

/* text screens (RPG mode): a blank screen you write tile rows onto, shown with or without sprites */
void hal_text_begin(void);
void hal_put_tiles(u8 row, u8 col, const u8 *tiles, u8 n);
void hal_text_end(u8 sprites);void hal_snd_init(void);                  /* sound hardware on */
void hal_tone(u8 voice, u8 note, u8 vol); /* voice 0/1 = two pulse channels; note = MIDI 24..96, 0 = silence; vol 0..15 */
#define HUD_CELLS 12
void hal_hud_begin(void);                /* sprite slots 0..HUD_CELLS-1: static HUD, rewritten only when it changes */
void hal_hud_end(void);
void hal_spr_begin(void);                /* dynamic sprites start at HUD_CELLS */
void hal_spr(i16 x, i16 y, u8 cell, u8 pal, u8 flip);   /* one hardware sprite cell */
void hal_spr_end(void);
#ifdef HAL_NRD_AT
extern const u8 __at(HAL_NRD_AT) NRD[];
#else
extern const u8 NRD[];                    /* data blob (patched by the studio) */
#endif
#ifdef NR3D
/* perspective ground plane ("mode 7") and scaled billboards: implemented by the software-PPU consoles (PlayStation, Nintendo 64) */
void hal_ground3d(const u8 *map, const u8 *meta, u8 lw, u8 lh, i32 camx, i32 camy, u8 ang);   /* cam in 8.8 pixels, ang 0..63 */
void hal_spr3d(i16 x, i16 y, i16 w, i16 z, u8 cell0, u8 pal, u8 flip);                      /* 16x16 two-cell sprite, scaled to w pixels */
void hal_ground_off(void);
/* first-person raycaster (mode 4): walls are map tiles whose collision class is 1; pos in 8.8 pixels, ang 0..63 */
void hal_fp3d(const u8 *map, const u8 *meta, const u8 *cols, u8 lw, u8 lh, i32 x, i32 y, u8 ang);
void hal_fp_zbuf(u8 col, i16 *dist);
#define G3_HY 44      /* horizon row */
#define G3_F 150      /* focal length */
#define G3_H 26       /* camera height */
#endif
#define SCR_W_PX HAL_SCR_W
#endif

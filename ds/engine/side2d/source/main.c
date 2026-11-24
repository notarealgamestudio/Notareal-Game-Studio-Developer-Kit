// NOTAREAL Game Studio - DS "2D Sidescroller" preset engine.
// Everything game-specific (levels, art, palettes, enemies, music, sound clips, rules) comes from the
// NRG1 data block written by the dev kit editor. Built once; never recompiled per game.
#include <nds.h>
#include <stdio.h>
#include <string.h>
#include "nrg.h"
#include "splash_bin.h"
#include "font_bin.h"

extern const unsigned char nr_gamedata[];
void snd_sample_ch(int ch, const void *data, u32 bytes, int fmt, int hz, int vol, int pan, int loop);
void snd_psg_ch(int ch, int duty, int hz, int vol, int pan);
void snd_sample_loop(int ch, const void *data, u32 bytes, int hz, int vol, int pan, int loop_bytes);
void snd_noise_ch(int ch, int hz, int vol, int pan);
void snd_stop(int ch);
void snd_master(int vol);
void snd_input(void);

/* ------------------------------------------------------------ data access */
static const NrgHeader *H;
static const NrgMeta *META;
static const u8 *sec(const char *id, u32 *size) {
    for (u32 i = 0; i < H->count; i++)
        if (!memcmp(H->sec[i].id, id, 4)) { if (size) *size = H->sec[i].size; return (const u8 *)H + H->sec[i].off; }
    if (size) *size = 0;
    return 0;
}
static inline u16 rd16(const u8 *p) { return p[0] | p[1] << 8; }
static inline u32 rd32(const u8 *p) { return p[0] | p[1] << 8 | p[2] << 16 | (u32)p[3] << 24; }

/* ------------------------------------------------------------ input */
static u32 kd, kh;
static void tp_input(u32 *down, u32 *held);
static int has_tpad;
static int tp_setup(void);
static void input(void) { snd_input(); scanKeys(); kd = keysDown(); kh = keysHeld(); tp_input(&kd, &kh); }
#ifdef NR_AUTOTEST
static int bot_jump_t;
static void bot_input(void);   /* defined after the game state: runs right, jumps walls, gaps and enemies */
#endif
static void wait_frame(void) { swiWaitForVBlank(); }

/* ------------------------------------------------------------ sound */
static const u8 *sfx_ptr[SFX_COUNT]; static u32 sfx_len[SFX_COUNT]; static u16 sfx_rate[SFX_COUNT];
static int sfx_rr, psg_kill_at[16], frame;
static const u16 NOTE_HZ[12] = {262, 277, 294, 311, 330, 349, 370, 392, 415, 440, 466, 494};   // octave 4 (MIDI 60-71)
static int midi_hz(int n) { int o = n / 12 - 5, hz = NOTE_HZ[n % 12]; while (o > 0) { hz <<= 1; o--; } while (o < 0) { hz >>= 1; o++; } return hz; }
static void beep(int ch, int duty, int hz, int vol, int frames) { snd_psg_ch(ch, duty, hz, vol, 64); psg_kill_at[ch] = frame + frames; }
static void sfx(int id) {
    if (id < SFX_COUNT && sfx_ptr[id]) { snd_sample_ch(15, sfx_ptr[id], sfx_len[id], 0, sfx_rate[id], 110, 64, 0); return; }
    switch (id) {   // fallbacks when the game has no clip for this sound
    case SFX_JUMP: beep(12, 2, 660, 70, 6); break;
    case SFX_COIN: beep(13, 1, 1568, 60, 8); break;
    case SFX_STOMP: snd_noise_ch(15, 3000, 90, 64); psg_kill_at[15] = frame + 5; break;
    case SFX_HURT: beep(12, 4, 180, 90, 20); break;
    case SFX_GOAL: beep(13, 2, 1046, 80, 30); break;
    case SFX_SPRING: beep(12, 3, 440, 80, 10); break;
    case SFX_1UP: beep(13, 1, 1318, 80, 20); break;
    }
}
/* music. v1 songs: 3 PSG voices (ch 8-10) + noise drums (ch 14).
 * v2 songs (dev kit instruments): up to 8 tracks; a track is a chip voice (inst 0-3) or a sampled instrument
 * from the INST section (inst 16+k). Sampled track t plays on hardware channel t; chip tracks on 8+t. */
typedef struct { u32 rate, len, loop; const u8 *data; } NrSample;
typedef struct { u8 type, base, n; NrSample s[12]; } NrInst;
#define MAX_INST 24
static NrInst inst[MAX_INST]; static int ninst;
static const u8 *song; static int song_steps, song_tq, song_nch, song_step, song_acc, song_v2, music_vol = 48;
static u8 tr_inst[8], tr_vol[8], tr_pan[8], tr_hw[8];
static const u32 SEMI[12] = {65536, 69433, 73562, 77936, 82570, 87480, 92682, 98193, 104032, 110218, 116772, 123715};
static int pitch_hz(u32 rate, int n, int base) { int d = n - base, o = d >= 0 ? d / 12 : -((-d + 11) / 12), k = d - o * 12; u32 hz = (u32)(((u64)rate * SEMI[k]) >> 16); return o >= 0 ? (int)(hz << o) : (int)(hz >> -o); }
static void load_inst(void) {
    u32 sz; const u8 *s = sec("INST", &sz); ninst = 0; if (!s) return;
    int n = rd16(s); if (n > MAX_INST) n = MAX_INST;
    for (int i = 0; i < n; i++) {
        const u8 *e = s + rd32(s + 4 + i * 4); NrInst *I = &inst[i];
        I->type = e[0]; I->base = e[1]; I->n = e[2] > 12 ? 12 : e[2];
        for (int k = 0; k < I->n; k++) { const u8 *q = e + 4 + k * 16; I->s[k].rate = rd32(q); I->s[k].len = rd32(q + 4); I->s[k].loop = rd32(q + 8); I->s[k].data = s + rd32(q + 12); }
    }
    ninst = n;
}
static void stop_tracks(void) { for (int c = 0; c < 16; c++) if (c != 15 && c != 12 && c != 13) snd_stop(c); }
static void play_song(int idx) {
    stop_tracks();
    song = 0;
    u32 sz; const u8 *s = sec("SONG", &sz);
    if (!s || idx >= s[0]) return;
    song_v2 = s[1] == 2;
    const u8 *p = s + 4;
    if (!song_v2) {
        for (int i = 0; i < idx; i++) { int st = rd16(p), nc = p[3]; p += 4 + st * nc; }
        song_steps = rd16(p); song_tq = (p[2] ? p[2] : 8) * 16; song_nch = p[3]; song = p + 4;
    } else {
        for (int i = 0; i < idx; i++) { int st = rd16(p), nc = p[4]; p += 8 + nc * 4 + ((st * nc + 3) & ~3); }
        song_steps = rd16(p); song_tq = rd16(p + 2); song_nch = p[4] > 8 ? 8 : p[4];
        for (int c = 0; c < song_nch; c++) { const u8 *t = p + 8 + c * 4; tr_inst[c] = t[0]; tr_vol[c] = t[1]; tr_pan[c] = t[2]; tr_hw[c] = t[0] < 16 ? 8 + (c % 4) : c; if (t[0] == 3) tr_hw[c] = 14; }
        song = p + 8 + p[4] * 4;
    }
    if (song_tq < 16) song_tq = 16;
    song_step = 0; song_acc = 0;
}
static void note_v1(int c, int n) {
    static const u8 duty[3] = {2, 4, 1};
    if (c < 3) { if (n == 0) snd_stop(8 + c); else if (n < 128) snd_psg_ch(8 + c, duty[c], midi_hz(n), c == 1 ? music_vol : music_vol * 3 / 4, 64); }
    else if (n) { static const u16 DR[4] = {0, 120, 2000, 9000}; static const u8 DL[4] = {0, 6, 5, 2}; snd_noise_ch(14, DR[n & 3], 70, 64); psg_kill_at[14] = frame + DL[n & 3]; }
}
static void note_v2(int c, int n) {
    int in = tr_inst[c], hw = tr_hw[c], vol = tr_vol[c] * music_vol / 48; if (vol > 127) vol = 127;
    if (n == 128) return;
    if (in < 3) { static const u8 duty[3] = {4, 2, 1}; if (n == 0) snd_stop(hw); else snd_psg_ch(hw, duty[in], midi_hz(n), vol * 3 / 4, tr_pan[c]); return; }
    if (in == 3) { if (n) { static const u16 DR[4] = {0, 120, 2000, 9000}; static const u8 DL[4] = {0, 6, 5, 2}; snd_noise_ch(14, DR[n & 3], vol * 3 / 5, tr_pan[c]); psg_kill_at[14] = frame + DL[n & 3]; } return; }
    int k = in - 16; if (k >= ninst) return;
    NrInst *I = &inst[k];
    if (I->type == 2) {                        /* drum kit: note picks the sound; a rest lets the hit ring out */
        if (!n || n > I->n) return;
        NrSample *S = &I->s[n - 1]; snd_sample_loop(hw, S->data, S->len, S->rate, vol, tr_pan[c], -1); return;
    }
    if (n == 0) { snd_stop(hw); return; }
    NrSample *S = &I->s[0];
    snd_sample_loop(hw, S->data, S->len, pitch_hz(S->rate, n, I->base), vol, tr_pan[c], S->loop == 0xFFFFFFFFu ? -1 : (int)S->loop);
}
static void music_tick(void) {
    for (int c = 8; c < 16; c++) if (psg_kill_at[c] && frame >= psg_kill_at[c]) { snd_stop(c); psg_kill_at[c] = 0; }
    if (!song || !song_steps) return;
    song_acc -= 16; if (song_acc > 0) return;
    song_acc += song_tq;
    for (int c = 0; c < song_nch && c < 8; c++) {
        int n = song[c * song_steps + song_step];
        if (song_v2) note_v2(c, n); else if (c < 4) note_v1(c, n);
    }
    if (++song_step >= song_steps) song_step = 0;
}

/* ------------------------------------------------------------ graphics */
static int bg0, bg1;
static u16 *map0, *map1;
#define OBJ_FONT_OFF 0                      /* 96 glyphs, 128-byte stride */
#define MAXSH 32
static u32 sheet_off[MAXSH]; static u8 sheet_w[MAXSH], sheet_h[MAXSH], sheet_frames[MAXSH];
static int oam_n;
static SpriteSize ssize(int w, int h) {
    if (w == 8 && h == 8) return SpriteSize_8x8; if (w == 16 && h == 16) return SpriteSize_16x16; if (w == 32 && h == 32) return SpriteSize_32x32;
    if (w == 16 && h == 32) return SpriteSize_16x32; if (w == 32 && h == 16) return SpriteSize_32x16; if (w == 64 && h == 64) return SpriteSize_64x64;
    if (w == 32 && h == 64) return SpriteSize_32x64; return SpriteSize_16x16;
}
static void spr(int sheet, int frame_i, int x, int y, int hflip) {
    if (oam_n >= 120 || !sheet_frames[sheet]) return;
    if (x < -64 || x > 256 || y < -64 || y > 192) return;
    int fsz = (sheet_w[sheet] * sheet_h[sheet] + 127) & ~127;
    u16 *g = (u16 *)((u8 *)SPRITE_GFX + sheet_off[sheet] + (frame_i % sheet_frames[sheet]) * fsz);
    oamSet(&oamMain, oam_n++, x & 511, y & 255, 1, 0, ssize(sheet_w[sheet], sheet_h[sheet]), SpriteColorFormat_256Color, g, -1, false, false, hflip, false, false);
}
static void text(int x, int y, const char *s) {
    for (; *s; s++, x += 8) {
        int c = *s; if (c >= 'a' && c <= 'z') c -= 32;
        if (c <= 32 || c > 127 || oam_n >= 127) continue;
        u16 *g = (u16 *)((u8 *)SPRITE_GFX + OBJ_FONT_OFF + (c - 32) * 128);
        oamSet(&oamMain, oam_n++, x & 511, y & 255, 0, 0, SpriteSize_8x8, SpriteColorFormat_256Color, g, -1, false, false, false, false, false);
    }
}
static void ctext(int y, const char *s) { text((256 - (int)strlen(s) * 8) / 2, y, s); }
static void frame_begin(void) { oam_n = 0; }
static void frame_end(void) {
    for (int i = oam_n; i < 128; i++) oamSet(&oamMain, i, 0, 192, 0, 0, SpriteSize_8x8, SpriteColorFormat_256Color, 0, -1, false, true, false, false, false);
    wait_frame(); oamUpdate(&oamMain); bgUpdate(); frame++; music_tick();
}

static void splash(void) {
    videoSetMode(MODE_5_2D);
    vramSetBankA(VRAM_A_MAIN_BG);
    int b = bgInit(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0);
    dmaCopy(splash_bin, bgGetGfxPtr(b), 256 * 192 * 2);
    for (int i = 0; i < 150; i++) { swiWaitForVBlank(); input(); if (i > 40 && (kd & (KEY_START | KEY_A))) break; }
    dmaFillHalfWords(0, bgGetGfxPtr(b), 256 * 192 * 2);
}
/* the game's own opening screen (OPEN section), shown right after the NOTAREAL logo:
   u16 frames, u16 flags (bit0 = has a bottom-screen picture), then 256x192 RGB15 top [+ bottom] */
static void opening(void) {
    u32 sz; const u8 *p = sec("OPEN", &sz);
    if (!p || sz < 4 + 256 * 192 * 2) return;
    int frames = rd16(p), flags = rd16(p + 2); if (frames < 30) frames = 180;
    videoSetMode(MODE_5_2D); vramSetBankA(VRAM_A_MAIN_BG);
    int b = bgInit(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0);
    setBrightness(1, -16);
    dmaCopy(p + 4, bgGetGfxPtr(b), 256 * 192 * 2);
    int sb = -1;
    if ((flags & 1) && sz >= 4 + 256 * 192 * 4) { videoSetModeSub(MODE_5_2D); vramSetBankC(VRAM_C_SUB_BG); sb = bgInitSub(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0); setBrightness(2, -16); dmaCopy(p + 4 + 256 * 192 * 2, bgGetGfxPtr(sb), 256 * 192 * 2); }
    for (int i = 0; i < frames; i++) {
        int f = i < 16 ? i - 16 : (i > frames - 16 ? -(i - (frames - 16)) : 0);
        setBrightness(sb >= 0 ? 3 : 1, f);
        swiWaitForVBlank(); input(); if (i > 30 && (kd & (KEY_START | KEY_A | KEY_TOUCH))) { frames = i + 16 < frames ? i + 16 : frames; }
    }
    setBrightness(3, 0);
    dmaFillHalfWords(0, bgGetGfxPtr(b), 256 * 192 * 2);
    if (sb >= 0) dmaFillHalfWords(0, bgGetGfxPtr(sb), 256 * 192 * 2);
}
static void setup_video(void) {
    videoSetMode(MODE_0_2D);
    vramSetBankA(VRAM_A_MAIN_BG);
    vramSetBankB(VRAM_B_MAIN_SPRITE);
    /* map bases must sit in the first 64 KB (5-bit field): level tiles 0-48 KB (192 metatiles), maps at 48/52 KB,
       background tiles at 64-112 KB */
    bg0 = bgInit(0, BgType_Text8bpp, BgSize_T_512x256, 24, 0);
    bg1 = bgInit(1, BgType_Text8bpp, BgSize_T_512x256, 26, 4);
    bgSetPriority(bg0, 1); bgSetPriority(bg1, 3);
    map0 = bgGetMapPtr(bg0); map1 = bgGetMapPtr(bg1);
    oamInit(&oamMain, SpriteMapping_1D_128, false);
    /* sub screen: text HUD */
    if (!(has_tpad = tp_setup())) {
        videoSetModeSub(MODE_0_2D);
        vramSetBankC(VRAM_C_SUB_BG);
        consoleInit(NULL, 0, BgType_Text4bpp, BgSize_T_256x256, 31, 0, false, true);
    }
    /* palettes and graphics from the game data */
    u32 sz; const u8 *p;
    if ((p = sec("BPAL", &sz))) dmaCopy(p, BG_PALETTE, 512); else BG_PALETTE[0] = RGB15(META->bg_r >> 3, META->bg_g >> 3, META->bg_b >> 3);
    if ((p = sec("SPAL", &sz))) dmaCopy(p, SPRITE_PALETTE, 512);
    SPRITE_PALETTE[255] = RGB15(31, 31, 31); SPRITE_PALETTE[254] = RGB15(2, 2, 6);
    if ((p = sec("MTIL", &sz))) { int n = rd16(p); if (n > 192) n = 192; dmaCopy(p + 4, bgGetGfxPtr(bg0), n * 256); }
    if ((p = sec("BGIM", &sz))) {
        dmaCopy(p, bgGetGfxPtr(bg1), 768 * 64);
        for (int ty = 0; ty < 32; ty++) for (int tx = 0; tx < 64; tx++) {
            int sy = ty < 24 ? ty : 23, sx = tx & 31;
            map1[(tx >= 32 ? 1024 : 0) + ty * 32 + (tx & 31)] = sy * 32 + sx;
        }
        REG_DISPCNT |= DISPLAY_BG1_ACTIVE;
    } else REG_DISPCNT &= ~DISPLAY_BG1_ACTIVE;
    /* font + sprite sheets into OBJ VRAM (1D, 128-byte aligned) */
    for (int c = 0; c < 96; c++) dmaCopy(font_bin + c * 64, (u8 *)SPRITE_GFX + OBJ_FONT_OFF + c * 128, 64);
    u32 off = 96 * 128;
    if ((p = sec("SPRS", &sz))) {
        int n = p[0]; const u8 *q = p + 4;
        for (int i = 0; i < n && i < MAXSH; i++) {
            int w = q[0], h = q[1], fr = q[2], fsz = (w * h + 127) & ~127;
            sheet_w[i] = w; sheet_h[i] = h; sheet_frames[i] = fr; sheet_off[i] = off;
            for (int f = 0; f < fr; f++) if (off + fsz <= 128 * 1024) { dmaCopy(q + 4 + f * w * h, (u8 *)SPRITE_GFX + off, w * h); off += fsz; }
            q += 4 + fr * w * h;
        }
    }
    load_inst();
    if ((p = sec("SFXC", &sz))) {
        int n = p[0]; const u8 *q = p + 4;
        for (int i = 0; i < n; i++) {
            u32 len = rd32(q + 4);
            if (i < SFX_COUNT && len) { sfx_rate[i] = rd16(q); sfx_len[i] = len & ~3u; sfx_ptr[i] = q + 8; }
            q += 8 + ((len + 3) & ~3u);
        }
    }
}

/* ------------------------------------------------------------ level */
typedef struct { const char *name; int w, h, song; const u8 *map; int nobj; const u8 *obj; } Level;
static Level LV;
static const u8 *mcol; static int nmtil;
static int load_level(int idx) {
    u32 sz; const u8 *p = sec("LVLS", &sz);
    if (!p || idx >= p[0]) return 0;
    const u8 *q = p + 4;
    for (int i = 0; ; i++) {
        int w = rd16(q + 24), h = q[26], no = rd16(q + 32);
        if (i == idx) { LV.name = (const char *)q; LV.w = w; LV.h = h; LV.song = q[27]; LV.map = q + 36; LV.nobj = no; LV.obj = q + 36 + ((w * h + 3) & ~3); return 1; }
        q += 36 + ((w * h + 3) & ~3) + no * 4;
    }
}
static inline int mt_at(int mx, int my) { if (mx < 0 || mx >= LV.w) return -1; if (my < 0 || my >= LV.h) return 0; return LV.map[mx * LV.h + my]; }
static inline int col_at_px(int x, int y) {
    int m = mt_at(x >> 4, y >> 4);
    if (m < 0) return COL_SOLID;
    return m < nmtil ? mcol[m] : COL_EMPTY;
}
static int slot_mx[32];
static void draw_col(int mx) {
    int slot = mx & 31;
    if (slot_mx[slot] == mx) return;
    slot_mx[slot] = mx;
    int tx = slot * 2;
    for (int my = 0; my < 16; my++) {
        int m = (mx >= 0 && mx < LV.w && my < LV.h) ? LV.map[mx * LV.h + my] : 0;
        int t = m * 4, ty = my * 2;
        for (int k = 0; k < 4; k++) {
            int x = tx + (k & 1), y = ty + (k >> 1);
            map0[(x >= 32 ? 1024 : 0) + y * 32 + (x & 31)] = m ? t + k : 0;
        }
    }
}

/* ------------------------------------------------------------ actors */
typedef struct { u8 type, alive, dir, state; s32 x, y, vx, vy; s32 x0, y0; int t; } Actor;
#define MAXA 160
static Actor A[MAXA]; static int na;
static s32 px, py, pvx, pvy; static int pdir = 1, on_ground, coyote, jbuf, pw, ph, hw, hh, panim, dead_t, clear_t;
static int lives, score, coins, level_i, cp_x, cp_y, cam_x, cam_y;
#define FX 256

static void spawn_actors(void) {
    na = 0;
    cp_x = 32; cp_y = 160;
    for (int i = 0; i < LV.nobj && na < MAXA; i++) {
        const u8 *o = LV.obj + i * 4; int type = o[0], oy = o[1], ox = rd16(o + 2);
        if (type == OB_START) { cp_x = ox * 16; cp_y = oy * 16; continue; }
        /* kit rule BURIED_OBJECT: a thing placed inside a solid/hazard tile is lifted to the first free tile above */
        while (oy > 0 && ox < LV.w && oy < LV.h && (mcol[LV.map[ox * LV.h + oy] < nmtil ? LV.map[ox * LV.h + oy] : 0] == COL_SOLID || mcol[LV.map[ox * LV.h + oy] < nmtil ? LV.map[ox * LV.h + oy] : 0] == COL_HAZARD)) oy--;
        Actor *a = &A[na++]; memset(a, 0, sizeof(*a));
        a->type = type; a->alive = 1; a->x = a->x0 = ox * 16 * FX; a->y = a->y0 = oy * 16 * FX; a->dir = 0;
        if (type == OB_WALKER) a->vx = -FX / 2;
        if (type == OB_FLYER) a->vx = -FX * 6 / 10;
    }
}
static void respawn(void) {
    px = (cp_x + (16 - hw) / 2) * FX; py = (cp_y + 16 - hh) * FX; pvx = pvy = 0; dead_t = 0; on_ground = 0;
    for (int i = 0; i < 32; i++) slot_mx[i] = -9999;
}
/* ------------------------------------------------------------ bottom screen: touch layout (TPAD) or text HUD
 * TPAD = 256x192 8bpp picture made by the dev kit (colours 0-125; 128-253 = the same colours brightened for a
 * pressed button; 254/255 = text outline/fill) + touch buttons (rect -> action) + live widgets (score, map...). */
enum { TA_NONE, TA_LEFT, TA_RIGHT, TA_UP, TA_DOWN, TA_JUMP, TA_RUN, TA_PAUSE, TA_MUSIC, TA_RESTART, TA_MAP, TA_ACTION, TA_RUNTOGGLE, TA_SELECT };
enum { TW_SCORE, TW_COINS, TW_LIVES, TW_LEVEL, TW_TITLE, TW_HEARTS, TW_MINIMAP, TW_TIMER, TW_LEVELNAME };
static const u8 *tp_img; static int tp_nb, tp_nw; static const u8 *tp_btn, *tp_wid;
static u16 *tp_vram; static int tp_pressed = -1, tp_runtoggle, tp_mapbig, tp_muted;
static void tp_blit_rect(int x, int y, int w, int h, int hi) {   /* restore a rect from the picture (hi = pressed colours) */
    if (x < 0) { w += x; x = 0; } if (y < 0) { h += y; y = 0; } if (x + w > 256) w = 256 - x; if (y + h > 192) h = 192 - y;
    x &= ~1; w = (w + 1) & ~1;
    for (int j = 0; j < h; j++) { const u8 *s = tp_img + (y + j) * 256 + x; u16 *d = tp_vram + ((y + j) * 256 + x) / 2;
        for (int i = 0; i < w; i += 2) { u8 a = s[i], b = s[i + 1]; if (hi) { if (a && a < 126) a += 128; if (b && b < 126) b += 128; } d[i / 2] = a | b << 8; } }
}
static void tp_px(int x, int y, u8 c) { if ((unsigned)x >= 256 || (unsigned)y >= 192) return; u16 *d = tp_vram + (y * 256 + x) / 2; if (x & 1) *d = (*d & 0xFF) | c << 8; else *d = (*d & 0xFF00) | c; }
static int tp_text(int x, int y, const char *s, int sc) {
    for (; *s; s++, x += 6 * sc) {
        int ch = *s; if (ch >= 'a' && ch <= 'z') ch -= 32; if (ch < 32 || ch > 127) ch = '?';
        const u8 *g = font_bin + (ch - 32) * 64;
        for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) { u8 v = g[j * 8 + i]; if (!v) continue;
            for (int b = 0; b < sc; b++) for (int a = 0; a < sc; a++) tp_px(x + i * sc + a, y + j * sc + b, v == 255 ? 255 : 254); }
    }
    return x;
}
static void tp_minimap(int x, int y, int w, int h) {
    if (!LV.map || !LV.w) return;
    tp_blit_rect(x, y, w, h, 0);
    for (int j = 0; j < h; j++) for (int i = 0; i < w; i++) {
        int mx = i * LV.w / w, my = j * LV.h / h, m = LV.map[mx * LV.h + my], c = m < nmtil ? mcol[m] : 0;
        if (c == COL_SOLID) tp_px(x + i, y + j, 254); else if (c == COL_HAZARD) tp_px(x + i, y + j, 255);
    }
    int ppx = x + ((px >> 8) / 16) * w / LV.w, ppy = y + ((py >> 8) / 16) * h / LV.h;
    for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) tp_px(ppx + a, ppy + b, (frame >> 3) & 1 ? 255 : 254);
}
static int play_seconds;
static void tp_widgets(void) {
    char buf[40];
    for (int i = 0; i < tp_nw; i++) {
        const u8 *w = tp_wid + i * 8; int x = w[0], y = w[1], ww = w[2], hh = w[3], kind = w[4], sc = w[5] ? w[5] : 1;
        buf[0] = 0;
        switch (kind) {
        case TW_SCORE: sprintf(buf, "%d", score); break;
        case TW_COINS: sprintf(buf, "%d", coins); break;
        case TW_LIVES: sprintf(buf, "%d", lives < 0 ? 0 : lives); break;
        case TW_LEVEL: sprintf(buf, "%d", level_i + 1); break;
        case TW_LEVELNAME: snprintf(buf, sizeof buf, "%.20s", LV.name ? LV.name : ""); break;
        case TW_TITLE: snprintf(buf, sizeof buf, "%.30s", META->title); break;
        case TW_TIMER: sprintf(buf, "%d:%02d", play_seconds / 60, play_seconds % 60); break;
        case TW_HEARTS: { tp_blit_rect(x, y, ww, hh, 0); int n = lives < 0 ? 0 : lives > 10 ? 10 : lives; for (int k = 0; k < n; k++) tp_text(x + k * 7 * sc, y, "*", sc); continue; }
        case TW_MINIMAP: if (tp_mapbig || ww) tp_minimap(x, y, ww, hh); continue;
        }
        tp_blit_rect(x, y, ww ? ww : 96, 8 * sc + 1, 0);
        tp_text(x, y, buf, sc);
    }
}
static int tp_setup(void) {
    u32 sz; const u8 *p = sec("TPAD", &sz);
    if (!p || sz < 49152 + 512 + 8) return 0;
    tp_nb = p[2]; tp_nw = p[3]; tp_img = p + 8; tp_btn = tp_img + 49152 + 512; tp_wid = tp_btn + tp_nb * 8;
    videoSetModeSub(MODE_5_2D);
    vramSetBankC(VRAM_C_SUB_BG);
    int b = bgInitSub(3, BgType_Bmp8, BgSize_B8_256x256, 0, 0);
    tp_vram = bgGetGfxPtr(b);
    dmaCopy(tp_img + 49152, BG_PALETTE_SUB, 512);
    tp_blit_rect(0, 0, 256, 192, 0);
    return 1;
}
/* touch -> virtual buttons. returns extra held/down keys */
static void tp_input(u32 *down, u32 *held) {
    if (!has_tpad) return;
    int hit = -1;
    if (*held & KEY_TOUCH) {
        touchPosition t; touchRead(&t);
        for (int i = 0; i < tp_nb; i++) { const u8 *b = tp_btn + i * 8; int bh = b[3] | (b[5] << 8);
            if (t.px >= b[0] && t.px < b[0] + b[2] && t.py >= b[1] && t.py < b[1] + bh) { hit = i; break; } }
    }
    if (hit != tp_pressed) {
        if (tp_pressed >= 0) { const u8 *b = tp_btn + tp_pressed * 8; tp_blit_rect(b[0], b[1], b[2], b[3] | (b[5] << 8), 0); }
        if (hit >= 0) { const u8 *b = tp_btn + hit * 8; tp_blit_rect(b[0], b[1], b[2], b[3] | (b[5] << 8), 1); }
    }
    int fresh = hit >= 0 && hit != tp_pressed;
    tp_pressed = hit;
    *down &= ~KEY_TOUCH; *held &= ~KEY_TOUCH;
    if (tp_runtoggle) *held |= KEY_Y;
    if (hit < 0) return;
    static const u32 KEYMAP[] = {0, KEY_LEFT, KEY_RIGHT, KEY_UP, KEY_DOWN, KEY_B, KEY_Y, KEY_START, 0, 0, 0, KEY_X, 0, KEY_SELECT};
    int act = tp_btn[hit * 8 + 4];
    u32 k = act < (int)(sizeof KEYMAP / 4) ? KEYMAP[act] : 0;
    *held |= k; if (fresh) *down |= k;
    if (fresh) {
        if (act == TA_RUNTOGGLE) tp_runtoggle = !tp_runtoggle;
        if (act == TA_MUSIC) { tp_muted = !tp_muted; music_vol = tp_muted ? 0 : 48; if (tp_muted) stop_tracks(); }
        if (act == TA_RESTART) *down |= 0x80000000u;      /* handled by the game loop */
        if (act == TA_MAP) tp_mapbig = !tp_mapbig;
    }
}

static int solid_px(int x, int y) { int c = col_at_px(x, y); return c == COL_SOLID; }
static void hud(void) {
    if (has_tpad) { tp_widgets(); return; }
    printf("\x1b[2J");
    printf("\x1b[1;1H%.30s", META->title);
    printf("\x1b[3;1HLEVEL %d: %.20s", level_i + 1, LV.name ? LV.name : "");
    printf("\x1b[6;1HSCORE  %7d", score);
    printf("\x1b[8;1HCOINS  %3d", coins);
    printf("\x1b[10;1HLIVES  %2d", lives);
    printf("\x1b[14;1HD-PAD  MOVE      B/A  JUMP");
    printf("\x1b[15;1HY      RUN       START PAUSE");
    printf("\x1b[19;9H[ TAP TO PAUSE ]");
    printf("\x1b[22;1HMADE WITH NOTAREAL GAME STUDIO");
}
static int hud_dirty;
static int overlap(s32 ax, s32 ay, int aw, int ah, s32 bx, s32 by, int bw, int bh) {
    return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
}
static void kill_player(void) { if (dead_t) return; dead_t = 1; sfx(SFX_HURT); pvy = -FX * 4; }

#ifdef NR_AUTOTEST
static void bot_input(void) {
    kh = KEY_RIGHT | KEY_Y; kd = 0;
    int x = (px >> 8) + hw, y = (py >> 8) + hh;
    int wall = solid_px(x + 10, y - 6) || solid_px(x + 10, y - 20);
    int c = col_at_px(x + 14, y + 4), gap = c != COL_SOLID && c != COL_PLATFORM;
    int haz = col_at_px(x + 20, y - 4) == COL_HAZARD || col_at_px(x + 20, y + 4) == COL_HAZARD;
    int foe = 0;
    for (int i = 0; i < na; i++) { Actor *a = &A[i]; if (!a->alive || a->state) continue;
        if ((a->type == OB_WALKER || a->type == OB_HOPPER || a->type == OB_FLYER) && (a->x >> 8) - x > 0 && (a->x >> 8) - x < 48 && (a->y >> 8) > (py >> 8) - 40) foe = 1; }
    if (on_ground && (wall || gap || haz || foe)) { kd = KEY_B; bot_jump_t = 20; }
    if (bot_jump_t > 0) { kh |= KEY_B; bot_jump_t--; }
}
#endif
static void update_player(void) {
#ifdef NR_AUTOTEST
    bot_input();
#endif
    if (dead_t) {
        dead_t++; pvy += META->gravity; py += pvy;
        if (dead_t > 90) { lives--; hud_dirty = 1; if (lives >= 0) respawn(); }
        return;
    }
    /* Technique Library physics: target speed from the run button, fixed acceleration toward it
       (measured behaviour of classic platformers; numbers come from the game data) */
    s32 maxv = (kh & KEY_Y) ? (META->run_fast ? META->run_fast : META->run * 3 / 2) : META->run, acc = META->accel;
    if (kh & KEY_LEFT) { pvx -= acc; if (pvx < -maxv) pvx = -maxv; pdir = 0; }
    else if (kh & KEY_RIGHT) { pvx += acc; if (pvx > maxv) pvx = maxv; pdir = 1; }
    else { if (pvx > 0) { pvx -= acc; if (pvx < 0) pvx = 0; } else if (pvx < 0) { pvx += acc; if (pvx > 0) pvx = 0; } }
    /* horizontal */
    s32 nx = px + pvx; int x = nx >> 8, y = py >> 8;
    if (pvx > 0 && (solid_px(x + hw - 1, y) || solid_px(x + hw - 1, y + hh / 2) || solid_px(x + hw - 1, y + hh - 1))) { nx = (((x + hw - 1) >> 4) * 16 - hw) * FX; pvx = 0; }
    if (pvx < 0 && (solid_px(x, y) || solid_px(x, y + hh / 2) || solid_px(x, y + hh - 1))) { nx = ((x >> 4) * 16 + 16) * FX; pvx = 0; }
    px = nx; if (px < 0) px = 0;
    /* jump (buffered + coyote time) */
    if (kd & (KEY_B | KEY_A)) jbuf = 6; else if (jbuf) jbuf--;
    if (on_ground) coyote = 6; else if (coyote) coyote--;
    if (jbuf && coyote) {
        s32 j = META->jump;                         /* speed-dependent jump: running jumps go higher */
        if (META->jump_run && META->run_fast) { s32 sp = pvx < 0 ? -pvx : pvx; j += (META->jump_run - META->jump) * (sp > META->run_fast ? META->run_fast : sp) / META->run_fast; }
        pvy = -j; jbuf = 0; coyote = 0; on_ground = 0; sfx(SFX_JUMP);
    }
    s32 g = META->gravity; if (pvy < 0 && !(kh & (KEY_B | KEY_A))) g *= 2;    /* variable gravity: hold to jump higher */
    s32 mf = (META->max_fall ? META->max_fall : 6) * FX;
    pvy += g; if (pvy > mf) pvy = mf;
    /* vertical */
    s32 ny = py + pvy; x = px >> 8; int yb = (py >> 8) + hh, nyb = (ny >> 8) + hh;
    on_ground = 0;
    if (pvy >= 0) {
        for (int sx = x + 1; sx <= x + hw - 2; sx += hw - 3) {
            int c = col_at_px(sx, nyb);
            int tile_top = (nyb >> 4) * 16;
            if (c == COL_SOLID || (c == COL_PLATFORM && yb <= tile_top)) { ny = (tile_top - hh) * FX; pvy = 0; on_ground = 1; break; }
        }
    } else {
        int ty = ny >> 8;
        if (solid_px(x + 1, ty) || solid_px(x + hw - 2, ty)) { ny = ((ty >> 4) * 16 + 16) * FX; pvy = 0; }
    }
    py = ny;
    /* hazards and falling out */
    x = px >> 8; y = py >> 8;
    if (col_at_px(x + hw / 2, y + hh - 2) == COL_HAZARD || col_at_px(x + 2, y + hh / 2) == COL_HAZARD || col_at_px(x + hw - 3, y + hh / 2) == COL_HAZARD) kill_player();
    if (y > LV.h * 16 + 32) kill_player();
    panim = on_ground ? (pvx ? 1 + ((frame >> 3) & 1) : 0) : 3;
}
static void update_actors(void) {
    for (int i = 0; i < na; i++) {
        Actor *a = &A[i];
        if (!a->alive) continue;
        int ax = a->x >> 8, ay = a->y >> 8;
        if (ax < cam_x - 128 || ax > cam_x + 384) continue;      /* sleep off-screen */
        a->t++;
        switch (a->type) {
        case OB_WALKER: case OB_HOPPER:
            if (a->state) { if (++a->state > 24) a->alive = 0; continue; }
            if (a->type == OB_HOPPER) {
                int ground = col_at_px(ax + 8, ay + 16) == COL_SOLID || col_at_px(ax + 8, ay + 16) == COL_PLATFORM;
                if (ground && a->vy >= 0 && (a->t % 70) == 0) { a->vy = -FX * 4; a->vx = ((px >> 8) < ax ? -FX : FX) * 3 / 4; }
                if (ground && a->vy >= 0 && (a->t % 70) > 2) a->vx = 0;
            }
            a->vy += META->gravity; if (a->vy > FX * 5) a->vy = FX * 5;
            a->x += a->vx; ax = a->x >> 8;
            if (a->vx < 0 && col_at_px(ax, ay + 8) == COL_SOLID) { a->vx = -a->vx; a->x += a->vx * 2; }
            if (a->vx > 0 && col_at_px(ax + 15, ay + 8) == COL_SOLID) { a->vx = -a->vx; a->x += a->vx * 2; }
            if (a->type == OB_WALKER) {   /* turn at ledges */
                int fx = a->vx < 0 ? ax - 1 : ax + 16, c = col_at_px(fx, ay + 17);
                if (c != COL_SOLID && c != COL_PLATFORM && col_at_px(ax + 8, ay + 17) != COL_EMPTY) { a->vx = -a->vx; }
            }
            a->y += a->vy; ay = a->y >> 8;
            { int c1 = col_at_px(ax + 3, ay + 16), c2 = col_at_px(ax + 12, ay + 16);
              if (a->vy >= 0 && (c1 == COL_SOLID || c1 == COL_PLATFORM || c2 == COL_SOLID || c2 == COL_PLATFORM)) { a->y = ((ay + 16) / 16 * 16 - 16) * FX; a->vy = 0; } }
            if (ay > LV.h * 16 + 32) a->alive = 0;
            break;
        case OB_FLYER:
            a->x += a->vx; if ((a->t % 160) == 0) a->vx = -a->vx;
            a->y = a->y0 + ((sinLerp(a->t * 300) * 20) >> 4);
            break;
        }
        /* contact with the player */
        if (dead_t || clear_t) continue;
        int bw = 16, bh = 16; ax = a->x >> 8; ay = a->y >> 8;
        if (a->type == OB_GOAL) { bh = 32 + 192; ay -= 16 + 192; }   /* the goal pole counts all the way up: no jumping over it */
        if (!overlap(px >> 8, py >> 8, hw, hh, ax + 2, ay + 2, bw - 4, bh - 2)) continue;
        switch (a->type) {
        case OB_COIN: a->alive = 0; coins++; score += 10; sfx(SFX_COIN); if (coins % 100 == 0) { lives++; sfx(SFX_1UP); } hud_dirty = 1; break;
        case OB_HEART: a->alive = 0; lives++; score += 50; sfx(SFX_1UP); hud_dirty = 1; break;
        case OB_CHECK: if (!a->state) { a->state = 1; cp_x = ax; cp_y = ay; sfx(SFX_COIN); } break;
        case OB_SPRING: if (pvy > 0) { pvy = -META->jump * 8 / 5; a->state = 8; sfx(SFX_SPRING); } break;
        case OB_GOAL: clear_t = 1; sfx(SFX_GOAL); score += 1000; hud_dirty = 1; break;
        case OB_WALKER: case OB_HOPPER: case OB_FLYER:
            if (a->state) break;
            if (pvy > 0 && (py >> 8) + hh < ay + 10) { a->state = 1; if (a->type == OB_FLYER) a->alive = 0; pvy = -META->jump * 6 / 10; score += 100; sfx(SFX_STOMP); hud_dirty = 1; }
            else kill_player();
            break;
        }
    }
}
static void draw_world(void) {
    /* stream the level columns */
    int c0 = cam_x >> 4;
    for (int mx = c0 - 1; mx <= c0 + 17; mx++) draw_col(mx);
    bgSetScroll(bg0, cam_x & 511, cam_y);
    bgSetScroll(bg1, (cam_x / 2) & 511, cam_y / 4);
    for (int i = 0; i < na; i++) {
        Actor *a = &A[i];
        if (!a->alive) continue;
        int sx = (a->x >> 8) - cam_x, sy = (a->y >> 8) - cam_y;
        switch (a->type) {
        case OB_COIN: spr(SH_COIN, (frame >> 3) & 3, sx, sy, 0); break;
        case OB_WALKER: spr(SH_WALKER, a->state ? 2 : (frame >> 4) & 1, sx, sy, a->vx > 0); break;
        case OB_HOPPER: spr(SH_HOPPER, a->state ? 2 : (a->vy < 0 ? 1 : 0), sx, sy, a->vx > 0); break;
        case OB_FLYER: spr(SH_FLYER, (frame >> 3) & 1, sx, sy, a->vx > 0); break;
        case OB_GOAL: spr(SH_GOAL, (frame >> 4) & 1, sx, sy - 16, 0); break;
        case OB_SPRING: spr(SH_SPRING, a->state ? 1 : 0, sx, sy, 0); if (a->state) a->state--; break;
        case OB_HEART: spr(SH_HEART, (frame >> 4) & 1, sx, sy + ((frame >> 3) & 1), 0); break;
        case OB_CHECK: spr(SH_CHECK, a->state ? 1 : 0, sx, sy, 0); break;
        }
    }
    int hero_frame = dead_t ? 4 : panim;
    spr(SH_HERO, hero_frame, (px >> 8) - (pw - hw) / 2 - cam_x, (py >> 8) - (ph - hh) - cam_y, pdir == 0);
}
static void update_camera(void) {
    int tx = (px >> 8) + hw / 2 - 112 + (pdir ? 16 : -16);
    cam_x += (tx - cam_x) / 6;
    int max_x = LV.w * 16 - 256; if (cam_x > max_x) cam_x = max_x; if (cam_x < 0) cam_x = 0;
    int ty = (py >> 8) - 100; int max_y = LV.h * 16 - 192; if (max_y < 0) max_y = 0;
    cam_y += (ty - cam_y) / 6; if (cam_y < 0) cam_y = 0; if (cam_y > max_y) cam_y = max_y;
}

/* ------------------------------------------------------------ screens */
static void title_screen(void) {
    load_level(0); spawn_actors(); respawn();
    play_song(META->title_song);
    if (has_tpad) hud(); else printf("\x1b[2J\x1b[2;1H%.30s\x1b[4;1HBY %.27s\x1b[9;4HPRESS START TO PLAY\x1b[22;1HMADE WITH NOTAREAL GAME STUDIO", META->title, META->author);
    int t = 0;
    while (1) {
        input();
        if (t > 20 && (kd & (KEY_START | KEY_A | KEY_TOUCH))) break;
#ifdef NR_AUTOTEST
        if (t > 60) break;
#endif
        frame_begin();
        cam_x = (t / 2) % (LV.w * 16 > 256 ? LV.w * 16 - 256 : 1); cam_y = LV.h * 16 - 192 > 0 ? LV.h * 16 - 192 : 0;
        draw_world();
        ctext(48, META->title);
        if (META->tagline[0]) ctext(64, META->tagline);
        if ((t >> 4) & 1) ctext(132, "PRESS START");
        frame_end(); t++;
    }
}
static void banner(const char *a, const char *b, int frames) {
    for (int t = 0; t < frames; t++) { input(); frame_begin(); draw_world(); ctext(80, a); if (b) ctext(96, b); frame_end(); }
}
/* cutscenes: CUTS section = u8 count, then per scene u8 when (0 intro, 1 before level, 2 ending), u8 level, u16 frames, u8 speaker_len, u8 text_len, speaker, text.
   A / START / touch moves on. */
static void play_scenes(int when, int lvl) {
    u32 sz; const u8 *p = sec("CUTS", &sz); if (!p || !sz) return; int n = p[0]; p++;
    for (int i = 0; i < n; i++) {
        int w = p[0], l = p[1], fr = p[2] | p[3] << 8, sl = p[4], tl = p[5]; const u8 *sp = p + 6, *tp = sp + sl; p = tp + tl;
        if (w != when || (w == 1 && l != lvl)) continue;
        char sp_[24], tx[160]; if (sl > 23) sl = 23; if (tl > 159) tl = 159; memcpy(sp_, sp, sl); sp_[sl] = 0; memcpy(tx, tp, tl); tx[tl] = 0;
        char ln[6][32]; int nl = 0, k = 0;                                   /* word wrap at 28 columns */
        while (tx[k] && nl < 6) { int len = 0, last = -1; while (tx[k + len] && len < 28) { if (tx[k + len] == ' ') last = len; len++; } if (tx[k + len] && last > 0) len = last; memcpy(ln[nl], tx + k, len); ln[nl][len] = 0; nl++; k += len; while (tx[k] == ' ') k++; }
        for (int t = 0; t < (fr > 30 ? fr : 180); t++) {
            input(); if (t > 20 && (kd & (KEY_A | KEY_START | KEY_TOUCH))) break;
            frame_begin(); draw_world(); for (int y = 40; y < 152; y += 1) { }
            ctext(48, sp_[0] ? sp_ : "");
            for (int q = 0; q < nl; q++) ctext(72 + q * 12, ln[q]);
            if (t > 30 && ((t >> 4) & 1)) ctext(150, "A");
            frame_end();
        }
    }
}
static void no_data_screen(void) {
    consoleDemoInit();
    printf("\x1b[2J\n NOTAREAL GAME STUDIO\n\n This is the DS sidescroller\n engine template.\n\n Open the Notareal Dev Kit,\n make a game and press\n EXPORT ROM.");
    while (1) swiWaitForVBlank();
}

#include "world.inc"
int main(void) {
    defaultExceptionHandler();
    H = (const NrgHeader *)nr_gamedata;
    splash();                                   /* every Notareal ROM opens on the logo */
    if (memcmp(H->magic, "NRGDATA1", 8) || !H->used) no_data_screen();
    META = (const NrgMeta *)sec("META", 0);
    if (!META) no_data_screen();
    { u32 sz; mcol = sec("MCOL", &sz); nmtil = sz; }
    hw = (META->hero_w ? META->hero_w : 16) - 4; hh = (META->hero_h ? META->hero_h : 16) - 2;
    pw = META->hero_w ? META->hero_w : 16; ph = META->hero_h ? META->hero_h : 16;
    snd_master(127);
    opening();
    setup_video();
    if (sec("WRLD", 0)) world_main();
    while (1) {
        title_screen(); play_scenes(0, 0);
        lives = META->lives ? META->lives : 3; score = 0; coins = 0; level_i = 0;
        while (lives >= 0 && level_i < META->nlevels) {
            if (!load_level(level_i)) break;
            spawn_actors(); respawn(); clear_t = 0; cam_x = 0; cam_y = 0;
            update_camera(); cam_x = (px >> 8) - 112; if (cam_x < 0) cam_x = 0;
            hud(); play_song(LV.song);
            play_scenes(1, level_i);
            char lvl[16]; sprintf(lvl, "LEVEL %d", level_i + 1);
            banner(lvl, LV.name, 90);
            int paused = 0;
            while (1) {
                input();
                if ((kd & KEY_START) || (!has_tpad && (kd & KEY_TOUCH))) { paused = !paused; }
                if ((kd & 0x80000000u) && !dead_t && !clear_t) { respawn(); paused = 0; }
                if (!paused && (frame % 60) == 0) { play_seconds++; hud_dirty = 1; }
                if (has_tpad && (frame & 7) == 0) for (int i = 0; i < tp_nw; i++) if (tp_wid[i * 8 + 4] == TW_MINIMAP) tp_minimap(tp_wid[i * 8], tp_wid[i * 8 + 1], tp_wid[i * 8 + 2], tp_wid[i * 8 + 3]);
                frame_begin();
                if (!paused) {
                    if (clear_t) { clear_t++; if (clear_t > 150) break; }
                    else update_player();
                    update_actors();
                    update_camera();
                }
                draw_world();
                if (paused) ctext(88, "PAUSED");
                if (clear_t) ctext(80, "LEVEL CLEAR!");
                frame_end();
                if (hud_dirty) { hud(); hud_dirty = 0; }
                if (lives < 0) break;
            }
            if (lives < 0) break;
            level_i++;
        }
        play_song(META->clear_song); if (lives >= 0) play_scenes(2, 0);
        if (lives < 0) banner("GAME OVER", 0, 180);
        else { char s[24]; sprintf(s, "SCORE %d", score); banner("THE END - THANKS FOR PLAYING!", s, 300); }
    }
}

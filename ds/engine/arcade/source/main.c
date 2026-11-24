// NOTAREAL Game Studio - DS arcade engine: shoot-em-up, breakout, racing, first-person shooter, brawler, falling blocks, memory,
// city builder, paint-by-number and basketball. One ROM, ten games; the editor writes one "ARCF" section (mode + settings).
// Top screen = the game. Bottom screen = HUD and touch controls.
#include <nds.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "nrg.h"
#include "splash_bin.h"
#include "font_bin.h"

extern const unsigned char nr_gamedata[];
void snd_input(void);
void snd_psg_ch(int ch, int duty, int hz, int vol, int pan);
void snd_noise_ch(int ch, int hz, int vol, int pan);
void snd_stop(int ch);
static int fr_n, kill_at[16];
static void beep(int hz, int frames) { static int ch; ch ^= 1; snd_psg_ch(12 + ch, 2, hz, 60, 64); kill_at[12 + ch] = fr_n + frames; }
static void thud(int frames) { snd_noise_ch(15, 2500, 90, 64); kill_at[15] = fr_n + frames; }
static const u8 *sec(const char *id, u32 *size); static inline int rd16s(const u8 *p);
static const u8 *song; static int song_steps, song_tq, song_nch, song_step, song_acc; static u8 tr_inst[8], tr_vol[8], tr_pan[8], tr_hw[8], cfg_song, cfg_title;
static const u16 NOTE_HZ[12] = { 262, 277, 294, 311, 330, 349, 370, 392, 415, 440, 466, 494 };
static int midi_hz(int n) { int o = n / 12 - 5, hz = NOTE_HZ[n % 12]; while (o > 0) { hz <<= 1; o--; } while (o < 0) { hz >>= 1; o++; } return hz; }
static void stop_music(void) { for (int c = 8; c < 12; c++) snd_stop(c); snd_stop(14); song = 0; }
static void play_song(int idx) {      /* idx 1-based, 0 = silence. SONG v2 section, chip voices only */
    stop_music(); if (idx <= 0) return; idx--;
    u32 sz; const u8 *s = sec("SONG", &sz); if (!s || idx >= s[0] || s[1] != 2) return;
    const u8 *p = s + 4; for (int i = 0; i < idx; i++) { int st = rd16s(p), nc = p[4]; p += 8 + nc * 4 + ((st * nc + 3) & ~3); }
    song_steps = rd16s(p); song_tq = rd16s(p + 2); song_nch = p[4] > 8 ? 8 : p[4]; int hw = 8;
    for (int c = 0; c < song_nch; c++) { const u8 *t = p + 8 + c * 4; tr_inst[c] = t[0]; tr_vol[c] = t[1]; tr_pan[c] = t[2]; tr_hw[c] = t[0] == 3 ? 14 : (hw < 12 ? hw++ : 0); }
    song = p + 8 + p[4] * 4; if (song_tq < 16) song_tq = 16; song_step = 0; song_acc = 0;
}
static void music_note(int c, int n) {
    int in = tr_inst[c], hw = tr_hw[c], vol = tr_vol[c] * 2 / 3; if (n == 128 || !hw) return;
    if (in == 3) { if (n) { static const u16 DR[4] = { 0, 120, 2000, 9000 }; static const u8 DL[4] = { 0, 6, 5, 2 }; snd_noise_ch(14, DR[n & 3], vol * 3 / 5, tr_pan[c]); kill_at[14] = fr_n + DL[n & 3]; } return; }
    if (in > 3) in = 1; { static const u8 duty[3] = { 4, 2, 1 }; if (!n) snd_stop(hw); else snd_psg_ch(hw, duty[in], midi_hz(n), vol * 3 / 4, tr_pan[c]); }
}
static void music_tick(void) {
    if (!song || !song_steps) return; song_acc -= 16; if (song_acc > 0) return; song_acc += song_tq;
    for (int c = 0; c < song_nch; c++) music_note(c, song[c * song_steps + song_step]);
    if (++song_step >= song_steps) song_step = 0;
}
static void sound_tick(void) { fr_n++; music_tick(); for (int c = 0; c < 16; c++) if (kill_at[c] && fr_n >= kill_at[c]) { snd_stop(c); kill_at[c] = 0; } }

static inline int rd16s(const u8 *p) { return p[0] | p[1] << 8; }
static const NrgHeader *H;
static const u8 *sec(const char *id, u32 *size) { for (u32 i = 0; i < H->count; i++) if (!memcmp(H->sec[i].id, id, 4)) { if (size) *size = H->sec[i].size; return (const u8 *)H + H->sec[i].off; } if (size) *size = 0; return 0; }
static u32 kd, kh; static int touched, tx, ty, ptx, pty;
static void input(void) { snd_input(); scanKeys(); kd = keysDown(); kh = keysHeld(); ptx = tx; pty = ty; touched = 0; if (kh & KEY_TOUCH) { touchPosition t; touchRead(&t); if (t.px || t.py) { tx = t.px; ty = t.py; touched = (kd & KEY_TOUCH) ? 2 : 1; } } }
static u16 top[256 * 192], bot[256 * 192]; static u16 *cur = top, *fbt, *fbb;
static u32 rs = 12345; static int rnd(int n) { rs = rs * 1664525u + 1013904223u; return (int)((rs >> 8) % (u32)(n > 0 ? n : 1)); }
#define RGB(r, g, b) (RGB15((r) >> 3, (g) >> 3, (b) >> 3) | BIT(15))
static void px(int x, int y, u16 c) { if ((unsigned)x < 256 && (unsigned)y < 192) cur[y * 256 + x] = c; }
static void rect(int x, int y, int w, int h, u16 c) { int x0 = x < 0 ? 0 : x, x1 = x + w > 256 ? 256 : x + w, y0 = y < 0 ? 0 : y, y1 = y + h > 192 ? 192 : y + h; for (int j = y0; j < y1; j++) for (int i = x0; i < x1; i++) cur[j * 256 + i] = c; }
static void disc(int cx, int cy, int r, u16 c) { for (int j = -r; j <= r; j++) for (int i = -r; i <= r; i++) if (i * i + j * j <= r * r) px(cx + i, cy + j, c); }
static void frame_rect(int x, int y, int w, int h, u16 c) { rect(x, y, w, 1, c); rect(x, y + h - 1, w, 1, c); rect(x, y, 1, h, c); rect(x + w - 1, y, 1, h, c); }
static void text(int x, int y, const char *s, u16 c) { for (; *s; s++, x += 8) { int ch = *s; if (ch >= 'a' && ch <= 'z') ch -= 32; if (ch <= 32 || ch > 127) continue; const u8 *g = font_bin + (ch - 32) * 64; for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) if (g[j * 8 + i]) px(x + i, y + j, c); } }
static void ctext(int y, const char *s, u16 c) { text((256 - (int)strlen(s) * 8) / 2, y, s, c); }
static void wrap(int x, int y, const char *s, u16 c) { char line[40]; int n = 0; while (*s) { int k = 0, last = -1; while (s[k] && k < 30) { if (s[k] == ' ') last = k; k++; } if (s[k] && last > 0) k = last; memcpy(line, s, k); line[k] = 0; text(x, y + n * 10, line, c); n++; s += k; while (*s == ' ') s++; } }
static void clear(u16 c) { for (int i = 0; i < 256 * 192; i++) cur[i] = c; }
static void show(void) { swiWaitForVBlank(); dmaCopy(top, fbt, 256 * 192 * 2); dmaCopy(bot, fbb, 256 * 192 * 2); input(); sound_tick(); }
static void video(void) {
    videoSetMode(MODE_5_2D); videoSetModeSub(MODE_5_2D); vramSetBankA(VRAM_A_MAIN_BG); vramSetBankC(VRAM_C_SUB_BG);
    fbt = (u16 *)bgGetGfxPtr(bgInit(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0)); fbb = (u16 *)bgGetGfxPtr(bgInitSub(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0));
}
static int hexc(const char *h) { return 0; (void)h; }

/* ---------------- config ---------------- */
enum { M_SHMUP, M_BREAKOUT, M_RACE, M_FPS, M_BRAWLER, M_FALLING, M_MEMORY, M_SIM, M_PAINT, M_HOOPS, M_MUSIC, M_COLOR, M_CARD, M_COMBAT };
static int mode, P[8]; static u16 c1 = RGB15(8, 24, 31) | BIT(15), c2 = RGB15(31, 10, 10) | BIT(15); static char title[33] = "ARCADE";
static const char *HELP[] = { "D-pad move, A fire", "Left/Right paddle, A launch", "Up gas, Down brake, Left/Right steer", "Up/Down move, Left/Right turn, L/R strafe, A fire, B reload. Drag the bottom screen to look.", "D-pad walk, A punch, B kick", "Left/Right move, Up rotate, Down drop", "D-pad move, A flip (or tap)", "D-pad cursor, A build, B change (or tap)", "D-pad cursor, A paint, B next colour (or tap)", "A stops the meter, Left/Right aim", "Tap the grid to place notes. START plays and stops. L/R changes tempo.", "Tap a shape on the bottom screen to fill it. Pick colours below. L/R changes page.", "", "Up gas, Down brake, Left/Right steer. Hold B machine gun, A homing missile, X or Y drop a mine. Grab the crates." };
/* a router ROM carries an SCNS section: a list of scenes (each = one arcade engine + its settings, or a text card) with win / lose links, played in order */
static const u8 *SC; static int nscn, scn_i, scn_win, scn_lose, scn_card; static const char *card_text;
static void apply_cfg(const u8 *p) {
    mode = p[0]; if (mode > 11 && mode != M_COMBAT) mode = 0; cfg_song = p[1]; cfg_title = p[2]; for (int i = 0; i < 8; i++) P[i] = (s16)(p[4 + i * 2] | (p[5 + i * 2] << 8));
    c1 = p[20] | (p[21] << 8) | BIT(15); c2 = p[22] | (p[23] << 8) | BIT(15); memcpy(title, p + 24, 32); title[32] = 0;
}
static void apply_scene(int i) {
    const u8 *r = SC + 4 + i * 192; scn_i = i; apply_cfg(r); scn_win = r[56]; scn_lose = r[57]; scn_card = r[58] == 1; card_text = (const char *)(r + 64); if (scn_card) mode = M_CARD;
}
static void load_cfg(void) {
    u32 sz; const u8 *p; H = (const NrgHeader *)nr_gamedata; p = sec("ARCF", &sz);
    if (!p || sz < 56) return;
    apply_cfg(p); const u8 *sc = sec("SCNS", &sz); if (sc && sc[0] && sz >= 4u + 192u * sc[0]) { SC = sc; nscn = sc[0]; apply_scene(0); }
}
static int score, lives, status, t, paused, over_t;       /* status 0 play 1 win 2 lose */
static int hp, ammo, mag, reload; static char msg[40];
static void say(const char *s) { strncpy(msg, s, 39); msg[39] = 0; }

/* ======================= shoot-em-up ======================= */
typedef struct { int x, y, vx, vy, hp, t, on, ty; } Mob;
static Mob en[24], pb[16], eb[32]; static int sx, sy, wave, spawned, boss, fire_t, sh_t, inv;
static const u8 *SHM; static int sh_q, sh_bhp;   /* SHMP design section: enemy types + scheduled waves (kit/nrkit.js NR.shmupDesign) */
static void shmup_init(void) { u32 zz; SHM = sec("SHMP", &zz); if (SHM && (zz < 152 || !SHM[0])) SHM = 0; sh_q = 0; sh_bhp = SHM ? SHM[3] : 40; memset(en, 0, sizeof en); memset(pb, 0, sizeof pb); memset(eb, 0, sizeof eb); sx = 120; sy = 170; wave = 0; spawned = 0; boss = 0; lives = P[0]; score = 0; inv = 0; }
static void add_mob(Mob *a, int n, int x, int y, int vx, int vy, int hp) { for (int i = 0; i < n; i++) if (!a[i].on) { a[i] = (Mob){ x, y, vx, vy, hp, 0, 1 }; return; } }
static u16 shm_col(int k) { static u16 t[5]; if (!t[1]) { t[1] = RGB(255, 210, 74); t[2] = RGB(91, 224, 138); t[3] = RGB(192, 122, 255); t[4] = RGB(255, 255, 255); } return k ? t[k > 4 ? 4 : k] : c2; }
static void shmup_step_d(void) {
    int spd = P[1] < 1 ? 3 : P[1]; t++;
    if (kh & KEY_LEFT) sx -= spd; if (kh & KEY_RIGHT) sx += spd; if (kh & KEY_UP) sy -= spd; if (kh & KEY_DOWN) sy += spd; if (sx < 8) sx = 8; if (sx > 240) sx = 240; if (sy < 90) sy = 90; if (sy > 184) sy = 184;
    if (fire_t) fire_t--; if ((kh & KEY_A) && !fire_t) { add_mob(pb, 16, sx, sy - 8, 0, -7, 1); fire_t = P[2] < 3 ? 8 : P[2]; beep(900, 3); }
    int nt = SHM[1], nw = SHM[2]; int alive = 0; for (int i = 0; i < 24; i++) if (en[i].on) alive++;
    while (sh_q < nw && !boss) { const u8 *w = SHM + 56 + sh_q * 6; int at = w[0] | (w[1] << 8); if (at > t) break; int ty = w[2] < nt ? w[2] : 0, n = w[3], f = w[4], x0 = w[5]; const u8 *T = SHM + 8 + ty * 8;
        for (int i = 0; i < n; i++) { int x, y = -10 - i * 14, k = i - (n - 1) / 2; if (f == 0) x = x0 + k * 34 + ((n & 1) ? 0 : 17); else if (f == 1) { x = x0 + k * 30 + ((n & 1) ? 0 : 15); y = -10 - (k < 0 ? -k : k) * 16; } else if (f == 2) { x = x0; y = -10 - i * 24; } else x = (i & 1) ? 240 : 16; if (x < 12) x = 12; if (x > 244) x = 244;
            add_mob(en, 24, x, y, 0, 0, T[0]); for (int j = 0; j < 24; j++) if (en[j].on && en[j].t == 0 && en[j].ty == 0 && en[j].hp == T[0] && en[j].x == x && en[j].y == y) { en[j].ty = ty; break; } }
        sh_q++; }
    if (!alive && sh_q >= nw && !boss) { if (P[5] && sh_bhp > 0) { boss = 1; add_mob(en, 24, 120, -30, 1, 1, sh_bhp); } else status = 1; }
    if (boss && !alive) status = 1;
    for (int i = 0; i < 24; i++) if (en[i].on) { Mob *e = &en[i]; e->t++;
        if (boss && i == 0) { int bp = SHM[4], fr = SHM[5] ? SHM[5] : 40; if (bp == 2) { if (e->x < sx - 2) e->x++; else if (e->x > sx + 2) e->x--; } else { e->x += e->vx * (bp == 1 ? 2 : 1); if (e->x < 40 || e->x > 216) e->vx = -e->vx; } if (e->y < 30) e->y += 1; if (e->t % fr == 0) for (int k = -1; k <= 1; k++) add_mob(eb, 32, e->x, e->y + 12, k, 3, 1); }
        else { const u8 *T = SHM + 8 + e->ty * 8; int sp = T[1], pat = T[2], fire = T[3] * 4;
            if (pat == 3) e->y += (e->t > 40 ? sp * 2 : sp) / 4 + ((e->t * (e->t > 40 ? sp * 2 : sp)) % 4 < ((e->t > 40 ? sp * 2 : sp) % 4) ? 1 : 0); else e->y += sp / 4 + ((e->t * sp) % 4 < (sp % 4) ? 1 : 0);
            if (pat == 1) e->x += (((e->t / 6) % 12) < 6 ? 1 : -1) * 2; else if (pat == 2) { if (e->x < sx - 1) e->x++; else if (e->x > sx + 1) e->x--; }
            if (fire && e->t % fire == (i * 7) % fire) add_mob(eb, 32, e->x, e->y + 8, (sx - e->x) / 60, 3, 1); if (e->y > 196) e->on = 0; }
        for (int k = 0; k < 16; k++) if (pb[k].on && abs(pb[k].x - e->x) < (boss ? 18 : (SHM[8 + e->ty * 8 + 6] ? 14 : 10)) && abs(pb[k].y - e->y) < (boss ? 14 : 8)) { pb[k].on = 0; e->hp--; thud(2); if (e->hp <= 0) { e->on = 0; score += boss ? 500 : SHM[8 + e->ty * 8 + 4] * 10; beep(300, 6); } } }
    for (int k = 0; k < 16; k++) if (pb[k].on) { pb[k].y += pb[k].vy; if (pb[k].y < -8) pb[k].on = 0; }
    if (inv) inv--;
    for (int k = 0; k < 32; k++) if (eb[k].on) { eb[k].x += eb[k].vx; eb[k].y += eb[k].vy; if (eb[k].y > 200 || eb[k].x < -8 || eb[k].x > 264) eb[k].on = 0; else if (!inv && abs(eb[k].x - sx) < 6 && abs(eb[k].y - sy) < 8) { eb[k].on = 0; lives--; inv = 90; thud(10); if (lives <= 0) status = 2; } }
    for (int i = 0; i < 24; i++) if (en[i].on && !inv && abs(en[i].x - sx) < 10 && abs(en[i].y - sy) < 10) { lives--; inv = 90; en[i].on = boss ? 1 : 0; if (lives <= 0) status = 2; }
}
static void shmup_step(void) {
    if (SHM) { shmup_step_d(); return; }
    int spd = P[1] < 1 ? 3 : P[1]; t++;
    if (kh & KEY_LEFT) sx -= spd; if (kh & KEY_RIGHT) sx += spd; if (kh & KEY_UP) sy -= spd; if (kh & KEY_DOWN) sy += spd; if (sx < 8) sx = 8; if (sx > 240) sx = 240; if (sy < 90) sy = 90; if (sy > 184) sy = 184;
    if (fire_t) fire_t--; if ((kh & KEY_A) && !fire_t) { add_mob(pb, 16, sx, sy - 8, 0, -7, 1); fire_t = P[2] < 3 ? 8 : P[2]; beep(900, 3); }
    int alive = 0; for (int i = 0; i < 24; i++) if (en[i].on) alive++;
    if (spawned < 6 && !boss && wave < P[3] && t % 20 == 0) { add_mob(en, 24, 30 + spawned * 36, -10, 0, 1, P[4] < 1 ? 1 : P[4]); en[0].t = 0; spawned++; }
    if (!alive && spawned >= 6 && !boss) { wave++; spawned = 0; if (wave >= P[3]) { if (P[5]) { boss = 1; add_mob(en, 24, 120, -30, 1, 1, 40); } else status = 1; } }
    if (boss && !alive) status = 1;
    for (int i = 0; i < 24; i++) if (en[i].on) { Mob *e = &en[i]; e->t++; if (boss && e->hp > 0 && i == 0 && e->hp > 0 && e->vx) { e->x += e->vx; if (e->x < 40 || e->x > 216) e->vx = -e->vx; if (e->y < 30) e->y += 1; if (e->t % 30 == 0) for (int k = -1; k <= 1; k++) add_mob(eb, 32, e->x, e->y + 12, k * 1, 3, 1); }
        else { e->y += e->vy; e->x += (int)(((e->t / 6) % 12) < 6 ? 1 : -1) * (1 + wave / 2); if (e->t % 70 == 40 + (i * 7) % 20) add_mob(eb, 32, e->x, e->y + 8, (sx - e->x) / 60, 3, 1); if (e->y > 196) e->on = 0; }
        for (int k = 0; k < 16; k++) if (pb[k].on && abs(pb[k].x - e->x) < (boss ? 18 : 10) && abs(pb[k].y - e->y) < (boss ? 14 : 8)) { pb[k].on = 0; e->hp--; thud(2); if (e->hp <= 0) { e->on = 0; score += boss ? 500 : 50; beep(300, 6); } } }
    for (int k = 0; k < 16; k++) if (pb[k].on) { pb[k].y += pb[k].vy; if (pb[k].y < -8) pb[k].on = 0; }
    if (inv) inv--;
    for (int k = 0; k < 32; k++) if (eb[k].on) { eb[k].x += eb[k].vx; eb[k].y += eb[k].vy; if (eb[k].y > 200 || eb[k].x < -8 || eb[k].x > 264) eb[k].on = 0; else if (!inv && abs(eb[k].x - sx) < 6 && abs(eb[k].y - sy) < 8) { eb[k].on = 0; lives--; inv = 90; thud(10); if (lives <= 0) status = 2; } }
    for (int i = 0; i < 24; i++) if (en[i].on && !inv && abs(en[i].x - sx) < 10 && abs(en[i].y - sy) < 10) { lives--; inv = 90; en[i].on = boss ? 1 : 0; if (lives <= 0) status = 2; }
}
static void shmup_draw(void) {
    clear(RGB(4, 5, 16)); for (int i = 0; i < 40; i++) px((i * 53) % 256, (i * 37 + t * (1 + i % 3)) % 192, RGB(120 + i * 3, 120 + i * 3, 160));
    for (int i = 0; i < 24; i++) if (en[i].on) { if (boss && i == 0) { rect(en[i].x - 18, en[i].y - 10, 36, 20, c2); rect(en[i].x - 6, en[i].y + 6, 12, 8, RGB(255, 220, 80)); } else { u16 cc = SHM ? shm_col(SHM[8 + en[i].ty * 8 + 5]) : c2; int zs = SHM ? SHM[8 + en[i].ty * 8 + 6] : 0, hw = zs == 2 ? 14 : zs == 1 ? 11 : 8; rect(en[i].x - hw, en[i].y - hw * 3 / 4, hw * 2, hw * 5 / 4, cc); rect(en[i].x - 3, en[i].y + hw / 2, 6, 4, RGB(255, 255, 255)); } }
    for (int k = 0; k < 16; k++) if (pb[k].on) rect(pb[k].x - 1, pb[k].y - 4, 3, 8, RGB(255, 255, 120));
    for (int k = 0; k < 32; k++) if (eb[k].on) disc(eb[k].x, eb[k].y, 3, RGB(255, 120, 60));
    if (!(inv & 4)) { rect(sx - 8, sy - 4, 16, 10, c1); rect(sx - 2, sy - 12, 4, 10, c1); rect(sx - 12, sy + 2, 24, 4, RGB(255, 255, 255)); }
}
/* ======================= breakout ======================= */
static int bx, by, bvx, bvy, pad, br[8][16], launched, bricks;
static const u8 *BRK;   /* BRKL design section: grid of brick hit points (kit NR.breakoutDesign) */
static void bo_init(void) { u32 zz; BRK = sec("BRKL", &zz); if (BRK && (zz < 4 || !BRK[0])) BRK = 0; lives = P[0]; score = 0; memset(br, 0, sizeof br); int rows = P[1] > 8 ? 8 : P[1] < 1 ? 5 : P[1], cols = P[2] > 16 ? 16 : P[2] < 2 ? 10 : P[2]; bricks = 0; if (BRK) { rows = BRK[1] > 8 ? 8 : BRK[1]; cols = BRK[2] > 16 ? 16 : BRK[2]; bricks = 0; for (int r = 0; r < rows; r++) for (int c = 0; c < cols; c++) { int v = BRK[4 + r * BRK[2] + c]; br[r][c] = v; if (v) bricks++; } } else for (int r = 0; r < rows; r++) for (int c = 0; c < cols; c++) { br[r][c] = 1; bricks++; } P[1] = rows; P[2] = cols; pad = 128; launched = 0; }
static void bo_step(void) {
    int w = P[4] < 16 ? 48 : P[4], sp = P[3] < 1 ? 3 : P[3];
    if (kh & KEY_LEFT) pad -= 4; if (kh & KEY_RIGHT) pad += 4; if (touched) pad = tx; if (pad < w / 2) pad = w / 2; if (pad > 256 - w / 2) pad = 256 - w / 2;
    if (!launched) { bx = pad; by = 170; if (kd & (KEY_A | KEY_UP)) { launched = 1; bvx = sp; bvy = -sp; beep(500, 4); } return; }
    bx += bvx; by += bvy; if (bx < 3 || bx > 253) { bvx = -bvx; bx += bvx; } if (by < 3) { bvy = -bvy; by = 3; }
    int cw = 256 / P[2]; if (by < 24 + P[1] * 10 && by > 20) { int c = bx / cw, r = (by - 24) / 10; if (r >= 0 && r < P[1] && c >= 0 && c < P[2] && br[r][c]) { br[r][c]--; bvy = -bvy; beep(700 + r * 80, 3); if (!br[r][c]) { score += 10; bricks--; if (!bricks) status = 1; } } }
    if (by > 176 && by < 186 && abs(bx - pad) < w / 2 + 3 && bvy > 0) { bvy = -bvy; bvx = (bx - pad) * sp / (w / 4); if (!bvx) bvx = 1; if (bvx > sp + 1) bvx = sp + 1; if (bvx < -sp - 1) bvx = -sp - 1; beep(400, 3); }
    if (by > 196) { lives--; launched = 0; thud(12); if (lives <= 0) status = 2; }
}
static void bo_draw(void) {
    clear(RGB(6, 8, 20)); int cw = 256 / P[2]; u16 cols[4] = { c2, RGB(245, 197, 66), c1, RGB(122, 232, 122) };
    for (int r = 0; r < P[1]; r++) for (int c = 0; c < P[2]; c++) if (br[r][c]) rect(c * cw + 1, 24 + r * 10, cw - 2, 8, cols[(BRK ? br[r][c] - 1 : r) & 3]);
    int w = P[4] < 16 ? 48 : P[4]; rect(pad - w / 2, 178, w, 6, c1); disc(bx, by, 3, RGB(255, 255, 255));
}
/* ======================= racing (pseudo-3D) ======================= */
static int rz, rx, rspd, rlap, rtime, rcars[16][2], rcrash;
#define TRACK 3000
static const u8 *RCD;   /* RACE design section (kit NR.raceDesign) */
static int curve_at0(int z); static int curve_at(int z) { if (RCD) { int n = RCD[1], tot = 0; for (int i = 0; i < n; i++) tot += RCD[8 + i * 2] * 50; if (tot <= 0) return 0; z %= tot; for (int i = 0; i < n; i++) { z -= RCD[8 + i * 2] * 50; if (z < 0) return (signed char)RCD[9 + i * 2]; } return 0; } return curve_at0(z); }
static int curve_at0(int z) { int a = (z / 150) % 12; static const int cv[12] = { 0, 0, 2, 4, 2, 0, 0, -2, -4, -2, 0, 3 }; return P[4] > 0 ? cv[a] * P[4] / 6 : 0; }
static void race_init(void) { u32 zz; RCD = sec("RACE", &zz); if (RCD && (zz < 10 || !RCD[0] || !RCD[1])) RCD = 0; rz = 0; rx = 0; rspd = 0; rlap = 0; rtime = (P[3] < 10 ? 90 : P[3]) * 60; rcrash = 0; score = 0; int n = P[1] < 1 ? 8 : P[1] > 16 ? 16 : P[1]; P[1] = n; for (int i = 0; i < 16; i++) { rcars[i][0] = 300 + i * (TRACK * 2 / 16) % TRACK; rcars[i][1] = (rnd(3) - 1) * 70; } }
static void race_step(void) {
    int mx = (P[2] < 40 ? 200 : P[2]); t++; rtime--; if (kh & KEY_UP) rspd += 2; else rspd -= 1; if (kh & KEY_DOWN) rspd -= 5; if (rspd < 0) rspd = 0; if (rspd > mx) rspd = mx;
    int c = curve_at(rz); if (kh & KEY_LEFT) rx -= 3 + rspd / 60; if (kh & KEY_RIGHT) rx += 3 + rspd / 60; rx -= c * rspd / 60; 
    if (rx < -130 || rx > 130) { if (rspd > 60) rspd -= 3; if (rx < -150) rx = -150; if (rx > 150) rx = 150; }
    rz += rspd / 12; score = rz / 10; if (rz >= TRACK) { rz -= TRACK; rlap++; beep(800, 8); for (int i = 0; i < P[1]; i++) rcars[i][0] = (rcars[i][0]) % TRACK; if (rlap >= P[0]) status = 1; }
    for (int i = 0; i < P[1]; i++) { rcars[i][0] += 5 + i % 3; if (rcars[i][0] >= TRACK) rcars[i][0] -= TRACK; int dz = (rcars[i][0] - rz + TRACK) % TRACK; if (dz < 20 && abs(rcars[i][1] - rx) < 50) { rspd /= 2; rz += 20 - dz; thud(8); } }
    if (rtime <= 0) status = 2;
}
static void race_draw(void) {
    for (int y = 0; y < 96; y++) { rect(0, y, 256, 1, RGB(60 + y, 120 + y / 2, 220)); }
    int curv = 0, off = 0;
    for (int y = 191; y >= 96; y--) { int d = y - 95; int z = rz + 4000 / d; off = rx * 3 / 2 * d / 96; curv += curve_at(z) * 3 / (d + 4);
        int rw = d * 2 + 12, cx = 128 - off / 2 + curv * (96 - d) / 8, band = (z / 40) & 1; rect(0, y, 256, 1, RCD ? (band ? RGB(RCD[4] * 3 / 4, RCD[5] * 3 / 4, RCD[6] * 3 / 4) : RGB(RCD[4], RCD[5], RCD[6])) : (band ? RGB(30, 150, 50) : RGB(40, 170, 60)));
        rect(cx - rw / 2 - 4, y, rw + 8, 1, band ? RGB(230, 40, 40) : RGB(240, 240, 240)); rect(cx - rw / 2, y, rw, 1, RGB(70, 70, 76));
        if (((z / 30) & 1) && d > 4) rect(cx - 1 - d / 40, y, 2 + d / 40, 1, RGB(230, 230, 230)); }
    for (int i = 0; i < P[1]; i++) { int dz = (rcars[i][0] - rz + TRACK) % TRACK; if (dz > 4 && dz < 400) { int d = 4000 / dz; int y = 95 + d; if (d > 96 || d < 2) continue; int s = d / 3 + 3, cx = 128 + (rcars[i][1] - rx) * d / 96; rect(cx - s, y - s, s * 2, s, i % 2 ? c2 : RGB(240, 200, 60)); rect(cx - s + 1, y - s - s / 2, s * 2 - 2, s / 2 + 1, RGB(40, 40, 50)); } }
    rect(110, 160, 36, 16, c1); rect(114, 152, 28, 10, c1); rect(112, 174, 8, 6, RGB(20, 20, 20)); rect(136, 174, 8, 6, RGB(20, 20, 20));
}
/* ======================= first-person shooter (raycaster) ======================= */
#define MAXN 25
static u8 fm[MAXN][MAXN]; static int fn, fx, fy, fa, fdir_t; typedef struct { int x, y, hp, on, t, flash; } Foe; static Foe foe[16]; typedef struct { int x, y, kind, on; } Pick; static Pick pk[12]; static int hitm, hurt, wallz[128], kills, fcount, sway, firet;
#define ONE 65536
static int cs(int a) { return cosLerp(a & 32767); } static int sn(int a) { return sinLerp(a & 32767); }
static int cell_at(int x, int y) { int cx = x >> 16, cy = y >> 16; if (cx < 0 || cy < 0 || cx >= fn || cy >= fn) return 1; return fm[cy][cx]; }
static void fps_design(const u8 *D) {   /* FPSL design section (kit NR.fpsDesign) */
    int n = D[1] > 24 ? 24 : D[1]; fn = n; P[0] = n; memset(fm, 1, sizeof fm); kills = 0; hurt = 0; hitm = 0; memset(foe, 0, sizeof foe); memset(pk, 0, sizeof pk); fcount = 0; int np = 0; fx = ONE * 3 / 2; fy = ONE * 3 / 2; fa = 0;
    for (int y = 0; y < n; y++) for (int x = 0; x < n; x++) { int c = D[8 + y * n + x]; fm[y][x] = c == 1; int cx = x * ONE + ONE / 2, cy = y * ONE + ONE / 2;
        if (c == 2 && fcount < 16) { foe[fcount] = (Foe){ cx, cy, 8, 1, rnd(60), 0 }; fcount++; } else if ((c == 3 || c == 4) && np < 12) { pk[np] = (Pick){ cx, cy, c == 3, 1 }; np++; } else if (c == 5) { fx = cx; fy = cy; } }
    hp = P[2] < 10 ? 100 : P[2]; ammo = P[3] < 4 ? 40 : P[3]; mag = 12; if (mag > ammo) mag = ammo; ammo -= mag; reload = 0; score = 0; P[1] = fcount;
}
static void fps_init(void) {
    u32 zz; const u8 *FD = sec("FPSL", &zz); if (FD && zz >= 8u + (u32)FD[1] * FD[1] && FD[0] && FD[1] >= 8) { fps_design(FD); return; }
    fn = (P[0] < 9 ? 15 : P[0] > 24 ? 23 : P[0]) | 1; P[0] = fn; memset(fm, 1, sizeof fm); kills = 0; hurt = 0; hitm = 0;
    int stack[MAXN * MAXN][2], sp = 0; fm[1][1] = 0; stack[sp][0] = 1; stack[sp][1] = 1; sp++;
    while (sp) { int x = stack[sp - 1][0], y = stack[sp - 1][1], d[4], nd = 0; static const int dx[4] = { 2, -2, 0, 0 }, dy[4] = { 0, 0, 2, -2 }; for (int k = 0; k < 4; k++) { int nx = x + dx[k], ny = y + dy[k]; if (nx > 0 && ny > 0 && nx < fn - 1 && ny < fn - 1 && fm[ny][nx]) d[nd++] = k; }
        if (!nd) { sp--; continue; } int k = d[rnd(nd)]; fm[y + dy[k] / 2][x + dx[k] / 2] = 0; fm[y + dy[k]][x + dx[k]] = 0; stack[sp][0] = x + dx[k]; stack[sp][1] = y + dy[k]; sp++; }
    for (int i = 0; i < fn * 2; i++) { int x = 1 + rnd(fn - 2), y = 1 + rnd(fn - 2); fm[y][x] = 0; }              /* knock out walls: rooms and loops */
    fx = ONE * 3 / 2; fy = ONE * 3 / 2; fa = 0; hp = P[2] < 10 ? 100 : P[2]; ammo = P[3] < 4 ? 40 : P[3]; mag = 12; if (mag > ammo) mag = ammo; ammo -= mag; reload = 0; score = 0;
    fcount = P[1] < 1 ? 6 : P[1] > 16 ? 16 : P[1]; memset(foe, 0, sizeof foe); for (int i = 0; i < fcount; i++) { int x, y, tries = 0; do { x = 1 + rnd(fn - 2); y = 1 + rnd(fn - 2); tries++; } while ((fm[y][x] || (x < 5 && y < 5)) && tries < 200); foe[i] = (Foe){ x * ONE + ONE / 2, y * ONE + ONE / 2, 8, 1, rnd(60), 0 }; }
    memset(pk, 0, sizeof pk); for (int i = 0; i < 8; i++) { int x, y, tries = 0; do { x = 1 + rnd(fn - 2); y = 1 + rnd(fn - 2); tries++; } while (fm[y][x] && tries < 200); pk[i] = (Pick){ x * ONE + ONE / 2, y * ONE + ONE / 2, i % 2, 1 }; }
}
static int los(int x0, int y0, int x1, int y1) { int dx = (x1 - x0) / 16, dy = (y1 - y0) / 16; for (int i = 1; i < 16; i++) if (cell_at(x0 + dx * i, y0 + dy * i)) return 0; return 1; }
static void fps_step(void) {
    t++; int tr = 90, mv = 0; if (touched == 1 && ty < 192 && ptx) { int d = tx - ptx; fa += d * 40; if (d == 0) {} }
    if (kh & KEY_LEFT) fa -= tr * 4; if (kh & KEY_RIGHT) fa += tr * 4;
    int c = cs(fa), s = sn(fa), spd = 5200; if (kh & KEY_UP) mv = 1; if (kh & KEY_DOWN) mv = -1;
    int nx = fx + (c * mv * spd >> 12) * 1, ny = fy + (s * mv * spd >> 12) * 1;
    if (kh & KEY_L) { nx += (s * spd >> 12); ny -= (c * spd >> 12); } if (kh & KEY_R) { nx -= (s * spd >> 12); ny += (c * spd >> 12); }
    if (!cell_at(nx + (nx > fx ? 12000 : -12000), fy)) fx = nx; if (!cell_at(fx, ny + (ny > fy ? 12000 : -12000))) fy = ny; if (mv || (kh & (KEY_L | KEY_R))) sway += 8;
    if (firet) firet--; if (reload) { reload--; if (!reload) { int n = 12 - mag; if (n > ammo) n = ammo; mag += n; ammo -= n; } }
    if (((kd & KEY_B) || (touched == 2 && tx > 200 && ty > 150)) && !reload && mag < 12 && ammo > 0) { reload = 50; beep(200, 8); }
    if ((kh & KEY_A) && !firet && !reload) { if (mag > 0) { mag--; firet = 8; beep(150, 3); thud(3); int best = -1, bd = 1 << 30;
            for (int i = 0; i < fcount; i++) if (foe[i].on) { int dx = foe[i].x - fx, dy = foe[i].y - fy, fwd = (dx >> 4) * (c >> 4) / 16 + (dy >> 4) * (s >> 4) / 16 , side = (dx >> 4) * (s >> 4) / 16 - (dy >> 4) * (c >> 4) / 16; fwd = (int)(((long long)dx * c + (long long)dy * s) >> 12); side = (int)(((long long)dx * s - (long long)dy * c) >> 12); if (fwd > 0 && abs(side) < ONE / 5 && fwd < bd && los(fx, fy, foe[i].x, foe[i].y)) { best = i; bd = fwd; } }
            if (best >= 0) { foe[best].hp -= P[4] < 1 ? 2 : P[4]; foe[best].flash = 4; hitm = 8; if (foe[best].hp <= 0) { foe[best].on = 0; kills++; score += 100; } } }
        else if (ammo > 0 && !reload) reload = 40; }
    int alive = 0; for (int i = 0; i < fcount; i++) if (foe[i].on) { Foe *f = &foe[i]; alive++; f->t++; if (f->flash) f->flash--; int dx = fx - f->x, dy = fy - f->y; int vis = los(f->x, f->y, fx, fy), d = abs(dx) + abs(dy);
        if (vis && d < ONE * 9) { int sx2 = dx > 0 ? 1 : -1, sy2 = dy > 0 ? 1 : -1; if (d > ONE * 2) { int mx = f->x + (abs(dx) > ONE / 4 ? sx2 * 900 : 0), my = f->y + (abs(dy) > ONE / 4 ? sy2 * 900 : 0); if (!cell_at(mx, f->y)) f->x = mx; if (!cell_at(f->x, my)) f->y = my; }
            if (f->t % 70 == 35) { if (rnd(100) < 55) { hp -= 6 + P[4]; hurt = 10; thud(6); } beep(110, 4); } } }
    for (int i = 0; i < 12; i++) if (pk[i].on && abs(pk[i].x - fx) < ONE / 3 && abs(pk[i].y - fy) < ONE / 3) { pk[i].on = 0; if (pk[i].kind) { hp += 25; if (hp > 100 + P[2]) hp = 100 + P[2]; } else ammo += 14; beep(1200, 4); }
    if (hurt) hurt--; if (hitm) hitm--; if (hp <= 0) status = 2; if (!alive) status = 1;
}
static void fps_draw(void) {
    for (int y = 0; y < 96; y++) rect(0, y, 256, 1, RGB(40 + y / 3, 44 + y / 3, 70 + y / 2)); for (int y = 96; y < 192; y++) rect(0, y, 256, 1, RGB(34 + (y - 96) / 4, 30 + (y - 96) / 4, 28 + (y - 96) / 5));
    int r1 = c1 & 31, g1 = (c1 >> 5) & 31, b1 = (c1 >> 10) & 31;
    for (int col = 0; col < 128; col++) { int off = (col - 64) * 42; int a = fa + off, c = cs(a), s = sn(a), x = fx, y = fy, steps = 0, side = 0; int px0 = x >> 16, py0 = y >> 16;
        while (steps < 380) { x += c; y += s; steps++; int cx2 = x >> 16, cy2 = y >> 16; if (cx2 < 0 || cy2 < 0 || cx2 >= fn || cy2 >= fn || fm[cy2][cx2]) { side = (cx2 != px0); break; } px0 = cx2; py0 = cy2; }
        int perp = (int)(((long long)steps * 4096 * cs(off)) >> 12); if (perp < 12000) perp = 12000; wallz[col] = perp;
        int h = (int)(((long long)192 * 65536 * 5 / 4) / perp); if (h > 192) h = 192; int sh = 31 - perp / 36000; if (sh < 6) sh = 6; if (side) sh = sh * 3 / 4;
        u16 wc = RGB15(r1 * sh / 31, g1 * sh / 31, b1 * sh / 31) | BIT(15); int y0 = 96 - h / 2; rect(col * 2, y0, 2, h, wc); if (h > 8) rect(col * 2, y0, 2, 1, RGB15(r1 * sh / 40, g1 * sh / 40, b1 * sh / 40) | BIT(15)); }
    /* sprites (back to front) */
    int order[28], n = 0, dd[28]; for (int i = 0; i < fcount; i++) if (foe[i].on) { order[n] = i; dd[n] = abs(foe[i].x - fx) + abs(foe[i].y - fy); n++; } for (int i = 0; i < 12; i++) if (pk[i].on) { order[n] = 100 + i; dd[n] = abs(pk[i].x - fx) + abs(pk[i].y - fy); n++; }
    for (int i = 0; i < n; i++) for (int j = i + 1; j < n; j++) if (dd[j] > dd[i]) { int q = dd[i]; dd[i] = dd[j]; dd[j] = q; q = order[i]; order[i] = order[j]; order[j] = q; }
    int c = cs(fa), s = sn(fa);
    for (int k = 0; k < n; k++) { int id = order[k], ex = id >= 100 ? pk[id - 100].x : foe[id].x, ey = id >= 100 ? pk[id - 100].y : foe[id].y; int dx = ex - fx, dy = ey - fy; int fwd = (int)(((long long)dx * c + (long long)dy * s) >> 12), side = (int)(((long long)dx * s - (long long)dy * c) >> 12);
        if (fwd < 8000) continue; int scrx = 128 + (int)(((long long)side * 222) / fwd * 1) * 1; int hh = (int)(((long long)192 * 65536 * 2 / 3) / fwd); if (hh > 220) hh = 220; int ww = hh / 3, colx = scrx / 2; if (colx < 0 || colx > 127) { if (colx + ww / 4 < 0 || colx - ww / 4 > 127) continue; }
        int gy = 96 + hh / 4; if (id >= 100) { int sz = hh / 4 + 2; int ok = 0; for (int q = -sz / 4; q <= sz / 4; q++) { int cc = (scrx + q * 2) / 2; if (cc >= 0 && cc < 128 && wallz[cc] > fwd) ok = 1; } if (ok) { u16 cc2 = pk[id - 100].kind ? RGB(80, 230, 90) : RGB(240, 200, 60); rect(scrx - sz / 2, gy - sz, sz, sz, cc2); rect(scrx - sz / 2 + sz / 4, gy - sz + sz / 4, sz / 2, sz / 2, RGB(255, 255, 255)); } continue; }
        Foe *f = &foe[id]; u16 body = f->flash ? RGB(255, 255, 255) : c2, dark = RGB(30, 30, 36), skin = RGB(230, 190, 150);
        for (int q = -ww / 2; q <= ww / 2; q++) { int cc = (scrx + q) / 2; if (cc < 0 || cc > 127 || wallz[cc] <= fwd) continue; int xx = scrx + q;
            rect(xx, gy - hh / 2, 1, hh / 2 + hh / 4 - hh / 10, abs(q) < ww / 4 ? dark : body); rect(xx, gy - hh / 2 - hh / 5, 1, hh / 5, abs(q) < ww / 5 ? skin : (abs(q) < ww / 3 ? dark : 0 + body)); if (abs(q) < ww / 3 && q % 2 == 0) { } }
        if (hh > 20) { rect(scrx + ww / 3, gy - hh / 3, ww / 3 + 2, 2, dark); } }
    /* weapon + effects */
    int bob = (sn(sway * 300) >> 9); int fl = firet > 5; rect(150, 150 + bob + (fl ? 3 : 0), 40, 42, RGB(50, 52, 58)); rect(146, 140 + bob + (fl ? 3 : 0), 14, 20, RGB(40, 42, 48)); rect(154, 144 + bob, 6, 8, RGB(90, 92, 100)); if (fl) { disc(153, 132 + bob, 9, RGB(255, 230, 120)); disc(153, 132 + bob, 5, RGB(255, 255, 255)); }
    rect(127, 91, 3, 11, RGB(255, 255, 255)); rect(122, 96, 13, 1, RGB(255, 255, 255)); if (hitm) { rect(118, 87, 4, 1, RGB(255, 60, 60)); rect(135, 87, 4, 1, RGB(255, 60, 60)); rect(118, 105, 4, 1, RGB(255, 60, 60)); rect(135, 105, 4, 1, RGB(255, 60, 60)); }
    if (hurt) for (int i = 0; i < 192; i += 2) { rect(0, i, 6, 1, RGB(200, 0, 0)); rect(250, i, 6, 1, RGB(200, 0, 0)); } if (hurt) { rect(0, 0, 256, 4, RGB(200, 0, 0)); rect(0, 188, 256, 4, RGB(200, 0, 0)); }
    char b[32]; sprintf(b, "%d/%d", mag, ammo); text(204, 176, b, RGB(255, 255, 255)); if (reload) text(100, 120, "RELOADING", RGB(255, 220, 80));
    rect(6, 180, 70, 6, RGB(60, 20, 20)); rect(6, 180, hp > 0 ? (hp > 100 ? 70 : hp * 70 / 100) : 0, 6, RGB(80, 220, 90)); sprintf(b, "%d", kills); text(6, 6, b, RGB(255, 255, 255));
}
/* ======================= brawler ======================= */
typedef struct { int x, y, hp, on, t, dir, hit, ty; } Bro; static Bro bro[8], boss_b; static const u8 *BRW;   /* BRWL design section (kit NR.brawlerDesign) */ static int bpx, bpy, bpd, bphp, batk, batk_t, bwave, bspawn, bboss, binv;
static void br_init(void) { u32 zz; BRW = sec("BRWL", &zz); if (BRW && (zz < 48 || !BRW[0] || !BRW[2])) BRW = 0; lives = P[0] < 1 ? 3 : P[0]; bphp = 10; bpx = 60; bpy = 150; bpd = 1; batk = 0; bwave = 0; bspawn = 0; memset(bro, 0, sizeof bro); score = 0; bboss = 0; binv = 0; }
static void br_step(void) {
    t++; if (batk_t) batk_t--; if (binv) binv--; int ehp = P[2] < 1 ? 3 : P[2];
    if (kh & KEY_LEFT) { bpx -= 2; bpd = -1; } if (kh & KEY_RIGHT) { bpx += 2; bpd = 1; } if (kh & KEY_UP) bpy -= 2; if (kh & KEY_DOWN) bpy += 2; if (bpx < 10) bpx = 10; if (bpx > 246) bpx = 246; if (bpy < 120) bpy = 120; if (bpy > 180) bpy = 180;
    int dmg = 0; if (!batk_t && (kd & KEY_A)) { batk = 1; batk_t = 14; dmg = 1; beep(300, 3); } if (!batk_t && (kd & KEY_B)) { batk = 2; batk_t = 22; dmg = 2; beep(200, 4); }
    int alive = 0; for (int i = 0; i < 8; i++) if (bro[i].on) { Bro *e = &bro[i]; alive++; e->t++; if (e->hit) e->hit--; int dx = bpx - e->x, dy = bpy - e->y;
        if (abs(dx) > 22) { int sp = (BRW && !(bboss && i == 0)) ? BRW[9 + e->ty * 6] : 4; if ((e->t * sp) % 4 < sp || sp >= 4) e->x += dx > 0 ? (sp > 4 && (e->t & 1) ? 2 : 1) : (sp > 4 && (e->t & 1) ? -2 : -1); } if (abs(dy) > 4) e->y += dy > 0 ? 1 : -1; e->dir = dx > 0 ? 1 : -1;
        if (abs(dx) < 26 && abs(dy) < 10 && e->t % 60 == 30 && !binv) { bphp -= (i == 0 && bboss) ? (BRW ? BRW[4] : 2) : (BRW ? BRW[10 + e->ty * 6] : 1); binv = 30; thud(5); if (bphp <= 0) { lives--; bphp = 10; bpx = 60; if (lives <= 0) status = 2; } }
        if (dmg && (bpd > 0 ? dx * -1 < 0 : dx > 0) == 0 && abs(e->x - bpx) < 34 && abs(e->y - bpy) < 14) {}
        if (dmg && abs(e->x - bpx) < 34 && abs(e->y - bpy) < 14 && ((bpd > 0 && e->x >= bpx - 4) || (bpd < 0 && e->x <= bpx + 4))) { e->hp -= dmg; e->hit = 8; e->x += bpd * 8; thud(3); if (e->hp <= 0) { e->on = 0; score += (i == 0 && bboss) ? 300 : (BRW ? BRW[11 + e->ty * 6] * 10 : 40); } } }
    if (!alive) { if (bboss) { status = 1; } else if (bwave >= (BRW ? BRW[2] : (P[1] < 1 ? 4 : P[1]))) { if (P[3]) { bboss = 1; bro[0] = (Bro){ 220, 150, BRW ? BRW[3] : 18, 1, 0, -1, 0, 0 }; } else status = 1; }
        else if (BRW && ++bspawn > 40) { bspawn = 0; const u8 *w = BRW + 40 + bwave * 3; int ty = w[0] < BRW[1] ? w[0] : 0, n = w[1] > 8 ? 8 : w[1]; for (int i = 0; i < n; i++) { int left = w[2] == 1 || (w[2] == 2 && (i & 1)); bro[i] = (Bro){ left ? -20 - i * 10 : 270 + i * 10, 125 + (i * 17) % 55, BRW[8 + ty * 6], 1, i * 11, left ? 1 : -1, 0, ty }; } bwave++; } else if (++bspawn > 40) { bspawn = 0; int n = 2 + bwave; if (n > 6) n = 6; for (int i = 0; i < n; i++) bro[i] = (Bro){ (i & 1) ? 270 + i * 10 : -20 - i * 10, 125 + (i * 17) % 55, ehp, 1, i * 11, 1, 0 }; bwave++; } }
}
static void person(int x, int y, int dir, u16 body, u16 head, int atk, int big) { int s = big ? 2 : 1; rect(x - 5 * s, y - 24 * s, 10 * s, 14 * s, body); rect(x - 4 * s, y - 34 * s, 8 * s, 10 * s, head); rect(x - 5 * s, y - 10 * s, 4 * s, 10 * s, RGB(40, 40, 60)); rect(x + s, y - 10 * s, 4 * s, 10 * s, RGB(40, 40, 60)); if (atk) rect(x + dir * 6 * s, y - 20 * s, dir * 14 * s + (dir < 0 ? 0 : 0), 4 * s, head); }
static void br_draw(void) {
    clear(RGB(40, 30, 60)); rect(0, 110, 256, 82, RGB(70, 60, 80)); for (int i = 0; i < 8; i++) rect(i * 40 + 6, 40, 20, 50, RGB(70, 90, 140)); rect(0, 108, 256, 4, RGB(130, 110, 150));
    int ord[9], n = 0; for (int i = 0; i < 8; i++) if (bro[i].on) ord[n++] = i; ord[n++] = 99; for (int i = 0; i < n; i++) for (int j = i + 1; j < n; j++) { int yi = ord[i] == 99 ? bpy : bro[ord[i]].y, yj = ord[j] == 99 ? bpy : bro[ord[j]].y; if (yj < yi) { int q = ord[i]; ord[i] = ord[j]; ord[j] = q; } }
    for (int k = 0; k < n; k++) { if (ord[k] == 99) { if (!(binv & 4)) { rect(bpx - 8, bpy + 1, 16, 3, RGB(20, 20, 30)); person(bpx, bpy, bpd, c1, RGB(240, 200, 160), batk_t > 6, 0); } } else { Bro *e = &bro[ord[k]]; rect(e->x - 8, e->y + 1, 16, 3, RGB(20, 20, 30)); person(e->x, e->y, e->dir, e->hit ? RGB(255, 255, 255) : (BRW && !(ord[k] == 0 && bboss) ? shm_col(BRW[12 + e->ty * 6]) : c2), RGB(220, 170, 140), 0, ord[k] == 0 && bboss); } }
    for (int i = 0; i < bphp; i++) rect(8 + i * 8, 8, 6, 6, RGB(80, 220, 90));
}
/* ======================= falling blocks ======================= */
static u8 fb2[24][14]; static int fw, fh, px2, py2, pr, ptype, nxt, ftimer, flines, fspeed; static const u16 SHP[7][4] = { { 0x0F00, 0x2222, 0x00F0, 0x4444 }, { 0x8E00, 0x6440, 0x0E20, 0x44C0 }, { 0x2E00, 0x4460, 0x0E80, 0xC440 }, { 0x6600, 0x6600, 0x6600, 0x6600 }, { 0x6C00, 0x4620, 0x06C0, 0x8C40 }, { 0x4E00, 0x4640, 0x0E40, 0x4C40 }, { 0xC600, 0x2640, 0x0C60, 0x4C80 } };
static int fcell(int type, int r, int x, int y) { return (SHP[type][r & 3] >> (15 - (y * 4 + x))) & 1; }
static int fit(int type, int r, int ox, int oy) { for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) if (fcell(type, r, x, y)) { int gx = ox + x, gy = oy + y; if (gx < 0 || gx >= fw || gy >= fh) return 0; if (gy >= 0 && fb2[gy][gx]) return 0; } return 1; }
static void fall_spawn(void) { ptype = nxt; nxt = rnd(7); pr = 0; px2 = fw / 2 - 2; py2 = -1; if (!fit(ptype, pr, px2, py2)) status = 2; }
static void fall_init(void) { fw = P[0] < 6 ? 10 : P[0] > 14 ? 14 : P[0]; fh = P[1] < 10 ? 18 : P[1] > 22 ? 22 : P[1]; fspeed = P[2] < 6 ? 30 : P[2]; flines = 0; score = 0; memset(fb2, 0, sizeof fb2); nxt = rnd(7); fall_spawn(); ftimer = 0; }
static void fall_step(void) {
    if ((kd & KEY_LEFT) && fit(ptype, pr, px2 - 1, py2)) px2--; if ((kd & KEY_RIGHT) && fit(ptype, pr, px2 + 1, py2)) px2++; if ((kd & KEY_UP) && fit(ptype, pr + 1, px2, py2)) { pr++; beep(600, 2); } if ((kd & KEY_UP) == 0 && (kd & KEY_A) && fit(ptype, pr + 1, px2, py2)) pr++;
    int sp = fspeed - flines * 2; if (sp < 4) sp = 4; if (kh & KEY_DOWN) sp = 2; if (++ftimer >= sp) { ftimer = 0; if (fit(ptype, pr, px2, py2 + 1)) py2++; else { for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) if (fcell(ptype, pr, x, y) && py2 + y >= 0) fb2[py2 + y][px2 + x] = ptype + 1; thud(4); int cl = 0; for (int y = fh - 1; y >= 0; y--) { int full = 1; for (int x = 0; x < fw; x++) if (!fb2[y][x]) full = 0; if (full) { cl++; for (int k = y; k > 0; k--) memcpy(fb2[k], fb2[k - 1], 14); memset(fb2[0], 0, 14); y++; } } if (cl) { flines += cl; score += cl * cl * 100; beep(900, 6); if (flines >= (P[3] < 1 ? 20 : P[3])) status = 1; } fall_spawn(); } }
}
static void fall_draw(void) {
    clear(RGB(8, 8, 20)); int cs2 = 10, ox = (256 - fw * cs2) / 2, oy = 6; frame_rect(ox - 2, oy - 2, fw * cs2 + 4, fh * cs2 + 4, c1); u16 pc[8] = { 0, RGB(74, 232, 255), RGB(74, 100, 232), RGB(245, 138, 66), RGB(245, 197, 66), RGB(122, 232, 122), RGB(176, 74, 232), RGB(232, 74, 74) };
    for (int y = 0; y < fh; y++) for (int x = 0; x < fw; x++) if (fb2[y][x]) rect(ox + x * cs2, oy + y * cs2, cs2 - 1, cs2 - 1, pc[fb2[y][x]]);
    for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) if (fcell(ptype, pr, x, y) && py2 + y >= 0) rect(ox + (px2 + x) * cs2, oy + (py2 + y) * cs2, cs2 - 1, cs2 - 1, pc[ptype + 1]);
    for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) if (fcell(nxt, 0, x, y)) rect(ox + fw * cs2 + 14 + x * 8, 30 + y * 8, 7, 7, pc[nxt + 1]); text(ox + fw * cs2 + 10, 14, "NEXT", RGB(200, 200, 220));
}
/* ======================= memory ======================= */
static int mcards[32], mup[32], mfound[32], mn, mcols, mcur, mfirst, msecond, mwait, mtries;
static void mem_init(void) { mn = (P[0] < 2 ? 8 : P[0] > 16 ? 16 : P[0]) * 2; mcols = P[1] < 2 ? 4 : P[1] > 8 ? 8 : P[1]; mtries = P[2] < 3 ? 20 : P[2]; for (int i = 0; i < mn; i++) mcards[i] = i / 2; for (int i = mn - 1; i > 0; i--) { int j = rnd(i + 1), q = mcards[i]; mcards[i] = mcards[j]; mcards[j] = q; } memset(mup, 0, sizeof mup); memset(mfound, 0, sizeof mfound); mcur = 0; mfirst = msecond = -1; mwait = 0; score = 0; }
static void mem_flip(int i) { if (mwait || mfound[i] || mup[i]) return; mup[i] = 1; beep(500 + mcards[i] * 40, 3); if (mfirst < 0) mfirst = i; else { msecond = i; mtries--; mwait = 45; } }
static void mem_step(void) {
    if (kd & KEY_LEFT) mcur = (mcur + mn - 1) % mn; if (kd & KEY_RIGHT) mcur = (mcur + 1) % mn; if ((kd & KEY_UP) && mcur >= mcols) mcur -= mcols; if ((kd & KEY_DOWN) && mcur + mcols < mn) mcur += mcols; if (kd & KEY_A) mem_flip(mcur);
    int rows = (mn + mcols - 1) / mcols, cw = 256 / mcols > 48 ? 48 : 256 / mcols, ch = 150 / rows > 48 ? 48 : 150 / rows, ox = (256 - cw * mcols) / 2, oy = 20; if (touched == 2) { int c = (tx - ox) / cw, r = (ty - oy) / ch; if (tx >= ox && ty >= oy && c < mcols && r < rows && r * mcols + c < mn) { mcur = r * mcols + c; mem_flip(mcur); } }
    if (mwait && --mwait == 0) { if (mcards[mfirst] == mcards[msecond]) { mfound[mfirst] = mfound[msecond] = 1; score += 100; beep(1000, 6); int all = 1; for (int i = 0; i < mn; i++) if (!mfound[i]) all = 0; if (all) status = 1; } else { mup[mfirst] = mup[msecond] = 0; thud(4); } mfirst = msecond = -1; if (mtries <= 0 && status == 0) status = 2; }
}
static void sym(int x, int y, int k, int s, u16 c) { int cx = x + s / 2, cy = y + s / 2, r = s / 3; switch (k % 8) { case 0: disc(cx, cy, r, c); break; case 1: rect(cx - r, cy - r, 2 * r, 2 * r, c); break; case 2: for (int i = -r; i <= r; i++) rect(cx - (r - abs(i)), cy + i, 2 * (r - abs(i)) + 1, 1, c); break; case 3: rect(cx - r, cy - 2, 2 * r, 4, c); rect(cx - 2, cy - r, 4, 2 * r, c); break; case 4: for (int i = -r; i <= r; i++) rect(cx - (r - i) / 2, cy + i, r - i + 1, 1, c); break; case 5: disc(cx, cy, r, c); disc(cx, cy, r / 2, 0x0000 | BIT(15)); break; case 6: rect(cx - r, cy - r, 2 * r, 3, c); rect(cx - r, cy + r - 3, 2 * r, 3, c); break; default: for (int i = -r; i <= r; i++) { px(cx + i, cy + i, c); px(cx + i, cy - i, c); px(cx + i + 1, cy + i, c); px(cx + i + 1, cy - i, c); } } }
static void mem_draw(void) {
    clear(RGB(10, 24, 18)); int rows = (mn + mcols - 1) / mcols, cw = 256 / mcols > 48 ? 48 : 256 / mcols, ch = 150 / rows > 48 ? 48 : 150 / rows, ox = (256 - cw * mcols) / 2, oy = 20; u16 pc[8] = { RGB(232, 74, 74), RGB(74, 155, 232), RGB(245, 197, 66), RGB(122, 232, 122), RGB(176, 74, 232), RGB(255, 140, 60), RGB(240, 240, 240), RGB(74, 232, 255) };
    for (int i = 0; i < mn; i++) { int x = ox + (i % mcols) * cw, y = oy + (i / mcols) * ch; if (mfound[i]) { rect(x + 2, y + 2, cw - 4, ch - 4, RGB(20, 60, 40)); sym(x, y, mcards[i], cw < ch ? cw : ch, pc[mcards[i] % 8]); } else if (mup[i]) { rect(x + 2, y + 2, cw - 4, ch - 4, RGB(240, 240, 230)); sym(x, y, mcards[i], cw < ch ? cw : ch, pc[mcards[i] % 8]); } else { rect(x + 2, y + 2, cw - 4, ch - 4, c1); frame_rect(x + 5, y + 5, cw - 10, ch - 10, RGB(255, 255, 255)); } if (i == mcur) frame_rect(x, y, cw, ch, RGB(255, 255, 80)); }
}
/* ======================= city builder ======================= */
static u8 city[16][20]; static int cw2, chh, ccash, cpop, ccap, csel, ccx, ccy, ctick, cincome; static const int BCOST[5] = { 0, 100, 150, 120, 80 }, BNAME_N = 5;
static void sim_init(void) { cw2 = P[0] < 6 ? 16 : P[0] > 20 ? 20 : P[0]; chh = P[1] < 5 ? 12 : P[1] > 14 ? 14 : P[1]; ccash = P[2] < 50 ? 600 : P[2]; memset(city, 0, sizeof city); cpop = 0; ccap = 0; csel = 1; ccx = cw2 / 2; ccy = chh / 2; ctick = 0; score = 0; }
static void sim_build(int x, int y) { if (x < 0 || y < 0 || x >= cw2 || y >= chh) return; if (city[y][x]) { city[y][x] = 0; ccash += 30; thud(3); return; } if (ccash >= BCOST[csel]) { ccash -= BCOST[csel]; city[y][x] = csel; beep(700, 3); } }
static void sim_step(void) {
    if (kd & KEY_LEFT) ccx--; if (kd & KEY_RIGHT) ccx++; if (kd & KEY_UP) ccy--; if (kd & KEY_DOWN) ccy++; if (ccx < 0) ccx = 0; if (ccy < 0) ccy = 0; if (ccx >= cw2) ccx = cw2 - 1; if (ccy >= chh) ccy = chh - 1;
    if (kd & KEY_A) sim_build(ccx, ccy); if (kd & KEY_B) csel = csel % 4 + 1;
    if (touched == 2) { if (ty < 160 && tx < cw2 * 12 + 8 && ty > 8) { ccx = (tx - 8) / 12; ccy = (ty - 8) / 12; sim_build(ccx, ccy); } }
    int houses = 0, farms = 0, shops = 0, parks = 0; for (int y = 0; y < chh; y++) for (int x = 0; x < cw2; x++) switch (city[y][x]) { case 1: houses++; break; case 2: farms++; break; case 3: shops++; break; case 4: parks++; break; }
    ccap = houses * 6 + parks * 1; cincome = farms * 4 + (shops < cpop / 4 + 1 ? shops : cpop / 4 + 1) * 5 + cpop / 10;
    if (++ctick >= 60) { ctick = 0; ccash += cincome; if (cpop < ccap && farms * 8 + 4 > cpop) cpop += 1 + houses / 4; if (cpop > ccap) cpop--; if (cpop > farms * 8 + 12 + shops) cpop--; score = cpop; if (cpop >= (P[3] < 10 ? 120 : P[3])) status = 1; }
}
static void sim_draw(void) {
    clear(RGB(60, 140, 70)); for (int y = 0; y < chh; y++) for (int x = 0; x < cw2; x++) { int X = 8 + x * 12, Y = 8 + y * 12; rect(X, Y, 11, 11, ((x + y) & 1) ? RGB(70, 160, 80) : RGB(64, 150, 74));
        switch (city[y][x]) { case 1: rect(X + 1, Y + 4, 9, 7, RGB(232, 200, 150)); rect(X, Y + 2, 11, 3, c2); break; case 2: rect(X + 1, Y + 1, 9, 9, RGB(220, 190, 80)); for (int i = 2; i < 10; i += 3) rect(X + 1, Y + i, 9, 1, RGB(160, 130, 40)); break; case 3: rect(X + 1, Y + 3, 9, 8, c1); rect(X + 2, Y + 5, 3, 3, RGB(255, 255, 255)); break; case 4: disc(X + 5, Y + 5, 4, RGB(30, 110, 50)); rect(X + 4, Y + 5, 2, 5, RGB(100, 70, 40)); } }
    frame_rect(8 + ccx * 12 - 1, 8 + ccy * 12 - 1, 13, 13, RGB(255, 255, 80));
}
/* ======================= paint by number ======================= */
static const char *PIC[3][12] = { { "............", "....1111....", "...111111...", "..11111111..", ".1111111111.", "222222222222", ".2333223332.", ".2333223332.", ".2222222222.", ".2222442222.", ".2222442222.", "555555555555" }, { "............", "...66..66...", "..6666666...", "..6616616...", "..6666666...", "...66336....", "....666.....", "..666666....", ".66666666...", ".66.66.66...", "............", "............" }, { "............", "......1.....", ".....111....", "....11111...", "...1111111..", "..111111111.", "......2.....", "......2.....", "..444.2.444.", ".44444244444", "555555555555", "555555555555" } };
static int pgrid[12][12], pcol, pcx, pcy, pdone, pidx;
static const u16 PAL6[7] = { 0, RGB15(8, 12, 31) | BIT(15), RGB15(31, 24, 12) | BIT(15), RGB15(31, 31, 31) | BIT(15), RGB15(14, 8, 3) | BIT(15), RGB15(6, 22, 8) | BIT(15), RGB15(25, 8, 8) | BIT(15) };
static void paint_init(void) { memset(pgrid, 0, sizeof pgrid); pcol = 1; pcx = pcy = 0; pidx = P[0] % 3; score = 0; }
static int ptarget(int x, int y) { char c = PIC[pidx][y][x]; return c == '.' ? 0 : c - '0'; }
static void paint_step(void) {
    if (kd & KEY_LEFT) pcx--; if (kd & KEY_RIGHT) pcx++; if (kd & KEY_UP) pcy--; if (kd & KEY_DOWN) pcy++; if (pcx < 0) pcx = 0; if (pcy < 0) pcy = 0; if (pcx > 11) pcx = 11; if (pcy > 11) pcy = 11; if (kd & KEY_B) pcol = pcol % 6 + 1;
    if (kd & KEY_A) { pgrid[pcy][pcx] = pcol; beep(600 + pcol * 50, 2); }
    if (touched) { int x = (tx - 20) / 14, y = (ty - 6) / 14; if (tx >= 20 && ty >= 6 && x < 12 && y < 12) { pcx = x; pcy = y; if (touched == 2 || kh & KEY_TOUCH) pgrid[y][x] = pcol; } if (touched == 2 && tx > 200) pcol = 1 + (ty / 28) % 6; }
    int ok = 0, tot = 0; for (int y = 0; y < 12; y++) for (int x = 0; x < 12; x++) { int g = ptarget(x, y); if (g) { tot++; if (pgrid[y][x] == g) ok++; } else if (pgrid[y][x]) ok--; } score = ok * 100 / (tot ? tot : 1); if (ok == tot) status = 1;
}
static void paint_draw(void) {
    clear(RGB(30, 30, 40)); for (int y = 0; y < 12; y++) for (int x = 0; x < 12; x++) { int X = 20 + x * 14, Y = 6 + y * 14; rect(X, Y, 13, 13, pgrid[y][x] ? PAL6[pgrid[y][x]] : RGB(60, 60, 70)); int g = ptarget(x, y); if (g && pgrid[y][x] != g) { char b[2] = { (char)('0' + g), 0 }; text(X + 3, Y + 3, b, RGB(230, 230, 240)); } }
    frame_rect(20 + pcx * 14 - 1, 6 + pcy * 14 - 1, 15, 15, RGB(255, 255, 80)); for (int i = 1; i <= 6; i++) { rect(214, (i - 1) * 28 + 6, 30, 24, PAL6[i]); char b[2] = { (char)('0' + i), 0 }; text(226, (i - 1) * 28 + 14, b, RGB(255, 255, 255)); if (i == pcol) frame_rect(212, (i - 1) * 28 + 4, 34, 28, RGB(255, 255, 80)); }
}
/* ======================= hoops ======================= */
static int hmeter, hdir, hx, hball, hpath_t, hshot, hgoal, hsec, hhit, hmiss, hmsg_t; static int hsx, hsy, hsvx;
static void hoops_init(void) { hmeter = 0; hdir = 1; hx = 60; hball = 0; hshot = 0; hsec = (P[0] < 10 ? 60 : P[0]) * 60; hgoal = P[1] < 1 ? 12 : P[1]; score = 0; hhit = 0; }
static void hoops_step(void) {
    t++; hsec--; int sp = P[2] < 5 ? 22 : P[2] > 60 ? 60 : P[2]; if (!hball) { hmeter += hdir * sp / 10 * 1; if (hmeter > 100) { hmeter = 100; hdir = -1; } if (hmeter < 0) { hmeter = 0; hdir = 1; } } if (kh & KEY_LEFT) hx -= 2; if (kh & KEY_RIGHT) hx += 2; if (hx < 20) hx = 20; if (hx > 130) hx = 130;
    if (!hball && ((kd & KEY_A) || touched == 2)) { int dist = 200 - hx; int zone = 12 - dist / 20; if (zone < 5) zone = 5; hshot = abs(hmeter - 62) <= zone; hball = 1; hpath_t = 0; beep(500, 3); }
    if (hball) { hpath_t++; if (hpath_t == 40) { hball = 0; if (hshot) { score++; hhit = 20; beep(1000, 8); } else { thud(6); hmiss = 20; } if (score >= hgoal) status = 1; } }
    if (hhit) hhit--; if (hmiss) hmiss--; if (hsec <= 0 && status == 0) status = 2;
}
static void hoops_draw(void) {
    clear(RGB(30, 40, 80)); rect(0, 150, 256, 42, RGB(190, 130, 70)); rect(0, 150, 256, 3, RGB(240, 220, 200)); rect(206, 56, 6, 100, RGB(200, 200, 210)); rect(212, 60, 28, 28, RGB(240, 240, 250)); frame_rect(212, 60, 28, 28, c2); rect(204, 92, 22, 3, c2); for (int i = 0; i < 5; i++) rect(205 + i * 4, 95, 1, 9, RGB(240, 240, 240));
    rect(hx - 5, 120, 10, 24, c1); disc(hx, 114, 6, RGB(240, 200, 160)); if (hhit) text(100, 40, "SWISH!", RGB(255, 255, 120)); if (hmiss) text(100, 40, "MISS", RGB(255, 120, 120));
    int bx2 = hx + 8, by2 = 114; if (hball) { int p = hpath_t; bx2 = hx + 8 + (206 - hx) * p / 40; by2 = 110 - (p * (40 - p)) / 6; if (!hshot && p > 30) bx2 += (p - 30) * 2; } disc(bx2, by2, 5, RGB(245, 138, 66)); rect(bx2 - 5, by2, 10, 1, RGB(100, 50, 20));
    rect(20, 176, 100, 8, RGB(40, 40, 60)); int dist = 200 - hx, zone = 12 - dist / 20; if (zone < 5) zone = 5; rect(20 + 62 - zone, 176, zone * 2, 8, RGB(80, 220, 90)); rect(20 + hmeter, 174, 3, 12, RGB(255, 255, 255));
}
/* ======================= music maker (step sequencer) ======================= */
static u8 mg[8][16]; static int mstep, mplay, mtempo, mtick, mcx, mcy; static const int SEQ_HZ[8] = { 1047, 880, 784, 659, 587, 523, 440, 392 };
static void music_init(void) { memset(mg, 0, sizeof mg); mstep = 0; mplay = 0; mtempo = P[0] < 60 ? 120 : P[0]; mtick = 0; mcx = 0; mcy = 0; static const u8 demo[16] = { 5, 7, 4, 7, 5, 7, 3, 7, 5, 7, 4, 7, 2, 7, 3, 7 }; for (int i = 0; i < 16; i++) if (demo[i] != 7) mg[demo[i]][i] = 1; }
static void music_step(void) {
    t++; if (kd & KEY_START) { mplay = !mplay; mtick = 0; } if (kd & KEY_R) mtempo += 10; if (kd & KEY_L) mtempo -= 10; if (mtempo < 60) mtempo = 60; if (mtempo > 240) mtempo = 240;
    if (kd & KEY_LEFT) mcx = (mcx + 15) & 15; if (kd & KEY_RIGHT) mcx = (mcx + 1) & 15; if (kd & KEY_UP) mcy = (mcy + 7) & 7; if (kd & KEY_DOWN) mcy = (mcy + 1) & 7; if (kd & KEY_A) { mg[mcy][mcx] ^= 1; beep(SEQ_HZ[mcy], 6); }
    if (touched == 2 || (touched == 1 && tx != ptx)) { int c = (tx - 8) / 15, r = (ty - 34) / 17; if (tx >= 8 && ty >= 34 && c < 16 && r < 8) { mcx = c; mcy = r; if (touched == 2) { mg[r][c] ^= 1; beep(SEQ_HZ[r], 6); } } }
    if (mplay) { int per = 3600 / (mtempo * 2); if (per < 4) per = 4; if (++mtick >= per) { mtick = 0; mstep = (mstep + 1) & 15; for (int r = 0; r < 8; r++) if (mg[r][mstep]) beep(SEQ_HZ[r], per - 1); } }
}
static void music_draw(void) {
    clear(RGB(10, 8, 24)); u16 pc[8] = { RGB(255, 90, 90), RGB(255, 150, 70), RGB(255, 220, 80), RGB(130, 230, 110), RGB(80, 220, 220), RGB(100, 140, 255), RGB(180, 110, 255), RGB(255, 120, 200) };
    for (int i = 0; i < 16; i++) { int h = 4; for (int r = 0; r < 8; r++) if (mg[r][i]) h += 14; rect(8 + i * 15, 150 - h, 12, h, mplay && i == mstep ? RGB(255, 255, 255) : c1); }
    rect(0, 150, 256, 2, c2); char b[24]; sprintf(b, "TEMPO %d", mtempo); text(8, 160, b, RGB(255, 230, 120)); text(150, 160, mplay ? "PLAYING" : "STOPPED", RGB(255, 255, 255)); text(8, 12, title, RGB(255, 255, 255));
}
/* ======================= coloring book ======================= */
/* Pages come from the COLR section (shapes: ellipse / rounded rectangle / polygon, same data the PC coloring engine uses). Shapes are rasterised once per page into an id map,
   fills just recolour that region, so a tap costs about one frame. The bottom screen is the touch screen: picture + palette + page buttons; the top screen mirrors the picture. */
static const u16 CPAL[24] = { RGB(232, 74, 74), RGB(255, 122, 69), RGB(255, 178, 58), RGB(255, 225, 74), RGB(182, 224, 74), RGB(74, 232, 122), RGB(47, 184, 154), RGB(74, 232, 255), RGB(74, 155, 232), RGB(74, 95, 232), RGB(138, 74, 232), RGB(210, 74, 232), RGB(255, 111, 181), RGB(255, 179, 209), RGB(245, 222, 179), RGB(200, 134, 74), RGB(139, 90, 43), RGB(90, 58, 30), RGB(255, 255, 255), RGB(207, 214, 221), RGB(138, 146, 156), RGB(58, 63, 72), RGB(16, 18, 24), RGB(255, 217, 168) };
static const char *CPN[24] = { "RED", "ORANGE", "AMBER", "YELLOW", "LIME", "GREEN", "TEAL", "CYAN", "BLUE", "INDIGO", "VIOLET", "MAGENTA", "PINK", "BLUSH", "SAND", "TAN", "BROWN", "COCOA", "WHITE", "SILVER", "GRAY", "CHARCOAL", "BLACK", "PEACH" };
#define CW 256
#define CH 150
#define CMAXR 127
static const u8 *cdata; static int cnp, cpage, csel, cfilled, cnreg, cmatch, cdone_t, clast, ccx, ccy; static u8 idmap[CW * CH], cfill[CMAXR + 1], chint[CMAXR + 1]; static u16 cpic[CW * CH], cbgc; static char cname[15];
static inline int c16(const u8 *p) { return (s16)(p[0] | p[1] << 8); }
static inline int csx(int x) { return x * 49 / 64 + 5; } static inline int csy(int y) { return y * 49 / 64; }
static const u8 *cpage_ptr(int i) { const u8 *p = cdata + 4; for (int k = 0; k < i; k++) { int n = p[0]; p += 16; for (int r = 0; r < n; r++) p += 4 + 2 * (p[2] | p[3] << 8); } return p; }
static void c_region(int id, const u8 *r) {
    int kind = r[0], len = r[2] | r[3] << 8; const u8 *v = r + 4;
    if (kind == 0 && len >= 5) {
        int cx = csx(c16(v)), cy = csy(c16(v + 2)), rx = c16(v + 4) * 49 / 64, ry = c16(v + 6) * 49 / 64, ang = c16(v + 8) * 32768 / 6283; if (rx < 1) rx = 1; if (ry < 1) ry = 1; int co = cosLerp(-ang), si = sinLerp(-ang), m = rx > ry ? rx : ry, lim = rx * rx * ry * ry;
        for (int y = cy - m - 1; y <= cy + m + 1; y++) { if ((unsigned)y >= CH) continue; for (int x = cx - m - 1; x <= cx + m + 1; x++) { if ((unsigned)x >= CW) continue; int dx = x - cx, dy = y - cy, ux = (dx * co - dy * si) >> 12, uy = (dx * si + dy * co) >> 12; if (ux * ux * ry * ry + uy * uy * rx * rx <= lim) idmap[y * CW + x] = id; } }
    } else if (kind == 1 && len >= 5) {
        int x0 = csx(c16(v)), y0 = csy(c16(v + 2)), w = c16(v + 4) * 49 / 64, h = c16(v + 6) * 49 / 64, rr = c16(v + 8) * 49 / 64; if (rr > w / 2) rr = w / 2; if (rr > h / 2) rr = h / 2;
        for (int y = y0; y <= y0 + h; y++) { if ((unsigned)y >= CH) continue; for (int x = x0; x <= x0 + w; x++) { if ((unsigned)x >= CW) continue; int dx = x < x0 + rr ? x0 + rr - x : x > x0 + w - rr ? x - (x0 + w - rr) : 0, dy = y < y0 + rr ? y0 + rr - y : y > y0 + h - rr ? y - (y0 + h - rr) : 0; if (dx * dx + dy * dy <= rr * rr) idmap[y * CW + x] = id; } }
    } else if (kind == 2 && len >= 6) {
        int n = len / 2; if (n > 64) n = 64; static int px_[64], py_[64]; int ymin = 999, ymax = -999; for (int i = 0; i < n; i++) { px_[i] = csx(c16(v + i * 4)); py_[i] = csy(c16(v + i * 4 + 2)); if (py_[i] < ymin) ymin = py_[i]; if (py_[i] > ymax) ymax = py_[i]; }
        for (int y = ymin < 0 ? 0 : ymin; y <= ymax && y < CH; y++) { int xs[64], k = 0; for (int i = 0, j = n - 1; i < n; j = i++) if ((py_[i] > y) != (py_[j] > y)) xs[k++] = (px_[j] - px_[i]) * (y - py_[i]) / (py_[j] - py_[i]) + px_[i];
            for (int a = 1; a < k; a++) { int t2 = xs[a], b = a - 1; while (b >= 0 && xs[b] > t2) { xs[b + 1] = xs[b]; b--; } xs[b + 1] = t2; }
            for (int a = 0; a + 1 < k; a += 2) for (int x = xs[a]; x <= xs[a + 1]; x++) if ((unsigned)x < CW) idmap[y * CW + x] = id; }
    }
}
static u16 c_colour(int i) { int m = idmap[i], id = m & 0x7f; if (m & 0x80) return RGB(40, 40, 52); if (!id) return cbgc; return cfill[id] ? CPAL[cfill[id] - 1] : RGB(255, 255, 255); }
static void c_load(int pg) {
    cpage = pg; const u8 *p = cpage_ptr(pg); int n = p[0]; if (n > CMAXR) n = CMAXR; cbgc = CPAL[p[1] < 24 ? p[1] : 18]; memcpy(cname, p + 2, 14); cname[14] = 0; cnreg = n; cfilled = 0; cdone_t = 0; clast = 0; memset(idmap, 0, sizeof idmap); memset(cfill, 0, sizeof cfill); memset(chint, 255, sizeof chint);
    const u8 *r = p + 16; for (int i = 0; i < n; i++) { chint[i + 1] = r[1]; c_region(i + 1, r); r += 4 + 2 * (r[2] | r[3] << 8); }
    static u8 tmp[CW * CH]; memcpy(tmp, idmap, sizeof tmp);
    for (int y = 0; y < CH; y++) for (int x = 0; x < CW; x++) { int i = y * CW + x, id = tmp[i]; int edge = (x > 0 && tmp[i - 1] != id) || (x < CW - 1 && tmp[i + 1] != id) || (y > 0 && tmp[i - CW] != id) || (y < CH - 1 && tmp[i + CW] != id); if (edge) idmap[i] |= 0x80; }
    for (int i = 0; i < CW * CH; i++) cpic[i] = c_colour(i);
}
static void c_fill(int id, int col) {
    if (!id || id > cnreg) return; if (!cfill[id]) cfilled++; cfill[id] = col + 1; if (chint[id] == col) { cmatch++; beep(1318, 3); } score = cmatch * 10 + cfilled; clast = id;
    u16 c = CPAL[col]; for (int i = 0; i < CW * CH; i++) { int m = idmap[i]; if ((m & 0x7f) == id && !(m & 0x80)) cpic[i] = c; } beep(500 + col * 30, 2);
}
static int c_pick(int x, int y) { if ((unsigned)x >= CW || (unsigned)y >= CH) return 0; int id = idmap[y * CW + x] & 0x7f; if (id && !(idmap[y * CW + x] & 0x80)) return id; int best = 0; for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) { int xx = x + i, yy = y + j; if ((unsigned)xx < CW && (unsigned)yy < CH) { int q = idmap[yy * CW + xx] & 0x7f; if (q > best) best = q; } } return best; }
static void color_init(void) {
    u32 sz; cdata = sec("COLR", &sz); cnp = cdata ? cdata[0] : 0; cmatch = 0; csel = 0; score = 0; ccx = 128; ccy = 75; if (!cnp) { status = 2; return; } c_load(P[0] >= 0 && P[0] < cnp ? P[0] : 0);
}
static void color_step(void) {
    t++; if (!cnp) return;
    if (kd & KEY_R) { if (cpage + 1 < cnp) c_load(cpage + 1); } if (kd & KEY_L) { if (cpage > 0) c_load(cpage - 1); }
    if (kd & KEY_B) csel = (csel + 1) % 24; if (kd & KEY_Y) csel = (csel + 23) % 24; if (kd & KEY_X) csel = (csel + 12) % 24;
    if (kh & KEY_LEFT) ccx -= 2; if (kh & KEY_RIGHT) ccx += 2; if (kh & KEY_UP) ccy -= 2; if (kh & KEY_DOWN) ccy += 2; if (ccx < 0) ccx = 0; if (ccx > 255) ccx = 255; if (ccy < 0) ccy = 0; if (ccy > 149) ccy = 149;
    if (kd & KEY_A) c_fill(c_pick(ccx, ccy), csel);
    if (touched == 2) {
        if (ty < CH) { ccx = tx; ccy = ty; c_fill(c_pick(tx, ty), csel); }
        else if (ty >= 151 && ty < 177 && tx >= 8 && tx < 248) { int c = (tx - 8) / 20 + (ty >= 164 ? 12 : 0); if (c < 24) { csel = c; beep(700 + c * 20, 1); } }
        else if (ty >= 179) { if (tx >= 8 && tx < 34 && cpage > 0) c_load(cpage - 1); else if (tx >= 224 && cpage + 1 < cnp) c_load(cpage + 1); else if (tx >= 150 && tx < 218) { for (int i = 1; i <= cnreg; i++) cfill[i] = 0; cfilled = 0; for (int i = 0; i < CW * CH; i++) cpic[i] = c_colour(i); } }
    }
    if (touched == 1 && ty < CH && tx > 0) { int id = c_pick(tx, ty); if (id && cfill[id] != csel + 1) c_fill(id, csel); }
    if (cnreg && cfilled >= cnreg) { cdone_t++; if (cdone_t == 1) beep(1568, 10); if (cdone_t > 150) { if (cpage + 1 < cnp) c_load(cpage + 1); else status = 1; } }
}
static void color_draw(void) {
    clear(RGB(24, 16, 40)); if (!cnp) { ctext(80, "NO COLORING PAGES", RGB(255, 255, 255)); return; }
    memcpy(top, cpic, sizeof cpic); rect(0, 150, 256, 42, RGB(24, 16, 40)); rect(0, 150, 256, 1, RGB(255, 111, 181));
    char b[40]; sprintf(b, "%s  %d/%d", cname, cpage + 1, cnp); text(8, 154, b, RGB(255, 230, 120)); sprintf(b, "FILLED %d/%d   STARS %d", cfilled, cnreg, cmatch); text(8, 166, b, RGB(255, 255, 255));
    rect(8, 180, 160, 6, RGB(60, 50, 80)); rect(8, 180, cnreg ? 160 * cfilled / cnreg : 0, 6, RGB(120, 255, 140));
    rect(176, 154, 72, 14, CPAL[csel]); frame_rect(176, 154, 72, 14, RGB(255, 255, 255)); text(180, 172, CPN[csel], RGB(255, 255, 255));
    if (clast && chint[clast] < 24) { text(176, 182, "TRY", RGB(255, 111, 181)); rect(208, 181, 20, 8, CPAL[chint[clast]]); }
    if (cdone_t) { rect(48, 60, 160, 30, RGB(0, 0, 0)); frame_rect(48, 60, 160, 30, RGB(120, 255, 140)); ctext(70, cpage + 1 < cnp ? "PAGE DONE!" : "ALL DONE!", RGB(255, 255, 255)); }
}
static void color_bottom(void) {
    cur = bot; clear(RGB(24, 16, 40)); if (!cnp) return; memcpy(bot, cpic, sizeof cpic);
    frame_rect(ccx - 4, ccy - 4, 9, 9, RGB(255, 255, 255)); rect(ccx, ccy - 6, 1, 13, RGB(255, 255, 80)); rect(ccx - 6, ccy, 13, 1, RGB(255, 255, 80));
    for (int c = 0; c < 24; c++) { int x = 8 + (c % 12) * 20, y = 152 + (c / 12) * 13; rect(x, y, 19, 12, CPAL[c]); if (c == csel) { frame_rect(x - 1, y - 1, 21, 14, RGB(255, 255, 255)); frame_rect(x, y, 19, 12, RGB(0, 0, 0)); } }
    rect(8, 179, 26, 12, cpage > 0 ? RGB(70, 60, 110) : RGB(40, 36, 60)); text(15, 181, "<", RGB(255, 255, 255)); rect(224, 179, 24, 12, cpage + 1 < cnp ? RGB(70, 60, 110) : RGB(40, 36, 60)); text(231, 181, ">", RGB(255, 255, 255));
    rect(150, 179, 68, 12, RGB(100, 40, 60)); text(158, 181, "CLEAR", RGB(255, 255, 255)); text(40, 181, cname, RGB(200, 200, 230));
}
/* ======================= text card (router scenes: title, dialogue, credits, loading ...) ======================= */
static void card_init(void) { status = 0; t = 0; }
static void card_step(void) { t++; if (t > 20 && ((kd & (KEY_START | KEY_A)) || touched == 2)) status = 1; }
static void card_draw(void) {
    clear(RGB(10, 8, 28)); for (int y = 0; y < 192; y += 2) rect(0, y, 256, 1, RGB(14 + y / 12, 10 + y / 16, 36 + y / 6)); rect(0, 30, 256, 2, c1); ctext(14, title, RGB(255, 230, 120));
    char line[40]; const char *s = card_text; int n = 0; while (*s && n < 10) { int k = 0, last = -1; while (s[k] && s[k] != '\n' && k < 30) { if (s[k] == ' ') last = k; k++; } if (s[k] && s[k] != '\n' && last > 0) k = last; memcpy(line, s, k); line[k] = 0; ctext(48 + n * 12, line, RGB(235, 235, 250)); n++; s += k; if (*s == '\n' || *s == ' ') s++; }
    if ((t / 24) & 1) ctext(168, "TOUCH OR PRESS START", RGB(180, 190, 230));
}
static void card_bottom(void) { cur = bot; clear(RGB(10, 14, 30)); ctext(80, "NOTAREAL GAME STUDIO", RGB(120, 130, 170)); if ((t / 24) & 1) ctext(120, "TOUCH TO CONTINUE", RGB(255, 230, 120)); }
/* ======================= shared UI ======================= */
typedef void (*Fn)(void);

/* vehicle combat: the shared core (shared/kartcombat.h, also used by the N64 and PlayStation ROMs); settings come from the KCFG section */
#define KC_W 256
#define KC_H 192
#define KC_RGB(r, g, b) RGB(r, g, b)
#define KC_RECT(x, y, w, h, c) rect(x, y, w, h, c)
#define KC_TEXT(x, y, s, c) text(x, y, s, c)
#define KC_SFX(k) kart_sfx(k)
static void kart_sfx(int k) { static const u16 hz[6] = { 1800, 700, 300, 120, 2400, 200 }; if (k == 3 || k == 5) thud(k == 3 ? 10 : 5); else beep(hz[k], k == 0 ? 2 : 6); }
#include "../../../shared/kartcombat.h"
static void combat_init(void) {
    KcCfg c = { 2, 5, 100, 30, 3, 2, 4, 18, 22, 150, 2, 150, 10, 0, 0 }; u32 sz; const u8 *k = sec("KCFG", &sz);
    if (k && sz >= 30) { s16 *d = (s16 *)&c; for (int i = 0; i < 13; i++) d[i] = (s16)(k[i * 2] | (k[i * 2 + 1] << 8)); }
    { u32 zt; const u8 *tk = sec("RACE", &zt); kc_trkd = (tk && zt >= 10 && tk[0] && tk[1]) ? tk : 0; }
    c.color = c1; c.color2 = c2; kc_init(&c, rs | 1); status = 0;
}
static void combat_step(void) {
    unsigned k = 0; if (kh & KEY_UP) k |= KC_UP; if (kh & KEY_DOWN) k |= KC_DOWN; if (kh & KEY_LEFT) k |= KC_LEFT; if (kh & KEY_RIGHT) k |= KC_RIGHT; if (kh & KEY_B) k |= KC_GUN; if (kh & KEY_A) k |= KC_MSL; if (kh & (KEY_X | KEY_Y)) k |= KC_MINE;
    kc_step(k); score = kc.score; if (kc.status) status = kc.status;
}
static void combat_draw(void) { cur = top; kc_draw(); }
static void game_init(void) { status = 0; t = 0; paused = 0; hp = 0; switch (mode) { case M_SHMUP: shmup_init(); break; case M_BREAKOUT: bo_init(); break; case M_RACE: race_init(); break; case M_COMBAT: combat_init(); break; case M_FPS: fps_init(); break; case M_BRAWLER: br_init(); break; case M_FALLING: fall_init(); break; case M_MEMORY: mem_init(); break; case M_SIM: sim_init(); break; case M_PAINT: paint_init(); break; case M_MUSIC: music_init(); break; case M_COLOR: color_init(); break; case M_CARD: card_init(); break; default: hoops_init(); } }
static void game_step(void) { switch (mode) { case M_SHMUP: shmup_step(); break; case M_BREAKOUT: bo_step(); break; case M_RACE: race_step(); break; case M_COMBAT: combat_step(); break; case M_FPS: fps_step(); break; case M_BRAWLER: br_step(); break; case M_FALLING: fall_step(); break; case M_MEMORY: mem_step(); break; case M_SIM: sim_step(); break; case M_PAINT: paint_step(); break; case M_MUSIC: music_step(); break; case M_COLOR: color_step(); break; case M_CARD: card_step(); break; default: hoops_step(); } }
static void game_draw(void) { cur = top; switch (mode) { case M_SHMUP: shmup_draw(); break; case M_BREAKOUT: bo_draw(); break; case M_RACE: race_draw(); break; case M_COMBAT: combat_draw(); break; case M_FPS: fps_draw(); break; case M_BRAWLER: br_draw(); break; case M_FALLING: fall_draw(); break; case M_MEMORY: mem_draw(); break; case M_SIM: sim_draw(); break; case M_PAINT: paint_draw(); break; case M_MUSIC: music_draw(); break; case M_COLOR: color_draw(); break; case M_CARD: card_draw(); break; default: hoops_draw(); } }
static void bar(int x, int y, int w, int v, int mx, u16 c) { rect(x, y, w, 8, RGB(40, 40, 56)); rect(x, y, mx ? w * (v < 0 ? 0 : v > mx ? mx : v) / mx : 0, 8, c); frame_rect(x, y, w, 8, RGB(150, 150, 170)); }
static void bottom_draw(void) {
    if (mode == M_COLOR) { color_bottom(); return; } if (mode == M_CARD) { card_bottom(); return; }
    cur = bot; clear(RGB(10, 14, 30)); rect(0, 0, 256, 22, c1 & ~BIT(15) | BIT(15)); rect(0, 0, 256, 22, RGB(24, 30, 60)); text(8, 7, title, RGB(255, 255, 255)); char b[40]; sprintf(b, "SCORE %d", score); text(8, 30, b, RGB(255, 230, 120));
    if (mode == M_FPS) {                                                                       /* minimap + touch weapon controls */
        int ms = 120 / fn; if (ms > 8) ms = 8; int ox = 8, oy = 46; for (int y = 0; y < fn; y++) for (int x = 0; x < fn; x++) rect(ox + x * ms, oy + y * ms, ms, ms, fm[y][x] ? RGB(60, 70, 110) : RGB(20, 24, 40));
        for (int i = 0; i < fcount; i++) if (foe[i].on) rect(ox + (foe[i].x >> 16) * ms + ms / 3, oy + (foe[i].y >> 16) * ms + ms / 3, ms / 2 + 1, ms / 2 + 1, RGB(255, 80, 80)); for (int i = 0; i < 12; i++) if (pk[i].on) rect(ox + (pk[i].x >> 16) * ms + ms / 3, oy + (pk[i].y >> 16) * ms + ms / 3, ms / 2 + 1, ms / 2 + 1, pk[i].kind ? RGB(80, 230, 90) : RGB(240, 200, 60));
        int px3 = ox + ((fx * ms) >> 16), py3 = oy + ((fy * ms) >> 16); disc(px3, py3, 2, RGB(80, 220, 255)); rect(px3 + ((cs(fa) * 5) >> 12), py3 + ((sn(fa) * 5) >> 12), 2, 2, RGB(255, 255, 255));
        text(150, 46, "HEALTH", RGB(200, 200, 220)); bar(150, 58, 96, hp, 100 + P[2], RGB(80, 220, 90)); sprintf(b, "AMMO %d/%d", mag, ammo); text(150, 76, b, RGB(255, 255, 255)); sprintf(b, "ENEMIES %d", fcount - kills); text(150, 92, b, RGB(255, 120, 120));
        rect(150, 110, 96, 30, RGB(60, 40, 40)); frame_rect(150, 110, 96, 30, RGB(255, 140, 120)); ctext(122, "", 0); text(168, 121, "RELOAD [B]", RGB(255, 255, 255)); text(8, 176, "DRAG HERE TO LOOK", RGB(130, 140, 170));
    } else if (mode == M_SIM) {
        sprintf(b, "CASH $%d", ccash); text(8, 46, b, RGB(120, 255, 140)); sprintf(b, "POP %d / %d", cpop, P[3] < 10 ? 120 : P[3]); text(8, 60, b, RGB(255, 255, 255)); sprintf(b, "INCOME $%d/s", cincome); text(8, 74, b, RGB(255, 230, 120));
        static const char *nm[5] = { "", "HOUSE $100", "FARM $150", "SHOP $120", "PARK $80" }; for (int i = 1; i <= 4; i++) { rect(8, 90 + (i - 1) * 20, 120, 18, i == csel ? RGB(60, 90, 140) : RGB(30, 36, 60)); text(14, 95 + (i - 1) * 20, nm[i], RGB(255, 255, 255)); } if (touched == 2 && tx < 128 && ty >= 90 && ty < 170) csel = 1 + (ty - 90) / 20;
    } else if (mode == M_PAINT) { sprintf(b, "DONE %d%%", score); text(8, 46, b, RGB(255, 255, 255)); text(8, 70, "Match each number", RGB(170, 180, 210)); text(8, 82, "to its colour.", RGB(170, 180, 210)); }
    else if (mode == M_MEMORY) { sprintf(b, "TRIES LEFT %d", mtries); text(8, 46, b, RGB(255, 255, 255)); }
    else if (mode == M_HOOPS) { sprintf(b, "BASKETS %d / %d", score, hgoal); text(8, 46, b, RGB(255, 255, 255)); sprintf(b, "TIME %d", hsec / 60); text(8, 60, b, RGB(255, 230, 120)); }
    else if (mode == M_RACE) { sprintf(b, "LAP %d / %d", rlap + 1, P[0]); text(8, 46, b, RGB(255, 255, 255)); sprintf(b, "TIME %d", rtime / 60); text(8, 60, b, RGB(255, 230, 120)); sprintf(b, "SPEED %d", rspd); text(8, 74, b, RGB(120, 255, 140)); bar(8, 90, 120, rspd, P[2] < 40 ? 200 : P[2], c1); }
    else if (mode == M_COMBAT) { sprintf(b, "POS %d / %d", kc.place, kcC.rivals + 1); text(8, 46, b, RGB(255, 255, 255)); sprintf(b, "LAP %d / %d", kc.lap > kcC.laps ? kcC.laps : kc.lap, kcC.laps); text(8, 60, b, RGB(255, 230, 120)); sprintf(b, "MISSILES %d  MINES %d", kc.missiles, kc.mines); text(8, 74, b, RGB(255, 255, 255)); text(8, 90, "HULL", RGB(200, 200, 220)); bar(48, 90, 100, kc.hp, kcC.hp, RGB(80, 220, 90)); text(8, 104, "HEAT", RGB(200, 200, 220)); bar(48, 104, 100, kc.heat, 100, kc.jam ? RGB(255, 80, 80) : RGB(255, 230, 80)); }
    else if (mode == M_BRAWLER) { sprintf(b, "LIVES %d  WAVE %d", lives, bwave); text(8, 46, b, RGB(255, 255, 255)); bar(8, 60, 100, bphp, 10, RGB(80, 220, 90)); }
    else if (mode == M_FALLING) { sprintf(b, "LINES %d / %d", flines, P[3] < 1 ? 20 : P[3]); text(8, 46, b, RGB(255, 255, 255)); }
    else if (mode == M_BREAKOUT) { sprintf(b, "LIVES %d  BRICKS %d", lives, bricks); text(8, 46, b, RGB(255, 255, 255)); }
    else if (mode == M_SHMUP) { sprintf(b, "LIVES %d  WAVE %d", lives, wave + 1); text(8, 46, b, RGB(255, 255, 255)); }
    if (mode == M_MUSIC) { clear(RGB(10, 14, 30)); for (int r = 0; r < 8; r++) for (int c = 0; c < 16; c++) { int on = mg[r][c], x = 8 + c * 15, y = 34 + r * 17; rect(x, y, 14, 16, on ? (r < 4 ? RGB(255, 200, 80) : RGB(120, 220, 255)) : ((c & 3) == 0 ? RGB(40, 46, 80) : RGB(28, 32, 58))); if (mplay && c == mstep) frame_rect(x - 1, y - 1, 16, 18, RGB(255, 255, 255)); if (c == mcx && r == mcy) frame_rect(x, y, 14, 16, RGB(255, 255, 80)); } text(8, 8, "TAP TO PLACE NOTES", RGB(170, 180, 210)); text(8, 176, "START = PLAY / STOP", RGB(130, 140, 170)); }
    if (mode != M_FPS && mode != M_MUSIC) wrap(8, 120, HELP[mode], RGB(150, 160, 190));
    if (mode == M_MUSIC) return;
    rect(176, 164, 72, 22, RGB(40, 44, 80)); frame_rect(176, 164, 72, 22, RGB(150, 160, 220)); text(188, 171, paused ? "RESUME" : "PAUSE", RGB(255, 255, 255)); if (touched == 2 && tx > 176 && ty > 164 && mode != M_FPS) paused = !paused; if (touched == 2 && tx > 176 && ty > 164 && mode == M_FPS) paused = !paused;
}
static void run(void) {
    for (;;) {
        if (!scn_card) {
            play_song(cfg_title); cur = top; clear(RGB(5, 6, 14)); ctext(40, title, RGB(255, 255, 255)); ctext(70, "- - - - - - - -", c1); wrap(10, 96, HELP[mode], RGB(180, 190, 220)); ctext(150, "PRESS START", RGB(255, 230, 120)); cur = bot; clear(RGB(10, 14, 30)); ctext(80, "NOTAREAL GAME STUDIO", RGB(120, 140, 220)); ctext(100, "Touch the screen to begin", RGB(170, 180, 210));
            do { show(); } while (!(kd & KEY_START) && touched != 2); rs ^= fr_n * 2654435761u; kd = 0; touched = 0;
        } else { kd = 0; touched = 0; }
        game_init(); play_song(cfg_song);
        while (status == 0) { if ((kd & KEY_START) && mode != M_MUSIC && mode != M_CARD) paused = !paused; if (!paused) game_step(); game_draw(); if (paused) ctext(88, "PAUSED", RGB(255, 255, 255)); bottom_draw(); show(); }
        stop_music();
        if (!scn_card) {
            cur = top; for (int i = 0; i < 60; i++) { game_draw(); rect(40, 70, 176, 54, RGB(0, 0, 0)); frame_rect(40, 70, 176, 54, status == 1 ? RGB(120, 255, 140) : RGB(255, 120, 120)); ctext(82, status == 1 ? "YOU WIN!" : "GAME OVER", RGB(255, 255, 255)); char b[32]; sprintf(b, "SCORE %d", score); ctext(100, b, RGB(255, 230, 120)); bottom_draw(); show(); }
            do { cur = top; ctext(130, "Press START", RGB(255, 230, 120)); show(); } while (!(kd & KEY_START) && touched != 2);
        }
        if (nscn) { int nx = status == 1 ? scn_win : scn_lose; if (nx == 254) nx = scn_i; if (nx == 255 || nx >= nscn) nx = 0; apply_scene(nx); }
    }
}
int main(void) {
    video(); load_cfg(); cur = top;
    dmaCopy(splash_bin, top, 256 * 192 * 2); for (int i = 0; i < 150; i++) { show(); if (i > 40 && (kd & (KEY_START | KEY_A))) break; }
    run(); return 0;
}

// NOTAREAL Game Studio - DS puzzle engine: Match-3 and Friendship Bracelet.
// Same data-block format as the other engines; the editor writes one "PZCF" section.
#include <nds.h>
#include <stdio.h>
#include <string.h>
#include "nrg.h"
#include "splash_bin.h"
#include "font_bin.h"

extern const unsigned char nr_gamedata[];
void snd_input(void);
void snd_psg_ch(int ch, int duty, int hz, int vol, int pan);
void snd_noise_ch(int ch, int hz, int vol, int pan);
void snd_stop(int ch);
void snd_master(int vol);
static int fr_n, kill_at[16];
static void beep(int ch, int duty, int hz, int vol, int frames) { snd_psg_ch(ch, duty, hz, vol, 64); kill_at[ch] = fr_n + frames; }
static void thud(int frames) { snd_noise_ch(15, 3000, 100, 64); kill_at[15] = fr_n + frames; }
static void sound_tick(void) { fr_n++; for (int c = 0; c < 16; c++) if (kill_at[c] && fr_n >= kill_at[c]) { snd_stop(c); kill_at[c] = 0; } }

static const NrgHeader *H;
static const u8 *sec(const char *id, u32 *size) {
    for (u32 i = 0; i < H->count; i++)
        if (!memcmp(H->sec[i].id, id, 4)) { if (size) *size = H->sec[i].size; return (const u8 *)H + H->sec[i].off; }
    if (size) *size = 0; return 0;
}
static u32 kd, kh;
static void input(void) { snd_input(); scanKeys(); kd = keysDown(); kh = keysHeld(); }
static u16 *fb; static u16 buf[256 * 192]; static int use_buf;
static u16 pal[6], colors_n;
static u32 rs = 12345;
static int rnd(int n) { rs = rs * 1664525u + 1013904223u; return (int)((rs >> 8) % (u32)n); }

/* ---------------- drawing ---------------- */
#define BGC RGB15(3, 4, 10) | BIT(15)
static void px(int x, int y, u16 c) { if ((unsigned)x < 256 && (unsigned)y < 192) buf[y * 256 + x] = c; }
static void rect(int x, int y, int w, int h, u16 c) { int x0 = x < 0 ? 0 : x, x1 = x + w > 256 ? 256 : x + w, y0 = y < 0 ? 0 : y, y1 = y + h > 192 ? 192 : y + h; for (int j = y0; j < y1; j++) for (int i = x0; i < x1; i++) buf[j * 256 + i] = c; }
static void disc(int cx, int cy, int r, u16 c) { for (int j = -r; j <= r; j++) for (int i = -r; i <= r; i++) if (i * i + j * j <= r * r) px(cx + i, cy + j, c); }
static void frame_rect(int x, int y, int w, int h, u16 c) { rect(x, y, w, 1, c); rect(x, y + h - 1, w, 1, c); rect(x, y, 1, h, c); rect(x + w - 1, y, 1, h, c); }
static void text(int x, int y, const char *s, u16 c) {
    for (; *s; s++, x += 8) { int ch = *s; if (ch >= 'a' && ch <= 'z') ch -= 32; if (ch <= 32 || ch > 127) continue; const u8 *g = font_bin + (ch - 32) * 64;
        for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) if (g[j * 8 + i]) px(x + i, y + j, c); }
}
static void ctext(int y, const char *s, u16 c) { text((256 - (int)strlen(s) * 8) / 2, y, s, c); }
static void wait_frame(void) { swiWaitForVBlank(); if (use_buf) dmaCopy(buf, fb, 256 * 192 * 2); input(); sound_tick(); }
static void splash(void) {
    videoSetMode(MODE_5_2D); vramSetBankA(VRAM_A_MAIN_BG);
    int b = bgInit(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0); fb = (u16 *)bgGetGfxPtr(b);
    dmaCopy(splash_bin, fb, 256 * 192 * 2);
    for (int i = 0; i < 150; i++) { wait_frame(); if (i > 40 && (kd & (KEY_START | KEY_A))) break; }
}

/* ---------------- config ---------------- */
typedef struct { u8 mode, w, h, colors, moves, pad0; u16 goal; u8 threads, rows, tries, pattern, npal, pad1[3]; u8 rgb[18]; char title[32]; } Cfg;
static Cfg C;
static void load_cfg(void) {
    u32 sz; const u8 *p = sec("PZCF", &sz);
    memset(&C, 0, sizeof C); C.w = C.h = 8; C.colors = 5; C.moves = 20; C.goal = 1000; C.threads = 6; C.rows = 10; C.tries = 6; C.npal = 5;
    if (p && sz >= 16) { memcpy(&C, p, sz < sizeof C ? sz : sizeof C); }
    if (C.w < 4 || C.w > 10) C.w = 8; if (C.h < 4 || C.h > 10) C.h = 8; if (C.colors < 3 || C.colors > 6) C.colors = 5; if (C.threads < 3 || C.threads > 10) C.threads = 6; if (C.rows < 2 || C.rows > 40) C.rows = 10; if (C.npal < 2 || C.npal > 6) C.npal = 3; if (!C.tries) C.tries = 6; if (!C.moves) C.moves = 20;
    for (int i = 0; i < 6; i++) pal[i] = RGB15(C.rgb[i * 3] >> 3, C.rgb[i * 3 + 1] >> 3, C.rgb[i * 3 + 2] >> 3) | BIT(15);
    if (!p) { static const u8 d[18] = { 232, 74, 74, 74, 155, 232, 74, 232, 122, 245, 197, 66, 176, 74, 232, 245, 138, 66 }; for (int i = 0; i < 6; i++) pal[i] = RGB15(d[i * 3] >> 3, d[i * 3 + 1] >> 3, d[i * 3 + 2] >> 3) | BIT(15); }
    C.title[31] = 0;
}

/* ---------------- match 3 ---------------- */
static int G[10 * 10], score, moves, over, combo;
static inline int at(int x, int y) { return (x < 0 || y < 0 || x >= C.w || y >= C.h) ? -1 : G[y * C.w + x]; }
static int find_marks(u8 *m) {
    int n = 0; memset(m, 0, 100);
    for (int y = 0; y < C.h; y++) for (int x = 0; x < C.w; x++) { int c = at(x, y); if (c < 0) continue; int k = 1; while (at(x + k, y) == c) k++; if (k >= 3) for (int i = 0; i < k; i++) m[y * C.w + x + i] = 1; k = 1; while (at(x, y + k) == c) k++; if (k >= 3) for (int i = 0; i < k; i++) m[(y + i) * C.w + x] = 1; }
    for (int i = 0; i < C.w * C.h; i++) n += m[i]; return n;
}
static int settle(void) {
    u8 m[100]; int total = 0, chain = 0;
    for (;;) { int n = find_marks(m); if (!n) break; chain++; total += n * 10 * chain; for (int i = 0; i < C.w * C.h; i++) if (m[i]) G[i] = -1;
        for (int x = 0; x < C.w; x++) { int w = C.h - 1; for (int y = C.h - 1; y >= 0; y--) if (G[y * C.w + x] >= 0) { G[w * C.w + x] = G[y * C.w + x]; if (w != y) G[y * C.w + x] = -1; w--; } for (int y = w; y >= 0; y--) G[y * C.w + x] = rnd(C.colors); } }
    combo = chain; return total;
}
static int possible(void) {
    u8 m[100];
    for (int y = 0; y < C.h; y++) for (int x = 0; x < C.w; x++) for (int d = 0; d < 2; d++) { int x2 = x + (d == 0), y2 = y + (d == 1); if (x2 >= C.w || y2 >= C.h) continue; int a = y * C.w + x, b = y2 * C.w + x2, t = G[a]; G[a] = G[b]; G[b] = t; int ok = find_marks(m) > 0; t = G[a]; G[a] = G[b]; G[b] = t; if (ok) return 1; }
    return 0;
}
static int swap_gems(int x1, int y1, int x2, int y2) {
    u8 m[100]; if (over) return 0; if (abs(x1 - x2) + abs(y1 - y2) != 1) return 0;
    int a = y1 * C.w + x1, b = y2 * C.w + x2, t = G[a]; G[a] = G[b]; G[b] = t;
    if (!find_marks(m)) { t = G[a]; G[a] = G[b]; G[b] = t; return 0; }
    moves--; int pts = settle(); score += pts;
    for (int g = 0; g < 20 && !possible(); g++) { for (int i = 0; i < C.w * C.h; i++) G[i] = rnd(C.colors); settle(); }
    if (score >= C.goal) over = 1; else if (moves <= 0) over = 2;
    return pts;
}
static void m3_init(void) {
    score = 0; over = 0; combo = 0; moves = C.moves; u8 m[100];
    do { for (int i = 0; i < C.w * C.h; i++) G[i] = rnd(C.colors); settle(); } while (!possible());
    score = 0; (void)m;
}
#define OKC (RGB15(18, 31, 18) | BIT(15))
#define BADC (RGB15(31, 18, 18) | BIT(15))
#define YEL (RGB15(31, 28, 10) | BIT(15))
static int touched, tx, ty;
static void read_touch(void) { touched = 0; if (kh & KEY_TOUCH) { touchPosition t; touchRead(&t); if (t.px || t.py) { tx = t.px; ty = t.py; touched = (kd & KEY_TOUCH) ? 2 : 1; } } }
static void m3_run(void) {
    int cx = 0, cy = 0, sx = -1, sy = -1, prevover = 0; char msg[40] = ""; char b[40];
    int cs = 18, ox = 8, oy = 22; if (C.h * cs + oy > 190) cs = (190 - oy) / C.h;
    m3_init();
    for (;;) {
        wait_frame(); read_touch();
        int act = 0, ax = cx, ay = cy;
        if (!over) {
            if (kd & KEY_LEFT && cx > 0) cx--; if (kd & KEY_RIGHT && cx < C.w - 1) cx++; if (kd & KEY_UP && cy > 0) cy--; if (kd & KEY_DOWN && cy < C.h - 1) cy++;
            if (kd & KEY_B) sx = -1;
            if (kd & KEY_A) { act = 1; ax = cx; ay = cy; }
            if (touched == 2 && tx >= ox && ty >= oy && tx < ox + C.w * cs && ty < oy + C.h * cs) { ax = cx = (tx - ox) / cs; ay = cy = (ty - oy) / cs; act = 1; }
            if (act) { if (sx < 0) { sx = ax; sy = ay; beep(8, 2, 880, 90, 3); }
                else { int adj = abs(sx - ax) + abs(sy - ay) == 1; int p = swap_gems(sx, sy, ax, ay);
                    if (p) { snprintf(msg, 40, combo > 1 ? "+%d COMBO X%d" : "+%d", p, combo); beep(8, 2, 520 + 120 * combo, 100, 6); sx = -1; }
                    else if (adj) { strcpy(msg, "NO MATCH"); beep(8, 1, 180, 100, 8); sx = -1; }
                    else { sx = ax; sy = ay; beep(8, 2, 880, 90, 3); } } }
        } else if (kd & KEY_START || (touched == 2 && ty > 150)) { m3_init(); msg[0] = 0; sx = -1; prevover = 0; }
        if (over && !prevover) { prevover = 1; beep(8, 2, over == 1 ? 1175 : 220, 110, 30); }
        rect(0, 0, 256, 192, BGC); text(8, 4, C.title, 0xFFFF);
        for (int y = 0; y < C.h; y++) for (int x = 0; x < C.w; x++) { rect(ox + x * cs, oy + y * cs, cs - 1, cs - 1, RGB15(5, 6, 14) | BIT(15)); int c = G[y * C.w + x]; if (c >= 0) { disc(ox + x * cs + cs / 2, oy + y * cs + cs / 2, cs / 2 - 2, pal[c % 6]); disc(ox + x * cs + cs / 2 - 3, oy + y * cs + cs / 2 - 3, 2, 0xFFFF); } }
        frame_rect(ox + cx * cs, oy + cy * cs, cs - 1, cs - 1, 0xFFFF); if (sx >= 0) frame_rect(ox + sx * cs + 2, oy + sy * cs + 2, cs - 5, cs - 5, YEL);
        int px0 = ox + C.w * cs + 10; snprintf(b, 40, "SCORE %d", score); text(px0, 30, b, 0xFFFF); snprintf(b, 40, "GOAL  %d", C.goal); text(px0, 44, b, 0xFFFF); snprintf(b, 40, "MOVES %d", moves); text(px0, 58, b, 0xFFFF); text(px0, 84, msg, YEL);
        if (over) { rect(0, 80, 256, 32, RGB15(0, 0, 0) | BIT(15)); ctext(86, over == 1 ? "GOAL REACHED!" : "OUT OF MOVES", over == 1 ? OKC : BADC); ctext(98, "START OR TAP: PLAY AGAIN", 0xFFFF); }
    }
}

/* ---------------- bracelet ---------------- */
static int tgt(int x, int y) {
    int n = C.threads;
    switch (C.pattern) {
    case 1: return (x + y) % 3;
    case 2: return (x + (y >> 1)) % 2;
    case 3: { int d2 = abs(2 * x - (n - 1)) + abs(2 * (y % (n + 1)) - (n - 1)); int v = d2 / 4; return v > 2 ? 2 : v; }
    default: return (abs(2 * x - (n - 1)) / 2 + y) % 3;
    }
}
static u8 built[40][10], cur[10]; static int row_i, tries_l, bscore, bover;
static void br_init(void) { memset(cur, 255, sizeof cur); row_i = 0; tries_l = C.tries; bscore = 0; bover = 0; }
static void br_run(void) {
    int cx = 0, color = 0, prevover = 0; char msg[40] = "", b[40]; br_init();
    const int cs = 14, ox = 12, oy = 28; const int bx = ox + C.threads * cs + 24;
    for (;;) {
        wait_frame(); read_touch();
        int doHint = 0, doCheck = 0;
        if (!bover) {
            if (kd & KEY_LEFT && cx > 0) cx--; if (kd & KEY_RIGHT && cx < C.threads - 1) cx++; if (kd & KEY_UP) color = (color + C.npal - 1) % C.npal; if (kd & KEY_DOWN) color = (color + 1) % C.npal;
            if (kd & KEY_A) { cur[cx] = color; beep(8, 2, 660 + color * 110, 80, 3); }
            if (kd & KEY_Y) doHint = 1; if (kd & KEY_B) doCheck = 1;
            if (touched == 2) {
                int first = row_i > 6 ? row_i - 6 : 0, line = row_i - first;
                for (int i = 0; i < C.npal; i++) if (tx >= 10 + i * 24 && tx < 30 + i * 24 && ty >= 160 && ty < 176) { color = i; beep(8, 2, 660 + color * 110, 80, 2); }
                if (ty >= oy + line * (cs - 1) && ty < oy + line * (cs - 1) + cs && tx >= bx && tx < bx + C.threads * cs) { cx = (tx - bx) / cs; cur[cx] = color; beep(8, 2, 660 + color * 110, 80, 3); }
                if (tx >= 150 && tx < 202 && ty >= 160 && ty < 176) doHint = 1;
                if (tx >= 206 && tx < 254 && ty >= 160 && ty < 176) doCheck = 1;
            }
            if (doHint) { for (int i = 0; i < C.threads; i++) cur[i] = tgt(i, row_i); bscore = bscore >= 20 ? bscore - 20 : 0; strcpy(msg, "HINT USED -20"); beep(8, 3, 440, 80, 4); }
            if (doCheck) { int full = 1, wrong = 0; for (int i = 0; i < C.threads; i++) { if (cur[i] == 255) full = 0; else if (cur[i] != tgt(i, row_i)) wrong++; }
                if (!full) { strcpy(msg, "FILL EVERY THREAD"); beep(8, 1, 200, 90, 6); }
                else if (wrong) { tries_l--; snprintf(msg, 40, "%d WRONG, %d TRIES LEFT", wrong, tries_l); memset(cur, 255, sizeof cur); beep(8, 1, 150, 100, 12); if (tries_l <= 0) bover = 2; }
                else { memcpy(built[row_i], cur, C.threads); memset(cur, 255, sizeof cur); row_i++; bscore += 100; strcpy(msg, "NICE KNOTS!"); beep(8, 2, 988, 100, 6); if (row_i >= C.rows) { bscore += tries_l * 50; bover = 1; } } }
        } else if (kd & KEY_START || (touched == 2 && ty < 150)) { br_init(); msg[0] = 0; prevover = 0; }
        if (bover && !prevover) { prevover = 1; beep(8, 2, bover == 1 ? 1319 : 196, 110, 40); }
        rect(0, 0, 256, 192, BGC); text(8, 4, C.title, 0xFFFF);
        text(ox, oy - 10, "PATTERN", RGB15(20, 22, 22) | BIT(15)); int top = row_i > 3 ? row_i - 3 : 0;
        for (int i = 0; i < 8 && top + i < C.rows; i++) { for (int x = 0; x < C.threads; x++) rect(ox + x * cs, oy + i * (cs - 1), cs - 2, cs - 3, pal[tgt(x, top + i) % 6]); if (top + i == row_i) frame_rect(ox - 2, oy + i * (cs - 1) - 1, C.threads * cs + 1, cs - 1, YEL); }
        text(bx, oy - 10, "YOURS", RGB15(20, 22, 22) | BIT(15)); int first = row_i > 6 ? row_i - 6 : 0, line = 0;
        for (int r = first; r <= row_i && r < C.rows; r++, line++) for (int x = 0; x < C.threads; x++) { u8 v = r < row_i ? built[r][x] : cur[x]; rect(bx + x * cs, oy + line * (cs - 1), cs - 2, cs - 3, v == 255 ? RGB15(5, 6, 14) | BIT(15) : pal[v % 6]); }
        if (!bover) frame_rect(bx + cx * cs - 1, oy + (row_i - first) * (cs - 1) - 1, cs, cs - 1, 0xFFFF);
        for (int i = 0; i < C.npal; i++) { rect(10 + i * 24, 160, 20, 14, pal[i]); if (i == color) frame_rect(9 + i * 24, 159, 22, 16, 0xFFFF); }
        rect(150, 160, 52, 16, RGB15(8, 8, 18) | BIT(15)); text(156, 164, "HINT", 0xFFFF); rect(206, 160, 48, 16, RGB15(6, 14, 8) | BIT(15)); text(210, 164, "CHECK", 0xFFFF);
        snprintf(b, 40, "SCORE %d  TRIES %d", bscore, tries_l); text(8, 140, b, 0xFFFF); text(8, 180, msg, YEL);
        if (bover) { rect(0, 80, 256, 32, RGB15(0, 0, 0) | BIT(15)); ctext(86, bover == 1 ? "BRACELET FINISHED!" : "IT CAME OUT TANGLED", bover == 1 ? OKC : BADC); ctext(98, "START OR TAP: PLAY AGAIN", 0xFFFF); }
    }
}

int main(void) {
    defaultExceptionHandler();
    H = (const NrgHeader *)nr_gamedata;
    splash();
    videoSetModeSub(MODE_0_2D); setBackdropColorSub(RGB15(3, 4, 10)); lcdMainOnBottom(); snd_master(110);
    use_buf = 1; load_cfg(); rs ^= (u32)(REG_VCOUNT * 7919) ^ 0x9e3779b9u;
    if (C.mode == 1) br_run(); else m3_run();
    return 0;
}

// COSMOS KEEPER - Notareal Game Studios. DS god sim: keep the universe through 12 stages from the Big Bang to the Singularity.
// Spore (shape what lives in each stage) x The Sims (look after the people of the late stages) x Cell to Singularity (idle upgrade climb).
// All stages, upgrades, traits, facts, people and endings are the GSDT section of the data block (kit/nrgodsim.js). Stylus-driven.
#include <nds.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "nrg.h"
#include "font_bin.h"
#include "splash_bin.h"

void snd_psg_ch(int ch, int duty, int hz, int vol, int pan);
void snd_noise_ch(int ch, int hz, int vol, int pan);
void snd_master(int vol);
void snd_input(void);
extern const unsigned char nr_gamedata[];

#define RGB(r, g, b) (RGB15(r, g, b) | BIT(15))
#define C_BG RGB(2, 2, 6)
#define C_BTN RGB(5, 5, 11)
#define C_BTNH RGB(11, 11, 20)
#define C_ACC RGB(12, 24, 31)
#define C_GOLD RGB(30, 25, 8)
#define C_WHITE RGB(31, 31, 31)
#define C_GREY RGB(15, 15, 19)
#define C_RED RGB(30, 6, 6)
#define C_GRN RGB(8, 28, 12)
static u16 topb[256 * 192], botb[256 * 192]; static u16 *topv, *botv, *fb;
static inline void px(int x, int y, u16 c) { if ((unsigned)x < 256 && (unsigned)y < 192) fb[y * 256 + x] = c; }
static void rect(int x, int y, int w, int h, u16 c) { for (int j = y; j < y + h; j++) for (int i = x; i < x + w; i++) px(i, j, c); }
static void frame(int x, int y, int w, int h, u16 c) { for (int i = x; i < x + w; i++) { px(i, y, c); px(i, y + h - 1, c); } for (int j = y; j < y + h; j++) { px(x, j, c); px(x + w - 1, j, c); } }
static void glyph(int x, int y, int ch, u16 c) { if (ch >= 'a' && ch <= 'z') ch -= 32; if (ch <= 32 || ch > 127) return; const u8 *g = font_bin + (ch - 32) * 64; for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) if (g[j * 8 + i]) px(x + i, y + j, c); }
static void text(int x, int y, const char *s, u16 c) { for (; *s; s++, x += 8) glyph(x, y, *s, c); }
static void textc(int cx, int y, const char *s, u16 c) { text(cx - (int)strlen(s) * 4, y, s, c); }
static void disc(int cx, int cy, int r, u16 c) { for (int j = -r; j <= r; j++) for (int i = -r; i <= r; i++) if (i * i + j * j <= r * r + r / 2) px(cx + i, cy + j, c); }
static void ring(int cx, int cy, int r, u16 c) { for (int a = 0; a < 64; a++) px(cx + ((cosLerp(a * 512) * r) >> 12), cy + ((sinLerp(a * 512) * r) >> 12), c); }
static u16 mix(u16 a, u16 b, int t, int n) { int r = ((a & 31) * (n - t) + (b & 31) * t) / n, g = (((a >> 5) & 31) * (n - t) + ((b >> 5) & 31) * t) / n, bl = (((a >> 10) & 31) * (n - t) + ((b >> 10) & 31) * t) / n; return RGB(r, g, bl); }
static void grad(int y0, int y1, u16 ca, u16 cb) { for (int y = y0; y < y1; y++) { u16 c = mix(ca, cb, y - y0, y1 - y0); for (int x = 0; x < 256; x++) fb[y * 256 + x] = c; } }

// ---------------------------------------------------------------- data (GSDT)
static const u8 *D; static int nst, nup, ntr, npe; static char gtitle[33];
static int rd16(const u8 *p) { return p[0] | p[1] << 8; } static u32 rd32(const u8 *p) { return p[0] | p[1] << 8 | p[2] << 16 | (u32)p[3] << 24; }
#define SREC(s) (D + 48 + (s) * 92)
#define SNAME(s) ((const char *)SREC(s))
#define SERA(s) ((const char *)SREC(s) + 20)
#define SRES(s) ((const char *)SREC(s) + 34)
#define SSLOT(s, k) ((const char *)SREC(s) + 46 + (k) * 10)
#define SGOAL(s) ((long long)rd32(SREC(s) + 76))
#define SCLICK(s) ((long long)rd32(SREC(s) + 80))
#define SKYA(s) ((u16)(rd16(SREC(s) + 84) | BIT(15)))
#define SKYB(s) ((u16)(rd16(SREC(s) + 86) | BIT(15)))
#define SACC(s) ((u16)(rd16(SREC(s) + 88) | BIT(15)))
#define SENV(s) (SREC(s)[90])
#define UREC(s, k) (D + 48 + nst * 92 + ((s) * 6 + (k)) * 24)
#define TREC(s, k, o) (D + 48 + nst * 92 + nst * 6 * 24 + ((s) * 9 + (k) * 3 + (o)) * 16)
#define FACT(s, i) ((const char *)(D + 48 + nst * 92 + nst * 6 * 24 + nst * 9 * 16 + ((s) * 2 + (i)) * 40))
#define PERSON(i) ((const char *)(D + 48 + nst * 92 + nst * 6 * 24 + nst * 9 * 16 + nst * 2 * 40 + (i) * 14))
#define ENDING(i) ((const char *)(D + 48 + nst * 92 + nst * 6 * 24 + nst * 9 * 16 + nst * 2 * 40 + 12 * 14 + (i) * 24))
static int load_data(void)
{
    const NrgHeader *h = (const NrgHeader *)nr_gamedata; if (!h->used) return 0;
    for (unsigned i = 0; i < h->count; i++) if (!memcmp(h->sec[i].id, "GSDT", 4))
    {   D = nr_gamedata + h->sec[i].off; nst = D[0]; nup = D[1]; ntr = D[2]; npe = D[3]; memcpy(gtitle, D + 8, 32); gtitle[32] = 0; return nst == 12 && nup == 6 && ntr == 9 && npe == 12; }
    return 0;
}

// ---------------------------------------------------------------- state
enum { S_TITLE, S_PLAY, S_END, S_NODATA };
enum { T_TAP, T_UP, T_EVO, T_PPL, T_TIME };
static int scr = S_TITLE, tab, st, endtier; static long long res, facc, total; static int own[12][6], pick[12][3], need[6][3], selp, needt, tickf, sec, shake, ftick; static long long frames; static int msgt; static char msg[40];
static unsigned rng_s = 77; static unsigned rnd(void) { rng_s = rng_s * 1664525u + 1013904223u; return rng_s >> 8; }
static void say(const char *s) { strncpy(msg, s, 39); msg[39] = 0; msgt = 150; }
static int rr;
static void beep(int hz, int hz2) { snd_psg_ch(12 + (rr ^= 1), 2, hz, 90, 64); if (hz2) snd_psg_ch(12 + (rr ^= 1), 2, hz2, 70, 64); }
static void thud(void) { snd_noise_ch(14, 900, 70, 64); }
static void fmt(char *o, long long v) { if (v >= 10000000000LL) sprintf(o, "%lldB", v / 1000000000); else if (v >= 1000000000) sprintf(o, "%lld.%dB", v / 1000000000, (int)(v / 100000000 % 10)); else if (v >= 10000000) sprintf(o, "%lldM", v / 1000000); else if (v >= 1000000) sprintf(o, "%lld.%dM", v / 1000000, (int)(v / 100000 % 10)); else if (v >= 10000) sprintf(o, "%lldK", v / 1000); else sprintf(o, "%lld", v); }
static int people_on(void) { return st >= 8; }
static int people_mult(void) { if (!people_on()) return 1000; int s = 0; for (int i = 0; i < 6; i++) s += need[i][0] + need[i][1] + need[i][2]; return 500 + s * 1000 / (18 * 100); }   // 500..1500
static int evo_mult(void) { int m = 1000; for (int k = 0; k < 3; k++) { int o = pick[st][k]; if (o < 0) continue; const u8 *t = TREC(st, k, o); int b = t[12] * 10; if (t[13] == SENV(st)) b *= 2; m += b; } return m; }
static int legacy_mult(void) { return 1000 + 50 * st; }
static long long mult(void) { return (long long)evo_mult() * legacy_mult() / 1000 * people_mult() / 1000; }   // permille
static long long ucost(int s, int k) { long long c = rd32(UREC(s, k) + 16); for (int i = 0; i < own[s][k] && i < 60; i++) c = c * 118 / 100 + 1; return c; }
static long long rate_base(void) { long long r = SGOAL(st) / 2000; for (int k = 0; k < 6; k++) r += (long long)rd32(UREC(st, k) + 20) * own[st][k]; return r; }
static long long rate(void) { return rate_base() * mult() / 1000; }
static long long tapv(void) { long long v = SCLICK(st) * mult() / 1000; return v < 1 ? 1 : v; }

static void new_game(void)
{
    memset(own, 0, sizeof own); memset(pick, 255, sizeof pick); st = 0; res = 0; facc = 0; total = 0; frames = 0; tab = T_TAP; selp = 0; ftick = 0; rng_s = 4242;
    for (int i = 0; i < 6; i++) for (int j = 0; j < 3; j++) need[i][j] = 70;
    say("LET THERE BE LIGHT");
}
static void advance(void)
{
    if (st + 1 >= nst) { int tm = (int)(frames / 3600), good = 0; for (int i = 0; i < 6; i++) good += (need[i][0] + need[i][1] + need[i][2]) / 3; good /= 6; int pc = 0; for (int s = 0; s < nst; s++) for (int k = 0; k < 3; k++) if (pick[s][k] >= 0 && TREC(s, k, pick[s][k])[13] == SENV(s)) pc++;
        endtier = (tm <= 60 ? 1 : 0) + (good >= 55 ? 1 : 0) + (pc >= 20 ? 1 : 0); if (tm > 120 && endtier > 0 && pc < 10) endtier--; scr = S_END; return; }
    st++; res = 0; facc = 0; ftick = 0; tab = T_TAP; beep(660, 990); snd_psg_ch(11, 2, 1320, 80, 64); say(SNAME(st)); shake = 20;
}

// ---------------------------------------------------------------- touch + buttons
static int pdown, pheld, prel, tx_, ty_, holdf, lastx, lasty;
static int hit(int x, int y, int w, int h, int ax, int ay) { return ax >= x && ax < x + w && ay >= y && ay < y + h; }
static int button(int x, int y, int w, int h, const char *lab, int on, int repeat)
{
    int inside = hit(x, y, w, h, tx_, ty_) && pheld; rect(x, y, w, h, on ? C_BTNH : inside ? C_BTNH : C_BTN); frame(x, y, w, h, on ? C_GOLD : C_ACC);
    text(x + (w - (int)strlen(lab) * 8) / 2, y + (h - 8) / 2, lab, on ? C_GOLD : C_WHITE);
    if (!hit(x, y, w, h, tx_, ty_)) return 0; if (pdown) return 1; if (repeat && pheld && holdf > 16 && (holdf % 5) == 0) return 1; return 0;
}

// ---------------------------------------------------------------- top screen art
static void art(int s, int t)
{
    u16 ac = SACC(s); int cx = 128, cy = 96;
    switch (s)
    {
    case 0: for (int i = 0; i < 6; i++) ring(cx, cy, (t / 2 + i * 14) % 90 + 4, mix(ac, SKYB(s), i, 6)); disc(cx, cy, 5 + (t >> 4 & 3), C_WHITE); break;
    case 1: for (int i = 0; i < 60; i++) { int a = i * 1000 + t * 12, r = 6 + i * 2; px(cx + ((cosLerp(a) * r) >> 12), cy + ((sinLerp(a) * r) >> 13) , i % 3 ? C_WHITE : ac); } disc(cx, cy, 5, C_GOLD); break;
    case 2: disc(cx, cy, 14, C_GOLD); for (int k = 0; k < 5; k++) { int r = 28 + k * 16, a = t * (6 - k) * 6 + k * 3000; ring(cx, cy, r, RGB(8, 8, 14)); disc(cx + ((cosLerp(a) * r) >> 12), cy + ((sinLerp(a) * r) >> 12), 2 + (k == 2) * 2, k == 2 ? RGB(10, 18, 31) : ac); } break;
    case 3: for (int i = 0; i < 18; i++) { int x = (i * 53 + t / 3) % 256, y = 40 + (i * 37) % 120 + ((sinLerp(t * 40 + i * 900) * 4) >> 12); disc(x, y, 2 + i % 3, i % 2 ? ac : RGB(10, 28, 20)); } break;
    case 4: for (int i = 0; i < 6; i++) { int x = (i * 60 + t) % 300 - 20, y = 50 + i * 20 + ((sinLerp(t * 30 + i * 1500) * 6) >> 12); disc(x, y, 6, ac); rect(x - 12, y - 1, 6, 3, ac); px(x + 3, y - 2, C_WHITE); } break;
    case 5: rect(0, 150, 256, 42, RGB(8, 16, 4)); for (int i = 0; i < 40; i++) { int w = 40 - i; rect(150 + (40 - w) / 2 - 20, 110 + i, w + 40, 1, RGB(14 + i / 6, 8, 4)); } disc(170, 100 + ((t >> 3) & 3), 5, C_RED); rect(30, 120, 60, 20, ac); rect(80, 105, 12, 22, ac); disc(90, 102, 7, ac); rect(34, 140, 6, 12, ac); rect(70, 140, 6, 12, ac); break;
    case 6: rect(0, 150, 256, 42, RGB(8, 14, 8)); for (int i = 0; i < 5; i++) { rect(20 + i * 50, 100, 5, 52, RGB(10, 6, 3)); disc(22 + i * 50, 96, 16, RGB(4, 14 + i, 5)); } disc(120 + ((t >> 2) % 60), 142, 9, ac); disc(112 + ((t >> 2) % 60), 136, 5, ac); break;
    case 7: rect(0, 150, 256, 42, RGB(8, 6, 4)); { int f = 4 + ((t >> 2) & 3); disc(cx, 140, f, C_RED); disc(cx, 136 - f, f / 2 + 2, ac); disc(cx, 130 - f, 2, C_GOLD); } for (int i = 0; i < 4; i++) { int a = i * 2000 + 1000; disc(cx + ((cosLerp(a) * 50) >> 12), 150 + ((sinLerp(a) * 14) >> 12), 6, RGB(24, 16, 10)); rect(cx + ((cosLerp(a) * 50) >> 12) - 3, 136 + ((sinLerp(a) * 14) >> 12), 6, 8, RGB(24, 16, 10)); } break;
    case 8: rect(0, 150, 256, 42, RGB(14, 12, 6)); for (int i = 0; i < 9; i++) { int h = 20 + (i * 37) % 50; rect(14 + i * 26, 150 - h, 20, h, mix(RGB(16, 14, 8), ac, i, 9)); if (i % 2) rect(20 + i * 26, 150 - h + 6, 4, 4, C_GOLD); } break;
    case 9: rect(0, 150, 256, 42, RGB(8, 8, 8)); for (int i = 0; i < 4; i++) { rect(30 + i * 56, 90, 16, 62, RGB(12, 8, 6)); for (int p = 0; p < 6; p++) disc(38 + i * 56 + p * 2, 86 - ((t / 2 + p * 14 + i * 9) % 70), 4 + p / 2, RGB(11, 11, 12)); } break;
    case 10: for (int i = 0; i < 16; i++) { int x = 24 + (i % 4) * 70, y = 34 + (i / 4) * 42; for (int j = 0; j < 4; j++) if (j != i % 4 || 1) { int x2 = 24 + j * 70, y2 = 34 + ((i / 4 + 1) % 4) * 42; if (j == i % 4) for (int p = 0; p < 20; p++) px(x + (x2 - x) * p / 20, y + (y2 - y) * p / 20, RGB(6, 14, 20)); } disc(x, y, 3 + (((t >> 3) + i) & 1), ac); } break;
    default: disc(cx, cy, 14, ac); for (int k = 0; k < 4; k++) { ring(cx, cy, 30 + k * 12, mix(ac, RGB(6, 3, 14), k, 5)); disc(cx + ((cosLerp(t * 20 + k * 2000) * (30 + k * 12)) >> 12), cy + ((sinLerp(t * 20 + k * 2000) * (30 + k * 12)) >> 12), 3, C_WHITE); } break;
    }
}
static void creature(int x, int y)
{
    // Spore-style preview: the shape grows from the three picks of the current stage
    int a = pick[st][0] + 1, b = pick[st][1] + 1, c = pick[st][2] + 1; u16 col = SACC(st); rect(x - 24, y - 20, 48, 40, RGB(2, 2, 6)); frame(x - 24, y - 20, 48, 40, C_GREY);
    disc(x, y, 6 + a * 2, col); disc(x - 6 - b * 2, y - 4, 2 + b, mix(col, C_WHITE, 1, 3)); disc(x + 6 + b * 2, y - 4, 2 + b, mix(col, C_WHITE, 1, 3));
    for (int i = 0; i < c * 2; i++) { rect(x - 8 + i * 4, y + 6 + a, 2, 4 + c, col); }
    px(x - 2, y - 2, C_WHITE); px(x + 2, y - 2, C_WHITE);
}
static void draw_top(void)
{
    fb = topb; if (scr == S_TITLE) { memcpy(topb, splash_bin, sizeof topb); return; }
    if (scr == S_NODATA) { grad(0, 192, C_BG, C_BG); return; }
    if (scr == S_END) { grad(0, 192, RGB(2, 0, 8), RGB(14, 6, 20)); for (int i = 0; i < 50; i++) px((i * 97) % 256, (i * 61 + frames / 5) % 192, C_WHITE); textc(128, 40, "THE UNIVERSE ENDS", C_GOLD); textc(128, 70, "YOU WERE", C_WHITE); textc(128, 86, ENDING(endtier), C_ACC); return; }
    grad(0, 192, SKYA(st), SKYB(st)); for (int i = 0; i < 40; i++) px((i * 71 + st * 13) % 256, (i * 47) % 100, mix(SKYB(st), C_WHITE, 1 + (i + (int)(frames >> 4)) % 3, 4));
    art(st, (int)frames);
    rect(0, 0, 256, 26, RGB(1, 1, 4)); text(4, 3, SNAME(st), C_GOLD); text(256 - 4 - (int)strlen(SERA(st)) * 8, 3, SERA(st), C_ACC);
    char a[40], b[20]; fmt(b, res); char g[20]; fmt(g, SGOAL(st)); sprintf(a, "%s %s/%s", SRES(st), b, g); text(4, 15, a, C_WHITE);
    int pr = (int)(res * 100 / SGOAL(st)); if (pr > 100) pr = 100; rect(0, 26, 256, 4, RGB(1, 1, 4)); rect(0, 26, 256 * pr / 100, 4, res >= SGOAL(st) ? C_GOLD : C_GRN);
    for (int i = 0; i < nst; i++) { int x = 8 + i * 21; disc(x, 180, 3, i < st ? C_GOLD : i == st ? C_WHITE : C_GREY); }
    rect(0, 156, 256, 12, RGB(1, 1, 4)); textc(128, 158, FACT(st, (ftick / 420) & 1), C_WHITE);
    char r[24]; fmt(b, rate()); sprintf(r, "+%s/S", b); text(256 - 8 * (int)strlen(r) - 4, 15, r, C_GRN);
    creature(34, 70); if (msgt) textc(128, 140, msg, C_GOLD);
}

// ---------------------------------------------------------------- bottom screen
static const char *TABN[5] = { "TAP", "BUILD", "EVOLVE", "PEOPLE", "TIME" };
static void tabs(void) { for (int i = 0; i < 5; i++) if (button(i * 51, 0, 50, 16, TABN[i], i == tab, 0)) tab = i; }
static void bottom_tap(void)
{
    int r = 44 + (shake > 0 ? shake / 4 : 0); disc(128, 82, r, mix(SKYA(st), SACC(st), 1, 3)); ring(128, 82, r + 2, SACC(st)); disc(128, 82, r - 14, SACC(st));
    textc(128, 78, SRES(st), C_BG); char a[24], b[16]; fmt(b, tapv()); sprintf(a, "+%s", b); textc(128, 90, a, C_BG);
    if (pdown && hit(84, 38, 88, 88, tx_, ty_)) { res += tapv(); total += tapv(); shake = 10; snd_psg_ch(12 + (rr ^= 1), 2, 500 + (int)(rnd() % 400), 70, 64); }
    char l[40]; fmt(b, rate()); sprintf(l, "AUTO +%s PER SEC", b); textc(128, 132, l, C_GRN);
    if (res >= SGOAL(st)) { if (button(40, 150, 176, 28, st + 1 >= nst ? "END THE UNIVERSE" : "ADVANCE ERA", 1, 0)) advance(); } else textc(128, 158, "REACH THE GOAL TO ADVANCE", C_GREY);
}
static void bottom_up(void)
{
    for (int k = 0; k < 6; k++)
    {   int y = 18 + k * 28; long long c = ucost(st, k); int can = res >= c; char a[40], b[20]; fmt(b, c);
        if (button(2, y, 252, 26, "", 0, 1) && can) { res -= c; own[st][k]++; beep(1000, 1320); } else if (hit(2, y, 252, 26, tx_, ty_) && pdown && !can) { thud(); say("NOT ENOUGH"); }
        text(8, y + 3, (const char *)UREC(st, k), can ? C_WHITE : C_GREY); sprintf(a, "X%d  +%lld/S", own[st][k], (long long)rd32(UREC(st, k) + 20)); text(8, y + 14, a, C_ACC); sprintf(a, "%s", b); text(248 - 8 * (int)strlen(a), y + 3, a, can ? C_GOLD : C_RED); }
}
static void bottom_evo(void)
{
    char a[40]; sprintf(a, "SHAPE THE %s  (%s)", SNAME(st), "*=BEST"); text(4, 19, a, C_ACC);
    static const char *ENVN[4] = { "HOT", "COLD", "WET", "DRY" };
    sprintf(a, "WORLD IS %s  BONUS X%d.%d", SENV(st) < 4 ? ENVN[SENV(st)] : "?", evo_mult() / 1000, evo_mult() / 100 % 10); text(4, 29, a, C_GOLD);
    for (int k = 0; k < 3; k++) { int y = 42 + k * 48; text(4, y, SSLOT(st, k), C_WHITE);
        for (int o = 0; o < 3; o++) { const u8 *t = TREC(st, k, o); char l[16]; sprintf(l, "%s%.10s", t[13] == SENV(st) ? "*" : "", (const char *)t); if (button(2 + o * 85, y + 12, 83, 28, l, pick[st][k] == o, 0)) { pick[st][k] = o; beep(1200, 0); } } }
}
static void bottom_ppl(void)
{
    if (!people_on()) { textc(128, 70, "NO ONE LIVES HERE YET", C_GREY); textc(128, 86, "PEOPLE ARRIVE AT", C_GREY); textc(128, 98, SNAME(8), C_GOLD); return; }
    static const char *NN[3] = { "FOOD", "FUN", "SOCIAL" };
    for (int i = 0; i < 6; i++) { int y = 18 + i * 20; int on = i == selp; if (button(2, y, 252, 19, "", on, 0)) selp = i; text(6, y + 5, PERSON(i), on ? C_GOLD : C_WHITE);
        for (int j = 0; j < 3; j++) { int x = 90 + j * 54; rect(x, y + 6, 50, 6, C_BG); rect(x, y + 6, need[i][j] / 2, 6, need[i][j] > 35 ? C_GRN : C_RED); } }
    long long cost = SGOAL(st) / 50 + 1; char b[16], a[40]; fmt(b, cost);
    for (int j = 0; j < 3; j++) { static const char *BN[3] = { "FEED", "PARTY", "TALK" }; if (button(2 + j * 85, 142, 83, 22, BN[j], 0, 0)) { if (res >= cost) { res -= cost; need[selp][j] += 45; if (need[selp][j] > 100) need[selp][j] = 100; beep(900 + j * 200, 1400); } else { thud(); say("NOT ENOUGH"); } } }
    sprintf(a, "EACH COSTS %s  MOOD X%d.%d", b, people_mult() / 1000, people_mult() / 100 % 10); text(4, 170, a, C_ACC); sprintf(a, "%s NEEDS: %s", PERSON(selp), NN[0]); (void)a;
}
static void bottom_time(void)
{
    for (int i = 0; i < nst; i++) { int y = 18 + i * 14; u16 c = i < st ? C_GOLD : i == st ? C_WHITE : C_GREY; text(4, y, SERA(i), c); text(84, y, SNAME(i), c); if (i == st) text(246, y, "<", C_WHITE); }
}
static void bottom_play(void)
{
    grad(0, 192, C_BG, RGB(4, 3, 10)); tabs();
    switch (tab) { case T_TAP: bottom_tap(); break; case T_UP: bottom_up(); break; case T_EVO: bottom_evo(); break; case T_PPL: bottom_ppl(); break; default: bottom_time(); }
}
static void bottom_title(void) { grad(0, 192, C_BG, C_BG); textc(128, 50, gtitle, C_GOLD); textc(128, 70, "KEEP THE UNIVERSE", C_WHITE); textc(128, 82, "FROM THE BIG BANG", C_WHITE); textc(128, 94, "TO THE SINGULARITY", C_WHITE); if (button(56, 120, 144, 30, "BEGIN", 0, 0)) { new_game(); scr = S_PLAY; } }
static void bottom_end(void)
{
    grad(0, 192, C_BG, C_BG); char a[40]; int tm = (int)(frames / 3600); sprintf(a, "TIME %d MIN", tm); textc(128, 40, a, C_WHITE); sprintf(a, "RANK %d OF 4", endtier + 1); textc(128, 56, a, C_GOLD);
    for (int i = 0; i < 4; i++) textc(128, 80 + i * 12, ENDING(i), i == endtier ? C_GOLD : C_GREY);
    if (button(56, 140, 144, 30, "PLAY AGAIN", 0, 0)) scr = S_TITLE;
}
static void bottom_nodata(void) { grad(0, 192, C_BG, C_BG); textc(128, 70, "NO GAME DATA", C_RED); textc(128, 90, "BUILD THIS ROM IN THE", C_WHITE); textc(128, 102, "NOTAREAL STUDIO", C_WHITE); }

static void tick(void)
{
    frames++; ftick++; if (shake > 0) shake--; long long inc = rate_base() * mult(); facc += inc; long long g = facc / 60000; facc %= 60000; if (g) { res += g; total += g; }
    if (res > SGOAL(st) * 100) res = SGOAL(st) * 100;
    if (people_on() && ++tickf >= 180) { tickf = 0; for (int i = 0; i < 6; i++) for (int j = 0; j < 3; j++) { need[i][j] -= 1 + (int)(rnd() % 2); if (need[i][j] < 0) need[i][j] = 0; } }
}

int main(void)
{
    defaultExceptionHandler(); powerOn(POWER_ALL_2D); lcdMainOnTop();
    videoSetMode(MODE_5_2D); videoSetModeSub(MODE_5_2D); vramSetBankA(VRAM_A_MAIN_BG); vramSetBankC(VRAM_C_SUB_BG);
    int b1 = bgInit(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0), b2 = bgInitSub(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0); topv = bgGetGfxPtr(b1); botv = bgGetGfxPtr(b2);
    for (int i = 0; i < 60; i++) { swiWaitForVBlank(); snd_input(); } snd_master(110);
    if (!load_data()) scr = S_NODATA;
    for (;;)
    {
        snd_input(); scanKeys(); int kh = keysHeld(), kd = keysDown(); touchPosition t; touchRead(&t);
        int was = pheld; pheld = (kh & KEY_TOUCH) ? 1 : 0; pdown = pheld && !was; prel = !pheld && was; if (pheld) { tx_ = t.px; ty_ = t.py; holdf = pdown ? 0 : holdf + 1; lastx = tx_; lasty = ty_; } else if (!prel) { tx_ = -50; ty_ = -50; } else { tx_ = lastx; ty_ = lasty; }
        if (scr == S_TITLE && (kd & (KEY_A | KEY_START))) { new_game(); scr = S_PLAY; }
        if (scr == S_PLAY) tick();
        draw_top(); fb = botb;
        switch (scr) { case S_TITLE: bottom_title(); break; case S_PLAY: bottom_play(); break; case S_END: bottom_end(); break; default: bottom_nodata(); }
        if (msgt) msgt--;
        swiWaitForVBlank(); dmaCopy(topb, topv, sizeof topb); dmaCopy(botb, botv, sizeof botb);
    }
}

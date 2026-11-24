// FRIENDSHIP BRACELETS - Notareal Game Studios. DS bead-shop sim: buy beads, design 12-bead strands (or load one of 30 ready patterns),
// sell at the stall to customers with their own favourite styles/colours/budgets, 28 days, 8 chapters, 8 endings. Stylus-driven.
// Everything (beads, prices, style tags, patterns, customers, chapters, endings) is the BRDT section of the data block (kit/nrbracelet.js).
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
#define C_BG RGB(5, 2, 8)
#define C_BG2 RGB(11, 5, 14)
#define C_BTN RGB(9, 4, 12)
#define C_BTNH RGB(16, 8, 20)
#define C_PINK RGB(30, 14, 22)
#define C_GOLD RGB(30, 25, 8)
#define C_WHITE RGB(31, 31, 31)
#define C_GREY RGB(18, 16, 20)
#define C_RED RGB(30, 6, 6)
#define C_GRN RGB(8, 28, 12)
static u16 topb[256 * 192], botb[256 * 192]; static u16 *topv, *botv, *fb;
static inline void px(int x, int y, u16 c) { if ((unsigned)x < 256 && (unsigned)y < 192) fb[y * 256 + x] = c; }
static void rect(int x, int y, int w, int h, u16 c) { int x1 = x + w, y1 = y + h; if (x < 0) x = 0; if (y < 0) y = 0; if (x1 > 256) x1 = 256; if (y1 > 192) y1 = 192; for (int j = y; j < y1; j++) { u16 *d = fb + j * 256; for (int i = x; i < x1; i++) d[i] = c; } }
static void frame(int x, int y, int w, int h, u16 c) { for (int i = x; i < x + w; i++) { px(i, y, c); px(i, y + h - 1, c); } for (int j = y; j < y + h; j++) { px(x, j, c); px(x + w - 1, j, c); } }
static void glyph(int x, int y, int ch, u16 c) { if (ch >= 'a' && ch <= 'z') ch -= 32; if (ch <= 32 || ch > 127) return; const u8 *g = font_bin + (ch - 32) * 64; for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) if (g[j * 8 + i]) px(x + i, y + j, c); }
static void text(int x, int y, const char *s, u16 c) { for (; *s; s++, x += 8) glyph(x, y, *s, c); }
static void textc(int cx, int y, const char *s, u16 c) { text(cx - (int)strlen(s) * 4, y, s, c); }
static void disc(int cx, int cy, int r, u16 c) { for (int j = -r; j <= r; j++) for (int i = -r; i <= r; i++) if (i * i + j * j <= r * r + r / 2) px(cx + i, cy + j, c); }
static void grad_raw(u16 ca, u16 cb, u16 *d) { for (int y = 0; y < 192; y++) { int t = y * 32 / 192; int r = ((ca & 31) * (32 - t) + (cb & 31) * t) >> 5, g = (((ca >> 5) & 31) * (32 - t) + ((cb >> 5) & 31) * t) >> 5, b = (((ca >> 10) & 31) * (32 - t) + ((cb >> 10) & 31) * t) >> 5; for (int x = 0; x < 256; x++) d[y * 256 + x] = RGB(r, g, b); } }
static u16 gcache[256 * 192]; static int ghave;
static void grad(u16 ca, u16 cb) { if (ca != C_BG || cb != C_BG2) { grad_raw(ca, cb, fb); return; } if (!ghave) { grad_raw(ca, cb, gcache); ghave = 1; } memcpy(fb, gcache, sizeof gcache); }

// ---------------------------------------------------------------- data (BRDT)
static const u8 *STY, *BD, *PT, *CU, *CH, *EN; static const u8 *D; static int nbead, nsty, npat, ncust, nchap, nend, days, NB, startm; static char gtitle[33];
static int rd16(const u8 *p) { return p[0] | p[1] << 8; } static u32 rd32(const u8 *p) { return p[0] | p[1] << 8 | p[2] << 16 | (u32)p[3] << 24; }
static int load_data(void)
{
    const NrgHeader *h = (const NrgHeader *)nr_gamedata; if (!h->used) return 0;
    for (unsigned i = 0; i < h->count; i++) if (!memcmp(h->sec[i].id, "BRDT", 4))
    {   D = nr_gamedata + h->sec[i].off; nbead = D[0]; nsty = D[1]; npat = D[2]; ncust = D[3]; nchap = D[4]; nend = D[5]; startm = rd16(D + 6); days = D[8]; NB = D[9]; memcpy(gtitle, D + 10, 32); gtitle[32] = 0;
        STY = D + 50; BD = STY + nsty * 10; PT = BD + nbead * 24; CU = PT + npat * (14 + NB); CH = CU + ncust * 20; EN = CH + nchap * 26; return nbead > 0 && NB == 12 && ncust > 0; }
    return 0;
}
#define BNAME(i) ((const char *)(BD + (i) * 24))
#define BRGB(i) ((u16)(rd16(BD + (i) * 24 + 14) | BIT(15)))
#define BKIND(i) (BD[(i) * 24 + 16])
#define BPRICE(i) (BD[(i) * 24 + 17])
#define BMASK(i) (rd32(BD + (i) * 24 + 18))
#define BLET(i) (BD[(i) * 24 + 22])
#define CGOAL(k) (rd16(CH + (k) * 26 + 24))

// ---------------------------------------------------------------- game state
enum { S_TITLE, S_HOME, S_SHOP, S_DESIGN, S_SELL, S_DAYEND, S_END, S_NODATA };
typedef struct { u8 b[12]; u8 q; u32 mask; u16 cost; } Br;
static int scr = S_TITLE, money, rep, day, chap, earned, soldtot, soldtoday, earntoday, nbr, selb, slot, patidx, selbead, price;
static int stock[64]; static u8 strand[12]; static Br br[12];
static int cq[8], ncq, cqi, patience; static char msg[40], cmsg[40]; static int msgt;
static unsigned rng_s; static unsigned rnd(void) { rng_s = rng_s * 1664525u + 1013904223u; return rng_s >> 8; }
static void say(const char *s) { strncpy(msg, s, 39); msg[39] = 0; msgt = 200; }
static int rr;
static void beep(int hz, int hz2) { snd_psg_ch(12 + (rr ^= 1), 2, hz, 90, 64); if (hz2) snd_psg_ch(12 + (rr ^= 1), 2, hz2, 70, 64); }
static void thud(void) { snd_noise_ch(14, 900, 70, 64); }
static void money_s(char *o, int c) { sprintf(o, "$%d.%02d", c / 100, c % 100); }

// strand analysis -> cost, style mask, quality 0-100; returns number of filled slots
static int analyse(const u8 *s, int *cost, u32 *mask, int *q)
{
    int n = 0, c = 0, lt = 0, ch = 0, st = 0, dist = 0; u32 m = 0; int seen[64] = { 0 };
    for (int i = 0; i < 12; i++) if (s[i] < nbead) { n++; c += BPRICE(s[i]); m |= BMASK(s[i]); int k = BKIND(s[i]); lt += k == 1; ch += k == 2; st += k == 3; if (!seen[s[i]]) { seen[s[i]] = 1; dist++; } }
    int sym = 0; for (int i = 0; i < 6; i++) sym += s[i] == s[11 - i] && s[i] < nbead; int rep_ = 0;
    for (int p = 1; p <= 6; p++) { if (12 % p) continue; int mm = 0; for (int i = 0; i + p < 12; i++) mm += s[i] == s[i + p] && s[i] < nbead; int sc = mm * 30 / (12 - p); if (p == 1 && dist == 1) sc = 10; if (sc > rep_) rep_ = sc; }
    int harm = dist <= 3 ? 20 : dist <= 5 ? 14 : dist <= 7 ? 8 : 2, bonus = lt * 4 + ch * 5 + st * 4; if (bonus > 20) bonus = 20;
    int qq = sym * 5 + rep_ + harm + bonus; if (qq > 100) qq = 100; if (!n) qq = 0;
    if (cost) *cost = c; if (mask) *mask = m; if (q) *q = qq; return n;
}
static int sugg(const Br *b) { return b->cost * 3 + b->q * 12; }
static int cust_match(const Br *b, int ci)
{
    const u8 *c = CU + ci * 20; int m = 0; if (b->mask & (1u << c[14])) m += 35; if (c[15] != c[14] && (b->mask & (1u << c[15]))) m += 25; else if (c[15] == c[14] && (b->mask & (1u << c[14]))) m += 25;
    for (int i = 0; i < 12; i++) if (b->b[i] == c[16]) { m += 20; break; } return m + b->q / 5;
}
static int willing(const Br *b, int ci) { long w = (long)sugg(b) * (40 + cust_match(b, ci)) / 100 * (100 + rep) / 100; long cap = CU[ci * 20 + 17] * 100L; return (int)(w > cap ? cap : w); }
static void style_tags(u32 mask, char *o) { o[0] = 0; int k = 0; for (int s = 0; s < nsty && k < 2; s++) if (mask & (1u << s)) { if (k) strcat(o, " "); strncat(o, (const char *)(STY + s * 10), 9); k++; } if (!k) strcpy(o, "PLAIN"); }

static void new_game(void)
{
    memset(stock, 0, sizeof stock); memset(strand, 255, 12); money = startm; rep = 0; day = 1; chap = 0; earned = 0; soldtot = 0; nbr = 0; selb = 0; slot = 0; patidx = 0; selbead = 0; rng_s = 12345;
    for (int i = 0; i < nbead; i++) stock[i] = BKIND(i) == 0 ? 6 : 2;
    say("OPEN YOUR BEAD SHOP");
}

// ---------------------------------------------------------------- touch + buttons
static int pdown, pheld, prel, tx_, ty_, holdf, lastx, lasty;
static int hit(int x, int y, int w, int h, int ax, int ay) { return ax >= x && ax < x + w && ay >= y && ay < y + h; }
static inline u16 mulc(u16 c, int f) { int r = (c & 31) * f >> 8, g = ((c >> 5) & 31) * f >> 8, b = ((c >> 10) & 31) * f >> 8; if (r > 31) r = 31; if (g > 31) g = 31; if (b > 31) b = 31; return RGB(r, g, b); }
static inline u16 mixc(u16 a, u16 b, int t) { int r = ((a & 31) * (256 - t) + (b & 31) * t) >> 8, g = (((a >> 5) & 31) * (256 - t) + ((b >> 5) & 31) * t) >> 8, bl = (((a >> 10) & 31) * (256 - t) + ((b >> 10) & 31) * t) >> 8; return RGB(r, g, bl); }
static int isq(int v) { int r = 0; while ((r + 1) * (r + 1) <= v) r++; return r; }
static void button_draw(int x, int y, int w, int h, u16 base, int pressed, u16 edge)
{   // glossy bevelled button: vertical gradient, light top edge, dark bottom edge, soft rounded corners
    for (int j = 0; j < h; j++) { int f = pressed ? 230 - j * 70 / h : 330 - j * 130 / h; rect(x, y + j, w, 1, mulc(base, f)); }
    for (int i = 1; i < w - 1; i++) { px(x + i, y, mixc(edge, C_WHITE, pressed ? 0 : 90)); px(x + i, y + h - 1, mulc(base, 90)); px(x + i, y + 1, mulc(base, pressed ? 200 : 380)); }
    for (int j = 1; j < h - 1; j++) { px(x, y + j, mulc(edge, 200)); px(x + w - 1, y + j, mulc(base, 100)); }
    px(x, y, C_BG); px(x + w - 1, y, C_BG); px(x, y + h - 1, C_BG); px(x + w - 1, y + h - 1, C_BG);
    for (int i = 2; i < w - 2; i++) px(x + i, y + h, RGB(2, 1, 4));
}
static int button(int x, int y, int w, int h, const char *lab, int on, int repeat)
{
    int inside = hit(x, y, w, h, tx_, ty_) && pheld; button_draw(x, y, w, h, on ? C_BTNH : inside ? C_BG2 : C_BTN, inside, on ? C_GOLD : C_PINK);
    int ty = y + (h - 8) / 2 + (inside ? 1 : 0), tx = x + (w - (int)strlen(lab) * 8) / 2; text(tx + 1, ty + 1, lab, RGB(2, 1, 4)); text(tx, ty, lab, on ? C_GOLD : C_WHITE);
    if (!hit(x, y, w, h, tx_, ty_)) return 0; if (pdown) { beep(880, 0); return 1; } if (repeat && pheld && holdf > 16 && (holdf % 5) == 0) return 1; return 0;
}

// ---------------------------------------------------------------- drawing
static void bead_raw(int cx, int cy, int r, int i, int sel)
{
    u16 c = BRGB(i); int k = BKIND(i);
    for (int j = -r; j <= r; j++) for (int x = -r; x <= r; x++) { int d2 = x * x + j * j; if (d2 <= r * r + r / 2 && k != 2 && k != 1) px(cx + x + 1, cy + j + 2, RGB(2, 1, 4)); }   // soft drop shadow
    if (k == 2)
    {   // faceted charm: four lit facets
        for (int j = -r; j <= r; j++) { int w = r - (j < 0 ? -j : j); for (int x = -w; x <= w; x++) { int f = (x < 0 ? (j < 0 ? 340 : 250) : (j < 0 ? 270 : 150)); if (x == 0 || j == 0) f = 400; px(cx + x, cy + j, mulc(c, f)); } }
        for (int j = -r; j <= r; j++) { int w = r - (j < 0 ? -j : j); px(cx - w, cy + j, mulc(c, 90)); px(cx + w, cy + j, mulc(c, 90)); }
        px(cx - 1, cy - r / 2, C_WHITE);
    }
    else if (k == 1)
    {   // letter cube with bevel
        int h = r; for (int j = -h; j <= h; j++) for (int x = -h; x <= h; x++) { int f = 256; if (j == -h || x == -h) f = 360; else if (j == h || x == h) f = 120; else f = 280 - (j + h) * 40 / (2 * h); px(cx + x, cy + j, mulc(c, f)); }
        if (r >= 6) { glyph(cx - 3, cy - 3, BLET(i), RGB(2, 2, 3)); glyph(cx - 4, cy - 4, BLET(i), RGB(31, 31, 31)); }
    }
    else
    {   // glass/plastic sphere: ambient + diffuse from upper-left, specular spot, darker rim
        int rr = r * r + r / 2, rl = isq(rr);
        for (int j = -r; j <= r; j++) for (int x = -r; x <= r; x++)
        {   int d2 = x * x + j * j; if (d2 > rr) continue; int nz = isq(rr - d2); int dot = (-115 * x - 141 * j + 179 * nz) / (rl ? rl : 1); if (dot < 0) dot = 0;
            int f = 70 + dot * 190 / 256; u16 cc = mulc(c, f); if (dot > 200) cc = mixc(cc, C_WHITE, (dot - 200) * (k == 3 ? 12 : 7)); px(cx + x, cy + j, cc); }
        if (k == 3) { px(cx + r / 2, cy + r / 2, C_WHITE); px(cx + r / 2 - 1, cy + r / 2, mixc(c, C_WHITE, 140)); px(cx + r / 2 + 1, cy + r / 2, mixc(c, C_WHITE, 140)); px(cx + r / 2, cy + r / 2 - 1, mixc(c, C_WHITE, 140)); px(cx + r / 2, cy + r / 2 + 1, mixc(c, C_WHITE, 140)); }
    }
    if (sel) { for (int a = 0; a < 24; a++) px(cx + ((cosLerp(a * 1365) * (r + 3)) >> 12), cy + ((sinLerp(a * 1365) * (r + 3)) >> 12), C_GOLD); }
}
// sprite caches: beads, the velvet pad and customer portraits are shaded per pixel once, then blitted (keeps the DS at full frame rate)
static u16 scratch[256 * 192]; static u16 bspr[64][3][20 * 20]; static u8 bhave[64][3]; static u16 padc[2][128 * 128]; static u8 padhave[2]; static u16 facec[112 * 108]; static int facekey = -1;
static void snap_clear(int h) { memset(scratch, 0, 256 * h * 2); }
static void bead(int cx, int cy, int r, int i, int sel)
{
    if (r < 6 || r > 8 || i < 0 || i >= 64) { bead_raw(cx, cy, r, i, sel); return; }
    int ri = r - 6; if (!bhave[i][ri]) { u16 *sv = fb; fb = scratch; snap_clear(20); bead_raw(10, 10, r, i, 0); fb = sv; for (int j = 0; j < 20; j++) memcpy(bspr[i][ri] + j * 20, scratch + j * 256, 40); bhave[i][ri] = 1; }
    const u16 *sp = bspr[i][ri]; int x0 = cx - 10, y0 = cy - 10; if (x0 >= 0 && y0 >= 0 && x0 + 20 <= 256 && y0 + 20 <= 192) { for (int j = 0; j < 20; j++) { u16 *d = fb + (y0 + j) * 256 + x0; const u16 *q = sp + j * 20; for (int x = 0; x < 20; x++) if (q[x]) d[x] = q[x]; } } else for (int j = 0; j < 20; j++) for (int x = 0; x < 20; x++) if (sp[j * 20 + x]) px(x0 + x, y0 + j, sp[j * 20 + x]);
    if (sel) { for (int a = 0; a < 24; a++) px(cx + ((cosLerp(a * 1365) * (r + 3)) >> 12), cy + ((sinLerp(a * 1365) * (r + 3)) >> 12), C_GOLD); }
}
static void pad_raw(int cx, int cy, int r)
{
    for (int j = -(r + 10); j <= r + 10; j++) { int w = isq(((r + 14) * (r + 14)) - j * j * (r + 14) * (r + 14) / ((r + 10) * (r + 10))); for (int x = -w; x <= w; x++) { int f = 120 - (x * x + j * j) * 60 / ((r + 14) * (r + 14)) + (j < 0 ? 12 : 0); px(cx + x, cy + j, mulc(RGB(14, 5, 12), f * 2)); } }
}
static void bracelet_viz(int cx, int cy, int r, const u8 *s, int sel)
{
    int pi = r > 40 ? 0 : 1; if (!padhave[pi]) { u16 *sv = fb; fb = scratch; snap_clear(128); pad_raw(64, 64, r); fb = sv; for (int j = 0; j < 128; j++) memcpy(padc[pi] + j * 128, scratch + j * 256, 256); padhave[pi] = 1; }
    for (int j = 0; j < 128; j++) { int yy = cy - 64 + j; if ((unsigned)yy >= 192) continue; for (int x = 0; x < 128; x++) { int xx = cx - 64 + x; u16 v = padc[pi][j * 128 + x]; if (v && (unsigned)xx < 256) fb[yy * 256 + xx] = v; } }
    for (int a = 0; a < 192; a++) { int ang = a * 170; int x = cx + ((cosLerp(ang) * r) >> 12), y = cy + ((sinLerp(ang) * r) >> 12); px(x, y, RGB(24, 22, 26)); px(x + 1, y, RGB(14, 12, 16)); px(x, y + 1, RGB(10, 8, 12)); }
    for (int i = 0; i < 12; i++) { int ang = i * 2731 - 8192, x = cx + ((cosLerp(ang) * r) >> 12), y = cy + ((sinLerp(ang) * r) >> 12);
        if (s[i] < nbead) bead(x, y, 8, s[i], i == sel); else { for (int a = 0; a < 24; a++) { px(x + ((cosLerp(a * 1365) * 8) >> 12), y + ((sinLerp(a * 1365) * 8) >> 12), i == sel ? C_GOLD : C_GREY); } } }
}
// shaded customer portrait: skin / hair / shirt / eyes vary per customer, mood follows their patience
static void face_raw(int cx, int cy, int seed, int mood)
{
    static const u16 SK[6] = { RGB(28, 22, 18), RGB(25, 18, 13), RGB(20, 13, 9), RGB(15, 9, 6), RGB(29, 24, 20), RGB(23, 16, 11) };
    static const u16 HR[8] = { RGB(3, 2, 2), RGB(8, 4, 2), RGB(14, 8, 3), RGB(24, 18, 8), RGB(20, 6, 3), RGB(26, 26, 26), RGB(2, 2, 6), RGB(12, 5, 12) };
    static const u16 SH[6] = { RGB(8, 14, 26), RGB(26, 8, 12), RGB(10, 22, 12), RGB(24, 18, 6), RGB(18, 10, 24), RGB(10, 10, 12) };
    u16 sk = SK[seed % 6], hr = HR[(seed * 5 + 3) % 8], sh = SH[(seed * 7 + 1) % 6]; int style = (seed / 2 + seed) % 4;
    for (int y = cy + 22; y < 124; y++) { int w = 18 + (y - cy - 22) * 2; if (w > 54) w = 54; for (int x = -w; x <= w; x++) px(cx + x, y, mulc(sh, 300 - (y - cy) * 3 - (x * 40) / 54 + 20)); }   // shoulders
    for (int y = cy + 16; y < cy + 32; y++) for (int x = -8; x <= 8; x++) px(cx + x, y, mulc(sk, 190 - (x > 0 ? x * 6 : 0) + (y - cy - 16) * 2));   // neck
    for (int x = -9; x <= 9; x++) { int d = 8 - (x < 0 ? -x : x) / 2; for (int y = 0; y < d; y++) px(cx + x, cy + 26 + y - 6, mulc(sk, 150)); }
    if (style == 1 || style == 2) { int ext = style == 1 ? 38 : 18; for (int j = -30; j <= ext; j++) for (int x = -27; x <= 27; x++) { int d = x * x * 256 / (27 * 27) + (j < 0 ? j * j * 256 / (32 * 32) : 0); if (d <= 256 && (j > 4 || d > 150)) px(cx + x, cy + j, mulc(hr, 120 + ((x * 3 + j) & 7) * 6 - x)); } }
    if (style == 3) for (int j = -9; j <= 9; j++) for (int x = -9; x <= 9; x++) if (x * x + j * j <= 85) px(cx + x, cy - 36 + j, mulc(hr, 150 + (x < 0 ? 40 : 0) - j * 4));
    for (int j = -26; j <= 26; j++) for (int x = -21; x <= 21; x++)
    {   int d = x * x * 256 / (21 * 21) + j * j * 256 / (26 * 26); if (d > 256) continue; int f = 292 - d / 3 - x * 34 / 21 - (j > 18 ? (j - 18) * 8 : 0); px(cx + x, cy + j, mulc(sk, f)); }
    for (int s2 = -1; s2 <= 1; s2 += 2) for (int j = -3; j <= 3; j++) for (int x = 0; x <= 2; x++) if (x * x + j * j <= 8) px(cx + s2 * (21 + x), cy + 2 + j, mulc(sk, 190 - x * 20));   // ears
    for (int j = -31; j <= 3; j++) for (int x = -25; x <= 25; x++)
    {   int d = x * x * 256 / (25 * 25) + (j + 3) * (j + 3) * 256 / (29 * 29); if (d > 256) continue; int hl = -14 + (x * x) / 26; if (style == 0) hl = -17 + (x * x) / 30; if (j > hl && (style == 0 || style == 3 || (x > -18 && x < 18))) continue; if (j > hl && (x > -18 && x < 18)) continue;
        px(cx + x, cy + j, mulc(hr, 130 + (((x * 5 + j * 3 + seed) & 15) * 5) - x * 2 + (j < -20 ? 30 : 0))); }
    for (int s2 = -1; s2 <= 1; s2 += 2) { int ex = cx + s2 * 9, ey = cy - 3;
        for (int j = -3; j <= 3; j++) for (int x = -5; x <= 5; x++) if (x * x * 9 + j * j * 25 <= 225) px(ex + x, ey + j, mixc(C_WHITE, sk, 40));
        for (int j = -2; j <= 2; j++) for (int x = -2; x <= 2; x++) if (x * x + j * j <= 5) px(ex + x, ey + j, mulc(sh == SH[1] ? RGB(14, 7, 3) : mixc(sh, RGB(10, 6, 3), 120), 200 - j * 20)); px(ex, ey, RGB(1, 1, 2)); px(ex - 1, ey - 1, C_WHITE);
        for (int x = -5; x <= 5; x++) { px(ex + x, ey - 3 + (x * x > 16), mulc(sk, 95)); px(ex + x, ey + 3 - (x * x > 20), mulc(sk, 175)); }
        for (int t = -5; t <= 5; t++) { int k = s2 < 0 ? t : -t; int by = ey - 8 + (mood == 2 ? (k + 5) / 3 : mood == 0 ? -((k + 5) / 6) : 0); px(ex + t, by, mulc(hr, 160)); px(ex + t, by + 1, mulc(hr, 110)); }
        for (int j = -3; j <= 3; j++) for (int x = -4; x <= 4; x++) if (x * x + j * j <= 14) px(cx + s2 * 13 + x, cy + 9 + j, mixc(mulc(sk, 260), RGB(30, 11, 13), 36)); }
    for (int j = 0; j < 9; j++) { px(cx + 2, cy + j, mulc(sk, 200)); px(cx + 3, cy + j, mulc(sk, 175)); } px(cx - 3, cy + 9, mulc(sk, 120)); px(cx + 3, cy + 9, mulc(sk, 120)); px(cx - 1, cy + 8, mulc(sk, 340)); px(cx, cy + 8, mulc(sk, 320));
    int my = cy + 15; u16 lip = mixc(sk, RGB(24, 7, 9), 170);
    for (int t = -8; t <= 8; t++) { int yo = mood == 0 ? 2 - (t * t) / 16 : mood == 2 ? -1 + (t * t) / 16 : 0; int y = my + yo; px(cx + t, y, mulc(lip, 140)); px(cx + t, y + 1, mulc(lip, 270)); px(cx + t, y + 2, mulc(lip, 230)); if (mood == 0 && t > -6 && t < 6) px(cx + t, y + 1, RGB(31, 31, 29)); px(cx + t, y + 3, mulc(sk, 205)); }
}
static void face(int cx, int cy, int seed, int mood)
{
    int key = seed * 4 + mood; if (key != facekey) { u16 *sv = fb; fb = scratch; snap_clear(108); face_raw(56, 44, seed, mood); fb = sv; for (int j = 0; j < 108; j++) memcpy(facec + j * 112, scratch + j * 256, 224); facekey = key; }
    for (int j = 0; j < 108; j++) for (int x = 0; x < 112; x++) if (facec[j * 112 + x]) px(cx - 56 + x, cy - 44 + j, facec[j * 112 + x]);
}
static void header(void)
{
    grad(C_BG, C_BG2); rect(0, 0, 256, 24, C_BTN); frame(0, 0, 256, 24, C_PINK); textc(128, 3, gtitle, C_GOLD);
    char a[40], b[16]; money_s(b, money); sprintf(a, "DAY %d/%d   %s   REP %d", day, days, b, rep); textc(128, 14, a, C_WHITE);
}
static void chapter_bar(int y)
{
    int nx = chap + 1 < nchap ? CGOAL(chap + 1) : CGOAL(chap), pr = nx > 0 ? earned * 100 / nx : 100; if (pr > 100) pr = 100;
    text(4, y, (const char *)(CH + chap * 26), C_PINK); rect(4, y + 10, 248, 6, C_BG); rect(4, y + 10, 248 * pr / 100, 6, C_GRN); frame(4, y + 10, 248, 6, C_GREY);
    char a[32], b[16]; money_s(b, nx); sprintf(a, "GOAL %s", b); text(4, y + 18, a, C_GREY);
}
static void draw_top(void)
{
    fb = topb;
    if (scr == S_TITLE) { memcpy(topb, splash_bin, sizeof topb); return; }
    header(); const u8 *show = strand; int sel = -1; char a[40], b[16], t[24];
    if (scr == S_DESIGN) sel = slot; else if ((scr == S_SELL || scr == S_HOME) && nbr) show = br[selb].b; else if (scr != S_DESIGN) show = strand;
    if (scr == S_SELL && ncq && cqi < ncq) { int mood = strstr(cmsg, "SOLD") ? 0 : patience >= 3 ? 0 : patience == 2 ? 1 : 2; face(62, 74, cq[cqi], mood); bracelet_viz(184, 82, 38, show, sel); }
    else if (scr != S_END && scr != S_NODATA) bracelet_viz(128, 82, 44, show, sel);
    if (scr == S_DESIGN) { int cost, q; u32 m; int n = analyse(strand, &cost, &m, &q); style_tags(m, t); money_s(b, cost); sprintf(a, "%d/12 BEADS  COST %s", n, b); textc(128, 132, a, C_WHITE); sprintf(a, "QUALITY %d  %s", q, t); textc(128, 144, a, q >= 60 ? C_GRN : C_GOLD); }
    else if ((scr == S_SELL || scr == S_HOME) && nbr) { sprintf(a, "BRACELET %d   QUALITY %d", selb + 1, br[selb].q); textc(128, 132, a, C_WHITE); style_tags(br[selb].mask, t); money_s(b, sugg(&br[selb])); sprintf(a, "%s  WORTH %s", t, b); textc(128, 144, a, C_GOLD); }
    else if (scr == S_HOME) textc(128, 138, "NO BRACELETS YET - DESIGN ONE", C_GREY);
    if (scr == S_SELL && ncq && cqi < ncq) { textc(128, 158, cmsg, C_PINK); }
    if (scr != S_END && scr != S_NODATA) chapter_bar(166);
    if (msgt && scr != S_SELL) textc(128, 152, msg, C_GOLD);
}

// ---------------------------------------------------------------- screens (bottom)
static void grid_beads(int y0, int showstock)
{
    for (int i = 0; i < nbead; i++)
    {   int x = 4 + (i & 7) * 31, y = y0 + (i >> 3) * 18; int own = stock[i] > 0; rect(x, y, 30, 17, i == selbead ? C_BTNH : C_BG); frame(x, y, 30, 17, i == selbead ? C_GOLD : C_BG2);
        bead(x + 8, y + 8, 7, i, 0); if (showstock) { char n[6]; sprintf(n, "%d", stock[i] > 99 ? 99 : stock[i]); text(x + 16, y + 5, n, own ? C_WHITE : C_GREY); }
        if (pdown && hit(x, y, 30, 17, tx_, ty_)) { selbead = i; if (scr == S_DESIGN) { if (own) { strand[slot] = i; slot = (slot + 1) % 12; beep(500 + i * 12, 0); } else say("OUT OF THAT BEAD"); } else beep(600 + i * 12, 0); }
    }
}
static void bottom_title(void)
{
    grad(C_BG, C_BG2); textc(128, 30, "FRIENDSHIP", C_PINK); textc(128, 44, "BRACELETS", C_GOLD); textc(128, 64, "A BEAD SHOP SIM", C_WHITE);
    if (button(56, 90, 144, 30, "OPEN SHOP", 0, 0)) { new_game(); scr = S_HOME; }
    textc(128, 140, "TAP WITH THE STYLUS", C_GREY); textc(128, 160, "NOTAREAL GAME STUDIOS", C_GREY);
}
static void bottom_home(void)
{
    grad(C_BG, C_BG2); textc(128, 6, "YOUR SHOP", C_GOLD); int nb = 0; for (int i = 0; i < nbead; i++) nb += stock[i]; char a[36]; sprintf(a, "%d BEADS  %d BRACELETS", nb, nbr); textc(128, 20, a, C_WHITE);
    if (button(16, 40, 108, 38, "BEAD SHOP", 0, 0)) scr = S_SHOP; if (button(132, 40, 108, 38, "DESIGN", 0, 0)) scr = S_DESIGN;
    if (button(16, 86, 108, 38, "OPEN STALL", 0, 0)) { if (!nbr) say("MAKE A BRACELET FIRST"); else { ncq = 3 + (rep / 8 > 3 ? 3 : rep / 8); for (int i = 0; i < ncq; i++) cq[i] = rnd() % ncust; cqi = 0; patience = 3; selb = 0; soldtoday = earntoday = 0; scr = S_SELL; price = sugg(&br[0]); sprintf(cmsg, "%s STROLLS UP", (const char *)(CU + cq[0] * 20)); } }
    if (button(132, 86, 108, 38, "SLEEP", 0, 0)) { soldtoday = earntoday = 0; scr = S_DAYEND; }
    if (nbr > 1) { if (button(16, 134, 50, 20, "<", 0, 0)) selb = (selb + nbr - 1) % nbr; if (button(190, 134, 50, 20, ">", 0, 0)) selb = (selb + 1) % nbr; textc(128, 140, "VIEW", C_GREY); }
    if (msgt) textc(128, 166, msg, C_GOLD);
}
static void bottom_shop(void)
{
    grad(C_BG, C_BG2); grid_beads(4, 1); char a[40], b[16]; int i = selbead; money_s(b, BPRICE(i)); sprintf(a, "%s  %s", BNAME(i), b); text(4, 116, a, C_GOLD);
    money_s(b, money); sprintf(a, "YOU HAVE %s   OWN %d", b, stock[i]); text(4, 128, a, C_WHITE);
    for (int k = 0; k < 3; k++) { static const int n[3] = { 1, 5, 10 }; char l[12]; sprintf(l, "BUY %d", n[k]); if (button(4 + k * 62, 142, 58, 22, l, 0, n[k] == 1)) { int cost = BPRICE(i) * n[k]; if (money >= cost && stock[i] + n[k] <= 99) { money -= cost; stock[i] += n[k]; beep(1000, 1320); } else { say("NOT ENOUGH MONEY"); thud(); } } }
    if (button(194, 142, 58, 22, "BACK", 0, 0)) scr = S_HOME; if (msgt) text(4, 170, msg, C_RED);
}
static void fill_pattern(void) { for (int i = 0; i < 12; i++) strand[i] = PT[patidx * (14 + NB) + 14 + i]; }
static void bottom_design(void)
{
    grad(C_BG, C_BG2);
    for (int i = 0; i < 12; i++) { int x = 8 + i * 20; rect(x, 3, 19, 19, i == slot ? C_BTNH : C_BG); frame(x, 3, 19, 19, i == slot ? C_GOLD : C_BG2); if (strand[i] < nbead) bead(x + 9, 12, 7, strand[i], 0); if (pdown && hit(x, 3, 19, 19, tx_, ty_)) { slot = i; beep(700, 0); } }
    grid_beads(26, 1);
    if (button(4, 138, 80, 22, "PATTERN", 0, 0)) { fill_pattern(); char a[40]; sprintf(a, "PATTERN %d/%d %s", patidx + 1, npat, (const char *)(PT + patidx * (14 + NB))); say(a); patidx = (patidx + 1) % npat; }
    if (button(88, 138, 80, 22, "CLEAR", 0, 0)) { memset(strand, 255, 12); slot = 0; } if (button(172, 138, 80, 22, "ERASE", 0, 0)) { strand[slot] = 255; }
    if (button(4, 164, 120, 24, "FINISH", 0, 0))
    {   int cost, q; u32 m; int n = analyse(strand, &cost, &m, &q); int need[64] = { 0 }, ok = 1; for (int i = 0; i < 12; i++) if (strand[i] < nbead) need[strand[i]]++;
        for (int i = 0; i < nbead; i++) if (need[i] > stock[i]) ok = 0;
        if (n < 12) say("FILL ALL 12 SLOTS"); else if (!ok) say("NOT ENOUGH BEADS - SHOP"); else if (nbr >= 12) say("STALL FULL - SELL SOME");
        else { for (int i = 0; i < nbead; i++) stock[i] -= need[i]; memcpy(br[nbr].b, strand, 12); br[nbr].q = q; br[nbr].mask = m; br[nbr].cost = cost; nbr++; selb = nbr - 1; memset(strand, 255, 12); slot = 0; say("BRACELET FINISHED"); beep(1200, 1600); }
    }
    if (button(132, 164, 120, 24, "BACK", 0, 0)) scr = S_HOME;
    if (msgt) { rect(0, 128, 256, 9, C_BG); text(4, 128, msg, C_GOLD); }
}
static void next_customer(void) { cqi++; patience = 3; if (cqi >= ncq) { scr = S_DAYEND; return; } sprintf(cmsg, "%s STROLLS UP", (const char *)(CU + cq[cqi] * 20)); }
static void bottom_sell(void)
{
    grad(C_BG, C_BG2); const u8 *c = CU + cq[cqi] * 20; char a[40], t[24], b[16]; text(4, 4, (const char *)c, C_GOLD); sprintf(a, "%d/%d", cqi + 1, ncq); text(220, 4, a, C_GREY);
    sprintf(a, "LOVES %s %s", (const char *)(STY + c[14] * 10), c[15] != c[14] ? (const char *)(STY + c[15] * 10) : ""); text(4, 16, a, C_WHITE); text(4, 28, "FAV COLOUR", C_GREY); bead(104, 32, 6, c[16], 0); sprintf(a, "BUDGET %d", c[17]); text(124, 28, a, C_GREY); (void)t;
    for (int i = 0; i < nbr; i++) { int x = 4 + (i % 6) * 42, y = 42 + (i / 6) * 30; rect(x, y, 40, 28, i == selb ? C_BTNH : C_BG); frame(x, y, 40, 28, i == selb ? C_GOLD : C_BG2);
        for (int k = 0; k < 12; k++) { u16 cc = BRGB(br[i].b[k]); rect(x + 2 + (k % 6) * 6, y + 3 + (k / 6) * 6, 5, 5, cc); } sprintf(a, "Q%d", br[i].q); text(x + 4, y + 17, a, C_WHITE);
        if (pdown && hit(x, y, 40, 28, tx_, ty_)) { selb = i; price = sugg(&br[i]); beep(700, 0); } }
    money_s(b, price); sprintf(a, "PRICE %s", b); textc(128, 106, a, C_GOLD);
    if (button(4, 116, 60, 16, "-$5", 0, 1)) { price -= 500; if (price < 50) price = 50; } if (button(66, 116, 60, 16, "-50C", 0, 1)) { price -= 50; if (price < 50) price = 50; }
    if (button(130, 116, 60, 16, "+50C", 0, 1)) price += 50; if (button(192, 116, 60, 16, "+$5", 0, 1)) price += 500;
    if (button(4, 138, 120, 24, "OFFER", 0, 0) && nbr)
    {   Br *bb = &br[selb]; int w = willing(bb, cq[cqi]), m = cust_match(bb, cq[cqi]);
        if (price <= w) { money += price; earned += price; earntoday += price; soldtoday++; soldtot++; if (m >= 60) rep++; char n[16]; money_s(n, price); sprintf(cmsg, "SOLD FOR %s!", n); beep(1568, 2093); for (int i = selb; i < nbr - 1; i++) br[i] = br[i + 1]; nbr--; if (selb >= nbr) selb = nbr ? nbr - 1 : 0; if (nbr) price = sugg(&br[selb]); if (!nbr) { scr = S_DAYEND; } else next_customer(); }
        else { thud(); patience--; strcpy(cmsg, m < 40 ? "NOT MY STYLE..." : "TOO PRICEY!"); if (patience <= 0) { strcpy(cmsg, "I'LL LOOK ELSEWHERE"); next_customer(); } }
    }
    if (button(132, 138, 120, 24, "NEXT", 0, 0)) next_customer();
    text(4, 168, cmsg, C_PINK); sprintf(a, "PATIENCE %d", patience); text(4, 180, a, C_GREY);
    if (button(180, 168, 72, 20, "CLOSE", 0, 0)) scr = S_DAYEND;
}
static void bottom_dayend(void)
{
    grad(C_BG, C_BG2); char a[40], b[16]; textc(128, 10, "END OF DAY", C_GOLD); sprintf(a, "SOLD %d BRACELETS", soldtoday); textc(128, 34, a, C_WHITE); money_s(b, earntoday); sprintf(a, "EARNED %s", b); textc(128, 48, a, C_GRN);
    money_s(b, earned); sprintf(a, "TOTAL EARNED %s", b); textc(128, 62, a, C_WHITE); sprintf(a, "REPUTATION %d", rep); textc(128, 76, a, C_PINK);
    while (chap + 1 < nchap && earned >= CGOAL(chap + 1)) { chap++; say("NEW CHAPTER!"); beep(1047, 1319); }
    textc(128, 96, (const char *)(CH + chap * 26), C_GOLD);
    if (button(56, 124, 144, 30, day >= days ? "SEE ENDING" : "NEXT DAY", 0, 0)) { if (day >= days) scr = S_END; else { day++; scr = S_HOME; soldtoday = earntoday = 0; say("GOOD MORNING!"); } }
}
static void bottom_end(void)
{
    grad(C_BG, C_BG2); int e = chap < nend ? chap : nend - 1; char a[40], b[16]; textc(128, 12, "THE SEASON ENDS", C_GOLD); textc(128, 34, (const char *)(EN + e * 20), C_PINK);
    money_s(b, earned); sprintf(a, "EARNED %s", b); textc(128, 58, a, C_WHITE); sprintf(a, "SOLD %d  REP %d", soldtot, rep); textc(128, 72, a, C_WHITE); sprintf(a, "CHAPTER %d: %s", chap + 1, (const char *)(CH + chap * 26)); textc(128, 90, a, C_GOLD);
    if (button(56, 124, 144, 30, "PLAY AGAIN", 0, 0)) { scr = S_TITLE; }
}
static void bottom_nodata(void) { grad(C_BG, C_BG2); textc(128, 70, "NO GAME DATA", C_RED); textc(128, 90, "BUILD THIS ROM IN THE", C_WHITE); textc(128, 102, "NOTAREAL STUDIO", C_WHITE); }

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
        if (scr == S_TITLE && (kd & (KEY_A | KEY_START))) { new_game(); scr = S_HOME; }
        static int redraw = 8; int act = pheld || pdown || prel || kh || msgt; if (act) redraw = 3;
        if (act || redraw > 0) { if (!act) redraw--;
        draw_top(); fb = botb;
        switch (scr) { case S_TITLE: bottom_title(); break; case S_HOME: bottom_home(); break; case S_SHOP: bottom_shop(); break; case S_DESIGN: bottom_design(); break; case S_SELL: bottom_sell(); break; case S_DAYEND: bottom_dayend(); break; case S_END: bottom_end(); break; default: bottom_nodata(); }
        if (msgt) msgt--;
        swiWaitForVBlank(); dmaCopy(topb, topv, sizeof topb); dmaCopy(botb, botv, sizeof botb); } else swiWaitForVBlank();
    }
}

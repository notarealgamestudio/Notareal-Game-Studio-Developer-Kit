// NOTAREAL Game Studio - DS fighting / wrestling engine (port of kit/nrfight.js).
// Data: FGCF (title, ring colours, two fighters) + FSP0/FSP1 (RGB15 sprite frames, bit15 = opaque).
#include <nds.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "nrg.h"
#include "splash_bin.h"
#include "font_bin.h"
extern const unsigned char nr_gamedata[];
void snd_input(void);
static const NrgHeader *H;
static const u8 *sec(const char *id, u32 *size) {
    for (u32 i = 0; i < H->count; i++) if (!memcmp(H->sec[i].id, id, 4)) { if (size) *size = H->sec[i].size; return (const u8 *)H + H->sec[i].off; }
    if (size) *size = 0; return 0;
}
static u32 kd, kh;
static u16 *fb; static u16 buf[256 * 192]; static int use_buf;
static void input(void) { snd_input(); scanKeys(); kd = keysDown(); kh = keysHeld(); }
static void wait_frame(void) { swiWaitForVBlank(); if (use_buf) dmaCopy(buf, fb, 256 * 192 * 2); input(); }
static void px(int x, int y, u16 c) { if ((unsigned)x < 256 && (unsigned)y < 192) buf[y * 256 + x] = c; }
static void rect(int x, int y, int w, int h, u16 c) { int x0 = x < 0 ? 0 : x, x1 = x + w > 256 ? 256 : x + w, y0 = y < 0 ? 0 : y, y1 = y + h > 192 ? 192 : y + h; for (int j = y0; j < y1; j++) for (int i = x0; i < x1; i++) buf[j * 256 + i] = c; }
static void text(int x, int y, const char *s, u16 c) { for (; *s; s++, x += 8) { int ch = *s; if (ch >= 'a' && ch <= 'z') ch -= 32; if (ch <= 32 || ch > 127) continue; const u8 *g = font_bin + (ch - 32) * 64; for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) if (g[j * 8 + i]) px(x + i, y + j, c); } }
static void ctext(int y, const char *s, u16 c) { text((256 - (int)strlen(s) * 8) / 2, y, s, c); }
static void splash(void) {
    videoSetMode(MODE_5_2D); vramSetBankA(VRAM_A_MAIN_BG);
    int b = bgInit(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0); fb = (u16 *)bgGetGfxPtr(b); dmaCopy(splash_bin, fb, 256 * 192 * 2);
    for (int i = 0; i < 150; i++) { wait_frame(); if (i > 40 && (kd & (KEY_START | KEY_A))) break; }
}
static u32 rs = 7; static int rndi(int n) { rs = rs * 1664525u + 1013904223u; return (int)((rs >> 8) % (u32)n); }
static float rndf(void) { rs = rs * 1664525u + 1013904223u; return (rs >> 8) / 16777216.0f; }

/* ---- data ---- */
typedef struct { char name[16]; u16 hp; u8 power, speed, pad[4]; } FD;
static char title[33]; static u16 floorc, ropec; static FD fd[2];
typedef struct { int w, h, frames; const u16 *px; } Spr; static Spr spr[2];
static void load(void) {
    u32 sz; const u8 *p = sec("FGCF", &sz); memset(title, 0, sizeof title); strcpy(title, "RING FIGHT"); floorc = RGB15(7, 11, 21) | BIT(15); ropec = RGB15(29, 9, 9) | BIT(15);
    for (int i = 0; i < 2; i++) { strcpy(fd[i].name, i ? "RIVAL" : "STEVE"); fd[i].hp = 100; fd[i].power = 100; fd[i].speed = 100; }
    if (p && sz >= 84) { memcpy(title, p, 32); title[32] = 0; floorc = p[32] | p[33] << 8; ropec = p[34] | p[35] << 8; memcpy(fd, p + 36, 48); }
    for (int i = 0; i < 2; i++) { fd[i].name[15] = 0; if (fd[i].hp < 20 || fd[i].hp > 400) fd[i].hp = 100; if (!fd[i].power) fd[i].power = 100; if (!fd[i].speed) fd[i].speed = 100; }
    const char *ids[2] = { "FSP0", "FSP1" };
    for (int i = 0; i < 2; i++) { const u8 *q = sec(ids[i], &sz); spr[i].px = 0; if (q && sz >= 4) { spr[i].w = q[0]; spr[i].h = q[1]; spr[i].frames = q[2] ? q[2] : 1; spr[i].px = (const u16 *)(q + 4); } }
}
/* ---- fight state (mirrors nrfight.js) ---- */
enum { IDLE, WALK, ATTACK, THROW, BLOCK, HURT, DOWN, PIN, TAUNT };
#define W 256
#define FLOOR 148
typedef struct { float x, vx; int face, hp, maxhp, mom, st, t, combo; } Fi;
static Fi f[2]; static int frame, over_w = -1, over_how, pin_by = -1, pin_n; static int prevA[2], prevB[2], prevY[2];
typedef struct { int l, r, A, B, Y, X, pA, pB, pY, pX; } In;
static void reset(void) { memset(f, 0, sizeof f); for (int i = 0; i < 2; i++) { f[i].x = i ? W * 0.7f : W * 0.3f; f[i].face = i ? -1 : 1; f[i].hp = f[i].maxhp = fd[i].hp; f[i].st = IDLE; } frame = 0; over_w = -1; pin_by = -1; pin_n = 0; memset(prevA, 0, sizeof prevA); memset(prevB, 0, sizeof prevB); memset(prevY, 0, sizeof prevY); }
static void dmg(int v, int a, int amt, int kind /*0 strike 1 throw*/) {
    Fi *V = &f[v], *A = &f[a]; int blocked = V->st == BLOCK && ((A->x > V->x ? 1 : -1) == V->face);
    int n = blocked ? (amt * 2 + 9) / 10 : (amt * fd[a].power + 50) / 100; V->hp -= n; if (V->hp < 0) V->hp = 0;
    A->mom += blocked ? 2 : 7; if (A->mom > 100) A->mom = 100; V->mom += 3; if (V->mom > 100) V->mom = 100;
    if (!blocked) { V->st = kind ? DOWN : HURT; V->t = kind ? 70 : 14; V->vx = A->face * (kind ? 3.0f : 1.5f); }
    if (V->hp <= 0 && over_w < 0) { V->st = DOWN; V->t = 9999; over_w = a; over_how = 0; }
}
static void act(int i, In *o) {
    Fi *me = &f[i], *you = &f[1 - i]; float dist = me->x > you->x ? me->x - you->x : you->x - me->x;
    if (me->st == DOWN) { if (--me->t <= 0 && pin_by < 0) me->st = IDLE; return; }
    if (me->st == HURT) { me->x += me->vx; me->vx *= 0.8f; if (--me->t <= 0) me->st = IDLE; return; }
    if (me->st == ATTACK || me->st == THROW) {
        if (--me->t <= 0) me->st = IDLE;
        else if (me->st == ATTACK && me->t == 6 && dist < 30) { dmg(1 - i, i, 6 + me->combo * 2, 0); me->combo = (me->combo + 1) % 3; }
        else if (me->st == THROW && me->t == 10 && dist < 30 && you->st != BLOCK) { dmg(1 - i, i, 16, 1); you->x = me->x + me->face * 28; }
        return;
    }
    me->face = you->x > me->x ? 1 : -1; me->st = IDLE;
    if (o->Y) { me->st = BLOCK; return; }
    if (you->st == DOWN && me->hp > 0 && dist < 34 && you->hp < you->maxhp * 0.4f && o->A) {
        me->st = PIN; if (pin_by < 0) { pin_by = i; pin_n = 0; } pin_n++; if (pin_n / 40 >= 3 && over_w < 0) { over_w = i; over_how = 1; } return; }
    if (pin_by == i) pin_by = -1;
    if (o->pX) { me->mom += 14; if (me->mom > 100) me->mom = 100; me->t = 20; me->st = TAUNT; return; }
    if (o->A && o->B && me->mom >= 100 && dist < 34) { dmg(1 - i, i, 40, 1); me->mom = 0; me->st = ATTACK; me->t = 30; return; }
    if (o->pA) { me->st = ATTACK; me->t = 14; return; }
    if (o->pB) { me->st = THROW; me->t = 22; return; }
    float sp = 1.1f * fd[i].speed / 100.0f; if (o->l) { me->x -= sp; me->st = WALK; } else if (o->r) { me->x += sp; me->st = WALK; }
    if (me->x < 18) me->x = 18; if (me->x > W - 18) me->x = W - 18;
}
static void update(void) {
    frame++; if (over_w >= 0) return;
    In o1 = { 0 }, o2 = { 0 };
    o1.l = !!(kh & KEY_LEFT); o1.r = !!(kh & KEY_RIGHT); o1.A = !!(kh & KEY_A); o1.B = !!(kh & KEY_B); o1.Y = !!(kh & KEY_Y); o1.X = !!(kh & KEY_X);
    o1.pA = o1.A && !prevA[0]; o1.pB = o1.B && !prevB[0]; o1.pY = o1.Y && !prevY[0]; o1.pX = !!(kd & KEY_X); prevA[0] = o1.A; prevB[0] = o1.B; prevY[0] = o1.Y;
    { Fi *me = &f[1], *you = &f[0]; float dx = you->x - me->x, ad = dx < 0 ? -dx : dx; int near = ad < 34, k = frame % 40; o2.l = dx < -30; o2.r = dx > 30;
        if (near && you->st != DOWN) { if (k == 5 && rndf() < 0.7f) o2.A = 1; else if (k == 20 && rndf() < 0.3f) o2.B = 1; if (you->st == ATTACK && rndf() < 0.5f) o2.Y = 1; }
        if (you->st == DOWN && near && me->hp > 0) o2.A = 1; if (me->mom >= 100 && near && k == 10) o2.A = o2.B = 1;
        o2.pA = o2.A && !prevA[1]; o2.pB = o2.B && !prevB[1]; prevA[1] = o2.A; prevB[1] = o2.B; }
    act(0, &o1); act(1, &o2);
    for (int i = 0; i < 2; i++) if (f[i].st == TAUNT && --f[i].t <= 0) f[i].st = IDLE;
    if (pin_by >= 0 && (f[1 - pin_by].st != DOWN || f[pin_by].st != PIN)) pin_by = -1;
    if (pin_by >= 0 && pin_n % 40 == 39) { Fi *w = &f[1 - pin_by]; if (rndf() < 0.05f + ((float)w->hp / w->maxhp) * 0.8f) { w->st = IDLE; pin_by = -1; } }
}
static void draw_fig(int i) {
    Fi *p = &f[i]; int dx0 = (int)p->x, lying = p->st == DOWN;
    if (!spr[i].px) { rect(dx0 - 8, FLOOR - 34, 16, 34, i ? RGB15(24, 8, 8) | BIT(15) : RGB15(29, 20, 8) | BIT(15)); return; }
    int sw = spr[i].w, sh = spr[i].h, fr = (p->st == WALK) ? (frame >> 3) % spr[i].frames : 0, dw = sw * 3 / 2, dh = sh * 3 / 2; const u16 *src = spr[i].px + fr * sw * sh;
    for (int v = 0; v < dh; v++) for (int u = 0; u < dw; u++) { u16 c = src[(v * sh / dh) * sw + (u * sw / dw)]; if (!(c & 0x8000)) continue; int uu = p->face < 0 ? dw - 1 - u : u;
        if (!lying) px(dx0 - dw / 2 + uu, FLOOR - dh + v, c); else px(dx0 + p->face * (v - dh / 2) * 1 , FLOOR - dw + uu - 0, c); }
    if (p->st == ATTACK) rect(dx0 + p->face * 12, FLOOR - 30, 12, 3, 0xFFFF);
    if (p->st == BLOCK) rect(dx0 + p->face * 8, FLOOR - dh, 3, dh - 4, RGB15(16, 24, 31) | BIT(15));
}
static void draw(void) {
    rect(0, 0, 256, 192, RGB15(2, 3, 8) | BIT(15)); rect(0, FLOOR, 256, 192 - FLOOR, floorc); for (int i = 0; i < 3; i++) rect(0, 56 + i * 24, 256, 2, ropec);
    if (f[0].x <= f[1].x) { draw_fig(0); draw_fig(1); } else { draw_fig(1); draw_fig(0); }
    for (int i = 0; i < 2; i++) { int x = i ? 256 - 8 - 100 : 8; rect(x, 6, 100, 8, RGB15(4, 4, 4) | BIT(15)); rect(x, 6, 100 * f[i].hp / f[i].maxhp, 8, f[i].hp * 10 > f[i].maxhp * 4 ? RGB15(9, 27, 15) | BIT(15) : RGB15(30, 12, 12) | BIT(15)); rect(x, 16, 100 * f[i].mom / 100, 3, RGB15(30, 24, 8) | BIT(15)); text(i ? x + 100 - (int)strlen(fd[i].name) * 8 : x, 22, fd[i].name, 0xFFFF); }
    text(100, 6, "", 0xFFFF);
    if (pin_by >= 0) { char c[2] = { (char)('1' + (pin_n / 40 > 2 ? 2 : pin_n / 40)), 0 }; ctext(44, c, 0xFFFF); }
    if (over_w >= 0) { char m[48]; rect(0, 78, 256, 36, RGB15(0, 0, 0) | BIT(15)); snprintf(m, 48, "%s WINS BY %s!", fd[over_w].name, over_how ? "PIN" : "KO"); ctext(84, m, RGB15(31, 28, 10) | BIT(15)); ctext(98, "START: REMATCH", 0xFFFF); }
}
int main(void) {
    defaultExceptionHandler(); H = (const NrgHeader *)nr_gamedata; splash();
    videoSetModeSub(MODE_0_2D); setBackdropColorSub(RGB15(2, 3, 8)); use_buf = 1; load(); rs ^= (u32)(REG_VCOUNT * 7919) ^ 0x9e3779b9u; reset();
    for (;;) { wait_frame(); if (over_w >= 0 && (kd & KEY_START)) reset(); update(); draw(); }
}

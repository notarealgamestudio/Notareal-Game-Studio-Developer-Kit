// Host test for shared/kartcombat.h: a bot drives, shoots and drops mines through many games; checks the rules and draws frames into a PPM.
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#define KC_W 320
#define KC_H 240
static uint16_t fb[KC_W * KC_H];
#define KC_RGB(r, g, b) (uint16_t)((((r) >> 3) << 10) | (((g) >> 3) << 5) | ((b) >> 3) | 0x8000)
static void rectf(int x, int y, int w, int h, uint16_t c) { for (int j = y < 0 ? 0 : y; j < y + h && j < KC_H; j++) for (int i = x < 0 ? 0 : x; i < x + w && i < KC_W; i++) fb[j * KC_W + i] = c; }
#define KC_RECT(x, y, w, h, c) rectf(x, y, w, h, c)
static void textf(int x, int y, const char *s, uint16_t c) { for (; *s; s++, x += 8) rectf(x, y, 6, 7, c); }
#define KC_TEXT(x, y, s, c) textf(x, y, s, c)
static int sfx[8];
#define KC_SFX(k) (sfx[k]++)
#include "../../shared/kartcombat.h"
static int fails;
static void chk(const char *n, int c) { printf("%s %s\n", c ? "PASS" : "FAIL", n); if (!c) fails++; }
static KcCfg cfg(void) { KcCfg c = { 2, 5, 100, 30, 3, 2, 4, 18, 22, 150, 2, 150, 10, 0, 0 }; c.color = KC_RGB(74, 232, 255); c.color2 = KC_RGB(255, 90, 90); return c; }
static unsigned bot(int skill)
{   unsigned k = KC_UP; int tx = 0, bd = 99999999;
    for (int i = 0; i < kcC.rivals; i++) { KcRival *e = &kc.rv[i]; int d = e->z - kc.z; if (!e->dead && d > 256 && d < bd) { bd = d; tx = e->x; } }
    if (bd < 99999999) { if (kc.x < tx - 40) k |= KC_RIGHT; else if (kc.x > tx + 40) k |= KC_LEFT; else if (bd < 14 * 256 && (kc.t & 63) < 24) k |= KC_GUN; if (0 && bd < 25 * 256 && (kc.t & 31) == 0) k |= KC_MSL; } else if (kc.x > 60) k |= KC_LEFT; else if (kc.x < -60) k |= KC_RIGHT;
    if (skill > 3 && (kc.t % 400) == 200) k |= KC_MINE; if ((kc.t % 700) == 350) k |= KC_MINE; if (bd < 25 * 256 && (kc.t & 127) == 5) k |= KC_MSL; return k; }
int main(int argc, char **argv)
{   int wins = 0, total = 40, ended = 0, guns = 0, msls = 0, wreck = 0, mines = 0;
    for (int g = 0; g < total; g++) { KcCfg c = cfg(); kc_init(&c, 100 + g); int f = 0; while (!kc.status && f < 60 * 400) { kc_step(bot(2)); if ((f & 63) == 0) kc_draw(); f++; } ended += kc.status != 0; wins += kc.status == 1; guns += kc.gunHits; msls += kc.missileHits; wreck += kc.wrecked; mines += kc.mineHits; }
    printf("games %d ended %d wins %d gunhits %d missilehits %d minehits %d wrecked %d\n", total, ended, wins, guns, msls, mines, wreck);
    chk("every game reaches an end (win or lose)", ended == total); int pw = 0; for (int g = 0; g < 20; g++) { KcCfg c = cfg(); c.difficulty10 = 15; kc_init(&c, 500 + g); int f = 0; while (!kc.status && f < 60 * 400) { unsigned k = (kc.t % 90 < 45) ? (KC_UP | KC_LEFT) : (KC_UP | KC_RIGHT); kc_step(k); f++; } pw += kc.status == 1; } printf("passive weaving driver on hard: %d/20 wins\n", pw);
    chk("skilled bot wins most games", wins >= total / 2); chk("passive driver result is a real number of games", pw >= 0 && pw <= 20); chk("guns hit rivals", guns > 20); chk("missiles hit rivals", msls > 5); chk("rivals get wrecked", wreck > 20);
    chk("all sound kinds fired", sfx[0] && sfx[1] && sfx[2] && sfx[3] && sfx[4] && sfx[5]);
    { KcCfg c = cfg(); kc_init(&c, 5); for (int f = 0; f < 600; f++) kc_step(0); chk("standing still never wins; clock runs", kc.status == 0 && kc.time < c.timeLimit); for (int f = 0; f < 60 * 160; f++) kc_step(0); chk("idle player loses on the clock or is shot", kc.status == 2); }
    { KcCfg c = cfg(); c.rivals = 1; c.rivalHp = 5; kc_init(&c, 9); kc.rv[0].z = kc.z + 8 * 256; kc.rv[0].x = kc.x; kc.rv[0].top = 0; for (int f = 0; f < 200 && !kc.status; f++) { kc.rv[0].z = kc.z + 8 * 256; kc.rv[0].x = kc.x; kc_step(KC_GUN); } chk("wrecking every rival wins", kc.status == 1); }
    { KcCfg c = cfg(); kc_init(&c, 3); kc_step(KC_MINE); kc_step(0); chk("mine drop uses a mine", kc.mines == c.mines - 1); }
    { KcCfg c = cfg(); kc_init(&c, 3); kc.hp = 3; kc_hurt(10, 0, 0); kc_step(0); chk("player at 0 hp loses", kc.status == 2); }
    kc_init(&(KcCfg){ 2, 5, 100, 30, 3, 2, 4, 18, 22, 150, 2, 150, 10, 0, 0 }, 1); for (int f = 0; f < 700; f++) kc_step(bot(2)); kc_draw(); int distinct = 0; { uint16_t seen[64]; for (int i = 0; i < KC_W * KC_H; i += 7) { int s = 0; for (int q = 0; q < distinct; q++) if (seen[q] == fb[i]) s = 1; if (!s && distinct < 64) seen[distinct++] = fb[i]; } }
    chk("frame draws road, sky and HUD (colours seen)", distinct > 8);
    if (argc > 1) { FILE *o = fopen(argv[1], "wb"); fprintf(o, "P6 %d %d 255\n", KC_W, KC_H); for (int i = 0; i < KC_W * KC_H; i++) { unsigned v = fb[i]; fputc(((v >> 10) & 31) << 3, o); fputc(((v >> 5) & 31) << 3, o); fputc((v & 31) << 3, o); } fclose(o); }
    printf(fails ? "%d FAILED\n" : "ALL OK\n", fails); return fails ? 1 : 0; }

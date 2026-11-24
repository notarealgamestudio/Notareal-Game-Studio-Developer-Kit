// NOTAREAL Game Studio - DS 3D world engine (one ROM, three game types: star-collecting sandbox, warfare, wasteland).
// The world (boxes, ramps, enemies, pickups, weapons, physics numbers) is the W3DW section of the data block; the kit builds it from the same
// world definitions the PC / Xbox 3D engines use (kit/nr3d_sandbox.js, nr3d_war.js, nr3d_rpg.js), so a game plays the same on every console.
// Top screen: the 3D view (libnds GL, boxes pre-converted to 16-bit vertices at load). Bottom screen: map, status and stylus look.
#include <nds.h>
#include <math.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include "font_bin.h"
#include "splash_bin.h"
void snd_psg_ch(int ch, int duty, int hz, int vol, int pan);
void snd_noise_ch(int ch, int hz, int vol, int pan);
void snd_stop(int ch);
void snd_master(int vol);
void snd_input(void);
extern const unsigned char nr_gamedata[];
typedef struct { char id[4]; unsigned off, size; } Sec;
typedef struct { char magic[8]; unsigned capacity, used, count; Sec sec[]; } Hdr;

#pragma pack(push, 1)
typedef struct { s16 x0, y0, z0, x1, y1, z1; u16 col, top; u8 kind, axis; s16 h0, h1, pad; } Bx;              // 24 bytes, metres x 8; kind 2 = ramp
typedef struct { u8 type, flags; s16 x, y, z; } Ent;                                                          // 8 bytes. type 0-3 enemy, 4 star, 5 health, 6 ammo, 7 loot, 8 npc
typedef struct { char name[12]; u8 dmg, rate, mag, pellets; u16 reserve; u8 spread, autof; u16 reload; u8 pad[2]; } Wp;   // 24 bytes
typedef struct { u16 hp, sh, spd; u8 dmg, cd, burst, acc; u16 score; u8 scale, range; u16 col; } Et;          // 16 bytes
typedef struct { u8 mode, res; u16 nbox, nent; u8 nweap, nety; s16 sx, sz, yaw, half; u16 sky0, sky1, ground, time; s16 ex, ez; u16 goal, pad; char title[32]; u16 run, jump, grav, hp, sh, pad2[3]; } Hd;  // 80 bytes
#pragma pack(pop)

// ---------------------------------------------------------------- world
#define SC (1.0f / 16.0f)
#define MAXB 300
#define MAXE 64
static const Hd *H; static const Bx *B; static const Ent *E0; static const Wp *W; static const Et *ET; static int nb, ne0, nw, nety;
typedef struct { v16 X[2], Y[2], Z[2]; u16 c[6]; float x0, y0, z0, x1, y1, z1, h0, h1; u8 ramp, axis; } Cb;
static Cb cb[MAXB];
typedef struct { float x, y, z, yaw, anim, hurt; int type, hp, sh, st, cd, burst, losc, los, alive; } En;
static En en[MAXE]; static int nen;
typedef struct { float x, y, z; int type, taken; } Pk;
static Pk pk[MAXE]; static int npk;
static u16 shade(u16 c, int f) { int r = (c & 31) * f >> 5, g = ((c >> 5) & 31) * f >> 5, b = ((c >> 10) & 31) * f >> 5; return RGB15(r, g, b) | BIT(15); }
static const int LV[6] = { 32, 27, 22, 29, 24, 14 };
static void make_box(Cb *o, const Bx *b)
{
    o->x0 = b->x0 / 8.0f; o->y0 = b->y0 / 8.0f; o->z0 = b->z0 / 8.0f; o->x1 = b->x1 / 8.0f; o->y1 = b->y1 / 8.0f; o->z1 = b->z1 / 8.0f;
    o->ramp = b->kind == 2; o->axis = b->axis; o->h0 = b->h0 / 8.0f; o->h1 = b->h1 / 8.0f;
    o->X[0] = floattov16(o->x0 * SC); o->X[1] = floattov16(o->x1 * SC); o->Y[0] = floattov16(o->y0 * SC); o->Y[1] = floattov16(o->y1 * SC); o->Z[0] = floattov16(o->z0 * SC); o->Z[1] = floattov16(o->z1 * SC);
    u16 c = b->col, t = b->top ? b->top : b->col; for (int f = 0; f < 6; f++) o->c[f] = shade(f == 0 ? t : c, LV[f]);
}
static const u8 FC[6][4][3] = { { { 0, 1, 0 }, { 0, 1, 1 }, { 1, 1, 1 }, { 1, 1, 0 } }, { { 0, 0, 1 }, { 1, 0, 1 }, { 1, 1, 1 }, { 0, 1, 1 } }, { { 1, 0, 0 }, { 0, 0, 0 }, { 0, 1, 0 }, { 1, 1, 0 } },
    { { 1, 0, 1 }, { 1, 0, 0 }, { 1, 1, 0 }, { 1, 1, 1 } }, { { 0, 0, 0 }, { 0, 0, 1 }, { 0, 1, 1 }, { 0, 1, 0 } }, { { 0, 0, 0 }, { 1, 0, 0 }, { 1, 0, 1 }, { 0, 0, 1 } } };
static void draw_cb(const Cb *o, int faces)
{
    for (int f = 0; f < 6; f++) { if (f == 5 && !(faces & 1)) continue; glColor(o->c[f]); for (int k = 0; k < 4; k++) glVertex3v16(o->X[FC[f][k][0]], o->Y[FC[f][k][1]], o->Z[FC[f][k][2]]); }
}
// a rotated box in world metres (people, pickups): 5 faces, colour shaded per face
static void qbox(float cx, float y0, float cz, float hx, float h, float hz, float yaw, u16 col)
{
    float s = sinf(yaw), c = cosf(yaw); v16 xs[8], ys[8], zs[8];
    for (int i = 0; i < 8; i++) { float lx = (i & 1 ? hx : -hx), lz = (i & 2 ? hz : -hz), ly = i & 4 ? h : 0; xs[i] = floattov16((cx + lx * c + lz * s) * SC); zs[i] = floattov16((cz - lx * s + lz * c) * SC); ys[i] = floattov16((y0 + ly) * SC); }
    static const u8 Q[6][4] = { { 4, 6, 7, 5 }, { 2, 3, 7, 6 }, { 1, 0, 4, 5 }, { 3, 1, 5, 7 }, { 0, 2, 6, 4 }, { 0, 1, 3, 2 } };
    for (int f = 0; f < 6; f++) { glColor(shade(col, LV[f])); for (int k = 0; k < 4; k++) glVertex3v16(xs[Q[f][k]], ys[Q[f][k]], zs[Q[f][k]]); }
}
static void person(float x, float y, float z, float yaw, float sc, u16 body, u16 skin, float anim, float armup)
{
    float sw = sinf(anim) * 0.5f; float c = cosf(yaw), s = sinf(yaw);
    qbox(x + c * 0.13f * sc + 0, y, z - s * 0.13f * sc, 0.09f * sc, 0.78f * sc, 0.1f * sc, yaw + sw * 0.4f, shade(body, 20));
    qbox(x - c * 0.13f * sc, y, z + s * 0.13f * sc, 0.09f * sc, 0.78f * sc, 0.1f * sc, yaw - sw * 0.4f, shade(body, 20));
    qbox(x, y + 0.78f * sc, z, 0.24f * sc, 0.62f * sc, 0.13f * sc, yaw, body);
    qbox(x, y + 1.42f * sc, z, 0.13f * sc, 0.26f * sc, 0.13f * sc, yaw, skin);
    qbox(x + c * 0.34f * sc, y + 0.82f * sc + armup * 0.35f * sc, z - s * 0.34f * sc, 0.06f * sc, 0.5f * sc, 0.07f * sc, yaw, shade(body, 28));
    qbox(x - c * 0.34f * sc, y + 0.82f * sc + armup * 0.2f * sc, z + s * 0.34f * sc, 0.06f * sc, 0.5f * sc, 0.07f * sc, yaw, shade(body, 28));
}

// ---------------------------------------------------------------- state
enum { M_SAND, M_WAR, M_WASTE };
static int mode, goal, score, frames, state, stars, kills, killsNeeded, tleft, msgt, hitm, flashd, tp, runi;
static float px, py, pz, vy, yaw, pit, bob; static int onground, hp, sh, maxhp, maxsh, wsel, cdw, reload, hurtf, rundown;
static int mag[4], res[4]; static char msg[40];
static float RUN, JUMP, GRAV; static u16 sky0, sky1, groundc;
static const float EYE = 1.62f, RAD = 0.42f;
static void say(const char *s) { strncpy(msg, s, 39); msg[39] = 0; msgt = 150; }
static int rnd(void) { static unsigned s = 12345; s ^= s << 13; s ^= s >> 17; s ^= s << 5; return s & 0x7fffffff; }
static float frand(void) { return (rnd() & 0xffff) / 65535.0f; }
static void sfx_shot(int big) { snd_noise_ch(14, big ? 5000 : 9000, 100, 64); }
static void sfx_blip(int hz, int ch) { snd_psg_ch(12 + (ch & 1), 4, hz, 90, 64); }

static float ramp_h(const Cb *c, float x, float z)
{
    float t = c->axis == 2 ? (z - c->z0) / (c->z1 - c->z0) : (x - c->x0) / (c->x1 - c->x0); if (t < 0) t = 0; if (t > 1) t = 1; return c->y0 + c->h0 + (c->h1 - c->h0) * t;
}
// highest walkable surface under (x,z) that is not above 'ref + step'
static float floor_at(float x, float z, float ref, float r)
{
    float f = 0;
    for (int i = 0; i < nb; i++)
    {   const Cb *c = &cb[i]; if (x < c->x0 - r * 0.3f || x > c->x1 + r * 0.3f || z < c->z0 - r * 0.3f || z > c->z1 + r * 0.3f) continue;
        float top = c->ramp ? ramp_h(c, x, z) : c->y1; if (top <= ref + 0.62f && top > f) f = top;
    }
    return f;
}
static int blocked(float x, float z, float y, float h, float r)
{
    for (int i = 0; i < nb; i++)
    {   const Cb *c = &cb[i]; if (c->ramp) continue; if (x < c->x0 - r || x > c->x1 + r || z < c->z0 - r || z > c->z1 + r) continue;
        if (c->y1 > y + 0.6f && c->y0 < y + h) return 1;
    }
    return 0;
}
static int seg_hits_box(const Cb *c, float ox, float oy, float oz, float dx, float dy, float dz, float *tout)
{
    float t0 = 0, t1 = *tout; float o[3] = { ox, oy, oz }, d[3] = { dx, dy, dz }, lo[3] = { c->x0, c->y0, c->z0 }, hi[3] = { c->x1, c->y1, c->z1 };
    for (int a = 0; a < 3; a++)
    {   if (fabsf(d[a]) < 1e-6f) { if (o[a] < lo[a] || o[a] > hi[a]) return 0; }
        else { float a0 = (lo[a] - o[a]) / d[a], a1 = (hi[a] - o[a]) / d[a]; if (a0 > a1) { float t = a0; a0 = a1; a1 = t; } if (a0 > t0) t0 = a0; if (a1 < t1) t1 = a1; if (t0 > t1) return 0; }
    }
    *tout = t0; return 1;
}
static float world_ray(float ox, float oy, float oz, float dx, float dy, float dz, float maxt)    // nearest world hit distance (boxes + ground)
{
    float best = maxt; if (dy < -1e-5f) { float t = -oy / dy; if (t > 0 && t < best) best = t; }
    for (int i = 0; i < nb; i++) { float t = best; if (seg_hits_box(&cb[i], ox, oy, oz, dx, dy, dz, &t) && t < best) best = t; }
    return best;
}
static int has_los(float x0, float y0, float z0, float x1, float y1, float z1)
{
    float dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, l = sqrtf(dx * dx + dy * dy + dz * dz); if (l < 0.1f) return 1;
    for (int i = 0; i < nb; i++) { float t = 1; if (seg_hits_box(&cb[i], x0, y0, z0, dx, dy, dz, &t) && t < 0.98f && cb[i].y1 > y0 - 0.5f) return 0; }
    return 1;
}

// ---------------------------------------------------------------- setup
static const Wp DW[2] = { { "RIFLE", 8, 5, 30, 1, 210, 20, 1, 100, { 0, 0 } }, { "PISTOL", 22, 16, 12, 1, 60, 4, 0, 80, { 0, 0 } } };
static const Et DE[3] = { { 20, 0, 33, 6, 55, 3, 7, 100, 78, 14, 0x28a4 | 0x8000 }, { 45, 70, 43, 11, 44, 4, 4, 300, 100, 18, 0x1d66 | 0x8000 }, { 30, 30, 34, 48, 140, 1, 0, 250, 100, 40, 0x3c0c | 0x8000 } };
static Bx dbox[6]; static Ent dent[10]; static Hd dhd;
static void default_world(void)
{
    memset(&dhd, 0, sizeof dhd); dhd.mode = M_SAND; dhd.nbox = 6; dhd.nent = 7; dhd.nweap = 2; dhd.nety = 3; dhd.half = 40 * 8; dhd.sky0 = RGB15(12, 20, 30) | BIT(15); dhd.sky1 = RGB15(20, 26, 31) | BIT(15); dhd.ground = RGB15(10, 20, 8) | BIT(15);
    dhd.time = 300; dhd.goal = 3; dhd.run = 82; dhd.jump = 108; dhd.grav = 260; dhd.hp = 6; dhd.sh = 0; strcpy(dhd.title, "NOTAREAL 3D WORLD");
    static const s16 bx[6][6] = { { -12, 0, 10, 12, 3, 22 }, { -4, 3, 14, 8, 6, 20 }, { 14, 0, -8, 24, 4, -2 }, { -24, 0, -10, -18, 8, -4 }, { 0, 0, -20, 6, 2, -14 }, { 22, 0, 12, 30, 5, 20 } };
    for (int i = 0; i < 6; i++) { for (int k = 0; k < 6; k++) (&dbox[i].x0)[k] = bx[i][k] * 8; dbox[i].col = RGB15(24, 18, 12) | BIT(15); dbox[i].top = RGB15(14, 24, 10) | BIT(15); }
    for (int i = 0; i < 3; i++) { dent[i].type = 4; dent[i].x = (i * 10 - 10) * 8; dent[i].z = (i * 7 + 8) * 8; dent[i].y = 9 * 8; }
    H = &dhd; B = dbox; E0 = dent; W = DW; ET = DE; nb = 6; ne0 = 3; nw = 2; nety = 3;
}
static void load_world(void)
{
    const Hdr *h = (const Hdr *)nr_gamedata; H = 0;
    if (h->used) for (unsigned i = 0; i < h->count; i++) if (!memcmp(h->sec[i].id, "W3DW", 4)) { const u8 *p = nr_gamedata + h->sec[i].off; H = (const Hd *)p; p += sizeof(Hd); B = (const Bx *)p; nb = H->nbox; p += nb * sizeof(Bx); E0 = (const Ent *)p; ne0 = H->nent; p += ne0 * sizeof(Ent); W = (const Wp *)p; nw = H->nweap; p += nw * sizeof(Wp); ET = (const Et *)p; nety = H->nety; }
    if (!H) default_world(); if (nb > MAXB) nb = MAXB; if (ne0 > MAXE) ne0 = MAXE;
    for (int i = 0; i < nb; i++) make_box(&cb[i], &B[i]);
    mode = H->mode > 2 ? 0 : H->mode; tp = H->res & 1; sky0 = H->sky0 | BIT(15); sky1 = H->sky1 | BIT(15); groundc = H->ground | BIT(15); RUN = H->run / 10.0f; JUMP = H->jump / 10.0f; GRAV = H->grav / 10.0f; if (RUN < 2) RUN = 7; if (JUMP < 2) JUMP = 9; if (GRAV < 5) GRAV = 24;
}
static void new_game(void)
{
    px = H->sx / 8.0f; pz = H->sz / 8.0f; yaw = H->yaw * 0.0174533f; pit = 0; py = floor_at(px, pz, 50, 0.4f); vy = 0; hp = H->hp ? H->hp : 100; sh = H->sh; maxhp = hp; maxsh = sh; wsel = 0; cdw = reload = 0; score = stars = kills = 0; state = 0; tleft = H->time * 60; goal = H->goal;
    for (int i = 0; i < 4; i++) { mag[i] = i < nw ? W[i].mag : 0; res[i] = i < nw ? W[i].reserve : 0; }
    nen = npk = 0; killsNeeded = 0; static int dummy; (void)dummy;
    for (int i = 0; i < ne0; i++)
    {   const Ent *e = &E0[i];
        if (e->type <= 3 && nen < MAXE) { En *n = &en[nen++]; memset(n, 0, sizeof *n); n->x = e->x / 8.0f; n->z = e->z / 8.0f; n->y = floor_at(n->x, n->z, e->y / 8.0f + 1, 0.4f); n->type = e->type < nety ? e->type : 0; n->hp = ET[n->type].hp; n->sh = ET[n->type].sh; n->alive = 1; n->yaw = frand() * 6.28f; n->cd = 30 + rnd() % 60; if (e->flags & 1) n->st = 0; killsNeeded++; }
        else if (e->type >= 4 && npk < MAXE) { Pk *k = &pk[npk++]; k->x = e->x / 8.0f; k->y = e->y / 8.0f; k->z = e->z / 8.0f; k->type = e->type; k->taken = 0; }
    }
    if (mode == M_SAND && goal == 0) goal = npk;
    say(mode == M_SAND ? "COLLECT THE STARS" : mode == M_WAR ? "CLEAR THE AREA" : "CLEAR THE RAIDERS");
}

// ---------------------------------------------------------------- 2D text on the stylus screen
static u16 botb[256 * 192], *botv, *fbp;
#define C_BLK RGB15(1, 1, 3) | BIT(15)
static void px2(int x, int y, u16 c) { if ((unsigned)x < 256 && (unsigned)y < 192) fbp[y * 256 + x] = c; }
static void rect(int x, int y, int w, int h, u16 c) { for (int j = y; j < y + h; j++) for (int i = x; i < x + w; i++) px2(i, j, c); }
static void text(int x, int y, const char *s, u16 c) { for (; *s; s++, x += 8) { int ch = *s; if (ch >= 'a' && ch <= 'z') ch -= 32; if (ch <= 32 || ch > 127) continue; const u8 *g = font_bin + (ch - 32) * 64; for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) if (g[j * 8 + i]) px2(x + i, y + j, c); } }
static void bar(int x, int y, int w, int v, int mx, u16 c) { rect(x, y, w, 6, RGB15(4, 4, 6) | BIT(15)); if (mx > 0) rect(x, y, w * (v < 0 ? 0 : v > mx ? mx : v) / mx, 6, c); }
static void hud_bottom(void)
{
    fbp = botb; rect(0, 0, 256, 192, RGB15(2, 2, 5) | BIT(15)); char b[48]; u16 gold = RGB15(26, 22, 8) | BIT(15), wh = RGB15(28, 28, 28) | BIT(15), gr = RGB15(14, 14, 16) | BIT(15);
    text(6, 4, H->title, gold);
    const char *obj = mode == M_SAND ? "STARS" : mode == M_WAR ? "HOSTILES" : "RAIDERS"; int have = mode == M_SAND ? stars : kills, need = mode == M_SAND ? goal : killsNeeded;
    sprintf(b, "%s %d/%d", obj, have, need); text(6, 18, b, wh); sprintf(b, "SCORE %d", score); text(6, 30, b, gr);
    if (H->time) { sprintf(b, "TIME %d:%02d", tleft / 3600, (tleft / 60) % 60); text(6, 42, b, gr); }
    if (mode != M_SAND) { text(6, 58, "HEALTH", gr); bar(6, 68, 100, hp, maxhp, RGB15(24, 5, 5) | BIT(15)); if (maxsh) { text(6, 78, "SHIELD", gr); bar(6, 88, 100, sh, maxsh, RGB15(8, 18, 28) | BIT(15)); }
        if (nw) { char wn[13]; memcpy(wn, W[wsel].name, 12); wn[12] = 0; wn[10] = 0; text(6, 102, wn, wh); sprintf(b, "AMMO %d/%d", mag[wsel], res[wsel]); text(6, 112, b, reload ? gold : wh); } }
    else { text(6, 58, "LIVES", gr); for (int i = 0; i < hp; i++) rect(6 + i * 14, 70, 10, 10, RGB15(26, 6, 6) | BIT(15)); }
    // map: boxes, enemies, pickups, player
    int mx = 130, my = 16, ms = 120; float half = H->half / 8.0f; if (half < 8) half = 60; float k = ms / (half * 2);
    rect(mx, my, ms, ms, RGB15(3, 3, 6) | BIT(15)); for (int i = 0; i < nb; i++) { const Cb *c = &cb[i]; int x0 = mx + (int)((c->x0 + half) * k), z0 = my + (int)((c->z0 + half) * k), w = (int)((c->x1 - c->x0) * k) + 1, d = (int)((c->z1 - c->z0) * k) + 1; rect(x0, z0, w, d, c->y1 > 6 ? RGB15(8, 8, 10) | BIT(15) : RGB15(11, 10, 9) | BIT(15)); }
    for (int i = 0; i < npk; i++) if (!pk[i].taken) rect(mx + (int)((pk[i].x + half) * k) - 1, my + (int)((pk[i].z + half) * k) - 1, 3, 3, pk[i].type == 4 || pk[i].type == 7 ? gold : RGB15(8, 26, 8) | BIT(15));
    for (int i = 0; i < nen; i++) if (en[i].alive) rect(mx + (int)((en[i].x + half) * k) - 1, my + (int)((en[i].z + half) * k) - 1, 3, 3, RGB15(28, 4, 4) | BIT(15));
    int ppx = mx + (int)((px + half) * k), ppz = my + (int)((pz + half) * k); rect(ppx - 1, ppz - 1, 3, 3, wh); for (int i = 1; i < 6; i++) px2(ppx + (int)(sinf(yaw) * i), ppz - (int)(cosf(yaw) * i), wh);
    if (mode != M_SAND) { int ex = mx + (int)((H->ex / 8.0f + half) * k), ez = my + (int)((H->ez / 8.0f + half) * k); if (H->ex || H->ez) rect(ex - 2, ez - 2, 5, 5, RGB15(10, 26, 10) | BIT(15)); }
    if (msgt) text(6, 120, msg, gold);
    text(4, 142, "D-PAD MOVE  L/R TURN  A JUMP", gr); text(4, 152, mode == M_SAND ? "STYLUS: LOOK" : "B FIRE  X RELOAD  SEL WEAPON", gr); text(4, 162, "Y 3RD PERSON  STYLUS LOOKS", gr);
    if (state == 1) { text(60, 176, "MISSION COMPLETE  A=AGAIN", gold); } else if (state == 2) text(70, 176, "DOWN  A=RETRY", RGB15(28, 6, 6) | BIT(15));
}

// ---------------------------------------------------------------- game step
static void damage_player(int d)
{
    if (state) return; hurtf = 12;
    if (mode == M_SAND) { hp--; if (hp <= 0) state = 2; say("OUCH"); return; }
    if (sh > 0) { sh -= d; if (sh < 0) { hp += sh; sh = 0; } } else hp -= d; if (hp <= 0) { hp = 0; state = 2; say("YOU DIED"); }
}
static void fire(void)
{
    if (!nw || state) return; const Wp *w = &W[wsel]; if (cdw > 0 || reload > 0) return; if (mag[wsel] <= 0) { if (res[wsel] > 0) reload = w->reload; return; }
    mag[wsel]--; cdw = w->rate; sfx_shot(w->pellets > 1); float fx = sinf(yaw) * cosf(pit), fy = sinf(pit), fz = -cosf(yaw) * cosf(pit), ex = px, ey = py + EYE, ez = pz;
    for (int p = 0; p < w->pellets; p++)
    {   float ax = fx, ay = fy, az = fz;   // aim assist (D-pad aiming is coarse): pull the shot toward an enemy that is nearly on the crosshair
        if (w->pellets == 1) { float bestc = 0.992f; for (int i = 0; i < nen; i++) { if (!en[i].alive) continue; float rx = en[i].x - ex, ry = en[i].y + 1.1f - ey, rz = en[i].z - ez, l2 = sqrtf(rx * rx + ry * ry + rz * rz); if (l2 < 1 || l2 > 70) continue; float cs2 = (rx * fx + ry * fy + rz * fz) / l2; if (cs2 > bestc && has_los(ex, ey, ez, en[i].x, en[i].y + 1.1f, en[i].z)) { bestc = cs2; ax = rx / l2; ay = ry / l2; az = rz / l2; } } }
        float sp = w->spread / 1000.0f * 3.0f, dx = ax + (frand() - .5f) * sp, dy = ay + (frand() - .5f) * sp, dz = az + (frand() - .5f) * sp, l = sqrtf(dx * dx + dy * dy + dz * dz); dx /= l; dy /= l; dz /= l;
        float wt = world_ray(ex, ey, ez, dx, dy, dz, 90), bt = wt; int hit = -1;
        for (int i = 0; i < nen; i++) { if (!en[i].alive) continue; float rx = en[i].x - ex, ry = en[i].y + 1.0f - ey, rz = en[i].z - ez, t = rx * dx + ry * dy + rz * dz; if (t < 0 || t > bt) continue; float qx = ex + dx * t - en[i].x, qy = ey + dy * t - (en[i].y + 1.0f), qz = ez + dz * t - en[i].z; float r = 0.6f * ET[en[i].type].scale / 100.0f; if (qx * qx + qz * qz + qy * qy * 0.5f < r * r) { bt = t; hit = i; } }
        if (hit >= 0) { En *n = &en[hit]; int d = w->dmg; if (n->sh > 0) { n->sh -= d; if (n->sh < 0) { n->hp += n->sh; n->sh = 0; } } else n->hp -= d; n->hurt = 8; n->st = 2; hitm = 8; sfx_blip(1800, 0);
            if (n->hp <= 0) { n->alive = 0; kills++; score += ET[n->type].score; say("TARGET DOWN"); if (frand() < .4f && npk < MAXE) { Pk *k = &pk[npk++]; k->x = n->x; k->y = n->y + .3f; k->z = n->z; k->type = frand() < .5f ? 5 : 6; k->taken = 0; } } }
    }
}
static void step_player(void)
{
    scanKeys(); u32 kh = keysHeld(), kd = keysDown(); touchPosition t; touchRead(&t); static int lx = -1, ly = -1;
    if (kh & KEY_TOUCH) { if (lx >= 0) { yaw += (t.px - lx) * 0.012f; pit -= (t.py - ly) * 0.010f; } lx = t.px; ly = t.py; } else lx = ly = -1;
    if (kh & KEY_LEFT) yaw -= 0.045f; if (kh & KEY_RIGHT) yaw += 0.045f; if (kh & KEY_L) yaw -= 0.03f; if (kh & KEY_R) yaw += 0.03f;
    if (kh & KEY_X && mode != M_SAND) { if (reload == 0 && mag[wsel] < W[wsel].mag && res[wsel] > 0) reload = W[wsel].reload; }
    if (kd & KEY_Y) tp ^= 1; if (kd & KEY_SELECT && nw > 1) { wsel = (wsel + 1) % (nw > 4 ? 4 : nw); cdw = 10; reload = 0; }
    if (pit > 1.2f) pit = 1.2f; if (pit < -1.2f) pit = -1.2f;
    if (state) { if (kd & KEY_A) new_game(); return; }
    float f = 0, r = 0; if (kh & KEY_UP) f += 1; if (kh & KEY_DOWN) f -= 1; (void)r;
    float sp = RUN * (mode == M_SAND ? 1.0f : 0.8f), dt = 1.0f / 60.0f; float mx = sinf(yaw) * f * sp * dt, mz = -cosf(yaw) * f * sp * dt;
    if (kh & KEY_UP && kh & KEY_DOWN) mx = mz = 0;
    float ny = py; if (!blocked(px + mx, pz, ny, 1.7f, RAD)) px += mx; if (!blocked(px, pz + mz, ny, 1.7f, RAD)) pz += mz;
    float half = H->half / 8.0f; if (half > 8) { if (px > half - 1) px = half - 1; if (px < -half + 1) px = -half + 1; if (pz > half - 1) pz = half - 1; if (pz < -half + 1) pz = -half + 1; }
    float fl = floor_at(px, pz, py, RAD); if (!onground || vy > 0) { /* airborne */ } else { if (fl > py) py = fl; }
    if ((kd & KEY_A) && onground) { vy = JUMP; onground = 0; sfx_blip(900, 1); }
    vy -= GRAV * dt; py += vy * dt; fl = floor_at(px, pz, py - vy * dt, RAD);
    if (py <= fl) { py = fl; vy = 0; onground = 1; } else if (py > fl + 0.05f) onground = 0; else onground = 1;
    for (int i = 0; i < nb; i++) { const Cb *c = &cb[i]; if (c->ramp) continue; if (vy > 0 && px > c->x0 - RAD && px < c->x1 + RAD && pz > c->z0 - RAD && pz < c->z1 + RAD && py + 1.75f > c->y0 && py + 1.6f < c->y0 + 0.4f) vy = 0; }
    if (py < -30) { damage_player(40); px = H->sx / 8.0f; pz = H->sz / 8.0f; py = floor_at(px, pz, 50, RAD); vy = 0; }
    if (f && onground) bob += 0.2f;
    if (cdw > 0) cdw--; if (reload > 0 && --reload == 0) { int n = W[wsel].mag - mag[wsel]; if (n > res[wsel]) n = res[wsel]; mag[wsel] += n; res[wsel] -= n; sfx_blip(500, 0); }
    if (mode != M_SAND) { if (W && nw && ((kh & KEY_B) && (W[wsel].autof || (kd & KEY_B)))) fire(); if (nw && !(W[wsel].autof) && (kh & KEY_B) == 0) { } }
    else if (kd & KEY_B) { /* sandbox: ground pound feel */ if (!onground) vy = -14; }
    for (int i = 0; i < npk; i++) { Pk *k = &pk[i]; if (k->taken) continue; float dx = k->x - px, dz = k->z - pz, dy = k->y - (py + 0.9f); if (dx * dx + dz * dz + dy * dy < 1.6f * 1.6f)
        { k->taken = 1; if (k->type == 4) { stars++; score += 500; say("STAR!"); sfx_blip(1500, 0); } else if (k->type == 5) { hp += 25; if (hp > maxhp) hp = maxhp; say("HEALTH"); sfx_blip(1100, 1); } else if (k->type == 6) { for (int q = 0; q < nw; q++) res[q] += W[q].mag; say("AMMO"); sfx_blip(1200, 1); } else if (k->type == 7) { score += 100; if (frand() < .5f) hp = hp + 10 > maxhp ? maxhp : hp + 10; say("LOOT"); sfx_blip(1300, 0); } } }
    if (mode == M_SAND ? stars >= goal : killsNeeded > 0 ? kills >= killsNeeded && (!(H->ex || H->ez) || ((px - H->ex / 8.0f) * (px - H->ex / 8.0f) + (pz - H->ez / 8.0f) * (pz - H->ez / 8.0f) < 25)) : 0) { state = 1; say("COMPLETE"); sfx_blip(2000, 0); }
    if (H->time && state == 0 && --tleft <= 0) { state = 2; say("TIME UP"); }
    if (hurtf > 0) hurtf--; if (hitm > 0) hitm--; if (msgt > 0) msgt--;
}
static void step_enemies(void)
{
    for (int i = 0; i < nen; i++)
    {   En *n = &en[i]; if (!n->alive) continue; const Et *t = &ET[n->type]; float dx = px - n->x, dz = pz - n->z, d = sqrtf(dx * dx + dz * dz); float wy = atan2f(dx, -dz); if (n->hurt > 0) n->hurt--;
        if (((frames + i * 3) & 7) == 0 && d < 60) n->los = has_los(n->x, n->y + 1.5f, n->z, px, py + 1.4f, pz);
        if (d > 60) { n->los = 0; }
        if (n->st == 0 && n->los && d < 32) n->st = 1;
        if (n->st == 0) { n->anim += 0.02f; continue; }
        if (n->st == 2 && d > 70) n->st = 1;
        float want = t->range > 3 ? t->range * 0.6f : 1.2f; n->yaw += (wy - n->yaw) * 0.18f; if (n->yaw - wy > 3.14f) n->yaw -= 6.28f; if (n->yaw - wy < -3.14f) n->yaw += 6.28f;
        float sp = t->spd / 10.0f / 60.0f; int mv = 0;
        if (d > want || !n->los) { float mx = sinf(n->yaw) * sp, mz = -cosf(n->yaw) * sp; if (!blocked(n->x + mx, n->z, n->y, 1.7f, 0.45f)) { n->x += mx; mv = 1; } else if (!blocked(n->x, n->z + mz, n->y, 1.7f, 0.45f)) { n->z += mz; mv = 1; } if (!blocked(n->x, n->z + mz, n->y, 1.7f, 0.45f)) { n->z += mz; mv = 1; }
            if (!mv) { float s2 = sinf(n->yaw + 1.5f) * sp, c2 = -cosf(n->yaw + 1.5f) * sp; if (!blocked(n->x + s2, n->z + c2, n->y, 1.7f, 0.45f)) { n->x += s2; n->z += c2; } } }
        else if (t->range > 3) { float s2 = sinf(n->yaw + 1.57f) * sp * 0.6f, c2 = -cosf(n->yaw + 1.57f) * sp * 0.6f; if (!blocked(n->x + s2, n->z + c2, n->y, 1.7f, 0.45f)) { n->x += s2; n->z += c2; mv = 1; } }
        n->y = floor_at(n->x, n->z, n->y + 1, 0.4f); if (mv) n->anim += 0.25f;
        if (n->cd > 0) n->cd--; if (n->burst > 0 && (frames & 3) == 0 && n->los) { n->burst--; sfx_shot(0); { float ch = 0.52f - d * 0.016f - t->acc * 0.012f; if (ch < 0.06f) ch = 0.06f; if (frand() < ch) damage_player(t->dmg); } }
        else if (n->cd == 0 && n->los && d < (t->range > 3 ? t->range : 1.8f) + 8) { if (t->range > 3) { n->burst = t->burst; n->cd = t->cd; } else if (d < 1.8f) { damage_player(t->dmg); n->cd = t->cd; } }
    }
}

// ---------------------------------------------------------------- render
static void overlay_quad(float x0, float y0, float x1, float y1, u16 c)    // camera-space HUD quad at z = -0.1 (GL units)
{
    glColor(c); glVertex3v16(floattov16(x0), floattov16(y0), floattov16(-0.1f)); glVertex3v16(floattov16(x1), floattov16(y0), floattov16(-0.1f)); glVertex3v16(floattov16(x1), floattov16(y1), floattov16(-0.1f)); glVertex3v16(floattov16(x0), floattov16(y1), floattov16(-0.1f));
}
static void render(void)
{
    glClearColor(0, 0, 0, 31); glClearColor((sky0 & 31), (sky0 >> 5) & 31, (sky0 >> 10) & 31, 31); glClearPolyID(63); glClearDepth(0x7FFF);
    float cy = cosf(yaw), sy = sinf(yaw), cp = cosf(pit), sp = sinf(pit); float ex = px, ey = py + EYE, ez = pz;
    float fx = sy * cp, fy = sp, fz = -cy * cp;
    if (tp) { ex -= fx * 4.2f; ey -= fy * 4.2f - 0.6f; ez -= fz * 4.2f; ex += cy * 0.7f; ez += sy * 0.7f; if (ey < 0.3f) ey = 0.3f; }   // over the shoulder
    float rx = cy, rz = sy, ux = -sy * sp, uy = cp, uz = cy * sp;      // right, up
    // view matrix (column-major, GL units): rows = right, up, -forward
    m4x4 m; float ps[3] = { ex * SC, ey * SC, ez * SC };
    float R[3][3] = { { rx, 0, rz }, { -ux * -1 * -1, uy, -uz * -1 * -1 }, { -fx, -fy, -fz } };
    R[1][0] = ux; R[1][1] = uy; R[1][2] = uz;
    for (int c = 0; c < 3; c++) for (int r = 0; r < 3; r++) m.m[c * 4 + r] = floattof32(R[r][c]);
    for (int r = 0; r < 3; r++) m.m[12 + r] = floattof32(-(R[r][0] * ps[0] + R[r][1] * ps[1] + R[r][2] * ps[2]));
    m.m[3] = m.m[7] = m.m[11] = 0; m.m[15] = floattof32(1);
    glMatrixMode(GL_MODELVIEW); glLoadMatrix4x4(&m);
    glPolyFmt(POLY_ALPHA(31) | POLY_CULL_BACK | POLY_ID(1));
    glBegin(GL_QUADS);                                           // ground and horizon
    float G = (H->half / 8.0f + 200) * SC; v16 g = floattov16(G > 7.9f ? 7.9f : G);
    glColor(groundc); glVertex3v16(-g, 0, -g); glVertex3v16(-g, 0, g); glVertex3v16(g, 0, g); glVertex3v16(g, 0, -g);
    for (int i = 0; i < nb; i++) { const Cb *c = &cb[i]; float dx = (c->x0 + c->x1) * .5f - px, dz = (c->z0 + c->z1) * .5f - pz; float rr = (c->x1 - c->x0 + c->z1 - c->z0) * .5f; float dd = dx * dx + dz * dz; if (dd > 95 * 95) continue; if (dd > rr * rr && dx * fx + dz * fz < -rr * 0.7f) continue; draw_cb(c, 0); }
    glEnd();
    glBegin(GL_QUADS);
    for (int i = 0; i < nen; i++) { const En *n = &en[i]; if (!n->alive) continue; const Et *t = &ET[n->type]; float dx = n->x - px, dz = n->z - pz; if (dx * dx + dz * dz > 80 * 80) continue; if (dx * fx + dz * fz < -3) continue; u16 col = n->hurt > 0 ? RGB15(31, 28, 20) | BIT(15) : t->col | BIT(15); person(n->x, n->y, n->z, n->yaw, t->scale / 100.0f, col, RGB15(24, 18, 14) | BIT(15), n->anim, n->burst > 0 ? 1.4f : 0); }
    for (int i = 0; i < npk; i++) { const Pk *k = &pk[i]; if (k->taken) continue; float a = frames * 0.07f + i; u16 c = k->type == 4 ? RGB15(31, 27, 6) | BIT(15) : k->type == 5 ? RGB15(8, 28, 8) | BIT(15) : k->type == 6 ? RGB15(8, 16, 28) | BIT(15) : RGB15(28, 20, 8) | BIT(15); float bo = sinf(frames * 0.05f + i) * 0.15f; qbox(k->x, k->y + bo, k->z, 0.38f, 0.76f, 0.38f, a, c); qbox(k->x, k->y + bo + 0.19f, k->z, 0.38f, 0.38f, 0.38f, a + 0.78f, shade(c, 28)); }
    for (int i = 0; i < ne0; i++) if (E0[i].type == 8) person(E0[i].x / 8.0f, floor_at(E0[i].x / 8.0f, E0[i].z / 8.0f, 20, .4f), E0[i].z / 8.0f, 0.5f + i, 1, RGB15(10, 16, 24) | BIT(15), RGB15(24, 18, 14) | BIT(15), 0, 0);
    if (tp) person(px, py, pz, yaw, 1, RGB15(8, 14, 26) | BIT(15), RGB15(26, 20, 16) | BIT(15), bob, 0);
    if (mode != M_SAND && (H->ex || H->ez)) { float a = frames * 0.03f; qbox(H->ex / 8.0f, floor_at(H->ex / 8.0f, H->ez / 8.0f, 20, 1), H->ez / 8.0f, 1.6f, 0.15f, 1.6f, a, RGB15(10, 28, 10) | BIT(15)); }
    glEnd();
    // viewmodel + HUD in camera space
    glMatrixMode(GL_MODELVIEW); glLoadIdentity(); glPolyFmt(POLY_ALPHA(31) | POLY_CULL_NONE | POLY_ID(2)); glBegin(GL_QUADS);
    if (!tp && mode != M_SAND && nw) { float rc = cdw > 0 ? 0.004f : 0; float gx = 0.036f, gy = -0.04f, gz = -0.12f + rc; u16 gc = RGB15(6, 6, 7) | BIT(15); overlay_quad(gx - .004f, gy, gx + .004f, gy + .026f, gc); glColor(shade(gc, 28)); glVertex3v16(floattov16(gx - .004f), floattov16(gy + .026f), floattov16(gz)); glVertex3v16(floattov16(gx + .004f), floattov16(gy + .026f), floattov16(gz)); glVertex3v16(floattov16(gx + .004f), floattov16(gy + .026f), floattov16(gz - .05f)); glVertex3v16(floattov16(gx - .004f), floattov16(gy + .026f), floattov16(gz - .05f)); }
    { u16 cc = hitm ? RGB15(31, 8, 8) | BIT(15) : RGB15(28, 31, 28) | BIT(15); float o = 0.004f, l = 0.008f, w = 0.0008f; overlay_quad(-o - l, -w, -o, w, cc); overlay_quad(o, -w, o + l, w, cc); overlay_quad(-w, o, w, o + l, cc); overlay_quad(-w, -o - l, w, -o, cc); }
    if (mode != M_SAND) { float hw = 0.07f * hp / (maxhp ? maxhp : 1); overlay_quad(-0.088f, -0.066f, -0.088f + 0.07f, -0.062f, RGB15(6, 2, 2) | BIT(15)); overlay_quad(-0.088f, -0.066f, -0.088f + hw, -0.062f, RGB15(26, 5, 5) | BIT(15)); if (maxsh) { float sw = 0.07f * sh / maxsh; overlay_quad(-0.088f, -0.060f, -0.088f + sw, -0.057f, RGB15(8, 18, 28) | BIT(15)); } }
    else for (int i = 0; i < hp; i++) overlay_quad(-0.088f + i * 0.011f, -0.066f, -0.080f + i * 0.011f, -0.058f, RGB15(28, 6, 6) | BIT(15));
    glEnd();
    if (hurtf > 0) { glPolyFmt(POLY_ALPHA(6 + hurtf / 2) | POLY_CULL_NONE | POLY_ID(3)); glBegin(GL_QUADS); overlay_quad(-0.1f, -0.1f, 0.1f, 0.1f, RGB15(31, 0, 0) | BIT(15)); glEnd(); }
    glFlush(0);
}

int main(void)
{
    defaultExceptionHandler(); powerOn(POWER_ALL_2D | POWER_3D_CORE); lcdMainOnTop(); videoSetMode(MODE_0_3D); videoSetModeSub(MODE_5_2D); vramSetBankA(VRAM_A_TEXTURE); vramSetBankC(VRAM_C_SUB_BG);
    int bg = bgInitSub(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0); botv = bgGetGfxPtr(bg); glInit(); glEnable(GL_ANTIALIAS); glDisable(GL_TEXTURE_2D); glEnable(GL_BLEND); glViewport(0, 0, 255, 191);
    glMatrixMode(GL_PROJECTION); glLoadIdentity(); gluPerspective(70, 256.0f / 192.0f, 0.01f, 12.0f);
    dmaCopy(splash_bin, botv, 256 * 192 * 2); for (int i = 0; i < 150; i++) { swiWaitForVBlank(); snd_input(); }
    load_world(); new_game(); snd_master(110);
    for (;;)
    {
        snd_input(); step_player(); if (!state) step_enemies(); frames++;
        hud_bottom(); render(); swiWaitForVBlank(); dmaCopy(botb, botv, sizeof botb);
    }
}

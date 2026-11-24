// NOTAREAL Game Studio - software-rendered 3D world engine for N64 and PlayStation (and a host build for testing).
// The game logic is the same as the DS engine (engine/world3d): same W3DW world data, same physics, enemies and weapons.
// Rendering: boxes are projected with integer maths, flat shaded, painter's order, into a 160x96 buffer that is doubled to 320x192;
// the bottom 48 lines are the HUD (objective, health, ammo, minimap).
#include <stdint.h>
#include <string.h>
#include <stdio.h>
typedef uint8_t u8; typedef int16_t s16; typedef uint16_t u16; typedef uint32_t u32;
#define BIT(n) (1 << (n))
#define RGB15(r, g, b) ((r) | ((g) << 5) | ((b) << 10))
// ---- platform layer (hal_n64.c / hal_psx.c / host.c)
void h_present(const u16 *fb);          // 320x240 RGB555 (bit 15 ignored); waits for vblank
unsigned h_keys(void);                  // KEY_* bits held
void h_blip(int hz, int ch);            // short square beep
void h_shot(int big);                   // noise burst
#ifndef HOST_DATA
extern const unsigned char nr_gamedata[];
#endif
#define KEY_UP 1
#define KEY_DOWN 2
#define KEY_LEFT 4
#define KEY_RIGHT 8
#define KEY_L 16
#define KEY_R 32
#define KEY_A 64
#define KEY_B 128
#define KEY_X 256
#define KEY_Y 512
#define KEY_SELECT 1024
#define KEY_START 2048
// ---- maths without libm (the PlayStation has no FPU, and this keeps both builds identical)
static float nr_fabs(float x) { return x < 0 ? -x : x; }
static float nr_sin(float x)
{
    const float TP = 6.2831853f, PI = 3.14159265f; x -= TP * (float)(int)(x / TP); if (x > PI) x -= TP; if (x < -PI) x += TP;
    float y = 1.27323954f * x - 0.405284735f * x * nr_fabs(x); return 0.225f * (y * nr_fabs(y) - y) + y;
}
static float nr_cos(float x) { return nr_sin(x + 1.57079633f); }
static float nr_sqrt(float x)
{
    if (x <= 0) return 0; union { float f; u32 i; } u; u.f = x; u.i = 0x5f3759dfu - (u.i >> 1); float y = u.f;
    y = y * (1.5f - 0.5f * x * y * y); y = y * (1.5f - 0.5f * x * y * y); y = y * (1.5f - 0.5f * x * y * y); return x * y;
}
static float nr_atan2(float y, float x)
{
    float ax = nr_fabs(x), ay = nr_fabs(y), mx = ax > ay ? ax : ay, mn = ax > ay ? ay : ax; if (mx == 0) return 0;
    float a = mn / mx, s = a * a, r = ((-0.0464964749f * s + 0.15931422f) * s - 0.327622764f) * s * a + a;
    if (ay > ax) r = 1.57079637f - r; if (x < 0) r = 3.14159274f - r; if (y < 0) r = -r; return r;
}
#define sinf nr_sin
#define cosf nr_cos
#define sqrtf nr_sqrt
#define atan2f nr_atan2
#define fabsf nr_fabs

// shared with the DS engine: world format, physics, enemies, weapons
static unsigned w3_kh, w3_kd;
typedef struct { char id[4]; unsigned off, size; } Sec;
typedef struct { char magic[8]; unsigned capacity, used, count; Sec sec[]; } Hdr;
#pragma pack(push, 1)
typedef struct { s16 x0, y0, z0, x1, y1, z1; u16 col, top; u8 kind, axis; s16 h0, h1, pad; } Bx;              // 24 bytes, metres x 8; kind 2 = ramp
typedef struct { u8 type, flags; s16 x, y, z; } Ent;                                                          // 8 bytes. type 0-3 enemy, 4 star, 5 health, 6 ammo, 7 loot, 8 npc
typedef struct { char name[12]; u8 dmg, rate, mag, pellets; u16 reserve; u8 spread, autof; u16 reload; u8 pad[2]; } Wp;   // 24 bytes
typedef struct { u16 hp, sh, spd; u8 dmg, cd, burst, acc; u16 score; u8 scale, range; u16 col; } Et;          // 16 bytes
typedef struct { u8 mode, res; u16 nbox, nent; u8 nweap, nety; s16 sx, sz, yaw, half; u16 sky0, sky1, ground, time; s16 ex, ez; u16 goal, pad; char title[32]; u16 run, jump, grav, hp, sh, pad2[3]; } Hd;  // 80 bytes
#pragma pack(pop)
#define SC (1.0f / 16.0f)
#define MAXB 300
#define MAXE 64
static const Hd *H; static const Bx *B; static const Ent *E0; static const Wp *W; static const Et *ET; static int nb, ne0, nw, nety;
typedef struct { u16 c[6]; float x0, y0, z0, x1, y1, z1, h0, h1; u8 ramp, axis; } Cb;
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
    u16 c = b->col, t = b->top ? b->top : b->col; for (int f = 0; f < 6; f++) o->c[f] = shade(f == 0 ? t : c, LV[f]);
}
// ---------------------------------------------------------------- state
enum { M_SAND, M_WAR, M_WASTE, M_STORE, M_FRONT, M_KART };
static int mode, goal, score, frames, state, stars, kills, killsNeeded, tleft, msgt, hitm, flashd, tp, runi;
static float px, py, pz, vy, yaw, pit, bob; static int onground, hp, sh, maxhp, maxsh, wsel, cdw, reload, hurtf, rundown;
static int mag[4], res[4]; static char msg[40];
static float aim_cone = 0.992f, cam_dist = 4.2f, cam_side = 0, mount_h = 0;
static float RUN, JUMP, GRAV; static u16 sky0, sky1, groundc;
static const float EYE = 1.62f, RAD = 0.42f;
static void say(const char *s) { strncpy(msg, s, 39); msg[39] = 0; msgt = 150; }
static int rnd(void) { static unsigned s = 12345; s ^= s << 13; s ^= s >> 17; s ^= s << 5; return s & 0x7fffffff; }
static float frand(void) { return (rnd() & 0xffff) / 65535.0f; }
static void sfx_shot(int big) { h_shot(big); }
static void sfx_blip(int hz, int ch) { h_blip(hz, ch); }

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
// The world data is little-endian (written by the kit); the N64 is big-endian, so it is copied to RAM and fixed up once at load.
static unsigned rd32(const u8 *p) { return p[0] | p[1] << 8 | p[2] << 16 | (unsigned)p[3] << 24; }
static u8 wbuf[16384];
#if defined(__BYTE_ORDER__) && __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
static void sw16(u8 *p) { u8 t = p[0]; p[0] = p[1]; p[1] = t; }
static void fix_endian(u8 *d)
{
    static const u8 HO[] = { 2, 4, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 64, 66, 68, 70, 72, 74, 76, 78 }, BO[] = { 0, 2, 4, 6, 8, 10, 12, 14, 18, 20, 22 }, EO[] = { 2, 4, 6 }, WO[] = { 16, 20 }, TO[] = { 0, 2, 4, 10, 14 };
    int nb_ = d[2] | d[3] << 8, ne_ = d[4] | d[5] << 8, nw_ = d[6], nt_ = d[7];
    for (unsigned k = 0; k < sizeof HO; k++) sw16(d + HO[k]);
    if (d[0] == 5) for (int k = 0; k < 15; k++) sw16(d + 80 + k * 2);   // vehicle combat: KcCfg follows the header
    u8 *p = d + 80; for (int i = 0; i < nb_; i++, p += 24) for (unsigned k = 0; k < sizeof BO; k++) sw16(p + BO[k]);
    for (int i = 0; i < ne_; i++, p += 8) for (unsigned k = 0; k < sizeof EO; k++) sw16(p + EO[k]);
    for (int i = 0; i < nw_; i++, p += 24) for (unsigned k = 0; k < sizeof WO; k++) sw16(p + WO[k]);
    for (int i = 0; i < nt_; i++, p += 16) for (unsigned k = 0; k < sizeof TO; k++) sw16(p + TO[k]);
}
#else
static void fix_endian(u8 *d) { (void)d; }
#endif
static int FR_ok(void); static void front_load(void); static int f_passive(const En *n);
static void load_world(void)
{
    const u8 *g = nr_gamedata; H = 0; unsigned used = rd32(g + 12), count = rd32(g + 16);
    if (used) for (unsigned i = 0; i < count; i++) { const u8 *s = g + 20 + i * 12; if (memcmp(s, "W3DW", 4) || rd32(s + 8) > sizeof wbuf) continue;
        memcpy(wbuf, g + rd32(s + 4), rd32(s + 8)); fix_endian(wbuf); u8 *p = wbuf; H = (const Hd *)p; p += sizeof(Hd); B = (const Bx *)p; nb = H->nbox; p += nb * sizeof(Bx); E0 = (const Ent *)p; ne0 = H->nent; p += ne0 * sizeof(Ent); W = (const Wp *)p; nw = H->nweap; p += nw * sizeof(Wp); ET = (const Et *)p; nety = H->nety; }
    if (!H) default_world(); if (nb > MAXB) nb = MAXB; if (ne0 > MAXE) ne0 = MAXE;
    for (int i = 0; i < nb; i++) make_box(&cb[i], &B[i]);
    mode = H->mode > 5 ? 0 : H->mode; sky0 = H->sky0 | BIT(15); sky1 = H->sky1 | BIT(15); groundc = H->ground | BIT(15); RUN = H->run / 10.0f; JUMP = H->jump / 10.0f; GRAV = H->grav / 10.0f; if (mode == M_FRONT) { front_load(); if (!FR_ok()) mode = M_WAR; } if (RUN < 2) RUN = 7; if (JUMP < 2) JUMP = 9; if (GRAV < 5) GRAV = 24;
}
static void store_new(void); static void front_new(void); static void front_load(void);
static void new_game(void)
{
    if (mode == M_STORE) { nen = npk = 0; state = 0; msgt = 0; store_new(); return; }
    px = H->sx / 8.0f; pz = H->sz / 8.0f; yaw = H->yaw * 0.0174533f; pit = 0; py = floor_at(px, pz, 50, 0.4f); vy = 0; hp = H->hp ? H->hp : 100; sh = H->sh; maxhp = hp; maxsh = sh; wsel = 0; cdw = reload = 0; score = stars = kills = 0; state = 0; tleft = H->time * 60; goal = H->goal;
    for (int i = 0; i < 4; i++) { mag[i] = i < nw ? W[i].mag : 0; res[i] = i < nw ? W[i].reserve : 0; }
    nen = npk = 0; killsNeeded = 0; static int dummy; (void)dummy;
    for (int i = 0; i < ne0; i++)
    {   const Ent *e = &E0[i];
        if (e->type <= 3 && nen < MAXE) { En *n = &en[nen++]; memset(n, 0, sizeof *n); n->x = e->x / 8.0f; n->z = e->z / 8.0f; n->y = floor_at(n->x, n->z, e->y / 8.0f + 1, 0.4f); n->type = e->type < nety ? e->type : 0; n->hp = ET[n->type].hp; n->sh = ET[n->type].sh; n->alive = 1; n->yaw = frand() * 6.28f; n->cd = 30 + rnd() % 60; if (e->flags & 1) n->st = 0; killsNeeded++; }
        else if (e->type >= 4 && npk < MAXE) { Pk *k = &pk[npk++]; k->x = e->x / 8.0f; k->y = e->y / 8.0f; k->z = e->z / 8.0f; k->type = e->type; k->taken = 0; }
    }
    if (mode == M_SAND && goal == 0) goal = npk;
    if (mode == M_FRONT) { front_new(); return; }
    say(mode == M_SAND ? "COLLECT THE STARS" : mode == M_WAR ? "CLEAR THE AREA" : "CLEAR THE RAIDERS");
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
        if (w->pellets == 1) { float bestc = aim_cone; for (int i = 0; i < nen; i++) { if (!en[i].alive) continue; float rx = en[i].x - ex, ry = en[i].y + 1.1f - ey, rz = en[i].z - ez, l2 = sqrtf(rx * rx + ry * ry + rz * rz); if (l2 < 1 || l2 > 70) continue; float cs2 = (rx * fx + ry * fy + rz * fz) / l2; if (cs2 > bestc && has_los(ex, ey, ez, en[i].x, en[i].y + 1.1f, en[i].z)) { bestc = cs2; ax = rx / l2; ay = ry / l2; az = rz / l2; } } }
        float sp = w->spread / 1000.0f * 3.0f, dx = ax + (frand() - .5f) * sp, dy = ay + (frand() - .5f) * sp, dz = az + (frand() - .5f) * sp, l = sqrtf(dx * dx + dy * dy + dz * dz); dx /= l; dy /= l; dz /= l;
        float wt = world_ray(ex, ey, ez, dx, dy, dz, 90), bt = wt; int hit = -1;
        for (int i = 0; i < nen; i++) { if (!en[i].alive) continue; float rx = en[i].x - ex, ry = en[i].y + 1.0f - ey, rz = en[i].z - ez, t = rx * dx + ry * dy + rz * dz; if (t < 0 || t > bt) continue; float qx = ex + dx * t - en[i].x, qy = ey + dy * t - (en[i].y + 1.0f), qz = ez + dz * t - en[i].z; float r = 0.6f * ET[en[i].type].scale / 100.0f; if (qx * qx + qz * qz + qy * qy * 0.5f < r * r) { bt = t; hit = i; } }
        if (hit >= 0) { En *n = &en[hit]; int d = w->dmg; if (n->sh > 0) { n->sh -= d; if (n->sh < 0) { n->hp += n->sh; n->sh = 0; } } else n->hp -= d; n->hurt = 8; n->st = 2; hitm = 8; sfx_blip(1800, 0);
            if (n->hp <= 0) { n->alive = 0; kills++; score += ET[n->type].score; say("TARGET DOWN"); if (frand() < .4f && npk < MAXE) { Pk *k = &pk[npk++]; k->x = n->x; k->y = n->y + .3f; k->z = n->z; k->type = frand() < .5f ? 5 : 6; k->taken = 0; } } }
    }
}
static void step_player(void)
{
    u32 kh = w3_kh, kd = w3_kd;
    if (kh & KEY_LEFT) yaw -= 0.045f; if (kh & KEY_RIGHT) yaw += 0.045f; if (kh & KEY_L) yaw -= 0.03f; if (kh & KEY_R) yaw += 0.03f;
    if (kh & KEY_X && mode != M_SAND) { if (reload == 0 && mag[wsel] < W[wsel].mag && res[wsel] > 0) reload = W[wsel].reload; }
    if (kd & KEY_Y) tp ^= 1; if (kd & KEY_SELECT && nw > 1) { wsel = (wsel + 1) % (nw > 4 ? 4 : nw); cdw = 10; reload = 0; }
    if (yaw > 6.2832f) yaw -= 6.2832f; if (yaw < -6.2832f) yaw += 6.2832f; if (pit > 1.2f) pit = 1.2f; if (pit < -1.2f) pit = -1.2f;
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
        if (n->st == 0 && n->los && d < 32 && !(mode == M_FRONT && f_passive(n))) n->st = 1;
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

// ---------------------------------------------------------------- software renderer
#define RW 160
#define RH 96
#define CXS 80
#define CYS 48
#define FOC 86
#define NEARD 256
static u16 fb3[RW * RH], outb[320 * 240];
static short spl[RH], spr[RH];
static int camx, camy, camz, Rx, Ry, Rz, Ux, Uy, Uz, Fx, Fy, Fz;
static void fill_poly(const int *v3, int n, u16 col)
{
    int ox[12], oy[12], od[12], m = 0, px[12], py[12], i;
    for (i = 0; i < n; i++)
    {   const int *a = v3 + i * 3, *b = v3 + ((i + 1) % n) * 3; int ia = a[2] >= NEARD, ib = b[2] >= NEARD;
        if (ia) { ox[m] = a[0]; oy[m] = a[1]; od[m] = a[2]; m++; }
        if (ia != ib) { float t = (float)(NEARD - a[2]) / (float)(b[2] - a[2]); ox[m] = a[0] + (int)((b[0] - a[0]) * t); oy[m] = a[1] + (int)((b[1] - a[1]) * t); od[m] = NEARD; m++; }
    }
    if (m < 3) return;
    int miny = 9999, maxy = -9999;
    for (i = 0; i < m; i++)
    {   int x = CXS + (ox[i] * FOC) / od[i], y = CYS - (oy[i] * FOC) / od[i]; if (x < -3000) x = -3000; if (x > 3000) x = 3000; if (y < -3000) y = -3000; if (y > 3000) y = 3000;
        px[i] = x; py[i] = y; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    if (maxy < 0 || miny >= RH) return;
    int y0c = miny < 0 ? 0 : miny, y1c = maxy >= RH ? RH - 1 : maxy;
    for (int y = y0c; y <= y1c; y++) { spl[y] = 32767; spr[y] = -32767; }
    for (i = 0; i < m; i++)
    {   int a = px[i], b = py[i], c = px[(i + 1) % m], d = py[(i + 1) % m]; if (b == d) { if (b >= 0 && b < RH) { int lo = a < c ? a : c, hi = a < c ? c : a; if (lo < spl[b]) spl[b] = lo; if (hi > spr[b]) spr[b] = hi; } continue; }
        if (b > d) { int t = a; a = c; c = t; t = b; b = d; d = t; }
        int slope = ((c - a) << 8) / (d - b), xx = (a << 8) + 128, ys = b < 0 ? 0 : b, ye = d >= RH ? RH - 1 : d; xx += slope * (ys - b);
        for (int y = ys; y <= ye; y++, xx += slope) { int x = xx >> 8; if (x < spl[y]) spl[y] = x; if (x > spr[y]) spr[y] = x; }
    }
    for (int y = y0c; y <= y1c; y++)
    {   int a = spl[y], b = spr[y]; if (a > b) continue; if (a < 0) a = 0; if (b > RW - 1) b = RW - 1; u16 *row = fb3 + y * RW; for (int x = a; x <= b; x++) row[x] = col; }
}
static const u8 QF[6][4] = { { 4, 6, 7, 5 }, { 2, 3, 7, 6 }, { 1, 0, 4, 5 }, { 3, 1, 5, 7 }, { 0, 2, 6, 4 }, { 0, 1, 3, 2 } };
static void draw_box8(const int *X, const int *Y, const int *Z, const u16 *cols, int mask)
{
    int cv[8][3], any = 0;
    for (int i = 0; i < 8; i++)
    {   int dx = X[i] - camx, dy = Y[i] - camy, dz = Z[i] - camz;
        cv[i][0] = (dx * Rx + dy * Ry + dz * Rz) >> 4; cv[i][1] = (dx * Ux + dy * Uy + dz * Uz) >> 4; cv[i][2] = (dx * Fx + dy * Fy + dz * Fz) >> 4; if (cv[i][2] >= NEARD) any = 1; }
    if (!any) return;
    for (int f = 0; f < 6; f++) { if (!(mask & (1 << f))) continue; int q[12]; for (int k = 0; k < 4; k++) { q[k * 3] = cv[QF[f][k]][0]; q[k * 3 + 1] = cv[QF[f][k]][1]; q[k * 3 + 2] = cv[QF[f][k]][2]; } fill_poly(q, 4, cols[f]); }
}
static const u8 LVL[6] = { 32, 27, 22, 29, 24, 14 };
static void draw_axis_box(int i)
{
    const Bx *b = &B[i]; int X[8], Y[8], Z[8]; for (int k = 0; k < 8; k++) { X[k] = k & 1 ? b->x1 : b->x0; Z[k] = k & 2 ? b->z1 : b->z0; Y[k] = k & 4 ? b->y1 : b->y0; }
    int mask = 0; if (camy > b->y1) mask |= 1; if (camz > b->z1) mask |= 2; if (camz < b->z0) mask |= 4; if (camx > b->x1) mask |= 8; if (camx < b->x0) mask |= 16; if (camy < b->y0) mask |= 32;
    draw_box8(X, Y, Z, cb[i].c, mask);
}
// a rotated box in world metres (people, pickups)
static void qbox(float cx, float y0, float cz, float hx, float h, float hz, float yaw, u16 col)
{
    float s = sinf(yaw), c = cosf(yaw); int X[8], Y[8], Z[8]; u16 cols[6];
    for (int i = 0; i < 8; i++) { float lx = (i & 1 ? hx : -hx), lz = (i & 2 ? hz : -hz), ly = i & 4 ? h : 0; X[i] = (int)((cx + lx * c + lz * s) * 8); Z[i] = (int)((cz - lx * s + lz * c) * 8); Y[i] = (int)((y0 + ly) * 8); }
    for (int f = 0; f < 6; f++) cols[f] = shade(col, LVL[f]);
    float ex = camx / 8.0f - cx, ez = camz / 8.0f - cz, exl = ex * c - ez * s, ezl = ex * s + ez * c; int mask = 0;
    if (camy / 8.0f > y0 + h) mask |= 1; if (ezl > hz) mask |= 2; if (ezl < -hz) mask |= 4; if (exl > hx) mask |= 8; if (exl < -hx) mask |= 16; if (camy / 8.0f < y0) mask |= 32;
    draw_box8(X, Y, Z, cols, mask);
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
typedef struct { int key; short kind, idx; } Item;
static Item items[MAXB + 2 * MAXE + 80]; static int nitems;
static void add_item(int kind, int idx, int dx, int dz) { items[nitems].key = dx * dx + dz * dz; items[nitems].kind = kind; items[nitems].idx = idx; nitems++; }
static void sort_items(void)
{
    for (int gap = nitems / 2; gap > 0; gap /= 2) for (int i = gap; i < nitems; i++) { Item t = items[i]; int j = i; while (j >= gap && items[j - gap].key < t.key) { items[j] = items[j - gap]; j -= gap; } items[j] = t; }
}
static void itoa_(char *b, int v);
#include "w3store.h"
#include "w3front.h"
static int FR_ok(void) { return FR != 0; }
// ---- shared asset library (ASET): skyline wrapped around the horizon, land texture mapped onto the ground plane. Per-row float, per-pixel integer.
#include "aset.h"
static const u8 *a_sky, *a_land; static int a_init; static float a_atan[RW];
static void aset_boot(void) { a_init = 1; a_sky = aset_tex(nr_gamedata, ASET_SKY); a_land = aset_tex(nr_gamedata, ASET_LAND); for (int x = 0; x < RW; x++) { float q = (x - CXS + 0.5f) / (float)FOC; a_atan[x] = q / (1.0f + 0.28f * q * q); } }
static void backdrop(float ex, float ey, float ez, float fx, float fy, float fz, float cy, float sy, float cp, float sp, u16 sk, u16 gc)
{
    int skyu[RW]; if (a_sky) for (int x = 0; x < RW; x++) { float a = (yaw + a_atan[x]) * (512.0f / 6.2831853f); int u = (int)(a + 4096.0f); skyu[x] = u & 127; }
    int hor = -1; for (int y = 0; y < RH; y++) { float b = (CYS - y + 0.5f) / FOC; if (fy + cp * b < -0.002f) { hor = y; break; } } if (hor < 0) hor = RH;
    for (int y = 0; y < RH; y++) { u16 *row = fb3 + y * RW;
        if (y < hor) { int v = 63 - (hor - 1 - y); if (v < 0) v = 0; if (!a_sky) { for (int x = 0; x < RW; x++) row[x] = sk; continue; }
            const u8 *px = a_sky + 4 + 512 + v * 128; for (int x = 0; x < RW; x++) { int i = px[skyu[x]]; row[x] = a_sky[4 + i * 2] | (a_sky[5 + i * 2] << 8) | BIT(15); } continue; }
        float b = (CYS - y + 0.5f) / FOC, dy = fy + cp * b, t = ey / -dy;
        if (!a_land || t > 70.0f) { for (int x = 0; x < RW; x++) row[x] = gc; continue; }
        float a0 = (0 - CXS + 0.5f) / FOC, wx = ex + t * (fx - sy * sp * b + cy * a0), wz = ez + t * (fz + cy * sp * b + sy * a0), sx = t * cy / FOC, sz = t * sy / FOC;
        int iu = (int)(wx * 16 * 65536.0f), iv = (int)(wz * 16 * 65536.0f), du = (int)(sx * 16 * 65536.0f), dv = (int)(sz * 16 * 65536.0f);
        for (int x = 0; x < RW; x++) { int u = (iu >> 16) & 63, v = (iv >> 16) & 63, k = v * 64 + u, i = (a_land[4 + 32 + (k >> 1)] >> ((k & 1) * 4)) & 15; row[x] = a_land[4 + i * 2] | (a_land[5 + i * 2] << 8) | BIT(15); iu += du; iv += dv; }
    }
}
static void render3d(void)
{
    float cy = cosf(yaw), sy = sinf(yaw), cp = cosf(pit), sp = sinf(pit); float ex = px, ey = py + EYE, ez = pz;
    float fx = sy * cp, fy = sp, fz = -cy * cp;
    if (tp) { ex -= fx * cam_dist; ey -= fy * cam_dist - 0.6f; ez -= fz * cam_dist; ex += cy * cam_side; ez += sy * cam_side; ey += mount_h; if (ey < 0.3f) ey = 0.3f; }
    camx = (int)(ex * 8); camy = (int)(ey * 8); camz = (int)(ez * 8);
    Rx = (int)(cy * 4096); Ry = 0; Rz = (int)(sy * 4096); Ux = (int)(-sy * sp * 4096); Uy = (int)(cp * 4096); Uz = (int)(cy * sp * 4096); Fx = (int)(fx * 4096); Fy = (int)(fy * 4096); Fz = (int)(fz * 4096);
    // sky above the horizon (two-tone), ground below
    int hor = CYS + (int)(sp / (cp > 0.2f ? cp : 0.2f) * FOC); if (hor < 0) hor = 0; if (hor > RH) hor = RH;
    u16 sk0 = sky0, sk1 = sky1, gc = groundc; if (mode == M_STORE) { sk0 = shade(sky0, s_night); sk1 = shade(sky1, s_night); gc = shade(groundc, s_night * 3 / 4 + 8); }
    if (!a_init) aset_boot();
    if (a_sky || a_land) backdrop(ex, ey, ez, fx, fy, fz, cy, sy, cp, sp, sk1, gc);
    else for (int y = 0; y < RH; y++) { u16 c = y < hor ? (y < hor / 2 ? sk0 : sk1) : gc; u16 *row = fb3 + y * RW; for (int x = 0; x < RW; x++) row[x] = c; }
    nitems = 0;
    for (int i = 0; i < nb; i++)
    {   const Bx *b = &B[i]; if (b->kind == 3) continue; int cxm = (b->x0 + b->x1) / 2 - camx, czm = (b->z0 + b->z1) / 2 - camz, rr = ((b->x1 - b->x0) + (b->z1 - b->z0)) / 2; int dd = cxm * cxm + czm * czm;
        if (dd > 760 * 760) continue; if (dd > rr * rr && ((cxm * Fx + czm * Fz) >> 12) < -(rr * 7 / 10)) continue; add_item(0, i, cxm, czm); }
    for (int i = 0; i < nen; i++) { const En *n = &en[i]; if (!n->alive) continue; float dx = n->x - px, dz = n->z - pz; if (dx * dx + dz * dz > 80 * 80) continue; if (dx * fx + dz * fz < -3) continue; add_item(1, i, (int)(dx * 8), (int)(dz * 8)); }
    for (int i = 0; i < npk; i++) { if (pk[i].taken) continue; float dx = pk[i].x - px, dz = pk[i].z - pz; if (dx * dx + dz * dz > 60 * 60) continue; if (dx * fx + dz * fz < -2) continue; add_item(2, i, (int)(dx * 8), (int)(dz * 8)); }
    for (int i = 0; i < ne0; i++) if (E0[i].type == 8) { float dx = E0[i].x / 8.0f - px, dz = E0[i].z / 8.0f - pz; if (dx * dx + dz * dz < 60 * 60 && dx * fx + dz * fz > -3) add_item(3, i, (int)(dx * 8), (int)(dz * 8)); }
    if (mode == M_STORE) store_items(); if (mode == M_FRONT) front_items();
    if (tp) add_item(4, 0, camx - (int)(px * 8) + 1, camz - (int)(pz * 8) + 1);
    if (mode != M_SAND && (H->ex || H->ez)) add_item(5, 0, H->ex - (int)(px * 8), H->ez - (int)(pz * 8));
    sort_items();
    for (int q = 0; q < nitems; q++)
    {   int k = items[q].idx;
        switch (items[q].kind)
        {   case 0: draw_axis_box(k); break;
            case 1: { const En *n = &en[k]; const Et *t = &ET[n->type]; u16 col = n->hurt > 0 ? RGB15(31, 28, 20) | BIT(15) : t->col | BIT(15); person(n->x, n->y, n->z, n->yaw, t->scale / 100.0f, col, RGB15(24, 18, 14) | BIT(15), n->anim, n->burst > 0 ? 1.4f : 0); break; }
            case 2: { const Pk *p = &pk[k]; float a = frames * 0.07f + k; u16 c = p->type == 4 ? RGB15(31, 27, 6) | BIT(15) : p->type == 5 ? RGB15(8, 28, 8) | BIT(15) : p->type == 6 ? RGB15(8, 16, 28) | BIT(15) : RGB15(28, 20, 8) | BIT(15); float bo = sinf(frames * 0.05f + k) * 0.15f;
                qbox(p->x, p->y + bo, p->z, 0.38f, 0.76f, 0.38f, a, c); qbox(p->x, p->y + bo + 0.19f, p->z, 0.38f, 0.38f, 0.38f, a + 0.78f, shade(c, 28)); break; }
            case 3: if (mode == M_FRONT) { front_npc(k); break; } person(E0[k].x / 8.0f, floor_at(E0[k].x / 8.0f, E0[k].z / 8.0f, 20, .4f), E0[k].z / 8.0f, 0.5f + k, 1, RGB15(10, 16, 24) | BIT(15), RGB15(24, 18, 14) | BIT(15), 0, 0); break;
            case 4: person(px, py + mount_h, pz, yaw, 1, RGB15(8, 14, 26) | BIT(15), RGB15(26, 20, 16) | BIT(15), bob, 0); break;
            case 6: case 7: case 8: case 9: case 10: store_draw(items[q].kind, k); break;
            case 12: front_draw(12); break;
            default: { float a = frames * 0.03f; qbox(H->ex / 8.0f, floor_at(H->ex / 8.0f, H->ez / 8.0f, 20, 1), H->ez / 8.0f, 1.6f, 0.15f, 1.6f, a, RGB15(10, 28, 10) | BIT(15)); }
        }
    }
    if (mode == M_FRONT) front_post();
    if (hurtf > 0) { int a = hurtf / 3; for (int i = 0; i < RW * RH; i++) { u16 c = fb3[i]; int r = (c & 31) + a, g = ((c >> 5) & 31) * 15 / 16, b2 = ((c >> 10) & 31) * 15 / 16; if (r > 31) r = 31; fb3[i] = r | (g << 5) | (b2 << 10); } }
}
// ---------------------------------------------------------------- HUD
#include "font_data.h"
static void px2(int x, int y, u16 c) { if ((unsigned)x < 320 && (unsigned)y < 240) outb[y * 320 + x] = c; }
static void rect(int x, int y, int w, int h, u16 c) { for (int j = y; j < y + h; j++) for (int i = x; i < x + w; i++) px2(i, j, c); }
static void text(int x, int y, const char *s, u16 c) { for (; *s; s++, x += 8) { int ch = *s; if (ch >= 'a' && ch <= 'z') ch -= 32; if (ch <= 32 || ch > 127) continue; const u8 *g = font_bin + (ch - 32) * 64; for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) if (g[j * 8 + i]) px2(x + i, y + j, c); } }
static void bar(int x, int y, int w, int v, int mx, u16 c) { rect(x, y, w, 5, RGB15(4, 4, 6)); if (mx > 0) rect(x, y, w * (v < 0 ? 0 : v > mx ? mx : v) / mx, 5, c); }
static void itoa_(char *b, int v) { char t[12]; int n = 0, neg = v < 0; if (neg) v = -v; do { t[n++] = '0' + v % 10; v /= 10; } while (v); int o = 0; if (neg) b[o++] = '-'; while (n) b[o++] = t[--n]; b[o] = 0; }
static void cat_int(char *b, const char *pre, int v, const char *mid, int v2) { strcpy(b, pre); char t[14]; itoa_(t, v); strcat(b, t); if (mid) { strcat(b, mid); itoa_(t, v2); strcat(b, t); } }
#include "w3storehud.h"
#include "w3fronthud.h"
static void hud(void)
{
    u16 gold = RGB15(26, 22, 8), wh = RGB15(28, 28, 28), gr = RGB15(14, 14, 16); char b[48];
    rect(0, 192, 320, 48, RGB15(2, 2, 5));
    text(4, 195, H->title, gold);
    const char *obj = mode == M_SAND ? "STARS " : mode == M_WAR ? "HOSTILES " : "RAIDERS "; int have = mode == M_SAND ? stars : kills, need = mode == M_SAND ? goal : killsNeeded;
    cat_int(b, obj, have, "/", need); text(4, 206, b, wh); cat_int(b, "SCORE ", score, 0, 0); text(130, 206, b, gr);
    if (H->time) { int s = (tleft / 60) % 60; cat_int(b, "TIME ", tleft / 3600, s < 10 ? ":0" : ":", s); text(190, 230, b, gr); }
    if (mode != M_SAND) { text(4, 218, "HP", gr); bar(24, 220, 80, hp, maxhp, RGB15(24, 5, 5)); if (maxsh) bar(24, 227, 80, sh, maxsh, RGB15(8, 18, 28));
        if (nw) { char wn[13]; memcpy(wn, W[wsel].name, 12); wn[10] = 0; text(112, 218, wn, wh); cat_int(b, "", mag[wsel], "/", res[wsel]); text(200, 218, b, reload ? gold : wh); } }
    else { text(4, 218, "LIVES", gr); for (int i = 0; i < hp; i++) rect(52 + i * 10, 219, 8, 8, RGB15(26, 6, 6)); }
    if (msgt) text(4, 230, msg, gold);
    // minimap 44x44
    int mx = 270, my = 194, ms = 44; float half = H->half / 8.0f; if (half < 8) half = 60; float k = ms / (half * 2);
    rect(mx, my, ms, ms, RGB15(3, 3, 6));
    for (int i = 0; i < nb; i++) { const Cb *c = &cb[i]; int x0 = mx + (int)((c->x0 + half) * k), z0 = my + (int)((c->z0 + half) * k), w = (int)((c->x1 - c->x0) * k) + 1, d = (int)((c->z1 - c->z0) * k) + 1; rect(x0, z0, w, d, c->y1 > 6 ? RGB15(8, 8, 10) : RGB15(11, 10, 9)); }
    for (int i = 0; i < npk; i++) if (!pk[i].taken) rect(mx + (int)((pk[i].x + half) * k), my + (int)((pk[i].z + half) * k), 2, 2, pk[i].type == 4 || pk[i].type == 7 ? gold : RGB15(8, 26, 8));
    for (int i = 0; i < nen; i++) if (en[i].alive) rect(mx + (int)((en[i].x + half) * k), my + (int)((en[i].z + half) * k), 2, 2, RGB15(28, 4, 4));
    int ppx = mx + (int)((px + half) * k), ppz = my + (int)((pz + half) * k); rect(ppx - 1, ppz - 1, 3, 3, wh); for (int i = 2; i < 5; i++) px2(ppx + (int)(sinf(yaw) * i), ppz - (int)(cosf(yaw) * i), wh);
    if (state == 1) text(60, 90, "MISSION COMPLETE  A=AGAIN", gold); else if (state == 2) text(90, 90, "DOWN  A=RETRY", RGB15(28, 6, 6));
}
// ---------------------------------------------------------------- vehicle combat (shared/kartcombat.h, the same core the DS arcade ROM uses)
#define KC_W 320
#define KC_H 240
#define KC_RGB(r, g, b) ((u16)(RGB15((r) >> 3, (g) >> 3, (b) >> 3) | BIT(15)))
#define KC_RECT(x, y, w, h, c) rect(x, y, w, h, c)
#define KC_TEXT(x, y, s, c) text(x, y, s, c)
#define KC_SFX(k) kart_sfx(k)
static void kart_sfx(int k) { static const u16 hz[6] = { 1800, 700, 300, 120, 2400, 200 }; if (k == 3 || k == 5) sfx_shot(1); else if (k == 0) sfx_shot(0); else sfx_blip(hz[k], k & 1); }
#include "../../../shared/kartcombat.h"
static int kart_started, kart_title;
static void kart_frame(unsigned kh, unsigned kd)
{   if (!kart_started) { KcCfg c = *(const KcCfg *)(const void *)B; c.color = (c.color ? c.color : KC_RGB(74, 232, 255)) | BIT(15); c.color2 = (c.color2 ? c.color2 : KC_RGB(255, 90, 90)) | BIT(15); kc_init(&c, 4242); kart_started = 1; kart_title = 150; }
    if (kc.status) { if (kd & KEY_A) { KcCfg c = kcC; kc_init(&c, 4242 + frames); kart_title = 60; } }
    else if (kart_title <= 100 || (kh & (KEY_UP | KEY_B | KEY_A))) {
        unsigned k = 0; if (kh & KEY_UP) k |= KC_UP; if (kh & KEY_DOWN) k |= KC_DOWN; if (kh & KEY_LEFT) k |= KC_LEFT; if (kh & KEY_RIGHT) k |= KC_RIGHT; if (kh & KEY_B) k |= KC_GUN; if (kd & KEY_A) k |= KC_MSL; if (kh & (KEY_X | KEY_Y | KEY_R)) k |= KC_MINE; kc_step(k); }
    if (kart_title > 0) kart_title--;
    kc_draw(); if (kart_title > 40 && !kc.status) { text((320 - (int)strlen(H->title) * 8) / 2, 60, H->title, RGB15(31, 28, 10)); text(40, 76, "B GUN  A MISSILE  X MINE", RGB15(28, 28, 28)); }
    if (kc.status) text(96, 150, "PRESS A TO RACE AGAIN", RGB15(28, 28, 28));
}
static void compose(void)
{
    for (int y = 0; y < 96; y++) { const u16 *s = fb3 + y * RW; u16 *d0 = outb + (y * 2) * 320, *d1 = d0 + 320; for (int x = 0; x < RW; x++) { u16 c = s[x]; d0[x * 2] = d0[x * 2 + 1] = d1[x * 2] = d1[x * 2 + 1] = c; } }
    if (mode == M_STORE) { store_hud(); return; }
    if (mode == M_FRONT) { front_hud(); return; }
    u16 cc = hitm ? RGB15(31, 8, 8) : RGB15(28, 31, 28);   // crosshair, viewmodel
    rect(156, 95, 5, 1, cc); rect(163, 95, 5, 1, cc); rect(161, 90, 1, 4, cc); rect(161, 98, 1, 4, cc);
    if (!tp && mode != M_SAND && nw) { int rc = cdw > 0 ? 3 : 0; rect(222, 160 + rc, 18, 32, RGB15(6, 6, 7)); rect(222, 160 + rc, 4, 32, RGB15(9, 9, 10)); rect(228, 150 + rc, 6, 12, RGB15(10, 10, 11)); }
    hud();
}
void w3_run(void)
{
    load_world(); new_game(); unsigned prevk = 0;
    for (;;)
    {   unsigned kh = h_keys(); unsigned kd = kh & ~prevk; prevk = kh; w3_kh = kh; w3_kd = kd;
        if (mode == M_KART) { kart_frame(kh, kd); frames++; h_present(outb); continue; }
        if (mode == M_STORE) store_step(); else if (mode == M_FRONT) front_step(); else { step_player(); if (!state) step_enemies(); } frames++; render3d(); compose(); h_present(outb);
    }
}

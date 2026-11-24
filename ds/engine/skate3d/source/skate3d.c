// NOTAREAL Game Studio - DS 3D skating engine (third person park, real 3D skater, solved feet, motion layer).
// Built from the Jabroni Hawk engine in ICW and generalised: the park, skater, goals and physics come from the game data block (SKCF section).
#include "icw.h"
#include "motion.h"
typedef struct { char id[4]; unsigned off, size; } NrgSection;
typedef struct { char magic[8]; unsigned capacity, used, count; NrgSection sec[]; } NrgHeader;
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include "font_ui_bin.h"
#include "font_big_bin.h"

extern const unsigned char nr_gamedata[];
static u16 *fb;
#define DEG 57.2958f
typedef struct { float x0, z0, x1, z1, h; int kind; } Rail;       // kind 0 rail, 1 ledge, 2 coping
typedef struct { float x, z, hw, hd, h; int kind; } Ramp;           // kind 0 spine / kicker, 1 funbox
typedef struct { float x0, z0, x1, z1, h; } Obst;                    // solid block to jump over (dumpster, stairs gap)
typedef struct { int type, val; const char *text; } Goal;           // 0 score, 1 letters, 2 obstacle, 3 combo size, 4 grind frames, 5 manual frames, 6 spins (half turns)
typedef struct { const char *name; u8 sky0[3], sky1[3], slab[3], walls[3], deck[3]; float qh; int nrail; Rail rail[8]; int nramp; Ramp ramp[4]; int nobs; Obst obs[2]; float let[7][3]; float sx, sz, yaw; Goal goal[3]; } Park;
static const Park PARKS[3] = {
    { "PLAZA", { 150, 196, 240 }, { 60, 110, 210 }, { 150, 150, 154 }, { 150, 150, 160 }, { 110, 90, 60 }, 2.2f,
      5, { { -12, -6, -2, -6, 0.7f, 0 }, { 4, 6, 14, 6, 0.7f, 0 }, { -15, 2, -15, 10, 0.9f, 0 }, { -7, 7.85f, -5, 7.85f, 0.5f, 1 }, { 5, 7.85f, 7, 7.85f, 0.5f, 1 } },
      1, { { 0, 0, 2.0f, 1.4f, 0.7f, 0 } }, 1, { { 7, -5.6f, 9, -4.4f, 1.2f } },
      { { -7, 1.6f, -6 }, { 0, 2.6f, 0 }, { 9, 1.6f, 6 }, { -15, 2.0f, 6 }, { 8, 2.4f, -5 }, { 0, 4.5f, 13 }, { 0, 4.5f, -13 } }, 3.5f, 3, 180,
      { { 0, 10000, "SCORE 10,000" }, { 2, 0, "KICKFLIP OVER THE DUMPSTER" }, { 1, 0, "COLLECT ALL 7 LETTERS" } } },
    { "BOWL", { 250, 170, 120 }, { 90, 70, 150 }, { 176, 166, 150 }, { 190, 150, 120 }, { 90, 80, 70 }, 3.2f,
      3, { { -10, -5, -2, -5, 0.8f, 0 }, { 3, 5, 11, 5, 0.8f, 0 }, { 14, -4, 14, 4, 1.0f, 0 } },
      3, { { 0, 0, 3.0f, 2.6f, 1.0f, 1 }, { -9, 5, 2.0f, 1.4f, 0.7f, 0 }, { 9, -5, 2.0f, 1.4f, 0.7f, 0 } }, 1, { { -8, -9.4f, -6, -8.2f, 1.0f } },
      { { -9, 1.6f, 5 }, { 0, 2.2f, 0 }, { 9, 1.6f, -5 }, { -14, 2.4f, 0 }, { 14, 2.4f, 0 }, { 0, 5.0f, 13 }, { 0, 5.0f, -13 } }, -3.5f, 8, 180,
      { { 0, 15000, "SCORE 15,000" }, { 3, 6, "COMBO OF 6 TRICKS" }, { 6, 4, "LAND A 720 SPIN" } } },
    { "STREET", { 170, 180, 200 }, { 80, 96, 140 }, { 128, 128, 132 }, { 120, 112, 108 }, { 70, 70, 76 }, 0.0f,
      6, { { -14, -8, -4, -8, 0.7f, 0 }, { 2, -8, 12, -8, 0.5f, 1 }, { -12, 6, -2, 6, 0.9f, 0 }, { 4, 6, 14, 6, 0.5f, 1 }, { 15, -4, 15, 6, 0.7f, 0 }, { -6, 0, 6, 0, 0.5f, 1 } },
      2, { { 0, 10, 3.0f, 2.0f, 0.9f, 1 }, { -8, -2, 2.0f, 1.4f, 0.7f, 0 } }, 2, { { -3, -12.4f, 3, -11.2f, 1.5f }, { 8, 1.8f, 10, 3.2f, 1.1f } },
      { { -12, 1.6f, -8 }, { -9, 1.6f, 6 }, { 0, 2.0f, 0 }, { 14, 1.6f, -6 }, { 0, 2.6f, 10 }, { -14, 1.8f, 12 }, { 10, 2.6f, -2 } }, 0, -4, 0,
      { { 0, 12000, "SCORE 12,000" }, { 4, 140, "GRIND 2+ SECONDS" }, { 5, 180, "MANUAL 3 SECONDS" } } } };
static const Park *PK = &PARKS[0];
static Rail rl[10]; static int nrl;
#define RAILS rl
#define NRAIL nrl
#define LET (PK->let)
static const u32 *dl_park;
// game config (SKCF section); defaults give the plaza with the stock skater
static struct { int park, seconds, goal; float cap, pop, grav; int sex, skin, hair, hairc, eyes, beard, top, pants, boots; float height, build; u16 deck; char title[32]; } CF = { 0, 120, 0, 0.17f, 0.171f, 0.011f, 0, 2, 0, 1, 1, 0, 1, 2, 4, 1.0f, 1.0f, 0, "SKATE SESSION" };
static void load_cfg(void)
{
    const NrgHeader *H = (const NrgHeader *)nr_gamedata; if (!H->used) return;
    for (unsigned i = 0; i < H->count; i++) if (!memcmp(H->sec[i].id, "SKCF", 4)) {
        const unsigned char *p = nr_gamedata + H->sec[i].off; unsigned n = H->sec[i].size; if (n < 80) return;
        #define U(k) (p[(k) * 2] | (p[(k) * 2 + 1] << 8))
        CF.park = U(0) % 3; CF.seconds = U(1) ? U(1) : 120; CF.goal = U(2); if (U(3)) CF.cap = U(3) / 100.0f; if (U(4)) CF.pop = U(4) / 100.0f; if (U(5)) CF.grav = U(5) / 1000.0f;
        CF.sex = U(6) & 1; CF.skin = U(7) & 7; CF.hair = U(8) & 7; CF.hairc = U(9) & 7; CF.eyes = U(10) & 3; CF.beard = U(11) & 3; CF.top = U(12) % 10; CF.pants = U(13) % 10; CF.boots = U(14) % 10;
        CF.height = U(15) ? U(15) / 100.0f : 1.0f; CF.build = U(16) ? U(16) / 100.0f : 1.0f; CF.deck = U(17);
        memcpy(CF.title, p + 40, 32); CF.title[31] = 0; if (!CF.title[0]) strcpy(CF.title, "SKATE SESSION");
        #undef U
    }
}


// world state
static float sx, sz, sy, vy, yaw, yawvis, spd, camyaw, spin, pitch_s, roll_s;
static int air, vert, crouch, grab, grind = -1, gtype, gdir, bail_t, special_on, manual, over_dump, msg_t;
static float gbal, gvel, gpos, mbal, mvel, grind_mult;
// board animation: target / current rotation about x (impossible), y (shove-it), z (flip)
static float bt[3], bc[3], board_lift, board_pitch_extra, push_t;
static float bx_w, by_w, bz_w, bvx, bvy, bvz, bspin;                  // the board on its own after a bail
static int score, combo_pts, combo_n, special, timer, letters, did_dumpster, trick_n, flip_comp[3], grab_t, air_t;
static char combo_str[64], msg[40];
static const Look *skater;
// smoothed pose scalars
static float s_ph = 0.85f, s_hipB = 20, s_hipF = 30, s_spread = 10;
static Motion sk_m;
static int best_combo, best_grind, best_manual, best_spin, gframes, mframes, goal_done[3];
static float surf(float x, float z, float *gx, float *gz)          // ground height under (x, z) and its slope
{
    float az = fabsf(z), sgn = z < 0 ? -1.0f : 1.0f, qh = PK->qh; *gx = 0; *gz = 0;
    if (qh > 0) {
        if (az >= 12 && az < 14) { float u = (az - 12) * 0.5f; if (u > 0.985f) u = 0.985f; float r = sqrtf(1 - u * u); *gz = sgn * (qh * 0.5f) * u / r; return qh * (1 - r); }
        if (az >= 14) return qh;
    }
    float best = 0;
    for (int i = 0; i < PK->nramp; i++) {
        const Ramp *r = &PK->ramp[i]; float dx = x - r->x, dz = z - r->z, adz = fabsf(dz);
        if (fabsf(dx) >= r->hw || adz >= r->hd) continue;
        float h, g;
        if (r->kind == 0) { h = r->h * (1 - adz / r->hd); g = r->h / r->hd; }
        else { float td = r->hd * 0.4f; if (adz < td) { h = r->h; g = 0; } else { h = r->h * (r->hd - adz) / (r->hd - td); g = r->h / (r->hd - td); } }
        if (h >= best) { best = h; *gz = (dz < 0 ? 1.0f : -1.0f) * g; }
    }
    return best;
}

// ---- sound effects (ARM7 mailbox voices: 12-13 square, 14 noise; the music engine owns the rest)
static int sfx_roll_on, sfx_grind_on, sfx_t;
static void sfx_blip(int hz, int vol) { static int rr; snd_psg_ch(12 + (rr ^= 1), 2, hz, vol, 64); }
static void sfx_noise(int hz, int vol) { snd_noise_ch(14, hz, vol, 64); }
static void sfx_stop_loop(void) { if (sfx_roll_on || sfx_grind_on) snd_stop(14); sfx_roll_on = sfx_grind_on = 0; }
static void sfx_loop(int rolling, int grinding, float speed)         // called every frame: wheels on the ground / sparks on a rail
{
    int want_roll = rolling && speed > 0.03f, want_grind = grinding;
    if (!want_roll && !want_grind) { sfx_stop_loop(); return; }
    if ((want_grind && !sfx_grind_on) || (want_roll && !sfx_roll_on)) { sfx_noise(want_grind ? 5200 : 1900, want_grind ? 70 : 34); sfx_grind_on = want_grind; sfx_roll_on = want_roll; }
    else if ((++sfx_t & 3) == 0) { int hz = want_grind ? 4600 + (int)(speed * 2500) : 1500 + (int)(speed * 5200); snd_pitch(14, hz); snd_vol(14, want_grind ? 72 : 20 + (int)(speed * 120)); }
}
static void add_trick(const char *name, int pts)
{
    sfx_blip(520 + combo_n * 70, 80);
    combo_pts += pts; combo_n++;
    if (strlen(combo_str) + strlen(name) + 4 < sizeof combo_str) { if (combo_str[0]) strcat(combo_str, " + "); strcat(combo_str, name); }
    else strcpy(combo_str, name);
}
static void say(const char *s) { strcpy(msg, s); msg_t = 120; }
static void bank(void)
{
    if (!combo_n) return;
    int total = combo_pts * combo_n; sfx_blip(880, 90); sfx_blip(1320, 90);
    score += total; special += total / 40; if (special > 100) special = 100;
    char b[48]; sprintf(b, "%d x %d = %d", combo_pts, combo_n, total); say(b);
    combo_pts = combo_n = 0; combo_str[0] = 0;
}
static void board_reset(void) { for (int i = 0; i < 3; i++) bt[i] = bc[i] = 0; flip_comp[0] = flip_comp[1] = flip_comp[2] = 0; board_lift = 0; board_pitch_extra = 0; }
static void bail(void)
{
    sfx_stop_loop(); sfx_noise(700, 127); sfx_blip(110, 100); bail_t = 75; combo_pts = combo_n = 0; combo_str[0] = 0; grind = -1; grab = 0; manual = 0; air = 0; vert = 0;
    bx_w = sx; by_w = sy + 0.1f; bz_w = sz; bvx = sinf(yaw / DEG) * spd * 1.3f; bvz = cosf(yaw / DEG) * spd * 1.3f; bvy = 0.12f; bspin = 14;
    vy = 0; special = special * 2 / 3; say("BAIL!"); sk_m.init = 0;
}
static void build_park(void)
{
    const Park *K = PK; float qh = K->qh;
    rec_begin();
    poly(31, 0);
    BIND(0);
    BEGIN(GL_QUADS);
    // sky backdrop: gradient walls far outside the plaza
    for (int k = 0; k < 4; k++) {
        float e = 60;
        float ax = k == 0 ? -e : k == 1 ? e : k == 2 ? e : -e, az = k == 0 ? -e : k == 1 ? -e : k == 2 ? e : e;
        float bx = k == 0 ? e : k == 1 ? e : k == 2 ? -e : -e, bz = k == 0 ? -e : k == 1 ? e : k == 2 ? e : -e;
        C(K->sky0[0], K->sky0[1], K->sky0[2]); V(ax, -1, az); V(bx, -1, bz); C(K->sky1[0], K->sky1[1], K->sky1[2]); V(bx, 30, bz); V(ax, 30, az);
    }
    for (int i = 0; i < 14; i++) {                                              // far skyline
        float x0 = -56 + i * 8.0f, h = 8 + ((i * 37) % 11) * 1.6f;
        int g = 70 + (i * 23) % 40;
        C(g, g + 8, g + 30); V(x0, 0, -58); V(x0 + 7, 0, -58); V(x0 + 7, h, -58); V(x0, h, -58);
        C(g - 10, g, g + 24); V(x0, 0, 58); V(x0 + 7, 0, 58); V(x0 + 7, h * 0.8f, 58); V(x0, h * 0.8f, 58);
    }
    C(96, 110, 80); V(-60, -0.02f, -60); V(60, -0.02f, -60); V(60, -0.02f, 60); V(-60, -0.02f, 60);   // grass beyond the walls
    // smooth concrete slab: 1.5 m tiles with per-corner tone variation
    for (int j = -5; j < 5; j++) for (int i = -6; i < 6; i++) {
        float x0 = i * 3.0f, z0 = j * 2.8f;
        int h0 = (i * 7 + j * 13) & 7, h1 = (i * 11 + j * 5) & 7;
        C(K->slab[0] + h0 * 2, K->slab[1] + h0 * 2, K->slab[2] + h0 * 2); V(x0, 0, z0);
        C(K->slab[0] - 4 + h1 * 2, K->slab[1] - 4 + h1 * 2, K->slab[2] - 4 + h1 * 2); V(x0 + 3.0f, 0, z0);
        C(K->slab[0] + h1, K->slab[1] + h1, K->slab[2] + h1); V(x0 + 3.0f, 0, z0 + 2.8f);
        C(K->slab[0] - 6 + h0, K->slab[1] - 6 + h0, K->slab[2] - 6 + h0); V(x0, 0, z0 + 2.8f);
    }
    if (qh > 0) {
    // curved quarter pipes with a deck behind them
    for (int s = -1; s <= 1; s += 2) {
        const int N = 6;
        for (int k = 0; k < N; k++) {
            float t0 = k / (float)N, t1 = (k + 1) / (float)N;
            float y0 = qh * (1 - cosf(t0 * 1.5708f)), y1 = qh * (1 - cosf(t1 * 1.5708f));
            float z0 = s * (12 + 2 * sinf(t0 * 1.5708f)), z1 = s * (12 + 2 * sinf(t1 * 1.5708f));
            int c0 = 120 + k * 14, c1 = 134 + k * 14;
            C(c0, c0 - 20, c0 - 52); V(-18, y0, z0); V(18, y0, z0); C(c1, c1 - 20, c1 - 52); V(18, y1, z1); V(-18, y1, z1);
        }
        C(110, 90, 60); V(-18, qh, s * 14); V(18, qh, s * 14); V(18, qh, s * 16); V(-18, qh, s * 16);          // deck
        C(80, 70, 50); V(-18, 0, s * 16); V(18, 0, s * 16); V(18, qh, s * 16); V(-18, qh, s * 16);
    }
    }
    for (int ri = 0; ri < K->nramp; ri++) {                                   // kickers / spines and funboxes
        const Ramp *r = &K->ramp[ri]; float x0 = r->x - r->hw, x1 = r->x + r->hw, h = r->h;
        if (r->kind == 0) {
            C(170, 140, 90); V(x0, 0, r->z - r->hd); V(x1, 0, r->z - r->hd); C(210, 180, 120); V(x1, h, r->z); V(x0, h, r->z);
            C(150, 120, 80); V(x0, 0, r->z + r->hd); V(x1, 0, r->z + r->hd); C(210, 180, 120); V(x1, h, r->z); V(x0, h, r->z);
            C(120, 96, 64); V(x0, 0, r->z - r->hd); V(x0, 0, r->z + r->hd); V(x0, h, r->z); V(x0, h, r->z);
            V(x1, 0, r->z - r->hd); V(x1, 0, r->z + r->hd); V(x1, h, r->z); V(x1, h, r->z);
        } else {
            float td = r->hd * 0.4f;
            C(176, 150, 96); V(x0, 0, r->z - r->hd); V(x1, 0, r->z - r->hd); C(214, 186, 126); V(x1, h, r->z - td); V(x0, h, r->z - td);
            C(214, 186, 126); V(x0, h, r->z - td); V(x1, h, r->z - td); V(x1, h, r->z + td); V(x0, h, r->z + td);
            C(154, 126, 84); V(x0, 0, r->z + r->hd); V(x1, 0, r->z + r->hd); C(214, 186, 126); V(x1, h, r->z + td); V(x0, h, r->z + td);
            C(120, 96, 64); V(x0, 0, r->z - r->hd); V(x0, 0, r->z + r->hd); V(x0, h, r->z + td); V(x0, h, r->z - td);
            V(x1, 0, r->z - r->hd); V(x1, 0, r->z + r->hd); V(x1, h, r->z + td); V(x1, h, r->z - td);
        }
    }
    END();
    if (qh > 0) {
    for (int s = -1; s <= 1; s += 2) {                                         // coping pipes and deck railings
        box(-18, (qh - 0.04f), s * 14 - 0.07f, 18, (qh + 0.1f), s * 14 + 0.07f, 200, 204, 214);
        for (int i = 0; i < 9; i++) box(-17.8f + i * 4.4f, qh, s * 15.8f - 0.05f, -17.7f + i * 4.4f, (qh + 1.0f), s * 15.8f + 0.05f, 60, 60, 70);
        box(-18, (qh + 0.95f), s * 15.8f - 0.05f, 18, (qh + 1.05f), s * 15.8f + 0.05f, 220, 180, 40);
    }
    }

    for (int i = 0; i < 6; i++) box(-16 + i * 3.0f, 0.005f, -11.5f, -15.85f + i * 3.0f, 0.02f, -7.5f, 240, 240, 240);   // parking lines
    for (int i = -3; i < 3; i++) box(i * 6.0f - 0.02f, 0.004f, -10, i * 6.0f + 0.02f, 0.012f, 10, 110, 110, 116);       // expansion joints
    for (int i = 0; i < K->nrail; i++) {                                       // rails: round-ish bars on posts
        const Rail *r = &K->rail[i];
        float t = 0.05f;
        if (r->z0 == r->z1) {
            box(r->x0, r->h - t, r->z0 - t, r->x1, r->h + t, r->z0 + t, 214, 218, 232);
            box(r->x0 - 0.02f, r->h + t - 0.02f, r->z0 - 0.02f, r->x1 + 0.02f, r->h + t, r->z0 + 0.02f, 255, 255, 255);
            for (float x = r->x0; x <= r->x1 + 0.01f; x += (r->x1 - r->x0) / 3) box(x - 0.04f, 0, r->z0 - 0.04f, x + 0.04f, r->h, r->z0 + 0.04f, 70, 74, 84);
        } else {
            box(r->x0 - t, r->h - t, r->z0, r->x0 + t, r->h + t, r->z1, 214, 218, 232);
            box(r->x0 - 0.02f, r->h + t - 0.02f, r->z0 - 0.02f, r->x0 + 0.02f, r->h + t, r->z1 + 0.02f, 255, 255, 255);
            for (float z = r->z0; z <= r->z1 + 0.01f; z += (r->z1 - r->z0) / 3) box(r->x0 - 0.04f, 0, z - 0.04f, r->x0 + 0.04f, r->h, z + 0.04f, 70, 74, 84);
        }
    }
    for (int oi = 0; oi < K->nobs; oi++) {                                     // obstacles: dumpster (park 0/1) or a stair block (street)
        const Obst *o = &K->obs[oi]; int stairs = K->qh <= 0;
        if (!stairs) {
            box(o->x0, 0.12f, o->z0, o->x1, o->h, o->z1, 36, 96, 58); box(o->x0 - 0.05f, o->h - 0.2f, o->z0 - 0.05f, o->x1 + 0.05f, o->h - 0.14f, o->z1 + 0.05f, 26, 70, 44);
            box(o->x0 + 0.05f, o->h, o->z0 + 0.05f, (o->x0 + o->x1) / 2 - 0.02f, o->h + 0.12f, o->z1 - 0.05f, 30, 40, 36); box((o->x0 + o->x1) / 2 + 0.02f, o->h, o->z0 + 0.05f, o->x1 - 0.05f, o->h + 0.12f, o->z1 - 0.05f, 30, 40, 36);
            box(o->x0 + 0.2f, 0.5f, o->z1 - 0.01f, o->x1 - 0.2f, 0.62f, o->z1 + 0.02f, 240, 200, 40);
        } else {
            int n = 4; for (int s = 0; s < n; s++) { float hh = o->h * (s + 1) / n; box(o->x0, 0, o->z0 + (o->z1 - o->z0) * s / n, o->x1, hh, o->z0 + (o->z1 - o->z0) * (s + 1) / n, 150 - s * 6, 150 - s * 6, 156 - s * 6); }
            box(o->x0 - 0.05f, o->h, o->z1 - 0.05f, o->x1 + 0.05f, o->h + 0.06f, o->z1 + 0.05f, 220, 180, 40);
        }
    }
    // plaza walls with painted murals
    box(-18.3f, 0, -14, -18, 3, 14, K->walls[0], K->walls[1], K->walls[2]); box(18, 0, -14, 18.3f, 3, 14, K->walls[0], K->walls[1], K->walls[2]);
    static const u8 MUR[6][3] = { { 230, 60, 120 }, { 40, 200, 220 }, { 250, 200, 40 }, { 120, 60, 200 }, { 60, 210, 90 }, { 240, 110, 40 } };
    for (int i = 0; i < 9; i++) {
        const u8 *m = MUR[i % 6], *n = MUR[(i + 2) % 6];
        float z0 = -13 + i * 3.0f;
        box(-17.99f, 0.3f, z0, -17.96f, 2.6f, z0 + 2.6f, m[0], m[1], m[2]);
        box(-17.96f, 0.8f + (i % 3) * 0.4f, z0 + 0.4f, -17.93f, 1.6f + (i % 3) * 0.4f, z0 + 2.1f, n[0], n[1], n[2]);
        box(17.96f, 0.3f, z0, 17.99f, 2.6f, z0 + 2.6f, n[0], n[1], n[2]);
        box(17.93f, 1.0f, z0 + 0.3f, 17.96f, 1.9f - (i % 2) * 0.4f, z0 + 2.3f, m[0], m[1], m[2]);
    }
    box(-18, 3.2f, -16.6f, 18, 7, -16.3f, 70, 110, 190); box(-18, 6.2f, -16.3f, 18, 7, -16.1f, 240, 240, 240);
    box(-6, 3.8f, -16.1f, 6, 5.8f, -16.0f, 230, 60, 120); box(-5.6f, 4.1f, -16.0f, 5.6f, 5.5f, -15.95f, 255, 240, 200);   // JH billboard
    box(-18, 3.2f, 16.3f, 18, 6, 16.6f, 190, 150, 110);
    // lamp posts with glowing heads, planters with trees
    for (int i = 0; i < 4; i++) {
        float x = -15 + i * 9.0f;
        box(x, 0, -10.2f, x + 0.16f, 4, -10.04f, 60, 62, 70);
        box(x - 0.5f, 4, -10.4f, x + 0.6f, 4.12f, -9.9f, 60, 62, 70);
        box(x - 0.4f, 3.92f, -10.32f, x + 0.5f, 4.0f, -9.98f, 255, 244, 190);
    }
    for (int i = 0; i < 3; i++) {
        float x = -12 + i * 12.0f, z = 9.5f;
        box(x - 0.8f, 0, z - 0.8f, x + 0.8f, 0.5f, z + 0.8f, 130, 130, 140);
        box(x - 0.7f, 0.5f, z - 0.7f, x + 0.7f, 0.54f, z + 0.7f, 90, 70, 40);
        box(x - 0.1f, 0.5f, z - 0.1f, x + 0.1f, 2.2f, z + 0.1f, 100, 70, 40);
        box(x - 0.9f, 2.0f, z - 0.9f, x + 0.9f, 3.0f, z + 0.9f, 50, 140, 60);
        box(x - 0.6f, 2.9f, z - 0.6f, x + 0.6f, 3.5f, z + 0.6f, 70, 170, 80);
    }
    for (int i = 0; i < 2; i++) {                                              // benches
        float x = -6 + i * 12.0f;
        box(x - 1, 0.42f, 7.6f, x + 1, 0.5f, 8.1f, 150, 100, 60);
        box(x - 0.9f, 0, 7.7f, x - 0.8f, 0.42f, 8.0f, 60, 60, 66); box(x + 0.8f, 0, 7.7f, x + 0.9f, 0.42f, 8.0f, 60, 60, 66);
    }
    dl_park = rec_end();
}
static const char *LWORD = "SKATERS";
static int goal_ok(int i)
{
    const Goal *g = &PK->goal[i]; int target = g->type == 0 && CF.goal ? CF.goal : g->val;
    switch (g->type) { case 0: return score >= target; case 1: return letters == 127; case 2: return did_dumpster; case 3: return best_combo >= g->val; case 4: return best_grind >= g->val; case 5: return best_manual >= g->val; default: return best_spin >= g->val; }
}
static void skate_hud(void)
{
    u16 *real = fb; fb = ui_back;
    for (int y = 0; y < 192; y++) fill_rect(fb, 0, y, 256, y + 1, RGB15(3, 2 + y / 48, 6 + y / 24));
    fill_rect(fb, 0, 0, 256, 22, RGB15(18, 6, 26)); fill_rect(fb, 0, 22, 256, 24, RGB15(8, 28, 12));
    draw_text_c(fb, font_big_bin, 128, 2, CF.title, RGB15(31, 31, 31));
    char b[64];
    sprintf(b, "SCORE %d", score); draw_text(fb, font_big_bin, 8, 28, b, RGB15(31, 27, 8));
    sprintf(b, "%d:%02d", timer / 3600, (timer / 60) % 60); draw_text(fb, font_big_bin, 206, 28, b, timer < 600 ? RGB15(31, 10, 10) : RGB15(31, 31, 31));
    if (combo_n) { sprintf(b, "%d x %d", combo_pts, combo_n); draw_text(fb, font_big_bin, 8, 50, b, RGB15(12, 31, 14)); draw_text(fb, font_ui_bin, 8, 70, combo_str, RGB15(31, 31, 31)); }
    else if (msg_t) draw_text(fb, font_big_bin, 8, 50, msg, RGB15(31, 31, 31));
    draw_text(fb, font_ui_bin, 8, 86, "SPECIAL", RGB15(22, 22, 28));
    fill_rect(fb, 62, 88, 164, 96, RGB15(4, 4, 6)); fill_rect(fb, 63, 89, 63 + special, 95, special >= 100 ? RGB15(31, 26, 4) : RGB15(8, 16, 28));
    if (special >= 100) draw_text(fb, font_ui_bin, 170, 86, "B+Y IN AIR!", RGB15(31, 26, 4));
    if (grind >= 0 || manual) {
        float bb = grind >= 0 ? gbal : mbal;
        draw_text(fb, font_ui_bin, 150, 100, grind >= 0 ? "BALANCE" : "MANUAL", RGB15(22, 22, 28));
        fill_rect(fb, 150, 112, 250, 120, RGB15(4, 4, 6)); fill_rect(fb, 199, 110, 201, 122, RGB15(20, 20, 20));
        int bx = 200 + (int)(bb * 48); fill_rect(fb, bx - 3, 109, bx + 3, 123, fabsf(bb) > 0.7f ? RGB15(31, 8, 8) : RGB15(10, 31, 12));
    }
    for (int i = 0; i < 7; i++) { char s[2] = { LWORD[i], 0 }; draw_text(fb, font_big_bin, 10 + i * 18, 102, s, (letters >> i) & 1 ? RGB15(31, 27, 6) : RGB15(8, 8, 12)); }
    for (int i = 0; i < 3; i++) { char gl[64]; int ok = goal_ok(i); if (PK->goal[i].type == 0) sprintf(gl, "%s SCORE %d", ok ? "DONE:" : "GOAL:", CF.goal ? CF.goal : PK->goal[i].val); else sprintf(gl, "%s %s", ok ? "DONE:" : "GOAL:", PK->goal[i].text); draw_text(fb, font_ui_bin, 8, 121 + i * 10, gl, ok ? RGB15(10, 31, 12) : RGB15(22, 22, 28)); }
    fill_rect(fb, 0, 156, 256, 192, RGB15(2, 2, 4)); fill_rect(fb, 0, 156, 256, 157, RGB15(8, 28, 12));
    draw_text(fb, font_ui_bin, 4, 159, "A OLLIE (HOLD, RELEASE)  B+DIR FLIP/SHOVE", RGB15(20, 21, 27));
    draw_text(fb, font_ui_bin, 4, 171, "Y+DIR GRAB  X+DIR GRIND (NEAR RAIL/COPING)", RGB15(20, 21, 27));
    draw_text(fb, font_ui_bin, 4, 183, "L+UP/DOWN MANUAL  <> SPIN  START QUIT", RGB15(20, 21, 27));
    fb = real; ui_flip(fb);
}

typedef struct { const char *name; int pts; int hand; float lift, pitch, byaw, sh, roll, torso, hipB, hipF; } Grab;
static const Grab GRABS[6] = {
    { "INDY", 80, 0, 0.26f, 6, 0, 100, 10, 38, 70, 80 },          // trailing hand, toe edge between the feet
    { "NOSEGRAB", 90, 1, 0.30f, 28, 0, 112, 6, 34, 60, 90 },
    { "TAILGRAB", 90, 0, 0.30f, -28, 0, 112, 6, 34, 90, 60 },
    { "MELON", 100, 1, 0.24f, 0, 12, 92, 30, 30, 85, 65 },
    { "STALEFISH", 110, 0, 0.26f, 8, -14, 104, 28, 42, 72, 88 },
    { "METHOD", 150, 1, 0.34f, 18, 0, 70, 70, -26, 100, 95 },     // back arched, board kicked out behind
};

static void draw_board(float lift)
{
    glPushMatrix();
    glTranslatef(0, lift * SC, 0);
    glRotateY(bc[1]); glRotateX(bc[0] + board_pitch_extra); glRotateZ(bc[2]);
    box(-0.12f, -0.02f, -0.36f, 0.12f, 0.02f, 0.36f, 200, 60, 160);                 // deck
    box(-0.12f, 0.02f, -0.36f, 0.12f, 0.025f, 0.36f, 24, 24, 28);                   // grip tape
    glPushMatrix(); glTranslatef(0, 0, 0.36f * SC); glRotateX(-18);                 // kicktails
    box(-0.11f, -0.02f, 0, 0.11f, 0.02f, 0.12f, 200, 60, 160); box(-0.11f, 0.02f, 0, 0.11f, 0.025f, 0.12f, 24, 24, 28); glPopMatrix(1);
    glPushMatrix(); glTranslatef(0, 0, -0.36f * SC); glRotateX(18);
    box(-0.11f, -0.02f, -0.12f, 0.11f, 0.02f, 0, 200, 60, 160); box(-0.11f, 0.02f, -0.12f, 0.11f, 0.025f, 0, 24, 24, 28); glPopMatrix(1);
    for (int t = -1; t <= 1; t += 2) {
        box(-0.03f, -0.06f, t * 0.26f - 0.03f, 0.03f, -0.02f, t * 0.26f + 0.03f, 170, 174, 184);   // truck
        box(-0.13f, -0.07f, t * 0.26f - 0.015f, 0.13f, -0.05f, t * 0.26f + 0.015f, 170, 174, 184);  // axle
        box(-0.16f, -0.1f, t * 0.26f - 0.035f, -0.11f, -0.03f, t * 0.26f + 0.035f, 245, 240, 220);  // wheels
        box(0.11f, -0.1f, t * 0.26f - 0.035f, 0.16f, -0.03f, t * 0.26f + 0.035f, 245, 240, 220);
    }
    glPopMatrix(1);
}

// Legs solved so both soles are on the deck: pelvis height ph above the sole, hip angles per leg, knee computed.
static void solve_legs(Pose *p, float h, float ph, float hipB, float hipF, float spread, float soleY)
{
    float cs = cosf(spread / DEG);
    for (int i = 0; i < 2; i++) {
        float hip = i ? hipF : hipB;
        float c = (ph / h / cs - 0.08f - 0.44f * cosf(hip / DEG)) / 0.50f;
        if (c > 1) c = 1; if (c < -1) c = -1;
        p->hip[i] = hip; p->kn[i] = hip + acosf(c) * DEG; p->hroll[i] = spread;
    }
    p->py = soleY + ph - MAT_Y - 1.02f * h;
}

static void skate_draw(void)
{
    glClearColor(12, 18, 30, 31);
    float d = yaw - camyaw; while (d > 180) d -= 360; while (d < -180) d += 360;
    if (!air) camyaw += d * 0.06f;
    float fx = sinf(camyaw / DEG), fz = cosf(camyaw / DEG);
    glMatrixMode(GL_MODELVIEW); glLoadIdentity();
    gluLookAt((sx - fx * 5.5f) * SC, (sy * 0.6f + 3.2f) * SC, (sz - fz * 5.5f) * SC, sx * SC, (sy * 0.7f + 1.0f) * SC, sz * SC, 0, 1, 0);
    glCallList(dl_park);
    glPolyFmt(POLY_ALPHA(31) | POLY_CULL_NONE | POLY_ID(4)); glBindTexture(0, 0);
    for (int i = 0; i < 7; i++) if (!((letters >> i) & 1)) {
        float b = sinf(frame * 0.1f + i) * 0.15f;
        glPushMatrix(); glTranslatef(LET[i][0] * SC, (LET[i][1] + b) * SC, LET[i][2] * SC); glRotateY(frame * 4 + i * 50);
        box(-0.25f, -0.25f, -0.06f, 0.25f, 0.25f, 0.06f, 255, 220, 40);
        glPopMatrix(1);
    }
    lights_on();
    float h = skater->height;
    // ---- what the body is doing -> target style
    float ph = 0.86f * h, hipB = 22, hipF = 32, spr = 9, torso = 12, head = -4, sh0 = 20, sh1 = 25, ro0 = 48, ro1 = 44, el0 = 20, el1 = 20, bank = 0, twist = 0;
    float lift = 0, bpitch = 0, byaw = 0, brollx = 0; int cls = MC_RUN;
    float carve = 0;
    if (!air && !bail_t && grind < 0 && !manual) {
        carve = ((keysHeld() & KEY_RIGHT) ? 1.0f : (keysHeld() & KEY_LEFT) ? -1.0f : 0) * (spd > 0.03f ? 1 : 0);
        bank = -carve * 7; twist = carve * 14; ro0 += carve * 8; ro1 -= carve * 8;
        push_t += spd * 0.9f; float pp = sinf(push_t * 6.0f);
        hipB += 6 * pp; ph += pp * 0.012f * h;
    }
    if (crouch) { ph = 0.60f * h; hipB = 62; hipF = 70; spr = 12; torso = 34; head = -10; sh0 = -25; sh1 = 35; ro0 = 22; ro1 = 30; el0 = 30; el1 = 30; cls = MC_GRAPPLE; }
    if (air && !grab) {                                  // pop and tuck: arms up, legs gather under the board
        float k = air_t < 6 ? air_t / 6.0f : 1;
        ph = (0.96f - 0.18f * k) * h; hipB = 30 + 36 * k; hipF = 40 + 40 * k; spr = 10; torso = 14 + 6 * k; head = -8; sh0 = 40 + 40 * k; sh1 = 50 + 30 * k; ro0 = 70; ro1 = 62; el0 = 24; el1 = 24; cls = MC_AERIAL;
        float fl = fabsf(bc[0] - bt[0]) + fabsf(bc[1] - bt[1]) + fabsf(bc[2] - bt[2]);
        if (fl > 6) { lift = -0.30f; ph = 0.80f * h; hipF = 78; hipB = 70; }   // board spins under the feet while the legs are pulled up
        brollx = 0;
    }
    if (grab > 0) {
        const Grab *g = &GRABS[grab - 1];
        ph = 0.52f * h; hipB = g->hipB; hipF = g->hipF; spr = 16; torso = g->torso; head = -14;
        sh0 = 30; sh1 = 30; ro0 = 40; ro1 = 40; el0 = 30; el1 = 30;
        if (g->hand) { sh1 = g->sh; ro1 = g->roll; el1 = 5; sh0 = 10; ro0 = 80; } else { sh0 = g->sh; ro0 = g->roll; el0 = 5; sh1 = 10; ro1 = 80; }
        lift = g->lift; bpitch = g->pitch; byaw = g->byaw; cls = MC_AERIAL;
    }
    if (grind >= 0) {
        float gs = gbal;
        ph = 0.66f * h; hipB = 34; hipF = 46; spr = 10; torso = 12 + gs * 5; sh0 = 12; sh1 = 22; ro0 = 62 + gs * 26; ro1 = 62 - gs * 26; el0 = 20; el1 = 20; bank = gs * 9; cls = MC_DODGE;
        if (gtype == 1) { bpitch = 20; hipB = 18; hipF = 55; ph = 0.68f * h; }           // nosegrind: tail up
        if (gtype == 2) { bpitch = -20; hipB = 55; hipF = 18; ph = 0.68f * h; }          // 5-0: nose up
        if (gtype == 3) { byaw = 90; ph = 0.62f * h; torso = 16; }                        // boardslide: board across the rail
        if (gtype == 4) { byaw = 90; bpitch = 22; ph = 0.64f * h; }                       // noseslide
        lift = 0.0f;
    }
    if (manual) {
        ph = 0.80f * h; torso = 10 - mbal * 6; sh0 = 25; sh1 = 25; ro0 = 60 + mbal * 20; ro1 = 60 - mbal * 20; bank = mbal * 6; cls = MC_DODGE;
        bpitch = manual > 0 ? -14.0f : 14.0f; hipB = manual > 0 ? 30 : 12; hipF = manual > 0 ? 12 : 30;
    }
    // smooth scalar style; tail/nose pitch lifts the board off the deck pivot so one truck stays on the surface
    float k = 0.32f; s_ph += (ph - s_ph) * k; s_hipB += (hipB - s_hipB) * k; s_hipF += (hipF - s_hipF) * k; s_spread += (spr - s_spread) * k;
    float tpiv = fabsf(sinf((bpitch + board_pitch_extra) / DEG)) * 0.26f;
    float base_board = 0.1f + tpiv + (grind >= 0 ? 0.04f : 0);
    float soleY = base_board + lift + 0.025f;
    Pose t; memset(&t, 0, sizeof t);
    t.torso = torso; t.head = head; t.sh[0] = sh0; t.sh[1] = sh1; t.roll[0] = ro0; t.roll[1] = ro1; t.el[0] = el0; t.el[1] = el1; t.bank = bank; t.twist = twist;
    t.px = 0;
    float bodyfall = 0;
    Pose p;
    if (bail_t) {                                       // tumbling off the board
        float bt_ = 75 - bail_t;
        t.body = bt_ < 28 ? -90.0f * (bt_ / 28.0f) : -90; t.py = -MAT_Y - 0.9f + 0.1f; t.sh[0] = t.sh[1] = 120; t.kn[0] = 30; t.kn[1] = 10; t.hip[0] = t.hip[1] = 10; t.torso = 0;
        if (bt_ < 28) t.py = -MAT_Y + (0.9f - 0.9f * bt_ / 28.0f) * 0.0f - 0.9f * bt_ / 28.0f * 0.55f + 0.1f;
        static int lastbail;
        if (!lastbail) { motion_hit(&sk_m, 1.0f); motion_fall(&sk_m, 0.5f, 2.0f); }
        lastbail = bail_t == 75 ? 0 : 1; if (bail_t == 1) lastbail = 0;
        motion_step(&sk_m, &t, MC_FALL, &p);
    } else {
        motion_step(&sk_m, &t, cls, &p);
        solve_legs(&p, h, s_ph, s_hipB, s_hipF, s_spread, soleY);
        p.body = 0;
    }
    (void)bodyfall;
    // ---- draw: world transform -> board frame
    float gx, gz; surf(sx, sz, &gx, &gz);
    if (!air && grind < 0 && !bail_t) {                  // lean the board and rider onto the slope they are standing on
        float sf = gx * sinf(yaw / DEG) + gz * cosf(yaw / DEG), sl = gx * cosf(yaw / DEG) - gz * sinf(yaw / DEG);
        pitch_s += (atanf(sf) * DEG - pitch_s) * 0.3f; roll_s += (atanf(sl) * DEG - roll_s) * 0.3f;
    } else if (air) { float tp = vy * 220; if (tp > 40) tp = 40; if (tp < -40) tp = -40; if (vert) tp *= 0.8f; pitch_s += (tp - pitch_s) * 0.15f; roll_s *= 0.9f; }
    else { pitch_s *= 0.8f; roll_s *= 0.8f; }
    glPolyFmt(POLY_ALPHA(31) | POLY_CULL_NONE | POLY_ID(5)); glBindTexture(0, 0);
    if (!bail_t) {
        glPushMatrix();
        glTranslatef(sx * SC, sy * SC, sz * SC);
        glRotateY(yawvis);
        glRotateX(-pitch_s); glRotateZ(roll_s);
        glPushMatrix(); glTranslatef(0, base_board * SC, 0);
        glRotateY(byaw);
        float savedp = board_pitch_extra; board_pitch_extra += bpitch;
        draw_board(lift);
        board_pitch_extra = savedp;
        glPopMatrix(1);
        draw_wrestler(skater, 0, 0, 80 + byaw, &p, 2);
        if (grind >= 0 && (frame & 1)) {                  // sparks off the trucks
            glPolyFmt(POLY_ALPHA(31) | POLY_CULL_NONE | POLY_ID(7)); glBindTexture(0, 0);
            for (int i = 0; i < 3; i++) { float rx = (rand() % 100 - 50) * 0.004f, rz = (rand() % 100 - 50) * 0.01f, ry = (rand() % 100) * 0.002f;
                box(rx, 0.0f + ry, rz, rx + 0.03f, 0.03f + ry, rz + 0.03f, 255, 210 - (rand() & 60), 60); }
        }
        glPopMatrix(1);
    } else {
        glPushMatrix();
        glTranslatef(sx * SC, sy * SC, sz * SC);
        glRotateY(yawvis);
        draw_wrestler(skater, 0, 0, 80, &p, 2);
        glPopMatrix(1);
        glPolyFmt(POLY_ALPHA(31) | POLY_CULL_NONE | POLY_ID(5)); glBindTexture(0, 0);
        glPushMatrix();
        glTranslatef(bx_w * SC, by_w * SC, bz_w * SC); glRotateY(yawvis + bspin * (75 - bail_t)); glRotateZ(bspin * 3 * (bail_t > 40 ? 1 : 0) * (75 - bail_t) * 0.2f);
        draw_board(0);
        glPopMatrix(1);
    }
    if (!bail_t && fabsf(gz) < 0.4f && fabsf(gx) < 0.4f) {                       // blob shadow on the ground
        float gy = surf(sx, sz, &gx, &gz) + 0.012f, base = 0;
        glPolyFmt(POLY_ALPHA(12) | POLY_CULL_NONE | POLY_ID(6)); glBindTexture(0, 0);
        glBegin(GL_QUADS); glColor3b(0, 0, 0);
        float gh = surf(sx, sz, &gx, &gz); base = sy - gh;
        float r = 0.5f - base * 0.06f; if (r < 0.2f) r = 0.2f;
        for (int i = 0; i < 8; i += 2) {
            float a0 = i * 0.785f, a1 = (i + 1) * 0.785f, a2 = (i + 2) * 0.785f;
            V(sx, gy, sz); V(sx + cosf(a0) * r, gy, sz + sinf(a0) * r); V(sx + cosf(a1) * r, gy, sz + sinf(a1) * r); V(sx + cosf(a2) * r, gy, sz + sinf(a2) * r);
        }
        glEnd();
    }
    glFlush(0);
}

static const char *GRIND_N[5] = { "50-50", "NOSEGRIND", "5-0 GRIND", "BOARDSLIDE", "NOSESLIDE" };
static const int GRIND_P[5] = { 100, 140, 140, 180, 200 };

static int try_grind(u32 kh, int dirx)                    // snap to the nearest rail / ledge / coping line
{
    for (int i = 0; i < NRAIL; i++) {
        const Rail *r = &RAILS[i];
        float rx = r->x1 - r->x0, rz = r->z1 - r->z0, len = sqrtf(rx * rx + rz * rz);
        float t = ((sx - r->x0) * rx + (sz - r->z0) * rz) / (len * len);
        if (t < 0 || t > 1) continue;
        float px = r->x0 + rx * t - sx, pz = r->z0 + rz * t - sz;
        if (px * px + pz * pz < 1.8f && sy > r->h - 0.9f && sy < r->h + 1.6f) {
            grind = i; gpos = t * len; gbal = 0; gvel = 0; grab = 0; air = 0; vert = 0; manual = 0;
            gdir = (sinf(yaw / DEG) * rx + cosf(yaw / DEG) * rz) >= 0 ? 1 : -1;
            yaw = atan2f(rx * gdir, rz * gdir) * DEG; yawvis = yaw;
            gtype = (kh & KEY_UP) ? 1 : (kh & KEY_DOWN) ? 2 : dirx ? 3 : 0;
            if ((kh & KEY_UP) && dirx) gtype = 4;
            if (r->kind == 2 && gtype > 2) gtype = 0;
            board_reset(); special_on = 0;
            add_trick(GRIND_N[gtype], GRIND_P[gtype]);
            return 1;
        }
    }
    return 0;
}

static void land(void)
{
    sfx_noise(900, 90); air = 0; vert = 0; vy = 0; grab = 0; air_t = 0;
    float err = fabsf(bc[0] - bt[0]) + fabsf(bc[1] - bt[1]) + fabsf(bc[2] - bt[2]);
    float sp = fmodf(fabsf(spin), 180.0f); if (sp > 90) sp = 180 - sp;
    if (err > 25 || sp > 55) { bail(); return; }
    int half = (int)(fabsf(spin) + 55) / 180;
    if (half) { char b[16]; sprintf(b, "%d SPIN", half * 180); add_trick(b, half * 150); }
    board_reset(); yawvis = yaw; bank();
}

static Look sk_look;
static void skate_game(void)
{
    PK = &PARKS[CF.park]; nrl = 0; for (int i = 0; i < PK->nrail && nrl < 10; i++) rl[nrl++] = PK->rail[i];
    if (PK->qh > 0) { rl[nrl++] = (Rail){ -18, -14, 18, -14, PK->qh + 0.05f, 2 }; rl[nrl++] = (Rail){ -18, 14, 18, 14, PK->qh + 0.05f, 2 }; }
    if (!dl_park) build_park();
    npc_look(&sk_look, CF.sex, CF.skin, CF.hair, CF.hairc, CF.eyes, CF.beard, CF.top, CF.pants, CF.boots, CF.height, CF.build);
    skater = &sk_look;
    sx = PK->sx; sz = PK->sz; sy = 0; vy = 0; yaw = PK->yaw; yawvis = yaw; camyaw = yaw; spd = 0; air = 0; vert = 0; grind = -1; grab = 0; bail_t = 0; manual = 0;
    score = combo_pts = combo_n = special = letters = did_dumpster = 0; combo_str[0] = 0; msg_t = 0; timer = CF.seconds * 60; best_combo = best_grind = best_manual = best_spin = gframes = mframes = 0; goal_done[0] = goal_done[1] = goal_done[2] = 0; special_on = 0;
    pitch_s = roll_s = spin = 0; board_reset(); sk_m.init = 0; crouch = 0;
    say("GO! SKATE!");
    while (timer > 0) {
        frame++; timer--;
        input_scan();
        u32 kd = keys_down(), kh = keysHeld(), ku = keysUp();
        if (kd & KEY_START) break;
        if (msg_t) msg_t--;
        sfx_loop(!air && grind < 0 && !bail_t && !manual, grind >= 0 && !bail_t, spd);
        int dirx = (kh & KEY_RIGHT) ? 1 : (kh & KEY_LEFT) ? -1 : 0;
        int diry = (kh & KEY_UP) ? 1 : (kh & KEY_DOWN) ? -1 : 0;
        for (int i = 0; i < 3; i++) { float d = bt[i] - bc[i]; float st = 22; bc[i] += d > st ? st : d < -st ? -st : d; }
        if (bail_t) {
            bx_w += bvx; bz_w += bvz; by_w += bvy; bvy -= 0.012f; if (by_w < 0.1f) { by_w = 0.1f; bvy = 0; bvx *= 0.9f; bvz *= 0.9f; bspin *= 0.9f; }
            if (--bail_t == 0) { say(""); sy = 0; spd = 0; air = 0; vy = 0; board_reset(); pitch_s = roll_s = 0; }
        }
        else if (grind >= 0) {
            const Rail *r = &RAILS[grind];
            float len = sqrtf((r->x1 - r->x0) * (r->x1 - r->x0) + (r->z1 - r->z0) * (r->z1 - r->z0));
            gpos += gdir * (spd < 0.1f ? 0.1f : spd);
            gvel += (rand() % 200 - 100) * 0.00002f + gbal * 0.0015f + dirx * 0.004f * (gdir < 0 ? -1 : 1);
            gbal += gvel;
            combo_pts += 4; grind_mult = 1;
            float t = gpos / len;
            sx = r->x0 + (r->x1 - r->x0) * t; sz = r->z0 + (r->z1 - r->z0) * t; sy = r->h;
            if (special_on) special_on--;
            if (fabsf(gbal) > 1) bail();
            else if (t < 0 || t > 1 || (kd & KEY_A)) {
                grind = -1; air = 1; air_t = 0; vy = (kd & KEY_A) ? 0.2f : 0.08f; spin = 0; vert = 0; yawvis = yaw;
                if (kd & KEY_A) { add_trick("GRIND OLLIE OUT", 40); }
            }
        } else {
            if (!air) {
                // ----- on the ground / ramp surface
                float gx, gz; float gy = surf(sx, sz, &gx, &gz);
                sy = gy;
                if (!manual) yaw -= dirx * 3.2f; yawvis += (yaw - yawvis) * 0.5f;
                int onramp = PK->qh > 0 && fabsf(sz) >= 12;
                if (kh & KEY_L) {                                                          // manual: L + up / down balances on two wheels
                    if (!manual && diry && spd > 0.04f && !onramp) { manual = diry; mbal = 0; mvel = 0; add_trick(diry > 0 ? "MANUAL" : "NOSE MANUAL", 60); }
                    if (manual) {
                        mvel += (rand() % 200 - 100) * 0.00002f + mbal * 0.0012f - diry * 0.003f * manual * 0.3f + dirx * 0.0015f;
                        mbal += mvel; combo_pts += 2;
                        if (fabsf(mbal) > 1) { bail(); }
                    }
                } else if (manual) { manual = 0; }
                if (!bail_t) {
                    if (kh & KEY_DOWN && !manual) spd -= 0.006f; else if (spd < CF.cap && !onramp) spd += 0.0085f;
                    if (spd < 0) spd = 0;
                    crouch = (kh & KEY_A) != 0 && !manual;
                    if (onramp) spd -= 0.0035f;
                    if (onramp && spd < 0.012f && !manual) { yaw = sz > 0 ? 180 : 0; yawvis = yaw; spd = 0.05f; }   // out of speed on the ramp: roll back down
                    if (ku & KEY_A && !manual) { sfx_noise(2600, 60); air = 1; air_t = 0; vy = CF.pop + spd * 0.09f; spin = 0; crouch = 0; yawvis = yaw; board_reset(); add_trick("OLLIE", 10); }
                    if (kd & KEY_B && !manual && spd > 0.04f) {                          // flat ground flip: pop and flip together
                        air = 1; air_t = 0; vy = 0.171f + spd * 0.09f; spin = 0; crouch = 0; yawvis = yaw; board_reset();
                        if (diry > 0) { bt[2] = -360; add_trick("HEELFLIP", 100); flip_comp[2]++; }
                        else if (diry < 0) { bt[0] = 360; add_trick("IMPOSSIBLE", 200); }
                        else if (dirx) { bt[1] = 360 * dirx; add_trick("POP SHOVE-IT", 120); }
                        else { bt[2] = 360; add_trick("KICKFLIP", 100); }
                    }
                    if ((kd & KEY_X) && try_grind(kh, dirx)) {}
                    for (int ri = 0; ri < PK->nramp; ri++) {                              // kicker lip: launch off the peak of a spine, or off the edge of a funbox
                        const Ramp *rp = &PK->ramp[ri]; float dx = sx - rp->x, dz = sz - rp->z;
                        if (fabsf(dx) < rp->hw && fabsf(dz) < rp->hd && spd > 0.08f) {
                            if (rp->kind == 0 ? (fabsf(dz) < 0.5f && gz * (sz < rp->z ? 1.0f : -1.0f) < 0) : (fabsf(gz) > 0.01f && gz * (dz < 0 ? 1.0f : -1.0f) > 0 && gz * (dz < 0 ? 1.0f : -1.0f) > 0 && 0)) { air = 1; air_t = 0; vy = 0.22f + spd * 0.5f; spin = 0; yawvis = yaw; board_reset(); }
                        }
                    }
                    { float fx2 = sinf(yaw / DEG), fz2 = cosf(yaw / DEG), g2x, g2z; float ng = surf(sx + fx2 * spd * 2, sz + fz2 * spd * 2, &g2x, &g2z); if (!onramp && spd > 0.07f && gy - ng > 0.14f && !air) { air = 1; air_t = 0; vy = 0.04f + spd * 0.2f; spin = 0; yawvis = yaw; board_reset(); } }
                }
            } else {
                // ----- in the air
                air_t++;
                if (!vert) yaw -= dirx * 7;
                spin += dirx * 7;
                vy -= CF.grav; sy += vy;
                yawvis = yaw;
                if (kd & KEY_B) {
                    float busy = fabsf(bt[0]) + fabsf(bt[1]) + fabsf(bt[2]);
                    if ((kh & KEY_Y) && special >= 100) { add_trick("JABRONI DRIVER", 1000); special = 0; special_on = 40; bt[2] += 720; bt[1] += 360; }
                    else if (busy < 1) {
                        if (diry > 0) { bt[2] = -360; add_trick("HEELFLIP", 100); }
                        else if (diry < 0) { bt[0] = 360; add_trick("IMPOSSIBLE", 200); }
                        else if (dirx && diry == 0) { bt[1] = 360 * dirx; bt[2] = 360 * dirx; add_trick("TREFLIP", 180); }
                        else { bt[2] = 360; add_trick("KICKFLIP", 100); }
                        if (over_dump && !did_dumpster) { did_dumpster = 1; add_trick("GAP BONUS", 500); }
                    }
                }
                if (kd & KEY_Y && !grab) {
                    int gi = diry > 0 ? 2 : diry < 0 ? 3 : dirx ? (dirx > 0 ? 4 : 5) : 1;
                    if (vert && gi == 1) gi = 6;
                    grab = gi; grab_t = 0; add_trick(GRABS[gi - 1].name, GRABS[gi - 1].pts);
                }
                if (grab) { grab_t++; if (kh & KEY_Y) combo_pts += 3; else grab = 0; }
                if (special_on) special_on--;
                if (kd & KEY_X) try_grind(kh, dirx);
                float gx, gz; float gy = surf(sx, sz, &gx, &gz);
                if (grind < 0 && sy <= gy && vy < 0) { sy = gy; land(); }
            }
            if (grind < 0 && !bail_t) {
                float fx = sinf(yaw / DEG), fz = cosf(yaw / DEG);
                if (air) { fx = sinf((yaw - spin) / DEG); fz = cosf((yaw - spin) / DEG); }
                float nx = sx + fx * spd, nz = sz + fz * spd;
                over_dump = 0; for (int oi = 0; oi < PK->nobs; oi++) { const Obst *o = &PK->obs[oi]; int inside = nx > o->x0 - 0.2f && nx < o->x1 + 0.2f && nz > o->z0 - 0.2f && nz < o->z1 + 0.2f;
                    if (inside && air && sy > o->h - 0.2f) over_dump = oi + 1;
                    else if (inside && sy < o->h - 0.1f) { if (spd > 0.1f) bail(); else spd = 0; nx = sx; nz = sz; } }
                if (nx < -17.5f || nx > 17.5f) { yaw = -yaw; spin = -spin; nx = sx; spd *= 0.6f; yawvis = yaw; }
                if (PK->qh <= 0 && fabsf(nz) >= 14.0f) { yaw = 180 - yaw; spin = -spin; nz = sz; spd *= 0.6f; yawvis = yaw; }
                if (PK->qh > 0 && fabsf(nz) >= 14.0f) {                                           // over the coping: ride the lip or drop in
                    if (air) { nz = sz; yaw = 180 - yaw; spin = -spin; }
                    else { air = 1; air_t = 0; vert = 1; vy = 0.1f + spd * 0.8f; spin = 0; sy = PK->qh; yaw = 180 - yaw; yawvis = yaw; nz = nz > 0 ? 13.9f : -13.9f; spd *= 0.8f; board_reset(); }
                }
                sx = nx; sz = nz;
                if (vert && !air) vert = 0;
                if (air && vert && sy > 0 && fabsf(sz) < 12) vert = 0;
            }
        }
        for (int i = 0; i < 7; i++) if (!((letters >> i) & 1)) {
            float dx = LET[i][0] - sx, dy = LET[i][1] - (sy + 0.9f), dz = LET[i][2] - sz;
            if (dx * dx + dy * dy + dz * dz < 1.6f) { letters |= 1 << i; score += 250; if (letters == 127) { score += 5000; say("ALL LETTERS!"); } }
        }
        if (grind >= 0) { gframes++; if (gframes > best_grind) best_grind = gframes; } else gframes = 0;
        if (manual) { mframes++; if (mframes > best_manual) best_manual = mframes; } else mframes = 0;
        for (int gi = 0; gi < 3; gi++) if (!goal_done[gi] && goal_ok(gi)) { goal_done[gi] = 1; score += 1000; say("GOAL DONE! +1000"); sfx_blip(660, 100); sfx_blip(990, 100); sfx_blip(1320, 100); }
        skate_draw();
        swiWaitForVBlank();
        if ((frame % 6) == 0) skate_hud();
    }
    bank();
    // results
    for (int y = 34; y < 156; y++) fill_rect(fb, 20, y, 236, y + 1, RGB15(2, 2, 5));
    fill_rect(fb, 20, 34, 236, 36, RGB15(8, 28, 12));
    char b[64]; int done = goal_done[0] + goal_done[1] + goal_done[2];
    draw_text_c(fb, font_big_bin, 128, 42, "RUN OVER", RGB15(31, 31, 31));
    sprintf(b, "FINAL SCORE  %d", score); draw_text_c(fb, font_big_bin, 128, 64, b, RGB15(31, 27, 8));
    sprintf(b, "GOALS DONE  %d / 3", done); draw_text_c(fb, font_ui_bin, 128, 90, b, done == 3 ? RGB15(10, 31, 12) : RGB15(24, 28, 31));
    for (int i = 0; i < 3; i++) { sprintf(b, "%s %s", goal_done[i] ? "[X]" : "[ ]", PK->goal[i].type == 0 ? "SCORE GOAL" : PK->goal[i].text); draw_text(fb, font_ui_bin, 34, 104 + i * 10, b, goal_done[i] ? RGB15(10, 31, 12) : RGB15(22, 22, 28)); }
    draw_text_c(fb, font_ui_bin, 128, 140, "PRESS A", RGB15(20, 21, 27));
    for (int i = 0; i < 30; i++) { skate_draw(); swiWaitForVBlank(); }
    sfx_stop_loop();
    while (1) { input_scan(); if (keys_down() & (KEY_A | KEY_START | KEY_TOUCH)) break; frame++; skate_draw(); swiWaitForVBlank(); }
}

void skate_boot(u16 *subfb) { fb = subfb; load_cfg(); for (;;) { skate_game(); glClearColor(3, 3, 5, 31); } }

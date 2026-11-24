// Joe's house, and the game on his floor: JABRONI HAWK GO SKATER PRO.
// Trick rules follow the skating ROM notes in DESIGN.md 7b: ollies, flips, grabs, spins, grinds with a balance
// meter, combos that are lost on a bail, a special meter, a 2-minute run with High / Pro / SICK score goals.
#include "icw.h"
#include "motion.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>

#include "font_ui_bin.h"
#include "font_big_bin.h"

static u16 *fb;

// ================================================================ the skate game
// ================================================================ the skate game
// Park: quarter pipes with coping, a kicker, rails, bench ledges, a dumpster gap. Tricks follow the skating notes in DESIGN.md 7b:
// ollie / flip tricks / grabs / spins in the air, rail + ledge + coping grinds with a balance meter, manuals, combos that bank on a clean
// landing and are lost on a bail, special meter, 2 minute run. The skater's legs are solved so both feet stay on the deck (no hovering).
typedef struct { float x0, z0, x1, z1, h; int kind; } Rail;       // kind 0 rail, 1 ledge, 2 coping
#define NRAIL 7
static const Rail RAILS[NRAIL] = { { -12, -6, -2, -6, 0.7f, 0 }, { 4, 6, 14, 6, 0.7f, 0 }, { -15, 2, -15, 10, 0.9f, 0 },
                                   { -7, 7.85f, -5, 7.85f, 0.5f, 1 }, { 5, 7.85f, 7, 7.85f, 0.5f, 1 },
                                   { -18, -14, 18, -14, 2.25f, 2 }, { -18, 14, 18, 14, 2.25f, 2 } };
static const float LET[7][3] = { { -7, 1.6f, -6 }, { 0, 2.6f, 0 }, { 9, 1.6f, 6 }, { -15, 2.0f, 6 }, { 8, 2.4f, -5 }, { 0, 4.5f, 13 }, { 0, 4.5f, -13 } };
static const u32 *dl_park;
#define DEG 57.2958f

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

static float surf(float x, float z, float *gx, float *gz)          // ground height under (x, z) and its slope
{
    float az = fabsf(z), sgn = z < 0 ? -1.0f : 1.0f; *gx = 0; *gz = 0;
    if (az >= 12 && az < 14) { float u = (az - 12) * 0.5f; if (u > 0.985f) u = 0.985f; float r = sqrtf(1 - u * u); *gz = sgn * 1.1f * u / r; return 2.2f * (1 - r); }
    if (az >= 14) return 2.2f;
    if (fabsf(x) < 2.0f && az < 1.4f) { *gz = (z < 0 ? 1.0f : -1.0f) * 0.5f; return 0.7f * (1 - az / 1.4f); }
    return 0;
}

static void add_trick(const char *name, int pts)
{
    combo_pts += pts; combo_n++;
    if (strlen(combo_str) + strlen(name) + 4 < sizeof combo_str) { if (combo_str[0]) strcat(combo_str, " + "); strcat(combo_str, name); }
    else strcpy(combo_str, name);
}
static void say(const char *s) { strcpy(msg, s); msg_t = 120; }
static void bank(void)
{
    if (!combo_n) return;
    int total = combo_pts * combo_n;
    score += total; special += total / 40; if (special > 100) special = 100;
    char b[48]; sprintf(b, "%d x %d = %d", combo_pts, combo_n, total); say(b);
    combo_pts = combo_n = 0; combo_str[0] = 0;
}
static void board_reset(void) { for (int i = 0; i < 3; i++) bt[i] = bc[i] = 0; flip_comp[0] = flip_comp[1] = flip_comp[2] = 0; board_lift = 0; board_pitch_extra = 0; }
static void bail(void)
{
    bail_t = 75; combo_pts = combo_n = 0; combo_str[0] = 0; grind = -1; grab = 0; manual = 0; air = 0; vert = 0;
    bx_w = sx; by_w = sy + 0.1f; bz_w = sz; bvx = sinf(yaw / DEG) * spd * 1.3f; bvz = cosf(yaw / DEG) * spd * 1.3f; bvy = 0.12f; bspin = 14;
    vy = 0; special = special * 2 / 3; say("BAIL!"); sk_m.init = 0;
}
static void build_park(void)
{
    rec_begin();
    poly(31, 0);
    BIND(0);
    BEGIN(GL_QUADS);
    // sky backdrop: gradient walls far outside the plaza
    for (int k = 0; k < 4; k++) {
        float e = 60;
        float ax = k == 0 ? -e : k == 1 ? e : k == 2 ? e : -e, az = k == 0 ? -e : k == 1 ? -e : k == 2 ? e : e;
        float bx = k == 0 ? e : k == 1 ? e : k == 2 ? -e : -e, bz = k == 0 ? -e : k == 1 ? e : k == 2 ? e : -e;
        C(150, 196, 240); V(ax, -1, az); V(bx, -1, bz); C(60, 110, 210); V(bx, 30, bz); V(ax, 30, az);
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
        C(150 + h0 * 2, 150 + h0 * 2, 154 + h0 * 2); V(x0, 0, z0);
        C(146 + h1 * 2, 146 + h1 * 2, 150 + h1 * 2); V(x0 + 3.0f, 0, z0);
        C(150 + h1, 150 + h1, 154 + h1); V(x0 + 3.0f, 0, z0 + 2.8f);
        C(144 + h0, 144 + h0, 148 + h0); V(x0, 0, z0 + 2.8f);
    }
    // curved quarter pipes with a deck behind them
    for (int s = -1; s <= 1; s += 2) {
        const int N = 6;
        for (int k = 0; k < N; k++) {
            float t0 = k / (float)N, t1 = (k + 1) / (float)N;
            float y0 = 2.2f * (1 - cosf(t0 * 1.5708f)), y1 = 2.2f * (1 - cosf(t1 * 1.5708f));
            float z0 = s * (12 + 2 * sinf(t0 * 1.5708f)), z1 = s * (12 + 2 * sinf(t1 * 1.5708f));
            int c0 = 120 + k * 14, c1 = 134 + k * 14;
            C(c0, c0 - 20, c0 - 52); V(-18, y0, z0); V(18, y0, z0); C(c1, c1 - 20, c1 - 52); V(18, y1, z1); V(-18, y1, z1);
        }
        C(110, 90, 60); V(-18, 2.2f, s * 14); V(18, 2.2f, s * 14); V(18, 2.2f, s * 16); V(-18, 2.2f, s * 16);          // deck
        C(80, 70, 50); V(-18, 0, s * 16); V(18, 0, s * 16); V(18, 2.2f, s * 16); V(-18, 2.2f, s * 16);
    }
    // kicker with a steel lip
    C(170, 140, 90); V(-2, 0, -1.4f); V(2, 0, -1.4f); C(210, 180, 120); V(2, 0.7f, 0); V(-2, 0.7f, 0);
    C(150, 120, 80); V(-2, 0, 1.4f); V(2, 0, 1.4f); C(210, 180, 120); V(2, 0.7f, 0); V(-2, 0.7f, 0);
    C(120, 96, 64); V(-2, 0, -1.4f); V(-2, 0, 1.4f); V(-2, 0.7f, 0); V(-2, 0.7f, 0);
    V(2, 0, -1.4f); V(2, 0, 1.4f); V(2, 0.7f, 0); V(2, 0.7f, 0);
    END();
    for (int s = -1; s <= 1; s += 2) {                                         // coping pipes and deck railings
        box(-18, 2.16f, s * 14 - 0.07f, 18, 2.3f, s * 14 + 0.07f, 200, 204, 214);
        for (int i = 0; i < 9; i++) box(-17.8f + i * 4.4f, 2.2f, s * 15.8f - 0.05f, -17.7f + i * 4.4f, 3.2f, s * 15.8f + 0.05f, 60, 60, 70);
        box(-18, 3.15f, s * 15.8f - 0.05f, 18, 3.25f, s * 15.8f + 0.05f, 220, 180, 40);
    }
    box(-2, 0.66f, -0.06f, 2, 0.72f, 0.06f, 200, 204, 214);
    for (int i = 0; i < 6; i++) box(-16 + i * 3.0f, 0.005f, -11.5f, -15.85f + i * 3.0f, 0.02f, -7.5f, 240, 240, 240);   // parking lines
    for (int i = -3; i < 3; i++) box(i * 6.0f - 0.02f, 0.004f, -10, i * 6.0f + 0.02f, 0.012f, 10, 110, 110, 116);       // expansion joints
    for (int i = 0; i < 3; i++) {                                              // rails: round-ish bars on posts
        const Rail *r = &RAILS[i];
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
    // the dumpster: green body, slanted lids, casters, a warning stripe
    box(7, 0.12f, -5.6f, 9, 1.2f, -4.4f, 36, 96, 58);
    box(6.95f, 1.0f, -5.65f, 9.05f, 1.06f, -4.35f, 26, 70, 44);
    box(7.05f, 1.2f, -5.55f, 7.98f, 1.32f, -4.45f, 30, 40, 36); box(8.02f, 1.2f, -5.55f, 8.95f, 1.32f, -4.45f, 30, 40, 36);
    box(7.2f, 0.5f, -4.41f, 8.8f, 0.62f, -4.38f, 240, 200, 40);
    for (int i = 0; i < 4; i++) box(7.1f + (i & 1) * 1.6f, 0, -5.5f + (i >> 1) * 0.9f, 7.3f + (i & 1) * 1.6f, 0.14f, -5.3f + (i >> 1) * 0.9f, 20, 20, 24);
    // plaza walls with painted murals
    box(-18.3f, 0, -14, -18, 3, 14, 150, 150, 160); box(18, 0, -14, 18.3f, 3, 14, 150, 150, 160);
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
static void skate_hud(void)
{
    u16 *real = fb; fb = ui_back;
    for (int y = 0; y < 192; y++) fill_rect(fb, 0, y, 256, y + 1, RGB15(3, 2 + y / 48, 6 + y / 24));
    fill_rect(fb, 0, 0, 256, 22, RGB15(18, 6, 26)); fill_rect(fb, 0, 22, 256, 24, RGB15(8, 28, 12));
    draw_text_c(fb, font_big_bin, 128, 2, "JABRONI HAWK GO SKATER PRO", RGB15(31, 31, 31));
    char b[64];
    sprintf(b, "SCORE %d", score); draw_text(fb, font_big_bin, 8, 28, b, RGB15(31, 27, 8));
    sprintf(b, "%d:%02d", timer / 3600, (timer / 60) % 60); draw_text(fb, font_big_bin, 206, 28, b, timer < 600 ? RGB15(31, 10, 10) : RGB15(31, 31, 31));
    if (combo_n) { sprintf(b, "%d x %d", combo_pts, combo_n); draw_text(fb, font_big_bin, 8, 50, b, RGB15(12, 31, 14)); draw_text(fb, font_ui_bin, 8, 70, combo_str, RGB15(31, 31, 31)); }
    else if (msg_t) draw_text(fb, font_big_bin, 8, 50, msg, RGB15(31, 31, 31));
    draw_text(fb, font_ui_bin, 8, 90, "SPECIAL", RGB15(22, 22, 28));
    fill_rect(fb, 62, 92, 164, 100, RGB15(4, 4, 6)); fill_rect(fb, 63, 93, 63 + special, 99, special >= 100 ? RGB15(31, 26, 4) : RGB15(8, 16, 28));
    if (special >= 100) draw_text(fb, font_ui_bin, 170, 90, "B+Y IN AIR!", RGB15(31, 26, 4));
    if (grind >= 0 || manual) {                                                // balance meter close-up
        float bb = grind >= 0 ? gbal : mbal;
        draw_text(fb, font_ui_bin, 8, 106, grind >= 0 ? "BALANCE" : "MANUAL", RGB15(22, 22, 28));
        fill_rect(fb, 62, 108, 164, 116, RGB15(4, 4, 6)); fill_rect(fb, 112, 106, 114, 118, RGB15(20, 20, 20));
        int bx = 113 + (int)(bb * 48); fill_rect(fb, bx - 3, 105, bx + 3, 119, fabsf(bb) > 0.7f ? RGB15(31, 8, 8) : RGB15(10, 31, 12));
    }
    static const char *L = "JABRONI";
    for (int i = 0; i < 7; i++) { char s[2] = { L[i], 0 }; draw_text(fb, font_big_bin, 10 + i * 18, 124, s, (letters >> i) & 1 ? RGB15(31, 27, 6) : RGB15(8, 8, 12)); }
    draw_text(fb, font_ui_bin, 146, 128, score >= 60000 ? "SICK SCORE!" : score >= 30000 ? "PRO SCORE" : score >= 10000 ? "HIGH SCORE" : "GOAL: 10,000", RGB15(24, 28, 31));
    draw_text(fb, font_ui_bin, 8, 142, did_dumpster ? "GOAL DONE: KICKFLIP THE DUMPSTER" : "GOAL: KICKFLIP OVER THE DUMPSTER", did_dumpster ? RGB15(10, 31, 12) : RGB15(22, 22, 28));
    fill_rect(fb, 0, 156, 256, 192, RGB15(2, 2, 4)); fill_rect(fb, 0, 156, 256, 157, RGB15(8, 28, 12));
    draw_text(fb, font_ui_bin, 4, 159, "A OLLIE (HOLD, RELEASE)  B+DIR FLIP/SHOVE", RGB15(20, 21, 27));
    draw_text(fb, font_ui_bin, 4, 171, "Y+DIR GRAB  X+DIR GRIND (NEAR RAIL/COPING)", RGB15(20, 21, 27));
    draw_text(fb, font_ui_bin, 4, 183, "L+UP/DOWN MANUAL  <> SPIN  START QUIT", RGB15(20, 21, 27));
    fb = real; ui_flip(fb);
}

// ---- grabs: name, points, which hand, board lift/pitch/yaw while held, arm reach
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
    air = 0; vert = 0; vy = 0; grab = 0; air_t = 0;
    float err = fabsf(bc[0] - bt[0]) + fabsf(bc[1] - bt[1]) + fabsf(bc[2] - bt[2]);
    float sp = fmodf(fabsf(spin), 180.0f); if (sp > 90) sp = 180 - sp;
    if (err > 25 || sp > 55) { bail(); return; }
    int half = (int)(fabsf(spin) + 55) / 180;
    if (half) { char b[16]; sprintf(b, "%d SPIN", half * 180); add_trick(b, half * 150); }
    board_reset(); yawvis = yaw; bank();
}

static void skate_run(const Look *who)
{
    if (!dl_park) build_park();
    skater = who;
    sx = 3.5f; sz = 3; sy = 0; vy = 0; yaw = 180; yawvis = 180; camyaw = 180; spd = 0; air = 0; vert = 0; grind = -1; grab = 0; bail_t = 0; manual = 0;
    score = combo_pts = combo_n = special = letters = did_dumpster = 0; combo_str[0] = 0; msg_t = 0; timer = 120 * 60; special_on = 0;
    pitch_s = roll_s = spin = 0; board_reset(); sk_m.init = 0; crouch = 0;
    say("2 MINUTE RUN. GO!");
    while (timer > 0) {
        frame++; timer--;
        input_scan();
        u32 kd = keys_down(), kh = keysHeld(), ku = keysUp();
        if (kd & KEY_START) break;
        if (msg_t) msg_t--;
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
                int onramp = fabsf(sz) >= 12;
                if (kh & KEY_L) {                                                          // manual: L + up / down balances on two wheels
                    if (!manual && diry && spd > 0.04f && !onramp) { manual = diry; mbal = 0; mvel = 0; add_trick(diry > 0 ? "MANUAL" : "NOSE MANUAL", 60); }
                    if (manual) {
                        mvel += (rand() % 200 - 100) * 0.00002f + mbal * 0.0012f - diry * 0.003f * manual * 0.3f + dirx * 0.0015f;
                        mbal += mvel; combo_pts += 2;
                        if (fabsf(mbal) > 1) { bail(); }
                    }
                } else if (manual) { manual = 0; }
                if (!bail_t) {
                    if (kh & KEY_DOWN && !manual) spd -= 0.006f; else if (spd < 0.17f && !onramp) spd += 0.0085f;
                    if (spd < 0) spd = 0;
                    crouch = (kh & KEY_A) != 0 && !manual;
                    if (onramp) spd -= 0.0035f;
                    if (onramp && spd < 0.012f && !manual) { yaw = sz > 0 ? 180 : 0; yawvis = yaw; spd = 0.05f; }   // ran out of speed on the ramp: gravity rolls you back down
                    if (ku & KEY_A && !manual) { air = 1; air_t = 0; vy = 0.171f + spd * 0.09f; spin = 0; crouch = 0; yawvis = yaw; board_reset(); add_trick("OLLIE", 10); }
                    if (kd & KEY_B && !manual && spd > 0.04f) {                          // flat ground flip: pop and flip together
                        air = 1; air_t = 0; vy = 0.171f + spd * 0.09f; spin = 0; crouch = 0; yawvis = yaw; board_reset();
                        if (diry > 0) { bt[2] = -360; add_trick("HEELFLIP", 100); flip_comp[2]++; }
                        else if (diry < 0) { bt[0] = 360; add_trick("IMPOSSIBLE", 200); }
                        else if (dirx) { bt[1] = 360 * dirx; add_trick("POP SHOVE-IT", 120); }
                        else { bt[2] = 360; add_trick("KICKFLIP", 100); }
                    }
                    if ((kd & KEY_X) && try_grind(kh, dirx)) {}
                    if (fabsf(sx) < 2.0f && fabsf(sz) < 1.4f && spd > 0.08f && gz * (sz < 0 ? -1.0f : 1.0f) < 0 && fabsf(sz) < 0.5f) {  // kicker lip: launch
                        air = 1; air_t = 0; vy = 0.22f + spd * 0.5f; spin = 0; yawvis = yaw; board_reset();
                    }
                }
            } else {
                // ----- in the air
                air_t++;
                if (!vert) yaw -= dirx * 7;
                spin += dirx * 7;
                vy -= 0.011f; sy += vy;
                yawvis = yaw;
                if (kd & KEY_B) {
                    float busy = fabsf(bt[0]) + fabsf(bt[1]) + fabsf(bt[2]);
                    if ((kh & KEY_Y) && special >= 100) { add_trick("JABRONI DRIVER", 1000); special = 0; special_on = 40; bt[2] += 720; bt[1] += 360; }
                    else if (busy < 1) {
                        if (diry > 0) { bt[2] = -360; add_trick("HEELFLIP", 100); }
                        else if (diry < 0) { bt[0] = 360; add_trick("IMPOSSIBLE", 200); }
                        else if (dirx) { bt[1] = 360 * dirx; bt[2] = 360 * dirx; add_trick("TREFLIP", 180); }
                        else { bt[2] = 360; add_trick("KICKFLIP", 100); }
                        if (over_dump && !did_dumpster) { did_dumpster = 1; add_trick("DUMPSTER GAP", 500); }
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
                over_dump = air && sy > 1.0f && nx > 6.8f && nx < 9.2f && nz > -5.8f && nz < -4.2f;
                if (!over_dump && nx > 6.8f && nx < 9.2f && nz > -5.8f && nz < -4.2f && sy < 1.2f) { if (spd > 0.1f) bail(); else spd = 0; nx = sx; nz = sz; }
                if (nx < -17.5f || nx > 17.5f) { yaw = -yaw; spin = -spin; nx = sx; spd *= 0.6f; yawvis = yaw; }
                if (fabsf(nz) >= 14.0f) {                                           // over the coping: ride the lip or drop in
                    if (air) { nz = sz; yaw = 180 - yaw; spin = -spin; }
                    else { air = 1; air_t = 0; vert = 1; vy = 0.1f + spd * 0.8f; spin = 0; sy = 2.2f; yaw = 180 - yaw; yawvis = yaw; nz = nz > 0 ? 13.9f : -13.9f; spd *= 0.8f; board_reset(); }
                }
                sx = nx; sz = nz;
                if (vert && !air) vert = 0;
                if (air && vert && sy > 0 && fabsf(sz) < 12) vert = 0;
            }
        }
        for (int i = 0; i < 7; i++) if (!((letters >> i) & 1)) {
            float dx = LET[i][0] - sx, dy = LET[i][1] - (sy + 0.9f), dz = LET[i][2] - sz;
            if (dx * dx + dy * dy + dz * dz < 1.6f) { letters |= 1 << i; score += 250; if (letters == 127) { score += 5000; say("J-A-B-R-O-N-I!"); } }
        }
        skate_draw();
        swiWaitForVBlank();
        if ((frame % 6) == 0) skate_hud();
    }
    bank();
    // results
    for (int y = 40; y < 150; y++) fill_rect(fb, 20, y, 236, y + 1, RGB15(2, 2, 5));
    fill_rect(fb, 20, 40, 236, 42, RGB15(8, 28, 12));
    char b[48];
    draw_text_c(fb, font_big_bin, 128, 48, "RUN OVER", RGB15(31, 31, 31));
    sprintf(b, "FINAL SCORE  %d", score); draw_text_c(fb, font_big_bin, 128, 70, b, RGB15(31, 27, 8));
    draw_text_c(fb, font_ui_bin, 128, 94, score >= 60000 ? "SICK SCORE! Joe is speechless." : score >= 30000 ? "PRO SCORE. Joe nods slowly." : score >= 10000 ? "HIGH SCORE. Joe says: not bad." : "Joe says: you call that a run?", RGB15(31, 31, 31));
    int cash = score / 2000; money += cash;
    sprintf(b, "Joe bets on your runs: +$%d", cash); draw_text_c(fb, font_ui_bin, 128, 110, b, RGB15(12, 31, 14));
    draw_text_c(fb, font_ui_bin, 128, 130, "PRESS A", RGB15(20, 21, 27));
    for (int i = 0; i < 30; i++) { skate_draw(); swiWaitForVBlank(); }
    while (1) { input_scan(); if (keys_down() & (KEY_A | KEY_START | KEY_TOUCH)) break; frame++; skate_draw(); swiWaitForVBlank(); }
}

// ================================================================ Joe's room
static const u32 *dl_room;
static void build_room(void)
{
    rec_begin();
    poly(31, 0);
    BIND(0);
    box(-4, -0.05f, -3, 4, 0, 3, 120, 96, 70);                                  // wood floor
    box(-4, 0, -3.2f, 4, 3, -3, 150, 150, 160); box(-4.2f, 0, -3, -4, 3, 3, 136, 136, 148); box(4, 0, -3, 4.2f, 3, 3, 136, 136, 148);
    box(-3.8f, 0, -2.9f, -1.6f, 0.5f, -0.9f, 60, 60, 90); box(-3.8f, 0.5f, -2.9f, -1.6f, 0.65f, -0.9f, 40, 40, 44);   // unmade bed
    box(-3.7f, 0.65f, -2.8f, -2.9f, 0.8f, -2.2f, 220, 220, 220);
    box(-1.0f, 1.2f, -2.99f, 0.6f, 2.5f, -2.96f, 60, 84, 50);                   // Hounds poster
    box(-0.8f, 1.9f, -2.95f, 0.4f, 2.3f, -2.94f, 220, 200, 90); box(-0.5f, 1.35f, -2.95f, 0.1f, 1.8f, -2.94f, 120, 220, 120);
    box(1.2f, 1.4f, -2.99f, 2.4f, 2.4f, -2.96f, 20, 20, 24); box(1.4f, 1.6f, -2.95f, 2.2f, 2.2f, -2.94f, 200, 60, 160);   // skate poster
    box(2.2f, 0, 0.2f, 3.6f, 0.5f, 1.4f, 50, 44, 40); box(2.3f, 0.5f, 0.3f, 3.5f, 1.4f, 0.5f, 24, 24, 28);             // TV on a crate
    box(2.4f, 0.6f, 0.5f, 3.4f, 1.3f, 0.52f, 90, 200, 240);
    box(1.5f, 0, 1.0f, 1.9f, 0.3f, 1.4f, 96, 80, 150); box(1.55f, 0.3f, 1.05f, 1.85f, 0.32f, 1.35f, 60, 50, 100);    // the console on the floor
    box(1.2f, 0, 1.6f, 1.4f, 0.06f, 1.8f, 80, 80, 90);                          // controller
    box(-0.5f, 0, 1.8f, 0.9f, 0.08f, 2.1f, 200, 60, 160);                       // skateboard
    for (int i = 0; i < 5; i++) box(-3.2f + i * 0.7f, 0, 1.2f + (i & 1) * 0.6f, -2.9f + i * 0.7f, 0.3f, 1.5f + (i & 1) * 0.6f, 200 - i * 20, 40 + i * 30, 40);   // cans and clutter
    dl_room = rec_end();
}

void house_run(u16 *subfb, int player)
{
    fb = subfb;
    if (!dl_room) build_room();
    const Look *me = cast_look(player), *joe = cast_look(C_JOE);
    float px = 0, pz = 2.4f, pyaw = 180, walk = 0, speed = 0;
    int talk = 0, redraw = 1, joe_home = player != C_JOE;
    static const char *L[4] = { "", "Door was open? ...I locked that. Somebody unlocked it.", "Whatever. You want a turn on Jabroni Hawk? Controller's on the floor.",
                                "Beat ten thousand and I'll believe you're not a plant." };
    glClearColor(3, 3, 5, 31);
    while (1) {
        frame++;
        input_scan();
        u32 kd = keys_down(), kh = keysHeld();
        float dx = 0, dz = 0;
        if (!talk) { if (kh & KEY_LEFT) dx -= 1; if (kh & KEY_RIGHT) dx += 1; if (kh & KEY_UP) dz -= 1; if (kh & KEY_DOWN) dz += 1; }
        speed = 0;
        if (dx || dz) {
            float l = sqrtf(dx * dx + dz * dz), nx = px + dx / l * 0.04f, nz = pz + dz / l * 0.04f;
            int ok = nx > -3.7f && nx < 3.7f && nz > -2.6f && nz < 2.9f && !(nx < -1.4f && nz < -0.7f) && !(nx > 2.0f && nz > 0 && nz < 1.6f);
            if (ok) { px = nx; pz = nz; }
            float ty = atan2f(dx, dz) * 57.3f, dd = ty - pyaw; while (dd > 180) dd -= 360; while (dd < -180) dd += 360;
            pyaw += dd * 0.3f; speed = 0.04f; walk += 0.2f;
        }
        if (pz > 2.85f && dz > 0) break;
        int near_con = (px - 1.5f) * (px - 1.5f) + (pz - 1.6f) * (pz - 1.6f) < 1.2f;
        int near_joe = joe_home && (px - 0.6f) * (px - 0.6f) + (pz - 0.6f) * (pz - 0.6f) < 1.6f && !near_con;
        if (kd & KEY_A) {
            if (talk) talk = (talk + 1) % 4;
            else if (near_con) { skate_run(joe_home ? me : joe); glClearColor(3, 3, 5, 31); }
            else if (near_joe) talk = 1;
            redraw = 1;
        }
        if (kd & KEY_START) break;
        if (redraw || (frame & 15) == 0) {
            redraw = 0;
            u16 *real = fb; fb = ui_back;
            for (int y = 0; y < 192; y++) fill_rect(fb, 0, y, 256, y + 1, RGB15(3 + y / 40, 3 + y / 60, 5 + y / 30));
            fill_rect(fb, 0, 0, 256, 24, RGB15(6, 6, 10)); fill_rect(fb, 0, 24, 256, 26, RGB15(8, 28, 12));
            draw_text_c(fb, font_big_bin, 128, 4, "JOE'S HOUSE", RGB15(31, 31, 31));
            char b[40]; sprintf(b, "CASH  $%d", money); draw_text(fb, font_ui_bin, 8, 32, b, RGB15(31, 27, 8));
            if (talk) {
                fill_rect(fb, 4, 100, 252, 166, RGB15(1, 1, 3)); fill_rect(fb, 4, 100, 252, 101, RGB15(8, 28, 12));
                const u16 *pp = cast_portrait(C_JOE);
                for (int y = 0; y < 46; y++) for (int x = 0; x < 46; x++) fb[(108 + y) * 256 + 10 + x] = pp[y * 46 + x] | BIT(15);
                draw_text(fb, font_big_bin, 62, 104, "JOE", RGB15(31, 26, 8));
                const char *s = L[talk]; char l1[48] = "", l2[48] = ""; int n = strlen(s), cut = n;
                if (n > 30) { cut = 30; while (cut > 0 && s[cut] != ' ') cut--; }
                memcpy(l1, s, cut); l1[cut] = 0; if (cut < n) strcpy(l2, s + cut + 1);
                draw_text(fb, font_ui_bin, 62, 126, l1, RGB15(31, 31, 31)); draw_text(fb, font_ui_bin, 62, 140, l2, RGB15(31, 31, 31));
            } else if (near_con) {
                fill_rect(fb, 4, 100, 252, 166, RGB15(1, 1, 3)); fill_rect(fb, 4, 100, 252, 101, RGB15(8, 28, 12));
                draw_text(fb, font_big_bin, 10, 104, "JABRONI HAWK GO SKATER PRO", RGB15(31, 26, 8));
                draw_text(fb, font_ui_bin, 10, 128, "The console on Joe's floor. A: sit down and play.", RGB15(31, 31, 31));
            } else if (near_joe) draw_text(fb, font_ui_bin, 8, 140, "A: TALK TO JOE", RGB15(31, 31, 31));
            fill_rect(fb, 0, 170, 256, 192, RGB15(2, 2, 4)); fill_rect(fb, 0, 170, 256, 171, RGB15(8, 28, 12));
            draw_text(fb, font_ui_bin, 6, 175, "A: PLAY / TALK    WALK DOWN TO LEAVE", RGB15(22, 22, 28));
            fb = real; ui_flip(fb);
        }
        if (dx || dz) redraw = (frame & 7) == 0;
        glMatrixMode(GL_MODELVIEW); glLoadIdentity();
        gluLookAt(px * 0.5f * SC, 3.6f * SC, (pz * 0.4f + 5.4f) * SC, px * 0.5f * SC, 1.0f * SC, (pz * 0.4f - 0.6f) * SC, 0, 1, 0);
        glCallList(dl_room);
        lights_on();
        Pose p; memset(&p, 0, sizeof p);
        float s = sinf(walk), amp = speed > 0 ? 1.0f : 0;
        p.hip[0] = 24 * s * amp; p.hip[1] = -24 * s * amp; p.kn[0] = (s < 0 ? -s * 34 : 4) * amp + 3; p.kn[1] = (s > 0 ? s * 34 : 4) * amp + 3;
        p.sh[0] = 8 - 22 * s * amp; p.sh[1] = 8 + 22 * s * amp; p.roll[0] = p.roll[1] = 10; p.el[0] = p.el[1] = 14; p.py = -MAT_Y;
        draw_wrestler(me, px, pz, pyaw, &p, 2);
        if (joe_home) {                                                         // Joe, cross-legged in front of the TV
            Pose j; memset(&j, 0, sizeof j);
            j.py = -MAT_Y - 0.86f; j.hip[0] = 85; j.hip[1] = 80; j.hroll[0] = j.hroll[1] = 35; j.kn[0] = j.kn[1] = 110; j.torso = 14;
            j.sh[0] = j.sh[1] = 35; j.el[0] = j.el[1] = 80; j.roll[0] = j.roll[1] = 4; j.head = sinf(frame * 0.05f) * 4 - 6;
            draw_wrestler(joe, 0.9f, 0.9f, talk ? atan2f(px - 0.9f, pz - 0.9f) * 57.3f : 80, &j, 3);
        }
        glFlush(0);
        swiWaitForVBlank();
    }
    glClearColor(12, 16, 26, 31);
}

#ifdef SKATE_TEST
void skate_test(u16 *subfb) { fb = subfb; skate_run(cast_look(C_JOE)); }
#endif

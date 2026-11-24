// ICW match engine (milestone 2 prototype): Steve vs Python, one fall.
// Move lengths follow the SvR 2009 timing bands in DESIGN.md (strikes ~40 frames, grapples ~130, getups ~70).
#include "icw.h"
#include "motion.h"
#include <stdlib.h>
#include <string.h>

#include "ban_clear_bin.h"
#include "ban_1_bin.h"
#include "ban_2_bin.h"
#include "ban_3_bin.h"
#include "ban_kick_bin.h"
#include "ban_fight_bin.h"
#include "theme_python_bin.h"
#include "ban_rake_bin.h"
#include "ban_finready_bin.h"
#include "ban_rope_bin.h"
#include "ban_distract_bin.h"
#include "hud_gen_bin.h"
#include "font_big_bin.h"
#include "font_ui_bin.h"

#ifndef MOVE_Z
#ifdef MOVE_TEST
#define MOVE_Z 0.0f
#else
#define MOVE_Z -7.0f
#endif
#endif
#ifndef SPIRIT0
#define SPIRIT0 20
#endif
#define R15(r, g, b) RGB15((r) >> 3, (g) >> 3, (b) >> 3)

// ---------------------------------------------------------------- looks (CAST_LOOKS.md)
// ---------------------------------------------------------------- poses
static Pose P_LYINGFD, P_KICK, P_LARIAT, P_CARRY, P_SLAM, P_STAND, P_STANCE, P_WIND, P_PUNCH, P_HIT, P_LOCK, P_LIFT, P_FALL, P_LYING, P_SIT, P_KNEEL,
    P_COVER, P_TAUNT, P_STIFF, P_REFKNEEL, P_CLIMB, P_JABW, P_JAB, P_HOOKW, P_HOOK, P_KNEEW, P_KNEE, P_ROUNDW, P_ROUND, P_STOMP, P_STOMPU, P_ELBU, P_ELBD, P_DROPK, P_BLOCK, P_BOOTW, P_BOOT, P_SPEARW, P_SPEAR, P_LEGD;

static Pose mk(void) { Pose p; memset(&p, 0, sizeof p); return p; }
#define PAIR(a, l, r) do { (a)[0] = (l); (a)[1] = (r); } while (0)

static void init_poses(void)
{
    P_STAND = mk(); PAIR(P_STAND.sh, 8, 8); PAIR(P_STAND.roll, 10, 10); PAIR(P_STAND.el, 12, 12); PAIR(P_STAND.hroll, 4, 4); PAIR(P_STAND.kn, 4, 4);
    P_STANCE = mk(); P_STANCE.torso = 10; P_STANCE.head = -8; P_STANCE.py = -0.05f;
    PAIR(P_STANCE.sh, 45, 40); PAIR(P_STANCE.roll, 18, 18); PAIR(P_STANCE.el, 95, 100);
    PAIR(P_STANCE.hip, 14, -6); PAIR(P_STANCE.hroll, 7, 7); PAIR(P_STANCE.kn, 18, 20);
    P_WIND = P_STANCE; P_WIND.torso = 2; P_WIND.sh[1] = 20; P_WIND.el[1] = 125; P_WIND.roll[1] = 30;
    P_PUNCH = P_STANCE; P_PUNCH.torso = 20; P_PUNCH.sh[1] = 90; P_PUNCH.el[1] = 4; P_PUNCH.roll[1] = 6;
    P_PUNCH.hip[0] = 24; P_PUNCH.kn[0] = 26; P_PUNCH.pz = 0.12f;
    P_HIT = P_STANCE; P_HIT.torso = -20; P_HIT.head = -28; PAIR(P_HIT.sh, 20, 25); PAIR(P_HIT.roll, 38, 38);
    PAIR(P_HIT.el, 30, 30); P_HIT.pz = -0.18f;
    P_LOCK = P_STANCE; P_LOCK.torso = 24; P_LOCK.head = 4; PAIR(P_LOCK.sh, 78, 78); PAIR(P_LOCK.roll, 8, 8);
    PAIR(P_LOCK.el, 62, 62); P_LOCK.py = -0.08f;
    P_LIFT = mk(); P_LIFT.torso = -14; P_LIFT.head = -22; PAIR(P_LIFT.sh, 165, 165); PAIR(P_LIFT.roll, 14, 14);
    PAIR(P_LIFT.el, 40, 40); PAIR(P_LIFT.hip, -4, -4); PAIR(P_LIFT.kn, 20, 20); P_LIFT.py = -0.06f;
    P_FALL = mk(); P_FALL.body = -90; P_FALL.py = -0.90f; PAIR(P_FALL.sh, 150, 150); PAIR(P_FALL.el, 25, 25);
    PAIR(P_FALL.hip, 12, 12); PAIR(P_FALL.kn, 14, 14); PAIR(P_FALL.roll, 10, 10);
    P_LYING = mk(); P_LYING.body = -90; P_LYING.py = -0.92f; P_LYING.head = 10;
    PAIR(P_LYING.sh, 20, 35); PAIR(P_LYING.roll, 55, 45); PAIR(P_LYING.el, 20, 10);
    PAIR(P_LYING.hip, 5, 10); PAIR(P_LYING.hroll, 14, 10); PAIR(P_LYING.kn, 10, 24);
    P_SIT = mk(); P_SIT.py = -0.90f; P_SIT.torso = 10; PAIR(P_SIT.sh, 10, 10); PAIR(P_SIT.roll, 30, 30);
    PAIR(P_SIT.el, 20, 20); PAIR(P_SIT.hip, 88, 80); PAIR(P_SIT.kn, 10, 30);
    P_KNEEL = mk(); P_KNEEL.py = -0.46f; P_KNEEL.torso = 18; P_KNEEL.head = -10; PAIR(P_KNEEL.sh, 30, 20);
    PAIR(P_KNEEL.roll, 20, 20); PAIR(P_KNEEL.el, 40, 40); PAIR(P_KNEEL.hip, 90, -15); PAIR(P_KNEEL.kn, 90, 105);
    P_COVER = mk(); P_COVER.body = 84; P_COVER.py = -0.70f; P_COVER.head = -30; PAIR(P_COVER.sh, 85, 85);
    PAIR(P_COVER.roll, 35, 35); PAIR(P_COVER.el, 25, 25); PAIR(P_COVER.hip, -8, -8); PAIR(P_COVER.kn, 25, 25);
    PAIR(P_COVER.hroll, 14, 14);
    P_TAUNT = P_STAND; P_TAUNT.head = -18; P_TAUNT.torso = -6; PAIR(P_TAUNT.sh, 170, 170); PAIR(P_TAUNT.roll, 24, 24);
    PAIR(P_TAUNT.el, 10, 10); PAIR(P_TAUNT.hroll, 10, 10);
    P_STIFF = mk(); PAIR(P_STIFF.sh, 60, 60); PAIR(P_STIFF.roll, 30, 30); PAIR(P_STIFF.el, 30, 30);
    PAIR(P_STIFF.hip, 10, 10); PAIR(P_STIFF.hroll, 8, 8);
    P_REFKNEEL = P_KNEEL; P_REFKNEEL.torso = 42; P_REFKNEEL.head = 10; P_REFKNEEL.sh[1] = 160; P_REFKNEEL.el[1] = 10;
    P_CLIMB = P_STAND; PAIR(P_CLIMB.sh, 70, 70); PAIR(P_CLIMB.el, 50, 50); PAIR(P_CLIMB.hip, 60, 0); PAIR(P_CLIMB.kn, 70, 10);
    P_CLIMB.torso = 15;
    P_KICK = P_STANCE; P_KICK.torso = -12; P_KICK.hip[1] = 100; P_KICK.kn[1] = 6; P_KICK.hip[0] = -6; P_KICK.kn[0] = 12;
    PAIR(P_KICK.sh, 35, 30); PAIR(P_KICK.roll, 45, 40); PAIR(P_KICK.el, 30, 30); P_KICK.pz = 0.1f;
    P_LARIAT = P_STANCE; P_LARIAT.torso = 16; P_LARIAT.sh[1] = 88; P_LARIAT.roll[1] = 70; P_LARIAT.el[1] = 0;
    P_LARIAT.hip[0] = 30; P_LARIAT.kn[0] = 30; P_LARIAT.hip[1] = -20; P_LARIAT.pz = 0.25f;
    P_CARRY = P_STANCE; P_CARRY.torso = -6; PAIR(P_CARRY.sh, 100, 100); PAIR(P_CARRY.el, 75, 75); PAIR(P_CARRY.roll, 10, 10);
    PAIR(P_CARRY.kn, 22, 22); P_CARRY.py = -0.08f;
    P_LYINGFD = P_LYING; P_LYINGFD.body = 90; P_LYINGFD.head = -15; PAIR(P_LYINGFD.sh, 150, 140); PAIR(P_LYINGFD.roll, 30, 30);
    P_SLAM = P_KNEEL; P_SLAM.torso = 55; P_SLAM.head = 20; PAIR(P_SLAM.sh, 95, 95); PAIR(P_SLAM.el, 20, 20);
    // strike chain: jab (right) -> hook (left) -> knee -> roundhouse; twist/hip-yaw/bank carry the weight through each blow
    P_JABW = P_STANCE; P_JABW.twist = 14; P_JABW.hipy = 8; P_JABW.sh[1] = 25; P_JABW.el[1] = 125; P_JABW.torso = 4;
    P_JAB = P_PUNCH; P_JAB.twist = -20; P_JAB.hipy = -12; P_JAB.bank = 3; P_JAB.pz = 0.20f; P_JAB.sh[0] = 30; P_JAB.el[0] = 120;
    P_HOOKW = P_STANCE; P_HOOKW.twist = -18; P_HOOKW.hipy = -10; P_HOOKW.sh[0] = 55; P_HOOKW.roll[0] = 100; P_HOOKW.el[0] = 100; P_HOOKW.torso = 6;
    P_HOOK = P_STANCE; P_HOOK.twist = 32; P_HOOK.hipy = 16; P_HOOK.bank = -5; P_HOOK.sh[0] = 96; P_HOOK.roll[0] = 78; P_HOOK.el[0] = 50;
    P_HOOK.torso = 20; P_HOOK.pz = 0.22f; P_HOOK.sh[1] = 40; P_HOOK.el[1] = 120; P_HOOK.hip[1] = -10;
    P_KNEEW = P_STANCE; P_KNEEW.torso = 14; PAIR(P_KNEEW.sh, 75, 75); PAIR(P_KNEEW.el, 85, 85); P_KNEEW.py = -0.1f; P_KNEEW.hip[1] = 8;
    P_KNEE = P_STANCE; P_KNEE.torso = -10; P_KNEE.hip[1] = 102; P_KNEE.kn[1] = 112; P_KNEE.hip[0] = -4; P_KNEE.kn[0] = 8; PAIR(P_KNEE.sh, 95, 95);
    PAIR(P_KNEE.el, 80, 80); P_KNEE.pz = 0.26f; P_KNEE.py = 0.06f; P_KNEE.head = -4;
    P_ROUNDW = P_STANCE; P_ROUNDW.twist = -48; P_ROUNDW.hipy = -30; P_ROUNDW.torso = 12; PAIR(P_ROUNDW.sh, 50, 50); PAIR(P_ROUNDW.roll, 50, 50);
    PAIR(P_ROUNDW.kn, 40, 40); P_ROUNDW.py = -0.1f;
    P_ROUND = P_STANCE; P_ROUND.twist = 62; P_ROUND.hipy = 40; P_ROUND.bank = -16; P_ROUND.torso = -16; P_ROUND.hip[1] = 96; P_ROUND.kn[1] = 14;
    P_ROUND.hip[0] = -4; P_ROUND.kn[0] = 24; PAIR(P_ROUND.sh, 40, 40); PAIR(P_ROUND.roll, 72, 64); P_ROUND.pz = 0.12f; P_ROUND.py = 0.04f;
    // ground game
    P_STOMPU = P_STANCE; P_STOMPU.hip[1] = 78; P_STOMPU.kn[1] = 84; P_STOMPU.torso = -4; PAIR(P_STOMPU.sh, 30, 30); P_STOMPU.py = 0.04f;
    P_STOMP = P_STANCE; P_STOMP.hip[1] = 30; P_STOMP.kn[1] = 34; P_STOMP.torso = 20; PAIR(P_STOMP.sh, 50, 50); P_STOMP.py = -0.14f; P_STOMP.pz = 0.18f;
    P_ELBU = P_STAND; PAIR(P_ELBU.sh, 168, 168); PAIR(P_ELBU.roll, 22, 22); PAIR(P_ELBU.hip, 10, 10); PAIR(P_ELBU.kn, 24, 24); P_ELBU.torso = -6; P_ELBU.py = 0.12f;
    P_ELBD = P_KNEEL; P_ELBD.torso = 62; P_ELBD.head = 24; P_ELBD.sh[1] = 60; P_ELBD.el[1] = 120; P_ELBD.roll[1] = 8; P_ELBD.sh[0] = 40; P_ELBD.py = -0.5f; P_ELBD.pz = 0.3f;
    P_DROPK = mk(); P_DROPK.body = -72; P_DROPK.py = 0.30f; P_DROPK.hip[1] = 88; P_DROPK.kn[1] = 8; P_DROPK.hip[0] = 20; P_DROPK.kn[0] = 40; PAIR(P_DROPK.sh, 60, 60); PAIR(P_DROPK.roll, 50, 50); PAIR(P_DROPK.el, 30, 30); P_DROPK.head = 10;
    P_BOOTW = P_STANCE; P_BOOTW.torso = -4; P_BOOTW.hip[1] = 45; P_BOOTW.kn[1] = 70; PAIR(P_BOOTW.sh, 40, 35);
    P_BOOT = P_KICK; P_BOOT.torso = -18; P_BOOT.hip[1] = 112; P_BOOT.kn[1] = 2; P_BOOT.hip[0] = -8; P_BOOT.pz = 0.12f;
    P_SPEARW = P_STANCE; P_SPEARW.torso = 30; P_SPEARW.py = -0.18f; PAIR(P_SPEARW.sh, 30, 30); PAIR(P_SPEARW.el, 110, 110); PAIR(P_SPEARW.hip, 40, 10); PAIR(P_SPEARW.kn, 50, 20);
    P_SPEAR = mk(); P_SPEAR.torso = 55; P_SPEAR.head = -30; P_SPEAR.py = -0.12f; P_SPEAR.pz = 0.3f; PAIR(P_SPEAR.sh, 80, 80); PAIR(P_SPEAR.el, 20, 20); PAIR(P_SPEAR.roll, 12, 12); PAIR(P_SPEAR.hip, 55, -25); PAIR(P_SPEAR.kn, 20, 40);
    P_LEGD = P_DROPK; P_LEGD.body = -84; P_LEGD.py = -0.42f; P_LEGD.hip[1] = 25; P_LEGD.kn[1] = 4; P_LEGD.hip[0] = 5; P_LEGD.kn[0] = 10;
    P_BLOCK = P_STANCE; P_BLOCK.torso = 14; P_BLOCK.head = 8; PAIR(P_BLOCK.sh, 125, 125); PAIR(P_BLOCK.el, 128, 128); PAIR(P_BLOCK.roll, 24, 24);
    PAIR(P_BLOCK.kn, 32, 34); PAIR(P_BLOCK.hip, 18, -12); P_BLOCK.py = -0.1f; P_BLOCK.pz = -0.06f;
}

// ---------------------------------------------------------------- wrestler state
enum { S_IDLE, S_STRIKE, S_HIT, S_LOCK_A, S_LOCK_D, S_SUPLEX_A, S_SUPLEX_D, S_DOWN, S_GETUP, S_COVER, S_PINNED,
       S_TAUNT, S_ENTER, S_WIN, S_KICK, S_LARIAT, S_KNOCK, S_FIN_A, S_FIN_D, S_CLIMB, S_CHAIN, S_GROUND, S_DROP, S_BLOCK, S_BOOT, S_SPEAR, S_TOPR };

typedef struct {
    const Look *look;
    float x, z, yaw;
    float walk, speed;
    int state, t, dur;
    int health, spirit;
    int cool;          // AI / move cooldown
    Pose pose;
    Motion mo; int mstate;   // motion layer (render-side follow-through)
    float base;        // vertical offset (negative = on the arena floor)
    int run, combo, fin_ready, rake, fin, facedown, wantpin;
    int cn, mv, fdmg, chit;   // strike-chain step, grapple direction, move damage override, chain hits landed
    float tx, tz, ox, oz;     // top-rope dive: start and target on the mat
} W;

static W w[2];          // 0 = Steve (player), 1 = Python (CPU)
static W ref;

static float wrap180(float a) { while (a > 180) a -= 360; while (a < -180) a += 360; return a; }
static float dist(const W *a, const W *b) { float dx = a->x - b->x, dz = a->z - b->z; return sqrtf(dx * dx + dz * dz); }
static float face_to(const W *a, const W *b) { return atan2f(b->x - a->x, b->z - a->z) * 57.2958f; }
static void turn_to(W *a, float yaw, float rate)
{
    float d = wrap180(yaw - a->yaw);
    if (d > rate) d = rate;
    if (d < -rate) d = -rate;
    a->yaw = wrap180(a->yaw + d);
}
static void set_state(W *a, int s, int dur) { a->state = s; a->t = 0; a->dur = dur; }
static int standing(const W *a) { return a->state == S_IDLE || a->state == S_STRIKE || a->state == S_TAUNT || a->state == S_HIT || a->state == S_KICK || a->state == S_LARIAT || a->state == S_CHAIN || a->state == S_BLOCK || a->state == S_BOOT || a->state == S_SPEAR; }
static int attacking(const W *a) { return a->state == S_STRIKE || a->state == S_CHAIN || a->state == S_KICK || a->state == S_LARIAT || a->state == S_DROP || a->state == S_BOOT || a->state == S_SPEAR; }
static int in_dir;   // direction held when a button is pressed: 0 none, 1 up, 2 down, 3 left, 4 right
static const int CH_DUR[4] = { 22, 24, 28, 40 }, CH_HIT[4] = { 10, 11, 16, 17 }, CH_DMG[4] = { 5, 7, 9, 11 };   // jab / forearm / elbow-knee / big roundhouse: damage from the kit's 30-move table
static const char *MV_NAME[5] = { "SUPLEX", "BODY SLAM", "BELLY SUPLEX", "SNAP DDT", "NECKBREAKER" };

// Blend through a list of keyposes at given frames.
static void keys(Pose *out, int t, int n, const int *fr, const Pose *const *ps)
{
    if (t <= fr[0]) { *out = *ps[0]; return; }
    for (int i = 0; i < n - 1; i++)
        if (t <= fr[i + 1]) { pose_lerp(out, ps[i], ps[i + 1], (t - fr[i]) / (float)(fr[i + 1] - fr[i])); return; }
    *out = *ps[n - 1];
}

static void walk_pose(W *a)
{
    Pose p = P_STANCE;
    float s = sinf(a->walk), amp = a->speed > 0.005f ? 1.0f : 0.0f;
    p.hip[0] += 26 * s * amp; p.hip[1] -= 26 * s * amp;
    p.kn[0] += (s < 0 ? -s * 34 : 4) * amp; p.kn[1] += (s > 0 ? s * 34 : 4) * amp;
    p.sh[0] -= 14 * s * amp; p.sh[1] += 14 * s * amp;
    p.py += -fabsf(s) * 0.03f * amp + sinf(frame * 0.08f) * 0.008f;     // bob + breathing
    if (a->run && amp > 0) {
        p.torso += 14; p.hip[0] += 16 * s; p.hip[1] -= 16 * s; p.sh[0] -= 20 * s; p.sh[1] += 20 * s;
        p.el[0] = p.el[1] = 80; p.py -= fabsf(s) * 0.03f;
    }
    p.torso += sinf(frame * 0.08f) * 1.5f;
    pose_lerp(&a->pose, &a->pose, &p, 0.35f);
}

// ---------------------------------------------------------------- referee and the count
int skip_player_entrance;
static int pin_count, pin_kick, mash, match_over, banner_shown = -1, ban_timer, player_id, opp_id, ref_distracted, ref_timer, won;
static u16 *sub;
int match_type;                       // MT_SINGLES, MT_NODQ, MT_FALLS, MT_CAGE, MT_LMS (set by the caller)
const char *const MATCH_TYPE_NAME[MT_COUNT] = { "SINGLES", "NO DISQUALIFICATION", "2 OUT OF 3 FALLS", "STEEL CAGE", "LAST MAN STANDING" };
static int falls[2], lms_count, lms_t, lms_down = -1, lms_mash, climb[2], win_idx, lms_downs[2];
static void end_match(int winner_idx, const char *how);

static void banner(int id)
{
    static const u8 *bans[17] = { ban_clear_bin, ban_1_bin, ban_2_bin, ban_3_bin, ban_kick_bin, ban_clear_bin, ban_clear_bin, ban_fight_bin,
                                  ban_clear_bin, ban_clear_bin, ban_clear_bin, ban_clear_bin, ban_rake_bin, ban_finready_bin,
                                  ban_rope_bin, ban_distract_bin, ban_clear_bin };
    if (id >= 9 || id == 4) ban_timer = 80;
    if (id == banner_shown) return;
    banner_shown = id;
    const u16 *src = (const u16 *)bans[id];
    for (int y = 0; y < 56; y++)
        dmaCopy(src + y * 192, sub + (64 + y) * 256 + 32, 192 * 2);
}

static void bars(void)
{
    for (int i = 0; i < 2; i++) {
        int x0 = (i == 0 ? 4 : 130) + 54;
        int hw = w[i].health * 62 / 100, sw = w[i].spirit * 62 / 100;
        for (int y = 35; y < 43; y++)
            for (int x = 0; x < 62; x++) {
                u16 full = w[i].health > 60 ? RGB15(8, 28, 10) : w[i].health > 30 ? RGB15(31, 22, 4) : RGB15(31, 8, 6);
                u16 c = x < hw ? full : RGB15(5, 1, 2);
                if (y == 35 && x < hw) c = RGB15(31, 31, 24);
                sub[y * 256 + x0 + x] = c | BIT(15);
            }
        for (int y = 52; y < 55; y++)
            for (int x = 0; x < 62; x++)
                sub[y * 256 + x0 + x] = (x < sw ? RGB15(31, 26, 6) : RGB15(4, 3, 1)) | BIT(15);
    }
}

// ---------------------------------------------------------------- moves
static void hurt(W *d, int dmg) { d->health -= dmg; if (d->health < 0) d->health = 0; }
static void gain(W *a, int n)
{
    a->spirit += n; if (a->spirit > 100) a->spirit = 100;
    if (a->spirit == 100 && !a->fin_ready) { a->fin_ready = 1; if (a == &w[0]) banner(13); }
}
static void banner_text(const char *s, u16 col)
{
    banner(0);
    banner_shown = 100;
    draw_text_c(sub, font_big_bin, 128, 84, s, col);
    ban_timer = 90;
}

// Move hints in the message box (bottom screen): shows what the player can do right now.
static int hint_shown = -1;
static void move_hint(void)
{
    if (banner_shown != 0 && banner_shown != 101) return;
    W *p = &w[0], *o = &w[1];
    int corner = match_type != MT_CAGE && fabsf(p->x) > 2.0f && fabsf(p->z) > 2.0f;
    int id; const char *l1, *l2;
    if (corner && o->state == S_DOWN) { id = 1; l1 = "X: TOP ROPE DIVE"; l2 = "RIVAL IS DOWN"; }
    else if (o->state == S_DOWN) { id = 2; l1 = "DOWN+A: LEG DROP"; l2 = "UP+A: ELBOW   Y: PIN"; }
    else if (p->spirit >= 50 && p->spirit < 100) { id = 3; l1 = "POWER MOVE READY"; l2 = "B+UP: CHOKESLAM"; }
    else {
        static const char *T1[5] = { "R+DIR+A: CLOTHESLINE", "R+UP+A: SPEAR", "DOWN+A: BIG BOOT", "B+DIR: SLAM/DDT/NECK", "CORNER+RIVAL DOWN: X" };
        static const char *T2[5] = { "R+DIR+B: DROPKICK", "TAP A: STRIKE CHAIN", "RUN AT HIM, A OR B", "SPIRIT 50+: B+UP", "= TOP ROPE DIVE" };
        int k = (frame / 300) % 5; id = 10 + k; l1 = T1[k]; l2 = T2[k];
    }
    if (id == hint_shown && banner_shown == 101) return;
    hint_shown = id;
    banner(0); banner_shown = 101;
    draw_text_c(sub, font_ui_bin, 128, 82, l1, RGB15(31, 28, 14));
    draw_text_c(sub, font_ui_bin, 128, 98, l2, RGB15(22, 24, 30));
}

// Steel cage: a wrestler climbing the wall can be dragged back down by an opponent standing under him.
static int pull_down(W *a, W *d)
{
    if (d->state != S_CLIMB || dist(a, d) > 1.5f) return 0;
    set_state(a, S_STRIKE, 40); a->cool = 20;
    d->base = 0; d->pose = P_LYING; hurt(d, 8); sfx(SFX_SLAM);
    set_state(d, S_DOWN, 110);
    banner_text("PULLED OFF THE CAGE!", RGB15(31, 26, 10));
    return 1;
}

static void try_strike(W *a, W *d)
{
    if (a->state == S_STRIKE && a->t >= 14 && a->t <= 36) { a->combo = 1; return; }   // A again: follow with a kick
    if (a->state == S_CHAIN && a->cn < 3 && a->t >= CH_HIT[a->cn] - 2 && a->t <= CH_DUR[a->cn] - 2) { a->combo = 1; return; }   // chain the next blow
    if (a->state != S_IDLE || a->cool) return;
    if (pull_down(a, d)) return;
    if (d->state == S_DOWN && dist(a, d) < 1.7f) {                 // ground attacks: A stomps, UP + A drops an elbow
        a->yaw = face_to(a, d); a->mv = in_dir == 1 ? 1 : in_dir == 2 ? 2 : 0;     // A stomps, UP+A elbow drop, DOWN+A leg drop
        set_state(a, S_GROUND, a->mv == 1 ? 56 : a->mv == 2 ? 50 : 40); a->cool = 6; return;
    }
    if (a->run) { a->chit = 0; if (in_dir == 1) set_state(a, S_SPEAR, 46); else set_state(a, S_LARIAT, 40); a->run = 0; a->cool = 20; return; }   // running: A clothesline, UP+A spear
    a->rake = (a == &w[1]) && cast_heel(opp_id) && ref_distracted;   // heels only cheat when the ref looks away
    if (match_type == MT_NODQ && (rand() & 3) == 0) a->rake = 1;     // anything goes
    a->combo = 0;
    if (in_dir == 2 && !a->rake) { set_state(a, S_BOOT, 32); a->cool = 10; return; }                  // DOWN+A: big boot
    if (a->rake) { set_state(a, S_STRIKE, 40); a->cool = 10; return; }
    a->cn = 0; a->chit = 0; set_state(a, S_CHAIN, CH_DUR[0]); a->cool = 0;
}

static int land_hit(W *a, W *d, int dmg, int knock)
{
    float rel = fabsf(wrap180(face_to(a, d) - a->yaw));
    if (dist(a, d) > 1.25f || !standing(d) || rel > 55) return 0;
    if (d->state == S_BLOCK) {
        if (d->t < 9) {                                       // blocked on the frame: reversal
            set_state(a, S_KNOCK, 24); hurt(a, 6); gain(d, 12); sfx(SFX_HIT);
            set_state(d, S_IDLE, 0); d->cool = 4; banner_text("REVERSAL!", RGB15(31, 26, 10));
            motion_hit(&a->mo, 1.0f);
        } else { hurt(d, dmg / 4); sfx(SFX_HIT); a->x -= sinf(a->yaw / 57.2958f) * 0.04f; a->z -= cosf(a->yaw / 57.2958f) * 0.04f; motion_hit(&d->mo, 0.25f); }
        return 0;
    }
    if (match_type == MT_NODQ || match_type == MT_CAGE || match_type == MT_LMS) dmg += dmg / 3;
    hurt(d, dmg);
    sfx(SFX_HIT);
    gain(a, (dmg * 3 + 2) / 4);                 // momentum follows the kit's table (about 3/4 of the damage)
    if (knock) set_state(d, S_KNOCK, 24);
    else set_state(d, S_HIT, a->rake ? 40 : 24);
    float fx = sinf(a->yaw / 57.2958f), fz = cosf(a->yaw / 57.2958f);
    d->x += fx * (knock ? 0.3f : 0.15f); d->z += fz * (knock ? 0.3f : 0.15f);
    motion_hit(&a->mo, 0.25f + dmg * 0.03f);
    return 1;
}

static void try_grapple(W *a, W *d)
{
    if (a->state != S_IDLE || a->cool) return;
    if (pull_down(a, d)) return;
    if (a->run) { set_state(a, S_DROP, 40); a->run = 0; a->cool = 24; return; }   // running + grapple: dropkick
    if (dist(a, d) < 1.35f && standing(d) && d->state != S_HIT) {
        a->mv = in_dir; d->mv = rand() % 5;
        set_state(a, S_LOCK_A, 24);
        set_state(d, S_LOCK_D, 24);
        a->yaw = face_to(a, d); d->yaw = wrap180(a->yaw + 180);
        float fx = sinf(a->yaw / 57.2958f), fz = cosf(a->yaw / 57.2958f);
        d->x = a->x + fx * 0.62f; d->z = a->z + fz * 0.62f;
    } else {
        set_state(a, S_STRIKE, 40);    // whiffed grapple: throws a forearm instead
    }
    a->cool = 12;
}

static void try_pin(W *a, W *d)
{
    if (a->state != S_IDLE || d->state != S_DOWN || dist(a, d) > 1.6f) return;
    if (match_type == MT_LMS) return;                 // no pinfalls: the ref counts to ten instead
    set_state(a, S_COVER, 9999);
    set_state(d, S_PINNED, 9999);
    d->facedown = 0;
    a->yaw = wrap180(d->yaw + 90);
    float hx = sinf(d->yaw / 57.2958f), hz = cosf(d->yaw / 57.2958f);   // d's head points toward its -facing
    float cx = d->x - hx * 0.30f, cz = d->z - hz * 0.30f;
    float ax = sinf(a->yaw / 57.2958f), az = cosf(a->yaw / 57.2958f);
    a->x = cx - ax * 0.40f; a->z = cz - az * 0.40f;
    pin_count = 0; pin_kick = 0; mash = 0;
    set_state(&ref, S_COVER, 9999);
}

static void try_block(W *a, W *d)
{
    if (a->state != S_IDLE || a->cool) return;
    a->yaw = face_to(a, d);
    set_state(a, S_BLOCK, 22); a->cool = 8;
}

static void try_taunt(W *a)
{
    if (a->state != S_IDLE || a->cool) return;
    if (match_type == MT_CAGE && (fabsf(a->x) > 2.1f || fabsf(a->z) > 2.1f)) {   // at the wall: start climbing out
        W *o = (a == &w[0]) ? &w[1] : &w[0];
        if (!standing(o) || o->state == S_HIT) {
            if (fabsf(a->x) > fabsf(a->z)) a->yaw = a->x > 0 ? 90 : -90; else a->yaw = a->z > 0 ? 0 : 180;
            set_state(a, S_CLIMB, 210);
            banner_text("CLIMBING THE CAGE!", RGB15(31, 31, 31));
            return;
        }
    }
    if (match_type != MT_CAGE && fabsf(a->x) > 2.0f && fabsf(a->z) > 2.0f) {       // in a corner: climb to the top rope and fly at a downed rival
        W *o = (a == &w[0]) ? &w[1] : &w[0];
        if (o->state == S_DOWN && dist(a, o) > 1.8f && dist(a, o) < 5.4f) {
            a->yaw = face_to(a, o);
            set_state(a, S_TOPR, 170);
            banner_text("TOP ROPE!", RGB15(31, 31, 31));
            return;
        }
    }
    set_state(a, S_TAUNT, 70);
    gain(a, 12);
}

// ---------------------------------------------------------------- per-frame update
static void update_w(W *a, W *d, int idx)
{
    a->t++;
    if (a->cool) a->cool--;
    if (a->state != S_TOPR && a->state != S_CLIMB && a->base > 0) a->base = 0;   // knocked off the ropes
    switch (a->state) {
    case S_IDLE:
        walk_pose(a);
        break;
    case S_STRIKE: {
        static const int fr[4] = { 0, 10, 18, 40 };
        const Pose *ps[4] = { &P_STANCE, &P_WIND, &P_PUNCH, &P_STANCE };
        keys(&a->pose, a->t, 4, fr, ps);
        if (a->t == 18) {
            if (a->rake && dist(a, d) < 1.25f && standing(d)) banner(12);
            land_hit(a, d, a->rake ? 9 : 5 + (rand() & 3), 0);
        }
        if (a->t >= a->dur) { if (a->combo) { set_state(a, S_KICK, 46); a->combo = 0; } else set_state(a, S_IDLE, 0); }
        break;
    }
    case S_KICK: {
        static const int fr[4] = { 0, 14, 30, 46 };
        const Pose *ps[4] = { &P_STANCE, &P_KICK, &P_KICK, &P_STANCE };
        keys(&a->pose, a->t, 4, fr, ps);
        if (a->t == 16) land_hit(a, d, 9, 0);
        if (a->t >= a->dur) set_state(a, S_IDLE, 0);
        break;
    }
    case S_LARIAT: {
        static const int fr[4] = { 0, 8, 22, 40 };
        const Pose *ps[4] = { &P_STANCE, &P_LARIAT, &P_LARIAT, &P_STANCE };
        keys(&a->pose, a->t, 4, fr, ps);
        if (a->t < 16) { float fx = sinf(a->yaw / 57.2958f), fz = cosf(a->yaw / 57.2958f); a->x += fx * 0.05f; a->z += fz * 0.05f; }
        if (a->t == 10) land_hit(a, d, 14, 1);
        if (a->t >= a->dur) set_state(a, S_IDLE, 0);
        break;
    }
    case S_BOOT: {
        static const int fr[4] = { 0, 9, 14, 32 };
        const Pose *ps[4] = { &P_STANCE, &P_BOOTW, &P_BOOT, &P_STANCE };
        keys(&a->pose, a->t, 4, fr, ps);
        if (a->t < 14 && dist(a, d) > 0.9f) { a->x += sinf(a->yaw / 57.2958f) * 0.04f; a->z += cosf(a->yaw / 57.2958f) * 0.04f; }
        if (a->t == 14) { land_hit(a, d, 11, 1); motion_hit(&a->mo, 0.5f); }
        if (a->t >= a->dur) set_state(a, S_IDLE, 0);
        break;
    }
    case S_SPEAR: {
        static const int fr[4] = { 0, 8, 16, 46 };
        const Pose *ps[4] = { &P_STANCE, &P_SPEARW, &P_SPEAR, &P_SPEAR };
        keys(&a->pose, a->t, 4, fr, ps);
        if (a->t >= 4 && a->t < 22) { a->x += sinf(a->yaw / 57.2958f) * 0.12f; a->z += cosf(a->yaw / 57.2958f) * 0.12f; }
        if (a->t == 18) { a->chit = land_hit(a, d, 17, 1); motion_hit(&a->mo, 0.9f); if (a->chit) banner_text("SPEAR!", RGB15(31, 26, 10)); }
        if (a->t >= a->dur) {
            if (a->chit) set_state(a, S_IDLE, 0);
            else { a->pose = P_LYINGFD; a->facedown = 1; set_state(a, S_GETUP, 70); motion_fall(&a->mo, 0.3f, 1.2f); }   // missed: he hits the mat
        }
        break;
    }
    case S_CHAIN: {
        int c = a->cn;
        static const int f0[4] = { 0, 5, 10, 22 }, f1[4] = { 0, 6, 11, 24 }, f2[4] = { 0, 8, 15, 28 }, f3[5] = { 0, 10, 16, 26, 40 };
        static const Pose *const *none;
        (void)none;
        if (c == 0) { const Pose *ps[4] = { &P_STANCE, &P_JABW, &P_JAB, &P_STANCE }; keys(&a->pose, a->t, 4, f0, ps); }
        else if (c == 1) { const Pose *ps[4] = { &P_STANCE, &P_HOOKW, &P_HOOK, &P_STANCE }; keys(&a->pose, a->t, 4, f1, ps); }
        else if (c == 2) { const Pose *ps[4] = { &P_STANCE, &P_KNEEW, &P_KNEE, &P_STANCE }; keys(&a->pose, a->t, 4, f2, ps); }
        else { const Pose *ps[5] = { &P_STANCE, &P_ROUNDW, &P_ROUND, &P_ROUND, &P_STANCE }; keys(&a->pose, a->t, 5, f3, ps); }
        if (a->t < CH_HIT[c] && a->t > 3 && dist(a, d) > 0.85f) {            // step into range with the blow
            float fx = sinf(a->yaw / 57.2958f), fz = cosf(a->yaw / 57.2958f); a->x += fx * 0.045f; a->z += fz * 0.045f;
        }
        if (a->t < CH_HIT[c]) a->yaw = wrap180(a->yaw + wrap180(face_to(a, d) - a->yaw) * 0.25f);
        if (a->t == CH_HIT[c]) {
            if (land_hit(a, d, CH_DMG[c] + (rand() & 1), c == 3)) {
                a->chit++;
                if (c == 3 && a->chit == 4) { banner_text("4-HIT COMBO!", RGB15(31, 26, 10)); hurt(d, 4); gain(a, 8); }
            }
            motion_hit(&a->mo, 0.2f + 0.1f * c);
        }
        if (a->t >= a->dur) {
            if (a->combo && c < 3) { a->combo = 0; a->cn = c + 1; set_state(a, S_CHAIN, CH_DUR[c + 1]); a->pose = a->pose; }
            else { a->combo = 0; a->cool = 8; set_state(a, S_IDLE, 0); }
        }
        break;
    }
    case S_GROUND: {
        float fx = sinf(a->yaw / 57.2958f), fz = cosf(a->yaw / 57.2958f);
        if (!a->mv) {                                   // two stomps
            static const int fr[6] = { 0, 8, 14, 22, 28, 40 };
            const Pose *ps[6] = { &P_STANCE, &P_STOMPU, &P_STOMP, &P_STOMPU, &P_STOMP, &P_STANCE };
            keys(&a->pose, a->t, 6, fr, ps);
            if (a->t == 14 || a->t == 28) {
                if (d->state == S_DOWN && dist(a, d) < 1.8f) { hurt(d, 6); gain(a, 5); sfx(SFX_HIT); motion_hit(&d->mo, 0.5f); }
                motion_hit(&a->mo, 0.4f);
            }
        } else if (a->mv == 1) {                        // leap and drop the elbow
            static const int fr[5] = { 0, 14, 28, 36, 56 };
            const Pose *ps[5] = { &P_STANCE, &P_ELBU, &P_ELBU, &P_ELBD, &P_STANCE };
            keys(&a->pose, a->t, 5, fr, ps);
            float k = a->t < 14 ? a->t / 14.0f : a->t < 28 ? 1.0f : a->t < 36 ? 1.0f - (a->t - 28) / 8.0f : 0;
            a->pose.py += 0.55f * k;
            if (a->t < 30 && dist(a, d) > 0.7f) { a->x += fx * 0.03f; a->z += fz * 0.03f; }
            if (a->t == 36) {
                if (d->state == S_DOWN && dist(a, d) < 1.6f) { hurt(d, 11); gain(a, 8); sfx(SFX_SLAM); motion_hit(&d->mo, 0.9f); }
                motion_hit(&a->mo, 0.8f);
            }
        } else {                                        // leg drop: jump, fall back across his chest
            static const int fr[5] = { 0, 12, 24, 34, 50 };
            const Pose *ps[5] = { &P_STANCE, &P_ELBU, &P_ELBU, &P_LEGD, &P_STANCE };
            keys(&a->pose, a->t, 5, fr, ps);
            float k = a->t < 12 ? a->t / 12.0f : a->t < 24 ? 1.0f : a->t < 34 ? 1.0f - (a->t - 24) / 10.0f : 0;
            a->pose.py += 0.5f * k;
            if (a->t < 26 && dist(a, d) > 0.7f) { a->x += fx * 0.03f; a->z += fz * 0.03f; }
            if (a->t == 34) {
                if (d->state == S_DOWN && dist(a, d) < 1.6f) { hurt(d, 12); gain(a, 9); sfx(SFX_SLAM); motion_hit(&d->mo, 0.9f); }
                motion_hit(&a->mo, 0.7f);
            }
        }
        if (a->t >= a->dur) set_state(a, S_IDLE, 0);
        break;
    }
    case S_DROP: {
        float fx = sinf(a->yaw / 57.2958f), fz = cosf(a->yaw / 57.2958f);
        Pose q = P_DROPK;
        if (a->t < 8) { float k = a->t / 8.0f; q.body = -72 * k; q.py = 0.30f * k; }
        else if (a->t > 22) { float k = (a->t - 22) / 8.0f; if (k > 1) k = 1; q.body = -72 - 18 * k; q.py = 0.30f - 1.22f * k * k; }
        pose_lerp(&a->pose, &a->pose, &q, 0.7f);
        if (a->t < 20) { a->x += fx * 0.075f; a->z += fz * 0.075f; }
        if (a->t == 12) { if (!land_hit(a, d, 15, 1)) { /* whiffed */ } else motion_hit(&d->mo, 1.0f); }
        if (a->t >= a->dur) { a->pose = P_LYING; set_state(a, S_GETUP, 70); a->facedown = 0; motion_fall(&a->mo, 0.3f, 1.2f); }
        break;
    }
    case S_BLOCK:
        pose_lerp(&a->pose, &a->pose, &P_BLOCK, 0.45f);
        if (a->t >= a->dur) set_state(a, S_IDLE, 0);
        break;
    case S_KNOCK: {
        static const int fr[3] = { 0, 6, 24 };
        const Pose *ps[3] = { &P_STANCE, &P_HIT, &P_LYING };
        keys(&a->pose, a->t, 3, fr, ps);
        if (a->t >= a->dur) { a->pose = P_LYING; set_state(a, S_DOWN, 110 + (100 - a->health) / 2); }
        break;
    }
    case S_FIN_A: {
        if (a->fin && a->fin != 4) {                    // DDT (Austin) / neckbreaker (Python): attacker drops back
            static const int fr[4] = { 0, 20, 46, 100 };
            const Pose *ps1[4] = { &P_LOCK, &P_LOCK, &P_FALL, &P_FALL };
            const Pose *ps2[4] = { &P_LOCK, &P_LOCK, &P_SIT, &P_SIT };
            keys(&a->pose, a->t, 4, fr, a->fin == 1 ? ps1 : ps2);
            if (a->t >= a->dur) {
                if (a->fin == 3) { set_state(a, S_IDLE, 0); a->wantpin = 1; }   // Forehead Tap: straight into the cover
                else { set_state(a, S_GETUP, 70); a->t = a->fin == 1 ? 0 : 25; a->pose = a->fin == 1 ? P_LYING : P_SIT; }
            }
            break;
        }
        static const int fr[5] = { 0, 26, 62, 80, 130 };
        const Pose *ps[5] = { &P_LOCK, &P_CARRY, &P_CARRY, &P_SLAM, &P_SLAM };
        keys(&a->pose, a->t, 5, fr, ps);
        if (a->t > 26 && a->t < 62) a->pose.py += sinf(a->t * 0.3f) * 0.02f;
        if (a->t >= a->dur) { set_state(a, S_GETUP, 70); a->t = 25; }   // rise from the kneel
        break;
    }
    case S_FIN_D: {
        float t = a->t, py, pz;
        Pose p = P_LYING;
        if (a->fin == 1) {                               // DDT: head driven into the mat, lands face down
            Pose q = P_STIFF;
            if (t < 20) { q = P_LOCK; }
            else if (t < 46) { float k = (t - 20) / 26; k = k * k; q.body = 100 * k; q.py = -0.08f - 0.62f * k; q.pz = 0.30f * k; q.head = 30 * k; }
            else if (t < 70) { float k = (t - 46) / 24; q = P_LYINGFD; q.py = -0.70f - 0.22f * k; q.pz = 0.30f; }
            else { q = P_LYINGFD; q.pz = 0.30f; }
            pose_lerp(&a->pose, &a->pose, &q, 0.6f);
            if (a->t == 46) { hurt(a, a->fdmg ? a->fdmg : 28); sfx(SFX_SLAM); sfx(SFX_CROWD); motion_hit(&a->mo, 0.9f); }
            if (a->t >= a->dur) {
                float fx = sinf(a->yaw / 57.2958f), fz = cosf(a->yaw / 57.2958f);
                a->x += fx * 0.30f; a->z += fz * 0.30f;
                a->pose = P_LYINGFD; a->facedown = 1;
                set_state(a, S_DOWN, 260 + (100 - a->health));
            }
            break;
        }
        if (a->fin == 4) {                               // chokeslam: lifted by the throat, held upright, slammed flat
            Pose q = P_STIFF;
            if (t < 26) { float k = t / 26; k = k * k * (3 - 2 * k); q.py = -0.08f + 0.58f * k; q.pz = 0.62f * k; q.head = -14 * k; }
            else if (t < 70) { q.py = 0.50f + sinf(t * 0.3f) * 0.02f; q.pz = 0.62f; q.head = -14; q.sh[0] = 40 + sinf(t * 0.7f) * 14; q.sh[1] = 40 - sinf(t * 0.7f) * 14; }
            else if (t < 88) { float k = (t - 70) / 18; k = k * k; q.py = 0.50f - 1.42f * k; q.pz = 0.62f - 0.70f * k; q.body = -90 * k; }
            else { q = P_LYING; q.py = -0.92f; q.pz = -0.08f; q.body = -90; }
            pose_lerp(&a->pose, &a->pose, &q, t < 88 ? 0.7f : 1.0f);
            if (a->t == 88) { hurt(a, a->fdmg ? a->fdmg : 24); sfx(SFX_SLAM); sfx(SFX_CROWD); motion_hit(&a->mo, 1.0f); }
            if (a->t >= a->dur) {
                float fx = sinf(a->yaw / 57.2958f), fz = cosf(a->yaw / 57.2958f);
                a->x -= fx * 0.08f; a->z -= fz * 0.08f;
                a->pose = P_LYING; a->facedown = 0;
                set_state(a, S_DOWN, 260 + (100 - a->health));
            }
            break;
        }
        if (a->fin >= 2) {                               // neckbreaker: snapped down onto the back
            Pose q = P_STIFF;
            if (t < 20) { q = P_LOCK; }
            else if (t < 46) { float k = (t - 20) / 26; k = k * k; q.body = -90 * k; q.py = -0.08f - 0.84f * k; q.pz = -0.10f * k; q.head = -20; }
            else { q = P_LYING; q.pz = -0.10f; }
            pose_lerp(&a->pose, &a->pose, &q, 0.6f);
            if (a->t == 46) { hurt(a, a->fdmg ? a->fdmg : 26); sfx(SFX_SLAM); sfx(SFX_CROWD); motion_hit(&a->mo, 0.9f); }
            if (a->t >= a->dur) {
                float fx = sinf(a->yaw / 57.2958f), fz = cosf(a->yaw / 57.2958f);
                a->x -= fx * 0.10f; a->z -= fz * 0.10f;
                a->pose = P_LYING; a->facedown = 0;
                set_state(a, S_DOWN, 240 + (100 - a->health));
            }
            break;
        }
        if (t < 26) { float k = t / 26; k = k * k * (3 - 2 * k); py = -0.08f + 0.50f * k; pz = 0.62f * k; p.body = -90 * k; }
        else if (t < 62) { py = 0.42f + sinf(t * 0.3f) * 0.02f; pz = 0.62f; p.body = -90; }
        else if (t < 80) { float k = (t - 62) / 18; k = k * k; py = 0.42f - 1.34f * k; pz = 0.62f - 0.70f * k; p.body = -90; }
        else { py = -0.92f; pz = -0.08f; p.body = -90; }
        p.py = py; p.pz = pz;
        pose_lerp(&a->pose, &a->pose, &p, t < 80 ? 0.7f : 1.0f);
        if (a->t == 80) { hurt(a, a->fdmg ? a->fdmg : 28); sfx(SFX_SLAM); sfx(SFX_CROWD); motion_hit(&a->mo, 0.9f); }
        if (a->t >= a->dur) {
            float fx = sinf(a->yaw / 57.2958f), fz = cosf(a->yaw / 57.2958f);
            a->x -= fx * 0.08f; a->z -= fz * 0.08f;
            a->pose = P_LYING;
            set_state(a, S_DOWN, 260 + (100 - a->health));
        }
        break;
    }
    case S_HIT: {
        static const int fr[3] = { 0, 6, 24 };
        const Pose *ps[3] = { &P_STANCE, &P_HIT, &P_STANCE };
        keys(&a->pose, a->t, 3, fr, ps);
        if (a->t >= a->dur) set_state(a, S_IDLE, 0);
        break;
    }
    case S_LOCK_A: case S_LOCK_D:
        pose_lerp(&a->pose, &a->pose, &P_LOCK, 0.25f);
        if (a->t >= a->dur) {
            if (a->state == S_LOCK_A) {
                // the attacker wins the lockup unless the defender has much more spirit
                int win = (a->spirit + 30 + (rand() % 40)) >= (d->spirit + (rand() % 40));
                W *att = win ? a : d, *def = win ? d : a;
                def->yaw = wrap180(att->yaw + 180);
                if (att->spirit >= 100) {
                    att->fdmg = def->fdmg = 0;
                    att->fin = cast_fin(att == &w[1] ? opp_id : player_id);   // 0 slam, 1 DDT, 2 neckbreaker
                    def->fin = att->fin;
                    set_state(att, S_FIN_A, att->fin ? 100 : 130);
                    set_state(def, S_FIN_D, att->fin ? 100 : 130);
                    att->spirit = 0; att->fin_ready = 0;
                    banner_text(FIN_NAME[att->fin], RGB15(31, 26, 10));
                } else if (att->mv == 1 || att->mv >= 3) {
                    att->fin = att->mv == 1 ? 0 : att->mv == 3 ? 1 : 2;
                    if (att->mv == 1 && att->spirit >= 50) att->fin = 4;                  // power slam: spirit 50+ makes it a chokeslam
                    def->fin = att->fin;
                    def->fdmg = att->fin == 4 ? 24 : att->mv == 1 ? 15 : att->mv == 3 ? 20 : 17;   // body slam 15, DDT 20, neckbreaker 17 (kit table) att->fdmg = def->fdmg;
                    set_state(att, S_FIN_A, (att->fin && att->fin != 4) ? 100 : 130);
                    set_state(def, S_FIN_D, (att->fin && att->fin != 4) ? 100 : 130);
                    gain(att, 14);
                    banner_text(att->fin == 4 ? "CHOKESLAM" : MV_NAME[att->mv], RGB15(31, 26, 10));
                } else {
                    att->fin = def->fin = 0; att->fdmg = def->fdmg = 0;
                    if (att->mv == 2) banner_text(MV_NAME[2], RGB15(31, 26, 10));
                    set_state(att, S_SUPLEX_A, 130);
                    set_state(def, S_SUPLEX_D, 130);
                }
            }
        }
        break;
    case S_SUPLEX_A: {
        static const int fr[5] = { 0, 30, 58, 86, 130 };
        const Pose *ps[5] = { &P_LOCK, &P_LIFT, &P_LIFT, &P_FALL, &P_FALL };
        keys(&a->pose, a->t, 5, fr, ps);
        if (a->t >= a->dur) { set_state(a, S_GETUP, 70); a->pose = P_LYING; }
        break;
    }
    case S_SUPLEX_D: {
        // Defender path in its own frame: attacker is 0.62 m ahead (+z).
        float t = a->t, body, py, pz;
        if (t < 30) { float k = t / 30; body = 20 * k; py = -0.08f + 0.2f * k; pz = 0.1f * k; }
        else if (t < 58) { float k = (t - 30) / 28; k = k * k * (3 - 2 * k); body = 20 + 160 * k; py = 0.12f + 0.98f * k; pz = 0.1f + 0.52f * k; }
        else if (t < 86) { float k = (t - 58) / 28; float e = k * k; body = 180 + 90 * e; py = 1.10f - 2.02f * e; pz = 0.62f + 0.95f * e; }
        else { body = 270; py = -0.92f; pz = 1.57f; }
        Pose p = P_STIFF; p.body = body; p.py = py; p.pz = pz;
        pose_lerp(&a->pose, &a->pose, &p, t < 86 ? 0.6f : 1.0f);
        if (a->t == 86) { hurt(a, 18 + (rand() % 3)); gain(d, 13); sfx(SFX_SLAM); }
        if (a->t >= a->dur) {
            float fx = sinf(a->yaw / 57.2958f), fz = cosf(a->yaw / 57.2958f);
            a->x += fx * 1.57f; a->z += fz * 1.57f;
            a->pose = P_LYING;
            set_state(a, S_DOWN, 150 + (100 - a->health));
        }
        break;
    }
    case S_DOWN:
        pose_lerp(&a->pose, &a->pose, a->facedown ? &P_LYINGFD : &P_LYING, 0.2f);
        a->pose.head = 10 + sinf(frame * 0.05f) * 6;
        if (a->t >= a->dur) set_state(a, S_GETUP, 70);
        break;
    case S_GETUP: {
        static const int fr[4] = { 0, 25, 50, 70 };
        const Pose *ps[4] = { &P_LYING, &P_SIT, &P_KNEEL, &P_STANCE };
        if (a->facedown) {                               // push up to a knee instead of sitting up
            static const int fr2[3] = { 0, 40, 70 };
            const Pose *ps2[3] = { &P_LYINGFD, &P_KNEEL, &P_STANCE };
            keys(&a->pose, a->t, 3, fr2, ps2);
        } else keys(&a->pose, a->t, 4, fr, ps);
        if (a->t >= a->dur) { set_state(a, S_IDLE, 0); a->facedown = 0; }
        break;
    }
    case S_COVER:
        if (a->wantpin) {                                 // kneel on the chest and tap the forehead in time with the count
            Pose p = P_KNEEL; p.torso = 40; p.head = 14; p.sh[1] = 70 + sinf(frame * 0.5f) * 22; p.el[1] = 40; p.py = -0.5f;
            pose_lerp(&a->pose, &a->pose, &p, 0.4f);
        } else pose_lerp(&a->pose, &a->pose, &P_COVER, 0.3f);
        break;
    case S_PINNED: {
        Pose p = P_LYING;
        p.sh[0] = 30 + sinf(frame * 0.3f) * 15;             // struggling
        p.kn[1] = 30 + sinf(frame * 0.25f) * 20;
        pose_lerp(&a->pose, &a->pose, &p, 0.3f);
        break;
    }
    case S_TAUNT: {
        static const int fr[4] = { 0, 15, 55, 70 };
        const Pose *ps[4] = { &P_STANCE, &P_TAUNT, &P_TAUNT, &P_STANCE };
        keys(&a->pose, a->t, 4, fr, ps);
        if (a->t >= a->dur) set_state(a, S_IDLE, 0);
        break;
    }
    case S_CLIMB: {
        float k = a->t / (float)a->dur;
        a->base = 3.3f * k;
        Pose p = P_CLIMB; p.sh[(a->t / 14) & 1] += 30; p.hip[(a->t / 14) & 1] += 25;
        pose_lerp(&a->pose, &a->pose, &p, 0.25f);
        if (a->t >= a->dur && !match_over) {          // over the top and down to the floor: escaped
            float ox = sinf(a->yaw / 57.2958f), oz = cosf(a->yaw / 57.2958f);
            a->x += ox * 1.2f; a->z += oz * 1.2f; a->base = -MAT_Y; a->yaw = wrap180(a->yaw + 180);
            a->pose = P_STAND; set_state(a, S_IDLE, 0);
            end_match(idx, "ESCAPED THE STEEL CAGE");
        }
        break;
    }
    case S_TOPR: {                                        // top-rope dive: climb (TNA: ~60-95 frames), pose, fly, land
        const float TOP = 1.55f;
        if (a->t < 44) {
            float k = a->t / 44.0f; a->base = TOP * k;
            Pose p = P_CLIMB; p.sh[(a->t / 11) & 1] += 30; p.hip[(a->t / 11) & 1] += 25;
            pose_lerp(&a->pose, &a->pose, &p, 0.25f);
        } else if (a->t < 74) {
            a->base = TOP; a->yaw = face_to(a, d);
            Pose p = P_TAUNT; p.py = 0.0f; pose_lerp(&a->pose, &a->pose, &p, 0.25f);
            if (a->t == 56) sfx(SFX_CROWD);
            a->ox = a->x; a->oz = a->z; a->tx = d->x; a->tz = d->z;
        } else if (a->t < 98) {
            float k = (a->t - 74) / 24.0f;
            a->x = a->ox + (a->tx - a->ox) * k; a->z = a->oz + (a->tz - a->oz) * k;
            a->base = TOP * (1 - k * k) * 0.8f + 0.05f;
            a->yaw = face_to(a, d);
            Pose q = P_SPEAR; q.py = 0.1f; pose_lerp(&a->pose, &a->pose, &q, 0.5f);
        } else if (a->t == 98) {
            a->base = 0;
            if (dist(a, d) < 1.3f && (d->state == S_DOWN || !standing(d) || d->state == S_HIT)) {
                hurt(d, 20); gain(a, 14); gain(d, 6); sfx(SFX_SLAM); sfx(SFX_CROWD); motion_hit(&d->mo, 1.0f); motion_hit(&a->mo, 0.8f);
                banner_text("TOP ROPE CROSSBODY", RGB15(31, 26, 10));
                a->pose = P_LYING; a->facedown = 0; a->wantpin = 1;
            } else { hurt(a, 8); sfx(SFX_SLAM); motion_hit(&a->mo, 0.9f); a->pose = P_LYINGFD; a->facedown = 1; banner_text("MISSED!", RGB15(31, 12, 8)); }
            a->t = a->dur - 70;
        } else {
            if (a->t >= a->dur - 1) { set_state(a, S_GETUP, 70); }
        }
        break;
    }
    case S_WIN:
        pose_lerp(&a->pose, &a->pose, &P_TAUNT, 0.15f);
        a->pose.sh[0] = 170 + sinf(frame * 0.1f) * 8;
        break;
    }
    (void)idx;
}

static void separate(void)
{
    if (!standing(&w[0]) || !standing(&w[1])) return;
    float dx = w[1].x - w[0].x, dz = w[1].z - w[0].z, d = sqrtf(dx * dx + dz * dz);
    if (d < 0.62f && d > 0.001f) {
        float push = (0.62f - d) * 0.5f;
        dx /= d; dz /= d;
        w[0].x -= dx * push; w[0].z -= dz * push;
        w[1].x += dx * push; w[1].z += dz * push;
    }
}

static void clamp_ring(W *a)
{
    const float lim = 2.6f;
    if (a->x < -lim) a->x = -lim;
    if (a->x > lim) a->x = lim;
    if (a->z < -lim) a->z = -lim;
    if (a->z > lim) a->z = lim;
}

static void move(W *a, float dx, float dz)
{
    float len = sqrtf(dx * dx + dz * dz);
    a->speed = 0;
    if (len < 0.001f || a->state != S_IDLE) return;
    float sp = a->run ? 0.068f : 0.032f;
    a->x += dx / len * sp; a->z += dz / len * sp;
    a->speed = sp;
    a->walk += a->run ? 0.34f : 0.22f;
    if (a->run) turn_to(a, atan2f(dx, dz) * 57.2958f, 14);
}

// CPU: Python is a heel - stalks, sneaks cheap shots, taunts the crowd, goes for the cover when you're hurt.
static void ai(W *a, W *d)
{
#ifdef MOVE_TEST
    (void)a; (void)d; return;
#endif
    if (a->state == S_CHAIN) { if (a->cn < 3 && a->t >= CH_HIT[a->cn] - 2 && !a->combo && (rand() % 5) == 0) a->combo = 1; a->speed = 0; return; }
    if (a->state != S_IDLE) { a->speed = 0; return; }
    if (attacking(d) && dist(a, d) < 1.5f && !a->cool && (rand() % 9) == 0) { try_block(a, d); return; }
    float dd = dist(a, d);
    if (d->state == S_CLIMB) {                        // drag him back down
        if (dd > 1.2f) move(a, d->x - a->x, d->z - a->z);
        else if (!a->cool && (rand() % 24) == 0) try_strike(a, d);
        return;
    }
    if (match_type == MT_CAGE && d->state == S_DOWN && !climb[1] && (rand() % 160) == 0) climb[1] = 1;
    if (climb[1]) {                                   // head for the nearest wall and climb out
        if (d->state != S_DOWN && d->state != S_GETUP) climb[1] = 0;
        else {
            float gx = a->x, gz = a->z;
            if (fabsf(a->x) > fabsf(a->z)) gx = a->x > 0 ? 2.35f : -2.35f; else gz = a->z > 0 ? 2.35f : -2.35f;
            if (fabsf(gx - a->x) + fabsf(gz - a->z) > 0.08f) { move(a, gx - a->x, gz - a->z); return; }
            climb[1] = 0; a->cool = 0; try_taunt(a); return;
        }
    }
    if (d->state == S_DOWN) {
        if (dd > 1.2f) { move(a, d->x - a->x, d->z - a->z); return; }
        if (!a->cool && (rand() % 45) == 0) { in_dir = rand() & 1; try_strike(a, d); a->cool = 30; return; }
        if (!a->cool && (rand() & 63) == 0) {
            if (d->health < 55 || (rand() & 3) == 0) try_pin(a, d);
            else try_taunt(a);
        }
        a->speed = 0;
        return;
    }
    if (dd > 2.4f) a->run = 1;
    if (a->run && dd < 1.15f) { in_dir = 0; if (rand() & 1) try_strike(a, d); else try_grapple(a, d); return; }
    if (dd > 0.95f) { move(a, d->x - a->x, d->z - a->z); return; }
    a->run = 0;
    a->speed = 0;
    if (a->cool) return;
    int r = rand() % 100;
    in_dir = rand() % 5;
    if (ref_distracted && r < 6) { try_strike(a, d); a->cool = 40; }
    else if (r < 2) { try_strike(a, d); a->cool = 70; }
    else if (r < 3 && (rand() & 1)) { try_grapple(a, d); a->cool = 110; }
    else if (r < 5 && a->spirit < 60 && dd > 0.8f) try_taunt(a);
}

static void update_ref(void)
{
    ref.t++;
    if (ref.state == S_COVER) {
        W *pinned = (w[0].state == S_PINNED) ? &w[0] : &w[1];
        // kneel by the pinned wrestler's shoulders
        float hx = sinf(pinned->yaw / 57.2958f), hz = cosf(pinned->yaw / 57.2958f);
        float tx = pinned->x - hx * 0.9f + hz * 0.55f, tz = pinned->z - hz * 0.9f - hx * 0.55f;
        ref.x += (tx - ref.x) * 0.2f; ref.z += (tz - ref.z) * 0.2f;
        ref.yaw = face_to(&ref, pinned);
        Pose p = P_REFKNEEL;
        int ph = ref.t % 50;
        float k = ph < 38 ? ph / 38.0f : 1.0f;
        p.sh[1] = 165 - 105 * k * k;                         // hand comes down on the mat
        pose_lerp(&ref.pose, &ref.pose, &p, ref.t < 20 ? 0.15f : 0.6f);
        if (ref.t >= 20 && ph == 38) {
            pin_count++;
            sfx(SFX_COUNT);
            banner(pin_count);
        }
    } else if (ref_distracted) {
        // arguing with someone at ringside: back turned to the action
        if (--ref_distracted == 0) ref_timer = 420 + rand() % 360;
        turn_to(&ref, atan2f(ref.x * 3, ref.z * 3 + 0.01f) * 57.2958f, 5);
        Pose p = P_STAND; p.sh[1] = 95; p.el[1] = 10; p.roll[1] = 30; p.head = -10 + sinf(frame * 0.2f) * 8;
        p.sh[0] = 40 + sinf(frame * 0.25f) * 25; p.el[0] = 60;
        pose_lerp(&ref.pose, &ref.pose, &p, 0.2f);
    } else {
        if (--ref_timer <= 0 && !match_over && w[1].state != S_ENTER) { ref_distracted = 110; banner(15); }
        // stay off the action, on the camera side, facing the wrestlers
        float mx = (w[0].x + w[1].x) * 0.5f, mz = (w[0].z + w[1].z) * 0.5f;
        float tx = mx + 1.7f, tz = mz - 1.2f;
        if (tx > 2.5f) tx = mx - 1.7f;
        if (tz < -2.5f) tz = -2.5f;
        float dx = tx - ref.x, dz = tz - ref.z;
        ref.speed = 0;
        if (dx * dx + dz * dz > 0.04f) { ref.x += dx * 0.04f; ref.z += dz * 0.04f; ref.speed = 0.02f; ref.walk += 0.18f; }
        turn_to(&ref, atan2f(mx - ref.x, mz - ref.z) * 57.2958f, 6);
        Pose p = P_STAND;
        float s = sinf(ref.walk), amp = ref.speed > 0 ? 1.0f : 0.0f;
        p.hip[0] += 20 * s * amp; p.hip[1] -= 20 * s * amp;
        p.kn[0] += (s < 0 ? -s * 28 : 3) * amp; p.kn[1] += (s > 0 ? s * 28 : 3) * amp;
        p.sh[0] = 30; p.sh[1] = 30; p.el[0] = 70; p.el[1] = 70; p.roll[0] = 14; p.roll[1] = 14;  // hands on knees-ish
        p.torso = 18;
        pose_lerp(&ref.pose, &ref.pose, &p, 0.3f);
    }
}

// Resolve a pin attempt: kickouts depend on health; the player mashes A/B to escape.
static void update_pin(void)
{
    if (ref.state != S_COVER) return;
    int pi = (w[0].state == S_PINNED) ? 0 : 1;
    W *p = &w[pi], *a = &w[1 - pi];
    int ph = ref.t % 50;
    int kick = 0;
    if (pi == 1) {
        int before = pin_count;             // CPU decides just before the hand would land
        if (ph == 30) {
            int h = p->health;
            if (before == 0 && h > 60) kick = 1;
            else if (before == 1 && h > 35) kick = 1;
            else if (before == 2 && h > 12 && (rand() % 100) < 70) kick = 1;
        }
    } else {
        int need = 4 + (100 - p->health) / 7;
        if (mash >= need && ph < 36) kick = 1;
    }
    int ropes = fabsf(p->x) > 2.25f || fabsf(p->z) > 2.25f;
    if (match_type == MT_NODQ || match_type == MT_CAGE) ropes = 0;   // no rope breaks
    if (ropes && ph == 34 && pin_count >= 1) {           // foot on the ropes: count stops
        banner(14);
        kick = 2;
    }
    if (kick) {
        if (kick == 1) banner(4);
        set_state(p, S_GETUP, 70);
        set_state(a, S_GETUP, 70);
        a->pose = P_SIT;
        set_state(&ref, S_IDLE, 0);
        a->cool = 30;
        return;
    }
    if (pin_count >= 3) {
        int wi = 1 - pi;
        if (match_type == MT_FALLS && ++falls[wi] < 2) {     // first fall: both reset, the pinned man recovers a bit
            sfx(SFX_BELL);
            char b[40]; strcpy(b, "FALL TO "); strcat(b, cast_name(wi ? opp_id : player_id));
            banner_text(b, RGB15(31, 26, 10)); ban_timer = 150;
            char sc[24] = "FALLS  0 - 0"; sc[7] = '0' + falls[0]; sc[11] = '0' + falls[1];
            draw_text_c(sub, font_ui_bin, 128, 104, sc, RGB15(31, 31, 31));
            set_state(p, S_GETUP, 70); set_state(a, S_GETUP, 70); a->pose = P_SIT;
            p->health += 30; if (p->health > 100) p->health = 100;
            set_state(&ref, S_IDLE, 0);
            return;
        }
        static char how[24]; strcpy(how, "TWO FALLS TO 0"); how[13] = '0' + falls[1 - wi];
        end_match(wi, match_type == MT_FALLS ? how : NULL);
    }
}

static void end_match(int wi, const char *how)
{
    W *win = &w[wi], *los = &w[1 - wi];
    match_over = 1; win_idx = wi; sfx(SFX_BELL); sfx(SFX_CROWD); bgm_stop();
    char b[32]; strcpy(b, cast_name(wi ? opp_id : player_id)); strcat(b, " WINS!");
    banner_text(b, wi == 0 ? RGB15(16, 24, 31) : RGB15(31, 14, 14)); ban_timer = 0; won = (wi == 0);
    if (how) draw_text_c(sub, font_ui_bin, 128, 104, how, RGB15(31, 28, 12));
    set_state(&ref, S_IDLE, 0);
    if (win->state == S_COVER) { set_state(win, S_GETUP, 70); win->pose = P_SIT; }
    if (!standing(los) && los->state != S_DOWN) { los->state = S_DOWN; los->t = 0; }
    if (los->state == S_DOWN || los->state == S_PINNED) { los->state = S_DOWN; los->dur = 99999; }
}

// Last Man Standing: whenever someone is down the ref counts to ten; the player mashes A/B to beat it.
static void update_lms(void)
{
    if (match_type != MT_LMS || match_over) return;
    if (lms_down < 0) {
        for (int i = 0; i < 2; i++)
            if (w[i].state == S_DOWN && w[i].t > 20) { lms_down = i; lms_count = 0; lms_t = 0; lms_mash = 0; w[i].dur = 99999; lms_downs[i]++; break; }
        return;
    }
    W *d = &w[lms_down];
    if (d->state != S_DOWN) { lms_down = -1; return; }
    if (++lms_t % 50 == 0) {
        lms_count++; sfx(SFX_COUNT);
        char b[4]; if (lms_count >= 10) strcpy(b, "10"); else { b[0] = '0' + lms_count; b[1] = 0; }
        banner_text(b, RGB15(31, 31, 31)); ban_timer = 45;
        if (lms_count >= 10) { end_match(1 - lms_down, "COULD NOT ANSWER THE 10 COUNT"); lms_down = -1; return; }
    }
    int up;
    if (lms_down == 1) {
        int need = (d->health > 60 ? 2 : d->health > 40 ? 4 : d->health > 25 ? 6 : d->health > 12 ? 8 : 11) + lms_downs[1] - 1;
        up = lms_count >= need && lms_t % 50 == 25;
    } else up = lms_mash >= 6 + (100 - d->health) / 4 + 8 * (lms_downs[0] - 1);
    if (up) { set_state(d, S_GETUP, 70); lms_down = -1; }
}

// Steel cage: dark mesh walls on all four sides of the ring with bars and rails.
static void draw_cage(void)
{
    if (match_type != MT_CAGE) return;
    const float e = HALF + 0.02f, y0 = MAT_Y, y1 = MAT_Y + 3.6f;
    glBindTexture(0, 0);
    glPolyFmt(POLY_ALPHA(31) | POLY_CULL_NONE | POLY_ID(12));
    BEGIN(GL_QUADS);
    C(70, 72, 80);
    for (int side = 0; side < 4; side++) {
        for (int i = 0; i <= 12; i++) {                       // vertical bars
            float u = -e + i * (2 * e / 12), t = 0.035f;
            float ax, az, bx, bz;
            if (side < 2) { float z = side ? e : -e; ax = u - t; bx = u + t; az = bz = z; }
            else { float x = side == 3 ? e : -e; az = u - t; bz = u + t; ax = bx = x; }
            V(ax, y0, az); V(bx, y0, bz); V(bx, y1, bz); V(ax, y1, az);
        }
        for (int j = 0; j < 3; j++) {                         // rails
            float yy = y0 + 0.05f + j * 1.75f, h = 0.06f;
            if (side < 2) { float z = side ? e : -e; V(-e, yy, z); V(e, yy, z); V(e, yy + h, z); V(-e, yy + h, z); }
            else { float x = side == 3 ? e : -e; V(x, yy, -e); V(x, yy, e); V(x, yy + h, e); V(x, yy + h, -e); }
        }
    }
    END();
    glPolyFmt(POLY_ALPHA(7) | POLY_CULL_NONE | POLY_ID(13));    // chain-link haze
    BEGIN(GL_QUADS);
    C(40, 42, 50);
    V(-e, y0, -e); V(e, y0, -e); V(e, y1, -e); V(-e, y1, -e);
    V(-e, y0, e); V(e, y0, e); V(e, y1, e); V(-e, y1, e);
    V(-e, y0, -e); V(-e, y0, e); V(-e, y1, e); V(-e, y1, -e);
    V(e, y0, -e); V(e, y0, e); V(e, y1, e); V(e, y1, -e);
    END();
}

static void draw_shadow(float x, float z, float base, float r)
{
    poly(10, 40);
    glBindTexture(0, 0);
    BEGIN(GL_QUADS);
    C(0, 0, 0);
    float y = (base < -0.5f ? 0.03f : MAT_Y + 0.012f);
    for (int i = 0; i < 8; i += 2) {
        float a0 = i * 0.785f, a1 = (i + 1) * 0.785f, a2 = (i + 2) * 0.785f;
        V(x, y, z); V(x + cosf(a0) * r, y, z + sinf(a0) * r);
        V(x + cosf(a1) * r, y, z + sinf(a1) * r); V(x + cosf(a2) * r, y, z + sinf(a2) * r);
    }
    END();
}

static void draw_people(void)
{
    lights_on();
    for (int i = 0; i < 2; i++) {
        W *q = &w[i];
        if (q->state != q->mstate) {                      // state edges trigger the physical reactions
            float bx = q->x - w[1 - i].x, bz = q->z - w[1 - i].z;      // direction the blow travels (attacker -> victim)
            if (q->state == S_HIT) motion_hit_dir(&q->mo, 0.6f, bx, bz, q->yaw);
            else if (q->state == S_KNOCK) { motion_hit_dir(&q->mo, 1.0f, bx, bz, q->yaw); motion_fall(&q->mo, 0.15f, 0.8f); }
            else if (q->state == S_DOWN && q->mstate != S_GETUP && q->mstate != S_COVER && q->mstate != S_PINNED) motion_fall(&q->mo, 0.45f, 1.6f);
            else if (q->state == S_SUPLEX_D || q->state == S_FIN_D) motion_hit(&q->mo, 0.8f);
            q->mstate = q->state;
        }
        static const signed char CLS[] = { MC_IDLE, MC_STRIKE, MC_DODGE, MC_GRAPPLE, MC_GRAPPLE, MC_THROW, MC_THROW, MC_FALL, MC_GETUP, MC_PIN, MC_PIN,
                                           MC_TAUNT, MC_TAUNT, MC_TAUNT, MC_KICK, MC_STRIKE, MC_FALL, MC_THROW, MC_THROW, MC_CLIMB,
                                           MC_STRIKE, MC_KICK, MC_AERIAL, MC_DODGE };
        int cls = CLS[q->state]; if (cls == MC_IDLE && q->run && q->speed > 0.005f) cls = MC_RUN;
        motion_phys(&q->mo, q->x, q->z, q->yaw, q->look->build * q->look->height * q->look->height, q->health < 30 ? (30 - q->health) / 30.0f : 0);
        Pose p; motion_step(&q->mo, &q->pose, cls, &p); p.py += q->base;
        draw_wrestler(w[i].look, w[i].x, w[i].z, w[i].yaw, &p, 2 + i);
    }
    draw_wrestler(cast_look(C_REF), ref.x, ref.z, ref.yaw, &ref.pose, 4);
    for (int i = 0; i < 2; i++) {
        int id = i ? opp_id : player_id;
        if (id != C_MONTE || w[i].state != S_ENTER || w[i].base > -0.3f) continue;
        glPolyFmt(POLY_ALPHA(31) | POLY_CULL_NONE | POLY_ID(6)); glBindTexture(0, 0);
        glPushMatrix();
        glTranslatef(w[i].x * SC, (MAT_Y + w[i].base) * SC, w[i].z * SC);
        box(-0.45f, 0, 0.1f, 0.45f, 0.18f, 0.9f, 60, 110, 200);            // buffer deck
        box(-0.5f, 0, 0.9f, 0.5f, 0.1f, 1.1f, 230, 230, 60);               // pad
        box(-0.04f, 0.18f, 0.12f, 0.04f, 1.1f, 0.2f, 150, 150, 160);       // handle
        box(-0.3f, 1.05f, 0.1f, 0.3f, 1.13f, 0.22f, 40, 40, 44);
        glPopMatrix(1);
    }
    for (int i = 0; i < 2; i++) if (w[i].base > -MAT_Y - 1) draw_shadow(w[i].x, w[i].z, w[i].base, 0.42f);
    draw_shadow(ref.x, ref.z, 0, 0.36f);
}

// ---------------------------------------------------------------- camera
static float cx, cy = 4.4f, cz = 9, tx, ty = 1.4f, tzz;
static void cam_follow(float ex, float ey, float ez, float lx, float ly, float lz, float k)
{
    cx += (ex - cx) * k; cy += (ey - cy) * k; cz += (ez - cz) * k;
    tx += (lx - tx) * k; ty += (ly - ty) * k; tzz += (lz - tzz) * k;
    gluLookAt(cx * SC, cy * SC, cz * SC, tx * SC, ty * SC, tzz * SC, 0, 1, 0);
}

// ---------------------------------------------------------------- the match
static const int BTN[4][4] = { { 8, 128, 58, 42 }, { 70, 128, 58, 42 }, { 132, 128, 58, 42 }, { 194, 128, 54, 42 } };

int match_run(u16 *subfb, int player, int opp)
{
    sub = subfb;
    player_id = player; opp_id = opp; won = 0;
    init_poses();
    memset(w, 0, sizeof w);
    memset(&ref, 0, sizeof ref);
    w[0] = (W){ .look = cast_look(player), .x = 0, .z = 1.4f, .yaw = 180, .health = 100, .spirit = SPIRIT0 + (spirit_bonus > 70 ? 70 : spirit_bonus), .pose = P_STANCE };
    w[1] = (W){ .look = cast_look(opp), .x = 0, .z = -7.0f, .yaw = 0, .health = 100, .spirit = 30, .pose = P_STAND, .base = -MAT_Y };
    ref = (W){ .look = cast_look(C_REF), .x = 1.8f, .z = 0.2f, .yaw = -90, .pose = P_STAND };
    set_state(&w[1], S_ENTER, 0);
    int caw_entrance = cast_theme(player) != NULL && !skip_player_entrance;
    if (caw_entrance) {                       // created wrestler walks out to their own theme first
        w[0].x = 0; w[0].z = -7.0f; w[0].yaw = 0; w[0].base = -MAT_Y; w[0].pose = P_STAND;
        set_state(&w[0], S_ENTER, 0);
        w[1].z = -14.0f; w[1].base = -MAT_Y - 6;  // Python waits backstage, out of sight
    }
    spirit_bonus = 0;
    match_over = 0; banner_shown = -1; ref_distracted = 0; ref_timer = 600; ban_timer = 0;
    falls[0] = falls[1] = 0; lms_downs[0] = lms_downs[1] = 0; lms_down = -1; climb[0] = climb[1] = 0; win_idx = 0;
    if (match_type == MT_NODQ) ref_timer = 1 << 30;   // nothing to distract the ref from
    dmaCopy(hud_gen_bin, sub, 256 * 192 * 2);
    for (int s = 0; s < 2; s++) {
        int id = s ? opp : player, x0 = s ? 134 : 8;
        const u16 *pp = cast_portrait(id);
        for (int y = 0; y < 46; y++) for (int x = 0; x < 46; x++) sub[(8 + y) * 256 + x0 + x] = pp[y * 46 + x] | BIT(15);
        const char *nm = cast_name(id);
        draw_text(sub, text_width(font_big_bin, nm) <= 64 ? font_big_bin : font_ui_bin, x0 + 50, 7, nm, RGB15(31, 31, 31));
    }
    { static const char *const SHORT[MT_COUNT] = { "THROWDOWN", "NO DQ", "2 OF 3 FALLS", "STEEL CAGE", "LAST MAN STANDING" };
      char b[64]; strcpy(b, SHORT[match_type]); strcat(b, "  -  "); strcat(b, cast_name(player)); strcat(b, " vs "); strcat(b, cast_name(opp));
      draw_text(sub, font_ui_bin, 6, 178, b, RGB15(25, 26, 30)); }
    banner(0);
    bars();

    soundEnable();
    int theme = -1;
    if (caw_entrance) seq_start(cast_theme(player));
    else if (opp == C_PYTHON) theme = soundPlaySample(theme_python_bin, SoundFormat_8Bit, theme_python_bin_size, 11025, 110, 64, false, 0);
    else if (cast_theme(opp)) seq_start(cast_theme(opp));
    int enter_t = 0, fight_t = 0, over_t = 0, buf = -1, buf_t = 0;
    cx = 2.5f; cy = 1.8f; cz = -3.0f; tx = 0; ty = 1.0f; tzz = -7;

    while (1) {
        frame++;
        input_scan();
        u32 kd = keys_down(), kh = keysHeld();
        int act = -1;
        if (kd & KEY_TOUCH) {
            touchPosition tp; touch_get(&tp);
            for (int i = 0; i < 4; i++)
                if (tp.px >= BTN[i][0] && tp.px < BTN[i][0] + BTN[i][2] && tp.py >= BTN[i][1] && tp.py < BTN[i][1] + BTN[i][3]) act = i;
        }
        if (kd & KEY_A) act = 0;
        if (kd & KEY_B) act = 1;
        if (kd & KEY_Y) act = 2;
        if (kd & KEY_X) act = 3;

        if (act >= 0) { buf = act; buf_t = 30; } else if (buf_t > 0 && --buf_t == 0) buf = -1;

        // ---- entrances: down the ramp, up the steps, a pose to the crowd (created wrestler first, then Python)
        if (w[0].state == S_ENTER || w[1].state == S_ENTER) {
            enter_t++;
            int ei = (w[0].state == S_ENTER) ? 0 : 1;
            W *p = &w[ei], *other = &w[1 - ei];
            float goal = ei ? -1.6f : 1.4f;
            seq_tick();
            if (enter_t < 60) {                       // pose on the stage
                pose_lerp(&p->pose, &p->pose, &P_TAUNT, 0.08f);
            } else if (p->base < -0.01f && p->z < -3.6f) {  // walk the ramp
                p->speed = 0.022f; p->z += p->speed; p->walk += 0.16f; p->yaw = 0;
                Pose q = P_STAND; float s = sinf(p->walk);
                q.hip[0] += 22 * s; q.hip[1] -= 22 * s; q.kn[0] += s < 0 ? -s * 30 : 3; q.kn[1] += s > 0 ? s * 30 : 3;
                q.sh[0] -= 16 * s; q.sh[1] += 16 * s; q.torso = -4; q.head = -6;
                pose_lerp(&p->pose, &p->pose, &q, 0.3f);
            } else if (p->base < -0.01f) {            // climb through the ropes
                p->base += 0.02f; p->z += 0.014f;
                pose_lerp(&p->pose, &p->pose, &P_CLIMB, 0.2f);
            } else {
                p->base = 0;
                if (p->z < goal) { p->z += 0.02f; p->walk += 0.14f; }
                else { set_state(p, S_TAUNT, 70); if (ei) fight_t = 1; }
                pose_lerp(&p->pose, &p->pose, &P_STAND, 0.2f);
            }
            if (other->base == 0) { walk_pose(other); other->yaw = face_to(other, p); }
            update_ref();
            if (kd & KEY_START) {                     // skip entrance
                p->base = 0; p->z = goal; set_state(p, S_IDLE, 0);
                if (ei) fight_t = 1;
            }
            if (ei == 0 && w[0].state != S_ENTER) {   // created wrestler is in: cue Python
                seq_stop();
                w[0].yaw = 180; w[0].x = 0; w[0].z = 1.4f;
                w[1].z = MOVE_Z; w[1].x = 0; w[1].base = -MAT_Y; enter_t = 0;
                if (opp == C_PYTHON) theme = soundPlaySample(theme_python_bin, SoundFormat_8Bit, theme_python_bin_size, 11025, 110, 64, false, 0);
                else if (cast_theme(opp)) seq_start(cast_theme(opp));
            }
        } else if (!match_over) {
            if (fight_t > 0 && fight_t < 90) { if (fight_t == 1) { banner(7); sfx(SFX_BELL); } fight_t++; if (fight_t == 40 && match_type) banner_text(MATCH_TYPE_NAME[match_type], RGB15(31, 26, 10)); if (fight_t == 90) { banner(0); if (theme >= 0) soundKill(theme); theme = -1; bgm_start(4); } }

            // ---- player
            W *s = &w[0], *o = &w[1];
            float dx = 0, dz = 0;
            if (kh & KEY_LEFT) dx -= 1;
            if (kh & KEY_RIGHT) dx += 1;
            if (kh & KEY_UP) dz -= 1;
            if (kh & KEY_DOWN) dz += 1;
            if (s->state == S_PINNED) { if (kd & (KEY_A | KEY_B)) mash++; }
            else if (s->state == S_DOWN && lms_down == 0) { if (kd & (KEY_A | KEY_B)) lms_mash++; }
            else {
                // camera-relative: UP walks away from the camera, RIGHT walks screen-right
                float fx = tx - cx, fz = tzz - cz, fl = sqrtf(fx * fx + fz * fz);
                if (fl > 0.001f) { fx /= fl; fz /= fl; }
                s->run = (kh & KEY_R) && (dx != 0 || dz != 0) && s->state == S_IDLE;
                move(s, dx * -fz - dz * fx, dx * fx - dz * fz);
#ifdef MOVE_TEST
                { static int mt; mt++;
                  #define TP() do { set_state(o, S_IDLE, 0); o->pose = P_STANCE; o->x = 0; o->z = 0; s->x = 0; s->z = 1.0f; s->yaw = 180; o->yaw = 0; s->cool = 0; } while (0)
                  if (mt == 20 || mt == 33 || mt == 46 || mt == 59) { if (mt == 20) TP(); in_dir = 0; try_strike(s, o); }
                  if (mt == 200) { TP(); in_dir = 1; try_grapple(s, o); }
                  if (mt == 400) { TP(); in_dir = 4; try_grapple(s, o); }
                  if (mt == 600) { TP(); in_dir = 3; try_grapple(s, o); }
                  if (mt == 800) { TP(); in_dir = 2; try_grapple(s, o); }
                  if (mt == 1000) { TP(); set_state(o, S_DOWN, 400); o->pose = P_LYING; in_dir = 0; try_strike(s, o); }
                  if (mt == 1100) { TP(); set_state(o, S_DOWN, 400); o->pose = P_LYING; in_dir = 1; try_strike(s, o); }
                  if (mt == 1200) { TP(); s->z = 3.5f; s->run = 1; }
                  if (mt == 1212) { in_dir = 0; try_grapple(s, o); }
                  if (mt == 1300) { TP(); s->run = 0; try_strike(s, o); }
                  if (mt == 1308) { try_block(o, s); }
                  if (mt == 1400) { TP(); set_state(s, S_IDLE, 0); o->health = 100; s->z = 1.1f; in_dir = 2; try_strike(s, o); }              // big boot
                  if (mt == 1500) { TP(); set_state(s, S_IDLE, 0); o->health = 100; s->z = 2.4f; s->run = 1; in_dir = 1; try_strike(s, o); }   // spear
                  if (mt == 1650) { TP(); set_state(s, S_IDLE, 0); o->health = 100; set_state(o, S_DOWN, 400); o->pose = P_LYING; in_dir = 2; try_strike(s, o); }  // leg drop
                  if (mt == 1800) { TP(); set_state(s, S_IDLE, 0); o->health = 100; s->spirit = 60; in_dir = 1; try_grapple(s, o); }                    // chokeslam
                  if (mt == 2100) { TP(); set_state(s, S_IDLE, 0); o->health = 100; s->health = 100; s->x = 2.4f; s->z = 2.4f; set_state(o, S_DOWN, 600); o->pose = P_LYING; try_taunt(s); }  // top rope dive
                  #undef TP
                }
#endif
                in_dir = (kh & KEY_UP) ? 1 : (kh & KEY_DOWN) ? 2 : (kh & KEY_LEFT) ? 3 : (kh & KEY_RIGHT) ? 4 : 0;
                if (buf == 0 && s->state == S_CHAIN) { try_strike(s, o); buf = -1; buf_t = 0; }
                if (buf >= 0 && s->state == S_IDLE && !s->cool) {
                    if (buf == 0) try_strike(s, o);
                    if (buf == 1) try_grapple(s, o);
                    if (buf == 2) try_pin(s, o);
                    if (buf == 3) { if (attacking(o) && dist(s, o) < 1.8f) try_block(s, o); else try_taunt(s); }
                    buf = -1; buf_t = 0;
                }
            }
            ai(o, s);
            for (int i = 0; i < 2; i++) {
                W *a = &w[i], *b = &w[1 - i];
                if (a->state == S_IDLE && !a->run) turn_to(a, face_to(a, b), 9);
                update_w(a, b, i);
                clamp_ring(a);
            }
            for (int i = 0; i < 2; i++) {
                if (w[i].wantpin == 1 && w[1 - i].state == S_DOWN && w[i].state == S_IDLE) { try_pin(&w[i], &w[1 - i]); w[i].wantpin = 2; }
                if (w[i].wantpin == 2 && w[i].state != S_COVER) w[i].wantpin = 0;
            }
            separate();
            update_ref();
            update_pin();
            update_lms();
            if (banner_shown == 4 && ref.state == S_IDLE && (frame & 63) == 0) banner(0);
            if (ban_timer > 0 && --ban_timer == 0 && !match_over) banner(0);
            if (!ban_timer && !match_over && fight_t >= 90 && (frame & 15) == 0) move_hint();
        } else {
            over_t++;
            W *win = &w[win_idx];
            for (int i = 0; i < 2; i++) update_w(&w[i], &w[1 - i], i);
            if (win->state == S_IDLE) set_state(win, S_WIN, 9999);
            update_ref();
            if (over_t > 120 && (kd & (KEY_START | KEY_TOUCH))) break;
        }

        // ---- camera
        glMatrixMode(GL_MODELVIEW);
        glLoadIdentity();
        if (w[0].state == S_ENTER || w[1].state == S_ENTER) {
            W *p = (w[0].state == S_ENTER) ? &w[0] : &w[1];
            float py = MAT_Y + p->base + 1.4f;
            cam_follow(p->x + 1.3f, py + 2.1f, p->z + 3.4f, p->x, py - 0.1f, p->z, 0.06f);
        } else if (ref.state == S_COVER) {
            W *pn = (w[0].state == S_PINNED) ? &w[0] : &w[1];
            cam_follow(pn->x + 2.4f, MAT_Y + 1.6f, pn->z + 2.8f, pn->x, MAT_Y + 0.3f, pn->z, 0.05f);
        } else {
            float mx = (w[0].x + w[1].x) * 0.5f, mz = (w[0].z + w[1].z) * 0.5f;
            float sep = dist(&w[0], &w[1]);
            float lx = w[1].x - w[0].x, lz = w[1].z - w[0].z;
            if (sep < 0.01f) { lx = 1; lz = 0; sep = 0.01f; }
            float px = -lz / sep, pz = lx / sep;         // perpendicular to the wrestlers' line
            if (pz < 0) { px = -px; pz = -pz; }          // keep the hard-cam side of the ring
            static float spx = 0, spz = 1;
            spx += (px - spx) * 0.02f; spz += (pz - spz) * 0.02f;
            float n = sqrtf(spx * spx + spz * spz); float ux = spx / n, uz = spz / n;
            float back = 4.0f + sep * 0.9f;
            cam_follow(mx + ux * back, 4.2f + sep * 0.3f, mz + uz * back, mx, MAT_Y + 0.7f, mz, 0.05f);
        }
        draw_scene();
        draw_people();
        draw_cage();
        glFlush(0);
        swiWaitForVBlank();
        bars();
    }
    bgm_stop();
    if (theme >= 0) soundKill(theme);
    match_type = MT_SINGLES;
    return won;
}

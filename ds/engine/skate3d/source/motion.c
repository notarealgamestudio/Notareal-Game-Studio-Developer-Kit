#include "motion.h"
#include <math.h>
#include <string.h>
#include <stdlib.h>
#define NJ ((int)(sizeof(Pose) / sizeof(float)))
// joint index -> chain depth 0..3 (core, upper limb, lower limb, extremity). Pose layout: px py pz body torso head sh[2] roll[2] el[2] hip[2] hroll[2] kn[2]
static const unsigned char DEPTH[] = { 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 2, 0, 0, 0 };
#define NJB 18
static const float DEG_S = 30.0f;               // library speeds are degrees per animation frame at 30 fps
static float rnd1(void) { return (rand() & 255) / 127.5f - 1.0f; }
void motion_reset(Motion *m) { memset(m, 0, sizeof *m); }
void motion_hit(Motion *m, float force)
{
    if (m->mass > 0.2f) force /= sqrtf(m->mass);              // heavier bodies whip less
    m->impact = force;
    // arms and head whip away from the blow, torso folds: the real clips peak fastest on the extremities
    for (int i = 5; i < NJB; i++) m->v[i] += rnd1() * force * (DEPTH[i] >= 2 ? 260.0f : 140.0f);
    m->v[4] += force * 120.0f; m->v[2] += rnd1() * force * 0.4f;
}
void motion_fall(Motion *m, float height, float speed)
{
    m->by = height; m->bv = -speed; m->impact = 1.0f; m->limp = 1.0f;     // knocked down: limbs go slack
    for (int i = 6; i < NJB; i++) m->v[i] += rnd1() * 220.0f;   // limbs flail on the way down
}
void motion_step(Motion *m, const Pose *tg, int cls, Pose *out)
{
    const float *t = (const float *)tg; float *c = m->cur; float dt = 1.0f / 60.0f;
    if (!m->init) { memcpy(c, t, sizeof(Pose)); m->init = 1; }
    if (cls < 0 || cls >= MC_N) cls = MC_IDLE;
    const MotCls *k = &MOTLIB[cls];
    if (cls != m->lastcls) { m->lastcls = cls; m->clst = 0; } else m->clst++;
    // speed limit: the fastest limb in real clips of this class (x1.8 headroom); stiffness grows with the class's speed
    float vmax = k->peak * DEG_S * 1.8f;
    // anticipation/active/recovery: motion eases in until the class's peak moment, then releases (profile from the clips)
    float ph = (float)m->clst / (k->frames > 1 ? k->frames * 2.0f : 60.0f); if (ph > 1) ph = 1;
    int bin = (int)(ph * 7.99f); float act = 0.6f + k->prof[bin] * 6.0f; if (act > 2.2f) act = 2.2f;
    for (int i = 0; i < NJ; i++) {
        int d = DEPTH[i];
        // stiffness falls down the chain (hips/torso lead, hands lag) using the class's measured joint timing
        float w0 = (i < 3 ? 16.0f : 13.0f) * (1.0f - 0.10f * d) * (0.7f + 0.3f * act);
        if (m->phys) { float ms = m->mass > 0.2f ? m->mass : 1.0f; w0 /= sqrtf(sqrtf(ms)); w0 *= (1.0f - 0.72f * m->limp) * (1.0f - 0.25f * m->tired); }   // heavy / limp / tired = slower springs
        float zeta = cls == MC_STRIKE || cls == MC_KICK || cls == MC_AERIAL ? 0.55f : cls == MC_IDLE ? 0.95f : 0.72f; // < 1 = overshoot = follow-through
        if (m->phys && m->limp > 0.05f && i >= 6 && i < NJB) zeta *= 0.55f;   // slack limbs swing on
        float a = w0 * w0 * (t[i] - c[i]) - 2 * zeta * w0 * m->v[i];
        m->v[i] += a * dt;
        float lim = (i < 3) ? 6.0f : vmax; if (m->v[i] > lim) m->v[i] = lim; if (m->v[i] < -lim) m->v[i] = -lim;
        c[i] += m->v[i] * dt;
    }
    // ballistic drop with bounce (gravity, restitution ~0.28 from the slam/bump clips' vertical-speed ratio)
    if (m->by > 0 || m->bv != 0) {
        m->bv -= 9.8f * dt; m->by += m->bv * dt;
        if (m->by < 0) { m->by = 0; if (m->bv < -0.9f) { m->squat = fminf(1.0f, -m->bv * 0.35f); m->bv = -m->bv * 0.28f; for (int i = 6; i < NJB; i++) m->v[i] += rnd1() * 90.0f; } else m->bv = 0; }
    }
    memcpy(out, c, sizeof(Pose));
    out->py += m->by;
    if (m->phys) {
        // momentum lean and bank, landing squat, fatigue slouch, head counter-rotates so the eyes stay level
        out->torso += m->lean + m->tired * 9.0f; out->bank += m->bank; out->hipy += m->bank * 0.4f; out->head += m->tired * 8.0f - (m->lean + out->torso * 0.0f) * 0.4f;
        float sq = m->squat; if (sq > 0.01f) { out->kn[0] += sq * 38.0f; out->kn[1] += sq * 38.0f; out->hip[0] += sq * 18.0f; out->hip[1] += sq * 18.0f; out->torso += sq * 14.0f; out->py -= sq * 0.10f; }
        out->sh[0] -= m->lean * 0.5f; out->sh[1] -= m->lean * 0.5f;                              // arms trail the torso
        m->squat *= 0.90f; if (cls != MC_FALL && m->limp > 0) { m->limp -= 0.012f; if (m->limp < 0) m->limp = 0; }
        if (cls == MC_FALL && m->by <= 0 && m->limp < 0.35f) m->limp = 0.35f;                    // stays loose while down
    }
    // weight shift: breathing and balance sway while standing
    if (cls == MC_IDLE) { out->torso += sinf(frame * 0.05f) * 0.8f; out->px += sinf(frame * 0.03f) * 0.004f; }
    if (m->impact > 0) m->impact -= 0.04f; else m->impact = 0;
}

void motion_phys(Motion *m, float x, float z, float yawdeg, float mass, float tired)
{
    if (mass > 0.2f) m->mass = mass; m->tired = tired < 0 ? 0 : tired > 1 ? 1 : tired;
    if (!m->phys) { m->phys = 1; m->prevx = x; m->prevz = z; m->prevyaw = yawdeg; m->vf = m->vs = m->lastvf = 0; return; }
    float yr = yawdeg * 0.0174533f, fx = sinf(yr), fz = cosf(yr);
    float dx = (x - m->prevx) * 60.0f, dz = (z - m->prevz) * 60.0f;                    // m/s
    float yd = yawdeg - m->prevyaw; while (yd > 180) yd -= 360; while (yd < -180) yd += 360;
    m->prevx = x; m->prevz = z; m->prevyaw = yawdeg;
    float vf = dx * fx + dz * fz, vs = dx * fz - dz * fx;
    m->vf += (vf - m->vf) * 0.25f; m->vs += (vs - m->vs) * 0.25f;
    float af = (m->vf - m->lastvf) * 60.0f; m->lastvf = m->vf;                         // m/s^2 along the facing
    float ms = m->mass > 0.2f ? m->mass : 1.0f, rootm = sqrtf(ms);
    float tl = m->vf * 1.6f + af * 0.9f * rootm; if (tl > 16) tl = 16; if (tl < -10) tl = -10;
    float tb = -yd * m->vf * 0.55f - m->vs * 2.0f; if (tb > 9) tb = 9; if (tb < -9) tb = -9;
    m->lean += (tl - m->lean) * 0.12f; m->bank += (tb - m->bank) * 0.12f;
    if (af < -7.0f && m->squat < 0.25f) m->squat = 0.25f;                                // hard brake: sink into the knees
}
void motion_hit_dir(Motion *m, float force, float bx, float bz, float yawdeg)
{
    float yr = yawdeg * 0.0174533f, fx = sinf(yr), fz = cosf(yr), L = sqrtf(bx * bx + bz * bz); if (L < 1e-4f) { motion_hit(m, force); return; }
    bx /= L; bz /= L; float bf = bx * fx + bz * fz, bs = bx * fz - bz * fx, ms = m->mass > 0.2f ? m->mass : 1.0f, k = force / sqrtf(ms);
    motion_hit(m, force * 0.6f);
    m->v[5] += bf * k * 300.0f;                       // head snaps along the blow
    m->v[4] += bf * k * 180.0f;                       // torso folds with it
    m->v[20] += bs * k * 150.0f;                      // sideways roll
    m->v[6] += bf * k * 220.0f; m->v[7] += bf * k * 220.0f;   // arms swing
    m->v[0] += bs * k * 1.2f; m->v[2] += bf * k * 1.2f;       // pelvis shoved
    if (force > 0.7f) m->limp = fmaxf(m->limp, 0.5f);
}

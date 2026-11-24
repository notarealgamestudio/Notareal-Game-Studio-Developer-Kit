#pragma once
#include "icw.h"
#include "motion_lib.h"
// Motion layer: sits between the match logic (target poses) and draw_wrestler. Limb speeds, overshoot and
// follow-through come from measurements of real wrestling animation (motion_lib.h); falls use gravity + bounce.
typedef struct { float v[sizeof(Pose) / sizeof(float)], cur[sizeof(Pose) / sizeof(float)]; int init, cls, lastcls, clst; float by, bv, impact, lastpy;
    // body physics (v1.16): mass, momentum lean, directed hits, limp ragdoll fall, landing squat, fatigue slouch
    float mass, limp, squat, tired, lean, bank, vf, vs, prevx, prevz, prevyaw, lastvf, hitf, hits; int phys; } Motion;
void motion_reset(Motion *m);
void motion_hit(Motion *m, float force);                      // call when a blow lands: limbs whip, body jolts
void motion_fall(Motion *m, float height, float speed);      // call when thrown/knocked down: ballistic drop + bounce
void motion_phys(Motion *m, float x, float z, float yawdeg, float mass, float tired);   // call every frame before motion_step: velocity -> lean / bank / squat
void motion_hit_dir(Motion *m, float force, float blowx, float blowz, float yawdeg);    // blow travel direction in world space: head snaps, torso folds, arms swing the right way
void motion_step(Motion *m, const Pose *target, int cls, Pose *out);

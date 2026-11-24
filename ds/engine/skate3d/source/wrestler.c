// ICW character model: lit, jointed figures built from smooth lathed segments on the shared 15-joint rig,
// with photo-textured heads. Two levels of detail are baked per character (near / far).
#include "icw.h"

int wr_lod;                 // set to 1 before draw_wrestler() for distant characters
static int LOD;
static float XS = 1, ZS = 1;

static void mat_col(u16 c)
{
    int r = c & 31, g = (c >> 5) & 31, b = (c >> 10) & 31;
    DIFAMB(c, RGB15(r * 2 / 5, g * 2 / 5, b * 2 / 5));
}
static inline void N(float x, float y, float z) { NRM(NORMAL_PACK(floattov10(x), floattov10(y), floattov10(z))); }
static inline void tr(float x, float y, float z) { glTranslatef(x * SC, y * SC, z * SC); }

typedef struct { float y, rx, rz, oz; } Ring;

// Smooth-shaded tube through a list of elliptical rings (x radius, z radius, forward offset).
static void lathe(const Ring *r, int n, u16 col, float k)
{
    int SEG = LOD ? 5 : 8;
    mat_col(col);
    BEGIN(GL_QUADS);
    for (int i = 0; i < n - 1; i++)
        for (int s = 0; s < SEG; s++) {
            float a0 = s * 6.2832f / SEG, a1 = (s + 1) * 6.2832f / SEG;
            float s0 = sinf(a0), c0 = cosf(a0), s1 = sinf(a1), c1 = cosf(a1);
            N(s0 * 0.97f, 0, c0 * 0.97f); V(s0 * r[i].rx * XS * k, r[i].y, r[i].oz + c0 * r[i].rz * ZS * k);
            N(s1 * 0.97f, 0, c1 * 0.97f); V(s1 * r[i].rx * XS * k, r[i].y, r[i].oz + c1 * r[i].rz * ZS * k);
            N(s1 * 0.97f, 0, c1 * 0.97f); V(s1 * r[i + 1].rx * XS * k, r[i + 1].y, r[i + 1].oz + c1 * r[i + 1].rz * ZS * k);
            N(s0 * 0.97f, 0, c0 * 0.97f); V(s0 * r[i + 1].rx * XS * k, r[i + 1].y, r[i + 1].oz + c0 * r[i + 1].rz * ZS * k);
        }
    END();
}

static void lbox(float x0, float y0, float z0, float x1, float y1, float z1, u16 col)
{
    x0 *= XS; x1 *= XS;
    mat_col(col);
    BEGIN(GL_QUADS);
    N(0, 0.99f, 0);  V(x0, y1, z0); V(x1, y1, z0); V(x1, y1, z1); V(x0, y1, z1);
    N(0, -0.99f, 0); V(x0, y0, z0); V(x1, y0, z0); V(x1, y0, z1); V(x0, y0, z1);
    N(0, 0, 0.99f);  V(x0, y0, z1); V(x1, y0, z1); V(x1, y1, z1); V(x0, y1, z1);
    N(0, 0, -0.99f); V(x0, y0, z0); V(x1, y0, z0); V(x1, y1, z0); V(x0, y1, z0);
    N(-0.99f, 0, 0); V(x0, y0, z0); V(x0, y0, z1); V(x0, y1, z1); V(x0, y1, z0);
    N(0.99f, 0, 0);  V(x1, y0, z0); V(x1, y0, z1); V(x1, y1, z1); V(x1, y1, z0);
    END();
}

// Head: an ellipsoid lathe wrapped with the character's face map (photo wraps are 128x128, painted ones 64x64).
static void head(const Look *lk)
{
    const int SEG = LOD ? 8 : 12, RING = LOD ? 4 : 8;
    const float H = 0.27f, RX = 0.094f, RZ = 0.106f;
    const int TS = lk->face2x ? 2 : 1;
    float xs = XS, zs = ZS; XS = ZS = 1;
    BIND(lk->faceTex);
    mat_col(RGB15(31, 31, 31));
    BEGIN(GL_QUADS);
    for (int r = 0; r < RING; r++) {
        float y0 = H * r / RING, y1 = H * (r + 1) / RING, k0, k1;
        { float t = (y0 - 0.135f) / 0.140f; k0 = sqrtf(1 - t * t); if (y0 < 0.07f) k0 *= 0.78f + y0 * 3.1f; }
        { float t = (y1 - 0.135f) / 0.140f; k1 = sqrtf(1 - t * t); if (y1 < 0.07f) k1 *= 0.78f + y1 * 3.1f; }
        if (r == RING - 1) k1 = 0.18f;
        for (int s = 0; s < SEG; s++) {
            float a0 = (s / (float)SEG) * 6.2832f - 3.1416f, a1 = ((s + 1) / (float)SEG) * 6.2832f - 3.1416f;
            float sa0 = sinf(a0), ca0 = cosf(a0), sa1 = sinf(a1), ca1 = cosf(a1);
            int u0 = s * 64 / SEG * TS, u1 = (s + 1) * 64 / SEG * TS;
            int v0 = (int)(64 - y0 / H * 64) * TS, v1 = (int)(64 - y1 / H * 64) * TS;
            N(sa0 * 0.9f, (y0 - 0.135f) * 3, ca0 * 0.9f); T(u0, v0); V(sa0 * RX * k0, y0, ca0 * RZ * k0);
            N(sa1 * 0.9f, (y0 - 0.135f) * 3, ca1 * 0.9f); T(u1, v0); V(sa1 * RX * k0, y0, ca1 * RZ * k0);
            N(sa1 * 0.9f, (y1 - 0.135f) * 3, ca1 * 0.9f); T(u1, v1); V(sa1 * RX * k1, y1, ca1 * RZ * k1);
            N(sa0 * 0.9f, (y1 - 0.135f) * 3, ca0 * 0.9f); T(u0, v1); V(sa0 * RX * k1, y1, ca0 * RZ * k1);
        }
    }
    END();
    BIND(0);
    if (!lk->face2x) lbox(-0.011f, 0.086f, 0.098f, 0.011f, 0.128f, 0.117f, lk->skin);
    if (!lk->face2x && lk->goatee) lbox(-0.028f, 0.005f, 0.088f, 0.028f, 0.058f, 0.112f, lk->hair);
    static const Ring HAWK[3] = { { 0.21f, 0.026f, 0.090f, 0 }, { 0.29f, 0.018f, 0.074f, 0 }, { 0.31f, 0.004f, 0.02f, 0 } };
    static const Ring TOP[3] = { { 0.20f, 0.090f, 0.102f, -0.004f }, { 0.265f, 0.070f, 0.084f, -0.006f }, { 0.288f, 0.02f, 0.03f, -0.008f } };
    static const Ring BACK[3] = { { 0.21f, 0.074f, 0.030f, -0.094f }, { 0.02f, 0.060f, 0.026f, -0.100f }, { -0.14f, 0.040f, 0.018f, -0.104f } };
    static const Ring LONG[4] = { { 0.24f, 0.098f, 0.040f, -0.080f }, { 0.08f, 0.108f, 0.046f, -0.086f }, { -0.10f, 0.100f, 0.038f, -0.090f }, { -0.20f, 0.070f, 0.02f, -0.092f } };
    static const Ring FLONG[4] = { { 0.24f, 0.102f, 0.044f, -0.078f }, { 0.06f, 0.118f, 0.052f, -0.084f }, { -0.16f, 0.110f, 0.042f, -0.090f }, { -0.30f, 0.070f, 0.02f, -0.094f } };
    static const Ring PONY[4] = { { 0.24f, 0.030f, 0.030f, -0.11f }, { 0.20f, 0.040f, 0.040f, -0.14f }, { 0.02f, 0.034f, 0.030f, -0.15f }, { -0.14f, 0.012f, 0.012f, -0.14f } };
    static const Ring BUN[3] = { { 0.25f, 0.030f, 0.030f, -0.045f }, { 0.31f, 0.044f, 0.044f, -0.050f }, { 0.36f, 0.02f, 0.02f, -0.050f } };
    static const Ring VOL[3] = { { 0.16f, 0.100f, 0.112f, -0.008f }, { 0.25f, 0.086f, 0.096f, -0.010f }, { 0.285f, 0.03f, 0.04f, -0.010f } };
    switch (lk->hairstyle) {
    case HAIR_MOHAWK: lathe(HAWK, 3, lk->hair, 1); lathe(BACK, 3, lk->hair2, 1); break;
    case HAIR_MULLET: lathe(TOP, 3, lk->hair, 1); lathe(BACK, 3, lk->hair2, 1); break;
    case HAIR_LONG: lathe(lk->fem ? FLONG : LONG, 4, lk->hair, 1); break;
    case HAIR_PONY: lathe(PONY, 4, lk->hair, 1); break;
    case HAIR_BUN: if (!lk->face2x) lathe(VOL, 3, lk->hair, 1); lathe(BUN, 3, lk->hair, 1); break;
    case HAIR_CURLY: {                                   // short curls: a full cap covered in little lumps, two shades
        static const Ring CAP[3] = { { 0.15f, 0.104f, 0.116f, -0.010f }, { 0.25f, 0.092f, 0.102f, -0.012f }, { 0.300f, 0.036f, 0.046f, -0.012f } };
        lathe(CAP, 3, lk->hair, 1);
        const int rows = LOD ? 2 : 4;
        for (int r = 0; r < rows; r++) {
            float y = 0.165f + r * (LOD ? 0.06f : 0.035f);
            float k = 1.0f - (y - 0.15f) * (y - 0.15f) * 28.0f; if (k < 0.35f) k = 0.35f;
            int n = LOD ? 7 : 12 - r * 2;
            for (int i = 0; i < n; i++) {
                float a = (i + 0.5f * (r & 1)) * 6.2832f / n;
                float sa = sinf(a), ca = cosf(a);
                if (ca > 0.55f && y < 0.215f) continue;      // keep the forehead clear
                float cx = sa * 0.104f * k, cz = ca * 0.114f * k - 0.012f, sz = LOD ? 0.026f : 0.019f;
                lbox(cx - sz, y - sz, cz - sz, cx + sz, y + sz, cz + sz, ((i + r) & 1) ? lk->hair2 : lk->hair);
            }
        }
        if (!LOD) lbox(-0.03f, 0.30f, -0.03f, 0.03f, 0.318f, 0.02f, lk->hair2);
        break;
    }
    default: break;
    }
    XS = xs; ZS = zs;
}

enum { DL_PELVIS, DL_THIGH, DL_SHIN, DL_TORSO, DL_UPPER, DL_FORE, DL_HEAD, DL_N };

static void build_parts(Look *lk, const u32 **dl)
{
    int f = lk->fem;
    float lk_l = 1 + (lk->build - 1) * 0.7f;                  // limbs thicken less than the trunk
    XS = lk->build; ZS = 1 + (lk->build - 1) * 0.6f;

    rec_begin();
    { static const Ring M[3] = { { 0.08f, 0.150f, 0.105f, 0 }, { -0.03f, 0.164f, 0.116f, -0.004f }, { -0.15f, 0.110f, 0.098f, 0 } };
      static const Ring F[3] = { { 0.08f, 0.122f, 0.094f, 0 }, { -0.04f, 0.176f, 0.124f, -0.012f }, { -0.15f, 0.118f, 0.104f, -0.004f } };
      lathe(f ? F : M, 3, lk->pants, 1); }
    dl[DL_PELVIS] = rec_end();

    rec_begin();
    { static const Ring M[3] = { { 0.03f, 0.088f, 0.094f, 0 }, { -0.16f, 0.086f, 0.092f, 0.004f }, { -0.44f, 0.060f, 0.064f, 0 } };
      static const Ring F[3] = { { 0.03f, 0.094f, 0.100f, -0.004f }, { -0.15f, 0.086f, 0.094f, 0 }, { -0.44f, 0.054f, 0.058f, 0 } };
      lathe(f ? F : M, 3, lk->pants, lk_l / XS); }
    dl[DL_THIGH] = rec_end();

    rec_begin();
    { static const Ring M[3] = { { 0, 0.060f, 0.064f, 0 }, { -0.13f, 0.064f, 0.072f, -0.010f }, { -0.30f, 0.048f, 0.052f, 0 } };
      static const Ring F[3] = { { 0, 0.054f, 0.058f, 0 }, { -0.13f, 0.056f, 0.064f, -0.010f }, { -0.30f, 0.042f, 0.046f, 0 } };
      static const Ring B[3] = { { -0.28f, 0.056f, 0.060f, 0 }, { -0.40f, 0.054f, 0.060f, 0.004f }, { -0.44f, 0.056f, 0.064f, 0.01f } };
      lathe(f ? F : M, 3, lk->pants, lk_l / XS); lathe(B, 3, lk->boots, (f ? 0.9f : 1) * lk_l / XS);
      lbox(-0.054f, -0.50f, -0.065f, 0.054f, -0.43f, 0.15f, lk->boots); }
    dl[DL_SHIN] = rec_end();

    rec_begin();
    { static const Ring M[6] = { { 0, 0.150f, 0.105f, 0 }, { 0.14f, 0.150f, 0.106f, 0.004f }, { 0.30f, 0.174f, 0.118f, 0.008f },
                                 { 0.44f, 0.196f, 0.126f, 0.010f }, { 0.52f, 0.186f, 0.108f, 0 }, { 0.565f, 0.070f, 0.060f, 0 } };
      static const Ring F[6] = { { 0, 0.124f, 0.094f, 0 }, { 0.12f, 0.108f, 0.086f, 0 }, { 0.27f, 0.134f, 0.100f, 0.010f },
                                 { 0.40f, 0.148f, 0.122f, 0.034f }, { 0.50f, 0.150f, 0.098f, 0.004f }, { 0.565f, 0.060f, 0.054f, 0 } };
      static const Ring NK[2] = { { 0.54f, 0.056f, 0.052f, 0.004f }, { 0.64f, 0.050f, 0.048f, 0.006f } };
      static const Ring NF[2] = { { 0.54f, 0.046f, 0.044f, 0.004f }, { 0.64f, 0.042f, 0.042f, 0.006f } };
      const Ring *t = f ? F : M;
      u16 belly = lk->overalls ? lk->pants : lk->top;
      lathe(t, 3, belly, 1);
      if (lk->stripes) { lathe(t + 2, 2, lk->accent, 1); lathe(t + 3, 3, lk->top, 1); }
      else lathe(t + 2, 4, lk->top, 1);
      if (lk->vest) {                                           // open work vest with a name tag
          static const Ring VS[4] = { { 0.02f, 0.160f, 0.112f, -0.004f }, { 0.30f, 0.184f, 0.126f, 0.002f }, { 0.44f, 0.204f, 0.132f, 0.004f }, { 0.53f, 0.19f, 0.112f, -0.004f } };
          float xs = XS; lathe(VS, 4, lk->accent, 1); XS = xs;
          lbox(-0.05f, 0.04f, 0.10f, 0.05f, 0.50f, 0.142f, lk->top);
          lbox(0.07f, 0.36f, 0.125f, 0.13f, 0.40f, 0.146f, RGB15(31, 31, 31));
      }
      if (lk->overalls) {
          lbox(-0.11f, 0.20f, 0.08f, 0.11f, 0.40f, 0.128f, lk->pants);
          lbox(-0.10f, 0.38f, 0.07f, -0.06f, 0.53f, 0.126f, lk->pants); lbox(0.06f, 0.38f, 0.07f, 0.10f, 0.53f, 0.126f, lk->pants);
          lbox(-0.105f, 0.36f, 0.12f, -0.07f, 0.395f, 0.134f, lk->accent); lbox(0.07f, 0.36f, 0.12f, 0.105f, 0.395f, 0.134f, lk->accent);
      } else if (lk->accent != lk->top && !lk->stripes && !lk->vest && !LOD)
          lbox(-0.07f, 0.30f, f ? 0.125f : 0.112f, 0.07f, 0.40f, f ? 0.14f : 0.126f, lk->accent);
      lathe(f ? NF : NK, 2, lk->skin, 1); }
    dl[DL_TORSO] = rec_end();

    float as = (f ? 0.80f : 1.0f) * lk_l / XS;
    rec_begin();
    { static const Ring S[3] = { { 0.045f, 0.050f, 0.052f, 0 }, { -0.02f, 0.070f, 0.068f, 0 }, { -0.13f, 0.060f, 0.058f, 0 } };
      static const Ring A[2] = { { -0.13f, 0.056f, 0.055f, 0 }, { -0.30f, 0.045f, 0.045f, 0 } };
      lathe(S, 3, lk->sleeveless ? lk->skin : lk->top, as); lathe(A, 2, lk->skin, as); }
    dl[DL_UPPER] = rec_end();

    rec_begin();
    { static const Ring A[3] = { { 0, 0.045f, 0.045f, 0 }, { -0.08f, 0.048f, 0.046f, 0 }, { -0.26f, 0.034f, 0.032f, 0 } };
      lathe(A, 3, lk->skin, as);
      lbox(-0.032f * as, -0.36f, -0.018f, 0.032f * as, -0.26f, 0.042f, lk->skin); }
    dl[DL_FORE] = rec_end();

    rec_begin();
    head(lk);
    BIND(0);
    dl[DL_HEAD] = rec_end();
    XS = ZS = 1;
}

// lodonly: background characters (fans, shop staff) only get the far model, which saves memory.
void build_look2(Look *lk, int lodonly)
{
    LOD = 1; build_parts(lk, lk->dl + 8);
    if (lodonly) for (int i = 0; i < DL_N; i++) lk->dl[i] = lk->dl[8 + i];
    else { LOD = 0; build_parts(lk, lk->dl); }
    LOD = 0;
}
void build_look(Look *lk) { build_look2(lk, 0); }

static void arm(const Look *lk, const u32 *const *dl, int side, const Pose *p)
{
    float sx = (side ? -1 : 1) * (lk->fem ? 0.172f : 0.218f);
    glPushMatrix();
    tr(sx * lk->build, 0.47f, 0);
    glRotateZ(side ? -p->roll[side] : p->roll[side]);
    glRotateX(-p->sh[side]);
    glCallList(dl[DL_UPPER]);
    tr(0, -0.30f, 0);
    glRotateX(-p->el[side]);
    glCallList(dl[DL_FORE]);
    glPopMatrix(1);
}

static void leg(const Look *lk, const u32 *const *dl, int side, const Pose *p)
{
    float sx = (side ? -1 : 1) * (lk->fem ? 0.090f : 0.092f);
    glPushMatrix();
    tr(sx * lk->build, -0.08f, 0);
    glRotateZ(side ? -p->hroll[side] : p->hroll[side]);
    glRotateX(-p->hip[side]);
    glCallList(dl[DL_THIGH]);
    tr(0, -0.44f, 0);
    glRotateX(p->kn[side]);
    glCallList(dl[DL_SHIN]);
    glPopMatrix(1);
}

void draw_wrestler(const Look *lk, float x, float z, float yaw, const Pose *p, int polyid)
{
    if (!lk->dl[0]) build_look((Look *)lk);
    const u32 *const *dl = lk->dl + (wr_lod ? 8 : 0);
    glPolyFmt(POLY_ALPHA(31) | POLY_CULL_NONE | POLY_FORMAT_LIGHT0 | POLY_FORMAT_LIGHT1 | POLY_ID(polyid));
    glBindTexture(0, 0);
    glPushMatrix();
    float h = lk->height;
    tr(x, MAT_Y + 1.02f * h, z);
    glRotateY(yaw);
    tr(p->px, p->py, p->pz);
    glRotateZ(p->bank);
    glRotateY(p->hipy);
    glRotateX(p->body);
    glScalef(h, h, h);
    glCallList(dl[DL_PELVIS]);
    leg(lk, dl, 0, p);
    leg(lk, dl, 1, p);
    glPushMatrix();
    tr(0, 0.06f, 0);
    glRotateY(p->twist);
    glRotateX(p->torso);
    glCallList(dl[DL_TORSO]);
    arm(lk, dl, 0, p);
    arm(lk, dl, 1, p);
    glPushMatrix();
    tr(0, 0.60f, 0.005f);
    glRotateX(p->head);
    glCallList(dl[DL_HEAD]);
    glPopMatrix(1);
    glPopMatrix(1);
    glPopMatrix(1);
}

void pose_lerp(Pose *o, const Pose *a, const Pose *b, float t)
{
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    t = t * t * (3 - 2 * t);
    const float *fa = (const float *)a, *fb = (const float *)b;
    float *fo = (float *)o;
    for (unsigned i = 0; i < sizeof(Pose) / sizeof(float); i++)
        fo[i] = fa[i] + (fb[i] - fa[i]) * t;
}

void lights_on(void)
{
    glLight(0, RGB15(31, 29, 25), floattov10(-0.35f), floattov10(-0.85f), floattov10(-0.40f));
    glLight(1, RGB15(9, 11, 18), floattov10(0.5f), floattov10(-0.2f), floattov10(0.8f));
    glMaterialf(GL_SPECULAR, RGB15(4, 4, 4));
    glMaterialf(GL_EMISSION, RGB15(1, 1, 2));
}

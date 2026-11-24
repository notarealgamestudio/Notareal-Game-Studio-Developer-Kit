// ICW arena: ring, crowd, stage and lighting rig drawn on the DS 3D engine.
#include "icw.h"

// World units are metres; the DS vertex format tops out near +/-8, so everything is scaled by 1/4.

int tMat, tApron, tCrowd, tFloor, tTron;
u32 frame;

// Textures are 16-bit, or paletted (tools/pal_convert.py: 'PT' header, 4/8 bpp) to save texture VRAM.
int tex_fail;                                       // count of uploads that found no VRAM (debug)
int load_tex(const void *data, int w, int h, int repeat)
{
    int id;
    glGenTextures(1, &id);
    BIND(id);
    int wrap = TEXGEN_TEXCOORD | (repeat ? (GL_TEXTURE_WRAP_S | GL_TEXTURE_WRAP_T) : 0), ok;
    const u8 *b = data;
    if (b[0] == 'P' && b[1] == 'T') {
        int bpp = b[2], n = bpp == 8 ? 256 : 16;
        if (b[3] & 1) wrap |= GL_TEXTURE_COLOR0_TRANSPARENT;
        ok = glTexImage2D(0, 0, bpp == 8 ? GL_RGB256 : GL_RGB16, w, h, 0, wrap, b + 4 + n * 2);
        glColorTableEXT(0, 0, n, 0, 0, (const u16 *)(b + 4));
    } else ok = glTexImage2D(0, 0, GL_RGBA, w, h, 0, wrap, data);
    if (!ok) tex_fail++;
    return id;
}

// Upload a runtime-painted 16-bit texture as 8-bit paletted when it has <= 256 colours (half the VRAM).
int load_tex_pal(const u16 *px, int w, int h, int repeat)
{
    static u16 pal[256] ALIGN(4);
    static u8 idx[64 * 64] ALIGN(4);
    if (w * h > (int)sizeof idx) return load_tex(px, w, h, repeat);
    int n = 0;
    for (int i = 0; i < w * h; i++) {
        u16 c = px[i] | BIT(15); int k = 0;
        while (k < n && pal[k] != c) k++;
        if (k == n) { if (n == 256) return load_tex(px, w, h, repeat); pal[n++] = c; }
        idx[i] = k;
    }
    int id;
    glGenTextures(1, &id);
    BIND(id);
    DC_FlushRange(idx, sizeof idx); DC_FlushRange(pal, sizeof pal);
    if (!glTexImage2D(0, 0, GL_RGB256, w, h, 0, TEXGEN_TEXCOORD | (repeat ? (GL_TEXTURE_WRAP_S | GL_TEXTURE_WRAP_T) : 0), idx)) tex_fail++;
    glColorTableEXT(0, 0, 256, 0, 0, pal);
    return id;
}

int load_face(const void *bin)
{
    int id;
    glGenTextures(1, &id);
    glBindTexture(0, id);
    if (!glTexImage2D(0, 0, GL_RGB256, 128, 128, 0, TEXGEN_TEXCOORD | GL_TEXTURE_WRAP_S | GL_TEXTURE_WRAP_T, (const u8 *)bin + 512)) tex_fail++;
    glColorTableEXT(0, 0, 256, 0, 0, (const u16 *)bin);
    return id;
}

void poly(int alpha, int id) { PFMT(POLY_ALPHA(alpha) | POLY_CULL_NONE | POLY_ID(id)); }

// Untextured box with simple face shading.
void box(float x0, float y0, float z0, float x1, float y1, float z1, int r, int g, int b)
{
    BIND(0);
    BEGIN(GL_QUADS);
    C(r, g, b);           V(x0, y1, z0); V(x1, y1, z0); V(x1, y1, z1); V(x0, y1, z1);   // top
    C(r*3/4, g*3/4, b*3/4); V(x0, y0, z1); V(x1, y0, z1); V(x1, y1, z1); V(x0, y1, z1); // front
    V(x0, y0, z0); V(x1, y0, z0); V(x1, y1, z0); V(x0, y1, z0);                         // back
    C(r*3/5, g*3/5, b*3/5); V(x0, y0, z0); V(x0, y0, z1); V(x0, y1, z1); V(x0, y1, z0); // sides
    V(x1, y0, z0); V(x1, y0, z1); V(x1, y1, z1); V(x1, y1, z0);
    END();
}


// Spotlit canvas: an 8x8 grid so the vertex colours can fake a pool of light on the mat.
static void draw_mat(void)
{
    BIND(tMat);
    BEGIN(GL_QUADS);
    const int N = 8;
    for (int j = 0; j < N; j++)
        for (int i = 0; i < N; i++) {
            int ii[4] = { i, i + 1, i + 1, i }, jj[4] = { j, j, j + 1, j + 1 };
            for (int k = 0; k < 4; k++) {
                float u = ii[k] / (float)N, w = jj[k] / (float)N;
                float dx = u - 0.5f, dz = w - 0.5f;
                int l = 255 - (int)((dx * dx + dz * dz) * 300);
                C(l, l, l - 6);
                T((int)(u * 128), (int)(w * 128));
                V(-HALF + u * 2 * HALF, MAT_Y, -HALF + w * 2 * HALF);
            }
        }
    END();
}

static void draw_apron(void)
{
    BIND(tApron);
    BEGIN(GL_QUADS);
    float h = HALF + 0.05f;
    for (int s = 0; s < 4; s++) {
        float ax, az, bx, bz;
        if (s == 0) { ax = -h; az = h; bx = h; bz = h; }
        else if (s == 1) { ax = h; az = h; bx = h; bz = -h; }
        else if (s == 2) { ax = h; az = -h; bx = -h; bz = -h; }
        else { ax = -h; az = -h; bx = -h; bz = h; }
        int l = (s == 0) ? 255 : 170;
        C(l, l, l); T(0, 0);   V(ax, MAT_Y, az);
        C(l, l, l); T(256, 0); V(bx, MAT_Y, bz);
        C(l/2, l/2, l/2); T(256, 32); V(bx, 0, bz);
        C(l/2, l/2, l/2); T(0, 32);   V(ax, 0, az);
    }
    END();
}

static void draw_ropes(void)
{
    static const u8 col[3][3] = { { 220, 30, 40 }, { 245, 245, 245 }, { 40, 70, 220 } };
    float t = 0.045f, e = HALF - 0.05f;
    for (int r = 0; r < 3; r++) {
        float y = MAT_Y + 0.45f + r * 0.42f;
        int R = col[r][0], G = col[r][1], B = col[r][2];
        box(-e, y, e - t, e, y + t * 2, e + t, R, G, B);
        box(-e, y, -e - t, e, y + t * 2, -e + t, R, G, B);
        box(-e - t, y, -e, -e + t, y + t * 2, e, R, G, B);
        box(e - t, y, -e, e + t, y + t * 2, e, R, G, B);
        for (int c = 0; c < 4; c++) {               // turnbuckle pads
            float cx = (c & 1) ? e : -e, cz = (c & 2) ? e : -e;
            int pr = (c == 1 || c == 2) ? 200 : 30, pb = (c == 1 || c == 2) ? 30 : 200;
            box(cx - 0.12f, y - 0.07f, cz - 0.12f, cx + 0.12f, y + 0.16f, cz + 0.12f, pr, 30, pb);
        }
    }
    for (int c = 0; c < 4; c++) {                   // ring posts
        float cx = (c & 1) ? HALF : -HALF, cz = (c & 2) ? HALF : -HALF;
        box(cx - 0.07f, 0, cz - 0.07f, cx + 0.07f, MAT_Y + 1.45f, cz + 0.07f, 170, 172, 184);
    }
    // ring steps in the corner
    box(HALF + 0.1f, 0, HALF - 0.6f, HALF + 0.9f, 0.4f, HALF + 0.1f, 50, 52, 64);
    box(HALF + 0.1f, 0.4f, HALF - 0.6f, HALF + 0.5f, 0.8f, HALF + 0.1f, 50, 52, 64);
}

static void draw_floor_and_barrier(void)
{
    BIND(tFloor);
    BEGIN(GL_QUADS);
    C(120, 120, 140); T(0, 0); V(-15, 0, -15); T(64 * 8, 0); V(15, 0, -15);
    C(200, 200, 220); T(64 * 8, 64 * 8); V(15, 0, 15); T(0, 64 * 8); V(-15, 0, 15);
    END();
    // ringside mats (blue) and black barrier
    box(-5.2f, 0, -5.2f, 5.2f, 0.02f, 5.2f, 30, 50, 120);
    float b = 6.6f;
    box(-b, 0, b, b, 0.9f, b + 0.1f, 22, 22, 28);
    box(-b - 0.1f, 0, -b, -b, 0.9f, b, 22, 22, 28);
    box(b, 0, -b, b + 0.1f, 0.9f, b, 22, 22, 28);
    // announce table
    box(-1.6f, 0, 5.4f, 1.6f, 0.75f, 6.2f, 60, 60, 74);
    box(-1.6f, 0.75f, 5.4f, 1.6f, 0.8f, 6.2f, 140, 30, 40);
}

// Banked crowd seating on three sides; the fourth side holds the entrance stage.
static void crowd_side(float ax, float az, float bx, float bz, float ox, float oz)
{
    BIND(tCrowd);
    BEGIN(GL_QUADS);
    float len = sqrtf((bx - ax) * (bx - ax) + (bz - az) * (bz - az));
    int rep = (int)(len * 10);
    for (int tier = 0; tier < 3; tier++) {
        float d0 = tier * 2.6f, d1 = d0 + 2.6f, y0 = 0.9f + tier * 1.9f, y1 = y0 + 1.9f;
        int l0 = 230 - tier * 50, l1 = 200 - tier * 55;
        C(l0, l0, l0); T(0, 64);   V(ax + ox * d0, y0, az + oz * d0);
        C(l0, l0, l0); T(rep, 64); V(bx + ox * d0, y0, bz + oz * d0);
        C(l1, l1, l1); T(rep, 0);  V(bx + ox * d1, y1, bz + oz * d1);
        C(l1, l1, l1); T(0, 0);    V(ax + ox * d1, y1, az + oz * d1);
    }
    END();
}

static void draw_stage(void)
{
    float z = -7.2f;
    box(-5.5f, 0, z - 2.5f, 5.5f, 0.9f, z, 40, 40, 52);                 // stage deck
    box(-0.9f, 0, z, 0.9f, 0.06f, -5.2f, 120, 24, 34);                   // entrance ramp carpet
    BIND(tTron);
    BEGIN(GL_QUADS);
    C(235, 235, 235);
    T(0, 64); V(-4.2f, 1.6f, z - 2.2f); T(128, 64); V(4.2f, 1.6f, z - 2.2f);
    T(128, 0); V(4.2f, 5.8f, z - 2.2f); T(0, 0); V(-4.2f, 5.8f, z - 2.2f);
    END();
    box(-4.5f, 1.4f, z - 2.4f, -4.2f, 6.1f, z - 2.2f, 30, 30, 36);
    box(4.2f, 1.4f, z - 2.4f, 4.5f, 6.1f, z - 2.2f, 30, 30, 36);
    box(-4.5f, 5.8f, z - 2.4f, 4.5f, 6.1f, z - 2.2f, 30, 30, 36);
}

static void draw_truss(void)
{
    float y = 8.0f, s = 4.2f;
    box(-s, y, -s, s, y + 0.25f, -s + 0.25f, 90, 92, 100);
    box(-s, y, s - 0.25f, s, y + 0.25f, s, 90, 92, 100);
    box(-s, y, -s, -s + 0.25f, y + 0.25f, s, 90, 92, 100);
    box(s - 0.25f, y, -s, s, y + 0.25f, s, 90, 92, 100);
    for (int i = 0; i < 4; i++) {
        float lx = (i & 1) ? s - 0.4f : -s + 0.4f, lz = (i & 2) ? s - 0.4f : -s + 0.4f;
        box(lx - 0.2f, y - 0.35f, lz - 0.2f, lx + 0.2f, y, lz + 0.2f, 255, 250, 220);
    }
}

// Translucent light shafts from the truss onto the ring - drawn last.
static void draw_beams(void)
{
    BIND(0);
    float y = 7.7f, s = 3.8f;
    for (int i = 0; i < 4; i++) {
        float lx = (i & 1) ? s : -s, lz = (i & 2) ? s : -s;
        poly(2, 8 + i);
        BEGIN(GL_TRIANGLES);
        C(255, 250, 210); V(lx, y, lz);
        C(255, 240, 180); V(-1.2f, MAT_Y, -1.2f + i * 0.6f);
        C(255, 240, 180); V(1.2f, MAT_Y, 1.2f - i * 0.6f);
        END();
    }
}

// Camera flashes popping in the stands.
static void draw_flashes(void)
{
    BIND(0);
    poly(20, 20);
    BEGIN(GL_QUADS);
    for (int i = 0; i < 6; i++) {
        u32 h = (frame / 3 + i * 977) * 2654435761u;
        if ((h >> 28) > 3) continue;
        int side = (h >> 4) & 3; float t = ((h >> 8) & 255) / 255.0f * 12 - 6, d = ((h >> 16) & 255) / 255.0f * 7;
        float x, z, y = 1.5f + d * 0.7f;
        if (side == 0) { x = t; z = 7.4f + d; } else if (side == 1) { x = 7.4f + d; z = t; }
        else { x = -7.4f - d; z = t; }
        C(255, 255, 255);
        V(x - 0.12f, y - 0.12f, z); V(x + 0.12f, y - 0.12f, z); V(x + 0.12f, y + 0.12f, z); V(x - 0.12f, y + 0.12f, z);
    }
    END();
}

static const u32 *arena_dl;
static u32 pool[190000];
u32 *g_rec;
u32 g_reclen;
static u32 pool_used;

static u32 *cur_pool = pool, *cur_used = &pool_used, alt_used;
void rec_pool(u32 *buf)
{
    if (buf) { cur_pool = buf; alt_used = 0; cur_used = &alt_used; }
    else { cur_pool = pool; cur_used = &pool_used; }
}
void rec_begin(void) { g_rec = cur_pool + *cur_used; g_reclen = 1; }
const u32 *rec_end(void)
{
    g_rec[0] = g_reclen - 1;
    const u32 *l = g_rec;
    *cur_used += g_reclen;
    g_rec = NULL;
    return l;
}

static void arena_static(void)
{
    poly(31, 0);
    draw_floor_and_barrier();
    crowd_side(-7.0f, 7.4f, 7.0f, 7.4f, 0, 1);
    crowd_side(7.4f, 7.0f, 7.4f, -7.0f, 1, 0);
    crowd_side(-7.4f, -7.0f, -7.4f, 7.0f, -1, 0);
    draw_stage();
    draw_truss();
    poly(31, 1);
    draw_apron();
    draw_mat();
    draw_ropes();
    draw_beams();
}

void build_arena(void)
{
    rec_begin();
    arena_static();
    arena_dl = rec_end();
}

void draw_scene(void)
{
    if (!arena_dl) build_arena();
    glCallList(arena_dl);
    draw_flashes();
}


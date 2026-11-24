// Create-a-Wrestler: tabbed editor on the bottom screen, live 3D preview on top.
// The face map is painted at run time (same layout as the offline faces in tools/gen_m1_assets.py).
#include "icw.h"
#include <string.h>
#include <stdio.h>

#include "caw_bg_bin.h"
#include "font_ui_bin.h"
#include "font_big_bin.h"

static void do_save(void);
Look caw_look;
u16 caw_portrait[46 * 46];
int caw_fin;
char caw_name[20] = "THE ROOKIE";

static u32 caw_pool[14000];
static int caw_tex;

#define CC8(r, g, b) RGB15((r) >> 3, (g) >> 3, (b) >> 3)
typedef struct { u8 r, g, b; } C3;

static const C3 SKIN[8] = { {250,220,200}, {238,196,170}, {226,180,150}, {200,150,110}, {164,112,80}, {140,96,66}, {110,70,48}, {80,52,36} };
static const C3 HAIRC[8] = { {18,14,14}, {46,32,26}, {100,64,40}, {150,70,40}, {220,180,110}, {170,140,90}, {150,150,150}, {72,136,240} };
static const char *HAIRC_N[8] = { "BLACK", "DARK BROWN", "BROWN", "AUBURN", "BLONDE", "DIRTY BLONDE", "GREY", "BLUE" };
static const C3 EYES[5] = { {90,60,30}, {40,24,16}, {70,110,170}, {70,120,70}, {130,100,50} };
static const char *EYES_N[5] = { "BROWN", "DARK", "BLUE", "GREEN", "HAZEL" };
static const C3 GEAR[10] = { {200,36,44}, {40,80,180}, {30,40,80}, {40,130,60}, {28,28,32}, {236,236,236}, {230,190,40}, {120,60,160}, {220,110,30}, {120,120,130} };
static const char *GEAR_N[10] = { "RED", "BLUE", "NAVY", "GREEN", "BLACK", "WHITE", "GOLD", "PURPLE", "ORANGE", "GREY" };
static const char *HAIR_N[6] = { "SHORT", "MOHAWK", "LONG", "PONYTAIL", "TOP BUN", "BALD" };
static const char *BEARD_N[5] = { "NONE", "STUBBLE", "GOATEE", "MUSTACHE", "FULL BEARD" };
static const char *ATTIRE_N[4] = { "T-SHIRT", "SHIRTLESS", "OVERALLS", "SINGLET" };
static const char *FIN_N[3] = { "BARN BURNER", "GRAVEYARD SHIFT", "SNAKE BITE" };
static const char *NAMES[12] = { "THE ROOKIE", "HOLLER HAWK", "NIGHT SHIFT", "DIRT ROAD DAN", "LOW PRICES", "THE STOCKBOY",
                                 "MOONSHINER", "TACOMA TITAN", "BARGAIN BIN", "PARKING LOT", "THRIFT KING", "BIG CHEESE" };
static const char *SEX_N[2] = { "MALE", "FEMALE" };
static const char *SIZE_N[5] = { "SHORT", "AVERAGE-", "AVERAGE", "TALL", "GIANT" };
static const char *BUILD_N[5] = { "SKINNY", "LEAN", "ATHLETIC", "STOCKY", "HEAVY" };
static const char *ALIGN_N[2] = { "FACE", "HEEL" };

// option values
enum { O_SEX, O_HEIGHT, O_BUILD, O_SKIN, O_HAIR, O_HAIRC, O_EYES, O_BEARD, O_ATTIRE, O_TOP, O_PANTS, O_BOOTS, O_ACCENT,
       O_FIN, O_NAME, O_ALIGN, O_THEME, O_N };
static int opt[O_N] = { 0, 2, 2, 1, 0, 1, 0, 1, 0, 1, 2, 4, 6, 0, 0, 0, 0 };
static const int OPT_MAX[O_N] = { 2, 5, 5, 8, 6, 8, 5, 5, 4, 10, 10, 10, 10, 3, 12, 2, 1 };
static const char *OPT_LABEL[O_N] = { "BODY", "HEIGHT", "BUILD", "SKIN", "HAIR", "HAIR COLOR", "EYES", "FACIAL HAIR",
                                      "ATTIRE", "TOP", "TRUNKS", "BOOTS", "ACCENT", "FINISHER", "NAME", "SIDE", "THEME" };
static const int TAB_ROWS[4][5] = { { O_SEX, O_HEIGHT, O_BUILD, O_SKIN, -1 }, { O_HAIR, O_HAIRC, O_EYES, O_BEARD, -1 },
                                    { O_ATTIRE, O_TOP, O_PANTS, O_BOOTS, O_ACCENT }, { O_FIN, O_NAME, O_ALIGN, O_THEME, -1 } };

// ---------------------------------------------------------------- face painter (128x128, box-filtered to 64x64)
static u8 face_hi[128 * 128 * 3];
static u16 face_tex[64 * 64];

static void px3(int x, int y, C3 c)
{
    x &= 127;                       // wraps around the head
    if (y < 0 || y > 127) return;
    u8 *p = &face_hi[(y * 128 + x) * 3];
    p[0] = c.r; p[1] = c.g; p[2] = c.b;
}
static void ell(float x0, float y0, float x1, float y1, C3 c)
{
    float cx = (x0 + x1), cy = (y0 + y1), rx = (x1 - x0), ry = (y1 - y0);   // in 128-space (x2)
    if (rx <= 0 || ry <= 0) return;
    for (int y = (int)(y0 * 2); y <= (int)(y1 * 2); y++)
        for (int x = (int)(x0 * 2); x <= (int)(x1 * 2); x++) {
            float dx = (x + 0.5f - cx) / rx, dy = (y + 0.5f - cy) / ry;
            if (dx * dx + dy * dy <= 1) px3(x, y, c);
        }
}
static void rect(float x0, float y0, float x1, float y1, C3 c)
{
    for (int y = (int)(y0 * 2); y < (int)(y1 * 2); y++)
        for (int x = (int)(x0 * 2); x < (int)(x1 * 2); x++) px3(x, y, c);
}
static C3 mul(C3 c, int k) { C3 o = { (u8)(c.r * k / 100 > 255 ? 255 : c.r * k / 100), (u8)(c.g * k / 100 > 255 ? 255 : c.g * k / 100),
                                     (u8)(c.b * k / 100 > 255 ? 255 : c.b * k / 100) }; return o; }


// Lighting pass over the supersampled face: soft highlights and shadows (precomputed table), skin grain and hair strands, so the face reads as a lit 3D head instead of flat colour blocks.
#include "face_light.h"
static unsigned hsh(int x, int y) { unsigned h = x * 374761393u + y * 668265263u; h = (h ^ (h >> 13)) * 1274126177u; return h ^ (h >> 16); }
static void shade_face(C3 hair, int hairless)
{
    for (int y = 0; y < 128; y++)
        for (int x = 0; x < 128; x++) {
            u8 *p = &face_hi[(y * 128 + x) * 3]; int ti = (y >> 1) * 64 + (x >> 1);
            int is_hair = !hairless && p[0] == hair.r && p[1] == hair.g && p[2] == hair.b;
            int nz = (int)(hsh(x, y) & 255) - 128, L;
            if (is_hair) { int st = hsh(x >> 1, y / 6) & 255; L = 230 + st * 51 / 255 + nz / 20; }
            else L = FACE_L[ti] + 128 + nz / 6;
            int r = p[0] * L / 255, g = p[1] * L / 255, b = p[2] * L / 255;
            if (!is_hair) { int ch = FACE_C[ti]; r += 9 * ch / 255; g -= 3 * ch / 255; b -= 3 * ch / 255; }
            p[0] = r < 0 ? 0 : r > 255 ? 255 : r; p[1] = g < 0 ? 0 : g > 255 ? 255 : g; p[2] = b < 0 ? 0 : b > 255 ? 255 : b;
        }
}

static void paint_face(void)
{
    C3 sk = SKIN[opt[O_SKIN]], hair = HAIRC[opt[O_HAIRC]], iris = EYES[opt[O_EYES]];
    C3 shade = mul(sk, 82), light = mul(sk, 106), dark = mul(sk, 62);
    C3 lip = { (u8)(sk.r * 80 / 100 + 30 > 255 ? 255 : sk.r * 80 / 100 + 30), (u8)(sk.g * 62 / 100), (u8)(sk.b * 62 / 100) };
    if (opt[O_SEX]) lip = mul((C3){ (u8)(sk.r * 85 / 100 + 40 > 255 ? 255 : sk.r * 85 / 100 + 40), (u8)(sk.g * 55 / 100), (u8)(sk.b * 60 / 100) }, 100);
    for (int i = 0; i < 128 * 128; i++) { face_hi[i * 3] = sk.r; face_hi[i * 3 + 1] = sk.g; face_hi[i * 3 + 2] = sk.b; }
    ell(22, 28, 42, 50, light);
    rect(0, 56, 64, 64, shade);
    ell(26, 50, 38, 60, sk);
    for (int e = 0; e < 2; e++) { float eu = e ? 48 : 16; ell(eu - 3, 26, eu + 3, 40, shade); ell(eu - 1.6f, 29, eu + 1.6f, 37, dark); }
    // beard goes under the mouth
    int beard = opt[O_SEX] ? 0 : opt[O_BEARD];
    if (beard == 4) { ell(20, 36, 44, 63, hair); ell(27, 41, 37, 47.5f, sk); }
    for (int e = 0; e < 2; e++) {
        float ex = e ? 37.5f : 26.5f;
        ell(ex - 3.4f, 28.9f, ex + 3.4f, 31.6f, mul(sk, 45));                  // upper lid / lashes
        ell(ex - 3.2f, 29.6f, ex + 3.2f, 33.5f, (C3){ 240, 236, 228 });
        ell(ex - 1.7f, 29.7f, ex + 1.7f, 33.4f, iris);
        ell(ex - 0.8f, 30.6f, ex + 0.8f, 32.4f, (C3){ 10, 8, 8 });
        ell(ex - 0.3f, 30.4f, ex + 0.5f, 31.2f, (C3){ 255, 255, 255 });
        for (int k = -4; k <= 4; k++) {                                          // brow arch
            float t = k / 4.0f, bx = ex + 3.6f * t, by = 27.4f - 1.1f * (1 - t * t);
            float th = opt[O_SEX] ? 0.45f : 0.7f;
            ell(bx - 0.8f, by - th, bx + 0.8f, by + th, beard == 4 || opt[O_HAIR] == HAIR_BALD ? mul(hair, 100) : hair);
        }
    }
    ell(31, 31, 33, 40, light);                                                  // nose
    ell(33, 33, 34, 40, shade);
    ell(29.8f, 39.2f, 31.4f, 40.8f, mul(sk, 60)); ell(32.6f, 39.2f, 34.2f, 40.8f, mul(sk, 60));
    ell(29, 42.4f, 35, 44.6f, mul(lip, 90));                                     // lips
    ell(28, 43.4f, 36, 47, lip);
    rect(28.2f, 43.9f, 35.8f, 44.5f, mul(lip, 50));
    if (beard == 1 || beard == 4) {                                              // stubble
        u32 r = 12345;
        C3 st = mul(hair, 100); st.r = (st.r + sk.r) / 2; st.g = (st.g + sk.g) / 2; st.b = (st.b + sk.b) / 2;
        for (int i = 0; i < 900; i++) {
            r = r * 1103515245 + 12345; float u = 19 + ((r >> 8) & 1023) / 1023.0f * 26;
            r = r * 1103515245 + 12345; float v = 40 + ((r >> 8) & 1023) / 1023.0f * 20;
            if (fabsf(u - 32) < 13 - (v - 40) * 0.2f && !(u > 28 && u < 36 && v > 42 && v < 47.5f)) px3((int)(u * 2), (int)(v * 2), st);
        }
    }
    if (beard == 2) { rect(30.2f, 48.5f, 33.8f, 56, hair); rect(28.4f, 41.6f, 35.6f, 42.6f, hair); }
    if (beard == 3) rect(28.4f, 41.4f, 35.6f, 42.8f, hair);
    if (opt[O_SEX]) {                                                            // a touch of colour
        ell(22, 36, 27, 40, mul(lip, 104)); ell(37, 36, 42, 40, mul(lip, 104));
        ell(22, 36, 27, 40, light);
    }
    switch (opt[O_HAIR]) {
    case HAIR_MOHAWK:
        rect(0, 0, 64, 22, mul(sk, 70)); rect(26, 0, 38, 24, hair); rect(0, 0, 8, 64, hair); rect(56, 0, 64, 64, hair); break;
    case HAIR_SHORT:
        rect(0, 0, 64, 21, hair); ell(20, 14, 44, 28, sk); rect(0, 0, 14, 44, hair); rect(50, 0, 64, 44, hair); rect(0, 0, 64, 17, hair); break;
    case HAIR_LONG: case HAIR_PONY:
        rect(0, 0, 64, 22, hair); ell(21, 15, 43, 29, sk); rect(0, 0, 20, 64, hair); rect(44, 0, 64, 64, hair); rect(0, 0, 64, 17, hair); break;
    case HAIR_BUN:
        rect(0, 0, 64, 22, hair); ell(20, 16, 44, 30, sk); rect(0, 0, 16, 40, hair); rect(48, 0, 64, 40, hair); rect(0, 0, 64, 18, hair); break;
    default:
        ell(26, 3, 38, 12, light); break;
    }
    shade_face(hair, opt[O_HAIR] == HAIR_BALD);
    for (int y = 0; y < 64; y++)
        for (int x = 0; x < 64; x++) {
            int r = 0, g = 0, b = 0;
            for (int k = 0; k < 4; k++) {
                const u8 *p = &face_hi[(((y * 2 + (k >> 1)) * 128) + x * 2 + (k & 1)) * 3];
                r += p[0]; g += p[1]; b += p[2];
            }
            face_tex[y * 64 + x] = RGB15(r >> 5, g >> 5, b >> 5) | BIT(15);
        }
}

// ---------------------------------------------------------------- apply options to the Look
static void apply(void)
{
    static const float HEIGHT[5] = { 0.90f, 0.95f, 1.0f, 1.05f, 1.10f };
    static const float BUILD[5] = { 0.84f, 0.92f, 1.0f, 1.10f, 1.22f };
    C3 sk = SKIN[opt[O_SKIN]], hr = HAIRC[opt[O_HAIRC]];
    C3 top = GEAR[opt[O_TOP]], pants = GEAR[opt[O_PANTS]], boots = GEAR[opt[O_BOOTS]], acc = GEAR[opt[O_ACCENT]];
    memset(&caw_look, 0, sizeof caw_look);
    caw_look.skin = CC8(sk.r, sk.g, sk.b);
    caw_look.hair = caw_look.hair2 = CC8(hr.r, hr.g, hr.b);
    caw_look.pants = CC8(pants.r, pants.g, pants.b);
    caw_look.boots = CC8(boots.r, boots.g, boots.b);
    caw_look.accent = CC8(acc.r, acc.g, acc.b);
    caw_look.top = CC8(top.r, top.g, top.b);
    if (opt[O_ATTIRE] == 1) { caw_look.top = caw_look.skin; caw_look.accent = caw_look.skin; }
    if (opt[O_ATTIRE] == 2) caw_look.overalls = 1;
    if (opt[O_ATTIRE] == 3) caw_look.top = caw_look.pants;
    caw_look.fem = opt[O_SEX];
    caw_look.height = HEIGHT[opt[O_HEIGHT]] * (opt[O_SEX] ? 0.94f : 1.0f);
    caw_look.build = BUILD[opt[O_BUILD]] * (opt[O_SEX] ? 0.92f : 1.0f);
    caw_look.hairstyle = opt[O_HAIR];
    caw_fin = opt[O_FIN];

    paint_face();
    if (caw_tex) glDeleteTextures(1, &caw_tex);
    DC_FlushRange(face_tex, sizeof face_tex);
    face_to_portrait(face_tex, caw_portrait);
    caw_tex = load_tex_pal(face_tex, 64, 64, 1);
    caw_look.faceTex = caw_tex;
    rec_pool(caw_pool);
    build_look(&caw_look);
    rec_pool(NULL);
}

static void do_load(void);
// Build a complete Look for an NPC from palette indices (used by the open world for fans and townsfolk).
void npc_look_p(Look *lk, int sex, int skin, int hair, int hairc, int eyes, int beard, int top, int pants, int boots,
              float height, float build, u16 *portrait)
{
    int save[O_N]; memcpy(save, opt, sizeof opt);
    opt[O_SEX] = sex; opt[O_SKIN] = skin; opt[O_HAIR] = hair; opt[O_HAIRC] = hairc; opt[O_EYES] = eyes; opt[O_BEARD] = beard;
    paint_face();
    DC_FlushRange(face_tex, sizeof face_tex);
    if (portrait) face_to_portrait(face_tex, portrait);
    C3 sk = SKIN[skin], hr = HAIRC[hairc], tp = GEAR[top], pn = GEAR[pants], bt = GEAR[boots];
    memset(lk, 0, sizeof *lk);
    lk->skin = CC8(sk.r, sk.g, sk.b); lk->hair = lk->hair2 = CC8(hr.r, hr.g, hr.b);
    lk->top = CC8(tp.r, tp.g, tp.b); lk->pants = CC8(pn.r, pn.g, pn.b); lk->boots = CC8(bt.r, bt.g, bt.b);
    lk->accent = lk->top;
    lk->fem = sex; lk->hairstyle = hair; lk->height = height; lk->build = build;
    lk->faceTex = load_tex_pal(face_tex, 64, 64, 1);
    build_look2(lk, 1);
    memcpy(opt, save, sizeof opt);
}

void npc_look(Look *lk, int sex, int skin, int hair, int hairc, int eyes, int beard, int top, int pants, int boots, float height, float build)
{ npc_look_p(lk, sex, skin, hair, hairc, eyes, beard, top, pants, boots, height, build, 0); }
void caw_init(void) { do_load(); apply(); }
void game_save(void) { do_save(); }

// ---------------------------------------------------------------- bottom-screen UI
static int tab, row;

static int row_count(int t) { int n = 0; while (n < 5 && TAB_ROWS[t][n] >= 0) n++; return n; }

static void value_text(int o, char *buf)
{
    int v = opt[o];
    const char *s = "";
    switch (o) {
    case O_SEX: s = SEX_N[v]; break;
    case O_HEIGHT: s = SIZE_N[v]; break;
    case O_BUILD: s = BUILD_N[v]; break;
    case O_SKIN: sprintf(buf, "TONE %d", v + 1); return;
    case O_HAIR: s = HAIR_N[v]; break;
    case O_HAIRC: s = HAIRC_N[v]; break;
    case O_EYES: s = EYES_N[v]; break;
    case O_BEARD: s = opt[O_SEX] ? "NONE" : BEARD_N[v]; break;
    case O_ATTIRE: s = ATTIRE_N[v]; break;
    case O_TOP: case O_PANTS: case O_BOOTS: case O_ACCENT: s = GEAR_N[v]; break;
    case O_FIN: s = FIN_N[v]; break;
    case O_ALIGN: s = ALIGN_N[v]; break;
    case O_NAME: s = caw_name; break;
    case O_THEME: s = caw_theme.used ? "CUSTOM  (EDIT)" : "NONE  (EDIT)"; break;
    }
    strcpy(buf, s);
}

static int swatch(int o, u16 *col)
{
    int v = opt[o];
    C3 c;
    if (o == O_SKIN) c = SKIN[v];
    else if (o == O_HAIRC) c = HAIRC[v];
    else if (o == O_EYES) c = EYES[v];
    else if (o >= O_TOP && o <= O_ACCENT) c = GEAR[v];
    else return 0;
    *col = CC8(c.r, c.g, c.b);
    return 1;
}

static void draw_ui(u16 *sub)
{
    static const char *TABS[4] = { "BODY", "LOOK", "GEAR", "MOVES" };
    dmaCopy(caw_bg_bin, sub, 256 * 192 * 2);
    for (int i = 0; i < 4; i++) {
        int x0 = 4 + i * 63;
        if (i == tab) { fill_rect(sub, x0 + 3, 30, x0 + 56, 44, RGB15(24, 18, 4)); fill_rect(sub, x0 + 6, 43, x0 + 53, 45, RGB15(31, 24, 8)); }
        draw_text_c(sub, font_ui_bin, x0 + 30, 31, TABS[i], i == tab ? RGB15(31, 31, 31) : RGB15(20, 21, 27));
    }
    int n = row_count(tab);
    for (int r = 0; r < n; r++) {
        int o = TAB_ROWS[tab][r], y0 = 52 + r * 23;
        if (r == row) {
            fill_rect(sub, 4, y0, 252, y0 + 1, RGB15(31, 24, 8)); fill_rect(sub, 4, y0 + 19, 252, y0 + 20, RGB15(31, 24, 8));
            fill_rect(sub, 4, y0, 5, y0 + 20, RGB15(31, 24, 8)); fill_rect(sub, 251, y0, 252, y0 + 20, RGB15(31, 24, 8));
        }
        draw_text(sub, font_ui_bin, 10, y0 + 4, OPT_LABEL[o], r == row ? RGB15(31, 27, 12) : RGB15(22, 23, 29));
        char buf[24]; value_text(o, buf);
        u16 sc;
        int has = swatch(o, &sc);
        int cx = 173 + (has ? 7 : 0);
        draw_text_c(sub, font_ui_bin, cx, y0 + 4, buf, RGB15(31, 31, 31));
        if (has) {
            int tx = cx - text_width(font_ui_bin, buf) / 2 - 16;
            fill_rect(sub, tx, y0 + 4, tx + 12, y0 + 16, RGB15(31, 31, 31));
            fill_rect(sub, tx + 1, y0 + 5, tx + 11, y0 + 15, sc);
        }
    }
    for (int r = n; r < 5; r++) fill_rect(sub, 4, 52 + r * 23, 253, 72 + r * 23, RGB15(3, 3, 6));
    // name plate preview in the empty rows of short tabs
    if (n < 5) draw_text_c(sub, font_big_bin, 128, 52 + 4 * 23 + 1, caw_name, RGB15(31, 26, 8));
}

static u16 *ui_sub;
static float spin;
static int zoom = 1;
static void preview(void);
static void top_full(void) { int z = zoom; zoom = 0; preview(); zoom = z; }

static void open_special(int o)
{
    if (o == O_NAME) keyboard(ui_sub, caw_name, 16, top_full);
    if (o == O_THEME) theme_run(ui_sub, top_full);
}

static void change(int o, int d)
{
    if (o == O_THEME) { open_special(o); return; }
    opt[o] = (opt[o] + d + OPT_MAX[o]) % OPT_MAX[o];
    if (o == O_NAME) { strcpy(caw_name, NAMES[opt[o]]); return; }
    apply();
}

// ---- save / load
typedef struct { int opt[O_N]; char name[20]; Theme theme; int prog[8], align[8], money, handheld, toys; } SaveData;
static int save_status;    // 0 none, 1 saved, -1 no card
static void do_save(void)
{
    SaveData s; memcpy(s.opt, opt, sizeof opt); memcpy(s.name, caw_name, 20); s.theme = caw_theme;
    memcpy(s.prog, story_prog, sizeof s.prog); memcpy(s.align, story_align, sizeof s.align); s.money = money; s.handheld = has_handheld; s.toys = toys;
    save_status = save_write(&s, sizeof s) ? 1 : -1;
}
static void do_load(void)
{
    SaveData s;
    if (save_read(&s, sizeof s)) {
        memcpy(opt, s.opt, sizeof opt); memcpy(caw_name, s.name, 20); caw_theme = s.theme;
        memcpy(story_prog, s.prog, sizeof s.prog); memcpy(story_align, s.align, sizeof s.align); money = s.money; has_handheld = s.handheld; toys = s.toys;
    }
}

// ---------------------------------------------------------------- preview loop
static void preview(void)
{
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
    float h = caw_look.height;
    if (zoom) gluLookAt(0.30f * SC, (MAT_Y + 1.80f * h) * SC, 1.55f * SC, 0, (MAT_Y + 1.62f * h) * SC, 0, 0, 1, 0);
    else gluLookAt(0 * SC, (MAT_Y + 1.35f * h) * SC, 3.1f * SC, 0, (MAT_Y + 1.0f * h) * SC, 0, 0, 1, 0);
    draw_scene();
    lights_on();
    Pose p; memset(&p, 0, sizeof p);
    p.sh[0] = p.sh[1] = 10; p.roll[0] = p.roll[1] = 12; p.el[0] = p.el[1] = 14; p.hroll[0] = p.hroll[1] = 5;
    p.kn[0] = p.kn[1] = 4; p.py = sinf(frame * 0.06f) * 0.008f; p.torso = sinf(frame * 0.06f) * 1.2f;
    if (opt[O_ALIGN]) { p.head = -8; p.sh[0] = p.sh[1] = 20; p.el[0] = p.el[1] = 100; p.roll[0] = p.roll[1] = 30; }  // heel: arms crossed-ish
    draw_wrestler(&caw_look, 0, 0, spin + sinf(frame * 0.01f) * 35, &p, 2);
    glFlush(0);
}

void caw_run(u16 *sub)
{
    ui_sub = sub;
    tab = 0; row = 0;
    draw_ui(sub);
    while (1) {
        frame++;
        input_scan();
        u32 kd = keys_down(), kh = keysHeld();
        int dirty = 0, n = row_count(tab);
        if (kd & KEY_R) { tab = (tab + 1) % 4; row = 0; dirty = 1; }
        if (kd & KEY_L) { tab = (tab + 3) % 4; row = 0; dirty = 1; }
        if (kd & KEY_DOWN) { row = (row + 1) % n; dirty = 1; }
        if (kd & KEY_UP) { row = (row + n - 1) % n; dirty = 1; }
        if (kd & KEY_RIGHT) { change(TAB_ROWS[tab][row], 1); dirty = 1; }
        if (kd & KEY_LEFT) { change(TAB_ROWS[tab][row], -1); dirty = 1; }
        if (kd & (KEY_START | KEY_B)) break;
        if (kd & KEY_A) {
            int o = TAB_ROWS[tab][row];
            if (o == O_NAME || o == O_THEME) { open_special(o); dirty = 1; } else zoom ^= 1;
        }
        if (kh & KEY_Y) spin -= 3;
        if (kh & KEY_X) spin += 3;
        if (kd & KEY_TOUCH) {
            touchPosition tp; touch_get(&tp);
            int x = tp.px, y = tp.py;
            if (y >= 28 && y < 47) { int t = (x - 4) / 63; if (t >= 0 && t < 4) { tab = t; row = 0; dirty = 1; } }
            else if (y >= 52 && y < 167) {
                int r = (y - 52) / 23;
                if (r < row_count(tab)) {
                    row = r; dirty = 1;
                    int o = TAB_ROWS[tab][r];
                    if (x >= 96 && x < 113) change(o, -1);
                    else if (x >= 234 && x < 251) change(o, 1);
                    else if (x >= 113 && (o == O_NAME || o == O_THEME)) open_special(o);
                }
            } else if (y >= 173 && x >= 188) break;
        }
        if (dirty) draw_ui(sub);
        if (dirty && save_status) save_status = 0;

        preview();
        swiWaitForVBlank();
    }
    do_save();
}

// The ICW cast: looks, portraits, finishers, alignment and entrance themes for everyone.
#include "icw.h"
#include <string.h>
#include "skin_gen.h"

#include "fc_steve_bin.h"
#include "fc_rebecca_bin.h"
#include "fc_joe_bin.h"
#include "fc_danny_bin.h"
#include "fc_monte_bin.h"
#include "fc_austin_bin.h"
#include "fc_python_bin.h"
#include "fc_michelle_bin.h"
#include "fc_squid_bin.h"
#include "fc_cliff_bin.h"
#include "fc_vane_bin.h"
#include "fc_ref_bin.h"
#include "fc_heather_bin.h"
#include "fc_dex_bin.h"
#include "face_thief_bin.h"
#include "por_steve_bin.h"
#include "por_austin_bin.h"
#include "por_python_bin.h"
#include "por_joe_bin.h"
#include "por_michelle_bin.h"
#include "por_danny_bin.h"
#include "por_rebecca_bin.h"
#include "por_cliff_bin.h"
#include "por_squid_bin.h"
#include "por_vane_bin.h"
#include "por_thief_bin.h"
#include "por_monte_bin.h"
#include "por_heather_bin.h"
#include "por_dex_bin.h"
#include "por_ref_bin.h"
#include "font_ui_bin.h"
#include "font_big_bin.h"

void theme_preset(Theme *t, int p);

#define R8(r, g, b) RGB15((r) >> 3, (g) >> 3, (b) >> 3)
typedef struct {
    const char *name; const void *face, *por; u16 skin; u8 hs, fem; float build, height;
    u16 hair, hair2, top, pants, boots, accent; u8 overalls, stripes, vest, sleeveless, fin, heel, lodonly;
} Def;

static Def D[C_COUNT];
static Look L[C_COUNT];
static int built[C_COUNT], defs_ready;
static Theme TH[C_COUNT];
static int th_ready;

const char *FIN_NAME[4] = { "BARN BURNER!", "GRAVEYARD SHIFT!", "SNAKE BITE!", "FOREHEAD TAP!" };

static void defs(void)
{
    if (defs_ready) return;
    defs_ready = 1;
    //                 name        face          portrait       skin          hair      fem  build  height hair              hair2             top               pants             boots            accent
    D[C_STEVE]    = (Def){ "STEVE", fc_steve_bin, por_steve_bin, SKIN_STEVE, HAIR_MULLET, 0, 1.05f, 1.00f, R8(52, 36, 28), R8(120, 70, 44), R8(34, 44, 86), R8(60, 96, 150), R8(96, 62, 36), R8(210, 180, 90), .overalls = 1, .fin = 0 };
    D[C_AUSTIN]   = (Def){ "AUSTIN", fc_austin_bin, por_austin_bin, SKIN_AUSTIN, HAIR_BUN, 0, 0.92f, 1.00f, R8(16, 14, 14), R8(16, 14, 14), R8(200, 40, 44), R8(46, 46, 60), R8(24, 24, 28), R8(40, 80, 160), .fin = 1 };
    D[C_PYTHON]   = (Def){ "PYTHON", fc_python_bin, por_python_bin, SKIN_PYTHON, HAIR_BALD, 0, 0.95f, 1.06f, 0, 0, SKIN_PYTHON, R8(40, 130, 60), R8(220, 180, 50), R8(220, 180, 50), .sleeveless = 1, .fin = 2, .heel = 1 };
    D[C_JOE]      = (Def){ "JOE", fc_joe_bin, por_joe_bin, SKIN_JOE, HAIR_LONG, 0, 0.84f, 1.00f, R8(18, 16, 20), R8(18, 16, 20), R8(30, 30, 36), R8(44, 44, 56), R8(200, 200, 200), R8(160, 30, 30), .fin = 1 };
    D[C_MICHELLE] = (Def){ "MICHELLE", fc_michelle_bin, por_michelle_bin, SKIN_MICHELLE, HAIR_PONY, 1, 0.92f, 0.93f, R8(60, 40, 32), R8(60, 40, 32), R8(40, 80, 180), R8(28, 28, 32), R8(28, 28, 32), R8(230, 230, 230), .fin = 2, .heel = 1 };
    D[C_DANNY]    = (Def){ "DANNY", fc_danny_bin, por_danny_bin, SKIN_DANNY, HAIR_CURLY, 0, 1.24f, 1.08f, R8(132, 86, 56), R8(98, 60, 38), R8(110, 110, 120), R8(28, 28, 32), R8(28, 28, 32), R8(110, 110, 120), .sleeveless = 1, .fin = 0, .heel = 1 };
    D[C_REBECCA]  = (Def){ "REBECCA", fc_rebecca_bin, por_rebecca_bin, SKIN_REBECCA, HAIR_LONG, 1, 0.88f, 0.89f, R8(44, 30, 26), R8(44, 30, 26), R8(120, 120, 126), R8(50, 74, 130), R8(64, 40, 24), R8(226, 170, 60), .fin = 1 };
    D[C_CLIFF]    = (Def){ "CLIFF", fc_cliff_bin, por_cliff_bin, SKIN_CLIFF, HAIR_SHORT, 0, 1.10f, 1.00f, R8(120, 84, 56), R8(120, 84, 56), R8(40, 80, 180), R8(190, 170, 130), R8(60, 40, 30), R8(240, 240, 240), .fin = 0 };
    D[C_REF]      = (Def){ "REF", fc_ref_bin, por_ref_bin, SKIN_REF, HAIR_SHORT, 0, 0.95f, 0.97f, R8(70, 60, 56), R8(70, 60, 56), R8(235, 235, 235), R8(30, 30, 34), R8(20, 20, 22), R8(20, 20, 24), .stripes = 1 };
    D[C_SQUID]    = (Def){ "SQUID", fc_squid_bin, por_squid_bin, SKIN_SQUID, HAIR_SHORT, 0, 1.26f, 1.02f, R8(176, 146, 92), R8(176, 146, 92), R8(40, 130, 90), R8(28, 28, 32), R8(28, 28, 32), R8(240, 240, 240), .fin = 0 };
    D[C_VANE]     = (Def){ "DR. VANE", fc_vane_bin, por_vane_bin, SKIN_VANE, HAIR_LONG, 1, 0.90f, 1.02f, R8(156, 156, 164), R8(156, 156, 164), R8(28, 28, 34), R8(28, 28, 34), R8(20, 20, 22), R8(180, 24, 48), .fin = 2, .heel = 1 };
    D[C_THIEF]    = (Def){ "THE THIEF", 0, por_thief_bin, R8(180, 150, 124), HAIR_LONG, 0, 0.95f, 1.00f, R8(108, 108, 116), R8(108, 108, 116), R8(108, 108, 116), R8(40, 40, 48), R8(24, 24, 24), R8(108, 108, 116), .fin = 1, .heel = 1 };
    D[C_MONTE]    = (Def){ "MONTE", fc_monte_bin, por_monte_bin, SKIN_MONTE, HAIR_BALD, 0, 1.22f, 1.00f, 0, 0, R8(236, 236, 230), R8(26, 26, 30), R8(20, 20, 22), R8(40, 90, 200), .vest = 1, .fin = 3 };
    D[C_HEATHER]  = (Def){ "HEATHER", fc_heather_bin, por_heather_bin, SKIN_HEATHER, HAIR_LONG, 1, 0.88f, 0.90f, R8(72, 136, 240), R8(72, 136, 240), R8(40, 80, 180), R8(28, 28, 32), R8(28, 28, 32), R8(240, 130, 180), .lodonly = 1 };
    D[C_DEX]      = (Def){ "DEX", fc_dex_bin, por_dex_bin, SKIN_DEX, HAIR_BUN, 0, 1.15f, 1.02f, R8(16, 14, 14), R8(16, 14, 14), R8(120, 60, 160), R8(28, 28, 32), R8(28, 28, 32), R8(255, 220, 90), .lodonly = 1 };
    D[C_CAW]      = (Def){ "", 0, caw_portrait };
    static u16 thief_por[46 * 46];
    face_to_portrait((const u16 *)face_thief_bin, thief_por);
    D[C_THIEF].por = thief_por;
}

// Roster slot override from the dev kit's data block (WRCF record, 40 bytes): name[16], sex, skin, hair, hairc, eyes, beard, top, pants, boots, height x100, build x100, fin, heel, theme preset, key, tempo
static unsigned char ov_stat[C_COUNT][4]; static int ov_stat_ready;
static unsigned char ov_mv[C_COUNT][5]; static int ov_mv_ready;
const unsigned char *cast_moves(int id) { if (!ov_mv_ready) { ov_mv_ready = 1; for (int i = 0; i < C_COUNT; i++) for (int k = 0; k < 5; k++) ov_mv[i][k] = k; } return ov_mv[id]; }   // grapple used for: none, UP, DOWN, LEFT, RIGHT + B
const unsigned char *cast_stat(int id) { if (!ov_stat_ready) { ov_stat_ready = 1; for (int i = 0; i < C_COUNT; i++) for (int k = 0; k < 4; k++) ov_stat[i][k] = 100; } return ov_stat[id]; }
static char ov_name[C_COUNT][17]; static u16 ov_por[C_COUNT][46 * 46];
void cast_define(int id, const unsigned char *r, const u16 *face)
{
    defs(); cast_theme(0);
    memcpy(ov_name[id], r, 16); ov_name[id][16] = 0;
    for (char *s = ov_name[id]; *s; s++) if (*s >= 'a' && *s <= 'z') *s -= 32;
    if (!ov_name[id][0]) strcpy(ov_name[id], "WRESTLER");
    D[id].name = ov_name[id]; D[id].por = ov_por[id]; D[id].fin = r[27] & 3; D[id].heel = r[28] & 1;
    npc_face_override = face;
    npc_look_p(&L[id], r[16] & 1, r[17] & 7, r[18] & 7, r[19] & 7, r[20] & 3, r[21] & 3, r[22] % 10, r[23] % 10, r[24] % 10, (r[25] ? r[25] : 100) / 100.0f, (r[26] ? r[26] : 100) / 100.0f, ov_por[id]);
    built[id] = 1; cast_stat(id); cast_moves(id); for (int k = 0; k < 4; k++) ov_mv[id][k + 1] = r[36 + k] ? (r[36 + k] - 1) % 5 : k + 1; for (int k = 0; k < 4; k++) ov_stat[id][k] = r[32 + k] ? (r[32 + k] < 40 ? 40 : r[32 + k] > 200 ? 200 : r[32 + k]) : 100;
    theme_preset(&TH[id], r[29] % 3); TH[id].key = r[30] % 12; TH[id].tempo = r[31] ? r[31] : 120; TH[id].used = 1;
}

const char *cast_name(int id) { defs(); return id == C_CAW ? caw_name : D[id].name; }
const void *cast_portrait(int id) { defs(); return D[id].por; }
int cast_fin(int id) { defs(); return id == C_CAW ? caw_fin : D[id].fin; }
int cast_heel(int id) { defs(); return D[id].heel; }

const Theme *cast_theme(int id)
{
    if (!th_ready) {
        th_ready = 1;
        static const u8 P[C_COUNT][3] = {   // preset, key, tempo
            [C_STEVE] = { 0, 5, 124 }, [C_AUSTIN] = { 0, 10, 116 }, [C_JOE] = { 2, 7, 152 }, [C_MICHELLE] = { 1, 3, 84 }, [C_DANNY] = { 1, 0, 64 },
            [C_REBECCA] = { 2, 0, 132 }, [C_SQUID] = { 0, 2, 108 }, [C_VANE] = { 1, 8, 96 }, [C_THIEF] = { 2, 1, 120 }, [C_MONTE] = { 0, 7, 100 },
            [C_CLIFF] = { 0, 0, 140 } };
        for (int i = 0; i < C_COUNT; i++) if (P[i][2]) { theme_preset(&TH[i], P[i][0]); TH[i].key = P[i][1]; TH[i].tempo = P[i][2]; TH[i].used = 1; }
    }
    if (id == C_CAW) return caw_theme.used ? &caw_theme : NULL;
    return TH[id].used ? &TH[id] : NULL;
}

const Look *cast_look(int id)
{
    defs();
    if (id == C_CAW) return &caw_look;
    if (!built[id]) {
        built[id] = 1;
        const Def *d = &D[id];
        Look *l = &L[id];
        *l = (Look){ .skin = d->skin, .hair = d->hair, .hair2 = d->hair2, .top = d->top, .pants = d->pants, .boots = d->boots, .accent = d->accent,
            .build = d->build, .height = d->height, .hairstyle = d->hs, .fem = d->fem, .overalls = d->overalls, .stripes = d->stripes,
            .vest = d->vest, .sleeveless = d->sleeveless };
        if (d->face) { l->faceTex = load_face(d->face); l->face2x = 1; }
        else l->faceTex = load_tex_pal((const u16 *)face_thief_bin, 64, 64, 1);
        build_look2(l, d->lodonly);
    }
    return &L[id];
}

// ---------------------------------------------------------------- roster grid (bottom screen); returns a cast id or -1
int pick_cast(u16 *sub, const char *title, const int *ids, int n, void (*top)(void))
{
    int cur = 0, dirty = 1, cols = n > 10 ? 6 : 5, cw = n > 10 ? 42 : 50, rh = n > 10 ? 66 : 68;
    while (1) {
        if (dirty) {
            dirty = 0;
            u16 *fb = ui_back;
            for (int y = 0; y < 192; y++) fill_rect(fb, 0, y, 256, y + 1, RGB15(3 + y / 40, 2 + y / 60, 6 + y / 26));
            for (int y = 0; y < 24; y++) fill_rect(fb, 0, y, 256, y + 1, RGB15(25 - y / 2, 3, 5));
            fill_rect(fb, 0, 24, 256, 26, RGB15(29, 23, 7));
            draw_text_c(fb, font_big_bin, 128, 3, title, RGB15(31, 31, 31));
            for (int i = 0; i < n; i++) {
                int x0 = 3 + (i % cols) * cw, y0 = 32 + (i / cols) * rh, pw = cw - 4;
                if (i == cur) fill_rect(fb, x0 - 2, y0 - 2, x0 + pw + 2, y0 + 60, RGB15(31, 25, 6));
                fill_rect(fb, x0, y0, x0 + pw, y0 + 58, RGB15(2, 2, 5));
                const u16 *pp = cast_portrait(ids[i]);
                int ox = (46 - pw) / 2; if (ox < 0) ox = 0;
                for (int y = 0; y < 46; y++) for (int x = 0; x < pw && x + ox < 46; x++) fb[(y0 + y) * 256 + x0 + x + (pw > 46 ? (pw - 46) / 2 : 0)] = pp[y * 46 + x + ox] | BIT(15);
                char nm[16]; const char *full = cast_name(ids[i]);
                if (!strncmp(full, "DR. ", 4)) full += 4; else if (!strncmp(full, "THE ", 4)) full += 4;
                strncpy(nm, full, 15); nm[15] = 0;
                while (strlen(nm) > 1 && text_width(font_ui_bin, nm) > cw - 3) nm[strlen(nm) - 1] = 0;
                draw_text_c(fb, font_ui_bin, x0 + pw / 2, y0 + 46, nm, i == cur ? RGB15(31, 28, 12) : RGB15(26, 26, 30));
            }
            fill_rect(fb, 0, 172, 256, 192, RGB15(2, 2, 5)); fill_rect(fb, 0, 172, 256, 173, RGB15(29, 23, 7));
            draw_text(fb, font_ui_bin, 6, 177, "TAP, OR D-PAD + A      B: BACK", RGB15(20, 21, 27));
            ui_flip(sub);
        }
        input_scan();
        u32 k = keys_down();
        if (k & KEY_B) return -1;
        if (k & (KEY_A | KEY_START)) return ids[cur];
        if (k & KEY_RIGHT) { cur = (cur + 1) % n; dirty = 1; }
        if (k & KEY_LEFT) { cur = (cur + n - 1) % n; dirty = 1; }
        if (k & (KEY_DOWN | KEY_UP)) { int c = cur + ((k & KEY_DOWN) ? cols : -cols); if (c >= 0 && c < n) { cur = c; dirty = 1; } }
        if (k & KEY_TOUCH) {
            touchPosition tp; touch_get(&tp);
            for (int i = 0; i < n; i++) {
                int x0 = 3 + (i % cols) * cw, y0 = 32 + (i / cols) * rh;
                if (tp.px >= x0 - 2 && tp.px < x0 + cw - 2 && tp.py >= y0 - 2 && tp.py < y0 + 60) return ids[i];
            }
        }
        frame++;
        if (top) top();
        swiWaitForVBlank();
    }
}

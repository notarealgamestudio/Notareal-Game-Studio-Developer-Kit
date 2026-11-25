// NOTAREAL Game Studio - DS 3D wrestling game. The roster (WRCF section of the data block) comes from the dev kit's editor; the match engine is the ICW one.
#include <nds.h>
#include <math.h>
#include <string.h>
#include "tex_mat_bin.h"
#include "tex_apron_bin.h"
#include "tex_crowd_bin.h"
#include "tex_floor_bin.h"
#include "aset.h"
#include "tex_tron_bin.h"
#include "splash_bin.h"
#include "icw.h"
typedef struct { char id[4]; unsigned off, size; } NrgSection;
typedef struct { char magic[8]; unsigned capacity, used, count; NrgSection sec[]; } NrgHeader;
#include "font_ui_bin.h"
#include "font_big_bin.h"
extern const unsigned char nr_gamedata[];
static u16 *sub;
// Character select on the bottom screen while the arena keeps running on top.
static void camera(int mode);
static void top_orbit(void)
{
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
    camera(1);
    draw_scene();
    glFlush(0);
}
static int pick_match_type(void)
{
    static const char *const DESC[MT_COUNT] = {
        "ONE FALL. PINFALL WINS. ROPE BREAKS.",
        "ANYTHING GOES. NO ROPE BREAKS.",
        "FIRST TO WIN TWO PINFALLS.",
        "PIN HIM, OR CLIMB OUT (X AT THE WALL).",
        "NO PINS. KEEP HIM DOWN FOR A 10 COUNT." };
    int cur = 0, dirty = 1;
    while (1) {
        if (dirty) {
            dirty = 0;
            u16 *fb = ui_back;
            for (int y = 0; y < 192; y++) fill_rect(fb, 0, y, 256, y + 1, RGB15(3 + y / 40, 2 + y / 60, 6 + y / 26));
            for (int y = 0; y < 24; y++) fill_rect(fb, 0, y, 256, y + 1, RGB15(25 - y / 2, 3, 5));
            fill_rect(fb, 0, 24, 256, 26, RGB15(29, 23, 7));
            draw_text_c(fb, font_big_bin, 128, 3, "SINGLE MATCH", RGB15(31, 31, 31));
            for (int i = 0; i < MT_COUNT; i++) {
                int y0 = 32 + i * 27;
                u16 bg = i == cur ? RGB15(30, 22, 5) : RGB15(8, 9, 17), ed = i == cur ? RGB15(31, 30, 20) : RGB15(15, 16, 24);
                fill_rect(fb, 8, y0, 248, y0 + 24, ed); fill_rect(fb, 9, y0 + 1, 247, y0 + 23, bg);
                draw_text(fb, font_big_bin, 16, y0 + 4, MATCH_TYPE_NAME[i], i == cur ? RGB15(6, 3, 0) : RGB15(31, 31, 31));
            }
            fill_rect(fb, 0, 168, 256, 192, RGB15(2, 2, 5)); fill_rect(fb, 0, 168, 256, 169, RGB15(29, 23, 7));
            draw_text_c(fb, font_ui_bin, 128, 171, DESC[cur], RGB15(31, 28, 12));
            draw_text(fb, font_ui_bin, 6, 181, "TAP, OR D-PAD + A      B: BACK", RGB15(20, 21, 27));
            ui_flip(sub);
        }
        input_scan();
        u32 k = keys_down();
        if (k & KEY_B) return -1;
        if (k & (KEY_A | KEY_START)) return cur;
        if (k & KEY_DOWN) { cur = (cur + 1) % MT_COUNT; dirty = 1; }
        if (k & KEY_UP) { cur = (cur + MT_COUNT - 1) % MT_COUNT; dirty = 1; }
        if (k & KEY_TOUCH) {
            touchPosition tp; touch_get(&tp);
            if (tp.px >= 8 && tp.px < 248 && tp.py >= 32 && tp.py < 32 + MT_COUNT * 27) {
                int i = (tp.py - 32) / 27;
                if (i == cur) return cur;           // second tap on the highlighted row starts it
                cur = i; dirty = 1;
            }
        }
        frame++;
        top_orbit();
        swiWaitForVBlank();
    }
}

// Camera presets: hard cam sway, high wide, and a low ringside angle; the STORY button cycles them.
static void camera(int mode)
{
    float t = frame * 0.006f;
    float ex, ey, ez, tx = 0, ty = 1.4f, tz = 0;
    if (mode == 0) { ex = sinf(t) * 3.5f; ey = 4.4f; ez = 8.6f; }
    else if (mode == 1) { ex = sinf(t * 0.7f) * 9.0f; ey = 9.5f; ez = cosf(t * 0.7f) * 9.0f; }
    else { ex = 5.8f; ey = 1.6f; ez = 5.8f + sinf(t) * 1.0f; ty = 2.0f; }
    gluLookAt(ex * SC, ey * SC, ez * SC, tx * SC, ty * SC, tz * SC, 0, 1, 0);
}


// WRCF: u8 count, u8 matchType (0-4, 5 = ask), u8 pad[2], then count records of 40 bytes: name[16], sex, skin, hair, hairc, eyes, beard, top, pants, boots, height(x100), build(x100), fin, heel, theme preset, key, tempo
static const int SLOT[8] = { C_STEVE, C_AUSTIN, C_PYTHON, C_JOE, C_MICHELLE, C_DANNY, C_REBECCA, C_CLIFF };
static int roster[8], nroster, fixed_type = 5;
// FACE: u8 count, 3 pad, then count records: u8 roster slot, 3 pad, 64x64 RGB555 (8192 bytes) - the face wrap that replaces the generated face
static u16 face_ov[8][64 * 64]; static int face_has[8];
static void load_faces(void)
{
    const NrgHeader *H = (const NrgHeader *)nr_gamedata;
    if (H->used) for (unsigned i = 0; i < H->count; i++) if (!memcmp(H->sec[i].id, "FACE", 4)) {
        const unsigned char *p = nr_gamedata + H->sec[i].off; unsigned n = H->sec[i].size; int c = p[0];
        for (int k = 0; k < c && 4 + (k + 1) * 8196 <= (int)n; k++) { const unsigned char *r = p + 4 + k * 8196; int s = r[0] & 7; memcpy(face_ov[s], r + 4, 8192); face_has[s] = 1; }
    }
}
static void load_roster(void)
{
    load_faces();
    const NrgHeader *H = (const NrgHeader *)nr_gamedata;
    if (H->used) for (unsigned i = 0; i < H->count; i++) if (!memcmp(H->sec[i].id, "WRCF", 4)) {
        const unsigned char *p = nr_gamedata + H->sec[i].off; unsigned n = H->sec[i].size;
        int c = p[0]; if (c > 8) c = 8; fixed_type = p[1];
        for (int k = 0; k < c && 4 + (k + 1) * 40 <= (int)n; k++) { cast_define(SLOT[k], p + 4 + k * 40, face_has[k] ? face_ov[k] : 0); roster[nroster++] = SLOT[k]; }
    }
    if (nroster < 2) { nroster = 0; for (int k = 0; k < 8; k++) roster[nroster++] = SLOT[k]; }   // empty template: the stock cast
}
static void start_match(void)
{
    int mt = fixed_type < MT_COUNT ? fixed_type : pick_match_type();
    if (mt < 0) return;
    int p = pick_cast(sub, "CHOOSE YOUR WRESTLER", roster, nroster, top_orbit);
    if (p < 0) return;
    int o = pick_cast(sub, "CHOOSE YOUR OPPONENT", roster, nroster, top_orbit);
    if (o < 0) return;
    if (o == p) o = roster[(p == roster[0]) ? 1 : 0];
    match_type = mt;
    match_run(sub, p, o);
}
int main(void)
{
    defaultExceptionHandler();
    videoSetMode(MODE_0_3D);
    videoSetModeSub(MODE_5_2D);
    vramSetBankA(VRAM_A_TEXTURE);
    vramSetBankB(VRAM_B_TEXTURE);
    vramSetBankD(VRAM_D_TEXTURE);
    vramSetBankF(VRAM_F_TEX_PALETTE);
    vramSetBankC(VRAM_C_SUB_BG);
    int bg = bgInitSub(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0);
    sub = bgGetGfxPtr(bg);
    glInit();
    glEnable(GL_TEXTURE_2D | GL_ANTIALIAS | GL_BLEND | GL_OUTLINE);
    for (int i = 0; i < 8; i++) glSetOutlineColor(i, RGB15(3, 2, 5));
    glClearColor(4, 4, 8, 31);
    glClearPolyID(63);
    glClearDepth(0x7FFF);
    glViewport(0, 0, 255, 191);
    dmaCopy(splash_bin, sub, 256 * 192 * 2);
    for (int i = 0; i < 150; i++) swiWaitForVBlank();
    caw_init();
    tMat = load_tex(tex_mat_bin, 128, 128, 0);
    tApron = load_tex(tex_apron_bin, 256, 32, 0);
    { const unsigned char *as = aset_tex(nr_gamedata, ASET_SKY); tCrowd = load_tex(as ? (const void *)as : (const void *)tex_crowd_bin, 128, 64, 1); }
    { const unsigned char *as = aset_tex(nr_gamedata, ASET_LAND); tFloor = load_tex(as ? (const void *)as : (const void *)tex_floor_bin, 64, 64, 1); }
    tTron = load_tex(tex_tron_bin, 128, 64, 0);

    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluPerspective(48, 256.0 / 192.0, 0.05, 40);

    load_roster();
    while (1) start_match();
    return 0;
}

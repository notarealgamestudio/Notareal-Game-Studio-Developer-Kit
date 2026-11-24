// ICW: Indie Promotion - milestone 1 shell, 3D arena build.
// Top screen: real-time 3D arena on the DS 3D engine. Bottom screen: pre-rendered touch menu.
#include <nds.h>
#include <math.h>
#include <string.h>

#include "tex_mat_bin.h"
#include "tex_apron_bin.h"
#include "tex_crowd_bin.h"
#include "tex_floor_bin.h"
#include "tex_tron_bin.h"
#include "menu_0_bin.h"

#include "icw.h"
#include "font_ui_bin.h"
#include "font_big_bin.h"

// Bottom screen
static u16 *sub;
typedef struct { int x, y, w, h; } Button;
static const Button buttons[4] = { { 8, 40, 116, 60 }, { 132, 40, 116, 60 }, { 8, 108, 116, 60 }, { 132, 108, 116, 60 } };
static void show_menu(int hot)
{
    memcpy(ui_back, menu_0_bin, 256 * 192 * 2);
    if (hot >= 0) {                                   // gold frame around the highlighted button
        const Button *b = &buttons[hot];
        u16 c = RGB15(31, 26, 6);
        fill_rect(ui_back, b->x - 2, b->y - 2, b->x + b->w + 2, b->y + 2, c); fill_rect(ui_back, b->x - 2, b->y + b->h - 2, b->x + b->w + 2, b->y + b->h + 2, c);
        fill_rect(ui_back, b->x - 2, b->y, b->x + 2, b->y + b->h, c); fill_rect(ui_back, b->x + b->w - 2, b->y, b->x + b->w + 2, b->y + b->h, c);
    }
    ui_flip(sub);
}

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
static const int ROSTER[12] = { C_STEVE, C_REBECCA, C_AUSTIN, C_JOE, C_SQUID, C_MONTE, C_MICHELLE, C_PYTHON, C_DANNY, C_VANE, C_THIEF, C_CAW };
static const int STORY[9] = { C_STEVE, C_REBECCA, C_AUSTIN, C_JOE, C_SQUID, C_MONTE, C_MICHELLE, C_VANE, C_CAW };

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

static void start_match(void)
{
    int mt = pick_match_type();
    if (mt < 0) return;
    int p = pick_cast(sub, "CHOOSE YOUR WRESTLER", ROSTER, 12, top_orbit);
    if (p < 0) return;
    int o = pick_cast(sub, "CHOOSE YOUR OPPONENT", ROSTER, 12, top_orbit);
    if (o < 0 || o == p) { if (o == p) o = p == C_PYTHON ? C_STEVE : C_PYTHON; else return; }
    match_type = mt;
    match_run(sub, p, o);
}
static int pick_wrestler(void) { return pick_cast(sub, "WHOSE STORY?", STORY, 9, top_orbit); }

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

int main(void)
{
    defaultExceptionHandler();          // a crash shows a register dump instead of a frozen screen
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
    for (int i = 0; i < 8; i++) glSetOutlineColor(i, RGB15(3, 2, 5));   // dark silhouette edges (TNA / Tony Hawk DS: ~25% of edge pixels darker than the body)
    glClearColor(4, 4, 8, 31);
    glClearPolyID(63);
    glClearDepth(0x7FFF);
    glViewport(0, 0, 255, 191);

    caw_init();
    tMat = load_tex(tex_mat_bin, 128, 128, 0);
    tApron = load_tex(tex_apron_bin, 256, 32, 0);
    tCrowd = load_tex(tex_crowd_bin, 128, 64, 1);
    tFloor = load_tex(tex_floor_bin, 64, 64, 1);
    tTron = load_tex(tex_tron_bin, 128, 64, 0);

    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluPerspective(48, 256.0 / 192.0, 0.05, 40);

#if !defined(SKATE_TEST) && !defined(MATCH_TEST)
    intro_run(sub);
#endif
#ifdef WORLD_TEST
    world_run(sub, WORLD_TEST);
#endif
#ifdef INTERIOR_TEST
#ifdef PRELOAD_ALL
    for (int c = 0; c < C_COUNT; c++) cast_look(c);
#endif
    { void interior_run(u16 *, int); interior_run(sub, INTERIOR_TEST); }
#endif
#ifdef SKATE_TEST
    { void skate_test(u16 *); skate_test(sub); }
#endif
#ifdef MATCH_TEST
    { extern int skip_player_entrance; skip_player_entrance = 1; } match_type = 0; match_run(sub, C_STEVE, C_PYTHON);
#endif
#ifdef HOUSE_TEST
    house_run(sub, 0);
#endif
#ifdef ARCADE_TEST
    { void arcade_test(u16 *, int); arcade_test(sub, ARCADE_TEST); }
#endif
    int hot = -1, cam = 0;
    show_menu(hot);
    bgm_start(0);

    while (1) {
        glMatrixMode(GL_MODELVIEW);
        glLoadIdentity();
        camera(cam);
        draw_scene();
        glFlush(0);
        swiWaitForVBlank();
        frame++;

        input_scan();
        u32 k = keys_down();
        if (k & KEY_TOUCH) {
            touchPosition tp;
            touch_get(&tp);
            for (int i = 0; i < 4; i++) {
                const Button *b = &buttons[i];
                if (tp.px >= b->x && tp.px < b->x + b->w && tp.py >= b->y && tp.py < b->y + b->h) {
                    hot = i;
                    show_menu(hot);
                    if (i == 1) { int pk = pick_wrestler(); if (pk >= 0) story_run(sub, pk); hot = -1; show_menu(hot); }
                    if (i == 0) { start_match(); hot = -1; show_menu(hot); }
                    if (i == 2) { caw_run(sub); hot = -1; show_menu(hot); }
                    if (i == 3) { int pk = pick_cast(sub, "EXPLORE AS...", ROSTER, 12, top_orbit); if (pk >= 0) world_run(sub, pk); hot = -1; show_menu(hot); }
                }
            }
        }
        if (k & KEY_R) cam = (cam + 1) % 3;
        // buttons work too: D-pad moves the highlight, A opens it
        if (k & (KEY_LEFT | KEY_RIGHT | KEY_UP | KEY_DOWN)) {
            if (hot < 0) hot = 0;
            else if (k & (KEY_LEFT | KEY_RIGHT)) hot ^= 1;
            else hot ^= 2;
            show_menu(hot);
        }
        if ((k & KEY_A) && hot >= 0) {
            int i = hot;
            if (i == 1) { int pk = pick_wrestler(); if (pk >= 0) story_run(sub, pk); }
            if (i == 0) start_match();
            if (i == 2) caw_run(sub);
            if (i == 3) { int pk = pick_cast(sub, "EXPLORE AS...", ROSTER, 12, top_orbit); if (pk >= 0) world_run(sub, pk); }
            hot = -1; show_menu(hot);
        }
        if (k & KEY_START) { start_match(); hot = -1; show_menu(hot); }
    }
}

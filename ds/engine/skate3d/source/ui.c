// Bitmap-font text for the 16-bit bottom screen (atlases made by tools/gen_m1_assets.py).
#include "icw.h"

// atlas: [H,0,0,0] then 95 x {u16 width, u16 offset} then 8-bit coverage pixels
int text_width(const u8 *font, const char *s)
{
    int w = 0;
    for (; *s; s++) {
        int c = (u8)*s; if (c < 32 || c > 126) c = '?';
        w += ((const u16 *)(font + 4))[(c - 32) * 2] - 1;
    }
    return w;
}

void draw_text(u16 *fb, const u8 *font, int x, int y, const char *s, u16 col)
{
    int H = font[0];
    const u16 *tab = (const u16 *)(font + 4);
    const u8 *pix = font + 4 + 95 * 4;
    int cr = col & 31, cg = (col >> 5) & 31, cb = (col >> 10) & 31;
    for (; *s; s++) {
        int c = (u8)*s; if (c < 32 || c > 126) c = '?';
        int w = tab[(c - 32) * 2], off = tab[(c - 32) * 2 + 1];
        for (int yy = 0; yy < H; yy++) {
            int py = y + yy;
            if (py < 0 || py >= 192) continue;
            for (int xx = 0; xx < w; xx++) {
                int px = x + xx;
                if (px < 0 || px >= 256) continue;
                int a = pix[off + yy * w + xx];
                if (a < 24) continue;
                u16 *d = &fb[py * 256 + px];
                int dr = *d & 31, dg = (*d >> 5) & 31, db = (*d >> 10) & 31;
                dr += ((cr - dr) * a) >> 8; dg += ((cg - dg) * a) >> 8; db += ((cb - db) * a) >> 8;
                *d = RGB15(dr, dg, db) | BIT(15);
            }
        }
        x += w - 1;
    }
}

void draw_text_c(u16 *fb, const u8 *font, int cx, int y, const char *s, u16 col)
{
    draw_text(fb, font, cx - text_width(font, s) / 2, y, s, col);
}

void fill_rect(u16 *fb, int x0, int y0, int x1, int y1, u16 col)
{
    for (int y = y0; y < y1; y++)
        for (int x = x0; x < x1; x++)
            if (x >= 0 && x < 256 && y >= 0 && y < 192) fb[y * 256 + x] = col | BIT(15);
}

// ---------------------------------------------------------------- on-screen keyboard
#include "font_ui_bin.h"
#include "font_big_bin.h"
#include <string.h>

static const char *KROWS[3] = { "ABCDEFGHIJ", "KLMNOPQRST", "UVWXYZ.-'!" };

static void kb_draw(u16 *fb, const char *buf)
{
    for (int y = 0; y < 192; y++) fill_rect(fb, 0, y, 256, y + 1, RGB15(3 + y / 24, 3 + y / 48, 7 + y / 20));
    for (int y = 0; y < 24; y++) fill_rect(fb, 0, y, 256, y + 1, RGB15(25 - y / 2, 3, 5));
    fill_rect(fb, 0, 24, 256, 26, RGB15(29, 23, 7));
    draw_text_c(fb, font_big_bin, 128, 3, "ENTER RING NAME", RGB15(31, 31, 31));
    fill_rect(fb, 8, 31, 248, 55, RGB15(1, 1, 3));
    fill_rect(fb, 8, 54, 248, 55, RGB15(29, 23, 7));
    draw_text_c(fb, font_big_bin, 128, 34, buf, RGB15(31, 27, 10));
    if ((frame >> 4) & 1) { int w = text_width(font_big_bin, buf); fill_rect(fb, 128 + w / 2 + 2, 36, 128 + w / 2 + 4, 52, RGB15(31, 31, 31)); }
    for (int r = 0; r < 3; r++)
        for (int c = 0; c < 10; c++) {
            int x0 = 8 + c * 24, y0 = 62 + r * 26;
            fill_rect(fb, x0 + 1, y0, x0 + 23, y0 + 24, RGB15(9, 9, 16));
            fill_rect(fb, x0 + 1, y0, x0 + 23, y0 + 1, RGB15(16, 17, 26));
            char s[2] = { KROWS[r][c], 0 };
            draw_text_c(fb, font_ui_bin, x0 + 12, y0 + 6, s, RGB15(31, 31, 31));
        }
    int y0 = 62 + 3 * 26;
    fill_rect(fb, 9, y0, 127, y0 + 24, RGB15(9, 9, 16)); draw_text_c(fb, font_ui_bin, 68, y0 + 6, "SPACE", RGB15(31, 31, 31));
    fill_rect(fb, 129, y0, 183, y0 + 24, RGB15(14, 6, 6)); draw_text_c(fb, font_ui_bin, 156, y0 + 6, "DEL", RGB15(31, 31, 31));
    fill_rect(fb, 185, y0, 247, y0 + 24, RGB15(25, 18, 3)); draw_text_c(fb, font_ui_bin, 216, y0 + 6, "OK", RGB15(31, 31, 31));
}

int keyboard(u16 *fb, char *name, int maxlen, void (*top)(void))
{
    char buf[24];
    strncpy(buf, name, sizeof buf - 1); buf[sizeof buf - 1] = 0;
    int n = strlen(buf), fresh = 1;
    kb_draw(fb, buf);
    while (1) {
        frame++;
        input_scan();
        u32 kd = keys_down();
        int changed = (frame & 15) == 0;
        if (kd & KEY_B) return 0;
        if (kd & KEY_START) break;
        if (kd & KEY_TOUCH) {
            touchPosition tp; touch_get(&tp);
            int x = tp.px, y = tp.py;
            if (y >= 62 && y < 62 + 3 * 26 && x >= 8 && x < 248) {
                int r = (y - 62) / 26, c = (x - 8) / 24;
                if (fresh) { n = 0; buf[0] = 0; }
                if (n < maxlen) { buf[n++] = KROWS[r][c]; buf[n] = 0; }
            } else if (y >= 140 && y < 164) {
                if (x < 128) { if (n < maxlen && n > 0 && buf[n - 1] != ' ') { buf[n++] = ' '; buf[n] = 0; } }
                else if (x < 184) { if (n > 0) buf[--n] = 0; }
                else break;
            }
            changed = 1; fresh = 0;
        }
        if (changed) kb_draw(fb, buf);
        top();
        swiWaitForVBlank();
    }
    while (n > 0 && buf[n - 1] == ' ') buf[--n] = 0;
    if (n == 0) return 0;
    strcpy(name, buf);
    return 1;
}

// ---------------------------------------------------------------- input layer
// On real hardware the touch position is not valid on the first frame the pen lands, so a "tap" is reported
// on the first frame of a touch that has a valid position; if the pen lifts before that, on release.
static touchPosition tap_pos;
static int tap_now, tap_fired, tap_was, tap_seen;

void input_scan(void)
{
    snd_input();
    scanKeys();
    sfx_tick();
    if (keysDown() & (KEY_A | KEY_START)) sfx(SFX_OK);
    tap_now = 0;
    if (keysHeld() & KEY_TOUCH) {
        touchPosition t;
        touchRead(&t);
        int valid = (t.px != 0 || t.py != 0) && t.px < 256 && t.py < 192;
        if (valid) {
            tap_pos = t; tap_seen = 1;
            if (!tap_fired) { tap_fired = 1; tap_now = 1; sfx(SFX_UI); }
        }
        tap_was = 1;
    } else {
        if (tap_was && !tap_fired && tap_seen) tap_now = 1;
        tap_was = 0; tap_fired = 0; tap_seen = 0;
    }
}

u32 keys_down(void) { return (keysDown() & ~KEY_TOUCH) | (tap_now ? KEY_TOUCH : 0); }
void touch_get(touchPosition *t) { *t = tap_pos; }

// Off-screen buffer for bottom-screen redraws (draw here, then ui_flip to the screen in one copy: no flicker).
u16 ui_back[256 * 192];
// DMA reads main RAM, not the CPU cache: flush first or the screen gets a stale mix of old and new pixels.
void ui_flip(u16 *dst) { DC_FlushRange(ui_back, sizeof ui_back); dmaCopy(ui_back, dst, sizeof ui_back); }

// Crop the face out of a 64x64 head texture as a 46x46 portrait.
void face_to_portrait(const u16 *tex, u16 *out)
{
    for (int y = 0; y < 46; y++) for (int x = 0; x < 46; x++) out[y * 46 + x] = tex[(11 + y) * 64 + 17 + x * 30 / 46] | BIT(15);
}

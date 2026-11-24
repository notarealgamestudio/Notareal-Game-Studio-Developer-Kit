/* N64 front end for the software 3D world engine: 320x240 16bpp framebuffer, joypad (+ stick), two square voices and a noise burst. */
#include <libdragon.h>
#include <string.h>
#include "notareal_splash.h"
#include "../source/w3core.c"
static int bf[2], bl[2], nz; static uint32_t bph[2], lfsr = 1;
void h_blip(int hz, int ch) { bf[ch & 1] = hz; bl[ch & 1] = 9; }
void h_shot(int big) { nz = big ? 14 : 8; }
static void snd_fill(void)
{
    if (!audio_can_write()) return;
    short *b = audio_write_begin(); int n = audio_get_buffer_length(), i, v;
    for (i = 0; i < n; i++)
    {   int s = 0;
        for (v = 0; v < 2; v++) if (bl[v]) { bph[v] += (uint32_t)bf[v] * 65536u / 32000u; s += ((bph[v] & 0xFFFF) < 32768 ? 1 : -1) * 2200; }
        if (nz) { lfsr = (lfsr >> 1) ^ (-(lfsr & 1u) & 0xB400u); s += (lfsr & 1 ? 1 : -1) * nz * 220; }
        b[i * 2] = b[i * 2 + 1] = (short)s;
    }
    audio_write_end();
    for (v = 0; v < 2; v++) if (bl[v]) bl[v]--;
    if (nz) nz--;
}
unsigned h_keys(void)
{
    unsigned r = 0; joypad_poll(); joypad_buttons_t h = joypad_get_buttons_held(JOYPAD_PORT_1); joypad_inputs_t in = joypad_get_inputs(JOYPAD_PORT_1);
    if (h.d_up || in.stick_y > 25) r |= KEY_UP; if (h.d_down || in.stick_y < -25) r |= KEY_DOWN;
    if (h.d_left || h.c_left || in.stick_x < -25) r |= KEY_LEFT; if (h.d_right || h.c_right || in.stick_x > 25) r |= KEY_RIGHT;
    if (h.l) r |= KEY_L; if (h.r) r |= KEY_R; if (h.a) r |= KEY_A; if (h.b || h.z) r |= KEY_B; if (h.c_down) r |= KEY_X; if (h.c_up) r |= KEY_Y; if (h.start) r |= KEY_SELECT;
    return r;
}
void h_present(const u16 *fb)
{
    surface_t *d = display_get(); u16 *dst = (u16 *)d->buffer; int stride = d->stride / 2;
    for (int y = 0; y < 240; y++) { u16 *row = dst + y * stride; const u16 *s = fb + y * 320; for (int x = 0; x < 320; x++) { u16 c = s[x]; row[x] = (u16)(((c & 31) << 11) | (((c >> 5) & 31) << 6) | (((c >> 10) & 31) << 1) | 1); } }
    data_cache_hit_writeback(d->buffer, d->stride * d->height);
    display_show(d); snd_fill();
}
int main(void)
{
    debug_init_isviewer(); debug_init_usblog();
    dfs_init(DFS_DEFAULT_LOCATION);
    display_init(RESOLUTION_320x240, DEPTH_16_BPP, 3, GAMMA_NONE, FILTERS_DISABLED);
    joypad_init(); audio_init(32000, 4);
    notareal_splash_cpu();          /* every Notareal ROM opens on the logo */
    w3_run();
    return 0;
}

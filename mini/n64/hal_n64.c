/* N64 HAL for the mini engine: software PPU into a 320x240 16bpp framebuffer (240x160 centred), joypad, two square voices. */
#include <libdragon.h>
#include <string.h>
#include "../../n64/notareal_splash.h"
#include "../src/hal.h"
#define SP_COL(c) ((u16)((((c) & 31) << 11) | ((((c) >> 5) & 31) << 6) | ((((c) >> 10) & 31) << 1) | 1))
#define SP_DARK(c) ((u16)((((c) >> 1) & 0x7BDE) | 1))
#include "../src/softppu.h"
#include "../src/notes_gb.h"
void game_main(void);
static u8 voice_note[2], voice_vol[2]; static uint32_t ph[2];
void hal_snd_init(void) { audio_init(32000, 4); }
void hal_tone(u8 v, u8 note, u8 vol) { voice_note[v] = note; voice_vol[v] = vol; }
static void snd_fill(void) {
    if (!audio_can_write()) return;
    short *b = audio_write_begin(); int n = audio_get_buffer_length(), i, v;
    for (i = 0; i < n; i++) {
        int s = 0;
        for (v = 0; v < 2; v++) if (voice_note[v]) {
            /* frequency from the GB register table: f = 131072 / (2048 - reg) Hz; phase accumulator at 32 kHz */
            uint32_t f = 131072u / (2048u - NOTE_REG[voice_note[v] - 24]);
            ph[v] += f * 65536u / 32000u; s += ((ph[v] & 0xFFFF) < 32768 ? 1 : -1) * voice_vol[v] * 90;
        }
        b[i * 2] = b[i * 2 + 1] = (short)s;
    }
    audio_write_end();
}
u8 hal_pad(void) {
    u8 r = 0; joypad_poll(); joypad_buttons_t h = joypad_get_buttons_held(JOYPAD_PORT_1);
    if (h.d_right || h.c_right) r |= P_R; if (h.d_left || h.c_left) r |= P_L; if (h.d_down) r |= P_D; if (h.d_up) r |= P_U;
    if (h.a || h.z) r |= P_A; if (h.b) r |= P_B; if (h.start) r |= P_START;
    return r;
}
void hal_frame(void) {
    int x, y; surface_t *d = display_get(); u16 *dst = (u16 *)d->buffer; int stride = d->stride / 2;
    sp_render();
    for (y = 0; y < 240; y++) for (x = 0; x < 320; x++) dst[y * stride + x] = 1;
    for (y = 0; y < SPH; y++) { u16 *row = dst + (40 + y) * stride + 40; for (x = 0; x < SPW; x++) row[x] = sp_fb[y * SPW + x]; }
    data_cache_hit_writeback(d->buffer, d->stride * d->height);
    display_show(d); snd_fill();
}
int main(void) {
    debug_init_isviewer(); debug_init_usblog();
    dfs_init(DFS_DEFAULT_LOCATION);
    display_init(RESOLUTION_320x240, DEPTH_16_BPP, 3, GAMMA_NONE, FILTERS_DISABLED);
    joypad_init();
    notareal_splash_cpu();          /* every Notareal ROM opens on the logo */
    game_main();
    return 0;
}

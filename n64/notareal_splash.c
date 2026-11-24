#include <libdragon.h>
#include "notareal_splash.h"

DEFINE_RSP_UCODE(rsp_nrcheck);

/* Returns true if the emulator runs custom RSP code (needed by rdpq/GL). */
bool notareal_rsp_works(void)
{
    volatile uint32_t *dmem = (volatile uint32_t *)0xA4000000;
    rsp_init();
    rsp_load(&rsp_nrcheck);
    dmem[0x100/4] = 0;
    for (int i = 0xFC0/4; i < 0x1000/4; i++) dmem[i] = 0;   // OSTask area = 0 so HLE plugins see "no task"
    rsp_run_async();
    for (int spin = 0; spin < 2000000; spin++) {
        if (dmem[0x100/4] == 0x4E524B54) return true;
        if ((*SP_STATUS & SP_STATUS_HALTED) && spin > 1000) break;
    }
    return dmem[0x100/4] == 0x4E524B54;
}

/* CPU-only screen (works with any plugin): logo + how to fix the core settings. Never returns. */
void notareal_rsp_help_screen(void)
{
    sprite_t *logo = sprite_load("rom:/nr_logo.sprite");
    joypad_init();
    while (1) {
        surface_t *d = display_get();
        graphics_fill_screen(d, 0);
        graphics_draw_sprite(d, (display_get_width() - logo->width) / 2, 0, logo);
        graphics_set_color(0xFFFFFFFF, 0);
        int y = 172;   /* 40 columns x 6 lines fit under the 170px logo */
        graphics_draw_text(d, 4, y,      "Set RetroArch > Quick Menu > Core Opts:");
        graphics_draw_text(d, 4, y + 11, "ParaLLEl N64:");
        graphics_draw_text(d, 4, y + 22, " CPU Core   = Cached Interpreter");
        graphics_draw_text(d, 4, y + 33, " RSP Plugin = parallel (or cxd4)");
        graphics_draw_text(d, 4, y + 44, " GFX Plugin = angrylion");
        graphics_draw_text(d, 4, y + 55, "Then close content and start again.");
        display_show(d);
    }
}


void notareal_boot_check(void)
{
    if (!notareal_rsp_works()) notareal_rsp_help_screen();
}

void notareal_splash(void)
{
    sprite_t *s = sprite_load("rom:/nr_logo.sprite");
    int w = display_get_width(), h = display_get_height();
    for (int f = 0; f < 150; f++) {
        surface_t *d = display_get();
        rdpq_attach_clear(d, NULL);
        rdpq_set_mode_copy(false);
        rdpq_sprite_blit(s, (w - s->width) / 2, (h - s->height) / 2, NULL);
        rdpq_detach_show();
        joypad_poll();
        joypad_buttons_t p = joypad_get_buttons_pressed(JOYPAD_PORT_1);
        if (f > 45 && (p.start || p.a)) break;
    }
    rspq_wait();
    sprite_free(s);
}

/* CPU-only logo splash: works with every core/plugin combination (no RSP/RDP).
   Use this in "CPU mode" games that must run on stock handheld settings. */
void notareal_splash_cpu(void)
{
    sprite_t *s = sprite_load("rom:/nr_logo.sprite");
    int w = display_get_width(), h = display_get_height();
    for (int f = 0; f < 150; f++) {
        surface_t *d = display_get();
        graphics_fill_screen(d, 0);
        graphics_draw_sprite(d, (w - s->width) / 2, (h - s->height) / 2, s);
        display_show(d);
        joypad_poll();
        joypad_buttons_t p = joypad_get_buttons_pressed(JOYPAD_PORT_1);
        if (f > 45 && (p.start || p.a)) break;
    }
    sprite_free(s);
}

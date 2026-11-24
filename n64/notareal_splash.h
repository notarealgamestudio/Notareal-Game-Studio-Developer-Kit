#pragma once
/* NOTAREAL kit rule: every ROM opens on the NOTAREAL logo.
 * Call after dfs_init, display_init, rdpq_init and joypad_init, and BEFORE gl_init / any 3D setup
 * (calling it between gl_init and GL setup hung the RSP queue in testing).
 * Needs rom:/nr_logo.sprite in the filesystem (notareal.mk adds it). */
void notareal_splash(void);
void notareal_splash_cpu(void);   /* CPU-only logo, works on stock handheld settings */

#include <stdbool.h>
/* Call right after dfs_init + display_init and BEFORE rdpq_init/gl_init/rspq_init:
 * checks that custom RSP microcode runs (LLE RSP); if not, shows a CPU-drawn help screen
 * with the emulator settings to change, instead of hanging or crashing. */
void notareal_boot_check(void);
bool notareal_rsp_works(void);
void notareal_rsp_help_screen(void);

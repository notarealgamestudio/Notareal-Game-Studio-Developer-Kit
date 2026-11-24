/* NOTAREAL Game Studio - PSX kit helpers (PSn00bSDK) */
#pragma once
#include <stdint.h>
/* Full-screen 320x240 logo (15-bit raw, made by the kit's asset tool), shown for ~2.5 s.
   Call right after ResetGraph(0) and before setting up your own display buffers.
   Every Notareal ROM opens on this screen. */
void notareal_psx_splash(const uint32_t *splash_raw);

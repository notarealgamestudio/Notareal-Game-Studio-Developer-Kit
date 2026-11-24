#include <stdint.h>
#include <psxgpu.h>
#include <psxapi.h>
#include <psxpad.h>
#include "notareal_psx.h"

void notareal_psx_splash(const uint32_t *splash_raw)
{
    DISPENV disp; DRAWENV draw;
    SetDefDispEnv(&disp, 0, 0, 320, 240);
    SetDefDrawEnv(&draw, 0, 0, 320, 240);
    PutDispEnv(&disp); PutDrawEnv(&draw);
    RECT r = {0, 0, 320, 240};
    LoadImage(&r, splash_raw);
    DrawSync(0);
    VSync(0);
    SetDispMask(1);
    for (int f = 0; f < 150; f++) VSync(0);
}

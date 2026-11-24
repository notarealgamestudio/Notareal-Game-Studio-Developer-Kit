// NOTAREAL Game Studio - DS 3D skating game. The game (park, skater, goals) is the SKCF section of the data block; see skate3d.c.
#include "icw.h"
#include <nds.h>
#include <string.h>
#include "splash_bin.h"
void skate_boot(u16 *);
u16 *sub;
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
    glEnable(GL_TEXTURE_2D | GL_ANTIALIAS | GL_BLEND);
    glClearColor(4, 4, 8, 31);
    glClearPolyID(63);
    glClearDepth(0x7FFF);
    glViewport(0, 0, 255, 191);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluPerspective(48, 256.0 / 192.0, 0.05, 40);
    dmaCopy(splash_bin, sub, 256 * 192 * 2);                       // NOTAREAL logo first
    for (int i = 0; i < 150; i++) swiWaitForVBlank();
    skate_boot(sub);
    return 0;
}

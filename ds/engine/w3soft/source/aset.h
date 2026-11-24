// aset.h - the shared asset library as the DS engines see it. The editor writes an 'ASET' section (see kit/nrassets.js):
// byte 0 = flags (1 sky, 2 land, 4 wall), then the textures that are present, in that order, already in the engine's 'PT' texture format.
#pragma once
#include <string.h>
#define ASET_SKY 0
#define ASET_LAND 1
#define ASET_WALL 2
static inline const unsigned char *aset_tex(const unsigned char *gd, int which)    // NULL when the game did not pick that texture
{
    static const unsigned sz[3] = { 4 + 512 + 128 * 64, 4 + 32 + 64 * 32, 4 + 32 + 64 * 32 };
    unsigned used = gd[12] | gd[13] << 8 | gd[14] << 16 | gd[15] << 24; if (!used || memcmp(gd, "NRGDATA1", 8)) return 0;
    unsigned n = gd[16] | gd[17] << 8; if (n > 16) return 0;
    for (unsigned i = 0; i < n; i++) { const unsigned char *s = gd + 20 + i * 12; if (memcmp(s, "ASET", 4)) continue;
        unsigned off = s[4] | s[5] << 8 | s[6] << 16, flags, at = 4; const unsigned char *p = gd + off; flags = p[0];
        for (int k = 0; k < 3; k++) { if (flags & (1 << k)) { if (k == which) return p + at; at += sz[k]; } else if (k == which) return 0; }
    }
    return 0;
}

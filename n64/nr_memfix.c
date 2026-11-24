/* NOTAREAL kit: memcpy/memset replacements that never emit SWL/SWR/SDL/SDR.
 * Older ParaLLEl N64 ARM64 recompilers (RG DS Plus and similar handhelds) emit a BRK
 * trap for unaligned-store instructions whose address is outside cached RDRAM, e.g.
 * the uncached framebuffer at 0xA0xxxxxx. newlib's memcpy/memset use those
 * instructions for misaligned copies, so the core crashes with SIGTRAP mid-game.
 * Built with -fno-builtin so GCC doesn't turn these loops back into memcpy calls. */
#include <stddef.h>
#include <stdint.h>

void *memcpy(void *dst, const void *src, size_t n)
{
    uint8_t *d = dst; const uint8_t *s = src;
    if ((((uintptr_t)d ^ (uintptr_t)s) & 3) == 0) {
        while (n && ((uintptr_t)d & 3)) { *d++ = *s++; n--; }
        uint32_t *dw = (uint32_t *)d; const uint32_t *sw = (const uint32_t *)s;
        for (; n >= 16; n -= 16) { dw[0] = sw[0]; dw[1] = sw[1]; dw[2] = sw[2]; dw[3] = sw[3]; dw += 4; sw += 4; }
        for (; n >= 4; n -= 4) *dw++ = *sw++;
        d = (uint8_t *)dw; s = (const uint8_t *)sw;
    } else if ((((uintptr_t)d ^ (uintptr_t)s) & 1) == 0) {
        if (n && ((uintptr_t)d & 1)) { *d++ = *s++; n--; }
        uint16_t *dh = (uint16_t *)d; const uint16_t *sh = (const uint16_t *)s;
        for (; n >= 2; n -= 2) *dh++ = *sh++;
        d = (uint8_t *)dh; s = (const uint8_t *)sh;
    }
    while (n--) *d++ = *s++;
    return dst;
}

void *memset(void *dst, int c, size_t n)
{
    uint8_t *d = dst; uint8_t b = (uint8_t)c;
    while (n && ((uintptr_t)d & 3)) { *d++ = b; n--; }
    uint32_t w = b * 0x01010101u, *dw = (uint32_t *)d;
    for (; n >= 4; n -= 4) *dw++ = w;
    d = (uint8_t *)dw;
    while (n--) *d++ = b;
    return dst;
}

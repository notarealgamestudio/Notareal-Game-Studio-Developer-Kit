// The game data block. The dev kit's editor finds "NRGDATA1" in the ROM and writes the game over it.
// Lives in its own file so the compiler can't assume the bytes stay zero.
#include "nrg.h"
__attribute__((aligned(16), used)) const unsigned char nr_gamedata[NRG_CAPACITY] = {
    'N', 'R', 'G', 'D', 'A', 'T', 'A', '1',
    NRG_CAPACITY & 255, (NRG_CAPACITY >> 8) & 255, (NRG_CAPACITY >> 16) & 255, (NRG_CAPACITY >> 24) & 255,
};

#include "../source/nrg.h"
__attribute__((aligned(16), used)) const unsigned char nr_gamedata[NRG_CAPACITY] = { 'N', 'R', 'G', 'D', 'A', 'T', 'A', '1', NRG_CAPACITY & 255, (NRG_CAPACITY >> 8) & 255, (NRG_CAPACITY >> 16) & 255, (NRG_CAPACITY >> 24) & 255, };

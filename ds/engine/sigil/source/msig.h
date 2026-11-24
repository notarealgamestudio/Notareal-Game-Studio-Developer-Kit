// MEMPHIS SIGIL project format ".msig" v1 (little endian). Pure C, no hardware calls, so the same code is unit-tested on the host.
//   "MSIG" u16 version u16 payload_size | payload | u32 crc32 (of everything before it)
//   payload: name[16] u16 bpm u8 swing u8 master u8 npat u8 chainlen chain[16] u8 songmode u8 bassnote snd[8] pitch[8] vol[8] | npat x ( pat[8][32] note[32] )
#pragma once
#include <stdint.h>
#include <string.h>
#define MS_VER 2
#define MS_ROWS 8
#define MS_STEPS 32
#define MS_PATS 5
typedef struct { char name[16]; uint16_t bpm; uint8_t swing, master, npat, chainlen, chain[16], songmode, bassnote, snd[MS_ROWS]; int8_t pitch[MS_ROWS]; uint8_t vol[MS_ROWS], tape, bassv; uint8_t pat[MS_PATS][MS_ROWS][MS_STEPS]; uint8_t note[MS_PATS][MS_STEPS]; } Proj;
#define MS_SIZE_V1 (8 + 16 + 2 + 4 + 16 + 2 + 8 + 8 + 8 + MS_PATS * (MS_ROWS * MS_STEPS + MS_STEPS) + 4)
#define MS_SIZE (2 + 8 + 16 + 2 + 4 + 16 + 2 + 8 + 8 + 8 + MS_PATS * (MS_ROWS * MS_STEPS + MS_STEPS) + 4)
static inline uint32_t ms_crc(const uint8_t *p, int n) { uint32_t c = 0xFFFFFFFFu; for (int i = 0; i < n; i++) { c ^= p[i]; for (int k = 0; k < 8; k++) c = (c >> 1) ^ (0xEDB88320u & (0u - (c & 1))); } return ~c; }
static inline int ms_pack(const Proj *P, uint8_t *b)
{
    int o = 0; b[o++] = 'M'; b[o++] = 'S'; b[o++] = 'I'; b[o++] = 'G'; b[o++] = MS_VER; b[o++] = 0; int sz = o; o += 2;
    memcpy(b + o, P->name, 16); o += 16; b[o++] = P->bpm & 255; b[o++] = P->bpm >> 8; b[o++] = P->swing; b[o++] = P->master; b[o++] = P->npat; b[o++] = P->chainlen;
    memcpy(b + o, P->chain, 16); o += 16; b[o++] = P->songmode; b[o++] = P->bassnote; memcpy(b + o, P->snd, 8); o += 8; for (int i = 0; i < 8; i++) b[o++] = (uint8_t)P->pitch[i]; memcpy(b + o, P->vol, 8); o += 8; b[o++] = P->tape; b[o++] = P->bassv;
    for (int p = 0; p < MS_PATS; p++) { memcpy(b + o, P->pat[p], MS_ROWS * MS_STEPS); o += MS_ROWS * MS_STEPS; memcpy(b + o, P->note[p], MS_STEPS); o += MS_STEPS; }
    int pay = o - (sz + 2); b[sz] = pay & 255; b[sz + 1] = pay >> 8; uint32_t c = ms_crc(b, o); b[o++] = c; b[o++] = c >> 8; b[o++] = c >> 16; b[o++] = c >> 24; return o;
}
// returns 0 ok, 1 too short, 2 bad magic, 3 version too new, 4 bad crc, 5 size mismatch
static inline int ms_unpack(Proj *P, const uint8_t *b, int n)
{
    if (n < 12) return 1; if (memcmp(b, "MSIG", 4)) return 2; int ver = b[4] | b[5] << 8; if (ver > MS_VER) return 3; int pay = b[6] | b[7] << 8; if (n < 8 + pay + 4) return 1;
    uint32_t c = ms_crc(b, 8 + pay), s = b[8 + pay] | b[9 + pay] << 8 | b[10 + pay] << 16 | (uint32_t)b[11 + pay] << 24; if (c != s) return 4; if (pay != (ver == 1 ? MS_SIZE_V1 : MS_SIZE) - 12) return 5;
    int o = 8; memcpy(P->name, b + o, 16); o += 16; P->bpm = b[o] | b[o + 1] << 8; o += 2; P->swing = b[o++]; P->master = b[o++]; P->npat = b[o++]; P->chainlen = b[o++]; memcpy(P->chain, b + o, 16); o += 16; P->songmode = b[o++]; P->bassnote = b[o++];
    memcpy(P->snd, b + o, 8); o += 8; for (int i = 0; i < 8; i++) P->pitch[i] = (int8_t)b[o++]; memcpy(P->vol, b + o, 8); o += 8; if (ver >= 2) { P->tape = b[o++]; P->bassv = b[o++]; } else { P->tape = 0; P->bassv = 0xFF; }
    for (int p = 0; p < MS_PATS; p++) { memcpy(P->pat[p], b + o, MS_ROWS * MS_STEPS); o += MS_ROWS * MS_STEPS; memcpy(P->note[p], b + o, MS_STEPS); o += MS_STEPS; }
    if (P->bpm < 40 || P->bpm > 240 || P->npat > MS_PATS || P->chainlen > 16) return 5; return 0;
}

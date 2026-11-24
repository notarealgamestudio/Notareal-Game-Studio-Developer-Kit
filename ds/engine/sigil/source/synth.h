// MEMPHIS SIGIL drum synth: original sounds, pure integer maths, no hardware calls (host-testable, mirrored in kit/nrsigil.js).
// Every sound is rendered once at boot into signed 8-bit PCM at SY_HZ. Two tune bytes per sound (0..127) come from the Korg DS-10 patch bank
// (library/korg_ds10_m01.json) so the kit's drum voices vary the way the DS-10 drum patches do.
#pragma once
#include <stdint.h>
#define SY_HZ 22050
#define SY_N 12
enum { S_KICK808, S_KICKPUNCH, S_SNARE, S_CLAP, S_CHAT, S_OHAT, S_COWBELL, S_RIM, S_METALHAT, S_PERC, S_BASS808, S_SNARE2 };
static const char *const SY_NAME[SY_N] = { "808 KICK", "PUNCH KICK", "SNARE", "CLAP", "CLOSED HAT", "OPEN HAT", "COWBELL", "RIMSHOT", "METAL HAT", "PERC TOM", "808 BASS", "SNAP SNARE" };
static const char *const SY_SHORT[SY_N] = { "KICK", "PNCH", "SNR", "CLAP", "CHAT", "OHAT", "COWB", "RIM", "METL", "PERC", "BASS", "SNP2" };
static const int SY_LEN[SY_N] = { 11025, 5512, 4851, 5512, 1543, 8820, 6615, 1323, 3308, 6615, 19845, 4410 };
// tune bytes lifted from the DS-10 patches KICK1,KICK2,SNARE1,SNARE3(clap),HIHAT,HIHAT,ZAP(cowbell),SNARE2(rim),HIHAT,TOM,BASS5,SNARE2  (patch bytes 11,12)
static const uint8_t SY_TUNE[SY_N][2] = { {0x11,0x4c},{0x11,0x43},{0x1d,0x44},{0x1d,0x21},{0x7f,0x00},{0x7f,0x01},{0x15,0x1c},{0x39,0x00},{0x7f,0x03},{0x3e,0x00},{0x0e,0x61},{0x39,0x00} };
#define SY_ROOT_MIDI 33   // the bass sample is tuned to A1
static int16_t sy_lut[256];
static void sy_init(void)
{   // 256-entry sine from Bhaskara's integer approximation (error < 0.2%), identical on host, DS and in kit/nrsigil.js
    for (int i = 0; i < 256; i++) { int x = i < 128 ? i : i - 128; int u = x * (128 - x); int s = (int)((int64_t)32767 * 16 * u / (81920 - 4 * u)); sy_lut[i] = (int16_t)(i < 128 ? s : -s); }
}
static inline int sy_osc(uint32_t ph) { return sy_lut[ph >> 24]; }
static inline uint32_t sy_inc(int fq8) { return (uint32_t)(((int64_t)fq8 * 194783) >> 8); }   // Hz in Q8 -> phase step at 22050 Hz
typedef struct { uint32_t s; } SyRng;
static inline int sy_noise(SyRng *r) { r->s ^= r->s << 13; r->s ^= r->s >> 17; r->s ^= r->s << 5; return (int)(int16_t)(r->s >> 8); }
static inline int sy_sat(int v) { return v > 127 ? 127 : v < -128 ? -128 : v; }
// returns number of samples written (== SY_LEN[id])
static int sy_render(int id, int8_t *o)
{
    int n = SY_LEN[id], t0 = SY_TUNE[id][0], t1 = SY_TUNE[id][1]; SyRng r = { 0x9E3779B9u + id * 2654435u }; uint32_t ph = 0, ph2 = 0, ph3 = 0; int env = 32767, envf = 32767, px = 0, p2 = 0;
    for (int i = 0; i < n; i++)
    {   int v = 0;
        switch (id)
        {
        case S_KICK808: { int f = (40 << 8) + (t0 << 7) / 17 * 2 + ((int)((int64_t)envf * (110 << 8) >> 15)); ph += sy_inc(f); v = (int)((int64_t)sy_osc(ph) * env >> 15); envf = envf * 32723 >> 15; env = env * (32760 - (t1 >> 5)) >> 15; if (i < 40) v += (i < 20 ? 6000 : -6000) * (40 - i) / 40; v = v * 3 / 2; v = v > 32767 ? 32767 : v < -32768 ? -32768 : v; break; }
        case S_KICKPUNCH: { int f = (52 << 8) + ((int)((int64_t)envf * (260 << 8) >> 15)); ph += sy_inc(f); v = (int)((int64_t)sy_osc(ph) * env >> 15) * 2; v = v > 32767 ? 32767 : v < -32768 ? -32768 : v; envf = envf * 32701 >> 15; env = env * 32747 >> 15; break; }
        case S_SNARE: case S_SNARE2: { int fr = id == S_SNARE ? 185 + (t0 >> 3) : 240 + (t0 >> 3); ph += sy_inc(fr << 8); int tone = (int)((int64_t)sy_osc(ph) * envf >> 15); int nz = (int)((int64_t)sy_noise(&r) * env >> 15); v = (tone * (id == S_SNARE ? 5 : 3) >> 3) + (nz * (id == S_SNARE ? 5 : 7) >> 3); envf = envf * 32731 >> 15; env = env * (id == S_SNARE ? 32744 : 32723) >> 15; break; }
        case S_CLAP: { int nz = sy_noise(&r); int hp = nz - px; px = nz; int g = 0; int ms = i * 1000 / SY_HZ; if (ms < 6 || (ms >= 11 && ms < 17) || (ms >= 22 && ms < 28)) g = 32767; else if (ms >= 28) g = env; if (ms >= 28) env = env * 32747 >> 15; v = (int)((int64_t)hp * g >> 15); break; }
        case S_CHAT: case S_OHAT: { int nz = sy_noise(&r); int hp = nz - px; px = nz; v = (int)((int64_t)hp * env >> 15) ; env = env * (id == S_CHAT ? 32664 : 32755) >> 15; break; }
        case S_COWBELL: { ph += sy_inc(540 << 8); ph2 += sy_inc(800 << 8); int a = ph >> 31 ? 14000 : -14000, b = ph2 >> 31 ? 14000 : -14000; v = (int)((int64_t)(a + b) * env >> 15); env = env * 32753 >> 15; break; }
        case S_RIM: { ph += sy_inc(1700 << 8); ph2 += sy_inc(480 << 8); v = (int)(((int64_t)sy_osc(ph) + sy_osc(ph2)) * env >> 15) / 2; if (i < 10) v += (i & 1 ? -9000 : 9000); env = env * 32634 >> 15; break; }
        case S_METALHAT: { static const int m[6] = { 411, 616, 854, 1115, 1394, 1685 }; int a = 0; ph += 1; ph2 += 1; for (int k = 0; k < 6; k++) { uint32_t q = sy_inc(m[k] << 8) * (uint32_t)(i + 1); a += (q >> 31) ? 3500 : -3500; } v = (int)((int64_t)a * env >> 15); env = env * 32726 >> 15; break; }
        case S_PERC: { int f = (110 << 8) + (int)((int64_t)envf * (130 << 8) >> 15) + t0 * 12; ph += sy_inc(f); v = (int)((int64_t)sy_osc(ph) * env >> 15); envf = envf * 32738 >> 15; env = env * 32750 >> 15; break; }
        case S_BASS808: { ph += sy_inc((55 << 8) + 32); ph3 = ph; int s1 = sy_osc(ph); int s2 = sy_osc(ph * 2) >> 2; v = (int)((int64_t)(s1 + s2) * env >> 15); v = v * 5 / 4; v = v > 32767 ? 32767 : v < -32768 ? -32768 : v; env = env * (32764 - (t1 >> 5)) >> 15; if (i > n - 400) v = v * (n - i) / 400; if (i < 30) v = v * i / 30; break; }
        }
        (void)ph3; (void)p2; o[i] = (int8_t)sy_sat(v >> 8);
    }
    return n;
}
// sample rate for a pitched row: semitone offset from the sample's root
static const uint16_t SY_SEMI_Q8[13] = { 256, 271, 287, 304, 322, 341, 362, 383, 406, 430, 456, 483, 512 };  // 2^(k/12) in Q8
static inline int sy_rate(int semis) { int oct = 0; while (semis >= 12) { semis -= 12; oct++; } while (semis < 0) { semis += 12; oct--; } int hz = (SY_HZ * SY_SEMI_Q8[semis]) >> 8; return oct >= 0 ? hz << oct : hz >> -oct; }

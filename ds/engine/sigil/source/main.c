// MEMPHIS SIGIL - Notareal Game Studios. DS music-production workstation prototype (drum machine + 16-step sequencer + song chain).
// Top screen: playback feedback + a "sigil" generated from the pattern data. Bottom screen: stylus editing. All drum sounds are original, synthesised at boot (synth.h).
// Sequencing runs from a hardware-timer interrupt at 96 PPQ (24 ticks per 16th); the ARM7 mailbox sampler (snd.c) plays the voices.
#include <nds.h>
#include <fat.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <unistd.h>
#include "nrg.h"
#include "msig.h"
#include "synth.h"
#include "groove_bank.h"
#include "font_bin.h"
#include "splash_bin.h"

void snd_sample_ch(int ch, const void *data, u32 bytes, int fmt, int hz, int vol, int pan, int loop);
void snd_stop(int ch);
void snd_master(int vol);
void snd_input(void);
void snd_vol(int ch, int vol);
extern const unsigned char nr_gamedata[];
typedef struct { char magic[8]; unsigned capacity, used, count; NrgSection sec[]; } NrgHdr;

#define RGB(r, g, b) (RGB15(r, g, b) | BIT(15))
#define C_BLK RGB(1, 1, 2)
#define C_CHAR RGB(5, 5, 7)
#define C_CHAR2 RGB(8, 8, 10)
#define C_PURP RGB(6, 3, 10)
#define C_PURPH RGB(11, 6, 17)
#define C_GOLD RGB(21, 17, 6)
#define C_GOLDH RGB(29, 25, 11)
#define C_SILV RGB(20, 20, 23)
#define C_RED RGB(24, 3, 3)
#define C_WHITE RGB(30, 30, 30)
static u16 topb[256 * 192], botb[256 * 192];
static u16 *topv, *botv;

// ---------------------------------------------------------------- state shared with the sequencer interrupt
static Proj P;
static int8_t wav[80000] __attribute__((aligned(32)));
static int wavoff[SY_N];
enum { EDIT_PAT_MAX = MS_PATS };
static void bass_fire(int semis, int vel);
static void tape_apply(int fx);
static int bass_len;
static volatile int editpat, playing, rec, step, tick, chainpos, flash[8], vstep, vpat;
typedef struct { uint8_t t, row, vel; int8_t semis; } Q;
static Q queue[32];
static volatile unsigned qw, qr;
static const uint8_t ROWPAN[8] = { 64, 64, 80, 40, 90, 100, 30, 64 };
static void qput(int t, int row, int vel, int semis) { unsigned w = qw; if (w - qr >= 32) return; queue[w & 31] = (Q){ t, row, vel, semis }; qw = w + 1; }

static void fire(int row, int vel, int semis)
{
    int s = P.snd[row]; if (s >= SY_N) s = 0; int hz = sy_rate(P.pitch[row] + semis);
    int v = vel * P.vol[row] / 127; if (v > 127) v = 127;
    if (row == 7 && P.bassv < 8) { bass_fire(semis, v); flash[row] = 10; return; }
    if (row == 3) snd_stop(4);                                         // closed hat chokes the open hat
    snd_sample_ch(row, wav + wavoff[s], SY_LEN[s] & ~3, 0, hz, v, ROWPAN[row], 0);
    flash[row] = 10;
}
static void trig_step(int pp, int st)
{
    for (int r = 0; r < 8; r++) { int v = P.pat[pp][r][st]; if (v) fire(r, v, r == 7 ? P.note[pp][st] + (P.bassnote - SY_ROOT_MIDI) : 0); }
}
static void seq_isr(void)
{
    while (qr != qw)
    {   Q q = queue[qr & 31]; qr++;
        if (q.t == 0) { fire(q.row, q.vel, q.semis); if (rec && playing) { int pp = P.songmode ? P.chain[chainpos] : editpat; int s = (step + (tick >= 12)) & 15; P.pat[pp][q.row][s] = q.vel ? q.vel : 100; if (q.row == 7) P.note[pp][s] = q.semis - (P.bassnote - SY_ROOT_MIDI); } }
        else if (q.t == 1) { for (int c = 0; c < 8; c++) snd_stop(c); }
        else if (q.t == 2) snd_master(q.vel);
    }
    if (bass_len > 0 && --bass_len == 0) snd_stop(7);
    if (!playing) return;
    int pp = P.songmode ? P.chain[chainpos] : editpat; if (pp >= MS_PATS) pp = 0;
    int sw = (step & 1) ? P.swing : 0;
    if (tick == sw) { vstep = step; vpat = pp; trig_step(pp, step); }
    if (++tick >= 24)
    {   tick = 0; if (++step >= 16) { step = 0; if (P.songmode && P.chainlen) { if (++chainpos >= P.chainlen) chainpos = 0; } } }
}
static void seq_timer(void) { timerStop(0); timerStart(0, ClockDivider_64, TIMER_FREQ_64(P.bpm * 8 / 5), seq_isr); }

// ---------------------------------------------------------------- 2D drawing on RAM framebuffers
static u16 *fb;
static inline void px(int x, int y, u16 c) { if ((unsigned)x < 256 && (unsigned)y < 192) fb[y * 256 + x] = c; }
static void rect(int x, int y, int w, int h, u16 c) { for (int j = y; j < y + h; j++) for (int i = x; i < x + w; i++) px(i, j, c); }
static void frame(int x, int y, int w, int h, u16 c) { for (int i = x; i < x + w; i++) { px(i, y, c); px(i, y + h - 1, c); } for (int j = y; j < y + h; j++) { px(x, j, c); px(x + w - 1, j, c); } }
static void text(int x, int y, const char *s, u16 c) { for (; *s; s++, x += 8) { int ch = *s; if (ch >= 'a' && ch <= 'z') ch -= 32; if (ch <= 32 || ch > 127) continue; const u8 *g = font_bin + (ch - 32) * 64; for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) if (g[j * 8 + i]) px(x + i, y + j, c); } }
static void textc(int cx, int y, const char *s, u16 c) { text(cx - (int)strlen(s) * 4, y, s, c); }
static void line(int x0, int y0, int x1, int y1, u16 c)
{
    int dx = x1 > x0 ? x1 - x0 : x0 - x1, dy = y1 > y0 ? y0 - y1 : y1 - y0, sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (int n = 0; n < 600; n++) { px(x0, y0, c); if (x0 == x1 && y0 == y1) break; int e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
static inline int sn(int a) { return sy_lut[a & 255]; }
static inline int cs(int a) { return sy_lut[(a + 64) & 255]; }
static void hgrad(int y0, int y1, u16 ca, u16 cb) { for (int y = y0; y < y1; y++) { int t = (y - y0) * 32 / (y1 - y0); int r = ((ca & 31) * (32 - t) + (cb & 31) * t) >> 5, g = (((ca >> 5) & 31) * (32 - t) + ((cb >> 5) & 31) * t) >> 5, b = (((ca >> 10) & 31) * (32 - t) + ((cb >> 10) & 31) * t) >> 5; for (int x = 0; x < 256; x++) fb[y * 256 + x] = RGB(r, g, b); } }

// ---------------------------------------------------------------- touch + buttons (immediate mode)
static int pdown, pheld, prel, tx_, ty_, holdf, lastx, lasty, rep;
static int hit(int x, int y, int w, int h, int ax, int ay) { return ax >= x && ax < x + w && ay >= y && ay < y + h; }
static int button(int x, int y, int w, int h, const char *lab, int on, int repeat)
{
    int inside = hit(x, y, w, h, tx_, ty_) && pheld;
    rect(x, y, w, h, on ? C_PURPH : inside ? C_CHAR2 : C_CHAR); frame(x, y, w, h, on ? C_GOLD : C_PURP);
    int tw = (int)strlen(lab) * 8; text(x + (w - tw) / 2, y + (h - 8) / 2, lab, on ? C_GOLDH : C_SILV);
    if (!hit(x, y, w, h, tx_, ty_)) return 0;
    if (pdown) return 1; if (repeat && pheld && holdf > 18 && (holdf % 5) == 0) return 1; return 0;
}

// ---------------------------------------------------------------- project / files
static uint8_t ramslot[8][MS_SIZE + 16]; static int ramlen[8]; static int sd_ok, slot, slotfile[8];
static char msg[40] = "READY"; static int msgt;
static void say(const char *s) { strncpy(msg, s, 39); msg[39] = 0; msgt = 240; }
static void default_project(void)
{
    memset(&P, 0, sizeof P); strcpy(P.name, "FIRST SESSION"); P.bpm = 92; P.swing = 3; P.master = 110; P.npat = MS_PATS; P.chainlen = 4; P.chain[0] = 0; P.chain[1] = 0; P.chain[2] = 1; P.chain[3] = 0; P.bassnote = 33; P.bassv = 0xFF; P.tape = 0;
    const uint8_t sd[8] = { S_KICK808, S_SNARE, S_CLAP, S_CHAT, S_OHAT, S_COWBELL, S_RIM, S_BASS808 }; for (int r = 0; r < 8; r++) { P.snd[r] = sd[r]; P.vol[r] = 100; P.pitch[r] = 0; }
    P.vol[0] = 118; P.vol[3] = 80; P.vol[5] = 70; P.vol[7] = 115;
    static const uint8_t kA[16] = { 1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0 }, kB[16] = { 1,0,0,1, 0,0,0,0, 1,0,1,0, 0,0,0,1 };
    for (int p = 0; p < 2; p++) for (int s = 0; s < 16; s++)
    {   const uint8_t *k = p ? kB : kA; if (k[s]) P.pat[p][0][s] = s == 0 ? 127 : 100;
        if (s == 4 || s == 12) { P.pat[p][1][s] = 118; P.pat[p][2][s] = 80; }
        if (!(s & 1)) P.pat[p][3][s] = (s & 3) ? 64 : 90; else if (p) P.pat[p][3][s] = 40;
        if (s == 14) P.pat[p][4][s] = 90; if (p && s == 7) P.pat[p][5][s] = 90; if (s == 10 && p) P.pat[p][6][s] = 90;
    }
    static const uint8_t bs[16] = { 1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0 }; static const int8_t bn[16] = { 0,0,0,0, 0,0,0,7, 0,0,3,0, 0,0,0,0 };
    for (int p = 0; p < 2; p++) for (int s = 0; s < 16; s++) if (bs[s]) { P.pat[p][7][s] = 105; P.note[p][s] = bn[s] + (p && s == 10 ? 2 : 0); }
    for (int p = 2; p < MS_PATS; p++) for (int r = 0; r < 8; r++) for (int s = 0; s < 16; s++) P.pat[p][r][s] = GRV[(p * 7 + 1) % GRV_N][r][s];   // C-E start as Korg M01 grooves
    for (int s = 0; s < 16; s++) P.pat[2][7][s] = 0; for (int p = 3; p < MS_PATS; p++) for (int s = 0; s < 16; s++) P.pat[p][7][s] = 0;
}
static void load_cfg(void)
{
    const NrgHdr *H = (const NrgHdr *)nr_gamedata; if (!H->used) return;
    for (unsigned i = 0; i < H->count; i++) if (!memcmp(H->sec[i].id, "SGPJ", 4)) { Proj t; if (!ms_unpack(&t, nr_gamedata + H->sec[i].off, H->sec[i].size)) P = t; }
}
static void after_load(void) { if (P.tape > 4) P.tape = 0; if (P.bassv > 7 && P.bassv != 0xFF) P.bassv = 0xFF; tape_apply(P.tape); }
static void slotpath(char *o, int n, const char *ext) { sprintf(o, "fat:/MEMPHIS_SIGIL/PROJECTS/SONG_%03d%s", n + 1, ext); }
static int rdfile(const char *p, Proj *t)
{
    FILE *f = fopen(p, "rb"); if (!f) return 9; static uint8_t b[MS_SIZE + 16]; int n = fread(b, 1, sizeof b, f); fclose(f); return ms_unpack(t, b, n);
}
static int save_slot(int n)
{
    static uint8_t b[MS_SIZE + 16]; int len = ms_pack(&P, b); memcpy(ramslot[n], b, len); ramlen[n] = len; if (!sd_ok) return 1;
    char p[64], tmp[64], bak[64]; slotpath(p, n, ".msig"); slotpath(tmp, n, ".tmp"); slotpath(bak, n, ".bak");
    FILE *f = fopen(tmp, "wb"); if (!f) return 2; int w = fwrite(b, 1, len, f); fclose(f); if (w != len) { remove(tmp); return 2; }
    Proj chk; if (rdfile(tmp, &chk)) { remove(tmp); return 3; }                      // verify before replacing the good file
    remove(bak); rename(p, bak); if (rename(tmp, p)) return 2; slotfile[n] = 1; return 0;
}
static int load_slot(int n)
{
    Proj t; char p[64]; int r;
    if (sd_ok) { slotpath(p, n, ".msig"); if (!(r = rdfile(p, &t))) { P = t; after_load(); return 0; } slotpath(p, n, ".bak"); if (!rdfile(p, &t)) { P = t; after_load(); return 4; } }   // 4 = recovered from .bak
    if (ramlen[n] && !ms_unpack(&t, ramslot[n], ramlen[n])) { P = t; after_load(); return 1; }
    return 9;
}

// ---------------------------------------------------------------- UI state
enum { SC_MENU, SC_STUDIO, SC_ABOUT, SC_HOLLOW };
enum { T_SEQ, T_PADS, T_808, T_SONG, T_FILE, T_TAPE, T_KEYS };
static int scene = SC_MENU, tab = T_SEQ, selrow, grv, clip_ok, oct, frames;
static struct { uint8_t pat[8][32]; uint8_t note[32]; } clip;
static unsigned rngs = 0x1234567;
static int rnd(void) { rngs ^= rngs << 13; rngs ^= rngs >> 17; rngs ^= rngs << 5; return rngs & 0x7fffffff; }
static void set_bpm(int b) { if (b < 40) b = 40; if (b > 240) b = 240; if (b != P.bpm) { P.bpm = b; seq_timer(); } }
static void transport_play(int on) { if (on) { step = 0; tick = 0; chainpos = 0; playing = 1; } else { playing = 0; qput(1, 0, 0, 0); } }
static void rand_pattern(int p)
{
    memset(P.pat[p], 0, sizeof P.pat[p]); memset(P.note[p], 0, sizeof P.note[p]);
    for (int s = 0; s < 16; s++)
    {   if (s == 0 || (!(s & 3) && rnd() % 3 == 0) || (s & 1 && rnd() % 7 == 0) || (s == 10 && rnd() & 1)) P.pat[p][0][s] = s ? 100 : 127;
        if (s == 4 || s == 12) { P.pat[p][1][s] = 118; if (rnd() & 1) P.pat[p][2][s] = 85; } else if (rnd() % 11 == 0) P.pat[p][1][s] = 50;
        if (!(s & 1)) P.pat[p][3][s] = 55 + (rnd() % 4) * 14; else if (rnd() % 4 == 0) P.pat[p][3][s] = 40;
        if (s == 14 && rnd() % 3 == 0) P.pat[p][4][s] = 90; if (rnd() % 14 == 0) P.pat[p][5][s] = 80; if (rnd() % 16 == 0) P.pat[p][6][s] = 80;
        if (rnd() % 5 == 0) { P.pat[p][7][s] = 100; P.note[p][s] = (int[]){ 0, 0, 3, 5, 7, 10, 12 }[rnd() % 7]; }
    }
}

// ---------------------------------------------------------------- screens
static void draw_sigil(int cx, int cy, int R)
{
    int rot = (frames * P.bpm) >> 6; int pp = playing ? vpat : editpat; int cur = playing ? vstep : -1;
    for (int i = 0; i < 64; i++) line(cx + (R * cs(i * 4)) / 32767, cy + (R * sn(i * 4)) / 32767, cx + (R * cs(i * 4 + 4)) / 32767, cy + (R * sn(i * 4 + 4)) / 32767, C_CHAR2);
    int nx[16], ny[16];
    for (int i = 0; i < 16; i++) { int a = i * 16 + (rot >> 3) - 64; nx[i] = cx + (R * cs(a)) / 32767; ny[i] = cy + (R * sn(a)) / 32767; }
    for (int s = 0; s < 16; s++)
    {   if (P.pat[pp][0][s]) line(nx[s], ny[s], nx[(s + 5) & 15], ny[(s + 5) & 15], C_SILV);
        if (P.pat[pp][1][s]) line(nx[s], ny[s], nx[(s + 7) & 15], ny[(s + 7) & 15], C_RED);
        if (P.pat[pp][2][s]) line(nx[s], ny[s], nx[(s + 3) & 15], ny[(s + 3) & 15], C_GOLD);
        if (P.pat[pp][5][s] || P.pat[pp][6][s]) { rect(nx[s] - 2, ny[s] - 2, 5, 5, C_GOLDH); }
    }
    int seen[13] = { 0 }, nn = 0; for (int s = 0; s < 16; s++) if (P.pat[pp][7][s] && P.note[pp][s] >= 0 && P.note[pp][s] < 13 && !seen[(int)P.note[pp][s]]) { seen[(int)P.note[pp][s]] = 1; nn++; }
    int sides = 3 + nn; if (sides > 9) sides = 9; int r2 = R * 6 / 10;
    for (int i = 0; i < sides; i++) { int a0 = i * 256 / sides - rot, a1 = ((i + 2) % sides) * 256 / sides - rot; if (sides % 2 == 0) a1 = ((i + 1) % sides) * 256 / sides - rot;
        line(cx + (r2 * cs(a0)) / 32767, cy + (r2 * sn(a0)) / 32767, cx + (r2 * cs(a1)) / 32767, cy + (r2 * sn(a1)) / 32767, C_PURPH); }
    int hatn = 0; for (int s = 0; s < 16; s++) hatn += P.pat[pp][3][s] ? 1 : 0; int r3 = R * 3 / 10;
    for (int i = 0; i < 16; i++) if (i < hatn) { int a = i * 16 + rot; px(cx + (r3 * cs(a)) / 32767, cy + (r3 * sn(a)) / 32767, C_SILV); px(cx + (r3 * cs(a)) / 32767 + 1, cy + (r3 * sn(a)) / 32767, C_SILV); }
    for (int k = 0; k < P.chainlen; k++) { int a = k * 256 / (P.chainlen ? P.chainlen : 1) - 64; int rr = R + 7; rect(cx + (rr * cs(a)) / 32767 - 1, cy + (rr * sn(a)) / 32767 - 1, 3, 3, (P.songmode && k == chainpos && playing) ? C_GOLDH : C_PURPH); }
    int kr = 3 + flash[0]; for (int i = 0; i < 24; i++) { int a = i * 256 / 24; px(cx + (kr * cs(a)) / 32767, cy + (kr * sn(a)) / 32767, flash[0] ? C_RED : C_PURPH); }
    for (int i = 0; i < 16; i++) { int on = 0; for (int r = 0; r < 8; r++) if (P.pat[pp][r][i]) on = 1; u16 c = i == cur ? C_WHITE : on ? C_GOLD : C_PURP; int sz = i == cur ? 3 : on ? 2 : 1; rect(nx[i] - sz / 2, ny[i] - sz / 2, sz, sz, c); }
}
static void draw_top(void)
{
    fb = topb; hgrad(0, 192, C_BLK, C_PURP); static const char *nm[] = { "A", "B", "C", "D", "E" };
    textc(128, 4, "MEMPHIS SIGIL", C_GOLDH); textc(128, 14, "NOTAREAL GAME STUDIOS", C_SILV); line(40, 25, 216, 25, C_GOLD);
    if (scene == SC_STUDIO || scene == SC_MENU) draw_sigil(128, 104, 56);
    if (scene == SC_STUDIO)
    {   char b[32]; sprintf(b, "BPM %d", P.bpm); text(6, 32, b, C_GOLDH); sprintf(b, "PAT %s", nm[(playing ? vpat : editpat) % 5]); text(6, 44, b, C_SILV);
        sprintf(b, "STEP %02d", (playing ? vstep : 0) + 1); text(6, 56, b, C_SILV); text(6, 68, playing ? (rec ? "REC" : "PLAY") : "STOP", rec && playing ? C_RED : playing ? C_GOLDH : C_CHAR2);
        text(6, 80, P.songmode ? "SONG" : "LOOP", C_PURPH); if (P.songmode) { sprintf(b, "POS %d/%d", chainpos + 1, P.chainlen); text(6, 92, b, C_PURPH); }
        text(6, 170 - 26, P.name, C_CHAR2);
        for (int r = 0; r < 8; r++) { int h = flash[r] * 4; rect(238, 34 + r * 18, 12, 14, C_CHAR); rect(238, 34 + r * 18 + 14 - h * 14 / 40, 12, h * 14 / 40, r == 0 ? C_RED : C_GOLD); text(218, 37 + r * 18, SY_SHORT[P.snd[r]], C_CHAR2); }
        int cur = playing ? vstep : -1, pp = playing ? vpat : editpat;
        for (int i = 0; i < 16; i++) { int on = 0; for (int r = 0; r < 8; r++) if (P.pat[pp][r][i]) on = 1; rect(24 + i * 13, 170, 10, 8, i == cur ? C_GOLDH : on ? C_PURPH : C_CHAR); if (!(i & 3)) rect(24 + i * 13, 180, 10, 2, C_GOLD); }
    }
    else if (scene == SC_MENU) textc(128, 172, "STYLUS TO CHOOSE", C_CHAR2);
    char b[40]; sprintf(b, "RAM %dK", (int)((sizeof wav + sizeof topb * 2 + sizeof ramslot + sizeof P) / 1024)); text(190, 182, b, C_CHAR2); text(6, 182, "MS PROTOTYPE 0.1", C_CHAR2);
}
static void note_name(int midi, char *o) { static const char *n[] = { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" }; sprintf(o, "%s%d", n[midi % 12], midi / 12 - 1); }
static int dcell_r = -1, dcell_s = -1, dpaint, dmoved, dcycled;
static void cell_set(int r, int s, int v) { P.pat[editpat][r][s] = v; }

// ---------------------------------------------------------------- TAPE: six-track mixtape (slots 1-6) + tape deck (lo-fi on the drum sounds)
static int8_t wav0[80000] __attribute__((aligned(32)));      // the clean rendered sounds; the tape deck re-colours a copy of these
static int tape_fx;                                          // 0 CLEAN, 1 WARM, 2 WORN, 3 RADIO, 4 DEAD
static const char *TAPE_NAMES[5] = { "CLEAN", "WARM", "WORN", "RADIO", "DEAD" };
enum { SG_GRAVE = 1, SG_EYE = 2, SG_SIX = 4, SG_CANDLE = 8, SG_SERP = 16, SG_DEAD = 32 };
typedef struct { uint8_t day, week, battles, gigs, hollow, sigils, beaten; uint16_t cash, respect; } Prog;
static Prog pg; static int career;                          // career = playing through The Hollow (sigils lock sounds); FREE STUDIO has everything
static int ok_bit(int bit) { return !career || !bit || (pg.sigils & bit); }
static int key_lock(int v) { static const uint8_t L[12] = { 0, 0, 0, 0, 0, SG_CANDLE, SG_EYE, SG_DEAD, 0, 0, 0, SG_SERP }; return L[v]; }
static int bass_lock(int v) { static const uint8_t L[8] = { 0, 0, 0, 0, 0, SG_GRAVE, SG_SERP, SG_GRAVE }; return L[v]; }
static int kenv_on, kenv_t, kenv_rel, kenv_perc, kenv_v;
static int hsub;
static int mix_done_shown;
static void tape_apply(int fx)
{   static const uint8_t lp[5] = { 255, 150, 110, 70, 90 }, bits[5] = { 8, 8, 6, 5, 4 }, gain[5] = { 16, 22, 26, 18, 34 };
    tape_fx = fx; P.tape = (uint8_t)fx; int total = 0; for (int i = 0; i < SY_N; i++) { int e = (wavoff[i] + SY_LEN[i] + 3) & ~3; if (e > total) total = e; }
    int off = 0; for (int i = 0; i < SY_N; i++)
    {   int n = SY_LEN[i] & ~3, y = 0; int8_t *d = wav + wavoff[i]; const int8_t *c = wav0 + wavoff[i]; (void)off;
        for (int k = 0; k < n; k++)
        {   int v = c[k]; v = (v * gain[fx]) >> 4; if (v > 127) v = 127; if (v < -128) v = -128;
            y += ((v - y) * lp[fx]) >> 8; v = fx ? y : v; v &= ~((1 << (8 - bits[fx])) - 1); d[k] = (int8_t)v; }
    }
    DC_FlushRange(wav, sizeof wav);
}
static void slot_name(int n, char *o) { o[0] = 0; if (!ramlen[n]) return; memcpy(o, ramslot[n] + 8, 15); o[15] = 0; }
static int tape_filled(void) { int c = 0; for (int i = 0; i < 6; i++) if (ramlen[i] || slotfile[i]) c++; return c; }
static void tape_bottom(int top)
{   char b[40]; int filled = tape_filled(); sprintf(b, "TAPE 001   %d/6 TRACKS", filled); text(4, top, b, C_GOLD);
    for (int i = 0; i < 6; i++)
    {   int x = 3 + (i % 3) * 84, y = top + 12 + (i / 3) * 34, used = ramlen[i] || slotfile[i];
        rect(x, y, 80, 31, slot == i ? C_PURPH : C_CHAR); frame(x, y, 80, 31, used ? C_GOLD : C_PURP);
        sprintf(b, "TRACK %02d", i + 1); text(x + 4, y + 3, b, used ? C_GOLDH : C_SILV);
        char nm[16]; slot_name(i, nm); if (used) { nm[10] = 0; text(x + 4, y + 14, nm[0] ? nm : "SAVED", C_SILV); } else text(x + 4, y + 14, "EMPTY", C_CHAR2);
        if (pdown && hit(x, y, 80, 31, tx_, ty_)) slot = i;
    }
    if (button(3, top + 82, 56, 15, "SAVE", 0, 0)) { int r = save_slot(slot); say(r == 0 ? "SAVED TO SD" : r == 1 ? "SAVED TO RAM" : r == 3 ? "VERIFY FAILED" : "SD WRITE ERROR"); }
    if (button(62, top + 82, 56, 15, "LOAD", 0, 0)) { int r = load_slot(slot); say(r == 9 ? "NOTHING IN SLOT" : "LOADED"); if (r != 9) seq_timer(); }
    text(124, top + 86, "TAPE DECK", C_GOLD);
    for (int i = 0; i < 5; i++) if (button(3 + i * 50, top + 100, 48, 15, (i >= 3 && !ok_bit(SG_DEAD)) ? "LOCK" : TAPE_NAMES[i], tape_fx == i, 0)) { if (i >= 3 && !ok_bit(SG_DEAD)) say("NEEDS DEAD FREQUENCY"); else { tape_apply(i); say(TAPE_NAMES[i]); } }
    if (filled >= 6) { text(4, top + 118, "MIXTAPE COMPLETE", C_GOLDH); if (!mix_done_shown) { mix_done_shown = 1; say("THE HOLLOW UNLOCKED"); } } else { sprintf(b, "SAVE %d MORE TO UNLOCK", 6 - filled); text(4, top + 118, b, C_SILV); }
    text(4, top + 130, msg, C_GOLDH);
}

// ---------------------------------------------------------------- KEYS: Crypt Keys (12 voices), Bass voices (8) and the Bone Sampler (12 pads). All sounds are synthesised at boot.
// Keys and bass loop a 128-sample cycle on ARM7 channel 8 (one stylus = one note); the sampler plays one-shots on channel 14. No envelopes: a key sounds while the stylus is held.
#define KW 128
#define BN 6000
static int8_t kw[20][KW] __attribute__((aligned(32)));
static int8_t bw[12 * BN] __attribute__((aligned(32)));
static const char *const KEY_NAME[12] = { "MINOR PIANO", "HAUNTED ORGAN", "CHOIR PAD", "COLD STRINGS", "DETUNED BELLS", "BLACK CANDLE", "CHAPEL CHOIR", "RADIO GHOST", "CHURCH ORGAN", "VINYL KEYS", "FOG PAD", "FUNK CLAV" };
static const char *const BASSV_NAME[8] = { "SUB 808", "BLACK BASS", "REVEREND DRONE", "CASSETTE WOBBLE", "HOLLOW SQUARE", "DISTORTED LOW", "SERPENT FUNK", "GRAVEYARD GROWL" };
static const char *const BONE_NAME[12] = { "CRACKLE", "RADIO", "CHOIR HIT", "BELL TOLL", "TAPE STOP", "DOOR CREAK", "WHISPER", "ORGAN STAB", "HORROR DRONE", "CANDLE HISS", "GHOST VOX", "CHAIN" };
static const uint8_t KH[20][8] = {
    { 100, 50, 30, 20, 10, 6, 3, 2 }, { 100, 80, 60, 0, 40, 0, 0, 20 }, { 100, 30, 60, 20, 25, 10, 10, 5 }, { 100, 70, 55, 45, 35, 25, 18, 10 }, { 100, 0, 0, 60, 0, 0, 45, 35 }, { 100, 40, 10, 0, 0, 0, 0, 0 },
    { 80, 100, 50, 30, 15, 0, 10, 0 }, { 0, 0, 0, 0, 0, 0, 0, 0 }, { 100, 100, 0, 50, 0, 30, 0, 0 }, { 100, 15, 40, 5, 12, 0, 3, 0 }, { 100, 60, 0, 25, 0, 10, 0, 0 }, { 60, 100, 70, 90, 50, 40, 30, 20 },
    { 100, 0, 0, 0, 0, 0, 0, 0 }, { 100, 50, 33, 25, 20, 16, 14, 12 }, { 100, 60, 0, 0, 0, 0, 0, 0 }, { 100, 0, 50, 0, 30, 0, 20, 0 }, { 100, 0, 33, 0, 20, 0, 14, 0 }, { 100, 50, 33, 25, 20, 16, 14, 12 }, { 100, 70, 90, 40, 50, 20, 25, 10 }, { 100, 80, 70, 60, 50, 40, 40, 30 } };
static void keys_init(void)
{   SyRng r = { 0x51C0FFEEu };
    for (int v = 0; v < 20; v++)
    {   int sw = 0, mx = 1, tmp[KW]; for (int h = 0; h < 8; h++) sw += KH[v][h]; int lp = 0;
        for (int i = 0; i < KW; i++)
        {   int a = 0;
            if (sw) { for (int h = 0; h < 8; h++) if (KH[v][h]) a += KH[v][h] * (sy_osc((uint32_t)(i * (h + 1)) << 25) >> 4); a = a / sw; }
            else { int n = sy_noise(&r) >> 1; lp += (n - lp) >> 2; a = lp >> 1; }
            if (v == 17 || v == 19) a = a * 3;
            tmp[i] = a; if (a > mx) mx = a; if (-a > mx) mx = -a; }
        for (int i = 0; i < KW; i++) { int o = tmp[i] * 110 / mx; kw[v][i] = (int8_t)(o > 127 ? 127 : o < -128 ? -128 : o); }
    }
    for (int id = 0; id < 12; id++)
    {   SyRng q = { 0xB0E5u + id * 7919u }; uint32_t p1 = 0, p2 = 0; int lp = 0, px = 0, e = 32767; int8_t *o = bw + id * BN;
        for (int i = 0; i < BN; i++)
        {   int v = 0, nz = sy_noise(&q), fade = (BN - i) * 32767 / BN, rise = i * 32767 / BN, sw = i < BN / 2 ? rise * 2 : fade * 2; if (sw > 32767) sw = 32767;
            switch (id)
            {   case 0: v = (i % 53 == 0 || (nz & 255) < 3) ? ((nz >> 6) * 3) : (nz >> 9); v = (int)((int64_t)v * fade >> 15) * 2; break;
                case 1: lp += (nz - lp) >> 2; p1 += sy_inc(1000 << 8); v = (lp >> 1) + (sy_osc(p1) >> 4); v = (int)((int64_t)v * sw >> 15); break;
                case 2: p1 += sy_inc(220 << 8); p2 += sy_inc(223 << 8); v = (sy_osc(p1) + sy_osc(p2) + sy_osc(p1 * 2) / 2 + sy_osc(p2 * 3) / 3) / 2; v = (int)((int64_t)v * e >> 15); e = e * 32752 >> 15; break;
                case 3: p1 += sy_inc(262 << 8); p2 += sy_inc(655 << 8); v = (int)(((int64_t)sy_osc(p1) * 2 + sy_osc(p2)) * e >> 15) / 2; e = e * 32762 >> 15; break;
                case 4: p1 += sy_inc((int)((int64_t)fade * 300 >> 15) << 8) + 1; v = ((p1 >> 24) < 128 ? 12000 : -12000); v = (int)((int64_t)v * fade >> 15); break;
                case 5: p1 += sy_inc((90 + (sy_osc(i << 20) >> 11) + (i >> 7)) << 8); v = ((p1 >> 24) - 128) * 90; v += nz >> 5; v = (int)((int64_t)v * sw >> 15); break;
                case 6: { int hp = nz - px; px = nz; lp += (hp - lp) >> 1; v = (int)((int64_t)lp * sw >> 15); break; }
                case 7: p1 += sy_inc(196 << 8); p2 += sy_inc(294 << 8); v = ((p1 >> 31) ? 9000 : -9000) + ((p2 >> 31) ? 6000 : -6000); v = (int)((int64_t)v * e >> 15); e = e * 32700 >> 15; break;
                case 8: p1 += sy_inc(55 << 8); p2 += sy_inc(58 << 8); v = ((p1 >> 24) - 128) * 80 + ((p2 >> 24) - 128) * 80; v = (int)((int64_t)v * sw >> 15); break;
                case 9: { int hp = nz - px; px = nz; v = (int)((int64_t)hp * fade >> 15) >> 1; break; }
                case 10: p1 += sy_inc((330 + (sy_osc(i << 21) >> 10)) << 8); p2 += sy_inc(990 << 8); v = (sy_osc(p1) + sy_osc(p2) / 3 + (nz >> 4)) ; v = (int)((int64_t)v * sw >> 15); break;
                default: { int g = ((i >> 9) & 3) ? 0 : 1; if (g && (i & 511) == 0) e = 32767; p1 += sy_inc(2200 << 8); v = (int)(((int64_t)(nz >> 1) + sy_osc(p1)) * (g ? e : 0) >> 15); e = e * 32600 >> 15; break; }
            }
            o[i] = (int8_t)sy_sat(v >> 8);
        }
    }
    DC_FlushRange(kw, sizeof kw); DC_FlushRange(bw, sizeof bw);
}
static int key_hz(int m) { int s = m - 60, oct = 0; while (s >= 12) { s -= 12; oct++; } while (s < 0) { s += 12; oct--; } int hz = (33489 * SY_SEMI_Q8[s]) >> 8; return oct >= 0 ? hz << oct : hz >> -oct; }
static int kmode, kvoice[2], koct[2] = { 4, 2 }, keyhold = -1, bpitch;
static const uint8_t WKEY[8] = { 0, 2, 4, 5, 7, 9, 11, 12 }, BKEY_AT[5] = { 1, 2, 4, 5, 6 }, BKEY_SEMI[5] = { 1, 3, 6, 8, 10 };
static void key_on(int semis)
{   int m = 12 * (koct[kmode] + 1) + semis, v = kmode ? 12 + kvoice[1] : kvoice[0]; kenv_on = 1; kenv_t = 0; kenv_rel = 0; kenv_v = 0; kenv_perc = kmode ? 1 : (kvoice[0] == 0 || kvoice[0] == 4 || kvoice[0] == 9 || kvoice[0] == 11); snd_sample_ch(8, kw[v], KW, 0, key_hz(m), 15, 64, 1);
    if (kmode && rec && playing)
    {   int pp = P.songmode ? P.chain[chainpos] : editpat, s = (step + (tick >= 12)) & 15, n = m - P.bassnote; if (pp >= MS_PATS) pp = 0;
        if (n >= 0 && n <= 12) { P.pat[pp][7][s] = 100; P.note[pp][s] = n; } }
}
static void keys_env(void)                                  // one call per frame: attack, decay (struck sounds) and release of the held key
{
    if (kenv_on) { kenv_t++; int v = kenv_t < 5 ? kenv_t * 20 : 100; if (kenv_perc && kenv_t >= 5) { v = 100 - (kenv_t - 5) * 100 / 70; if (v < 0) v = 0; } kenv_v = v; snd_vol(8, v); }
    else if (kenv_rel > 0) { kenv_rel--; snd_vol(8, kenv_v * kenv_rel / 8); if (!kenv_rel) snd_stop(8); }
}
static void bass_fire(int semis, int vel) { int m = semis + SY_ROOT_MIDI; if (vel > 127) vel = 127; snd_sample_ch(7, kw[12 + P.bassv], KW, 0, key_hz(m), vel, 64, 1); bass_len = 21; }
static void keys_stop(void) { if (keyhold >= 0) { kenv_on = 0; kenv_rel = 8; keyhold = -1; } }
static void keys_bottom(int top)
{   static const char *mn[3] = { "KEYS", "BASS", "BONE" }; char b[40];
    for (int i = 0; i < 3; i++) if (button(3 + i * 84, top, 82, 13, mn[i], (i == 2 ? kmode == 2 : kmode == i), 0)) { keys_stop(); kmode = i; }
    if (kmode == 2)
    {   text(4, top + 17, "BONE SAMPLER - TAP A PAD", C_GOLD);
        for (int i = 0; i < 12; i++)
        {   int x = 3 + (i & 3) * 63, y = top + 30 + (i >> 2) * 30; int on = pheld && hit(x, y, 60, 27, tx_, ty_); rect(x, y, 60, 27, on ? C_GOLD : C_PURPH); frame(x, y, 60, 27, C_GOLD);
            char nm[8]; strncpy(nm, BONE_NAME[i], 7); nm[7] = 0; text(x + 3, y + 10, nm, on ? C_BLK : C_GOLDH);
            if (pdown && hit(x, y, 60, 27, tx_, ty_)) snd_sample_ch(14, bw + i * BN, BN, 0, sy_rate(bpitch), 110, 64, 0); }
        return; }
    int v = kmode; int *vs = &kvoice[v], n = v ? 8 : 12;
    if (button(3, top + 17, 22, 13, "<", 0, 1)) { keys_stop(); *vs = (*vs + n - 1) % n; } if (button(231, top + 17, 22, 13, ">", 0, 1)) { keys_stop(); *vs = (*vs + 1) % n; }
    textc(128, top + 20, v ? BASSV_NAME[*vs] : KEY_NAME[*vs], C_GOLDH);
    { int lk = kmode ? bass_lock(*vs) : key_lock(*vs);
      if (!ok_bit(lk)) { keys_stop(); text(8, top + 44, "LOCKED - WIN THE SIGIL:", C_RED); text(8, top + 58, lk == SG_GRAVE ? "GRAVE MARK" : lk == SG_EYE ? "HOLLOW EYE" : lk == SG_CANDLE ? "BLACK CANDLE" : lk == SG_SERP ? "SERPENT GROOVE" : "DEAD FREQUENCY", C_GOLDH); return; } }
    int ky = top + 34, kh = 58; int cur = -1;
    for (int i = 0; i < 8; i++) { int x = 4 + i * 31, on = (keyhold == WKEY[i]); rect(x, ky, 30, kh, on ? C_GOLD : C_SILV); frame(x, ky, 30, kh, C_CHAR); }
    for (int j = 0; j < 5; j++) { int x = 4 + BKEY_AT[j] * 31 - 9, on = (keyhold == BKEY_SEMI[j]); rect(x, ky, 18, 34, on ? C_GOLDH : C_BLK); frame(x, ky, 18, 34, C_CHAR2); }
    if (pheld && ty_ >= ky && ty_ < ky + kh && tx_ >= 4 && tx_ < 252)
    {   for (int j = 0; j < 5 && cur < 0; j++) { int x = 4 + BKEY_AT[j] * 31 - 9; if (ty_ < ky + 34 && tx_ >= x && tx_ < x + 18) cur = BKEY_SEMI[j]; }
        if (cur < 0) { int i = (tx_ - 4) / 31; if (i > 7) i = 7; cur = WKEY[i]; } }
    if (cur != keyhold) { if (cur < 0) keys_stop(); else { if (keyhold >= 0) snd_stop(8); keyhold = cur; key_on(cur); } }
    int oy = ky + kh + 4; int lo = v ? 1 : 2, hi = v ? 4 : 6;
    if (button(3, oy, 42, 12, "OCT-", 0, 1) && koct[v] > lo) { keys_stop(); koct[v]--; } if (button(47, oy, 42, 12, "OCT+", 0, 1) && koct[v] < hi) { keys_stop(); koct[v]++; }
    note_name(12 * (koct[v] + 1), b); char c[24]; sprintf(c, "C=%s", b); text(96, oy + 2, c, C_GOLD);
    text(150, oy + 2, v ? (rec && playing ? "RECORDING" : "REC+PLAY SAVES") : "HOLD A KEY", rec && playing && v ? C_RED : C_SILV);
    if (v) { int on = P.bassv == *vs; if (button(3, oy + 15, 158, 12, on ? "PATTERN BASS: THIS" : "PATTERN BASS: 808", on, 0)) { if (on) P.bassv = 0xFF; else P.bassv = (uint8_t)*vs; } }
}
static void studio_bottom(void)
{
    fb = botb; rect(0, 0, 256, 192, C_BLK);
    static const char *tabn[] = { "SEQ", "PADS", "808", "SONG", "FILE", "TAPE", "KEYS" };
    for (int i = 0; i < 7; i++) if (button(i * 36 + 2, 0, 35, 15, tabn[i], tab == i, 0)) { if (tab == T_KEYS && i != T_KEYS) keys_stop(); tab = i; }
    int top = 18; char b[40];
    if (tab == T_SEQ)
    {   int cur = playing && vpat == editpat ? vstep : -1;
        for (int r = 0; r < 8; r++)
        {   int y = top + r * 14; rect(0, y, 29, 13, r == selrow ? C_PURPH : C_CHAR); text(1, y + 3, SY_SHORT[P.snd[r]], r == selrow ? C_GOLDH : C_SILV);
            for (int s = 0; s < 16; s++) { int x = 30 + s * 14, v = P.pat[editpat][r][s]; u16 c = v ? (v > 110 ? C_GOLDH : v > 75 ? C_GOLD : C_PURPH) : ((s >> 2) & 1 ? C_CHAR2 : C_CHAR); rect(x, y, 13, 13, c); if (s == cur) frame(x, y, 13, 13, C_WHITE); if (v) rect(x + 1, y + 12 - v * 11 / 127, 11, 1, C_BLK); }
        }
        if (pdown && tx_ < 29 && ty_ >= top && ty_ < top + 112) { selrow = (ty_ - top) / 14; qput(0, selrow, 110, 0); }
        int r = (ty_ - top) / 14, s = (tx_ - 30) / 14; int inside = ty_ >= top && ty_ < top + 112 && tx_ >= 30 && tx_ < 254;
        if (pdown && inside) { dcell_r = r; dcell_s = s; dmoved = 0; dcycled = 0; if (!P.pat[editpat][r][s]) { dpaint = 1; cell_set(r, s, 100); qput(0, r, 100, r == 7 ? P.note[editpat][s] : 0); } else dpaint = 0; selrow = r; }
        else if (pheld && dcell_r >= 0 && inside && (r != dcell_r || s != dcell_s)) { dmoved = 1; dcell_r = r; dcell_s = s; if (dpaint) cell_set(r, s, P.pat[editpat][r][s] ? P.pat[editpat][r][s] : 100); else cell_set(r, s, 0); }
        else if (pheld && dcell_r >= 0 && !dmoved && !dpaint && !dcycled && holdf == 20) { static const uint8_t lv[4] = { 127, 100, 64, 32 }; int v = P.pat[editpat][dcell_r][dcell_s], n = 0; for (int i = 0; i < 4; i++) if (lv[i] <= v) { n = i; break; } cell_set(dcell_r, dcell_s, lv[(n + 1) & 3]); dcycled = 1; qput(0, dcell_r, lv[(n + 1) & 3], 0); }
        if (prel && dcell_r >= 0) { if (!dmoved && !dpaint && !dcycled && holdf < 20) cell_set(dcell_r, dcell_s, 0); dcell_r = -1; }
        if (button(2, 132, 34, 11, "GRV<", 0, 0)) { grv = (grv + GRV_N - 1) % GRV_N; for (int q = 0; q < 8; q++) for (int s2 = 0; s2 < 16; s2++) P.pat[editpat][q][s2] = GRV[grv][q][s2]; say("M01 GROOVE"); }
        if (button(38, 132, 34, 11, "GRV>", 0, 0)) { grv = (grv + 1) % GRV_N; for (int q = 0; q < 8; q++) for (int s2 = 0; s2 < 16; s2++) P.pat[editpat][q][s2] = GRV[grv][q][s2]; say("M01 GROOVE"); }
        sprintf(b, "M01 #%02d", grv + 1); text(76, 134, b, C_GOLD);
        if (button(150, 132, 22, 11, "S-", 0, 1)) { if (P.swing) P.swing--; } sprintf(b, "SWG%2d", P.swing); text(174, 134, b, C_SILV); if (button(216, 132, 22, 11, "S+", 0, 1)) { if (P.swing < 10) P.swing++; }
    }
    else if (tab == T_PADS)
    {   for (int i = 0; i < 8; i++)
        {   int x = 3 + (i & 3) * 63, y = top + (i >> 2) * 47, on = flash[i] > 0 || i == selrow; rect(x, y, 60, 44, flash[i] ? C_GOLD : on ? C_PURPH : C_CHAR); frame(x, y, 60, 44, C_GOLD);
            textc(x + 30, y + 16, SY_SHORT[P.snd[i]], flash[i] ? C_BLK : C_GOLDH); sprintf(b, "%d", i + 1); text(x + 3, y + 3, b, C_SILV);
            if (pdown && hit(x, y, 60, 44, tx_, ty_)) { selrow = i; qput(0, i, 118, i == 7 ? 12 : 0); }
        }
        sprintf(b, "ROW%d %s", selrow + 1, SY_NAME[P.snd[selrow]]); text(3, 114, b, C_GOLDH); sprintf(b, "PIT%+d VOL%d", P.pitch[selrow], P.vol[selrow]); text(3, 124, b, C_SILV);
        if (button(3, 133, 40, 11, "SND<", 0, 0)) { P.snd[selrow] = (P.snd[selrow] + SY_N - 1) % SY_N; qput(0, selrow, 110, 0); }
        if (button(45, 133, 40, 11, "SND>", 0, 0)) { P.snd[selrow] = (P.snd[selrow] + 1) % SY_N; qput(0, selrow, 110, 0); }
        if (button(87, 133, 40, 11, "PIT-", 0, 1)) { if (P.pitch[selrow] > -12) P.pitch[selrow]--; qput(0, selrow, 110, 0); }
        if (button(129, 133, 40, 11, "PIT+", 0, 1)) { if (P.pitch[selrow] < 12) P.pitch[selrow]++; qput(0, selrow, 110, 0); }
        if (button(171, 133, 40, 11, "VOL-", 0, 1)) { if (P.vol[selrow] > 8) P.vol[selrow] -= 4; }
        if (button(213, 133, 40, 11, "VOL+", 0, 1)) { if (P.vol[selrow] < 123) P.vol[selrow] += 4; }
    }
    else if (tab == T_808)
    {   int cur = playing && vpat == editpat ? vstep : -1;
        for (int k = 12; k >= 0; k--)
        {   int y = top + (12 - k) * 9; char nb[8]; note_name(P.bassnote + k, nb); int blk = ((P.bassnote + k) % 12 == 1 || (P.bassnote + k) % 12 == 3 || (P.bassnote + k) % 12 == 6 || (P.bassnote + k) % 12 == 8 || (P.bassnote + k) % 12 == 10);
            rect(0, y, 29, 8, blk ? C_CHAR2 : C_SILV); text(1, y, nb, C_BLK);
            for (int s = 0; s < 16; s++) { int x = 30 + s * 14; int on = P.pat[editpat][7][s] && P.note[editpat][s] == k; rect(x, y, 13, 8, on ? C_GOLDH : blk ? C_CHAR : C_CHAR2); if (s == cur) rect(x, y, 13, 1, C_WHITE); }
        }
        if (pdown && ty_ >= top && ty_ < top + 117 && tx_ >= 30 && tx_ < 254) { int k = 12 - (ty_ - top) / 9, s = (tx_ - 30) / 14; if (P.pat[editpat][7][s] && P.note[editpat][s] == k) P.pat[editpat][7][s] = 0; else { P.pat[editpat][7][s] = 100; P.note[editpat][s] = k; qput(0, 7, 105, k); } }
        if (button(2, 137, 42, 11, "OCT-", 0, 0)) { if (P.bassnote > 21) P.bassnote -= 12; } if (button(46, 137, 42, 11, "OCT+", 0, 0)) { if (P.bassnote < 57) P.bassnote += 12; }
        note_name(P.bassnote, b); char c[24]; sprintf(c, "ROOT %s", b); text(96, 139, c, C_GOLD);
        if (button(176, 137, 38, 11, "KEY-", 0, 1)) { if (P.bassnote > 21) P.bassnote--; } if (button(216, 137, 38, 11, "KEY+", 0, 1)) { if (P.bassnote < 57) P.bassnote++; }
    }
    else if (tab == T_SONG)
    {   text(4, top + 2, "SONG CHAIN - TAP SLOT TO CHANGE", C_GOLD);
        for (int i = 0; i < 16; i++)
        {   int x = 3 + (i & 7) * 31, y = top + 14 + (i >> 3) * 34; int used = i < P.chainlen; rect(x, y, 29, 30, used ? (playing && P.songmode && i == chainpos ? C_GOLD : C_PURPH) : C_CHAR); frame(x, y, 29, 30, used ? C_GOLD : C_PURP);
            char l[2] = { used ? 'A' + P.chain[i] : '-', 0 }; textc(x + 14, y + 11, l, used ? C_GOLDH : C_CHAR2);
            if (pdown && hit(x, y, 29, 30, tx_, ty_)) { if (!used) { for (int j = P.chainlen; j <= i; j++) P.chain[j] = editpat; P.chainlen = i + 1; } else P.chain[i] = (P.chain[i] + 1) % MS_PATS; }
        }
        if (button(3, top + 88, 60, 14, P.songmode ? "SONG:ON" : "SONG:OFF", P.songmode, 0)) P.songmode ^= 1;
        if (button(68, top + 88, 40, 14, "LEN-", 0, 1)) { if (P.chainlen > 1) P.chainlen--; } if (button(110, top + 88, 40, 14, "LEN+", 0, 1)) { if (P.chainlen < 16) { P.chain[P.chainlen] = editpat; P.chainlen++; } }
        sprintf(b, "LEN %d", P.chainlen); text(156, top + 91, b, C_SILV);
    }
    else if (tab == T_TAPE) tape_bottom(top);
    else if (tab == T_KEYS) keys_bottom(top);
    else
    {   text(4, top, "PROJECT FILE", C_GOLD); sprintf(b, "SD %s", sd_ok ? "OK" : "NONE-RAM SLOTS"); text(110, top, b, sd_ok ? C_SILV : C_RED);
        for (int i = 0; i < 8; i++) { int x = 3 + (i & 3) * 63, y = top + 14 + (i >> 2) * 24; sprintf(b, "%d%s", i + 1, (slotfile[i] || ramlen[i]) ? "*" : ""); if (button(x, y, 60, 21, b, slot == i, 0)) slot = i; }
        if (button(3, top + 66, 60, 18, "SAVE", 0, 0)) { int r = save_slot(slot); say(r == 0 ? "SAVED TO SD" : r == 1 ? "SAVED TO RAM SLOT" : r == 3 ? "VERIFY FAILED" : "SD WRITE ERROR"); }
        if (button(66, top + 66, 60, 18, "LOAD", 0, 0)) { int r = load_slot(slot); say(r == 0 ? "LOADED FROM SD" : r == 1 ? "LOADED FROM RAM" : r == 4 ? "RECOVERED FROM BAK" : "NOTHING IN SLOT"); if (r != 9) { seq_timer(); } }
        if (button(129, top + 66, 60, 18, "NEW", 0, 0)) { transport_play(0); default_project(); tape_apply(0); seq_timer(); say("NEW PROJECT"); }
        if (button(192, top + 66, 60, 18, career ? "HOLLOW" : "MENU", 0, 0)) { transport_play(0); if (career) { scene = SC_HOLLOW; hsub = 0; } else scene = SC_MENU; }
        text(4, top + 92, msg, C_GOLDH); text(4, top + 106, "FAT:/MEMPHIS_SIGIL/PROJECTS", C_CHAR2);
    }
    // transport
    rect(0, 145, 256, 47, C_CHAR); line(0, 145, 255, 145, C_GOLD);
    if (button(3, 148, 48, 19, playing ? "STOP" : "PLAY", playing, 0)) transport_play(!playing);
    if (button(54, 148, 34, 19, "REC", rec, 0)) rec ^= 1;
    if (button(92, 148, 22, 19, "-", 0, 1)) set_bpm(P.bpm - 1); sprintf(b, "%d", P.bpm); textc(133, 154, b, C_GOLDH); if (button(152, 148, 22, 19, "+", 0, 1)) set_bpm(P.bpm + 1);
    text(180, 148, "VOL", C_SILV); if (button(178, 158, 36, 9, "-", 0, 1)) { if (P.master > 4) P.master -= 4; qput(2, 0, P.master, 0); } if (button(216, 158, 36, 9, "+", 0, 1)) { if (P.master < 123) P.master += 4; qput(2, 0, P.master, 0); }
    sprintf(b, "%d", P.master * 100 / 127); text(210, 148, b, C_SILV);
    for (int i = 0; i < 5; i++) { char l[2] = { 'A' + i, 0 }; if (button(3 + i * 24, 171, 22, 19, l, editpat == i, 0)) editpat = i; }
    if (button(126, 171, 33, 19, "COPY", 0, 0)) { memcpy(clip.pat, P.pat[editpat], sizeof clip.pat); memcpy(clip.note, P.note[editpat], 32); clip_ok = 1; say("COPIED"); }
    if (button(161, 171, 33, 19, "PSTE", 0, 0) && clip_ok) { memcpy(P.pat[editpat], clip.pat, sizeof clip.pat); memcpy(P.note[editpat], clip.note, 32); say("PASTED"); }
    if (button(196, 171, 26, 19, "CLR", 0, 0)) { memset(P.pat[editpat], 0, sizeof P.pat[editpat]); memset(P.note[editpat], 0, 32); }
    if (button(224, 171, 28, 19, "RND", 0, 0)) rand_pattern(editpat);
}

// ---------------------------------------------------------------- THE HOLLOW: rivals, beat battles, club gigs, sigils (progress saved on SD, RAM copy as fallback)
// A track is judged on what a saved project really holds: tempo, drum voices and hits, off-beat variety, bass notes, bass voice, swing and tape colour.
static const char *DAYN[7] = { "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN" };
static const char *SIG_NAME[6] = { "GRAVE MARK", "HOLLOW EYE", "SIXFOLD SEAL", "BLACK CANDLE", "SERPENT GROOVE", "DEAD FREQUENCY" };
static const char *SIG_HOW[6] = { "WIN 1 BATTLE", "15 RESPECT", "3 WINS 2 GIGS", "30 RESPECT", "BEAT CEMETERY", "ALL 4 RIVALS" };
typedef struct { const char *name, *l1, *l2, *l3; uint8_t cash, resp, sigil; } Rival;
static const Rival RIV[4] = {
    { "DJ PHANTOM", "TEMPO 60-90", "4+ DRUM VOICES", "WORN+ TAPE", 120, 8, 0 },
    { "THE REVEREND", "TEMPO <=76", "4+ BASS NOTES", "REVEREND DRONE", 100, 8, 0 },
    { "LIL CEMETERY", "8+ BASS NOTES", "4+ DRUM VOICES", "SERPENT SIGIL", 140, 10, SG_SERP },
    { "MEMPHIS GHOST", "WORN+ TAPE", "4+ BASS SWING2+", "TEMPO <=90", 180, 14, 0 } };
typedef struct { int hits, voices, var, bassn, uniq, bpm, tape, swing, bassv; } An;
static int fetch_slot(int n, Proj *t)
{   char p[64]; if (sd_ok) { slotpath(p, n, ".msig"); if (!rdfile(p, t)) return 0; }
    if (ramlen[n] && !ms_unpack(t, ramslot[n], ramlen[n])) return 0; return 9;
}
static void analyse(const Proj *t, An *a)
{   memset(a, 0, sizeof *a); int rowuse[8] = { 0 }, seen[16] = { 0 }, best = 0, off = 0;
    int np = t->songmode && t->chainlen ? t->chainlen : 1;
    for (int k = 0; k < np; k++)
    {   int p = t->songmode && t->chainlen ? t->chain[k] : 0; if (p >= MS_PATS) p = 0; int h = 0, o = 0, bn = 0;
        for (int r = 0; r < 8; r++) for (int s = 0; s < 16; s++) if (t->pat[p][r][s])
        {   if (r < 7) { h++; rowuse[r] = 1; if (s % 4) o++; } else { bn++; seen[t->note[p][s] & 15] = 1; } }
        if (h > best) { best = h; off = o; } if (bn > a->bassn) a->bassn = bn; }
    a->hits = best; for (int r = 0; r < 7; r++) a->voices += rowuse[r]; for (int i = 0; i < 16; i++) a->uniq += seen[i];
    a->var = a->voices * 12 + off * 60 / (best ? best : 1); if (a->var > 100) a->var = 100;
    a->bpm = t->bpm; a->tape = t->tape; a->swing = t->swing; a->bassv = t->bassv;
}
static int battle_checks(int r, const An *a, int *ok, int *n)
{   int k = 0;
    if (r == 0) { ok[k++] = a->bpm >= 60 && a->bpm <= 90; ok[k++] = a->voices >= 4; ok[k++] = a->tape >= 2; }
    else if (r == 1) { ok[k++] = a->bpm <= 76; ok[k++] = a->bassn >= 4; ok[k++] = a->bassv == 2; }
    else if (r == 2) { ok[k++] = a->bassn >= 8; ok[k++] = a->voices >= 4; }
    else { ok[k++] = a->tape >= 2; ok[k++] = a->bassn >= 4; ok[k++] = a->swing >= 2; ok[k++] = a->bpm <= 90; }
    *n = k; int g = 0; for (int i = 0; i < k; i++) g += ok[i]; return g;
}
static int battle_score(int r, const An *a, int *win, int *miss)
{   int ok[8], n, g = battle_checks(r, a, ok, &n); *miss = n - g;
    int comp = n ? g * 40 / n : 40, dr = a->hits * 15 / 14; if (dr > 15) dr = 15; dr += a->var * 10 / 100;
    int bs = a->bassn >= 3 ? 15 : a->bassn * 5, mel = a->uniq * 2; if (mel > 10) mel = 10, (void)0; int tp = (a->bpm >= 60 && a->bpm <= 180) ? 10 : 0;
    int tot = comp + dr + bs + mel + tp; *win = (g == n) && tot >= 60; return tot;
}
static void prog_milestones(void)
{   if (pg.respect >= 30) pg.sigils |= SG_CANDLE; if (pg.hollow && pg.respect >= 15) pg.sigils |= SG_EYE;
    if (pg.hollow && pg.battles >= 1) pg.sigils |= SG_GRAVE; if (pg.hollow && pg.battles >= 3 && pg.gigs >= 2) pg.sigils |= SG_SIX;
    if (pg.hollow && pg.beaten == 15) pg.sigils |= SG_DEAD;
}
static uint8_t ramprog[40]; static int ramproglen;
static int prog_pack(uint8_t *b) { int o = 0; b[o++] = 'M'; b[o++] = 'S'; b[o++] = 'P'; b[o++] = 'G'; b[o++] = 1; b[o++] = pg.day; b[o++] = pg.week; b[o++] = pg.battles; b[o++] = pg.gigs; b[o++] = pg.hollow; b[o++] = pg.sigils; b[o++] = pg.beaten; b[o++] = pg.cash & 255; b[o++] = pg.cash >> 8; b[o++] = pg.respect & 255; b[o++] = pg.respect >> 8; uint32_t c = ms_crc(b, o); b[o++] = c; b[o++] = c >> 8; b[o++] = c >> 16; b[o++] = c >> 24; return o; }
static int prog_unpack(const uint8_t *b, int n)
{   if (n < 20 || memcmp(b, "MSPG", 4) || b[4] != 1) return 1; uint32_t c = ms_crc(b, 16), s = b[16] | b[17] << 8 | b[18] << 16 | (uint32_t)b[19] << 24; if (c != s) return 2;
    pg.day = b[5] % 7; pg.week = b[6]; pg.battles = b[7]; pg.gigs = b[8]; pg.hollow = b[9] & 1; pg.sigils = b[10] & 63; pg.beaten = b[11] & 15; pg.cash = b[12] | b[13] << 8; pg.respect = b[14] | b[15] << 8; return 0; }
static void prog_save(void)
{   ramproglen = prog_pack(ramprog); if (!sd_ok) return; FILE *f = fopen("fat:/MEMPHIS_SIGIL/PROGRESS.tmp", "wb"); if (!f) return; int w = fwrite(ramprog, 1, ramproglen, f); fclose(f);
    if (w == ramproglen) { remove("fat:/MEMPHIS_SIGIL/PROGRESS.msp"); rename("fat:/MEMPHIS_SIGIL/PROGRESS.tmp", "fat:/MEMPHIS_SIGIL/PROGRESS.msp"); } }
static void prog_load(void)
{   memset(&pg, 0, sizeof pg); pg.week = 1; if (!sd_ok) return; FILE *f = fopen("fat:/MEMPHIS_SIGIL/PROGRESS.msp", "rb"); if (!f) return; uint8_t b[40]; int n = fread(b, 1, sizeof b, f); fclose(f); Prog keep = pg; if (prog_unpack(b, n)) pg = keep; }
static void next_day(void) { pg.day = (pg.day + 1) % 7; if (pg.day == 0 && pg.week < 250) pg.week++; }
static int hrival = -1, hres, htot, hwin, hmiss, hsel[3], hnsel, hstage, htime[3], hmood, hcash, hresp, hdone;
static char hmsg[34] = "SAVE 6 TRACKS TO ENTER";
static void hsay(const char *s) { strncpy(hmsg, s, 33); hmsg[33] = 0; }
static void hollow_bottom(void)
{
    fb = botb; hgrad(0, 192, C_BLK, C_PURP); char b[64]; pg.hollow = pg.hollow || tape_filled() >= 6; prog_milestones();
    textc(128, 4, "THE HOLLOW", C_GOLDH); sprintf(b, "%s WK%d  $%d  RESP %d", DAYN[pg.day], pg.week, pg.cash, pg.respect); textc(128, 15, b, C_SILV);
    if (hsub == 0)
    {   for (int i = 0; i < 6; i++) { int x = 3 + i * 42; rect(x, 28, 40, 22, (pg.sigils >> i) & 1 ? C_GOLD : C_CHAR); frame(x, 28, 40, 22, C_PURP); char l[3] = { 'A' + i, 0 }; textc(x + 20, 35, (pg.sigils >> i) & 1 ? "*" : l, (pg.sigils >> i) & 1 ? C_BLK : C_CHAR2);
            if (pdown && hit(x, 28, 40, 22, tx_, ty_)) { sprintf(b, "%s: %s", SIG_NAME[i], (pg.sigils >> i) & 1 ? "OWNED" : SIG_HOW[i]); hsay(b); } }
        sprintf(b, "%d/6 TRACKS  %d WINS  %d GIGS", tape_filled(), pg.battles, pg.gigs); textc(128, 56, b, C_GOLD);
        if (button(3, 70, 124, 24, "BEAT BATTLE", 0, 0)) { if (!pg.hollow) hsay("SAVE 6 TRACKS FIRST"); else { hsub = 1; hrival = -1; hdone = 0; hsel[0] = -1; hsay("PICK A RIVAL"); } }
        if (button(129, 70, 124, 24, "CLUB GIG", 0, 0)) { if (!pg.hollow) hsay("SAVE 6 TRACKS FIRST"); else if (pg.day != 5) hsay("CLUB GIGS ARE ON SATURDAY"); else if (tape_filled() < 3) hsay("NEED 3 SAVED TRACKS"); else { hsub = 2; hnsel = 0; hstage = 0; hdone = 0; hsay("PICK 3 TRACKS IN ORDER"); } }
        if (button(3, 98, 124, 24, "STUDIO", 0, 0)) { career = 1; scene = SC_STUDIO; tab = T_TAPE; }
        if (button(129, 98, 124, 24, "NEXT DAY", 0, 0)) { next_day(); prog_save(); sprintf(b, "IT IS %s", DAYN[pg.day]); hsay(b); }
        if (button(3, 126, 250, 16, "MAIN MENU", 0, 0)) { career = 0; scene = SC_MENU; }
        text(4, 150, hmsg, C_GOLDH); text(4, 164, pg.hollow ? "HOLLOW OPEN" : "SAVE ALL SIX TAPE SLOTS", C_SILV);
        return; }
    if (hsub == 1)
    {   for (int i = 0; i < 4; i++) { int y = 26 + i * 17; char l[32]; sprintf(l, "%s%s", RIV[i].name, (pg.beaten >> i) & 1 ? " *" : ""); if (button(3, y, 124, 15, l, hrival == i, 0)) { hrival = i; hdone = 0; } }
        if (hrival >= 0) { text(132, 28, RIV[hrival].l1, C_SILV); text(132, 40, RIV[hrival].l2, C_SILV); text(132, 52, RIV[hrival].l3, C_SILV); sprintf(b, "WIN $%d +%d RESP", RIV[hrival].cash, RIV[hrival].resp); text(132, 66, b, C_GOLD); }
        text(4, 96, "YOUR TRACK:", C_GOLD);
        for (int i = 0; i < 6; i++) { int used = ramlen[i] || slotfile[i]; sprintf(b, "%d", i + 1); if (button(3 + i * 42, 106, 40, 14, b, hsel[0] == i, 0)) { if (used) hsel[0] = i; else hsay("THAT TRACK IS EMPTY"); } }
        if (button(3, 124, 100, 18, "FIGHT", 0, 0) && !hdone) { if (hrival < 0 || hsel[0] < 0) hsay("PICK RIVAL AND TRACK"); else { Proj t; An a; if (fetch_slot(hsel[0], &t)) hsay("CANNOT READ TRACK"); else { analyse(&t, &a); htot = battle_score(hrival, &a, &hwin, &hmiss); hdone = 1;
            if (hwin) { pg.cash += RIV[hrival].cash; pg.respect += RIV[hrival].resp; if (pg.battles < 250) pg.battles++; pg.beaten |= 1 << hrival; pg.sigils |= RIV[hrival].sigil; hsay("YOU WON THE BATTLE!"); } else { if (pg.respect < 60000) pg.respect++; hsay("YOU LOST. MEET THE LIST"); }
            next_day(); prog_milestones(); prog_save(); } } }
        if (button(108, 124, 60, 18, "BACK", 0, 0)) hsub = 0;
        if (hdone) { sprintf(b, "SCORE %d/100  %s", htot, hwin ? "WIN" : "LOSS"); text(4, 148, b, hwin ? C_GOLDH : C_RED); sprintf(b, "REQUIREMENTS MISSED: %d", hmiss); text(4, 160, b, C_SILV); }
        text(4, 176, hmsg, C_GOLDH); return; }
    {   // gig: pick three tracks in order, then three timing taps on the sweeping bar
        if (hstage == 0)
        {   text(4, 28, "TAP 3 TRACKS IN PLAY ORDER", C_GOLD);
            for (int i = 0; i < 6; i++) { int used = ramlen[i] || slotfile[i], on = 0, ord = 0; for (int k = 0; k < hnsel; k++) if (hsel[k] == i) { on = 1; ord = k + 1; } sprintf(b, on ? "%d:%d" : "%d", i + 1, ord);
                if (button(3 + (i % 3) * 84, 42 + (i / 3) * 24, 80, 20, b, on, 0)) { if (!used) hsay("THAT TRACK IS EMPTY"); else if (!on && hnsel < 3) hsel[hnsel++] = i; else if (on) hnsel = 0; } }
            if (hnsel == 3 && button(3, 100, 124, 22, "START SET", 0, 0)) { hstage = 1; }
            if (button(129, 100, 124, 22, "BACK", 0, 0)) hsub = 0; text(4, 150, hmsg, C_GOLDH); return; }
        if (hstage >= 1 && hstage <= 3)
        {   sprintf(b, "DROP %d/3: TAP AT GOLD MARK", hstage); text(4, 28, b, C_GOLD); int pos = (frames * 5) % 400; if (pos > 200) pos = 400 - pos; rect(28, 60, 200, 14, C_CHAR); rect(124, 60, 8, 14, C_GOLD); rect(28 + pos - 2, 56, 5, 22, C_WHITE);
            if (pdown && ty_ > 40 && ty_ < 140) { int d = pos - 100; if (d < 0) d = -d; int q = 100 - d; if (q < 0) q = 0; htime[hstage - 1] = q; hstage++; }
            return; }
        if (hstage == 4)
        {   int mood = 40; Proj t; An a, pa; for (int n = 0; n < 3; n++) { if (fetch_slot(hsel[n], &t)) continue; analyse(&t, &a); int d = a.var / 10 + (a.hits + a.bassn) * 14 / 64; if ((a.hits + a.bassn) * 14 / 64 > 10) d = a.var / 10 + 10;
                if (n) { int dt = a.bpm - pa.bpm; if (dt < 0) dt = -dt; d += dt <= 14 ? 6 : -4; } if (a.tape >= 2) d += 4; if (a.bassn >= 6) d += 4; d += htime[n] / 10; mood += d; pa = a; }
            if (mood < 0) mood = 0; if (mood > 100) mood = 100; hmood = mood; hcash = mood * 14 / 10; hresp = mood / 8; pg.cash += hcash; pg.respect += hresp; if (pg.gigs < 250) pg.gigs++; next_day(); prog_milestones(); prog_save(); hstage = 5; }
        sprintf(b, "CROWD MOOD %d/100", hmood); text(4, 28, b, C_GOLDH); sprintf(b, "PAID $%d  +%d RESPECT", hcash, hresp); text(4, 44, b, C_GOLD); text(4, 60, hmood >= 70 ? "THE CLUB LOVED YOU" : hmood >= 45 ? "SOLID SET" : "TOUGH CROWD", C_SILV);
        if (button(3, 100, 124, 22, "DONE", 0, 0)) hsub = 0;
    }
}
static void menu_bottom(void)
{
    fb = botb; hgrad(0, 192, C_BLK, C_PURP); textc(128, 14, "MEMPHIS SIGIL", C_GOLDH); textc(128, 26, "DS MUSIC WORKSTATION", C_SILV);
    if (button(48, 40, 160, 26, "FREE STUDIO", 0, 0)) { career = 0; scene = SC_STUDIO; tab = T_SEQ; }
    if (button(48, 72, 160, 26, "THE HOLLOW", 0, 0)) { scene = SC_HOLLOW; hsub = 0; hsay(pg.hollow ? "WELCOME BACK" : "SAVE 6 TRACKS TO ENTER"); }
    if (button(48, 104, 160, 26, "LOAD PROJECT", 0, 0)) { career = 0; scene = SC_STUDIO; tab = T_FILE; }
    if (button(48, 136, 160, 26, "ABOUT", 0, 0)) scene = SC_ABOUT;
    textc(128, 174, "TAP WITH THE STYLUS", C_CHAR2);
}
static void about_bottom(void)
{
    fb = botb; hgrad(0, 192, C_BLK, C_PURP); textc(128, 8, "ABOUT", C_GOLDH);
    const char *L[] = { "DRUM MACHINE 8 ROWS X 16", "12 ORIGINAL SYNTH SOUNDS", "5 PATTERNS + SONG CHAIN", "TIMER-DRIVEN SEQUENCER", "SWING  LIVE REC  PADS", "808 BASS PIANO ROLL", "36 GROOVES FROM KORG M01", "DRUM TUNING FROM DS-10", "SAVE/LOAD .MSIG ON SD", "X PLAY  Y REC  L/R PAT", "UP/DN BPM  SELECT STOP" };
    for (int i = 0; i < 11; i++) text(12, 24 + i * 11, L[i], i < 8 ? C_SILV : C_GOLD);
    if (button(88, 160, 80, 22, "BACK", 0, 0)) scene = SC_MENU;
}

// ---------------------------------------------------------------- boot
static void boot_text(const char *s) { fb = botb; hgrad(0, 192, C_BLK, C_PURP); textc(128, 90, s, C_GOLDH); dmaCopy(botb, botv, sizeof botb); }
int main(void)
{
    defaultExceptionHandler(); powerOn(POWER_ALL_2D); lcdMainOnTop();
    videoSetMode(MODE_5_2D); videoSetModeSub(MODE_5_2D); vramSetBankA(VRAM_A_MAIN_BG); vramSetBankC(VRAM_C_SUB_BG);
    int b1 = bgInit(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0), b2 = bgInitSub(3, BgType_Bmp16, BgSize_B16_256x256, 0, 0); topv = bgGetGfxPtr(b1); botv = bgGetGfxPtr(b2);
    dmaCopy(splash_bin, topv, 256 * 192 * 2); boot_text("RENDERING SOUNDS");
    sy_init(); int off = 0; for (int i = 0; i < SY_N; i++) { wavoff[i] = off; off += (sy_render(i, wav + off) + 3) & ~3; } memcpy(wav0, wav, sizeof wav); DC_FlushRange(wav, sizeof wav); keys_init();
    boot_text("LOADING"); sd_ok = fatInitDefault(); if (sd_ok) { mkdir("fat:/MEMPHIS_SIGIL", 0777); mkdir("fat:/MEMPHIS_SIGIL/PROJECTS", 0777); for (int i = 0; i < 8; i++) { char p[64]; struct stat st; slotpath(p, i, ".msig"); slotfile[i] = !stat(p, &st); } }
    default_project(); load_cfg(); after_load(); prog_load();
    for (int i = 0; i < 120; i++) { swiWaitForVBlank(); snd_input(); }
    seq_timer(); qput(2, 0, P.master, 0);
    for (;;)
    {
        snd_input(); scanKeys(); int kd = keysDown(), kh = keysHeld(); touchPosition t; touchRead(&t);
        int was = pheld; pheld = (kh & KEY_TOUCH) ? 1 : 0; pdown = pheld && !was; prel = !pheld && was; if (pheld) { tx_ = t.px; ty_ = t.py; holdf = pdown ? 0 : holdf + 1; lastx = tx_; lasty = ty_; } else if (!prel) { tx_ = -50; ty_ = -50; } else { tx_ = lastx; ty_ = lasty; }
        if (scene == SC_STUDIO)
        {   if (kd & KEY_X) transport_play(!playing); if (kd & KEY_Y) rec ^= 1; if (kd & KEY_START) transport_play(1); if (kd & KEY_SELECT) transport_play(0);
            if (kd & KEY_L) editpat = (editpat + MS_PATS - 1) % MS_PATS; if (kd & KEY_R) editpat = (editpat + 1) % MS_PATS;
            if (kh & KEY_UP) { if (++rep == 1 || rep > 18) set_bpm(P.bpm + 1); } else if (kh & KEY_DOWN) { if (++rep == 1 || rep > 18) set_bpm(P.bpm - 1); } else rep = 0;
            studio_bottom();
        }
        else if (scene == SC_MENU) menu_bottom(); else if (scene == SC_HOLLOW) hollow_bottom(); else about_bottom();
        keys_env();
        draw_top();
        for (int i = 0; i < 8; i++) if (flash[i] > 0) flash[i]--;
        if (msgt) msgt--; frames++;
        swiWaitForVBlank(); dmaCopy(topb, topv, sizeof topb); dmaCopy(botb, botv, sizeof botb);
    }
}

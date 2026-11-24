// Create-a-Theme: a 16-step, 6-track entrance-music sequencer in the spirit of the DS-10's step grid.
// Drums are our own one-shot samples; bass and lead use the DS's PSG square channels, hats the noise channel.
#include "icw.h"
#include <string.h>
#include <stdio.h>

#include "drum_kick_bin.h"
#include "drum_snare_bin.h"
#include "drum_clap_bin.h"
#include "font_ui_bin.h"
#include "font_big_bin.h"

Theme caw_theme;

static const char *ROW_N[6] = { "KICK", "SNARE", "HAT", "CLAP", "BASS", "LEAD" };
static const char *KEY_N[12] = { "A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#" };
static const int SCALE[9] = { 0, 0, 3, 5, 7, 10, 12, 15, 17 };        // minor pentatonic, 1..8

// ---------------------------------------------------------------- playback
// Smooth voices: looping single-cycle waveforms (warm bass, soft keys, chorus pad) generated at start-up,
// per-frame volume envelopes, chords under everything, swing and a little velocity humanising.
// Channels: 0 kick, 1 snare, 2 clap, 3 bass, 4-8 pad, 9 keys, 10 keys echo, 15 hat.  (11-14: sound effects)
static int playing, step, acc, bar;
static const Theme *cur;
static const s8 *prog;              // chord roots (semitones from key) per bar, 4 bars; NULL = follow the bass
static int swing;                    // 0..30 (% of a step)
static u32 last_tick = 0xFFFFFFFF;

#define WAVE_N 64
static s16 w_bass[WAVE_N] ALIGN(32), w_keys[WAVE_N] ALIGN(32), w_pad[WAVE_N] ALIGN(32);
static s8 s_hat[1400] ALIGN(32), s_shaker[900] ALIGN(32);
static int waves_ok;

static void make_waves(void)
{
    for (int i = 0; i < WAVE_N; i++) {
        float x = i * 6.2831853f / WAVE_N;
        float b = sinf(x) + 0.32f * sinf(2 * x) + 0.10f * sinf(3 * x);
        float k = sinf(x) + 0.22f * sinf(2 * x) + 0.16f * sinf(3 * x) + 0.05f * sinf(5 * x);
        float pd = sinf(x) + 0.45f * sinf(2 * x) + 0.26f * sinf(3 * x) + 0.12f * sinf(4 * x) + 0.06f * sinf(5 * x);
        w_bass[i] = (s16)(b * 21000); w_keys[i] = (s16)(k * 22000); w_pad[i] = (s16)(pd * 17000);
    }
    u32 r = 12345;
    float lp = 0;
    for (int i = 0; i < 1400; i++) {                    // closed hat: bright noise, fast decay
        r = r * 1103515245 + 12345; float n = ((int)(r >> 16) & 255) / 127.5f - 1;
        float hp = n - lp; lp += (n - lp) * 0.35f;
        s_hat[i] = (s8)(hp * 90 * expf(-i / 160.0f));
    }
    for (int i = 0; i < 900; i++) {                     // shaker: softer, rounder
        r = r * 1103515245 + 12345; float n = ((int)(r >> 16) & 255) / 127.5f - 1;
        float env = (i < 120 ? i / 120.0f : expf(-(i - 120) / 180.0f));
        s_shaker[i] = (s8)(n * 55 * env);
    }
    DC_FlushRange(w_bass, sizeof w_bass); DC_FlushRange(w_keys, sizeof w_keys); DC_FlushRange(w_pad, sizeof w_pad);
    DC_FlushRange(s_hat, sizeof s_hat); DC_FlushRange(s_shaker, sizeof s_shaker);
    waves_ok = 1;
}

static int hz_of(int key, int semis, int octave)
{
    return (int)(55.0f * powf(2.0f, (key + semis) / 12.0f) * (float)(1 << octave));
}

// envelope voices
typedef struct { int ch, vol, peak, sus, state, att, dec, rel, hold; } Voice;   // state 0 off 1 attack 2 decay/sustain 3 release
enum { V_BASS, V_KEYS, V_ECHO, V_PAD0, V_PAD1, V_PAD2, V_PAD3, V_PAD4, V_N };
static Voice vc[V_N] = {
    { 3 }, { 9 }, { 10 }, { 4 }, { 5 }, { 6 }, { 7 }, { 8 },
};
static void voice_on(int v, const s16 *wave, int hz, int peak, int sus, int att, int dec, int rel, int hold, int pan)
{
    Voice *o = &vc[v];
    o->peak = peak; o->sus = sus; o->att = att; o->dec = dec; o->rel = rel; o->hold = hold;
    o->vol = att > 0 ? 0 : peak; o->state = att > 0 ? 1 : 2;
    snd_sample_ch(o->ch, wave, sizeof w_bass, 1, hz * WAVE_N, o->vol, pan, 1);
}
static void voice_off(int v) { if (vc[v].state && vc[v].state != 3) vc[v].state = 3; }
static void voices_tick(void)
{
    for (int v = 0; v < V_N; v++) {
        Voice *o = &vc[v];
        int old = o->vol;
        if (o->state == 1) { o->vol += (o->peak + o->att - 1) / o->att; if (o->vol >= o->peak) { o->vol = o->peak; o->state = 2; } }
        else if (o->state == 2) {
            if (o->vol > o->sus) { o->vol -= (o->peak - o->sus + o->dec - 1) / (o->dec ? o->dec : 1); if (o->vol < o->sus) o->vol = o->sus; }
            if (o->hold > 0 && --o->hold == 0) o->state = 3;
        } else if (o->state == 3) {
            o->vol -= (o->peak + o->rel - 1) / (o->rel ? o->rel : 1);
            if (o->vol <= 0) { o->vol = 0; o->state = 0; snd_stop(o->ch); continue; }
        }
        if (o->state && o->vol != old) snd_vol(o->ch, o->vol);
    }
}

// chord tones (semitones) for a root in the natural minor key: minor on i/iv/v, major on III/VI/VII
static void chord_of(int root, int out[3])
{
    int r = ((root % 12) + 12) % 12;
    int major = (r == 3 || r == 8 || r == 10);
    out[0] = root; out[1] = root + (major ? 4 : 3); out[2] = root + 7;
}
static int chord_root = 0, chord_hz[3];
static void play_chord(int key, int root)
{
    int t[3]; chord_of(root, t);
    for (int i = 0; i < 3; i++) {
        int hz = hz_of(key, t[i], 2);
        if (hz == chord_hz[i] && vc[V_PAD0 + i].state && vc[V_PAD0 + i].state != 3) continue;   // tie common tones
        chord_hz[i] = hz;
        voice_on(V_PAD0 + i, w_pad, hz, 26, 22, 18, 20, 30, 0, 40 + i * 24);
    }
    // chorus: the root and third doubled a few cents sharp, panned wide
    voice_on(V_PAD3, w_pad, chord_hz[0] + (chord_hz[0] >> 7) + 1, 16, 14, 24, 20, 30, 0, 20);
    voice_on(V_PAD4, w_pad, chord_hz[1] + (chord_hz[1] >> 7) + 1, 14, 12, 24, 20, 30, 0, 108);
}

static int rnd(void) { static u32 r = 0x1234567; r = r * 1664525 + 1013904223; return (r >> 16) & 0x7FFF; }
static int human(int v) { return v - 6 + rnd() % 13; }

static int echo_t = -1, echo_hz, echo_pan;
static void play_step(const Theme *t, int s)
{
    int len = 900 / t->tempo;                                       // frames per step
    if (!waves_ok) make_waves();
    // chords: on the bar line (and half bar), from the progression or from the bass note there
    if (s == 0 || s == 8) {
        int root = chord_root;
        if (prog) root = prog[(bar & 3)];
        else if (t->note[0][s]) root = SCALE[t->note[0][s]];
        if (s == 0 || root != chord_root || !vc[V_PAD0].state) { chord_root = root; play_chord(t->key, root); }
    }
    int shift = prog ? prog[bar & 3] : 0;
    if (t->on[0][s]) snd_sample_ch(0, drum_kick_bin, drum_kick_bin_size, 0, 16384, human(s % 8 ? 92 : 112), 64, 0);
    if (t->on[1][s]) snd_sample_ch(1, drum_snare_bin, drum_snare_bin_size, 0, 16384, human(70), 58, 0);
    if (t->on[2][s]) {
        int accent = (s & 3) == 2 ? 34 : 22;
        if (s & 1) snd_sample_ch(15, s_shaker, sizeof s_shaker, 0, 22050, human(accent), 84, 0);
        else snd_sample_ch(15, s_hat, sizeof s_hat, 0, 32000, human(accent), 80, 0);
    }
    if (t->on[3][s]) snd_sample_ch(2, drum_clap_bin, drum_clap_bin_size, 0, 16384, human(62), 70, 0);
    if (t->note[0][s]) {
        int n = SCALE[t->note[0][s]] + shift;
        voice_on(V_BASS, w_bass, hz_of(t->key, n, 0), human(84), 60, 1, 10, 6, len * 3 / 2 + 2, 64);
    }
    int quiet = prog && (bar & 3) == 2 && s < 8;                    // let the melody breathe now and then
    if (t->note[1][s] && !quiet) {
        int n = SCALE[t->note[1][s]] + shift, hz = hz_of(t->key, n, 2);
        int pan = 52 + rnd() % 24;
        voice_on(V_KEYS, w_keys, hz, human(58), 20, 1, 22, 14, len * 2 + 4, pan);
        echo_t = len * 3; echo_hz = hz; echo_pan = 127 - pan;       // dotted-eighth echo, opposite side
    }
}

void seq_start(const Theme *t) { cur = t; playing = 1; step = 15; acc = 899; bar = -1; prog = NULL; swing = 0; chord_root = 0; }
void seq_stop(void)
{
    playing = 0; echo_t = -1;
    for (int v = 0; v < V_N; v++) { if (vc[v].state) snd_stop(vc[v].ch); vc[v].state = 0; vc[v].vol = 0; }
    for (int i = 0; i < 3; i++) chord_hz[i] = 0;
}
int seq_step(void) { return playing ? step : -1; }

// returns 1 when the step advanced (safe to call more than once per frame)
int seq_tick(void)
{
    if (last_tick == frame) return 0;
    last_tick = frame;
    voices_tick();
    if (echo_t >= 0 && --echo_t == 0) voice_on(V_ECHO, w_keys, echo_hz, 20, 6, 1, 18, 12, 18, echo_pan);
    if (!playing) return 0;
    acc += cur->tempo;
    int need = 900 + ((step & 1) ? -1 : 1) * 9 * swing;             // long-short swing on 16ths
    if (acc < need) return 0;
    acc -= need;
    step = (step + 1) & 15;
    if (step == 0) bar++;
    play_step(cur, step);
    return 1;
}

int theme_used(const Theme *t)
{
    for (int r = 0; r < 4; r++) for (int s = 0; s < 16; s++) if (t->on[r][s]) return 1;
    for (int r = 0; r < 2; r++) for (int s = 0; s < 16; s++) if (t->note[r][s]) return 1;
    return 0;
}

// ---------------------------------------------------------------- presets (original patterns)
void theme_preset(Theme *t, int p);
void theme_preset(Theme *t, int p)
{
    memset(t, 0, sizeof *t);
    t->key = 0;
    if (p == 0) {                       // HOLLER STOMP: four on the floor, driving bass
        t->tempo = 124;
        for (int s = 0; s < 16; s += 4) t->on[0][s] = 1;
        t->on[3][4] = t->on[3][12] = 1;
        for (int s = 2; s < 16; s += 4) t->on[2][s] = 1;
        static const u8 b[16] = { 1, 0, 1, 0, 1, 0, 4, 0, 1, 0, 1, 0, 5, 0, 4, 3 };
        static const u8 l[16] = { 6, 0, 0, 7, 0, 0, 6, 0, 5, 0, 0, 0, 4, 0, 5, 0 };
        memcpy(t->note[0], b, 16); memcpy(t->note[1], l, 16);
    } else if (p == 1) {                // SLOW AND LOW: half-time, heavy and screwed-down
        t->tempo = 70; t->key = 5;
        t->on[0][0] = t->on[0][7] = t->on[0][10] = 1;
        t->on[1][8] = 1;
        for (int s = 0; s < 16; s += 2) t->on[2][s] = 1;
        t->on[2][13] = t->on[2][15] = 1;
        static const u8 b[16] = { 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 3, 0, 0, 0, 2, 0 };
        static const u8 l[16] = { 0, 0, 0, 0, 8, 0, 7, 0, 0, 0, 0, 0, 6, 0, 5, 0 };
        memcpy(t->note[0], b, 16); memcpy(t->note[1], l, 16);
    } else {                            // ARENA ROCK: backbeat and a big riff
        t->tempo = 140; t->key = 7;
        t->on[0][0] = t->on[0][6] = t->on[0][8] = t->on[0][11] = 1;
        t->on[1][4] = t->on[1][12] = 1;
        for (int s = 0; s < 16; s++) t->on[2][s] = 1;
        static const u8 b[16] = { 1, 1, 0, 1, 1, 0, 3, 3, 4, 4, 0, 4, 3, 0, 2, 2 };
        static const u8 l[16] = { 6, 0, 6, 7, 0, 6, 0, 5, 6, 0, 6, 7, 0, 8, 7, 6 };
        memcpy(t->note[0], b, 16); memcpy(t->note[1], l, 16);
    }
}

// ---------------------------------------------------------------- editor UI
#define GX 44
#define GW 13
#define GY 30
#define GH 19
static u16 *fb;

static void button(int x0, int y0, int x1, int y1, const char *s, int hot)
{
    fill_rect(fb, x0, y0, x1, y1, hot ? RGB15(25, 18, 3) : RGB15(9, 9, 15));
    fill_rect(fb, x0, y0, x1, y0 + 1, hot ? RGB15(31, 28, 16) : RGB15(16, 17, 25));
    draw_text_c(fb, font_ui_bin, (x0 + x1) / 2, y0 + (y1 - y0 - 12) / 2 + 1, s, RGB15(31, 31, 31));
}

static void draw_cell(const Theme *t, int r, int s)
{
    int x0 = GX + s * GW, y0 = GY + r * GH, ph = seq_step() == s;
    u16 bg = (s & 3) == 0 ? RGB15(7, 7, 13) : RGB15(4, 4, 9);
    if (ph) bg = RGB15(10, 9, 4);
    fill_rect(fb, x0, y0, x0 + GW - 1, y0 + GH - 2, bg);
    static const u16 col[6] = { RGB15(31, 8, 8), RGB15(31, 24, 6), RGB15(10, 26, 31), RGB15(24, 12, 31), RGB15(8, 28, 12), RGB15(31, 16, 26) };
    if (r < 4) {
        if (t->on[r][s]) fill_rect(fb, x0 + 2, y0 + 3, x0 + GW - 3, y0 + GH - 5, col[r]);
    } else {
        int n = t->note[r - 4][s];
        if (n) {
            int h = 2 + n * (GH - 6) / 8;
            fill_rect(fb, x0 + 2, y0 + GH - 3 - h, x0 + GW - 3, y0 + GH - 3, col[r]);
        }
    }
}

static void draw_all(const Theme *t, int preset_id)
{
    static const char *PRE_N[3] = { "STOMP", "SLOW", "ROCK" };
    for (int y = 0; y < 192; y++) fill_rect(fb, 0, y, 256, y + 1, RGB15(3 + y / 24, 3 + y / 48, 7 + y / 20));
    for (int y = 0; y < 24; y++) fill_rect(fb, 0, y, 256, y + 1, RGB15(25 - y / 2, 3, 5));
    fill_rect(fb, 0, 24, 256, 26, RGB15(29, 23, 7));
    draw_text_c(fb, font_big_bin, 128, 3, "CREATE-A-THEME", RGB15(31, 31, 31));
    for (int r = 0; r < 6; r++) {
        draw_text(fb, font_ui_bin, 4, GY + r * GH + 3, ROW_N[r], RGB15(22, 23, 29));
        for (int s = 0; s < 16; s++) draw_cell(t, r, s);
    }
    char buf[16];
    button(4, 148, 52, 166, playing ? "STOP" : "PLAY", playing);
    button(56, 148, 72, 166, "-", 0);
    sprintf(buf, "%d BPM", t->tempo); draw_text_c(fb, font_ui_bin, 96, 151, buf, RGB15(31, 27, 12));
    button(120, 148, 136, 166, "+", 0);
    button(140, 148, 156, 166, "-", 0);
    sprintf(buf, "KEY %s", KEY_N[t->key]); draw_text_c(fb, font_ui_bin, 177, 151, buf, RGB15(31, 27, 12));
    button(198, 148, 214, 166, "+", 0);
    button(218, 148, 252, 166, PRE_N[preset_id], 0);
    fill_rect(fb, 0, 170, 256, 192, RGB15(2, 2, 5));
    fill_rect(fb, 0, 170, 256, 171, RGB15(29, 23, 7));
    button(4, 173, 60, 190, "CLEAR", 0);
    draw_text(fb, font_ui_bin, 66, 176, "TAP CELLS", RGB15(18, 19, 26));
    button(188, 173, 252, 190, "DONE", 1);
}

void theme_run(u16 *sub, void (*top)(void))
{
    fb = sub;
    Theme *t = &caw_theme;
    static int pre = 0;
    if (!t->tempo) theme_preset(t, 0);
    draw_all(t, pre);
    int last = -1;
    while (1) {
        frame++;
        input_scan();
        u32 kd = keys_down();
        if (kd & (KEY_B | KEY_START)) break;
        if (kd & KEY_A) { if (playing) seq_stop(); else seq_start(t); draw_all(t, pre); }
        if (kd & KEY_TOUCH) {
            touchPosition tp; touch_get(&tp);
            int x = tp.px, y = tp.py;
            if (y >= GY && y < GY + 6 * GH && x >= GX && x < GX + 16 * GW) {
                int r = (y - GY) / GH, s = (x - GX) / GW;
                if (r < 4) t->on[r][s] ^= 1;
                else t->note[r - 4][s] = (t->note[r - 4][s] + 1) % 9;
                draw_cell(t, r, s);
                if (!playing && (r < 4 ? t->on[r][s] : t->note[r - 4][s])) {     // audition
                    Theme one; memset(&one, 0, sizeof one); one.tempo = t->tempo; one.key = t->key;
                    if (r < 4) one.on[r][0] = 1; else one.note[r - 4][0] = t->note[r - 4][s];
                    play_step(&one, 0);
                }
            } else if (y >= 148 && y < 167) {
                if (x < 52) { if (playing) seq_stop(); else seq_start(t); }
                else if (x >= 56 && x < 72) { if (t->tempo > 60) t->tempo -= 4; }
                else if (x >= 120 && x < 136) { if (t->tempo < 180) t->tempo += 4; }
                else if (x >= 140 && x < 156) t->key = (t->key + 11) % 12;
                else if (x >= 198 && x < 214) t->key = (t->key + 1) % 12;
                else if (x >= 218) { pre = (pre + 1) % 3; theme_preset(t, pre); }
                draw_all(t, pre);
            } else if (y >= 173) {
                if (x < 60) { int tp2 = t->tempo, k = t->key; memset(t, 0, sizeof *t); t->tempo = tp2; t->key = k; draw_all(t, pre); }
                if (x >= 188) break;
            }
        }
        if (seq_tick()) {
            int s = seq_step();
            for (int r = 0; r < 6; r++) { if (last >= 0) draw_cell(t, r, last); draw_cell(t, r, s); }
            last = s;
        }
        top();
        swiWaitForVBlank();
    }
    seq_stop();
    t->used = theme_used(t);
}

// ---------------------------------------------------------------- sound effects and background music
// PSG / noise one-shots with automatic cut-off; sfx_tick() runs from input_scan() every frame.
static int fx_ch[6] = { -1, -1, -1, -1, -1, -1 }, fx_t[6], fx_init = 1;   // -1 = free slot
static int bgm_on;
static Theme bgm;
static void fx(int ch, int frames)
{
    if (ch < 0) return;                                   // no free channel (or no reply)
    if (!fx_init) { fx_init = 1; for (int i = 0; i < 6; i++) fx_ch[i] = -1; }
    for (int i = 0; i < 6; i++) if (fx_ch[i] < 0) { fx_ch[i] = ch; fx_t[i] = frames; return; }
    soundKill(ch);
}
void sfx_tick(void)
{
    for (int i = 0; i < 6; i++) if (fx_ch[i] >= 0 && --fx_t[i] <= 0) { soundKill(fx_ch[i]); fx_ch[i] = -1; }
    if (bgm_on) seq_tick();
}
void sfx(int kind)
{
    soundEnable();
    switch (kind) {
    case SFX_HIT:   fx(soundPlayNoise(6000, 90, 64), 4); soundPlaySample(drum_snare_bin, SoundFormat_8Bit, drum_snare_bin_size, 12000, 90, 64, false, 0); break;
    case SFX_SLAM:  soundPlaySample(drum_kick_bin, SoundFormat_8Bit, drum_kick_bin_size, 9000, 127, 64, false, 0); fx(soundPlayNoise(1800, 100, 64), 10); break;
    case SFX_BELL:  fx(soundPlayPSG(DutyCycle_12, 1760, 90, 64), 14); fx(soundPlayPSG(DutyCycle_25, 2640, 50, 64), 26); break;
    case SFX_COUNT: soundPlaySample(drum_clap_bin, SoundFormat_8Bit, drum_clap_bin_size, 14000, 110, 64, false, 0); break;
    case SFX_CROWD: fx(soundPlayNoise(3200, 60, 30), 50); fx(soundPlayNoise(4100, 50, 98), 70); break;
    case SFX_UI:    fx(soundPlayPSG(DutyCycle_50, 880, 50, 64), 3); break;
    case SFX_OK:    fx(soundPlayPSG(DutyCycle_50, 1320, 50, 64), 5); break;
    case SFX_COIN:  fx(soundPlayPSG(DutyCycle_25, 1976, 60, 64), 4); fx(soundPlayPSG(DutyCycle_25, 2637, 60, 64), 14); break;
    case SFX_STEP:  fx(soundPlayNoise(900, 24, 64), 2); break;
    }
}
// Background music: an original looping groove per place over a 4-bar chord progression
// (0 menu/arena, 1 town, 2 shop, 3 farm, 4 match). Bass and melody move with the chords.
static void bgm_pattern(Theme *t, int which)
{
    memset(t, 0, sizeof *t);
    static const u8 BASS[5][16] = {
        { 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 4, 0, 0, 0 },     // menu: laid-back hip-hop bounce
        { 1, 0, 0, 0, 0, 0, 4, 0, 1, 0, 0, 0, 0, 0, 3, 0 },     // town: easy walk
        { 1, 0, 4, 0, 1, 0, 0, 3, 0, 0, 1, 0, 4, 0, 3, 0 },     // shop: lounge
        { 1, 0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 4, 0, 6, 0 },     // farm: country two-step
        { 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 4, 0, 3, 2 },     // match: driving
    };
    static const u8 LEAD[5][16] = {
        { 0, 0, 6, 0, 0, 7, 0, 6, 0, 0, 0, 0, 5, 0, 4, 0 },
        { 6, 0, 0, 5, 0, 0, 4, 0, 0, 0, 5, 0, 0, 0, 0, 0 },
        { 0, 0, 0, 6, 0, 0, 7, 0, 8, 0, 0, 0, 7, 0, 6, 0 },
        { 4, 0, 5, 0, 6, 0, 0, 0, 6, 0, 5, 0, 4, 0, 0, 0 },
        { 6, 0, 0, 6, 0, 7, 0, 0, 8, 0, 7, 0, 6, 0, 5, 0 },
    };
    static const u8 KICK[5][16] = {
        { 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0 },
        { 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0 },
        { 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 },
        { 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0 },
        { 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0 },
    };
    memcpy(t->note[0], BASS[which], 16); memcpy(t->note[1], LEAD[which], 16); memcpy(t->on[0], KICK[which], 16);
    if (which == 0 || which == 2 || which == 4) { t->on[1][4] = t->on[1][12] = 1; }
    if (which == 1 || which == 3) { t->on[3][4] = t->on[3][12] = 1; }
    for (int s = 0; s < 16; s += (which == 4 ? 1 : 2)) t->on[2][s] = 1;
    if (which == 2) for (int s = 1; s < 16; s += 4) t->on[2][s] = 1;
    static const u8 TEMPO[5] = { 88, 96, 84, 104, 132 }, KEY[5] = { 4, 9, 2, 7, 9 };
    t->tempo = TEMPO[which]; t->key = KEY[which];
}
void bgm_start(int which)
{
    static const s8 PROG[5][4] = {
        { 0, 8, 3, 10 },     // i  VI  III VII
        { 0, 5, 10, 3 },     // i  iv  VII III
        { 0, 3, 8, 7 },      // i  III VI  v
        { 0, 10, 8, 10 },    // i  VII VI  VII
        { 0, 8, 10, 7 },     // i  VI  VII v
    };
    static const u8 SWING[5] = { 22, 14, 26, 10, 0 };
    if (which < 0 || which > 4) which = 0;
    bgm_pattern(&bgm, which);
    seq_stop(); seq_start(&bgm); prog = PROG[which]; swing = SWING[which]; bgm_on = 1;
}
void bgm_stop(void) { bgm_on = 0; seq_stop(); }

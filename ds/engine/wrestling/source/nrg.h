// NOTAREAL Game Studio - DS runtime data format ("NRG1").
// A game made with the dev kit = this prebuilt engine + one data block that the editor writes
// into the ROM over nr_gamedata[] (found by its "NRGDATA1" magic). No compiler needed by the user.
#pragma once
#include <stdint.h>

#define NRG_CAPACITY (64 * 1024)

typedef struct { char id[4]; uint32_t off, size; } NrgSection;
typedef struct {
    char magic[8];        // "NRGDATA1"
    uint32_t capacity;    // bytes reserved in the ROM
    uint32_t used;        // bytes written by the editor (0 = empty template)
    uint32_t count;       // number of sections
    NrgSection sec[];     // offsets are relative to the start of the block
} NrgHeader;

// META: fixed 128-byte record
typedef struct {
    char title[32], author[32];
    uint8_t lives, nlevels, hero_w, hero_h;
    int16_t gravity, jump, run, accel;     // 8.8 fixed point, pixels per frame (squared)
    uint8_t title_song, clear_song, bg_r, bg_g, bg_b, max_fall, pad[2];   // max_fall: px/frame (0 = 6)
    char tagline[40];
    int16_t run_fast, jump_run;            // 8.8: top speed holding Y; jump speed at full run (0 = same as jump)
} NrgMeta;

enum { COL_EMPTY, COL_SOLID, COL_PLATFORM, COL_HAZARD };
enum { OB_START, OB_COIN, OB_WALKER, OB_HOPPER, OB_GOAL, OB_SPRING, OB_HEART, OB_CHECK, OB_FLYER, OB_TYPES };
enum { SH_HERO, SH_WALKER, SH_HOPPER, SH_FLYER, SH_COIN, SH_GOAL, SH_SPRING, SH_HEART, SH_CHECK, SH_COUNT };
enum { SFX_JUMP, SFX_COIN, SFX_STOMP, SFX_HURT, SFX_GOAL, SFX_SPRING, SFX_1UP, SFX_COUNT };

// Section ids: META BPAL SPAL MTIL MCOL BGIM SPRS LVLS SONG SFXC

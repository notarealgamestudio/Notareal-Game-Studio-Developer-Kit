/* NOTAREAL Dev Kit - SNES street basketball (2-on-2).
   B shoot / jump to block, Y pass / steal, A turbo (hold), D-pad move. Hold turbo near the hoop and press B to dunk.
   Shot odds fall with distance from the hoop and with a defender in your face. Teammate and rivals run a small half-court AI.
   Settings come from a 56-byte block at $81:8000 ("NRGBSKT1"): seconds, skill, turbo use, team colours, title (the dev kit patches it).
   Built with PVSnesLib. tcc-816 notes: no switch, no a||b of calls, no ternaries of calls, keep to 16-bit math. */
#include <snes.h>
#include <string.h>

#define R8(a) (*(volatile u8 *)(a))
typedef const u8 *rp;
typedef union { rp p; u8 b[4]; } PU;
static PU pu;
static rp mkptr(u16 addr, u16 bank) { pu.b[0] = (u8)addr; pu.b[1] = (u8)(addr >> 8); pu.b[2] = (u8)bank; pu.b[3] = 0; return pu.p; }
static u16 pbank(rp p) { pu.p = p; return pu.b[2]; }
static u16 plo(rp p) { pu.p = p; return pu.b[0] | (pu.b[1] << 8); }

extern char nr_driver, nr_driver_end, nr_aud0, nr_aud0_end, nr_aud1, nr_aud1_end;
extern u16 snd_blocks[32];
extern u16 snd_qn, snd_qc[8], snd_qa[8], snd_qb[8];
void snd_boot(void);
void snd_flush(void);
extern char nr_font, nr_font_end, nr_logo_tiles, nr_logo_tiles_end, nr_logo_map, nr_logo_pal;
extern char bg_tiles, bg_tiles_end, bg_map, bg_pal, obj_tiles, obj_tiles_end, obj_pal, txt_pal;

/* ------------------------------------------------------------------ settings (patched by the dev kit) */
static u16 cfg_secs = 90;
static u8 cfg_skill = 1, cfg_turbo = 1;
static char title[25];
/* ------------------------------------------------------------------ sound (SPC700 driver + sound image built by tools/make_audio.js) */
enum { SFX_BOUNCE, SFX_SWISH, SFX_HIT, SFX_WHISTLE, SFX_PASS, SFX_CHEER, SFX_BUZZER };
enum { SONG_TITLE, SONG_GAME, SONG_END };
static u16 mus_cur;
static void snd_q(u16 c, u16 a, u16 b) { u16 n = snd_qn; if (n >= 8) return; snd_qc[n] = c; snd_qa[n] = a; snd_qb[n] = b; snd_qn = n + 1; }
static void sfx(u16 ev) { snd_q(1, ev, 0); }
static void music(u16 id) { if (id == mus_cur) return; mus_cur = id; snd_q(2, id, 0); }
static void music_stop(void) { mus_cur = 0xFFFF; snd_q(3, 0, 0); }
static void sound_init(void) {
    snd_blocks[0] = 0x0200; snd_blocks[1] = plo((rp)&nr_driver); snd_blocks[2] = pbank((rp)&nr_driver); snd_blocks[3] = plo((rp)&nr_driver_end) - plo((rp)&nr_driver);
    snd_blocks[4] = 0x0800; snd_blocks[5] = plo((rp)&nr_aud0); snd_blocks[6] = pbank((rp)&nr_aud0); snd_blocks[7] = plo((rp)&nr_aud0_end) - plo((rp)&nr_aud0);
    snd_blocks[8] = 0x0800 + 30000; snd_blocks[9] = plo((rp)&nr_aud1); snd_blocks[10] = pbank((rp)&nr_aud1); snd_blocks[11] = plo((rp)&nr_aud1_end) - plo((rp)&nr_aud1);
    snd_blocks[15] = 0;
    snd_boot();
    mus_cur = 0xFFFF;
}
static void read_cfg(void) {
    rp c = mkptr(0x8000, 0x81); u16 i;
    strcpy(title, "STREET HOOPS");
    if (c[0] != 'N' || c[1] != 'R' || c[2] != 'G' || c[3] != 'B') return;
    if (c[8] | c[9]) cfg_secs = c[8] | (c[9] << 8);
    if (cfg_secs < 20) cfg_secs = 20;
    if (cfg_secs > 300) cfg_secs = 300;
    cfg_skill = c[10]; if (cfg_skill < 1) cfg_skill = 1; if (cfg_skill > 3) cfg_skill = 3;
    cfg_turbo = c[11]; if (cfg_turbo < 1) cfg_turbo = 1; if (cfg_turbo > 3) cfg_turbo = 3;
    if (c[16]) { for (i = 0; i < 24; i++) { title[i] = c[16 + i]; if (!c[16 + i]) break; } title[24] = 0; }
}

/* ------------------------------------------------------------------ video helpers */
static u8 txt[2048];
static u16 txt_dirty;
static void text_clear(void) { memset(txt, 0, 2048); txt_dirty = 1; }
static void text(u16 x, u16 y, const char *s, u16 pal) {
    u16 o = (y * 32 + x) * 2;
    while (*s) { if (o < 2048) { txt[o] = (u8)(*s - 32); txt[o + 1] = 0x20 | ((4 + pal) << 2); } o += 2; s++; }
    txt_dirty = 1;
}
static char nbuf[8];
static char *num(u16 v) { u16 i = 6; nbuf[7] = 0; nbuf[6] = '0'; if (!v) return nbuf + 6; while (v) { nbuf[i] = '0' + (v % 10); v /= 10; i--; } return nbuf + i + 1; }
static void fade(s16 from, s16 to) {
    s16 b = from;
    while (1) { setBrightness((u8)b); WaitForVBlank(); if (b == to) break; if (to > from) b++; else b--; }
}
static u16 pad, padh;
static void frame_end(void) {
    u16 k;
    WaitForVBlank(); oamUpdate();
    if (txt_dirty) { dmaCopyVram((u8 *)txt, 0x4C00, 2048); txt_dirty = 0; }
    if (snd_qn) snd_flush();
    k = padsCurrent(0); padh = k & ~pad; pad = k;
}

/* ------------------------------------------------------------------ random */
static u16 rs = 0x1D2B;
static u16 rnd(u16 n) { rs = rs * 25173u + 13849u; return (rs >> 4) % n; }

/* ------------------------------------------------------------------ game state */
#define CX0 12
#define CX1 244
#define CY0 116
#define CY1 204
#define HX0 20
#define HX1 236
#define HFY 138          /* the floor spot under each hoop, used for distances */
static s16 X[4], Y[4], Z[4], VZ[4];
static u8 FACE[4], ST[4], MOVING[4];
static s16 COOL[4];
static s16 BX, BY, BZ, BVX, BVY, BVZ;
static s16 hold;                      /* -1 loose, else player 0-3 */
static u8 shot_on, shot_good, shot_three, shot_dunk;
static s16 shot_f, shot_sx, shot_sy, shot_tx, shot_by;
static u16 score[2];
static s16 secs, sub, shotclk, turbo, hang, msgt;
static u8 status;                     /* 0 play, 1 win, 2 lose */
static const char *msg;
static u16 fr, poss;

static s16 absv(s16 v) { if (v < 0) return -v; return v; }
static s16 dist(s16 x0, s16 y0, s16 x1, s16 y1) { s16 dx = absv(x0 - x1), dy = absv(y0 - y1) * 2; if (dx > dy) return dx + dy / 2; return dy + dx / 2; }
static s16 hoopx(u16 team) { if (team) return HX0; return HX1; }
static void say(const char *m) { msg = m; msgt = 70; }

static void kickoff(u16 team_with_ball) {
    X[0] = 70; X[1] = 110; X[2] = 230; X[3] = 200;
    Y[0] = 160; Y[1] = 130; Y[2] = 160; Y[3] = 130;
    FACE[0] = FACE[1] = 0; FACE[2] = FACE[3] = 1;
    { u16 i; for (i = 0; i < 4; i++) { Z[i] = 0; VZ[i] = 0; ST[i] = 0; COOL[i] = 0; } }
    hold = team_with_ball * 2; shot_on = 0; shotclk = 24 * 60; poss = team_with_ball; hang = 0;
}
static void score_basket(u16 team, u16 pts, const char *m) {
    score[team] += pts; say(m); sfx(SFX_SWISH); if (team == 0) sfx(SFX_CHEER); kickoff(team ? 0 : 1);
    text(2, 1, "YOU", 1); text(6, 1, num(score[0]), 0); text(11, 1, "CPU", 3); text(15, 1, num(score[1]), 0);
}
static void new_game(void) {
    score[0] = score[1] = 0; secs = cfg_secs; sub = 60; turbo = 100; status = 0; msgt = 0; fr = 0;
    kickoff(0);
}
static s16 nearest_mate_to_ball(void) {
    s16 d0 = dist(X[0], Y[0], BX, BY), d1 = dist(X[1], Y[1], BX, BY);
    if (d1 < d0) return 1;
    return 0;
}
static void move_to(u16 i, s16 tx, s16 ty, s16 sp) {
    s16 dx = tx - X[i], dy = ty - Y[i];
    if (dx > sp) dx = sp; if (dx < -sp) dx = -sp;
    if (dy > 0) { if (sp < 2) { if (!(fr & 1)) dy = 0; } if (dy > 1 + (sp >> 1)) dy = 1 + (sp >> 1); }
    if (dy < 0) { if (sp < 2) { if (!(fr & 1)) dy = 0; } if (dy < -(1 + (sp >> 1))) dy = -(1 + (sp >> 1)); }
    X[i] += dx; Y[i] += dy;
    if (X[i] < CX0) X[i] = CX0; if (X[i] > CX1) X[i] = CX1; if (Y[i] < CY0) Y[i] = CY0; if (Y[i] > CY1) Y[i] = CY1;
    if (dx > 0) FACE[i] = 0; if (dx < 0) FACE[i] = 1;
    if (dx | dy) MOVING[i] = 1;
}
static s16 odds(u16 i) {
    u16 team = i >> 1, j; s16 d = dist(X[i], Y[i], hoopx(team), HFY), best = 99, o, dd;
    for (j = 0; j < 4; j++) if ((j >> 1) != team) { dd = dist(X[i], Y[i], X[j], Y[j]); if (dd < best) best = dd; }
    o = 88 - d / 3;
    if (best < 26) o -= (30 * (26 - best)) / 26;
    if (team) o -= (cfg_skill - 1) * 8;
    if (o < 8) o = 8; if (o > 95) o = 95;
    return o;
}
static void shoot(u16 i, u16 dunk) {
    u16 team = i >> 1; s16 o;
    hold = -1; shot_on = 1; shot_f = 0; shot_by = i; shot_tx = hoopx(team); shot_sx = BX; shot_sy = BY; shot_dunk = dunk;
    if (dunk) { VZ[i] = 5; ST[i] = 3; hang = 22; shot_good = 1; shot_three = 0; return; }
    VZ[i] = 3; ST[i] = 1;
    o = odds(i); shot_good = (rnd(100) < (u16)o); shot_three = (dist(X[i], Y[i], shot_tx, HFY) > 120);
}
static void pass_to(u16 j) { hold = j; say("PASS"); sfx(SFX_PASS); }
static void block_loose(void) { sfx(SFX_HIT); shot_on = 0; hold = -1; BVX = (s16)rnd(5) - 2; BVY = (s16)rnd(3) - 1; BVZ = 2; }

static void ai(u16 i) {
    u16 team = i >> 1, idx = i & 1; s16 tx = hoopx(team), d, sx, sy, mark;
    if (Z[i] > 0) return;
    if (COOL[i] > 0) { COOL[i]--; return; }
    if (hold == (s16)i) {
        move_to(i, tx, 150, 1);
        d = dist(X[i], Y[i], tx, HFY);
        if (d < 34) { if (turbo >= 0) { if (rnd(100) < 6) { shoot(i, 1); return; } } }
        if (d < 96) { if (rnd(100) < 2 * cfg_skill) { shoot(i, 0); return; } }
        if (shotclk < 70) { shoot(i, 0); return; }
        if (d < 130) { if (rnd(1000) < 6) { shoot(i, 0); return; } }
        if (rnd(1000) < 8) { pass_to(i ^ 1); }
        return;
    }
    if (hold >= 0) {
        if ((hold >> 1) == (s16)team) {              /* my team has it: space the floor */
            if (team) sx = tx + 70; else sx = tx - 70;
            sy = 126; if (idx) sy = 160; if (idx) { if (team) sx = tx + 120; else sx = tx - 120; }
            move_to(i, sx, sy, 1);
            return;
        }
        /* defend */
        if (idx == 0) { mark = hold; } else { mark = (hold ^ 1); }
        move_to(i, X[mark], Y[mark], 1 + (cfg_skill > 1));
        if (idx == 0) {
            d = dist(X[i], Y[i], X[hold], Y[hold]);
            if (d < 14) { if (rnd(100) < 4 * cfg_skill) { hold = i; say("STEAL!"); } else { if (rnd(100) < 5) COOL[i] = 14; } }
            if (d < 24) { if (!shot_on) { if (rnd(100) < 1) VZ[i] = 3; } }
        }
        return;
    }
    move_to(i, BX, BY, 2);
}

/* ------------------------------------------------------------------ one frame of play */
static s16 me;
static void play_step(void) {
    u16 i, h; s16 d, u; s16 q, dx;
    fr++;
    if (msgt > 0) msgt--;
    sub--; if (sub <= 0) { sub = 60; secs--; }
    shotclk--;
    if (secs <= 0) {
        if (score[0] > score[1]) { status = 1; sfx(SFX_BUZZER); return; }
        if (score[0] < score[1]) { status = 2; sfx(SFX_BUZZER); return; }
        secs = 20; say("OVERTIME!"); sfx(SFX_WHISTLE);
    }
    if (shotclk <= 0) { shotclk = 24 * 60; if (hold >= 0) { say("SHOT CLOCK!"); sfx(SFX_BUZZER); if (hold < 2) hold = 2; else hold = 0; } }
    /* who do you control */
    if (hold >= 0 && hold < 2) me = hold; else me = nearest_mate_to_ball();
    for (i = 0; i < 4; i++) MOVING[i] = 0;
    /* human movement */
    {   s16 mx = 0, my = 0, sp = 1; u16 tb = (pad & KEY_A) && turbo > 0;
        if (pad & KEY_LEFT) mx = -1; if (pad & KEY_RIGHT) mx = 1; if (pad & KEY_UP) my = -1; if (pad & KEY_DOWN) my = 1;
        if (tb) sp = 2;
        if (tb && (mx | my)) { turbo -= cfg_turbo; if (turbo < 0) turbo = 0; } else { if (turbo < 100) { if (!(fr & 3)) turbo++; } }
        if ((mx | my) && Z[me] == 0) move_to(me, X[me] + mx * 4, Y[me] + my * 4, sp);
        /* buttons */
        if ((padh & KEY_B) && Z[me] == 0) {
            if (hold == me) { d = dist(X[me], Y[me], hoopx(0), HFY); if (d < 38) { if (tb) { shoot(me, 1); } else shoot(me, 0); } else shoot(me, 0); }
            else if (hold >= 2) { VZ[me] = 3; ST[me] = 2; }
        }
        if (padh & KEY_Y) {
            if (hold == me) { pass_to(me ^ 1); }
            else if (hold >= 2) { d = dist(X[me], Y[me], X[hold], Y[hold]); if (d < 22) { if (rnd(100) < 55 / cfg_skill) { hold = me; say("STEAL!"); sfx(SFX_PASS); } else COOL[me] = 12; } }
            else if (!shot_on) { d = dist(X[me], Y[me], BX, BY); if (d < 30) hold = me; }
        }
    }
    for (i = 0; i < 4; i++) if ((s16)i != me) ai(i);
    /* jumping */
    for (i = 0; i < 4; i++) {
        if (VZ[i] != 0 || Z[i] > 0) {
            Z[i] += VZ[i]; VZ[i] -= 1;
            if (Z[i] <= 0) { Z[i] = 0; VZ[i] = 0; ST[i] = 0; }
            if (ST[i] == 3) { if (VZ[i] < 0) { if (hang > 0) { hang--; VZ[i] = 0; if (Z[i] < 14) Z[i] = 14; } } }
        }
    }
    /* dunk */
    if (shot_on) {
        if (shot_dunk) {
            h = shot_by; BX = X[h] + (FACE[h] ? -4 : 4); BY = Y[h]; BZ = 24 + Z[h];
            X[h] += (shot_tx - X[h]) / 8; shot_f++;
            if (shot_f > 14) {
                u16 blocked = 0;
                for (i = 0; i < 4; i++) if ((i >> 1) != (h >> 1)) if (Z[i] > 8) if (dist(X[i], Y[i], X[h], Y[h]) < 18) blocked = 1;
                if (blocked) { if (rnd(100) < 50) { say("BLOCKED!"); block_loose(); return; } }
                score_basket(h >> 1, 2, "SLAM DUNK!"); return;
            }
        } else {
            h = shot_by; shot_f++;
            BX = shot_sx + (s16)(((s32)(shot_tx - shot_sx) * shot_f) / 50);
            BY = shot_sy + (s16)(((s32)(HFY - shot_sy) * shot_f) / 50);
            BZ = 12 + ((shot_f * (50 - shot_f)) >> 3) + (shot_f * 40) / 100;
            if (shot_f < 10) {
                for (i = 0; i < 4; i++) if ((i >> 1) != (h >> 1)) if (Z[i] > 10) if (dist(X[i], Y[i], X[h], Y[h]) < 20) { if (rnd(100) < 50) { say("REJECTED!"); block_loose(); return; } }
            }
            if (shot_f >= 50) {
                if (shot_good) { if (shot_three) score_basket(h >> 1, 3, "SWISH THREE!"); else score_basket(h >> 1, 2, "SWISH!"); return; }
                say("MISS"); sfx(SFX_BOUNCE); shot_on = 0; hold = -1; BVX = (s16)rnd(5) - 2; if (h >> 1) BVX -= 1; else BVX += 1; BVY = (s16)rnd(3) - 1; BVZ = 3;
            }
        }
    }
    /* ball follows the holder / loose ball */
    if (hold >= 0) {
        BX = X[hold] + (FACE[hold] ? -8 : 8); BY = Y[hold];
        q = (s16)(fr & 15) - 8; if (q < 0) q = -q;
        BZ = 10 + Z[hold] + q;
        if ((fr & 15) == 8) if (!shot_on) sfx(SFX_BOUNCE);
    } else if (!shot_on) {
        BX += BVX; BY += BVY; if (BX < CX0) BX = CX0; if (BX > CX1) BX = CX1; if (BY < CY0 - 10) BY = CY0 - 10; if (BY > CY1) BY = CY1;
        BVZ -= 1; BZ += BVZ;
        if (BZ < 2) { if (BVZ < -2) sfx(SFX_BOUNCE); BZ = 2; BVZ = absv(BVZ) / 2; BVX = BVX * 9 / 10; BVY = BVY * 9 / 10; }
        if (BZ < 22) {
            s16 bd = 99, bi = -1;
            for (i = 0; i < 4; i++) { dx = dist(X[i], Y[i], BX, BY); if (dx < 14) if (dx < bd) { bd = dx; bi = i; } }
            if (bi >= 0) { hold = bi; BVX = BVY = 0; if ((bi >> 1) != (s16)poss) { poss = bi >> 1; shotclk = 24 * 60; } }
        }
    }
}

/* ------------------------------------------------------------------ drawing */
static u16 oid;
static void piece(s16 x, s16 y, u16 frame, u16 pal, u16 flip) {
    u16 tile;
    if (oid >= 128 * 4) return;
    if (x < -16 || x > 256 || y < -16 || y > 224) return;
    tile = (frame & 7) * 2 + (frame >> 3) * 32;
    oamSet(oid, (u16)x & 0x1FF, (u16)y & 0xFF, 2, flip, 0, tile, pal);
    oamSetEx(oid, OBJ_SMALL, OBJ_SHOW);
    oid += 4;
}
static void draw(void) {
    u16 i, j, k, f, order[4]; u16 t;
    oid = 0;
    piece(HX0 - 12, 70, 7, 0, 0); piece(HX1 - 4, 70, 7, 0, 1);
    for (i = 0; i < 4; i++) order[i] = i;
    for (i = 0; i < 3; i++) for (j = 0; j < 3 - i; j++) if (Y[order[j]] < Y[order[j + 1]]) { t = order[j]; order[j] = order[j + 1]; order[j + 1] = t; }
    if (BZ > 6) piece(BX - 8, BY - 14, 6, 0, 0);
    piece(BX - 8, BY - BZ - 8, 5, 0, 0);
    for (k = 0; k < 4; k++) {
        i = order[k]; f = 0;
        if (MOVING[i]) { if ((fr >> 3) & 1) f = 1; else f = 2; }
        if (ST[i] == 1) f = 3; if (ST[i] == 2) f = 3; if (ST[i] == 3) f = 4;
        piece(X[i] - 8, Y[i] - 14, 6, 0, 0);
        piece(X[i] - 8, Y[i] - 16 - Z[i], f, i >> 1, FACE[i]);
    }
    piece(X[me] - 8, Y[me] - Z[me] - 28, 8, 0, 0);
    while (oid < 128 * 4) { oamSetVisible(oid, OBJ_HIDE); oid += 4; }
}
static void hud(void) {
    u16 i; char bar[9];
    text(2, 1, "YOU", 1); text(6, 1, num(score[0]), 0); text(11, 1, "CPU", 3); text(15, 1, num(score[1]), 0);
    text(22, 1, "TIME", 2); text(27, 1, "   ", 0); text(27, 1, num((u16)secs), 0);
    text(22, 2, "CLK", 2); text(27, 2, "   ", 0); text(27, 2, num((u16)(shotclk / 60 + 1)), 0);
    for (i = 0; i < 8; i++) bar[i] = (turbo * 8 / 101 > (s16)i) ? '#' : '-'; bar[8] = 0;
    text(2, 2, "TURBO", 2); text(8, 2, bar, 1);
    text(0, 4, "                                ", 0);
    if (msgt > 0) text((32 - strlen(msg)) / 2, 4, msg, 1);
}

/* ------------------------------------------------------------------ screens */
static void load_graphics(void) {
    dmaCopyVram((u8 *)&bg_tiles, 0x0000, plo((rp)&bg_tiles_end) - plo((rp)&bg_tiles));
    dmaCopyVram((u8 *)&bg_map, 0x5400, 32 * 32 * 2);
    dmaCopyVram((u8 *)&obj_tiles, 0x6000, plo((rp)&obj_tiles_end) - plo((rp)&obj_tiles));
    dmaCopyVram((u8 *)&nr_font, 0x5000, plo((rp)&nr_font_end) - plo((rp)&nr_font));
    dmaCopyCGram((u8 *)&bg_pal, 0, 32);
    dmaCopyCGram((u8 *)&txt_pal, 16, 32);
    dmaCopyCGram((u8 *)&obj_pal, 128, 128);
}
static void splash(void) {
    u16 i;
    setBrightness(0);
    dmaCopyVram((u8 *)&nr_logo_tiles, 0x0000, plo((rp)&nr_logo_tiles_end) - plo((rp)&nr_logo_tiles));
    dmaCopyVram((u8 *)&nr_logo_map, 0x5400, 32 * 32 * 2);
    dmaCopyCGram((u8 *)&nr_logo_pal, 0, 32);
    bgSetScroll(0, 0, 0);
    bgSetDisable(2);
    setScreenOn();
    fade(0, 15);
    sound_init();
    for (i = 0; i < 100; i++) WaitForVBlank();
    fade(15, 0);
    bgSetEnable(2); bgSetDisable(1);
}
static void title_screen(void) {
    u16 t = 0;
    setBrightness(0);
    load_graphics();
    text_clear();
    text((32 - strlen(title)) / 2, 6, title, 1);
    text(9, 9, "2 ON 2 STREET BALL", 0);
    text(4, 13, "B SHOOT   Y PASS   A TURBO", 2);
    text(2, 15, "TURBO + B NEAR HOOP = DUNK", 2);
    text(10, 19, "PRESS START", 0);
    oid = 0; while (oid < 128 * 4) { oamSetVisible(oid, OBJ_HIDE); oid += 4; }
    frame_end();
    fade(0, 15);
    while (1) {
        frame_end(); t++; rs += t;
        if (padh & KEY_START) break;
    }
}
static void end_screen(void) {
    u16 t = 0;
    if (status == 1) text(11, 8, "YOU WIN!", 1); else text(11, 8, "GAME OVER", 3);
    text(8, 10, "FINAL", 2); text(14, 10, num(score[0]), 0); text(18, 10, "-", 0); text(20, 10, num(score[1]), 0);
    text(9, 18, "PRESS START", 0);
    while (1) { frame_end(); t++; if (padh & KEY_START) { if (t > 30) break; } }
}

int main(void) {
    read_cfg();
    consoleInit();
    bgSetGfxPtr(0, 0x0000); bgSetGfxPtr(2, 0x5000);
    bgSetMapPtr(0, 0x5400, SC_32x32); bgSetMapPtr(2, 0x4C00, SC_32x32);
    oamInit(); oamInitGfxAttr(0x6000, OBJ_SIZE16_L32);
    setMode(BG_MODE1, BG3_MODE1_PRIORITY_HIGH);
    bgSetDisable(1);
    splash();
    while (1) {
        music(SONG_TITLE);
        title_screen();
        music(SONG_GAME);
        text_clear();
        new_game();
        hud();
        say("TIP OFF!"); sfx(SFX_WHISTLE);
        fade(15, 15);
        while (1) {
            frame_end();
            if (padh & KEY_START) { say("PAUSED"); hud(); text(11, 4, "PAUSED", 1); while (1) { frame_end(); if (padh & KEY_START) break; } }
            play_step();
            if (status) break;
            draw();
            if (!(fr & 7)) hud();
        }
        draw(); text_clear(); hud(); music(SONG_END); end_screen();
        fade(15, 0);
    }
    return 0;
}

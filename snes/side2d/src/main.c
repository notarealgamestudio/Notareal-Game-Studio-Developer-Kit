/* NOTAREAL Dev Kit - SNES side-scroller engine (data-driven).
   Everything the game shows and plays is read from the data block the dev kit writes into banks 16-47
   (magic "NRGSNES1" at $90:8000): title, physics, tiles, metatiles, background, sprites, levels, sound.
   Same rules as the DS engine (nr_side2d): 1/16-pixel physics, coyote time + jump buffer, variable jump
   height, run-speed jump boost, stomps, springs, hearts (1-UP), checkpoints, a full-height goal pole.
   Built with PVSnesLib. tcc-816 notes: no switch, no a||b of calls, no ternaries of calls. */
#include <snes.h>
#include <string.h>

#define R8(a) (*(volatile u8 *)(a))
typedef const u8 *rp;
/* 24-bit pointers built byte by byte (tcc-816 is unreliable with 32-bit shifts) */
typedef union { rp p; u8 b[4]; } PU;
static PU pu;
static rp mkptr(u16 addr, u16 bank) { pu.b[0] = (u8)addr; pu.b[1] = (u8)(addr >> 8); pu.b[2] = (u8)bank; pu.b[3] = 0; return pu.p; }
static u16 plo(rp p) { pu.p = p; return pu.b[0] | (pu.b[1] << 8); }
static u16 pbank(rp p) { pu.p = p; return pu.b[2]; }

extern char nr_driver, nr_driver_end, nr_font, nr_font_end, nr_logo_tiles, nr_logo_tiles_end, nr_logo_map, nr_logo_pal;
extern u16 snd_blocks[32];
extern u16 snd_qn, snd_qc[8], snd_qa[8], snd_qb[8];
void snd_boot(void);
void snd_flush(void);

u16 nr_stage;
/* ------------------------------------------------------------------ data block */
static rp DATA;
static u16 ndir;
static u8 tagbuf[4];
static rp sec(const char *tag, u16 *len) {
    u16 i; rp e;
    for (i = 0; i < ndir; i++) {
        e = DATA + 16 + i * 12;
        if (e[0] == tag[0]) if (e[1] == tag[1]) if (e[2] == tag[2]) if (e[3] == tag[3]) {
            if (len) *len = e[8] | (e[9] << 8);
            return mkptr(e[4] | (e[5] << 8), e[6]);
        }
    }
    if (len) *len = 0;
    return 0;
}
static u16 rd16(rp p) { return p[0] | (p[1] << 8); }


/* ------------------------------------------------------------------ meta */
static rp META;
static u16 lives0, nlevels, song_title, song_clear;
static s16 G_GRAV, G_JUMP, G_JUMPRUN, G_RUN, G_RUNFAST, G_ACCEL, G_MAXFALL;
static u16 hero_w, hero_h, hero_frames;
static u8 sfx_id[8];
enum { SFX_JUMP, SFX_COIN, SFX_STOMP, SFX_HURT, SFX_SPRING, SFX_ONEUP, SFX_CLEAR, SFX_DIE };

/* ------------------------------------------------------------------ sound */
static u16 mus_cur;
static void snd_q(u16 c, u16 a, u16 b) { u16 n = snd_qn; if (n >= 8) return; snd_qc[n] = c; snd_qa[n] = a; snd_qb[n] = b; snd_qn = n + 1; }
static void sfx(u16 ev) { if (sfx_id[ev] != 0xFF) snd_q(1, sfx_id[ev], 0); }
static void music(u16 id) { if (id == 0xFF) return; if (id == mus_cur) return; mus_cur = id; snd_q(2, id, 0); }
static void music_stop(void) { mus_cur = 0xFFFF; snd_q(3, 0, 0); }
static void sound_init(void) {
    u16 n = 0, k, len; rp p; char tag[5];
    snd_blocks[0] = 0x0200; snd_blocks[1] = plo((rp)&nr_driver); snd_blocks[2] = pbank((rp)&nr_driver); snd_blocks[3] = plo((rp)&nr_driver_end) - plo((rp)&nr_driver);
    n = 4;
    tag[0] = 'S'; tag[1] = 'N'; tag[2] = 'D'; tag[4] = 0;
    for (k = 0; k < 6; k++) {
        tag[3] = '0' + k;
        p = sec(tag, &len);
        if (!p) break;
        /* chunk header: u16 destination in sound RAM, then the bytes */
        snd_blocks[n] = rd16(p); snd_blocks[n + 1] = plo(p) + 2; snd_blocks[n + 2] = pbank(p); snd_blocks[n + 3] = len - 2;
        n += 4;
    }
    snd_blocks[n + 3] = 0;
    snd_boot();
    mus_cur = 0xFFFF;
}

/* ------------------------------------------------------------------ video helpers */
static u8 txt[2048];            /* BG3 map (32x32 entries) */
static u16 txt_dirty;
static u8 colbuf[128];          /* one metatile column = 2 tile columns x 32 rows */
static u16 col_pending, col_vaddr;
static void text_clear(void) { memset(txt, 0, 2048); txt_dirty = 1; }
static void text(u16 x, u16 y, const char *s, u16 pal) {
    u16 o = (y * 32 + x) * 2;
    while (*s) { if (o < 2048) { txt[o] = (u8)(*s - 32); txt[o + 1] = 0x20 | (pal << 2); } o += 2; s++; }
    txt_dirty = 1;
}
static char nbuf[8];
static char *num(u16 v) { u16 i = 6; nbuf[7] = 0; nbuf[6] = '0'; if (!v) return nbuf + 6; while (v) { nbuf[i] = '0' + (v % 10); v /= 10; i--; } return nbuf + i + 1; }
static void fade(s16 from, s16 to) {
    s16 b = from;
    while (1) { setBrightness((u8)b); WaitForVBlank(); if (b == to) break; if (to > from) b++; else b--; }
}
static void vram_col(void) {            /* vertical DMA of the queued BG1 column (2 x 32 tiles) */
    u16 h;
    for (h = 0; h < 2; h++) {
        R8(0x2115) = 0x81;
        R8(0x2116) = (u8)(col_vaddr + h); R8(0x2117) = (u8)((col_vaddr + h) >> 8);
        R8(0x4300) = 0x01; R8(0x4301) = 0x18;
        R8(0x4302) = (u8)((u16)&colbuf[h * 64]); R8(0x4303) = (u8)(((u16)&colbuf[h * 64]) >> 8); R8(0x4304) = 0x7E;
        R8(0x4305) = 64; R8(0x4306) = 0;
        R8(0x420B) = 1;
    }
    R8(0x2115) = 0x80;
}
static u16 pad, padh;
static void frame_end(void) {
    u16 k;
    WaitForVBlank();
    if (col_pending) { vram_col(); col_pending = 0; }
    if (txt_dirty) { dmaCopyVram((u8 *)txt, 0x4C00, 2048); txt_dirty = 0; }
    if (snd_qn) snd_flush();
    k = padsCurrent(0); padh = k & ~pad; pad = k;
}

/* ------------------------------------------------------------------ level */
#define MAXW 255
static u8 map[MAXW * 16];
static u16 LW, LH, lvl, lvl_song;
static rp MT; static rp MCOL;
static u16 nmt;
static char lvl_name[17];
#define C_EMPTY 0
#define C_SOLID 1
#define C_PLAT 2
#define C_HURT 3
static u16 colat(s16 x, s16 y) {        /* collision at pixel x,y */
    u16 mx, my, m;
    if (x < 0) return C_SOLID;
    mx = (u16)x >> 4; if (mx >= LW) return C_SOLID;
    if (y < 0) return C_EMPTY;
    my = (u16)y >> 4; if (my >= LH) return C_EMPTY;
    m = map[mx * LH + my];
    if (m >= nmt) return C_EMPTY;
    return MCOL[m];
}
static void build_col(u16 mx) {          /* metatile column mx -> colbuf, queued for the BG1 map */
    u16 my, m, e, r;
    rp q;
    for (my = 0; my < 16; my++) {
        m = (mx < LW && my < LH) ? map[mx * LH + my] : 0;
        if (m >= nmt) m = 0;
        q = MT + m * 8;
        for (r = 0; r < 2; r++) {
            e = (my * 2 + r) * 2;
            colbuf[e] = q[r * 4]; colbuf[e + 1] = q[r * 4 + 1];              /* left tile */
            colbuf[64 + e] = q[r * 4 + 2]; colbuf[64 + e + 1] = q[r * 4 + 3]; /* right tile */
        }
    }
    e = (mx * 2) & 63;
    col_vaddr = (e < 32) ? (0x5400 + e) : (0x5800 + e - 32);
    col_pending = 1;
}
static void draw_all_cols(u16 first) {   /* during forced blank: write 32 metatile columns */
    u16 i;
    for (i = 0; i < 32; i++) { build_col(first + i); vram_col(); }
    col_pending = 0;
}

/* ------------------------------------------------------------------ actors */
#define NA 48
enum { O_START, O_COIN, O_WALKER, O_HOPPER, O_FLYER, O_SPRING, O_HEART, O_CHECK, O_GOAL };
static u16 ax[NA], ay[NA], ay0[NA];
static s16 avx[NA], avy[NA];
static u8 at[NA], aon[NA], ast[NA], atm[NA];
static u16 na;
/* sprite sheets: base tile, frame stride, frames, w, h, palette */
static u16 sp_fb[9][8], sp_frames[9], sp_w[9], sp_h[9], sp_pal[9];

/* hero (positions in 1/16 px) */
static u16 px, py, chkx, chky, coins, score, lives, dir, ground, coy, jbuf, inv, dead_t, clear_t, hw, hh, anim;
static s16 vx, vy;
static s16 camx, camy;
static u16 drawn_l, drawn_r;

static void spawn_actors(rp objs, u16 n) {
    u16 i, t;
    na = 0; chkx = 32; chky = 11 * 16;
    for (i = 0; i < n; i++) {
        t = objs[i * 3];
        if (t == O_START) { chkx = objs[i * 3 + 1] * 16; chky = objs[i * 3 + 2] * 16; continue; }
        if (na >= NA) continue;
        at[na] = (u8)t; aon[na] = 1; ast[na] = 0; atm[na] = (u8)(i * 7);
        ax[na] = (u16)objs[i * 3 + 1] * 256; ay[na] = (u16)objs[i * 3 + 2] * 256; ay0[na] = ay[na];
        /* lift anything placed inside solid ground (dev kit rule BURIED_OBJECT) */
        while (ay[na] >= 256 && colat(objs[i * 3 + 1] * 16 + 8, (ay[na] >> 4) + 8) == C_SOLID) ay[na] -= 256;
        avx[na] = 0; avy[na] = 0;
        if (t == O_WALKER) avx[na] = -8;
        if (t == O_FLYER) avx[na] = -10;
        na++;
    }
}
static void respawn(void) {
    px = chkx * 16 + (16 - hw) * 8; py = (chky + 16 - hh) * 16; vx = 0; vy = 0; dead_t = 0; inv = 60; ground = 0;
}
static void hud(void) {
    text_clear();
    text(1, 1, "SCORE", 0); text(7, 1, num(score), 0);
    text(14, 1, "COINS", 0); text(20, 1, num(coins), 0);
    text(24, 1, "LIVES", 0); text(30, 1, num(lives), 0);
}

static void load_level(u16 i) {
    u16 len, n, w, k; rp p; char tag[5];
    setBrightness(0); WaitForVBlank();
    tag[0] = 'L'; tag[1] = 'V'; tag[2] = '0' + (i / 10); tag[3] = '0' + (i % 10); tag[4] = 0;
    p = sec(tag, &len); if (!p) return;
    for (k = 0; k < 16; k++) lvl_name[k] = p[k]; lvl_name[16] = 0;
    LW = p[16]; LH = p[17]; lvl_song = p[18]; n = p[19];
    if (LH > 16) LH = 16;
    w = LW * LH;
    for (k = 0; k < w; k++) map[k] = p[20 + k];
    hw = hero_w - 4; hh = hero_h - 2;
    spawn_actors(p + 20 + w, n);
    respawn(); inv = 0;
    camx = (s16)(px >> 4) - 112; if (camx < 0) camx = 0; if (camx > (s16)(LW * 16) - 256) camx = (s16)(LW * 16) - 256; if (camx < 0) camx = 0;
    camy = 32;
    drawn_l = camx >> 4; drawn_r = drawn_l + 17;
    draw_all_cols(drawn_l);
    bgSetScroll(0, camx, camy); bgSetScroll(1, camx >> 1, 0);
    hud();
    text(10, 12, lvl_name, 0);
    dmaCopyVram((u8 *)txt, 0x4C00, 2048);
    music(lvl_song);
    clear_t = 0; dead_t = 0; anim = 0;
}

/* ------------------------------------------------------------------ hero */
static void die(void) { dead_t = 1; vy = -G_JUMP; sfx(SFX_DIE); }
static void hero(void) {
    s16 maxv, nx, ny, j, gr;
    u16 c, top, k, hx, hy;
    if (dead_t) {
        dead_t++; vy += G_GRAV; if (vy > G_MAXFALL) vy = G_MAXFALL; py += vy;
        if (dead_t > 100) {
            if (lives == 0) { dead_t = 999; return; }
            lives--; respawn(); hud();
        }
        return;
    }
    if (clear_t) { clear_t++; return; }
    maxv = (padh & KEY_Y) ? G_RUNFAST : G_RUN;
    if (pad & KEY_Y) maxv = G_RUNFAST;
    if (pad & KEY_LEFT) { vx -= G_ACCEL; if (vx < -maxv) vx = -maxv; dir = 1; }
    else if (pad & KEY_RIGHT) { vx += G_ACCEL; if (vx > maxv) vx = maxv; dir = 0; }
    else { if (vx > 0) { vx -= G_ACCEL; if (vx < 0) vx = 0; } else if (vx < 0) { vx += G_ACCEL; if (vx > 0) vx = 0; } }
    /* horizontal */
    nx = (s16)(px >> 4) + (vx >> 4);
    hx = (u16)nx; hy = py >> 4;
    if (vx > 0) {
        if (colat(nx + hw - 1, hy) == C_SOLID || colat(nx + hw - 1, hy + hh / 2) == C_SOLID || colat(nx + hw - 1, hy + hh - 1) == C_SOLID) { nx = (((nx + hw - 1) >> 4) << 4) - hw; vx = 0; px = (u16)nx << 4; }
        else px += vx;
    } else if (vx < 0) {
        if (colat(nx, hy) == C_SOLID || colat(nx, hy + hh / 2) == C_SOLID || colat(nx, hy + hh - 1) == C_SOLID) { nx = ((nx >> 4) + 1) << 4; vx = 0; px = (u16)nx << 4; }
        else { if ((s16)px + vx < 0) px = 0; else px += vx; }
    }
    /* jump: buffer + coyote time */
    if (padh & (KEY_B | KEY_A)) jbuf = 6; else if (jbuf) jbuf--;
    if (ground) coy = 6; else if (coy) coy--;
    if (jbuf && coy) {
        j = G_JUMP;
        if (G_RUNFAST > 0) if (G_JUMPRUN > G_JUMP) { k = (vx < 0) ? -vx : vx; if (k > (u16)G_RUNFAST) k = G_RUNFAST; j += (s16)(((u16)(G_JUMPRUN - G_JUMP) * k) / (u16)G_RUNFAST); }
        vy = -j; jbuf = 0; coy = 0; ground = 0; sfx(SFX_JUMP);
    }
    gr = G_GRAV; if (vy < 0) if (!(pad & (KEY_B | KEY_A))) gr = G_GRAV * 2;
    vy += gr; if (vy > G_MAXFALL) vy = G_MAXFALL;
    ny = (s16)(py >> 4) + (vy >> 4);
    hx = px >> 4;
    ground = 0;
    if (vy >= 0) {
        top = ((u16)(ny + hh) >> 4) << 4;
        c = colat(hx + 1, ny + hh); if (c != C_SOLID) if (c != C_PLAT) c = colat(hx + hw - 2, ny + hh);
        if (c == C_SOLID || (c == C_PLAT && (py >> 4) + hh <= top)) { py = (top - hh) << 4; vy = 0; ground = 1; }
        else py += vy;
    } else {
        if (colat(hx + 1, ny) == C_SOLID || colat(hx + hw - 2, ny) == C_SOLID) { py = (((u16)ny >> 4) + 1) << 8; vy = 0; }
        else { if ((s16)py + vy < 0) py = 0; else py += vy; }
    }
    if (inv) inv--;
    if (colat(hx + hw / 2, (py >> 4) + hh - 2) == C_HURT) die();
    else if ((py >> 4) > LH * 16 + 16) die();
}

/* ------------------------------------------------------------------ actors update */
static u16 hit(u16 i, u16 bh, s16 boff) {
    s16 hx = (s16)(px >> 4), hy = (s16)(py >> 4), ex = (s16)(ax[i] >> 4), ey = (s16)(ay[i] >> 4) + boff;
    if (hx >= ex + 14) return 0; if (ex + 2 >= hx + (s16)hw) return 0;
    if (hy >= ey + (s16)bh) return 0; if (ey + 2 >= hy + (s16)hh) return 0;
    return 1;
}
static u16 solidish(s16 x, s16 y) { u16 c = colat(x, y); return c == C_SOLID || c == C_PLAT; }
static void actors(void) {
    u16 i, t; s16 ex, ey, fx;
    for (i = 0; i < na; i++) {
        if (!aon[i]) continue;
        t = at[i]; atm[i]++;
        ex = (s16)(ax[i] >> 4); ey = (s16)(ay[i] >> 4);
        if (ex < camx - 64) continue; if (ex > camx + 320) continue;
        if (t == O_WALKER || t == O_HOPPER) {
            if (ast[i]) { ast[i]++; if (ast[i] > 24) aon[i] = 0; continue; }
            if (t == O_HOPPER) {
                if (solidish(ex + 8, ey + 16)) { if (avy[i] >= 0) { if ((atm[i] % 70) == 0) { avy[i] = -64; avx[i] = ((px >> 4) < (u16)ex) ? -12 : 12; } else if ((atm[i] % 70) > 2) avx[i] = 0; } }
            }
            avy[i] += G_GRAV; if (avy[i] > 80) avy[i] = 80;
            ax[i] += avx[i]; ex = (s16)(ax[i] >> 4);
            if (avx[i] < 0) { if (colat(ex, ey + 8) == C_SOLID) { avx[i] = -avx[i]; ax[i] += avx[i] * 2; } }
            else if (avx[i] > 0) { if (colat(ex + 15, ey + 8) == C_SOLID) { avx[i] = -avx[i]; ax[i] += avx[i] * 2; } }
            if (t == O_WALKER) { fx = (avx[i] < 0) ? ex - 1 : ex + 16; if (!solidish(fx, ey + 17)) if (colat(ex + 8, ey + 17)) avx[i] = -avx[i]; }
            ay[i] += avy[i]; ey = (s16)(ay[i] >> 4);
            if (avy[i] >= 0) if (solidish(ex + 3, ey + 16) || solidish(ex + 12, ey + 16)) { ay[i] = (((u16)(ey + 16) >> 4) - 1) << 8; avy[i] = 0; }
            if (ey > (s16)(LH * 16 + 32)) aon[i] = 0;
        }
        if (t == O_FLYER) { ax[i] += avx[i]; if ((atm[i] % 160) == 0) avx[i] = -avx[i]; ay[i] = ay0[i] + (s16)((atm[i] & 63) < 32 ? (atm[i] & 31) * 10 : (31 - (atm[i] & 31)) * 10) - 160; }
        if (t == O_SPRING) if (ast[i]) ast[i]--;
        if (dead_t || clear_t) continue;
        if (t == O_GOAL) { if (hit(i, 224, -208)) { clear_t = 1; score += 1000; music_stop(); sfx(SFX_CLEAR); music(song_clear); hud(); } continue; }
        if (!hit(i, 16, 0)) continue;
        if (t == O_COIN) { aon[i] = 0; coins++; score += 10; sfx(SFX_COIN); if (coins >= 100) { coins = 0; lives++; sfx(SFX_ONEUP); } hud(); }
        else if (t == O_HEART) { aon[i] = 0; lives++; score += 50; sfx(SFX_ONEUP); hud(); }
        else if (t == O_CHECK) { if (!ast[i]) { ast[i] = 1; chkx = ex; chky = ey; } }
        else if (t == O_SPRING) { if (vy > 0) { vy = -(G_JUMP + G_JUMP / 2 + G_JUMP / 10); ast[i] = 8; sfx(SFX_SPRING); } }
        else if (t == O_WALKER || t == O_HOPPER || t == O_FLYER) {
            if (ast[i]) continue;
            if (vy > 0 && (s16)(py >> 4) + (s16)hh < ey + 10) { ast[i] = 1; if (t == O_FLYER) aon[i] = 0; vy = -(G_JUMP * 3 / 5); score += 100; sfx(SFX_STOMP); hud(); }
            else if (!inv) die();
        }
    }
}

/* ------------------------------------------------------------------ drawing */
static u16 oid;
static void piece(s16 x, s16 y, u16 tile, u16 pal, u16 flip, u16 large) {
    if (oid >= 128 * 4) return;
    if (x < -32 || x > 256 || y < -64 || y > 224) return;
    oamSet(oid, (u16)x & 0x1FF, (u16)y & 0xFF, 2, flip, 0, tile, pal);
    oamSetEx(oid, large ? OBJ_LARGE : OBJ_SMALL, OBJ_SHOW);
    oid += 4;
}
static void sprite(u16 s, u16 f, s16 x, s16 y, u16 flip) {
    u16 base, large;
    if (f >= sp_frames[s]) f = sp_frames[s] - 1;
    base = sp_fb[s][f];
    large = sp_w[s] > 16;
    if (sp_h[s] > sp_w[s]) {            /* tall: two square pieces stacked */
        piece(x, y, base, sp_pal[s], flip, large);
        piece(x, y + (s16)sp_w[s], base + (large ? 64 : 32), sp_pal[s], flip, large);
    } else piece(x, y, base, sp_pal[s], flip, large);
}
static const u8 type_sheet[9] = {0, 4, 1, 2, 3, 6, 7, 8, 5};   /* object type -> sheet (hero 0, walker 1, hopper 2, flyer 3, coin 4, goal 5, spring 6, heart 7, check 8) */
static void draw(void) {
    u16 i, t, f, hf;
    s16 sx, sy;
    oid = 0;
    /* hero first so it is on top */
    if (!(inv & 2)) {
        hf = 0;
        if (dead_t) hf = 4; else if (!ground) hf = 3; else if (vx) hf = 1 + ((anim >> 3) & 1);
        sprite(0, hf, (s16)(px >> 4) - (s16)((hero_w - hw) / 2) - camx, (s16)(py >> 4) - (s16)(hero_h - hh) - camy, dir ? 0x40 : 0);
    }
    for (i = 0; i < na; i++) {
        if (!aon[i]) continue;
        t = at[i]; sx = (s16)(ax[i] >> 4) - camx; sy = (s16)(ay[i] >> 4) - camy;
        if (sx < -32) continue; if (sx > 256) continue;
        f = 0;
        if (t == O_COIN) f = (anim >> 3) & 3;
        else if (t == O_SPRING) f = ast[i] ? 1 : 0;
        else if (t == O_CHECK) f = ast[i] ? 1 : 0;
        else if (ast[i]) f = 2;
        else f = (anim >> 4) & 1;
        if (t == O_GOAL) sy -= 16;
        sprite(type_sheet[t], f, sx, sy, (avx[i] > 0) ? 0x40 : 0);
    }
    while (oid < 128 * 4) { oamSetVisible(oid, OBJ_HIDE); oid += 4; }
}
static void camera(void) {
    s16 tx, ty, maxx;
    tx = (s16)(px >> 4) + (s16)(hw / 2) - 112 + (dir ? -16 : 16);
    camx += (tx - camx) / 6;
    maxx = (s16)(LW * 16) - 256; if (camx > maxx) camx = maxx; if (camx < 0) camx = 0;
    ty = (s16)(py >> 4) - 100; camy += (ty - camy) / 6; if (camy < 0) camy = 0; if (camy > 32) camy = 32;
    /* stream metatile columns as the camera moves (one per frame) */
    if (!col_pending) {
        if ((u16)(camx >> 4) + 17 > drawn_r) { drawn_r++; drawn_l++; build_col(drawn_r); }
        else if ((u16)(camx >> 4) < drawn_l) { drawn_l--; drawn_r--; build_col(drawn_l); }
    }
    bgSetScroll(0, camx, camy);
    bgSetScroll(1, camx >> 1, camy >> 2);
}

/* ------------------------------------------------------------------ screens */
static void load_graphics(void) {
    u16 len; rp p;
    p = sec("PALS", &len); if (p) dmaCopyCGram((u8 *)p, 0, 512);
    p = sec("BG1T", &len); if (p) dmaCopyVram((u8 *)p, 0x0000, len);
    p = sec("BG2T", &len); if (p) dmaCopyVram((u8 *)p, rd16(META + 86), len);
    p = sec("BG2M", &len); if (p) dmaCopyVram((u8 *)p, 0x5C00, len);
    p = sec("OBJT", &len); if (p) dmaCopyVram((u8 *)p, 0x6000, len);
    dmaCopyVram((u8 *)&nr_font, 0x5000, plo((rp)&nr_font_end) - plo((rp)&nr_font));
}
static void splash(void) {
    setBrightness(0);
    dmaCopyVram((u8 *)&nr_logo_tiles, 0x0000, plo((rp)&nr_logo_tiles_end) - plo((rp)&nr_logo_tiles));
    dmaCopyVram((u8 *)&nr_logo_map, 0x5400, 32 * 32 * 2);
    dmaCopyCGram((u8 *)&nr_logo_pal, 0, 32);
    bgSetMapPtr(0, 0x5400, SC_32x32);
    bgSetScroll(0, 0, 0);
    bgSetDisable(1); bgSetDisable(2);
    setScreenOn();
    fade(0, 15);
    sound_init();                       /* uploads the music while the logo is showing */
    { u16 i; for (i = 0; i < 60; i++) { WaitForVBlank(); } }
    fade(15, 0);
    bgSetEnable(1); bgSetEnable(2);
}
/* the logo uses palette 0 entries; the map's palette bits are 0, so give it palette 1 colours by copying */
static u16 title_screen(void) {
    u16 t = 0;
    setBrightness(0);
    load_graphics();
    bgSetMapPtr(0, 0x5400, SC_64x32);
    /* the title shows the background picture only */
    { u16 i; memset(colbuf, 0, 128); for (i = 0; i < 32; i++) { col_vaddr = (i * 2 < 32) ? 0x5400 + i * 2 : 0x5800 + i * 2 - 32; vram_col(); } }
    bgSetScroll(0, 0, 0); bgSetScroll(1, 0, 0);
    text_clear();
    text((32 - strlen((char *)META)) / 2, 6, (char *)META, 0);
    if (META[32]) { text(13, 9, "BY", 0); text((32 - strlen((char *)META + 32)) / 2, 10, (char *)META + 32, 0); }
    text(10, 20, "PRESS START", 1);
    dmaCopyVram((u8 *)txt, 0x4C00, 2048); txt_dirty = 0;
    oid = 0; while (oid < 128 * 4) { oamSetVisible(oid, OBJ_HIDE); oid += 4; }
    music(song_title);
    fade(0, 15);
    while (1) {
        frame_end(); t++;
        if ((t & 31) == 0) { if (t & 32) text(10, 20, "           ", 1); else text(10, 20, "PRESS START", 1); }
        if (padh & (KEY_START | KEY_A | KEY_B)) break;
    }
    fade(15, 0);
    return 1;
}
static void message(const char *a, const char *b, u16 frames) {
    u16 i;
    text_clear(); text((32 - strlen(a)) / 2, 11, a, 0); if (b) text((32 - strlen(b)) / 2, 13, b, 1);
    for (i = 0; i < frames; i++) { frame_end(); if (i > 30) if (padh & KEY_START) break; }
}

/* cutscenes: CUTS section = count, then per scene: when(0 intro,1 before level,2 ending), level, nlines, lines of (x, y, len, chars) */
static char csbuf[33];
static void play_cs(u16 when, u16 lv) {
    u16 len, n, k, o, cw, cl, ln, j, x, y, l, i, show;
    rp p;
    p = sec("CUTS", &len);
    if (!p) return;
    n = p[0]; o = 1;
    for (k = 0; k < n; k++) {
        cw = p[o]; cl = p[o + 1]; ln = p[o + 2]; o += 3;
        show = 0;
        if (cw == when) { if (when != 1) show = 1; else if (cl == lv) show = 1; }
        if (show) { text_clear(); bgSetDisable(0); bgSetDisable(1); }
        for (j = 0; j < ln; j++) {
            x = p[o]; y = p[o + 1]; l = p[o + 2];
            if (show) { for (i = 0; i < l; i++) csbuf[i] = (char)p[o + 3 + i]; csbuf[l] = 0; text(x, y, csbuf, 0); }
            o += 3 + l;
        }
        if (show) {
            dmaCopyVram((u8 *)txt, 0x4C00, 2048); txt_dirty = 0;
            oid = 0; while (oid < 128 * 4) { oamSetVisible(oid, OBJ_HIDE); oid += 4; }
            fade(0, 15);
            while (1) { frame_end(); if (padh & (KEY_START | KEY_A)) break; }
            fade(15, 0);
            bgSetEnable(0); bgSetEnable(1);
        }
    }
}

/* ------------------------------------------------------------------ main */
int main(void) {
    u16 len; rp s;
    DATA = mkptr(0x8000, 0x90);
    ndir = rd16(DATA + 10);
    META = sec("META", &len);
    s = sec("SFXI", &len); { u16 i; for (i = 0; i < 8; i++) sfx_id[i] = s ? s[i] : 0xFF; }
    lives0 = META[56]; nlevels = META[57]; song_title = META[58]; song_clear = META[59];
    G_GRAV = (s16)rd16(META + 60); G_JUMP = (s16)rd16(META + 62); G_JUMPRUN = (s16)rd16(META + 64); G_RUN = (s16)rd16(META + 66);
    G_RUNFAST = (s16)rd16(META + 68); G_ACCEL = (s16)rd16(META + 70); G_MAXFALL = (s16)rd16(META + 72);
    hero_w = META[74]; hero_h = META[75]; hero_frames = META[76];
    nmt = rd16(META + 80);
    MT = sec("MTIL", &len); MCOL = sec("MCOL", &len);
    s = sec("SPRT", &len);
    { u16 i, f; for (i = 0; i < 9; i++) { for (f = 0; f < 8; f++) sp_fb[i][f] = rd16(s + i * 24 + f * 2); sp_frames[i] = s[i * 24 + 16]; sp_w[i] = s[i * 24 + 17]; sp_h[i] = s[i * 24 + 18]; sp_pal[i] = s[i * 24 + 19]; if (!sp_frames[i]) sp_frames[i] = 1; } }

    nr_stage = 1;
    consoleInit();
    bgSetGfxPtr(0, 0x0000); bgSetGfxPtr(1, rd16(META + 86)); bgSetGfxPtr(2, 0x5000);
    bgSetMapPtr(0, 0x5400, SC_64x32); bgSetMapPtr(1, 0x5C00, SC_32x32); bgSetMapPtr(2, 0x4C00, SC_32x32);
    oamInitGfxAttr(0x6000, OBJ_SIZE16_L32);
    setMode(BG_MODE1, BG3_MODE1_PRIORITY_HIGH);
    splash();
    while (1) {
        title_screen();
        lives = lives0; score = 0; coins = 0; lvl = 0;
        play_cs(0, 0);
        play_cs(1, 0);
        load_level(0);
        fade(0, 15);
        while (1) {
            frame_end(); anim++;
            if (padh & KEY_START) { message("PAUSED", 0, 1); while (1) { frame_end(); if (padh & KEY_START) break; } hud(); }
            hero(); actors(); camera(); draw();
            if (dead_t == 999) { music_stop(); message("GAME OVER", "PRESS START", 400); fade(15, 0); break; }
            if (clear_t > 180) {
                fade(15, 0);
                lvl++;
                if (lvl >= nlevels) { play_cs(2, 0); setBrightness(15); message("THE END", "THANKS FOR PLAYING", 600); fade(15, 0); break; }
                play_cs(1, lvl);
                load_level(lvl); fade(0, 15);
            }
            if (clear_t == 2) { text(10, 12, "LEVEL CLEAR!", 0); }
            if (anim == 150) if (!clear_t) hud();
        }
    }
    return 0;
}
